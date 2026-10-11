import { RECORDATORIO, decidirRecordatorio, tocaElTema } from './recordatorio.mjs'

// Cuando salio el ultimo recordatorio, en $.store: lo comparten todas las sesiones de la PC, como el hook bash (1x/h en toda la PC).
const CLAVE = 'ultimoRecordatorioMs'

async function home($) {
  // USERPROFILE primero porque es lo que tiene el proceso de la app de escritorio en Windows; HOME existe en Git Bash.
  return (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
}

// Registro propio en ~/.claude/mods-log/recordatorio-ccsc.log. $.fs no tiene append: se lee y se reescribe acotado a 500 lineas.
async function anotar($, linea) {
  const ruta = (await home($)) + '/.claude/mods-log/recordatorio-ccsc.log'
  let previo = ''
  try { previo = await $.fs.read(ruta) } catch { previo = '' }
  const lineas = String(previo ?? '').split('\n').filter(Boolean).slice(-499)
  lineas.push(linea)
  try { await $.fs.write(ruta, lineas.join('\n') + '\n') } catch { /* sin registro no se frena nada */ }
}

// Devuelve el texto para el contexto del modelo, o null si el turno no toca el tema o ya salio en la ultima hora.
async function evaluar($, texto, evento) {
  if (!tocaElTema(texto)) return null // lo barato primero: la mayoria de los turnos no toca el tema y no gasta llamadas a $
  const ahora = await $.clock.now()
  const d = decidirRecordatorio(texto, await $.store.get(CLAVE), ahora)
  if (d.emitir) await $.store.set(CLAVE, d.ultimoMs)
  await anotar($, `${new Date(ahora).toISOString()} ${evento} ${d.emitir ? 'RECORDATORIO' : `silencio (faltan ${d.minutosRestantes} min)`}`)
  return d.emitir ? RECORDATORIO : null
}

export function register(on) {
  // Una linea al cargar: asi el registro muestra que el mod corrio aunque nadie toque el tema.
  on('session.start', async ($, e, next) => {
    await anotar($, `${new Date(await $.clock.now()).toISOString()} session.start surface=${e.surface}`)
    return next(e)
  })

  // Lo que escribe Fak: se agrega `context`, que el modelo lee y el usuario no ve. Siempre next(e), nunca drop.
  on('prompt.submit', async ($, e, next) => {
    const extra = await evaluar($, e.text, 'prompt.submit')
    return extra ? next({ ...e, context: [...(e.context ?? []), extra] }) : next(e)
  }).catch(async ($, e, next) => next(e)) // si el mod falla, el prompt sigue como si el mod no existiera

  // Lo que edita Claude: despues de que la herramienta corrio, el recordatorio va como `context` del resultado.
  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny) return result
    const texto = [e.file_path, e.new_string, e.content].filter((v) => typeof v === 'string').join('\n')
    const extra = await evaluar($, texto, 'tool.call ' + e.tool)
    return extra ? { ...result, context: [...(result.context ?? []), extra] } : result
  }).catch(async ($, e, next) => next(e)) // la herramienta ya corrio (o corre ahora): nunca se bloquea
}

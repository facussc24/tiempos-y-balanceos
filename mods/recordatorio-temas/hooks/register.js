import { decidir, esDeFak, leerCanon } from './temas.mjs'

// Donde quedaron los temas ya avisados, en $.store: { [sesion]: { [idTema]: ms } }. Lo comparten todas las sesiones de la
// PC; la cuenta de una hora es POR sesion (decidir()).
const CLAVE = 'temasAvisados'
// El canon vive en el repo, no en la copia instalada del mod: se edita en un solo lugar y lo leen tambien los tests.
const CANON = '/scripts/_lib/temasCanon.data.json'

const barras = (ruta) => String(ruta).replaceAll('\\', '/').replace(/\/$/, '')

async function home($) {
  // USERPROFILE primero porque es lo que tiene el proceso de la app de escritorio en Windows; HOME existe en Git Bash.
  return (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
}

async function raizSesion($) {
  try { const r = await $.session.root(); if (r) return barras(r) } catch { /* sigue */ }
  try { const c = await $.session.cwd(); if (c) return barras(c) } catch { /* sigue */ }
  return ''
}

async function sesionId($) {
  try { return await $.session.id() } catch { return undefined }
}

// Registro propio en ~/.claude/mods-log/recordatorio-temas.log. $.fs no tiene append: se lee y se reescribe acotado.
async function anotar($, linea) {
  const ruta = barras(await home($)) + '/.claude/mods-log/recordatorio-temas.log'
  let previo = ''
  try { previo = await $.fs.read(ruta) } catch { previo = '' }
  const lineas = String(previo ?? '').split('\n').filter(Boolean).slice(-499)
  lineas.push(linea)
  try { await $.fs.write(ruta, lineas.join('\n') + '\n') } catch { /* sin registro no se frena nada */ }
}

// Los turnos de una misma sesion llegan de a uno, pero el store es compartido: se lee, se decide y se escribe en fila.
let fila = Promise.resolve()
function enFila(tarea) {
  const r = fila.then(tarea, tarea)
  fila = r.then(() => {}, () => {})
  return r
}

async function evaluar($, e) {
  const ahora = await $.clock.now()
  const iso = new Date(ahora).toISOString()
  const origen = e.origin?.kind ?? '?'
  const sesion = await sesionId($)
  if (!esDeFak(e.origin, e.isMeta)) { await anotar($, `${iso} prompt.submit origen=${origen} sesion=${sesion ?? '?'} no es de Fak: nada`); return [] }
  const raiz = await raizSesion($)
  let texto = null
  try { texto = raiz ? await $.fs.read(raiz + CANON) : null } catch { texto = null }
  const leido = leerCanon(texto)
  // La ruta va absoluta: el modelo la abre con Read, que no entiende «~».
  const canon = leido && { ...leido, memoriaDir: leido.memoriaDir.replace(/^~/, barras(await home($))) }
  if (!canon) { await anotar($, `${iso} prompt.submit origen=${origen} sesion=${sesion ?? '?'} sin canon en ${raiz || '(sin raiz)'}${CANON}: nada`); return [] }
  return enFila(async () => {
    const d = decidir({ texto: e.text, origen: e.origin, isMeta: e.isMeta, sesion, vistos: await $.store.get(CLAVE), ahoraMs: ahora, canon })
    await $.store.set(CLAVE, d.vistos)
    const que = d.renglones.length ? `AVISO ${d.renglones.map((r) => r.id).join(',')}` : 'ningun tema'
    await anotar($, `${iso} prompt.submit origen=${origen} sesion=${sesion ?? '?'} ${que}${d.silenciados.length ? ` · ya avisado en la ultima hora: ${d.silenciados.join(',')}` : ''}`)
    return d.renglones.map((r) => r.texto)
  })
}

export function register(on) {
  // Una linea al cargar: asi el registro muestra que el mod corrio aunque Fak no nombre ningun tema.
  on('session.start', async ($, e, next) => {
    await anotar($, `${new Date(await $.clock.now()).toISOString()} session.start surface=${e.surface}`)
    return next(e)
  })

  // Lo que escribe Fak: se agrega `context`, que el modelo lee y Fak no ve. Siempre next(e), nunca drop.
  on('prompt.submit', async ($, e, next) => {
    if (e.command) return next(e) // un comando de barra no es una pregunta sobre un tema
    const renglones = await evaluar($, e)
    return renglones.length ? next({ ...e, context: [...(e.context ?? []), renglones.join('\n')] }) : next(e)
  }).catch(async ($, e, next) => next(e)) // si el mod falla, el mensaje sigue como si el mod no existiera
}

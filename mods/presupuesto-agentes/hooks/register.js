import { decidir, leerFrontmatter, leerLimite, lineaDeRegistro } from './presupuesto.mjs'

// false (auditor Opus 11/10/2026): si este hook falla o se pasa de los 10 s, la llamada PASA y decide el guardian bash
// (`agentes-guard.sh`), que sigue puesto. Con true, un error propio negaba hasta la auditoria final (`auditor`), que tiene
// que pasar siempre. Se vuelve a evaluar el dia que el guardian bash se retire (fase 3 de techo-agentes.md).
const FALLA_CERRADA = false

// Lo ultimo que empujo session.measure: respaldo si $.session.usage() no responde dentro de agent.spawn. Siempre una lista.
let ultimaMedida = []

function iso(ms) {
  return new Date(ms).toISOString()
}

async function home($) {
  // USERPROFILE primero porque es lo que tiene el proceso de la app de escritorio en Windows; HOME existe en Git Bash.
  return (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
}

async function leerSiExiste($, ruta) {
  try { return await $.fs.read(ruta) } catch { return null }
}

// El session_id es opcional (solo lo usa el pase .agent-builtin-ok): si la llamada falla no se niega todo por eso.
async function sesionId($) {
  try { return await $.session.id() } catch { return undefined }
}

// mtimeMs y texto de un escape por archivo, o null si no existe. Si vale todavia (12 h) lo juzga decidir(), no la cascara.
async function leerEscape($, ruta) {
  try {
    const st = await $.fs.stat(ruta)
    return { mtimeMs: st.mtimeMs, texto: (await leerSiExiste($, ruta)) ?? '' }
  } catch { return null }
}

const barras = (ruta) => String(ruta).replaceAll('\\', '/').replace(/\/$/, '')

// La raiz del proyecto de la sesion, absoluta: es donde viven las definiciones del proyecto (auditor, auditor-cliente,
// amfe-healer). Una ruta relativa se resuelve contra la carpeta de trabajo, que un `cd` de la sesion mueve: con eso el
// auditor quedaba «sin definicion» y se negaba. Si root() no responde, la carpeta de trabajo; si tampoco, relativa.
async function raizSesion($) {
  try { const r = await $.session.root(); if (r) return barras(r) } catch { /* sigue */ }
  try { const c = await $.session.cwd(); if (c) return barras(c) } catch { /* sigue */ }
  return ''
}

// Busca `name: <tipo>` en el frontmatter de <raiz>/.claude/agents/*.md y de ~/.claude/agents/*.md, como el guardian bash
// (que usa CLAUDE_PROJECT_DIR). Devuelve { def, error }: `def` con la carpeta donde la encontro (para el registro) o
// null; `error` = no se encontro PORQUE algo no se pudo leer (no hay raiz del proyecto, una carpeta que existe no se
// dejo listar, un .md no se dejo abrir). Con `error` el mod no niega por «sin definicion»: seria negar por una falla
// propia, y eso le pegaba tambien al auditor (auditor Opus, 11/10/2026).
async function buscarDefinicion($, tipo, base, raiz) {
  let error = !raiz
  for (const dir of [(raiz ? raiz + '/' : '') + '.claude/agents', barras(base) + '/.claude/agents']) {
    let entradas = []
    try { entradas = await $.fs.list(dir) } catch {
      try { if (await $.fs.exists(dir)) error = true } catch { error = true }
      continue
    }
    for (const ent of entradas) {
      const nombre = typeof ent === 'string' ? ent : ent && ent.name // $.fs.list da { name, kind, size, isLink }; un string tambien se acepta
      if (typeof nombre !== 'string' || !nombre.endsWith('.md')) continue
      let texto = null
      try { texto = await $.fs.read(dir + '/' + nombre) } catch { error = true; continue }
      const def = leerFrontmatter(texto)
      if (def.name === tipo) return { def: { ...def, dir }, error: false }
    }
  }
  return { def: null, error }
}

// El libro de lanzamientos ($.store) se lee, se decide y se escribe de a UNO: varias llamadas a Agent en un mismo mensaje
// llegan juntas, y sin fila cada una leia la misma lista y la ultima escritura pisaba a las otras (subcontaba). La fila es
// de este proceso: dos sesiones a la vez todavia pueden pisarse (el store es un archivo compartido); ahi cubre el bash.
let fila = Promise.resolve()
function enFila(tarea) {
  const r = fila.then(tarea, tarea)
  fila = r.then(() => {}, () => {})
  return r
}

// Leer el libro, decidir y guardarlo. Corre adentro de la fila; la hora se toma adentro para que el orden sea el real.
async function asentar($, evento, escapes) {
  const ahora = await $.clock.now()
  const guardados = await $.store.get('lanzamientos')
  const d = decidir(evento, { lanzamientos: Array.isArray(guardados) ? guardados : [], escapes }, ahora)
  // Se guarda siempre: aunque se niegue, la lista vuelve podada a los 10 min (reemplaza a ~/.claude/.agent-spawns.log).
  await $.store.set('lanzamientos', d.estadoNuevo.lanzamientos)
  return { d, ahora }
}

// Registro propio: ~/.claude/mods-log/presupuesto-agentes.log (fecha ISO, evento, decision, motivo), acotado a 1000 lineas.
// Es leer, agregar y escribir el archivo entero: por eso SIEMPRE se llama adentro de la fila (`enFila`). Suelto, con doce
// lanzamientos juntos quedaban entre 1 y 4 lineas de 12 (auditor Opus, 11/10/2026), y este registro es la evidencia para
// retirar el guardian bash y lo que lee el tablero. Dos sesiones a la vez todavia pueden pisarse una linea.
async function anotar($, base, linea) {
  const ruta = base + '/.claude/mods-log/presupuesto-agentes.log'
  const lineas = String((await leerSiExiste($, ruta)) ?? '').split('\n').filter(Boolean).slice(-999)
  lineas.push(linea)
  try { await $.fs.write(ruta, lineas.join('\n') + '\n') } catch { /* el registro no frena */ }
}

// Asentar un lanzamiento y dejarlo en el registro, las dos cosas en el mismo turno de la fila.
async function asentarYAnotar($, base, evento, escapes, datos) {
  const r = await asentar($, evento, escapes)
  await anotar($, base, lineaDeRegistro({ ...datos, ahora: r.ahora, accion: r.d.accion, peso: r.d.peso, motivo: r.d.motivo }))
  return r
}

function cupoTexto(rateLimits) {
  return rateLimits.map((r) => `${r.kind}=${r.percentUsed}%`).join(' ') || 'sin lectura'
}

async function guardia($, e, next) {
  const base = await home($)
  const raiz = await raizSesion($)
  const [limite, opusOk, builtinOk, cupoOk, { def: definicion, error: definicionError }, sessionId] = await Promise.all([
    leerEscape($, base + '/.claude/.agent-limit'),
    leerEscape($, base + '/.claude/.agent-opus-ok'),
    leerEscape($, base + '/.claude/.agent-builtin-ok'),
    leerEscape($, base + '/.claude/.agent-cupo-ok'),
    buscarDefinicion($, e.subagentType, base, raiz),
    sesionId($),
  ])
  // El % real de las ventanas de 5 h y semanal, fresco; si la llamada falla o no trae la lista, queda la ultima medida empujada.
  let rateLimits = ultimaMedida
  try {
    const usage = await $.session.usage()
    if (usage && Array.isArray(usage.rateLimits)) rateLimits = usage.rateLimits
  } catch { /* respaldo */ }

  const evento = {
    subagentType: e.subagentType,
    model: e.model,
    effort: 'effort' in e ? e.effort : undefined, // los tipos no lo declaran en agent.spawn: se lee solo si viene
    fork: e.fork,
    definicion,
    definicionError,
    rateLimits,
    sessionId,
  }
  const escapes = {
    limite: limite && { mtimeMs: limite.mtimeMs, valor: leerLimite(limite.texto) },
    opusOk: opusOk && { mtimeMs: opusOk.mtimeMs },
    builtinOk: builtinOk && { sessionId: String(builtinOk.texto).split('\n')[0].trim() },
    cupoOk: cupoOk && { mtimeMs: cupoOk.mtimeMs },
  }
  // `def=` dice en que carpeta se encontro la definicion; «sin» = no esta; «error» = no se pudo leer. Es lo que muestra,
  // en la primera sesion real, si la ruta del proyecto resolvio.
  const datos = { tipo: e.subagentType, model: e.model, cupo: cupoTexto(rateLimits), def: definicion ? definicion.dir : definicionError ? 'error' : 'sin' }
  const { d } = await enFila(() => asentarYAnotar($, base, evento, escapes, datos))
  if (d.accion === 'negar') {
    $.ui.log('subagente bloqueado: ' + d.motivo) // linea tenue para Fak; el modelo lee el deny como error del Agent tool
    return { deny: 'BLOQUEADO (presupuesto-agentes): ' + d.motivo }
  }
  return next(e)
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    // `mod=` es la carpeta desde la que cargo ESTA sesion. Hay dos copias instaladas: la del marketplace
    // (~/.claude/mods-casa/<mod>/) y la que `claude plugin install` deja en ~/.claude/plugins/cache/. Medido el
    // 11/10/2026: la app de escritorio cargo la de la cache; el `claude` de la terminal, la del marketplace.
    const linea = `${iso(await $.clock.now())} session.start surface=${e.surface} raiz=${(await raizSesion($)) || '(sin raiz)'} mod=${barras($.plugin.root)}`
    const base = await home($)
    await enFila(() => anotar($, base, linea))
    return next(e)
  })

  // Cada subagente pasa por aca: pesar, sumar la ventana, mirar el cupo real, negar o dejar pasar.
  on('agent.spawn', guardia).catch(async ($, e, next) => {
    // Queda dicho: una falla muda dejaba el registro en cero y nadie se enteraba de que el mod no estaba decidiendo.
    try {
      const base = await home($)
      const linea = `${iso(Date.now())} agent.spawn ERROR ${e.subagentType} :: el hook fallo (${next.error?.kind ?? 'sin dato'}): ${FALLA_CERRADA ? 'se niega' : 'decide el guardian bash'}`
      await enFila(() => anotar($, base, linea))
    } catch { /* sin registro tampoco frena */ }
    if (next.called) return next(e) // ya habia dejado pasar: vale ese resultado, no se lanza dos veces
    if (!FALLA_CERRADA) return next(e)
    return { deny: `BLOQUEADO (presupuesto-agentes): el guardian fallo (${next.error.kind}) y por eso no se lanzo el subagente. No reintentes; hace el trabajo vos y avisale a Fak.` }
  })

  // El % de cupo llega empujado despues de cada turno: queda de respaldo y en el registro cada vez que se mueve un punto.
  on('session.measure', async ($, e, next) => {
    // Solo una lista reemplaza el respaldo: un evento sin rateLimits no lo pisa (si lo pisara con undefined, guardia() fallaria y, con FALLA_CERRADA, negaria todo).
    if (Array.isArray(e.rateLimits)) ultimaMedida = e.rateLimits
    if ((e.changed ?? []).includes('rateLimits')) {
      const linea = `${iso(await $.clock.now())} session.measure ${cupoTexto(ultimaMedida)}`
      const base = await home($)
      await enFila(() => anotar($, base, linea))
    }
    return next(e)
  })

  // Donde la doc SI expone el esfuerzo: cada pedido al modelo. Para un subagente, `max` se rebaja a xhigh ("el anteultimo",
  // Fak 30/09/2026): la regla se cumple aunque agent.spawn no traiga `effort`. Es rebaja, no negacion: ver A VERIFICAR 1.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined || e.effort !== 'max') return yield* next(e)
    $.ui.log(`subagente ${e.agentId}: effort max rebajado a xhigh (techo-agentes.md)`)
    return yield* next({ ...e, effort: 'xhigh' })
  })
}

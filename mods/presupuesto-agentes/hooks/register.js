import { decidir, leerFrontmatter, leerLimite } from './presupuesto.mjs'

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

// Busca `name: <tipo>` en el frontmatter de <cwd>/.claude/agents/*.md y de ~/.claude/agents/*.md, como el guardian bash.
async function buscarDefinicion($, tipo, base) {
  for (const dir of ['.claude/agents', base + '/.claude/agents']) {
    let entradas = []
    try { entradas = await $.fs.list(dir) } catch { continue }
    for (const ent of entradas) {
      const nombre = typeof ent === 'string' ? ent : ent && ent.name // la forma de las entradas no esta en los adjuntos: string u objeto con name
      if (typeof nombre !== 'string' || !nombre.endsWith('.md')) continue
      const def = leerFrontmatter(await leerSiExiste($, dir + '/' + nombre))
      if (def.name === tipo) return def
    }
  }
  return null
}

// Registro propio: ~/.claude/mods-log/presupuesto-agentes.log (fecha ISO, evento, decision, motivo), acotado a 1000 lineas.
async function anotar($, base, linea) {
  const ruta = base + '/.claude/mods-log/presupuesto-agentes.log'
  const lineas = String((await leerSiExiste($, ruta)) ?? '').split('\n').filter(Boolean).slice(-999)
  lineas.push(linea)
  try { await $.fs.write(ruta, lineas.join('\n') + '\n') } catch { /* el registro no frena */ }
}

function cupoTexto(rateLimits) {
  return rateLimits.map((r) => `${r.kind}=${r.percentUsed}%`).join(' ') || 'sin lectura'
}

async function guardia($, e, next) {
  const ahora = await $.clock.now()
  const base = await home($)
  const [limite, opusOk, builtinOk, definicion, sessionId, guardados] = await Promise.all([
    leerEscape($, base + '/.claude/.agent-limit'),
    leerEscape($, base + '/.claude/.agent-opus-ok'),
    leerEscape($, base + '/.claude/.agent-builtin-ok'),
    buscarDefinicion($, e.subagentType, base),
    sesionId($),
    $.store.get('lanzamientos'),
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
    rateLimits,
    sessionId,
  }
  const estado = {
    lanzamientos: Array.isArray(guardados) ? guardados : [],
    escapes: {
      limite: limite && { mtimeMs: limite.mtimeMs, valor: leerLimite(limite.texto) },
      opusOk: opusOk && { mtimeMs: opusOk.mtimeMs },
      builtinOk: builtinOk && { sessionId: String(builtinOk.texto).split('\n')[0].trim() },
    },
  }
  const d = decidir(evento, estado, ahora)
  // Se guarda siempre: aunque se niegue, la lista vuelve podada a los 10 min (reemplaza a ~/.claude/.agent-spawns.log).
  await $.store.set('lanzamientos', d.estadoNuevo.lanzamientos)
  await anotar($, base, `${iso(ahora)} agent.spawn ${d.accion.toUpperCase()} ${e.subagentType} model=${e.model ?? '(definicion)'} peso=${d.peso} cupo[${cupoTexto(rateLimits)}] :: ${d.motivo}`)
  if (d.accion === 'negar') {
    $.ui.log('subagente bloqueado: ' + d.motivo) // linea tenue para Fak; el modelo lee el deny como error del Agent tool
    return { deny: 'BLOQUEADO (presupuesto-agentes): ' + d.motivo }
  }
  return next(e)
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await anotar($, await home($), `${iso(await $.clock.now())} session.start surface=${e.surface}`)
    return next(e)
  })

  // Cada subagente pasa por aca: pesar, sumar la ventana, mirar el cupo real, negar o dejar pasar.
  on('agent.spawn', guardia).catch(async ($, e, next) => {
    if (next.called) return next(e) // ya habia dejado pasar: vale ese resultado, no se lanza dos veces
    if (!FALLA_CERRADA) return next(e)
    return { deny: `BLOQUEADO (presupuesto-agentes): el guardian fallo (${next.error.kind}) y por eso no se lanzo el subagente. No reintentes; hace el trabajo vos y avisale a Fak.` }
  })

  // El % de cupo llega empujado despues de cada turno: queda de respaldo y en el registro cada vez que se mueve un punto.
  on('session.measure', async ($, e, next) => {
    // Solo una lista reemplaza el respaldo: un evento sin rateLimits no lo pisa (si lo pisara con undefined, guardia() fallaria y, con FALLA_CERRADA, negaria todo).
    if (Array.isArray(e.rateLimits)) ultimaMedida = e.rateLimits
    if ((e.changed ?? []).includes('rateLimits')) {
      await anotar($, await home($), `${iso(await $.clock.now())} session.measure ${cupoTexto(ultimaMedida)}`)
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

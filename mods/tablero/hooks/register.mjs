// El mod: junta lo vivo ($.session.usage, session.measure, $.agent.list) con lo leído
// de disco (estado.mjs) y lo dibuja (dibujo.mjs) en la banda arriba del prompt y, a
// pedido (/tablero), en un panel. No decide ni frena nada: muestra.
import { leerEstado, armarCupo } from './estado.mjs'
import { dibujar } from './dibujo.mjs'

const PANEL = 'tablero'
const CASA = 'Barack Mercosul'  // nombre de la casa en la línea de identidad; el proyecto sale de la carpeta
const CADA_MS = 60_000          // «faltan» y la ventana de 10 min cambian a ese ritmo; más seguido no aporta
const CASA_POR_DEFECTO = 'C:/Users/FacundoS-PC/.claude' // solo si no hay USERPROFILE ni HOME

// Lo que dibuja ui.render. Lo llena refrescar(); el render nunca toca el disco.
let estado = null
let limites = []      // último session.measure (o $.session.usage() al arrancar)
let cwdInicial = '.'  // e.cwd de session.start, por si $.session.cwd() falla

// Adaptadores para estado.mjs: null donde falte el archivo o la llamada tire, así «sin datos» y no un error
function armarFs($) {
  return {
    leer: async (ruta) => { try { return await $.fs.read(ruta) } catch { return null } },
    stat: async (ruta) => { try { return await $.fs.stat(ruta) } catch { return null } },
    listar: async (ruta) => { try { return await $.fs.list(ruta) } catch { return null } },
  }
}
function armarReloj($) {
  return { ahora: async () => $.clock.now() }
}

// `~` no se expande en $.fs: la carpeta sale del entorno, con la ruta de esta PC de respaldo
async function carpetaCasa($) {
  let perfil = null
  try { perfil = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) } catch { perfil = null }
  if (!perfil) return CASA_POR_DEFECTO
  return String(perfil).replaceAll('\\', '/').replace(/\/$/, '') + '/.claude'
}

async function refrescar($) {
  try {
    let agentes = []
    try { agentes = await $.agent.list() } catch { agentes = [] }
    let sesion = null
    try { sesion = await $.session.id() } catch { sesion = null }
    let cwd = cwdInicial
    try { cwd = (await $.session.cwd()) ?? cwdInicial } catch { cwd = cwdInicial }
    const casa = await carpetaCasa($)
    const repo = String(cwd).replaceAll('\\', '/').replace(/\/$/, '') || '.'
    const lista = Array.isArray(agentes) ? agentes : []
    estado = await leerEstado(armarFs($), armarReloj($), {
      sesion: sesion == null ? null : String(sesion),
      casa, repo, limites,
      corriendo: lista.filter((a) => a && a.status === 'running').length,
      nombreCasa: CASA,
      proyecto: repo.split('/').filter(Boolean).at(-1) ?? null,
    })
  } catch (error) {
    // El tablero no frena nada: si la lectura falla se dibuja «sin datos» y queda en el debug log
    estado = null
    try { await $.ui.log('tablero: no pude leer el estado: ' + String(error), { to: 'debug' }) } catch { /* sin log tampoco frena */ }
  }
  try { $.ui.invalidate('ui.render') } catch { /* sin redibujo queda lo anterior */ }
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    if (typeof e.cwd === 'string' && e.cwd) cwdInicial = e.cwd
    // session.measure recién llega después del primer turno: una lectura inicial del cupo
    try {
      const uso = await $.session.usage()
      limites = Array.isArray(uso?.rateLimits) ? uso.rateLimits : []
    } catch { limites = [] }
    $.clock.every(CADA_MS, () => refrescar($))
    // Último del hook: si el nombre está tomado tira, y lo de arriba ya quedó hecho
    try {
      await $.command.register({ name: 'tablero', description: 'Abre el tablero de la casa en un panel', immediate: true })
    } catch { /* sin /tablero el tablero sigue en la banda */ }
    void refrescar($) // sin await: la sesión arranca ya y la banda se llena sola
    return next(e)
  })

  // Después de cada turno y cuando una ventana se mueve un punto entero: lo trae el evento
  on('session.measure', async ($, e, next) => {
    if (Array.isArray(e.rateLimits)) {
      limites = e.rateLimits
      if (estado) estado = { ...estado, cupo: armarCupo(limites) }
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('command.run', { command: 'tablero' }, async ($) => {
    await $.ui.open({ id: PANEL, title: 'Tablero', closeOnEscape: true, rows: 8 })
    return {}
  })

  // La banda es compartida: lo de los otros mods va debajo del tablero, no se tapa.
  // Si el dibujo falla, la banda queda como sin este mod (lo que dibujaron los otros).
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const deOtros = await next(e)
    try {
      return dibujar(estado, $.ui.resolve(e), { ancho: e.props?.bodyColumns, debajo: deOtros })
    } catch {
      return deOtros
    }
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANEL) return next(e)
    try {
      return dibujar(estado, $.ui.resolve(e), { ancho: e.props?.bodyColumns })
    } catch {
      return next(e)
    }
  })
}

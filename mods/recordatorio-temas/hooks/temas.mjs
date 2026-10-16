// Parte pura del mod recordatorio-temas: sin `$`, se prueba con vitest (__tests__/mods/recordatorio-temas.test.mjs).
// La cascara (register.js) lee el canon de <raiz del proyecto>/scripts/_lib/temasCanon.data.json, el reloj y el $.store.

// Origenes de un mensaje que NO son Fak escribiendo: avisos de tareas, otra sesion, una tarea programada, un plugin. El
// encargo de una sesion madre nombra «plotter», «tornillo» o «plan del sistema» y no es una pregunta de Fak. Lo demas
// (composer, bridge, sdk, unclassified) pasa: como manda la app de escritorio un mensaje de Fak no esta medido todavia
// (16/10/2026), y el registro anota el origen de cada uno para saberlo.
export const ORIGENES_QUE_NO_SON_FAK = [
  'task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay', 'channel',
  'coordinator', 'observer', 'observer-activity', 'auto-continuation', 'slack-ping', 'plugin',
]

export function esDeFak(origen, isMeta) {
  if (isMeta) return false
  const kind = origen && typeof origen === 'object' ? origen.kind : undefined
  return !ORIGENES_QUE_NO_SON_FAK.includes(kind)
}

// Minusculas, sin acentos, y todo lo que no es letra, numero o guion bajo pasa a espacio. El guion bajo queda adentro de
// la palabra a proposito: «IMG_0585» es un video, no la moldeadora IMG.
export function normalizar(texto) {
  return ' ' + String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim() + ' '
}

// El canon como viene del archivo. Devuelve null si no se puede usar: sin canon el mod calla (nunca frena).
export function leerCanon(texto) {
  let c
  try { c = JSON.parse(String(texto ?? '')) } catch { return null }
  if (!c || !Array.isArray(c.temas)) return null
  const temas = c.temas
    .filter((t) => t && typeof t.id === 'string' && Array.isArray(t.archivos) && t.archivos.length && Array.isArray(t.frases))
    .map((t) => ({ ...t, frasesNorm: t.frases.map(normalizar).filter((f) => f.trim()) }))
  return {
    memoriaDir: typeof c.memoria_dir === 'string' ? c.memoria_dir : '~/.claude/projects/C--Dev-BarackMercosul/memory',
    cooldownMs: (Number(c.cooldown_min) > 0 ? Number(c.cooldown_min) : 60) * 60_000,
    maxTemas: Number(c.max_temas_por_mensaje) > 0 ? Number(c.max_temas_por_mensaje) : 3,
    temas,
  }
}

// Los temas que nombra el texto, el de frase mas larga primero (lo especifico antes que «el plotter» a secas).
export function temasDelTexto(texto, canon) {
  if (!canon) return []
  const t = normalizar(texto)
  const hallados = []
  for (const tema of canon.temas) {
    const largo = Math.max(0, ...tema.frasesNorm.filter((f) => t.includes(f)).map((f) => f.length))
    if (largo) hallados.push({ tema, largo })
  }
  return hallados.sort((a, b) => b.largo - a.largo).map((h) => h.tema).slice(0, canon.maxTemas)
}

export function renglon(tema, memoriaDir) {
  const rutas = tema.archivos.map((a) => '`' + memoriaDir.replace(/\/$/, '') + '/' + a + '`').join(' y ')
  return `Tema «${tema.nombre}»: leé ${rutas} antes de contestar.`
}

// Decide que renglones salen. `vistos`: { [sesion]: { [idTema]: ms } } del $.store. Un tema sale una vez por hora POR
// SESION: Fak habla con varias a la vez y la segunda no tiene por que quedarse sin el aviso. Devuelve el estado nuevo,
// podado a las ultimas 24 h para que el store no crezca con cada sesion.
export function decidir({ texto, origen, isMeta, sesion, vistos, ahoraMs, canon }) {
  const base = vistos && typeof vistos === 'object' ? vistos : {}
  const podado = {}
  for (const [s, porTema] of Object.entries(base)) {
    if (!porTema || typeof porTema !== 'object') continue
    const vivos = Object.entries(porTema).filter(([, ms]) => typeof ms === 'number' && ahoraMs - ms < 24 * 3600_000)
    if (vivos.length) podado[s] = Object.fromEntries(vivos)
  }
  if (!esDeFak(origen, isMeta) || !canon) return { renglones: [], silenciados: [], vistos: podado, deFak: esDeFak(origen, isMeta) }
  const clave = sesion || 'sin-sesion'
  const propios = { ...(podado[clave] ?? {}) }
  const renglones = []
  const silenciados = []
  for (const tema of temasDelTexto(texto, canon)) {
    const ultimo = propios[tema.id]
    if (typeof ultimo === 'number' && ahoraMs - ultimo < canon.cooldownMs) { silenciados.push(tema.id); continue }
    propios[tema.id] = ahoraMs
    renglones.push({ id: tema.id, texto: renglon(tema, canon.memoriaDir) })
  }
  const vistosNuevos = renglones.length ? { ...podado, [clave]: propios } : podado
  return { renglones, silenciados, vistos: vistosNuevos, deFak: true }
}

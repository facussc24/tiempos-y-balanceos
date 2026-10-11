// Lectura PURA del estado de la casa: recibe un `fs` ({ leer, stat, listar } que
// devuelven null si falta) y un `reloj` ({ ahora }), así se prueba sin la app y
// corre dentro del mod, que no tiene Node ni disco propio. Nada de acá decide: mide.

export const TOPE_PUNTOS = 40                 // agentes-guard.sh: 40 puntos por ventana
export const VENTANA_AGENTES_MS = 10 * 60_000 // la ventana de 10 minutos de ese guard

const dos = (n) => String(n).padStart(2, '0')

// 'AAAA-MM-DD' en hora local: los archivos de la casa están en hora local, no UTC
export function fechaLocal(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

// 'AAAA-MM-DD HH:MM' (como lo escribe horaGuard.mjs) → ms en hora local; null si no parsea
export function msLocal(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(texto ?? '')
  if (!m) return null
  const [a, me, d, h, mi] = m.slice(1).map(Number)
  return new Date(a, me - 1, d, h, mi).getTime()
}

// ISO (resetsAt) → 'HH:MM' local, para «renueva 23:00»
export function horaLocal(iso) {
  const ms = Date.parse(iso ?? '')
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`
}

// Los tramos que pidió el dueño: verde < 60, ámbar 60-85, rojo > 85
export function tramo(pct) {
  if (pct == null) return 'sin'
  return pct > 85 ? 'rojo' : pct >= 60 ? 'ambar' : 'verde'
}

// rateLimits de session.measure / $.session.usage(): [{ kind, percentUsed, resetsAt }]
export function armarCupo(limites) {
  const lista = Array.isArray(limites) ? limites : []
  const ventana = (kind) => {
    const l = lista.find((x) => x && x.kind === kind)
    if (!l || typeof l.percentUsed !== 'number') return null
    return { pct: l.percentUsed, tramo: tramo(l.percentUsed), renueva: horaLocal(l.resetsAt) }
  }
  return { cincoHoras: ventana('five_hour'), semana: ventana('seven_day') }
}

// .agent-spawns.log: '<epoch s> <tool> <peso>' por lanzamiento; cuenta solo la ventana vigente
export function leerAgentes(texto, ahora) {
  if (texto == null) return { puntos: null, lanzados: null, tope: TOPE_PUNTOS }
  let puntos = 0
  let lanzados = 0
  for (const linea of texto.split('\n')) {
    const [epoch, , peso] = linea.trim().split(/\s+/)
    const t = Number(epoch) * 1000
    if (!Number.isFinite(t) || t > ahora || ahora - t > VENTANA_AGENTES_MS) continue
    lanzados += 1
    puntos += Number(peso) || 0
  }
  return { puntos, lanzados, tope: TOPE_PUNTOS }
}

// mods-log/presupuesto-agentes.log, el registro del mod que pesa los lanzamientos: una línea por decisión,
// '<ISO> agent.spawn PERMITIR <tipo> model=… peso=<n> cupo[…] def=… :: <a>/<tope> puntos…'. Cuentan las
// PERMITIR de la ventana vigente; el tope es el de la última decisión de la ventana (el mod lo baja con la
// semana en ámbar), o el de siempre si ninguna lo dice.
export function leerAgentesMod(texto, ahora) {
  if (texto == null) return { puntos: null, lanzados: null, tope: TOPE_PUNTOS }
  let puntos = 0
  let lanzados = 0
  let tope = TOPE_PUNTOS
  for (const linea of texto.split('\n')) {
    const m = /^(\S+) agent\.spawn (PERMITIR|NEGAR) .*?\bpeso=(\d+)\b/.exec(linea.trim())
    if (!m) continue
    const t = Date.parse(m[1])
    if (!Number.isFinite(t) || t > ahora || ahora - t > VENTANA_AGENTES_MS) continue
    const deLaDecision = /(\d+)\/(\d+) puntos/.exec(linea)
    if (deLaDecision) tope = Number(deLaDecision[2])
    if (m[2] !== 'PERMITIR') continue
    lanzados += 1
    puntos += Number(m[3])
  }
  return { puntos, lanzados, tope }
}

// Dos libros de lo mismo: el del guardián bash (.agent-spawns.log) y el del mod. Mientras conviven anotan los mismos
// lanzamientos, así que NO se suman: vale el que más puntos tiene en la ventana (el otro quedó atrás o ya no escribe),
// con el tope que dijo el mod si lo dijo. Sin ninguno de los dos, «sin datos».
export function juntarAgentes(deBash, deMod) {
  if (deBash.puntos == null) return deMod
  if (deMod.puntos == null) return deBash
  const base = deMod.puntos > deBash.puntos ? deMod : deBash
  return { ...base, tope: deMod.tope }
}

// .trabajar-hasta.json: { <sesión>: { hasta, pedido, fijado_ms, cumplido? } }.
// Vigente = sin `cumplido` y con `hasta` por delante; se prefiere la de esta sesión.
export function leerHora(texto, ahora, sesion) {
  if (texto == null) return null
  let todas
  try { todas = JSON.parse(texto) } catch { return null }
  if (!todas || typeof todas !== 'object') return null
  const vigentes = Object.entries(todas)
    .filter(([, h]) => h && typeof h === 'object')
    .map(([id, h]) => ({ id, ...h, hastaMs: msLocal(h.hasta) }))
    .filter((h) => !h.cumplido && h.hastaMs != null && h.hastaMs > ahora)
    .sort((a, b) => (b.fijado_ms ?? 0) - (a.fijado_ms ?? 0))
  const h = vigentes.find((v) => v.id === sesion) ?? vigentes[0]
  if (!h) return null
  return {
    hasta: h.hasta.slice(11, 16),
    faltanMin: Math.round((h.hastaMs - ahora) / 60_000),
    pedido: String(h.pedido ?? ''),
    propia: h.id === sesion,
  }
}

// ledger_AAAA-MM.jsonl: una línea JSON por llamada ({ ts, tarea, modelo, costoUsd, ... }).
// Una línea rota se saltea y se cuenta: el tablero no se cae por un write a medias.
export function leerLedger(texto, hoy) {
  if (texto == null) return { hoy: null, ciclo: null, llamadas: null, rotas: 0 }
  const r = { hoy: 0, ciclo: 0, llamadas: 0, rotas: 0 }
  for (const linea of texto.split('\n')) {
    if (!linea.trim()) continue
    let fila
    try { fila = JSON.parse(linea) } catch { r.rotas += 1; continue }
    const costo = Number(fila?.costoUsd)
    if (!Number.isFinite(costo)) { r.rotas += 1; continue }
    r.llamadas += 1
    r.ciclo += costo
    if (typeof fila.ts === 'string' && fila.ts.startsWith(hoy)) r.hoy += costo
  }
  return r
}

// Fecha de modificación de un stat de $.fs.stat: el extracto dice `mtimeMs` (número);
// si viniera `mtime` (Date, ISO o número) también sirve. null si no hay forma de saberlo.
export function msModificado(stat) {
  if (!stat || typeof stat !== 'object') return null
  const v = stat.mtimeMs ?? stat.mtime
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (v instanceof Date) return v.getTime()
  const ms = Date.parse(typeof v === 'string' ? v : '')
  return Number.isFinite(ms) ? ms : null
}

// nocturno.json: se muestra lo que se conoce del formato (la lista `prioridades`) y la
// fecha de modificación del archivo; los demás campos no se adivinan (ver A VERIFICAR)
export function leerNoche(texto, stat) {
  if (texto == null) return null
  let datos
  try { datos = JSON.parse(texto) } catch { return null }
  const ms = msModificado(stat)
  return {
    fecha: ms == null ? null : fechaLocal(ms),
    prioridades: Array.isArray(datos?.prioridades) ? datos.prioridades.length : null,
  }
}

// `vivo` es lo que no viene de un archivo: la sesión, las carpetas, el último
// session.measure y los agentes que $.agent.list() da por corriendo
export async function leerEstado(fs, reloj, vivo = {}) {
  const ahora = await reloj.ahora()
  const hoy = fechaLocal(ahora)
  const casa = vivo.casa ?? '~/.claude'
  const repo = vivo.repo ?? '.'
  const nocturno = `${repo}/.claude/state/nocturno.json`
  const [spawns, spawnsMod, hora, ledger, noche, nocheStat, enCurso] = await Promise.all([
    fs.leer(`${casa}/.agent-spawns.log`),
    fs.leer(`${casa}/mods-log/presupuesto-agentes.log`),
    fs.leer(`${casa}/.trabajar-hasta.json`),
    fs.leer(`${repo}/.sgc-cache/api/ledger_${hoy.slice(0, 7)}.jsonl`),
    fs.leer(nocturno),
    fs.stat(nocturno),
    fs.listar(`${repo}/.sgc-cache/api/en-curso`), // carpeta PROPUESTA (borrador §4): hoy no existe → «—»
  ])
  return {
    ahora,
    identidad: { casa: vivo.nombreCasa ?? null, proyecto: vivo.proyecto ?? null },
    cupo: armarCupo(vivo.limites),
    agentes: { ...juntarAgentes(leerAgentes(spawns, ahora), leerAgentesMod(spawnsMod, ahora)), corriendo: vivo.corriendo ?? null },
    hora: leerHora(hora, ahora, vivo.sesion),
    api: { ...leerLedger(ledger, hoy), mes: hoy.slice(0, 7), enCurso: Array.isArray(enCurso) ? enCurso.length : null },
    noche: leerNoche(noche, nocheStat),
  }
}

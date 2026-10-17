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
  const d = new Date(Math.round(ms / 60_000) * 60_000) // al minuto: 16:59:59 se lee 17:00
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
    const renuevaMs = Date.parse(l.resetsAt ?? '')
    // `renuevaMs`: para que el dibujo le ponga el día a la ventana de la semana («renueva vie 16/10 13:00»)
    return { pct: l.percentUsed, tramo: tramo(l.percentUsed), renueva: horaLocal(l.resetsAt), renuevaMs: Number.isFinite(renuevaMs) ? renuevaMs : null }
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

// saldo.json: el gasto de la API del ciclo, separado por clave. Lo deja scripts/_lib/claudeApi.mjs después de cada
// pedido (y `node scripts/_claude.mjs --check`): acá no se suma nada, se lee. El dueño, 11/10/2026: «los dólares de la
// api no los entiendo, ¿no era más fácil poner disponible, gastado, y separar entre cada api?».
//   { ciclo: { proximo: 'AAAA-MM-DD' }, estimado, claves: [{ nombre: 'principal', gastadoUsd, creditoUsd, quedanUsd },
//     { nombre: 'prestada', hasta: 'AAAAMMDD', gastadoUsd, agotada }, { nombre: <otra>, gastadoUsd }] }
// `viejo`: el ciclo del resumen ya se renovó y nadie gastó todavía (el resumen se rehace con el próximo pedido).
// Una prestada vencida no se muestra; «vencida» se decide contra HOY, no contra el día en que se escribió el archivo.
export function leerSaldo(texto, hoy) {
  if (texto == null) return null
  let datos
  try { datos = JSON.parse(texto) } catch { return null }
  const claves = Array.isArray(datos?.claves) ? datos.claves.filter((c) => c && typeof c === 'object') : null
  if (!claves) return null
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const proximo = /^\d{4}-\d{2}-\d{2}$/.test(datos?.ciclo?.proximo ?? '') ? datos.ciclo.proximo : null
  const hoyPegado = String(hoy ?? '').replaceAll('-', '')
  const p = claves.find((c) => c.nombre === 'principal')
  return {
    estimado: datos.estimado === true,
    renueva: proximo ? `${proximo.slice(8, 10)}/${proximo.slice(5, 7)}` : null,
    viejo: proximo != null && hoy != null && proximo <= hoy,
    plan: p && num(p.gastadoUsd) != null ? { gastado: p.gastadoUsd, quedan: num(p.quedanUsd), credito: num(p.creditoUsd) } : null,
    prestadas: claves
      .map((c) => ({ ...c, hasta: String(c.hasta ?? '') }))   // un `hasta` numerico no puede tumbar la banda entera
      .filter((c) => c.nombre === 'prestada' && /^\d{8}$/.test(c.hasta) && c.hasta >= hoyPegado)
      .map((c) => ({ hasta: `${c.hasta.slice(6, 8)}/${c.hasta.slice(4, 6)}`, gastado: num(c.gastadoUsd) ?? 0, agotada: c.agotada === true })),
  }
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

// nocturno.json: lo que dejó la tarea automática de la madrugada (scripts/_nocturno.mjs, 06:30). Se dice si corrió o
// no y por qué, con palabras que se entiendan sin conocer el programa (el dueño, 11/10/2026, sobre «noche 2026-10-11 ·
// 0 prioridades»: «lo de noche no se entiende tampoco»).
//   { cuandoMs, corrio, motivo, cortada, pasos, conError, enPausa, costoUsd }
// Lo que la noche deja para revisar (`prioridades`, hallazgos) NO se lee: son sugerencias sin verificar para la
// sesión de la mañana (regla api-claude.md §6), no un número para el dueño.
// `cuandoMs` sale de `inicio` ('AAAA-MM-DD HH:MM:SS', hora local) y, si falta, de la fecha del archivo.
// `motivo`: por qué no arrancó, en corto; un texto que no se reconoce va recortado, tal cual.
export function leerNoche(texto, stat) {
  if (texto == null) return null
  let datos
  try { datos = JSON.parse(texto) } catch { return null }
  if (!datos || typeof datos !== 'object') return null
  const pasos = Array.isArray(datos.pasos) ? datos.pasos.filter((p) => p && typeof p === 'object') : []
  const corridos = pasos.filter((p) => p.estado === 'ok' || p.estado === 'error')
  const noArranco = typeof datos.noArranco === 'string' ? datos.noArranco.trim() : ''
  let motivo = null
  if (noArranco) {
    motivo = /presupuesto|tope/i.test(noArranco) ? 'la API pasó su tope de gasto'
      : /clave/i.test(noArranco) ? 'falta la clave de la API'
        : noArranco.length > 60 ? noArranco.slice(0, 59).trimEnd() + '…' : noArranco
  }
  return {
    cuandoMs: msLocal(datos.inicio) ?? msModificado(stat),
    corrio: !noArranco,
    motivo,
    cortada: !noArranco && Boolean(datos.corte),
    pasos: corridos.length,
    conError: corridos.filter((p) => p.estado === 'error').length,
    // un pedido que no entraba en lo que quedaba del tope de la corrida queda en pausa (tanda 5, 17/10/2026): la noche
    // sale con error en el log y aca no puede decir «corrió bien»
    enPausa: noArranco ? 0 : pasos.filter((p) => p.pausa).length,
    costoUsd: typeof datos.costoUsd === 'number' && Number.isFinite(datos.costoUsd) ? datos.costoUsd : null,
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
  const [spawns, spawnsMod, hora, saldo, noche, nocheStat] = await Promise.all([
    fs.leer(`${casa}/.agent-spawns.log`),
    fs.leer(`${casa}/mods-log/presupuesto-agentes.log`),
    fs.leer(`${casa}/.trabajar-hasta.json`),
    fs.leer(`${repo}/.sgc-cache/api/saldo.json`),
    fs.leer(nocturno),
    fs.stat(nocturno),
  ])
  return {
    ahora,
    identidad: { casa: vivo.nombreCasa ?? null, proyecto: vivo.proyecto ?? null },
    cupo: armarCupo(vivo.limites),
    agentes: { ...juntarAgentes(leerAgentes(spawns, ahora), leerAgentesMod(spawnsMod, ahora)), corriendo: vivo.corriendo ?? null },
    hora: leerHora(hora, ahora, vivo.sesion),
    api: leerSaldo(saldo, hoy),
    noche: leerNoche(noche, nocheStat),
  }
}

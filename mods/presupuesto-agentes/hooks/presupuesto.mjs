// Pesos por costo (tabla oficial de precios, 08/10/2026). El 40 son los 10 Sonnet de Fak; la ventana es de la casa.
export const PESOS = { haiku: 1, sonnet: 4, opus: 8, fable: 20 }
export const LIMITE_DEFAULT = 10
export const VENTANA_MS = 10 * 60_000
export const VENCE_MS = 12 * 3_600_000 // vida de los escapes por archivo (A6, 10/09/2026)
// Por encima de esto no sale ningun subagente nuevo salvo la auditoria final: es lo que evita el incidente del 06/08.
export const UMBRAL_5H = 85
export const UMBRAL_SEMANAL = 60
export const AUDITORES = ['auditor', 'auditor-cliente']
const ESFUERZOS = ['low', 'medium', 'high', 'xhigh']
const FAMILIAS = ['haiku', 'sonnet', 'opus', 'fable']

// 'haiku' | 'sonnet' | 'opus' | 'fable' para un alias o un id completo; undefined si no vino; null si no es valido.
export function familia(model) {
  if (model === undefined || model === null || model === '') return undefined
  const m = String(model).toLowerCase()
  return FAMILIAS.find((f) => m === f || m.startsWith('claude-' + f + '-')) ?? null
}

// name/model/effort del frontmatter de una definicion de agente (entre el primer --- y el segundo), como leer_def del bash.
export function leerFrontmatter(texto) {
  const def = { name: '', model: '', effort: '' }
  if (typeof texto !== 'string') return def
  const lineas = texto.split(/\r?\n/)
  if (lineas[0].trim() !== '---') return def
  for (const l of lineas.slice(1)) {
    if (l.trim() === '---') break
    const m = /^(name|model|effort)\s*:\s*["']?([^\s"']*)/.exec(l)
    if (m) def[m[1]] = m[2]
  }
  return def
}

// El numero de ~/.claude/.agent-limit (hasta 4 digitos, como el guardian); null si el archivo no dice un numero.
export function leerLimite(texto) {
  const m = /\d{1,4}/.exec(String(texto ?? ''))
  return m ? Number(m[0]) : null
}

// Un escape por archivo vale 12 h desde su ultima modificacion; despues se ignora (el mod no puede borrarlo: $.fs no tiene delete).
function vigente(escape, ahora) {
  return Boolean(escape) && typeof escape.mtimeMs === 'number' && ahora - escape.mtimeMs <= VENCE_MS
}

function negar(motivo, estado, peso) {
  return { accion: 'negar', motivo, estadoNuevo: estado, peso }
}

// evento: { subagentType, model, effort, fork, definicion, rateLimits, sessionId }
// estado: { lanzamientos: [{ ts, tipo, modelo, peso }], escapes: { limite, opusOk, builtinOk } }
// ahora:  milisegundos desde la epoca; el reloj se inyecta para poder testear la ventana sin esperar
export function decidir(evento, estado, ahora) {
  const tipo = evento.subagentType ?? ''
  const fam = familia(evento.model)
  const esAuditor = AUDITORES.includes(tipo)
  const escapes = estado.escapes ?? {}
  // Lo que quedo fuera de la ventana se tira: el estado nuevo vuelve siempre acotado a 10 min.
  const base = { ...estado, lanzamientos: (estado.lanzamientos ?? []).filter((l) => l.ts >= ahora - VENTANA_MS) }

  // Por campo (`e.fork`) o por nombre (`subagent_type: fork`, que es lo que mira el bash).
  if (evento.fork || tipo === 'fork') return negar('Un fork corre en el modelo de la sesion principal: no se le puede elegir modelo ni esfuerzo.', base, 0)
  if (!tipo) return negar('La llamada no dice subagent_type: correria general-purpose, que no deja fijar el esfuerzo.', base, 0)
  if (evento.effort !== undefined && evento.effort !== '' && !ESFUERZOS.includes(evento.effort)) {
    return negar(`Se pidio effort=${evento.effort}: el maximo es xhigh, el anteultimo (Fak, 30/09/2026).`, base, 0)
  }
  if (esAuditor && fam !== undefined && fam !== 'opus') {
    return negar(`"${tipo}" es la auditoria final y corre en Opus: no se le pasa model=${evento.model}.`, base, 0)
  }
  if (!esAuditor && fam === null) {
    return negar(`Se pidio model=${evento.model}: los modelos validos son haiku, sonnet, opus o fable.`, base, 0)
  }

  // La definicion fija el piso: opus+xhigh para auditores; sonnet+xhigh o haiku+medium/high/xhigh para el resto.
  const def = evento.definicion
  let peso = esAuditor ? 0 : PESOS[fam ?? 'sonnet']
  if (def) {
    const famDef = familia(def.model)
    if (esAuditor) {
      if (famDef !== 'opus') return negar(`La definicion de "${tipo}" no dice model: opus (la auditoria final la hace Opus).`, base, 0)
      if (def.effort !== 'xhigh') return negar(`La definicion de "${tipo}" no dice effort: xhigh.`, base, 0)
    } else if (famDef === 'sonnet') {
      if (def.effort !== 'xhigh') return negar(`La definicion de "${tipo}" no dice effort: xhigh.`, base, 0)
    } else if (famDef === 'haiku') {
      if (!['medium', 'high', 'xhigh'].includes(def.effort)) return negar(`La definicion de "${tipo}" (haiku) no dice effort: medium, high o xhigh.`, base, 0)
      if (fam === undefined) peso = PESOS.haiku // definido en haiku descuenta como haiku aunque la llamada no diga modelo
    } else {
      return negar(`La definicion de "${tipo}" no dice model: sonnet ni haiku.`, base, 0)
    }
  } else {
    // Sin definicion solo pasa el pase de UNA sesion (~/.claude/.agent-builtin-ok con el session_id) y con model sonnet explicito.
    const pase = escapes.builtinOk
    if (!pase || !evento.sessionId || pase.sessionId !== evento.sessionId) {
      return negar(`"${tipo}" no tiene definicion propia (built-in o inexistente): no se le puede fijar modelo y esfuerzo.`, base, 0)
    }
    if (fam !== 'sonnet') return negar('Con el pase de sesion, el built-in necesita model sonnet explicito en la llamada.', base, 0)
  }

  // La auditoria final es obligatoria: pasa siempre y no descuenta, aunque el cupo o la ventana esten llenos.
  if (esAuditor) return { accion: 'permitir', motivo: 'auditoria final: pasa sin descontar', estadoNuevo: base, peso: 0 }

  // Cupo real antes que nada: por encima del umbral no sale nada nuevo y no hay escape por archivo (el escape era para la ventana).
  for (const rl of evento.rateLimits ?? []) {
    const umbral = rl.kind === 'five_hour' ? UMBRAL_5H : rl.kind === 'seven_day' ? UMBRAL_SEMANAL : null
    if (umbral !== null && rl.percentUsed > umbral) {
      const nombre = rl.kind === 'five_hour' ? 'de 5 horas' : 'semanal'
      return negar(`Cupo real: la ventana ${nombre} esta al ${rl.percentUsed} % (tope ${umbral} %). No sale ningun subagente nuevo hasta que baje; la auditoria final (auditor, auditor-cliente) si pasa. Hace el trabajo vos y avisale a Fak.`, base, peso)
    }
  }

  // Con el pase de Fak (~/.claude/.agent-opus-ok) Opus y Fable descuentan como Sonnet: el autorizo a gastar.
  if ((fam === 'opus' || fam === 'fable') && vigente(escapes.opusOk, ahora)) peso = PESOS.sonnet

  // Ventana de 10 min por puntos. ~/.claude/.agent-limit cambia el techo (N Sonnet); 0 apaga el conteo, no el cupo real.
  const limite = vigente(escapes.limite, ahora) && Number.isInteger(escapes.limite.valor) ? escapes.limite.valor : LIMITE_DEFAULT
  if (limite === 0) return { accion: 'permitir', motivo: 'conteo apagado por ~/.claude/.agent-limit = 0 (vale 12 h)', estadoNuevo: base, peso }
  const presupuesto = limite * PESOS.sonnet
  const puntos = base.lanzamientos.reduce((s, l) => s + (Number.isFinite(l.peso) ? l.peso : PESOS.sonnet), 0)
  if (puntos + peso > presupuesto) {
    const antiguo = base.lanzamientos.length ? Math.min(...base.lanzamientos.map((l) => l.ts)) : null
    const espera = antiguo === null ? '?' : Math.ceil((antiguo + VENTANA_MS - ahora) / 60_000)
    return negar(`Presupuesto de subagentes agotado: ${puntos}/${presupuesto} puntos en los ultimos 10 minutos; esta llamada pesa ${peso} (haiku 1 · sonnet 4 · opus 8 · fable 20). NO reintentes ni reformules: hace el trabajo vos, relanzalo en haiku si es buscar/leer/extraer, o espera ~${espera} min. Si Fak lo pidio textual en el chat, escribi \`echo 15 > ~/.claude/.agent-limit\` y decilo. Reportale que llegaste al techo.`, base, peso)
  }
  const lanzamiento = { ts: ahora, tipo, modelo: fam ?? familia(def && def.model) ?? 'sonnet', peso }
  return { accion: 'permitir', motivo: `${puntos + peso}/${presupuesto} puntos en la ventana`, estadoNuevo: { ...base, lanzamientos: [...base.lanzamientos, lanzamiento] }, peso }
}

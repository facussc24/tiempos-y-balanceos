// Una hora: la misma frecuencia que tenia el hook bash caracteristicas-especiales-guard.
export const COOLDOWN_MS = 60 * 60_000

// Siglas en mayuscula y con borde de palabra: "CC" o "SC" sueltas, no "ccusage" ni "escena"; el triangulo del manual tambien.
const SIGLAS = /\b(CC|SC|CS|D\/TLD|TLD)\b|▽/
// Las palabras del tema sin distinguir mayusculas: "Flujograma", "caracteristica especial", "significativa".
const PALABRAS = /caracter[ií]sticas?\s+especial|flujograma|significativ/i

export function tocaElTema(texto) {
  return typeof texto === 'string' && (SIGLAS.test(texto) || PALABRAS.test(texto))
}

// Decide si el recordatorio sale ahora. `ultimoMs`: cuando salio la ultima vez (0 si nunca). El reloj entra por parametro.
export function decidirRecordatorio(texto, ultimoMs, ahoraMs) {
  const toca = tocaElTema(texto)
  const ultimo = typeof ultimoMs === 'number' ? ultimoMs : 0
  const transcurrido = ahoraMs - ultimo
  const emitir = toca && transcurrido >= COOLDOWN_MS
  return {
    toca,
    emitir,
    ultimoMs: emitir ? ahoraMs : ultimo,
    // Solo cuando toca el tema y todavia no paso la hora: el registro lo anota para que se entienda el silencio.
    minutosRestantes: toca && !emitir ? Math.ceil((COOLDOWN_MS - transcurrido) / 60_000) : 0,
  }
}

// Lo que lee el modelo: .claude/rules/caracteristicas-especiales.md en nueve renglones, nada que no este ahi.
export const RECORDATORIO = [
  'Recordatorio (regla caracteristicas-especiales.md; pedido de Fak, 11/09/2026: "no quiero que nunca mas lo olvides"):',
  '- Critica = CC (para VW: D/TLD; manual: ▽): S = 9 o 10, O indistinto. Significativa = SC (el instructivo escribe CS): S = 5 a 8 y O >= 4. Lo demas: vacio.',
  '- D y TLD son UNA sola marca (D/TLD), documentacion obligatoria por exigencia legal; la designa el cliente en el plano. Una costura rota NO es D/TLD.',
  '- La sigla de una causa se justifica SOLO con su S y su O contra la tabla, mas lo que el cliente designo en el plano. Nunca porque otro documento la tenia.',
  '- La S sale del EFECTO (tabla P1 del AIAG-VDA), nunca de la sigla. Si el cliente designo algo y la S no llega a 9, se informa como diferencia; no se sube la S.',
  '- La marca de una operacion en el flujograma = union de las siglas de sus causas en el AMFE. Una ▽ heredada sin causa S >= 9 detras se informa, no se copia.',
  '- Asignar o cambiar CC/SC es de Fak o del cliente: yo calculo la lista por criterio, la muestro con S y O, y el OK de Fak la asigna.',
  '- Una sigla que ninguna fuente reconoce (W, Wichtig, Clave, PV2005, YC/YS) no se adivina: se reporta.',
  '- Antes de proponer poner, sacar o restaurar una sigla: escribir S, O y la regla.',
].join('\n')

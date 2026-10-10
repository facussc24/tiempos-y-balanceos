/**
 * idioma.mjs — ¿este texto le habla a Fak en ingles?
 *
 * Fak, 07/10/2026: "deja de hablar en ingles"; R4 (08/10): 65 turnos en ingles desde el 01/09, 7 justo despues de
 * compactar; 09/10 08:56 otra vez. Lo usan el cierre del turno (chequeo 10 de cierreGuard.mjs, cola H4) y la
 * contabilidad de _tokens.mjs, con UNA sola definicion.
 *
 * Como decide (medido el 09/10/2026 sobre 1.568 finales de turno reales desde el 01/09; ver el test): cuenta palabras
 * que solo existen en ingles (the, and, with, I'll, done, rendering...) contra palabras que solo existen en castellano
 * (el, que, de, con, ya, está, quedó... y cualquier palabra con tilde o ñ). No cuenta lo que no es prosa: bloques de
 * codigo, `codigo en linea`, rutas, links y lo citado entre comillas (una cita de una norma en ingles no es hablar en
 * ingles). Es ingles si hay 3 o mas palabras inglesas y mas del doble que castellanas, o 2 inglesas y ninguna
 * castellana en un texto de mas de 25 letras. Un texto corto en ingles ("Transcribing the two new audios first.")
 * tambien cae: la heuristica anterior de _tokens.mjs pedia 3 palabras de una lista corta y se le pasaban.
 */

const EN = new Set(['the', 'and', 'is', 'are', 'was', 'were', 'with', 'this', 'that', 'these', 'those', "i'll", "i've", "i'm",
  "here's", "let's", 'let', 'now', 'looking', 'checking', 'running', 'done', 'fixed', 'applied', 'first', 'then', 'also', 'but',
  'from', 'for', 'to', 'of', 'into', 'your', 'you', 'we', 'it', 'its', 'still', 'already', 'next', 'new', 'same', 'only', 'after',
  'before', 'because', 'than', 'which', 'what', 'how', 'all', 'both', 'each', 'out', 'over', 'about', 'understood', 'ready',
  'while', 'when', 'where', 'there', 'here', 'should', 'would', 'could', 'will', 'can', 'not', 'yes', 'ok', 'okay', 'again',
  'them', 'their', 'they', 'he', 'she', 'his', 'her', 'our', 'us', 'my', 'me', 'an', 'as', 'at', 'by', 'if', 'or', 'so', 'up', 'on',
  'in', 'two', 'three', 'four', 'five', 'times', 'twice', 'some', 'any', 'more', 'most', 'very', 'just', 'too', 'much', 'many', 'other', 'another']);
const ES = new Set(['el', 'la', 'los', 'las', 'que', 'de', 'con', 'para', 'una', 'un', 'ya', 'esto', 'esta', 'este', 'dale', 'listo',
  'sigo', 'ahora', 'pero', 'porque', 'como', 'cuando', 'donde', 'hay', 'es', 'son', 'fue', 'hice', 'hecho', 'queda', 'va', 'van',
  'se', 'lo', 'le', 'les', 'al', 'del', 'por', 'sin', 'sobre', 'tambien', 'mas', 'muy', 'bien', 'mal', 'nada', 'todo', 'todos',
  'cada', 'otro', 'otra', 'ese', 'esa', 'eso', 'si', 'yo', 'vos', 'te', 'mi', 'tu', 'su', 'sus', 'nos', 'y', 'o', 'u', 'ni', 'e',
  'entre', 'desde', 'hasta', 'antes', 'despues', 'tiene', 'tienen', 'tenia', 'estaba', 'quedo', 'salio', 'corri', 'puse',
  'falta', 'faltan', 'nuevo', 'nueva', 'mismo', 'misma', 'solo', 'sola', 'acá', 'aca', 'ahi', 'aqui', 'asi', 'bueno', 'buena']);
// 'a', 'no', 'con', 'me' y 'son' estan en los dos idiomas: 'a' y 'no' no cuentan; 'me' va a EN (en castellano es raro
// al arrancar un turno) y 'son'/'con' a ES.

/** Saca lo que no es prosa dirigida a Fak: codigo, rutas, links y citas. */
export function soloProsa(texto) {
  return String(texto ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[A-Za-z]:\\[^\s)]+|(?:\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)+/g, ' ')
    .replace(/«[^»]*»|"[^"\n]{12,}"|“[^”]*”/g, ' ');
}

/** { en, es, letras } de las primeras `tope` letras de prosa. */
export function contarIdioma(texto, tope = 300) {
  const p = soloProsa(texto).trim().slice(0, tope);
  let en = 0;
  let es = 0;
  for (const w of p.toLowerCase().split(/[^a-záéíóúüñ']+/).filter(Boolean)) {
    if (EN.has(w)) en += 1;
    else if (ES.has(w) || /[áéíóúñ]/.test(w)) es += 1;
    else if (w.length >= 6 && w.endsWith('ing')) en += 1;         // rendering, transcribing, editing
  }
  return { en, es, letras: p.length };
}

/** ¿El texto esta en ingles? (ver cabecera). Un error de la API ("API Error: ...") lo escribe la app, no yo: no cuenta. */
export function esIngles(texto) {
  if (/^\s*(API Error|You're out of usage)/.test(String(texto ?? ''))) return false;
  const { en, es, letras } = contarIdioma(texto);
  if (letras < 20) return false;
  return (en >= 3 && en > es * 2) || (en >= 2 && es === 0 && letras >= 25);
}

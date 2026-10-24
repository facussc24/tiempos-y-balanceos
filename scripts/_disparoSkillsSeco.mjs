#!/usr/bin/env node
/**
 * _disparoSkillsSeco.mjs — prueba de disparo EN SECO de las descriptions de los skills: sin modelo y sin API.
 *
 * POR QUE EXISTE (ítem 6f, 24/10/2026). Las 14 skills que se pisan llevan una línea «NO es para X (eso es la
 * skill Y)» con las palabras de Fak. La prueba de verdad la hace el modelo (`_pruebaDisparoSkills.mjs`, gasta
 * API y pide el OK de Fak); esta es una APROXIMACIÓN declarada que se puede correr siempre: dice qué skill
 * elegiría un buscador de palabras clave que lee solo los nombres y las descriptions.
 *
 * CÓMO ELIGE (una sola regla para todas las skills):
 *  - Suman para cada skill: su nombre (se ve en la lista), cada frase entre «» o "" de su description y los
 *    nombres de máquina o programa (letras y números juntos, como A2L, HTV2A o 3D; o mayúscula en el medio,
 *    como AutoCAD).
 *  - Cada tramo de «NO es para … (eso es la skill Y)» suma para Y y le resta a la skill que lo dice: sus frases
 *    entre comillas y cada pedazo de texto entre comas, «ni» u «o». Solo pasan las palabras que la skill que lo
 *    dice no tiene entre las suyas (las compartidas, como «impresora» en imprimir, no distinguen nada).
 *  - Una frase cuenta si calzan todas sus palabras (hasta 2) o la mitad (3 o más): «el consumo está mal» no se
 *    dispara con un «mal» suelto. Cada palabra del mensaje cuenta una vez por skill.
 *  - Las palabras se comparan sin acentos, por raíz (una empieza con la otra, 5 letras o más) o con 1 error de
 *    tipeo (2 si tienen 8 letras o más). Pesan menos si están en muchas skills (log(1 + skills / skills que la
 *    tienen)). No cuentan artículos, preposiciones, verbos de todos los días ni muletillas.
 *  - Gana la de más puntos; empate arriba = ambiguo; sin puntos = ninguna.
 *  Fak escribe con errores de tipeo («imrpesora», «ploter») que el modelo entiende y un buscador no: por eso
 *  cada caso del fixture trae también las palabras que el analista marcó como las que deciden (cuadro B del
 *  informe 21) y se puntúa el mensaje junto con ellas; la columna «solo el mensaje» muestra qué daría sin ellas.
 *  Es una aproximación: el disparo real lo hace el modelo, y en una sesión real hay un tope de caracteres que
 *  deja algunas skills sin description (esta prueba las lee todas).
 *
 * Uso: node scripts/_disparoSkillsSeco.mjs [--casos <fixture.json>] [--json]
 *   sin --casos usa __tests__/scripts/fixtures/disparoSkills_6f.json. Sale 1 si un caso «resuelto» da mal
 *   (salvo los que el fixture declara en `limites`, con el motivo).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerSkills, normal } from './_lib/propuestasSkills.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..');
export const FIXTURE = path.join(RAIZ, '__tests__', 'scripts', 'fixtures', 'disparoSkills_6f.json');

// Palabras que no dicen de qué se habla: artículos, preposiciones, verbos de todos los días (podés, hay),
// cuantificadores (todo, otro) y muletillas (dale, listo, bueno, osea).
const VACIAS = new Set(('a al con de del el en es esa ese eso esta este la las le lo los me mi no o para por que se si sin su te tu un una uno y ya ni mas muy'
  + ' podes puedes podemos puede hay ser estar tiene tienen tengo hacer hace hacemos va vas voy'
  + ' todo toda todos todas otro otra otros otras'
  + ' dale favor listo bueno osea digamos').split(' '));

/** Palabras sin acentos, en minúscula, sin signos y sin las vacías. */
export function palabras(texto) {
  return normal(texto).replace(/[^a-z0-9ñ]+/g, ' ').split(' ').filter((p) => p && !VACIAS.has(p));
}

/** Distancia de edición con trasposición (Damerau restringida). */
function distancia(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** ¿Es la misma palabra? Igual, misma raíz (una empieza con la otra, 5 letras o más) o un error de tipeo. */
export function mismaPalabra(a, b) {
  if (a === b) return true;
  const corta = Math.min(a.length, b.length);
  if (corta >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (corta <= 3) return false;
  const tope = corta >= 8 ? 2 : 1;
  return Math.abs(a.length - b.length) <= tope && distancia(a, b) <= tope;
}

/** Cuántas palabras de una frase tienen que calzar: todas hasta 2, la mitad desde 3. */
export const hacenFalta = (n) => (n <= 2 ? n : Math.ceil(n / 2));

const RE_COMILLAS = /«([^»]+)»|"([^"]+)"/g;
// nombres de máquina o de programa: letras y números juntos (A2L, HTV2A, C2004, 3D) o mayúscula en el medio
// (AutoCAD). Las siglas de documento o de formato (AMFE, DXF, PDF) no: están en muchas skills y no deciden.
const RE_NOMBRE = /\b(?:(?=[A-Za-z]*\d)(?=\d*[A-Za-z])[A-Za-z\d]{2,}|[A-Z][a-z]+[A-Z][A-Za-z]*)\b/g;

const sinAcentoGrave = (t) => String(t).replace(/`[^`]*`/g, ' ');

/** Frases de la parte propia: cada una entre comillas, y cada nombre de máquina como frase de una palabra. */
function frasesPropias(texto) {
  const out = [];
  for (const m of texto.matchAll(RE_COMILLAS)) { const p = palabras(m[1] ?? m[2]); if (p.length) out.push(p); }
  const resto = sinAcentoGrave(texto.replace(RE_COMILLAS, ' '));
  for (const m of resto.matchAll(RE_NOMBRE)) { const p = palabras(m[0]); if (p.length) out.push(p); }
  return out;
}

/** Frases de un tramo de «NO es para …»: las de comillas y cada pedazo entre comas, «ni» u «o». */
function frasesDelNo(texto) {
  const t = sinAcentoGrave(String(texto).replace(/^\s*no es para\b/i, ' '));
  const out = [];
  for (const m of t.matchAll(RE_COMILLAS)) { const p = palabras(m[1] ?? m[2]); if (p.length) out.push(p); }
  for (const pedazo of t.replace(RE_COMILLAS, ',').split(/[,;]|\bni\b|\bo\b/i)) { const p = palabras(pedazo); if (p.length) out.push(p); }
  return out;
}

/**
 * Parte una description en lo que vota por ella y lo que vota por otra.
 * Devuelve [{ frases, para: [skills], resta }]; resta = false es la parte propia.
 */
export function partesDe(description) {
  const partes = [];
  const oraciones = String(description ?? '').split(/(?<=\.)\s+/);
  let propio = '';
  for (const o of oraciones) {
    if (!/^no es para\b/i.test(o)) { propio += ' ' + o; continue; }
    // dentro de un NO: cada tramo hasta «(eso es la skill Y…)» vota por Y y le resta a la propia
    const re = /\(eso es la skill ([^)]*)\)/g;
    let m, desde = 0, hubo = false;
    while ((m = re.exec(o))) {
      const para = [...m[1].matchAll(/(?:^|la skill )([a-z0-9-]+)/g)].map((x) => x[1]);
      partes.push({ frases: frasesDelNo(o.slice(desde, m.index)), para, resta: true });
      desde = m.index + m[0].length;
      hubo = true;
    }
    const resto = o.slice(desde);
    // lo que sigue al último «(eso es la skill Y)»: tras «;» es otra frase («para cortar un DXF nuevo van las
    // dos») y es de la propia; si no («, ni para el HTV2A…»), sigue siendo un NO sin skill nombrada: solo resta
    if (hubo && /^\s*;/.test(resto)) propio += ' ' + resto;
    else partes.push({ frases: frasesDelNo(resto), para: [], resta: true });
  }
  partes.unshift({ frases: frasesPropias(propio), para: [], resta: false });
  return partes;
}

/** El índice: por skill, las frases que suman (pos) y las que restan (neg), y el peso de cada palabra. */
export function armarIndice(skills) {
  const de = new Map(); // skill -> { pos: [frase], neg: [frase] }
  const bolsa = (n) => { if (!de.has(n)) de.set(n, { pos: [], neg: [] }); return de.get(n); };
  const nos = [];
  for (const s of skills) {
    const b = bolsa(s.nombre);
    const nombre = palabras(s.nombre.replace(/-/g, ' '));
    if (nombre.length) b.pos.push(nombre);
    for (const p of partesDe(s.description)) {
      if (!p.resta) b.pos.push(...p.frases);
      else nos.push({ host: s.nombre, ...p });
    }
  }
  const propias = new Map([...de].map(([n, b]) => [n, b.pos.flat()]));
  for (const p of nos) {
    const tiene = propias.get(p.host) ?? [];
    for (const f of p.frases) {
      const distintas = f.filter((w) => !tiene.some((w2) => mismaPalabra(w, w2)));
      if (!distintas.length) continue;
      for (const y of p.para) bolsa(y).pos.push(distintas);
      bolsa(p.host).neg.push(distintas);
    }
  }
  const tiene = [...de.values()].map((b) => b.pos.flat());
  const peso = new Map();
  for (const w of new Set(tiene.flat())) {
    const con = tiene.filter((ws) => ws.some((w2) => mismaPalabra(w, w2))).length;
    peso.set(w, Math.log(1 + de.size / Math.max(1, con)));
  }
  return { de, peso };
}

/** Puntos de un juego de frases contra las palabras del mensaje: cada palabra del mensaje cuenta una vez. */
function puntosDe(frases, ws, pesa) {
  const usada = new Map(); // palabra del mensaje -> peso
  for (const f of frases) {
    const calzan = [];
    for (const w of f) { const x = ws.find((y) => mismaPalabra(y, w)); if (x) calzan.push([x, w]); }
    if (calzan.length < hacenFalta(f.length)) continue;
    for (const [x, w] of calzan) usada.set(x, Math.max(usada.get(x) ?? 0, pesa(w)));
  }
  let p = 0;
  for (const v of usada.values()) p += v;
  return p;
}

/** Qué skill elegiría para un texto: { elegida, puntos: [{ skill, puntos }], ambiguo }. */
export function elegir(texto, indice) {
  const ws = [...new Set(palabras(texto))];
  const pesa = (w) => indice.peso.get(w) ?? Math.log(2);
  const orden = [];
  for (const [skill, b] of indice.de) {
    const p = Math.round((puntosDe(b.pos, ws, pesa) - puntosDe(b.neg, ws, pesa)) * 100) / 100;
    if (p > 0) orden.push({ skill, puntos: p });
  }
  orden.sort((a, b) => b.puntos - a.puntos || a.skill.localeCompare(b.skill));
  if (!orden.length) return { elegida: null, puntos: [], ambiguo: false };
  const ambiguo = orden.length > 1 && orden[0].puntos === orden[1].puntos;
  return { elegida: ambiguo ? null : orden[0].skill, puntos: orden.slice(0, 4), ambiguo };
}

/** Corre los casos del fixture. Devuelve las filas y la cuenta. */
export function correrCasos({ raiz = RAIZ, casos, limites = [] } = {}) {
  const skills = leerSkills({ raiz }).filter((s) => s.description);
  const indice = armarIndice(skills);
  const enLimite = new Set(limites.map((l) => l.id));
  const filas = casos.map((c) => {
    const r = elegir(`${c.mensaje} ${(c.decide ?? []).join(' ')}`, indice);
    const soloMensaje = elegir(c.mensaje, indice);
    const bien = r.elegida != null && (c.aceptadas ?? [c.esperada]).includes(r.elegida);
    return { ...c, elegida: r.elegida, ambiguo: r.ambiguo, puntos: r.puntos, bien, soloMensaje: soloMensaje.elegida, limite: enLimite.has(c.id) };
  });
  const resueltos = filas.filter((f) => f.estado === 'resuelto');
  const malSinMotivo = resueltos.filter((f) => !f.bien && !f.limite);
  return { filas, resueltos: resueltos.length, resueltosBien: resueltos.filter((f) => f.bien).length, malSinMotivo };
}

function main() {
  const args = process.argv.slice(2);
  const iCasos = args.indexOf('--casos');
  const ruta = iCasos >= 0 ? args[iCasos + 1] : FIXTURE;
  const { casos, limites = [] } = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const r = correrCasos({ casos, limites });
  if (args.includes('--json')) { console.log(JSON.stringify(r, null, 2)); }
  else {
    for (const f of r.filas) {
      const marca = f.estado === 'resuelto' ? (f.bien ? 'BIEN' : (f.limite ? 'LIM ' : 'MAL ')) : (f.bien ? 'bien' : 'lista');
      console.log(`${marca} #${String(f.id).padStart(2)} [${f.estado}] espera ${f.esperada ?? '(no se sabe)'} · elige ${f.elegida ?? (f.ambiguo ? 'EMPATE' : 'ninguna')}`
        + ` · solo el mensaje: ${f.soloMensaje ?? 'ninguna'} · ${f.puntos.map((p) => `${p.skill} ${p.puntos}`).join(', ')}`);
    }
    for (const l of limites) console.log(`Límite declarado #${l.id}: ${l.motivo}`);
    console.log(`Resueltos según el analista: ${r.resueltosBien} de ${r.resueltos} bien. Los demás se listan, no cuentan.`);
    console.log('Aproximación en seco (palabras clave de las descriptions): el disparo real lo hace el modelo.');
  }
  process.exit(r.malSinMotivo.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

/**
 * propuestasSkills.mjs — lo puro de scripts/_propuestasSkills.mjs: leer los skills del repo, chequearlos
 * SIN modelo, armar el dossier de cada uno, pedirle propuestas de mejora a un revisor (Sonnet), filtrar lo
 * que vuelve con reglas duras de codigo, pasarlo por un refutador (Opus) y escribir el resultado para la
 * sesion de la manana.
 *
 * POR QUE EXISTE (08/10/2026). Los skills son "el sistema de roles" del asistente (cargan solo al usarse) y
 * se desactualizan en silencio: una ruta que se movio, una leccion de Fak que nadie paso al skill, una
 * description que ya no calza con lo que Fak pide. Mirarlos a mano a todos cuesta una tarde; una pasada
 * semanal de la API de la noche cuesta unos $2 (`.sgc-cache/investigacion-2026-10-08/R3_api_anthropic_noche_de_claude.md`,
 * propuesta D). Es el mismo patron que la pre-auditoria de AMFE (preauditoriaAmfe.mjs): un modelo SENALA con
 * citas textuales, el codigo descarta lo que no se sostiene y otro modelo trata de refutar lo que queda.
 *
 * LO QUE ESTO NUNCA HACE (decisiones del proyecto, al pie de la letra):
 *   - NUNCA edita un skill. Las propuestas son para la sesion de la manana, que las verifica contra la
 *     fuente y aplica las que valen (regla `mejora-implementada.md`). El unico escritor de este archivo
 *     (`escribirEnBase`) rechaza cualquier ruta fuera de la carpeta de propuestas, y por detras pasa por la
 *     puerta de escritura de la noche (`escrituraSegura.mjs`): este archivo no usa `fs` para escribir.
 *   - NUNCA inventa datos: un numero o un codigo en una propuesta que no esta en el dossier la tira el
 *     codigo (`core-prohibiciones.md` §1).
 *   - Un hallazgo sin cita textual no es hallazgo (las dos citas se buscan en el texto que de verdad se
 *     mando al modelo, no en el SKILL.md entero).
 *
 * Todo lo de este archivo es puro salvo la lectura de skills / reglas / lecciones y `escribirEnBase`. Se
 * prueba en __tests__/scripts/propuestasSkills.test.mjs.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarNoEsDeFak, quitarAvisos, empiezaConAlguno } from './transcriptsFak.mjs';
import { escribirSeguro as escribirEnLaNoche } from './escrituraSegura.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..');

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** Lo unico que el revisor puede proponer. */
export const TIPOS = Object.freeze([
  'contradiccion_interna',
  'leccion_no_reflejada',
  'instruccion_obsoleta',
  'demasiado_larga',
  'description_no_dispara',
  'ruta_muerta',
]);

export const TIPO_LEGIBLE = Object.freeze({
  contradiccion_interna: 'el skill se contradice solo',
  leccion_no_reflejada: 'una leccion o correccion de Fak que el skill no recoge',
  instruccion_obsoleta: 'una instruccion que ya no se hace asi',
  demasiado_larga: 'el skill es demasiado largo',
  description_no_dispara: 'la description no calza con lo que Fak pide',
  ruta_muerta: 'nombra una ruta que no existe',
});

export const TOPE_PROPUESTAS = 4;
export const TOPE_TOKENS_DOSSIER = 12000;
export const CARACTERES_POR_TOKEN = 3.5;
export const UMBRAL_DESCRIPTION = 400;
/** Desde cuantos tokens el SKILL.md se considera "largo" (pesa en cada carga: hojas-de-proceso pesa ~16 K). */
export const UMBRAL_TOKENS_LARGO = 7000;
export const ORDEN_CONFIANZA = Object.freeze({ alta: 0, media: 1, baja: 2 });

/** Tokens aproximados de un texto en castellano (3,5 caracteres por token). Solo para estimar. */
export const tokensAprox = (texto) => Math.ceil(String(texto ?? '').length / CARACTERES_POR_TOKEN);

/** SHA-1 de un texto (hex). Es el hash con que se detecta que el SKILL.md cambio mientras se revisaba. */
export const hashTexto = (texto) => crypto.createHash('sha1').update(String(texto ?? ''), 'utf8').digest('hex');

/** Minusculas, sin tildes, comillas y guiones tipograficos igualados, espacios colapsados. */
export const normal = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[“”«»„]/g, '"').replace(/[‘’‚]/g, "'").replace(/[‐-―]/g, '-')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const corta = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter y lectura de skills
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El frontmatter YAML de un SKILL.md, sin dependencias: `clave: valor`, valores entre comillas, bloques
 * plegados (`>`) y literales (`|`) y continuaciones indentadas (cad-design, docs-empresa y leer-planos usan
 * `description: >` en varias lineas; una lectura linea por linea devolveria ">"). Un valor anidado
 * (`metadata:` con hijos) queda como texto crudo de sus lineas.
 */
export function parsearFrontmatter(texto) {
  const t = String(texto ?? '').replace(/^﻿/, '');
  const m = t.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { campos: {}, cuerpo: t, tieneFrontmatter: false };
  const lineas = m[1].split(/\r?\n/);
  const campos = {};
  for (let i = 0; i < lineas.length; i++) {
    const km = lineas[i].match(/^([A-Za-z0-9_][A-Za-z0-9_-]*):[ \t]*(.*)$/);
    if (!km) continue;
    const clave = km[1];
    const resto = km[2].trim();
    const cont = [];
    while (i + 1 < lineas.length && (/^[ \t]/.test(lineas[i + 1]) || lineas[i + 1].trim() === '')) {
      i++;
      cont.push(lineas[i]);
    }
    while (cont.length && cont[cont.length - 1].trim() === '') cont.pop();
    const hijos = cont.map((l) => l.trim());
    let valor;
    if (/^[>|][+-]?\d*$/.test(resto)) {
      if (resto.startsWith('>')) {
        const partes = [];
        let parrafo = [];
        for (const l of hijos) {
          if (l === '') { if (parrafo.length) partes.push(parrafo.join(' ')); parrafo = []; } else parrafo.push(l);
        }
        if (parrafo.length) partes.push(parrafo.join(' '));
        valor = partes.join('\n');
      } else {
        valor = hijos.join('\n');
      }
    } else if (resto === '') {
      valor = hijos.join('\n');
    } else {
      valor = [resto, ...hijos.filter(Boolean)].join(' ');
      if (/^".*"$/.test(valor)) valor = valor.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      else if (/^'.*'$/.test(valor)) valor = valor.slice(1, -1).replace(/''/g, "'");
    }
    campos[clave] = valor.trim();
  }
  return { campos, cuerpo: t.slice(m[0].length), tieneFrontmatter: true };
}

/** Lee un SKILL.md (o un comando) y lo deja como objeto con tamano, tokens y hash. */
export function skillDeTexto({ texto, nombreCarpeta, ruta, dir, origen }) {
  const fm = parsearFrontmatter(texto);
  const bytes = Buffer.byteLength(texto, 'utf8');
  return {
    nombre: String(fm.campos.name || nombreCarpeta).trim(),
    carpeta: nombreCarpeta,
    origen,
    dir,
    ruta,
    texto,
    hash: hashTexto(texto),
    bytes,
    kb: Math.round((bytes / 1024) * 10) / 10,
    tokens: tokensAprox(texto),
    description: String(fm.campos.description ?? '').trim(),
    frontmatter: fm.campos,
    tieneFrontmatter: fm.tieneFrontmatter,
  };
}

/**
 * Los skills: los del repo (`.claude/skills/<n>/SKILL.md`) y, con `conUsuario`, los de `~/.claude/skills`.
 * Una carpeta sin SKILL.md (la de `synced`) se saltea.
 */
export function leerSkills({ raiz = RAIZ, conUsuario = false, dirUsuario = path.join(os.homedir(), '.claude', 'skills') } = {}) {
  const fuentes = [{ dir: path.join(raiz, '.claude', 'skills'), origen: 'repo' }];
  if (conUsuario) fuentes.push({ dir: dirUsuario, origen: 'usuario' });
  const out = [];
  for (const { dir, origen } of fuentes) {
    let entradas = [];
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entradas) {
      const ruta = path.join(dir, e.name, 'SKILL.md');
      let texto;
      try { texto = fs.readFileSync(ruta, 'utf8'); } catch { continue; }
      out.push(skillDeTexto({ texto, nombreCarpeta: e.name, ruta, dir: path.join(dir, e.name), origen }));
    }
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Los comandos del repo (`.claude/commands/*.md`) que tienen description: tambien aparecen en la lista de skills. */
export function leerComandos({ raiz = RAIZ } = {}) {
  const dir = path.join(raiz, '.claude', 'commands');
  let entradas = [];
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entradas) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const ruta = path.join(dir, e.name);
    let texto;
    try { texto = fs.readFileSync(ruta, 'utf8'); } catch { continue; }
    const s = skillDeTexto({ texto, nombreCarpeta: e.name.replace(/\.md$/, ''), ruta, dir, origen: 'comando' });
    if (s.description) out.push(s);
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ─────────────────────────────────────────────────────────────────────────────
// Chequeos sin modelo
// ─────────────────────────────────────────────────────────────────────────────

const EXTENSIONES = 'mjs|cjs|js|ts|tsx|jsx|py|json|md|ps1|sh|cmd|bat|xlsx|xls|csv|txt|html|css|yml|yaml|dxf|plt|pdf|pptx|docx';
const RE_RUTA = new RegExp(String.raw`(?<![\w./\\~-])((?:[A-Za-z]:[\\/])?(?:[\w.~-]+[\\/])*[\w.-]+\.(?:${EXTENSIONES}))(?![\w-])`, 'g');
/** Lo que la ruta trae de comodin o de plantilla: no es una ruta que tenga que existir tal cual. */
const RE_PLANTILLA = /[*<>{}$%|]|\.\.\.|AAAA|MMDD|NNN|XXX|\bNN\b|<|\[/;
/** Carpetas que se generan al trabajar (o estan fuera de git): que falten no es una ruta muerta. */
const RE_EFIMERA = /^(?:\.sgc-cache|\.mail-cache|\.audit-cliente|\.venv[\w-]*|node_modules|exports|tmp|reports|backups|dist|docs-local|\.claude\/state|\.claude\/worktrees|\.worktreeinclude)(?:[\\/]|$)/i;
const CARPETAS_INDICE = ['scripts', 'tools', 'docs', 'core', 'modules', 'utils', '__tests__', '.claude', 'components', 'services', 'hooks'];
const SALTAR_EN_INDICE = new Set(['node_modules', '.git', 'exports', 'dist', 'tmp', '.sgc-cache', '.venv', '.venv-cad', '.venv-audio', '__pycache__', '.build', 'archive']);

/** Carpetas de primer nivel del repo donde vive el codigo y la documentacion. */
const RAICES_REPO = new Set(['scripts', 'tools', 'docs', 'core', 'modules', 'utils', '__tests__', '.claude', 'components', 'services', 'hooks', 'public', 'src']);
/** Extensiones de datos: nombradas sin carpeta, son un ejemplo ("tabla.csv", "Rev6.pdf"), no un archivo del repo. */
const EXT_DATOS = new Set(['dxf', 'plt', 'csv', 'xlsx', 'xls', 'pdf', 'pptx', 'docx', 'txt', 'json', 'html', 'css', 'yml', 'yaml']);
/** Palabras que en el nombre de un archivo lo marcan como ejemplo inventado para explicar ("foo.md", "miFix.mjs"). */
const PALABRAS_DE_EJEMPLO = new Set(['foo', 'bar', 'baz', 'ejemplo', 'example', 'archivo', 'entrada', 'salida', 'absoluta', 'nombre', 'x', 'y', 'in', 'out', 'tabla', 'deck', 'spec', 'generador', 'manifest', 'pliego', 'fotos', 'cand', 'armado', 'file', 'test', 'prueba', 'mi', 'algo', 'documento', 'tmp']);

const extensionDe = (ruta) => (String(ruta).match(/\.([A-Za-z0-9]+)$/)?.[1] ?? '').toLowerCase();

/** ¿El nombre del archivo parece un ejemplo inventado para explicar? (foo.md, _auditFoo.mjs, miFix.mjs, archivo.dxf) */
export function esEjemploGenerico(ruta) {
  const base = String(ruta).split('/').pop().replace(/\.[A-Za-z0-9]+$/, '');
  // un archivo de la memoria del asistente (feedback_x.md, reference_x.md) vive fuera del repo
  if (/^(?:feedback|reference|project|user)_/i.test(base)) return true;
  // "contenido_diaN.py": la N mayuscula pegada a una palabra es un comodin
  if (/[a-z]N(?=[._-]|$)/.test(base)) return true;
  const palabras = base.split(/[_\-.]|(?<=[a-z0-9])(?=[A-Z])/).map((p) => p.toLowerCase().replace(/\d+$/, '')).filter(Boolean);
  return palabras.some((p) => PALABRAS_DE_EJEMPLO.has(p));
}

/** Las rutas con extension que un texto nombra: [{ ruta, linea }] sin repetidas. */
export function rutasCitadas(texto) {
  const lineas = String(texto ?? '').split(/\r?\n/);
  const vistas = new Map();
  lineas.forEach((l, i) => {
    for (const m of l.matchAll(RE_RUTA)) {
      let r = m[1].replace(/[.,;:)]+$/, '');
      if (!/\.[A-Za-z0-9]+$/.test(r)) continue;
      r = r.replace(/\\/g, '/');
      if (!vistas.has(r)) vistas.set(r, i + 1);
    }
  });
  return [...vistas.entries()].map(([ruta, linea]) => ({ ruta, linea }));
}

/** Los nombres de archivo (minusculas) de las carpetas de codigo del repo, para ubicar rutas "peladas". */
export function indiceDeNombres(raiz = RAIZ, { profundidad = 5 } = {}) {
  const idx = new Set();
  const recorrer = (dir, nivel) => {
    if (nivel > profundidad) return;
    let entradas = [];
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (e.isDirectory()) {
        if (SALTAR_EN_INDICE.has(e.name)) continue;
        recorrer(path.join(dir, e.name), nivel + 1);
      } else {
        idx.add(e.name.toLowerCase());
      }
    }
  };
  for (const c of CARPETAS_INDICE) recorrer(path.join(raiz, c), 1);
  for (const e of safeLs(raiz)) if (e.isFile()) idx.add(e.name.toLowerCase());
  return idx;
}

function safeLs(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

/**
 * Las rutas que el SKILL.md nombra y NO existen. Una ruta con comodines o plantilla, absoluta de otro
 * disco, de la nube o de una carpeta que se genera (exports, tmp, .sgc-cache...) no cuenta. Una ruta con
 * barra se busca desde la raiz del repo, desde la carpeta del skill y bajo `scripts/`; una pelada
 * (`hojalib.py`) se busca por nombre en las carpetas de codigo.
 */
export function rutasMuertas(skill, { raiz = RAIZ, existe = fs.existsSync, indice = null } = {}) {
  let idx = indice;
  const muertas = [];
  let revisadas = 0;
  for (const { ruta, linea } of rutasCitadas(skill.texto)) {
    if (RE_PLANTILLA.test(ruta)) continue;
    if (/^[A-Za-z]:\//.test(ruta) || ruta.startsWith('~') || ruta.startsWith('/') || ruta.startsWith('//')) continue;
    if (RE_EFIMERA.test(ruta) || esEjemploGenerico(ruta)) continue;
    const primero = ruta.split('/')[0];
    if (ruta.includes('/')) {
      // una ruta con barra solo se chequea si arranca en una carpeta del repo o del propio skill; lo demas
      // (carpetas del servidor, de un proyecto, de la memoria) no se puede juzgar desde aca.
      const esDelRepo = RAICES_REPO.has(primero) || existe(path.join(raiz, primero)) || existe(path.join(skill.dir, primero));
      if (!esDelRepo) continue;
    } else if (EXT_DATOS.has(extensionDe(ruta))) {
      continue; // un nombre pelado de dato (tabla.csv, Rev6.pdf) es un ejemplo, no un archivo del repo
    }
    revisadas++;
    const candidatas = [
      path.join(raiz, ruta), path.join(skill.dir, ruta), path.join(raiz, 'scripts', ruta),
      path.join(skill.dir, 'scripts', ruta), path.join(raiz, '.claude', ruta),
    ];
    if (candidatas.some((c) => existe(c))) continue;
    if (!ruta.includes('/')) {
      if (!idx) idx = indiceDeNombres(raiz);
      if (idx.has(ruta.toLowerCase())) continue;
    }
    muertas.push({ ruta, linea });
  }
  return { muertas, revisadas };
}

/** Las palabras que le dicen al asistente CUANDO cargar el skill. Una description sin ninguna no dispara. */
export const RE_DISPARO = /\b(usar|us[aá]|usarlo|cuando|cargar|cargarlo|cargalo|activar|antes de|siempre|al (?:armar|hacer|crear|tocar|editar|generar|recibir|exportar|cargar)|use (?:this|when)|when|trigger|tambien)\b/i;

/** ¿La description tiene algun gatillo ("Usar cuando...", "Cargarlo antes de...")? */
export const descriptionDispara = (description) => RE_DISPARO.test(String(description ?? ''));

/** Cargas de un skill en los ultimos `dias` dias (por nombre del skill; tambien acepta `plugin:skill`). */
export function cargasDe(cargas, nombre, { ahora = new Date(), dias = null } = {}) {
  const corte = dias == null ? null : new Date(ahora).getTime() - dias * 86400e3;
  const n = String(nombre).toLowerCase();
  return (Array.isArray(cargas) ? cargas : [])
    .filter((c) => c && (String(c.skill ?? '').toLowerCase() === n || String(c.nombre ?? '').toLowerCase() === n))
    .filter((c) => corte == null || !c.fecha || Date.parse(c.fecha) >= corte);
}

/** Todos los chequeos sin modelo de un skill. */
export function chequearSkill(skill, { raiz = RAIZ, existe = fs.existsSync, indice = null, cargas = [], ahora = new Date(), lecciones = [] } = {}) {
  const { muertas, revisadas } = rutasMuertas(skill, { raiz, existe, indice });
  const c30 = cargasDe(cargas, skill.nombre, { ahora, dias: 30 });
  const cTodas = cargasDe(cargas, skill.nombre, { ahora });
  const descLarga = skill.description.length > UMBRAL_DESCRIPTION;
  const sinGatillo = !descriptionDispara(skill.description);
  const avisos = [];
  if (!skill.tieneFrontmatter) avisos.push('no tiene frontmatter (sin description no se carga solo)');
  if (!skill.description) avisos.push('sin description');
  if (descLarga) avisos.push(`description de ${skill.description.length} caracteres (mas de ${UMBRAL_DESCRIPTION}: se corta en la lista)`);
  if (sinGatillo && skill.description) avisos.push('la description no tiene palabras de disparo ("Usar cuando...", "Cargarlo antes de...")');
  if (muertas.length) avisos.push(`${muertas.length} ruta${muertas.length === 1 ? '' : 's'} que no existe${muertas.length === 1 ? '' : 'n'}`);
  if (skill.tokens > UMBRAL_TOKENS_LARGO) avisos.push(`pesa ${skill.kb} KB (~${skill.tokens} tokens por carga)`);
  if (!cTodas.length) avisos.push('sin cargas en los transcripts leidos');
  return {
    kb: skill.kb, tokens: skill.tokens,
    cargas30: c30.length, cargasTotal: cTodas.length,
    rutasMuertas: muertas, rutasRevisadas: revisadas,
    descriptionLargo: skill.description.length, descriptionLarga: descLarga, sinGatillo,
    lecciones: lecciones.length, avisos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecciones que nombran un skill
// ─────────────────────────────────────────────────────────────────────────────

const escapar = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿Esta linea nombra al skill como skill? ("el skill `x`", "`x`", "skills/x"): una palabra suelta no cuenta. */
export function lineaNombraSkill(linea, nombre) {
  const n = escapar(nombre);
  const re = new RegExp(`(?:\`${n}\`|skills?[ /]+\`?${n}\`?(?![\\w-])|skills/${n}(?![\\w-]))`, 'i');
  return re.test(linea);
}

/**
 * Las lineas de las lecciones que nombran al skill: [{ fuente, linea }]. `fuentes` es una lista de
 * { nombre, texto }; la primera tiene prioridad (LECCIONES vivas antes que los snapshots, que repiten
 * las mismas con mas detalle). Sin repetidas (por el comienzo de la linea), `tope` lineas de `largo` caracteres.
 */
export function leccionesQueNombran(nombre, fuentes, { tope = 10, largo = 900 } = {}) {
  const out = [];
  const vistas = new Set();
  for (const f of fuentes) {
    for (const crudo of String(f.texto ?? '').split(/\r?\n/)) {
      const l = crudo.trim();
      if (!l || !lineaNombraSkill(l, nombre)) continue;
      const clave = normal(l).slice(0, 100);
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      out.push({ fuente: f.nombre, linea: corta(l, largo) });
      if (out.length >= tope) return out;
    }
  }
  return out;
}

/** LECCIONES_APRENDIDAS.md y los snapshots de octubre: [{ nombre, texto }]. Lo que no existe se saltea. */
export function leerFuentesLecciones({ raiz = RAIZ } = {}) {
  const fuentes = [];
  const leer = (ruta) => { try { return fs.readFileSync(ruta, 'utf8'); } catch { return null; } };
  const viva = leer(path.join(raiz, 'docs', 'LECCIONES_APRENDIDAS.md'));
  if (viva) fuentes.push({ nombre: 'LECCIONES_APRENDIDAS.md', texto: viva });
  const dirSnap = path.join(raiz, 'docs', '_archive');
  let nombres = [];
  try { nombres = fs.readdirSync(dirSnap); } catch { /* sin archivo */ }
  for (const n of nombres.filter((x) => /^LECCIONES_snapshot_2026-10-0.*\.md$/.test(x)).sort().reverse()) {
    const t = leer(path.join(dirSnap, n));
    if (t) fuentes.push({ nombre: n, texto: t });
  }
  return fuentes;
}

// ─────────────────────────────────────────────────────────────────────────────
// El dossier
// ─────────────────────────────────────────────────────────────────────────────

/** Parte el SKILL.md en trozos por encabezado (# a ###). El primero incluye el frontmatter. */
export function trozosPorEncabezado(texto) {
  const trozos = [];
  let actual = { titulo: '(comienzo)', lineas: [] };
  let enCodigo = false;
  for (const l of String(texto ?? '').split('\n')) {
    if (/^\s*```/.test(l)) enCodigo = !enCodigo;
    if (!enCodigo && /^#{1,3} /.test(l) && actual.lineas.some((x) => x.trim())) {
      trozos.push(actual);
      actual = { titulo: l.trim(), lineas: [] };
    }
    actual.lineas.push(l);
  }
  trozos.push(actual);
  return trozos.map((t) => ({ titulo: t.titulo, texto: t.lineas.join('\n') }));
}

/**
 * El SKILL.md recortado a `maxChars`: se queda con los trozos (por encabezado) que entran, en orden, y
 * deja un marcador con el titulo de cada trozo que saco. Si el primero solo ya no entra, lo corta por caracteres.
 */
export function recortarSkill(texto, maxChars) {
  if (texto.length <= maxChars) return { texto, omitidas: [], recortado: false };
  const trozos = trozosPorEncabezado(texto);
  const partes = [];
  const omitidas = [];
  let usado = 0;
  trozos.forEach((t, i) => {
    const largo = t.texto.length + 1;
    if (usado + largo <= maxChars) { partes.push(t.texto); usado += largo; return; }
    if (i === 0) {
      const dato = t.texto.slice(0, Math.max(0, maxChars - 200));
      partes.push(`${dato}\n[... el comienzo del SKILL.md se corta por tamaño ...]`);
      usado += dato.length + 60;
      return;
    }
    omitidas.push({ titulo: t.titulo, caracteres: t.texto.length });
    partes.push(`[... seccion omitida por tamaño: "${corta(t.titulo, 80)}" (${t.texto.length} caracteres) ...]`);
  });
  return { texto: partes.join('\n'), omitidas, recortado: true };
}

/**
 * Arma el dossier de un skill (hasta `topeTokens`, 12 K por defecto): el SKILL.md, los chequeos de codigo,
 * las ultimas `maxCasos` cargas con el mensaje de Fak que estaba abierto y los 3 que siguieron, y las
 * lineas de las lecciones que lo nombran. Nunca salidas de herramientas. Sin cargas, no hay seccion de casos.
 * Devuelve { texto, partes, hash, tokens, recortado, omitidas, nCasos, nLecciones, tieneCasos, tieneLecciones }.
 */
export function armarDossier({
  skill, chequeo, cargas = [], lecciones = [], topeTokens = TOPE_TOKENS_DOSSIER, noEsDeFak = null,
  maxCasos = 5, siguientesPorCaso = 3, largoMensaje = 400,
} = {}) {
  const prefijos = noEsDeFak ?? cargarNoEsDeFak();
  const limpio = (t) => {
    const x = quitarAvisos(t);
    return x && !empiezaConAlguno(x, prefijos) ? corta(x, largoMensaje) : '';
  };

  // chequeos
  const ch = chequeo;
  const lc = [`## CHEQUEOS HECHOS POR CODIGO (no los hizo un modelo)`];
  lc.push(`- tamaño del SKILL.md: ${ch.kb} KB, unos ${ch.tokens} tokens por carga`);
  lc.push(`- cargas en los transcripts: ${ch.cargas30} en los ultimos 30 dias, ${ch.cargasTotal} en total`);
  lc.push(`- description: ${ch.descriptionLargo} caracteres${ch.descriptionLarga ? ' (MAS de ' + UMBRAL_DESCRIPTION + ')' : ''}; palabras de disparo: ${ch.sinGatillo ? 'NO tiene' : 'si tiene'}`);
  if (ch.rutasMuertas.length) {
    lc.push(`- rutas que el SKILL.md nombra y NO existen en el repo (${ch.rutasMuertas.length} de ${ch.rutasRevisadas} revisadas):`);
    for (const r of ch.rutasMuertas.slice(0, 12)) lc.push(`  - ruta inexistente: ${r.ruta} (linea ${r.linea} del SKILL.md)`);
  } else {
    lc.push(`- rutas que el SKILL.md nombra: ${ch.rutasRevisadas} revisadas, todas existen`);
  }
  const parteChequeos = lc.join('\n');

  // casos
  const propias = cargasDe(cargas, skill.nombre).sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));
  const casos = [];
  for (const c of propias) {
    const previo = limpio(c.mensajeAnterior);
    const sigs = (Array.isArray(c.siguientes) ? c.siguientes : []).map(limpio).filter(Boolean).slice(0, siguientesPorCaso);
    if (!previo && !sigs.length) continue;
    casos.push({ fecha: String(c.fecha ?? '').slice(0, 10), sesion: String(c.sesion ?? '').slice(0, 8), previo, sigs, mismoTurno: !!c.mismoTurno });
    if (casos.length >= maxCasos) break;
  }
  let parteCasos = '';
  if (casos.length) {
    const lcs = [`## CASOS REALES: las ultimas ${casos.length} veces que se cargo este skill, con lo que Fak escribio`];
    casos.forEach((c, i) => {
      lcs.push(`CASO ${i + 1} (${c.fecha}, sesion ${c.sesion})`);
      if (c.previo) lcs.push(`  Mensaje de Fak anterior a la carga${c.mismoTurno ? '' : ' (no abrio el turno en que se cargo)'}: ${c.previo}`);
      c.sigs.forEach((s, k) => lcs.push(`  Mensaje de Fak siguiente ${k + 1}: ${s}`));
    });
    parteCasos = lcs.join('\n');
  }

  // lecciones
  let parteLecciones = '';
  if (lecciones.length) {
    parteLecciones = [`## LECCIONES QUE NOMBRAN ESTE SKILL (lineas de LECCIONES_APRENDIDAS y de sus snapshots)`,
      ...lecciones.map((l) => `- [${l.fuente}] ${l.linea}`)].join('\n');
  }

  // el SKILL.md recibe lo que sobra
  const cab = `# DOSSIER DEL SKILL "${skill.nombre}" (hash del SKILL.md: ${skill.hash.slice(0, 12)})`;
  const otras = [parteChequeos, parteCasos, parteLecciones].filter(Boolean);
  const maxChars = Math.floor(topeTokens * CARACTERES_POR_TOKEN);
  const usadoOtras = cab.length + otras.reduce((s, p) => s + p.length + 2, 0) + 120;
  let lugarSkill = Math.max(2000, maxChars - usadoOtras);
  let rec;
  let parteSkill;
  let texto;
  for (let vuelta = 0; vuelta < 12; vuelta++) {
    rec = recortarSkill(skill.texto, lugarSkill);
    parteSkill = `## SKILL.md COMPLETO${rec.recortado ? ' (RECORTADO por tamaño: lo omitido esta marcado entre corchetes)' : ''}\n${rec.texto}`;
    texto = [cab, parteSkill, ...otras].join('\n\n');
    // los marcadores de lo omitido suman caracteres: si se paso del tope, se le quita al SKILL.md lo que sobra
    const sobra = texto.length - maxChars;
    if (sobra <= 0 || lugarSkill <= 2000) break;
    lugarSkill = Math.max(2000, lugarSkill - Math.max(sobra + 40, 150 * (vuelta + 1)));
  }
  return {
    nombre: skill.nombre, hash: skill.hash, texto,
    partes: { skill: rec.texto, chequeos: parteChequeos, casos: parteCasos, lecciones: parteLecciones },
    tokens: tokensAprox(texto), tokensSkill: tokensAprox(rec.texto),
    recortado: rec.recortado, omitidas: rec.omitidas,
    nCasos: casos.length, nLecciones: lecciones.length,
    tieneCasos: casos.length > 0, tieneLecciones: lecciones.length > 0,
    rutasMuertas: ch.rutasMuertas.map((r) => r.ruta),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El revisor (Sonnet) y el refutador (Opus)
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_REVISOR = `Sos revisor de skills de Claude Code en Barack Mercosul, una autopartista argentina (tapizado, espumado, corte, costura, inyeccion). Un skill es un archivo SKILL.md con instrucciones que el asistente carga solo cuando el tema calza, y trabaja con Fak, de Ingenieria. Te paso UN skill con sus casos reales y tu trabajo es proponer, como mucho ${TOPE_PROPUESTAS} cambios a su texto que un revisor defenderia. No editas nada: dejas propuestas para una sesion que las verifica a mano antes de tocar el skill.

QUÉ PODÉS PROPONER (lista cerrada, campo "tipo"):
1. contradiccion_interna: dos pasajes del mismo SKILL.md que se contradicen. cita_skill = uno, cita_caso = el otro.
2. leccion_no_reflejada: una leccion o una correccion de Fak del dossier, del dominio de este skill, que el SKILL.md no recoge o contradice. cita_caso = la linea de la leccion o el mensaje de Fak, textual.
3. instruccion_obsoleta: una instruccion del skill que los casos o las lecciones muestran que ya no se hace asi. cita_caso = la evidencia.
4. demasiado_larga: solo si los chequeos dicen que pesa mucho. El cambio dice que seccion sacar o mover a un archivo aparte, sin perder la regla.
5. description_no_dispara: la description no nombra algo por lo que Fak pide este skill en los casos. cita_skill = la description actual, textual; cita_caso = el mensaje de Fak.
6. ruta_muerta: una ruta que el skill nombra y los chequeos de codigo dicen que no existe. cita_skill = la linea del skill con la ruta; cita_caso = la linea del chequeo.

REGLAS DURAS (si dudás, NO lo proponés):
- Cada propuesta lleva DOS citas TEXTUALES copiadas tal cual del dossier, de 12 caracteres o mas, sin traducir ni resumir. cita_skill sale del SKILL.md. cita_caso sale de cualquier parte del dossier (mensaje de Fak, leccion, chequeo, otro pasaje del skill). Sin las dos citas exactas la propuesta se descarta por codigo.
- cambio_propuesto es el texto concreto que quedaria escrito en el skill (o "Borrar: <texto>"), en castellano rioplatense simple y con el estilo del skill.
- NUNCA inventes datos: ningun numero, codigo de pieza, ruta, nombre de persona, norma o fecha que no este escrito en el dossier. Si el cambio necesita un dato que falta, no lo propongas. Un numero de mas en el cambio y el codigo tira la propuesta.
- Fak decidio lo que dicen las lecciones: no propongas lo contrario. Una leccion que dice "Graduado a X" ya quedo codificada en X: no la pidas como texto del skill, salvo que X sea este skill.
- No propongas gusto, estilo, ortografia ni reescribir por reescribir. Un skill largo no es un error por ser largo.
- Confianza honesta: "alta" solo si lo defenderias frente a Fak.
- Escribi "por_que" en una frase, sin tecnicismos de software.

Devolves SOLO el JSON del esquema. Si no hay nada claro, devolves {"propuestas": []}.`;

export const SCHEMA_PROPUESTAS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['propuestas'],
  properties: {
    propuestas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'cita_skill', 'cita_caso', 'por_que', 'cambio_propuesto', 'confianza'],
        properties: {
          tipo: { type: 'string', enum: [...TIPOS] },
          cita_skill: { type: 'string', description: 'fragmento TEXTUAL del SKILL.md del dossier' },
          cita_caso: { type: 'string', description: 'fragmento TEXTUAL del dossier: mensaje de Fak, leccion, chequeo u otro pasaje del skill' },
          por_que: { type: 'string', description: 'una frase en castellano simple' },
          cambio_propuesto: { type: 'string', description: 'el texto concreto que quedaria en el skill' },
          confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        },
      },
    },
  },
});

/** Los tipos que este dossier permite: sin casos ni lecciones no hay leccion que reflejar, y asi. */
export function tiposPermitidos(dossier) {
  return TIPOS.filter((t) => {
    if (t === 'leccion_no_reflejada') return dossier.tieneCasos || dossier.tieneLecciones;
    if (t === 'instruccion_obsoleta') return dossier.tieneCasos || dossier.tieneLecciones;
    if (t === 'description_no_dispara') return dossier.tieneCasos;
    if (t === 'ruta_muerta') return dossier.rutasMuertas.length > 0;
    if (t === 'demasiado_larga') return dossier.tokensSkill > UMBRAL_TOKENS_LARGO || dossier.recortado;
    return true;
  });
}

/** El mensaje de usuario para el revisor: el dossier y los tipos que puede usar con este skill. */
export function armarPedidoRevisor(dossier) {
  const permitidos = tiposPermitidos(dossier);
  const lista = permitidos.join(', ');
  const aviso = dossier.tieneCasos ? '' : '\nNOTA: este skill no tiene cargas registradas, asi que no hay casos reales; solo podes proponer lo que se vea en el texto, las lecciones y los chequeos.';
  return {
    usuario: `${dossier.texto}\n\nTIPOS QUE PODES USAR CON ESTE SKILL: ${lista}.${aviso}\n\nDevolve el JSON.`,
    schema: SCHEMA_PROPUESTAS,
  };
}

/** Los tokens de las tres cosas que no son SKILL.md, para el calculo de costos. */
export const SYSTEM_REFUTADOR = `Sos el auditor final de una revision de skills de Claude Code en Barack Mercosul (autopartista argentina; el asistente trabaja con Fak, de Ingenieria). Un revisor te pasa propuestas de cambio sobre UN skill. Tu trabajo es MATAR propuestas, no agregar: solo sobrevive lo que no pudiste refutar. La maquina puede descartar una propuesta; nunca aprueba un cambio por su cuenta.

Para cada propuesta, tratá de refutarla:
- ¿Choca con una regla de .claude/rules/ (te paso el nombre y la primera linea de cada una) o con una decision de Fak que aparece en las lecciones del dossier? Si choca, se_descarta.
- ¿La cubre ya una regla o un gate ejecutable, o una leccion dice que ya quedo "Graduada" a otro lugar? Duplicar la regla en el skill es ruido: se_descarta.
- ¿Es gusto, estilo, ortografia o reescribir por reescribir? Se_descarta.
- ¿La cita del skill y la del caso dicen realmente lo que el revisor afirma? Si el caso no prueba el problema, se_descarta.
- ¿El cambio propuesto inventa un dato (numero, codigo, ruta, nombre) o agrega una instruccion que ningun documento del dossier respalda? Se_descarta.
- ¿Hace al skill peor (mas largo sin necesidad, menos claro, o saca una regla que sigue vigente)? Se_descarta.
- Si queda una duda razonable, se_descarta: preferimos perder una propuesta cierta que hacerle perder tiempo a la sesion que las verifica con una falsa.

Devolve SOLO el JSON del esquema: un veredicto por propuesta recibida, con el mismo numero. El motivo, en castellano simple, una frase.`;

export const SCHEMA_REFUTACION = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['veredictos'],
  properties: {
    veredictos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['numero', 'veredicto', 'motivo'],
        properties: {
          numero: { type: 'integer', description: 'el numero de la propuesta recibida (1, 2, ...)' },
          veredicto: { type: 'string', enum: ['se_mantiene', 'se_descarta'] },
          motivo: { type: 'string' },
        },
      },
    },
  },
});

/**
 * Nombre y primera linea de cada regla de `.claude/rules/`: la primera linea con contenido DESPUES del
 * frontmatter (varias arrancan con `---`). Devuelve [{ nombre, linea, descripcion }].
 */
export function resumenReglas({ raiz = RAIZ } = {}) {
  const dir = path.join(raiz, '.claude', 'rules');
  let nombres = [];
  try { nombres = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort(); } catch { return []; }
  const out = [];
  for (const n of nombres) {
    let texto;
    try { texto = fs.readFileSync(path.join(dir, n), 'utf8'); } catch { continue; }
    const fm = parsearFrontmatter(texto);
    const primera = fm.cuerpo.split(/\r?\n/).map((l) => l.trim()).find((l) => l) ?? '';
    out.push({ nombre: n, linea: corta(primera.replace(/^#+\s*/, ''), 200), descripcion: corta(fm.campos.description ?? '', 160) });
  }
  return out;
}

/** El mensaje para el refutador: dossier, reglas y las propuestas que paso el filtro de codigo. */
export function armarPedidoRefutador({ dossier, reglas, propuestas }) {
  const lr = reglas.length
    ? reglas.map((r) => `- ${r.nombre}: ${r.linea}${r.descripcion ? ` — ${r.descripcion}` : ''}`).join('\n')
    : '(no pude leer las reglas)';
  const lp = propuestas.map((p, i) => `${i + 1}. ${p.tipo} (confianza ${p.confianza})\n   cita del skill: "${p.cita_skill}"\n   cita del caso: "${p.cita_caso}"\n   por que: ${p.por_que}\n   cambio propuesto: ${p.cambio_propuesto}`).join('\n');
  return {
    usuario: `REGLAS DE LA CASA (.claude/rules/, nombre y primera linea):\n${lr}\n\n${dossier.texto}\n\nPROPUESTAS A REFUTAR:\n${lp}\n\nDevolve el JSON con un veredicto por propuesta.`,
    schema: SCHEMA_REFUTACION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros duros (codigo, no prompt)
// ─────────────────────────────────────────────────────────────────────────────

/** Las palabras con digitos de un texto (2 o mas caracteres): numeros, fechas, codigos, versiones. */
export function tokensConNumeros(texto) {
  const out = new Set();
  for (const m of String(texto ?? '').matchAll(/[\p{L}\d][\p{L}\d._\-/]*/gu)) {
    const t = m[0].replace(/[._\-/]+$/, '');
    if (t.length >= 2 && /\d/.test(t)) out.add(normal(t));
  }
  return [...out];
}

/** Una cita alcanza si tiene 12 caracteres y 2 palabras (ya normalizada). */
export const citaSuficiente = (citaNormal) => {
  const c = String(citaNormal ?? '').trim();
  return c.length >= 12 && c.split(' ').filter(Boolean).length >= 2;
};

/**
 * Lo que vuelve del revisor pasa por reglas que no dependen del modelo:
 *   - el SKILL.md no puede haber cambiado de hash desde que se armo el dossier;
 *   - el tipo tiene que estar en la lista cerrada y ser uno de los permitidos para este dossier;
 *   - cita_skill TEXTUAL en la parte del SKILL.md que se mando; cita_caso TEXTUAL en cualquier parte del
 *     dossier; las dos de 12 caracteres y 2 palabras como minimo, y distintas entre si;
 *   - ningun numero ni codigo (palabra con digitos de 2 o mas caracteres) en el cambio o en el motivo que no
 *     este escrito en el dossier;
 *   - cambio_propuesto con contenido; sin duplicados (tipo + cita_skill); a lo sumo TOPE_PROPUESTAS, las de
 *     mas confianza primero.
 * Devuelve { propuestas, descartadas: [{ ...p, motivo }], cuenta: { <motivo>: n } }.
 */
export function filtrarPropuestas(propuestas, dossier, { hashActual = dossier.hash } = {}) {
  const lista = Array.isArray(propuestas) ? propuestas.filter((p) => p && typeof p === 'object') : [];
  const descartadas = [];
  const cuenta = {};
  const tira = (p, motivo) => { descartadas.push({ ...p, motivo }); cuenta[motivo] = (cuenta[motivo] || 0) + 1; };

  if (hashActual !== dossier.hash) {
    for (const p of lista) tira(p, 'hash_cambio');
    return { propuestas: [], descartadas, cuenta };
  }
  const permitidos = new Set(tiposPermitidos(dossier));
  const skillN = normal(dossier.partes.skill);
  const todoN = normal(dossier.texto);
  const vistos = new Set();
  const buenas = [];
  for (const p of lista) {
    if (!TIPOS.includes(p.tipo)) { tira(p, 'tipo_invalido'); continue; }
    if (!permitidos.has(p.tipo)) { tira(p, 'tipo_no_permitido'); continue; }
    const cs = normal(p.cita_skill);
    const cc = normal(p.cita_caso);
    if (!citaSuficiente(cs) || !skillN.includes(cs)) { tira(p, 'cita_skill_no_esta'); continue; }
    if (!citaSuficiente(cc) || !todoN.includes(cc)) { tira(p, 'cita_caso_no_esta'); continue; }
    if (cs === cc) { tira(p, 'citas_iguales'); continue; }
    const cambio = String(p.cambio_propuesto ?? '').trim();
    if (cambio.length < 15) { tira(p, 'sin_cambio'); continue; }
    const sueltos = [...tokensConNumeros(`${cambio} ${p.por_que ?? ''}`)].filter((t) => !todoN.includes(t));
    if (sueltos.length) { tira({ ...p, numeros_que_faltan: sueltos }, 'numero_inventado'); continue; }
    const k = `${p.tipo}|${cs}`;
    if (vistos.has(k)) { tira(p, 'duplicada'); continue; }
    vistos.add(k);
    buenas.push({
      tipo: p.tipo, cita_skill: String(p.cita_skill).trim(), cita_caso: String(p.cita_caso).trim(),
      por_que: String(p.por_que ?? '').trim(), cambio_propuesto: cambio,
      confianza: ORDEN_CONFIANZA[p.confianza] != null ? p.confianza : 'baja',
    });
  }
  buenas.sort((a, b) => ORDEN_CONFIANZA[a.confianza] - ORDEN_CONFIANZA[b.confianza]);
  for (const p of buenas.slice(TOPE_PROPUESTAS)) tira(p, 'tope');
  return { propuestas: buenas.slice(0, TOPE_PROPUESTAS), descartadas, cuenta };
}

/**
 * Aplica los veredictos del refutador. Una propuesta sin veredicto se DESCARTA (si el refutador no la
 * miro, no se le lleva a nadie). Devuelve { mantenidas, descartadas }.
 */
export function aplicarVeredictos(propuestas, veredictos) {
  const porNumero = new Map();
  for (const v of Array.isArray(veredictos) ? veredictos : []) {
    if (v && Number.isInteger(v.numero)) porNumero.set(v.numero, v);
  }
  const mantenidas = [];
  const descartadas = [];
  propuestas.forEach((p, i) => {
    const v = porNumero.get(i + 1);
    if (v && v.veredicto === 'se_mantiene') mantenidas.push({ ...p, motivo_refutador: String(v.motivo ?? '').trim() });
    else descartadas.push({ ...p, motivo: v ? `refutador: ${String(v.motivo ?? '').trim()}` : 'el refutador no la miro: se descarta' });
  });
  return { mantenidas, descartadas };
}

// ─────────────────────────────────────────────────────────────────────────────
// Escritura segura: SOLO adentro de la carpeta de propuestas
// ─────────────────────────────────────────────────────────────────────────────

/** Error de salida: se intento escribir donde no se debe. */
export class ErrorSalida extends Error {
  constructor(mensaje) { super(mensaje); this.name = 'ErrorSalida'; }
}

/** Las carpetas de configuracion del asistente: ahi esto no escribe NUNCA, ni aunque la base lo permita. */
const RE_PROHIBIDO = /[\\/]\.claude[\\/](?:skills|commands|rules|hooks|agents|memory)(?:[\\/]|$)|[\\/]\.claude[\\/]settings/i;

/**
 * La ruta absoluta de `rel` adentro de `base`, o tira ErrorSalida. `rel` no puede subir (`..`), ser
 * absoluta ni dejar la base. Se compara con `path.relative` (un `startsWith` dejaria pasar `base-otra`).
 */
export function resolverDentro(base, rel) {
  const raiz = path.resolve(base);
  const destino = path.resolve(raiz, String(rel));
  const r = path.relative(raiz, destino);
  if (!r || r.startsWith('..') || path.isAbsolute(r)) throw new ErrorSalida(`"${rel}" queda fuera de ${raiz}: no se escribe.`);
  if (RE_PROHIBIDO.test(destino)) throw new ErrorSalida(`"${destino}" es una carpeta de configuracion del asistente: esto nunca escribe ahi.`);
  return destino;
}

/** ¿`base` esta adentro de alguna de las carpetas permitidas? */
export function baseEsPermitida(base, permitidos) {
  const b = path.resolve(base);
  return (permitidos || []).filter(Boolean).some((p) => {
    const r = path.relative(path.resolve(p), b);
    return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
  });
}

/**
 * Escribe `texto` en `rel` adentro de `base`. Dos candados, uno encima del otro:
 *   1. el de ESTE archivo: `base` tiene que estar adentro de una de las carpetas de `permitidos` (la
 *      `.sgc-cache` del repo y, para los tests, la de la variable de entorno que corresponda), `rel` no puede
 *      subir ni salir de la base, y nunca cae en la configuracion del asistente (`.claude/skills`...);
 *   2. el de la noche (`escrituraSegura.mjs`, la UNICA puerta de escritura: este archivo no usa `fs` para
 *      escribir), que ademas resuelve los enlaces y escribe a un temporal y renombra.
 * Si cualquiera de los dos dice que no, tira ANTES de crear nada. El candado de la noche NO se ensancha desde
 * aca: una base fuera de `.sgc-cache` solo escribe si el entorno la habilita ahi (hoy: BARACK_API_DIR,
 * BARACK_PREAUDITORIA_DIR, BARACK_NOVEDADES_DIR). BARACK_PROPUESTAS_DIR y BARACK_DISPARO_DIR solo acotan; para
 * que escriban solas fuera de `.sgc-cache` las tiene que sumar el dueño de `escrituraSegura.mjs`.
 */
export function escribirEnBase(base, rel, texto, { permitidos } = {}) {
  if (!baseEsPermitida(base, permitidos)) throw new ErrorSalida(`la carpeta "${path.resolve(base)}" no esta entre las permitidas para escribir.`);
  return escribirEnLaNoche(resolverDentro(base, rel), texto);
}

/** Nombre de archivo seguro para un skill ('anthropic-skills:pptx' -> 'anthropic-skills_pptx'). */
export function nombreArchivoSeguro(nombre) {
  const s = String(nombre ?? '').toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/\.{2,}/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 80);
  return s || 'skill';
}

/** Las carpetas donde esto puede escribir: `.sgc-cache` del repo y, si existe, la de BARACK_PROPUESTAS_DIR. */
export function basesPermitidas({ raiz = RAIZ, env = process.env, variable = 'BARACK_PROPUESTAS_DIR' } = {}) {
  return [path.join(raiz, '.sgc-cache'), env[variable] || null].filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reportes
// ─────────────────────────────────────────────────────────────────────────────

/** El archivo de un skill para la sesion de la manana. */
export function armarMarkdownSkill({ fecha, skill, chequeo, dossier, propuestas = [], descartadas = [], error = null, costoUsd = 0, simulado = false }) {
  const L = [];
  L.push(`# Propuestas para el skill \`${skill.nombre}\` — ${fecha}`, '');
  L.push('**Para la sesión de Claude de la mañana, no para Fak.** Cada propuesta la hizo un modelo (Sonnet), la dejó pasar un filtro de código (citas textuales, sin números inventados) y no la pudo refutar otro (Opus); igual es una CANDIDATA. Antes de tocar el skill: abrir el SKILL.md, verificar las dos citas contra la fuente, descartar lo que choque con una regla o una decisión de Fak, aplicar a mano lo que valga y recién ahí avisarle a Fak (regla `mejora-implementada.md`). Nada de acá se aplica solo.', '');
  L.push(`- hash del SKILL.md al armar el dossier: \`${skill.hash.slice(0, 12)}\` · ${chequeo.kb} KB (~${chequeo.tokens} tokens por carga)`);
  L.push(`- cargas en los transcripts: ${chequeo.cargas30} en 30 días, ${chequeo.cargasTotal} en total · lecciones que lo nombran: ${chequeo.lecciones}`);
  if (dossier) L.push(`- dossier: ~${dossier.tokens} tokens${dossier.recortado ? ` (SKILL.md recortado: ${dossier.omitidas.length} secciones omitidas)` : ''} · casos: ${dossier.nCasos}`);
  if (chequeo.avisos.length) { L.push('- chequeos de código:'); for (const a of chequeo.avisos) L.push(`  - ${a}`); }
  if (chequeo.rutasMuertas.length) { L.push('- rutas inexistentes:'); for (const r of chequeo.rutasMuertas) L.push(`  - \`${r.ruta}\` (línea ${r.linea})`); }
  L.push(`- costo: $${Number(costoUsd).toFixed(2)}${simulado ? ' (simulado)' : ''}`, '');
  if (error) { L.push(`ERROR: ${error}`, ''); return `${L.join('\n').trimEnd()}\n`; }
  if (!propuestas.length) {
    L.push('Sin propuestas que sobrevivan.', '');
  } else {
    L.push(`## Propuestas que sobrevivieron (${propuestas.length})`, '');
    propuestas.forEach((p, i) => {
      L.push(`### ${i + 1}. ${TIPO_LEGIBLE[p.tipo] || p.tipo} · confianza ${p.confianza}`);
      L.push(`- cita del skill: "${p.cita_skill}"`);
      L.push(`- cita del caso: "${p.cita_caso}"`);
      L.push(`- por qué: ${p.por_que}`);
      L.push('- cambio propuesto:', ...p.cambio_propuesto.split('\n').map((l) => `  > ${l}`));
      if (p.motivo_refutador) L.push(`- el refutador la dejó pasar porque: ${p.motivo_refutador}`);
      L.push('');
    });
  }
  if (descartadas.length) {
    L.push(`## Descartadas (${descartadas.length}) — para saber qué se filtró`, '');
    for (const d of descartadas) L.push(`- ${TIPO_LEGIBLE[d.tipo] || d.tipo}: ${d.motivo}`);
    L.push('');
  }
  return `${L.join('\n').trimEnd()}\n`;
}

/** La tabla de todos los skills. */
export function armarResumen({ fecha, filas, costoUsd = 0, simulado = false }) {
  const L = [];
  const total = filas.reduce((s, f) => s + (f.propuestas || 0), 0);
  L.push(`# Propuestas de skills — ${fecha}${simulado ? ' (simulado: no se gastó nada)' : ''}`, '');
  L.push('**Para la sesión de la mañana, no para Fak.** Una fila por skill; el detalle de cada propuesta está en `<skill>.md`. Los chequeos de código (rutas, tamaño, cargas, description) corren sobre todos; el modelo revisa solo los que dice la columna "revisado".', '');
  L.push(`- skills: ${filas.length} · revisados con el modelo: ${filas.filter((f) => f.revisado).length} · propuestas que sobrevivieron: ${total} · costo: $${Number(costoUsd).toFixed(2)}`, '');
  L.push('| skill | KB | tokens | cargas 30 d | rutas muertas | description | revisado | propuestas | descartadas | costo |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const f of filas) {
    const desc = f.sinGatillo ? 'sin disparo' : f.descriptionLarga ? `larga (${f.descriptionLargo})` : 'ok';
    L.push(`| ${f.nombre} | ${f.kb} | ${f.tokens} | ${f.cargas30} | ${f.rutasMuertas} | ${desc} | ${f.error ? 'ERROR' : f.revisado ? 'si' : 'no'} | ${f.propuestas ?? '-'} | ${f.descartadas ?? '-'} | $${Number(f.costoUsd || 0).toFixed(2)} |`);
  }
  L.push('');
  return `${L.join('\n').trimEnd()}\n`;
}

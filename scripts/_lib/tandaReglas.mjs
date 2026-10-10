/**
 * tandaReglas.mjs — las reglas de una tanda larga que eran solo texto, medidas del REGISTRO (cola HOY-17, 10/10/2026).
 *
 * Fak, 10/10/2026 18:48: "te pongo reglas y te las olvidas... ¿como te vas a asegurar de que no sigan pasando estas
 * cosas?". Ese dia el orquestador de las 48 h (a) no hizo ningun pedido a la API de 11:00 a 18:48, con la regla escrita
 * en su prompt, y (b) de 14:57 a 18:36 desperto con cada latido, escribio "sin cambios, sin novedades tuyas" y volvio a
 * dormir, esperando una respuesta de Fak sin hacer lo que no dependia de ella. Una regla sin control ejecutable es prosa.
 *
 * Dos medidas, las dos leidas del transcript de la sesion (no de lo que la sesion cuenta de si misma):
 *   1. API: en las ultimas 2 horas hubo trabajo (texto largo o subagentes) y 0 pedidos a la API (`evaluarApi`).
 *   2. PARADO: N despertares seguidos del latido sin avance, con una pregunta a Fak abierta (`registrarDespertar`).
 *
 * Son AVISOS, no frenos (Fak, 09/10: "me preocupa que tenga muchos bloqueantes"). Como llegan a la sesion:
 *   · el latido (scripts/_latido.mjs) sale con SALIDA_AVISO (5): lo unico suyo que la sesion ve es el codigo de salida;
 *   · `node scripts/_orquestador.mjs --hora` imprime el estado de las dos (y de las hijas);
 *   · el cierre-guard suma un renglon a los frenos que YA daba (chequeos 3 y 5). Ningun freno nuevo.
 *
 * Todo falla ABIERTO: sin registro, sin git, con un registro que no se llega a leer o con un renglon roto, no hay aviso
 * y nada cambia (un control roto no puede dejar parada a una sesion). Las frases y los numeros viven en
 * tandaCanon.data.json, con su fuente. Tests en las dos direcciones, con el caso real del 10/10 como rojo:
 * __tests__/scripts/tandaReglas.test.mjs.
 *
 * Limites conocidos (dichos, no escondidos):
 *   · nada obliga a correr `--hora`, y el aviso del cierre solo viaja cuando el cierre ya frenaba;
 *   · "trabajo sin herramientas" se mide por su huella (texto y subagentes): no se puede leer de un registro;
 *   · la cuenta de despertares va uno atras (lo que la sesion hace en el turno de un despertar se ve en el siguiente);
 *   · un pedido a la API detras de un `| tail` o en segundo plano cuenta aunque haya fallado (el resultado no dice error);
 *   · escribir una memoria o una nota en cada despertar cuenta como avance (solo la lista esta excluida);
 *   · el registro se lee hasta 64 MB desde el final: si la ventana no entra ahi, no se mide (y no se avisa).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { colasDe, mensajeDeFakEn, vigente, enLocal } from './horaGuard.mjs';
import { soloLineasDeComando } from './shellTexto.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(AQUI, '..', '..');
// Si el canon no se puede leer (un JSON roto, una expresion mal escrita) el modulo NO puede tirar al importarse: lo
// importan el latido y el cierre-guard, y con el caerian el despertador y los frenos del cierre (auditor 10/10/2026).
// Queda un canon APAGADO: nada calza, ningun umbral se alcanza, ningun aviso sale. `CANON_ROTO` lo dice en `--hora`.
const NUNCA = '$^';
const CANON_APAGADO = {
  api: { ventana_min: 120, comando_re: NUNCA, excluye_re: NUNCA, texto_min_chars: Infinity, reaviso_min: 60 },
  parado: { despertares: Infinity, commit_re: NUNCA, commit_excluye_re: NUNCA, agente_tools_re: NUNCA, hija_tools_re: NUNCA, escribe_tools_re: NUNCA, espera_a_fak_re: [], seccion_lista_re: NUNCA, lista_excluye_re: NUNCA },
};
function leerCanon() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(AQUI, 'tandaCanon.data.json'), 'utf8'));
    for (const s of [c.api.comando_re, c.api.excluye_re, c.parado.commit_re, c.parado.commit_excluye_re, c.parado.agente_tools_re, c.parado.hija_tools_re, c.parado.escribe_tools_re, c.parado.seccion_lista_re, c.parado.lista_excluye_re, ...c.parado.espera_a_fak_re.map((p) => p.re)]) new RegExp(s, 'i');
    if (!(c.api.ventana_min > 0 && c.api.texto_min_chars > 0 && c.parado.despertares > 0)) throw new Error('faltan numeros');
    return c;
  } catch { return null; }
}
const canonLeido = leerCanon();
export const CANON_ROTO = canonLeido === null;
export const CANON = canonLeido || CANON_APAGADO;

const rx = (s, f = 'i') => new RegExp(s, f);
const LISTA_EXCLUYE = rx(CANON.parado.lista_excluye_re);
const API_RE = rx(CANON.api.comando_re);
const API_EXCLUYE = rx(CANON.api.excluye_re);
const COMMIT_RE = rx(CANON.parado.commit_re);
const COMMIT_EXCLUYE = rx(CANON.parado.commit_excluye_re);
const AGENTE_RE = rx(CANON.parado.agente_tools_re);
const HIJA_RE = rx(CANON.parado.hija_tools_re);
const ESCRIBE_RE = rx(CANON.parado.escribe_tools_re);
const ESPERA = CANON.parado.espera_a_fak_re.map((p) => ({ ...p, regex: rx(p.re) }));
const SECCION_RE = rx(CANON.parado.seccion_lista_re);
export const VENTANA_API_MS = CANON.api.ventana_min * 60000;
export const DESPERTARES = CANON.parado.despertares;
/** Hasta donde se lee el registro desde el final. Mas alla no se mide: 480 MB de JSON en memoria tumban a node. */
export const TOPE_LECTURA_BYTES = 64 * 1048576;
/** Dos latidos de la misma sesion que despiertan con menos de esto de diferencia son UN despertar. */
const MISMO_DESPERTAR_MS = 4 * 60000;
/** Si el despertar anterior es mas viejo que esto, la cuenta es de otra tanda y arranca de cero. */
const CUENTA_VIEJA_MS = 30 * 60000;

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
/** `/c/Dev/x` (Git Bash) y `C:/Dev/x` -> `c:\dev\x`, para comparar dos rutas del mismo archivo. */
const rutaNorm = (r) => {
  let s = String(r ?? '').trim();
  const m = s.match(/^\/([a-z])\/(.*)$/i);
  if (m) s = `${m[1]}:/${m[2]}`;
  return path.win32.normalize(s.replace(/\//g, '\\')).replace(/\\+$/, '').toLowerCase();
};
const mismaRuta = (a, b) => Boolean(a && b) && rutaNorm(a) === rutaNorm(b);
const limpiarId = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_');

// ---------------------------------------------------------------------------------------------
// 1. Lo que paso en el registro desde una hora
// ---------------------------------------------------------------------------------------------

const eventosVacios = (motivo = 'sin registro') => ({
  ok: false, motivo, cubre: false, commits: [], escrituras: [], agentes: [], hijas: [], api: [], fak: [], espera: [], textoChars: 0, turnos: 0,
});

/** ¿Que es este comando para la cuenta? 'api' | 'commit' | null. Mira las lineas de comando, no la prosa de un heredoc. */
export function claseDeComando(comando) {
  const cmd = soloLineasDeComando(String(comando || ''));
  for (const linea of cmd.split('\n')) {
    if (API_RE.test(linea) && !API_EXCLUYE.test(linea)) return 'api';
  }
  for (const linea of cmd.split('\n')) {
    if (COMMIT_RE.test(linea) && !COMMIT_EXCLUYE.test(linea)) return 'commit';
  }
  return null;
}

/**
 * Recorre renglones del registro (en orden) y junta lo que paso entre `desdeMs` y `hastaMs`. Puro: no lee disco.
 * Un commit o un pedido a la API cuenta por la hora en que VOLVIO su resultado (sin error): el que se lanzo antes de
 * `desdeMs` y volvio despues entra en esta ventana (revision del 10/10: un pedido de 4 minutos que cruzaba un despertar
 * no se contaba en ninguna).
 */
export function recorrer(lineas, desdeMs, { lista = null, hastaMs = Infinity } = {}) {
  const ev = eventosVacios();
  ev.ok = true;
  ev.motivo = '';
  const pend = new Map();                       // tool_use_id -> 'api' | 'commit' (cuentan cuando vuelven sin error)
  const primeros = [];                          // las tres primeras horas del tramo: dicen si empieza antes de `desdeMs`
  for (const linea of lineas) {
    if (!linea || !linea.includes('"timestamp"')) continue;
    let j;
    try { j = JSON.parse(linea); } catch { continue; }
    const ms = Date.parse(j.timestamp || '');
    if (!Number.isFinite(ms)) continue;
    if (primeros.length < 3) primeros.push(ms);
    if (ms > hastaMs || j.isSidechain) continue;
    const c = j.message?.content;
    if (j.type === 'assistant' && Array.isArray(c)) {
      const adentro = ms >= desdeMs;
      if (adentro) ev.turnos++;
      for (const b of c) {
        if (b?.type === 'tool_use' && /^(Bash|PowerShell)$/.test(b.name || '')) {
          const clase = claseDeComando(b.input?.command);     // tambien los de ANTES de la ventana: pueden volver adentro
          if (clase) pend.set(b.id, clase);
          continue;
        }
        if (!adentro) continue;
        if (b?.type === 'text' && typeof b.text === 'string') {
          ev.textoChars += b.text.length;
          const n = sinTildes(b.text);
          const h = ESPERA.map((p) => n.match(p.regex)).find(Boolean);
          if (h) ev.espera.push({ ms, frase: h[0] });
        } else if (b?.type === 'tool_use') {
          const nombre = b.name || '';
          const inp = b.input || {};
          if (AGENTE_RE.test(nombre)) ev.agentes.push(ms);
          else if (HIJA_RE.test(nombre)) ev.hijas.push(ms);
          else if (ESCRIBE_RE.test(nombre)) {
            const ruta = inp.file_path || inp.notebook_path;
            if (ruta && !mismaRuta(ruta, lista)) ev.escrituras.push(ms);      // anotar en la lista no es avanzar
          }
        }
      }
      continue;
    }
    if (j.type === 'user' && Array.isArray(c) && pend.size) {
      for (const b of c) {
        if (b?.type !== 'tool_result' || !pend.has(b.tool_use_id)) continue;
        const que = pend.get(b.tool_use_id);
        pend.delete(b.tool_use_id);
        if (b.is_error || ms < desdeMs) continue;
        (que === 'api' ? ev.api : ev.commits).push(ms);
      }
    }
    if (ms >= desdeMs) {
      const m = mensajeDeFakEn(linea);
      if (m) ev.fak.push(m.ms ?? ms);
    }
  }
  // El tramo cubre la ventana si EMPIEZA antes de la hora pedida. Se miran sus tres primeras horas y no solo la
  // primera: un renglon viejo suelto, fuera de orden (el resumen de un compactado), no alcanza para darlo por cubierto.
  const comienzo = primeros.slice(0, 3);
  ev.cubre = comienzo.length > 0 && comienzo.filter((m) => m < desdeMs).length >= Math.ceil((comienzo.length * 2) / 3);
  ev.primeroMs = primeros.length ? primeros[0] : null;
  return ev;
}

/**
 * Lo que paso en el registro en la ventana, leyendolo desde el FINAL por tramos (pesa cientos de MB). Lee hasta
 * TOPE_LECTURA_BYTES; si con eso el tramo no llega hasta antes de `desdeMs` y el archivo es mas grande, devuelve
 * ok:false (no se sabe: quien llama no avisa). Un tramo que falla no borra lo que ya se leyo bien.
 */
export function leerEventos(ruta, desdeMs, opciones = {}) {
  let total = 0;
  try { total = fs.statSync(ruta).size; } catch { return eventosVacios('sin registro'); }
  let ev = null;
  let leido = 0;
  let tramos = 0;
  try {
    // colasDe da tramos de 8, 64 y 480 MB. El tercero NO se pide: el generador lo cargaria entero en memoria antes de
    // entregarlo, y un node sin memoria no se puede atajar (el latido moriria con un codigo que nadie espera).
    for (const lineas of colasDe(ruta)) {
      const r = recorrer(lineas, desdeMs, opciones);
      ev = r;
      leido = lineas.reduce((s, l) => s + l.length + 1, 0);
      if (r.cubre || ++tramos >= 2) break;                    // ya llego hasta antes de la hora, o se llego al tope
    }
  } catch { /* se queda con lo ultimo que se leyo bien */ }
  if (!ev) return eventosVacios('registro ilegible');
  if (!ev.cubre && leido < total * 0.9) return { ...eventosVacios('la ventana no entra en lo que se lee del registro'), primeroMs: ev.primeroMs };
  return ev;
}

/** La hora del primer renglon del registro (cuando arranco la sesion), o la de creacion del archivo, o null. */
export function inicioDelRegistro(ruta) {
  let fd = null;
  try {
    fd = fs.openSync(ruta, 'r');
    const buf = Buffer.alloc(262144);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const m = buf.toString('utf8', 0, n).match(/"timestamp":"([^"]+)"/);
    const ms = m ? Date.parse(m[1]) : NaN;
    if (Number.isFinite(ms)) return ms;
    const nace = fs.statSync(ruta).birthtimeMs;                // un primer renglon enorme: vale la fecha del archivo
    return Number.isFinite(nace) && nace > 0 ? nace : null;
  } catch { return null; } finally { if (fd !== null) { try { fs.closeSync(fd); } catch { /* nada */ } } }
}

/** El registro de una sesion: ~/.claude/projects/<proyecto>/<sesion>.jsonl, o null. */
export function buscarRegistro(sesion, home = os.homedir()) {
  if (!sesion) return null;
  const base = path.join(home, '.claude', 'projects');
  try {
    for (const d of fs.readdirSync(base)) {
      const p = path.join(base, d, `${sesion}.jsonl`);
      if (fs.existsSync(p)) return p;
    }
  } catch { /* sin carpeta no hay registro */ }
  return null;
}

/** Cuantos commits entraron al repo en la ventana (de cualquier sesion y en cualquier rama o worktree), o null si git
 *  no contesta. */
export function commitsDelRepo(desdeMs, repo = REPO, hastaMs = null) {
  try {
    const args = ['log', '--all', `--since=${new Date(desdeMs).toISOString()}`, ...(hastaMs ? [`--until=${new Date(hastaMs).toISOString()}`] : []), '--format=%ct'];
    const out = execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
    return out.split('\n').filter((l) => l.trim() && Number(l) * 1000 >= desdeMs).length;
  } catch { return null; }
}

// ---------------------------------------------------------------------------------------------
// 2. Regla de la API: 2 horas con trabajo y 0 pedidos
// ---------------------------------------------------------------------------------------------

/**
 * `ev` = lo que paso en la ventana (leerEventos desde ahora - 2 h). `inicioMs` = cuando arranco la sesion.
 * Avisa si la sesion lleva al menos la ventana entera, hubo trabajo (texto por arriba del minimo, o un subagente) y
 * no hubo ningun pedido a la API que haya vuelto bien.
 */
export function evaluarApi({ ev, ahoraMs, inicioMs = null, cfg = CANON.api } = {}) {
  const pedidos = ev?.api?.length ?? 0;
  const base = { aviso: false, pedidos, textoChars: ev?.textoChars ?? 0, agentes: ev?.agentes?.length ?? 0 };
  if (CANON_ROTO) return { ...base, motivo: 'no se pudo medir: el canon de las reglas de la tanda no se lee' };
  if (!ev?.ok) return { ...base, motivo: ev?.motivo || 'sin registro' };
  if (pedidos > 0) return { ...base, motivo: 'hubo pedidos' };
  if (inicioMs == null || ahoraMs - inicioMs < cfg.ventana_min * 60000) return { ...base, motivo: `la sesion lleva menos de ${cfg.ventana_min} min` };
  const trabajo = base.textoChars >= cfg.texto_min_chars || base.agentes > 0;
  if (!trabajo) return { ...base, motivo: 'sin trabajo de texto ni subagentes en la ventana' };
  return { ...base, aviso: true, motivo: `${cfg.ventana_min} min con trabajo y 0 pedidos` };
}

export const textoAvisoApi = (a) => `API: 0 pedidos de esta sesión en las últimas ${CANON.api.ventana_min / 60} horas, con ${a.textoChars.toLocaleString('es-AR')} caracteres de texto y ${a.agentes} subagente(s). `
  + 'Lo que no necesita herramientas (revisar un diff o un plan, sintetizar informes, redactar un borrador) va por los créditos: '
  + 'node scripts/_apiTarea.mjs --tarea <nombre> --pedido <archivo.md> --adjunto <ruta> --salida <archivo> (Fak, 10/10: «usás principalmente los créditos de la API»).';

// ---------------------------------------------------------------------------------------------
// 3. Regla de no quedarse parado: despertares seguidos sin avance con una pregunta abierta
// ---------------------------------------------------------------------------------------------

/** ¿Hubo avance en lo que paso? Devuelve { avance, por: [...] }. */
export function evaluarAvance(ev, commitsRepo = 0) {
  const por = [];
  if (commitsRepo > 0) por.push(`${commitsRepo} commit(s) en el repo`);
  if (ev.commits.length) por.push(`${ev.commits.length} commit(s) propios`);
  if (ev.escrituras.length) por.push(`${ev.escrituras.length} archivo(s) escritos`);
  if (ev.agentes.length) por.push(`${ev.agentes.length} subagente(s)`);
  if (ev.hijas.length) por.push(`${ev.hijas.length} hija(s) lanzadas o avisadas`);
  if (ev.api.length) por.push(`${ev.api.length} pedido(s) a la API`);
  return { avance: por.length > 0, por };
}

/** Los renglones de la seccion «Lo que necesita a Fak» de la lista (sin los tachados ni los [x]). */
export function preguntasEnLista(lista) {
  if (!lista) return [];
  let texto = '';
  try { texto = fs.readFileSync(lista, 'utf8'); } catch { return []; }
  const out = [];
  let adentro = false;
  for (const l of texto.split(/\r?\n/)) {
    if (/^##\s/.test(l)) { adentro = SECCION_RE.test(l); continue; }
    if (!adentro) continue;
    const m = l.match(/^\s*[-*]\s+(.*\S)\s*$/);
    if (!m) continue;
    if (/^\[x\]/i.test(m[1]) || /^~~.*~~$/.test(m[1])) continue;
    if (LISTA_EXCLUYE.test(sinTildes(m[1]))) continue;         // «P83 contestada el 10/10»: ya no es una pregunta abierta
    out.push(m[1].replace(/\*\*/g, '').slice(0, 110));
  }
  return out;
}

const dirTanda = (home = os.homedir()) => path.join(home, '.claude', '.tanda');
export const rutaTanda = (sesion, home) => path.join(dirTanda(home), `${limpiarId(sesion)}.json`);
export function leerTanda(sesion, home) {
  try { const j = JSON.parse(fs.readFileSync(rutaTanda(sesion, home), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; }
}
function guardarTanda(sesion, estado, home) {
  const p = rutaTanda(sesion, home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(estado, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, p);
}

/**
 * Anota UN despertar del latido y dice como queda la cuenta. Mira el registro desde el despertar anterior (o desde que
 * arranco este latido, si es el primero): lo que la sesion hizo en el turno del despertar anterior cae en esa ventana,
 * asi que la cuenta va un despertar atras (el aviso de «3 sin avance» llega al despertar siguiente).
 *   sinAvance  — despertares seguidos sin avance (0 si hubo avance o si Fak escribio)
 *   pregunta   — { abierta, por }: el asistente escribio que espera a Fak y Fak no contesto despues, o la lista tiene
 *                renglones en «Lo que necesita a Fak»
 *   parado     — sinAvance >= N y pregunta abierta
 * No cuenta (y no toca el estado) si no se puede medir: sin registro, registro que no se llega a leer, o git que no
 * contesta. Tampoco cuenta dos veces el mismo despertar (dos latidos de la misma sesion), y si el despertar anterior
 * es de otra tanda (mas de media hora atras) arranca de cero.
 * `hastaMs`: para medir un despertar PASADO sobre un registro que ya tiene lo que vino despues (tests, mediciones).
 */
export function registrarDespertar({ sesion, ahora = new Date(), inicioMs = null, lista = null, home, registro, commitsRepo = commitsDelRepo, guardar = true, hastaMs = null } = {}) {
  const ruta = registro ?? buscarRegistro(sesion, home);
  if (!sesion || !ruta) return { ok: false, motivo: 'sin registro' };
  const ahoraMs = ahora.getTime();
  let st = leerTanda(sesion, home);
  if (Number.isFinite(st.ultimo_ms) && ahoraMs - st.ultimo_ms > CUENTA_VIEJA_MS) st = { api_avisado_ms: st.api_avisado_ms };   // otra tanda
  if (Number.isFinite(st.ultimo_ms) && ahoraMs - st.ultimo_ms >= 0 && ahoraMs - st.ultimo_ms < MISMO_DESPERTAR_MS) {
    const sin = Number(st.sinAvance) || 0;
    return { ok: true, repetido: true, sinAvance: sin, parado: Boolean(st.parado), pregunta: { abierta: Boolean(st.parado), por: st.pregunta_por || [], enLista: [] }, avance: { avance: false, por: [] }, hablaFak: false, desdeMs: st.desde_ms ?? null };
  }
  const desde = Number.isFinite(st.ultimo_ms) ? st.ultimo_ms : (Number.isFinite(inicioMs) ? inicioMs : ahoraMs - 10 * 60000);
  const tope = hastaMs ?? ahoraMs;
  const ev = leerEventos(ruta, desde, { lista, hastaMs: tope });
  if (!ev.ok) return { ok: false, motivo: ev.motivo || 'registro ilegible' };
  const enRepo = commitsRepo(desde, undefined, tope);
  if (enRepo === null || enRepo === undefined) return { ok: false, motivo: 'git no contesta: no se sabe si hubo commits' };
  const a = evaluarAvance(ev, enRepo);
  const hablaFak = ev.fak.length > 0;
  const ultimaEspera = ev.espera.length ? ev.espera.at(-1) : null;
  const ultimoFak = hablaFak ? Math.max(...ev.fak) : null;
  // la espera queda anotada hasta que Fak escriba despues de ella
  let espera = st.espera || null;
  if (ultimoFak !== null && espera && ultimoFak > espera.ms) espera = null;
  if (ultimaEspera && (ultimoFak === null || ultimaEspera.ms > ultimoFak)) espera = ultimaEspera;
  const sinAvance = (a.avance || hablaFak) ? 0 : (Number(st.sinAvance) || 0) + 1;
  const enLista = preguntasEnLista(lista);
  const por = [...(espera ? [`el asistente escribió «${espera.frase}» y Fak no contestó después`] : []), ...(enLista.length ? [`${enLista.length} renglón(es) en «Lo que necesita a Fak» de la lista`] : [])];
  const pregunta = { abierta: por.length > 0, por, enLista };
  const parado = sinAvance >= DESPERTARES && pregunta.abierta;
  const nuevo = { ...st, sinAvance, parado, pregunta_por: por, ultimo_ms: ahoraMs, ultimo: enLocal(ahora), espera, desde_ms: sinAvance === 0 ? ahoraMs : (st.desde_ms ?? desde) };
  if (guardar) { try { guardarTanda(sesion, nuevo, home); } catch { /* sin estado no hay cuenta: mal menor */ } }
  return { ok: true, sinAvance, parado, pregunta, avance: a, hablaFak, desdeMs: nuevo.desde_ms };
}

export const textoAvisoParado = (r) => `PARADO: ${r.sinAvance} despertares seguidos sin commit, sin archivos, sin agentes, sin hijas y sin API${r.desdeMs ? ` (desde las ${enLocal(new Date(r.desdeMs)).slice(11)})` : ''}, con una pregunta abierta a Fak (${r.pregunta.por.join('; ')}). `
  + 'Hacé lo que no depende de la respuesta: abrí la lista, «Trabajo que puedo hacer solo», y seguí. Esperar a Fak no es trabajar '
  + '(10/10/2026: «¿te quedaste esperándome? es gravísimo»). Si de verdad todo depende de él o de una hija que está trabajando, mirá la hija (node scripts/_orquestador.mjs --hora) y agregale trabajo a la lista.';

// ---------------------------------------------------------------------------------------------
// 4. Lo que usan el latido, el cierre y el chequeo de la hora
// ---------------------------------------------------------------------------------------------

/** El estado de la regla de la API para una sesion, leido del registro. Nunca tira. */
export function estadoApi({ sesion, ahora = new Date(), home, registro } = {}) {
  try {
    const ruta = registro ?? buscarRegistro(sesion, home);
    if (!ruta) return { aviso: false, pedidos: 0, motivo: 'sin registro' };
    const ahoraMs = ahora.getTime();
    const ev = leerEventos(ruta, ahoraMs - VENTANA_API_MS, { hastaMs: ahoraMs });
    return evaluarApi({ ev, ahoraMs, inicioMs: inicioDelRegistro(ruta) });
  } catch { return { aviso: false, pedidos: 0, motivo: 'no se pudo medir' }; }
}

/**
 * Lo que hace el latido al despertar con la hora vigente: anota el despertar y junta los avisos. El de la API no se
 * repite antes de `reaviso_min` (si no, saldria cada 9 minutos). Nunca tira: sin poder medir, devuelve [].
 */
export function alDespertar({ sesion, ahora = new Date(), inicioMs = null, lista = null, home, registro, commitsRepo } = {}) {
  const avisos = [];
  try {
    const ruta = registro ?? buscarRegistro(sesion, home);
    if (!ruta) return { avisos, motivo: 'sin registro' };
    const d = registrarDespertar({ sesion, ahora, inicioMs, lista, home, registro: ruta, ...(commitsRepo ? { commitsRepo } : {}) });
    if (d.ok && d.parado && !d.repetido) avisos.push(textoAvisoParado(d));
    const api = estadoApi({ sesion, ahora, home, registro: ruta });
    if (api.aviso) {
      const st = leerTanda(sesion, home);
      const ahoraMs = ahora.getTime();
      if (!(Number.isFinite(st.api_avisado_ms) && ahoraMs - st.api_avisado_ms < CANON.api.reaviso_min * 60000)) {
        avisos.push(textoAvisoApi(api));
        try { guardarTanda(sesion, { ...st, api_avisado_ms: ahoraMs }, home); } catch { /* idem */ }
      }
    }
    return { avisos, despertar: d, api };
  } catch (e) { return { avisos: [], motivo: `no se pudo medir: ${e?.message ?? e}` }; }
}

/**
 * El renglon que el cierre-guard suma a un freno que YA daba. Solo para una sesion con una hora vigente (la que Fak dejo
 * trabajando sola): sin eso avisaria en toda sesion. El «parado» es el que anoto el latido (despertares sin avance CON
 * una pregunta abierta), no la cuenta sola. Devuelve '' si no hay nada que decir o no se pudo medir.
 */
export function avisoParaCierre({ sesion, registro, ahora = new Date(), home } = {}) {
  try {
    if (!sesion || !vigente(sesion, { ahora, home })) return '';
    const partes = [];
    const api = estadoApi({ sesion, ahora, home, registro });
    if (api.aviso) partes.push(textoAvisoApi(api));
    const st = leerTanda(sesion, home);
    const fresco = Number.isFinite(st.ultimo_ms) && ahora.getTime() - st.ultimo_ms <= CUENTA_VIEJA_MS;
    if (st.parado && fresco) partes.push(`PARADO: el latido lleva ${st.sinAvance} despertares seguidos sin avance con una pregunta abierta a Fak: hacé lo que no depende de la respuesta (node scripts/_orquestador.mjs --hora).`);
    return partes.length ? `\nADEMAS, las reglas de la tanda (aviso, no frena): ${partes.join(' ')}` : '';
  } catch { return ''; }
}

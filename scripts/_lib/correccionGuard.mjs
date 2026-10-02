/**
 * correccionGuard.mjs — cuando un entregable vuelve, le devuelve a Claude el PEDIDO ORIGINAL textual y le exige
 * contrastar el entregable contra el, en vez de parchear el ultimo reclamo.
 *
 * Por que existe (01/10/2026, fotos de las prensas Hot Press): el primer mensaje de Fak ya decia todo ("fotos de
 * la maquina... de frente y de lejos que se vea bien entera... y del proceso busca videos"). Cada correccion se
 * respondio mirando solo ESA correccion: 4 fotos retocadas -> 25 fotos del proceso -> 6 con costura. Recien a la
 * cuarta se releyo el primer mensaje. Y lo que no se encontraba se RELLENO con material parecido (otro proyecto,
 * otra parte del proceso) en vez de buscarlo mejor o decir que no estaba.
 *
 * Medido sobre 233 sesiones: en 15 de las 54 con entregas, lo mismo se reentrego 3 veces o mas. Por las PALABRAS
 * de Fak solo se detectan 3 de esas sesiones (corrige de muchas formas y con errores de tipeo), asi que hay dos
 * senales:
 *   A. Entregas: cuantas veces se entrego (SendUserFile) algo de la misma carpeta dentro de la misma TANDA.
 *      Se leen del transcript, solo el tramo nuevo desde el mensaje anterior (se guarda hasta donde se leyo).
 *   B. Palabras: mensajes de correccion dentro de la tanda.
 * Una TANDA es un trabajo: arranca con la primera entrega (o la primera correccion) y termina cuando Fak aprueba
 * o cuando se entrega en una carpeta nueva sin que haya mediado ninguna correccion. El PEDIDO de la tanda son los
 * mensajes de Fak anteriores a su primera entrega, y no se pisa mientras la tanda siga abierta.
 * Nunca bloquea: solo agrega contexto.
 *
 *   node scripts/_lib/correccionGuard.mjs --hook            # stdin: JSON de UserPromptSubmit
 *   node scripts/_lib/correccionGuard.mjs --medir <jsonl>   # calibra contra sesiones reales: filas {ses,t} o {ses,e:[archivos]}
 *   node scripts/_lib/correccionGuard.mjs --selftest
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'correccionCanon.data.json'), 'utf8'));
const re = (s) => new RegExp(s, 'i');
const FUERTES = CANON.fuertes.map((f) => ({ ...f, re: re(f.regex) }));
const DEBILES = CANON.debiles.map((f) => ({ ...f, re: re(f.regex) }));
const [APROBACION, ADVERSATIVA, NEUTRO, DUDA, GENERICA, VERSION] = ['aprobaciones', 'adversativas', 'neutros', 'duda', 'carpetas_genericas', 'subcarpetas_de_version'].map((k) => re(CANON[k]));
const TOPE_TEXTO = 20000;      // un pegado de megas no puede demorar el turno

/** Minusculas, sin tildes y sin lo que NO escribio Fak (avisos del sistema, texto pegado, citas largas, rutas). */
export function normalizar(texto) {
  return String(texto ?? '').slice(0, TOPE_TEXTO)
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ' ')
    .replace(/<pasted_content[\s\S]*?<\/pasted_content>/g, ' ')
    // un pegado que el corte de arriba dejo sin su cierre: lo que sigue hasta el final tampoco lo escribio Fak
    .replace(/<(system-reminder|pasted_content)\b[\s\S]*$/, ' ')
    .replace(/"[^"\n]{40,}"/g, ' ')
    .replace(/[A-Za-z]:\\[^\s"]+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Distancia de edicion con trasposicion (tipeo rapido: "entenidste"). */
export function distancia(a, b, tope = 3) {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Senales de correccion de un mensaje: { fuertes, debiles, puntos, largo }. */
export function senales(texto) {
  const t = normalizar(texto);
  const fuertes = FUERTES.filter((f) => f.re.test(t)).map((f) => f.nombre);
  const debiles = DEBILES.filter((f) => f.re.test(t)).map((f) => f.nombre);
  const pal = t.split(/\s+/).filter(Boolean);
  const limpia = (p) => p.replace(/[^a-z0-9ñ]/g, '');
  const dif = CANON.difusos_fuertes;
  if (!fuertes.includes('no_entendiste')) {
    for (let i = 0; i < pal.length; i++) {
      const p = limpia(pal[i]);
      if (p.length < 7 || pal[i].includes('?')) continue;
      if (!dif.formas.some((f) => distancia(p, f, dif.distancia) <= dif.distancia)) continue;
      if (pal.slice(Math.max(0, i - dif.negacion_antes), i).map(limpia).includes('no')) { fuertes.push('no_entendiste'); break; }
    }
  }
  const en = CANON.enojo_difuso;
  const insultos = pal.map(limpia).filter((p) => p.length >= 5 && en.palabras.some((w) => w[0] === p[0] && distancia(p, w, en.distancia) <= en.distancia)).length;
  if (insultos >= 2) fuertes.push('enojo'); else if (insultos === 1) debiles.push('enojo');
  return { fuertes, debiles, puntos: fuertes.length * 2 + debiles.length, largo: t.length };
}

export const esCorreccion = (texto) => { const s = senales(texto); return s.fuertes.length >= 1 || s.debiles.length >= CANON.debiles_para_marcar; };
/** "perfecto gracias" aprueba; "si pero el caño sigue enorme", "listo? yo lo veo igual" no. */
export function esAprobacion(texto) {
  const t = normalizar(texto); const m = t.match(APROBACION);
  return !!m && !ADVERSATIVA.test(t.slice(m[0].length)) && !esCorreccion(texto);
}
/** "abrilo", "pasame la ruta", "cerra la sesion": ni aprueba ni rechaza; el veredicto es el mensaje que sigue. */
export const esNeutro = (texto) => NEUTRO.test(normalizar(texto)) && !esCorreccion(texto);
/**
 * Lo que queda de un mensaje sin los avisos que la app le pega ADELANTE ("<system-reminder>The user started your
 * suggested background task…</system-reminder>" y despues lo que escribio Fak). Medido el 02/10/2026: el hook recibe
 * el mensaje CON ese aviso al principio; 18 mensajes de Fak llegaron asi (10 en los dos primeros dias de octubre)
 * y ningun hook de mensajes los vio, porque el mensaje entero se tomaba por automatico. Entre ellos, el del
 * incidente de explicar-mejor (61a9a9ac, 02/10 14:16).
 */
const AVISOS_ADELANTE = /^(\s*<system-reminder>[\s\S]*?<\/system-reminder>)+/;
export const sinAvisosAdelante = (texto) => {
  const crudo = String(texto ?? ''); const t = crudo.replace(AVISOS_ADELANTE, '');
  return t.length === crudo.length ? crudo : t.replace(/^\s+/, '');      // sin aviso adelante el mensaje queda como vino
};
const NO_ES_DE_FAK = new RegExp(`^\\s*(${CANON.no_es_de_fak.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i');
/** Aviso automatico (fin de agente, hook, otra sesion, resumen de un compactado) que llega como turno de usuario:
 *  no son palabras de Fak. La lista vive en el canon (`no_es_de_fak`). Un mensaje de Fak con un aviso de la app
 *  adelante NO es automatico; uno que es solo avisos, si. */
export const esAutomatico = (texto) => {
  const crudo = String(texto ?? ''); const t = sinAvisosAdelante(crudo);
  if (!t.trim()) return crudo.trim().length > 0;
  return NO_ES_DE_FAK.test(t);
};

const corta = (s, n) => { const u = String(s ?? '').replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ' ').replace(/\s+/g, ' ').trim(); return u.length > n ? `${u.slice(0, n)}…` : u; };

/**
 * Carpeta del entregable llevada a algo estable. Lo de `_trabajo\`, `.claude\`, `v2\`, `renders\` cuenta como su
 * carpeta madre. Devuelve '' si la carpeta es generica (scratchpad, Escritorio, Descargas, raiz de un disco): ahi
 * conviven entregables que no tienen nada que ver y contarlos juntos daria avisos falsos.
 */
export function claveDe(archivo) {
  let partes = String(archivo ?? '').replace(/\\/g, '/').toLowerCase().split('/').filter(Boolean).slice(0, -1);
  const corte = partes.findIndex((p) => p === '_trabajo' || p === '.claude');
  if (corte >= 0) partes = partes.slice(0, corte);
  while (partes.length && VERSION.test(partes[partes.length - 1])) partes = partes.slice(0, -1);
  if (partes.length < 2 || GENERICA.test(partes[partes.length - 1])) return '';
  return partes.slice(-3).join('/');
}

const vacio = () => ({ desde: [], pedido: '', abierta: false, n: 0, correcciones: [], turno: 0, carpetas: {}, leido: 0 });
/** Un estado leido del disco puede venir con la forma rota: se sanea campo por campo. */
export function sanear(estado) {
  const b = vacio(); const e = estado && typeof estado === 'object' ? estado : {};
  const carpetas = {};
  if (e.carpetas && typeof e.carpetas === 'object') for (const [k, c] of Object.entries(e.carpetas)) if (c && typeof c === 'object') carpetas[k] = { entregas: Number(c.entregas) || 0, turno: Number.isFinite(c.turno) ? c.turno : -1, pendiente: !!c.pendiente };
  return {
    desde: Array.isArray(e.desde) ? e.desde.map(String).slice(-3) : b.desde,
    pedido: typeof e.pedido === 'string' ? e.pedido : '', abierta: !!e.abierta, n: Number(e.n) || 0,
    correcciones: Array.isArray(e.correcciones) ? e.correcciones.map(String).slice(-4) : [],
    turno: Number(e.turno) || 0, carpetas, leido: Number(e.leido) || 0,
  };
}

const pedidoDe = (desde) => corta(desde.join(' / '), 1500);

/** Se entregaron archivos (SendUserFile). Cuenta UNA entrega por carpeta y por turno de Fak. */
export function registrarEntrega(estado, archivos) {
  const e = sanear(estado);
  const lista = (Array.isArray(archivos) ? archivos : [archivos]).filter((a) => typeof a === 'string' && a);
  const claves = [...new Set(lista.map(claveDe).filter(Boolean))];
  if (!claves.length) return e;
  const nuevas = claves.filter((k) => !e.carpetas[k]);
  // Trabajo NUEVO: carpeta que no estaba en la tanda y, desde la entrega anterior, Fak no corrigio nada y escribio
  // algo del largo de un pedido (una objecion corta sin palabras clave, "porque mide 70 mm?", sigue en la tanda).
  const huboCorreccion = e.desde.some(esCorreccion);
  const parecePedido = e.desde.join(' ').length >= 120;
  if (nuevas.length === claves.length && (!e.abierta || (!huboCorreccion && parecePedido))) {
    e.carpetas = {}; e.n = 0; e.correcciones = [];
    if (e.desde.length || !e.pedido) e.pedido = pedidoDe(e.desde);
  }
  e.abierta = true;
  for (const k of claves) {
    const c = e.carpetas[k] || { entregas: 0, turno: -1, pendiente: false };
    if (c.turno !== e.turno) c.entregas += 1;
    c.turno = e.turno; c.pendiente = true; e.carpetas[k] = c;
  }
  e.desde = [];
  return e;
}

/** Un mensaje de Fak sobre el estado de la sesion. Devuelve { estado, aviso } (aviso = texto a inyectar o null). */
export function paso(estado, texto) {
  const e = sanear(estado);
  if (esAutomatico(texto)) return { estado: e, aviso: null };
  e.turno += 1;
  if (esNeutro(texto)) return { estado: e, aviso: null };                    // el veredicto es el mensaje que sigue
  const s = senales(texto); const corrige = esCorreccion(texto);
  if (esAprobacion(texto)) {                                                 // cierra la tanda
    return { estado: { ...vacio(), turno: e.turno, leido: e.leido, desde: s.largo >= 60 ? [corta(texto, 600)] : [] }, aviso: null };
  }
  const pendientes = Object.entries(e.carpetas).filter(([, c]) => c.pendiente);
  const versiones = pendientes.reduce((m, [, c]) => Math.max(m, c.entregas), 0);
  const carpeta = (pendientes.find(([, c]) => c.entregas === versiones) || [''])[0];
  for (const [, c] of pendientes) c.pendiente = false;
  if (!e.abierta) {
    if (!corrige) { if (s.largo >= 25) e.desde = [...e.desde, corta(texto, 600)].slice(-3); return { estado: e, aviso: null }; }
    e.abierta = true; e.pedido = pedidoDe(e.desde); e.desde = [];            // correccion de algo que se contesto sin archivo
  }
  e.desde = [...e.desde, corta(texto, 600)].slice(-3);
  e.correcciones = [...e.correcciones, corta(texto, 220)].slice(-4);
  if (corrige) e.n += 1;
  const datos = { pedido: e.pedido, correcciones: e.correcciones };
  if (versiones >= 2 && s.puntos >= 1) return { estado: e, aviso: avisoLargo({ ...datos, cabeza: `Ya entregaste ${versiones} versiones de lo mismo (${carpeta}) y Fak todavia no lo dio por bueno.` }) };
  if (corrige && e.n >= 2) return { estado: e, aviso: avisoLargo({ ...datos, cabeza: `Es la correccion N° ${e.n} de Fak sobre el MISMO pedido.` }) };
  if (corrige) return { estado: e, aviso: avisoCorto(e.pedido, 'Fak esta corrigiendo lo que entregaste.') };
  if (versiones >= 2 && s.largo >= 40 && DUDA.test(normalizar(texto))) return { estado: e, aviso: avisoCorto(e.pedido, `Ya entregaste ${versiones} versiones de lo mismo (${carpeta}) y Fak sigue objetando.`) };
  return { estado: e, aviso: null };
}

const citaPedido = (p) => (p ? `«${p}»` : '(no quedo registrado: buscalo arriba en la conversacion, es el mensaje donde Fak pidio este trabajo)');

export function avisoCorto(pedido, cabeza) {
  return [
    `[CORRECCION-GUARD] ${cabeza} Antes de rehacer, relee ENTERO el pedido original, no solo este mensaje:`,
    citaPedido(pedido),
    'Lo que este mensaje no nombra tambien sigue pedido. Si algo de lo pedido no lo encontraste, no lo reemplaces por material parecido: buscalo mejor o deci que no esta.',
  ].join('\n');
}

export function avisoLargo({ pedido, correcciones = [], cabeza }) {
  return [
    `[CORRECCION-GUARD] ${cabeza} Para: no parchees el ultimo reclamo.`,
    `1. Pedido original, textual: ${citaPedido(pedido)}`,
    `2. Lo que Fak dijo despues, en esta tanda: ${correcciones.map((x) => `«${x}»`).join(' · ')}`,
    '3. ANTES de producir nada, escribi al principio de tu respuesta la lista de lo que pide el pedido original (cosa por cosa, con sus palabras) y al lado que parte del entregable lo cumple. Lo que no esta en la lista SE SACA. Lo que falta se busca o se dice que no existe.',
    '4. Lo que no aparece NO se rellena con algo parecido (otra pieza, otro proyecto, otra parte del proceso). Se busca adentro de carpetas de tareas, zips y documentos, con las palabras de planta y no con las tuyas (node scripts/_materialAfuera.mjs lista las fotos y videos que estan fuera de la biblioteca), y recien despues se dice "no hay".',
    '5. Una palabra del pedido se lee por lo que nombra Fak, no por lo que significa en los documentos de la casa ("proceso" de una maquina es la maquina trabajando, no el flujograma).',
  ].join('\n');
}

// ------------------------------------------------------------------ entregas, leidas del transcript
/** Archivos entregados (SendUserFile, sesion principal) en una linea del transcript; [] si no hay. */
export function entregasDeLinea(linea) {
  if (!linea.includes('"SendUserFile"') || linea.includes('"isSidechain":true')) return [];
  let o = null; try { o = JSON.parse(linea); } catch { return []; }
  if (o?.type !== 'assistant' || o.isSidechain) return [];
  const out = [];
  for (const p of o.message?.content ?? []) if (p?.type === 'tool_use' && p.name === 'SendUserFile' && Array.isArray(p.input?.files)) out.push(...p.input.files);
  return out;
}

/** Lee el transcript desde `desdeByte` y devuelve { archivos, hasta }. Solo lineas completas; por tramos de 4 MB. */
export function leerEntregas(ruta, desdeByte = 0) {
  let fd = null;
  try {
    const tam = fs.statSync(ruta).size; let pos = desdeByte > tam ? 0 : desdeByte; let resto = ''; let hasta = pos; const archivos = [];
    fd = fs.openSync(ruta, 'r'); const buf = Buffer.alloc(4 * 1024 * 1024);
    while (pos < tam) {
      const n = fs.readSync(fd, buf, 0, buf.length, pos); if (n <= 0) break;
      const trozo = resto + buf.toString('latin1', 0, n); const corte = trozo.lastIndexOf('\n');
      if (corte >= 0) {
        for (const l of trozo.slice(0, corte).split('\n')) if (l.includes('"SendUserFile"')) archivos.push(...entregasDeLinea(Buffer.from(l, 'latin1').toString('utf8')));
        resto = trozo.slice(corte + 1); hasta = pos + n - Buffer.byteLength(resto, 'latin1');
      } else resto = trozo;
      pos += n;
    }
    return { archivos, hasta };
  } catch { return { archivos: [], hasta: desdeByte }; } finally { if (fd !== null) try { fs.closeSync(fd); } catch { /* nada */ } }
}

// ------------------------------------------------------------------ estado por sesion
const dirEstado = (env = process.env) => path.join(env.CORRECCION_GUARD_DIR || os.tmpdir(), 'claude-correccion-guard');
const archivoDe = (sid, env) => path.join(dirEstado(env), `${String(sid || 'sin-sesion').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)}.json`);
function leerEstado(sid, env) { try { return JSON.parse(fs.readFileSync(archivoDe(sid, env), 'utf8')); } catch { return null; } }
function guardarEstado(sid, e, env) {
  try { fs.mkdirSync(dirEstado(env), { recursive: true }); fs.writeFileSync(archivoDe(sid, env), JSON.stringify(e)); } catch { /* sin permiso: se pierde la cuenta, no el turno */ }
}

/** El hook entero sobre un payload ya parseado. Devuelve el texto a inyectar o null. Nunca tira. */
export function atender(j, env = process.env) {
  if (!j || typeof j !== 'object' || j.agent_id || j.hook_event_name !== 'UserPromptSubmit') return null;
  const sid = typeof j.session_id === 'string' ? j.session_id : '';
  try {
    let e = sanear(leerEstado(sid, env));
    if (typeof j.transcript_path === 'string' && j.transcript_path) {
      const r = leerEntregas(j.transcript_path, e.leido);
      if (r.archivos.length) e = registrarEntrega(e, r.archivos);
      e.leido = r.hasta;
    }
    const r = paso(e, typeof j.prompt === 'string' ? j.prompt : '');
    guardarEstado(sid, r.estado, env);
    return r.aviso;
  } catch { guardarEstado(sid, vacio(), env); return null; }
}

function hook() {
  let raw = '';
  process.stdin.on('data', (d) => { raw += d; });
  process.stdin.on('end', () => {
    let j = null; try { j = JSON.parse(raw); } catch { return; }
    const aviso = atender(j);
    if (aviso) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: aviso } }));
  });
}

function medir(ruta) {
  const filas = fs.readFileSync(ruta, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const porSes = new Map();
  for (const f of filas) { if (!porSes.has(f.ses)) porSes.set(f.ses, []); porSes.get(f.ses).push(f); }
  const cuenta = { mensajes: 0, entregas: 0, cortos: 0, largos: 0 }; const ses = { cortos: new Set(), largos: new Set() }; const muestras = [];
  for (const [id, ms] of porSes) {
    let e = null;
    for (const m of ms) {
      if (m.e) { cuenta.entregas += 1; e = registrarEntrega(e, m.e); continue; }
      cuenta.mensajes += 1;
      const r = paso(e, m.t); e = r.estado;
      if (!r.aviso) continue;
      const largo = /Para: no parchees/.test(r.aviso); const tipo = largo ? 'largos' : 'cortos';
      cuenta[tipo] += 1; ses[tipo].add(id);
      muestras.push(`  [${id}] ${largo ? 'LARGO' : 'corto'} ${/versiones/.test(r.aviso) ? 'por entregas' : 'por palabras'} | ${corta(m.t, 110)}\n        pedido citado: ${corta(e.pedido, 110)}`);
    }
  }
  console.log(`${cuenta.mensajes} mensajes de Fak y ${cuenta.entregas} entregas en ${porSes.size} sesiones`);
  console.log(`avisos cortos: ${cuenta.cortos} en ${ses.cortos.size} sesiones · avisos largos: ${cuenta.largos} en ${ses.largos.size} sesiones`);
  if (process.argv.includes('--muestra')) muestras.forEach((m) => console.log(m));
}

export const CASOS = {
  rojos: [
    'par ano em enteinste croe usbiste las 4 fotos d edescargas la ide aera no repetir no entenidste bien creo',
    'ojo era apb pataognia no te explqiue que explqiues todo el rpeoceos la de lso botones es fea no el apb de taos!!! boludo!!!',
    'no pero seguis haciendo peltoedues loco demeirda enfermo mental ya me tenens cansado me pdiieron fotos de la amquina',
    'esta foto no em gust ay capaz esta demaisado difuso el fondo en las primeras 2 no?',
    'armaste un mail que no te pedi',
  ],
  verdes: [
    'abri el ultimo power piitna ver..',
    'listo queres abrirrlo?',
    'esta s100% seguro del nombre d elas mauqinas sean esos no? de donde los aquaste? manten la evnidenica a amno',
    'progrma ale mail con el ultimo pwoer point par aenviarse mañana 8am podes hacerlo correomcent',
    'el duseño de la empresa pedro ergo me peidido que le pase fotos de la mauqina esa hotprees d einsert y apb busca fotos entendes?',
    'ok dale gracias',
    'corregi el amfe 173, ojo con la op 20',
    'como te dije ayer, ojo con las fechas del cronograma',
    'cual era el codigo que no tenia el precio de lista',
    'siue xacto ese hueco verde en el one y en ambos huecos del cargador en el two no? entendiste?',
    'no quiero que se pierda ese archivo guardalo en la nube',
  ],
  pedido: 'el duseño de la empresa pedro ergo me peidido que le pase fotos de la mauqina esa hotprees d einsert y apb busca fotos uderanet el rpcoeso aparte de las que deje en descargas el em dijoq ue queria de frente y de lejos que sevea bine enterea entendes? y del rpoceso busca videos',
};

function selftest() {
  const { rojos: R, verdes: V, pedido: P } = CASOS; let mal = 0;
  const falla = (m) => { mal += 1; console.log('FALLA:', m); };
  for (const t of R) if (!esCorreccion(t)) falla(`deberia marcar: ${t.slice(0, 60)} ${JSON.stringify(senales(t))}`);
  for (const t of V) if (esCorreccion(t)) falla(`no deberia marcar: ${t.slice(0, 60)} ${JSON.stringify(senales(t))}`);
  // La sesion del 01/10, con sus entregas: biblioteca -> exports -> exports
  const BIB = 'C:\\n\\NOVAX\\INSERT\\MAQUINA HOT PRESS BMA101\\.claude\\retocadas\\1.jpg'; const EXP = 'C:\\Dev\\B\\exports\\FOTOS_HOT_PRESS\\';
  let e = paso(null, P).estado; const av = [];
  e = registrarEntrega(e, [BIB]);
  let r = paso(e, R[0]); e = r.estado; av.push(r.aviso);
  e = registrarEntrega(e, [`${EXP}v1.pptx`, `${EXP}v1.zip`]);
  r = paso(e, R[1]); e = r.estado; av.push(r.aviso);
  e = registrarEntrega(e, [`${EXP}v2.pptx`]);
  r = paso(e, R[2]); e = r.estado; av.push(r.aviso);
  if (!/relee ENTERO/.test(av[0] || '') || !/hotprees/.test(av[0] || '')) falla('1a correccion: aviso corto con el pedido');
  if (!/correccion N° 2/.test(av[1] || '') || !/hotprees/.test(av[1] || '')) falla('2a correccion: aviso largo que cita el PRIMER mensaje, no la 1a correccion');
  if (!/2 versiones/.test(av[2] || '') || !/hotprees/.test(av[2] || '')) falla('3a: aviso por entregas, con el mismo pedido');
  if (paso(e, 'esta s100% seguro del nombre d elas mauqinas sean esos no? de donde los aquaste? manten la evnidenica a amno').estado.pedido !== e.pedido) falla('un mensaje largo en medio de la tanda no pisa el pedido');
  console.log(mal ? `SELFTEST: ${mal} falla(s)` : `SELFTEST OK (${R.length} rojos, ${V.length} verdes, la sesion del 01/10 con sus entregas)`);
  process.exit(mal ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--hook')) hook();
  else if (process.argv.includes('--selftest')) selftest();
  else if (process.argv.includes('--medir')) medir(process.argv[process.argv.indexOf('--medir') + 1]);
  else console.log('uso: --hook | --medir <sesiones.jsonl> [--muestra] | --selftest');
}

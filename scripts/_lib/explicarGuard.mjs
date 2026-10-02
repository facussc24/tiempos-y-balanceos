/**
 * explicarGuard.mjs — cuando Fak dice que no entendio, pide que se lo expliquen o pide corto, le recuerda a Claude
 * que cambie la FORMA de explicar (skill `explicar-mejor`) en vez de repetir lo mismo mas largo. Nunca bloquea.
 *
 * Por que existe (02/10/2026): Fak escribe "no entiendo" o "no entendi" en una de cada siete sesiones, y la respuesta
 * habitual era la misma explicacion con mas detalle ("no entendi un carajo", 01/10, tres tablas con codigos). El
 * 01/10 se probo la escalera del post de Karpathy (texto simple -> dibujo -> pagina -> video) y Fak pidio dejarla
 * fija para cuando alguien pide una explicacion mejor o no entiende.
 *
 * Tres senales, con las palabras y los errores de tipeo de Fak (explicarCanon.data.json):
 *   no_entendi  "no entiendo", "no te entendi un carajo", "noe nteidno", "sigo sin entender"  -> aviso de explicar
 *   explicame   "explicame mejor", "me lo explicas", "explica bien facil"                     -> aviso de explicar
 *   corto       "sintetiza", "mucho texto", "no voy a leer todo eso", "responde breve"        -> aviso de responder corto
 * "entendes?" y "entendiste?" son muletilla: no marcan. Lo que el hook no puede saber es de QUIEN son las palabras
 * ("carlos me dijo: no entiendo") ni si habla de un entregable: por eso el aviso dice cuando no aplica.
 *
 *   node scripts/_lib/explicarGuard.mjs --hook                       # stdin: JSON de UserPromptSubmit
 *   node scripts/_lib/explicarGuard.mjs --medir <jsonl> [--muestra] [--solo <senal>]   # filas {ses,t}
 *   node scripts/_lib/explicarGuard.mjs --selftest
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizar, distancia, esAutomatico } from './correccionGuard.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'explicarCanon.data.json'), 'utf8'));
const NE = CANON.no_entendi;
const EX = CANON.explicame;
const CO = CANON.corto;
const re = (s) => new RegExp(s, 'i');
const NE_REGEX = NE.regex.map(re);
const NEG_PEGADA = new RegExp(NE.negacion_pegada);
const CORTO = CO.regex.map(re);
const SINTETIZA = new RegExp(CO.sintetiza_molde);
const PUNTO = /[.,;:!?]$/;
const limpia = (p) => p.replace(/[^a-zñ]/g, '');
const menor = (p, formas, tope) => formas.reduce((m, f) => Math.min(m, distancia(p, f, tope)), tope + 1);

/**
 * Distancia de la palabra a su forma propia mas cercana. null si no llega a `tope`, si una forma AJENA queda igual
 * de cerca o mas, o si OTRA palabra comun queda mas cerca (un empate con otra palabra se queda: es un tipeo).
 */
function cerca(p, propias, ajenas, otras, tope) {
  const d = menor(p, propias, tope);
  if (d > tope || d >= menor(p, ajenas, tope) || menor(p, otras, tope) < d) return null;
  return d;
}

const esNegacion = (x) => NE.negaciones.includes(x) || (NEG_PEGADA.test(x) && !NE.no_son_negacion.includes(x));
/** Indice de la negacion mas cercana en las `n` palabras de antes; -1 si no hay o si va seguida de coma o punto. */
function negacionAntes(w, crudas, i, n) {
  for (let k = i - 1; k >= Math.max(0, i - n); k--) if (esNegacion(w[k])) return PUNTO.test(crudas[k]) ? -1 : k;
  return -1;
}
const esAuxiliar = (x) => { const tope = x.length >= 6 ? 2 : 1; return x.length >= 4 && menor(x, NE.auxiliares, tope) <= tope; };
const conjugada = (x) => (x.length >= NE.largo_minimo ? cerca(x, NE.conjugadas, NE.ajenas, NE.otras_palabras, NE.tope) : null);

function noEntendi(w, crudas, i) {
  const p = w[i];
  const dC = conjugada(p);
  const dI = p.length >= NE.largo_minimo ? cerca(p, NE.infinitivos, NE.ajenas, NE.otras_palabras, NE.tope) : null;
  const dP = p.length >= NE.largo_minimo ? cerca(p, NE.participios, NE.ajenas, NE.otras_palabras, NE.tope) : null;
  const mejor = Math.min(dC ?? 9, dP ?? 9);
  if (dI !== null && dI < mejor) {                                            // "sin entender", "no termino de entender"
    if (w[i - 1] === 'sin') return true;
    const k = negacionAntes(w, crudas, i, NE.negacion_antes + 1);
    if (k >= 0 && w.slice(k + 1, i).some(esAuxiliar)) return true;
  } else if (dP !== null && (dC === null || dP < dC)) {                       // "no entenido", "no he entendido": negacion pegada
    const k = w[i - 1] === 'he' ? i - 2 : i - 1;
    if (k >= 0 && esNegacion(w[k]) && !PUNTO.test(crudas[k])) return true;
  } else if (dC !== null) {                                                   // "no entiendo", "no te entendi"
    const k = negacionAntes(w, crudas, i, NE.negacion_antes);
    const cortada = k >= 0 && w.slice(k + 1, i).some((x) => NE.cortan.includes(x));       // "no ahora si entiendo"
    const siNoMal = k >= 1 && w[k - 1] === 'si' && w[i + 1] === 'mal';                    // "si no entendi mal..."
    if (k >= 0 && !cortada && !siNoMal) return true;
  }
  if (p.startsWith('no') && conjugada(p.slice(2)) !== null) return true;                   // "noentiendo"
  if (NE.pegadas.includes(w[i - 1]) && conjugada(w[i - 1].slice(2) + p) !== null) return true;   // "noe nteidno"
  return false;
}

function explicame(w, i) {
  const p = w[i];
  if (p.length < 7) return false;
  if (cerca(p, EX.directas, [...EX.ajenas, ...EX.verbos], EX.otras_palabras, EX.tope) !== null) return true;
  const tope = p.length >= 8 ? EX.tope : 1;
  if (cerca(p, EX.verbos, [...EX.ajenas, ...EX.directas], EX.otras_palabras, tope) === null) return false;
  // "gamboa me explica que..." es alguien que le cuenta algo, no un pedido
  const tercera = distancia(p, 'explica', 2) < Math.min(distancia(p, 'explicas', 2), distancia(p, 'explicar', 2));
  if (tercera && w[i + 1] === 'que') return false;
  const me = w.slice(Math.max(0, i - 2), i).includes('me');
  const como = w.slice(i + 1, i + 4).some((x) => !EX.como_no.includes(x) && EX.como.some((c) => distancia(x, c, 1) <= 1));
  return me || como;
}

function corto(w, i) {
  const p = w[i];
  if (p.length >= CO.sintetiza_largo[0] && p.length <= CO.sintetiza_largo[1] && SINTETIZA.test(p)) return true;   // "sintetiza"
  if (distancia(p, 'breve', 1) <= 1) {                                                                             // "responde breve"
    if (CO.breve_antes.includes(w[i - 1])) return true;
    const desde = Math.max(0, i - CO.responde_antes);
    for (let j = desde; j < i; j++) {
      const pegada = j > 0 && w[j - 1].length === 1 ? w[j - 1] + w[j] : w[j];                                      // "r epsodne"
      if ([w[j], pegada].some((x) => x.length >= 6 && menor(x, CO.responde, 2) <= 2)) return true;
    }
  }
  const facil = CO.facil.some((f) => (f.length <= 6 ? p.length <= f.length + 2 && distancia(p.slice(0, f.length), f, 1) <= 1 : distancia(p, f, 2) <= 2));
  if (facil && w.slice(i + 1, i + 1 + CO.facil_despues).some((x) => x.length >= 6 && menor(x, CO.facil_de, 2) <= 2)) return true;   // "facil de entender"
  return false;
}

/** Senales de un mensaje de Fak: subconjunto de ['no_entendi', 'explicame', 'corto']. */
export function senales(texto) {
  const t = normalizar(texto);
  const crudas = t.split(' ').filter((x) => limpia(x));
  const w = crudas.map(limpia);
  const out = new Set();
  for (let i = 0; i < w.length; i++) {
    if (noEntendi(w, crudas, i)) out.add('no_entendi');
    if (explicame(w, i)) out.add('explicame');
    if (corto(w, i)) out.add('corto');
  }
  if (NE_REGEX.some((r) => r.test(t))) out.add('no_entendi');
  if (CORTO.some((r) => r.test(t))) out.add('corto');
  return ['no_entendi', 'explicame', 'corto'].filter((k) => out.has(k));
}

/** El texto a inyectar para un mensaje, o null. Si no entendio Y pide corto, gana el de explicar. */
export function avisoDe(texto) {
  if (esAutomatico(texto)) return null;
  const s = senales(texto);
  if (s.includes('no_entendi') || s.includes('explicame')) return CANON.aviso_explicar.join('\n');
  if (s.includes('corto')) return CANON.aviso_corto.join('\n');
  return null;
}

/** El hook entero sobre un payload ya parseado. Nunca tira. */
export function atender(j) {
  if (!j || typeof j !== 'object' || j.agent_id || j.hook_event_name !== 'UserPromptSubmit') return null;
  try { return avisoDe(typeof j.prompt === 'string' ? j.prompt : ''); } catch { return null; }
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
  const cuenta = { no_entendi: 0, explicame: 0, corto: 0, avisos: 0 }; const ses = new Set(); const todas = new Set(); const muestras = [];
  const sesiones = { no_entendi: new Set(), explicame: new Set(), corto: new Set() };
  const solo = process.argv.includes('--solo') ? process.argv[process.argv.indexOf('--solo') + 1] : null;
  for (const f of filas) {
    todas.add(f.ses);
    if (esAutomatico(f.t)) continue;
    const s = senales(f.t); if (!s.length) continue;
    cuenta.avisos += 1; ses.add(f.ses); for (const k of s) { cuenta[k] += 1; sesiones[k].add(f.ses); }
    if (!solo || s.includes(solo)) muestras.push(`  [${f.ses}] ${s.join('+')} | ${normalizar(f.t).slice(0, 150)}`);
  }
  console.log(`${filas.length} mensajes en ${todas.size} sesiones`);
  console.log(`saltaria en ${cuenta.avisos} mensajes de ${ses.size} sesiones · no_entendi ${cuenta.no_entendi} (${sesiones.no_entendi.size} ses.) · explicame ${cuenta.explicame} (${sesiones.explicame.size} ses.) · corto ${cuenta.corto} (${sesiones.corto.size} ses.)`);
  if (process.argv.includes('--muestra')) muestras.forEach((m) => console.log(m));
}

/**
 * Mensajes con los errores de tipeo de Fak. Los usa el selftest y __tests__/scripts/explicarGuard.test.mjs.
 * Los rojos son todos reales. Los verdes: los primeros son reales; los del final salen de la auditoria del 02/10/2026
 * (frases armadas para atacar el hook, que la primera version marcaba de mas).
 */
export const CASOS = {
  no_entendi: [
    'no te entendi un carajo, no te entendi literalmente nada.',
    'pero noe nteidno como peude ser que haga falta cargar el hilo negro',
    'que carajo es la scp ?? no etneindo?',
    'no entneid nada recuerdo solo eos me pdos dar una mano pro favor',
    'eos noe tnedi? no entendi uncarjao',
    'que putnos quedaron aviertos no entedi',
    'no enteindo sintetiza que hay que ahacer noentiendo',
    'no entenido osea que hay que cargar',
    'no entendio bien que ahcer me perdi',
    'que hago entoence sno entendi',
    'no los corregist eno comprendo porque',
    'sigo sin entender vas re rapido',
    'que hacer osea no temirne ente tnender porque havia falta generar',
    'que carajo osea no temrino de entneder esta repesaod con lso',
    'eso no queda claro',
  ],
  explicame: [
    'me explcais de una forma mas faicl de etnender',
    'el puinto 6 me lo explica smejor? osea suena a cosas demaisdo compeljas',
    'vamos 1 por 1 que carajo pasa con el sensor de la op 41 explicamelo dale a ver?',
    'que va s ahcer si doy luz verde explcia bien faicl',
    'explicame como si no entendiera nada de programacion y fuese medio tonto que logramos hasta ahora',
    'el cc no se reemplaza por tld d o nada que ver explciame eso',
    'me podes explicar que paso',
  ],
  corto: [
    'loco no voy a leer todo eso que mandaste que carajo?... osea pdoes sintteitzar que reomceondas',
    'hmm no vpu a aleer todo eso me da paja',
    'no voy alleer todo eso pa',
    'que apsao sintientiez aloco mucho texto que paso?',
    'resumi se breve osea... que carajo esta pasando',
    'repsnde breve me da paja leerte tanto texto',
    'sisntetniezame',
    'repsodnerme breve ais avanzo',
    'repsonde rapido y breve si o no',
    'r epsodne breve y de una fomra bine facil de entender',
    'dame la info mas facil d etnende rme das muchas talba s',
  ],
  verdes: [
    'pasame el archivo de la bom entendes? asi lo reviso',
    'va en el hueco verde del cargador, no? entendiste?',
    'no etnenedes comoc funciona el rpoceos? osea agarras la estructura le metes la funda',
    'paso a apso con buneas fotos entendes la idea seria explciar el prcoeos con fotos comrpendes',
    'luego explcia como prendaerla que simpemente son con la perilla y el boton',
    'explicales que tranquialmetne le spuedo compartir una carpeta con la base de concimiento',
    'como te explcio que vos en segundo plano manejes arb solo con el tecclado',
    'eso justamente explica por que los informes dicen lbteas',
    'pedro ergo me pdidoio explciciamente que armemos juntos una forma de controlar nuevos usuarios',
    'ah ahora si entiendo, dale avanza',
    'ayuda con mails: redactar y resumir, con mensajes de intro cortos',
    'estoy resumiendo el proyecto entendes',
    'corregi el amfe 173, ojo con la op 20',
    'ok dale gracias',
    'carlos no entiende porque en el arb esta al reves',
    'como una habildiad no la seguis teniendo',
    // --- de la auditoria: un "no" cerca que no niega el entender
    'no, ahora si entiendo, dale segui',
    'ah no, ya entendi, dale avanza',
    'si no entendi mal el amfe va despues del flujograma, no?',
    'esta bien asi no? entiendo que falta el mylar nada mas',
    'no no, entendi perfecto, hacelo',
    // --- infinitivo que no es "no entiendo"
    'no pasa nada, no hace falta entender el codigo, corre el script y listo',
    'hace la hoja simple asi el operario no tiene que entender nada',
    'carlos no va a entender esa tabla, sacale columnas',
    // --- palabras comunes a dos letras
    'el material no esta comprado todavia',
    'no estoy comparando contra el backup',
    'no estamos emitiendo el amfe todavia',
    'no sigas metiendo cosas en esa carpeta',
    'no estoy comrpando nada todavia',
    'de la nota entiendo que hay que subir la revision',
    'replicame eso en los otros amfe de patagonia',
    'aplicame el cambio en el 173 tambien',
    'me podes replicar el cambio en las variantes?',
    'gamboa me explica que el consumo sale del marker',
    'bueno no me lo explqiues pero clarament eno sabes hacerlo',
    'ojo era apb pataognia no te explqiue que explqiues todo el rpeoceos',
    'no lo has entendido, era el apb de patagonia',
    'hackear algo cunado no es verdad entendido',
    'arma un pdf para explicar la mejora del dispositivo al dueno',
    // --- "corto" que no pide una respuesta corta
    'tuve una reunion breve con carlos y quedo aprobado el flujograma',
    'ya resumi los cambios en el mail de ayer',
    'no vas a leer el pdf entero, lee solo la pagina 3',
    'hace el nido mas facil de montar',
    'con el tope queda bien facil de contar las piezas',
    'el vinilo sintetico no llego',
  ],
};

function selftest() {
  let mal = 0; const falla = (m) => { mal += 1; console.log('FALLA:', m); };
  for (const k of ['no_entendi', 'explicame', 'corto']) for (const t of CASOS[k]) if (!senales(t).includes(k)) falla(`deberia marcar ${k}: ${t.slice(0, 70)} -> ${JSON.stringify(senales(t))}`);
  for (const t of CASOS.verdes) if (senales(t).length) falla(`no deberia marcar: ${t.slice(0, 70)} -> ${JSON.stringify(senales(t))}`);
  if (!/explicar-mejor/.test(avisoDe(CASOS.no_entendi[0]) || '')) falla('el aviso de explicar nombra el skill');
  if (!/1 a 4 renglones/.test(avisoDe('sisntetniezame') || '')) falla('"sintetizame" solo -> aviso corto');
  if (!/cambia la FORMA/.test(avisoDe('sigo sin entneder sinteitiz amejore xpclaime emjro') || '')) falla('no entendio y pide corto -> gana el de explicar');
  if (avisoDe('<task-notification>el agente dice: no entendi el pedido</task-notification>') !== null) falla('un aviso automatico no son palabras de Fak');
  const n = CASOS.no_entendi.length + CASOS.explicame.length + CASOS.corto.length;
  console.log(mal ? `SELFTEST: ${mal} falla(s)` : `SELFTEST OK (${n} rojos, ${CASOS.verdes.length} verdes)`);
  process.exit(mal ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--hook')) hook();
  else if (process.argv.includes('--selftest')) selftest();
  else if (process.argv.includes('--medir')) medir(process.argv[process.argv.indexOf('--medir') + 1]);
  else console.log('uso: --hook | --medir <mensajes.jsonl> [--muestra] [--solo no_entendi|explicame|corto] | --selftest');
}

/**
 * explicarGuard.mjs — cuando Fak dice que no entendio, pide que se lo expliquen o pide corto, le recuerda a Claude
 * que cambie la FORMA de explicar (skill `explicar-mejor`) en vez de repetir lo mismo mas largo. Nunca bloquea.
 *
 * Por que existe (02/10/2026): en 38 de 257 sesiones Fak escribio "no entiendo" o "no entendi", y la respuesta
 * habitual era la misma explicacion con mas detalle ("no entendi un carajo", 01/10, tres tablas con codigos). El
 * 01/10 se probo la escalera del post de Karpathy (texto simple -> dibujo -> pagina -> video) y Fak pidio dejarla
 * fija para cuando alguien pide una explicacion mejor o se nota que no entiende.
 *
 * Tres senales, con las palabras y los errores de tipeo de Fak (explicarCanon.data.json):
 *   no_entendi  "no entiendo", "no te entendi un carajo", "noe nteidno"      -> aviso de explicar
 *   explicame   "explicame mejor", "me lo explicas", "explica bien facil"     -> aviso de explicar
 *   corto       "sintetiza", "mucho texto", "no voy a leer todo eso"          -> aviso de responder corto
 * "entendes?" y "entendiste?" son muletilla: no marcan.
 *
 *   node scripts/_lib/explicarGuard.mjs --hook                       # stdin: JSON de UserPromptSubmit
 *   node scripts/_lib/explicarGuard.mjs --medir <jsonl> [--muestra]  # filas {ses,t}: cuanto salta sobre mensajes reales
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
const CORTO = CANON.corto.regex.map((r) => new RegExp(r, 'i'));
const SINTETIZA = new RegExp(CANON.corto.sintetiza_molde);
const limpia = (p) => p.replace(/[^a-zñ]/g, '');
const menor = (p, formas, tope) => formas.reduce((m, f) => Math.min(m, distancia(p, f, tope)), tope + 1);
/** La palabra esta a `tope` o menos de una forma propia, y mas cerca de ella que de cualquier forma ajena. */
const cercana = (p, propias, ajenas, tope) => { const d = menor(p, propias, tope); return d <= tope && d < menor(p, ajenas, tope); };

/** Senales de un mensaje de Fak: subconjunto de ['no_entendi', 'explicame', 'corto']. */
export function senales(texto) {
  const t = normalizar(texto);
  const w = t.split(' ').map(limpia).filter(Boolean);
  const out = new Set();
  for (let i = 0; i < w.length; i++) {
    const p = w[i]; const antes = w[i - 1] || '';
    // --- no entendi
    const propia = (x) => x.length >= NE.largo_minimo && !NE.otras_palabras.includes(x) && cercana(x, NE.propias, NE.ajenas, NE.tope);
    if (propia(p) && w.slice(Math.max(0, i - NE.negacion_antes), i).some((x) => NE.negaciones.includes(x))) out.add('no_entendi');
    else if (p.startsWith('no') && propia(p.slice(2))) out.add('no_entendi');                               // "noentiendo"
    else if (/^no[a-z]{1,2}$/.test(antes) && antes !== 'nos' && propia(antes.slice(2) + p)) out.add('no_entendi'); // "noe nteidno"
    // --- explicame
    if (p.length >= 7 && cercana(p, EX.directas, [...EX.ajenas, ...EX.verbos], EX.tope)) out.add('explicame');
    else if (p.length >= 7 && cercana(p, EX.verbos, [...EX.ajenas, ...EX.directas], p.length >= 8 ? EX.tope : 1)) {
      const me = w.slice(Math.max(0, i - 2), i).includes('me');
      const como = w.slice(i + 1, i + 4).some((x) => EX.como.some((c) => distancia(x, c, 1) <= 1));
      if (me || como) out.add('explicame');
    }
    // --- corto: "sintetiza" en cualquiera de sus tipeos
    if (p.length >= CANON.corto.sintetiza_largo[0] && p.length <= CANON.corto.sintetiza_largo[1] && SINTETIZA.test(p)) out.add('corto');
  }
  if (CORTO.some((r) => r.test(t))) out.add('corto');
  return [...out];
}

/** El texto a inyectar para un mensaje, o null. */
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
  const solo = process.argv.includes('--solo') ? process.argv[process.argv.indexOf('--solo') + 1] : null;
  for (const f of filas) {
    todas.add(f.ses);
    if (esAutomatico(f.t)) continue;
    const s = senales(f.t); if (!s.length) continue;
    cuenta.avisos += 1; ses.add(f.ses); for (const k of s) cuenta[k] += 1;
    if (!solo || s.includes(solo)) muestras.push(`  [${f.ses}] ${s.join('+')} | ${normalizar(f.t).slice(0, 150)}`);
  }
  console.log(`${filas.length} mensajes en ${todas.size} sesiones`);
  console.log(`saltaria en ${cuenta.avisos} mensajes de ${ses.size} sesiones · no_entendi ${cuenta.no_entendi} · explicame ${cuenta.explicame} · corto ${cuenta.corto}`);
  if (process.argv.includes('--muestra')) muestras.forEach((m) => console.log(m));
}

/** Mensajes reales de Fak, con sus errores de tipeo. Los usa el selftest y __tests__/scripts/explicarGuard.test.mjs. */
export const CASOS = {
  no_entendi: [
    'no te entendi un carajo, no te entendi literalmente nada.',
    'pero noe nteidno como peude ser que haga falta cargar el hilo negro',
    'que carajo es la scp ?? no etneindo?',
    'no entneid nada recuerdo solo eos me pdos dar una mano pro favor',
    'eos noe tnedi? no entendi uncarjao',
    'que putnos quedaron aviertos no entedi',
    'no enteindo sintetiza que hay que ahacer noentiendo',
    'como se va a corrar el gancho ese que disenandste no entiendo??? no temrino de comprendel el mecadnismco',
  ],
  explicame: [
    'me explcais de una forma mas faicl de etnender',
    'el puinto 6 me lo explica smejor? osea suena a cosas demaisdo compeljas',
    'vamos 1 por 1 que carajo pasa con el sensor de la op 41 explicamelo dale a ver?',
    'que va s ahcer si doy luz verde explcia bien faicl',
    'explicame como si no entendiera nada de programacion y fuese medio tonto que logramos hasta ahora',
    'el cc no se reemplaza por tld d o nada que ver explciame eso',
  ],
  corto: [
    'loco no voy a leer todo eso que mandaste que carajo?... osea pdoes sintteitzar que reomceondas',
    'hmm no vpu a aleer todo eso me da paja',
    'que apsao sintientiez aloco mucho texto que paso?',
    'resumi se breve osea... que carajo esta pasando',
    'repsnde breve me da paja leerte tanto texto',
    'sisntetniezame',
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
    'no estoy enviando nada todavia ni comprando el material',
  ],
};

function selftest() {
  let mal = 0; const falla = (m) => { mal += 1; console.log('FALLA:', m); };
  for (const k of ['no_entendi', 'explicame', 'corto']) for (const t of CASOS[k]) if (!senales(t).includes(k)) falla(`deberia marcar ${k}: ${t.slice(0, 70)} -> ${JSON.stringify(senales(t))}`);
  for (const t of CASOS.verdes) if (senales(t).length) falla(`no deberia marcar: ${t.slice(0, 70)} -> ${JSON.stringify(senales(t))}`);
  if (!/explicar-mejor/.test(avisoDe(CASOS.no_entendi[0]) || '')) falla('el aviso de explicar nombra el skill');
  if (!/1 a 4 renglones/.test(avisoDe(CASOS.corto[5]) || '')) falla('"sintetizame" solo -> aviso corto');
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

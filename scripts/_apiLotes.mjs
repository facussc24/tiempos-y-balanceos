// Vino del scratchpad de la sesion ae95ec7e (ola por la API, 11/10/2026). Uso: node scripts/_apiLotes.mjs <jobs.json>
// Corre varios pedidos a la API en paralelo (por _apiTarea.mjs) y, si se pide, una síntesis final.
// Uso: node api_lotes.mjs <jobs.json>
//   jobs.json: { "concurrencia": 5, "salidaDir": "...", "jobs": [ { "tarea": "...", "pedido": "x.md", "adjuntos": ["..."], "modelo": "opus", "effort": "high" } ],
//               "sintesis": { "tarea": "...", "pedido": "y.md", "modelo": "opus", "salida": "..." } }
//   Fable (en un job o en la sintesis) solo con "pedidoFable": "Fak dd/mm hh:mm: <lo que dijo>" (api-claude.md §2).
// En modo --auditoria <lista.txt> arma los lotes solo: agrupa los archivos de la lista hasta `kbPorLote` KB por lote.
//
// En BATCH (tanda 5, 17/10/2026; Message Batches, mitad de precio, casi siempre menos de 1 h, vence a las 24 h):
//   node scripts/_apiLotes.mjs <jobs.json> --lote [--esperar-min N]   manda TODOS los jobs en un lote, guarda su id en
//                                     <salidaDir>/_lote.json, espera hasta N min (55) y recoge. Si no termino, queda
//                                     en curso y se recoge despues con:
//   node scripts/_apiLotes.mjs <jobs.json> --recoger [--forzar]        recoge UNA vez (otra vez duplicaria el ledger)
//   ("lote": true en el jobs.json es lo mismo que --lote.) La sintesis no va en lote: se espera mirando.
// Logica y candados en scripts/_lib/apiLotesBatch.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { crearCliente, esperarLote, usd, ErrorApi } from './_lib/claudeApi.mjs';
import { mandarLote, recogerGuardado } from './_lib/apiLotesBatch.mjs';
import { EFFORTS } from './_apiTarea.mjs';

const RAIZ = 'C:/Dev/BarackMercosul';
const args = process.argv.slice(2);
const jobsFile = args[0];
// Para MEDIR el esfuerzo (tanda 5 pieza 2; la salida promedio de un lote de auditoria fue 36.700 tokens, casi todo
// pensamiento): --effort low|medium|high|xhigh pisa el de todos los jobs (la sintesis no), --solo N corre los N
// primeros y --salida-dir <dir> deja la corrida aparte. Sin --effort manda lo del jobs.json (por defecto high).
// El comando para comparar dos lotes en high y en medium: docs/pedidos-api/medir_esfuerzo.md.
const op = { lote: false, recoger: false, forzar: false, esperarMin: 55, effort: null, solo: null, salidaDir: null };
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '--lote') op.lote = true;
  else if (a === '--recoger') op.recoger = true;
  else if (a === '--forzar') op.forzar = true;
  else if (a === '--esperar-min' && i + 1 < args.length) op.esperarMin = Number(args[++i]);
  else if (a === '--effort' && i + 1 < args.length) op.effort = args[++i];
  else if (a === '--solo' && i + 1 < args.length) op.solo = Number(args[++i]);
  else if (a === '--salida-dir' && i + 1 < args.length) op.salidaDir = args[++i];
  else { console.error(`no conozco el argumento ${a}. No hago nada.`); process.exit(2); }
}
if (!jobsFile || !fs.existsSync(jobsFile)) { console.error('uso: node scripts/_apiLotes.mjs <jobs.json> [--lote [--esperar-min N] | --recoger [--forzar]] [--effort low|medium|high|xhigh] [--solo N] [--salida-dir <dir>]'); process.exit(2); }
if (!(op.esperarMin >= 0 && op.esperarMin <= 600)) { console.error('--esperar-min va de 0 a 600'); process.exit(2); }
if (op.effort && !EFFORTS.includes(op.effort)) { console.error(`--effort va con ${EFFORTS.join('|')} (max nunca se pide)`); process.exit(2); }
if (op.solo != null && !(Number.isInteger(op.solo) && op.solo >= 1)) { console.error('--solo va con un entero mayor que 0'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
if (cfg.lote) op.lote = true;
if (op.salidaDir) cfg.salidaDir = op.salidaDir;
fs.mkdirSync(cfg.salidaDir, { recursive: true });

let jobs = cfg.jobs || [];
if (cfg.auditoria) {
  const lista = fs.readFileSync(cfg.auditoria.lista, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
    .filter((f) => fs.existsSync(path.join(RAIZ, f)));
  const kb = cfg.auditoria.kbPorLote || 160;
  const lotes = []; let actual = []; let acum = 0;
  for (const f of lista) {
    const s = fs.statSync(path.join(RAIZ, f)).size / 1024;
    if (actual.length && acum + s > kb) { lotes.push(actual); actual = []; acum = 0; }
    actual.push(f); acum += s;
  }
  if (actual.length) lotes.push(actual);
  const au = cfg.auditoria;
  jobs = lotes.map((adj, i) => ({ tarea: `${au.tarea}-${String(i + 1).padStart(2, '0')}`, pedido: au.pedido, adjuntos: adj, modelo: au.modelo || 'opus', effort: au.effort || 'high', maxTokens: au.maxTokens, guardarCortada: au.guardarCortada, timeoutMin: au.timeoutMin, pedidoFable: au.pedidoFable }));
  // saltarExistentes: los lotes que ya tienen salida en disco no se vuelven a pagar (relanzar solo los que fallaron).
  const todos = jobs.length;
  if (au.saltarExistentes) jobs = jobs.filter((j) => !fs.existsSync(path.join(cfg.salidaDir, `${j.tarea}.md`)));
  console.log(`auditoría: ${lista.length} archivos en ${todos} lotes${au.saltarExistentes ? ` · ${todos - jobs.length} ya en disco · ${jobs.length} a correr` : ''}`);
}
if (op.solo) jobs = jobs.slice(0, op.solo);
if (op.effort) jobs = jobs.map((j) => ({ ...j, effort: op.effort }));
if (op.solo || op.effort) console.log(`medición: ${jobs.length} job(s)${op.effort ? ` en effort ${op.effort}` : ''} · salidas en ${cfg.salidaDir}`);

/** Batch: manda (o solo recoge) y deja en `ok` lo que sirve para la sintesis. Devuelve null si el lote sigue en curso. */
async function enLote() {
  const cliente = crearCliente();
  const tarea = cfg.auditoria?.tarea || path.basename(jobsFile, '.json');
  if (!op.recoger) {
    const { estado, lote: b } = await mandarLote(cliente, { jobs, salidaDir: cfg.salidaDir, raiz: RAIZ, tarea });
    console.log(`lote ${estado.loteId} creado con ${estado.pedidos.length} pedido(s) (mitad de precio) · id guardado en ${path.join(cfg.salidaDir, '_lote.json')}`);
    try {
      await esperarLote(cliente, b, { timeoutMs: op.esperarMin * 60 * 1000 });
    } catch (e) {
      if (e instanceof ErrorApi && e.tipo === 'lote') { console.log(`sigue en curso despues de ${op.esperarMin} min: recogerlo despues con  node scripts/_apiLotes.mjs ${jobsFile} --recoger`); return null; }
      throw e;
    }
  }
  const r = await recogerGuardado(cliente, { salidaDir: cfg.salidaDir, forzar: op.forzar });
  if (r.estado === 'en_curso') { console.log(`lote ${r.loteId} en curso: ${r.aviso}`); return null; }
  for (const f of r.filas) console.log(`${f.id}: ${f.resultado}${f.costoUsd ? ` · ${usd(f.costoUsd)}` : ''} · ${f.detalle}`);
  console.log(`lote ${r.loteId}: ${r.filas.length - r.relanzar.length} de ${r.filas.length} guardados · ${usd(r.costoUsd)} (ya con la mitad)${r.relanzar.length ? ` · para relanzar: ${r.relanzar.join(', ')}` : ''}`);
  return r.filas.filter((f) => f.salida).map((f) => ({ salida: f.salida }));
}

function correr(job) {
  return new Promise((resolve) => {
    const salida = path.join(cfg.salidaDir, `${job.tarea}.md`);
    const a = ['scripts/_apiTarea.mjs', '--tarea', job.tarea, '--pedido', job.pedido, '--salida', salida, '--modelo', job.modelo || 'opus', '--effort', job.effort || 'high', '--timeout-min', String(job.timeoutMin || 25)];
    for (const x of job.adjuntos || []) a.push('--adjunto', x);
    if (job.maxTokens) a.push('--max-tokens', String(job.maxTokens));
    if (job.guardarCortada) a.push('--guardar-cortada');
    if (job.pedidoFable) a.push('--fable-pedido', job.pedidoFable);
    const t0 = Date.now();
    const p = spawn('node', a, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => {
      const costo = (out.match(/costo real \$([\d,.]+)/) || [])[1] || '?';
      console.log(`${job.tarea}: exit ${code} · ${Math.round((Date.now() - t0) / 1000)} s · $${costo} · ${fs.existsSync(salida) ? fs.statSync(salida).size + ' bytes' : 'SIN SALIDA'}${/CORTADA por max_tokens/.test(out) ? ' · ⚠ CORTADA' : ''}`);
      if (code !== 0) console.log('   ' + out.trim().split('\n').slice(-3).join(' | ').slice(0, 400));
      resolve({ job, code, salida, costo });
    });
  });
}

let ok;
if (op.lote || op.recoger) {
  try { ok = await enLote(); } catch (e) { console.error(`Fallo: ${e?.message ?? e}`); process.exit(1); }
  if (!ok) { console.log('FIN (lote en curso: la sintesis corre al recogerlo)'); process.exit(0); }
} else {
  const conc = cfg.concurrencia || 4;
  const cola = [...jobs]; const hechos = [];
  await Promise.all(Array.from({ length: Math.min(conc, cola.length) }, async () => {
    while (cola.length) { const j = cola.shift(); hechos.push(await correr(j)); }
  }));
  // exit 4 = respuesta cortada pero guardada (_apiTarea --guardar-cortada): cuenta como salida, marcada CORTADA en la linea.
  ok = hechos.filter((h) => (h.code === 0 || h.code === 4) && fs.existsSync(h.salida));
  console.log(`lotes: ${hechos.length} · ok: ${ok.length}`);
}

// todosEnDisco: la síntesis adjunta TODOS los lotes que están en disco (los de esta corrida y los de antes), no solo los recién corridos.
const paraSintesis = cfg.sintesis?.todosEnDisco && cfg.auditoria
  ? fs.readdirSync(cfg.salidaDir).filter((f) => f.startsWith(`${cfg.auditoria.tarea}-`) && f.endsWith('.md')).sort().map((f) => ({ salida: path.join(cfg.salidaDir, f) }))
  : ok;
if (cfg.sintesis && paraSintesis.length) {
  const s = cfg.sintesis;
  console.log(`síntesis sobre ${paraSintesis.length} lote(s)`);
  // la sintesis va con Opus por defecto (hasta el 17/10/2026 era Fable: en la ola del 11/10 Fable fue el 55 % del gasto);
  // Fable solo si el jobs.json lo pide con "pedidoFable": la frase de Fak (api-claude.md §2)
  const a = ['scripts/_apiTarea.mjs', '--tarea', s.tarea, '--pedido', s.pedido, '--salida', s.salida, '--modelo', s.modelo || 'opus', '--effort', s.effort || 'high', '--timeout-min', String(s.timeoutMin || 30)];
  if (s.pedidoFable) a.push('--fable-pedido', s.pedidoFable);
  for (const h of paraSintesis) a.push('--adjunto', h.salida);
  for (const x of s.adjuntos || []) a.push('--adjunto', x);
  if (s.maxTokens) a.push('--max-tokens', String(s.maxTokens));
  if (s.guardarCortada) a.push('--guardar-cortada');
  const t0 = Date.now();
  const p = spawn('node', a, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  await new Promise((r) => p.on('close', (code) => { console.log(`síntesis ${s.tarea}: exit ${code} · ${Math.round((Date.now() - t0) / 1000)} s · ${out.trim().split('\n').pop()}`); r(); }));
}
console.log('FIN');

// Vino del scratchpad de la sesion ae95ec7e (ola por la API, 11/10/2026). Uso: node scripts/_apiLotes.mjs <jobs.json>
// Corre varios pedidos a la API en paralelo (por _apiTarea.mjs) y, si se pide, una síntesis final.
// Uso: node api_lotes.mjs <jobs.json>
//   jobs.json: { "concurrencia": 5, "salidaDir": "...", "jobs": [ { "tarea": "...", "pedido": "x.md", "adjuntos": ["..."], "modelo": "opus", "effort": "high" } ],
//               "sintesis": { "tarea": "...", "pedido": "y.md", "modelo": "fable", "salida": "..." } }
// En modo --auditoria <lista.txt> arma los lotes solo: agrupa los archivos de la lista hasta `kbPorLote` KB por lote.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const RAIZ = 'C:/Dev/BarackMercosul';
const args = process.argv.slice(2);
const jobsFile = args[0];
const cfg = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
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
  jobs = lotes.map((adj, i) => ({ tarea: `${au.tarea}-${String(i + 1).padStart(2, '0')}`, pedido: au.pedido, adjuntos: adj, modelo: au.modelo || 'opus', effort: au.effort || 'high', maxTokens: au.maxTokens, guardarCortada: au.guardarCortada, timeoutMin: au.timeoutMin }));
  // saltarExistentes: los lotes que ya tienen salida en disco no se vuelven a pagar (relanzar solo los que fallaron).
  const todos = jobs.length;
  if (au.saltarExistentes) jobs = jobs.filter((j) => !fs.existsSync(path.join(cfg.salidaDir, `${j.tarea}.md`)));
  console.log(`auditoría: ${lista.length} archivos en ${todos} lotes${au.saltarExistentes ? ` · ${todos - jobs.length} ya en disco · ${jobs.length} a correr` : ''}`);
}

function correr(job) {
  return new Promise((resolve) => {
    const salida = path.join(cfg.salidaDir, `${job.tarea}.md`);
    const a = ['scripts/_apiTarea.mjs', '--tarea', job.tarea, '--pedido', job.pedido, '--salida', salida, '--modelo', job.modelo || 'opus', '--effort', job.effort || 'high', '--timeout-min', String(job.timeoutMin || 25)];
    for (const x of job.adjuntos || []) a.push('--adjunto', x);
    if (job.maxTokens) a.push('--max-tokens', String(job.maxTokens));
    if (job.guardarCortada) a.push('--guardar-cortada');
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

const conc = cfg.concurrencia || 4;
const cola = [...jobs]; const hechos = [];
await Promise.all(Array.from({ length: Math.min(conc, cola.length) }, async () => {
  while (cola.length) { const j = cola.shift(); hechos.push(await correr(j)); }
}));
// exit 4 = respuesta cortada pero guardada (_apiTarea --guardar-cortada): cuenta como salida, marcada CORTADA en la linea.
const ok = hechos.filter((h) => (h.code === 0 || h.code === 4) && fs.existsSync(h.salida));
console.log(`lotes: ${hechos.length} · ok: ${ok.length}`);

// todosEnDisco: la síntesis adjunta TODOS los lotes que están en disco (los de esta corrida y los de antes), no solo los recién corridos.
const paraSintesis = cfg.sintesis?.todosEnDisco && cfg.auditoria
  ? fs.readdirSync(cfg.salidaDir).filter((f) => f.startsWith(`${cfg.auditoria.tarea}-`) && f.endsWith('.md')).sort().map((f) => ({ salida: path.join(cfg.salidaDir, f) }))
  : ok;
if (cfg.sintesis && paraSintesis.length) {
  const s = cfg.sintesis;
  console.log(`síntesis sobre ${paraSintesis.length} lote(s)`);
  const a = ['scripts/_apiTarea.mjs', '--tarea', s.tarea, '--pedido', s.pedido, '--salida', s.salida, '--modelo', s.modelo || 'fable', '--effort', s.effort || 'high', '--timeout-min', String(s.timeoutMin || 30)];
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

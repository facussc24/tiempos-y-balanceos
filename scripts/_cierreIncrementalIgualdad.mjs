/**
 * _cierreIncrementalIgualdad.mjs — la prueba que decide C1 (plan P9 §6.2): sobre registros REALES, la lectura de a
 * tramos (`relevarIncremental`) tiene que dar lo mismo que la pasada completa, campo por campo, en cada cierre.
 *
 * Como: cada registro (con sus subagentes) se copia a una carpeta temporal y se lo hace CRECER en `--pasos` tramos,
 * cortando cada archivo en un byte al azar (a mitad de renglon tambien) y haciendo aparecer cada subagente en un paso
 * al azar. En cada paso corren las dos lecturas sobre lo mismo y se comparan. El oraculo NO es el codigo nuevo: es
 * `relevarTranscript` del commit `--base` (git show a un temporal), como pide el plan.
 * Solo lee los registros reales; escribe en el temporal de la PC y lo borra.
 *
 *   node scripts/_cierreIncrementalIgualdad.mjs --base HEAD [--max 20 | 0 = todos] [--pasos 6] [--semilla 1] [--dir <carpeta>]
 *   ... --reales [--cortes 12] [--recientes]   los cortes son los CIERRES de verdad (auditor 12/10/2026): el principal en
 *       cada renglon `stop_hook_summary`, cada subagente en su ultimo renglon con hora <= la de ese cierre
 * Sale con 0 si no hubo ninguna diferencia, 1 si hubo alguna (y las lista), 2 si un argumento esta mal.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REPO } from './_lib/cierreGuard.mjs';
import { relevarIncremental, ultimaLectura } from './_lib/cierreIncremental.mjs';

const argv = process.argv.slice(2);
const arg = (n, def) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const ref = arg('--base', '');
if (!/^[\w.~^/-]+$/.test(ref)) { console.error('Falta --base <commit> (el oraculo)'); process.exit(2); }
const max = Number(arg('--max', '20'));
const pasos = Math.max(2, Number(arg('--pasos', '6')));
let semilla = Number(arg('--semilla', '1')) || 1;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const dirReg = arg('--dir', path.join(os.homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul'));
const reales = argv.includes('--reales');
const maxCortes = Math.max(1, Number(arg('--cortes', '12')));

// [{ fin: byte despues del renglon, ts }] de cada renglon con hora; y en el principal, donde empieza cada cierre
function renglonesConHora(archivo, marca) {
  const buf = fs.readFileSync(archivo); const out = []; const cierres = [];
  let ini = 0;
  while (ini < buf.length) {
    let i = buf.indexOf(0x0a, ini); if (i < 0) i = buf.length;
    const m = buf.indexOf('"timestamp":"', ini);
    if (m >= 0 && m < i) { const ts = Date.parse(buf.toString('utf8', m + 13, m + 37).split('"')[0]); if (Number.isFinite(ts)) out.push({ fin: Math.min(i + 1, buf.length), ts }); }
    if (marca) { const k = buf.indexOf(marca, ini); if (k >= 0 && k < i && m >= 0 && m < i) cierres.push({ ini, ts: out[out.length - 1].ts }); }
    ini = i + 1;
  }
  return { out, cierres };
}
/** Para cada paso, hasta que byte va cada archivo (0 = todavia no aparecio). El ultimo paso: todo. */
function planReal(archivos) {
  const { cierres } = renglonesConHora(archivos[0].orig, '"subtype":"stop_hook_summary"');
  const elegidos = cierres.length <= maxCortes ? cierres : Array.from({ length: maxCortes }, (_, j) => cierres[Math.floor((j + 1) * cierres.length / (maxCortes + 1))]);
  const subs = archivos.slice(1).map((a) => renglonesConHora(a.orig).out);
  const plan = elegidos.map((c) => [c.ini, ...subs.map((rs) => { let h = 0; for (const r of rs) if (r.ts <= c.ts) h = r.fin; return h; })]);
  plan.push(archivos.map((a) => a.tam));
  return { plan, cierres: cierres.length };
}

// lo que se compara: todo lo que devuelve relevarTranscript; los Set van ordenados (su orden no decide nada)
const plano = (r) => JSON.stringify(r, (k, v) => (v instanceof Set ? [...v].sort() : v === Infinity ? 'Infinity' : v));

function diferencia(a, b) {
  const ja = JSON.parse(plano(a)); const jb = JSON.parse(plano(b));
  const campos = [];
  for (const k of new Set([...Object.keys(ja), ...Object.keys(jb)])) if (JSON.stringify(ja[k]) !== JSON.stringify(jb[k])) campos.push(k);
  return campos;
}

const fuente = execFileSync('git', ['show', `${ref}:scripts/_lib/cierreGuard.mjs`], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const tmpOraculo = path.join(REPO, 'scripts', '_lib', `.cierreGuard.oraculo-${process.pid}.mjs`);
fs.writeFileSync(tmpOraculo, fuente);
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-c1-igualdad-'));
const env = { ...process.env, CIERRE_ESTADO_DIR: path.join(raiz, 'estado') };
let rc = 0;
try {
  const oraculo = await import(pathToFileURL(tmpOraculo).href);
  let regs = fs.readdirSync(dirReg).filter((f) => /\.jsonl$/i.test(f)).map((f) => path.join(dirReg, f));
  const orden = argv.includes('--recientes') ? (x) => x.m : (x) => x.s;
  regs = regs.map((f) => ({ f, s: fs.statSync(f).size, m: fs.statSync(f).mtimeMs })).sort((a, b) => orden(b) - orden(a)).map((x) => x.f);
  if (max > 0) regs = regs.slice(0, max);
  let total = 0; let malos = 0; let cortesMedioRenglon = 0; let incrementales = 0;
  for (const [n, reg] of regs.entries()) {
    const nombre = `r${n}`;
    const dst = path.join(raiz, `${nombre}.jsonl`);
    const subOrig = path.join(reg.replace(/\.jsonl$/i, ''), 'subagents');
    let subs = [];
    try { subs = fs.readdirSync(subOrig).filter((f) => /\.jsonl$/i.test(f)); } catch { /* sin subagentes */ }
    const archivos = [{ orig: reg, dst, aparece: 0 }, ...subs.map((f) => ({ orig: path.join(subOrig, f), dst: path.join(raiz, nombre, 'subagents', f), aparece: Math.floor(azar() * pasos) }))];
    for (const a of archivos) { a.tam = fs.statSync(a.orig).size; a.escrito = 0; a.fd = fs.openSync(a.orig, 'r'); }
    let difsReg = 0;
    const real = reales ? planReal(archivos) : null;
    const nPasos = real ? real.plan.length : pasos;
    try {
      for (let p = 0; p < nPasos; p++) {
        for (const [ia, a] of archivos.entries()) {
          if (!real && p < a.aparece) continue;
          if (real && !real.plan[p][ia] && !a.escrito) continue;          // el subagente todavia no existia en ese cierre
          // el ultimo paso llega al final; los otros cortan en un byte al azar del tramo que les toca (o en el cierre real)
          const hasta = real ? Math.max(a.escrito, real.plan[p][ia]) : p === pasos - 1 ? a.tam : Math.min(a.tam, Math.max(a.escrito, Math.floor(a.tam * ((p + azar()) / pasos))));
          fs.mkdirSync(path.dirname(a.dst), { recursive: true });
          const largo = hasta - a.escrito;
          const b = Buffer.alloc(largo);
          if (largo) fs.readSync(a.fd, b, 0, largo, a.escrito);
          fs.appendFileSync(a.dst, b);
          a.escrito = hasta;
          if (largo && b[largo - 1] !== 0x0a) cortesMedioRenglon++;
        }
        const esperado = await oraculo.relevarTranscript(dst, { repo: REPO });
        const obtenido = await relevarIncremental(dst, { repo: REPO, env });
        const u = ultimaLectura();
        if (u.modo === 'incremental') incrementales++;
        total++;
        const d = diferencia(esperado, obtenido);
        if (d.length) { difsReg++; malos++; console.log(`  DIFIERE ${path.basename(reg).slice(0, 8)} paso ${p + 1}/${nPasos} (${u.modo}, ${u.motivo}): ${d.join(', ')}`); }
      }
    } finally { for (const a of archivos) fs.closeSync(a.fd); }
    const mb = archivos.reduce((s, a) => s + a.tam, 0) / 1048576;
    console.log(`${path.basename(reg).slice(0, 8)} ${mb.toFixed(1).padStart(7)} MB ${String(subs.length).padStart(3)} sub  ${difsReg ? `${difsReg} DIFERENCIAS` : 'igual en todos los pasos'}${real ? ` (${nPasos - 1} de ${real.cierres} cierres reales + el final)` : ''}`);
    fs.rmSync(path.join(raiz, nombre), { recursive: true, force: true }); fs.rmSync(dst, { force: true });
  }
  console.log(`\n${regs.length} registros · ${total} cierres simulados (${incrementales} de a tramos, ${cortesMedioRenglon} cortes a mitad de renglon) · ${malos} con diferencias`);
  if (malos) rc = 1;
  if (!reales && incrementales < total - regs.length) { console.log('OJO: hubo cierres que no leyeron de a tramos (ver el motivo): la prueba no ejercito el camino nuevo'); rc = 1; }
} finally {
  try { fs.unlinkSync(tmpOraculo); } catch { /* empieza con punto: se borra a mano */ }
  fs.rmSync(raiz, { recursive: true, force: true });
}
process.exit(rc);

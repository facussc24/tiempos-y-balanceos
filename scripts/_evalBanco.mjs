/**
 * _evalBanco.mjs — corre un banco de casos de resultado con y sin la skill (tanda 9, pieza 4).
 *
 * Por que una carpeta temporal: `claude plugin eval` con el repo entero como complemento se niega («a plugin directory
 * holds more than 20000 entries... point the case at a smaller plugin directory»; corrida del 16/10/2026, 0 de 3). Este
 * script arma, en el temporal, un complemento chico con SOLO las skills del banco, una skill generada con las reglas
 * del banco (en una sesion real cargan siempre; el hijo del eval no las ve) y los casos; corre el eval con
 * `--ablation with-without` (brazo con y brazo sin) y deja el informe.
 *
 *   node scripts/_evalBanco.mjs --banco amfe|mail|todos [--seco] [--runs N] [-j N] [--max-cost-usd X]
 *
 * --seco arma la carpeta y dice que correria, sin correr nada. Sin --seco gasta cupo: cada caso corre `runs` veces
 * por brazo (3 por defecto) y el juez (haiku) vota 3 veces por corrida. `--no-publish` va siempre: los casos traen
 * datos de Barack y el informe no se sube a claude.ai. Escribe solo en el temporal, en evals/results/ (ignorado por
 * git) y el informe en docs/evals/.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
export const MANIFIESTO = path.join(RAIZ, 'evals', 'banco', 'bancos.json');

/** Saca el frontmatter de un markdown (las reglas con `paths:`). */
export const sinFrontmatter = (t) => String(t ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

/** El SKILL.md de la skill generada con las reglas de un banco. */
export function skillDeReglas(nombre, descripcion, textos) {
  const desc = String(descripcion ?? '').replace(/"/g, "'");
  return `---\nname: reglas-${nombre}\ndescription: "${desc}"\n---\n\n${textos.map((t) => sinFrontmatter(t).trim()).join('\n\n---\n\n')}\n`;
}

/** Cambia `runs:` del frontmatter de un prompt.md (o lo deja como esta si no se pide). */
export const conRuns = (prompt, runs) => (runs ? String(prompt).replace(/^runs:\s*\d+\s*$/m, `runs: ${runs}`) : prompt);

/** Arma el complemento chico en `destino`. Devuelve lo que puso (para --seco y para el test). */
export function armarComplemento(nombre, banco, destino, { raiz = RAIZ, runs = null } = {}) {
  fs.mkdirSync(path.join(destino, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(destino, '.claude-plugin', 'plugin.json'), JSON.stringify({
    name: `barack-banco-${nombre}`, version: '0.0.1', description: `Banco de casos ${nombre} (tanda 9)`, skills: './skills', experimental: { evals: 'evals/' },
  }, null, 2));
  const skills = [];
  for (const s of banco.skills || []) { fs.cpSync(path.join(raiz, '.claude', 'skills', s), path.join(destino, 'skills', s), { recursive: true }); skills.push(s); }
  if ((banco.reglas || []).length) {
    const dir = path.join(destino, 'skills', `reglas-${nombre}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), skillDeReglas(nombre, banco.descripcion_reglas, banco.reglas.map((r) => fs.readFileSync(path.join(raiz, r), 'utf8'))));
    skills.push(`reglas-${nombre}`);
  }
  const casos = [];
  for (const c of banco.casos || []) {
    const id = path.basename(c); const dst = path.join(destino, 'evals', id);
    fs.cpSync(path.join(raiz, c), dst, { recursive: true });
    const p = path.join(dst, 'prompt.md');
    if (fs.existsSync(p)) fs.writeFileSync(p, conRuns(fs.readFileSync(p, 'utf8'), runs));
    // indicador de disparo, como evals/export-amfe-dispara. NO lleva ninguna clave «with-only»: el eval marca solo un
    // `tool_used` sobre Skill como indicador que no suma al puntaje (leido en el binario 2.1.301 el 17/10/2026; con
    // `with-only` o `withOnly` el caso no carga: «Unrecognized key(s) in object»).
    fs.writeFileSync(path.join(dst, 'graders', 'zz-se-disparo.md'), '---\ntype: tool_used\ntool: Skill\nmin: 1\n---\n\nIndicador: en el brazo con, ¿se cargo alguna skill del banco?\n');
    casos.push(id);
  }
  return { skills, casos };
}

/** Resume el JSON de `claude plugin eval --json`: por caso, puntaje medio con y sin, pasa y se disparo. */
export function resumir(json, umbral = 0.8) {
  const filas = (json?.cases || []).map((c) => {
    const media = (runs) => (runs && runs.length ? runs.reduce((s, r) => s + (Number(r.score) || 0), 0) / runs.length : null);
    const conR = c.arms?.with || []; const sinR = c.arms?.without || [];
    const disparo = conR.filter((r) => (r.graders || []).some((g) => g.withOnly && g.passed)).length;
    const errores = [...conR, ...sinR].filter((r) => r.error).length;
    const con = media(conR); const sin = media(sinR);
    return { caso: c.name, dir: c.dir, con, sin, delta: con != null && sin != null ? con - sin : null, pasa: con != null && con >= umbral, corridasCon: conR.length, corridasSin: sinR.length, disparo, errores };
  });
  return { filas, costoUsd: json?.costUsd ?? null, segundos: json?.durationSeconds ?? null, aggregates: json?.aggregates ?? null };
}

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)} %`);
export function informe(nombre, r, { fecha, umbral = 0.8, runs } = {}) {
  const L = [`# Banco de casos «${nombre}» — ${fecha}`, ''];
  const pasan = r.filas.filter((f) => f.pasa).length;
  L.push(`**${pasan} de ${r.filas.length} casos pasan el umbral (${pct(umbral)} en el brazo con)** · ${runs ?? 3} corridas por brazo · costo informado ${r.costoUsd ?? '—'} USD · ${r.segundos ?? '—'} s. La primera semana el banco avisa, no frena.`, '');
  L.push('| Caso | Con | Sin | Diferencia | Pasa | Se cargo una skill (corridas con) | Corridas con error |', '|---|---|---|---|---|---|---|');
  for (const f of r.filas) L.push(`| ${f.caso} | ${pct(f.con)} | ${pct(f.sin)} | ${f.delta == null ? '—' : `${f.delta >= 0 ? '+' : ''}${Math.round(f.delta * 100)} pts`} | ${f.pasa ? 'sí' : 'no'} | ${f.disparo} de ${f.corridasCon} | ${f.errores} |`);
  return L.join('\n');
}

function arg(argv, n, def = null) { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; }

function main(argv) {
  const M = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));
  const pedido = arg(argv, '--banco');
  const nombres = pedido === 'todos' ? Object.keys(M.bancos) : pedido && M.bancos[pedido] ? [pedido] : null;
  if (!nombres) { console.log(`uso: --banco ${Object.keys(M.bancos).join('|')}|todos [--seco] [--runs N] [-j N] [--max-cost-usd X]`); return 1; }
  const runs = Number(arg(argv, '--runs')) || null;
  const fecha = new Date().toISOString().slice(0, 10);
  let codigo = 0;
  for (const nombre of nombres) {
    const destino = fs.mkdtempSync(path.join(os.tmpdir(), `evalbanco-${nombre}-`));
    const puesto = armarComplemento(nombre, M.bancos[nombre], destino, { runs });
    console.log(`[${nombre}] complemento chico en ${destino}: skills ${puesto.skills.join(', ') || '(ninguna)'} · ${puesto.casos.length} casos`);
    if (argv.includes('--seco')) continue;
    const dirRes = path.join(RAIZ, 'evals', 'results'); fs.mkdirSync(dirRes, { recursive: true });
    const json = path.join(dirRes, `banco-${nombre}-${fecha}.json`);
    const cmd = ['claude', 'plugin', 'eval', `"${destino}"`, '--ablation', 'with-without', '--no-publish', '--trust-plugin',
      '--max-cost-usd', arg(argv, '--max-cost-usd', '8'), '-j', arg(argv, '-j', '3'), '--json', `"${json}"`].join(' ');
    const r = spawnSync(cmd, { shell: true, encoding: 'utf8', timeout: 3 * 60 * 60 * 1000, windowsHide: true });
    if (!fs.existsSync(json)) { console.log(`[${nombre}] el eval no dejo resultado (salida ${r.status}): ${(r.stderr || r.stdout || '').slice(-400)}`); codigo = 1; continue; }
    const res = resumir(JSON.parse(fs.readFileSync(json, 'utf8')), M.umbral);
    const md = informe(nombre, res, { fecha, umbral: M.umbral, runs: runs ?? 3 });
    const dirInf = path.join(RAIZ, 'docs', 'evals'); fs.mkdirSync(dirInf, { recursive: true });
    fs.writeFileSync(path.join(dirInf, `banco-${nombre}-${fecha}.md`), `${md}\n`);
    console.log(md);
  }
  return codigo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));

#!/usr/bin/env node
/**
 * node scripts/_cerebroLint.mjs [--json] [--sin-globales] [--memoria <dir>]
 *
 * Lint del cerebro (memorias + MEMORY.md + reglas + CLAUDE.md + LECCIONES): wikilinks que no
 * resuelven, memorias sin puntero o punteros fantasma, frontmatter invalido, rutas/reglas/
 * skills/hooks citados que no existen, tablas de reglas de CLAUDE.md desincronizadas,
 * memorias CERRADAS vivas y reglas globales duplicadas. Solo lee. Exit 1 si hay algo ROTO
 * (nivel falta); los avisos no bloquean. Logica y por que: scripts/_lib/cerebroLint.mjs.
 * Lo corre tambien el paso "Cerebro" de node scripts/_cierreSesion.mjs.
 */
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { relevarCerebro, lintCerebro, dirMemoriaDe, resumir } from './_lib/cerebroLint.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

const c = relevarCerebro({
  repo: REPO,
  memoria: arg('--memoria') ?? dirMemoriaDe(REPO),
  globales: argv.includes('--sin-globales') ? null : path.join(os.homedir(), '.claude'),
});
const hallazgos = lintCerebro(c);

if (argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ memorias: c.memorias.length, reglas: c.reglas.length, hallazgos }, null, 1) + '\n');
} else {
  const d = '\x1b[2m', r = '\x1b[31m', y = '\x1b[33m', g = '\x1b[32m', x = '\x1b[0m';
  process.stdout.write(`\nCEREBRO  ${d}${c.memorias.length} memorias · ${c.reglas.length} reglas · MEMORY.md ${(c.indice.bytes / 1024).toFixed(1)} KB / ${c.indice.lineas} lineas${x}\n`);
  const porCheck = {};
  for (const h of hallazgos) (porCheck[h.check] ??= []).push(h);
  for (const [check, hs] of Object.entries(porCheck)) {
    process.stdout.write(`\n  ${check} (${hs.length})\n`);
    for (const h of hs) process.stdout.write(`   ${h.nivel === 'falta' ? `${r}✗` : `${y}⚠`}${x} ${d}${h.archivo}${x}  ${h.detalle}\n`);
  }
  const res = resumir(hallazgos);
  process.stdout.write(`\n${res.estado === 'falta' ? `${r}ROTO` : res.estado === 'aviso' ? `${y}CON AVISOS` : `${g}LIMPIO`}${x}  ${res.detalle.split('\n')[0]}\n\n`);
}
process.exit(hallazgos.some((h) => h.nivel === 'falta') ? 1 : 0);

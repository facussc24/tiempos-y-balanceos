#!/usr/bin/env node
/**
 * Arma las herramientas que necesitan las skills del repo en otra PC, cada una en un .zip, copiando de ESTA PC
 * (sin bajar nada de internet):
 *
 *   repo.zip          el repo en HEAD como caja de herramientas: sin CLAUDE.md, sin las reglas, hooks, agentes ni
 *                     settings de .claude (son de Facundo); con .claude/skills, porque las skills nombran sus archivos
 *   node_modules.zip  las dependencias del repo (las que usan los .mjs: Excel, PDF, el generador de flujogramas)
 *   node.zip          Node.js con npm (la carpeta de Program Files se puede mover)
 *   playwright.zip    el navegador sin ventana con el que se dibujan los flujogramas
 *   python.zip        Python liviano con los paquetes de oficina (armar_python.py)
 *
 *   node tools/claude-area/persona/armar_herramientas.mjs --out <carpeta> [--solo repo,python,...]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(AQUI, '..', '..', '..');
const TAR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const PYTHON = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python313', 'python.exe');
const NODE_DIR = path.dirname(process.execPath);
const PLAYWRIGHT = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');

/** Lo del repo que es de Facundo y no viaja (la skill sigue: las skills nombran sus archivos por ruta del repo). */
export const FUERA_DEL_REPO = [
    'CLAUDE.md', 'CLAUDE.equipo.md', '.claude/hooks', '.claude/rules', '.claude/agents', '.claude/commands', '.claude/settings.json',
    '.claude/settings.local.json', '.claude/state', '.claude/agent-memory', 'docs/LECCIONES_APRENDIDAS.md', 'docs/_archive',
    'docs/auto-mejora', 'docs/drafts', 'docs/TUTORIAL*', 'HANDOFF_*', '__tests__', 'evals', 'test-results',
    'tools/claude-area/hola/CLAUDE.md',
];

function args(argv) {
    const a = { solo: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--out') a.out = argv[++i];
        else if (argv[i] === '--solo') a.solo = argv[++i].split(',');
        else throw new Error(`argumento desconocido: ${argv[i]}`);
    }
    if (!a.out) throw new Error('uso: --out <carpeta> [--solo repo,node_modules,node,playwright,python]');
    return a;
}

const tam = (p) => `${(fs.statSync(p).size / 1e6).toFixed(0)} MB`;

export function armarHerramientas({ out, solo = null }) {
    fs.mkdirSync(out, { recursive: true });
    const hacer = (k) => !solo || solo.includes(k);
    const hecho = {};
    if (hacer('repo')) {
        const z = path.join(out, 'repo.zip');
        const excl = FUERA_DEL_REPO.map((p) => `:(exclude)${p}`);
        execFileSync('git', ['-C', REPO, 'archive', '--format=zip', '-o', z, 'HEAD', '--', '.', ...excl], { stdio: 'inherit' });
        hecho.repo = { zip: z, commit: execFileSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD']).toString().trim() };
    }
    if (hacer('node_modules')) {
        const z = path.join(out, 'node_modules.zip');
        execFileSync(TAR, ['-a', '-cf', z, '-C', REPO, 'node_modules'], { stdio: 'inherit' });
        hecho.node_modules = { zip: z };
    }
    if (hacer('node')) {
        const z = path.join(out, 'node.zip');
        execFileSync(TAR, ['-a', '-cf', z, '-C', NODE_DIR, '.'], { stdio: 'inherit' });
        hecho.node = { zip: z, version: process.version };
    }
    if (hacer('playwright')) {
        const dirs = fs.readdirSync(PLAYWRIGHT).filter((d) => /^(chromium_headless_shell|chromium|winldd)-\d+$/.test(d));
        if (!dirs.some((d) => d.startsWith('chromium'))) throw new Error(`no hay navegador de Playwright en ${PLAYWRIGHT}`);
        const z = path.join(out, 'playwright.zip');
        execFileSync(TAR, ['-a', '-cf', z, '-C', PLAYWRIGHT, ...dirs], { stdio: 'inherit' });
        hecho.playwright = { zip: z, carpetas: dirs };
    }
    if (hacer('python')) {
        const z = path.join(out, 'python.zip');
        execFileSync(PYTHON, [path.join(AQUI, 'armar_python.py'), '--out', z], { stdio: 'inherit' });
        hecho.python = { zip: z };
    }
    for (const v of Object.values(hecho)) v.tamano = tam(v.zip);
    const previo = fs.existsSync(path.join(out, 'herramientas.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'herramientas.json'), 'utf8')) : {};
    const todo = { ...previo, ...Object.fromEntries(Object.entries(hecho).map(([k, v]) => [k, { ...v, zip: path.basename(v.zip), armado: new Date().toISOString() }])) };
    fs.writeFileSync(path.join(out, 'herramientas.json'), JSON.stringify(todo, null, 2));
    return todo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const r = armarHerramientas(args(process.argv.slice(2)));
        for (const [k, v] of Object.entries(r)) console.log(`${k.padEnd(13)} ${v.zip.padEnd(18)} ${v.tamano}`);
    } catch (e) { console.error(`ERROR: ${e.message}`); process.exit(2); }
}

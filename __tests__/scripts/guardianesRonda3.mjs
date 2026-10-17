/**
 * Ronda 3 de la tanda 3 (17/10/2026): los casos del auditor a ciegas de la ronda 2, por su id, desde
 * `guardianesRonda3.casos.json` (armado desde sus `casos_r2*.test.mjs`, con las rutas reales y sus parentesis).
 * `r3(id, guardian)` da 2 si ese guardian frena el payload del caso y 0 si lo deja pasar; `esperados` los compara con
 * lo que el auditor escribio antes de correr. Solo JUZGA: no ejecuta nada.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { evaluar } from '../../scripts/_lib/guardianes.mjs';

export const CASOS = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'guardianesRonda3.casos.json'), 'utf8')).casos;

export function caso(id) {
    const c = CASOS.find((x) => x.id === id);
    if (!c) throw new Error(`no esta el caso ${id}`);
    return c;
}

export function r3(id, guardian) {
    const c = caso(id);
    const raw = JSON.stringify({ tool_name: c.tool, tool_input: c.input, session_id: 'ronda3', cwd: 'C:\\Dev\\BarackMercosul' });
    return evaluar(raw, { nombres: [guardian], env: { HOME: os.tmpdir() }, marcar: false, escapes: false }).res.bloqueos.length ? 2 : 0;
}

export function esperados(guardian, ids) {
    for (const id of ids) expect(r3(id, guardian), id).toBe(caso(id).esperado);
}

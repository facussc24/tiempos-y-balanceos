/**
 * El despachador de guardianes para las MCP (tanda 3 del plan del sistema, pieza 10, 16/10/2026). En las DOS direcciones.
 *
 * Condicion previa para instalar cualquier MCP nueva (CATIA, text-to-cad, context-mode): una llamada MCP que escribe,
 * manda o corre algo pasa por los mismos guardianes que Bash/Write (la mira el que corresponda); una que lee, o una
 * interna de la app, no paga el despachador. El molde es mcp-write-gate.sh, que ya miraba Supabase.
 *   1. el matcher de settings.json contra nombres de herramientas reales de esta PC y de MCP tipicas;
 *   2. la traduccion de la entrada (mcpComoHerramienta) y los guardianes por evaluar();
 *   3. el camino real: bash .claude/hooks/_dispatcher.sh con el JSON de la MCP.
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluar, parsear, mcpComoHerramienta } from '../../scripts/_lib/guardianes.mjs';

vi.setConfig({ testTimeout: 60_000 });
const RAIZ = process.cwd();
const settings = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'settings.json'), 'utf8'));
const grupo = settings.hooks.PreToolUse.find((g) => /^\^mcp__/.test(g.matcher) && g.hooks.some((h) => /_dispatcher\.sh/.test(h.command)));
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-desp-'));
fs.mkdirSync(path.join(HOME, '.claude'), { recursive: true });
const ENV = { ...process.env, HOME, TMPDIR: HOME };
const mcp = (tool_name, tool_input) => JSON.stringify({ tool_name, tool_input, session_id: 'test-mcp' });
const frenan = (raw) => evaluar(raw, { env: ENV, marcar: false, escapes: false }).res.bloqueos.map((b) => b.guardian);

describe('pieza 10 — el matcher: escribir, mandar o correr entra; leer y lo interno de la app no', () => {
    it('hay UNA entrada de PreToolUse para las MCP que llama al despachador', () => {
        expect(grupo, 'falta la entrada ^mcp__… en PreToolUse').toBeTruthy();
    });
    const re = () => new RegExp(grupo.matcher);
    it('ROJO (entra al despachador): escribir un archivo, mandar un mail, correr un comando, borrar o mover', () => {
        for (const n of ['mcp__filesystem__write_file', 'mcp__filesystem__edit_file', 'mcp__filesystem__move_file', 'mcp__filesystem__create_directory',
            'mcp__gmail__send_email', 'mcp__outlook__reply_message', 'mcp__terminal__run_in_terminal', 'mcp__catia__save_part', 'mcp__drive__delete_file'])
            expect(re().test(n), n).toBe(true);
    });
    it('VERDE (no paga el despachador): leer, listar, el navegador, las internas de la app y el Supabase (ya lo mira mcp-write-gate)', () => {
        for (const n of ['mcp__filesystem__read_file', 'mcp__filesystem__list_directory', 'mcp__gmail__search_emails',
            'mcp__ccd_turn__update_plan', 'mcp__ccd_turn__wrap_up', 'mcp__ccd_session_mgmt__send_message', 'mcp__ccd_session__start_session',
            'mcp__Claude_Browser__navigate', 'mcp__claude-in-chrome__computer', 'mcp__computer-use__type', 'mcp__visualize__show_widget',
            'mcp__mcp-registry__suggest_connectors', 'mcp__scheduled-tasks__create_scheduled_task',
            'mcp__supabase__execute_sql', 'mcp__supabase__apply_migration', 'Bash', 'Write'])
            expect(re().test(n), n).toBe(false);
    });
});

describe('pieza 10 — la entrada de la MCP se traduce a lo que miran los guardianes', () => {
    it('un command es un Bash; una ruta con contenido, un Write; un mensaje sin archivo no lleva contenido', () => {
        expect(mcpComoHerramienta({ command: 'ls' })).toEqual({ tool: 'Bash', cmd: 'ls', file: '', content: '' });
        expect(mcpComoHerramienta({ path: 'C:/x/a.txt', content: 'hola' })).toEqual({ tool: 'Write', cmd: '', file: 'C:/x/a.txt', content: 'hola' });
        expect(mcpComoHerramienta({ to: 'a@b.com', body: 'hola' })).toEqual({ tool: 'Write', cmd: '', file: '', content: '' });
        const ctx = parsear(mcp('mcp__filesystem__write_file', { path: 'C:/x/a.txt', content: 'hola' }));
        expect([ctx.tool, ctx.file, ctx.mcp]).toEqual(['Write', 'C:/x/a.txt', 'mcp__filesystem__write_file']);
    });
    it('ROJO: la MCP que escribe en la nube personal, borra una carpeta, pone una IA en un documento o manda un mail', () => {
        expect(frenan(mcp('mcp__filesystem__write_file', { path: 'C:\\Users\\FacundoS-PC\\OneDrive - BARACK ARGENTINA SRL\\Documentos\\x.txt', content: 'x' }))).toContain('nube-personal-guard');
        expect(frenan(mcp('mcp__terminal__run_in_terminal', { command: 'rm -rf /c/Dev/BarackMercosul/exports' }))).toContain('borrado-masivo-guard');
        expect(frenan(mcp('mcp__terminal__run_in_terminal', { command: 'touch ~/.claude/.arb-cerrar-ok' }))).toContain('permiso-un-uso-guard');
        expect(frenan(mcp('mcp__filesystem__write_file', { path: 'Y:\\BARACK\\CALIDAD\\x.csv', content: 'CREADO POR: Claude' }))).toContain('firma-ia-guard');
        expect(frenan(mcp('mcp__gmail__send_email', { to: 'carlos@barackmercosul.com', subject: 'x', body: 'y' }))).toContain('mail-guard');
        expect(frenan(mcp('mcp__gmail__send_draft', { id: 'r123' }))).toContain('mail-guard');
    });
    it('VERDE: la MCP que escribe en el repo o el scratchpad, arma un borrador o corre un comando comun', () => {
        expect(frenan(mcp('mcp__filesystem__write_file', { path: 'C:\\Dev\\BarackMercosul\\exports\\x\\notas.txt', content: 'medido el 16/10' }))).toEqual([]);
        expect(frenan(mcp('mcp__gmail__create_draft', { to: 'carlos@barackmercosul.com', body: 'y' }))).toEqual([]);
        expect(frenan(mcp('mcp__terminal__run_in_terminal', { command: 'npm run build' }))).toEqual([]);
        expect(frenan(mcp('mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__update', { ref: { object: 'node', id: 'x' }, payload: 'Elaborado por Claude' }))).toEqual([]);
    });
});

describe('pieza 10 — por el camino real: bash _dispatcher.sh con el JSON de la MCP', () => {
    const despachar = (raw) => {
        const r = spawnSync('bash', [path.join(RAIZ, '.claude', 'hooks', '_dispatcher.sh')], { input: raw, encoding: 'utf8', env: ENV });
        return { exit: r.status, err: r.stderr || '' };
    };
    it('ROJO: un mail por MCP sale con exit 2 y el motivo', () => {
        const r = despachar(mcp('mcp__gmail__send_email', { to: 'x@y.com', body: 'z' }));
        expect(r.exit).toBe(2);
        expect(r.err).toMatch(/MAIL-GUARD/);
    });
    it('VERDE: una escritura comun sale con exit 0 y sin ruido', () => {
        const r = despachar(mcp('mcp__filesystem__write_file', { path: 'C:\\Dev\\BarackMercosul\\exports\\x\\notas.txt', content: 'hola' }));
        expect(r.exit).toBe(0);
        expect(r.err).toBe('');
    });
});

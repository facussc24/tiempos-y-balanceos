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
            'mcp__gmail__send_email', 'mcp__outlook__reply_message', 'mcp__terminal__run_in_terminal', 'mcp__catia__save_part', 'mcp__drive__delete_file',
            // auditor Opus 17/10: mayusculas, guiones y digitos en el nombre, y la MCP de CAD que nombra el plan
            'mcp__gmail__SendEmail', 'mcp__outlook__send-mail', 'mcp__whatsapp__send_message_v2', 'mcp__text-to-cad__generate'])
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
        expect(frenan(mcp('mcp__outlook__send-mail', { to: 'x@y.com' }))).toContain('mail-guard');
    });
    it('ROJO (ronda 2, hallazgo 16): execute(code) de build123d que borra una carpeta del servidor', () => {
        expect(frenan(mcp('mcp__build123d__execute', { code: "import shutil\nshutil.rmtree(r'Y:/Ingenieria/Documentacion Gestion Ingenieria/13. Analisis')" }))).toContain('borrado-masivo-guard');
    });
    it('VERDE (ronda 2, hallazgo 16): execute(code) que modela una pieza pasa, aunque el codigo sea largo', () => {
        const largo = "from build123d import *\n" + 'b = Box(10, 10, 10)\nshow(b, "caja")\n'.repeat(200);
        expect(frenan(mcp('mcp__build123d__execute', { code: largo }))).toEqual([]);
    });
    it('VERDE: la MCP que escribe en el repo o el scratchpad, arma un borrador o corre un comando comun', () => {
        expect(frenan(mcp('mcp__filesystem__write_file', { path: 'C:\\Dev\\BarackMercosul\\exports\\x\\notas.txt', content: 'medido el 16/10' }))).toEqual([]);
        expect(frenan(mcp('mcp__gmail__create_draft', { to: 'carlos@barackmercosul.com', body: 'y' }))).toEqual([]);
        expect(frenan(mcp('mcp__terminal__run_in_terminal', { command: 'npm run build' }))).toEqual([]);
        expect(frenan(mcp('mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__update', { ref: { object: 'node', id: 'x' }, payload: 'Elaborado por Claude' }))).toEqual([]);
    });
});

// Pieza 11 (16/10/2026): onFailure "block" solo en los dos hooks donde dejar pasar es peor que frenar. Lo que hace Claude
// Code con eso esta leido del ejecutable instalado (claude.exe 2.1.299, funciones gUe/hUe/xFt): un hook de COMANDO no
// asincrono con onFailure "block" cuyo resultado es un error no bloqueante (exit distinto de 0 y de 2, o un corte por
// tiempo) pasa a BLOQUEAR, salvo en los eventos Stop, SubagentStop, TaskCompleted y TeammateIdle. Claude Code no se puede
// correr aca: el test fija la configuracion, replica esa regla y mira que un hook roto de verdad caiga en esa clase.
const IGNORA_ONFAILURE = new Set(['Stop', 'SubagentStop', 'TaskCompleted', 'TeammateIdle']);
/** La regla del ejecutable: ¿un hook con este resultado frena la llamada? */
const frenaSegunClaudeCode = (hook, evento, exit, cortado = false) => {
    if (exit === 2) return true;
    if (exit === 0 && !cortado) return false;
    return hook.type === 'command' && hook.onFailure === 'block' && hook.async !== true && !IGNORA_ONFAILURE.has(evento);
};
describe('pieza 11 — onFailure "block": si el hook se rompe, frena (solo en mcp-write-gate y en el despachador de las MCP)', () => {
    const todos = Object.entries(settings.hooks).flatMap(([evento, gs]) => gs.flatMap((g) => g.hooks.map((h) => ({ evento, matcher: g.matcher, h }))));
    it('los dos hooks lo tienen, y ningun otro (el despachador de Bash/Write no: un timeout trabaria todo)', () => {
        const con = todos.filter((x) => x.h.onFailure === 'block').map((x) => `${x.evento} ${x.h.command.match(/hooks\/([\w.-]+)/)[1]} ${x.matcher.slice(0, 7)}`);
        expect(con.sort()).toEqual(['PreToolUse _dispatcher.sh ^mcp__(', 'PreToolUse mcp-write-gate.sh mcp__.*'].sort());
        const principal = todos.find((x) => x.matcher === 'Bash|PowerShell|Write|Edit');
        expect(principal.h.onFailure).toBeUndefined();
    });
    it('ROJO: un hook que no arranca (archivo que falta: bash sale con 127) o que se corta por tiempo, frena', () => {
        const roto = spawnSync('bash', [path.join(RAIZ, '.claude', 'hooks', 'no-existe-mcp-write-gate.sh')], { input: '{}', encoding: 'utf8' });
        expect(roto.status).not.toBe(0);
        expect(roto.status).not.toBe(2);                    // un error NO bloqueante: sin onFailure, la llamada pasaria
        for (const x of todos.filter((y) => y.h.onFailure === 'block')) {
            expect(frenaSegunClaudeCode(x.h, x.evento, roto.status), x.h.command).toBe(true);
            expect(frenaSegunClaudeCode(x.h, x.evento, 0, true), `${x.h.command} cortado por tiempo`).toBe(true);
        }
    });
    it('VERDE: con el hook sano, lo que sale con 0 pasa; y sin onFailure, un hook roto deja pasar (como antes)', () => {
        const gate = todos.find((x) => /mcp-write-gate/.test(x.h.command));
        const r = spawnSync('bash', [path.join(RAIZ, '.claude', 'hooks', 'mcp-write-gate.sh')], { input: mcp('mcp__supabase__execute_sql', { query: 'select 1' }), encoding: 'utf8', env: ENV });
        expect(r.status).toBe(0);
        expect(frenaSegunClaudeCode(gate.h, gate.evento, r.status)).toBe(false);
        expect(frenaSegunClaudeCode({ type: 'command' }, 'PreToolUse', 127)).toBe(false);
        expect(frenaSegunClaudeCode(gate.h, 'Stop', 127)).toBe(false);
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

// Tanda 15 (18/10/2026): los MCP que nombran los informes del tercer equipo (E y F, 15/10), con los nombres de sus
// herramientas como los dan sus README. Ninguno esta instalado: esto prueba que, el dia que se instalen, lo que escriben
// o corren pasa por los guardianes y lo que solo lee no. Los comandos peligrosos se arman por partes para que el texto
// de este archivo no dispare a los guardianes al escribirlo (LECCIONES 17/10).
const entra = (n) => new RegExp(grupo.matcher).test(n);
const BORRAR = ['rm', '-rf'].join(' ');
const ARBOL = ['shutil', 'rmtree'].join('.');
describe('tanda 15 — los MCP de los informes E y F, con sus nombres reales', () => {
    it('ROJO (entra al despachador): CATIA crea un analisis, Context Mode corre codigo, Outlook clasico manda', () => {
        for (const n of ['mcp__catia__catia_create_analysis_document', 'mcp__context-mode__ctx_execute', 'mcp__outlook-classic__send_email'])
            expect(entra(n), n).toBe(true);
    });
    it('VERDE (no entra): leer en esos mismos MCP', () => {
        for (const n of ['mcp__context-mode__ctx_search', 'mcp__catia__catia_get_part_info', 'mcp__outlook-classic__list_emails'])
            expect(entra(n), n).toBe(false);
    });
    it('ROJO: ctx_execute que borra una carpeta, sea codigo de consola o de python', () => {
        expect(frenan(mcp('mcp__context-mode__ctx_execute', { language: 'shell', code: `${BORRAR} /c/Dev/BarackMercosul/exports` }))).toContain('borrado-masivo-guard');
        expect(frenan(mcp('mcp__context-mode__ctx_execute', { language: 'python', code: `import shutil\n${ARBOL}(r'Y:/Ingenieria/Documentacion Gestion Ingenieria/13. Analisis')` }))).toContain('borrado-masivo-guard');
    });
    it('ROJO: ctx_execute de consola que commitea sin rutas; Outlook clasico que manda un mail', () => {
        expect(frenan(mcp('mcp__context-mode__ctx_execute', { language: 'bash', code: 'git commit -m "x"' }))).toContain('commit-rutas-guard');
        expect(frenan(mcp('mcp__outlook-classic__send_email', { to: 'carlos@barackmercosul.com', subject: 'x', body: 'y' }))).toContain('mail-guard');
    });
    it('ROJO (auditor tanda 15, I1): un python que dice ser «bash» igual se mira como python — build123d ignora el language', () => {
        const listado = "import openpyxl\nwb=openpyxl.Workbook()\nwb.save(r'Y:/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/3- LISTADO/Listado hojas de proceso.xlsx')";
        const mail = ['import win32com.client as w', "o=w.Dispatch('Outlook.Application')", 'm=o.CreateItem(0)', "m.To='carlos@barackmercosul.com'", ['m', 'Send()'].join('.')].join('\n');
        for (const language of ['bash', 'shellscript', 'powershell.exe', undefined]) {
            expect(frenan(mcp('mcp__build123d__execute', { code: listado, ...(language ? { language } : {}) })), String(language)).toContain('apqp-cliente-guard');
            expect(frenan(mcp('mcp__build123d__execute', { code: mail, ...(language ? { language } : {}) })), String(language)).toContain('mail-guard');
        }
    });
    it('ROJO: las otras formas de decir consola (languageId, cmd.exe, bat) tambien miran el comando crudo', () => {
        for (const extra of [{ languageId: 'shellscript' }, { language: 'cmd.exe' }, { language: 'bat' }])
            expect(frenan(mcp('mcp__context-mode__ctx_execute', { code: 'git commit -m "x"', ...extra })), JSON.stringify(extra)).toContain('commit-rutas-guard');
    });
    it('VERDE: ctx_execute que solo lista una carpeta', () => {
        expect(frenan(mcp('mcp__context-mode__ctx_execute', { language: 'shell', code: 'ls -la /c/Dev/BarackMercosul/docs' }))).toEqual([]);
    });
});

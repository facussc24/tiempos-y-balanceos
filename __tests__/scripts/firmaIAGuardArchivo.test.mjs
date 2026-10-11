// __tests__/scripts/firmaIAGuardArchivo.test.mjs
/**
 * firma-ia-guard, el contenido de un Write / Edit (cola HOY-16b): las excepciones de exports/ y el medidor, en las dos
 * direcciones. El contexto se arma en minuscula («write») a proposito: era el unico camino que corria antes de activar la
 * revision en vivo (commit 2 de HOY-16b, activado el 11/10/2026 por decision de la sesion con la medicion de 12 dias;
 * Fak 01:35: «yo no quiero responder nada»). Sigue valiendo, porque el guardian compara sin distinguir mayusculas.
 *
 * Regla: .claude/rules/core-prohibiciones.md §9 · guardian: scripts/_lib/guardianes.mjs · medidor: scripts/_medirFirmaWrite.mjs
 */
import { describe, it, expect, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GUARDIANES, firmaIaEnArchivo, firmaIaEnEscritura } from '../../scripts/_lib/guardianes.mjs';
import { medir, usosDeArchivo, main } from '../../scripts/_medirFirmaWrite.mjs';

const EXP = 'C:\\Dev\\BarackMercosul\\exports';
const NUBE = 'C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\INGENIERIA BARACK (NUNCA BORRAR)';
const ctxW = (file, content) => ({ ok: true, tool: 'Write', toolL: 'write', cmd: '', cmd6: '', file, fileL: file, content, body6: content, raw: '', cwd: '', rescate: null });
const bloquea = (c) => GUARDIANES['firma-ia-guard'](c, { env: {} })?.tipo === 'bloqueo';

describe('firma-ia-guard · HOY-16b: exports/explicaciones y los _trabajo de exports no se revisan', () => {
    const VERDES = [
        ['una pagina que le explica el sistema a Fak', `${EXP}\\explicaciones\\como_anda_el_cierre.html`, '<p>Claude revisa el cierre del turno</p>'],
        ['la misma, con barras normales', 'C:/Dev/BarackMercosul/exports/explicaciones/x.html', 'lo que hace Claude'],
        ['un indice de trabajo de una tarea', `${EXP}\\HO_PATAGONIA_20261005\\_trabajo\\indice.json`, '{"fuente": "notas de Claude"}'],
    ];
    for (const [nombre, f, c] of VERDES) it(`VERDE: ${nombre}`, () => {
        expect(bloquea(ctxW(f, c))).toBe(false);
        expect(firmaIaEnEscritura(c, f)).not.toBeNull();   // sin la excepcion frenaba: el verde lo da la excepcion
    });
    const ROJOS = [
        ['una carpeta que solo EMPIEZA con explicaciones', `${EXP}\\explicaciones_HO\\tabla.csv`, 'fuente: Claude'],
        ['salir con .. desde explicaciones', `${EXP}\\explicaciones\\..\\TIEMPOS\\tabla.csv`, 'fuente: ChatGPT'],
        ['un archivo que se llama _trabajo, no una carpeta', `${EXP}\\HO\\_trabajo_final.csv`, 'hecho con Claude'],
        ['una carpeta que termina en _trabajo', `${EXP}\\HO_trabajo\\a.csv`, 'hecho con Claude'],
        ['un _trabajo en la nube de Ingenieria (lo ve el equipo)', `${NUBE}\\2- PROYECTOS\\_trabajo\\nota.txt`, 'notas de Claude'],
        ['un _trabajo en el servidor', 'Y:\\BARACK\\CALIDAD\\_trabajo\\indice.json', 'notas de Claude'],
        ['un entregable de exports sigue frenando', `${EXP}\\TIEMPOS\\tabla.csv`, 'op;tiempo;fuente\n10;2:47;ChatGPT'],
    ];
    for (const [nombre, f, c] of ROJOS) it(`ROJO: ${nombre}`, () => expect(bloquea(ctxW(f, c))).toBe(true));
    it('ROJO: con el JSON roto la excepcion no vale (red de seguridad, hacia el lado de frenar)', () => {
        const roto = { ok: false, raw: '', rescate: { tool: 'Write', cmd: '', file: `${EXP}\\explicaciones\\x.html`, content: 'Claude explica' } };
        expect(bloquea(roto)).toBe(true);
    });
    it('firmaIaEnArchivo devuelve null en una explicacion y el motivo en un entregable', () => {
        expect(firmaIaEnArchivo('Claude', `${EXP}\\explicaciones\\a.html`)).toBeNull();
        expect(firmaIaEnArchivo('Claude', `${EXP}\\TIEMPOS\\a.csv`)).toMatch(/exports/);
    });
});

describe('_medirFirmaWrite: los registros de los subagentes (<sesion>/subagents/*.jsonl) tambien cuentan (auditor Opus 11/10/2026)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'medir-firma-sub-'));
    const ahora = new Date().toISOString();
    const uso = (name, input) => JSON.stringify({ type: 'assistant', timestamp: ahora, message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name, input }] } });
    fs.writeFileSync(path.join(tmp, 'ses1.jsonl'), uso('Write', { file_path: `${EXP}\\TIEMPOS\\a.csv`, content: 'op;fuente\n10;ChatGPT' }) + '\n');
    fs.mkdirSync(path.join(tmp, 'ses1', 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'ses1', 'subagents', 'agent-1.jsonl'), uso('Write', { file_path: `${EXP}\\TIEMPOS\\b.csv`, content: 'op;fuente\n10;ChatGPT' }) + '\n');
    fs.mkdirSync(path.join(tmp, 'ses2'), { recursive: true });   // una carpeta de sesion sin subagents/ no rompe nada
    it('VERDE: el Write del subagente se cuenta y se ve en la lista; ROJO: sin la carpeta subagents el conteo era 1', () => {
        const r = medir({ carpetas: [tmp], desde: new Date(Date.now() - 86_400_000) });
        expect(r.archivos).toBe(2);
        expect(r.usos).toBe(2);
        expect(r.frenan.map((f) => f.archivo)).toEqual(expect.arrayContaining([expect.stringMatching(/a\.csv$/), expect.stringMatching(/b\.csv$/)]));
        const solo = fs.mkdtempSync(path.join(os.tmpdir(), 'medir-firma-solo-'));
        fs.copyFileSync(path.join(tmp, 'ses1.jsonl'), path.join(solo, 'ses1.jsonl'));
        expect(medir({ carpetas: [solo], desde: new Date(Date.now() - 86_400_000) }).archivos).toBe(1);
    });
});

describe('_medirFirmaWrite: cuenta lo que frenaria, sobre registros de mentira', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'medir-firma-'));
    const vacia = fs.mkdtempSync(path.join(os.tmpdir(), 'medir-firma-vacia-'));
    afterAll(() => { for (const d of [tmp, vacia]) fs.rmSync(d, { recursive: true, force: true }); });
    const ahora = new Date().toISOString();
    const viejo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const uso = (ts, name, input) => JSON.stringify({ type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name, input }] } });
    fs.writeFileSync(path.join(tmp, 'sesion.jsonl'), [
        uso(ahora, 'Write', { file_path: `${EXP}\\TIEMPOS\\tabla.csv`, content: 'op;tiempo;fuente\n10;2:47;ChatGPT' }),
        uso(ahora, 'Write', { file_path: `${EXP}\\explicaciones\\p.html`, content: 'Claude explica' }),
        uso(ahora, 'Edit', { file_path: 'C:\\Dev\\BarackMercosul\\scripts\\_x.py', old_string: 'a', new_string: 'const x = 1' }),
        uso(viejo, 'Write', { file_path: `${EXP}\\TIEMPOS\\b.csv`, content: 'ChatGPT' }),
        uso(ahora, 'Read', { file_path: `${EXP}\\TIEMPOS\\tabla.csv` }),
        JSON.stringify({ type: 'user', timestamp: ahora, message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } }),
        '{"message": {"content": [{"type":"tool_use"',
    ].join('\n'));
    const desde = new Date(Date.now() - 12 * 86_400_000);

    it('VERDE: cuenta los Write/Edit de la ventana, con y sin la excepcion', () => {
        const r = medir({ carpetas: [tmp], desde });
        expect(r.archivos).toBe(1);
        expect(r.saltados).toBe(0);
        expect(r.usos).toBe(3);
        expect(r.frenanSinExcepcion).toBe(2);
        expect(r.frenan).toHaveLength(1);
        expect(r.frenan[0].archivo).toMatch(/TIEMPOS/);
        expect(r.frenan[0].motivo).toMatch(/ChatGPT/);
        expect(r.porCarpeta).toEqual([{ carpeta: `${EXP}\\TIEMPOS`, n: 1 }]);
    });
    it('ROJO: un renglon roto, un Read o un tool_result no son usos', () => {
        expect(usosDeArchivo('{"message": {"content": [')).toEqual([]);
        expect(usosDeArchivo(uso(ahora, 'Read', { file_path: 'x' }))).toEqual([]);
        expect(usosDeArchivo(JSON.stringify({ message: { content: [{ type: 'tool_result' }] } }))).toEqual([]);
    });
    it('CLI: sale con 2 sin registros o con --dias mal, y con 0 y JSON cuando mide', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(main(['--dir', vacia])).toBe(2);
            expect(main(['--dias', '0', '--dir', tmp])).toBe(2);
            expect(main(['--dir', tmp, '--json'])).toBe(0);
            expect(JSON.parse(log.mock.calls.at(-1)[0]).frenan).toHaveLength(1);
        } finally { log.mockRestore(); err.mockRestore(); }
    });
});

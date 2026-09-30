/**
 * `scripts/_refreshArb.mjs` tiene que entender el INSUMOS.TXT con formato de REPORTE.
 *
 * Desde el 28/08/2026 el INSUMOS.TXT de C:\tmp es el "Listado de Insumos BA" impreso (marcos de
 * caracteres, "Hoja N", columnas fijas, sin unidad), no el tabulado. El parser lo leia como
 * tabulado: daba 0 insumos, `.arb-cache/insumos.csv` quedo en 25 bytes (solo la cabecera) y el
 * chequeo "codigo en BOM que no esta en el maestro" marcaba 769 codigos (todos) sin que nadie lo
 * notara (automejora 30/09/2026, frente arb).
 *
 * Se prueba el script REAL (spawn de node, con cwd en una carpeta temporal para que `.arb-cache/`
 * salga ahi y no en el repo) sobre lineas reales recortadas del export del 30/09/2026 y del listado
 * del 28/08: `__tests__/scripts/fixtures/arb_*.TXT`.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(RAIZ, 'scripts', '_refreshArb.mjs');
const FX = path.join(RAIZ, '__tests__', 'scripts', 'fixtures');
// Cada caso lanza python o node (1 a 6 s con la PC cargada): el limite por defecto de 15 s queda justo.
const LIMITE = 90000;
const sinColor = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** Carpeta temporal con los tres exports. `insumos` = nombre del fixture de INSUMOS, o el texto mismo. */
function armar(insumos) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-'));
    fs.copyFileSync(path.join(FX, 'arb_relaciones_muestra.TXT'), path.join(dir, 'RELACIONES.TXT'));
    fs.copyFileSync(path.join(FX, 'arb_articulo_muestra.TXT'), path.join(dir, 'ARTICULO.TXT'));
    if (insumos.endsWith('.TXT')) fs.copyFileSync(path.join(FX, insumos), path.join(dir, 'INSUMOS.TXT'));
    else fs.writeFileSync(path.join(dir, 'INSUMOS.TXT'), insumos, 'latin1');
    return dir;
}

function correr(dir, extra = []) {
    const r = spawnSync('node', [SCRIPT, '--source', dir, ...extra], { cwd: dir, encoding: 'utf8' });
    return { out: sinColor(r.stdout || ''), err: r.stderr || '', code: r.status };
}

/** Desarma pieza por pieza (sin borrado recursivo), como nubeRutas.test.mjs. */
function desarmar(dir) {
    const cache = path.join(dir, '.arb-cache');
    if (fs.existsSync(cache)) {
        for (const f of fs.readdirSync(cache)) fs.unlinkSync(path.join(cache, f));
        fs.rmdirSync(cache);
    }
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    fs.rmdirSync(dir);
}

describe('_refreshArb.mjs con el INSUMOS.TXT impreso (listado)', () => {
    it('--check lee los insumos del reporte (antes daba 0) y dice que la unidad sale de RELACIONES', { timeout: LIMITE }, () => {
        const dir = armar('arb_insumos_listado_muestra.TXT');
        try {
            const { out } = correr(dir, ['--check']);
            expect(out).toMatch(/insumos\s+12\s+\(listado impreso, sin unidad: completada desde RELACIONES para 5\)/);
            expect(out).not.toMatch(/insumos\s+0\b/);
            // los niveles del arbol siguen bien (offset +7)
            expect(out).toMatch(/lineas de BOM\s+18/);
            expect(out).toMatch(/"0":12,"1":5,"2":1/);
            // un solo aviso sobre la falta de unidad, no 7 "insumo sin unidad" sueltos
            expect(out).toMatch(/INSUMOS\.TXT es el listado impreso, sin columna de unidad: 1/);
            expect(out).not.toMatch(/insumo sin unidad:/);
            expect(out).toMatch(/--check: no se escribio nada/);
            expect(fs.existsSync(path.join(dir, '.arb-cache'))).toBe(false);   // --check no escribe
        } finally {
            desarmar(dir);
        }
    });

    it('al escribir, insumos.csv lleva solo los que tienen unidad (una fila vacia taparia la unidad real)', { timeout: LIMITE }, () => {
        const dir = armar('arb_insumos_listado_muestra.TXT');
        try {
            const { code, out } = correr(dir);
            expect(code).toBe(0);
            expect(out).toMatch(/cache actualizado/);
            const filas = fs.readFileSync(path.join(dir, '.arb-cache', 'insumos.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
            expect(filas[0]).toBe('codigo,descripcion,unidad');
            // los 5 codigos del listado que estan en alguna BOM, con la unidad que imprime RELACIONES
            const porCodigo = Object.fromEntries(filas.slice(1).map((l) => [l.split(',')[0], l.slice(l.lastIndexOf(',') + 1)]));
            expect(porCodigo).toEqual({
                '0024764702-FZHE': 'UN',
                '124.602.0228-1': 'MTL',
                'AD-ADNC18': 'BI',
                'COR-002-607-FZH': 'UN',
                'FUN-002-607-FZH': 'UN',
            });
            expect(filas.every((l) => l.slice(l.lastIndexOf(',') + 1).length > 0)).toBe(true);
            const meta = JSON.parse(fs.readFileSync(path.join(dir, '.arb-cache', 'refresh.json'), 'utf8'));
            expect(meta.formato_insumos).toBe('listado');
            expect(meta.conteos.insumos).toBe(12);
            expect(meta.conteos.insumos_con_unidad).toBe(5);
        } finally {
            desarmar(dir);
        }
    });

    it('el INSUMOS tabulado sigue igual que siempre (incluye la fila sin unidad y la marca)', { timeout: LIMITE }, () => {
        const tabulado = [
            'Rubro\tx\tCodigo\tDescripcion\ty\tU.Medida',
            '1 AB-1\t1\tAB-1\tTORNILLO\t\tUN',
            '1 AB-2\t1\tAB-2\tTUERCA\t\t',
        ].join('\r\n') + '\r\n';
        const dir = armar(tabulado);
        try {
            const { out } = correr(dir, ['--check']);
            expect(out).toMatch(/insumos\s+2\s*$/m);            // sin la nota del listado
            expect(out).toMatch(/insumo sin unidad: 1/);        // el aviso de siempre, uno por insumo
            expect(out).not.toMatch(/listado impreso/);
            correr(dir);
            const csv = fs.readFileSync(path.join(dir, '.arb-cache', 'insumos.csv'), 'utf8');
            expect(csv).toContain('AB-2,TUERCA,');              // la fila vacia se conserva en el tabulado
        } finally {
            desarmar(dir);
        }
    });
});

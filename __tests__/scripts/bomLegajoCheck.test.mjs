/**
 * Tests de `scripts/_lib/bomLegajoCheck.mjs` — el aviso de cierre que dice si la BOM ultimo
 * nivel del legajo APQP quedo atras del ultimo cambio de BOM (regla de Fak, 22/09/2026).
 *
 * En las dos direcciones: un control que no puede dar rojo esta tan roto como el que no
 * puede dar verde. Los fixtures son numeros, sin datos de empresa (el repo es publico).
 *
 * Correr:  npx vitest run --pool=threads __tests__/scripts/bomLegajoCheck.test.mjs
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { evaluarBomLegajo, DATOS } from '../../scripts/_lib/bomLegajoCheck.mjs';

const H = 3600 * 1000;
const fam = (familia, ultimaDifusion, ultimoLegajo) => ({ familia, ultimaDifusion, ultimoLegajo });

describe('evaluarBomLegajo', () => {
    it('ROJO: la difusion es posterior a la BOM del legajo', () => {
        const r = evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, 5 * H), fam('B', 1 * H, 2 * H)] });
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('A');
        expect(r.detalle).not.toMatch(/\bB\b/);
    });

    it('ROJO: hay difusion y el legajo no tiene ninguna BOM de esa familia', () => {
        const r = evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, null)] });
        expect(r.estado).toBe('falta');
    });

    it('VERDE: el legajo se genero despues (o en el mismo minuto) que la difusion', () => {
        expect(evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, 10 * H + 5000)] }).estado).toBe('ok');
        expect(evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H + 30000, 10 * H)] }).estado).toBe('ok');
    });

    it('AVISO y no rojo: sin el disco de los legajos no se puede medir', () => {
        const r = evaluarBomLegajo({ legajoAlcanzable: false, familias: [fam('A', 10 * H, null)] });
        expect(r.estado).toBe('aviso');
        expect(r.detalle).toContain('_montarDiscos');
    });

    it('AVISO y no verde: una familia cuya biblioteca no se puede leer no desaparece del control', () => {
        const ciega = { ...fam('B', null, null), bibliotecaExiste: false };
        const r = evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, 11 * H), ciega] });
        expect(r.estado).toBe('aviso');
        expect(r.detalle).toContain('B');
        // y si ademas otra familia esta atrasada, manda el rojo y el aviso viaja en el detalle
        const r2 = evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, 5 * H), ciega] });
        expect(r2.estado).toBe('falta');
        expect(r2.detalle).toContain('B');
    });

    it('NO APLICA: ninguna familia tiene difusion', () => {
        expect(evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', null, null)] }).estado).toBe('no-aplica');
    });
});

describe('bomLegajos.data.json', () => {
    const d = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
    it('cada familia tiene legajo en el casillero 7, carpeta de biblioteca y piezas sin repetir', () => {
        for (const [nombre, f] of Object.entries(d.familias)) {
            expect(f.legajo, nombre).toMatch(/7-Lista de materiales/);
            expect(f.biblioteca, nombre).toBeTruthy();
            expect(f.piezas.length, nombre).toBeGreaterThan(0);
            expect(new Set(f.piezas).size, nombre).toBe(f.piezas.length);
        }
    });
    it('la raiz de la biblioteca no tiene caracteres de control (el escape \\1 ya paso una vez)', () => {
        expect(d.raiz_biblioteca).not.toMatch(/[\u0000-\u001f]/);
    });
});

/**
 * Corre el selftest de `scripts/_lib/tbdImpresion.py` desde la suite, para que CI lo ejecute.
 *
 * tbdImpresion lista los TBD de un PDF antes de imprimirlo (cola P26). Fak, 07/10/2026, con el paquete de hojas
 * de proceso ya impreso: "dice todo TBD". `_imprimir.py` lo llama al lado del chequeo de firma: AVISA, no frena.
 * El selftest arma un PDF en la carpeta temporal y prueba las dos direcciones: TBD en el cuerpo de una hoja de
 * proceso (rojo) y solo en su cajetin (verde: "el TBD del numero de hoja si", Fak 24/09/2026); TBD arriba en una
 * pagina que no es hoja de proceso (rojo: ahi no hay cajetin que eximir); --paginas; un archivo que no abre.
 *
 * Mismo criterio que firmaIASelftest.test.mjs: NUNCA skip si falta python (PyMuPDF esta fijado en deploy.yml).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(RAIZ, 'scripts', '_lib', 'tbdImpresion.py');

describe('tbdImpresion.py --selftest (los TBD se listan antes de imprimir)', () => {
    it('cuerpo de una HO y pagina sin cajetin dan aviso; el cajetin de una HO, no; nunca levanta', () => {
        const out = execFileSync('python', [SCRIPT, '--selftest'], {
            encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 110000,
        });
        expect(out).toContain('selftest tbdImpresion: todo verde');
        expect(out).not.toMatch(/^ {2}MAL/m);
        expect(out).toMatch(/ok {4}ROJO: TBD en el cuerpo de una hoja de proceso/);
        expect(out).toMatch(/ok {4}VERDE: hoja de proceso con TBD solo en el cajetin/);
        expect(out).toMatch(/ok {4}ROJO: TBD arriba en una pagina que NO es hoja de proceso/);
        expect(out).toMatch(/ok {4}avisar: un archivo que no abre se dice y no levanta/);
        expect(out).toMatch(/ok {4}--paginas 3- revisa de la 3 al final/);
        expect(out).toMatch(/ok {4}avisar: dice cuantas paginas no tienen texto/);
        expect((out.match(/^ {2}ok {2}/gm) || []).length).toBeGreaterThanOrEqual(18);
    }, 120000);

    it('_imprimir.py llama al aviso despues del chequeo de firma y antes de convertir o mandar', () => {
        const src = fs.readFileSync(path.join(RAIZ, 'scripts', '_imprimir.py'), 'utf8');
        const firma = src.indexOf("firmaIA.exigir_sin_firma([a.pdf], 'imprimir')");
        const tbd = src.indexOf("tbdImpresion.avisar([a.pdf], a.paginas, 'imprimir')");
        const convierte = src.indexOf('convertir(a.pdf, imp, paginas, pxl)');
        expect(firma).toBeGreaterThan(0);
        expect(tbd).toBeGreaterThan(firma);
        expect(convierte).toBeGreaterThan(tbd);
    });
});

/**
 * Corre el selftest de `_pdfPaginas.py` (el parser de "1,4-6" / "todas") desde la suite, para
 * que CI lo ejecute. No necesita PyMuPDF: el selftest solo prueba la funcion pura
 * `parsear_paginas`, 4 casos que tienen que dar y 3 que tienen que fallar (pagina 0, pagina
 * despues de la ultima, rango al reves).
 *
 * Mismo criterio que mailsSelftest.test.mjs: NUNCA skip si falta python — un test salteado es
 * un verde vacio, y el runner de CI ya instala Python 3.12.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_pdfPaginas.py');

describe('_pdfPaginas.py --selftest', () => {
    it('los 7 casos del parser de paginas pasan', () => {
        const out = execFileSync('python', [SCRIPT, '--selftest'], { encoding: 'utf8' });
        expect(out).toContain('selftest OK (7 casos)');
    });
});

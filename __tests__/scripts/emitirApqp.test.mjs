/**
 * Corre el selftest de `scripts/_emitirApqp.py` desde la suite, para que CI lo ejecute.
 *
 * `_emitirApqp.py` copia un documento controlado (flujograma, AMFE) a Gestion Ingenieria y al
 * legajo APQP del servidor. Es un script que ESCRIBE en un lugar que no es mio, y un dry-run
 * verde no prueba el camino que escribe: el selftest lo ejerce entero contra carpetas
 * temporales — copiar, no tocar lo identico, frenar ante lo distinto, pisar con respaldo,
 * mandar el anterior a Obsoleto, y negarse sin el OK anotado.
 *
 * Mismo criterio que arbExcelSelftest.test.mjs: NUNCA skip si falta python.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_emitirApqp.py');

describe('_emitirApqp.py --selftest (emision de documentos controlados al servidor)', () => {
    it('copia, respeta lo identico, frena ante lo distinto y no emite sin OK', () => {
        const out = execFileSync('python', [SCRIPT, '--selftest'], {
            encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        expect(out).toContain('selftest emitirApqp: todo verde');
        expect(out).not.toMatch(/^ {2}MAL/m);
        // los casos que importan, por nombre: si alguien los borra, este test se entera
        expect(out).toMatch(/ok {3}c\. destino distinto sin bandera -> frena y no toca nada/);
        expect(out).toMatch(/ok {3}d\. --pisar -> reemplaza y deja el respaldo local del anterior/);
        expect(out).toMatch(/ok {3}e\. --reemplazar -> el anterior va a Obsoleto y queda el nuevo/);
        expect(out).toMatch(/ok {6}sin 'ok_de_fak' -> apply frena y no toca nada/);
        // los que agrego la auditoria de cierre del 02/10/2026
        expect(out).toMatch(/ok {6}Rev\.B con --reemplazar -> queda solo la Rev\.B y la Rev\.A va a Obsoleto, en los dos lugares/);
        expect(out).toMatch(/ok {3}i\. existen las dos carpetas candidatas del legajo -> frena y no copia a ninguna/);
        expect(out).toMatch(/ok {6}bandera desconocida junto a --apply -> error y no emite/);
        expect(out).toMatch(/ok {6}tramo del maestro mal escrito -> error y no crea la carpeta/);
        expect((out.match(/^ {2}ok /gm) || []).length).toBeGreaterThanOrEqual(27);
    });
});

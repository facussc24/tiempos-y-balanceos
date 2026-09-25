/**
 * Corre el selftest de `scripts/_lib/respaldoCarga.py` desde la suite, para que CI lo ejecute.
 *
 * `respaldoCarga.py` son los frenos que corren antes de que `_arbCargar.py` o `_arbUnidad.py`
 * escriban en el arb (25/09/2026). Nacen del TPO del Top Roll de Patagonia: el 20/08 se cargo
 * 0,2526 / 1,4 con un 1,4 que ningun papel decia, contra OC de 835 mm, y con el pedido de Carlos
 * del 17/07 (0,270 / 0,2525 ml) sin mirar. El selftest reproduce ese caso y exige ROJO por los
 * tres lados, y exige VERDE para lo bien respaldado (un freno que no puede dar verde esta tan
 * roto como uno que no puede dar rojo).
 *
 * Mismo criterio que arbExcelSelftest.test.mjs: NUNCA skip si falta python — un test salteado
 * es un verde vacio, y el runner de CI ya instala Python 3.12.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_lib', 'respaldoCarga.py');

describe('respaldoCarga.py --selftest (frenos antes de escribir en el arb)', () => {
    it('el caso del 20/08 da rojo por los tres lados y lo respaldado da verde', () => {
        const out = execFileSync('python', [SCRIPT, '--selftest'], {
            encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        expect(out).toContain('selftest respaldoCarga: todo verde');
        expect(out).not.toMatch(/^ {2}MAL/m);
        // los casos que importan, por nombre: si alguien los borra, este test se entera
        expect(out).toMatch(/ok {4}20\/08: el 1,4 sin papel da rojo/);
        expect(out).toMatch(/ok {4}20\/08: 1,4 contra la OC de 835 mm da rojo/);
        expect(out).toMatch(/ok {4}20\/08: el mail de Carlos sin mirar da rojo/);
        expect(out).toMatch(/ok {4}cuenta 1100\/1000\/4 con la foto y el mail de Carlos: verde/);
        expect(out).toMatch(/ok {4}Sansuy 0,1792\/1,4 con OC de 1400 mm: verde/);
        expect(out).toMatch(/ok {4}cita inventada \(no esta en el mail\): rojo/);
        expect((out.match(/^ {2}ok {2}/gm) || []).length).toBeGreaterThanOrEqual(32);
    });
});

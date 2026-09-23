import { describe, it, expect } from 'vitest';
import { calculateAP as apApp } from '../../modules/amfe/apTable';
import { calculateAP as apScripts } from '../../scripts/_lib/amfeIo.mjs';

/**
 * La tabla AP vive dos veces: `modules/amfe/apTable.ts` (la app) y `scripts/_lib/amfeIo.mjs`
 * (los scripts, que no pueden importar .ts). Si una cambia y la otra no, la app y los scripts
 * calculan distinto y el validador marca CAUSE_AP_MISMATCH contra lo que la app guardo.
 * Pasó el 23/09/2026 al pasar a la tabla oficial: este test compara las dos en las 1000
 * combinaciones.
 */
describe('la tabla AP de los scripts es la misma que la de la app', () => {
    it('coinciden en las 1000 combinaciones S/O/D', () => {
        const distintas = [];
        for (let s = 1; s <= 10; s++)
            for (let o = 1; o <= 10; o++)
                for (let d = 1; d <= 10; d++)
                    if (apApp(s, o, d) !== apScripts(s, o, d))
                        distintas.push(`S${s} O${o} D${d}: app=${apApp(s, o, d)} scripts=${apScripts(s, o, d)}`);
        expect(distintas).toEqual([]);
    });
});

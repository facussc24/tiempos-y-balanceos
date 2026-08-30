/**
 * Corre el selftest de `_mails.py` (el detector de sync parcial) desde la suite, para que
 * CI lo ejecute. El selftest no necesita Outlook ni pywin32: es la funcion pura
 * `evaluar_parcial` contra 9 casos sinteticos.
 *
 * Por que existe: la version anterior del detector daba PARCIAL en TODAS las corridas
 * (comparaba la ventana del .ost contra el cache historico entero) — un control que da
 * siempre lo mismo no detecta nada, y este test impide que una regresion lo devuelva a
 * ese estado sin que nadie lo note. Son 9 casos: 3 rotulados ROJO, 2 avisos de ventana
 * achicada, y 4 que tienen que dar OK.
 *
 * Mismo criterio que pdfBomArb.test.mjs: NUNCA skip si falta python — un test salteado
 * es un verde vacio, y el runner de CI ya instala Python 3.12 para pdfBomArb.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_mails.py');

describe('_mails.py --selftest (detector de sync parcial)', () => {
    it('los 9 casos pasan, y el rojo sigue siendo rojo', () => {
        const out = execFileSync('python', [SCRIPT, '--selftest'], { encoding: 'utf8' });
        expect(out).toContain('todo verde');
        expect(out).not.toContain('MAL');
        // Que el rojo siga siendo rojo: 5 veredictos PARCIAL (los 3 casos ROJO + las dos
        // corridas de aviso de "ventana achicada"; la tercera de esas ya acepta base y da OK).
        expect((out.match(/-> PARCIAL/g) ?? []).length).toBe(5);
    });
});

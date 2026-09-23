/**
 * Corre el selftest de `_prepararMail.py` desde la suite, para que CI lo ejecute. Prueba las
 * funciones puras del reemplazo de borradores (22/09/2026): la clave de asunto ignora RE:/RV:/FW:,
 * y un borrador que armo el script se manda a Eliminados solo si sigue en Borradores y nadie lo
 * edito despues (Fak, 21/09/2026: "borra vos los dos borradores duplicados y todos los que esten
 * viejos tambien"). No necesita Outlook ni pywin32.
 *
 * Mismo criterio que mailsSelftest.test.mjs: NUNCA skip si falta python.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_prepararMail.py');

describe('_prepararMail.py --selftest (reemplazo de borradores)', () => {
    it('los 7 casos pasan, incluido el borrador que Fak edito a mano (no se toca)', () => {
        const out = execFileSync('python', [SCRIPT, '--selftest'], { encoding: 'utf8' });
        expect(out).toContain('selftest borradores OK (7 casos)');
        expect(out).not.toContain('MAL');
    });
});

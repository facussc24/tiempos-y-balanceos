/**
 * Corre el selftest de `scripts/_lib/firmaIA.py` desde la suite, para que CI lo ejecute.
 *
 * firmaIA es el detector de "lo hizo Claude o una IA" en un documento (Fak, 08/10/2026: el listado
 * de hojas de proceso decia "Claude" en CREADO POR, tenia una pestaña oculta "_CONTEXTO_CLAUDE" y la
 * marca del complemento "Claude para Excel"). El selftest arma Excel, PowerPoint, Word, PDF y CSV
 * con cada forma de la firma y exige ROJO, y exige VERDE para el trabajo normal (F.Santoro,
 * Jean-Claude, Claudio, "autoria", IA como codigo). Tambien prueba los dos arreglos automaticos.
 *
 * Mismo criterio que respaldoCargaSelftest.test.mjs: NUNCA skip si falta python.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_sinFirmaIA.py');

describe('_sinFirmaIA.py --selftest (ningun documento dice que lo hizo Claude)', () => {
    it('cada forma de la firma da rojo, lo normal da verde y los arreglos dejan el archivo limpio', () => {
        const out = execFileSync('python', [SCRIPT, '--selftest'], {
            encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 170000,
        });
        expect(out).toContain('selftest firmaIA: todo verde');
        expect(out).not.toMatch(/^ {2}MAL/m);
        expect(out).toMatch(/ok {4}08\/10: CREADO POR = Claude en la celda J74/);
        expect(out).toMatch(/ok {4}08\/10: pestaña oculta _CONTEXTO_CLAUDE/);
        expect(out).toMatch(/ok {4}08\/10: marca del complemento Claude para Excel/);
        expect(out).toMatch(/ok {4}PowerPoint: propiedades por defecto de python-pptx/);
        expect(out).toMatch(/ok {4}Jean-Claude es una persona/);
        expect(out).toMatch(/ok {4}saca las 3 partes, el libro abre y queda limpio/);
        expect((out.match(/^ {2}ok {2}/gm) || []).length).toBeGreaterThanOrEqual(27);
    }, 180000);
});

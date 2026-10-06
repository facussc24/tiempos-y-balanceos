/**
 * Corre desde la suite los dos selftest del consumo de material de corte (06/10/2026).
 *
 * Nacen de la microfibra del Upper Trimming: el 31/07 se cargo 0,0724 m2 con el paño y las piezas
 * de una BOM de 2025 y no con la planilla de Mesa de Corte (0,058). Fak: "no cambiamos el consumo
 * sin un excel oficial o una confirmacion oficial... ante la duda le preguntamos a Pablo Gamboa".
 *
 *   - freno 4 de `scripts/_lib/respaldoCarga.py` (BLOQUEANTE antes de escribir en el arb): un
 *     material de corte que cambia de consumo necesita la planilla oficial o un mail de Pablo.
 *   - `scripts/_tizadaVsArb.py`: aviso opcional que compara el arb con la tizada mas nueva.
 *
 * NUNCA skip si falta python: un test salteado es un verde vacio.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts');
const correr = (archivo) => execFileSync('python', [path.join(SCRIPTS, archivo), '--selftest'], {
    encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});

describe('consumo de material de corte: planilla de Mesa de Corte o mail de Pablo Gamboa', () => {
    it('freno 4 de respaldoCarga: el caso del 31/07 da rojo y lo oficial da verde', () => {
        const out = correr(path.join('_lib', 'respaldoCarga.py'));
        expect(out).toContain('selftest respaldoCarga: todo verde');
        expect(out).toMatch(/ok {4}31\/07: el pano y las 29 piezas de la BOM de 2025 dan rojo/);
        expect(out).toMatch(/ok {4}una tizada \.MRK sola da rojo \(puede ser una prueba\)/);
        expect(out).toMatch(/ok {4}con la planilla de Mesa de Corte: verde/);
        expect(out).toMatch(/ok {4}la misma planilla armada adentro del repo: rojo/);
        expect(out).toMatch(/ok {4}con el mail de Pablo Gamboa: verde/);
        expect(out).toMatch(/ok {4}con el mail de otra persona: rojo/);
        expect(out).toMatch(/ok {4}fak: sin nombrar a Pablo: rojo/);
        expect(out).toMatch(/ok {4}fak: con la confirmacion de Pablo: pasa en amarillo/);
        expect(out).toMatch(/ok {4}fila que no cambia el consumo: el freno de corte no salta/);
        expect(out).toMatch(/ok {4}un insumo que no es de corte: el freno de corte no salta/);
    });

    it('_tizadaVsArb: 0,0724 contra la tizada de septiembre avisa y 0,058 contra la de febrero no', () => {
        expect(correr('_tizadaVsArb.py')).toMatch(/selftest OK: 15 casos/);
    });
});

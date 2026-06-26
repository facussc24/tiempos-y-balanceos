/**
 * Tests del candado anti-invento (plan wise-jumping-island, 2026-06-26).
 *
 * Cubre:
 *  A. scanForbidden (lib) — vectores minimos de la regla crear-auditor-nuevo:
 *     1. "hielo seco"            -> forbidden (equipo inexistente)
 *     2. "flexometro"           -> forbidden (espanolismo peninsular)
 *     3. "Inspeccion Humana"    -> warning  (vocabulario Claude)
 *     4. "cada 2 horas"         -> warning  (frecuencia inventada)
 *     5. "Autocontrol con calibre al inicio de turno" -> limpio (0/0)
 *     6. word-boundary: "recoger" NO dispara "coger" (false-positive guard)
 *     7. caso Top Roll real: equipo + frecuencia juntos
 *  B. validateAmfeDoc — un control inventado produce FORBIDDEN_VOCABULARY (critical)
 *  C. diffIssues — un invento NUEVO bloquea; uno pre-existente NO bloquea
 */
import { describe, it, expect } from 'vitest';
import { scanForbidden } from '../../scripts/_lib/forbiddenContent.mjs';
import { validateAmfeDoc, diffIssues } from '../../scripts/_lib/amfeValidator.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// A. scanForbidden (lib)
// ─────────────────────────────────────────────────────────────────────────────

describe('scanForbidden — deteccion de inventos y vocabulario prohibido', () => {
    it('1. "hielo seco" => forbidden (equipo inexistente en Barack)', () => {
        const r = scanForbidden('Limpieza de molde con hielo seco cada turno');
        expect(r.forbidden.map(f => f.term)).toContain('hielo seco');
        expect(r.forbidden.length).toBeGreaterThan(0);
    });

    it('2. "flexometro" => forbidden (espanolismo peninsular)', () => {
        const r = scanForbidden('Medicion de ancho con flexometro');
        expect(r.forbidden.map(f => f.term)).toContain('flexometro');
    });

    it('3. "Inspeccion Humana" => warning (vocabulario Claude), no bloquea', () => {
        const r = scanForbidden('Inspeccion Humana (Visual y Medicion Manual)');
        expect(r.warnings.map(w => w.term)).toContain('inspeccion humana');
        expect(r.forbidden).toHaveLength(0);
    });

    it('4. "cada 2 horas" => warning (frecuencia inventada)', () => {
        const r = scanForbidden('Control dimensional cada 2 horas');
        expect(r.warnings.some(w => w.kind === 'frecuencia inventada')).toBe(true);
        expect(r.forbidden).toHaveLength(0);
    });

    it('5. "Autocontrol con calibre al inicio de turno" => limpio (0/0)', () => {
        const r = scanForbidden('Autocontrol con calibre al inicio de turno');
        expect(r.forbidden).toHaveLength(0);
        expect(r.warnings).toHaveLength(0);
    });

    it('6. word-boundary: "recoger las piezas" NO dispara "coger"', () => {
        const r = scanForbidden('El operador debe recoger las piezas del contenedor');
        expect(r.forbidden).toHaveLength(0);
    });

    it('7. caso Top Roll real: "Medicion por Ultrasonido cada 2 horas" => equipo + frecuencia', () => {
        const r = scanForbidden('Medicion por Ultrasonido cada 2 horas');
        expect(r.forbidden.some(f => /ultrasonido/.test(f.term))).toBe(true);
        expect(r.warnings.some(w => w.kind === 'frecuencia inventada')).toBe(true);
    });

    it('frecuencia legitima "inicio y fin de turno" NO se marca', () => {
        const r = scanForbidden('Verificacion al inicio y fin de turno');
        expect(r.warnings).toHaveLength(0);
        expect(r.forbidden).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// B + C. integracion con el validador (gate runWithValidation)
// ─────────────────────────────────────────────────────────────────────────────

function makeDoc(preventionControl) {
    return {
        operations: [{
            opNumber: '20', operationNumber: '20',
            name: 'INYECCION DE PLASTICO', operationName: 'INYECCION DE PLASTICO',
            focusElementFunction: 'Interno: proveer pieza conforme / Cliente: ensamblar sin interferencia / Usr: confort',
            operationFunction: 'Inyectar la pieza segun parametros validados',
            workElements: [{
                name: 'Inyectora de plastico', type: 'Machine',
                functions: [{
                    description: 'Inyectar controlando presion y temperatura',
                    functionDescription: 'Inyectar controlando presion y temperatura',
                    failures: [{
                        description: 'Pieza incompleta',
                        effectLocal: 'Scrap del material', effectNextLevel: 'Para linea', effectEndUser: 'Falla en campo',
                        causes: [{
                            description: 'Presion de inyeccion baja', cause: 'Presion de inyeccion baja',
                            severity: 6, occurrence: 3, detection: 4, ap: 'M', actionPriority: 'M',
                            preventionControl,
                            detectionControl: 'Autocontrol con calibre',
                        }],
                    }],
                }],
            }],
        }],
    };
}

describe('validateAmfeDoc — candado anti-invento integrado', () => {
    it('B. preventionControl="hielo seco" => issue FORBIDDEN_VOCABULARY critical', () => {
        const res = validateAmfeDoc(makeDoc('Limpieza con hielo seco cada turno'), 'TopRoll', 'AMFE-TEST');
        expect(res.critical.some(i => i.type === 'FORBIDDEN_VOCABULARY')).toBe(true);
    });

    it('B2. control limpio "Dossier + alarmas en panel" => sin FORBIDDEN_VOCABULARY', () => {
        const res = validateAmfeDoc(makeDoc('Dossier + alarmas en panel'), 'TopRoll', 'AMFE-TEST');
        expect(res.critical.some(i => i.type === 'FORBIDDEN_VOCABULARY')).toBe(false);
    });

    it('C. diffIssues: introducir un invento NUEVO se reporta como critical (bloquea apply)', () => {
        const before = validateAmfeDoc(makeDoc('Inspeccion visual 100%'), 'TopRoll', 'AMFE-TEST');
        const after = validateAmfeDoc(makeDoc('Limpieza con hielo seco'), 'TopRoll', 'AMFE-TEST');
        const introduced = diffIssues(before, after);
        expect(introduced.critical.some(i => i.type === 'FORBIDDEN_VOCABULARY')).toBe(true);
    });

    it('C2. diffIssues: invento PRE-EXISTENTE (igual antes y despues) NO bloquea', () => {
        const before = validateAmfeDoc(makeDoc('Limpieza con hielo seco'), 'TopRoll', 'AMFE-TEST');
        const after = validateAmfeDoc(makeDoc('Limpieza con hielo seco'), 'TopRoll', 'AMFE-TEST');
        const introduced = diffIssues(before, after);
        expect(introduced.critical.some(i => i.type === 'FORBIDDEN_VOCABULARY')).toBe(false);
    });
});

/**
 * Tests de los dos checks que salieron de la auditoria externa del 21/08/2026:
 *
 *   CAUSE_AP_MISMATCH (CRITICAL) — el AP declarado tiene que salir de la tabla AIAG-VDA.
 *     54 causas de los 8 AMFE de Patagonia lo tenian mal; las peores SUBdeclaraban riesgo
 *     (S=8 O=4 D=7 declarado M cuando la tabla da H).
 *
 *   CAUSE_S9_SIN_CC (WARNING) — S>=9 sin caracteristica especial. NO asigna nada (las CC
 *     las pone Fak): avisa. El patron real es que la CC se CAE al detallar — la fila
 *     generica vieja conservo su CC y las filas nuevas por material quedaron sin ninguna.
 */
import { describe, it, expect } from 'vitest';
import { validateAmfeDoc } from '../../scripts/_lib/amfeValidator.mjs';

function docConCausa(extra) {
    return {
        operations: [{
            opNumber: '10', operationNumber: '10',
            name: 'RECEPCION DE MATERIALES', operationName: 'RECEPCION DE MATERIALES',
            focusElementFunction: 'Funcion Interna: recibir conforme / Funcion del Cliente: montar sin interferencia / Funcion del Usuario Final: durabilidad',
            operationFunction: 'Recibir y controlar el material segun plan de recepcion',
            workElements: [{
                name: 'Vinilo PVC Titan Black (427VIN014COR01)', type: 'Material',
                functions: [{
                    description: 'Aportar el vinilo conforme a norma',
                    functionDescription: 'Aportar el vinilo conforme a norma',
                    failures: [{
                        description: 'Flamabilidad fuera de lo exigido por TL 1010 VW',
                        effectLocal: 'Scrap del lote', effectNextLevel: 'Para linea del cliente',
                        effectEndUser: 'Riesgo de incendio en cabina',
                        causes: [{
                            description: 'Lote del proveedor fuera de norma',
                            cause: 'Lote del proveedor fuera de norma',
                            preventionControl: 'Certificado del proveedor por lote (P-14)',
                            detectionControl: 'Ensayo de flamabilidad en laboratorio',
                            ...extra,
                        }],
                    }],
                }],
            }],
        }],
    };
}

const tipos = (res, t) => [...res.critical, ...res.warning].filter(i => i.type === t);

describe('CAUSE_AP_MISMATCH — el AP sale de la tabla, no del criterio de quien redacta', () => {
    it('el caso real: S=8 O=4 D=7 declarado M cuando la tabla da H => CRITICAL', () => {
        const res = validateAmfeDoc(docConCausa({ severity: 8, occurrence: 4, detection: 7, ap: 'M', actionPriority: 'M', specialChar: 'CC' }), 'X', 'TEST');
        expect(res.critical.filter(i => i.type === 'CAUSE_AP_MISMATCH')).toHaveLength(1);
    });

    it('sobredeclarar tambien se marca (S=7 O=6 D=3 declarado H, la figura da M)', () => {
        // Figura 3.5-3, banda S 5-8 / O 6-7 / D 2-4 -> M.
        const res = validateAmfeDoc(docConCausa({ severity: 7, occurrence: 6, detection: 3, ap: 'H', actionPriority: 'H' }), 'X', 'TEST');
        expect(res.critical.filter(i => i.type === 'CAUSE_AP_MISMATCH')).toHaveLength(1);
    });

    it('un AP correcto NO se marca', () => {
        const res = validateAmfeDoc(docConCausa({ severity: 8, occurrence: 4, detection: 7, ap: 'H', actionPriority: 'H', optimizationAction: 'Pendiente definicion equipo APQP', specialChar: 'CC' }), 'X', 'TEST');
        expect(res.critical.filter(i => i.type === 'CAUSE_AP_MISMATCH')).toHaveLength(0);
    });

    it('sin S/O/D completos no se evalua (lo cubre CAUSE_MISSING_SOD)', () => {
        const res = validateAmfeDoc(docConCausa({ severity: 8, occurrence: '', detection: 7, ap: 'M', actionPriority: 'M' }), 'X', 'TEST');
        expect(tipos(res, 'CAUSE_AP_MISMATCH')).toHaveLength(0);
    });
});

describe('CAUSE_S9_SIN_CC — avisa cuando la CC se cae al detallar', () => {
    it('S=9 sin specialChar => WARNING (no critical: la CC la asigna Fak)', () => {
        const res = validateAmfeDoc(docConCausa({ severity: 9, occurrence: 3, detection: 4, ap: 'H', actionPriority: 'H', optimizationAction: 'Pendiente definicion equipo APQP', specialChar: '' }), 'X', 'TEST');
        expect(res.warning.filter(i => i.type === 'CAUSE_S9_SIN_CC')).toHaveLength(1);
        expect(res.critical.filter(i => i.type === 'CAUSE_S9_SIN_CC')).toHaveLength(0);
    });

    it('S=9 CON CC declarada no molesta', () => {
        const res = validateAmfeDoc(docConCausa({ severity: 9, occurrence: 3, detection: 4, ap: 'H', actionPriority: 'H', optimizationAction: 'Pendiente definicion equipo APQP', specialChar: 'CC' }), 'X', 'TEST');
        expect(tipos(res, 'CAUSE_S9_SIN_CC')).toHaveLength(0);
    });

    it('S=8 sin CC no dispara (el umbral del manual es 9)', () => {
        const res = validateAmfeDoc(docConCausa({ severity: 8, occurrence: 3, detection: 4, ap: 'M', actionPriority: 'M', specialChar: '' }), 'X', 'TEST');
        expect(tipos(res, 'CAUSE_S9_SIN_CC')).toHaveLength(0);
    });
});

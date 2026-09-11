/**
 * Tests del scorecard "AMFE listo para entregar" (plan wise-jumping-island).
 *
 * Vectores:
 *  1. AMFE completo + header completo            -> LISTO (0 bloqueantes)
 *  2. causa con occurrence vacio                 -> NO LISTO (CAUSE_MISSING_SOD)
 *  3. AP=H sin accion                            -> NO LISTO (CAUSE_APH_EMPTY_NO_PLACEHOLDER)
 *  4. control con invento ("hielo seco")         -> NO LISTO (FORBIDDEN_VOCABULARY)
 *  5. effectEndUser vacio (VDA 3 niveles)        -> NO LISTO (promovido a bloqueante)
 *  6. specialChar=CC con S=6 (sin flam/legal)    -> LISTO con aviso (CC/SC no bloquea)
 *  7. header vacio                               -> NO LISTO (HEADER_MISSING)
 */
import { describe, it, expect } from 'vitest';
import { computeReadiness } from '../../scripts/_lib/amfeReadiness.mjs';

const HDR = {
    organization: 'BARACK MERCOSUL', client: 'VWA',
    approvedBy: 'Carlos Baptista', reviewedBy: 'Manuel Meszaros', rev: 'A',
    partNumber: '2HC.881.901', applicableParts: 'APC DELANTERO', responsible: 'Facundo Santoro',
};

function makeDoc({ cause = {}, failure = {}, header = HDR } = {}) {
    const c = {
        description: 'Presion de inyeccion baja', cause: 'Presion de inyeccion baja',
        // AP='L' porque la tabla AIAG-VDA da L para 6/3/4. Decia 'M' hasta el 21/08/2026, y lo
        // destapo el check CAUSE_AP_MISMATCH al nacer: el fixture de nuestros propios tests
        // tenia el AP mal calculado.
        severity: 6, occurrence: 3, detection: 4, ap: 'L', actionPriority: 'L',
        preventionControl: 'Dossier + alarmas en panel',
        detectionControl: 'Autocontrol con calibre',
        ...cause,
    };
    const fm = {
        description: 'Pieza incompleta',
        // fm.severity sincronizado con la causa (lo hace syncLegacyFmFields en datos reales;
        // el export Excel lee fm.severity). Sin esto saltaria FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE.
        severity: (cause.severity != null ? cause.severity : 6),
        effectLocal: 'Scrap del material', effectNextLevel: 'Para linea', effectEndUser: 'Falla en campo',
        causes: [c],
        ...failure,
    };
    return {
        header,
        operations: [{
            opNumber: '20', operationNumber: '20', name: 'INYECCION DE PLASTICO', operationName: 'INYECCION DE PLASTICO',
            focusElementFunction: 'Interno: pieza conforme / Cliente: ensamble sin interferencia / Usr: confort',
            operationFunction: 'Inyectar la pieza segun parametros validados',
            workElements: [{
                name: 'Inyectora de plastico', type: 'Machine',
                functions: [{
                    description: 'Inyectar controlando presion y temperatura',
                    functionDescription: 'Inyectar controlando presion y temperatura',
                    failures: [fm],
                }],
            }],
        }],
    };
}

describe('computeReadiness — scorecard AMFE listo para entregar', () => {
    it('1. AMFE completo + header completo => LISTO (0 bloqueantes)', () => {
        const s = computeReadiness(makeDoc(), 'Armrest', 'AMFE-TEST', HDR);
        expect(s.verdict).toBe('LISTO');
        expect(s.blockerCount).toBe(0);
    });

    it('2. causa con occurrence vacio => NO LISTO (CAUSE_MISSING_SOD)', () => {
        const s = computeReadiness(makeDoc({ cause: { occurrence: '' } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(s.verdict).toBe('NO_LISTO');
        expect(s.blockers.some(b => b.type === 'CAUSE_MISSING_SOD')).toBe(true);
    });

    it('3. AP=H sin accion => NO LISTO (CAUSE_APH_EMPTY_NO_PLACEHOLDER)', () => {
        const s = computeReadiness(makeDoc({ cause: { ap: 'H', actionPriority: 'H' } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(s.verdict).toBe('NO_LISTO');
        expect(s.blockers.some(b => b.type === 'CAUSE_APH_EMPTY_NO_PLACEHOLDER')).toBe(true);
    });

    it('4. control con invento "hielo seco" => NO LISTO (FORBIDDEN_VOCABULARY)', () => {
        const s = computeReadiness(makeDoc({ cause: { preventionControl: 'Limpieza con hielo seco' } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(s.verdict).toBe('NO_LISTO');
        expect(s.blockers.some(b => b.type === 'FORBIDDEN_VOCABULARY')).toBe(true);
    });

    it('5. effectEndUser vacio (VDA 3 niveles) => NO LISTO (promovido a bloqueante)', () => {
        const s = computeReadiness(makeDoc({ failure: { effectEndUser: '' } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(s.verdict).toBe('NO_LISTO');
        expect(s.blockers.some(b => b.type === 'FM_NO_EFFECT_END')).toBe(true);
    });

    it('6. specialChar=CC con S=6 => NO LISTO: desde el 11/09/2026 CAUSE_CC_LOW_SEVERITY bloquea', () => {
        // Una critica exige S 9 o 10 (I-AC-005 punto 5). Regla `caracteristicas-especiales.md`.
        const s = computeReadiness(makeDoc({ cause: { specialChar: 'CC', severity: 6 } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(s.verdict).toBe('NO_LISTO');
        expect(s.blockers.some(b => b.type === 'CAUSE_CC_LOW_SEVERITY')).toBe(true);
        expect(s.dimensions['CC/SC calibracion'].blockers).toBeGreaterThan(0);
    });

    it('6b. ...y "flamabilidad" en el efecto ya NO exime: si es legal, la S tiene que ser 9', () => {
        // Hasta el 11/09 la palabra eximia; por ese agujero paso una costura S7 con D/TLD y
        // "riesgo de seguridad" en el efecto. Si el texto dice ley y la S es 6, la S esta mal.
        const s = computeReadiness(
            makeDoc({ cause: { specialChar: 'CC', severity: 6 }, failure: { effectEndUser: 'Riesgo de flamabilidad TL 1010' } }),
            'Armrest', 'AMFE-TEST', HDR);
        expect(s.verdict).toBe('NO_LISTO');
        expect(s.blockers.some(b => b.type === 'CAUSE_CC_LOW_SEVERITY')).toBe(true);
    });

    it('6c. specialChar=SC con S=8 O=2 => NO LISTO (CAUSE_SC_FUERA_DE_REGLA); con O=4 => LISTO', () => {
        const mal = computeReadiness(makeDoc({ cause: { specialChar: 'SC', severity: 8, occurrence: 2 } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(mal.blockers.some(b => b.type === 'CAUSE_SC_FUERA_DE_REGLA')).toBe(true);
        const bien = computeReadiness(makeDoc({ cause: { specialChar: 'SC', severity: 8, occurrence: 4 } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(bien.blockers.some(b => b.type === 'CAUSE_SC_FUERA_DE_REGLA')).toBe(false);
    });

    it('6d. specialChar=W => NO LISTO (SIGLA_DESCONOCIDA): la W no existe en ninguna norma VW', () => {
        const s = computeReadiness(makeDoc({ cause: { specialChar: 'W', severity: 7, occurrence: 5 } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(s.blockers.some(b => b.type === 'SIGLA_DESCONOCIDA')).toBe(true);
    });

    it('7. header vacio => NO LISTO (HEADER_MISSING)', () => {
        const s = computeReadiness(makeDoc({ header: {} }), 'Armrest', 'AMFE-TEST', {});
        expect(s.verdict).toBe('NO_LISTO');
        expect(s.blockers.some(b => b.type === 'HEADER_MISSING')).toBe(true);
    });

    it('maestro: no exige partNumber/applicableParts', () => {
        const s = computeReadiness(makeDoc({ header: { ...HDR, partNumber: '', applicableParts: '' } }), 'MAESTRO-INY', 'AMFE-MAESTRO-INY-001', { ...HDR, partNumber: '', applicableParts: '' });
        expect(s.blockers.some(b => b.type === 'HEADER_MISSING')).toBe(false);
    });
});

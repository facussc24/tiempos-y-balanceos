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
import { computeReadiness, formatScorecard, scanTbdExportable } from '../../scripts/_lib/amfeReadiness.mjs';
import { calculateAP } from '../../scripts/_lib/amfeIo.mjs';

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

    /**
     * Este caso se dio VUELTA el 21/09/2026 y el test habia quedado afirmando lo contrario de
     * lo que decidio Fak. Antes, un AP=H con la celda de accion vacia BLOQUEABA la entrega
     * (`CAUSE_APH_EMPTY_NO_PLACEHOLDER`) y el placeholder "Pendiente definicion equipo APQP"
     * era el default autorizado. Fak, viendo el PDF del AMFE 131: *"saca esa mierda, no la
     * quiero ni ver en el AMFE"*. Ahora el AP=H sin accion es ESTADO VALIDO — la accion la
     * define el equipo cuando decide definirla — y lo que bloquea es el placeholder.
     */
    it('3. AP=H con la celda de accion vacia => LISTO: es estado valido', () => {
        const s = computeReadiness(makeDoc({ cause: { ap: 'H', actionPriority: 'H' } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(s.blockers.some(b => b.type === 'CAUSE_APH_EMPTY_NO_PLACEHOLDER')).toBe(false);
        expect(s.blockers.some(b => b.type === 'CAUSE_APH_PLACEHOLDER_PROHIBIDO')).toBe(false);
    });

    it('3b. AP=H CON el placeholder prohibido => NO LISTO (CAUSE_APH_PLACEHOLDER_PROHIBIDO)', () => {
        const s = computeReadiness(
            makeDoc({ cause: { ap: 'H', actionPriority: 'H', optimizationAction: 'Pendiente definicion equipo APQP' } }),
            'Armrest', 'AMFE-TEST', HDR);
        expect(s.verdict).toBe('NO_LISTO');
        expect(s.blockers.some(b => b.type === 'CAUSE_APH_PLACEHOLDER_PROHIBIDO')).toBe(true);
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

/**
 * MODO ENTREGA (30/09/2026): para el AMFE que sale de verdad, tres avisos pasan a bloqueantes
 * — TBD en un campo que el export imprime, CONTROL_CON_CITA, y CARACTERISTICA_CLIENTE_S_MENOR
 * sin decision escrita. Sin el modo el scorecard es el de siempre.
 */
describe('computeReadiness — modo ENTREGA', () => {
    const CITA = 'Guia en el pie de la maquina (HO 927 REV6, hoja 50)';
    // CC con S=8: el cliente la designo critica y el efecto da S=8 (AMFE 173). El AP sale de la
    // tabla para no disparar CAUSE_AP_MISMATCH, que es CRITICAL en los dos modos.
    const apCliente = calculateAP(8, 3, 4);
    const causaCliente = (extra = {}) => ({
        cause: { specialChar: 'CC', severity: 8, occurrence: 3, detection: 4, ap: apCliente, actionPriority: apCliente,
            specialCharSource: 'LSC v1 del cliente, SC 1.4 (SMRC la marca <cc/h>)', ...extra },
    });
    const hay = (s, tipo) => s.blockers.some(b => b.type === tipo);
    const avisa = (s, tipo) => s.warnings.some(w => w.type === tipo);

    it('un AMFE limpio es LISTO en los dos modos, y el scorecard dice en cual corrio', () => {
        const normal = computeReadiness(makeDoc(), 'Armrest', 'AMFE-TEST', HDR);
        const entrega = computeReadiness(makeDoc(), 'Armrest', 'AMFE-TEST', HDR, { entrega: true });
        expect(normal.verdict).toBe('LISTO');
        expect(entrega.verdict).toBe('LISTO');
        expect(normal.modo).toBe('normal');
        expect(entrega.modo).toBe('entrega');
    });

    it('TBD en un control: sin el modo es LISTO como siempre; con el modo, NO LISTO', () => {
        const doc = () => makeDoc({ cause: { preventionControl: 'Calibre digital, frecuencia TBD' } });
        const normal = computeReadiness(doc(), 'Armrest', 'AMFE-TEST', HDR);
        expect(normal.verdict).toBe('LISTO');
        expect(hay(normal, 'TBD_EN_CAMPO_EXPORTABLE')).toBe(false);

        const entrega = computeReadiness(doc(), 'Armrest', 'AMFE-TEST', HDR, { entrega: true });
        expect(entrega.verdict).toBe('NO_LISTO');
        const b = entrega.blockers.find(x => x.type === 'TBD_EN_CAMPO_EXPORTABLE');
        expect(b.campo).toBe('preventionControl');
        expect(b.opNum).toBe('20');
        expect(entrega.dimensions['TBD en campos exportables'].blockers).toBe(1);
    });

    it('TBD en cada campo que el export imprime: efecto, funcion, nombre de WE, causa y accion', () => {
        const doc = makeDoc({ cause: { cause: 'Presion TBD', description: 'Presion TBD', optimizationAction: 'TBD' },
            failure: { effectEndUser: 'TBD' } });
        doc.operations[0].workElements[0].name = 'Inyectora TBD';
        doc.operations[0].workElements[0].functions[0].description = 'Inyectar TBD';
        doc.operations[0].workElements[0].functions[0].functionDescription = 'Inyectar TBD';
        const campos = scanTbdExportable(doc, HDR, 'AMFE-TEST').map(i => i.campo);
        expect(campos).toEqual(expect.arrayContaining([
            'workElement.name', 'function.description', 'effectEndUser', 'cause.cause', 'optimizationAction']));
    });

    it('TBD en la caratula (header) tambien bloquea la entrega', () => {
        const hdr = { ...HDR, partNumber: 'TBD' };
        const s = computeReadiness(makeDoc({ header: hdr }), 'Armrest', 'AMFE-TEST', hdr, { entrega: true });
        expect(s.blockers.find(b => b.type === 'TBD_EN_CAMPO_EXPORTABLE').campo).toBe('header.partNumber');
    });

    // Auditoria del 01/10/2026: el export imprime mas caratula y mas columnas que las que se barrian.
    it('TBD en el resto de lo que el export imprime: fechas y estado de la accion, y la caratula entera (asunto, equipo, ubicacion, modelo, numero)', () => {
        const hdr = { ...HDR, amfeNumber: 'TBD', location: 'TBD', modelYear: 'TBD', subject: 'Proceso TBD', coreTeam: ['Carlos Baptista', 'TBD'], _meta: 'TBD' };
        const doc = makeDoc({ header: hdr, cause: { targetDate: 'TBD', completionDate: 'TBD', status: 'TBD' } });
        const campos = scanTbdExportable(doc, hdr, 'AMFE-TEST').map(i => i.campo);
        expect(campos).toEqual(expect.arrayContaining(['header.amfeNumber', 'header.location', 'header.modelYear',
            'header.subject', 'header.coreTeam', 'targetDate', 'completionDate', 'status']));
        expect(campos).not.toContain('header._meta');                           // lo interno no se imprime
        expect(campos.filter(c => c === 'header.coreTeam')).toHaveLength(1);    // solo el integrante que dice TBD
    });

    it('"tbd" adentro de otra palabra no es un TBD', () => {
        const s = computeReadiness(makeDoc({ cause: { preventionControl: 'Tabla STBDX de ajuste' } }), 'Armrest', 'AMFE-TEST', HDR, { entrega: true });
        expect(hay(s, 'TBD_EN_CAMPO_EXPORTABLE')).toBe(false);
    });

    it('CONTROL_CON_CITA: aviso en el dia a dia, bloqueante en la entrega', () => {
        const normal = computeReadiness(makeDoc({ cause: { preventionControl: CITA } }), 'Armrest', 'AMFE-TEST', HDR);
        expect(normal.verdict).toBe('LISTO');
        expect(avisa(normal, 'CONTROL_CON_CITA')).toBe(true);

        const entrega = computeReadiness(makeDoc({ cause: { preventionControl: CITA } }), 'Armrest', 'AMFE-TEST', HDR, { entrega: true });
        expect(entrega.verdict).toBe('NO_LISTO');
        expect(hay(entrega, 'CONTROL_CON_CITA')).toBe(true);
        expect(avisa(entrega, 'CONTROL_CON_CITA')).toBe(false);
        expect(entrega.dimensions['Controles: cita de la fuente'].blockers).toBe(1);
    });

    it('CARACTERISTICA_CLIENTE_S_MENOR sin decision: aviso en el dia a dia, bloqueante en la entrega', () => {
        const normal = computeReadiness(makeDoc(causaCliente()), 'Armrest', 'AMFE-TEST', HDR);
        expect(normal.verdict).toBe('LISTO');
        expect(avisa(normal, 'CARACTERISTICA_CLIENTE_S_MENOR')).toBe(true);

        const entrega = computeReadiness(makeDoc(causaCliente()), 'Armrest', 'AMFE-TEST', HDR, { entrega: true });
        expect(entrega.verdict).toBe('NO_LISTO');
        expect(hay(entrega, 'CARACTERISTICA_CLIENTE_S_MENOR')).toBe(true);
    });

    it('...con la decision escrita en specialCharDecision sigue siendo aviso, no bloquea', () => {
        const doc = makeDoc(causaCliente({ specialCharDecision: 'Fak 22/09/2026: la S queda en 8, se informa la diferencia a SMRC' }));
        const entrega = computeReadiness(doc, 'Armrest', 'AMFE-TEST', HDR, { entrega: true });
        expect(entrega.verdict).toBe('LISTO');
        expect(hay(entrega, 'CARACTERISTICA_CLIENTE_S_MENOR')).toBe(false);
        expect(avisa(entrega, 'CARACTERISTICA_CLIENTE_S_MENOR')).toBe(true);
    });

    it('una decision en blanco ("  ") no cuenta como decision', () => {
        const entrega = computeReadiness(makeDoc(causaCliente({ specialCharDecision: '   ' })), 'Armrest', 'AMFE-TEST', HDR, { entrega: true });
        expect(hay(entrega, 'CARACTERISTICA_CLIENTE_S_MENOR')).toBe(true);
    });

    it('el modo entrega no afloja nada: un critico sigue bloqueando en los dos', () => {
        const s = computeReadiness(makeDoc({ cause: { occurrence: '' } }), 'Armrest', 'AMFE-TEST', HDR, { entrega: true });
        expect(s.verdict).toBe('NO_LISTO');
        expect(hay(s, 'CAUSE_MISSING_SOD')).toBe(true);
    });

    it('pasar opts vacios, nulos o entrega:false es el modo de siempre', () => {
        const doc = () => makeDoc({ cause: { preventionControl: CITA + ' TBD' } });
        for (const opts of [undefined, null, {}, { entrega: false }]) {
            const s = computeReadiness(doc(), 'Armrest', 'AMFE-TEST', HDR, opts);
            expect(s.modo).toBe('normal');
            expect(s.verdict).toBe('LISTO');
        }
    });

    it('formatScorecard marca "(entrega)" solo en ese modo', () => {
        const normal = formatScorecard(computeReadiness(makeDoc(), 'Armrest', 'AMFE-TEST', HDR), { verbose: false });
        const entrega = formatScorecard(computeReadiness(makeDoc(), 'Armrest', 'AMFE-TEST', HDR, { entrega: true }), { verbose: false });
        expect(normal).not.toContain('(entrega)');
        expect(entrega).toContain('(entrega)');
    });
});

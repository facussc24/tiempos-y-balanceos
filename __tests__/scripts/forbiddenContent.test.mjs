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
import { scanForbidden, scanRevisionMeta } from '../../scripts/_lib/forbiddenContent.mjs';
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
// A2. ENGLISH_RANDOM_TERMS (Fak 19/08/2026: "no puedo enviar amfes con palabras
//     asi en ingles... queda obvio que los hiciste vos"). Purgados ese dia de
//     los 8 AMFE Patagonia; este gate impide que vuelvan a entrar.
// ─────────────────────────────────────────────────────────────────────────────

describe('scanForbidden — ingles random (ENGLISH_RANDOM_TERMS)', () => {
    const esIngles = r => r.forbidden.filter(f => f.kind.startsWith('ingles'));

    it.each([
        'posible Gap & Flush NOK',
        'ausencia de Squeak & Rattle',
        'con fit & finish conforme',
        'Lote del proveedor fuera de spec',
        'Prueba de Torque/Push manual',
        'Check de lote y fecha',
    ])('detecta la forma literal: %s', (texto) => {
        expect(esIngles(scanForbidden(texto)).length).toBeGreaterThan(0);
    });

    it.each([
        'posible Gap&Flush NOK',        // sin espacios alrededor del &
        'con fit&finish conforme',
        'Prueba de Torque / Push manual', // con espacios alrededor de la barra
        'GAP  &  FLUSH fuera de espec',   // espacios dobles
    ])('detecta variantes de espaciado: %s', (texto) => {
        expect(esIngles(scanForbidden(texto)).length).toBeGreaterThan(0);
    });

    // Ronda 2 (Fak, 19/08): mi primera traduccion tambien era ajena a la planta.
    // "enrase" y "chirridos" tienen CERO usos en 1500 mails de gente Barack.
    it.each([
        'luz y enrase fuera de especificacion',
        'Ruidos y chirridos en el modulo',
        'superficie enrasada con golpeteos',
    ])('detecta castellano ajeno a la planta: %s', (texto) => {
        expect(esIngles(scanForbidden(texto)).length).toBeGreaterThan(0);
    });

    it.each([
        'alineacion y separacion entre piezas fuera de especificacion', // traduccion final
        'desalineacion o separacion excesiva',
        'Ruidos en el modulo',
        'ajuste y terminacion conforme',
        'torque de apriete con torquimetro',       // "torque" solo es termino aceptado
        'ensayo de peeling con dinamometro',       // nombre real del ensayo
        'Scrap del material mal cortado',          // termino de industria aceptado
    ])('NO marca el espanol de planta ni terminos aceptados: %s', (texto) => {
        expect(esIngles(scanForbidden(texto))).toHaveLength(0);
    });

    it('word-boundary: "rattle" no dispara dentro de otra palabra', () => {
        expect(esIngles(scanForbidden('El proveedor Rattleson SA entrega KLT'))).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// A3. scanRevisionMeta — el log de revisiones habla de la PIEZA, no del REDACTOR
//     (Fak, 20/08/2026: "parece una burla... esas cosas se ocultan").
//     Gate duro en _exportAmfeOficial.ts: un AMFE con una de estas NO se exporta.
// ─────────────────────────────────────────────────────────────────────────────

describe('scanRevisionMeta — confesiones del redactor en el log de revisiones', () => {
    it.each([
        // el caso real que Fak freno
        'SE REESCRIBEN EN ESPANOL, CON EL VOCABULARIO DE LA PLANTA, LOS TERMINOS EN INGLES DE FUNCIONES, EFECTOS Y CONTROLES.',
        'SE AGREGA LA OPERACION 61 CONTROL DE PIEZA INYECTADA, REPLICADA DEL AMFE DE IP PADS (DECISION FAK 20/08).',
        'SE NUMERA 61 PARA NO PISAR LA COSTURA DOBLE.',
        'SE CORRIGE LA TRADUCCION DE LOS EFECTOS.',
        'SE CORRIGE LA ORTOGRAFIA DE LA OPERACION 30.',
        'CONTENIDO GENERADO AUTOMATICAMENTE Y REVISADO.',
    ])('detecta la confesion: %s', (texto) => {
        expect(scanRevisionMeta(texto).length).toBeGreaterThan(0);
    });

    it.each([
        // revisiones legitimas: cambios de ingenieria reales, tal cual estan en los 8 AMFE
        'EMISION INICIAL.',
        'SE AGREGA LA OPERACION 61 CONTROL DE PIEZA INYECTADA.',
        'SE AGREGA EL CONTROL DE PIEZA INYECTADA EN LA OPERACION 70.',
        'EL ENFUNDADO VA ANTES DEL ESPUMADO. SE ALINEA CON EL FLUJOGRAMA 152 REV. B.',
        'SE ALINEA CON EL FLUJOGRAMA 152 REV. B. CORTE Y COSTURA DECLARAN SU RANGO.',
        'REVISION CON FOCO EN RECEPCION DE MATERIALES (ASAICHI 10-11/08/2026). LA OPERACION 10 PASA A UN RENGLON POR MATERIAL, CON SU CONTROL.',
        'REVISION CONTRA EL FLUJOGRAMA I-IN-002/III REV A Y EL PLAN DE CONTROL DEL 31/07/2026. SE AMPLIA LA RECEPCION A LOS 13 COMPONENTES.',
        'SE ACTUALIZAN LOS CONTROLES PREVENTIVOS Y DETECTIVOS TRAS REUNION CON EL INSPECTOR DE CALIDAD DE MATERIA PRIMA.',
        'SE REEMITE EN EL FORMULARIO NUEVO I-AC-005.3.',
    ])('NO molesta a una revision legitima: %s', (texto) => {
        expect(scanRevisionMeta(texto)).toHaveLength(0);
    });

    it('entrada vacia no dispara', () => {
        expect(scanRevisionMeta('')).toHaveLength(0);
        expect(scanRevisionMeta(null)).toHaveLength(0);
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

// ─────────────────────────────────────────────────────────────────────────────
// D. EL AGUJERO DE LOS 6 CAMPOS (23/08/2026)
//
// Fak, sobre los AMFEs que estaban por irse a Calidad: "sigo viendo palabras
// extranas que nadie en esta empresa usaria como 'enrase', 'chirridos'".
// Estaban en ENGLISH_RANDOM_TERMS desde el 19/08 y el validador daba
// FORBIDDEN_VOCABULARY = 0: `pushForbiddenIssues` se llamaba en 9 lugares y
// ninguno cubria el texto de la causa ni los 3 efectos del modo de falla.
//
// Los textos de abajo NO estan escritos desde el codigo: son las cadenas reales
// leidas de Supabase live el 23/08/2026 (leccion "un test escrito desde el
// codigo no verifica nada" — la tabla AP estuvo mal un ano con los tests en verde).
//   - "enrase"        -> cause.cause / cause.description   en AMFE-1 y 160, OP15
//   - "Gap & Flush"   -> failure.effectEndUser             en AMFE-MAESTRO-INY-001, OP20
//   - "fuera de spec" -> failure.description + cause.cause en AMFE-MAESTRO-PU-001, OP10
// ─────────────────────────────────────────────────────────────────────────────

/** Igual que makeDoc pero permite pisar cualquier campo de failure/cause. */
function makeDocCampos({ fm = {}, cause = {} } = {}) {
    const doc = makeDoc('Autocontrol con calibre al inicio de turno');
    const fmObj = doc.operations[0].workElements[0].functions[0].failures[0];
    Object.assign(fmObj, fm);
    Object.assign(fmObj.causes[0], cause);
    return doc;
}

const forbiddenDe = (doc) => validateAmfeDoc(doc, 'TopRoll', 'AMFE-TEST')
    .critical.filter(i => i.type === 'FORBIDDEN_VOCABULARY');

describe('candado anti-invento — los 6 campos que no se escaneaban (agujero 23/08/2026)', () => {
    const REALES = [
        ['cause.cause', { cause: { cause: 'Operario no verifico el enrase de las lineas de contorno del TNT' } }, 'enrase'],
        ['cause.description', { cause: { description: 'Operario no verifico el enrase de las lineas de contorno del TNT' } }, 'enrase'],
        ['failure.description', { fm: { description: 'Lote de Isocianato fuera de spec o contaminado' } }, 'fuera de spec'],
        ['effectEndUser', { fm: { effectEndUser: 'Pieza no montable o con Gap & Flush NOK en el modulo del vehiculo' } }, 'gap & flush'],
        ['effectLocal', { fm: { effectLocal: 'Material fuera de spec, va a scrap' } }, 'fuera de spec'],
        ['effectNextLevel', { fm: { effectNextLevel: 'Lote fuera de spec frena la linea siguiente' } }, 'fuera de spec'],
    ];

    for (const [campo, override, termino] of REALES) {
        it(`D. ${campo} con "${termino}" => FORBIDDEN_VOCABULARY`, () => {
            const hits = forbiddenDe(makeDocCampos(override));
            expect(hits.length).toBeGreaterThan(0);
            expect(hits.some(i => i.detail.includes(campo))).toBe(true);
            expect(hits.some(i => i.detail.toLowerCase().includes(termino))).toBe(true);
        });
    }

    it('D7. el doc base (sin palabra rara en ningun campo nuevo) sigue limpio', () => {
        expect(forbiddenDe(makeDocCampos())).toHaveLength(0);
    });

    it('D8. diffIssues: meter "enrase" en la causa AHORA bloquea el apply', () => {
        const before = validateAmfeDoc(makeDocCampos(), 'TopRoll', 'AMFE-TEST');
        const after = validateAmfeDoc(
            makeDocCampos({ cause: { cause: 'Operario no verifico el enrase del contorno' } }),
            'TopRoll', 'AMFE-TEST');
        expect(diffIssues(before, after).critical.some(i => i.type === 'FORBIDDEN_VOCABULARY')).toBe(true);
    });

    it('D9. "stock", "setup" y "checklist" NO se marcan (Fak 23/08: las tres se quedan)', () => {
        const doc = makeDocCampos({
            fm: { effectLocal: 'Paro de linea si no hay stock' },
            cause: { cause: 'Checklist de arranque no verificado en el setup' },
        });
        expect(forbiddenDe(doc)).toHaveLength(0);
    });
});

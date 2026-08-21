/**
 * La severidad manda desde el MODO DE FALLA, no desde la causa.
 *
 * `AmfeCause` no tiene campo `severity` — su comentario dice *"AP (calculated from
 * parent's S + this O + this D)"* — y la UI edita una sola S por modo de falla, con
 * rowSpan sobre las filas de causa. Pero en los datos quedaron 145 causas con una S propia
 * suelta, resto de una importacion.
 *
 * El 21/08/2026 un script recalculo el AP leyendo esa S fantasma y bajo 9 filas del AMFE
 * 162 de M a L. Subdeclarar riesgo en un documento que va al cliente es la direccion cara
 * del error, asi que estos tests fijan de donde sale la S para cada check de riesgo.
 */
import { describe, it, expect } from 'vitest';
import { validateAmfeDoc } from '../../scripts/_lib/amfeValidator.mjs';

/** AMFE minimo con una causa; `sevCausa` es la S fantasma (undefined = no existe). */
function doc({ sevFalla, sevCausa, o = 2, d = 6, ap = 'M', specialChar = '' }) {
    const causa = {
        description: 'Dosificacion corta', cause: 'Dosificacion corta',
        preventionControl: 'Hoja de parametros validada',
        detectionControl: 'Autocontrol con calibre',
        occurrence: o, detection: d, ap, actionPriority: ap, specialChar,
        optimizationAction: ap === 'H' ? 'Pendiente definicion equipo APQP' : '',
    };
    if (sevCausa !== undefined) causa.severity = sevCausa;
    return {
        operations: [{
            opNumber: '10', operationNumber: '10',
            name: 'INYECCION DE PIEZA PLASTICA', operationName: 'INYECCION DE PIEZA PLASTICA',
            focusElementFunction: 'Funcion Interna: proveer el sustrato / Funcion del Cliente: montar sin interferencia / Funcion del Usuario Final: durabilidad',
            operationFunction: 'Inyectar el sustrato conforme a la hoja de parametros',
            workElements: [{
                name: 'Maquina inyectora de plastico', type: 'Machine',
                functions: [{
                    description: 'Aportar presion y temperatura estables durante el ciclo',
                    functionDescription: 'Aportar presion y temperatura estables durante el ciclo',
                    failures: [{
                        description: 'Llenado incompleto de pieza',
                        severity: sevFalla,
                        effectLocal: 'Scrap de la pieza',
                        effectNextLevel: 'Faltante de componente en la linea',
                        effectEndUser: 'Pieza ausente en el habitaculo',
                        causes: [causa],
                    }],
                }],
            }],
        }],
    };
}

const tipo = (args, t) => {
    const res = validateAmfeDoc(doc(args), 'X', 'TEST');
    return [...res.critical, ...res.warning].filter(i => i.type === t);
};

describe('CAUSE_AP_MISMATCH usa la S del modo de falla', () => {
    it('el caso real: fm.severity=7 con S fantasma 6 en la causa; AP=M es CORRECTO', () => {
        expect(tipo({ sevFalla: 7, sevCausa: 6, o: 2, d: 6, ap: 'M' }, 'CAUSE_AP_MISMATCH')).toHaveLength(0);
    });

    it('y AP=L en esa misma fila se marca — es el que subdeclaraba', () => {
        const hits = tipo({ sevFalla: 7, sevCausa: 6, o: 2, d: 6, ap: 'L' }, 'CAUSE_AP_MISMATCH');
        expect(hits).toHaveLength(1);
        expect(hits[0].detail).toContain("da 'M'");
    });

    it('sin S fantasma da lo mismo: la S siempre sale del modo de falla', () => {
        expect(tipo({ sevFalla: 7, sevCausa: undefined, o: 2, d: 6, ap: 'M' }, 'CAUSE_AP_MISMATCH')).toHaveLength(0);
    });
});

describe('CAUSE_SEVERITY_PROPIA avisa de la S fantasma', () => {
    it('una causa con S distinta de la de su modo de falla => WARNING', () => {
        const res = validateAmfeDoc(doc({ sevFalla: 7, sevCausa: 6 }), 'X', 'TEST');
        expect(res.warning.filter(i => i.type === 'CAUSE_SEVERITY_PROPIA')).toHaveLength(1);
        expect(res.critical.filter(i => i.type === 'CAUSE_SEVERITY_PROPIA')).toHaveLength(0);
    });

    it('si coincide con la del modo de falla no molesta', () => {
        expect(tipo({ sevFalla: 7, sevCausa: 7 }, 'CAUSE_SEVERITY_PROPIA')).toHaveLength(0);
    });

    it('si la causa no trae S propia no molesta', () => {
        expect(tipo({ sevFalla: 7, sevCausa: undefined }, 'CAUSE_SEVERITY_PROPIA')).toHaveLength(0);
    });
});

describe('CAUSE_S9_SIN_CC y CC/SC tambien miran la S del modo de falla', () => {
    it('fm.severity=9 sin CC avisa, aunque la S fantasma diga 5', () => {
        expect(tipo({ sevFalla: 9, sevCausa: 5, o: 3, d: 4, ap: 'L' }, 'CAUSE_S9_SIN_CC')).toHaveLength(1);
    });

    it('una CC con fm.severity=9 no se marca como CC de baja severidad', () => {
        expect(tipo({ sevFalla: 9, sevCausa: 5, o: 3, d: 4, ap: 'L', specialChar: 'CC' }, 'CAUSE_CC_LOW_SEVERITY')).toHaveLength(0);
    });
});

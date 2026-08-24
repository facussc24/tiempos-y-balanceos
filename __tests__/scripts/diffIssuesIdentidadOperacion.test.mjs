/**
 * Identidad de una operacion en el diff before/after del gate (`issueKey`).
 *
 * EL PROBLEMA, DOS VECES
 * `runWithValidation()` bloquea un `--apply` si el cambio INTRODUCE criticos nuevos. Para
 * saber cual es "nuevo" compara los issues de antes contra los de despues, y para eso
 * necesita identificar la operacion. Ese identificador se equivoco dos veces, en espejo:
 *
 *  - 18/08/2026 — la clave era el NUMERO. Al alinear los apoyacabezas con su flujograma,
 *    14 operaciones vacias PREEXISTENTES se corrieron de numero y aparecieron como criticos
 *    nuevos: el gate bloqueaba toda renumeracion legitima. Se cambio la clave al NOMBRE.
 *  - 24/08/2026 — la clave era el NOMBRE. Al renombrar la OP40 de "ENFUNDADO" a "ENSAMBLE
 *    ASTA + ENFUNDADO" (para que diga lo mismo que el Plan de Control), los 2 EMPTY_OP
 *    PREEXISTENTES de los traseros aparecieron como criticos nuevos. Mismo bloqueo, otra
 *    puerta.
 *
 * LA CLAVE CORRECTA ES EL `id` DE LA OPERACION: no cambia ni al renumerar ni al renombrar.
 *
 * Y lo que NO puede pasar: que al arreglar esto el gate se vuelva ciego. Un critico que de
 * verdad se introduce tiene que seguir bloqueando, aunque en el mismo cambio se haya
 * renombrado o renumerado la operacion.
 */
import { describe, it, expect } from 'vitest';
import { validateAmfeDoc, diffIssues } from '../../scripts/_lib/amfeValidator.mjs';

const ID_FIJO = 'op-0f18cf8e-691d-488e-80a1-95c989bc9aa0';

/** Una operacion con `id` estable; `nombre` y `numero` variables; con o sin contenido. */
function doc({ nombre = 'ENFUNDADO', numero = '40', conWE = true, id = ID_FIJO } = {}) {
    return {
        operations: [{
            id,
            opNumber: numero,
            operationNumber: numero,
            name: nombre,
            operationName: nombre,
            focusElementFunction: 'Interno: proveer pieza conforme / Cliente: ensamblar sin interferencia / Usuario Final: confort',
            operationFunction: 'Calzar funda sobre asta sin pliegues y centrada',
            workElements: conWE ? [{
                id: 'we-1', name: 'Operador de Producción', type: 'Man',
                functions: [{
                    id: 'fn-1',
                    description: 'Calzar la funda sobre el asta',
                    functionDescription: 'Calzar la funda sobre el asta',
                    failures: [{
                        id: 'fm-1', description: 'Funda mal calzada',
                        effectLocal: 'Retrabajo offline', effectNextLevel: 'Para linea',
                        effectEndUser: 'Estetica no conforme', severity: 5,
                        causes: [{
                            id: 'c-1', cause: 'Operario no asienta la funda', description: 'Operario no asienta la funda',
                            severity: 5, occurrence: 3, detection: 4, ap: 'L', actionPriority: 'L',
                            preventionControl: 'Autocontrol con muestra patron',
                            detectionControl: 'Inspeccion visual antes de la siguiente operacion',
                        }],
                    }],
                }],
            }] : [],
        }],
    };
}

const val = (d) => validateAmfeDoc(d, 'HEADREST', 'AMFE-TEST');
const nuevos = (antes, despues) => diffIssues(val(antes), val(despues));
const hayEmptyOp = (r) => r.critical.some(i => i.type === 'EMPTY_OP');

describe('issueKey — un problema PREEXISTENTE no se reporta como nuevo', () => {
    it('24/08: renombrar una operacion que ya estaba vacia NO introduce criticos', () => {
        const r = nuevos(
            doc({ nombre: 'ENFUNDADO', conWE: false }),
            doc({ nombre: 'ENSAMBLE ASTA + ENFUNDADO', conWE: false }),
        );
        expect(r.critical).toHaveLength(0);
    });

    it('18/08: renumerar una operacion que ya estaba vacia NO introduce criticos', () => {
        const r = nuevos(
            doc({ numero: '60', conWE: false }),
            doc({ numero: '40', conWE: false }),
        );
        expect(r.critical).toHaveLength(0);
    });

    it('renombrar Y renumerar a la vez, con el problema preexistente, tampoco', () => {
        const r = nuevos(
            doc({ nombre: 'ENFUNDADO', numero: '60', conWE: false }),
            doc({ nombre: 'ENSAMBLE ASTA + ENFUNDADO', numero: '40', conWE: false }),
        );
        expect(r.critical).toHaveLength(0);
    });
});

describe('issueKey — el gate NO se vuelve ciego', () => {
    it('vaciar una operacion que tenia contenido SI bloquea', () => {
        expect(hayEmptyOp(nuevos(doc({ conWE: true }), doc({ conWE: false })))).toBe(true);
    });

    it('...aunque en el mismo cambio se la renombre', () => {
        expect(hayEmptyOp(nuevos(
            doc({ nombre: 'ENFUNDADO', conWE: true }),
            doc({ nombre: 'ENSAMBLE ASTA + ENFUNDADO', conWE: false }),
        ))).toBe(true);
    });

    it('...y aunque ademas se la renumere', () => {
        expect(hayEmptyOp(nuevos(
            doc({ nombre: 'ENFUNDADO', numero: '60', conWE: true }),
            doc({ nombre: 'ENSAMBLE ASTA + ENFUNDADO', numero: '40', conWE: false }),
        ))).toBe(true);
    });

    it('una operacion DISTINTA (otro id) con el mismo nombre y numero cuenta como nueva', () => {
        expect(hayEmptyOp(nuevos(
            doc({ conWE: true, id: 'op-vieja' }),
            doc({ conWE: false, id: 'op-nueva' }),
        ))).toBe(true);
    });
});

describe('issueKey — documentos viejos sin id', () => {
    it('sin `id` sigue funcionando por nombre (no rompe lo que ya andaba)', () => {
        const sinId = (nombre, conWE) => { const d = doc({ nombre, conWE }); delete d.operations[0].id; return d; };
        expect(nuevos(sinId('ENFUNDADO', false), sinId('ENFUNDADO', false)).critical).toHaveLength(0);
        expect(hayEmptyOp(nuevos(sinId('ENFUNDADO', true), sinId('ENFUNDADO', false)))).toBe(true);
    });
});

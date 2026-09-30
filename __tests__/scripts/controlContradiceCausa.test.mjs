/**
 * Tests del check CONTROL_CONTRADICE_CAUSA (rules/amfe.md §6 y §17.7; memoria
 * `feedback_un_control_no_puede_afirmar_lo_que_su_causa_niega`).
 *
 * La regla: si la causa dice que algo NO existe, el control de esa misma fila no puede
 * apoyarse en eso. La contradiccion esta adentro del renglon, asi que un script la ve.
 *
 * Origen: AMFE 173 (21/09/2026), cinco filas que decian "no hay X" en la causa y "X definido"
 * en el control; la tercera sostenia una D=8 con un patron que la propia causa declara
 * inexistente (sin metodo de deteccion la Tabla P3 da D=10).
 *
 * Que protege este test es el BORDE, donde el check se vuelve inutil:
 *  - si "Sin X" y "Falta de X" disparan solos, marca 149 controles de 2044 causas (medido el
 *    30/09/2026 sobre el backup de ese dia): casi todos son la forma corriente de nombrar una
 *    omision ("Proveedor sin certificado vigente" / "Certificado del proveedor por lote") y el
 *    control es justo la contramedida. Se ignora el check.
 *  - si marca "TBD - falta ...", castiga la honestidad: en el 173, 7 de las 12 candidatas eran
 *    asi y NO eran error.
 *  - si no marca "no hay un patron" contra "contra el patron del puesto", no sirve para nada.
 *
 * Los textos son los reales: los del 173 vienen de la memoria (la fila de la cuchilla solo
 * conserva de ella el final "no hay un criterio de cambio definido": el principio esta armado
 * para el test) y los demas de los AMFE del backup `backups/2026-09-30T14-52-14` (AMFE 172 y 173
 * actuales, y los de apoyacabezas).
 */
import { describe, it, expect } from 'vitest';
import {
    controlContradiceCausa,
    validateAmfeDoc,
    CRITICAL_TYPES,
} from '../../scripts/_lib/amfeValidator.mjs';

describe('controlContradiceCausa — CASOS QUE DEBEN SALTAR', () => {
    // Las cinco filas reales del AMFE 173 del 21/09/2026 (memoria citada arriba).
    it.each([
        ['guantes anticorte',
            'No hay guantes anticorte asignados al puesto en cantidad suficiente',
            'Guantes anticorte definidos como EPP del puesto'],
        ['patron de comparacion (la peor: sostenia D=8)',
            'El control es visual y no hay un patron de comparacion en el puesto',
            'Control visual contra el patron del puesto'],
        ['rotacion y pausa activa',
            'El ciclo del puesto es repetitivo y no hay rotacion ni pausa activa definidas',
            'Rotacion de puestos y pausa activa'],
        ['hora de preparacion en el envase',
            'El envase no lleva la hora de preparacion a la vista',
            'Identificacion del envase con la hora de preparacion'],
    ])('173: %s', (_nombre, causa, control) => {
        const r = controlContradiceCausa(causa, control);
        expect(r).not.toBeNull();
        expect(r.nivel).toBe('existencia');
        expect(r.compartidas.length).toBeGreaterThanOrEqual(2);
    });

    it('AMFE 172 actual: "No hay pieza patron" contra "Piezas patron definidas e identificadas por codigo"', () => {
        const r = controlContradiceCausa(
            'No hay pieza patron disponible para todos los codigos en el puesto de inspeccion',
            'Piezas patron de los conjuntos definidas e identificadas por codigo en el puesto');
        expect(r).not.toBeNull();
        expect(r.disparador).toBe('no hay');
    });

    it('"Falta de X" salta SOLO si el control afirma que X existe: ayudas visuales "disponibles"', () => {
        // Texto real de los AMFE ARM-PAT e INS-PAT.
        const r = controlContradiceCausa(
            'Omision por fatiga o distraccion: el operador olvida aplicar adhesivo en una seccion especifica por falta de ayudas visuales',
            'Instrucciones de proceso y ayudas visuales disponibles en el puesto');
        expect(r).not.toBeNull();
        expect(r.nivel).toBe('falta');
    });

    it('normaliza acentos y mayusculas', () => {
        const r = controlContradiceCausa(
            'NO HAY PATRÓN DE COMPARACIÓN EN EL PUESTO DE INSPECCIÓN',
            'Inspección visual contra el patrón de comparación');
        expect(r).not.toBeNull();
    });

    it('compara la raiz de 6 letras: definido = definida, puestos = puesto', () => {
        // Sin esto, "no hay un criterio de cambio definido" no ve a "Medida minima ... definida".
        const r = controlContradiceCausa(
            'Cuchilla usada hasta que corta mal porque no hay un criterio de cambio definido',
            'Medida minima de cuchilla definida y calibre en el puesto');
        expect(r).not.toBeNull();
    });

    it('caso limite que SI marca y lo decide el equipo: topes vs marcas de posicionado', () => {
        // AMFE 172 OP40: comparte "troquel/troqueladora" y "posicion/posicionado". Queda como
        // candidato: es un WARNING, y el control correcto lo define el equipo, no el validador.
        expect(controlContradiceCausa(
            'El troquel no tiene topes que limiten la posicion del conjunto',
            'Marcas de posicionado en la mesa de la troqueladora')).not.toBeNull();
    });
});

describe('controlContradiceCausa — CASOS QUE NO DEBEN SALTAR', () => {
    it('el control es honesto: "TBD - falta ..." (7 de las 12 candidatas del 173)', () => {
        expect(controlContradiceCausa(
            'No hay guantes anticorte asignados al puesto en cantidad suficiente',
            'TBD - falta definir los guantes anticorte del puesto')).toBeNull();
    });

    it('el control arranca diciendo que falta: "Sin registro de la hora ..." (AMFE 173 actual)', () => {
        expect(controlContradiceCausa(
            'La mezcla preparada no lleva la hora de preparacion a la vista',
            'Sin registro de la hora de preparacion de la mezcla')).toBeNull();
        expect(controlContradiceCausa(
            'No hay un limite superior de espera definido',
            'Sin control del tiempo de espera en el puesto')).toBeNull();
    });

    it('"Sin X" y "Falta de X" solos NO disparan: es la forma corriente de nombrar una omision', () => {
        // Textos reales de los AMFE de apoyacabezas y del 172: el control es la contramedida.
        expect(controlContradiceCausa(
            'Proveedor sin certificado VW 50180 vigente',
            'Certificado VW 50180 del proveedor por lote')).toBeNull();
        expect(controlContradiceCausa(
            'Falta de inspección visual al recibir',
            'Inspección visual en recepción.')).toBeNull();
        expect(controlContradiceCausa(
            'Falta de control dimensional en recepción',
            'Control dimensional por muestreo con calibre en recepción.')).toBeNull();
    });

    it('"sin seguir el metodo definido": el metodo EXISTE, lo que no se hace es seguirlo', () => {
        expect(controlContradiceCausa(
            'El control se reporta sin seguir el metodo definido para el material',
            'Metodo de control definido en el plan de control de recepcion del material')).toBeNull();
    });

    it('una sola palabra en comun no alcanza (hacen falta 2)', () => {
        // "alarma" es la unica compartida: no es la misma cosa.
        expect(controlContradiceCausa(
            'No hay alarma de vacio cuando cae la succion',
            'Alarma en pantalla de la mesa al caer la presion')).toBeNull();
    });

    it('las palabras del puesto de trabajo (puesto, operador, produccion) no cuentan como "lo mismo"', () => {
        expect(controlContradiceCausa(
            'No hay operador disponible en el puesto de produccion',
            'Operador asignado al puesto en produccion')).toBeNull();
    });

    it('la causa no niega nada', () => {
        expect(controlContradiceCausa(
            'Desgaste de la cuchilla por uso prolongado',
            'Cambio de cuchilla por desgaste segun plan')).toBeNull();
    });

    it('las palabras compartidas estan en el SUJETO de la causa, no en lo que niega', () => {
        // "costura" y "inspeccion" estan antes del disparador; lo negado es "rebaba".
        expect(controlContradiceCausa(
            'La inspeccion de la costura no tiene rebaba visible',
            'Inspeccion visual de la costura contra el patron')).toBeNull();
    });

    it('control vacio, "-" o nulo no explota', () => {
        expect(controlContradiceCausa('No hay patron de comparacion', '')).toBeNull();
        expect(controlContradiceCausa('No hay patron de comparacion', '-')).toBeNull();
        expect(controlContradiceCausa('No hay patron de comparacion', null)).toBeNull();
        expect(controlContradiceCausa(undefined, 'Control visual contra el patron')).toBeNull();
    });
});

/** AMFE minimo valido con una sola causa, para aislar el check. */
function docConCausa(causa, preventionControl, detectionControl) {
    return {
        operations: [{
            opNumber: '80', operationNumber: '80',
            name: 'INSPECCION FINAL', operationName: 'INSPECCION FINAL',
            focusElementFunction: 'Funcion Interna: a / Funcion del Cliente: b / Funcion del Usuario Final: c',
            operationFunction: 'Verificar el conjunto terminado',
            workElements: [{
                name: 'Pieza patron', type: 'Method',
                functions: [{
                    description: 'Comparar el conjunto contra el patron', functionDescription: 'Comparar el conjunto contra el patron',
                    failures: [{
                        description: 'Conjunto no conforme liberado', severity: 6,
                        effectLocal: 'Scrap', effectNextLevel: 'Para linea', effectEndUser: 'Falla en campo',
                        causes: [{
                            cause: causa, description: causa,
                            preventionControl, detectionControl,
                            occurrence: 3, detection: 6, ap: 'L', actionPriority: 'L',
                        }],
                    }],
                }],
            }],
        }],
    };
}

const issuesDe = (doc) => validateAmfeDoc(doc, 'TEST', 'T').all.filter(i => i.type === 'CONTROL_CONTRADICE_CAUSA');

describe('CONTROL_CONTRADICE_CAUSA dentro de validateAmfeDoc', () => {
    it('marca la fila y dice que campo y con que palabras', () => {
        const [i] = issuesDe(docConCausa(
            'El control es visual y no hay un patron de comparacion en el puesto',
            'Hoja de operacion con la secuencia del puesto',
            'Control visual contra el patron del puesto'));
        expect(i).toBeDefined();
        expect(i.campos).toEqual(['detectionControl']);
        expect(i.detail).toContain('detectionControl');
        expect(i.detail).toContain('no hay');
        expect(i.opNum).toBe('80');
    });

    it('un solo issue por causa aunque contradigan los dos controles', () => {
        // issueKey() no distingue el campo: dos issues iguales taparian al segundo en el diff.
        const lista = issuesDe(docConCausa(
            'No hay pieza patron disponible para todos los codigos en el puesto de inspeccion',
            'Piezas patron de los conjuntos definidas e identificadas por codigo en el puesto',
            'El registro de inspeccion final exige indicar la pieza patron utilizada'));
        expect(lista).toHaveLength(1);
        expect(lista[0].campos).toEqual(['preventionControl', 'detectionControl']);
    });

    it('es WARNING, no CRITICAL: no frena un --apply por deuda de otros AMFE', () => {
        expect(CRITICAL_TYPES.has('CONTROL_CONTRADICE_CAUSA')).toBe(false);
        const r = validateAmfeDoc(docConCausa(
            'No hay guantes anticorte asignados al puesto en cantidad suficiente',
            'Guantes anticorte definidos como EPP del puesto', 'Control visual 100%'), 'TEST', 'T');
        expect(r.warning.some(i => i.type === 'CONTROL_CONTRADICE_CAUSA')).toBe(true);
        expect(r.critical.some(i => i.type === 'CONTROL_CONTRADICE_CAUSA')).toBe(false);
    });

    it('no marca la fila corregida a "TBD - falta ..."', () => {
        expect(issuesDe(docConCausa(
            'No hay guantes anticorte asignados al puesto en cantidad suficiente',
            'TBD - falta definir los guantes anticorte del puesto',
            'Control visual 100%'))).toHaveLength(0);
    });

    it('no marca una causa comun con su contramedida', () => {
        expect(issuesDe(docConCausa(
            'Proveedor sin certificado VW 50180 vigente',
            'Certificado VW 50180 del proveedor por lote',
            'Verificacion documental 100% del certificado'))).toHaveLength(0);
    });
});

/**
 * _completarGapsPatagonia20260820.mjs — 3 de los 4 gaps de contenido pedidos por Fak el
 * 20/08/2026 (el 4to, espumado 153/155 desde 151, NO se aplica: ver nota abajo).
 *
 * FUENTE UNICA (no se inventa nada): el bloque "control de pieza inyectada" que YA vive
 * dentro de la operacion 20 de VWA-PAT-IPPADS-001 (OP 20-26 INYECCION DE SUSTRATOS Y
 * CONTROL). De ahi se copian, adaptando SOLO el nombre de la pieza (sustrato -> pieza
 * inyectada; se saca "dispositivo de cota index" porque es una herramienta propia del
 * IP Pad que no esta confirmada en los otros productos):
 *
 *   WE Man "Operador de Produccion"  -> funciones "validar 1a pieza antes de liberar el
 *      lote" e "inspeccionar 100% y segregar" (la funcion 1, autocontrol al descargar la
 *      pieza, YA esta propagada en ARM-PAT/INS-PAT/TR-PAT desde una corrida anterior — no
 *      se duplica).
 *   WE Measurement "Balanza calibrada y calibre patron" (nombre adaptado)
 *   WE Measurement "Pieza patron de defectos"
 *   WE Method "Procedimiento de liberacion de primera pieza"
 *   WE Method "Procedimiento de control de inyeccion" (funcion adaptada)
 *
 * ITEM 1 — AMFE-ARM-PAT: nueva OP 61 "CONTROL DE PIEZA INYECTADA" con las 5 WE completas.
 *   El flujograma 153 Rev.B declara esta operacion como "51" entre "50 INYECCION DE PIEZAS
 *   PLASTICAS" y "60 INYECCION PU (POLIURETANO)". La numeracion ABSOLUTA de AMFE-ARM-PAT
 *   NO es la del flujograma (el AMFE ya usa 50/51 para COSTURA UNION/COSTURA DOBLE, 60 para
 *   INYECCION DE PIEZAS PLASTICAS y 70 para INYECCION PU) — se verifico la numeracion real
 *   antes de tocar nada. Usar "51" hubiera CHOCADO con la OP 51 COSTURA DOBLE existente.
 *   Se uso "61" (mismo patron de sub-numeracion que ya usa el propio documento en 50/51),
 *   entre la 60 y la 70 reales.
 *
 * ITEM 2 — AMFE-INS-PAT (OP 70) y AMFE-TR-PAT (OP 10): sus flujogramas (154 Rev.A, 155
 *   Rev.B) NO declaran una operacion de control separada, asi que NO se crea operacion
 *   nueva: se agregan solo las 2 WE Measurement dentro de la operacion de inyeccion
 *   plastica existente de cada uno.
 *
 * ITEM 3 — AMFE 149, split de OP 90 en 90/91 — NO SE APLICA.
 *   Se leyo el contenido COMPLETO de la OP 90 (VWA-PAT-IPPADS-001) antes de tocar nada: 2
 *   WE, ambas 100% sobre alineacion/pre-fixing/clamps (ninguna menciona tapizado, calor
 *   superior ni fijado superior). La premisa de "contenido mezclado" no es cierta en el
 *   dato vivo — no hay nada que repartir. Se busco tambien en el resto del documento
 *   (grep de "superior/calor/tapiz/fijado" sobre las 19 operaciones): nada corresponde a
 *   la estacion de tapizado y fijado superior. Crear una OP 91 vacia dispara el check
 *   CRITICAL `EMPTY_OP` del validator (por diseño: evita que un script deje operaciones
 *   fantasma) — no se fuerza con --allow-new-critical porque no hay contenido real detras.
 *   Reportado a Fak: falta la hoja de operaciones/HO-985 para dictar los modos de falla
 *   reales de esa estacion.
 *
 * ITEM 4 — AMFE 153/155, espumado 42/50/51 desde AMFE-HF-PAT (151) — NO SE APLICA.
 *   Se leyo el contenido de las OP 42, 50 y 51 de AMFE-HF-PAT (151) antes de copiar nada:
 *   las 3 estan COMPLETAMENTE VACIAS (workElements=[], operationFunction="") en el dato
 *   vivo. La premisa "el delantero ya tiene con contenido" no es cierta hoy — no hay fuente
 *   para copiar. Ademas hay colision de numeracion real: el flujograma 152 dice 42/50/51,
 *   pero 153/155 usan 40 ENFUNDADO / 41 INSERCION DE VARILLA / 52 INYECCION DE PU (post
 *   fix del 18/08). No se crean operaciones nuevas sin contenido. Reportado a Fak: el
 *   hueco de PRECINTO / BOLSA Y CARGA AL MOLDE / CIERRE DEL MOLDE existe en LOS TRES
 *   apoyacabezas (151, 153, 155), no solo en los traseros.
 *
 * Uso:  node scripts/_completarGapsPatagonia20260820.mjs           (dry-run)
 *       node scripts/_completarGapsPatagonia20260820.mjs --apply
 */

import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, parseData, saveAmfe, calculateAP, findOperation,
    syncLegacyFmFields, syncFieldAliases, normalizeText,
} from './_lib/amfeIo.mjs';

function esOpDeInyeccionPlastica(op) {
    return normalizeText(op.name || op.operationName || '').includes('inyeccion');
}

const FECHA = '20/08/2026';

// ─── Builders de contenido (copiado y adaptado de VWA-PAT-IPPADS-001 OP 20) ─────────────

function mkCause({ desc, s, o, d, prev, det }) {
    const ap = calculateAP(s, o, d);
    return {
        id: randomUUID(),
        cause: desc, description: desc,
        severity: s, occurrence: o, detection: d,
        ap, actionPriority: ap,
        specialChar: '',
        preventionControl: prev,
        detectionControl: det,
        preventionAction: ap === 'H' ? 'Pendiente definicion equipo APQP' : '',
        detectionAction: '', optimizationAction: '',
        responsible: '', targetDate: '', status: '', completionDate: '',
        characteristicNumber: '',
        _autoFilled: true,
    };
}

function mkFailure({ desc, local, next, end, causas }) {
    return {
        id: randomUUID(),
        description: desc,
        effectLocal: local, effectNextLevel: next, effectEndUser: end,
        causes: causas.map(mkCause),
    };
}

function mkFn({ desc, failures }) {
    return {
        id: randomUUID(),
        description: desc, functionDescription: desc,
        requirements: '',
        failures,
    };
}

/** Las 2 WE Measurement del bloque de control — comunes a los 3 items. */
function buildMeasurementWEs() {
    return [
        {
            id: randomUUID(),
            name: 'Balanza calibrada y calibre patron',
            type: 'Measurement',
            functions: [mkFn({
                desc: 'Medir peso y dimension de la primera pieza',
                failures: [mkFailure({
                    desc: 'Instrumento descalibrado libera pieza fuera de tolerancia',
                    local: 'Pieza fuera de tolerancia liberada',
                    next: 'Defecto dimensional avanza en el proceso',
                    end: 'Falla de ensamble o apariencia',
                    causas: [{
                        desc: 'Instrumento fuera de calibracion', s: 7, o: 2, d: 5,
                        prev: 'Calibracion de instrumentos vigente',
                        det: 'Verificacion de calibracion en set-up',
                    }],
                })],
            })],
        },
        {
            id: randomUUID(),
            name: 'Pieza patron de defectos',
            type: 'Measurement',
            functions: [mkFn({
                desc: 'Servir de referencia de defectos de inyeccion',
                failures: [mkFailure({
                    desc: 'Pieza patron ausente o desactualizada',
                    local: 'Control sin referencia de defectos',
                    next: 'Defecto no reconocido en control',
                    end: 'Defecto enviado al cliente',
                    causas: [{
                        desc: 'Pieza patron no disponible en el puesto', s: 6, o: 2, d: 5,
                        prev: 'Gestion de muestras patron por Calidad',
                        det: 'Verificacion de muestra en set-up',
                    }],
                })],
            })],
        },
    ];
}

/** Las 2 WE Method del bloque de control — solo para el item 1 (ARM-PAT, operacion nueva). */
function buildMethodWEs() {
    return [
        {
            id: randomUUID(),
            name: 'Procedimiento de liberacion de primera pieza',
            type: 'Method',
            functions: [mkFn({
                desc: 'Definir criterios de liberacion de la primera pieza',
                failures: [mkFailure({
                    desc: 'Criterio de liberacion no aplicado',
                    local: 'Liberacion sin cumplir criterios',
                    next: 'Lote con defecto no detectado',
                    end: 'Defecto enviado al cliente',
                    causas: [{
                        desc: 'Procedimiento de liberacion desactualizado', s: 6, o: 3, d: 4,
                        prev: 'Control de documentos P-05',
                        det: 'Auditoria de proceso',
                    }],
                })],
            })],
        },
        {
            id: randomUUID(),
            name: 'Procedimiento de control de inyeccion',
            type: 'Method',
            functions: [mkFn({
                // Adaptado: "del sustrato" -> "de la pieza inyectada" (149 es IP Pad, el resto no).
                desc: 'Definir criterios de aceptacion y segregacion de la pieza inyectada',
                failures: [mkFailure({
                    desc: 'Pieza no conforme no segregada a scrap',
                    local: 'Pieza no conforme mezclada con conformes',
                    next: 'Retrabajo o scrap aguas abajo',
                    end: 'Defecto enviado al cliente',
                    causas: [{
                        desc: 'Cajon de scrap no utilizado', s: 6, o: 3, d: 5,
                        prev: 'Procedimiento P-13 producto no conforme',
                        det: 'Inspeccion del lider',
                    }],
                })],
            })],
        },
    ];
}

/** WE Man con las 2 funciones de control que NO estan ya propagadas — solo item 1. */
function buildManWE(nextLevelLiberacion) {
    return {
        id: randomUUID(),
        name: 'Operador de Producción',
        type: 'Man',
        functions: [
            mkFn({
                desc: 'Validar la primera pieza inyectada antes de liberar el lote',
                failures: [
                    mkFailure({
                        desc: 'Liberacion de primera pieza no conforme',
                        local: 'Se libera el lote con defecto de inyeccion',
                        next: nextLevelLiberacion,
                        end: 'Defecto visible o funcional en el habitaculo',
                        causas: [
                            {
                                desc: 'Comparacion con pieza patron omitida', s: 7, o: 3, d: 4,
                                prev: 'Pieza patron en el puesto',
                                det: 'Comparacion con pieza patron 100%',
                            },
                            {
                                desc: 'Autocontrol al arranque no realizado', s: 7, o: 3, d: 5,
                                prev: 'Instruccion de liberacion de primera pieza',
                                det: 'Registro de primera pieza firmado',
                            },
                        ],
                    }),
                    mkFailure({
                        desc: 'Peso de pieza fuera de rango no detectado',
                        local: 'Pieza fuera de peso liberada como conforme',
                        next: 'Falta de llenado o rechupe no detectado',
                        end: 'Falla dimensional o de apariencia',
                        causas: [{
                            desc: 'Pesaje de piezas omitido', s: 6, o: 3, d: 5,
                            prev: 'Instruccion de pesaje al arranque',
                            det: 'Pesaje en balanza calibrada',
                        }],
                    }),
                ],
            }),
            mkFn({
                desc: 'Inspeccionar 100% las piezas inyectadas y segregar no conformes',
                failures: [
                    mkFailure({
                        // Adaptado: "Sustrato defectuoso..." -> "Pieza defectuosa..."
                        desc: 'Defecto de inyeccion no detectado',
                        local: 'Pieza defectuosa pasa como conforme',
                        next: 'Defecto se detecta en tapizado o control final',
                        end: 'Defecto de apariencia o funcional en el habitaculo',
                        causas: [
                            {
                                desc: 'Inspeccion visual incompleta', s: 7, o: 3, d: 5,
                                prev: 'Inspeccion visual 100% con pieza patron',
                                det: 'Inspeccion visual 100%',
                            },
                            {
                                desc: 'Comparacion con pieza patron omitida', s: 7, o: 3, d: 4,
                                prev: 'Pieza patron de defectos en el puesto',
                                det: 'Comparacion con pieza patron',
                            },
                        ],
                    }),
                    mkFailure({
                        desc: 'Codigo grabado no verificado',
                        local: 'Referencia equivocada pasa como conforme',
                        next: 'Mezcla de referencias en tapizado',
                        end: 'Pieza equivocada en el vehiculo',
                        causas: [{
                            desc: 'Verificacion de codigo vs planilla omitida', s: 6, o: 3, d: 4,
                            prev: 'Planilla de produccion en el puesto',
                            det: 'Verificacion visual del codigo grabado',
                        }],
                    }),
                ],
            }),
        ],
    };
}

// ─── Helper: agregar entrada de revisions (append, nunca pisar) ────────────────────────

function addRevision(doc, { item, details }) {
    if (!Array.isArray(doc.revisions)) doc.revisions = [];
    doc.revisions.push({
        rev: 'A', date: FECHA, item, details, pswDate: '', modifiedBy: 'FS',
    });
}

// ─── Main ───────────────────────────────────────────────────────────────────────────────

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

async function fetchDoc(amfeNumber) {
    const { data: rows, error } = await sb
        .from('amfe_documents').select('id, amfe_number, data').eq('amfe_number', amfeNumber).limit(1);
    if (error) throw error;
    if (!rows[0]) throw new Error(`No se encontro ${amfeNumber}`);
    const row = rows[0];
    return { id: row.id, amfeNumber: row.amfe_number, before: parseData(row.data), doc: parseData(row.data) };
}

const plan = [];
const commits = [];

// ── ITEM 1: AMFE-ARM-PAT — nueva OP 61 CONTROL DE PIEZA INYECTADA ──────────────────────
{
    const { id, amfeNumber, before, doc } = await fetchDoc('AMFE-ARM-PAT');

    const op60 = findOperation(doc, '60');
    const op70 = findOperation(doc, '70');
    if (!op60 || !op70) throw new Error('AMFE-ARM-PAT: no se encontraron OP 60/70 para verificar el hueco');
    if (findOperation(doc, '61')) throw new Error('AMFE-ARM-PAT: la OP 61 ya existe, no se pisa');

    const nuevaOp = {
        id: randomUUID(),
        opNumber: '61', operationNumber: '61',
        name: 'CONTROL DE PIEZA INYECTADA', operationName: 'CONTROL DE PIEZA INYECTADA',
        focusElementFunction: op60.focusElementFunction,
        operationFunction: 'Verificar la conformidad de la pieza inyectada antes de avanzar a inyeccion PU, segregando las no conformes',
        workElements: [
            buildManWE('Piezas defectuosas avanzan a inyeccion PU'),
            ...buildMeasurementWEs(),
            ...buildMethodWEs(),
        ],
    };

    const idx60 = doc.operations.findIndex(o => (o.opNumber || o.operationNumber) === '60');
    doc.operations.splice(idx60 + 1, 0, nuevaOp);

    addRevision(doc, {
        item: '61',
        details: 'SE AGREGA LA OP 61 CONTROL DE PIEZA INYECTADA (FLUJOGRAMA 153 REV.B), ENTRE INYECCION PLASTICA (60) E INYECCION PU (70). CONTENIDO ADAPTADO DE VWA-PAT-IPPADS-001.',
    });

    syncLegacyFmFields(doc);
    syncFieldAliases(doc);

    const weCount = nuevaOp.workElements.length;
    const fmCount = nuevaOp.workElements.reduce((n, we) => n + we.functions.reduce((m, fn) => m + fn.failures.length, 0), 0);
    logChange(apply, `AMFE-ARM-PAT: nueva OP 61 con ${weCount} WE / ${fmCount} modos de falla`, {});

    plan.push({ id, amfeNumber, productName: 'ARMREST DOOR PANEL', before, after: doc });
    commits.push(async () => {
        await saveAmfe(sb, id, doc, { expectedAmfeNumber: amfeNumber });
    });
}

// ── ITEM 2a: AMFE-INS-PAT — WE Measurement dentro de OP 70 ─────────────────────────────
{
    const { id, amfeNumber, before, doc } = await fetchDoc('AMFE-INS-PAT');
    const op70 = findOperation(doc, '70');
    if (!op70) throw new Error('AMFE-INS-PAT: no se encontro OP 70');
    if (!esOpDeInyeccionPlastica(op70)) {
        throw new Error(`AMFE-INS-PAT: OP 70 no es de inyeccion plastica (name="${op70.name}")`);
    }
    const yaExiste = (nombre) => (op70.workElements || []).some(we => (we.name || '').toLowerCase() === nombre.toLowerCase());
    const nuevasWEs = buildMeasurementWEs().filter(we => !yaExiste(we.name));
    op70.workElements.push(...nuevasWEs);

    addRevision(doc, {
        item: '70',
        details: 'SE AGREGA CONTROL DE PIEZA INYECTADA (WE MEASUREMENT: BALANZA/CALIBRE Y PIEZA PATRON) EN LA OP 70. CONTENIDO ADAPTADO DE VWA-PAT-IPPADS-001.',
    });

    syncLegacyFmFields(doc);
    syncFieldAliases(doc);

    logChange(apply, `AMFE-INS-PAT: OP 70 + ${nuevasWEs.length} WE Measurement`, { WEs: nuevasWEs.map(w => w.name).join(', ') });

    plan.push({ id, amfeNumber, productName: 'INSERT', before, after: doc });
    commits.push(async () => {
        await saveAmfe(sb, id, doc, { expectedAmfeNumber: amfeNumber });
    });
}

// ── ITEM 2b: AMFE-TR-PAT — WE Measurement dentro de OP 10 ──────────────────────────────
{
    const { id, amfeNumber, before, doc } = await fetchDoc('AMFE-TR-PAT');
    const op10 = findOperation(doc, '10');
    if (!op10) throw new Error('AMFE-TR-PAT: no se encontro OP 10');
    if (!esOpDeInyeccionPlastica(op10)) {
        throw new Error(`AMFE-TR-PAT: OP 10 no es de inyeccion plastica (name="${op10.name}")`);
    }
    const yaExiste = (nombre) => (op10.workElements || []).some(we => (we.name || '').toLowerCase() === nombre.toLowerCase());
    const nuevasWEs = buildMeasurementWEs().filter(we => !yaExiste(we.name));
    op10.workElements.push(...nuevasWEs);

    addRevision(doc, {
        item: '10',
        details: 'SE AGREGA CONTROL DE PIEZA INYECTADA (WE MEASUREMENT: BALANZA/CALIBRE Y PIEZA PATRON) EN LA OP 10. CONTENIDO ADAPTADO DE VWA-PAT-IPPADS-001.',
    });

    syncLegacyFmFields(doc);
    syncFieldAliases(doc);

    logChange(apply, `AMFE-TR-PAT: OP 10 + ${nuevasWEs.length} WE Measurement`, { WEs: nuevasWEs.map(w => w.name).join(', ') });

    plan.push({ id, amfeNumber, productName: 'TOP ROLL', before, after: doc });
    commits.push(async () => {
        await saveAmfe(sb, id, doc, { expectedAmfeNumber: amfeNumber });
    });
}

console.log('\n--- ITEM 3 (AMFE 149, split OP 90/91) y ITEM 4 (AMFE 153/155, espumado desde 151): NO SE APLICAN ---');
console.log('    Ver comentario de cabecera del script — premisa de contenido/fuente no se confirmo en el dato vivo.');

await runWithValidation(plan, apply, async () => {
    for (const c of commits) await c();
});

finish(apply);

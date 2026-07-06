/**
 * amfeChangeDiff.ts — Motor de diff de contenido entre dos versiones de un AMFE.
 *
 * Puro (sin I/O). Compara dos AmfeDocument y devuelve una lista de cambios
 * legibles en espanol (una entrada por campo cambiado / item agregado / eliminado),
 * para el registro amfe_change_log (diff-on-save) y el resumen de la caratula.
 *
 * Matching por `id` (uuid) en los 5 niveles: operacion → WE → funcion → falla → causa.
 * NO se compara por serializacion completa (eso perderia el detalle "O 6 → 4").
 * Ignora los campos @deprecated del failure (se usa causes[]).
 *
 * Cap anti-flood: si el diff supera MAX_ENTRIES (import/renumeracion masiva),
 * colapsa a una unica entrada scope='document'.
 */

import type {
    AmfeDocument, AmfeHeaderData, AmfeOperation, AmfeWorkElement,
    AmfeFunction, AmfeFailure, AmfeCause,
} from './amfeTypes';

export type ChangeScope = 'header' | 'operation' | 'workElement' | 'function' | 'failure' | 'cause' | 'document';
export type ChangeType = 'added' | 'removed' | 'modified';

export interface AmfeChangeEntry {
    scope: ChangeScope;
    changeType: ChangeType;
    opNumber: string;
    /** Ruta legible del item: "OP 30 COSTURA / Falla 'X' / Causa 'Y'". */
    itemLabel: string;
    /** Campo cambiado (solo para 'modified'). */
    field: string;
    oldValue: string;
    newValue: string;
    /** Resumen humano en espanol argentino. */
    summary: string;
}

/** Umbral: por encima de esto se colapsa a una entrada 'document' (renumeracion/import). */
export const MAX_ENTRIES = 300;

// ---------------------------------------------------------------------------
// Etiquetas de campo en espanol (para los resumenes)
// ---------------------------------------------------------------------------

const HEADER_LABELS: Partial<Record<keyof AmfeHeaderData, string>> = {
    organization: 'Organización', location: 'Locación', client: 'Cliente',
    modelYear: 'Modelo-Año', subject: 'Tema', startDate: 'Fecha de inicio',
    team: 'Equipo', amfeNumber: 'N° de AMFE', responsible: 'Responsable',
    confidentiality: 'Confidencialidad', partNumber: 'N° de pieza',
    processResponsible: 'Responsable del proceso', approvedBy: 'Aprobado por',
    scope: 'Alcance', applicableParts: 'Piezas aplicables',
    // revision y revDate se excluyen: los cambia la oficializacion, no el contenido.
};

const OP_LABELS: Record<string, string> = {
    opNumber: 'N° de operación', name: 'Nombre de operación',
    focusElementFunction: 'Función del ítem', operationFunction: 'Función del paso',
};
const WE_LABELS: Record<string, string> = { type: 'Tipo 6M', name: 'Elemento de trabajo' };
const FN_LABELS: Record<string, string> = { description: 'Función', requirements: 'Requisitos' };
const FAIL_LABELS: Record<string, string> = {
    description: 'Modo de falla', effectLocal: 'Efecto local',
    effectNextLevel: 'Efecto planta cliente', effectEndUser: 'Efecto usuario final',
    severity: 'Severidad',
};
const CAUSE_LABELS: Record<string, string> = {
    cause: 'Causa', preventionControl: 'Control preventivo', detectionControl: 'Control de detección',
    occurrence: 'Ocurrencia', detection: 'Detección', ap: 'AP',
    characteristicNumber: 'N° característica', specialChar: 'Característica especial',
    filterCode: 'Código de filtro', preventionAction: 'Acción preventiva',
    detectionAction: 'Acción de detección', responsible: 'Responsable', targetDate: 'Fecha objetivo',
    status: 'Estado', actionTaken: 'Acción tomada', completionDate: 'Fecha de cierre',
    severityNew: 'S nueva', occurrenceNew: 'O nueva', detectionNew: 'D nueva', apNew: 'AP nueva',
    observations: 'Observaciones',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const s = (v: unknown): string => (v == null ? '' : String(v).trim());
const eq = (a: unknown, b: unknown): boolean => s(a) === s(b);
const trunc = (v: string, n = 60): string => (v.length > n ? v.slice(0, n - 1) + '…' : v);
const short = (v: unknown, n = 32): string => trunc(s(v), n);
const byId = <T extends { id?: string }>(arr: T[] | undefined): Map<string, T> =>
    new Map((arr ?? []).filter(x => x && x.id).map(x => [x.id as string, x]));

/** Etiqueta de operacion para los resumenes: "OP 30 COSTURA". */
function opLabel(op: Pick<AmfeOperation, 'opNumber' | 'name'>): string {
    const num = s(op.opNumber);
    const name = s(op.name);
    return `OP ${num}${name ? ' ' + name : ''}`.trim();
}

/** Compara escalares de un objeto y emite una entrada 'modified' por campo cambiado. */
function diffFields<T extends Record<string, unknown>>(
    oldObj: T, newObj: T, labels: Record<string, string>,
    ctx: { scope: ChangeScope; opNumber: string; itemLabel: string; prefix: string },
    out: AmfeChangeEntry[],
): void {
    for (const [field, label] of Object.entries(labels)) {
        const ov = oldObj[field];
        const nv = newObj[field];
        if (eq(ov, nv)) continue;
        const oldValue = s(ov);
        const newValue = s(nv);
        const arrow = oldValue && newValue
            ? `${label} '${trunc(oldValue)}' → '${trunc(newValue)}'`
            : oldValue
                ? `${label} borrado (era '${trunc(oldValue)}')`
                : `${label} '${trunc(newValue)}'`;
        out.push({
            scope: ctx.scope, changeType: 'modified', opNumber: ctx.opNumber,
            itemLabel: ctx.itemLabel, field, oldValue, newValue,
            summary: `${ctx.prefix}${arrow}`,
        });
    }
}

// ---------------------------------------------------------------------------
// Diff por nivel
// ---------------------------------------------------------------------------

function diffCauses(
    oldFail: AmfeFailure, newFail: AmfeFailure, opNumber: string, failLabel: string, out: AmfeChangeEntry[],
): void {
    const oldMap = byId<AmfeCause>(oldFail.causes);
    const newMap = byId<AmfeCause>(newFail.causes);
    for (const [id, nc] of newMap) {
        const oc = oldMap.get(id);
        const label = `${failLabel} / Causa '${short(nc.cause)}'`;
        if (!oc) {
            out.push({ scope: 'cause', changeType: 'added', opNumber, itemLabel: label, field: '', oldValue: '', newValue: s(nc.cause),
                summary: `${prefixOp(opNumber)}nueva causa '${short(nc.cause)}'` });
        } else {
            diffFields(oc as unknown as Record<string, unknown>, nc as unknown as Record<string, unknown>, CAUSE_LABELS,
                { scope: 'cause', opNumber, itemLabel: label, prefix: `${prefixOp(opNumber)}Causa '${short(nc.cause)}': ` }, out);
        }
    }
    for (const [id, oc] of oldMap) {
        if (!newMap.has(id)) {
            const label = `${failLabel} / Causa '${short(oc.cause)}'`;
            out.push({ scope: 'cause', changeType: 'removed', opNumber, itemLabel: label, field: '', oldValue: s(oc.cause), newValue: '',
                summary: `${prefixOp(opNumber)}se eliminó la causa '${short(oc.cause)}'` });
        }
    }
}

function diffFailures(
    oldFn: AmfeFunction, newFn: AmfeFunction, opNumber: string, fnLabel: string, out: AmfeChangeEntry[],
): void {
    const oldMap = byId<AmfeFailure>(oldFn.failures);
    const newMap = byId<AmfeFailure>(newFn.failures);
    for (const [id, nf] of newMap) {
        const of = oldMap.get(id);
        const label = `${fnLabel} / Falla '${short(nf.description)}'`;
        if (!of) {
            out.push({ scope: 'failure', changeType: 'added', opNumber, itemLabel: label, field: '', oldValue: '', newValue: s(nf.description),
                summary: `${prefixOp(opNumber)}nueva falla '${short(nf.description)}' (S=${s(nf.severity) || '—'}, ${(nf.causes ?? []).length} causa(s))` });
        } else {
            diffFields(of as unknown as Record<string, unknown>, nf as unknown as Record<string, unknown>, FAIL_LABELS,
                { scope: 'failure', opNumber, itemLabel: label, prefix: `${prefixOp(opNumber)}Falla '${short(nf.description)}': ` }, out);
            diffCauses(of, nf, opNumber, label, out);
        }
    }
    for (const [id, of] of oldMap) {
        if (!newMap.has(id)) {
            const label = `${fnLabel} / Falla '${short(of.description)}'`;
            out.push({ scope: 'failure', changeType: 'removed', opNumber, itemLabel: label, field: '', oldValue: s(of.description), newValue: '',
                summary: `${prefixOp(opNumber)}se eliminó la falla '${short(of.description)}'` });
        }
    }
}

function diffFunctions(
    oldWe: AmfeWorkElement, newWe: AmfeWorkElement, opNumber: string, weLabel: string, out: AmfeChangeEntry[],
): void {
    const oldMap = byId<AmfeFunction>(oldWe.functions);
    const newMap = byId<AmfeFunction>(newWe.functions);
    for (const [id, nf] of newMap) {
        const of = oldMap.get(id);
        const label = `${weLabel} / Función '${short(nf.description)}'`;
        if (!of) {
            out.push({ scope: 'function', changeType: 'added', opNumber, itemLabel: label, field: '', oldValue: '', newValue: s(nf.description),
                summary: `${prefixOp(opNumber)}nueva función '${short(nf.description)}'` });
        } else {
            diffFields(of as unknown as Record<string, unknown>, nf as unknown as Record<string, unknown>, FN_LABELS,
                { scope: 'function', opNumber, itemLabel: label, prefix: `${prefixOp(opNumber)}Función: ` }, out);
            diffFailures(of, nf, opNumber, label, out);
        }
    }
    for (const [id, of] of oldMap) {
        if (!newMap.has(id)) {
            out.push({ scope: 'function', changeType: 'removed', opNumber, itemLabel: `${weLabel} / Función '${short(of.description)}'`, field: '', oldValue: s(of.description), newValue: '',
                summary: `${prefixOp(opNumber)}se eliminó la función '${short(of.description)}'` });
        }
    }
}

function diffWorkElements(
    oldOp: AmfeOperation, newOp: AmfeOperation, opNumber: string, out: AmfeChangeEntry[],
): void {
    const oldMap = byId<AmfeWorkElement>(oldOp.workElements);
    const newMap = byId<AmfeWorkElement>(newOp.workElements);
    for (const [id, nwe] of newMap) {
        const owe = oldMap.get(id);
        const label = `${opLabel(newOp)} / ${short(nwe.name)}`;
        if (!owe) {
            out.push({ scope: 'workElement', changeType: 'added', opNumber, itemLabel: label, field: '', oldValue: '', newValue: s(nwe.name),
                summary: `${prefixOp(opNumber)}nuevo elemento '${short(nwe.name)}' (${s(nwe.type)})` });
        } else {
            diffFields(owe as unknown as Record<string, unknown>, nwe as unknown as Record<string, unknown>, WE_LABELS,
                { scope: 'workElement', opNumber, itemLabel: label, prefix: `${prefixOp(opNumber)}Elemento '${short(nwe.name)}': ` }, out);
            diffFunctions(owe, nwe, opNumber, label, out);
        }
    }
    for (const [id, owe] of oldMap) {
        if (!newMap.has(id)) {
            out.push({ scope: 'workElement', changeType: 'removed', opNumber, itemLabel: `${opLabel(newOp)} / ${short(owe.name)}`, field: '', oldValue: s(owe.name), newValue: '',
                summary: `${prefixOp(opNumber)}se eliminó el elemento '${short(owe.name)}'` });
        }
    }
}

// Prefijo de resumen por operacion.
const prefixOp = (opNumber: string): string => `OP ${opNumber} — `;

// ---------------------------------------------------------------------------
// API publica
// ---------------------------------------------------------------------------

/**
 * Diff de contenido entre dos versiones de un AMFE.
 * Devuelve la lista de cambios (una entrada por campo/item). Si supera MAX_ENTRIES,
 * colapsa a una unica entrada scope='document'.
 */
export function diffAmfeDocs(oldDoc: AmfeDocument | null, newDoc: AmfeDocument): AmfeChangeEntry[] {
    if (!oldDoc) {
        return [{
            scope: 'document', changeType: 'added', opNumber: '', itemLabel: '', field: '', oldValue: '', newValue: '',
            summary: 'Creación del documento',
        }];
    }

    const out: AmfeChangeEntry[] = [];

    // Header (excluye revision/revDate)
    diffFields(
        oldDoc.header as unknown as Record<string, unknown>,
        newDoc.header as unknown as Record<string, unknown>,
        HEADER_LABELS as Record<string, string>,
        { scope: 'header', opNumber: '', itemLabel: 'Carátula', prefix: 'Carátula — ' },
        out,
    );

    // Operaciones (match por id)
    const oldMap = byId<AmfeOperation>(oldDoc.operations);
    const newMap = byId<AmfeOperation>(newDoc.operations);
    for (const [id, nop] of newMap) {
        const oop = oldMap.get(id);
        const opNumber = s(nop.opNumber);
        if (!oop) {
            out.push({ scope: 'operation', changeType: 'added', opNumber, itemLabel: opLabel(nop), field: '', oldValue: '', newValue: s(nop.name),
                summary: `Nueva operación ${opLabel(nop)}` });
        } else {
            diffFields(oop as unknown as Record<string, unknown>, nop as unknown as Record<string, unknown>, OP_LABELS,
                { scope: 'operation', opNumber, itemLabel: opLabel(nop), prefix: `${prefixOp(opNumber)}` }, out);
            diffWorkElements(oop, nop, opNumber, out);
        }
        if (out.length > MAX_ENTRIES) return collapsed(out.length);
    }
    for (const [id, oop] of oldMap) {
        if (!newMap.has(id)) {
            out.push({ scope: 'operation', changeType: 'removed', opNumber: s(oop.opNumber), itemLabel: opLabel(oop), field: '', oldValue: s(oop.name), newValue: '',
                summary: `Se eliminó la operación ${opLabel(oop)}` });
        }
    }

    if (out.length > MAX_ENTRIES) return collapsed(out.length);
    return out;
}

function collapsed(n: number): AmfeChangeEntry[] {
    return [{
        scope: 'document', changeType: 'modified', opNumber: '', itemLabel: '', field: '', oldValue: '', newValue: '',
        summary: `Reestructuración masiva del documento (${n}+ cambios)`,
    }];
}

/** Reconstruye el resumen humano de una entrada (util para tests / re-render). */
export function buildChangeSummary(entry: AmfeChangeEntry): string {
    return entry.summary;
}

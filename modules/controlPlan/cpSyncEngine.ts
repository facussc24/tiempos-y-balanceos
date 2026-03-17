/**
 * CP Sync Engine — Rule-based AMFE ↔ Control Plan synchronization detector
 *
 * Compares current AMFE data against existing CP items using the
 * traceability links (amfeCauseIds, amfeFailureId) to detect:
 * - Causes that changed text, controls, or S/O/D values
 * - New causes with AP=H/M that have no CP coverage
 * - Deleted causes still referenced by CP items
 * - AP level changes that require CP control updates
 *
 * 100% free, zero weight, instant — no AI model needed.
 */

import type { AmfeDocument, AmfeCause, AmfeFailure } from '../amfe/amfeTypes';
import type { ControlPlanDocument, ControlPlanItem } from './controlPlanTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncAlert {
    id: string;
    severity: 'high' | 'medium' | 'low';
    type:
        | 'cause_changed'
        | 'cause_added'
        | 'cause_removed'
        | 'severity_changed'
        | 'ap_changed'
        | 'control_changed'
        | 'failure_changed'
        | 'orphan_cause';
    message: string;
    detail: string;
    operationNumber: string;
    /** CP item ID to update when applying the alert */
    cpItemId?: string;
    /** AMFE cause ID that triggered the alert */
    amfeCauseId?: string;
    /** Suggested corrective action (human-readable) */
    suggestedAction?: string;
    /** Structured patch for auto-apply — null if manual action required */
    patch?: {
        field: keyof ControlPlanItem;
        newValue: string | number;
    } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a lookup of all AMFE causes indexed by cause ID. */
function buildCauseIndex(amfe: AmfeDocument): Map<string, {
    cause: AmfeCause;
    failure: AmfeFailure;
    operationNumber: string;
    operationDescription: string;
}> {
    const index = new Map<string, {
        cause: AmfeCause;
        failure: AmfeFailure;
        operationNumber: string;
        operationDescription: string;
    }>();

    for (const op of amfe.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    for (const cause of fail.causes) {
                        index.set(cause.id, {
                            cause,
                            failure: fail,
                            operationNumber: op.opNumber || '?',
                            operationDescription: op.name || '',
                        });
                    }
                }
            }
        }
    }
    return index;
}

/** Build a lookup of all AMFE failures indexed by failure ID. */
function buildFailureIndex(amfe: AmfeDocument): Map<string, {
    failure: AmfeFailure;
    operationNumber: string;
}> {
    const index = new Map<string, { failure: AmfeFailure; operationNumber: string }>();
    for (const op of amfe.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    index.set(fail.id, { failure: fail, operationNumber: op.opNumber || '?' });
                }
            }
        }
    }
    return index;
}

/** Get all cause IDs referenced by CP items. */
function getCpLinkedCauseIds(cp: ControlPlanDocument): Set<string> {
    const ids = new Set<string>();
    for (const item of cp.items) {
        if (item.amfeCauseIds) {
            for (const cid of item.amfeCauseIds) ids.add(cid);
        }
    }
    return ids;
}

/** Shorten text for display (max 60 chars). */
function truncate(s: string, max = 60): string {
    if (!s) return '(vacío)';
    return s.length > max ? s.slice(0, max) + '…' : s;
}

let alertCounter = 0;
function nextAlertId(): string {
    return `sync-${++alertCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Main detection engine
// ---------------------------------------------------------------------------

/**
 * Detect synchronization issues between AMFE and Control Plan.
 * Returns an array of alerts sorted by severity (high first).
 */
export function detectSyncAlerts(
    amfe: AmfeDocument,
    cp: ControlPlanDocument,
): SyncAlert[] {
    if (!amfe.operations.length || !cp.items.length) return [];

    const alerts: SyncAlert[] = [];
    const causeIndex = buildCauseIndex(amfe);
    const failureIndex = buildFailureIndex(amfe);
    const cpLinkedCauseIds = getCpLinkedCauseIds(cp);

    // 1. Check each CP item for changes in linked AMFE causes
    for (const cpItem of cp.items) {
        // --- Process rows: linked via amfeCauseIds ---
        if (cpItem.amfeCauseIds && cpItem.amfeCauseIds.length > 0) {
            for (const causeId of cpItem.amfeCauseIds) {
                const entry = causeIndex.get(causeId);

                if (!entry) {
                    // Cause was deleted from AMFE but CP still references it
                    alerts.push({
                        id: nextAlertId(),
                        severity: 'high',
                        type: 'cause_removed',
                        message: `Causa eliminada del AMFE`,
                        detail: `La fila "${truncate(cpItem.processCharacteristic || cpItem.productCharacteristic)}" (Op ${cpItem.processStepNumber}) referencia una causa que ya no existe en el AMFE.`,
                        operationNumber: cpItem.processStepNumber,
                        cpItemId: cpItem.id,
                        amfeCauseId: causeId,
                        suggestedAction: 'Eliminar esta fila del CP o revincularlo a otra causa.',
                        patch: null,
                    });
                    continue;
                }

                const { cause, failure, operationNumber } = entry;

                // Check if cause text changed
                if (cpItem.processCharacteristic &&
                    cause.cause &&
                    normalize(cpItem.processCharacteristic) !== normalize(cause.cause)) {
                    alerts.push({
                        id: nextAlertId(),
                        severity: 'medium',
                        type: 'cause_changed',
                        message: `Texto de causa modificado en Op ${operationNumber}`,
                        detail: `CP dice "${truncate(cpItem.processCharacteristic)}" pero el AMFE ahora dice "${truncate(cause.cause)}".`,
                        operationNumber,
                        cpItemId: cpItem.id,
                        amfeCauseId: causeId,
                        suggestedAction: `Actualizar "Característica de Proceso" a: "${truncate(cause.cause)}"`,
                        patch: { field: 'processCharacteristic', newValue: cause.cause },
                    });
                }

                // Check if prevention control changed → CP controlMethod
                if (cpItem.controlMethod &&
                    cause.preventionControl &&
                    normalize(cpItem.controlMethod) !== normalize(cause.preventionControl)) {
                    alerts.push({
                        id: nextAlertId(),
                        severity: 'medium',
                        type: 'control_changed',
                        message: `Control de prevención cambiado en Op ${operationNumber}`,
                        detail: `CP "Método de Control" dice "${truncate(cpItem.controlMethod)}" pero el AMFE ahora dice "${truncate(cause.preventionControl)}".`,
                        operationNumber,
                        cpItemId: cpItem.id,
                        amfeCauseId: causeId,
                        suggestedAction: `Actualizar "Método de Control" a: "${truncate(cause.preventionControl)}"`,
                        patch: { field: 'controlMethod', newValue: cause.preventionControl },
                    });
                }

                // Check if AP level changed
                const currentAp = String(cause.ap || '').toUpperCase();
                const cpAp = String(cpItem.amfeAp || '').toUpperCase();
                if (cpAp && currentAp && cpAp !== currentAp) {
                    const isEscalation = currentAp === 'H' || (currentAp === 'M' && cpAp === 'L');
                    alerts.push({
                        id: nextAlertId(),
                        severity: isEscalation ? 'high' : 'low',
                        type: 'ap_changed',
                        message: `AP cambió de ${cpAp} a ${currentAp} en Op ${operationNumber}`,
                        detail: isEscalation
                            ? `El riesgo aumentó. Los controles del CP pueden ser insuficientes.`
                            : `El riesgo disminuyó. Puede relajar los controles del CP.`,
                        operationNumber,
                        cpItemId: cpItem.id,
                        amfeCauseId: causeId,
                        suggestedAction: isEscalation
                            ? 'Reforzar controles: aumentar frecuencia de muestreo, agregar Poka-Yoke.'
                            : 'Puede considerar reducir frecuencia de muestreo.',
                        patch: { field: 'amfeAp' as keyof ControlPlanItem, newValue: currentAp },
                    });
                }

                // Check severity changed
                const currentSev = Number(failure.severity) || 0;
                const cpSev = Number(cpItem.amfeSeverity) || 0;
                if (cpSev > 0 && currentSev > 0 && cpSev !== currentSev) {
                    alerts.push({
                        id: nextAlertId(),
                        severity: currentSev >= 9 ? 'high' : 'medium',
                        type: 'severity_changed',
                        message: `Severidad cambió de ${cpSev} a ${currentSev} en Op ${operationNumber}`,
                        detail: currentSev > cpSev
                            ? `La severidad aumentó. Revisar si los controles del CP son adecuados.`
                            : `La severidad disminuyó.`,
                        operationNumber,
                        cpItemId: cpItem.id,
                        amfeCauseId: causeId,
                        suggestedAction: currentSev >= 9
                            ? 'Con S≥9, el CP debe tener controles especiales (100%, Poka-Yoke).'
                            : undefined,
                        patch: { field: 'amfeSeverity' as keyof ControlPlanItem, newValue: currentSev },
                    });
                }
            }
        }

        // --- Product rows: linked via amfeFailureId / amfeFailureIds ---
        const failureIds = cpItem.amfeFailureIds || (cpItem.amfeFailureId ? [cpItem.amfeFailureId] : []);
        for (const failId of failureIds) {
            const entry = failureIndex.get(failId);
            if (!entry) {
                // Failure was deleted
                alerts.push({
                    id: nextAlertId(),
                    severity: 'high',
                    type: 'failure_changed',
                    message: `Modo de falla eliminado del AMFE`,
                    detail: `La fila "${truncate(cpItem.productCharacteristic)}" (Op ${cpItem.processStepNumber}) referencia un modo de falla que ya no existe.`,
                    operationNumber: cpItem.processStepNumber,
                    cpItemId: cpItem.id,
                    suggestedAction: 'Eliminar esta fila del CP o actualizarla manualmente.',
                    patch: null,
                });
                continue;
            }

            // Check if failure description changed
            if (cpItem.productCharacteristic &&
                entry.failure.description &&
                normalize(cpItem.productCharacteristic) !== normalize(entry.failure.description)) {
                alerts.push({
                    id: nextAlertId(),
                    severity: 'medium',
                    type: 'failure_changed',
                    message: `Modo de falla modificado en Op ${entry.operationNumber}`,
                    detail: `CP dice "${truncate(cpItem.productCharacteristic)}" pero el AMFE ahora dice "${truncate(entry.failure.description)}".`,
                    operationNumber: entry.operationNumber,
                    cpItemId: cpItem.id,
                    suggestedAction: `Actualizar "Característica de Producto" a: "${truncate(entry.failure.description)}"`,
                    patch: { field: 'productCharacteristic', newValue: entry.failure.description },
                });
            }
        }
    }

    // 2. Check for AMFE causes with AP=H/M that have no CP coverage
    for (const [causeId, entry] of causeIndex) {
        const ap = String(entry.cause.ap || '').toUpperCase();
        if ((ap === 'H' || ap === 'M') && !cpLinkedCauseIds.has(causeId)) {
            // Only alert if the cause has meaningful content
            if (!entry.cause.cause?.trim()) continue;

            alerts.push({
                id: nextAlertId(),
                severity: ap === 'H' ? 'high' : 'medium',
                type: 'orphan_cause',
                message: `Causa con AP=${ap} sin cobertura en CP`,
                detail: `"${truncate(entry.cause.cause)}" en Op ${entry.operationNumber} tiene AP=${ap} pero no hay fila en el Plan de Control.`,
                operationNumber: entry.operationNumber,
                amfeCauseId: causeId,
                suggestedAction: ap === 'H'
                    ? 'Agregar fila al CP con control 100% o Poka-Yoke.'
                    : 'Agregar fila al CP con control estadístico (SPC).',
                patch: null,
            });
        }
    }

    // Sort: high → medium → low, then by operation number
    const severityOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => {
        const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (sevDiff !== 0) return sevDiff;
        const opA = parseInt(a.operationNumber) || 0;
        const opB = parseInt(b.operationNumber) || 0;
        return opA - opB;
    });

    return alerts;
}

/**
 * Apply a sync alert's patch to a Control Plan document.
 * Returns the updated document, or null if the alert requires manual action.
 */
export function applySyncAlertToCp(
    cp: ControlPlanDocument,
    alert: SyncAlert,
): ControlPlanDocument | null {
    if (!alert.patch || !alert.cpItemId) return null;

    const { field, newValue } = alert.patch;
    const itemIndex = cp.items.findIndex(item => item.id === alert.cpItemId);
    if (itemIndex === -1) return null;

    const updatedItems = [...cp.items];
    updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        [field]: newValue,
    };

    return {
        ...cp,
        items: updatedItems,
    };
}

/** Normalize text for comparison: lowercase, trim, collapse whitespace. */
function normalize(s: string): string {
    return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

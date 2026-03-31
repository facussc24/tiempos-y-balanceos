/**
 * AMFE Optimization Action Cleanup Script
 *
 * Detects and removes invented/auto-generated optimization actions
 * that were copied identically across multiple products.
 *
 * Run via browser console: await window.__cleanupAmfeActions()
 * Dry run (report only): await window.__cleanupAmfeActions(true)
 */

import type { AmfeCause, AmfeDocument } from '../../modules/amfe/amfeTypes';
import { listAmfeDocuments, loadAmfeDocument, computeAmfeStats } from '../repositories/amfeRepository';
import { supabase } from '../supabaseClient';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Generic action patterns — phrases that are clearly auto-generated
// ---------------------------------------------------------------------------
const GENERIC_PATTERNS = [
    /^implementar control estad[ií]stico/i,
    /^mejorar instrucci[oó]n de trabajo/i,
    /^capacitar al operario/i,
    /^realizar estudio de capa[bc]ilidad/i,
    /^implementar poka.?yoke/i,
    /^agregar control visual/i,
    /^reforzar capacitaci[oó]n/i,
    /^implementar inspecci[oó]n/i,
    /^mejorar proceso de/i,
    /^actualizar instrucci[oó]n/i,
    /^implementar sistema de/i,
    /^establecer control/i,
    /^definir par[aá]metros/i,
    /^incluir en plan de capacitaci[oó]n/i,
    /^incorporar al plan de mantenimiento/i,
    /^agregar punto de control/i,
    /^verificar con instrumento calibrado/i,
    /^aumentar frecuencia de inspecci[oó]n/i,
    /^implementar autocontrol/i,
    /^realizar mantenimiento preventivo/i,
];

function isGenericAction(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    return GENERIC_PATTERNS.some(p => p.test(trimmed));
}

// ---------------------------------------------------------------------------
// Types for tracking
// ---------------------------------------------------------------------------
interface ActionEntry {
    docId: string;
    projectName: string;
    opNumber: string;
    opName: string;
    causeId: string;
    causeText: string;
    field: 'preventionAction' | 'detectionAction';
    actionText: string;
    ap: string;
}

interface CleanupResult {
    totalActionsFound: number;
    duplicatesRemoved: number;
    genericsRemoved: number;
    conserved: number;
    pendientesSet: number;
    docsModified: number;
}

// ---------------------------------------------------------------------------
// Main cleanup function
// ---------------------------------------------------------------------------
export async function cleanupAmfeActions(dryRun = false): Promise<CleanupResult> {
    const label = dryRun ? '[DRY RUN]' : '[CLEANUP]';
    console.log(`${label} === Inicio de limpieza de acciones AMFE ===`);

    // Step 1: Load all AMFE documents
    const registry = await listAmfeDocuments();
    console.log(`${label} ${registry.length} documentos AMFE encontrados`);

    const allActions: ActionEntry[] = [];
    const docsById = new Map<string, { doc: AmfeDocument; projectName: string; amfeNumber: string; status: string }>();

    for (const entry of registry) {
        const loaded = await loadAmfeDocument(entry.id);
        if (!loaded) {
            console.warn(`${label} No se pudo cargar doc ${entry.id} (${entry.projectName})`);
            continue;
        }
        docsById.set(entry.id, {
            doc: loaded.doc,
            projectName: entry.projectName,
            amfeNumber: entry.amfeNumber,
            status: entry.status,
        });

        // Traverse all causes
        for (const op of loaded.doc.operations) {
            for (const we of op.workElements) {
                for (const fn of we.functions) {
                    for (const fail of fn.failures) {
                        for (const cause of fail.causes) {
                            if (cause.preventionAction?.trim()) {
                                allActions.push({
                                    docId: entry.id,
                                    projectName: entry.projectName,
                                    opNumber: op.opNumber,
                                    opName: op.name,
                                    causeId: cause.id,
                                    causeText: cause.cause,
                                    field: 'preventionAction',
                                    actionText: cause.preventionAction.trim(),
                                    ap: String(cause.ap || ''),
                                });
                            }
                            if (cause.detectionAction?.trim()) {
                                allActions.push({
                                    docId: entry.id,
                                    projectName: entry.projectName,
                                    opNumber: op.opNumber,
                                    opName: op.name,
                                    causeId: cause.id,
                                    causeText: cause.cause,
                                    field: 'detectionAction',
                                    actionText: cause.detectionAction.trim(),
                                    ap: String(cause.ap || ''),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    console.log(`${label} ${allActions.length} acciones totales encontradas en ${docsById.size} documentos`);

    // Step 2: Count action text occurrences across DIFFERENT documents
    const actionTextToDocIds = new Map<string, Set<string>>();
    for (const a of allActions) {
        const key = a.actionText.toLowerCase();
        if (!actionTextToDocIds.has(key)) actionTextToDocIds.set(key, new Set());
        actionTextToDocIds.get(key)!.add(a.docId);
    }

    // Identify duplicated actions (same text in 3+ different documents)
    const duplicatedTexts = new Set<string>();
    for (const [text, docIds] of actionTextToDocIds) {
        if (docIds.size >= 3) {
            duplicatedTexts.add(text);
            console.log(`${label} DUPLICADA en ${docIds.size} docs: "${text}"`);
        }
    }

    // Step 3: Build set of cause IDs to clean
    const causesToClean = new Set<string>(); // causeId
    const causeCleanReasons = new Map<string, string>(); // causeId -> reason

    for (const a of allActions) {
        const key = a.actionText.toLowerCase();
        if (duplicatedTexts.has(key)) {
            causesToClean.add(`${a.docId}:${a.causeId}:${a.field}`);
            causeCleanReasons.set(`${a.docId}:${a.causeId}:${a.field}`, `duplicada en 3+ docs`);
        } else if (isGenericAction(a.actionText)) {
            causesToClean.add(`${a.docId}:${a.causeId}:${a.field}`);
            causeCleanReasons.set(`${a.docId}:${a.causeId}:${a.field}`, `genérica`);
        }
    }

    console.log(`${label} ${causesToClean.size} acciones marcadas para eliminación`);

    // Step 4: Apply cleanup
    let duplicatesRemoved = 0;
    let genericsRemoved = 0;
    let conserved = 0;
    let pendientesSet = 0;
    const modifiedDocIds = new Set<string>();

    for (const a of allActions) {
        const cleanKey = `${a.docId}:${a.causeId}:${a.field}`;
        if (causesToClean.has(cleanKey)) {
            const reason = causeCleanReasons.get(cleanKey) || '';
            if (reason.includes('duplicada')) duplicatesRemoved++;
            else genericsRemoved++;

            if (!dryRun) {
                // Find and clean the cause in the document
                const docEntry = docsById.get(a.docId);
                if (docEntry) {
                    const cause = findCause(docEntry.doc, a.causeId);
                    if (cause) {
                        if (a.field === 'preventionAction') cause.preventionAction = '';
                        if (a.field === 'detectionAction') cause.detectionAction = '';
                        // Also clear tracking fields if BOTH actions are now empty
                        if (!cause.preventionAction.trim() && !cause.detectionAction.trim()) {
                            cause.responsible = '';
                            cause.targetDate = '';
                            cause.status = '';
                            cause.actionTaken = '';
                            cause.completionDate = '';
                            cause.severityNew = '';
                            cause.occurrenceNew = '';
                            cause.detectionNew = '';
                            cause.apNew = '';
                        }
                        modifiedDocIds.add(a.docId);
                    }
                }
            }

            console.log(`${label} ELIMINAR [${reason}] ${a.projectName} OP${a.opNumber}: ${a.field}="${a.actionText}"`);
        } else {
            conserved++;
            console.log(`${label} CONSERVAR ${a.projectName} OP${a.opNumber}: ${a.field}="${a.actionText}"`);
        }
    }

    // Step 5: Check AP=H causes without actions after cleanup
    if (!dryRun) {
        for (const [docId, entry] of docsById) {
            for (const op of entry.doc.operations) {
                for (const we of op.workElements) {
                    for (const fn of we.functions) {
                        for (const fail of fn.failures) {
                            for (const cause of fail.causes) {
                                const ap = String(cause.ap || '').toUpperCase();
                                if (ap === 'H' && !cause.preventionAction?.trim() && !cause.detectionAction?.trim()) {
                                    cause.preventionAction = 'Pendiente definición equipo APQP';
                                    pendientesSet++;
                                    modifiedDocIds.add(docId);
                                    console.log(`${label} AP=H PENDIENTE ${entry.projectName} OP${op.opNumber}: causa="${cause.cause}"`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Step 6: Save modified documents via direct Supabase UPDATE
    if (!dryRun) {
        for (const docId of modifiedDocIds) {
            const entry = docsById.get(docId)!;
            const stats = computeAmfeStats(entry.doc);
            const { error } = await supabase
                .from('amfe_documents')
                .update({
                    data: JSON.stringify(entry.doc),
                    operation_count: stats.operationCount,
                    cause_count: stats.causeCount,
                    ap_h_count: stats.apHCount,
                    ap_m_count: stats.apMCount,
                    coverage_percent: stats.coveragePercent,
                    updated_at: new Date().toISOString(),
                    updated_by: 'facundo.santoro@barackmercosul.com',
                })
                .eq('id', docId);

            if (error) {
                console.error(`${label} ERROR al guardar: ${entry.projectName} (${docId}): ${error.message}`);
            } else {
                console.log(`${label} Guardado OK: ${entry.projectName} (${docId})`);
            }
        }
    }

    // Step 7: Summary
    const result: CleanupResult = {
        totalActionsFound: allActions.length,
        duplicatesRemoved,
        genericsRemoved,
        conserved,
        pendientesSet,
        docsModified: modifiedDocIds.size,
    };

    console.log(`\n${label} === RESUMEN ===`);
    console.log(`${label} Acciones totales encontradas: ${result.totalActionsFound}`);
    console.log(`${label} Duplicadas eliminadas (3+ docs): ${result.duplicatesRemoved}`);
    console.log(`${label} Genéricas eliminadas: ${result.genericsRemoved}`);
    console.log(`${label} Conservadas (específicas reales): ${result.conserved}`);
    console.log(`${label} AP=H → "Pendiente definición equipo APQP": ${result.pendientesSet}`);
    console.log(`${label} Documentos modificados: ${result.docsModified}`);

    logger.info('CleanupAmfe', `Cleanup complete`, result as any);
    return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findCause(doc: AmfeDocument, causeId: string): AmfeCause | null {
    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const fn of we.functions) {
                for (const fail of fn.failures) {
                    for (const cause of fail.causes) {
                        if (cause.id === causeId) return cause;
                    }
                }
            }
        }
    }
    return null;
}

// Wire to window for browser console execution
if (typeof window !== 'undefined') {
    (window as any).__cleanupAmfeActions = cleanupAmfeActions;
}

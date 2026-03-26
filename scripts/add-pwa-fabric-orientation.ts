/**
 * add-pwa-fabric-orientation.ts
 *
 * Adds fabric orientation failure mode (lado liso/felpudo invertido) to:
 *   - AMFE: new failure mode under costura operation
 *   - CP: new control item for orientation check
 *   - HO: new step (pre-costura check) + QC item linked to CP
 *
 * Context: TryOut report for PWA Telas 581D found the smooth side vs fuzzy
 * side of the fabric was inverted during sewing.
 *
 * Targets: PWA/TELAS_PLANAS (always) and PWA/TELAS_TERMOFORMADAS (if costura op exists).
 * NEVER touches VWA or IP PAD documents.
 *
 * Run: npx tsx scripts/add-pwa-fabric-orientation.ts
 */
import {
    ensureAuth,
    fetchAllAmfeDocs,
    fetchAllCpDocs,
    fetchAllHoDocs,
    backupDoc,
    updateDocDirect,
    normOp,
} from './audit/supabaseHelper.js';
import * as crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChangeLog {
    product: string;
    docType: 'AMFE' | 'CP' | 'HO';
    docId: string;
    operation: string;
    detail: string;
    applied: boolean;
    error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uuid(): string {
    return crypto.randomUUID();
}

/**
 * Find the costura operation in an AMFE document.
 * Matches "costura recta", "costura fuerte", "costura de refuerzos", etc.
 */
function findCosturaOp(operations: any[]): any | null {
    return operations.find((op: any) => {
        const n = normOp(op.name || '');
        return n.includes('costura');
    }) ?? null;
}

/**
 * Find a costura-related sheet in an HO document.
 * Matches by operationName containing "costura".
 */
function findCosturaSheet(sheets: any[]): any | null {
    return sheets.find((sh: any) => {
        const n = normOp(sh.operationName || '');
        return n.includes('costura');
    }) ?? null;
}

// ── AMFE: Add orientation failure ──────────────────────────────────────────────

interface AmfeResult {
    failureId: string;
    causeId: string;
    opNumber: string;
    opName: string;
}

function addOrientationFailureToAmfe(doc: any): AmfeResult | null {
    const costuraOp = findCosturaOp(doc.operations || []);
    if (!costuraOp) return null;

    // Find a suitable work element. Prefer one with type "Man" or "Method".
    // If none, use the first work element.
    let targetWe = (costuraOp.workElements || []).find(
        (we: any) => we.type === 'Man' || we.type === 'Method'
    );
    if (!targetWe) {
        targetWe = (costuraOp.workElements || [])[0];
    }
    if (!targetWe) {
        // No work elements — create one
        targetWe = {
            id: uuid(),
            type: 'Man',
            name: 'Operador de costura',
            functions: [],
        };
        costuraOp.workElements.push(targetWe);
    }

    // Find a function related to sewing quality. Look for one with existing failures.
    let targetFn = (targetWe.functions || []).find(
        (fn: any) => (fn.failures || []).length > 0
    );
    if (!targetFn) {
        // Create a new function
        targetFn = {
            id: uuid(),
            description: 'Coser pieza conforme a especificacion y orientacion correcta',
            requirements: '',
            failures: [],
        };
        targetWe.functions.push(targetFn);
    }

    // Create the new failure mode
    const failureId = uuid();
    const causeId = uuid();

    const newFailure = {
        id: failureId,
        description: 'Orientacion incorrecta de la tela (lado liso/felpudo invertido)',
        effectLocal: 'Pieza con aspecto no conforme al estandar',
        effectNextLevel: 'Rechazo en inspeccion de producto terminado',
        effectEndUser: 'Aspecto visual diferente al estandar del vehiculo',
        severity: 5,
        severityLocal: '',
        severityNextLevel: '',
        severityEndUser: '',
        causes: [
            {
                id: causeId,
                cause: 'Falta de identificacion visual del lado correcto en la tela',
                preventionControl: 'Ayuda visual en puesto con identificacion de lado liso vs felpudo',
                detectionControl: 'Verificacion visual por operador antes de iniciar costura',
                occurrence: 4,
                detection: 5,
                ap: 'M',
                characteristicNumber: '',
                specialChar: '',
                filterCode: '',
                preventionAction: '',
                detectionAction: '',
                responsible: '',
                targetDate: '',
                status: '',
                actionTaken: '',
                completionDate: '',
                severityNew: '',
                occurrenceNew: '',
                detectionNew: '',
                apNew: '',
                observations: 'Evidenciado en TryOut 25/03/2026 - Informe TryOut Ing. Telas 58D PWA',
            },
        ],
    };

    targetFn.failures.push(newFailure);

    return {
        failureId,
        causeId,
        opNumber: costuraOp.opNumber || '',
        opName: costuraOp.name || '',
    };
}

// ── CP: Add orientation control item ──────────────────────────────────────────

function addOrientationCpItem(
    doc: any,
    opNumber: string,
    opName: string,
    failureId: string,
    causeId: string,
): string {
    const cpItemId = uuid();
    const newItem = {
        id: cpItemId,
        processStepNumber: opNumber,
        processDescription: opName,
        machineDeviceTool: 'Mesa de costura',
        characteristicNumber: '',
        productCharacteristic: 'Orientacion correcta de la tela',
        processCharacteristic: '',
        specialCharClass: '',
        specification: 'Lado liso/felpudo conforme a ayuda visual del puesto',
        evaluationTechnique: 'Visual',
        sampleSize: '100%',
        sampleFrequency: 'Cada pieza',
        controlMethod: 'Autocontrol visual antes de coser',
        reactionPlan: 'Segregar pieza, notificar segun P-09/I',
        reactionPlanOwner: 'Operador de produccion',
        controlProcedure: 'P-09/I',
        amfeCauseIds: [causeId],
        amfeFailureId: failureId,
    };
    doc.items.push(newItem);
    return cpItemId;
}

// ── HO: Add orientation step and QC item ──────────────────────────────────────

function addOrientationToHo(doc: any, cpItemId: string): boolean {
    const costuraSheet = findCosturaSheet(doc.sheets || []);
    if (!costuraSheet) return false;

    // Renumber existing steps: shift all by +1
    const existingSteps = costuraSheet.steps || [];
    for (const step of existingSteps) {
        step.stepNumber = (step.stepNumber || 0) + 1;
    }

    // Add new step at position 1 (beginning)
    const newStep = {
        id: uuid(),
        stepNumber: 1,
        description: 'Verificar orientacion de la tela: lado liso hacia arriba (exterior), lado felpudo hacia abajo (interior). Comparar con ayuda visual del puesto.',
        isKeyPoint: true,
        keyPointReason: 'Evidenciado en TryOut: inversion de lados genera rechazo',
    };
    costuraSheet.steps = [newStep, ...existingSteps];

    // Add QC item linked to the new CP item
    const qcItems = costuraSheet.qualityChecks || [];
    qcItems.push({
        id: uuid(),
        characteristic: 'Orientacion correcta de la tela',
        specification: 'Lado liso/felpudo conforme a ayuda visual del puesto',
        evaluationTechnique: 'Visual',
        frequency: 'Cada pieza',
        controlMethod: 'Autocontrol visual antes de coser',
        reactionAction: 'Segregar pieza, notificar segun P-09/I',
        reactionContact: 'Lider de Produccion',
        specialCharSymbol: '',
        registro: '',
        cpItemId,
    });
    costuraSheet.qualityChecks = qcItems;

    return true;
}

// ── AMFE stats recalculation ──────────────────────────────────────────────────

function recalcAmfeStats(doc: any): { causeCount: number; apH: number; apM: number } {
    let causeCount = 0;
    let apH = 0;
    let apM = 0;
    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fail of fn.failures || []) {
                    for (const c of fail.causes || []) {
                        causeCount++;
                        if (c.ap === 'H') apH++;
                        if (c.ap === 'M') apM++;
                    }
                }
            }
        }
    }
    return { causeCount, apH, apM };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== Add PWA Fabric Orientation Failure Mode ===\n');
    console.log('Context: TryOut report Telas 58D PWA — lado liso/felpudo invertido en costura\n');

    await ensureAuth();

    const logs: ChangeLog[] = [];

    // Load documents
    console.log('Loading documents...');
    const [amfeDocs, cpDocs, hoDocs] = await Promise.all([
        fetchAllAmfeDocs(),
        fetchAllCpDocs(),
        fetchAllHoDocs(),
    ]);
    console.log(`  AMFEs: ${amfeDocs.length}, CPs: ${cpDocs.length}, HOs: ${hoDocs.length}`);

    // Filter PWA products only — never touch VWA or IP PAD
    const pwaAmfes = amfeDocs.filter(d => {
        const proj = ((d.raw.project_name as string) || '').toUpperCase();
        return proj.includes('TELAS');
    });
    console.log(`  PWA AMFE targets: ${pwaAmfes.map(d => d.raw.project_name).join(', ')}`);

    for (const amfe of pwaAmfes) {
        const projectName = String(amfe.raw.project_name);
        console.log(`\n────────────────────────────────────────────────`);
        console.log(`  Processing: ${projectName}`);
        console.log(`────────────────────────────────────────────────`);

        const amfeDoc = amfe.parsed;

        // ── Step 1: Check if orientation failure already exists ──
        let alreadyExists = false;
        for (const op of amfeDoc.operations || []) {
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fail of fn.failures || []) {
                        if (normOp(fail.description || '').includes('orientacion')) {
                            alreadyExists = true;
                            console.log(`  SKIP AMFE: Orientation failure already exists in OP ${op.opNumber} "${op.name}"`);
                        }
                    }
                }
            }
        }

        if (alreadyExists) {
            logs.push({
                product: projectName,
                docType: 'AMFE',
                docId: amfe.id,
                operation: '-',
                detail: 'Orientation failure already exists — skipped',
                applied: false,
            });
            continue;
        }

        // ── Step 2: Add failure to AMFE ──
        const amfeResult = addOrientationFailureToAmfe(amfeDoc);
        if (!amfeResult) {
            console.log(`  SKIP: No costura operation found in AMFE`);
            logs.push({
                product: projectName,
                docType: 'AMFE',
                docId: amfe.id,
                operation: '-',
                detail: 'No costura operation found in AMFE — skipped',
                applied: false,
            });
            continue;
        }

        console.log(`  AMFE: Added orientation failure to OP ${amfeResult.opNumber} "${amfeResult.opName}"`);
        console.log(`    Failure ID: ${amfeResult.failureId}`);
        console.log(`    Cause ID:   ${amfeResult.causeId}`);

        // Backup and save AMFE
        backupDoc('amfe_documents', amfe.id, amfe.raw.data as string);
        const amfeStats = recalcAmfeStats(amfeDoc);
        try {
            const amfeJson = JSON.stringify(amfeDoc);
            await updateDocDirect('amfe_documents', amfe.id, amfeJson, {
                cause_count: amfeStats.causeCount,
                ap_h_count: amfeStats.apH,
                ap_m_count: amfeStats.apM,
            });
            console.log(`  AMFE saved. Causes: ${amfeStats.causeCount}, AP-H: ${amfeStats.apH}, AP-M: ${amfeStats.apM}`);
            logs.push({
                product: projectName,
                docType: 'AMFE',
                docId: amfe.id,
                operation: `OP ${amfeResult.opNumber} ${amfeResult.opName}`,
                detail: `Added orientation failure (S=5, O=4, D=5, AP=M)`,
                applied: true,
            });
        } catch (e: any) {
            console.log(`  ERROR saving AMFE: ${e.message}`);
            logs.push({
                product: projectName,
                docType: 'AMFE',
                docId: amfe.id,
                operation: `OP ${amfeResult.opNumber}`,
                detail: e.message,
                applied: false,
                error: e.message,
            });
            continue; // Don't proceed to CP/HO if AMFE failed
        }

        // ── Step 3: Add item to CP ──
        const cpDoc = cpDocs.find(d => {
            const proj = ((d.raw.linked_amfe_project as string) || (d.raw.project_name as string) || '').toUpperCase();
            return proj === projectName.toUpperCase();
        });

        if (!cpDoc) {
            console.log(`  SKIP CP: No CP found for ${projectName}`);
            logs.push({
                product: projectName,
                docType: 'CP',
                docId: '-',
                operation: '-',
                detail: 'No CP document found — skipped',
                applied: false,
            });
        } else {
            const cpData = cpDoc.parsed;

            // Check if orientation CP item already exists
            const cpAlreadyExists = (cpData.items || []).some((item: any) =>
                normOp(item.productCharacteristic || '').includes('orientacion')
            );

            if (cpAlreadyExists) {
                console.log(`  SKIP CP: Orientation item already exists`);
                logs.push({
                    product: projectName,
                    docType: 'CP',
                    docId: cpDoc.id,
                    operation: '-',
                    detail: 'Orientation CP item already exists — skipped',
                    applied: false,
                });
            } else {
                const cpItemId = addOrientationCpItem(
                    cpData,
                    amfeResult.opNumber,
                    amfeResult.opName,
                    amfeResult.failureId,
                    amfeResult.causeId,
                );
                console.log(`  CP: Added orientation control item (ID: ${cpItemId})`);

                backupDoc('cp_documents', cpDoc.id, cpDoc.raw.data as string);
                try {
                    const cpJson = JSON.stringify(cpData);
                    await updateDocDirect('cp_documents', cpDoc.id, cpJson, {
                        item_count: cpData.items.length,
                    });
                    console.log(`  CP saved. Total items: ${cpData.items.length}`);
                    logs.push({
                        product: projectName,
                        docType: 'CP',
                        docId: cpDoc.id,
                        operation: `OP ${amfeResult.opNumber} ${amfeResult.opName}`,
                        detail: `Added orientation control item (100% visual, autocontrol)`,
                        applied: true,
                    });
                } catch (e: any) {
                    console.log(`  ERROR saving CP: ${e.message}`);
                    logs.push({
                        product: projectName,
                        docType: 'CP',
                        docId: cpDoc.id,
                        operation: `OP ${amfeResult.opNumber}`,
                        detail: e.message,
                        applied: false,
                        error: e.message,
                    });
                }

                // ── Step 4: Add step and QC to HO ──
                const hoDoc = hoDocs.find(d => {
                    const proj = ((d.raw.linked_amfe_project as string) || '').toUpperCase();
                    return proj === projectName.toUpperCase();
                });

                if (!hoDoc) {
                    console.log(`  SKIP HO: No HO found for ${projectName}`);
                    logs.push({
                        product: projectName,
                        docType: 'HO',
                        docId: '-',
                        operation: '-',
                        detail: 'No HO document found — skipped',
                        applied: false,
                    });
                } else {
                    const hoData = hoDoc.parsed;

                    // Check if orientation step already exists in any costura sheet
                    const costuraSheet = findCosturaSheet(hoData.sheets || []);
                    const hoAlreadyExists = costuraSheet && (costuraSheet.steps || []).some((step: any) =>
                        normOp(step.description || '').includes('orientacion')
                    );

                    if (hoAlreadyExists) {
                        console.log(`  SKIP HO: Orientation step already exists`);
                        logs.push({
                            product: projectName,
                            docType: 'HO',
                            docId: hoDoc.id,
                            operation: '-',
                            detail: 'Orientation step already exists — skipped',
                            applied: false,
                        });
                    } else {
                        const hoUpdated = addOrientationToHo(hoData, cpItemId);
                        if (!hoUpdated) {
                            console.log(`  SKIP HO: No costura sheet found`);
                            logs.push({
                                product: projectName,
                                docType: 'HO',
                                docId: hoDoc.id,
                                operation: '-',
                                detail: 'No costura sheet found in HO — skipped',
                                applied: false,
                            });
                        } else {
                            backupDoc('ho_documents', hoDoc.id, hoDoc.raw.data as string);
                            try {
                                const hoJson = JSON.stringify(hoData);
                                await updateDocDirect('ho_documents', hoDoc.id, hoJson);
                                const sheetInfo = findCosturaSheet(hoData.sheets || []);
                                console.log(`  HO: Added orientation step (#1) + QC item to ${sheetInfo?.hoNumber || 'costura sheet'}`);
                                console.log(`    Steps: ${sheetInfo?.steps?.length || 0}, QC items: ${sheetInfo?.qualityChecks?.length || 0}`);
                                logs.push({
                                    product: projectName,
                                    docType: 'HO',
                                    docId: hoDoc.id,
                                    operation: `${sheetInfo?.hoNumber || 'costura'} ${sheetInfo?.operationName || ''}`,
                                    detail: `Added step #1 (orientation check, key point) + QC item linked to CP`,
                                    applied: true,
                                });
                            } catch (e: any) {
                                console.log(`  ERROR saving HO: ${e.message}`);
                                logs.push({
                                    product: projectName,
                                    docType: 'HO',
                                    docId: hoDoc.id,
                                    operation: '-',
                                    detail: e.message,
                                    applied: false,
                                    error: e.message,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────────
    console.log('\n\n════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('════════════════════════════════════════════════════');

    const applied = logs.filter(l => l.applied);
    const skipped = logs.filter(l => !l.applied && !l.error);
    const failed = logs.filter(l => l.error);

    console.log(`\n  Applied: ${applied.length}`);
    for (const l of applied) {
        console.log(`    + [${l.product}] ${l.docType}: ${l.detail}`);
    }

    if (skipped.length > 0) {
        console.log(`\n  Skipped: ${skipped.length}`);
        for (const l of skipped) {
            console.log(`    - [${l.product}] ${l.docType}: ${l.detail}`);
        }
    }

    if (failed.length > 0) {
        console.log(`\n  Failed: ${failed.length}`);
        for (const l of failed) {
            console.log(`    X [${l.product}] ${l.docType}: ${l.error}`);
        }
    }

    console.log('\nDone.');
}

main().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});

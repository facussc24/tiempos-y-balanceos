/**
 * C_fixEmptyQcs.ts
 *
 * Populate 43 empty HO quality checks by copying data from linked CP items.
 *
 * For each HO QC with empty characteristic/specification:
 * 1. Try to find linked CP item via cpItemId
 * 2. If found, copy: characteristic, specification, evaluationTechnique, controlMethod, specialCharSymbol
 * 3. If not found, try matching by operation name in linked CP
 * 4. Report any QCs that couldn't be resolved
 */
import {
    ensureAuth,
    fetchAllHoDocs,
    fetchAllCpDocs,
    backupDoc,
    writeResults,
    normOp,
    updateDocDirect,
} from './supabaseHelper.js';

// ── Main ───────────────────────────────────────────────────────────────────────

interface QcFixLog {
    hoProduct: string;
    hoDocId: string;
    sheetName: string;
    opNumber: string;
    qcId: string;
    frequency: string;
    source: 'cpItemId' | 'opMatch' | 'noSource';
    characteristic: string;
    specification: string;
    evaluationTechnique: string;
    controlMethod: string;
}

async function main() {
    console.log('=== Script C: Fix 43 empty HO quality checks ===\n');
    await ensureAuth();

    console.log('Loading HO and CP documents...');
    const [hoDocs, cpDocs] = await Promise.all([
        fetchAllHoDocs(),
        fetchAllCpDocs(),
    ]);
    console.log(`  Loaded ${hoDocs.length} HO docs, ${cpDocs.length} CP docs\n`);

    // Build CP item index by ID for fast lookup
    const cpItemIndex = new Map<string, any>();
    const cpByProject = new Map<string, any>();

    for (const cp of cpDocs) {
        const doc = cp.parsed;
        const linkedAmfeProject = String(cp.raw.linked_amfe_project || '');
        cpByProject.set(linkedAmfeProject, doc);
        cpByProject.set(String(cp.raw.project_name || ''), doc);

        for (const item of doc.items || []) {
            if (item.id) {
                cpItemIndex.set(item.id, item);
            }
        }
    }

    const logs: QcFixLog[] = [];
    let totalFixed = 0;
    let noSourceCount = 0;

    for (const ho of hoDocs) {
        const doc = ho.parsed;
        const partNumber = String(ho.raw.part_number || '');
        const linkedCpProject = String(ho.raw.linked_cp_project || '');
        const linkedAmfeProject = String(ho.raw.linked_amfe_project || '');
        let docFixed = 0;

        // Find linked CP document
        const linkedCp = cpByProject.get(linkedAmfeProject) || cpByProject.get(linkedCpProject);

        for (const sheet of doc.sheets || []) {
            const qcs = sheet.qualityChecks || [];
            const sheetOpName = normOp(sheet.operationName || '');
            const sheetOpNumber = sheet.operationNumber || '';

            for (const qc of qcs) {
                const charEmpty = !qc.characteristic || qc.characteristic.trim() === '';
                const specEmpty = !qc.specification || qc.specification.trim() === '' || qc.specification.trim() === 'TBD';

                if (!charEmpty && !specEmpty) continue; // QC is populated

                let source: 'cpItemId' | 'opMatch' | 'noSource' = 'noSource';
                let cpItem: any = null;

                // Strategy 1: Direct link via cpItemId
                if (qc.cpItemId && cpItemIndex.has(qc.cpItemId)) {
                    cpItem = cpItemIndex.get(qc.cpItemId);
                    source = 'cpItemId';
                }

                // Strategy 2: Match by operation number in linked CP
                if (!cpItem && linkedCp) {
                    const cpItems = (linkedCp.items || []).filter((item: any) =>
                        item.processStepNumber === sheetOpNumber
                    );
                    if (cpItems.length > 0) {
                        // Pick the first CP item for this operation that has data
                        cpItem = cpItems.find((item: any) =>
                            (item.productCharacteristic || item.processCharacteristic) &&
                            item.specification
                        ) || cpItems[0];
                        source = 'opMatch';
                    }
                }

                // Strategy 3: Match by operation name similarity
                if (!cpItem && linkedCp) {
                    const cpItems = (linkedCp.items || []).filter((item: any) =>
                        normOp(item.processDescription || '').includes(sheetOpName) ||
                        sheetOpName.includes(normOp(item.processDescription || ''))
                    );
                    if (cpItems.length > 0) {
                        cpItem = cpItems.find((item: any) =>
                            (item.productCharacteristic || item.processCharacteristic) &&
                            item.specification
                        ) || cpItems[0];
                        source = 'opMatch';
                    }
                }

                if (cpItem) {
                    // Copy fields from CP to HO QC
                    if (charEmpty) {
                        qc.characteristic = cpItem.productCharacteristic || cpItem.processCharacteristic || '';
                    }
                    if (specEmpty) {
                        qc.specification = cpItem.specification || '';
                    }
                    if (!qc.evaluationTechnique || qc.evaluationTechnique.trim() === '') {
                        qc.evaluationTechnique = cpItem.evaluationTechnique || '';
                    }
                    if (!qc.controlMethod || qc.controlMethod.trim() === '') {
                        qc.controlMethod = cpItem.controlMethod || '';
                    }
                    if (!qc.specialCharSymbol || qc.specialCharSymbol.trim() === '') {
                        qc.specialCharSymbol = cpItem.specialCharClass || '';
                    }

                    docFixed++;
                    totalFixed++;
                } else {
                    noSourceCount++;
                }

                logs.push({
                    hoProduct: partNumber || linkedAmfeProject,
                    hoDocId: ho.id,
                    sheetName: sheet.operationName || '',
                    opNumber: sheetOpNumber,
                    qcId: qc.id || '',
                    frequency: qc.frequency || '',
                    source,
                    characteristic: qc.characteristic || '(empty)',
                    specification: qc.specification || '(empty)',
                    evaluationTechnique: qc.evaluationTechnique || '',
                    controlMethod: qc.controlMethod || '',
                });
            }
        }

        if (docFixed > 0) {
            console.log(`  [${partNumber || linkedAmfeProject}] Fixed ${docFixed} QCs`);
            backupDoc('ho_documents', ho.id, ho.raw.data as string);
            await updateDocDirect('ho_documents', ho.id, JSON.stringify(doc), {
                sheet_count: (doc.sheets || []).length,
            });
        }
    }

    console.log(`\n════════════════════════════════════════════════════`);
    console.log(`  TOTAL: ${totalFixed} QCs populated from CP data`);
    console.log(`  No source found: ${noSourceCount} QCs`);
    console.log(`════════════════════════════════════════════════════\n`);

    writeResults('C_fixEmptyQcs.json', {
        timestamp: new Date().toISOString(),
        summary: {
            totalFixed,
            noSource: noSourceCount,
            totalProcessed: logs.length,
        },
        corrections: logs,
    });

    console.log('Done.');
}

main().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});

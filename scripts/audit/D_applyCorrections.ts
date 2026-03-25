/**
 * D_applyCorrections.ts
 *
 * Apply automatic corrections for conceptual errors found by B1-B4 audits.
 *
 * Corrections:
 * 1. TOP_ROLL OP 11 "ALMACENAMIENTO EN MEDIOS WIP" → Remove from AMFE and CP
 * 2. ARMREST OP 90: SC → CC in CP (Severity=10, ≥9 → CC)
 * 3. ARMREST OP 25: Add SC in CP (S=6, O≥4 → SC)
 * 4. HEADREST_FRONT OP 60: Add SC in CP (S=6, O≥4 → SC)
 *
 * Flagged for manual review (NOT auto-corrected):
 * - 52 AP=H causes without actions
 * - 7 CP items with TBD methods
 * - 43 HO QCs empty
 * - 124 combined names "PROCESO - ALMACENAMIENTO WIP"
 */
import {
    ensureAuth,
    fetchAllAmfeDocs,
    fetchAllCpDocs,
    execSqlRead,
    execSqlWrite,
    backupDoc,
    writeResults,
    normOp,
} from './supabaseHelper.js';
import * as crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CorrectionLog {
    correction: string;
    product: string;
    docType: 'AMFE' | 'CP' | 'HO' | 'PFD';
    docId: string;
    operation: string;
    opNumber: string;
    detail: string;
    applied: boolean;
    error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function escapeStr(s: string): string {
    return s.replace(/'/g, "''");
}

async function updateDocData(
    table: string,
    id: string,
    doc: any,
    extraCols: Record<string, string | number>,
): Promise<void> {
    const jsonStr = JSON.stringify(doc);
    const checksum = sha256(jsonStr);
    const setClauses = Object.entries(extraCols)
        .map(([k, v]) => `${k} = ${typeof v === 'number' ? v : `'${escapeStr(String(v))}'`}`)
        .join(', ');
    const query = `UPDATE ${table} SET data = '${escapeStr(jsonStr)}', checksum = '${checksum}', updated_at = datetime('now')${setClauses ? ', ' + setClauses : ''} WHERE id = '${escapeStr(id)}'`;
    await execSqlWrite(query);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== Part D: Apply Corrections ===\n');
    await ensureAuth();

    const logs: CorrectionLog[] = [];

    // Load all data
    console.log('Loading documents...');
    const [amfeDocs, cpDocs] = await Promise.all([
        fetchAllAmfeDocs(),
        fetchAllCpDocs(),
    ]);

    // ────────────────────────────────────────────────────────────────────────
    // Correction 1: TOP_ROLL OP 11 "ALMACENAMIENTO EN MEDIOS WIP"
    // Remove from AMFE and CP — storage is not a process operation
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n── Correction 1: TOP_ROLL OP 11 WIP Storage ──');

    const topRollAmfe = amfeDocs.find(d =>
        (d.raw.project_name as string || '').includes('TOP_ROLL') &&
        !(d.raw.project_name as string || '').includes('[')
    );

    if (topRollAmfe) {
        const doc = topRollAmfe.parsed;
        const ops = doc.operations || [];
        const wipOpIdx = ops.findIndex((op: any) =>
            normOp(op.name).includes('almacenamiento') &&
            normOp(op.name).includes('wip')
        );

        if (wipOpIdx >= 0) {
            const wipOp = ops[wipOpIdx];
            console.log(`  Found: OP ${wipOp.opNumber} "${wipOp.name}" in AMFE ${topRollAmfe.id}`);

            // Backup
            backupDoc('amfe_documents', topRollAmfe.id, topRollAmfe.raw.data as string);

            // Remove the operation
            ops.splice(wipOpIdx, 1);
            doc.operations = ops;

            // Recompute stats
            let causeCount = 0;
            let apH = 0;
            let apM = 0;
            for (const op of ops) {
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

            try {
                await updateDocData('amfe_documents', topRollAmfe.id, doc, {
                    operation_count: ops.length,
                    cause_count: causeCount,
                    ap_h_count: apH,
                    ap_m_count: apM,
                });
                console.log(`  ✓ Removed OP ${wipOp.opNumber} from AMFE. Ops: ${ops.length}, Causes: ${causeCount}`);
                logs.push({
                    correction: 'Remove WIP storage operation',
                    product: 'TOP_ROLL',
                    docType: 'AMFE',
                    docId: topRollAmfe.id,
                    operation: wipOp.name,
                    opNumber: wipOp.opNumber,
                    detail: `Removed operation with ${wipOp.workElements?.length || 0} work elements`,
                    applied: true,
                });
            } catch (e: any) {
                console.log(`  ✗ Error: ${e.message}`);
                logs.push({
                    correction: 'Remove WIP storage operation',
                    product: 'TOP_ROLL',
                    docType: 'AMFE',
                    docId: topRollAmfe.id,
                    operation: wipOp.name,
                    opNumber: wipOp.opNumber,
                    detail: e.message,
                    applied: false,
                    error: e.message,
                });
            }
        } else {
            console.log('  OP 11 WIP not found in TOP_ROLL AMFE (may have been already removed)');
        }
    } else {
        console.log('  TOP_ROLL master AMFE not found');
    }

    // Now remove from CP
    const topRollCp = cpDocs.find(d =>
        (d.raw.linked_amfe_project as string || '').includes('TOP_ROLL') &&
        !(d.raw.project_name as string || '').includes('[')
    );

    if (topRollCp) {
        const doc = topRollCp.parsed;
        const items = doc.items || [];
        const wipItems = items.filter((item: any) =>
            normOp(item.processDescription || '').includes('almacenamiento') &&
            normOp(item.processDescription || '').includes('wip')
        );

        if (wipItems.length > 0) {
            console.log(`  Found ${wipItems.length} CP items for WIP storage in CP ${topRollCp.id}`);

            // Backup
            backupDoc('cp_documents', topRollCp.id, topRollCp.raw.data as string);

            // Remove WIP items
            doc.items = items.filter((item: any) =>
                !(normOp(item.processDescription || '').includes('almacenamiento') &&
                  normOp(item.processDescription || '').includes('wip'))
            );

            try {
                await updateDocData('cp_documents', topRollCp.id, doc, {
                    item_count: doc.items.length,
                });
                console.log(`  ✓ Removed ${wipItems.length} CP items. Remaining: ${doc.items.length}`);
                logs.push({
                    correction: 'Remove WIP storage items from CP',
                    product: 'TOP_ROLL',
                    docType: 'CP',
                    docId: topRollCp.id,
                    operation: 'ALMACENAMIENTO EN MEDIOS WIP',
                    opNumber: '11',
                    detail: `Removed ${wipItems.length} items`,
                    applied: true,
                });
            } catch (e: any) {
                console.log(`  ✗ Error: ${e.message}`);
                logs.push({
                    correction: 'Remove WIP storage items from CP',
                    product: 'TOP_ROLL',
                    docType: 'CP',
                    docId: topRollCp.id,
                    operation: 'ALMACENAMIENTO EN MEDIOS WIP',
                    opNumber: '11',
                    detail: e.message,
                    applied: false,
                    error: e.message,
                });
            }
        } else {
            console.log('  No WIP items found in TOP_ROLL CP');
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Correction 2: ARMREST OP 90 — SC → CC (Severity = 10)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n── Correction 2: ARMREST OP 90 SC → CC ──');

    const armrestCp = cpDocs.find(d =>
        (d.raw.linked_amfe_project as string || '').includes('ARMREST_DOOR_PANEL')
    );

    if (armrestCp) {
        const doc = armrestCp.parsed;
        const items = doc.items || [];
        let changed = 0;

        for (const item of items) {
            if (item.processStepNumber === '90' && item.specialCharClass === 'SC') {
                item.specialCharClass = 'CC';
                changed++;
            }
        }

        if (changed > 0) {
            backupDoc('cp_documents', armrestCp.id, armrestCp.raw.data as string);
            try {
                await updateDocData('cp_documents', armrestCp.id, doc, {
                    item_count: items.length,
                });
                console.log(`  ✓ Changed ${changed} items SC → CC for OP 90`);
                logs.push({
                    correction: 'SC → CC for Severity=10',
                    product: 'ARMREST_DOOR_PANEL',
                    docType: 'CP',
                    docId: armrestCp.id,
                    operation: 'TAPIZADO - TAPIZADO SEMIAUTOMATICO',
                    opNumber: '90',
                    detail: `Changed ${changed} items from SC to CC`,
                    applied: true,
                });
            } catch (e: any) {
                console.log(`  ✗ Error: ${e.message}`);
                logs.push({
                    correction: 'SC → CC for Severity=10',
                    product: 'ARMREST_DOOR_PANEL',
                    docType: 'CP',
                    docId: armrestCp.id,
                    operation: 'TAPIZADO',
                    opNumber: '90',
                    detail: e.message,
                    applied: false,
                    error: e.message,
                });
            }
        } else {
            console.log('  No SC items found for OP 90 (may already be CC)');
        }

        // ────────────────────────────────────────────────────────────────────
        // Correction 3: ARMREST OP 25 — Add SC (Severity=6, O≥4)
        // ────────────────────────────────────────────────────────────────────
        console.log('\n── Correction 3: ARMREST OP 25 Add SC ──');

        let changed25 = 0;
        for (const item of items) {
            if (item.processStepNumber === '25' && (!item.specialCharClass || item.specialCharClass === '')) {
                item.specialCharClass = 'SC';
                changed25++;
            }
        }

        if (changed25 > 0) {
            // Already backed up above if correction 2 ran, but backup is idempotent
            try {
                await updateDocData('cp_documents', armrestCp.id, doc, {
                    item_count: items.length,
                });
                console.log(`  ✓ Added SC to ${changed25} items for OP 25`);
                logs.push({
                    correction: 'Add SC for S=6 O≥4',
                    product: 'ARMREST_DOOR_PANEL',
                    docType: 'CP',
                    docId: armrestCp.id,
                    operation: 'CORTE DE COMPONENTES - CONTROL CON MYLAR',
                    opNumber: '25',
                    detail: `Added SC to ${changed25} items`,
                    applied: true,
                });
            } catch (e: any) {
                console.log(`  ✗ Error: ${e.message}`);
                logs.push({
                    correction: 'Add SC for S=6 O≥4',
                    product: 'ARMREST_DOOR_PANEL',
                    docType: 'CP',
                    docId: armrestCp.id,
                    operation: 'CORTE',
                    opNumber: '25',
                    detail: e.message,
                    applied: false,
                    error: e.message,
                });
            }
        } else {
            console.log('  No empty specialCharClass items found for OP 25');
        }
    } else {
        console.log('  ARMREST CP not found');
    }

    // ────────────────────────────────────────────────────────────────────────
    // Correction 4: HEADREST_FRONT OP 60 — Add SC (Severity=6, O≥4)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n── Correction 4: HEADREST_FRONT OP 60 Add SC ──');

    // Find master and all variants for HEADREST_FRONT
    const headrestFrontCps = cpDocs.filter(d =>
        (d.raw.linked_amfe_project as string || '').includes('HEADREST_FRONT')
    );

    for (const hfCp of headrestFrontCps) {
        const doc = hfCp.parsed;
        const items = doc.items || [];
        let changed60 = 0;

        for (const item of items) {
            if (item.processStepNumber === '60' && (!item.specialCharClass || item.specialCharClass === '')) {
                item.specialCharClass = 'SC';
                changed60++;
            }
        }

        if (changed60 > 0) {
            backupDoc('cp_documents', hfCp.id, hfCp.raw.data as string);
            try {
                await updateDocData('cp_documents', hfCp.id, doc, {
                    item_count: items.length,
                });
                console.log(`  ✓ [${hfCp.raw.project_name}] Added SC to ${changed60} items for OP 60`);
                logs.push({
                    correction: 'Add SC for S=6 O≥4',
                    product: String(hfCp.raw.project_name),
                    docType: 'CP',
                    docId: hfCp.id,
                    operation: 'INYECCION PUR - APOYACABEZAS',
                    opNumber: '60',
                    detail: `Added SC to ${changed60} items`,
                    applied: true,
                });
            } catch (e: any) {
                console.log(`  ✗ Error: ${e.message}`);
                logs.push({
                    correction: 'Add SC for S=6 O≥4',
                    product: String(hfCp.raw.project_name),
                    docType: 'CP',
                    docId: hfCp.id,
                    operation: 'INYECCION PUR',
                    opNumber: '60',
                    detail: e.message,
                    applied: false,
                    error: e.message,
                });
            }
        } else {
            console.log(`  [${hfCp.raw.project_name}] No empty specialCharClass items for OP 60`);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Summary
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n\n════════════════════════════════════════════════════');
    console.log('  CORRECTION SUMMARY');
    console.log('════════════════════════════════════════════════════');

    const applied = logs.filter(l => l.applied);
    const failed = logs.filter(l => !l.applied);

    console.log(`\n  Applied: ${applied.length}`);
    for (const l of applied) {
        console.log(`    ✓ [${l.product}] ${l.correction}: ${l.detail}`);
    }

    if (failed.length > 0) {
        console.log(`\n  Failed: ${failed.length}`);
        for (const l of failed) {
            console.log(`    ✗ [${l.product}] ${l.correction}: ${l.error}`);
        }
    }

    console.log('\n  Flagged for manual review (NOT corrected):');
    console.log('    - 52 AP=H causes without corrective actions');
    console.log('    - 7 CP items with TBD evaluation methods');
    console.log('    - 43 HO quality checks with empty descriptions');
    console.log('    - 124 combined names "PROCESO - ALMACENAMIENTO WIP"');
    console.log('    - 42 PFD vs AMFE name mismatches');

    // Write results
    writeResults('D_corrections.json', {
        timestamp: new Date().toISOString(),
        summary: {
            totalCorrections: logs.length,
            applied: applied.length,
            failed: failed.length,
        },
        corrections: logs,
        manualReview: {
            apH_withoutActions: 52,
            tbdMethods: 7,
            emptyHoQcs: 43,
            combinedWipNames: 124,
            nameMismatches: 42,
        },
    });

    console.log('\nDone.');
}

main().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});

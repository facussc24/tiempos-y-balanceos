#!/usr/bin/env node
/**
 * fix-insert-master-cp.mjs
 *
 * Generates CP items for the Insert master (AMFE-00001, project VWA/PATAGONIA/INSERTO)
 * which has ~90 SC causes without CP coverage.
 *
 * Steps:
 *   1. Reads Insert MASTER AMFE and CP from Supabase
 *   2. Reads Insert [L0] CP as reference for structure
 *   3. Finds all AMFE causes with SC/CC or AP=H/M that are NOT covered in the CP
 *   4. Creates new CP items for uncovered operations
 *   5. Updates the master CP in Supabase
 *
 * Usage: node scripts/fix-insert-master-cp.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { calcAP } from './apTableShared.mjs';
import { randomUUID, createHash } from 'crypto';

// ─── Constants ──────────────────────────────────────────────────────────────

const AMFE_MASTER_PROJECT = 'VWA/PATAGONIA/INSERTO';
const CP_MASTER_PROJECT = 'VWA/PATAGONIA/INSERT';
const VARIANT_PROJECT = 'VWA/PATAGONIA/INSERT [L0]';

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(doc) {
    return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

function inferFrequency(opName) {
    const n = (opName || '').toUpperCase();
    if (/RECEP/.test(n)) return 'Cada recepcion';
    if (/EMBALA/.test(n)) return 'Cada contenedor';
    if (/INSPECCION|CONTROL/.test(n)) return 'Cada pieza';
    return 'Inicio y fin de turno';
}

function inferCategory(opName) {
    const n = (opName || '').toLowerCase();
    if (/sold[au]/i.test(n)) return 'soldadura';
    if (/ensam[bp]l/i.test(n)) return 'ensamble';
    if (/pintu/i.test(n)) return 'pintura';
    if (/mecaniz/i.test(n)) return 'mecanizado';
    if (/inyecci[oó]n/i.test(n)) return 'inyeccion';
    if (/inspec/i.test(n)) return 'inspeccion';
    if (/troquel/i.test(n)) return 'troquelado';
    if (/costur/i.test(n)) return 'costura';
    if (/corte/i.test(n)) return 'corte';
    if (/embala/i.test(n)) return 'embalaje';
    if (/adhesi/i.test(n)) return 'adhesivado';
    if (/tapiz/i.test(n)) return 'tapizado';
    if (/recep/i.test(n)) return 'recepcion';
    if (/refil/i.test(n)) return 'refilado';
    if (/almacen|wip/i.test(n)) return 'almacenamiento';
    if (/reproc/i.test(n)) return 'reproceso';
    if (/clasif|segreg/i.test(n)) return 'clasificacion';
    if (/prearm/i.test(n)) return 'ensamble';
    return '';
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    // 1. Read Insert MASTER AMFE
    console.log('\n=== Reading Insert MASTER AMFE ===');
    const amfeDocs = await selectSql(
        `SELECT id, data FROM amfe_documents WHERE project_name = '${AMFE_MASTER_PROJECT}'`
    );
    if (amfeDocs.length === 0) {
        console.error('ERROR: Insert master AMFE not found!');
        process.exit(1);
    }
    const amfeDoc = amfeDocs[0];
    const amfeData = parseData(amfeDoc);
    console.log(`  AMFE id: ${amfeDoc.id}`);
    console.log(`  Operations: ${(amfeData.operations || []).length}`);

    // 2. Read Insert MASTER CP
    console.log('\n=== Reading Insert MASTER CP ===');
    const cpDocs = await selectSql(
        `SELECT id, data FROM cp_documents WHERE project_name = '${CP_MASTER_PROJECT}'`
    );
    if (cpDocs.length === 0) {
        console.error('ERROR: Insert master CP not found!');
        process.exit(1);
    }
    const cpDoc = cpDocs[0];
    const cpData = parseData(cpDoc);
    const existingItems = cpData.items || [];
    console.log(`  CP id: ${cpDoc.id}`);
    console.log(`  Existing items: ${existingItems.length}`);

    // 3. Read Insert [L0] CP as reference
    console.log('\n=== Reading Insert [L0] CP (reference) ===');
    const refCpDocs = await selectSql(
        `SELECT id, data FROM cp_documents WHERE project_name = '${VARIANT_PROJECT}'`
    );
    if (refCpDocs.length > 0) {
        const refCpData = parseData(refCpDocs[0]);
        console.log(`  [L0] CP items: ${(refCpData.items || []).length} (reference)`);
    } else {
        console.log('  [L0] CP not found — proceeding without reference');
    }

    // 4. Build Set of processStepNumbers already covered in the master CP
    //    We track which (processStepNumber + cause) combos exist to avoid true duplication
    const coveredOps = new Set();
    const coveredCauseIds = new Set();
    for (const item of existingItems) {
        coveredOps.add(item.processStepNumber);
        if (item.amfeCauseIds) {
            for (const cid of item.amfeCauseIds) {
                coveredCauseIds.add(cid);
            }
        }
    }
    console.log(`\n  Operations already in CP: ${coveredOps.size} distinct step numbers`);
    console.log(`  Cause IDs already covered: ${coveredCauseIds.size}`);

    // 5. Iterate AMFE: operations → workElements → functions → failures → causes
    //    Find SC/CC causes or AP=H/M causes not covered
    console.log('\n=== Scanning AMFE for uncovered SC/CC/H/M causes ===');
    const newItems = [];
    let totalCauses = 0;
    let qualifyingCauses = 0;
    let alreadyCovered = 0;

    for (const op of (amfeData.operations || [])) {
        const opNewItems = [];

        for (const we of (op.workElements || [])) {
            for (const func of (we.functions || [])) {
                for (const fail of (func.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        totalCauses++;

                        // Check if this cause qualifies
                        const isSCCC = cause.specialChar === 'SC' || cause.specialChar === 'CC';
                        const isHM = cause.ap === 'H' || cause.ap === 'M';

                        if (!isSCCC && !isHM) continue;
                        qualifyingCauses++;

                        // Check if already covered by cause ID
                        if (coveredCauseIds.has(cause.id)) {
                            alreadyCovered++;
                            continue;
                        }

                        // Create new CP item
                        const severity = Number(fail.severity) || 0;
                        const specialChar = cause.specialChar || (severity >= 9 ? 'CC' : 'SC');

                        opNewItems.push({
                            id: randomUUID(),
                            processStepNumber: op.opNumber,
                            processDescription: op.name,
                            machineDeviceTool: we.name || '',
                            characteristicNumber: cause.characteristicNumber || '',
                            productCharacteristic: '',
                            processCharacteristic: cause.cause || fail.description,
                            specialCharClass: specialChar,
                            specification: 'Segun instruccion de proceso',
                            evaluationTechnique: cause.detectionControl || '',
                            sampleSize: '3 piezas',
                            sampleFrequency: inferFrequency(op.name),
                            controlMethod: cause.preventionControl || '',
                            reactionPlan: 'Ajustar proceso. Reinspeccionar ultimo lote. Registrar desvio.',
                            reactionPlanOwner: 'Operador de Produccion',
                            controlProcedure: '',
                            autoFilledFields: [],
                            amfeAp: cause.ap,
                            amfeSeverity: severity,
                            operationCategory: inferCategory(op.name),
                            amfeCauseIds: [cause.id],
                            amfeFailureId: fail.id,
                            amfeFailureIds: [fail.id],
                        });

                        // Mark this cause as now covered
                        coveredCauseIds.add(cause.id);
                    }
                }
            }
        }

        if (opNewItems.length > 0) {
            console.log(`  Op ${op.opNumber} (${op.name}): +${opNewItems.length} new CP items`);
            newItems.push(...opNewItems);
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`  Total AMFE causes: ${totalCauses}`);
    console.log(`  Qualifying (SC/CC/H/M): ${qualifyingCauses}`);
    console.log(`  Already covered: ${alreadyCovered}`);
    console.log(`  NEW items to add: ${newItems.length}`);

    if (newItems.length === 0) {
        console.log('\n  No new items needed — CP is already complete.');
        close();
        return;
    }

    // 6. Append new items to existing CP data
    cpData.items = [...existingItems, ...newItems];

    // Sort all items by processStepNumber
    cpData.items.sort((a, b) => {
        const na = parseInt(a.processStepNumber) || 0;
        const nb = parseInt(b.processStepNumber) || 0;
        if (na !== nb) return na - nb;
        // Process characteristic rows before product characteristic rows
        return (a.processCharacteristic ? 0 : 1) - (b.processCharacteristic ? 0 : 1);
    });

    // 7. Update metadata
    if (cpData.header) {
        cpData.header.itemCount = cpData.items.length;
    }

    // 8. Calculate checksum
    const checksum = createHash('sha256').update(JSON.stringify(cpData)).digest('hex');

    // 9. Update in Supabase
    console.log('\n=== Updating CP in Supabase ===');
    const jsonStr = JSON.stringify(cpData).replace(/'/g, "''");
    const itemCount = cpData.items.length;

    await execSql(
        `UPDATE cp_documents SET data = '${jsonStr}', checksum = '${checksum}', item_count = ${itemCount}, updated_at = NOW() WHERE id = '${cpDoc.id}'`
    );

    console.log(`  Updated CP ${cpDoc.id}`);
    console.log(`  Total items now: ${itemCount} (was ${existingItems.length}, added ${newItems.length})`);
    console.log(`  Checksum: ${checksum.slice(0, 16)}...`);

    // 10. Verification
    console.log('\n=== Verification ===');
    const verifyDocs = await selectSql(
        `SELECT item_count FROM cp_documents WHERE id = '${cpDoc.id}'`
    );
    if (verifyDocs.length > 0) {
        console.log(`  Verified item_count in DB: ${verifyDocs[0].item_count}`);
    }

    close();
    console.log('\nDone.');
}

main().catch((err) => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});

#!/usr/bin/env node
/**
 * fix-ho-operation-names.mjs
 *
 * Unifica nombres de operaciones en HO y CP para que coincidan con el AMFE
 * (fuente de verdad) en los productos headrest e Insert.
 *
 * Para cada familia de producto:
 *   1. Carga el AMFE (por project_name)
 *   2. Construye mapa: opNumber -> nombre AMFE
 *   3. Carga todos los HO vinculados (linked_amfe_project)
 *   4. Para cada HO sheet: si operationName difiere del AMFE -> corrige
 *   5. Carga todos los CP vinculados (linked_amfe_project)
 *   6. Para cada CP item: si processDescription difiere del AMFE -> corrige
 *   7. Recalcula checksums y guarda
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PRODUCTS = [
    'VWA/PATAGONIA/HEADREST_FRONT',
    'VWA/PATAGONIA/HEADREST_REAR_CEN',
    'VWA/PATAGONIA/HEADREST_REAR_OUT',
    'VWA/PATAGONIA/INSERT',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();

    console.log('\n' + '='.repeat(70));
    console.log('  UNIFICAR NOMBRES DE OPERACIONES HO/CP CON AMFE');
    console.log('  (AMFE es fuente de verdad)');
    console.log('='.repeat(70));

    let grandTotalHo = 0;
    let grandTotalCp = 0;

    for (const projectName of PRODUCTS) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`  PRODUCTO: ${projectName}`);
        console.log(`${'─'.repeat(70)}`);

        // -----------------------------------------------------------------
        // 1. Load AMFE document (master) by project_name
        // -----------------------------------------------------------------
        const amfeDocs = await selectSql(
            `SELECT id, project_name, data FROM amfe_documents WHERE project_name = ?`,
            [projectName]
        );

        if (amfeDocs.length === 0) {
            console.log(`  [SKIP] No se encontro AMFE para "${projectName}"`);
            continue;
        }

        const amfeRow = amfeDocs[0];
        const amfeData = JSON.parse(amfeRow.data);
        console.log(`  AMFE encontrado: id=${amfeRow.id}`);

        // Build map: opNumber -> AMFE operation name
        const amfeNameMap = new Map();
        for (const op of (amfeData.operations || [])) {
            if (op.opNumber && op.name) {
                amfeNameMap.set(op.opNumber, op.name);
            }
        }

        console.log(`  Operaciones AMFE: ${amfeNameMap.size}`);
        for (const [num, name] of amfeNameMap) {
            console.log(`    Op ${num}: "${name}"`);
        }

        // -----------------------------------------------------------------
        // 2. Fix HO documents linked to this AMFE project
        // -----------------------------------------------------------------
        const hoDocs = await selectSql(
            `SELECT id, data FROM ho_documents WHERE linked_amfe_project = ?`,
            [projectName]
        );

        console.log(`\n  HO documents vinculados: ${hoDocs.length}`);
        let hoFixedThisProduct = 0;

        for (const hoRow of hoDocs) {
            try {
                const hoData = JSON.parse(hoRow.data);
                let hoChanged = false;

                for (const sheet of (hoData.sheets || [])) {
                    const opNum = sheet.operationNumber;
                    const amfeName = amfeNameMap.get(opNum);

                    if (!amfeName) continue; // No matching AMFE operation
                    if (sheet.operationName === amfeName) continue; // Already correct

                    console.log(`    [HO id=${hoRow.id}] Op ${opNum}: "${sheet.operationName}" -> "${amfeName}"`);
                    sheet.operationName = amfeName;
                    hoChanged = true;
                    hoFixedThisProduct++;
                }

                if (hoChanged) {
                    const jsonStr = JSON.stringify(hoData);
                    const checksum = sha256(jsonStr);
                    await execSql(
                        `UPDATE ho_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                        [jsonStr, checksum, hoRow.id]
                    );
                    console.log(`    [HO id=${hoRow.id}] Guardado con nuevo checksum`);
                }
            } catch (err) {
                console.error(`    [HO] ERROR id=${hoRow.id}: ${err.message}`);
            }
        }

        console.log(`  HO: ${hoFixedThisProduct} nombres corregidos`);
        grandTotalHo += hoFixedThisProduct;

        // -----------------------------------------------------------------
        // 3. Fix CP documents linked to this AMFE project
        // -----------------------------------------------------------------
        const cpDocs = await selectSql(
            `SELECT id, data FROM cp_documents WHERE linked_amfe_project = ?`,
            [projectName]
        );

        console.log(`\n  CP documents vinculados: ${cpDocs.length}`);
        let cpFixedThisProduct = 0;

        for (const cpRow of cpDocs) {
            try {
                const cpData = JSON.parse(cpRow.data);
                let cpChanged = false;

                for (const item of (cpData.items || [])) {
                    const stepNum = item.processStepNumber;
                    const amfeName = amfeNameMap.get(stepNum);

                    if (!amfeName) continue; // No matching AMFE operation
                    if (item.processDescription === amfeName) continue; // Already correct

                    console.log(`    [CP id=${cpRow.id}] Step ${stepNum}: "${item.processDescription}" -> "${amfeName}"`);
                    item.processDescription = amfeName;
                    cpChanged = true;
                    cpFixedThisProduct++;
                }

                if (cpChanged) {
                    const jsonStr = JSON.stringify(cpData);
                    const checksum = sha256(jsonStr);
                    await execSql(
                        `UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                        [jsonStr, checksum, cpRow.id]
                    );
                    console.log(`    [CP id=${cpRow.id}] Guardado con nuevo checksum`);
                }
            } catch (err) {
                console.error(`    [CP] ERROR id=${cpRow.id}: ${err.message}`);
            }
        }

        console.log(`  CP: ${cpFixedThisProduct} nombres corregidos`);
        grandTotalCp += cpFixedThisProduct;
    }

    // -----------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------
    console.log('\n' + '='.repeat(70));
    console.log('  RESUMEN FINAL');
    console.log('='.repeat(70));
    console.log(`  HO nombres corregidos: ${grandTotalHo}`);
    console.log(`  CP nombres corregidos: ${grandTotalCp}`);
    console.log(`  Total cambios: ${grandTotalHo + grandTotalCp}`);

    if (grandTotalHo === 0 && grandTotalCp === 0) {
        console.log('\n  Todos los nombres ya estaban alineados con AMFE.');
    }

    close();
    console.log('\nDone.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

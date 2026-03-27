#!/usr/bin/env node
/**
 * Unify operation names across CP and HO documents in Supabase.
 *
 * Renames:
 *   - "RECEPCIONAR MATERIA PRIMA" → "RECEPCION DE MATERIA PRIMA"
 *   - "RECEPCION DE MATERIALES*" → "RECEPCION DE MATERIA PRIMA"
 *   - "*INSPECCION FINAL*" / "*INSPECCIÓN FINAL*" → "CONTROL FINAL DE CALIDAD"
 *   - "EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO" → "EMBALAJE"
 *
 * Usage:
 *   node scripts/fix-operation-names.mjs              # dry-run
 *   node scripts/fix-operation-names.mjs --apply       # write changes
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const DRY_RUN = !process.argv.includes('--apply');

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

/**
 * Apply rename rules to an operation name.
 * Returns [newName, ruleApplied] or [null, null] if no rule matches.
 */
function renameOp(name) {
    if (!name) return [null, null];
    const upper = name.toUpperCase().trim();

    // Rule 1: RECEPCIONAR → RECEPCION DE MATERIA PRIMA
    if (upper === 'RECEPCIONAR MATERIA PRIMA') {
        return ['RECEPCION DE MATERIA PRIMA', 'RECEPCIONAR→RECEPCION'];
    }

    // Rule 2: RECEPCION DE MATERIALES (any suffix) → RECEPCION DE MATERIA PRIMA
    if (upper.startsWith('RECEPCION DE MATERIALES')) {
        return ['RECEPCION DE MATERIA PRIMA', 'MATERIALES→MATERIA PRIMA'];
    }

    // Rule 3: Any variant with INSPECCION/INSPECCIÓN FINAL → CONTROL FINAL DE CALIDAD
    if (upper.includes('INSPECCION FINAL') || upper.includes('INSPECCIÓN FINAL')) {
        return ['CONTROL FINAL DE CALIDAD', 'INSP.FINAL→CTRL.FINAL'];
    }

    // Rule 4: EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO → EMBALAJE
    if (upper === 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO') {
        return ['EMBALAJE', 'EMBALAJE+ETIQUETADO→EMBALAJE'];
    }

    return [null, null];
}

async function main() {
    await initSupabase();
    console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}\n`);

    // --- CP documents ---
    console.log('=== CP Documents ===');
    const cpDocs = await selectSql('SELECT id, project_name, data FROM cp_documents');
    let cpChanges = 0;

    for (const row of cpDocs) {
        const data = JSON.parse(row.data);
        let docChanges = 0;

        for (const item of (data.items || [])) {
            const [newName, rule] = renameOp(item.processDescription);
            if (newName) {
                console.log(`  CP ${row.project_name} | OP ${item.processStepNumber} | "${item.processDescription}" → "${newName}" [${rule}]`);
                item.processDescription = newName;
                docChanges++;
            }
        }

        if (docChanges > 0 && !DRY_RUN) {
            const jsonString = JSON.stringify(data);
            const checksum = sha256(jsonString);
            await execSql(
                `UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                [jsonString, checksum, row.id]
            );
        }
        cpChanges += docChanges;
    }

    // --- HO documents ---
    console.log('\n=== HO Documents ===');
    const hoDocs = await selectSql('SELECT id, linked_cp_project, data FROM ho_documents');
    let hoChanges = 0;

    for (const row of hoDocs) {
        const data = JSON.parse(row.data);
        let docChanges = 0;

        for (const sheet of (data.sheets || [])) {
            const [newName, rule] = renameOp(sheet.operationName);
            if (newName) {
                console.log(`  HO ${row.linked_cp_project} | ${sheet.hoNumber} | "${sheet.operationName}" → "${newName}" [${rule}]`);
                sheet.operationName = newName;
                docChanges++;
            }
        }

        if (docChanges > 0 && !DRY_RUN) {
            const jsonString = JSON.stringify(data);
            const checksum = sha256(jsonString);
            await execSql(
                `UPDATE ho_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                [jsonString, checksum, row.id]
            );
        }
        hoChanges += docChanges;
    }

    console.log(`\n${DRY_RUN ? 'Would rename' : 'Renamed'}: ${cpChanges} CP items + ${hoChanges} HO sheets = ${cpChanges + hoChanges} total.`);

    close();
    console.log('Done.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

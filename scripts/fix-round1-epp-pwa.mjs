#!/usr/bin/env node
/**
 * FIX: Assign EPP (Elementos de Protección Personal) to PWA HO sheets without EPP
 *
 * Reads HO documents for PWA/TELAS_PLANAS and PWA/TELAS_TERMOFORMADAS,
 * finds sheets with empty/missing safetyElements, and assigns appropriate EPP.
 *
 * Base EPP for ALL sheets: anteojos, guantes, zapatos
 * Additional proteccionAuditiva for: Corte, Troquelado, Perforado, Horno, Termoformado, Soldadura
 *
 * Usage: node scripts/fix-round1-epp-pwa.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ═══════════════════════════════════════════════════════════════════════════
// EPP ASSIGNMENT LOGIC
// ═══════════════════════════════════════════════════════════════════════════

const BASE_EPP = ['anteojos', 'guantes', 'zapatos'];

/** Keywords that require proteccionAuditiva */
const NOISY_OPS = ['corte', 'troquelado', 'perforado', 'horno', 'termoformado', 'soldadura'];

/**
 * Determine EPP for a sheet based on its operationName.
 */
function determineEpp(operationName) {
    const epp = [...BASE_EPP];
    const opLower = (operationName || '').toLowerCase();

    for (const keyword of NOISY_OPS) {
        if (opLower.includes(keyword)) {
            epp.push('proteccionAuditiva');
            break;
        }
    }

    return epp;
}

/**
 * Check if a sheet needs EPP assigned.
 */
function needsEpp(sheet) {
    return !sheet.safetyElements ||
           !Array.isArray(sheet.safetyElements) ||
           sheet.safetyElements.length === 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  FIX: Assign EPP to PWA HO Sheets Without EPP');
    console.log('═══════════════════════════════════════════════════════════\n');

    await initSupabase();

    // ── Step 1: Query PWA HO documents ────────────────────────────────
    console.log('── Step 1: Querying PWA HO documents ──────────────────────');

    const rows = await selectSql(
        `SELECT id, data, linked_amfe_project FROM ho_documents WHERE linked_amfe_project IN ('PWA/TELAS_PLANAS','PWA/TELAS_TERMOFORMADAS')`
    );

    console.log(`  Found ${rows.length} HO document(s)\n`);

    if (rows.length === 0) {
        console.log('  No PWA HO documents found. Exiting.');
        close();
        return;
    }

    let totalModified = 0;
    let totalSkipped = 0;

    for (const row of rows) {
        console.log(`── Processing HO document: ${row.id} (${row.linked_amfe_project}) ──`);

        let doc;
        try {
            doc = JSON.parse(row.data);
        } catch (e) {
            console.log(`  ERROR: Could not parse JSON data: ${e.message}`);
            continue;
        }

        if (!doc.sheets || !Array.isArray(doc.sheets)) {
            console.log(`  WARNING: No sheets array found in document.`);
            continue;
        }

        let docModified = 0;
        let docSkipped = 0;

        for (const sheet of doc.sheets) {
            const opName = sheet.operationName || '(unnamed)';

            if (needsEpp(sheet)) {
                const epp = determineEpp(sheet.operationName);
                sheet.safetyElements = epp;
                docModified++;
                totalModified++;

                const eppStr = epp.join(', ');
                console.log(`    ASSIGNED: "${opName}" → [${eppStr}]`);
            } else {
                docSkipped++;
                totalSkipped++;
                console.log(`    SKIPPED:  "${opName}" (already has EPP: [${sheet.safetyElements.join(', ')}])`);
            }
        }

        console.log(`  Subtotal: ${docModified} modified, ${docSkipped} skipped\n`);

        if (docModified === 0) {
            console.log(`  No changes needed for this document.\n`);
            continue;
        }

        // ── Write back to Supabase ────────────────────────────────────
        const jsonStr = JSON.stringify(doc);
        const checksum = sha256(jsonStr);

        await execSql(
            `UPDATE ho_documents SET data = '${jsonStr.replace(/'/g, "''")}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${row.id}'`
        );

        console.log(`  SAVED to Supabase.\n`);
    }

    // ── Summary ───────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  TOTAL: ${totalModified} sheets modified, ${totalSkipped} sheets skipped`);
    console.log('═══════════════════════════════════════════════════════════');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

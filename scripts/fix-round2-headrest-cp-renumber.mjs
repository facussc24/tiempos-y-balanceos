#!/usr/bin/env node
/**
 * FIX: Renumber Headrest CP steps to align with AMFE operation numbers
 *
 * The 3 Headrest CP masters have step numbers that diverge from AMFE
 * operations starting at step 40.  The AMFE is the authoritative reference.
 *
 * REMAP (old → new):
 *   30.2  → 40   COSTURA VISTA
 *   40    → 50   ENSAMBLE DE VARILLA + EPP
 *   50    → 60   INYECCION PUR - APOYACABEZAS
 *   60    → 70   INSPECCION FINAL - APOYACABEZAS INYECTADO
 *   70    → 80   EMBALAJE
 *   80    → 90   TEST DE LAY OUT
 *
 * RENAME ONLY (keep same number):
 *   10 → RECEPCIONAR MATERIA PRIMA
 *   20 → CORTE DEL VINILO / TELA (FUNDA)
 *   30 → COSTURA UNION ENTRE PANELES
 *
 * For Rear Center: there is no AMFE OP 50 (no varilla insert).
 * If CP step 40 describes "Ensamble Asta" content, it still gets
 * renumbered to 50 for consistency.
 *
 * Usage: node scripts/fix-round2-headrest-cp-renumber.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ═══════════════════════════════════════════════════════════════════════════
// RENUMBERING MAPS
// ═══════════════════════════════════════════════════════════════════════════

/** Steps that need RENUMBERING + RENAMING */
const REMAP = {
    '30.2': { newNum: '40', newDesc: 'COSTURA VISTA' },
    '40':   { newNum: '50', newDesc: 'ENSAMBLE DE VARILLA + EPP' },
    '50':   { newNum: '60', newDesc: 'INYECCION PUR - APOYACABEZAS' },
    '60':   { newNum: '70', newDesc: 'INSPECCION FINAL - APOYACABEZAS INYECTADO' },
    '70':   { newNum: '80', newDesc: 'EMBALAJE' },
    '80':   { newNum: '90', newDesc: 'TEST DE LAY OUT' },
};

/** Steps that only need RENAMING (keep same number) */
const RENAME_ONLY = {
    '10': 'RECEPCIONAR MATERIA PRIMA',
    '20': 'CORTE DEL VINILO / TELA (FUNDA)',
    '30': 'COSTURA UNION ENTRE PANELES',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a BEFORE table: step → {desc, count}
 */
function buildStepSummary(items) {
    const summary = {};
    for (const item of items) {
        const step = String(item.processStepNumber ?? '?');
        if (!summary[step]) {
            summary[step] = { desc: item.processDescription || '(no desc)', count: 0 };
        }
        summary[step].count++;
    }
    return summary;
}

/**
 * Numeric sort key for step numbers (treats '30.2' as 30.2)
 */
function stepSortKey(stepNum) {
    return parseFloat(stepNum) || 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  FIX: Renumber Headrest CP Steps to Match AMFE Operations');
    console.log('═══════════════════════════════════════════════════════════\n');

    await initSupabase();

    // ── Step 1: Query the 3 Headrest CP master documents ─────────────
    console.log('── Step 1: Querying Headrest CP master documents ──────────\n');

    const rows = await selectSql(
        `SELECT id, data, project_name FROM cp_documents WHERE project_name IN ('VWA/PATAGONIA/HEADREST_FRONT','VWA/PATAGONIA/HEADREST_REAR_CEN','VWA/PATAGONIA/HEADREST_REAR_OUT')`
    );

    console.log(`  Found ${rows.length} CP document(s)\n`);

    if (rows.length === 0) {
        console.log('  No Headrest CP documents found. Exiting.');
        close();
        return;
    }

    let totalItemsModified = 0;

    for (const row of rows) {
        const docName = row.project_name;
        console.log(`\n${'═'.repeat(65)}`);
        console.log(`  DOCUMENT: ${docName}  (id: ${row.id})`);
        console.log(`${'═'.repeat(65)}\n`);

        let doc;
        try {
            doc = JSON.parse(row.data);
        } catch (e) {
            console.log(`  ERROR: Could not parse JSON data: ${e.message}`);
            continue;
        }

        if (!doc.items || !Array.isArray(doc.items)) {
            console.log(`  WARNING: No items array found in document.`);
            continue;
        }

        const items = doc.items;

        // ── BEFORE table ────────────────────────────────────────────
        const beforeSummary = buildStepSummary(items);
        console.log('  BEFORE:');
        console.log('  ' + '-'.repeat(61));
        console.log(`  ${'Step'.padEnd(8)} ${'Description'.padEnd(40)} Count`);
        console.log('  ' + '-'.repeat(61));
        const beforeSteps = Object.keys(beforeSummary).sort((a, b) => stepSortKey(a) - stepSortKey(b));
        for (const step of beforeSteps) {
            const { desc, count } = beforeSummary[step];
            console.log(`  ${step.padEnd(8)} ${desc.slice(0, 40).padEnd(40)} ${count}`);
        }
        console.log('  ' + '-'.repeat(61));
        console.log(`  Total items: ${items.length}\n`);

        // ── Apply renumbering ───────────────────────────────────────
        // Single-pass: look up OLD value in REMAP / RENAME_ONLY maps.
        // This avoids collision issues since we create new values from
        // the original (untouched) step number in each item.

        let modified = 0;
        let renamed = 0;
        let unchanged = 0;
        const warnings = [];

        for (const item of items) {
            const oldStep = String(item.processStepNumber ?? '');
            const oldDesc = item.processDescription || '';

            if (REMAP[oldStep]) {
                const { newNum, newDesc } = REMAP[oldStep];
                item.processStepNumber = newNum;
                item.processDescription = newDesc;
                modified++;
            } else if (RENAME_ONLY[oldStep]) {
                item.processDescription = RENAME_ONLY[oldStep];
                renamed++;
            } else {
                unchanged++;
                warnings.push(`    WARNING: Step "${oldStep}" ("${oldDesc.slice(0, 50)}") not in any map — left unchanged`);
            }
        }

        // ── Sort items by processStepNumber (numeric) ───────────────
        items.sort((a, b) => {
            const numA = stepSortKey(String(a.processStepNumber));
            const numB = stepSortKey(String(b.processStepNumber));
            return numA - numB;
        });

        // ── AFTER table ─────────────────────────────────────────────
        const afterSummary = buildStepSummary(items);
        console.log('  AFTER:');
        console.log('  ' + '-'.repeat(61));
        console.log(`  ${'Step'.padEnd(8)} ${'Description'.padEnd(40)} Count`);
        console.log('  ' + '-'.repeat(61));
        const afterSteps = Object.keys(afterSummary).sort((a, b) => stepSortKey(a) - stepSortKey(b));
        for (const step of afterSteps) {
            const { desc, count } = afterSummary[step];
            console.log(`  ${step.padEnd(8)} ${desc.slice(0, 40).padEnd(40)} ${count}`);
        }
        console.log('  ' + '-'.repeat(61));
        console.log(`  Total items: ${items.length}\n`);

        // ── Change summary ──────────────────────────────────────────
        console.log(`  Changes: ${modified} remapped, ${renamed} renamed, ${unchanged} unchanged`);
        for (const w of warnings) {
            console.log(w);
        }

        // ── BEFORE→AFTER mapping ────────────────────────────────────
        console.log('\n  Step mapping:');
        for (const oldStep of beforeSteps) {
            const beforeInfo = beforeSummary[oldStep];
            if (REMAP[oldStep]) {
                const { newNum, newDesc } = REMAP[oldStep];
                console.log(`    ${oldStep} ("${beforeInfo.desc.slice(0, 30)}") → ${newNum} ("${newDesc}")`);
            } else if (RENAME_ONLY[oldStep]) {
                console.log(`    ${oldStep} → ${oldStep} (renamed to "${RENAME_ONLY[oldStep]}")`);
            } else {
                console.log(`    ${oldStep} → ${oldStep} (unchanged)`);
            }
        }

        if (modified === 0 && renamed === 0) {
            console.log(`\n  No changes needed for this document.\n`);
            continue;
        }

        // ── Update doc ──────────────────────────────────────────────
        doc.items = items;
        const jsonStr = JSON.stringify(doc);
        const checksum = sha256(jsonStr);
        const itemCount = items.length;

        await execSql(
            `UPDATE cp_documents SET data = '${jsonStr.replace(/'/g, "''")}', checksum = '${checksum}', item_count = ${itemCount}, updated_at = NOW() WHERE id = '${row.id}'`
        );

        console.log(`\n  SAVED to Supabase (checksum: ${checksum.slice(0, 12)}..., item_count: ${itemCount})\n`);
        totalItemsModified += modified + renamed;
    }

    // ── Summary ───────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(65));
    console.log(`  TOTAL: ${totalItemsModified} items modified across ${rows.length} documents`);
    console.log('  Inheritance will propagate to L1/L2/L3 variants automatically.');
    console.log('═'.repeat(65));

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

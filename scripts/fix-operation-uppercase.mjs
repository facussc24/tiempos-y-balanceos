#!/usr/bin/env node
/**
 * fix-operation-uppercase.mjs
 *
 * Normalize operation names to UPPERCASE in specific AMFEs:
 *   - PWA/TELAS_PLANAS
 *   - PWA/TELAS_TERMOFORMADAS
 *   - VWA/PATAGONIA/INSERT [L0]
 *
 * Only changes operation.name — does NOT touch workElements, functions,
 * failures, causes, or any other nested data.
 *
 * Usage: node scripts/fix-operation-uppercase.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const TARGET_PROJECTS = [
    'PWA/TELAS_PLANAS',
    'PWA/TELAS_TERMOFORMADAS',
    'VWA/PATAGONIA/INSERT [L0]',
];

function parseData(doc) {
    return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

async function main() {
    await initSupabase();

    console.log('\n========================================');
    console.log('  FIX OPERATION NAMES → UPPERCASE');
    console.log('========================================');
    console.log(`  Targets: ${TARGET_PROJECTS.join(', ')}`);

    // Build WHERE clause
    const whereList = TARGET_PROJECTS.map(p => `'${p}'`).join(', ');
    const docs = await selectSql(
        `SELECT id, project_name, data FROM amfe_documents WHERE project_name IN (${whereList})`
    );

    console.log(`\n  Found ${docs.length} AMFE documents\n`);

    if (docs.length === 0) {
        console.log('  No matching documents found. Exiting.');
        close();
        return;
    }

    let totalChanged = 0;

    for (const doc of docs) {
        const data = parseData(doc);
        let changed = 0;

        console.log(`  [AMFE] ${doc.project_name} (${doc.id}):`);

        if (!data.operations || !Array.isArray(data.operations)) {
            console.log('    No operations array found — skipping');
            continue;
        }

        for (const op of data.operations) {
            const oldName = op.name;
            const newName = oldName.toUpperCase();
            if (oldName !== newName) {
                op.name = newName;
                changed++;
                console.log(`    OP ${op.opNumber}: "${oldName}" → "${newName}"`);
            }
        }

        if (changed === 0) {
            console.log('    All operations already uppercase — no changes');
            continue;
        }

        // Recalculate checksum and save
        const jsonStr = JSON.stringify(data);
        const checksum = createHash('sha256').update(jsonStr).digest('hex');
        const escapedJson = jsonStr.replace(/'/g, "''");

        await execSql(
            `UPDATE amfe_documents SET data = '${escapedJson}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`
        );

        console.log(`    → Saved (${changed} operations uppercased, checksum: ${checksum.slice(0, 16)}...)\n`);
        totalChanged += changed;
    }

    // Summary
    console.log('\n========================================');
    console.log('  SUMMARY');
    console.log('========================================');
    console.log(`  Documents scanned: ${docs.length}`);
    console.log(`  Total operations uppercased: ${totalChanged}`);

    close();
    console.log('\nDone.');
}

main().catch((err) => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});

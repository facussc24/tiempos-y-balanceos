#!/usr/bin/env node
/**
 * Round 1 Fix: Uppercase all operation names in Insert AMFE master.
 * 6/8 VWA products use ALL CAPS for operation names; Insert mixes cases.
 *
 * Usage: node scripts/fix-round1-amfe-uppercase.mjs
 */
import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

async function main() {
    await initSupabase();

    const docs = await selectSql(
        "SELECT id, data, project_name FROM amfe_documents WHERE project_name = 'VWA/PATAGONIA/INSERTO'"
    );

    if (docs.length !== 1) {
        console.error(`Expected 1 doc, got ${docs.length}`);
        close();
        return;
    }

    const row = docs[0];
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

    let changed = 0;
    console.log('\n  Operation name changes:');

    for (const op of data.operations) {
        const oldName = op.name;
        const newName = oldName.toUpperCase();
        if (oldName !== newName) {
            op.name = newName;
            changed++;
            console.log(`    OP ${op.opNumber}: "${oldName}" → "${newName}"`);
        } else {
            console.log(`    OP ${op.opNumber}: "${oldName}" (already uppercase)`);
        }
    }

    if (changed === 0) {
        console.log('\n  No changes needed.');
        close();
        return;
    }

    const jsonStr = JSON.stringify(data);
    const checksum = sha256(jsonStr);

    await execSql(
        `UPDATE amfe_documents SET data = '${jsonStr.replace(/'/g, "''")}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${row.id}'`
    );

    console.log(`\n  Updated ${changed} operation names to UPPERCASE.`);
    console.log(`  Document: ${row.project_name} (${row.id})`);

    close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

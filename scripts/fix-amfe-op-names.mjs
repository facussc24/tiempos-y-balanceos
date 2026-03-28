#!/usr/bin/env node
/**
 * Fix AMFE operation names to match CP processDescription (source of truth).
 * Only touches VWA products where discrepancies exist.
 * Run: node scripts/fix-amfe-op-names.mjs
 */
import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';

await initSupabase();

const amfes = await selectSql('SELECT id, project_name, data FROM amfe_documents');
const cps = await selectSql('SELECT id, project_name, data FROM cp_documents');

let totalFixed = 0;

for (const amfe of amfes) {
    const amfeData = typeof amfe.data === 'string' ? JSON.parse(amfe.data) : amfe.data;
    const cp = cps.find(c => c.project_name === amfe.project_name);
    if (!cp) { console.log(`  ${amfe.project_name}: no matching CP, skipping`); continue; }

    const cpData = typeof cp.data === 'string' ? JSON.parse(cp.data) : cp.data;

    // Build CP op name map (first occurrence per processStepNumber)
    const cpOps = {};
    for (const item of (cpData.items || [])) {
        if (!cpOps[item.processStepNumber]) {
            cpOps[item.processStepNumber] = item.processDescription;
        }
    }

    let changed = 0;
    for (const op of (amfeData.operations || [])) {
        const cpName = cpOps[op.opNumber];
        if (cpName && op.name !== cpName) {
            console.log(`  ${amfe.project_name} OP${op.opNumber}: "${op.name}" → "${cpName}"`);
            op.name = cpName;
            changed++;
        }
    }

    if (changed > 0) {
        const jsonStr = JSON.stringify(amfeData).replace(/'/g, "''");
        await execSql(`UPDATE amfe_documents SET data = '${jsonStr}' WHERE id = '${amfe.id}'`);
        console.log(`  ✅ ${amfe.project_name}: ${changed} names fixed\n`);
        totalFixed += changed;
    } else {
        console.log(`  ${amfe.project_name}: all names OK`);
    }
}

console.log(`\nDone. Total names fixed: ${totalFixed}`);
close();

#!/usr/bin/env node
/**
 * Recalculate ALL AP values in Supabase AMFE documents using corrected AIAG-VDA 2019 table.
 *
 * Reads each AMFE document, recalculates AP for every cause with complete S/O/D,
 * updates the data JSON, and writes back to Supabase.
 *
 * Usage: node scripts/recalculate-ap-supabase.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { calcAP } from './apTableShared.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

async function main() {
    await initSupabase();

    const docs = await selectSql(
        `SELECT id, amfe_number, project_name, data FROM amfe_documents ORDER BY project_name`
    );
    console.log(`  Found ${docs.length} AMFE documents\n`);

    let totalCauses = 0;
    let changed = 0;
    let unchanged = 0;
    const beforeDist = { H: 0, M: 0, L: 0 };
    const afterDist = { H: 0, M: 0, L: 0 };
    const changes = [];

    for (const doc of docs) {
        const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
        if (!data || !data.operations) continue;

        let docChanged = false;
        let docApH = 0;
        let docApM = 0;

        for (const op of data.operations) {
            for (const we of (op.workElements || [])) {
                for (const fn of (we.functions || [])) {
                    for (const fail of (fn.failures || [])) {
                        const severity = Number(fail.severity) || 0;
                        for (const cause of (fail.causes || [])) {
                            const occ = Number(cause.occurrence) || 0;
                            const det = Number(cause.detection) || 0;
                            if (severity < 1 || occ < 1 || det < 1) continue;

                            totalCauses++;
                            const oldAP = (cause.ap || '').toUpperCase();
                            const newAP = calcAP(severity, occ, det);

                            if (oldAP) beforeDist[oldAP] = (beforeDist[oldAP] || 0) + 1;
                            if (newAP) afterDist[newAP] = (afterDist[newAP] || 0) + 1;

                            if (newAP === 'H') docApH++;
                            if (newAP === 'M') docApM++;

                            if (oldAP !== newAP) {
                                cause.ap = newAP;
                                docChanged = true;
                                changed++;
                                changes.push({
                                    amfe: doc.amfe_number,
                                    op: op.opNumber + ' ' + op.name,
                                    cause: (cause.cause || '').substring(0, 50),
                                    S: severity, O: occ, D: det,
                                    oldAP, newAP,
                                });
                            } else {
                                unchanged++;
                            }
                        }
                    }
                }
            }
        }

        if (docChanged) {
            const jsonStr = JSON.stringify(data);
            const checksum = sha256(jsonStr);

            await execSql(
                `UPDATE amfe_documents SET data = '${jsonStr.replace(/'/g, "''")}', ` +
                `checksum = '${checksum}', ` +
                `ap_h_count = ${docApH}, ` +
                `ap_m_count = ${docApM}, ` +
                `updated_at = NOW() ` +
                `WHERE id = '${doc.id}'`
            );
            console.log(`  Updated: ${doc.amfe_number} (${doc.project_name}) — H=${docApH}, M=${docApM}`);
        } else {
            console.log(`  No changes: ${doc.amfe_number}`);
        }
    }

    console.log('\n  ══════════════════════════════════════');
    console.log(`  Total causes processed: ${totalCauses}`);
    console.log(`  Changed: ${changed}`);
    console.log(`  Unchanged: ${unchanged}`);
    console.log(`  \n  Before: H=${beforeDist.H || 0}, M=${beforeDist.M || 0}, L=${beforeDist.L || 0}`);
    console.log(`  After:  H=${afterDist.H || 0}, M=${afterDist.M || 0}, L=${afterDist.L || 0}`);

    // Show top changes
    if (changes.length > 0) {
        console.log(`\n  Sample changes (first 20):`);
        changes.slice(0, 20).forEach(c => {
            console.log(`    ${c.amfe} | OP ${c.op.substring(0, 30)} | S=${c.S},O=${c.O},D=${c.D} | ${c.oldAP} → ${c.newAP}`);
        });
    }

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

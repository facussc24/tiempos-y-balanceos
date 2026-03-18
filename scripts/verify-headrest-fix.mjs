#!/usr/bin/env node
/**
 * Verify that all headrest AMFE documents have zero AP=H causes without actions.
 * Re-reads from Supabase to confirm persistence.
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';

function countApHWithoutActions(doc) {
    let count = 0;
    let totalApH = 0;
    let totalWithActions = 0;
    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const fn of we.functions) {
                for (const fail of fn.failures) {
                    for (const cause of fail.causes) {
                        const ap = (cause.ap || '').toUpperCase();
                        if (ap === 'H') {
                            totalApH++;
                            const hasAction = (cause.preventionAction && cause.preventionAction.trim() !== '') ||
                                              (cause.detectionAction && cause.detectionAction.trim() !== '');
                            if (hasAction) {
                                totalWithActions++;
                            } else {
                                count++;
                            }
                        }
                    }
                }
            }
        }
    }
    return { noActions: count, totalApH, withActions: totalWithActions };
}

async function main() {
    console.log('='.repeat(70));
    console.log('VERIFICATION: Re-reading headrest documents from Supabase');
    console.log('='.repeat(70));

    await initSupabase();

    const rows = await selectSql(
        `SELECT id, project_name, data FROM amfe_documents
         WHERE project_name LIKE '%HEADREST%'
         ORDER BY project_name`
    );

    console.log(`\nFound ${rows.length} headrest documents\n`);
    console.log(`${'Document'.padEnd(50)} | AP=H | Actions | Gaps`);
    console.log('-'.repeat(80));

    let allClean = true;
    for (const r of rows) {
        const doc = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        const { noActions, totalApH, withActions } = countApHWithoutActions(doc);
        const status = noActions === 0 ? 'OK' : 'FAIL';
        console.log(`${r.project_name.padEnd(50)} | ${String(totalApH).padStart(4)} | ${String(withActions).padStart(7)} | ${String(noActions).padStart(4)} ${status}`);
        if (noActions > 0) allClean = false;
    }

    console.log('-'.repeat(80));
    if (allClean) {
        console.log('\nRESULT: ALL 12 headrest documents have ZERO AP=H causes without actions.');
    } else {
        console.log('\nRESULT: SOME documents still have gaps!');
    }

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});

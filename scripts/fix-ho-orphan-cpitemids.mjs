#!/usr/bin/env node
/**
 * Fix orphan cpItemIds in HO quality checks.
 *
 * After CP item consolidation, some HO qualityChecks may reference
 * CP item IDs that no longer exist. This script finds orphans and
 * tries to re-link them to the best matching CP item.
 *
 * Usage:
 *   node scripts/fix-ho-orphan-cpitemids.mjs              # dry-run
 *   node scripts/fix-ho-orphan-cpitemids.mjs --apply       # write changes
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const DRY_RUN = !process.argv.includes('--apply');

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

/**
 * Fuzzy match score between a QC and a CP item.
 * Higher = better match.
 */
function matchScore(qc, cpItem) {
    let score = 0;
    const qcChar = (qc.characteristic || '').toLowerCase();
    const cpProd = (cpItem.productCharacteristic || '').toLowerCase();
    const cpProc = (cpItem.processCharacteristic || '').toLowerCase();

    // Exact characteristic match
    if (qcChar && (qcChar === cpProd || qcChar === cpProc)) score += 10;
    // Partial match (one contains the other)
    if (qcChar && cpProd && (qcChar.includes(cpProd) || cpProd.includes(qcChar))) score += 5;
    if (qcChar && cpProc && (qcChar.includes(cpProc) || cpProc.includes(qcChar))) score += 5;
    // Word overlap
    const qcWords = new Set(qcChar.split(/\s+/).filter(w => w.length > 3));
    const cpWords = new Set([...cpProd.split(/\s+/), ...cpProc.split(/\s+/)].filter(w => w.length > 3));
    for (const w of qcWords) {
        if (cpWords.has(w)) score += 2;
    }

    return score;
}

async function main() {
    await initSupabase();
    console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}\n`);

    // Build CP item map: id -> item, and project_name -> items
    const cpDocs = await selectSql('SELECT id, project_name, data FROM cp_documents');
    const cpItemMap = new Map();
    const cpItemsByProject = new Map();
    for (const cp of cpDocs) {
        const data = JSON.parse(cp.data);
        const items = data.items || [];
        cpItemsByProject.set(cp.project_name, items);
        for (const item of items) {
            cpItemMap.set(item.id, { item, project: cp.project_name });
        }
    }
    console.log(`Loaded ${cpItemMap.size} CP items from ${cpDocs.length} documents.\n`);

    // Check HO qualityChecks for orphans
    const hoDocs = await selectSql('SELECT id, linked_cp_project, data FROM ho_documents');
    let totalOrphans = 0;
    let totalFixed = 0;
    let totalUnlinked = 0;

    for (const ho of hoDocs) {
        const data = JSON.parse(ho.data);
        let docChanges = 0;

        for (const sheet of (data.sheets || [])) {
            const opNum = sheet.operationNumber || sheet.linkedCpOperationNumber || '';

            for (const qc of (sheet.qualityChecks || [])) {
                if (!qc.cpItemId) continue;
                if (cpItemMap.has(qc.cpItemId)) continue;

                totalOrphans++;
                const qcDesc = (qc.characteristic || '').substring(0, 60);

                // Try to find best match in the linked CP
                const cpProject = ho.linked_cp_project;
                const cpItems = cpItemsByProject.get(cpProject) || [];

                // Filter CP items by same operation
                const sameOpItems = cpItems.filter(ci => {
                    const ciOp = parseInt(ci.processStepNumber) || 0;
                    const qcOp = parseInt(opNum) || 0;
                    return ciOp === qcOp;
                });

                let bestMatch = null;
                let bestScore = 0;
                for (const ci of sameOpItems) {
                    const score = matchScore(qc, ci);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = ci;
                    }
                }

                if (bestMatch && bestScore >= 3) {
                    const matchDesc = (bestMatch.productCharacteristic || bestMatch.processCharacteristic || '').substring(0, 60);
                    console.log(`  FIXED: ${cpProject} | ${sheet.hoNumber} | "${qcDesc}" → matched "${matchDesc}" (score=${bestScore})`);
                    qc.cpItemId = bestMatch.id;
                    docChanges++;
                    totalFixed++;
                } else {
                    console.log(`  UNLINKED: ${cpProject} | ${sheet.hoNumber} | "${qcDesc}" (no good match, score=${bestScore})`);
                    qc.cpItemId = '';
                    docChanges++;
                    totalUnlinked++;
                }
            }
        }

        if (docChanges > 0 && !DRY_RUN) {
            const jsonString = JSON.stringify(data);
            const checksum = sha256(jsonString);
            await execSql(
                `UPDATE ho_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                [jsonString, checksum, ho.id]
            );
        }
    }

    console.log(`\nOrphans found: ${totalOrphans} | Re-linked: ${totalFixed} | Unlinked: ${totalUnlinked}`);
    if (DRY_RUN) console.log('(dry-run — no changes written)');

    close();
    console.log('Done.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

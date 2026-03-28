#!/usr/bin/env node
/**
 * Fix B: Link 13 qualityChecks that have no cpItemId (Insert=10, Termoformadas=3).
 *
 * These were created manually before the auto-generator. We match them to CP items
 * by operation number + characteristic text similarity.
 *
 * Run: node scripts/fix-ho-qc-link-cpid.mjs
 */
import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';

function normalize(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function similarity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1.0;
    if (na.includes(nb) || nb.includes(na)) return 0.8;
    // Word overlap
    const wordsA = new Set(na.split(/\s+/));
    const wordsB = new Set(nb.split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union > 0 ? intersection / union : 0;
}

await initSupabase();

const hos = await selectSql("SELECT id, part_description, data FROM ho_documents");
const cps = await selectSql("SELECT id, project_name, data FROM cp_documents");

let totalLinked = 0;
let totalUnmatched = 0;

for (const ho of hos) {
    const hoData = typeof ho.data === 'string' ? JSON.parse(ho.data) : ho.data;

    // Count unlinked first
    let unlinked = 0;
    for (const sheet of (hoData.sheets || [])) {
        for (const qc of (sheet.qualityChecks || [])) {
            if (!qc.cpItemId) unlinked++;
        }
    }
    if (unlinked === 0) continue;

    // Find matching CP by part_description → project_name mapping
    // Insert → INSERT, Termoformadas → TERMOFORMADAS
    const matchKey = ho.part_description.toUpperCase();
    const cp = cps.find(c => {
        const cpKey = c.project_name.toUpperCase();
        return matchKey.includes('INSERT') && cpKey.includes('INSERT') ||
               matchKey.includes('TERMOFORMADAS') && cpKey.includes('TERMOFORMADAS');
    });

    if (!cp) {
        console.log(`  ⚠️ ${ho.part_description}: no matching CP found, skipping`);
        continue;
    }

    const cpData = typeof cp.data === 'string' ? JSON.parse(cp.data) : cp.data;
    const cpItems = cpData.items || [];

    console.log(`\n--- ${ho.part_description} (${unlinked} unlinked) ---`);

    let linked = 0;
    for (const sheet of (hoData.sheets || [])) {
        for (const qc of (sheet.qualityChecks || [])) {
            if (qc.cpItemId) continue;

            // Find best CP item match: same operation + similar characteristic
            const opNum = sheet.operationNumber;
            const candidates = cpItems.filter(item => item.processStepNumber === opNum);

            let bestMatch = null;
            let bestScore = 0;

            for (const item of candidates) {
                const cpChar = item.productCharacteristic || item.processCharacteristic || '';
                const score = similarity(qc.characteristic, cpChar);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = item;
                }
            }

            if (bestMatch && bestScore >= 0.3) {
                const cpChar = bestMatch.productCharacteristic || bestMatch.processCharacteristic || '';
                console.log(`  OP${opNum}: "${qc.characteristic}" → CP "${cpChar}" (score=${bestScore.toFixed(2)}) ✅`);
                qc.cpItemId = bestMatch.id;
                linked++;
            } else {
                console.log(`  OP${opNum}: "${qc.characteristic}" → NO MATCH (best=${bestScore.toFixed(2)}) ⚠️`);
                totalUnmatched++;
            }
        }
    }

    if (linked > 0) {
        const jsonStr = JSON.stringify(hoData).replace(/'/g, "''");
        await execSql(`UPDATE ho_documents SET data = '${jsonStr}' WHERE id = '${ho.id}'`);
        console.log(`  ✅ ${ho.part_description}: ${linked} linked`);
        totalLinked += linked;
    }
}

console.log(`\nDone. Linked: ${totalLinked}, Unmatched: ${totalUnmatched}`);
close();

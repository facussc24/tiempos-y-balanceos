#!/usr/bin/env node
/**
 * Audit: Identify groupable cutting-table sheets across all HO products.
 *
 * READ-ONLY — does NOT modify any data.
 *
 * Run:  node scripts/audit-ho-cutting-groups.mjs
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeParse(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
}

/** Keywords that identify a cutting-related operation (case-insensitive). */
const CUTTING_KEYWORDS = [
    'CORTE',
    'MESA DE CORTE',
    'MYLAR',
    'PREPARACION',
    'ALMACENAMIENTO WIP',
];

function isCuttingRelated(operationName) {
    if (!operationName) return false;
    const upper = operationName.toUpperCase();
    return CUTTING_KEYWORDS.some(kw => upper.includes(kw));
}

function truncate(str, len = 60) {
    if (!str) return '(vacio)';
    return str.length > len ? str.slice(0, len) + '...' : str;
}

/**
 * Build a fingerprint string from step descriptions (sorted, lowercased, trimmed)
 * to compare across sheets.
 */
function stepsFingerprint(steps) {
    return steps
        .map(s => (s.description || '').trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join(' | ');
}

function ppeKey(safetyElements) {
    if (!Array.isArray(safetyElements) || safetyElements.length === 0) return '(sin PPE)';
    return [...safetyElements].sort().join(', ');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  AUDIT: HO Cutting-Table Sheet Grouping Analysis');
    console.log('  READ-ONLY — no data will be modified');
    console.log('══════════════════════════════════════════════════════════\n');

    // 1. Load HO document IDs first (data column is huge due to base64 images)
    const idRows = await selectSql('SELECT id, linked_amfe_project FROM ho_documents');
    console.log(`Found ${idRows.length} HO documents. Loading data one-by-one...\n`);

    // 2. Extract cutting-related sheets (fetch data per document to avoid RPC timeout)
    const allCuttingSheets = []; // { product, sheet }

    for (const idRow of idRows) {
        const product = idRow.linked_amfe_project || '(sin proyecto)';
        const dataRows = await selectSql(
            `SELECT data FROM ho_documents WHERE id = '${idRow.id}'`
        );
        if (dataRows.length === 0) continue;
        const doc = safeParse(dataRows[0].data);
        if (!doc || !Array.isArray(doc.sheets)) continue;

        for (const sheet of doc.sheets) {
            if (isCuttingRelated(sheet.operationName)) {
                allCuttingSheets.push({ product, sheet });
            }
        }
    }

    console.log(`Found ${allCuttingSheets.length} cutting-related sheets across all products.\n`);

    if (allCuttingSheets.length === 0) {
        console.log('No cutting-related sheets found. Nothing to analyse.');
        close();
        return;
    }

    // ─── 3. Detail per sheet ────────────────────────────────────────────────

    console.log('────────────────────────────────────────────────────────────');
    console.log('  DETAIL: All cutting-related sheets');
    console.log('────────────────────────────────────────────────────────────\n');

    // Group by product first
    const byProduct = new Map();
    for (const { product, sheet } of allCuttingSheets) {
        if (!byProduct.has(product)) byProduct.set(product, []);
        byProduct.get(product).push(sheet);
    }

    for (const [product, sheets] of byProduct) {
        console.log(`\n▸ Product: ${product}  (${sheets.length} cutting sheet(s))`);
        console.log('  ┌──────────────────────────────────────────────────────────');

        for (const s of sheets) {
            const stepDescs = (s.steps || []).map(st => (st.description || '').trim()).filter(Boolean);
            const qcCount = (s.qualityChecks || []).length;
            const ppe = ppeKey(s.safetyElements);
            const firstStep = stepDescs.length > 0 ? truncate(stepDescs[0]) : '(sin pasos)';

            console.log(`  │ Op ${s.operationNumber || '?'}: ${s.operationName || '?'}`);
            console.log(`  │   Steps: ${stepDescs.length}  |  QCs: ${qcCount}  |  PPE: ${ppe}`);
            console.log(`  │   1st step: "${firstStep}"`);
        }

        console.log('  └──────────────────────────────────────────────────────────');
    }

    // ─── 4. Intra-product comparison ────────────────────────────────────────

    console.log('\n\n────────────────────────────────────────────────────────────');
    console.log('  INTRA-PRODUCT: Sheets with identical steps within same product');
    console.log('────────────────────────────────────────────────────────────\n');

    let foundIntraMatches = false;

    for (const [product, sheets] of byProduct) {
        if (sheets.length < 2) continue;

        // Compare all pairs
        for (let i = 0; i < sheets.length; i++) {
            for (let j = i + 1; j < sheets.length; j++) {
                const fpA = stepsFingerprint(sheets[i].steps || []);
                const fpB = stepsFingerprint(sheets[j].steps || []);

                if (fpA && fpB && fpA === fpB) {
                    foundIntraMatches = true;
                    console.log(`  ✓ MATCH in "${product}":`);
                    console.log(`    Op ${sheets[i].operationNumber} (${sheets[i].operationName})`);
                    console.log(`    Op ${sheets[j].operationNumber} (${sheets[j].operationName})`);
                    console.log(`    → Identical ${(sheets[i].steps || []).length} step descriptions\n`);
                }
            }
        }
    }

    if (!foundIntraMatches) {
        console.log('  No intra-product identical-step matches found.\n');
    }

    // ─── 5. Cross-product comparison ────────────────────────────────────────

    console.log('────────────────────────────────────────────────────────────');
    console.log('  CROSS-PRODUCT: Sheets with same steps + PPE across products');
    console.log('────────────────────────────────────────────────────────────\n');

    // Build index: fingerprint → list of { product, sheet }
    const fpIndex = new Map();

    for (const { product, sheet } of allCuttingSheets) {
        const fp = stepsFingerprint(sheet.steps || []);
        if (!fp) continue; // skip sheets with no steps
        const ppe = ppeKey(sheet.safetyElements);
        const compositeKey = `${fp}|||${ppe}`;

        if (!fpIndex.has(compositeKey)) fpIndex.set(compositeKey, []);
        fpIndex.get(compositeKey).push({ product, sheet });
    }

    let foundCrossMatches = false;

    for (const [key, entries] of fpIndex) {
        // Only interesting if multiple entries from different products
        const uniqueProducts = new Set(entries.map(e => e.product));
        if (uniqueProducts.size < 2) continue;

        foundCrossMatches = true;
        const [fpPart, ppePart] = key.split('|||');
        const stepCount = fpPart.split(' | ').length;

        console.log(`  ✓ GROUP (${entries.length} sheets, ${uniqueProducts.size} products, ${stepCount} steps, PPE: ${ppePart}):`);
        for (const { product, sheet } of entries) {
            console.log(`    - ${product} → Op ${sheet.operationNumber} (${sheet.operationName})`);
        }
        console.log();
    }

    if (!foundCrossMatches) {
        console.log('  No cross-product identical (steps+PPE) matches found.\n');
    }

    // ─── 6. PPE-only grouping (same PPE, same operation name) ───────────────

    console.log('────────────────────────────────────────────────────────────');
    console.log('  PPE + OPERATION NAME: Sheets with same PPE and operation name');
    console.log('────────────────────────────────────────────────────────────\n');

    const ppeOpIndex = new Map();

    for (const { product, sheet } of allCuttingSheets) {
        const ppe = ppeKey(sheet.safetyElements);
        const opName = (sheet.operationName || '').toUpperCase().trim();
        const key = `${opName}|||${ppe}`;

        if (!ppeOpIndex.has(key)) ppeOpIndex.set(key, []);
        ppeOpIndex.get(key).push({ product, sheet });
    }

    let foundPpeOpMatches = false;

    for (const [key, entries] of ppeOpIndex) {
        if (entries.length < 2) continue;

        foundPpeOpMatches = true;
        const [opName, ppe] = key.split('|||');

        console.log(`  ✓ "${opName}" + PPE: ${ppe}  (${entries.length} sheets):`);
        for (const { product, sheet } of entries) {
            const stepCount = (sheet.steps || []).length;
            console.log(`    - ${product} → Op ${sheet.operationNumber} (${stepCount} steps)`);
        }
        console.log();
    }

    if (!foundPpeOpMatches) {
        console.log('  No PPE + operation name matches found.\n');
    }

    // ─── 7. Proposed groupings summary ──────────────────────────────────────

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  PROPOSED GROUPINGS (suggestions only — no changes made)');
    console.log('══════════════════════════════════════════════════════════\n');

    let proposalCount = 0;

    // Proposal type A: identical steps across products
    for (const [key, entries] of fpIndex) {
        const uniqueProducts = new Set(entries.map(e => e.product));
        if (uniqueProducts.size < 2) continue;

        proposalCount++;
        const stepCount = key.split('|||')[0].split(' | ').length;
        console.log(`  Proposal #${proposalCount}: These ${entries.length} sheets could be grouped into 1`);
        console.log(`    Reason: Identical ${stepCount} step descriptions + same PPE`);
        for (const { product, sheet } of entries) {
            console.log(`      - ${product} / Op ${sheet.operationNumber} (${sheet.operationName})`);
        }
        console.log();
    }

    // Proposal type B: same operation name + PPE, different steps (potential partial merge)
    for (const [key, entries] of ppeOpIndex) {
        if (entries.length < 2) continue;

        // Skip if already covered by type A (identical steps)
        const allFps = entries.map(e => stepsFingerprint(e.sheet.steps || []));
        const uniqueFps = new Set(allFps.filter(Boolean));
        if (uniqueFps.size <= 1 && allFps.some(Boolean)) continue; // already proposed above

        proposalCount++;
        const [opName, ppe] = key.split('|||');
        console.log(`  Proposal #${proposalCount}: These ${entries.length} sheets share operation "${opName}" + PPE (${ppe})`);
        console.log(`    Reason: Same operation name and PPE — review if steps can be unified`);
        for (const { product, sheet } of entries) {
            const stepCount = (sheet.steps || []).length;
            const firstStep = (sheet.steps || []).length > 0
                ? truncate((sheet.steps[0].description || '').trim())
                : '(sin pasos)';
            console.log(`      - ${product} / Op ${sheet.operationNumber} (${stepCount} steps, 1st: "${firstStep}")`);
        }
        console.log();
    }

    if (proposalCount === 0) {
        console.log('  No grouping proposals generated — all cutting sheets appear unique.\n');
    } else {
        console.log(`  Total proposals: ${proposalCount}\n`);
    }

    // ─── 8. Summary stats ───────────────────────────────────────────────────

    console.log('────────────────────────────────────────────────────────────');
    console.log('  SUMMARY');
    console.log('────────────────────────────────────────────────────────────');
    console.log(`  Total HO documents:           ${idRows.length}`);
    console.log(`  Total cutting-related sheets:  ${allCuttingSheets.length}`);
    console.log(`  Products with cutting sheets:  ${byProduct.size}`);
    console.log(`  Grouping proposals:            ${proposalCount}`);
    console.log('────────────────────────────────────────────────────────────\n');

    close();
}

main().catch(err => {
    console.error('Fatal error:', err);
    close();
    process.exit(1);
});

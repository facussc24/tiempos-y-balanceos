#!/usr/bin/env node
/**
 * Consolidate duplicate CP items in Supabase.
 *
 * Rule: 1 row per characteristic per operation (AIAG-VDA CP 2024).
 * When multiple items share the same characteristic in the same operation,
 * keep the most complete item and merge evaluationTechnique, controlMethod,
 * sampleSize, amfeCauseIds, etc. from the others.
 *
 * Usage:
 *   node scripts/consolidate-cp-duplicates.mjs              # dry-run
 *   node scripts/consolidate-cp-duplicates.mjs --apply       # write changes
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = !process.argv.includes('--apply');

// Fields to combine with " / " when merging duplicates
const COMBINE_FIELDS = [
    'evaluationTechnique',
    'controlMethod',
    'sampleSize',
    'sampleFrequency',
];

// Array fields to union
const ARRAY_FIELDS = ['amfeCauseIds', 'amfeFailureIds'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

/** Build dedup key: opNumber + characteristic text (product or process). */
function buildKey(item) {
    const characteristic = (item.productCharacteristic || item.processCharacteristic || '').trim().toLowerCase();
    const op = (item.processStepNumber || '').trim();
    // Also distinguish product vs process rows to avoid merging them
    const type = item.productCharacteristic ? 'product' : 'process';
    return `${op}||${type}||${characteristic}`;
}

/** Count non-empty string fields in an item. */
function completeness(item) {
    let score = 0;
    const fields = [
        'processDescription', 'machineDeviceTool', 'characteristicNumber',
        'productCharacteristic', 'processCharacteristic', 'specialCharClass',
        'specification', 'evaluationTechnique', 'sampleSize', 'sampleFrequency',
        'controlMethod', 'reactionPlan', 'reactionPlanOwner', 'controlProcedure',
    ];
    for (const f of fields) {
        if (item[f] && String(item[f]).trim()) score++;
    }
    return score;
}

/** Pick highest AP: H > M > L > ''. */
function pickHighestAp(items) {
    if (items.some(i => i.amfeAp === 'H')) return 'H';
    if (items.some(i => i.amfeAp === 'M')) return 'M';
    if (items.some(i => i.amfeAp === 'L')) return 'L';
    return '';
}

/** Pick most restrictive specialCharClass: CC > SC > other > ''. */
function pickMostRestrictive(items) {
    if (items.some(i => (i.specialCharClass || '').toUpperCase() === 'CC')) return 'CC';
    if (items.some(i => (i.specialCharClass || '').toUpperCase() === 'SC')) return 'SC';
    for (const item of items) {
        if (item.specialCharClass) return item.specialCharClass;
    }
    return '';
}

/** Combine string values from all items, deduplicating. */
function combineField(items, field) {
    const values = items
        .map(i => (i[field] || '').trim())
        .filter(Boolean);
    const unique = [...new Set(values)];
    return unique.join(' / ');
}

/** Union all arrays from items. */
function unionArrayField(items, field) {
    const all = items.flatMap(i => i[field] || []);
    return [...new Set(all)];
}

/** Pick max numeric value. */
function pickMax(items, field) {
    const values = items.map(i => Number(i[field])).filter(Number.isFinite);
    return values.length > 0 ? Math.max(...values) : undefined;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();

    console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN (no changes)' : 'APPLY (writing changes)'}\n`);

    const cpDocs = await selectSql('SELECT id, project_name, data FROM cp_documents');
    console.log(`Found ${cpDocs.length} CP documents.\n`);

    const report = [];
    let totalBefore = 0;
    let totalAfter = 0;
    let totalConsolidated = 0;

    for (const row of cpDocs) {
        const data = JSON.parse(row.data);
        const items = data.items || [];
        const itemsBefore = items.length;
        totalBefore += itemsBefore;

        // Group by key
        const groups = new Map();
        for (const item of items) {
            const key = buildKey(item);
            if (!key || key === '||||') continue; // skip items with no characteristic
            const group = groups.get(key) || [];
            group.push(item);
            groups.set(key, group);
        }

        // Find duplicate groups
        const dupGroups = [...groups.entries()].filter(([, g]) => g.length > 1);

        if (dupGroups.length === 0) {
            report.push({
                product: row.project_name,
                before: itemsBefore,
                after: itemsBefore,
                consolidated: 0,
                details: [],
            });
            totalAfter += itemsBefore;
            continue;
        }

        // Items that are NOT part of any duplicate group (keep as-is)
        const dupItemIds = new Set();
        for (const [, group] of dupGroups) {
            for (const item of group) {
                dupItemIds.add(item.id);
            }
        }
        const survivingItems = items.filter(i => !dupItemIds.has(i.id));

        const details = [];

        for (const [key, group] of dupGroups) {
            // Check if all items are 100% identical (exact duplicates)
            const isExactDuplicate = group.length > 1 && group.every(item => {
                const a = JSON.stringify({ ...item, id: '' });
                const b = JSON.stringify({ ...group[0], id: '' });
                return a === b;
            });

            if (isExactDuplicate) {
                // Keep just the first one
                survivingItems.push(group[0]);
                details.push({
                    key,
                    count: group.length,
                    type: 'EXACT_DUP',
                    removed: group.length - 1,
                });
                continue;
            }

            // Pick the most complete item as the survivor
            const sorted = [...group].sort((a, b) => completeness(b) - completeness(a));
            const survivor = { ...sorted[0] };

            // Combine fields from all items
            for (const field of COMBINE_FIELDS) {
                const combined = combineField(group, field);
                if (combined) survivor[field] = combined;
            }

            // Union array fields
            for (const field of ARRAY_FIELDS) {
                const unioned = unionArrayField(group, field);
                if (unioned.length > 0) survivor[field] = unioned;
            }

            // Pick best metadata
            survivor.amfeAp = pickHighestAp(group);
            survivor.specialCharClass = pickMostRestrictive(group);
            const maxSev = pickMax(group, 'amfeSeverity');
            if (maxSev !== undefined) survivor.amfeSeverity = maxSev;

            // Keep amfeFailureId from the survivor (already the most complete)
            // But also union amfeFailureIds
            const allFailureIds = [...new Set(group.map(i => i.amfeFailureId).filter(Boolean))];
            if (allFailureIds.length > 0) {
                survivor.amfeFailureIds = allFailureIds;
            }

            survivingItems.push(survivor);
            details.push({
                key,
                count: group.length,
                type: 'CONSOLIDATED',
                removed: group.length - 1,
                combinedFields: COMBINE_FIELDS.filter(f => {
                    const values = [...new Set(group.map(i => (i[f] || '').trim()).filter(Boolean))];
                    return values.length > 1;
                }),
            });
        }

        // Sort surviving items by operation number (numeric)
        survivingItems.sort((a, b) => {
            const numA = parseInt(a.processStepNumber) || 0;
            const numB = parseInt(b.processStepNumber) || 0;
            if (numA !== numB) return numA - numB;
            // Within same op: process rows first
            const typeA = a.processCharacteristic ? 0 : 1;
            const typeB = b.processCharacteristic ? 0 : 1;
            return typeA - typeB;
        });

        const itemsAfter = survivingItems.length;
        const consolidated = itemsBefore - itemsAfter;
        totalAfter += itemsAfter;
        totalConsolidated += consolidated;

        report.push({
            product: row.project_name,
            before: itemsBefore,
            after: itemsAfter,
            consolidated,
            details,
        });

        // Write back
        if (!DRY_RUN) {
            data.items = survivingItems;
            const jsonString = JSON.stringify(data);
            const checksum = sha256(jsonString);
            await execSql(
                `UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                [jsonString, checksum, row.id]
            );
            console.log(`  [CP] Updated: ${row.project_name} (${itemsBefore} -> ${itemsAfter})`);
        }
    }

    // Print report
    console.log('\n========== CONSOLIDATION REPORT ==========\n');
    console.log('| Producto | Items antes | Items despues | Consolidados |');
    console.log('|----------|-------------|---------------|-------------|');
    for (const r of report) {
        console.log(`| ${r.product.padEnd(40)} | ${String(r.before).padStart(11)} | ${String(r.after).padStart(13)} | ${String(r.consolidated).padStart(12)} |`);
    }
    console.log(`| ${'TOTAL'.padEnd(40)} | ${String(totalBefore).padStart(11)} | ${String(totalAfter).padStart(13)} | ${String(totalConsolidated).padStart(12)} |`);

    // Print details
    console.log('\n========== DETAILS ==========\n');
    for (const r of report) {
        if (r.details.length === 0) continue;
        console.log(`\n--- ${r.product} ---`);
        for (const d of r.details) {
            const parts = d.key.split('||');
            const op = parts[0];
            const type = parts[1];
            const char = parts[2]?.slice(0, 60) || '(empty)';
            console.log(`  OP ${op} [${type}] "${char}" x${d.count} -> ${d.type} (removed ${d.removed})${d.combinedFields?.length ? ' combined: ' + d.combinedFields.join(', ') : ''}`);
        }
    }

    // Verification: check no duplicates remain
    if (!DRY_RUN) {
        console.log('\n========== VERIFICATION ==========\n');
        const cpDocsAfter = await selectSql('SELECT id, project_name, data FROM cp_documents');
        let allClean = true;
        for (const row of cpDocsAfter) {
            const data = JSON.parse(row.data);
            const groups = new Map();
            for (const item of (data.items || [])) {
                const key = buildKey(item);
                const group = groups.get(key) || [];
                group.push(item);
                groups.set(key, group);
            }
            const remaining = [...groups.entries()].filter(([, g]) => g.length > 1);
            if (remaining.length > 0) {
                console.log(`  WARNING: ${row.project_name} still has ${remaining.length} duplicate groups!`);
                allClean = false;
            }
        }
        if (allClean) {
            console.log('  All CPs clean - 0 duplicate groups remaining.');
        }
    }

    close();
    console.log('\nDone.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

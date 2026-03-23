#!/usr/bin/env node
/**
 * fix-ing-proceso.mjs
 *
 * Replace "Ingeniería de Proceso" with "Ingeniería" in ALL AMFEs.
 * Also handles the unaccented variant "Ingenieria de Proceso".
 *
 * The company uses "Ingeniería" as the department name (e.g.,
 * "Carlos Baptista (Ingeniería)"). "Ingeniería de Proceso" is not
 * a real role in the organization.
 *
 * Deep traverses the ENTIRE data structure:
 *   - header fields (team, responsible, processResponsible)
 *   - operations → workElements → functions → failures → causes
 *     (cause.responsible, preventionAction, detectionAction, actionTaken)
 *
 * Usage: node scripts/fix-ing-proceso.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Constants ──────────────────────────────────────────────────────────────

const REPLACEMENTS = [
    { old: 'Ingeniería de Proceso', new: 'Ingeniería' },
    { old: 'Ingenieria de Proceso', new: 'Ingeniería' },  // unaccented variant
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(doc) {
    return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deep-traverse an object/array, replacing all target strings.
 * Returns { data, replacementCount, changes }.
 */
function deepReplace(obj, path = '') {
    let replacementCount = 0;
    const changes = [];

    if (typeof obj === 'string') {
        let current = obj;
        let totalCount = 0;

        for (const r of REPLACEMENTS) {
            if (current.includes(r.old)) {
                const regex = new RegExp(escapeRegex(r.old), 'g');
                const count = (current.match(regex) || []).length;
                current = current.replaceAll(r.old, r.new);
                totalCount += count;
            }
        }

        if (totalCount > 0) {
            changes.push({ path, original: obj, replaced: current, count: totalCount });
            return { data: current, replacementCount: totalCount, changes };
        }
        return { data: obj, replacementCount: 0, changes: [] };
    }

    if (Array.isArray(obj)) {
        const newArr = [];
        for (let i = 0; i < obj.length; i++) {
            const { data, replacementCount: rc, changes: cc } = deepReplace(obj[i], `${path}[${i}]`);
            newArr.push(data);
            replacementCount += rc;
            changes.push(...cc);
        }
        return { data: newArr, replacementCount, changes };
    }

    if (obj !== null && typeof obj === 'object') {
        const newObj = {};
        for (const key of Object.keys(obj)) {
            const { data, replacementCount: rc, changes: cc } = deepReplace(obj[key], path ? `${path}.${key}` : key);
            newObj[key] = data;
            replacementCount += rc;
            changes.push(...cc);
        }
        return { data: newObj, replacementCount, changes };
    }

    // Non-string primitive (number, boolean, null)
    return { data: obj, replacementCount: 0, changes: [] };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================');
    console.log('  FIX "Ingeniería de Proceso" → "Ingeniería"');
    console.log('========================================');
    console.log('  Also handles unaccented "Ingenieria de Proceso"\n');

    const amfeDocs = await selectSql('SELECT id, project_name, data FROM amfe_documents');
    console.log(`  Loaded ${amfeDocs.length} AMFE documents\n`);

    let totalReplacements = 0;
    let docsModified = 0;

    for (const doc of amfeDocs) {
        const data = parseData(doc);
        const { data: newData, replacementCount, changes } = deepReplace(data);

        if (replacementCount === 0) continue;

        docsModified++;
        totalReplacements += replacementCount;

        console.log(`  [AMFE] ${doc.project_name} (${doc.id}):`);
        for (const c of changes) {
            console.log(`    ${c.path}: "${c.original}" → "${c.replaced}" (x${c.count})`);
        }

        // Recalculate checksum and save
        const jsonStr = JSON.stringify(newData);
        const checksum = createHash('sha256').update(jsonStr).digest('hex');
        const escapedJson = jsonStr.replace(/'/g, "''");

        await execSql(
            `UPDATE amfe_documents SET data = '${escapedJson}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`
        );

        console.log(`    → Saved (checksum: ${checksum.slice(0, 16)}..., ${replacementCount} replacements)\n`);
    }

    // ─── Summary ────────────────────────────────────────────────────────────
    console.log('\n========================================');
    console.log('  SUMMARY');
    console.log('========================================');
    console.log(`  Documents scanned: ${amfeDocs.length}`);
    console.log(`  Documents modified: ${docsModified}`);
    console.log(`  Total replacements: ${totalReplacements}`);

    close();
    console.log('\nDone.');
}

main().catch((err) => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});

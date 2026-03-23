#!/usr/bin/env node
/**
 * fix-amfe-roles.mjs
 *
 * Fix incorrect role names in ALL AMFEs in Supabase.
 * "Ingeniería de Calidad" → "Calidad" (the combined role doesn't exist in the company)
 *
 * Searches ALL text fields including header.team, header.responsible,
 * header.processResponsible, cause.responsible, action.responsible, etc.
 *
 * Usage: node scripts/fix-amfe-roles.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Constants ──────────────────────────────────────────────────────────────

const OLD_ROLE = 'Ingeniería de Calidad';
const NEW_ROLE = 'Calidad';

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(doc) {
    return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

/**
 * Deep-traverse an object/array, replacing OLD_ROLE with NEW_ROLE in all string values.
 * Returns { data, replacementCount, changes }.
 */
function deepReplace(obj, path = '') {
    let replacementCount = 0;
    const changes = [];

    if (typeof obj === 'string') {
        if (obj.includes(OLD_ROLE)) {
            const newVal = obj.replaceAll(OLD_ROLE, NEW_ROLE);
            // Count how many times it appeared
            const count = (obj.match(new RegExp(escapeRegex(OLD_ROLE), 'g')) || []).length;
            replacementCount += count;
            changes.push({ path, original: obj, replaced: newVal, count });
            return { data: newVal, replacementCount, changes };
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

    // Non-string primitive
    return { data: obj, replacementCount: 0, changes: [] };
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================');
    console.log('  FIX AMFE ROLES');
    console.log(`  "${OLD_ROLE}" → "${NEW_ROLE}"`);
    console.log('========================================');

    const amfeDocs = await selectSql('SELECT id, project_name, data FROM amfe_documents');
    console.log(`\n  Loaded ${amfeDocs.length} AMFE documents\n`);

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

        // Save back
        const checksum = createHash('sha256').update(JSON.stringify(newData)).digest('hex');
        const jsonStr = JSON.stringify(newData).replace(/'/g, "''");
        await execSql(
            `UPDATE amfe_documents SET data = '${jsonStr}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`
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

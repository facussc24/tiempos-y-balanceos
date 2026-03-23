#!/usr/bin/env node
/**
 * fix-english-parentheses.mjs
 *
 * Remove English text in parentheses from ALL AMFEs and CPs in Supabase.
 * Replaces English terms with their Spanish equivalents or removes them entirely.
 *
 * Usage: node scripts/fix-english-parentheses.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Replacement map: English term in parentheses → replacement ─────────────
// Value = null means remove the parenthesized term entirely
// Value = string means replace the parenthesized term with that string (in parens)

const REPLACEMENTS = [
    // Exact matches (case-insensitive) — remove or replace
    { pattern: /\(Scrap\)/gi, replacement: '(Descarte)' },
    { pattern: /\(Set-up\)/gi, replacement: '(Puesta a punto)' },
    { pattern: /\(Setup\)/gi, replacement: '(Puesta a punto)' },
    { pattern: /\(Set up\)/gi, replacement: '(Puesta a punto)' },
    { pattern: /\(Checklist\)/gi, replacement: '(Lista de verificación)' },
    { pattern: /\(CoC\)/g, replacement: '(Certificado de calidad)' },  // case-sensitive: CoC
    { pattern: /\(FAI\)/g, replacement: '(Aprobación de primera pieza)' },  // case-sensitive
    { pattern: /\(SOS\)/g, replacement: '(Hoja de operación estándar)' },  // case-sensitive
    { pattern: /\(First Piece Approval\)/gi, replacement: '(Aprobación de primera pieza)' },
    { pattern: /\(Sponge layer\)/gi, replacement: '(Capa de espuma)' },
    { pattern: /\(Cold Weld\)/gi, replacement: '(Soldadura fría)' },
    { pattern: /\(Read-through\)/gi, replacement: '(Transparencia)' },
    { pattern: /\(Angel hair\)/gi, replacement: '(Hilos sueltos)' },
    { pattern: /\(Wrong Label\)/gi, replacement: '(Etiqueta incorrecta)' },
    { pattern: /\(Loose assembly\)/gi, replacement: '(Ensamble flojo)' },

    // Special case: "Set Up" inside a larger Spanish context
    // e.g., (Verificacion del Set Up) → (Verificacion del Puesta a punto)
    // We handle "Set Up" / "Set-up" / "Setup" inside any parenthesized text
    { pattern: /\bSet[- ]?[Uu]p\b/g, replacement: 'Puesta a punto', insideParens: false },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(doc) {
    return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

/**
 * Apply all replacements to a single string value.
 * Returns { text, changes } where changes is an array of { original, replaced }.
 */
function applyReplacements(text) {
    if (typeof text !== 'string') return { text, changes: [] };

    const changes = [];
    let result = text;

    for (const rule of REPLACEMENTS) {
        if (rule.insideParens === false) {
            // This is a "loose" replacement that applies anywhere in the string
            // but only for "Set Up" variants not already handled by the parenthesized rules
            // Skip if we already replaced a (Set-up) / (Setup) etc above
            continue; // We handle Set Up inside parens via the specific patterns above
        }

        const before = result;
        result = result.replace(rule.pattern, rule.replacement);
        if (result !== before) {
            changes.push({ original: before, replaced: result });
        }
    }

    // Now handle "Set Up" / "Set-up" / "Setup" that appears INSIDE other parenthesized text
    // e.g., (Verificacion del Set Up) — we only replace the "Set Up" part
    const beforeSetup = result;
    result = result.replace(/\(([^)]*)\bSet[- ]?[Uu]p\b([^)]*)\)/g, (match, pre, post) => {
        return `(${pre}Puesta a punto${post})`;
    });
    if (result !== beforeSetup) {
        changes.push({ original: beforeSetup, replaced: result });
    }

    return { text: result, changes };
}

/**
 * Deep-traverse an object/array, applying replacements to all string values.
 * Returns { data, allChanges } where allChanges is [{ path, original, replaced }].
 */
function deepTraverse(obj, path = '') {
    const allChanges = [];

    if (typeof obj === 'string') {
        const { text, changes } = applyReplacements(obj);
        for (const c of changes) {
            allChanges.push({ path, original: c.original, replaced: c.replaced });
        }
        return { data: text, allChanges };
    }

    if (Array.isArray(obj)) {
        const newArr = [];
        for (let i = 0; i < obj.length; i++) {
            const { data, allChanges: childChanges } = deepTraverse(obj[i], `${path}[${i}]`);
            newArr.push(data);
            allChanges.push(...childChanges);
        }
        return { data: newArr, allChanges };
    }

    if (obj !== null && typeof obj === 'object') {
        const newObj = {};
        for (const key of Object.keys(obj)) {
            const { data, allChanges: childChanges } = deepTraverse(obj[key], path ? `${path}.${key}` : key);
            newObj[key] = data;
            allChanges.push(...childChanges);
        }
        return { data: newObj, allChanges };
    }

    // Non-string primitive (number, boolean, null)
    return { data: obj, allChanges };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    let totalReplacements = 0;
    let docsModified = 0;

    // ─── Process AMFE documents ─────────────────────────────────────────────
    console.log('\n========================================');
    console.log('  AMFE DOCUMENTS');
    console.log('========================================');

    const amfeDocs = await selectSql('SELECT id, project_name, data FROM amfe_documents');
    console.log(`  Loaded ${amfeDocs.length} AMFE documents\n`);

    for (const doc of amfeDocs) {
        const data = parseData(doc);
        const { data: newData, allChanges } = deepTraverse(data);

        if (allChanges.length === 0) continue;

        docsModified++;
        totalReplacements += allChanges.length;

        console.log(`  [AMFE] ${doc.project_name} (${doc.id}):`);
        for (const c of allChanges) {
            // Show a trimmed version of the change
            const origSnippet = c.original.length > 120 ? c.original.slice(0, 120) + '...' : c.original;
            const replSnippet = c.replaced.length > 120 ? c.replaced.slice(0, 120) + '...' : c.replaced;
            console.log(`    ${c.path}`);
            console.log(`      - "${origSnippet}"`);
            console.log(`      + "${replSnippet}"`);
        }

        // Save back
        const checksum = createHash('sha256').update(JSON.stringify(newData)).digest('hex');
        const jsonStr = JSON.stringify(newData).replace(/'/g, "''");
        await execSql(
            `UPDATE amfe_documents SET data = '${jsonStr}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`
        );
        console.log(`    → Saved (checksum: ${checksum.slice(0, 16)}...)\n`);
    }

    // ─── Process CP documents ───────────────────────────────────────────────
    console.log('\n========================================');
    console.log('  CP DOCUMENTS');
    console.log('========================================');

    const cpDocs = await selectSql('SELECT id, project_name, data FROM cp_documents');
    console.log(`  Loaded ${cpDocs.length} CP documents\n`);

    for (const doc of cpDocs) {
        const data = parseData(doc);
        const { data: newData, allChanges } = deepTraverse(data);

        if (allChanges.length === 0) continue;

        docsModified++;
        totalReplacements += allChanges.length;

        console.log(`  [CP] ${doc.project_name} (${doc.id}):`);
        for (const c of allChanges) {
            const origSnippet = c.original.length > 120 ? c.original.slice(0, 120) + '...' : c.original;
            const replSnippet = c.replaced.length > 120 ? c.replaced.slice(0, 120) + '...' : c.replaced;
            console.log(`    ${c.path}`);
            console.log(`      - "${origSnippet}"`);
            console.log(`      + "${replSnippet}"`);
        }

        // Save back
        const checksum = createHash('sha256').update(JSON.stringify(newData)).digest('hex');
        const jsonStr = JSON.stringify(newData).replace(/'/g, "''");
        const itemCount = (newData.items || []).length;
        await execSql(
            `UPDATE cp_documents SET data = '${jsonStr}', checksum = '${checksum}', item_count = ${itemCount}, updated_at = NOW() WHERE id = '${doc.id}'`
        );
        console.log(`    → Saved (checksum: ${checksum.slice(0, 16)}...)\n`);
    }

    // ─── Summary ────────────────────────────────────────────────────────────
    console.log('\n========================================');
    console.log('  SUMMARY');
    console.log('========================================');
    console.log(`  Documents modified: ${docsModified}`);
    console.log(`  Total text replacements: ${totalReplacements}`);

    close();
    console.log('\nDone.');
}

main().catch((err) => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});

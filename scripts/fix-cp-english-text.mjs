#!/usr/bin/env node
/**
 * fix-cp-english-text.mjs
 *
 * Removes/translates English text in parentheses from ALL CPs in Supabase.
 * Replaces each "(English term)" with the Spanish equivalent inline.
 *
 * Usage: node scripts/fix-cp-english-text.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Translation map: English in parens → Spanish replacement ─────────────────
// The key is the text INSIDE the parentheses (case-insensitive match).
// The value is what replaces the ENTIRE "(English)" token.

const TRANSLATION_MAP = [
    { pattern: /\(Hot Knife\)/gi, replacement: '(Cuchilla caliente)' },
    { pattern: /\(Checking Fixture\)/gi, replacement: '(Dispositivo de control)' },
    { pattern: /\(checking fixture\)/gi, replacement: '(Dispositivo de control)' },
    { pattern: /\(Angel hair\)/gi, replacement: '(Hilachas)' },
    { pattern: /\(Cold Weld\)/gi, replacement: '(Soldadura fría)' },
    { pattern: /\(Boundary Samples\)/gi, replacement: '(Muestras límite)' },
    { pattern: /\(Interlock\)/gi, replacement: '(Enclavamiento)' },
    { pattern: /\(Dunnage\)/gi, replacement: '(Embalaje de transporte)' },
    { pattern: /\(Relief\)/gi, replacement: '(Rebaje)' },
    { pattern: /\(EDGE FOLDING\)/gi, replacement: '(PLEGADO DE BORDE)' },
    { pattern: /\(Scuffing\)/gi, replacement: '(Rozadura)' },
    { pattern: /\(Mixed Parts\)/gi, replacement: '(Piezas mezcladas)' },
    { pattern: /\(Shortage\)/gi, replacement: '(Faltante)' },
    { pattern: /\(Wrong Label\)/gi, replacement: '(Etiqueta incorrecta)' },
    { pattern: /\(Loose assembly\)/gi, replacement: '(Ensamble flojo)' },
    { pattern: /\(Sponge layer\)/gi, replacement: '(Capa de espuma)' },
    { pattern: /\(Setup\)/gi, replacement: '(Puesta a punto)' },
    { pattern: /\(Set-up\)/gi, replacement: '(Puesta a punto)' },
    { pattern: /\(Set up\)/gi, replacement: '(Puesta a punto)' },
    { pattern: /\(First Piece Approval\)/gi, replacement: '(Aprobación primera pieza)' },
    { pattern: /\(Checklist\)/gi, replacement: '(Lista de verificación)' },
    { pattern: /\(CoC\)/g, replacement: '(Certificado de calidad)' },
    { pattern: /\(FAI\)/g, replacement: '(Aprobación primera pieza)' },
    { pattern: /\(SOS\)/g, replacement: '(Hoja de operación estándar)' },
    { pattern: /\(Scrap\)/gi, replacement: '(Descarte)' },
    { pattern: /\(Read-through\)/gi, replacement: '(Transparencia)' },
];

// ─── Deep string traversal ───────────────────────────────────────────────────

function translateString(str) {
    let result = str;
    const replacements = [];
    for (const { pattern, replacement } of TRANSLATION_MAP) {
        // Reset regex lastIndex
        pattern.lastIndex = 0;
        if (pattern.test(result)) {
            pattern.lastIndex = 0;
            const before = result;
            result = result.replace(pattern, replacement);
            if (before !== result) {
                // Find what was matched
                pattern.lastIndex = 0;
                const match = before.match(pattern);
                if (match) {
                    replacements.push({ original: match[0], translated: replacement });
                }
            }
        }
    }
    return { result, replacements };
}

function deepTraverse(obj, path, changes) {
    if (typeof obj === 'string') {
        const { result, replacements } = translateString(obj);
        if (replacements.length > 0) {
            for (const r of replacements) {
                changes.push({ field: path, original: r.original, translated: r.translated });
            }
        }
        return result;
    }
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = deepTraverse(obj[i], `${path}[${i}]`, changes);
        }
        return obj;
    }
    if (obj !== null && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            obj[key] = deepTraverse(obj[key], `${path}.${key}`, changes);
        }
        return obj;
    }
    return obj;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================================================');
    console.log('  FIX: Translate English text in parentheses — All CPs');
    console.log('========================================================================\n');

    const cpRows = await selectSql(
        `SELECT id, project_name, data FROM cp_documents ORDER BY project_name`
    );
    console.log(`Loaded ${cpRows.length} CP documents.\n`);

    let totalReplacements = 0;
    let docsUpdated = 0;

    for (const row of cpRows) {
        const cpData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const cpName = row.project_name || row.id;
        const changes = [];

        // Deep traverse header
        if (cpData.header) {
            deepTraverse(cpData.header, 'header', changes);
        }

        // Deep traverse items
        if (cpData.items) {
            deepTraverse(cpData.items, 'items', changes);
        }

        if (changes.length > 0) {
            docsUpdated++;
            totalReplacements += changes.length;

            // Recalculate checksum
            const dataStr = JSON.stringify(cpData);
            const checksum = createHash('sha256').update(dataStr).digest('hex');
            const jsonEscaped = dataStr.replace(/'/g, "''");

            await execSql(
                `UPDATE cp_documents SET data = '${jsonEscaped}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${row.id}'`
            );

            console.log(`  ${cpName} — ${changes.length} replacements (checksum: ${checksum.slice(0, 12)}...)`);
            for (const c of changes) {
                console.log(`    ${c.field}: ${c.original} -> ${c.translated}`);
            }
            console.log();
        }
    }

    console.log('========================================================================');
    console.log('  SUMMARY');
    console.log('========================================================================\n');
    console.log(`  Total replacements:    ${totalReplacements}`);
    console.log(`  CP documents updated:  ${docsUpdated} / ${cpRows.length}`);
    console.log();

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});

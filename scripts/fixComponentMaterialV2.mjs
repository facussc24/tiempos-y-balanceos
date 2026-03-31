/**
 * Fix Script — Clean componentMaterial invalid values and duplicates
 *
 * Operations:
 *   1. Remove non-material text from componentMaterial (failure mode text, etc.)
 *   2. Remove duplicated material names (e.g. "PVC/Vinilo" repeated twice)
 *   3. Validate all componentMaterial values are real material names
 *
 * USO: node scripts/fixComponentMaterialV2.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ─── Config ────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Auth
const { error: authErr } = await supabase.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('✓ Authenticated');
if (DRY_RUN) console.log('⚠️  DRY RUN MODE — no changes will be saved\n');

// ─── Valid materials (prefixes matched case-insensitively) ──────────────
const VALID_MATERIAL_PREFIXES = [
    'pvc', 'vinilo', 'espuma', 'pur', 'foam',
    'hilo', 'polyester', 'caimán', 'caiman', 'costura',
    'pc/abs', 'cycoloy', 'pc-abs',
    'varilla', 'acero', 'steel',
    'adhesivo', 'sikamelt', 'sika',
    'cinta', 'tessa', 'tesa',
    'tpo', 'bilaminate',
    'aplix', 'velcro',
    'tela', 'tejido', 'textil', 'jacquard',
    'armazon', 'armazón', 'epp',
    'punzonado', 'bi-componente',
    'refuerzo',
];

function isValidMaterial(text) {
    if (!text || !text.trim()) return true; // empty is valid (non-reception items)
    const lower = text.trim().toLowerCase();
    return VALID_MATERIAL_PREFIXES.some(prefix => lower.startsWith(prefix) || lower.includes(prefix));
}

// ─── Detect non-material text ──────────────────────────────────────────
const NON_MATERIAL_PATTERNS = [
    /omisi[oó]n/i,
    /verificaci[oó]n/i,
    /inspecci[oó]n/i,
    /falla\s/i,
    /modo\s*de\s*falla/i,
    /recepci[oó]n/i,
    /ausencia/i,
    /incorrecto/i,
    /defecto/i,
    /contaminaci[oó]n/i,
    /error\s/i,
    /deformaci[oó]n/i,
    /da[ñn]o/i,
    /fuera\s*de/i,
    /no\s*conforme/i,
    /incumplimiento/i,
    /falta\s*de/i,
    /p[eé]rdida/i,
    /inadecuad/i,
    /insuficiente/i,
    /rotura/i,
];

function isNonMaterialText(text) {
    if (!text || !text.trim()) return false;
    return NON_MATERIAL_PATTERNS.some(pat => pat.test(text));
}

// ─── Load all CP documents ────────────────────────────────────────────
console.log('=== Loading CP documents ===');

const { data: cpDocs, error: cpErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, part_number, part_name, data');
if (cpErr) { console.error('CP load error:', cpErr.message); process.exit(1); }

console.log(`Loaded: ${cpDocs.length} CPs`);

for (const doc of cpDocs) {
    if (typeof doc.data === 'string') doc.data = JSON.parse(doc.data);
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 1: Remove non-material text
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Phase 1: Remove non-material text ===');

const stats = { nonMaterialCleaned: 0, duplicatesCleaned: 0, invalidFound: 0, byProduct: {} };

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const items = cpDoc.data?.items || [];
    let cleaned = 0;

    for (const item of items) {
        const mat = item.componentMaterial || '';
        if (!mat.trim()) continue;

        if (isNonMaterialText(mat)) {
            console.log(`  ${productName} OP ${item.processStepNumber}: CLEANED non-material: "${mat.slice(0, 80)}"`);
            item.componentMaterial = '';
            cleaned++;
            stats.nonMaterialCleaned++;
        }
    }

    if (cleaned > 0) {
        if (!stats.byProduct[productName]) stats.byProduct[productName] = { nonMaterial: 0, duplicates: 0, invalid: 0 };
        stats.byProduct[productName].nonMaterial = cleaned;
    }
}

console.log(`  Phase 1 total: ${stats.nonMaterialCleaned} non-material texts cleaned`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE 2: Remove duplicated material names
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Phase 2: Remove duplicated material names ===');

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const items = cpDoc.data?.items || [];
    let cleaned = 0;

    for (const item of items) {
        const mat = item.componentMaterial || '';
        if (!mat.trim()) continue;

        // Check for duplicates: split by common separators and check for repeated values
        const parts = mat.split(/[\n\r,;\/]+/).map(p => p.trim()).filter(Boolean);
        const uniqueParts = [...new Set(parts)];

        if (parts.length > uniqueParts.length) {
            // But wait — some materials legitimately contain "/" like "PVC/Vinilo"
            // Only consider it a duplicate if the SAME full material name appears twice
            // Split more carefully: by newlines and commas, not by /
            const carefulParts = mat.split(/[\n\r,;]+/).map(p => p.trim()).filter(Boolean);
            const carefulUnique = [...new Set(carefulParts)];

            if (carefulParts.length > carefulUnique.length) {
                const newMat = carefulUnique.join(', ');
                console.log(`  ${productName} OP ${item.processStepNumber}: DEDUP: "${mat}" → "${newMat}"`);
                item.componentMaterial = carefulUnique.length === 1 ? carefulUnique[0] : newMat;
                cleaned++;
                stats.duplicatesCleaned++;
            }
        }
    }

    if (cleaned > 0) {
        if (!stats.byProduct[productName]) stats.byProduct[productName] = { nonMaterial: 0, duplicates: 0, invalid: 0 };
        stats.byProduct[productName].duplicates = cleaned;
    }
}

console.log(`  Phase 2 total: ${stats.duplicatesCleaned} duplicates cleaned`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE 3: Validate remaining values
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Phase 3: Validate remaining componentMaterial values ===');

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const items = cpDoc.data?.items || [];

    for (const item of items) {
        const mat = item.componentMaterial || '';
        if (!mat.trim()) continue;

        if (!isValidMaterial(mat)) {
            console.log(`  ⚠ INVALID: ${productName} OP ${item.processStepNumber}: "${mat.slice(0, 80)}"`);
            stats.invalidFound++;
            if (!stats.byProduct[productName]) stats.byProduct[productName] = { nonMaterial: 0, duplicates: 0, invalid: 0 };
            stats.byProduct[productName].invalid = (stats.byProduct[productName].invalid || 0) + 1;

            // Clean invalid material — set to empty
            item.componentMaterial = '';
        }
    }
}

console.log(`  Phase 3 total: ${stats.invalidFound} invalid values found and cleaned`);

// ═══════════════════════════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Saving ===');

if (DRY_RUN) {
    console.log('  ⚠️  DRY RUN — no changes saved');
} else {
    let savedCount = 0;
    let errorCount = 0;

    for (const doc of cpDocs) {
        const { error } = await supabase
            .from('cp_documents')
            .update({ data: doc.data })
            .eq('id', doc.id);
        if (error) { console.error(`  ✗ Error saving CP ${doc.project_name}: ${error.message}`); errorCount++; }
        else savedCount++;
    }

    console.log(`  ✓ ${savedCount} documents saved${errorCount > 0 ? `, ${errorCount} errors` : ''}`);
}

// ═══════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Summary ===');
console.log(`  Non-material text cleaned: ${stats.nonMaterialCleaned}`);
console.log(`  Duplicates cleaned: ${stats.duplicatesCleaned}`);
console.log(`  Invalid values cleaned: ${stats.invalidFound}`);

for (const [prod, s] of Object.entries(stats.byProduct)) {
    console.log(`  ${prod}: ${s.nonMaterial} non-material, ${s.duplicates} duplicates, ${s.invalid} invalid`);
}

console.log(`\n${DRY_RUN ? '⚠️  DRY RUN completado' : '✓ Fix completado exitosamente'}`);
process.exit(0);

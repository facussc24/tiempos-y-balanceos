/**
 * Fix Script — Standardize sampleSize (TAM) in ALL CP items
 *
 * Rules (from official PdC reference):
 *   - Reception:                "1 muestra"
 *   - Set up de máquina:        "1 Control."
 *   - Autocontrol 100%:         "100%"
 *   - Inicio/fin turno:         "1 Pieza."
 *   - Dimensional metrología (headrest): "5 piezas por lote de inyección de sustrato plastico"
 *   - Dimensional metrología (otros):    "5 piezas"
 *   - Test lay out flamabilidad: "1 muestra"
 *   - Test lay out dimensional:  "30 muestras"
 *   - Embalaje:                  "1 Medio."
 *
 * USO: node scripts/fixSampleSize.mjs [--dry-run]
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

// ─── Helper ────────────────────────────────────────────────────────────
function isReception(processStepNumber) {
    const n = parseInt(String(processStepNumber).replace(/^OP\s*/i, '').trim(), 10);
    return Number.isFinite(n) && n <= 10;
}

function isHeadrest(projectName) {
    return /headrest/i.test(projectName || '');
}

function getProcessDesc(item) {
    return `${item.processDescription || ''} ${item.processStepName || ''}`.toLowerCase();
}

function getEvalTechnique(item) {
    return (item.evaluationTechnique || '').toLowerCase();
}

function getFrequency(item) {
    return (item.sampleFrequency || '').toLowerCase();
}

function getControlMethod(item) {
    return (item.controlMethod || '').toLowerCase();
}

function getCharacteristics(item) {
    return `${item.productCharacteristic || ''} ${item.processCharacteristic || ''}`.toLowerCase();
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
// FIX: Standardize sampleSize
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Standardizing sampleSize ===');

const stats = { fixed: 0, unchanged: 0, byProduct: {}, byRule: {} };

function incRule(ruleName) {
    stats.byRule[ruleName] = (stats.byRule[ruleName] || 0) + 1;
}

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const items = cpDoc.data?.items || [];
    const headrest = isHeadrest(productName);
    let fixed = 0;
    let unchanged = 0;

    for (const item of items) {
        const oldSize = item.sampleSize || '';
        let newSize = null; // null = no change
        let ruleName = '';

        const processDesc = getProcessDesc(item);
        const evalTechnique = getEvalTechnique(item);
        const frequency = getFrequency(item);
        const controlMethod = getControlMethod(item);
        const chars = getCharacteristics(item);

        // Rule 1: Reception
        if (isReception(item.processStepNumber)) {
            newSize = '1 muestra';
            ruleName = 'reception';
        }
        // Rule 2: Set up de máquina
        else if (/set[\s-]?up|puesta\s*(a\s*)?punto|arranque\s*(de\s*)?m[aá]quina/i.test(frequency) ||
                 /set[\s-]?up|puesta\s*(a\s*)?punto/i.test(processDesc) ||
                 /set[\s-]?up|puesta\s*(a\s*)?punto/i.test(controlMethod)) {
            newSize = '1 Control.';
            ruleName = 'setup';
        }
        // Rule 3: 100% autocontrol — keep as-is
        else if (oldSize === '100%' || frequency === '100%' || frequency.includes('100%')) {
            newSize = '100%';
            ruleName = 'autocontrol-100';
        }
        // Rule 7: Test lay out flamabilidad
        else if (/lay\s*out/i.test(processDesc) && /flamab/i.test(processDesc + ' ' + chars)) {
            newSize = '1 muestra';
            ruleName = 'layout-flamabilidad';
        }
        // Rule 8: Test lay out dimensional
        else if (/lay\s*out/i.test(processDesc) && /dimensional/i.test(processDesc + ' ' + chars)) {
            newSize = '30 muestras';
            ruleName = 'layout-dimensional';
        }
        // Rule 5: Control dimensional metrología
        else if (/metrolog/i.test(evalTechnique) ||
                 (/dimensional/i.test(chars) && /calibre|galga|flex[oó]metro/i.test(evalTechnique)) ||
                 (/metrolog/i.test(item.reactionPlanOwner || ''))) {
            newSize = headrest ? '5 piezas por lote de inyección de sustrato plastico' : '5 piezas';
            ruleName = headrest ? 'metrologia-headrest' : 'metrologia-other';
        }
        // Rule 4: Inicio/fin turno
        else if (/inicio.*fin|fin.*turno|turno/i.test(frequency)) {
            newSize = '1 Pieza.';
            ruleName = 'inicio-fin-turno';
        }
        // Rule 9: Embalaje
        else if (/embalaje|empaque|packag/i.test(processDesc)) {
            newSize = '1 Medio.';
            ruleName = 'embalaje';
        }
        // No match → don't change
        else {
            newSize = null;
        }

        if (newSize !== null && newSize !== oldSize) {
            item.sampleSize = newSize;
            fixed++;
            stats.fixed++;
            incRule(ruleName);
            console.log(`  ${productName} OP ${item.processStepNumber}: "${oldSize}" → "${newSize}" [${ruleName}]`);
        } else {
            unchanged++;
            stats.unchanged++;
            if (newSize !== null) incRule(ruleName + '-already-ok');
        }
    }

    stats.byProduct[productName] = { fixed, unchanged, total: items.length };
}

console.log(`\nTotal: ${stats.fixed} fixed, ${stats.unchanged} unchanged`);

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
// VERIFICATION
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Verification ===');

let bareNumbers = 0;
for (const cpDoc of cpDocs) {
    for (const item of (cpDoc.data?.items || [])) {
        if (item.sampleSize && /^\d+$/.test(item.sampleSize.trim())) {
            bareNumbers++;
            console.log(`  ⚠ BARE NUMBER: ${cpDoc.project_name} OP ${item.processStepNumber}: "${item.sampleSize}"`);
        }
    }
}
console.log(`  Items with bare-number sampleSize: ${bareNumbers} (should be 0)`);

// Summary
console.log('\n=== Summary by product ===');
for (const [prod, s] of Object.entries(stats.byProduct)) {
    console.log(`  ${prod}: ${s.fixed} fixed, ${s.unchanged} unchanged (${s.total} total)`);
}

console.log('\n=== Summary by rule ===');
for (const [rule, count] of Object.entries(stats.byRule)) {
    console.log(`  ${rule}: ${count}`);
}

console.log(`\n${DRY_RUN ? '⚠️  DRY RUN completado' : '✓ Fix completado exitosamente'}`);
process.exit(0);

/**
 * Fix Script — Standardize reactionPlan in ALL CP items
 *
 * Rules (from official PdC reference):
 *   - Reception (OP <= 10): "P-14."
 *   - Everything else: "Según P-09/I."
 *
 * USO: node scripts/fixReactionPlan.mjs [--dry-run]
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

// ─── Load all CP documents ────────────────────────────────────────────
console.log('=== Loading CP documents ===');

const { data: cpDocs, error: cpErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, part_number, part_name, data');
if (cpErr) { console.error('CP load error:', cpErr.message); process.exit(1); }

console.log(`Loaded: ${cpDocs.length} CPs`);

// Parse JSON data
for (const doc of cpDocs) {
    if (typeof doc.data === 'string') doc.data = JSON.parse(doc.data);
}

// ═══════════════════════════════════════════════════════════════════════
// FIX: Standardize reactionPlan
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Standardizing reactionPlan ===');

const stats = { reception: 0, process: 0, alreadyCorrect: 0, byProduct: {} };

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const items = cpDoc.data?.items || [];
    let receptionFixed = 0;
    let processFixed = 0;
    let alreadyCorrect = 0;

    for (const item of items) {
        const correctValue = isReception(item.processStepNumber) ? 'P-14.' : 'Según P-09/I.';

        if (item.reactionPlan === correctValue) {
            alreadyCorrect++;
            stats.alreadyCorrect++;
            continue;
        }

        const oldValue = item.reactionPlan || '(empty)';
        item.reactionPlan = correctValue;

        if (isReception(item.processStepNumber)) {
            receptionFixed++;
            stats.reception++;
        } else {
            processFixed++;
            stats.process++;
        }

        console.log(`  ${productName} OP ${item.processStepNumber}: "${oldValue.slice(0, 60)}" → "${correctValue}"`);
    }

    stats.byProduct[productName] = { receptionFixed, processFixed, alreadyCorrect, total: items.length };
}

console.log(`\nTotal: ${stats.reception} reception fixed, ${stats.process} process fixed, ${stats.alreadyCorrect} already correct`);

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

let longReactionPlans = 0;
for (const cpDoc of cpDocs) {
    for (const item of (cpDoc.data?.items || [])) {
        if (item.reactionPlan && item.reactionPlan.length > 20) {
            longReactionPlans++;
            console.log(`  ⚠ LONG: ${cpDoc.project_name} OP ${item.processStepNumber}: "${item.reactionPlan}"`);
        }
    }
}
console.log(`  Items with reactionPlan > 20 chars: ${longReactionPlans} (should be 0)`);

// Summary
console.log('\n=== Summary by product ===');
for (const [prod, s] of Object.entries(stats.byProduct)) {
    console.log(`  ${prod}: ${s.receptionFixed} recep + ${s.processFixed} proc fixed, ${s.alreadyCorrect} ok (${s.total} total)`);
}

console.log(`\n${DRY_RUN ? '⚠️  DRY RUN completado' : '✓ Fix completado exitosamente'}`);
process.exit(0);

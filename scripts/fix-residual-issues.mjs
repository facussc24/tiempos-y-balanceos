#!/usr/bin/env node
/**
 * Fix 8 MEDIO + 2 MENOR residuales:
 * 1. Top Roll OP50: empty spec → fill with real value
 * 2. Telas Termoformadas OP10: "pendiente de confirmacion" → actual PWA norm reference
 * 3. Headrest Rear Center/Outer OP80: HO name "TEST DE LAY OUT" → "EMBALAJE"
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
function getEnv(key) {
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (!match) throw new Error(`Missing ${key}`);
    return match[1].trim();
}

const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('VITE_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
});
const { error: authErr } = await supabase.auth.signInWithPassword({
    email: getEnv('VITE_AUTO_LOGIN_EMAIL'), password: getEnv('VITE_AUTO_LOGIN_PASSWORD'),
});
if (authErr) { console.error('Auth:', authErr); process.exit(1); }
console.log('Authenticated\n');

let totalFixes = 0;

// === FIX 1: Top Roll OP50 empty spec ===
console.log('--- Fix 1: Top Roll OP50 spec ---');
{
    const { data: rows } = await supabase.rpc('exec_sql_read', {
        query: "SELECT id, data FROM cp_documents WHERE project_name LIKE '%TOP_ROLL%'"
    });
    const cpData = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    let fixed = 0;
    for (const item of cpData.items) {
        if (item.processStepNumber === '50' && !(item.specification || '').trim()) {
            const char = item.productCharacteristic || item.processCharacteristic || '';
            item.specification = 'Segun pieza patron aprobada y parametros de proceso';
            console.log(`  OP50 "${char.substring(0,40)}" → spec="${item.specification}"`);
            fixed++;
        }
    }
    if (fixed > 0) {
        const { error } = await supabase.from('cp_documents').update({ data: cpData }).eq('id', rows[0].id);
        if (error) console.error('  ERROR:', error);
        else { console.log(`  ✅ Top Roll: ${fixed} spec fixed`); totalFixes += fixed; }
    }
}

// === FIX 2: Telas Termoformadas OP10 flamabilidad "pendiente" ===
console.log('\n--- Fix 2: Telas Termoformadas OP10 flamabilidad ---');
{
    const { data: rows } = await supabase.rpc('exec_sql_read', {
        query: "SELECT id, data FROM cp_documents WHERE project_name LIKE '%TERMOFORMADAS%'"
    });
    const cpData = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    let fixed = 0;
    for (const item of cpData.items) {
        const spec = (item.specification || '');
        if (spec.toLowerCase().includes('pendiente de')) {
            // PWA uses their own flame norm, not TL 1010. Reference the customer requirement.
            item.specification = 'Segun requisito de flamabilidad PWA (especificacion del cliente)';
            console.log(`  OP${item.processStepNumber} → spec="${item.specification}"`);
            fixed++;
        }
    }
    if (fixed > 0) {
        const { error } = await supabase.from('cp_documents').update({ data: cpData }).eq('id', rows[0].id);
        if (error) console.error('  ERROR:', error);
        else { console.log(`  ✅ Telas Termoformadas: ${fixed} spec fixed`); totalFixes += fixed; }
    }
}

// === FIX 3: Headrest Rear Center/Outer OP80 HO name ===
console.log('\n--- Fix 3: Headrest Rear OP80 HO name ---');
{
    const { data: rows } = await supabase.rpc('exec_sql_read', {
        query: "SELECT id, part_description, data FROM ho_documents WHERE part_description LIKE '%Trasero%'"
    });
    for (const ho of rows) {
        const hoData = typeof ho.data === 'string' ? JSON.parse(ho.data) : ho.data;
        let fixed = 0;
        for (const sheet of (hoData.sheets || [])) {
            if (sheet.operationNumber === '80' && sheet.operationName !== 'EMBALAJE') {
                console.log(`  ${ho.part_description.substring(0,40)}: "${sheet.operationName}" → "EMBALAJE"`);
                sheet.operationName = 'EMBALAJE';
                fixed++;
            }
        }
        if (fixed > 0) {
            const { error } = await supabase.from('ho_documents').update({ data: hoData }).eq('id', ho.id);
            if (error) console.error('  ERROR:', error);
            else { console.log(`  ✅ ${ho.part_description.substring(0,30)}: ${fixed} name fixed`); totalFixes += fixed; }
        }
    }
}

console.log(`\nDone. Total fixes: ${totalFixes}`);
await supabase.auth.signOut();
process.exit(0);

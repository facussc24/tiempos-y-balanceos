#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
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
    email: getEnv('VITE_AUTO_LOGIN_EMAIL'),
    password: getEnv('VITE_AUTO_LOGIN_PASSWORD'),
});
if (authErr) { console.error('Auth error:', authErr); process.exit(1); }
console.log('Authenticated');

const NON_HO_ROLES = ['laboratorio', 'metrología', 'metrologia', 'inspector de calidad'];
function isOperario(item) {
    const rpo = (item.reactionPlanOwner || '').toLowerCase().trim();
    const resp = (item.responsible || '').toLowerCase().trim();
    const owner = rpo || resp;
    if (!owner) return false;
    if (NON_HO_ROLES.some(r => owner.includes(r))) return false;
    return true;
}

// Use RPC to read (same as supabaseHelper)
const { data: cpRows, error: cpErr } = await supabase.rpc('exec_sql_read', {
    query: "SELECT id, project_name, data FROM cp_documents WHERE project_name LIKE '%INSERT%'"
});
if (cpErr) { console.error('CP read error:', cpErr); process.exit(1); }

const { data: hoRows, error: hoErr } = await supabase.rpc('exec_sql_read', {
    query: "SELECT id, part_description, data FROM ho_documents WHERE part_description LIKE '%INSERT%'"
});
if (hoErr) { console.error('HO read error:', hoErr); process.exit(1); }

const cpData = typeof cpRows[0].data === 'string' ? JSON.parse(cpRows[0].data) : cpRows[0].data;
const hoData = typeof hoRows[0].data === 'string' ? JSON.parse(hoRows[0].data) : hoRows[0].data;
const hoId = hoRows[0].id;

console.log(`HO id: ${hoId}`);

const linkedCpIds = new Set();
for (const sheet of (hoData.sheets || [])) {
    for (const qc of (sheet.qualityChecks || [])) {
        if (qc.cpItemId) linkedCpIds.add(qc.cpItemId);
    }
}

const missingItems = (cpData.items || []).filter(item =>
    isOperario(item) && !linkedCpIds.has(item.id)
);

console.log(`CP items: ${(cpData.items || []).length}, HO linked: ${linkedCpIds.size}, Missing: ${missingItems.length}`);

if (missingItems.length === 0) {
    console.log('Nothing to do!');
    process.exit(0);
}

const sheetByOp = {};
for (const sheet of (hoData.sheets || [])) {
    sheetByOp[sheet.operationNumber] = sheet;
}

let created = 0, noSheet = 0;
for (const item of missingItems) {
    const opNum = item.processStepNumber;
    const sheet = sheetByOp[opNum];
    if (!sheet) { noSheet++; console.log(`  OP${opNum}: no sheet`); continue; }

    const qc = {
        id: randomUUID(),
        cpItemId: item.id,
        characteristic: item.productCharacteristic || item.processCharacteristic || '',
        specification: item.productSpecification || item.processSpecification || '',
        evaluationTechnique: item.evaluationTechnique || '',
        frequency: item.sampleFrequency || item.sampleSize || '',
        controlMethod: item.controlMethod || '',
        reactionAction: item.reactionPlan || '',
        reactionContact: item.reactionPlanOwner || item.responsible || '',
        specialCharSymbol: item.specialCharClass || '',
        registro: '',
    };

    if (!sheet.qualityChecks) sheet.qualityChecks = [];
    sheet.qualityChecks.push(qc);
    created++;
    console.log(`  OP${opNum}: "${qc.characteristic.substring(0, 45)}" rpo="${item.reactionPlanOwner}"`);
}

if (created > 0) {
    // Use REST API update (not RPC) for large payloads
    const { error } = await supabase
        .from('ho_documents')
        .update({ data: hoData })
        .eq('id', hoId);
    
    if (error) {
        console.error('Update error:', error);
        process.exit(1);
    }
    console.log(`\nInsert HO: ${created} qualityChecks created, ${noSheet} skipped`);
}

console.log(`Done. Created: ${created}`);
await supabase.auth.signOut();
process.exit(0);

/**
 * Inspecciona un proyecto especifico: muestra tasks, stations, sectors, y donde vive el OEE.
 * Read-only.
 * Uso: node scripts/_inspectProjectStations.mjs <projectId>
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const projectId = process.argv[2];
if (!projectId) { console.error('Uso: node scripts/_inspectProjectStations.mjs <projectId>'); process.exit(1); }

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: p, error } = await sb.from('projects').select('*').eq('id', projectId).single();
if (error) { console.error('Error:', error.message); process.exit(1); }

let pdata = p.data;
if (typeof pdata === 'string') pdata = JSON.parse(pdata);

console.log(`\n=== Proyecto id=${p.id} | ${p.name} (${p.client}) ===\n`);

const meta = pdata.meta || {};
console.log('META OEE CONFIG:');
console.log(`  manualOEE:       ${meta.manualOEE}`);
console.log(`  useManualOEE:    ${meta.useManualOEE}`);
console.log(`  useSectorOEE:    ${meta.useSectorOEE}`);

const sectors = pdata.sectors || [];
console.log(`\nSECTORS (${sectors.length}):`);
for (const s of sectors) {
    console.log(`  - id=${s.id} | name="${s.name}" | oeeTarget=${s.oeeTarget} | availabilityMin=${s.availabilityMinutesPerDay ?? '?'}`);
}

const stationConfigs = pdata.stationConfigs || [];
console.log(`\nSTATION CONFIGS (${stationConfigs.length}):`);
for (const s of stationConfigs) {
    console.log(`  - stationId=${s.stationId} | name="${s.name ?? '?'}" | sector=${s.sector ?? '?'} | oeeBase=${s.oeeBase ?? '(none)'} | operators=${s.operators ?? '?'}`);
}

const tasks = pdata.tasks || [];
console.log(`\nTASKS (${tasks.length}):`);
for (const t of tasks) {
    const stationId = t.stationId || t.station || '?';
    const sector = t.sector || '?';
    const oee = t.oee ?? t.oeeOverride ?? t.oeeBase ?? '(none)';
    console.log(`  - id=${t.id} | name="${t.name}" | station=${stationId} | sector=${sector} | time=${t.time ?? t.cycleTime ?? '?'} | oee=${oee}`);
    // Extra fields potencialmente con OEE
    const extraKeys = Object.keys(t).filter(k => /oee/i.test(k));
    if (extraKeys.length > 0 && extraKeys.join(',') !== 'oee') {
        console.log(`      OEE fields: ${extraKeys.map(k => `${k}=${JSON.stringify(t[k])}`).join(', ')}`);
    }
}

const activeModels = meta.activeModels || [];
console.log(`\nACTIVE MODELS (${activeModels.length}):`);
for (const m of activeModels) {
    console.log(`  - id=${m.id} | name="${m.name}" | demand=${m.demand ?? m.percentage ?? '?'}`);
}

// Cualquier otro lugar con 'oee' en el JSON del proyecto
console.log('\nBUSQUEDA DE CUALQUIER CAMPO "oee" EN TODO EL PROYECTO:');
const hits = [];
function walk(obj, path) {
    if (obj === null || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
        const newPath = `${path}.${k}`;
        if (/oee/i.test(k)) {
            hits.push({ path: newPath, value: obj[k] });
        }
        walk(obj[k], newPath);
    }
}
walk(pdata, 'data');
for (const h of hits) {
    let v = h.value;
    if (typeof v === 'object') v = JSON.stringify(v).slice(0, 80);
    console.log(`  ${h.path} = ${v}`);
}

process.exit(0);

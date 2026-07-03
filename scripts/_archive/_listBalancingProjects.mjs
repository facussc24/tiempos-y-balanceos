/**
 * Lista todos los proyectos de balanceo en Supabase (tabla projects).
 * Read-only. Muestra info util para identificar un proyecto especifico
 * (cantidad de modelos, cantidad de stations, stations de inyeccion, OEE global).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data, error } = await sb.from('projects').select('*').order('updated_at', { ascending: false });
if (error) { console.error('Error listando projects:', error.message); process.exit(1); }

console.log(`\nEncontrados ${data.length} proyecto(s) en la tabla 'projects':\n`);

for (const p of data) {
    let pdata = p.data;
    if (typeof pdata === 'string') {
        try { pdata = JSON.parse(pdata); } catch { pdata = {}; }
    }
    pdata = pdata || {};

    const meta = pdata.meta || {};
    const activeModels = meta.activeModels || [];
    const stationConfigs = pdata.stationConfigs || [];
    const sectors = pdata.sectors || [];
    const tasks = pdata.tasks || [];

    // Detect stations/sectors/tasks de inyeccion
    const injPat = /inyec|injection/i;
    const injSectors = sectors.filter(s => injPat.test(s.name || s.id || ''));
    const injStations = stationConfigs.filter(s => injPat.test(s.name || s.stationId || s.sector || ''));
    const injTasks = tasks.filter(t => injPat.test(t.name || t.description || ''));

    console.log('----------------------------------------------------------------');
    console.log(`  id:            ${p.id}`);
    console.log(`  name:          ${p.name || '(sin nombre)'}`);
    console.log(`  client:        ${p.client || '(sin cliente)'}`);
    console.log(`  project_code:  ${p.project_code || '(sin codigo)'}`);
    console.log(`  updated_at:    ${p.updated_at}`);
    console.log(`  daily_demand:  ${p.daily_demand}`);
    console.log(`  meta.manualOEE:      ${meta.manualOEE ?? '(no set)'}`);
    console.log(`  meta.useManualOEE:   ${meta.useManualOEE ?? '(no set)'}`);
    console.log(`  meta.useSectorOEE:   ${meta.useSectorOEE ?? '(no set)'}`);
    console.log(`  activeModels (piezas/modelos): ${activeModels.length}`);
    if (activeModels.length > 0 && activeModels.length <= 5) {
        for (const m of activeModels) {
            console.log(`      - ${m.id || m.name || '?'} | ${m.name || ''} | demanda=${m.demand ?? m.percentage ?? '?'}`);
        }
    }
    console.log(`  stationConfigs: ${stationConfigs.length} total, ${injStations.length} de inyeccion`);
    console.log(`  sectors:        ${sectors.length} total, ${injSectors.length} de inyeccion`);
    console.log(`  tasks:          ${tasks.length} total, ${injTasks.length} de inyeccion`);
}
console.log('----------------------------------------------------------------');
console.log(`\nPara inspeccionar uno: node scripts/_inspectProjectStations.mjs <id>`);
process.exit(0);

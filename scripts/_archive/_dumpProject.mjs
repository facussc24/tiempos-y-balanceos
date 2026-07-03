/**
 * Dump crudo del JSON 'data' de un proyecto. Read-only.
 * Uso: node scripts/_dumpProject.mjs <projectId>
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const projectId = process.argv[2];
if (!projectId) { console.error('Uso: node scripts/_dumpProject.mjs <projectId>'); process.exit(1); }

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: p, error } = await sb.from('projects').select('*').eq('id', projectId).single();
if (error) { console.error('Error:', error.message); process.exit(1); }

let pdata = p.data;
if (typeof pdata === 'string') pdata = JSON.parse(pdata);

mkdirSync(new URL('../backups/projects', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), { recursive: true });
const outPath = new URL(`../backups/projects/project_${projectId}_dump.json`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
writeFileSync(outPath, JSON.stringify({ row: p, data: pdata }, null, 2));
console.log(`Dump guardado en: ${outPath}`);

console.log('\nKeys top-level de data:', Object.keys(pdata));
console.log('\nPrimera task completa:');
console.log(JSON.stringify((pdata.tasks || [])[0], null, 2));
console.log('\nSegunda task completa:');
console.log(JSON.stringify((pdata.tasks || [])[1], null, 2));
console.log('\nsectors completo:');
console.log(JSON.stringify(pdata.sectors, null, 2));
console.log('\nstationConfigs completo:');
console.log(JSON.stringify(pdata.stationConfigs, null, 2));

process.exit(0);

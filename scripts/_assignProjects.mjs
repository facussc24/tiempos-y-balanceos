/**
 * Assign client/project to PWA AMFEs so they stop showing as "Sin clasificar"
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// Update PWA AMFEs with proper client/project path
const updates = [
    { project_name: 'Telas Planas PWA', newName: 'PWA/HILUX/TELAS_PLANAS', client: 'PWA' },
    { project_name: 'Telas Termoformadas PWA', newName: 'PWA/HILUX/TELAS_TERMOFORMADAS', client: 'PWA' },
];

for (const u of updates) {
    const { error } = await sb.from('amfe_documents')
        .update({ project_name: u.newName, client: u.client })
        .eq('project_name', u.project_name);
    if (error) console.error(`X ${u.project_name}: ${error.message}`);
    else console.log(`OK ${u.project_name} -> ${u.newName}`);
}

// Also update CPs
const cpUpdates = [
    { old: 'Telas Planas PWA', new: 'PWA/HILUX/TELAS_PLANAS' },
    { old: 'Telas Termoformadas PWA', new: 'PWA/HILUX/TELAS_TERMOFORMADAS' },
];
for (const u of cpUpdates) {
    const { error } = await sb.from('cp_documents')
        .update({ project_name: u.new })
        .eq('project_name', u.old);
    if (error) console.error(`X CP ${u.old}: ${error.message}`);
    else console.log(`OK CP ${u.old} -> ${u.new}`);
}

// Update HO linked_amfe_project
const hoUpdates = [
    { old: 'Telas Planas PWA', new: 'PWA/HILUX/TELAS_PLANAS' },
    { old: 'Telas Termoformadas PWA', new: 'PWA/HILUX/TELAS_TERMOFORMADAS' },
];
for (const u of hoUpdates) {
    const { error } = await sb.from('ho_documents')
        .update({ linked_amfe_project: u.new })
        .eq('linked_amfe_project', u.old);
    if (error) console.error(`X HO ${u.old}: ${error.message}`);
    else console.log(`OK HO ${u.old} -> ${u.new}`);
}

console.log('\nDone. Refresh the app to see PWA under client folder.');
process.exit(0);

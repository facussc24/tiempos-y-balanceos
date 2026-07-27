/**
 * Backup completo de Supabase — todos los documentos APQP + familias + productos
 * Guarda JSON en backups/ con timestamp
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Las tablas tienen RLS para 'authenticated': sin login, TODO devuelve 0 filas sin error.
// Un backup vacio que se reporta como OK es peor que no hacer backup — si despues alguien
// restaura desde ahi, borra todo. Incidente real: los backups del 8/7 al 27/7 salieron
// vacios porque faltaba VITE_AUTO_LOGIN_PASSWORD en .env.local, y nadie se entero.
const faltan = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_AUTO_LOGIN_EMAIL', 'VITE_AUTO_LOGIN_PASSWORD'].filter((k) => !env[k]);
if (faltan.length) {
    console.error(`\n✗ BACKUP ABORTADO — faltan variables en .env.local: ${faltan.join(', ')}`);
    console.error('  Sin login, las tablas con RLS devuelven 0 filas y el backup queda vacio.\n');
    process.exit(1);
}

const { data: auth, error: authError } = await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
if (authError || !auth?.user) {
    console.error(`\n✗ BACKUP ABORTADO — no se pudo autenticar: ${authError?.message || 'sin usuario'}`);
    console.error('  Revisar VITE_AUTO_LOGIN_EMAIL / VITE_AUTO_LOGIN_PASSWORD en .env.local.\n');
    process.exit(1);
}
console.log(`  auth OK: ${auth.user.email}`);

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = new URL(`../backups/${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(dir, { recursive: true });

const tables = [
    'amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents',
    'product_families', 'product_family_members', 'family_documents',
    'family_document_overrides', 'family_change_proposals',
    'products', 'customer_lines', 'settings',
];

let total = 0;
for (const table of tables) {
    const { data, error } = await sb.from(table).select('*');
    if (error) {
        console.log(`  X ${table}: ${error.message}`);
        continue;
    }
    // Parse JSON data fields
    for (const row of (data || [])) {
        if (typeof row.data === 'string') row.data = JSON.parse(row.data);
    }
    const path = `${dir}/${table}.json`;
    writeFileSync(path, JSON.stringify(data, null, 2));
    console.log(`  OK ${table}: ${(data || []).length} rows`);
    total += (data || []).length;
}

console.log(`\nBackup: ${dir}`);
console.log(`Total: ${total} rows across ${tables.length} tables`);

// Un backup sin AMFEs no es un backup. Fallar ruidosamente en vez de dejar una carpeta
// vacia que parezca valida.
const amfes = JSON.parse(readFileSync(`${dir}/amfe_documents.json`, 'utf8') || '[]').length;
if (amfes === 0) {
    console.error('\n✗ BACKUP INVALIDO: amfe_documents quedo en 0 documentos.');
    console.error(`  NO restaurar desde ${dir} — borraria los datos.`);
    console.error('  Causa tipica: login fallido (RLS devuelve vacio) o el proyecto Supabase pausado.\n');
    process.exit(1);
}
console.log(`✓ Backup valido (${amfes} AMFEs)`);
process.exit(0);

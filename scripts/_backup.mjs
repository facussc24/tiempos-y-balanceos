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
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

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
process.exit(0);

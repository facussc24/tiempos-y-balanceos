// Fix double-serialization en amfe_documents, cp_documents, ho_documents, pfd_documents
// Si data es string, JSON.parse hasta que sea objeto. Re-save con objeto directo.
// READ-AND-FIX. Hace backup ya previsto externamente.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => {
    const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()];
  })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const TABLES = ['amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents'];
let totalFixed = 0;

function deepParse(data) {
  let value = data;
  let passes = 0;
  while (typeof value === 'string' && passes < 5) {
    try { value = JSON.parse(value); } catch { break; }
    passes++;
  }
  return { value, passes };
}

for (const table of TABLES) {
  const idField = table === 'amfe_documents' ? 'amfe_number' : 'id';
  const { data: rows, error } = await sb.from(table).select(`id, ${idField}, data`);
  if (error) { console.error(`${table}: ${error.message}`); continue; }
  console.log(`\n=== ${table} (${rows.length} rows) ===`);
  let tableFixed = 0;
  for (const row of rows) {
    const { value, passes } = deepParse(row.data);
    if (passes > 0 && typeof value === 'object' && value !== null) {
      console.log(`  FIX ${row[idField]}: unwrapped ${passes}x`);
      const { error: upErr } = await sb.from(table).update({ data: value }).eq('id', row.id);
      if (upErr) { console.error(`    UPDATE ERROR: ${upErr.message}`); continue; }
      tableFixed++;
    } else if (passes > 0) {
      console.log(`  SKIP ${row[idField]}: ${passes}x parse but result not object`);
    } else {
      // already object, OK
    }
  }
  console.log(`  Fixed in ${table}: ${tableFixed}`);
  totalFixed += tableFixed;
}

console.log(`\n===== DONE =====`);
console.log(`Total fixed: ${totalFixed}`);
process.exit(0);

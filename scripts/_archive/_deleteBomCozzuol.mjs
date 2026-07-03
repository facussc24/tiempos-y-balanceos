import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';
const env = Object.fromEntries(readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
const { error } = await sb.from('bom_documents').delete().eq('bom_number', 'BOM-COZZUOL-UPPER-TRIM');
if (error) console.error('Error:', error.message); else console.log('Deleted BOM-COZZUOL-UPPER-TRIM (no tiene AMFE asociado)');

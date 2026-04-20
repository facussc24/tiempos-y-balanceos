// READ-ONLY: ver los steps del PFD Top Roll legacy, especialmente el MATERIAL CONFORME
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// Top Roll PFD legacy id: efa71449-10a0-43f8-a6b7-5edf078f37eb
const { data } = await sb.from('pfd_documents').select('id, data').eq('id', 'efa71449-10a0-43f8-a6b7-5edf078f37eb').single();
const d = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;

for (const s of d.steps || []) {
  const desc = s.description || '';
  if (/material|producto|conforme/i.test(desc) || s.stepType === 'decision' || s.rejectDisposition === 'scrap') {
    console.log(`[${s.stepNumber || '-'}] type=${s.stepType} rejDisp="${s.rejectDisposition}" desc="${desc}"`);
  }
}
process.exit(0);

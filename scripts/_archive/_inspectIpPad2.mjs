import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: doc } = await sb.from('amfe_documents').select('data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

// Show raw keys of first operation
const op0 = d.operations[0];
console.log('Operation keys:', Object.keys(op0));
console.log('Operation sample:', JSON.stringify(op0, null, 2).substring(0, 500));

// Show first WE
const we0 = (op0.workElements || [])[0];
if (we0) {
    console.log('\nWE keys:', Object.keys(we0));
    const fn0 = (we0.functions || [])[0];
    if (fn0) {
        console.log('Function keys:', Object.keys(fn0));
        const fail0 = (fn0.failures || [])[0];
        if (fail0) {
            console.log('Failure keys:', Object.keys(fail0));
            console.log('Failure sample:', JSON.stringify(fail0, null, 2).substring(0, 500));
            const c0 = (fail0.causes || [])[0];
            if (c0) {
                console.log('\nCause keys:', Object.keys(c0));
                console.log('Cause sample:', JSON.stringify(c0, null, 2).substring(0, 800));
            }
        }
    }
}

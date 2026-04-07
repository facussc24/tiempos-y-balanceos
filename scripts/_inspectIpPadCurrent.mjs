import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
const { data: doc } = await sb.from('amfe_documents').select('id, data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
console.log('Document ID:', doc.id);
console.log('Operations:', d.operations.length);
for (const op of d.operations) {
    const num = op.opNumber || op.operationNumber;
    const name = op.name || op.operationName;
    const fef = op.focusElementFunction || 'NOT SET';
    console.log(`\nOP ${num} ${name}`);
    console.log(`  focusElementFunction: ${fef.substring(0, 120)}`);
    const wes = op.workElements || [];
    for (const we of wes) {
        console.log(`  WE type=${we.type} name=${(we.name || '').substring(0, 80)}`);
    }
}

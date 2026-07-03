import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: doc } = await sb.from('amfe_documents').select('data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

console.log('Total operations:', d.operations.length);
for (const op of d.operations) {
    console.log(`\nOP ${op.opNumber} "${op.name}"`);
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                if (Number(fail.severity) >= 8) {
                    console.log(`  FAIL: S=${fail.severity} "${(fail.description || '').substring(0, 70)}"`);
                    for (const c of (fail.causes || [])) {
                        console.log(`    CAUSE: ap="${c.ap}" O=${c.occurrence} D=${c.detection} preventionAction="${(c.preventionAction || '').substring(0, 30)}" observations="${(c.observations || '').substring(0, 30)}"`);
                    }
                }
            }
        }
    }
}

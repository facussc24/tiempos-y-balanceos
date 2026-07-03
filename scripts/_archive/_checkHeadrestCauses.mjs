/**
 * Diagnose headrest causes missing ap
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: docs } = await sb.from('amfe_documents').select('id, project_name, data').like('project_name', '%HEADREST_FRONT%');
const doc = docs[0];
const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

let idx = 0;
for (const op of (data.operations || []))
    for (const we of (op.workElements || []))
        for (const fn of (we.functions || []))
            for (const fail of (fn.failures || []))
                for (const c of (fail.causes || [])) {
                    idx++;
                    if (!c.ap) {
                        console.log(`Cause #${idx}: ap="${c.ap}" actionPriority="${c.actionPriority}" S=${fail.severity||'?'}/${c.severity||'?'} O=${c.occurrence||'?'} D=${c.detection||'?'} desc="${(c.cause||c.description||'').slice(0, 50)}"`);
                    }
                }
console.log(`\nTotal causes: ${idx}`);

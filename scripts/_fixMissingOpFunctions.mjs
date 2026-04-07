/**
 * Fix missing focusElementFunction and operationFunction for OP 85 and OP 130
 * in the IP PADs AMFE document.
 *
 * OP 85 INYECCION DE PIEZAS PLASTICAS: derived from addInjectionToIpPads.mjs
 * OP 130 EMBALAJE: standard embalaje operation description
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: doc } = await sb.from('amfe_documents').select('id, data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

let fixed = 0;
for (const op of (data.operations || [])) {
    const num = op.opNumber || op.operationNumber || '';

    if (num === '85') {
        op.focusElementFunction = 'Obtener piezas plásticas inyectadas conformes';
        op.operationFunction = 'Se inyectan las piezas plásticas (sustratos) en inyectora según dossier de parámetros';
        console.log('OP 85: FEF + OF set');
        fixed += 2;
    }

    if (num === '130') {
        op.focusElementFunction = 'Proteger y embalar producto terminado para despacho';
        op.operationFunction = 'Se embala y etiqueta el producto terminado para logística';
        console.log('OP 130: FEF + OF set');
        fixed += 2;
    }
}

if (fixed > 0) {
    const { error } = await sb.from('amfe_documents').update({ data }).eq('id', doc.id);
    console.log(error ? 'SAVE FAILED: ' + error.message : `Saved OK (${fixed} fields fixed)`);
} else {
    console.log('Nothing to fix');
}

// Verify
const { data: v } = await sb.from('amfe_documents').select('data').eq('id', doc.id).single();
const vd = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;
for (const op of vd.operations) {
    const num = op.opNumber || op.operationNumber;
    if (num === '85' || num === '130') {
        console.log(`Verify OP ${num}: FEF="${op.focusElementFunction}" OF="${op.operationFunction}"`);
    }
}

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
const OF = { '10':['Proveer materia prima conforme','Se recepciona y controla la materia prima'],'20':['Obtener sustrato inyectado conforme','Se fabrican los sustratos HIGH y LOW a partir de PC+ABS'],'21':['Obtener ensamble sustrato + espuma conforme','Se ensambla el sustrato con la espuma'],'30':['Obtener paneles cortados a medida','Se realiza el corte del material en mesa de corte'],'40':['Obtener recubrimiento cosido conforme','Se realiza la costura union y vista'],'50':['Obtener sustrato y vinilo adhesivados correctamente','Se primeriza y adhesiva el sustrato y vinilo con fenoclor'],'60':['Asegurar calidad de piezas en proceso','Se verifica visualmente la calidad de la pieza'],'70':['Obtener cubierta alineada al sustrato','Se alinea y comienza a unir la cubierta al sustrato'],'80':['Obtener pieza con cubierta pegada y bordes doblados','Se termina de pegar la cubierta incluyendo doblado de bordes'],'90':['Aplicar logotipo airbag correctamente','Se aplica el logotipo del airbag mediante soldadura'],'100':['Completar fijaciones finales de la pieza','Se colocan los clips y elementos de fijacion finales'],'110':['Asegurar calidad dimensional y funcional','Se verifican tolerancias dimensionales y fijacion'],'120':['Proteger y embalar pieza para despacho','Se embala y etiqueta para logistica'] };
console.log('=== Fix cause.cause + functions ===\n');
const { data: allDocs } = await sb.from('amfe_documents').select('id, project_name, data');
console.log(allDocs.length + ' docs\n');
for (const doc of allDocs) {
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    let n = 0;
    for (const op of (data.operations||[])) for (const we of (op.workElements||[])) for (const fn of (we.functions||[])) for (const fail of (fn.failures||[])) for (const c of (fail.causes||[])) { if ((!c.cause||!c.cause.trim()) && c.description && c.description.trim()) { c.cause = c.description; n++; } }
    if (n > 0) { await sb.from('amfe_documents').update({ data }).eq('id', doc.id); console.log('  '+doc.project_name.split('/').pop()+': '+n+' causes migrated'); }
    else console.log('  '+doc.project_name.split('/').pop()+': OK');
}
console.log('\n--- Functions ---');
const ipPad = allDocs.find(d => d.project_name.includes('IP_PADS'));
const ipData = typeof ipPad.data === 'string' ? JSON.parse(ipPad.data) : ipPad.data;
let fa = 0;
for (const op of (ipData.operations||[])) { const k = op.opNumber||op.operationNumber||''; const f = OF[k]; if (f) { if (!op.focusElementFunction||!op.focusElementFunction.trim()) { op.focusElementFunction=f[0]; fa++; } if (!op.operationFunction||!op.operationFunction.trim()) { op.operationFunction=f[1]; fa++; } } }
await sb.from('amfe_documents').update({ data: ipData }).eq('id', ipPad.id);
console.log('  '+fa+' fields added');
console.log('\n--- Re-sync ---');
const { data: fresh } = await sb.from('amfe_documents').select('id, project_name, data');
for (const doc of fresh) { const d = typeof doc.data==='string'?JSON.parse(doc.data):doc.data; let cc=0,h=0,m=0,fl=0; for(const op of(d.operations||[]))for(const we of(op.workElements||[]))for(const fn of(we.functions||[]))for(const fail of(fn.failures||[]))for(const c of(fail.causes||[])){cc++;const ap=c.ap||c.actionPriority||'';if(ap==='H')h++;if(ap==='M')m++;if((Number(fail.severity)||Number(c.severity))&&c.occurrence&&c.detection)fl++;} const st={operation_count:(d.operations||[]).length,cause_count:cc,ap_h_count:h,ap_m_count:m,coverage_percent:cc>0?Math.round((fl/cc)*100):0}; await sb.from('amfe_documents').update(st).eq('id',doc.id); console.log('  '+doc.project_name.split('/').pop()+': H='+st.ap_h_count+' M='+st.ap_m_count); }
const { data: v } = await sb.from('amfe_documents').select('data').eq('id', ipPad.id).single();
const vd = typeof v.data==='string'?JSON.parse(v.data):v.data;
const o10 = vd.operations.find(op=>(op.opNumber||op.operationNumber)==='10');
console.log('\nVerify: focusElem="'+(o10?.focusElementFunction||'EMPTY')+'" cause.cause="'+(o10?.workElements?.[0]?.functions?.[0]?.failures?.[0]?.causes?.[0]?.cause||'EMPTY')+'"');
console.log('\n=== DONE ===');

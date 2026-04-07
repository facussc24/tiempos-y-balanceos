import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
const M = {
    '10': [['Material','Materia prima (vinilo PVC, espuma PU, sustrato PC+ABS)','Proveer materiales conformes a especificacion'],['Method','Procedimiento de recepcion e inspeccion','Verificar calidad y cantidad de materiales recibidos'],['Measurement','Calibres, micrometro, probeta flamabilidad','Medir y verificar especificaciones de materia prima']],
    '20': [['Machine','Inyectora BMA090/BMA089 + Molde','Inyectar sustratos HIGH y LOW en PC+ABS'],['Material','PC+ABS (materia prima inyeccion)','Proveer material para inyeccion'],['Method','Parametros inyeccion (temp, presion, tiempo)','Asegurar parametros correctos']],
    '21': [['Machine','Dispositivo ensamble sustrato+espuma','Ensamblar sustrato con espuma PU'],['Material','Espuma PU + Sustrato inyectado','Proveer componentes para ensamble']],
    '30': [['Machine','Mesa de corte + Myler de control','Cortar material segun patron'],['Material','PVC 1mm + PU 2mm (skin)','Proveer material de recubrimiento']],
    '40': [['Machine','Maquina de costura','Realizar costura union y vista'],['Material','Hilo PET superior e inferior','Proveer hilo para costura'],['Method','Patron de costura (union+vista)','Seguir patron correcto']],
    '50': [['Machine','Sistema aplicacion pantografico','Aplicar primer y adhesivo'],['Material','Primer + Adhesivo fenoclor','Proveer quimicos de adhesion'],['Method','Tiempos (90s primer + 140s adhesivo)','Cumplir tiempos de aplicacion']],
    '60': [['Method','Procedimiento inspeccion visual','Verificar ausencia de defectos'],['Measurement','Criterios visuales aceptacion/rechazo','Aplicar criterios calidad']],
    '70': [['Machine','Prensa automatica pre-fijacion','Alinear y pre-fijar cubierta'],['Method','Parametros presion y temperatura','Asegurar alineacion de costura']],
    '80': [['Machine','Maquina de virolado (wrapping)','Pegar cubierta y doblar bordes'],['Method','Secuencia wrapping+edge folding','Cumplir tiempos de tapizado']],
    '85': [['Machine','Inyectora piezas plasticas','Inyectar componentes auxiliares'],['Material','Material plastico inyeccion','Proveer material auxiliar']],
    '90': [['Machine','Equipo soldadura logotipo airbag','Soldar logotipo correctamente'],['Method','Procedimiento soldadura (2 puntos)','Asegurar fijacion logotipo']],
    '100': [['Material','Clips (10 LOW/12 HIGH) + tornillos','Proveer fijaciones por version'],['Method','Procedimiento montaje clips','Instalar fijaciones segun version']],
    '110': [['Measurement','Dispositivos control dimensional','Verificar tolerancias'],['Method','Procedimiento inspeccion final','Verificar fijacion y soldaduras']],
    '120': [['Material','Film protector + etiquetas','Proteger e identificar pieza'],['Method','Procedimiento embalaje CKD','Embalar sin deformaciones']],
    '130': [['Material','Material embalaje','Proveer materiales embalaje'],['Method','Procedimiento despacho','Embalar correctamente']]
};
console.log('=== Add 6M WEs to IP PAD ===\n');
const { data: doc } = await sb.from('amfe_documents').select('id, data').eq('project_name', 'VWA/PATAGONIA/IP_PADS').single();
const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
let t = 0;
for (const op of (d.operations||[])) {
    const k = op.opNumber||op.operationNumber||'';
    const elems = M[k]; if (!elems) continue;
    const ex = (op.workElements||[]).map(w=>w.type);
    for (const [type,name,fn] of elems) {
        if (ex.includes(type)) continue;
        op.workElements.push({id:randomUUID(),type,name,functions:[{id:randomUUID(),description:fn,requirements:'',failures:[]}]});
        t++;
    }
}
console.log(t + ' WEs added');
await sb.from('amfe_documents').update({data:d}).eq('id',doc.id);
const { data: v } = await sb.from('amfe_documents').select('data').eq('id',doc.id).single();
const vd = typeof v.data==='string'?JSON.parse(v.data):v.data;
for (const op of vd.operations) console.log('  OP '+(op.opNumber||op.operationNumber)+': '+op.workElements.length+' WEs ['+op.workElements.map(w=>w.type).join(', ')+']');
console.log('\nDONE');

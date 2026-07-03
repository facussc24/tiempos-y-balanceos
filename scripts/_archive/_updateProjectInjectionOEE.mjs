/**
 * Actualiza el OEE global (meta.manualOEE) de un proyecto de balanceo.
 * Hace backup de la fila antes de modificar. Recalcula checksum SHA-256.
 *
 * La columna 'projects.data' es TEXT (JSON stringificado). El cliente Supabase-JS
 * serializa automaticamente al enviar un objeto JS en .update(), y al leer devuelve
 * el string crudo. Por eso typeof data === 'string' es lo correcto aqui
 * (a diferencia de amfe_documents/cp_documents que son JSONB).
 *
 * Uso: node scripts/_updateProjectInjectionOEE.mjs <projectId> <nuevoOEE_0a1>
 *   Ej: node scripts/_updateProjectInjectionOEE.mjs 16 0.45
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

const projectId = process.argv[2];
const newOEE = parseFloat(process.argv[3]);
if (!projectId || !Number.isFinite(newOEE) || newOEE < 0 || newOEE > 1) {
    console.error('Uso: node scripts/_updateProjectInjectionOEE.mjs <projectId> <nuevoOEE_0a1>');
    console.error('  Ej: node scripts/_updateProjectInjectionOEE.mjs 16 0.45');
    process.exit(1);
}

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// 1. Descargar el proyecto
const { data: p, error } = await sb.from('projects').select('*').eq('id', projectId).single();
if (error) { console.error('Error descargando:', error.message); process.exit(1); }

let pdata = p.data;
if (typeof pdata === 'string') pdata = JSON.parse(pdata);

const oldOEE = pdata.meta?.manualOEE;
console.log(`\nProyecto: id=${p.id} | ${p.name} (${p.client})`);
console.log(`OEE global actual: ${oldOEE} (${(oldOEE * 100).toFixed(1)}%)`);
console.log(`OEE global nuevo:  ${newOEE} (${(newOEE * 100).toFixed(1)}%)`);

// 2. Backup fila completa
mkdirSync(new URL('../backups/projects', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = new URL(`../backups/projects/project_${projectId}_${ts}_pre_oee_update.json`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
writeFileSync(backupPath, JSON.stringify({ row: p, data: pdata }, null, 2));
console.log(`Backup guardado: ${backupPath}`);

// 3. Modificar solo meta.manualOEE
pdata.meta = { ...pdata.meta, manualOEE: newOEE };

// 4. Recalcular checksum SHA-256 del string serializado
const serialized = JSON.stringify(pdata);
const newChecksum = createHash('sha256').update(serialized).digest('hex');

// 5. Update — Supabase-JS serializa automaticamente el objeto a JSON string
//    para la columna TEXT. Tambien actualizamos checksum y updated_at.
const { error: upErr } = await sb
    .from('projects')
    .update({ data: pdata, checksum: newChecksum, updated_at: new Date().toISOString() })
    .eq('id', projectId);
if (upErr) { console.error('Error actualizando:', upErr.message); process.exit(1); }

// 6. Verificar post-update — para projects (TEXT) esperamos string
const { data: p2, error: verErr } = await sb.from('projects').select('data, checksum').eq('id', projectId).single();
if (verErr) { console.error('Error verificando:', verErr.message); process.exit(1); }

if (typeof p2.data !== 'string') {
    console.error('FALLA: data no es string (columna TEXT esperada). Rollback desde', backupPath);
    process.exit(1);
}
const pdata2 = JSON.parse(p2.data);
const verOEE = pdata2.meta?.manualOEE;
if (Math.abs(verOEE - newOEE) > 1e-9) {
    console.error(`FALLA: manualOEE esperado ${newOEE}, actual ${verOEE}. Rollback.`);
    process.exit(1);
}
if (p2.checksum !== newChecksum) {
    console.error(`FALLA: checksum no coincide. esperado ${newChecksum}, actual ${p2.checksum}. Rollback.`);
    process.exit(1);
}

console.log(`\nOK. manualOEE: ${oldOEE} -> ${verOEE}`);
console.log(`Checksum actualizado: ${p2.checksum.slice(0, 16)}...`);
process.exit(0);

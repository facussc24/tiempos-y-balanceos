/**
 * Revert: 1) Top Roll (bug string concat 510/1010/...) 2) "Control dimensional" vuelto a pendiente por error
 * Usa backup 2026-04-20T19-40-07 (pre-fix).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const BK = 'backups/2026-04-20T19-40-07';
const amfeBk = JSON.parse(readFileSync(`${BK}/amfe_documents.json`, 'utf8'));
const pfdBk = JSON.parse(readFileSync(`${BK}/pfd_documents.json`, 'utf8'));

// 1) Restaurar AMFE-TR-PAT entero (Top Roll)
const trOrig = amfeBk.find(d => d.amfe_number === 'AMFE-TR-PAT');
if (trOrig) {
  const { error } = await sb.from('amfe_documents').update({ data: trOrig.data }).eq('id', trOrig.id);
  console.log('Restore AMFE-TR-PAT:', error?.message || 'OK');
}
const trPfdOrig = pfdBk.find(d => d.document_number === 'PFD-TOPROLL-001');
if (trPfdOrig) {
  const { error } = await sb.from('pfd_documents').update({ data: trPfdOrig.data }).eq('id', trPfdOrig.id);
  console.log('Restore PFD-TOPROLL-001:', error?.message || 'OK');
}

// 2) Restaurar "Control dimensional" donde lo haya reemplazado por "Pendiente definicion equipo APQP"
// Estrategia: comparar el detection control de cada causa. Si el backup tenia "Control dimensional" y el actual dice "Pendiente definicion equipo APQP", revertirlo.
function walkCauses(ops) {
  const causes = [];
  for (const op of ops || []) for (const we of op.workElements || []) for (const fn of we.functions || []) for (const fl of fn.failures || []) for (const c of fl.causes || []) causes.push(c);
  return causes;
}

for (const docBk of amfeBk) {
  if (docBk.amfe_number === 'AMFE-TR-PAT') continue; // ya restaurado entero
  const pBk = typeof docBk.data === 'string' ? JSON.parse(docBk.data) : docBk.data;
  const causesBk = walkCauses(pBk.operations);
  if (causesBk.length === 0) continue;

  const { data: current } = await sb.from('amfe_documents').select('*').eq('id', docBk.id).single();
  const pCur = typeof current.data === 'string' ? JSON.parse(current.data) : current.data;
  const causesCur = walkCauses(pCur.operations);

  let reverted = 0;
  // Hacer match por id de causa
  const mapBk = new Map(causesBk.map(c => [c.id, c]));
  for (const cCur of causesCur) {
    const cBk = mapBk.get(cCur.id);
    if (!cBk) continue;
    if (cCur.preventionControl === 'Pendiente definicion equipo APQP' && cBk.preventionControl && !/^(m[eé]todo|proceso|sistema|control|capacitaci[oó]n|buen m[eé]todo|seguir procedimiento)$/i.test((cBk.preventionControl || '').trim())) {
      cCur.preventionControl = cBk.preventionControl;
      reverted++;
    }
    if (cCur.detectionControl === 'Pendiente definicion equipo APQP' && cBk.detectionControl && !/^(m[eé]todo|proceso|sistema|control|capacitaci[oó]n|buen m[eé]todo|seguir procedimiento)$/i.test((cBk.detectionControl || '').trim())) {
      cCur.detectionControl = cBk.detectionControl;
      reverted++;
    }
  }
  if (reverted > 0) {
    const { error } = await sb.from('amfe_documents').update({ data: pCur }).eq('id', docBk.id);
    console.log(`${docBk.amfe_number}: reverted ${reverted} controls`, error?.message || 'OK');
  }
}

console.log('\nRevert done.');
process.exit(0);

// Fix OP 40 "INYECCION DE SUSTRATO" en 3 Headrest
// Rename a "COSTURA 2DA ETAPA" y resetear WEs a [] (para que equipo complete)
// Razon: contenido propagado del maestro de inyeccion plastica no aplica a Headrest (solo tiene PU).
// El equipo APQP debe completar WEs con contenido real de costura 2da etapa segun PPAP Rev.1
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const DRY_RUN = process.argv.includes('--dry');

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => {
    const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()];
  })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const HEADREST_IDS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const { data: docs } = await sb.from('amfe_documents').select('id, amfe_number, data').in('amfe_number', HEADREST_IDS);

for (const d of docs) {
  const data = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  const op40 = (data.operations || []).find(op => String(op.opNumber || op.operationNumber) === '40');
  if (!op40) { console.log(`  ${d.amfe_number}: no OP 40 found`); continue; }

  const oldName = op40.name || op40.operationName;
  const oldWeCount = (op40.workElements || []).length;

  console.log(`\n${d.amfe_number}:`);
  console.log(`  BEFORE: OP 40 "${oldName}" with ${oldWeCount} WEs`);

  if (!DRY_RUN) {
    op40.name = 'COSTURA 2DA ETAPA';
    op40.operationName = 'COSTURA 2DA ETAPA';
    op40.workElements = [];
    // limpiar campos heredados del sync de inyeccion plastica
    if (op40.operationFunction && op40.operationFunction.toLowerCase().includes('inyec')) {
      op40.operationFunction = '';
    }
    if (op40.focusElementFunction && op40.focusElementFunction.toLowerCase().includes('inyec')) {
      op40.focusElementFunction = '';
    }

    const { error: upErr } = await sb.from('amfe_documents').update({ data }).eq('id', d.id);
    if (upErr) { console.error(`  UPDATE ERROR: ${upErr.message}`); continue; }
    console.log(`  AFTER: OP 40 "COSTURA 2DA ETAPA" with 0 WEs (equipo APQP debe completar segun PPAP Rev.1)`);
  } else {
    console.log(`  DRY RUN: would rename to "COSTURA 2DA ETAPA" and reset WEs to []`);
  }
}

console.log(`\n===== DONE ${DRY_RUN ? '(DRY)' : ''} =====`);
process.exit(0);

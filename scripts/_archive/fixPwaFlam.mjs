/**
 * Fix Script — PWA Flamabilidad CC + Nombres de Operacion
 *
 * Correcciones SEGURAS de los hallazgos de auditoria PWA 2026-04-06:
 *
 *  FIX 1: AMFE Telas Planas — agregar FM de flamabilidad al WE "TNT PP 30 Blanco"
 *          La funcion TBD no tenia failures. Se agrega:
 *          - FM: "Flamabilidad fuera de norma del cliente PWA" (S=10, CC="CC")
 *          - Causa: S=10 O=2 D=3 AP=L, preventionControl + detectionControl
 *          Regla: flamabilidad es CC OBLIGATORIA en toda pieza de cabina interior.
 *          Nota: norma es "del cliente PWA" (NO TL 1010 - esa es VW).
 *
 *  FIX 2: CP Termoformadas — item flamabilidad (OP 10) → specialChar = "CC"
 *          El item existe pero specialChar=undefined. Se corrige a "CC".
 *
 *  FIX 3: CP Telas Planas — item flamabilidad (OP 10) → specialChar = "CC"
 *          Mismo caso.
 *
 *  FIX 4: AMFE Termoformadas OP 110 — renombrar a "EMBALAJE"
 *          Actualmente: "EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO"
 *          Regla control-plan.md: el nombre canonico en AMFE/CP/HO es "EMBALAJE"
 *          (el PFD usa el nombre largo, pero AMFE/CP/HO usan el corto).
 *
 * USO:
 *   node scripts/fixPwaFlam.mjs              # dry-run (default)
 *   node scripts/fixPwaFlam.mjs --apply      # aplicar cambios
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const APPLY = process.argv.includes('--apply');
const DRY = !APPLY;

const envPath = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: authErr } = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('OK Authenticated');
console.log('Mode:', DRY ? 'DRY-RUN (--apply to write)' : 'APPLY');

// ─── IDs ─────────────────────────────────────────────────────────────
const AMFE_PLANAS_ID   = '57011560-d4c1-4a8a-83f0-ed37a2bab1d5';
const AMFE_TERMO_ID    = 'c5201ba9-1225-4663-b7a1-5430f9ee8912';
const CP_PLANAS_ID     = '332bcdda-a7d8-4d28-a41d-3961472ccb0e';
const CP_TERMO_ID      = '85fd046d-a3bd-4de1-a9f9-d2fd51466999';
const CP_FLAM_PLANAS   = '9d1ee437-bb93-49b0-a45f-ea72de3a7d24';  // CP item id
const CP_FLAM_TERMO    = 'd77076d8-9568-4725-b36f-af44fb5c6fa4';  // CP item id

// ─── Backup ──────────────────────────────────────────────────────────
const backupDir = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/pre-fix-pwa-flam';
mkdirSync(backupDir, { recursive: true });
for (const [label, table, id] of [
  ['amfe_planas', 'amfe_documents', AMFE_PLANAS_ID],
  ['amfe_termo',  'amfe_documents', AMFE_TERMO_ID],
  ['cp_planas',   'cp_documents',   CP_PLANAS_ID],
  ['cp_termo',    'cp_documents',   CP_TERMO_ID],
]) {
  const { data } = await sb.from(table).select('*').eq('id', id).single();
  writeFileSync(`${backupDir}/${label}.json`, JSON.stringify(data, null, 2));
}
console.log('Backup saved to:', backupDir);

// ─── FIX 1: AMFE Telas Planas — agregar flamabilidad al WE TNT ────────
console.log('\n--- FIX 1: AMFE Telas Planas — flamabilidad CC en TNT PP 30 Blanco ---');
{
  const { data: doc } = await sb.from('amfe_documents').select('data').eq('id', AMFE_PLANAS_ID).single();
  let d = doc.data;
  if (typeof d === 'string') d = JSON.parse(d);

  const op10 = d.operations.find(op => (op.opNumber || op.operationNumber) === '10');
  if (!op10) { console.error('OP 10 no encontrada'); process.exit(1); }

  const tntWe = op10.workElements.find(we => (we.name || '').includes('TNT PP 30'));
  if (!tntWe) { console.error('WE TNT PP 30 Blanco no encontrado'); process.exit(1); }

  // Check current state
  const existingFlam = (tntWe.functions || []).some(fn =>
    (fn.failures || []).some(fm => /flamab/i.test(fm.description || ''))
  );
  if (existingFlam) {
    console.log('  SKIP: ya existe failure de flamabilidad en TNT WE');
  } else {
    // Update function description from TBD to meaningful
    const fn = tntWe.functions[0];
    const oldDesc = fn.description;
    fn.description = 'Proveer material textil secundario conforme a especificaciones del cliente (gramaje, color blanco, flamabilidad)';
    fn.functionDescription = fn.description;

    // Build new failure + cause
    const newFailure = {
      id: randomUUID(),
      description: 'Flamabilidad fuera de norma del cliente PWA',
      severity: 10,
      effectLocal: 'Rechazo del lote completo',
      effectNextLevel: 'Detencion de produccion por falta de material aprobado',
      effectEndUser: 'Riesgo de seguridad del pasajero en caso de incendio',
      causes: [
        {
          id: randomUUID(),
          description: 'Proveedor con proceso de fabricacion fuera de control',
          cause: 'Proveedor con proceso de fabricacion fuera de control',
          severity: 10,
          occurrence: 2,
          detection: 3,
          preventionControl: 'Certificado de ensayo de flamabilidad por lote del proveedor',
          detectionControl: 'Ensayo de flamabilidad en recepcion segun norma del cliente PWA',
          ap: 'L',
          actionPriority: 'L',
          specialChar: 'CC',
          characteristicNumber: '',
          filterCode: '',
          recommendedAction: '',
        }
      ]
    };

    fn.failures = [newFailure];

    console.log(`  fn.description: "${oldDesc}" → "${fn.description}"`);
    console.log(`  Failure agregado: "${newFailure.description}" S=${newFailure.causes[0].severity} CC="CC"`);

    if (!DRY) {
      const { error } = await sb.from('amfe_documents').update({ data: d }).eq('id', AMFE_PLANAS_ID);
      if (error) { console.error('Error FIX 1:', error.message); process.exit(1); }
      console.log('  OK AMFE Telas Planas actualizado');
    } else {
      console.log('  DRY: no se escribio');
    }
  }
}

// ─── FIX 2: CP Termoformadas — flamabilidad item → CC ────────────────
console.log('\n--- FIX 2: CP Termoformadas — specialChar=CC en flamabilidad ---');
{
  const { data: cpDoc } = await sb.from('cp_documents').select('data').eq('id', CP_TERMO_ID).single();
  let d = cpDoc.data;
  if (typeof d === 'string') d = JSON.parse(d);

  const item = (d.items || []).find(i => i.id === CP_FLAM_TERMO);
  if (!item) { console.error('CP item flamabilidad Termoformadas no encontrado'); process.exit(1); }

  console.log(`  specialChar actual: "${item.specialChar}" → "CC"`);
  item.specialChar = 'CC';
  item.amfeSeverity = 10;
  item.amfeAp = 'L';

  if (!DRY) {
    const { error } = await sb.from('cp_documents').update({ data: d }).eq('id', CP_TERMO_ID);
    if (error) { console.error('Error FIX 2:', error.message); process.exit(1); }
    console.log('  OK CP Termoformadas actualizado');
  } else {
    console.log('  DRY: no se escribio');
  }
}

// ─── FIX 3: CP Telas Planas — flamabilidad item → CC ─────────────────
console.log('\n--- FIX 3: CP Telas Planas — specialChar=CC en flamabilidad ---');
{
  const { data: cpDoc } = await sb.from('cp_documents').select('data').eq('id', CP_PLANAS_ID).single();
  let d = cpDoc.data;
  if (typeof d === 'string') d = JSON.parse(d);

  const item = (d.items || []).find(i => i.id === CP_FLAM_PLANAS);
  if (!item) { console.error('CP item flamabilidad Planas no encontrado'); process.exit(1); }

  console.log(`  specialChar actual: "${item.specialChar}" → "CC"`);
  item.specialChar = 'CC';
  item.amfeSeverity = 10;

  if (!DRY) {
    const { error } = await sb.from('cp_documents').update({ data: d }).eq('id', CP_PLANAS_ID);
    if (error) { console.error('Error FIX 3:', error.message); process.exit(1); }
    console.log('  OK CP Telas Planas actualizado');
  } else {
    console.log('  DRY: no se escribio');
  }
}

// ─── FIX 4: AMFE Termoformadas OP 110 — renombrar a "EMBALAJE" ───────
console.log('\n--- FIX 4: AMFE Termoformadas OP 110 — renombrar ---');
{
  const { data: doc } = await sb.from('amfe_documents').select('data').eq('id', AMFE_TERMO_ID).single();
  let d = doc.data;
  if (typeof d === 'string') d = JSON.parse(d);

  const op110 = d.operations.find(op => (op.opNumber || op.operationNumber) === '110');
  if (!op110) {
    console.log('  SKIP: OP 110 no encontrada (puede que ya fue renombrada)');
  } else {
    const oldName = op110.name || op110.operationName;
    if (oldName === 'EMBALAJE') {
      console.log('  SKIP: ya tiene nombre correcto "EMBALAJE"');
    } else {
      op110.name = 'EMBALAJE';
      op110.operationName = 'EMBALAJE';
      console.log(`  "${oldName}" → "EMBALAJE"`);

      if (!DRY) {
        const { error } = await sb.from('amfe_documents').update({ data: d }).eq('id', AMFE_TERMO_ID);
        if (error) { console.error('Error FIX 4:', error.message); process.exit(1); }
        console.log('  OK AMFE Termoformadas actualizado');
      } else {
        console.log('  DRY: no se escribio');
      }
    }
  }
}

// ─── Verification (if applied) ────────────────────────────────────────
if (!DRY) {
  console.log('\n=== VERIFICACION ===');

  // Verify AMFE Planas
  const { data: ap } = await sb.from('amfe_documents').select('data').eq('id', AMFE_PLANAS_ID).single();
  let dp = ap.data;
  if (typeof dp === 'string') dp = JSON.parse(dp);
  if (typeof dp === 'string') { console.error('DOUBLE-SERIAL AMFE Planas!'); process.exit(1); }
  const op10p = dp.operations.find(op => (op.opNumber||op.operationNumber) === '10');
  const tntWe = op10p.workElements.find(we => (we.name||'').includes('TNT PP 30'));
  const flamFail = (tntWe.functions||[]).flatMap(fn => fn.failures||[]).find(fm => /flamab/i.test(fm.description||''));
  console.log('AMFE Planas — flamabilidad failure:', flamFail ? `"${flamFail.description}" CC="${flamFail.causes[0]?.specialChar}"` : 'NO ENCONTRADO!');

  // Verify AMFE Termo OP110
  const { data: at } = await sb.from('amfe_documents').select('data').eq('id', AMFE_TERMO_ID).single();
  let dt = at.data;
  if (typeof dt === 'string') dt = JSON.parse(dt);
  if (typeof dt === 'string') { console.error('DOUBLE-SERIAL AMFE Termo!'); process.exit(1); }
  const op110t = dt.operations.find(op => (op.opNumber||op.operationNumber) === '110');
  console.log('AMFE Termo OP110 name:', op110t ? `"${op110t.name||op110t.operationName}"` : 'no encontrada');

  // Verify CP Termo flamabilidad
  const { data: ct } = await sb.from('cp_documents').select('data').eq('id', CP_TERMO_ID).single();
  let dct = ct.data;
  if (typeof dct === 'string') dct = JSON.parse(dct);
  if (typeof dct === 'string') { console.error('DOUBLE-SERIAL CP Termo!'); process.exit(1); }
  const cpfT = (dct.items||[]).find(i => i.id === CP_FLAM_TERMO);
  console.log('CP Termo flam specialChar:', cpfT ? `"${cpfT.specialChar}"` : 'item no encontrado');

  // Verify CP Planas flamabilidad
  const { data: cp } = await sb.from('cp_documents').select('data').eq('id', CP_PLANAS_ID).single();
  let dcp = cp.data;
  if (typeof dcp === 'string') dcp = JSON.parse(dcp);
  if (typeof dcp === 'string') { console.error('DOUBLE-SERIAL CP Planas!'); process.exit(1); }
  const cpfP = (dcp.items||[]).find(i => i.id === CP_FLAM_PLANAS);
  console.log('CP Planas flam specialChar:', cpfP ? `"${cpfP.specialChar}"` : 'item no encontrado');
}

console.log('\nDone.');
process.exit(0);

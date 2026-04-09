/**
 * Fix Top Roll AMFE — Split grouped Work Elements (1M per line rule)
 *
 * AIAG-VDA 2019: Each Work Element MUST be a SINGLE item from 4M/6M.
 * PROHIBITED to group multiple items in one WE.
 *
 * This script runs AFTER fixTopRoll-structural.mjs which:
 *   - Removed OP 11 (ALMACENAMIENTO WIP)
 *   - Renamed OPs to Spanish
 *   - Merged duplicate WE in OP 10
 *
 * Expected OPs: 5, 10, 20, 30, 40, 50, 60, 70, 80, 90
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Read .env.local manually ────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ── AP calculation (copied from apTable.ts) ─────────────────────────
function apRule(s, o, d) {
  if (s <= 1) return 'L';
  if (s <= 3) {
    if (o >= 8 && d >= 5) return 'M';
    return 'L';
  }
  if (s <= 6) {
    if (o >= 8) return d >= 5 ? 'H' : 'M';
    if (o >= 6) return d >= 2 ? 'M' : 'L';
    if (o >= 4) return d >= 7 ? 'M' : 'L';
    return 'L';
  }
  if (s <= 8) {
    if (o >= 8) return 'H';
    if (o >= 6) return d >= 2 ? 'H' : 'M';
    if (o >= 4) return d >= 7 ? 'H' : 'M';
    if (o >= 2) return d >= 5 ? 'M' : 'L';
    return 'L';
  }
  // S = 9-10
  if (o >= 6) return 'H';
  if (o >= 4) return d >= 2 ? 'H' : 'M';
  if (o >= 2) {
    if (d >= 7) return 'H';
    if (d >= 5) return 'M';
    return 'L';
  }
  return 'L';
}

function calculateAP(s, o, d) {
  if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
  const sInt = Math.round(s);
  const oInt = Math.round(o);
  const dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
  return apRule(sInt, oInt, dInt);
}

// ── Fetch the AMFE ──────────────────────────────────────────────────
const AMFE_ID = '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3';

const { data: doc, error: fetchErr } = await sb
  .from('amfe_documents')
  .select('*')
  .eq('id', AMFE_ID)
  .single();

if (fetchErr) {
  console.error('ERROR fetching AMFE:', fetchErr.message);
  process.exit(1);
}

// Parse if double-serialized
let amfeData = doc.data;
if (typeof amfeData === 'string') {
  amfeData = JSON.parse(amfeData);
  console.log('WARNING: data was double-serialized string, parsed it.');
}

console.log('=== TOP ROLL AMFE fetched ===');
console.log(`Operations: ${amfeData.operations.length}`);
for (const op of amfeData.operations) {
  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;
  console.log(`  OP ${opNum}: ${opName} (${(op.workElements || []).length} WEs)`);
  for (const we of (op.workElements || [])) {
    console.log(`    WE: "${we.name}" [${we.type}] (${(we.functions || []).length} functions)`);
  }
}

// ── Backup before changes ───────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/toproll-weSplit-${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/amfe_before.json`, JSON.stringify(amfeData, null, 2));
console.log(`\nBackup saved to: ${backupDir}/amfe_before.json`);

// ── Deep clone for modification ─────────────────────────────────────
const data = JSON.parse(JSON.stringify(amfeData));

// Helper to find op by number
function findOp(opNum) {
  return data.operations.find(op =>
    String(op.operationNumber || op.opNumber) === String(opNum)
  );
}

// ── Helper: deep clone with new UUIDs ───────────────────────────────
function cloneWithNewIds(obj) {
  const clone = JSON.parse(JSON.stringify(obj));
  clone.id = randomUUID();
  if (clone.failures) {
    for (const f of clone.failures) {
      f.id = randomUUID();
      if (f.causes) {
        for (const c of f.causes) {
          c.id = randomUUID();
        }
      }
    }
  }
  return clone;
}

// ── Helper: clone entire functions array with new IDs ───────────────
function cloneFunctionsWithNewIds(functions) {
  return (functions || []).map(fn => {
    const cloned = JSON.parse(JSON.stringify(fn));
    cloned.id = randomUUID();
    if (cloned.failures) {
      for (const f of cloned.failures) {
        f.id = randomUUID();
        if (f.causes) {
          for (const c of f.causes) {
            c.id = randomUUID();
          }
        }
      }
    }
    return cloned;
  });
}

// ═══════════════════════════════════════════════════════════════════
// SPLIT DEFINITIONS — each entry describes a grouped WE to split
// ═══════════════════════════════════════════════════════════════════

const splitDefinitions = [
  // ── OP 5 RECEPCION ──
  {
    opNum: '5',
    // Match the grouped WE by partial name
    matchName: 'Calibres',
    matchPartial: true,
    newType: 'Measurement', // CORRECTED: these are measurement instruments, not materials
    splitInto: [
      'Calibres',
      'Micrómetro',
      'Probeta de flamabilidad',
      'Probeta de peeling',
    ],
  },

  // ── OP 20 ADHESIVADO ──
  {
    opNum: '20',
    matchName: 'Sistema de Fusión',
    matchPartial: true,
    newType: 'Machine',
    splitInto: [
      'Sistema de Fusión',
      'Sistema de Aplicación',
      'Sistema de Desenrollado y Tensión',
      'Sistema de Enfriamiento',
    ],
  },
  {
    opNum: '20',
    matchName: 'Adhesivo Hot Melt',
    matchPartial: true,
    newType: 'Material',
    splitInto: [
      'Adhesivo Hot Melt',
      'Rollo de TPO (Sustrato)',
    ],
  },

  // ── OP 30 TERMOFORMADO ──
  {
    opNum: '30',
    matchName: 'Estación de Calentamiento',
    matchPartial: true,
    newType: 'Machine',
    splitInto: [
      'Estación de Calentamiento',
      'Estación de Formado',
      'Sistema de Vacío',
      'Sistema de Enfriamiento',
      'Mecanismo de Transporte',
    ],
  },
  {
    opNum: '30',
    matchName: 'Rollo Pre-laminado',
    matchPartial: true,
    newType: 'Material',
    splitInto: [
      'Rollo Pre-laminado (TPO + Hot Melt)',
      'Molde de IMG',
    ],
  },

  // ── OP 40 CORTE FINAL ──
  {
    opNum: '40',
    matchName: 'Componentes de Cuchilla',
    matchPartial: true,
    newType: 'Machine',
    splitInto: [
      'Componentes de Cuchilla (Cuchilla caliente)',
      'Sistema Neumático',
      'Plataforma del Molde Inferior',
      'Sistema de Control Eléctrico',
    ],
  },
  {
    opNum: '40',
    matchName: 'Pieza Termoformada',
    matchPartial: true,
    newType: 'Material',
    splitInto: [
      'Pieza Termoformada (Formed Part)',
      'Aire Comprimido',
    ],
  },

  // ── OP 50 PLEGADO DE BORDES ──
  {
    opNum: '50',
    matchName: 'Pieza Recortada',
    matchPartial: true,
    newType: 'Material',
    splitInto: [
      'Pieza Recortada (Trimmed Part)',
      'Adhesivo Reactivo (Hot Melt)',
    ],
  },

  // ── OP 60 SOLDADURA DE REFUERZOS ──
  {
    opNum: '60',
    matchName: 'Fixture-Nido',
    matchPartial: true,
    newType: 'Machine',
    splitInto: [
      'Fixture-Nido',
      'Cjto. Presión-Captación',
      'Energía (20 kHz)',
    ],
  },
  {
    opNum: '60',
    matchName: 'Pieza Plegada',
    matchPartial: true,
    newType: 'Material',
    splitInto: [
      'Pieza Plegada (Edgewrapped Part)',
      'Refuerzos Plásticos (Brackets/Bosses)',
    ],
  },

  // ── OP 70 SOLDADURA TWEETER ──
  {
    opNum: '70',
    matchName: 'Top Roll (Sustrato)',
    matchPartial: true,
    newType: 'Material',
    splitInto: [
      'Top Roll (Sustrato)',
      'Tweeter-Grilla de Altavoz',
    ],
  },

  // ── OP 80 CONTROL FINAL ──
  {
    opNum: '80',
    matchName: 'Dispositivo de Verificación',
    matchPartial: true,
    newType: 'Machine',
    splitInto: [
      'Dispositivo de Verificación',
      'Dispositivo de Control',
      'Sistema de Etiquetado',
    ],
  },
  {
    opNum: '80',
    matchName: 'Etiquetas',
    matchPartial: true,
    newType: 'Material',
    splitInto: [
      'Etiquetas',
      'Contenedor',
      'Pieza Top Roll',
    ],
  },

  // ── OP 90 EMBALAJE ──
  {
    opNum: '90',
    matchName: 'Bolsas Plásticas',
    matchPartial: true,
    newType: 'Material',
    splitInto: [
      'Bolsas Plásticas',
      'Contenedor',
      'Etiqueta',
      'piezas Top Roll',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// EXECUTE SPLITS
// ═══════════════════════════════════════════════════════════════════

let totalOriginalRemoved = 0;
let totalNewCreated = 0;

for (const def of splitDefinitions) {
  const op = findOp(def.opNum);
  if (!op) {
    console.error(`ERROR: OP ${def.opNum} not found!`);
    process.exit(1);
  }

  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;

  // Find the grouped WE
  let weIdx = -1;
  for (let i = 0; i < (op.workElements || []).length; i++) {
    const we = op.workElements[i];
    const weName = (we.name || '').trim();
    if (def.matchPartial) {
      // Match if the WE name starts with the match string or contains it as a segment
      if (weName.includes(def.matchName)) {
        weIdx = i;
        break;
      }
    } else {
      if (weName === def.matchName) {
        weIdx = i;
        break;
      }
    }
  }

  if (weIdx === -1) {
    console.error(`ERROR: Could not find WE matching "${def.matchName}" in OP ${opNum} (${opName})`);
    console.log(`  Available WEs in OP ${opNum}:`);
    for (const we of (op.workElements || [])) {
      console.log(`    - "${we.name}" [${we.type}]`);
    }
    process.exit(1);
  }

  const originalWe = op.workElements[weIdx];
  const originalFunctions = originalWe.functions || [];
  const hasCauses = originalFunctions.some(fn =>
    (fn.failures || []).some(f => (f.causes || []).length > 0)
  );

  console.log(`\n--- OP ${opNum} ${opName} ---`);
  console.log(`  Splitting WE: "${originalWe.name}" [${originalWe.type}] -> ${def.splitInto.length} WEs [${def.newType}]`);
  console.log(`  Original has ${originalFunctions.length} functions, causes: ${hasCauses ? 'YES' : 'NO'}`);

  // Create new WEs
  const newWEs = [];
  for (const newName of def.splitInto) {
    const newWe = {
      id: randomUUID(),
      name: newName,
      type: def.newType,
      functions: cloneFunctionsWithNewIds(originalFunctions),
    };
    newWEs.push(newWe);
    console.log(`    + "${newWe.name}" [${newWe.type}] (${newWe.functions.length} functions cloned)`);
  }

  // Replace the original grouped WE with N new WEs at the same position
  op.workElements.splice(weIdx, 1, ...newWEs);

  totalOriginalRemoved += 1;
  totalNewCreated += newWEs.length;
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE cause_count IN METADATA
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== Updating cause_count in metadata ===');

let totalCauses = 0;
for (const op of data.operations) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        totalCauses += (fail.causes || []).length;
      }
    }
  }
}

if (!data.metadata) data.metadata = {};
const oldCauseCount = data.metadata.cause_count || 'N/A';
data.metadata.cause_count = totalCauses;
console.log(`  cause_count: ${oldCauseCount} -> ${totalCauses}`);

// ═══════════════════════════════════════════════════════════════════
// SAVE TO SUPABASE
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== Saving to Supabase ===');

// Save — pass object directly, NEVER JSON.stringify
const { error: updateErr } = await sb
  .from('amfe_documents')
  .update({ data: data })
  .eq('id', AMFE_ID);

if (updateErr) {
  console.error('ERROR saving:', updateErr.message);
  process.exit(1);
}
console.log('Saved to Supabase successfully.');

// ═══════════════════════════════════════════════════════════════════
// VERIFY
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== Verifying ===');

const { data: verifyDoc, error: verifyErr } = await sb
  .from('amfe_documents')
  .select('data')
  .eq('id', AMFE_ID)
  .single();

if (verifyErr) {
  console.error('ERROR verifying:', verifyErr.message);
  process.exit(1);
}

if (typeof verifyDoc.data === 'object') {
  console.log('VERIFIED: typeof data === "object"');
} else {
  console.error(`ERROR: typeof data === "${typeof verifyDoc.data}" — DOUBLE SERIALIZED!`);
  process.exit(1);
}

if (Array.isArray(verifyDoc.data.operations)) {
  console.log(`VERIFIED: data.operations is array with ${verifyDoc.data.operations.length} operations`);
} else {
  console.error('ERROR: data.operations is not an array!');
  process.exit(1);
}

// Save after state
writeFileSync(`${backupDir}/amfe_after.json`, JSON.stringify(data, null, 2));
console.log(`After-state saved to: ${backupDir}/amfe_after.json`);

// ═══════════════════════════════════════════════════════════════════
// FINAL SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log('\n=== FINAL SUMMARY ===');
console.log(`Grouped WEs removed: ${totalOriginalRemoved}`);
console.log(`Individual WEs created: ${totalNewCreated}`);
console.log(`Net WE change: +${totalNewCreated - totalOriginalRemoved}`);
console.log(`Total causes: ${totalCauses}`);
console.log('');

for (const op of data.operations) {
  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;
  const weCount = (op.workElements || []).length;
  console.log(`  OP ${opNum}: ${opName} (${weCount} WEs)`);
  for (const we of (op.workElements || [])) {
    const funcCount = (we.functions || []).length;
    let causeCount = 0;
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        causeCount += (fail.causes || []).length;
      }
    }
    console.log(`    WE: "${we.name}" [${we.type}] (${funcCount} fn, ${causeCount} causes)`);
  }
}

console.log('\nDone. Run `node scripts/_backup.mjs` next.');
process.exit(0);

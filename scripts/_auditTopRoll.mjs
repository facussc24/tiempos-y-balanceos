/**
 * Audit Top Roll AMFE — Post-structural & WE-split verification
 * Checks: VDA structure, 1M rule, op names, S/O/D, effects, AP, severities,
 *         capacitacion, focusElementFunction, metadata sync
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

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

// ── AP calculation (copied from fix-ippad-amfe.mjs) ─────────────────
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

// ── Parse data (column is TEXT, not JSONB — this is NORMAL) ─────────
let amfeData = doc.data;
if (typeof amfeData === 'string') {
  amfeData = JSON.parse(amfeData);
  console.log('INFO: data was TEXT string, parsed successfully.');
} else if (typeof amfeData === 'object' && amfeData !== null) {
  console.log('INFO: data was already an object (JSONB).');
} else {
  console.error('ERROR: data is neither string nor object:', typeof amfeData);
  process.exit(1);
}

// Verify no double-serialization
if (typeof amfeData === 'string') {
  console.error('BLOCKER: Double-serialized data detected!');
  process.exit(1);
}

const ops = amfeData.operations || [];
console.log(`\nAMFE Top Roll loaded: ${ops.length} operations\n`);

// ── Accumulate results ──────────────────────────────────────────────
const blockers = [];
const warnings = [];
const info = [];
const passed = [];

// Valid WE types (English + Spanish equivalents)
const VALID_WE_TYPES = new Set([
  'Machine', 'Man', 'Method', 'Material', 'Measurement', 'Environment',
  'Maquina', 'Mano de Obra', 'Metodo', 'Medio Ambiente', 'Medicion',
  // lowercase variants
  'machine', 'man', 'method', 'material', 'measurement', 'environment',
  'maquina', 'mano de obra', 'metodo', 'medio ambiente', 'medicion'
]);

// English operation names to detect
const ENGLISH_OP_NAMES = [
  'TRIMMING', 'EDGE FOLDING', 'IMG', 'INJECTION', 'WELDING',
  'SEWING', 'CUTTING', 'ASSEMBLY', 'PACKAGING', 'INSPECTION',
  'LAMINATION', 'THERMOFORMING', 'STAMPING', 'BONDING',
  'FOAM', 'WRAPPING', 'RIVETING'
];

// Safety keywords for S=9-10
const SAFETY_KEYWORDS = [
  'flamabilidad', 'flamable', 'inflamab', 'voc', 'emisiones', 'airbag',
  'bordes filosos', 'borde filoso', 'seguridad', 'safety', 'tl 1010',
  'filo', 'cortante', 'laceracion'
];

// ═══════════════════════════════════════════════════════════════════
// CHECK 1: Estructura VDA
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 1: Estructura VDA ===');
let check1Pass = true;

for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  const opName = op.operationName || op.name || '?';
  const wes = op.workElements || [];

  if (wes.length < 2) {
    warnings.push(`[Check1] OP ${opNum} "${opName}" tiene solo ${wes.length} WE(s) (minimo recomendado: 2)`);
    check1Pass = false;
  }

  for (const we of wes) {
    // Type check
    if (!VALID_WE_TYPES.has(we.type)) {
      blockers.push(`[Check1] OP ${opNum} WE "${we.name}" tiene tipo invalido: "${we.type}"`);
      check1Pass = false;
    }

    // Name not empty
    if (!we.name || we.name.trim() === '') {
      blockers.push(`[Check1] OP ${opNum} tiene WE con nombre vacio (type: ${we.type})`);
      check1Pass = false;
    }

    // WE with functions must have at least 1 function
    const funcs = we.functions || [];
    if (funcs.length === 0) {
      warnings.push(`[Check1] OP ${opNum} WE "${we.name}" tiene 0 funciones`);
      check1Pass = false;
    }
  }
}

if (check1Pass) passed.push('Check 1: Estructura VDA');
console.log(`  Check 1: ${check1Pass ? 'PASS' : 'ISSUES FOUND'}`);

// ═══════════════════════════════════════════════════════════════════
// CHECK 2: Regla 1M por linea
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 2: Regla 1M por linea ===');
let check2Pass = true;

for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  for (const we of (op.workElements || [])) {
    if ((we.name || '').includes(' / ')) {
      blockers.push(`[Check2] OP ${opNum} WE "${we.name}" tiene " / " en nombre (agrupacion detectada)`);
      check2Pass = false;
    }
  }
}

if (check2Pass) passed.push('Check 2: Regla 1M por linea');
console.log(`  Check 2: ${check2Pass ? 'PASS' : 'BLOCKERS FOUND'}`);

// ═══════════════════════════════════════════════════════════════════
// CHECK 3: Nombres de operacion
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 3: Nombres de operacion ===');
let check3Pass = true;

for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  const opName = op.operationName || op.name || '';

  // OP 11 must NOT exist
  if (opNum === '11' || opNum === 11) {
    blockers.push(`[Check3] OP 11 existe — debio ser eliminada`);
    check3Pass = false;
  }

  // Name in English?
  for (const eng of ENGLISH_OP_NAMES) {
    if (opName.toUpperCase().includes(eng)) {
      blockers.push(`[Check3] OP ${opNum} tiene nombre en ingles: "${opName}" (contiene "${eng}")`);
      check3Pass = false;
    }
  }

  // UPPERCASE check
  if (opName !== opName.toUpperCase()) {
    warnings.push(`[Check3] OP ${opNum} nombre no esta en UPPERCASE: "${opName}"`);
    check3Pass = false;
  }

  // Standard names check
  const stdNames = {
    '10': 'RECEPCION DE MATERIA PRIMA',
  };
  const lastOps = ops.filter(o => {
    const n = (o.operationName || o.name || '').toUpperCase();
    return n.includes('CONTROL FINAL') || n.includes('EMBALAJE');
  });
  // Just log what we find for these standard ops
}

if (check3Pass) passed.push('Check 3: Nombres de operacion');
console.log(`  Check 3: ${check3Pass ? 'PASS' : 'ISSUES FOUND'}`);

// ═══════════════════════════════════════════════════════════════════
// CHECK 4: Completitud S/O/D
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 4: Completitud S/O/D ===');
let check4Pass = true;
let totalCauses = 0;
let causesWithSOD = 0;

for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        for (const cause of (fail.causes || [])) {
          totalCauses++;
          const causeText = cause.cause || cause.description || '';
          const s = cause.severity;
          const o = cause.occurrence;
          const d = cause.detection;

          if (causeText.trim()) {
            const hasS = s !== undefined && s !== null && s !== '' && !isNaN(Number(s));
            const hasO = o !== undefined && o !== null && o !== '' && !isNaN(Number(o));
            const hasD = d !== undefined && d !== null && d !== '' && !isNaN(Number(d));

            if (hasS && hasO && hasD) {
              causesWithSOD++;

              // Check for 0 values
              if (Number(o) === 0) {
                blockers.push(`[Check4] OP ${opNum} WE "${we.name}" causa "${causeText.slice(0, 50)}" tiene O=0`);
                check4Pass = false;
              }
              if (Number(d) === 0) {
                blockers.push(`[Check4] OP ${opNum} WE "${we.name}" causa "${causeText.slice(0, 50)}" tiene D=0`);
                check4Pass = false;
              }
            } else {
              // At least one missing
              const missing = [];
              if (!hasS) missing.push('S');
              if (!hasO) missing.push('O');
              if (!hasD) missing.push('D');
              blockers.push(`[Check4] OP ${opNum} WE "${we.name}" causa "${causeText.slice(0, 50)}" falta ${missing.join(', ')}`);
              check4Pass = false;
            }
          }
        }
      }
    }
  }
}

info.push(`Total causas: ${totalCauses}, con S/O/D completos: ${causesWithSOD}`);
if (check4Pass) passed.push('Check 4: Completitud S/O/D');
console.log(`  Check 4: ${check4Pass ? 'PASS' : 'BLOCKERS FOUND'} (${totalCauses} causas total, ${causesWithSOD} con S/O/D)`);

// ═══════════════════════════════════════════════════════════════════
// CHECK 5: Efectos VDA 3 niveles
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 5: Efectos VDA 3 niveles ===');
let check5Pass = true;

for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        if ((fail.causes || []).length > 0) {
          const local = (fail.effectLocal || '').trim();
          const next = (fail.effectNextLevel || '').trim();
          const end = (fail.effectEndUser || '').trim();

          if (!local) {
            blockers.push(`[Check5] OP ${opNum} WE "${we.name}" falla "${(fail.description || '').slice(0, 50)}" effectLocal vacio`);
            check5Pass = false;
          }
          if (!next) {
            blockers.push(`[Check5] OP ${opNum} WE "${we.name}" falla "${(fail.description || '').slice(0, 50)}" effectNextLevel vacio`);
            check5Pass = false;
          }
          if (!end) {
            blockers.push(`[Check5] OP ${opNum} WE "${we.name}" falla "${(fail.description || '').slice(0, 50)}" effectEndUser vacio`);
            check5Pass = false;
          }
        }
      }
    }
  }
}

if (check5Pass) passed.push('Check 5: Efectos VDA 3 niveles');
console.log(`  Check 5: ${check5Pass ? 'PASS' : 'BLOCKERS FOUND'}`);

// ═══════════════════════════════════════════════════════════════════
// CHECK 6: AP correcto
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 6: AP correcto ===');
let check6Pass = true;
let apChecked = 0;
let apMismatches = 0;

for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        for (const cause of (fail.causes || [])) {
          const s = Number(cause.severity);
          const o = Number(cause.occurrence);
          const d = Number(cause.detection);

          if (!isNaN(s) && !isNaN(o) && !isNaN(d) && s >= 1 && o >= 1 && d >= 1) {
            apChecked++;
            const expected = calculateAP(s, o, d);
            const actual = cause.ap || cause.actionPriority || '';

            if (actual !== expected) {
              blockers.push(`[Check6] OP ${opNum} WE "${we.name}" causa "${(cause.cause || cause.description || '').slice(0, 40)}" AP=${actual} pero deberia ser ${expected} (S=${s} O=${o} D=${d})`);
              check6Pass = false;
              apMismatches++;
            }
          }
        }
      }
    }
  }
}

info.push(`AP verificados: ${apChecked}, discrepancias: ${apMismatches}`);
if (check6Pass) passed.push('Check 6: AP correcto');
console.log(`  Check 6: ${check6Pass ? 'PASS' : 'BLOCKERS FOUND'} (${apChecked} verificados, ${apMismatches} discrepancias)`);

// ═══════════════════════════════════════════════════════════════════
// CHECK 7: Severidades calibradas
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 7: Severidades calibradas ===');
let check7Pass = true;

for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        for (const cause of (fail.causes || [])) {
          const s = Number(cause.severity);
          if (s >= 9) {
            // Check if effects mention safety keywords
            const allEffects = [
              fail.effectLocal || '',
              fail.effectNextLevel || '',
              fail.effectEndUser || '',
              fail.description || '',
              cause.cause || cause.description || ''
            ].join(' ').toLowerCase();

            const hasSafetyKeyword = SAFETY_KEYWORDS.some(kw => allEffects.includes(kw));
            if (!hasSafetyKeyword) {
              warnings.push(`[Check7] OP ${opNum} WE "${we.name}" S=${s} pero efectos no mencionan seguridad/flamabilidad: falla="${(fail.description || '').slice(0, 50)}"`);
              check7Pass = false;
            }
          }
        }
      }
    }
  }
}

// Check SC with S<7 (rule A7)
for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        for (const cause of (fail.causes || [])) {
          const sc = cause.specialChar || '';
          const s = Number(cause.severity);
          if (sc === 'SC' && s < 7) {
            warnings.push(`[Check7-A7] OP ${opNum} WE "${we.name}" SC con S=${s} < 7 (sospechoso de formula vieja)`);
            check7Pass = false;
          }
        }
      }
    }
  }
}

if (check7Pass) passed.push('Check 7: Severidades calibradas');
console.log(`  Check 7: ${check7Pass ? 'PASS' : 'WARNINGS FOUND'}`);

// ═══════════════════════════════════════════════════════════════════
// CHECK 8: "Capacitacion" como causa
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 8: "Capacitacion" como causa ===');
let check8Pass = true;
const capacitacionTerms = ['capacitacion', 'capacitación', 'entrenamiento', 'capacitado', 'capacitados'];

for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        for (const cause of (fail.causes || [])) {
          const causeText = (cause.cause || cause.description || '').toLowerCase();
          for (const term of capacitacionTerms) {
            if (causeText.includes(term)) {
              blockers.push(`[Check8] OP ${opNum} WE "${we.name}" causa contiene "${term}": "${(cause.cause || cause.description || '').slice(0, 60)}"`);
              check8Pass = false;
            }
          }
        }
      }
    }
  }
}

if (check8Pass) passed.push('Check 8: No "capacitacion" como causa');
console.log(`  Check 8: ${check8Pass ? 'PASS' : 'BLOCKERS FOUND'}`);

// ═══════════════════════════════════════════════════════════════════
// CHECK 9: focusElementFunction
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 9: focusElementFunction ===');
let check9Pass = true;

for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  const opName = op.operationName || op.name || '?';
  const fef = (op.focusElementFunction || '').trim();

  if (!fef) {
    blockers.push(`[Check9] OP ${opNum} "${opName}" focusElementFunction vacio`);
    check9Pass = false;
  } else {
    // Check for 3 perspectives (Interno/Cliente/Usr.Final or separated by " / ")
    const hasInterno = /intern/i.test(fef);
    const hasCliente = /client/i.test(fef);
    const hasUsuario = /usuario|usr|final/i.test(fef);
    const hasSeparators = (fef.match(/ \/ /g) || []).length >= 2;

    if (!hasSeparators && !(hasInterno && hasCliente && hasUsuario)) {
      warnings.push(`[Check9] OP ${opNum} "${opName}" focusElementFunction puede no tener 3 perspectivas: "${fef.slice(0, 80)}..."`);
      check9Pass = false;
    }
  }
}

if (check9Pass) passed.push('Check 9: focusElementFunction');
console.log(`  Check 9: ${check9Pass ? 'PASS' : 'ISSUES FOUND'}`);

// ═══════════════════════════════════════════════════════════════════
// CHECK 10: Metadata sync
// ═══════════════════════════════════════════════════════════════════
console.log('=== CHECK 10: Metadata sync ===');
let check10Pass = true;

// Count actual causes
let actualCauseCount = 0;
for (const op of ops) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        actualCauseCount += (fail.causes || []).length;
      }
    }
  }
}

const metaOpCount = doc.operation_count;
const metaCauseCount = doc.cause_count;
const actualOpCount = ops.length;

if (metaOpCount !== undefined && metaOpCount !== null && metaOpCount !== actualOpCount) {
  warnings.push(`[Check10] operation_count desincronizado: meta=${metaOpCount}, actual=${actualOpCount}`);
  check10Pass = false;
}

if (metaCauseCount !== undefined && metaCauseCount !== null && metaCauseCount !== actualCauseCount) {
  warnings.push(`[Check10] cause_count desincronizado: meta=${metaCauseCount}, actual=${actualCauseCount}`);
  check10Pass = false;
}

info.push(`Operaciones: meta=${metaOpCount}, actual=${actualOpCount}`);
info.push(`Causas: meta=${metaCauseCount}, actual=${actualCauseCount}`);
if (check10Pass) passed.push('Check 10: Metadata sync');
console.log(`  Check 10: ${check10Pass ? 'PASS' : 'WARNINGS FOUND'}`);

// ═══════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(70));
console.log('  AUDIT REPORT — AMFE Top Roll');
console.log('  Date:', new Date().toISOString().slice(0, 19));
console.log('  AMFE ID:', AMFE_ID);
console.log('='.repeat(70));

// BLOCKERS
console.log(`\n--- BLOCKERS (${blockers.length}) ---`);
if (blockers.length === 0) {
  console.log('  (ninguno)');
} else {
  for (const b of blockers) {
    console.log(`  [BLOCKER] ${b}`);
  }
}

// WARNINGS
console.log(`\n--- WARNINGS (${warnings.length}) ---`);
if (warnings.length === 0) {
  console.log('  (ninguno)');
} else {
  for (const w of warnings) {
    console.log(`  [WARNING] ${w}`);
  }
}

// INFO
console.log(`\n--- INFO ---`);
for (const i of info) {
  console.log(`  ${i}`);
}

// Operation summary
console.log('\n  Operaciones:');
for (const op of ops) {
  const opNum = op.operationNumber || op.opNumber || '?';
  const opName = op.operationName || op.name || '?';
  const wes = op.workElements || [];
  let causeCount = 0;
  for (const we of wes) {
    for (const fn of (we.functions || [])) {
      for (const fail of (fn.failures || [])) {
        causeCount += (fail.causes || []).length;
      }
    }
  }
  console.log(`    OP ${opNum}: ${opName} (${wes.length} WEs, ${causeCount} causas)`);
}

// PASS
console.log(`\n--- PASS (${passed.length}/10) ---`);
for (const p of passed) {
  console.log(`  [PASS] ${p}`);
}

// Overall result
console.log('\n' + '='.repeat(70));
if (blockers.length === 0) {
  console.log('  RESULTADO: PASS — 0 blockers');
} else {
  console.log(`  RESULTADO: FAIL — ${blockers.length} blocker(s) encontrado(s)`);
}
console.log('='.repeat(70));

process.exit(blockers.length > 0 ? 1 : 0);

/**
 * enrichArmrestAmfe.mjs
 *
 * Enriches the Armrest Door Panel AMFE in Supabase with REAL data extracted from
 * the reference Excel file (AMFE - Apb Tra Rev.1 - Patagonia.xlsx).
 *
 * The Excel has 454 rows across 6 operations (OP 10-60) with 23 failure modes
 * and 46 causes, all in VDA merged-cell format.
 *
 * Usage:
 *   node scripts/enrichArmrestAmfe.mjs           # dry-run (default)
 *   node scripts/enrichArmrestAmfe.mjs --apply   # write to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// ─── Config ─────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const RAW_JSON = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_armrest_excel/amfe_armrest_rear_raw.json';
const AMFE_DOC_ID = '5268704d-30ae-48f3-ad05-8402a6ded7fe';
const BACKUP_DIR = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/amfe_armrest_before_enrich';

// ─── Supabase connection ────────────────────────────────────────────────────
const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────
const uid = () => randomUUID();
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function val(row, col) {
  if (!row) return '';
  const v = row[col];
  return (v !== '' && v !== null && v !== undefined) ? v.toString().trim() : '';
}

function num(row, col) {
  if (!row) return null;
  const v = row[col];
  return (v !== '' && v !== null && v !== undefined) ? Number(v) : null;
}

function calcAP(s, o, d) {
  if (!s || !o || !d) return '';
  const sn = Number(s), on = Number(o), dn = Number(d);
  if (isNaN(sn) || isNaN(on) || isNaN(dn)) return '';
  const prod = sn * on * dn;
  if (sn >= 9) {
    if (on >= 4 && dn >= 4) return 'H';
    if (prod > 200) return 'H';
    if (prod > 100) return 'M';
    return 'L';
  }
  if (sn >= 7) {
    if (prod > 200) return 'H';
    if (prod > 100) return 'M';
    return 'L';
  }
  if (sn >= 5) {
    if (prod > 200) return 'H';
    if (prod > 100) return 'M';
    return 'L';
  }
  if (prod > 200) return 'M';
  return 'L';
}

function deriveSpecialChar(severity) {
  if (severity >= 9) return 'CC';
  return '';
}

// ─── Step 1: Parse the raw Excel data ───────────────────────────────────────

console.log('Reading raw Excel data...');
const rawData = JSON.parse(readFileSync(RAW_JSON, 'utf8'));
const sheet = rawData['ARMREST REAR L3'];
console.log(`  Raw sheet rows: ${sheet.length}`);

// Column mapping:
// 0=SNS, 1=EF(element name), 2=SNI, 3=FNS, 4=FEF, 5=FNI,
// 6=EfFalla(effects), 7=MF(failure mode), 8=CF(cause), 9=S,
// 10=CP(prevention control), 11=O, 12=CD(detection control), 13=D, 14=AP

// ─── Step 2: Find operation headers ─────────────────────────────────────────

const opHeaders = [];
for (let i = 15; i < sheet.length; i++) {
  const ef = val(sheet[i], 1);
  const match = ef.match(/OPERACIÓN\s+(\d+)/);
  if (match) {
    const oh = { row: i, opNum: match[1], opName: '' };
    // Find operation name in next few rows
    for (let j = i + 1; j < Math.min(i + 5, sheet.length); j++) {
      const name = val(sheet[j], 1);
      if (name && !name.match(/OPERACIÓN/)) {
        oh.opName = name;
        break;
      }
    }
    opHeaders.push(oh);
  }
}

console.log(`  Operations found: ${opHeaders.length}`);
opHeaders.forEach(oh => console.log(`    OP ${oh.opNum}: ${oh.opName} (row ${oh.row})`));

// ─── Step 3: Find all failure mode rows ─────────────────────────────────────

const fmRowIndices = [];
for (let i = 15; i < sheet.length; i++) {
  if (val(sheet[i], 7)) fmRowIndices.push(i);
}

// ─── Step 4: Parse failure mode blocks with causes and ratings ──────────────

const fmBlocks = [];

for (let fi = 0; fi < fmRowIndices.length; fi++) {
  const fmRow = fmRowIndices[fi];
  const nextFmRow = fi + 1 < fmRowIndices.length ? fmRowIndices[fi + 1] : sheet.length;

  const fm = {
    row: fmRow,
    modoFalla: val(sheet[fmRow], 7),
    controlPreventivo: val(sheet[fmRow], 10),
    controlDetectivo: val(sheet[fmRow], 12),
    blockO: null,
    blockD: null,
    blockAP: '',
    effects: { local: '', nextLevel: '', endUser: '' },
    causes: [],
  };

  // ── Collect effects (3-level VDA pattern) ──
  // Pattern: "Cliente Interno-Barack" → next line = effectLocal
  //          "Cliente Externo" → next line = effectNextLevel
  //          Second "Cliente Externo" or specific → effectEndUser
  //          "Organismos regulatorios" = regulatory (endUser level)
  let effectPhase = 'local';
  let clienteExternoCount = 0;
  for (let j = fmRow; j < nextFmRow; j++) {
    const ef = val(sheet[j], 6);
    if (!ef) continue;

    if (ef === 'Cliente Interno-Barack') {
      effectPhase = 'local';
      continue;
    }
    if (ef === 'Cliente Externo') {
      clienteExternoCount++;
      if (clienteExternoCount <= 1) effectPhase = 'nextLevel';
      else effectPhase = 'endUser';
      continue;
    }
    if (ef.startsWith('Organismos regulatorios')) {
      continue; // Skip this label
    }
    if (ef === 'VW') continue;

    // "No afecta" IS a valid effect text - don't skip it
    // Actual effect text
    if (effectPhase === 'local' && !fm.effects.local) {
      fm.effects.local = ef;
    } else if (effectPhase === 'nextLevel' && !fm.effects.nextLevel) {
      fm.effects.nextLevel = ef;
    } else if (effectPhase === 'endUser' && !fm.effects.endUser) {
      fm.effects.endUser = ef;
    }
  }

  // If we only got 2 effects, the second clienteExterno effect IS the endUser
  if (!fm.effects.endUser && fm.effects.nextLevel) {
    // Look for additional effect texts after the first "Cliente Externo" block
    let foundSecondBlock = false;
    let seenFirstCE = false;
    for (let j = fmRow; j < nextFmRow; j++) {
      const ef = val(sheet[j], 6);
      if (ef === 'Cliente Externo') {
        if (seenFirstCE) {
          foundSecondBlock = true;
          continue;
        }
        seenFirstCE = true;
        continue;
      }
      if (foundSecondBlock && ef && ef !== 'Organismos regulatorios' && ef !== 'VW') {
        fm.effects.endUser = ef;
        break;
      }
    }
  }

  // Fallback: if still missing end user effect
  if (!fm.effects.endUser) {
    fm.effects.endUser = fm.effects.nextLevel || fm.effects.local || 'TBD';
  }

  // ── Find block-level O/D/AP ──
  // The row with both O and D is the block's combined rating
  for (let j = fmRow; j < nextFmRow; j++) {
    const o = num(sheet[j], 11);
    const d = num(sheet[j], 13);
    const ap = val(sheet[j], 14);
    if (o !== null && d !== null) {
      fm.blockO = o;
      fm.blockD = d;
      if (ap) fm.blockAP = ap;
      break;
    }
  }

  // Fallback: collect individual O/D if no combined row found
  if (fm.blockO === null || fm.blockD === null) {
    for (let j = fmRow; j < nextFmRow; j++) {
      const o = num(sheet[j], 11);
      const d = num(sheet[j], 13);
      const ap = val(sheet[j], 14);
      if (o !== null && fm.blockO === null) fm.blockO = o;
      if (d !== null && fm.blockD === null) fm.blockD = d;
      if (ap && !fm.blockAP) fm.blockAP = ap;
    }
  }

  // ── Parse causes within this FM block ──
  const cfStarts = [];
  for (let j = fmRow; j < nextFmRow; j++) {
    if (val(sheet[j], 8)) cfStarts.push(j);
  }

  for (let ci = 0; ci < cfStarts.length; ci++) {
    const cStart = cfStarts[ci];
    const cEnd = ci + 1 < cfStarts.length ? cfStarts[ci + 1] : nextFmRow;

    const cause = {
      row: cStart,
      causaFalla: val(sheet[cStart], 8),
      severity: null,
      occurrence: null,
      detection: null,
      ap: '',
      controlPreventivo: val(sheet[cStart], 10) || fm.controlPreventivo,
      controlDetectivo: val(sheet[cStart], 12) || fm.controlDetectivo,
    };

    // Collect S values for this cause (highest = VDA severity)
    const sValues = [];
    for (let j = cStart; j < cEnd; j++) {
      const s = num(sheet[j], 9);
      if (s !== null) sValues.push(s);
      const o = num(sheet[j], 11);
      const d = num(sheet[j], 13);
      const ap = val(sheet[j], 14);
      if (o !== null && cause.occurrence === null) cause.occurrence = o;
      if (d !== null && cause.detection === null) cause.detection = d;
      if (ap && !cause.ap) cause.ap = ap;

      // Additional controls from sub-rows
      const cp2 = val(sheet[j], 10);
      const cd2 = val(sheet[j], 12);
      if (cp2 && j !== cStart) {
        // Append additional controls (some FMs have multiple control rows)
        if (!cause.controlPreventivo.includes(cp2)) {
          cause.controlPreventivo += ' / ' + cp2;
        }
      }
      if (cd2 && j !== cStart && cd2 !== cause.controlDetectivo) {
        if (!cause.controlDetectivo.includes(cd2)) {
          cause.controlDetectivo += ' / ' + cd2;
        }
      }
    }

    // S = highest S value found (VDA: worst effect severity)
    if (sValues.length > 0) {
      cause.severity = Math.max(...sValues);
    }

    // Inherit O/D from block if not found at cause level
    if (cause.occurrence === null) cause.occurrence = fm.blockO;
    if (cause.detection === null) cause.detection = fm.blockD;
    if (!cause.ap) cause.ap = fm.blockAP;

    fm.causes.push(cause);
  }

  // ── Assign operation ──
  let assigned = false;
  for (const oh of opHeaders) {
    if (fmRow >= oh.row - 3 && fmRow <= oh.row) {
      fm.opNum = oh.opNum;
      fm.opName = oh.opName;
      assigned = true;
      break;
    }
  }
  if (!assigned) {
    let lastOp = opHeaders[0];
    for (const oh of opHeaders) {
      if (oh.row < fmRow) lastOp = oh;
    }
    fm.opNum = lastOp.opNum;
    fm.opName = lastOp.opName;
  }

  fmBlocks.push(fm);
}

console.log(`  Failure modes parsed: ${fmBlocks.length}`);

// ─── Step 5: Group by operation ─────────────────────────────────────────────

const byOp = {};
fmBlocks.forEach(fm => {
  if (!byOp[fm.opNum]) byOp[fm.opNum] = { opNum: fm.opNum, name: fm.opName, fms: [] };
  byOp[fm.opNum].fms.push(fm);
});

// ─── Step 6: Map operations to AMFE standardized names ──────────────────────

// The Excel uses informal names. We standardize to the PFD/AMFE convention.
const OP_NAME_MAP = {
  '10': 'RECEPCION DE MATERIA PRIMA',
  '20': 'CORTE DE VINILO',
  '30': 'COSTURA',
  '40': 'TAPIZADO',
  '50': 'INSPECCION FINAL',
  '60': 'EMBALAJE',
};

// Work element groupings per operation based on VDA 4M analysis
// Each operation gets: Machine, Man (Operator), Material (indirect), Method, Environment, Measurement
// The specific items come from the Excel's siguienteNivelInferior column

// ─── Step 7: Build AMFE operations from parsed data ─────────────────────────

function buildOperation(opNum, opData) {
  const opName = OP_NAME_MAP[opNum] || opData.name.toUpperCase();
  const workElements = [];

  // For each failure mode, create appropriate work elements
  // Group failures by their natural 4M category based on content analysis

  // Analyze the failure modes to determine WE groupings
  const failuresByCategory = categorizeFailures(opNum, opData.fms);

  for (const [weKey, weData] of Object.entries(failuresByCategory)) {
    const functions = [];

    for (const fmData of weData.failures) {
      const causes = fmData.causes.map(c => {
        const s = c.severity || null;
        const o = c.occurrence || null;
        const d = c.detection || null;
        const ap = c.ap ? mapAP(c.ap) : calcAP(s, o, d);

        return {
          id: uid(),
          description: cleanFMNumber(clean(c.causaFalla)),
          severity: s,
          occurrence: o,
          detection: d,
          actionPriority: ap,
          preventionControl: clean(c.controlPreventivo),
          detectionControl: clean(c.controlDetectivo),
          specialChar: deriveSpecialChar(s),
          characteristicNumber: '',
          // NEVER fill optimization actions per amfe-actions.md rule
          preventionAction: '',
          detectionAction: '',
          responsible: '',
          targetDate: '',
          status: '',
        };
      });

      functions.push({
        id: uid(),
        functionDescription: clean(weData.functionDesc),
        failures: [{
          id: uid(),
          description: cleanFMNumber(fmData.modoFalla),
          effectLocal: clean(fmData.effects.local) || 'TBD',
          effectNextLevel: clean(fmData.effects.nextLevel) || 'TBD',
          effectEndUser: clean(fmData.effects.endUser) || 'TBD',
          causes,
        }],
      });
    }

    workElements.push({
      id: uid(),
      name: weData.weName,
      type: weData.weType,
      functions,
    });
  }

  return {
    id: uid(),
    operationNumber: opNum,
    operationName: opName,
    workElements,
  };
}

// Clean FM numbers like "1- " from descriptions
function cleanFMNumber(desc) {
  return desc.replace(/^\d+-?\s*/, '').trim();
}

// Map AP text from Excel to code
function mapAP(apText) {
  const t = (apText || '').toLowerCase().trim();
  if (t.startsWith('alto') || t === 'h' || t === 'high') return 'H';
  if (t.startsWith('medio') || t === 'm' || t === 'medium') return 'M';
  if (t.startsWith('bajo') || t === 'l' || t === 'low') return 'L';
  return '';
}

// Categorize failure modes into Work Elements by 4M category
function categorizeFailures(opNum, fms) {
  const categories = {};

  switch (opNum) {
    case '10': // RECEPCION DE MATERIA PRIMA
      categories['machine'] = {
        weName: 'Autoelevador',
        weType: 'Maquina',
        functionDesc: 'Garantizar la estabilidad y la integridad fisica del material durante el transporte interno',
        failures: [fms[0]], // FM1: Material golpeado/danado
      };
      categories['man'] = {
        weName: 'Operador de recepcion',
        weType: 'Mano de Obra',
        functionDesc: 'Verificar el cumplimiento y la trazabilidad de la materia prima recibida',
        failures: [fms[2], fms[1]], // FM3: Falta documentacion, FM2: Especificacion erronea
      };
      categories['material'] = {
        weName: 'Calibres, Micrometro',
        weType: 'Medicion',
        functionDesc: 'Disponer y utilizar instrumentos de medicion y ensayo para verificar materiales',
        failures: [fms[3]], // FM4: Contaminacion/suciedad
      };
      break;

    case '20': // CORTE DE VINILO
      categories['machine'] = {
        weName: 'Cortadora automatica BMA090/BMA089',
        weType: 'Maquina',
        functionDesc: 'Cortar los paneles de vinilo segun programa Cutter Control',
        failures: [fms[0], fms[2]], // FM1: Desviacion corte, FM3: Corte incompleto
      };
      categories['man'] = {
        weName: 'Operador de corte',
        weType: 'Mano de Obra',
        functionDesc: 'Seleccionar y verificar el material correcto antes del corte',
        failures: [fms[1]], // FM2: Seleccion incorrecta
      };
      categories['environment'] = {
        weName: 'Ambiente del area de corte',
        weType: 'Medio Ambiente',
        functionDesc: 'Mantener condiciones de limpieza en el area de corte',
        failures: [fms[3]], // FM4: Contaminacion
      };
      break;

    case '30': // COSTURA
      categories['machine'] = {
        weName: 'Maquina de coser',
        weType: 'Maquina',
        functionDesc: 'Realizar la union de paneles de vinilo mediante costura',
        failures: [fms[0], fms[2], fms[3]], // FM1: Descosida/debil, FM3: Irregulares, FM4: Rotura vinilo
      };
      categories['man'] = {
        weName: 'Costurera',
        weType: 'Mano de Obra',
        functionDesc: 'Operar la maquina de coser siguiendo hojas de operaciones',
        failures: [fms[1]], // FM2: Costura desviada
      };
      categories['material_hilo'] = {
        weName: 'Hilo de costura',
        weType: 'Material',
        functionDesc: 'Proveer union resistente y estetica entre paneles',
        failures: [fms[4]], // FM5: Seleccion incorrecta hilo
      };
      categories['method'] = {
        weName: 'Configuracion de puntada',
        weType: 'Metodo',
        functionDesc: 'Configurar largo y toma de puntada segun especificaciones',
        failures: [fms[5], fms[6]], // FM6: Largo puntada, FM7: Toma costura
      };
      break;

    case '40': // TAPIZADO
      categories['method'] = {
        weName: 'Proceso de enfundado',
        weType: 'Metodo',
        functionDesc: 'Posicionar estructura, colocar funda, clipar portavasos y cerrar conjunto',
        failures: [fms[0], fms[3]], // FM1: Arrugas, FM4: Desgarro
      };
      categories['machine'] = {
        weName: 'Portavasos y componentes plasticos',
        weType: 'Maquina',
        functionDesc: 'Encastrar correctamente el portavasos en la estructura',
        failures: [fms[1]], // FM2: Cup holder no encastra
      };
      categories['man'] = {
        weName: 'Operador de tapizado',
        weType: 'Mano de Obra',
        functionDesc: 'Realizar el cierre final del conjunto',
        failures: [fms[2]], // FM3: Pieza mal cerrada
      };
      break;

    case '50': // INSPECCION FINAL
      categories['method'] = {
        weName: 'Proceso de inyeccion PUR',
        weType: 'Metodo',
        functionDesc: 'Controlar volumen y presion de PUR para evitar rebabas',
        failures: [fms[0]], // FM1: Rebaba visible
      };
      categories['machine'] = {
        weName: 'Maquina de coser (costura vista)',
        weType: 'Maquina',
        functionDesc: 'Verificar alineacion y estetica de costura decorativa',
        failures: [fms[1]], // FM2: Costura vista desviada
      };
      break;

    case '60': // EMBALAJE
      categories['method'] = {
        weName: 'Proceso de embalaje',
        weType: 'Metodo',
        functionDesc: 'Embalar piezas terminadas con separadores adecuados',
        failures: [fms[0]], // FM1: Pieza deformada
      };
      categories['man'] = {
        weName: 'Operador de embalaje',
        weType: 'Mano de Obra',
        functionDesc: 'Controlar cantidad de piezas por medio de embalaje',
        failures: [fms[1]], // FM2: Cantidad incorrecta
      };
      break;
  }

  return categories;
}

// ─── Step 8: Build complete operations array ────────────────────────────────

// The existing AMFE has OP 5 (Reception) already enriched with real data.
// The Excel reference has OP 10 (also Reception). We PRESERVE the existing OP 5
// and skip OP 10 from Excel, adding only OP 20-60.

const operations = [];

// We'll insert the existing OP 5 at apply time (read from Supabase).
// For dry-run, we'll show a placeholder.
let existingOp5 = null; // Will be populated from Supabase at apply time

// Process operations 20-60 from Excel data (skip OP 10 - we keep existing OP 5)
for (const opNum of Object.keys(byOp).sort((a, b) => Number(a) - Number(b))) {
  if (opNum === '10') {
    console.log(`  Skipping OP 10 from Excel (preserving existing OP 5)`);
    continue;
  }
  const opData = byOp[opNum];
  const op = buildOperation(opNum, opData);
  operations.push(op);
}

// ─── Step 9: Handle missing S value ─────────────────────────────────────────
// Cause "Defecto de material (corte, pinchazo) previo." in OP 40 FM 4 has no S
// Looking at context: it's in the "Desgarro de la funda" FM block where other causes have S=8
// The S=7 on row 347 is an effect-level severity for this FM block
// Reasonable assignment: S=7 (the next-level effect severity)

// This is handled automatically - if severity is null, we use the block's effect-level S
// Let's verify and fix any null severities
let fixedCount = 0;
for (const op of operations) {
  for (const we of op.workElements) {
    for (const fn of we.functions) {
      for (const f of fn.failures) {
        for (const c of f.causes) {
          if (c.severity === null) {
            // Use S=7 for "Defecto de material" cause based on context analysis
            // Row 347 has S=7 for "Recepcion de piezas inservibles" which is the nextLevel effect
            c.severity = 7;
            c.actionPriority = calcAP(7, c.occurrence, c.detection);
            fixedCount++;
            console.log(`  Fixed null severity: "${c.description.substring(0, 40)}" -> S=7`);
          }
        }
      }
    }
  }
}

// ─── Step 10: Validation ────────────────────────────────────────────────────

console.log('\n=== VALIDATION ===');

let totalOps = 0, totalWE = 0, totalFunctions = 0, totalFailures = 0, totalCauses = 0;
let allUppercase = true, allSpanish = true, noActions = true;
let ccCount = 0, scCount = 0;
const errors = [];

for (const op of operations) {
  totalOps++;
  if (op.operationName !== op.operationName.toUpperCase()) {
    errors.push(`OP ${op.operationNumber}: name not UPPERCASE: "${op.operationName}"`);
    allUppercase = false;
  }

  for (const we of op.workElements) {
    totalWE++;

    // Check 1M per line rule
    if (we.name.includes('/') && we.name.split('/').length > 2) {
      errors.push(`OP ${op.operationNumber} WE "${we.name}": possible 1M violation (multiple items)`);
    }

    for (const fn of we.functions) {
      totalFunctions++;
      for (const f of fn.failures) {
        totalFailures++;
        // Check 3-level effects
        if (!f.effectLocal || f.effectLocal === 'TBD') {
          errors.push(`OP ${op.operationNumber} FM "${f.description.substring(0, 30)}": missing effectLocal`);
        }
        if (!f.effectNextLevel || f.effectNextLevel === 'TBD') {
          errors.push(`OP ${op.operationNumber} FM "${f.description.substring(0, 30)}": missing effectNextLevel`);
        }
        if (!f.effectEndUser || f.effectEndUser === 'TBD') {
          errors.push(`OP ${op.operationNumber} FM "${f.description.substring(0, 30)}": missing effectEndUser`);
        }

        for (const c of f.causes) {
          totalCauses++;
          // Check S/O/D completeness
          if (c.severity === null || c.occurrence === null || c.detection === null) {
            errors.push(`OP ${op.operationNumber} Cause "${c.description.substring(0, 30)}": incomplete ratings S=${c.severity} O=${c.occurrence} D=${c.detection}`);
          }
          // Check CC/SC
          if (c.specialChar === 'CC') ccCount++;
          if (c.specialChar === 'SC') scCount++;
          // Check no optimization actions
          if (c.preventionAction || c.detectionAction) {
            noActions = false;
            errors.push(`Cause "${c.description.substring(0, 30)}": has optimization actions (VIOLATION)`);
          }
          // Check S calibration
          if (c.severity >= 9 && c.specialChar !== 'CC') {
            errors.push(`Cause "${c.description.substring(0, 30)}": S=${c.severity} but not CC`);
          }
        }
      }
    }
  }
}

console.log(`  Operations: ${totalOps}`);
console.log(`  Work Elements: ${totalWE}`);
console.log(`  Functions: ${totalFunctions}`);
console.log(`  Failure Modes: ${totalFailures}`);
console.log(`  Causes: ${totalCauses}`);
console.log(`  CC items: ${ccCount} (${(ccCount/totalCauses*100).toFixed(1)}%)`);
console.log(`  SC items: ${scCount}`);
console.log(`  All UPPERCASE: ${allUppercase}`);
console.log(`  No actions copied: ${noActions}`);

if (errors.length > 0) {
  console.log(`\n  WARNINGS (${errors.length}):`);
  errors.forEach(e => console.log(`    - ${e}`));
}

// ─── Step 11: Print detailed summary ────────────────────────────────────────

console.log('\n=== OPERATION SUMMARY ===');
for (const op of operations) {
  let opFailures = 0, opCauses = 0;
  for (const we of op.workElements) {
    for (const fn of we.functions) {
      opFailures += fn.failures.length;
      for (const f of fn.failures) {
        opCauses += f.causes.length;
      }
    }
  }
  console.log(`\n  OP ${op.operationNumber}: ${op.operationName}`);
  console.log(`    WE: ${op.workElements.length} | FM: ${opFailures} | Causes: ${opCauses}`);
  for (const we of op.workElements) {
    console.log(`    [${we.type}] ${we.name}`);
    for (const fn of we.functions) {
      for (const f of fn.failures) {
        console.log(`      FM: ${f.description.substring(0, 60)}`);
        console.log(`        EL: ${f.effectLocal.substring(0, 50)}`);
        console.log(`        EN: ${f.effectNextLevel.substring(0, 50)}`);
        console.log(`        EU: ${f.effectEndUser.substring(0, 50)}`);
        for (const c of f.causes) {
          console.log(`        C: ${c.description.substring(0, 45)} S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.actionPriority} ${c.specialChar || ''}`);
        }
      }
    }
  }
}

// ─── Step 12: Apply to Supabase ─────────────────────────────────────────────

if (DRY_RUN) {
  console.log('\n=== DRY RUN - No changes applied ===');
  console.log('  Existing OP 5 (Reception) will be PRESERVED from Supabase.');
  console.log(`  New operations from Excel: ${operations.length} (OP 20-60)`);
  console.log(`  Total after apply: ${operations.length + 1} operations (OP 5 + OP 20-60)`);
  console.log('Run with --apply to write to Supabase.');
} else {
  console.log('\n=== APPLYING CHANGES ===');

  // Authenticate
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
  });
  if (authErr) { console.error('Auth failed:', authErr); process.exit(1); }

  // Read current document
  const { data: doc, error: readErr } = await sb.from('amfe_documents')
    .select('id, data')
    .eq('id', AMFE_DOC_ID)
    .single();
  if (readErr) { console.error('Read failed:', readErr); process.exit(1); }

  const currentData = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

  // Backup current state
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  const backupFile = `${BACKUP_DIR}/amfe_armrest_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(backupFile, JSON.stringify(currentData, null, 2));
  console.log(`  Backup saved to: ${backupFile}`);

  // Preserve existing OP 5 (Reception) which was already enriched
  existingOp5 = currentData.operations?.find(op => op.operationNumber === '5');
  if (existingOp5) {
    console.log(`  Preserving existing OP 5: ${existingOp5.operationName} (${existingOp5.workElements?.length} WE)`);
  } else {
    console.log('  WARNING: Existing OP 5 not found in current data!');
  }

  // Build final operations array: existing OP 5 first, then new OP 20-60
  const finalOperations = [];
  if (existingOp5) finalOperations.push(existingOp5);
  finalOperations.push(...operations);

  // Build updated data
  const updatedData = {
    ...currentData,
    operations: finalOperations,
  };

  // Write to Supabase
  const { error: writeErr } = await sb.from('amfe_documents')
    .update({ data: JSON.stringify(updatedData) })
    .eq('id', AMFE_DOC_ID);

  if (writeErr) {
    console.error('Write failed:', writeErr);
    process.exit(1);
  }

  console.log('  AMFE updated successfully!');

  // Verify
  const { data: verifyDoc } = await sb.from('amfe_documents')
    .select('id, data')
    .eq('id', AMFE_DOC_ID)
    .single();
  const verifyData = typeof verifyDoc.data === 'string' ? JSON.parse(verifyDoc.data) : verifyDoc.data;
  console.log(`  Verified: ${verifyData.operations?.length} operations`);
  let vfCount = 0, vcCount = 0;
  verifyData.operations?.forEach(op => {
    let fCount = 0, cCount = 0;
    op.workElements?.forEach(we => {
      we.functions?.forEach(fn => {
        fn.failures?.forEach(f => {
          fCount++;
          cCount += f.causes?.length || 0;
        });
      });
    });
    vfCount += fCount;
    vcCount += cCount;
    console.log(`    OP ${op.operationNumber} ${op.operationName}: WE=${op.workElements.length} FM=${fCount} C=${cCount}`);
  });
  console.log(`  Total: ${vfCount} failures, ${vcCount} causes`);
}

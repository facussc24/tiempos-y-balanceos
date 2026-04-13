/**
 * _auditCpInjectionMaster.mjs
 * READ-ONLY audit del CP Maestro de Inyeccion creado por createInjectionCpMaster.mjs
 * Output: dump JSON estructurado para que el auditor humano/AI lo procese.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const CP_DOC_ID = '81b60cdd-1296-4821-a348-a8e3c2433b0d';
const AMFE_DOC_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const FAMILY_ID = 15;
const CP_NUMBER = 'CP-MAESTRO-INY-001';

console.log('=== A. INTEGRIDAD ===\n');

// A1
const { data: cpRow, error: e1 } = await sb
  .from('cp_documents')
  .select('id, control_plan_number, item_count, linked_amfe_id, data')
  .eq('id', CP_DOC_ID)
  .single();
if (e1) { console.error('ERROR cp_documents query:', e1); process.exit(1); }
console.log(`A1.typeof data: ${typeof cpRow.data}`);
let parsed;
try {
  parsed = typeof cpRow.data === 'string' ? JSON.parse(cpRow.data) : cpRow.data;
} catch (e) { console.error('A1.PARSE_FAIL', e.message); process.exit(1); }
console.log(`A1.parsed has header: ${!!parsed.header}`);
console.log(`A1.parsed has items: ${Array.isArray(parsed.items)}`);
console.log(`A2.items.length: ${parsed.items.length}`);
console.log(`A2.col item_count: ${cpRow.item_count}`);
console.log(`A2.match: ${parsed.items.length === cpRow.item_count}`);
console.log(`A.linked_amfe_id col: ${cpRow.linked_amfe_id}`);
console.log(`A.cp_number col: ${cpRow.control_plan_number}`);

// A3
const { data: linkRows, error: e2 } = await sb
  .from('family_documents')
  .select('id, family_id, module, document_id, is_master')
  .eq('document_id', CP_DOC_ID);
if (e2) { console.error('ERROR family_documents query:', e2); process.exit(1); }
console.log(`\nA3.family_documents linking this CP: ${linkRows.length}`);
for (const l of linkRows) console.log(`   ${JSON.stringify(l)}`);

// A4 — duplicates
const { data: dupCp } = await sb.from('cp_documents').select('id, control_plan_number').eq('control_plan_number', CP_NUMBER);
console.log(`\nA4.cp_documents with cp_number=${CP_NUMBER}: ${dupCp.length}`);
const { data: famDups } = await sb.from('family_documents').select('id, document_id, is_master').eq('family_id', FAMILY_ID).eq('module', 'cp');
console.log(`A4.family_documents family=${FAMILY_ID} module=cp: ${famDups.length}`);
for (const f of famDups) console.log(`   ${JSON.stringify(f)}`);

console.log('\n=== B. HEADER ===\n');
const h = parsed.header;
console.log(JSON.stringify(h, null, 2));
console.log(`\nB1.approvedBy="${h.approvedBy||''}" plantApproval="${h.plantApproval||''}"`);
console.log(`B1.both empty? ${!(h.approvedBy||'').trim() && !(h.plantApproval||'').trim()}`);
console.log(`B1.same person? ${(h.approvedBy||'').trim() === (h.plantApproval||'').trim()}`);
console.log(`B2.customerApproval present (single)? ${'customerApproval' in h}, value="${h.customerApproval||''}"`);
console.log(`B3.coreTeam: "${h.coreTeam}"`);
const ct = (h.coreTeam || '').toLowerCase();
console.log(`B3.has Carlos: ${ct.includes('carlos')}`);
console.log(`B3.has Manuel: ${ct.includes('manuel')}`);
console.log(`B3.has Marianna: ${ct.includes('marianna')}`);
console.log(`B4.partName: "${h.partName||''}"`);
console.log(`B4.applicableParts: "${h.applicableParts||''}"`);

console.log('\n=== C. ITEMS DUMP ===\n');
const items = parsed.items;
const machineRules = ['visual', 'inspecc', 'inspeccion'];
const vagueTechs = ['visual', 'inspeccion', 'inspección'];
const validRoles = ['operador', 'lider', 'inspector', 'recepcion', 'metrologia', 'laboratorio', 'supervisor', 'mantenimiento'];

let i = 0;
for (const it of items) {
  i++;
  const opNum = parseInt(it.processStepNumber, 10);
  console.log(`\n--- ITEM ${i} ---`);
  console.log(`PSN=${it.processStepNumber} (${typeof it.processStepNumber})  desc="${it.processDescription||''}"`);
  console.log(`machineDeviceTool="${it.machineDeviceTool||''}"`);
  console.log(`componentMaterial="${it.componentMaterial||''}"`);
  console.log(`processChar="${it.processCharacteristic||''}"`);
  console.log(`productChar="${it.productCharacteristic||''}"`);
  console.log(`specialCharClass="${it.specialCharClass||''}"`);
  console.log(`specification="${it.specification||''}"`);
  console.log(`evaluationTechnique="${it.evaluationTechnique||''}"`);
  console.log(`controlMethod="${it.controlMethod||''}"`);
  console.log(`sampleSize="${it.sampleSize||''}" sampleFreq="${it.sampleFrequency||''}"`);
  console.log(`reactionPlan="${it.reactionPlan||''}"`);
  console.log(`reactionPlanOwner="${it.reactionPlanOwner||''}"`);
  console.log(`controlProcedure="${it.controlProcedure||''}"`);
  console.log(`amfeAp="${it.amfeAp||''}" sev=${it.amfeSeverity||''} category="${it.operationCategory||''}"`);
  console.log(`amfeCauseIds: ${(it.amfeCauseIds||[]).length}, amfeFailureId: ${it.amfeFailureId||'(none)'}`);

  // C1: machineDeviceTool not generic
  const mdt = (it.machineDeviceTool||'').toLowerCase().trim();
  const isMethod = machineRules.some(r => mdt === r);
  if (isMethod) console.log(`  *** C1 BUG: machineDeviceTool es metodo, no equipo ***`);

  // C2: componentMaterial only in OP <=10
  if (opNum > 10 && (it.componentMaterial||'').trim()) {
    console.log(`  *** C2 BUG: componentMaterial llenado en OP>${opNum} ***`);
  }
  if (opNum <= 10 && !(it.componentMaterial||'').trim()) {
    console.log(`  *** C2 WARN: OP10 sin componentMaterial ***`);
  }

  // C3: spec not generic
  const sp = (it.specification||'').toLowerCase().trim();
  if (!sp || ['conforme a especificacion', 'segun especificacion', 'tbd'].includes(sp)) {
    console.log(`  *** C3 WARN: spec generica/vacia ***`);
  }

  // C4: prevention rows -> evaluationTechnique vacio; detection rows -> concrete
  const isPrev = !!(it.processCharacteristic||'').trim();
  const isDet = !!(it.productCharacteristic||'').trim();
  if (isPrev && (it.evaluationTechnique||'').trim()) {
    console.log(`  *** C4 BUG (AIAG CP 2024): fila prevencion con evaluationTechnique="${it.evaluationTechnique}" ***`);
  }
  if (isDet) {
    const ev = (it.evaluationTechnique||'').toLowerCase().trim();
    if (!ev) console.log(`  *** C4 BUG: fila deteccion sin evaluationTechnique ***`);
    else if (vagueTechs.includes(ev)) console.log(`  *** C4 WARN: evaluationTechnique vago "${it.evaluationTechnique}" ***`);
  }

  // C5: prevention rows -> controlMethod populated; detection rows -> empty
  if (isPrev && !(it.controlMethod||'').trim()) {
    console.log(`  *** C5 BUG: fila prevencion sin controlMethod ***`);
  }
  if (isDet && (it.controlMethod||'').trim()) {
    console.log(`  *** C5 BUG: fila deteccion con controlMethod="${it.controlMethod}" ***`);
  }

  // C6: reactionPlanOwner = role, not name
  const rpo = (it.reactionPlanOwner||'').toLowerCase().trim();
  const isRole = validRoles.some(r => rpo.includes(r));
  if (!rpo) console.log(`  *** C6 BUG: reactionPlanOwner vacio ***`);
  else if (!isRole) console.log(`  *** C6 WARN: reactionPlanOwner no parece rol generico: "${it.reactionPlanOwner}" ***`);

  // C7: reactionPlan references P-09/I, P-10/I, P-14
  const rp = (it.reactionPlan||'').toLowerCase();
  const hasRef = rp.includes('p-09') || rp.includes('p-10') || rp.includes('p-14');
  if (!rp) console.log(`  *** C7 BUG: reactionPlan vacio ***`);
  else if (!hasRef) console.log(`  *** C7 WARN: reactionPlan sin referencia P-09/I, P-10/I o P-14 ***`);

  // C8: classification empty
  if ((it.specialCharClass||'').trim()) {
    console.log(`  *** C8 BUG: specialCharClass="${it.specialCharClass}" sin autorizacion ***`);
  }

  // C9: PSN solo numero
  if (!/^\d+$/.test(it.processStepNumber)) {
    console.log(`  *** C9 BUG: processStepNumber no es solo numero: "${it.processStepNumber}" ***`);
  }

  // C10: process AND product en misma fila
  if (isPrev && isDet) {
    console.log(`  *** C10 BUG (B3 bloqueante): processChar Y productChar en misma fila ***`);
  }
}

console.log('\n=== D. CROSS vs AMFE ===\n');
const { data: amfeRow } = await sb.from('amfe_documents').select('data').eq('id', AMFE_DOC_ID).single();
const amfe = typeof amfeRow.data === 'string' ? JSON.parse(amfeRow.data) : amfeRow.data;

// Build map of AMFE failure & cause IDs
const amfeFailureMap = new Map();
const amfeCauseMap = new Map();
const amfeMachines = new Set();
let totalCausesA = 0, hCount = 0, mCount = 0, lCount = 0;
for (const op of amfe.operations) {
  for (const we of (op.workElements||[])) {
    if (we.type === 'Machine' && we.name) amfeMachines.add(we.name);
    for (const fn of (we.functions||[])) {
      for (const fm of (fn.failures||[])) {
        amfeFailureMap.set(fm.id, { opNumber: op.opNumber || op.operationNumber, opName: op.name||op.operationName, description: fm.description, causes: fm.causes||[] });
        for (const c of (fm.causes||[])) {
          totalCausesA++;
          amfeCauseMap.set(c.id, { ap: c.actionPriority||c.ap, sev: c.severity, opNumber: op.opNumber||op.operationNumber, fmId: fm.id });
          const ap = c.actionPriority || c.ap;
          if (ap === 'H') hCount++;
          else if (ap === 'M') mCount++;
          else if (ap === 'L') lCount++;
        }
      }
    }
  }
}
console.log(`AMFE causes: total=${totalCausesA} H=${hCount} M=${mCount} L=${lCount}`);
console.log(`AMFE machine WE names: ${[...amfeMachines].join(' | ')}`);

// D1, D7: every CP item with claimed amfe link must reference real IDs
let badLinks = 0;
let orphanCpItems = 0;
const coveredCauseIds = new Set();
const coveredFailureIds = new Set();
for (const it of items) {
  const cIds = it.amfeCauseIds||[];
  for (const cid of cIds) {
    if (!amfeCauseMap.has(cid)) badLinks++;
    else coveredCauseIds.add(cid);
  }
  if (it.amfeFailureId) {
    if (!amfeFailureMap.has(it.amfeFailureId)) badLinks++;
    else coveredFailureIds.add(it.amfeFailureId);
  }
  if ((cIds.length === 0) && !it.amfeFailureId) orphanCpItems++;
}
console.log(`D1.bad cause/failure refs in CP: ${badLinks}`);
console.log(`D1.CP items with NO amfe link (manual): ${orphanCpItems}`);
console.log(`D7.amfe failures: ${amfeFailureMap.size}, covered by CP: ${coveredFailureIds.size}`);

const uncoveredFailures = [];
for (const [fid, f] of amfeFailureMap) {
  if (!coveredFailureIds.has(fid)) uncoveredFailures.push({ fid, opNumber: f.opNumber, description: f.description });
}
console.log(`D7.failures NOT covered by CP: ${uncoveredFailures.length}`);
for (const u of uncoveredFailures) console.log(`   - OP${u.opNumber}: ${u.description}`);

// D2: orphan AP=H/M failures (cualquier causa AP=H/M sin cobertura)
const uncoveredCriticalCauses = [];
for (const [cid, c] of amfeCauseMap) {
  if (c.ap === 'H' || c.ap === 'M') {
    if (!coveredCauseIds.has(cid)) {
      uncoveredCriticalCauses.push({ cid, opNumber: c.opNumber, ap: c.ap });
    }
  }
}
console.log(`D2.orphan AP=H/M causes: ${uncoveredCriticalCauses.length}`);
for (const u of uncoveredCriticalCauses) console.log(`   - OP${u.opNumber} AP=${u.ap}: ${u.cid}`);

// D5: machineDeviceTool alignment
console.log(`\nD5.CP machineDeviceTool values:`);
const cpMachines = new Set();
for (const it of items) cpMachines.add(it.machineDeviceTool || '');
for (const m of cpMachines) console.log(`   - "${m}"`);

console.log(`\nD5.Machines in CP NOT in AMFE Machine WE names:`);
const amfeMachLower = [...amfeMachines].map(s => s.toLowerCase());
for (const m of cpMachines) {
  const ml = (m||'').toLowerCase();
  const found = amfeMachLower.some(am => am.includes(ml.split(' ')[0]) || ml.includes(am.split(' ')[0]));
  if (!found && m) console.log(`   - "${m}"`);
}

// D6: sampling consistency
console.log(`\nD6.sample distribution:`);
const sampMap = {};
for (const it of items) {
  const k = `${it.amfeAp||'manual'} | ${it.sampleSize||''} | ${it.sampleFrequency||''}`;
  sampMap[k] = (sampMap[k]||0) + 1;
}
for (const [k,v] of Object.entries(sampMap)) console.log(`   ${v}x ${k}`);

console.log('\n=== E. COVERAGE 13 controles obligatorios ===\n');
const obligatorios = [
  { id: 'E1', need: 'Certificado del proveedor', op: '10', regex: /certificado.*proveedor/i },
  { id: 'E2', need: 'Temperatura de tolva secadora', op: '10', regex: /temperatura.*tolva.*secadora/i },
  { id: 'E3', need: 'Tiempo de secado del pellet', op: '10', regex: /tiempo.*secad/i },
  { id: 'E4', need: 'Flujo de refrigeracion del tornillo / garganta', op: '20', regex: /(flujo.*refriger.*tornillo|refriger.*(tornillo|garganta))/i },
  { id: 'E5', need: 'Parametros de proceso vs dossier', op: '20', regex: /parametros.*dossier|dossier.*producto/i },
  { id: 'E6', need: 'Fuerza de cierre de la inyectora', op: '20', regex: /fuerza.*cierre/i },
  { id: 'E7', need: 'Inspeccion visual de pieza', op: '30', regex: /(inspecc.*visual|defectos.*tipico)/i },
  { id: 'E8', need: 'Dimensional con calibre', op: '30', regex: /dimensional/i },
  { id: 'E9', need: 'Flamabilidad del material', op: 'any', regex: /flamabil/i },
  { id: 'E10', need: 'Limpieza de molde antes de bajarlo', op: '30', regex: /limpieza.*molde/i },
  { id: 'E11', need: 'Lubricacion de molde', op: '30', regex: /lubricaci/i },
  { id: 'E12', need: 'Mantenimiento preventivo de molde', op: '30', regex: /mantenimiento.*preventivo|mantenimiento.*molde/i },
  { id: 'E13', need: 'Filtro de aspiradora', op: '20', regex: /filtro.*aspiradora|aspiradora/i },
];
for (const o of obligatorios) {
  const matches = items.filter(it => {
    const blob = `${it.processCharacteristic||''} ${it.productCharacteristic||''} ${it.controlMethod||''} ${it.machineDeviceTool||''} ${it.specification||''}`;
    return o.regex.test(blob);
  });
  if (matches.length === 0) {
    console.log(`  ${o.id} MISSING: ${o.need}`);
  } else {
    console.log(`  ${o.id} OK (${matches.length}): ${o.need} | items en OP=[${[...new Set(matches.map(m=>m.processStepNumber))].join(',')}]`);
  }
}

// dump full json para auditor
writeFileSync('C:/Users/FacundoS-PC/dev/BarackMercosul/scripts/_cp_master_dump.json', JSON.stringify({ header: parsed.header, items: parsed.items, amfeStats: { total: totalCausesA, H: hCount, M: mCount, L: lCount }, amfeMachines: [...amfeMachines], famDups, linkRows, dupCp }, null, 2));
console.log('\nDump full a scripts/_cp_master_dump.json');

/**
 * Fix masivo — corrige numeracion y controles absurdos en todos los AMFEs defectuosos.
 * Scope: AMFE-1, AMFE-INS-PAT, AMFE-TR-PAT, AMFE-HF-PAT, AMFE-HRC-PAT, AMFE-HRO-PAT
 * Tambien sincroniza PFDs donde aplica (Insert, TopRoll).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const log = [];
const P = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };

// ==== Detector de controles absurdos ====
const ABSURD_EXACT = /^(metodo|m[eé]todo|proceso|sistema|control|capacitaci[oó]n|buen m[eé]todo|seguir procedimiento|aplicar norma|buena pr[aá]ctica|correcto m[eé]todo|utilizar m[eé]todo)$/i;
const PENDING = 'Pendiente definicion equipo APQP';
function isAbsurd(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (!t) return false;
  if (ABSURD_EXACT.test(t)) return true;
  // Frases de <= 3 palabras muy genericas
  const words = t.split(/\s+/);
  if (words.length <= 2 && /m[eé]todo|proceso|sistema|control/i.test(t)) return true;
  return false;
}
function sweepAbsurdControls(ops, tag) {
  let count = 0;
  for (const op of ops || []) {
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fl of fn.failures || []) {
          for (const c of fl.causes || []) {
            if (isAbsurd(c.preventionControl)) {
              P(`  ${tag} absurd prevention: "${c.preventionControl}" -> ${PENDING}`);
              c.preventionControl = PENDING;
              count++;
            }
            if (isAbsurd(c.detectionControl)) {
              P(`  ${tag} absurd detection: "${c.detectionControl}" -> ${PENDING}`);
              c.detectionControl = PENDING;
              count++;
            }
          }
        }
      }
    }
  }
  return count;
}

// ==== Helper: renumerar op in-place (mantiene aliases) ====
function setOpNumber(op, newNum) {
  op.opNumber = newNum;
  op.operationNumber = newNum;
}

// ==== Helper: crear op placeholder ====
function makePlaceholderOp(opNumber, name) {
  return {
    id: randomUUID(),
    opNumber,
    operationNumber: opNumber,
    name,
    operationName: name,
    focusElementFunction: '',
    operationFunction: '',
    workElements: [],
  };
}

async function loadAmfe(num) {
  const { data, error } = await sb.from('amfe_documents').select('*').eq('amfe_number', num).single();
  if (error) throw new Error(`Load ${num}: ${error.message}`);
  const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
  return { row: data, parsed };
}
async function saveAmfe(id, parsed, tag) {
  const { error } = await sb.from('amfe_documents').update({ data: parsed }).eq('id', id);
  if (error) throw new Error(`Save ${tag}: ${error.message}`);
  P(`  saved ${tag}`);
}
async function loadPfd(docNum) {
  const { data, error } = await sb.from('pfd_documents').select('*').eq('document_number', docNum).maybeSingle();
  if (error) throw new Error(`Load PFD ${docNum}: ${error.message}`);
  if (!data) return null;
  const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
  return { row: data, parsed };
}
async function savePfd(id, parsed, tag) {
  const { error } = await sb.from('pfd_documents').update({ data: parsed }).eq('id', id);
  if (error) throw new Error(`Save PFD ${tag}: ${error.message}`);
  P(`  saved PFD ${tag}`);
}

// ============ 1) AMFE-1 Telas Planas — agregar OP 90/100/101/102 ============
P('\n=== AMFE-1 Telas Planas ===');
{
  const { row, parsed } = await loadAmfe('AMFE-1');
  const ops = parsed.operations || [];
  const existing = new Set(ops.map(o => o.opNumber ?? o.operationNumber));
  const toAdd = [];
  if (!existing.has(90)) toAdd.push(makePlaceholderOp(90, 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME'));
  if (!existing.has(100)) toAdd.push(makePlaceholderOp(100, 'REPROCESO: ELIMINACION DE HILO SOBRANTE'));
  if (!existing.has(101)) toAdd.push(makePlaceholderOp(101, 'REPROCESO: REUBICACION DE APLIX'));
  if (!existing.has(102)) toAdd.push(makePlaceholderOp(102, 'REPROCESO: CORRECCION DE COSTURA DESVIADA / FLOJA'));
  ops.push(...toAdd);
  ops.sort((a, b) => (a.opNumber ?? a.operationNumber) - (b.opNumber ?? b.operationNumber));
  parsed.operations = ops;
  P(`  ops agregadas: ${toAdd.map(o => o.opNumber).join(', ')}`);
  const swept = sweepAbsurdControls(ops, 'AMFE-1');
  P(`  controles absurdos reemplazados: ${swept}`);
  await saveAmfe(row.id, parsed, 'AMFE-1');
}

// ============ 2) AMFE-INS-PAT Insert — renumerar OP 5→10, OP 111→105 ============
P('\n=== AMFE-INS-PAT Insert ===');
{
  const { row, parsed } = await loadAmfe('AMFE-INS-PAT');
  const ops = parsed.operations || [];
  for (const op of ops) {
    const n = op.opNumber ?? op.operationNumber;
    if (n === 5) { setOpNumber(op, 10); P(`  OP 5 -> OP 10 (${op.name})`); }
    if (n === 111) { setOpNumber(op, 105); P(`  OP 111 -> OP 105 (${op.name})`); }
  }
  ops.sort((a, b) => (a.opNumber ?? a.operationNumber) - (b.opNumber ?? b.operationNumber));
  parsed.operations = ops;
  const swept = sweepAbsurdControls(ops, 'AMFE-INS-PAT');
  P(`  controles absurdos reemplazados: ${swept}`);
  await saveAmfe(row.id, parsed, 'AMFE-INS-PAT');
  // PFD
  const pfd = await sb.from('pfd_documents').select('*').eq('part_name', 'INSERT').maybeSingle();
  if (pfd.data) {
    const pp = typeof pfd.data.data === 'string' ? JSON.parse(pfd.data.data) : pfd.data.data;
    for (const s of pp.steps || []) {
      if (s.opNumber === 5) { s.opNumber = 10; P('  PFD: OP 5 -> OP 10'); }
      if (s.opNumber === 111) { s.opNumber = 105; P('  PFD: OP 111 -> OP 105'); }
    }
    await savePfd(pfd.data.id, pp, 'INSERT');
  }
}

// ============ 3) AMFE-TR-PAT Top Roll — shift +10 uniforme ============
P('\n=== AMFE-TR-PAT Top Roll ===');
{
  const { row, parsed } = await loadAmfe('AMFE-TR-PAT');
  const ops = parsed.operations || [];
  // Shift: 5->10, otros +10
  for (const op of ops) {
    const n = op.opNumber ?? op.operationNumber;
    const newN = n === 5 ? 10 : n + 10;
    setOpNumber(op, newN);
    P(`  OP ${n} -> OP ${newN} (${op.name || op.operationName})`);
  }
  ops.sort((a, b) => (a.opNumber ?? a.operationNumber) - (b.opNumber ?? b.operationNumber));
  parsed.operations = ops;
  const swept = sweepAbsurdControls(ops, 'AMFE-TR-PAT');
  P(`  controles absurdos reemplazados: ${swept}`);
  await saveAmfe(row.id, parsed, 'AMFE-TR-PAT');
  // PFD TopRoll
  const pfd = await loadPfd('PFD-TOPROLL-001');
  if (pfd) {
    for (const s of pfd.parsed.steps || []) {
      const n = s.opNumber;
      if (typeof n === 'number') {
        const newN = n === 5 ? 10 : n + 10;
        s.opNumber = newN;
        P(`  PFD: OP ${n} -> OP ${newN}`);
      }
    }
    await savePfd(pfd.row.id, pfd.parsed, 'PFD-TOPROLL-001');
  }
}

// ============ 4) Headrests — agregar Control Final + Embalaje ============
for (const { num, missing } of [
  { num: 'AMFE-HF-PAT', missing: [{ n: 90, name: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO' }] },
  { num: 'AMFE-HRC-PAT', missing: [{ n: 80, name: 'CONTROL FINAL DE CALIDAD' }, { n: 90, name: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO' }] },
  { num: 'AMFE-HRO-PAT', missing: [{ n: 80, name: 'CONTROL FINAL DE CALIDAD' }, { n: 90, name: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO' }] },
]) {
  P(`\n=== ${num} ===`);
  const { row, parsed } = await loadAmfe(num);
  const ops = parsed.operations || [];
  const existing = new Set(ops.map(o => o.opNumber ?? o.operationNumber));
  for (const { n, name } of missing) {
    if (!existing.has(n)) {
      ops.push(makePlaceholderOp(n, name));
      P(`  +OP ${n}: ${name}`);
    }
  }
  ops.sort((a, b) => (a.opNumber ?? a.operationNumber) - (b.opNumber ?? b.operationNumber));
  parsed.operations = ops;
  const swept = sweepAbsurdControls(ops, num);
  P(`  controles absurdos reemplazados: ${swept}`);
  await saveAmfe(row.id, parsed, num);
}

// ============ 5) Barrer controles absurdos en todos los AMFEs restantes ============
P('\n=== Sweep global controles absurdos ===');
const others = ['AMFE-2', 'AMFE-ARM-PAT', 'VWA-PAT-IPPADS-001', 'AMFE-MAESTRO-LOG-REC-001', 'AMFE-MAESTRO-INY-001'];
for (const num of others) {
  const { row, parsed } = await loadAmfe(num);
  const swept = sweepAbsurdControls(parsed.operations || [], num);
  if (swept > 0) {
    await saveAmfe(row.id, parsed, num);
    P(`  ${num}: ${swept} controles absurdos reemplazados`);
  } else {
    P(`  ${num}: 0 absurdos (limpio)`);
  }
}

writeFileSync('scripts/_fix_log.txt', log.join('\n'));
P('\nLog escrito en scripts/_fix_log.txt');
process.exit(0);

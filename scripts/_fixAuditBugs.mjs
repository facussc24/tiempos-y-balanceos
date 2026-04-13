/**
 * _fixAuditBugs.mjs
 * Fix para los 3 bloqueadores detectados por el auditor AMFE (docs/AUDITORIA_INYECCION_2026-04-10.md):
 *   BUG-1: Maestro OP 10 sin Environment, OP 30 sin Material ni Environment
 *   BUG-2: Headrests OP 40 INYECCION DE SUSTRATO sin focusElementFunction
 *   BUG-3: Armrest OP 60 INYECCION DE PIEZAS PLASTICAS sin los 9 WEs del maestro
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const MASTER_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';

// ── AP table (copia de modules/amfe/apTable.ts) ────────────────────────────
function apRule(s, o, d) {
  if (s <= 1) return 'L';
  if (s <= 3) { if (o >= 8 && d >= 5) return 'M'; return 'L'; }
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
  if (o >= 6) return 'H';
  if (o >= 4) return d >= 2 ? 'H' : 'M';
  if (o >= 2) { if (d >= 7) return 'H'; if (d >= 5) return 'M'; return 'L'; }
  return 'L';
}
const calculateAP = (s, o, d) => apRule(s, o, d);

// ── Helpers para crear items con aliases duales ────────────────────────────
function mkCause({ description, severity, occurrence, detection, preventionControl, detectionControl }) {
  const ap = calculateAP(severity, occurrence, detection);
  return {
    id: randomUUID(),
    description, cause: description,
    severity, occurrence, detection,
    ap, actionPriority: ap,
    preventionControl, detectionControl,
    preventionAction: '', detectionAction: '',
    responsible: '', targetDate: '', status: '', actionTaken: '', completionDate: '',
    severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
    observations: '', specialChar: '', characteristicNumber: '', filterCode: '',
  };
}

function mkFailure({ description, effectLocal, effectNextLevel, effectEndUser, causes }) {
  return {
    id: randomUUID(),
    description,
    effectLocal, effectNextLevel, effectEndUser,
    severity: Math.max(...causes.map(c => c.severity)),
    causes,
  };
}

function mkFunction({ description, requirements = '', failures }) {
  return {
    id: randomUUID(),
    description, functionDescription: description,
    requirements, failures,
  };
}

function mkWE({ name, type, functions }) {
  return { id: randomUUID(), name, type, functions };
}

// ═══════════════════════════════════════════════════════════════════════════
// BUG-1: agregar WEs faltantes al maestro OP 10 y OP 30
// ═══════════════════════════════════════════════════════════════════════════
async function fixMaster() {
  console.log('\n[BUG-1] Maestro: agregando 6M faltante a OP 10 y OP 30');
  const { data: row } = await sb.from('amfe_documents').select('id, data').eq('id', MASTER_ID).single();
  const doc = JSON.parse(row.data);

  const op10 = doc.operations.find(o => (o.opNumber || o.operationNumber) === '10');
  const op30 = doc.operations.find(o => (o.opNumber || o.operationNumber) === '30');

  // OP 10: agregar Environment
  const op10EnvWE = mkWE({
    name: 'Area de recepcion y pulmon de materia prima',
    type: 'Environment',
    functions: [
      mkFunction({
        description: 'Mantener condiciones ambientales adecuadas para almacenaje de pellet (humedad controlada, sin contaminacion)',
        failures: [
          mkFailure({
            description: 'Contaminacion cruzada o absorcion de humedad en el area de recepcion',
            effectLocal: 'Pellet expuesto a humedad ambiente absorbe agua (materiales higroscopicos) o contaminantes',
            effectNextLevel: 'En OP 20 inyeccion aparecen defectos de humedad (ampollas, rafagas plateadas) o particulas extranas',
            effectEndUser: 'Apariencia superficial NOK, riesgo de degradacion del material',
            causes: [
              mkCause({
                description: 'Area de almacenaje sin control de humedad relativa ni segregacion por tipo de material',
                severity: 6, occurrence: 2, detection: 6,
                preventionControl: 'Layout del area con segregacion por material + control de humedad relativa del ambiente',
                detectionControl: 'Inspeccion visual del area al recibir lote y verificacion de integridad del bolson (cierre hermetico)',
              }),
              mkCause({
                description: 'Bolson de pellet danado, abierto o con contaminacion visible al momento de recepcion',
                severity: 6, occurrence: 2, detection: 4,
                preventionControl: 'Procedimiento de inspeccion fisica del bolson al ingreso (integridad, etiquetado, ausencia de particulas)',
                detectionControl: 'Checklist de recepcion con verificacion de bolson intacto y certificado de proveedor',
              }),
            ],
          }),
        ],
      }),
    ],
  });
  op10.workElements.push(op10EnvWE);
  console.log(`  OP 10: +1 WE Environment (total ahora: ${op10.workElements.length})`);

  // OP 30: agregar Material + Environment
  const op30MatWE = mkWE({
    name: 'Bolsas, cajas y etiquetas de identificacion de lote (material indirecto de empaque)',
    type: 'Material',
    functions: [
      mkFunction({
        description: 'Proteger la pieza conforme inyectada hasta su traslado a la siguiente estacion y mantener trazabilidad de lote',
        failures: [
          mkFailure({
            description: 'Pieza OK marcada con etiqueta incorrecta de lote/fecha/turno',
            effectLocal: 'Piezas OK mezcladas en lote incorrecto, perdida de trazabilidad',
            effectNextLevel: 'Problemas de trazabilidad ante un no conforme detectado aguas abajo, dificultad para identificar el lote afectado',
            effectEndUser: 'Imposibilidad de acotar el alcance de un recall o retrabajo en campo',
            causes: [
              mkCause({
                description: 'Etiqueta de lote no actualizada al cambio de lote/turno en el puesto de control',
                severity: 6, occurrence: 2, detection: 6,
                preventionControl: 'Procedimiento de cambio de lote con actualizacion obligatoria de etiqueta en el puesto de control',
                detectionControl: 'Verificacion cruzada de etiqueta con orden de fabricacion por el lider al inicio del turno',
              }),
            ],
          }),
        ],
      }),
    ],
  });
  op30.workElements.push(op30MatWE);

  const op30EnvWE = mkWE({
    name: 'Iluminacion del puesto de control post-inyeccion',
    type: 'Environment',
    functions: [
      mkFunction({
        description: 'Proveer iluminacion adecuada para inspeccion visual de defectos superficiales (rebabas, quemaduras, color, rayas)',
        failures: [
          mkFailure({
            description: 'Iluminacion insuficiente o inadecuada en el puesto de control',
            effectLocal: 'Operador no detecta defectos superficiales sutiles por iluminacion pobre',
            effectNextLevel: 'Piezas con defectos liberadas a la siguiente estacion, detectadas tarde o no detectadas',
            effectEndUser: 'Apariencia superficial NOK no detectada, rechazo cliente',
            causes: [
              mkCause({
                description: 'Nivel de iluminacion (lux) del puesto por debajo del minimo requerido para inspeccion visual',
                severity: 5, occurrence: 2, detection: 7,
                preventionControl: 'Estandar de iluminacion del puesto de control visual (nivel lux segun procedimiento de Seguridad e Higiene) + plan de mantenimiento de luminarias',
                detectionControl: 'Verificacion periodica del nivel de iluminacion con luxometro por Seguridad e Higiene',
              }),
              mkCause({
                description: 'Luminaria del puesto quemada o desalineada, zonas de sombra en la estacion',
                severity: 5, occurrence: 2, detection: 5,
                preventionControl: 'Mantenimiento preventivo de luminarias del puesto',
                detectionControl: 'Verificacion visual del operador al inicio de turno (autocontrol de condiciones del puesto)',
              }),
            ],
          }),
        ],
      }),
    ],
  });
  op30.workElements.push(op30MatWE ? op30EnvWE : op30EnvWE);
  console.log(`  OP 30: +1 WE Material, +1 WE Environment (total ahora: ${op30.workElements.length})`);

  await sb.from('amfe_documents').update({ data: JSON.stringify(doc) }).eq('id', MASTER_ID);
  // verify
  const { data: row2 } = await sb.from('amfe_documents').select('data').eq('id', MASTER_ID).single();
  const doc2 = JSON.parse(row2.data);
  console.log(`  Verify: OP10 WEs=${doc2.operations.find(o => o.opNumber === '10').workElements.length}, OP30 WEs=${doc2.operations.find(o => o.opNumber === '30').workElements.length}`);
  return doc2;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUG-3: agregar los 9 WEs del maestro al Armrest OP 60
// ═══════════════════════════════════════════════════════════════════════════
async function fixArmrest(masterDoc) {
  console.log('\n[BUG-3] Armrest OP 60: agregando WEs faltantes del maestro');

  const { data: rows } = await sb.from('amfe_documents').select('id, data, amfe_number, subject').eq('amfe_number', 'AMFE-ARM-PAT');
  if (!rows || rows.length === 0) { console.log('  Armrest no encontrado'); return; }
  const row = rows[0];
  const doc = JSON.parse(row.data);

  const op60 = doc.operations.find(o => {
    const name = (o.name || o.operationName || '').toUpperCase();
    return (o.opNumber === '60' || o.operationNumber === '60') && name.includes('INYECCION') && !name.includes('PU');
  });
  if (!op60) { console.log('  Armrest OP 60 no encontrado'); return; }

  console.log(`  Armrest OP 60 antes: ${op60.workElements.length} WEs`);

  const masterOp20 = masterDoc.operations.find(o => (o.opNumber || o.operationNumber) === '20');

  // Existing WE names (normalized) in Armrest OP 60
  const existingNames = new Set(op60.workElements.map(w => (w.name || '').toLowerCase().trim()));

  // Clone each master WE (with fresh UUIDs) if not already present
  function cloneWithNewIds(obj) {
    if (Array.isArray(obj)) return obj.map(cloneWithNewIds);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = (k === 'id') ? randomUUID() : cloneWithNewIds(v);
      }
      return out;
    }
    return obj;
  }

  let added = 0;
  for (const masterWE of masterOp20.workElements) {
    const masterName = (masterWE.name || '').toLowerCase().trim();
    // Skip if already exists in Armrest (the existing Inyectora WE was merged by previous script)
    if (existingNames.has(masterName)) continue;
    // Also skip the Inyectora WE since Armrest already has its own version merged
    if (masterName.includes('inyectora')) continue;
    op60.workElements.push(cloneWithNewIds(masterWE));
    added++;
  }

  // Set focusElementFunction if empty
  if (!op60.focusElementFunction) {
    op60.focusElementFunction = masterOp20.focusElementFunction;
    console.log('  focusElementFunction copiado del maestro');
  }

  console.log(`  Armrest OP 60 despues: ${op60.workElements.length} WEs (+${added})`);

  await sb.from('amfe_documents').update({ data: JSON.stringify(doc) }).eq('id', row.id);
  const { data: v } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
  const vd = JSON.parse(v.data);
  const vop = vd.operations.find(o => (o.opNumber || o.operationNumber) === '60');
  console.log(`  Verify: ${vop.workElements.length} WEs`);
}

// ═══════════════════════════════════════════════════════════════════════════
// BUG-2: agregar focusElementFunction a las OPs de Headrest
// ═══════════════════════════════════════════════════════════════════════════
async function fixHeadrests(masterDoc) {
  console.log('\n[BUG-2] Headrests: agregando focusElementFunction a OP 40');

  const masterOp20 = masterDoc.operations.find(o => (o.opNumber || o.operationNumber) === '20');
  const fef = masterOp20.focusElementFunction;

  const hrAmfes = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
  for (const amfeNum of hrAmfes) {
    const { data: rows } = await sb.from('amfe_documents').select('id, data').eq('amfe_number', amfeNum);
    if (!rows || rows.length === 0) { console.log(`  ${amfeNum} no encontrado`); continue; }
    const row = rows[0];
    const doc = JSON.parse(row.data);

    const op40 = doc.operations.find(o => {
      const name = (o.name || o.operationName || '').toUpperCase();
      return (o.opNumber === '40' || o.operationNumber === '40') && name.includes('INYECCION');
    });
    if (!op40) { console.log(`  ${amfeNum} OP 40 no encontrado`); continue; }

    const before = op40.focusElementFunction || '(undefined)';
    op40.focusElementFunction = fef;
    console.log(`  ${amfeNum} OP 40: focusElementFunction set (antes: "${before.slice(0, 40)}...")`);

    await sb.from('amfe_documents').update({ data: JSON.stringify(doc) }).eq('id', row.id);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Run
// ═══════════════════════════════════════════════════════════════════════════
const masterDoc = await fixMaster();
await fixArmrest(masterDoc);
await fixHeadrests(masterDoc);
console.log('\nDone.');
process.exit(0);

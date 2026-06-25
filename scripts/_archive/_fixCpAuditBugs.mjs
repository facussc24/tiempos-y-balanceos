/**
 * _fixCpAuditBugs.mjs
 * Fixes critical bugs from cp-auditor (docs/AUDITORIA_CP_INYECCION_2026-04-10.md):
 *   1. Items 2/7/12 (AP=L generic rows): clear evaluationTechnique on process rows
 *   2. Item 6 bad specification
 *   3. Items 1/5 dedup certificado proveedor
 *   4. Add E9 Flamabilidad control
 *   5. Fix recepcion reaction plans to reference P-14
 *   6. Item 15 TBD context
 *   7. Item 1 sampleSize (1 documento, not 1 pieza)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const CP_ID = '81b60cdd-1296-4821-a348-a8e3c2433b0d';

const { data: row } = await sb.from('cp_documents').select('id, data').eq('id', CP_ID).single();
const doc = JSON.parse(row.data);

console.log(`Initial items: ${doc.items.length}`);

let fixes = 0;

// Dedup helper: find items by characteristic substring
function findByChar(text) {
  return doc.items.filter(it => {
    const combined = `${it.characteristic || ''} ${it.processCharacteristic || ''} ${it.productCharacteristic || ''}`.toLowerCase();
    return combined.includes(text.toLowerCase());
  });
}

// ── Fix 1: Items 2/7/12 — AP=L generic rows: clear evaluationTechnique ────
// Identify by characteristic="Autocontrol visual general"
const genericRows = doc.items.filter(it => {
  const pc = (it.processCharacteristic || it.characteristic || '').toLowerCase();
  return pc.includes('autocontrol visual general');
});
for (const item of genericRows) {
  if (item.evaluationTechnique) {
    console.log(`  [Fix 1] Clearing evaluationTechnique on item characteristic="${item.processCharacteristic || item.characteristic}"`);
    item.evaluationTechnique = '';
    fixes++;
  }
}

// ── Fix 2: Item 6 (characteristic con spec generica "Conforme a pieza patron") ─
for (const item of doc.items) {
  const spec = (item.specification || '').toLowerCase();
  if (spec.includes('conforme a pieza patron') || spec === 'conforme a especificacion' || spec === 'conforme a especificación') {
    const before = item.specification;
    // Only OP 10 recepcion items: specify by material certificate
    if ((item.processStepNumber || '').startsWith('10')) {
      item.specification = 'Certificado del proveedor con tipo de material, lote, fecha y resultado de ensayos (TBD ensayos especificos a confirmar con Ingenieria)';
    } else {
      item.specification = 'TBD — pendiente definicion con equipo APQP';
    }
    console.log(`  [Fix 2] specification "${before}" -> "${item.specification}"`);
    fixes++;
  }
}

// ── Fix 3: Dedup items 1 y 5 (certificado del proveedor) ──────────────────
const certItems = findByChar('certificado del proveedor');
if (certItems.length > 1) {
  // Keep the first, remove the others
  const kept = certItems[0];
  const removed = certItems.slice(1);
  // Merge: set the kept item's reactionPlanOwner to Recepcion de Materiales if any duplicate has it
  for (const rm of removed) {
    if ((rm.reactionPlanOwner || '').toLowerCase().includes('recepcion')) {
      kept.reactionPlanOwner = rm.reactionPlanOwner;
    }
  }
  doc.items = doc.items.filter(it => !removed.includes(it));
  console.log(`  [Fix 3] Removed ${removed.length} duplicate "certificado del proveedor" items, kept 1`);
  fixes += removed.length;
}

// ── Fix 4: Add E9 Flamabilidad control (condicional, aplicable solo a piezas VWA) ─
const hasFlamabilidad = doc.items.some(it => {
  const combined = `${it.characteristic || ''} ${it.processCharacteristic || ''} ${it.productCharacteristic || ''}`.toLowerCase();
  return combined.includes('flamabilidad') || combined.includes('tl 1010');
});
if (!hasFlamabilidad) {
  const flamItem = {
    id: randomUUID(),
    processStepNumber: '10',
    processStepName: 'RECEPCION Y PREPARACION DE MATERIA PRIMA',
    machineTool: 'N/A (ensayo de laboratorio del cliente o tercero)',
    machineDeviceTool: 'N/A (ensayo de laboratorio del cliente o tercero)',
    componentMaterial: 'Pellet virgen',
    characteristic: 'Flamabilidad del material (aplicable solo a piezas de cabina interior cuando el cliente lo requiera)',
    productCharacteristic: 'Flamabilidad del material (aplicable solo a piezas de cabina interior cuando el cliente lo requiera)',
    processCharacteristic: '',
    classification: '',
    specification: 'Segun norma del cliente (ej. TL 1010 para VWA, norma especifica para PWA/otros)',
    evaluationTechnique: 'Certificado de laboratorio por lote del proveedor o por ensayo externo',
    sampleSize: '1 muestra',
    sampleFrequency: 'Por entrega de lote',
    controlMethod: '',
    reactionPlanOwner: 'Laboratorio',
    reactionPlan: 'Segregar lote, notificar a proveedor s/ P-14. No usar hasta aprobacion de Ingenieria.',
    amfeCauseIds: [],
    linkedAmfeOperationId: '',
    autoFilledFields: ['manualControl', 'conditionalCustomer'],
    notes: 'Control condicional: aplica solo cuando el cliente lo especifica. Agregado en auditoria CP 2026-04-10 como gap identificado por E9 de GUIA_INYECCION.',
  };
  doc.items.push(flamItem);
  console.log(`  [Fix 4] Added E9 Flamabilidad control (conditional)`);
  fixes++;
}

// ── Fix 5: Recepcion items (OP 10) que no tienen P-14 en reactionPlan ──────
for (const item of doc.items) {
  if ((item.processStepNumber || '').startsWith('10') && item.reactionPlan && !item.reactionPlan.includes('P-14')) {
    const before = item.reactionPlan;
    item.reactionPlan = 'Segregar lote, notificar a proveedor s/ P-14. ' + before;
    console.log(`  [Fix 5] Added P-14 reference to OP 10 item: ${(item.characteristic || '').slice(0, 50)}`);
    fixes++;
  }
}

// ── Fix 6: Items con sampleSize="TBD" o sampleFrequency="TBD" sin contexto ─
for (const item of doc.items) {
  if (item.sampleSize === 'TBD' || item.sampleSize === 'tbd') {
    item.sampleSize = 'TBD — pendiente definicion con Metrologia / Ingenieria';
    console.log(`  [Fix 6] sampleSize TBD context added`);
    fixes++;
  }
  if (item.sampleFrequency === 'TBD' || item.sampleFrequency === 'tbd') {
    item.sampleFrequency = 'TBD — pendiente definicion con Metrologia / Ingenieria';
    console.log(`  [Fix 6] sampleFrequency TBD context added`);
    fixes++;
  }
}

// ── Fix 7: certificado proveedor sampleSize "1 pieza" -> "1 documento" ────
for (const item of doc.items) {
  const combined = `${item.characteristic || ''} ${item.productCharacteristic || ''}`.toLowerCase();
  if (combined.includes('certificado del proveedor') && item.sampleSize === '1 pieza') {
    item.sampleSize = '1 documento';
    console.log(`  [Fix 7] certificado: sampleSize "1 pieza" -> "1 documento"`);
    fixes++;
  }
}

// ── Save back ──
doc.items = doc.items; // ensure still an array
const newDataStr = JSON.stringify(doc);
await sb.from('cp_documents').update({ data: newDataStr, item_count: doc.items.length }).eq('id', CP_ID);

// Verify
const { data: v } = await sb.from('cp_documents').select('data, item_count').eq('id', CP_ID).single();
const vd = JSON.parse(v.data);
console.log(`\nFinal items: ${vd.items.length} (item_count col: ${v.item_count})`);
console.log(`Total fixes applied: ${fixes}`);
console.log(`Verify OK: ${Array.isArray(vd.items)}`);

process.exit(0);

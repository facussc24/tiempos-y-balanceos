#!/usr/bin/env node
/**
 * Script D — Link 12 headrest QC items to CP items + add 10 PWA prevention controls
 *
 * Part 1: 12 QC items without cpItemId in headrest HOs
 *   - Op 10 "Color de componente vs Orden de Produccion" → match CP item by characteristic
 *   - Op 35 "Largo de puntada", "Color de hilo correcto", "Apariencia general costura vista"
 *
 * Part 2: 10 AMFE causes without preventionControl in PWA products
 *   - 7 in Planas (Op 10, 10b, 80)
 *   - 3 in Termoformadas (Op 50, 60)
 */
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function parseData(row) { return typeof row.data === 'string' ? JSON.parse(row.data) : row.data; }

async function updateDoc(table, id, data, extraCols = '') {
  const jsonStr = JSON.stringify(data).replace(/'/g, "''");
  const cs = sha256(JSON.stringify(data));
  await execSql(`UPDATE ${table} SET data = '${jsonStr}', checksum = '${cs}'${extraCols}, updated_at = NOW() WHERE id = '${id}'`);
}

// Known CP item IDs for matching (from data exploration)
const CP_MATCHES = {
  'CP-HR-FRONT-L0': {
    '10': { 'Color de componente vs Orden de Produccion': 'dc963cd1-84ec-4bbc-8ce3-3f4fc5417f32' },
    '35': {
      'Largo de puntada': '541a7f0f-f0ff-4a43-98e1-52d5de5993d8',
      'Color de hilo correcto': '4c541b35-be02-469a-ab2d-6b70c4655717',
      'Apariencia general costura vista': '191e3bc9-dd95-4879-a2c3-b4e66795ffbd'
    }
  },
  'CP-HR-REAR_CEN-L0': {
    '10': { 'Color de componente vs Orden de Produccion': 'd501d100-9a4f-41e1-8cbe-67433189ff13' },
    '35': {
      'Largo de puntada': 'bf8d8df4-1b0e-47ef-a6ce-f6d77af8746f',
      'Color de hilo correcto': 'aef063a8-8b96-48e0-8c39-2d866968ea07',
      'Apariencia general costura vista': '9037112b-5d69-40f3-b484-2debd0bf10bc'
    }
  },
  'CP-HR-REAR_OUT-L0': {
    '10': { 'Color de componente vs Orden de Produccion': 'e48e9205-53ec-4c11-aa79-109a9130ddea' },
    '35': {
      'Largo de puntada': 'c849687c-a19b-421b-937f-bb10ab3ebdbc',
      'Color de hilo correcto': '783c204f-292e-48c1-8ac5-9f5dfdf412d0',
      'Apariencia general costura vista': 'ea7c506b-efcb-45a3-98ef-0a0c5c0af1eb'
    }
  }
};

// Map HO part_description patterns to CP numbers
const HO_TO_CP = [
  { hoMatch: /Delantero/i, cpNum: 'CP-HR-FRONT-L0' },
  { hoMatch: /Trasero Central/i, cpNum: 'CP-HR-REAR_CEN-L0' },
  { hoMatch: /Trasero Lateral/i, cpNum: 'CP-HR-REAR_OUT-L0' },
];

async function main() {
  await initSupabase();

  // ═══════════════════════════════════════════════════════════════
  // PART 1: Link 12 headrest QC items
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== Part 1: Link headrest QC items to CP ===\n');

  const hoRows = await selectSql("SELECT id, data, part_description FROM ho_documents WHERE part_description ILIKE '%apoyacabeza%'");
  let linkedCount = 0;

  for (const hoRow of hoRows) {
    const mapping = HO_TO_CP.find(m => m.hoMatch.test(hoRow.part_description));
    if (!mapping) {
      console.log(`  SKIP: No CP mapping for "${hoRow.part_description}"`);
      continue;
    }

    const cpMatches = CP_MATCHES[mapping.cpNum];
    if (!cpMatches) {
      console.log(`  SKIP: No match data for ${mapping.cpNum}`);
      continue;
    }

    console.log(`  Processing: ${hoRow.part_description.slice(0, 35)} → ${mapping.cpNum}`);
    const hoData = parseData(hoRow);
    let modified = false;

    for (const sheet of hoData.sheets) {
      for (const qc of (sheet.qualityChecks || [])) {
        if (qc.cpItemId && qc.cpItemId.trim() !== '') continue; // already linked

        const opMatches = cpMatches[sheet.operationNumber];
        if (!opMatches) continue;

        const cpItemId = opMatches[qc.characteristic];
        if (cpItemId) {
          qc.cpItemId = cpItemId;
          console.log(`    Linked Op${sheet.operationNumber} "${qc.characteristic}" → ${cpItemId.slice(0,12)}`);
          linkedCount++;
          modified = true;
        }
      }
    }

    if (modified) {
      await updateDoc('ho_documents', hoRow.id, hoData, `, sheet_count = ${hoData.sheets.length}`);
      console.log(`    HO saved`);
    }
  }
  console.log(`\n  Total QC items linked: ${linkedCount}/12`);

  // ═══════════════════════════════════════════════════════════════
  // PART 2: Add prevention controls to PWA AMFEs
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== Part 2: Add prevention controls to PWA AMFEs ===\n');

  // Prevention control templates by cause pattern
  const PREVENTION_MAP = [
    {
      // Op 10/10b recepcion: "Material fuera de especificacion requerida"
      causeMatch: /material fuera de especificacion/i,
      opMatch: /^10/,
      control: "Certificado de calidad del proveedor y verificacion de especificacion en orden de compra"
    },
    {
      // Op 80: "Error de conteo"
      causeMatch: /error de conteo/i,
      control: "Planilla de conteo por contenedor con doble verificacion"
    },
    {
      // Op 50: "Orificios fuera de posicion"
      causeMatch: /orificios fuera de posicion/i,
      control: "Programa de corte laser validado y mantenimiento preventivo del equipo"
    },
    {
      // Op 50: "Falta de orificios"
      causeMatch: /falta de orificios/i,
      control: "Programa de corte laser validado y verificacion de plantilla antes de cada lote"
    },
    {
      // Op 60: "Programacion equivocada de la maquina"
      causeMatch: /programacion equivocada/i,
      control: "Receta de troquelado validada por Ingenieria y liberacion de primera pieza"
    }
  ];

  for (const amfeNum of ['AMFE-PWA-112', 'AMFE-PWA-113']) {
    console.log(`  Processing ${amfeNum}...`);
    const [amfeRow] = await selectSql(`SELECT id, data FROM amfe_documents WHERE amfe_number = '${amfeNum}'`);
    const amfeData = parseData(amfeRow);
    let fixedCount = 0;

    for (const op of amfeData.operations) {
      const opNum = op.opNumber;
      for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
          for (const f of (fn.failures || [])) {
            for (const c of (f.causes || [])) {
              if (c.preventionControl && c.preventionControl.trim() !== '') continue;

              // Find matching template
              const template = PREVENTION_MAP.find(t => {
                const causeMatch = t.causeMatch.test(c.cause || '');
                const opMatch = t.opMatch ? t.opMatch.test(opNum) : true;
                return causeMatch && opMatch;
              });

              if (template) {
                c.preventionControl = template.control;
                console.log(`    Op${opNum}: "${(c.cause||'').slice(0,35)}" → "${template.control.slice(0,50)}..."`);
                fixedCount++;
              }
            }
          }
        }
      }
    }

    if (fixedCount > 0) {
      await updateDoc('amfe_documents', amfeRow.id, amfeData);
      console.log(`    Saved ${amfeNum}: ${fixedCount} prevention controls added`);
    } else {
      console.log(`    No empty prevention controls found (or no matching templates)`);
    }
  }

  console.log('\n=== Script D complete ===');
  close();
}

main().catch(e => { console.error('FATAL:', e); close(); process.exit(1); });

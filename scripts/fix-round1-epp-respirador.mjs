#!/usr/bin/env node
/**
 * fix-round1-epp-respirador.mjs
 *
 * Agrega 'respirador' y 'delantal' a safetyElements de hojas de operaciones
 * cuya operación sea de inyección, espumado o adhesivado (riesgo químico/vapores).
 *
 * Solo modifica HO masters de los 5 productos VWA/PATAGONIA indicados.
 */
import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// Operaciones de riesgo químico/vapores (case-insensitive)
const RISK_KEYWORDS = ['inyeccion', 'inyección', 'espumado', 'adhesivado'];

function matchesRiskOperation(operationName) {
  if (!operationName) return false;
  const lower = operationName.toLowerCase();
  return RISK_KEYWORDS.some(kw => lower.includes(kw));
}

async function main() {
  await initSupabase();

  const projects = [
    'VWA/PATAGONIA/HEADREST_FRONT',
    'VWA/PATAGONIA/HEADREST_REAR_CEN',
    'VWA/PATAGONIA/HEADREST_REAR_OUT',
    'VWA/PATAGONIA/INSERTO',
    'VWA/PATAGONIA/ARMREST_DOOR_PANEL',
  ];

  const placeholders = projects.map(p => `'${p}'`).join(',');
  const query = `SELECT id, data, linked_amfe_project FROM ho_documents WHERE linked_amfe_project IN (${placeholders})`;

  console.log('\n=== Buscando HO documents ===');
  const rows = await selectSql(query);
  console.log(`  Encontrados: ${rows.length} documentos HO\n`);

  let totalSheetsModified = 0;
  let totalDocsUpdated = 0;
  const statsByProduct = {};

  for (const row of rows) {
    const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const product = row.linked_amfe_project;

    if (!statsByProduct[product]) {
      statsByProduct[product] = { sheets: 0, docs: 0 };
    }

    let docModified = false;

    // Iterate over sheets in the document
    const sheets = doc.sheets || [];
    for (const sheet of sheets) {
      const opName = sheet.operationName || '';
      if (!matchesRiskOperation(opName)) continue;

      // safetyElements is the array of PPE items
      if (!Array.isArray(sheet.safetyElements)) {
        sheet.safetyElements = [];
      }

      const before = [...sheet.safetyElements];
      let sheetChanged = false;

      // Add 'respirador' if not present
      if (!sheet.safetyElements.some(e => (typeof e === 'string' ? e : e.name || '').toLowerCase() === 'respirador')) {
        sheet.safetyElements.push('respirador');
        sheetChanged = true;
      }

      // Add 'delantal' if not present
      if (!sheet.safetyElements.some(e => (typeof e === 'string' ? e : e.name || '').toLowerCase() === 'delantal')) {
        sheet.safetyElements.push('delantal');
        sheetChanged = true;
      }

      if (sheetChanged) {
        const opNum = sheet.operationNumber || sheet.number || '?';
        console.log(`  Producto: ${product}`);
        console.log(`  Operación: ${opNum} - ${opName}`);
        console.log(`  EPP antes:   [${before.map(e => typeof e === 'string' ? e : e.name || e).join(', ')}]`);
        console.log(`  EPP después: [${sheet.safetyElements.map(e => typeof e === 'string' ? e : e.name || e).join(', ')}]`);
        const added = sheet.safetyElements.filter(e => {
          const name = typeof e === 'string' ? e : e.name || '';
          return !before.some(b => (typeof b === 'string' ? b : b.name || '') === name);
        });
        console.log(`  EPP agregado: [${added.map(e => typeof e === 'string' ? e : e.name || e).join(', ')}]`);
        console.log('');

        totalSheetsModified++;
        statsByProduct[product].sheets++;
        docModified = true;
      }
    }

    if (docModified) {
      const jsonStr = JSON.stringify(doc);
      const checksum = sha256(jsonStr);
      await execSql(
        `UPDATE ho_documents SET data = '${jsonStr.replace(/'/g, "''")}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${row.id}'`
      );
      console.log(`  >> Documento ${row.id} actualizado (${product})\n`);
      totalDocsUpdated++;
      statsByProduct[product].docs++;
    }
  }

  console.log('=== RESUMEN ===');
  console.log(`Total hojas modificadas: ${totalSheetsModified}`);
  console.log(`Total documentos HO actualizados: ${totalDocsUpdated}`);
  console.log('');
  console.log('Por producto:');
  for (const [product, stats] of Object.entries(statsByProduct)) {
    if (stats.sheets > 0) {
      console.log(`  ${product}: ${stats.sheets} hojas, ${stats.docs} doc(s)`);
    }
  }

  close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});

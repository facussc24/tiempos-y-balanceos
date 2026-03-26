#!/usr/bin/env node
/**
 * consolidate-D-delete-variants.mjs
 *
 * Deletes the 27 headrest variant documents (9 AMFE + 9 CP + 9 HO for L1/L2/L3)
 * and cleans up related records in linked tables.
 *
 * Idempotent: safe to re-run if partially completed.
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

const POSITIONS = ['FRONT', 'REAR_CEN', 'REAR_OUT'];
const LEVELS = ['L1', 'L2', 'L3'];

function buildProjectName(suffix, level) {
  return `VWA/PATAGONIA/HEADREST_${suffix} [${level}]`;
}

async function main() {
  await initSupabase();

  // =========================================================================
  // Step 1: Identify variant documents
  // =========================================================================
  console.log('\n=== STEP 1: Identify variant documents ===\n');

  const amfeIds = [];
  const cpIds = [];
  const hoIds = [];

  for (const suffix of POSITIONS) {
    for (const level of LEVELS) {
      const projectName = buildProjectName(suffix, level);

      const amfeDocs = await selectSql(
        `SELECT id FROM amfe_documents WHERE project_name = '${projectName.replace(/'/g, "''")}'`
      );
      for (const row of amfeDocs) amfeIds.push(row.id);

      const cpDocs = await selectSql(
        `SELECT id FROM cp_documents WHERE project_name = '${projectName.replace(/'/g, "''")}'`
      );
      for (const row of cpDocs) cpIds.push(row.id);

      const hoDocs = await selectSql(
        `SELECT id FROM ho_documents WHERE linked_amfe_project = '${projectName.replace(/'/g, "''")}'`
      );
      for (const row of hoDocs) hoIds.push(row.id);

      const found = amfeDocs.length + cpDocs.length + hoDocs.length;
      if (found > 0) {
        console.log(`  ${projectName}: AMFE=${amfeDocs.length}, CP=${cpDocs.length}, HO=${hoDocs.length}`);
      } else {
        console.log(`  ${projectName}: (already deleted or not found)`);
      }
    }
  }

  console.log(`\nVariant docs still in DB: AMFE=${amfeIds.length}, CP=${cpIds.length}, HO=${hoIds.length}`);
  console.log(`Grand total: ${amfeIds.length + cpIds.length + hoIds.length}\n`);

  const allDocIds = [...amfeIds, ...cpIds, ...hoIds];

  // =========================================================================
  // Step 2: Identify family_documents entries for variants
  // =========================================================================
  console.log('=== STEP 2: Identify family_documents entries for variants ===\n');

  // Find headrest variant family_documents by family name pattern (catches orphans too)
  const fdRows = await selectSql(
    `SELECT fd.id, fd.module, fd.document_id, fd.is_master, fd.source_master_id, pf.name as family_name
     FROM family_documents fd
     JOIN product_families pf ON pf.id = fd.family_id
     WHERE fd.is_master = 0
       AND pf.name LIKE 'Headrest%'`
  );

  const fdIds = fdRows.map(r => r.id);
  const fdDocIds = fdRows.map(r => r.document_id);
  console.log(`  Found ${fdRows.length} headrest variant family_document entries:`);
  for (const row of fdRows) {
    console.log(`    fd.id=${row.id} family=${row.family_name} module=${row.module} doc_id=${row.document_id}`);
  }
  console.log('');

  // Merge document IDs: from step 1 + from family_documents (catches orphan refs)
  const allTargetDocIds = [...new Set([...allDocIds, ...fdDocIds])];

  // =========================================================================
  // Step 3: Clean up linked tables (ORDER MATTERS!)
  // =========================================================================
  console.log('=== STEP 3: Clean up linked tables ===\n');

  // 3.1 family_document_overrides
  if (fdIds.length > 0) {
    const fdInClause = fdIds.map(id => `'${id}'`).join(', ');

    const res1 = await execSql(
      `DELETE FROM family_document_overrides WHERE family_doc_id IN (${fdInClause})`
    );
    console.log(`  3.1 family_document_overrides: ${res1.rowsAffected} rows deleted`);

    // 3.2 family_change_proposals
    const res2 = await execSql(
      `DELETE FROM family_change_proposals WHERE variant_family_doc_id IN (${fdInClause})`
    );
    console.log(`  3.2 family_change_proposals: ${res2.rowsAffected} rows deleted`);
  } else {
    console.log('  3.1 family_document_overrides: 0 (no family_documents to clean)');
    console.log('  3.2 family_change_proposals: 0 (no family_documents to clean)');
  }

  // 3.3 cross_doc_checks
  if (allTargetDocIds.length > 0) {
    const docInClause = allTargetDocIds.map(id => `'${id}'`).join(', ');
    const res3 = await execSql(
      `DELETE FROM cross_doc_checks WHERE source_doc_id IN (${docInClause}) OR target_doc_id IN (${docInClause})`
    );
    console.log(`  3.3 cross_doc_checks: ${res3.rowsAffected} rows deleted`);

    // 3.4 drafts
    const res4 = await execSql(
      `DELETE FROM drafts WHERE document_key IN (${docInClause})`
    );
    console.log(`  3.4 drafts: ${res4.rowsAffected} rows deleted`);
  } else {
    console.log('  3.3 cross_doc_checks: 0 (no doc IDs to clean)');
    console.log('  3.4 drafts: 0 (no doc IDs to clean)');
  }

  // 3.5 family_documents (variant entries)
  if (fdIds.length > 0) {
    const fdInClause = fdIds.map(id => `'${id}'`).join(', ');
    const res5 = await execSql(
      `DELETE FROM family_documents WHERE id IN (${fdInClause})`
    );
    console.log(`  3.5 family_documents (variants): ${res5.rowsAffected} rows deleted`);
  } else {
    console.log('  3.5 family_documents (variants): 0 (none found)');
  }

  // 3.6 Delete the actual documents (if still present)
  if (amfeIds.length > 0) {
    const amfeInClause = amfeIds.map(id => `'${id}'`).join(', ');
    const res6a = await execSql(`DELETE FROM amfe_documents WHERE id IN (${amfeInClause})`);
    console.log(`  3.6a amfe_documents: ${res6a.rowsAffected} rows deleted`);
  } else {
    console.log('  3.6a amfe_documents: 0 (already deleted)');
  }

  if (cpIds.length > 0) {
    const cpInClause = cpIds.map(id => `'${id}'`).join(', ');
    const res6b = await execSql(`DELETE FROM cp_documents WHERE id IN (${cpInClause})`);
    console.log(`  3.6b cp_documents: ${res6b.rowsAffected} rows deleted`);
  } else {
    console.log('  3.6b cp_documents: 0 (already deleted)');
  }

  if (hoIds.length > 0) {
    const hoInClause = hoIds.map(id => `'${id}'`).join(', ');
    const res6c = await execSql(`DELETE FROM ho_documents WHERE id IN (${hoInClause})`);
    console.log(`  3.6c ho_documents: ${res6c.rowsAffected} rows deleted`);
  } else {
    console.log('  3.6c ho_documents: 0 (already deleted)');
  }

  // =========================================================================
  // Step 4: Verification
  // =========================================================================
  console.log('\n=== STEP 4: Verification ===\n');

  const docCounts = await selectSql(`
    SELECT 'amfe' as tbl, COUNT(*) as cnt FROM amfe_documents
    UNION ALL SELECT 'cp', COUNT(*) FROM cp_documents
    UNION ALL SELECT 'ho', COUNT(*) FROM ho_documents
    UNION ALL SELECT 'pfd', COUNT(*) FROM pfd_documents
  `);
  console.log('  Document counts after deletion:');
  for (const row of docCounts) {
    console.log(`    ${row.tbl}: ${row.cnt}`);
  }

  const familyCount = await selectSql(`SELECT COUNT(*) as cnt FROM product_families`);
  console.log(`\n  product_families: ${familyCount[0]?.cnt} (expected 8)`);

  const masterCount = await selectSql(
    `SELECT COUNT(*) as cnt FROM family_documents WHERE is_master = 1`
  );
  console.log(`  family_documents (masters): ${masterCount[0]?.cnt}`);

  const variantCount = await selectSql(
    `SELECT COUNT(*) as cnt FROM family_documents WHERE is_master = 0`
  );
  console.log(`  family_documents (variants): ${variantCount[0]?.cnt} (headrest variants should be 0 now)`);

  // Show remaining variant details if any
  if (Number(variantCount[0]?.cnt) > 0) {
    const remaining = await selectSql(
      `SELECT fd.id, fd.module, fd.document_id, pf.name as family_name
       FROM family_documents fd
       JOIN product_families pf ON pf.id = fd.family_id
       WHERE fd.is_master = 0`
    );
    console.log('  Remaining variants:');
    for (const row of remaining) {
      console.log(`    family=${row.family_name} module=${row.module} doc=${row.document_id}`);
    }
  }

  console.log('\nDone.');
  close();
}

main().catch(err => {
  console.error('FATAL:', err);
  close();
  process.exit(1);
});

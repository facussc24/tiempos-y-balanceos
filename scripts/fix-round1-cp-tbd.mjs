#!/usr/bin/env node
import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// Patterns to match (case-insensitive, trimmed)
const GENERIC_PATTERNS = [
  /^según\s+instrucción\s+de\s+proceso$/i,
  /^segun\s+instruccion\s+de\s+proceso$/i,
  /^según\s+instrucción$/i,
  /^segun\s+instruccion$/i,
  /^según\s+plano$/i,
  /^segun\s+plano$/i,
];

const REPLACEMENT = 'TBD — Verificar contra plano/instruccion';

function isGenericSpec(spec) {
  if (!spec || typeof spec !== 'string') return false;
  const trimmed = spec.trim();
  return GENERIC_PATTERNS.some(pattern => pattern.test(trimmed));
}

async function main() {
  console.log('=== Fix Round 1: CP TBD Specifications ===\n');

  await initSupabase();

  const rows = await selectSql(
    `SELECT id, data, project_name FROM cp_documents WHERE project_name IN ('VWA/PATAGONIA/INSERT','VWA/PATAGONIA/TOP_ROLL')`
  );

  console.log(`\nFound ${rows.length} CP documents to process.\n`);

  let totalChanged = 0;
  let totalItems = 0;
  const allModified = [];

  for (const row of rows) {
    const cpData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const items = cpData.items || [];
    let changed = 0;

    for (const item of items) {
      if (isGenericSpec(item.specification)) {
        const oldSpec = item.specification;
        item.specification = REPLACEMENT;
        changed++;
        allModified.push({
          project: row.project_name,
          processStepNumber: item.processStepNumber || '?',
          processDescription: item.processDescription || '?',
          oldSpec,
          newSpec: REPLACEMENT,
        });
      }
    }

    console.log(`[${row.project_name}] ${changed} items changed out of ${items.length} total`);
    totalChanged += changed;
    totalItems += items.length;

    if (changed > 0) {
      const jsonStr = JSON.stringify(cpData);
      const checksum = sha256(jsonStr);
      const itemCount = cpData.items.length;
      await execSql(
        `UPDATE cp_documents SET data = '${jsonStr.replace(/'/g, "''")}', checksum = '${checksum}', item_count = ${itemCount}, updated_at = NOW() WHERE id = '${row.id}'`
      );
      console.log(`  -> Updated in Supabase (checksum: ${checksum.slice(0, 12)}...)`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total items scanned: ${totalItems}`);
  console.log(`Total items changed: ${totalChanged}`);

  if (allModified.length > 0) {
    console.log(`\nFirst ${Math.min(10, allModified.length)} modified items:`);
    for (const mod of allModified.slice(0, 10)) {
      console.log(`  [${mod.project}] Step ${mod.processStepNumber} — ${mod.processDescription}`);
      console.log(`    OLD: "${mod.oldSpec}"`);
      console.log(`    NEW: "${mod.newSpec}"`);
    }
    if (allModified.length > 10) {
      console.log(`  ... and ${allModified.length - 10} more`);
    }
  }

  close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

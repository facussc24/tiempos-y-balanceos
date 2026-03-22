#!/usr/bin/env node
/**
 * fix-cp-toproll-frequencies.mjs
 *
 * Fixes CP-TOPROLL-001 time-based frequencies → event-based.
 *
 * Replaces "cada hora", "c/hora" patterns with event-based frequencies:
 *   - CC items → "100%"
 *   - SC items → "Inicio y fin de turno"
 *   - Others  → "Cada lote"
 *
 * "Cada 2 horas" items with SPC in controlMethod are kept as-is.
 *
 * Uses Supabase client API directly (exec_sql_read RPC does not return
 * rows for cp_documents due to Postgres function limitations).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Supabase setup (same pattern as supabaseHelper.mjs)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
  if (!match) throw new Error(`Missing ${key} in .env.local`);
  return match[1].trim();
}

const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('VITE_SUPABASE_ANON_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DOC_ID = '69f6daf9-f2aa-49bd-a70a-ff1b02fcec0d';

const BANNED_PATTERNS = [
  /cada\s*hora/i,
  /c\/hora/i,
  /cada\s*2\s*horas/i,
  /cada\s*3\s*horas/i,
  /cada\s*10\s*piezas/i,
];

async function main() {
  // Authenticate
  console.log('Connecting to Supabase...');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: getEnv('VITE_AUTO_LOGIN_EMAIL'),
    password: getEnv('VITE_AUTO_LOGIN_PASSWORD'),
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);
  console.log('Authenticated.\n');

  // 1. Query CP-TOPROLL-001
  console.log('=== Querying CP-TOPROLL-001 ===');
  const { data: row, error: fetchErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, data')
    .eq('id', DOC_ID)
    .single();

  if (fetchErr || !row) {
    console.error('ERROR: CP-TOPROLL-001 not found!', fetchErr);
    process.exit(1);
  }

  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  const items = data.items || [];
  console.log(`  Found: ${row.project_name} (${items.length} items)`);

  // 2. Loop through items, fix frequencies
  let changeCount = 0;

  for (const item of items) {
    const freq = item.sampleFrequency;
    if (!freq) continue;

    // Check for "c/hora" or "cada hora" (but NOT "cada 2 horas", "cada 3 horas")
    if (/c\/hora/i.test(freq) || (/cada\s*hora/i.test(freq) && !/cada\s*\d+\s*hora/i.test(freq))) {
      let newFreq;
      if (item.specialCharClass === 'CC') {
        newFreq = '100%';
      } else if (item.specialCharClass === 'SC') {
        newFreq = 'Inicio y fin de turno';
      } else {
        newFreq = 'Cada lote';
      }

      console.log(`  CHANGE: [${item.specialCharClass || '-'}] "${freq}" -> "${newFreq}"  (${item.processDescription || '?'})`);
      item.sampleFrequency = newFreq;
      changeCount++;
      continue;
    }

    // Check for "Cada 2 horas"
    if (/^cada\s*2\s*horas$/i.test(freq.trim())) {
      const controlMethod = (item.controlMethod || '').toUpperCase();
      if (controlMethod.includes('SPC')) {
        console.log(`  KEEP:   [${item.specialCharClass || '-'}] "${freq}" (SPC monitoring)`);
        continue;
      }

      const newFreq = 'Inicio y fin de turno';
      console.log(`  CHANGE: [${item.specialCharClass || '-'}] "${freq}" -> "${newFreq}"  (${item.processDescription || '?'})`);
      item.sampleFrequency = newFreq;
      changeCount++;
      continue;
    }
  }

  console.log(`\n  Total changes: ${changeCount}`);

  // 3. Update if changes were made
  if (changeCount > 0) {
    console.log('\n=== Updating CP-TOPROLL-001 in Supabase ===');
    const { error: updateErr } = await supabase
      .from('cp_documents')
      .update({ data: data, updated_at: new Date().toISOString() })
      .eq('id', DOC_ID);

    if (updateErr) {
      console.error('UPDATE ERROR:', updateErr);
      process.exit(1);
    }
    console.log('  Updated successfully.');
  } else {
    console.log('\n  No changes needed — frequencies already event-based.');
  }

  // 4. Verification: check ALL cp_documents for banned patterns
  console.log('\n=== Verification: scanning ALL CP documents for banned patterns ===');
  const { data: allDocs, error: allErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, control_plan_number, data');

  if (allErr) {
    console.error('ERROR fetching all CPs:', allErr);
    process.exit(1);
  }

  console.log(`  Scanning ${allDocs.length} CP documents...`);

  let bannedCount = 0;
  for (const doc of allDocs) {
    const cpData = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    const cpItems = cpData.items || [];

    for (const item of cpItems) {
      const freq = item.sampleFrequency || '';
      for (const pattern of BANNED_PATTERNS) {
        if (pattern.test(freq)) {
          // Exception: "Cada 2 horas" with SPC is acceptable
          if (/cada\s*2\s*horas/i.test(freq) && (item.controlMethod || '').toUpperCase().includes('SPC')) {
            continue;
          }
          console.log(`  BANNED: ${doc.control_plan_number} | "${freq}" [${item.specialCharClass || '-'}]`);
          bannedCount++;
        }
      }
    }
  }

  console.log(`\n  Banned patterns found: ${bannedCount}`);
  if (bannedCount === 0) {
    console.log(`  ALL ${allDocs.length} CP documents are clean!`);
  } else {
    console.log('  WARNING: Some banned patterns remain!');
  }

  await supabase.auth.signOut();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  supabase.auth.signOut().catch(() => {});
  process.exit(1);
});

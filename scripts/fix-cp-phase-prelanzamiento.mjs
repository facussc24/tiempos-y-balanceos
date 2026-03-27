#!/usr/bin/env node
/**
 * fix-cp-phase-prelanzamiento.mjs
 *
 * Updates ALL cp_documents to phase = 'preLaunch' (Pre-Lanzamiento).
 * Changes both the `phase` column and `data.header.phase` JSON field.
 *
 * Usage: node scripts/fix-cp-phase-prelanzamiento.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Supabase setup
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

const TARGET_PHASE = 'preLaunch';

async function main() {
  console.log('Connecting to Supabase...');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: getEnv('VITE_AUTO_LOGIN_EMAIL'),
    password: getEnv('VITE_AUTO_LOGIN_PASSWORD'),
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);
  console.log('Authenticated.\n');

  // 1. Load ALL cp_documents
  console.log('=== Loading ALL CP documents ===');
  const { data: allDocs, error: fetchErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, phase, data');

  if (fetchErr || !allDocs) {
    console.error('ERROR loading CP documents:', fetchErr);
    process.exit(1);
  }
  console.log(`  Found ${allDocs.length} CP documents.\n`);

  let changes = 0;
  let alreadyOk = 0;

  for (const row of allDocs) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const header = data.header || {};
    const oldColumnPhase = row.phase || '';
    const oldJsonPhase = header.phase || '';

    if (oldColumnPhase === TARGET_PHASE && oldJsonPhase === TARGET_PHASE) {
      alreadyOk++;
      continue;
    }

    console.log(`  FIX: [${row.project_name}] column="${oldColumnPhase}" json="${oldJsonPhase}" -> "${TARGET_PHASE}"`);
    header.phase = TARGET_PHASE;
    data.header = header;

    // Update data JSON (stringified for TEXT column)
    const dataStr = typeof row.data === 'string' ? JSON.stringify(JSON.parse(row.data)) : JSON.stringify(row.data);
    const updatedDataStr = JSON.stringify(data);

    const { error: updateErr } = await supabase
      .from('cp_documents')
      .update({
        phase: TARGET_PHASE,
        data: updatedDataStr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (updateErr) {
      console.error(`  ERROR updating ${row.project_name}:`, updateErr);
    } else {
      // Verify the column update immediately
      const { data: check } = await supabase
        .from('cp_documents')
        .select('phase')
        .eq('id', row.id)
        .single();
      console.log(`  Updated ${row.project_name}. Column now: "${check?.phase}"`);
      changes++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Total documents: ${allDocs.length}`);
  console.log(`  Already preLaunch: ${alreadyOk}`);
  console.log(`  Changed to preLaunch: ${changes}`);

  // --- Verification ---
  console.log('\n=== Verification ===');
  const { data: verifyDocs, error: verifyErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, phase, data');

  if (verifyErr) {
    console.error('Verification fetch error:', verifyErr);
    process.exit(1);
  }

  let issues = 0;
  for (const row of verifyDocs) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const h = data.header || {};

    if (row.phase !== TARGET_PHASE) {
      console.error(`  FAIL: ${row.project_name} -- column phase = "${row.phase}"`);
      issues++;
    }
    if (h.phase !== TARGET_PHASE) {
      console.error(`  FAIL: ${row.project_name} -- JSON header.phase = "${h.phase}"`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log(`  All ${verifyDocs.length} documents verified OK — phase = "${TARGET_PHASE}".`);
  } else {
    console.error(`  ${issues} issue(s) found!`);
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

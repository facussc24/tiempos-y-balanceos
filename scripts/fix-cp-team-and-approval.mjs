#!/usr/bin/env node
/**
 * fix-cp-team-and-approval.mjs
 *
 * 1. Updates coreTeam in ALL CP documents to include Producción:
 *    "Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)"
 *
 * 2. Cleans up legacy customer approval fields: merges customerEngApproval +
 *    customerQualityApproval into single customerApproval, removes legacy keys.
 *
 * Usage: node scripts/fix-cp-team-and-approval.mjs
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

const NEW_TEAM = 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)';

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
    .select('id, project_name, control_plan_number, data');

  if (fetchErr || !allDocs) {
    console.error('ERROR loading CP documents:', fetchErr);
    process.exit(1);
  }
  console.log(`  Found ${allDocs.length} CP documents.\n`);

  let teamChanges = 0;
  let approvalChanges = 0;

  for (const row of allDocs) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const header = data.header || {};
    let changed = false;

    // --- Fix 1: coreTeam ---
    const oldTeam = header.coreTeam || '';
    if (oldTeam !== NEW_TEAM) {
      console.log(`  TEAM: [${row.project_name}] "${oldTeam}" -> NEW_TEAM`);
      header.coreTeam = NEW_TEAM;
      changed = true;
      teamChanges++;
    }

    // --- Fix 2: merge legacy approval fields ---
    if (header.customerEngApproval !== undefined || header.customerQualityApproval !== undefined) {
      const eng = header.customerEngApproval || '';
      const qual = header.customerQualityApproval || '';
      const merged = [eng, qual].filter(Boolean).join(' / ');
      if (!header.customerApproval && merged) {
        header.customerApproval = merged;
      }
      delete header.customerEngApproval;
      delete header.customerQualityApproval;
      console.log(`  APPROVAL: [${row.project_name}] removed legacy fields (eng="${eng}", qual="${qual}")`);
      changed = true;
      approvalChanges++;
    }

    if (changed) {
      data.header = header;
      const { error: updateErr } = await supabase
        .from('cp_documents')
        .update({ data: data, updated_at: new Date().toISOString() })
        .eq('id', row.id);

      if (updateErr) {
        console.error(`  ERROR updating ${row.project_name}:`, updateErr);
      } else {
        console.log(`  Updated ${row.project_name}.`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Team changes: ${teamChanges}`);
  console.log(`  Approval cleanups: ${approvalChanges}`);

  // --- Verification ---
  console.log('\n=== Verification ===');
  const { data: verifyDocs, error: verifyErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, data');

  if (verifyErr) {
    console.error('Verification fetch error:', verifyErr);
    process.exit(1);
  }

  let issues = 0;
  for (const row of verifyDocs) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const h = data.header || {};

    if (h.coreTeam !== NEW_TEAM) {
      console.error(`  FAIL: ${row.project_name} -- coreTeam = "${h.coreTeam}"`);
      issues++;
    }
    if (h.customerEngApproval !== undefined || h.customerQualityApproval !== undefined) {
      console.error(`  FAIL: ${row.project_name} -- still has legacy approval fields`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log(`  All ${verifyDocs.length} documents verified OK.`);
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

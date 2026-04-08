/**
 * Fix double-serialization of IP PAD AMFE data column.
 * Reads the stored data, checks if it's a string (double-serialized),
 * and re-saves as proper object. Repeats until typeof === 'object'.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const AMFE_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

// Check current state
let { data: doc, error } = await sb
  .from('amfe_documents')
  .select('data')
  .eq('id', AMFE_ID)
  .single();

if (error) {
  console.error('Fetch error:', error.message);
  process.exit(1);
}

console.log('Current typeof data:', typeof doc.data);

// If it's a string, we need to parse and re-save
let attempts = 0;
while (typeof doc.data === 'string' && attempts < 5) {
  attempts++;
  console.log(`Attempt ${attempts}: parsing string to object...`);
  const parsed = JSON.parse(doc.data);
  console.log('  Parsed type:', typeof parsed);

  if (typeof parsed === 'object') {
    // Save back as object
    const { error: updateErr } = await sb
      .from('amfe_documents')
      .update({ data: parsed })
      .eq('id', AMFE_ID);

    if (updateErr) {
      console.error('Update error:', updateErr.message);
      process.exit(1);
    }
    console.log('  Saved object back to Supabase');
  }

  // Re-read to verify
  const { data: recheck, error: recheckErr } = await sb
    .from('amfe_documents')
    .select('data')
    .eq('id', AMFE_ID)
    .single();

  if (recheckErr) {
    console.error('Recheck error:', recheckErr.message);
    process.exit(1);
  }

  doc = recheck;
  console.log(`  After save, typeof data: ${typeof doc.data}`);
}

if (typeof doc.data === 'object') {
  console.log('\nSUCCESS: data is a proper object');
  console.log('Operations:', doc.data.operations?.length);

  // Verify OP 10 has the new WEs
  const op10 = doc.data.operations?.find(op => (op.operationNumber || op.opNumber) === '10');
  if (op10) {
    console.log('\nOP 10 WEs:');
    for (const we of (op10.workElements || [])) {
      console.log(`  - "${we.name}" [${we.type}]`);
    }
  }

  // Verify OP 110 renamed
  const op110 = doc.data.operations?.find(op => (op.operationNumber || op.opNumber) === '110');
  if (op110) {
    console.log(`\nOP 110 name: "${op110.name || op110.operationName}"`);
  }

  // Verify OP 130 (no embalaje WE)
  const op130 = doc.data.operations?.find(op => (op.operationNumber || op.opNumber) === '130');
  if (op130) {
    console.log('\nOP 130 WEs:');
    for (const we of (op130.workElements || [])) {
      console.log(`  - "${we.name}" [${we.type}]`);
    }
  }

  // Verify OP 140 (has embalaje WE)
  const op140 = doc.data.operations?.find(op => (op.operationNumber || op.opNumber) === '140');
  if (op140) {
    console.log('\nOP 140 WEs:');
    for (const we of (op140.workElements || [])) {
      console.log(`  - "${we.name}" [${we.type}]`);
    }
  }
} else {
  console.error(`FAILED: data is still "${typeof doc.data}" after ${attempts} attempts`);
  process.exit(1);
}

process.exit(0);

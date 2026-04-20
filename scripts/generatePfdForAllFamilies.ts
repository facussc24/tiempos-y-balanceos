// Generate PFDs for all AMFE documents that don't have one yet.
// Uses existing pfdGenerator.ts (full version with transport inference, CC/SC, etc.).
// Run: node_modules/.bin/tsx scripts/generatePfdForAllFamilies.ts [--only AMFE-TR-PAT] [--dry]
//
// READ: amfe_documents
// WRITE: pfd_documents (one per AMFE, linked via linkedAmfeId = amfe_number)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { generatePfdFromAmfe } from '../modules/pfd/pfdGenerator';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env: Record<string, string> = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL,
  password: env.VITE_AUTO_LOGIN_PASSWORD,
});

const DRY = process.argv.includes('--dry');
const ONLY_IDX = process.argv.indexOf('--only');
const ONLY = ONLY_IDX >= 0 ? process.argv[ONLY_IDX + 1] : null;

const { data: amfes, error: amfeErr } = await sb.from('amfe_documents').select('id, amfe_number, data');
if (amfeErr) { console.error('AMFE error:', amfeErr); process.exit(1); }

const { data: existingPfds } = await sb.from('pfd_documents').select('id, data');
const existingLinks = new Set<string>();
for (const p of existingPfds || []) {
  const d: any = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
  const linkId = d?.header?.linkedAmfeId || d?.header?.linkedAmfeProject;
  if (linkId) existingLinks.add(String(linkId));
}

console.log(`Total AMFEs: ${amfes?.length || 0}`);
console.log(`Existing PFDs linked: ${existingLinks.size}`);

const SKIP_MASTERS = ['AMFE-MAESTRO-LOG-REC-001', 'AMFE-MAESTRO-INY-001'];

let generated = 0;
let skipped = 0;

for (const a of amfes || []) {
  if (ONLY && a.amfe_number !== ONLY) continue;
  if (SKIP_MASTERS.includes(a.amfe_number)) { console.log(`  SKIP master: ${a.amfe_number}`); skipped++; continue; }
  if (existingLinks.has(a.amfe_number) && !ONLY) { console.log(`  SKIP already has PFD: ${a.amfe_number}`); skipped++; continue; }

  const data: any = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
  const opsCount = (data?.operations || []).length;
  if (opsCount === 0) { console.log(`  SKIP no ops: ${a.amfe_number}`); skipped++; continue; }

  console.log(`\n--- ${a.amfe_number} (${opsCount} ops) ---`);
  const result = generatePfdFromAmfe(data, a.amfe_number, { transportMode: 'cross-sector' });
  console.log(`  Generated ${result.document.steps.length} steps`);
  for (const w of result.warnings) console.log(`  WARN: ${w}`);

  if (DRY) { console.log(`  DRY: would save to pfd_documents`); continue; }

  // Ensure linkedAmfeId set for cross-reference
  result.document.header.linkedAmfeId = a.amfe_number;
  result.document.header.linkedAmfeProject = a.amfe_number;

  const { error: insErr } = await sb.from('pfd_documents').insert({
    id: result.document.id,
    data: result.document,
  });
  if (insErr) { console.error(`  INSERT ERROR: ${insErr.message}`); continue; }
  console.log(`  SAVED id=${result.document.id}`);
  generated++;
}

console.log(`\n===== DONE ${DRY ? '(DRY)' : ''} =====`);
console.log(`Generated: ${generated}  Skipped: ${skipped}`);
process.exit(0);

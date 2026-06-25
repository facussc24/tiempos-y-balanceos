// Actualiza data + conteos de AMFE 128/129 ya existentes (tras completar O/D). Service key via env.
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');
function counts(doc) {
  let ops = doc.operations.length, c = 0, apH = 0, apM = 0;
  for (const op of doc.operations) for (const we of op.workElements || []) for (const fn of we.functions || []) for (const f of fn.failures || []) for (const x of f.causes || []) {
    c++; const ap = (x.ap || x.actionPriority || '').toUpperCase(); if (ap === 'H') apH++; else if (ap === 'M') apM++;
  }
  return { ops, c, apH, apM };
}
for (const k of ['128', '129']) {
  const doc = JSON.parse(readFileSync(`tmp/amfe${k}.barack.json`, 'utf8'));
  const dataStr = JSON.stringify(doc); const s = counts(doc);
  const { error } = await sb.from('amfe_documents').update({
    data: dataStr, operation_count: s.ops, cause_count: s.c, ap_h_count: s.apH, ap_m_count: s.apM,
  }).eq('amfe_number', k);
  if (error) { console.error(`UPDATE ${k} FALLO:`, error.message); continue; }
  const { data: v } = await sb.from('amfe_documents').select('data,operation_count,cause_count,ap_h_count,ap_m_count').eq('amfe_number', k).single();
  const back = typeof v.data === 'string' ? v.data : JSON.stringify(v.data);
  console.log(`AMFE ${k}: UPDATE OK | ops=${v.operation_count} causes=${v.cause_count} apH=${v.ap_h_count} apM=${v.ap_m_count} | md5 ${md5(back) === md5(dataStr) ? 'COINCIDE ✓' : '*** DIFIERE ***'}`);
}
console.log('DONE');

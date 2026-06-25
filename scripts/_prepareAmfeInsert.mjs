// Prepara payloads de INSERT para amfe_documents (carga via MCP, sin .env.local).
// Lee tmp/amfeNNN.barack.json -> tmp/amfeNNN.data.txt (JSON string) + tmp/amfeNNN.meta.json.
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID, createHash } from 'crypto';

const HEADERS = {
  '128': { ip: '115', project: 'VWA/AMAROK_PA2/IP_DECORATIVE_115', subject: 'IP DECORATIVE PA2 AMAROK - IP CORTO', part: '2HT.857.115 HOA / 2HT.857.115 YZM / 2HT.857.115 DEC' },
  '129': { ip: '116', project: 'VWA/AMAROK_PA2/IP_DECORATIVE_116', subject: 'IP DECORATIVE PA2 AMAROK', part: '2HT.857.116 HOA / 2HT.857.116 YZM / 2HT.857.116 DEC' },
};

function stats(doc) {
  let ops = doc.operations.length, causes = 0, apH = 0, apM = 0;
  for (const op of doc.operations) for (const we of op.workElements || []) for (const fn of we.functions || []) for (const f of fn.failures || []) for (const c of f.causes || []) {
    causes++; const ap = (c.ap || c.actionPriority || '').toUpperCase(); if (ap === 'H') apH++; else if (ap === 'M') apM++;
  }
  return { ops, causes, apH, apM };
}

for (const k of ['128', '129']) {
  const doc = JSON.parse(readFileSync(`tmp/amfe${k}.barack.json`, 'utf8'));
  const h = HEADERS[k];
  const s = stats(doc);
  const dataStr = JSON.stringify(doc);
  const id = randomUUID();
  const md5 = createHash('md5').update(dataStr).digest('hex');
  const today = '2026-06-25';
  const meta = {
    id, amfe_number: k, project_name: h.project, subject: h.subject, client: 'VWA',
    part_number: h.part, responsible: 'Paulo Centurión', organization: 'BARACK MERCOSUL',
    status: 'draft', operation_count: s.ops, cause_count: s.causes, ap_h_count: s.apH, ap_m_count: s.apM,
    coverage_percent: 0, start_date: today, last_revision_date: today, revision_level: 'G',
    revisions: '[]', checksum: '', data_md5: md5, data_bytes: Buffer.byteLength(dataStr, 'utf8'),
  };
  // delimitador dollar-quote seguro (no presente en data)
  let delim = '$amfepa2$';
  if (dataStr.includes(delim)) delim = '$amfepa2x' + md5.slice(0, 6) + '$';
  if (dataStr.includes(delim)) throw new Error('delimitador en data, abortar');
  const cols = ['id', 'amfe_number', 'project_name', 'subject', 'client', 'part_number', 'responsible', 'organization', 'status', 'operation_count', 'cause_count', 'ap_h_count', 'ap_m_count', 'coverage_percent', 'start_date', 'last_revision_date', 'revision_level', 'data', 'revisions', 'checksum', 'created_at', 'updated_at'];
  const sq = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const vals = [sq(id), sq(k), sq(h.project), sq(h.subject), sq('VWA'), sq(h.part), sq('Paulo Centurión'), sq('BARACK MERCOSUL'), sq('draft'), s.ops, s.causes, s.apH, s.apM, 0, sq(today), sq(today), sq('G'), `${delim}${dataStr}${delim}`, sq('[]'), sq(''), 'now()', 'now()'];
  const sql = `INSERT INTO amfe_documents (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
  writeFileSync(`tmp/amfe${k}.data.txt`, dataStr);
  writeFileSync(`tmp/amfe${k}.meta.json`, JSON.stringify(meta, null, 1));
  writeFileSync(`tmp/amfe${k}.insert.sql`, sql);
  console.log(`AMFE ${k} (IP ${h.ip}): ops=${s.ops} causes=${s.causes} apH=${s.apH} apM=${s.apM} | data=${(meta.data_bytes/1024).toFixed(1)}KB md5=${md5.slice(0,8)} id=${id} sqlBytes=${Buffer.byteLength(sql,'utf8')}`);
}

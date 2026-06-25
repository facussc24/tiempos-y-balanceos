// Parte el doc Barack en header + cada operación (con md5), para carga staged via MCP.
// Auto-verifica que el ensamblado reproduzca exacto JSON.stringify(doc) (mismo md5).
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');

for (const k of ['128', '129']) {
  const doc = JSON.parse(readFileSync(`tmp/amfe${k}.barack.json`, 'utf8'));
  const full = JSON.stringify(doc);
  const headerText = JSON.stringify(doc.header);
  const opTexts = doc.operations.map(op => JSON.stringify(op));
  // ensamblado que reproduce JSON.stringify({header, operations})
  const assembled = `{"header":${headerText},"operations":[${opTexts.join(',')}]}`;
  const ok = md5(assembled) === md5(full);
  const parts = {
    full_md5: md5(full), full_bytes: Buffer.byteLength(full, 'utf8'),
    header: { text: headerText, md5: md5(headerText), bytes: Buffer.byteLength(headerText, 'utf8') },
    ops: opTexts.map((t, i) => ({ idx: i + 1, opNum: doc.operations[i].operationNumber, md5: md5(t), bytes: Buffer.byteLength(t, 'utf8') })),
  };
  writeFileSync(`tmp/amfe${k}.parts.json`, JSON.stringify(parts, null, 1));
  // escribir cada parte como archivo de texto crudo (para Read + dollar-quote en MCP)
  writeFileSync(`tmp/amfe${k}.part0.txt`, headerText);
  opTexts.forEach((t, i) => writeFileSync(`tmp/amfe${k}.part${i + 1}.txt`, t));
  console.log(`AMFE ${k}: ensamblado==full? ${ok ? 'SÍ ✓' : '*** NO ***'} | full=${(parts.full_bytes/1024).toFixed(1)}KB md5=${parts.full_md5.slice(0,8)}`);
  console.log(`   header ${parts.header.bytes}b md5=${parts.header.md5.slice(0,8)}`);
  parts.ops.forEach(o => console.log(`   op${o.idx} (OP${o.opNum}) ${o.bytes}b md5=${o.md5.slice(0,8)}`));
}

// Volcado de solo lectura de AMFE live a texto plano (tarea Nicolas Perez 01/10/2026)
import { connectSupabase, listAmfes, readAmfe } from '../_lib/amfeIo.mjs';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2];
const quiero = process.argv.slice(3);
const sb = await connectSupabase();
const todos = await listAmfes(sb);
for (const a of todos) {
  const tag = `${a.amfe_number} ${a.project_name}`;
  if (!quiero.some(q => tag.toUpperCase().includes(q.toUpperCase()))) continue;
  const { doc } = await readAmfe(sb, a.id);
  const L = [];
  L.push(`# AMFE ${a.amfe_number} · ${a.project_name} · id ${a.id} · leido de Supabase live ${new Date().toISOString()}`);
  L.push(`# header: ${JSON.stringify(doc.header || {}).slice(0, 1500)}`);
  for (const op of (doc.operations || [])) {
    const n = op.opNumber || op.operationNumber;
    L.push(`\n=== OP ${n} · ${op.name || op.operationName}`);
    for (const we of (op.workElements || [])) {
      L.push(`  -- WE [${we.type}] ${we.name}`);
      for (const fn of (we.functions || [])) {
        L.push(`     FUNC: ${fn.description || fn.name || ''}${fn.requirements ? ' | REQ: ' + fn.requirements : ''}`);
        for (const fm of (fn.failures || [])) {
          L.push(`       FALLA (S=${fm.severity}): ${fm.description || ''} | efectos: local=${fm.effectLocal || ''} / cliente=${fm.effectNextLevel || ''} / usuario=${fm.effectEndUser || ''}`);
          for (const c of (fm.causes || [])) {
            L.push(`         CAUSA: ${c.cause || c.description || ''} | PREV: ${c.preventionControl || ''} | DET: ${c.detectionControl || ''} | O=${c.occurrence} D=${c.detection} AP=${c.ap || c.actionPriority || ''} | SIGLA=${c.specialChar || ''} | caract=${c.characteristicNumber || ''}`);
          }
        }
      }
    }
  }
  const f = path.join(out, `AMFE_${a.amfe_number}_live.txt`.replace(/[^\w.\-]/g, '_'));
  fs.writeFileSync(f, L.join('\n'), 'utf8');
  fs.writeFileSync(f.replace('.txt', '.json'), JSON.stringify(doc, null, 1), 'utf8');
  console.log(tag, '->', f, L.length, 'lineas', (doc.operations||[]).length, 'ops');
}

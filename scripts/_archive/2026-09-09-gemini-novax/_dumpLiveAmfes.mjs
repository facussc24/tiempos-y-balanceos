import { writeFileSync } from 'fs';
import { connectSupabase, readAmfe } from './_lib/amfeIo.mjs';

const sb = await connectSupabase();
for (const [num, file] of [
    ['AMFE-INS-PAT', 'tmp/amfe_ins_pat_live.json'],
    ['AMFE-ARM-PAT', 'tmp/amfe_arm_pat_live.json'],
    ['AMFE-TR-PAT', 'tmp/amfe_tr_pat_live.json'],
]) {
    const { data: row } = await sb.from('amfe_documents').select('id').eq('amfe_number', num).single();
    const { doc } = await readAmfe(sb, row.id);
    writeFileSync(file, JSON.stringify(doc, null, 2));
    console.log(`Guardado ${file} (${doc.operations.length} ops)`);
}
process.exit(0);

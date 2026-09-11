import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';

const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name')
    .eq('amfe_number', 'AMFE-INS-PAT');

if (error) throw error;
if (!rows?.length) throw new Error('No se encontró AMFE-INS-PAT');

const row = rows[0];
const { doc } = await readAmfe(sb, row.id);

let countW = 0;
let countDtld = 0;

for (const op of doc.operations || []) {
    for (const we of op.workElements || []) {
        for (const fn of we.functions || []) {
            for (const fail of fn.failures || []) {
                if (fail.specialChar === 'W') { fail.specialChar = 'SC'; countW++; }
                else if (fail.specialChar === 'D/TLD') { fail.specialChar = 'CC'; countDtld++; }

                for (const c of fail.causes || []) {
                    if (c.specialChar === 'W') { c.specialChar = 'SC'; countW++; }
                    else if (c.specialChar === 'D/TLD') { c.specialChar = 'CC'; countDtld++; }
                }
            }
        }
    }
}

console.log(`Reemplazados en AMFE-INS-PAT: W -> SC (${countW}), D/TLD -> CC (${countDtld})`);

await saveAmfe(sb, row.id, doc, { expectedAmfeNumber: 'AMFE-INS-PAT' });
console.log('Guardado en Supabase con éxito.');

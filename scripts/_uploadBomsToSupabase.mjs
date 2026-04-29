/**
 * Upload BOM JSONs (output de _parseBomFamilyA.mjs) a Supabase.
 *
 * Lee /tmp/bom-family-a.json y hace upsert por bom_number en la tabla bom_documents.
 *
 * Patron: dry-run por default, --apply para escribir realmente.
 *
 * Usage:
 *   node scripts/_uploadBomsToSupabase.mjs                  # dry-run
 *   node scripts/_uploadBomsToSupabase.mjs --apply          # escribe a Supabase
 *   node scripts/_uploadBomsToSupabase.mjs --in file.json   # input alternativo
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const inIdx = args.indexOf('--in');
const inputPath = inIdx !== -1 ? args[inIdx + 1] : 'C:/Users/FACUND~1/AppData/Local/Temp/bom-family-a.json';

// Cargar .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => {
        const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// Leer JSON
const docs = JSON.parse(readFileSync(inputPath, 'utf8'));
console.log(`Read ${docs.length} BOM(s) from ${inputPath}`);

function computeStats(doc) {
    let itemCount = 0;
    const seen = new Set();
    for (const v of doc.variants) {
        for (const g of v.groups) {
            if (g.items.length > 0) {
                seen.add(g.categoria);
                itemCount += g.items.length;
            }
        }
    }
    return { itemCount, groupCount: seen.size };
}

let okCount = 0;
let errCount = 0;
const log = [];

for (const entry of docs) {
    const stats = computeStats(entry.doc);
    const row = {
        id: entry.id,
        bom_number: entry.bomNumber,
        part_number: entry.partNumber || '',
        descripcion: entry.doc.header.descripcion || '',
        cliente: entry.cliente || '',
        proyecto: entry.proyecto || '',
        familia: entry.familia || '',
        family_id: null,
        revision: entry.revision || 'A',
        status: 'draft',
        item_count: stats.itemCount,
        group_count: stats.groupCount,
        fecha_emision: entry.doc.header.fechaEmision || '',
        elaborado_por: entry.doc.header.elaboradoPor || '',
        aprobado_por: '',
        data: JSON.stringify(entry.doc),
    };

    log.push(`  ${entry.bomNumber} | ${entry.familia} | ${entry.doc.variants.length} var | ${stats.itemCount} items`);

    if (apply) {
        const { error } = await sb
            .from('bom_documents')
            .upsert(row, { onConflict: 'bom_number' });
        if (error) {
            console.error(`  [ERROR] ${entry.bomNumber}: ${error.message}`);
            errCount++;
        } else {
            okCount++;
        }
    } else {
        okCount++;
    }
}

console.log(`\n${apply ? 'UPSERTED' : 'DRY-RUN'}:`);
for (const l of log) console.log(l);
console.log(`\nResult: ${okCount} ok, ${errCount} errors`);

if (!apply) console.log('\nNo se escribio nada. Pasa --apply para guardar.');

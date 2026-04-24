/**
 * exportCharsForCrossRef.mjs — Extraccion READ-ONLY de causas AMFE para cruce con I-PY-001.7
 *
 * Objetivo: exportar 5 JSONs (3 Headrest VWA + 2 Telas PWA) con todas las causas aplanadas
 * para cruzar contra el listado oficial de caracteristicas especiales/criticas Barack.
 *
 * NO escribe en Supabase. Solo SELECT + escritura local a tmp/cross-ref/.
 *
 * Uso: node scripts/exportCharsForCrossRef.mjs
 */

import { connectSupabase, parseData, countAmfeStats } from './_lib/amfeIo.mjs';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'tmp', 'cross-ref');

// Project names esperados (ver CLAUDE.md — "8 familias canonicas").
// Se hace match por sub-string normalizado para tolerar variantes menores.
const TARGETS = [
    { key: 'headrest-front', match: ['headrest_front', 'headrest front'], client: 'VWA' },
    { key: 'headrest-rear-center', match: ['headrest_rear_cen', 'headrest rear center'], client: 'VWA' },
    { key: 'headrest-rear-outer', match: ['headrest_rear_out', 'headrest rear outer'], client: 'VWA' },
    { key: 'telas-planas', match: ['telas_planas', 'telas planas'], client: 'PWA' },
    { key: 'telas-termoformadas', match: ['telas_termoformadas', 'telas termoformadas'], client: 'PWA' },
    { key: 'apb-tra-cen', match: ['apb_tra_cen', 'apoyabrazos trasero central'], client: 'VWA' },
];

function norm(s) {
    return String(s || '').toLowerCase().trim();
}

function matchTarget(projectName) {
    const p = norm(projectName);
    for (const t of TARGETS) {
        if (t.match.some(m => p.includes(m))) return t;
    }
    return null;
}

function flattenCauses(doc) {
    const rows = [];
    for (const op of (doc.operations || [])) {
        const opNum = op.opNumber || op.operationNumber || '';
        const opName = op.name || op.operationName || '';
        for (const we of (op.workElements || [])) {
            const weName = we.name || '';
            const weType = we.type || '';
            for (const fn of (we.functions || [])) {
                const fnDesc = fn.description || fn.functionDescription || '';
                for (const fm of (fn.failures || [])) {
                    const fmDesc = fm.description || '';
                    const fmEffects = {
                        local: fm.effectLocal || '',
                        next: fm.effectNextLevel || '',
                        end: fm.effectEndUser || '',
                    };
                    for (const c of (fm.causes || [])) {
                        rows.push({
                            op: String(opNum),
                            opName,
                            workElement: weName,
                            weType,
                            function: fnDesc,
                            failure: fmDesc,
                            effectLocal: fmEffects.local,
                            effectNext: fmEffects.next,
                            effectEnd: fmEffects.end,
                            cause: c.cause || c.description || '',
                            specialChar: c.specialChar || '',
                            characteristicNumber: c.characteristicNumber || '',
                            severity: c.severity ?? '',
                            occurrence: c.occurrence ?? '',
                            detection: c.detection ?? '',
                            ap: c.ap || c.actionPriority || '',
                            preventionControl: c.preventionControl || '',
                            detectionControl: c.detectionControl || '',
                        });
                    }
                }
            }
        }
    }
    return rows;
}

async function main() {
    console.log('[cross-ref] conectando Supabase (read-only)...');
    const sb = await connectSupabase();

    console.log('[cross-ref] listando amfe_documents VWA/PWA...');
    const { data: amfes, error } = await sb
        .from('amfe_documents')
        .select('id, amfe_number, project_name, client, part_number, data')
        .in('client', ['VWA', 'PWA']);
    if (error) throw new Error(`LIST amfes: ${error.message}`);

    console.log(`[cross-ref] total VWA/PWA: ${amfes.length}`);

    mkdirSync(OUT_DIR, { recursive: true });

    const summary = [];
    const unmatched = [];

    for (const row of amfes) {
        const target = matchTarget(row.project_name);
        if (!target) {
            unmatched.push({ id: row.id, project_name: row.project_name, client: row.client });
            continue;
        }

        const doc = parseData(row.data);
        if (!doc) {
            console.warn(`[cross-ref] WARN: ${row.project_name} tiene data unparseable`);
            continue;
        }

        const stats = countAmfeStats(doc);
        const causes = flattenCauses(doc);
        const ccCount = causes.filter(c => c.specialChar === 'CC').length;
        const scCount = causes.filter(c => c.specialChar === 'SC').length;

        const payload = {
            exportedAt: new Date().toISOString(),
            amfe: {
                id: row.id,
                amfe_number: row.amfe_number,
                project_name: row.project_name,
                part_number: row.part_number,
                client: row.client,
            },
            stats: { ...stats, ccCount, scCount },
            causes,
        };

        const outFile = join(OUT_DIR, `amfe-${target.key}.json`);
        writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');

        summary.push({
            key: target.key,
            project_name: row.project_name,
            part_number: row.part_number,
            causeCount: causes.length,
            ccCount,
            scCount,
            file: outFile.replace(join(__dirname, '..'), '.'),
        });

        console.log(`[cross-ref] OK: ${target.key} -> ${causes.length} causas (CC=${ccCount}, SC=${scCount})`);
    }

    // Resumen
    console.log('\n[cross-ref] RESUMEN:');
    console.table(summary);

    if (unmatched.length) {
        console.log('\n[cross-ref] AMFEs VWA/PWA sin target (ignorados):');
        console.table(unmatched);
    }

    const missing = TARGETS.filter(t => !summary.find(s => s.key === t.key));
    if (missing.length) {
        console.warn('\n[cross-ref] TARGETS NO ENCONTRADOS en Supabase:');
        console.table(missing);
        process.exit(1);
    }

    writeFileSync(join(OUT_DIR, '_summary.json'), JSON.stringify({ summary, unmatched }, null, 2), 'utf8');
    console.log(`\n[cross-ref] DONE. ${summary.length} AMFEs exportados a ${OUT_DIR}`);
}

main().catch(err => {
    console.error('[cross-ref] ERROR:', err.message);
    process.exit(1);
});

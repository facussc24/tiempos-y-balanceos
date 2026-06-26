/**
 * _readiness.mjs — Scorecard "AMFE listo para entregar" sobre TODOS los AMFEs.
 *
 * Plan wise-jumping-island (2026-06-26). Te dice, ANTES de exportar al cliente,
 * que AMFE esta LISTO y que le falta a los que NO.
 *
 * Uso:
 *   node scripts/_readiness.mjs            # scorecard detallado por AMFE
 *   node scripts/_readiness.mjs --summary  # una linea por AMFE
 *   node scripts/_readiness.mjs --filter=128   # solo AMFEs cuyo numero/proyecto matchea
 *
 * READ-ONLY, no toca Supabase. Requiere .env.local (entorno de Fak).
 * Exit 1 si algun AMFE esta NO LISTO (util para gates/CI).
 */
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';
import { computeReadiness, formatScorecard } from './_lib/amfeReadiness.mjs';

const SUMMARY = process.argv.includes('--summary');
const filterArg = process.argv.find(a => a.startsWith('--filter='));
const filter = filterArg ? filterArg.split('=')[1].toLowerCase() : null;

const sb = await connectSupabase();
const { data: amfes } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name, data');

const scores = [];
for (const row of amfes) {
    if (filter) {
        const hay = `${row.amfe_number || ''} ${row.project_name || ''}`.toLowerCase();
        if (!hay.includes(filter)) continue;
    }
    const doc = parseData(row.data);
    if (!doc || !Array.isArray(doc.operations)) {
        scores.push({
            amfeNumber: row.amfe_number, productName: row.project_name,
            verdict: 'NO_LISTO', blockerCount: 1, warningCount: 0,
            blockers: [{ type: 'DATA_NOT_OBJECT', detail: 'data no parseable', opNum: '-' }],
            warnings: [], dimensions: {},
        });
        continue;
    }
    scores.push(computeReadiness(doc, row.project_name, row.amfe_number, doc.header));
}

const listos = scores.filter(s => s.verdict === 'LISTO');
const noListos = scores.filter(s => s.verdict === 'NO_LISTO');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║        AMFE LISTO PARA ENTREGAR — scorecard de readiness       ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');
console.log(`  LISTOS: ${listos.length} / ${scores.length}     NO LISTOS: ${noListos.length}\n`);

// NO LISTOS primero, ordenados por cantidad de bloqueantes (peor arriba)
const ordered = [...scores].sort((a, b) => {
    if (a.verdict !== b.verdict) return a.verdict === 'NO_LISTO' ? -1 : 1;
    return b.blockerCount - a.blockerCount;
});

for (const s of ordered) {
    console.log(formatScorecard(s, { verbose: !SUMMARY }));
    if (!SUMMARY) console.log('');
}

console.log('\n' + '─'.repeat(64));
if (noListos.length === 0) {
    console.log('✓ TODOS LISTOS para entregar.');
} else {
    console.log(`✗ ${noListos.length} AMFE(s) NO LISTO(s): ${noListos.map(s => s.amfeNumber).join(', ')}`);
    console.log('  (los avisos no bloquean la entrega; los bloqueantes si)');
}
console.log('─'.repeat(64) + '\n');

process.exit(noListos.length > 0 ? 1 : 0);

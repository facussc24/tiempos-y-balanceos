/**
 * Fix: actualizar `data.header.applicableParts` en los 3 AMFEs Headrest
 * con el formato canonico dictado por Fak (sesion 2026-05-17).
 *
 * Cada producto APC tiene 4 variantes L0/L1/L2/L3 con:
 *   - Codigo VW (con puntos cada 3 digitos)
 *   - Codigo color del vinilo (3 letras)
 *   - Descripcion material
 *
 * Decision Fak: NO tocar PFDs (los flujogramas de proceso no se hacen aca).
 *
 * Uso:
 *   node scripts/_fix-apc-applicable-parts-canonico.mjs           # dry-run
 *   node scripts/_fix-apc-applicable-parts-canonico.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const TARGETS = [
    {
        id: '10eaebce-ad87-4035-9343-3e20e4ee0fc9',
        amfeNumber: 'AMFE-HF-PAT',
        label: 'APC DELANTERO',
        applicableParts: [
            'APC DELANTERO',
            'L0  2HC.881.901    RL1  | PVC Titan Black',
            'L1  2HC.881.901.A  GFV  | FABRIC Jacquard Black',
            'L2  2HC.881.901.B  GEV  | PVC Andino Gray',
            'L3  2HC.881.901.C  EFG  | PVC Dark Slate',
        ].join('\n'),
    },
    {
        id: 'e9320798-ceaa-4623-97e9-92200b5234b6',
        amfeNumber: 'AMFE-HRC-PAT',
        label: 'APC TRASERO CENTRAL',
        applicableParts: [
            'APC TRASERO CENTRAL',
            'L0  2HC.885.900    RL1  | PVC Titan Black',
            'L1  2HC.885.900.A  EIF  | FABRIC Jacquard Black',
            'L2  2HC.885.900.B  SIY  | PVC Andino Gray',
            'L3  2HC.885.900.C  SIY  | PVC Dark Slate',
        ].join('\n'),
    },
    {
        id: 'beda6d47-30ae-4d5f-81e0-468be8950014',
        amfeNumber: 'AMFE-HRO-PAT',
        label: 'APC TRASERO LATERAL',
        applicableParts: [
            'APC TRASERO LATERAL',
            'L0  2HC.885.901    RL1  | PVC Titan Black',
            'L1  2HC.885.901.A  GFU  | FABRIC Jacquard Black',
            'L2  2HC.885.901.B  GEQ  | PVC Andino Gray',
            'L3  2HC.885.901.C  DZS  | PVC Dark Slate',
        ].join('\n'),
    },
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const plan = [];
for (const t of TARGETS) {
    const read = await readAmfe(sb, t.id);
    if (read.amfe_number !== t.amfeNumber) {
        throw new Error(`AMFE number mismatch ${t.id}: expected ${t.amfeNumber}, got ${read.amfe_number}`);
    }

    const before = read.doc;
    const after = JSON.parse(JSON.stringify(before));
    if (!after.header) after.header = {};

    const oldParts = after.header.applicableParts || '';
    if (oldParts === t.applicableParts) {
        console.log(`  SKIP ${t.amfeNumber} — applicableParts ya canonico`);
        continue;
    }

    after.header.applicableParts = t.applicableParts;
    logChange(apply, `${t.amfeNumber} (${t.label}) applicableParts`,
        { before: oldParts.slice(0, 100), after_lines: t.applicableParts.split('\n').length + ' lineas' });

    plan.push({
        id: t.id,
        amfeNumber: t.amfeNumber,
        productName: read.row.project_name,
        before,
        after,
    });
}

console.log(`\nResumen: ${plan.length} AMFEs con cambios.`);
if (plan.length === 0) { process.exit(0); }

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`  ✓ ${p.amfeNumber} actualizado.`);
    }
});

finish(apply);
process.exit(0);

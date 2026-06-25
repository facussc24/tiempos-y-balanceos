/**
 * Fix: renombrar TODOS los WE Man con nombres no canonicos a los 4 roles
 * Barack canonicos (decision Fak 2026-05-17).
 *
 * 4 roles canonicos:
 * - Operador de Produccion (default — controles rutinarios en proceso)
 * - Operador de Calidad (liberacion primera pieza, setup control)
 * - Inspector de Calidad (auditorias formales, ensayos)
 * - Lider de Produccion (decisiones paro de linea, escalamiento)
 *
 * Mapeo:
 *   "Lider de equipo" / "Lider de Equipo" -> "Lider de Produccion"
 *   "Operario de control de calidad" -> "Inspector de Calidad"
 *   "Operador de control" en OP de CONTROL DIMENSIONAL/CONTROL FINAL
 *     -> "Inspector de Calidad"
 *   "Operador de control" en otros casos (autocontrol) -> "Operador de Produccion"
 *   "Operador de calidad" -> "Operador de Calidad" (case fix)
 *   TODO LO DEMAS Man no canonico -> "Operador de Produccion"
 *
 * Deteccion de duplicados: si despues del rename habria 2+ WE Man con
 * mismo nombre en misma OP, SKIP el segundo y reportar para revision manual.
 *
 * Uso:
 *   node scripts/_fix-roles-man-canonicos-masivo.mjs           # dry-run
 *   node scripts/_fix-roles-man-canonicos-masivo.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const CANONICOS = [
    'Operador de Producción',
    'Operador de Calidad',
    'Inspector de Calidad',
    'Líder de Producción',
];

function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function mapToCanon(weName, opName) {
    const n = normalize(weName);
    const opN = normalize(opName);

    // Casos explicitos
    if (/^lider\s+de\s+equipo$/i.test(weName) || /^lider\s+de\s+produccion$/i.test(n)) {
        return 'Líder de Producción';
    }
    if (/operario\s+de\s+control\s+de\s+calidad/i.test(n)) {
        return 'Inspector de Calidad';
    }
    if (/^inspector\s+de\s+calidad$/i.test(n)) {
        return 'Inspector de Calidad';
    }
    if (/^operador\s+de\s+control$/i.test(n)) {
        // depende del contexto
        if (/control\s+dimensional|control\s+final\s+de\s+calidad|control\s+de\s+calidad/i.test(opN)) {
            return 'Inspector de Calidad';
        }
        return 'Operador de Producción';
    }
    if (/^operador\s+de\s+calidad$/i.test(n)) {
        return 'Operador de Calidad';
    }
    // Ya es canonico exacto (con tildes)?
    if (CANONICOS.includes(weName)) return null; // no cambiar

    // Default: cualquier otro Man -> Operador de Produccion
    return 'Operador de Producción';
}

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);

const cache = new Map();
async function loadDoc(amfeNumber, meta) {
    if (cache.has(amfeNumber)) return cache.get(amfeNumber);
    const read = await readAmfe(sb, meta.id);
    const entry = { meta, read, before: read.doc, after: JSON.parse(JSON.stringify(read.doc)) };
    cache.set(amfeNumber, entry);
    return entry;
}

const skips = [];
let totalRenamed = 0;

for (const m of all) {
    const entry = await loadDoc(m.amfe_number, m);
    for (const op of (entry.after.operations || [])) {
        const opName = op.name || op.operationName || '';
        // Pre-pasada: anotar nombres existentes Man en esta OP
        const existingMan = new Set();
        for (const we of (op.workElements || [])) {
            if (we.type === 'Man' && we.name) existingMan.add(we.name);
        }

        for (const we of (op.workElements || [])) {
            if (we.type !== 'Man') continue;
            const newName = mapToCanon(we.name || '', opName);
            if (!newName || newName === we.name) continue;

            // Chequear duplicado: ¿otro WE en la misma OP YA tiene este nombre?
            const wouldDup = existingMan.has(newName) && !existingMan.has(we.name); // edge case: same we
            const sameOpHas = (op.workElements || []).some(other =>
                other !== we && other.type === 'Man' && other.name === newName
            );
            if (sameOpHas) {
                skips.push({ amfe: m.amfe_number, op: op.opNumber || op.operationNumber, opName: opName.slice(0, 30), oldName: we.name, newName, reason: 'duplicate' });
                continue;
            }

            const oldName = we.name;
            we.name = newName;
            existingMan.delete(oldName);
            existingMan.add(newName);
            totalRenamed++;
            logChange(apply, `${m.amfe_number} OP${op.opNumber || op.operationNumber} ${opName.slice(0, 28)}`,
                { from: oldName, to: newName });
        }
    }
}

console.log(`\nResumen: ${totalRenamed} WE renombrados, ${skips.length} skips por duplicado.`);
if (skips.length > 0) {
    console.log('\nSKIPS (revision manual):');
    skips.forEach(s => console.log(`  ${s.amfe} OP${s.op} "${s.opName}" — quiso renombrar "${s.oldName}" -> "${s.newName}" pero ya existe ese WE.`));
}

const plan = [];
for (const [, entry] of cache) {
    if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) continue;
    plan.push({
        id: entry.meta.id,
        amfeNumber: entry.meta.amfe_number,
        productName: entry.read.row.project_name,
        before: entry.before,
        after: entry.after,
    });
}
console.log(`\n${plan.length} AMFEs con cambios.`);
if (plan.length === 0) { process.exit(0); }

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`  ✓ ${p.amfeNumber} actualizado.`);
    }
});

finish(apply);
process.exit(0);

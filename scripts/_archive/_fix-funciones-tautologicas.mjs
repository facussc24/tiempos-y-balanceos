/**
 * Fix: 4 funciones tautologicas / genericas detectadas en M-review.
 *
 * Sesion soft-snacking-elephant 2026-05-17.
 *
 * 1. IP-PADS OP10 WE "Recepción de materiales" type=Man
 *    fn "Se recepciona la materia prima" -> texto concreto
 *
 * 2. HF-PAT OP20 WE "Mesa de corte" type=Machine
 *    fn "CORTE DE PANELES" -> describe contribucion de la mesa
 *
 * 3. 150 OP10 — 2 WEs (Operador + Lider) tienen fn identica
 *    Distinguir: Operador hace autocontrol; Lider libera arranque
 *
 * 4. IP-PADS OP30 WE "BMA090 / BMA089" type=Machine
 *    Doble fix: separar en 2 WEs + reescribir fn de cada uno
 *
 * Uso:
 *   node scripts/_fix-funciones-tautologicas.mjs           # dry-run
 *   node scripts/_fix-funciones-tautologicas.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);
const byNumber = Object.fromEntries(all.map(a => [a.amfe_number, a]));

const cache = new Map();
async function loadDoc(amfeNumber) {
    if (cache.has(amfeNumber)) return cache.get(amfeNumber);
    const meta = byNumber[amfeNumber];
    if (!meta) throw new Error(`AMFE not found: ${amfeNumber}`);
    const read = await readAmfe(sb, meta.id);
    const entry = { meta, read, before: read.doc, after: JSON.parse(JSON.stringify(read.doc)) };
    cache.set(amfeNumber, entry);
    return entry;
}

function setFnDesc(fn, newDesc) {
    fn.description = newDesc;
    fn.functionDescription = newDesc;
}

// === FIX #1: IP-PADS OP10 "Recepción de materiales" ===
{
    const entry = await loadDoc('VWA-PAT-IPPADS-001');
    const op = entry.after.operations.find(o => +(o.opNumber || o.operationNumber) === 10);
    const we = op?.workElements?.find(w => /^Recepci[oó]n\s+de\s+materiales$/i.test(w.name || ''));
    const fn = we?.functions?.[0];
    if (fn && /^Se\s+recepciona\s+la\s+materia\s+prima/i.test(fn.description || fn.functionDescription || '')) {
        const oldDesc = fn.description || fn.functionDescription;
        const newDesc = 'Verificar conformidad de calidad, cantidad y trazabilidad de materia prima al ingresar';
        setFnDesc(fn, newDesc);
        logChange(apply, `#1 IP-PADS OP10 WE "Recepción de materiales" fn`, { before: oldDesc.slice(0, 70), after: newDesc.slice(0, 70) });
    } else {
        console.warn('#1 SKIP: WE/fn no encontrado en IP-PADS OP10');
    }
}

// === FIX #2: HF-PAT OP20 Mesa de corte fn = "CORTE DE PANELES" ===
{
    const entry = await loadDoc('AMFE-HF-PAT');
    const op = entry.after.operations.find(o => +(o.opNumber || o.operationNumber) === 20);
    const we = op?.workElements?.find(w => /Mesa\s+de\s+corte/i.test(w.name || ''));
    const fn = we?.functions?.[0];
    if (fn && /^CORTE\s+DE\s+PANELES\s*$/i.test(fn.description || fn.functionDescription || '')) {
        const oldDesc = fn.description || fn.functionDescription;
        const newDesc = 'Sostener material y guiar el corte preciso según patrón';
        setFnDesc(fn, newDesc);
        logChange(apply, `#2 HF-PAT OP20 WE "Mesa de corte" fn`, { before: oldDesc, after: newDesc });
    } else {
        console.warn('#2 SKIP: WE/fn no encontrado en HF-PAT OP20');
    }
}

// === FIX #3: 150 OP10 — distinguir Operador vs Lider Equipo ===
{
    const entry = await loadDoc('150');
    const op = entry.after.operations.find(o => +(o.opNumber || o.operationNumber) === 10);
    const wesMatch = (op?.workElements || []).filter(w => /Mano\s+de\s+Obra/i.test(w.name || ''));
    for (const we of wesMatch) {
        const fn = we.functions?.[0];
        if (!fn) continue;
        const oldDesc = fn.description || fn.functionDescription || '';
        if (!/Operar\s+el\s+puesto/i.test(oldDesc)) continue;
        let newDesc;
        if (/Operador/i.test(we.name)) {
            newDesc = 'Ejecutar autocontrol visual y dimensional de materia prima según P-09/I';
        } else if (/L[ií]der/i.test(we.name)) {
            newDesc = 'Liberar arranque de turno y resolver desvíos del proceso de recepción';
        } else {
            continue;
        }
        setFnDesc(fn, newDesc);
        logChange(apply, `#3 150 OP10 WE "${we.name}" fn`, { before: oldDesc.slice(0, 50), after: newDesc.slice(0, 70) });
    }
}

// === FIX #4: IP-PADS OP30 "BMA090 / BMA089" — separar + reescribir fn ===
{
    const entry = await loadDoc('VWA-PAT-IPPADS-001');
    const op = entry.after.operations.find(o => +(o.opNumber || o.operationNumber) === 30);
    const idx = op?.workElements?.findIndex(w => /BMA090\s*\/\s*BMA089/i.test(w.name || ''));
    if (idx >= 0) {
        const we = op.workElements[idx];
        const fn0 = we.functions?.[0];
        const oldDesc = fn0 ? (fn0.description || fn0.functionDescription || '') : '';
        const newDesc = 'Cortar paneles con programa cutter validado, manteniendo precisión dimensional';

        const hasFailures = (we.functions || []).some(f => (f.failures || []).length > 0);
        if (hasFailures) {
            // Si tiene failures, NO separar — solo renombrar a UN equipo + cambiar fn
            // (no inventar failures duplicadas para la segunda maquina)
            const oldName = we.name;
            we.name = 'BMA090';
            if (fn0) setFnDesc(fn0, newDesc);
            logChange(apply, `#4 IP-PADS OP30 WE rename (failures preservadas)`,
                { name: `${oldName} -> ${we.name}`, fn: `${oldDesc.slice(0,40)} -> ${newDesc.slice(0,40)}` });
        } else {
            // Sin failures, separar en 2 WEs limpios
            const wBma090 = {
                ...JSON.parse(JSON.stringify(we)),
                name: 'BMA090',
                functions: [{
                    ...(fn0 ? JSON.parse(JSON.stringify(fn0)) : {}),
                    description: newDesc,
                    functionDescription: newDesc,
                    failures: [],
                }],
            };
            const wBma089 = {
                ...JSON.parse(JSON.stringify(we)),
                name: 'BMA089',
                functions: [{
                    ...(fn0 ? JSON.parse(JSON.stringify(fn0)) : {}),
                    description: newDesc,
                    functionDescription: newDesc,
                    failures: [],
                }],
            };
            op.workElements.splice(idx, 1, wBma090, wBma089);
            logChange(apply, `#4 IP-PADS OP30 WE split`,
                { from: 'BMA090 / BMA089', to: 'BMA090 + BMA089 (2 WEs)', fn: newDesc.slice(0, 60) });
        }
    } else {
        console.warn('#4 SKIP: WE "BMA090 / BMA089" no encontrado en IP-PADS OP30');
    }
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

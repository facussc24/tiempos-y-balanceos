/**
 * Fix: 4 failures con efectos en "TBD" reusando los efectos de fallas similares
 * en AMFEs hermanos Barack.
 *
 * Sesion 2026-05-17 plan soft-snacking-elephant Grupo 3.
 *
 * Reusos aprobados por Fak (basado en busqueda de similaridad sim>=0.5):
 *  1. AMFE-1 OP40 "Costura corrida / fuera de posicion" -> AMFE-2 OP80 (sim=1.0)
 *  2. AMFE-1 OP40 "Hilo roto" -> AMFE-2 OP80 "Hilo roto durante costura" (sim=0.85)
 *  3. AMFE-INS-PAT OP5 "Omision de verificacion de insumos" -> AMFE-2 OP10
 *     "Omision de controles de recepcion establecidos" (sim=0.50)
 *  4. AMFE-TR-PAT OP80 "Contaminacion / mal contacto / soldadura incompleta..."
 *     -> VWA-PAT-IPPADS-001 OP110 "Soldadura incompleta o debil" (sim=0.50)
 *
 * Las otras 7 fallas (4 en INS-PAT sustrato/adhesivo, 2 en TR-PAT, 1 en AMFE-1
 * rotura aguja) NO tienen match y quedan en TBD para el equipo APQP.
 *
 * Uso:
 *   node scripts/_fix-effects-tbd-reuse.mjs            # dry-run
 *   node scripts/_fix-effects-tbd-reuse.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function isTBD(s) {
    const n = normalize(s);
    return n.length === 0 || n === 'tbd' || n.startsWith('tbd');
}

// Cada fix: encuentra TARGET failure (por descripcion) y copia los 3 efectos
// del SOURCE failure.
const FIXES = [
    {
        target: { amfe: 'AMFE-1', failureMatch: /costura\s+corrida.*fuera\s+de\s+posicion/i },
        source: { amfe: 'AMFE-2', failureMatch: /costura\s+corrida.*fuera\s+de\s+posicion/i },
    },
    {
        target: { amfe: 'AMFE-1', failureMatch: /^hilo\s+roto$/i },
        source: { amfe: 'AMFE-2', failureMatch: /^hilo\s+roto\s+durante\s+costura$/i },
    },
    {
        target: { amfe: 'AMFE-INS-PAT', failureMatch: /omision\s+de\s+verificacion\s+de\s+insumos/i },
        source: { amfe: 'AMFE-2',       failureMatch: /omision\s+de\s+controles\s+de\s+recepcion/i },
    },
    {
        target: { amfe: 'AMFE-TR-PAT',           failureMatch: /contaminacion.*soldadura\s+incompleta/i },
        source: { amfe: 'VWA-PAT-IPPADS-001',    failureMatch: /^soldadura\s+incompleta\s+o\s+debil$/i },
    },
];

function findFailure(doc, matchRe) {
    if (!doc?.operations) return null;
    for (let oi = 0; oi < doc.operations.length; oi++) {
        const op = doc.operations[oi];
        for (let wi = 0; wi < (op.workElements || []).length; wi++) {
            const we = op.workElements[wi];
            for (let fi = 0; fi < (we.functions || []).length; fi++) {
                const fn = we.functions[fi];
                for (let li = 0; li < (fn.failures || []).length; li++) {
                    const fl = fn.failures[li];
                    if (matchRe.test(normalize(fl.description || ''))) {
                        return { op, we, fn, fl, path: { oi, wi, fi, li } };
                    }
                }
            }
        }
    }
    return null;
}

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);
const byNumber = Object.fromEntries(all.map(a => [a.amfe_number, a]));

// Cargar todos los AMFEs source/target una sola vez (cache simple)
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

let totalApplied = 0;
for (const fix of FIXES) {
    const tgt = await loadDoc(fix.target.amfe);
    const src = await loadDoc(fix.source.amfe);

    const targetHit = findFailure(tgt.after, fix.target.failureMatch);
    const sourceHit = findFailure(src.before, fix.source.failureMatch);

    if (!targetHit) {
        console.warn(`  SKIP: target no encontrado en ${fix.target.amfe} con ${fix.target.failureMatch}`);
        continue;
    }
    if (!sourceHit) {
        console.warn(`  SKIP: source no encontrado en ${fix.source.amfe} con ${fix.source.failureMatch}`);
        continue;
    }

    // Solo copio si target tiene TBD en los 3 (no sobrescribir contenido humano)
    const tfl = targetHit.fl;
    const allTBD = isTBD(tfl.effectLocal) && isTBD(tfl.effectNextLevel) && isTBD(tfl.effectEndUser);
    if (!allTBD) {
        console.warn(`  SKIP: target ${fix.target.amfe} "${tfl.description.slice(0,40)}" ya tiene efectos no-TBD — no sobrescribo`);
        continue;
    }

    const sfl = sourceHit.fl;
    tfl.effectLocal = sfl.effectLocal;
    tfl.effectNextLevel = sfl.effectNextLevel;
    tfl.effectEndUser = sfl.effectEndUser;
    totalApplied++;

    logChange(apply,
        `${fix.target.amfe} OP${targetHit.op.opNumber || targetHit.op.operationNumber} "${tfl.description.slice(0,45)}" <- reuso ${fix.source.amfe}`,
        {
            local:   sfl.effectLocal.slice(0, 70),
            next:    sfl.effectNextLevel.slice(0, 70),
            enduser: sfl.effectEndUser.slice(0, 70),
        }
    );
}

console.log(`\nResumen: ${totalApplied} fallas con efectos reusados.`);
if (totalApplied === 0) { process.exit(0); }

const plan = [];
for (const [, entry] of cache) {
    // solo incluir si hubo cambio
    if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) continue;
    plan.push({
        id: entry.meta.id,
        amfeNumber: entry.meta.amfe_number,
        productName: entry.read.row.project_name,
        before: entry.before,
        after: entry.after,
    });
}

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`  ✓ ${p.amfeNumber} actualizado.`);
    }
});

finish(apply);
process.exit(0);

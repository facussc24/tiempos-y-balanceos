/**
 * Fix AMFE TOP_ROLL OP 20 WE "Iluminacion/Ruido, Ley 19587" (Environment).
 *
 * Problema: El WE esta vacio (functions: []), lo que viola estructura AMFE.
 * Auditor reporta FAIL: "has 0 functions".
 *
 * Solucion (OPCION B): Enriquecer con function + failure + causas desde el
 * MAESTRO INYECCION_PLASTICA OP 30 WE "Iluminacion del puesto", que tiene
 * el mismo contexto tecnico (iluminacion en puesto de inspeccion visual
 * durante proceso de inyeccion plastica). Contenido es validado, NO inventado.
 *
 * UUIDs nuevos para evitar colision con los del maestro.
 *
 * Guards:
 *   - solo id === '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3' (TOP_ROLL)
 *   - solo OP 20
 *   - solo WE type=Environment con name que matchea "Iluminacion/Ruido"
 *   - solo si functions.length === 0 (no sobrescribir si ya hay contenido)
 *
 * data es TEXT -> JSON.stringify al escribir.
 * dryRunGuard: --apply para ejecutar.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD
});

const TOP_ROLL_ID = '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3';
const TARGET_OP = '20';

const { apply } = parseSafeArgs();

// --- Fetch ---
const { data: row, error } = await sb
    .from('amfe_documents')
    .select('*')
    .eq('id', TOP_ROLL_ID)
    .single();

if (error || !row) {
    console.error('Failed to fetch TOP_ROLL:', error?.message);
    process.exit(1);
}

if (row.id !== TOP_ROLL_ID) {
    console.error(`GUARD FAIL: id mismatch. ABORT.`);
    process.exit(1);
}

let data;
try {
    data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
} catch (e) {
    console.error('data parse failed:', e.message);
    process.exit(1);
}

const ops = Array.isArray(data.operations) ? data.operations : [];
const opIdx = ops.findIndex(o => String(o.opNumber ?? o.operationNumber) === TARGET_OP);
if (opIdx === -1) {
    console.error(`OP ${TARGET_OP} no encontrada.`);
    process.exit(1);
}

const op = ops[opIdx];
const wes = Array.isArray(op.workElements) ? op.workElements : [];
const weIdx = wes.findIndex(we => {
    const n = (we.name || '').toLowerCase();
    return we.type === 'Environment' && (n.includes('ilumin') || n.includes('ruido') || n.includes('19587'));
});

if (weIdx === -1) {
    console.error('WE Environment Iluminacion/Ruido NO encontrado en OP 20. Nada que hacer.');
    process.exit(0);
}

const targetWE = wes[weIdx];
const existingFns = Array.isArray(targetWE.functions) ? targetWE.functions : [];

console.log(`WE objetivo: "${targetWE.name}" (id=${targetWE.id})`);
console.log(`  functions actuales: ${existingFns.length}`);

if (existingFns.length > 0) {
    console.error('GUARD: el WE ya tiene functions. ABORT para no sobrescribir.');
    process.exit(1);
}

// --- Construir nueva function + failure + causas (UUIDs nuevos) ---
// Contenido tomado textualmente del MAESTRO INYECCION_PLASTICA OP 30
// (WE "Iluminacion del puesto" - id en fuente f24bc092).
const newFunction = {
    id: randomUUID(),
    description: 'Iluminacion adecuada para inspeccion visual',
    functionDescription: 'Iluminacion adecuada para inspeccion visual',
    requirements: '',
    failures: [
        {
            id: randomUUID(),
            description: 'Iluminacion insuficiente',
            effectLocal: 'Defectos no detectados por mala luz',
            effectNextLevel: 'Piezas con defectos liberadas a la siguiente estacion, detectadas tarde o no detectadas',
            effectEndUser: 'Apariencia superficial NOK no detectada, rechazo cliente',
            severity: 5,
            causes: [
                {
                    id: randomUUID(),
                    description: 'Iluminacion insuficiente en el puesto',
                    cause: 'Iluminacion insuficiente en el puesto',
                    severity: 5,
                    occurrence: 2,
                    detection: 7,
                    ap: 'L',
                    actionPriority: 'L',
                    preventionControl: 'Estandar de iluminacion del puesto + plan de mantenimiento de luminarias',
                    detectionControl: 'Luxometro periodico por Seguridad',
                    preventionAction: '',
                    detectionAction: '',
                    responsible: '',
                    targetDate: '',
                    status: '',
                    actionTaken: '',
                    completionDate: '',
                    severityNew: '',
                    occurrenceNew: '',
                    detectionNew: '',
                    apNew: '',
                    observations: '',
                    specialChar: '',
                    characteristicNumber: '',
                    filterCode: '',
                },
                {
                    id: randomUUID(),
                    description: 'Luminaria quemada o desalineada',
                    cause: 'Luminaria quemada o desalineada',
                    severity: 5,
                    occurrence: 2,
                    detection: 5,
                    ap: 'L',
                    actionPriority: 'L',
                    preventionControl: 'Mantenimiento de luminarias',
                    detectionControl: 'Autocontrol del puesto al arranque',
                    preventionAction: '',
                    detectionAction: '',
                    responsible: '',
                    targetDate: '',
                    status: '',
                    actionTaken: '',
                    completionDate: '',
                    severityNew: '',
                    occurrenceNew: '',
                    detectionNew: '',
                    apNew: '',
                    observations: '',
                    specialChar: '',
                    characteristicNumber: '',
                    filterCode: '',
                },
            ],
        },
    ],
};

const newWE = { ...targetWE, functions: [newFunction] };
const newWEs = [...wes];
newWEs[weIdx] = newWE;
const newOp = { ...op, workElements: newWEs };
const newOps = [...ops];
newOps[opIdx] = newOp;

// Recalcular cause_count
let newCauseCount = 0;
for (const o of newOps) {
    for (const we of (o.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const f of (fn.failures || [])) {
                newCauseCount += Array.isArray(f.causes) ? f.causes.length : 0;
            }
        }
    }
}

logChange(apply, `enrich TOP_ROLL OP20 WE Iluminacion/Ruido`, {
    weId: targetWE.id,
    fnsAdded: 1,
    failuresAdded: 1,
    causesAdded: 2,
    causeCount: `${row.cause_count} -> ${newCauseCount}`,
});

if (apply) {
    // Guard redundante pre-write
    if (row.id !== TOP_ROLL_ID) {
        console.error('GUARD FAIL pre-write. ABORT.');
        process.exit(1);
    }
    const newData = { ...data, operations: newOps };
    const { error: updErr } = await sb
        .from('amfe_documents')
        .update({
            data: JSON.stringify(newData),
            cause_count: newCauseCount,
        })
        .eq('id', TOP_ROLL_ID);

    if (updErr) {
        console.error('UPDATE FAILED:', updErr.message);
        process.exit(1);
    }
    console.log('\nUPDATE OK.');
}

finish(apply);
process.exit(0);

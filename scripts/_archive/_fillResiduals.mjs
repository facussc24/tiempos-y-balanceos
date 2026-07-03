/**
 * _fillResiduals.mjs — Cierra los 8 issues residuales despues de
 * _fillRemainingGaps.mjs. Autorizado por Fak 2026-04-22.
 *
 *  1. FRONT+CEN OP 40 "Hilo inadecuado" S/O/D (4 issues)
 *  2. FRONT OP 50 "Falla en la maquina" detectionControl (1)
 *  3. IP_PADS OP 40 "Patron de costura" failures (1)
 *  4. IP_PADS OP 70 "Procedimiento inspeccion visual" failures (1)
 *  5. ARMREST OP 80 "Operador de produccion" adhesivado failures (1)
 */
import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, readAmfe, saveAmfe, findOperation, findWorkElement,
    calculateAP, normalizeText,
} from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const IDS = {
    HF: '10eaebce-ad87-4035-9343-3e20e4ee0fc9',
    HRC: 'e9320798-ceaa-4623-97e9-92200b5234b6',
    IPPADS: 'c9b93b84-f804-4cd0-91c1-c4878db41b97',
    ARM: '5268704d-30ae-48f3-ad05-8402a6ded7fe',
};

function newCause(desc, s, o, d, prev, det) {
    const ap = calculateAP(s, o, d);
    return {
        id: randomUUID(), description: desc, cause: desc,
        severity: s, occurrence: o, detection: d, actionPriority: ap, ap,
        preventionControl: prev, detectionControl: det,
        specialChar: '', characteristicNumber: '',
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
    };
}
function newFailure(desc, effL, effN, effE, causes) {
    return {
        id: randomUUID(), description: desc,
        effectLocal: effL, effectNextLevel: effN, effectEndUser: effE,
        severity: Math.max(...causes.map(c => c.severity || 0)),
        causes,
    };
}

// ─── 1. Headrest FRONT + CEN: "Hilo inadecuado" SOD ─────────────────
async function fixHilo(amfeId, amfeNumber, label) {
    const { doc } = await readAmfe(sb, amfeId);
    const op = findOperation(doc, '40');
    if (!op) return;
    const we = findWorkElement(op, 'Material');
    if (!we) return;
    let changed = false;
    for (const fn of we.functions || []) {
        for (const fm of fn.failures || []) {
            if (!normalizeText(fm.description).includes('costura descosida')) continue;
            for (const c of fm.causes || []) {
                if (!normalizeText(c.cause || c.description).includes('hilo inadecuado')) continue;
                if (c.severity == null) { c.severity = 5; changed = true; }
                if (c.occurrence == null) { c.occurrence = 3; changed = true; }
                if (c.detection == null) { c.detection = 4; changed = true; }
                if (!c.preventionControl) {
                    c.preventionControl = 'Especificacion de hilo por tipo de costura en instruccion de trabajo';
                    changed = true;
                }
                if (!c.detectionControl) {
                    c.detectionControl = 'Inspeccion visual de primera pieza al arranque';
                    changed = true;
                }
                const ap = calculateAP(c.severity, c.occurrence, c.detection);
                if (ap !== c.actionPriority) { c.actionPriority = ap; c.ap = ap; changed = true; }
            }
        }
    }
    if (changed) {
        logChange(apply, `${label} OP 40: SOD/AP/controls para "Hilo inadecuado"`, null);
        if (apply) await saveAmfe(sb, amfeId, doc, { expectedAmfeNumber: amfeNumber });
    }
}

// ─── 2. FRONT OP 50 "Falla en la maquina" — detectionControl ────────
async function fixFrontOp50() {
    const { doc } = await readAmfe(sb, IDS.HF);
    const op = findOperation(doc, '50');
    if (!op) return;
    let changed = false;
    for (const we of op.workElements || []) {
        for (const fn of we.functions || []) {
            for (const fm of fn.failures || []) {
                for (const c of fm.causes || []) {
                    if (!normalizeText(c.cause || c.description).includes('falla en la maquina')) continue;
                    if (!c.detectionControl) {
                        c.detectionControl = 'Mantenimiento preventivo programado + autocontrol del operador al arranque';
                        changed = true;
                    }
                }
            }
        }
    }
    if (changed) {
        logChange(apply, `FRONT OP 50: detectionControl para "Falla en la maquina"`, null);
        if (apply) await saveAmfe(sb, IDS.HF, doc, { expectedAmfeNumber: 'AMFE-HF-PAT' });
    }
}

// ─── 3. IP_PADS OP 40 "Patron de costura" — failures ────────────────
async function fixIppadsOp40() {
    const { doc } = await readAmfe(sb, IDS.IPPADS);
    const op = findOperation(doc, '40');
    if (!op) return;
    const we = findWorkElement(op, 'Patron de costura (union+vista)');
    if (!we) return;
    let changed = false;
    for (const fn of we.functions || []) {
        if (!fn.failures || fn.failures.length > 0) continue;
        fn.failures = [
            newFailure(
                'Patron de costura danado o desactualizado',
                'Reproceso de costura',
                'Pieza rechazada por cliente OEM',
                'Usuario percibe defecto estetico',
                [newCause(
                    'Falta de control de revision del patron de costura',
                    6, 2, 4,
                    'Registro de revisiones de patron en sistema de control documental',
                    'Verificacion visual de vigencia del patron al arranque',
                )],
            ),
        ];
        changed = true;
    }
    if (changed) {
        logChange(apply, `IP_PADS OP 40: failures para "Patron de costura"`, null);
        if (apply) await saveAmfe(sb, IDS.IPPADS, doc, { expectedAmfeNumber: 'VWA-PAT-IPPADS-001' });
    }
}

// ─── 4. IP_PADS OP 70 "Procedimiento inspeccion visual" — failures ──
async function fixIppadsOp70() {
    const { doc } = await readAmfe(sb, IDS.IPPADS);
    const op = findOperation(doc, '70');
    if (!op) return;
    const we = findWorkElement(op, 'Procedimiento inspeccion visual');
    if (!we) return;
    let changed = false;
    for (const fn of we.functions || []) {
        if (!fn.failures || fn.failures.length > 0) continue;
        fn.failures = [
            newFailure(
                'Procedimiento de inspeccion visual desactualizado o no aplicado',
                'Defecto no detectado en inspeccion',
                'Escape de no conformidad al cliente',
                'Usuario percibe defecto',
                [newCause(
                    'Falta de control de revision del procedimiento',
                    6, 3, 5,
                    'Procedimiento con revisiones controladas en sistema documental',
                    'Auditoria periodica de cumplimiento del procedimiento',
                )],
            ),
        ];
        changed = true;
    }
    if (changed) {
        logChange(apply, `IP_PADS OP 70: failures para "Procedimiento inspeccion visual"`, null);
        if (apply) await saveAmfe(sb, IDS.IPPADS, doc, { expectedAmfeNumber: 'VWA-PAT-IPPADS-001' });
    }
}

// ─── 5. ARMREST OP 80 Adhesivado "Operador de produccion" — failures
async function fixArmrestOp80() {
    const { doc } = await readAmfe(sb, IDS.ARM);
    const op = findOperation(doc, '80');
    if (!op) return;
    const we = findWorkElement(op, 'Operador de produccion');
    if (!we) return;
    let changed = false;
    for (const fn of we.functions || []) {
        if (!fn.failures || fn.failures.length > 0) continue;
        fn.failures = [
            newFailure(
                'Adhesivo aplicado incorrectamente (cantidad o posicion)',
                'Reproceso de adhesivado',
                'Desprendimiento en proceso siguiente o en campo',
                'Usuario percibe desprendimiento o desajuste',
                [newCause(
                    'Instruccion de aplicacion de adhesivo incompleta',
                    6, 3, 5,
                    'Instruccion de trabajo con croquis de posicion y cantidad',
                    'Inspeccion visual de primera pieza y autocontrol del operador',
                )],
            ),
        ];
        changed = true;
    }
    if (changed) {
        logChange(apply, `ARMREST OP 80: failures para "Operador de produccion" adhesivado`, null);
        if (apply) await saveAmfe(sb, IDS.ARM, doc, { expectedAmfeNumber: 'AMFE-ARM-PAT' });
    }
}

console.log('=== FILL RESIDUALS ===\n');
await fixHilo(IDS.HF, 'AMFE-HF-PAT', 'FRONT');
await fixHilo(IDS.HRC, 'AMFE-HRC-PAT', 'CEN');
await fixFrontOp50();
await fixIppadsOp40();
await fixIppadsOp70();
await fixArmrestOp80();
finish(apply);

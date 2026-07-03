/**
 * loadApbTraCenCcFlamab.mjs
 *
 * Agrega 2 causas CC obligatorias al AMFE 150 (APB TRA CEN — Apoyabrazos Trasero Central 2HC.885.0)
 * en OP 10 "RECEPCIONAR MATERIA PRIMA".
 *
 * Contexto: el AMFE 150 se cargo desde un Excel del equipo APQP que no tenia CC marcado.
 * Segun el listado oficial I-PY-001.7 y la regla `.claude/rules/amfe.md`
 * ("Flamabilidad es OBLIGATORIA como CC en toda pieza de cabina interior"),
 * faltan 2 D/TLD CC:
 *   - D/TLD 1 Flamabilidad TL 1010 VW (CC, S=9)
 *   - D/TLD 2 Emisiones VW 50180 (CC, S=9)
 *
 * Fak autorizo agregarlos 2026-04-24.
 *
 * Scope ESTRICTO: solo agregar CC flamabilidad + emisiones en OP 10.
 * NO toca las otras causas del AMFE_150.
 *
 * Respeta reglas:
 *   - scripts/_lib/amfeIo.mjs (connectSupabase, readAmfe, saveAmfe, calculateAP)
 *   - scripts/_lib/dryRunGuard.mjs (parseSafeArgs, runWithValidation, finish)
 *   - .claude/rules/amfe.md (calibracion S, field aliases, WE 1M-por-linea)
 *   - .claude/rules/amfe-actions.md (NO inventar acciones)
 *   - .claude/rules/amfe-aph-pending.md (AP=H sin accion => placeholder "Pendiente definicion equipo APQP")
 *
 * Referencia: scripts/loadApoyacabezasGaps.mjs (patron analogo para Headrest).
 */

import { randomUUID } from 'crypto';
import {
    connectSupabase,
    readAmfe,
    saveAmfe,
    calculateAP,
    findOperation,
    findWorkElement,
    normalizeText,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish, logChange } from './_lib/dryRunGuard.mjs';

// ─── Target ─────────────────────────────────────────────────────────────────
const TARGET = {
    id: '37cab669-0543-43c0-bb78-d00638114530',
    key: 'APB-TRA-CEN',
    name: 'Apoyabrazos Trasero Central (2HC.885.0)',
};

// WE comun para las 2 causas de materia prima directa (tela tapizado).
// El AMFE 150 ya tiene "Material (Indirectos)" en OP 10 — creamos "Material: Tela tapizado"
// como un WE nuevo especifico para el material directo (tela de tapizado) que llega al proceso.
// Regla 1M por linea: tela tapizado va aparte de "Material (Indirectos)".
const WE_NAME = 'Material: Tela tapizado';
const WE_TYPE = 'Material';

// ─── Nuevas causas CC ───────────────────────────────────────────────────────
const NEW_CAUSES = [
    {
        id: 'DTLD1',
        opNumber: '10',
        opName: 'RECEPCIONAR MATERIA PRIMA',
        weName: WE_NAME,
        weType: WE_TYPE,
        functionDescription: 'Proveer material libre de riesgo inflamabilidad',
        failureDescription: 'Inflamabilidad fuera de TL 1010 VW',
        effectLocal: 'Lote no conforme, material a segregar',
        effectNextLevel: 'Rechazo ensayo TL 1010 en auditoria cliente',
        effectEndUser: 'Riesgo seguridad usuario vehiculo',
        cause: 'Proveedor sin certificado TL 1010 vigente',
        severity: 9,
        occurrence: 3,
        detection: 3,
        specialChar: 'CC',
        preventionControl: 'Certificado TL 1010 VW del proveedor por lote',
        detectionControl: 'Verificacion documental P-14',
        responsible: 'Inspector de Calidad',
    },
    {
        id: 'DTLD2',
        opNumber: '10',
        opName: 'RECEPCIONAR MATERIA PRIMA',
        weName: WE_NAME,
        weType: WE_TYPE,
        functionDescription: 'Proveer material conforme emisiones VW 50180',
        failureDescription: 'Emisiones VOC fuera de especificacion VW 50180',
        effectLocal: 'Lote rechazado',
        effectNextLevel: 'Rechazo ensayo VW 50180 en cliente',
        effectEndUser: 'Olor/VOC en cabina, confort afectado',
        cause: 'Proveedor sin certificado VW 50180 vigente',
        severity: 9,
        occurrence: 3,
        detection: 3,
        specialChar: 'CC',
        preventionControl: 'Certificado VW 50180 del proveedor por lote',
        detectionControl: 'Verificacion documental P-14',
        responsible: 'Inspector de Calidad',
    },
];

// ─── Helpers (portados de loadApoyacabezasGaps.mjs) ─────────────────────────

function findOrCreateWe(op, weName, weType) {
    const existing = findWorkElement(op, weName);
    if (existing) return { we: existing, created: false };
    const we = {
        id: randomUUID(),
        name: weName,
        description: weName,
        type: weType,
        functions: [],
    };
    op.workElements = op.workElements || [];
    op.workElements.push(we);
    return { we, created: true };
}

function findOrCreateFunction(we, fnDescription) {
    const target = normalizeText(fnDescription);
    const existing = (we.functions || []).find(
        f => normalizeText(f.description || f.functionDescription) === target
    );
    if (existing) return { fn: existing, created: false };
    const fn = {
        id: randomUUID(),
        description: fnDescription,
        functionDescription: fnDescription,
        requirements: '',
        failures: [],
    };
    we.functions = we.functions || [];
    we.functions.push(fn);
    return { fn, created: true };
}

function findOrCreateFailure(fn, fmDescription, effectLocal, effectNextLevel, effectEndUser) {
    const target = normalizeText(fmDescription);
    const existing = (fn.failures || []).find(fm => normalizeText(fm.description) === target);
    if (existing) return { fm: existing, created: false };
    const fm = {
        id: randomUUID(),
        description: fmDescription,
        effectLocal,
        effectNextLevel,
        effectEndUser,
        severity: 0,
        occurrence: 0,
        detection: 0,
        ap: '',
        causes: [],
    };
    fn.failures = fn.failures || [];
    fn.failures.push(fm);
    return { fm, created: true };
}

function addCause(fm, nc) {
    const ap = calculateAP(nc.severity, nc.occurrence, nc.detection);
    const preventionAction = ap === 'H' ? 'Pendiente definicion equipo APQP' : '';
    const detectionAction = ap === 'H' ? 'Pendiente definicion equipo APQP' : '';

    const cause = {
        id: randomUUID(),
        cause: nc.cause,
        description: nc.cause,
        severity: nc.severity,
        occurrence: nc.occurrence,
        detection: nc.detection,
        ap,
        actionPriority: ap,
        preventionControl: nc.preventionControl,
        detectionControl: nc.detectionControl,
        preventionAction,
        detectionAction,
        specialChar: nc.specialChar || '',
        characteristicNumber: '',
        filterCode: '',
        responsible: nc.responsible || 'Inspector de Calidad',
        targetDate: '',
        status: ap === 'H' ? 'Pendiente' : '',
        _autoFilled: true,
        _source: `I-PY-001.7 ${nc.id}`,
    };
    fm.causes = fm.causes || [];
    fm.causes.push(cause);

    // Sync legacy fm-level (evita FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE critical).
    const causes = fm.causes;
    const sevMax = Math.max(...causes.map(c => Number(c.severity) || 0));
    const occMax = Math.max(...causes.map(c => Number(c.occurrence) || 0));
    const detMax = Math.max(...causes.map(c => Number(c.detection) || 0));
    const apOrder = { H: 3, M: 2, L: 1 };
    let maxAp = '', maxScore = 0;
    for (const c of causes) {
        const v = c.ap || c.actionPriority || '';
        const score = apOrder[String(v).toUpperCase()] || 0;
        if (score > maxScore) { maxAp = v; maxScore = score; }
    }
    if (sevMax > 0) fm.severity = sevMax;
    if (occMax > 0) fm.occurrence = occMax;
    if (detMax > 0) fm.detection = detMax;
    if (maxAp) {
        fm.ap = maxAp;
        fm.actionPriority = maxAp;
    }
    const firstCause = causes[0];
    if (!fm.preventionControl && firstCause.preventionControl) fm.preventionControl = firstCause.preventionControl;
    if (!fm.detectionControl && firstCause.detectionControl) fm.detectionControl = firstCause.detectionControl;
    if (!fm.specialChar && firstCause.specialChar) fm.specialChar = firstCause.specialChar;

    return cause;
}

function applyNewCause(doc, nc, tgt, gaps, logs) {
    const op = findOperation(doc, nc.opNumber);
    if (!op) {
        gaps.push({
            target: tgt.key,
            ncId: nc.id,
            reason: `OP ${nc.opNumber} "${nc.opName}" no existe`,
        });
        return false;
    }
    const opNameActual = op.name || op.operationName || '';
    if (normalizeText(opNameActual) !== normalizeText(nc.opName)) {
        logs.push(
            `[${tgt.key}] INFO: OP ${nc.opNumber} actual "${opNameActual}" != esperada "${nc.opName}" (se usa la actual)`
        );
    }

    const { we, created: weCreated } = findOrCreateWe(op, nc.weName, nc.weType);
    const { fn, created: fnCreated } = findOrCreateFunction(we, nc.functionDescription);
    const { fm, created: fmCreated } = findOrCreateFailure(
        fn,
        nc.failureDescription,
        nc.effectLocal,
        nc.effectNextLevel,
        nc.effectEndUser
    );
    const cause = addCause(fm, nc);

    logs.push(
        `[${tgt.key}] +causa ${nc.id} ${nc.specialChar} S=${nc.severity} O=${nc.occurrence} D=${nc.detection} AP=${cause.ap} → OP${nc.opNumber}/${nc.weName}${weCreated ? ' (WE nuevo)' : ' (WE reutilizado)'}${fnCreated ? ' (fn nueva)' : ' (fn reutilizada)'}${fmCreated ? ' (fm nueva)' : ' (fm reutilizada)'}`
    );
    return true;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    const { apply } = parseSafeArgs();
    const sb = await connectSupabase();

    console.log(`\nAgregando ${NEW_CAUSES.length} causas CC a ${TARGET.key} (${TARGET.name})...`);
    console.log(`  AMFE id: ${TARGET.id}\n`);

    console.log(`─── ${TARGET.key}`);
    const { doc: before, amfe_number } = await readAmfe(sb, TARGET.id);
    const after = structuredClone(before);

    const logs = [];
    const gaps = [];

    for (const nc of NEW_CAUSES) {
        applyNewCause(after, nc, TARGET, gaps, logs);
    }

    for (const line of logs) console.log('  ' + line);
    if (gaps.length > 0) {
        console.log(`  GAPS (${gaps.length}):`);
        for (const g of gaps) console.log(`    - ${g.ncId}: ${g.reason}`);
    }

    const plan = [{
        id: TARGET.id,
        amfeNumber: amfe_number || TARGET.key,
        productName: TARGET.name,
        before,
        after,
    }];

    logChange(apply, `${TARGET.key}: ${logs.length} causas agregadas`, {
        gaps: gaps.length,
        attempted: NEW_CAUSES.length,
    });

    await runWithValidation(plan, apply, async () => {
        for (const change of plan) {
            await saveAmfe(sb, change.id, change.after);
            console.log(`  saveAmfe OK ${change.amfeNumber} (${change.id})`);
        }
    });

    finish(apply);
}

main().catch(err => {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
});

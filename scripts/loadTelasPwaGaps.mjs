/**
 * loadTelasPwaGaps.mjs — Carga gaps del listado oficial I-PY-001.7 Rev A en los
 * 2 AMFEs de Telas PWA (Telas Planas y Telas Termoformadas).
 *
 * Scope autorizado explicitamente por Fak 2026-04-24 (plan load-phase.md):
 *
 *   Parte 1 — CAUSAS NUEVAS (4 causas por AMFE, 2 AMFEs = 8 causas)
 *     - CC7  Dimension material 2 carga hierro (LS 20x20 / LI 15x15 mm)  [CC, S=8]
 *     - CC9  Tolerancia forma/posicion ±3.0 mm CMM/calibre                [CC, S=8]
 *     - SC45 Conformidad sustancias prohibidas UE 2000/53/CE              [SC, S=7]
 *     - SC46 Tela libre elementos perjudiciales inyeccion espuma          [SC, S=7]
 *
 *   Parte 2 — UPDATE norma flamabilidad CC8 (2 updates, 1 por AMFE)
 *     - TPL: causa de flamabilidad existente en OP 10 / TNT PP 30 Blanco
 *     - TTF: causa de flamabilidad existente en OP 10 / Tela Monofelt
 *     - NO crear causa nueva. Solo actualizar preventionControl /
 *       detectionControl a "FMVSS 302 max 10 cm/min" y agregar ref en cause.
 *
 * SKIP explicito (comentado, NO cargar):
 *   - CC6 densidad 700 g/m2 BSDL3505 — Fak decidio skipear 2026-04-24, hay
 *     cambios de material pendientes.
 *
 * Patrones obligatorios (ver .claude/rules/amfe.md + supabase-safety SKILL):
 *   - readAmfe + structuredClone(doc) para before/after
 *   - runWithValidation(plan, apply, commitFn) como gate pre-commit
 *   - saveAmfe al final (hace auto-sync de aliases + fm legacy + verify)
 *   - crypto.randomUUID() para cada entity nueva
 *   - Aliases poblados en ambos lados:
 *       op.opNumber + op.operationNumber
 *       fn.description + fn.functionDescription
 *       cause.cause + cause.description
 *       cause.ap + cause.actionPriority
 *   - _autoFilled: true en causas nuevas para trazabilidad
 *   - Acciones de optimizacion: AP=H sin accion -> "Pendiente definicion
 *     equipo APQP" (placeholder, NO invencion).
 *
 * Uso:
 *   node scripts/loadTelasPwaGaps.mjs           # dry-run
 *   node scripts/loadTelasPwaGaps.mjs --apply   # aplica a Supabase
 */
import crypto from 'node:crypto';
import { connectSupabase, readAmfe, saveAmfe, findOperation, calculateAP, normalizeText } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

// ─── Targets autorizados ──────────────────────────────────────────────────────

const TELAS_PWA = [
    { id: '57011560-d4c1-4a8a-83f0-ed37a2bab1d5', key: 'TPL', name: 'Telas Planas PWA' },
    { id: 'c5201ba9-1225-4663-b7a1-5430f9ee8912', key: 'TTF', name: 'Telas Termoformadas PWA' },
];

// CC6 densidad 700 g/m2 SKIP — Fak decidio no cargarla, hay cambios de material pendientes (2026-04-24)

// ─── Definicion de causas nuevas (I-PY-001.7 Rev A) ───────────────────────────

/**
 * 4 causas nuevas a cargar en OP 10 "RECEPCION DE MATERIA PRIMA" de ambos AMFEs.
 * Para CC7/CC9 pueden requerir ubicar en OP con control dimensional — si no hay
 * WE adecuado en OP 10, se crea con weName sugerido.
 */
const NEW_CAUSES = [
    {
        code: 'CC7',
        label: 'Dimension material 2 carga hierro',
        opNumber: '10',
        weName: 'Material: Refuerzo con carga hierro',
        weType: 'Material',
        functionDescription: 'Refuerzo con carga hierro dentro de tolerancia dimensional',
        failureDescription: 'Carga hierro fuera de 15x15 a 20x20 mm',
        effectLocal: 'Refuerzo rechazado, lote segregar',
        effectNextLevel: 'Fijacion incorrecta en ensamble cliente',
        effectEndUser: 'Falla funcional de tela',
        causeText: 'Proveedor entrega refuerzo fuera de tolerancia',
        severity: 8,
        occurrence: 4,
        detection: 3,
        specialChar: 'CC',
        characteristicNumber: '',
        preventionControl: 'Certificado proveedor + control dimensional',
        detectionControl: 'Calibre calibrado, 1 pieza por lote',
        responsible: 'Inspector de Calidad',
    },
    {
        code: 'CC9',
        label: 'Tolerancia forma/posicion +/-3mm CMM',
        // NOTA: idealmente OP 25/80/100 (control dimensional). Si no hay WE adecuado,
        // se agrega en OP 10 como control dimensional de entrada. Se busca priorizando
        // OPs de control; fallback a OP 10.
        preferredOps: ['80', '100', '25'],
        fallbackOp: '10',
        weName: 'Control dimensional forma/posicion +/-3mm',
        weType: 'Measurement',
        functionDescription: 'Pieza cumple tolerancia forma/posicion +/-3mm',
        failureDescription: 'Dimension fuera de +/-3mm',
        effectLocal: 'Rechazo control dimensional',
        effectNextLevel: 'No ensamblable en linea cliente',
        effectEndUser: 'Encastre deficiente',
        causeText: 'Variacion de proceso sin capability validada',
        severity: 8,
        occurrence: 4,
        detection: 3,
        specialChar: 'CC',
        characteristicNumber: '',
        preventionControl: 'Capability CMM 3D validado + patron dimensional',
        detectionControl: 'CMM 3D o calibre, 5 piezas por lote',
        responsible: 'Inspector de Calidad',
    },
    {
        code: 'SC45',
        label: 'Sustancias prohibidas UE 2000/53/CE',
        opNumber: '10',
        weName: 'Material: Declaracion IMDS',
        weType: 'Material',
        functionDescription: 'Material conforme EU 2000/53/CE',
        failureDescription: 'Material contiene sustancias prohibidas anexo II',
        effectLocal: 'Lote rechazado',
        effectNextLevel: 'Incumplimiento regulatorio cliente',
        effectEndUser: 'Producto no homologable UE',
        causeText: 'Proveedor sin declaracion IMDS actualizada',
        severity: 7,
        occurrence: 3,
        detection: 3,
        specialChar: 'SC',
        characteristicNumber: '',
        preventionControl: 'Declaracion IMDS + certificado sustancias prohibidas del proveedor',
        detectionControl: 'Verificacion documental P-14',
        responsible: 'Inspector de Calidad',
    },
    {
        code: 'SC46',
        label: 'Compatibilidad con inyeccion espuma PU',
        opNumber: '10',
        weName: 'Material: Compatibilidad con espuma PU',
        weType: 'Material',
        functionDescription: 'Material compatible con inyeccion espuma PU',
        failureDescription: 'Material con contaminantes que afectan adhesion/reaccion espuma',
        effectLocal: 'Falla de adhesion en ensamble posterior',
        effectNextLevel: 'Delaminacion producto terminado',
        effectEndUser: 'Desprendimiento de tela del asiento',
        causeText: 'Material con residuo de antiadherente o silicona',
        severity: 7,
        occurrence: 3,
        detection: 4,
        specialChar: 'SC',
        characteristicNumber: '',
        preventionControl: 'Certificado compatibilidad espuma del proveedor + ensayo por lote',
        detectionControl: 'Ensayo compatibilidad de laboratorio',
        responsible: 'Inspector de Calidad',
    },
];

// ─── CLI + connect ────────────────────────────────────────────────────────────

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId() { return crypto.randomUUID(); }

function buildCause(def) {
    const ap = calculateAP(def.severity, def.occurrence, def.detection);
    const cause = {
        id: newId(),
        cause: def.causeText,
        description: def.causeText,             // alias obligatorio
        severity: def.severity,
        occurrence: def.occurrence,
        detection: def.detection,
        ap,
        actionPriority: ap,                      // alias obligatorio
        specialChar: def.specialChar || '',
        characteristicNumber: def.characteristicNumber || '',
        preventionControl: def.preventionControl,
        detectionControl: def.detectionControl,
        responsible: def.responsible || '',
        _autoFilled: true,
    };
    // AP=H sin accion => placeholder "Pendiente definicion equipo APQP"
    if (ap === 'H') {
        cause.optimizationAction = 'Pendiente definicion equipo APQP';
        cause.preventionAction = 'Pendiente definicion equipo APQP';
        cause.detectionAction = 'Pendiente definicion equipo APQP';
    }
    return cause;
}

function buildFailure(def, cause) {
    // Los campos fm.severity/occurrence/detection/ap/preventionControl/detectionControl/
    // specialChar se poblan al nivel failure para que el validator no flaguee
    // FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE (gate pre-commit). saveAmfe tambien corre
    // syncLegacyFmFields al escribir, pero runWithValidation valida el estado
    // before-save, asi que hay que pre-poblar aca.
    return {
        id: newId(),
        description: def.failureDescription,
        effectLocal: def.effectLocal,
        effectNextLevel: def.effectNextLevel,
        effectEndUser: def.effectEndUser,
        // Legacy fm-level (mantener en sync con cause)
        severity: cause.severity,
        occurrence: cause.occurrence,
        detection: cause.detection,
        ap: cause.ap,
        actionPriority: cause.actionPriority,
        preventionControl: cause.preventionControl,
        detectionControl: cause.detectionControl,
        specialChar: cause.specialChar || '',
        classification: '',
        causes: [cause],
        _autoFilled: true,
    };
}

function buildFunction(def, failure) {
    return {
        id: newId(),
        description: def.functionDescription,
        functionDescription: def.functionDescription,  // alias obligatorio
        requirements: '',
        failures: [failure],
        _autoFilled: true,
    };
}

function buildWorkElement(def, fn) {
    return {
        id: newId(),
        name: def.weName,
        type: def.weType,
        functions: [fn],
        _autoFilled: true,
    };
}

/**
 * Busca un Work Element existente con el mismo name (normalizado) o el mismo
 * concepto (material/measurement). Devuelve el WE o null.
 */
function findMatchingWe(op, def) {
    const wes = op.workElements || [];
    const targetNorm = normalizeText(def.weName);
    // Match exacto por nombre
    const exact = wes.find(we => normalizeText(we.name) === targetNorm);
    if (exact) return exact;
    // Fallback: si es Material, reusar cualquier WE tipo Material si el concepto encaja
    // (mejor NO reusar automaticamente — crear WE dedicado para trazabilidad)
    return null;
}

function pickOperation(doc, def) {
    // Caso simple: opNumber explicito
    if (def.opNumber) return findOperation(doc, def.opNumber);
    // Caso con preferredOps: buscar la primera que exista
    if (Array.isArray(def.preferredOps)) {
        for (const opN of def.preferredOps) {
            const op = findOperation(doc, opN);
            if (op) return op;
        }
    }
    if (def.fallbackOp) return findOperation(doc, def.fallbackOp);
    return null;
}

/**
 * Inserta la causa nueva para `def` en `doc`. Devuelve { added, skipped, reason }.
 */
function addNewCause(doc, def, label) {
    const op = pickOperation(doc, def);
    if (!op) {
        return { added: false, skipped: true, reason: `OP objetivo no encontrada (${def.opNumber || def.preferredOps?.join('/') || def.fallbackOp})` };
    }
    const cause = buildCause(def);
    const failure = buildFailure(def, cause);

    // Intentar reusar WE existente
    const existingWe = findMatchingWe(op, def);
    if (existingWe) {
        // Crear nueva function dentro del WE existente
        const fn = buildFunction(def, failure);
        existingWe.functions = existingWe.functions || [];
        existingWe.functions.push(fn);
        return { added: true, where: `OP${op.opNumber || op.operationNumber} / WE "${existingWe.name}" (reuso) / fn NEW` };
    }

    // Crear WE nuevo
    const fn = buildFunction(def, failure);
    const we = buildWorkElement(def, fn);
    op.workElements = op.workElements || [];
    op.workElements.push(we);
    return { added: true, where: `OP${op.opNumber || op.operationNumber} / WE "${def.weName}" (NEW)` };
}

// ─── Update CC8 Flamabilidad ──────────────────────────────────────────────────

/**
 * Busca la causa de flamabilidad existente en OP 10 del AMFE y actualiza
 * preventionControl + detectionControl a FMVSS 302. NO crea nueva.
 * Devuelve { updated: bool, note, oldPrev, oldDet, oldCauseText }.
 */
function updateCc8Flamabilidad(doc, productKey) {
    const op = findOperation(doc, '10');
    if (!op) return { updated: false, note: 'OP 10 no encontrada' };

    // Buscar cualquier failure cuya description contenga "flamab" (case-insensitive)
    // en WEs tipo Material.
    const found = [];
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fm of (fn.failures || [])) {
                const desc = normalizeText(fm.description || '');
                if (desc.includes('flamab')) {
                    for (const cause of (fm.causes || [])) {
                        found.push({ we, fn, fm, cause });
                    }
                }
            }
        }
    }

    if (found.length === 0) {
        return { updated: false, note: `[${productKey}] Causa CC8 flamabilidad existente NO encontrada — SKIP (no se crea nueva)` };
    }

    // Si hay mas de una, actualizar todas (son cluster del mismo concepto)
    const changes = [];
    const NEW_PREV = 'Certificado FMVSS 302 del proveedor (max 10 cm/min)';
    const NEW_DET = 'Ensayo laboratorio FMVSS 302, 1 pieza por lote';
    const CAUSE_REF_SUFFIX = ' (ref FMVSS 302 max 10 cm/min)';

    for (const hit of found) {
        const { fm, cause } = hit;
        const oldPrev = cause.preventionControl || '';
        const oldDet = cause.detectionControl || '';
        const oldCause = cause.cause || cause.description || '';

        // severity/specialChar: mantener (no cambiar)
        cause.preventionControl = NEW_PREV;
        cause.detectionControl = NEW_DET;

        // Preservar texto de cause pero agregar ref FMVSS al final si no esta
        if (!oldCause.toLowerCase().includes('fmvss 302')) {
            const newCause = oldCause + CAUSE_REF_SUFFIX;
            cause.cause = newCause;
            cause.description = newCause;
        }

        // Tambien actualizar fm.description si menciona norma vieja
        const oldFailDesc = fm.description || '';
        if (/BSDM0500|norma cliente PWA/i.test(oldFailDesc)) {
            fm.description = oldFailDesc
                .replace(/BSDM0500[^)]*\)?/gi, 'FMVSS 302 (max 10 cm/min)')
                .replace(/norma cliente PWA/gi, 'norma FMVSS 302');
        }

        changes.push({
            failureDesc: fm.description,
            oldPrev,
            newPrev: NEW_PREV,
            oldDet,
            newDet: NEW_DET,
            oldCause,
            newCause: cause.cause,
        });
    }

    return {
        updated: true,
        note: `[${productKey}] Actualizada norma flamabilidad: ${changes.length} causa(s) -> FMVSS 302`,
        changes,
    };
}

// ─── Build plan ───────────────────────────────────────────────────────────────

const plan = [];

for (const target of TELAS_PWA) {
    const { doc, amfe_number, row } = await readAmfe(sb, target.id);
    const before = structuredClone(doc);
    const after = structuredClone(doc);

    console.log(`\n=== ${target.name} (${amfe_number}) ===`);

    // PART 1 — CAUSAS NUEVAS
    let addedCount = 0;
    let skippedCount = 0;
    for (const def of NEW_CAUSES) {
        const res = addNewCause(after, def, target.key);
        if (res.added) {
            addedCount++;
            console.log(`  + ${def.code} ${def.label} -> ${res.where}`);
        } else {
            skippedCount++;
            console.log(`  ! ${def.code} ${def.label} SKIPPED: ${res.reason}`);
        }
    }

    // PART 2 — UPDATE CC8 flamabilidad (in-place)
    const cc8 = updateCc8Flamabilidad(after, target.key);
    console.log(`  ~ CC8 flamabilidad: ${cc8.note}`);
    if (cc8.updated && cc8.changes) {
        for (const ch of cc8.changes) {
            console.log(`     - failure "${ch.failureDesc}"`);
            console.log(`       preventionControl: "${ch.oldPrev}" -> "${ch.newPrev}"`);
            console.log(`       detectionControl:  "${ch.oldDet}"  -> "${ch.newDet}"`);
            if (ch.oldCause !== ch.newCause) {
                console.log(`       cause: "${ch.oldCause}" -> "${ch.newCause}"`);
            }
        }
    }

    console.log(`  Subtotal ${target.key}: ${addedCount} causas nuevas, ${skippedCount} skipped, CC8 updated=${cc8.updated}`);

    plan.push({
        id: target.id,
        amfeNumber: amfe_number,
        productName: row.project_name,
        before,
        after,
        _meta: { addedCount, skippedCount, cc8Updated: cc8.updated },
    });
}

// ─── Summary ──────────────────────────────────────────────────────────────────

const totalAdded = plan.reduce((s, p) => s + p._meta.addedCount, 0);
const totalSkipped = plan.reduce((s, p) => s + p._meta.skippedCount, 0);
const totalCc8 = plan.filter(p => p._meta.cc8Updated).length;

console.log(`\n=== RESUMEN ===`);
console.log(`  Causas nuevas cargadas: ${totalAdded} / ${NEW_CAUSES.length * TELAS_PWA.length} esperadas`);
console.log(`  Causas nuevas skipped:  ${totalSkipped}`);
console.log(`  CC8 flamabilidad updates: ${totalCc8} / ${TELAS_PWA.length} esperados`);

// ─── Gate + commit ────────────────────────────────────────────────────────────

await runWithValidation(plan, apply, async () => {
    for (const change of plan) {
        await saveAmfe(sb, change.id, change.after, { expectedAmfeNumber: change.amfeNumber });
        console.log(`  saved ${change.amfeNumber}`);
    }
});

finish(apply);

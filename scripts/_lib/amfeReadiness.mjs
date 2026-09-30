/**
 * amfeReadiness.mjs — Scorecard "AMFE listo para entregar".
 *
 * Plan wise-jumping-island (2026-06-26). Complementa el candado anti-invento:
 *   - El gate (runWithValidation) garantiza "datos VALIDOS" (bloquea inventos).
 *   - Esto responde "el AMFE esta COMPLETO y listo para entregar al cliente?".
 *
 * Funcion PURA (sin Supabase) -> 100% testeable. Reusa validateAmfeDoc (los 30+ checks
 * que ya existen) y le agrega: chequeo de headers + un criterio de "entregable".
 *
 * "LISTO" = 0 bloqueantes. Los warnings se muestran pero NO impiden entregar.
 *
 * Bloqueantes de readiness = (a) criticos del validador (CRITICAL_TYPES: S/O/D faltante,
 * AP=H sin accion, inventos, estructura rota, severidad legal subcalibrada, etc.)
 * + (b) efectos VDA 3 niveles faltantes (en el validador son WARNING, pero AIAG-VDA los
 * exige para entregar) + (c) campos de caratula/header obligatorios.
 *
 * MODO "ENTREGA" (opts.entrega = true; `node scripts/_readiness.mjs --entrega`). Para el AMFE
 * que sale de verdad —al cliente, al legajo, a planta— y no solo "esta completo". Sube a
 * bloqueante lo que en el dia a dia es aviso, porque el que lo recibe no puede resolverlo:
 *   - un TBD en un campo que el export imprime (TBD_EN_CAMPO_EXPORTABLE). En el trabajo
 *     diario un TBD es honesto (core-prohibiciones §1); en el documento que sale, es un hueco.
 *   - una cita de la fuente entre parentesis en un control (CONTROL_CON_CITA): Fak, 23/09/2026,
 *     "esa esta al pedo, molestan". La fuente vive en el generador, no en el documento.
 *   - una caracteristica que el cliente designo critica con una S menor
 *     (CARACTERISTICA_CLIENTE_S_MENOR) SIN decision escrita. La diferencia se informa, no se
 *     corrige subiendo la S (caracteristicas-especiales.md §2bis); pero tiene que haber
 *     alguien que la decidio. La decision se declara en la causa, en `specialCharDecision`
 *     (texto libre: quien, cuando, que se resolvio). Con el campo escrito sigue siendo aviso.
 * Sin el modo, el scorecard es exactamente el de antes.
 *
 * API:
 *   - computeReadiness(doc, productName, amfeNumber, header, { entrega }) -> scorecard
 *   - scanTbdExportable(doc, header, amfeNumber) -> issues (los TBD que el modo entrega bloquea)
 *   - formatScorecard(score, { verbose }) -> string (para imprimir)
 */
import { validateAmfeDoc } from './amfeValidator.mjs';

// Campos de header requeridos para entregar (mismo criterio que _auditAll.mjs:43-52).
const HEADER_REQUIRED = ['organization', 'client', 'approvedBy', 'reviewedBy', 'rev'];
const HEADER_REQUIRED_NON_MASTER = ['partNumber', 'applicableParts'];
const HEADER_RESPONSIBLE_ALIASES = ['responsible', 'processResponsible', 'responsibleEngineer', 'elaboratedBy'];

// Warnings del validador que, para "entregar al cliente", SI son bloqueantes.
// Efectos VDA 3 niveles: AIAG-VDA los exige (rules/amfe.md "Efectos VDA — 3 niveles obligatorios").
const READINESS_EXTRA_BLOCKER_TYPES = new Set([
    'FM_NO_EFFECT_LOCAL',
    'FM_NO_EFFECT_NEXT',
    'FM_NO_EFFECT_END',
]);

// Mapeo type -> dimension legible para el scorecard.
const DIMENSION_BY_TYPE = {
    FORBIDDEN_VOCABULARY: 'Datos validos (sin inventos)',
    CLAUDE_PHRASE: 'Vocabulario Claude / frecuencias',
    CAUSE_MISSING_SOD: 'S/O/D completos',
    CAUSE_NO_AP: 'S/O/D completos',
    // Hasta el 21/09/2026 la dimension era "Acciones en AP=H" y la bloqueaba la celda VACIA.
    // Hoy es al reves: la celda vacia es estado valido y lo que bloquea es el placeholder
    // (Fak: "saca esa mierda, no la quiero ni ver en el AMFE"). Ver amfe.md §4.
    CAUSE_APH_PLACEHOLDER_PROHIBIDO: 'Placeholder prohibido en AP=H',
    EQUIPO_PERSONA_NO_TRABAJA: 'Caratula / Header',
    EQUIPO_PERSONA_DESCONOCIDA: 'Caratula / Header',
    FM_NO_EFFECT_LOCAL: 'Efectos VDA (3 niveles)',
    FM_NO_EFFECT_NEXT: 'Efectos VDA (3 niveles)',
    FM_NO_EFFECT_END: 'Efectos VDA (3 niveles)',
    CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED: 'Severidad legal',
    CAUSE_CC_LOW_SEVERITY: 'CC/SC calibracion',
    CAUSE_SC_FUERA_DE_REGLA: 'CC/SC calibracion',
    SIGLA_DESCONOCIDA: 'CC/SC calibracion',
    CUTTING_EFFECT_REWORK_SUSPECT: 'Calibracion efectos (corte=scrap)',
    HEADER_MISSING: 'Caratula / Header',
    CAUSE_NO_PREV_CTRL: 'Controles',
    CAUSE_NO_DET_CTRL: 'Controles',
};

// Dimensiones que solo se usan en modo ENTREGA (en modo normal los avisos se agrupan como
// siempre, para que el scorecard de hoy salga igual).
const DIMENSION_ENTREGA = {
    TBD_EN_CAMPO_EXPORTABLE: 'TBD en campos exportables',
    CONTROL_CON_CITA: 'Controles: cita de la fuente',
    CARACTERISTICA_CLIENTE_S_MENOR: 'CC/SC calibracion',
};

function isEmptyStr(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function dimensionFor(type, entrega = false) {
    return (entrega && DIMENSION_ENTREGA[type]) || DIMENSION_BY_TYPE[type] || 'Estructura / completitud';
}

/** Avisos del validador que el modo ENTREGA convierte en bloqueantes. */
function esBloqueanteDeEntrega(issue) {
    if (issue.type === 'CONTROL_CON_CITA') return true;
    // Con decision escrita por Fak sigue siendo aviso: la diferencia ya esta resuelta.
    if (issue.type === 'CARACTERISTICA_CLIENTE_S_MENOR') return !String(issue.decision ?? '').trim();
    return false;
}

const TBD_RE = /\bTBD\b/i;

/**
 * TBD_EN_CAMPO_EXPORTABLE — un "TBD" en un campo que el export del AMFE imprime.
 *
 * Campos: los que lee `modules/amfe/amfeExcelExport.ts` (nombre de operacion, funciones,
 * WE, modo de falla, 3 efectos, causa, controles, acciones, responsable, observaciones) y los
 * de la caratula que el readiness ya exige. Un TBD adentro de otro texto ("frecuencia TBD")
 * cuenta igual: es un hueco impreso. No mira `_meta` ni nada que el export no imprima.
 *
 * Solo lo usa el modo entrega: en el trabajo diario un TBD es la forma honesta de marcar un
 * dato que falta (core-prohibiciones §1, amfe.md §6) y no puede bloquear.
 *
 * @returns {Array<{type, detail, amfe, opNum?, opName?, weName?, fmDesc?, causeDesc?, campo}>}
 */
export function scanTbdExportable(doc, header = null, amfeNumber = '') {
    const out = [];
    const push = (ctx, campo, valor) => {
        const txt = String(valor ?? '');
        if (!TBD_RE.test(txt)) return;
        out.push({
            ...ctx, type: 'TBD_EN_CAMPO_EXPORTABLE', campo,
            detail: `${campo} dice "${txt.trim().slice(0, 70)}": en el documento que sale no va un TBD`,
        });
    };

    const hdr = header || (doc && doc.header) || {};
    const camposHeader = [...HEADER_REQUIRED, ...HEADER_REQUIRED_NON_MASTER, ...HEADER_RESPONSIBLE_ALIASES];
    for (const f of new Set(camposHeader)) push({ amfe: amfeNumber, opNum: '-' }, `header.${f}`, hdr[f]);

    for (const op of (doc && Array.isArray(doc.operations) ? doc.operations : [])) {
        const opNum = op.opNumber ?? op.operationNumber ?? '?';
        const opName = op.name ?? op.operationName ?? '';
        const opCtx = { amfe: amfeNumber, opNum, opName };
        push(opCtx, 'operation.name', op.name);
        if (op.operationName !== op.name) push(opCtx, 'operation.operationName', op.operationName);
        push(opCtx, 'focusElementFunction', op.focusElementFunction);
        push(opCtx, 'operationFunction', op.operationFunction);
        for (const we of (op.workElements || [])) {
            const weCtx = { ...opCtx, weName: we.name };
            push(weCtx, 'workElement.name', we.name);
            for (const fn of (we.functions || [])) {
                push(weCtx, 'function.description', fn.description);
                if (fn.functionDescription !== fn.description) push(weCtx, 'function.functionDescription', fn.functionDescription);
                for (const fm of (fn.failures || [])) {
                    const fmCtx = { ...weCtx, fmDesc: fm.description };
                    push(fmCtx, 'failure.description', fm.description);
                    push(fmCtx, 'effectLocal', fm.effectLocal);
                    push(fmCtx, 'effectNextLevel', fm.effectNextLevel);
                    push(fmCtx, 'effectEndUser', fm.effectEndUser);
                    for (const c of (fm.causes || [])) {
                        const cCtx = { ...fmCtx, causeDesc: c.description || c.cause || '' };
                        push(cCtx, 'cause.cause', c.cause);
                        if (c.description !== c.cause) push(cCtx, 'cause.description', c.description);
                        for (const campo of ['preventionControl', 'detectionControl', 'preventionAction',
                            'detectionAction', 'optimizationAction', 'responsible', 'actionTaken', 'observations']) {
                            push(cCtx, campo, c[campo]);
                        }
                    }
                }
            }
        }
    }
    return out;
}

/**
 * Computa el scorecard de "listo para entregar" de un AMFE.
 *
 * @param {object} doc - AMFE parseado (data.operations[]...)
 * @param {string} [productName='']
 * @param {string} [amfeNumber='']
 * @param {object} [header=null] - doc.header si no se pasa
 * @param {{entrega?: boolean}} [opts] - `entrega: true` = modo ENTREGA (ver cabecera del archivo)
 * @returns {{ amfeNumber, productName, modo: 'normal'|'entrega', verdict: 'LISTO'|'NO_LISTO',
 *             blockerCount, warningCount, blockers: Array, warnings: Array,
 *             dimensions: Record<string,{blockers:number,warnings:number}> }}
 */
export function computeReadiness(doc, productName = '', amfeNumber = '', header = null, opts = {}) {
    const entrega = opts != null && opts.entrega === true;
    const v = validateAmfeDoc(doc, productName, amfeNumber);

    // Header
    const hdr = header || (doc && doc.header) || {};
    const isMaestro = /MAESTRO/i.test(String(productName || '')) || /MAESTRO/i.test(String(amfeNumber || ''));
    const headerIssues = [];
    for (const f of HEADER_REQUIRED) {
        if (isEmptyStr(hdr[f])) headerIssues.push({ type: 'HEADER_MISSING', detail: `header.${f} vacio`, field: f });
    }
    if (!isMaestro) {
        for (const f of HEADER_REQUIRED_NON_MASTER) {
            if (isEmptyStr(hdr[f])) headerIssues.push({ type: 'HEADER_MISSING', detail: `header.${f} vacio`, field: f });
        }
    }
    if (!HEADER_RESPONSIBLE_ALIASES.some(a => !isEmptyStr(hdr[a]))) {
        headerIssues.push({ type: 'HEADER_MISSING', detail: `responsable vacio (ningun alias: ${HEADER_RESPONSIBLE_ALIASES.join('/')})`, field: 'responsible' });
    }

    // Separar warnings del validador en: los que para ENTREGAR son bloqueantes vs avisos.
    // En modo ENTREGA se suman los avisos que para salir son bloqueantes (ver cabecera).
    const promueve = (i) => READINESS_EXTRA_BLOCKER_TYPES.has(i.type) || (entrega && esBloqueanteDeEntrega(i));
    const promotedBlockers = v.warning.filter(promueve);
    const realWarnings = v.warning.filter(i => !promueve(i));
    const tbdIssues = entrega ? scanTbdExportable(doc, hdr, amfeNumber) : [];

    const blockers = [...v.critical, ...promotedBlockers, ...headerIssues, ...tbdIssues];
    const warnings = [...realWarnings];

    // Dimensiones
    const dimensions = {};
    const bump = (type, kind) => {
        const d = dimensionFor(type, entrega);
        if (!dimensions[d]) dimensions[d] = { blockers: 0, warnings: 0 };
        dimensions[d][kind]++;
    };
    for (const i of blockers) bump(i.type, 'blockers');
    for (const i of warnings) bump(i.type, 'warnings');

    return {
        amfeNumber,
        productName,
        modo: entrega ? 'entrega' : 'normal',
        verdict: blockers.length === 0 ? 'LISTO' : 'NO_LISTO',
        blockerCount: blockers.length,
        warningCount: warnings.length,
        blockers,
        warnings,
        dimensions,
    };
}

/**
 * Formatea un scorecard a texto legible (para el runner _readiness.mjs).
 * @param {object} score - resultado de computeReadiness
 * @param {{verbose?: boolean}} [opts]
 * @returns {string}
 */
export function formatScorecard(score, opts = {}) {
    const { verbose = true } = opts;
    const entrega = score.modo === 'entrega';
    const icon = score.verdict === 'LISTO' ? '✓ LISTO' : '✗ NO LISTO';
    const lines = [];
    lines.push(`▸ ${String(score.amfeNumber).padEnd(24)} ${icon}${entrega ? ' (entrega)' : ''}  — ${score.blockerCount} bloqueante(s), ${score.warningCount} aviso(s)  (${score.productName})`);
    if (!verbose) return lines.join('\n');

    // Agrupar bloqueantes y avisos por dimension
    const byDim = {};
    for (const b of score.blockers) {
        const d = dimensionFor(b.type, entrega);
        (byDim[d] = byDim[d] || { blockers: [], warnings: [] }).blockers.push(b);
    }
    for (const w of score.warnings) {
        const d = dimensionFor(w.type, entrega);
        (byDim[d] = byDim[d] || { blockers: [], warnings: [] }).warnings.push(w);
    }
    for (const [dim, g] of Object.entries(byDim)) {
        if (g.blockers.length) {
            lines.push(`    ✗ ${dim}: ${g.blockers.length} bloqueante(s)`);
            for (const b of g.blockers.slice(0, 4)) {
                lines.push(`        OP${b.opNum != null ? b.opNum : '-'} ${(b.detail || b.type)}`.slice(0, 120));
            }
            if (g.blockers.length > 4) lines.push(`        ... ${g.blockers.length - 4} mas`);
        }
    }
    for (const [dim, g] of Object.entries(byDim)) {
        if (g.warnings.length) {
            lines.push(`    ⚠ ${dim}: ${g.warnings.length} aviso(s)`);
        }
    }
    return lines.join('\n');
}

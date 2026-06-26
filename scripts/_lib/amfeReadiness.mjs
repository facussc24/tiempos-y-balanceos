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
 * API:
 *   - computeReadiness(doc, productName, amfeNumber, header) -> scorecard
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
    CAUSE_APH_EMPTY_NO_PLACEHOLDER: 'Acciones en AP=H',
    FM_NO_EFFECT_LOCAL: 'Efectos VDA (3 niveles)',
    FM_NO_EFFECT_NEXT: 'Efectos VDA (3 niveles)',
    FM_NO_EFFECT_END: 'Efectos VDA (3 niveles)',
    CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED: 'Severidad legal',
    CAUSE_CC_LOW_SEVERITY: 'CC/SC calibracion',
    CAUSE_SC_LOW_SEVERITY: 'CC/SC calibracion',
    CUTTING_EFFECT_REWORK_SUSPECT: 'Calibracion efectos (corte=scrap)',
    HEADER_MISSING: 'Caratula / Header',
    CAUSE_NO_PREV_CTRL: 'Controles',
    CAUSE_NO_DET_CTRL: 'Controles',
};

function isEmptyStr(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function dimensionFor(type) {
    return DIMENSION_BY_TYPE[type] || 'Estructura / completitud';
}

/**
 * Computa el scorecard de "listo para entregar" de un AMFE.
 *
 * @param {object} doc - AMFE parseado (data.operations[]...)
 * @param {string} [productName='']
 * @param {string} [amfeNumber='']
 * @param {object} [header=null] - doc.header si no se pasa
 * @returns {{ amfeNumber, productName, verdict: 'LISTO'|'NO_LISTO',
 *             blockerCount, warningCount, blockers: Array, warnings: Array,
 *             dimensions: Record<string,{blockers:number,warnings:number}> }}
 */
export function computeReadiness(doc, productName = '', amfeNumber = '', header = null) {
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
    const promotedBlockers = v.warning.filter(i => READINESS_EXTRA_BLOCKER_TYPES.has(i.type));
    const realWarnings = v.warning.filter(i => !READINESS_EXTRA_BLOCKER_TYPES.has(i.type));

    const blockers = [...v.critical, ...promotedBlockers, ...headerIssues];
    const warnings = [...realWarnings];

    // Dimensiones
    const dimensions = {};
    const bump = (type, kind) => {
        const d = dimensionFor(type);
        if (!dimensions[d]) dimensions[d] = { blockers: 0, warnings: 0 };
        dimensions[d][kind]++;
    };
    for (const i of blockers) bump(i.type, 'blockers');
    for (const i of warnings) bump(i.type, 'warnings');

    return {
        amfeNumber,
        productName,
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
    const icon = score.verdict === 'LISTO' ? '✓ LISTO' : '✗ NO LISTO';
    const lines = [];
    lines.push(`▸ ${String(score.amfeNumber).padEnd(24)} ${icon}  — ${score.blockerCount} bloqueante(s), ${score.warningCount} aviso(s)  (${score.productName})`);
    if (!verbose) return lines.join('\n');

    // Agrupar bloqueantes y avisos por dimension
    const byDim = {};
    for (const b of score.blockers) {
        const d = dimensionFor(b.type);
        (byDim[d] = byDim[d] || { blockers: [], warnings: [] }).blockers.push(b);
    }
    for (const w of score.warnings) {
        const d = dimensionFor(w.type);
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

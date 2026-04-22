/**
 * amfeValidator.mjs — Validacion pre-commit de documentos AMFE.
 *
 * Complementa _auditIntegral.mjs (que audita POST-escritura sobre Supabase)
 * con validacion IN-MEMORY que se corre ANTES de escribir. Permite detectar
 * issues introducidos por un script .mjs antes de que lleguen a la base.
 *
 * Uso tipico:
 *   import { validateAmfeDoc, diffIssues } from './_lib/amfeValidator.mjs';
 *
 *   const before = validateAmfeDoc(originalDoc, productName);
 *   const after  = validateAmfeDoc(modifiedDoc, productName);
 *   const introduced = diffIssues(before, after);
 *   if (introduced.critical.length > 0) {
 *     // bloquear apply
 *   }
 *
 * Tambien se puede usar via runWithValidation() en dryRunGuard.mjs, que
 * hace el wiring automaticamente.
 *
 * Los checks replican la logica de scripts/_auditIntegral.mjs (single source
 * of truth: si se agrega un check alli, copiarlo aca tambien).
 */

const SUSPICIOUS_OP_PATTERNS = [
    'CLASIFICACION Y SEGREGACION',
    'SEGREGACION DE PRODUCTO NO CONFORME',
    'CLASIFICACION DE NO CONFORMES',
];

/**
 * Campos "legacy" a nivel failure que el EXPORT REAL lee.
 *
 * Segun `modules/amfe/amfeExcelExport.ts`, solo `fm.severity` se lee a nivel
 * failure. Los demas (ocurrencia, deteccion, AP, controles) se leen de cause[].
 *
 * Por eso este array incluye SOLO los campos que el export usa a nivel fm.
 * Si manana el export cambia y lee mas campos fm-level, agregarlos aca.
 *
 * Ver incidente 2026-04-22 OP80 Telas Planas — fm.severity vacio.
 */
const LEGACY_FM_FIELDS = [
    'severity',
];

/**
 * Retorna true si el valor fm-level esta "vacio" desde la perspectiva del export.
 */
function isFmEmpty(v) {
    return v === '' || v === null || v === undefined || (typeof v === 'number' && v === 0);
}

/**
 * Pares de aliases del schema AMFE. Si uno tiene valor y el otro esta vacio,
 * el export/UI que lee "el otro" muestra celda vacia. Ver rules/amfe.md.
 */
const FIELD_ALIAS_PAIRS = [
    { entity: 'op',    a: 'opNumber',    b: 'operationNumber' },
    { entity: 'op',    a: 'name',        b: 'operationName' },
    { entity: 'fn',    a: 'description', b: 'functionDescription' },
    { entity: 'cause', a: 'cause',       b: 'description' },
    { entity: 'cause', a: 'ap',          b: 'actionPriority' },
];

function isEmptyStr(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/**
 * Retorna true si al menos una causa tiene valor para ese campo (o su alias).
 */
function hasCauseValue(causes, field) {
    for (const c of (causes || [])) {
        let v = c[field];
        if (field === 'ap' && (v == null || v === '')) v = c.actionPriority;
        if (field === 'actionPriority' && (v == null || v === '')) v = c.ap;
        if (field === 'cause' && (v == null || v === '')) v = c.description;
        if (field === 'effect' && (v == null || v === '')) v = c.effectLocal;  // best-effort
        if (v !== undefined && v !== null && v !== '' && v !== 0) return true;
    }
    return false;
}

/** Tipos de issue que son BLOQUEANTES (bloquean apply) */
const CRITICAL_TYPES = new Set([
    'EMPTY_OP',
    'SUSPICIOUS_OP',
    'INVALID_OP_CLIPS',
    'WE_NO_FN',
    'FM_NO_CAUSES',
    'CAUSE_MISSING_SOD',
    'DATA_NOT_OBJECT',
    'OPERATIONS_NOT_ARRAY',
    'FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE',
    'FIELD_ALIAS_DESYNC',
]);

/**
 * Valida un documento AMFE en memoria y retorna issues agrupados por severidad.
 *
 * @param {object} doc - Objeto AMFE parseado (data.operations[]...)
 * @param {string} [productName=''] - Nombre del producto/familia para reglas
 *                                    contextuales (ej: Telas Planas sin clips).
 * @param {string} [amfeNumber=''] - Numero AMFE para etiquetar issues.
 * @returns {{critical: Array, warning: Array, all: Array}}
 */
export function validateAmfeDoc(doc, productName = '', amfeNumber = '') {
    const issues = [];

    // Guard: doc con forma minima
    if (!doc || typeof doc !== 'object') {
        issues.push({ type: 'DATA_NOT_OBJECT', detail: `typeof=${typeof doc}`, amfe: amfeNumber });
        return groupIssues(issues);
    }
    if (!Array.isArray(doc.operations)) {
        issues.push({ type: 'OPERATIONS_NOT_ARRAY', detail: 'data.operations no es array', amfe: amfeNumber });
        return groupIssues(issues);
    }

    const productUp = String(productName).toUpperCase();

    for (const op of doc.operations) {
        const opNum = op.opNumber || op.operationNumber || '?';
        const opName = op.name || op.operationName || '';
        const opNameUp = opName.toUpperCase();
        const ctx = { amfe: amfeNumber, product: productName, opNum, opName };

        // ALIAS DESYNC — op-level
        for (const pair of FIELD_ALIAS_PAIRS.filter(p => p.entity === 'op')) {
            const vA = op[pair.a], vB = op[pair.b];
            if (isEmptyStr(vA) && !isEmptyStr(vB)) {
                issues.push({ ...ctx, type: 'FIELD_ALIAS_DESYNC',
                    detail: `op.${pair.a}="" pero op.${pair.b} tiene valor (export leera el alias vacio)` });
            } else if (!isEmptyStr(vA) && isEmptyStr(vB)) {
                issues.push({ ...ctx, type: 'FIELD_ALIAS_DESYNC',
                    detail: `op.${pair.b}="" pero op.${pair.a} tiene valor (export leera el alias vacio)` });
            }
        }

        // Operacion sospechosa: Clasif/Segreg (ver .claude/rules/pfd.md)
        if (SUSPICIOUS_OP_PATTERNS.some(p => opNameUp.includes(p))) {
            issues.push({ ...ctx, type: 'SUSPICIOUS_OP',
                detail: 'Op Clasificacion/Segregacion — no va como op separada, es implicita en Control Final' });
        }

        // Clips en Telas Planas (ver .claude/rules/pfd.md)
        if (opNameUp.includes('CLIP') && (productUp.includes('TELAS_PLANAS') || productUp.includes('TELAS PLANAS'))) {
            issues.push({ ...ctx, type: 'INVALID_OP_CLIPS',
                detail: 'Telas Planas no lleva clips — se refuerza con APLIX y ganchos' });
        }

        const wes = op.workElements || [];
        if (wes.length === 0) {
            issues.push({ ...ctx, type: 'EMPTY_OP', detail: 'Operacion sin workElements' });
            continue;
        }

        // Check: focusElementFunction / operationFunction (C-FEF, C-OPFUNC)
        if (wes.length > 0) {
            if (!op.focusElementFunction || String(op.focusElementFunction).trim() === '') {
                issues.push({ ...ctx, type: 'OP_NO_FEF',
                    detail: 'focusElementFunction vacio (OP con WEs)' });
            }
            if (!op.operationFunction || String(op.operationFunction).trim() === '') {
                issues.push({ ...ctx, type: 'OP_NO_OPFUNC',
                    detail: 'operationFunction vacio (OP con WEs)' });
            }

            // Placeholder "Pendiente" en campos de funcion — CRITICAL
            // (no es valor valido, solo marca que falta contenido real)
            const PLACEHOLDER_RE = /pendiente\s+funcion|^pendiente$|^TBD$|\bpendiente\s+definicion\b/i;
            if (op.operationFunction && PLACEHOLDER_RE.test(String(op.operationFunction))) {
                issues.push({ ...ctx, type: 'OP_PLACEHOLDER_FUNCION',
                    detail: `operationFunction con placeholder ("${String(op.operationFunction).slice(0, 60)}") — requiere contenido real` });
            }
            if (op.focusElementFunction && PLACEHOLDER_RE.test(String(op.focusElementFunction))) {
                issues.push({ ...ctx, type: 'OP_PLACEHOLDER_FUNCION',
                    detail: `focusElementFunction con placeholder ("${String(op.focusElementFunction).slice(0, 60)}")` });
            }
        }

        for (const we of wes) {
            const weName = we.name || '';
            const weType = we.type || '';
            const weCtx = { ...ctx, weName, weType };

            // C-1M: detectar WE con multiples items agrupados (contiene " / ")
            // Evitar falsos positivos: especificaciones tecnicas con "/" dentro
            // de parentesis (ej: "Refuerzo (600+/-60 kg/m3)") no son agrupaciones.
            const nameOutsideParens = weName.replace(/\([^)]*\)/g, '');
            if (nameOutsideParens.includes(' / ')) {
                issues.push({ ...weCtx, type: 'WE_GROUPED_ITEMS',
                    detail: `WE agrupa multiples items: "${weName}" (usar 1 WE por item)` });
            }

            const fns = we.functions || [];
            if (fns.length === 0) {
                issues.push({ ...weCtx, type: 'WE_NO_FN', detail: 'WE sin functions' });
                continue;
            }

            for (const fn of fns) {
                const fnDesc = fn.description || fn.functionDescription || '';
                const fnCtx = { ...weCtx, fnDesc };

                if (!fnDesc || fnDesc.trim() === '' || fnDesc.toUpperCase().startsWith('TBD')) {
                    issues.push({ ...fnCtx, type: 'FN_TBD_OR_EMPTY',
                        detail: 'Function description vacia o TBD' });
                }

                // ALIAS DESYNC — fn-level
                for (const pair of FIELD_ALIAS_PAIRS.filter(p => p.entity === 'fn')) {
                    const vA = fn[pair.a], vB = fn[pair.b];
                    if (isEmptyStr(vA) && !isEmptyStr(vB)) {
                        issues.push({ ...fnCtx, type: 'FIELD_ALIAS_DESYNC',
                            detail: `fn.${pair.a}="" pero fn.${pair.b} tiene valor (export leera alias vacio)` });
                    } else if (!isEmptyStr(vA) && isEmptyStr(vB)) {
                        issues.push({ ...fnCtx, type: 'FIELD_ALIAS_DESYNC',
                            detail: `fn.${pair.b}="" pero fn.${pair.a} tiene valor (export leera alias vacio)` });
                    }
                }

                const failures = fn.failures || [];
                if (failures.length === 0) {
                    issues.push({ ...fnCtx, type: 'FN_NO_FAILURES', detail: 'Function sin failures' });
                    continue;
                }

                for (const fm of failures) {
                    const fmDesc = fm.description || '';
                    const fmCtx = { ...fnCtx, fmDesc };

                    // Efectos VDA 3 niveles
                    if (!fm.effectLocal || String(fm.effectLocal).trim() === '') {
                        issues.push({ ...fmCtx, type: 'FM_NO_EFFECT_LOCAL', detail: 'effectLocal vacio' });
                    }
                    if (!fm.effectNextLevel || String(fm.effectNextLevel).trim() === '') {
                        issues.push({ ...fmCtx, type: 'FM_NO_EFFECT_NEXT', detail: 'effectNextLevel vacio' });
                    }
                    if (!fm.effectEndUser || String(fm.effectEndUser).trim() === '') {
                        issues.push({ ...fmCtx, type: 'FM_NO_EFFECT_END', detail: 'effectEndUser vacio' });
                    }

                    const causes = fm.causes || [];
                    if (causes.length === 0) {
                        issues.push({ ...fmCtx, type: 'FM_NO_CAUSES', detail: 'Failure sin causas' });
                        continue;
                    }

                    // LEGACY FIELDS — fm-level vacio o key missing, pero cause
                    // tiene valor. Export lee fm.X y muestra celda vacia.
                    // IMPORTANTE: reportamos aunque la key NO exista en fm — el
                    // export igual la lee como undefined y sale en blanco.
                    for (const legacyField of LEGACY_FM_FIELDS) {
                        if (!isFmEmpty(fm[legacyField])) continue;
                        if (hasCauseValue(causes, legacyField)) {
                            const fmStatus = legacyField in fm ? JSON.stringify(fm[legacyField]) : '[key missing]';
                            issues.push({
                                ...fmCtx,
                                type: 'FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE',
                                detail: `fm.${legacyField}=${fmStatus} pero cause[].${legacyField} tiene valor (export mostrara celda vacia)`,
                            });
                        }
                    }

                    for (const c of causes) {
                        const causeDesc = c.description || c.cause || '';
                        const cCtx = { ...fmCtx, causeDesc };

                        // ALIAS DESYNC — cause-level
                        for (const pair of FIELD_ALIAS_PAIRS.filter(p => p.entity === 'cause')) {
                            const vA = c[pair.a], vB = c[pair.b];
                            if (isEmptyStr(vA) && !isEmptyStr(vB)) {
                                issues.push({ ...cCtx, type: 'FIELD_ALIAS_DESYNC',
                                    detail: `cause.${pair.a}="" pero cause.${pair.b} tiene valor` });
                            } else if (!isEmptyStr(vA) && isEmptyStr(vB)) {
                                issues.push({ ...cCtx, type: 'FIELD_ALIAS_DESYNC',
                                    detail: `cause.${pair.b}="" pero cause.${pair.a} tiene valor` });
                            }
                        }

                        // C-SOD
                        const missS = c.severity == null || c.severity === '' || c.severity === 0;
                        const missO = c.occurrence == null || c.occurrence === '' || c.occurrence === 0;
                        const missD = c.detection == null || c.detection === '' || c.detection === 0;
                        if (missS || missO || missD) {
                            issues.push({ ...cCtx, type: 'CAUSE_MISSING_SOD',
                                detail: `S=${c.severity} O=${c.occurrence} D=${c.detection}` });
                        }

                        // AP: calculable con S/O/D completos → debe existir ap o actionPriority
                        if (!missS && !missO && !missD && !c.actionPriority && !c.ap) {
                            issues.push({ ...cCtx, type: 'CAUSE_NO_AP', detail: 'S/O/D completos pero sin AP' });
                        }

                        if (!c.preventionControl || String(c.preventionControl).trim() === '') {
                            issues.push({ ...cCtx, type: 'CAUSE_NO_PREV_CTRL', detail: 'Sin preventionControl' });
                        }
                        if (!c.detectionControl || String(c.detectionControl).trim() === '') {
                            issues.push({ ...cCtx, type: 'CAUSE_NO_DET_CTRL', detail: 'Sin detectionControl' });
                        }

                        // C-CAPACITACION (prohibido como causa)
                        const causeUp = causeDesc.toUpperCase();
                        if (causeUp.includes('FALTA DE CAPACITACION') ||
                            causeUp.includes('FALTA DE ENTRENAMIENTO') ||
                            causeUp.includes('OPERARIO NO CAPACITADO')) {
                            issues.push({ ...cCtx, type: 'CAUSE_CAPACITACION',
                                detail: '"Falta de capacitacion" prohibido como causa (ver rules/amfe.md)' });
                        }
                    }
                }
            }
        }
    }

    return groupIssues(issues);
}

/**
 * Agrupa issues en {critical, warning, all} segun CRITICAL_TYPES.
 */
function groupIssues(issues) {
    const critical = issues.filter(i => CRITICAL_TYPES.has(i.type));
    const warning = issues.filter(i => !CRITICAL_TYPES.has(i.type));
    return { critical, warning, all: issues };
}

/**
 * Compara dos sets de issues (before/after) y retorna los NUEVOS introducidos.
 *
 * Un issue se considera igual si { type + opNum + weName + fmDesc + causeDesc }
 * coinciden exactamente.
 *
 * @returns {{critical: Array, warning: Array, all: Array}} issues nuevos
 */
export function diffIssues(before, after) {
    const beforeKeys = new Set(before.all.map(issueKey));
    const newOnes = after.all.filter(i => !beforeKeys.has(issueKey(i)));
    return groupIssues(newOnes);
}

function issueKey(i) {
    return [i.type, i.opNum, i.weName, i.fmDesc, i.causeDesc].join('|');
}

/**
 * Helper para imprimir un resumen legible en stdout.
 */
export function printIssues(label, grouped) {
    const { critical, warning } = grouped;
    console.log(`\n[${label}] critical=${critical.length}  warning=${warning.length}`);
    if (critical.length > 0) {
        console.log('  CRITICOS (bloquean apply):');
        for (const i of critical.slice(0, 20)) {
            console.log(`    - ${i.type}  OP ${i.opNum} "${i.opName || ''}"  ${i.detail || ''}`);
        }
        if (critical.length > 20) console.log(`    ... ${critical.length - 20} mas`);
    }
    if (warning.length > 0) {
        console.log('  warnings:');
        for (const i of warning.slice(0, 10)) {
            console.log(`    - ${i.type}  OP ${i.opNum}  ${i.detail || ''}`);
        }
        if (warning.length > 10) console.log(`    ... ${warning.length - 10} mas`);
    }
}

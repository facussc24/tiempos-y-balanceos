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

import {
    isGeneric6MLabel,
    classifyWeNameVsType,
    normalize,
    TYPE_TRANSLATION,
} from './genericLabels.mjs';
import { scanForbidden } from './forbiddenContent.mjs';
import { calculateAP, apImplausible } from './amfeIo.mjs';

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
    // Calidad textual 6M (agregado 2026-05-15 por plan witty-shimmying-mochi)
    'WE_GENERIC_PLACEHOLDER',
    'FN_GENERIC_PLACEHOLDER',
    'WE_NAME_EQUALS_TYPE',
    'OP_FUNCTION_DUPLICATE_FOCUS',
    // AP=H sin accion (agregado 2026-05-17 por plan soft-snacking-elephant)
    // Bloquea cualquier script que deje causas AP=H sin accion ni placeholder
    // "Pendiente definicion equipo APQP" (ver rules/amfe-aph-pending.md).
    'CAUSE_APH_EMPTY_NO_PLACEHOLDER',
    // El PU se inyecta dentro de la funda ya montada (agregado 2026-08-18, rules/amfe.md §12).
    // Los AMFE 153 y 155 lo tuvieron al reves y la regla escrita repetia el error.
    'PU_ANTES_DE_ENFUNDADO',
    // El AP declarado tiene que salir de la tabla oficial (agregado 2026-08-21, amfe.md §4).
    // Bloquea porque un AP mal calculado subdeclara riesgo en el documento que va al cliente.
    'CAUSE_AP_MISMATCH',
    // Dos operaciones homonimas son el punto ciego de `issueKey()`, que identifica los
    // issues por NOMBRE: si una gana el problema que la otra ya tenia, el diff no lo ve y
    // el gate deja pasar en silencio. Por eso BLOQUEA en vez de avisar — un gate que se
    // puede quedar ciego tiene que frenar antes de quedarse ciego. Medido el 18/08/2026:
    // 0 homonimas en los 17 AMFE, asi que hoy no bloquea nada.
    'OP_NOMBRE_DUPLICADO',
    // Severidad subcalibrada para fallas con efecto de incumplimiento legal
    // (ver rules/amfe-severity-legal-compliance.md). Pais de origen, aduana, etc.
    'CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED',
    // Candado anti-invento (agregado 2026-06-26 por plan wise-jumping-island).
    // Equipos que Barack no tiene (hielo seco, ultrasonido para medir) +
    // espanolismos peninsulares (flexometro, ordenador). known-bad => bloquea.
    // Ver rules/amfe-no-inventar-controles.md + scripts/_lib/forbiddenContent.mjs.
    // CLAUDE_PHRASE (frases-Claude + frecuencias inventadas) es WARNING, NO va aca.
    'FORBIDDEN_VOCABULARY',
]);

// Patrones que identifican failures con efecto de incumplimiento legal/aduanero.
// Ver rules/amfe-severity-legal-compliance.md. Match contra los 3 niveles de efecto.
const LEGAL_COMPLIANCE_PATTERNS = [
    /incumplimiento\s+legal/i,
    /retenci[oó]n\s+aduanera/i,
    /retenci[oó]n\s+en\s+aduana/i,
    /detenci[oó]n\s+en\s+aduana/i,
    /multa\s+aduanera/i,
    /sanci[oó]n\s+legal/i,
    /no\s+conformidad\s+legal/i,
    /violaci[oó]n\s+legal/i,
];

// Patrones que identifican OP/failure de corte (decision Fak 2026-05-17:
// corte mal = SCRAP, no retrabajo). Ver rules/amfe.md "Calibracion de efectos".
/**
 * CONTROL_CON_VALOR (WARNING) — rules/amfe.md §11.
 * Detecta una especificacion metida en el control del AMFE. Pide un numero CON UNIDAD DE
 * MEDIDA, o un simbolo de tolerancia, para no confundirse con la frecuencia de muestreo
 * ("3% del lote", "1 muestra por entrega") ni con codigos de norma o de procedimiento
 * (MI-IG-08-04, VW 50106, ASTM D5155, P-10/I, plan 1064), que SI deben estar.
 */
const CONTROL_VALUE_RE = new RegExp(
    '(?:±|\\+\\/-)\\s*\\d'                                             // 1,2 ± 0,05
    + '|\\d+(?:[.,]\\d+)?\\s*(?:mm|cm|m2|g\\/m2|gms?\\/mt2|gr|kg|cps|nm|°c|mm\\/min|cm\\/min)\\b',
    'i',
);

const CUTTING_OP_PATTERNS = [/CORTE/i, /TROQUELADO/i];
const CUTTING_FAILURE_PATTERNS = [/\bcort[aeoó]/i, /troquelad/i];
const REWORK_TERM_PATTERN = /retrabajo/i;

// Keywords que eximen a una CC de requerir S>=9 (flamabilidad/legal/seguridad).
// Porta A6 de modules/amfe/amfeValidation.ts:640. Ver rules/amfe.md.
const FLAMABILITY_LEGAL_KEYWORDS = ['flamabilidad', 'flamable', 'tl 1010', 'voc', 'emisiones', 'airbag', 'legal', 'seguridad'];

/**
 * Candado anti-invento: escanea un campo de texto del AMFE y empuja issues.
 * - forbidden (equipo inexistente / espanolismo) -> FORBIDDEN_VOCABULARY (CRITICAL)
 * - warnings (frase-Claude / frecuencia inventada) -> CLAUDE_PHRASE (WARNING)
 * Ver scripts/_lib/forbiddenContent.mjs + rules/amfe-no-inventar-controles.md.
 *
 * @param {Array} issues - acumulador de issues (se muta)
 * @param {object} ctx - contexto del nivel actual (amfe, opNum, weName, fmDesc, causeDesc...)
 * @param {string} fieldLabel - nombre del campo escaneado (para el detalle)
 * @param {string} value - texto a escanear
 */
function pushForbiddenIssues(issues, ctx, fieldLabel, value) {
    if (value == null || String(value).trim() === '') return;
    const { forbidden, warnings } = scanForbidden(value);
    for (const f of forbidden) {
        issues.push({
            ...ctx,
            type: 'FORBIDDEN_VOCABULARY',
            detail: `${fieldLabel} contiene "${f.term}" (${f.kind}) — Barack no lo usa. Usar TBD o termino Barack (ver rules/amfe-no-inventar-controles.md).`,
        });
    }
    for (const w of warnings) {
        issues.push({
            ...ctx,
            type: 'CLAUDE_PHRASE',
            detail: `${fieldLabel} contiene "${w.term}" (${w.kind}) — reescribir simple con vocabulario Barack (ver rules/amfe.md "Vocabulario Claude prohibido").`,
        });
    }
}

/**
 * Valida calidad textual de un documento AMFE segun heuristicas 6M.
 * Detecta WE.name/fn.description genericos, WE.name = WE.type traducido,
 * y operationFunction = focusElementFunction literal.
 *
 * Usa fuente unica scripts/_lib/genericLabels.mjs (sincronizada con
 * core/amfe/genericLabels.ts via JSON shared).
 *
 * @param {object} doc - AMFE doc parseado
 * @param {string} amfeNumber
 * @returns {Array<{type, detail, amfe, opNum?, opName?, weName?, weType?, fnDesc?}>}
 */
function validateTextQuality(doc, amfeNumber = '') {
    const out = [];
    if (!doc || !Array.isArray(doc.operations)) return out;

    for (const op of doc.operations) {
        const opNum = op.opNumber || op.operationNumber || '?';
        const opName = op.name || op.operationName || '';
        const ctx = { amfe: amfeNumber, opNum, opName, opId: op.id };

        // OP_FUNCTION_DUPLICATE_FOCUS: ambos no vacios y literalmente iguales (tras trim)
        const opFunc = (op.operationFunction || '').toString().trim();
        const focFunc = (op.focusElementFunction || '').toString().trim();
        if (opFunc && focFunc && opFunc === focFunc) {
            out.push({
                ...ctx,
                type: 'OP_FUNCTION_DUPLICATE_FOCUS',
                detail: `operationFunction === focusElementFunction (debe ser distinto VDA 2019): "${opFunc.slice(0, 80)}${opFunc.length > 80 ? '...' : ''}"`,
            });
        }

        for (const we of (op.workElements || [])) {
            const weName = we.name || '';
            const weType = we.type || '';
            const weCtx = { ...ctx, weName, weType };

            // WE_GENERIC_PLACEHOLDER: name es etiqueta 6M generica
            if (weName && isGeneric6MLabel(weName)) {
                out.push({
                    ...weCtx,
                    type: 'WE_GENERIC_PLACEHOLDER',
                    detail: `WE.name es etiqueta 6M generica (no especifica recurso): "${weName}"`,
                });
            }

            // WE_NAME_EQUALS_TYPE: name == type traducido (delegado a classifyWeNameVsType)
            const classify = classifyWeNameVsType(weName, weType);
            if (!classify.ok && weName && weType) {
                // Solo flag si todavia no se reporto como GENERIC (evita duplicado)
                if (!isGeneric6MLabel(weName)) {
                    out.push({
                        ...weCtx,
                        type: 'WE_NAME_EQUALS_TYPE',
                        detail: classify.issue,
                    });
                }
            }

            // FN_GENERIC_PLACEHOLDER: function.description matchea etiqueta 6M generica
            for (const fn of (we.functions || [])) {
                const fnDesc = fn.description || fn.functionDescription || '';
                if (fnDesc && isGeneric6MLabel(fnDesc)) {
                    out.push({
                        ...weCtx,
                        type: 'FN_GENERIC_PLACEHOLDER',
                        detail: `function.description es etiqueta 6M generica: "${fnDesc}"`,
                        fnDesc,
                    });
                }
            }
        }
    }

    return out;
}

/**
 * Valida un documento AMFE en memoria y retorna issues agrupados por severidad.
 *
 * @param {object} doc - Objeto AMFE parseado (data.operations[]...)
 * @param {string} [productName=''] - Nombre del producto/familia para reglas
 *                                    contextuales (ej: Telas Planas sin clips).
 * @param {string} [amfeNumber=''] - Numero AMFE para etiquetar issues.
 * @returns {{critical: Array, warning: Array, all: Array}}
 */
/**
 * PU_ANTES_DE_ENFUNDADO (CRITICAL) — rules/amfe.md §12.
 *
 * En los apoyacabezas el poliuretano se inyecta ADENTRO de la funda ya montada: se pone la
 * varilla, se enfunda, se carga al molde y recien ahi se espuma. Fak, 18/08/2026: *"es
 * imposible que se inyecte sin la funda, se saldria todo el material"*.
 *
 * Un AMFE que declare la inyeccion de PU ANTES del enfundado no esta desordenado: esta
 * describiendo un proceso que no existe, y su analisis de falla queda construido sobre esa
 * secuencia. Los AMFE 153 y 155 lo tuvieron invertido hasta el 18/08/2026, y la regla del
 * proyecto —escrita describiendo esos mismos documentos— repetia el error en vez de cazarlo.
 * Este check existe para que la proxima vez lo cace el codigo y no una charla.
 *
 * Solo mira AMFEs que tengan las DOS operaciones; los que no espuman no le importan.
 */
export function validateOrdenEnfundadoPu(doc, amfeNumber = '') {
    const out = [];
    const nombre = (op) => String(op?.name ?? op?.operationName ?? '');
    // Ojo `Number('')` devuelve 0, no NaN: una OP sin numero pasaria por "operacion 0" y
    // dispararia el check contra cualquier enfundado. Se exige que sean digitos.
    const numero = (op) => {
        const crudo = String(op?.opNumber ?? op?.operationNumber ?? '').trim();
        return /^\d+$/.test(crudo) ? Number(crudo) : NaN;
    };

    const funda = (doc.operations || []).find(o => /^\s*ENFUNDADO\s*$/i.test(nombre(o)));
    const pu = (doc.operations || []).find(o => /INYECCION\s+DE\s+PU\b/i.test(nombre(o)));
    if (!funda || !pu) return out;

    const nFunda = numero(funda);
    const nPu = numero(pu);
    if (!Number.isFinite(nFunda) || !Number.isFinite(nPu)) return out;

    if (nPu < nFunda) {
        out.push({
            amfe: amfeNumber,
            type: 'PU_ANTES_DE_ENFUNDADO',
            opNum: String(nPu),
            opName: nombre(pu),
            detail: `INYECCION DE PU en OP ${nPu} va antes de ENFUNDADO en OP ${nFunda}. `
                + 'El PU se inyecta dentro de la funda ya montada (amfe.md §12): sin la funda '
                + 'el material se sale del molde. Revisar el orden real del puesto antes de aplicar.',
        });
    }
    return out;
}

/**
 * DETECTION_HUMANA_OPTIMISTA — el predicado, aparte del check que lo usa.
 *
 * Vive suelto porque no lo consume solo el validador: el script que recalifica la columna D
 * tiene que elegir EXACTAMENTE las mismas causas, y una regex paralela escrita alla se
 * desincroniza en el primer retoque (es el modo de falla "un artefacto propio no es fuente").
 * Una sola definicion, dos consumidores.
 *
 * Devuelve true cuando el control de deteccion depende de una PERSONA (mirar, tocar, oir,
 * contar, revisar un papel), NO nombra instrumento, y la D esta por debajo del piso que la
 * Tabla P3 del AIAG-VDA admite para ese tipo de control (7 en estacion, 8 aguas abajo).
 */
export function esDeteccionHumanaOptimista(detectionControl, detection) {
    const dNum = Number(detection);
    if (!Number.isFinite(dNum) || dNum < 1 || dNum > 6) return false;
    const det = String(detectionControl ?? '').toLowerCase();
    const esHumano = /\b(visual|inspecc|mira|observ|tactil|audi|conteo|cont(ar|eo)|verificacion documental|revision del certificado|pieza patron|contra la pieza|a la vista)\b/.test(det);
    const tieneInstrumento = /\b(calibre|comparador|galga|pasa\/no pasa|go\/no.?go|torquim|balanza|micromet|sensor|camara|celda de carga|interlock|poka.?yoke|dinamomet|espesim)\b/.test(det);
    return esHumano && !tieneInstrumento;
}

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

    // Calidad textual 6M (WE/fn genericos, WE.name == type, opFunc == focusFunc)
    // Fuente unica: scripts/_lib/genericLabels.mjs
    issues.push(...validateTextQuality(doc, amfeNumber));

    // El PU se inyecta DENTRO de la funda ya montada (rules/amfe.md §12).
    issues.push(...validateOrdenEnfundadoPu(doc, amfeNumber));

    // Dos operaciones con el mismo nombre: ambiguas para el flujograma y para el diff.
    issues.push(...validateNombresDeOperacion(doc, amfeNumber));

    const productUp = String(productName).toUpperCase();

    for (const op of doc.operations) {
        const opNum = op.opNumber || op.operationNumber || '?';
        const opName = op.name || op.operationName || '';
        const opNameUp = opName.toUpperCase();
        const ctx = { amfe: amfeNumber, product: productName, opNum, opName, opId: op.id };

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

            // Candado anti-invento en las funciones de la OP
            pushForbiddenIssues(issues, ctx, 'operationFunction', op.operationFunction);
            pushForbiddenIssues(issues, ctx, 'focusElementFunction', op.focusElementFunction);
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

            // Candado anti-invento en el nombre del recurso (WE.name)
            pushForbiddenIssues(issues, weCtx, 'WE.name', weName);

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

                // Candado anti-invento en la descripcion de funcion
                pushForbiddenIssues(issues, fnCtx, 'function.description', fnDesc);

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

                    // Candado anti-invento en el modo de falla y sus 3 efectos.
                    // Agregado 23/08/2026: hasta hoy el candado solo miraba controles, acciones,
                    // WE.name y function.description. El texto que Fak marco ("enrase") vivia en
                    // cause.cause y "Gap & Flush" en effectEndUser — dos campos que nadie escaneaba,
                    // asi que FORBIDDEN_VOCABULARY daba 0 con las palabras a la vista en el PDF.
                    pushForbiddenIssues(issues, fmCtx, 'failure.description', fm.description);
                    pushForbiddenIssues(issues, fmCtx, 'effectLocal', fm.effectLocal);
                    pushForbiddenIssues(issues, fmCtx, 'effectNextLevel', fm.effectNextLevel);
                    pushForbiddenIssues(issues, fmCtx, 'effectEndUser', fm.effectEndUser);

                    const causes = fm.causes || [];
                    if (causes.length === 0) {
                        issues.push({ ...fmCtx, type: 'FM_NO_CAUSES', detail: 'Failure sin causas' });
                        continue;
                    }

                    // CUTTING_EFFECT_REWORK_SUSPECT (WARNING)
                    // rules/amfe.md "Calibracion de efectos: corte = SCRAP".
                    // Si la OP o failure es de corte y algun effect menciona "retrabajo" -> sospechoso.
                    const opIsCutting = CUTTING_OP_PATTERNS.some(re => re.test(opName));
                    const failureIsCutting = CUTTING_FAILURE_PATTERNS.some(re => re.test(fmDesc));
                    if (opIsCutting || failureIsCutting) {
                        const effectsTextsCut = [fm.effectLocal, fm.effectNextLevel, fm.effectEndUser]
                            .map(s => String(s || ''));
                        const reworkLevels = [];
                        if (REWORK_TERM_PATTERN.test(effectsTextsCut[0])) reworkLevels.push('effectLocal');
                        if (REWORK_TERM_PATTERN.test(effectsTextsCut[1])) reworkLevels.push('effectNextLevel');
                        if (REWORK_TERM_PATTERN.test(effectsTextsCut[2])) reworkLevels.push('effectEndUser');
                        if (reworkLevels.length > 0) {
                            issues.push({ ...fmCtx, type: 'CUTTING_EFFECT_REWORK_SUSPECT',
                                detail: `Falla de corte con "retrabajo" en ${reworkLevels.join(',')} (Barack: corte=SCRAP, ver rules/amfe.md)` });
                        }
                    }

                    // FM_ENDUSER_EFECTO_PLANTA (WARNING)
                    // Auditoria de cliente 22/08/2026 (AMFE 159, OP15): "Reproceso o scrap"
                    // cargado como efecto USUARIO FINAL. AIAG-VDA 3.4.5 (pp. 86-87): reproceso
                    // y scrap son efectos de planta (in-plant / ship-to-plant); el nivel End
                    // User es lo que experimenta el usuario del vehiculo. WARNING y no
                    // CRITICAL: el efecto real lo define el equipo (es dato), esto solo avisa.
                    const endUserTxt = String(fm.effectEndUser || '');
                    if (/\b(reproceso|retrabajo|scrap|descarte)\b/i.test(endUserTxt)) {
                        issues.push({ ...fmCtx, type: 'FM_ENDUSER_EFECTO_PLANTA',
                            detail: `effectEndUser="${endUserTxt.slice(0, 60)}" es efecto de PLANTA, no del usuario final (AIAG-VDA 3.4.5)` });
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

                    // La S es del MODO DE FALLA: es la del efecto y la comparten todas sus
                    // causas (AIAG-VDA). Es la que edita la UI (AmfeTableBody, celda con
                    // rowSpan sobre las filas de causa), la que imprime el export y la que
                    // AmfeCause NO tiene como campo. Todo lo que evalue riesgo abajo usa
                    // esta, no `c.severity`.
                    const sevFm = !isFmEmpty(fm.severity) ? Number(fm.severity) : null;

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

                        // C-SOD — la S sale del modo de falla; solo si ahi falta se mira la
                        // que la causa pueda traer suelta.
                        const sevEf = sevFm ?? (Number(c.severity) || null);
                        const missS = !sevEf;
                        const missO = c.occurrence == null || c.occurrence === '' || c.occurrence === 0;
                        const missD = c.detection == null || c.detection === '' || c.detection === 0;
                        if (missS || missO || missD) {
                            issues.push({ ...cCtx, type: 'CAUSE_MISSING_SOD',
                                detail: `S=${fm.severity} O=${c.occurrence} D=${c.detection}` });
                        }

                        // CAUSE_SEVERITY_PROPIA (WARNING) — la causa trae una S propia distinta
                        // de la de su modo de falla. Nadie la escribe desde la app (la UI edita
                        // una sola S por modo de falla) y AmfeCause no tiene el campo: es resto
                        // de importacion. Avisa porque es una trampa — el 21/08/2026 un script
                        // recalculo el AP leyendo esa S fantasma y bajo 9 filas de M a L en el
                        // AMFE 162, subdeclarando riesgo en un PDF que estaba por salir.
                        if (sevFm && c.severity != null && c.severity !== '' && Number(c.severity) !== sevFm) {
                            issues.push({ ...cCtx, type: 'CAUSE_SEVERITY_PROPIA',
                                detail: `cause.severity=${c.severity} distinta de la del modo de falla (${sevFm}); manda la del modo de falla` });
                        }

                        // AP: calculable con S/O/D completos → debe existir ap o actionPriority
                        if (!missS && !missO && !missD && !c.actionPriority && !c.ap) {
                            issues.push({ ...cCtx, type: 'CAUSE_NO_AP', detail: 'S/O/D completos pero sin AP' });
                        }

                        // CAUSE_AP_MISMATCH (CRITICAL) — el AP declarado no sale de la tabla oficial.
                        // amfe.md §4: AP se calcula SOLO con calculateAP (AIAG-VDA 2019), la formula
                        // S*O*D esta prohibida. Un AP que no coincide subdeclara o sobredeclara el
                        // riesgo, y es lo primero que recalcula un auditor. Lo destapo la auditoria
                        // externa del 21/08/2026: 54 causas de los 8 AMFE de Patagonia lo tenian mal,
                        // y 27 de ellas eran identicas entre tres documentos (delataban copy-paste).
                        if (!missS && !missO && !missD) {
                            const apDeclarado = String(c.ap || c.actionPriority || '').trim().toUpperCase();
                            if (apDeclarado) {
                                const apEsperado = calculateAP(sevEf, Number(c.occurrence), Number(c.detection));
                                if (apEsperado && apDeclarado !== apEsperado) {
                                    issues.push({ ...cCtx, type: 'CAUSE_AP_MISMATCH',
                                        detail: `AP declarado '${apDeclarado}' pero la tabla AIAG-VDA da '${apEsperado}' (S=${sevEf} O=${c.occurrence} D=${c.detection})` });
                                }
                            }
                        }

                        // CAUSE_SOD_IMPLAUSIBLE (WARNING) — la Figura 3.5-3 del AIAG-VDA no da
                        // prioridad a estas dos combinaciones, las marca "Error": O=1 sin D=1
                        // ("O=1 implausible without D=1") y D=1 sin O=1. Un O=1 dice que la
                        // prevencion practicamente elimino la falla, y entonces la deteccion no
                        // puede seguir siendo dificil. No se corrige solo: los valores son dato
                        // tecnico y los define el equipo. Lo encontro la auditoria de cliente del
                        // 22/08/2026 (6 causas en los 8 AMFE de Patagonia).
                        if (!missS && !missO && !missD && apImplausible(sevEf, Number(c.occurrence), Number(c.detection))) {
                            issues.push({ ...cCtx, type: 'CAUSE_SOD_IMPLAUSIBLE',
                                detail: `S=${sevEf} O=${c.occurrence} D=${c.detection}: la Figura 3.5-3 marca esta combinacion como Error (O=1 exige D=1 y viceversa), no le asigna AP` });
                        }

                        // DETECTION_HUMANA_OPTIMISTA (WARNING) — Tabla P3 del AIAG-VDA.
                        // Un control que depende de una PERSONA mirando, tocando, escuchando,
                        // contando o revisando un papel es D=7 (en estacion) u 8 (aguas abajo):
                        // "the method relies on a human". Para bajar de 7 hace falta INSTRUMENTO;
                        // de 6, R&R confirmado; de 4, ademas verificacion de poka-yoke.
                        // Lo destapo /auditoria-cliente sobre el AMFE 172 el 24/08/2026: 47 causas
                        // con controles visuales calificadas D=3-6. Al corregirlas el AP paso de
                        // L=9/M=22/H=15 a M=12/H=35 — el riesgo estaba subdeclarado a la mitad.
                        // La tabla de amfe.md §13 decia lo mismo que el AMFE (visual en 4-5), asi
                        // que se corrigio la REGLA contra el manual y nacio este check.
                        // Avisa, no corrige: la calificacion es dato tecnico del equipo.
                        if (!missD && esDeteccionHumanaOptimista(c.detectionControl, c.detection)) {
                            issues.push({ ...cCtx, type: 'DETECTION_HUMANA_OPTIMISTA',
                                detail: `D=${Number(c.detection)} para un control que depende de una persona ("${String(c.detectionControl).slice(0, 60)}"). Tabla P3: visual/tactil/audible/conteo va D=7 en estacion u 8 aguas abajo` });
                        }

                        // CAUSE_S9_SIN_CC (WARNING) — S>=9 sin caracteristica especial declarada.
                        // NO asigna nada: las CC/SC las pone Fak (core-prohibiciones §2). Avisa,
                        // porque el patron real que encontro la auditoria del 21/08/2026 es que la CC
                        // se CAE al detallar: la fila generica vieja ("Material: Tela termoformable")
                        // conservo su CC y las filas nuevas por material —vinilo, tela, hilo, cada una
                        // con su codigo— quedaron sin ninguna. 63 filas asi en 7 de los 8 documentos.
                        if (!missS && sevEf >= 9 && !String(c.specialChar ?? '').trim()) {
                            issues.push({ ...cCtx, type: 'CAUSE_S9_SIN_CC',
                                detail: `S=${sevEf} sin caracteristica especial declarada (la asigna Fak; ojo si una fila hermana SI tiene CC)` });
                        }

                        if (!c.preventionControl || String(c.preventionControl).trim() === '') {
                            issues.push({ ...cCtx, type: 'CAUSE_NO_PREV_CTRL', detail: 'Sin preventionControl' });
                        }
                        if (!c.detectionControl || String(c.detectionControl).trim() === '') {
                            issues.push({ ...cCtx, type: 'CAUSE_NO_DET_CTRL', detail: 'Sin detectionControl' });
                        }

                        // CONTROL_CON_VALOR (WARNING) — rules/amfe.md §11.
                        // En el control va metodo + instrumento + frecuencia + de que documento
                        // sale el criterio, NUNCA el valor: el formulario oficial de AMFE no tiene
                        // columna de especificacion, el Plan de Control si. Decidido 16/08/2026
                        // contra el manual AMFE y el instructivo I-AC-005.
                        // La frecuencia de muestreo SI va, por eso "3% del lote" o "1 muestra por
                        // entrega" no matchean: el patron pide una UNIDAD DE MEDIDA al lado.
                        for (const campo of ['preventionControl', 'detectionControl']) {
                            const txt = String(c[campo] ?? '');
                            const m = txt.match(CONTROL_VALUE_RE);
                            if (m) {
                                issues.push({
                                    ...cCtx, type: 'CONTROL_CON_VALOR',
                                    detail: `${campo} lleva el valor "${m[0].trim()}" — va al Plan de Control, aca se cita el documento`,
                                });
                            }
                        }

                        // Candado anti-invento en el TEXTO DE LA CAUSA (23/08/2026).
                        // `cause` y `description` son alias del mismo texto (syncFieldAliases),
                        // por eso se escanean los dos: si uno se edita a mano y el otro no,
                        // el export puede leer el que quedo sucio.
                        pushForbiddenIssues(issues, cCtx, 'cause.cause', c.cause);
                        pushForbiddenIssues(issues, cCtx, 'cause.description', c.description);

                        // Candado anti-invento en controles y acciones de la causa
                        pushForbiddenIssues(issues, cCtx, 'preventionControl', c.preventionControl);
                        pushForbiddenIssues(issues, cCtx, 'detectionControl', c.detectionControl);
                        pushForbiddenIssues(issues, cCtx, 'controlMethod', c.controlMethod);
                        pushForbiddenIssues(issues, cCtx, 'optimizationAction', c.optimizationAction);
                        pushForbiddenIssues(issues, cCtx, 'preventionAction', c.preventionAction);
                        pushForbiddenIssues(issues, cCtx, 'detectionAction', c.detectionAction);

                        // C-CAPACITACION (prohibido como causa)
                        const causeUp = causeDesc.toUpperCase();
                        if (causeUp.includes('FALTA DE CAPACITACION') ||
                            causeUp.includes('FALTA DE ENTRENAMIENTO') ||
                            causeUp.includes('OPERARIO NO CAPACITADO')) {
                            issues.push({ ...cCtx, type: 'CAUSE_CAPACITACION',
                                detail: '"Falta de capacitacion" prohibido como causa (ver rules/amfe.md)' });
                        }

                        // CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED
                        // (rules/amfe-severity-legal-compliance.md)
                        // Si el failure tiene efecto de incumplimiento legal/aduanero,
                        // todas las causas deben tener S>=7. Pais de origen incorrecto,
                        // retencion aduanera, multas, etc.
                        const effectsTexts = [fm.effectLocal, fm.effectNextLevel, fm.effectEndUser]
                            .map(s => String(s || ''));
                        const isLegalCompliance = effectsTexts.some(t =>
                            LEGAL_COMPLIANCE_PATTERNS.some(re => re.test(t)));
                        if (isLegalCompliance) {
                            const sevNum = Number(sevEf);
                            if (Number.isFinite(sevNum) && sevNum > 0 && sevNum < 7) {
                                issues.push({ ...cCtx, type: 'CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED',
                                    detail: `failure con efecto de incumplimiento legal pero S=${sevNum} (debe ser >=7, ver rules/amfe-severity-legal-compliance.md)` });
                            }
                        }

                        // CC/SC sanity (WARNING) — porta A6/A7 de modules/amfe/amfeValidation.ts:643-689.
                        // SOLO FLAGEA calibracion sospechosa. NUNCA asigna CC/SC (decision de Fak).
                        const specialCh = String(c.specialChar || '').trim().toUpperCase();
                        if (specialCh === 'CC' || specialCh === 'SC') {
                            const sevForCcSc = Number(sevEf) || 0;
                            if (specialCh === 'CC' && sevForCcSc > 0 && sevForCcSc < 9) {
                                const haystack = [fmDesc, ...effectsTexts, causeDesc].join(' ').toLowerCase();
                                const exempt = FLAMABILITY_LEGAL_KEYWORDS.some(kw => haystack.includes(kw));
                                if (!exempt) {
                                    issues.push({ ...cCtx, type: 'CAUSE_CC_LOW_SEVERITY',
                                        detail: `causa marcada CC pero S=${sevForCcSc} (CC requiere S>=9 salvo flamabilidad/legal, ver rules/amfe.md)` });
                                }
                            }
                            if (specialCh === 'SC' && sevForCcSc > 0 && sevForCcSc < 7) {
                                issues.push({ ...cCtx, type: 'CAUSE_SC_LOW_SEVERITY',
                                    detail: `causa marcada SC con S=${sevForCcSc} (SC tipicamente S=7-8; sospechoso de formula vieja)` });
                            }
                        }

                        // CAUSE_APH_EMPTY_NO_PLACEHOLDER (rules/amfe-aph-pending.md)
                        // AP=H requiere accion. Si los 3 campos (optimization/prevention/detection)
                        // estan vacios Y ninguno contiene el placeholder autorizado, es bloqueo IATF.
                        const apVal = String(c.ap || c.actionPriority || '').trim().toUpperCase();
                        if (apVal === 'H') {
                            const optAct = String(c.optimizationAction || '').trim();
                            const prevAct = String(c.preventionAction || '').trim();
                            const detAct = String(c.detectionAction || '').trim();
                            const placeholderRe = /pendiente\s+definici[oó]n\s+equipo\s+apqp/i;
                            const hasContent = optAct || prevAct || detAct;
                            const hasPlaceholder =
                                placeholderRe.test(optAct) ||
                                placeholderRe.test(prevAct) ||
                                placeholderRe.test(detAct);
                            if (!hasContent || (!hasPlaceholder && !optAct && !prevAct && !detAct)) {
                                issues.push({ ...cCtx, type: 'CAUSE_APH_EMPTY_NO_PLACEHOLDER',
                                    detail: 'AP=H sin accion ni placeholder "Pendiente definicion equipo APQP" — bloqueante IATF' });
                            }
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

/**
 * Identidad de un issue para el diff before/after.
 *
 * ⚠️ Se identifica la operacion por NOMBRE, no por numero. El numero de operacion es
 * justamente lo que cambia en una renumeracion, y usarlo como clave hacia que un problema
 * PREEXISTENTE reapareciera como "nuevo" apenas la operacion se movia de lugar — con lo
 * cual el gate bloqueaba toda renumeracion legitima y se volvia imposible de satisfacer.
 *
 * Paso el 18/08/2026 alineando los apoyacabezas con su flujograma: 14 criticos "nuevos" que
 * eran las MISMAS operaciones vacias de antes, corridas de numero. Se confirmo contando el
 * total de criticos del documento (7/5/5 antes, 7/5/5 despues), que no se movio.
 *
 * Esto no afloja el gate: lo hace medir lo que dice medir. Si el nombre cambia, sigue
 * contando como issue nuevo — ahi si es otra operacion.
 */
function issueKey(i) {
    // El `id` de la operacion es lo unico estable: sobrevive tanto a la renumeracion (que
    // cambia el numero) como al renombre (que cambia el nombre). Agregado el 24/08/2026, al
    // alinear la OP40 de los apoyacabezas con el nombre que le da el Plan de Control: cambiar
    // "ENFUNDADO" por "ENSAMBLE ASTA + ENFUNDADO" hizo que los dos EMPTY_OP PREEXISTENTES de
    // los traseros aparecieran como criticos NUEVOS y el gate bloqueara el apply. Es el caso
    // espejo del 18/08, que fue el que puso el nombre como clave.
    // Fallback al nombre y despues al numero para los documentos viejos sin `id`.
    const operacion = String(i.opId || '').trim()
        || String(i.opName || '').trim().toUpperCase()
        || `#${i.opNum}`;
    return [i.type, operacion, i.weName, i.fmDesc, i.causeDesc].join('|');
}

/**
 * OP_NOMBRE_DUPLICADO (WARNING).
 *
 * Dos operaciones con el MISMO nombre en un AMFE son el unico caso donde `issueKey()`
 * —que identifica por nombre— podria tapar un issue nuevo: si una gana el problema que la
 * otra ya tenia, el diff no lo distingue. Medido el 18/08/2026 sobre los 17 AMFE: cero
 * homonimas, asi que hoy el diff es seguro. Este check existe para enterarnos el dia que
 * eso cambie, en vez de descubrirlo cuando un gate deje pasar algo.
 *
 * Ademas, dos operaciones homonimas son un defecto por si solas: el flujograma y el Plan
 * de Control no pueden referenciarlas sin ambiguedad.
 */
export function validateNombresDeOperacion(doc, amfeNumber = '') {
    const out = [];
    const vistos = new Map();
    for (const op of doc.operations || []) {
        const nombre = String(op.name ?? op.operationName ?? '').trim().toUpperCase();
        if (!nombre) continue;
        const opNum = String(op.opNumber ?? op.operationNumber ?? '?');
        if (vistos.has(nombre)) {
            out.push({
                amfe: amfeNumber, type: 'OP_NOMBRE_DUPLICADO', opNum, opName: nombre,
                detail: `La OP ${opNum} y la OP ${vistos.get(nombre)} se llaman igual. `
                    + 'Ninguna se puede referenciar sin ambiguedad desde el flujograma o el Plan de '
                    + 'Control, y el diff de este validador identifica los issues por nombre.',
            });
        } else {
            vistos.set(nombre, opNum);
        }
    }
    return out;
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

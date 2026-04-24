/**
 * reclassifyAplixSc44.mjs
 *
 * Reclasifica causas relacionadas con APLIX en AMFEs Telas Planas (TPL) y
 * Telas Termoformadas (TTF) PWA como SC44 del listado I-PY-001.7
 * ("Integridad fijacion magnetica material 2").
 *
 * CONTEXTO CRITICO (confirmado por Fak 2026-04-24):
 *   Fak aclaro que "el aplix en pwa si tiene ambas cosas osea tela y carga
 *   ferrosa". O sea APLIX en Hilux PWA tiene componente magnetico (carga
 *   ferrosa metalica) ademas del velcro hook-and-loop. Por lo tanto SC44
 *   SI aplica — anula la conclusion previa del audit (aplix-sc44.md) que
 *   recomendaba N/A.
 *
 * Estrategia:
 *   - Barrer TODAS las causas de cada AMFE.
 *   - Matchear por keyword "aplix" (case-insensitive, normalizado) en:
 *       cause.cause, cause.description,
 *       failure.description,
 *       function.description/functionDescription,
 *       workElement.name,
 *       cause.preventionControl, cause.detectionControl.
 *   - Fallback TPL OP 70: si opNumber === '70' en TPL y el failure habla de
 *     fijacion/adhesion/pegado, incluir como candidato (postLoadFixes.mjs
 *     renombra DOTS->APLIX en failures, pero puede dejar algun campo sin
 *     tocar — este fallback cubre ese gap).
 *   - Skip causas de reproceso (OP 101 TPL, OP 102 TTF).
 *   - Skip causas que ya tienen specialChar "SC" o "CC" (no pisar).
 *   - Skip causas genericas donde APLIX es solo el sustrato y no el
 *     elemento critico de integridad (se flagean en skipReason).
 *
 * Al matchear:
 *   - Set specialChar = "SC".
 *   - Append "(ref SC44 integridad fijacion magnetica I-PY-001.7)" al
 *     detectionControl (preferido) o preventionControl si el control ya
 *     habla de deteccion/preventivo.
 *   - Mark cause._autoFilled = true, cause._reclassSource = "I-PY-001.7 SC44".
 *
 * Respeta reglas:
 *   - scripts/_lib/amfeIo.mjs (connectSupabase, readAmfe, saveAmfe, normalizeText)
 *   - scripts/_lib/dryRunGuard.mjs (parseSafeArgs, runWithValidation, finish, logChange)
 *   - .claude/rules/amfe.md (no pisa CC/SC existente)
 *   - .claude/rules/amfe-actions.md (no inventa acciones de optimizacion)
 *   - .claude/rules/autonomy-contract.md (cambio SC autorizado explicitamente por Fak)
 *   - .claude/rules/database.md (saveAmfe centraliza JSON.stringify, no hay double-serializacion)
 *
 * Scope: SOLO TPL y TTF PWA. NO toca otros AMFEs. NO renombra OPs (eso
 * lo maneja postLoadFixes.mjs que corre antes).
 *
 * Uso:
 *   node scripts/reclassifyAplixSc44.mjs              # dry-run (default)
 *   node scripts/reclassifyAplixSc44.mjs --apply      # aplicar cambios
 */

import {
    connectSupabase,
    readAmfe,
    saveAmfe,
    normalizeText,
} from './_lib/amfeIo.mjs';
import {
    parseSafeArgs,
    runWithValidation,
    finish,
    logChange,
} from './_lib/dryRunGuard.mjs';

// ─── Targets ────────────────────────────────────────────────────────────────

const TARGETS = [
    {
        id: '57011560-d4c1-4a8a-83f0-ed37a2bab1d5',
        key: 'TPL',
        name: 'Telas Planas PWA',
        reprocessOpNumbers: ['101'],
        fallbackOpNumbers: ['70'], // post-rename DOTS->APLIX por postLoadFixes.mjs
    },
    {
        id: 'c5201ba9-1225-4663-b7a1-5430f9ee8912',
        key: 'TTF',
        name: 'Telas Termoformadas PWA',
        reprocessOpNumbers: ['102'],
        fallbackOpNumbers: [], // TTF OP 70/90 ya matchean "APLIX" directo en WE/failures
    },
];

const SC44_REF = '(ref SC44 integridad fijacion magnetica I-PY-001.7)';
const APLIX_KEYWORD = 'aplix';

// Fallback: keywords de fijacion/adhesion/pegado para TPL OP 70 si postLoadFixes
// no toco ciertos campos. Esto es match amplio: si la failure habla de fijacion
// en OP 70 TPL, la causa es candidata.
const FIJACION_KEYWORDS = ['fijacion', 'adhesion', 'pegado', 'adheri', 'despega'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function norm(s) {
    return normalizeText(s);
}

function containsAplix(text) {
    const n = norm(text);
    return n.includes(APLIX_KEYWORD);
}

function containsAnyKeyword(text, keywords) {
    const n = norm(text);
    return keywords.some(k => n.includes(k));
}

/**
 * Determina si una causa menciona APLIX como ELEMENTO CRITICO del control
 * de integridad (densidad de ganchos, orientacion, adhesion, carga ferrosa,
 * integridad de fijacion), o si lo menciona solo como sustrato generico.
 *
 * Returns 'critical' | 'generic' | 'none'
 */
function classifyAplixMention(causeCtx) {
    const {
        causeText, failureText, functionText, weName, preventionControl, detectionControl,
    } = causeCtx;

    const allText = [causeText, failureText, functionText, weName, preventionControl, detectionControl]
        .map(norm).join(' | ');

    // Checks de "critico" — APLIX es el elemento bajo control.
    const criticalIndicators = [
        'aplix',        // aparece mencionado de algun modo
    ];
    const hasAplix = criticalIndicators.some(k => allText.includes(k));
    if (!hasAplix) return 'none';

    // Indicadores de control real sobre APLIX: elemento critico.
    const criticalControlWords = [
        'densidad', 'ganchos', 'hook', 'loop',
        'orientacion', 'orientac', 'invertida', 'reves',
        'adhesion', 'adhesivo', 'adheri', 'despega', 'despeg',
        'troquel', 'corte', 'cuchilla', 'matriz',
        'integridad', 'fijacion', 'fijac',
        'dimension', 'dimens', 'espesor', 'espec', 'especificacion',
        'posicion', 'posic', 'ubicacion', 'ubicac',
        'cantidad', 'conteo', 'unidades',
        'agarre', 'fijar',
        'ferros', 'magnet',
        'aplix metal resin',  // nombre propio del material
        'cinta de fijacion',
    ];
    const hasCriticalControl = criticalControlWords.some(k => allText.includes(k));

    // Indicadores de mencion generica (contaminacion generica, manejo, etc).
    const genericIndicators = [
        'contaminacion', 'contamin',
        'suciedad', 'sucio',
        'humedad generica',
    ];
    const looksGeneric = genericIndicators.some(k => allText.includes(k));

    if (hasCriticalControl) return 'critical';
    if (looksGeneric) return 'generic';
    // Si solo aparece APLIX pero sin ningun indicator de control critico, tratamos
    // como critico por default (es una causa sobre APLIX en un WE de APLIX).
    // Es mas seguro reclasificar que skipear aca — la excepcion del prompt es
    // cuando la mencion es "generica de sustrato", que se captura arriba.
    return 'critical';
}

/**
 * Decide donde appendear la referencia SC44.
 * Preferencia: detectionControl > preventionControl.
 * Si ambos estan vacios, crear detectionControl.
 */
function appendSc44Reference(cause) {
    const ref = SC44_REF;
    const preventionControl = String(cause.preventionControl || '').trim();
    const detectionControl = String(cause.detectionControl || '').trim();

    // Si ya contiene la ref, no duplicar.
    if (norm(preventionControl).includes('sc44') || norm(detectionControl).includes('sc44')) {
        return { field: null, before: null, after: null };
    }

    // Preferencia: detectionControl si tiene contenido, sino preventionControl,
    // sino crear detectionControl.
    if (detectionControl) {
        const newVal = `${detectionControl} ${ref}`;
        cause.detectionControl = newVal;
        return { field: 'detectionControl', before: detectionControl, after: newVal };
    }
    if (preventionControl) {
        const newVal = `${preventionControl} ${ref}`;
        cause.preventionControl = newVal;
        return { field: 'preventionControl', before: preventionControl, after: newVal };
    }
    // Ambos vacios: crear detectionControl con solo la ref.
    cause.detectionControl = ref;
    return { field: 'detectionControl', before: '', after: ref };
}

// ─── Core: escanear y reclasificar ──────────────────────────────────────────

/**
 * Procesa un AMFE. Muta el doc in-place.
 * Retorna resumen con contadores y lista de operaciones realizadas.
 */
function processAmfe(doc, tgt) {
    const result = {
        target: tgt.key,
        scanned: 0,        // total causas visitadas
        aplixMatches: 0,   // total causas que mencionan APLIX (o fallback)
        reclassified: 0,   // total reclasificadas a SC44
        skippedReprocess: 0,
        skippedAlreadyClassified: 0,
        skippedGeneric: 0,
        skippedNoMention: 0,
        actions: [],       // detalle por cada reclasificacion
    };

    for (const op of doc.operations || []) {
        const opNumber = String(op.opNumber || op.operationNumber || '').trim();
        const opName = op.name || op.operationName || '';
        const isReprocess = tgt.reprocessOpNumbers.includes(opNumber);
        const isFallbackOp = tgt.fallbackOpNumbers.includes(opNumber);

        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    for (const cause of fm.causes || []) {
                        result.scanned++;

                        const causeCtx = {
                            causeText: cause.cause || cause.description || '',
                            failureText: fm.description || '',
                            functionText: fn.description || fn.functionDescription || '',
                            weName: we.name || '',
                            preventionControl: cause.preventionControl || '',
                            detectionControl: cause.detectionControl || '',
                        };

                        // Check 1: mencion directa de APLIX en cualquier campo
                        const mentionedDirectly =
                            containsAplix(causeCtx.causeText) ||
                            containsAplix(causeCtx.failureText) ||
                            containsAplix(causeCtx.functionText) ||
                            containsAplix(causeCtx.weName) ||
                            containsAplix(causeCtx.preventionControl) ||
                            containsAplix(causeCtx.detectionControl);

                        // Check 2: fallback para TPL OP 70 — si el failure habla de
                        // fijacion/adhesion/pegado, es candidato aunque no mencione
                        // "APLIX" textual.
                        const fallbackMatch =
                            isFallbackOp &&
                            !mentionedDirectly &&
                            containsAnyKeyword(causeCtx.failureText, FIJACION_KEYWORDS);

                        if (!mentionedDirectly && !fallbackMatch) {
                            result.skippedNoMention++;
                            continue;
                        }

                        result.aplixMatches++;

                        // Skip reproceso
                        if (isReprocess) {
                            result.skippedReprocess++;
                            result.actions.push({
                                type: 'skip_reprocess',
                                opNumber,
                                opName,
                                weName: causeCtx.weName,
                                failure: causeCtx.failureText.slice(0, 60),
                                cause: causeCtx.causeText.slice(0, 60),
                                reason: `reproceso OP ${opNumber} — no aplica integridad fijacion`,
                                via: mentionedDirectly ? 'direct' : 'fallback',
                            });
                            continue;
                        }

                        // Skip si ya tiene SC o CC (no pisar clasificacion existente)
                        const current = String(cause.specialChar || '').toUpperCase().trim();
                        if (current === 'SC' || current === 'CC') {
                            result.skippedAlreadyClassified++;
                            result.actions.push({
                                type: 'skip_classified',
                                opNumber,
                                opName,
                                weName: causeCtx.weName,
                                failure: causeCtx.failureText.slice(0, 60),
                                cause: causeCtx.causeText.slice(0, 60),
                                currentSpecial: current,
                                reason: `ya clasificada como ${current} (no se pisa)`,
                                via: mentionedDirectly ? 'direct' : 'fallback',
                            });
                            continue;
                        }

                        // Skip si la mencion es "generica de sustrato" (prefer FLAG than aggressive OK)
                        const mentionClass = classifyAplixMention(causeCtx);
                        if (mentionClass === 'generic') {
                            result.skippedGeneric++;
                            result.actions.push({
                                type: 'skip_generic',
                                opNumber,
                                opName,
                                weName: causeCtx.weName,
                                failure: causeCtx.failureText.slice(0, 60),
                                cause: causeCtx.causeText.slice(0, 60),
                                reason: 'APLIX mencionado pero causa es generica (no integridad)',
                                via: mentionedDirectly ? 'direct' : 'fallback',
                            });
                            continue;
                        }

                        // Reclasificar: set SC + append ref SC44
                        const prevSpecial = current;
                        cause.specialChar = 'SC';
                        const appendInfo = appendSc44Reference(cause);
                        cause._autoFilled = true;
                        cause._reclassSource = cause._reclassSource
                            ? `${cause._reclassSource}; I-PY-001.7 SC44`
                            : 'I-PY-001.7 SC44';

                        result.reclassified++;
                        result.actions.push({
                            type: 'reclassify',
                            opNumber,
                            opName,
                            weName: causeCtx.weName,
                            failure: causeCtx.failureText.slice(0, 80),
                            cause: causeCtx.causeText.slice(0, 80),
                            specialBefore: prevSpecial || '""',
                            specialAfter: 'SC',
                            fieldModified: appendInfo.field,
                            textBefore: appendInfo.before,
                            textAfter: appendInfo.after,
                            via: mentionedDirectly ? 'direct' : 'fallback',
                        });
                    }
                }
            }
        }
    }

    return result;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    const { apply } = parseSafeArgs();
    const sb = await connectSupabase();

    console.log('\n=== Reclasificacion APLIX -> SC44 (I-PY-001.7) ===');
    console.log(`Targets: ${TARGETS.map(t => t.key).join(', ')}`);
    console.log(`Keyword: "${APLIX_KEYWORD}" (case-insensitive, normalizado)`);
    console.log(`Fallback TPL OP 70: keywords ${FIJACION_KEYWORDS.join(', ')}`);
    console.log('Ref text:', SC44_REF);
    console.log('');

    const plan = [];
    const allResults = [];

    for (const tgt of TARGETS) {
        console.log(`─── ${tgt.key} (${tgt.name}) — ${tgt.id}`);
        const { doc: before, amfe_number } = await readAmfe(sb, tgt.id);
        const after = structuredClone(before);

        const result = processAmfe(after, tgt);
        allResults.push(result);

        // Log detallado por target
        console.log(`  Causas escaneadas: ${result.scanned}`);
        console.log(`  Causas que mencionan APLIX (o fallback): ${result.aplixMatches}`);
        console.log(`    Reclasificadas a SC44: ${result.reclassified}`);
        console.log(`    Skipped reproceso: ${result.skippedReprocess}`);
        console.log(`    Skipped ya clasificadas: ${result.skippedAlreadyClassified}`);
        console.log(`    Skipped genericas (FLAG): ${result.skippedGeneric}`);

        // Detalle de acciones
        const reclassActions = result.actions.filter(a => a.type === 'reclassify');
        const skipActions = result.actions.filter(a => a.type !== 'reclassify');

        if (reclassActions.length > 0) {
            console.log('\n  Reclasificaciones aplicadas:');
            for (const a of reclassActions) {
                console.log(`    [${a.via}] OP ${a.opNumber} ${a.opName}`);
                console.log(`       WE: ${a.weName}`);
                console.log(`       Failure: ${a.failure}`);
                console.log(`       Cause: ${a.cause}`);
                console.log(`       specialChar: ${a.specialBefore} -> ${a.specialAfter}`);
                console.log(`       ${a.fieldModified}:`);
                console.log(`         BEFORE: ${a.textBefore || '(vacio)'}`);
                console.log(`         AFTER:  ${a.textAfter}`);
            }
        }

        if (skipActions.length > 0) {
            console.log('\n  Skips (para revision):');
            for (const a of skipActions) {
                console.log(`    [${a.type}] OP ${a.opNumber} "${a.cause}" — ${a.reason}`);
            }
        }

        plan.push({
            id: tgt.id,
            amfeNumber: amfe_number || tgt.key,
            productName: tgt.name,
            before,
            after,
        });

        logChange(apply, `${tgt.key}: ${result.reclassified} reclasificadas / ${result.aplixMatches} APLIX matches / ${result.scanned} total`, {
            reclassified: result.reclassified,
            skippedReprocess: result.skippedReprocess,
            skippedAlreadyClassified: result.skippedAlreadyClassified,
            skippedGeneric: result.skippedGeneric,
        });

        console.log('');
    }

    // ─── Resumen global ─────────────────────────────────────────────────────
    console.log('\n=== RESUMEN GLOBAL ===');
    const totals = {
        scanned: 0,
        aplixMatches: 0,
        reclassified: 0,
        skippedReprocess: 0,
        skippedAlreadyClassified: 0,
        skippedGeneric: 0,
    };
    for (const r of allResults) {
        totals.scanned += r.scanned;
        totals.aplixMatches += r.aplixMatches;
        totals.reclassified += r.reclassified;
        totals.skippedReprocess += r.skippedReprocess;
        totals.skippedAlreadyClassified += r.skippedAlreadyClassified;
        totals.skippedGeneric += r.skippedGeneric;
    }
    console.log(`  Total causas escaneadas: ${totals.scanned}`);
    console.log(`  Total menciones APLIX (incluyendo fallback): ${totals.aplixMatches}`);
    console.log(`  Reclasificadas a SC44: ${totals.reclassified}`);
    console.log(`  Skipped reproceso: ${totals.skippedReprocess}`);
    console.log(`  Skipped ya clasificadas: ${totals.skippedAlreadyClassified}`);
    console.log(`  Skipped genericas: ${totals.skippedGeneric}`);

    // Gate pre-commit + apply
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

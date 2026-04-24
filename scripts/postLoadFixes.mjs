/**
 * postLoadFixes.mjs — Fixes post-carga sprint I-PY-001.7 (2026-04-24)
 *
 * Aplica 3 fixes sobre 6 AMFEs cargados hoy segun auditoria
 * tmp/audit-post-load/estructural.md + aplix-sc44.md:
 *
 *   FIX 1 — Metadata desync. Recalcula operation_count / cause_count /
 *           ap_h_count / ap_m_count desde data.operations y actualiza columnas.
 *           Los 6 AMFEs (desync 0-26% segun auditor).
 *
 *   FIX 2 — AP=H sin placeholder. Aplica "Pendiente definicion equipo APQP"
 *           en preventionAction a las 13 causas AP=H sin accion en HF/HRC/HRO/TPL.
 *           Regla: .claude/rules/amfe-aph-pending.md. APB ya las tiene OK.
 *
 *   FIX 3 — TPL OP 70 rename "PEGADO DE DOTS" -> "PEGADO DE APLIX".
 *           Reescribe menciones de DOT(S) -> APLIX en causas de esa OP.
 *           Ver: tmp/audit-post-load/aplix-sc44.md seccion 5.
 *
 * Orden de operaciones:
 *   1) FIX 2 + FIX 3 tocan `data` (JSONB), van por `saveAmfe` + `runWithValidation`.
 *   2) FIX 1 (solo columnas metadata) se aplica DESPUES en la commitFn para que
 *      el recount refleje el data ya guardado.
 *
 * Convencion: dry-run por default, --apply para ejecutar. NO toca Supabase sin --apply.
 */

import {
    connectSupabase,
    readAmfe,
    saveAmfe,
    countAmfeStats,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish, logChange } from './_lib/dryRunGuard.mjs';

// ─── Targets ────────────────────────────────────────────────────────────────

const TARGETS = [
    { id: '10eaebce-ad87-4035-9343-3e20e4ee0fc9', key: 'HF',  name: 'Headrest Front' },
    { id: 'e9320798-ceaa-4623-97e9-92200b5234b6', key: 'HRC', name: 'Headrest Rear Center' },
    { id: 'beda6d47-30ae-4d5f-81e0-468be8950014', key: 'HRO', name: 'Headrest Rear Outer' },
    { id: '57011560-d4c1-4a8a-83f0-ed37a2bab1d5', key: 'TPL', name: 'Telas Planas PWA' },
    { id: 'c5201ba9-1225-4663-b7a1-5430f9ee8912', key: 'TTF', name: 'Telas Termoformadas PWA' },
    { id: '37cab669-0543-43c0-bb78-d00638114530', key: 'APB', name: 'Apoyabrazos Trasero Central Patagonia' },
];

const TPL_ID = '57011560-d4c1-4a8a-83f0-ed37a2bab1d5';
const PLACEHOLDER = 'Pendiente definicion equipo APQP';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** AP alias-safe. Devuelve 'H'|'M'|'L'|'' upper-cased. */
function getAp(cause) {
    const raw = cause.ap ?? cause.actionPriority ?? '';
    return String(raw).trim().toUpperCase();
}

function isEmptyText(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/**
 * Chequea si la causa ya tiene alguna accion con contenido non-vacio
 * en cualquiera de los 3 campos conocidos.
 */
function hasAnyAction(cause) {
    return !isEmptyText(cause.preventionAction)
        || !isEmptyText(cause.detectionAction)
        || !isEmptyText(cause.optimizationAction);
}

/**
 * Chequea si el texto de un campo es el placeholder actual
 * (lower-case match para robustez).
 */
function isPlaceholderText(v) {
    return typeof v === 'string' && v.trim().toLowerCase().includes('pendiente definicion equipo apqp');
}

/**
 * FIX 2 — Recorre todas las causas del AMFE, y si tienen AP=H sin accion ni
 * placeholder, mete "Pendiente definicion equipo APQP" en preventionAction y
 * marca _autoFilled = true. Retorna cantidad aplicada.
 */
function applyApHPlaceholder(doc, label) {
    let applied = 0;
    for (const op of (doc.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fm of (fn.failures || [])) {
                    for (const c of (fm.causes || [])) {
                        const ap = getAp(c);
                        if (ap !== 'H') continue;
                        // Ya tiene accion real o placeholder explicito? saltar
                        if (hasAnyAction(c)) {
                            // Si la unica "accion" es el placeholder, tampoco lo duplicamos
                            continue;
                        }
                        c.preventionAction = PLACEHOLDER;
                        c._autoFilled = true;
                        applied++;
                        const opNum = op.opNumber || op.operationNumber || '?';
                        const causeText = (c.cause || c.description || '').slice(0, 50);
                        logChange(
                            true, // logChange no usa el flag para imprimir, solo prefijo
                            `[${label}] AP=H placeholder OP ${opNum}`,
                            { causa: causeText }
                        );
                    }
                }
            }
        }
    }
    return applied;
}

/**
 * FIX 3 — En el AMFE TPL, renombra OP 70 a "PEGADO DE APLIX" y reemplaza
 * menciones de DOT/DOTS por APLIX en campos de texto de sus causas.
 */
function renameDotsToAplix(doc) {
    const counts = { opRenamed: 0, causesUpdated: 0, fieldsUpdated: 0 };

    for (const op of (doc.operations || [])) {
        const opNum = String(op.opNumber || op.operationNumber || '').trim();
        const opName = String(op.name || op.operationName || '');
        const isOp70 = opNum === '70';
        const nameHasDots = /dots?/i.test(opName) || /pegado de dots/i.test(opName);

        if (!isOp70 && !nameHasDots) continue;

        // Rename operacion
        const newName = 'PEGADO DE APLIX';
        if (opName !== newName) {
            op.name = newName;
            op.operationName = newName;
            counts.opRenamed++;
            console.log(`  [TPL] OP ${opNum}: rename "${opName}" -> "${newName}"`);
        }

        // Reescribir textos de causas en esa OP
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fm of (fn.failures || [])) {
                    // Reemplazar en failure.description tambien (puede mencionar dots)
                    const fmBefore = fm.description;
                    const fmAfter = replaceDotTerms(fmBefore);
                    if (fmBefore !== fmAfter) {
                        fm.description = fmAfter;
                        counts.fieldsUpdated++;
                        console.log(`    failure.description: "${String(fmBefore).slice(0,60)}" -> "${String(fmAfter).slice(0,60)}"`);
                    }

                    for (const c of (fm.causes || [])) {
                        let causeTouched = false;
                        const fields = [
                            'cause', 'description',
                            'preventionControl', 'detectionControl',
                            'preventionAction', 'detectionAction', 'optimizationAction',
                        ];
                        for (const f of fields) {
                            const before = c[f];
                            if (typeof before !== 'string' || before.trim() === '') continue;
                            const after = replaceDotTerms(before);
                            if (before !== after) {
                                c[f] = after;
                                counts.fieldsUpdated++;
                                causeTouched = true;
                                console.log(`    cause.${f}: "${before.slice(0,60)}" -> "${after.slice(0,60)}"`);
                            }
                        }
                        if (causeTouched) counts.causesUpdated++;
                    }
                }
            }
        }
    }
    return counts;
}

/**
 * Reemplazo conservador de DOT/DOTS por APLIX, preservando estructura del texto.
 * Reglas:
 *   - "Dots mal pegados" -> "APLIX mal pegado" (singulariza adjetivo/participio que acompana)
 *   - "DOTS" -> "APLIX"
 *   - "dots" -> "APLIX" (mantenemos en mayuscula por estilo del documento)
 *   - "Dot" / "DOT" / "dot" (sing) -> "APLIX"
 *   - No toca palabras que contienen "dots" como parte de otra (ej: "dotsomething" no existe en aval), usamos \b.
 */
function replaceDotTerms(text) {
    if (typeof text !== 'string' || !text) return text;
    let out = text;

    // 1) Casos plural con adjetivo/participio que suele acompanar: "dots mal pegados" -> "APLIX mal pegado"
    //    Cubre patrones frecuentes: "dots mal pegados", "dots mal pegadas" etc.
    out = out.replace(/\bdots\b(\s+mal\s+pegad)os\b/gi, 'APLIX$1o');
    out = out.replace(/\bdots\b(\s+mal\s+pegad)as\b/gi, 'APLIX$1o');

    // 2) Plural generico: "dots" -> "APLIX"
    out = out.replace(/\bdots\b/gi, 'APLIX');

    // 3) Singular: "dot" -> "APLIX" (NO tocar "dot" dentro de otra palabra)
    out = out.replace(/\bdot\b/gi, 'APLIX');

    return out;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    const { apply } = parseSafeArgs();
    const sb = await connectSupabase();

    // Resumen pre-metadata (lo leemos ANTES para reportar before/after)
    const before = {};
    for (const tgt of TARGETS) {
        const { doc, row } = await readAmfe(sb, tgt.id);
        const stats = countAmfeStats(doc);
        let apH = 0, apM = 0, apHNoAction = 0;
        for (const op of (doc.operations || [])) {
            for (const we of (op.workElements || [])) {
                for (const fn of (we.functions || [])) {
                    for (const fm of (fn.failures || [])) {
                        for (const c of (fm.causes || [])) {
                            const ap = getAp(c);
                            if (ap === 'H') {
                                apH++;
                                if (!hasAnyAction(c)) apHNoAction++;
                            } else if (ap === 'M') {
                                apM++;
                            }
                        }
                    }
                }
            }
        }
        before[tgt.key] = {
            ops: stats.opCount,
            causes: stats.causeCount,
            apH,
            apM,
            apHNoAction,
            colOps: row.operation_count,
            colCauses: row.cause_count,
        };
    }

    console.log('\n=== ESTADO BEFORE ===');
    for (const tgt of TARGETS) {
        const b = before[tgt.key];
        console.log(`  ${tgt.key}: ops=${b.ops}(col=${b.colOps}) causes=${b.causes}(col=${b.colCauses}) apH=${b.apH} (sin-accion=${b.apHNoAction}) apM=${b.apM}`);
    }

    // ─── Construir plan (FIX 2 + FIX 3) ─────────────────────────────────────
    const plan = [];
    const counters = { aphApplied: 0, tplOpRenamed: 0, tplCausesUpdated: 0, tplFieldsUpdated: 0 };

    for (const tgt of TARGETS) {
        // APB ya tiene placeholders OK segun auditor -> sin cambios en data
        if (tgt.key === 'APB') {
            console.log(`\n[${tgt.key}] skip FIX 2/3 (APB ya OK)`);
            continue;
        }

        const { doc: beforeDoc } = await readAmfe(sb, tgt.id);
        const after = structuredClone(beforeDoc);

        console.log(`\n[${tgt.key}] aplicando FIX 2...`);
        const aphCount = applyApHPlaceholder(after, tgt.key);
        counters.aphApplied += aphCount;
        console.log(`  => AP=H placeholder aplicado a ${aphCount} causas`);

        if (tgt.id === TPL_ID) {
            console.log(`\n[${tgt.key}] aplicando FIX 3 (rename DOTS -> APLIX)...`);
            const r = renameDotsToAplix(after);
            counters.tplOpRenamed += r.opRenamed;
            counters.tplCausesUpdated += r.causesUpdated;
            counters.tplFieldsUpdated += r.fieldsUpdated;
            console.log(`  => OPs renombradas: ${r.opRenamed}, causas tocadas: ${r.causesUpdated}, campos reescritos: ${r.fieldsUpdated}`);
        }

        plan.push({
            id: tgt.id,
            amfeNumber: beforeDoc.header?.amfeNumber || tgt.key,
            productName: tgt.name,
            before: beforeDoc,
            after,
        });
    }

    // ─── Gate + commit ──────────────────────────────────────────────────────
    await runWithValidation(plan, apply, async () => {
        // 1) Escribir data actualizado
        for (const change of plan) {
            await saveAmfe(sb, change.id, change.after);
            console.log(`  saved data AMFE ${change.id}`);
        }

        // 2) FIX 1 — metadata. Releer y recontar DESPUES del saveAmfe.
        console.log('\n=== FIX 1 — sync metadata columns ===');
        for (const tgt of TARGETS) {
            const { doc } = await readAmfe(sb, tgt.id);
            const stats = countAmfeStats(doc);
            let apH = 0, apM = 0;
            for (const op of (doc.operations || [])) {
                for (const we of (op.workElements || [])) {
                    for (const fn of (we.functions || [])) {
                        for (const fm of (fn.failures || [])) {
                            for (const c of (fm.causes || [])) {
                                const ap = getAp(c);
                                if (ap === 'H') apH++;
                                else if (ap === 'M') apM++;
                            }
                        }
                    }
                }
            }
            const { error } = await sb.from('amfe_documents').update({
                operation_count: stats.opCount,
                cause_count: stats.causeCount,
                ap_h_count: apH,
                ap_m_count: apM,
            }).eq('id', tgt.id);
            if (error) throw new Error(`UPDATE metadata ${tgt.key}: ${error.message}`);
            console.log(`  metadata ${tgt.key}: ops=${stats.opCount}, causes=${stats.causeCount}, apH=${apH}, apM=${apM}`);
        }
    });

    // ─── Resumen dry-run (metadata esperada) ────────────────────────────────
    if (!apply) {
        console.log('\n=== METADATA ESPERADA (dry-run — recalculada sobre after si hubo cambios) ===');
        for (const tgt of TARGETS) {
            // Si participo en el plan, usamos el after; sino, el before (APB)
            const change = plan.find(p => p.id === tgt.id);
            const doc = change ? change.after : (await readAmfe(sb, tgt.id)).doc;
            const stats = countAmfeStats(doc);
            let apH = 0, apM = 0;
            for (const op of (doc.operations || [])) {
                for (const we of (op.workElements || [])) {
                    for (const fn of (we.functions || [])) {
                        for (const fm of (fn.failures || [])) {
                            for (const c of (fm.causes || [])) {
                                const ap = getAp(c);
                                if (ap === 'H') apH++;
                                else if (ap === 'M') apM++;
                            }
                        }
                    }
                }
            }
            const b = before[tgt.key];
            console.log(`  ${tgt.key}:`);
            console.log(`    ops:    col=${b.colOps}  -> esperado=${stats.opCount}  (diff=${stats.opCount - b.colOps})`);
            console.log(`    causes: col=${b.colCauses} -> esperado=${stats.causeCount} (diff=${stats.causeCount - b.colCauses})`);
            console.log(`    apH: esperado=${apH}, apM: esperado=${apM}`);
        }
    }

    // ─── Resumen final ──────────────────────────────────────────────────────
    console.log('\n=== RESUMEN FIXES ===');
    console.log(`  FIX 2 AP=H placeholder aplicado a: ${counters.aphApplied} causas`);
    console.log(`  FIX 3 TPL OP renombrada:           ${counters.tplOpRenamed}`);
    console.log(`  FIX 3 TPL causas actualizadas:     ${counters.tplCausesUpdated}`);
    console.log(`  FIX 3 TPL campos reescritos:       ${counters.tplFieldsUpdated}`);
    console.log(`  FIX 1 metadata sync:               ${apply ? 'aplicado a 6 AMFEs' : 'simulado (ver tabla arriba)'}`);

    finish(apply);
}

main().catch(err => {
    console.error('\nFATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
});

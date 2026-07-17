/**
 * _autoHeal.mjs — Ciclo automatico de correccion de gaps en AMFEs
 *
 * Flujo:
 *   1. Leer tmp/audit_integral.json (generado por _auditIntegral.mjs)
 *   2. Para cada issue, clasificar en BORRAR / LLENAR / SIN_FUENTE
 *   3. Escribir plan en tmp/autoHeal_plan.json
 *   4. En dry-run: reportar plan y exit
 *   5. En --apply: ejecutar BORRAR + LLENAR, reportar SIN_FUENTE
 *
 * Uso:
 *   node scripts/_autoHeal.mjs                # dry-run
 *   node scripts/_autoHeal.mjs --apply        # ejecutar
 *   node scripts/_autoHeal.mjs --amfe XXX     # filtrar a un AMFE especifico
 *   node scripts/_autoHeal.mjs --fresh        # re-correr _auditIntegral.mjs antes
 *
 * Reglas:
 *   - NO inventar S/O/D (cookbook)
 *   - NO CC/SC
 *   - NO acciones/responsables/fechas
 *   - data TEXT (helper saveAmfe obliga JSON.stringify)
 *   - AP con calculateAP() oficial
 *   - Merge no-destructivo (preservar valores existentes)
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, readAmfe, saveAmfe, listAmfes,
    findOperation, findWorkElement, findFailure, findCauseByText,
    normalizeText, calculateAP, countAmfeStats,
} from './_lib/amfeIo.mjs';

const { apply, positional } = parseSafeArgs();
const argv = process.argv.slice(2);
const fresh = argv.includes('--fresh');
const amfeFilter = (() => {
    const i = argv.indexOf('--amfe');
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
})();

// ─── Hardcoded knowledge (cookbook) ─────────────────────────────────────────

// WE names placeholder — borrar si tienen 0 failures (ver amfe-cookbook)
const PLACEHOLDER_WE_NAMES = [
    'hoja de operaciones',
    'hojas de operaciones',
    'ayudas visuales',
    'ayuda visual',
    'iluminacion/ruido, ley 19587',
    'iluminacion/ruido ley 19587',
].map(normalizeText);

// Mapeo operacion-tipo -> AMFEs fuente candidatos
const OPERATION_SOURCES = {
    'recepcion': ['AMFE-MAESTRO-LOG-REC-001'],
    'materia prima': ['AMFE-MAESTRO-LOG-REC-001'],
    'costura': ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT', 'AMFE-2'],
    'troquelado': ['AMFE-2', 'AMFE-INS-PAT'],
    'inyeccion': ['AMFE-MAESTRO-INY-001', 'AMFE-INS-PAT', 'AMFE-ARM-PAT'],
    'termoformado': ['AMFE-2', 'AMFE-TR-PAT'],
    'adhesivado': ['AMFE-TR-PAT', 'AMFE-INS-PAT', 'AMFE-ARM-PAT'],
    'hot melt': ['AMFE-TR-PAT'],
    'soldadura': ['VWA-PAT-IPPADS-001', 'AMFE-TR-PAT'],
    'control final': ['AMFE-2', 'AMFE-INS-PAT'],
    'embalaje': ['AMFE-2', 'AMFE-INS-PAT'],
    'plegado': ['AMFE-TR-PAT'],
    'corte': ['AMFE-2', 'AMFE-INS-PAT'],
};

function isPlaceholderWE(weName) {
    return PLACEHOLDER_WE_NAMES.includes(normalizeText(weName));
}

function candidateSources(opName) {
    const name = normalizeText(opName);
    const matches = new Set();
    for (const [kw, amfes] of Object.entries(OPERATION_SOURCES)) {
        if (name.includes(normalizeText(kw))) {
            for (const a of amfes) matches.add(a);
        }
    }
    return [...matches];
}

// ─── Audit load ─────────────────────────────────────────────────────────────

const auditPath = new URL('../tmp/audit_integral.json', import.meta.url)
    .pathname.replace(/^\/([A-Z]:)/, '$1');

function ensureAuditFresh() {
    if (fresh || !existsSync(auditPath)) {
        console.log('> Re-corriendo _auditIntegral.mjs para audit fresco...');
        execSync('node scripts/_auditIntegral.mjs', { stdio: 'inherit' });
        return;
    }
    const age = (Date.now() - statSync(auditPath).mtimeMs) / 1000 / 60;
    if (age > 10) {
        console.log(`> audit_integral.json tiene ${age.toFixed(0)} min. Usa --fresh si quieres rehacer.`);
    }
}

ensureAuditFresh();
const issues = JSON.parse(readFileSync(auditPath, 'utf8'));
console.log(`Audit cargado: ${issues.length} issues totales.\n`);

// ─── Filtrar por AMFE si se pidio ────────────────────────────────────────────

const filtered = amfeFilter
    ? issues.filter(i => i.amfe === amfeFilter)
    : issues;
if (amfeFilter) console.log(`Filtrado a AMFE="${amfeFilter}" — ${filtered.length} issues.\n`);

// Issues que NO van a autoHeal (manejados por otros scripts)
const SKIP_TYPES = [
    'SUSPICIOUS_OP', 'INVALID_OP_CLIPS', 'PFD_SUSPICIOUS_STEP', 'PFD_INVALID_CLIPS',
    'PARSE_ERROR',
];
const heal = filtered.filter(i => !SKIP_TYPES.includes(i.issueType));
const structural = filtered.filter(i => SKIP_TYPES.includes(i.issueType));

if (structural.length > 0) {
    console.log(`> ${structural.length} issues estructurales detectados — usar scripts/_structuralFixes.mjs`);
}

// ─── Conectar Supabase y cargar docs ────────────────────────────────────────

const sb = await connectSupabase();
const amfeList = await listAmfes(sb);
const amfeByNumber = Object.fromEntries(amfeList.map(a => [a.amfe_number, a]));
const amfeByProject = Object.fromEntries(
    amfeList.filter(a => a.project_name).map(a => [a.project_name, a])
);

// Cache: amfe_number -> {id, doc, amfe_number}
const docCache = new Map();
async function getDoc(amfeNumber) {
    if (docCache.has(amfeNumber)) return docCache.get(amfeNumber);
    const row = amfeByNumber[amfeNumber];
    if (!row) return null;
    const res = await readAmfe(sb, row.id);
    docCache.set(amfeNumber, res);
    return res;
}

// ─── Clasificacion ──────────────────────────────────────────────────────────

const plan = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'APPLY' : 'DRY_RUN',
    audit_integral_issues: issues.length,
    autoHeal_candidates: heal.length,
    skipped_structural: structural.length,
    BORRAR: [],
    LLENAR: [],
    SIN_FUENTE: [],
    RIESGOS: [
        'NUNCA inventar S/O/D — solo propagar desde hermano con misma causa',
        'NUNCA asignar CC/SC — specialChar siempre ""',
        'NUNCA completar acciones/responsables/fechas',
        'data es TEXT — siempre JSON.stringify al escribir',
        'AP con calculateAP() oficial AIAG-VDA 2019',
        'Merge no-destructivo — preservar valores existentes',
    ],
};

// Agrupar issues por AMFE para procesar eficiente
const byAmfe = {};
for (const iss of heal) {
    const key = iss.amfe || '?';
    if (!byAmfe[key]) byAmfe[key] = [];
    byAmfe[key].push(iss);
}

console.log(`Procesando ${Object.keys(byAmfe).length} AMFEs...\n`);

// ─── Buscar causa/failure/WE en hermanos ────────────────────────────────────

/**
 * Busca en AMFEs hermanos un WE que realmente provea LO QUE FALTA segun issueType.
 * No es suficiente que el hermano tenga "algo" — debe tener el campo especifico.
 */
async function findSiblingData(currentAmfeNumber, issueType, opNum, opName, weName, fmDesc = null, causeDesc = null) {
    const candidates = candidateSources(opName).filter(c => c !== currentAmfeNumber);
    if (candidates.length === 0) return null;

    for (const srcNumber of candidates) {
        const src = await getDoc(srcNumber);
        if (!src) continue;
        let srcOp = findOperation(src.doc, opNum);
        if (!srcOp) {
            const opNameNorm = normalizeText(opName);
            srcOp = (src.doc.operations || []).find(o =>
                normalizeText(o.name || o.operationName) === opNameNorm
            );
        }
        if (!srcOp) continue;

        const srcWe = findWorkElement(srcOp, weName);
        if (!srcWe) continue;
        if (!srcWe.functions || srcWe.functions.length === 0) continue;

        // Validacion especifica por issueType — el src debe proveer LO QUE FALTA
        if (issueType === 'FN_TBD_OR_EMPTY') {
            // Necesita function con description no-vacia y no-TBD
            const validFn = srcWe.functions.find(f => {
                const d = f.description || f.functionDescription || '';
                return d.trim() !== '' && !normalizeText(d).startsWith('tbd');
            });
            if (!validFn) continue;
            return { source: srcNumber, we: srcWe, fn: validFn };
        }

        if (issueType === 'FN_NO_FAILURES' || issueType === 'WE_NO_FN') {
            // Necesita al menos 1 failure con >=1 causa
            const hasFailures = srcWe.functions.some(f =>
                (f.failures || []).some(fm => (fm.causes || []).length > 0)
            );
            if (!hasFailures) continue;
            return { source: srcNumber, we: srcWe };
        }

        if (['FM_NO_CAUSES', 'CAUSE_MISSING_SOD', 'CAUSE_NO_PREV_CTRL', 'CAUSE_NO_DET_CTRL',
            'FM_NO_EFFECT_LOCAL', 'FM_NO_EFFECT_NEXT', 'FM_NO_EFFECT_END'].includes(issueType)) {
            // Necesita el failure especifico con causas/efectos cargados
            if (!fmDesc) continue;
            const srcFm = srcWe.functions
                .flatMap(fn => fn.failures || [])
                .find(fm => normalizeText(fm.description) === normalizeText(fmDesc));
            if (!srcFm) continue;

            // Validar que el src TENGA el campo que falta
            if (issueType === 'FM_NO_CAUSES' && (srcFm.causes || []).length === 0) continue;
            if (issueType === 'FM_NO_EFFECT_LOCAL' && !srcFm.effectLocal) continue;
            if (issueType === 'FM_NO_EFFECT_NEXT' && !srcFm.effectNextLevel) continue;
            if (issueType === 'FM_NO_EFFECT_END' && !srcFm.effectEndUser) continue;

            if (causeDesc) {
                const srcCause = findCauseByText(srcFm.causes || [], causeDesc);
                if (!srcCause) continue;
                if (issueType === 'CAUSE_MISSING_SOD' &&
                    (srcCause.severity == null || srcCause.occurrence == null || srcCause.detection == null)) continue;
                if (issueType === 'CAUSE_NO_PREV_CTRL' && !srcCause.preventionControl) continue;
                if (issueType === 'CAUSE_NO_DET_CTRL' && !srcCause.detectionControl) continue;
                return { source: srcNumber, we: srcWe, fm: srcFm, cause: srcCause };
            }
            return { source: srcNumber, we: srcWe, fm: srcFm };
        }

        // Default: devolver si hay contenido minimo
        const hasContent = srcWe.functions.some(f =>
            (f.failures || []).some(fm => (fm.causes || []).length > 0)
        );
        if (hasContent) return { source: srcNumber, we: srcWe };
    }
    return null;
}

// ─── Clasificar cada issue ───────────────────────────────────────────────────

for (const [amfeNumber, amfeIssues] of Object.entries(byAmfe)) {
    for (const iss of amfeIssues) {
        const base = {
            amfe: amfeNumber,
            opNum: iss.opNum,
            opName: iss.opName,
            weType: iss.weType,
            weName: iss.weName,
            fnDesc: iss.fnDesc,
            fmDesc: iss.fmDesc,
            causeDesc: iss.causeDesc,
            issueType: iss.issueType,
        };

        // 1. Es placeholder conocido + issue tipo "sin contenido"? -> BORRAR
        const emptyType = ['FN_TBD_OR_EMPTY', 'FN_NO_FAILURES', 'WE_NO_FN'].includes(iss.issueType);
        if (emptyType && isPlaceholderWE(iss.weName)) {
            plan.BORRAR.push({ ...base, reason: 'WE placeholder conocido sin failures' });
            continue;
        }

        // 2. CAUSE_NO_AP: solo LLENAR si S/O/D estan cargados en el target
        //    (si faltan, tambien hay CAUSE_MISSING_SOD — se maneja con hermano)
        if (iss.issueType === 'CAUSE_NO_AP') {
            const targetDoc = await getDoc(amfeNumber);
            if (targetDoc) {
                const op = findOperation(targetDoc.doc, iss.opNum);
                const we = op ? findWorkElement(op, iss.weName) : null;
                const fm = we ? (we.functions || []).flatMap(f => f.failures || [])
                    .find(x => normalizeText(x.description) === normalizeText(iss.fmDesc)) : null;
                const cause = fm ? findCauseByText(fm.causes, iss.causeDesc) : null;
                if (cause && cause.severity != null && cause.occurrence != null && cause.detection != null) {
                    plan.LLENAR.push({
                        ...base,
                        action: 'RECALC_AP',
                        reason: 'Recalcular AP con calculateAP() oficial',
                        source: '(local — S/O/D ya cargados)',
                    });
                    continue;
                }
            }
            // S/O/D incompletos -> SIN_FUENTE (requiere llenarlos primero)
            plan.SIN_FUENTE.push({
                ...base,
                reason: 'AP vacio y S/O/D incompletos — llenar S/O/D primero',
            });
            continue;
        }

        // 3. Gaps que requieren fuente hermana
        const needsSibling = [
            'FN_TBD_OR_EMPTY', 'FN_NO_FAILURES', 'WE_NO_FN', 'FM_NO_CAUSES',
            'CAUSE_MISSING_SOD', 'CAUSE_NO_PREV_CTRL', 'CAUSE_NO_DET_CTRL',
            'FM_NO_EFFECT_LOCAL', 'FM_NO_EFFECT_NEXT', 'FM_NO_EFFECT_END',
        ];
        if (!needsSibling.includes(iss.issueType)) continue;

        const sib = await findSiblingData(
            amfeNumber, iss.issueType, iss.opNum, iss.opName, iss.weName, iss.fmDesc, iss.causeDesc
        );
        if (sib) {
            plan.LLENAR.push({
                ...base,
                action: 'PROPAGATE',
                source: sib.source,
                reason: `Fuente con contenido en ${sib.source}`,
            });
        } else {
            plan.SIN_FUENTE.push({
                ...base,
                reason: 'No hay hermano Supabase con WE+failures+causas para este gap',
            });
        }
    }
}

plan.summary = {
    BORRAR: plan.BORRAR.length,
    LLENAR: plan.LLENAR.length,
    SIN_FUENTE: plan.SIN_FUENTE.length,
    total: plan.BORRAR.length + plan.LLENAR.length + plan.SIN_FUENTE.length,
};

// ─── Escribir plan ──────────────────────────────────────────────────────────

const planPath = new URL('../tmp/autoHeal_plan.json', import.meta.url)
    .pathname.replace(/^\/([A-Z]:)/, '$1');
writeFileSync(planPath, JSON.stringify(plan, null, 2));

console.log('=== AUTO-HEAL PLAN ===');
console.log(`  BORRAR:     ${plan.BORRAR.length}`);
console.log(`  LLENAR:     ${plan.LLENAR.length}`);
console.log(`  SIN_FUENTE: ${plan.SIN_FUENTE.length}`);
console.log(`\nPlan: ${planPath}\n`);

if (plan.LLENAR.length === 0 && plan.BORRAR.length === 0) {
    console.log('Nada que hacer.');
    finish(apply);
    process.exit(0);
}

// ─── APPLY ──────────────────────────────────────────────────────────────────

if (!apply) {
    console.log('DRY-RUN: re-ejecuta con --apply para ejecutar BORRAR y LLENAR.');
    console.log('SIN_FUENTE queda sin tocar siempre (requiere decision humana).');
    finish(apply);
    process.exit(0);
}

console.log('APLICANDO cambios...\n');

// Agrupar acciones por AMFE para minimizar writes
const byTargetAmfe = {};
for (const item of [...plan.BORRAR, ...plan.LLENAR]) {
    const key = item.amfe;
    if (!byTargetAmfe[key]) byTargetAmfe[key] = { BORRAR: [], LLENAR: [] };
    if (plan.BORRAR.includes(item)) byTargetAmfe[key].BORRAR.push(item);
    else byTargetAmfe[key].LLENAR.push(item);
}

let totalApplied = 0;
let totalSkipped = 0;

for (const [amfeNumber, ops] of Object.entries(byTargetAmfe)) {
    const target = await getDoc(amfeNumber);
    if (!target) {
        console.warn(`  [SKIP] ${amfeNumber}: no se pudo cargar`);
        continue;
    }

    let modified = false;

    // 1. BORRAR: eliminar WEs placeholder
    for (const item of ops.BORRAR) {
        const op = findOperation(target.doc, item.opNum);
        if (!op) { totalSkipped++; continue; }
        const before = op.workElements.length;
        op.workElements = op.workElements.filter(w => normalizeText(w.name) !== normalizeText(item.weName));
        if (op.workElements.length < before) {
            logChange(apply, `${amfeNumber} OP ${item.opNum}: DELETE WE "${item.weName}" (${item.weType})`, null);
            modified = true;
            totalApplied++;
        } else {
            totalSkipped++;
        }
    }

    // 2. LLENAR: merge no-destructivo
    for (const item of ops.LLENAR) {
        const op = findOperation(target.doc, item.opNum);
        if (!op) { totalSkipped++; continue; }
        const we = findWorkElement(op, item.weName);
        if (!we) { totalSkipped++; continue; }

        // RECALC_AP: local, sin hermano
        if (item.action === 'RECALC_AP') {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    for (const c of fm.causes || []) {
                        if (c.severity != null && c.occurrence != null && c.detection != null) {
                            const ap = calculateAP(c.severity, c.occurrence, c.detection);
                            if (ap && ap !== c.actionPriority) {
                                c.actionPriority = ap;
                                c.ap = ap;
                                modified = true;
                                totalApplied++;
                            }
                        }
                    }
                }
            }
            continue;
        }

        // PROPAGATE: buscar fuente y merge
        const src = await getDoc(item.source);
        if (!src) { totalSkipped++; continue; }
        const srcOp = findOperation(src.doc, item.opNum)
            || (src.doc.operations || []).find(o => normalizeText(o.name || o.operationName) === normalizeText(item.opName));
        if (!srcOp) { totalSkipped++; continue; }
        const srcWe = findWorkElement(srcOp, item.weName);
        if (!srcWe) { totalSkipped++; continue; }

        // Merge no-destructivo a nivel de causa/failure
        const changed = mergeWorkElement(we, srcWe, item);
        if (changed) {
            logChange(apply, `${amfeNumber} OP ${item.opNum}: MERGE WE "${item.weName}" from ${item.source}`, null);
            modified = true;
            totalApplied++;
        } else {
            totalSkipped++;
        }
    }

    if (modified) {
        const row = amfeByNumber[amfeNumber];
        try {
            await saveAmfe(sb, row.id, target.doc, { expectedAmfeNumber: amfeNumber });
        } catch (e) {
            console.error(`  [ERROR] save ${amfeNumber}: ${e.message}`);
        }
    }
}

// ─── Merge helper ───────────────────────────────────────────────────────────

function mergeWorkElement(targetWe, srcWe, item) {
    let changed = false;
    // Caso 1: target WE no tiene functions -> copiar estructura minima de src si es WE real
    if (!targetWe.functions || targetWe.functions.length === 0) {
        // No copiamos function completa sin autorizacion — dejamos para SIN_FUENTE
        return false;
    }

    for (const tFn of targetWe.functions) {
        // Rellenar function description si es TBD/vacia
        if (!tFn.description || normalizeText(tFn.description).startsWith('tbd') || tFn.description.trim() === '') {
            const srcFn = srcWe.functions[0]; // primera funcion del src con contenido
            if (srcFn && srcFn.description) {
                tFn.description = srcFn.description;
                tFn.functionDescription = srcFn.description;
                changed = true;
            }
        }

        // Rellenar failures si no hay
        if (!tFn.failures) tFn.failures = [];
        // Por ahora NO agregamos failures nuevas desde scratch — eso requiere decision humana.
        // Solo completamos failures existentes con efectos / causas faltantes.

        for (const tFm of tFn.failures) {
            // Buscar en src misma failure
            const srcFm = (srcWe.functions || [])
                .flatMap(f => f.failures || [])
                .find(f => normalizeText(f.description) === normalizeText(tFm.description));
            if (!srcFm) continue;

            // Merge efectos si faltan
            if (!tFm.effectLocal && srcFm.effectLocal) { tFm.effectLocal = srcFm.effectLocal; changed = true; }
            if (!tFm.effectNextLevel && srcFm.effectNextLevel) { tFm.effectNextLevel = srcFm.effectNextLevel; changed = true; }
            if (!tFm.effectEndUser && srcFm.effectEndUser) { tFm.effectEndUser = srcFm.effectEndUser; changed = true; }

            // Merge causas
            if (!tFm.causes) tFm.causes = [];
            for (const tCause of tFm.causes) {
                const srcCause = findCauseByText(srcFm.causes, tCause.cause || tCause.description);
                if (!srcCause) continue;
                if (tCause.severity == null && srcCause.severity != null) { tCause.severity = srcCause.severity; changed = true; }
                if (tCause.occurrence == null && srcCause.occurrence != null) { tCause.occurrence = srcCause.occurrence; changed = true; }
                if (tCause.detection == null && srcCause.detection != null) { tCause.detection = srcCause.detection; changed = true; }
                if (!tCause.preventionControl && srcCause.preventionControl) { tCause.preventionControl = srcCause.preventionControl; changed = true; }
                if (!tCause.detectionControl && srcCause.detectionControl) { tCause.detectionControl = srcCause.detectionControl; changed = true; }
                // Siempre recalcular AP despues de posible merge
                if (tCause.severity != null && tCause.occurrence != null && tCause.detection != null) {
                    const ap = calculateAP(tCause.severity, tCause.occurrence, tCause.detection);
                    if (ap && ap !== tCause.actionPriority) {
                        tCause.actionPriority = ap;
                        tCause.ap = ap;
                        changed = true;
                    }
                }
                // NUNCA tocar CC/SC ni acciones
            }
        }
    }
    return changed;
}

// ─── Final ──────────────────────────────────────────────────────────────────

console.log(`\n=== RESUMEN APPLY ===`);
console.log(`  Aplicados: ${totalApplied}`);
console.log(`  Skipped:   ${totalSkipped}`);
console.log(`  SIN_FUENTE: ${plan.SIN_FUENTE.length} (no tocados — requieren Fak)`);

if (plan.SIN_FUENTE.length > 0) {
    console.log('\n> Items SIN_FUENTE reportados en tmp/autoHeal_plan.json seccion SIN_FUENTE[]');
    console.log('> Estos requieren decision manual de Fak o equipo APQP.');
}

finish(apply);

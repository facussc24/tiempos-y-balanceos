/**
 * AUDIT READ-ONLY — Cross-Document alignment (AMFE ↔ PFD ↔ CP ↔ HO)
 *
 * Valida coherencia cruzada entre documentos APQP Barack Mercosul tras una sesion
 * grande de modificaciones (180+ cambios en AMFEs, 8 PFD steps borrados).
 *
 * Re-implementa la logica de (no importa, por no mezclar .mjs con .ts):
 *   - utils/pfdAmfeLinkValidation.ts (linkedAmfeOperationId <-> linkedPfdStepId)
 *   - utils/hoCpLinkValidation.ts (qcItems.cpItemId <-> cpItems.id + coverage)
 *   - modules/controlPlan/cpCrossValidation.ts (V2 orphan failures por cause)
 *
 * Checks:
 *   A. AMFE <-> PFD
 *      - PFD step con linkedAmfeOperationId -> op inexistente  [CRITICAL]
 *      - AMFE operation con linkedPfdStepId -> step inexistente [CRITICAL]
 *      - Operacion AMFE sin step "OP N" coincidente en PFD      [WARN]
 *      - Step PFD tipo operation/inspection/combined sin match AMFE [INFO]
 *      - Nombres no coinciden (mismo opNumber, distinto texto)   [INFO]
 *   B. AMFE <-> CP
 *      - CP item con amfeCauseIds apuntando a causa inexistente [CRITICAL]
 *      - CP item con amfeFailureId(s) apuntando a failure inexistente [CRITICAL]
 *      - Causa AP=H sin ningun CP item que la referencie        [CRITICAL]
 *      - Causa AP=M sin ningun CP item que la referencie        [WARN]
 *      - processStepNumber del CP sin operacion correspondiente en AMFE [WARN]
 *   C. CP <-> HO
 *      - qcItem.cpItemId apuntando a item inexistente           [CRITICAL]
 *      - CP item "de piso" (no lab/metrologia/auditor) sin qcItem en HO [WARN]
 *
 * Output:
 *   - tmp/audit_cross_doc.json (machine-readable)
 *   - stdout: tabla resumen por producto + top issues
 *
 * Uso:
 *   node scripts/_auditCrossDoc.mjs
 */

import {
    connectSupabase,
    parseData,
} from './_lib/amfeIo.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TMP_DIR = join(__dirname, '..', 'tmp');

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function norm(s) {
    if (s == null) return '';
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function opNum(op) {
    return String(op?.opNumber || op?.operationNumber || '').trim();
}

function opName(op) {
    return String(op?.name || op?.operationName || '').trim();
}

function causeText(c) {
    return String(c?.cause || c?.description || '').trim();
}

function causeAp(c) {
    return String(c?.ap || c?.actionPriority || '').toUpperCase().trim();
}

/** Extract leading integer from a step number like "OP 40", "40", "100" */
function extractOpInteger(s) {
    const m = String(s || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
}

function flattenCauses(amfeDoc) {
    const out = [];
    for (const op of amfeDoc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    for (const c of fm.causes || []) {
                        out.push({
                            opId: op.id,
                            opNum: opNum(op),
                            opName: opName(op),
                            weId: we.id,
                            fnId: fn.id,
                            fmId: fm.id,
                            fmDesc: fm.description || fm.failureDescription || '',
                            cause: c,
                            causeId: c.id,
                            ap: causeAp(c),
                        });
                    }
                }
            }
        }
    }
    return out;
}

function flattenFailures(amfeDoc) {
    const out = [];
    for (const op of amfeDoc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    out.push({ opId: op.id, fmId: fm.id, fmDesc: fm.description || '' });
                }
            }
        }
    }
    return out;
}

const NON_HO_ROLES = ['laboratorio', 'metrologia', 'metrologo', 'auditor'];

function isShopFloorRole(owner) {
    const o = norm(owner);
    if (!o) return true; // vacio = asumir piso
    return !NON_HO_ROLES.some(r => o.includes(r));
}

// ──────────────────────────────────────────────────────────────────────────
// Loaders
// ──────────────────────────────────────────────────────────────────────────

async function loadAllDocs(sb) {
    const [amfeRes, cpRes, hoRes, pfdRes] = await Promise.all([
        sb.from('amfe_documents').select('id, amfe_number, project_name, part_number, data'),
        sb.from('cp_documents').select('id, control_plan_number, project_name, part_number, part_name, linked_amfe_project, linked_amfe_id, data'),
        sb.from('ho_documents').select('id, part_number, part_description, linked_amfe_project, linked_cp_project, linked_amfe_id, linked_cp_id, data'),
        sb.from('pfd_documents').select('id, part_number, part_name, document_number, data'),
    ]);

    for (const r of [amfeRes, cpRes, hoRes, pfdRes]) {
        if (r.error) throw new Error(`LOAD fail: ${r.error.message}`);
    }

    const parse = (rows) => rows.map(r => ({ ...r, doc: parseData(r.data) }));
    return {
        amfes: parse(amfeRes.data || []),
        cps: parse(cpRes.data || []),
        hos: parse(hoRes.data || []),
        pfds: parse(pfdRes.data || []),
    };
}

// ──────────────────────────────────────────────────────────────────────────
// Matchers: associate docs into product bundles
// ──────────────────────────────────────────────────────────────────────────

/**
 * Bundle docs por identificador de producto. Estrategia:
 *   1. Matchear por `products` table si tiene amfe_id/cp_id/etc. (autoridad)
 *   2. Fallback: matchear por project_name (AMFE) ~ part_name (PFD) / cp_number
 */
function buildBundles({ amfes, cps, hos, pfds }) {
    // Un bundle por AMFE (11 AMFEs = 11 productos). Matcheamos CP/HO/PFD usando FKs o nombre.
    const bundles = [];
    const usedCp = new Set(), usedHo = new Set(), usedPfd = new Set();

    for (const amfe of amfes) {
        const productKey = amfe.project_name || amfe.part_number || amfe.amfe_number || amfe.id;

        // CP: linked_amfe_id exacto primero, luego linked_amfe_project / project_name
        let cp = cps.find(c => !usedCp.has(c.id) && c.linked_amfe_id === amfe.id);
        if (!cp) {
            cp = cps.find(c => !usedCp.has(c.id) && norm(c.linked_amfe_project || c.project_name) === norm(amfe.project_name));
        }
        if (!cp) {
            cp = cps.find(c => {
                if (usedCp.has(c.id)) return false;
                const h = norm(c.linked_amfe_project || c.project_name || c.part_name || '');
                const a = norm(amfe.project_name || '');
                return h && a && (h.includes(a) || a.includes(h));
            });
        }
        if (cp) usedCp.add(cp.id);

        // HO: linked_amfe_id, luego linked_cp_id, luego nombre
        let ho = hos.find(h => !usedHo.has(h.id) && h.linked_amfe_id === amfe.id);
        if (!ho && cp) {
            ho = hos.find(h => !usedHo.has(h.id) && h.linked_cp_id === cp.id);
        }
        if (!ho) {
            ho = hos.find(h => {
                if (usedHo.has(h.id)) return false;
                const hint = norm(h.linked_amfe_project || h.part_description || h.part_number || '');
                const a = norm(amfe.project_name || '');
                return hint && a && (hint.includes(a) || a.includes(hint));
            });
        }
        if (ho) usedHo.add(ho.id);

        // PFD: part_number exacto, luego part_name
        let pfd = pfds.find(p => !usedPfd.has(p.id) && norm(p.part_number) === norm(amfe.part_number) && amfe.part_number);
        if (!pfd) {
            pfd = pfds.find(p => {
                if (usedPfd.has(p.id)) return false;
                const hint = norm(p.part_name || p.part_number || '');
                const a = norm(amfe.project_name || '');
                return hint && a && (hint.includes(a) || a.includes(hint));
            });
        }
        if (pfd) usedPfd.add(pfd.id);

        bundles.push({ productName: productKey, amfe, cp, ho, pfd });
    }

    // Reportar docs huerfanos (no bundled)
    const orphans = {
        cps: cps.filter(c => !usedCp.has(c.id)).map(c => ({ id: c.id, hint: c.linked_amfe_project || c.project_name || c.control_plan_number })),
        hos: hos.filter(h => !usedHo.has(h.id)).map(h => ({ id: h.id, hint: h.linked_amfe_project || h.part_description })),
        pfds: pfds.filter(p => !usedPfd.has(p.id)).map(p => ({ id: p.id, hint: p.part_name || p.part_number })),
    };

    return { bundles: bundles.sort((a, b) => a.productName.localeCompare(b.productName)), orphans };
}

// ──────────────────────────────────────────────────────────────────────────
// Validators
// ──────────────────────────────────────────────────────────────────────────

function validateAmfePfd(amfe, pfd) {
    const issues = [];
    if (!amfe || !pfd || !amfe.doc || !pfd.doc) return issues;
    const ops = amfe.doc.operations || [];
    const steps = pfd.doc.steps || [];
    const opIds = new Set(ops.map(o => o.id));
    const stepIds = new Set(steps.map(s => s.id));

    // PFD -> AMFE broken links
    for (const s of steps) {
        if (s.linkedAmfeOperationId && !opIds.has(s.linkedAmfeOperationId)) {
            issues.push({
                severity: 'CRITICAL',
                type: 'PFD_BROKEN_AMFE_LINK',
                msg: `PFD step "${s.stepNumber || ''} ${s.description || ''}" → AMFE op ${s.linkedAmfeOperationId} no existe`,
                stepId: s.id,
                amfeOpId: s.linkedAmfeOperationId,
            });
        }
    }

    // AMFE -> PFD broken links
    for (const op of ops) {
        if (op.linkedPfdStepId && !stepIds.has(op.linkedPfdStepId)) {
            issues.push({
                severity: 'CRITICAL',
                type: 'AMFE_BROKEN_PFD_LINK',
                msg: `AMFE op ${opNum(op)} "${opName(op)}" → PFD step ${op.linkedPfdStepId} no existe`,
                opId: op.id,
                pfdStepId: op.linkedPfdStepId,
            });
        }
    }

    // Op numbers en AMFE sin step numerico coincidente en PFD
    const pfdOpInts = new Set(
        steps
            .filter(s => ['operation', 'combined', 'inspection'].includes(s.stepType))
            .map(s => extractOpInteger(s.stepNumber))
            .filter(n => n != null)
    );
    for (const op of ops) {
        const n = extractOpInteger(opNum(op));
        if (n == null) continue;
        if (!pfdOpInts.has(n)) {
            issues.push({
                severity: 'WARN',
                type: 'AMFE_OP_MISSING_IN_PFD',
                msg: `AMFE op ${opNum(op)} "${opName(op)}" no tiene step correspondiente en PFD`,
                opId: op.id,
            });
        }
    }

    // PFD steps operacion/inspeccion sin op AMFE coincidente
    const amfeOpInts = new Set(ops.map(o => extractOpInteger(opNum(o))).filter(n => n != null));
    for (const s of steps) {
        if (!['operation', 'combined', 'inspection'].includes(s.stepType)) continue;
        const n = extractOpInteger(s.stepNumber);
        if (n == null) continue;
        if (!amfeOpInts.has(n)) {
            issues.push({
                severity: 'INFO',
                type: 'PFD_STEP_MISSING_IN_AMFE',
                msg: `PFD step "${s.stepNumber} ${s.description}" no tiene op correspondiente en AMFE`,
                stepId: s.id,
            });
        }
    }

    // Nombres no coinciden para mismo numero
    const pfdByInt = new Map();
    for (const s of steps) {
        const n = extractOpInteger(s.stepNumber);
        if (n != null && ['operation', 'combined', 'inspection'].includes(s.stepType)) pfdByInt.set(n, s);
    }
    for (const op of ops) {
        const n = extractOpInteger(opNum(op));
        if (n == null) continue;
        const s = pfdByInt.get(n);
        if (!s) continue;
        const nA = norm(opName(op));
        const nP = norm(s.description);
        if (!nA || !nP) continue;
        if (nA !== nP && !nA.includes(nP) && !nP.includes(nA)) {
            issues.push({
                severity: 'INFO',
                type: 'NAME_MISMATCH_AMFE_PFD',
                msg: `OP ${n}: AMFE="${opName(op)}" vs PFD="${s.description}"`,
                opId: op.id,
                stepId: s.id,
            });
        }
    }

    return issues;
}

function validateAmfeCp(amfe, cp) {
    const issues = [];
    if (!amfe || !cp || !amfe.doc || !cp.doc) return issues;

    const ops = amfe.doc.operations || [];
    const items = cp.doc.items || [];
    const allCauses = flattenCauses(amfe.doc);
    const allFailures = flattenFailures(amfe.doc);

    const causeById = new Map(allCauses.map(c => [c.causeId, c]));
    const failureIds = new Set(allFailures.map(f => f.fmId));
    const opInts = new Set(ops.map(o => extractOpInteger(opNum(o))).filter(n => n != null));

    // CP -> AMFE broken cause refs
    for (const item of items) {
        for (const cid of item.amfeCauseIds || []) {
            if (!causeById.has(cid)) {
                issues.push({
                    severity: 'CRITICAL',
                    type: 'CP_BROKEN_AMFE_CAUSE_REF',
                    msg: `CP item OP ${item.processStepNumber} "${(item.productCharacteristic || item.processCharacteristic || '').slice(0, 50)}" → causa AMFE ${cid} ya no existe`,
                    itemId: item.id,
                    causeId: cid,
                });
            }
        }
        // failure refs
        const failRefs = [];
        if (item.amfeFailureId) failRefs.push(item.amfeFailureId);
        if (Array.isArray(item.amfeFailureIds)) failRefs.push(...item.amfeFailureIds);
        for (const fid of failRefs) {
            if (!failureIds.has(fid)) {
                issues.push({
                    severity: 'CRITICAL',
                    type: 'CP_BROKEN_AMFE_FAILURE_REF',
                    msg: `CP item OP ${item.processStepNumber} → failure AMFE ${fid} ya no existe`,
                    itemId: item.id,
                    failureId: fid,
                });
            }
        }
        // processStepNumber -> op en AMFE
        const n = extractOpInteger(item.processStepNumber);
        if (n != null && !opInts.has(n)) {
            issues.push({
                severity: 'WARN',
                type: 'CP_ITEM_OP_MISSING_IN_AMFE',
                msg: `CP item con processStepNumber=${item.processStepNumber} no tiene operacion en AMFE`,
                itemId: item.id,
            });
        }
    }

    // AMFE causas AP=H / AP=M sin referencia desde CP
    const referencedCauseIds = new Set();
    for (const item of items) {
        for (const cid of item.amfeCauseIds || []) referencedCauseIds.add(cid);
    }
    for (const c of allCauses) {
        if (c.ap !== 'H' && c.ap !== 'M') continue;
        if (!referencedCauseIds.has(c.causeId)) {
            issues.push({
                severity: c.ap === 'H' ? 'CRITICAL' : 'WARN',
                type: c.ap === 'H' ? 'AMFE_APH_CAUSE_NOT_IN_CP' : 'AMFE_APM_CAUSE_NOT_IN_CP',
                msg: `AMFE OP ${c.opNum} "${c.opName}" causa AP=${c.ap} id=${c.causeId} sin CP item`,
                opId: c.opId,
                causeId: c.causeId,
            });
        }
    }

    return issues;
}

function validateCpHo(cp, ho) {
    const issues = [];
    if (!cp || !ho || !cp.doc || !ho.doc) return issues;

    const items = cp.doc.items || [];
    const sheets = ho.doc.sheets || [];
    const itemIds = new Set(items.map(i => i.id));

    // HO qualityChecks -> CP broken
    const referencedCpIds = new Set();
    for (const sh of sheets) {
        for (const qc of sh.qualityChecks || []) {
            if (qc.cpItemId) referencedCpIds.add(qc.cpItemId);
            if (qc.cpItemId && !itemIds.has(qc.cpItemId)) {
                issues.push({
                    severity: 'CRITICAL',
                    type: 'HO_BROKEN_CP_REF',
                    msg: `HO sheet "${sh.operationName || sh.operationNumber || sh.id}" qc "${qc.characteristic || ''}" → CP item ${qc.cpItemId} no existe`,
                    sheetId: sh.id,
                    checkId: qc.id,
                    cpItemId: qc.cpItemId,
                });
            }
        }
    }

    // CP items de piso sin qcItem en HO
    for (const item of items) {
        if (referencedCpIds.has(item.id)) continue;
        if (!isShopFloorRole(item.reactionPlanOwner)) continue; // lab/metrologia/auditor no va a HO
        issues.push({
            severity: 'WARN',
            type: 'CP_ITEM_NOT_IN_HO',
            msg: `CP item OP ${item.processStepNumber} "${(item.productCharacteristic || item.processCharacteristic || '').slice(0, 50)}" (owner="${item.reactionPlanOwner || ''}") sin qcItem en HO`,
            itemId: item.id,
        });
    }

    return issues;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function main() {
    console.log('AUDIT CROSS-DOC — READ-ONLY');
    console.log('Conectando Supabase…');
    const sb = await connectSupabase();

    console.log('Cargando docs…');
    const all = await loadAllDocs(sb);
    console.log(`  AMFEs: ${all.amfes.length} | CPs: ${all.cps.length} | HOs: ${all.hos.length} | PFDs: ${all.pfds.length}`);

    const { bundles, orphans } = buildBundles(all);

    const report = {
        generatedAt: new Date().toISOString(),
        counts: {
            amfes: all.amfes.length,
            cps: all.cps.length,
            hos: all.hos.length,
            pfds: all.pfds.length,
            bundles: bundles.length,
        },
        orphans,
        bundles: [],
        totals: { CRITICAL: 0, WARN: 0, INFO: 0 },
        byType: {},
    };

    for (const b of bundles) {
        const amfePfd = validateAmfePfd(b.amfe, b.pfd);
        const amfeCp = validateAmfeCp(b.amfe, b.cp);
        const cpHo = validateCpHo(b.cp, b.ho);
        const allIssues = [...amfePfd, ...amfeCp, ...cpHo];

        const entry = {
            product: b.productName,
            amfe: b.amfe ? { id: b.amfe.id, number: b.amfe.amfe_number } : null,
            cp: b.cp ? { id: b.cp.id, number: b.cp.control_plan_number } : null,
            ho: b.ho ? { id: b.ho.id } : null,
            pfd: b.pfd ? { id: b.pfd.id, name: b.pfd.part_name } : null,
            counts: {
                amfePfd: amfePfd.length,
                amfeCp: amfeCp.length,
                cpHo: cpHo.length,
                brokenRefs: allIssues.filter(i => i.type.includes('BROKEN')).length,
                CRITICAL: allIssues.filter(i => i.severity === 'CRITICAL').length,
                WARN: allIssues.filter(i => i.severity === 'WARN').length,
                INFO: allIssues.filter(i => i.severity === 'INFO').length,
            },
            issues: allIssues,
        };
        report.bundles.push(entry);
        report.totals.CRITICAL += entry.counts.CRITICAL;
        report.totals.WARN += entry.counts.WARN;
        report.totals.INFO += entry.counts.INFO;
        for (const i of allIssues) {
            report.byType[i.type] = (report.byType[i.type] || 0) + 1;
        }
    }

    // ─── Output JSON ────────────────────────────────────────────────────
    try { mkdirSync(TMP_DIR, { recursive: true }); } catch {}
    const outPath = join(TMP_DIR, 'audit_cross_doc.json');
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nJSON -> ${outPath}`);

    // ─── Tabla resumen ──────────────────────────────────────────────────
    console.log('\n=== RESUMEN POR PRODUCTO ===');
    const colW = { prod: 46, ap: 7, ac: 7, ch: 7, br: 8 };
    const pad = (s, n) => String(s).slice(0, n).padEnd(n, ' ');
    console.log(
        pad('Producto', colW.prod) + ' | ' +
        pad('A<->P', colW.ap) + ' | ' +
        pad('A<->C', colW.ac) + ' | ' +
        pad('C<->H', colW.ch) + ' | ' +
        pad('BrokenR', colW.br)
    );
    console.log('-'.repeat(colW.prod + colW.ap + colW.ac + colW.ch + colW.br + 12));
    for (const e of report.bundles) {
        console.log(
            pad(e.product, colW.prod) + ' | ' +
            pad(e.counts.amfePfd, colW.ap) + ' | ' +
            pad(e.counts.amfeCp, colW.ac) + ' | ' +
            pad(e.counts.cpHo, colW.ch) + ' | ' +
            pad(e.counts.brokenRefs, colW.br)
        );
    }

    console.log('\n=== TOTALES ===');
    console.log(`CRITICAL: ${report.totals.CRITICAL}`);
    console.log(`WARN    : ${report.totals.WARN}`);
    console.log(`INFO    : ${report.totals.INFO}`);

    console.log('\n=== BY TYPE ===');
    const sortedTypes = Object.entries(report.byType).sort((a, b) => b[1] - a[1]);
    for (const [t, n] of sortedTypes) console.log(`  ${t.padEnd(40)} ${n}`);

    console.log('\n=== TOP 15 CRITICAL ===');
    const critical = report.bundles
        .flatMap(b => b.issues.filter(i => i.severity === 'CRITICAL').map(i => ({ ...i, product: b.product })));
    for (const i of critical.slice(0, 15)) {
        console.log(`  [${i.product}] ${i.type}: ${i.msg}`);
    }
    if (critical.length > 15) console.log(`  … (+${critical.length - 15} mas en el JSON)`);
}

main().catch(err => {
    console.error('FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
});

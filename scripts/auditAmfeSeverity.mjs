/**
 * AMFE Severity Audit Script
 *
 * Checks ALL AMFE documents in Supabase for:
 * 1. Severity calibration (S=9-10 only for safety/flammability/VOC/airbag/sharp edges)
 * 2. CC/SC classification correctness and percentages
 * 3. AP=H without actions
 * 4. AP recalculation using official AIAG-VDA lookup table
 *
 * Handles two data schemas:
 *   Schema A (PWA + IP PADs): fail.severity, cause.cause, cause.ap
 *   Schema B (VWA):           cause.severity, cause.description, cause.actionPriority
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Read env from .env.local ──────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
}

// ── Login to get authenticated session ────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const loginEmail = env.VITE_AUTO_LOGIN_EMAIL;
const loginPass = env.VITE_AUTO_LOGIN_PASSWORD;
if (loginEmail && loginPass) {
    const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPass,
    });
    if (error) {
        console.error('Auth failed:', error.message);
        process.exit(1);
    }
}

// ── AP Lookup Table (copied from modules/amfe/apTable.ts) ─────────
function apRule(s, o, d) {
    if (s <= 1) return 'L';
    if (s <= 3) {
        if (o >= 8 && d >= 5) return 'M';
        return 'L';
    }
    if (s <= 6) {
        if (o >= 8) return d >= 5 ? 'H' : 'M';
        if (o >= 6) return d >= 2 ? 'M' : 'L';
        if (o >= 4) return d >= 7 ? 'M' : 'L';
        return 'L';
    }
    if (s <= 8) {
        if (o >= 8) return 'H';
        if (o >= 6) return d >= 2 ? 'H' : 'M';
        if (o >= 4) return d >= 7 ? 'H' : 'M';
        if (o >= 2) return d >= 5 ? 'M' : 'L';
        return 'L';
    }
    // S = 9-10
    if (o >= 6) return 'H';
    if (o >= 4) return d >= 2 ? 'H' : 'M';
    if (o >= 2) {
        if (d >= 7) return 'H';
        if (d >= 5) return 'M';
        return 'L';
    }
    return 'L';
}

function calculateAP(s, o, d) {
    if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
    const sInt = Math.round(s);
    const oInt = Math.round(o);
    const dInt = Math.round(d);
    if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
    return apRule(sInt, oInt, dInt);
}

// ── Keywords for S=9-10 legitimacy ────────────────────────────────
const HIGH_SEV_KEYWORDS = [
    'flamabilidad', 'flamable', 'inflamab', 'tl 1010', 'tl1010',
    'voc', 'emisiones', 'emision',
    'airbag',
    'borde filoso', 'bordes filosos', 'filo', 'cortante',
    'seguridad del usuario', 'seguridad usuario final',
    'safety', 'legal', 'normativa', 'regulacion',
    'quemadura', 'incendio', 'toxico', 'toxicidad',
];

// Keywords indicating operator safety (not end-user)
const OPERATOR_SAFETY_KEYWORDS = [
    'operador', 'operario', 'mano de obra', 'ergonomia', 'ergonomico',
    'epp', 'lesion del operador', 'riesgo operador', 'atrapamiento',
    'quitar pieza', 'manipuleo', 'carga manual',
];

function textMatchesAny(text, keywords) {
    const lower = (text || '').toLowerCase();
    return keywords.some(kw => lower.includes(kw));
}

// ── Normalize cause/failure fields across both schemas ────────────
function getCauseText(cause) {
    // Schema A: cause.cause, Schema B: cause.description
    return cause.cause || cause.description || '';
}

function getSeverity(fail, cause) {
    // Schema A: severity on failure, Schema B: severity on cause
    const failSev = Number(fail.severity);
    const causeSev = Number(cause.severity);
    if (!isNaN(causeSev) && causeSev >= 1) return causeSev;
    if (!isNaN(failSev) && failSev >= 1) return failSev;
    return NaN;
}

function getAP(cause) {
    // Schema A: cause.ap, Schema B: cause.actionPriority
    return ((cause.ap || cause.actionPriority || '') + '').toUpperCase();
}

function getOpLabel(op) {
    const num = op.opNumber || op.operationNumber || '?';
    const name = op.name || op.operationName || '?';
    return `OP ${num} "${name}"`;
}

// ── Fetch all AMFE documents ──────────────────────────────────────
const { data: docs, error: fetchErr } = await supabase
    .from('amfe_documents')
    .select('id, project_name, subject, amfe_number, part_number, data')
    .order('project_name');

if (fetchErr) {
    console.error('Failed to fetch AMFE documents:', fetchErr.message);
    process.exit(1);
}

if (!docs || docs.length === 0) {
    console.log('No AMFE documents found.');
    process.exit(0);
}

console.log(`\n${'='.repeat(90)}`);
console.log(`  AMFE SEVERITY AUDIT — ${new Date().toISOString().slice(0, 10)}`);
console.log(`  Documents found: ${docs.length}`);
console.log(`${'='.repeat(90)}\n`);

// ── Audit each document ───────────────────────────────────────────
let globalSummary = {
    totalDocs: docs.length,
    totalCauses: 0,
    sevCalibrationIssues: 0,
    ccScIssues: 0,
    apHNoAction: 0,
    apMismatches: 0,
    docsWithIssues: 0,
};

for (const doc of docs) {
    const docLabel = [doc.project_name, doc.subject, doc.part_number].filter(Boolean).join(' | ') || doc.amfe_number || 'Unnamed';
    let data = doc.data;
    // Handle string-serialized data
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { /* ignore */ }
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.operations)) {
        console.log(`[SKIP] "${docLabel}" (id=${doc.id}) — data is invalid or missing operations array`);
        continue;
    }

    const issues = {
        severityCalibration: [],
        ccScClassification: [],
        apHNoAction: [],
        apMismatch: [],
    };

    let totalCauses = 0;
    let ccCount = 0;
    let scCount = 0;
    let standardCount = 0;
    let ccOperatorSafety = [];
    let causesWithRatings = 0;

    for (const op of data.operations) {
        const opLabel = getOpLabel(op);

        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const failDesc = fail.description || '';
                    const effectLocal = fail.effectLocal || '';
                    const effectNextLevel = fail.effectNextLevel || '';
                    const effectEndUser = fail.effectEndUser || '';

                    for (const cause of (fail.causes || [])) {
                        totalCauses++;
                        const sev = getSeverity(fail, cause);
                        const o = Number(cause.occurrence);
                        const d = Number(cause.detection);
                        const ap = getAP(cause);
                        const causeDesc = getCauseText(cause);
                        const specialChar = (cause.specialChar || '').toUpperCase();
                        const allText = `${failDesc} ${effectLocal} ${effectNextLevel} ${effectEndUser} ${causeDesc}`.toLowerCase();

                        const hasRatings = !isNaN(sev) && sev >= 1 && !isNaN(o) && o >= 1 && !isNaN(d) && d >= 1;
                        if (hasRatings) causesWithRatings++;

                        // ── 1. Severity Calibration ───────────────────────
                        if (!isNaN(sev) && sev >= 9 && sev <= 10) {
                            const isHighSevLegit = textMatchesAny(allText, HIGH_SEV_KEYWORDS);
                            const isOperatorSafety = textMatchesAny(allText, OPERATOR_SAFETY_KEYWORDS);

                            if (!isHighSevLegit && !isOperatorSafety) {
                                issues.severityCalibration.push({
                                    type: 'S9-10_NOT_JUSTIFIED',
                                    op: opLabel,
                                    failure: failDesc,
                                    cause: causeDesc,
                                    severity: sev,
                                    msg: `S=${sev} not justified — no safety/flammability/VOC/airbag/sharp-edge keywords found`,
                                });
                            }

                            // Operator safety with CC is wrong
                            if (isOperatorSafety && !isHighSevLegit && specialChar === 'CC') {
                                ccOperatorSafety.push({
                                    op: opLabel,
                                    failure: failDesc,
                                    cause: causeDesc,
                                    severity: sev,
                                });
                            }
                        }

                        // Check if S=7-8 items that are clearly cosmetic (should be S=5-6)
                        const cosmeticKeywords = ['arruga', 'wrinkle', 'delamina', 'costura torcida', 'squeak', 'rattle', 'retrabajo offline'];
                        if (!isNaN(sev) && sev >= 7 && sev <= 8 && textMatchesAny(allText, cosmeticKeywords)) {
                            issues.severityCalibration.push({
                                type: 'S7-8_COSMETIC_MISMATCH',
                                op: opLabel,
                                failure: failDesc,
                                cause: causeDesc,
                                severity: sev,
                                msg: `S=${sev} but failure/cause contains cosmetic keywords (should be S=5-6)`,
                            });
                        }

                        // Check if S=5-6 items that are really clip/detachment (should be S=7-8)
                        const structuralKeywords = ['clip', 'encastre', 'desprendimiento', 'detach', 'rotura de clip', 'fijacion', 'para linea', 'parada de linea'];
                        if (!isNaN(sev) && sev >= 5 && sev <= 6 && textMatchesAny(allText, structuralKeywords)) {
                            issues.severityCalibration.push({
                                type: 'S5-6_STRUCTURAL_MISMATCH',
                                op: opLabel,
                                failure: failDesc,
                                cause: causeDesc,
                                severity: sev,
                                msg: `S=${sev} but failure/cause contains structural/clip/detachment keywords (should be S=7-8)`,
                            });
                        }

                        // Check if S=3-4 items that look like real defects (should be S=5-6)
                        const medDefectKeywords = ['delaminacion', 'delamina', 'burbuja', 'costura corrida'];
                        if (!isNaN(sev) && sev >= 3 && sev <= 4 && textMatchesAny(allText, medDefectKeywords)) {
                            issues.severityCalibration.push({
                                type: 'S3-4_UNDERRATED',
                                op: opLabel,
                                failure: failDesc,
                                cause: causeDesc,
                                severity: sev,
                                msg: `S=${sev} but failure/cause suggests medium defect (should be S=5-6)`,
                            });
                        }

                        // ── 2. CC/SC Classification ───────────────────────
                        if (specialChar === 'CC') {
                            ccCount++;
                            if (!isNaN(sev) && sev < 9) {
                                // CC with S<9 — check if it's a flammability/legal exemption
                                const exempt = textMatchesAny(allText, [
                                    'flamabilidad', 'flamable', 'tl 1010', 'voc', 'emisiones',
                                    'airbag', 'legal', 'seguridad', 'normativa',
                                ]);
                                if (!exempt) {
                                    issues.ccScClassification.push({
                                        type: 'CC_LOW_SEVERITY',
                                        op: opLabel,
                                        failure: failDesc,
                                        cause: causeDesc,
                                        severity: sev,
                                        specialChar,
                                        msg: `CC with S=${sev} (<9) and no safety/legal exemption`,
                                    });
                                }
                            }
                        } else if (specialChar === 'SC') {
                            scCount++;
                            if (!isNaN(sev) && sev < 7) {
                                issues.ccScClassification.push({
                                    type: 'SC_LOW_SEVERITY',
                                    op: opLabel,
                                    failure: failDesc,
                                    cause: causeDesc,
                                    severity: sev,
                                    specialChar,
                                    msg: `SC with S=${sev} (<7) — suspicious`,
                                });
                            }
                        } else {
                            standardCount++;
                        }

                        // ── 3. AP=H without actions ───────────────────────
                        if (ap === 'H') {
                            const hasPrevAction = (cause.preventionAction || '').trim().length > 0;
                            const hasDetAction = (cause.detectionAction || '').trim().length > 0;
                            if (!hasPrevAction && !hasDetAction) {
                                issues.apHNoAction.push({
                                    op: opLabel,
                                    failure: failDesc,
                                    cause: causeDesc,
                                    severity: sev,
                                    occurrence: o,
                                    detection: d,
                                    ap,
                                });
                            }
                        }

                        // ── 4. AP recalculation ───────────────────────────
                        if (hasRatings && ap) {
                            const expectedAP = calculateAP(sev, o, d);
                            if (expectedAP && ap !== expectedAP) {
                                issues.apMismatch.push({
                                    op: opLabel,
                                    failure: failDesc,
                                    cause: causeDesc,
                                    severity: sev,
                                    occurrence: o,
                                    detection: d,
                                    currentAP: ap,
                                    expectedAP,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // ── CC/SC percentage checks ───────────────────────────────────
    if (totalCauses > 0) {
        const ccPct = (ccCount / totalCauses) * 100;
        const scPct = (scCount / totalCauses) * 100;

        if (ccCount === 0) {
            issues.ccScClassification.push({
                type: 'CC_MISSING',
                msg: `CC% = 0% (0/${totalCauses}) — cabin interior parts MUST have at least flammability as CC`,
            });
        } else if (ccPct > 5) {
            issues.ccScClassification.push({
                type: 'CC_PERCENTAGE_HIGH',
                msg: `CC% = ${ccPct.toFixed(1)}% (${ccCount}/${totalCauses}) — benchmark is 1-5%`,
            });
        } else if (ccPct < 1) {
            issues.ccScClassification.push({
                type: 'CC_PERCENTAGE_LOW',
                msg: `CC% = ${ccPct.toFixed(1)}% (${ccCount}/${totalCauses}) — benchmark is 1-5%`,
            });
        }

        if (scCount > 0 && scPct > 15) {
            issues.ccScClassification.push({
                type: 'SC_PERCENTAGE_HIGH',
                msg: `SC% = ${scPct.toFixed(1)}% (${scCount}/${totalCauses}) — benchmark is 10-15%`,
            });
        }
        if (scCount === 0 && totalCauses >= 10) {
            issues.ccScClassification.push({
                type: 'SC_MISSING',
                msg: `SC% = 0% (0/${totalCauses}) — expected 10-15% for structural/fixation characteristics`,
            });
        } else if (scCount > 0 && scPct < 10) {
            issues.ccScClassification.push({
                type: 'SC_PERCENTAGE_LOW',
                msg: `SC% = ${scPct.toFixed(1)}% (${scCount}/${totalCauses}) — benchmark is 10-15%`,
            });
        }

        // Operator safety with CC
        for (const item of ccOperatorSafety) {
            issues.ccScClassification.push({
                type: 'CC_OPERATOR_SAFETY',
                ...item,
                msg: `CC on S=${item.severity} cause related to operator safety (not end-user) — should NOT be CC`,
            });
        }
    }

    // ── Print results for this document ───────────────────────────
    const totalIssues =
        issues.severityCalibration.length +
        issues.ccScClassification.length +
        issues.apHNoAction.length +
        issues.apMismatch.length;

    globalSummary.totalCauses += totalCauses;
    globalSummary.sevCalibrationIssues += issues.severityCalibration.length;
    globalSummary.ccScIssues += issues.ccScClassification.length;
    globalSummary.apHNoAction += issues.apHNoAction.length;
    globalSummary.apMismatches += issues.apMismatch.length;
    if (totalIssues > 0) globalSummary.docsWithIssues++;

    console.log(`${'─'.repeat(90)}`);
    console.log(`AMFE: "${docLabel}" (id: ${doc.id.slice(0, 8)}...)`);
    console.log(`  Total causes: ${totalCauses} | With S/O/D ratings: ${causesWithRatings} | CC: ${ccCount} | SC: ${scCount} | Standard: ${standardCount}`);
    if (totalCauses > 0) {
        console.log(`  CC%: ${((ccCount / totalCauses) * 100).toFixed(1)}% | SC%: ${((scCount / totalCauses) * 100).toFixed(1)}% | Std%: ${((standardCount / totalCauses) * 100).toFixed(1)}%`);
    }
    console.log(`  Issues found: ${totalIssues}`);

    if (issues.severityCalibration.length > 0) {
        console.log(`\n  [1] SEVERITY CALIBRATION (${issues.severityCalibration.length} issues):`);
        for (const iss of issues.severityCalibration) {
            console.log(`      ${iss.type} | ${iss.op}`);
            console.log(`        Failure: "${iss.failure}"`);
            console.log(`        Cause:   "${iss.cause}"`);
            console.log(`        S=${iss.severity} — ${iss.msg}`);
        }
    }

    if (issues.ccScClassification.length > 0) {
        console.log(`\n  [2] CC/SC CLASSIFICATION (${issues.ccScClassification.length} issues):`);
        for (const iss of issues.ccScClassification) {
            if (iss.op) {
                console.log(`      ${iss.type} | ${iss.op}`);
                console.log(`        Failure: "${iss.failure}"`);
                console.log(`        Cause:   "${iss.cause}"`);
                console.log(`        S=${iss.severity}, specialChar=${iss.specialChar} — ${iss.msg}`);
            } else {
                console.log(`      ${iss.type} — ${iss.msg}`);
            }
        }
    }

    if (issues.apHNoAction.length > 0) {
        console.log(`\n  [3] AP=H WITHOUT ACTIONS (${issues.apHNoAction.length} issues):`);
        for (const iss of issues.apHNoAction) {
            console.log(`      ${iss.op}`);
            console.log(`        Failure: "${iss.failure}"`);
            console.log(`        Cause:   "${iss.cause}"`);
            console.log(`        S=${iss.severity} O=${iss.occurrence} D=${iss.detection} AP=${iss.ap}`);
        }
    }

    if (issues.apMismatch.length > 0) {
        console.log(`\n  [4] AP MISMATCH (${issues.apMismatch.length} issues):`);
        for (const iss of issues.apMismatch) {
            console.log(`      ${iss.op}`);
            console.log(`        Failure: "${iss.failure}"`);
            console.log(`        Cause:   "${iss.cause}"`);
            console.log(`        S=${iss.severity} O=${iss.occurrence} D=${iss.detection} | Current AP=${iss.currentAP} | Expected AP=${iss.expectedAP}`);
        }
    }

    if (totalIssues === 0) {
        console.log(`  >>> CLEAN — no issues found <<<`);
    }
    console.log('');
}

// ── Global Summary ────────────────────────────────────────────────
const totalAll = globalSummary.sevCalibrationIssues + globalSummary.ccScIssues + globalSummary.apHNoAction + globalSummary.apMismatches;
console.log(`\n${'='.repeat(90)}`);
console.log(`  GLOBAL SUMMARY`);
console.log(`${'='.repeat(90)}`);
console.log(`  Documents audited:       ${globalSummary.totalDocs}`);
console.log(`  Documents with issues:   ${globalSummary.docsWithIssues}`);
console.log(`  Total causes analyzed:   ${globalSummary.totalCauses}`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  [1] Severity calibration:  ${globalSummary.sevCalibrationIssues} issues`);
console.log(`  [2] CC/SC classification:  ${globalSummary.ccScIssues} issues`);
console.log(`  [3] AP=H without actions:  ${globalSummary.apHNoAction} issues`);
console.log(`  [4] AP mismatches:         ${globalSummary.apMismatches} issues`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  TOTAL ISSUES:              ${totalAll}`);
console.log(`${'='.repeat(90)}\n`);

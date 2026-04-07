/**
 * _auditStructureV2.mjs — AMFE VDA Structural Integrity Audit V2
 *
 * Connects to Supabase, fetches ALL amfe_documents and audits:
 *
 *  1. VDA Structure completeness
 *     - Every operation must have >= 1 work element
 *     - Every work element must have >= 1 function
 *     - Every function must have >= 1 failure mode
 *     - Every failure mode must have all 3 effects non-empty
 *     - Every failure must have >= 1 cause
 *     - Reports which specific operations/WEs/functions have gaps
 *
 *  2. Severity calibration (VWA interior cabin parts)
 *     - S=9-10 ONLY for: flamabilidad, VOC, airbag, bordes filosos, safety
 *     - S=7-8 for encastre/clip/desprendimiento keywords
 *     - S=5-6 for arrugas/delaminacion/costura keywords
 *     - S=3-4 for cosmetic minor
 *     - Handles severity on cause.severity OR fail.severity
 *     - Flags mismatches between description keywords and severity value
 *
 *  3. AP verification with official AIAG-VDA 2019 table
 *     - Recalculates AP for every cause with S, O, D filled
 *     - Handles cause.ap OR cause.actionPriority
 *     - Handles severity on cause.severity OR fail.severity
 *     - Reports mismatches
 *
 *  EXCLUSIONS (not reported):
 *     - AP=H without actions (Fak manages personally)
 *     - CC/SC percentages or missing classifications (Fak assigns personally)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// ENV + AUTH
// ═══════════════════════════════════════════════════════════════════════════════

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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { error: authErr } = await supabase.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) {
    console.error('Auth failed:', authErr.message);
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AP LOOKUP TABLE — copied from modules/amfe/apTable.ts
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// SEVERITY KEYWORD SETS
// ═══════════════════════════════════════════════════════════════════════════════

/** S=9-10 legitimate keywords (safety/flammability/VOC/airbag/sharp edges) */
const KW_S9_10 = [
    'flamabilidad', 'flamable', 'inflamab', 'tl 1010', 'tl1010',
    'voc', 'emisiones', 'emision',
    'airbag',
    'borde filoso', 'bordes filosos', 'filo', 'cortante',
    'seguridad del usuario', 'seguridad usuario final',
    'safety', 'legal', 'normativa', 'regulacion',
    'quemadura', 'incendio', 'toxico', 'toxicidad',
];

/** S=7-8 keywords (clip/encastre/desprendimiento/parada de linea) */
const KW_S7_8 = [
    'clip', 'encastre', 'desprendimiento', 'desprendim',
    'rotura de clip', 'fijacion', 'fijaci',
    'para linea', 'parada de linea', 'detach',
    'deformacion estructural', 'interferencia de montaje',
];

/** S=5-6 keywords (arrugas/delaminacion/costura/squeak&rattle) */
const KW_S5_6 = [
    'arruga', 'arrugas', 'wrinkle',
    'delaminacion', 'delamina',
    'costura torcida', 'costura corrida', 'costura saltada',
    'squeak', 'rattle', 's&r',
    'burbuja', 'retrabajo offline',
];

/** S=3-4 keywords (cosmetic minor) */
const KW_S3_4 = [
    'hilo suelto', 'mancha limpiable', 'retrabajo in-station',
    'color desparejo', 'luz rasante', 'cosmetico menor',
    'mancha', 'marca leve',
];

function textMatchesAny(text, keywords) {
    const lower = (text || '').toLowerCase();
    return keywords.some(kw => lower.includes(kw));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA-AGNOSTIC HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Get severity — may live on cause (Schema B) or failure (Schema A) */
function getSeverity(fail, cause) {
    const causeSev = Number(cause.severity);
    const failSev = Number(fail.severity);
    if (!isNaN(causeSev) && causeSev >= 1) return causeSev;
    if (!isNaN(failSev) && failSev >= 1) return failSev;
    return NaN;
}

/** Get AP field — may be cause.ap (Schema A) or cause.actionPriority (Schema B) */
function getStoredAP(cause) {
    return ((cause.ap || cause.actionPriority || '') + '').toUpperCase().trim();
}

/** Get cause description text — may be cause.cause (A) or cause.description (B) */
function getCauseText(cause) {
    return cause.cause || cause.description || '';
}

/** Build a readable label for an operation */
function opLabel(op) {
    const num = op.operationNumber || op.opNumber || '?';
    const name = op.operationName || op.name || '?';
    return `OP ${num} "${name}"`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH ALL AMFE DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════════

const { data: rows, error: fetchErr } = await supabase
    .from('amfe_documents')
    .select('id, project_name, subject, amfe_number, part_number, data')
    .order('project_name');

if (fetchErr) {
    console.error('Failed to fetch AMFE documents:', fetchErr.message);
    process.exit(1);
}
if (!rows || rows.length === 0) {
    console.log('No AMFE documents found.');
    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AUDIT LOOP
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(100)}`);
console.log(`  AMFE VDA STRUCTURAL INTEGRITY AUDIT V2`);
console.log(`  Date: ${new Date().toISOString().slice(0, 10)}`);
console.log(`  Documents found: ${rows.length}`);
console.log(`${'='.repeat(100)}\n`);

const globalCounters = {
    totalDocs: rows.length,
    totalCauses: 0,
    // Section 1
    structureGaps: 0,
    // Section 2
    sevCalibrationFlags: 0,
    // Section 3
    apMismatches: 0,
    docsWithIssues: 0,
};

const docSummaries = [];

for (const row of rows) {
    const docLabel = [row.project_name, row.subject, row.part_number].filter(Boolean).join(' | ') || row.amfe_number || 'Unnamed';

    // Parse data
    let data = row.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { /* skip */ }
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.operations)) {
        console.log(`[SKIP] "${docLabel}" (id=${row.id}) — data invalid or missing operations`);
        docSummaries.push({ label: docLabel, id: row.id, status: 'SKIP', s1: [], s2: [], s3: [], totalCauses: 0 });
        continue;
    }

    const ops = data.operations;

    // ─── Section 1: VDA Structure completeness ─────────────────────────────
    const s1Issues = []; // structural gaps

    for (const op of ops) {
        const oL = opLabel(op);
        const wes = op.workElements || [];

        if (wes.length === 0) {
            s1Issues.push({ level: 'OP', path: oL, msg: 'has 0 work elements' });
            continue;
        }

        for (let wi = 0; wi < wes.length; wi++) {
            const we = wes[wi];
            const weDesc = we.description || we.name || we.type || `(WE #${wi + 1})`;
            const weL = `${oL} > WE "${weDesc.slice(0, 50)}"`;
            const fns = we.functions || [];

            if (fns.length === 0) {
                s1Issues.push({ level: 'WE', path: weL, msg: 'has 0 functions' });
                continue;
            }

            for (let fi = 0; fi < fns.length; fi++) {
                const fn = fns[fi];
                const fnDesc = fn.description || `(Fn #${fi + 1})`;
                const fnL = `${weL} > Fn "${fnDesc.slice(0, 45)}"`;
                const fails = fn.failures || [];

                if (fails.length === 0) {
                    s1Issues.push({ level: 'FN', path: fnL, msg: 'has 0 failure modes' });
                    continue;
                }

                for (let fli = 0; fli < fails.length; fli++) {
                    const fail = fails[fli];
                    const failDesc = fail.description || `(Fail #${fli + 1})`;
                    const failL = `${fnL} > Fail "${failDesc.slice(0, 40)}"`;

                    // 3-level VDA effects
                    const missingEffects = [];
                    if (!fail.effectLocal || fail.effectLocal.trim() === '') missingEffects.push('effectLocal');
                    if (!fail.effectNextLevel || fail.effectNextLevel.trim() === '') missingEffects.push('effectNextLevel');
                    if (!fail.effectEndUser || fail.effectEndUser.trim() === '') missingEffects.push('effectEndUser');
                    if (missingEffects.length > 0) {
                        s1Issues.push({ level: 'FAIL', path: failL, msg: `missing effects: ${missingEffects.join(', ')}` });
                    }

                    // At least 1 cause
                    const causes = fail.causes || [];
                    if (causes.length === 0) {
                        s1Issues.push({ level: 'FAIL', path: failL, msg: 'has 0 causes' });
                    }
                }
            }
        }
    }

    // ─── Section 2: Severity calibration ───────────────────────────────────
    const s2Issues = []; // severity keyword/value mismatches

    for (const op of ops) {
        const oL = opLabel(op);
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const failDesc = fail.description || '';
                    const effectLocal = fail.effectLocal || '';
                    const effectNextLevel = fail.effectNextLevel || '';
                    const effectEndUser = fail.effectEndUser || '';

                    for (const cause of (fail.causes || [])) {
                        const sev = getSeverity(fail, cause);
                        if (isNaN(sev) || sev < 1) continue;

                        const causeDesc = getCauseText(cause);
                        const allText = `${failDesc} ${effectLocal} ${effectNextLevel} ${effectEndUser} ${causeDesc}`;

                        const matchesS9_10 = textMatchesAny(allText, KW_S9_10);
                        const matchesS7_8 = textMatchesAny(allText, KW_S7_8);
                        const matchesS5_6 = textMatchesAny(allText, KW_S5_6);
                        const matchesS3_4 = textMatchesAny(allText, KW_S3_4);

                        const loc = `${oL} | Fail: "${failDesc.slice(0, 50)}" | Cause: "${causeDesc.slice(0, 50)}"`;

                        // S=9-10 but no safety keywords
                        if (sev >= 9 && sev <= 10 && !matchesS9_10) {
                            s2Issues.push({
                                tag: 'S9-10_NO_SAFETY_KW',
                                loc,
                                sev,
                                msg: `S=${sev} but no flamabilidad/VOC/airbag/borde filoso/safety keywords found`,
                            });
                        }

                        // S=7-8 but text has cosmetic keywords (arrugas/delam) suggesting S=5-6
                        if (sev >= 7 && sev <= 8 && matchesS5_6 && !matchesS7_8) {
                            s2Issues.push({
                                tag: 'S7-8_COSMETIC_DOWNGRADE',
                                loc,
                                sev,
                                msg: `S=${sev} but text matches cosmetic/delam keywords (expected S=5-6)`,
                            });
                        }

                        // S=5-6 but text has clip/encastre/desprendimiento keywords suggesting S=7-8
                        if (sev >= 5 && sev <= 6 && matchesS7_8 && !matchesS5_6) {
                            s2Issues.push({
                                tag: 'S5-6_STRUCTURAL_UPGRADE',
                                loc,
                                sev,
                                msg: `S=${sev} but text matches encastre/clip/desprendimiento keywords (expected S=7-8)`,
                            });
                        }

                        // S=3-4 but text has medium-defect keywords (delam/burbuja) suggesting S=5-6
                        if (sev >= 3 && sev <= 4 && matchesS5_6 && !matchesS3_4) {
                            s2Issues.push({
                                tag: 'S3-4_UNDERRATED',
                                loc,
                                sev,
                                msg: `S=${sev} but text matches medium defect keywords (expected S=5-6)`,
                            });
                        }

                        // S=5-6 but text has safety keywords suggesting S=9-10
                        if (sev >= 5 && sev <= 6 && matchesS9_10 && !matchesS5_6 && !matchesS7_8) {
                            s2Issues.push({
                                tag: 'S5-6_SAFETY_UNDERRATED',
                                loc,
                                sev,
                                msg: `S=${sev} but text matches safety/flammability keywords (expected S=9-10)`,
                            });
                        }

                        // S=7-8 but text has safety keywords suggesting S=9-10
                        if (sev >= 7 && sev <= 8 && matchesS9_10 && !matchesS7_8) {
                            s2Issues.push({
                                tag: 'S7-8_SAFETY_UNDERRATED',
                                loc,
                                sev,
                                msg: `S=${sev} but text matches safety/flammability keywords (expected S=9-10)`,
                            });
                        }

                        // S=1-2 with any defect keyword is suspicious
                        if (sev >= 1 && sev <= 2 && (matchesS5_6 || matchesS7_8 || matchesS9_10)) {
                            s2Issues.push({
                                tag: 'S1-2_SUSPICIOUS',
                                loc,
                                sev,
                                msg: `S=${sev} but text contains defect/structural/safety keywords — likely underrated`,
                            });
                        }
                    }
                }
            }
        }
    }

    // ─── Section 3: AP verification ────────────────────────────────────────
    const s3Issues = []; // AP mismatches
    let totalCausesInDoc = 0;

    for (const op of ops) {
        const oL = opLabel(op);
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const failDesc = fail.description || '';
                    for (const cause of (fail.causes || [])) {
                        totalCausesInDoc++;
                        const sev = getSeverity(fail, cause);
                        const o = Number(cause.occurrence);
                        const d = Number(cause.detection);
                        const storedAP = getStoredAP(cause);
                        const causeDesc = getCauseText(cause);

                        const hasFullRatings = !isNaN(sev) && sev >= 1 && !isNaN(o) && o >= 1 && !isNaN(d) && d >= 1;
                        if (!hasFullRatings) continue;
                        if (!storedAP) continue; // no stored AP to compare against

                        const expected = calculateAP(sev, o, d);
                        if (!expected) continue;

                        if (storedAP !== expected) {
                            s3Issues.push({
                                loc: `${oL} | Fail: "${failDesc.slice(0, 50)}" | Cause: "${causeDesc.slice(0, 50)}"`,
                                sev,
                                occ: o,
                                det: d,
                                stored: storedAP,
                                expected,
                            });
                        }
                    }
                }
            }
        }
    }

    globalCounters.totalCauses += totalCausesInDoc;
    globalCounters.structureGaps += s1Issues.length;
    globalCounters.sevCalibrationFlags += s2Issues.length;
    globalCounters.apMismatches += s3Issues.length;
    const hasAnyIssue = s1Issues.length + s2Issues.length + s3Issues.length > 0;
    if (hasAnyIssue) globalCounters.docsWithIssues++;

    docSummaries.push({
        label: docLabel,
        id: row.id,
        status: hasAnyIssue ? 'ISSUES' : 'CLEAN',
        s1: s1Issues,
        s2: s2Issues,
        s3: s3Issues,
        totalCauses: totalCausesInDoc,
    });

    // ─── Print per-document report ─────────────────────────────────────────
    console.log(`${'─'.repeat(100)}`);
    console.log(`AMFE: "${docLabel}"`);
    console.log(`  ID: ${row.id}  |  Causes: ${totalCausesInDoc}  |  Operations: ${ops.length}`);

    if (s1Issues.length === 0 && s2Issues.length === 0 && s3Issues.length === 0) {
        console.log(`  >>> CLEAN — no issues found <<<`);
        console.log('');
        continue;
    }

    // Section 1 detail
    if (s1Issues.length > 0) {
        console.log(`\n  [1] VDA STRUCTURE GAPS (${s1Issues.length}):`);
        for (const iss of s1Issues) {
            console.log(`      [${iss.level}] ${iss.path}`);
            console.log(`            -> ${iss.msg}`);
        }
    }

    // Section 2 detail
    if (s2Issues.length > 0) {
        console.log(`\n  [2] SEVERITY CALIBRATION (${s2Issues.length}):`);
        for (const iss of s2Issues) {
            console.log(`      [${iss.tag}] S=${iss.sev}`);
            console.log(`            ${iss.loc}`);
            console.log(`            -> ${iss.msg}`);
        }
    }

    // Section 3 detail
    if (s3Issues.length > 0) {
        console.log(`\n  [3] AP MISMATCH (${s3Issues.length}):`);
        for (const iss of s3Issues) {
            console.log(`      S=${iss.sev} O=${iss.occ} D=${iss.det}  |  stored=${iss.stored}  expected=${iss.expected}`);
            console.log(`            ${iss.loc}`);
        }
    }

    console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(100)}`);
console.log(`  FINAL SUMMARY`);
console.log(`${'='.repeat(100)}`);
console.log(`  Documents audited:          ${globalCounters.totalDocs}`);
console.log(`  Documents with issues:      ${globalCounters.docsWithIssues}`);
console.log(`  Total causes analyzed:      ${globalCounters.totalCauses}`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  [1] VDA structure gaps:     ${globalCounters.structureGaps}`);
console.log(`  [2] Severity calibration:   ${globalCounters.sevCalibrationFlags}`);
console.log(`  [3] AP mismatches:          ${globalCounters.apMismatches}`);
console.log(`  ─────────────────────────────────────────`);
const totalAll = globalCounters.structureGaps + globalCounters.sevCalibrationFlags + globalCounters.apMismatches;
console.log(`  TOTAL ISSUES:               ${totalAll}`);
console.log('');

// Per-document summary table
const COL = { name: 50, causes: 8, s1: 5, s2: 5, s3: 5, status: 8 };
console.log(
    'Document'.padEnd(COL.name) +
    'Causes'.padStart(COL.causes) +
    '  S1'.padStart(COL.s1) +
    '  S2'.padStart(COL.s2) +
    '  S3'.padStart(COL.s3) +
    'Status'.padStart(COL.status)
);
console.log('─'.repeat(COL.name + COL.causes + COL.s1 + COL.s2 + COL.s3 + COL.status));

for (const d of docSummaries) {
    const name = d.label.length > COL.name - 1 ? d.label.slice(0, COL.name - 4) + '...' : d.label;
    console.log(
        name.padEnd(COL.name) +
        String(d.totalCauses).padStart(COL.causes) +
        String(d.s1.length).padStart(COL.s1) +
        String(d.s2.length).padStart(COL.s2) +
        String(d.s3.length).padStart(COL.s3) +
        d.status.padStart(COL.status)
    );
}

console.log('');
const cleanCount = docSummaries.filter(d => d.status === 'CLEAN').length;
const issueCount = docSummaries.filter(d => d.status === 'ISSUES').length;
const skipCount = docSummaries.filter(d => d.status === 'SKIP').length;
console.log(`  CLEAN: ${cleanCount}  |  ISSUES: ${issueCount}  |  SKIPPED: ${skipCount}`);
console.log(`  Overall: ${issueCount === 0 ? 'PASS' : 'NEEDS ATTENTION'}`);
console.log(`${'='.repeat(100)}\n`);

process.exit(issueCount === 0 ? 0 : 1);

/**
 * _auditInsert.mjs — Audit script for Insert Patagonia AMFE
 * ID: 7cfe2db7-9e5a-4b46-804d-76194557c581
 *
 * Checks:
 *  1. VDA Structure: every OP has WEs, every WE has valid type + name
 *  2. 1M per line: no WE with " / " in name
 *  3. Spanish + UPPERCASE names
 *  4. S/O/D complete: every cause has all 3 (1-10), none is 0
 *  5. VDA 3-level effects: effectLocal / effectNextLevel / effectEndUser
 *  6. AP recalculation with official table
 *  7. Severity calibration: S=9-10 only for safety/flamabilidad/airbag
 *  8. No "Capacitacion" as cause
 *  9. focusElementFunction on every OP
 * 10. Metadata sync: operation_count, cause_count
 * 11. No WIP/ALMACENAMIENTO operation
 *
 * EXCLUSIONS: AP=H without actions, CC/SC — NOT reported as problems.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// ═══════════════════════════════════════════════════════════════════════════════
// ENV + AUTH (pattern from task spec)
// ═══════════════════════════════════════════════════════════════════════════════

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
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
// SEVERITY KEYWORDS
// ═══════════════════════════════════════════════════════════════════════════════

const KW_S9_10 = [
    'flamabilidad', 'flamable', 'inflamab', 'tl 1010', 'tl1010',
    'voc', 'emisiones', 'emision',
    'airbag',
    'borde filoso', 'bordes filosos', 'filo', 'cortante',
    'seguridad del usuario', 'seguridad usuario final',
    'safety', 'legal', 'normativa', 'regulacion',
    'quemadura', 'incendio', 'toxico', 'toxicidad',
];

function textMatchesAny(text, keywords) {
    const lower = (text || '').toLowerCase();
    return keywords.some(kw => lower.includes(kw));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENGLISH KEYWORDS TO DETECT
// ═══════════════════════════════════════════════════════════════════════════════

// English words to flag in OP names (exclude words that are also valid Spanish: "control", "final", "material", "inspector")
const ENGLISH_WORDS = [
    'machine', 'method', 'environment', 'measurement',
    'operator', 'worker', 'trimming', 'cutting', 'welding',
    'assembly', 'inspection', 'storage', 'transport', 'packaging',
    'edge folding', 'molding', 'injection',
    'quality', 'reception',
];

// Valid 6M types (English canonical per TypeScript schema)
const VALID_WE_TYPES = ['Machine', 'Man', 'Method', 'Material', 'Measurement', 'Environment'];

// Spanish equivalents (accepted but should be normalized)
const SPANISH_WE_TYPE_MAP = {
    'Maquina': 'Machine', 'Máquina': 'Machine',
    'Mano de Obra': 'Man',
    'Material': 'Material',
    'Metodo': 'Method', 'Método': 'Method',
    'Medio Ambiente': 'Environment',
    'Medicion': 'Measurement', 'Medición': 'Measurement',
};

// Capacitacion keywords to flag as cause
const CAPACITACION_KW = [
    'capacitacion', 'capacitación', 'entrenamiento',
    'falta de capacitacion', 'falta de capacitación',
    'operario no capacitado', 'falta de entrenamiento',
    'no capacitado', 'personal no capacitado',
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getSeverity(fail, cause) {
    const causeSev = Number(cause.severity);
    const failSev = Number(fail.severity);
    if (!isNaN(causeSev) && causeSev >= 1) return causeSev;
    if (!isNaN(failSev) && failSev >= 1) return failSev;
    return NaN;
}

function getStoredAP(cause) {
    return ((cause.ap || cause.actionPriority || '') + '').toUpperCase().trim();
}

function getCauseText(cause) {
    return cause.cause || cause.description || '';
}

function opLabel(op) {
    const num = op.operationNumber || op.opNumber || '?';
    const name = op.operationName || op.name || '?';
    return `OP ${num} "${name}"`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH INSERT PATAGONIA AMFE
// ═══════════════════════════════════════════════════════════════════════════════

const AMFE_ID = '7cfe2db7-9e5a-4b46-804d-76194557c581';

const { data: row, error: fetchErr } = await supabase
    .from('amfe_documents')
    .select('id, project_name, subject, amfe_number, part_number, data, operation_count, cause_count')
    .eq('id', AMFE_ID)
    .single();

if (fetchErr) {
    console.error('Failed to fetch AMFE:', fetchErr.message);
    process.exit(1);
}
if (!row) {
    console.error('AMFE not found:', AMFE_ID);
    process.exit(1);
}

// Parse data (column is TEXT)
let data = row.data;
if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) {
        console.error('BLOCKER: data column is string but JSON.parse failed:', e.message);
        process.exit(1);
    }
}
if (!data || typeof data !== 'object' || !Array.isArray(data.operations)) {
    console.error('BLOCKER: data.operations is not an array');
    process.exit(1);
}

const ops = data.operations;
const docLabel = [row.project_name, row.subject, row.part_number].filter(Boolean).join(' | ') || 'Insert Patagonia';

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS COLLECTOR
// ═══════════════════════════════════════════════════════════════════════════════

const BLOCKERS = [];
const WARNINGS = [];
const PASS = [];
const INFO = [];

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 1: VDA Structure — every OP has WEs, every WE has valid type + name
// ═══════════════════════════════════════════════════════════════════════════════

let check1Blockers = 0;
let check1Warnings = 0;
for (const op of ops) {
    const oL = opLabel(op);
    const wes = op.workElements || [];
    if (wes.length === 0) {
        BLOCKERS.push(`[C1-STRUCTURE] ${oL} — has 0 work elements`);
        check1Blockers++;
        continue;
    }
    for (let i = 0; i < wes.length; i++) {
        const we = wes[i];
        const weName = we.name || we.description || '';
        const weType = we.type || '';
        if (!weName.trim()) {
            BLOCKERS.push(`[C1-STRUCTURE] ${oL} > WE #${i + 1} — name is empty`);
            check1Blockers++;
        }
        if (!VALID_WE_TYPES.includes(weType)) {
            // Check if it's a known Spanish equivalent
            if (SPANISH_WE_TYPE_MAP[weType]) {
                WARNINGS.push(`[C1-STRUCTURE] ${oL} > WE "${weName.slice(0, 40)}" — type "${weType}" is Spanish (should be "${SPANISH_WE_TYPE_MAP[weType]}" per schema)`);
                check1Warnings++;
            } else {
                BLOCKERS.push(`[C1-STRUCTURE] ${oL} > WE "${weName.slice(0, 40)}" — invalid type "${weType}" (expected: ${VALID_WE_TYPES.join(', ')})`);
                check1Blockers++;
            }
        }
    }
}
if (check1Blockers === 0 && check1Warnings === 0) {
    PASS.push(`[C1-STRUCTURE] All ${ops.length} operations have WEs with valid type and name`);
} else {
    if (check1Blockers > 0) INFO.push(`[C1-STRUCTURE] ${check1Blockers} blockers found`);
    if (check1Warnings > 0) INFO.push(`[C1-STRUCTURE] ${check1Warnings} WEs with Spanish type names (should normalize to English enum)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 2: 1M per line — no WE with " / " in name
// ═══════════════════════════════════════════════════════════════════════════════

let check2Issues = 0;
for (const op of ops) {
    const oL = opLabel(op);
    for (const we of (op.workElements || [])) {
        const weName = we.name || we.description || '';
        if (weName.includes(' / ')) {
            BLOCKERS.push(`[C2-1M] ${oL} > WE "${weName.slice(0, 60)}" — contains " / " (must be 1 material per line)`);
            check2Issues++;
        }
    }
}
if (check2Issues === 0) {
    PASS.push(`[C2-1M] No WEs with grouped materials (" / " pattern)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 3: Spanish + UPPERCASE names
// ═══════════════════════════════════════════════════════════════════════════════

let check3Issues = 0;
for (const op of ops) {
    const opName = op.operationName || op.name || '';
    const oL = opLabel(op);

    // Check UPPERCASE
    if (opName !== opName.toUpperCase()) {
        WARNINGS.push(`[C3-NAMING] ${oL} — name is not fully UPPERCASE: "${opName}"`);
        check3Issues++;
    }

    // Check for English words in operation name (only check OP names, not WE names which have valid English type prefixes)
    const opLower = opName.toLowerCase();
    for (const ew of ENGLISH_WORDS) {
        // Only flag if the English word forms a significant part (not a substring of a Spanish word)
        if (opLower === ew || opLower.includes(` ${ew} `) || opLower.startsWith(`${ew} `) || opLower.endsWith(` ${ew}`)) {
            WARNINGS.push(`[C3-NAMING] ${oL} — possible English word "${ew}" in name`);
            check3Issues++;
            break;
        }
    }
}
if (check3Issues === 0) {
    PASS.push(`[C3-NAMING] All operation names are UPPERCASE and in Spanish`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 4: S/O/D complete — every cause has all 3 (1-10), none is 0
// ═══════════════════════════════════════════════════════════════════════════════

let check4Issues = 0;
let totalCauses = 0;
for (const op of ops) {
    const oL = opLabel(op);
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                for (const cause of (fail.causes || [])) {
                    totalCauses++;
                    const causeText = getCauseText(cause);
                    const s = getSeverity(fail, cause);
                    const o = Number(cause.occurrence);
                    const d = Number(cause.detection);

                    const missing = [];
                    if (isNaN(s) || s < 1 || s > 10) missing.push(`S=${cause.severity ?? 'empty'}`);
                    if (isNaN(o) || o < 1 || o > 10) missing.push(`O=${cause.occurrence ?? 'empty'}`);
                    if (isNaN(d) || d < 1 || d > 10) missing.push(`D=${cause.detection ?? 'empty'}`);

                    // Explicit check for 0 values
                    if (s === 0) missing.push('S=0');
                    if (o === 0) missing.push('O=0');
                    if (d === 0) missing.push('D=0');

                    if (missing.length > 0) {
                        BLOCKERS.push(`[C4-SOD] ${oL} | Cause: "${causeText.slice(0, 50)}" — incomplete: ${missing.join(', ')}`);
                        check4Issues++;
                    }
                }
            }
        }
    }
}
if (check4Issues === 0) {
    PASS.push(`[C4-SOD] All ${totalCauses} causes have complete S/O/D (1-10)`);
} else {
    INFO.push(`[C4-SOD] ${check4Issues} causes with incomplete S/O/D out of ${totalCauses}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 5: VDA 3-level effects — effectLocal / effectNextLevel / effectEndUser
// ═══════════════════════════════════════════════════════════════════════════════

let check5Issues = 0;
let totalFailuresWithCauses = 0;
for (const op of ops) {
    const oL = opLabel(op);
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                if (!fail.causes || fail.causes.length === 0) continue;
                totalFailuresWithCauses++;

                const failDesc = fail.description || '(sin descripcion)';
                const missingEffects = [];
                if (!fail.effectLocal || fail.effectLocal.trim() === '') missingEffects.push('effectLocal');
                if (!fail.effectNextLevel || fail.effectNextLevel.trim() === '') missingEffects.push('effectNextLevel');
                if (!fail.effectEndUser || fail.effectEndUser.trim() === '') missingEffects.push('effectEndUser');

                if (missingEffects.length > 0) {
                    BLOCKERS.push(`[C5-EFFECTS] ${oL} > Fail "${failDesc.slice(0, 50)}" — missing: ${missingEffects.join(', ')}`);
                    check5Issues++;
                }
            }
        }
    }
}
if (check5Issues === 0) {
    PASS.push(`[C5-EFFECTS] All ${totalFailuresWithCauses} failure modes with causes have 3-level VDA effects`);
} else {
    INFO.push(`[C5-EFFECTS] ${check5Issues} failures with incomplete effects out of ${totalFailuresWithCauses}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 6: AP recalculation with official table
// ═══════════════════════════════════════════════════════════════════════════════

let check6Issues = 0;
let causesWithAP = 0;
for (const op of ops) {
    const oL = opLabel(op);
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                for (const cause of (fail.causes || [])) {
                    const s = getSeverity(fail, cause);
                    const o = Number(cause.occurrence);
                    const d = Number(cause.detection);
                    const storedAP = getStoredAP(cause);

                    if (isNaN(s) || s < 1 || isNaN(o) || o < 1 || isNaN(d) || d < 1) continue;
                    const expected = calculateAP(s, o, d);
                    if (!expected) continue;
                    causesWithAP++;

                    if (storedAP && storedAP !== expected) {
                        const causeText = getCauseText(cause);
                        BLOCKERS.push(`[C6-AP] ${oL} | Cause: "${causeText.slice(0, 50)}" — S=${s} O=${o} D=${d} stored=${storedAP} expected=${expected}`);
                        check6Issues++;
                    } else if (!storedAP) {
                        const causeText = getCauseText(cause);
                        WARNINGS.push(`[C6-AP] ${oL} | Cause: "${causeText.slice(0, 50)}" — S=${s} O=${o} D=${d} AP is empty (expected ${expected})`);
                        check6Issues++;
                    }
                }
            }
        }
    }
}
if (check6Issues === 0) {
    PASS.push(`[C6-AP] All ${causesWithAP} APs match official AIAG-VDA 2019 table`);
} else {
    INFO.push(`[C6-AP] ${check6Issues} AP issues out of ${causesWithAP} causes with full S/O/D`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 7: Severity calibration — S=9-10 only for safety keywords
// ═══════════════════════════════════════════════════════════════════════════════

let check7Issues = 0;
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
                    if (isNaN(sev) || sev < 9) continue;

                    const causeText = getCauseText(cause);
                    const allText = `${failDesc} ${effectLocal} ${effectNextLevel} ${effectEndUser} ${causeText}`;

                    if (!textMatchesAny(allText, KW_S9_10)) {
                        WARNINGS.push(`[C7-SEV] ${oL} | Fail: "${failDesc.slice(0, 40)}" | Cause: "${causeText.slice(0, 40)}" — S=${sev} without safety/flamabilidad keywords`);
                        check7Issues++;
                    }
                }
            }
        }
    }
}
if (check7Issues === 0) {
    PASS.push(`[C7-SEV] All S=9-10 ratings have appropriate safety/flamabilidad keywords`);
} else {
    INFO.push(`[C7-SEV] ${check7Issues} causes with S=9-10 but no safety keywords`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 8: No "Capacitacion" as cause
// ═══════════════════════════════════════════════════════════════════════════════

let check8Issues = 0;
for (const op of ops) {
    const oL = opLabel(op);
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                for (const cause of (fail.causes || [])) {
                    const causeText = getCauseText(cause);
                    const lower = causeText.toLowerCase();
                    for (const kw of CAPACITACION_KW) {
                        if (lower.includes(kw)) {
                            BLOCKERS.push(`[C8-CAPACITACION] ${oL} | Cause: "${causeText.slice(0, 60)}" — uses "Capacitacion" as cause (IATF 16949 assumes trained operators)`);
                            check8Issues++;
                            break;
                        }
                    }
                }
            }
        }
    }
}
if (check8Issues === 0) {
    PASS.push(`[C8-CAPACITACION] No causes use "Capacitacion/Entrenamiento" as root cause`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 9: focusElementFunction on every OP
// ═══════════════════════════════════════════════════════════════════════════════

let check9Issues = 0;
for (const op of ops) {
    const oL = opLabel(op);
    const wes = op.workElements || [];
    if (wes.length === 0) continue; // already flagged in C1

    const fef = op.focusElementFunction || '';
    if (!fef.trim()) {
        BLOCKERS.push(`[C9-FEF] ${oL} — focusElementFunction is empty`);
        check9Issues++;
    }
}
if (check9Issues === 0) {
    PASS.push(`[C9-FEF] All operations with WEs have focusElementFunction populated`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 10: Metadata sync — operation_count, cause_count
// ═══════════════════════════════════════════════════════════════════════════════

let check10Issues = 0;
const actualOpCount = ops.length;
const actualCauseCount = totalCauses;

const storedOpCount = row.operation_count;
const storedCauseCount = row.cause_count;

if (storedOpCount !== actualOpCount) {
    BLOCKERS.push(`[C10-META] operation_count mismatch: stored=${storedOpCount} actual=${actualOpCount}`);
    check10Issues++;
}
if (storedCauseCount !== actualCauseCount) {
    BLOCKERS.push(`[C10-META] cause_count mismatch: stored=${storedCauseCount} actual=${actualCauseCount}`);
    check10Issues++;
}
if (check10Issues === 0) {
    PASS.push(`[C10-META] Metadata in sync: operation_count=${actualOpCount}, cause_count=${actualCauseCount}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 11: No OP WIP/ALMACENAMIENTO
// ═══════════════════════════════════════════════════════════════════════════════

let check11Issues = 0;
const WIP_KW = ['almacenamiento', 'almacenado', 'wip', 'almacen wip', 'almacenamiento wip'];
for (const op of ops) {
    const opName = (op.operationName || op.name || '').toLowerCase();
    for (const kw of WIP_KW) {
        if (opName.includes(kw)) {
            BLOCKERS.push(`[C11-WIP] ${opLabel(op)} — ALMACENAMIENTO/WIP operations should not exist in AMFE`);
            check11Issues++;
            break;
        }
    }
}
if (check11Issues === 0) {
    PASS.push(`[C11-WIP] No ALMACENAMIENTO/WIP operations found`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(100)}`);
console.log(`  AUDIT: Insert Patagonia AMFE`);
console.log(`  Document: ${docLabel}`);
console.log(`  ID: ${AMFE_ID}`);
console.log(`  Date: ${new Date().toISOString().slice(0, 10)}`);
console.log(`  Operations: ${ops.length} | WEs: ${ops.reduce((sum, op) => sum + (op.workElements || []).length, 0)} | Causes: ${totalCauses}`);
console.log(`${'='.repeat(100)}\n`);

// BLOCKERS
if (BLOCKERS.length > 0) {
    console.log(`${'!'.repeat(80)}`);
    console.log(`  BLOCKERS (${BLOCKERS.length}) — must fix before approval`);
    console.log(`${'!'.repeat(80)}`);
    for (const b of BLOCKERS) {
        console.log(`  ${b}`);
    }
    console.log('');
}

// WARNINGS
if (WARNINGS.length > 0) {
    console.log(`${'~'.repeat(80)}`);
    console.log(`  WARNINGS (${WARNINGS.length}) — review with APQP team`);
    console.log(`${'~'.repeat(80)}`);
    for (const w of WARNINGS) {
        console.log(`  ${w}`);
    }
    console.log('');
}

// PASS
if (PASS.length > 0) {
    console.log(`${'-'.repeat(80)}`);
    console.log(`  PASS (${PASS.length})`);
    console.log(`${'-'.repeat(80)}`);
    for (const p of PASS) {
        console.log(`  ${p}`);
    }
    console.log('');
}

// INFO
if (INFO.length > 0) {
    console.log(`${'-'.repeat(80)}`);
    console.log(`  INFO`);
    console.log(`${'-'.repeat(80)}`);
    for (const i of INFO) {
        console.log(`  ${i}`);
    }
    console.log('');
}

// SUMMARY
console.log(`${'='.repeat(100)}`);
console.log(`  SUMMARY`);
console.log(`  Blockers:  ${BLOCKERS.length}`);
console.log(`  Warnings:  ${WARNINGS.length}`);
console.log(`  Passed:    ${PASS.length}`);
console.log(`  Verdict:   ${BLOCKERS.length === 0 ? 'PASS' : 'FAIL — blockers must be resolved'}`);
console.log(`${'='.repeat(100)}\n`);

process.exit(BLOCKERS.length === 0 ? 0 : 1);

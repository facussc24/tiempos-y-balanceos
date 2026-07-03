/**
 * AUDIT READ-ONLY — 8 AMFEs Barack Mercosul
 * Detecta errores IATF 16949 en todos los amfe_documents.
 * No modifica nada.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const authRes = await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
if (authRes.error) { console.error('AUTH FAILED:', authRes.error.message); process.exit(1); }

const { data: docs, error } = await sb.from('amfe_documents').select('*');
if (error) { console.error('FETCH FAILED:', error.message); process.exit(1); }

// Parse string data to object (same pattern as _backup.mjs). Only flag as "double-serialized"
// if after ONE parse the result is still a string.
for (const doc of docs) {
    if (typeof doc.data === 'string') {
        try {
            const parsed = JSON.parse(doc.data);
            if (typeof parsed === 'string') {
                // Double-serialized — flag
                doc._doubleSerialized = true;
                try { doc.data = JSON.parse(parsed); } catch { doc.data = parsed; }
            } else {
                doc.data = parsed;
            }
        } catch (e) {
            doc._parseError = e.message;
        }
    }
}

const CANONICAL_TYPES = new Set(['Machine', 'Man', 'Method', 'Material', 'Measurement', 'Environment']);
const CC_EXEMPT_KEYWORDS = ['flamabilidad', 'flamable', 'flame', 'tl 1010', 'voc', 'emisiones', 'airbag', 'legal', 'seguridad'];
const CAPACITACION_KEYWORDS = ['capacita', 'entrena', 'adiestra'];

const ISSUE_TYPES = [
    'CAUSES_WITH_AP_H_NO_ACTION',
    'FAILURES_MISSING_3_EFFECTS',
    'CAUSES_PARTIAL_SOD',
    'CAUSES_CAPACITACION',
    'WE_TYPE_NOT_CANONICAL',
    'WE_AGGREGATED_NAMES',
    'CC_WITHOUT_SEVERITY_9',
    'SC_LOW_SEVERITY',
    'FUNCTION_3_FUNCTIONS_MISSING',
];

// Acciones "válidas" = cualquier texto significativo en preventionAction/detectionAction/actionTaken/responsible+targetDate
function hasAction(cause) {
    const keys = ['preventionAction', 'detectionAction', 'actionTaken'];
    for (const k of keys) {
        const v = (cause[k] || '').toString().trim();
        if (v.length >= 5 && !/^(pendiente|tbd|n\/a|na|-)$/i.test(v)) return true;
    }
    return false;
}

function hasCapacitacion(text) {
    const t = (text || '').toString().toLowerCase();
    return CAPACITACION_KEYWORDS.some(k => t.includes(k));
}

function isCcExempt(failText, causeText) {
    const t = `${failText || ''} ${causeText || ''}`.toLowerCase();
    return CC_EXEMPT_KEYWORDS.some(k => t.includes(k));
}

const report = {}; // familia -> { [issueType]: { count, examples: [] } }
const allIssues = {}; // global counters

function addIssue(family, type, example) {
    if (!report[family]) report[family] = {};
    if (!report[family][type]) report[family][type] = { count: 0, examples: [] };
    report[family][type].count++;
    if (report[family][type].examples.length < 3) {
        const shortEx = (example || '').toString().slice(0, 50);
        if (shortEx && !report[family][type].examples.includes(shortEx)) {
            report[family][type].examples.push(shortEx);
        }
    }
    allIssues[type] = (allIssues[type] || 0) + 1;
}

const skipped = [];
let docCount = 0;

for (const doc of docs) {
    const family = doc.subject || doc.project_name || doc.amfe_number || doc.id;

    if (doc._parseError) {
        skipped.push({ family, reason: `parse error: ${doc._parseError}` });
        continue;
    }
    if (typeof doc.data === 'string') {
        skipped.push({ family, reason: 'data is string (double-serialized, unparseable)' });
        continue;
    }
    if (!doc.data || !Array.isArray(doc.data.operations)) {
        skipped.push({ family, reason: 'no operations array' });
        continue;
    }
    if (doc._doubleSerialized) {
        // Proceed but flag
        console.warn(`  WARN: ${family} was double-serialized (auto-unwrapped)`);
    }

    docCount++;

    for (const op of doc.data.operations) {
        // Chequear 3-funciones
        const func3 = (op.focusElementFunction || op.operationFunction || '').toString();
        const parts = func3.split('/').map(p => p.trim()).filter(Boolean);
        if (parts.length < 3) {
            addIssue(family, 'FUNCTION_3_FUNCTIONS_MISSING', `OP${op.opNumber || op.operationNumber}: ${func3}`);
        }

        for (const we of (op.workElements || [])) {
            // WE type canonical
            if (we.type && !CANONICAL_TYPES.has(we.type)) {
                addIssue(family, 'WE_TYPE_NOT_CANONICAL', `${we.type}: ${we.name || ''}`);
            }
            // WE aggregated names (multiple "/")
            const name = we.name || '';
            const slashCount = (name.match(/\//g) || []).length;
            if (slashCount > 1) {
                addIssue(family, 'WE_AGGREGATED_NAMES', name);
            }

            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    // 3 efectos
                    const e1 = (fail.effectLocal || '').toString().trim();
                    const e2 = (fail.effectNextLevel || '').toString().trim();
                    const e3 = (fail.effectEndUser || '').toString().trim();
                    if (!e1 || !e2 || !e3) {
                        addIssue(family, 'FAILURES_MISSING_3_EFFECTS', fail.description || '');
                    }

                    const failSev = Number(fail.severity) || 0;

                    for (const cause of (fail.causes || [])) {
                        const causeText = (cause.cause || cause.description || '').toString();
                        const ap = (cause.ap || cause.actionPriority || '').toString().toUpperCase();

                        // AP=H sin accion
                        if (ap === 'H' && !hasAction(cause)) {
                            addIssue(family, 'CAUSES_WITH_AP_H_NO_ACTION', causeText);
                        }

                        // S/O/D parciales
                        const s = cause.severity;
                        const o = cause.occurrence;
                        const d = cause.detection;
                        const filled = [s, o, d].map(v => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v)));
                        const numFilled = filled.filter(Boolean).length;
                        if (numFilled > 0 && numFilled < 3) {
                            addIssue(family, 'CAUSES_PARTIAL_SOD', `S=${s} O=${o} D=${d} | ${causeText}`);
                        }

                        // Capacitacion como causa
                        if (hasCapacitacion(causeText)) {
                            addIssue(family, 'CAUSES_CAPACITACION', causeText);
                        }

                        // CC sin severidad 9 (salvo exento)
                        const sNum = Number(s) || failSev || 0;
                        if (cause.specialChar === 'CC' && sNum < 9) {
                            if (!isCcExempt(fail.description, causeText)) {
                                addIssue(family, 'CC_WITHOUT_SEVERITY_9', `S=${sNum}: ${causeText}`);
                            }
                        }

                        // SC con severidad baja
                        if (cause.specialChar === 'SC' && sNum < 7) {
                            addIssue(family, 'SC_LOW_SEVERITY', `S=${sNum}: ${causeText}`);
                        }
                    }
                }
            }
        }
    }
}

// ============ REPORTE ============
console.log('\n=== AUDIT AMFEs Barack Mercosul ===\n');
console.log(`Documentos auditados: ${docCount}`);
console.log(`Documentos saltados: ${skipped.length}`);
if (skipped.length) {
    for (const s of skipped) console.log(`  - ${s.family}: ${s.reason}`);
}

// Ranking
const familyScores = Object.entries(report).map(([fam, issues]) => {
    const total = Object.values(issues).reduce((a, x) => a + x.count, 0);
    return { fam, total };
}).sort((a, b) => b.total - a.total);

console.log('\n=== RANKING FAMILIAS MAS PROBLEMATICAS ===');
for (const r of familyScores) {
    console.log(`  ${r.total.toString().padStart(4)}  ${r.fam}`);
}

console.log('\n=== TOTALES GLOBALES POR TIPO ===');
for (const t of ISSUE_TYPES) {
    console.log(`  ${(allIssues[t] || 0).toString().padStart(5)}  ${t}`);
}

console.log('\n=== DETALLE POR FAMILIA ===');
for (const { fam } of familyScores) {
    console.log(`\n## ${fam}`);
    const issues = report[fam];
    for (const t of ISSUE_TYPES) {
        const e = issues[t];
        if (!e || e.count === 0) continue;
        console.log(`  [${e.count.toString().padStart(4)}] ${t}`);
        for (const ex of e.examples) {
            console.log(`         ej: "${ex}"`);
        }
    }
}

// Markdown output final
console.log('\n\n=== TABLA MD FINAL ===\n');
const headers = ['Familia', ...ISSUE_TYPES.map(t => t.replace(/_/g, ' ').slice(0, 18))];
console.log('| ' + headers.join(' | ') + ' |');
console.log('|' + headers.map(() => '---').join('|') + '|');
for (const { fam } of familyScores) {
    const row = [fam.slice(0, 35)];
    for (const t of ISSUE_TYPES) {
        row.push((report[fam][t]?.count || 0).toString());
    }
    console.log('| ' + row.join(' | ') + ' |');
}

process.exit(0);

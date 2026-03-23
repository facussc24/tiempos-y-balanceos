#!/usr/bin/env node
/**
 * CP Audit Script — Comprehensive analysis of all Control Plans in Supabase
 *
 * Checks:
 *  a) Classification counts (CC/SC/PTC/blank) with percentages
 *  b) English text in parentheses across all string fields
 *  c) characteristicNumber column emptiness
 *  d) "Autoelevador" usage in machineDeviceTool
 *  e) Reaction Plan style — SGC procedure references
 *  f) Frequency style — reference patterns vs generic
 *  g) "Pieza patrón" usage in evaluationTechnique
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseData(raw) {
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw;
}

// Known SGC procedure patterns
const SGC_PROCEDURES = [
    'P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06', 'P-07', 'P-08',
    'P-09', 'P-10', 'P-11', 'P-12', 'P-13', 'P-14', 'P-15', 'P-16',
    'P-17', 'P-18', 'P-19', 'P-20', 'P-21', 'P-22',
    'IT-', 'I-IN-', 'I-PY-', 'I-CA-',
];

const SGC_REGEX = /P-\d{2}|IT-[A-Z]+-\d+|I-[A-Z]+-\d+/i;

// Reference frequency patterns (good style)
const GOOD_FREQ_PATTERNS = [
    /inicio\s+de\s+turno/i,
    /después\s+de\s+cada\s+intervención/i,
    /parada\s+de\s+más\s+de/i,
    /por\s+entrega/i,
    /por\s+lote/i,
    /cada\s+cambio\s+de\s+(modelo|color|material|rollo|tela)/i,
    /inicio\s+y\s+fin\s+de\s+turno/i,
    /cada\s+\d+\s+(minutos|min)/i,
    /continuo/i,
    /cada\s+cambio\s+de\s+turno/i,
    /set\s*up/i,
    /según\s+plan/i,
];

// Generic/weak frequency patterns (flag these)
const GENERIC_FREQ_PATTERNS = [
    /^cada\s+pieza$/i,
    /^cada\s+hora$/i,
    /^100%$/i,
    /^1$/i,
    /^c\/u$/i,
];

// English text in parentheses regex
const ENGLISH_PAREN_REGEX = /\(([A-Z][a-z]+(?:\s+[A-Za-z]+)*)\)/g;

// String fields to check in each CP item
const STRING_FIELDS = [
    'processStepNumber', 'processDescription', 'machineDeviceTool',
    'characteristicNumber', 'productCharacteristic', 'processCharacteristic',
    'specialCharClass', 'specification', 'evaluationTechnique',
    'sampleSize', 'sampleFrequency', 'controlMethod', 'reactionPlan',
    'reactionPlanOwner', 'controlProcedure',
];

// ─── Main ───────────────────────────────────────────────────────────────────

await initSupabase();

const rows = await selectSql("SELECT id, control_plan_number, project_name, data FROM cp_documents ORDER BY project_name, control_plan_number");

console.log('='.repeat(100));
console.log('  CONTROL PLAN AUDIT REPORT');
console.log('  Date: ' + new Date().toISOString().slice(0, 10));
console.log('  Total CP documents found: ' + rows.length);
console.log('='.repeat(100));

// Global accumulators
const globalStats = {
    totalItems: 0,
    totalCC: 0,
    totalSC: 0,
    totalPTC: 0,
    totalBlank: 0,
    totalOther: 0,
    englishMatches: [],
    autoelevadorUsages: [],
    noCharNumberCPs: [],
    hasCharNumberCPs: [],
    nonSgcReactionPlans: [],
    genericFrequencies: [],
    piezaPatronUsages: [],
    piezaPatronMissing: [],
};

for (const row of rows) {
    const data = parseData(row.data);
    const items = data.items || [];
    const cpLabel = `${row.project_name} | CP ${row.control_plan_number}`;

    console.log('\n' + '━'.repeat(100));
    console.log('  CP: ' + cpLabel);
    console.log('  Items: ' + items.length);
    console.log('━'.repeat(100));

    // ─── a) Classification counts ──────────────────────────────────────
    let cc = 0, sc = 0, ptc = 0, blank = 0, other = 0;
    const otherValues = new Set();

    for (const item of items) {
        const cls = (item.specialCharClass || '').trim();
        if (cls === 'CC') cc++;
        else if (cls === 'SC') sc++;
        else if (cls === 'PTC') ptc++;
        else if (cls === '') blank++;
        else { other++; otherValues.add(cls); }
    }

    const total = items.length;
    const ccScPct = total > 0 ? ((cc + sc) / total * 100).toFixed(1) : '0.0';
    const flag = total > 0 && (cc + sc) / total > 0.20 ? ' ⚠ HIGH (>20%)' : '';

    console.log('\n  [a] CLASSIFICATION COUNTS:');
    console.log('      CC:    ' + String(cc).padStart(4) + '  (' + (total > 0 ? (cc / total * 100).toFixed(1) : '0.0') + '%)');
    console.log('      SC:    ' + String(sc).padStart(4) + '  (' + (total > 0 ? (sc / total * 100).toFixed(1) : '0.0') + '%)');
    console.log('      PTC:   ' + String(ptc).padStart(4) + '  (' + (total > 0 ? (ptc / total * 100).toFixed(1) : '0.0') + '%)');
    console.log('      Blank: ' + String(blank).padStart(4) + '  (' + (total > 0 ? (blank / total * 100).toFixed(1) : '0.0') + '%)');
    if (other > 0) {
        console.log('      Other: ' + String(other).padStart(4) + '  values: ' + [...otherValues].join(', '));
    }
    console.log('      CC+SC: ' + String(cc + sc).padStart(4) + '  (' + ccScPct + '%)' + flag);

    globalStats.totalItems += total;
    globalStats.totalCC += cc;
    globalStats.totalSC += sc;
    globalStats.totalPTC += ptc;
    globalStats.totalBlank += blank;
    globalStats.totalOther += other;

    // ─── b) English text in parentheses ────────────────────────────────
    console.log('\n  [b] ENGLISH TEXT IN PARENTHESES:');
    let engCount = 0;

    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        for (const field of STRING_FIELDS) {
            const val = (item[field] || '').toString();
            let match;
            ENGLISH_PAREN_REGEX.lastIndex = 0;
            while ((match = ENGLISH_PAREN_REGEX.exec(val)) !== null) {
                const found = match[0];
                // Filter out common Spanish abbreviations in parens
                const inner = match[1];
                // Skip if it looks Spanish (common words)
                if (/^(Ver|Por|Sin|Con|Según|Para|Tipo|Lado|Zona|Cara|Parte|Nota|Ref|Ítem|Lote|Turno|Inicio|Final|Cada|Piezas?)$/i.test(inner)) continue;
                // Skip single short words that might be abbreviations
                if (inner.length <= 3) continue;

                engCount++;
                const loc = `item[${idx}].${field}`;
                console.log('      ' + loc + ': ' + found);
                console.log('        context: "...' + val.substring(Math.max(0, match.index - 30), match.index + found.length + 30) + '..."');
                globalStats.englishMatches.push({ cp: cpLabel, item: idx, field, match: found, context: val.substring(0, 120) });
            }
        }
    }
    if (engCount === 0) {
        console.log('      (none found)');
    }

    // ─── c) characteristicNumber column ────────────────────────────────
    console.log('\n  [c] CHARACTERISTIC NUMBER (Nro.):');
    const hasCharNum = items.filter(i => (i.characteristicNumber || '').trim() !== '');
    const emptyCharNum = items.length - hasCharNum.length;

    if (hasCharNum.length === 0) {
        console.log('      EMPTY across all ' + items.length + ' items — no numbering exists');
        globalStats.noCharNumberCPs.push(cpLabel);
    } else if (emptyCharNum > 0) {
        console.log('      Filled: ' + hasCharNum.length + ' / ' + items.length + '  (partial)');
        console.log('      Empty:  ' + emptyCharNum + ' items missing numbering');
        // Show sample of those with numbers
        const sample = hasCharNum.slice(0, 5);
        console.log('      Sample values: ' + sample.map(i => i.characteristicNumber).join(', '));
        globalStats.hasCharNumberCPs.push(cpLabel + ' (partial: ' + hasCharNum.length + '/' + items.length + ')');
    } else {
        console.log('      All ' + items.length + ' items have characteristicNumber');
        globalStats.hasCharNumberCPs.push(cpLabel + ' (full)');
    }

    // ─── d) Autoelevador check ─────────────────────────────────────────
    console.log('\n  [d] AUTOELEVADOR USAGE:');
    let autoCount = 0;
    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const mdt = (item.machineDeviceTool || '').toLowerCase();
        if (mdt.includes('autoelevador')) {
            autoCount++;
            const opInfo = item.processStepNumber + ' - ' + (item.processDescription || '').substring(0, 60);
            console.log('      item[' + idx + '] OP ' + opInfo);
            console.log('        machineDeviceTool: "' + item.machineDeviceTool + '"');

            // Flag Top Roll OP 5 specifically
            const isTopRoll = row.project_name.includes('TOP_ROLL');
            const isOp5 = (item.processStepNumber || '').includes('5');
            if (isTopRoll && isOp5) {
                console.log('        >>> FLAGGED: Top Roll OP 5 with Autoelevador');
            }

            globalStats.autoelevadorUsages.push({
                cp: cpLabel,
                item: idx,
                op: item.processStepNumber,
                desc: (item.processDescription || '').substring(0, 80),
                machineDeviceTool: item.machineDeviceTool,
                isTopRollOp5: isTopRoll && isOp5,
            });
        }
    }
    if (autoCount === 0) {
        console.log('      (none found)');
    }

    // ─── e) Reaction Plan style ────────────────────────────────────────
    console.log('\n  [e] REACTION PLAN ANALYSIS:');
    let sgcCount = 0, nonSgcCount = 0, emptyReaction = 0;
    const nonSgcExamples = [];

    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const rp = (item.reactionPlan || '').trim();
        if (rp === '') {
            emptyReaction++;
            continue;
        }
        if (SGC_REGEX.test(rp)) {
            sgcCount++;
        } else {
            nonSgcCount++;
            nonSgcExamples.push({ idx, op: item.processStepNumber, rp: rp.substring(0, 120) });
            globalStats.nonSgcReactionPlans.push({
                cp: cpLabel,
                item: idx,
                op: item.processStepNumber,
                reactionPlan: rp.substring(0, 150),
            });
        }
    }

    console.log('      With SGC ref:     ' + sgcCount);
    console.log('      Without SGC ref:  ' + nonSgcCount);
    console.log('      Empty:            ' + emptyReaction);

    if (nonSgcExamples.length > 0) {
        console.log('      Non-SGC examples (first 5):');
        for (const ex of nonSgcExamples.slice(0, 5)) {
            console.log('        item[' + ex.idx + '] OP ' + ex.op + ': "' + ex.rp + '"');
        }
        if (nonSgcExamples.length > 5) {
            console.log('        ... and ' + (nonSgcExamples.length - 5) + ' more');
        }
    }

    // ─── f) Frequency style ────────────────────────────────────────────
    console.log('\n  [f] FREQUENCY ANALYSIS:');
    let goodFreq = 0, genericFreq = 0, emptyFreq = 0, otherFreq = 0;
    const genericExamples = [];
    const allFreqs = new Map(); // unique freq -> count

    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const freq = (item.sampleFrequency || '').trim();

        if (freq === '') {
            emptyFreq++;
            continue;
        }

        allFreqs.set(freq, (allFreqs.get(freq) || 0) + 1);

        const isGood = GOOD_FREQ_PATTERNS.some(p => p.test(freq));
        const isGeneric = GENERIC_FREQ_PATTERNS.some(p => p.test(freq));

        if (isGeneric) {
            genericFreq++;
            genericExamples.push({ idx, op: item.processStepNumber, freq });
            globalStats.genericFrequencies.push({
                cp: cpLabel,
                item: idx,
                op: item.processStepNumber,
                frequency: freq,
            });
        } else if (isGood) {
            goodFreq++;
        } else {
            otherFreq++;
        }
    }

    console.log('      Reference style:  ' + goodFreq);
    console.log('      Generic/simple:   ' + genericFreq);
    console.log('      Other:            ' + otherFreq);
    console.log('      Empty:            ' + emptyFreq);

    if (allFreqs.size > 0) {
        console.log('      Unique frequencies:');
        const sorted = [...allFreqs.entries()].sort((a, b) => b[1] - a[1]);
        for (const [freq, count] of sorted) {
            const marker = GENERIC_FREQ_PATTERNS.some(p => p.test(freq)) ? '  << GENERIC' : '';
            console.log('        [' + count + 'x] "' + freq.substring(0, 100) + '"' + marker);
        }
    }

    if (genericExamples.length > 0) {
        console.log('      Generic frequency items:');
        for (const ex of genericExamples.slice(0, 5)) {
            console.log('        item[' + ex.idx + '] OP ' + ex.op + ': "' + ex.freq + '"');
        }
    }

    // ─── g) Pieza patrón usage ─────────────────────────────────────────
    console.log('\n  [g] "PIEZA PATRON" USAGE:');
    let piezaPatronCount = 0;
    let visualInspCount = 0;
    let visualWithoutPatron = 0;

    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const eval_ = (item.evaluationTechnique || '').toLowerCase();
        const method = (item.controlMethod || '').toLowerCase();
        const prodChar = (item.productCharacteristic || '').toLowerCase();
        const procChar = (item.processCharacteristic || '').toLowerCase();

        const hasPiezaPatron = eval_.includes('pieza patr') || eval_.includes('pieza patron') || eval_.includes('pieza patrón');
        const isVisualInsp = eval_.includes('visual') || method.includes('visual') ||
            method.includes('inspección visual') || method.includes('inspeccion visual');
        const isAspecto = prodChar.includes('aspecto') || procChar.includes('aspecto') ||
            prodChar.includes('visual') || procChar.includes('visual') ||
            prodChar.includes('apariencia');

        if (hasPiezaPatron) {
            piezaPatronCount++;
            globalStats.piezaPatronUsages.push({
                cp: cpLabel,
                item: idx,
                op: item.processStepNumber,
                evaluationTechnique: (item.evaluationTechnique || '').substring(0, 80),
                characteristic: (item.productCharacteristic || item.processCharacteristic || '').substring(0, 80),
            });
        }

        if (isVisualInsp && isAspecto && !hasPiezaPatron) {
            visualWithoutPatron++;
            globalStats.piezaPatronMissing.push({
                cp: cpLabel,
                item: idx,
                op: item.processStepNumber,
                evaluationTechnique: (item.evaluationTechnique || '').substring(0, 80),
                characteristic: (item.productCharacteristic || item.processCharacteristic || '').substring(0, 80),
            });
        }

        if (isVisualInsp) visualInspCount++;
    }

    console.log('      "Pieza patrón" used:       ' + piezaPatronCount);
    console.log('      Visual inspections total:   ' + visualInspCount);
    console.log('      Visual+Aspecto w/o patrón:  ' + visualWithoutPatron);

    if (piezaPatronCount > 0) {
        const usages = globalStats.piezaPatronUsages.filter(u => u.cp === cpLabel);
        for (const u of usages.slice(0, 3)) {
            console.log('        OP ' + u.op + ': eval="' + u.evaluationTechnique + '" char="' + u.characteristic + '"');
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n\n' + '═'.repeat(100));
console.log('  GLOBAL SUMMARY');
console.log('═'.repeat(100));

console.log('\n[a] CLASSIFICATION — ALL CPs COMBINED:');
console.log('    Total items:  ' + globalStats.totalItems);
console.log('    CC:           ' + globalStats.totalCC + '  (' + (globalStats.totalItems > 0 ? (globalStats.totalCC / globalStats.totalItems * 100).toFixed(1) : 0) + '%)');
console.log('    SC:           ' + globalStats.totalSC + '  (' + (globalStats.totalItems > 0 ? (globalStats.totalSC / globalStats.totalItems * 100).toFixed(1) : 0) + '%)');
console.log('    PTC:          ' + globalStats.totalPTC + '  (' + (globalStats.totalItems > 0 ? (globalStats.totalPTC / globalStats.totalItems * 100).toFixed(1) : 0) + '%)');
console.log('    Blank:        ' + globalStats.totalBlank + '  (' + (globalStats.totalItems > 0 ? (globalStats.totalBlank / globalStats.totalItems * 100).toFixed(1) : 0) + '%)');
console.log('    Other:        ' + globalStats.totalOther);
console.log('    CC+SC total:  ' + (globalStats.totalCC + globalStats.totalSC) + '  (' + (globalStats.totalItems > 0 ? ((globalStats.totalCC + globalStats.totalSC) / globalStats.totalItems * 100).toFixed(1) : 0) + '%)');

console.log('\n[b] ENGLISH TEXT IN PARENTHESES — ' + globalStats.englishMatches.length + ' matches total:');
if (globalStats.englishMatches.length > 0) {
    for (const m of globalStats.englishMatches) {
        console.log('    ' + m.cp + ' | item[' + m.item + '].' + m.field + ': ' + m.match);
    }
} else {
    console.log('    (none found)');
}

console.log('\n[c] CHARACTERISTIC NUMBER STATUS:');
console.log('    CPs with EMPTY charNumber: ' + globalStats.noCharNumberCPs.length);
for (const cp of globalStats.noCharNumberCPs) {
    console.log('      - ' + cp);
}
console.log('    CPs with charNumber data:  ' + globalStats.hasCharNumberCPs.length);
for (const cp of globalStats.hasCharNumberCPs) {
    console.log('      - ' + cp);
}

console.log('\n[d] AUTOELEVADOR — ' + globalStats.autoelevadorUsages.length + ' usages total:');
if (globalStats.autoelevadorUsages.length > 0) {
    for (const u of globalStats.autoelevadorUsages) {
        const flag = u.isTopRollOp5 ? ' >>> TOP ROLL OP 5' : '';
        console.log('    ' + u.cp + ' | OP ' + u.op + ' | "' + u.machineDeviceTool + '"' + flag);
    }
} else {
    console.log('    (none found)');
}

console.log('\n[e] REACTION PLANS WITHOUT SGC REFERENCE — ' + globalStats.nonSgcReactionPlans.length + ' items:');
if (globalStats.nonSgcReactionPlans.length > 0) {
    // Group by CP
    const byCP = {};
    for (const r of globalStats.nonSgcReactionPlans) {
        if (!byCP[r.cp]) byCP[r.cp] = [];
        byCP[r.cp].push(r);
    }
    for (const [cp, items] of Object.entries(byCP)) {
        console.log('    ' + cp + ' (' + items.length + ' items):');
        for (const r of items.slice(0, 3)) {
            console.log('      OP ' + r.op + ': "' + r.reactionPlan + '"');
        }
        if (items.length > 3) {
            console.log('      ... and ' + (items.length - 3) + ' more');
        }
    }
} else {
    console.log('    (none — all reaction plans reference SGC procedures)');
}

console.log('\n[f] GENERIC FREQUENCIES — ' + globalStats.genericFrequencies.length + ' items:');
if (globalStats.genericFrequencies.length > 0) {
    const byCP = {};
    for (const f of globalStats.genericFrequencies) {
        if (!byCP[f.cp]) byCP[f.cp] = [];
        byCP[f.cp].push(f);
    }
    for (const [cp, items] of Object.entries(byCP)) {
        console.log('    ' + cp + ' (' + items.length + ' items):');
        for (const f of items) {
            console.log('      OP ' + f.op + ': "' + f.frequency + '"');
        }
    }
} else {
    console.log('    (none — all frequencies match reference style)');
}

console.log('\n[g] PIEZA PATRON SUMMARY:');
console.log('    Total "Pieza patrón" usages:                 ' + globalStats.piezaPatronUsages.length);
console.log('    Visual+Aspecto items WITHOUT "Pieza patrón": ' + globalStats.piezaPatronMissing.length);
if (globalStats.piezaPatronMissing.length > 0) {
    console.log('    Items that might need "Pieza patrón":');
    for (const m of globalStats.piezaPatronMissing) {
        console.log('      ' + m.cp + ' | OP ' + m.op + ' | eval="' + m.evaluationTechnique + '" char="' + m.characteristic + '"');
    }
}
if (globalStats.piezaPatronUsages.length > 0) {
    console.log('    Items where "Pieza patrón" IS used:');
    for (const u of globalStats.piezaPatronUsages) {
        console.log('      ' + u.cp + ' | OP ' + u.op + ' | eval="' + u.evaluationTechnique + '" char="' + u.characteristic + '"');
    }
}

console.log('\n' + '═'.repeat(100));
console.log('  END OF AUDIT REPORT');
console.log('═'.repeat(100));

close();

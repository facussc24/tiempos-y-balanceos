/**
 * Post-Audit Fix Script — 2026-03-30
 *
 * Fixes Priorities 2-6 from the post-audit plan:
 *   A. Populate componentMaterial in CP reception items (Priority 2)
 *   B. Fix broken amfeFailureId in Insert CP (Priority 4)
 *   C. Separate mixed Product/Process rows in CP (Priority 5)
 *   D. Minor fixes: AP mismatches, generic evaluationTechnique, P-14, EPP, responsibility (Priority 6)
 *   E. Close CP→HO gaps (Priority 3)
 *
 * USO: node scripts/fixPostAudit2026_03_30.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

// ─── Config ────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Auth
const { error: authErr } = await supabase.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('✓ Authenticated');
if (DRY_RUN) console.log('⚠️  DRY RUN MODE — no changes will be saved\n');

// ─── AP Calculation (replica of apTable.ts) ────────────────────────────
function calculateAP(s, o, d) {
    if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
    s = Math.round(s); o = Math.round(o); d = Math.round(d);
    if (s < 1 || s > 10 || o < 1 || o > 10 || d < 1 || d > 10) return '';
    if (s <= 1) return 'L';
    if (s <= 3) { return (o >= 8 && d >= 5) ? 'M' : 'L'; }
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
    if (o >= 2) { if (d >= 7) return 'H'; if (d >= 5) return 'M'; return 'L'; }
    return 'L';
}

// ─── Load all documents ────────────────────────────────────────────────
console.log('=== Loading documents ===');

const { data: amfeDocs, error: amfeErr } = await supabase
    .from('amfe_documents')
    .select('id, project_name, part_number, data');
if (amfeErr) { console.error('AMFE load error:', amfeErr.message); process.exit(1); }

const { data: cpDocs, error: cpErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, part_number, part_name, data');
if (cpErr) { console.error('CP load error:', cpErr.message); process.exit(1); }

const { data: hoDocs, error: hoErr } = await supabase
    .from('ho_documents')
    .select('id, part_number, part_description, linked_amfe_project, data');
if (hoErr) { console.error('HO load error:', hoErr.message); process.exit(1); }

console.log(`Loaded: ${amfeDocs.length} AMFEs, ${cpDocs.length} CPs, ${hoDocs.length} HOs`);

// Parse JSON data
for (const doc of [...amfeDocs, ...cpDocs, ...hoDocs]) {
    if (typeof doc.data === 'string') doc.data = JSON.parse(doc.data);
}

// ─── Helper: match documents ──────────────────────────────────────────
function findMatchingCp(amfeDoc) {
    let match = cpDocs.find(cp => cp.project_name === amfeDoc.project_name);
    if (match) return match;
    return cpDocs.find(cp => cp.part_number === amfeDoc.part_number);
}
function findMatchingHo(amfeDoc) {
    let match = hoDocs.find(ho => ho.linked_amfe_project === amfeDoc.project_name);
    if (match) return match;
    match = hoDocs.find(ho => ho.part_description === amfeDoc.part_number);
    if (match) return match;
    return hoDocs.find(ho => ho.part_number === amfeDoc.part_number);
}
function findCpForHo(hoDoc) {
    if (hoDoc.linked_amfe_project) {
        const match = cpDocs.find(cp => cp.project_name === hoDoc.linked_amfe_project);
        if (match) return match;
    }
    return cpDocs.find(cp => cp.part_number === hoDoc.part_number);
}

function isReception(processStepNumber) {
    const n = parseInt(String(processStepNumber).replace(/^OP\s*/i, '').trim(), 10);
    return Number.isFinite(n) && n <= 10;
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE A: Populate componentMaterial in CP reception items (Priority 2)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE A: componentMaterial ===');

const MATERIAL_KEYWORDS = [
    { pattern: /pvc|vinilo|vinyl|laminado|cobertura|forro/i, material: 'PVC/Vinilo' },
    { pattern: /espuma|foam|pur|polyol|densidad|dureza.*kpa/i, material: 'Espuma PUR' },
    { pattern: /hilo|costura|thread|polyester/i, material: 'Hilo costura' },
    { pattern: /pc.*abs|cycoloy|sustrato|soporte.*plastico/i, material: 'PC/ABS' },
    { pattern: /cinta.*tesa|tesa|adhesivo.*cinta/i, material: 'Cinta Tessa' },
    { pattern: /tpo|bilaminate|bi.*laminate/i, material: 'TPO Bilaminate' },
    { pattern: /adhesivo|sikamelt|sika/i, material: 'Adhesivo SikaMelt' },
    { pattern: /punzonado|bi.?componente/i, material: 'Punzonado bi-componente' },
    { pattern: /aplix|velcro/i, material: 'Aplix' },
    { pattern: /refuerzo|g\/m/i, material: 'Refuerzos' },
    { pattern: /varilla|acero|steel|barra/i, material: 'Varilla acero' },
    { pattern: /jacquard|rennes/i, material: 'Jacquard' },
    { pattern: /epp|armazon/i, material: 'Armazon EPP' },
    { pattern: /tela.*termoform/i, material: 'Tela termoformada' },
    { pattern: /tela|tejido|textil/i, material: 'Tela principal' },
];

function inferMaterialFromFields(item) {
    const text = `${item.productCharacteristic || ''} ${item.processCharacteristic || ''} ${item.specification || ''}`;

    // Skip flamabilidad — applies to all materials
    if (/flamabilidad|inflamab/i.test(text)) return null; // explicit skip

    for (const kw of MATERIAL_KEYWORDS) {
        if (kw.pattern.test(text)) return kw.material;
    }
    return ''; // can't determine
}

// For certificado/remito: try to infer from surrounding items in same operation
function inferMaterialFromSurroundings(item, allItems) {
    const text = `${item.productCharacteristic || ''} ${item.processCharacteristic || ''}`.toLowerCase();
    if (!/certificado|remito/i.test(text)) return '';

    // Find items in the same operation with a known material
    const sameOpItems = allItems.filter(it =>
        it.processStepNumber === item.processStepNumber &&
        it.id !== item.id &&
        it.componentMaterial && it.componentMaterial.trim()
    );
    // Return the first found material from the same op
    return sameOpItems.length > 0 ? sameOpItems[0].componentMaterial : '';
}

const phaseAStats = { populated: 0, skipped: 0, couldNotDetermine: 0, byProduct: {} };

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const items = cpDoc.data?.items || [];
    const receptionItems = items.filter(it => isReception(it.processStepNumber));
    const emptyMatItems = receptionItems.filter(it => !it.componentMaterial || !it.componentMaterial.trim());

    let populated = 0;
    let skipped = 0;
    let unknown = 0;

    for (const item of emptyMatItems) {
        const mat = inferMaterialFromFields(item);

        if (mat === null) {
            // flamabilidad — skip
            skipped++;
            phaseAStats.skipped++;
            continue;
        }

        if (mat) {
            item.componentMaterial = mat;
            populated++;
            phaseAStats.populated++;
            continue;
        }

        // Try surrounding items for certificado/remito
        const surroundingMat = inferMaterialFromSurroundings(item, items);
        if (surroundingMat) {
            item.componentMaterial = surroundingMat;
            populated++;
            phaseAStats.populated++;
            continue;
        }

        // Can't determine
        unknown++;
        phaseAStats.couldNotDetermine++;
        const charDesc = item.productCharacteristic || item.processCharacteristic || '(empty)';
        console.log(`    ? ${productName}: couldn't infer material for "${charDesc.slice(0, 60)}"`);
    }

    if (emptyMatItems.length > 0) {
        phaseAStats.byProduct[productName] = { total: receptionItems.length, populated, skipped, unknown };
        console.log(`  ${productName}: ${populated}/${emptyMatItems.length} populated (${skipped} skipped: flamabilidad, ${unknown} unknown)`);
    }
}

console.log(`  Total: ${phaseAStats.populated} populated, ${phaseAStats.skipped} skipped (flamabilidad), ${phaseAStats.couldNotDetermine} unknown`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE B: Fix broken amfeFailureId in Insert CP (Priority 4)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE B: amfeFailureId ===');

// Build global AMFE failure map: failureId → { opNumber, description, docProjectName }
const amfeFailureMap = new Map();
for (const amfeDoc of amfeDocs) {
    const ops = amfeDoc.data?.operations || [];
    for (const op of ops) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    amfeFailureMap.set(fail.id, {
                        opNumber: op.operationNumber || op.opNumber,
                        description: fail.description || '',
                        docProjectName: amfeDoc.project_name,
                    });
                }
            }
        }
    }
}

// Text similarity: simple word overlap ratio
function textSimilarity(a, b) {
    const wordsA = new Set((a || '').toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set((b || '').toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let overlap = 0;
    for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
    return overlap / Math.max(wordsA.size, wordsB.size);
}

const phaseBStats = { relinked: 0, nulled: 0, byProduct: {} };

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const items = cpDoc.data?.items || [];

    // Find corresponding AMFE
    const amfeDoc = amfeDocs.find(a => a.project_name === cpDoc.project_name) ||
                    amfeDocs.find(a => a.part_number === cpDoc.part_number);
    if (!amfeDoc) continue;

    // Build per-doc failure list for re-matching
    const docFailures = [];
    for (const op of (amfeDoc.data?.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    docFailures.push({
                        id: fail.id,
                        opNumber: String(op.operationNumber || op.opNumber),
                        description: fail.description || '',
                    });
                }
            }
        }
    }

    let relinked = 0;
    let nulled = 0;

    for (const item of items) {
        if (!item.amfeFailureId) continue;

        // Check if the failureId exists in the AMFE map
        if (amfeFailureMap.has(item.amfeFailureId)) continue; // valid

        // Broken link — try to re-match
        const itemOpNum = String(item.processStepNumber).replace(/^OP\s*/i, '').trim();
        const itemText = `${item.productCharacteristic || ''} ${item.processCharacteristic || ''}`.toLowerCase();

        let bestMatch = null;
        let bestScore = 0;

        for (const fail of docFailures) {
            const failOpNum = String(fail.opNumber).replace(/^OP\s*/i, '').trim();
            if (failOpNum !== itemOpNum) continue;

            const score = textSimilarity(itemText, fail.description);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = fail;
            }
        }

        if (bestMatch && bestScore >= 0.3) {
            item.amfeFailureId = bestMatch.id;
            relinked++;
        } else {
            item.amfeFailureId = null;
            nulled++;
        }
    }

    if (relinked > 0 || nulled > 0) {
        phaseBStats.byProduct[productName] = { relinked, nulled };
        console.log(`  ${productName}: ${relinked} re-linked, ${nulled} cleaned (null)`);
    }
    phaseBStats.relinked += relinked;
    phaseBStats.nulled += nulled;
}

console.log(`  Total: ${phaseBStats.relinked} fixed, ${phaseBStats.nulled} nulled`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE C: Separate mixed Product/Process rows (Priority 5)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE C: Separate mixed Product/Process rows ===');

const phaseCStats = { separated: 0, byProduct: {} };

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const items = cpDoc.data?.items || [];
    let separated = 0;

    // Process in reverse to avoid index shifting issues when inserting
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const hasProd = item.productCharacteristic && item.productCharacteristic.trim();
        const hasProc = item.processCharacteristic && item.processCharacteristic.trim();

        if (hasProd && hasProc) {
            // Clone for process row
            const clone = {
                ...item,
                id: randomUUID(),
                productCharacteristic: '',
                // Keep processCharacteristic, controlMethod
                evaluationTechnique: '', // process row: no evaluationTechnique per AIAG
            };

            // Original keeps product characteristic, clear process
            item.processCharacteristic = '';
            item.controlMethod = ''; // product row: no controlMethod per AIAG
            // Keep evaluationTechnique on product row

            // Insert clone right after original
            items.splice(i + 1, 0, clone);
            separated++;
        }
    }

    if (separated > 0) {
        cpDoc.data.items = items;
        phaseCStats.byProduct[productName] = separated;
        console.log(`  ${productName}: ${separated} rows separated`);
    }
    phaseCStats.separated += separated;
}

console.log(`  Total: ${phaseCStats.separated} rows separated into product+process pairs`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE D: Minor fixes (Priority 6)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE D: Minor fixes ===');

// ─── D1: Fix AP mismatches ─────────────────────────────────────────────
console.log('\n  --- D1: Fix AP mismatches ---');

let d1Fixed = 0;

for (const amfeDoc of amfeDocs) {
    const ops = amfeDoc.data?.operations || [];
    for (const op of ops) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const s = Number(fail.severity);
                    for (const cause of (fail.causes || [])) {
                        const o = Number(cause.occurrence);
                        const d = Number(cause.detection);
                        const correctAP = calculateAP(s, o, d);
                        const storedAP = cause.ap || '';

                        if (correctAP !== storedAP && correctAP !== '') {
                            console.log(`    ${amfeDoc.project_name || amfeDoc.part_number} OP ${op.operationNumber || op.opNumber}: AP ${storedAP} → ${correctAP} (S=${s} O=${o} D=${d})`);
                            cause.ap = correctAP;
                            d1Fixed++;
                        }
                    }
                }
            }
        }
    }
}

console.log(`  D1 total: ${d1Fixed} AP mismatches fixed`);

// ─── D2: Make generic evaluationTechnique more specific ─────────────────
console.log('\n  --- D2: Specific evaluationTechnique ---');

const GENERIC_EVAL = /^(visual|inspecci[oó]n|inspecci[oó]n\s*visual)$/i;

function specifyEvaluationTechnique(item) {
    const prodChar = (item.productCharacteristic || '').toLowerCase();
    const procChar = (item.processCharacteristic || '').toLowerCase();

    if (/aspecto|color|superficie/.test(prodChar)) return 'Control visual contra patron de aspecto';
    if (/dimension|espesor|medida|di[aá]metro/.test(prodChar)) return 'Medicion con calibre/flexometro';
    if (/certificado/.test(prodChar)) return 'Verificacion documental de certificado';
    if (/peso|gramaje/.test(prodChar)) return 'Pesaje con balanza calibrada';
    if (/temperatur|presion/.test(procChar)) return null; // process control, leave as-is
    return null; // leave as-is
}

let d2Fixed = 0;

for (const cpDoc of cpDocs) {
    const items = cpDoc.data?.items || [];
    for (const item of items) {
        if (!item.evaluationTechnique) continue;
        if (!GENERIC_EVAL.test(item.evaluationTechnique.trim())) continue;

        const specific = specifyEvaluationTechnique(item);
        if (specific) {
            console.log(`    ${cpDoc.project_name}: "${item.evaluationTechnique}" → "${specific}"`);
            item.evaluationTechnique = specific;
            d2Fixed++;
        }
    }
}

console.log(`  D2 total: ${d2Fixed} evaluationTechnique made specific`);

// ─── D3: Add P-14 to reception items ────────────────────────────────────
console.log('\n  --- D3: Add P-14 to reception items ---');

let d3Fixed = 0;

for (const cpDoc of cpDocs) {
    const items = cpDoc.data?.items || [];
    for (const item of items) {
        if (!isReception(item.processStepNumber)) continue;
        const rp = item.reactionPlan || '';
        if (/P-14/i.test(rp)) continue; // already has P-14

        if (rp.trim()) {
            item.reactionPlan = rp.trimEnd().replace(/\.?\s*$/, '') + '. Notificar a proveedor segun P-14';
        } else {
            item.reactionPlan = 'Notificar a proveedor segun P-14';
        }
        d3Fixed++;
    }
}

console.log(`  D3 total: ${d3Fixed} reception items with P-14 appended`);

// ─── D4: Add EPP to 1 HO sheet (Headrest Front) ────────────────────────
console.log('\n  --- D4: Add EPP to Headrest Front ---');

let d4Fixed = 0;

for (const hoDoc of hoDocs) {
    const isHeadrestFront = /headrest.*front/i.test(hoDoc.part_description || '') ||
                            /headrest.*front/i.test(hoDoc.linked_amfe_project || '') ||
                            /2HC881901/i.test(hoDoc.part_number || '');
    if (!isHeadrestFront) continue;

    const sheets = hoDoc.data?.sheets || [];
    for (const sheet of sheets) {
        const ppe = sheet.safetyElements;
        if (!ppe || !Array.isArray(ppe) || ppe.length === 0) {
            sheet.safetyElements = ['anteojos', 'guantes', 'zapatos'];
            d4Fixed++;
            console.log(`    ${hoDoc.part_description || hoDoc.part_number}: sheet "${sheet.operationName || sheet.hoNumber}" → PPE set to [anteojos, guantes, zapatos]`);
        }
    }
}

console.log(`  D4 total: ${d4Fixed} HO sheets with EPP added`);

// ─── D5: Fix responsibility mismatch (Telas Planas HO) ─────────────────
console.log('\n  --- D5: Fix responsibility mismatch (Telas Planas) ---');

let d5Fixed = 0;

for (const hoDoc of hoDocs) {
    const isTelasPlanas = /telas?\s*planas?/i.test(hoDoc.part_description || '') ||
                          /telas?\s*planas?/i.test(hoDoc.linked_amfe_project || '');
    if (!isTelasPlanas) continue;

    const cpDoc = findCpForHo(hoDoc);
    if (!cpDoc) {
        console.log(`    Warning: no CP found for Telas Planas HO`);
        continue;
    }

    // Build CP item map by id
    const cpItemMap = new Map();
    for (const item of (cpDoc.data?.items || [])) {
        cpItemMap.set(item.id, item);
    }

    const sheets = hoDoc.data?.sheets || [];
    for (const sheet of sheets) {
        for (const qc of (sheet.qualityChecks || [])) {
            if (!qc.cpItemId) continue;
            const cpItem = cpItemMap.get(qc.cpItemId);
            if (!cpItem) continue;

            const cpOwner = cpItem.reactionPlanOwner || '';
            const hoContact = qc.reactionContact || '';

            if (cpOwner && hoContact && cpOwner !== hoContact) {
                console.log(`    Telas Planas: QC "${(qc.characteristic || '').slice(0, 40)}" reactionContact "${hoContact}" → "${cpOwner}"`);
                qc.reactionContact = cpOwner;
                d5Fixed++;
            }
        }
    }
}

console.log(`  D5 total: ${d5Fixed} responsibility mismatches fixed`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE E: Close CP→HO gaps (Priority 3)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE E: Close CP→HO gaps ===');

const NON_OPERATOR_ROLES = /laboratorio|metrolog|auditor|calidad de proceso|supervisor.*calidad/i;
const LAB_TECHNIQUES = /certificado.*laboratorio|ensayo/i;

const phaseEStats = { qcCreated: 0, byProduct: {} };

// Track before state for summary
const hoGapsBefore = {};

for (const hoDoc of hoDocs) {
    const cpDoc = findCpForHo(hoDoc);
    if (!cpDoc) continue;

    const productName = hoDoc.part_description || hoDoc.part_number;
    const cpItems = cpDoc.data?.items || [];
    const sheets = hoDoc.data?.sheets || [];

    // Build set of CP item IDs already referenced by any HO qcItem
    const coveredCpItemIds = new Set();
    for (const sheet of sheets) {
        for (const qc of (sheet.qualityChecks || [])) {
            if (qc.cpItemId) coveredCpItemIds.add(qc.cpItemId);
        }
    }

    // Count gaps before
    let gapsBefore = 0;
    for (const cpItem of cpItems) {
        if (coveredCpItemIds.has(cpItem.id)) continue;
        if (NON_OPERATOR_ROLES.test(cpItem.reactionPlanOwner || '')) continue;
        if (LAB_TECHNIQUES.test(cpItem.evaluationTechnique || '')) continue;
        gapsBefore++;
    }
    hoGapsBefore[productName] = gapsBefore;

    let created = 0;

    for (const cpItem of cpItems) {
        if (coveredCpItemIds.has(cpItem.id)) continue;

        // Skip non-operator roles
        if (NON_OPERATOR_ROLES.test(cpItem.reactionPlanOwner || '')) continue;
        // Skip lab techniques
        if (LAB_TECHNIQUES.test(cpItem.evaluationTechnique || '')) continue;

        // Determine target sheet by processStepNumber
        const cpOpNum = String(cpItem.processStepNumber).replace(/^OP\s*/i, '').trim();
        const targetSheet = sheets.find(sh => {
            const shOpNum = String(sh.operationNumber).replace(/^OP\s*/i, '').trim();
            return shOpNum === cpOpNum;
        });

        if (!targetSheet) {
            // No matching sheet — log and skip
            continue;
        }

        // Create new QC item
        const qcItem = {
            id: randomUUID(),
            cpItemId: cpItem.id,
            characteristic: cpItem.productCharacteristic || cpItem.processCharacteristic || '',
            specification: cpItem.specification || '',
            evaluationTechnique: cpItem.evaluationTechnique || '',
            frequency: cpItem.sampleFrequency || '',
            controlMethod: cpItem.controlMethod || '',
            reactionAction: cpItem.reactionPlan || '',
            reactionContact: cpItem.reactionPlanOwner || '',
            specialCharSymbol: cpItem.specialCharClass || '',
            registro: '',
        };

        targetSheet.qualityChecks = targetSheet.qualityChecks || [];
        targetSheet.qualityChecks.push(qcItem);
        coveredCpItemIds.add(cpItem.id);
        created++;
    }

    if (created > 0) {
        phaseEStats.byProduct[productName] = created;
        console.log(`  ${productName}: ${created} QC items added to HO`);
    }
    phaseEStats.qcCreated += created;
}

console.log(`  Total: ${phaseEStats.qcCreated} QC items created to close gaps`);

// ═══════════════════════════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Saving ===');

if (DRY_RUN) {
    console.log('  ⚠️  DRY RUN — no changes saved');
} else {
    let savedCount = 0;
    let errorCount = 0;

    // Save AMFEs
    for (const doc of amfeDocs) {
        const { error } = await supabase
            .from('amfe_documents')
            .update({ data: doc.data })
            .eq('id', doc.id);
        if (error) { console.error(`  ✗ Error saving AMFE ${doc.project_name}: ${error.message}`); errorCount++; }
        else savedCount++;
    }

    // Save CPs
    for (const doc of cpDocs) {
        const { error } = await supabase
            .from('cp_documents')
            .update({ data: doc.data })
            .eq('id', doc.id);
        if (error) { console.error(`  ✗ Error saving CP ${doc.project_name}: ${error.message}`); errorCount++; }
        else savedCount++;
    }

    // Save HOs
    for (const doc of hoDocs) {
        const { error } = await supabase
            .from('ho_documents')
            .update({ data: doc.data })
            .eq('id', doc.id);
        if (error) { console.error(`  ✗ Error saving HO ${doc.part_number}: ${error.message}`); errorCount++; }
        else savedCount++;
    }

    console.log(`  ✓ ${savedCount} documents saved${errorCount > 0 ? `, ${errorCount} errors` : ''}`);
}

// ═══════════════════════════════════════════════════════════════════════
// OUTPUT SUMMARY
// ═══════════════════════════════════════════════════════════════════════
console.log('\n');
console.log('═══════════════════════════════════════════════════════════════');
console.log('                     DETAILED SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');

console.log('\n=== PHASE A: componentMaterial ===');
for (const [prod, stats] of Object.entries(phaseAStats.byProduct)) {
    console.log(`  ${prod}: ${stats.populated}/${stats.total} populated (${stats.skipped} skipped: flamabilidad, ${stats.unknown} unknown)`);
}
console.log(`  Total: ${phaseAStats.populated} populated, ${phaseAStats.skipped} skipped`);

console.log('\n=== PHASE B: amfeFailureId ===');
for (const [prod, stats] of Object.entries(phaseBStats.byProduct)) {
    console.log(`  ${prod}: ${stats.relinked} re-linked, ${stats.nulled} cleaned (null)`);
}
console.log(`  Total: ${phaseBStats.relinked} fixed, ${phaseBStats.nulled} nulled`);

console.log('\n=== PHASE C: Separate mixed rows ===');
for (const [prod, count] of Object.entries(phaseCStats.byProduct)) {
    console.log(`  ${prod}: ${count} rows separated`);
}
console.log(`  Total: ${phaseCStats.separated} separated`);

console.log('\n=== PHASE D: Minor fixes ===');
console.log(`  D1: ${d1Fixed} AP mismatches fixed`);
console.log(`  D2: ${d2Fixed} evaluationTechnique made specific`);
console.log(`  D3: ${d3Fixed} reception items with P-14 appended`);
console.log(`  D4: ${d4Fixed} HO sheets with EPP added`);
console.log(`  D5: ${d5Fixed} responsibility mismatches fixed`);

console.log('\n=== PHASE E: CP→HO gaps ===');
for (const [prod, count] of Object.entries(phaseEStats.byProduct)) {
    console.log(`  ${prod}: ${count} QC items added`);
}
console.log(`  Total: ${phaseEStats.qcCreated} QC items created`);

// Before/After summary table
console.log('\n=== SUMMARY ===');
console.log('┌──────────────────────────────┬─────────────────┬─────────────────┬────────────────┬───────────────┐');
console.log('│ Product                      │ Material Before │ Material After  │ HO Gaps Before │ HO Gaps After │');
console.log('├──────────────────────────────┼─────────────────┼─────────────────┼────────────────┼───────────────┤');

// Gather all product names from CPs
const allProducts = new Set();
for (const cpDoc of cpDocs) {
    allProducts.add(cpDoc.project_name || cpDoc.part_name || cpDoc.part_number);
}
for (const hoDoc of hoDocs) {
    allProducts.add(hoDoc.part_description || hoDoc.part_number);
}

for (const prod of allProducts) {
    const name = prod.padEnd(28).slice(0, 28);

    // Material stats
    const matStats = phaseAStats.byProduct[prod];
    const matBefore = matStats ? String(matStats.total - matStats.populated) : '-';
    const matAfter = matStats ? String(matStats.unknown) : '-';

    // HO gap stats
    const gapBefore = hoGapsBefore[prod] !== undefined ? String(hoGapsBefore[prod]) : '-';
    const gapAfter = phaseEStats.byProduct[prod] !== undefined
        ? String(Math.max(0, (hoGapsBefore[prod] || 0) - (phaseEStats.byProduct[prod] || 0)))
        : (gapBefore !== '-' ? gapBefore : '-');

    console.log(`│ ${name} │ ${matBefore.padStart(15)} │ ${matAfter.padStart(15)} │ ${gapBefore.padStart(14)} │ ${gapAfter.padStart(13)} │`);
}

console.log('└──────────────────────────────┴─────────────────┴─────────────────┴────────────────┴───────────────┘');

console.log(`\n${DRY_RUN ? '⚠️  DRY RUN completado (sin cambios guardados)' : '✓ Fix completado exitosamente'}`);
process.exit(0);

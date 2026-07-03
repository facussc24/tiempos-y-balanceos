/**
 * Fix Script — componentMaterial, HO gaps, evaluationTechnique
 *
 * 3 phases:
 *   A. Populate componentMaterial in ~82 CP reception items (3-level inference)
 *   B. Fix 4 HO residual gaps (Headrest Rear Center + Rear Outer)
 *   C. Specify ~32 generic evaluationTechnique
 *
 * USO: node scripts/fixComponentMaterial.mjs [--dry-run]
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

// ─── Helper ────────────────────────────────────────────────────────────
function isReception(processStepNumber) {
    const n = parseInt(String(processStepNumber).replace(/^OP\s*/i, '').trim(), 10);
    return Number.isFinite(n) && n <= 10;
}

// ─── Load all documents ────────────────────────────────────────────────
console.log('=== Loading documents ===');

const { data: cpDocs, error: cpErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, part_number, part_name, data');
if (cpErr) { console.error('CP load error:', cpErr.message); process.exit(1); }

const { data: hoDocs, error: hoErr } = await supabase
    .from('ho_documents')
    .select('id, part_number, part_description, linked_amfe_project, data');
if (hoErr) { console.error('HO load error:', hoErr.message); process.exit(1); }

console.log(`Loaded: ${cpDocs.length} CPs, ${hoDocs.length} HOs`);

// Parse JSON data
for (const doc of [...cpDocs, ...hoDocs]) {
    if (typeof doc.data === 'string') doc.data = JSON.parse(doc.data);
}

// ─── Helper: match documents ──────────────────────────────────────────
function findCpForHo(hoDoc) {
    if (hoDoc.linked_amfe_project) {
        const match = cpDocs.find(cp => cp.project_name === hoDoc.linked_amfe_project);
        if (match) return match;
    }
    return cpDocs.find(cp => cp.part_number === hoDoc.part_number);
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE A: Populate componentMaterial (~82 items) — 3-level inference
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE A: componentMaterial (3-level inference) ===');

// --- Level 1: Keywords in productCharacteristic + processCharacteristic ---
const LEVEL1_RULES = [
    // PVC/Vinilo indicators
    { pattern: /espesor|backing|grano|textura|brillo|laminado|cobertura|superficie.*pvc|color.*pvc/i, material: 'PVC' },
    // Espuma PUR indicators
    { pattern: /densidad|dureza|compression|peso.*espuma|foam|hardness|kpa/i, material: 'FOAM' },
    // Hilo/costura indicators
    { pattern: /tracci[oó]n.*hilo|elongaci[oó]n.*hilo|t[ií]tulo|torsi[oó]n|cabos|dtex|nm\b|costura/i, material: 'THREAD' },
    // Plástico indicators (PC/ABS or TPO depending on product)
    { pattern: /mfi|fluencia|impacto.*izod|contracci[oó]n|sustrato/i, material: 'PLASTIC' },
    // Tela/textil indicators
    { pattern: /gramaje|ancho.*tela|tracci[oó]n.*tela|pilling|martindale|solidez/i, material: 'FABRIC' },
    // Adhesivo indicators
    { pattern: /adhesi[oó]n|pelado|uni[oó]n.*adhesiv|fuerza.*peel/i, material: 'ADHESIVE' },
    // Varilla acero
    { pattern: /di[aá]metro.*varilla|dureza.*varilla|varilla|barra.*acero/i, material: 'STEEL_ROD' },
    // Dimensional generic — needs product context
    { pattern: /dimensional|cota|medida/i, material: 'DIMENSIONAL' },
    // Weight generic — needs product context
    { pattern: /peso\b|weight/i, material: 'WEIGHT' },
    // Aspect/visual generic
    { pattern: /aspecto|apariencia|visual|defecto.*superficial|mancha|raya/i, material: 'VISUAL' },
];

// --- Level 2: Specification field keywords ---
const LEVEL2_SPEC_RULES = [
    { pattern: /tl\s*520|tl\s*52310|vw\s*501/i, material: 'PVC' },
    { pattern: /60\s*[±+\-]\s*10\s*kg|kg\/m[³3]|kpa/i, material: 'FOAM' },
    { pattern: /tl\s*1010/i, material: 'FLAMABILITY' },
    { pattern: /dtex|nm\b|tex\b/i, material: 'THREAD' },
    { pattern: /g\/m[²2]/i, material: 'FABRIC' },
];

// --- Material code → Full name resolution (product-specific) ---
const PRODUCT_MATERIALS = {
    'INSERT': {
        PVC: 'PVC/Vinilo TL 520 94K', FOAM: 'Espuma PUR', THREAD: 'Hilo Polyester',
        PLASTIC: 'PC/ABS Cycoloy LG9000', ADHESIVE: 'Cinta Tessa 52110',
        STEEL_ROD: '', FABRIC: '',
        FLAMABILITY: 'PVC/Vinilo TL 520 94K', // primary flammable material
        DIMENSIONAL: '', WEIGHT: 'Espuma PUR', VISUAL: 'PVC/Vinilo TL 520 94K',
    },
    'ARMREST': {
        PVC: 'PVC/Vinilo', FOAM: 'Espuma PUR', THREAD: '',
        PLASTIC: 'Armazón EPP', ADHESIVE: '', STEEL_ROD: '', FABRIC: '',
        FLAMABILITY: 'PVC/Vinilo',
        DIMENSIONAL: '', WEIGHT: 'Espuma PUR', VISUAL: 'PVC/Vinilo',
    },
    'TOP_ROLL': {
        PVC: 'PVC/Vinilo TL 520 94K', FOAM: '', THREAD: '',
        PLASTIC: 'PC/ABS CYCOLOY', ADHESIVE: 'Adhesivo SikaMelt-171',
        STEEL_ROD: '', FABRIC: 'TPO Bilaminate',
        FLAMABILITY: 'PVC/Vinilo TL 520 94K',
        DIMENSIONAL: 'PC/ABS CYCOLOY', WEIGHT: '', VISUAL: 'PVC/Vinilo TL 520 94K',
    },
    'HEADREST': {
        PVC: 'PVC/Vinilo TL 520 94K', FOAM: 'Espuma PUR', THREAD: 'Hilo costura',
        PLASTIC: '', ADHESIVE: '', STEEL_ROD: 'Varilla acero', FABRIC: '',
        FLAMABILITY: 'PVC/Vinilo TL 520 94K',
        DIMENSIONAL: 'Varilla acero', WEIGHT: 'Espuma PUR', VISUAL: 'PVC/Vinilo TL 520 94K',
    },
    'TELAS_PLANAS': {
        PVC: '', FOAM: '', THREAD: 'Hilo Caimán',
        PLASTIC: '', ADHESIVE: 'Aplix', STEEL_ROD: '', FABRIC: 'Tela principal',
        FLAMABILITY: 'Tela principal',
        DIMENSIONAL: 'Tela principal', WEIGHT: 'Tela principal', VISUAL: 'Tela principal',
    },
    'TELAS_TERMOFORMADAS': {
        PVC: '', FOAM: '', THREAD: '',
        PLASTIC: '', ADHESIVE: '', STEEL_ROD: '', FABRIC: 'Tela termoformada',
        FLAMABILITY: 'Tela termoformada',
        DIMENSIONAL: 'Tela termoformada', WEIGHT: 'Tela termoformada', VISUAL: 'Tela termoformada',
    },
};

// --- Detection of product family from project_name ---
function detectProductFamily(projectName) {
    const pn = (projectName || '').toUpperCase();
    if (pn.includes('INSERT')) return 'INSERT';
    if (pn.includes('ARMREST')) return 'ARMREST';
    if (pn.includes('TOP_ROLL') || pn.includes('TOP ROLL')) return 'TOP_ROLL';
    if (pn.includes('HEADREST')) return 'HEADREST';
    if (pn.includes('TELAS_PLANAS') || pn.includes('TELA ASSENTO') || pn.includes('PLANAS')) return 'TELAS_PLANAS';
    if (pn.includes('TELAS_TERMOFORMADAS') || pn.includes('TERMOFORMAD')) return 'TELAS_TERMOFORMADAS';
    return null;
}

const phaseAStats = { assigned: 0, skippedNoFamily: 0, level3Assigned: 0, leftEmpty: 0, byProduct: {} };

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const family = detectProductFamily(productName);
    const materialMap = family ? PRODUCT_MATERIALS[family] : null;
    const items = cpDoc.data?.items || [];
    const receptionItems = items.filter(it => isReception(it.processStepNumber));
    const emptyMatItems = receptionItems.filter(it => !it.componentMaterial || !it.componentMaterial.trim());

    if (emptyMatItems.length === 0) continue;

    if (!materialMap) {
        phaseAStats.skippedNoFamily += emptyMatItems.length;
        console.log(`  ⚠ ${productName}: no family detected, skipping ${emptyMatItems.length} items`);
        continue;
    }

    let assigned = 0;
    let leftEmpty = 0;
    const details = [];

    // Pass 1: Level 1 + Level 2 for each item
    for (const item of emptyMatItems) {
        const text = `${item.productCharacteristic || ''} ${item.processCharacteristic || ''}`;
        const spec = item.specification || '';

        let materialCode = null;

        // Level 1: characteristic keywords
        for (const rule of LEVEL1_RULES) {
            if (rule.pattern.test(text)) {
                materialCode = rule.material;
                break;
            }
        }

        // Level 2: specification keywords (if Level 1 didn't match)
        if (!materialCode) {
            for (const rule of LEVEL2_SPEC_RULES) {
                if (rule.pattern.test(spec)) {
                    materialCode = rule.material;
                    break;
                }
            }
        }

        // Resolve code to full name
        if (materialCode) {
            const resolved = materialMap[materialCode] || '';
            if (resolved) {
                item.componentMaterial = resolved;
                assigned++;
                phaseAStats.assigned++;
                details.push(`    L1/L2: "${(item.productCharacteristic || item.processCharacteristic || '').slice(0, 50)}" → ${resolved} (code: ${materialCode})`);
            }
            // If materialMap returns '' for this code, item stays empty for Level 3
        }
    }

    // Pass 2: Level 3 — context inference for remaining empty items
    const stillEmpty = emptyMatItems.filter(it => !it.componentMaterial || !it.componentMaterial.trim());

    if (stillEmpty.length > 0) {
        // Group all reception items (including newly assigned) by processStepNumber
        const opGroups = new Map();
        for (const it of receptionItems) {
            const opNum = String(it.processStepNumber).replace(/^OP\s*/i, '').trim();
            if (!opGroups.has(opNum)) opGroups.set(opNum, []);
            opGroups.get(opNum).push(it);
        }

        for (const item of stillEmpty) {
            const opNum = String(item.processStepNumber).replace(/^OP\s*/i, '').trim();
            const groupItems = opGroups.get(opNum) || [];

            // Collect all materials already assigned in this operation
            const assignedMaterials = new Set();
            for (const gi of groupItems) {
                if (gi.componentMaterial && gi.componentMaterial.trim()) {
                    assignedMaterials.add(gi.componentMaterial.trim());
                }
            }

            const text = `${item.productCharacteristic || ''} ${item.processCharacteristic || ''}`.toLowerCase();

            // If exactly 1 unique material assigned → assign that to remaining items
            if (assignedMaterials.size === 1) {
                const mat = [...assignedMaterials][0];
                item.componentMaterial = mat;
                assigned++;
                phaseAStats.assigned++;
                phaseAStats.level3Assigned++;
                details.push(`    L3 (single-mat): "${(item.productCharacteristic || item.processCharacteristic || '').slice(0, 50)}" → ${mat}`);
                continue;
            }

            // If "certificado" or "remito" in text → use nearest neighbor's material
            if (/certificado|remito/.test(text)) {
                // Find nearest neighbor with material in same operation
                const neighbors = groupItems.filter(gi => gi.id !== item.id && gi.componentMaterial && gi.componentMaterial.trim());
                if (neighbors.length > 0) {
                    item.componentMaterial = neighbors[0].componentMaterial;
                    assigned++;
                    phaseAStats.assigned++;
                    phaseAStats.level3Assigned++;
                    details.push(`    L3 (neighbor): "${(item.productCharacteristic || item.processCharacteristic || '').slice(0, 50)}" → ${neighbors[0].componentMaterial}`);
                    continue;
                }
            }

            // Otherwise leave empty
            leftEmpty++;
            phaseAStats.leftEmpty++;
            details.push(`    ? empty: "${(item.productCharacteristic || item.processCharacteristic || '').slice(0, 60)}" (op ${opNum}, ${assignedMaterials.size} mats in group)`);
        }
    }

    phaseAStats.byProduct[productName] = {
        family,
        totalReception: receptionItems.length,
        emptyBefore: emptyMatItems.length,
        assigned,
        leftEmpty,
    };

    console.log(`  ${productName} [${family}]: ${assigned}/${emptyMatItems.length} assigned, ${leftEmpty} left empty`);
    for (const d of details) console.log(d);
}

console.log(`\n  Phase A total: ${phaseAStats.assigned} assigned (${phaseAStats.level3Assigned} via Level 3), ${phaseAStats.leftEmpty} left empty, ${phaseAStats.skippedNoFamily} skipped (no family)`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE B: Fix 4 HO residual gaps (Headrest Rear Center + Rear Outer)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE B: HO residual gaps (Headrest Rear Center + Rear Outer) ===');

const NON_OPERATOR_ROLES = /laboratorio|metrolog|auditor|calidad de proceso|supervisor.*calidad/i;

const phaseBStats = { qcCreated: 0, diagnostics: [], byProduct: {} };

for (const hoDoc of hoDocs) {
    const partDesc = (hoDoc.part_description || '').toLowerCase();
    const linkedProject = (hoDoc.linked_amfe_project || '').toLowerCase();

    // Only process Headrest Rear Center and Headrest Rear Outer
    const isRearCenter = /rear.*center/i.test(partDesc) || /rear.*center/i.test(linkedProject);
    const isRearOuter = /rear.*outer/i.test(partDesc) || /rear.*outer/i.test(linkedProject);
    if (!isRearCenter && !isRearOuter) continue;

    const cpDoc = findCpForHo(hoDoc);
    if (!cpDoc) {
        console.log(`  ⚠ No CP found for HO: ${hoDoc.part_description || hoDoc.part_number}`);
        continue;
    }

    const productName = hoDoc.part_description || hoDoc.part_number;
    const cpItems = cpDoc.data?.items || [];
    const sheets = hoDoc.data?.sheets || [];

    // Build set of CP item IDs already referenced by any HO qualityCheck
    const coveredCpItemIds = new Set();
    for (const sheet of sheets) {
        for (const qc of (sheet.qualityChecks || [])) {
            if (qc.cpItemId) coveredCpItemIds.add(qc.cpItemId);
        }
    }

    // Build map of sheet operationNumbers
    const sheetOpNumbers = new Set();
    for (const sheet of sheets) {
        const opNum = String(sheet.operationNumber).replace(/^OP\s*/i, '').trim();
        sheetOpNumbers.add(opNum);
    }

    // Check CP processStepNumbers not matching any sheet
    const cpOpNumbers = new Set();
    for (const cpItem of cpItems) {
        const opNum = String(cpItem.processStepNumber).replace(/^OP\s*/i, '').trim();
        cpOpNumbers.add(opNum);
    }

    for (const opNum of cpOpNumbers) {
        if (!sheetOpNumbers.has(opNum)) {
            const diag = `${productName}: CP processStepNumber ${opNum} has no matching HO sheet`;
            phaseBStats.diagnostics.push(diag);
            console.log(`    DIAG: ${diag}`);
        }
    }

    for (const sheetOpNum of sheetOpNumbers) {
        if (!cpOpNumbers.has(sheetOpNum)) {
            const diag = `${productName}: HO sheet operationNumber ${sheetOpNum} has no matching CP processStepNumber`;
            phaseBStats.diagnostics.push(diag);
            console.log(`    DIAG: ${diag}`);
        }
    }

    let created = 0;

    for (const cpItem of cpItems) {
        if (coveredCpItemIds.has(cpItem.id)) continue;

        // Skip non-operator roles
        if (NON_OPERATOR_ROLES.test(cpItem.reactionPlanOwner || '')) continue;

        // Determine target sheet by processStepNumber
        const cpOpNum = String(cpItem.processStepNumber).replace(/^OP\s*/i, '').trim();
        let targetSheet = sheets.find(sh => {
            const shOpNum = String(sh.operationNumber).replace(/^OP\s*/i, '').trim();
            return shOpNum === cpOpNum;
        });

        if (!targetSheet) {
            // Try to find sheet with closest operationNumber
            let closestSheet = null;
            let closestDiff = Infinity;
            const cpOpInt = parseInt(cpOpNum, 10);
            if (Number.isFinite(cpOpInt)) {
                for (const sh of sheets) {
                    const shOpInt = parseInt(String(sh.operationNumber).replace(/^OP\s*/i, '').trim(), 10);
                    if (Number.isFinite(shOpInt)) {
                        const diff = Math.abs(shOpInt - cpOpInt);
                        if (diff < closestDiff) {
                            closestDiff = diff;
                            closestSheet = sh;
                        }
                    }
                }
            }
            if (closestSheet) {
                const closestOpNum = String(closestSheet.operationNumber).replace(/^OP\s*/i, '').trim();
                console.log(`    MISMATCH: CP item OP ${cpOpNum} → placed in HO sheet OP ${closestOpNum} (closest)`);
                targetSheet = closestSheet;
            } else {
                console.log(`    SKIP: CP item OP ${cpOpNum} has no matching or close HO sheet`);
                continue;
            }
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

        console.log(`    + QC: "${(qcItem.characteristic || '').slice(0, 50)}" → sheet OP ${String(targetSheet.operationNumber).replace(/^OP\s*/i, '').trim()}`);
    }

    if (created > 0) {
        phaseBStats.byProduct[productName] = created;
        console.log(`  ${productName}: ${created} QC items created`);
    } else {
        console.log(`  ${productName}: 0 gaps found (all CP items covered or filtered)`);
    }
    phaseBStats.qcCreated += created;
}

console.log(`\n  Phase B total: ${phaseBStats.qcCreated} QC items created, ${phaseBStats.diagnostics.length} diagnostics`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE C: Specify ~32 generic evaluationTechnique
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE C: Specify generic evaluationTechnique ===');

const GENERIC_EVAL = /^\s*(visual|inspecci[oó]n|inspeccion|inspecci[oó]n\s*visual|inspeccion\s*visual)\s*$/i;

const EVAL_TECHNIQUE_RULES = [
    { pattern: /espesor|largo|ancho|di[aá]metro|contorno|cota|dimensional|medida/i, technique: 'Medición con calibre / flexómetro' },
    { pattern: /aspecto|color|grano|superficie|brillo|mancha|raya|apariencia/i, technique: 'Control visual contra patrón de aspecto' },
    { pattern: /peso\b|gramaje/i, technique: 'Pesaje en balanza digital' },
    { pattern: /dureza/i, technique: 'Durómetro Shore' },
    { pattern: /densidad/i, technique: 'Ensayo de densidad (laboratorio)' },
    { pattern: /certificado|coc\b|remito/i, technique: 'Verificación documental' },
    { pattern: /encastre|cierre|funcional|ajuste|clip/i, technique: 'Verificación funcional en dispositivo' },
    { pattern: /trazabilidad|identificaci[oó]n|lote|etiqueta/i, technique: 'Verificación documental de identificación' },
];

const phaseCStats = { specified: 0, leftGeneric: 0, byProduct: {} };

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number;
    const items = cpDoc.data?.items || [];
    let specified = 0;
    let leftGeneric = 0;

    for (const item of items) {
        if (!item.evaluationTechnique) continue;
        if (!GENERIC_EVAL.test(item.evaluationTechnique)) continue;

        const prodChar = item.productCharacteristic || '';
        const procChar = item.processCharacteristic || '';
        const combined = `${prodChar} ${procChar}`;

        let newTechnique = null;
        for (const rule of EVAL_TECHNIQUE_RULES) {
            if (rule.pattern.test(combined)) {
                newTechnique = rule.technique;
                break;
            }
        }

        if (newTechnique) {
            console.log(`    ${productName}: "${item.evaluationTechnique}" → "${newTechnique}" (char: "${(prodChar || procChar).slice(0, 40)}")`);
            item.evaluationTechnique = newTechnique;
            specified++;
            phaseCStats.specified++;
        } else {
            leftGeneric++;
            phaseCStats.leftGeneric++;
        }
    }

    if (specified > 0 || leftGeneric > 0) {
        phaseCStats.byProduct[productName] = { specified, leftGeneric };
    }
}

console.log(`\n  Phase C total: ${phaseCStats.specified} specified, ${phaseCStats.leftGeneric} left generic (no pattern match)`);

// ═══════════════════════════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Saving ===');

if (DRY_RUN) {
    console.log('  ⚠️  DRY RUN — no changes saved');
} else {
    let savedCount = 0;
    let errorCount = 0;

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

console.log('\n=== PHASE A: componentMaterial (3-level inference) ===');
for (const [prod, stats] of Object.entries(phaseAStats.byProduct)) {
    console.log(`  ${prod} [${stats.family}]: ${stats.assigned}/${stats.emptyBefore} assigned, ${stats.leftEmpty} left empty (of ${stats.totalReception} reception items)`);
}
console.log(`  Total: ${phaseAStats.assigned} assigned (${phaseAStats.level3Assigned} via L3), ${phaseAStats.leftEmpty} left empty, ${phaseAStats.skippedNoFamily} no family`);

console.log('\n=== PHASE B: HO residual gaps ===');
for (const [prod, count] of Object.entries(phaseBStats.byProduct)) {
    console.log(`  ${prod}: ${count} QC items created`);
}
if (phaseBStats.diagnostics.length > 0) {
    console.log('  Diagnostics:');
    for (const d of phaseBStats.diagnostics) {
        console.log(`    ${d}`);
    }
}
console.log(`  Total: ${phaseBStats.qcCreated} QC items created`);

console.log('\n=== PHASE C: evaluationTechnique ===');
for (const [prod, stats] of Object.entries(phaseCStats.byProduct)) {
    console.log(`  ${prod}: ${stats.specified} specified, ${stats.leftGeneric} left generic`);
}
console.log(`  Total: ${phaseCStats.specified} specified, ${phaseCStats.leftGeneric} left generic`);

// Final summary table
console.log('\n=== FINAL SUMMARY TABLE ===');
console.log('┌──────────────────────────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
console.log('│ Product                                  │ Mat Asn  │ Mat Left │ HO QCs   │ Eval Spc │ Eval Gen │');
console.log('├──────────────────────────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

const allProducts = new Set();
for (const cpDoc of cpDocs) {
    allProducts.add(cpDoc.project_name || cpDoc.part_name || cpDoc.part_number);
}
for (const hoDoc of hoDocs) {
    allProducts.add(hoDoc.part_description || hoDoc.part_number);
}

for (const prod of allProducts) {
    const name = prod.padEnd(40).slice(0, 40);

    const matStats = phaseAStats.byProduct[prod];
    const matAssigned = matStats ? String(matStats.assigned) : '-';
    const matLeft = matStats ? String(matStats.leftEmpty) : '-';

    const hoQCs = phaseBStats.byProduct[prod] !== undefined ? String(phaseBStats.byProduct[prod]) : '-';

    const evalStats = phaseCStats.byProduct[prod];
    const evalSpec = evalStats ? String(evalStats.specified) : '-';
    const evalGen = evalStats ? String(evalStats.leftGeneric) : '-';

    console.log(`│ ${name} │ ${matAssigned.padStart(8)} │ ${matLeft.padStart(8)} │ ${hoQCs.padStart(8)} │ ${evalSpec.padStart(8)} │ ${evalGen.padStart(8)} │`);
}

console.log('└──────────────────────────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

console.log(`\n${DRY_RUN ? '⚠️  DRY RUN completado (sin cambios guardados)' : '✓ Fix completado exitosamente'}`);
process.exit(0);

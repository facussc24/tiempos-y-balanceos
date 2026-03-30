/**
 * Fix raiz: Severidades AMFE OP 10 + materiales faltantes + cascada CP→HO
 *
 * Cadena causal: AMFE sin severity → AP incalculable → CC/SC sin clasificar
 *                → CP no genera items individuales → HO queda vacia
 *
 * Fases:
 *   A. Asignar severidades a failures AMFE OP 10
 *   B. Agregar materiales faltantes del BOM al AMFE OP 10
 *   C. Actualizar CP items (agregar nuevos, poblar componentMaterial, CC/SC)
 *   D. Crear QC items en HO OP 10 desde CP
 *
 * USO: node scripts/fixAmfeSeverityCascade.mjs [--dry-run]
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
console.log('\n=== Loading documents ===');

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

// Parse JSON data (Supabase might return as string or object)
for (const doc of [...amfeDocs, ...cpDocs, ...hoDocs]) {
    if (typeof doc.data === 'string') doc.data = JSON.parse(doc.data);
}

// ─── Helper: match AMFE doc to CP/HO doc ──────────────────────────────
// AMFE.part_number might be a description, not a part number.
// Use project_name for CP (both have it), linked_amfe_project for HO.
function findMatchingCp(amfeDoc) {
    // Try project_name first (most reliable)
    let match = cpDocs.find(cp => cp.project_name === amfeDoc.project_name);
    if (match) return match;
    // Fallback: part_number
    return cpDocs.find(cp => cp.part_number === amfeDoc.part_number);
}
function findMatchingHo(amfeDoc) {
    // Try linked_amfe_project (HO links back to AMFE project)
    let match = hoDocs.find(ho => ho.linked_amfe_project === amfeDoc.project_name);
    if (match) return match;
    // Fallback: part_description matches AMFE part_number (description)
    match = hoDocs.find(ho => ho.part_description === amfeDoc.part_number);
    if (match) return match;
    // Fallback: part_number exact
    return hoDocs.find(ho => ho.part_number === amfeDoc.part_number);
}

// ─── Helper: compare op numbers (handles string "10" vs number 10) ─────
function isOp10(opNum) {
    const s = String(opNum).replace(/^OP\s*/i, '').trim();
    return s === '10';
}

// ─── Severity assignment table ─────────────────────────────────────────
// Patterns are matched against failure.description (lowercased)
const SEVERITY_RULES = [
    // S=9 — Safety
    { pattern: /flamabilidad|inflamab/i, severity: 9, justification: 'Seguridad - TL 1010' },
    { pattern: /emisiones|voc|vw\s*50180|volatile/i, severity: 9, justification: 'Seguridad - normativa emisiones' },
    // S=7 — Functional (stops VW line)
    { pattern: /color\s*equivocado|color\s*incorrecto.*ensambl/i, severity: 7, justification: 'Falla funcional - para linea VW' },
    { pattern: /desprendimiento|delaminacion\s*sever/i, severity: 7, justification: 'Falla funcional - desprendimiento' },
    // S=6 — Out of spec, rework offline
    { pattern: /especificacion\s*erronea|fuera\s*de\s*especificacion|spec.*erron/i, severity: 6, justification: 'Fuera de tolerancia, retrabajo offline' },
    { pattern: /gramaje\s*fuera|peso\s*fuera/i, severity: 6, justification: 'Afecta peso/resistencia del producto' },
    { pattern: /material\s*distinto|material\s*equivocado|material\s*incorrecto/i, severity: 6, justification: 'Material equivocado en proceso' },
    { pattern: /llenado\s*incompleto|short\s*shot|inyeccion.*incompleta/i, severity: 6, justification: 'Scrap, retrabajo offline' },
    { pattern: /dimensional.*fuera|fuera.*dimensional|deformacion/i, severity: 6, justification: 'Fuera de tolerancia dimensional' },
    { pattern: /espesor\s*fuera|dureza\s*fuera|densidad\s*fuera/i, severity: 6, justification: 'Propiedad fisica fuera de rango' },
    { pattern: /cycoloy|pc\/abs|pc.abs.*fuera/i, severity: 6, justification: 'Sustrato fuera de spec' },
    { pattern: /sikamelt|adhesivo.*fuera|adhesivo.*vencid/i, severity: 6, justification: 'Adhesivo fuera de spec/vencido' },
    { pattern: /tpu.*barrier|barrier.*tape/i, severity: 6, justification: 'Material critico sellado espuma' },
    // S=5 — Cosmetic/rework
    { pattern: /golpead|dana.*transport|embalaje\s*inadecuad|material\s*danado/i, severity: 5, justification: 'Defecto cosmetico retrabajable' },
    { pattern: /contaminacion|suciedad|mancha/i, severity: 5, justification: 'Cosmetico, retrabajo offline' },
    { pattern: /omision.*verificacion|omision.*inspeccion|omision.*recepcion|omitir\s*inspeccion/i, severity: 5, justification: 'Material sin control' },
    { pattern: /ancho\s*fuera/i, severity: 5, justification: 'Retrabajo de corte' },
    { pattern: /rebaba|flash\s*exces/i, severity: 5, justification: 'Retrabajo offline' },
    { pattern: /aspecto|visual.*defect|arruga/i, severity: 5, justification: 'Defecto de aspecto' },
    { pattern: /fabric.*rennes|tela.*rennes/i, severity: 5, justification: 'Cosmetico tela decorativa' },
    // S=4 — Administrative/minor
    { pattern: /documentacion|trazabilidad|certificado.*faltante|registro/i, severity: 4, justification: 'Administrativo' },
    { pattern: /identificacion\s*incorrecta|etiquetado|rotulado/i, severity: 4, justification: 'Administrativo, corregible' },
    { pattern: /hilo.*decorativo|hilo.*20\/3/i, severity: 4, justification: 'Cosmetico menor' },
];

function assignSeverity(failureDescription) {
    const desc = (failureDescription || '').toLowerCase();
    for (const rule of SEVERITY_RULES) {
        if (rule.pattern.test(desc)) {
            return { severity: rule.severity, justification: rule.justification };
        }
    }
    // Default: 5 (cosmetic rework)
    return { severity: 5, justification: 'Default - defecto cosmetico retrabajable' };
}

// ─── CC/SC Classification ──────────────────────────────────────────────
function classifySpecialChar(severity, failureDescription) {
    if (severity >= 9) return 'CC';
    if (severity >= 7) {
        const desc = (failureDescription || '').toLowerCase();
        if (/color|encastre|desprendimiento|funcional|ensambl|fijacion/.test(desc)) return 'SC';
    }
    return '';
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE A: Assign severities to AMFE OP 10 failures
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== FASE A: Asignar severidades AMFE OP 10 ===');

const phaseAStats = { failuresFixed: 0, causesRecalculated: 0, ccAssigned: 0, scAssigned: 0, byProduct: {} };

for (const amfeDoc of amfeDocs) {
    const ops = amfeDoc.data?.operations || [];
    // Find OP 10 (or OP 5 for Top Roll which might have reception there)
    const op10 = ops.find(op => isOp10(op.opNumber));
    if (!op10) continue;

    const productName = amfeDoc.project_name || amfeDoc.part_number;
    phaseAStats.byProduct[productName] = { before: 0, after: 0 };

    // Walk: workElements → functions → failures → causes
    for (const we of (op10.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                const currentS = Number(fail.severity);
                const hasValidSeverity = Number.isFinite(currentS) && currentS >= 1 && currentS <= 10;

                if (hasValidSeverity) {
                    phaseAStats.byProduct[productName].before++;
                }

                // Assign severity
                const { severity, justification } = assignSeverity(fail.description);
                fail.severity = severity;
                phaseAStats.byProduct[productName].after++;

                if (!hasValidSeverity) {
                    phaseAStats.failuresFixed++;
                }

                // Recalculate AP and CC/SC for all causes
                const specialChar = classifySpecialChar(severity, fail.description);
                for (const cause of (fail.causes || [])) {
                    const o = Number(cause.occurrence);
                    const d = Number(cause.detection);
                    const newAp = calculateAP(severity, o, d);
                    if (newAp !== cause.ap) {
                        cause.ap = newAp;
                        phaseAStats.causesRecalculated++;
                    }
                    // CC/SC: only set if not manually overridden (empty = not overridden)
                    if (!cause.specialChar || cause.specialChar === '') {
                        cause.specialChar = specialChar;
                    }
                    if (specialChar === 'CC') phaseAStats.ccAssigned++;
                    if (specialChar === 'SC') phaseAStats.scAssigned++;
                }
            }
        }
    }
}

console.log(`  Failures con severity corregida: ${phaseAStats.failuresFixed}`);
console.log(`  Causes con AP recalculado: ${phaseAStats.causesRecalculated}`);
console.log(`  CC asignados: ${phaseAStats.ccAssigned}, SC asignados: ${phaseAStats.scAssigned}`);
for (const [prod, stats] of Object.entries(phaseAStats.byProduct)) {
    console.log(`  ${prod}: ${stats.before} → ${stats.after} failures con S`);
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE B: Add missing BOM materials to AMFE OP 10
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== FASE B: Agregar materiales faltantes al AMFE OP 10 ===');

function createMaterialFailure(materialName, severity, effectDetail) {
    const s = severity;
    const o = 3; // Proveedor entrega no conforme = baja frecuencia
    const d = 5; // Inspeccion visual + dimensional en recepcion
    const ap = calculateAP(s, o, d);
    const specialChar = classifySpecialChar(s, materialName);

    return {
        id: randomUUID(),
        description: `${materialName} fuera de especificacion`,
        effectLocal: effectDetail || 'Retraso en produccion, rechazo del lote',
        effectNextLevel: 'Material no conforme ingresa al proceso',
        effectEndUser: 'Defecto en producto terminado',
        severity: s,
        causes: [{
            id: randomUUID(),
            cause: `Proveedor entrega ${materialName} fuera de especificacion`,
            preventionControl: 'Certificado de calidad del proveedor y auditorias periodicas',
            detectionControl: 'Inspeccion visual y dimensional en recepcion',
            occurrence: o,
            detection: d,
            ap: ap,
            characteristicNumber: '',
            specialChar: specialChar,
            filterCode: '',
            preventionAction: '',
            detectionAction: '',
            responsible: '',
            targetDate: '',
            status: '',
            actionTaken: '',
            completionDate: '',
            severityNew: '',
            occurrenceNew: '',
            detectionNew: '',
            apNew: '',
            observations: '',
        }],
    };
}

// Materials to add per product type
const MATERIALS_TO_ADD = {
    headrest: [
        { name: 'Fabric Rennes (Jacquard TPB-8VA)', severity: 5, effect: 'Tela decorativa no conforme, retrabajo en costura' },
        { name: 'Hilo decorativo 20/3', severity: 4, effect: 'Costura decorativa con hilo incorrecto, defecto cosmetico' },
        { name: 'TPU barrier tape', severity: 6, effect: 'Sellado de espuma deficiente, fuga de PU en costura' },
    ],
    armrest_dp: [
        { name: 'PC/ABS CYCOLOY LG9000 (sustrato)', severity: 6, effect: 'Sustrato con MFI/color incorrecto, scrap o retrabajo' },
        { name: 'Adhesivo SikaMelt-171', severity: 6, effect: 'Adhesivo vencido o fuera de spec, falla de pegado en proceso' },
    ],
};

const phaseBStats = { failuresAdded: 0, byProduct: {} };

for (const amfeDoc of amfeDocs) {
    const productName = amfeDoc.project_name || amfeDoc.part_number;
    const partNum = (amfeDoc.part_number || '').toUpperCase();
    const projName = (amfeDoc.project_name || '').toLowerCase();

    let materialsToAdd = [];

    // Detect product type
    const isHeadrest = /headrest|881901|885900|885901/i.test(partNum) || /headrest/i.test(projName);
    const isArmrestDp = /armrest.*door|n\s*231/i.test(partNum) || /armrest.*door/i.test(projName);

    if (isHeadrest) materialsToAdd = MATERIALS_TO_ADD.headrest;
    else if (isArmrestDp) materialsToAdd = MATERIALS_TO_ADD.armrest_dp;

    if (materialsToAdd.length === 0) continue;

    const ops = amfeDoc.data?.operations || [];
    const op10 = ops.find(op => isOp10(op.opNumber));
    if (!op10) continue;

    // Check which failures already exist (by description match)
    const existingDescs = new Set();
    for (const we of (op10.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                existingDescs.add((fail.description || '').toLowerCase());
            }
        }
    }

    // Find the Material work element, or create one
    let materialWe = op10.workElements?.find(we => we.type === 'Material');
    if (!materialWe) {
        materialWe = {
            id: randomUUID(),
            type: 'Material',
            name: 'Materias primas',
            functions: [{
                id: randomUUID(),
                description: 'Recibir material conforme a especificacion',
                requirements: '',
                failures: [],
            }],
        };
        op10.workElements = op10.workElements || [];
        op10.workElements.push(materialWe);
    }

    // Find first function in the Material WE
    let targetFunction = materialWe.functions?.[0];
    if (!targetFunction) {
        targetFunction = {
            id: randomUUID(),
            description: 'Recibir material conforme a especificacion',
            requirements: '',
            failures: [],
        };
        materialWe.functions = [targetFunction];
    }

    phaseBStats.byProduct[productName] = 0;

    for (const mat of materialsToAdd) {
        const descLower = `${mat.name} fuera de especificacion`.toLowerCase();
        // Check if similar failure already exists
        const alreadyExists = [...existingDescs].some(d =>
            d.includes(mat.name.toLowerCase().split('(')[0].trim().split(' ')[0])
        );
        if (alreadyExists) continue;

        const newFailure = createMaterialFailure(mat.name, mat.severity, mat.effect);
        targetFunction.failures = targetFunction.failures || [];
        targetFunction.failures.push(newFailure);
        phaseBStats.failuresAdded++;
        phaseBStats.byProduct[productName]++;
        console.log(`  + ${productName}: "${newFailure.description}" (S=${mat.severity})`);
    }
}

console.log(`  Total failures agregados: ${phaseBStats.failuresAdded}`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE C: Update CP items for OP 10
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== FASE C: Actualizar CP items OP 10 ===');

const phaseCStats = { itemsAdded: 0, materialsFilled: 0, classificationUpdated: 0, byProduct: {} };

// Map from AMFE failure description pattern → componentMaterial name
const MATERIAL_MAP = [
    { pattern: /pvc|vinilo|vinyl/i, material: 'PVC/Vinilo' },
    { pattern: /espuma|foam|pur|polyol/i, material: 'Espuma PUR' },
    { pattern: /hilo|costura|thread/i, material: 'Hilo costura' },
    { pattern: /tela|fabric|rennes|jacquard/i, material: 'Tela/Fabric' },
    { pattern: /pc.*abs|cycoloy|sustrato/i, material: 'PC/ABS CYCOLOY' },
    { pattern: /adhesivo|sikamelt/i, material: 'Adhesivo SikaMelt' },
    { pattern: /tpu|barrier|tape|cinta.*tesa/i, material: 'Cinta/TPU' },
    { pattern: /tpo|bilaminate/i, material: 'TPO Bilaminate' },
    { pattern: /hilo.*decorativo|20\/3/i, material: 'Hilo decorativo' },
    { pattern: /flamabilidad|inflamab/i, material: '' }, // flamabilidad applies to all materials
    { pattern: /gramaje/i, material: 'Tela principal' },
    { pattern: /ancho/i, material: 'Tela principal' },
];

function inferMaterial(description) {
    const desc = (description || '').toLowerCase();
    for (const m of MATERIAL_MAP) {
        if (m.pattern.test(desc)) return m.material;
    }
    return '';
}

// Specification data from real reference files (INVENTARIO_ARCHIVOS_REFERENCIA.md)
const SPEC_MAP = {
    'Fabric Rennes': 'Jacquard Woven Aunde TPB-8VA + Ether-PUR 1.5+0.5mm + Base 50 g/m2',
    'Hilo decorativo 20/3': 'Polyester 20/3 Nm, segun VW 50106 tipo D',
    'TPU barrier tape': 'TPU termoplastico, segun especificacion de ingenieria',
    'PC/ABS CYCOLOY LG9000': 'PC/ABS CYCOLOY RESIN LG9000 low gloss (SABIC)',
    'Adhesivo SikaMelt-171': 'SikaMelt-171, verificar fecha de vencimiento y lote',
};

function inferSpec(materialName) {
    for (const [key, spec] of Object.entries(SPEC_MAP)) {
        if (materialName.toLowerCase().includes(key.toLowerCase().split(' ')[0])) return spec;
    }
    return 'Segun certificado del proveedor';
}

for (const amfeDoc of amfeDocs) {
    const cpDoc = findMatchingCp(amfeDoc);
    if (!cpDoc) continue;

    const productName = amfeDoc.project_name || amfeDoc.part_number;
    phaseCStats.byProduct[productName] = { added: 0, materialFilled: 0 };

    const cpItems = cpDoc.data?.items || [];
    const op10Items = cpItems.filter(it => isOp10(it.processStepNumber));

    // C.1: Populate componentMaterial where missing
    for (const item of op10Items) {
        if (!item.componentMaterial || item.componentMaterial.trim() === '') {
            const mat = inferMaterial(item.productCharacteristic || item.processCharacteristic || '');
            if (mat) {
                item.componentMaterial = mat;
                phaseCStats.materialsFilled++;
                phaseCStats.byProduct[productName].materialFilled++;
            }
        }
    }

    // C.2: Update specialCharClass based on AMFE severity
    // Build map: AMFE failure description → severity
    const ops = amfeDoc.data?.operations || [];
    const op10 = ops.find(op => isOp10(op.opNumber));
    if (!op10) continue;

    const failureSeverityMap = new Map(); // description (lowered) → severity
    for (const we of (op10.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                failureSeverityMap.set((fail.description || '').toLowerCase(), Number(fail.severity));
            }
        }
    }

    for (const item of op10Items) {
        // Try to find matching severity
        const charDesc = (item.productCharacteristic || item.processCharacteristic || '').toLowerCase();
        let matchedSeverity = null;
        for (const [failDesc, sev] of failureSeverityMap) {
            // Check if item characteristic relates to this failure
            if (charDesc.includes(failDesc.split(' ')[0]) || failDesc.includes(charDesc.split(' ')[0])) {
                if (matchedSeverity === null || sev > matchedSeverity) matchedSeverity = sev;
            }
        }
        // Flamabilidad → always CC
        if (/flamabilidad|inflamab/i.test(charDesc)) {
            if (item.specialCharClass !== 'CC') {
                item.specialCharClass = 'CC';
                phaseCStats.classificationUpdated++;
            }
        } else if (/emisiones|voc/i.test(charDesc)) {
            if (item.specialCharClass !== 'CC') {
                item.specialCharClass = 'CC';
                phaseCStats.classificationUpdated++;
            }
        }
    }

    // C.3: Add CP items for new AMFE failures (from Phase B)
    // Collect IDs of AMFE failures already covered by CP items
    const coveredFailureIds = new Set(
        op10Items.map(it => it.amfeFailureId).filter(Boolean)
    );
    // Also collect covered material keywords from existing CP items
    const coveredMaterialKeywords = new Set();
    for (const it of op10Items) {
        const text = `${it.productCharacteristic || ''} ${it.processCharacteristic || ''} ${it.componentMaterial || ''}`.toLowerCase();
        // Extract specific material keywords
        for (const kw of ['flamabilidad', 'gramaje', 'espesor', 'color', 'aspecto', 'densidad', 'peso', 'ancho',
            'pvc', 'vinilo', 'espuma', 'hilo', 'tela', 'adhesivo', 'pc/abs', 'cycoloy', 'sikamelt',
            'fabric', 'rennes', 'tpu', 'barrier', 'tpo', 'bilaminate', 'cinta', 'tesa']) {
            if (text.includes(kw)) coveredMaterialKeywords.add(kw);
        }
    }

    for (const we of (op10.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                const failDescLower = (fail.description || '').toLowerCase();

                // Check if this failure ID is already covered
                if (coveredFailureIds.has(fail.id)) continue;

                // Check if the specific material keyword is already covered
                const failMaterialKeywords = [];
                for (const kw of ['rennes', 'fabric', 'hilo.*decorativo', 'tpu.*barrier', 'barrier.*tape',
                    'cycoloy', 'pc.abs', 'sikamelt', 'adhesivo.*sika', 'tpo.*bilaminate', 'cinta.*tesa']) {
                    if (new RegExp(kw, 'i').test(failDescLower)) failMaterialKeywords.push(kw.replace(/\.\*/g, ''));
                }

                // If this failure has specific material keywords and they're all already covered, skip
                if (failMaterialKeywords.length > 0) {
                    const allCovered = failMaterialKeywords.every(kw =>
                        [...coveredMaterialKeywords].some(ckw => ckw.includes(kw.split(/[^a-z]/)[0]))
                    );
                    if (allCovered) continue;
                }

                // For generic failures (no specific material keyword), check by description similarity
                if (failMaterialKeywords.length === 0) {
                    // Only add if this specific failure type isn't already covered
                    const alreadyExists = op10Items.some(it => {
                        const itDesc = (it.productCharacteristic || '').toLowerCase();
                        return itDesc === failDescLower ||
                               (failDescLower.length > 10 && itDesc.includes(failDescLower.slice(0, 20)));
                    });
                    if (alreadyExists) continue;
                }

                // Only add items for failures with valid severity
                const sev = Number(fail.severity);
                if (!Number.isFinite(sev) || sev < 1) continue;

                // Get AP from first cause
                const firstCause = (fail.causes || [])[0];
                const ap = firstCause?.ap || 'L';
                const specialChar = classifySpecialChar(sev, fail.description);

                // Note: we add items for ALL new failures regardless of AP.
                // The user explicitly needs material traceability in the CP.
                // AP=L items would normally be grouped, but for new BOM materials
                // we want individual items for clear traceability.

                const materialName = fail.description.replace(/\s*fuera de especificacion/i, '').trim();
                const spec = inferSpec(materialName);

                // Product row (detection)
                const newCpItem = {
                    id: randomUUID(),
                    processStepNumber: '10',
                    processDescription: op10.name || 'RECEPCION DE MATERIA PRIMA',
                    machineDeviceTool: 'N/A',
                    componentMaterial: inferMaterial(fail.description) || materialName,
                    characteristicNumber: '',
                    productCharacteristic: fail.description,
                    processCharacteristic: '',
                    specialCharClass: specialChar,
                    specification: spec,
                    evaluationTechnique: firstCause?.detectionControl || 'Inspeccion visual y dimensional en recepcion',
                    sampleSize: ap === 'H' ? '100%' : '1 muestra',
                    sampleFrequency: 'Cada recepcion',
                    controlMethod: firstCause?.preventionControl || 'Verificacion de certificado vs especificacion',
                    reactionPlan: 'Segregar lote, notificar s/ P-14',
                    reactionPlanOwner: sev >= 7 ? 'Inspector de Calidad' : 'Recepcion de materiales',
                    controlProcedure: 'P-14.',
                    autoFilledFields: ['specification', 'evaluationTechnique', 'sampleSize', 'sampleFrequency', 'controlMethod', 'reactionPlan', 'reactionPlanOwner', 'controlProcedure'],
                    amfeCauseIds: firstCause ? [firstCause.id] : [],
                    amfeFailureId: fail.id,
                    amfeAp: ap,
                    amfeSeverity: sev,
                    operationCategory: 'reception',
                };

                cpDoc.data.items.push(newCpItem);
                phaseCStats.itemsAdded++;
                phaseCStats.byProduct[productName].added++;
                coveredFailureIds.add(fail.id); // Prevent duplicates
                console.log(`  + ${productName} CP: "${fail.description}" (S=${sev}, AP=${ap})`);
            }
        }
    }
}

console.log(`  Items CP agregados: ${phaseCStats.itemsAdded}`);
console.log(`  componentMaterial poblado: ${phaseCStats.materialsFilled}`);
console.log(`  Clasificaciones CC/SC actualizadas: ${phaseCStats.classificationUpdated}`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE D: Create QC items in HO OP 10 from CP
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== FASE D: Crear QC items en HO OP 10 desde CP ===');

// Roles that should NOT go to HO (lab, metrology, auditor)
const NON_HO_ROLES = /laboratorio|metrolog|auditor/i;
const NON_HO_TECHNIQUES = /ensayo\s*de\s*laboratorio|certificado\s*de\s*laboratorio|equipo\s*de\s*laboratorio/i;

const phaseDStats = { qcCreated: 0, byProduct: {} };

for (const amfeDoc of amfeDocs) {
    const cpDoc = findMatchingCp(amfeDoc);
    const hoDoc = findMatchingHo(amfeDoc);
    if (!cpDoc || !hoDoc) continue;

    const productName = amfeDoc.project_name || amfeDoc.part_number;
    phaseDStats.byProduct[productName] = 0;

    // Find HO sheet for OP 10
    const sheets = hoDoc.data?.sheets || [];
    const hoSheet = sheets.find(sh => isOp10(sh.operationNumber));
    if (!hoSheet) continue;

    // Check if it already has QC items
    const existingQcIds = new Set((hoSheet.qualityChecks || []).map(qc => qc.cpItemId).filter(Boolean));

    // Get CP items for OP 10
    const cpItems = (cpDoc.data?.items || []).filter(it => isOp10(it.processStepNumber));

    for (const cpItem of cpItems) {
        // Skip if already linked
        if (existingQcIds.has(cpItem.id)) continue;

        // Skip lab/metrology/auditor controls
        if (NON_HO_ROLES.test(cpItem.reactionPlanOwner || '')) continue;
        if (NON_HO_TECHNIQUES.test(cpItem.evaluationTechnique || '')) continue;

        // Create QC item
        const qcItem = {
            id: randomUUID(),
            cpItemId: cpItem.id,
            characteristic: cpItem.productCharacteristic || cpItem.processCharacteristic || '',
            specification: cpItem.specification || '',
            evaluationTechnique: cpItem.evaluationTechnique || '',
            frequency: cpItem.sampleFrequency || 'Cada recepcion',
            controlMethod: cpItem.controlMethod || '',
            reactionAction: cpItem.reactionPlan || 'Segregar lote, notificar s/ P-14',
            reactionContact: cpItem.reactionPlanOwner || 'Recepcion de materiales',
            specialCharSymbol: cpItem.specialCharClass || '',
            registro: '',
        };

        hoSheet.qualityChecks = hoSheet.qualityChecks || [];
        hoSheet.qualityChecks.push(qcItem);
        phaseDStats.qcCreated++;
        phaseDStats.byProduct[productName]++;
    }

    if (phaseDStats.byProduct[productName] > 0) {
        console.log(`  + ${productName}: ${phaseDStats.byProduct[productName]} QC items creados en HO OP 10`);
    }
}

console.log(`  Total QC items creados: ${phaseDStats.qcCreated}`);

// ═══════════════════════════════════════════════════════════════════════
// PHASE E: Save and verify
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== FASE E: Guardar y verificar ===');

if (DRY_RUN) {
    console.log('  ⚠️  DRY RUN — no se guardan cambios');
} else {
    let savedCount = 0;

    // Save AMFEs
    for (const doc of amfeDocs) {
        const { error } = await supabase
            .from('amfe_documents')
            .update({ data: doc.data })
            .eq('id', doc.id);
        if (error) console.error(`  ✗ Error saving AMFE ${doc.part_number}: ${error.message}`);
        else savedCount++;
    }

    // Save CPs
    for (const doc of cpDocs) {
        const { error } = await supabase
            .from('cp_documents')
            .update({ data: doc.data })
            .eq('id', doc.id);
        if (error) console.error(`  ✗ Error saving CP ${doc.part_number}: ${error.message}`);
        else savedCount++;
    }

    // Save HOs
    for (const doc of hoDocs) {
        const { error } = await supabase
            .from('ho_documents')
            .update({ data: doc.data })
            .eq('id', doc.id);
        if (error) console.error(`  ✗ Error saving HO ${doc.part_number}: ${error.message}`);
        else savedCount++;
    }

    console.log(`  ✓ ${savedCount} documentos guardados`);
}

// ─── Verification ──────────────────────────────────────────────────────
console.log('\n=== VERIFICACION FINAL ===');

// Count undefined severities in OP 10
let undefinedSeverities = 0;
let totalFailuresOp10 = 0;
for (const doc of amfeDocs) {
    const ops = doc.data?.operations || [];
    const op10 = ops.find(op => isOp10(op.opNumber));
    if (!op10) continue;
    for (const we of (op10.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                totalFailuresOp10++;
                const s = Number(fail.severity);
                if (!Number.isFinite(s) || s < 1 || s > 10) undefinedSeverities++;
            }
        }
    }
}

// Count HOs with 0 QC in OP 10
let hosWithZeroQc = 0;
let hosWithQc = 0;
for (const doc of hoDocs) {
    const sheets = doc.data?.sheets || [];
    const hoSheet = sheets.find(sh => isOp10(sh.operationNumber));
    if (!hoSheet) continue;
    if ((hoSheet.qualityChecks || []).length === 0) hosWithZeroQc++;
    else hosWithQc++;
}

// AP distribution
const apDist = { H: 0, M: 0, L: 0, empty: 0 };
for (const doc of amfeDocs) {
    const ops = doc.data?.operations || [];
    const op10 = ops.find(op => isOp10(op.opNumber));
    if (!op10) continue;
    for (const we of (op10.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fail of (fn.failures || [])) {
                for (const cause of (fail.causes || [])) {
                    if (cause.ap === 'H') apDist.H++;
                    else if (cause.ap === 'M') apDist.M++;
                    else if (cause.ap === 'L') apDist.L++;
                    else apDist.empty++;
                }
            }
        }
    }
}

console.log(`  Failures OP 10 totales: ${totalFailuresOp10}`);
console.log(`  Severidades undefined: ${undefinedSeverities} ${undefinedSeverities === 0 ? '✓' : '✗'}`);
console.log(`  HOs con 0 QC en OP 10: ${hosWithZeroQc} (con QC: ${hosWithQc})`);
console.log(`  Distribucion AP: H=${apDist.H} M=${apDist.M} L=${apDist.L} vacio=${apDist.empty}`);

// Summary table
console.log('\n=== TABLA RESUMEN ANTES/DESPUES ===');
console.log('┌──────────────────────────┬────────────┬──────────┬────────┐');
console.log('│ Producto                 │ S corregid │ CP items │ HO QCs │');
console.log('├──────────────────────────┼────────────┼──────────┼────────┤');
for (const amfeDoc of amfeDocs) {
    const name = (amfeDoc.project_name || amfeDoc.part_number).padEnd(24).slice(0, 24);
    const sFixed = String(phaseAStats.byProduct[amfeDoc.project_name || amfeDoc.part_number]?.after || 0).padStart(10);
    const cpAdded = String(phaseCStats.byProduct[amfeDoc.project_name || amfeDoc.part_number]?.added || 0).padStart(8);
    const hoQc = String(phaseDStats.byProduct[amfeDoc.project_name || amfeDoc.part_number] || 0).padStart(6);
    console.log(`│ ${name} │ ${sFixed} │ ${cpAdded} │ ${hoQc} │`);
}
console.log('└──────────────────────────┴────────────┴──────────┴────────┘');

console.log(`\n${DRY_RUN ? '⚠️  DRY RUN completado (sin cambios guardados)' : '✓ Fix completado exitosamente'}`);
process.exit(0);

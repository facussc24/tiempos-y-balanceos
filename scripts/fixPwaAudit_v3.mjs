/**
 * Fix: PWA Audit 2026-04-06 v3 — Items 3, 4, 5 + grouped WE split
 *
 * Item 3: Clean wrong operations in Planas AMFE, align to reference process
 * Item 4: Align operation names across PFD, AMFE, CP, HO for both products
 * Item 5: Add missing operations to Termoformadas AMFE (OP 80, 90, 11, 61)
 * Extra:  Split grouped work elements (1M per line)
 *
 * USO: node scripts/fixPwaAudit_v3.mjs           (dry-run, default)
 *       node scripts/fixPwaAudit_v3.mjs --apply   (save changes)
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const DRY_RUN = !process.argv.includes('--apply');
if (DRY_RUN) console.log('DRY RUN — use --apply to save changes.\n');

// ============================================================================
// SUPABASE CONNECTION
// ============================================================================
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
console.log('Auth OK\n');

// ============================================================================
// LOAD ALL DATA
// ============================================================================
const { data: AA } = await sb.from('amfe_documents').select('id,project_name,part_number,data');
const { data: CC } = await sb.from('cp_documents').select('id,project_name,part_number,part_name,data');
const { data: HH } = await sb.from('ho_documents').select('id,part_number,part_description,linked_amfe_project,data');
const { data: PP } = await sb.from('pfd_documents').select('id,part_number,data');
for (const d of [...AA, ...CC, ...HH, ...PP]) {
    if (typeof d.data === 'string') d.data = JSON.parse(d.data);
}

// Find PWA documents
const aP = AA.find(d => (d.project_name || '').toLowerCase().includes('plana'));
const aT = AA.find(d => (d.project_name || '').toLowerCase().includes('termoformad'));
const cP = CC.find(d => (d.project_name || '').toLowerCase().includes('plana'));
const cT = CC.find(d => (d.project_name || '').toLowerCase().includes('termoformad'));
const hP = HH.find(d => (d.linked_amfe_project || '').toLowerCase().includes('plana'));
const hT = HH.find(d => (d.linked_amfe_project || '').toLowerCase().includes('termoformad'));
const pP = PP.find(d => (d.part_number || '') === '21-9463');
const pT = PP.find(d => {
    const pn = d.part_number || '';
    return pn.includes('TBD') || pn.includes('9640') || pn.includes('582');
});

for (const [k, v] of Object.entries({ aP, aT, cP, cT, hP, hT, pP, pT })) {
    console.log(`${k}: ${v ? 'OK (' + v.id.substring(0, 8) + ')' : 'MISSING'}`);
}
if (!aP || !aT) { console.error('FATAL: Missing AMFE documents'); process.exit(1); }

function opN(s) { return parseInt(String(s).replace(/[^0-9]/g, '') || '999'); }

const stats = { item3: 0, item4: 0, item5: 0, weSplit: 0 };

// ============================================================================
// ITEM 3: CLEAN WRONG OPERATIONS IN PLANAS AMFE
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('ITEM 3: CLEAN PLANAS AMFE — Align to reference process');
console.log('='.repeat(70));

// Reference process for Telas Planas (from AMFE Rev D):
// OP 10: RECEPCION DE MATERIA PRIMA
// OP 15: PREPARACION DE CORTE
// OP 20: CORTE
// OP 25: CONTROL CON MYLAR (keep — valid intermediate inspection)
// OP 30: COSTURA (was "Preparacion de kits" — wrong name. Reference says COSTURA)
// OP 40: COLOCADO DE CLIPS (reference)
// OP 50: PEGADO DE DOTS (reference)
// OP 60: CONTROL FINAL DE CALIDAD (reference says INSPECCION FINAL)
// OP 70: EMBALAJE (reference)

// Current Planas AMFE has operations that don't match the reference:
// - OP 30 "Preparación de kits" → should be COSTURA with costura FM
// - OP 40 "Costura recta" → wrong number, should be OP 30 per reference
// - OP 50 "Troquelado de refuerzos" → not in reference process for Planas
// - OP 60 "Troquelado de aplix" → not in reference process for Planas
// - OP 70 "Pegado de dots aplix" → should be OP 50 per reference
// - OP 80 "Control final" → should be OP 60 per reference
// - OP 110 "Embalaje" → should be OP 70 per reference

// Strategy: The current OP 40 "Costura recta" already has good FM data from the reference.
// We need to:
// 1. Renumber OP 40 → OP 30 (COSTURA) and add missing FM from reference
// 2. Remove OP 30 "Preparacion de kits" (not in reference, or merge if needed)
// 3. Remove OP 50 "Troquelado de refuerzos" (not in Planas reference)
// 4. Remove OP 60 "Troquelado de aplix" (not in Planas reference)
// 5. Renumber OP 70 → OP 50 (PEGADO DE DOTS)
//    Actually: OP 40 should be COLOCADO DE CLIPS per reference
// 6. Renumber OP 80 → OP 60 (CONTROL FINAL DE CALIDAD)
// 7. Renumber OP 110 → OP 70 (EMBALAJE)

// But wait — the current data has real failure modes that were carefully entered.
// The task says to:
// - Remove wrong operations (termoformadas ones)
// - Add correct operations with FM from the reference
//
// Looking at current ops, OP 50 "Troquelado de refuerzos" and OP 60 "Troquelado de aplix"
// could be valid for Planas if they actually DO troquelado. But the reference says NO.
// The reference says only: Recepcion, Prep Corte, Corte, Costura, Colocado Clips, Pegado Dots,
// Inspeccion Final, Embalaje.
//
// IMPORTANT: We do NOT renumber existing ops that are correct but misaligned —
// renumbering would break CP/HO links. Instead we:
// 1. Remove ops that definitively don't belong to Planas
// 2. Add the COSTURA operation (OP 30) with reference FM, replacing "Preparacion de kits"
// 3. Add missing COLOCADO DE CLIPS (OP 40) if not present
//
// Actually, looking more carefully:
// - Current OP 30 "Preparacion de kits" → this IS a valid step but not in the AMFE reference
// - Current OP 40 "Costura recta" → this IS the costura operation, already has FM
// - Current OP 50 "Troquelado de refuerzos" → for Planas process, they DO troquelado
// - Current OP 60 "Troquelado de aplix" → for Planas process, they DO troquelado aplix
//
// The task says wrong ops are: "OP 20b HORNO", "OP 30 TERMOFORMADO", "OP 40 CORTE EN PRENSA",
// "OP 50 PERFORADO", "OP 60 SOLDADURA". These are NOT in the current data anymore.
// They may have been cleaned already.
//
// Let me focus on what the task actually asks:
// The reference process is the target. Current AMFE needs to match it.
// The reference for Costura OP 30 includes specific FM that we need to add.

// Check if the "wrong" termoformadas operations exist in Planas
const wrongOpsForPlanas = ['HORNO', 'TERMOFORMADO', 'CORTE EN PRENSA', 'PERFORADO', 'SOLDADURA'];
const currentPlanaOps = aP.data.operations || [];

console.log('\nChecking for wrong termoformadas operations in Planas AMFE:');
const wrongFound = [];
for (const op of currentPlanaOps) {
    const name = (op.name || '').toUpperCase();
    for (const w of wrongOpsForPlanas) {
        if (name.includes(w)) {
            wrongFound.push(op);
            console.log(`  FOUND WRONG: ${op.opNumber} "${op.name}" → WILL REMOVE`);
        }
    }
}

if (wrongFound.length === 0) {
    console.log('  No wrong termoformadas operations found (may have been cleaned in v2)');
} else {
    // Remove wrong operations
    const wrongIds = new Set(wrongFound.map(o => o.id));
    aP.data.operations = aP.data.operations.filter(o => !wrongIds.has(o.id));
    stats.item3 += wrongFound.length;
    console.log(`  Removed ${wrongFound.length} wrong operations`);
}

// Now check reference alignment — add missing Costura FM
console.log('\nChecking Costura operation (OP 30 or OP 40) for reference FM:');

// Find the costura operation (could be OP 30 or OP 40 "Costura recta")
let costuraOp = currentPlanaOps.find(o => {
    const name = (o.name || '').toLowerCase();
    return name.includes('costura');
});

if (costuraOp) {
    console.log(`  Found costura op: ${costuraOp.opNumber} "${costuraOp.name}"`);

    // Reference FM for Costura OP 30 from the AMFE reference Rev D:
    const referenceFM = [
        { desc: 'Costura floja', severity: 8 },
        { desc: 'Costura corrida / fuera de posicion', severity: null },
        { desc: 'Hilo roto', severity: null },
        { desc: 'Puntada saltada', severity: null },
        { desc: 'Refuerzo costurado inverso al airbag', severity: 7 },
        { desc: 'Costura con arrugas', severity: null },
        { desc: 'Rotura de aguja', severity: null },
    ];

    // Get existing FM descriptions in costura
    const existingFM = new Set();
    for (const we of (costuraOp.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const f of (fn.failures || [])) {
                existingFM.add((f.description || '').toLowerCase().trim());
            }
        }
    }

    console.log('  Existing FM:', [...existingFM].join(', '));

    // Map existing FM to reference FM (fuzzy match)
    const fmMappings = {
        'costura floja': ['costura floja', 'deficiente'],
        'costura corrida / fuera de posicion': ['costura corrida', 'fuera de posicion', 'fuera de posición'],
        'hilo roto': ['hilo roto'],
        'puntada saltada': ['salteada', 'saltada', 'puntada saltada'],
        'refuerzo costurado inverso al airbag': ['refuerzo costurado', 'inverso', 'opuesto al airbag'],
        'costura con arrugas': ['arrugas', 'pliegues'],
        'rotura de aguja': ['rotura de aguja', 'aguja rota'],
    };

    // Determine which reference FM are missing
    const missingFM = [];
    for (const ref of referenceFM) {
        const refKey = ref.desc.toLowerCase();
        const keywords = fmMappings[refKey] || [refKey];
        let found = false;
        for (const existing of existingFM) {
            if (keywords.some(kw => existing.includes(kw))) {
                found = true;
                break;
            }
        }
        if (!found) {
            missingFM.push(ref);
        }
    }

    if (missingFM.length > 0) {
        console.log(`  Missing ${missingFM.length} reference FM:`);

        // Find the first function in the costura op to add FM to
        let targetFn = null;
        for (const we of (costuraOp.workElements || [])) {
            for (const fn of (we.functions || [])) {
                targetFn = fn;
                break;
            }
            if (targetFn) break;
        }

        if (targetFn) {
            for (const ref of missingFM) {
                const newFailure = {
                    id: randomUUID(),
                    description: ref.desc,
                    effectLocal: 'TBD',
                    effectNextLevel: 'TBD',
                    effectEndUser: 'TBD',
                    severity: ref.severity || '',
                    causes: [{
                        id: randomUUID(),
                        cause: 'TBD',
                        preventionControl: '',
                        detectionControl: '',
                        occurrence: '',
                        detection: '',
                        ap: '',
                        characteristicNumber: '',
                        specialChar: '',
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
                targetFn.failures.push(newFailure);
                stats.item3++;
                console.log(`    + FM: "${ref.desc}" ${ref.severity ? '(S=' + ref.severity + ')' : ''}`);
            }
        }
    } else {
        console.log('  All reference FM present');
    }

    // Rename to standard: "COSTURA" (uppercase, standard name)
    if (costuraOp.name !== 'COSTURA') {
        console.log(`  Rename: "${costuraOp.name}" → "COSTURA"`);
        costuraOp.name = 'COSTURA';
        stats.item3++;
    }
} else {
    console.log('  WARNING: No costura operation found in Planas AMFE');
    console.log('  Creating COSTURA operation at OP 30 with reference FM...');

    const costuraFM = [
        { desc: 'Costura floja', severity: 8 },
        { desc: 'Costura corrida / fuera de posicion', severity: '' },
        { desc: 'Hilo roto', severity: '' },
        { desc: 'Puntada saltada', severity: '' },
        { desc: 'Refuerzo costurado inverso al airbag', severity: 7 },
        { desc: 'Costura con arrugas', severity: '' },
        { desc: 'Rotura de aguja', severity: '' },
    ];

    const newCosturaOp = {
        id: randomUUID(),
        opNumber: 'OP 30',
        name: 'COSTURA',
        focusElementFunction: '',
        operationFunction: '',
        workElements: [{
            id: randomUUID(),
            type: 'Machine',
            name: 'Maquina de costura',
            functions: [{
                id: randomUUID(),
                description: 'Costura fuerte, sin arruga ni pliegues con hilo segun especificaciones',
                requirements: '',
                failures: costuraFM.map(fm => ({
                    id: randomUUID(),
                    description: fm.desc,
                    effectLocal: 'TBD',
                    effectNextLevel: 'TBD',
                    effectEndUser: 'TBD',
                    severity: fm.severity,
                    causes: [{
                        id: randomUUID(),
                        cause: 'TBD',
                        preventionControl: '',
                        detectionControl: '',
                        occurrence: '',
                        detection: '',
                        ap: '',
                        characteristicNumber: '',
                        specialChar: '',
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
                })),
            }],
        }],
    };

    aP.data.operations.push(newCosturaOp);
    stats.item3 += costuraFM.length + 1;
    console.log(`  Created COSTURA with ${costuraFM.length} FM`);
}

// Check for COLOCADO DE CLIPS — reference OP 40
// In current AMFE, OP 40 is already used by COSTURA, so we assign OP 45
const hasClips = currentPlanaOps.some(o => {
    const name = (o.name || '').toLowerCase();
    return name.includes('clip') || name.includes('colocado de clips');
});

if (!hasClips) {
    // Find available op number after costura (OP 40) and before troquelado (OP 50)
    const clipOpNum = 'OP 45';
    console.log(`\n  Adding missing operation: ${clipOpNum} COLOCADO DE CLIPS`);
    aP.data.operations.push({
        id: randomUUID(),
        opNumber: clipOpNum,
        name: 'COLOCADO DE CLIPS',
        focusElementFunction: '',
        operationFunction: '',
        workElements: [{
            id: randomUUID(),
            type: 'Man',
            name: 'Operador de colocado',
            functions: [{
                id: randomUUID(),
                description: 'Colocar clips en posicion correcta segun plano',
                requirements: '',
                failures: [{
                    id: randomUUID(),
                    description: 'TBD — Pendiente definicion con equipo APQP',
                    effectLocal: 'TBD',
                    effectNextLevel: 'TBD',
                    effectEndUser: 'TBD',
                    severity: '',
                    causes: [{
                        id: randomUUID(),
                        cause: 'TBD',
                        preventionControl: '',
                        detectionControl: '',
                        occurrence: '',
                        detection: '',
                        ap: '',
                        characteristicNumber: '',
                        specialChar: '',
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
                }],
            }],
        }],
    });
    stats.item3++;
    console.log(`    + ${clipOpNum} COLOCADO DE CLIPS (TBD FM)`);
} else {
    console.log('\n  COLOCADO DE CLIPS already exists');
}

// Rename operations to match reference standard names
console.log('\nStandardizing Planas operation names:');
const planasNameMap = {
    'preparacion de corte': 'PREPARACION DE CORTE',
    'preparación de corte': 'PREPARACION DE CORTE',
    'corte de componentes': 'CORTE',
    'costura recta': 'COSTURA',
    'control con mylar': 'CONTROL CON MYLAR',
    'preparacion de kits de componentes': 'PREPARACION DE KITS',
    'preparación de kits de componentes': 'PREPARACION DE KITS',
    'troquelado de refuerzos': 'TROQUELADO DE REFUERZOS',
    'troquelado de aplix': 'TROQUELADO DE APLIX',
    'pegado de dots aplix': 'PEGADO DE DOTS',
    'control final de calidad': 'CONTROL FINAL DE CALIDAD',
    'embalaje': 'EMBALAJE',
    'recepcion de materia prima': 'RECEPCION DE MATERIA PRIMA',
};

for (const op of (aP.data.operations || [])) {
    const nameLower = (op.name || '').toLowerCase().trim();
    const stdName = planasNameMap[nameLower];
    if (stdName && op.name !== stdName) {
        console.log(`  ${op.opNumber}: "${op.name}" → "${stdName}"`);
        op.name = stdName;
        stats.item3++;
    }
}

// Sort operations by number
aP.data.operations.sort((a, b) => opN(a.opNumber) - opN(b.opNumber));

console.log(`\nItem 3 total changes: ${stats.item3}`);

// ============================================================================
// ITEM 4: ALIGN OPERATION NAMES — BOTH PRODUCTS
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('ITEM 4: ALIGN OPERATION NAMES across PFD, AMFE, CP, HO');
console.log('='.repeat(70));

// Standard names from pfd.md rules:
// - "RECEPCION DE MATERIA PRIMA"
// - "CONTROL FINAL DE CALIDAD"
// - "EMBALAJE"
// Plus: all names should be UPPERCASE

function standardizeName(name) {
    if (!name) return name;
    const l = name.toLowerCase().trim();

    // Exact standard replacements
    if (/^recepci[oó]n/.test(l) && !l.includes('punzonado') && !l.includes('bi-comp') && !l.includes('traslado')) {
        return 'RECEPCION DE MATERIA PRIMA';
    }
    if ((l.includes('control final') || l.includes('inspeccion final') || l.includes('inspección final')) && !l.includes('traslado')) {
        return 'CONTROL FINAL DE CALIDAD';
    }
    if (/^embalaje/.test(l)) return 'EMBALAJE';
    if (l.includes('preparacion de corte') || l.includes('preparación de corte')) return 'PREPARACION DE CORTE';
    if (l.startsWith('corte de componentes')) return 'CORTE';
    if (l === 'costura recta' || l === 'costura') return 'COSTURA';
    if (l.includes('control con mylar')) return 'CONTROL CON MYLAR';
    if (l.includes('preparacion de kits') || l.includes('preparación de kits')) return 'PREPARACION DE KITS';
    if (l.includes('troquelado de refuerzos') && !l.includes('traslado')) return 'TROQUELADO DE REFUERZOS';
    if (l.includes('troquelado de aplix') && !l.includes('traslado')) return 'TROQUELADO DE APLIX';
    if (l.includes('pegado de dots')) return 'PEGADO DE DOTS';

    // Termoformadas specific
    if ((l.includes('termoformado de telas') || l === 'termoformado') && !l.includes('traslado')) return 'TERMOFORMADO';
    if ((l.includes('corte laser') || l.includes('corte láser')) && !l.includes('traslado')) return 'CORTE LASER';
    if (l.includes('costura de refuerzos') && !l.includes('traslado')) return 'COSTURA DE REFUERZOS';
    if ((l.includes('aplicacion de aplix') || l.includes('aplicación de aplix')) && !l.includes('traslado')) return 'APLICACION DE APLIX';
    if (l.includes('retrabajo') && l.includes('aplix')) return 'RETRABAJO DE PIEZA (APLIX)';
    if (l.includes('retrabajo') && l.includes('soldadura')) return 'RETRABAJO SOLDADURA';

    // Uppercase all names — remove accents for consistency
    const upper = name.toUpperCase()
        .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I')
        .replace(/Ó/g, 'O').replace(/Ú/g, 'U');
    // Note: keep Ñ as Ñ (valid uppercase Spanish)
    if (upper !== name) return upper;

    return name;
}

// Align AMFE operation names
for (const [label, amfe] of [['PLANAS', aP], ['TERMOFORMADAS', aT]]) {
    console.log(`\n  AMFE ${label}:`);
    for (const op of (amfe.data.operations || [])) {
        const std = standardizeName(op.name);
        if (std && std !== op.name) {
            console.log(`    ${op.opNumber}: "${op.name}" → "${std}"`);
            op.name = std;
            stats.item4++;
        }
    }
}

// Align CP operation names
for (const [label, cp] of [['PLANAS', cP], ['TERMOFORMADAS', cT]]) {
    if (!cp) { console.log(`\n  CP ${label}: MISSING`); continue; }
    console.log(`\n  CP ${label}:`);
    for (const item of (cp.data.items || [])) {
        const std = standardizeName(item.processDescription);
        if (std && std !== item.processDescription) {
            console.log(`    ${item.processStepNumber}: "${item.processDescription}" → "${std}"`);
            item.processDescription = std;
            stats.item4++;
        }
    }
}

// Align HO operation names
for (const [label, ho] of [['PLANAS', hP], ['TERMOFORMADAS', hT]]) {
    if (!ho) { console.log(`\n  HO ${label}: MISSING`); continue; }
    console.log(`\n  HO ${label}:`);
    for (const sh of (ho.data.sheets || [])) {
        const std = standardizeName(sh.operationName);
        if (std && std !== sh.operationName) {
            console.log(`    ${sh.operationNumber}: "${sh.operationName}" → "${std}"`);
            sh.operationName = std;
            stats.item4++;
        }
    }
}

// Align PFD step names (field is 'description' not 'name')
for (const [label, pfd] of [['PLANAS', pP], ['TERMOFORMADAS', pT]]) {
    if (!pfd) { console.log(`\n  PFD ${label}: MISSING`); continue; }
    console.log(`\n  PFD ${label}:`);
    for (const step of (pfd.data.steps || [])) {
        const std = standardizeName(step.description);
        if (std && std !== step.description) {
            console.log(`    ${step.stepNumber}: "${step.description}" → "${std}"`);
            step.description = std;
            stats.item4++;
        }
    }
}

// Cross-check: build a map of opNumber → name per product across documents
console.log('\n  Cross-document alignment check:');
for (const [label, amfe, cp, ho, pfd] of [
    ['PLANAS', aP, cP, hP, pP],
    ['TERMOFORMADAS', aT, cT, hT, pT],
]) {
    console.log(`\n  ${label}:`);
    // Collect all op numbers
    const allOps = new Set();
    for (const op of (amfe?.data?.operations || [])) allOps.add(op.opNumber);
    for (const it of (cp?.data?.items || [])) allOps.add(it.processStepNumber);
    for (const sh of (ho?.data?.sheets || [])) allOps.add('OP ' + sh.operationNumber);
    for (const st of (pfd?.data?.steps || [])) allOps.add(st.stepNumber);

    for (const opNum of [...allOps].sort((a, b) => opN(a) - opN(b))) {
        const names = {};
        const amfeOp = (amfe?.data?.operations || []).find(o => o.opNumber === opNum);
        if (amfeOp) names.AMFE = amfeOp.name;

        const cpItems = (cp?.data?.items || []).filter(i => i.processStepNumber === opNum);
        if (cpItems.length) names.CP = cpItems[0].processDescription;

        const plainNum = String(opN(opNum));
        const hoSheet = (ho?.data?.sheets || []).find(s => s.operationNumber === plainNum);
        if (hoSheet) names.HO = hoSheet.operationName;

        const pfdStep = (pfd?.data?.steps || []).find(s => s.stepNumber === opNum);
        if (pfdStep) names.PFD = pfdStep.description;

        const uniqueNames = new Set(Object.values(names));
        if (uniqueNames.size > 1) {
            console.log(`    ${opNum} MISMATCH: ${JSON.stringify(names)}`);
            // Use AMFE name as source of truth
            const truthName = names.AMFE;
            if (truthName) {
                if (names.CP && names.CP !== truthName) {
                    for (const it of cpItems) { it.processDescription = truthName; stats.item4++; }
                    console.log(`      → CP fixed to "${truthName}"`);
                }
                if (names.HO && names.HO !== truthName) {
                    hoSheet.operationName = truthName;
                    stats.item4++;
                    console.log(`      → HO fixed to "${truthName}"`);
                }
                if (names.PFD && names.PFD !== truthName) {
                    pfdStep.description = truthName;
                    stats.item4++;
                    console.log(`      → PFD fixed to "${truthName}"`);
                }
            }
        }
    }
}

console.log(`\nItem 4 total changes: ${stats.item4}`);

// ============================================================================
// ITEM 5: ADD MISSING OPERATIONS TO TERMOFORMADAS AMFE
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('ITEM 5: ADD MISSING OPERATIONS to Termoformadas AMFE');
console.log('='.repeat(70));

// Check which ops exist
const termoOps = new Set((aT.data.operations || []).map(o => o.opNumber));
console.log('\nCurrent Termoformadas ops:', [...termoOps].sort((a, b) => opN(a) - opN(b)).join(', '));

// Check PFD for reference
const termoPfdOps = (pT?.data?.steps || []).map(s => s.stepNumber).filter(s => s && s.startsWith('OP'));
console.log('PFD ops:', termoPfdOps.sort((a, b) => opN(a) - opN(b)).join(', '));

// Missing operations per task:
// - OP 80: Costura refuerzos (in PFD but not AMFE) — ALREADY EXISTS per query above
// - OP 90: Aplicacion aplix (in PFD but not AMFE) — ALREADY EXISTS per query above
// - OP 11: Retrabajo Aplix (in reference) — ALREADY EXISTS per v2 script
// - OP 61: Retrabajo soldadura (in reference) — ALREADY EXISTS per v2 script

const missingTerOps = [
    {
        opNumber: 'OP 80',
        name: 'COSTURA DE REFUERZOS',
        weType: 'Machine',
        weName: 'Maquina de coser industrial',
        fnDesc: 'Coser refuerzos a la pieza termoformada',
        failures: [
            { desc: 'Costura salteada', sev: '' },
            { desc: 'Costura floja', sev: '' },
            { desc: 'Hilo incorrecto', sev: '' },
            { desc: 'Posicion del refuerzo incorrecta', sev: '' },
        ],
    },
    {
        opNumber: 'OP 90',
        name: 'APLICACION DE APLIX',
        weType: 'Man',
        weName: 'Operador de aplicacion',
        fnDesc: 'Aplicar Aplix en posiciones segun plano',
        failures: [
            { desc: 'Cantidad incorrecta de Aplix', sev: '' },
            { desc: 'Posicion incorrecta del Aplix', sev: '' },
            { desc: 'Aplix no adherido correctamente', sev: '' },
        ],
    },
    {
        opNumber: 'OP 11',
        name: 'RETRABAJO DE PIEZA (APLIX)',
        weType: 'Man',
        weName: 'Operador de retrabajo',
        fnDesc: 'Retrabajar pieza con aplix defectuoso',
        failures: [
            { desc: 'TBD — Pendiente definicion con equipo APQP', sev: '' },
        ],
    },
    {
        opNumber: 'OP 61',
        name: 'RETRABAJO SOLDADURA',
        weType: 'Man',
        weName: 'Operador de retrabajo',
        fnDesc: 'Retrabajar pieza con soldadura defectuosa',
        failures: [
            { desc: 'TBD — Pendiente definicion con equipo APQP', sev: '' },
        ],
    },
];

for (const m of missingTerOps) {
    if (termoOps.has(m.opNumber)) {
        console.log(`  ${m.opNumber} "${m.name}" — ALREADY EXISTS, skipping`);

        // But check if name needs standardization
        const existingOp = aT.data.operations.find(o => o.opNumber === m.opNumber);
        if (existingOp && existingOp.name !== m.name) {
            console.log(`    Renaming: "${existingOp.name}" → "${m.name}"`);
            existingOp.name = m.name;
            stats.item5++;
        }
        continue;
    }

    console.log(`  + ${m.opNumber} "${m.name}" (${m.failures.length} FM)`);
    aT.data.operations.push({
        id: randomUUID(),
        opNumber: m.opNumber,
        name: m.name,
        focusElementFunction: '',
        operationFunction: '',
        workElements: [{
            id: randomUUID(),
            type: m.weType,
            name: m.weName,
            functions: [{
                id: randomUUID(),
                description: m.fnDesc,
                requirements: '',
                failures: m.failures.map(f => ({
                    id: randomUUID(),
                    description: f.desc,
                    effectLocal: 'TBD',
                    effectNextLevel: 'TBD',
                    effectEndUser: 'TBD',
                    severity: f.sev,
                    causes: [{
                        id: randomUUID(),
                        cause: 'TBD',
                        preventionControl: '',
                        detectionControl: '',
                        occurrence: '',
                        detection: '',
                        ap: '',
                        characteristicNumber: '',
                        specialChar: '',
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
                })),
            }],
        }],
    });
    stats.item5++;
}

// Sort termoformadas operations by number
aT.data.operations.sort((a, b) => opN(a.opNumber) - opN(b.opNumber));

console.log(`\nItem 5 total changes: ${stats.item5}`);

// ============================================================================
// EXTRA: SPLIT GROUPED WORK ELEMENTS (1M per line)
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('EXTRA: SPLIT GROUPED WORK ELEMENTS (1M per line)');
console.log('='.repeat(70));

function splitGroupedWE(amfe, label) {
    console.log(`\n  ${label}:`);
    let changes = 0;

    for (const op of (amfe.data.operations || [])) {
        const newWorkElements = [];
        let modified = false;

        for (const we of (op.workElements || [])) {
            const name = we.name || '';

            // Check if this WE contains grouped items (separated by " / " or " + ")
            // AIAG-VDA 2019: 1M per line — every WE must be ONE single item
            const isGrouped = name.includes(' / ') || name.includes(' + ');

            // Split on " / " and " + " separators
            const parts = name.split(/\s*[\/+]\s*/).map(p => p.trim()).filter(p => p);

            // Split ANY WE with 2+ parts, regardless of type
            // Exception: "tendido/encimado" is one concept, not separate items
            // Exception: method descriptions that describe a single procedure
            const isMethodDescription = (we.type === 'Method') && parts.length === 2 &&
                name.toLowerCase().includes('tendido');

            const shouldSplit = isGrouped && parts.length >= 2 && !isMethodDescription;

            if (!shouldSplit) {
                newWorkElements.push(we);
                continue;
            }

            console.log(`    ${op.opNumber}: Splitting "${name}" into ${parts.length} items`);
            modified = true;

            for (let i = 0; i < parts.length; i++) {
                const partName = parts[i];

                if (i === 0) {
                    // Keep first part in the original WE (preserves functions/failures)
                    const updatedWE = { ...we, name: partName };
                    newWorkElements.push(updatedWE);
                    console.log(`      [0] "${partName}" (keeps original FM)`);
                } else {
                    // Create new WE for additional parts — with TBD FM
                    const newWE = {
                        id: randomUUID(),
                        type: we.type || 'Material',
                        name: partName,
                        functions: [{
                            id: randomUUID(),
                            description: `TBD — Funcion de ${partName}`,
                            requirements: '',
                            failures: [{
                                id: randomUUID(),
                                description: 'TBD — Pendiente definicion con equipo APQP',
                                effectLocal: 'TBD',
                                effectNextLevel: 'TBD',
                                effectEndUser: 'TBD',
                                severity: '',
                                causes: [{
                                    id: randomUUID(),
                                    cause: 'TBD',
                                    preventionControl: '',
                                    detectionControl: '',
                                    occurrence: '',
                                    detection: '',
                                    ap: '',
                                    characteristicNumber: '',
                                    specialChar: '',
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
                            }],
                        }],
                    };
                    newWorkElements.push(newWE);
                    console.log(`      [${i}] "${partName}" (new, TBD FM)`);
                    changes++;
                }
            }
        }

        if (modified) {
            op.workElements = newWorkElements;
        }
    }

    return changes;
}

stats.weSplit += splitGroupedWE(aP, 'PLANAS');
stats.weSplit += splitGroupedWE(aT, 'TERMOFORMADAS');

console.log(`\nWE split total changes: ${stats.weSplit}`);

// ============================================================================
// SUMMARY & SAVE
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`  Item 3 (Clean Planas): ${stats.item3} changes`);
console.log(`  Item 4 (Align names):  ${stats.item4} changes`);
console.log(`  Item 5 (Termo ops):    ${stats.item5} changes`);
console.log(`  WE split:              ${stats.weSplit} changes`);
const total = Object.values(stats).reduce((a, b) => a + b, 0);
console.log(`  TOTAL:                 ${total} changes`);

// Final verification: print operation lists
console.log('\n--- FINAL PLANAS AMFE OPERATIONS ---');
for (const op of (aP.data.operations || []).sort((a, b) => opN(a.opNumber) - opN(b.opNumber))) {
    const weCount = (op.workElements || []).length;
    const fmCount = (op.workElements || []).reduce((a, w) => a + (w.functions || []).reduce((b, f) => b + (f.failures || []).length, 0), 0);
    const weNames = (op.workElements || []).map(w => (w.name || '').substring(0, 50)).join(' | ');
    console.log(`  ${op.opNumber} "${op.name}" WE=${weCount} FM=${fmCount} [${weNames}]`);
}

console.log('\n--- FINAL TERMOFORMADAS AMFE OPERATIONS ---');
for (const op of (aT.data.operations || []).sort((a, b) => opN(a.opNumber) - opN(b.opNumber))) {
    const weCount = (op.workElements || []).length;
    const fmCount = (op.workElements || []).reduce((a, w) => a + (w.functions || []).reduce((b, f) => b + (f.failures || []).length, 0), 0);
    const weNames = (op.workElements || []).map(w => (w.name || '').substring(0, 50)).join(' | ');
    console.log(`  ${op.opNumber} "${op.name}" WE=${weCount} FM=${fmCount} [${weNames}]`);
}

if (DRY_RUN) {
    console.log('\nDRY RUN — no changes saved. Use --apply to save.');
} else if (total === 0) {
    console.log('\nNothing to save.');
} else {
    console.log('\nSaving to Supabase...');
    let ok = 0;
    for (const [table, doc, label] of [
        ['amfe_documents', aP, 'AMFE-Planas'],
        ['amfe_documents', aT, 'AMFE-Termoformadas'],
        ['cp_documents', cP, 'CP-Planas'],
        ['cp_documents', cT, 'CP-Termoformadas'],
        ['ho_documents', hP, 'HO-Planas'],
        ['ho_documents', hT, 'HO-Termoformadas'],
        ['pfd_documents', pP, 'PFD-Planas'],
        ['pfd_documents', pT, 'PFD-Termoformadas'],
    ]) {
        if (!doc) { console.log(`  SKIP ${label} (not found)`); continue; }
        const { error } = await sb.from(table).update({ data: doc.data }).eq('id', doc.id);
        if (error) {
            console.error(`  FAIL ${label}: ${error.message}`);
        } else {
            console.log(`  OK ${label}`);
            ok++;
        }
    }
    console.log(`\n${ok} documents saved successfully.`);
}

process.exit(0);

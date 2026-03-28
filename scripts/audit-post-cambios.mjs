#!/usr/bin/env node
/**
 * AUDIT POST-CAMBIOS v2 — READ ONLY
 * Fixed field names based on actual data model
 * Generates docs/AUDITORIA_POST_CAMBIOS.md
 */
import { initSupabase, selectSql, close } from './supabaseHelper.mjs';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '..', 'docs', 'AUDITORIA_POST_CAMBIOS.md');

await initSupabase();

// ─── Helpers ────────────────────────────────────────────────────────────────
let md = '';
function w(line = '') { md += line + '\n'; }
function table(headers, rows) {
    w('| ' + headers.join(' | ') + ' |');
    w('| ' + headers.map(() => '---').join(' | ') + ' |');
    for (const r of rows) {
        w('| ' + r.map(c => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |');
    }
    w();
}

// ─── Fetch all data ─────────────────────────────────────────────────────────
console.log('Fetching families...');
const families = await selectSql(`
    SELECT pf.id, pf.name, pf.linea_code, pf.linea_name
    FROM product_families pf
    WHERE pf.active = 1
    ORDER BY pf.name
`);
console.log(`  Found ${families.length} families`);

const familyDocs = await selectSql(`
    SELECT fd.family_id, fd.module, fd.document_id, fd.is_master, fd.source_master_id
    FROM family_documents fd
`);

console.log('Fetching AMFE documents...');
const allAmfes = await selectSql(`SELECT id, project_name, part_number, client, data FROM amfe_documents`);
console.log(`  ${allAmfes.length} AMFEs`);

console.log('Fetching CP documents...');
const allCps = await selectSql(`SELECT id, project_name, part_number, client, control_plan_number, data FROM cp_documents`);
console.log(`  ${allCps.length} CPs`);

console.log('Fetching HO documents...');
const allHos = await selectSql(`SELECT id, part_description, part_number, client, form_number, data FROM ho_documents`);
console.log(`  ${allHos.length} HOs`);

console.log('Fetching PFD documents...');
const allPfds = await selectSql(`SELECT id, part_name, part_number, customer_name, data FROM pfd_documents`);
console.log(`  ${allPfds.length} PFDs`);

const amfeMap = Object.fromEntries(allAmfes.map(d => [d.id, d]));
const cpMap = Object.fromEntries(allCps.map(d => [d.id, d]));
const hoMap = Object.fromEntries(allHos.map(d => [d.id, d]));
const pfdMap = Object.fromEntries(allPfds.map(d => [d.id, d]));

function parseData(doc) {
    if (!doc || !doc.data) return {};
    if (typeof doc.data === 'string') {
        try { return JSON.parse(doc.data); } catch { return {}; }
    }
    return doc.data;
}

const findings = { BLOCKER: [], GRAVE: [], MEDIO: [], MENOR: [] };
function finding(severity, product, msg) {
    findings[severity].push({ product, msg });
}

// ─── AMFE helpers using REAL field names ─────────────────────────────────────
// AMFE: op.opNumber, op.name, op.workElements[].functions[].failures[]
// Failure: fail.severity, fail.causes[]
// Cause: cause.cause, cause.occurrence, cause.detection, cause.ap, cause.preventionAction, cause.detectionAction

function getAmfeStats(amfeData) {
    const ops = amfeData.operations || [];
    let totalFailures = 0, totalCauses = 0, aphNoAction = 0, sodZero = 0, emptyEffects = 0;
    let hasFlamabilidad = false;

    for (const op of ops) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    totalFailures++;
                    const desc = (fail.description || '').toLowerCase();
                    if (desc.includes('flamab') || desc.includes('combusti') || desc.includes('inflamab')) {
                        hasFlamabilidad = true;
                    }
                    if (!fail.effectLocal && !fail.effectNextLevel && !fail.effectEndUser) {
                        emptyEffects++;
                    }
                    const failSeverity = Number(fail.severity) || 0;

                    for (const cause of (fail.causes || [])) {
                        totalCauses++;
                        const ap = (cause.ap || cause.actionPriority || '').toUpperCase();
                        if (ap === 'H') {
                            const hasAction = (cause.preventionAction || '').trim() || (cause.detectionAction || '').trim();
                            if (!hasAction) aphNoAction++;
                        }
                        const s = failSeverity;  // Severity is on FAILURE level
                        const o = Number(cause.occurrence) || 0;
                        const d = Number(cause.detection) || 0;
                        if (s === 0 || o === 0 || d === 0) sodZero++;
                    }
                }
            }
        }
    }

    if (!hasFlamabilidad) {
        const amfeStr = JSON.stringify(amfeData).toLowerCase();
        if (amfeStr.includes('flamab') || amfeStr.includes('tl 1010') || amfeStr.includes('tl1010')) {
            hasFlamabilidad = true;
        }
    }

    return { ops: ops.length, totalFailures, totalCauses, aphNoAction, sodZero, emptyEffects, hasFlamabilidad };
}

// ─── CP helpers using REAL field names ───────────────────────────────────────
// CP: processDescription (NOT processStepName), productCharacteristic + processCharacteristic (NOT characteristic)
// specialCharClass for CC/SC

function getCpCharacteristic(item) {
    return (item.productCharacteristic || '').trim() || (item.processCharacteristic || '').trim();
}

function getCpStepName(item) {
    return item.processDescription || item.processStepName || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1 — Counts & Consistency
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE 1: Counts & Consistency ===');

w('# Auditoría Integral Post-Cambios');
w();
w(`**Fecha:** ${new Date().toISOString().slice(0,10)}`);
w(`**Tipo:** Solo lectura — sin modificaciones a la base de datos`);
w();
w('---');
w();
w('## FASE 6 — Resumen Ejecutivo (se completa al final)');
w();
w('*(Ver final del documento)*');
w();
w('---');
w();
w('## FASE 1 — Conteo y Consistencia de Datos');
w();

for (const fam of families) {
    const famDocs = familyDocs.filter(fd => fd.family_id === fam.id);
    const masterDocs = famDocs.filter(fd => Number(fd.is_master));

    const masterAmfeId = masterDocs.find(fd => fd.module === 'amfe')?.document_id;
    const masterCpId = masterDocs.find(fd => fd.module === 'cp')?.document_id;
    const masterHoId = masterDocs.find(fd => fd.module === 'ho')?.document_id;
    const masterPfdId = masterDocs.find(fd => fd.module === 'pfd')?.document_id;

    const amfeDoc = masterAmfeId ? amfeMap[masterAmfeId] : null;
    const cpDoc = masterCpId ? cpMap[masterCpId] : null;
    const hoDoc = masterHoId ? hoMap[masterHoId] : null;
    const pfdDoc = masterPfdId ? pfdMap[masterPfdId] : null;

    const amfeData = parseData(amfeDoc);
    const cpData = parseData(cpDoc);
    const hoData = parseData(hoDoc);
    const pfdData = parseData(pfdDoc);

    console.log(`\nAnalyzing: ${fam.name}`);

    // AMFE
    const amfe = getAmfeStats(amfeData);

    // CP stats
    const cpItems = cpData.items || [];
    const cpCC = cpItems.filter(i => i.specialCharClass === 'CC');
    const cpSC = cpItems.filter(i => i.specialCharClass === 'SC');
    const cpNoChar = cpItems.filter(i => !getCpCharacteristic(i));
    const cpTBD = cpItems.filter(i => {
        const spec = (i.specification || '').trim();
        return !spec || spec.toLowerCase().includes('tbd') || spec === '-';
    });
    const cpNoEval = cpItems.filter(i => !(i.evaluationTechnique || '').trim());

    const cpHeader = cpData.header || {};
    const plantApproval = cpHeader.plantApproval || '';
    const approvedBy = cpHeader.approvedBy || '';
    const coreTeam = cpHeader.coreTeam || '';
    const hasProduccion = coreTeam.toLowerCase().includes('producci');

    // HO stats
    const hoSheets = hoData.sheets || [];
    let totalQcItems = 0, qcNoCpId = 0, qcOrphan = 0;
    const cpItemIds = new Set(cpItems.map(i => i.id));

    for (const sheet of hoSheets) {
        for (const qc of (sheet.qualityChecks || [])) {
            totalQcItems++;
            if (!qc.cpItemId) qcNoCpId++;
            else if (!cpItemIds.has(qc.cpItemId)) qcOrphan++;
        }
    }

    // PFD stats
    const pfdSteps = pfdData.steps || [];

    w(`### ${fam.name}`);
    w();

    const rows = [
        ['AMFE: operaciones', amfe.ops],
        ['AMFE: modos de falla', amfe.totalFailures],
        ['AMFE: causas', amfe.totalCauses],
        ['AMFE: causas AP=H sin acción', `${amfe.aphNoAction} ${amfe.aphNoAction > 0 ? '⚠️' : '✅'}`],
        ['AMFE: causas con S/O/D = 0', `${amfe.sodZero} ${amfe.sodZero > 0 ? '⚠️' : '✅'}`],
        ['AMFE: efectos vacíos', `${amfe.emptyEffects} ${amfe.emptyEffects > 0 ? '⚠️' : '✅'}`],
        ['AMFE: flamabilidad presente', amfe.hasFlamabilidad ? 'SI ✅' : 'NO ⚠️'],
        ['CP: items totales', cpItems.length],
        ['CP: items CC', `${cpCC.length} (${cpItems.length ? ((cpCC.length/cpItems.length)*100).toFixed(1) : 0}%)`],
        ['CP: items SC', `${cpSC.length} (${cpItems.length ? ((cpSC.length/cpItems.length)*100).toFixed(1) : 0}%)`],
        ['CP: items sin characteristic (ni producto ni proceso)', `${cpNoChar.length} ${cpNoChar.length > 0 ? '⚠️' : '✅'}`],
        ['CP: items con spec TBD o vacía', `${cpTBD.length} ${cpTBD.length > 0 ? '⚠️' : '✅'}`],
        ['CP: items con evaluationTechnique vacía', `${cpNoEval.length} ${cpNoEval.length > 0 ? '⚠️' : '✅'}`],
        ['CP: header plantApproval', `"${plantApproval}" ${plantApproval.includes('Cal') || plantApproval.includes('G.Cal') ? '✅' : '⚠️'}`],
        ['CP: header approvedBy', `"${approvedBy}" ${approvedBy.includes('Baptista') ? '✅' : '⚠️'}`],
        ['CP: header coreTeam incluye Producción', hasProduccion ? 'SI ✅' : 'NO ⚠️'],
        ['HO: sheets totales', hoSheets.length],
        ['HO: qcItems totales', totalQcItems],
        ['HO: qcItems sin cpItemId', `${qcNoCpId} ${qcNoCpId > 0 ? '⚠️' : '✅'}`],
        ['HO: qcItems huérfanos', `${qcOrphan} ${qcOrphan > 0 ? '⚠️' : '✅'}`],
        ['PFD: steps', pfdSteps.length],
    ];

    table(['Dato', 'Valor'], rows);

    // Findings
    if (amfe.aphNoAction > 0) finding('BLOCKER', fam.name, `${amfe.aphNoAction} causas AP=H sin acción correctiva`);
    if (amfe.sodZero > 0) finding('GRAVE', fam.name, `${amfe.sodZero} causas con S/O/D = 0 (severity en failure, occurrence/detection en causa)`);
    if (amfe.emptyEffects > 0) finding('MEDIO', fam.name, `${amfe.emptyEffects} modos de falla con efectos vacíos`);
    if (!amfe.hasFlamabilidad) finding('GRAVE', fam.name, 'No se detectó flamabilidad en el AMFE');
    if (cpTBD.length > 0) finding('MEDIO', fam.name, `${cpTBD.length} CP items con especificación TBD o vacía`);
    if (cpNoEval.length > 0) finding('MEDIO', fam.name, `${cpNoEval.length} CP items sin evaluationTechnique`);
    if (cpNoChar.length > 3) finding('MENOR', fam.name, `${cpNoChar.length} CP items sin characterística (producto o proceso)`);
    if (!plantApproval.includes('Cal') && !plantApproval.includes('G.Cal')) {
        finding('GRAVE', fam.name, `CP plantApproval dice "${plantApproval}" en vez de Gonzalo Cal`);
    }
    if (!approvedBy.includes('Baptista')) {
        finding('GRAVE', fam.name, `CP approvedBy dice "${approvedBy}" en vez de Carlos Baptista`);
    }
    if (!hasProduccion) finding('MEDIO', fam.name, 'CP coreTeam no incluye Producción');
    if (qcNoCpId > 0) finding('GRAVE', fam.name, `${qcNoCpId} HO qcItems sin cpItemId`);
    if (qcOrphan > 0) finding('BLOCKER', fam.name, `${qcOrphan} HO qcItems huérfanos`);
    if (totalQcItems === 0 && hoSheets.length > 0) {
        finding('GRAVE', fam.name, `HO tiene ${hoSheets.length} sheets pero 0 qcItems — faltan controles de calidad`);
    }
}

writeFileSync(OUTPUT, md, 'utf-8');
console.log('\nPhase 1 done.');

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — Traceability AMFE→CP→HO
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE 2: Traceability AMFE→CP→HO ===');

w('---');
w();
w('## FASE 2 — Trazabilidad AMFE→CP→HO');
w();

for (const fam of families) {
    const famDocs = familyDocs.filter(fd => fd.family_id === fam.id);
    const masterDocs = famDocs.filter(fd => Number(fd.is_master));

    const masterAmfeId = masterDocs.find(fd => fd.module === 'amfe')?.document_id;
    const masterCpId = masterDocs.find(fd => fd.module === 'cp')?.document_id;
    const masterHoId = masterDocs.find(fd => fd.module === 'ho')?.document_id;

    const amfeData = parseData(masterAmfeId ? amfeMap[masterAmfeId] : null);
    const cpData = parseData(masterCpId ? cpMap[masterCpId] : null);
    const hoData = parseData(masterHoId ? hoMap[masterHoId] : null);

    console.log(`Traceability: ${fam.name}`);
    w(`### ${fam.name}`);
    w();

    // 2.1 AMFE→CP coverage
    const cpItems = cpData.items || [];
    const allAmfeFailureIdsInCp = new Set();
    const allAmfeCauseIdsInCp = new Set();
    for (const item of cpItems) {
        if (item.amfeFailureId) allAmfeFailureIdsInCp.add(item.amfeFailureId);
        if (item.amfeFailureIds) item.amfeFailureIds.forEach(id => allAmfeFailureIdsInCp.add(id));
        if (item.amfeCauseIds) item.amfeCauseIds.forEach(id => allAmfeCauseIdsInCp.add(id));
    }

    const amfeFailures = [];
    for (const op of (amfeData.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    amfeFailures.push({ ...fail, opName: op.name, opNum: op.opNumber });
                }
            }
        }
    }

    const uncoveredFailures = amfeFailures.filter(f => !allAmfeFailureIdsInCp.has(f.id));

    w(`**2.1 Cobertura AMFE→CP:**`);
    w(`- Total modos de falla AMFE: ${amfeFailures.length}`);
    w(`- Con CP item vinculado: ${amfeFailures.length - uncoveredFailures.length}`);
    w(`- SIN cobertura en CP: ${uncoveredFailures.length}`);
    if (uncoveredFailures.length > 0 && uncoveredFailures.length <= 15) {
        w(`- Detalle:`);
        for (const f of uncoveredFailures) {
            w(`  - OP ${f.opNum || '?'} "${f.opName || '?'}": "${f.description}"`);
        }
    } else if (uncoveredFailures.length > 15) {
        w(`- Detalle (primeros 15):`);
        for (const f of uncoveredFailures.slice(0, 15)) {
            w(`  - OP ${f.opNum || '?'} "${f.opName || '?'}": "${f.description}"`);
        }
    }
    if (uncoveredFailures.length > 5) {
        finding('MEDIO', fam.name, `${uncoveredFailures.length} modos de falla AMFE sin item en CP`);
    }
    w();

    // 2.2 CP→HO coverage
    const hoSheets = hoData.sheets || [];
    const hoQcCpIds = new Set();
    for (const sheet of hoSheets) {
        for (const qc of (sheet.qualityChecks || [])) {
            if (qc.cpItemId) hoQcCpIds.add(qc.cpItemId);
        }
    }

    const operatorRoles = ['operador', 'producción', 'produccion', 'líder', 'lider'];
    const cpItemsForOperator = cpItems.filter(i => {
        const owner = (i.reactionPlanOwner || '').toLowerCase();
        return operatorRoles.some(r => owner.includes(r));
    });
    const cpItemsNotInHo = cpItemsForOperator.filter(i => !hoQcCpIds.has(i.id));

    w(`**2.2 Cobertura CP→HO (items de operario):**`);
    w(`- CP items totales: ${cpItems.length}`);
    w(`- CP items de operario/líder: ${cpItemsForOperator.length}`);
    w(`- Con HO qcItem: ${cpItemsForOperator.length - cpItemsNotInHo.length}`);
    w(`- SIN qcItem en HO: ${cpItemsNotInHo.length}`);
    if (cpItemsNotInHo.length > 0) {
        w(`- Primeros 5 sin cobertura:`);
        for (const item of cpItemsNotInHo.slice(0, 5)) {
            w(`  - OP ${item.processStepNumber} "${getCpStepName(item)}": char="${getCpCharacteristic(item) || '(vacía)'}" (resp: ${item.reactionPlanOwner})`);
        }
    }
    if (cpItemsNotInHo.length > 5) {
        finding('GRAVE', fam.name, `${cpItemsNotInHo.length} CP items de operario sin qcItem en HO`);
    }
    w();

    // 2.3 Sample CP items — real vs generic
    w(`**2.3 Muestreo de CP items — 5 primeros:**`);
    w();
    const sampleItems = cpItems.slice(0, 5);
    if (sampleItems.length > 0) {
        table(
            ['OP', 'Proceso/Producto Char', 'Spec', 'EvalTechnique', 'ControlMethod'],
            sampleItems.map(i => [
                i.processStepNumber,
                (getCpCharacteristic(i) || '(vacía)').slice(0, 40),
                (i.specification || '').slice(0, 35),
                (i.evaluationTechnique || '').slice(0, 30),
                (i.controlMethod || '').slice(0, 30),
            ])
        );
    }

    // Word-boundary regex to avoid false positives with Spanish todo/todos
    const genericRegexes = [/TBD/i, /placeholder/i, /datos reales/i, /genérico/i, /pendiente de/i];
    let genericCount = 0;
    for (const item of cpItems) {
        const allText = [getCpCharacteristic(item), item.specification, item.evaluationTechnique, item.controlMethod].join(" ");
        if (genericRegexes.some(rx => rx.test(allText))) genericCount++;
    }
    const emptyBothChars = cpItems.filter(i => !(i.productCharacteristic || '').trim() && !(i.processCharacteristic || '').trim()).length;

    w(`- Items con AMBAS características vacías: ${emptyBothChars}`);
    w(`- Items con productCharacteristic vacía (pero processCharacteristic ok): ${cpItems.filter(i => !(i.productCharacteristic || '').trim() && (i.processCharacteristic || '').trim()).length}`);
    w(`- Items con texto genérico/placeholder: ${genericCount}`);
    w();

    if (genericCount > 0) finding('MEDIO', fam.name, `${genericCount} CP items con texto genérico/placeholder`);

    // 2.4 HO qcItems linkage
    let totalHoQc = 0, hoQcLinked = 0, hoQcOrphaned = 0;
    const cpItemIdSet = new Set(cpItems.map(i => i.id));
    for (const sheet of hoSheets) {
        for (const qc of (sheet.qualityChecks || [])) {
            totalHoQc++;
            if (qc.cpItemId) {
                if (cpItemIdSet.has(qc.cpItemId)) hoQcLinked++;
                else hoQcOrphaned++;
            }
        }
    }
    w(`**2.4 HO qcItems:**`);
    w(`- Total: ${totalHoQc}`);
    w(`- Vinculados OK: ${hoQcLinked}`);
    w(`- Huérfanos: ${hoQcOrphaned}`);
    w(`- Sin cpItemId: ${totalHoQc - hoQcLinked - hoQcOrphaned}`);
    w();
}

writeFileSync(OUTPUT, md, 'utf-8');
console.log('Phase 2 done.');

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3 — Operation Names
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE 3: Operation Names ===');

w('---');
w();
w('## FASE 3 — Nombres de Operaciones');
w();

for (const fam of families) {
    const famDocs = familyDocs.filter(fd => fd.family_id === fam.id);
    const masterDocs = famDocs.filter(fd => Number(fd.is_master));

    const amfeData = parseData(masterDocs.find(fd => fd.module === 'amfe')?.document_id ? amfeMap[masterDocs.find(fd => fd.module === 'amfe').document_id] : null);
    const cpData = parseData(masterDocs.find(fd => fd.module === 'cp')?.document_id ? cpMap[masterDocs.find(fd => fd.module === 'cp').document_id] : null);
    const hoData = parseData(masterDocs.find(fd => fd.module === 'ho')?.document_id ? hoMap[masterDocs.find(fd => fd.module === 'ho').document_id] : null);
    const pfdData = parseData(masterDocs.find(fd => fd.module === 'pfd')?.document_id ? pfdMap[masterDocs.find(fd => fd.module === 'pfd').document_id] : null);

    w(`### ${fam.name}`);
    w();

    // PFD uses step.name and step.stepNumber
    const pfdOps = {};
    for (const step of (pfdData.steps || [])) {
        pfdOps[step.stepNumber] = step.name;
    }

    // AMFE uses op.opNumber and op.name
    const amfeOps = {};
    for (const op of (amfeData.operations || [])) {
        amfeOps[op.opNumber] = op.name;
    }

    // CP uses processStepNumber and processDescription
    const cpOps = {};
    for (const item of (cpData.items || [])) {
        if (!cpOps[item.processStepNumber]) cpOps[item.processStepNumber] = getCpStepName(item);
    }

    // HO uses sheet.operationNumber and sheet.operationName
    const hoOps = {};
    for (const sheet of (hoData.sheets || [])) {
        hoOps[sheet.operationNumber] = sheet.operationName;
    }

    const allOpNums = new Set([...Object.keys(pfdOps), ...Object.keys(amfeOps), ...Object.keys(cpOps), ...Object.keys(hoOps)]);
    const sortedOps = [...allOpNums].sort((a, b) => parseInt(a) - parseInt(b));

    const discrepancies = [];
    for (const opNum of sortedOps) {
        const names = {
            PFD: (pfdOps[opNum] || '').trim(),
            AMFE: (amfeOps[opNum] || '').trim(),
            CP: (cpOps[opNum] || '').trim(),
            HO: (hoOps[opNum] || '').trim(),
        };
        const nonEmpty = Object.entries(names).filter(([, v]) => v);
        if (nonEmpty.length <= 1) continue;
        const unique = [...new Set(nonEmpty.map(([, v]) => v.toUpperCase()))];
        if (unique.length > 1) {
            discrepancies.push({ opNum, ...names });
        }
    }

    if (discrepancies.length === 0) {
        w('✅ Nombres consistentes entre PFD, AMFE, CP y HO.');
    } else {
        w(`⚠️ ${discrepancies.length} discrepancias:`);
        w();
        table(['OP', 'PFD', 'AMFE', 'CP', 'HO'],
            discrepancies.map(d => [d.opNum, (d.PFD || '-').slice(0,35), (d.AMFE || '-').slice(0,35), (d.CP || '-').slice(0,35), (d.HO || '-').slice(0,35)]));
        for (const d of discrepancies) {
            finding('MENOR', fam.name, `OP ${d.opNum}: nombre difiere entre documentos`);
        }
    }
    w();
}

writeFileSync(OUTPUT, md, 'utf-8');
console.log('Phase 3 done.');

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4 — Headrest Specific
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE 4: Headrest Specific ===');

w('---');
w();
w('## FASE 4 — Headrests Específico');
w();

const headrestFamilies = families.filter(f => f.name.toLowerCase().includes('headrest'));

for (const fam of headrestFamilies) {
    const famDocs = familyDocs.filter(fd => fd.family_id === fam.id);
    const masterDocs = famDocs.filter(fd => Number(fd.is_master));
    const variantDocs = famDocs.filter(fd => !Number(fd.is_master));

    const amfeData = parseData(masterDocs.find(fd => fd.module === 'amfe')?.document_id ? amfeMap[masterDocs.find(fd => fd.module === 'amfe').document_id] : null);
    const cpData = parseData(masterDocs.find(fd => fd.module === 'cp')?.document_id ? cpMap[masterDocs.find(fd => fd.module === 'cp').document_id] : null);
    const hoData = parseData(masterDocs.find(fd => fd.module === 'ho')?.document_id ? hoMap[masterDocs.find(fd => fd.module === 'ho').document_id] : null);

    w(`### ${fam.name}`);
    w();

    // 4.1 applicableParts
    const amfeHeader = amfeData.header || {};
    const cpHeader = cpData.header || {};
    const applicableParts = amfeHeader.applicableParts || cpHeader.applicableParts || '';
    w(`**4.1 applicableParts:**`);
    w(`\`\`\``);
    w(applicableParts);
    w(`\`\`\``);
    const colorNames = ['titan black', 'rennes black', 'andino gray', 'dark slate'];
    const apLower = applicableParts.toLowerCase();
    const foundColors = colorNames.filter(c => apLower.includes(c));
    w(`- Colores encontrados: ${foundColors.length}/4 — ${foundColors.join(', ') || 'ninguno'} ${foundColors.length >= 4 ? '✅' : '⚠️'}`);
    if (foundColors.length < 4) finding('MEDIO', fam.name, `applicableParts solo tiene ${foundColors.length}/4 colores`);
    w();

    // 4.2 Costura Vista conditional
    const allText = JSON.stringify(amfeData) + JSON.stringify(cpData) + JSON.stringify(hoData);
    const hasCosturaVista = allText.toLowerCase().includes('costura vista');
    const hasConditional = allText.includes('Aplica solo a') || allText.includes('aplica solo a');
    w(`**4.2 Costura Vista condicional:**`);
    w(`- Presente: ${hasCosturaVista ? 'SI' : 'NO'}`);
    w(`- Texto "(Aplica solo a...)": ${hasConditional ? 'SI ✅' : 'NO ⚠️'}`);
    if (hasCosturaVista && !hasConditional) finding('MEDIO', fam.name, 'Costura Vista sin texto condicional');
    w();

    // 4.3 Part numbers
    const amfePN = amfeHeader.partNumber || '';
    const cpPN = cpHeader.partNumber || '';
    w(`**4.3 Part numbers:**`);
    w(`- AMFE partNumber: "${amfePN}" ${amfePN.includes('XXX') ? '⚠️ CONTIENE XXX' : '✅'}`);
    w(`- CP partNumber: "${cpPN}" ${cpPN.includes('XXX') ? '⚠️ CONTIENE XXX' : '✅'}`);
    if (amfePN.includes('XXX')) finding('GRAVE', fam.name, `AMFE partNumber contiene XXX`);
    if (cpPN.includes('XXX')) finding('GRAVE', fam.name, `CP partNumber contiene XXX`);
    w();

    // 4.4 "color equivocado" in OP 10
    const op10 = (amfeData.operations || []).find(op => op.opNumber === '10');
    let hasColorFail = false;
    if (op10) {
        for (const we of (op10.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    if ((fail.description || '').toLowerCase().includes('color')) hasColorFail = true;
                }
            }
        }
    }
    w(`**4.4 "Color equivocado" en OP 10:** ${hasColorFail ? 'SI ✅' : 'NO ⚠️'}`);
    if (!hasColorFail) finding('MENOR', fam.name, 'No hay modo de falla sobre color en OP 10');
    w();

    // 4.5 Flamabilidad TL 1010 as CC
    let hasFlamCC = false;
    for (const item of (cpData.items || [])) {
        const txt = (getCpCharacteristic(item) + ' ' + (item.specification || '')).toLowerCase();
        if ((txt.includes('flamab') || txt.includes('tl 1010')) && item.specialCharClass === 'CC') {
            hasFlamCC = true;
        }
    }
    w(`**4.5 Flamabilidad TL 1010 como CC:** ${hasFlamCC ? 'SI ✅' : 'NO ⚠️'}`);
    if (!hasFlamCC) finding('GRAVE', fam.name, 'Flamabilidad TL 1010 no está como CC en CP');
    w();

    // 4.6 Variant docs
    const varAmfe = variantDocs.filter(fd => fd.module === 'amfe').length;
    const varCp = variantDocs.filter(fd => fd.module === 'cp').length;
    const varHo = variantDocs.filter(fd => fd.module === 'ho').length;
    w(`**4.6 Docs variantes:** AMFE=${varAmfe}, CP=${varCp}, HO=${varHo} ${(varAmfe + varCp + varHo) === 0 ? '✅ consolidado' : '⚠️ existen variantes'}`);
    if (varAmfe + varCp + varHo > 0) finding('MENOR', fam.name, `${varAmfe + varCp + varHo} docs variante aún existen`);
    w();
}

writeFileSync(OUTPUT, md, 'utf-8');
console.log('Phase 4 done.');

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5 — Export readiness
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE 5: Export readiness ===');

w('---');
w();
w('## FASE 5 — Verificación de Exports (datos que impactan en el export)');
w();

const exportTargets = ['Insert', 'Armrest', 'Top Roll', 'Headrest Front', 'Telas Planas'];

for (const target of exportTargets) {
    const fam = families.find(f => f.name.toLowerCase().includes(target.toLowerCase()));
    if (!fam) { w(`### ${target} — NO ENCONTRADO`); w(); continue; }

    const famDocs = familyDocs.filter(fd => fd.family_id === fam.id);
    const masterDocs = famDocs.filter(fd => Number(fd.is_master));
    const masterCpId = masterDocs.find(fd => fd.module === 'cp')?.document_id;
    const cpData = parseData(masterCpId ? cpMap[masterCpId] : null);
    const cpHeader = cpData.header || {};
    const cpItems = cpData.items || [];

    w(`### ${fam.name}`);
    w();

    // 1. Gonzalo Cal
    w(`1. **plantApproval:** "${cpHeader.plantApproval || ''}" ${(cpHeader.plantApproval || '').includes('Cal') ? '✅' : '⚠️'}`);

    // 2. componentMaterial in reception
    const recItems = cpItems.filter(i => getCpStepName(i).toUpperCase().includes('RECEPCION'));
    const recWithMat = recItems.filter(i => (i.componentMaterial || '').trim());
    w(`2. **Componente/Material en recepción:** ${recWithMat.length}/${recItems.length} items con componentMaterial`);

    // 3. non-recep with material
    const nonRecItems = cpItems.filter(i => !getCpStepName(i).toUpperCase().includes('RECEPCION'));
    const nonRecWithMat = nonRecItems.filter(i => (i.componentMaterial || '').trim());
    w(`3. **Items no-recepción con material:** ${nonRecWithMat.length}`);

    // 4. Duplicates
    const keys = {};
    let dupes = 0;
    for (const item of cpItems) {
        const key = `${item.processStepNumber}||${getCpCharacteristic(item)}`;
        if (keys[key]) dupes++;
        keys[key] = true;
    }
    w(`4. **Filas duplicadas (misma OP+char):** ${dupes} ${dupes === 0 ? '✅' : '⚠️ (nota: puede ser válido si hay items de proceso y producto distintos)'}`);

    // 5. Step numbers
    const stepNums = [...new Set(cpItems.map(i => i.processStepNumber))].sort((a, b) => parseInt(a) - parseInt(b));
    w(`5. **Operaciones:** ${stepNums.join(', ')}`);

    // 6. Sequential charNums
    const charNums = cpItems.map(i => parseInt(i.characteristicNumber)).filter(n => !isNaN(n));
    const isSeq = charNums.every((n, i) => i === 0 || n >= charNums[i-1]);
    w(`6. **Numeración secuencial:** ${isSeq ? '✅' : '⚠️'}`);

    w();
}

writeFileSync(OUTPUT, md, 'utf-8');
console.log('Phase 5 done.');

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6 — Executive Summary
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== PHASE 6: Executive Summary ===');

const summaryLines = [];
summaryLines.push('## FASE 6 — Resumen Ejecutivo');
summaryLines.push('');
summaryLines.push('### Hallazgos por severidad');
summaryLines.push('');
summaryLines.push(`| Severidad | Cantidad |`);
summaryLines.push(`| --- | --- |`);
summaryLines.push(`| **BLOCKER** | ${findings.BLOCKER.length} |`);
summaryLines.push(`| **GRAVE** | ${findings.GRAVE.length} |`);
summaryLines.push(`| **MEDIO** | ${findings.MEDIO.length} |`);
summaryLines.push(`| **MENOR** | ${findings.MENOR.length} |`);
summaryLines.push(`| **TOTAL** | ${findings.BLOCKER.length + findings.GRAVE.length + findings.MEDIO.length + findings.MENOR.length} |`);
summaryLines.push('');

summaryLines.push('### ¿Presentable para auditor?');
summaryLines.push('');
for (const fam of families) {
    const blockers = findings.BLOCKER.filter(f => f.product === fam.name);
    const graves = findings.GRAVE.filter(f => f.product === fam.name);
    const status = (blockers.length + graves.length) === 0 ? '✅ SI' : `⚠️ NO (${blockers.length} blocker, ${graves.length} grave)`;
    summaryLines.push(`- **${fam.name}:** ${status}`);
}
summaryLines.push('');

for (const sev of ['BLOCKER', 'GRAVE', 'MEDIO', 'MENOR']) {
    if (findings[sev].length > 0) {
        summaryLines.push(`### ${sev}`);
        summaryLines.push('');
        for (const f of findings[sev]) {
            summaryLines.push(`- **${f.product}:** ${f.msg}`);
        }
        summaryLines.push('');
    }
}

md = md.replace('## FASE 6 — Resumen Ejecutivo (se completa al final)\n\n*(Ver final del documento)*', summaryLines.join('\n'));

writeFileSync(OUTPUT, md, 'utf-8');
console.log(`\n✅ Audit complete! → ${OUTPUT}`);
console.log(`   BLOCKER: ${findings.BLOCKER.length}`);
console.log(`   GRAVE:   ${findings.GRAVE.length}`);
console.log(`   MEDIO:   ${findings.MEDIO.length}`);
console.log(`   MENOR:   ${findings.MENOR.length}`);

close();

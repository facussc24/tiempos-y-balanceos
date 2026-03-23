#!/usr/bin/env node
/**
 * FIX Round 2: Enrich 18 Headrest HO sheets with TWI Key Points and Quality Checks
 *
 * Also repairs damage from failed V1 run (removes TBD steps from all sheets,
 * restores Op 20/30 to their original state).
 *
 * For each of the 3 Headrest HO masters (FRONT, REAR_CEN, REAR_OUT):
 *   - Ops 20 (Corte) and 30 (Costura Union) are REPAIRED then SKIPPED
 *   - Ops 10, 40, 50, 60, 70, 80 are enriched:
 *     1. Remove any TBD steps from V1
 *     2. Convert old step format (keyPoint/reason) → new (isKeyPoint/keyPointReason)
 *     3. Add verification steps from AMFE failure modes (severity >= 7)
 *     4. Mark relevant existing steps as key points
 *     5. Add quality checks from linked CP items
 *
 * Usage: node scripts/fix-round2-headrest-ho-kp-qc.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash, randomUUID } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const HEADREST_PROJECTS = [
    'VWA/PATAGONIA/HEADREST_FRONT',
    'VWA/PATAGONIA/HEADREST_REAR_CEN',
    'VWA/PATAGONIA/HEADREST_REAR_OUT',
];

/** Ops to SKIP — already complete with full steps, KPs, and QCs (string comparison!) */
const SKIP_OPS = new Set(['20', '30']);

/**
 * Mapping from HO operationNumber → CP processStepNumber.
 * CP was renumbered by Script 3 so HO op numbers don't match CP step numbers directly.
 */
const HO_TO_CP_STEP = {
    '10': '10',    // Recepcion → CP 10
    '40': '50',    // Ensamble → CP 50
    '50': '60',    // Espumado → CP 60
    '60': '70',    // Inspeccion → CP 70
    '70': '80',    // Embalaje → CP 80
    '80': '90',    // Test Lay Out → CP 90
};

/**
 * Content-based AMFE mapping.
 * HO operationNumber → AMFE opNumber. The AMFE operations are numbered differently
 * from the HO sheets, especially for REAR models which have fewer operations.
 *
 * We use a keyword-matching approach: for each HO sheet, find the AMFE operation
 * whose name best matches the HO operation content.
 */
const AMFE_MATCH_KEYWORDS = {
    '10': ['recepcion', 'materia prima'],           // HO Recepcion → AMFE RECEPCIONAR MATERIA PRIMA
    '40': ['ensamble', 'varilla', 'epp'],            // HO Ensamble → AMFE ENSAMBLE DE VARILLA + EPP
    '50': ['espumado', 'inyeccion pur', 'llenado'],  // HO Espumado → AMFE INYECCION PUR
    '60': ['inspeccion final'],                       // HO Inspeccion → AMFE INSPECCION FINAL
    '70': ['embalaje'],                               // HO Embalaje → AMFE EMBALAJE
    '80': ['test', 'lay out'],                        // HO Test Lay Out → no AMFE match (none exists)
};

/** Keywords in step descriptions that should be marked as key points */
const KP_CONTROL_KEYWORDS = ['verificar', 'controlar', 'inspeccionar'];
const KP_PROCESS_KEYWORDS = ['colocar molde', 'cerrar molde', 'inyectar'];

// ═══════════════════════════════════════════════════════════════════════════
// AMFE OPERATION MATCHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find the AMFE operation that best matches an HO sheet by content keywords.
 * AMFE operations have structure: { id, opNumber, name, workElements[] }
 */
function findAmfeOperationByContent(amfeDoc, hoOpNumber) {
    if (!amfeDoc || !amfeDoc.operations || !Array.isArray(amfeDoc.operations)) return null;

    const keywords = AMFE_MATCH_KEYWORDS[String(hoOpNumber)];
    if (!keywords) return null;

    // Score each AMFE operation by keyword matches
    let bestOp = null;
    let bestScore = 0;

    for (const op of amfeDoc.operations) {
        const nameLower = (op.name || '').toLowerCase();
        let score = 0;
        for (const kw of keywords) {
            if (nameLower.includes(kw)) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestOp = op;
        }
    }

    return bestOp;
}

/**
 * Extract all failures from an AMFE operation, traversing the nested structure:
 * operation.workElements[].functions[].failures[]
 *
 * Each failure has: { id, description (=failureMode), severity, effectLocal, causes[] }
 * Each cause has: { cause, preventionControl, detectionControl, occurrence, detection }
 */
function extractAllFailures(amfeOperation) {
    const failures = [];
    if (!amfeOperation) return failures;

    for (const we of (amfeOperation.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const failure of (fn.failures || [])) {
                failures.push(failure);
            }
        }
    }
    return failures;
}

// ═══════════════════════════════════════════════════════════════════════════
// AMFE ENRICHMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract verification steps from AMFE failures with severity >= 7.
 * Traverses the CORRECT nested structure: op.workElements[].functions[].failures[].
 */
function extractAmfeVerificationSteps(amfeOperation) {
    const steps = [];
    const failures = extractAllFailures(amfeOperation);

    for (const failure of failures) {
        const severity = parseInt(failure.severity || '0', 10);
        if (severity < 7) continue;

        // Build description from failure mode + prevention/detection control
        const failureDesc = failure.description || failure.failureMode || 'Falla no especificada';
        const effectLocal = failure.effectLocal || failure.effect || failureDesc;

        // Collect prevention/detection controls from causes
        const controls = [];
        for (const cause of (failure.causes || [])) {
            if (cause.preventionControl) controls.push(cause.preventionControl);
            else if (cause.detectionControl) controls.push(cause.detectionControl);
        }
        const controlStr = controls.length > 0 ? controls[0] : '';

        const description = controlStr
            ? `Verificar: ${failureDesc} — ${controlStr}`
            : `Verificar: ${failureDesc}`;

        // Avoid duplicates (same failure description)
        if (!steps.some(s => s.description === description)) {
            steps.push({
                id: randomUUID(),
                stepNumber: 0, // will be renumbered later
                description,
                isKeyPoint: true,
                keyPointReason: `S=${severity}: ${effectLocal}`,
            });
        }
    }

    return steps;
}

// ═══════════════════════════════════════════════════════════════════════════
// CP QUALITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract quality checks from CP items for a given CP step number.
 * CP items use `processStepNumber` (string) as the step identifier.
 */
function extractQualityChecks(cpDoc, cpStepNum) {
    const qcs = [];
    if (!cpDoc || !cpDoc.items || !Array.isArray(cpDoc.items)) return qcs;

    const matchingItems = cpDoc.items.filter(item => {
        return String(item.processStepNumber || '') === String(cpStepNum);
    });

    for (const item of matchingItems) {
        const qc = {
            id: randomUUID(),
            characteristic: item.productCharacteristic || item.processCharacteristic || '',
            specification: item.specification || '',
            evaluationTechnique: item.evaluationTechnique || '',
            frequency: item.sampleFrequency || '',
            controlMethod: item.controlMethod || '',
            reactionAction: item.reactionPlan || '',
            reactionContact: item.reactionPlanOwner || '',
            specialCharSymbol: item.specialCharClass || '',
            registro: item.controlProcedure || '',
        };

        // Add traceability
        if (item.id) {
            qc.cpItemId = item.id;
        }

        qcs.push(qc);
    }

    return qcs;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP FORMAT CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a step to new format (isKeyPoint/keyPointReason), keeping existing values
 * if already in new format. Also applies keyword-based KP marking.
 */
function convertStep(step) {
    const alreadyNew = 'isKeyPoint' in step;

    const newStep = {
        id: step.id,
        stepNumber: step.stepNumber,
        description: step.description || '',
        isKeyPoint: alreadyNew ? step.isKeyPoint : false,
        keyPointReason: alreadyNew ? (step.keyPointReason || '') : '',
    };

    // If step already has isKeyPoint=true with a reason, keep it
    if (newStep.isKeyPoint && newStep.keyPointReason) {
        return newStep;
    }

    // Apply keyword-based KP marking for steps that don't already have a KP reason
    const descLower = (step.description || '').toLowerCase();

    for (const kw of KP_CONTROL_KEYWORDS) {
        if (descLower.includes(kw)) {
            newStep.isKeyPoint = true;
            newStep.keyPointReason = newStep.keyPointReason || 'Control de calidad';
            return newStep;
        }
    }

    for (const kw of KP_PROCESS_KEYWORDS) {
        if (descLower.includes(kw)) {
            newStep.isKeyPoint = true;
            newStep.keyPointReason = newStep.keyPointReason || 'Seguridad/Calidad del proceso';
            return newStep;
        }
    }

    return newStep;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET REPAIR (undo V1 damage)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Remove TBD steps added by the failed V1 run.
 * Returns true if any TBD steps were removed.
 */
function removeTbdSteps(sheet) {
    if (!sheet.steps || sheet.steps.length === 0) return false;
    const before = sheet.steps.length;
    sheet.steps = sheet.steps.filter(s =>
        !(s.description || '').startsWith('TBD')
    );
    return sheet.steps.length < before;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a sheet uses old format (has keyPoint/reason instead of isKeyPoint/keyPointReason).
 */
function isOldFormat(sheet) {
    if (!sheet.steps || sheet.steps.length === 0) return false;
    const firstStep = sheet.steps[0];
    return ('keyPoint' in firstStep || 'reason' in firstStep) && !('isKeyPoint' in firstStep);
}

/**
 * Count key points in a sheet's steps.
 */
function countKeyPoints(steps) {
    return steps.filter(s => s.isKeyPoint === true).length;
}

/**
 * Process a single incomplete HO sheet (Ops 10, 40, 50, 60, 70, 80).
 */
function processSheet(sheet, amfeDoc, cpDoc) {
    const opNum = sheet.operationNumber;
    const opName = sheet.operationName || '(unnamed)';
    const report = {
        sheetName: `Op ${opNum} — ${opName}`,
        stepsBefore: 0,
        stepsAfter: 0,
        formatConverted: false,
        kpBefore: 0,
        kpAfter: 0,
        qcBefore: (sheet.qualityChecks || []).length,
        qcAfter: 0,
        qcCharacteristics: [],
        amfeStepsAdded: 0,
        amfeOpMatched: '(none)',
        cpStepMatched: '(none)',
    };

    // ── 0. Remove TBD steps from V1 ────────────────────────────────────
    removeTbdSteps(sheet);

    const oldSteps = sheet.steps || [];
    report.stepsBefore = oldSteps.length;
    report.formatConverted = isOldFormat(sheet);
    report.kpBefore = countKeyPoints(oldSteps);

    // ── 1. Convert step format and apply KP keywords ────────────────────
    const convertedSteps = oldSteps.map(s => convertStep(s));

    // ── 2. Find matching AMFE operation and extract verification steps ──
    const amfeOp = findAmfeOperationByContent(amfeDoc, opNum);
    if (amfeOp) {
        report.amfeOpMatched = `AMFE Op ${amfeOp.opNumber}: ${amfeOp.name}`;
    }

    const amfeSteps = extractAmfeVerificationSteps(amfeOp);
    report.amfeStepsAdded = amfeSteps.length;

    // Combine: existing steps first, then new AMFE verification steps
    const allSteps = [...convertedSteps, ...amfeSteps];

    // ── 3. Renumber all steps sequentially ──────────────────────────────
    allSteps.forEach((s, idx) => {
        s.stepNumber = idx + 1;
    });

    sheet.steps = allSteps;
    report.stepsAfter = allSteps.length;
    report.kpAfter = countKeyPoints(allSteps);

    // ── 4. Add QCs from CP ──────────────────────────────────────────────
    const cpStepNum = HO_TO_CP_STEP[String(opNum)];
    let newQcs = [];
    if (cpStepNum) {
        report.cpStepMatched = `CP Step ${cpStepNum}`;
        newQcs = extractQualityChecks(cpDoc, cpStepNum);
    }

    // Replace any existing QCs (V1 didn't add any, but be safe)
    sheet.qualityChecks = newQcs;
    report.qcAfter = newQcs.length;
    report.qcCharacteristics = newQcs.map(qc => qc.characteristic || '(sin nombre)');

    return { modified: true, report };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('  FIX Round 2 (V2): Enrich 18 Headrest HO Sheets with KPs and QCs');
    console.log('  Also repairs V1 damage (TBD steps, Op 20/30 modifications)');
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    await initSupabase();

    // ── Step 1: Load HO documents ────────────────────────────────────────
    console.log('── Step 1: Loading HO documents ──────────────────────────────────');
    const projectList = HEADREST_PROJECTS.map(p => `'${p}'`).join(',');

    const hoRows = await selectSql(
        `SELECT id, data, linked_amfe_project FROM ho_documents WHERE linked_amfe_project IN (${projectList})`
    );
    console.log(`  Found ${hoRows.length} HO document(s)\n`);

    // ── Step 2: Load AMFE documents ──────────────────────────────────────
    console.log('── Step 2: Loading AMFE documents ────────────────────────────────');
    const amfeRows = await selectSql(
        `SELECT id, data, project_name FROM amfe_documents WHERE project_name IN (${projectList})`
    );
    console.log(`  Found ${amfeRows.length} AMFE document(s)\n`);

    // ── Step 3: Load CP documents ────────────────────────────────────────
    console.log('── Step 3: Loading CP documents ──────────────────────────────────');
    const cpRows = await selectSql(
        `SELECT id, data, project_name FROM cp_documents WHERE project_name IN (${projectList})`
    );
    console.log(`  Found ${cpRows.length} CP document(s)\n`);

    if (hoRows.length === 0) {
        console.log('  No Headrest HO documents found. Exiting.');
        close();
        return;
    }

    // Build lookup maps: project → parsed AMFE/CP data
    const amfeByProject = {};
    for (const row of amfeRows) {
        try {
            amfeByProject[row.project_name] = JSON.parse(row.data);
        } catch (e) {
            console.log(`  WARNING: Could not parse AMFE data for ${row.project_name}: ${e.message}`);
        }
    }

    const cpByProject = {};
    for (const row of cpRows) {
        try {
            cpByProject[row.project_name] = JSON.parse(row.data);
        } catch (e) {
            console.log(`  WARNING: Could not parse CP data for ${row.project_name}: ${e.message}`);
        }
    }

    // ── Step 4: Process each HO document ─────────────────────────────────
    let totalSheetsModified = 0;
    let totalSheetsSkipped = 0;
    let totalSheetsRepaired = 0;
    const allReports = [];

    for (const hoRow of hoRows) {
        const project = hoRow.linked_amfe_project;
        console.log(`\n══════════════════════════════════════════════════════════════`);
        console.log(`  Processing HO: ${hoRow.id} (${project})`);
        console.log(`══════════════════════════════════════════════════════════════`);

        let hoDoc;
        try {
            hoDoc = JSON.parse(hoRow.data);
        } catch (e) {
            console.log(`  ERROR: Could not parse HO data: ${e.message}`);
            continue;
        }

        if (!hoDoc.sheets || !Array.isArray(hoDoc.sheets)) {
            console.log(`  WARNING: No sheets array found.`);
            continue;
        }

        const amfeDoc = amfeByProject[project] || null;
        const cpDoc = cpByProject[project] || null;

        if (!amfeDoc) console.log(`  WARNING: No AMFE found for ${project}`);
        if (!cpDoc) console.log(`  WARNING: No CP found for ${project}`);

        let docModified = false;

        for (const sheet of hoDoc.sheets) {
            const opNum = String(sheet.operationNumber);

            if (SKIP_OPS.has(opNum)) {
                // REPAIR: remove any TBD steps added by V1
                const hadTbd = removeTbdSteps(sheet);
                if (hadTbd) {
                    // Renumber steps after removing TBD
                    sheet.steps.forEach((s, idx) => { s.stepNumber = idx + 1; });
                    docModified = true;
                    totalSheetsRepaired++;
                    console.log(`  REPAIRED: Op ${opNum} (${sheet.operationName}) — removed TBD step`);
                } else {
                    console.log(`  SKIP: Op ${opNum} (${sheet.operationName}) — already complete`);
                }
                totalSheetsSkipped++;
                continue;
            }

            console.log(`\n  ── Processing Op ${opNum}: ${sheet.operationName || '(unnamed)'} ──`);

            const { modified, report } = processSheet(sheet, amfeDoc, cpDoc);

            if (modified) {
                docModified = true;
                totalSheetsModified++;
                allReports.push({ project, ...report });

                console.log(`    AMFE match: ${report.amfeOpMatched}`);
                console.log(`    CP match: ${report.cpStepMatched}`);
                console.log(`    Format: ${report.formatConverted ? 'converted old→new' : 'already new format'}`);
                console.log(`    Steps: ${report.stepsBefore} → ${report.stepsAfter} (+${report.amfeStepsAdded} from AMFE)`);
                console.log(`    KPs: ${report.kpBefore} → ${report.kpAfter}`);
                console.log(`    QCs: ${report.qcBefore} → ${report.qcAfter}`);
                if (report.qcCharacteristics.length > 0) {
                    for (const ch of report.qcCharacteristics) {
                        console.log(`      - ${ch}`);
                    }
                }
            }
        }

        if (!docModified) {
            console.log(`  No changes needed for this document.\n`);
            continue;
        }

        // ── Write back to Supabase ──────────────────────────────────────
        const jsonStr = JSON.stringify(hoDoc);
        const checksum = sha256(jsonStr);

        await execSql(
            `UPDATE ho_documents SET data = '${jsonStr.replace(/'/g, "''")}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${hoRow.id}'`
        );

        console.log(`\n  SAVED to Supabase (checksum: ${checksum.slice(0, 12)}...)`);
    }

    // ── Summary ──────────────────────────────────────────────────────────
    console.log('\n\n═══════════════════════════════════════════════════════════════════════');
    console.log('  FINAL SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  Sheets enriched: ${totalSheetsModified}`);
    console.log(`  Sheets skipped (Op 20/30): ${totalSheetsSkipped}`);
    console.log(`  Sheets repaired (V1 TBD removed): ${totalSheetsRepaired}`);
    console.log(`  Total reports: ${allReports.length}`);

    console.log('\n── Detailed Report per Sheet ──────────────────────────────────────\n');

    for (const r of allReports) {
        console.log(`  [${r.project}] ${r.sheetName}`);
        console.log(`    AMFE: ${r.amfeOpMatched}`);
        console.log(`    CP:   ${r.cpStepMatched}`);
        console.log(`    Steps: ${r.stepsBefore} → ${r.stepsAfter} | Format: ${r.formatConverted ? 'converted' : 'kept'}`);
        console.log(`    KPs:   ${r.kpBefore} → ${r.kpAfter}`);
        console.log(`    QCs:   ${r.qcBefore} → ${r.qcAfter}${r.qcCharacteristics.length > 0 ? ' (' + r.qcCharacteristics.join(', ') + ')' : ''}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('  DONE');
    console.log('═══════════════════════════════════════════════════════════════════════');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

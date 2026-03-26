#!/usr/bin/env node
/**
 * fix-headrest-op90-layout.mjs
 *
 * Adds OP 90 "TEST DE LAY OUT" to AMFE and HO documents for all headrest products.
 * Each headrest has this operation in its CP (2 items per headrest) but it was missing
 * from AMFE and HO. This script creates the AMFE failure analysis and HO work
 * instructions, linking HO quality checks back to the existing CP items.
 *
 * Products: VWA/PATAGONIA/HEADREST_FRONT, HEADREST_REAR_CEN, HEADREST_REAR_OUT
 * Each has master + 3 variants (L1/L2/L3) = 12 AMFE docs, 12 HO docs, 12 CP docs.
 *
 * Usage: node scripts/fix-headrest-op90-layout.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash, randomUUID } from 'crypto';
const uuid = () => randomUUID();

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function parseData(row) {
    return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
}

function sha256(data) {
    return createHash('sha256').update(data).digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// AP CALCULATION (mirrors apRule in AMFE module)
// ═══════════════════════════════════════════════════════════════════════════

function apRule(s, o, d) {
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
    if (o >= 6) return 'H';
    if (o >= 4) return d >= 2 ? 'H' : 'M';
    if (o >= 2) { return d >= 7 ? 'H' : d >= 5 ? 'M' : 'L'; }
    return 'L';
}

// ═══════════════════════════════════════════════════════════════════════════
// AMFE OP 90 CREATION
// ═══════════════════════════════════════════════════════════════════════════

function createOp90() {
    return {
        id: uuid(),
        opNumber: '90',
        name: 'TEST DE LAY OUT',
        workElements: [{
            id: uuid(),
            type: 'Measurement',
            name: 'Equipos de medición dimensional',
            functions: [{
                id: uuid(),
                description: 'Verificar dimensiones críticas del producto terminado según plano',
                requirements: 'Dimensiones dentro de tolerancia según plano del producto',
                failures: [{
                    id: uuid(),
                    description: 'Dimensiones fuera de tolerancia',
                    effectLocal: 'Pieza no conforme dimensionalmente',
                    effectNextLevel: 'Rechazo del lote en planta cliente',
                    effectEndUser: 'Defecto dimensional en apoyacabezas terminado',
                    severity: 7,
                    severityLocal: '',
                    severityNextLevel: '',
                    severityEndUser: '',
                    causes: [
                        {
                            id: uuid(),
                            cause: 'Desgaste de herramientas o moldes',
                            preventionControl: 'Mantenimiento preventivo de moldes y herramientas',
                            detectionControl: 'Inspección dimensional con calibre/plantilla según plano',
                            occurrence: 3,
                            detection: 4,
                            ap: apRule(7, 3, 4),
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
                        },
                        {
                            id: uuid(),
                            cause: 'Variación en proceso de inyección',
                            preventionControl: 'Control de parámetros de proceso según hoja de operaciones',
                            detectionControl: 'Inspección dimensional periódica según Plan de Control',
                            occurrence: 3,
                            detection: 4,
                            ap: apRule(7, 3, 4),
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
                        },
                    ],
                }],
            }],
        }],
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// HO SHEET 90 CREATION
// ═══════════════════════════════════════════════════════════════════════════

function createHoSheet90(amfeOpId, cpItems) {
    const qualityChecks = cpItems.map(cpItem => ({
        id: uuid(),
        characteristic: cpItem.productCharacteristic || cpItem.processCharacteristic || '',
        specification: cpItem.specification || '',
        evaluationTechnique: cpItem.evaluationTechnique || '',
        frequency: cpItem.sampleFrequency || '',
        controlMethod: cpItem.controlMethod || '',
        reactionAction: cpItem.reactionPlan || '',
        reactionContact: cpItem.reactionPlanOwner || '',
        specialCharSymbol: cpItem.specialCharClass || '',
        registro: '',
        cpItemId: cpItem.id,
    }));

    return {
        id: uuid(),
        amfeOperationId: amfeOpId,
        operationNumber: '90',
        operationName: 'TEST DE LAY OUT',
        hoNumber: 'HO-90',
        sector: 'Calidad',
        puestoNumber: '',
        vehicleModel: '',
        partCodeDescription: '',
        steps: [
            {
                id: uuid(),
                stepNumber: 1,
                description: 'Seleccionar muestra según frecuencia del Plan de Control',
                isKeyPoint: false,
                keyPointReason: '',
                visualAidId: '',
            },
            {
                id: uuid(),
                stepNumber: 2,
                description: 'Verificar dimensiones críticas con calibre/plantilla según plano del producto',
                isKeyPoint: true,
                keyPointReason: 'Dimensiones fuera de tolerancia causan rechazo del lote',
                visualAidId: '',
            },
            {
                id: uuid(),
                stepNumber: 3,
                description: 'Registrar resultados en planilla de inspección dimensional',
                isKeyPoint: false,
                keyPointReason: '',
                visualAidId: '',
            },
        ],
        qualityChecks,
        safetyElements: [],
        visualAids: [],
        reactionPlanText: 'SI DETECTA DIMENSIONES FUERA DE TOLERANCIA, DETENGA LA OPERACION, SEGREGUE LA PIEZA E INFORME AL SUPERVISOR DE CALIDAD.',
        preparedBy: '',
        approvedBy: '',
        date: '',
        revision: '',
        status: 'borrador',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS RECALCULATION
// ═══════════════════════════════════════════════════════════════════════════

function computeAmfeStats(doc) {
    let causeCount = 0;
    let apHCount = 0;
    let apMCount = 0;
    let filledCauses = 0;

    for (const op of doc.operations) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        causeCount++;
                        const ap = (cause.ap || '').toUpperCase();
                        if (ap === 'H') apHCount++;
                        if (ap === 'M') apMCount++;
                        if (fail.severity && cause.occurrence && cause.detection) filledCauses++;
                    }
                }
            }
        }
    }

    return {
        operationCount: doc.operations.length,
        causeCount,
        apHCount,
        apMCount,
        coveragePercent: causeCount > 0 ? Math.round((filledCauses / causeCount) * 100) : 0,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('='.repeat(72));
    console.log('  ADD OP 90 "TEST DE LAY OUT" TO HEADREST AMFE & HO DOCUMENTS');
    console.log('='.repeat(72));

    await initSupabase();

    // ── 1. Load all headrest documents ─────────────────────────────────
    console.log('\n── Loading headrest documents from Supabase ──\n');

    const amfeRows = await selectSql(
        `SELECT id, project_name, data FROM amfe_documents WHERE project_name LIKE '%HEADREST%' ORDER BY project_name`
    );
    console.log(`  AMFE documents found: ${amfeRows.length}`);
    for (const r of amfeRows) console.log(`    - ${r.project_name} (${r.id})`);

    const cpRows = await selectSql(
        `SELECT id, project_name, data, linked_amfe_project FROM cp_documents WHERE project_name LIKE '%HEADREST%' OR linked_amfe_project LIKE '%HEADREST%' ORDER BY project_name`
    );
    console.log(`  CP documents found: ${cpRows.length}`);
    for (const r of cpRows) console.log(`    - ${r.project_name} (${r.id})`);

    const hoRows = await selectSql(
        `SELECT id, linked_amfe_project, data FROM ho_documents WHERE linked_amfe_project LIKE '%HEADREST%' ORDER BY linked_amfe_project`
    );
    console.log(`  HO documents found: ${hoRows.length}`);
    for (const r of hoRows) console.log(`    - ${r.linked_amfe_project} (${r.id})`);

    // Validate counts
    if (amfeRows.length !== 12) {
        console.warn(`\n  WARNING: Expected 12 AMFE docs, found ${amfeRows.length}`);
    }
    if (hoRows.length !== 12) {
        console.warn(`\n  WARNING: Expected 12 HO docs, found ${hoRows.length}`);
    }

    // ── 2. Process AMFE documents ──────────────────────────────────────
    console.log('\n' + '='.repeat(72));
    console.log('  PHASE 1: ADD OP 90 TO AMFE DOCUMENTS');
    console.log('='.repeat(72));

    // Map to track amfeProjectName -> op90 id for HO linking
    const amfeOp90Map = new Map();
    let amfeUpdated = 0;
    let amfeSkipped = 0;

    for (const row of amfeRows) {
        console.log(`\n── AMFE: ${row.project_name} ──`);

        let doc;
        try {
            doc = parseData(row);
        } catch (e) {
            console.error(`  ERROR parsing JSON: ${e.message}`);
            continue;
        }

        if (!doc.operations) doc.operations = [];

        // Check if OP 90 already exists
        const existingOp90 = doc.operations.find(op =>
            op.opNumber === '90' || op.name === 'TEST DE LAY OUT'
        );

        if (existingOp90) {
            console.log(`  OP 90 already exists (id: ${existingOp90.id}) — skipping`);
            amfeOp90Map.set(row.project_name, existingOp90.id);
            amfeSkipped++;
            continue;
        }

        // Create OP 90 and add to operations
        const op90 = createOp90();
        doc.operations.push(op90);
        amfeOp90Map.set(row.project_name, op90.id);

        console.log(`  Created OP 90 (id: ${op90.id})`);
        console.log(`    - 1 work element, 1 function, 1 failure mode, 2 causes`);
        console.log(`    - S=7, O=3, D=4, AP=${apRule(7, 3, 4)}`);

        // Recalculate stats
        const stats = computeAmfeStats(doc);
        console.log(`  Stats: ${stats.operationCount} ops, ${stats.causeCount} causes, AP_H=${stats.apHCount}, AP_M=${stats.apMCount}, coverage=${stats.coveragePercent}%`);

        // Save
        const jsonStr = JSON.stringify(doc);
        const checksum = sha256(jsonStr);
        const escapedJson = jsonStr.replace(/'/g, "''");

        const updateSql = `UPDATE amfe_documents SET
            data = '${escapedJson}',
            checksum = '${checksum}',
            operation_count = ${stats.operationCount},
            cause_count = ${stats.causeCount},
            ap_h_count = ${stats.apHCount},
            ap_m_count = ${stats.apMCount},
            coverage_percent = ${stats.coveragePercent},
            updated_at = NOW()
            WHERE id = '${row.id}'`;

        try {
            const result = await execSql(updateSql);
            console.log(`  SAVED (rows affected: ${result.rowsAffected}, checksum: ${checksum.slice(0, 12)}...)`);
            amfeUpdated++;
        } catch (e) {
            console.error(`  ERROR saving: ${e.message}`);
        }
    }

    // ── 3. Process HO documents ────────────────────────────────────────
    console.log('\n' + '='.repeat(72));
    console.log('  PHASE 2: ADD OP 90 SHEET TO HO DOCUMENTS');
    console.log('='.repeat(72));

    let hoUpdated = 0;
    let hoSkipped = 0;
    let totalQcsCreated = 0;

    for (const hoRow of hoRows) {
        const projectName = hoRow.linked_amfe_project;
        console.log(`\n── HO: ${projectName} ──`);

        let hoDoc;
        try {
            hoDoc = parseData(hoRow);
        } catch (e) {
            console.error(`  ERROR parsing JSON: ${e.message}`);
            continue;
        }

        if (!hoDoc.sheets) hoDoc.sheets = [];

        // Check if HO sheet for OP 90 already exists
        const existingSheet90 = hoDoc.sheets.find(s =>
            s.operationNumber === '90' || s.operationName === 'TEST DE LAY OUT'
        );

        if (existingSheet90) {
            console.log(`  Sheet for OP 90 already exists (id: ${existingSheet90.id}) — skipping`);
            hoSkipped++;
            continue;
        }

        // Find matching CP document
        const matchingCp = cpRows.find(cp => {
            const cpLinked = cp.linked_amfe_project || '';
            const cpProject = cp.project_name || '';
            return cpLinked === projectName || cpProject === projectName;
        });

        if (!matchingCp) {
            console.error(`  ERROR: No matching CP found for ${projectName}`);
            continue;
        }

        console.log(`  Matched CP: ${matchingCp.project_name} (${matchingCp.id})`);

        // Parse CP and find OP 90 items
        let cpDoc;
        try {
            cpDoc = parseData(matchingCp);
        } catch (e) {
            console.error(`  ERROR parsing CP JSON: ${e.message}`);
            continue;
        }

        const cpItems90 = (cpDoc.items || []).filter(item =>
            item.processStepNumber === '90'
        );
        console.log(`  CP items for OP 90: ${cpItems90.length}`);

        if (cpItems90.length === 0) {
            console.warn(`  WARNING: No CP items found for OP 90 — creating sheet without QCs`);
        }

        // Get the AMFE OP 90 id for linking
        const amfeOpId = amfeOp90Map.get(projectName) || '';
        if (!amfeOpId) {
            console.warn(`  WARNING: No AMFE OP 90 id found for ${projectName}`);
        } else {
            console.log(`  AMFE OP 90 id: ${amfeOpId}`);
        }

        // Create HO sheet
        const sheet90 = createHoSheet90(amfeOpId, cpItems90);
        hoDoc.sheets.push(sheet90);

        console.log(`  Created HO sheet (id: ${sheet90.id})`);
        console.log(`    - 3 steps, ${sheet90.qualityChecks.length} quality checks`);
        totalQcsCreated += sheet90.qualityChecks.length;

        for (const qc of sheet90.qualityChecks) {
            console.log(`    QC: "${qc.characteristic.slice(0, 60)}" | cpItemId: ${qc.cpItemId}`);
        }

        // Save
        const jsonStr = JSON.stringify(hoDoc);
        const checksum = sha256(jsonStr);
        const escapedJson = jsonStr.replace(/'/g, "''");

        const updateSql = `UPDATE ho_documents SET
            data = '${escapedJson}',
            checksum = '${checksum}',
            sheet_count = ${hoDoc.sheets.length},
            updated_at = NOW()
            WHERE id = '${hoRow.id}'`;

        try {
            const result = await execSql(updateSql);
            console.log(`  SAVED (rows affected: ${result.rowsAffected}, checksum: ${checksum.slice(0, 12)}...)`);
            hoUpdated++;
        } catch (e) {
            console.error(`  ERROR saving: ${e.message}`);
        }
    }

    // ── 4. Final report ────────────────────────────────────────────────
    console.log('\n' + '='.repeat(72));
    console.log('  FINAL REPORT');
    console.log('='.repeat(72));
    console.log(`\n  AMFE documents:`);
    console.log(`    Updated:  ${amfeUpdated}`);
    console.log(`    Skipped:  ${amfeSkipped} (already had OP 90)`);
    console.log(`    Total:    ${amfeRows.length}`);
    console.log(`\n  HO documents:`);
    console.log(`    Updated:  ${hoUpdated}`);
    console.log(`    Skipped:  ${hoSkipped} (already had OP 90 sheet)`);
    console.log(`    Total:    ${hoRows.length}`);
    console.log(`\n  Quality checks created: ${totalQcsCreated}`);
    console.log(`\n  AP level for new causes: ${apRule(7, 3, 4)} (S=7, O=3, D=4)`);

    close();
    console.log('\nDone.');
}

main().catch(e => {
    console.error('\nFATAL ERROR:', e);
    close();
    process.exit(1);
});

#!/usr/bin/env node
/**
 * fix-add-flamabilidad-vwa.mjs
 *
 * Adds flamabilidad TL 1010 VW failure mode + CP item + HO quality check
 * to 4 VWA products (3 headrests + Top Roll) in Supabase.
 *
 * For each product:
 *   1. AMFE: Adds a new failure to Op 10 (headrests) or Op 5 (Top Roll) Recepcion
 *   2. CP:   Adds a new item at the beginning of step "10" (headrests) or "5" (Top Roll)
 *   3. HO:   Adds a quality check to the Recepcion sheet
 *
 * All IDs are cross-linked: AMFE cause → CP item → HO quality check.
 *
 * Usage: node scripts/fix-add-flamabilidad-vwa.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash, randomUUID } from 'crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function parseData(row) {
    return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
}

// ─── Product Definitions ─────────────────────────────────────────────────────

const PRODUCTS = [
    {
        name: 'Headrest Front',
        amfeNumber: 'AMFE-151',
        cpNumber: 'CP-HR-FRONT-L0',
        hoPartDescMatch: 'Delantero',
        recepcionOp: '10',
        cpProcessDescription: 'RECEPCIONAR MATERIA PRIMA',
    },
    {
        name: 'Headrest Rear Center',
        amfeNumber: 'AMFE-153',
        cpNumber: 'CP-HR-REAR_CEN-L0',
        hoPartDescMatch: 'Trasero Central',
        recepcionOp: '10',
        cpProcessDescription: 'RECEPCIONAR MATERIA PRIMA',
    },
    {
        name: 'Headrest Rear Outer',
        amfeNumber: 'AMFE-155',
        cpNumber: 'CP-HR-REAR_OUT-L0',
        hoPartDescMatch: 'Trasero Lateral',
        recepcionOp: '10',
        cpProcessDescription: 'RECEPCIONAR MATERIA PRIMA',
    },
    {
        name: 'Top Roll',
        amfeNumber: 'AMFE-TOPROLL-001',
        cpNumber: 'CP-TOPROLL-001',
        hoPartDescMatch: 'TOP ROLL',
        recepcionOp: '5',
        cpProcessDescription: 'RECEPCION DE MATERIALES',
    },
];

// ─── AMFE: Add flamabilidad failure ──────────────────────────────────────────

async function updateAmfe(product) {
    console.log(`\n  ── AMFE (${product.amfeNumber}) ──`);

    const rows = await selectSql(
        `SELECT id, data FROM amfe_documents WHERE amfe_number = '${product.amfeNumber.replace(/'/g, "''")}'`
    );

    if (rows.length === 0) {
        console.log(`    ERROR: AMFE ${product.amfeNumber} not found!`);
        return null;
    }

    const doc = rows[0];
    const data = parseData(doc);

    // Find Recepcion operation
    const op = (data.operations || []).find(
        o => (o.operationNumber || o.opNumber) === product.recepcionOp
    );

    if (!op) {
        console.log(`    ERROR: Op ${product.recepcionOp} not found in AMFE!`);
        console.log(`    Available ops: ${(data.operations || []).map(o => (o.operationNumber || o.opNumber) + ' - ' + (o.name || o.operationName || '')).join(', ')}`);
        return null;
    }

    console.log(`    Found Op ${product.recepcionOp}: ${op.name || op.operationName || '(unnamed)'}`);

    // Find first workElement with type "Machine"
    const we = (op.workElements || []).find(w => w.type === 'Machine');
    if (!we) {
        console.log(`    ERROR: No Machine workElement in Op ${product.recepcionOp}!`);
        return null;
    }

    // Find its first function
    const fn = (we.functions || [])[0];
    if (!fn) {
        console.log(`    ERROR: No functions in Machine workElement!`);
        return null;
    }

    console.log(`    WorkElement: ${we.description || we.name || '(unnamed)'}`);
    console.log(`    Function: ${fn.description || fn.name || '(unnamed)'}`);

    // Check if flamabilidad failure already exists
    const existingFailure = (fn.failures || []).find(
        f => /flamabilidad.*TL\s*1010/i.test(f.description || '')
    );
    if (existingFailure) {
        console.log(`    SKIP: Flamabilidad TL 1010 failure already exists (id=${existingFailure.id})`);
        // Return existing IDs for CP/HO linking
        const existingCause = (existingFailure.causes || [])[0];
        return {
            failureId: existingFailure.id,
            causeId: existingCause ? existingCause.id : null,
        };
    }

    // Create new failure
    const causeId = randomUUID();
    const failureId = randomUUID();

    const newFailure = {
        id: failureId,
        description: "Material no cumple requisito de flamabilidad TL 1010 VW",
        effectLocal: "Material no apto para uso",
        effectNextLevel: "Paro de linea VW por incumplimiento normativo",
        effectEndUser: "Riesgo de propagacion de fuego en habitaculo",
        severity: 10,
        severityLocal: "",
        severityNextLevel: "",
        severityEndUser: "",
        causes: [{
            id: causeId,
            cause: "Material fuera de especificacion requerida",
            preventionControl: "Certificado de flamabilidad del proveedor segun TL 1010",
            detectionControl: "Verificacion documental en recepcion",
            occurrence: 2,
            detection: 3,
            ap: "M",
            characteristicNumber: "",
            specialChar: "CC",
            filterCode: "",
            preventionAction: "",
            detectionAction: "",
            responsible: "Carlos Baptista (Ingeniería)",
            targetDate: "2026-07-01",
            status: "Pendiente",
            actionTaken: "",
            completionDate: "",
            severityNew: "",
            occurrenceNew: "",
            detectionNew: "",
            apNew: "",
            observations: ""
        }]
    };

    if (!fn.failures) fn.failures = [];
    fn.failures.push(newFailure);

    console.log(`    Added failure: "${newFailure.description}" (S=10, O=2, D=3, AP=M, CC)`);
    console.log(`    Failure ID: ${failureId}`);
    console.log(`    Cause ID:   ${causeId}`);

    // Recompute AMFE metadata
    let causeCount = 0, apHCount = 0, apMCount = 0, filledCauses = 0;
    const operationCount = (data.operations || []).length;

    for (const o of data.operations || []) {
        for (const w of o.workElements || []) {
            for (const f of w.functions || []) {
                for (const fail of f.failures || []) {
                    for (const cause of fail.causes || []) {
                        causeCount++;
                        if (cause.ap === 'H' || cause.ap === 'HIGH') apHCount++;
                        if (cause.ap === 'M' || cause.ap === 'MEDIUM') apMCount++;
                        if (fail.severity && cause.occurrence && cause.detection) filledCauses++;
                    }
                }
            }
        }
    }

    const coveragePercent = causeCount > 0 ? Math.round((filledCauses / causeCount) * 100) : 0;

    // Save to Supabase
    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
    const checksum = sha256(JSON.stringify(data));

    await execSql(
        `UPDATE amfe_documents
         SET data = '${jsonStr}', checksum = '${checksum}',
             operation_count = ${operationCount}, cause_count = ${causeCount},
             ap_h_count = ${apHCount}, ap_m_count = ${apMCount},
             coverage_percent = ${coveragePercent}, updated_at = NOW()
         WHERE id = '${doc.id.replace(/'/g, "''")}'`
    );

    console.log(`    AMFE SAVED. (causes=${causeCount}, apH=${apHCount}, apM=${apMCount})`);

    return { failureId, causeId };
}

// ─── CP: Add flamabilidad item ───────────────────────────────────────────────

async function updateCp(product, amfeIds) {
    console.log(`\n  ── CP (${product.cpNumber}) ──`);

    if (!amfeIds || !amfeIds.causeId) {
        console.log(`    SKIP: No AMFE cause ID available for linking.`);
        return null;
    }

    const rows = await selectSql(
        `SELECT id, data FROM cp_documents WHERE control_plan_number = '${product.cpNumber.replace(/'/g, "''")}'`
    );

    if (rows.length === 0) {
        console.log(`    ERROR: CP ${product.cpNumber} not found!`);
        return null;
    }

    const doc = rows[0];
    const data = parseData(doc);

    if (!data.items) data.items = [];

    // Check if flamabilidad item already exists — either with TL 1010 or with wrong spec to fix
    const existingItem = data.items.find(
        item => /flamabilidad/i.test(item.productCharacteristic || '')
    );
    if (existingItem && /TL\s*1010/i.test(existingItem.specification || '')) {
        console.log(`    SKIP: Flamabilidad TL 1010 CP item already exists (id=${existingItem.id})`);
        return { cpItemId: existingItem.id };
    }
    if (existingItem) {
        // Fix existing item (e.g. Top Roll has "<100 mm/min" which is wrong for VWA)
        console.log(`    Fixing existing flamabilidad item: spec was "${existingItem.specification}"`);
        existingItem.processCharacteristic = "Cumplimiento TL 1010 VW";
        existingItem.specialCharClass = "CC";
        existingItem.specification = "Segun TL 1010 VW (velocidad de quemado)";
        existingItem.evaluationTechnique = "Certificado de laboratorio";
        existingItem.controlMethod = "Verificacion documental de certificado de flamabilidad";
        existingItem.reactionPlanOwner = "Inspector de Calidad";
        existingItem.amfeCauseIds = [amfeIds.causeId];
        existingItem.amfeFailureId = amfeIds.failureId;
        existingItem.amfeFailureIds = [amfeIds.failureId];
        existingItem.amfeAp = "M";
        existingItem.amfeSeverity = 10;

        const jsonStr = JSON.stringify(data).replace(/'/g, "''");
        const checksum = sha256(JSON.stringify(data));
        await execSql(
            `UPDATE cp_documents
             SET data = '${jsonStr}', checksum = '${checksum}',
                 item_count = ${data.items.length}, updated_at = NOW()
             WHERE id = '${doc.id.replace(/'/g, "''")}'`
        );
        console.log(`    CP SAVED (fixed existing item). (total items=${data.items.length})`);
        return { cpItemId: existingItem.id };
    }

    const cpItemId = randomUUID();

    const newCpItem = {
        id: cpItemId,
        processStepNumber: product.recepcionOp,
        processDescription: product.cpProcessDescription,
        machineDeviceTool: "N/A",
        characteristicNumber: "",
        productCharacteristic: "Flamabilidad del material",
        processCharacteristic: "Cumplimiento TL 1010 VW",
        specialCharClass: "CC",
        specification: "Segun TL 1010 VW (velocidad de quemado)",
        evaluationTechnique: "Certificado de laboratorio",
        sampleSize: "1 certificado",
        sampleFrequency: "Por entrega",
        controlMethod: "Verificacion documental de certificado de flamabilidad",
        reactionPlan: "Segregar lote, notificar s/ P-09/I",
        reactionPlanOwner: "Inspector de Calidad",
        controlProcedure: "P-09/I",
        amfeCauseIds: [amfeIds.causeId],
        amfeFailureId: amfeIds.failureId,
        amfeFailureIds: [amfeIds.failureId],
        amfeAp: "M",
        amfeSeverity: 10,
        operationCategory: "recepcion"
    };

    // Insert at the beginning of the matching processStepNumber items
    const firstStepIdx = data.items.findIndex(
        item => item.processStepNumber === product.recepcionOp
    );

    if (firstStepIdx >= 0) {
        data.items.splice(firstStepIdx, 0, newCpItem);
    } else {
        // No items for this step yet — insert at beginning
        data.items.unshift(newCpItem);
    }

    console.log(`    Added CP item: step=${product.recepcionOp}, characteristic="Flamabilidad del material", CC`);
    console.log(`    CP Item ID: ${cpItemId}`);
    console.log(`    Linked to AMFE failure=${amfeIds.failureId}, cause=${amfeIds.causeId}`);

    // Save to Supabase
    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
    const checksum = sha256(JSON.stringify(data));

    await execSql(
        `UPDATE cp_documents
         SET data = '${jsonStr}', checksum = '${checksum}',
             item_count = ${data.items.length}, updated_at = NOW()
         WHERE id = '${doc.id.replace(/'/g, "''")}'`
    );

    console.log(`    CP SAVED. (total items=${data.items.length})`);

    return { cpItemId };
}

// ─── HO: Add flamabilidad quality check ──────────────────────────────────────

async function updateHo(product, cpIds) {
    console.log(`\n  ── HO (${product.hoPartDescMatch}) ──`);

    if (!cpIds || !cpIds.cpItemId) {
        console.log(`    SKIP: No CP item ID available for linking.`);
        return;
    }

    const rows = await selectSql(
        `SELECT id, data, part_description FROM ho_documents WHERE part_description ILIKE '%${product.hoPartDescMatch.replace(/'/g, "''")}%'`
    );

    if (rows.length === 0) {
        console.log(`    ERROR: HO for "${product.hoPartDescMatch}" not found!`);
        return;
    }

    const doc = rows[0];
    console.log(`    Found HO: ${doc.part_description}`);
    const data = parseData(doc);

    if (!data.sheets || data.sheets.length === 0) {
        console.log(`    ERROR: HO has no sheets!`);
        return;
    }

    // Find the Recepcion sheet by operationNumber
    const sheet = data.sheets.find(
        s => String(s.operationNumber || '').trim() === product.recepcionOp
    );

    if (!sheet) {
        console.log(`    ERROR: Sheet with operationNumber=${product.recepcionOp} not found!`);
        console.log(`    Available sheets: ${data.sheets.map(s => s.operationNumber + ' - ' + (s.operationName || '')).join(', ')}`);
        return;
    }

    console.log(`    Found sheet: Op ${sheet.operationNumber} - ${sheet.operationName || '(unnamed)'}`);

    // Check if flamabilidad QC already exists
    if (!sheet.qualityChecks) sheet.qualityChecks = [];

    const existingQc = sheet.qualityChecks.find(
        qc => /flamabilidad/i.test(qc.characteristic || '')
    );
    if (existingQc) {
        if (/TL\s*1010/i.test(existingQc.specification || '')) {
            console.log(`    SKIP: Flamabilidad TL 1010 QC already exists (id=${existingQc.id})`);
            return;
        }
        // Fix existing QC (e.g. Top Roll has "<100 mm/min")
        console.log(`    Fixing existing flamabilidad QC: spec was "${existingQc.specification}"`);
        existingQc.specification = "Segun TL 1010 VW";
        existingQc.evaluationTechnique = "Certificado de laboratorio";
        existingQc.controlMethod = "Verificacion documental de certificado de flamabilidad";
        existingQc.reactionContact = "Inspector de Calidad";
        existingQc.cpItemId = cpIds.cpItemId;

        const jsonStr = JSON.stringify(data).replace(/'/g, "''");
        const ck = sha256(JSON.stringify(data));
        await execSql(
            `UPDATE ho_documents
             SET data = '${jsonStr}', checksum = '${ck}',
                 sheet_count = ${data.sheets.length}, updated_at = NOW()
             WHERE id = '${doc.id.replace(/'/g, "''")}'`
        );
        console.log(`    HO SAVED (fixed existing QC).`);
        return;
    }

    const newQc = {
        id: randomUUID(),
        cpItemId: cpIds.cpItemId,
        characteristic: "Flamabilidad del material",
        specification: "Segun TL 1010 VW",
        evaluationTechnique: "Certificado de laboratorio",
        frequency: "Por entrega",
        controlMethod: "Verificacion documental de certificado de flamabilidad",
        reactionAction: "Segregar lote, notificar s/ P-09/I",
        reactionContact: "Inspector de Calidad",
        specialCharSymbol: "CC",
        registro: "",
    };

    sheet.qualityChecks.push(newQc);

    console.log(`    Added QC: "${newQc.characteristic}" (CC, linked to cpItemId=${cpIds.cpItemId})`);

    // Save to Supabase
    const sheetCount = data.sheets.length;
    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
    const checksum = sha256(JSON.stringify(data));

    await execSql(
        `UPDATE ho_documents
         SET data = '${jsonStr}', checksum = '${checksum}',
             sheet_count = ${sheetCount}, updated_at = NOW()
         WHERE id = '${doc.id.replace(/'/g, "''")}'`
    );

    console.log(`    HO SAVED.`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FIX: Add flamabilidad TL 1010 VW to 4 VWA products');
    console.log('  (AMFE + CP + HO for 3 headrests + Top Roll)');
    console.log('═══════════════════════════════════════════════════════════════');

    await initSupabase();

    const summary = [];

    for (const product of PRODUCTS) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`  PRODUCT: ${product.name}`);
        console.log(`${'─'.repeat(60)}`);

        // 1. Update AMFE
        const amfeIds = await updateAmfe(product);

        // 2. Update CP (needs AMFE IDs for cross-linking)
        const cpIds = await updateCp(product, amfeIds);

        // 3. Update HO (needs CP item ID for cross-linking)
        await updateHo(product, cpIds);

        summary.push({
            product: product.name,
            amfe: amfeIds ? 'OK' : 'FAILED',
            cp: cpIds ? 'OK' : 'FAILED',
            ho: cpIds ? 'OK' : 'FAILED',
        });
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(60)}`);
    console.log('  SUMMARY');
    console.log(`${'═'.repeat(60)}`);

    for (const s of summary) {
        console.log(`  ${s.product.padEnd(25)} AMFE: ${s.amfe}  CP: ${s.cp}  HO: ${s.ho}`);
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('  DONE');
    console.log(`${'═'.repeat(60)}`);

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});

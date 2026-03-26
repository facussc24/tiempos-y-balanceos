#!/usr/bin/env node
/**
 * cleanup-operation-names.mjs
 *
 * Two-pass cleanup of operation names across all APQP document tables:
 *
 * PROBLEM 1 — Combined names: strips suffixes like " - ALMACENAMIENTO WIP"
 *   from operation names in all 4 tables (AMFE, PFD, CP, HO).
 *
 * PROBLEM 2 — PFD vs AMFE discrepancies: PFD is the source of truth.
 *   Corrects operation names in AMFE, CP, and HO to match the PFD.
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

/**
 * Detect if a name has a combined suffix pattern.
 * Returns the cleaned name (before " - ") or null if no suffix found.
 *
 * Known combined patterns:
 *   "COSTURA - ALMACENAMIENTO WIP"
 *   "PROCESO - ALMACENAMIENTO WIP"
 *   "COSTURA EN MAQUINA CNC - ALMACENAMIENTO EN MEDIOS WIP"
 *   etc.
 *
 * Strategy: split on " - " and check if the right-hand side is a known
 * operation suffix. We also catch any " - " split where both sides look
 * like standalone operation names (all-caps words).
 */
const KNOWN_SUFFIXES = [
    'ALMACENAMIENTO WIP',
    'ALMACENAMIENTO EN MEDIOS WIP',
    'ALMACENAMIENTO EN MEDIOS WIP (INTERNO)',
    'ALMACENAMIENTO',
    'RECEPCION',
    'RECEPCION DE MATERIA PRIMA',
    'RECEPCION MP',
    'TRASLADO',
    'TRASLADO A COSTURA',
    'TRASLADO A ENSAMBLE',
    'DESPACHO',
    'DESPACHO PT',
    'INSPECCION FINAL',
    'INSPECCION',
    'REPROCESO',
    'EMBALAJE',
    'EMBALAJE Y DESPACHO',
    'EXPEDICION',
];

function cleanCombinedName(name) {
    if (!name || typeof name !== 'string') return null;

    const idx = name.indexOf(' - ');
    if (idx < 0) return null;

    const left = name.substring(0, idx).trim();
    const right = name.substring(idx + 3).trim();
    const rightUpper = right.toUpperCase();

    // Case-insensitive exact match against known suffixes
    if (KNOWN_SUFFIXES.includes(rightUpper)) {
        return left;
    }

    return null;
}

// ---------------------------------------------------------------------------
// Problem 1 — Clean combined names
// ---------------------------------------------------------------------------

async function cleanCombinedNames() {
    console.log('\n' + '='.repeat(60));
    console.log('PROBLEMA 1 — Limpiar nombres combinados');
    console.log('='.repeat(60));

    const examples = [];
    let totalCleaned = 0;

    // --- AMFE: operations[].name ---
    {
        console.log('\n--- AMFE Documents (operations[].name) ---');
        const docs = await selectSql('SELECT id, data FROM amfe_documents');
        let cleaned = 0;
        for (const row of docs) {
            try {
                const data = JSON.parse(row.data);
                let changed = false;
                for (const op of (data.operations || [])) {
                    const cleanName = cleanCombinedName(op.name);
                    if (cleanName) {
                        if (examples.length < 5) {
                            examples.push({ table: 'AMFE', docId: row.id, before: op.name, after: cleanName });
                        }
                        op.name = cleanName;
                        changed = true;
                        cleaned++;
                    }
                }
                if (changed) {
                    const jsonStr = JSON.stringify(data);
                    const checksum = sha256(jsonStr);
                    await execSql(
                        `UPDATE amfe_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                        [jsonStr, checksum, row.id]
                    );
                }
            } catch (err) {
                console.error(`  [AMFE] ERROR id=${row.id}: ${err.message}`);
            }
        }
        console.log(`  Limpiados: ${cleaned} nombres en ${docs.length} docs`);
        totalCleaned += cleaned;
    }

    // --- PFD: steps[].description ---
    {
        console.log('\n--- PFD Documents (steps[].description) ---');
        const docs = await selectSql('SELECT id, data FROM pfd_documents');
        let cleaned = 0;
        for (const row of docs) {
            try {
                const data = JSON.parse(row.data);
                let changed = false;
                for (const step of (data.steps || [])) {
                    const cleanName = cleanCombinedName(step.description);
                    if (cleanName) {
                        if (examples.length < 5) {
                            examples.push({ table: 'PFD', docId: row.id, before: step.description, after: cleanName });
                        }
                        step.description = cleanName;
                        changed = true;
                        cleaned++;
                    }
                }
                if (changed) {
                    const jsonStr = JSON.stringify(data);
                    const checksum = sha256(jsonStr);
                    await execSql(
                        `UPDATE pfd_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                        [jsonStr, checksum, row.id]
                    );
                }
            } catch (err) {
                console.error(`  [PFD] ERROR id=${row.id}: ${err.message}`);
            }
        }
        console.log(`  Limpiados: ${cleaned} nombres en ${docs.length} docs`);
        totalCleaned += cleaned;
    }

    // --- CP: items[].processDescription ---
    {
        console.log('\n--- CP Documents (items[].processDescription) ---');
        const docs = await selectSql('SELECT id, data FROM cp_documents');
        let cleaned = 0;
        for (const row of docs) {
            try {
                const data = JSON.parse(row.data);
                let changed = false;
                for (const item of (data.items || [])) {
                    const cleanName = cleanCombinedName(item.processDescription);
                    if (cleanName) {
                        if (examples.length < 5) {
                            examples.push({ table: 'CP', docId: row.id, before: item.processDescription, after: cleanName });
                        }
                        item.processDescription = cleanName;
                        changed = true;
                        cleaned++;
                    }
                }
                if (changed) {
                    const jsonStr = JSON.stringify(data);
                    const checksum = sha256(jsonStr);
                    await execSql(
                        `UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                        [jsonStr, checksum, row.id]
                    );
                }
            } catch (err) {
                console.error(`  [CP] ERROR id=${row.id}: ${err.message}`);
            }
        }
        console.log(`  Limpiados: ${cleaned} nombres en ${docs.length} docs`);
        totalCleaned += cleaned;
    }

    // --- HO: sheets[].operationName ---
    {
        console.log('\n--- HO Documents (sheets[].operationName) ---');
        const docs = await selectSql('SELECT id, data FROM ho_documents');
        let cleaned = 0;
        for (const row of docs) {
            try {
                const data = JSON.parse(row.data);
                let changed = false;
                for (const sheet of (data.sheets || [])) {
                    const cleanName = cleanCombinedName(sheet.operationName);
                    if (cleanName) {
                        if (examples.length < 5) {
                            examples.push({ table: 'HO', docId: row.id, before: sheet.operationName, after: cleanName });
                        }
                        sheet.operationName = cleanName;
                        changed = true;
                        cleaned++;
                    }
                }
                if (changed) {
                    const jsonStr = JSON.stringify(data);
                    const checksum = sha256(jsonStr);
                    await execSql(
                        `UPDATE ho_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                        [jsonStr, checksum, row.id]
                    );
                }
            } catch (err) {
                console.error(`  [HO] ERROR id=${row.id}: ${err.message}`);
            }
        }
        console.log(`  Limpiados: ${cleaned} nombres en ${docs.length} docs`);
        totalCleaned += cleaned;
    }

    console.log(`\n  TOTAL PROBLEMA 1: ${totalCleaned} nombres combinados limpiados`);

    if (examples.length > 0) {
        console.log('\n  Ejemplos antes/despues:');
        for (const ex of examples) {
            console.log(`    [${ex.table}] "${ex.before}" -> "${ex.after}"`);
        }
    }

    return totalCleaned;
}

// ---------------------------------------------------------------------------
// Problem 2 — Align names across documents (PFD is source of truth)
// ---------------------------------------------------------------------------

async function alignNamesPfdToAmfeCpHo() {
    console.log('\n' + '='.repeat(60));
    console.log('PROBLEMA 2 — Alinear nombres PFD -> AMFE/CP/HO');
    console.log('='.repeat(60));

    const examples = [];
    let totalFixed = 0;

    // Load all PFDs
    const pfdDocs = await selectSql('SELECT id, data FROM pfd_documents');
    console.log(`\nCargados ${pfdDocs.length} PFDs`);

    // Load all AMFEs
    const amfeDocs = await selectSql('SELECT id, data FROM amfe_documents');
    console.log(`Cargados ${amfeDocs.length} AMFEs`);

    // Load all CPs
    const cpDocs = await selectSql('SELECT id, data, linked_amfe_id FROM cp_documents');
    console.log(`Cargados ${cpDocs.length} CPs`);

    // Load all HOs
    const hoDocs = await selectSql('SELECT id, data, linked_amfe_id FROM ho_documents');
    console.log(`Cargados ${hoDocs.length} HOs`);

    // Build lookup: PFD step.id -> step.description
    // Build lookup: PFD header.linkedAmfeProject -> PFD data
    // Build lookup: AMFE operation.id -> { amfeDocId, opNumber, name }

    // For each PFD, find its linked AMFE and align names
    for (const pfdRow of pfdDocs) {
        try {
            const pfdData = JSON.parse(pfdRow.data);
            const linkedAmfeProject = pfdData.header?.linkedAmfeProject || pfdData.header?.linkedAmfeId || '';

            if (!linkedAmfeProject) {
                continue; // No linked AMFE
            }

            // Build PFD step map: stepNumber -> description
            const pfdStepMap = new Map(); // stepNumber -> description
            const pfdStepByIdMap = new Map(); // step.id -> { stepNumber, description }

            for (const step of (pfdData.steps || [])) {
                if (step.stepNumber && step.description) {
                    pfdStepMap.set(step.stepNumber, step.description);
                    pfdStepByIdMap.set(step.id, { stepNumber: step.stepNumber, description: step.description });
                }
            }

            // Find the linked AMFE by scanning headers (same approach as pfdRepository)
            let matchedAmfe = null;
            for (const amfeRow of amfeDocs) {
                const amfeData = JSON.parse(amfeRow.data);
                const amfeProject = amfeData.header?.projectName || amfeData.header?.subject || '';
                if (amfeProject === linkedAmfeProject) {
                    matchedAmfe = { id: amfeRow.id, data: amfeData, raw: amfeRow };
                    break;
                }
            }

            if (!matchedAmfe) {
                // Try matching by part number
                const pfdPartNumber = pfdData.header?.partNumber || '';
                if (pfdPartNumber) {
                    for (const amfeRow of amfeDocs) {
                        const amfeData = JSON.parse(amfeRow.data);
                        const amfePartNumber = amfeData.header?.partNumber || '';
                        if (amfePartNumber === pfdPartNumber) {
                            matchedAmfe = { id: amfeRow.id, data: amfeData, raw: amfeRow };
                            break;
                        }
                    }
                }
            }

            if (!matchedAmfe) {
                continue;
            }

            // --- Fix AMFE operation names to match PFD ---
            let amfeChanged = false;
            for (const op of (matchedAmfe.data.operations || [])) {
                // Match by linkedPfdStepId first
                if (op.linkedPfdStepId && pfdStepByIdMap.has(op.linkedPfdStepId)) {
                    const pfdStep = pfdStepByIdMap.get(op.linkedPfdStepId);
                    if (op.name !== pfdStep.description) {
                        if (examples.length < 5) {
                            examples.push({
                                table: 'AMFE', docId: matchedAmfe.id,
                                opNumber: op.opNumber,
                                before: op.name, after: pfdStep.description,
                            });
                        }
                        op.name = pfdStep.description;
                        amfeChanged = true;
                        totalFixed++;
                    }
                }
                // Fallback: match by opNumber == stepNumber
                else if (op.opNumber && pfdStepMap.has(op.opNumber)) {
                    const pfdDescription = pfdStepMap.get(op.opNumber);
                    if (op.name !== pfdDescription) {
                        if (examples.length < 5) {
                            examples.push({
                                table: 'AMFE', docId: matchedAmfe.id,
                                opNumber: op.opNumber,
                                before: op.name, after: pfdDescription,
                            });
                        }
                        op.name = pfdDescription;
                        amfeChanged = true;
                        totalFixed++;
                    }
                }
            }

            if (amfeChanged) {
                const jsonStr = JSON.stringify(matchedAmfe.data);
                const checksum = sha256(jsonStr);
                await execSql(
                    `UPDATE amfe_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                    [jsonStr, checksum, matchedAmfe.id]
                );
            }

            // Build AMFE opNumber -> name map (now aligned with PFD)
            const amfeOpMap = new Map();
            for (const op of (matchedAmfe.data.operations || [])) {
                amfeOpMap.set(op.opNumber, op.name);
            }

            // --- Fix CP items to match PFD/AMFE ---
            for (const cpRow of cpDocs) {
                if (cpRow.linked_amfe_id !== matchedAmfe.id) continue;

                try {
                    const cpData = JSON.parse(cpRow.data);
                    let cpChanged = false;

                    for (const item of (cpData.items || [])) {
                        const stepNum = item.processStepNumber;
                        // Prefer PFD name, fallback to AMFE name
                        const correctName = pfdStepMap.get(stepNum) || amfeOpMap.get(stepNum);
                        if (correctName && item.processDescription !== correctName) {
                            if (examples.length < 5) {
                                examples.push({
                                    table: 'CP', docId: cpRow.id,
                                    opNumber: stepNum,
                                    before: item.processDescription, after: correctName,
                                });
                            }
                            item.processDescription = correctName;
                            cpChanged = true;
                            totalFixed++;
                        }
                    }

                    if (cpChanged) {
                        const jsonStr = JSON.stringify(cpData);
                        const checksum = sha256(jsonStr);
                        await execSql(
                            `UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                            [jsonStr, checksum, cpRow.id]
                        );
                    }
                } catch (err) {
                    console.error(`  [CP] ERROR id=${cpRow.id}: ${err.message}`);
                }
            }

            // --- Fix HO sheets to match PFD/AMFE ---
            for (const hoRow of hoDocs) {
                if (hoRow.linked_amfe_id !== matchedAmfe.id) continue;

                try {
                    const hoData = JSON.parse(hoRow.data);
                    let hoChanged = false;

                    for (const sheet of (hoData.sheets || [])) {
                        const opNum = sheet.operationNumber;
                        const correctName = pfdStepMap.get(opNum) || amfeOpMap.get(opNum);
                        if (correctName && sheet.operationName !== correctName) {
                            if (examples.length < 5) {
                                examples.push({
                                    table: 'HO', docId: hoRow.id,
                                    opNumber: opNum,
                                    before: sheet.operationName, after: correctName,
                                });
                            }
                            sheet.operationName = correctName;
                            hoChanged = true;
                            totalFixed++;
                        }
                    }

                    if (hoChanged) {
                        const jsonStr = JSON.stringify(hoData);
                        const checksum = sha256(jsonStr);
                        await execSql(
                            `UPDATE ho_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                            [jsonStr, checksum, hoRow.id]
                        );
                    }
                } catch (err) {
                    console.error(`  [HO] ERROR id=${hoRow.id}: ${err.message}`);
                }
            }
        } catch (err) {
            console.error(`  [PFD] ERROR id=${pfdRow.id}: ${err.message}`);
        }
    }

    console.log(`\n  TOTAL PROBLEMA 2: ${totalFixed} nombres alineados con PFD`);

    if (examples.length > 0) {
        console.log('\n  Ejemplos antes/despues:');
        for (const ex of examples) {
            console.log(`    [${ex.table}] op ${ex.opNumber}: "${ex.before}" -> "${ex.after}"`);
        }
    }

    return totalFixed;
}

// ---------------------------------------------------------------------------
// Diagnostic — find remaining " - " patterns that were NOT cleaned
// ---------------------------------------------------------------------------

async function diagnosticRemainingDashes() {
    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSTICO — Nombres con " - " restantes (no limpiados)');
    console.log('='.repeat(60));

    const remaining = [];

    const amfeDocs = await selectSql('SELECT id, data FROM amfe_documents');
    for (const row of amfeDocs) {
        const data = JSON.parse(row.data);
        for (const op of (data.operations || [])) {
            if (op.name && op.name.includes(' - ')) {
                remaining.push({ table: 'AMFE', id: row.id, name: op.name });
            }
        }
    }

    const pfdDocs = await selectSql('SELECT id, data FROM pfd_documents');
    for (const row of pfdDocs) {
        const data = JSON.parse(row.data);
        for (const step of (data.steps || [])) {
            if (step.description && step.description.includes(' - ')) {
                remaining.push({ table: 'PFD', id: row.id, name: step.description });
            }
        }
    }

    const cpDocs = await selectSql('SELECT id, data FROM cp_documents');
    for (const row of cpDocs) {
        const data = JSON.parse(row.data);
        for (const item of (data.items || [])) {
            if (item.processDescription && item.processDescription.includes(' - ')) {
                remaining.push({ table: 'CP', id: row.id, name: item.processDescription });
            }
        }
    }

    const hoDocs = await selectSql('SELECT id, data FROM ho_documents');
    for (const row of hoDocs) {
        const data = JSON.parse(row.data);
        for (const sheet of (data.sheets || [])) {
            if (sheet.operationName && sheet.operationName.includes(' - ')) {
                remaining.push({ table: 'HO', id: row.id, name: sheet.operationName });
            }
        }
    }

    if (remaining.length === 0) {
        console.log('  Ninguno — todos limpios!');
    } else {
        console.log(`  ${remaining.length} nombres con " - " todavia presentes:`);
        for (const r of remaining) {
            console.log(`    [${r.table}] "${r.name}"`);
        }
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();

    const p1 = await cleanCombinedNames();
    const p2 = await alignNamesPfdToAmfeCpHo();

    await diagnosticRemainingDashes();

    console.log('\n' + '='.repeat(60));
    console.log('RESUMEN FINAL');
    console.log('='.repeat(60));
    console.log(`  Problema 1 (nombres combinados): ${p1} limpiados`);
    console.log(`  Problema 2 (discrepancias PFD): ${p2} alineados`);
    console.log(`  Total cambios: ${p1 + p2}`);

    close();
    console.log('\nDone.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

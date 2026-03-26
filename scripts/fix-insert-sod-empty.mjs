#!/usr/bin/env node
/**
 * Fix causes in the Insert AMFE that have empty S/O/D values.
 *
 * The Insert AMFE (VWA/PATAGONIA/INSERT) has causes with Severity, Occurrence,
 * or Detection = "" (invalid -- minimum is 1 in AIAG-VDA scale). These are
 * primarily in OP 10 (RECEPCIONAR MATERIA PRIMA) under a failure mode with
 * empty description and severity, containing 6 material verification causes.
 * There may be 1 additional cause elsewhere.
 *
 * This script:
 * 1. Loads all Insert AMFE documents
 * 2. Walks the full tree to find causes with empty S/O/D
 * 3. Fills in appropriate values and controls
 * 4. Recalculates AP and document stats
 * 5. Saves back to Supabase
 *
 * Usage: node scripts/fix-insert-sod-empty.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ---------------------------------------------------------------------------
// AP Calculation (reimplemented from modules/amfe/apTable.ts)
// ---------------------------------------------------------------------------

function apRule(s, o, d) {
    if (s <= 1) return 'L';
    if (s <= 3) {
        if (o >= 8 && d >= 5) return 'M';
        return 'L';
    }
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
    // s = 9-10
    if (o >= 6) return 'H';
    if (o >= 4) return d >= 2 ? 'H' : 'M';
    if (o >= 2) {
        if (d >= 7) return 'H';
        if (d >= 5) return 'M';
        return 'L';
    }
    return 'L';
}

// ---------------------------------------------------------------------------
// Prevention control assignment based on cause description
// ---------------------------------------------------------------------------

function assignPreventionControl(causeDesc) {
    const desc = (causeDesc || '').toLowerCase();
    if (desc.includes('color') || desc.includes('estado')) {
        return 'Verificacion visual de color/estado contra muestra patron en cada recepcion';
    }
    if (desc.includes('vencimiento') || desc.includes('fecha')) {
        return 'Verificacion de fecha de vencimiento en etiqueta del producto en cada recepcion';
    }
    if (desc.includes('identificacion') || desc.includes('lote')) {
        return 'Verificacion de rotulo e identificacion de lote contra orden de compra';
    }
    return 'Checklist de recepcion con verificacion obligatoria por insumo';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isEmpty(val) {
    return val === '' || val === undefined || val === null || val === 0;
}

/** Compute metadata stats for an AMFE data blob */
function computeStats(data) {
    let causeCount = 0;
    let apH = 0;
    let apM = 0;
    let causesWithControl = 0;

    for (const op of (data.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        causeCount++;
                        if (cause.ap === 'H') apH++;
                        if (cause.ap === 'M') apM++;
                        if ((cause.preventionControl && cause.preventionControl.trim()) ||
                            (cause.detectionControl && cause.detectionControl.trim())) {
                            causesWithControl++;
                        }
                    }
                }
            }
        }
    }

    const coveragePct = causeCount > 0 ? Math.round((causesWithControl / causeCount) * 100) : 0;
    return { causeCount, apH, apM, coveragePct };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();
    console.log('\n=== Fix Insert AMFE Empty S/O/D ===\n');

    // Load Insert AMFE documents
    const rows = await selectSql(
        `SELECT id, project_name, data FROM amfe_documents WHERE project_name LIKE '%INSERT%'`
    );

    console.log(`Found ${rows.length} Insert AMFE document(s)\n`);

    let totalFixed = 0;

    for (const row of rows) {
        const docId = row.id;
        const projectName = row.project_name;
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        let docModified = false;
        let fixesInDoc = 0;

        console.log(`--- Document: ${projectName} (id: ${docId}) ---`);

        for (const op of (data.operations || [])) {
            for (const we of (op.workElements || [])) {
                for (const fn of (we.functions || [])) {
                    for (const fail of (fn.failures || [])) {
                        // Check if failure severity is empty
                        const failSevWasEmpty = isEmpty(fail.severity);
                        if (failSevWasEmpty) {
                            const oldSev = fail.severity;
                            fail.severity = 7;
                            if (isEmpty(fail.description)) {
                                fail.description = 'Omision de verificacion de insumos en recepcion';
                            }
                            if (isEmpty(fail.effectLocal)) {
                                fail.effectLocal = 'Material no verificado ingresa al proceso de produccion';
                            }
                            if (isEmpty(fail.effectNextLevel)) {
                                fail.effectNextLevel = 'Material incorrecto utilizado en ensamble del cliente';
                            }
                            if (isEmpty(fail.effectEndUser)) {
                                fail.effectEndUser = 'Defecto funcional o de apariencia en producto terminado';
                            }
                            console.log(`  [FAILURE FIX] Op ${op.number || op.name} | Failure: "${fail.description}"`);
                            console.log(`    severity: "${oldSev}" -> 7`);
                            docModified = true;
                        }

                        const parentSeverity = Number(fail.severity) || 0;

                        for (const cause of (fail.causes || [])) {
                            const occEmpty = isEmpty(cause.occurrence);
                            const detEmpty = isEmpty(cause.detection);

                            if (occEmpty || detEmpty) {
                                const oldOcc = cause.occurrence;
                                const oldDet = cause.detection;
                                const oldAp = cause.ap;

                                if (occEmpty) cause.occurrence = 4;
                                if (detEmpty) cause.detection = 6;

                                if (!cause.preventionControl || !cause.preventionControl.trim()) {
                                    cause.preventionControl = assignPreventionControl(cause.description);
                                }
                                if (!cause.detectionControl || !cause.detectionControl.trim()) {
                                    cause.detectionControl = 'Auditoria de recepcion semanal contra lista de insumos criticos';
                                }

                                // Recalculate AP
                                const newAp = apRule(parentSeverity, Number(cause.occurrence), Number(cause.detection));
                                cause.ap = newAp;

                                fixesInDoc++;
                                totalFixed++;
                                docModified = true;

                                console.log(`  [CAUSE FIX #${totalFixed}] Op ${op.number || op.name} | "${(cause.description || '').slice(0, 70)}..."`);
                                console.log(`    S: ${failSevWasEmpty ? `"" -> ${parentSeverity}` : parentSeverity} | O: "${oldOcc}" -> ${cause.occurrence} | D: "${oldDet}" -> ${cause.detection} | AP: "${oldAp}" -> ${newAp}`);
                                console.log(`    prevention: "${cause.preventionControl.slice(0, 60)}..."`);
                                console.log(`    detection:  "${cause.detectionControl.slice(0, 60)}..."`);
                            }
                        }
                    }
                }
            }
        }

        if (docModified) {
            // Recompute stats
            const stats = computeStats(data);

            // Serialize and checksum
            const jsonStr = JSON.stringify(data);
            const checksum = sha256(jsonStr);

            console.log(`\n  Stats: causes=${stats.causeCount}, AP_H=${stats.apH}, AP_M=${stats.apM}, coverage=${stats.coveragePct}%`);
            console.log(`  Saving document... (${fixesInDoc} cause(s) fixed)`);

            await execSql(
                `UPDATE amfe_documents SET data = ?, checksum = ?, coverage_percent = ?, ap_h_count = ?, ap_m_count = ?, cause_count = ?, updated_at = datetime('now') WHERE id = ?`,
                [jsonStr, checksum, stats.coveragePct, stats.apH, stats.apM, stats.causeCount, docId]
            );

            console.log(`  Saved OK.\n`);
        } else {
            console.log(`  No empty S/O/D found in this document.\n`);
        }
    }

    console.log(`\n=== DONE: ${totalFixed} cause(s) fixed across ${rows.length} document(s) ===\n`);
    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

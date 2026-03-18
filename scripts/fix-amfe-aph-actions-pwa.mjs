#!/usr/bin/env node
/**
 * FIX: AP=H Causes Without Actions — PWA Products
 *
 * Reads AMFE-PWA-112 (TELAS_PLANAS) and AMFE-PWA-113 (TELAS_TERMOFORMADAS)
 * from Supabase, finds all causes with AP=H and no corrective actions,
 * and fills in realistic manufacturing-specific actions.
 *
 * Per IATF 16949 / AIAG-VDA FMEA, every AP=H cause MUST have at least one
 * prevention or detection action with a responsible person and target date.
 *
 * Usage: node scripts/fix-amfe-aph-actions-pwa.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const TARGET_DATE = '2026-06-17';
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ═══════════════════════════════════════════════════════════════════════════
// ACTION GENERATOR — maps cause/operation context → realistic actions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate prevention and detection actions based on cause text and operation context.
 * Returns { preventionAction, detectionAction, responsible }
 */
function generateActions(cause, failureDesc, opName) {
    const causeText = (cause.cause || '').toLowerCase();
    const failText = (failureDesc || '').toLowerCase();
    const opText = (opName || '').toLowerCase();

    // ─── RECEPTION / INCOMING MATERIAL ─────────────────────────────
    if (opText.includes('recepcion') || opText.includes('recepción')) {
        if (causeText.includes('material fuera de especificacion') || causeText.includes('material fuera de especifica')) {
            return {
                preventionAction: 'Implementar protocolo de inspección en recepción con verificación de certificado de calidad del proveedor y ensayo de flamabilidad según norma FMVSS 302 en cada lote recibido.',
                detectionAction: 'Ensayo de flamabilidad en laboratorio sobre muestra representativa de cada lote. Registro en planilla de recepción con criterios pasa/no-pasa.',
                responsible: 'Calidad',
            };
        }
        if (causeText.includes('falta de control') || causeText.includes('recepcion/ca')) {
            return {
                preventionAction: 'Establecer checklist de recepción obligatorio que incluya verificación de documentación (remito, certificado de calidad, identificación de lote) y estado físico del material.',
                detectionAction: 'Auditoría semanal de registros de recepción para verificar cumplimiento del checklist. Alerta automática si falta documentación.',
                responsible: 'Calidad',
            };
        }
    }

    // ─── HORNO / CALENTAMIENTO ─────────────────────────────────────
    if (opText.includes('horno') || opText.includes('calentar')) {
        if (causeText.includes('posicionamiento') || causeText.includes('mal posicion')) {
            return {
                preventionAction: 'Definir marcas de posicionamiento en bandeja del horno y capacitar al operador en el correcto centrado de la pieza. Ayuda visual en puesto de trabajo.',
                detectionAction: 'Verificación visual del posicionamiento antes de cerrar el horno. Control de temperatura con pirometro digital al retirar la pieza.',
                responsible: 'Ingeniería de Proceso',
            };
        }
    }

    // ─── PERFORADO / PUNZONADO ─────────────────────────────────────
    if (opText.includes('perforado') || opText.includes('punzon')) {
        if (causeText.includes('posicionamiento') || causeText.includes('mal posicion')) {
            return {
                preventionAction: 'Implementar sistema de guías mecánicas (poka-yoke) en la matriz de perforado que impidan el posicionamiento incorrecto de la pieza. Verificar alineación con patrón de referencia.',
                detectionAction: 'Control visual 100% del operador después de perforado contra patrón de referencia. Conteo de agujeros y verificación de posición con galga.',
                responsible: 'Ingeniería de Proceso',
            };
        }
        if (causeText.includes('punzon') && causeText.includes('dañ') || causeText.includes('punzones dañ') || causeText.includes('punzones danados')) {
            return {
                preventionAction: 'Establecer plan de mantenimiento preventivo de punzones con frecuencia de cambio definida (cada N golpes). Registro de vida útil de cada punzón.',
                detectionAction: 'Inspección visual de punzones al inicio de cada turno. Control de calidad del primer artículo (FAI) después de cada cambio de punzón.',
                responsible: 'Ingeniería de Proceso',
            };
        }
    }

    // ─── SOLDADURA ─────────────────────────────────────────────────
    if (opText.includes('soldadura')) {
        if (causeText.includes('seleccion') || causeText.includes('mala seleccion') || causeText.includes('piezas dist')) {
            return {
                preventionAction: 'Implementar sistema de identificación visual por colores en piezas componentes. Kanban de piezas en puesto de soldadura con identificación clara de cada variante.',
                detectionAction: 'Verificación de código de pieza antes de iniciar el proceso de soldadura. Control visual de la pieza ensamblada contra muestra patrón.',
                responsible: 'Ingeniería de Proceso',
            };
        }
        if (causeText.includes('especificado') || causeText.includes('no cumplir con lo especificado') || causeText.includes('puntos de sold')) {
            return {
                preventionAction: 'Actualizar Hoja de Operaciones con cantidad exacta de puntos de soldadura, secuencia y parámetros. Capacitación del operador con registro firmado.',
                detectionAction: 'Control de puntos de soldadura 100% en cada pieza (conteo visual). Ensayo de pelado destructivo 1 pieza por turno para verificar resistencia de unión.',
                responsible: 'Calidad',
            };
        }
    }

    // ─── CONTROL FINAL / INSPECCIÓN ────────────────────────────────
    if (opText.includes('control') && (opText.includes('final') || opText.includes('pieza final'))) {
        if (causeText.includes('error en operaciones anteriores') || causeText.includes('operaciones anteriores')) {
            return {
                preventionAction: 'Reforzar autocontroles en cada estación previa con checklist visual. Implementar sistema de semáforo (verde/rojo) para liberación de piezas entre estaciones.',
                detectionAction: 'Inspección final 100% contra patrón de referencia con planilla de defectos. Muestreo de auditoría cada 2 horas por Calidad.',
                responsible: 'Calidad',
            };
        }
    }

    // ─── TERMOFORMADO ──────────────────────────────────────────────
    if (opText.includes('termoform')) {
        return {
            preventionAction: 'Control de parámetros de termoformado (temperatura, tiempo, presión) con registros por turno. Verificación de calibración de instrumentos mensual.',
            detectionAction: 'Inspección dimensional de primera y última pieza del lote. Control visual 100% contra muestra patrón.',
            responsible: 'Ingeniería de Proceso',
        };
    }

    // ─── CORTE ─────────────────────────────────────────────────────
    if (opText.includes('corte')) {
        if (causeText.includes('cuchilla') || causeText.includes('blade')) {
            return {
                preventionAction: 'Plan de mantenimiento preventivo de cuchillas con frecuencia de cambio definida. Registro de vida útil y filo.',
                detectionAction: 'Verificación de calidad de corte en primeras piezas del turno (set-up). Medición de bordes con cinta métrica.',
                responsible: 'Ingeniería de Proceso',
            };
        }
        return {
            preventionAction: 'Verificar parámetros de corte (presión, velocidad) al inicio de cada turno según Hoja de Operaciones. Capacitación del operador en técnica de corte.',
            detectionAction: 'Control dimensional de primeras 3 piezas cortadas contra plano. Control visual 100% de calidad de corte.',
            responsible: 'Ingeniería de Proceso',
        };
    }

    // ─── FALLBACK: Generic action based on cause keywords ──────────
    if (causeText.includes('operador') || causeText.includes('operario') || causeText.includes('mano de obra')) {
        return {
            preventionAction: 'Capacitación específica del operador en la tarea según Hoja de Operaciones actualizada. Ayuda visual en puesto de trabajo con criterios de aceptación/rechazo.',
            detectionAction: 'Autocontrol visual del operador pieza a pieza. Auditoría de proceso por supervisor cada 2 horas.',
            responsible: 'Ingeniería de Proceso',
        };
    }

    if (causeText.includes('máquina') || causeText.includes('maquina') || causeText.includes('equipo') || causeText.includes('falla')) {
        return {
            preventionAction: 'Plan de mantenimiento preventivo del equipo con frecuencia definida. Verificación de parámetros de proceso al inicio de cada turno.',
            detectionAction: 'Monitoreo de parámetros de proceso durante producción. Primer artículo (FAI) después de cada set-up o cambio de herramienta.',
            responsible: 'Ingeniería de Proceso',
        };
    }

    // ─── ABSOLUTE FALLBACK ─────────────────────────────────────────
    return {
        preventionAction: 'Revisión y actualización de Hoja de Operaciones con instrucciones detalladas para la operación. Capacitación del personal involucrado con registro.',
        detectionAction: 'Implementar control visual 100% con criterios pasa/no-pasa documentados. Auditoría de proceso periódica por Calidad.',
        responsible: 'Calidad',
    };
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  FIX: AP=H Causes Without Actions — PWA Products');
    console.log('═══════════════════════════════════════════════════════════\n');

    await initSupabase();

    // ── Step 1: Query PWA AMFE documents ──────────────────────────────
    console.log('\n── Step 1: Querying PWA AMFE documents ──────────────────');

    const pwaAmfes = [
        { amfeNumber: 'AMFE-PWA-112', projectName: 'PWA/TELAS_PLANAS' },
        { amfeNumber: 'AMFE-PWA-113', projectName: 'PWA/TELAS_TERMOFORMADAS' },
    ];

    let totalFixed = 0;

    for (const target of pwaAmfes) {
        console.log(`\n── Processing: ${target.amfeNumber} (${target.projectName}) ──`);

        // Query the document
        const rows = await selectSql(
            `SELECT id, amfe_number, project_name, data, operation_count, cause_count, ap_h_count, coverage_percent
             FROM amfe_documents WHERE amfe_number = ?`,
            [target.amfeNumber]
        );

        if (rows.length === 0) {
            console.log(`  WARNING: Document ${target.amfeNumber} not found in database!`);
            continue;
        }

        const row = rows[0];
        console.log(`  Found: id=${row.id}, project=${row.project_name}`);
        console.log(`  Stats: ops=${row.operation_count}, causes=${row.cause_count}, AP-H=${row.ap_h_count}, coverage=${row.coverage_percent}%`);

        // Parse the JSON data
        let doc;
        try {
            doc = JSON.parse(row.data);
        } catch (e) {
            console.log(`  ERROR: Could not parse JSON data for ${target.amfeNumber}: ${e.message}`);
            continue;
        }

        // ── Step 2: Find AP=H causes without actions ──────────────────
        let fixedCount = 0;
        let skippedCount = 0;

        for (const op of doc.operations) {
            for (const we of op.workElements) {
                for (const fn of we.functions) {
                    for (const fail of fn.failures) {
                        for (const cause of fail.causes) {
                            if (cause.ap === 'H' || cause.ap === 'HIGH') {
                                const hasAction = (cause.preventionAction && cause.preventionAction.trim()) ||
                                                  (cause.detectionAction && cause.detectionAction.trim());

                                if (!hasAction) {
                                    // Generate actions
                                    const actions = generateActions(cause, fail.description, op.name);

                                    cause.preventionAction = actions.preventionAction;
                                    cause.detectionAction = actions.detectionAction;
                                    cause.responsible = actions.responsible;
                                    cause.targetDate = TARGET_DATE;
                                    cause.status = 'Pendiente';

                                    fixedCount++;
                                    console.log(`    FIXED: Op "${op.name}" | Cause: "${(cause.cause || '').substring(0, 60)}..." → ${actions.responsible}`);
                                } else {
                                    skippedCount++;
                                }
                            }
                        }
                    }
                }
            }
        }

        console.log(`\n  Summary for ${target.amfeNumber}:`);
        console.log(`    Fixed:   ${fixedCount} causes`);
        console.log(`    Skipped: ${skippedCount} causes (already had actions)`);

        if (fixedCount === 0) {
            console.log(`    No changes needed.`);
            continue;
        }

        // ── Step 3: Recompute stats ───────────────────────────────────
        let causeCount = 0;
        let apHCount = 0;
        let apMCount = 0;
        let filledCauses = 0;

        for (const op of doc.operations) {
            for (const we of op.workElements) {
                for (const fn of we.functions) {
                    for (const fail of fn.failures) {
                        for (const cause of fail.causes) {
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

        console.log(`    New stats: causes=${causeCount}, AP-H=${apHCount}, AP-M=${apMCount}, coverage=${coveragePercent}%`);

        // ── Step 4: Write back to Supabase ────────────────────────────
        const newData = JSON.stringify(doc);
        const checksum = sha256(newData);

        await execSql(
            `UPDATE amfe_documents
             SET data = ?, checksum = ?,
                 operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?,
                 coverage_percent = ?, updated_at = NOW()
             WHERE id = ?`,
            [newData, checksum,
             doc.operations.length, causeCount, apHCount, apMCount,
             coveragePercent, row.id]
        );

        console.log(`    SAVED to Supabase.`);
        totalFixed += fixedCount;
    }

    // ── Step 5: Verify ────────────────────────────────────────────────
    console.log('\n\n── Step 5: Verification ──────────────────────────────────');

    for (const target of pwaAmfes) {
        const rows = await selectSql(
            `SELECT amfe_number, project_name, ap_h_count, coverage_percent, data
             FROM amfe_documents WHERE amfe_number = ?`,
            [target.amfeNumber]
        );

        if (rows.length === 0) continue;

        const row = rows[0];
        const doc = JSON.parse(row.data);

        // Count AP=H causes still without actions
        let apHNoAction = 0;
        let apHWithAction = 0;

        for (const op of doc.operations) {
            for (const we of op.workElements) {
                for (const fn of we.functions) {
                    for (const fail of fn.failures) {
                        for (const cause of fail.causes) {
                            if (cause.ap === 'H' || cause.ap === 'HIGH') {
                                const hasAction = (cause.preventionAction && cause.preventionAction.trim()) ||
                                                  (cause.detectionAction && cause.detectionAction.trim());
                                if (hasAction) {
                                    apHWithAction++;
                                } else {
                                    apHNoAction++;
                                }
                            }
                        }
                    }
                }
            }
        }

        console.log(`  ${target.amfeNumber}: AP-H total=${row.ap_h_count}, with actions=${apHWithAction}, WITHOUT actions=${apHNoAction}`);

        if (apHNoAction > 0) {
            console.log(`    WARNING: Still has ${apHNoAction} AP=H causes without actions!`);
        } else {
            console.log(`    OK: All AP=H causes have actions.`);
        }
    }

    // ── Step 6: Report 0% S/O/D coverage documents ────────────────────
    console.log('\n\n── Step 6: Documents with 0% S/O/D Coverage ─────────────');
    console.log('  These documents have NO risk evaluation — separate fix needed:');

    const zeroCoverageDocs = await selectSql(
        `SELECT amfe_number, project_name, cause_count, coverage_percent
         FROM amfe_documents
         WHERE coverage_percent = 0 AND cause_count > 0
         ORDER BY amfe_number`
    );

    if (zeroCoverageDocs.length === 0) {
        console.log('  None found (all documents have some S/O/D coverage).');
    } else {
        for (const doc of zeroCoverageDocs) {
            console.log(`    - ${doc.amfe_number} | ${doc.project_name} | ${doc.cause_count} causes | ${doc.coverage_percent}% coverage`);
        }
        console.log(`\n  Total: ${zeroCoverageDocs.length} documents with 0% S/O/D coverage.`);
        console.log('  These need S/O/D values assigned BEFORE actions can be added (AP is unknown).');
    }

    // ── Done ──────────────────────────────────────────────────────────
    console.log(`\n\n═══════════════════════════════════════════════════════════`);
    console.log(`  TOTAL: ${totalFixed} AP=H causes fixed across PWA documents`);
    console.log(`═══════════════════════════════════════════════════════════`);

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

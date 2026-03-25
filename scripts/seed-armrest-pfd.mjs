#!/usr/bin/env node
/**
 * SEED: PFD (Process Flow Diagram) for Armrest Door Panel
 *
 * Source: FLUJOGRAMA_153_ARMREST_REV.pdf
 * Document code: I-IN-002/III
 * Revision: A (12/11/2025)
 * Elaborado por: P. GAMBOA
 * Revisado por: C. BAPTISTA
 *
 * This script creates/updates the PFD for the Armrest Door Panel family,
 * including all process steps, decision points, rework loops, scrap
 * dispositions, and parallel branches (inyeccion plastica + inyeccion PU).
 *
 * Replaces the PFD previously in seed-armrest.mjs (which was deleted as
 * "referencia fantasma" on 2026-03-18).
 *
 * Usage: node scripts/seed-armrest-pfd.mjs
 */

import { randomUUID, createHash } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ─── Config ─────────────────────────────────────────────────────────────────

const PROJECT_NAME = 'VWA/PATAGONIA/ARMREST';
const FAMILY_NAME = 'Armrest Door Panel Patagonia';
const DOC_NUMBER = 'I-IN-002/III-ARM';

// ─── Helpers ────────────────────────────────────────────────────────────────

const uuid = () => randomUUID();
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/**
 * Create a PFD step following the schema in pfdTypes.ts
 */
function mkStep(stepNumber, stepType, description, extras = {}) {
    return {
        id: uuid(),
        stepNumber,
        stepType,
        description,
        machineDeviceTool: extras.machine || '',
        productCharacteristic: extras.prodChar || '',
        productSpecialChar: extras.prodSC || 'none',
        processCharacteristic: extras.procChar || '',
        processSpecialChar: extras.procSC || 'none',
        reference: '',
        department: extras.dept || '',
        notes: extras.notes || '',
        isRework: extras.isRework || false,
        isExternalProcess: false,
        reworkReturnStep: extras.reworkReturnStep || '',
        rejectDisposition: extras.rejectDisp || 'none',
        scrapDescription: extras.scrapDesc || '',
        branchId: extras.branchId || '',
        branchLabel: extras.branchLabel || '',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// PFD STEPS — Extracted from FLUJOGRAMA_153_ARMREST_REV.pdf
//
// Document: FLUJOGRAMA DE PROCESO ARMREST PATAGONIA
// Code: I-IN-002/III
// Rev: A (12/11/2025)
//
// Flow structure:
//   Main: 10→Insp→Storage→15→20→25→Decision→30→Transport→40→50→51→52→Transport
//   Branch A (Inyeccion Plastica): 60→61→Transport
//   Branch B (Inyeccion PU): 70→71→72→Transport
//   Convergence: 80→81→Decision→[Reproceso 103→Decision]→82→90→100→Decision→110→Storage
//
// Special characteristics marked in PDF:
//   - OP 10: CC (inverted triangle) + SC
//   - OP 20: SC
//   - OP 25: CC (inverted triangle)
//   - OP 81: CC + SC (at decision point)
//   - OP 90: SC (at tapizado step — implied)
//   - OP 100: SC
// ═══════════════════════════════════════════════════════════════════════════

function buildPfdSteps() {
    return [
        // ── 1. Recepcion & Inspeccion de Materia Prima ──────────────────────
        mkStep('10', 'storage', 'RECEPCION DE MATERIA PRIMA', {
            dept: 'Recepcion',
            procChar: 'Conformidad de calidad y cantidad de material recibido',
            procSC: 'SC',
            prodChar: 'Identificacion correcta de materia prima',
            prodSC: 'CC',
        }),
        mkStep('', 'storage', 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA PENDIENTE DE CONTROL', {
            dept: 'Almacen',
        }),
        mkStep('', 'inspection', 'INSPECCION DE MATERIA PRIMA', {
            dept: 'Calidad',
            procChar: 'Verificacion de especificaciones de materia prima',
            procSC: 'SC',
        }),

        // ── 2. Decision: Material Conforme? ─────────────────────────────────
        mkStep('', 'decision', 'MATERIAL CONFORME?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'RECLAMO DE CALIDAD AL PROVEEDOR',
            notes: 'SI: continua flujo. NO: reclamo al proveedor',
        }),

        // ── 3. Material aprobado ────────────────────────────────────────────
        mkStep('', 'transport', 'TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO)'),
        mkStep('', 'storage', 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA', {
            dept: 'Almacen',
        }),

        // ── 4. Preparacion y Corte ──────────────────────────────────────────
        mkStep('', 'transport', 'TRASLADO: VINILOS Y TELAS A SECTOR DE MESA DE CORTE'),
        mkStep('15', 'operation', 'PREPARACION DE CORTE', {
            dept: 'Mesa de Corte',
            procChar: 'Preparacion de materiales y herramientas de corte',
        }),
        mkStep('20', 'operation', 'CORTE DE COMPONENTES', {
            dept: 'Mesa de Corte',
            machine: 'Maquina de corte',
            prodChar: 'Dimension de corte conforme a patron',
            prodSC: 'SC',
            procChar: 'Parametros de corte (velocidad, presion)',
            procSC: 'SC',
        }),

        // ── 5. Control con Mylar + Decision ─────────────────────────────────
        mkStep('25', 'inspection', 'CONTROL CON MYLAR', {
            dept: 'Calidad',
            machine: 'Mylar de control',
            prodChar: 'Conformidad dimensional del contorno',
            prodSC: 'CC',
            procChar: 'Verificacion contra plantilla Mylar',
        }),
        mkStep('', 'decision', 'PRODUCTO CONFORME?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Pieza fuera de especificacion dimensional',
            notes: 'SI: continua. NO: scrap',
        }),

        // ── 6. Almacenamiento WIP y Traslados ──────────────────────────────
        mkStep('30', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
        }),
        mkStep('', 'transport', 'TRASLADO: KITS DE COMPONENTES A SECTOR DE COSTURA'),

        // ── 7. Refilado ─────────────────────────────────────────────────────
        mkStep('40', 'operation', 'REFILADO', {
            dept: 'Costura',
            machine: 'Maquina refiladora',
            prodChar: 'Dimension de refilado conforme',
            prodSC: 'SC',
        }),

        // ── 8. Costura Union ────────────────────────────────────────────────
        mkStep('50', 'operation', 'COSTURA UNION', {
            dept: 'Costura',
            machine: 'Maquina de coser industrial',
            prodChar: 'Costura completa y firme, sin saltos de puntada',
            prodSC: 'SC',
            procChar: 'Tension de hilo, puntadas por cm',
            procSC: 'SC',
        }),
        mkStep('', 'transport', 'TRASLADO: HILOS A SECTOR DE COSTURA'),

        // ── 9. Costura Doble ────────────────────────────────────────────────
        mkStep('51', 'operation', 'COSTURA DOBLE', {
            dept: 'Costura',
            machine: 'Maquina de coser industrial',
            prodChar: 'Costura doble conforme a especificacion',
            prodSC: 'SC',
            procChar: 'Tension de hilo, tipo de aguja',
            procSC: 'SC',
        }),

        // ── 10. WIP + Traslado a Adhesivado ─────────────────────────────────
        mkStep('52', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
        }),
        mkStep('', 'transport', 'TRASLADO: SEMITERMINADOS COSIDOS A SECTOR DE ADHESIVADO'),

        // ══════════════════════════════════════════════════════════════════════
        // PARALLEL BRANCH A: Inyeccion de Piezas Plasticas
        // ══════════════════════════════════════════════════════════════════════
        mkStep('', 'transport', 'TRASLADO: MATERIA PRIMA A SECTOR DE INYECCION PLASTICA', {
            branchId: 'A',
            branchLabel: 'Linea Inyeccion Plastica',
        }),
        mkStep('60', 'operation', 'INYECCION DE PIEZAS PLASTICAS', {
            dept: 'Inyeccion',
            machine: 'Maquina inyectora de plastico',
            prodChar: 'Llenado completo, sin rebaba, geometria conforme',
            prodSC: 'SC',
            procChar: 'Presion, Temperatura, Tiempo de ciclo',
            procSC: 'SC',
            branchId: 'A',
            branchLabel: 'Linea Inyeccion Plastica',
        }),
        mkStep('61', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
            branchId: 'A',
        }),
        mkStep('', 'transport', 'TRASLADO: SUSTRATO A SECTOR DE INYECCION PU', {
            branchId: 'A',
        }),

        // ══════════════════════════════════════════════════════════════════════
        // PARALLEL BRANCH B: Inyeccion PU + Ensamble Sustrato con Espuma
        // ══════════════════════════════════════════════════════════════════════
        mkStep('', 'transport', 'TRASLADO: BARRIL AL SECTOR DE INYECCION PU', {
            branchId: 'B',
            branchLabel: 'Linea Inyeccion PU',
        }),
        mkStep('70', 'operation', 'INYECCION PU', {
            dept: 'Inyeccion PU',
            machine: 'Inyectora de poliuretano (PUR)',
            prodChar: 'Peso de espuma conforme, llenado completo sin vacios',
            prodSC: 'SC',
            procChar: 'Presion de inyeccion, temperatura molde, tiempo de ciclo, proporcion mezcla',
            procSC: 'SC',
            branchId: 'B',
            branchLabel: 'Linea Inyeccion PU',
        }),
        mkStep('71', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
            branchId: 'B',
        }),
        mkStep('72', 'operation', 'ENSAMBLE DE SUSTRATO CON ESPUMA', {
            dept: 'Inyeccion PU',
            prodChar: 'Alineacion correcta sustrato-espuma',
            prodSC: 'SC',
            procChar: 'Posicionamiento segun instructivo',
            procSC: 'SC',
            branchId: 'B',
        }),
        mkStep('', 'transport', 'TRASLADO: SUSTRATO + ESPUMA A SECTOR DE ADHESIVADO', {
            branchId: 'B',
        }),

        // ══════════════════════════════════════════════════════════════════════
        // CONVERGENCE: Adhesivado → Inspeccion → Decision → Reproceso
        // ══════════════════════════════════════════════════════════════════════

        // ── 11. Adhesivado ──────────────────────────────────────────────────
        mkStep('80', 'operation', 'ADHESIVADO', {
            dept: 'Adhesivado',
            machine: 'Pistola de adhesivado',
            prodChar: 'Adhesion completa y uniforme',
            prodSC: 'SC',
            procChar: 'Fecha vencimiento adhesivo, proporcion mezcla',
            procSC: 'SC',
        }),

        // ── 12. Inspeccion de Pieza Adhesivada ──────────────────────────────
        mkStep('81', 'inspection', 'INSPECCION DE PIEZA ADHESIVADA', {
            dept: 'Calidad',
            prodChar: 'Conformidad de adhesion vinilo-sustrato',
            prodSC: 'CC',
            procChar: 'Verificacion segun pauta de inspeccion',
            procSC: 'SC',
            notes: 'RE-ENTRADA AL FLUJO PRINCIPAL (desde reproceso 103)',
        }),

        // ── 13. Decision: Producto Conforme? (post-adhesivado) ──────────────
        mkStep('', 'decision', 'PRODUCTO CONFORME?', {
            dept: 'Calidad',
            notes: 'SI: continua a WIP 82. NO: reproceso 103 o scrap',
            prodSC: 'CC',
            procSC: 'SC',
        }),

        // ── 14. Reproceso: Falta de Adhesivo ────────────────────────────────
        mkStep('103', 'operation', 'REPROCESO: FALTA DE ADHESIVO', {
            dept: 'Reproceso',
            isRework: true,
            reworkReturnStep: '81',
            rejectDisp: 'rework',
            notes: 'Reproceso por falta de adhesivo — vuelve a inspeccion 81',
            procChar: 'Aplicacion de adhesivo adicional en zona deficiente',
        }),

        // ── 15. Decision: Reproceso OK? ─────────────────────────────────────
        mkStep('', 'decision', 'REPROCESO OK?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Pieza irrecuperable post-reproceso adhesivo',
            notes: 'SI: re-entrada al flujo principal (op 81). NO: scrap',
        }),

        // ── 16. WIP + Traslado a Tapizado ───────────────────────────────────
        mkStep('82', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
        }),
        mkStep('', 'transport', 'TRASLADO: PIEZA ADHESIVADA AL SECTOR DE TAPIZADO'),

        // ── 17. Tapizado Semiautomatico ─────────────────────────────────────
        mkStep('90', 'operation', 'TAPIZADO SEMIAUTOMATICO', {
            dept: 'Tapizado',
            machine: 'Maquina de tapizado semiautomatico',
            prodChar: 'Adhesion vinilo-sustrato sin arrugas, sin burbujas',
            prodSC: 'CC',
            procChar: 'Parametros de maquina (presion, temperatura)',
            procSC: 'SC',
        }),

        // ── 18. Control Final de Calidad ────────────────────────────────────
        mkStep('100', 'inspection', 'CONTROL FINAL DE CALIDAD', {
            dept: 'Calidad',
            prodChar: 'Conformidad del producto terminado (visual, dimensional)',
            prodSC: 'SC',
            procChar: 'Verificacion segun pauta de inspeccion final',
            procSC: 'SC',
        }),

        // ── 19. Decision: Producto Conforme? (control final) ────────────────
        mkStep('', 'decision', 'PRODUCTO CONFORME?', {
            dept: 'Calidad',
            notes: 'SI: continua a embalaje. NO: clasificacion y segregacion',
        }),

        // ── 20. Clasificacion y Segregacion de Producto No Conforme ─────────
        mkStep('', 'operation', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', {
            dept: 'Calidad',
        }),

        // ── 21. Pieza Irrecuperable → Scrap ────────────────────────────────
        mkStep('101', 'operation', 'PIEZA IRRECUPERABLE SCRAP', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Pieza irrecuperable en control final',
            notes: 'Disposicion final: descarte',
        }),

        // ── 22. Embalaje y Salida ───────────────────────────────────────────
        mkStep('', 'transport', 'TRASLADO A SECTOR DE PRODUCTO TERMINADO'),
        mkStep('110', 'operation', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', {
            dept: 'Embalaje',
            prodChar: 'Integridad fisica y trazabilidad (etiquetado correcto)',
            prodSC: 'SC',
        }),
        mkStep('', 'storage', 'ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)', {
            dept: 'Almacen PT',
        }),
    ];
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD PFD DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════

function buildPfdDocument() {
    const pfdId = uuid();
    const steps = buildPfdSteps();

    return {
        id: pfdId,
        header: {
            partNumber: 'ARMREST DOOR PANEL',
            partName: 'Armrest Door Panel - Patagonia VW',
            engineeringChangeLevel: '',
            modelYear: 'PATAGONIA',
            documentNumber: DOC_NUMBER,
            revisionLevel: 'A',
            revisionDate: '2025-11-12',
            processPhase: 'pre-launch',
            companyName: 'BARACK MERCOSUL',
            plantLocation: 'Hurlingham, Buenos Aires',
            supplierCode: '',
            customerName: 'VW',
            client: 'VWA',
            coreTeam: 'P. Gamboa, C. Baptista',
            keyContact: '',
            preparedBy: 'P. GAMBOA',
            preparedDate: '2025-11-12',
            approvedBy: 'C. BAPTISTA',
            approvedDate: '2025-11-12',
            applicableParts: 'ARMREST DOOR PANEL',
            linkedAmfeProject: PROJECT_NAME,
        },
        steps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('================================================================');
    console.log('  SEED: PFD for Armrest Door Panel');
    console.log('  Source: FLUJOGRAMA_153_ARMREST_REV.pdf');
    console.log('  Document: I-IN-002/III (Rev A, 12/11/2025)');
    console.log('================================================================');

    await initSupabase();

    // ── Step 1: Build PFD document ───────────────────────────────────────
    console.log('\n  Step 1: Building PFD...');
    const pfdDoc = buildPfdDocument();
    const pfdDataJson = JSON.stringify(pfdDoc);
    const pfdChecksum = sha256(pfdDataJson);
    const pfdId = pfdDoc.id;

    // Count step types for summary
    const stepsByType = {};
    for (const s of pfdDoc.steps) {
        stepsByType[s.stepType] = (stepsByType[s.stepType] || 0) + 1;
    }
    const decisions = pfdDoc.steps.filter(s => s.stepType === 'decision');
    const reworks = pfdDoc.steps.filter(s => s.isRework);
    const scraps = pfdDoc.steps.filter(s => s.rejectDisposition === 'scrap');
    const branches = new Set(pfdDoc.steps.filter(s => s.branchId).map(s => s.branchId));

    console.log(`    Total steps: ${pfdDoc.steps.length}`);
    console.log(`    By type: ${JSON.stringify(stepsByType)}`);
    console.log(`    Decision points (rombos): ${decisions.length}`);
    console.log(`    Rework paths: ${reworks.length}`);
    console.log(`    Scrap dispositions: ${scraps.length}`);
    console.log(`    Parallel branches: ${branches.size} (${[...branches].join(', ')})`);
    console.log(`    PFD ID: ${pfdId}`);

    // ── Step 2: Delete existing PFD if it exists ─────────────────────────
    console.log('\n  Step 2: Checking for existing PFD...');
    const existingPfd = await selectSql(
        `SELECT id FROM pfd_documents WHERE document_number = ?`,
        [DOC_NUMBER]
    );

    if (existingPfd.length > 0) {
        await execSql(
            `DELETE FROM pfd_documents WHERE document_number = ?`,
            [DOC_NUMBER]
        );
        console.log(`    Deleted existing PFD (document_number=${DOC_NUMBER})`);
    } else {
        console.log(`    No existing PFD found for ${DOC_NUMBER}`);
    }

    // ── Step 3: Insert PFD into Supabase ─────────────────────────────────
    console.log('\n  Step 3: Inserting PFD into Supabase...');
    await execSql(`INSERT INTO pfd_documents (
        id, part_number, part_name, document_number, revision_level,
        revision_date, customer_name, step_count,
        data, checksum)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pfdId, 'ARMREST DOOR PANEL', 'Armrest Door Panel - Patagonia VW',
         DOC_NUMBER, 'A', '2025-11-12', 'VW', pfdDoc.steps.length,
         pfdDataJson, pfdChecksum]);
    console.log(`    PFD inserted: ${DOC_NUMBER} (${pfdDoc.steps.length} steps)`);

    // ── Step 4: Link PFD to Armrest family ───────────────────────────────
    console.log('\n  Step 4: Linking PFD to family...');

    const familyResult = await selectSql(
        `SELECT id FROM product_families WHERE name = ?`,
        [FAMILY_NAME]
    );

    if (familyResult.length === 0) {
        console.log(`    WARNING: Family "${FAMILY_NAME}" not found. PFD not linked to family.`);
        console.log(`    Run seed-armrest.mjs first to create the family.`);
    } else {
        const familyId = familyResult[0].id;
        console.log(`    Family found: "${FAMILY_NAME}" (id=${familyId})`);

        // Check existing PFD link
        const existingFamDoc = await selectSql(
            `SELECT id FROM family_documents WHERE family_id = ? AND module = 'pfd'`,
            [familyId]
        );

        if (existingFamDoc.length > 0) {
            await execSql(
                `UPDATE family_documents SET document_id = ?, is_master = 1, source_master_id = NULL
                 WHERE family_id = ? AND module = 'pfd'`,
                [pfdId, familyId]);
            console.log(`    PFD family link updated (family_id=${familyId}, doc_id=${pfdId})`);
        } else {
            await execSql(
                `INSERT INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
                 VALUES (?, 'pfd', ?, 1, NULL, NULL)`,
                [familyId, pfdId]);
            console.log(`    PFD linked as master (family_id=${familyId}, doc_id=${pfdId})`);
        }
    }

    // ── Step 5: Find and link AMFE ───────────────────────────────────────
    console.log('\n  Step 5: Checking AMFE linkage...');

    const amfeResult = await selectSql(
        `SELECT id, amfe_number FROM amfe_documents WHERE project_name = ?`,
        [PROJECT_NAME]
    );

    if (amfeResult.length > 0) {
        const amfeId = amfeResult[0].id;
        console.log(`    AMFE found: ${amfeResult[0].amfe_number} (id=${amfeId})`);

        // Update PFD header with AMFE link
        pfdDoc.header.linkedAmfeId = amfeId;
        pfdDoc.header.linkedAmfeProject = PROJECT_NAME;
        const updatedJson = JSON.stringify(pfdDoc);
        const updatedChecksum = sha256(updatedJson);

        await execSql(
            `UPDATE pfd_documents SET data = ?, checksum = ? WHERE id = ?`,
            [updatedJson, updatedChecksum, pfdId]
        );
        console.log(`    PFD updated with AMFE link`);
    } else {
        console.log(`    No AMFE found for ${PROJECT_NAME} (PFD header still has linkedAmfeProject)`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n' + '='.repeat(60));
    console.log('  VERIFICATION');
    console.log('='.repeat(60));

    const pfdVerify = await selectSql(
        `SELECT id, step_count, part_name, document_number, customer_name
         FROM pfd_documents WHERE document_number = ?`,
        [DOC_NUMBER]
    );
    console.log(`\n  PFD documents: ${pfdVerify.length}`);
    for (const p of pfdVerify) {
        console.log(`    ${p.document_number} | ${p.part_name} | ${p.step_count} steps | ${p.customer_name}`);
    }

    if (familyResult && familyResult.length > 0) {
        const familyId = familyResult[0].id;
        const famVerify = await selectSql(
            `SELECT fd.module, fd.is_master, fd.document_id FROM family_documents fd WHERE fd.family_id = ?`,
            [familyId]
        );
        console.log(`\n  Family docs (family_id=${familyId}): ${famVerify.length}`);
        for (const fd of famVerify) {
            console.log(`    [${fd.module.toUpperCase()}] ${fd.is_master ? 'MASTER' : 'VARIANT'} -> ${fd.document_id}`);
        }
    }

    // Total PFD count
    const totalPfd = await selectSql(`SELECT COUNT(*) as cnt FROM pfd_documents`);
    console.log(`\n  Total PFD documents in DB: ${totalPfd[0]?.cnt || 0}`);

    // ── Summary ─────────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log('  SEED COMPLETE — ARMREST DOOR PANEL PFD');
    console.log('================================================================');
    console.log(`  Document: ${DOC_NUMBER} (Rev A)`);
    console.log(`  Total steps: ${pfdDoc.steps.length}`);
    console.log(`  Operations: ${stepsByType['operation'] || 0}`);
    console.log(`  Inspections: ${stepsByType['inspection'] || 0}`);
    console.log(`  Decisions (rombos): ${decisions.length}`);
    console.log(`  Transport: ${stepsByType['transport'] || 0}`);
    console.log(`  Storage: ${stepsByType['storage'] || 0}`);
    console.log(`  Rework paths: ${reworks.length} (Op 103: Falta de Adhesivo)`);
    console.log(`  Scrap dispositions: ${scraps.length}`);
    console.log(`  Parallel branches: ${branches.size} (A=Inyeccion Plastica, B=Inyeccion PU)`);
    console.log(`  Linked to family: ${FAMILY_NAME}`);
    console.log(`  Linked AMFE project: ${PROJECT_NAME}`);
    console.log('================================================================');

    close();
}

main().catch((err) => {
    console.error('\n  FATAL ERROR:', err.message);
    console.error(err.stack);
    close();
    process.exit(1);
});

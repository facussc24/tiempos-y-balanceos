#!/usr/bin/env node
/**
 * SEED: PFD (Process Flow Diagram) for Headrest families
 *
 * Creates 3 PFD documents for:
 *   - Headrest Front (family_id=9)        AMFE: 95719160-c714-464e-9983-0878cbb1546a
 *   - Headrest Rear Center (family_id=10) AMFE: 42370217-f305-48c3-92d8-d31079ee3b4b
 *   - Headrest Rear Outer (family_id=11)  AMFE: 0446af1c-e76a-44bf-ab1a-d4fc2b6c9d16
 *
 * Source: FLUJOGRAMA 152 APC DEL-LAT-CEN PATAGONIA REV
 * Document code: I-IN-002/III
 *
 * Usage: node scripts/seed-headrest-pfd.mjs
 */

import { randomUUID, createHash } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ─── Config ─────────────────────────────────────────────────────────────────

const HEADRESTS = [
    {
        key: 'front',
        familyId: 9,
        amfeId: '95719160-c714-464e-9983-0878cbb1546a',
        partNumber: '2HC.881.901',
        partName: 'APOYACABEZAS DELANTERO PATAGONIA',
        pfdPartName: 'Apoyacabezas Delantero - Patagonia VW',
        pfdDocNumber: 'I-IN-002/III-HR-DEL',
        projectName: 'VWA/PATAGONIA/HEADREST_FRONT',
    },
    {
        key: 'rear_center',
        familyId: 10,
        amfeId: '42370217-f305-48c3-92d8-d31079ee3b4b',
        partNumber: '2HC.885.900',
        partName: 'APOYACABEZAS TRASERO CENTRAL PATAGONIA',
        pfdPartName: 'Apoyacabezas Trasero Central - Patagonia VW',
        pfdDocNumber: 'I-IN-002/III-HR-CEN',
        projectName: 'VWA/PATAGONIA/HEADREST_REAR_CEN',
    },
    {
        key: 'rear_outer',
        familyId: 11,
        amfeId: '0446af1c-e76a-44bf-ab1a-d4fc2b6c9d16',
        partNumber: '2HC.885.901',
        partName: 'APOYACABEZAS TRASERO LATERAL PATAGONIA',
        pfdPartName: 'Apoyacabezas Trasero Lateral - Patagonia VW',
        pfdDocNumber: 'I-IN-002/III-HR-LAT',
        projectName: 'VWA/PATAGONIA/HEADREST_REAR_OUT',
    },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const uuid = () => randomUUID();
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/**
 * Create a PFD step following the same schema as seed-armrest.mjs
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
        reworkReturnStep: '',
        rejectDisposition: extras.rejectDisp || 'none',
        scrapDescription: extras.scrapDesc || '',
        branchId: extras.branchId || '',
        branchLabel: extras.branchLabel || '',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// PFD STEPS — Parsed from FLUJOGRAMA 152 APC DEL-LAT-CEN PATAGONIA
//
// Flow: Recepcion → Corte → Preparacion Kits → Costura Union →
//       Costura Vista → Ensamble Asta-Funda → Inyeccion PUR →
//       Curado → Control Final → Embalaje
// ═══════════════════════════════════════════════════════════════════════════

function buildPfdSteps() {
    return [
        // ── Recepcion & Almacenamiento Inicial ──
        mkStep('10', 'storage', 'RECEPCION DE MATERIA PRIMA', {
            dept: 'Recepcion',
            procChar: 'Conformidad de calidad y cantidad de material recibido',
            procSC: 'SC',
        }),
        mkStep('', 'inspection', 'INSPECCION DE MATERIA PRIMA', {
            dept: 'Calidad',
            procChar: 'Verificacion de especificaciones de materia prima',
            procSC: 'SC',
            rejectDisp: 'scrap',
            scrapDesc: 'Reclamo de calidad al proveedor',
        }),
        mkStep('', 'storage', 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA', {
            dept: 'Almacen',
        }),

        // ── Corte ──
        mkStep('', 'transport', 'TRASLADO: VINILOS / TELAS A SECTOR DE MESA DE CORTE'),
        mkStep('20', 'operation', 'CORTE DE COMPONENTES', {
            dept: 'Mesa de Corte',
            machine: 'Maquina de corte',
            prodChar: 'Dimension de corte conforme a patron',
            prodSC: 'SC',
            procChar: 'Parametros de corte (velocidad, presion)',
            procSC: 'SC',
        }),

        // ── Preparacion de Kits ──
        mkStep('30', 'operation', 'PREPARACION DE KITS DE COMPONENTES DE COSTURA', {
            dept: 'Blanco',
            procChar: 'Composicion correcta del kit (tipo, cantidad, color)',
            procSC: 'SC',
        }),
        mkStep('', 'transport', 'TRASLADO: KITS DE COMPONENTES DE COSTURA A SECTOR DE COSTURA'),

        // ── Costura ──
        mkStep('40', 'operation', 'COSTURA UNION', {
            dept: 'Costura',
            machine: 'Maquina de coser industrial',
            prodChar: 'Costura completa y firme, sin saltos de puntada',
            prodSC: 'SC',
            procChar: 'Tension de hilo, puntadas por cm',
            procSC: 'SC',
        }),
        mkStep('50', 'operation', 'COSTURA VISTA', {
            dept: 'Costura',
            machine: 'Maquina de coser industrial',
            prodChar: 'Costura decorativa conforme a especificacion',
            prodSC: 'CC',
            procChar: 'Tension de hilo, tipo de aguja, velocidad',
            procSC: 'SC',
            notes: 'Caracteristica critica (D/TLD)',
        }),

        // ── Ensamble e Inyeccion ──
        mkStep('', 'transport', 'TRASLADO: FUNDAS COSIDAS APROBADAS A AREA DE INYECCION'),
        mkStep('60', 'operation', 'ENSAMBLE ASTA - FUNDA', {
            dept: 'Inyeccion',
            machine: 'Dispositivo de ensamble',
            prodChar: 'Posicion correcta del asta (varilla) dentro de la funda',
            prodSC: 'SC',
            procChar: 'Alineacion asta-funda segun instructivo',
            procSC: 'SC',
            notes: 'Caracteristica critica (D/TLD)',
        }),
        mkStep('70', 'operation', 'INYECCION PUR', {
            dept: 'Inyeccion',
            machine: 'Inyectora de poliuretano (PUR)',
            prodChar: 'Peso de espuma, llenado completo sin vacios',
            prodSC: 'CC',
            procChar: 'Presion de inyeccion, temperatura molde, tiempo de ciclo, proporcion mezcla',
            procSC: 'SC',
            notes: 'Caracteristica critica (D/TLD)',
        }),
        mkStep('80', 'operation', 'CURADO Y ESTABILIZACION DE ESPUMA', {
            dept: 'Inyeccion',
            procChar: 'Tiempo de curado, temperatura ambiente',
            procSC: 'SC',
        }),

        // ── Transporte a Control ──
        mkStep('', 'transport', 'TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO)', {
            notes: 'Caracteristica critica (D/TLD)',
        }),

        // ── Control Final ──
        mkStep('90', 'inspection', 'CONTROL FINAL DE CALIDAD Y PRUEBAS FUNCIONALES', {
            dept: 'Calidad',
            prodChar: 'Conformidad del producto terminado (visual, dimensional, funcional)',
            prodSC: 'SC',
            procChar: 'Verificacion segun pauta de inspeccion final',
            procSC: 'SC',
        }),

        // ── Decision y No Conforme ──
        mkStep('', 'decision', 'PRODUCTO CONFORME?', {
            dept: 'Calidad',
        }),
        mkStep('100', 'operation', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP PIEZA IRRECUPERABLE',
            notes: 'Caracteristica critica (D/TLD)',
        }),

        // ── Reprocesos ──
        mkStep('110', 'operation', 'REPROCESO: ELIMINACION DE HILO SOBRANTE', {
            dept: 'Reproceso',
            isRework: true,
            notes: 'DEFECTO: HILO SOBRANTE — RE-ENTRADA AL FLUJO PRINCIPAL',
        }),
        mkStep('111', 'operation', 'REPROCESO: PUNTADA FLOJA', {
            dept: 'Reproceso',
            isRework: true,
            notes: 'DEFECTO: PUNTADA FLOJA — RE-ENTRADA AL FLUJO PRINCIPAL',
        }),
        mkStep('112', 'operation', 'REPROCESO: ELIMINACION DE ARRUGAS EN HORNO', {
            dept: 'Reproceso',
            machine: 'Horno',
            isRework: true,
            notes: 'DEFECTO: ARRUGAS — RE-ENTRADA AL FLUJO PRINCIPAL',
        }),

        // ── Embalaje y Salida ──
        mkStep('120', 'operation', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', {
            dept: 'Embalaje',
            prodChar: 'Integridad fisica y trazabilidad (etiquetado correcto)',
            prodSC: 'SC',
        }),
        mkStep('', 'storage', 'ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)', {
            dept: 'Almacen',
        }),
        mkStep('', 'transport', 'TRASLADO A SECTOR DE PRODUCTO TERMINADO'),
    ];
}

/**
 * Build a full PFD document object for a given headrest position
 */
function buildPfdDocument(hr) {
    const pfdId = uuid();
    const steps = buildPfdSteps();

    return {
        id: pfdId,
        header: {
            partNumber: hr.partNumber,
            partName: hr.pfdPartName,
            engineeringChangeLevel: '',
            modelYear: 'PATAGONIA',
            documentNumber: hr.pfdDocNumber,
            revisionLevel: 'A',
            revisionDate: '2025-09-18',
            processPhase: 'pre-launch',
            companyName: 'BARACK MERCOSUL',
            plantLocation: 'Hurlingham, Buenos Aires',
            supplierCode: '',
            customerName: 'VW',
            client: 'VWA',
            coreTeam: 'F.Santoro, P.Centurion, G.Cal, L.Lattanzi',
            keyContact: '',
            preparedBy: 'FACUNDO SANTORO',
            preparedDate: '2025-09-18',
            approvedBy: 'GONZALO CAL',
            approvedDate: '2025-09-18',
            applicableParts: hr.partNumber,
            linkedAmfeId: hr.amfeId,
            linkedAmfeProject: hr.projectName,
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
    console.log('  SEED: PFD for 3 Headrest Families (DEL, CEN, LAT)');
    console.log('  Source: FLUJOGRAMA 152 APC DEL-LAT-CEN PATAGONIA');
    console.log('================================================================');

    await initSupabase();

    for (const hr of HEADRESTS) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  Processing: ${hr.partName}`);
        console.log(`  Part Number: ${hr.partNumber}`);
        console.log(`  Family ID: ${hr.familyId}`);
        console.log(`${'='.repeat(60)}`);

        // ── Step 1: Build PFD document ───────────────────────────────────
        console.log('\n  Step 1: Building PFD...');
        const pfdDoc = buildPfdDocument(hr);
        const pfdDataJson = JSON.stringify(pfdDoc);
        const pfdChecksum = sha256(pfdDataJson);
        const pfdId = pfdDoc.id;

        console.log(`    Steps: ${pfdDoc.steps.length}`);
        console.log(`    PFD ID: ${pfdId}`);
        console.log(`    Doc Number: ${hr.pfdDocNumber}`);
        console.log(`    Linked AMFE: ${hr.amfeId}`);

        // ── Step 2: Insert or Update PFD in Supabase ─────────────────────
        console.log('\n  Step 2: Inserting PFD into Supabase...');
        const existingPfd = await selectSql(
            `SELECT id FROM pfd_documents WHERE document_number = ?`,
            [hr.pfdDocNumber]
        );

        let finalPfdId = pfdId;

        if (existingPfd.length > 0) {
            finalPfdId = existingPfd[0].id;
            await execSql(`UPDATE pfd_documents SET
                data = ?, checksum = ?, updated_at = NOW(),
                step_count = ?, part_number = ?, part_name = ?,
                revision_level = ?, revision_date = ?, customer_name = ?
                WHERE id = ?`,
                [pfdDataJson, pfdChecksum, pfdDoc.steps.length,
                 hr.partNumber, hr.pfdPartName,
                 'A', '2025-09-18', 'VW', finalPfdId]);
            pfdDoc.id = finalPfdId;
            console.log(`    PFD updated (ID: ${finalPfdId}, ${pfdDoc.steps.length} steps)`);
        } else {
            await execSql(`INSERT INTO pfd_documents (
                id, part_number, part_name, document_number, revision_level,
                revision_date, customer_name, step_count, data, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [pfdId, hr.partNumber, hr.pfdPartName,
                 hr.pfdDocNumber, 'A', '2025-09-18', 'VW',
                 pfdDoc.steps.length, pfdDataJson, pfdChecksum]);
            console.log(`    PFD inserted (ID: ${pfdId}, ${pfdDoc.steps.length} steps)`);
        }

        // ── Step 3: Link PFD to family_documents as master ───────────────
        console.log('\n  Step 3: Linking PFD to family...');

        const existingFamDoc = await selectSql(
            `SELECT id FROM family_documents WHERE family_id = ? AND module = 'pfd'`,
            [hr.familyId]
        );

        if (existingFamDoc.length > 0) {
            // Update existing link
            await execSql(
                `UPDATE family_documents SET document_id = ?, is_master = 1, source_master_id = NULL
                 WHERE family_id = ? AND module = 'pfd'`,
                [finalPfdId, hr.familyId]);
            console.log(`    PFD family link updated (family_id=${hr.familyId}, doc_id=${finalPfdId})`);
        } else {
            await execSql(
                `INSERT INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
                 VALUES (?, 'pfd', ?, 1, NULL, NULL)`,
                [hr.familyId, finalPfdId]);
            console.log(`    PFD linked as master (family_id=${hr.familyId}, doc_id=${finalPfdId})`);
        }

        // ── Verify ───────────────────────────────────────────────────────
        console.log('\n  -- Verification --');

        const pfdVerify = await selectSql(
            `SELECT id, step_count, part_name, document_number FROM pfd_documents WHERE document_number = ?`,
            [hr.pfdDocNumber]);
        console.log(`    PFD: ${pfdVerify.length} doc(s)${pfdVerify[0] ? ` - ${pfdVerify[0].step_count} steps, doc=${pfdVerify[0].document_number}` : ''}`);

        const famVerify = await selectSql(
            `SELECT fd.module, fd.is_master, fd.document_id FROM family_documents fd WHERE fd.family_id = ?`,
            [hr.familyId]);
        console.log(`    Family docs (family_id=${hr.familyId}): ${famVerify.length} total`);
        for (const fd of famVerify) {
            console.log(`      [${fd.module.toUpperCase()}] ${fd.is_master ? 'MASTER' : 'VARIANT'} -> ${fd.document_id}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GLOBAL VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n' + '='.repeat(60));
    console.log('  GLOBAL VERIFICATION');
    console.log('='.repeat(60));

    const allPfd = await selectSql(
        `SELECT id, document_number, part_name, step_count, customer_name
         FROM pfd_documents WHERE document_number LIKE 'I-IN-002/III-HR%'`);
    console.log(`\n  Headrest PFD documents: ${allPfd.length}`);
    for (const p of allPfd) {
        console.log(`    ${p.document_number} | ${p.part_name} | ${p.step_count} steps`);
    }

    const allFamDocs = await selectSql(
        `SELECT fd.family_id, fd.module, fd.document_id, fd.is_master
         FROM family_documents fd
         WHERE fd.family_id IN (9, 10, 11) AND fd.module = 'pfd'`);
    console.log(`\n  Family PFD links: ${allFamDocs.length}`);
    for (const fd of allFamDocs) {
        console.log(`    family_id=${fd.family_id} | ${fd.is_master ? 'MASTER' : 'VARIANT'} | doc_id=${fd.document_id}`);
    }

    // Total PFD count
    const totalPfd = await selectSql(`SELECT COUNT(*) as cnt FROM pfd_documents`);
    console.log(`\n  Total PFD documents in DB: ${totalPfd[0]?.cnt || 0}`);

    console.log('\n================================================================');
    console.log('  SEED COMPLETE: 3 Headrest PFDs');
    console.log('  - I-IN-002/III-HR-DEL (Front)');
    console.log('  - I-IN-002/III-HR-CEN (Rear Center)');
    console.log('  - I-IN-002/III-HR-LAT (Rear Outer)');
    console.log('================================================================');

    close();
}

main().catch((err) => {
    console.error('\n  FATAL ERROR:', err.message);
    console.error(err.stack);
    close();
    process.exit(1);
});

#!/usr/bin/env node
/**
 * FIX: Add missing NG disposition paths to all PFDs
 *
 * Fixes:
 * 1. Insert master (PFD-INS-001) — REBUILD from Flujograma 154 PDF
 * 2. Insert L0 variant (PFD-INS-001-L0) — REBUILD (same steps as master)
 * 3. Top Roll (PFD-TOPROLL-001) — REBUILD from Flujograma 122 PDF
 * 4. Headrest PFDs (3x) — Add notes to decision steps
 * 5. Telas PFDs (2x) — Add notes to decision steps
 *
 * Usage: node scripts/fix-pfd-ng-paths.mjs
 */

import { randomUUID, createHash } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

const uuid = () => randomUUID();
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

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
// INSERT PFD — from FLUJOGRAMA_154_INSERT PAT_REV.pdf
//
// Flow structure (from PDF):
//   10→Insp→Decision(Material)→Storage→15→20→25→Decision(Mylar)→30→
//   Transport→40→50→51→Transport→
//   [Branch: 60 Troquelado→61→Transport to Prearmado]
//   [Branch: 70 Inyeccion Plastica→71→Transport to Prearmado]
//   80 Prearmado→81→Transport→90 Adhesivado→91 Insp→Decision→
//   [103 Reproceso Adhesivo→Decision→Scrap]→92→Transport→
//   100 Tapizado→110 Control Final→Decision→
//   [Clasificacion→111 Scrap | Reproceso Puntada Floja]→
//   Transport→120 Embalaje→Storage
// ═══════════════════════════════════════════════════════════════════════════

function buildInsertPfdSteps() {
    return [
        // ── Recepcion & Inspeccion ──
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

        // ── Decision: Material Conforme? ──
        mkStep('', 'decision', 'MATERIAL CONFORME?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'RECLAMO DE CALIDAD AL PROVEEDOR',
            notes: 'SI: continua flujo. NO: reclamo al proveedor',
        }),

        // ── Material aprobado ──
        mkStep('', 'transport', 'TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO)'),
        mkStep('', 'storage', 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA', {
            dept: 'Almacen',
        }),

        // ── Preparacion y Corte ──
        mkStep('', 'transport', 'TRASLADO: VINILOS Y TELAS A SECTOR DE MESA DE CORTE'),
        mkStep('15', 'operation', 'PREPARACION DE CORTE', {
            dept: 'Mesa de Corte',
            procChar: 'Preparacion de materiales y herramientas de corte',
        }),
        mkStep('20', 'operation', 'CORTAR COMPONENTES', {
            dept: 'Mesa de Corte',
            machine: 'Maquina de corte',
            prodChar: 'Dimension de corte conforme a patron',
            prodSC: 'SC',
            procChar: 'Parametros de corte (velocidad, presion)',
            procSC: 'SC',
        }),

        // ── Control con Mylar + Decision ──
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

        // ── Almacenamiento WIP ──
        mkStep('30', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
        }),
        mkStep('', 'transport', 'TRASLADO: KITS DE COMPONENTES A SECTOR DE COSTURA'),

        // ── Refilado ──
        mkStep('40', 'operation', 'REFILADO', {
            dept: 'Costura',
            machine: 'Maquina refiladora',
            prodChar: 'Dimension de refilado conforme',
            prodSC: 'SC',
        }),

        // ── Costura CNC ──
        mkStep('50', 'operation', 'COSTURA EN MAQUINA CNC', {
            dept: 'Costura',
            machine: 'Maquina CNC de costura',
            prodChar: 'Costura completa y firme, sin saltos de puntada',
            prodSC: 'SC',
            procChar: 'Tension de hilo, puntadas por cm, programa CNC',
            procSC: 'SC',
        }),
        mkStep('', 'transport', 'TRASLADO: HILOS A SECTOR DE COSTURA'),

        // ── WIP + Traslado ──
        mkStep('51', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
        }),
        mkStep('', 'transport', 'TRASLADO: SEMITERMINADOS COSIDOS SECTOR DE COSTURA'),

        // ── Troquelado (parallel supply path) ──
        mkStep('', 'transport', 'TRASLADO: ESPUMAS A SECTOR DE TROQUELADO'),
        mkStep('60', 'operation', 'TROQUELADO', {
            dept: 'Troquelado',
            machine: 'Troqueladora',
            prodChar: 'Forma de espuma conforme a patron',
            prodSC: 'SC',
        }),
        mkStep('61', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
        }),
        mkStep('', 'transport', 'TRASLADO: PIEZAS TROQUELADAS A SECTOR DE PREARMADO'),

        // ── Inyeccion Plastica (parallel supply path) ──
        mkStep('', 'transport', 'TRASLADO: MATERIA PRIMA A SECTOR DE INYECCION PLASTICA'),
        mkStep('70', 'operation', 'INYECCION DE PIEZAS PLASTICAS', {
            dept: 'Inyeccion',
            machine: 'Maquina inyectora de plastico',
            prodChar: 'Llenado completo, sin rebaba, geometria conforme',
            prodSC: 'SC',
            procChar: 'Presion, Temperatura, Tiempo de ciclo',
            procSC: 'SC',
        }),
        mkStep('71', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
        }),
        mkStep('', 'transport', 'TRASLADO: SUSTRATO A SECTOR DE PREARMADO DE ESPUMA'),

        // ── Prearmado de Espuma ──
        mkStep('80', 'operation', 'PREARMADO DE ESPUMA', {
            dept: 'Prearmado',
            prodChar: 'Alineacion correcta espuma-sustrato',
            prodSC: 'SC',
            procChar: 'Posicionamiento segun instructivo',
            procSC: 'SC',
        }),
        mkStep('81', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
        }),
        mkStep('', 'transport', 'TRASLADO: PIEZA PREARMADA AL SECTOR DE ADHESIVADO'),

        // ── Adhesivado ──
        mkStep('90', 'operation', 'ADHESIVADO', {
            dept: 'Adhesivado',
            machine: 'Pistola de adhesivado',
            prodChar: 'Adhesion completa y uniforme',
            prodSC: 'SC',
            procChar: 'Fecha vencimiento adhesivo, proporcion mezcla',
            procSC: 'SC',
        }),

        // ── Inspeccion de Pieza Adhesivada ──
        mkStep('91', 'inspection', 'INSPECCION DE PIEZA ADHESIVADA', {
            dept: 'Calidad',
            prodChar: 'Conformidad de adhesion',
            prodSC: 'CC',
            procChar: 'Verificacion segun pauta de inspeccion',
            procSC: 'SC',
            notes: 'RE-ENTRADA AL FLUJO PRINCIPAL (desde reproceso 103)',
        }),

        // ── Decision: Producto Conforme? (post-adhesivado) ──
        mkStep('', 'decision', 'PRODUCTO CONFORME?', {
            dept: 'Calidad',
            notes: 'SI: continua a WIP 92. NO: reproceso 103 o scrap',
            prodSC: 'CC',
            procSC: 'SC',
        }),

        // ── Reproceso: Falta de Adhesivo ──
        mkStep('103', 'operation', 'REPROCESO: FALTA DE ADHESIVO', {
            dept: 'Reproceso',
            isRework: true,
            reworkReturnStep: '91',
            rejectDisp: 'rework',
            notes: 'Reproceso por falta de adhesivo — vuelve a inspeccion 91',
            procChar: 'Aplicacion de adhesivo adicional en zona deficiente',
        }),

        // ── Decision: Reproceso OK? ──
        mkStep('', 'decision', 'REPROCESO OK?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Pieza irrecuperable post-reproceso adhesivo',
            notes: 'SI: re-entrada al flujo principal (op 91). NO: scrap',
        }),

        // ── WIP + Traslado a Tapizado ──
        mkStep('92', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', {
            dept: 'WIP',
        }),
        mkStep('', 'transport', 'TRASLADO: PIEZA PREARMADA AL SECTOR DE TAPIZADO'),

        // ── Tapizado Semiautomatico ──
        mkStep('100', 'operation', 'TAPIZADO SEMIAUTOMATICO', {
            dept: 'Tapizado',
            machine: 'Maquina de tapizado semiautomatico',
            prodChar: 'Adhesion vinilo-sustrato sin arrugas, sin burbujas',
            prodSC: 'CC',
            procChar: 'Parametros de maquina (presion, temperatura)',
            procSC: 'SC',
        }),

        // ── Control Final de Calidad ──
        mkStep('110', 'inspection', 'CONTROL FINAL DE CALIDAD', {
            dept: 'Calidad',
            prodChar: 'Conformidad del producto terminado (visual, dimensional)',
            prodSC: 'SC',
            procChar: 'Verificacion segun pauta de inspeccion final',
            procSC: 'SC',
        }),

        // ── Decision: Producto Conforme? (control final) ──
        mkStep('', 'decision', 'PRODUCTO CONFORME?', {
            dept: 'Calidad',
            notes: 'SI: continua a embalaje. NO: clasificacion y segregacion',
        }),

        // ── Clasificacion y Segregacion ──
        mkStep('', 'operation', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', {
            dept: 'Calidad',
        }),

        // ── Pieza Irrecuperable → Scrap ──
        mkStep('111', 'operation', 'PIEZA IRRECUPERABLE SCRAP', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Pieza irrecuperable en control final',
            notes: 'Disposicion final: descarte',
        }),

        // ── Reproceso: Puntada Floja ──
        mkStep('104', 'operation', 'REPROCESO: PUNTADA FLOJA', {
            dept: 'Reproceso',
            isRework: true,
            reworkReturnStep: '110',
            rejectDisp: 'rework',
            notes: 'Defecto: puntada floja — re-entrada al flujo principal (control final)',
        }),

        // ── Embalaje y Salida ──
        mkStep('', 'transport', 'TRASLADO A SECTOR DE PRODUCTO TERMINADO'),
        mkStep('120', 'operation', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', {
            dept: 'Embalaje',
            prodChar: 'Integridad fisica y trazabilidad (etiquetado correcto)',
            prodSC: 'SC',
        }),
        mkStep('', 'transport', 'TRASLADO A SECTOR DE ALMACENAMIENTO'),
        mkStep('', 'storage', 'ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)', {
            dept: 'Almacen PT',
        }),
    ];
}

// ═══════════════════════════════════════════════════════════════════════════
// TOP ROLL PFD — from 122 FLUJOGRAMA TOP ROLL PAT 2.pdf
//
// Flow structure (from PDF):
//   5 Recepcion→Insp→Decision(Material)→Storage→Transport→
//   10 Inyeccion Plastica→Decision→20 Adhesivado Hot Melt→Decision→
//   30 Proceso IMG→Decision→40 Trimming Corte Final→Decision→
//   50 Edge Folding→Decision→60 Soldado Refuerzos→Decision→
//   70 Soldado Tweeter→Inspeccion Final→Decision→
//   Transport→90 Embalaje→Control Despacho→Storage
//
// KEY: Every operation has a decision diamond "Esta OK la pieza?"
//      with NO → SCRAP path. No rework paths in this flowchart.
// ═══════════════════════════════════════════════════════════════════════════

function buildTopRollPfdSteps() {
    return [
        // ── Recepcion ──
        mkStep('5', 'storage', 'RECEPCION DE MATERIALES: TABLA DE MATERIALES', {
            dept: 'Recepcion',
            procChar: 'Conformidad de calidad y cantidad de material recibido',
            procSC: 'SC',
        }),
        mkStep('', 'storage', 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA PENDIENTE DE CONTROL', {
            dept: 'Almacen',
        }),
        mkStep('', 'inspection', 'INSPECCION DE MATERIALES', {
            dept: 'Calidad',
            procChar: 'Verificacion de especificaciones de materia prima',
            procSC: 'SC',
        }),
        mkStep('', 'decision', 'MATERIAL CONFORME?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'RECLAMO DE CALIDAD AL PROVEEDOR',
            notes: 'OK: continua flujo. NO OK: reclamo al proveedor',
        }),
        mkStep('', 'storage', 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA', {
            dept: 'Almacen',
        }),
        mkStep('', 'transport', 'TRASLADO DE MATERIA PRIMA AL SECTOR DE INYECCION'),

        // ── 10 Inyeccion Plastica + Decision ──
        mkStep('10', 'operation', 'INYECCION DE PIEZA PLASTICA', {
            dept: 'Inyeccion',
            machine: 'Maquina inyectora de plastico',
            prodChar: 'Llenado completo, sin rebaba, geometria conforme',
            prodSC: 'SC',
            procChar: 'Presion, Temperatura, Tiempo de ciclo',
            procSC: 'SC',
        }),
        mkStep('', 'decision', 'ESTA OK LA PIEZA?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Pieza inyectada defectuosa',
            notes: 'SI: continua a adhesivado. NO: scrap',
        }),

        // ── 20 Adhesivado Hot Melt + Decision ──
        mkStep('20', 'operation', 'ADHESIVADO HOT MELT', {
            dept: 'Adhesivado',
            machine: 'Pistola Hot Melt',
            prodChar: 'Adhesion completa y uniforme',
            prodSC: 'SC',
            procChar: 'Temperatura adhesivo, cantidad aplicada',
            procSC: 'SC',
        }),
        mkStep('', 'decision', 'ESTA OK LA PIEZA?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Defecto de adhesivado',
            notes: 'SI: continua a IMG. NO: scrap',
        }),

        // ── 30 Proceso IMG (Termoformado) + Decision ──
        mkStep('30', 'operation', 'PROCESO DE IMG (TERMOFORMADO)', {
            dept: 'IMG',
            machine: 'Maquina de termoformado IMG',
            prodChar: 'Conformidad de forma y textura superficial',
            prodSC: 'CC',
            procChar: 'Temperatura, presion, tiempo de ciclo',
            procSC: 'SC',
        }),
        mkStep('', 'decision', 'ESTA OK LA PIEZA?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Defecto de termoformado IMG',
            notes: 'SI: continua a trimming. NO: scrap',
        }),

        // ── 40 Trimming / Corte Final + Decision ──
        mkStep('40', 'operation', 'TRIMMING - CORTE FINAL', {
            dept: 'Trimming',
            machine: 'Maquina de trimming / corte',
            prodChar: 'Dimension de corte conforme, bordes limpios',
            prodSC: 'SC',
            procChar: 'Parametros de corte (velocidad, profundidad)',
            procSC: 'SC',
        }),
        mkStep('', 'decision', 'ESTA OK LA PIEZA?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Defecto de trimming/corte',
            notes: 'SI: continua a edge folding. NO: scrap',
        }),

        // ── 50 Edge Folding + Decision ──
        mkStep('50', 'operation', 'EDGE FOLDING', {
            dept: 'Edge Folding',
            machine: 'Maquina de edge folding',
            prodChar: 'Plegado de bordes conforme, sin arrugas',
            prodSC: 'SC',
            procChar: 'Temperatura, presion de plegado',
            procSC: 'SC',
        }),
        mkStep('', 'decision', 'ESTA OK LA PIEZA?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Defecto de edge folding',
            notes: 'SI: continua a soldado refuerzos. NO: scrap',
        }),

        // ── 60 Soldado de Refuerzos Internos + Decision ──
        mkStep('60', 'operation', 'SOLDADO DE REFUERZOS INTERNOS', {
            dept: 'Soldadura',
            machine: 'Soldadora ultrasonido / hot plate',
            prodChar: 'Resistencia de soldadura conforme',
            prodSC: 'SC',
            procChar: 'Tiempo de soldadura, presion, temperatura',
            procSC: 'SC',
        }),
        mkStep('', 'decision', 'ESTA OK LA PIEZA?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Defecto de soldado de refuerzos',
            notes: 'SI: continua a soldado tweeter. NO: scrap',
        }),

        // ── 70 Soldado Tweeter ──
        mkStep('70', 'operation', 'SOLDADO TWEETER', {
            dept: 'Soldadura',
            machine: 'Soldadora ultrasonido',
            prodChar: 'Posicion y fijacion del tweeter conforme',
            prodSC: 'CC',
            procChar: 'Parametros de soldadura',
            procSC: 'SC',
        }),

        // ── Inspeccion Final + Decision ──
        mkStep('', 'inspection', 'INSPECCION FINAL', {
            dept: 'Calidad',
            prodChar: 'Conformidad del producto terminado (visual, dimensional, funcional)',
            prodSC: 'SC',
            procChar: 'Verificacion segun pauta de inspeccion final',
            procSC: 'SC',
        }),
        mkStep('', 'decision', 'ESTA OK LA PIEZA?', {
            dept: 'Calidad',
            rejectDisp: 'scrap',
            scrapDesc: 'SCRAP - Pieza no conforme en inspeccion final',
            notes: 'SI: continua a embalaje. NO: scrap',
        }),

        // ── Embalaje y Salida ──
        mkStep('', 'transport', 'TRASLADO DE PIEZAS AL SECTOR DE PRODUCTO TERMINADO'),
        mkStep('90', 'operation', 'EMBALAJE', {
            dept: 'Embalaje',
            prodChar: 'Integridad fisica y trazabilidad (etiquetado correcto)',
            prodSC: 'SC',
        }),
        mkStep('', 'inspection', 'CONTROL DE LAS CANTIDADES DE DESPACHO', {
            dept: 'Logistica',
            procChar: 'Verificacion de cantidades vs orden de despacho',
        }),
        mkStep('', 'storage', 'ALMACENADO EN SECTOR DE PRODUCTO TERMINADO', {
            dept: 'Almacen PT',
        }),
    ];
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update a PFD document's steps in Supabase
 */
async function updatePfdSteps(pfdId, docNumber, newSteps, logPrefix) {
    // Load existing doc
    const rows = await selectSql(
        `SELECT data FROM pfd_documents WHERE id = ?`,
        [pfdId]
    );
    if (rows.length === 0) {
        console.log(`  ${logPrefix} ERROR: PFD not found (id=${pfdId})`);
        return false;
    }

    const doc = JSON.parse(rows[0].data);
    const oldStepCount = doc.steps.length;
    const oldDecisions = doc.steps.filter(s => s.stepType === 'decision').length;
    const oldReworks = doc.steps.filter(s => s.isRework).length;
    const oldScraps = doc.steps.filter(s => s.rejectDisposition === 'scrap').length;

    // Replace steps
    doc.steps = newSteps;
    doc.updatedAt = new Date().toISOString();

    const newDecisions = newSteps.filter(s => s.stepType === 'decision').length;
    const newReworks = newSteps.filter(s => s.isRework).length;
    const newScraps = newSteps.filter(s => s.rejectDisposition === 'scrap').length;

    const dataJson = JSON.stringify(doc);
    const checksum = sha256(dataJson);

    await execSql(
        `UPDATE pfd_documents SET data = ?, checksum = ?, step_count = ? WHERE id = ?`,
        [dataJson, checksum, newSteps.length, pfdId]
    );

    console.log(`  ${logPrefix} UPDATED: ${docNumber}`);
    console.log(`    Steps: ${oldStepCount} → ${newSteps.length}`);
    console.log(`    Decisions: ${oldDecisions} → ${newDecisions}`);
    console.log(`    Reworks: ${oldReworks} → ${newReworks}`);
    console.log(`    Scraps: ${oldScraps} → ${newScraps}`);
    return true;
}

/**
 * Fix decision steps in a PFD by adding notes/rejectDisposition where missing
 */
async function fixDecisionNotes(pfdId, docNumber, logPrefix) {
    const rows = await selectSql(
        `SELECT data FROM pfd_documents WHERE id = ?`,
        [pfdId]
    );
    if (rows.length === 0) {
        console.log(`  ${logPrefix} ERROR: PFD not found (id=${pfdId})`);
        return false;
    }

    const doc = JSON.parse(rows[0].data);
    let fixed = 0;

    for (const step of doc.steps) {
        if (step.stepType === 'decision' && step.rejectDisposition === 'none' && !step.notes) {
            // Check what comes after this decision — look for scrap/rework steps
            const idx = doc.steps.indexOf(step);
            const nextSteps = doc.steps.slice(idx + 1, idx + 5);
            const hasScrap = nextSteps.some(s => s.rejectDisposition === 'scrap');
            const hasRework = nextSteps.some(s => s.isRework);

            if (hasScrap && hasRework) {
                step.notes = 'SI: continua flujo. NO: clasificacion → reproceso o scrap';
            } else if (hasScrap) {
                step.notes = 'SI: continua flujo. NO: clasificacion → scrap';
            } else if (hasRework) {
                step.notes = 'SI: continua flujo. NO: reproceso';
            } else {
                step.notes = 'SI: continua flujo. NO: segregacion de producto no conforme';
            }
            fixed++;
        }
    }

    if (fixed === 0) {
        console.log(`  ${logPrefix} ${docNumber}: No decisions to fix`);
        return false;
    }

    doc.updatedAt = new Date().toISOString();
    const dataJson = JSON.stringify(doc);
    const checksum = sha256(dataJson);

    await execSql(
        `UPDATE pfd_documents SET data = ?, checksum = ? WHERE id = ?`,
        [dataJson, checksum, pfdId]
    );

    console.log(`  ${logPrefix} FIXED: ${docNumber} — ${fixed} decision(s) now have NG path notes`);
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('================================================================');
    console.log('  FIX: PFD NG Disposition Paths');
    console.log('================================================================\n');

    await initSupabase();

    // ── Load all PFDs ──
    const allPfds = await selectSql(
        `SELECT id, document_number, part_name, step_count FROM pfd_documents ORDER BY document_number`
    );
    console.log(`  Found ${allPfds.length} PFDs\n`);

    // ── 1. REBUILD Insert Master ──────────────────────────────────────────
    console.log('──────────────────────────────────────────────────────────────');
    console.log('  1. REBUILD: Insert Master (PFD-INS-001)');
    console.log('──────────────────────────────────────────────────────────────');

    const insertMaster = allPfds.find(p => p.document_number === 'PFD-INS-001');
    if (insertMaster) {
        const newSteps = buildInsertPfdSteps();
        await updatePfdSteps(insertMaster.id, 'PFD-INS-001', newSteps, '[INSERT-M]');
    } else {
        console.log('  [INSERT-M] NOT FOUND: PFD-INS-001');
    }

    // ── 2. REBUILD Insert L0 Variant ─────────────────────────────────────
    console.log('\n──────────────────────────────────────────────────────────────');
    console.log('  2. REBUILD: Insert L0 Variant (PFD-INS-001-L0)');
    console.log('──────────────────────────────────────────────────────────────');

    const insertL0 = allPfds.find(p => p.document_number === 'PFD-INS-001-L0');
    if (insertL0) {
        const newSteps = buildInsertPfdSteps(); // Same process as master
        await updatePfdSteps(insertL0.id, 'PFD-INS-001-L0', newSteps, '[INSERT-L0]');
    } else {
        console.log('  [INSERT-L0] NOT FOUND: PFD-INS-001-L0');
    }

    // ── 3. REBUILD Top Roll ──────────────────────────────────────────────
    console.log('\n──────────────────────────────────────────────────────────────');
    console.log('  3. REBUILD: Top Roll (PFD-TOPROLL-001)');
    console.log('──────────────────────────────────────────────────────────────');

    const topRoll = allPfds.find(p => p.document_number === 'PFD-TOPROLL-001');
    if (topRoll) {
        const newSteps = buildTopRollPfdSteps();
        await updatePfdSteps(topRoll.id, 'PFD-TOPROLL-001', newSteps, '[TOPROLL]');
    } else {
        console.log('  [TOPROLL] NOT FOUND: PFD-TOPROLL-001');
    }

    // ── 4. FIX Headrest Decision Notes ───────────────────────────────────
    console.log('\n──────────────────────────────────────────────────────────────');
    console.log('  4. FIX: Headrest PFDs — Decision notes');
    console.log('──────────────────────────────────────────────────────────────');

    for (const docNum of ['I-IN-002/III-HR-DEL', 'I-IN-002/III-HR-CEN', 'I-IN-002/III-HR-LAT']) {
        const pfd = allPfds.find(p => p.document_number === docNum);
        if (pfd) {
            await fixDecisionNotes(pfd.id, docNum, '[HEADREST]');
        } else {
            console.log(`  [HEADREST] NOT FOUND: ${docNum}`);
        }
    }

    // ── 5. FIX Telas Decision Notes ──────────────────────────────────────
    console.log('\n──────────────────────────────────────────────────────────────');
    console.log('  5. FIX: Telas PFDs — Decision notes');
    console.log('──────────────────────────────────────────────────────────────');

    for (const docNum of ['I-IN-002/III-PLANAS', 'I-IN-002/III-TERMO']) {
        const pfd = allPfds.find(p => p.document_number === docNum);
        if (pfd) {
            await fixDecisionNotes(pfd.id, docNum, '[TELAS]');
        } else {
            console.log(`  [TELAS] NOT FOUND: ${docNum}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RE-AUDIT
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n================================================================');
    console.log('  RE-AUDIT: Verifying all PFDs post-fix');
    console.log('================================================================\n');

    const updatedPfds = await selectSql(
        `SELECT id, document_number, part_name, step_count, data
         FROM pfd_documents ORDER BY document_number`
    );

    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    for (const pfd of updatedPfds) {
        const doc = JSON.parse(pfd.data);
        const steps = doc.steps || [];
        const decisions = steps.filter(s => s.stepType === 'decision');
        const inspections = steps.filter(s => s.stepType === 'inspection');
        const reworks = steps.filter(s => s.isRework);
        const scraps = steps.filter(s => s.rejectDisposition === 'scrap');
        const issues = [];

        if (decisions.length === 0) issues.push('No decisions');
        if (inspections.length === 0) issues.push('No inspections');
        if (reworks.length === 0 && steps.filter(s => s.rejectDisposition === 'rework').length === 0) {
            // Not all processes have rework — only flag if the PDF shows rework
        }
        if (scraps.length === 0) issues.push('No scraps');
        for (const d of decisions) {
            if (d.rejectDisposition === 'none' && !d.notes) {
                issues.push(`Decision "${d.description}" has no NG routing`);
            }
        }

        const status = issues.length === 0 ? 'PASS' :
                       issues.some(i => i === 'No decisions' || i === 'No scraps') ? 'FAIL' : 'WARN';

        if (status === 'PASS') passCount++;
        else if (status === 'WARN') warnCount++;
        else failCount++;

        const icon = status === 'PASS' ? 'OK' : status === 'FAIL' ? 'FAIL' : 'WARN';
        console.log(`  [${icon}] ${pfd.document_number} — ${steps.length} steps, ${decisions.length} dec, ${reworks.length} rwk, ${scraps.length} scr`);
        if (issues.length > 0) {
            for (const i of issues) console.log(`       >> ${i}`);
        }
    }

    console.log('\n================================================================');
    console.log('  SUMMARY');
    console.log('================================================================');
    console.log(`  Total PFDs: ${updatedPfds.length}`);
    console.log(`  PASS: ${passCount}`);
    console.log(`  WARN: ${warnCount}`);
    console.log(`  FAIL: ${failCount}`);
    console.log('================================================================\n');

    close();
}

main().catch((err) => {
    console.error('\n  FATAL ERROR:', err.message);
    console.error(err.stack);
    close();
    process.exit(1);
});

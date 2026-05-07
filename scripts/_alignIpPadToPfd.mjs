/**
 * _alignIpPadToPfd.mjs — Alinear AMFE VWA-PAT-IPPADS-001 con PFD P-IPPAD-001/PRE
 *
 * Cambios (sin eliminar contenido — preserva todas las causas existentes):
 *  - Renombra OP 20 "Inyección" -> "INYECCION DE PIEZAS PLASTICAS" (UPPERCASE)
 *  - Agrega OP 11 CONTROL DE MATERIA PRIMA (TBD, workElements:[])
 *  - Agrega OP 21 INYECCION DE PU (TBD) — sub-op sector inyeccion del PFD
 *  - Agrega OP 31 CONTROL CON MYLAR (TBD)
 *  - Agrega OP 140 RETRABAJO DE PRODUCTO TERMINADO (TBD)
 *  - Renumera OP 140 EMBALAJE -> OP 150
 *  - Marca OP 50 TROQUELADO con _pfdMismatch (PFD nuevo dice INYECCION PU)
 *
 * Sin tocar: OP 10, 20, 30, 40 (REFILADO, 11 causas), 41/42 (COSTURA UNION/VISTA, 25 causas),
 * 50 (TROQUELADO, 11 causas), 60 (ENSAMBLE, 1 causa), 70-130.
 *
 * Run:   node scripts/_alignIpPadToPfd.mjs              (dry-run)
 *        node scripts/_alignIpPadToPfd.mjs --apply      (commit)
 */

import { connectSupabase, readAmfe, saveAmfe, findOperation, countAmfeStats } from './_lib/amfeIo.mjs';
import { parseSafeArgs, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const AMFE_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';
const AMFE_NUMBER = 'VWA-PAT-IPPADS-001';
const PFD_REF = 'P-IPPAD-001/PRE 14/04/2026';

function makeTbdOp(opNumber, name, reason) {
    return {
        opNumber: String(opNumber),
        operationNumber: String(opNumber),
        name,
        operationName: name,
        focusElementFunction: '',
        operationFunction: '',
        workElements: [],
        _status: 'TBD',
        _addedFromPfd: PFD_REF,
        _addedReason: reason,
    };
}

async function main() {
    const { apply } = parseSafeArgs();
    const sb = await connectSupabase();
    const { doc, amfe_number } = await readAmfe(sb, AMFE_ID);
    if (amfe_number !== AMFE_NUMBER) {
        throw new Error(`Guard: amfe_number mismatch (got ${amfe_number}, expected ${AMFE_NUMBER})`);
    }

    const before = JSON.parse(JSON.stringify(doc));
    const beforeStats = countAmfeStats(before);
    console.log(`BEFORE: ${beforeStats.opCount} ops, ${beforeStats.causeCount} causes`);

    // 1. Renombrar OP 20 a UPPERCASE sin acentos
    const op20 = findOperation(doc, '20');
    if (op20 && /Inyección/.test(op20.name || '')) {
        const old = op20.name;
        op20.name = 'INYECCION DE PIEZAS PLASTICAS';
        op20.operationName = 'INYECCION DE PIEZAS PLASTICAS';
        console.log(`  rename OP 20: "${old}" -> "${op20.name}"`);
    }

    // 2. Renumerar OP 140 EMBALAJE -> OP 150 (antes de agregar la nueva OP 140)
    const op140Embalaje = findOperation(doc, '140');
    if (op140Embalaje && /EMBALAJE/i.test(op140Embalaje.name || '')) {
        op140Embalaje.opNumber = '150';
        op140Embalaje.operationNumber = '150';
        console.log(`  renumber EMBALAJE: 140 -> 150 (name: "${op140Embalaje.name}")`);
    }

    // 3. Agregar OPs TBD nuevas (insertar en lugar logico segun numero)
    const tbdOps = [
        makeTbdOp(11, 'CONTROL DE MATERIA PRIMA', 'PFD agrega control intermedio antes de almacenar MP'),
        makeTbdOp(21, 'INYECCION DE PU', 'PFD nuevo muestra OP 50 INYECCION PU; agregamos como sub-op sector inyeccion para no eliminar OP 50 TROQUELADO existente'),
        makeTbdOp(31, 'CONTROL CON MYLAR', 'PFD agrega control post-corte con plantilla mylar'),
        makeTbdOp(140, 'RETRABAJO DE PRODUCTO TERMINADO', 'PFD agrega rama de retrabajo desde OP 130 control final'),
    ];

    for (const newOp of tbdOps) {
        const existing = findOperation(doc, newOp.opNumber);
        if (existing) {
            console.log(`  skip OP ${newOp.opNumber}: ya existe ("${existing.name}")`);
            continue;
        }
        doc.operations.push(newOp);
        console.log(`  add OP ${newOp.opNumber} TBD: "${newOp.name}"`);
    }

    // 4. Marcar OP 50 con _pfdMismatch
    const op50 = findOperation(doc, '50');
    if (op50 && /TROQUELADO/i.test(op50.name || '')) {
        op50._pfdMismatch = 'PFD P-IPPAD-001/PRE muestra OP 50 INYECCION PU. AMFE preserva TROQUELADO DE ESPUMAS por contenido existente (11 causas). Equipo APQP debe consolidar.';
        console.log(`  flag OP 50 con _pfdMismatch (preserva 11 causas troquelado)`);
    }

    // 5. Reordenar operations por opNumber numerico
    doc.operations.sort((a, b) => {
        return parseInt(a.opNumber || a.operationNumber, 10) -
               parseInt(b.opNumber || b.operationNumber, 10);
    });

    const afterStats = countAmfeStats(doc);
    console.log(`AFTER:  ${afterStats.opCount} ops, ${afterStats.causeCount} causes`);
    console.log(`Delta:  +${afterStats.opCount - beforeStats.opCount} ops, ${afterStats.causeCount - beforeStats.causeCount} causes (debe ser 0)`);

    if (afterStats.causeCount !== beforeStats.causeCount) {
        throw new Error(`SAFEGUARD: causeCount cambio (perdimos contenido). before=${beforeStats.causeCount} after=${afterStats.causeCount}`);
    }

    const plan = [{
        id: AMFE_ID,
        amfeNumber: AMFE_NUMBER,
        productName: 'IP PAD',
        before,
        after: doc,
    }];

    await runWithValidation(plan, apply, async () => {
        await saveAmfe(sb, AMFE_ID, doc, {
            expectedAmfeNumber: AMFE_NUMBER,
            extraFields: {
                operation_count: afterStats.opCount,
                cause_count: afterStats.causeCount,
            },
        });
        console.log(`saved AMFE ${AMFE_NUMBER}`);
    }, {
        // Justificacion: las 4 OPs TBD nuevas tienen workElements:[] intencionalmente.
        // El equipo APQP las completa en sesion humana (regla amfe-actions: NO inventar).
        allowNewCritical: true,
    });

    finish(apply);
}

main().catch(e => { console.error(e); process.exit(1); });

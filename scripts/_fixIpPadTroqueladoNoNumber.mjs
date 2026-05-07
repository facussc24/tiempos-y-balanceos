/**
 * _fixIpPadTroqueladoNoNumber.mjs — Corregir alineacion OP 50 IP PAD con PFD
 *
 * Reemplaza la solucion anterior (OP 21 INYECCION PU + OP 50 con _pfdMismatch).
 * Nuevo approach pedido por Fak:
 *   - OP 50 pasa a INYECCION DE PU (TBD vacio) como dice el PFD
 *   - TROQUELADO DE ESPUMAS conserva sus 2 causas pero queda SIN NUMERO
 *     en el orden logico del array (entre OP 50 y OP 60)
 *   - Se elimina OP 21 INYECCION PU (vacia, ya redundante)
 *
 * El orden visual depende de:
 *   1. Posicion en el array de doc.operations (este script)
 *   2. Sort robusto en amfeExcelExport.ts y amfePdfExport.ts (commit acompañante)
 *
 * Run:   node scripts/_fixIpPadTroqueladoNoNumber.mjs              (dry-run)
 *        node scripts/_fixIpPadTroqueladoNoNumber.mjs --apply      (commit)
 */

import { connectSupabase, readAmfe, saveAmfe, countAmfeStats } from './_lib/amfeIo.mjs';
import { parseSafeArgs, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const AMFE_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';
const AMFE_NUMBER = 'VWA-PAT-IPPADS-001';
const PFD_REF = 'P-IPPAD-001/PRE 14/04/2026';

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

    // Helper: localizar op por opNumber
    const findOp = (n) => doc.operations.find(o => String(o.opNumber || o.operationNumber || '').trim() === String(n));

    // 1. Eliminar OP 21 (INYECCION PU vacia que agregue de mas)
    const op21Index = doc.operations.findIndex(o =>
        String(o.opNumber || o.operationNumber || '').trim() === '21' &&
        /INYECCION/i.test(o.name || '') && /PU/i.test(o.name || '') &&
        (o.workElements || []).length === 0
    );
    if (op21Index >= 0) {
        doc.operations.splice(op21Index, 1);
        console.log(`  removed OP 21 INYECCION PU (vacia)`);
    } else {
        console.log(`  OP 21 ya no existe — skip`);
    }

    // 2. Localizar OP 50 actual (TROQUELADO) y extraer su contenido
    const op50 = findOp('50');
    if (!op50) throw new Error('Guard: no encontre OP 50');

    if (!/TROQUELADO/i.test(op50.name || '')) {
        console.log(`  OP 50 ya no es TROQUELADO ("${op50.name}"). Skip transformacion.`);
    } else {
        const troqueladoWEs = op50.workElements || [];
        const troqueladoFEF = op50.focusElementFunction || '';
        const troqueladoOpFn = op50.operationFunction || '';
        console.log(`  extracted ${troqueladoWEs.length} WEs from OP 50 TROQUELADO`);

        // 3. Renombrar OP 50 a INYECCION DE PU (TBD)
        op50.name = 'INYECCION DE PU';
        op50.operationName = 'INYECCION DE PU';
        op50.workElements = [];
        op50.focusElementFunction = '';
        op50.operationFunction = '';
        op50._status = 'TBD';
        op50._addedFromPfd = PFD_REF;
        op50._addedReason = 'OP 50 alineada con PFD (INYECCION PU); contenido tecnico de TROQUELADO movido a OP sin numero';
        // Eliminar flag obsoleto
        delete op50._pfdMismatch;
        console.log(`  OP 50 renamed -> INYECCION DE PU (TBD, workElements:[])`);

        // 4. Crear nueva OP TROQUELADO sin numero, con el contenido extraido
        const newTroquelado = {
            opNumber: '',
            operationNumber: '',
            name: 'TROQUELADO DE ESPUMAS',
            operationName: 'TROQUELADO DE ESPUMAS',
            focusElementFunction: troqueladoFEF,
            operationFunction: troqueladoOpFn,
            workElements: troqueladoWEs,
            _outOfPfd: true,
            _addedReason: `Operacion no presente en PFD ${PFD_REF}; contenido tecnico preservado sin numerar para decision del equipo APQP`,
        };

        // 5. Insertar en el lugar logico del array: despues de OP 50, antes de OP 60
        // (asi el sort estable del export la pone entre 50 y 60)
        const op50Idx = doc.operations.findIndex(o => o === op50);
        doc.operations.splice(op50Idx + 1, 0, newTroquelado);
        console.log(`  inserted TROQUELADO DE ESPUMAS sin numero entre OP 50 y OP 60`);
    }

    // 6. Reordenar TODO el array para que las numeradas queden en orden y las
    //    sin numero conserven su posicion relativa.
    // Algoritmo: indexed-sort estable, parseInt valido al inicio comparando numero,
    //            las sin numero NO se mueven respecto al array original.
    const indexed = doc.operations.map((op, idx) => ({ op, idx }));
    indexed.sort((a, b) => {
        const numA = parseInt(a.op.opNumber || a.op.operationNumber);
        const numB = parseInt(b.op.opNumber || b.op.operationNumber);
        const validA = !isNaN(numA);
        const validB = !isNaN(numB);
        if (validA && validB) return numA - numB;
        return a.idx - b.idx;  // estable: respeta orden array para sin-numero
    });
    doc.operations = indexed.map(x => x.op);

    const afterStats = countAmfeStats(doc);
    console.log(`AFTER:  ${afterStats.opCount} ops, ${afterStats.causeCount} causes`);
    console.log(`Delta:  ${afterStats.opCount - beforeStats.opCount} ops, ${afterStats.causeCount - beforeStats.causeCount} causes (debe ser 0)`);

    if (afterStats.causeCount !== beforeStats.causeCount) {
        throw new Error(`SAFEGUARD: causeCount cambio (perdimos contenido). before=${beforeStats.causeCount} after=${afterStats.causeCount}`);
    }

    // Mostrar el orden final
    console.log('\nORDEN FINAL DEL ARRAY:');
    for (const op of doc.operations) {
        const num = op.opNumber || op.operationNumber || '(sin numero)';
        console.log(`  ${String(num).padStart(15)} | ${op.name} | WEs=${(op.workElements || []).length}`);
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
        // OPs nuevas TBD vacias intencionalmente (regla amfe-actions: NO inventar)
        allowNewCritical: true,
    });

    finish(apply);
}

main().catch(e => { console.error(e); process.exit(1); });

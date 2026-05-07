/**
 * _alignHeadrestsToPfd.mjs — Alinear AMFE-HF-PAT, AMFE-HRC-PAT, AMFE-HRO-PAT
 *                            con PFD P-APO-001/PRE
 *
 * Cambios por cada uno de los 3 AMFEs (sin eliminar contenido):
 *  - Renombra OP 40 "COSTURA 2DA ETAPA" -> "COSTURA VISTA"
 *  - Renombra OP 50 "ESPUMADO" -> "INYECCION DE PU"
 *  - Agrega OP 11 CONTROL DE MATERIA PRIMA (TBD)
 *  - Agrega OP 25 CONTROL CON PLANTILLA MYLAR (TBD)
 *  - Agrega OP 90 REPROCESO: ELIMINACION DE HILO SOBRANTE (TBD)
 *  - Agrega OP 91 REPROCESO: PUNTADA FLOJA (TBD)
 *  - Agrega OP 92 REPROCESO: ELIMINACION DE ARRUGAS EN HORNO (TBD)
 *  - Renumera OP 90 EMBALAJE -> OP 100
 *
 * Run:   node scripts/_alignHeadrestsToPfd.mjs              (dry-run)
 *        node scripts/_alignHeadrestsToPfd.mjs --apply      (commit)
 */

import { connectSupabase, readAmfe, saveAmfe, findOperation, countAmfeStats } from './_lib/amfeIo.mjs';
import { parseSafeArgs, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const HEADRESTS = [
    { id: '10eaebce-ad87-4035-9343-3e20e4ee0fc9', amfeNumber: 'AMFE-HF-PAT',  productName: 'Headrest Front Patagonia' },
    { id: 'e9320798-ceaa-4623-97e9-92200b5234b6', amfeNumber: 'AMFE-HRC-PAT', productName: 'Headrest Rear Center Patagonia' },
    { id: 'beda6d47-30ae-4d5f-81e0-468be8950014', amfeNumber: 'AMFE-HRO-PAT', productName: 'Headrest Rear Outer Patagonia' },
];
const PFD_REF = 'P-APO-001/PRE 04/05/2026';

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

const TBD_OPS = [
    makeTbdOp(11, 'CONTROL DE MATERIA PRIMA', 'PFD agrega control de MP antes de almacenar'),
    makeTbdOp(25, 'CONTROL CON PLANTILLA MYLAR', 'PFD agrega control post-corte con plantilla'),
    makeTbdOp(90, 'REPROCESO: ELIMINACION DE HILO SOBRANTE', 'PFD agrega rama de reproceso post-control final'),
    makeTbdOp(91, 'REPROCESO: PUNTADA FLOJA', 'idem'),
    makeTbdOp(92, 'REPROCESO: ELIMINACION DE ARRUGAS EN HORNO', 'idem'),
];

function transformHeadrest(doc) {
    const before = JSON.parse(JSON.stringify(doc));

    // 1. Renombrar OP 40 -> COSTURA VISTA
    const op40 = findOperation(doc, '40');
    if (op40 && /COSTURA\s*2DA/i.test(op40.name || '')) {
        op40.name = 'COSTURA VISTA';
        op40.operationName = 'COSTURA VISTA';
    }

    // 2. Renombrar OP 50 -> INYECCION DE PU
    const op50 = findOperation(doc, '50');
    if (op50 && /ESPUMADO/i.test(op50.name || '')) {
        op50.name = 'INYECCION DE PU';
        op50.operationName = 'INYECCION DE PU';
    }

    // 3. Renumerar OP 90 EMBALAJE -> OP 100 (ANTES de agregar OPs 90/91/92)
    const op90Embalaje = findOperation(doc, '90');
    if (op90Embalaje && /EMBALAJE/i.test(op90Embalaje.name || '')) {
        op90Embalaje.opNumber = '100';
        op90Embalaje.operationNumber = '100';
    }

    // 4. Agregar OPs TBD nuevas (despues del rename para que 90/91/92 esten libres)
    for (const tmpl of TBD_OPS) {
        const newOp = JSON.parse(JSON.stringify(tmpl));
        const existing = findOperation(doc, newOp.opNumber);
        if (existing) {
            // Si ya existe (caso del que recien renumeramos), skip
            continue;
        }
        doc.operations.push(newOp);
    }

    // 5. Reordenar
    doc.operations.sort((a, b) => {
        return parseInt(a.opNumber || a.operationNumber, 10) -
               parseInt(b.opNumber || b.operationNumber, 10);
    });

    return before;
}

async function main() {
    const { apply } = parseSafeArgs();
    const sb = await connectSupabase();

    const plan = [];
    const docsToCommit = [];

    for (const target of HEADRESTS) {
        const { doc, amfe_number } = await readAmfe(sb, target.id);
        if (amfe_number !== target.amfeNumber) {
            throw new Error(`Guard: amfe_number mismatch ${target.id}: got ${amfe_number}`);
        }
        const beforeStats = countAmfeStats(doc);
        const before = transformHeadrest(doc);
        const afterStats = countAmfeStats(doc);

        console.log(`[${target.amfeNumber}] ${beforeStats.opCount} -> ${afterStats.opCount} ops, causes preservadas: ${afterStats.causeCount === beforeStats.causeCount ? 'OK' : 'CAMBIO!'}`);

        if (afterStats.causeCount !== beforeStats.causeCount) {
            throw new Error(`SAFEGUARD ${target.amfeNumber}: causeCount cambio (${beforeStats.causeCount} -> ${afterStats.causeCount})`);
        }

        plan.push({
            id: target.id,
            amfeNumber: target.amfeNumber,
            productName: target.productName,
            before,
            after: doc,
        });
        docsToCommit.push({ id: target.id, doc, expectedAmfeNumber: target.amfeNumber, opCount: afterStats.opCount, causeCount: afterStats.causeCount });
    }

    await runWithValidation(plan, apply, async () => {
        for (const c of docsToCommit) {
            await saveAmfe(sb, c.id, c.doc, {
                expectedAmfeNumber: c.expectedAmfeNumber,
                extraFields: {
                    operation_count: c.opCount,
                    cause_count: c.causeCount,
                },
            });
            console.log(`saved ${c.expectedAmfeNumber}`);
        }
    }, {
        allowNewCritical: true,  // 5 EMPTY_OP TBD x 3 AMFEs esperados
    });

    finish(apply);
}

main().catch(e => { console.error(e); process.exit(1); });

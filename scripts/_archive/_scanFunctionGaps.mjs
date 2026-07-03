/**
 * _scanFunctionGaps.mjs — READ-ONLY. Escanea TODOS los AMFEs buscando campos
 * de "funcion" vacios:
 *   - op.focusElementFunction  (funcion del item/focus element)
 *   - op.operationFunction     (funcion de la operacion)
 *   - fn.description           (funcion del work element)
 *
 * Tambien reporta we.name, fm.description y cause.description vacios
 * (deberian ser imposibles pero chequeo por las dudas).
 */
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';

const sb = await connectSupabase();
const { data: amfes } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');

const report = {};

function isEmpty(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

for (const row of amfes) {
    const doc = parseData(row.data);
    if (!doc?.operations) continue;

    const amfe = row.amfe_number;
    const gaps = {
        op_fef_empty: [],     // operation focusElementFunction
        op_func_empty: [],    // operation operationFunction
        fn_desc_empty: [],    // function description
        we_name_empty: [],    // work element name
        fm_desc_empty: [],    // failure mode description
        cause_desc_empty: [], // cause description
    };

    for (const op of doc.operations) {
        const opN = op.opNumber || op.operationNumber;
        const opName = op.name || op.operationName || '';

        // Op-level checks solo si hay WEs (una op vacia es un caso distinto)
        const hasWes = (op.workElements || []).length > 0;
        if (hasWes) {
            if (isEmpty(op.focusElementFunction)) {
                gaps.op_fef_empty.push({ opN, opName });
            }
            if (isEmpty(op.operationFunction)) {
                gaps.op_func_empty.push({ opN, opName });
            }
        }

        for (const we of op.workElements || []) {
            const weName = we.name;
            if (isEmpty(weName)) {
                gaps.we_name_empty.push({ opN, opName, weType: we.type });
            }

            for (const fn of we.functions || []) {
                const fnDesc = fn.description || fn.functionDescription;
                if (isEmpty(fnDesc)) {
                    gaps.fn_desc_empty.push({
                        opN, opName,
                        weName: weName || '(sin nombre)',
                        weType: we.type,
                    });
                }

                for (const fm of fn.failures || []) {
                    if (isEmpty(fm.description)) {
                        gaps.fm_desc_empty.push({
                            opN, opName, weName, fnDesc: fnDesc || '(sin desc)'
                        });
                    }
                    for (const c of fm.causes || []) {
                        if (isEmpty(c.description) && isEmpty(c.cause)) {
                            gaps.cause_desc_empty.push({
                                opN, opName, weName, fmDesc: fm.description
                            });
                        }
                    }
                }
            }
        }
    }

    const total = Object.values(gaps).reduce((s, arr) => s + arr.length, 0);
    if (total > 0) {
        report[amfe] = { project: row.project_name, total, gaps };
    }
}

// === OUTPUT ===
console.log('\n=== SCAN: campos de "funcion" vacios en AMFEs ===\n');

if (Object.keys(report).length === 0) {
    console.log('  [0 AMFEs afectados — perfecto]');
    process.exit(0);
}

console.log('--- Resumen por AMFE ---');
for (const [amfe, { project, total, gaps }] of Object.entries(report).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`\n${amfe.padEnd(25)} ${total.toString().padStart(4)} gaps total  (${project})`);
    for (const [type, items] of Object.entries(gaps)) {
        if (items.length === 0) continue;
        console.log(`  ${items.length.toString().padStart(4)}  ${type}`);
    }
}

console.log('\n--- Agregado por tipo ---');
const byType = {};
for (const { gaps } of Object.values(report)) {
    for (const [type, items] of Object.entries(gaps)) {
        byType[type] = (byType[type] || 0) + items.length;
    }
}
for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    if (count > 0) console.log(`  ${count.toString().padStart(4)}  ${type}`);
}

console.log('\n--- Detalle por AMFE (primeros 15 gaps c/u) ---');
for (const [amfe, { gaps }] of Object.entries(report)) {
    const flatGaps = [];
    for (const [type, items] of Object.entries(gaps)) {
        for (const item of items) flatGaps.push({ type, ...item });
    }
    if (flatGaps.length === 0) continue;

    console.log(`\n${amfe}:`);
    for (const g of flatGaps.slice(0, 15)) {
        let loc = `OP${g.opN} "${g.opName}"`;
        if (g.weName) loc += ` / WE="${g.weName}"`;
        if (g.weType) loc += ` [${g.weType}]`;
        if (g.fnDesc) loc += ` / FN="${g.fnDesc.slice(0, 30)}"`;
        if (g.fmDesc) loc += ` / FM="${g.fmDesc.slice(0, 30)}"`;
        console.log(`  [${g.type}]  ${loc}`);
    }
    if (flatGaps.length > 15) console.log(`  ... ${flatGaps.length - 15} mas`);
}

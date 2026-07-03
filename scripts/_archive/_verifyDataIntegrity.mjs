/**
 * _verifyDataIntegrity.mjs — READ-ONLY verificacion de integridad de los 11 AMFEs
 *
 * Checks por AMFE:
 *   A. typeof row.data === 'string' (TEXT, no double-serialized)
 *   B. data.operations es Array
 *   C. Cada operation tiene: id, (name||operationName), (opNumber||operationNumber), workElements array
 *   D. Cada cause tiene: id, severity, occurrence, detection, (ap||actionPriority)
 *   E. row.operation_count coincide con data.operations.length
 *   F. row.cause_count coincide con conteo real de causas
 *
 * No modifica nada. Solo lee y reporta.
 */

import { connectSupabase, listAmfes, parseData, countAmfeStats } from './_lib/amfeIo.mjs';

const REQUIRED_CAUSE_FIELDS = ['severity', 'occurrence', 'detection', 'id'];

function checkOperation(op) {
    const problems = [];
    if (!op.id) problems.push('missing op.id');
    const name = op.name || op.operationName;
    if (!name) problems.push('missing op.name/operationName');
    const num = op.opNumber || op.operationNumber;
    if (num === undefined || num === null || num === '') problems.push('missing op.opNumber/operationNumber');
    if (!Array.isArray(op.workElements)) problems.push('workElements not array');
    return problems;
}

function checkCauses(op) {
    const problems = [];
    let totalCauses = 0;
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fm of (fn.failures || [])) {
                for (const cause of (fm.causes || [])) {
                    totalCauses++;
                    for (const f of REQUIRED_CAUSE_FIELDS) {
                        if (cause[f] === undefined || cause[f] === null) {
                            problems.push(`cause ${cause.id || '(no-id)'} missing ${f}`);
                        }
                    }
                    const ap = cause.ap || cause.actionPriority;
                    if (!ap) {
                        problems.push(`cause ${cause.id || '(no-id)'} missing ap/actionPriority`);
                    }
                }
            }
        }
    }
    return { problems, totalCauses };
}

async function main() {
    const sb = await connectSupabase();
    const amfes = await listAmfes(sb);
    console.log(`\nFound ${amfes.length} AMFEs\n`);
    console.log(
        'AMFE'.padEnd(28) +
        'A_TXT'.padEnd(7) +
        'B_OPS'.padEnd(7) +
        'C_OP'.padEnd(6) +
        'D_CS'.padEnd(6) +
        'E_OC'.padEnd(7) +
        'F_CC'.padEnd(7) +
        'opCount/real'.padEnd(14) +
        'causeCount/real'
    );
    console.log('-'.repeat(100));

    let allOk = true;
    const fails = [];

    for (const meta of amfes) {
        const { data: row, error } = await sb.from('amfe_documents')
            .select('id, amfe_number, operation_count, cause_count, data')
            .eq('id', meta.id).single();
        if (error) {
            console.log(`${(meta.amfe_number || meta.id).padEnd(28)}READ ERROR: ${error.message}`);
            allOk = false; continue;
        }

        // A. typeof data === 'string'
        const A = typeof row.data === 'string';

        // parse
        const doc = parseData(row.data);
        // B. operations array
        const B = Array.isArray(doc?.operations);

        // C. op structure
        let C = B;
        const opProblems = [];
        if (B) {
            for (const op of doc.operations) {
                const p = checkOperation(op);
                if (p.length) { C = false; opProblems.push(`op ${op.opNumber || op.operationNumber || op.id || '?'}: ${p.join(', ')}`); }
            }
        }

        // D. causes structure
        let D = B;
        const causeProblems = [];
        let realCauseCount = 0;
        if (B) {
            for (const op of doc.operations) {
                const { problems, totalCauses } = checkCauses(op);
                realCauseCount += totalCauses;
                if (problems.length) {
                    D = false;
                    causeProblems.push(`op ${op.opNumber || op.operationNumber || op.id}: ${problems.slice(0, 3).join(' | ')}${problems.length > 3 ? ` (+${problems.length - 3} more)` : ''}`);
                }
            }
        }

        // E. operation_count column
        const realOpCount = B ? doc.operations.length : 0;
        const E = row.operation_count === realOpCount;

        // F. cause_count column
        const F = row.cause_count === realCauseCount;

        const tag = v => v ? 'OK' : 'FAIL';
        const line =
            (meta.amfe_number || meta.id.slice(0, 8)).padEnd(28) +
            tag(A).padEnd(7) +
            tag(B).padEnd(7) +
            tag(C).padEnd(6) +
            tag(D).padEnd(6) +
            tag(E).padEnd(7) +
            tag(F).padEnd(7) +
            `${row.operation_count}/${realOpCount}`.padEnd(14) +
            `${row.cause_count}/${realCauseCount}`;
        console.log(line);

        if (!A || !B || !C || !D || !E || !F) {
            allOk = false;
            fails.push({
                amfe: meta.amfe_number || meta.id,
                A, B, C, D, E, F,
                opProblems: opProblems.slice(0, 3),
                causeProblems: causeProblems.slice(0, 3),
            });
        }
    }

    console.log('\n' + '='.repeat(100));
    if (allOk) {
        console.log('ALL GREEN — todos los AMFEs pasan checks A..F\n');
    } else {
        console.log(`${fails.length} AMFE(s) con problemas:\n`);
        for (const f of fails) {
            console.log(`\n  ${f.amfe}`);
            if (!f.A) console.log('    A: data NO es string');
            if (!f.B) console.log('    B: operations NO es array');
            if (!f.C) { console.log('    C: operations con campos faltantes:'); f.opProblems.forEach(p => console.log('       - ' + p)); }
            if (!f.D) { console.log('    D: causas con campos faltantes:'); f.causeProblems.forEach(p => console.log('       - ' + p)); }
            if (!f.E) console.log('    E: operation_count NO coincide con real');
            if (!f.F) console.log('    F: cause_count NO coincide con real');
        }
    }
    process.exit(allOk ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(2); });

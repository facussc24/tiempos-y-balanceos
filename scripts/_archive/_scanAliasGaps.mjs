/**
 * _scanAliasGaps.mjs — READ-ONLY. Escanea pares de campos con alias que el
 * schema AMFE usa. Si uno tiene valor y el otro esta vacio, exports/UIs que
 * leen el "otro" muestran celdas vacias aunque el dato real exista.
 *
 * Pares conocidos (ver .claude/rules/amfe.md):
 *   - op.opNumber         <-> op.operationNumber
 *   - op.name             <-> op.operationName
 *   - fn.description      <-> fn.functionDescription
 *   - cause.cause         <-> cause.description
 *   - cause.ap            <-> cause.actionPriority
 */
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';

const sb = await connectSupabase();
const { data: amfes } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');

const ALIAS_PAIRS = [
    { entity: 'op',    a: 'opNumber',    b: 'operationNumber' },
    { entity: 'op',    a: 'name',        b: 'operationName' },
    { entity: 'fn',    a: 'description', b: 'functionDescription' },
    { entity: 'cause', a: 'cause',       b: 'description' },
    { entity: 'cause', a: 'ap',          b: 'actionPriority' },
];

function isEmpty(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

const report = {};

for (const row of amfes) {
    const doc = parseData(row.data);
    if (!doc?.operations) continue;
    const gaps = [];

    for (const op of doc.operations) {
        // op-level aliases
        for (const pair of ALIAS_PAIRS.filter(p => p.entity === 'op')) {
            const vA = op[pair.a], vB = op[pair.b];
            if (isEmpty(vA) && !isEmpty(vB)) gaps.push({ entity: 'op', pair, missingField: pair.a, op });
            else if (!isEmpty(vA) && isEmpty(vB)) gaps.push({ entity: 'op', pair, missingField: pair.b, op });
        }

        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const pair of ALIAS_PAIRS.filter(p => p.entity === 'fn')) {
                    const vA = fn[pair.a], vB = fn[pair.b];
                    if (isEmpty(vA) && !isEmpty(vB)) gaps.push({ entity: 'fn', pair, missingField: pair.a, op, we, fn });
                    else if (!isEmpty(vA) && isEmpty(vB)) gaps.push({ entity: 'fn', pair, missingField: pair.b, op, we, fn });
                }

                for (const fm of fn.failures || []) {
                    for (const c of fm.causes || []) {
                        for (const pair of ALIAS_PAIRS.filter(p => p.entity === 'cause')) {
                            const vA = c[pair.a], vB = c[pair.b];
                            if (isEmpty(vA) && !isEmpty(vB)) gaps.push({ entity: 'cause', pair, missingField: pair.a, op, we, fn, fm, c });
                            else if (!isEmpty(vA) && isEmpty(vB)) gaps.push({ entity: 'cause', pair, missingField: pair.b, op, we, fn, fm, c });
                        }
                    }
                }
            }
        }
    }

    if (gaps.length > 0) {
        report[row.amfe_number] = { project: row.project_name, gaps };
    }
}

console.log('\n=== SCAN: pares de aliases desincronizados (uno lleno, otro vacio) ===\n');

if (Object.keys(report).length === 0) {
    console.log('  [0 AMFEs afectados]');
    process.exit(0);
}

console.log('--- Por AMFE ---');
for (const [amfe, { project, gaps }] of Object.entries(report).sort((a, b) => b[1].gaps.length - a[1].gaps.length)) {
    console.log(`\n${amfe.padEnd(25)} ${gaps.length.toString().padStart(4)} gaps  (${project})`);
    // Agrupar por campo faltante
    const byField = {};
    for (const g of gaps) {
        const key = `${g.entity}.${g.missingField}`;
        byField[key] = (byField[key] || 0) + 1;
    }
    for (const [field, count] of Object.entries(byField).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${count.toString().padStart(4)}  ${field} vacio`);
    }
}

console.log('\n--- Agregado global ---');
const globalByField = {};
for (const { gaps } of Object.values(report)) {
    for (const g of gaps) {
        const key = `${g.entity}.${g.missingField}`;
        globalByField[key] = (globalByField[key] || 0) + 1;
    }
}
for (const [field, count] of Object.entries(globalByField).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)}  ${field} vacio`);
}

const totalGaps = Object.values(report).reduce((s, r) => s + r.gaps.length, 0);
console.log(`\nTotal: ${totalGaps} gaps en ${Object.keys(report).length} AMFEs de ${amfes.length}`);

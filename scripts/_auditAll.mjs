/**
 * _auditAll.mjs — Auditor proactivo unificado.
 * Corre TODOS los chequeos sobre TODOS los AMFEs de Supabase en un solo comando
 * y reporta un dashboard con todos los hallazgos.
 *
 * Uso:
 *   node scripts/_auditAll.mjs           # reporte completo
 *   node scripts/_auditAll.mjs --summary # solo totales por categoria
 *
 * READ-ONLY, no toca Supabase.
 *
 * Que chequea:
 *   1. Estructura (validateAmfeDoc completo — criticos y warnings)
 *   2. Pares de aliases desincronizados (fn.description vs functionDescription, etc)
 *   3. Campos legacy a nivel fm vacios (incluso si la key falta)
 *   4. Campos "export-critical" vacios en cause/fm
 *   5. Metadata stored vs real (operation_count, cause_count)
 *   6. Campos de header faltantes
 */
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';
import { validateAmfeDoc } from './_lib/amfeValidator.mjs';

const SUMMARY = process.argv.includes('--summary');

// Campos que el export Excel/PDF lee estrictamente y DEBEN tener valor
// cuando hay causas con datos. Extraidos de amfeExcelExport.ts.
const EXPORT_CRITICAL_FM = ['severity', 'occurrence', 'detection'];
const EXPORT_CRITICAL_CAUSE = ['cause', 'preventionControl', 'occurrence', 'detectionControl', 'detection', 'ap'];

// Pares de aliases del schema AMFE.
const ALIAS_PAIRS = [
    { entity: 'op',    a: 'opNumber',    b: 'operationNumber' },
    { entity: 'op',    a: 'name',        b: 'operationName' },
    { entity: 'fn',    a: 'description', b: 'functionDescription' },
    { entity: 'cause', a: 'cause',       b: 'description' },
    { entity: 'cause', a: 'ap',          b: 'actionPriority' },
];

// Campos header de AMFE que no deberian quedar vacios.
// Nota: amfeNumber vive en row.amfe_number (columna Supabase), NO en doc.header.
// responsible tiene aliases aceptables (processResponsible, elaboratedBy).
// partNumber/applicableParts no aplican a maestros (families de proceso).
const HEADER_REQUIRED = [
    'organization', 'client',
    'approvedBy', 'reviewedBy', 'rev',
];
const HEADER_REQUIRED_NON_MASTER = [
    'partNumber', 'applicableParts',
];
const HEADER_RESPONSIBLE_ALIASES = [
    'responsible', 'processResponsible', 'responsibleEngineer', 'elaboratedBy',
];

function isEmpty(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ||
           (typeof v === 'number' && v === 0);
}

function isEmptyStr(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

const sb = await connectSupabase();
const { data: amfes } = await sb.from('amfe_documents').select('id, amfe_number, project_name, operation_count, cause_count, data');

const report = {};

for (const row of amfes) {
    const doc = parseData(row.data);
    if (!doc?.operations) {
        report[row.amfe_number] = { error: 'data no parseable', project: row.project_name };
        continue;
    }

    const findings = {
        structural_critical: [],
        structural_warning: [],
        alias_desync: [],
        fm_sod_missing: [],
        export_critical_empty: [],
        header_missing: [],
        metadata_desync: [],
    };

    // 1. Validator completo
    const v = validateAmfeDoc(doc, row.project_name, row.amfe_number);
    findings.structural_critical = v.critical;
    findings.structural_warning = v.warning;

    // 2. Header
    const hdr = doc.header || {};
    const isMaestro = /MAESTRO/i.test(row.project_name || '');
    for (const f of HEADER_REQUIRED) {
        if (isEmptyStr(hdr[f])) findings.header_missing.push(f);
    }
    if (!isMaestro) {
        for (const f of HEADER_REQUIRED_NON_MASTER) {
            if (isEmptyStr(hdr[f])) findings.header_missing.push(f);
        }
    }
    // responsible: OK si alguno de los aliases existe
    const hasAnyResp = HEADER_RESPONSIBLE_ALIASES.some(a => !isEmptyStr(hdr[a]));
    if (!hasAnyResp) findings.header_missing.push(`responsible (ningun alias: ${HEADER_RESPONSIBLE_ALIASES.join('/')})`);

    // 3. Metadata desync
    let realOps = 0, realCauses = 0;
    for (const op of doc.operations) {
        realOps++;
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    realCauses += (fm.causes || []).length;
                }
            }
        }
    }
    if (realOps !== row.operation_count) {
        findings.metadata_desync.push(`operation_count: real=${realOps} stored=${row.operation_count}`);
    }
    if (realCauses !== row.cause_count) {
        findings.metadata_desync.push(`cause_count: real=${realCauses} stored=${row.cause_count}`);
    }

    // 4. Alias desync
    for (const op of doc.operations) {
        for (const pair of ALIAS_PAIRS.filter(p => p.entity === 'op')) {
            const vA = op[pair.a], vB = op[pair.b];
            if (isEmptyStr(vA) !== isEmptyStr(vB)) {
                findings.alias_desync.push(`op.${pair.a}/${pair.b} desync en OP${op.opNumber || op.operationNumber}`);
            }
        }
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const pair of ALIAS_PAIRS.filter(p => p.entity === 'fn')) {
                    const vA = fn[pair.a], vB = fn[pair.b];
                    if (isEmptyStr(vA) !== isEmptyStr(vB)) {
                        findings.alias_desync.push(`fn.${pair.a}/${pair.b} desync en OP${op.opNumber || op.operationNumber}`);
                    }
                }
                for (const fm of fn.failures || []) {
                    // 5. fm S/O/D missing
                    for (const f of EXPORT_CRITICAL_FM) {
                        if (isEmpty(fm[f]) && (fm.causes || []).some(c => c[f] && c[f] !== 0)) {
                            findings.fm_sod_missing.push(`fm.${f} vacio en OP${op.opNumber || op.operationNumber} FM "${(fm.description || '').slice(0, 30)}"`);
                        }
                    }

                    for (const c of fm.causes || []) {
                        for (const pair of ALIAS_PAIRS.filter(p => p.entity === 'cause')) {
                            const vA = c[pair.a], vB = c[pair.b];
                            if (isEmptyStr(vA) !== isEmptyStr(vB)) {
                                findings.alias_desync.push(`cause.${pair.a}/${pair.b} desync en OP${op.opNumber || op.operationNumber}`);
                            }
                        }
                        // 6. Cause export-critical empty
                        for (const f of EXPORT_CRITICAL_CAUSE) {
                            if (isEmpty(c[f])) {
                                // Chequear alias
                                const aliasMap = { cause: 'description', ap: 'actionPriority' };
                                const altVal = aliasMap[f] && c[aliasMap[f]];
                                if (!altVal) {
                                    findings.export_critical_empty.push(`cause.${f} vacio (${(c.description || c.cause || '').slice(0, 30)})`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    const total = Object.values(findings).reduce((s, arr) => s + arr.length, 0);
    report[row.amfe_number] = { project: row.project_name, total, findings };
}

// === OUTPUT ===
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║           AUDITORIA PROACTIVA — TODOS LOS AMFES           ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Resumen global
const totals = {
    structural_critical: 0,
    structural_warning: 0,
    alias_desync: 0,
    fm_sod_missing: 0,
    export_critical_empty: 0,
    header_missing: 0,
    metadata_desync: 0,
};
for (const r of Object.values(report)) {
    if (!r.findings) continue;
    for (const [k, v] of Object.entries(r.findings)) {
        totals[k] += v.length;
    }
}

console.log('GLOBAL:');
for (const [k, v] of Object.entries(totals)) {
    const icon = v === 0 ? '✓' : (k.includes('critical') || k.includes('missing') || k.includes('desync') ? '✗' : '⚠');
    console.log(`  ${icon} ${k.padEnd(25)} ${v}`);
}

const cleanAmfes = Object.entries(report).filter(([_, r]) => r.total === 0);
const dirtyAmfes = Object.entries(report).filter(([_, r]) => r.total > 0);

console.log(`\n  AMFEs limpios: ${cleanAmfes.length} / ${amfes.length}`);
console.log(`  AMFEs con hallazgos: ${dirtyAmfes.length}`);

if (SUMMARY) {
    if (dirtyAmfes.length > 0) {
        console.log('\n--- AMFEs con hallazgos ---');
        for (const [amfe, r] of dirtyAmfes.sort((a, b) => b[1].total - a[1].total)) {
            console.log(`  ${amfe.padEnd(25)} ${r.total.toString().padStart(4)} findings  (${r.project})`);
        }
    }
    process.exit(0);
}

// Detalle por AMFE
if (dirtyAmfes.length > 0) {
    console.log('\n' + '='.repeat(62));
    console.log('DETALLE POR AMFE');
    console.log('='.repeat(62));
    for (const [amfe, r] of dirtyAmfes.sort((a, b) => b[1].total - a[1].total)) {
        console.log(`\n▸ ${amfe}  (${r.project}) — ${r.total} hallazgos`);
        for (const [category, items] of Object.entries(r.findings)) {
            if (items.length === 0) continue;
            console.log(`  • ${category}: ${items.length}`);
            for (const item of items.slice(0, 5)) {
                const display = typeof item === 'string' ? item : `${item.type}: ${item.detail || ''}`.slice(0, 80);
                console.log(`      ${display}`);
            }
            if (items.length > 5) console.log(`      ... ${items.length - 5} mas`);
        }
    }
}

console.log('\n' + '='.repeat(62));
if (Object.values(totals).every(v => v === 0)) {
    console.log('✓ TODO OK — ningun hallazgo en los 11 AMFEs');
} else {
    console.log(`Total hallazgos: ${Object.values(totals).reduce((a, b) => a + b, 0)}`);
    console.log('Correr --summary para ver solo totales.');
}
console.log('='.repeat(62) + '\n');

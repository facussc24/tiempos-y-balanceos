/**
 * _scanLegacyFields.mjs — READ-ONLY. Escanea TODOS los AMFEs buscando campos
 * "legacy" a nivel failure (fm.X) que estan vacios aunque las causas (cause.X)
 * tengan valores. Es el bug que detecto Fak: exports leen fm.X y salen celdas
 * en blanco aunque el dato real existe en cause[].
 *
 * Campos fm-level que tipicamente tienen equivalente en cause[]:
 *   - severity, occurrence, detection (S/O/D)
 *   - ap, actionPriority
 *   - preventionControl, detectionControl
 *   - specialChar, classification
 *   - cause (texto de causa unificado)
 *   - effect (efecto unificado, deprecated en favor de effectLocal/Next/End)
 *   - recommendedActions
 */
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';

const sb = await connectSupabase();
const { data: amfes, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (error) { console.error(error); process.exit(1); }

const LEGACY_FIELDS = [
    'severity', 'occurrence', 'detection',
    'ap', 'actionPriority',
    'preventionControl', 'detectionControl',
    'specialChar', 'classification',
    'cause',  // texto de causa
    'effect', // efecto unificado
    'recommendedActions', 'responsible', 'targetDate', 'status',
];

const globalReport = {};

for (const row of amfes) {
    const doc = parseData(row.data);
    if (!doc?.operations) continue;

    const amfe = row.amfe_number;
    const issues = [];

    for (const op of doc.operations) {
        const opN = op.opNumber || op.operationNumber;
        const opName = op.name || op.operationName;
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    const causes = fm.causes || [];
                    if (causes.length === 0) continue;

                    for (const field of LEGACY_FIELDS) {
                        // Solo nos interesa si la key EXISTE a nivel fm (sino es que nunca estuvo)
                        if (!(field in fm)) continue;

                        const fmVal = fm[field];
                        const fmEmpty = fmVal === '' || fmVal === null || fmVal === undefined ||
                                        (typeof fmVal === 'number' && fmVal === 0);
                        if (!fmEmpty) continue;

                        // Buscar si las causas tienen ese campo con valor
                        let hasCauseValue = false;
                        for (const c of causes) {
                            let v = c[field];
                            // Aliases
                            if (field === 'ap' && !v) v = c.actionPriority;
                            if (field === 'actionPriority' && !v) v = c.ap;
                            if (field === 'cause' && !v) v = c.description;
                            if (v !== undefined && v !== null && v !== '' && v !== 0) {
                                hasCauseValue = true;
                                break;
                            }
                        }

                        if (hasCauseValue) {
                            issues.push({
                                op: `${opN} ${opName}`,
                                fmDesc: fm.description || '',
                                field,
                                fmVal: JSON.stringify(fmVal),
                            });
                        }
                    }
                }
            }
        }
    }

    if (issues.length > 0) {
        globalReport[amfe] = { project: row.project_name, issues };
    }
}

// === Output ===
console.log('\n=== SCAN: campos legacy vacios a nivel failure (con cause con valor) ===\n');

if (Object.keys(globalReport).length === 0) {
    console.log('  [0 AMFEs afectados — todo OK]');
} else {
    // Resumen por AMFE
    console.log('--- AMFEs afectados ---');
    for (const [amfe, { project, issues }] of Object.entries(globalReport)) {
        console.log(`  ${amfe.padEnd(20)} ${issues.length.toString().padStart(4)} gaps  (${project})`);
    }

    // Resumen por campo
    console.log('\n--- Campos afectados (agregado global) ---');
    const byField = {};
    for (const { issues } of Object.values(globalReport)) {
        for (const i of issues) {
            byField[i.field] = (byField[i.field] || 0) + 1;
        }
    }
    for (const [field, count] of Object.entries(byField).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${count.toString().padStart(4)}  fm.${field}`);
    }

    // Detalle por AMFE (primeros 5 gaps cada uno)
    console.log('\n--- Detalle por AMFE ---');
    for (const [amfe, { issues }] of Object.entries(globalReport)) {
        console.log(`\n${amfe}:`);
        for (const i of issues.slice(0, 5)) {
            console.log(`  fm.${i.field}=${i.fmVal}  (OP${i.op}  FM="${i.fmDesc.slice(0, 40)}")`);
        }
        if (issues.length > 5) console.log(`  ... ${issues.length - 5} mas`);
    }
}

// Bonus: cuantos AMFEs tienen AL MENOS UN campo legacy declarado
const allAmfes = amfes.length;
const withAnyLegacy = Object.keys(globalReport).length;
console.log(`\n--- Total ---`);
console.log(`  AMFEs auditados:    ${allAmfes}`);
console.log(`  AMFEs con gaps:     ${withAnyLegacy}`);

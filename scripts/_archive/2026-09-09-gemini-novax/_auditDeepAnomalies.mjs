import { writeFileSync } from 'fs';
import { connectSupabase, readAmfe } from './_lib/amfeIo.mjs';

const sb = await connectSupabase();
const amfes = ['AMFE-INS-PAT', 'AMFE-ARM-PAT', 'AMFE-TR-PAT'];

const results = {};

for (const num of amfes) {
    const { data: row } = await sb.from('amfe_documents').select('id, amfe_number').eq('amfe_number', num).single();
    const { doc } = await readAmfe(sb, row.id);
    const anomalies = [];
    const allH = [];

    for (const op of doc.operations || []) {
        const opNum = op.operationNumber;
        const opName = op.operationName;
        for (const we of op.workElements || []) {
            const weName = we.name;
            const weType = we.type;
            for (const fn of we.functions || []) {
                const fnDesc = fn.description || fn.functionDescription;
                for (const fl of fn.failures || []) {
                    const flDesc = fl.description || fl.failureMode;
                    const sev = fl.severity;
                    for (const c of fl.causes || []) {
                        const cDesc = c.cause || c.description;
                        const occ = c.occurrence;
                        const det = c.detection;
                        const ap = c.ap || c.actionPriority;

                        if (ap === 'H') {
                            allH.push({ opNum, opName, weName, weType, flDesc, cDesc, sev, occ, det, ap });
                        }

                        // Check anomalies
                        const fullStr = `${weName} | ${fnDesc} | ${flDesc} | ${cDesc}`;
                        
                        // Cross-product contamination
                        if (num === 'AMFE-INS-PAT') {
                            if (/sika|melt|img-l|cycolac|dl100|tweeter/i.test(fullStr)) {
                                anomalies.push({ tipo: 'CRUCE_TOP_ROLL_EN_INSERT', opNum, weName, weType, flDesc, cDesc });
                            }
                            if (/poli-plus|iso-plus|dissacol/i.test(fullStr)) {
                                anomalies.push({ tipo: 'CRUCE_ARMREST_EN_INSERT', opNum, weName, weType, flDesc, cDesc });
                            }
                        }
                        if (num === 'AMFE-ARM-PAT') {
                            if (/sika|melt|img-l|cycolac|dl100|tweeter/i.test(fullStr)) {
                                anomalies.push({ tipo: 'CRUCE_TOP_ROLL_EN_ARMREST', opNum, weName, weType, flDesc, cDesc });
                            }
                            if (/fenoclor/i.test(fullStr)) {
                                anomalies.push({ tipo: 'CRUCE_INSERT_EN_ARMREST', opNum, weName, weType, flDesc, cDesc });
                            }
                        }
                        if (num === 'AMFE-TR-PAT') {
                            if (/fenoclor|poli-plus|iso-plus|dissacol|fuller/i.test(fullStr)) {
                                anomalies.push({ tipo: 'CRUCE_INS_ARM_EN_TOP_ROLL', opNum, weName, weType, flDesc, cDesc });
                            }
                        }

                        // Methodological 4M violations: Measurement instruments having material/man failures
                        if (/calibre|micrometro|probeta|instrumento|gabarit/i.test(weName) || weType === 'Measurement') {
                            if (/materia prima|vencimiento|adhesivo|suciedad|proveedor|omisi/i.test(flDesc) || /materia prima|vencimiento|adhesivo|suciedad|proveedor/i.test(cDesc)) {
                                anomalies.push({ tipo: 'VIOLACION_4M_MEDICION_CON_FALLA_MATERIAL_O_MAN', opNum, weName, flDesc, cDesc, ap });
                            }
                        }

                        // Corrupted strings / OCR glitches / Hardcoded numbers
                        if (/mg®|®|\b\d+-\s+[A-Z]/i.test(flDesc) || /mg®|®/i.test(cDesc)) {
                            anomalies.push({ tipo: 'TEXTO_CORRUPTO_O_NUMERACION_HARDCODEADA', opNum, weName, flDesc, cDesc });
                        }
                    }
                }
            }
        }
    }

    results[num] = {
        totalH: allH.length,
        anomaliesCount: anomalies.length,
        anomalies,
        allH,
    };
}

writeFileSync('tmp/amfe_deep_audit_anomalies.json', JSON.stringify(results, null, 2));
console.log('AUDITORIA PROFUNDA COMPLETADA:');
for (const [k, v] of Object.entries(results)) {
    console.log(`\n=== ${k} ===`);
    console.log(`  Total AP=H: ${v.totalH}`);
    console.log(`  Total Anomalías detectadas: ${v.anomaliesCount}`);
    for (const a of v.anomalies.slice(0, 10)) {
        console.log(`    - [${a.tipo}] OP ${a.opNum} | WE: "${a.weName}" | Falla: "${a.flDesc}" | Causa: "${a.cDesc}"`);
    }
    if (v.anomaliesCount > 10) console.log(`    ... y ${v.anomaliesCount - 10} anomalías más.`);
}
process.exit(0);

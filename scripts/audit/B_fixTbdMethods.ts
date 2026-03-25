/**
 * B_fixTbdMethods.ts
 *
 * Fix 7 CP items in INSERT master that have empty evaluationTechnique
 * and controlMethod fields (marked as "TBD" in the audit).
 *
 * 6 items in OP 10 (Recepción MP) + 1 item in OP 100 (Tapizado).
 */
import {
    ensureAuth,
    fetchAllCpDocs,
    backupDoc,
    writeResults,
    normOp,
    updateDocDirect,
} from './supabaseHelper.js';

// ── Method deduction rules ─────────────────────────────────────────────────────

interface MethodFix {
    evaluationTechnique: string;
    controlMethod: string;
}

function deduceMethod(controlDesc: string, opNumber: string): MethodFix {
    const desc = normOp(controlDesc);

    // OP 10: Receiving inspection controls
    if (opNumber === '10') {
        if (desc.includes('color') && desc.includes('hilo')) {
            return {
                evaluationTechnique: 'Visual contra muestra patron',
                controlMethod: 'Inspeccion visual de recepcion',
            };
        }
        if (desc.includes('vencimiento') || desc.includes('fecha')) {
            return {
                evaluationTechnique: 'Visual / Lectura de etiqueta',
                controlMethod: 'Verificacion de certificado y etiqueta',
            };
        }
        if (desc.includes('identificacion') || desc.includes('cinta') || desc.includes('tessa')) {
            return {
                evaluationTechnique: 'Visual / Lectura de etiqueta',
                controlMethod: 'Verificacion de identificacion en recepcion',
            };
        }
        if (desc.includes('color') && (desc.includes('vinilo') || desc.includes('pvc'))) {
            return {
                evaluationTechnique: 'Visual contra muestra patron',
                controlMethod: 'Inspeccion visual de recepcion',
            };
        }
        if (desc.includes('lote') || desc.includes('cycoloy') || desc.includes('pc/abs')) {
            return {
                evaluationTechnique: 'Visual / Lectura de etiqueta',
                controlMethod: 'Verificacion de certificado de lote',
            };
        }
        if (desc.includes('foam') || desc.includes('pu ') || desc.includes('espuma')) {
            return {
                evaluationTechnique: 'Visual / Lectura de etiqueta',
                controlMethod: 'Verificacion de identificacion en recepcion',
            };
        }
        // Default for receiving
        return {
            evaluationTechnique: 'Visual / Lectura de etiqueta',
            controlMethod: 'Inspeccion visual en recepcion',
        };
    }

    // OP 100: Temperature control
    if (opNumber === '100' && (desc.includes('temperatura') || desc.includes('rango'))) {
        return {
            evaluationTechnique: 'Termometro infrarrojo / Pirometro',
            controlMethod: 'Medicion de temperatura segun parametros de proceso',
        };
    }

    // Default
    return {
        evaluationTechnique: 'Visual / Segun instruccion de proceso',
        controlMethod: 'Autocontrol del operador',
    };
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface FixLog {
    product: string;
    docId: string;
    opNumber: string;
    operation: string;
    control: string;
    evaluationTechnique: string;
    controlMethod: string;
}

async function main() {
    console.log('=== Script B: Fix 7 TBD evaluation methods in CP ===\n');
    await ensureAuth();

    console.log('Loading CP documents...');
    const cpDocs = await fetchAllCpDocs();
    console.log(`  Loaded ${cpDocs.length} CP docs\n`);

    const logs: FixLog[] = [];
    let totalFixed = 0;

    for (const cp of cpDocs) {
        const doc = cp.parsed;
        const projectName = String(cp.raw.project_name || '');
        let docFixed = 0;

        for (const item of doc.items || []) {
            const evalEmpty = !item.evaluationTechnique || item.evaluationTechnique.trim() === '' || item.evaluationTechnique.trim().toUpperCase() === 'TBD';
            const methodEmpty = !item.controlMethod || item.controlMethod.trim() === '' || item.controlMethod.trim().toUpperCase() === 'TBD';

            if (evalEmpty || methodEmpty) {
                // Build a description from available fields for matching
                const controlDesc = [
                    item.productCharacteristic || '',
                    item.processCharacteristic || '',
                    item.specification || '',
                ].join(' ');

                const fix = deduceMethod(controlDesc, item.processStepNumber || '');

                if (evalEmpty) {
                    item.evaluationTechnique = fix.evaluationTechnique;
                }
                if (methodEmpty) {
                    item.controlMethod = fix.controlMethod;
                }

                logs.push({
                    product: projectName,
                    docId: cp.id,
                    opNumber: item.processStepNumber || '',
                    operation: item.processDescription || '',
                    control: controlDesc.trim().substring(0, 100),
                    evaluationTechnique: fix.evaluationTechnique,
                    controlMethod: fix.controlMethod,
                });

                docFixed++;
                totalFixed++;
            }
        }

        if (docFixed > 0) {
            console.log(`  [${projectName}] Fixed ${docFixed} TBD methods`);
            backupDoc('cp_documents', cp.id, cp.raw.data as string);
            await updateDocDirect('cp_documents', cp.id, JSON.stringify(doc), {
                item_count: (doc.items || []).length,
            });
        }
    }

    console.log(`\n════════════════════════════════════════════════════`);
    console.log(`  TOTAL: ${totalFixed} TBD methods fixed`);
    console.log(`════════════════════════════════════════════════════\n`);

    writeResults('B_fixTbdMethods.json', {
        timestamp: new Date().toISOString(),
        summary: { totalFixed },
        corrections: logs,
    });

    console.log('Done.');
}

main().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});

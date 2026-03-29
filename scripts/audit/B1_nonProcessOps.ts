/**
 * B1_nonProcessOps.ts
 *
 * Audit: Find operations across PFD/AMFE/CP/HO that are NOT real manufacturing
 * processes (administrative docs, intermediate storage, internal transport, etc.)
 * and flag them — especially when they have quality controls defined.
 */
import {
    ensureAuth,
    fetchAllPfdDocs,
    fetchAllAmfeDocs,
    fetchAllCpDocs,
    fetchAllHoDocs,
    writeResults,
} from './supabaseHelper.js';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Finding {
    product: string;
    docType: 'PFD' | 'AMFE' | 'CP' | 'HO';
    docId: string;
    operation: string;
    opNumber: string;
    reason: string;
    hasControls: boolean;
    controlCount: number;
}

interface SuspiciousCombined {
    product: string;
    docType: 'PFD' | 'AMFE' | 'CP' | 'HO';
    docId: string;
    operation: string;
    opNumber: string;
    realPart: string;
    storagePart: string;
    note: string;
}

// ── Inline detection (from processCategory.ts patterns, not imported) ──────

function isNonProcessOp(name: string): { isNonProcess: boolean; reason: string } {
    const n = (name || '').toLowerCase();

    // Remito / administrative documents as internal operations
    if (/\bremito\b|\border(en)?\s+(de\s+)?producci[oó]n\b|\bnota\s+de\s+entrega\b/.test(n)) {
        // Exception: in Recepción de MP, remito is valid as supplier document check
        if (/recep/i.test(n)) return { isNonProcess: false, reason: '' };
        return {
            isNonProcess: true,
            reason: 'Documento administrativo usado como operación de proceso. Un remito/orden solo aplica en Recepción de MP como documento del proveedor.',
        };
    }

    // Intermediate storage as process operation
    if (
        /\balmacenamiento\s+intermedio\b|\bstock\s+(en\s+)?proceso\b|\bwip\b|\bwork.in.process\b|\ben\s+proceso\b/.test(n) &&
        !/recep/i.test(n)
    ) {
        return {
            isNonProcess: true,
            reason: 'Almacenamiento intermedio no es una operación productiva. No transforma ni inspecciona el producto.',
        };
    }

    // Internal transport as process operation
    if (/\btransporte\s+interno\b|\btraslado\b(?!\s+de\s+mat)/.test(n) && !/recep/i.test(n)) {
        return {
            isNonProcess: true,
            reason: 'Transporte interno no transforma el producto. No debería tener controles de calidad del producto.',
        };
    }

    // General storage/logistics check (broader)
    if (/\balmacen/i.test(n) && !/recep/i.test(n) && !/materia\s+prima/i.test(n)) {
        return {
            isNonProcess: true,
            reason: 'Operación de almacenamiento, no es transformación ni inspección del producto.',
        };
    }

    // Despacho / expedición as operation with controls
    if (/\bdespacho\b|\bexpedici[oó]n\b/.test(n)) {
        return {
            isNonProcess: true,
            reason: 'Despacho/expedición es logística, no transforma ni inspecciona el producto.',
        };
    }

    return { isNonProcess: false, reason: '' };
}

/**
 * Detect combined names like "CORTE DE COMPONENTES - ALMACENAMIENTO EN MEDIOS WIP"
 * where a real process op is concatenated with a storage/transport concept.
 */
function detectCombinedName(name: string): { isCombined: boolean; realPart: string; storagePart: string } {
    const n = (name || '').trim();
    // Look for a separator: " - ", " / ", " + "
    const separators = [' - ', ' / ', ' + '];
    for (const sep of separators) {
        const idx = n.indexOf(sep);
        if (idx > 0) {
            const left = n.slice(0, idx).trim();
            const right = n.slice(idx + sep.length).trim();
            const leftCheck = isNonProcessOp(left);
            const rightCheck = isNonProcessOp(right);
            // One part is process, other is non-process
            if (!leftCheck.isNonProcess && rightCheck.isNonProcess) {
                return { isCombined: true, realPart: left, storagePart: right };
            }
            if (leftCheck.isNonProcess && !rightCheck.isNonProcess) {
                return { isCombined: true, realPart: right, storagePart: left };
            }
        }
    }
    return { isCombined: false, realPart: '', storagePart: '' };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    await ensureAuth();
    console.log('Auth OK — fetching documents...');

    const [pfdDocs, amfeDocs, cpDocs, hoDocs] = await Promise.all([
        fetchAllPfdDocs(),
        fetchAllAmfeDocs(),
        fetchAllCpDocs(),
        fetchAllHoDocs(),
    ]);

    console.log(`Fetched: ${pfdDocs.length} PFD, ${amfeDocs.length} AMFE, ${cpDocs.length} CP, ${hoDocs.length} HO`);

    const findings: Finding[] = [];
    const suspiciousCombined: SuspiciousCombined[] = [];

    // ── 1. Scan PFD ────────────────────────────────────────────────────────

    for (const doc of pfdDocs) {
        const product = `${doc.raw.customer_name || ''}/${doc.raw.part_name || ''}`.replace(/^\//, '');
        const steps = doc.parsed.steps || [];

        for (const step of steps) {
            const name = step.description || step.name || '';
            const stepNum = `Step ${step.stepNumber ?? '?'}`;

            // Check for non-process operations
            const check = isNonProcessOp(name);
            if (check.isNonProcess) {
                // In PFD, flag if stepType is 'operation' (should be 'transport'/'storage')
                const wrongType = step.stepType === 'operation';
                findings.push({
                    product,
                    docType: 'PFD',
                    docId: doc.id,
                    operation: name,
                    opNumber: stepNum,
                    reason: check.reason + (wrongType ? ' Además, stepType es "operation" cuando debería ser "transport" o "storage".' : ''),
                    hasControls: wrongType,
                    controlCount: wrongType ? 1 : 0,
                });
            }

            // Check for combined names
            const combined = detectCombinedName(name);
            if (combined.isCombined) {
                suspiciousCombined.push({
                    product,
                    docType: 'PFD',
                    docId: doc.id,
                    operation: name,
                    opNumber: stepNum,
                    realPart: combined.realPart,
                    storagePart: combined.storagePart,
                    note: 'Nombre combina operación real con almacenamiento/transporte. Deberían ser pasos separados.',
                });
            }
        }
    }

    // ── 2. Scan AMFE ───────────────────────────────────────────────────────

    for (const doc of amfeDocs) {
        const product = (doc.raw.project_name as string) || doc.id;
        const operations = doc.parsed.operations || [];

        for (const op of operations) {
            const name = op.name || '';
            const opNum = `OP ${op.opNumber ?? '?'}`;

            const check = isNonProcessOp(name);
            if (check.isNonProcess) {
                // Count failures and causes defined for this non-process op
                let failureCount = 0;
                let causeCount = 0;
                for (const we of op.workElements || []) {
                    for (const fn of we.functions || []) {
                        for (const f of fn.failures || []) {
                            failureCount++;
                            causeCount += (f.causes || []).length;
                        }
                    }
                }
                const totalControls = failureCount + causeCount;

                findings.push({
                    product,
                    docType: 'AMFE',
                    docId: doc.id,
                    operation: name,
                    opNumber: opNum,
                    reason: check.reason + (totalControls > 0 ? ` Tiene ${failureCount} fallas y ${causeCount} causas definidas en AMFE.` : ''),
                    hasControls: totalControls > 0,
                    controlCount: totalControls,
                });
            }

            // Check for combined names
            const combined = detectCombinedName(name);
            if (combined.isCombined) {
                suspiciousCombined.push({
                    product,
                    docType: 'AMFE',
                    docId: doc.id,
                    operation: name,
                    opNumber: opNum,
                    realPart: combined.realPart,
                    storagePart: combined.storagePart,
                    note: 'Nombre combina operación real con almacenamiento/transporte. Deberían ser pasos separados en AMFE.',
                });
            }
        }
    }

    // ── 3. Scan CP ─────────────────────────────────────────────────────────

    for (const doc of cpDocs) {
        const product = (doc.raw.project_name as string) || doc.id;
        const items = doc.parsed.items || [];

        for (const item of items) {
            const name = item.processDescription || '';
            const stepNum = `OP ${item.processStepNumber ?? '?'}`;

            const check = isNonProcessOp(name);
            if (check.isNonProcess) {
                // In CP, having any item IS having controls
                findings.push({
                    product,
                    docType: 'CP',
                    docId: doc.id,
                    operation: name,
                    opNumber: stepNum,
                    reason: check.reason + ' Este ítem del Plan de Control define controles de calidad para una operación no productiva.',
                    hasControls: true,
                    controlCount: 1,
                });
            }

            // Check for combined names
            const combined = detectCombinedName(name);
            if (combined.isCombined) {
                suspiciousCombined.push({
                    product,
                    docType: 'CP',
                    docId: doc.id,
                    operation: name,
                    opNumber: stepNum,
                    realPart: combined.realPart,
                    storagePart: combined.storagePart,
                    note: 'Nombre combina operación real con almacenamiento/transporte. Controles podrían estar mal asignados.',
                });
            }
        }
    }

    // ── 4. Scan HO ─────────────────────────────────────────────────────────

    for (const doc of hoDocs) {
        const product = (doc.raw.linked_amfe_project as string) || (doc.raw.part_description as string) || doc.id;
        const sheets = doc.parsed.sheets || [];

        for (const sheet of sheets) {
            const name = sheet.title || '';
            const sheetNum = `Sheet ${sheet.sheetNumber ?? '?'}`;

            const check = isNonProcessOp(name);
            if (check.isNonProcess) {
                const qcCount = (sheet.qualityChecks || []).length;
                const stepCount = (sheet.steps || []).length;
                const totalControls = qcCount + stepCount;

                findings.push({
                    product,
                    docType: 'HO',
                    docId: doc.id,
                    operation: name,
                    opNumber: sheetNum,
                    reason: check.reason + (qcCount > 0 ? ` Tiene ${qcCount} controles de calidad y ${stepCount} pasos TWI definidos.` : ''),
                    hasControls: qcCount > 0,
                    controlCount: totalControls,
                });
            }

            // Check for combined names
            const combined = detectCombinedName(name);
            if (combined.isCombined) {
                suspiciousCombined.push({
                    product,
                    docType: 'HO',
                    docId: doc.id,
                    operation: name,
                    opNumber: sheetNum,
                    realPart: combined.realPart,
                    storagePart: combined.storagePart,
                    note: 'Nombre combina operación real con almacenamiento/transporte en HO.',
                });
            }
        }
    }

    // ── Summary ────────────────────────────────────────────────────────────

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  B1: NON-PROCESS OPERATIONS AUDIT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Group findings by product
    const byProduct = new Map<string, Finding[]>();
    for (const f of findings) {
        const arr = byProduct.get(f.product) || [];
        arr.push(f);
        byProduct.set(f.product, arr);
    }

    const withControls = findings.filter(f => f.hasControls);
    const withoutControls = findings.filter(f => !f.hasControls);

    console.log(`Total findings: ${findings.length}`);
    console.log(`  With controls (higher priority): ${withControls.length}`);
    console.log(`  Without controls (informational): ${withoutControls.length}`);
    console.log(`Suspicious combined names: ${suspiciousCombined.length}`);
    console.log(`Products affected: ${byProduct.size}\n`);

    // Print findings with controls first (most important)
    if (withControls.length > 0) {
        console.log('── FINDINGS WITH CONTROLS (ACTION REQUIRED) ──────────────────\n');
        for (const f of withControls) {
            console.log(`  [${f.docType}] ${f.product}`);
            console.log(`    ${f.opNumber}: "${f.operation}"`);
            console.log(`    Controls: ${f.controlCount}`);
            console.log(`    Reason: ${f.reason}`);
            console.log();
        }
    }

    if (withoutControls.length > 0) {
        console.log('── FINDINGS WITHOUT CONTROLS (INFORMATIONAL) ──────────────────\n');
        for (const f of withoutControls) {
            console.log(`  [${f.docType}] ${f.product}`);
            console.log(`    ${f.opNumber}: "${f.operation}"`);
            console.log(`    Reason: ${f.reason}`);
            console.log();
        }
    }

    if (suspiciousCombined.length > 0) {
        console.log('── SUSPICIOUS COMBINED NAMES ───────────────────────────────────\n');
        for (const s of suspiciousCombined) {
            console.log(`  [${s.docType}] ${s.product}`);
            console.log(`    ${s.opNumber}: "${s.operation}"`);
            console.log(`    Real part: "${s.realPart}"`);
            console.log(`    Storage part: "${s.storagePart}"`);
            console.log(`    Note: ${s.note}`);
            console.log();
        }
    }

    // Write results
    const results = {
        timestamp: new Date().toISOString(),
        summary: {
            totalFindings: findings.length,
            withControls: withControls.length,
            withoutControls: withoutControls.length,
            suspiciousCombinedNames: suspiciousCombined.length,
            productsAffected: byProduct.size,
            byDocType: {
                PFD: findings.filter(f => f.docType === 'PFD').length,
                AMFE: findings.filter(f => f.docType === 'AMFE').length,
                CP: findings.filter(f => f.docType === 'CP').length,
                HO: findings.filter(f => f.docType === 'HO').length,
            },
        },
        findings,
        suspiciousCombined,
    };

    writeResults('B1_nonProcessOps.json', results);

    console.log('\nDone.');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});

/**
 * B2_nonsensicalControls.ts
 * Detects nonsensical, placeholder, or overly generic controls in CP and HO documents.
 *
 * Rules:
 *   R1 - Documentation/traceability controls in non-reception operations
 *   R2 - Dimensional controls in non-dimensional operations
 *   R3 - Duplicate visual controls across >50% of operations in a CP
 *   R4 - TBD/empty methods (evaluationTechnique, controlMethod, specification)
 *   R5 - Generic specifications without concrete values
 *   R6 - Same patterns (R1, R4, R5) applied to HO quality checks
 */

import {
    ensureAuth,
    fetchAllCpDocs,
    fetchAllHoDocs,
    fetchAllAmfeDocs,
    normOp,
    writeResults,
} from './supabaseHelper.js';

// ── Types ──

interface Finding {
    product: string;
    docType: 'CP' | 'HO';
    docId: string;
    operation: string;
    opNumber: string;
    control: string;
    specification: string;
    method: string;
    rule: string;
    reason: string;
}

// ── Regex patterns ──

const RE_TRACEABILITY = /remito|trazabilidad|lote|documentaci[oó]n|identificaci[oó]n|registro/i;
const RE_RECEPTION = /recepci[oó]n|recep\b/i;

const RE_DIMENSIONAL_CONTROL = /dimensi[oó]n|calibre|cmm|medici[oó]n\s+dimensional|cota|tolerancia\s+dimensional/i;
const RE_NON_DIMENSIONAL_OP = /costur|tapizad|embalaj|almacen|transport|limpiez/i;

const RE_VISUAL = /visual|aspecto/i;

const RE_TBD = /^(tbd|a\s+definir|por\s+definir|pendiente|n\/?a)$/i;

// Generic spec patterns — valid only if they do NOT reference a specific document
const GENERIC_SPECS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /^conforme\s+a\s+especificaci[oó]n$/i, label: 'Conforme a especificacion sin referencia' },
    { pattern: /^seg[uú]n\s+plano$/i, label: 'Segun plano sin referencia' },
    { pattern: /^ok\s*\/\s*nok$/i, label: 'OK/NOK sin criterio' },
    { pattern: /^sin\s+defectos$/i, label: 'Sin defectos sin definicion' },
    { pattern: /^libre\s+de\s+defectos$/i, label: 'Libre de defectos sin definicion' },
    { pattern: /^a\s+criterio\s+del\s+operador$/i, label: 'Subjetivo — a criterio del operador' },
];

// Document reference pattern — if spec contains a doc code, it's valid
const RE_DOC_REFERENCE = /[A-Z]{1,5}[\s-]*\d{2,}/i;

// ── Helpers ──

function isEmpty(val: unknown): boolean {
    if (val == null) return true;
    if (typeof val === 'string') return val.trim() === '';
    return false;
}

function isTbd(val: unknown): boolean {
    if (isEmpty(val)) return true;
    return RE_TBD.test(String(val).trim());
}

function isGenericSpec(spec: string): string | null {
    const trimmed = spec.trim();
    if (isEmpty(trimmed)) return null; // empty is handled by R4
    // If it references a document, it's valid
    if (RE_DOC_REFERENCE.test(trimmed)) return null;
    for (const gs of GENERIC_SPECS) {
        if (gs.pattern.test(trimmed)) return gs.label;
    }
    return null;
}

function getProductLabel(raw: any): string {
    return raw.project_name || raw.part_number || raw.part_description || raw.id;
}

// ── Main ──

async function main() {
    await ensureAuth();
    console.log('Authenticated. Fetching documents...');

    const [cpDocs, hoDocs, amfeDocs] = await Promise.all([
        fetchAllCpDocs(),
        fetchAllHoDocs(),
        fetchAllAmfeDocs(),
    ]);

    console.log(`Fetched: ${cpDocs.length} CP, ${hoDocs.length} HO, ${amfeDocs.length} AMFE docs`);

    const findings: Finding[] = [];

    // ── CP analysis (Rules 1-5) ──

    for (const cp of cpDocs) {
        const items: any[] = cp.parsed.items ?? [];
        const product = getProductLabel(cp.raw);

        // R3: Count visual controls
        let visualCount = 0;
        const totalItems = items.length;

        for (const item of items) {
            const processDesc = String(item.processDescription ?? '');
            const productChar = String(item.productCharacteristic ?? '');
            const processChar = String(item.processCharacteristic ?? '');
            const spec = String(item.specification ?? '');
            const evalTech = String(item.evaluationTechnique ?? '');
            const controlMethod = String(item.controlMethod ?? '');
            const opNum = String(item.processStepNumber ?? '');
            const combinedChars = `${productChar} ${processChar}`;

            // R1: Traceability controls in non-reception operations
            if (RE_TRACEABILITY.test(combinedChars) && !RE_RECEPTION.test(processDesc)) {
                // Also check if it's the first operation (opNumber "10" or "1")
                const isFirstOp = opNum === '10' || opNum === '1' || opNum === '010';
                if (!isFirstOp) {
                    findings.push({
                        product,
                        docType: 'CP',
                        docId: cp.id,
                        operation: processDesc,
                        opNumber: opNum,
                        control: combinedChars.trim(),
                        specification: spec,
                        method: `${evalTech} / ${controlMethod}`,
                        rule: 'R1',
                        reason: `Control de trazabilidad/documentacion en operacion no-recepcion: "${processDesc}"`,
                    });
                }
            }

            // R2: Dimensional controls in non-dimensional operations
            if (RE_DIMENSIONAL_CONTROL.test(combinedChars) && RE_NON_DIMENSIONAL_OP.test(processDesc)) {
                findings.push({
                    product,
                    docType: 'CP',
                    docId: cp.id,
                    operation: processDesc,
                    opNumber: opNum,
                    control: combinedChars.trim(),
                    specification: spec,
                    method: `${evalTech} / ${controlMethod}`,
                    rule: 'R2',
                    reason: `Control dimensional en operacion no-dimensional: "${processDesc}"`,
                });
            }

            // R3: Track visual controls
            if (RE_VISUAL.test(combinedChars)) {
                visualCount++;
            }

            // R4: TBD/empty methods
            if (isTbd(evalTech) && isTbd(controlMethod)) {
                findings.push({
                    product,
                    docType: 'CP',
                    docId: cp.id,
                    operation: processDesc,
                    opNumber: opNum,
                    control: combinedChars.trim(),
                    specification: spec,
                    method: `evalTech="${evalTech}" / controlMethod="${controlMethod}"`,
                    rule: 'R4',
                    reason: 'Metodo de evaluacion Y metodo de control ambos vacios/TBD',
                });
            }

            // R5: Generic specifications
            const genericLabel = isGenericSpec(spec);
            if (genericLabel) {
                findings.push({
                    product,
                    docType: 'CP',
                    docId: cp.id,
                    operation: processDesc,
                    opNumber: opNum,
                    control: combinedChars.trim(),
                    specification: spec,
                    method: `${evalTech} / ${controlMethod}`,
                    rule: 'R5',
                    reason: `Especificacion generica: ${genericLabel}`,
                });
            }
        }

        // R3: Flag if visual controls exceed 50% of total items
        if (totalItems > 0 && visualCount / totalItems > 0.5) {
            findings.push({
                product,
                docType: 'CP',
                docId: cp.id,
                operation: '(documento completo)',
                opNumber: '-',
                control: `${visualCount}/${totalItems} items con control visual`,
                specification: '-',
                method: '-',
                rule: 'R3',
                reason: `${Math.round((visualCount / totalItems) * 100)}% de items tienen control visual generico (umbral: >50%)`,
            });
        }
    }

    // ── HO analysis (Rule 6 = adapted R1, R4, R5) ──

    for (const ho of hoDocs) {
        const sheets: any[] = ho.parsed.sheets ?? [];
        const product = getProductLabel(ho.raw);

        for (const sheet of sheets) {
            const sheetTitle = String(sheet.title ?? '');
            const sheetNum = String(sheet.sheetNumber ?? '');
            const qcs: any[] = sheet.qualityChecks ?? [];

            for (const qc of qcs) {
                const desc = String(qc.description ?? '');
                const spec = String(qc.specification ?? '');
                const freq = String(qc.frequency ?? '');
                const reaction = String(qc.reactionAction ?? '');

                // R6-R1: Traceability controls in non-reception HO sheets
                if (RE_TRACEABILITY.test(desc) && !RE_RECEPTION.test(sheetTitle)) {
                    const isFirstSheet = sheetNum === '1' || sheetNum === '01' || sheetNum === '010';
                    if (!isFirstSheet) {
                        findings.push({
                            product,
                            docType: 'HO',
                            docId: ho.id,
                            operation: sheetTitle,
                            opNumber: sheetNum,
                            control: desc,
                            specification: spec,
                            method: freq,
                            rule: 'R6-R1',
                            reason: `QC de trazabilidad/documentacion en hoja no-recepcion: "${sheetTitle}"`,
                        });
                    }
                }

                // R6-R4: TBD/empty specification AND no meaningful description
                // For HO QCs, check specification and description
                if (isTbd(spec) && isTbd(desc)) {
                    findings.push({
                        product,
                        docType: 'HO',
                        docId: ho.id,
                        operation: sheetTitle,
                        opNumber: sheetNum,
                        control: desc,
                        specification: spec,
                        method: freq,
                        rule: 'R6-R4',
                        reason: 'QC con descripcion Y especificacion ambos vacios/TBD',
                    });
                }

                // R6-R5: Generic specifications in HO QCs
                const genericLabel = isGenericSpec(spec);
                if (genericLabel) {
                    findings.push({
                        product,
                        docType: 'HO',
                        docId: ho.id,
                        operation: sheetTitle,
                        opNumber: sheetNum,
                        control: desc,
                        specification: spec,
                        method: freq,
                        rule: 'R6-R5',
                        reason: `QC con especificacion generica: ${genericLabel}`,
                    });
                }
            }
        }
    }

    // ── Summary ──

    const ruleCounts: Record<string, number> = {};
    for (const f of findings) {
        ruleCounts[f.rule] = (ruleCounts[f.rule] ?? 0) + 1;
    }

    console.log('\n=== B2 Nonsensical Controls Audit ===');
    console.log(`Total findings: ${findings.length}`);
    console.log('\nFindings per rule:');
    for (const [rule, count] of Object.entries(ruleCounts).sort()) {
        console.log(`  ${rule}: ${count}`);
    }

    // Breakdown by product
    const productCounts: Record<string, number> = {};
    for (const f of findings) {
        productCounts[f.product] = (productCounts[f.product] ?? 0) + 1;
    }
    console.log('\nFindings per product:');
    for (const [product, count] of Object.entries(productCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${product}: ${count}`);
    }

    writeResults('B2_nonsensicalControls.json', {
        summary: {
            totalFindings: findings.length,
            byRule: ruleCounts,
            byProduct: productCounts,
            cpDocsScanned: cpDocs.length,
            hoDocsScanned: hoDocs.length,
        },
        findings,
    });
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});

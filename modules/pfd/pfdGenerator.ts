/**
 * PFD Generator — Auto-generate Process Flow Diagram from AMFE document
 *
 * Follows the same architectural pattern as controlPlanGenerator.ts:
 * Pure function, no React deps, returns {document, warnings}.
 *
 * AIAG APQP workflow: PFD → AMFE → CP → HO
 * This generator allows reverse-populating the PFD from an existing AMFE,
 * mapping each AmfeOperation to a PfdStep with inferred ASME symbol types.
 */

import {
    AmfeDocument, AmfeWorkElement,
} from '../amfe/amfeTypes';
import {
    PfdDocument, PfdStep, PfdHeader, PfdStepType, TransportMode,
    EMPTY_PFD_HEADER, createEmptyStep,
} from './pfdTypes';
import { inferDepartment } from '../../utils/processCategory';

// ============================================================================
// TYPES
// ============================================================================

/** Result of PFD generation, including any warnings. */
export interface PfdGenerationResult {
    document: PfdDocument;
    warnings: string[];
}

/** Options for PFD generation. */
export interface PfdGenerationOptions {
    /**
     * Transport step insertion mode (default: 'cross-sector').
     * - 'cross-sector': Only when department/sector changes (AIAG/ASME recommended)
     * - 'all': Before every operation (legacy behavior)
     * - 'none': No transport steps
     */
    transportMode?: TransportMode;
}

// ============================================================================
// STEP TYPE INFERENCE
// ============================================================================

/**
 * Infer ASME/AIAG step type from AMFE operation name using Spanish regex patterns.
 * Order matters: more specific patterns are checked first.
 */
export function inferStepType(opName: string): PfdStepType {
    const n = (opName || '').toLowerCase().trim();
    if (!n) return 'operation';

    // Combined: operation keyword + inspection keyword together
    const hasInspection = /inspecci[oó]n|verific|control\s*(por|de|con|visual|dimensional)|control.*calidad|medici[oó]n|ensayo|prueba|galga|mylar|calibre|torqu[ií]metro|auditor[ií]a|audit\b|muestreo/.test(n);
    const hasOperation = /sold|mecaniz|ensambl|estampa|inyecci[oó]n|prens/.test(n);
    if (hasInspection && hasOperation) return 'combined';

    // Inspection (must check before operation since "control" could be ambiguous)
    if (hasInspection) return 'inspection';

    // Transport
    if (/transport|traslad|mover|despacho/.test(n)) return 'transport';

    // Storage / Receiving
    if (/almacen|stock|dep[oó]sito|recep|acopio/.test(n)) return 'storage';

    // Delay / Wait
    if (/espera|demora|enfri|secado|curado|reposo/.test(n)) return 'delay';

    // Decision / Selection
    if (/decisi[oó]n|selecci[oó]n|clasific|segreg/.test(n)) return 'decision';

    // Default: operation
    return 'operation';
}

// ============================================================================
// DATA EXTRACTION HELPERS
// ============================================================================

/** Extract machine/device/tool name from the first 'Machine' work element. */
export function extractMachine(workElements: AmfeWorkElement[]): string {
    const machineWe = workElements.find(we => we.type === 'Machine');
    return machineWe?.name?.trim() || '';
}

/** Extract the highest severity across all failure modes in an operation. */
export function getMaxSeverity(workElements: AmfeWorkElement[]): number {
    let max = 0;
    for (const we of workElements) {
        if (!we?.functions) continue; // Defensive: corrupted AMFE data
        for (const func of we.functions) {
            if (!func?.failures) continue;
            for (const fail of func.failures) {
                const s = typeof fail.severity === 'number' ? fail.severity : parseInt(String(fail.severity), 10) || 0;
                if (s > max) max = s;
            }
        }
    }
    return max;
}

/** Extract special characteristic from causes (CC or SC). */
export function extractSpecialChar(workElements: AmfeWorkElement[]): { productSpecialChar: 'CC' | 'SC' | 'none'; processSpecialChar: 'CC' | 'SC' | 'none' } {
    let productSpecialChar: 'CC' | 'SC' | 'none' = 'none';
    let processSpecialChar: 'CC' | 'SC' | 'none' = 'none';

    for (const we of workElements) {
        if (!we?.functions) continue; // Defensive: corrupted AMFE data
        for (const func of we.functions) {
            if (!func?.failures) continue;
            for (const fail of func.failures) {
                const severity = typeof fail.severity === 'number' ? fail.severity : parseInt(String(fail.severity), 10) || 0;
                // AIAG-VDA 2019: CC if severity >= 9 (safety/regulatory)
                // SC if severity >= 5 AND any cause O >= 4 (significant + frequent)
                if (severity >= 9 && productSpecialChar !== 'CC') {
                    productSpecialChar = 'CC';
                } else if (severity >= 5 && productSpecialChar === 'none') {
                    const hasHighOcc = (fail.causes || []).some(c => {
                        const o = typeof c.occurrence === 'number' ? c.occurrence : Number(c.occurrence) || 0;
                        return o >= 4;
                    });
                    if (hasHighOcc) productSpecialChar = 'SC';
                }

                for (const cause of fail.causes) {
                    const sc = (cause.specialChar || '').toUpperCase().trim();
                    if (sc === 'CC') {
                        processSpecialChar = 'CC';
                    } else if (sc === 'SC' && processSpecialChar !== 'CC') {
                        processSpecialChar = 'SC';
                    }
                }
            }
        }
    }

    return { productSpecialChar, processSpecialChar };
}

/** Extract a summary product characteristic text from SC/CC-severity failures (S≥5 per AIAG-VDA). */
export function extractProductCharacteristic(workElements: AmfeWorkElement[]): string {
    const chars: string[] = [];
    for (const we of workElements) {
        if (!we?.functions) continue;
        for (const func of we.functions) {
            if (!func?.failures) continue;
            for (const fail of func.failures) {
                const s = typeof fail.severity === 'number' ? fail.severity : parseInt(String(fail.severity), 10) || 0;
                if (s >= 5 && fail.description) {
                    chars.push(fail.description.trim());
                }
            }
        }
    }
    // Deduplicate and truncate
    const unique = [...new Set(chars)];
    return unique.slice(0, 3).join('; ');
}

/** Extract a summary process characteristic from causes with special chars. */
export function extractProcessCharacteristic(workElements: AmfeWorkElement[]): string {
    const chars: string[] = [];
    for (const we of workElements) {
        if (!we?.functions) continue;
        for (const func of we.functions) {
            if (!func?.failures) continue;
            for (const fail of func.failures) {
                if (!fail?.causes) continue;
                for (const cause of fail.causes) {
                    const sc = (cause.specialChar || '').toUpperCase().trim();
                    if ((sc === 'CC' || sc === 'SC') && cause.cause) {
                        chars.push(cause.cause.trim());
                    }
                }
            }
        }
    }
    const unique = [...new Set(chars)];
    return unique.slice(0, 3).join('; ');
}

// ============================================================================
// HEADER BUILDER
// ============================================================================

/** Build PFD header from AMFE header data. */
export function buildPfdHeader(amfeDoc: AmfeDocument, amfeProjectName: string): PfdHeader {
    const h = amfeDoc.header;
    return {
        ...EMPTY_PFD_HEADER,
        partNumber: h.partNumber || '',
        partName: h.subject || '',
        customerName: h.client || '',
        companyName: h.organization || 'Barack Mercosul',
        plantLocation: h.location || EMPTY_PFD_HEADER.plantLocation,
        coreTeam: h.team || '',
        keyContact: h.responsible || '',
        preparedBy: h.processResponsible || h.responsible || '',
        approvedBy: h.approvedBy || '',
        revisionDate: new Date().toISOString().split('T')[0],
        modelYear: h.modelYear || '',
        linkedAmfeId: amfeProjectName,
    };
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a PFD document from an AMFE document.
 *
 * Each AMFE operation maps to one PFD step with:
 * - Step type inferred from operation name (ASME symbols)
 * - Machine/device from 'Machine' work elements
 * - CC/SC characteristics from failure severity and cause specialChar
 * - Traceability via linkedAmfeOperationId
 *
 * Optionally inserts transport steps between operations (default: true).
 * Always adds bookend storage steps (receiving + shipping) per AIAG.
 *
 * Step numbering:
 * - Transport steps: empty stepNumber (connectors, not process steps)
 * - Bookend storage: 'REC' for receiving, 'ENV' for shipping
 * - Operation steps: use AMFE opNumber directly (e.g., 'OP 10', 'OP 20')
 */
export function generatePfdFromAmfe(
    amfeDoc: AmfeDocument,
    amfeProjectName: string,
    options?: PfdGenerationOptions,
): PfdGenerationResult {
    const transportMode: TransportMode = options?.transportMode ?? 'cross-sector';
    const warnings: string[] = [];
    const header = buildPfdHeader(amfeDoc, amfeProjectName);
    const steps: PfdStep[] = [];

    // --- Early exit: no operations ---
    if (!amfeDoc.operations || amfeDoc.operations.length === 0) {
        warnings.push('El AMFE no tiene operaciones definidas. El flujograma se generó vacío.');
        return {
            document: {
                id: crypto.randomUUID(),
                header,
                steps: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            warnings,
        };
    }

    // --- Bookend: Receiving (storage) ---
    steps.push({
        ...createEmptyStep('REC'),
        stepType: 'storage',
        description: 'Recepción de materia prima',
        department: 'Almacén',
    });

    // --- Map each AMFE operation ---
    let opsGenerated = 0;
    let transportGenerated = 0;
    let prevDepartment = 'Almacén'; // bookend receiving is in Almacén

    for (let i = 0; i < amfeDoc.operations.length; i++) {
        const op = amfeDoc.operations[i];
        const opName = (op.name || '').trim();
        const stepType = inferStepType(opName);
        const department = inferDepartment(opName);

        // --- Transport step insertion per ASME Y15.3 / AIAG APQP ---
        // 'all': before every operation (legacy)
        // 'cross-sector': only when department changes between consecutive steps
        // 'none': no transport steps
        const shouldAddTransport =
            transportMode === 'all' ||
            (transportMode === 'cross-sector' && department && prevDepartment && department !== prevDepartment);

        if (shouldAddTransport) {
            const transportDesc = transportMode === 'cross-sector' && prevDepartment && department
                ? `Transporte de ${prevDepartment} a ${department}`
                : opName
                    ? `Transporte a ${opName}`
                    : `Transporte a operación ${op.opNumber || (i + 1)}`;
            steps.push({
                ...createEmptyStep(''),
                stepType: 'transport',
                description: transportDesc,
            });
            transportGenerated++;
        }

        // Main operation step — use AMFE opNumber directly
        const machine = extractMachine(op.workElements);
        const { productSpecialChar, processSpecialChar } = extractSpecialChar(op.workElements);
        const productChar = extractProductCharacteristic(op.workElements);
        const processChar = extractProcessCharacteristic(op.workElements);

        const opStepNumber = `OP ${op.opNumber || ((i + 1) * 10)}`;

        steps.push({
            ...createEmptyStep(opStepNumber),
            stepType,
            description: opName || `Operación ${op.opNumber || (i + 1)}`,
            machineDeviceTool: machine,
            productCharacteristic: productChar,
            productSpecialChar,
            processCharacteristic: processChar,
            processSpecialChar,
            department,
            linkedAmfeOperationId: op.id,
        });
        opsGenerated++;

        // Track department for cross-sector transport logic
        if (department) prevDepartment = department;

        // Warn if operation has no work elements
        if (!op.workElements || op.workElements.length === 0) {
            warnings.push(`Operación "${opName || op.opNumber}" no tiene elementos de trabajo (6M) definidos en el AMFE.`);
        }
    }

    // --- Transport to shipping (conditional: skip when already in Almacén for cross-sector) ---
    if (transportMode === 'all' ||
        (transportMode === 'cross-sector' && prevDepartment && prevDepartment !== 'Almacén')) {
        const lastDept = prevDepartment;
        const shippingDesc = transportMode === 'cross-sector' && lastDept && lastDept !== 'Almacén'
            ? `Transporte de ${lastDept} a Almacén`
            : 'Transporte a almacenamiento';
        steps.push({
            ...createEmptyStep(''),
            stepType: 'transport',
            description: shippingDesc,
        });
        transportGenerated++;
    }

    // --- Bookend: Shipping (storage) ---
    steps.push({
        ...createEmptyStep('ENV'),
        stepType: 'storage',
        description: 'Almacenamiento y envío al cliente',
        department: 'Almacén',
    });

    // --- Summary warning ---
    const otherCount = steps.length - opsGenerated - transportGenerated;
    const parts = [`${opsGenerated} operaciones`];
    if (transportGenerated > 0) parts.push(`${transportGenerated} transportes`);
    if (otherCount > 0) parts.push(`${otherCount} otros`);
    warnings.push(
        `Flujograma generado: ${steps.length} pasos (${parts.join(' + ')}) ` +
        `a partir de ${amfeDoc.operations.length} operaciones AMFE.`
    );

    return {
        document: {
            id: crypto.randomUUID(),
            header,
            steps,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        warnings,
    };
}

// ============================================================================
// SIMPLIFIED IMPORT (Fase 2: PFD Simplificado)
// ============================================================================

/**
 * Simplified PFD import — only operation numbers + descriptions from AMFE.
 * Everything else (machine, CC/SC, transport, department) is left empty for manual filling.
 * Use this instead of the full generatePfdFromAmfe() when users want control over details.
 */
export function importPfdOpsFromAmfe(
    amfeDoc: AmfeDocument,
    amfeProjectName: string,
): PfdGenerationResult {
    const warnings: string[] = [];
    const header = buildPfdHeader(amfeDoc, amfeProjectName);

    if (!amfeDoc.operations || amfeDoc.operations.length === 0) {
        warnings.push('El AMFE no tiene operaciones definidas. El PFD se generó vacío.');
        return {
            document: {
                id: crypto.randomUUID(),
                header,
                steps: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            warnings,
        };
    }

    const steps: PfdStep[] = amfeDoc.operations.map(op => ({
        ...createEmptyStep(`OP ${op.opNumber || '??'}`),
        stepType: 'operation' as PfdStepType,
        description: op.name || `Operación ${op.opNumber}`,
        linkedAmfeOperationId: op.id,
    }));

    warnings.push(
        `Importadas ${steps.length} operaciones del AMFE. ` +
        `Completá manualmente: tipo de paso, máquina, características CC/SC, transportes y almacenamientos.`
    );

    return {
        document: {
            id: crypto.randomUUID(),
            header,
            steps,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        warnings,
    };
}

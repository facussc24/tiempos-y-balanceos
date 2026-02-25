/**
 * SGC Sync Checker
 *
 * Utility to check if documents in the SGC source have been updated
 * since the last catalog sync. This runs in Tauri (has filesystem access).
 *
 * Usage:
 *   const changes = await checkSgcUpdates();
 *   if (changes.length > 0) { /* notify user * / }
 *
 * IMPORTANT: This only READS from the source path — NEVER modifies anything.
 */

import { SGC_SOURCE_CONFIG } from './sgcSourceConfig';
import { SGC_CATALOG, type SgcDocument } from './sgcCatalog';

export interface SgcFileChange {
    path: string;
    type: 'modified' | 'new' | 'deleted';
    /** ISO date of the file on disk (for modified/new) */
    currentDate?: string;
    /** ISO date from our catalog (for modified/deleted) */
    catalogDate?: string;
    relevance?: string;
}

/**
 * Check if the SGC source path is accessible (network drive Y: must be mounted)
 *
 * This is a placeholder — actual implementation needs Tauri fs API.
 * For now it documents the intended interface.
 */
export function getSgcSourcePath(): string {
    return SGC_SOURCE_CONFIG.sourcePath;
}

/**
 * Get the date when the catalog was last synchronized
 */
export function getLastCatalogDate(): string {
    return SGC_SOURCE_CONFIG.lastCataloged;
}

/**
 * Get all cataloged document paths for quick lookup
 */
export function getCatalogedPaths(): Map<string, SgcDocument> {
    const map = new Map<string, SgcDocument>();
    for (const section of SGC_CATALOG) {
        for (const doc of section.documents) {
            map.set(doc.path, doc);
        }
    }
    return map;
}

/**
 * Summary of the SGC catalog for display
 */
export function getSgcSummary(): {
    sourcePath: string;
    lastCataloged: string;
    totalSections: number;
    totalDocuments: number;
    coreDocuments: number;
    highRelevance: number;
    sections: Array<{ name: string; description: string; docCount: number }>;
} {
    const sections = SGC_CATALOG.map(s => ({
        name: s.name,
        description: s.description,
        docCount: s.documents.length,
    }));

    const allDocs = SGC_CATALOG.flatMap(s => s.documents);

    return {
        sourcePath: SGC_SOURCE_CONFIG.sourcePath,
        lastCataloged: SGC_SOURCE_CONFIG.lastCataloged,
        totalSections: SGC_CATALOG.length,
        totalDocuments: allDocs.length,
        coreDocuments: allDocs.filter(d => d.relevance === 'core').length,
        highRelevance: allDocs.filter(d => d.relevance === 'high').length,
        sections,
    };
}

/**
 * Key documents map — the most important SGC documents for our software
 */
export const SGC_KEY_DOCUMENTS = {
    /** AMFE template (our AMFE module replicates this) */
    amfeTemplate: 'Instructivos/CALIDAD/I-AC-005.3 Analisis del modo de falla y sus efectos C.xlsx',

    /** HO template (our HO module replicates this) — form I-IN-002.4-R01 */
    hoTemplate: 'Instructivos/CALIDAD/I-IN-002.4 Hoja de operaciones C.xlsx',

    /** Control Plan template (our CP module replicates this) */
    cpTemplate: 'Instructivos/CALIDAD/I-AC-005.2 Plan de control C.xls',

    /** Process Flow Diagram template */
    flowDiagram: 'Instructivos/CALIDAD/I-AC-005.1 Diagrama de flujo del proceso C.xlsx',

    /** APQP master instruction */
    apqpInstruction: 'Instructivos/CALIDAD/I-AC-005 APQP Planificacion avanzada de la calidad C.doc',

    /** CC/SC Special Characteristics criteria */
    ccScCriteria: 'Instructivos/CALIDAD/I-AC-005.4.2 Criterios para CC y SC A.xlsx',

    /** CC/SC Matrix */
    ccScMatrix: 'Instructivos/CALIDAD/I-AC-005.4.1 Matriz de caracteristicas especiales A.xlsx',

    /** Ishikawa (Cause-Effect) diagram template */
    ishikawa: 'Instructivos/CALIDAD/I-AC-005.4.3 Diagrama Causa efecto (Ishikawa) A.xlsx',

    /** NC reaction plan */
    ncReactionPlan: 'Procedimientos/Anexos/P-09.1 Reaccion ante una NO conformidad B.1.xls',

    /** 8D Report template */
    report8D: 'Procedimientos/Anexos/P-14.1 Reporte 8D B.xls',

    /** Quality Alert template */
    qualityAlert: 'Procedimientos/Anexos/P-13.4 Alerta de Calidad C.xlsx',

    /** Master SGC catalog */
    masterCatalog: 'Catalogo SGC.xlsx',

    /** Process control procedure */
    processControl: 'Procedimientos/P-09 Control de los procesos B.doc',

    /** NC control procedure */
    ncControl: 'Procedimientos/P-13 Control de las salidas no conformes C.doc',

    /** Engineering process instruction */
    engineeringProcess: 'Instructivos/INGENIERIA/I-IN-001 Ingenieria de proceso B.doc',

    /** Operator training instruction (references HO) */
    operatorTraining: 'Instructivos/INGENIERIA/I-IN-002 Capacitacion al operador de produccion C.doc',

    /** Change control (triggers AMFE/HO revision) */
    changeControl: 'Instructivos/INGENIERIA/I-IN-004 Control de cambios del producto y proceso B.doc',

    /** Company logo */
    logo: 'IDENTIFICACIONES/Logo Barack.png',
} as const;

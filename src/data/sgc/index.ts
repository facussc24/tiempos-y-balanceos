/**
 * SGC (Sistema de Gestión de Calidad) Reference Data
 *
 * This module provides read-only access to the company's QMS documentation catalog.
 * Source: Y:\BARACK\CALIDAD\DOCUMENTACION SGC\SISTEMA\SISTEMA SGC
 *
 * Usage:
 *   import { SGC_CATALOG, getCoreDocuments, SGC_SOURCE_CONFIG } from '../data/sgc';
 */

export { SGC_SOURCE_CONFIG } from './sgcSourceConfig';
export {
    SGC_CATALOG,
    getCoreDocuments,
    getDocumentsByRelevance,
    getDocumentsForModule,
    getSgcStats,
} from './sgcCatalog';
export type { SgcDocument, SgcSection, SgcRelevance } from './sgcCatalog';
export {
    getSgcSourcePath,
    getLastCatalogDate,
    getCatalogedPaths,
    getSgcSummary,
    SGC_KEY_DOCUMENTS,
} from './sgcSyncChecker';
export type { SgcFileChange } from './sgcSyncChecker';

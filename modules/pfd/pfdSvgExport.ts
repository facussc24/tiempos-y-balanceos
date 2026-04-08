/**
 * PFD SVG Export — Facade
 *
 * Re-exports from the new HTML/Tailwind engine for backward compatibility.
 * All consumers (PfdApp, PfdSvgAudit, autoExportService, pfdPdfExport)
 * continue to import from this file unchanged.
 */
export { buildPfdSvg, exportPfdSvg, generatePfdSvgBuffer } from './pfdHtmlExport';
export type { BuildPfdSvgOptions } from './pfdHtmlExport';

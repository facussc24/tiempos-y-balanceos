/**
 * Test script: generates a standalone PFD HTML file for visual verification.
 *
 * Bypasses pfdHtmlExport.ts (which imports Vite-specific .png assets via
 * getLogoBase64) and directly uses the pure conversion + React SSR pipeline:
 *   PfdDocument -> convertPfdToFlowData -> PfdFlowChart -> wrapInStandaloneHtml
 *
 * Run: npx tsx scripts/genTestPfd.ts
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'fs';
import { convertPfdToFlowData } from '../modules/pfd/pfdToFlowData';
import { PfdFlowChart } from '../modules/pfd/flow/PfdFlowChart';
import { wrapInStandaloneHtml } from '../modules/pfd/flowStyles';
import type { PfdDocument, PfdStep, PfdHeader } from '../modules/pfd/pfdTypes';

// ────────────────────────────────────────────────────────────────────────────
// Helper: build a full PfdStep with defaults
// ────────────────────────────────────────────────────────────────────────────

function makeStep(overrides: Partial<PfdStep>): PfdStep {
  return {
    id: crypto.randomUUID(),
    stepNumber: '',
    stepType: 'operation',
    description: '',
    machineDeviceTool: '',
    productCharacteristic: '',
    productSpecialChar: 'none',
    processCharacteristic: '',
    processSpecialChar: 'none',
    reference: '',
    department: '',
    notes: '',
    isRework: false,
    isExternalProcess: false,
    reworkReturnStep: '',
    rejectDisposition: 'none',
    scrapDescription: '',
    branchId: '',
    branchLabel: '',
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Header: IP PAD - LOW VERSION
// ────────────────────────────────────────────────────────────────────────────

const header: PfdHeader = {
  partNumber: '2HC.858.417.B FAM',
  partName: 'IP PAD - LOW VERSION',
  engineeringChangeLevel: '',
  modelYear: 'PATAGONIA',
  documentNumber: 'I-IN-002/III',
  revisionLevel: 'A',
  revisionDate: '2026-04-07',
  companyName: 'BARACK MERCOSUL',
  plantLocation: '',
  supplierCode: '',
  customerName: 'VWA',
  coreTeam: '',
  keyContact: 'LEONARDO LATTANZI',
  processPhase: 'pre-launch',
  preparedBy: 'Facundo Santoro',
  preparedDate: '2026-04-07',
  approvedBy: 'Gonzalo Cal',
  approvedDate: '',
  applicableParts:
    'IP PAD - LOW VERSION: 2HC.858.417.B FAM\n' +
    'IP PAD - HIGH VERSION: 2HC.858.417.C GKK\n' +
    'IP PAD - HIGH VERSION: 2HC.858.417.C GKN',
};

// ────────────────────────────────────────────────────────────────────────────
// Steps: RECEPCION -> storage -> inspection -> decision (MATERIAL CONFORME?)
//        -> transport -> storage -> TROQUELADO -> TAPIZADO -> CONTROL FINAL
//        -> decision (PRODUCTO CONFORME?) -> EMBALAJE -> transport -> storage PT
// ────────────────────────────────────────────────────────────────────────────

const steps: PfdStep[] = [
  makeStep({
    stepNumber: 'OP 10',
    stepType: 'operation',
    description: 'RECEPCION DE MATERIA PRIMA',
    productSpecialChar: 'CC',
    department: 'Recepcion',
  }),
  makeStep({
    stepType: 'storage',
    description: 'ALMACENADO EN SECTOR DE RECEPCION',
  }),
  makeStep({
    stepType: 'inspection',
    description: 'INSPECCION DE MATERIA PRIMA',
    department: 'Calidad',
  }),
  makeStep({
    stepType: 'decision',
    description: '¿MATERIAL CONFORME?',
    rejectDisposition: 'scrap',
    scrapDescription: 'RECLAMO DE CALIDAD AL PROVEEDOR',
  }),
  makeStep({
    stepType: 'transport',
    description: 'TRASLADO: MATERIAL APROBADO A SECTOR DE TROQUELADO',
  }),
  makeStep({
    stepType: 'storage',
    description: 'ALMACENAMIENTO EN MEDIOS WIP',
  }),
  makeStep({
    stepNumber: 'OP 20',
    stepType: 'operation',
    description: 'TROQUELADO DE ESPUMAS',
    machineDeviceTool: 'Troqueladora',
    processSpecialChar: 'SC',
    department: 'Produccion',
  }),
  makeStep({
    stepNumber: 'OP 30',
    stepType: 'operation',
    description: 'TAPIZADO',
    machineDeviceTool: 'Dispositivo de ultrasonido',
    processSpecialChar: 'SC',
    department: 'Produccion',
  }),
  makeStep({
    stepNumber: 'OP 40',
    stepType: 'inspection',
    description: 'CONTROL FINAL DE CALIDAD',
    productSpecialChar: 'CC',
    department: 'Calidad',
  }),
  makeStep({
    stepType: 'decision',
    description: '¿PRODUCTO CONFORME?',
    rejectDisposition: 'scrap',
    scrapDescription: 'SCRAP',
  }),
  makeStep({
    stepNumber: 'OP 50',
    stepType: 'operation',
    description: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
    productSpecialChar: 'CC',
    department: 'Produccion',
  }),
  makeStep({
    stepType: 'transport',
    description: 'TRASLADO A SECTOR DE PRODUCTO TERMINADO',
  }),
  makeStep({
    stepType: 'storage',
    description: 'ALMACENAMIENTO PRODUCTO TERMINADO (FIFO)',
  }),
];

// ────────────────────────────────────────────────────────────────────────────
// Build the PfdDocument and render
// ────────────────────────────────────────────────────────────────────────────

const doc: PfdDocument = {
  id: 'test-ip-pad',
  header,
  steps,
  createdAt: '2026-04-07T00:00:00Z',
  updatedAt: '2026-04-07T00:00:00Z',
};

// Convert PfdDocument -> FlowDocument (no logo, empty string)
const flowData = convertPfdToFlowData(doc, '');

// React SSR -> static HTML
const markup = renderToStaticMarkup(createElement(PfdFlowChart, { data: flowData }));
const html = wrapInStandaloneHtml(markup);

// Write output
const outPath = 'C:/Users/FacundoS-PC/Downloads/test_pfd_output.html';
writeFileSync(outPath, html, 'utf-8');
console.log(`Written to ${outPath}`);
console.log(`Output size: ${html.length} bytes`);

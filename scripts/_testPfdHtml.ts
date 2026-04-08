/**
 * Test script: generates a standalone PFD HTML file for visual verification.
 *
 * Bypasses pfdHtmlExport.ts (which imports Vite-specific .png assets) and
 * directly calls the core conversion + React SSR pipeline.
 *
 * Run: npx tsx scripts/_testPfdHtml.ts
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'fs';
import { convertPfdToFlowData } from '../modules/pfd/pfdToFlowData';
import { PfdFlowChart } from '../modules/pfd/flow/PfdFlowChart';
import { wrapInStandaloneHtml } from '../modules/pfd/flowStyles';
import type { PfdDocument, PfdStep, PfdHeader } from '../modules/pfd/pfdTypes';

function makeHeader(overrides?: Partial<PfdHeader>): PfdHeader {
  return {
    partNumber: '2HC.858.417.B FAM',
    partName: 'IP PAD - LOW VERSION',
    engineeringChangeLevel: '',
    modelYear: 'PATAGONIA',
    documentNumber: 'I-IN-002/III',
    revisionLevel: 'A',
    revisionDate: '2026-04-07',
    companyName: 'BARACK MERCOSUL',
    plantLocation: 'Hurlingham, Buenos Aires',
    supplierCode: '',
    customerName: 'VWA',
    coreTeam: 'Carlos Baptista, Manuel Meszaros',
    keyContact: 'LEONARDO LATTANZI',
    processPhase: 'pre-launch',
    preparedBy: 'FACUNDO SANTORO',
    preparedDate: '2026-04-07',
    approvedBy: 'GONZALO CAL',
    approvedDate: '',
    applicableParts: 'IP PAD - LOW VERSION: 2HC.858.417.B FAM\nIP PAD - HIGH VERSION: 2HC.858.417.C GKK\nIP PAD - HIGH VERSION: 2HC.858.417.C GKN',
    ...overrides,
  };
}

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

// Build a realistic IP PAD flowchart
const steps: PfdStep[] = [
  makeStep({ stepNumber: 'OP 10', stepType: 'operation', description: 'RECEPCION DE MATERIA PRIMA', productSpecialChar: 'CC' }),
  makeStep({ stepType: 'storage', description: 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA PENDIENTE DE CONTROL' }),
  makeStep({ stepType: 'inspection', description: 'INSPECCION DE MATERIA PRIMA' }),
  makeStep({ stepType: 'decision', description: '¿MATERIAL CONFORME?', rejectDisposition: 'scrap', scrapDescription: 'RECLAMO DE CALIDAD AL PROVEEDOR' }),
  makeStep({ stepType: 'transport', description: 'TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO)' }),
  makeStep({ stepType: 'storage', description: 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA' }),
  // Parallel branches
  makeStep({ stepType: 'transport', description: 'TRASLADO: ESPUMAS A SECTOR DE TROQUELADO', branchId: 'A', branchLabel: 'Espumas' }),
  makeStep({ stepNumber: 'OP 20', stepType: 'operation', description: 'TROQUELADO DE ESPUMAS', machineDeviceTool: 'Troqueladora', branchId: 'A', branchLabel: 'Espumas' }),
  makeStep({ stepType: 'storage', description: 'ALMACENAMIENTO EN MEDIOS WIP', branchId: 'A', branchLabel: 'Espumas' }),
  makeStep({ stepType: 'transport', description: 'TRASLADO: PIEZAS TROQUELADAS A SECTOR DE PREARMADO', branchId: 'A', branchLabel: 'Espumas' }),
  makeStep({ stepType: 'transport', description: 'TRASLADO: VINILOS/TELAS A SECTOR DE COSTURA', branchId: 'B', branchLabel: 'Telas' }),
  makeStep({ stepNumber: 'OP 30', stepType: 'operation', description: 'COSTURA', machineDeviceTool: 'Maquina de costura CNC', branchId: 'B', branchLabel: 'Telas', processSpecialChar: 'SC' }),
  makeStep({ stepType: 'storage', description: 'ALMACENAMIENTO EN MEDIOS WIP', branchId: 'B', branchLabel: 'Telas' }),
  makeStep({ stepType: 'transport', description: 'TRASLADO: FUNDAS COSIDAS A SECTOR DE TAPIZADO', branchId: 'B', branchLabel: 'Telas' }),
  // Back to main
  makeStep({ stepNumber: 'OP 40', stepType: 'operation', description: 'TAPIZADO SEMIAUTOMATICO', machineDeviceTool: 'Dispositivo de ultrasonido', processSpecialChar: 'SC' }),
  makeStep({ stepNumber: 'OP 50', stepType: 'inspection', description: 'CONTROL FINAL DE CALIDAD', productSpecialChar: 'CC', processSpecialChar: 'SC' }),
  makeStep({ stepType: 'decision', description: '¿PRODUCTO CONFORME?', rejectDisposition: 'scrap', scrapDescription: 'PIEZA IRRECUPERABLE' }),
  makeStep({ stepNumber: 'OP 60', stepType: 'operation', description: 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', productSpecialChar: 'SC' }),
  makeStep({ stepType: 'transport', description: 'TRASLADO A SECTOR DE PRODUCTO TERMINADO' }),
  makeStep({ stepType: 'storage', description: 'ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)' }),
];

const doc: PfdDocument = {
  id: 'test-doc',
  header: makeHeader(),
  steps,
  createdAt: '2026-04-07T00:00:00Z',
  updatedAt: '2026-04-07T00:00:00Z',
};

// Replicate what buildPfdSvg does, without the problematic ppeBase64 import
const flowData = convertPfdToFlowData(doc, '');
const markup = renderToStaticMarkup(createElement(PfdFlowChart, { data: flowData }));
const html = wrapInStandaloneHtml(markup);

const outPath = 'C:/Users/FacundoS-PC/Downloads/test_pfd_output.html';
writeFileSync(outPath, html, 'utf-8');
console.log(`Written to ${outPath}`);
console.log(`Output size: ${html.length} bytes`);

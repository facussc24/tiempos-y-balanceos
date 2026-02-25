/**
 * PFD (Diagrama de Flujo del Proceso) Types
 *
 * Interfaces, constants, and factory functions for the Process Flow Diagram module.
 * Follows AIAG APQP / ASME standard symbology.
 */

/** Step types per ASME/AIAG symbology */
export type PfdStepType =
  | 'operation'
  | 'transport'
  | 'inspection'
  | 'storage'
  | 'delay'
  | 'decision'
  | 'combined';

/** Special characteristic classification */
export type SpecialCharClass = 'CC' | 'SC' | 'none';

/** C3-N1: Reject disposition per AIAG (rework/scrap/sort) */
export type RejectDisposition = 'none' | 'rework' | 'scrap' | 'sort';

/** Document header / metadata */
export interface PfdHeader {
  // Product identification
  partNumber: string;
  partName: string;
  engineeringChangeLevel: string;
  modelYear: string;

  // Document control
  documentNumber: string;
  revisionLevel: string;
  revisionDate: string;

  // Organization
  companyName: string;
  plantLocation: string;
  supplierCode: string;
  customerName: string;
  coreTeam: string;
  keyContact: string;

  // Process phase (AIAG APQP)
  processPhase: 'prototype' | 'pre-launch' | 'production' | '';

  // Approvals
  preparedBy: string;
  preparedDate: string;
  approvedBy: string;
  approvedDate: string;

  // Linkage
  linkedProjectId?: string;
  linkedAmfeId?: string;
  linkedCpId?: string;
}

/** A single process step/operation */
export interface PfdStep {
  id: string;

  // Required
  stepNumber: string;
  stepType: PfdStepType;
  description: string;
  machineDeviceTool: string;

  // Product characteristics
  productCharacteristic: string;
  productSpecialChar: SpecialCharClass;

  // Process characteristics
  processCharacteristic: string;
  processSpecialChar: SpecialCharClass;

  // Reference
  reference: string;

  // Optional
  department: string;
  notes: string;
  isRework: boolean;
  isExternalProcess: boolean;
  reworkReturnStep: string;

  // C3-N1: Reject disposition (scrap, sort) + description
  rejectDisposition: RejectDisposition;
  scrapDescription: string;

  // Linkage metadata (filled when generating AMFE/CP)
  linkedAmfeOperationId?: string;
  linkedCpItemIds?: string[];
}

/** Full PFD document */
export interface PfdDocument {
  id: string;
  header: PfdHeader;
  steps: PfdStep[];
  createdAt: string;
  updatedAt: string;
}

/** Lightweight list item for document listing (SELECT metadata) */
export interface PfdDocumentListItem {
  id: string;
  part_number: string;
  part_name: string;
  document_number: string;
  revision_level: string;
  revision_date: string;
  customer_name: string;
  step_count: number;
  updated_at: string;
}

/** Column definition for the table */
export interface PfdColumnDef {
  key: keyof PfdStep;
  label: string;
  width: string;
  required?: boolean;
  type?: 'text' | 'select' | 'symbol' | 'specialChar' | 'boolean' | 'disposition';
}

/** Step type definitions with display label and color */
export const PFD_STEP_TYPES: { value: PfdStepType; label: string; color: string }[] = [
  { value: 'operation',  label: 'Operación',        color: 'blue' },
  { value: 'transport',  label: 'Transporte',       color: 'slate' },
  { value: 'inspection', label: 'Inspección',       color: 'emerald' },
  { value: 'storage',    label: 'Almacenamiento',   color: 'amber' },
  { value: 'delay',      label: 'Demora / Espera',  color: 'red' },
  { value: 'decision',   label: 'Decisión',         color: 'purple' },
  { value: 'combined',   label: 'Op. + Inspección', color: 'blue' },
];

/** Table column definitions — C3-N1: replaced isRework with rejectDisposition */
/** C6-U1: Reduced widths to fit ~1530px (was ~1640px). C6-V1: CC/SC 75px. C6-V2: "Disp." label. */
export const PFD_COLUMNS: PfdColumnDef[] = [
  { key: 'stepNumber',            label: 'Nº Op.',              width: '80px',  required: true,  type: 'text' },
  { key: 'stepType',              label: 'Símbolo',             width: '60px',  required: true,  type: 'symbol' },
  { key: 'description',           label: 'Descripción',         width: '250px', required: true,  type: 'text' },
  { key: 'machineDeviceTool',     label: 'Máquina/Dispositivo', width: '160px', required: false, type: 'text' },
  { key: 'productCharacteristic', label: 'Caract. Producto',    width: '200px', required: false, type: 'text' },
  { key: 'productSpecialChar',    label: 'CC/SC Prod.',         width: '75px',  required: false, type: 'specialChar' },
  { key: 'processCharacteristic', label: 'Caract. Proceso',     width: '200px', required: false, type: 'text' },
  { key: 'processSpecialChar',    label: 'CC/SC Proc.',         width: '75px',  required: false, type: 'specialChar' },
  { key: 'reference',             label: 'Referencia',          width: '100px', required: false, type: 'text' },
  { key: 'department',            label: 'Área',                width: '80px',  required: false, type: 'text' },
  { key: 'notes',                 label: 'Notas',               width: '120px', required: false, type: 'text' },
  { key: 'rejectDisposition',     label: 'Disp.',               width: '80px',  required: false, type: 'disposition' },
  { key: 'isExternalProcess',     label: 'Ext.',                width: '45px',  required: false, type: 'boolean' },
];

/** Empty header with defaults */
export const EMPTY_PFD_HEADER: PfdHeader = {
  partNumber: '',
  partName: '',
  engineeringChangeLevel: '',
  modelYear: '',
  documentNumber: '',
  revisionLevel: 'A',
  revisionDate: new Date().toISOString().split('T')[0],
  processPhase: '',
  companyName: 'Barack Mercosul',
  plantLocation: 'Hurlingham, Buenos Aires',
  supplierCode: '',
  customerName: '',
  coreTeam: '',
  keyContact: '',
  preparedBy: '',
  preparedDate: '',
  approvedBy: '',
  approvedDate: '',
};

/** Parse the numeric portion of a step number like "OP 10" → 10 */
export function parseStepNumber(stepNumber: string): number {
  const match = stepNumber.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Generate next step number based on existing steps */
export function getNextStepNumber(steps: PfdStep[]): string {
  if (steps.length === 0) return 'OP 10';
  const last = steps[steps.length - 1];
  const lastNum = parseStepNumber(last.stepNumber);
  const prefix = last.stepNumber.replace(/\d+\s*$/, '').trim() || 'OP';
  const next = lastNum > 0 ? lastNum + 10 : (steps.length + 1) * 10;
  return `${prefix} ${next}`;
}

/**
 * C6-B1: Generate an intermediate step number between steps[afterIndex] and steps[afterIndex+1].
 * E.g., between "OP 20" and "OP 30" → "OP 25". Falls back to getNextStepNumber if no room.
 */
export function getIntermediateStepNumber(steps: PfdStep[], afterIndex: number): string {
  if (afterIndex < 0 || afterIndex >= steps.length) return getNextStepNumber(steps);

  const current = steps[afterIndex];
  const currentNum = parseStepNumber(current.stepNumber);
  const prefix = current.stepNumber.replace(/\d+\s*$/, '').trim() || 'OP';

  // If there's a next step, try to find a midpoint
  if (afterIndex + 1 < steps.length) {
    const nextNum = parseStepNumber(steps[afterIndex + 1].stepNumber);
    if (nextNum > currentNum + 1) {
      const mid = Math.floor((currentNum + nextNum) / 2);
      return `${prefix} ${mid}`;
    }
  }

  // No next step or no room → use current + 5 (half the standard 10 increment)
  const candidate = currentNum + 5;
  const existing = new Set(steps.map(s => parseStepNumber(s.stepNumber)));
  if (!existing.has(candidate)) {
    return `${prefix} ${candidate}`;
  }

  // Fallback: sequential after all steps
  return getNextStepNumber(steps);
}

/** Create a new empty step */
export function createEmptyStep(stepNumber?: string): PfdStep {
  return {
    id: crypto.randomUUID(),
    stepNumber: stepNumber ?? '',
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
  };
}

/** C3-N1: Normalize a step loaded from old format (backward compat) */
export function normalizePfdStep(raw: Record<string, unknown> & { id: string }): PfdStep {
  const base = createEmptyStep();
  const step = { ...base, ...raw } as PfdStep;
  // Old docs may not have rejectDisposition — derive from isRework
  if (!step.rejectDisposition || (step.rejectDisposition === 'none' && step.isRework)) {
    step.rejectDisposition = step.isRework ? 'rework' : 'none';
  }
  if (step.scrapDescription === undefined || step.scrapDescription === null) {
    step.scrapDescription = '';
  }
  return step;
}

/** Create a new empty PFD document with AIAG-recommended initial step */
export function createEmptyPfdDocument(): PfdDocument {
  const receptionStep: PfdStep = {
    ...createEmptyStep('OP 10'),
    stepType: 'storage',
    description: 'Recepción de materia prima',
  };
  return {
    id: crypto.randomUUID(),
    header: { ...EMPTY_PFD_HEADER },
    steps: [receptionStep],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

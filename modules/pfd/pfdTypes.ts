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

/**
 * Transport step insertion mode per ASME Y15.3 / AIAG APQP.
 * - 'cross-sector': Only insert between different departments (recommended per standard)
 * - 'all': Insert between every operation (legacy behavior)
 * - 'none': No transport steps
 */
export type TransportMode = 'cross-sector' | 'all' | 'none';

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

  // Applicable parts (family coverage)
  applicableParts?: string;

  // Linkage
  linkedProjectId?: string;
  linkedAmfeId?: string;
  linkedCpId?: string;
}

/** SGC document form reference number */
export const SGC_FORM_NUMBER = 'I-AC-005.1-R01';

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

  // C9-N1: Parallel flow (branch/fork/join) per AIAG "Procesos Interdependientes"
  branchId: string;       // '' = main flow, 'A'/'B'/'C' = parallel branch identifier
  branchLabel: string;    // Human-readable label for the branch (e.g., "Línea ZAC")

  // Cycle time annotation (AIAG recommended)
  cycleTimeMinutes?: number;

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

/** Column group for visibility toggling */
export type PfdColumnGroup = 'essential' | 'equipment' | 'characteristics' | 'flow' | 'reference' | 'disposition';

export const PFD_COLUMN_GROUPS: {
  id: PfdColumnGroup;
  label: string;
  description: string;
  defaultVisible: boolean;
  autoShow?: (steps: PfdStep[]) => boolean;
}[] = [
  { id: 'essential', label: 'Esencial', description: 'Nº, Símbolo, Descripción', defaultVisible: true },
  { id: 'equipment', label: 'Equipo', description: 'Máquina / Dispositivo', defaultVisible: true },
  { id: 'characteristics', label: 'Características', description: 'Producto y Proceso CC/SC', defaultVisible: true },
  { id: 'flow', label: 'Flujo', description: 'Líneas paralelas', defaultVisible: false, autoShow: (steps) => steps.some(s => s.branchId) },
  { id: 'reference', label: 'Referencia', description: 'Ref., Área, Notas', defaultVisible: false },
  { id: 'disposition', label: 'Disposición', description: 'Rechazo, Externo', defaultVisible: false, autoShow: (steps) => steps.some(s => s.rejectDisposition !== 'none' || s.isExternalProcess) },
];

/** Column definition for the table */
export interface PfdColumnDef {
  key: keyof PfdStep;
  label: string;
  width: string;
  required?: boolean;
  type?: 'text' | 'select' | 'symbol' | 'specialChar' | 'boolean' | 'disposition';
  /** C11-UX7: Tooltip for abbreviated column headers */
  tooltip?: string;
  /** Column group for visibility toggling */
  group: PfdColumnGroup;
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
/** C11-UX9: Widths tuned to fit container (p-4 = 32px padding → ~1502px available). Total = 1410 + 90 Actions = 1500px. */
export const PFD_COLUMNS: PfdColumnDef[] = [
  { key: 'stepNumber',            label: 'Nº Op.',              width: '80px',  required: true,  type: 'text',        group: 'essential' },
  { key: 'stepType',              label: 'Símbolo',             width: '60px',  required: true,  type: 'symbol',      group: 'essential' },
  { key: 'description',           label: 'Descripción',         width: '320px', required: true,  type: 'text',        group: 'essential' },
  { key: 'branchId',              label: 'Línea',               width: '90px',  required: false, type: 'text',        group: 'flow', tooltip: 'Línea paralela (Procesos Interdependientes)' },
  { key: 'machineDeviceTool',     label: 'Máquina/Disp.',       width: '170px', required: false, type: 'text',        group: 'equipment', tooltip: 'Máquina / Dispositivo / Herramienta' },
  { key: 'productCharacteristic', label: 'Caract. Producto',    width: '170px', required: false, type: 'text',        group: 'characteristics', tooltip: 'Característica de producto' },
  { key: 'productSpecialChar',    label: 'CC/SC',               width: '60px',  required: false, type: 'specialChar', group: 'characteristics', tooltip: 'Característica Crítica / Significativa — Producto' },
  { key: 'processCharacteristic', label: 'Caract. Proceso',     width: '170px', required: false, type: 'text',        group: 'characteristics', tooltip: 'Característica de proceso' },
  { key: 'processSpecialChar',    label: 'CC/SC',               width: '60px',  required: false, type: 'specialChar', group: 'characteristics', tooltip: 'Característica Crítica / Significativa — Proceso' },
  { key: 'reference',             label: 'Referencia',          width: '90px',  required: false, type: 'text',        group: 'reference', tooltip: 'Plano / Especificación de referencia' },
  { key: 'department',            label: 'Área',                width: '100px', required: false, type: 'text',        group: 'reference' },
  { key: 'notes',                 label: 'Notas',               width: '85px',  required: false, type: 'text',        group: 'reference' },
  { key: 'rejectDisposition',     label: 'Disp.',               width: '80px',  required: false, type: 'disposition', group: 'disposition', tooltip: 'Disposición de rechazo (Retrabajo / Descarte / Selección)' },
  { key: 'isExternalProcess',     label: 'Ext.',                width: '45px',  required: false, type: 'boolean',     group: 'disposition', tooltip: 'Proceso externo (tercerizado)' },
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

/** C9-N1: Branch color palette for parallel flow lanes */
export const BRANCH_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  A: { bg: 'bg-violet-50', border: 'border-violet-400', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700 border-violet-300' },
  B: { bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-700 border-sky-300' },
  C: { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700 border-rose-300' },
  D: { bg: 'bg-lime-50', border: 'border-lime-400', text: 'text-lime-700', badge: 'bg-lime-100 text-lime-700 border-lime-300' },
};

/** Get branch color (cycles through palette for unknown IDs) */
export function getBranchColor(branchId: string): { bg: string; border: string; text: string; badge: string } {
  if (!branchId) return { bg: '', border: '', text: 'text-gray-500', badge: 'bg-gray-100 text-gray-600 border-gray-300' };
  return BRANCH_COLORS[branchId.toUpperCase()] || BRANCH_COLORS.A;
}

/**
 * C9-N1: Analyze parallel flow structure from steps.
 * Returns info about fork/join points for flow arrow rendering.
 */
export interface FlowTransition {
  type: 'normal' | 'fork' | 'join' | 'branch-continue' | 'branch-switch' | 'ng-path';
  fromBranch: string;
  toBranch: string;
  branches?: string[];  // For fork: list of branch IDs that start
  ngInfo?: { disposition: RejectDisposition; returnStep: string; scrapDesc: string };
}

export function analyzeFlowTransition(current: PfdStep, next: PfdStep): FlowTransition {
  const curBranch = current.branchId || '';
  const nextBranch = next.branchId || '';

  // Main flow → branch = fork
  if (!curBranch && nextBranch) {
    return { type: 'fork', fromBranch: '', toBranch: nextBranch, branches: [nextBranch] };
  }
  // Branch → main flow = join
  if (curBranch && !nextBranch) {
    return { type: 'join', fromBranch: curBranch, toBranch: '' };
  }
  // Same branch continues
  if (curBranch === nextBranch) {
    return { type: curBranch ? 'branch-continue' : 'normal', fromBranch: curBranch, toBranch: nextBranch };
  }
  // Different branch
  return { type: 'branch-switch', fromBranch: curBranch, toBranch: nextBranch };
}

/**
 * C9-N1: Collect all unique branch IDs starting from a fork point.
 * Looks ahead from afterIndex to find all consecutive branch steps.
 */
export function collectForkBranches(steps: PfdStep[], forkIndex: number): string[] {
  const branches = new Set<string>();
  for (let i = forkIndex + 1; i < steps.length; i++) {
    if (!steps[i].branchId) break; // Back to main flow
    branches.add(steps[i].branchId);
  }
  return Array.from(branches).sort();
}

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
    branchId: '',
    branchLabel: '',
    cycleTimeMinutes: undefined,
  };
}

// Re-export from pfdNormalize to avoid duplicate code
// (pfdNormalize exists to break circular deps with pfdRepository)
export { normalizePfdStep } from './pfdNormalize';

/**
 * Renumber all steps sequentially.
 * Operations get OP 10, OP 20, OP 30...
 * Transport steps keep empty stepNumber (they are connectors, not numbered operations).
 * Bookend steps (storage at start/end) keep their REC/ENV labels.
 */
export function renumberSteps(steps: PfdStep[]): PfdStep[] {
  let opCounter = 10;
  return steps.map((step, i) => {
    // Transport steps: keep empty
    if (step.stepType === 'transport') return { ...step, stepNumber: '' };
    // Bookend: first storage = REC, last storage = ENV
    if (step.stepType === 'storage' && i === 0) return { ...step, stepNumber: 'REC' };
    if (step.stepType === 'storage' && i === steps.length - 1) return { ...step, stepNumber: 'ENV' };
    // Normal operation: OP 10, OP 20...
    const num = opCounter;
    opCounter += 10;
    return { ...step, stepNumber: `OP ${num}` };
  });
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

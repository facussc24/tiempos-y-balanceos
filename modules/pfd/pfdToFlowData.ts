/**
 * PfdDocument → FlowDocument converter.
 *
 * Pure function that transforms the persistence model (PfdDocument) into
 * the intermediate representation (FlowDocument) consumed by the
 * HTML/Tailwind flow renderer. Decouples data shape from rendering logic.
 *
 * Branch grouping mirrors the approach in pfdSvgExport.ts → groupStepsByFlow().
 */

import type { PfdDocument, PfdStep, PfdStepType } from './pfdTypes';
import type { FlowDocument, FlowNodeData, FlowNodeType, FlowBranchSide } from './flowTypes';

// ────────────────────────────────────────────────────────────────────────────
// Step type mapping: PfdStepType → FlowNodeType
// ────────────────────────────────────────────────────────────────────────────

const STEP_TYPE_MAP: Record<PfdStepType, FlowNodeType> = {
  operation:  'operation',
  transport:  'transfer',
  combined:   'op-ins',
  decision:   'condition',
  delay:      'storage',
  inspection: 'inspection',
  storage:    'storage',
};

function mapStepType(pfdType: PfdStepType): FlowNodeType {
  return STEP_TYPE_MAP[pfdType] ?? 'operation';
}

// ────────────────────────────────────────────────────────────────────────────
// Extract numeric portion from step number: "OP 10" → "10", "REC" → "REC"
// ────────────────────────────────────────────────────────────────────────────

function extractStepId(stepNumber: string): string {
  const match = stepNumber.match(/(\d+)\s*$/);
  return match ? match[1] : stepNumber.trim();
}

// ────────────────────────────────────────────────────────────────────────────
// CC/SC classification: derive criticalType string from special chars
// ────────────────────────────────────────────────────────────────────────────

function deriveCriticalType(step: PfdStep): { critical: boolean; criticalType: string | undefined } {
  const prodCC = step.productSpecialChar === 'CC';
  const prodSC = step.productSpecialChar === 'SC';
  const procCC = step.processSpecialChar === 'CC';
  const procSC = step.processSpecialChar === 'SC';

  const hasCC = prodCC || procCC;
  const hasSC = prodSC || procSC;

  if (!hasCC && !hasSC) {
    return { critical: false, criticalType: undefined };
  }

  // Both CC and SC present
  if (hasCC && hasSC) {
    return { critical: true, criticalType: 'CC, SC' };
  }

  // CC only
  if (hasCC) {
    return { critical: true, criticalType: 'CC' };
  }

  // SC only
  return { critical: true, criticalType: 'SC' };
}

// ────────────────────────────────────────────────────────────────────────────
// Convert a single PfdStep → FlowNodeData
// ────────────────────────────────────────────────────────────────────────────

function convertStep(step: PfdStep, allSteps: PfdStep[] = []): FlowNodeData {
  const nodeType = mapStepType(step.stepType);
  const { critical, criticalType } = deriveCriticalType(step);
  const stepId = extractStepId(step.stepNumber);

  const node: FlowNodeData = {
    stepId: stepId || undefined,
    type: nodeType,
    description: step.description || undefined,
    equipment: step.machineDeviceTool || undefined,
    department: step.department || undefined,
    critical,
    criticalType,
    isExternal: step.isExternalProcess || undefined,
  };

  // Decision nodes
  if (nodeType === 'condition') {
    node.labelCondition = step.description || '¿PRODUCTO CONFORME?';

    // Reject disposition → branchSide
    // Fak 2026-04-20: SCRAP se mantiene en OP manufactura (terminologia planta).
    // Solo cambia en OP 10 Recepcion cuando la pregunta es "MATERIAL CONFORME?"
    // (defecto de MP = responsabilidad proveedor → RECLAMO PROVEEDOR).

    // Caso complejo: retrabajo condicional con scrap alternativo.
    // NO → segundo rombo "¿SE PUEDE RETRABAJAR?"
    //         SI → retrabajo (flecha curva retorno a reworkReturnStep)
    //         NO → SCRAP terminal
    // Fak 2026-04-23: patron estandar automotriz tras inspeccion.
    if (step.rejectDisposition === 'rework_or_scrap' && step.reworkReturnStep) {
      // Patron canonico validado (Fak 2026-04-23):
      //   PRODUCTO CONFORME?  ->  SI abajo sigue flujo
      //                           NO lateral -> mini-flow anidado:
      //     ¿SE PUEDE RETRABAJAR?
      //         SI abajo   -> OP retrabajo -> traslado a OP anterior (rework target)
      //         NO lateral -> SCRAP terminal
      //
      // Array sequence de 3 items obligatorio para que el renderer NO colapse
      // los rombos superpuestos (ver CLAUDE.md + project_pfd_rework_pattern.md).
      const returnId = extractStepId(step.reworkReturnStep);
      // Patron Google: stepId del retrabajo = returnId + 1 (ej OP 80 -> 81, OP 130 -> 131).
      // Si returnId no es numerico (ej "REC"), sufijar letra "A" en lugar de generar "NaN1".
      const returnIdNum = parseInt(returnId, 10);
      const retrabajoId = Number.isFinite(returnIdNum)
        ? `${returnIdNum + 1}`
        : `${returnId}A`;
      // El "nombre" del retrabajo se saca de la OP a la que vuelve (reworkReturnStep),
      // NO de la descripcion del rombo decision (que es "PRODUCTO CONFORME?").
      // Fak 2026-04-23: si volvemos a OP 70 ADHESIVADO, el retrabajo es
      // "RETRABAJO DE ADHESIVADO" (no "RETRABAJO DE PRODUCTO CONFORME").
      // Buscamos la descripcion real de la OP destino en el doc.
      const targetStep = allSteps.find(s => extractStepId(s.stepNumber) === returnId);
      const targetLabel = (targetStep?.description || `OP ${returnId}`).trim();
      const retrabajoDesc = `RETRABAJO DE ${targetLabel}`;
      node.branchSide = {
        type: 'condition',
        labelNode: 'NO',
        sequence: [
          {
            type: 'condition',
            labelCondition: '¿SE PUEDE RETRABAJAR?',
            labelDown: 'SI',
            branchSide: {
              type: 'terminal',
              text: 'SCRAP',
              labelNode: 'NO',
              // Fak 2026-04-23: NO mostrar description bajo SCRAP en el
              // patron rework_or_scrap (el "¿SE PUEDE RETRABAJAR?" ya implica
              // que no se puede y va a scrap — texto redundante).
            },
          },
          {
            type: 'op-ins',
            stepId: retrabajoId,
            description: retrabajoDesc,
          },
          {
            type: 'transfer',
            description: `TRASLADO A OP ${returnId}`,
            rework: { targetId: returnId },
          },
        ],
      };
      node.labelDown = 'SI';
    } else if (step.rejectDisposition === 'scrap' || step.rejectDisposition === 'sort') {
      const isMaterialCheck = /material\s+conforme/i.test(step.description || '');
      const terminalText = step.rejectDisposition === 'sort'
        ? 'SEGREGAR'
        : isMaterialCheck
          ? 'RECLAMO PROVEEDOR'
          : 'SCRAP';
      const branchSide: FlowBranchSide = {
        type: 'terminal',
        text: terminalText,
        labelNode: 'NO',
        description: step.scrapDescription || undefined,
      };
      node.branchSide = branchSide;
      node.labelDown = 'SI';
    } else if (step.rejectDisposition === 'rework' && step.reworkReturnStep) {
      node.rework = { targetId: extractStepId(step.reworkReturnStep) };
      node.labelDown = 'SI';
    }
  }

  // Rework (non-decision): isRework flag or rework disposition
  if (nodeType !== 'condition') {
    if (step.isRework && step.reworkReturnStep) {
      node.rework = { targetId: extractStepId(step.reworkReturnStep) };
    } else if (step.rejectDisposition === 'rework' && step.reworkReturnStep) {
      node.rework = { targetId: extractStepId(step.reworkReturnStep) };
    }
  }

  return node;
}

// ────────────────────────────────────────────────────────────────────────────
// Group steps by flow (main vs parallel branches)
// Mirrors pfdSvgExport.ts → groupStepsByFlow()
// ────────────────────────────────────────────────────────────────────────────

interface FlowGroup {
  type: 'main' | 'parallel';
  steps: PfdStep[];
  branches?: { branchId: string; label: string; steps: PfdStep[] }[];
}

function groupStepsByFlow(steps: PfdStep[]): FlowGroup[] {
  const groups: FlowGroup[] = [];
  let i = 0;

  while (i < steps.length) {
    if (!steps[i].branchId) {
      // Collect consecutive main-flow steps
      const mainSteps: PfdStep[] = [];
      while (i < steps.length && !steps[i].branchId) {
        mainSteps.push(steps[i]);
        i++;
      }
      groups.push({ type: 'main', steps: mainSteps });
    } else {
      // Collect consecutive branch steps, grouped by branchId
      const branchMap: Record<string, PfdStep[]> = {};
      const branchOrder: string[] = [];
      while (i < steps.length && steps[i].branchId) {
        const bid = steps[i].branchId;
        if (!branchMap[bid]) {
          branchMap[bid] = [];
          branchOrder.push(bid);
        }
        branchMap[bid].push(steps[i]);
        i++;
      }
      const branches = branchOrder.map(bid => ({
        branchId: bid,
        label: branchMap[bid][0].branchLabel || `Línea ${bid}`,
        steps: branchMap[bid],
      }));
      groups.push({ type: 'parallel', steps: [], branches });
    }
  }

  return groups;
}

// ────────────────────────────────────────────────────────────────────────────
// Build reference lines from header
// ────────────────────────────────────────────────────────────────────────────

function buildReferenceLines(header: PfdDocument['header']): string[] {
  const lines: string[] = [];

  // Additional applicable parts
  if (header.applicableParts) {
    for (const line of header.applicableParts.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) lines.push(trimmed);
    }
  }

  // If applicableParts is empty, add main part as fallback
  if (lines.length === 0 && (header.partName || header.partNumber)) {
    const main = header.partName && header.partNumber
      ? `${header.partName}: ${header.partNumber}`
      : header.partName || header.partNumber;
    lines.push(main);
  }

  return lines;
}

// ────────────────────────────────────────────────────────────────────────────
// Check if any step has CC/SC
// ────────────────────────────────────────────────────────────────────────────

function hasAnyCcSc(steps: PfdStep[]): boolean {
  return steps.some(s =>
    s.productSpecialChar === 'CC' || s.productSpecialChar === 'SC' ||
    s.processSpecialChar === 'CC' || s.processSpecialChar === 'SC',
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════

/**
 * Convert a PfdDocument into a FlowDocument suitable for the HTML renderer.
 *
 * The conversion:
 * 1. Maps PfdStepType → FlowNodeType
 * 2. Groups steps into main-flow and parallel-branch segments
 * 3. Extracts CC/SC, rework, and reject disposition metadata
 * 4. Builds reference lines from the header
 */
export function convertPfdToFlowData(doc: PfdDocument, logoBase64 = ''): FlowDocument {
  const groups = groupStepsByFlow(doc.steps);
  const flowData: FlowNodeData[] = [];

  const allSteps = doc.steps;
  for (const group of groups) {
    if (group.type === 'main') {
      // Main flow: each step becomes a FlowNodeData directly
      for (const step of group.steps) {
        flowData.push(convertStep(step, allSteps));
      }
    } else if (group.type === 'parallel' && group.branches) {
      // Parallel branches: create a virtual node with branches[][] property
      const branchArrays: FlowNodeData[][] = group.branches.map(branch =>
        branch.steps.map(step => convertStep(step, allSteps)),
      );

      // Virtual split node — no stepId, no description. The renderer
      // uses the `branches` property to draw parallel lanes.
      const splitNode: FlowNodeData = {
        type: 'operation', // placeholder type; renderer should check branches
        branches: branchArrays,
      };

      flowData.push(splitNode);
    }
  }

  return {
    header: doc.header,
    flowData,
    logoBase64,
    referenceLines: buildReferenceLines(doc.header),
    hasAnyCcSc: hasAnyCcSc(doc.steps),
  };
}

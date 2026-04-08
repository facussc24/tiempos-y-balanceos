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

function convertStep(step: PfdStep): FlowNodeData {
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
    if (step.rejectDisposition === 'scrap' || step.rejectDisposition === 'sort') {
      const terminalText = step.rejectDisposition === 'scrap' ? 'SCRAP' : 'SEGREGAR';
      const branchSide: FlowBranchSide = {
        type: 'terminal',
        text: terminalText,
        labelNode: 'NO',
        description: step.scrapDescription || undefined,
      };
      node.branchSide = branchSide;
      node.labelDown = 'SI';
    }

    // Rework disposition on decision
    if (step.rejectDisposition === 'rework' && step.reworkReturnStep) {
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

  for (const group of groups) {
    if (group.type === 'main') {
      // Main flow: each step becomes a FlowNodeData directly
      for (const step of group.steps) {
        flowData.push(convertStep(step));
      }
    } else if (group.type === 'parallel' && group.branches) {
      // Parallel branches: create a virtual node with branches[][] property
      const branchArrays: FlowNodeData[][] = group.branches.map(branch =>
        branch.steps.map(step => convertStep(step)),
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

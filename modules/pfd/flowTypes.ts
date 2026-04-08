/**
 * Intermediate types for the HTML/Tailwind PFD renderer.
 * PfdDocument → FlowDocument conversion happens in pfdToFlowData.ts
 */

import type { PfdHeader } from './pfdTypes';

/** Node types supported by the flow renderer */
export type FlowNodeType =
  | 'operation'
  | 'op-ins'
  | 'transfer'
  | 'storage'
  | 'inspection'
  | 'condition'
  | 'terminal';

/** Lateral branch (e.g., NO → SCRAP) */
export interface FlowBranchSide {
  type: FlowNodeType;
  text?: string;
  labelNode?: string;    // "NO" label above the line
  description?: string;
  stepId?: string;
  sequence?: FlowNodeData[];  // For complex reject paths with multiple nodes
}

/** A single node in the flow */
export interface FlowNodeData {
  stepId?: string;           // Numeric part: "10", "20"
  type: FlowNodeType;
  description?: string;
  equipment?: string;        // machineDeviceTool
  department?: string;
  critical?: boolean;
  criticalType?: string;     // "CC", "SC", "CC, SC"
  isExternal?: boolean;
  labelCondition?: string;   // For condition: "¿PRODUCTO CONFORME?"
  labelDown?: string;        // "SI" on the OK downward path
  branchSide?: FlowBranchSide;
  branches?: FlowNodeData[][]; // Parallel split columns
  rework?: { targetId: string };
  incomingConnector?: string;
  text?: string;             // For terminal nodes: "SCRAP"
}

/** Complete flow document for the renderer */
export interface FlowDocument {
  header: PfdHeader;
  flowData: FlowNodeData[];
  logoBase64: string;
  referenceLines: string[];
  hasAnyCcSc: boolean;
  skipNotes?: boolean;
}

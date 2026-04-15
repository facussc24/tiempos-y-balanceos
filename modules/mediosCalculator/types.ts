/**
 * Types for Medios Logísticos Calculator module.
 * Independent from APQP types — no shared imports.
 */

/** Container type reference (shared across projects) */
export interface ContainerType {
  id: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightRefKg: number | null;
  maxStacking: number;
  defaultPcs: number | null;
  createdBy?: string;
}

/** A piece (part) in a medios project */
export interface MediosPiece {
  id: string;
  projectId: string;
  pieceCode: string;
  description: string;
  family: string;
  client: string;
  stage: string;
  dailyDemand: number;
  leadTimeDays: number;
  safetyPct: number;
  containerTypeId: string;
  pcsPerContainer: number;
  productId: string | null;   // optional link to APQP product
  sortOrder: number;
  createdAt?: string;
}

/** Medios project (calculation scenario) */
export interface MediosProject {
  id: string;
  name: string;
  description: string;
  utilizationRate: number;    // 0.55 = 55% floor utilization
  availableM2: number | null; // plant available m², null = not set
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

/** Calculated result for a single piece (derived, not stored) */
export interface PieceResult {
  pieceId: string;
  pieceCode: string;
  description: string;
  family: string;
  client: string;
  stage: string;
  containers: number;
  inventoryPcs: number;
  coverageDays: number;
  m2PerContainer: number;
  floorPositions: number;
  m2Containers: number;
  m2FloorTotal: number;
  pctOfTotal: number;
  locationCode: string;
  coverageLevel: 'high' | 'medium' | 'ok';
}

/** Summary row for aggregations (by client, stage, or container type) */
export interface SummaryRow {
  label: string;
  containers: number;
  pieces: number;
  m2: number;
  pctSpace: number;
}

/** Sensitivity matrix cell */
export interface SensitivityCell {
  safetyPct: number;
  leadTimeDelta: number;
  totalContainers: number;
  isCurrent: boolean;
}

/** Space calculation result */
export interface SpaceResult {
  availableM2: number | null;
  neededM2: number;
  differenceM2: number | null;
  occupancyPct: number | null;
  status: 'exceeded' | 'ok' | 'unknown';
}

/** Tab identifiers for the module */
export type MediosTab = 'pieces' | 'results' | 'scenarios' | 'config';

/** New piece form data (before ID assignment) */
export type NewPieceData = Omit<MediosPiece, 'id' | 'projectId' | 'createdAt'>;

/** New project form data */
export type NewProjectData = Omit<MediosProject, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

import type { ProjectData } from './project';

// =============================================================================
// V4.0: MIX SCENARIO
// =============================================================================

export interface MixProductReference {
  path: string;           // Relative path to product JSON
  demand: number;         // Daily demand for this product
  percentage?: number;    // Calculated: demand / totalDemand

  // V8.3: Integrity validation
  sourceChecksum?: string;    // SHA-256 of critical task/time data
  lastVerifiedAt?: string;    // ISO timestamp of last verification
}

export interface MixScenario {
  type: 'mix_scenario';
  version: 1;
  name: string;
  createdAt: string;
  createdBy: string;

  products: MixProductReference[];
  totalDemand: number;

  // V8.3: Integrity validation metadata
  integrityVersion?: number;   // 1 = checksums enabled
  lastIntegrityCheck?: string; // ISO timestamp of last validation

  // Sector filter (optional - null = all sectors)
  targetSectorId?: string | null;

  // Balancing results (populated after calculation)
  results?: {
    totalOperators: number;
    calculatedAt: string;
    taktTime: number;
    stations: Array<{
      id: number;
      sectorId: string;
      tasks: string[];  // Task IDs
      weightedTime: number;
      productBreakdown: Record<string, number>; // productPath -> time contribution
    }>;
  };

  // Heijunka alert
  heijunkaWarning?: {
    enabled: boolean;
    sequence: string;  // "A-A-B-A-A-B"
    rationale: string;
  };
}

// =============================================================================
// V4.2: MIX SECTOR ANALYSIS (Sector-Based UX)
// =============================================================================

export interface ProductContribution {
  productPath: string;
  productName: string;
  color: string;
  timeContribution: number;    // Weighted seconds this product adds
  percentageOfTotal: number;   // 0-100
}

export interface MachineRequirement {
  machineId: string;
  machineName: string;
  unitsRequired: number;       // ceil(totalWeightedTime / (takt × OBE)) — OBE applied HERE
  unitsAvailable: number;      // From plantConfig inventory
  hasDeficit: boolean;
  totalWeightedTime: number;   // Sum of all weighted task times across products
  /** Saturation vs NOMINAL takt (without OBE). Standard per Toyota Yamazumi / AIAG.
   *  = (totalWeightedTime / (unitsRequired × taktTime)) × 100
   *  OBE is used only in unitsRequired, NOT here. DO NOT add OBE to denominator. */
  saturationPerUnit: number;
  productBreakdown: ProductContribution[];
  taskDescriptions: string[];  // Human-readable task names
}

export interface SectorRequirement {
  sectorId: string;
  sectorName: string;
  sectorColor: string;
  totalPuestos: number;        // Sum of all machine units
  machines: MachineRequirement[];
  manualOperators: number;     // Tasks without requiredMachineId
}

export interface MixSectorAnalysis {
  sectors: SectorRequirement[];
  totalPuestos: number;
  totalOperators: number;
  hasAnyDeficit: boolean;
  taktTime: number;
  totalDemand: number;
}

// V4.3: Parallel Station Alert (tasks requiring 2+ parallel workstations)
export interface ParallelStationAlert {
  productName: string;
  taskId: string;
  taskDescription: string;
  taskTime: number;
  taktTime: number;
  parallelStationsNeeded: number;  // ceil(taskTime / takt)
}

// Keep TaktViolation as alias for backward compatibility
export type TaktViolation = ParallelStationAlert;

// V5.0: Saved Mix Scenario (for persistence)
export interface MixSavedScenario {
  type: 'mix_saved_scenario';
  version: 1;
  id: string;                        // UUID
  name: string;                      // "Mix 2026-01-10"
  createdAt: string;                 // ISO timestamp

  // Inputs
  selectedProducts: Array<{
    path: string;
    name: string;
    demand: number;
  }>;
  totalDemand: number;
  setupMinutesPerShift?: number;  // V4.2: Tiempo de setup (opcional)

  // Results (from MixSimplifiedResult)
  result: MixSimplifiedResult;
}

// =============================================================================
// T-01 to T-05 FIX: MixEnrichedProduct for type-safe mix calculations
// =============================================================================

/**
 * Extended ProjectData with mix-specific runtime properties.
 * Used during MMALBP calculations to attach demand and percentage data.
 */
export interface MixEnrichedProduct extends ProjectData {
  _mixDemand?: number;      // Daily demand for this product in the mix
  _mixPath?: string;        // File path (relative or absolute)
  _mixPercentage?: number;  // Calculated: demand / totalDemand
}

// =============================================================================
// MIX REDESIGN V2 - Nuevos Tipos (Fase 1)
// Estos tipos soportan la UI simplificada sin modificar la lógica existente
// =============================================================================

/**
 * Producto seleccionable para Mix (vista simplificada)
 * Representa un producto en la grilla de selección con checkbox
 */
export interface MixSelectableProduct {
  path: string;              // Ruta al master.json
  displayName: string;       // Nombre visible (normalmente el nombre de la pieza)
  client: string;            // Cliente
  project: string;           // Proyecto
  part: string;              // Pieza
  dailyDemand: number;       // Pre-cargada del master.json
  isSelected: boolean;       // Estado de selección en UI
  isDefaultDemand?: boolean; // V5.3: true si la demanda es valor por defecto (no encontrada en archivo)
}

/**
 * Representación simplificada de una máquina en un sector
 */
export interface MixMachineCard {
  machineId: string;
  machineName: string;
  unitsRequired: number;
  unitsAvailable: number;
  hasDeficit: boolean;
  deficitMessage?: string;   // Mensaje en español simple
}

/**
 * Tarjeta de sector en resultados (vista simplificada)
 * Agrupa máquinas y operarios por zona de la planta
 */
export interface MixSectorCard {
  sectorId: string;
  sectorName: string;
  sectorColor: string;
  machines: MixMachineCard[];
  operatorsRequired: number;
  isShared: boolean;           // true si múltiples productos usan este sector
  sharedProducts: string[];    // nombres de productos que comparten
  alerts: string[];            // alertas en lenguaje simple
}

/**
 * Resultado simplificado de Mix para UI
 * Traduce los resultados técnicos a formato comprensible
 */
export interface MixSimplifiedResult {
  isViable: boolean;           // false si hay déficits o bloqueos
  taktTimeSeconds: number;     // Tiempo Takt calculado
  totalMachines: number;       // Total de máquinas necesarias
  totalOperators: number;      // Total de operarios necesarios
  sectors: MixSectorCard[];    // Resultados agrupados por sector
  summary: string;             // Resumen en una oración (español)
  warnings: string[];          // Alertas en lenguaje simple
  productBreakdown: Array<{    // Contribución de cada producto
    productName: string;
    percentage: number;
    color: string;
  }>;

  // V4.2: Expert feedback - process constraint violations (química, curado)
  processViolations?: Array<{
    taskId: string;
    taskDescription: string;
    requiredMachines: number;
    deficit: number;
    message: string;
  }>;

  // V4.2: Expert feedback - model-specific Takt violations
  modelAlerts?: Array<{
    modelName: string;
    taskId: string;
    taskDescription: string;
    message: string;
    severity: 'critical' | 'warning' | 'ok';
  }>;
}

/**
 * Estado de la vista de Mix V2
 */
export interface MixV2ViewState {
  step: 'select' | 'calculating' | 'results';
  selectedProducts: MixSelectableProduct[];
  result: MixSimplifiedResult | null;
  isLoading: boolean;
  error: string | null;
}

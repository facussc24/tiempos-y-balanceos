import type { Sector } from './sectors';
import type { MixSavedScenario } from './mix';

// =============================================================================
// V4.0: PLANT ASSET REGISTRY
// =============================================================================

export type MachineCategory = 'costura' | 'inyeccion' | 'ensamble' | 'otro';

export interface MachineType {
  id: string;                    // "PFAFF-001"
  name: string;                  // "Máquina Recta Industrial"
  sectorId: string;              // Reference to Sector.id
  /** @deprecated Category is now derived from sector. Kept for backward compatibility. */
  category?: MachineCategory;
  availableUnits: number;        // How many in plant (1-10)
  quantity?: number;             // T-07 FIX: Alias for availableUnits (legacy support)
  oeeBase?: number;              // Default OEE for this machine (0-1)
}

export interface PlantConfig {
  version: 1;
  lastModified: number;
  sectors: Sector[];             // Master list of sectors
  machines: MachineType[];       // Master list of machines
  savedMixScenarios?: MixSavedScenario[];  // V5.0: Saved Mix scenarios history
}

export const DEFAULT_PLANT_CONFIG: PlantConfig = {
  version: 1,
  lastModified: Date.now(),
  sectors: [
    { id: 'COSTURA', name: 'Costura', color: '#8B5CF6' },
    { id: 'INYECCION', name: 'Inyección', color: '#F59E0B' },
    { id: 'TAPIZADO', name: 'Tapizado', color: '#10B981' },
    { id: 'EMBALAJE', name: 'Embalaje', color: '#6366F1' }
  ],
  machines: [],
  savedMixScenarios: []
};

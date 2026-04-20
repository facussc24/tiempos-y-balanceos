/**
 * Hook para gestionar el catálogo central de activos de planta.
 *
 * Web build: persiste en localStorage bajo la clave `plant_assets`.
 * Historically the Tauri build wrote to `{basePath}/00_CONFIG/plant_assets.json`
 * on the shared drive; that path is no longer used.
 *
 * @module usePlantAssets
 */
import { useState, useEffect, useCallback } from 'react';
import { PlantConfig, MachineType, Sector, DEFAULT_PLANT_CONFIG, MixSavedScenario } from '../types';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'plant_assets';

/**
 * Valida la estructura mínima de PlantConfig.
 */
function isValidPlantConfig(data: unknown): data is PlantConfig {
    if (!data || typeof data !== 'object') return false;

    const config = data as Record<string, unknown>;

    if (typeof config.version !== 'number') return false;
    if (!Array.isArray(config.sectors)) return false;
    if (!Array.isArray(config.machines)) return false;

    for (const sector of config.sectors) {
        if (!sector || typeof sector !== 'object') return false;
        const s = sector as Record<string, unknown>;
        if (typeof s.id !== 'string' || typeof s.name !== 'string') return false;
    }

    for (const machine of config.machines) {
        if (!machine || typeof machine !== 'object') return false;
        const m = machine as Record<string, unknown>;
        if (typeof m.id !== 'string' || typeof m.name !== 'string') return false;
    }

    if (config.savedMixScenarios !== undefined && !Array.isArray(config.savedMixScenarios)) {
        return false;
    }

    return true;
}

export interface UsePlantAssetsResult {
    config: PlantConfig;
    isLoading: boolean;
    error: string | null;
    sectors: Sector[];
    machines: MachineType[];
    getMachinesBySector: (sectorId: string) => MachineType[];
    addMachine: (machine: MachineType) => Promise<boolean>;
    updateMachine: (id: string, updates: Partial<MachineType>) => Promise<boolean>;
    deleteMachine: (id: string) => Promise<boolean>;
    addSector: (sector: Sector) => Promise<boolean>;
    refreshAssets: () => Promise<void>;
    saveMixScenario: (scenario: MixSavedScenario) => Promise<boolean>;
    deleteMixScenario: (id: string) => Promise<boolean>;
    savedMixScenarios: MixSavedScenario[];
    /** Always 'none' in the web build (kept for API compatibility). */
    storageSource: 'local' | 'shared' | 'none';
    /** Always null in the web build (kept for API compatibility). */
    storagePath: string | null;
}

export function usePlantAssets(): UsePlantAssetsResult {
    const [config, setConfig] = useState<PlantConfig>(DEFAULT_PLANT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAssets = useCallback(async (isMountedFn: () => boolean = () => true) => {
        setIsLoading(true);
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!isMountedFn()) return;

            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (isValidPlantConfig(parsed)) {
                        setConfig({
                            ...DEFAULT_PLANT_CONFIG,
                            ...parsed,
                            sectors: parsed.sectors?.length > 0 ? parsed.sectors : DEFAULT_PLANT_CONFIG.sectors,
                        });
                        logger.info('usePlantAssets', 'Loaded valid assets from localStorage');
                    } else {
                        logger.warn('usePlantAssets', 'Invalid localStorage config structure, using defaults');
                        setConfig(DEFAULT_PLANT_CONFIG);
                    }
                } catch (parseError) {
                    logger.error('usePlantAssets', 'localStorage JSON parse error', { error: String(parseError) });
                    setConfig(DEFAULT_PLANT_CONFIG);
                }
            } else {
                setConfig(DEFAULT_PLANT_CONFIG);
            }
            setError(null);
        } catch (e) {
            if (!isMountedFn()) return;
            logger.error('usePlantAssets', 'Load error', { error: String(e) });
            setError('No se pudo cargar el catálogo de planta');
            setConfig(DEFAULT_PLANT_CONFIG);
        } finally {
            if (isMountedFn()) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        loadAssets(() => isMounted);
        return () => { isMounted = false; };
    }, [loadAssets]);

    const saveAssetsInternal = async (newConfig: PlantConfig): Promise<boolean> => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
            return true;
        } catch (e) {
            logger.error('usePlantAssets', 'Save error', { error: String(e) });
            return false;
        }
    };

    const saveAssets = useCallback(async (newConfig: PlantConfig): Promise<boolean> => {
        const configToSave = {
            ...newConfig,
            lastModified: Date.now(),
        };

        const success = await saveAssetsInternal(configToSave);
        if (success) {
            setConfig(configToSave);
        }
        return success;
    }, []);

    const getMachinesBySector = useCallback((sectorId: string): MachineType[] => {
        return config.machines.filter(m => m.sectorId === sectorId);
    }, [config.machines]);

    const addMachine = useCallback(async (machine: MachineType): Promise<boolean> => {
        if (!machine.id || !machine.name || !machine.sectorId) {
            logger.error('usePlantAssets', 'Invalid machine data');
            return false;
        }

        if (config.machines.some(m => m.id === machine.id)) {
            logger.error('usePlantAssets', 'Machine ID already exists', { machineId: machine.id });
            return false;
        }

        const newConfig: PlantConfig = {
            ...config,
            machines: [...config.machines, machine],
        };
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    const updateMachine = useCallback(async (id: string, updates: Partial<MachineType>): Promise<boolean> => {
        const newConfig: PlantConfig = {
            ...config,
            machines: config.machines.map(m =>
                m.id === id ? { ...m, ...updates } : m
            ),
        };
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    const deleteMachine = useCallback(async (id: string): Promise<boolean> => {
        const newConfig: PlantConfig = {
            ...config,
            machines: config.machines.filter(m => m.id !== id),
        };
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    const addSector = useCallback(async (sector: Sector): Promise<boolean> => {
        if (config.sectors.some(s => s.id === sector.id)) {
            logger.error('usePlantAssets', 'Sector ID already exists', { sectorId: sector.id });
            return false;
        }

        const newConfig: PlantConfig = {
            ...config,
            sectors: [...config.sectors, sector],
        };
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    const saveMixScenario = useCallback(async (scenario: MixSavedScenario): Promise<boolean> => {
        const existingScenarios = config.savedMixScenarios || [];
        const existingIndex = existingScenarios.findIndex(s => s.id === scenario.id);

        let newScenarios: MixSavedScenario[];
        if (existingIndex >= 0) {
            newScenarios = existingScenarios.map((s, i) => i === existingIndex ? scenario : s);
        } else {
            newScenarios = [scenario, ...existingScenarios].slice(0, 20);
        }

        const newConfig: PlantConfig = {
            ...config,
            savedMixScenarios: newScenarios,
        };

        logger.info('usePlantAssets', 'Saving Mix scenario', { id: scenario.id, name: scenario.name });
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    const deleteMixScenario = useCallback(async (id: string): Promise<boolean> => {
        const newConfig: PlantConfig = {
            ...config,
            savedMixScenarios: (config.savedMixScenarios || []).filter(s => s.id !== id),
        };
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    return {
        config,
        isLoading,
        error,
        sectors: config.sectors,
        machines: config.machines,
        getMachinesBySector,
        addMachine,
        updateMachine,
        deleteMachine,
        addSector,
        refreshAssets: loadAssets as () => Promise<void>,
        saveMixScenario,
        deleteMixScenario,
        savedMixScenarios: config.savedMixScenarios || [],
        storageSource: 'none',
        storagePath: null,
    };
}

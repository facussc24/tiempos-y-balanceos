/**
 * Hook para gestionar el catálogo central de activos de planta (plant_assets.json)
 * 
 * Integrado con storageManager para usar la misma ruta base que los proyectos.
 * El archivo se guarda en 00_CONFIG/plant_assets.json dentro del basePath activo.
 * 
 * @module usePlantAssets
 * @version 1.0.0-beta - Integrated with storageManager for unified storage
 */
import { useState, useEffect, useCallback } from 'react';
import { PlantConfig, MachineType, Sector, DEFAULT_PLANT_CONFIG, MixSavedScenario } from '../types';
import { isTauri } from '../utils/unified_fs';
import { logger } from '../utils/logger';
import { getActiveBasePath, getCurrentMode } from '../utils/storageManager';

/** Result type for path resolution */
interface PathResult {
    path: string | null;
    source: 'local' | 'shared' | 'none';
}

/** Config folder name */
const CONFIG_FOLDER = '00_CONFIG';
const ASSETS_FILE = 'plant_assets.json';

/**
 * Get the path to plant assets using storageManager.
 * 
 * Uses the same base path as projects, storing in 00_CONFIG subfolder.
 * This means plant assets will sync together with projects when using SyncPanel.
 * 
 * @returns Path info with source indicator
 */
const getAssetsPath = async (): Promise<PathResult> => {
    if (!isTauri()) return { path: null, source: 'none' };

    try {
        const tauriFs = await import('../utils/tauri_fs');

        // Get the active base path from storageManager
        const basePath = await getActiveBasePath();
        const currentMode = await getCurrentMode();

        // Config folder path
        const configDir = `${basePath}\\${CONFIG_FOLDER}`;

        // Ensure config directory exists
        try {
            await tauriFs.ensureDir(configDir);
        } catch (dirError) {
            logger.warn('usePlantAssets', 'Cannot create config dir, trying AppData fallback', {
                configDir,
                error: String(dirError)
            });

            // Fallback to AppData if base path is not accessible
            const appData = await tauriFs.getAppDataDir();
            if (appData) {
                await tauriFs.ensureDir(appData);
                return {
                    path: `${appData}${ASSETS_FILE}`,
                    source: 'local'
                };
            }
            return { path: null, source: 'none' };
        }

        const assetsPath = `${configDir}\\${ASSETS_FILE}`;
        logger.info('usePlantAssets', 'Using storage path', {
            path: assetsPath,
            mode: currentMode
        });

        return {
            path: assetsPath,
            source: currentMode
        };
    } catch (e) {
        logger.error('usePlantAssets', 'Failed to get assets path', { error: String(e) });
        return { path: null, source: 'none' };
    }
};

/**
 * Valida la estructura mínima de PlantConfig.
 * Retorna true si el config es válido, false si está corrupto.
 * 
 * @param data - Datos parseados del JSON
 * @returns true si la estructura es válida
 */
function isValidPlantConfig(data: unknown): data is PlantConfig {
    if (!data || typeof data !== 'object') return false;

    const config = data as Record<string, unknown>;

    // Validar campos críticos
    if (typeof config.version !== 'number') return false;
    if (!Array.isArray(config.sectors)) return false;
    if (!Array.isArray(config.machines)) return false;

    // Validar estructura mínima de sectores
    for (const sector of config.sectors) {
        if (!sector || typeof sector !== 'object') return false;
        const s = sector as Record<string, unknown>;
        if (typeof s.id !== 'string' || typeof s.name !== 'string') return false;
    }

    // Validar estructura mínima de máquinas
    for (const machine of config.machines) {
        if (!machine || typeof machine !== 'object') return false;
        const m = machine as Record<string, unknown>;
        if (typeof m.id !== 'string' || typeof m.name !== 'string') return false;
    }

    // Validar savedMixScenarios si existe
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
    /** V5.0: Save Mix scenario */
    saveMixScenario: (scenario: MixSavedScenario) => Promise<boolean>;
    /** V5.0: Delete Mix scenario */
    deleteMixScenario: (id: string) => Promise<boolean>;
    /** V5.0: Get saved Mix scenarios */
    savedMixScenarios: MixSavedScenario[];
    /** Current storage source: 'local' | 'shared' | 'none' */
    storageSource: 'local' | 'shared' | 'none';
    /** Current storage path (for debugging/display) */
    storagePath: string | null;
}

export function usePlantAssets(): UsePlantAssetsResult {
    const [config, setConfig] = useState<PlantConfig>(DEFAULT_PLANT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [storageSource, setStorageSource] = useState<'local' | 'shared' | 'none'>('none');
    const [storagePath, setStoragePath] = useState<string | null>(null);

    // FIX: loadAssets extracted with isMounted guard to prevent state updates after unmount
    const loadAssets = useCallback(async (isMountedFn: () => boolean = () => true) => {
        setIsLoading(true);
        try {
            if (isTauri()) {
                const tauriFs = await import('../utils/tauri_fs');
                const pathResult = await getAssetsPath();
                if (!isMountedFn()) return;

                setStorageSource(pathResult.source);
                setStoragePath(pathResult.path);

                if (!pathResult.path) {
                    logger.warn('usePlantAssets', 'No path available, using defaults');
                    setConfig(DEFAULT_PLANT_CONFIG);
                    setError(null);
                    return;
                }

                const fileExists = await tauriFs.exists(pathResult.path);
                if (!isMountedFn()) return;

                if (fileExists) {
                    const content = await tauriFs.readTextFile(pathResult.path);
                    if (!isMountedFn()) return;
                    if (content) {
                        try {
                            const parsed = JSON.parse(content);

                            if (isValidPlantConfig(parsed)) {
                                // Config válido - usar normalmente
                                setConfig({
                                    ...DEFAULT_PLANT_CONFIG,
                                    ...parsed,
                                    sectors: parsed.sectors?.length > 0 ? parsed.sectors : DEFAULT_PLANT_CONFIG.sectors
                                });
                                logger.info('usePlantAssets', 'Loaded valid assets', {
                                    path: pathResult.path,
                                    source: pathResult.source
                                });
                                setError(null);
                            } else {
                                // Config inválido - usar defaults y notificar
                                logger.warn('usePlantAssets', 'Invalid config structure, using defaults', {
                                    path: pathResult.path
                                });
                                setConfig(DEFAULT_PLANT_CONFIG);
                                setError('El archivo de configuración tiene formato inválido. Se usaron valores por defecto.');
                            }
                        } catch (parseError) {
                            // JSON corrupto - usar defaults y notificar
                            logger.error('usePlantAssets', 'JSON parse error', {
                                error: String(parseError),
                                path: pathResult.path
                            });
                            setConfig(DEFAULT_PLANT_CONFIG);
                            setError('Error al leer configuración: archivo corrupto.');
                        }
                    }
                } else {
                    // First run - create default config
                    logger.info('usePlantAssets', 'No assets file found, creating defaults', {
                        path: pathResult.path
                    });
                    await saveAssetsInternal(DEFAULT_PLANT_CONFIG, pathResult.path);
                    if (!isMountedFn()) return;
                    setConfig(DEFAULT_PLANT_CONFIG);
                    setError(null);
                }
            } else {
                // Web mode - use localStorage fallback
                setStorageSource('none');
                setStoragePath(null);

                const stored = localStorage.getItem('plant_assets');
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (isValidPlantConfig(parsed)) {
                            // Config válido - usar normalmente (mismo patrón que Tauri mode)
                            setConfig({
                                ...DEFAULT_PLANT_CONFIG,
                                ...parsed,
                                sectors: parsed.sectors?.length > 0 ? parsed.sectors : DEFAULT_PLANT_CONFIG.sectors
                            });
                            logger.info('usePlantAssets', 'Loaded valid assets from localStorage');
                        } else {
                            // Config inválido - usar defaults
                            logger.warn('usePlantAssets', 'Invalid localStorage config structure, using defaults');
                            setConfig(DEFAULT_PLANT_CONFIG);
                        }
                    } catch (parseError) {
                        // JSON corrupto - usar defaults
                        logger.error('usePlantAssets', 'localStorage JSON parse error', { error: String(parseError) });
                        setConfig(DEFAULT_PLANT_CONFIG);
                    }
                } else {
                    setConfig(DEFAULT_PLANT_CONFIG);
                }
                setError(null);
            }
        } catch (e) {
            if (!isMountedFn()) return;
            logger.error('usePlantAssets', 'Load error', { error: String(e) });
            setError('No se pudo cargar el catálogo de planta');
            setConfig(DEFAULT_PLANT_CONFIG);
        } finally {
            if (isMountedFn()) setIsLoading(false);
        }
    }, []);

    // Load assets on mount with isMounted guard
    useEffect(() => {
        let isMounted = true;
        loadAssets(() => isMounted);
        return () => { isMounted = false; };
    }, [loadAssets]);

    const saveAssetsInternal = async (newConfig: PlantConfig, overridePath?: string): Promise<boolean> => {
        try {
            if (isTauri()) {
                const tauriFs = await import('../utils/tauri_fs');

                // Use override path if provided, otherwise get current path
                let path = overridePath;
                if (!path) {
                    const pathResult = await getAssetsPath();
                    path = pathResult.path;
                }

                if (!path) {
                    logger.error('usePlantAssets', 'Cannot save: no path available');
                    return false;
                }

                // Ensure directory exists
                const dir = path.substring(0, path.lastIndexOf('\\'));
                await tauriFs.ensureDir(dir);

                const success = await tauriFs.writeTextFile(path, JSON.stringify(newConfig, null, 2));
                if (success) {
                    logger.info('usePlantAssets', 'Assets saved successfully', { path });
                } else {
                    logger.error('usePlantAssets', 'Failed to write file', { path });
                }
                return success;
            } else {
                // Web mode - use localStorage
                localStorage.setItem('plant_assets', JSON.stringify(newConfig));
                return true;
            }
        } catch (e) {
            logger.error('usePlantAssets', 'Save error', { error: String(e) });
            return false;
        }
    };

    const saveAssets = useCallback(async (newConfig: PlantConfig): Promise<boolean> => {
        const configToSave = {
            ...newConfig,
            lastModified: Date.now()
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
        // Validate machine has required fields
        if (!machine.id || !machine.name || !machine.sectorId) {
            logger.error('usePlantAssets', 'Invalid machine data');
            return false;
        }

        // Check for duplicate ID
        if (config.machines.some(m => m.id === machine.id)) {
            logger.error('usePlantAssets', 'Machine ID already exists', { machineId: machine.id });
            return false;
        }

        const newConfig: PlantConfig = {
            ...config,
            machines: [...config.machines, machine]
        };
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    const updateMachine = useCallback(async (id: string, updates: Partial<MachineType>): Promise<boolean> => {
        const newConfig: PlantConfig = {
            ...config,
            machines: config.machines.map(m =>
                m.id === id ? { ...m, ...updates } : m
            )
        };
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    const deleteMachine = useCallback(async (id: string): Promise<boolean> => {
        const newConfig: PlantConfig = {
            ...config,
            machines: config.machines.filter(m => m.id !== id)
        };
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    const addSector = useCallback(async (sector: Sector): Promise<boolean> => {
        // Check for duplicate ID
        if (config.sectors.some(s => s.id === sector.id)) {
            logger.error('usePlantAssets', 'Sector ID already exists', { sectorId: sector.id });
            return false;
        }

        const newConfig: PlantConfig = {
            ...config,
            sectors: [...config.sectors, sector]
        };
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    // V5.0: Save Mix Scenario
    const saveMixScenario = useCallback(async (scenario: MixSavedScenario): Promise<boolean> => {
        const existingScenarios = config.savedMixScenarios || [];

        // Check if updating existing or adding new
        const existingIndex = existingScenarios.findIndex(s => s.id === scenario.id);

        let newScenarios: MixSavedScenario[];
        if (existingIndex >= 0) {
            // Update existing
            newScenarios = existingScenarios.map((s, i) => i === existingIndex ? scenario : s);
        } else {
            // Add new (limit to 20 most recent)
            newScenarios = [scenario, ...existingScenarios].slice(0, 20);
        }

        const newConfig: PlantConfig = {
            ...config,
            savedMixScenarios: newScenarios
        };

        logger.info('usePlantAssets', 'Saving Mix scenario', { id: scenario.id, name: scenario.name });
        return saveAssets(newConfig);
    }, [config, saveAssets]);

    // V5.0: Delete Mix Scenario
    const deleteMixScenario = useCallback(async (id: string): Promise<boolean> => {
        const newConfig: PlantConfig = {
            ...config,
            savedMixScenarios: (config.savedMixScenarios || []).filter(s => s.id !== id)
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
        refreshAssets: loadAssets,
        saveMixScenario,
        deleteMixScenario,
        savedMixScenarios: config.savedMixScenarios || [],
        storageSource,
        storagePath
    };
}

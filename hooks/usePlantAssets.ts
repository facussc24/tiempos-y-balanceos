/**
 * Hook para gestionar el catálogo central de activos de planta.
 *
 * Persistencia: Supabase (tabla `settings`, clave `plant_assets`) vía
 * settingsRepository. Esto evita la pérdida de datos al cambiar de PC/navegador
 * o limpiar caché (antes se guardaba SOLO en localStorage).
 *
 * localStorage se mantiene como cache offline / fuente de migración: si hay datos
 * locales más nuevos que la copia de la nube, se eligen y se suben (migración one-shot).
 *
 * @module usePlantAssets
 */
import { useState, useEffect, useCallback } from 'react';
import { PlantConfig, MachineType, Sector, DEFAULT_PLANT_CONFIG, MixSavedScenario } from '../types';
import { logger } from '../utils/logger';
import { getSetting, setSettingChecked } from '../utils/repositories/settingsRepository';

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
    /** De dónde se cargó/guardó: 'supabase' (nube), 'local' (solo localStorage), 'none'. */
    storageSource: 'supabase' | 'local' | 'shared' | 'none';
    /** Always null in the web build (kept for API compatibility). */
    storagePath: string | null;
}

export function usePlantAssets(): UsePlantAssetsResult {
    const [config, setConfig] = useState<PlantConfig>(DEFAULT_PLANT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [storageSource, setStorageSource] = useState<'supabase' | 'local' | 'shared' | 'none'>('none');

    const loadAssets = useCallback(async (isMountedFn: () => boolean = () => true) => {
        setIsLoading(true);
        const lastMod = (c: unknown): number => {
            const v = (c as { lastModified?: unknown } | null)?.lastModified;
            return typeof v === 'number' ? v : 0;
        };
        try {
            // Fuente 1: Supabase (canónica, sobrevive cambio de PC/navegador/caché).
            let cloud: PlantConfig | null = null;
            try {
                const c = await getSetting<PlantConfig>(STORAGE_KEY);
                if (c && isValidPlantConfig(c)) cloud = c;
            } catch (cloudErr) {
                logger.warn('usePlantAssets', 'No se pudo leer de Supabase; intento localStorage', { error: String(cloudErr) });
            }

            // Fuente 2: localStorage (cache local / datos legacy aún no migrados).
            let local: PlantConfig | null = null;
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (isValidPlantConfig(parsed)) local = parsed;
                }
            } catch (localErr) {
                logger.warn('usePlantAssets', 'localStorage ilegible', { error: String(localErr) });
            }

            if (!isMountedFn()) return;

            // Elegir la fuente MÁS FRESCA (por lastModified). Protege la config actual
            // de Fak: si su localStorage es más nuevo que la copia de la nube, gana el
            // local y se sube a Supabase (migración one-shot). Evita pisar datos buenos.
            let chosen: PlantConfig | null = null;
            let source: 'supabase' | 'local' | 'none' = 'none';
            if (cloud && local) {
                if (lastMod(local) > lastMod(cloud)) { chosen = local; source = 'local'; }
                else { chosen = cloud; source = 'supabase'; }
            } else if (cloud) { chosen = cloud; source = 'supabase'; }
            else if (local) { chosen = local; source = 'local'; }

            if (chosen) {
                setConfig({
                    ...DEFAULT_PLANT_CONFIG,
                    ...chosen,
                    sectors: chosen.sectors?.length > 0 ? chosen.sectors : DEFAULT_PLANT_CONFIG.sectors,
                });
                // Migración/sync: si lo elegido vino de local, subirlo a la nube.
                if (source === 'local') {
                    const ok = await setSettingChecked(STORAGE_KEY, chosen);
                    if (ok) {
                        source = 'supabase';
                        logger.info('usePlantAssets', 'Catálogo de planta migrado/sincronizado a Supabase');
                    }
                }
                logger.info('usePlantAssets', `Catálogo de planta cargado desde ${source}`);
            } else {
                setConfig(DEFAULT_PLANT_CONFIG);
            }
            if (isMountedFn()) setStorageSource(source);
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
        // Primario: Supabase (canónico, sobrevive cambio de PC). Secundario:
        // localStorage como cache offline (si la nube está caída, no se pierde el dato).
        let cloudOk = false;
        try {
            cloudOk = await setSettingChecked(STORAGE_KEY, newConfig);
        } catch (e) {
            logger.error('usePlantAssets', 'Cloud save error', { error: String(e) });
        }
        let localOk = false;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
            localOk = true;
        } catch (e) {
            logger.warn('usePlantAssets', 'localStorage mirror failed', { error: String(e) });
        }
        if (cloudOk) setStorageSource('supabase');
        // Éxito si quedó guardado en algún lado (la nube es la preferida).
        return cloudOk || localOk;
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
        storageSource,
        storagePath: null,
    };
}

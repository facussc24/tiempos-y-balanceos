// hooks/useProjectPersistence.ts
/**
 * Hook for managing project persistence, auto-save, and conflict resolution.
 * Extracted from App.tsx to reduce component complexity.
 */
import { useState, useEffect, useCallback } from 'react';
import { ProjectData, INITIAL_PROJECT } from '../types';
import { saveProject, loadProject, listProjects } from '../utils/repositories/projectRepository';
import { initFileSystem, isTauri, getAppInfo, readTextFile } from '../utils/unified_fs';
import { SaveConflict, ConflictError } from '../utils/concurrency';
import { toast } from '../components/ui/Toast';
import { logger } from '../utils/logger';

interface UsePersistenceResult {
    data: ProjectData;
    setData: React.Dispatch<React.SetStateAction<ProjectData>>;
    isDbLoaded: boolean;
    isInitializing: boolean;
    initError: string | null;
    lastSaved: string;
    isSaving: boolean;
    saveConflict: SaveConflict | null;

    // Estados para modales de confirmación (reemplazan confirm/prompt nativos)
    saveConfirmPending: boolean;
    userInputPending: { resolve: (value: string | null) => void } | null;

    // Actions
    handleSave: () => Promise<void>;
    handleQuickSave: () => Promise<void>;
    handleSaveConfirmed: (user: string) => Promise<void>;
    handleSaveCancelled: () => void;
    handleConflictReload: () => Promise<void>;
    handleConflictSaveAsNew: () => Promise<void>;
    handleConflictCancel: () => void;
    loadLatestProject: () => Promise<boolean>;
}

export function useProjectPersistence(): UsePersistenceResult {
    const [data, setData] = useState<ProjectData>(INITIAL_PROJECT);
    const [isDbLoaded, setIsDbLoaded] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const [lastSaved, setLastSaved] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveConflict, setSaveConflict] = useState<SaveConflict | null>(null);
    const [conflictPendingData, setConflictPendingData] = useState<ProjectData | null>(null);

    // Estados para modales de confirmación (reemplazan confirm/prompt nativos)
    const [saveConfirmPending, setSaveConfirmPending] = useState(false);
    const [userInputPending, setUserInputPending] = useState<{ resolve: (value: string | null) => void } | null>(null);

    // Load latest project from SQLite
    const loadLatestProject = useCallback(async (): Promise<boolean> => {
        try {
            const projects = await listProjects();
            if (projects.length > 0) {
                // listProjects returns sorted by updated_at DESC, so first is latest
                const latest = projects[0];
                const loadedData = await loadProject(latest.id);
                if (loadedData) {
                    setData(loadedData);
                    return true;
                }
            }
        } catch (e: any) {
            logger.error('useProjectPersistence', 'Error loading latest project', { error: String(e) });
        }
        return false;
    }, [setData]);

    // H-03 Fix: Initial Load with isMounted guard
    useEffect(() => {
        let isMounted = true;

        const initLoad = async () => {
            try {
                await initFileSystem();
                const appInfo = getAppInfo();
                logger.info('App', 'Running mode detected', { mode: appInfo.mode });

                if (isMounted) {
                    await loadLatestProject();
                }
            } catch (e: any) {
                logger.error('useProjectPersistence', 'Error loading from DB/FS', { error: String(e) });
                if (isMounted) {
                    setInitError(e.message || String(e));
                }
            } finally {
                if (isMounted) {
                    setIsDbLoaded(true);
                    setIsInitializing(false);
                }
            }
        };
        initLoad();

        return () => {
            isMounted = false;
        };
    }, []); // H-03 Fix: Empty deps - run once on mount

    // H-01 Fix: Auto-Save (debounced 2 seconds) - BLOCKED during manual save
    useEffect(() => {
        if (!isDbLoaded) return;

        // H-01 Fix: Skip auto-save if manual save is in progress
        if (isSaving) {
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const newId = await saveProject(data);
                if (!data.id) {
                    setData(prev => ({ ...prev, id: newId }));
                }
                setLastSaved(new Date().toLocaleTimeString());
            } catch (e) {
                // H-01 Fix: Log error with warning toast instead of silent failure
                logger.warn('useProjectPersistence', 'Auto-save error', { error: String(e) });
                toast.warning('Auto-guardado fallido', 'Error guardando borrador local');
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [data, isDbLoaded, isSaving]); // H-01 Fix: Added isSaving dependency

    // Ejecutar guardado (lógica principal)
    const handleSaveConfirmed = useCallback(async (user: string) => {
        setSaveConfirmPending(false);
        if (!data.fileHandle || !data.directoryHandle) return;

        const dataWithUser = { ...data, meta: { ...data.meta, modifiedBy: user || "Desconocido" } };

        try {
            setIsSaving(true);
            let newData: ProjectData;

            if (isTauri() && typeof data.fileHandle === 'string') {
                const { smartSaveProjectTauri } = await import('../utils/tauri_smart_save');
                newData = await smartSaveProjectTauri(
                    data.fileHandle as string,
                    data.directoryHandle as string,
                    dataWithUser
                );
            } else {
                const { smartSaveProject } = await import('../utils/webFsHelpers');
                newData = await smartSaveProject(
                    data.fileHandle as FileSystemFileHandle,
                    data.directoryHandle as FileSystemDirectoryHandle,
                    dataWithUser
                );
            }

            setData(newData);
            await saveProject(newData);
            toast.success('Proyecto Guardado', `Nueva Versión: ${newData.meta.version}`);
        } catch (err) {
            if (err instanceof ConflictError) {
                setSaveConflict(err.conflict);
                setConflictPendingData(dataWithUser);
                toast.warning('Conflicto Detectado', 'Archivo modificado externamente');
            } else {
                toast.error('Error al Guardar', String(err));
            }
        } finally {
            setIsSaving(false);
        }
    }, [data]);

    // Iniciar flujo de guardado - Guardar directamente sin modal de confirmación
    const handleSave = useCallback(async () => {
        if (!data.fileHandle || !data.directoryHandle) {
            toast.warning('Sin Proyecto', 'Abre o crea un proyecto primero');
            return;
        }
        // Guardar directamente con usuario por defecto (modo local)
        await handleSaveConfirmed("Usuario Local");
    }, [data.fileHandle, data.directoryHandle, handleSaveConfirmed]);

    // Guardado rápido - sin incrementar versión ni crear backup
    const handleQuickSave = useCallback(async () => {
        if (!data.fileHandle || !data.directoryHandle) {
            toast.info('Sin proyecto', 'Abre o crea un proyecto primero');
            return;
        }

        try {
            setIsSaving(true);

            if (isTauri() && typeof data.fileHandle === 'string') {
                const { quickSaveTauri } = await import('../utils/tauri_smart_save');
                await quickSaveTauri(data.fileHandle as string, data);
            } else {
                // Web mode fallback - direct JSON write
                const { fileHandle: _, directoryHandle: __, ...serializable } = data;
                const content = JSON.stringify({ ...serializable, lastModified: Date.now() }, null, 2);
                const writable = await (data.fileHandle as FileSystemFileHandle).createWritable();
                await writable.write(content);
                await writable.close();
            }

            setLastSaved(new Date().toLocaleTimeString());
            toast.success('Guardado', 'Cambios guardados');
        } catch (err) {
            logger.error('useProjectPersistence', 'Quick save error', { error: String(err) });
            toast.error('Error', String(err));
        } finally {
            setIsSaving(false);
        }
    }, [data]);

    // Cancelar guardado
    const handleSaveCancelled = useCallback(() => {
        setSaveConfirmPending(false);
    }, []);

    // Conflict Resolution: Reload from disk
    const handleConflictReload = useCallback(async () => {
        if (!data.fileHandle) return;

        try {
            if (isTauri() && typeof data.fileHandle === 'string') {
                const content = await readTextFile(data.fileHandle as string);
                if (content) {
                    const reloaded = JSON.parse(content) as ProjectData;
                    reloaded.fileHandle = data.fileHandle;
                    reloaded.directoryHandle = data.directoryHandle;
                    setData(reloaded);
                    toast.success('Proyecto Recargado', 'Se cargó la versión del disco');
                }
            } else {
                const { readProjectFile } = await import('../utils/webFsHelpers');
                // Type assertion: Web FileSystem API
                const reloaded = await readProjectFile(data.fileHandle as FileSystemFileHandle);
                if (reloaded) {
                    reloaded.directoryHandle = data.directoryHandle;
                    setData(reloaded);
                    toast.success('Proyecto Recargado', 'Se cargó la versión del disco');
                }
            }
        } catch (err) {
            toast.error('Error al Recargar', String(err));
        }
        setSaveConflict(null);
        setConflictPendingData(null);
    }, [data.fileHandle, data.directoryHandle]);

    // Conflict Resolution: Save as new version
    const handleConflictSaveAsNew = useCallback(async () => {
        if (!conflictPendingData || !data.fileHandle || !data.directoryHandle) return;

        const newData = {
            ...conflictPendingData,
            meta: {
                ...conflictPendingData.meta,
                version: `${conflictPendingData.meta.version}-conflict-resolved`
            },
            _checksum: undefined,
            _loadedTimestamp: undefined
        };

        try {
            setIsSaving(true);
            if (isTauri() && typeof data.fileHandle === 'string') {
                const { smartSaveProjectTauri } = await import('../utils/tauri_smart_save');
                const saved = await smartSaveProjectTauri(data.fileHandle as string, data.directoryHandle as string, newData);
                setData(saved);
            } else {
                const { smartSaveProject } = await import('../utils/webFsHelpers');
                // Type assertion: Web FileSystem API
                const saved = await smartSaveProject(
                    data.fileHandle as FileSystemFileHandle,
                    data.directoryHandle as FileSystemDirectoryHandle,
                    newData
                );
                setData(saved);
            }
            toast.success('Guardado como Nueva Versión', 'Conflicto resuelto');
        } catch (err) {
            toast.error('Error al Guardar', String(err));
        } finally {
            setIsSaving(false);
        }
        setSaveConflict(null);
        setConflictPendingData(null);
    }, [conflictPendingData, data.fileHandle, data.directoryHandle]);

    // Conflict Resolution: Cancel
    const handleConflictCancel = useCallback(() => {
        setSaveConflict(null);
        setConflictPendingData(null);
    }, []);

    return {
        data,
        setData,
        isDbLoaded,
        isInitializing,
        initError,
        lastSaved,
        isSaving,
        saveConflict,
        // Estados para modales de confirmación
        saveConfirmPending,
        userInputPending,
        // Actions
        handleSave,
        handleQuickSave,
        handleSaveConfirmed,
        handleSaveCancelled,
        handleConflictReload,
        handleConflictSaveAsNew,
        handleConflictCancel,
        loadLatestProject
    };
}

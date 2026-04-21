// hooks/useProjectPersistence.ts
/**
 * Hook for managing project persistence, auto-save, and conflict resolution.
 * Extracted from App.tsx to reduce component complexity.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectData, INITIAL_PROJECT } from '../types';
import { saveProject, loadProject, listProjects } from '../utils/repositories/projectRepository';
import { initFileSystem, getAppInfo } from '../utils/unified_fs';
import { SaveConflict, ConflictError } from '../utils/concurrency';
import { classifyError } from '../utils/networkUtils';
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
    isDirty: boolean;
    saveConflict: SaveConflict | null;
    lastSaveError: string | null;

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
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaveError, setLastSaveError] = useState<string | null>(null);

    // Estados para modales de confirmación (reemplazan confirm/prompt nativos)
    const [saveConfirmPending, setSaveConfirmPending] = useState(false);
    const [userInputPending] = useState<{ resolve: (value: string | null) => void } | null>(null);

    // P0-3 Fix: Guard refs to prevent auto-saving INITIAL_PROJECT over real data
    const hasLoadedRealDataRef = useRef(false);
    const mountTimeRef = useRef(Date.now());

    // Track last saved data for dirty detection
    const lastSavedDataRef = useRef<string>('');

    // Fix: Ref to always hold the latest data for auto-save (avoids stale closure in setTimeout)
    const dataRef = useRef(data);
    dataRef.current = data;

    // Dirty state tracking: mark dirty when data changes after a save
    useEffect(() => {
        if (!hasLoadedRealDataRef.current) return;
        if (!lastSavedDataRef.current) return;
        const { fileHandle: _, directoryHandle: __, _loadedTimestamp: ___, _checksum: ____, ...comparable } = data;
        const currentFingerprint = JSON.stringify(comparable);
        setIsDirty(currentFingerprint !== lastSavedDataRef.current);
    }, [data]);

    // P0-3 Fix: Wrapped setData that enables auto-save on any explicit user action
    // (new project, import, undo/redo, etc.) — all external callers go through this
    const setDataSafe: React.Dispatch<React.SetStateAction<ProjectData>> = useCallback(
        (action) => {
            hasLoadedRealDataRef.current = true;
            setData(action);
        },
        [setData]
    );

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
                    hasLoadedRealDataRef.current = true;
                    // Set initial fingerprint so dirty state starts clean
                    const { fileHandle: _, directoryHandle: __, _loadedTimestamp: ___, _checksum: ____, ...comparable } = loadedData;
                    lastSavedDataRef.current = JSON.stringify(comparable);
                    return true;
                }
                // P0-3: Projects exist but loadProject returned null — data corruption or DB issue
                logger.error('Persistence', 'Failed to load latest project - auto-save DISABLED until explicit user action');
            } else {
                // No projects yet (first use) — auto-save stays disabled until user creates one
                logger.info('Persistence', 'No existing projects found - awaiting explicit user action');
            }
        } catch (e: unknown) {
            logger.error('Persistence', 'Failed to load latest project - auto-save DISABLED until explicit user action', { error: String(e) });
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
            } catch (e: unknown) {
                logger.error('useProjectPersistence', 'Error loading from DB/FS', { error: String(e) });
                if (isMounted) {
                    setInitError(e instanceof Error ? e.message : String(e));
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
    // P0-3 Fix: Also blocked until real data is loaded or user takes explicit action
    useEffect(() => {
        if (!isDbLoaded) return;

        // P0-3 Fix: Don't auto-save until real data is loaded (prevents overwriting with INITIAL_PROJECT)
        if (!hasLoadedRealDataRef.current) return;

        // P0-3 Fix: Don't auto-save in the first 3 seconds after mount (race condition guard)
        if (Date.now() - mountTimeRef.current < 3000) return;

        // H-01 Fix: Skip auto-save if manual save is in progress
        if (isSaving) {
            return;
        }

        const timer = setTimeout(async () => {
            try {
                // Fix: Read latest data from ref to avoid stale closure
                const currentData = dataRef.current;
                const newId = await saveProject(currentData);
                if (!currentData.id) {
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

    // Helper: update dirty fingerprint after a successful save
    const markClean = useCallback((savedData: ProjectData) => {
        const { fileHandle: _, directoryHandle: __, _loadedTimestamp: ___, _checksum: ____, ...comparable } = savedData;
        lastSavedDataRef.current = JSON.stringify(comparable);
        setIsDirty(false);
        setLastSaveError(null);
    }, []);

    // Ejecutar guardado (lógica principal) con auto-retry para errores transitorios
    const handleSaveConfirmed = useCallback(async (user: string) => {
        setSaveConfirmPending(false);
        if (!data.fileHandle || !data.directoryHandle) return;

        const dataWithUser = { ...data, meta: { ...data.meta, modifiedBy: user || "Desconocido" } };
        const MAX_SAVE_RETRIES = 2;

        const attemptSave = async (): Promise<ProjectData> => {
            const { smartSaveProject } = await import('../utils/webFsHelpers');
            return await smartSaveProject(
                data.fileHandle as FileSystemFileHandle,
                data.directoryHandle as FileSystemDirectoryHandle,
                dataWithUser
            );
        };

        try {
            setIsSaving(true);
            setLastSaveError(null);

            let newData: ProjectData | null = null;

            // Auto-retry for transient network errors
            for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
                try {
                    newData = await attemptSave();
                    break; // Success
                } catch (err) {
                    // Don't retry conflicts - they need user resolution
                    if (err instanceof ConflictError) throw err;

                    // Only retry transient errors
                    const errClass = classifyError(err);
                    if (!errClass.isTransient || attempt >= MAX_SAVE_RETRIES) throw err;

                    // Wait before retry with increasing delay
                    const delay = (attempt + 1) * 1000;
                    logger.warn('Persistence', `Save attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
                        error: errClass.code,
                    });
                    await new Promise(r => setTimeout(r, delay));
                }
            }

            if (newData) {
                setData(newData);
                await saveProject(newData);
                markClean(newData);
                toast.success('Proyecto Guardado', `Nueva Version: ${newData.meta.version}`);
            }
        } catch (err) {
            if (err instanceof ConflictError) {
                setSaveConflict(err.conflict);
                setConflictPendingData(dataWithUser);
                toast.warning('Conflicto Detectado', 'Archivo modificado externamente');
            } else {
                const errClass = classifyError(err);
                const userMsg = errClass.userMessage || String(err);
                setLastSaveError(userMsg);
                toast.error('Error al Guardar', userMsg, [{
                    label: 'Reintentar',
                    onClick: () => handleSaveConfirmed(user),
                    primary: true,
                }]);
            }
        } finally {
            setIsSaving(false);
        }
    }, [data, markClean]);

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

            // Web mode - direct JSON write
            const { fileHandle: _, directoryHandle: __, ...serializable } = data;
            const content = JSON.stringify({ ...serializable, lastModified: Date.now() }, null, 2);
            const writable = await (data.fileHandle as FileSystemFileHandle).createWritable();
            await writable.write(content);
            await writable.close();

            setLastSaved(new Date().toLocaleTimeString());
            markClean(data);
            toast.success('Guardado', 'Cambios guardados');
        } catch (err) {
            const errClass = classifyError(err);
            logger.error('useProjectPersistence', 'Quick save error', { error: String(err) });
            toast.error('Error', errClass.userMessage || String(err));
        } finally {
            setIsSaving(false);
        }
    }, [data, markClean]);

    // Cancelar guardado
    const handleSaveCancelled = useCallback(() => {
        setSaveConfirmPending(false);
    }, []);

    // Conflict Resolution: Reload from disk
    const handleConflictReload = useCallback(async () => {
        if (!data.fileHandle) return;

        try {
            const { readProjectFile } = await import('../utils/webFsHelpers');
            // Type assertion: Web FileSystem API
            const reloaded = await readProjectFile(data.fileHandle as FileSystemFileHandle);
            if (reloaded) {
                reloaded.directoryHandle = data.directoryHandle;
                setData(reloaded);
                await saveProject(reloaded);
                toast.success('Proyecto Recargado', 'Se cargó la versión del disco');
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
            const { smartSaveProject } = await import('../utils/webFsHelpers');
            const saved = await smartSaveProject(
                data.fileHandle as FileSystemFileHandle,
                data.directoryHandle as FileSystemDirectoryHandle,
                newData
            );
            setData(saved);
            await saveProject(saved);
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
        setData: setDataSafe,
        isDbLoaded,
        isInitializing,
        initError,
        lastSaved,
        isSaving,
        isDirty,
        saveConflict,
        lastSaveError,
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

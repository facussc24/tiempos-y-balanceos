/**
 * Control Plan Project Management Hook
 *
 * Same pattern as useAmfeProjects: save/load/delete projects from network drive,
 * track unsaved changes, confirmation dialogs.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ControlPlanDocument } from './controlPlanTypes';
import {
    listControlPlanProjects,
    listControlPlanClients,
    listControlPlanProjectsByClient,
    loadControlPlan,
    saveControlPlan,
    deleteControlPlan,
    isCpPathAccessible,
    ControlPlanProjectInfo,
} from './controlPlanPathManager';
import { logger } from '../../utils/logger';
import { toast } from '../../components/ui/Toast';

/** State for the PromptModal integration */
export interface CpProjectPromptState {
    isOpen: boolean;
    title: string;
    message: string;
    defaultValue: string;
    onSubmit: (value: string) => void;
    onClose: () => void;
}

const CLOSED_PROMPT: CpProjectPromptState = {
    isOpen: false, title: '', message: '', defaultValue: '',
    onSubmit: () => {}, onClose: () => {},
};

type RequestConfirmFn = (options: {
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
}) => Promise<boolean>;

export const useControlPlanProjects = (
    currentData: ControlPlanDocument,
    onLoadProject: (data: ControlPlanDocument) => void,
    onResetProject: () => void,
    requestConfirm: RequestConfirmFn
) => {
    const [currentProject, setCurrentProject] = useState('');
    const [projects, setProjects] = useState<ControlPlanProjectInfo[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [networkAvailable, setNetworkAvailable] = useState(true);
    const [promptState, setPromptState] = useState<CpProjectPromptState>(CLOSED_PROMPT);
    const [loadError, setLoadError] = useState<string>('');
    /** True while loading a project from SQLite (shows skeleton in UI) */
    const [isLoadingProject, setIsLoadingProject] = useState(false);

    // Client hierarchy filter state
    const [clients, setClients] = useState<string[]>([]);
    const [selectedClient, setSelectedClient] = useState('');

    const savedSnapshotRef = useRef('');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const changeDetectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savingRef = useRef(false);

    /** Refresh the client list for hierarchy filtering */
    const refreshClients = useCallback(async () => {
        try {
            const list = await listControlPlanClients();
            setClients(list);
        } catch (err) {
            logger.error('ControlPlan', 'Error loading clients', { error: err instanceof Error ? err.message : String(err) });
        }
    }, []);

    // FIX: refreshProjects MUST be declared BEFORE the useEffect that references it,
    // otherwise the dependency array [refreshProjects] triggers a TDZ ReferenceError
    // ("Cannot access 'refreshProjects' before initialization") because const is not hoisted.
    const refreshProjects = useCallback(async () => {
        try {
            if (selectedClient) {
                setProjects(await listControlPlanProjectsByClient(selectedClient));
            } else {
                setProjects(await listControlPlanProjects());
            }
            // Also refresh clients list
            refreshClients();
        } catch (err) {
            logger.error('ControlPlan', 'Error loading projects', { error: err instanceof Error ? err.message : String(err) });
        }
    }, [selectedClient, refreshClients]);

    // Re-fetch projects when selectedClient changes
    useEffect(() => {
        refreshProjects();
    }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let isMounted = true;
        const check = async () => {
            const available = await isCpPathAccessible();
            if (!isMounted) return;
            setNetworkAvailable(available);
            if (available) refreshProjects();
        };
        check();
        return () => { isMounted = false; };
    }, [refreshProjects]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (changeDetectionTimerRef.current) clearTimeout(changeDetectionTimerRef.current);
        };
    }, []);

    // Track unsaved changes (debounced to avoid expensive JSON.stringify on every keystroke)
    useEffect(() => {
        if (!currentProject || !savedSnapshotRef.current) {
            setHasUnsavedChanges(false);
            return;
        }
        if (changeDetectionTimerRef.current) clearTimeout(changeDetectionTimerRef.current);
        changeDetectionTimerRef.current = setTimeout(() => {
            setHasUnsavedChanges(JSON.stringify(currentData) !== savedSnapshotRef.current);
        }, 800);
        return () => {
            if (changeDetectionTimerRef.current) clearTimeout(changeDetectionTimerRef.current);
        };
    }, [currentData, currentProject]);

    /**
     * Internal save logic (called with a validated project name).
     * Mutex pattern: savingRef prevents concurrent saves.
     * Snapshot captured BEFORE async to match exactly what was persisted.
     */
    const doSave = useCallback(async (projectName: string) => {
        if (savingRef.current) return;
        savingRef.current = true;

        setSaveStatus('saving');
        const snapshotAtSaveTime = JSON.stringify(currentData);
        try {
            const success = await saveControlPlan(projectName, currentData);
            if (success) {
                setCurrentProject(projectName);
                setSaveStatus('saved');
                savedSnapshotRef.current = snapshotAtSaveTime;
                setHasUnsavedChanges(false);
                await refreshProjects();
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
            }
        } catch (err) {
            logger.error('ControlPlan', 'Save failed', { error: String(err) });
            setSaveStatus('error');
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            savingRef.current = false;
        }
    }, [currentData, refreshProjects]);

    const saveCurrentProject = useCallback(async (name?: string) => {
        const projectName = name || currentProject;
        if (!projectName) {
            // Open PromptModal instead of window.prompt
            setPromptState({
                isOpen: true,
                title: 'Guardar Plan de Control',
                message: 'Ingrese un nombre para el Plan de Control:',
                defaultValue: currentData.header.partName || 'Mi Plan de Control',
                onSubmit: (inputName: string) => {
                    setPromptState(CLOSED_PROMPT);
                    const sanitized = inputName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, '');
                    if (sanitized) doSave(sanitized);
                },
                onClose: () => setPromptState(CLOSED_PROMPT),
            });
            return;
        }

        await doSave(projectName);
    }, [currentProject, currentData, doSave]);

    const loadSelectedProject = useCallback(async (name: string) => {
        if (hasUnsavedChanges) {
            const ok = await requestConfirm({
                title: 'Cambios sin guardar',
                message: 'Hay cambios sin guardar. ¿Cargar otro proyecto?',
                variant: 'warning',
                confirmText: 'Cargar',
            });
            if (!ok) return;
        }
        // Show loading skeleton immediately
        setIsLoadingProject(true);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        try {
            const data = await loadControlPlan(name);
            if (data) {
                onLoadProject(data);
                setCurrentProject(name);
                savedSnapshotRef.current = JSON.stringify(data);
                setHasUnsavedChanges(false);
            } else {
                setLoadError('Error al cargar Plan de Control. El archivo puede estar corrupto o inaccesible.');
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setLoadError(''), 5000);
            }
        } finally {
            setIsLoadingProject(false);
        }
    }, [hasUnsavedChanges, onLoadProject, requestConfirm]);

    const deleteSelectedProject = useCallback(async (name: string) => {
        const ok = await requestConfirm({
            title: 'Eliminar Plan de Control',
            message: `¿Eliminar "${name}"? Esta accion no se puede deshacer.`,
            variant: 'danger',
            confirmText: 'Eliminar',
        });
        if (!ok) return;
        const success = await deleteControlPlan(name);
        if (success) {
            if (currentProject === name) {
                setCurrentProject('');
                onResetProject();
            }
            await refreshProjects();
        } else {
            logger.error('ControlPlan', `Failed to delete: ${name}`);
            toast.error('Error al Eliminar', `No se pudo eliminar el Plan de Control "${name}". Intente nuevamente.`);
        }
    }, [currentProject, onResetProject, refreshProjects, requestConfirm]);

    const createNewProject = useCallback(async () => {
        if (hasUnsavedChanges) {
            const ok = await requestConfirm({
                title: 'Cambios sin guardar',
                message: 'Hay cambios sin guardar. ¿Crear nuevo?',
                variant: 'warning',
                confirmText: 'Crear nuevo',
            });
            if (!ok) return;
        }
        onResetProject();
        setCurrentProject('');
        savedSnapshotRef.current = '';
        setHasUnsavedChanges(false);
    }, [hasUnsavedChanges, onResetProject, requestConfirm]);

    return {
        projects,
        currentProject,
        saveStatus,
        hasUnsavedChanges,
        networkAvailable,
        promptState,
        loadError,
        isLoadingProject,
        refreshProjects,
        saveCurrentProject,
        loadSelectedProject,
        deleteSelectedProject,
        createNewProject,
        // Client hierarchy filter
        clients,
        selectedClient,
        setSelectedClient,
    };
};

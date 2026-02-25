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
    loadControlPlan,
    saveControlPlan,
    deleteControlPlan,
    isCpPathAccessible,
    ControlPlanProjectInfo,
} from './controlPlanPathManager';
import { logger } from '../../utils/logger';

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

    const savedSnapshotRef = useRef('');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const check = async () => {
            const available = await isCpPathAccessible();
            setNetworkAvailable(available);
            if (available) refreshProjects();
        };
        check();
    }, []);

    useEffect(() => {
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, []);

    useEffect(() => {
        if (!currentProject || !savedSnapshotRef.current) return;
        setHasUnsavedChanges(JSON.stringify(currentData) !== savedSnapshotRef.current);
    }, [currentData, currentProject]);

    const refreshProjects = useCallback(async () => {
        try {
            setProjects(await listControlPlanProjects());
        } catch (err) {
            logger.error('[ControlPlan] Error loading projects', err);
        }
    }, []);

    /** Internal save logic (called with a validated project name). */
    const doSave = useCallback(async (projectName: string) => {
        setSaveStatus('saving');
        try {
            const success = await saveControlPlan(projectName, currentData);
            if (success) {
                setCurrentProject(projectName);
                setSaveStatus('saved');
                savedSnapshotRef.current = JSON.stringify(currentData);
                setHasUnsavedChanges(false);
                await refreshProjects();
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
            }
        } catch {
            setSaveStatus('error');
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
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
        refreshProjects,
        saveCurrentProject,
        loadSelectedProject,
        deleteSelectedProject,
        createNewProject,
    };
};

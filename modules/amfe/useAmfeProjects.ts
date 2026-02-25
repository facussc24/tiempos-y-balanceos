/**
 * AMFE Project Management Hook
 *
 * Handles saving/loading AMFE projects to/from the network drive (Y:\).
 * Supports hierarchical organization: Client > Project > AMFE.
 * Tracks unsaved changes via JSON serialization comparison, and provides
 * project CRUD operations with confirmation modal integration.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AmfeDocument } from './amfeTypes';
import {
    listAmfeClients,
    listAmfeClientProjects,
    listAmfeStudies,
    saveAmfeHierarchical,
    loadAmfeHierarchical,
    deleteAmfeHierarchical,
    deleteAmfeProject,
    deleteAmfeClient,
    listLooseAmfeFiles,
    loadAmfe,
    saveAmfe,
    isAmfePathAccessible,
    AmfeProjectInfo,
    ensureAmfeHierarchy,
} from './amfePathManager';
import { migrateAmfeDocument } from './amfeValidation';
import { deleteDraft } from './useAmfePersistence';
import { logger } from '../../utils/logger';

/** Identifies the current open project in the hierarchy */
export interface AmfeProjectRef {
    client: string;
    project: string;
    name: string;
}

/** State for the SaveAs modal (3 fields: client, project, name) */
export interface SaveAsState {
    isOpen: boolean;
    defaultClient: string;
    defaultProject: string;
    defaultName: string;
    existingClients: string[];
    onSubmit: (client: string, project: string, name: string) => void;
    onClose: () => void;
}

const CLOSED_SAVE_AS: SaveAsState = {
    isOpen: false, defaultClient: '', defaultProject: '', defaultName: '',
    existingClients: [],
    onSubmit: () => {}, onClose: () => {},
};

/** State for the PromptModal integration (legacy, kept for backward compat) */
export interface ProjectPromptState {
    isOpen: boolean;
    title: string;
    message: string;
    defaultValue: string;
    onSubmit: (value: string) => void;
    onClose: () => void;
}

const CLOSED_PROMPT: ProjectPromptState = {
    isOpen: false, title: '', message: '', defaultValue: '',
    onSubmit: () => {}, onClose: () => {},
};

type RequestConfirmFn = (options: {
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
}) => Promise<boolean>;

export const useAmfeProjects = (
    currentData: AmfeDocument,
    onLoadProject: (data: AmfeDocument) => void,
    onResetProject: () => void,
    requestConfirm: RequestConfirmFn
) => {
    // Current project reference (hierarchical)
    const [currentProjectRef, setCurrentProjectRef] = useState<AmfeProjectRef | null>(null);
    // Legacy flat name (for backward compat with AmfeApp references to `currentProject`)
    const currentProject = currentProjectRef?.name ?? '';

    // Hierarchical browser state
    const [clients, setClients] = useState<string[]>([]);
    const [clientProjects, setClientProjects] = useState<string[]>([]);
    const [studies, setStudies] = useState<AmfeProjectInfo[]>([]);
    const [looseFiles, setLooseFiles] = useState<AmfeProjectInfo[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [isLoadingBrowser, setIsLoadingBrowser] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Save/load state
    const [projects, setProjects] = useState<AmfeProjectInfo[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [networkAvailable, setNetworkAvailable] = useState(true);
    const [promptState, setPromptState] = useState<ProjectPromptState>(CLOSED_PROMPT);
    const [saveAsState, setSaveAsState] = useState<SaveAsState>(CLOSED_SAVE_AS);
    const [loadError, setLoadError] = useState<string>('');

    /** Serialized snapshot of data at last save/load for comparison */
    const savedSnapshotRef = useRef<string>('');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savingRef = useRef(false);

    // =========================================================================
    // Browser: Load clients / projects / studies
    // =========================================================================

    const refreshClients = useCallback(async () => {
        try {
            setIsLoadingBrowser(true);
            const list = await listAmfeClients();
            setClients(list);
            // Also load loose files for "Sin clasificar" section
            const loose = await listLooseAmfeFiles();
            setLooseFiles(loose);
        } catch (err) {
            logger.error('Error loading AMFE clients', err);
        } finally {
            setIsLoadingBrowser(false);
        }
    }, []);

    const refreshClientProjects = useCallback(async (client: string) => {
        if (!client) { setClientProjects([]); return; }
        try {
            setIsLoadingBrowser(true);
            const list = await listAmfeClientProjects(client);
            setClientProjects(list);
        } catch (err) {
            logger.error('Error loading client projects', err);
            setClientProjects([]);
        } finally {
            setIsLoadingBrowser(false);
        }
    }, []);

    const refreshStudies = useCallback(async (client: string, project: string) => {
        if (!client || !project) { setStudies([]); return; }
        try {
            setIsLoadingBrowser(true);
            const list = await listAmfeStudies(client, project);
            setStudies(list);
        } catch (err) {
            logger.error('Error loading studies', err);
            setStudies([]);
        } finally {
            setIsLoadingBrowser(false);
        }
    }, []);

    // Legacy refreshProjects (still used for flat project list)
    const refreshProjects = useCallback(async () => {
        await refreshClients();
    }, [refreshClients]);

    // When selectedClient changes, load its projects
    useEffect(() => {
        if (selectedClient) {
            refreshClientProjects(selectedClient);
            setSelectedProject('');
            setStudies([]);
        } else {
            setClientProjects([]);
            setSelectedProject('');
            setStudies([]);
        }
    }, [selectedClient, refreshClientProjects]);

    // When selectedProject changes, load studies
    useEffect(() => {
        if (selectedClient && selectedProject) {
            refreshStudies(selectedClient, selectedProject);
        } else {
            setStudies([]);
        }
    }, [selectedClient, selectedProject, refreshStudies]);

    // Persist filter selections to localStorage
    const filtersInitializedRef = useRef(false);
    useEffect(() => {
        if (filtersInitializedRef.current) {
            localStorage.setItem('amfe_selectedClient', selectedClient);
            localStorage.setItem('amfe_selectedProject', selectedProject);
        }
    }, [selectedClient, selectedProject]);

    // Restore filters from localStorage after clients are loaded
    useEffect(() => {
        if (clients.length > 0 && !filtersInitializedRef.current) {
            const savedClient = localStorage.getItem('amfe_selectedClient') || '';
            if (savedClient && clients.includes(savedClient)) {
                setSelectedClient(savedClient);
            } else if (savedClient) {
                localStorage.removeItem('amfe_selectedClient');
                localStorage.removeItem('amfe_selectedProject');
            }
            filtersInitializedRef.current = true;
        }
    }, [clients]);

    // Restore project filter after clientProjects load
    useEffect(() => {
        if (clientProjects.length > 0 && filtersInitializedRef.current && !selectedProject) {
            const savedProject = localStorage.getItem('amfe_selectedProject') || '';
            if (savedProject && clientProjects.includes(savedProject)) {
                setSelectedProject(savedProject);
            } else if (savedProject) {
                localStorage.removeItem('amfe_selectedProject');
            }
        }
    }, [clientProjects, selectedProject]);

    // =========================================================================
    // Network check
    // =========================================================================

    const initialCheckDoneRef = useRef(false);
    useEffect(() => {
        const checkNetwork = async () => {
            const available = await isAmfePathAccessible();
            const isInitial = !initialCheckDoneRef.current;
            initialCheckDoneRef.current = true;

            setNetworkAvailable(prev => {
                if (available && (isInitial || !prev)) {
                    refreshClients();
                }
                return available;
            });
        };
        checkNetwork();
        const intervalId = setInterval(checkNetwork, 30_000);
        return () => clearInterval(intervalId);
    }, [refreshClients]);

    useEffect(() => {
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, []);

    // Track unsaved changes
    useEffect(() => {
        if (!currentProjectRef) return;
        if (!savedSnapshotRef.current) return;
        const currentSerialized = JSON.stringify(currentData);
        setHasUnsavedChanges(currentSerialized !== savedSnapshotRef.current);
    }, [currentData, currentProjectRef]);

    // =========================================================================
    // Save (hierarchical)
    // =========================================================================

    /**
     * Save with mutex pattern: `savingRef` prevents concurrent saves.
     * Snapshot is captured BEFORE the async operation intentionally —
     * this ensures the "saved" state matches exactly what was persisted,
     * even if the user modifies data during the async save.
     */
    const doSaveHierarchical = useCallback(async (ref: AmfeProjectRef) => {
        if (savingRef.current) return;
        savingRef.current = true;

        setSaveStatus('saving');
        const snapshotAtSaveTime = JSON.stringify(currentData);
        try {
            const success = await saveAmfeHierarchical(ref.client, ref.project, ref.name, currentData);
            if (success) {
                setCurrentProjectRef(ref);
                setSaveStatus('saved');
                savedSnapshotRef.current = snapshotAtSaveTime;
                setHasUnsavedChanges(false);
                try { await deleteDraft(`amfe_draft_${ref.name}`); } catch { /* ignore */ }
                // Refresh the studies list if we're viewing that client/project
                if (selectedClient === ref.client && selectedProject === ref.project) {
                    refreshStudies(ref.client, ref.project);
                }
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
        } finally {
            savingRef.current = false;
        }
    }, [currentData, selectedClient, selectedProject, refreshStudies]);

    /** Legacy flat save (for backward compat) */
    const doSave = useCallback(async (projectName: string) => {
        if (savingRef.current) return;
        savingRef.current = true;

        setSaveStatus('saving');
        const snapshotAtSaveTime = JSON.stringify(currentData);
        try {
            const success = await saveAmfe(projectName, currentData);
            if (success) {
                setCurrentProjectRef({ client: '', project: '', name: projectName });
                setSaveStatus('saved');
                savedSnapshotRef.current = snapshotAtSaveTime;
                setHasUnsavedChanges(false);
                try { await deleteDraft(`amfe_draft_${projectName}`); } catch { /* ignore */ }
                await refreshClients();
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
        } finally {
            savingRef.current = false;
        }
    }, [currentData, refreshClients]);

    // =========================================================================
    // Public API
    // =========================================================================

    const sanitizeName = (name: string) =>
        name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, '').substring(0, 100);

    /** Save current project. If no ref, opens SaveAs modal. */
    const saveCurrentProject = useCallback(async () => {
        if (currentProjectRef && currentProjectRef.client && currentProjectRef.project) {
            // Already has a hierarchical location — save in place
            await doSaveHierarchical(currentProjectRef);
            return;
        }

        // No hierarchical ref — open SaveAs modal
        setSaveAsState({
            isOpen: true,
            defaultClient: currentData.header.client || '',
            defaultProject: currentData.header.modelYear || '',
            defaultName: currentData.header.subject || 'Mi AMFE',
            existingClients: clients,
            onSubmit: async (client: string, project: string, name: string) => {
                setSaveAsState(CLOSED_SAVE_AS);
                const c = sanitizeName(client);
                const p = sanitizeName(project);
                const n = sanitizeName(name);
                if (!c || !p || !n) return;

                // Check duplicate
                const existingStudies = await listAmfeStudies(c, p);
                const exists = existingStudies.find(s => s.name === n);
                if (exists) {
                    const ok = await requestConfirm({
                        title: 'AMFE Existente',
                        message: `"${n}" ya existe en ${c}/${p}. ¿Sobrescribir?`,
                        variant: 'warning',
                        confirmText: 'Sobrescribir',
                    });
                    if (!ok) return;
                }

                await doSaveHierarchical({ client: c, project: p, name: n });
            },
            onClose: () => setSaveAsState(CLOSED_SAVE_AS),
        });
    }, [currentProjectRef, currentData, clients, doSaveHierarchical, requestConfirm]);

    /** Save As: always opens the SaveAs modal */
    const saveAsProject = useCallback(async () => {
        setSaveAsState({
            isOpen: true,
            defaultClient: currentProjectRef?.client || currentData.header.client || '',
            defaultProject: currentProjectRef?.project || currentData.header.modelYear || '',
            defaultName: currentData.header.subject || 'Mi AMFE',
            existingClients: clients,
            onSubmit: async (client: string, project: string, name: string) => {
                setSaveAsState(CLOSED_SAVE_AS);
                const c = sanitizeName(client);
                const p = sanitizeName(project);
                const n = sanitizeName(name);
                if (!c || !p || !n) return;

                const existingStudies = await listAmfeStudies(c, p);
                const exists = existingStudies.find(s => s.name === n);
                if (exists) {
                    const ok = await requestConfirm({
                        title: 'AMFE Existente',
                        message: `"${n}" ya existe en ${c}/${p}. ¿Sobrescribir?`,
                        variant: 'warning',
                        confirmText: 'Sobrescribir',
                    });
                    if (!ok) return;
                }

                await doSaveHierarchical({ client: c, project: p, name: n });
            },
            onClose: () => setSaveAsState(CLOSED_SAVE_AS),
        });
    }, [currentProjectRef, currentData, clients, doSaveHierarchical, requestConfirm]);

    /** Load from hierarchical path */
    const loadHierarchicalProject = useCallback(async (client: string, project: string, name: string) => {
        if (hasUnsavedChanges) {
            const ok = await requestConfirm({
                title: 'Cambios sin guardar',
                message: 'Hay cambios sin guardar. ¿Cargar otro proyecto?',
                variant: 'warning',
                confirmText: 'Cargar',
            });
            if (!ok) return;
        }
        const rawData = await loadAmfeHierarchical(client, project, name);
        const data = rawData ? migrateAmfeDocument(rawData) : null;
        if (data) {
            onLoadProject(data);
            setCurrentProjectRef({ client, project, name });
            savedSnapshotRef.current = JSON.stringify(data);
            setHasUnsavedChanges(false);
        } else {
            setLoadError('Error al cargar proyecto. El archivo puede estar corrupto o inaccesible.');
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setLoadError(''), 5000);
        }
    }, [hasUnsavedChanges, onLoadProject, requestConfirm]);

    /** Load a loose (flat) file from the root */
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
        const rawData = await loadAmfe(name);
        const data = rawData ? migrateAmfeDocument(rawData) : null;
        if (data) {
            onLoadProject(data);
            setCurrentProjectRef({ client: '', project: '', name });
            savedSnapshotRef.current = JSON.stringify(data);
            setHasUnsavedChanges(false);
        } else {
            setLoadError('Error al cargar proyecto. El archivo puede estar corrupto o inaccesible.');
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setLoadError(''), 5000);
        }
    }, [hasUnsavedChanges, onLoadProject, requestConfirm]);

    /** Delete a hierarchical AMFE */
    const deleteHierarchicalProject = useCallback(async (client: string, project: string, name: string) => {
        const ok = await requestConfirm({
            title: 'Eliminar AMFE',
            message: `¿Eliminar "${name}" de ${client}/${project}? Esta accion no se puede deshacer.`,
            variant: 'danger',
            confirmText: 'Eliminar',
        });
        if (!ok) return;
        const success = await deleteAmfeHierarchical(client, project, name);
        if (success) {
            try { await deleteDraft(`amfe_draft_${name}`); } catch { /* ignore */ }
            if (currentProjectRef?.client === client && currentProjectRef?.project === project && currentProjectRef?.name === name) {
                setCurrentProjectRef(null);
                onResetProject();
            }
            if (selectedClient === client && selectedProject === project) {
                refreshStudies(client, project);
            }
        }
    }, [currentProjectRef, onResetProject, requestConfirm, selectedClient, selectedProject, refreshStudies]);

    /** Delete an entire project folder */
    const deleteProjectFolder = useCallback(async (client: string, project: string) => {
        const ok = await requestConfirm({
            title: 'Eliminar Carpeta de Proyecto',
            message: `¿Eliminar "${project}" y todos sus AMFEs? Esta accion no se puede deshacer.`,
            variant: 'danger',
            confirmText: 'Eliminar todo',
        });
        if (!ok) return;
        const success = await deleteAmfeProject(client, project);
        if (success) {
            if (currentProjectRef?.client === client && currentProjectRef?.project === project) {
                setCurrentProjectRef(null);
                onResetProject();
            }
            if (selectedClient === client) {
                setSelectedProject('');
                refreshClientProjects(client);
            }
        }
    }, [currentProjectRef, onResetProject, requestConfirm, selectedClient, refreshClientProjects]);

    /** Delete an entire client folder */
    const deleteClientFolder = useCallback(async (client: string) => {
        const ok = await requestConfirm({
            title: 'Eliminar Carpeta de Cliente',
            message: `¿Eliminar "${client}" y todos sus proyectos? Esta accion no se puede deshacer.`,
            variant: 'danger',
            confirmText: 'Eliminar todo',
        });
        if (!ok) return;
        const success = await deleteAmfeClient(client);
        if (success) {
            if (currentProjectRef?.client === client) {
                setCurrentProjectRef(null);
                onResetProject();
            }
            setSelectedClient('');
            setSelectedProject('');
            refreshClients();
        }
    }, [currentProjectRef, onResetProject, requestConfirm, refreshClients]);

    /** Legacy delete (flat file) */
    const deleteSelectedProject = useCallback(async (name: string) => {
        const { deleteAmfe } = await import('./amfePathManager');
        const ok = await requestConfirm({
            title: 'Eliminar Proyecto',
            message: `¿Eliminar proyecto "${name}"? Esta accion no se puede deshacer.`,
            variant: 'danger',
            confirmText: 'Eliminar',
        });
        if (!ok) return;
        const success = await deleteAmfe(name);
        if (success) {
            try { await deleteDraft(`amfe_draft_${name}`); } catch { /* ignore */ }
            if (currentProject === name) {
                setCurrentProjectRef(null);
                onResetProject();
            }
            await refreshClients();
        }
    }, [currentProject, onResetProject, refreshClients, requestConfirm]);

    const createNewProject = useCallback(async () => {
        if (hasUnsavedChanges) {
            const ok = await requestConfirm({
                title: 'Cambios sin guardar',
                message: 'Hay cambios sin guardar. ¿Crear nuevo proyecto?',
                variant: 'warning',
                confirmText: 'Crear nuevo',
            });
            if (!ok) return;
        }
        onResetProject();
        setCurrentProjectRef(null);
        savedSnapshotRef.current = '';
        setHasUnsavedChanges(false);
    }, [hasUnsavedChanges, onResetProject, requestConfirm]);

    const clearFilters = useCallback(() => {
        setSelectedClient('');
        setSelectedProject('');
        setSearchQuery('');
        localStorage.removeItem('amfe_selectedClient');
        localStorage.removeItem('amfe_selectedProject');
    }, []);

    // Filtered studies by search query
    const filteredStudies = studies.filter(s =>
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.header?.subject || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredLooseFiles = looseFiles.filter(s =>
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.header?.subject || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return {
        // Legacy flat API (backward compat)
        projects,
        currentProject,
        promptState,
        loadSelectedProject,
        deleteSelectedProject,

        // Hierarchical browser
        clients,
        clientProjects,
        studies: filteredStudies,
        looseFiles: filteredLooseFiles,
        selectedClient,
        selectedProject,
        isLoadingBrowser,
        searchQuery,
        setSelectedClient,
        setSelectedProject,
        setSearchQuery,
        clearFilters,
        currentProjectRef,

        // Hierarchical CRUD
        loadHierarchicalProject,
        deleteHierarchicalProject,
        deleteProjectFolder,
        deleteClientFolder,
        saveAsProject,

        // Common
        saveStatus,
        hasUnsavedChanges,
        networkAvailable,
        saveAsState,
        loadError,
        refreshProjects,
        refreshClients,
        refreshStudies,
        saveCurrentProject,
        createNewProject,
    };
};

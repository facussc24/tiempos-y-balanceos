/**
 * AMFE Project Management Hook
 *
 * Handles saving/loading AMFE projects to/from the network drive (Y:\).
 * Supports hierarchical organization: Client > Project > AMFE.
 * Tracks unsaved changes via JSON serialization comparison, and provides
 * project CRUD operations with confirmation modal integration.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
    isAmfePathAccessible,
    AmfeProjectInfo,
    ensureAmfeHierarchy,
    buildAmfePath,
} from './amfePathManager';
import { migrateAmfeDocument } from './amfeValidation';
import { deleteDraft } from './useAmfePersistence';
import { logger } from '../../utils/logger';
import { loadAmfeByProjectName } from '../../utils/repositories/amfeRepository';
import { triggerOverrideTracking } from '../../core/inheritance/triggerOverrideTracking';
import { triggerChangePropagation } from '../../core/inheritance/changePropagation';
import { toast } from '../../components/ui/Toast';

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

const LS_KEY_LAST_PROJECT = 'amfe_lastProjectRef';

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
    requestConfirm: RequestConfirmFn,
    /** Skip auto-loading the last opened project from localStorage (e.g. when navigating from landing page with a specific family) */
    skipAutoLoad?: boolean
) => {
    // Current project reference (hierarchical)
    const [currentProjectRef, setCurrentProjectRef] = useState<AmfeProjectRef | null>(null);
    // Legacy flat name (for backward compat with AmfeApp references to `currentProject`)
    const currentProject = currentProjectRef?.name ?? '';
    // Full hierarchical path for cross-document lookups (e.g. 'VWA/PATAGONIA/TOP_ROLL')
    const currentProjectPath = currentProjectRef
        ? (currentProjectRef.client
            ? buildAmfePath(currentProjectRef.client, currentProjectRef.project, currentProjectRef.name)
            : currentProjectRef.name)
        : '';
    // Document UUID from amfe_documents table (needed for family/inheritance features)
    const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);

    // Hierarchical browser state
    const [clients, setClients] = useState<string[]>([]);
    const [clientProjects, setClientProjects] = useState<string[]>([]);
    const [studies, setStudies] = useState<AmfeProjectInfo[]>([]);
    const [looseFiles, setLooseFiles] = useState<AmfeProjectInfo[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [selectedFamily, setSelectedFamily] = useState<string>('');
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
    /** True while loading a project from SQLite (shows skeleton in UI) */
    const [isLoadingProject, setIsLoadingProject] = useState(false);

    /** Serialized snapshot of data at last save/load for comparison */
    const savedSnapshotRef = useRef<string>('');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const changeDetectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
            logger.error('AMFE', 'Error loading AMFE clients', { error: err instanceof Error ? err.message : String(err) });
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
            logger.error('AMFE', 'Error loading client projects', { error: err instanceof Error ? err.message : String(err) });
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
            logger.error('AMFE', 'Error loading studies', { error: err instanceof Error ? err.message : String(err) });
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
            setSelectedFamily('');
            setStudies([]);
        } else {
            setClientProjects([]);
            setSelectedProject('');
            setSelectedFamily('');
            setStudies([]);
        }
    }, [selectedClient, refreshClientProjects]);

    // When selectedProject changes, load studies and reset family filter
    useEffect(() => {
        if (selectedClient && selectedProject) {
            refreshStudies(selectedClient, selectedProject);
            setSelectedFamily('');
        } else {
            setStudies([]);
            setSelectedFamily('');
        }
    }, [selectedClient, selectedProject, refreshStudies]);

    // Persist filter selections to localStorage
    const filtersInitializedRef = useRef(false);
    useEffect(() => {
        if (filtersInitializedRef.current) {
            try {
                localStorage.setItem('amfe_selectedClient', selectedClient);
                localStorage.setItem('amfe_selectedProject', selectedProject);
            } catch { /* FIX: non-critical persistence */ }
        }
    }, [selectedClient, selectedProject]);

    // Restore filters from localStorage after clients are loaded
    useEffect(() => {
        if (clients.length > 0 && !filtersInitializedRef.current) {
            let savedClient = '';
            try { savedClient = localStorage.getItem('amfe_selectedClient') || ''; } catch { /* FIX */ }
            if (savedClient && clients.includes(savedClient)) {
                setSelectedClient(savedClient);
            } else if (savedClient) {
                try { localStorage.removeItem('amfe_selectedClient'); localStorage.removeItem('amfe_selectedProject'); } catch { /* FIX */ }
            }
            filtersInitializedRef.current = true;
        }
    }, [clients]);

    // Restore project filter after clientProjects load
    useEffect(() => {
        if (clientProjects.length > 0 && filtersInitializedRef.current && !selectedProject) {
            let savedProject = '';
            try { savedProject = localStorage.getItem('amfe_selectedProject') || ''; } catch { /* FIX */ }
            if (savedProject && clientProjects.includes(savedProject)) {
                setSelectedProject(savedProject);
            } else if (savedProject) {
                try { localStorage.removeItem('amfe_selectedProject'); } catch { /* FIX */ }
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

    // Persist currentProjectRef to localStorage for navigation memory
    useEffect(() => {
        try {
            if (currentProjectRef) {
                localStorage.setItem(LS_KEY_LAST_PROJECT, JSON.stringify(currentProjectRef));
            } else {
                localStorage.removeItem(LS_KEY_LAST_PROJECT);
            }
        } catch { /* ignore */ }
    }, [currentProjectRef]);

    // Auto-load last opened project on mount (skipped when navigating from landing with a specific family)
    const autoLoadDoneRef = useRef(false);
    useEffect(() => {
        if (autoLoadDoneRef.current) return;
        autoLoadDoneRef.current = true;
        if (skipAutoLoad) return;
        let saved: AmfeProjectRef | null = null;
        try {
            const raw = localStorage.getItem(LS_KEY_LAST_PROJECT);
            if (raw) saved = JSON.parse(raw);
        } catch { /* ignore */ }
        if (!saved || !saved.name) return;
        // Load asynchronously without confirmation (fresh mount = no unsaved changes)
        const ref = saved;
        (async () => {
            setIsLoadingProject(true);
            try {
                const rawData = ref.client
                    ? await loadAmfeHierarchical(ref.client, ref.project, ref.name)
                    : await loadAmfe(ref.name);
                const data = rawData ? migrateAmfeDocument(rawData) : null;
                if (data) {
                    onLoadProject(data);
                    setCurrentProjectRef(ref);
                    savedSnapshotRef.current = JSON.stringify(data);
                    setHasUnsavedChanges(false);
                    resolveDocumentId(ref);
                    logger.info('AMFE', `Auto-loaded last project: ${ref.client}/${ref.project}/${ref.name}`);
                } else {
                    // Project no longer exists — clear saved ref
                    setCurrentDocumentId(null);
                    try { localStorage.removeItem(LS_KEY_LAST_PROJECT); } catch { /* ignore */ }
                }
            } catch (err) {
                logger.warn('AMFE', 'Failed to auto-load last project', { error: String(err) });
                try { localStorage.removeItem(LS_KEY_LAST_PROJECT); } catch { /* ignore */ }
            } finally {
                setIsLoadingProject(false);
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Clear project + document ID together
    const clearCurrentProject = useCallback(() => {
        setCurrentProjectRef(null);
        setCurrentDocumentId(null);
    }, []);

    // Resolve document UUID whenever currentProjectRef changes
    const resolveDocumentId = useCallback(async (ref: AmfeProjectRef) => {
        try {
            const projectName = buildAmfePath(ref.client, ref.project, ref.name);
            const loaded = await loadAmfeByProjectName(projectName);
            if (loaded) {
                setCurrentDocumentId(loaded.meta.id);
            } else {
                setCurrentDocumentId(null);
            }
        } catch {
            setCurrentDocumentId(null);
        }
    }, []);

    // Track unsaved changes (debounced to avoid expensive JSON.stringify on every keystroke)
    useEffect(() => {
        if (!currentProjectRef || !savedSnapshotRef.current) {
            setHasUnsavedChanges(false);
            return;
        }
        if (changeDetectionTimerRef.current) clearTimeout(changeDetectionTimerRef.current);
        changeDetectionTimerRef.current = setTimeout(() => {
            const currentSerialized = JSON.stringify(currentData);
            setHasUnsavedChanges(currentSerialized !== savedSnapshotRef.current);
        }, 800);
        return () => {
            if (changeDetectionTimerRef.current) clearTimeout(changeDetectionTimerRef.current);
        };
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
            // Load old doc for change propagation (before overwriting)
            let oldAmfeDoc: typeof currentData | null = null;
            try {
                const projectName = buildAmfePath(ref.client, ref.project, ref.name);
                const oldLoaded = await loadAmfeByProjectName(projectName);
                if (oldLoaded) {
                    oldAmfeDoc = oldLoaded.doc;
                }
            } catch { /* non-critical */ }

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
                timeoutRef.current = setTimeout(() => setSaveStatus('idle'), 5000);
                // Fire-and-forget: trigger override tracking for variant documents
                try {
                    const projectName = buildAmfePath(ref.client, ref.project, ref.name);
                    const loaded = await loadAmfeByProjectName(projectName);
                    if (loaded) {
                        triggerOverrideTracking(loaded.meta.id, currentData, 'amfe');
                        // Fire-and-forget: propagate master changes to variants
                        if (oldAmfeDoc) {
                            triggerChangePropagation(loaded.meta.id, oldAmfeDoc, currentData, 'amfe');
                        }
                    }
                } catch { /* override tracking is non-critical */ }
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

    // NOTE: Legacy flat doSave was removed — all saves must go through
    // doSaveHierarchical to ensure project_name is always "client/project/name" format.

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
                if (!c || !p || !n) {
                    toast.warning('Nombre inválido', 'Los nombres no pueden estar vacíos ni contener solo caracteres especiales.');
                    return;
                }
                if (c !== client.trim() || p !== project.trim() || n !== name.trim()) {
                    toast.info('Nombre ajustado', 'Se removieron caracteres especiales no permitidos.');
                }

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
                if (!c || !p || !n) {
                    toast.warning('Nombre inválido', 'Los nombres no pueden estar vacíos ni contener solo caracteres especiales.');
                    return;
                }
                if (c !== client.trim() || p !== project.trim() || n !== name.trim()) {
                    toast.info('Nombre ajustado', 'Se removieron caracteres especiales no permitidos.');
                }

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
        // Show loading skeleton immediately (paints before heavy work)
        setIsLoadingProject(true);
        // Yield to let the loading UI paint before blocking with JSON parse
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        try {
            const rawData = await loadAmfeHierarchical(client, project, name);
            const data = rawData ? migrateAmfeDocument(rawData) : null;
            if (data) {
                onLoadProject(data);
                const ref = { client, project, name };
                setCurrentProjectRef(ref);
                savedSnapshotRef.current = JSON.stringify(data);
                setHasUnsavedChanges(false);
                resolveDocumentId(ref);
            } else {
                setLoadError('Error al cargar proyecto. El archivo puede estar corrupto o inaccesible.');
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setLoadError(''), 5000);
            }
        } finally {
            setIsLoadingProject(false);
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
        // Show loading skeleton immediately
        setIsLoadingProject(true);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        try {
            const rawData = await loadAmfe(name);
            const data = rawData ? migrateAmfeDocument(rawData) : null;
            if (data) {
                onLoadProject(data);
                const ref = { client: '', project: '', name };
                setCurrentProjectRef(ref);
                savedSnapshotRef.current = JSON.stringify(data);
                setHasUnsavedChanges(false);
                resolveDocumentId(ref);
            } else {
                setLoadError('Error al cargar proyecto. El archivo puede estar corrupto o inaccesible.');
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setLoadError(''), 5000);
            }
        } finally {
            setIsLoadingProject(false);
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
        // Always attempt draft cleanup
        try { await deleteDraft(`amfe_draft_${name}`); } catch (err) {
            logger.warn('AMFE', 'Failed to clean up draft after deletion', { draft: `amfe_draft_${name}`, error: String(err) });
        }
        if (success) {
            if (currentProjectRef?.client === client && currentProjectRef?.project === project && currentProjectRef?.name === name) {
                clearCurrentProject();
                onResetProject();
            }
            if (selectedClient === client && selectedProject === project) {
                refreshStudies(client, project);
            }
        } else {
            logger.error('AMFE', `Failed to delete AMFE: ${client}/${project}/${name}`);
            toast.error('Error al Eliminar', `No se pudo eliminar el AMFE "${name}". Intente nuevamente.`);
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
                clearCurrentProject();
                onResetProject();
            }
            if (selectedClient === client) {
                setSelectedProject('');
                refreshClientProjects(client);
            }
        } else {
            logger.error('AMFE', `Failed to delete project folder: ${client}/${project}`);
            toast.error('Error al Eliminar', `No se pudo eliminar el proyecto "${project}". Algunos documentos pueden estar bloqueados.`);
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
                clearCurrentProject();
                onResetProject();
            }
            setSelectedClient('');
            setSelectedProject('');
            refreshClients();
        } else {
            logger.error('AMFE', `Failed to delete client folder: ${client}`);
            toast.error('Error al Eliminar', `No se pudo eliminar el cliente "${client}". Algunos documentos pueden estar bloqueados.`);
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
        // Always attempt draft cleanup
        try { await deleteDraft(`amfe_draft_${name}`); } catch (err) {
            logger.warn('AMFE', 'Failed to clean up draft after deletion', { draft: `amfe_draft_${name}`, error: String(err) });
        }
        if (success) {
            if (currentProject === name) {
                clearCurrentProject();
                onResetProject();
            }
            await refreshClients();
        } else {
            logger.error('AMFE', `Failed to delete AMFE: ${name}`);
            toast.error('Error al Eliminar', `No se pudo eliminar el AMFE "${name}". Intente nuevamente.`);
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
        clearCurrentProject();
        savedSnapshotRef.current = '';
        setHasUnsavedChanges(false);
    }, [hasUnsavedChanges, onResetProject, requestConfirm, clearCurrentProject]);

    const clearFilters = useCallback(() => {
        setSelectedClient('');
        setSelectedProject('');
        setSelectedFamily('');
        setSearchQuery('');
        try { localStorage.removeItem('amfe_selectedClient'); localStorage.removeItem('amfe_selectedProject'); } catch { /* FIX */ }
    }, []);

    // Extract unique family names from studies (based on study name)
    const familyOptions = useMemo(() => {
        const set = new Set<string>();
        for (const s of studies) {
            if (s.name) set.add(s.name);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [studies]);

    // Filtered studies by family and search query
    const filteredStudies = studies.filter(s => {
        // Family filter
        if (selectedFamily && s.name !== selectedFamily) return false;
        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (s.name || '').toLowerCase().includes(q) ||
                (s.header?.subject || '').toLowerCase().includes(q);
        }
        return true;
    });

    const filteredLooseFiles = looseFiles.filter(s =>
        !searchQuery ||
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.header?.subject || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return {
        // Legacy flat API (backward compat)
        projects,
        currentProject,
        /** Full hierarchical path for cross-document lookups (e.g. 'VWA/PATAGONIA/TOP_ROLL') */
        currentProjectPath,
        currentDocumentId,
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
        selectedFamily,
        familyOptions,
        isLoadingBrowser,
        searchQuery,
        setSelectedClient,
        setSelectedProject,
        setSelectedFamily,
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
        isLoadingProject,
        refreshProjects,
        refreshClients,
        refreshStudies,
        saveCurrentProject,
        createNewProject,
    };
};

/**
 * Barack Mercosul v1-beta - Tiempos y Balanceos
 *
 * NOTA: Esta aplicación es EXCLUSIVAMENTE para escritorio (Desktop/Tauri).
 * No está diseñada ni optimizada para dispositivos móviles.
 *
 * @module App
 * @version 1.0.0-beta
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeStorageManager } from './utils/storageManager';
import { ProjectData } from './types';
import { isTauri } from './utils/unified_fs';
import { FABConfig } from './components/ui/FloatingActionButton';

// Custom Hooks
import { useAppNavigation } from './hooks/useAppNavigation';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { useSessionLock } from './hooks/useSessionLock';
import { useBreadcrumb } from './hooks/useBreadcrumb';
import { useWorkflowProgress } from './hooks/useWorkflowProgress';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useShortcutHints } from './hooks/useShortcutHints';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useAppModals } from './hooks/useAppModals';
import { useNetworkHealth } from './hooks/useNetworkHealth';
import { useFocusTrap } from './hooks/useFocusTrap';
import { useModalEscape } from './hooks/useModalEscape';

// Layout Components
import { Breadcrumb } from './components/navigation/Breadcrumb';
import { WorkflowProgress } from './components/navigation/WorkflowProgress';
import { GlobalErrorBoundary } from './components/layout/GlobalErrorBoundary';

// Extracted Sub-Components
import { AppHeader } from './AppHeader';
import { AppModals } from './AppModals';
import { AppTabContent } from './AppTabContent';

import { PrintView } from './modules/PrintView';
import { logger } from './utils/logger';
import { toast } from './components/ui/Toast';
import { startExportSyncWorker, stopExportSyncWorker } from './utils/exportSyncWorker';
import { setExportNotifier, type ExportNotifyEvent } from './utils/autoExportService';
import { useOpenExportFolder } from './hooks/useOpenExportFolder';

interface AppProps {
    onBackToLanding?: () => void;
}

const App: React.FC<AppProps> = ({ onBackToLanding }) => {
    // 0. Special Route for Printing (Bypasses Main Layout)
    if (window.location.hash === '#print') {
        return <PrintView />;
    }

    // =========================================================================
    // CUSTOM HOOKS
    // =========================================================================

    const persistence = useProjectPersistence();
    const undoRedo = useUndoRedo(persistence.data);
    const isUndoingRef = useRef(false);
    const lastDataRef = useRef(persistence.data);

    const navigation = useAppNavigation({
        defaultTab: 'dashboard',
        isReady: persistence.isDbLoaded
    });

    // Auto-record history when data changes (skip if triggered by undo/redo)
    useEffect(() => {
        if (persistence.data !== lastDataRef.current && persistence.data.fileHandle && !isUndoingRef.current) {
            undoRedo.pushState(persistence.data, { tab: navigation.activeTab });
            lastDataRef.current = persistence.data;
        }
        isUndoingRef.current = false;
    }, [persistence.data, navigation.activeTab]);

    const sessionLock = useSessionLock(
        persistence.data.id,
        (loadedData: ProjectData) => {
            persistence.setData(loadedData);
            undoRedo.resetHistory(loadedData);
            navigation.navigateToPanel();
        }
    );

    // Storage initialization state
    const [storageReady, setStorageReady] = useState(!isTauri());
    const [storageVersion, setStorageVersion] = useState(0);
    const [localMediaCount, setLocalMediaCount] = useState(0);

    // Set initial tab to 'panel' if project was loaded from DB
    useEffect(() => {
        if (persistence.isDbLoaded && persistence.data.fileHandle && !window.location.hash) {
            navigation.setActiveTab('panel');
        }
    }, [persistence.isDbLoaded, persistence.data.fileHandle]);

    const workflowProgress = useWorkflowProgress(persistence.data, navigation.activeTab);
    const shortcutHints = useShortcutHints(800);
    const modals = useAppModals();
    const networkHealth = useNetworkHealth();

    // Export folder (Tiempos y Balanceos module)
    const exportFolder = useOpenExportFolder('tiempos', persistence.data);

    // RC1 HOTFIX: Navigation Guard - Prevent accidental data loss
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (persistence.data.fileHandle) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [persistence.data.fileHandle]);

    // Initialize Storage Manager
    useEffect(() => {
        let cancelled = false;
        if (isTauri()) {
            initializeStorageManager().then((mode) => {
                if (cancelled) return;
                logger.info('App', 'Storage initialized', { mode });
                setStorageReady(true);
            }).catch((err) => {
                if (cancelled) return;
                logger.error('App', 'Storage initialization failed', {}, err instanceof Error ? err : undefined);
                setStorageReady(true);
            });
        }
        return () => { cancelled = true; };
    }, []);

    // Start export sync worker (flushes pending exports to Y: when available)
    useEffect(() => {
        if (!storageReady || !isTauri()) return;
        startExportSyncWorker(60_000, (event) => {
            if (event.type === 'flushed' && event.count > 0) {
                toast.success('Exportación sincronizada', `${event.count} archivo(s) exportados a Y:`);
            }
        });
        return () => stopExportSyncWorker();
    }, [storageReady]);

    // Export health check — verify Y: folder structure on startup
    useEffect(() => {
        if (!storageReady || !isTauri()) return;
        let cancelled = false;

        (async () => {
            try {
                const { runExportHealthCheck, validateAndRepair } = await import('./utils/exportHealthCheck');
                const check = await runExportHealthCheck();
                if (cancelled) return;

                if (!check.accessible) {
                    // Y: not available — silently skip, sync worker handles offline
                    logger.info('App', 'Export health check: Y: not accessible (offline mode)');
                    return;
                }

                if (!check.healthy) {
                    const names = check.missing.map(m => m.folderName).join(', ');
                    toast.warning(
                        'Estructura de exportación incompleta',
                        `Faltan carpetas: ${names}`,
                        [{
                            label: 'Crear carpetas',
                            onClick: async () => {
                                const repair = await validateAndRepair();
                                if (repair.created.length > 0) {
                                    toast.success(
                                        'Carpetas creadas',
                                        `${repair.created.length} carpeta(s) creada(s) en Y:\\INGENIERIA`,
                                    );
                                }
                                if (repair.errors.length > 0) {
                                    toast.error(
                                        'Error al crear carpetas',
                                        repair.errors.map(e => e.error).join(', '),
                                    );
                                }
                            },
                            primary: true,
                        }],
                    );
                }
            } catch (e) {
                logger.debug('App', 'Export health check failed', { error: String(e) });
            }
        })();

        return () => { cancelled = true; };
    }, [storageReady]);

    // Export notifier — toasts for export events (written, queued, duplicate, error)
    useEffect(() => {
        if (!storageReady || !isTauri()) return;

        const MODULE_LABELS: Record<string, string> = {
            amfe: 'AMFE', cp: 'Plan de Control', ho: 'Hoja de Operaciones',
            pfd: 'Diagrama de Flujo', tiempos: 'Tiempos y Balanceo',
        };

        setExportNotifier((event: ExportNotifyEvent) => {
            const label = MODULE_LABELS[event.module] || event.module;
            switch (event.type) {
                case 'written':
                    toast.success(
                        `${label} exportado`,
                        `${event.filenames.length} archivo(s) escritos en Y:`,
                    );
                    break;
                case 'queued':
                    toast.info(
                        `${label} encolado`,
                        `${event.count} archivo(s) en cola (Y: no disponible). Se sincronizarán automáticamente.`,
                    );
                    break;
                case 'error':
                    toast.error(
                        `Error exportando ${label}`,
                        event.errors.join(', '),
                    );
                    break;
                // 'duplicate' — silently skip (no toast needed)
            }
        });

        return () => setExportNotifier(null);
    }, [storageReady]);

    // Detect local media files on startup
    useEffect(() => {
        if (!storageReady || !isTauri()) return;
        let cancelled = false;

        (async () => {
            try {
                const { countLocalMediaFiles } = await import('./utils/mediaManager');
                const count = await countLocalMediaFiles();
                if (cancelled || count === 0) return;
                setLocalMediaCount(count);

                const { isServerAvailable } = await import('./utils/storageManager');
                const serverUp = await isServerAvailable();
                if (cancelled || !serverUp) return;

                toast.warning(
                    'Multimedia en almacenamiento local',
                    `${count} archivo(s) de media detectados. El servidor está disponible para migrar.`,
                    [{
                        label: 'Migrar al Servidor',
                        onClick: () => modals.setShowMediaMigration(true),
                        primary: true,
                    }]
                );
            } catch (e) {
                logger.debug('App', 'Media check failed', { error: String(e) });
            }
        })();

        return () => { cancelled = true; };
    }, [storageReady]);

    // Refresh media count after migration
    const handleMediaMigrationComplete = useCallback(async () => {
        try {
            const { countLocalMediaFiles } = await import('./utils/mediaManager');
            const count = await countLocalMediaFiles();
            setLocalMediaCount(count);
        } catch { /* ignore */ }
    }, []);

    // =========================================================================
    // LIFTED STATE
    // =========================================================================

    const [fsRoot] = useState<FileSystemDirectoryHandle | string | null>(null);


    const [graphState, setGraphState] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
    const [mixInitialProducts, setMixInitialProducts] = useState<Array<{ path: string; demand: number }>>([]);

    const breadcrumbItems = useBreadcrumb({
        hasOpenProject: !!persistence.data.fileHandle,
        meta: persistence.data.meta,
        activeTab: navigation.activeTab,
        onNavigate: navigation.setActiveTab
    });

    // V5.0: Keyboard Shortcuts Integration
    useKeyboardShortcuts(navigation.activeTab, {
        onSave: persistence.data.fileHandle && !sessionLock.isReadOnly ? persistence.handleQuickSave : undefined,
        onNavigate: navigation.setActiveTab,
        onShowHelp: () => modals.setShowShortcutsHelp(true),
        onOpenCommandPalette: () => modals.setShowCommandPalette(true),
        onNewStudy: modals.openProjectWizard,
        onCloseProject: persistence.data.fileHandle ? modals.handleCloseProject : undefined,
        isProjectOpen: !!persistence.data.fileHandle,
        isSaveDisabled: sessionLock.isReadOnly,
    });

    // V6.0: Floating Action Button
    const fabConfig = useMemo<FABConfig | null>(() => {
        switch (navigation.activeTab) {
            case 'dashboard':
            default:
                return null;
        }
    }, [navigation.activeTab]);

    // Handlers
    const confirmCloseProject = () => {
        modals.confirmCloseProject(persistence.setData, navigation.navigateToDashboard);
    };

    // A11y: Modal Focus Management
    useModalEscape(modals.showCloseModal, () => modals.setShowCloseModal(false));
    const closeModalRef = useFocusTrap(modals.showCloseModal);

    // Smooth Entry: Wait for storage to be ready
    if (!storageReady) return null;

    // =========================================================================
    // RENDER
    // =========================================================================

    return (
        <GlobalErrorBoundary>
            <AppModals
                navigation={navigation}
                persistence={persistence}
                sessionLock={sessionLock}
                undoRedo={undoRedo}
                shortcutHints={shortcutHints}
                modals={modals}
                fabConfig={fabConfig}
                closeModalRef={closeModalRef}
                setStorageVersion={setStorageVersion}
                confirmCloseProject={confirmCloseProject}
                onMediaMigrationComplete={handleMediaMigrationComplete}
            />

            <div className="min-h-full bg-slate-50 print:bg-white text-slate-900 selection:bg-blue-100 animate-fade-in-up">
                <AppHeader
                    onBackToLanding={onBackToLanding}
                    localMediaCount={localMediaCount}
                    onMediaMigrationClick={() => modals.setShowMediaMigration(true)}
                    navigation={navigation}
                    persistence={persistence}
                    sessionLock={sessionLock}
                    undoRedo={undoRedo}
                    isUndoingRef={isUndoingRef}
                    shortcutHints={shortcutHints}
                    modals={modals}
                    networkHealth={networkHealth}
                    exportFolder={exportFolder}
                />

                {/* P3: Breadcrumb contextual */}
                {navigation.activeTab !== 'dashboard' && breadcrumbItems.length > 1 && (
                    <div className="bg-white border-b border-slate-100 px-4 sm:px-6 lg:px-8 py-2 print:hidden">
                        <Breadcrumb items={breadcrumbItems} />
                    </div>
                )}

                {/* Phase 3 UX: Workflow Progress Indicator */}
                {persistence.data.fileHandle && navigation.activeTab !== 'dashboard' && (
                    <WorkflowProgress
                        steps={workflowProgress.steps}
                        currentStepIndex={workflowProgress.currentStepIndex}
                        overallProgress={workflowProgress.overallProgress}
                        onNavigate={navigation.setActiveTab}
                    />
                )}

                <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 relative">
                    <div key={navigation.activeTab} className="animate-fade-in-up">
                        <AppTabContent
                            activeTab={navigation.activeTab}
                            persistence={persistence}
                            fsRoot={fsRoot}
                            graphState={graphState}
                            setGraphState={setGraphState}
                            mixInitialProducts={mixInitialProducts}
                            setMixInitialProducts={setMixInitialProducts}
                            storageReady={storageReady}
                            storageVersion={storageVersion}
                            navigation={navigation}
                            undoRedo={undoRedo}
                            modals={modals}
                        />
                    </div>
                </main>
            </div>
        </GlobalErrorBoundary>
    );
};

export default App;

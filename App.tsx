/**
 * Barack Mercosul v7.0.0 - Tiempos y Balanceos
 *
 * NOTA: Esta aplicación es EXCLUSIVAMENTE para escritorio (Desktop/Tauri).
 * No está diseñada ni optimizada para dispositivos móviles.
 *
 * @module App
 * @version 7.0.0
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeStorageManager } from './utils/storageManager';
import { ProjectData } from './types';
import { isTauri } from './utils/unified_fs';
import { setPathConfig } from './utils/pathManager';
import { FABConfig } from './components/ui/FloatingActionButton';

// Custom Hooks
import { useAppNavigation, Tab } from './hooks/useAppNavigation';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { useSessionLock } from './hooks/useSessionLock';
import { useBreadcrumb } from './hooks/useBreadcrumb';
import { useWorkflowProgress } from './hooks/useWorkflowProgress';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useShortcutHints } from './hooks/useShortcutHints';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useAppModals } from './hooks/useAppModals';
import { useFocusTrap } from './hooks/useFocusTrap';
import { useModalEscape } from './hooks/useModalEscape';

// Layout Components
import { Breadcrumb } from './components/navigation/Breadcrumb';
import { WorkflowProgress } from './components/navigation/WorkflowProgress';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';

// Extracted Sub-Components
import { AppHeader } from './AppHeader';
import { AppModals } from './AppModals';
import { AppTabContent } from './AppTabContent';

import { PrintView } from './modules/PrintView';
import { logger } from './utils/logger';

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

    const navigation = useAppNavigation({
        defaultTab: 'dashboard',
        isReady: persistence.isDbLoaded
    });

    // Auto-record history when data changes (skip if triggered by undo/redo)
    useEffect(() => {
        if (persistence.data.fileHandle && !isUndoingRef.current) {
            undoRedo.pushState(persistence.data, { tab: navigation.activeTab });
        }
        isUndoingRef.current = false;
    }, [persistence.data, navigation.activeTab]);

    const sessionLock = useSessionLock(
        persistence.data.id,
        (loadedData: ProjectData) => {
            persistence.setData(loadedData);
            navigation.navigateToPanel();
        }
    );

    // Storage initialization state
    const [storageReady, setStorageReady] = useState(!isTauri());
    const [storageVersion, setStorageVersion] = useState(0);

    // Set initial tab to 'panel' if project was loaded from DB
    useEffect(() => {
        if (persistence.isDbLoaded && persistence.data.fileHandle && !window.location.hash) {
            navigation.setActiveTab('panel');
        }
    }, [persistence.isDbLoaded, persistence.data.fileHandle]);

    const workflowProgress = useWorkflowProgress(persistence.data, navigation.activeTab);
    const shortcutHints = useShortcutHints(800);
    const modals = useAppModals();

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
        if (isTauri()) {
            initializeStorageManager().then((mode) => {
                logger.info('App', 'Storage initialized', { mode });
                setStorageReady(true);
            }).catch((err) => {
                logger.error('App', 'Storage initialization failed', {}, err instanceof Error ? err : undefined);
                setStorageReady(true);
            });
        }
    }, []);

    // =========================================================================
    // LIFTED STATE
    // =========================================================================

    const [fsRoot, setFsRoot] = useState<FileSystemDirectoryHandle | string | null>(null);

    const handleSetRootWithSync = (root: FileSystemDirectoryHandle | string | null) => {
        if (typeof root === 'string') {
            setPathConfig({ basePath: root });
            setFsRoot(root);
        } else if (root) {
            setFsRoot(root);
        } else {
            setFsRoot(null);
        }
    };

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
                shortcutHints={shortcutHints}
                modals={modals}
                fabConfig={fabConfig}
                closeModalRef={closeModalRef}
                storageVersion={storageVersion}
                setStorageVersion={setStorageVersion}
                confirmCloseProject={confirmCloseProject}
            />

            <div className="min-h-screen bg-slate-50 print:bg-white text-slate-900 selection:bg-blue-100 animate-fade-in-up">
                <AppHeader
                    onBackToLanding={onBackToLanding}
                    navigation={navigation}
                    persistence={persistence}
                    sessionLock={sessionLock}
                    undoRedo={undoRedo}
                    isUndoingRef={isUndoingRef}
                    shortcutHints={shortcutHints}
                    modals={modals}
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
                            modals={modals}
                        />
                    </div>
                </main>
            </div>
        </GlobalErrorBoundary>
    );
};

export default App;

/**
 * Barack Mercosul v1-beta - Tiempos y Balanceos
 *
 * Web app (React + Supabase). No Tauri desktop runtime.
 *
 * @module App
 * @version 1.0.0-beta
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProjectData } from './types';
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
import { useOpenExportFolder } from './hooks/useOpenExportFolder';

interface AppProps {
    onBackToLanding?: () => void;
}

/** Wrapper that handles the print route without violating hooks rules. */
const App: React.FC<AppProps> = (props) => {
    if (window.location.hash === '#print') {
        return <PrintView />;
    }
    return <AppMain {...props} />;
};

/** Main app component — all hooks are called unconditionally here. */
const AppMain: React.FC<AppProps> = ({ onBackToLanding }) => {
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

    // Destructured stable refs (useCallback'd upstream) so we can satisfy
    // exhaustive-deps without pulling in the full hook objects (whose
    // identity changes every render).
    const undoPush = undoRedo.pushState;
    const activeTab = navigation.activeTab;

    // Auto-record history when data changes (skip if triggered by undo/redo)
    useEffect(() => {
        if (persistence.data !== lastDataRef.current && persistence.data.fileHandle) {
            if (!isUndoingRef.current) {
                undoPush(persistence.data, { tab: activeTab });
            }
            lastDataRef.current = persistence.data;
            // Clear flag only after data actually changed so re-runs caused by
            // activeTab / undoPush identity changes do not consume the flag prematurely.
            isUndoingRef.current = false;
        }
    }, [persistence.data, activeTab, undoPush]);

    const sessionLock = useSessionLock(
        persistence.data.id,
        (loadedData: ProjectData) => {
            persistence.setData(loadedData);
            undoRedo.resetHistory(loadedData);
            navigation.navigateToPanel();
        }
    );

    // Web build: storage is always ready (Supabase). No Tauri initialization.
    const storageReady = true;
    const [storageVersion, setStorageVersion] = useState(0);

    // Set initial tab to 'panel' if project was loaded from DB
    const navSetActiveTab = navigation.setActiveTab;
    useEffect(() => {
        if (persistence.isDbLoaded && persistence.data.fileHandle && !window.location.hash) {
            navSetActiveTab('panel');
        }
    }, [persistence.isDbLoaded, persistence.data.fileHandle, navSetActiveTab]);

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
            />

            <div className="min-h-full bg-slate-50 print:bg-white text-slate-900 selection:bg-blue-100 animate-fade-in-up">
                <AppHeader
                    onBackToLanding={onBackToLanding}
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

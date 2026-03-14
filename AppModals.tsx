/**
 * AppModals - All modal components extracted from App.tsx
 * Includes: LockConflict, SaveConflict, RevisionHistory, DiagnosticQA,
 * CloseProject, ProjectWizard, SyncPanel, StorageConfig, ShortcutsHelp,
 * CommandPalette, FloatingActionButton, ShortcutHintsOverlay, ToastContainer.
 */
import React from 'react';
import { SyncPanel } from './modules/SyncPanel';
import { MediaMigrationPanel } from './modules/MediaMigrationPanel';
import { StorageConfigModal } from './components/modals/StorageConfigModal';
import { ProjectWizard } from './modules/ProjectWizard';
import { listProjects, listParts, ensureStudyStructure, buildMasterJsonPath, buildPath } from './utils/pathManager';
import { ShortcutsHelpModal } from './components/modals/ShortcutsHelpModal';
import { CommandPalette } from './components/ui/CommandPalette';
import { ShortcutHintsOverlay } from './components/ui/ShortcutHintsOverlay';
import { FloatingActionButton, FABConfig } from './components/ui/FloatingActionButton';
import { ConflictModal } from './components/modals/ConflictModal';
import { LockConflictModal } from './components/modals/LockConflictModal';
import { RevisionHistory } from './components/modals/RevisionHistory';
import { DiagnosticQA } from './components/modals/DiagnosticQA';
import { ToastContainer, toast } from './components/ui/Toast';
import { XCircle, History } from 'lucide-react';
import { INITIAL_PROJECT } from './types';
import { isTauri } from './utils/unified_fs';
import type { Tab } from './hooks/useAppNavigation';
import type { useProjectPersistence } from './hooks/useProjectPersistence';
import type { useSessionLock } from './hooks/useSessionLock';
import type { useUndoRedo } from './hooks/useUndoRedo';
import type { useShortcutHints } from './hooks/useShortcutHints';
import type { useAppModals } from './hooks/useAppModals';

interface AppModalsProps {
    navigation: {
        activeTab: Tab;
        setActiveTab: (tab: Tab) => void;
    };
    persistence: ReturnType<typeof useProjectPersistence>;
    sessionLock: ReturnType<typeof useSessionLock>;
    undoRedo: ReturnType<typeof useUndoRedo>;
    shortcutHints: ReturnType<typeof useShortcutHints>;
    modals: ReturnType<typeof useAppModals>;
    fabConfig: FABConfig | null;
    closeModalRef: React.RefObject<HTMLDivElement | null>;
    storageVersion: number;
    setStorageVersion: React.Dispatch<React.SetStateAction<number>>;
    confirmCloseProject: () => void;
    onMediaMigrationComplete?: () => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
    navigation,
    persistence,
    sessionLock,
    undoRedo,
    shortcutHints,
    modals,
    fabConfig,
    closeModalRef,
    storageVersion,
    setStorageVersion,
    confirmCloseProject,
    onMediaMigrationComplete,
}) => {
    return (
        <>
            {/* Lock Conflict Modal */}
            {sessionLock.lockConflict && (
                <LockConflictModal
                    onCancel={sessionLock.handleCancelLock}
                    onForceLock={sessionLock.handleForceLock}
                />
            )}

            {/* Save Conflict Modal */}
            {persistence.saveConflict && (
                <ConflictModal
                    conflict={persistence.saveConflict}
                    onReload={persistence.handleConflictReload}
                    onSaveAsNew={persistence.handleConflictSaveAsNew}
                    onCancel={persistence.handleConflictCancel}
                />
            )}

            {/* Revision History Modal */}
            {modals.showRevisionHistory && persistence.data.directoryHandle && typeof persistence.data.directoryHandle === 'string' && typeof persistence.data.fileHandle === 'string' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto animate-in fade-in zoom-in duration-200">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <History size={20} /> Historial de Revisiones
                            </h2>
                            <button
                                onClick={() => modals.setShowRevisionHistory(false)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <RevisionHistory
                                directoryPath={persistence.data.directoryHandle as string}
                                currentFilePath={persistence.data.fileHandle as string}
                                onRestore={(restored) => {
                                    const restoredData = {
                                        ...restored,
                                        fileHandle: persistence.data.fileHandle,
                                        directoryHandle: persistence.data.directoryHandle
                                    };
                                    persistence.setData(restoredData);
                                    undoRedo.resetHistory(restoredData);
                                    modals.setShowRevisionHistory(false);
                                    toast.success('Versión Restaurada', 'Se cargó la versión seleccionada');
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Diagnostic QA Modal */}
            <DiagnosticQA
                isOpen={modals.showDiagnosticQA}
                onClose={() => modals.setShowDiagnosticQA(false)}
                directoryPath={typeof persistence.data.directoryHandle === 'string' ? persistence.data.directoryHandle : null}
            />

            {/* Close Project Confirmation Modal */}
            {modals.showCloseModal && (
                <div
                    ref={closeModalRef}
                    className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-close-title"
                >
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
                            <div className="bg-red-100 p-2 rounded-full">
                                <XCircle size={24} className="text-red-600" />
                            </div>
                            <h2 id="modal-close-title" className="text-lg font-bold text-red-900">¿Cerrar Proyecto?</h2>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 mb-6">
                                El proyecto se cerrará y volverás al inicio.
                                <strong className="block mt-2 text-slate-800">Asegúrate de haber guardado los cambios.</strong>
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    autoFocus
                                    onClick={() => modals.setShowCloseModal(false)}
                                    className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors outline-none ring-2 ring-offset-2 ring-transparent focus:ring-blue-500"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmCloseProject}
                                    className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors flex items-center gap-2 outline-none ring-2 ring-offset-2 ring-transparent focus:ring-red-500"
                                >
                                    <XCircle size={16} />
                                    Cerrar Proyecto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* V4.1 Project Wizard Modal */}
            <ProjectWizard
                isOpen={modals.showProjectWizard}
                onClose={() => modals.setShowProjectWizard(false)}
                existingClients={modals.wizardClients}
                getProjectsForClient={listProjects}
                getPartsForProject={listParts}
                onComplete={async (selection) => {
                    modals.setShowProjectWizard(false);

                    // Create folder structure
                    const result = await ensureStudyStructure(
                        selection.client,
                        selection.project,
                        selection.part
                    );

                    if (result.success) {
                        // Create initial master.json
                        const masterPath = buildMasterJsonPath(
                            selection.client,
                            selection.project,
                            selection.part
                        );

                        const dataPath = buildPath('data', selection.client, selection.project, selection.part);

                        // Initial project data
                        const initialData = {
                            ...INITIAL_PROJECT,
                            meta: {
                                ...INITIAL_PROJECT.meta,
                                name: selection.part,
                                client: selection.client,
                                project: selection.project,
                                createdAt: new Date().toISOString()
                            },
                            fileHandle: masterPath,
                            directoryHandle: dataPath
                        };

                        // Try to write master.json
                        if (isTauri()) {
                            const tauriFs = await import('./utils/tauri_fs');
                            await tauriFs.writeTextFile(masterPath, JSON.stringify(initialData, null, 2));
                        }

                        // Load project and navigate
                        persistence.setData(initialData);
                        undoRedo.resetHistory(initialData);
                        navigation.setActiveTab('panel');

                        toast.success(
                            'Estudio Creado',
                            `${result.createdPaths.length} carpetas creadas en ${selection.client}/${selection.project}/${selection.part}`
                        );
                    } else {
                        toast.error('Error', result.error || 'No se pudieron crear las carpetas');
                    }
                }}
            />

            {/* Sync Panel Modal */}
            {modals.showSyncPanel && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-end">
                    <div className="bg-slate-900 w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300">
                        <div className="absolute top-4 right-4">
                            <button
                                onClick={() => modals.setShowSyncPanel(false)}
                                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                        <SyncPanel
                            onClose={() => modals.setShowSyncPanel(false)}
                            onOpenConfig={() => {
                                modals.setShowSyncPanel(false);
                                modals.setShowStorageConfig(true);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Media Migration Panel */}
            {modals.showMediaMigration && (
                <MediaMigrationPanel
                    onClose={() => modals.setShowMediaMigration(false)}
                    onMigrationComplete={onMediaMigrationComplete}
                />
            )}

            {/* Storage Config Modal */}
            <StorageConfigModal
                isOpen={modals.showStorageConfig}
                onClose={() => modals.setShowStorageConfig(false)}
                onSave={() => {
                    // Force Dashboard to reload data with new path config
                    setStorageVersion(v => v + 1);
                    toast.success('Configuración Actualizada', 'Los datos se recargarán automáticamente');
                }}
            />

            {/* Keyboard Shortcuts Help Modal */}
            <ShortcutsHelpModal
                isOpen={modals.showShortcutsHelp}
                onClose={() => modals.setShowShortcutsHelp(false)}
                activeContext={navigation.activeTab}
            />

            {/* Command Palette (Ctrl+K) */}
            <CommandPalette
                isOpen={modals.showCommandPalette}
                onClose={() => modals.setShowCommandPalette(false)}
                onNavigate={(tab) => {
                    navigation.setActiveTab(tab);
                }}
                onNewStudy={modals.openProjectWizard}
                onSave={persistence.data.fileHandle && !sessionLock.isReadOnly ? persistence.handleQuickSave : undefined}
                onShowHelp={() => modals.setShowShortcutsHelp(true)}
                isProjectOpen={!!persistence.data.fileHandle}
                isSaveDisabled={sessionLock.isReadOnly}
            />

            {/* Floating Action Button (Contextual) */}
            <FloatingActionButton config={fabConfig} />

            {/* Shortcut Hints Overlay (Alt hold) */}
            <ShortcutHintsOverlay isVisible={shortcutHints.hintsVisible} />

            <ToastContainer />
        </>
    );
};

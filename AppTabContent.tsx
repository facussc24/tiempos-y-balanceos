/**
 * AppTabContent - Tab content switch extracted from App.tsx
 * Renders the active tab's module/component.
 */
import React from 'react';
import { PanelControl } from './modules/PanelControl';
import { TaskManager } from './modules/TaskManager';
import { LineBalancing } from './modules/LineBalancing';
import { DependencyGraph } from './modules/DependencyGraph';
import { HelpCenter } from './modules/HelpCenter';
import { OeeDetail } from './modules/OeeDetail';
import { PlantConfigPanel } from './modules/PlantConfigPanel';
import { MixModeView } from './modules/mix';
import { FlowSimulatorModule } from './modules/flow-simulator/FlowSimulatorModule';
import { ExecutiveSummary } from './modules/ExecutiveSummary';
import { Dashboard } from './modules/Dashboard';
import { listClients, listProjects, listParts, buildPath } from './utils/pathManager';
import { addToRecentProjects } from './components/navigation/ProjectSwitcher';
import { logger } from './utils/logger';
import { toast } from './components/ui/Toast';
import type { Tab } from './hooks/useAppNavigation';
import type { useProjectPersistence } from './hooks/useProjectPersistence';
import type { useUndoRedo } from './hooks/useUndoRedo';
import type { useAppModals } from './hooks/useAppModals';

interface AppTabContentProps {
    activeTab: Tab;
    persistence: ReturnType<typeof useProjectPersistence>;
    fsRoot: FileSystemDirectoryHandle | string | null;
    graphState: { zoom: number; pan: { x: number; y: number } };
    setGraphState: React.Dispatch<React.SetStateAction<{ zoom: number; pan: { x: number; y: number } }>>;
    mixInitialProducts: Array<{ path: string; demand: number }>;
    setMixInitialProducts: React.Dispatch<React.SetStateAction<Array<{ path: string; demand: number }>>>;
    storageReady: boolean;
    storageVersion: number;
    navigation: {
        activeTab: Tab;
        setActiveTab: (tab: Tab) => void;
    };
    undoRedo: ReturnType<typeof useUndoRedo>;
    modals: ReturnType<typeof useAppModals>;
}

export const AppTabContent: React.FC<AppTabContentProps> = ({
    activeTab,
    persistence,
    fsRoot,
    graphState,
    setGraphState,
    mixInitialProducts,
    setMixInitialProducts,
    storageReady,
    storageVersion,
    navigation,
    undoRedo,
    modals,
}) => {
    return (
        <>
            {/* V4.1 Dashboard */}
            {activeTab === 'dashboard' && (
                <Dashboard
                    onNewStudy={modals.openProjectWizard}
                    onOpenProject={async (studyInfo) => {
                        // studyInfo format: "CLIENT/PROJECT/PART"
                        const [client, project, part] = studyInfo.split('/');

                        try {
                            // Web mode: buscar proyecto por metadata y cargarlo desde Supabase
                            const { getProjectsByClient, loadProject: loadProjectFromDb } = await import('./utils/repositories/projectRepository');
                            const dbProjects = await getProjectsByClient(client);
                            const match = dbProjects.find(p => p.project_code === project && p.name === part);
                            if (match) {
                                const loadedData = await loadProjectFromDb(match.id);
                                if (loadedData) {
                                    persistence.setData(loadedData);
                                    undoRedo.resetHistory(loadedData);
                                    addToRecentProjects({
                                        path: studyInfo,
                                        name: loadedData.meta?.name || part,
                                        client,
                                        project,
                                    });
                                    navigation.setActiveTab('panel');
                                    toast.success('Proyecto Cargado', loadedData.meta?.name || part);
                                } else {
                                    toast.error('Error', 'No se pudo cargar el proyecto');
                                }
                            } else {
                                toast.error('Proyecto no encontrado', `${client}/${project}/${part}`);
                            }
                        } catch (e) {
                            logger.error('App', 'Error opening project', {}, e instanceof Error ? e : undefined);
                            toast.error('Error', 'No se pudo abrir el proyecto');
                        }
                    }}
                    onNavigateToMix={(products) => {
                        if (products && products.length > 0) {
                            setMixInitialProducts(products);
                        } else {
                            setMixInitialProducts([]);
                        }
                        navigation.setActiveTab('mix');
                    }}
                    onConfigPlant={() => navigation.setActiveTab('plant')}
                    onDeleteStudy={async (path) => {
                        try {
                            const { deleteStudy, buildPath } = await import('./utils/pathManager');

                            // Reconstruir path absoluto
                            const [client, project, part] = path.split('/');
                            const absolutePath = buildPath('data', client, project, part);

                            const result = await deleteStudy(absolutePath);
                            if (!result.success) {
                                toast.error('Error al Eliminar', result.error || 'Error desconocido al eliminar el estudio');
                                return;
                            }

                            toast.success('Estudio Eliminado', `Se eliminó "${part}" correctamente`);
                        } catch (e) {
                            logger.error('App', 'Error deleting study', { path }, e instanceof Error ? e : undefined);
                            toast.error('Error al Eliminar', e instanceof Error ? e.message : 'Error desconocido');
                        }
                    }}
                    onDeleteProject={async (client, project) => {
                        try {
                            const { deleteProject } = await import('./utils/pathManager');

                            const result = await deleteProject(client, project);
                            if (!result.success) {
                                toast.error('Error al Eliminar', result.error || 'Error desconocido al eliminar el proyecto');
                                return;
                            }

                            toast.success('Proyecto Eliminado');
                        } catch (e) {
                            logger.error('App', 'Error deleting project', { client, project }, e instanceof Error ? e : undefined);
                            toast.error('Error al Eliminar', e instanceof Error ? e.message : 'Error desconocido');
                        }
                    }}
                    onDeleteClient={async (client) => {
                        try {
                            const { deleteClient } = await import('./utils/pathManager');

                            const result = await deleteClient(client);
                            if (!result.success) {
                                toast.error('Error al Eliminar', result.error || 'Error desconocido al eliminar el cliente');
                                return;
                            }

                            toast.success('Cliente Eliminado');
                        } catch (e) {
                            logger.error('App', 'Error deleting client', { client }, e instanceof Error ? e : undefined);
                            toast.error('Error al Eliminar', e instanceof Error ? e.message : 'Error desconocido');
                        }
                    }}
                    listClientsFunc={listClients}
                    listProjectsFunc={listProjects}
                    listPartsFunc={listParts}
                    storageReady={storageReady}
                    storageVersion={storageVersion}
                    buildPathFunc={(client, project, part) =>
                        `${client}/${project}/${part}`
                    }
                />
            )}

            {/* BETA: Explorer tab removed - projects open from Dashboard */}
            {activeTab === 'plant' && <PlantConfigPanel />}
            {activeTab === 'mix' && (
                <MixModeView
                    initialProducts={mixInitialProducts}
                    onBack={() => {
                        setMixInitialProducts([]);
                        navigation.setActiveTab('dashboard');
                    }}
                />
            )}
            {activeTab === 'panel' && <PanelControl data={persistence.data} updateData={persistence.setData} />}

            {activeTab === 'tasks' && <TaskManager data={persistence.data} updateData={persistence.setData} rootHandle={fsRoot} />}
            {activeTab === 'oee' && <OeeDetail data={persistence.data} updateData={persistence.setData} />}

            {activeTab === 'graph' && (
                <DependencyGraph
                    data={persistence.data}
                    initialState={graphState}
                    onStateChange={setGraphState}
                />
            )}

            {activeTab === 'balance' && <LineBalancing data={persistence.data} updateData={persistence.setData} />}
            {activeTab === 'vsm' && (
                <FlowSimulatorModule
                    data={persistence.data}
                    updateData={persistence.setData}
                />
            )}

            {activeTab === 'summary' && <ExecutiveSummary data={persistence.data} />}
            {activeTab === 'help' && <HelpCenter />}
        </>
    );
};

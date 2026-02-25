/**
 * AppTabContent - Tab content switch extracted from App.tsx
 * Renders the active tab's module/component.
 */
import React from 'react';
import { ProjectData, INITIAL_PROJECT } from './types';
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
import { isTauri } from './utils/unified_fs';
import { listClients, listProjects, listParts, buildMasterJsonPath, buildPath } from './utils/pathManager';
import { addToRecentProjects } from './components/ProjectSwitcher';
import { logger } from './utils/logger';
import { toast } from './components/ui/Toast';
import type { Tab } from './hooks/useAppNavigation';
import type { useProjectPersistence } from './hooks/useProjectPersistence';
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
                        const masterPath = buildMasterJsonPath(client, project, part);
                        const dataPath = buildPath('data', client, project, part);

                        try {
                            if (isTauri()) {
                                const tauriFs = await import('./utils/tauri_fs');
                                const content = await tauriFs.readTextFile(masterPath);

                                if (content) {
                                    const projectData = JSON.parse(content);
                                    persistence.setData({
                                        ...projectData,
                                        fileHandle: masterPath,
                                        directoryHandle: dataPath
                                    });
                                    // Add to recent projects for Quick Switch
                                    addToRecentProjects({
                                        path: studyInfo,
                                        name: projectData.meta?.name || part,
                                        client,
                                        project
                                    });
                                    navigation.setActiveTab('panel');
                                    toast.success('Proyecto Cargado', projectData.meta?.name || part);
                                } else {
                                    // Create empty structure if no master.json exists
                                    const initialData = {
                                        ...INITIAL_PROJECT,
                                        meta: { ...INITIAL_PROJECT.meta, name: part, client, project },
                                        fileHandle: masterPath,
                                        directoryHandle: dataPath
                                    };
                                    persistence.setData(initialData);
                                    navigation.setActiveTab('panel');
                                    toast.info('Nuevo Proyecto', 'Creando estructura inicial...');
                                }
                            } else {
                                // Web mode
                                navigation.setActiveTab('panel');
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
                        const { deleteStudy, buildPath } = await import('./utils/pathManager');
                        const { confirmDialog } = await import('./utils/tauri_fs');

                        // Reconstruir path absoluto
                        const [client, project, part] = path.split('/');
                        const absolutePath = buildPath('data', client, project, part);

                        // Confirmación NATIVA
                        const confirmed = await confirmDialog(
                            'Eliminar Estudio',
                            `¿Estás seguro de que deseas eliminar permanentemente el estudio "${part}"?\n\nEsta acción no se puede deshacer.`
                        );

                        if (!confirmed) return;

                        const result = await deleteStudy(absolutePath);
                        if (!result.success) {
                            throw new Error(result.error || 'Error desconocido al eliminar');
                        }

                        toast.success('Estudio Eliminado', `Se eliminó "${part}" correctamente`);
                    }}
                    onDeleteProject={async (client, project) => {
                        const { deleteProject } = await import('./utils/pathManager');
                        const { confirmDialog } = await import('./utils/tauri_fs');

                        const confirmed = await confirmDialog(
                            'Eliminar Proyecto',
                            `¿Estás seguro de que deseas eliminar el proyecto "${project}"?\n\nSe eliminarán TODAS las piezas y estudios contenidos. Esta acción es irreversible.`
                        );

                        if (!confirmed) return;

                        const result = await deleteProject(client, project);
                        if (!result.success) throw new Error(result.error);
                        toast.success('Proyecto Eliminado');
                    }}
                    onDeleteClient={async (client) => {
                        const { deleteClient } = await import('./utils/pathManager');
                        const { confirmDialog } = await import('./utils/tauri_fs');

                        const confirmed = await confirmDialog(
                            'Eliminar Cliente',
                            `¿Estás seguro de que deseas eliminar el cliente "${client}"?\n\nSe eliminarán TODOS sus proyectos y estudios. Esta acción es irreversible.`
                        );

                        if (!confirmed) return;

                        const result = await deleteClient(client);
                        if (!result.success) throw new Error(result.error);
                        toast.success('Cliente Eliminado');
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

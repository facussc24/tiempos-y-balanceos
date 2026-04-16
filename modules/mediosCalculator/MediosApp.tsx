/**
 * MediosApp — Main entry point for the Medios Logisticos Calculator module.
 * Standalone page with tabs: Piezas | Resultados | Dashboard | Escenarios | Config
 * Supports per-project and global (cross-project) views.
 */
import React, { useState } from 'react';
import { Package, ArrowLeft, ListOrdered, BarChart3, Beaker, Settings2, TrendingUp, Globe } from 'lucide-react';
import { useMediosProject } from './hooks/useMediosProject';
import { useMediosCalculations } from './hooks/useMediosCalculations';
import { ProjectSelector } from './components/ProjectSelector';
import { PieceListTable } from './components/PieceListTable';
import { ResultsPanel } from './components/ResultsPanel';
import { ScenariosPanel } from './components/ScenariosPanel';
import { DashboardPanel } from './components/DashboardPanel';
import { ContainerTypeManager } from './components/ContainerTypeManager';
import type { MediosTab } from './types';

interface MediosAppProps {
  onBackToLanding: () => void;
}

const TABS: { id: MediosTab; label: string; icon: React.ReactNode }[] = [
  { id: 'pieces', label: 'Piezas', icon: <ListOrdered size={16} /> },
  { id: 'results', label: 'Resultados', icon: <BarChart3 size={16} /> },
  { id: 'dashboard', label: 'Dashboard', icon: <TrendingUp size={16} /> },
  { id: 'scenarios', label: 'Escenarios', icon: <Beaker size={16} /> },
  { id: 'config', label: 'Configuracion', icon: <Settings2 size={16} /> },
];

const MediosApp: React.FC<MediosAppProps> = ({ onBackToLanding }) => {
  const [activeTab, setActiveTab] = useState<MediosTab>('pieces');
  const project = useMediosProject();
  const calculations = useMediosCalculations({
    pieces: project.pieces,
    containerTypes: project.containerTypes,
    utilizationRate: project.activeProject?.utilizationRate ?? 0.70,
    availableM2: project.activeProject?.availableM2 ?? null,
  });

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLanding}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="Volver al inicio"
              title="Volver al inicio"
            >
              <ArrowLeft size={18} />
            </button>
            <Package size={22} className="text-emerald-600" />
            <h1 className="text-lg font-semibold text-slate-800 text-balance">Medios Logisticos</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Global View Toggle */}
            <button
              onClick={() => project.selectGlobalView()}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                project.isGlobalView
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300 font-medium'
                  : 'text-slate-500 border-slate-300 hover:bg-slate-50'
              }`}
              title="Ver todos los proyectos combinados"
            >
              <Globe size={14} />
              Global
            </button>
            <ProjectSelector
              projects={project.projects}
              activeProject={project.isGlobalView ? null : project.activeProject}
              loading={project.loading}
              onSelect={project.selectProject}
              onCreate={project.createProject}
              onDelete={project.deleteProject}
            />
          </div>
        </div>

        {/* Tabs */}
        {project.activeProject && (
          <div className="flex gap-1 mt-4 -mb-4">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-emerald-700 border-emerald-600 bg-emerald-50/50'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {project.loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="size-6 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
            <span className="ml-3 text-slate-500">Cargando...</span>
          </div>
        ) : !project.activeProject ? (
          <div className="text-center py-20 text-slate-400">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Selecciona o crea un proyecto</p>
            <p className="text-sm mt-1">para comenzar a calcular medios logisticos</p>
          </div>
        ) : (
          <>
            {activeTab === 'pieces' && !project.isGlobalView && (
              <PieceListTable
                pieces={project.pieces}
                containerTypes={project.containerTypes}
                projectId={project.activeProject.id}
                onAddPiece={project.addPiece}
                onUpdatePiece={project.updatePiece}
                onDeletePiece={project.deletePiece}
              />
            )}
            {activeTab === 'pieces' && project.isGlobalView && (
              <div className="text-center py-12 text-slate-400">
                <Globe size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-base font-medium">Vista Global - solo lectura</p>
                <p className="text-sm mt-1">Selecciona un proyecto individual para editar piezas</p>
              </div>
            )}
            {activeTab === 'results' && (
              <ResultsPanel
                results={calculations.results}
                totalContainers={calculations.totalContainers}
                totalPieces={calculations.totalPieces}
                totalM2={calculations.totalM2}
                avgCoverageDays={calculations.avgCoverageDays}
                loadedPieces={calculations.loadedPieces}
              />
            )}
            {activeTab === 'dashboard' && (
              <DashboardPanel
                results={calculations.results}
                pieces={project.pieces}
                totalContainers={calculations.totalContainers}
                totalPieces={calculations.totalPieces}
                totalM2={calculations.totalM2}
                avgCoverageDays={calculations.avgCoverageDays}
                loadedPieces={calculations.loadedPieces}
              />
            )}
            {activeTab === 'scenarios' && (
              <ScenariosPanel
                results={calculations.results}
                pieces={project.pieces}
                containerTypes={project.containerTypes}
                sensitivityMatrix={calculations.sensitivityMatrix}
                safetyPcts={calculations.safetyPcts}
                leadTimeDeltas={calculations.leadTimeDeltas}
                spaceResult={calculations.spaceResult}
                utilizationRate={project.activeProject.utilizationRate}
                onUpdateProject={project.isGlobalView ? async () => {} : project.updateProject}
              />
            )}
            {activeTab === 'config' && !project.isGlobalView && (
              <ContainerTypeManager
                containerTypes={project.containerTypes}
                onAdd={project.addContainerType}
                onUpdate={project.updateContainerType}
                onDelete={project.deleteContainerType}
                project={project.activeProject}
                onUpdateProject={project.updateProject}
              />
            )}
            {activeTab === 'config' && project.isGlobalView && (
              <div className="text-center py-12 text-slate-400">
                <Globe size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-base font-medium">Vista Global - configuracion no disponible</p>
                <p className="text-sm mt-1">Selecciona un proyecto individual para configurar</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MediosApp;

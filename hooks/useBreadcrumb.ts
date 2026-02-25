/**
 * useBreadcrumb - Hook para construir items del breadcrumb
 * 
 * Genera automáticamente la ruta de navegación basándose en:
 * - Estado del proyecto (abierto/cerrado)
 * - Metadata del proyecto (cliente, proyecto, nombre)
 * - Tab activo
 * 
 * @module useBreadcrumb
 * @version 4.2.2
 */
import { useMemo } from 'react';
import { BreadcrumbItem } from '../components/navigation/Breadcrumb';

// Map de tabs a labels legibles
const TAB_LABELS: Record<string, string> = {
    dashboard: 'Inicio',
    plant: 'Planta',
    mix: 'Mix',
    panel: 'Panel',
    tasks: 'Tareas',
    oee: 'OEE',
    graph: 'Mapa',
    balance: 'Balanceo',
    sim: 'Simulación',
    vsm: 'VSM',
    reports: 'Reportes',
    help: 'Ayuda',
    explorer: 'Explorador'
};

interface ProjectMeta {
    name?: string;
    client?: string;
    project?: string;
}

interface UseBreadcrumbParams {
    hasOpenProject: boolean;
    meta: ProjectMeta;
    activeTab: string;
    onNavigate: (tab: string) => void;
}

export function useBreadcrumb({
    hasOpenProject,
    meta,
    activeTab,
    onNavigate
}: UseBreadcrumbParams): BreadcrumbItem[] {
    return useMemo(() => {
        const items: BreadcrumbItem[] = [];

        // 1. Inicio (siempre)
        items.push({
            label: 'Inicio',
            onClick: activeTab !== 'dashboard' ? () => onNavigate('dashboard') : undefined,
            isActive: activeTab === 'dashboard'
        });

        // Si estamos en dashboard sin proyecto, solo mostramos Inicio
        if (activeTab === 'dashboard' && !hasOpenProject) {
            return items;
        }

        // 2. Si hay proyecto abierto, agregar jerarquía
        if (hasOpenProject) {
            // Cliente
            if (meta.client) {
                items.push({
                    label: meta.client,
                    onClick: () => onNavigate('dashboard')
                });
            }

            // Proyecto (si es diferente del cliente)
            if (meta.project && meta.project !== meta.client) {
                items.push({
                    label: meta.project,
                    onClick: () => onNavigate('dashboard')
                });
            }

            // Pieza/Nombre del estudio
            if (meta.name) {
                items.push({
                    label: meta.name,
                    onClick: activeTab !== 'panel' ? () => onNavigate('panel') : undefined
                });
            }
        }

        // 3. Tab actual (si no es dashboard y no es el mismo que el nombre del proyecto)
        if (activeTab !== 'dashboard' && activeTab !== 'panel') {
            const tabLabel = TAB_LABELS[activeTab] || activeTab;
            items.push({
                label: tabLabel,
                isActive: true
            });
        } else if (activeTab === 'panel' && hasOpenProject) {
            // Si estamos en panel, marcar el nombre del proyecto como activo
            if (items.length > 0) {
                items[items.length - 1].isActive = true;
            }
        }

        return items;
    }, [hasOpenProject, meta.client, meta.project, meta.name, activeTab, onNavigate]);
}

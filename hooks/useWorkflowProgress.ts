/**
 * useWorkflowProgress Hook
 * 
 * Calculates the current workflow progress based on project data state.
 * Provides step status (pending, in-progress, completed) for the workflow indicator.
 * 
 * @module useWorkflowProgress
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { ProjectData } from '../types';
import { Tab } from './useAppNavigation';

export type WorkflowStepStatus = 'pending' | 'in-progress' | 'completed';

export interface WorkflowStep {
    id: string;
    label: string;
    shortLabel: string;
    status: WorkflowStepStatus;
    navTarget: Tab;
    description: string;
}

export interface WorkflowProgressResult {
    steps: WorkflowStep[];
    currentStepIndex: number;
    overallProgress: number; // 0-100
    isComplete: boolean;
}

/**
 * Hook to calculate workflow progress based on project data
 * 
 * @param data - Current project data
 * @param activeTab - Currently active navigation tab
 * @returns WorkflowProgressResult with step statuses and progress
 */
export function useWorkflowProgress(
    data: ProjectData,
    activeTab: Tab
): WorkflowProgressResult {

    const steps = useMemo<WorkflowStep[]>(() => {
        // === Step 1: Configuration ===
        const hasBasicConfig = Boolean(
            data.meta?.name &&
            data.meta?.dailyDemand > 0 &&
            data.shifts?.length > 0
        );

        // === Step 2: Tasks ===
        // Completado si el usuario tiene AL MENOS 1 tarea definida
        // El sistema NO puede saber cuántas tareas planea cargar el usuario
        const hasEnoughTasks = data.tasks?.length > 0;

        // === Step 3: Balancing ===
        // Completado si hay AL MENOS 1 asignación
        // El objetivo del balanceo puede ser parcial (el usuario decide)
        const hasGoodCoverage = data.assignments?.length > 0;

        // === Step 4: Analysis (VSM or Simulation accessed) ===
        // We check if sectors exist (created during balancing analysis) or if stationConfigs exist
        const hasAnalysis = Boolean(
            (data.sectors?.length > 0) ||
            (data.stationConfigs && data.stationConfigs.length > 0)
        );

        // === Step 5: Reports ===
        // Reports are considered "done" if the user has accessed the reports tab at least once
        // Since we can't track this, we consider it complete if all previous steps are done
        const hasReports = hasBasicConfig && hasEnoughTasks && hasGoodCoverage && hasAnalysis;

        // Determine statuses based on current state and active tab
        const getStatus = (
            isComplete: boolean,
            isRelevantTab: boolean,
            previousComplete: boolean
        ): WorkflowStepStatus => {
            if (isComplete) return 'completed';
            if (isRelevantTab && previousComplete) return 'in-progress';
            return 'pending';
        };

        // Tab mappings
        const configTabs: Tab[] = ['panel'];
        const taskTabs: Tab[] = ['tasks'];
        const balanceTabs: Tab[] = ['balance'];
        const analysisTabs: Tab[] = ['vsm', 'oee'];
        const reportsTabs: Tab[] = ['summary'];

        return [
            {
                id: 'config',
                label: 'Configuración',
                shortLabel: 'Config',
                status: getStatus(hasBasicConfig, configTabs.includes(activeTab), true),
                navTarget: 'panel',
                description: 'Meta, turnos y demanda configurados'
            },
            {
                id: 'tasks',
                label: 'Tareas',
                shortLabel: 'Tareas',
                status: getStatus(hasEnoughTasks, taskTabs.includes(activeTab), hasBasicConfig),
                navTarget: 'tasks',
                description: 'Tareas creadas o importadas'
            },
            {
                id: 'balance',
                label: 'Balanceo',
                shortLabel: 'Balance',
                status: getStatus(hasGoodCoverage, balanceTabs.includes(activeTab), hasEnoughTasks),
                navTarget: 'balance',
                description: 'Tareas asignadas a estaciones'
            },
            {
                id: 'analysis',
                label: 'Análisis',
                shortLabel: 'Análisis',
                status: getStatus(hasAnalysis, analysisTabs.includes(activeTab), hasGoodCoverage),
                navTarget: 'vsm',
                description: 'VSM, simulación o indicadores revisados'
            },
            {
                id: 'reports',
                label: 'Reportes',
                shortLabel: 'Reportes',
                status: getStatus(hasReports, reportsTabs.includes(activeTab), hasAnalysis),
                navTarget: 'summary',
                description: 'Reportes generados'
            }
        ];
    }, [data, activeTab]);

    // Find current step (first non-completed step)
    const currentStepIndex = useMemo(() => {
        const idx = steps.findIndex(s => s.status !== 'completed');
        return idx === -1 ? steps.length - 1 : idx;
    }, [steps]);

    // Calculate overall progress
    const overallProgress = useMemo(() => {
        const completedCount = steps.filter(s => s.status === 'completed').length;
        return Math.round((completedCount / steps.length) * 100);
    }, [steps]);

    // Check if all steps are complete
    const isComplete = useMemo(() => {
        return steps.every(s => s.status === 'completed');
    }, [steps]);

    return {
        steps,
        currentStepIndex,
        overallProgress,
        isComplete
    };
}

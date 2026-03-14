import { describe, it, expect } from 'vitest';
import { buildCapacityPreviewHtml, buildCapacityStationInfos, CapacityStationInfo } from '../modules/balancing/balancingCapacityPreviewHtml';
import { EXAMPLE_PROJECT, ProjectData } from '../types';

// Build a project with actual assignments to stations
function makeProject(overrides?: Partial<ProjectData>): ProjectData {
    const base: ProjectData = {
        ...EXAMPLE_PROJECT,
        meta: {
            ...EXAMPLE_PROJECT.meta,
            dailyDemand: 1000,
            manualOEE: 0.85,
            activeShifts: 2,
            configuredStations: 3,
            piecesPerVehicle: 2,
        },
        shifts: [
            { id: 1, name: 'T1', startTime: '06:00', endTime: '14:00', breaks: [{ id: 'b1', name: 'Almuerzo', startTime: '10:00', duration: 30 }], plannedMinutes: 450 },
            { id: 2, name: 'T2', startTime: '14:00', endTime: '22:00', breaks: [{ id: 'b2', name: 'Merienda', startTime: '18:00', duration: 30 }], plannedMinutes: 450 },
        ],
        sectors: [
            { id: 's1', name: 'Ensamble', color: '#3b82f6' },
        ],
        tasks: [
            { id: 'T1', description: 'Montar pieza A', times: [30], averageTime: 30, ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 30, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' as const, sectorId: 's1' },
            { id: 'T2', description: 'Soldar', times: [45], averageTime: 45, ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 45, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' as const, sectorId: 's1' },
            { id: 'T3', description: 'Inspección', times: [20], averageTime: 20, ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 20, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' as const, sectorId: 's1' },
        ],
        assignments: [
            { taskId: 'T1', stationId: 1 },
            { taskId: 'T2', stationId: 2 },
            { taskId: 'T3', stationId: 3 },
        ],
        stationConfigs: [
            { id: 1, oeeTarget: 0.85, replicas: 1 },
            { id: 2, oeeTarget: 0.85, replicas: 1 },
            { id: 3, oeeTarget: 0.85, replicas: 1 },
        ],
    };
    return { ...base, ...overrides };
}

describe('buildCapacityStationInfos', () => {
    it('should build station infos for assigned stations', () => {
        const data = makeProject();
        const infos = buildCapacityStationInfos(data);

        expect(infos).toHaveLength(3);
        expect(infos[0].id).toBe(1);
        expect(infos[0].sectorName).toBe('Ensamble');
        expect(infos[0].cycleTimeSeconds).toBe(30);
        expect(infos[1].cycleTimeSeconds).toBe(45);
        expect(infos[2].cycleTimeSeconds).toBe(20);
    });

    it('should skip empty stations', () => {
        const data = makeProject({
            assignments: [{ taskId: 'T1', stationId: 1 }],
        });
        const infos = buildCapacityStationInfos(data);
        expect(infos).toHaveLength(1);
        expect(infos[0].id).toBe(1);
    });

    it('should calculate capPerHour correctly', () => {
        const data = makeProject();
        const infos = buildCapacityStationInfos(data);
        // Station 1: cycle = 30s → cap/hour = 3600/30 = 120
        expect(infos[0].capPerHour).toBe(120);
        // Station 2: cycle = 45s → cap/hour = 80
        expect(infos[1].capPerHour).toBe(80);
    });

    it('should calculate capacityPct correctly', () => {
        const data = makeProject();
        const infos = buildCapacityStationInfos(data);
        // Production daily = totalAvailableSeconds / cycleTime
        // Must be > 0 and relate to dailyDemand = 1000
        expect(infos[0].capacityPct).toBeGreaterThan(0);
        expect(infos[0].requiredDaily).toBe(1000);
    });

    it('should detect injection tasks', () => {
        const data = makeProject({
            tasks: [
                ...makeProject().tasks,
                {
                    id: 'INJ1', description: 'Inyección PU', times: [60], averageTime: 60,
                    ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 60,
                    predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0,
                    executionMode: 'injection' as const, sectorId: 's1',
                    injectionParams: { productionVolume: 1000, pInyectionTime: 15, pCuringTime: 45, investmentRatio: 1, optimalCavities: 1 },
                },
            ],
            assignments: [
                ...makeProject().assignments,
                { taskId: 'INJ1', stationId: 4 },
            ],
            stationConfigs: [
                ...makeProject().stationConfigs,
                { id: 4, oeeTarget: 0.85, replicas: 1 },
            ],
        });
        const infos = buildCapacityStationInfos(data);
        const injStation = infos.find(s => s.id === 4);
        expect(injStation).toBeDefined();
        expect(injStation!.isInjection).toBe(true);
        expect(injStation!.injectionNote).toContain('Inyección PU');
    });

    it('should handle piecesPerVehicle default (1)', () => {
        const data = makeProject();
        data.meta.piecesPerVehicle = undefined;
        const infos = buildCapacityStationInfos(data);
        // Should still work (ppv defaults to 1)
        expect(infos.length).toBeGreaterThan(0);
    });

    it('should calculate dotacion correctly', () => {
        const data = makeProject();
        const infos = buildCapacityStationInfos(data);
        // dotacion = (cycleTime_min × dailyDemand) / shiftNetMinutes
        // All values > 0
        infos.forEach(st => {
            expect(st.dotacion).toBeGreaterThan(0);
            expect(st.operadores).toBeGreaterThanOrEqual(1);
        });
    });

    it('should handle replicas dividing cycle time', () => {
        const data = makeProject({
            stationConfigs: [
                { id: 1, oeeTarget: 0.85, replicas: 2 },
                { id: 2, oeeTarget: 0.85, replicas: 1 },
                { id: 3, oeeTarget: 0.85, replicas: 1 },
            ],
        });
        const infos = buildCapacityStationInfos(data);
        // Station 1: effectiveTime=30, replicas=2 → cycleTime=15
        expect(infos[0].cycleTimeSeconds).toBe(15);
    });
});

describe('buildCapacityPreviewHtml', () => {
    it('should generate HTML with all major sections', () => {
        const data = makeProject();
        const html = buildCapacityPreviewHtml(data);

        expect(html).toContain('Capacidad de Producción por Proceso');
        expect(html).toContain('Montar pieza A');
        expect(html).toContain('Soldar');
        expect(html).toContain('Inspección');
        expect(html).toContain('RESUMEN');
        expect(html).toContain('Ensamble');
    });

    it('should include production params', () => {
        const data = makeProject();
        const html = buildCapacityPreviewHtml(data);

        expect(html).toContain('Volumen vehículos diario');
        expect(html).toContain('Piezas necesarias por vehículo');
        expect(html).toContain('Demanda semanal');
        expect(html).toContain('Cantidad de turnos');
    });

    it('should calculate vehicle demand from piecesPerVehicle', () => {
        const data = makeProject();
        // dailyDemand=1000, ppv=2 → vehicleDemand=500
        const html = buildCapacityPreviewHtml(data);
        expect(html).toContain('500');
    });

    it('should calculate weekly demand as daily × 5', () => {
        const data = makeProject();
        // dailyDemand=1000 → weekly=5000
        const html = buildCapacityPreviewHtml(data);
        expect(html).toContain('5.000'); // es-AR format
    });

    it('should include chart legend', () => {
        const data = makeProject();
        const html = buildCapacityPreviewHtml(data);
        expect(html).toContain('Pzs Requeridas/Día');
        expect(html).toContain('Producción Diaria');
    });

    it('should handle empty project gracefully', () => {
        const data = makeProject({
            assignments: [],
            tasks: [],
        });
        const html = buildCapacityPreviewHtml(data);
        expect(html).toContain('Capacidad de Producción por Proceso');
        expect(html).toContain('RESUMEN');
    });

    it('should include logo when provided', () => {
        const data = makeProject();
        const html = buildCapacityPreviewHtml(data, 'data:image/png;base64,TESTLOGO');
        expect(html).toContain('TESTLOGO');
    });

    it('should show status badges (OK/DEFICIT)', () => {
        const data = makeProject();
        const html = buildCapacityPreviewHtml(data);
        // At least one station should have OK or DEFICIT
        expect(html.includes('OK') || html.includes('DEFICIT')).toBe(true);
    });

    it('should show injection note row for injection stations', () => {
        const data = makeProject({
            tasks: [
                {
                    id: 'INJ1', description: 'Inyección PU', times: [60], averageTime: 60,
                    ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 60,
                    predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0,
                    executionMode: 'injection' as const, sectorId: 's1',
                    injectionParams: { productionVolume: 1000, pInyectionTime: 15, pCuringTime: 45, investmentRatio: 1, optimalCavities: 1 },
                },
            ],
            assignments: [{ taskId: 'INJ1', stationId: 1 }],
        });
        const html = buildCapacityPreviewHtml(data);
        expect(html).toContain('Inyección PU');
        expect(html).toContain('t_iny=');
        expect(html).toContain('t_cur=');
    });

    // ---- Edge case tests (B1-B4 hardening) ----

    it('B1: should handle manualOEE undefined without crashing', () => {
        const data = makeProject();
        (data.meta as any).manualOEE = undefined;
        const html = buildCapacityPreviewHtml(data);
        // Should use default 85% OEE and not show "undefined" or "NaN"
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('undefined');
        expect(html).toContain('85');
    });

    it('B4: should handle piecesPerVehicle = 0 without division by zero', () => {
        const data = makeProject();
        data.meta.piecesPerVehicle = 0;
        const html = buildCapacityPreviewHtml(data);
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('Infinity');
    });

    it('B4: should handle piecesPerVehicle negative without error', () => {
        const data = makeProject();
        data.meta.piecesPerVehicle = -3;
        const html = buildCapacityPreviewHtml(data);
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('Infinity');
    });

    it('B2: should skip stations with zero standard time', () => {
        const data = makeProject({
            tasks: [
                { id: 'T1', description: 'Zero time', times: [], averageTime: 0, ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 0, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' as const, sectorId: 's1' },
            ],
            assignments: [{ taskId: 'T1', stationId: 1 }],
        });
        const infos = buildCapacityStationInfos(data);
        // Station with 0 effective time should be skipped
        expect(infos).toHaveLength(0);
    });

    it('should render logo cell with white background', () => {
        const data = makeProject();
        const html = buildCapacityPreviewHtml(data, 'data:image/png;base64,LOGO');
        expect(html).toContain('background:#ffffff');
    });

    it('should handle dailyDemand = 0 gracefully', () => {
        const data = makeProject();
        data.meta.dailyDemand = 0;
        const html = buildCapacityPreviewHtml(data);
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('Infinity');
    });
});

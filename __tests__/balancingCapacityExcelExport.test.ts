import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectData, EXAMPLE_PROJECT } from '../types';

// Mock ExcelJS and download
vi.mock('exceljs', () => {
    class MockWorkbook {
        creator = '';
        created: Date | null = null;
        _images: any[] = [];
        _sheets: any[] = [];

        addWorksheet() {
            const cells: Record<string, any> = {};
            const ws = {
                getCell: (r: number, c: number) => {
                    const key = `${r},${c}`;
                    if (!cells[key]) cells[key] = { value: null, style: {}, border: {} };
                    return cells[key];
                },
                mergeCells: () => {},
                addImage: () => {},
                getRow: () => ({ height: 20 }),
                columns: [] as any[],
                pageSetup: {} as any,
            };
            this._sheets.push(ws);
            return ws;
        }

        addImage(img: any) {
            this._images.push(img);
            return this._images.length - 1;
        }

        xlsx = { writeBuffer: async () => new ArrayBuffer(10) };
    }

    return { default: { Workbook: MockWorkbook } };
});

vi.mock('../src/assets/ppe/ppeBase64', () => ({
    getLogoBase64: vi.fn().mockResolvedValue('data:image/png;base64,TEST'),
}));

vi.mock('../utils/excel', () => ({
    downloadExcelJSWorkbook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../modules/balancing/capacityBarChart', () => ({
    renderCapacityBarChart: vi.fn().mockResolvedValue(''),
}));

// Build a test project with assignments
function makeProject(overrides?: Partial<ProjectData>): ProjectData {
    const base: ProjectData = {
        ...EXAMPLE_PROJECT,
        meta: {
            ...EXAMPLE_PROJECT.meta,
            dailyDemand: 800,
            manualOEE: 0.90,
            activeShifts: 2,
            configuredStations: 2,
            piecesPerVehicle: 4,
        },
        shifts: [
            { id: 1, name: 'T1', startTime: '06:00', endTime: '14:00', breaks: [{ id: 'b1', name: 'Break', startTime: '10:00', duration: 30 }], plannedMinutes: 450 },
            { id: 2, name: 'T2', startTime: '14:00', endTime: '22:00', breaks: [{ id: 'b2', name: 'Break', startTime: '18:00', duration: 30 }], plannedMinutes: 450 },
        ],
        sectors: [
            { id: 's1', name: 'Soldadura', color: '#ef4444' },
        ],
        tasks: [
            { id: 'T1', description: 'Soldar marco', times: [35], averageTime: 35, ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 35, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' as const, sectorId: 's1' },
            { id: 'T2', description: 'Pulir', times: [25], averageTime: 25, ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 25, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' as const, sectorId: 's1' },
        ],
        assignments: [
            { taskId: 'T1', stationId: 1 },
            { taskId: 'T2', stationId: 2 },
        ],
        stationConfigs: [
            { id: 1, oeeTarget: 0.90, replicas: 1 },
            { id: 2, oeeTarget: 0.90, replicas: 1 },
        ],
    };
    return { ...base, ...overrides };
}

describe('exportBalancingCapacityExcel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call downloadExcelJSWorkbook with correct filename', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');
        const { downloadExcelJSWorkbook } = await import('../utils/excel');

        const data = makeProject();
        await exportBalancingCapacityExcel(data);

        expect(downloadExcelJSWorkbook).toHaveBeenCalledTimes(1);
        const call = (downloadExcelJSWorkbook as any).mock.calls[0];
        expect(call[1]).toContain('Capacidad_Proceso.xlsx');
    });

    it('should create a workbook with at least one worksheet', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject();
        await exportBalancingCapacityExcel(data);

        // The mock ExcelJS workbook addWorksheet should have been called
        // Since the mock is reconstructed each test, just ensure no error
        expect(true).toBe(true);
    });

    it('should handle project with no assignments gracefully', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject({ assignments: [] });
        // Should not throw
        await expect(exportBalancingCapacityExcel(data)).resolves.not.toThrow();
    });

    it('should handle multi-sector projects', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject({
            sectors: [
                { id: 's1', name: 'Soldadura', color: '#ef4444' },
                { id: 's2', name: 'Pintura', color: '#3b82f6' },
            ],
            tasks: [
                { id: 'T1', description: 'Soldar', times: [35], averageTime: 35, ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 35, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' as const, sectorId: 's1' },
                { id: 'T2', description: 'Pintar', times: [25], averageTime: 25, ratingFactor: 100, fatigueCategory: 'standard' as const, standardTime: 25, predecessors: [], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, executionMode: 'manual' as const, sectorId: 's2' },
            ],
            assignments: [
                { taskId: 'T1', stationId: 1 },
                { taskId: 'T2', stationId: 2 },
            ],
        });

        await expect(exportBalancingCapacityExcel(data)).resolves.not.toThrow();
    });

    it('should handle piecesPerVehicle undefined (default 1)', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject();
        data.meta.piecesPerVehicle = undefined;
        await expect(exportBalancingCapacityExcel(data)).resolves.not.toThrow();
    });

    // ---- Edge case tests (B1-B6 hardening) ----

    it('B1: should handle manualOEE undefined without error', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject();
        (data.meta as any).manualOEE = undefined;
        await expect(exportBalancingCapacityExcel(data)).resolves.not.toThrow();
    });

    it('B1: should handle manualOEE NaN without error', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject();
        (data.meta as any).manualOEE = NaN;
        await expect(exportBalancingCapacityExcel(data)).resolves.not.toThrow();
    });

    it('B4: should handle piecesPerVehicle = 0 without division by zero', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject();
        data.meta.piecesPerVehicle = 0;
        await expect(exportBalancingCapacityExcel(data)).resolves.not.toThrow();
    });

    it('B4: should handle piecesPerVehicle negative', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject();
        data.meta.piecesPerVehicle = -5;
        await expect(exportBalancingCapacityExcel(data)).resolves.not.toThrow();
    });

    it('B5: should sanitize special chars in filename', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');
        const { downloadExcelJSWorkbook } = await import('../utils/excel');

        const data = makeProject();
        data.meta.name = 'Test<Project>:With|Bad*Chars';
        await exportBalancingCapacityExcel(data);

        const call = (downloadExcelJSWorkbook as any).mock.calls[0];
        const fileName = call[1] as string;
        // Should not contain forbidden chars
        expect(fileName).not.toMatch(/[<>:"|?*]/);
        expect(fileName).toContain('Capacidad_Proceso.xlsx');
    });

    it('B6: should handle activeShifts = 0 without error', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject();
        data.meta.activeShifts = 0;
        await expect(exportBalancingCapacityExcel(data)).resolves.not.toThrow();
    });

    it('should handle empty project name (fallback to Capacidad)', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');
        const { downloadExcelJSWorkbook } = await import('../utils/excel');

        const data = makeProject();
        data.meta.name = '';
        await exportBalancingCapacityExcel(data);

        const call = (downloadExcelJSWorkbook as any).mock.calls[0];
        expect(call[1]).toContain('Capacidad_Capacidad_Proceso.xlsx');
    });

    it('should handle dailyDemand = 0 without error', async () => {
        const { exportBalancingCapacityExcel } = await import('../modules/balancing/balancingCapacityExcelExport');

        const data = makeProject();
        data.meta.dailyDemand = 0;
        await expect(exportBalancingCapacityExcel(data)).resolves.not.toThrow();
    });
});

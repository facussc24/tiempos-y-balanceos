/**
 * Security tests — executiveSummaryCalc XSS prevention
 *
 * Verifies that exportSummaryToPDF escapes all user-supplied
 * values (project name, sector names, machine names) in the
 * generated HTML report.
 *
 * Note: exportSummaryToPDF calls window.open() which is unavailable
 * in jsdom without mocking. We mock window.open and capture the HTML
 * passed to printWindow.document.write to inspect the output.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../core/balancing/simulation', () => ({
    calculateTaktTime: vi.fn().mockReturnValue(60),
    calculateShiftNetMinutes: vi.fn().mockReturnValue(480),
}));

vi.mock('xlsx-js-style', () => ({
    default: {
        utils: { book_new: vi.fn(() => ({})), aoa_to_sheet: vi.fn(() => ({})), book_append_sheet: vi.fn() },
        write: vi.fn(() => new Uint8Array()),
    },
}));

import { exportSummaryToPDF, ExecutiveSummaryResult } from '../../utils/executiveSummaryCalc';

// Minimal ExecutiveSummaryResult factory
function makeResult(overrides: Partial<{
    projectName: string;
    sectorName: string;
    machineName: string;
}>): ExecutiveSummaryResult {
    return {
        projectName: overrides.projectName ?? 'Safe Project',
        warnings: [],
        calculatedAt: new Date().toISOString(),
        scenarios: [
            {
                shiftCount: 1,
                taktTime: 60,
                effectiveTaktTime: 55,
                piecesPerHour: 60,
                theoreticalCapacity: 480,
                availableMinutes: 480,
                dailyDemand: 1000,
                totalOperatorsRequired: 3,
                totalOperatorsBalanced: 3,
                totalMachinesRequired: 2,
                totalMachinesAvailable: 2,
                totalDeficits: 0,
                totalWorkContent: 180,
                bottleneckCycleTime: 0,
                hasBottleneck: false,
                hasBalancingData: true,
                sectors: [
                    {
                        sectorId: 's1',
                        sectorName: overrides.sectorName ?? 'Safe Sector',
                        sectorColor: '#3b82f6',
                        totalStandardTime: 60,
                        taskCount: 3,
                        operatorsRequired: 1,
                        operatorsBalanced: 1,
                        operatorsTotal: 1,
                        hasBalancingData: true,
                        balancingEfficiency: 100,
                        saturation: 80,
                        totalMachinesRequired: 1,
                        totalMachinesAvailable: 2,
                        hasDeficit: false,
                        machines: overrides.machineName
                            ? [
                                {
                                    machineId: 'm1',
                                    machineName: overrides.machineName,
                                    unitsRequired: 1,
                                    unitsAvailable: 2,
                                    gap: -1,
                                    saturationPerUnit: 50,
                                    taskIds: ['t1'],
                                },
                            ]
                            : [],
                    },
                ],
            },
        ],
    };
}

describe('executiveSummaryCalc — XSS escaping in PDF HTML (Fix 2)', () => {
    let capturedHtml = '';

    beforeEach(() => {
        capturedHtml = '';

        const mockPrintWindow = {
            document: {
                write: (html: string) => { capturedHtml = html; },
                close: vi.fn(),
            },
            focus: vi.fn(),
            print: vi.fn(),
            onload: null as (() => void) | null,
        };

        vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as unknown as Window);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('project name', () => {
        it('escapes < and > in project name in <title>', () => {
            exportSummaryToPDF(makeResult({ projectName: '<script>alert(1)</script>' }));
            expect(capturedHtml).not.toContain('<script>alert(1)</script>');
            expect(capturedHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        });

        it('escapes < and > in project name in subtitle', () => {
            exportSummaryToPDF(makeResult({ projectName: '<b>Inject</b>' }));
            expect(capturedHtml).not.toContain('<b>Inject</b>');
            expect(capturedHtml).toContain('&lt;b&gt;Inject&lt;/b&gt;');
        });

        it('escapes & in project name', () => {
            exportSummaryToPDF(makeResult({ projectName: 'Project A & B' }));
            expect(capturedHtml).toContain('Project A &amp; B');
        });

        it('escapes double-quotes in project name', () => {
            exportSummaryToPDF(makeResult({ projectName: 'Proj " onerror="x' }));
            expect(capturedHtml).toContain('&quot;');
            expect(capturedHtml).not.toContain('" onerror="x');
        });
    });

    describe('sector names', () => {
        it('escapes < and > in sector name in table row', () => {
            exportSummaryToPDF(makeResult({ sectorName: '<img src=x onerror=pwn()>' }));
            expect(capturedHtml).not.toContain('<img src=x');
            expect(capturedHtml).toContain('&lt;img src=x onerror=pwn()&gt;');
        });

        it('escapes & in sector name', () => {
            exportSummaryToPDF(makeResult({ sectorName: 'Line A & B' }));
            expect(capturedHtml).toContain('Line A &amp; B');
        });
    });

    describe('machine names', () => {
        it('escapes < and > in machine name', () => {
            exportSummaryToPDF(makeResult({ machineName: '<script>exfil()</script>' }));
            expect(capturedHtml).not.toContain('<script>exfil()</script>');
            expect(capturedHtml).toContain('&lt;script&gt;exfil()&lt;/script&gt;');
        });

        it('escapes & in machine name', () => {
            exportSummaryToPDF(makeResult({ machineName: 'Press A & B' }));
            expect(capturedHtml).toContain('Press A &amp; B');
        });
    });

    describe('safe values render correctly', () => {
        it('renders normal project name without modification', () => {
            exportSummaryToPDF(makeResult({ projectName: 'Proyecto Alfa 2026' }));
            expect(capturedHtml).toContain('Proyecto Alfa 2026');
        });

        it('renders normal sector name without modification', () => {
            exportSummaryToPDF(makeResult({ sectorName: 'Ensamble Final' }));
            expect(capturedHtml).toContain('Ensamble Final');
        });

        it('renders normal machine name without modification', () => {
            exportSummaryToPDF(makeResult({ machineName: 'Prensa 200T' }));
            expect(capturedHtml).toContain('Prensa 200T');
        });
    });
});

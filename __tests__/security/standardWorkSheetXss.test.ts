/**
 * Security tests — StandardWorkSheet XSS prevention
 *
 * Verifies that generateStandardWorkSheetHTML escapes all user-supplied
 * values so that no raw HTML/JS can be injected into the generated report.
 */
import { describe, it, expect } from 'vitest';
import { generateStandardWorkSheetHTML } from '../../components/reports/StandardWorkSheet';
import { Task } from '../../types';

// Minimal ProjectData['meta'] shape
const baseMeta = {
    name: 'Safe Project',
    client: 'Safe Client',
    date: '2026-01-01',
    version: '1.0',
    engineer: 'Engineer',
    activeShifts: 1,
    manualOEE: 0.85,
    useManualOEE: true,
    dailyDemand: 100,
    configuredStations: 2,
} as any;

const baseStation = {
    stationId: 1,
    stationName: 'Safe Station',
    sectorName: 'Safe Sector',
    sectorColor: '#3b82f6',
    tasks: [] as Task[],
    totalTime: 30,
    replicas: 1,
    oeeTarget: 0.85,
    machineNames: [],
};

describe('StandardWorkSheet — XSS escaping (Fix 1)', () => {
    describe('project metadata fields', () => {
        it('escapes < and > in project name', () => {
            const html = generateStandardWorkSheetHTML(
                baseStation,
                { ...baseMeta, name: '<script>alert(1)</script>' },
                60
            );
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        it('escapes < and > in client name', () => {
            const html = generateStandardWorkSheetHTML(
                baseStation,
                { ...baseMeta, client: '<img src=x onerror=alert(1)>' },
                60
            );
            expect(html).not.toContain('<img');
            expect(html).toContain('&lt;img');
        });

        it('escapes quotes in project date', () => {
            const html = generateStandardWorkSheetHTML(
                baseStation,
                { ...baseMeta, date: '" onload="alert(1)' },
                60
            );
            expect(html).toContain('&quot;');
            expect(html).not.toContain('" onload=');
        });

        it('escapes & in project name', () => {
            const html = generateStandardWorkSheetHTML(
                baseStation,
                { ...baseMeta, name: 'A & B Corp' },
                60
            );
            expect(html).toContain('A &amp; B Corp');
        });
    });

    describe('station and sector names', () => {
        it('escapes < and > in station name (badge and title)', () => {
            const html = generateStandardWorkSheetHTML(
                { ...baseStation, stationName: '<b>Hack</b>' },
                baseMeta,
                60
            );
            expect(html).not.toContain('<b>Hack</b>');
            expect(html).toContain('&lt;b&gt;Hack&lt;/b&gt;');
        });

        it('escapes < and > in sector name', () => {
            const html = generateStandardWorkSheetHTML(
                { ...baseStation, sectorName: '<em>Sector</em>' },
                baseMeta,
                60
            );
            expect(html).not.toContain('<em>');
            expect(html).toContain('&lt;em&gt;');
        });
    });

    describe('task descriptions', () => {
        it('escapes < and > in task description', () => {
            const task = {
                id: 't1',
                description: '<script>steal()</script>',
                standardTime: 10,
                averageTime: 10,
                predecessors: [],
                positionalWeight: 1,
                executionMode: 'manual',
                sectorId: 's1',
            } as unknown as Task;

            const html = generateStandardWorkSheetHTML(
                { ...baseStation, tasks: [task] },
                baseMeta,
                60
            );
            expect(html).not.toContain('<script>steal()</script>');
            expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
        });

        it('escapes & in task description', () => {
            const task = {
                id: 't1',
                description: 'Tighten bolt A & bolt B',
                standardTime: 10,
                averageTime: 10,
                predecessors: [],
                positionalWeight: 1,
                executionMode: 'manual',
                sectorId: 's1',
            } as unknown as Task;

            const html = generateStandardWorkSheetHTML(
                { ...baseStation, tasks: [task] },
                baseMeta,
                60
            );
            expect(html).toContain('Tighten bolt A &amp; bolt B');
        });

        it('escapes task id when used as fallback for description', () => {
            const task = {
                id: '<injected-id>',
                description: '',
                standardTime: 10,
                averageTime: 10,
                predecessors: [],
                positionalWeight: 1,
                executionMode: 'manual',
                sectorId: 's1',
            } as unknown as Task;

            const html = generateStandardWorkSheetHTML(
                { ...baseStation, tasks: [task] },
                baseMeta,
                60
            );
            expect(html).not.toContain('<injected-id>');
            expect(html).toContain('&lt;injected-id&gt;');
        });
    });

    describe('machine names', () => {
        it('escapes < and > in machine names', () => {
            const html = generateStandardWorkSheetHTML(
                { ...baseStation, machineNames: ['<script>pwn()</script>', 'Normal Machine'] },
                baseMeta,
                60
            );
            expect(html).not.toContain('<script>pwn()</script>');
            expect(html).toContain('&lt;script&gt;pwn()&lt;/script&gt;');
            expect(html).toContain('Normal Machine');
        });

        it('escapes & in machine names', () => {
            const html = generateStandardWorkSheetHTML(
                { ...baseStation, machineNames: ['Press A & B'] },
                baseMeta,
                60
            );
            expect(html).toContain('Press A &amp; B');
        });
    });

    describe('safe values pass through correctly', () => {
        it('renders normal text without modification', () => {
            const html = generateStandardWorkSheetHTML(
                {
                    ...baseStation,
                    stationName: 'Estacion 1',
                    sectorName: 'Ensamble',
                    machineNames: ['Prensa 12T'],
                },
                { ...baseMeta, name: 'Proyecto Alfa', client: 'Cliente SA' },
                60
            );
            expect(html).toContain('Estacion 1');
            expect(html).toContain('Ensamble');
            expect(html).toContain('Prensa 12T');
            expect(html).toContain('Proyecto Alfa');
            expect(html).toContain('Cliente SA');
        });
    });
});

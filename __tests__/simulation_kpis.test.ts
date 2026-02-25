/**
 * KPI Types - Unit Tests
 *
 * Validates the KPI type definitions and helper functions
 */

import { describe, it, expect } from 'vitest';
import {
    createEmptyKPIs,
    SimulationKPIs,
} from '../modules/flow-simulator/flowTypes';

describe('SimulationKPIs', () => {
    describe('createEmptyKPIs', () => {
        it('should create KPIs with correct station count', () => {
            const kpis = createEmptyKPIs(5);

            expect(Object.keys(kpis.stationUtilization)).toHaveLength(5);
            expect(Object.keys(kpis.stationActiveTime)).toHaveLength(5);
            expect(Object.keys(kpis.stationIdleTime)).toHaveLength(5);
            expect(Object.keys(kpis.stationBlockedTime)).toHaveLength(5);
        });

        it('should initialize all values to zero', () => {
            const kpis = createEmptyKPIs(3);

            for (let i = 0; i < 3; i++) {
                expect(kpis.stationUtilization[i]).toBe(0);
                expect(kpis.stationActiveTime[i]).toBe(0);
                expect(kpis.stationIdleTime[i]).toBe(0);
                expect(kpis.stationBlockedTime[i]).toBe(0);
            }
        });

        it('should initialize WIP between stations array', () => {
            const kpis = createEmptyKPIs(4);

            expect(kpis.wipBetweenStations).toHaveLength(3); // n-1 connectors
            expect(kpis.peakWIP).toBe(0);
            expect(kpis.avgWIP).toBe(0);
        });

        it('should initialize bottleneck fields', () => {
            const kpis = createEmptyKPIs(2);

            expect(kpis.bottleneckStationId).toBe(-1);
            expect(kpis.bottleneckCycleTime).toBe(0);
            expect(kpis.bottleneckUtilization).toBe(0);
        });

        it('should initialize lead time metrics', () => {
            const kpis = createEmptyKPIs(3);

            expect(kpis.totalLeadTime).toBe(0);
            expect(kpis.avgLeadTime).toBe(0);
            expect(kpis.minLeadTime).toBe(Infinity);
            expect(kpis.maxLeadTime).toBe(0);
        });
    });
});

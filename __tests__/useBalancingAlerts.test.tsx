/**
 * Unit tests para useBalancingAlerts: custom hook extraido en Fase 2 #7.
 * Cubre las 4 reglas de alerta (overload, machine deficit, machine conflict,
 * OEE zone) + orden y stability.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBalancingAlerts, type AlertStationLike } from '../hooks/useBalancingAlerts';
import type { MachineValidationResult } from '../core/balancing/machineValidation';
import type { Task } from '../types';

const emptyValidation: MachineValidationResult = {
    stationRequirements: [],
    machineBalance: [],
    hasDeficit: false,
    hasConflicts: false,
    totalDeficit: 0,
};

const baseArgs = {
    stationData: [] as AlertStationLike[],
    machineValidation: emptyValidation,
    nominalSeconds: 60,
    effectiveSeconds: 50,
    tasks: [] as Task[],
    capacityLimitMode: 'oee' as const,
    manualOEE: 0.85,
};

describe('useBalancingAlerts', () => {
    it('devuelve array vacio sin alertas triggereadas', () => {
        const { result } = renderHook(() => useBalancingAlerts(baseArgs));
        expect(result.current).toEqual([]);
    });

    it('1. Alert de overload (critical) cuando time > limit', () => {
        const { result } = renderHook(() =>
            useBalancingAlerts({
                ...baseArgs,
                stationData: [{ id: 1, time: 70, limit: 60, replicas: 1, tasks: [] }],
            }),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toMatchObject({
            id: 'overload',
            severity: 'critical',
        });
    });

    it('NO emite overload cuando time == limit (limite inclusivo)', () => {
        const { result } = renderHook(() =>
            useBalancingAlerts({
                ...baseArgs,
                stationData: [{ id: 1, time: 60, limit: 60, replicas: 1, tasks: [] }],
            }),
        );
        expect(result.current).toHaveLength(0);
    });

    it('2. Alert de machine deficit (warning)', () => {
        const { result } = renderHook(() =>
            useBalancingAlerts({
                ...baseArgs,
                machineValidation: {
                    ...emptyValidation,
                    hasDeficit: true,
                    machineBalance: [
                        {
                            machineId: 'm1',
                            machineName: 'Inyectora',
                            available: 2,
                            consumed: 3,
                            balance: -1,
                            isDeficit: true,
                        },
                    ],
                    totalDeficit: 1,
                } as MachineValidationResult,
            }),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toMatchObject({
            id: 'machine-deficit',
            severity: 'warning',
        });
    });

    it('3. Alert de machine conflict (warning)', () => {
        const { result } = renderHook(() =>
            useBalancingAlerts({
                ...baseArgs,
                machineValidation: {
                    ...emptyValidation,
                    hasConflicts: true,
                    stationRequirements: [
                        {
                            stationId: 1,
                            hasConflict: true,
                            conflictMessage: 'Mix incompatible',
                        },
                    ],
                } as MachineValidationResult,
            }),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].id).toBe('machine-conflict');
    });

    it('4. OEE zone warning solo en modo nominal', () => {
        // effectiveSeconds=50, limit=60 — time=55 supera OEE pero no Takt
        const stationData: AlertStationLike[] = [
            { id: 1, time: 55, limit: 60, replicas: 1, tasks: [] },
        ];

        const nominal = renderHook(() =>
            useBalancingAlerts({ ...baseArgs, stationData, capacityLimitMode: 'nominal' }),
        );
        expect(nominal.result.current).toHaveLength(1);
        expect(nominal.result.current[0].id).toBe('oee-zone-warning');

        // En modo 'oee' esa misma estacion no dispara OEE-zone (el limit YA incluye OEE)
        const oee = renderHook(() =>
            useBalancingAlerts({ ...baseArgs, stationData, capacityLimitMode: 'oee' }),
        );
        expect(oee.result.current).toHaveLength(0);
    });

    it('combina multiples alertas en orden: overload primero, luego warnings', () => {
        const { result } = renderHook(() =>
            useBalancingAlerts({
                ...baseArgs,
                stationData: [{ id: 1, time: 100, limit: 60, replicas: 1, tasks: [] }],
                machineValidation: {
                    ...emptyValidation,
                    hasDeficit: true,
                    machineBalance: [
                        {
                            machineId: 'm1',
                            machineName: 'X',
                            available: 0,
                            consumed: 1,
                            balance: -1,
                            isDeficit: true,
                        },
                    ],
                    totalDeficit: 1,
                } as MachineValidationResult,
            }),
        );
        expect(result.current.map(a => a.id)).toEqual(['overload', 'machine-deficit']);
    });

    it('memoiza: mismo input -> misma referencia', () => {
        const args = {
            ...baseArgs,
            stationData: [{ id: 1, time: 70, limit: 60, replicas: 1, tasks: [] }],
        };
        const { result, rerender } = renderHook(
            (props: typeof args) => useBalancingAlerts(props),
            { initialProps: args },
        );
        const first = result.current;
        rerender(args);
        expect(result.current).toBe(first);
    });
});

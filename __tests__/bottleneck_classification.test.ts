import { describe, it, expect } from 'vitest';
import { detectOverloadAndRecommend } from '../core/balancing/simulation';
import { Task } from '../types';

// Helper to create minimal Task objects for testing
const createTask = (id: string, time: number, mode: 'manual' | 'injection' | 'machine' = 'manual'): Task => ({
    id,
    description: `Task ${id}`,
    times: [time],
    averageTime: time,
    standardTime: time,
    ratingFactor: 100,
    fatigueCategory: 'none',
    predecessors: [],
    successors: [],
    positionalWeight: 0,
    calculatedSuccessorSum: 0,
    executionMode: mode
});

describe('Bottleneck Classification (RALBP vs ALWABP)', () => {
    describe('RALBP - Machine-Dominated Bottleneck', () => {
        it('should classify as machine bottleneck when machine time dominates and manual fits in limit', () => {
            // Scenario: Machine 800s >> Manual 20s, Limit 720s
            // Manual (20s) fits in limit (720s), so adding operators won't help
            const station = {
                effectiveTime: 820,
                limit: 720,
                replicas: 1,
                tasks: [
                    createTask('INJ', 800, 'injection'),
                    createTask('T1', 20, 'manual')
                ]
            };

            const result = detectOverloadAndRecommend(station, 720);

            expect(result).not.toBeNull();
            expect(result?.bottleneckType).toBe('machine');
            expect(result?.recommendedReplicas).toBe(1); // Don't increase
            expect(result?.recommendation).toContain('Reducir');
        });

        it('should recommend reducing machine time for pure machine bottleneck', () => {
            // Scenario: Only machine task of 500s, Limit 400s
            const station = {
                effectiveTime: 500,
                limit: 400,
                replicas: 1,
                tasks: [createTask('INJ', 500, 'injection')]
            };

            const result = detectOverloadAndRecommend(station, 400);

            expect(result?.bottleneckType).toBe('machine');
            expect(result?.recommendation).toBe('Reducir demanda o tiempo de máquina');
        });
    });

    describe('ALWABP - Manual-Dominated Bottleneck', () => {
        it('should classify as manual bottleneck when manual work exceeds limit', () => {
            // Scenario: Manual 120s > Limit 60s with Machine 300s
            // Even though machine is larger, manual work needs to be parallelized
            const station = {
                effectiveTime: 420,
                limit: 60,
                replicas: 1,
                tasks: [
                    createTask('INJ', 300, 'injection'),
                    createTask('T1', 60, 'manual'),
                    createTask('T2', 60, 'manual')
                ]
            };

            const result = detectOverloadAndRecommend(station, 60);

            expect(result).not.toBeNull();
            expect(result?.bottleneckType).toBe('manual');
            expect(result?.recommendedReplicas).toBe(2); // Ceil(120/60) = 2
            expect(result?.recommendation).toContain('operarios');
        });

        it('should recommend operators for pure manual overload', () => {
            // Scenario: 3 manual tasks totaling 800s, Limit 720s
            const station = {
                effectiveTime: 800,
                limit: 720,
                replicas: 1,
                tasks: [
                    createTask('T1', 300, 'manual'),
                    createTask('T2', 250, 'manual'),
                    createTask('T3', 250, 'manual')
                ]
            };

            const result = detectOverloadAndRecommend(station, 720);

            expect(result?.bottleneckType).toBe('manual');
            expect(result?.recommendedReplicas).toBe(2); // Ceil(800/720) = 2
            expect(result?.recommendation).toContain('2 op.');
        });
    });

    describe('Edge Cases', () => {
        it('should return null if station is not overloaded', () => {
            const station = {
                effectiveTime: 50,
                limit: 100,
                replicas: 1,
                tasks: [createTask('T1', 50, 'manual')]
            };

            const result = detectOverloadAndRecommend(station, 100);
            expect(result).toBeNull();
        });

        it('should handle empty tasks array', () => {
            const station = {
                effectiveTime: 100,
                limit: 50,
                replicas: 1,
                tasks: [] as Task[]
            };

            const result = detectOverloadAndRecommend(station, 50);

            expect(result).not.toBeNull();
            expect(result?.bottleneckType).toBe('manual');
        });
    });
});

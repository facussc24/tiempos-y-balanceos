import { describe, it, expect } from 'vitest';
import { detectOverloadAndRecommend } from '../core/balancing/simulation';
import { Task } from '../types';

describe('Verification of Operator Recommendation Logic (Phase 25)', () => {
    // Tareas del Escenario 3
    const tasks: Task[] = [
        {
            id: 'T1', description: 'Manual Ext 1', executionMode: 'manual',
            times: [30], averageTime: 30, standardTime: 30, predecessors: [], successors: [],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T2', description: 'Manual Ext 2', executionMode: 'manual',
            times: [35], averageTime: 35, standardTime: 35, predecessors: [], successors: [],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T3', description: 'Manual Ext 3', executionMode: 'manual',
            times: [40], averageTime: 40, standardTime: 40, predecessors: [], successors: [],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T4', description: 'Manual Int (Absorbed)', executionMode: 'manual',
            times: [15], averageTime: 15, standardTime: 15, predecessors: [], successors: [],
            isMachineInternal: true, // Should be ignored
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'INJ', description: 'Injection Deep', executionMode: 'injection',
            times: [300], averageTime: 300, standardTime: 300, predecessors: [], successors: [],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T5', description: 'Manual Ext 4', executionMode: 'manual',
            times: [10], averageTime: 10, standardTime: 10, predecessors: [], successors: [],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        },
        {
            id: 'T6', description: 'Manual Ext 5', executionMode: 'manual',
            times: [5], averageTime: 5, standardTime: 5, predecessors: [], successors: [],
            ratingFactor: 100, fatigueCategory: 'none', positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0
        }
    ];

    // Station Params from Scenario 3
    // Total Eff Time (calculated by simulateBalance) = 300 + 30 + 35 + 40 + 10 + 5 = 420s
    // Limit (Machine TCR) = 60s
    // Replicas = 1 (assigned)
    const station = {
        effectiveTime: 420,
        limit: 60,
        replicas: 1,
        tasks: tasks
    };

    it('should recommend operators based on Manual Work ONLY', () => {
        const nominalSeconds = 60;
        const result = detectOverloadAndRecommend(station, nominalSeconds);

        expect(result).not.toBeNull();
        expect(result?.isOverload).toBe(true);
        expect(result?.limit).toBe(60);

        // Manual Work = 30+35+40+10+5 = 120s
        // Expected Replicas = Ceil(120 / 60) = 2

        // OLD Logic would recommend: 420 / 60 = 7
        expect(result?.recommendedReplicas).toBe(2);

        console.log(`Recommendation: ${result?.recommendedReplicas} operators. Reason: ${result?.reason}`);
    });
});

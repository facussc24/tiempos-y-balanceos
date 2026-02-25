/**
 * Test: validateModelVariability() - RC1 Critical Fix
 * 
 * Validates that the new function correctly detects when
 * individual models exceed Takt Time even if weighted average is OK.
 */

import { describe, test, expect } from 'vitest';
import { validateModelVariability, validateMixComplete } from '../core/balancing/mixBalancing';

describe('RC1 Critical Fix: Model Variability Validation', () => {
    const TAKT_TIME = 61.2; // From UAT scenario
    const TOTAL_DEMAND = 400;

    // Mock tasks with multi-product times
    const mixTasks = [
        {
            id: 'T4',
            description: 'Unir Fundas (Costura Recta)',
            _multiProductTimes: [
                { productId: 'Estándar', time: 40, demand: 200 },
                { productId: 'Lujo', time: 80, demand: 200 }  // THIS EXCEEDS TAKT!
            ],
            standardTime: 60, // Weighted average
            averageTime: 60,
            predecessors: [],
            successors: [],
            times: [],
            ratingFactor: 100,
            fatigueCategory: 'none' as const,
            positionalWeight: 0,
            calculatedSuccessorSum: 0
        }
    ];

    test('Detects Model Lujo (80s) exceeding Takt (61.2s)', () => {
        const result = validateModelVariability(mixTasks, TAKT_TIME, TOTAL_DEMAND);

        // Should NOT be valid because Lujo > Takt
        expect(result.valid).toBe(false);

        // Should have 1 critical alert for Lujo
        const criticalAlerts = result.alerts.filter(a => a.severity === 'critical');
        expect(criticalAlerts.length).toBe(1);
        expect(criticalAlerts[0].modelId).toBe('Lujo');
        expect(criticalAlerts[0].modelTime).toBe(80);
        expect(criticalAlerts[0].excessSeconds).toBeCloseTo(18.8, 1);

        console.log('✅ Critical Alert:', criticalAlerts[0].message);
    });

    test('Generates correct message with excess seconds', () => {
        const result = validateModelVariability(mixTasks, TAKT_TIME, TOTAL_DEMAND);
        const alert = result.alerts[0];

        expect(alert.message).toContain('BLOQUEO');
        expect(alert.message).toContain('Lujo');
        expect(alert.message).toContain('80');
        expect(alert.message).toContain('61.2');
        expect(alert.message).toContain('engañoso');

        console.log('✅ Full message:', alert.message);
    });

    test('Calculates required capacity correctly (1.3 machines)', () => {
        const result = validateModelVariability(mixTasks, TAKT_TIME, TOTAL_DEMAND);
        const alert = result.alerts[0];

        // 80 / 61.2 = 1.307
        expect(alert.requiredCapacity).toBeCloseTo(1.3, 1);
        console.log(`✅ Required capacity: ${alert.requiredCapacity.toFixed(2)} machines`);
    });

    test('Tracks worst case model correctly', () => {
        const result = validateModelVariability(mixTasks, TAKT_TIME, TOTAL_DEMAND);

        expect(result.worstCase).not.toBeNull();
        expect(result.worstCase?.modelId).toBe('Lujo');
        expect(result.worstCase?.maxTime).toBe(80);
    });

    test('Returns valid=true when all models fit under Takt', () => {
        const goodTasks = [{
            id: 'T1',
            description: 'Good Task',
            _multiProductTimes: [
                { productId: 'A', time: 30, demand: 200 },
                { productId: 'B', time: 50, demand: 200 }
            ],
            standardTime: 40,
            averageTime: 40,
            predecessors: [],
            successors: [],
            times: [],
            ratingFactor: 100,
            fatigueCategory: 'none' as const,
            positionalWeight: 0,
            calculatedSuccessorSum: 0
        }];

        const result = validateModelVariability(goodTasks, TAKT_TIME, TOTAL_DEMAND);

        expect(result.valid).toBe(true);
        expect(result.alerts.filter(a => a.severity === 'critical')).toHaveLength(0);
        console.log('✅ Good tasks pass validation');
    });

    test('Detects warning for 90-100% zone', () => {
        const tightTasks = [{
            id: 'T2',
            description: 'Tight Task',
            _multiProductTimes: [
                { productId: 'A', time: 30, demand: 200 },
                { productId: 'B', time: 57, demand: 200 } // 93% of 61.2
            ],
            standardTime: 43.5,
            averageTime: 43.5,
            predecessors: [],
            successors: [],
            times: [],
            ratingFactor: 100,
            fatigueCategory: 'none' as const,
            positionalWeight: 0,
            calculatedSuccessorSum: 0
        }];

        const result = validateModelVariability(tightTasks, TAKT_TIME, TOTAL_DEMAND);

        // Valid but with warning
        expect(result.valid).toBe(true);
        const warnings = result.alerts.filter(a => a.severity === 'warning');
        expect(warnings.length).toBe(1);
        expect(warnings[0].message).toContain('AJUSTADO');
        console.log('✅ Warning detected:', warnings[0].message);
    });
});


import { describe, it, expect } from 'vitest';
import { calculateTaktTime, calculateMinCavities, calculateMinOperators } from '../modules/core_logic';

describe('Auto Cavity Logic (Core Formulas)', () => {

    // User Scenario 1
    it('should calculate correct cavities for 350 pcs/day (Takt ~82s)', () => {
        const availableSeconds = 28800; // 8 hours
        const demand = 350;
        const curingTime = 193;

        const takt = calculateTaktTime(availableSeconds, demand);
        expect(takt).toBeCloseTo(82.28, 1);

        const cavities = calculateMinCavities(curingTime, takt);
        expect(cavities).toBe(3); // Ceil(193 / 82.28) = Ceil(2.34) = 3
    });

    // User Scenario 2 (Boundary)
    it('should calculate correct cavities for 150 pcs/day (Takt 192s)', () => {
        const availableSeconds = 28800;
        const demand = 150;
        const curingTime = 193;

        const takt = calculateTaktTime(availableSeconds, demand);
        expect(takt).toBe(192);

        const cavities = calculateMinCavities(curingTime, takt);
        expect(cavities).toBe(2); // Ceil(193 / 192) = Ceil(1.005) = 2
    });

    // Min Operators Logic
    it('should calculate min operators correctly', () => {
        const totalManualWork = 54;
        const takt = 74.57; // From previous Chips scenario

        const ops = calculateMinOperators(totalManualWork, takt);
        expect(ops).toBe(1); // 54 < 74.57
    });

    it('should calculate min operators for high workload', () => {
        const totalManualWork = 150;
        const takt = 70;

        const ops = calculateMinOperators(totalManualWork, takt);
        expect(ops).toBe(3); // Ceil(150 / 70) = Ceil(2.14) = 3
    });
});

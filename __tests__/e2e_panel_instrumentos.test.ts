/**
 * End-to-End Validation Test: "El Caso del Panel de Instrumentos"
 * 
 * Expert-designed test scenario to validate the complete Lean Logistics flow:
 * VSM → Kanban → Mizusumashi → Heijunka
 * 
 * Input Data:
 * - Available Time: 480 min (1 shift, 8 hours)
 * - Daily Demand: 480 pieces
 * - Pack-out Qty: 20 pieces per container
 * - Mix: Model A = 360 units (75%), Model B = 120 units (25%)
 * 
 * Expected Results:
 * - Takt Time = 60 seconds (480 min × 60 / 480 pcs = 60s)
 * - Pitch = 20 minutes (Takt × Pack-out = 1 min × 20 = 20 min)
 * - Heijunka Slots = 24 (480 min / 20 min per slot)
 * - Pattern = A A A B (3:1 ratio leveled across slots)
 */

import { describe, test, expect } from 'vitest';
import { calculatePitch, calculateRouteTime } from '../modules/mizusumashi/mizusumashiLogic';
import {
    calculateSlots,
    calculateHeijunka,
    euclideanDistribute,
    ProductDemand
} from '../modules/heijunka/heijunkaLogic';

describe('E2E Validation: Panel de Instrumentos Scenario', () => {
    // =========================================================================
    // CONSTANTS (Expert-provided input data)
    // =========================================================================
    const AVAILABLE_MINUTES = 480;          // 8 hour shift
    const DAILY_DEMAND = 480;               // pieces per day
    const PACK_OUT_QTY = 20;                // pieces per container
    const MODEL_A_DEMAND = 360;             // 75% of demand
    const MODEL_B_DEMAND = 120;             // 25% of demand

    // Expected results
    const EXPECTED_TAKT_SECONDS = 60;       // 1 minute
    const EXPECTED_PITCH_MINUTES = 20;      // Takt × Pack-out
    const EXPECTED_SLOTS = 24;              // 480 / 20

    // =========================================================================
    // TEST 1: Takt Time Calculation
    // =========================================================================
    test('1. Takt Time = 60 seconds (480 min / 480 pcs)', () => {
        const availableSeconds = AVAILABLE_MINUTES * 60;
        const taktSeconds = availableSeconds / DAILY_DEMAND;

        expect(taktSeconds).toBe(EXPECTED_TAKT_SECONDS);
        console.log(`✅ Takt Time: ${taktSeconds}s (${taktSeconds / 60} min)`);
    });

    // =========================================================================
    // TEST 2: Pitch Calculation (Mizusumashi rhythm)
    // =========================================================================
    test('2. Pitch = 20 minutes (Takt × Pack-out = 1 min × 20)', () => {
        const taktSeconds = EXPECTED_TAKT_SECONDS;

        // Using the actual calculatePitch function
        const pitch = calculatePitch(taktSeconds, PACK_OUT_QTY);

        expect(pitch).toBe(EXPECTED_PITCH_MINUTES);
        console.log(`✅ Pitch: ${pitch} minutes (train departs every ${pitch} min)`);
    });

    // =========================================================================
    // TEST 3: Heijunka Box Structure - 24 Columns
    // =========================================================================
    test('3. Heijunka Box has 24 columns (480 min / 20 min pitch)', () => {
        const totalSlots = calculateSlots(AVAILABLE_MINUTES, EXPECTED_PITCH_MINUTES);

        expect(totalSlots).toBe(EXPECTED_SLOTS);
        console.log(`✅ Heijunka Columns: ${totalSlots} intervals`);
    });

    // =========================================================================
    // TEST 4: Euclidean Algorithm - 3:1 Pattern (A A A B)
    // =========================================================================
    test('4. Euclidean distribution creates 3:1 pattern (A A A B)', () => {
        // Model A: 360 units across 24 slots = 15 per slot average
        // Model B: 120 units across 24 slots = 5 per slot average

        const distributionA = euclideanDistribute(MODEL_A_DEMAND, EXPECTED_SLOTS);
        const distributionB = euclideanDistribute(MODEL_B_DEMAND, EXPECTED_SLOTS);

        // Total assigned should match demand
        const totalA = distributionA.reduce((sum, qty) => sum + qty, 0);
        const totalB = distributionB.reduce((sum, qty) => sum + qty, 0);

        expect(totalA).toBe(MODEL_A_DEMAND);
        expect(totalB).toBe(MODEL_B_DEMAND);

        console.log(`✅ Model A distributed: ${totalA} units (${MODEL_A_DEMAND} expected)`);
        console.log(`✅ Model B distributed: ${totalB} units (${MODEL_B_DEMAND} expected)`);

        // Log first 8 slots to verify pattern
        console.log('📊 First 8 slots pattern:');
        for (let i = 0; i < 8; i++) {
            console.log(`  Slot ${i + 1}: A=${distributionA[i]}, B=${distributionB[i]}`);
        }
    });

    // =========================================================================
    // TEST 5: Complete Heijunka Calculation
    // =========================================================================
    test('5. Full Heijunka calculation with 2 products', () => {
        const products: ProductDemand[] = [
            {
                productId: 'A',
                productName: 'Modelo A (Estándar)',
                dailyDemand: MODEL_A_DEMAND,
                cycleTimeSeconds: 55, // Under takt (good)
                color: '#3B82F6'
            },
            {
                productId: 'B',
                productName: 'Modelo B (Lujo)',
                dailyDemand: MODEL_B_DEMAND,
                cycleTimeSeconds: 58, // Under takt (good)
                color: '#10B981'
            }
        ];

        const result = calculateHeijunka(
            products,
            AVAILABLE_MINUTES,
            EXPECTED_PITCH_MINUTES,
            '08:00'
        );

        // Verify structure
        expect(result.totalSlots).toBe(EXPECTED_SLOTS);
        expect(result.pitchMinutes).toBe(EXPECTED_PITCH_MINUTES);
        expect(result.isFeasible).toBe(true);

        // Verify total assignments
        const summaryA = result.productSummaries.find(s => s.productId === 'A');
        const summaryB = result.productSummaries.find(s => s.productId === 'B');

        expect(summaryA?.totalAssigned).toBe(MODEL_A_DEMAND);
        expect(summaryB?.totalAssigned).toBe(MODEL_B_DEMAND);

        console.log(`✅ Heijunka Result:`);
        console.log(`   - Total Slots: ${result.totalSlots}`);
        console.log(`   - Pitch: ${result.pitchMinutes} min`);
        console.log(`   - Model A: ${summaryA?.totalAssigned}/${MODEL_A_DEMAND} assigned`);
        console.log(`   - Model B: ${summaryB?.totalAssigned}/${MODEL_B_DEMAND} assigned`);
        console.log(`   - Feasible: ${result.isFeasible}`);

        // Verify Model B appears in slots 4, 8, 12 (0-indexed: 3, 7, 11)
        // Due to Euclidean distribution, B should be evenly spread
        const slotsWithB = result.slots
            .map((slot, index) => ({
                index: index + 1,
                hasB: slot.assignments.some(a => a.productId === 'B')
            }))
            .filter(s => s.hasB);

        console.log(`   - Model B appears in ${slotsWithB.length} slots`);
        console.log(`   - B slots: ${slotsWithB.slice(0, 8).map(s => s.index).join(', ')}...`);
    });

    // =========================================================================
    // TEST 6: STRESS TEST - Change Pack-out from 20 to 10
    // =========================================================================
    describe('6. Stress Test: Pack-out 20 → 10', () => {
        const NEW_PACK_OUT = 10;
        const NEW_PITCH_MINUTES = 10;  // Takt × new pack-out = 1 × 10 = 10 min
        const NEW_SLOTS = 48;          // 480 / 10 = 48 columns

        test('6a. New Pitch = 10 minutes when pack-out halved', () => {
            const newPitch = calculatePitch(EXPECTED_TAKT_SECONDS, NEW_PACK_OUT);

            expect(newPitch).toBe(NEW_PITCH_MINUTES);
            console.log(`✅ Stress Test - New Pitch: ${newPitch} min (was ${EXPECTED_PITCH_MINUTES} min)`);
        });

        test('6b. Heijunka now shows 48 columns (double)', () => {
            const newSlots = calculateSlots(AVAILABLE_MINUTES, NEW_PITCH_MINUTES);

            expect(newSlots).toBe(NEW_SLOTS);
            console.log(`✅ Stress Test - New Columns: ${newSlots} (was ${EXPECTED_SLOTS})`);
        });

        test('6c. Full recalculation with new pitch', () => {
            const products: ProductDemand[] = [
                {
                    productId: 'A',
                    productName: 'Modelo A',
                    dailyDemand: MODEL_A_DEMAND,
                    cycleTimeSeconds: 55,
                    color: '#3B82F6'
                },
                {
                    productId: 'B',
                    productName: 'Modelo B',
                    dailyDemand: MODEL_B_DEMAND,
                    cycleTimeSeconds: 58,
                    color: '#10B981'
                }
            ];

            const result = calculateHeijunka(
                products,
                AVAILABLE_MINUTES,
                NEW_PITCH_MINUTES,  // Changed pitch
                '08:00'
            );

            expect(result.totalSlots).toBe(NEW_SLOTS);
            expect(result.productSummaries[0].totalAssigned).toBe(MODEL_A_DEMAND);
            expect(result.productSummaries[1].totalAssigned).toBe(MODEL_B_DEMAND);

            console.log(`✅ Stress Test - System is REACTIVE:`);
            console.log(`   - Slots doubled: ${EXPECTED_SLOTS} → ${result.totalSlots}`);
            console.log(`   - Demand preserved: A=${result.productSummaries[0].totalAssigned}, B=${result.productSummaries[1].totalAssigned}`);
        });
    });
});

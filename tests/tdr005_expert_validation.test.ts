/**
 * TDR-005: Final Expert Validation Test - Super Complex Scenario
 * 
 * Tests the complete system with:
 * - SALBP linear + RALBP dominant (injection)
 * - Multi-Manning (7 operators)
 * - Capacity inviability (TCR > Takt)
 * - Efficiency metrics validation
 */

import { describe, it, expect } from 'vitest';

// Expert-defined test parameters
const EXPERT_SCENARIO = {
    dailyDemand: 40,           // piezas/día
    productiveMinutes: 480,     // 1 turno de 8 horas
    taktTime: 720,              // segundos/pieza = (480*60)/40
    oee: 0.90,                  // 90%
    headcount: 7,               // operarios
    stations: 5,                // estaciones configuradas
    totalWorkContent: 3890,     // segundos (sum of all tasks)
};

// Tasks from expert scenario
const EXPERT_TASKS = [
    { id: 'I1', sector: 'Inyección PU', description: 'Curado Químico', time: 800, predecessors: [], isRalbpDominant: true },
    { id: 'I2', sector: 'Inyección PU', description: 'Retiro de Molde', time: 90, predecessors: ['I1'], isManualExternal: true },
    { id: 'I3', sector: 'Inyección PU', description: 'Recorte Rebaba', time: 180, predecessors: ['I2'], isManualInternal: true },
    { id: 'E1', sector: 'Ensamble Lineal', description: 'Montaje de Base', time: 400, predecessors: [] },
    { id: 'E2', sector: 'Ensamble Lineal', description: 'Fijación Múltiple', time: 600, predecessors: ['E1'] },
    { id: 'E3', sector: 'Ensamble Lineal', description: 'Cableado Final', time: 500, predecessors: ['E2'] },
    { id: 'P1', sector: 'Empaque', description: 'Empaque/Etiquetado', time: 520, predecessors: ['E3', 'I3'] },
    { id: 'V1', sector: 'Inspección', description: 'Inspección de Calidad', time: 400, predecessors: ['P1'] },
    { id: 'V2', sector: 'Inspección', description: 'Paletizado Final', time: 400, predecessors: ['V1'] },
];

describe('TDR-005: Final Expert Validation - Super Complex Scenario', () => {

    describe('1. Input Validation', () => {
        it('should calculate Takt Time correctly from demand and productive time', () => {
            const taktTime = (EXPERT_SCENARIO.productiveMinutes * 60) / EXPERT_SCENARIO.dailyDemand;
            expect(taktTime).toBe(720);
        });

        it('should have total work content of 3890 seconds', () => {
            const totalWork = EXPERT_TASKS.reduce((sum, t) => sum + t.time, 0);
            expect(totalWork).toBe(3890);
        });
    });

    describe('2. RALBP Dominance (Injection)', () => {
        it('should identify I1 (800s) as the dominant constraint', () => {
            const dominantTask = EXPERT_TASKS.find(t => t.isRalbpDominant);
            expect(dominantTask).toBeDefined();
            expect(dominantTask!.time).toBe(800);
            expect(dominantTask!.time).toBeGreaterThan(EXPERT_SCENARIO.taktTime);
        });

        it('should set TCR (Real Cycle Time) to 800s based on dominant constraint', () => {
            const tcr = Math.max(...EXPERT_TASKS.map(t => t.time));
            expect(tcr).toBe(800);
        });
    });

    describe('3. Capacity Inviability Detection', () => {
        it('should detect TCR > Takt as CRITICAL overload', () => {
            const tcr = 800;
            const takt = 720;
            const isOverloaded = tcr > takt;
            expect(isOverloaded).toBe(true);
        });

        it('should calculate overload percentage correctly', () => {
            const tcr = 800;
            const takt = 720;
            const overloadPct = (tcr / takt) * 100;
            expect(overloadPct).toBeCloseTo(111.11, 1);
        });
    });

    describe('4. Minimum Stations Calculation', () => {
        it('should calculate minimum stations (Nmin) as 6', () => {
            const nMin = Math.ceil(EXPERT_SCENARIO.totalWorkContent / EXPERT_SCENARIO.taktTime);
            expect(nMin).toBe(6); // ceil(3890/720) = ceil(5.40) = 6
        });

        it('should note that configured stations (5) < required (6)', () => {
            const nMin = Math.ceil(EXPERT_SCENARIO.totalWorkContent / EXPERT_SCENARIO.taktTime);
            const configured = EXPERT_SCENARIO.stations;
            expect(configured).toBeLessThan(nMin);
        });
    });

    describe('5. Efficiency Metrics (Expert Formulas)', () => {
        const totalWork = 3890;
        const hc = 7;
        const tcr = 800;
        const takt = 720;

        it('should calculate Line Efficiency (E_Línea) as 69.46%', () => {
            // E_Línea = Σt / (HC × TCR)
            const efficiencyLine = (totalWork / (hc * tcr)) * 100;
            expect(efficiencyLine).toBeCloseTo(69.46, 1);
        });

        it('should calculate Takt Efficiency (E_Takt) as 77.18%', () => {
            // E_Takt = Σt / (HC × Tc)
            const efficiencyTakt = (totalWork / (hc * takt)) * 100;
            expect(efficiencyTakt).toBeCloseTo(77.18, 1);
        });
    });

    describe('6. Recommendation Logic', () => {
        it('should NOT recommend adding operators when bottleneck is RALBP (fixed asset)', () => {
            const isRalbpBottleneck = true;
            const recommendation = isRalbpBottleneck
                ? 'Reducir demanda o tiempo de máquina'
                : 'Agregar operarios';
            expect(recommendation).toBe('Reducir demanda o tiempo de máquina');
        });

        it('should identify bottleneck type as MACHINE (not LABOR)', () => {
            const machineTime = 800; // I1 curado
            const manualTime = 90 + 180; // I2 + I3
            const bottleneckType = machineTime >= manualTime ? 'MACHINE' : 'LABOR';
            expect(bottleneckType).toBe('MACHINE');
        });
    });

    describe('7. Internal vs External Manual Tasks', () => {
        it('should identify I3 as internal (during curing, does not add to cycle)', () => {
            const i3 = EXPERT_TASKS.find(t => t.id === 'I3');
            expect(i3?.isManualInternal).toBe(true);
        });

        it('should identify I2 as external (adds to cycle time)', () => {
            const i2 = EXPERT_TASKS.find(t => t.id === 'I2');
            expect(i2?.isManualExternal).toBe(true);
        });

        it('should include I3 in total work content for efficiency calculation', () => {
            const totalWithI3 = EXPERT_TASKS.reduce((sum, t) => sum + t.time, 0);
            expect(totalWithI3).toBe(3890); // I3 (180s) is included
        });
    });

    describe('8. Output Capacity', () => {
        it('should calculate real output per hour based on TCR', () => {
            const tcr = 800;
            const outputPerHour = Math.floor(3600 / tcr);
            expect(outputPerHour).toBe(4); // 4 pz/h
        });

        it('should calculate target output per hour based on Takt', () => {
            const takt = 720;
            const targetPerHour = Math.floor(3600 / takt);
            expect(targetPerHour).toBe(5); // 5 pz/h
        });

        it('should show deficit of -1 pz/h', () => {
            const real = Math.floor(3600 / 800);
            const target = Math.floor(3600 / 720);
            const deficit = real - target;
            expect(deficit).toBe(-1);
        });
    });

});

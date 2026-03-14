import { Shift, Sector } from '../types';
import {
    getSectorShiftConfig,
    calculateSectorTaktTime,
    calculateTaktTime,
    calculateShiftNetMinutes
} from '../core/balancing/simulation';

// --- Test Fixtures ---

const PROJECT_SHIFTS: Shift[] = [
    { id: 1, name: 'Turno 1', startTime: '06:00', endTime: '14:00', breaks: [{ id: 'b1', name: 'Descanso', startTime: '10:00', duration: 30 }] },
    { id: 2, name: 'Turno 2', startTime: '14:00', endTime: '22:00', breaks: [{ id: 'b2', name: 'Descanso', startTime: '18:00', duration: 30 }] },
    { id: 3, name: 'Turno 3', startTime: '22:00', endTime: '06:00', breaks: [{ id: 'b3', name: 'Descanso', startTime: '02:00', duration: 30 }] },
];

const makeSector = (overrides?: Partial<Sector>): Sector => ({
    id: 'S1',
    name: 'Inyeccion',
    color: '#3b82f6',
    ...overrides,
});

// --- getSectorShiftConfig ---

describe('getSectorShiftConfig', () => {
    it('returns project defaults when no shiftOverride', () => {
        const sector = makeSector();
        const result = getSectorShiftConfig(sector, PROJECT_SHIFTS, 2);
        expect(result.shifts).toBe(PROJECT_SHIFTS);
        expect(result.activeShifts).toBe(2);
    });

    it('returns sector activeShifts when shiftOverride is present', () => {
        const sector = makeSector({ shiftOverride: { activeShifts: 1 } });
        const result = getSectorShiftConfig(sector, PROJECT_SHIFTS, 2);
        expect(result.activeShifts).toBe(1);
        expect(result.shifts).toBe(PROJECT_SHIFTS); // uses project shifts as fallback
    });

    it('uses custom shifts from shiftOverride when provided', () => {
        const customShifts: Shift[] = [
            { id: 1, name: 'Turno Especial', startTime: '08:00', endTime: '20:00', breaks: [] },
        ];
        const sector = makeSector({ shiftOverride: { activeShifts: 1, shifts: customShifts } });
        const result = getSectorShiftConfig(sector, PROJECT_SHIFTS, 2);
        expect(result.shifts).toBe(customShifts);
        expect(result.activeShifts).toBe(1);
    });

    it('clamps activeShifts to 1-3 range', () => {
        const sector0 = makeSector({ shiftOverride: { activeShifts: 0 } });
        expect(getSectorShiftConfig(sector0, PROJECT_SHIFTS, 2).activeShifts).toBe(1);

        const sector5 = makeSector({ shiftOverride: { activeShifts: 5 } });
        expect(getSectorShiftConfig(sector5, PROJECT_SHIFTS, 2).activeShifts).toBe(3);
    });
});

// --- calculateSectorTaktTime ---

describe('calculateSectorTaktTime', () => {
    const DAILY_DEMAND = 1000;
    const OEE = 0.85;

    it('matches calculateTaktTime when sector has no override', () => {
        const sector = makeSector();
        const sectorResult = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 2, DAILY_DEMAND, OEE);
        const projectResult = calculateTaktTime(PROJECT_SHIFTS, 2, DAILY_DEMAND, OEE);
        expect(sectorResult.nominalSeconds).toBe(projectResult.nominalSeconds);
        expect(sectorResult.effectiveSeconds).toBe(projectResult.effectiveSeconds);
        expect(sectorResult.totalAvailableMinutes).toBe(projectResult.totalAvailableMinutes);
    });

    it('calculates different Takt when sector overrides activeShifts', () => {
        const sector1T = makeSector({ shiftOverride: { activeShifts: 1 } });
        const sector3T = makeSector({ shiftOverride: { activeShifts: 3 } });

        const takt1 = calculateSectorTaktTime(sector1T, PROJECT_SHIFTS, 2, DAILY_DEMAND, OEE);
        const takt3 = calculateSectorTaktTime(sector3T, PROJECT_SHIFTS, 2, DAILY_DEMAND, OEE);

        // More shifts = more available time = higher Takt
        expect(takt3.nominalSeconds).toBeGreaterThan(takt1.nominalSeconds);
        // Both should be positive
        expect(takt1.nominalSeconds).toBeGreaterThan(0);
        expect(takt3.nominalSeconds).toBeGreaterThan(0);
    });

    it('sector with 1 shift has lower Takt than project with 2 shifts', () => {
        const sector = makeSector({ shiftOverride: { activeShifts: 1 } });
        const sectorTakt = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 2, DAILY_DEMAND, OEE);
        const projectTakt = calculateTaktTime(PROJECT_SHIFTS, 2, DAILY_DEMAND, OEE);
        expect(sectorTakt.nominalSeconds).toBeLessThan(projectTakt.nominalSeconds);
    });

    it('sector with 3 shifts has higher Takt than project with 1 shift', () => {
        const sector = makeSector({ shiftOverride: { activeShifts: 3 } });
        const sectorTakt = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 1, DAILY_DEMAND, OEE);
        const projectTakt = calculateTaktTime(PROJECT_SHIFTS, 1, DAILY_DEMAND, OEE);
        expect(sectorTakt.nominalSeconds).toBeGreaterThan(projectTakt.nominalSeconds);
    });

    it('passes setupLossPercent through correctly', () => {
        const sector = makeSector({ shiftOverride: { activeShifts: 1 } });
        const withSetup = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 2, DAILY_DEMAND, OEE, 0.10);
        const withoutSetup = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 2, DAILY_DEMAND, OEE, 0);
        expect(withSetup.nominalSeconds).toBeLessThan(withoutSetup.nominalSeconds);
        expect(withSetup.setupLossApplied).toBe(0.10);
    });

    it('returns zero for zero demand', () => {
        const sector = makeSector({ shiftOverride: { activeShifts: 1 } });
        const result = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 2, 0, OEE);
        expect(result.nominalSeconds).toBe(0);
        expect(result.effectiveSeconds).toBe(0);
    });

    it('returns zero for empty shifts array', () => {
        const sector = makeSector({ shiftOverride: { activeShifts: 1, shifts: [] } });
        const result = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 2, DAILY_DEMAND, OEE);
        expect(result.nominalSeconds).toBe(0);
    });
});

// --- Backward compatibility ---

describe('Backward compatibility', () => {
    it('sector without shiftOverride field works identically to before', () => {
        const sector: Sector = { id: 'S1', name: 'Test', color: '#000' };
        expect(sector.shiftOverride).toBeUndefined();

        const config = getSectorShiftConfig(sector, PROJECT_SHIFTS, 2);
        expect(config.activeShifts).toBe(2);
        expect(config.shifts).toBe(PROJECT_SHIFTS);
    });

    it('existing sector data with targetOee still works', () => {
        const sector: Sector = { id: 'S1', name: 'Costura', color: '#10B981', targetOee: 0.9 };
        const takt = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 1, 500, 0.9);
        const expected = calculateTaktTime(PROJECT_SHIFTS, 1, 500, 0.9);
        expect(takt.nominalSeconds).toBe(expected.nominalSeconds);
    });
});

// --- Edge cases ---

describe('Edge cases', () => {
    it('handles sector with shiftOverride but no custom shifts', () => {
        const sector = makeSector({ shiftOverride: { activeShifts: 2 } });
        const result = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 1, 1000, 0.85);
        // Uses 2 project shifts instead of 1 → more available time → higher Takt
        const oneShiftTakt = calculateTaktTime(PROJECT_SHIFTS, 1, 1000, 0.85);
        expect(result.nominalSeconds).toBeGreaterThan(oneShiftTakt.nominalSeconds);
    });

    it('Takt calculation is mathematically correct', () => {
        // Shift 1: 06:00-14:00 = 480min - 30min break = 450min net
        const shift1Net = calculateShiftNetMinutes(PROJECT_SHIFTS[0]);
        expect(shift1Net).toBe(450);

        const sector = makeSector({ shiftOverride: { activeShifts: 1 } });
        const demand = 500;
        const oee = 1.0; // no OEE loss for clean math

        const result = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 3, demand, oee);
        // Expected: 450min * 60s / 500 = 54s
        expect(result.nominalSeconds).toBeCloseTo(54, 1);
    });

    it('multiple sectors with different overrides produce different Takts', () => {
        const inyeccion = makeSector({ id: 'INY', name: 'Inyeccion', shiftOverride: { activeShifts: 3 } });
        const costura = makeSector({ id: 'COS', name: 'Costura', shiftOverride: { activeShifts: 1 } });
        const ensamble = makeSector({ id: 'ENS', name: 'Ensamble', shiftOverride: { activeShifts: 2 } });

        const demand = 1000;
        const oee = 0.85;

        const taktIny = calculateSectorTaktTime(inyeccion, PROJECT_SHIFTS, 2, demand, oee);
        const taktCos = calculateSectorTaktTime(costura, PROJECT_SHIFTS, 2, demand, oee);
        const taktEns = calculateSectorTaktTime(ensamble, PROJECT_SHIFTS, 2, demand, oee);

        // 3 shifts > 2 shifts > 1 shift
        expect(taktIny.nominalSeconds).toBeGreaterThan(taktEns.nominalSeconds);
        expect(taktEns.nominalSeconds).toBeGreaterThan(taktCos.nominalSeconds);
    });

    it('sector with custom shifts ignores project shifts', () => {
        const longShift: Shift[] = [
            { id: 1, name: 'Turno Largo', startTime: '00:00', endTime: '12:00', breaks: [] },
        ];
        const sector = makeSector({ shiftOverride: { activeShifts: 1, shifts: longShift } });

        const result = calculateSectorTaktTime(sector, PROJECT_SHIFTS, 1, 1000, 1.0);
        // 720 min * 60 / 1000 = 43.2s
        expect(result.nominalSeconds).toBeCloseTo(43.2, 1);
        expect(result.totalAvailableMinutes).toBe(720);
    });
});

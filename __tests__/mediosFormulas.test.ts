/**
 * Tests for mediosFormulas — pure calculation functions.
 * Validates against known Excel values from s.xlsx.
 */
import {
  calcContainers,
  calcInventory,
  calcCoverageDays,
  calcCoverageLevel,
  calcM2PerContainer,
  calcFloorPositions,
  calcContainersM2,
  calcTotalFloorM2,
  calcLocationCode,
  calcSpaceResult,
  calcSensitivityMatrix,
} from '../modules/mediosCalculator/logic/mediosFormulas';

describe('mediosFormulas', () => {
  describe('calcContainers', () => {
    it('matches Excel formula for IP PAD WIP row (350 dem, 5 LT, 15%, 20 pzs/cont)', () => {
      // Excel: ROUNDUP(350 * 5 * 1.15 / 20, 0) = ROUNDUP(100.625) = 101
      expect(calcContainers(350, 5, 0.15, 20)).toBe(101);
    });

    it('matches Excel formula for TOP ROLL WIP (700 dem, 5 LT, 15%, 80 pzs/cont)', () => {
      // ROUNDUP(700 * 5 * 1.15 / 80, 0) = ROUNDUP(50.3125) = 51
      expect(calcContainers(700, 5, 0.15, 80)).toBe(51);
    });

    it('matches Excel formula for INSERT PT NOVAX (700 dem, 10 LT, 15%, 6 pzs/cont)', () => {
      // ROUNDUP(700 * 10 * 1.15 / 6, 0) = ROUNDUP(1341.67) = 1342
      expect(calcContainers(700, 10, 0.15, 6)).toBe(1342);
    });

    it('matches Excel for IP PAD PT High (326 dem, 10 LT, 15%, 9 pzs/cont)', () => {
      // ROUNDUP(326 * 10 * 1.15 / 9, 0) = ROUNDUP(416.56) = 417
      expect(calcContainers(326, 10, 0.15, 9)).toBe(417);
    });

    it('returns 0 for zero demand', () => {
      expect(calcContainers(0, 5, 0.15, 20)).toBe(0);
    });

    it('returns 0 for zero pcs/container', () => {
      expect(calcContainers(700, 5, 0.15, 0)).toBe(0);
    });

    it('clamps negative lead time to 0', () => {
      expect(calcContainers(700, -2, 0.15, 80)).toBe(0);
    });
  });

  describe('calcInventory', () => {
    it('multiplies containers by pcs/container', () => {
      expect(calcInventory(101, 20)).toBe(2020);
    });
  });

  describe('calcCoverageDays', () => {
    it('divides inventory by daily demand', () => {
      // 2020 / 350 = 5.77 days
      expect(calcCoverageDays(2020, 350)).toBeCloseTo(5.77, 1);
    });

    it('returns 0 for zero demand', () => {
      expect(calcCoverageDays(2020, 0)).toBe(0);
    });
  });

  describe('calcCoverageLevel', () => {
    it('returns high for >5 days', () => {
      expect(calcCoverageLevel(5.77)).toBe('high');
    });

    it('returns medium for 3-5 days', () => {
      expect(calcCoverageLevel(3.5)).toBe('medium');
      expect(calcCoverageLevel(5)).toBe('medium');
    });

    it('returns ok for <3 days', () => {
      expect(calcCoverageLevel(2.5)).toBe('ok');
    });
  });

  describe('calcM2PerContainer', () => {
    it('converts mm to m² (1200x800 = 0.96 m²)', () => {
      expect(calcM2PerContainer(1200, 800)).toBeCloseTo(0.96, 4);
    });

    it('handles non-standard sizes (575x450 = 0.25875 m²)', () => {
      expect(calcM2PerContainer(575, 450)).toBeCloseTo(0.25875, 4);
    });
  });

  describe('calcFloorPositions', () => {
    it('divides containers by max stacking and rounds up', () => {
      // 101 containers / 2 stacking = 51 positions
      expect(calcFloorPositions(101, 2)).toBe(51);
    });

    it('returns containers when stacking is 1', () => {
      expect(calcFloorPositions(50, 1)).toBe(50);
    });

    it('handles zero stacking gracefully', () => {
      expect(calcFloorPositions(50, 0)).toBe(50);
    });
  });

  describe('calcTotalFloorM2', () => {
    it('divides by utilization rate', () => {
      // 48.96 m² containers / 0.55 utilization = 89.02 m²
      expect(calcTotalFloorM2(48.96, 0.55)).toBeCloseTo(89.018, 1);
    });

    it('handles zero utilization', () => {
      expect(calcTotalFloorM2(48.96, 0)).toBe(48.96);
    });
  });

  describe('calcLocationCode', () => {
    it('generates A-01 for first container type, first piece', () => {
      expect(calcLocationCode(0, 1)).toBe('A-01');
    });

    it('generates B-03 for second container type, third piece', () => {
      expect(calcLocationCode(1, 3)).toBe('B-03');
    });
  });

  describe('calcSpaceResult', () => {
    it('returns ok when enough space', () => {
      const r = calcSpaceResult(1000, 2000);
      expect(r.status).toBe('ok');
      expect(r.differenceM2).toBe(1000);
      expect(r.occupancyPct).toBeCloseTo(0.5, 2);
    });

    it('returns exceeded when not enough space', () => {
      const r = calcSpaceResult(2000, 1000);
      expect(r.status).toBe('exceeded');
      expect(r.differenceM2).toBe(-1000);
    });

    it('returns unknown when available is null', () => {
      const r = calcSpaceResult(1000, null);
      expect(r.status).toBe('unknown');
    });
  });

  describe('calcSensitivityMatrix', () => {
    it('generates correct matrix dimensions', () => {
      const pieces = [
        { dailyDemand: 700, leadTimeDays: 5, pcsPerContainer: 80 },
        { dailyDemand: 350, leadTimeDays: 3, pcsPerContainer: 20 },
      ];
      const matrix = calcSensitivityMatrix(
        pieces,
        [0.10, 0.15, 0.20],
        [-1, 0, 1]
      );
      expect(matrix).toHaveLength(3); // 3 safety %
      expect(matrix[0]).toHaveLength(3); // 3 LT deltas
    });

    it('center cell (0 delta, current safety) matches manual calculation', () => {
      const pieces = [
        { dailyDemand: 700, leadTimeDays: 5, pcsPerContainer: 80 },
      ];
      const matrix = calcSensitivityMatrix(pieces, [0.15], [0]);
      // ROUNDUP(700 * 5 * 1.15 / 80) = 51
      expect(matrix[0][0]).toBe(51);
    });

    it('handles negative lead time (clamped to 0)', () => {
      const pieces = [
        { dailyDemand: 700, leadTimeDays: 1, pcsPerContainer: 80 },
      ];
      const matrix = calcSensitivityMatrix(pieces, [0.15], [-5]);
      expect(matrix[0][0]).toBe(0); // LT=1+(-5)=-4 → clamped to 0 → 0 containers
    });
  });
});

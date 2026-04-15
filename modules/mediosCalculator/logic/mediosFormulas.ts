/**
 * Pure calculation functions for the Medios Calculator.
 * All formulas ported from the Excel model (s.xlsx).
 * Zero dependencies — easy to test.
 */

/**
 * Calculate number of containers needed for a piece.
 * Excel: =ROUNDUP((Demanda × LeadTime × (1+%Seguridad)) / PzsxCont, 0)
 */
export function calcContainers(
  dailyDemand: number,
  leadTimeDays: number,
  safetyPct: number,
  pcsPerContainer: number
): number {
  if (pcsPerContainer <= 0 || dailyDemand <= 0) return 0;
  const effectiveLT = Math.max(leadTimeDays, 0);
  return Math.ceil((dailyDemand * effectiveLT * (1 + safetyPct)) / pcsPerContainer);
}

/**
 * Calculate total inventory in pieces.
 * Excel: =F7 * '①'!J6
 */
export function calcInventory(containers: number, pcsPerContainer: number): number {
  return containers * pcsPerContainer;
}

/**
 * Calculate coverage in days.
 * Excel: =G7/'①'!F6
 */
export function calcCoverageDays(inventoryPcs: number, dailyDemand: number): number {
  if (dailyDemand <= 0) return 0;
  return inventoryPcs / dailyDemand;
}

/**
 * Determine coverage level for semaphore indicator.
 * Excel: >5 días = "⚠️ Alto" | 3-5 días = "⚡ Medio" | <3 = "✅ OK"
 */
export function calcCoverageLevel(coverageDays: number): 'high' | 'medium' | 'ok' {
  if (coverageDays > 5) return 'high';
  if (coverageDays >= 3) return 'medium';
  return 'ok';
}

/**
 * Calculate m² footprint of a single container.
 * Excel: =(K/1000)*(L/1000)
 */
export function calcM2PerContainer(lengthMm: number, widthMm: number): number {
  return (lengthMm / 1000) * (widthMm / 1000);
}

/**
 * Calculate floor positions (stacked containers occupy one position).
 * Excel: =ROUNDUP(F7/'①'!O6, 0)
 */
export function calcFloorPositions(containers: number, maxStacking: number): number {
  if (maxStacking <= 0) return containers;
  return Math.ceil(containers / maxStacking);
}

/**
 * Calculate m² occupied by containers only.
 * Excel: =J7*I7
 */
export function calcContainersM2(floorPositions: number, m2PerContainer: number): number {
  return floorPositions * m2PerContainer;
}

/**
 * Calculate total floor m² including aisles (adjusted by utilization rate).
 * Excel: =K7/$N$4
 */
export function calcTotalFloorM2(containersM2: number, utilizationRate: number): number {
  if (utilizationRate <= 0) return containersM2;
  return containersM2 / utilizationRate;
}

/**
 * Generate location code for a piece.
 * Excel: =CHAR(64+MATCH(I6,$T$5:$T$11,0))&"-"&TEXT(COUNTIFS(I$6:I6,I6),"00")
 * @param containerTypeIndex — 0-based index of the container type in the reference table
 * @param sequentialInType — 1-based sequential number within that container type
 */
export function calcLocationCode(containerTypeIndex: number, sequentialInType: number): string {
  const letter = String.fromCharCode(65 + containerTypeIndex);
  return `${letter}-${String(sequentialInType).padStart(2, '0')}`;
}

/**
 * Calculate space utilization result.
 * Excel: hoja ③ rows 44-48
 */
export function calcSpaceResult(
  neededM2: number,
  availableM2: number | null
): { differenceM2: number | null; occupancyPct: number | null; status: 'exceeded' | 'ok' | 'unknown' } {
  if (availableM2 == null || availableM2 <= 0) {
    return { differenceM2: null, occupancyPct: null, status: 'unknown' };
  }
  const diff = availableM2 - neededM2;
  const pct = neededM2 / availableM2;
  return {
    differenceM2: diff,
    occupancyPct: pct,
    status: pct > 1 ? 'exceeded' : 'ok',
  };
}

/**
 * Build the sensitivity matrix.
 * Excel: hoja ③ rows 35-41 — SUMPRODUCT for each (safetyPct, leadTimeDelta) combo.
 *
 * For each cell: recalculates total containers across ALL pieces with modified safety%
 * and lead time (original ± delta). Negative lead times clamped to 0.
 */
export function calcSensitivityMatrix(
  pieces: ReadonlyArray<{ dailyDemand: number; leadTimeDays: number; pcsPerContainer: number }>,
  safetyPcts: readonly number[],
  leadTimeDeltas: readonly number[]
): number[][] {
  return safetyPcts.map(safety =>
    leadTimeDeltas.map(delta => {
      let total = 0;
      for (const p of pieces) {
        if (p.pcsPerContainer <= 0 || p.dailyDemand <= 0) continue;
        const adjustedLT = Math.max(p.leadTimeDays + delta, 0);
        total += Math.ceil(
          (p.dailyDemand * adjustedLT * (1 + safety)) / p.pcsPerContainer
        );
      }
      return total;
    })
  );
}

/** Default safety percentages for the sensitivity matrix (10% to 40%) */
export const DEFAULT_SAFETY_PCTS = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40] as const;

/** Default lead time deltas for the sensitivity matrix (-2 to +2 days) */
export const DEFAULT_LT_DELTAS = [-2, -1, 0, 1, 2] as const;

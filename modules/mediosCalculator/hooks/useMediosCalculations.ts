/**
 * Reactive calculation hook — recomputes all results when pieces or settings change.
 * Replaces the Excel auto-calc columns in hoja ② Resultados.
 */
import { useMemo } from 'react';
import type { MediosPiece, ContainerType, PieceResult, SpaceResult } from '../types';
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
  DEFAULT_SAFETY_PCTS,
  DEFAULT_LT_DELTAS,
} from '../logic/mediosFormulas';

interface UseMediosCalculationsInput {
  pieces: readonly MediosPiece[];
  containerTypes: readonly ContainerType[];
  utilizationRate: number;
  availableM2: number | null;
}

interface UseMediosCalculationsOutput {
  results: PieceResult[];
  totalContainers: number;
  totalPieces: number;
  totalM2: number;
  avgCoverageDays: number;
  loadedPieces: number;
  spaceResult: SpaceResult;
  sensitivityMatrix: number[][];
  safetyPcts: readonly number[];
  leadTimeDeltas: readonly number[];
}

export function useMediosCalculations({
  pieces,
  containerTypes,
  utilizationRate,
  availableM2,
}: UseMediosCalculationsInput): UseMediosCalculationsOutput {
  // Build container type lookup
  const ctMap = useMemo(() => {
    const m = new Map<string, ContainerType>();
    for (const ct of containerTypes) m.set(ct.id, ct);
    return m;
  }, [containerTypes]);

  // Build container type index (for location codes)
  const ctIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    const sorted = [...containerTypes].sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach((ct, i) => m.set(ct.id, i));
    return m;
  }, [containerTypes]);

  // Calculate results for all pieces
  const results = useMemo((): PieceResult[] => {
    // Count sequential per container type for location codes
    const seqCount = new Map<string, number>();

    return pieces.map((p) => {
      const ct = ctMap.get(p.containerTypeId);
      const containers = calcContainers(p.dailyDemand, p.leadTimeDays, p.safetyPct, p.pcsPerContainer);
      const inventoryPcs = calcInventory(containers, p.pcsPerContainer);
      const coverageDays = calcCoverageDays(inventoryPcs, p.dailyDemand);
      const lengthMm = ct?.lengthMm ?? 1200;
      const widthMm = ct?.widthMm ?? 800;
      const m2PerContainer = calcM2PerContainer(lengthMm, widthMm);
      const maxStacking = ct?.maxStacking ?? 1;
      const floorPositions = calcFloorPositions(containers, maxStacking);
      const m2Containers = calcContainersM2(floorPositions, m2PerContainer);
      const m2FloorTotal = calcTotalFloorM2(m2Containers, utilizationRate);

      // Location code
      const ctIdx = ctIndexMap.get(p.containerTypeId) ?? 0;
      const seq = (seqCount.get(p.containerTypeId) ?? 0) + 1;
      seqCount.set(p.containerTypeId, seq);
      const locationCode = calcLocationCode(ctIdx, seq);

      return {
        pieceId: p.id,
        pieceCode: p.pieceCode,
        description: p.description,
        family: p.family,
        client: p.client,
        stage: p.stage,
        containers,
        inventoryPcs,
        coverageDays,
        m2PerContainer,
        floorPositions,
        m2Containers,
        m2FloorTotal,
        pctOfTotal: 0, // calculated after all pieces
        locationCode,
        coverageLevel: calcCoverageLevel(coverageDays),
      };
    });
  }, [pieces, ctMap, ctIndexMap, utilizationRate]);

  // Compute pctOfTotal after we have all m2FloorTotal values
  const resultsWithPct = useMemo((): PieceResult[] => {
    const totalM2 = results.reduce((s, r) => s + r.m2FloorTotal, 0);
    if (totalM2 <= 0) return results;
    return results.map(r => ({ ...r, pctOfTotal: r.m2FloorTotal / totalM2 }));
  }, [results]);

  // Totals
  const totals = useMemo(() => {
    let totalContainers = 0;
    let totalPieces = 0;
    let totalM2 = 0;
    let totalCoverageDaysWeighted = 0;
    let totalDemand = 0;
    for (const r of resultsWithPct) {
      totalContainers += r.containers;
      totalPieces += r.inventoryPcs;
      totalM2 += r.m2FloorTotal;
    }
    for (const p of pieces) {
      totalCoverageDaysWeighted += calcCoverageDays(
        calcInventory(
          calcContainers(p.dailyDemand, p.leadTimeDays, p.safetyPct, p.pcsPerContainer),
          p.pcsPerContainer
        ),
        p.dailyDemand
      ) * p.dailyDemand;
      totalDemand += p.dailyDemand;
    }
    return {
      totalContainers,
      totalPieces,
      totalM2,
      avgCoverageDays: totalDemand > 0 ? totalCoverageDaysWeighted / totalDemand : 0,
      loadedPieces: pieces.length,
    };
  }, [resultsWithPct, pieces]);

  // Space calculation
  const spaceResult = useMemo((): SpaceResult => {
    const sr = calcSpaceResult(totals.totalM2, availableM2);
    return {
      availableM2,
      neededM2: totals.totalM2,
      ...sr,
    };
  }, [totals.totalM2, availableM2]);

  // Sensitivity matrix
  const sensitivityMatrix = useMemo(() => {
    const piecesData = pieces.map(p => ({
      dailyDemand: p.dailyDemand,
      leadTimeDays: p.leadTimeDays,
      pcsPerContainer: p.pcsPerContainer,
    }));
    return calcSensitivityMatrix(piecesData, [...DEFAULT_SAFETY_PCTS], [...DEFAULT_LT_DELTAS]);
  }, [pieces]);

  return {
    results: resultsWithPct,
    ...totals,
    spaceResult,
    sensitivityMatrix,
    safetyPcts: DEFAULT_SAFETY_PCTS,
    leadTimeDeltas: DEFAULT_LT_DELTAS,
  };
}

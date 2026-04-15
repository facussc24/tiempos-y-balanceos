/**
 * Summary aggregation functions — group results by client, stage, or container type.
 * Mirrors hoja ③ sections 5.2, 5.3, 5.4 from the Excel.
 */
import type { PieceResult, SummaryRow } from '../types';

type GroupKey = 'client' | 'stage' | 'family';

/**
 * Aggregate piece results by a grouping key.
 * Returns sorted summary rows with totals.
 */
export function aggregateBy(
  results: readonly PieceResult[],
  key: GroupKey
): SummaryRow[] {
  const map = new Map<string, { containers: number; pieces: number; m2: number }>();

  for (const r of results) {
    const label = r[key] || '(sin asignar)';
    const existing = map.get(label) ?? { containers: 0, pieces: 0, m2: 0 };
    existing.containers += r.containers;
    existing.pieces += r.inventoryPcs;
    existing.m2 += r.m2FloorTotal;
    map.set(label, existing);
  }

  const totalM2 = Array.from(map.values()).reduce((s, v) => s + v.m2, 0);

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({
      label,
      containers: v.containers,
      pieces: v.pieces,
      m2: v.m2,
      pctSpace: totalM2 > 0 ? v.m2 / totalM2 : 0,
    }));
}

/** Aggregate by client OEM (VWA, NOVAX, etc.) */
export function aggregateByClient(results: readonly PieceResult[]): SummaryRow[] {
  return aggregateBy(results, 'client');
}

/** Aggregate by stage (WIP, Semiterminado, Producto Terminado) */
export function aggregateByStage(results: readonly PieceResult[]): SummaryRow[] {
  return aggregateBy(results, 'stage');
}

/** Aggregate by family (INSERT, TOP ROLL, etc.) */
export function aggregateByFamily(results: readonly PieceResult[]): SummaryRow[] {
  return aggregateBy(results, 'family');
}

/**
 * Aggregate by container type name.
 * Requires container type name to be resolved externally.
 */
export function aggregateByContainerType(
  results: readonly PieceResult[],
  containerTypeNames: ReadonlyMap<string, string> // pieceId → containerTypeName
): SummaryRow[] {
  const map = new Map<string, { containers: number; pieces: number; m2: number }>();

  for (const r of results) {
    const label = containerTypeNames.get(r.pieceId) || '(desconocido)';
    const existing = map.get(label) ?? { containers: 0, pieces: 0, m2: 0 };
    existing.containers += r.containers;
    existing.pieces += r.inventoryPcs;
    existing.m2 += r.m2FloorTotal;
    map.set(label, existing);
  }

  const totalM2 = Array.from(map.values()).reduce((s, v) => s + v.m2, 0);

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({
      label,
      containers: v.containers,
      pieces: v.pieces,
      m2: v.m2,
      pctSpace: totalM2 > 0 ? v.m2 / totalM2 : 0,
    }));
}

/** Calculate totals row from summary rows */
export function calcTotals(rows: readonly SummaryRow[]): SummaryRow {
  return rows.reduce(
    (acc, r) => ({
      label: 'TOTAL',
      containers: acc.containers + r.containers,
      pieces: acc.pieces + r.pieces,
      m2: acc.m2 + r.m2,
      pctSpace: 1,
    }),
    { label: 'TOTAL', containers: 0, pieces: 0, m2: 0, pctSpace: 1 }
  );
}

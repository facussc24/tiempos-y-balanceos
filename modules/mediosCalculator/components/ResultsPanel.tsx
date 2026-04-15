/**
 * ResultsPanel — Auto-calculated results (equivalent to Excel hoja ② Resultados).
 * Read-only table with KPI cards at the top.
 */
import React from 'react';
import { Package, Layers, Ruler, Calendar } from 'lucide-react';
import type { PieceResult } from '../types';
import { CoverageIndicator } from './CoverageIndicator';

interface Props {
  results: readonly PieceResult[];
  totalContainers: number;
  totalPieces: number;
  totalM2: number;
  avgCoverageDays: number;
  loadedPieces: number;
}

const KPI_CARDS = [
  { key: 'containers', label: 'Total Contenedores', icon: Package, color: 'emerald' },
  { key: 'pieces', label: 'Total Piezas', icon: Layers, color: 'blue' },
  { key: 'm2', label: 'm\u00B2 de Piso', icon: Ruler, color: 'amber' },
  { key: 'coverage', label: 'Cobertura Prom.', icon: Calendar, color: 'purple' },
] as const;

export const ResultsPanel: React.FC<Props> = ({
  results, totalContainers, totalPieces, totalM2, avgCoverageDays, loadedPieces,
}) => {
  const kpiValues: Record<string, string> = {
    containers: totalContainers.toLocaleString('es-AR'),
    pieces: totalPieces.toLocaleString('es-AR'),
    m2: `${totalM2.toLocaleString('es-AR', { maximumFractionDigits: 1 })} m\u00B2`,
    coverage: `${avgCoverageDays.toFixed(1)} dias`,
  };

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {KPI_CARDS.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.key} className={`rounded-xl border p-4 ${colorMap[kpi.color]}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className="opacity-70" />
                <span className="text-xs font-medium uppercase opacity-70">{kpi.label}</span>
              </div>
              <span className="text-2xl font-bold tabular-nums">{kpiValues[kpi.key]}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-700 text-balance">Resultados por Pieza</h2>
        <span className="text-xs text-slate-400">{loadedPieces} piezas cargadas</span>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase">
              <th className="px-2 py-2 text-left font-medium">Codigo</th>
              <th className="px-2 py-2 text-left font-medium">Descripcion</th>
              <th className="px-2 py-2 text-left font-medium">Cliente</th>
              <th className="px-2 py-2 text-left font-medium">Etapa</th>
              <th className="px-2 py-2 text-right font-medium">N Cont.</th>
              <th className="px-2 py-2 text-right font-medium">Inv. (pzs)</th>
              <th className="px-2 py-2 text-center font-medium">Cobertura</th>
              <th className="px-2 py-2 text-right font-medium">m2/Cont</th>
              <th className="px-2 py-2 text-right font-medium">Posiciones</th>
              <th className="px-2 py-2 text-right font-medium">m2 Cont.</th>
              <th className="px-2 py-2 text-right font-medium">m2 Piso</th>
              <th className="px-2 py-2 text-right font-medium">% Total</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => (
              <tr key={r.pieceId} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-2 py-1.5 font-mono text-xs">{r.pieceCode}</td>
                <td className="px-2 py-1.5 max-w-[200px] truncate" title={r.description}>{r.description}</td>
                <td className="px-2 py-1.5">{r.client}</td>
                <td className="px-2 py-1.5">{r.stage}</td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">{r.containers.toLocaleString('es-AR')}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.inventoryPcs.toLocaleString('es-AR')}</td>
                <td className="px-2 py-1.5 text-center">
                  <CoverageIndicator level={r.coverageLevel} days={r.coverageDays} compact />
                </td>
                <td className="px-2 py-1.5 text-right text-slate-500 tabular-nums">{r.m2PerContainer.toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.floorPositions}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.m2Containers.toFixed(1)}</td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">{r.m2FloorTotal.toFixed(1)}</td>
                <td className="px-2 py-1.5 text-right text-slate-500 tabular-nums">{(r.pctOfTotal * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
          {results.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                <td colSpan={4} className="px-2 py-2 text-right uppercase text-xs text-slate-500">Totales</td>
                <td className="px-2 py-2 text-right tabular-nums">{totalContainers.toLocaleString('es-AR')}</td>
                <td className="px-2 py-2 text-right tabular-nums">{totalPieces.toLocaleString('es-AR')}</td>
                <td className="px-2 py-2 text-center">
                  <CoverageIndicator level={avgCoverageDays > 5 ? 'high' : avgCoverageDays >= 3 ? 'medium' : 'ok'} days={avgCoverageDays} compact />
                </td>
                <td colSpan={2} />
                <td className="px-2 py-2 text-right tabular-nums">{results.reduce((s, r) => s + r.m2Containers, 0).toFixed(1)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{totalM2.toFixed(1)}</td>
                <td className="px-2 py-2 text-right">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

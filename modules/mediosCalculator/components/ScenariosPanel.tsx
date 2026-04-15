/**
 * ScenariosPanel — Summaries + sensitivity matrix + space calculator
 * (equivalent to Excel hoja ③ Escenarios).
 */
import React, { useState, useMemo } from 'react';
import { BarChart3, Grid3X3, Ruler } from 'lucide-react';
import type { PieceResult, MediosPiece, ContainerType, SpaceResult } from '../types';
import { aggregateByClient, aggregateByStage, aggregateByFamily } from '../logic/summaryAggregations';
import type { SummaryRow } from '../types';

interface Props {
  results: readonly PieceResult[];
  pieces: readonly MediosPiece[];
  containerTypes: readonly ContainerType[];
  sensitivityMatrix: number[][];
  safetyPcts: readonly number[];
  leadTimeDeltas: readonly number[];
  spaceResult: SpaceResult;
  utilizationRate: number;
  onUpdateProject: (updates: Partial<{ utilizationRate: number; availableM2: number | null }>) => Promise<void>;
}

type SummaryView = 'client' | 'stage' | 'family';

export const ScenariosPanel: React.FC<Props> = ({
  results, sensitivityMatrix, safetyPcts, leadTimeDeltas, spaceResult, utilizationRate, onUpdateProject,
}) => {
  const [summaryView, setSummaryView] = useState<SummaryView>('client');
  const [editingM2, setEditingM2] = useState(false);

  const summaryRows = useMemo((): SummaryRow[] => {
    switch (summaryView) {
      case 'client': return aggregateByClient(results);
      case 'stage': return aggregateByStage(results);
      case 'family': return aggregateByFamily(results);
    }
  }, [results, summaryView]);

  const totalRow = useMemo(() => ({
    containers: summaryRows.reduce((s, r) => s + r.containers, 0),
    pieces: summaryRows.reduce((s, r) => s + r.pieces, 0),
    m2: summaryRows.reduce((s, r) => s + r.m2, 0),
  }), [summaryRows]);

  // Current safety% (15%) index for highlighting
  const currentSafetyIdx = safetyPcts.indexOf(0.15);
  const currentDeltaIdx = leadTimeDeltas.indexOf(0);

  return (
    <div className="space-y-8">
      {/* Resumen */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 size={18} className="text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-700 text-balance">Resumen de Planta</h2>
          <div className="flex gap-1 ml-auto">
            {(['client', 'stage', 'family'] as const).map(v => (
              <button
                key={v}
                onClick={() => setSummaryView(v)}
                className={`px-3 py-1 text-xs rounded-full ${
                  summaryView === v ? 'bg-emerald-100 text-emerald-700 font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {v === 'client' ? 'Por Cliente' : v === 'stage' ? 'Por Etapa' : 'Por Familia'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs uppercase">
                <th className="px-3 py-2 text-left font-medium">
                  {summaryView === 'client' ? 'Cliente OEM' : summaryView === 'stage' ? 'Etapa' : 'Familia'}
                </th>
                <th className="px-3 py-2 text-right font-medium">Contenedores</th>
                <th className="px-3 py-2 text-right font-medium">Piezas</th>
                <th className="px-3 py-2 text-right font-medium">m2 Piso</th>
                <th className="px-3 py-2 text-right font-medium">% Espacio</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(r => (
                <tr key={r.label} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.containers.toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.pieces.toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.m2.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{(r.pctSpace * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalRow.containers.toLocaleString('es-AR')}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalRow.pieces.toLocaleString('es-AR')}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalRow.m2.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Sensitivity Matrix */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Grid3X3 size={18} className="text-purple-600" />
          <h2 className="text-base font-semibold text-slate-700 text-balance">Simulador de Sensibilidad</h2>
          <span className="text-xs text-slate-400 ml-2">Contenedores totales segun variacion</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium">% Seguridad \ LT</th>
                {leadTimeDeltas.map(d => (
                  <th key={d} className={`px-3 py-2 text-center text-xs font-medium ${
                    d === 0 ? 'bg-amber-50 text-amber-700' : 'text-slate-600'
                  }`}>
                    {d > 0 ? `+${d}` : d} dias
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivityMatrix.map((row, ri) => (
                <tr key={ri} className="border-t border-slate-100">
                  <td className={`px-3 py-2 font-medium text-xs ${
                    ri === currentSafetyIdx ? 'bg-amber-50 text-amber-700' : 'text-slate-600'
                  }`}>
                    {(safetyPcts[ri] * 100).toFixed(0)}%
                  </td>
                  {row.map((val, ci) => {
                    const isCurrent = ri === currentSafetyIdx && ci === currentDeltaIdx;
                    return (
                      <td key={ci} className={`px-3 py-2 text-center font-mono text-sm tabular-nums ${
                        isCurrent
                          ? 'bg-amber-100 text-amber-800 font-bold ring-2 ring-amber-400 ring-inset'
                          : ci === currentDeltaIdx || ri === currentSafetyIdx
                            ? 'bg-amber-50/50'
                            : ''
                      }`}>
                        {val.toLocaleString('es-AR')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Celda resaltada = situacion actual (15% seguridad, 0 dias variacion)
        </p>
      </section>

      {/* Space Calculator */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Ruler size={18} className="text-blue-600" />
          <h2 className="text-base font-semibold text-slate-700 text-balance">Calculadora de Espacio</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-xl">
          {/* Utilization Rate */}
          <div className="rounded-lg border border-slate-200 p-4">
            <label className="text-xs text-slate-500 uppercase font-medium">Tasa Aprovechamiento</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={0.1}
                max={1}
                step={0.05}
                value={utilizationRate}
                onChange={e => onUpdateProject({ utilizationRate: parseFloat(e.target.value) || 0.55 })}
                className="w-20 text-lg font-bold text-blue-700 border border-blue-200 rounded px-2 py-1 bg-blue-50 focus:ring-1 focus:ring-blue-400 focus:outline-none"
              />
              <span className="text-sm text-slate-500">= {(utilizationRate * 100).toFixed(0)}% del piso para contenedores</span>
            </div>
          </div>

          {/* Available m² */}
          <div className="rounded-lg border border-slate-200 p-4">
            <label className="text-xs text-slate-500 uppercase font-medium">m2 Disponibles Planta</label>
            <input
              type="number"
              min={0}
              step={100}
              value={spaceResult.availableM2 ?? ''}
              placeholder="Sin dato"
              onChange={e => {
                const v = e.target.value ? parseFloat(e.target.value) : null;
                onUpdateProject({ availableM2: v });
              }}
              className="w-full mt-1 text-lg font-bold text-blue-700 border border-blue-200 rounded px-2 py-1 bg-blue-50 focus:ring-1 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          {/* Needed */}
          <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
            <label className="text-xs text-slate-500 uppercase font-medium">m2 Necesarios</label>
            <p className="text-xl font-bold text-slate-700 mt-1 tabular-nums">{spaceResult.neededM2.toFixed(1)} m2</p>
          </div>

          {/* Result */}
          <div className={`rounded-lg border p-4 ${
            spaceResult.status === 'exceeded' ? 'bg-red-50 border-red-200' :
            spaceResult.status === 'ok' ? 'bg-emerald-50 border-emerald-200' :
            'bg-slate-50 border-slate-200'
          }`}>
            <label className="text-xs text-slate-500 uppercase font-medium">
              {spaceResult.status === 'exceeded' ? 'EXCEDIDO' : spaceResult.status === 'ok' ? 'OK' : 'Sin datos'}
            </label>
            {spaceResult.differenceM2 != null ? (
              <p className={`text-xl font-bold mt-1 ${spaceResult.differenceM2 >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {spaceResult.differenceM2 >= 0 ? '+' : ''}{spaceResult.differenceM2.toFixed(1)} m2
                <span className="text-sm font-normal ml-2">({(spaceResult.occupancyPct! * 100).toFixed(1)}% ocupado)</span>
              </p>
            ) : (
              <p className="text-sm text-slate-400 mt-1">Ingresa m2 disponibles para calcular</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

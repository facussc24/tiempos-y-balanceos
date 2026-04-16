/**
 * DashboardPanel — Charts and visual KPIs for Medios Calculator.
 * Uses Recharts (already in project stack).
 */
import React, { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { TrendingUp, Filter } from 'lucide-react';
import type { PieceResult, MediosPiece } from '../types';
import { aggregateByClient, aggregateByStage, aggregateByFamily } from '../logic/summaryAggregations';

interface Props {
  results: readonly PieceResult[];
  pieces: readonly MediosPiece[];
  totalContainers: number;
  totalPieces: number;
  totalM2: number;
  avgCoverageDays: number;
  loadedPieces: number;
}

const COLORS = [
  '#059669', '#2563eb', '#d97706', '#7c3aed', '#dc2626',
  '#0891b2', '#65a30d', '#c026d3', '#ea580c', '#4f46e5',
];

const renderLabel = (props: { name?: string; percent?: number }) => {
  const { name, percent } = props;
  if (!name || !percent || percent <= 0.05) return '';
  return `${name} ${(percent * 100).toFixed(0)}%`;
};

export const DashboardPanel: React.FC<Props> = ({
  results, pieces, totalContainers, totalPieces, totalM2, avgCoverageDays, loadedPieces,
}) => {
  const [clientFilter, setClientFilter] = useState<string>('ALL');

  const clients = useMemo(() => {
    const set = new Set(results.map(r => r.client));
    return ['ALL', ...Array.from(set).sort()];
  }, [results]);

  const filteredResults = useMemo(() => {
    if (clientFilter === 'ALL') return results;
    return results.filter(r => r.client === clientFilter);
  }, [results, clientFilter]);

  // Aggregations
  const byClient = useMemo(() => aggregateByClient(results), [results]);
  const byStage = useMemo(() => aggregateByStage(filteredResults), [filteredResults]);
  const byFamily = useMemo(() => aggregateByFamily(filteredResults), [filteredResults]);

  // Pie data for space by client
  const clientPieData = useMemo(() =>
    byClient.map(r => ({ name: r.label, value: Math.round(r.m2 * 10) / 10, pct: r.pctSpace })),
  [byClient]);

  // Bar data for containers by family
  const familyBarData = useMemo(() =>
    byFamily.map(r => ({ name: r.label, contenedores: r.containers, m2: Math.round(r.m2 * 10) / 10 })),
  [byFamily]);

  // Bar data for containers by stage
  const stageBarData = useMemo(() =>
    byStage.map(r => ({ name: r.label, contenedores: r.containers, piezas: r.pieces })),
  [byStage]);

  // Top 10 pieces by containers
  const top10 = useMemo(() => {
    const sorted = [...filteredResults].sort((a, b) => b.containers - a.containers);
    return sorted.slice(0, 10).map(r => ({
      name: r.pieceCode,
      desc: r.description.length > 30 ? r.description.slice(0, 30) + '...' : r.description,
      containers: r.containers,
      m2: Math.round(r.m2FloorTotal * 10) / 10,
      client: r.client,
    }));
  }, [filteredResults]);

  // Filtered totals
  const fTotals = useMemo(() => {
    const fr = filteredResults;
    return {
      containers: fr.reduce((s, r) => s + r.containers, 0),
      pieces: fr.reduce((s, r) => s + r.inventoryPcs, 0),
      m2: fr.reduce((s, r) => s + r.m2FloorTotal, 0),
      count: fr.length,
    };
  }, [filteredResults]);

  return (
    <div className="space-y-6">
      {/* Header + Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-700">Dashboard</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {loadedPieces} piezas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-400 focus:outline-none"
          >
            {clients.map(c => (
              <option key={c} value={c}>{c === 'ALL' ? 'Todos los clientes' : c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Contenedores', value: fTotals.containers.toLocaleString('es-AR'), color: 'emerald' },
          { label: 'Inventario (pzs)', value: fTotals.pieces.toLocaleString('es-AR'), color: 'blue' },
          { label: 'Espacio (m\u00B2)', value: `${fTotals.m2.toFixed(1)}`, color: 'amber' },
          { label: 'Cobertura Prom.', value: `${avgCoverageDays.toFixed(1)} dias`, color: 'purple' },
        ].map(kpi => (
          <div key={kpi.label} className={`rounded-xl border p-3 bg-${kpi.color}-50 border-${kpi.color}-200`}>
            <p className={`text-xs font-medium uppercase text-${kpi.color}-600 opacity-80`}>{kpi.label}</p>
            <p className={`text-xl font-bold tabular-nums text-${kpi.color}-700 mt-0.5`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Pie + Stage Bar */}
      <div className="grid grid-cols-2 gap-4">
        {/* Space by Client — Pie */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Espacio por Cliente (m\u00B2)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={clientPieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={renderLabel}
                labelLine={false}
              >
                {clientPieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)} m\u00B2`, 'Espacio']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Containers by Stage — Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Contenedores por Etapa</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageBarData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="contenedores" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Family Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Espacio por Familia (m\u00B2)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={familyBarData} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="contenedores" fill="#2563eb" radius={[4, 4, 0, 0]} name="Contenedores" />
            <Bar dataKey="m2" fill="#d97706" radius={[4, 4, 0, 0]} name="m\u00B2 Piso" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 10 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">
          Top 10 Piezas por Contenedores
          {clientFilter !== 'ALL' && <span className="text-xs text-slate-400 font-normal ml-2">({clientFilter})</span>}
        </h3>
        <div className="space-y-1.5">
          {top10.map((item, i) => {
            const maxContainers = top10[0]?.containers || 1;
            const pct = (item.containers / maxContainers) * 100;
            return (
              <div key={`${item.name}-${i}`} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-5 text-right tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-mono font-medium text-slate-700 truncate">{item.name}</span>
                    <span className="text-xs text-slate-400 truncate">{item.desc}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">{item.client}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold tabular-nums text-slate-700">{item.containers.toLocaleString('es-AR')}</span>
                  <span className="text-xs text-slate-400 ml-1">{item.m2} m\u00B2</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

import React from 'react';

interface Props {
  level: 'high' | 'medium' | 'ok';
  days: number;
  compact?: boolean;
}

const CONFIG = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Alto' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Medio' },
  ok: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'OK' },
};

export const CoverageIndicator: React.FC<Props> = ({ level, days, compact }) => {
  const c = CONFIG[level];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded tabular-nums ${c.bg} ${c.text}`}>
        {days.toFixed(1)}d
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md border ${c.bg} ${c.text} ${c.border}`}>
      <span className="tabular-nums">{days.toFixed(1)} dias</span>
      <span className="opacity-70">({c.label})</span>
    </span>
  );
};

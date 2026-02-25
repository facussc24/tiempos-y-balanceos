
import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, children, className = "", actions }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden transition-all duration-200 hover:shadow-md ${className}`}>
      {(title || actions) && (
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
          {title && <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'slate' }> = ({ children, color = 'blue' }) => {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    red: 'bg-red-50 text-red-700 border border-red-200',
    yellow: 'bg-amber-50 text-amber-700 border border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
    slate: 'bg-slate-100 text-slate-600 border border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${colors[color]}`}>
      {children}
    </span>
  );
};

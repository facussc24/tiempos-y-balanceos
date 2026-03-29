import React from 'react';
import { Lightbulb, TrendingUp, CheckCircle, ArrowRight } from 'lucide-react';
import { ImprovementInsight } from '../logic/optimizationAnalysis';

interface Props {
    insight: ImprovementInsight | null;
}

export const SmartInsight: React.FC<Props> = ({ insight }) => {
    if (!insight) return null;

    const getColors = () => {
        switch (insight.type) {
            case 'ADD_OPERATOR':
                return 'bg-violet-50 border-violet-200 text-violet-900 border-l-4 border-l-violet-500';
            case 'ADD_CAVITY':
                return 'bg-blue-50 border-blue-200 text-blue-900 border-l-4 border-l-blue-500';
            case 'OPTIMAL':
                return 'bg-emerald-50 border-emerald-200 text-emerald-900 border-l-4 border-l-emerald-500';
            default:
                return 'bg-slate-50 border-slate-200 text-slate-800';
        }
    };

    const getIcon = () => {
        switch (insight.type) {
            case 'ADD_OPERATOR':
                return <TrendingUp size={20} className="text-violet-600" />;
            case 'ADD_CAVITY':
                return <Lightbulb size={20} className="text-blue-600" />;
            case 'OPTIMAL':
                return <CheckCircle size={20} className="text-emerald-600" />;
            default:
                return <Lightbulb size={20} />;
        }
    };

    return (
        <div className={`rounded-r-lg p-4 mb-4 border shadow-sm flex items-start gap-4 transition-all animate-in fade-in slide-in-from-top-2 ${getColors()}`}>
            <div className="mt-0.5 bg-white p-1.5 rounded-full shadow-sm border border-black/5">
                {getIcon()}
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-sm mb-1">{insight.title}</h4>
                <p className="text-xs opacity-90 leading-relaxed">
                    {insight.description}
                </p>
                {insight.actionLabel && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider bg-white/50 px-2 py-1 rounded border border-black/5">
                        <ArrowRight size={10} />
                        Sugerencia: {insight.actionLabel}
                    </div>
                )}
            </div>
            {insight.impactPercentage > 0 && (
                <div className="text-center bg-white/40 rounded-lg p-2 border border-black/5 min-w-[60px]">
                    <span className="block text-xl font-black">{Math.floor(insight.impactPercentage)}%</span>
                    <span className="text-[9px] font-bold uppercase block opacity-60 leading-none">Mejora</span>
                </div>
            )}
        </div>
    );
};

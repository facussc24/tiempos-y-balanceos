/**
 * StatCard - Enhanced stat display for Dashboard
 * @version 6.1.0 - Landing Page Redesign
 */
import React from 'react';

interface StatCardProps {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: number;
    gradient: 'blue' | 'purple' | 'emerald' | 'amber';
}

const gradientMap = {
    blue: 'from-blue-500 to-cyan-500',
    purple: 'from-purple-500 to-pink-500',
    emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500'
};

export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, gradient }) => {
    return (
        <div className="stat-card group">
            <div className={`stat-card-icon bg-gradient-to-br ${gradientMap[gradient]}`}>
                <Icon size={24} className="text-white" />
            </div>
            <div className="mt-3">
                <p className="text-3xl font-bold text-slate-800">{value}</p>
                <p className="text-sm text-slate-500 font-medium">{label}</p>
            </div>
        </div>
    );
};

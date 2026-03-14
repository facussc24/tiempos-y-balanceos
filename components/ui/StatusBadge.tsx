/**
 * StatusBadge Component
 * 
 * Unified badge component for displaying status indicators.
 * Consistent colors and sizes across the application.
 * 
 * @module StatusBadge
 * @version 1.0.0
 */

import React from 'react';
import { Check, X, AlertTriangle, Clock, Loader2, Info, Circle } from 'lucide-react';

export type BadgeStatus =
    | 'success'
    | 'error'
    | 'warning'
    | 'info'
    | 'pending'
    | 'loading'
    | 'neutral';

export type BadgeSize = 'xs' | 'sm' | 'md';

interface StatusBadgeProps {
    status: BadgeStatus;
    label?: string;
    showIcon?: boolean;
    size?: BadgeSize;
    pulse?: boolean;
    className?: string;
}

/**
 * Status configuration with colors and icons
 */
const STATUS_CONFIG: Record<BadgeStatus, {
    bg: string;
    text: string;
    border?: string;
    icon: React.ReactNode;
}> = {
    success: {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: <Check size={12} strokeWidth={3} />
    },
    error: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: <X size={12} strokeWidth={3} />
    },
    warning: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: <AlertTriangle size={12} />
    },
    info: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: <Info size={12} />
    },
    pending: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: <Clock size={12} />
    },
    loading: {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-100',
        icon: <Loader2 size={12} className="animate-spin" />
    },
    neutral: {
        bg: 'bg-slate-50',
        text: 'text-slate-500',
        border: 'border-slate-100',
        icon: <Circle size={8} />
    }
};

const SIZES: Record<BadgeSize, {
    padding: string;
    text: string;
    gap: string;
}> = {
    xs: { padding: 'px-1.5 py-0.5', text: 'text-[10px]', gap: 'gap-1' },
    sm: { padding: 'px-2 py-0.5', text: 'text-xs', gap: 'gap-1' },
    md: { padding: 'px-2.5 py-1', text: 'text-sm', gap: 'gap-1.5' }
};

/**
 * StatusBadge Component
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    label,
    showIcon = true,
    size = 'sm',
    pulse = false,
    className = ''
}) => {
    const config = STATUS_CONFIG[status];
    const sizeConfig = SIZES[size];

    return (
        <span
            className={`
                inline-flex items-center ${sizeConfig.gap}
                ${sizeConfig.padding} ${sizeConfig.text}
                ${config.bg} ${config.text}
                border ${config.border || ''}
                rounded-full font-medium
                ${pulse ? 'animate-pulse' : ''}
                ${className}
            `.trim().replace(/\s+/g, ' ')}
        >
            {showIcon && config.icon}
            {label && <span>{label}</span>}
        </span>
    );
};

/**
 * Quick status indicator (dot only)
 */
const STATUS_LABELS: Record<BadgeStatus, string> = {
    success: 'Exitoso',
    error: 'Error',
    warning: 'Advertencia',
    info: 'Información',
    pending: 'Pendiente',
    loading: 'Cargando',
    neutral: 'Neutro'
};

export const StatusDot: React.FC<{
    status: BadgeStatus;
    size?: 'sm' | 'md' | 'lg';
    pulse?: boolean;
    className?: string;
}> = ({ status, size = 'sm', pulse = false, className = '' }) => {
    const dotColors: Record<BadgeStatus, string> = {
        success: 'bg-emerald-500 ring-2 ring-emerald-200',
        error: 'bg-red-500 ring-2 ring-red-200',
        warning: 'bg-amber-500 ring-2 ring-amber-200',
        info: 'bg-blue-500',
        pending: 'bg-slate-400',
        loading: 'bg-blue-400',
        neutral: 'bg-slate-300'
    };

    const sizes = {
        sm: 'w-2 h-2',
        md: 'w-2.5 h-2.5',
        lg: 'w-3 h-3'
    };

    return (
        <span
            role="status"
            aria-label={STATUS_LABELS[status]}
            className={`
                ${sizes[size]} rounded-full ${dotColors[status]}
                ${pulse ? 'animate-pulse' : ''}
                ${className}
            `.trim().replace(/\s+/g, ' ')}
        />
    );
};

/**
 * Metric badge for displaying KPIs
 */
export const MetricBadge: React.FC<{
    value: string | number;
    label?: string;
    trend?: 'up' | 'down' | 'neutral';
    status?: BadgeStatus;
    className?: string;
}> = ({ value, label, trend, status = 'neutral', className = '' }) => {
    const config = STATUS_CONFIG[status];

    const trendIndicator = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
    const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : '';

    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            <span className={`text-lg font-bold ${config.text}`}>
                {value}
                {trend && <span className={`ml-1 text-xs ${trendColor}`}>{trendIndicator}</span>}
            </span>
            {label && <span className="text-xs text-slate-500">{label}</span>}
        </div>
    );
};

export default StatusBadge;

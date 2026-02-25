/**
 * Standardized Button Component
 * 
 * Unified button component with consistent styling across the application.
 * Supports multiple variants, sizes, and states.
 * 
 * @module Button
 * @version 1.0.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
}

/**
 * Design tokens for consistent styling
 */
const VARIANTS: Record<ButtonVariant, string> = {
    primary: `
        bg-blue-600 text-white shadow-sm
        hover:bg-blue-700 hover:shadow-md
        active:bg-blue-800
        focus:ring-blue-500/30
        disabled:bg-blue-300 disabled:shadow-none
    `,
    secondary: `
        bg-slate-100 text-slate-700 
        hover:bg-slate-200 
        active:bg-slate-300
        focus:ring-slate-500/20
        disabled:bg-slate-50 disabled:text-slate-400
    `,
    danger: `
        bg-red-600 text-white 
        hover:bg-red-700 
        active:bg-red-800
        focus:ring-red-500/30
        disabled:bg-red-300
    `,
    ghost: `
        bg-transparent text-slate-600 
        hover:bg-slate-100 hover:text-slate-900
        active:bg-slate-200
        focus:ring-slate-500/20
        disabled:text-slate-300
    `,
    outline: `
        bg-transparent text-blue-600 border-2 border-blue-600
        hover:bg-blue-50 
        active:bg-blue-100
        focus:ring-blue-500/30
        disabled:border-blue-200 disabled:text-blue-200
    `
};

const SIZES: Record<ButtonSize, {
    padding: string;
    text: string;
    icon: number;
    gap: string;
}> = {
    xs: { padding: 'px-2 py-1', text: 'text-xs', icon: 12, gap: 'gap-1' },
    sm: { padding: 'px-3 py-1.5', text: 'text-sm', icon: 14, gap: 'gap-1.5' },
    md: { padding: 'px-4 py-2', text: 'text-sm', icon: 16, gap: 'gap-2' },
    lg: { padding: 'px-5 py-2.5', text: 'text-base', icon: 18, gap: 'gap-2' }
};

/**
 * Button Component
 */
export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    disabled,
    className = '',
    children,
    ...props
}) => {
    const sizeConfig = SIZES[size];
    const isDisabled = disabled || loading;

    const iconElement = loading ? (
        <Loader2 size={sizeConfig.icon} className="animate-spin" />
    ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
    ) : null;

    return (
        <button
            disabled={isDisabled}
            className={`
                inline-flex items-center justify-center
                ${sizeConfig.padding} ${sizeConfig.text} ${sizeConfig.gap}
                font-medium rounded-lg
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-offset-1
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-70
                ${VARIANTS[variant]}
                ${fullWidth ? 'w-full' : ''}
                ${className}
            `.trim().replace(/\s+/g, ' ')}
            {...props}
        >
            {iconPosition === 'left' && iconElement}
            {children}
            {iconPosition === 'right' && iconElement}
        </button>
    );
};

/**
 * Icon-only Button
 */
export const IconButton: React.FC<Omit<ButtonProps, 'children'> & {
    'aria-label': string;
}> = ({
    variant = 'ghost',
    size = 'md',
    loading = false,
    icon,
    disabled,
    className = '',
    ...props
}) => {
        const sizeConfig = SIZES[size];
        const isDisabled = disabled || loading;

        const iconSizes: Record<ButtonSize, string> = {
            xs: 'w-6 h-6',
            sm: 'w-8 h-8',
            md: 'w-9 h-9',
            lg: 'w-10 h-10'
        };

        return (
            <button
                disabled={isDisabled}
                className={`
                inline-flex items-center justify-center
                ${iconSizes[size]}
                rounded-lg
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-offset-1
                active:scale-95
                disabled:cursor-not-allowed disabled:opacity-70
                ${VARIANTS[variant]}
                ${className}
            `.trim().replace(/\s+/g, ' ')}
                {...props}
            >
                {loading ? (
                    <Loader2 size={sizeConfig.icon} className="animate-spin" />
                ) : (
                    icon
                )}
            </button>
        );
    };

export default Button;

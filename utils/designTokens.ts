/**
 * Design Tokens
 * 
 * Centralized design system tokens for consistent UI across the application.
 * Use these values instead of hardcoding colors, spacing, etc.
 * 
 * @module designTokens
 * @version 1.0.0
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const colors = {
    // Primary brand colors
    primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',  // Main primary
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a'
    },

    // Semantic colors
    success: {
        light: '#d1fae5',
        main: '#10b981',
        dark: '#059669',
        text: '#065f46'
    },

    warning: {
        light: '#fef3c7',
        main: '#f59e0b',
        dark: '#d97706',
        text: '#92400e'
    },

    error: {
        light: '#fee2e2',
        main: '#ef4444',
        dark: '#dc2626',
        text: '#991b1b'
    },

    info: {
        light: '#dbeafe',
        main: '#3b82f6',
        dark: '#2563eb',
        text: '#1e40af'
    },

    // Neutral grays
    slate: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a'
    }
} as const;

// =============================================================================
// SPACING SCALE (based on 4px grid)
// =============================================================================

export const spacing = {
    0: '0',
    0.5: '2px',
    1: '4px',
    1.5: '6px',
    2: '8px',
    2.5: '10px',
    3: '12px',
    3.5: '14px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    9: '36px',
    10: '40px',
    12: '48px',
    14: '56px',
    16: '64px',
    20: '80px',
    24: '96px'
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
    fontFamily: {
        sans: 'Inter, system-ui, -apple-system, sans-serif',
        mono: 'JetBrains Mono, Menlo, Monaco, monospace'
    },

    fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
        sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
        base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
        lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }] // 30px
    },

    fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700
    }
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const borderRadius = {
    none: '0',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    '2xl': '16px',
    full: '9999px'
} as const;

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
} as const;

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

export const zIndex = {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    toast: 9999
} as const;

// =============================================================================
// TRANSITIONS
// =============================================================================

export const transitions = {
    fast: '150ms ease-out',
    normal: '200ms ease-out',
    slow: '300ms ease-out',

    // Common combinations
    colors: 'color 150ms, background-color 150ms, border-color 150ms',
    transform: 'transform 200ms ease-out',
    all: 'all 200ms ease-out'
} as const;

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
} as const;

// =============================================================================
// COMPONENT-SPECIFIC TOKENS
// =============================================================================

export const components = {
    button: {
        borderRadius: borderRadius.lg,
        fontWeight: typography.fontWeight.medium,
        transition: transitions.normal
    },

    card: {
        borderRadius: borderRadius.xl,
        shadow: shadows.sm,
        padding: spacing[6]
    },

    input: {
        borderRadius: borderRadius.lg,
        borderColor: colors.slate[200],
        focusBorderColor: colors.primary[500]
    },

    badge: {
        borderRadius: borderRadius.full,
        fontWeight: typography.fontWeight.medium
    },

    tooltip: {
        borderRadius: borderRadius.lg,
        background: colors.slate[900],
        zIndex: zIndex.tooltip
    }
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get a color value from the palette
 */
export function getColor(path: string): string {
    const parts = path.split('.');
    let result: any = colors;
    for (const part of parts) {
        result = result[part];
        if (!result) return path;
    }
    return result;
}

/**
 * Create a consistent focus ring style
 */
export function focusRing(color = 'primary'): string {
    return `focus:outline-none focus:ring-2 focus:ring-${color}-500/30 focus:ring-offset-1`;
}

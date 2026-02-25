/**
 * Shared Constants
 * 
 * Centralized constants used across Mix Mode and other modules
 * @module constants
 * @version 5.0.0 - MEJORA-01: Expanded with all magic numbers
 */

// ============================================================================
// PRODUCT COLORS (Mix Mode)
// ============================================================================

// Color palette for product visualization in Mix Mode
export const PRODUCT_COLORS = [
    '#3B82F6', // Blue
    '#F97316', // Orange
    '#10B981', // Green
    '#8B5CF6', // Purple
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#EC4899', // Pink
    '#84CC16', // Lime
];

// Sector colors (default)
export const SECTOR_COLORS = {
    COSTURA: '#10B981',
    INYECCION: '#F97316',
    EMBALAJE: '#6366F1',
    TAPIZADO: '#8B5CF6',
    DEFAULT: '#6B7280'
};

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULTS = {
    /** OEE objetivo estándar (0-1) */
    OEE: 0.85,

    /** Demanda diaria inicial */
    DAILY_DEMAND: 1000,

    /** Número de turnos activos por defecto */
    ACTIVE_SHIFTS: 1,

    /** Minutos de turno cuando no hay configuración */
    SHIFT_MINUTES_FALLBACK: 480,

    /** Horas de turno cuando no hay configuración */
    SHIFT_HOURS_FALLBACK: 8,
} as const;

// ============================================================================
// MIX MODE THRESHOLDS
// ============================================================================

// Thresholds
export const MIX_THRESHOLDS = {
    MIN_SATURATION: 0.15,      // 15% for Mizusumashi detection
    HIGH_SATURATION: 0.95,     // 95% warning threshold
    CRITICAL_SATURATION: 1.0,  // 100% overload
};

// Balance Efficiency Factor (OBE - Objective Balance Efficiency)
// Industry standard: 85% accounts for mix variability, micro-stops, mental setup
export const MIX_BALANCE_EFFICIENCY = 0.85;

// Takt Violation Threshold (10% over Takt triggers alert)
export const TAKT_VIOLATION_THRESHOLD = 1.10;

// ============================================================================
// SIMULATION CONSTANTS
// ============================================================================

export const SIMULATION = {
    /** Tamaño de lote para procesamiento por batch */
    BATCH_SIZE: 1000,

    /** Iteraciones por defecto para Monte Carlo */
    DEFAULT_ITERATIONS: 1000,

    /** Porcentaje de variabilidad fallback cuando no hay stdDev */
    VARIABILITY_FALLBACK_PERCENT: 0.05,

    /** Umbral para considerar alta iteración (warning) */
    HIGH_ITERATIONS_THRESHOLD: 5000,

    /** Máximo de variabilidad fallback permitido */
    MAX_VARIABILITY_FALLBACK: 0.30,
} as const;

// ============================================================================
// PCE (Process Cycle Efficiency) THRESHOLDS
// ============================================================================

export const PCE_THRESHOLDS = {
    /** PCE considerado "World Class" */
    WORLD_CLASS: 25,

    /** PCE considerado "Lean Avanzado" */
    LEAN_ADVANCED: 15,

    /** PCE considerado "Lean Intermedio" */
    LEAN_INTERMEDIATE: 5,
} as const;

// ============================================================================
// RISK THRESHOLDS (for Monte Carlo simulation)
// ============================================================================

export const RISK_THRESHOLDS = {
    /** % de riesgo para mostrar verde */
    GREEN_MAX: 5,

    /** % de riesgo para mostrar amarillo */
    YELLOW_MAX: 15,

    /** Sobrecarga de estación para mostrar warning (factor del takt) */
    STATION_OVERLOAD_WARNING: 1.10,
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

export const UI = {
    /** Z-index para tooltips */
    Z_INDEX_TOOLTIP: 100,

    /** Z-index para modales */
    Z_INDEX_MODAL: 200,

    /** Z-index para toasts */
    Z_INDEX_TOAST: 300,

    /** Duración de animación toast (ms) */
    TOAST_DURATION_MS: 6000,

    /** Duración de success toast (ms) */
    SUCCESS_TOAST_DURATION_MS: 4000,
} as const;

// ============================================================================
// VSM COLORS
// ============================================================================

export const VSM_COLORS = {
    VA: '#1e40af',       // Value Added (blue)
    NVA: '#ea580c',      // Non Value Added (orange)
    INVENTORY: '#eab308', // Inventory (yellow)
    TEAL: '#0d9488',      // Teal accent
} as const;

// ============================================================================
// STATUS COLORS
// ============================================================================

export const STATUS_COLORS = {
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    INFO: '#3b82f6',
} as const;

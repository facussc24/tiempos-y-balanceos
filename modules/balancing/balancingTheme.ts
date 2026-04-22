/**
 * @module balancingTheme
 *
 * Tokens de color del modulo balanceo. Centralizar aca los hex literales
 * previene drift visual entre grafico Recharts, canvas Excel export, y
 * badges/alerts inline.
 *
 * Para clases Tailwind (text-status-crit, bg-red-50) se sigue usando
 * directamente en el JSX — este archivo es solo para hex literales que
 * necesitan consumirse desde JS (ej: recharts fill, canvas fillStyle).
 */

/** Colores usados en el canvas de export Excel del grafico de capacidad. */
export const CAPACITY_CHART_COLORS = {
  /** Barra normal: dentro del limite OEE */
  bar: '#3b82f6',        // blue-500
  /** Sobrecarga: supera Takt */
  overload: '#ef4444',   // red-500
  /** Zona warning: supera OEE pero dentro de Takt */
  warning: '#f59e0b',    // amber-500
  /** Referencia Takt Time */
  taktLine: '#dc2626',   // red-600
  /** Referencia limite OEE */
  oeeLine: '#10b981',    // emerald-500
  /** Texto / ejes */
  text: '#64748b',       // slate-500
} as const;

/** Colores de sector "General / Sin Sector" y fallbacks. */
export const SECTOR_FALLBACK_COLOR = '#64748b'; // slate-500

/** Color para tooltip "Tiempo Disponible" en BalancingChart (recharts fill). */
export const TOOLTIP_IDLE_COLOR = '#64748b'; // slate-500

/**
 * @module balancingConstants
 *
 * Constantes de negocio del modulo Tiempos y Balanceos.
 *
 * Centralizar aca evita que los umbrales de saturacion, feasibility, y
 * dimensiones de canvas para export Excel queden esparcidos en 5+ archivos.
 * Si la regla de negocio cambia (ej: rango ideal de utilizacion pasa de 85-100
 * a 80-95), se edita en un solo lugar.
 */

// -----------------------------------------------------------------------------
// Umbrales de saturacion / utilizacion
// -----------------------------------------------------------------------------

/**
 * Utilizacion minima considerada "saludable" (0-1).
 * Debajo: capacidad ociosa, se sugiere reducir operarios.
 */
export const SATURATION_MIN = 0.85;

/**
 * Saturacion promedio por sector a partir de la cual se pinta alerta amarilla
 * en el board de estaciones.
 */
export const SATURATION_WARN = 0.90;

/**
 * Ratio ciclo/Takt a partir del cual el estado del balance se marca
 * "No Factible" (XCircle rojo). Entre 1.00 y este valor es "Riesgo".
 */
export const CYCLE_RISK_THRESHOLD = 1.05;

/**
 * Smoothness Index (SI) maximo considerado "parejo" (0-N).
 * <= este valor: carga uniforme entre estaciones.
 */
export const SMOOTHNESS_OK = 10;

/**
 * Smoothness Index a partir del cual la linea se considera muy despareja.
 * Entre SMOOTHNESS_OK y este valor es "algo despareja".
 */
export const SMOOTHNESS_WARN = 30;

// -----------------------------------------------------------------------------
// Version "porcentaje" (0-100) — para comparar contra saturationVsTakt
// -----------------------------------------------------------------------------

/** Utilizacion minima saludable expresada como porcentaje (85). */
export const SATURATION_MIN_PCT = SATURATION_MIN * 100;

/** Umbral de sobrecarga expresado como porcentaje (100). */
export const SATURATION_OVERLOAD_PCT = 100;

// -----------------------------------------------------------------------------
// Dimensiones del canvas para export Excel (capacityBarChart.ts)
// -----------------------------------------------------------------------------

/** Ancho por defecto del canvas del grafico de capacidad (px). */
export const CAPACITY_CANVAS_WIDTH = 900;

/** Altura por defecto del canvas del grafico de capacidad (px). */
export const CAPACITY_CANVAS_HEIGHT = 400;

/**
 * Maximo de estaciones visibles en el grafico de capacidad exportado.
 * Mas que esto se truncan con un indicador "..." en el eje X.
 */
export const CAPACITY_MAX_STATIONS = 30;

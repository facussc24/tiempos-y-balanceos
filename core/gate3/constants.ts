/**
 * Constantes del estandar VW Gate 3 Capacity Check (SFN / PCA).
 * Origen: formato oficial Grupo Volkswagen para verificacion de capacidad de proveedor.
 */

/** Semanas laborales por anio en estandar VW (52 menos 4 de paradas/vacaciones). */
export const VW_WEEKS_PER_YEAR = 48;

/** Margen de flexibilidad obligatorio del Grupo VW (15% sobre demanda nominal). */
export const VW_FLEXIBILITY = 0.15;

/** Maxima cantidad de estaciones soportadas por el formato Gate 3 (12 = 3 bloques x 4). */
export const GATE3_MAX_STATIONS = 12;

/** Defaults razonables para una estacion nueva. */
export const STATION_DEFAULTS = {
    observationTimeMin: 480, // 1 turno de 8 h
    cycleTimeSec: 0,
    cavities: 1,
    downtimeMin: 0,
    okParts: 0,
    nokParts: 0,
    shiftsPerWeek: 15, // base estandar VW
    hoursPerShift: 8,
    reservationPct: 1, // 100% reservado al proyecto por default
    machines: 1,
} as const;

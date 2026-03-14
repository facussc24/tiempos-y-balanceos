/**
 * Mizusumashi Logic Module - Water Spider / Milk Run Route Calculations
 * Phase 3: Lean Logistics Suite
 * 
 * This module calculates the logistics route timing for internal material handling.
 * The key concept is the PITCH - the rhythm at which the water spider must complete cycles.
 * 
 * Formula: Pitch = Takt Time × Pack-Out Quantity
 * 
 * If the route takes longer than the Pitch, operators will run out of material.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RouteStop {
    /** Station ID from VSM */
    stationId: number;

    /** Station name for display */
    stationName: string;

    /** Walking time to this stop from previous (seconds) */
    walkTimeSeconds: number;

    /** Optional: Distance in meters (used to auto-calculate walkTimeSeconds) */
    distanceMeters?: number;

    /** Time to handle boxes at this stop - load/unload (seconds) */
    handlingTimeSeconds: number;

    /** Number of boxes to exchange at this stop */
    boxCount: number;

    /** Arrival time (calculated) */
    arrivalTime?: string;
}

export interface MizusumashiRoute {
    /** Unique route identifier */
    id: string;

    /** Route name (e.g., "Ruta A - Línea 1") */
    name: string;

    /** List of stops in order */
    stops: RouteStop[];

    /** Start time of first cycle (e.g., "08:00") */
    startTime: string;

    /** Calculated pitch in minutes */
    pitchMinutes: number;

    /** Calculated route time in minutes */
    routeTimeMinutes: number;
}

export interface MizusumashiResult {
    /** Pitch = Takt × PackOut (in minutes) */
    pitchMinutes: number;

    /** Total route cycle time (in minutes) */
    routeTimeMinutes: number;

    /** Whether the route can be completed in time */
    isRouteFeasible: boolean;

    /** Utilization = RouteTime / Pitch (1.0 = 100%) */
    utilizationPercent: number;

    /** Time margin (positive = good, negative = exceeds pitch) */
    marginMinutes: number;

    /** Calculated schedule of stops with times */
    schedule: RouteScheduleItem[];

    /** Number of mizusumashis needed (if route exceeds pitch) */
    mizusumashisNeeded: number;

    /** Validation result with suggestions */
    validation: RouteValidation;
}

export interface RouteScheduleItem {
    /** Stop order (0 = start at warehouse) */
    order: number;

    /** Station name */
    stationName: string;

    /** Arrival time (HH:MM format) */
    arrivalTime: string;

    /** Action at stop */
    action: string;

    /** Box count to handle */
    boxCount: number;

    /** Cumulative time from start (minutes) */
    cumulativeMinutes: number;
}

export interface RouteValidation {
    /** Route can be completed within pitch */
    isFeasible: boolean;

    /** Alert level: 'ok' | 'warning' | 'critical' */
    alertLevel: 'ok' | 'warning' | 'critical';

    /** Human-readable message */
    message: string;

    /** Suggestions for improvement */
    suggestions: string[];
}

// ============================================================================
// v2.0: LOOP INVENTORY & FREQUENCY VALIDATION
// ============================================================================

/**
 * Resultado del cálculo de inventario en el loop logístico.
 * 
 * El "Loop" es la cantidad de cajas que deben estar rotando en el sistema
 * (línea + tránsito) para que nunca pare la producción.
 */
export interface LoopInventoryResult {
    /** Total de cajas necesarias en el loop */
    totalLoopBoxes: number;

    /** Cajas que estarán en la línea de producción */
    boxesInLine: number;

    /** Cajas que estarán en tránsito (Milk Run) */
    boxesInTransit: number;

    /** Caja de seguridad (+1 regla) */
    safetyBox: number;

    /** Pitch calculado en minutos */
    pitchMinutes: number;

    /** Frecuencia configurada en minutos */
    frequencyMinutes: number;

    /** Alerta si frecuencia requiere mucho inventario */
    inventoryAlert: {
        level: 'ok' | 'warning' | 'critical';
        message: string;
    } | null;
}

/**
 * Validación de que la frecuencia del Milk Run es múltiplo del Pitch.
 * Frecuencias no múltiplos crean caos operativo.
 */
export interface FrequencyValidation {
    /** Frecuencia es válida (múltiplo del Pitch) */
    isValid: boolean;

    /** Ratio frecuencia/pitch */
    ratio: number;

    /** Frecuencias sugeridas que sí son múltiplos */
    suggestedFrequencies: number[];

    /** Mensaje de advertencia si no es válida */
    warning: string | null;
}

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Calculates the Pitch - the target cycle time for the water spider.
 * 
 * Pitch = Takt Time × Pack-Out Quantity
 * 
 * Example: If Takt is 60 seconds and boxes hold 20 pieces,
 * Pitch = 60 × 20 = 1200 seconds = 20 minutes
 * 
 * The water spider must complete a full route every 20 minutes.
 * 
 * @param taktTimeSeconds - Takt time in seconds (from project)
 * @param packOutQuantity - Pieces per container (from Kanban)
 * @returns Pitch in minutes
 */
export function calculatePitch(
    taktTimeSeconds: number,
    packOutQuantity: number
): number {
    if (taktTimeSeconds <= 0 || packOutQuantity <= 0) {
        return 0;
    }

    const pitchSeconds = taktTimeSeconds * packOutQuantity;
    return pitchSeconds / 60; // Convert to minutes
}

/**
 * Calculates the total route cycle time.
 *
 * Route Time = Σ(Walk Time + Handling Time) for all stops + Return Walk
 *
 * A complete milk run cycle must include the return trip from the last stop
 * back to the warehouse. Without it, route times are systematically underestimated
 * and the pitch compliance check becomes too optimistic.
 *
 * @param stops - Array of route stops
 * @param returnWalkTimeSeconds - Walk time from last stop back to warehouse (seconds).
 *        Defaults to 0 for backward compatibility. If not provided, assumes the first
 *        stop's walk time (symmetric route) when stops exist.
 * @returns Total route time in minutes
 */
export function calculateRouteTime(
    stops: RouteStop[],
    returnWalkTimeSeconds?: number
): number {
    if (!stops || stops.length === 0) {
        return 0;
    }

    const totalSeconds = stops.reduce((sum, stop) => {
        return sum + (stop.walkTimeSeconds || 0) + (stop.handlingTimeSeconds || 0);
    }, 0);

    // Add return trip: if explicit return time provided, use it;
    // otherwise assume symmetric route (return ≈ first stop's walk time from warehouse)
    const returnSeconds = returnWalkTimeSeconds !== undefined
        ? returnWalkTimeSeconds
        : (stops[0]?.walkTimeSeconds || 0);

    return (totalSeconds + returnSeconds) / 60;
}

/**
 * Validates whether a route can be completed within the pitch time.
 * 
 * @param pitchMinutes - Target cycle time
 * @param routeTimeMinutes - Actual route time
 * @returns Validation result with suggestions
 */
export function validateRoute(
    pitchMinutes: number,
    routeTimeMinutes: number
): RouteValidation {
    if (pitchMinutes <= 0) {
        return {
            isFeasible: false,
            alertLevel: 'critical',
            message: 'Pitch no configurado. Configura Takt Time y Piezas/Caja.',
            suggestions: ['Configurar Takt Time en el proyecto', 'Definir piezas por caja en Kanban']
        };
    }

    const utilization = routeTimeMinutes / pitchMinutes;
    const marginMinutes = pitchMinutes - routeTimeMinutes;

    if (utilization <= 0.7) {
        // Under 70% - lots of margin
        return {
            isFeasible: true,
            alertLevel: 'ok',
            message: `✅ Ruta OK - ${marginMinutes.toFixed(0)} min de margen`,
            suggestions: []
        };
    } else if (utilization <= 0.9) {
        // 70-90% - acceptable but tight
        return {
            isFeasible: true,
            alertLevel: 'warning',
            message: `⚠️ Ruta ajustada - Solo ${marginMinutes.toFixed(0)} min de margen`,
            suggestions: [
                'Considerar reducir tiempo de caminata',
                'Optimizar ubicación de materiales'
            ]
        };
    } else if (utilization <= 1.0) {
        // 90-100% - very tight
        return {
            isFeasible: true,
            alertLevel: 'warning',
            message: `⚠️ Ruta muy ajustada - Solo ${marginMinutes.toFixed(1)} min de margen`,
            suggestions: [
                'Riesgo de retrasos ante cualquier variación',
                'Preparar plan de contingencia'
            ]
        };
    } else {
        // Over 100% - route exceeds pitch
        const excessMinutes = routeTimeMinutes - pitchMinutes;
        const mizusumashisNeeded = Math.ceil(utilization);

        return {
            isFeasible: false,
            alertLevel: 'critical',
            message: `🔴 Ruta excede Pitch por ${excessMinutes.toFixed(0)} min`,
            suggestions: [
                `Dividir en ${mizusumashisNeeded} rutas`,
                'Añadir otro Mizusumashi',
                'Reducir número de paradas',
                'Acercar materiales a estaciones'
            ]
        };
    }
}

/**
 * Calculates the complete Mizusumashi analysis.
 * 
 * @param taktTimeSeconds - Takt time from project
 * @param packOutQuantity - Pieces per container from Kanban
 * @param stops - Route stops
 * @param startTime - Start time (HH:MM format)
 * @returns Complete analysis result
 */
export function calculateMizusumashi(
    taktTimeSeconds: number,
    packOutQuantity: number,
    stops: RouteStop[],
    startTime: string = '08:00'
): MizusumashiResult {
    const pitchMinutes = calculatePitch(taktTimeSeconds, packOutQuantity);
    const routeTimeMinutes = calculateRouteTime(stops);
    const validation = validateRoute(pitchMinutes, routeTimeMinutes);

    const utilization = pitchMinutes > 0 ? routeTimeMinutes / pitchMinutes : 0;
    const marginMinutes = pitchMinutes - routeTimeMinutes;
    const mizusumashisNeeded = utilization > 1 ? Math.ceil(utilization) : 1;

    // Build schedule
    const schedule = buildSchedule(stops, startTime);

    return {
        pitchMinutes,
        routeTimeMinutes,
        isRouteFeasible: validation.isFeasible,
        utilizationPercent: utilization * 100,
        marginMinutes,
        schedule,
        mizusumashisNeeded,
        validation
    };
}

// ============================================================================
// SCHEDULE BUILDER
// ============================================================================

/**
 * Builds a detailed schedule of stops with calculated arrival times.
 *
 * @param stops - Route stops
 * @param startTime - Start time (HH:MM format)
 * @param returnWalkTimeSeconds - Walk time from last stop back to warehouse (seconds).
 *        Defaults to first stop's walk time (symmetric route).
 * @returns Array of schedule items with calculated times
 */
export function buildSchedule(
    stops: RouteStop[],
    startTime: string,
    returnWalkTimeSeconds?: number
): RouteScheduleItem[] {
    const schedule: RouteScheduleItem[] = [];

    // Parse start time
    const [startHour, startMinute] = startTime.split(':').map(Number);
    let currentMinutes = startHour * 60 + startMinute;

    // First stop: Warehouse/Start
    schedule.push({
        order: 0,
        stationName: 'Almacén (Inicio)',
        arrivalTime: formatTime(currentMinutes),
        action: 'Cargar materiales',
        boxCount: stops.reduce((sum, s) => sum + s.boxCount, 0),
        cumulativeMinutes: 0
    });

    let cumulativeMinutes = 0;

    // Each stop
    stops.forEach((stop, index) => {
        // Walk to stop
        const walkMinutes = stop.walkTimeSeconds / 60;
        currentMinutes += walkMinutes;
        cumulativeMinutes += walkMinutes;

        // Handling at stop
        const handlingMinutes = stop.handlingTimeSeconds / 60;

        schedule.push({
            order: index + 1,
            stationName: stop.stationName,
            arrivalTime: formatTime(currentMinutes),
            action: `Cambiar ${stop.boxCount} ${stop.boxCount === 1 ? 'caja' : 'cajas'}`,
            boxCount: stop.boxCount,
            cumulativeMinutes: cumulativeMinutes
        });

        currentMinutes += handlingMinutes;
        cumulativeMinutes += handlingMinutes;
    });

    // Return walk to warehouse (symmetric default: same as first stop's walk from warehouse)
    const returnWalk = returnWalkTimeSeconds !== undefined
        ? returnWalkTimeSeconds
        : (stops[0]?.walkTimeSeconds || 0);
    const returnWalkMinutes = returnWalk / 60;
    currentMinutes += returnWalkMinutes;
    cumulativeMinutes += returnWalkMinutes;

    // Return to warehouse
    schedule.push({
        order: stops.length + 1,
        stationName: 'Almacén (Fin ciclo)',
        arrivalTime: formatTime(currentMinutes),
        action: '↻ Repetir',
        boxCount: 0,
        cumulativeMinutes: cumulativeMinutes
    });

    return schedule;
}

/**
 * Formats minutes since midnight to HH:MM format.
 */
function formatTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = Math.round(totalMinutes % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converts Takt Time from different units to seconds.
 */
export function taktToSeconds(
    value: number,
    unit: 'seconds' | 'minutes'
): number {
    return unit === 'minutes' ? value * 60 : value;
}

/**
 * Formats route time for display.
 */
export function formatRouteTime(minutes: number): string {
    if (minutes < 1) {
        return `${(minutes * 60).toFixed(0)} seg`;
    } else if (minutes < 60) {
        return `${minutes.toFixed(0)} min`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}min`;
    }
}

// ============================================================================
// v3.0: DISTANCE TO WALK TIME CALCULATOR
// ============================================================================

/**
 * Default walking speed in meters per second.
 * 1 m/s is the standard for safe plant walking (not rushing).
 * 
 * For reference:
 * - 0.8 m/s = Slow/careful walking (congested areas)
 * - 1.0 m/s = Normal plant walking (default)
 * - 1.2 m/s = Brisk walking (clear paths)
 */
export const DEFAULT_WALK_SPEED_MPS = 1.0;

/**
 * Calculates walk time from distance using a given walking speed.
 * 
 * Formula: Time (seconds) = Distance (meters) / Speed (m/s)
 * 
 * @param distanceMeters - Distance to walk in meters
 * @param speedMps - Walking speed in meters per second (default: 1 m/s)
 * @returns Walk time in seconds (rounded up)
 */
export function calculateWalkTimeFromDistance(
    distanceMeters: number,
    speedMps: number = DEFAULT_WALK_SPEED_MPS
): number {
    if (distanceMeters <= 0 || speedMps <= 0) return 0;
    return Math.ceil(distanceMeters / speedMps);
}

// ============================================================================
// v2.0: LOOP INVENTORY CALCULATION
// ============================================================================

/**
 * Calcula el inventario necesario en el loop logístico (Milk Run).
 * 
 * FÓRMULA DEL EXPERTO:
 * N_loop = ceil((2 × Frecuencia) / Pitch) + 1
 * 
 * Donde:
 * - 2× porque necesitas cubrir ida y vuelta del tren logístico
 * - Frecuencia = cada cuánto pasa el Milk Run (ej: 60 min)
 * - Pitch = Takt × Piezas/Caja (ritmo de consumo de cajas)
 * - +1 = caja de seguridad para cubrir variabilidad
 * 
 * EJEMPLO:
 * - Pitch = 10 min (se consume una caja cada 10 min)
 * - Frecuencia = 60 min (el tren pasa cada hora)
 * - N_loop = ceil((2 × 60) / 10) + 1 = ceil(12) + 1 = 13 cajas
 * - Distribución: 6 en línea, 6 en tránsito, 1 seguridad
 * 
 * @param milkRunFrequencyMinutes - Frecuencia del tren (ej: 60 min)
 * @param taktTimeSeconds - Takt Time en segundos
 * @param packOutQuantity - Piezas por caja
 * @returns Resultado detallado del inventario en el loop
 */
export function calculateLoopInventory(
    milkRunFrequencyMinutes: number,
    taktTimeSeconds: number,
    packOutQuantity: number
): LoopInventoryResult {
    // Calcular Pitch en minutos
    const pitchMinutes = calculatePitch(taktTimeSeconds, packOutQuantity);

    // Validar inputs
    if (pitchMinutes <= 0 || milkRunFrequencyMinutes <= 0) {
        return {
            totalLoopBoxes: 0,
            boxesInLine: 0,
            boxesInTransit: 0,
            safetyBox: 0,
            pitchMinutes: 0,
            frequencyMinutes: milkRunFrequencyMinutes,
            inventoryAlert: null
        };
    }

    // Fórmula del Loop: ceil((2 × Frecuencia) / Pitch) + 1
    const baseLoop = (2 * milkRunFrequencyMinutes) / pitchMinutes;
    const loopWithoutSafety = Math.ceil(baseLoop);
    const safetyBox = 1;
    const totalLoopBoxes = loopWithoutSafety + safetyBox;

    // Distribución: mitad en línea, mitad en tránsito
    const boxesInLine = Math.ceil(loopWithoutSafety / 2);
    const boxesInTransit = Math.floor(loopWithoutSafety / 2);

    // Alertas según cantidad de inventario
    let inventoryAlert: LoopInventoryResult['inventoryAlert'] = null;

    if (totalLoopBoxes > 20) {
        inventoryAlert = {
            level: 'critical',
            message: `¡Cuidado! Esta frecuencia requiere ${totalLoopBoxes} cajas en el loop. Sugerimos aumentar la frecuencia del Milk Run.`
        };
    } else if (totalLoopBoxes > 12) {
        inventoryAlert = {
            level: 'warning',
            message: `Frecuencia larga: ${totalLoopBoxes} cajas en el loop. Considere aumentar frecuencia.`
        };
    }

    return {
        totalLoopBoxes,
        boxesInLine,
        boxesInTransit,
        safetyBox,
        pitchMinutes,
        frequencyMinutes: milkRunFrequencyMinutes,
        inventoryAlert
    };
}

/**
 * Valida que la frecuencia del Milk Run sea múltiplo del Pitch.
 * 
 * REGLA DE ORO del experto:
 * La frecuencia debe ser un múltiplo del Pitch para mantener sincronía.
 * Números extraños (como 23 minutos cuando Pitch es 10) crean caos operativo.
 * 
 * @param frequencyMinutes - Frecuencia configurada del Milk Run
 * @param pitchMinutes - Pitch calculado
 * @returns Validación con sugerencias de frecuencias válidas
 */
export function validateFrequency(
    frequencyMinutes: number,
    pitchMinutes: number
): FrequencyValidation {
    if (pitchMinutes <= 0) {
        return {
            isValid: false,
            ratio: 0,
            suggestedFrequencies: [],
            warning: 'Pitch no configurado. Configura Takt Time y Piezas/Caja.'
        };
    }

    const ratio = frequencyMinutes / pitchMinutes;
    // Consideramos válido si está dentro del 10% de un múltiplo entero
    const isMultiple = Math.abs(ratio - Math.round(ratio)) < 0.1;

    // Sugerir frecuencias válidas (múltiplos del Pitch hasta 2 horas)
    const suggestedFrequencies: number[] = [];
    for (let multiplier = 1; multiplier <= 12; multiplier++) {
        const suggested = Math.round(pitchMinutes * multiplier);
        if (suggested <= 120) { // Max 2 horas
            suggestedFrequencies.push(suggested);
        }
    }

    return {
        isValid: isMultiple,
        ratio: Math.round(ratio * 10) / 10,
        suggestedFrequencies,
        warning: !isMultiple
            ? `La frecuencia ${frequencyMinutes} min no es múltiplo del Pitch ${pitchMinutes.toFixed(0)} min. Usar: ${suggestedFrequencies.slice(0, 4).join(', ')} min.`
            : null
    };
}

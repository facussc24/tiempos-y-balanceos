/**
 * Kanban Logic Module - Supermarket Dimensioning Calculations
 * Phase 2: Lean Logistics Suite
 * Version: 2.0 - Expert Lean Methodology
 * 
 * This module implements the standard Kanban formula for calculating
 * the optimal number of containers/bins in a supermarket system.
 * 
 * FORMULA MAESTRA (según metodología Lean):
 * 
 *   N = ceil((D × LT × (1 + SS)) / C) + 1
 * 
 * Where:
 * - N  = Number of Kanban cards/containers
 * - D  = Average demand (pieces per hour)
 * - LT = Lead Time TOTAL (orden + viaje + recepción + inspección + acomodo)
 * - SS = Safety Stock percentage (0.15 = 15%)
 * - C  = Container Capacity (pieces per bin)
 * - +1 = "Plus One Rule" - contenedor extra para continuidad
 * 
 * La REGLA DEL +1:
 * Si el proceso espera a que el cajón se vacíe por completo para 
 * enviar la señal de "pedir más", la fórmula necesita un +1.
 * Esto asegura que mientras el operario espera el nuevo material, 
 * todavía tenga ese último cajón para seguir trabajando.
 */

// ============================================================================
// TYPES - LEAD TIME BREAKDOWN
// ============================================================================

/**
 * Lead Time desglosado según metodología Lean.
 * 
 * IMPORTANTE: El tiempo total de reposición NO es solo el viaje del camión.
 * Debe sumar TODOS los componentes del flujo de abastecimiento.
 */
export interface LeadTimeBreakdown {
    /** Tiempo para procesar/generar la orden de compra (horas) */
    orderProcessingHours: number;

    /** Tiempo de viaje del proveedor hasta la planta (horas) */
    supplierTravelHours: number;

    /** Tiempo de recepción en almacén/dock (horas) */
    receptionHours: number;

    /** Tiempo de inspección de calidad (horas) */
    qualityInspectionHours: number;

    /** Tiempo de acomodo/ubicación en supermercado (horas) */
    putawayHours: number;
}

/**
 * Calcula el Lead Time total desde sus componentes.
 * 
 * @param breakdown - Desglose del Lead Time por etapa
 * @returns Lead Time total en horas
 */
export function calculateTotalLeadTime(breakdown: LeadTimeBreakdown): number {
    return (
        (breakdown.orderProcessingHours || 0) +
        (breakdown.supplierTravelHours || 0) +
        (breakdown.receptionHours || 0) +
        (breakdown.qualityInspectionHours || 0) +
        (breakdown.putawayHours || 0)
    );
}

// ============================================================================
// TYPES - SAFETY STOCK ADVANCED
// ============================================================================

/**
 * Cálculo avanzado de Stock de Seguridad basado en variabilidad estadística.
 * 
 * Fórmula: SS = Z × σ × √LT
 * 
 * Donde:
 * - Z  = Factor de nivel de servicio (tabla normal estándar)
 * - σ  = Desviación estándar de la demanda
 * - LT = Lead Time en días
 * 
 * Niveles de servicio típicos:
 * - 90% → Z = 1.28
 * - 95% → Z = 1.65 (recomendado para manufactura)
 * - 98% → Z = 2.05
 * - 99% → Z = 2.33 (industria automotriz)
 */
export interface SafetyStockAdvanced {
    /** Desviación estándar de la demanda diaria (piezas) */
    demandStdDev: number;

    /** Nivel de servicio deseado (0.95 = 95%) */
    serviceLevel: number;
}

/**
 * Obtiene el factor Z para un nivel de servicio dado.
 * Basado en la tabla de distribución normal estándar.
 * 
 * @param serviceLevel - Nivel de servicio (0.90, 0.95, 0.98, 0.99)
 * @returns Factor Z correspondiente
 */
export function getZFactor(serviceLevel: number): number {
    if (serviceLevel >= 0.99) return 2.33;
    if (serviceLevel >= 0.98) return 2.05;
    if (serviceLevel >= 0.95) return 1.65;
    if (serviceLevel >= 0.90) return 1.28;
    if (serviceLevel >= 0.85) return 1.04;
    return 1.0; // Default conservador
}

/**
 * Calcula Stock de Seguridad usando método estadístico.
 * 
 * SS = Z × σ × √LT
 * 
 * @param demandStdDev - Desviación estándar de la demanda diaria
 * @param leadTimeDays - Lead Time en días
 * @param serviceLevel - Nivel de servicio deseado (0.95 = 95%)
 * @returns Cantidad de piezas de stock de seguridad
 */
export function calculateAdvancedSafetyStock(
    demandStdDev: number,
    leadTimeDays: number,
    serviceLevel: number
): number {
    const z = getZFactor(serviceLevel);
    return Math.ceil(z * demandStdDev * Math.sqrt(Math.max(1, leadTimeDays)));
}

// ============================================================================
// TYPES - KANBAN RESULT
// ============================================================================

export interface KanbanResult {
    /** Number of kanban cards/containers needed (always rounded up) */
    kanbanCount: number;

    /** Total pieces in the supermarket (K × C) */
    totalPieces: number;

    /** Level at which to trigger reorder (typically 1-2 bins) */
    reorderPoint: number;

    /** Safety stock quantity in pieces */
    safetyStockQty: number;

    /** Coverage time in hours */
    coverageHours: number;

    /** Whether current inventory exceeds ideal */
    isOverstock: boolean;

    /** Amount of overstock in pieces (0 if not overstocked) */
    overstockPieces: number;

    /** Visual zones for shelf display */
    zones: {
        green: number;  // Max safe level
        yellow: number; // Warning level
        red: number;    // Reorder point
    };

    /** v2.0: Indica si se aplicó la regla del +1 */
    plusOneApplied: boolean;

    /** v2.0: Conteo base antes del +1 (para transparencia) */
    baseCount: number;
}

// ============================================================================
// TYPES - KANBAN INPUT
// ============================================================================

export interface KanbanInput {
    /** Demand per hour (pieces/hour) - from Takt Time */
    demandPerHour: number;

    /** 
     * Time to replenish in hours (simple mode).
     * Para cálculo más preciso, usar leadTimeBreakdown.
     */
    replenishmentTimeHours: number;

    /** Safety margin as decimal (0.15 = 15%) - modo simple */
    safetyMargin: number;

    /** Pieces per container */
    containerCapacity: number;

    /** Current actual inventory (optional, for comparison) */
    currentInventory?: number;

    /** Scrap rate as decimal (0.05 = 5% scrap) - inflates demand */
    scrapRate?: number;

    // ========== v2.0: NEW OPTIONS ==========

    /** 
     * REGLA DEL +1: Agrega un contenedor extra para asegurar continuidad.
     * 
     * Aplicar cuando el proceso espera a que el cajón se vacíe 
     * por completo para enviar la señal de "pedir más".
     * 
     * @default true (recomendado por metodología Lean)
     */
    applyPlusOneRule?: boolean;

    /**
     * Lead Time desglosado (opcional, alternativa a replenishmentTimeHours).
     * 
     * Si se proporciona, se usa en lugar de replenishmentTimeHours.
     * Permite mayor precisión al considerar todas las etapas del flujo.
     */
    leadTimeBreakdown?: LeadTimeBreakdown;

    /**
     * Stock de Seguridad avanzado basado en desviación estándar.
     * 
     * Si se proporciona, se usa en lugar de safetyMargin.
     * Recomendado cuando hay variabilidad significativa en demanda o entregas.
     */
    safetyStockAdvanced?: SafetyStockAdvanced;
}

// ============================================================================
// CORE KANBAN CALCULATION
// ============================================================================

/**
 * Calculates the optimal Kanban/supermarket dimensioning.
 * 
 * FORMULA MAESTRA v2.0:
 * N = ceil((D × LT × (1 + SS)) / C) + 1
 * 
 * This answers the question: "¿Cuántos cajones llenos de material necesito 
 * tener en el sistema para no parar nunca la producción?"
 * 
 * @param input - Kanban calculation inputs
 * @returns Complete Kanban result with zones and comparisons
 */
export function calculateKanban(input: KanbanInput): KanbanResult {
    const {
        demandPerHour,
        replenishmentTimeHours,
        safetyMargin,
        containerCapacity,
        currentInventory = 0,
        scrapRate = 0,
        // v2.0: New options
        applyPlusOneRule = true,  // Default: true (recomendado por Lean)
        leadTimeBreakdown,
        safetyStockAdvanced
    } = input;

    // v2.0: Usar Lead Time desglosado si está disponible
    const effectiveLeadTimeHours = leadTimeBreakdown
        ? calculateTotalLeadTime(leadTimeBreakdown)
        : replenishmentTimeHours;

    // Validate inputs
    if (demandPerHour <= 0 || effectiveLeadTimeHours <= 0 || containerCapacity <= 0) {
        return {
            kanbanCount: 0,
            totalPieces: 0,
            reorderPoint: 0,
            safetyStockQty: 0,
            coverageHours: 0,
            isOverstock: false,
            overstockPieces: 0,
            zones: { green: 0, yellow: 0, red: 0 },
            plusOneApplied: false,
            baseCount: 0
        };
    }

    // Expert: Inflate demand by scrap rate if provided
    // Formula: Effective Demand = Demand / (1 - Scrap)
    const effectiveScrap = Math.max(0, Math.min(0.5, scrapRate)); // Cap at 50%
    const effectiveDemand = effectiveScrap > 0 ? demandPerHour / (1 - effectiveScrap) : demandPerHour;

    // Calculate pieces needed during lead time
    const basePieces = effectiveDemand * effectiveLeadTimeHours;

    // v2.0: Calcular Stock de Seguridad
    let safetyStockQty: number;

    if (safetyStockAdvanced) {
        // Modo avanzado: usar desviación estándar
        // Convertir Lead Time a días para el cálculo
        const leadTimeDays = effectiveLeadTimeHours / 24;
        safetyStockQty = calculateAdvancedSafetyStock(
            safetyStockAdvanced.demandStdDev,
            leadTimeDays,
            safetyStockAdvanced.serviceLevel
        );
    } else {
        // Modo simple: porcentaje fijo
        const ss = Math.max(0, Math.min(1, safetyMargin));
        safetyStockQty = Math.ceil(basePieces * ss);
    }

    const totalPiecesNeeded = basePieces + safetyStockQty;

    // Calculate K (number of containers) - always round UP
    const baseCount = Math.ceil(totalPiecesNeeded / containerCapacity);

    // v2.0: REGLA DEL +1
    // Si el proceso espera a que el cajón se vacíe para pedir más,
    // necesitamos un contenedor extra para mantener continuidad
    const kanbanCount = applyPlusOneRule ? baseCount + 1 : baseCount;

    // Total pieces in supermarket
    const totalPieces = kanbanCount * containerCapacity;

    // Expert Fix: Reorder point MUST cover demand during replenishment lead time
    // ROP = (Demand during Lead Time + Safety Stock) / Container Capacity
    const demandDuringLeadTime = effectiveDemand * effectiveLeadTimeHours;
    const reorderPoint = Math.max(1, Math.ceil((demandDuringLeadTime + safetyStockQty) / containerCapacity));

    // Coverage time (how long until line stops if no replenishment)
    // FIX: Use effectiveDemand (scrap-inflated) since the supermarket depletes
    // at the total consumption rate, not just the good-piece rate
    const coverageHours = effectiveDemand > 0 ? totalPieces / effectiveDemand : 0;

    // Overstock detection
    const idealPieces = totalPieces;
    const isOverstock = currentInventory > idealPieces;
    const overstockPieces = isOverstock ? currentInventory - idealPieces : 0;

    // Visual zones for shelf display (in bins)
    // Red: 0 to reorderPoint (trigger replenishment!)
    // Yellow: reorderPoint to 70% capacity (consuming)
    // Green: 70% to 100% capacity (healthy)
    const greenStart = Math.ceil(kanbanCount * 0.7);

    // BUG FIX: Ensure zones are never negative when reorderPoint > greenStart
    const yellowZone = Math.max(0, greenStart - reorderPoint);
    const greenZone = Math.max(0, kanbanCount - greenStart);

    return {
        kanbanCount,
        totalPieces,
        reorderPoint,
        safetyStockQty,
        coverageHours,
        isOverstock,
        overstockPieces,
        zones: {
            red: reorderPoint,
            yellow: yellowZone,
            green: greenZone
        },
        // v2.0: Transparencia del cálculo
        plusOneApplied: applyPlusOneRule,
        baseCount
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converts various time units to hours for the formula.
 * 
 * @param value - Time value
 * @param unit - Time unit ('minutes' | 'hours' | 'days')
 * @returns Time in hours
 */
export function convertToHours(value: number, unit: 'minutes' | 'hours' | 'days'): number {
    switch (unit) {
        case 'minutes':
            return value / 60;
        case 'hours':
            return value;
        case 'days':
            return value * 24;
        default:
            return value;
    }
}

/**
 * Calculates demand per hour from Takt Time and daily demand.
 * 
 * @param dailyDemand - Pieces per day
 * @param shiftHours - Total production hours per day
 * @returns Pieces per hour
 */
export function calculateDemandPerHour(dailyDemand: number, shiftHours: number): number {
    if (shiftHours <= 0) return 0;
    return dailyDemand / shiftHours;
}

/**
 * Formats the Kanban result for display.
 * 
 * @param result - Kanban calculation result
 * @returns User-friendly display object
 */
export function formatKanbanDisplay(result: KanbanResult): {
    kanbanDisplay: string;
    piecesDisplay: string;
    reorderDisplay: string;
    coverageDisplay: string;
    statusClass: string;
    statusText: string;
} {
    // FIX: Guard against NaN coverageHours causing "NaN" in display text
    const safeHours = Number.isFinite(result.coverageHours) ? result.coverageHours : 0;
    const coverageText = safeHours >= 24
        ? `${(safeHours / 24).toFixed(1)} días`
        : safeHours >= 1
            ? `${safeHours.toFixed(1)}h`
            : `${(safeHours * 60).toFixed(0)} min`;

    let statusClass = 'text-green-600';
    let statusText = 'OK';

    if (result.isOverstock) {
        statusClass = 'text-amber-600';
        statusText = `Exceso: ${result.overstockPieces} pz`;
    }

    return {
        kanbanDisplay: `${result.kanbanCount} cajas`,
        piecesDisplay: `${result.totalPieces} piezas`,
        reorderDisplay: `Reponer cuando ≤ ${result.reorderPoint} cajas`,
        coverageDisplay: `Cobertura: ${coverageText}`,
        statusClass,
        statusText
    };
}

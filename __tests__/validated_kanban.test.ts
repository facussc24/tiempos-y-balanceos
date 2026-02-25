/**
 * TESTS VALIDADOS - BLOQUE 5: KANBAN (Dimensionamiento de Supermercado)
 *
 * Fuentes academicas:
 * - Ohno, T. (1988) "Toyota Production System" - Formula maestra Kanban
 * - Monden, Y. (1983) "Toyota Production System" - Regla del +1
 * - Silver, Pyke & Thomas (1998) "Inventory Management" - Safety Stock SS = Z×σ×√LT
 * - Tabla de distribucion normal estandar - Z-factors
 * - Lean Manufacturing: 5 etapas del Lead Time de reposicion
 *
 * Todas las formulas del Bloque 5 fueron verificadas como CORRECTAS.
 */
import { describe, it, expect } from 'vitest';
import {
    calculateKanban,
    calculateTotalLeadTime,
    calculateAdvancedSafetyStock,
    getZFactor,
    convertToHours,
    calculateDemandPerHour,
    formatKanbanDisplay,
    KanbanInput,
    LeadTimeBreakdown,
} from '../modules/kanban/kanbanLogic';

// ============================================================================
// BLOQUE 5A: Formula Maestra Kanban (Ohno 1988, Monden 1983)
// N = ceil((D × LT × (1 + SS)) / C) + 1
// ============================================================================
describe('Validado: Formula Maestra Kanban (Ohno/Monden)', () => {

    it('caso tipico: 100 pz/h, LT=4h, SS=15%, caja=50 pz', () => {
        // N = ceil((100 × 4 × 1.15) / 50) + 1
        // N = ceil(460 / 50) + 1 = ceil(9.2) + 1 = 10 + 1 = 11
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 50,
        });

        expect(result.baseCount).toBe(10);        // sin +1
        expect(result.kanbanCount).toBe(11);       // con +1
        expect(result.plusOneApplied).toBe(true);
    });

    it('demanda baja: 20 pz/h, LT=2h, SS=10%, caja=25 pz', () => {
        // N = ceil((20 × 2 × 1.10) / 25) + 1
        // N = ceil(44 / 25) + 1 = ceil(1.76) + 1 = 2 + 1 = 3
        const result = calculateKanban({
            demandPerHour: 20,
            replenishmentTimeHours: 2,
            safetyMargin: 0.10,
            containerCapacity: 25,
        });

        expect(result.baseCount).toBe(2);
        expect(result.kanbanCount).toBe(3);
    });

    it('demanda alta: 500 pz/h, LT=8h, SS=20%, caja=100 pz', () => {
        // N = ceil((500 × 8 × 1.20) / 100) + 1
        // N = ceil(4800 / 100) + 1 = 48 + 1 = 49
        const result = calculateKanban({
            demandPerHour: 500,
            replenishmentTimeHours: 8,
            safetyMargin: 0.20,
            containerCapacity: 100,
        });

        expect(result.baseCount).toBe(48);
        expect(result.kanbanCount).toBe(49);
    });

    it('totalPieces = kanbanCount × containerCapacity', () => {
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 50,
        });

        expect(result.totalPieces).toBe(result.kanbanCount * 50);
    });
});

// ============================================================================
// BLOQUE 5B: Regla del +1 (Practica Toyota)
// ============================================================================
describe('Validado: Regla del +1 (Toyota)', () => {

    it('con +1 (default): agrega contenedor extra para continuidad', () => {
        const result = calculateKanban({
            demandPerHour: 60,
            replenishmentTimeHours: 2,
            safetyMargin: 0.15,
            containerCapacity: 30,
        });

        expect(result.plusOneApplied).toBe(true);
        expect(result.kanbanCount).toBe(result.baseCount + 1);
    });

    it('sin +1: resultado exacto sin extra', () => {
        const result = calculateKanban({
            demandPerHour: 60,
            replenishmentTimeHours: 2,
            safetyMargin: 0.15,
            containerCapacity: 30,
            applyPlusOneRule: false,
        });

        expect(result.plusOneApplied).toBe(false);
        expect(result.kanbanCount).toBe(result.baseCount);
    });
});

// ============================================================================
// BLOQUE 5C: Lead Time Breakdown (5 etapas logisticas)
// ============================================================================
describe('Validado: Lead Time Breakdown (5 etapas)', () => {

    it('suma correcta de las 5 etapas', () => {
        const breakdown: LeadTimeBreakdown = {
            orderProcessingHours: 1,      // Procesar orden
            supplierTravelHours: 4,       // Viaje proveedor
            receptionHours: 0.5,          // Recepcion en dock
            qualityInspectionHours: 1,    // Inspeccion calidad
            putawayHours: 0.5,            // Acomodo en estante
        };

        expect(calculateTotalLeadTime(breakdown)).toBe(7);
    });

    it('usando breakdown en vez de replenishmentTimeHours', () => {
        const breakdown: LeadTimeBreakdown = {
            orderProcessingHours: 2,
            supplierTravelHours: 6,
            receptionHours: 1,
            qualityInspectionHours: 1.5,
            putawayHours: 0.5,
        };
        // Total LT = 11 horas

        const result = calculateKanban({
            demandPerHour: 50,
            replenishmentTimeHours: 999, // ignorado porque hay breakdown
            safetyMargin: 0.15,
            containerCapacity: 40,
            leadTimeBreakdown: breakdown,
        });

        // N = ceil((50 × 11 × 1.15) / 40) + 1
        // N = ceil(632.5 / 40) + 1 = ceil(15.8125) + 1 = 16 + 1 = 17
        expect(result.baseCount).toBe(16);
        expect(result.kanbanCount).toBe(17);
    });

    it('etapas con valor 0 no afectan', () => {
        const breakdown: LeadTimeBreakdown = {
            orderProcessingHours: 0,
            supplierTravelHours: 3,
            receptionHours: 0,
            qualityInspectionHours: 0,
            putawayHours: 0,
        };

        expect(calculateTotalLeadTime(breakdown)).toBe(3);
    });
});

// ============================================================================
// BLOQUE 5D: Z-Factor (Tabla Normal Estandar)
// Valores verificados contra tabla de distribucion normal estandar
// ============================================================================
describe('Validado: Z-Factor (Tabla Normal Estandar)', () => {

    it('99% → Z = 2.33 (valor tabulado: 2.326)', () => {
        expect(getZFactor(0.99)).toBe(2.33);
    });

    it('98% → Z = 2.05 (valor tabulado: 2.054)', () => {
        expect(getZFactor(0.98)).toBe(2.05);
    });

    it('95% → Z = 1.65 (valor tabulado: 1.645)', () => {
        expect(getZFactor(0.95)).toBe(1.65);
    });

    it('90% → Z = 1.28 (valor tabulado: 1.282)', () => {
        expect(getZFactor(0.90)).toBe(1.28);
    });

    it('85% → Z = 1.04 (valor tabulado: 1.036)', () => {
        expect(getZFactor(0.85)).toBe(1.04);
    });

    it('< 85% → Z = 1.0 (conservador)', () => {
        expect(getZFactor(0.80)).toBe(1.0);
        expect(getZFactor(0.50)).toBe(1.0);
    });
});

// ============================================================================
// BLOQUE 5E: Safety Stock Avanzado (Silver, Pyke & Thomas)
// Formula: SS = ceil(Z × σ × √LT)
// ============================================================================
describe('Validado: Safety Stock Avanzado (Silver, Pyke & Thomas)', () => {

    it('σ=10, LT=4 dias, 95% → SS = ceil(1.65 × 10 × √4) = ceil(33) = 33', () => {
        const ss = calculateAdvancedSafetyStock(10, 4, 0.95);
        // 1.65 × 10 × √4 = 1.65 × 10 × 2 = 33
        expect(ss).toBe(33);
    });

    it('σ=25, LT=9 dias, 99% → SS = ceil(2.33 × 25 × √9) = ceil(174.75) = 175', () => {
        const ss = calculateAdvancedSafetyStock(25, 9, 0.99);
        // 2.33 × 25 × 3 = 174.75
        expect(ss).toBe(175);
    });

    it('LT < 1 dia usa minimo de 1 dia', () => {
        // El codigo usa Math.max(1, leadTimeDays)
        const ss = calculateAdvancedSafetyStock(10, 0.5, 0.95);
        // 1.65 × 10 × √1 = 16.5 → ceil = 17
        expect(ss).toBe(17);
    });

    it('usando SS avanzado en calculateKanban', () => {
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 48, // 2 dias
            safetyMargin: 0, // ignorado
            containerCapacity: 50,
            safetyStockAdvanced: {
                demandStdDev: 20,
                serviceLevel: 0.95,
            },
        });

        // LT en dias = 48/24 = 2
        // SS = ceil(1.65 × 20 × √2) = ceil(46.67) = 47 piezas
        // basePieces = 100 × 48 = 4800
        // totalNeeded = 4800 + 47 = 4847
        // baseCount = ceil(4847 / 50) = 97
        // kanbanCount = 97 + 1 = 98
        expect(result.safetyStockQty).toBe(47);
        expect(result.baseCount).toBe(97);
        expect(result.kanbanCount).toBe(98);
    });
});

// ============================================================================
// BLOQUE 5F: Scrap Rate (Formula Divisiva)
// ============================================================================
describe('Validado: Scrap Rate en Kanban', () => {

    it('scrap 5%: infla la demanda efectiva', () => {
        const sinScrap = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 50,
        });

        const conScrap = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 50,
            scrapRate: 0.05,
        });

        // Con scrap se necesitan mas contenedores
        expect(conScrap.kanbanCount).toBeGreaterThanOrEqual(sinScrap.kanbanCount);
    });

    it('scrap se limita a maximo 50%', () => {
        // Scrap 80% deberia limitarse a 50%
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 50,
            scrapRate: 0.80,
        });

        // Con scrap 50%: demand = 100/(1-0.5) = 200
        // N = ceil((200 × 4 × 1.15) / 50) + 1 = ceil(920/50) + 1 = 19 + 1 = 20
        expect(result.kanbanCount).toBe(20);
    });
});

// ============================================================================
// BLOQUE 5G: Zonas del Supermercado y Deteccion Overstock
// ============================================================================
describe('Validado: Zonas del Supermercado', () => {

    it('zonas roja + amarilla + verde suman kanbanCount', () => {
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 50,
        });

        const { red, yellow, green } = result.zones;
        // Las zonas se calculan con porcentajes: green empieza al 70%
        // Red = reorderPoint, Yellow = gap, Green = top 30%
        const greenStart = Math.ceil(result.kanbanCount * 0.7);
        expect(red).toBe(result.reorderPoint);
        expect(green).toBe(Math.max(0, result.kanbanCount - greenStart));
        expect(yellow).toBe(Math.max(0, greenStart - result.reorderPoint));
        // Todas >= 0
        expect(red).toBeGreaterThanOrEqual(0);
        expect(yellow).toBeGreaterThanOrEqual(0);
        expect(green).toBeGreaterThanOrEqual(0);
    });

    it('zona roja = reorderPoint (punto de reposicion)', () => {
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 50,
        });

        expect(result.zones.red).toBe(result.reorderPoint);
    });

    it('overstock detectado cuando inventario > totalPieces', () => {
        const result = calculateKanban({
            demandPerHour: 50,
            replenishmentTimeHours: 2,
            safetyMargin: 0.10,
            containerCapacity: 30,
            currentInventory: 9999,
        });

        expect(result.isOverstock).toBe(true);
        expect(result.overstockPieces).toBeGreaterThan(0);
    });

    it('sin overstock cuando inventario <= totalPieces', () => {
        const result = calculateKanban({
            demandPerHour: 50,
            replenishmentTimeHours: 2,
            safetyMargin: 0.10,
            containerCapacity: 30,
            currentInventory: 10,
        });

        expect(result.isOverstock).toBe(false);
        expect(result.overstockPieces).toBe(0);
    });
});

// ============================================================================
// BLOQUE 5H: Cobertura y Helpers
// ============================================================================
describe('Validado: Cobertura y Helpers', () => {

    it('coverageHours = totalPieces / demandPerHour', () => {
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 50,
        });

        expect(result.coverageHours).toBeCloseTo(result.totalPieces / 100, 2);
    });

    it('convertToHours: minutos, horas, dias', () => {
        expect(convertToHours(120, 'minutes')).toBe(2);
        expect(convertToHours(3, 'hours')).toBe(3);
        expect(convertToHours(1, 'days')).toBe(24);
    });

    it('calculateDemandPerHour: 800 pz/dia en 8h = 100 pz/h', () => {
        expect(calculateDemandPerHour(800, 8)).toBe(100);
    });

    it('calculateDemandPerHour: 0 horas retorna 0', () => {
        expect(calculateDemandPerHour(800, 0)).toBe(0);
    });
});

// ============================================================================
// BLOQUE 5I: Casos Limite
// ============================================================================
describe('Validado: Kanban - Casos Limite', () => {

    it('demanda 0: retorna todo en 0 sin error', () => {
        const result = calculateKanban({
            demandPerHour: 0,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 50,
        });

        expect(result.kanbanCount).toBe(0);
        expect(result.totalPieces).toBe(0);
    });

    it('lead time 0: retorna todo en 0 sin error', () => {
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 0,
            safetyMargin: 0.15,
            containerCapacity: 50,
        });

        expect(result.kanbanCount).toBe(0);
    });

    it('capacidad 0: retorna todo en 0 sin error', () => {
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 4,
            safetyMargin: 0.15,
            containerCapacity: 0,
        });

        expect(result.kanbanCount).toBe(0);
    });

    it('safety margin se limita entre 0 y 1', () => {
        const result = calculateKanban({
            demandPerHour: 100,
            replenishmentTimeHours: 2,
            safetyMargin: 5.0, // 500% → limitado a 100%
            containerCapacity: 50,
        });

        // Con SS=1.0: N = ceil((100 × 2 × 2.0) / 50) + 1 = ceil(8) + 1 = 9
        expect(result.kanbanCount).toBe(9);
    });
});

// ============================================================================
// BLOQUE 5J: Escenario Real Integrado
// ============================================================================
describe('Validado: Kanban - Escenario Real Planta Automotriz', () => {

    it('linea de ensamble: tornillos M8 con proveedor lejano', () => {
        // Datos reales tipicos:
        // Demanda: 200 pz/h, LT breakdown: orden 2h + viaje 8h + recepcion 1h + QC 1h + acomodo 0.5h
        // Caja: 100 piezas, SS: 15%, Scrap: 2%
        const result = calculateKanban({
            demandPerHour: 200,
            replenishmentTimeHours: 0, // ignorado
            safetyMargin: 0.15,
            containerCapacity: 100,
            scrapRate: 0.02,
            leadTimeBreakdown: {
                orderProcessingHours: 2,
                supplierTravelHours: 8,
                receptionHours: 1,
                qualityInspectionHours: 1,
                putawayHours: 0.5,
            },
        });

        // LT total = 12.5 horas
        // Demanda efectiva = 200/(1-0.02) = 204.08 pz/h
        // basePieces = 204.08 × 12.5 = 2551
        // SS qty = ceil(2551 × 0.15) = ceil(382.65) = 383
        // totalNeeded = 2551 + 383 = 2934
        // baseCount = ceil(2934 / 100) = 30
        // kanbanCount = 30 + 1 = 31
        expect(result.kanbanCount).toBe(31);
        expect(result.plusOneApplied).toBe(true);
        expect(result.coverageHours).toBeGreaterThan(12); // mas que el LT
        expect(result.isOverstock).toBe(false);
    });
});

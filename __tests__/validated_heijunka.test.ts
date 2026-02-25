/**
 * TESTS VALIDADOS - BLOQUE 7: HEIJUNKA (Nivelacion de Produccion)
 *
 * Fuentes academicas:
 * - Toyota Production System: Heijunka (平準化) - nivelacion
 * - Monden, Y. (1983) "Toyota Production System" - produccion nivelada
 * - Toussaint, G. (2005) "The Euclidean Algorithm Generates Traditional Musical Rhythms"
 *   - Algoritmo Euclidiano de ritmos (base del Bresenham-like distribution)
 * - Lean Manufacturing: Pitch = Takt × Pack-out (conecta con Mizusumashi)
 *
 * Todas las formulas del Bloque 7 fueron verificadas como CORRECTAS.
 */
import { describe, it, expect } from 'vitest';
import {
    calculateSlots,
    calculateQuantityPerSlot,
    euclideanDistribute,
    generateHeijunkaSequence,
    validateCapacity,
    calculateHeijunka,
    getProductColor,
    ProductDemand,
} from '../modules/heijunka/heijunkaLogic';

// ============================================================================
// Helper: crear producto
// ============================================================================
const crearProducto = (overrides: Partial<ProductDemand> = {}): ProductDemand => ({
    productId: 'A',
    productName: 'Producto A',
    dailyDemand: 100,
    cycleTimeSeconds: 30,
    color: '#3B82F6',
    ...overrides,
});

// ============================================================================
// BLOQUE 7A: Calculo de Slots
// Formula: Slots = floor(disponible / pitch)
// ============================================================================
describe('Validado: Calculo de Slots', () => {

    it('480 min / 20 min pitch = 24 slots', () => {
        expect(calculateSlots(480, 20)).toBe(24);
    });

    it('480 min / 10 min pitch = 48 slots', () => {
        expect(calculateSlots(480, 10)).toBe(48);
    });

    it('division no exacta: floor (450 / 20 = 22.5 → 22)', () => {
        expect(calculateSlots(450, 20)).toBe(22);
    });

    it('disponible = 0 → 0 slots', () => {
        expect(calculateSlots(0, 20)).toBe(0);
    });

    it('pitch = 0 → 0 slots', () => {
        expect(calculateSlots(480, 0)).toBe(0);
    });
});

// ============================================================================
// BLOQUE 7B: Cantidad por Slot
// Formula: qty = demanda / totalSlots
// ============================================================================
describe('Validado: Cantidad por Slot', () => {

    it('100 pzas / 24 slots = 4.167 pzas/slot', () => {
        expect(calculateQuantityPerSlot(100, 24)).toBeCloseTo(4.167, 2);
    });

    it('240 pzas / 24 slots = 10 pzas/slot (exacto)', () => {
        expect(calculateQuantityPerSlot(240, 24)).toBe(10);
    });

    it('0 slots → 0', () => {
        expect(calculateQuantityPerSlot(100, 0)).toBe(0);
    });
});

// ============================================================================
// BLOQUE 7C: Distribucion Euclidiana (Toussaint 2005 / Bresenham)
// ============================================================================
describe('Validado: Distribucion Euclidiana (Toussaint/Bresenham)', () => {

    it('euclideanDistribute(7, 3) → suma = 7, largo = 3', () => {
        const result = euclideanDistribute(7, 3);
        expect(result.length).toBe(3);
        expect(result.reduce((a, b) => a + b, 0)).toBe(7);
        // base = floor(7/3) = 2, remainder = 1
        // Cada slot tiene 2 o 3
        result.forEach(v => expect(v).toBeGreaterThanOrEqual(2));
        result.forEach(v => expect(v).toBeLessThanOrEqual(3));
    });

    it('euclideanDistribute(3, 6) → distribucion uniforme', () => {
        const result = euclideanDistribute(3, 6);
        expect(result.length).toBe(6);
        expect(result.reduce((a, b) => a + b, 0)).toBe(3);
        // base = 0, remainder = 3, step = 6/3 = 2
        // Cada slot tiene 0 o 1
        result.forEach(v => expect(v).toBeLessThanOrEqual(1));
        // Exactamente 3 slots con valor 1
        expect(result.filter(v => v === 1).length).toBe(3);
    });

    it('distribucion exacta: euclideanDistribute(12, 4) → [3, 3, 3, 3]', () => {
        const result = euclideanDistribute(12, 4);
        expect(result).toEqual([3, 3, 3, 3]);
    });

    it('total = 1, slots = 5 → exactamente un slot con 1', () => {
        const result = euclideanDistribute(1, 5);
        expect(result.length).toBe(5);
        expect(result.reduce((a, b) => a + b, 0)).toBe(1);
        expect(result.filter(v => v === 1).length).toBe(1);
    });

    it('total = 0 → todo ceros', () => {
        const result = euclideanDistribute(0, 5);
        expect(result).toEqual([0, 0, 0, 0, 0]);
    });

    it('slots = 0 → array vacio', () => {
        const result = euclideanDistribute(10, 0);
        expect(result).toEqual([]);
    });

    it('total grande: 1000 en 7 slots → variacion maxima 1', () => {
        const result = euclideanDistribute(1000, 7);
        expect(result.reduce((a, b) => a + b, 0)).toBe(1000);
        const min = Math.min(...result);
        const max = Math.max(...result);
        expect(max - min).toBeLessThanOrEqual(1);
    });

    it('propiedad fundamental: siempre conserva la suma total', () => {
        // Probar con varios valores
        [1, 5, 13, 50, 99, 200].forEach(total => {
            [1, 3, 7, 10, 24].forEach(slots => {
                const result = euclideanDistribute(total, slots);
                expect(result.reduce((a, b) => a + b, 0)).toBe(total);
                expect(result.length).toBe(slots);
            });
        });
    });
});

// ============================================================================
// BLOQUE 7D: Validacion de Capacidad
// ============================================================================
describe('Validado: Validacion de Capacidad', () => {

    it('ciclo < pitch: OK', () => {
        const products = [crearProducto({ cycleTimeSeconds: 30 })];
        const alerts = validateCapacity(products, 1200); // pitch 20 min
        expect(alerts[0].severity).toBe('ok');
    });

    it('ciclo > 90% del pitch: warning', () => {
        const products = [crearProducto({ cycleTimeSeconds: 1100 })]; // 91.7%
        const alerts = validateCapacity(products, 1200);
        expect(alerts[0].severity).toBe('warning');
    });

    it('ciclo > pitch: critical (cuello de botella)', () => {
        const products = [crearProducto({ cycleTimeSeconds: 1500 })]; // 125%
        const alerts = validateCapacity(products, 1200);
        expect(alerts[0].severity).toBe('critical');
    });

    it('multiples productos: cada uno evaluado independientemente', () => {
        const products = [
            crearProducto({ productId: 'A', cycleTimeSeconds: 30 }),  // ok
            crearProducto({ productId: 'B', cycleTimeSeconds: 1100 }), // warning
            crearProducto({ productId: 'C', cycleTimeSeconds: 1500 }), // critical
        ];
        const alerts = validateCapacity(products, 1200);

        expect(alerts[0].severity).toBe('ok');
        expect(alerts[1].severity).toBe('warning');
        expect(alerts[2].severity).toBe('critical');
    });
});

// ============================================================================
// BLOQUE 7E: Generacion de Secuencia Heijunka
// ============================================================================
describe('Validado: Generacion de Secuencia Heijunka', () => {

    it('2 productos: distribucion nivelada', () => {
        const products = [
            crearProducto({ productId: 'A', dailyDemand: 12 }),
            crearProducto({ productId: 'B', dailyDemand: 6 }),
        ];

        const slots = generateHeijunkaSequence(products, 6, '08:00', 20);

        // 6 slots, producto A: 12/6=2 por slot, producto B: 6/6=1 por slot
        expect(slots.length).toBe(6);

        // Verificar que la demanda total se conserva
        let totalA = 0, totalB = 0;
        slots.forEach(slot => {
            slot.assignments.forEach(a => {
                if (a.productId === 'A') totalA += a.quantity;
                if (a.productId === 'B') totalB += a.quantity;
            });
        });
        expect(totalA).toBe(12);
        expect(totalB).toBe(6);
    });

    it('horarios correctos: start + pitch incremental', () => {
        const products = [crearProducto({ dailyDemand: 3 })];
        const slots = generateHeijunkaSequence(products, 3, '08:00', 20);

        expect(slots[0].startTime).toBe('08:00');
        expect(slots[0].endTime).toBe('08:20');
        expect(slots[1].startTime).toBe('08:20');
        expect(slots[1].endTime).toBe('08:40');
        expect(slots[2].startTime).toBe('08:40');
        expect(slots[2].endTime).toBe('09:00');
    });

    it('0 slots retorna array vacio', () => {
        const products = [crearProducto()];
        expect(generateHeijunkaSequence(products, 0, '08:00', 20)).toEqual([]);
    });

    it('0 productos retorna array vacio', () => {
        expect(generateHeijunkaSequence([], 6, '08:00', 20)).toEqual([]);
    });
});

// ============================================================================
// BLOQUE 7F: Calculo Completo Heijunka
// ============================================================================
describe('Validado: Calculo Completo Heijunka', () => {

    it('escenario tipico: 3 productos, 8 horas, pitch 20 min', () => {
        const products = [
            crearProducto({ productId: 'A', productName: 'Modelo A', dailyDemand: 120, cycleTimeSeconds: 30 }),
            crearProducto({ productId: 'B', productName: 'Modelo B', dailyDemand: 60, cycleTimeSeconds: 45 }),
            crearProducto({ productId: 'C', productName: 'Modelo C', dailyDemand: 24, cycleTimeSeconds: 60 }),
        ];

        const result = calculateHeijunka(products, 480, 20, '08:00');

        // 480/20 = 24 slots
        expect(result.totalSlots).toBe(24);
        expect(result.pitchMinutes).toBe(20);

        // Demanda total asignada = demanda total
        const totalAssigned = result.productSummaries.reduce((s, p) => s + p.totalAssigned, 0);
        expect(totalAssigned).toBe(120 + 60 + 24);

        // Todos los ciclos < pitch (1200s) → factible
        expect(result.isFeasible).toBe(true);
    });

    it('producto con ciclo > pitch → no factible', () => {
        const products = [
            crearProducto({ productId: 'A', dailyDemand: 100, cycleTimeSeconds: 1500 }), // 25 min > 20 min pitch
        ];

        const result = calculateHeijunka(products, 480, 20, '08:00');
        expect(result.isFeasible).toBe(false);
        expect(result.capacityAlerts[0].severity).toBe('critical');
    });

    it('summaries: avgPerSlot = totalAssigned / totalSlots', () => {
        const products = [
            crearProducto({ productId: 'A', dailyDemand: 48 }),
        ];

        const result = calculateHeijunka(products, 480, 20, '08:00');
        // 24 slots, 48 demand → avg = 2.0
        expect(result.productSummaries[0].avgPerSlot).toBe(2);
        expect(result.productSummaries[0].totalAssigned).toBe(48);
    });
});

// ============================================================================
// BLOQUE 7G: Helpers
// ============================================================================
describe('Validado: Heijunka Helpers', () => {

    it('getProductColor retorna colores ciclicamente', () => {
        const c0 = getProductColor(0);
        const c1 = getProductColor(1);
        const c8 = getProductColor(8); // ciclo de 8 colores

        expect(c0).toBe('#3B82F6');  // Blue
        expect(c1).toBe('#10B981');  // Green
        expect(c8).toBe(c0);         // Vuelve al primero
    });
});

// ============================================================================
// BLOQUE 7H: Escenario Real Integrado
// ============================================================================
describe('Validado: Heijunka - Escenario Real Planta', () => {

    it('planta automotriz: 3 modelos con demandas distintas', () => {
        // Datos tipicos de linea mixta automotriz:
        // Turno 8h (480 min), pitch 15 min (takt 45s × 20 pzas/caja)
        // Modelo X: 160 pzas/dia (alto volumen)
        // Modelo Y: 80 pzas/dia (medio)
        // Modelo Z: 32 pzas/dia (bajo volumen)
        const products: ProductDemand[] = [
            { productId: 'X', productName: 'Sedan', dailyDemand: 160, cycleTimeSeconds: 40, color: '#3B82F6' },
            { productId: 'Y', productName: 'SUV', dailyDemand: 80, cycleTimeSeconds: 55, color: '#10B981' },
            { productId: 'Z', productName: 'Pickup', dailyDemand: 32, cycleTimeSeconds: 70, color: '#F59E0B' },
        ];

        const result = calculateHeijunka(products, 480, 15, '06:00');

        // 480/15 = 32 slots
        expect(result.totalSlots).toBe(32);

        // Demanda total conservada
        const totalX = result.productSummaries.find(p => p.productId === 'X')!.totalAssigned;
        const totalY = result.productSummaries.find(p => p.productId === 'Y')!.totalAssigned;
        const totalZ = result.productSummaries.find(p => p.productId === 'Z')!.totalAssigned;
        expect(totalX).toBe(160);
        expect(totalY).toBe(80);
        expect(totalZ).toBe(32);

        // Ciclo mas largo (70s) < pitch (15×60=900s) → factible
        expect(result.isFeasible).toBe(true);

        // Secuencia nivelada: el producto X (alto volumen) aparece en todos/casi todos los slots
        // El Z (bajo) aparece solo en 32 de los slots
        const slotsWithX = result.slots.filter(s => s.assignments.some(a => a.productId === 'X')).length;
        const slotsWithZ = result.slots.filter(s => s.assignments.some(a => a.productId === 'Z')).length;
        expect(slotsWithX).toBe(32); // X tiene 160/32=5 por slot, presente en todos
        expect(slotsWithZ).toBe(32); // Z tiene 32/32=1 por slot, presente en todos
    });
});

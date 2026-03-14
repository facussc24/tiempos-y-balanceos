/**
 * Mix Simplifier - Transforma resultados complejos a formato amigable
 * 
 * Esta capa NO modifica la lógica de cálculo existente.
 * Solo traduce resultados técnicos a formato comprensible para usuarios no técnicos.
 * 
 * @module mixSimplifier
 * @version 1.0.0
 */
import {
    MixSectorAnalysis,
    MixSectorCard,
    MixSimplifiedResult,
    MixMachineCard,
    SectorRequirement
} from '../../types';
import { PRODUCT_COLORS } from '../../utils/constants';

/**
 * Convierte análisis técnico de sectores a tarjetas simplificadas
 * 
 * @param analysis - Resultado del análisis de mixBalancing.analyzeMixBySector
 * @param products - Lista de productos con nombres para mostrar
 * @returns Array de tarjetas de sector para UI
 */
export function toSectorCards(
    analysis: MixSectorAnalysis,
    products: Array<{ path: string; name: string; demand: number }>
): MixSectorCard[] {
    const totalDemand = products.reduce((sum, p) => sum + p.demand, 0);

    return analysis.sectors.map(sector => {
        // Detectar qué productos usan este sector
        const sharedProducts = detectSharedProducts(sector, products);

        // Convertir máquinas a formato simplificado
        const machines: MixMachineCard[] = sector.machines.map(m => ({
            machineId: m.machineId,
            machineName: m.machineName,
            unitsRequired: m.unitsRequired,
            unitsAvailable: m.unitsAvailable,
            hasDeficit: m.hasDeficit,
            deficitMessage: m.hasDeficit
                ? generateDeficitMessage(m.machineName, m.unitsRequired, m.unitsAvailable)
                : undefined
        }));

        // Generar alertas en lenguaje simple
        const alerts = generateSimpleAlerts(sector, products);

        return {
            sectorId: sector.sectorId,
            sectorName: sector.sectorName,
            sectorColor: sector.sectorColor,
            machines,
            operatorsRequired: sector.totalPuestos,
            isShared: sharedProducts.length > 1,
            sharedProducts,
            alerts
        };
    });
}

/**
 * Detecta qué productos comparten un sector
 */
function detectSharedProducts(
    sector: SectorRequirement,
    products: Array<{ path: string; name: string }>
): string[] {
    // Por ahora asumimos que si hay más de una máquina con breakdown,
    // múltiples productos comparten el sector
    const productNamesInSector = new Set<string>();

    for (const machine of sector.machines) {
        for (const contribution of machine.productBreakdown || []) {
            const product = products.find(p =>
                p.path === contribution.productPath || p.name === contribution.productName
            );
            if (product) {
                productNamesInSector.add(product.name);
            }
        }
    }

    // Si no hay breakdown, usar todos los productos
    if (productNamesInSector.size === 0) {
        return products.map(p => p.name);
    }

    return Array.from(productNamesInSector);
}

/**
 * Genera mensaje de déficit en español simple
 */
function generateDeficitMessage(
    machineName: string,
    required: number,
    available: number
): string {
    const deficit = required - available;
    if (deficit === 1) {
        return `Falta 1 ${machineName}. Necesitás ${required} pero solo hay ${available}.`;
    }
    return `Faltan ${deficit} ${machineName}(s). Necesitás ${required} pero solo hay ${available}.`;
}

/**
 * Genera alertas en español simple (sin términos técnicos)
 */
function generateSimpleAlerts(
    sector: SectorRequirement,
    products: Array<{ path: string; name: string }>
): string[] {
    const alerts: string[] = [];

    // Alertas por déficit de máquinas
    for (const machine of sector.machines) {
        if (machine.hasDeficit) {
            const deficit = machine.unitsRequired - machine.unitsAvailable;
            alerts.push(
                `⚠️ Faltan ${deficit} ${machine.machineName}(s). ` +
                `Necesitás ${machine.unitsRequired} pero solo hay ${machine.unitsAvailable}.`
            );
        }
    }

    // Alerta de recurso compartido (informativa, no es error)
    const sharedProducts = detectSharedProducts(sector, products);
    if (sharedProducts.length > 1) {
        alerts.push(
            `💡 ${sharedProducts.length} productos comparten este sector: ${sharedProducts.join(', ')}.`
        );
    }

    return alerts;
}

/**
 * Convierte análisis completo a resultado simplificado para UI
 * 
 * @param analysis - Resultado de analyzeMixBySector
 * @param products - Productos con demanda
 * @param taktTime - Tiempo Takt calculado
 * @returns Resultado simplificado listo para mostrar
 */
export function toSimplifiedResult(
    analysis: MixSectorAnalysis,
    products: Array<{ path: string; name: string; demand: number }>,
    taktTime: number
): MixSimplifiedResult {
    const sectors = toSectorCards(analysis, products);
    const totalDemand = products.reduce((sum, p) => sum + p.demand, 0);

    // Calcular totales
    const totalMachines = sectors.reduce((sum, s) =>
        sum + s.machines.reduce((mSum, m) => mSum + m.unitsRequired, 0), 0
    );
    const totalOperators = sectors.reduce((sum, s) => sum + s.operatorsRequired, 0);

    // Detectar si es viable (sin déficits)
    const hasDeficit = sectors.some(s =>
        s.machines.some(m => m.hasDeficit)
    ) || analysis.hasAnyDeficit;

    // Generar warnings globales
    const warnings: string[] = [];
    if (hasDeficit) {
        warnings.push('⚠️ Hay recursos insuficientes. Ver detalles por sector.');
    }

    // Generar resumen
    const summary = generateSummary(!hasDeficit, totalOperators, totalMachines);

    // Breakdown de productos por porcentaje
    // FIX: Compensate rounding error so percentages sum to exactly 100%.
    // Without this, 3 products with equal demand show [33%, 33%, 33%] = 99%.
    const productBreakdown = products.map((p, idx) => ({
        productName: p.name,
        percentage: totalDemand > 0 ? Math.round((p.demand / totalDemand) * 100) : 0,
        color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length]
    }));

    // Adjust last product to compensate for rounding (largest remainder method)
    if (productBreakdown.length > 0 && totalDemand > 0) {
        const currentSum = productBreakdown.reduce((s, p) => s + p.percentage, 0);
        if (currentSum !== 100 && currentSum > 0) {
            productBreakdown[productBreakdown.length - 1].percentage += (100 - currentSum);
        }
    }

    return {
        isViable: !hasDeficit,
        taktTimeSeconds: taktTime,
        totalMachines,
        totalOperators,
        sectors,
        summary,
        warnings,
        productBreakdown
    };
}

/**
 * Genera resumen de una línea en español
 */
export function generateSummary(
    isViable: boolean,
    operators: number,
    machines: number
): string {
    if (!isViable) {
        return `⚠️ Faltan recursos para producir. Ver detalles por sector.`;
    }
    return `✅ Podés producir con ${operators} personas y ${machines} máquinas.`;
}

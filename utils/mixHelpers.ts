/**
 * Mix Scenario Helpers
 * 
 * Utilities for loading and saving mixed-model production scenarios
 * that combine multiple product files for MMALBP balancing.
 * 
 * @module mixHelpers
 * @version 4.1.0
 */
import { MixScenario, MixProductReference, ProjectData, MixEnrichedProduct } from '../types';
import { logger } from './logger';
import { generateChecksum } from './crypto';

// =============================================================================
// V8.3: INTEGRITY VALIDATION
// =============================================================================

/**
 * V8.3: Generates integrity checksum for a product
 * 
 * The checksum is based on data that affects balancing:
 * - Task IDs list
 * - Standard times for each task
 * - Execution mode of each task
 * - Configured demand
 * 
 * Does NOT include metadata like name, date, etc.
 * 
 * @param project - Project data to hash
 * @returns SHA-256 hex string
 */
export async function generateProductChecksum(project: ProjectData): Promise<string> {
    // Extract only data that affects balancing calculations
    const criticalData = {
        taskIds: project.tasks.map(t => t.id).sort(),
        taskTimes: project.tasks.map(t => ({
            id: t.id,
            standardTime: t.standardTime,
            executionMode: t.executionMode || 'manual'
        })).sort((a, b) => a.id.localeCompare(b.id)),
        dailyDemand: project.meta.dailyDemand,
        activeShifts: project.meta.activeShifts
    };

    return generateChecksum(JSON.stringify(criticalData));
}

/**
 * V8.3: Integrity verification result for a single product
 */
export interface ProductIntegrityStatus {
    productPath: string;
    productName: string;
    status: 'ok' | 'modified' | 'missing' | 'legacy';
    details?: string;
}

/**
 * V8.3: Full integrity verification result
 */
export interface IntegrityVerificationResult {
    isValid: boolean;
    hasWarnings: boolean;
    changes: ProductIntegrityStatus[];
}

/**
 * V8.3: Verifies integrity of products in a scenario
 * 
 * Compares stored checksums with current product data to detect
 * if any source files have been modified since the scenario was saved.
 * 
 * @param scenario - Scenario to verify
 * @param loadedProducts - Products loaded from disk (with _mixPath attached)
 * @returns Verification result with details per product
 */
export async function verifyMixIntegrity(
    scenario: MixScenario,
    loadedProducts: ProjectData[]
): Promise<IntegrityVerificationResult> {
    const changes: ProductIntegrityStatus[] = [];

    for (const ref of scenario.products) {
        const loaded = loadedProducts.find(p =>
            (p as MixEnrichedProduct)._mixPath === ref.path
        );

        if (!loaded) {
            changes.push({
                productPath: ref.path,
                productName: ref.path.split(/[/\\]/).pop()?.replace('.json', '') || 'Desconocido',
                status: 'missing',
                details: 'Archivo no encontrado'
            });
            continue;
        }

        // Legacy scenario without checksum
        if (!ref.sourceChecksum) {
            changes.push({
                productPath: ref.path,
                productName: loaded.meta.name,
                status: 'legacy',
                details: 'Escenario sin checksums (versión anterior)'
            });
            continue;
        }

        // Calculate current checksum and compare
        const currentChecksum = await generateProductChecksum(loaded);
        if (currentChecksum !== ref.sourceChecksum) {
            changes.push({
                productPath: ref.path,
                productName: loaded.meta.name,
                status: 'modified',
                details: 'El archivo ha sido modificado desde que se guardó el escenario'
            });
        } else {
            changes.push({
                productPath: ref.path,
                productName: loaded.meta.name,
                status: 'ok'
            });
        }
    }

    const hasModified = changes.some(c => c.status === 'modified');
    const hasMissing = changes.some(c => c.status === 'missing');

    return {
        isValid: !hasMissing,
        hasWarnings: hasModified,
        changes
    };
}

/**
 * Save a mix scenario to a JSON file.
 * Web mode: no filesystem — callers should use Supabase repositories instead.
 * Kept as a no-op stub so the Mix module UI renders without errors.
 */
export async function saveMixScenario(
    _scenario: MixScenario,
    _path: string,
    _loadedProducts?: ProjectData[],
): Promise<boolean> {
    logger.debug('mixHelpers', 'saveMixScenario is a no-op in web mode');
    return false;
}

/**
 * Load multiple product files referenced by a mix scenario.
 * Web mode: no filesystem — returns empty with a single informational error.
 */
export async function loadMixProducts(
    _basePath: string,
    _references: MixProductReference[],
): Promise<{
    products: ProjectData[];
    errors: string[];
    totalDemand: number;
    isPartial: boolean;
}> {
    return {
        products: [],
        errors: ['Mix loading no disponible en modo web'],
        totalDemand: 0,
        isPartial: false,
    };
}


/**
 * Create a new empty mix scenario
 */
export function createEmptyMixScenario(name: string, createdBy: string): MixScenario {
    return {
        type: 'mix_scenario',
        version: 1,
        name,
        createdAt: new Date().toISOString(),
        createdBy,
        products: [],
        totalDemand: 0
    };
}

/**
 * Add a product reference to a mix scenario
 */
function addProductToMix(
    scenario: MixScenario,
    path: string,
    demand: number
): MixScenario {
    // M-03 FIX: Validate demand is positive and finite
    // FIX: Also guard against NaN — NaN <= 0 is false, so it slips through the
    // original check, contaminating totalDemand and zeroing all percentages.
    if (!Number.isFinite(demand) || demand <= 0) {
        logger.warn('mixHelpers', 'Demand must be positive and finite, using fallback', { demand });
        demand = 1;
    }
    const newProducts = [
        ...scenario.products,
        { path, demand }
    ];

    const totalDemand = newProducts.reduce((sum, p) => sum + p.demand, 0);

    // Recalculate percentages
    const withPercentages = newProducts.map(p => ({
        ...p,
        percentage: totalDemand > 0 ? p.demand / totalDemand : 0
    }));

    return {
        ...scenario,
        products: withPercentages,
        totalDemand
    };
}

/**
 * Remove a product from a mix scenario by path
 */
function removeProductFromMix(
    scenario: MixScenario,
    path: string
): MixScenario {
    const newProducts = scenario.products.filter(p => p.path !== path);
    // FIX: Guard against NaN demands contaminating totalDemand
    const totalDemand = newProducts.reduce((sum, p) => {
        const d = Number.isFinite(p.demand) ? p.demand : 0;
        return sum + d;
    }, 0);

    // Recalculate percentages
    const withPercentages = newProducts.map(p => ({
        ...p,
        percentage: totalDemand > 0 && Number.isFinite(p.demand) ? p.demand / totalDemand : 0
    }));

    return {
        ...scenario,
        products: withPercentages,
        totalDemand
    };
}

/**
 * Update the demand for a product in a mix scenario
 */
function updateProductDemand(
    scenario: MixScenario,
    path: string,
    demand: number
): MixScenario {
    // Validate demand is positive (consistent with addProductToMix)
    if (demand <= 0) {
        logger.warn('mixHelpers', 'Demand must be positive, using fallback', { demand });
        demand = 1;
    }
    const newProducts = scenario.products.map(p =>
        p.path === path ? { ...p, demand } : p
    );

    const totalDemand = newProducts.reduce((sum, p) => sum + p.demand, 0);

    // Recalculate percentages
    const withPercentages = newProducts.map(p => ({
        ...p,
        percentage: totalDemand > 0 ? p.demand / totalDemand : 0
    }));

    return {
        ...scenario,
        products: withPercentages,
        totalDemand
    };
}

// =============================================================================
// V8.2: Configuration Conflict Detection
// =============================================================================

/**
 * Configuration conflict between products
 */
export interface ConfigConflict {
    field: 'activeShifts' | 'manualOEE' | 'breaks';
    fieldLabel: string;
    values: Array<{ productName: string; value: string | number }>;
}

/**
 * V8.2: Detect configuration conflicts between products in a mix
 * 
 * Per expert: "A production line has one opening schedule and one real OEE,
 * regardless of which product runs on it."
 * 
 * The Takt Time is calculated from LINE available time, not product time.
 * If products have incompatible configurations, the user should be warned.
 * 
 * @param products - Array of loaded products to check
 * @returns Conflict detection result with details
 */
export function detectConfigConflicts(
    products: ProjectData[]
): {
    hasConflict: boolean;
    message: string | null;
    details: ConfigConflict[];
} {
    if (products.length < 2) {
        return { hasConflict: false, message: null, details: [] };
    }

    const details: ConfigConflict[] = [];
    const reference = products[0];
    const refName = reference.meta?.name || 'Producto 1';

    // Check 1: Active Shifts
    const shiftsSet = new Set(
        products.map(p => p.meta?.activeShifts || 1)
    );
    if (shiftsSet.size > 1) {
        details.push({
            field: 'activeShifts',
            fieldLabel: 'Turnos Activos',
            values: products.map((p, i) => ({
                productName: p.meta?.name || `Producto ${i + 1}`,
                value: p.meta?.activeShifts || 1
            }))
        });
    }

    // Check 2: Manual OEE (when useManualOEE is true)
    const oeeValues = products
        .filter(p => p.meta?.useManualOEE)
        .map(p => p.meta?.manualOEE || 0.85);
    const oeeSet = new Set(oeeValues.map(v => Math.round(v * 100)));
    if (oeeSet.size > 1) {
        details.push({
            field: 'manualOEE',
            fieldLabel: 'OEE Manual',
            values: products.map((p, i) => ({
                productName: p.meta?.name || `Producto ${i + 1}`,
                value: `${Math.round((p.meta?.manualOEE || 0.85) * 100)}%`
            }))
        });
    }

    // Check 3: Break duration in first shift (simplified check)
    const breakMinutes = products.map(p => {
        const shift1 = p.shifts?.[0];
        if (!shift1?.breaks) return 0;
        return shift1.breaks.reduce((sum, b) => sum + (b.duration || 0), 0);
    });
    const breaksSet = new Set(breakMinutes);
    if (breaksSet.size > 1) {
        details.push({
            field: 'breaks',
            fieldLabel: 'Pausas (Turno 1)',
            values: products.map((p, i) => ({
                productName: p.meta?.name || `Producto ${i + 1}`,
                value: `${breakMinutes[i]} min`
            }))
        });
    }

    // Generate user-friendly message
    if (details.length > 0) {
        const conflictFields = details.map(d => d.fieldLabel).join(', ');
        return {
            hasConflict: true,
            message: `⚠️ Conflicto de Configuración: Los productos tienen diferente configuración de ${conflictFields}. ` +
                `El sistema usará la configuración del primer producto (${refName}). ` +
                `Nota: Una línea física tiene un solo horario y OEE.`,
            details
        };
    }

    return { hasConflict: false, message: null, details: [] };
}

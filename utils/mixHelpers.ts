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
import { isTauri } from './unified_fs';
import { logger } from './logger';
import { generateChecksum } from './crypto';
import { resolveProductProcess, ParentLoaderFn } from '../core/inheritance/resolver';

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
                productName: ref.path.split(/[\/\\]/).pop()?.replace('.json', '') || 'Desconocido',
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
 * Load a mix scenario from a JSON file
 */
export async function loadMixScenario(path: string): Promise<MixScenario | null> {
    try {
        if (isTauri()) {
            const fs = await import('./unified_fs');
            const exists = await fs.exists(path);
            if (!exists) {
                logger.warn('mixHelpers', 'Scenario file not found', { path });
                return null;
            }
            const content = await fs.readTextFile(path);
            if (content) {
                const scenario = JSON.parse(content) as MixScenario;
                if (scenario.type !== 'mix_scenario') {
                    logger.error('mixHelpers', 'Invalid scenario type', { type: scenario.type });
                    return null;
                }
                return scenario;
            }
        }
        return null;
    } catch (e) {
        logger.error('mixHelpers', 'Failed to load scenario', { error: String(e) });
        return null;
    }
}

/**
 * Save a mix scenario to a JSON file
 * 
 * V8.3: Now calculates and stores checksums when loadedProducts are provided
 * 
 * @param scenario - Scenario to save
 * @param path - File path to save to
 * @param loadedProducts - Optional: products loaded in memory to calculate checksums
 */
export async function saveMixScenario(
    scenario: MixScenario,
    path: string,
    loadedProducts?: ProjectData[]
): Promise<boolean> {
    try {
        if (isTauri()) {
            const fs = await import('./unified_fs');

            // V8.3: Calculate checksums if products are provided
            let productsWithChecksum = scenario.products;
            if (loadedProducts && loadedProducts.length > 0) {
                productsWithChecksum = await Promise.all(
                    scenario.products.map(async (ref) => {
                        const product = loadedProducts.find(p =>
                            (p as MixEnrichedProduct)._mixPath === ref.path
                        );
                        if (product) {
                            const checksum = await generateProductChecksum(product);
                            return {
                                ...ref,
                                sourceChecksum: checksum,
                                lastVerifiedAt: new Date().toISOString()
                            };
                        }
                        return ref;
                    })
                );
            }

            // Ensure the scenario has proper metadata
            const toSave: MixScenario = {
                ...scenario,
                products: productsWithChecksum,
                type: 'mix_scenario',
                version: 1,
                integrityVersion: loadedProducts ? 1 : scenario.integrityVersion,
                lastIntegrityCheck: loadedProducts ? new Date().toISOString() : scenario.lastIntegrityCheck
            };

            const json = JSON.stringify(toSave, null, 2);
            return await fs.writeTextFile(path, json);
        }
        return false;
    } catch (e) {
        logger.error('mixHelpers', 'Failed to save scenario', { error: String(e) });
        return false;
    }
}


/**
 * Load multiple product files referenced by a mix scenario
 * Returns products with _mixDemand attached for weighted calculations
 */
export async function loadMixProducts(
    basePath: string,
    references: MixProductReference[]
): Promise<{
    products: ProjectData[];
    errors: string[];
    totalDemand: number;
    isPartial: boolean; // H-03 FIX: Flag for partial loading
}> {
    const products: ProjectData[] = [];
    const errors: string[] = [];
    let totalDemand = 0;

    if (!isTauri()) {
        return { products: [], errors: ['Mix loading requires Tauri mode'], totalDemand: 0, isPartial: false };
    }

    const fs = await import('./unified_fs');

    for (const ref of references) {
        try {
            // Handle both absolute and relative paths
            const fullPath = ref.path.includes(':')
                ? ref.path  // Absolute path
                : `${basePath}\\${ref.path}`; // Relative path

            const exists = await fs.exists(fullPath);

            if (!exists) {
                errors.push(`Archivo no encontrado: ${ref.path}`);
                continue;
            }

            const content = await fs.readTextFile(fullPath);
            if (content) {
                // H-04 FIX: Validate JSON structure before casting
                let project: ProjectData;
                try {
                    const parsed = JSON.parse(content);

                    // Validate minimum required structure
                    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
                        errors.push(`Archivo inválido: ${ref.path} - No contiene tareas válidas`);
                        continue;
                    }

                    // Create default meta if missing
                    if (!parsed.meta) {
                        parsed.meta = {
                            name: ref.path.split(/[\\/]/).pop()?.replace('.json', '') || 'Sin nombre',
                            date: new Date().toISOString(),
                            client: '',
                            version: '1',
                            engineer: '',
                            activeShifts: 1,
                            dailyDemand: ref.demand,
                            configuredStations: 0
                        };
                        logger.warn('mixHelpers', 'Archivo sin metadata, usando valores default', { path: ref.path });
                    }

                    project = parsed as ProjectData;
                } catch (parseError) {
                    errors.push(`Error de formato JSON: ${ref.path} - ${(parseError as Error).message}`);
                    continue;
                }

                // V9.0: Resolve inheritance if product has parentPath
                if (project.meta?.parentPath) {
                    try {
                        // Create loader function that uses same logic to load parent
                        const parentLoader: ParentLoaderFn = async (parentRelPath: string) => {
                            // Resolve parent path relative to child location
                            const childDir = fullPath.substring(0, fullPath.lastIndexOf('\\'));
                            const parentFullPath = parentRelPath.includes(':')
                                ? parentRelPath
                                : `${childDir}\\${parentRelPath}`;

                            const parentExists = await fs.exists(parentFullPath);
                            if (!parentExists) {
                                throw new Error(`Parent file not found: ${parentFullPath}`);
                            }

                            const parentContent = await fs.readTextFile(parentFullPath);
                            if (!parentContent) {
                                throw new Error(`Failed to read parent file: ${parentFullPath}`);
                            }

                            return JSON.parse(parentContent) as ProjectData;
                        };

                        const resolved = await resolveProductProcess(project, parentLoader);
                        project = resolved.project;

                        if (resolved.warnings.length > 0) {
                            logger.warn('mixHelpers', 'Inheritance warnings', {
                                path: ref.path,
                                warnings: resolved.warnings
                            });
                        }

                        logger.info('mixHelpers', 'Inheritance resolved', {
                            path: ref.path,
                            parentPath: project.meta.parentPath,
                            overridesApplied: resolved.overridesApplied
                        });
                    } catch (inheritError) {
                        errors.push(`Error de herencia: ${ref.path} - ${(inheritError as Error).message}`);
                        continue;
                    }
                }

                // Attach mix demand for weighted calculations (type-safe)
                const enriched = project as MixEnrichedProduct;
                enriched._mixDemand = ref.demand;
                enriched._mixPath = ref.path;

                products.push(enriched);
                totalDemand += ref.demand;
            }
        } catch (e) {
            errors.push(`Error cargando ${ref.path}: ${(e as Error).message}`);
        }
    }

    // Calculate percentages
    if (totalDemand > 0) {
        for (const product of products) {
            const demand = (product as MixEnrichedProduct)._mixDemand || 0;
            (product as MixEnrichedProduct)._mixPercentage = demand / totalDemand;
        }
    }

    // H-03 FIX: Detect and log partial loading
    const isPartial = products.length !== references.length;
    if (isPartial) {
        logger.warn('mixHelpers', 'Carga parcial de productos', {
            expected: references.length,
            loaded: products.length,
            missing: references.length - products.length
        });
    }

    return { products, errors, totalDemand, isPartial };
}

/**
 * Validate that all referenced products in a mix scenario still exist
 * and haven't been modified since last calculation
 * 
 * V8.3: Now includes checksum validation for integrity checking
 */
export async function validateMixIntegrity(
    scenario: MixScenario,
    basePath: string
): Promise<{
    valid: boolean;
    warnings: string[];
    needsRecalculation: boolean;
    integrityResult?: IntegrityVerificationResult;
}> {
    const warnings: string[] = [];
    let needsRecalculation = false;

    // Check if product files still exist
    const { products, errors } = await loadMixProducts(basePath, scenario.products);

    if (errors.length > 0) {
        return { valid: false, warnings: errors, needsRecalculation: true };
    }

    // Check if the number of loaded products matches references
    if (products.length !== scenario.products.length) {
        warnings.push('Algunos productos no pudieron ser cargados');
        needsRecalculation = true;
    }

    // V8.3: Checksum validation (if integrity version exists)
    if (scenario.integrityVersion && scenario.integrityVersion >= 1) {
        const integrityResult = await verifyMixIntegrity(scenario, products);

        if (integrityResult.hasWarnings) {
            const modifiedProducts = integrityResult.changes
                .filter(c => c.status === 'modified')
                .map(c => c.productName);

            warnings.push(
                `Productos modificados: ${modifiedProducts.join(', ')}. ` +
                `Se recomienda recalcular el balanceo.`
            );
            needsRecalculation = true;
        }

        return {
            valid: errors.length === 0 && integrityResult.isValid,
            warnings,
            needsRecalculation,
            integrityResult
        };
    }

    return {
        valid: errors.length === 0,
        warnings,
        needsRecalculation
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
export function addProductToMix(
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
export function removeProductFromMix(
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
export function updateProductDemand(
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

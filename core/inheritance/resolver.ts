/**
 * Product Inheritance Resolver (v9.0)
 * 
 * Merges parent product with child overrides at runtime.
 * Implements single-level inheritance for product variants (e.g., Left/Right Door).
 * 
 * @module core/inheritance/resolver
 */

import { ProjectData, Task, TaskOverride, TaskMaterial } from '../../types';

// =============================================================================
// PUBLIC TYPES
// =============================================================================

/**
 * Result of resolving a child product with its parent
 */
export interface ResolvedProduct {
    /** The resolved project with all tasks merged */
    project: ProjectData;
    /** True if inheritance was applied (parentPath existed) */
    wasResolved: boolean;
    /** Path to parent file (if any) */
    parentPath?: string;
    /** Number of overrides successfully applied */
    overridesApplied: number;
    /** Warnings (e.g., override for non-existent task) */
    warnings: string[];
}

/**
 * Function type for loading a parent project JSON
 * Injected to allow testing without filesystem access
 */
export type ParentLoaderFn = (relativePath: string) => Promise<ProjectData>;

// =============================================================================
// MAIN RESOLVER FUNCTION
// =============================================================================

/**
 * Resolves product inheritance by merging parent tasks with child overrides.
 * 
 * Algorithm:
 * 1. If no parentPath, return project unchanged
 * 2. Load parent using provided loader function
 * 3. Detect cycles (child cannot reference itself or create loops)
 * 4. Copy all tasks from parent
 * 5. Apply child's taskOverrides on top
 * 6. Return flattened project with metadata
 * 
 * @param childProject - The child project with taskOverrides
 * @param loadParentFn - Function to load parent JSON (injectable for tests)
 * @param visitedPaths - Internal: tracks paths to detect cycles
 * @returns Resolved product with merged tasks
 * 
 * @example
 * ```typescript
 * const resolved = await resolveProductProcess(
 *   childProject,
 *   async (path) => JSON.parse(await fs.readFile(path, 'utf-8'))
 * );
 * 
 * if (resolved.wasResolved) {
 *   console.log(`Applied ${resolved.overridesApplied} overrides`);
 * }
 * ```
 */
export async function resolveProductProcess(
    childProject: ProjectData,
    loadParentFn: ParentLoaderFn,
    visitedPaths: Set<string> = new Set()
): Promise<ResolvedProduct> {
    const warnings: string[] = [];

    // Case 1: No parent - return unchanged
    const parentPath = childProject.meta.parentPath;
    if (!parentPath) {
        return {
            project: childProject,
            wasResolved: false,
            overridesApplied: 0,
            warnings: []
        };
    }

    // Case 2: Cycle detection
    if (visitedPaths.has(parentPath)) {
        throw new Error(
            `[Inheritance Error] Cycle detected: "${parentPath}" was already visited. ` +
            `Chain: ${Array.from(visitedPaths).join(' → ')} → ${parentPath}`
        );
    }
    visitedPaths.add(parentPath);

    // Case 3: Load parent
    let parentProject: ProjectData;
    try {
        parentProject = await loadParentFn(parentPath);
    } catch (error) {
        throw new Error(
            `[Inheritance Error] Failed to load parent from "${parentPath}": ${error instanceof Error ? error.message : String(error)}`
        );
    }

    // Case 4: Recursively resolve parent (in case it also has a parent)
    // Note: We only support 1 level per spec, but this makes it future-proof
    const resolvedParent = await resolveProductProcess(
        parentProject,
        loadParentFn,
        visitedPaths
    );

    // Collect parent warnings
    warnings.push(...resolvedParent.warnings);

    // Case 5: Merge parent tasks with child overrides
    const parentTasks = resolvedParent.project.tasks;
    const childOverrides = childProject.taskOverrides || [];

    // Create a map for quick override lookup
    const overrideMap = new Map<string, TaskOverride>();
    for (const override of childOverrides) {
        overrideMap.set(override.taskId, override);
    }

    // Apply overrides to parent tasks
    const mergedTasks: Task[] = [];
    const appliedOverrides = new Set<string>();

    for (const parentTask of parentTasks) {
        const override = overrideMap.get(parentTask.id);

        if (override) {
            appliedOverrides.add(override.taskId);

            // Check if task is excluded
            if (override.excluded === true) {
                // Skip this task entirely
                continue;
            }

            // Apply override fields
            const mergedTask: Task = {
                ...parentTask,
                // Override standardTime if specified
                ...(override.standardTime !== undefined && {
                    standardTime: override.standardTime
                }),
                // Override materials if specified (complete replacement)
                ...(override.materials !== undefined && {
                    materials: override.materials
                }),
                // Mark as inherited for UI purposes (internal flag)
                _inherited: true,
                _overridden: true
            } as Task & { _inherited?: boolean; _overridden?: boolean };

            mergedTasks.push(mergedTask);
        } else {
            // No override - inherit as-is with marker
            mergedTasks.push({
                ...parentTask,
                _inherited: true
            } as Task & { _inherited?: boolean });
        }
    }

    // Check for orphan overrides (overrides that didn't match any parent task)
    for (const override of childOverrides) {
        if (!appliedOverrides.has(override.taskId)) {
            warnings.push(
                `[Warning] Override for task "${override.taskId}" did not match any parent task. ` +
                `This override was ignored.`
            );
        }
    }

    // Case 6: Add any NEW tasks that exist only in child (not overrides)
    // These are tasks in child.tasks[] that don't have matching IDs in parent
    const parentTaskIds = new Set(parentTasks.map(t => t.id));
    for (const childTask of childProject.tasks) {
        if (!parentTaskIds.has(childTask.id)) {
            mergedTasks.push({
                ...childTask,
                _inherited: false
            } as Task & { _inherited?: boolean });
        }
    }

    // Build the final resolved project
    const resolvedProject: ProjectData = {
        ...childProject,
        tasks: mergedTasks,
        // Preserve child's other arrays as-is
        assignments: childProject.assignments.length > 0
            ? childProject.assignments
            : resolvedParent.project.assignments,
        stationConfigs: childProject.stationConfigs.length > 0
            ? childProject.stationConfigs
            : resolvedParent.project.stationConfigs,
        // Merge materials catalogs (child takes precedence)
        materials: mergeMaterialsCatalogs(
            resolvedParent.project.materials,
            childProject.materials
        ),
        // Clear inheritance fields after resolution (already applied)
        meta: {
            ...childProject.meta,
            // Keep parentPath for reference but mark as resolved
            _resolvedFromParent: parentPath
        } as ProjectData['meta'] & { _resolvedFromParent?: string }
    };

    return {
        project: resolvedProject,
        wasResolved: true,
        parentPath,
        overridesApplied: appliedOverrides.size,
        warnings
    };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Merges two material catalogs, with child materials taking precedence.
 */
function mergeMaterialsCatalogs(
    parentMaterials: ProjectData['materials'],
    childMaterials: ProjectData['materials']
): ProjectData['materials'] {
    if (!parentMaterials && !childMaterials) return undefined;
    if (!parentMaterials) return childMaterials;
    if (!childMaterials) return parentMaterials;

    const merged = new Map<string, typeof parentMaterials[0]>();

    // Add parent materials first
    for (const mat of parentMaterials) {
        merged.set(mat.id, mat);
    }

    // Child materials override
    for (const mat of childMaterials) {
        merged.set(mat.id, mat);
    }

    return Array.from(merged.values());
}

/**
 * Validates that a project's inheritance chain is valid.
 * Use this before saving to catch configuration errors.
 * 
 * @param project - Project to validate
 * @param loadParentFn - Function to load parent
 * @returns Validation result with any errors
 */
export async function validateInheritance(
    project: ProjectData,
    loadParentFn: ParentLoaderFn
): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!project.meta.parentPath) {
        return { valid: true, errors: [] };
    }

    try {
        const resolved = await resolveProductProcess(project, loadParentFn);

        if (resolved.warnings.length > 0) {
            // Warnings are not blocking, but we report them
            errors.push(...resolved.warnings.map(w => `Warning: ${w}`));
        }

        return {
            valid: resolved.warnings.filter(w => !w.startsWith('[Warning]')).length === 0,
            errors
        };
    } catch (error) {
        return {
            valid: false,
            errors: [error instanceof Error ? error.message : String(error)]
        };
    }
}

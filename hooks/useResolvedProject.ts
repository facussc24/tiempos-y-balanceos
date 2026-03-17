/**
 * useResolvedProject Hook
 * 
 * Resolves product inheritance at runtime for UI components.
 * If a project has parentPath, loads parent and applies overrides.
 * 
 * @module hooks/useResolvedProject
 * @version 9.0.0
 */

import { useState, useEffect, useMemo } from 'react';
import { ProjectData } from '../types';
import { resolveProductProcess, ResolvedProduct, ParentLoaderFn } from '../core/inheritance/resolver';
import { isTauri } from '../utils/unified_fs';
import { logger } from '../utils/logger';

export interface UseResolvedProjectResult {
    /** Resolved project data (with inheritance applied) */
    resolvedData: ProjectData;
    /** True if resolution is in progress */
    isResolving: boolean;
    /** True if inheritance was applied */
    wasResolved: boolean;
    /** Parent path if resolved */
    parentPath?: string;
    /** Number of overrides applied */
    overridesApplied: number;
    /** Any warnings from resolution */
    warnings: string[];
    /** Error message if resolution failed */
    error?: string;
}

/**
 * Hook to resolve product inheritance for a ProjectData object.
 * 
 * Usage:
 * ```tsx
 * const { resolvedData, isResolving, wasResolved } = useResolvedProject(data, rootHandle);
 * 
 * if (isResolving) return <Spinner />;
 * 
 * // Use resolvedData for rendering - it has all inherited tasks
 * ```
 * 
 * @param data - The project data (potentially with parentPath)
 * @param rootHandle - File system directory handle for loading parent
 * @returns Resolved project and resolution status
 */
export function useResolvedProject(
    data: ProjectData,
    rootHandle?: FileSystemDirectoryHandle | string | null
): UseResolvedProjectResult {
    const [resolved, setResolved] = useState<ResolvedProduct | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [error, setError] = useState<string | undefined>();

    // Check if resolution is needed
    const needsResolution = Boolean(data.meta?.parentPath);

    useEffect(() => {
        // Skip if no inheritance needed
        if (!needsResolution) {
            setResolved(null);
            setIsResolving(false);
            setError(undefined);
            return;
        }

        // Skip if no filesystem access
        if (!isTauri()) {
            logger.warn('useResolvedProject', 'Inheritance requires Tauri mode');
            setResolved(null);
            setIsResolving(false);
            return;
        }

        // FIX: Race condition guard — prevents setState on unmounted component
        // or when effect re-runs with new data before previous async completes
        let cancelled = false;

        // Create loader function
        const resolveAsync = async () => {
            setIsResolving(true);
            setError(undefined);

            try {
                const fs = await import('../utils/unified_fs');
                if (cancelled) return;

                // Determine base directory from rootHandle or default
                const baseDir = typeof rootHandle === 'string'
                    ? rootHandle
                    : ''; // In Tauri, parentPath should be relative or absolute

                const parentLoader: ParentLoaderFn = async (parentRelPath: string) => {
                    // Resolve path: prefer absolute, fallback to relative from rootHandle
                    const fullPath = parentRelPath.includes(':')
                        ? parentRelPath
                        : baseDir
                            ? `${baseDir}\\${parentRelPath}`
                            : parentRelPath;

                    const exists = await fs.exists(fullPath);
                    if (!exists) {
                        throw new Error(`Parent file not found: ${fullPath}`);
                    }

                    const content = await fs.readTextFile(fullPath);
                    if (!content) {
                        throw new Error(`Failed to read parent file: ${fullPath}`);
                    }

                    return JSON.parse(content) as ProjectData;
                };

                const result = await resolveProductProcess(data, parentLoader);
                if (cancelled) return;

                setResolved(result);

                if (result.warnings.length > 0) {
                    logger.warn('useResolvedProject', 'Resolution warnings', {
                        warnings: result.warnings
                    });
                }

                logger.info('useResolvedProject', 'Inheritance resolved', {
                    parentPath: result.parentPath,
                    overridesApplied: result.overridesApplied
                });

            } catch (err) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : String(err);
                logger.error('useResolvedProject', 'Resolution failed', { error: message });
                setError(message);
                setResolved(null);
            } finally {
                if (!cancelled) setIsResolving(false);
            }
        };

        resolveAsync();

        return () => { cancelled = true; };
    }, [data, rootHandle, needsResolution]);

    // If no resolution needed, return original data
    if (!needsResolution) {
        return {
            resolvedData: data,
            isResolving: false,
            wasResolved: false,
            overridesApplied: 0,
            warnings: [],
            error: undefined
        };
    }

    // If resolving, return original data temporarily
    if (isResolving || !resolved) {
        return {
            resolvedData: data, // Fallback to original during resolution
            isResolving,
            wasResolved: false,
            overridesApplied: 0,
            warnings: [],
            error
        };
    }

    // Return resolved data
    return {
        resolvedData: resolved.project,
        isResolving: false,
        wasResolved: resolved.wasResolved,
        parentPath: resolved.parentPath,
        overridesApplied: resolved.overridesApplied,
        warnings: resolved.warnings,
        error
    };
}

/**
 * Sync version for components that already have resolved data
 * or don't need async resolution (e.g., Mix already resolves in loadMixProducts)
 */
export function useResolvedProjectSync(data: ProjectData): ProjectData {
    // Just return data as-is - useful as a placeholder for future optimization
    return data;
}

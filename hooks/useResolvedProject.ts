/**
 * useResolvedProject Hook
 *
 * Historically resolved product inheritance by loading a parent file from
 * the Tauri filesystem and applying overrides. In the web build the parent
 * project is expected to already be resolved by the caller (e.g. the Mix
 * module fetches both products from Supabase before handing them to the UI),
 * so this hook returns the input data as-is.
 *
 * @module hooks/useResolvedProject
 */

import { ProjectData } from '../types';

export interface UseResolvedProjectResult {
    resolvedData: ProjectData;
    isResolving: boolean;
    wasResolved: boolean;
    parentPath?: string;
    overridesApplied: number;
    warnings: string[];
    error?: string;
}

/**
 * Hook to resolve product inheritance for a ProjectData object.
 * Web mode: pass-through. Inheritance is resolved upstream at fetch time.
 */
export function useResolvedProject(
    data: ProjectData,
    _rootHandle?: FileSystemDirectoryHandle | string | null,
): UseResolvedProjectResult {
    return {
        resolvedData: data,
        isResolving: false,
        wasResolved: false,
        overridesApplied: 0,
        warnings: [],
        error: undefined,
    };
}

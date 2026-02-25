/**
 * AMFE Library Types
 *
 * Defines the global operations library where base operations (e.g., "Corte", "Soldadura")
 * are stored and can be imported into individual AMFE projects with active inheritance.
 * Changes to a library operation propagate to all linked AMFE projects on sync.
 */

import { AmfeWorkElement } from './amfeTypes';

/** A base operation template stored in the global library. */
export interface AmfeLibraryOperation {
    id: string;
    opNumber: string;
    name: string;
    workElements: AmfeWorkElement[];
    lastModified: string; // ISO 8601
    version: number;
    description?: string; // Optional user note about this template
    /** Category for filtering (e.g., "corte", "soldadura", "ensamble", "pintura") */
    category?: string;
    /** Freeform tags for search (e.g., ["CNC", "laser", "mesa de corte"]) */
    tags?: string[];
}

/** Standard library categories with Spanish labels. */
export const LIBRARY_CATEGORIES: { value: string; label: string }[] = [
    { value: 'corte', label: 'Corte' },
    { value: 'soldadura', label: 'Soldadura' },
    { value: 'ensamble', label: 'Ensamble' },
    { value: 'mecanizado', label: 'Mecanizado' },
    { value: 'pintura', label: 'Pintura / Acabado' },
    { value: 'inyeccion', label: 'Inyeccion Plastica' },
    { value: 'inspeccion', label: 'Inspeccion / Control' },
    { value: 'embalaje', label: 'Embalaje / Logistica' },
    { value: 'otro', label: 'Otro' },
];

/**
 * Build searchable text from a library operation for full-text search.
 * Concatenates operation name + all work element names + all function descriptions
 * + all failure descriptions + all cause texts + tags.
 */
export function buildSearchableText(op: AmfeLibraryOperation): string {
    const parts: string[] = [op.name, op.description || ''];
    if (op.tags) parts.push(...op.tags);

    for (const we of op.workElements) {
        parts.push(we.name, we.type);
        for (const func of we.functions) {
            parts.push(func.description);
            for (const fail of func.failures) {
                parts.push(fail.description, fail.effectLocal || '', fail.effectNextLevel || '', fail.effectEndUser || '');
                for (const cause of fail.causes) {
                    parts.push(cause.cause, cause.preventionControl || '', cause.detectionControl || '');
                }
            }
        }
    }

    return parts.filter(Boolean).join(' ').toLowerCase();
}

/** The global library document persisted to the network drive. */
export interface AmfeLibrary {
    operations: AmfeLibraryOperation[];
    lastModified: string;
}

/** Empty library for initialization. */
export const EMPTY_LIBRARY: AmfeLibrary = {
    operations: [],
    lastModified: new Date().toISOString(),
};

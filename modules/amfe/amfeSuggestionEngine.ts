/**
 * AMFE Suggestion Engine
 *
 * Local pattern-matching engine that suggests failures, causes, and controls
 * based on existing library operations and AMFE documents.
 * Respects the 6M structure: suggestions are filtered by context
 * (operation name, work element type/name) for relevance.
 *
 * Validated by NotebookLM as "totally aligned" with AIAG-VDA Family FMEAs concept.
 */

import { AmfeOperation } from './amfeTypes';
import { AmfeLibraryOperation } from './amfeLibraryTypes';

/** A single suggestion with source attribution */
export interface Suggestion {
    text: string;
    source: string; // e.g., "Biblioteca: Corte Laser" or "AMFE: Proyecto X"
    frequency: number; // how many times this text appears across sources
}

/** Fields that can be suggested */
export type SuggestionField =
    | 'failureDescription'
    | 'cause'
    | 'preventionControl'
    | 'detectionControl'
    | 'effectLocal'
    | 'effectNextLevel'
    | 'effectEndUser';

/** Context for filtering suggestions (6M-aware) */
export interface SuggestionContext {
    operationName?: string;
    workElementType?: string;
    workElementName?: string;
    failureDescription?: string; // for cause/control suggestions, filter by related failure
    existingValues?: string[]; // values already in the AMFE for this field (anti-context for AI)
    // Fase 2K: enriched context for better AI suggestions
    functionDescription?: string;    // e.g. "Aplicar cordon de soldadura segun especificacion"
    functionRequirements?: string;   // e.g. "ISO 3834, penetracion >= 80%"
    severity?: number;               // parsed fail.severity (1-10)
    occurrence?: number;             // parsed cause.occurrence (1-10)
    detection?: number;              // parsed cause.detection (1-10)
    causeText?: string;              // cause text — for prevention/detection control prompts
    effectsContext?: string;         // concatenated effects summary — for cause prompts
    operationCategory?: string;      // soldadura|ensamble|pintura|mecanizado|inyeccion|inspeccion
}

/** Internal index entry */
interface IndexEntry {
    text: string;
    source: string;
    opName: string;
    weType: string;
    weName: string;
    failDesc: string; // parent failure description (for cause/control context)
}

/**
 * Build a suggestion index from library operations and AMFE operations.
 * The index is a flat array per field, designed for fast in-memory filtering.
 */
export function buildSuggestionIndex(
    libraryOps: AmfeLibraryOperation[],
    amfeOps: { ops: AmfeOperation[]; sourceName: string }[] = [],
): SuggestionIndex {
    const index: SuggestionIndex = {
        failureDescription: [],
        cause: [],
        preventionControl: [],
        detectionControl: [],
        effectLocal: [],
        effectNextLevel: [],
        effectEndUser: [],
    };

    // Index library operations
    for (const libOp of libraryOps) {
        const source = `Biblioteca: ${libOp.name}`;
        indexOperation(index, libOp, source);
    }

    // Index AMFE operations
    for (const { ops, sourceName } of amfeOps) {
        for (const op of ops) {
            const source = `AMFE: ${sourceName}`;
            indexOperation(index, op, source);
        }
    }

    return index;
}

function indexOperation(
    index: SuggestionIndex,
    op: { opNumber?: string; name: string; workElements: any[] },
    source: string,
): void {
    const opName = op.name;

    for (const we of op.workElements) {
        const weType = we.type || '';
        const weName = we.name || '';

        for (const func of we.functions || []) {
            for (const fail of func.failures || []) {
                const failDesc = fail.description || '';
                const base = { source, opName, weType, weName, failDesc };

                if (failDesc) {
                    index.failureDescription.push({ ...base, text: failDesc });
                }
                if (fail.effectLocal) {
                    index.effectLocal.push({ ...base, text: fail.effectLocal });
                }
                if (fail.effectNextLevel) {
                    index.effectNextLevel.push({ ...base, text: fail.effectNextLevel });
                }
                if (fail.effectEndUser) {
                    index.effectEndUser.push({ ...base, text: fail.effectEndUser });
                }

                for (const cause of fail.causes || []) {
                    if (cause.cause) {
                        index.cause.push({ ...base, text: cause.cause });
                    }
                    if (cause.preventionControl) {
                        index.preventionControl.push({ ...base, text: cause.preventionControl });
                    }
                    if (cause.detectionControl) {
                        index.detectionControl.push({ ...base, text: cause.detectionControl });
                    }
                }
            }
        }
    }
}

/** The full suggestion index (one array per field) */
export interface SuggestionIndex {
    failureDescription: IndexEntry[];
    cause: IndexEntry[];
    preventionControl: IndexEntry[];
    detectionControl: IndexEntry[];
    effectLocal: IndexEntry[];
    effectNextLevel: IndexEntry[];
    effectEndUser: IndexEntry[];
}

/**
 * Query the suggestion index for a given field, input text, and context.
 * Returns up to `limit` suggestions ranked by relevance.
 *
 * Relevance scoring:
 * 1. Exact context match (same WE type + name) = highest
 * 2. Same operation name = high
 * 3. Same failure context (for causes/controls) = medium
 * 4. Text match only = low
 *
 * Respects 6M structure: if context includes workElementType "Machine" and name "Inyectora",
 * suggestions from similar machines rank higher than generic ones.
 */
export function querySuggestions(
    index: SuggestionIndex,
    field: SuggestionField,
    input: string,
    context: SuggestionContext = {},
    limit: number = 8,
): Suggestion[] {
    const entries = index[field];
    if (!entries || entries.length === 0) return [];

    const query = input.toLowerCase().trim();
    if (query.length < 2) return [];

    // Score and filter entries
    const scored = new Map<string, { score: number; source: string; count: number }>();

    for (const entry of entries) {
        const textLower = entry.text.toLowerCase();

        // Must match input (prefix or contains)
        if (!textLower.includes(query)) continue;

        // Skip exact match with current value (don't suggest what's already typed)
        if (textLower === query) continue;

        let score = 1;

        // Context scoring (6M aware)
        if (context.workElementType && entry.weType === context.workElementType) {
            score += 3;
        }
        if (context.workElementName && entry.weName.toLowerCase().includes(context.workElementName.toLowerCase())) {
            score += 4;
        }
        if (context.operationName && entry.opName.toLowerCase().includes(context.operationName.toLowerCase())) {
            score += 2;
        }
        if (context.failureDescription && entry.failDesc.toLowerCase().includes(context.failureDescription.toLowerCase())) {
            score += 3;
        }

        // Prefix match bonus
        if (textLower.startsWith(query)) {
            score += 2;
        }

        // Accumulate
        const key = entry.text;
        const existing = scored.get(key);
        if (existing) {
            existing.score = Math.max(existing.score, score);
            existing.count++;
            // Prefer library source over AMFE source
            if (entry.source.startsWith('Biblioteca:') && !existing.source.startsWith('Biblioteca:')) {
                existing.source = entry.source;
            }
        } else {
            scored.set(key, { score, source: entry.source, count: 1 });
        }
    }

    // Sort by score descending, then by frequency
    return [...scored.entries()]
        .sort((a, b) => {
            const scoreDiff = b[1].score - a[1].score;
            if (scoreDiff !== 0) return scoreDiff;
            return b[1].count - a[1].count;
        })
        .slice(0, limit)
        .map(([text, { source, count }]) => ({
            text,
            source,
            frequency: count,
        }));
}

// ============================================================================
// COMBINED SUGGESTIONS
// ============================================================================

export interface AllSuggestionsResult {
    local: Suggestion[];
    ai: Suggestion[] | null; // null = not queried / disabled
    aiLoading: boolean;
}

/**
 * Query local suggestions.
 * Local results return immediately via onUpdate.
 * Returns an AbortController for API compatibility.
 *
 * @param existingLocal - If provided, skip local recomputation and use these.
 */
export function queryAllSuggestions(
    index: SuggestionIndex | null,
    field: SuggestionField,
    input: string,
    context: SuggestionContext,
    aiEnabled: boolean,
    onUpdate: (result: AllSuggestionsResult) => void,
    existingLocal?: Suggestion[],
): AbortController {
    const controller = new AbortController();

    // Local suggestions (synchronous, immediate) — skip if caller provides them
    const local = existingLocal ?? (index
        ? querySuggestions(index, field, input, context)
        : []);

    onUpdate({ local, ai: null, aiLoading: false });
    return controller;
}

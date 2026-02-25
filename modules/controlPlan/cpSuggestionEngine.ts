/**
 * Control Plan Suggestion Engine
 *
 * Orchestrator for CP AI suggestions. Simpler than the AMFE engine
 * because CP has no local pattern-matching library — all suggestions
 * come from Gemini AI.
 *
 * Compatible with the generic SuggestableTextarea queryFn interface.
 */

import { getCpAiSuggestions, CpSuggestion } from './cpAiSuggestions';
import { CpSuggestionField, CpSuggestionContext } from './cpSuggestionTypes';

/** Result shape compatible with SuggestableTextarea's AllSuggestionsResult */
export interface CpAllSuggestionsResult {
    local: CpSuggestion[];
    ai: CpSuggestion[] | null;
    aiLoading: boolean;
}

/**
 * Query CP suggestions (AI-only, no local index).
 *
 * Returns an AbortController for cancellation support.
 * Compatible with SuggestableTextarea's queryFn signature.
 */
export function queryCpSuggestions(
    field: CpSuggestionField,
    context: CpSuggestionContext,
    input: string,
    aiEnabled: boolean,
    onUpdate: (result: CpAllSuggestionsResult) => void,
    existingLocal?: CpSuggestion[],
): AbortController {
    const controller = new AbortController();
    const local: CpSuggestion[] = existingLocal ?? [];

    // If AI disabled or input too short, return immediately
    if (!aiEnabled || !input || input.trim().length < 2) {
        onUpdate({ local, ai: aiEnabled ? [] : null, aiLoading: false });
        return controller;
    }

    // Signal AI loading
    onUpdate({ local, ai: null, aiLoading: true });

    // Fire AI query
    getCpAiSuggestions(field, context, input, controller.signal)
        .then(aiResults => {
            if (controller.signal.aborted) return;
            onUpdate({ local, ai: aiResults, aiLoading: false });
        })
        .catch(() => {
            if (controller.signal.aborted) return;
            onUpdate({ local, ai: [], aiLoading: false });
        });

    return controller;
}

/**
 * Factory to create a queryFn closure for a specific CP item + field.
 * Returns a function compatible with SuggestableTextarea's queryFn prop.
 */
export function createCpQueryFn(
    field: CpSuggestionField,
    context: CpSuggestionContext,
): (
    input: string,
    aiEnabled: boolean,
    onUpdate: (result: CpAllSuggestionsResult) => void,
    existingLocal?: CpSuggestion[],
) => AbortController {
    return (input, aiEnabled, onUpdate, existingLocal) =>
        queryCpSuggestions(field, context, input, aiEnabled, onUpdate, existingLocal);
}

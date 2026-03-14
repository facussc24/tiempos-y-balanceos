/**
 * Suggestable Textarea
 *
 * Drop-in replacement for AutoResizeTextarea that adds autocomplete suggestions.
 * Supports two modes:
 * 1. AMFE mode (default): uses built-in amfeSuggestionEngine with index + field
 * 2. Generic mode: uses a custom queryFn prop (for Control Plan, etc.)
 * Shows local suggestions instantly and AI suggestions async with a spinner.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import AutoResizeTextarea from './AutoResizeTextarea';
import SuggestionPopover from '../../components/ui/SuggestionPopover';
import {
    queryAllSuggestions,
    AllSuggestionsResult,
    SuggestionIndex,
    SuggestionField,
    SuggestionContext,
    Suggestion,
} from './amfeSuggestionEngine';

/** Generic query function signature for custom suggestion engines */
export type SuggestionQueryFn = (
    input: string,
    aiEnabled: boolean,
    onUpdate: (result: AllSuggestionsResult) => void,
    existingLocal?: Suggestion[],
) => AbortController | void;

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string | number;
    /** The suggestion index to query against (AMFE mode) */
    suggestionIndex?: SuggestionIndex | null;
    /** Which field type this textarea represents (AMFE mode) */
    suggestionField?: SuggestionField;
    /** Context for filtering suggestions (AMFE mode, 6M aware) */
    suggestionContext?: SuggestionContext;
    /** Whether AI suggestions are enabled */
    aiEnabled?: boolean;
    /** Callback when the value changes (replaces onChange for suggestion integration) */
    onValueChange?: (newValue: string) => void;
    /** Custom query function — when provided, replaces the AMFE suggestion engine (generic mode) */
    queryFn?: SuggestionQueryFn;
}

const SuggestableTextarea: React.FC<Props> = ({
    value,
    suggestionIndex,
    suggestionField,
    suggestionContext = {},
    aiEnabled = false,
    onValueChange,
    onChange,
    onFocus,
    onBlur,
    queryFn,
    ...props
}) => {
    const [localSuggestions, setLocalSuggestions] = useState<Suggestion[]>([]);
    const [aiSuggestions, setAiSuggestions] = useState<Suggestion[] | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const localDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const aiAbortRef = useRef<AbortController | null>(null);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastLocalRef = useRef<Suggestion[]>([]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (localDebounceRef.current) clearTimeout(localDebounceRef.current);
            if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
            if (aiAbortRef.current) aiAbortRef.current.abort();
        };
    }, []);

    // Local-only query: computes local suggestions, no AI
    const triggerLocalQuery = useCallback((text: string) => {
        const handleResult = (result: AllSuggestionsResult) => {
            lastLocalRef.current = result.local;
            setLocalSuggestions(result.local);
            setAiSuggestions(result.ai);
            setAiLoading(result.aiLoading);
            if (result.local.length > 0) setShowSuggestions(true);
        };

        if (queryFn) {
            queryFn(text, false, handleResult);
        } else {
            queryAllSuggestions(
                suggestionIndex!,
                suggestionField!,
                text,
                suggestionContext,
                false,
                handleResult,
            );
        }
    }, [queryFn, suggestionIndex, suggestionField, suggestionContext]);

    // Monotonic request ID to discard stale AI results
    const aiRequestIdRef = useRef(0);

    // AI-only query: reuses existing local results, fires AI async
    const triggerAiQuery = useCallback((text: string) => {
        if (aiAbortRef.current) {
            aiAbortRef.current.abort();
            aiAbortRef.current = null;
        }

        const requestId = ++aiRequestIdRef.current;

        const handleResult = (result: AllSuggestionsResult) => {
            // Discard stale results from superseded requests
            if (aiRequestIdRef.current !== requestId) return;
            setLocalSuggestions(result.local);
            setAiSuggestions(result.ai);
            setAiLoading(result.aiLoading);
            if (result.local.length > 0 || (result.ai && result.ai.length > 0)) {
                setShowSuggestions(true);
            }
        };

        if (queryFn) {
            const controller = queryFn(text, true, handleResult, lastLocalRef.current);
            if (controller) aiAbortRef.current = controller;
        } else {
            aiAbortRef.current = queryAllSuggestions(
                suggestionIndex!,
                suggestionField!,
                text,
                suggestionContext,
                true,
                handleResult,
                lastLocalRef.current,
            );
        }
    }, [queryFn, suggestionIndex, suggestionField, suggestionContext]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;

        // Forward onChange
        if (onChange) onChange(e);
        if (onValueChange) onValueChange(newValue);

        // Cancel pending debounces
        if (localDebounceRef.current) clearTimeout(localDebounceRef.current);
        if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);

        // Cancel in-flight AI request (user is still typing)
        if (aiAbortRef.current) {
            aiAbortRef.current.abort();
            aiAbortRef.current = null;
        }

        // Local suggestions: fast debounce (150ms)
        localDebounceRef.current = setTimeout(() => {
            triggerLocalQuery(newValue);
        }, 150);

        // AI suggestions: slower debounce (500ms) to avoid excessive API calls
        if (aiEnabled) {
            aiDebounceRef.current = setTimeout(() => {
                triggerAiQuery(newValue);
            }, 500);
        }
    }, [onChange, onValueChange, triggerLocalQuery, triggerAiQuery, aiEnabled]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(true);
        if (onFocus) onFocus(e);
        const hasAnySuggestion = localSuggestions.length > 0 || (aiSuggestions && aiSuggestions.length > 0);
        if (hasAnySuggestion) setShowSuggestions(true);
    }, [onFocus, localSuggestions.length, aiSuggestions]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(false);
        // Delay to allow click on suggestion — tracked for cleanup
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 200);
        if (onBlur) onBlur(e);
    }, [onBlur]);

    const handleSelect = useCallback((text: string) => {
        if (onValueChange) onValueChange(text);
        setShowSuggestions(false);
        setLocalSuggestions([]);
        setAiSuggestions(null);
        setAiLoading(false);
    }, [onValueChange]);

    const handleDismiss = useCallback(() => {
        setShowSuggestions(false);
    }, []);

    // If no suggestion source and no AI, render plain textarea
    if (!queryFn && !suggestionIndex && !aiEnabled) {
        return <AutoResizeTextarea value={value} onChange={onChange} onFocus={onFocus} onBlur={onBlur} {...props} />;
    }

    const hasAnySuggestion = localSuggestions.length > 0 || (aiSuggestions && aiSuggestions.length > 0) || aiLoading;

    return (
        <div className="relative w-full">
            <AutoResizeTextarea
                value={value}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                {...props}
            />
            <SuggestionPopover
                localSuggestions={localSuggestions}
                aiSuggestions={aiSuggestions}
                aiLoading={aiLoading}
                onSelect={handleSelect}
                visible={showSuggestions && isFocused && !!hasAnySuggestion}
                onDismiss={handleDismiss}
            />
        </div>
    );
};

export default React.memo(SuggestableTextarea);

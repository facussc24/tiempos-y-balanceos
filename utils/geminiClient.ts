/**
 * Gemini API Client
 *
 * Thin wrapper over @google/generative-ai for AMFE suggestions and Chat Copilot.
 * Uses settingsStore for API key, includes prompt caching and timeout.
 */

import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { loadSettings } from './settingsStore';

// ============================================================================
// TYPES
// ============================================================================

export interface GeminiQueryResult {
    text: string;
    cached: boolean;
}

export interface GeminiConnectionStatus {
    ok: boolean;
    error?: string;
    model?: string;
}

// ============================================================================
// CACHE (in-memory, per-session)
// ============================================================================

const cache = new Map<string, { result: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(systemPrompt: string, userPrompt: string): string {
    // Hash the full system prompt to avoid cross-context cache collisions
    // (e.g., AMFE and CP prompts with similar prefixes but different content)
    let hash = 0;
    for (let i = 0; i < systemPrompt.length; i++) {
        hash = ((hash << 5) - hash + systemPrompt.charCodeAt(i)) | 0;
    }
    return hash + '||' + userPrompt;
}

function getCached(key: string): string | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return entry.result;
}

function setCache(key: string, result: string): void {
    // Limit cache size — evict oldest 20 entries when over limit
    if (cache.size >= 200) {
        const keysToDelete = [...cache.keys()].slice(0, 20);
        for (const k of keysToDelete) cache.delete(k);
    }
    cache.set(key, { result, timestamp: Date.now() });
}

// ============================================================================
// CIRCUIT BREAKER (prevents wasting quota when Gemini is down)
// ============================================================================

let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN = 60000; // 60 seconds

function checkCircuitBreaker(): void {
    if (consecutiveFailures >= CIRCUIT_THRESHOLD && Date.now() < circuitOpenUntil) {
        throw new GeminiError(
            `IA temporalmente deshabilitada (reintentando en ${Math.ceil((circuitOpenUntil - Date.now()) / 1000)}s)`,
            'TIMEOUT',
        );
    }
}

function recordSuccess(): void {
    consecutiveFailures = 0;
}

function recordFailure(): void {
    consecutiveFailures++;
    if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN;
    }
}

/** Reset circuit breaker state (for tests and after settings change). */
export function resetCircuitBreaker(): void {
    consecutiveFailures = 0;
    circuitOpenUntil = 0;
}

// ============================================================================
// CLIENT
// ============================================================================

let clientInstance: GoogleGenerativeAI | null = null;
let modelInstance: GenerativeModel | null = null;
let lastApiKey: string | null = null;

// gemini-2.5-flash-lite: best free tier (15 RPM, 1000 RPD, 250k TPM)
// gemini-2.0-flash retires March 31, 2026
const MODEL_NAME = 'gemini-2.5-flash-lite';

function getClient(apiKey: string): { client: GoogleGenerativeAI; model: GenerativeModel } {
    if (clientInstance && lastApiKey === apiKey && modelInstance) {
        return { client: clientInstance, model: modelInstance };
    }

    clientInstance = new GoogleGenerativeAI(apiKey);
    modelInstance = clientInstance.getGenerativeModel({ model: MODEL_NAME });
    lastApiKey = apiKey;

    return { client: clientInstance, model: modelInstance };
}

/**
 * Query Gemini with a system instruction and user prompt.
 * Returns the text response, uses caching to avoid duplicate requests.
 * Accepts an optional AbortSignal to cancel the request externally.
 */
export async function queryGemini(
    systemInstruction: string,
    userPrompt: string,
    timeoutMs: number = 10000,
    signal?: AbortSignal,
): Promise<GeminiQueryResult> {
    // Early abort check
    if (signal?.aborted) {
        throw new GeminiError('Request aborted', 'TIMEOUT');
    }

    // Circuit breaker — stop trying if Gemini keeps failing
    checkCircuitBreaker();

    const settings = await loadSettings();
    const apiKey = settings.geminiApiKey;

    if (!apiKey) {
        throw new GeminiError('No API key configured', 'NO_KEY');
    }

    // Check cache
    const cacheKey = getCacheKey(systemInstruction, userPrompt);
    const cached = getCached(cacheKey);
    if (cached) {
        return { text: cached, cached: true };
    }

    const { client } = getClient(apiKey);

    // Create model with system instruction for this specific request
    const model = client.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction,
    });

    // Combine external signal + timeout into a single signal
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedSignal = signal
        ? AbortSignal.any([timeoutController.signal, signal])
        : timeoutController.signal;

    try {
        const result = await model.generateContent(
            { contents: [{ role: 'user', parts: [{ text: userPrompt }] }] },
            { signal: combinedSignal },
        );

        clearTimeout(timer);
        recordSuccess();

        const text = result.response.text();
        setCache(cacheKey, text);

        return { text, cached: false };
    } catch (error: unknown) {
        clearTimeout(timer);

        // External abort takes priority — don't count user aborts as failures
        if (signal?.aborted) {
            throw new GeminiError('Request aborted', 'TIMEOUT');
        }
        const err = error as Record<string, unknown>;
        if (err?.name === 'AbortError' || timeoutController.signal.aborted) {
            recordFailure();
            throw new GeminiError('Request timed out', 'TIMEOUT');
        }
        if (err?.status === 429) {
            recordFailure();
            throw new GeminiError('Rate limit exceeded (1500/day)', 'RATE_LIMIT');
        }
        if (err?.status === 403 || err?.status === 401) {
            recordFailure();
            throw new GeminiError('Invalid API key', 'AUTH_ERROR');
        }
        recordFailure();
        throw new GeminiError(
            error instanceof Error ? error.message : 'Unknown Gemini error',
            'NETWORK_ERROR',
        );
    }
}

/**
 * Test the Gemini connection with the stored API key.
 */
export async function testGeminiConnection(): Promise<GeminiConnectionStatus> {
    try {
        const result = await queryGemini(
            'Respond with exactly: OK',
            'Test connection',
            8000,
        );
        return { ok: true, model: MODEL_NAME };
    } catch (error) {
        if (error instanceof GeminiError) {
            return { ok: false, error: error.message, model: MODEL_NAME };
        }
        return { ok: false, error: 'Connection failed' };
    }
}

/**
 * Clear the suggestion cache (useful after settings change).
 */
export function clearGeminiCache(): void {
    cache.clear();
    clientInstance = null;
    modelInstance = null;
    lastApiKey = null;
    resetCircuitBreaker();
}

// ============================================================================
// CHAT (multi-turn for Chat Copilot)
// ============================================================================

/** Model for chat copilot — more capable than flash-lite, still free tier */
const CHAT_MODEL_NAME = 'gemini-2.5-flash';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Send a multi-turn chat to Gemini with a system instruction.
 * Uses gemini-2.5-flash for better reasoning on complex tasks.
 * No caching — each chat turn is unique.
 */
export async function queryGeminiChat(
    systemInstruction: string,
    messages: ChatMessage[],
    timeoutMs: number = 60000,
    signal?: AbortSignal,
): Promise<{ text: string }> {
    if (signal?.aborted) {
        throw new GeminiError('Request aborted', 'TIMEOUT');
    }

    // Circuit breaker — stop trying if Gemini keeps failing
    checkCircuitBreaker();

    const settings = await loadSettings();
    const apiKey = settings.geminiApiKey;

    if (!apiKey) {
        throw new GeminiError('No hay API key de Gemini configurada', 'NO_KEY');
    }

    const { client } = getClient(apiKey);

    const model = client.getGenerativeModel({
        model: CHAT_MODEL_NAME,
        systemInstruction,
    });

    // Convert ChatMessage[] to Gemini Content[] format
    const contents: Content[] = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedSignal = signal
        ? AbortSignal.any([timeoutController.signal, signal])
        : timeoutController.signal;

    try {
        const result = await model.generateContent(
            { contents },
            { signal: combinedSignal },
        );

        clearTimeout(timer);

        const text = result.response.text();
        if (!text) {
            recordFailure();
            throw new GeminiError('Respuesta vacía de Gemini', 'PARSE_ERROR');
        }
        recordSuccess();

        return { text };
    } catch (error: unknown) {
        clearTimeout(timer);

        if (error instanceof GeminiError) throw error;

        if (signal?.aborted) {
            throw new GeminiError('Request aborted', 'TIMEOUT');
        }
        const err = error as Record<string, unknown>;
        if (err?.name === 'AbortError' || timeoutController.signal.aborted) {
            recordFailure();
            throw new GeminiError('Request timed out', 'TIMEOUT');
        }
        if (err?.status === 429) {
            recordFailure();
            throw new GeminiError('Rate limit excedido. Esperá un momento.', 'RATE_LIMIT');
        }
        if (err?.status === 403 || err?.status === 401) {
            recordFailure();
            throw new GeminiError('API key de Gemini inválida', 'AUTH_ERROR');
        }
        recordFailure();
        throw new GeminiError(
            error instanceof Error ? error.message : 'Error de red desconocido',
            'NETWORK_ERROR',
        );
    }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

export type GeminiErrorCode = 'NO_KEY' | 'TIMEOUT' | 'RATE_LIMIT' | 'AUTH_ERROR' | 'NETWORK_ERROR' | 'PARSE_ERROR';

export class GeminiError extends Error {
    code: GeminiErrorCode;

    constructor(message: string, code: GeminiErrorCode) {
        super(message);
        this.name = 'GeminiError';
        this.code = code;
    }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn().mockReturnValue({
    generateContent: mockGenerateContent,
});

vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: class MockGoogleGenerativeAI {
            getGenerativeModel = mockGetGenerativeModel;
        },
    };
});

vi.mock('../../utils/settingsStore', () => ({
    loadSettings: vi.fn().mockResolvedValue({
        geminiApiKey: 'test-api-key-123',
        geminiEnabled: true,
    }),
}));

import { queryGemini, testGeminiConnection, clearGeminiCache, GeminiError } from '../../utils/geminiClient';
import { loadSettings } from '../../utils/settingsStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSuccessResponse(text: string) {
    mockGenerateContent.mockResolvedValue({
        response: { text: () => text },
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('geminiClient', () => {
    beforeEach(() => {
        clearGeminiCache();
        vi.clearAllMocks();
        // Re-setup default mock after clearAllMocks
        mockGetGenerativeModel.mockReturnValue({
            generateContent: mockGenerateContent,
        });
        mockSuccessResponse('["test response"]');
    });

    describe('queryGemini', () => {
        it('returns text from Gemini response', async () => {
            mockSuccessResponse('["Falla en soldadura"]');

            const result = await queryGemini('system', 'user prompt');

            expect(result.text).toBe('["Falla en soldadura"]');
            expect(result.cached).toBe(false);
        });

        it('returns cached result on duplicate query', async () => {
            mockSuccessResponse('["cached test"]');

            const first = await queryGemini('system', 'same prompt');
            const second = await queryGemini('system', 'same prompt');

            expect(first.cached).toBe(false);
            expect(second.cached).toBe(true);
            expect(second.text).toBe('["cached test"]');
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        it('does not return stale cache after TTL expires', async () => {
            mockSuccessResponse('["fresh"]');

            await queryGemini('system', 'ttl-prompt');

            const originalNow = Date.now;
            Date.now = () => originalNow() + 6 * 60 * 1000;

            try {
                const result = await queryGemini('system', 'ttl-prompt');
                expect(result.cached).toBe(false);
                expect(mockGenerateContent).toHaveBeenCalledTimes(2);
            } finally {
                Date.now = originalNow;
            }
        });

        it('throws GeminiError NO_KEY when API key is missing', async () => {
            vi.mocked(loadSettings).mockResolvedValueOnce({
                geminiApiKey: null,
                geminiEnabled: true,
                diagnosticExportPath: null,
                qaEnabled: false,
                lastProjectPath: null,
                plantAssetsPath: null,
                amfeBasePath: null,
                cpBasePath: null,
            });

            try {
                await queryGemini('system', 'no-key-prompt');
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(GeminiError);
                expect((e as GeminiError).code).toBe('NO_KEY');
            }
        });

        it('throws GeminiError RATE_LIMIT on status 429', async () => {
            mockGenerateContent.mockRejectedValue({ status: 429, message: 'Too Many Requests' });

            try {
                await queryGemini('system', 'rate-limit-prompt');
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(GeminiError);
                expect((e as GeminiError).code).toBe('RATE_LIMIT');
            }
        });

        it('throws GeminiError AUTH_ERROR on status 401', async () => {
            mockGenerateContent.mockRejectedValue({ status: 401, message: 'Unauthorized' });

            try {
                await queryGemini('system', 'auth-prompt');
                expect.unreachable('should have thrown');
            } catch (e) {
                expect((e as GeminiError).code).toBe('AUTH_ERROR');
            }
        });

        it('throws GeminiError AUTH_ERROR on status 403', async () => {
            mockGenerateContent.mockRejectedValue({ status: 403, message: 'Forbidden' });

            try {
                await queryGemini('system', 'auth403-prompt');
                expect.unreachable('should have thrown');
            } catch (e) {
                expect((e as GeminiError).code).toBe('AUTH_ERROR');
            }
        });

        it('throws GeminiError NETWORK_ERROR on unknown error', async () => {
            mockGenerateContent.mockRejectedValue(new Error('Network failure'));

            try {
                await queryGemini('system', 'network-prompt');
                expect.unreachable('should have thrown');
            } catch (e) {
                expect((e as GeminiError).code).toBe('NETWORK_ERROR');
            }
        });

        it('throws GeminiError TIMEOUT when request is aborted externally', async () => {
            const abortController = new AbortController();
            abortController.abort();

            try {
                await queryGemini('system', 'abort-prompt', 10000, abortController.signal);
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(GeminiError);
                expect((e as GeminiError).code).toBe('TIMEOUT');
            }
        });

        it('passes signal to generateContent via requestOptions', async () => {
            mockSuccessResponse('["ok"]');

            await queryGemini('system', 'signal-test-prompt', 10000);

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            const callArgs = mockGenerateContent.mock.calls[0];
            expect(callArgs[1]).toBeDefined();
            expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
        });

        it('uses different cache keys for different user prompts', async () => {
            mockSuccessResponse('["result A"]');
            const resultA = await queryGemini('system', 'prompt A');

            mockSuccessResponse('["result B"]');
            const resultB = await queryGemini('system', 'prompt B');

            expect(resultA.text).toBe('["result A"]');
            expect(resultB.text).toBe('["result B"]');
            expect(resultB.cached).toBe(false);
            expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        });
    });

    describe('testGeminiConnection', () => {
        it('returns ok:true on successful connection', async () => {
            mockSuccessResponse('OK');

            const result = await testGeminiConnection();

            expect(result.ok).toBe(true);
            expect(result.model).toBeDefined();
        });

        it('returns ok:false with error on failure', async () => {
            mockGenerateContent.mockRejectedValue({ status: 401, message: 'Bad key' });

            const result = await testGeminiConnection();

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('clearGeminiCache', () => {
        it('clears cached results', async () => {
            mockSuccessResponse('["cached"]');
            await queryGemini('system', 'clear-test-prompt');

            clearGeminiCache();

            mockSuccessResponse('["fresh after clear"]');
            const result = await queryGemini('system', 'clear-test-prompt');

            expect(result.cached).toBe(false);
            expect(result.text).toBe('["fresh after clear"]');
        });
    });

    // -----------------------------------------------------------------------
    // Circuit Breaker (Round 5 A1)
    // -----------------------------------------------------------------------
    describe('circuit breaker', () => {
        it('opens after 3 consecutive failures', async () => {
            // Trigger 3 failures
            for (let i = 0; i < 3; i++) {
                mockGenerateContent.mockRejectedValueOnce(new Error('Network failure'));
                try { await queryGemini('system', `fail-${i}-prompt`); } catch {}
            }

            // 4th call should throw TIMEOUT (circuit open) without calling API
            mockGenerateContent.mockClear();
            try {
                await queryGemini('system', 'blocked-prompt');
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(GeminiError);
                expect((e as GeminiError).code).toBe('TIMEOUT');
                expect((e as GeminiError).message).toContain('temporalmente deshabilitada');
            }
            // API should NOT have been called
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });

        it('resets on successful call', async () => {
            // Trigger 2 failures (below threshold)
            for (let i = 0; i < 2; i++) {
                mockGenerateContent.mockRejectedValueOnce(new Error('fail'));
                try { await queryGemini('system', `fail2-${i}`); } catch {}
            }

            // Success resets counter
            mockSuccessResponse('["ok"]');
            await queryGemini('system', 'success-reset-prompt');

            // 3 more failures needed to open circuit again
            for (let i = 0; i < 2; i++) {
                mockGenerateContent.mockRejectedValueOnce(new Error('fail'));
                try { await queryGemini('system', `fail3-${i}`); } catch {}
            }

            // Should still work (only 2 failures after reset)
            mockSuccessResponse('["still open"]');
            const result = await queryGemini('system', 'after-reset-prompt');
            expect(result.text).toBe('["still open"]');
        });

        it('closes after cooldown period', async () => {
            // Trigger 3 failures to open circuit
            for (let i = 0; i < 3; i++) {
                mockGenerateContent.mockRejectedValueOnce(new Error('fail'));
                try { await queryGemini('system', `cooldown-fail-${i}`); } catch {}
            }

            // Fast-forward past cooldown (60s)
            const originalNow = Date.now;
            Date.now = () => originalNow() + 61000;

            try {
                mockSuccessResponse('["recovered"]');
                const result = await queryGemini('system', 'post-cooldown-prompt');
                expect(result.text).toBe('["recovered"]');
            } finally {
                Date.now = originalNow;
            }
        });

        it('does not count user aborts as failures', async () => {
            const controller = new AbortController();
            controller.abort();

            // Aborted requests should not increment failure count
            for (let i = 0; i < 5; i++) {
                try { await queryGemini('system', `abort-${i}`, 10000, controller.signal); } catch {}
            }

            // Circuit should still be closed — API call goes through
            mockSuccessResponse('["ok after aborts"]');
            const result = await queryGemini('system', 'after-aborts-prompt');
            expect(result.text).toBe('["ok after aborts"]');
        });

        it('clearGeminiCache resets circuit breaker', async () => {
            // Open the circuit
            for (let i = 0; i < 3; i++) {
                mockGenerateContent.mockRejectedValueOnce(new Error('fail'));
                try { await queryGemini('system', `clear-cb-${i}`); } catch {}
            }

            // Clear cache (which also resets circuit breaker)
            clearGeminiCache();

            // Re-setup mock after clearAllMocks effect
            mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
            mockSuccessResponse('["fresh after reset"]');
            const result = await queryGemini('system', 'post-clear-prompt');
            expect(result.text).toBe('["fresh after reset"]');
        });
    });

    // -----------------------------------------------------------------------
    // Cache key with system prompt fingerprint (Round 5 A2)
    // -----------------------------------------------------------------------
    describe('cache key includes system prompt', () => {
        it('uses different cache entries for different system prompts', async () => {
            mockSuccessResponse('["from system A"]');
            const resultA = await queryGemini('System prompt A — long instructions', 'same user prompt');

            mockSuccessResponse('["from system B"]');
            const resultB = await queryGemini('System prompt B — different instructions', 'same user prompt');

            expect(resultA.text).toBe('["from system A"]');
            expect(resultB.text).toBe('["from system B"]');
            expect(resultB.cached).toBe(false);
            expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        });

        it('caches correctly when system prompt is the same', async () => {
            mockSuccessResponse('["cached sys"]');
            await queryGemini('Same system prompt', 'same user prompt 2');
            const result = await queryGemini('Same system prompt', 'same user prompt 2');

            expect(result.cached).toBe(true);
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // getCacheKey collision resistance
    // -----------------------------------------------------------------------
    describe('getCacheKey collision resistance', () => {
        it('different system prompts with same length produce different cache keys', async () => {
            // Two prompts with same length but different content
            const prompt1 = 'A'.repeat(100);
            const prompt2 = 'B'.repeat(100);

            mockSuccessResponse('response-1');
            await queryGemini(prompt1, 'user prompt', 5000);

            mockSuccessResponse('response-2');
            const result = await queryGemini(prompt2, 'user prompt', 5000);

            // Should NOT get cached result from prompt1 - should call Gemini again
            expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        });

        it('same system prompt with same user prompt uses cache', async () => {
            const sysPrompt = 'system prompt for test';
            mockSuccessResponse('cached-response');

            await queryGemini(sysPrompt, 'user query', 5000);
            const result = await queryGemini(sysPrompt, 'user query', 5000);

            // Should use cache - only one API call
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    ConflictError,
    delay,
    withRetry,
    generateChecksum,
    verifyChecksum,
    getMachineId,
    getCurrentUser,
    setCurrentUser,
    isLockExpired,
    isOurLock,
    formatConflictTimestamp,
    formatLockMessage,
    formatConflictMessage,
    type LockInfo,
    type SaveConflict
} from '../utils/concurrency';

describe('Concurrency Utilities', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
    });

    // =========================================================================
    // CONFLICT ERROR
    // =========================================================================

    describe('ConflictError', () => {
        it('should create with all properties', () => {
            const error = new ConflictError(
                'disk123',
                'local456',
                Date.now(),
                'v1.2.3'
            );

            expect(error.name).toBe('ConflictError');
            expect(error.diskChecksum).toBe('disk123');
            expect(error.localChecksum).toBe('local456');
            expect(error.diskVersion).toBe('v1.2.3');
            expect(error.message).toContain('CONFLICT');
        });

        it('should convert to SaveConflict structure', () => {
            const timestamp = Date.now();
            const error = new ConflictError('disk', 'local', timestamp, 'v2.0');

            const conflict = error.toConflict();

            expect(conflict.type).toBe('version_conflict');
            expect(conflict.diskVersion).toBe('v2.0');
            expect(conflict.diskTimestamp).toBe(timestamp);
            expect(conflict.options).toContain('reload');
            expect(conflict.options).toContain('save_as_new');
            expect(conflict.options).toContain('cancel');
        });
    });

    // =========================================================================
    // DELAY UTILITY
    // =========================================================================

    describe('Delay', () => {
        it('should delay for specified time', async () => {
            const start = Date.now();
            await delay(100);
            const elapsed = Date.now() - start;

            expect(elapsed).toBeGreaterThanOrEqual(95); // Allow 5ms tolerance
            expect(elapsed).toBeLessThan(200);
        });
    });

    // =========================================================================
    // RETRY LOGIC
    // =========================================================================

    describe('withRetry', () => {
        it('should succeed on first try', async () => {
            const fn = vi.fn().mockResolvedValue('success');

            const result = await withRetry(fn);

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and eventually succeed', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockRejectedValueOnce(new Error('fail 2'))
                .mockResolvedValue('success');

            const result = await withRetry(fn, {
                maxRetries: 3,
                backoffMs: [10, 20, 30]
            });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should throw after max retries', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('always fail'));

            await expect(
                withRetry(fn, { maxRetries: 3, backoffMs: [10, 10, 10] })
            ).rejects.toThrow('always fail');

            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should NOT retry ConflictError', async () => {
            const conflictError = new ConflictError('d', 'l', Date.now(), 'v1');
            const fn = vi.fn().mockRejectedValue(conflictError);

            await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow(conflictError);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should respect shouldRetry predicate', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('network'));

            await expect(
                withRetry(fn, {
                    maxRetries: 3,
                    backoffMs: [10],
                    shouldRetry: (err) => err.message !== 'network'
                })
            ).rejects.toThrow('network');

            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    // =========================================================================
    // CHECKSUM UTILITIES
    // =========================================================================

    describe('Checksum', () => {
        it('should generate consistent checksum', async () => {
            const content = 'test content';
            const checksum1 = await generateChecksum(content);
            const checksum2 = await generateChecksum(content);

            expect(checksum1).toBe(checksum2);
            expect(checksum1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
        });

        it('should generate different checksums for different content', async () => {
            const checksum1 = await generateChecksum('content A');
            const checksum2 = await generateChecksum('content B');

            expect(checksum1).not.toBe(checksum2);
        });

        it('should verify checksum correctly', async () => {
            const content = 'verify me';
            const checksum = await generateChecksum(content);

            expect(await verifyChecksum(content, checksum)).toBe(true);
            expect(await verifyChecksum('different', checksum)).toBe(false);
        });
    });

    // =========================================================================
    // MACHINE & USER IDENTIFICATION
    // =========================================================================

    describe('Machine & User ID', () => {
        it('should generate stable machine ID per session', () => {
            const id1 = getMachineId();
            const id2 = getMachineId();

            expect(id1).toBe(id2);
            expect(id1).toMatch(/^machine_\d+_/);
        });

        it('should set and get current user', () => {
            setCurrentUser('John Doe');
            expect(getCurrentUser()).toBe('John Doe');
        });

        it('should return default user when not set', () => {
            expect(getCurrentUser()).toBe('Usuario Desconocido');
        });
    });

    // =========================================================================
    // LOCK UTILITIES
    // =========================================================================

    describe('Lock Utilities', () => {
        it('should detect expired lock', () => {
            const expiredLock: LockInfo = {
                user: 'test',
                timestamp: Date.now() - 60000, // 1 minute ago
                ttlMs: 30000 // 30 second TTL
            };

            expect(isLockExpired(expiredLock)).toBe(true);
        });

        it('should detect valid lock', () => {
            const validLock: LockInfo = {
                user: 'test',
                timestamp: Date.now() - 10000, // 10 seconds ago
                ttlMs: 30000 // 30 second TTL
            };

            expect(isLockExpired(validLock)).toBe(false);
        });

        it('should detect own lock', () => {
            const machineId = getMachineId();
            const ourLock: LockInfo = {
                user: 'test',
                timestamp: Date.now(),
                ttlMs: 30000,
                machine: machineId
            };

            expect(isOurLock(ourLock)).toBe(true);
        });

        it('should detect foreign lock', () => {
            const foreignLock: LockInfo = {
                user: 'other',
                timestamp: Date.now(),
                ttlMs: 30000,
                machine: 'different_machine_id'
            };

            expect(isOurLock(foreignLock)).toBe(false);
        });
    });

    // =========================================================================
    // FORMATTING UTILITIES
    // =========================================================================

    describe('Formatting', () => {
        it('should format timestamp for display', () => {
            const timestamp = Date.now();
            const formatted = formatConflictTimestamp(timestamp);

            expect(typeof formatted).toBe('string');
            expect(formatted.length).toBeGreaterThan(0);
        });

        it('should format lock message', () => {
            const lock: LockInfo = {
                user: 'Juan',
                timestamp: Date.now(),
                ttlMs: 30000
            };

            const message = formatLockMessage(lock);

            expect(message).toContain('Juan');
            expect(message).toContain('bloqueado');
        });

        it('should format conflict message', () => {
            const conflict: SaveConflict = {
                type: 'version_conflict',
                diskVersion: 'v2.1',
                diskTimestamp: Date.now(),
                diskChecksum: 'abc',
                localChecksum: 'def',
                options: ['reload', 'save_as_new', 'cancel']
            };

            const message = formatConflictMessage(conflict);

            expect(message).toContain('CONFLICTO');
            expect(message).toContain('v2.1');
            expect(message).toContain('Recargar');
            expect(message).toContain('Guardar como nueva');
        });
    });

    // =========================================================================
    // CHECKSUM MISMATCH SCENARIOS
    // =========================================================================

    describe('Checksum Mismatch Handling', () => {
        it('should detect checksum mismatch between load and save', async () => {
            const originalContent = JSON.stringify({ value: 1 });
            const modifiedContent = JSON.stringify({ value: 2 });

            const originalChecksum = await generateChecksum(originalContent);
            const currentChecksum = await generateChecksum(modifiedContent);

            // This simulates what happens when another user modifies the file
            expect(originalChecksum).not.toBe(currentChecksum);

            // Verify the checksums are valid SHA-256
            expect(originalChecksum).toMatch(/^[a-f0-9]{64}$/);
            expect(currentChecksum).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should handle empty content checksum', async () => {
            const emptyChecksum = await generateChecksum('');
            expect(emptyChecksum).toBeTruthy();
            expect(emptyChecksum.length).toBe(64);
        });

        it('should handle large content checksum', async () => {
            const largeContent = 'x'.repeat(1000000); // 1MB
            const checksum = await generateChecksum(largeContent);

            expect(checksum).toBeTruthy();
            expect(checksum.length).toBe(64);

            // Should be consistent
            const checksum2 = await generateChecksum(largeContent);
            expect(checksum).toBe(checksum2);
        });
    });

    // =========================================================================
    // CONFLICT RESOLUTION SCENARIOS
    // =========================================================================

    describe('Conflict Resolution', () => {
        it('should provide all resolution options in ConflictError', () => {
            const error = new ConflictError('disk', 'local', Date.now(), 'v1');
            const conflict = error.toConflict();

            // All required options should be present
            expect(conflict.options).toContain('reload');
            expect(conflict.options).toContain('save_as_new');
            expect(conflict.options).toContain('cancel');

            // force_save is intentionally NOT included for safety
            expect(conflict.options).not.toContain('force_save');
        });

        it('should include disk info for user decision', () => {
            const timestamp = Date.now() - 60000; // 1 minute ago
            const error = new ConflictError(
                'abcd1234',
                'efgh5678',
                timestamp,
                'v3.4.5'
            );

            const conflict = error.toConflict();

            expect(conflict.diskChecksum).toBe('abcd1234');
            expect(conflict.localChecksum).toBe('efgh5678');
            expect(conflict.diskTimestamp).toBe(timestamp);
            expect(conflict.diskVersion).toBe('v3.4.5');
        });
    });
});

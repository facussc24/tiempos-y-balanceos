import { logger } from './logger';

/**
 * Fault Simulation Module (DEV ONLY)
 * 
 * Allows simulating various file system errors for testing
 * retry logic, error handling, and user messaging.
 * 
 * NEVER enabled in production builds.
 * 
 * @module faultSimulation
 */

// ============================================================================
// FEATURE FLAG
// ============================================================================

/**
 * Check if we're in development mode
 * This should ALWAYS be false in production builds
 */
function isDevMode(): boolean {
    // Check multiple indicators
    const isDev =
        import.meta.env?.DEV === true ||
        import.meta.env?.MODE === 'development' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    return isDev;
}

/**
 * Fault simulation configuration
 */
export interface FaultConfig {
    enabled: boolean;
    errorType: 'EBUSY' | 'EACCES' | 'ETIMEDOUT' | 'EIO' | 'EPERM' | 'ENOENT' | null;
    failCount: number;  // How many times to fail before succeeding
    currentCount: number; // Internal counter
    delayMs: number;    // Artificial delay before error
}

// Global fault config (only accessible in dev)
let faultConfig: FaultConfig = {
    enabled: false,
    errorType: null,
    failCount: 1,
    currentCount: 0,
    delayMs: 0
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if fault simulation is available (DEV only)
 */
export function isFaultSimulationAvailable(): boolean {
    return isDevMode();
}

/**
 * Enable fault simulation with specific error type
 */
export function enableFaultSimulation(
    errorType: FaultConfig['errorType'],
    failCount: number = 1,
    delayMs: number = 0
): void {
    if (!isDevMode()) {
        logger.warn('FaultSimulation', 'Cannot enable fault simulation in production');
        return;
    }

    faultConfig = {
        enabled: true,
        errorType,
        failCount,
        currentCount: 0,
        delayMs
    };

    logger.info('FaultSimulation', 'Enabled', { errorType, failCount });
}

/**
 * Disable fault simulation
 */
export function disableFaultSimulation(): void {
    faultConfig = {
        enabled: false,
        errorType: null,
        failCount: 1,
        currentCount: 0,
        delayMs: 0
    };
    logger.info('FaultSimulation', 'Disabled');
}

/**
 * Get current fault simulation status
 */
function getFaultSimulationStatus(): FaultConfig {
    return { ...faultConfig };
}

/**
 * Check if should simulate fault (and potentially throw)
 * Call this at the beginning of file operations in DEV mode
 */
async function maybeSimulateFault(operation: string): Promise<void> {
    if (!isDevMode() || !faultConfig.enabled || !faultConfig.errorType) {
        return;
    }

    // Check if we should still fail
    if (faultConfig.currentCount >= faultConfig.failCount) {
        logger.debug('FaultSimulation', `${operation}: Allowing after ${faultConfig.failCount} failures`);
        return;
    }

    // Increment counter
    faultConfig.currentCount++;

    // Apply delay if configured
    if (faultConfig.delayMs > 0) {
        await new Promise(r => setTimeout(r, faultConfig.delayMs));
    }

    // Create error based on type
    const error = createSimulatedError(faultConfig.errorType, operation);
    logger.debug('FaultSimulation', `${operation}: Simulating ${faultConfig.errorType}`, { attempt: faultConfig.currentCount, failCount: faultConfig.failCount });

    throw error;
}

/**
 * Create a simulated error with proper code
 */
function createSimulatedError(errorType: string, operation: string): Error {
    const messages: Record<string, string> = {
        EBUSY: `Resource busy: ${operation}`,
        EACCES: `Permission denied: ${operation}`,
        ETIMEDOUT: `Connection timed out: ${operation}`,
        EIO: `I/O error: ${operation}`,
        EPERM: `Operation not permitted: ${operation}`,
        ENOENT: `No such file or directory: ${operation}`
    };

    const error = new Error(messages[errorType] || `Simulated error: ${operation}`);
    Object.assign(error, { code: errorType, simulated: true });

    return error;
}

// ============================================================================
// QA TEST UTILITIES
// ============================================================================

/**
 * Result of a QA test
 */
export interface QATestResult {
    testName: string;
    passed: boolean;
    duration: number;
    details: string;
    error?: string;
}

/**
 * Test atomic write functionality
 */
export async function testAtomicWrite(basePath: string): Promise<QATestResult> {
    const testName = 'Atomic Write Test';
    const start = Date.now();

    try {
        // Dynamic import to avoid circular dependencies
        const fs = await import('./unified_fs');
        const { normalizePath, joinPath } = await import('./networkUtils');

        const normalizedPath = normalizePath(basePath);
        const testDir = joinPath(normalizedPath, '.qa_test');
        const tempFile = joinPath(testDir, 'test_atomic.tmp');
        const finalFile = joinPath(testDir, 'test_atomic.json');

        // 1. Create test directory
        await fs.ensureDir(testDir);

        // 2. Write to temp file
        const testData = { test: true, timestamp: Date.now() };
        await fs.writeTextFile(tempFile, JSON.stringify(testData, null, 2));

        // 3. Verify temp file exists
        const tempContent = await fs.readTextFile(tempFile);
        if (!tempContent) throw new Error('Temp file not created');

        // 4. Rename to final (atomic swap)
        await fs.rename(tempFile, finalFile);

        // 5. Verify final file
        const finalContent = await fs.readTextFile(finalFile);
        const parsed = JSON.parse(finalContent || '{}');
        if (parsed.test !== true) throw new Error('Data verification failed');

        // 6. Cleanup
        await fs.remove(finalFile);
        await fs.remove(testDir);

        return {
            testName,
            passed: true,
            duration: Date.now() - start,
            details: 'Temp write → verify → atomic rename → verify → cleanup: OK'
        };
    } catch (error) {
        return {
            testName,
            passed: false,
            duration: Date.now() - start,
            details: 'Atomic write sequence failed',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Test lock creation and expiration
 */
export async function testLockBehavior(basePath: string): Promise<QATestResult> {
    const testName = 'Lock Behavior Test';
    const start = Date.now();

    try {
        const fs = await import('./unified_fs');
        const { normalizePath, joinPath } = await import('./networkUtils');

        const normalizedPath = normalizePath(basePath);
        const lockFile = joinPath(normalizedPath, '.qa_test.lock');

        // 1. Create lock
        const lockData = {
            user: 'QA_Test',
            timestamp: Date.now(),
            machineId: 'test_machine'
        };
        await fs.writeTextFile(lockFile, JSON.stringify(lockData, null, 2));

        // 2. Verify lock exists
        const lockContent = await fs.readTextFile(lockFile);
        if (!lockContent) throw new Error('Lock file not created');

        // 3. Simulate checking for expiration
        const parsed = JSON.parse(lockContent);
        const age = Date.now() - parsed.timestamp;
        const isExpired = age > 30000; // 30s TTL

        // 4. Cleanup lock
        await fs.remove(lockFile);

        return {
            testName,
            passed: true,
            duration: Date.now() - start,
            details: `Lock create → read → age check (${age}ms, expired=${isExpired}) → release: OK`
        };
    } catch (error) {
        return {
            testName,
            passed: false,
            duration: Date.now() - start,
            details: 'Lock behavior test failed',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Test retry logic with simulated transient failure
 */
export async function testRetryBehavior(): Promise<QATestResult> {
    const testName = 'Retry Behavior Test';
    const start = Date.now();

    try {
        const { withSmartRetry } = await import('./networkUtils');

        let attemptCount = 0;
        const failTimes = 2;

        // Function that fails twice then succeeds
        const flakeyOperation = async (): Promise<string> => {
            attemptCount++;
            if (attemptCount <= failTimes) {
                const error = Object.assign(new Error('Simulated transient error'), { code: 'ETIMEDOUT' });
                throw error;
            }
            return 'success';
        };

        const retryLogs: string[] = [];

        const result = await withSmartRetry(
            flakeyOperation,
            { maxRetries: 3, baseDelayMs: 50 },
            (attempt, error, delay) => {
                retryLogs.push(`Retry ${attempt}: ${error.code} (${delay}ms delay)`);
            }
        );

        if (result !== 'success') {
            throw new Error('Did not get success result after retries');
        }

        if (attemptCount !== failTimes + 1) {
            throw new Error(`Expected ${failTimes + 1} attempts, got ${attemptCount}`);
        }

        return {
            testName,
            passed: true,
            duration: Date.now() - start,
            details: `Failed ${failTimes}x → retried → succeeded on attempt ${attemptCount}. Logs: ${retryLogs.join(', ')}`
        };
    } catch (error) {
        return {
            testName,
            passed: false,
            duration: Date.now() - start,
            details: 'Retry behavior test failed',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Test that ConflictError is NOT retried
 */
export async function testConflictNotRetried(): Promise<QATestResult> {
    const testName = 'Conflict No-Retry Test';
    const start = Date.now();

    try {
        const { withSmartRetry } = await import('./networkUtils');

        let attemptCount = 0;

        const conflictOperation = async (): Promise<string> => {
            attemptCount++;
            const error = new Error('Version conflict detected');
            error.name = 'ConflictError';
            throw error;
        };

        try {
            await withSmartRetry(
                conflictOperation,
                { maxRetries: 3, baseDelayMs: 50 }
            );
            throw new Error('Should have thrown ConflictError');
        } catch (err) {
            // Expected - verify only 1 attempt
            if (attemptCount !== 1) {
                throw new Error(`ConflictError was retried! Attempts: ${attemptCount}`);
            }
        }

        return {
            testName,
            passed: true,
            duration: Date.now() - start,
            details: `ConflictError thrown → NOT retried (${attemptCount} attempt): OK`
        };
    } catch (error) {
        return {
            testName,
            passed: false,
            duration: Date.now() - start,
            details: 'Conflict no-retry test failed',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

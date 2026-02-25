/**
 * Tests for Network Utilities
 */

import { describe, it, expect } from 'vitest';
import {
    normalizePath,
    joinPath,
    getParentDir,
    getFilename,
    classifyError,
    isOrphanTempFile,
    isOrphanLockFile,
    getCleanupCandidates
} from '../utils/networkUtils';

describe('Network Utils - Path Normalization', () => {
    describe('normalizePath', () => {
        it('should convert forward slashes to backslashes', () => {
            expect(normalizePath('C:/Users/test/file.json')).toBe('C:\\Users\\test\\file.json');
        });

        it('should collapse multiple slashes', () => {
            expect(normalizePath('C:\\\\Users\\\\test')).toBe('C:\\Users\\test');
        });

        it('should preserve UNC paths', () => {
            expect(normalizePath('\\\\server\\share\\file.json')).toBe('\\\\server\\share\\file.json');
            expect(normalizePath('//server/share/file.json')).toBe('\\\\server\\share\\file.json');
        });

        it('should remove trailing slashes', () => {
            expect(normalizePath('C:\\Users\\test\\')).toBe('C:\\Users\\test');
        });

        it('should preserve root drive paths', () => {
            expect(normalizePath('C:\\')).toBe('C:\\');
        });

        it('should handle empty string', () => {
            expect(normalizePath('')).toBe('');
        });
    });

    describe('joinPath', () => {
        it('should join path segments', () => {
            expect(joinPath('C:\\Users', 'test', 'file.json')).toBe('C:\\Users\\test\\file.json');
        });

        it('should handle leading slashes in segments', () => {
            expect(joinPath('C:\\Users', '\\test', '\\file.json')).toBe('C:\\Users\\test\\file.json');
        });

        it('should filter empty segments', () => {
            expect(joinPath('C:\\Users', '', 'file.json')).toBe('C:\\Users\\file.json');
        });
    });

    describe('getParentDir', () => {
        it('should return parent directory', () => {
            expect(getParentDir('C:\\Users\\test\\file.json')).toBe('C:\\Users\\test');
        });

        it('should handle root paths', () => {
            expect(getParentDir('C:\\')).toBe('C:\\');
        });
    });

    describe('getFilename', () => {
        it('should extract filename from path', () => {
            expect(getFilename('C:\\Users\\test\\file.json')).toBe('file.json');
        });

        it('should return input if no separator', () => {
            expect(getFilename('file.json')).toBe('file.json');
        });
    });
});

describe('Network Utils - Error Classification', () => {
    it('should classify permission errors as permanent', () => {
        const error = { code: 'EPERM', message: 'Permission denied' };
        const result = classifyError(error);

        expect(result.isPermanent).toBe(true);
        expect(result.isPermissionError).toBe(true);
        expect(result.isTransient).toBe(false);
    });

    it('should classify network timeout as transient', () => {
        const error = { code: 'ETIMEDOUT', message: 'Connection timeout' };
        const result = classifyError(error);

        expect(result.isTransient).toBe(true);
        expect(result.isPermanent).toBe(false);
        expect(result.isNetworkError).toBe(true);
    });

    it('should classify EBUSY as lock error', () => {
        const error = { code: 'EBUSY', message: 'Resource busy' };
        const result = classifyError(error);

        expect(result.isLockError).toBe(true);
        expect(result.isPermanent).toBe(true);
    });

    it('should classify ConflictError as permanent', () => {
        const error = { name: 'ConflictError', message: 'Version conflict' };
        const result = classifyError(error);

        expect(result.isPermanent).toBe(true);
        expect(result.isTransient).toBe(false);
    });

    // BUG-05 Fix: Windows network error codes
    it('should classify Windows error 53 as network path error', () => {
        const error = { message: 'failed to open file: No se ha encontrado la ruta de acceso de la red. (os error 53)' };
        const result = classifyError(error);

        expect(result.isNetworkError).toBe(true);
        expect(result.isNetworkPathError).toBe(true);
        expect(result.isPermanent).toBe(true);
        expect(result.isTransient).toBe(false);
        expect(result.code).toBe('53');
        expect(result.userMessage).toContain('ruta de red');
    });

    it('should classify Windows error 67 as network path error', () => {
        const error = { message: 'Network name cannot be found (os error 67)' };
        const result = classifyError(error);

        expect(result.isNetworkPathError).toBe(true);
        expect(result.isPermanent).toBe(true);
    });

    it('should provide user-friendly messages', () => {
        const permError = classifyError({ code: 'EACCES' });
        expect(permError.userMessage).toContain('permiso');

        const networkError = classifyError({ code: 'ETIMEDOUT' });
        expect(networkError.userMessage).toContain('red');
    });
});

describe('Network Utils - Orphan File Detection', () => {
    describe('isOrphanTempFile', () => {
        it('should detect old temp files as orphans', () => {
            const oldTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
            expect(isOrphanTempFile('file.tmp', oldTime)).toBe(true);
        });

        it('should not detect recent temp files as orphans', () => {
            const recentTime = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
            expect(isOrphanTempFile('file.tmp', recentTime)).toBe(false);
        });

        it('should not detect non-temp files', () => {
            const oldTime = new Date(Date.now() - 60 * 60 * 1000);
            expect(isOrphanTempFile('file.json', oldTime)).toBe(false);
        });
    });

    describe('isOrphanLockFile', () => {
        it('should detect old lock files as orphans', () => {
            const oldTime = new Date(Date.now() - 120 * 1000); // 2 min ago, 2x 30s TTL
            expect(isOrphanLockFile('file.lock', oldTime)).toBe(true);
        });

        it('should not detect recent lock files as orphans', () => {
            const recentTime = new Date(Date.now() - 10 * 1000); // 10 sec ago
            expect(isOrphanLockFile('file.lock', recentTime)).toBe(false);
        });
    });

    describe('getCleanupCandidates', () => {
        it('should return orphan files for cleanup', () => {
            const files = [
                { name: 'test.tmp', path: '/test.tmp', modifiedTime: new Date(Date.now() - 60 * 60 * 1000) },
                { name: 'file.lock', path: '/file.lock', modifiedTime: new Date(Date.now() - 120 * 1000) },
                { name: 'current.json', path: '/current.json', modifiedTime: new Date() }
            ];

            const candidates = getCleanupCandidates(files);
            expect(candidates).toHaveLength(2);
            expect(candidates[0].path).toBe('/test.tmp');
            expect(candidates[1].path).toBe('/file.lock');
        });
    });
});

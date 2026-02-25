import { describe, it, expect } from 'vitest';
import { isForbiddenFolderName, validateDirectoryHandle, confirmDestructiveOperation, validateFileOperation } from '../utils/fileSystemSecurity';

describe('File System Security Tests', () => {
    describe('isForbiddenFolderName', () => {
        it('should detect Windows system folder names', () => {
            expect(isForbiddenFolderName('Windows')).toBe(true);
            expect(isForbiddenFolderName('System32')).toBe(true);
            expect(isForbiddenFolderName('SysWOW64')).toBe(true);
            expect(isForbiddenFolderName('Program Files')).toBe(true);
            expect(isForbiddenFolderName('Program Files (x86)')).toBe(true);
            expect(isForbiddenFolderName('ProgramData')).toBe(true);
            expect(isForbiddenFolderName('Boot')).toBe(true);
            expect(isForbiddenFolderName('Recovery')).toBe(true);
            expect(isForbiddenFolderName('$Recycle.Bin')).toBe(true);
            expect(isForbiddenFolderName('System Volume Information')).toBe(true);
        });

        it('should detect Unix/Mac system folder names', () => {
            expect(isForbiddenFolderName('bin')).toBe(true);
            expect(isForbiddenFolderName('sbin')).toBe(true);
            expect(isForbiddenFolderName('etc')).toBe(true);
            expect(isForbiddenFolderName('var')).toBe(true);
            expect(isForbiddenFolderName('tmp')).toBe(true);
            expect(isForbiddenFolderName('dev')).toBe(true);
            expect(isForbiddenFolderName('proc')).toBe(true);
            expect(isForbiddenFolderName('sys')).toBe(true);
            expect(isForbiddenFolderName('root')).toBe(true);
        });

        it('should allow safe folder names', () => {
            expect(isForbiddenFolderName('MyProjects')).toBe(false);
            expect(isForbiddenFolderName('Documents')).toBe(false);
            expect(isForbiddenFolderName('BarackProyectos')).toBe(false);
            expect(isForbiddenFolderName('Ingenieria')).toBe(false);
            expect(isForbiddenFolderName('Projects')).toBe(false);
            expect(isForbiddenFolderName('Desktop')).toBe(false);
            expect(isForbiddenFolderName('Downloads')).toBe(false);
        });

        it('should handle case insensitivity', () => {
            expect(isForbiddenFolderName('windows')).toBe(true);
            expect(isForbiddenFolderName('WINDOWS')).toBe(true);
            expect(isForbiddenFolderName('WiNdOwS')).toBe(true);
            expect(isForbiddenFolderName('PROGRAMDATA')).toBe(true);
        });

        it('should handle empty or invalid input', () => {
            expect(isForbiddenFolderName('')).toBe(false);
            expect(isForbiddenFolderName(null as any)).toBe(false);
            expect(isForbiddenFolderName(undefined as any)).toBe(false);
        });

        it('should handle whitespace trimming', () => {
            expect(isForbiddenFolderName('  Windows  ')).toBe(true);
            expect(isForbiddenFolderName('\tProgramData\n')).toBe(true);
        });
    });

    describe('validateDirectoryHandle', () => {
        it('should validate safe directory names', async () => {
            const mockHandle = {
                name: 'MyProjects',
                kind: 'directory'
            } as FileSystemDirectoryHandle;

            const result = await validateDirectoryHandle(mockHandle);
            expect(result.valid).toBe(true);
            expect(result.message).toBeUndefined();
        });

        it('should reject Windows system folder names', async () => {
            const forbiddenNames = ['Windows', 'System32', 'ProgramData', '$Recycle.Bin', 'Boot'];

            for (const name of forbiddenNames) {
                const mockHandle = {
                    name,
                    kind: 'directory'
                } as FileSystemDirectoryHandle;

                const result = await validateDirectoryHandle(mockHandle);
                expect(result.valid).toBe(false);
                expect(result.message).toBeDefined();
                expect(result.message).toContain('Carpeta del Sistema No Permitida');
            }
        });

        it('should reject Unix system folder names', async () => {
            const forbiddenNames = ['bin', 'etc', 'var', 'tmp', 'root'];

            for (const name of forbiddenNames) {
                const mockHandle = {
                    name,
                    kind: 'directory'
                } as FileSystemDirectoryHandle;

                const result = await validateDirectoryHandle(mockHandle);
                expect(result.valid).toBe(false);
                expect(result.message).toBeDefined();
            }
        });

        it('should allow user directories', async () => {
            const safeNames = ['Documents', 'Downloads', 'BarackProyectos', 'Ingenieria', 'Projects'];

            for (const name of safeNames) {
                const mockHandle = {
                    name,
                    kind: 'directory'
                } as FileSystemDirectoryHandle;

                const result = await validateDirectoryHandle(mockHandle);
                expect(result.valid).toBe(true);
            }
        });

        it('should handle empty folder name gracefully', async () => {
            const mockHandle = {
                name: '',
                kind: 'directory'
            } as FileSystemDirectoryHandle;

            const result = await validateDirectoryHandle(mockHandle);
            expect(result.valid).toBe(true);
        });
    });

    describe('Destructive Operation Validation', () => {
        it('should have confirmDestructiveOperation function', () => {
            expect(typeof confirmDestructiveOperation).toBe('function');
        });

        it('should have validateFileOperation function', () => {
            expect(typeof validateFileOperation).toBe('function');
        });
    });

    describe('Tauri Path Validation (Full Path Extraction)', () => {
        it('should correctly identify forbidden folders from Windows paths', () => {
            const testCases = [
                { path: 'C:\\Windows', expected: true },
                { path: 'C:\\Program Files\\App', expected: false }, // last folder is "App"
                { path: 'D:\\Users\\Test\\System32', expected: true },
                { path: 'C:\\BarackProyectos', expected: false },
                { path: 'C:\\ProgramData', expected: true },
            ];

            testCases.forEach(({ path, expected }) => {
                const folderName = path.split(/[/\\]/).filter(Boolean).pop() || '';
                expect(isForbiddenFolderName(folderName)).toBe(expected);
            });
        });

        it('should correctly identify forbidden folders from Unix paths', () => {
            const testCases = [
                { path: '/var/log', expected: false }, // "log" is not forbidden
                { path: '/tmp', expected: true },
                { path: '/home/user/etc', expected: true }, // "etc" is forbidden
                { path: '/home/user/projects', expected: false },
            ];

            testCases.forEach(({ path, expected }) => {
                const folderName = path.split(/[/\\]/).filter(Boolean).pop() || '';
                expect(isForbiddenFolderName(folderName)).toBe(expected);
            });
        });

        it('should handle edge cases in path extraction', () => {
            // Trailing slashes
            expect(isForbiddenFolderName('C:\\Windows\\'.split(/[/\\]/).filter(Boolean).pop() || '')).toBe(true);
            // Empty path
            expect(isForbiddenFolderName(''.split(/[/\\]/).filter(Boolean).pop() || '')).toBe(false);
        });
    });
});

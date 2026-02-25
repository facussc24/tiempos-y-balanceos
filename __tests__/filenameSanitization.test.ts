import { describe, it, expect } from 'vitest';
import { sanitizeFilename, isValidFilename, makeUniqueFilename, sanitizePath } from '../utils/filenameSanitization';

describe('Filename Sanitization Security Tests', () => {
    describe('sanitizeFilename', () => {
        it('should handle normal filenames', () => {
            expect(sanitizeFilename('project.json')).toBe('project.json');
            expect(sanitizeFilename('My Project 2024.json')).toBe('My Project 2024.json');
        });

        it('should remove forbidden characters', () => {
            expect(sanitizeFilename('file<name>.json')).toBe('file_name_.json');
            expect(sanitizeFilename('file:name.json')).toBe('file_name.json');
            expect(sanitizeFilename('file|name.json')).toBe('file_name.json');
            expect(sanitizeFilename('file"name.json')).toBe('file_name.json');
        });

        it('should prevent path traversal', () => {
            // .._.._.._etc_passwd -> leading dots removed -> _.._.._etc_passwd
            expect(sanitizeFilename('../../../etc/passwd')).toBe('_.._.._etc_passwd');
            // .._.._windows_system32 -> leading dots removed -> _.._windows_system32
            expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('_.._windows_system32');
        });

        it('should handle reserved names', () => {
            expect(sanitizeFilename('CON.txt')).toBe('_CON.txt');
            expect(sanitizeFilename('PRN.json')).toBe('_PRN.json');
            expect(sanitizeFilename('AUX')).toBe('_AUX');
            expect(sanitizeFilename('COM1.dat')).toBe('_COM1.dat');
        });

        it('should limit filename length', () => {
            const longName = 'a'.repeat(300) + '.json';
            const result = sanitizeFilename(longName);
            expect(result.length).toBeLessThanOrEqual(200);
            expect(result.endsWith('.json')).toBe(true);
        });

        it('should normalize Unicode', () => {
            expect(sanitizeFilename('café.txt')).toBe('cafe.txt');
            expect(sanitizeFilename('niño.json')).toBe('nino.json');
        });

        it('should remove leading/trailing dots and spaces', () => {
            expect(sanitizeFilename('  file.txt  ')).toBe('file.txt');
            expect(sanitizeFilename('...file.txt...')).toBe('file.txt');
            expect(sanitizeFilename('.hidden')).toBe('hidden');
        });

        it('should handle empty or invalid input', () => {
            expect(sanitizeFilename('')).toBe('unnamed_file');
            expect(sanitizeFilename('   ')).toBe('unnamed_file');
            expect(sanitizeFilename('...')).toBe('unnamed_file');
        });

        it('should handle control characters', () => {
            expect(sanitizeFilename('file\x00name.txt')).toBe('file_name.txt');
            expect(sanitizeFilename('file\nnew\rline.txt')).toBe('file_new_line.txt');
        });

        it('should optionally remove spaces', () => {
            expect(sanitizeFilename('my file.txt', { allowSpaces: false })).toBe('my_file.txt');
        });
    });

    describe('isValidFilename', () => {
        it('should validate correct filenames', () => {
            expect(isValidFilename('project.json')).toBe(true);
            expect(isValidFilename('my_file_2024.txt')).toBe(true);
        });

        it('should reject invalid filenames', () => {
            expect(isValidFilename('')).toBe(false);
            expect(isValidFilename('file<name>.txt')).toBe(false);
            expect(isValidFilename('../etc/passwd')).toBe(false);
            expect(isValidFilename('CON.txt')).toBe(false);
            expect(isValidFilename('.hidden')).toBe(false);
            expect(isValidFilename('a'.repeat(300))).toBe(false);
        });
    });

    describe('makeUniqueFilename', () => {
        it('should return original if not exists', () => {
            expect(makeUniqueFilename('file.txt', [])).toBe('file.txt');
        });

        it('should append counter if exists', () => {
            const existing = ['file.txt', 'file_1.txt'];
            expect(makeUniqueFilename('file.txt', existing)).toBe('file_2.txt');
        });

        it('should preserve extension', () => {
            const existing = ['project.json'];
            expect(makeUniqueFilename('project.json', existing)).toBe('project_1.json');
        });
    });

    describe('sanitizePath', () => {
        it('should sanitize path components', () => {
            expect(sanitizePath('folder/file.txt')).toBe('folder/file.txt');
            expect(sanitizePath('bad<name>/file.txt')).toBe('bad_name_/file.txt');
        });

        it('should prevent directory traversal', () => {
            expect(sanitizePath('../../../etc')).toBe('etc');
            expect(sanitizePath('folder/../file.txt')).toBe('folder/file.txt');
        });

        it('should remove dots', () => {
            expect(sanitizePath('./folder/./file.txt')).toBe('folder/file.txt');
        });
    });

    describe('Security Edge Cases', () => {
        it('should handle null bytes', () => {
            expect(sanitizeFilename('file\x00.txt')).toBe('file_.txt');
        });

        it('should handle mixed separators', () => {
            expect(sanitizeFilename('path/to\\file.txt')).toBe('path_to_file.txt');
        });

        it('should handle very long extensions', () => {
            const name = 'file.' + 'x'.repeat(50);
            const result = sanitizeFilename(name);
            expect(result.length).toBeLessThanOrEqual(200);
        });

        it('should handle only forbidden characters', () => {
            expect(sanitizeFilename('<<<>>>')).toBe('unnamed_file');
            expect(sanitizeFilename('***')).toBe('unnamed_file');
        });
    });
});

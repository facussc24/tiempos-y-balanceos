/**
 * Tests for Revision History parsing and utilities
 */

import { describe, it, expect } from 'vitest';
import { parseRevisionFilename } from '../utils/revisionHistory';

describe('Revision History', () => {
    describe('parseRevisionFilename', () => {
        it('should parse standard revision filename', () => {
            const filename = 'MyProject_1.2.3_2024-12-14T10-30-00-000Z.json';
            const result = parseRevisionFilename(filename);

            expect(result).not.toBeNull();
            expect(result!.projectName).toBe('MyProject');
            expect(result!.version).toBe('1.2.3');
            expect(result!.filename).toBe(filename);
        });

        it('should parse project names with underscores', () => {
            const filename = 'My_Complex_Project_Name_2.0.0_2024-12-14T10-30-00-000Z.json';
            const result = parseRevisionFilename(filename);

            expect(result).not.toBeNull();
            expect(result!.projectName).toBe('My_Complex_Project_Name');
            expect(result!.version).toBe('2.0.0');
        });

        it('should return null for non-JSON files', () => {
            const result = parseRevisionFilename('readme.txt');
            expect(result).toBeNull();
        });

        it('should return null for files with too few parts', () => {
            const result = parseRevisionFilename('short.json');
            expect(result).toBeNull();
        });

        it('should handle version strings with dots', () => {
            const filename = 'Project_10.20.30_2024-12-14T10-30-00-000Z.json';
            const result = parseRevisionFilename(filename);

            expect(result).not.toBeNull();
            expect(result!.version).toBe('10.20.30');
        });

        it('should handle version strings with suffixes', () => {
            const filename = 'Project_1.0.0-beta_2024-12-14T10-30-00-000Z.json';
            const result = parseRevisionFilename(filename);

            expect(result).not.toBeNull();
            expect(result!.version).toBe('1.0.0-beta');
        });
    });
});

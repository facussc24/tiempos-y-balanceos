/**
 * Tests for engineeringTypes.ts
 *
 * Covers: classifyFileType, constants, FILE_TYPE_COLORS
 */

import { describe, it, expect } from 'vitest';
import {
    classifyFileType,
    DEFAULT_ENGINEERING_BASE_PATH,
    MANUALES_DIR,
    FORMATOS_DIR,
    FILE_TYPE_COLORS,
} from '../../../modules/engineering/engineeringTypes';

// ---------------------------------------------------------------------------
// classifyFileType
// ---------------------------------------------------------------------------

describe('classifyFileType', () => {
    it('classifies .xlsx as excel', () => {
        expect(classifyFileType('.xlsx')).toBe('excel');
    });

    it('classifies .xls as excel', () => {
        expect(classifyFileType('.xls')).toBe('excel');
    });

    it('classifies .csv as excel', () => {
        expect(classifyFileType('csv')).toBe('excel');
    });

    it('classifies .pdf as pdf', () => {
        expect(classifyFileType('.pdf')).toBe('pdf');
    });

    it('classifies .docx as word', () => {
        expect(classifyFileType('.docx')).toBe('word');
    });

    it('classifies .doc as word', () => {
        expect(classifyFileType('doc')).toBe('word');
    });

    it('classifies .html as html', () => {
        expect(classifyFileType('.html')).toBe('html');
    });

    it('classifies .htm as html', () => {
        expect(classifyFileType('htm')).toBe('html');
    });

    it('classifies .png as image', () => {
        expect(classifyFileType('.png')).toBe('image');
    });

    it('classifies .jpg as image', () => {
        expect(classifyFileType('jpg')).toBe('image');
    });

    it('classifies unknown extension as other', () => {
        expect(classifyFileType('.zzz')).toBe('other');
        expect(classifyFileType('abc')).toBe('other');
    });

    it('handles extensions with leading dot', () => {
        expect(classifyFileType('.xlsx')).toBe('excel');
        expect(classifyFileType('.PDF')).toBe('pdf');
    });

    it('is case insensitive', () => {
        expect(classifyFileType('XLSX')).toBe('excel');
        expect(classifyFileType('.PDF')).toBe('pdf');
        expect(classifyFileType('DOCX')).toBe('word');
        expect(classifyFileType('.HTML')).toBe('html');
    });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('engineeringTypes constants', () => {
    it('DEFAULT_ENGINEERING_BASE_PATH starts with Y:\\', () => {
        expect(DEFAULT_ENGINEERING_BASE_PATH).toMatch(/^Y:\\/);
    });

    it('MANUALES_DIR is Manuales', () => {
        expect(MANUALES_DIR).toBe('Manuales');
    });

    it('FORMATOS_DIR is Formatos Estandar', () => {
        expect(FORMATOS_DIR).toBe('Formatos Estandar');
    });
});

// ---------------------------------------------------------------------------
// FILE_TYPE_COLORS
// ---------------------------------------------------------------------------

describe('FILE_TYPE_COLORS', () => {
    it('has entries for all 6 categories', () => {
        const categories = ['excel', 'pdf', 'word', 'html', 'image', 'other'] as const;
        for (const cat of categories) {
            expect(FILE_TYPE_COLORS[cat]).toBeDefined();
            expect(FILE_TYPE_COLORS[cat].text).toBeTruthy();
            expect(FILE_TYPE_COLORS[cat].bg).toBeTruthy();
        }
    });
});

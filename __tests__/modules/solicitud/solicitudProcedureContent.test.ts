import { describe, it, expect } from 'vitest';
import {
    PROCEDURE_METADATA,
    PROCEDURE_SECTIONS,
    RELATED_DOCUMENTS,
} from '../../../modules/solicitud/solicitudProcedureContent';
import type { ProcedureSection } from '../../../modules/solicitud/solicitudProcedureContent';

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURE_METADATA
// ─────────────────────────────────────────────────────────────────────────────

describe('PROCEDURE_METADATA', () => {
    it('has the correct form number', () => {
        expect(PROCEDURE_METADATA.formNumber).toBe('P-ING-001');
    });

    it('has all required fields with non-empty values', () => {
        expect(PROCEDURE_METADATA.title).toBeTruthy();
        expect(PROCEDURE_METADATA.revision).toBeTruthy();
        expect(PROCEDURE_METADATA.date).toBeTruthy();
        expect(PROCEDURE_METADATA.approvedBy).toBeTruthy();
        expect(PROCEDURE_METADATA.scope).toBeTruthy();
    });

    it('has a valid ISO date string in the date field', () => {
        expect(PROCEDURE_METADATA.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURE_SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('PROCEDURE_SECTIONS', () => {
    it('contains exactly 7 sections', () => {
        expect(PROCEDURE_SECTIONS).toHaveLength(7);
    });

    it('has sequential section numbers from 1 to 7', () => {
        const numbers = PROCEDURE_SECTIONS.map((s) => s.number);
        expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    });

    it('every section has required fields: number, title, content', () => {
        for (const section of PROCEDURE_SECTIONS) {
            expect(section).toHaveProperty('number');
            expect(section).toHaveProperty('title');
            expect(section).toHaveProperty('content');
            expect(section.number).toBeTruthy();
            expect(section.title).toBeTruthy();
            // content can be empty for sections with subsections
            expect(typeof section.content).toBe('string');
        }
    });

    it('section 4 (RESPONSABILIDADES) has subsections', () => {
        const section4 = PROCEDURE_SECTIONS.find((s) => s.number === '4');
        expect(section4).toBeDefined();
        expect(section4!.title).toBe('RESPONSABILIDADES');
        expect(section4!.subsections).toBeDefined();
        expect(section4!.subsections!.length).toBeGreaterThanOrEqual(2);
    });

    it('section 4 subsections include Solicitante and Jefe de Ingenieria', () => {
        const section4 = PROCEDURE_SECTIONS.find((s) => s.number === '4')!;
        const subTitles = section4.subsections!.map((s) => s.title);
        expect(subTitles).toContain('Solicitante');
        expect(subTitles).toContain('Jefe de Ingeniería');
    });

    it('section 5 (PROCEDIMIENTO) has subsections with numbered titles', () => {
        const section5 = PROCEDURE_SECTIONS.find((s) => s.number === '5');
        expect(section5).toBeDefined();
        expect(section5!.title).toBe('PROCEDIMIENTO');
        expect(section5!.subsections).toBeDefined();
        expect(section5!.subsections!.length).toBeGreaterThanOrEqual(4);

        // Each subsection title should start with "5."
        for (const sub of section5!.subsections!) {
            expect(sub.title).toMatch(/^5\.\d/);
        }
    });

    it('sections without subsections have non-empty content', () => {
        const withoutSubs = PROCEDURE_SECTIONS.filter((s) => !s.subsections);
        expect(withoutSubs.length).toBeGreaterThan(0);
        for (const section of withoutSubs) {
            expect(section.content.length).toBeGreaterThan(0);
        }
    });

    it('all subsections have required title and content fields', () => {
        const withSubs = PROCEDURE_SECTIONS.filter((s) => s.subsections);
        for (const section of withSubs) {
            for (const sub of section.subsections!) {
                expect(sub).toHaveProperty('title');
                expect(sub).toHaveProperty('content');
                expect(sub.title).toBeTruthy();
                expect(sub.content).toBeTruthy();
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// RELATED_DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

describe('RELATED_DOCUMENTS', () => {
    it('has at least 3 entries', () => {
        expect(RELATED_DOCUMENTS.length).toBeGreaterThanOrEqual(3);
    });

    it('every entry has code and title fields', () => {
        for (const doc of RELATED_DOCUMENTS) {
            expect(doc).toHaveProperty('code');
            expect(doc).toHaveProperty('title');
            expect(doc.code).toBeTruthy();
            expect(doc.title).toBeTruthy();
        }
    });

    it('includes the APQP document reference (I-AC-005)', () => {
        const apqp = RELATED_DOCUMENTS.find((d) => d.code === 'I-AC-005');
        expect(apqp).toBeDefined();
        expect(apqp!.title).toContain('APQP');
    });

    it('includes the PPAP document reference (I-AC-012)', () => {
        const ppap = RELATED_DOCUMENTS.find((d) => d.code === 'I-AC-012');
        expect(ppap).toBeDefined();
        expect(ppap!.title).toContain('PPAP');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ProcedureSection type (structural)
// ─────────────────────────────────────────────────────────────────────────────

describe('ProcedureSection type conformance', () => {
    it('every section satisfies the ProcedureSection interface', () => {
        // TypeScript already checks this at compile time, but this runtime
        // check confirms the shape at test execution time.
        for (const section of PROCEDURE_SECTIONS) {
            const typed: ProcedureSection = section;
            expect(typeof typed.number).toBe('string');
            expect(typeof typed.title).toBe('string');
            expect(typeof typed.content).toBe('string');
            if (typed.subsections) {
                expect(Array.isArray(typed.subsections)).toBe(true);
            }
        }
    });
});

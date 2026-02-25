/**
 * Tests for AMFE Quick Templates
 *
 * Verifies that each template:
 * - Generates valid operation structures
 * - Has unique UUIDs across all levels
 * - Follows the 5-level hierarchy correctly
 * - Produces independent instances (no shared references)
 */

import { describe, it, expect } from 'vitest';
import { AMFE_TEMPLATES, TEMPLATE_CATEGORY_LABELS, AmfeTemplate } from '../../../modules/amfe/amfeTemplates';

describe('AMFE Templates', () => {
    describe('catalog', () => {
        it('has at least 5 templates covering different processes', () => {
            expect(AMFE_TEMPLATES.length).toBeGreaterThanOrEqual(5);
        });

        it('has unique IDs for every template', () => {
            const ids = AMFE_TEMPLATES.map(t => t.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('defines category labels for all used categories', () => {
            const categories = new Set(AMFE_TEMPLATES.map(t => t.category));
            for (const cat of categories) {
                expect(TEMPLATE_CATEGORY_LABELS[cat]).toBeDefined();
                expect(TEMPLATE_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
            }
        });

        it('every template has required metadata fields', () => {
            for (const template of AMFE_TEMPLATES) {
                expect(template.name).toBeTruthy();
                expect(template.description).toBeTruthy();
                expect(template.icon).toBeTruthy();
                expect(typeof template.create).toBe('function');
            }
        });
    });

    describe('each template creates a valid operation', () => {
        AMFE_TEMPLATES.forEach((template: AmfeTemplate) => {
            describe(`${template.name}`, () => {
                it('creates an operation with id, opNumber, name, and workElements', () => {
                    const op = template.create();
                    expect(op.id).toBeTruthy();
                    expect(typeof op.name).toBe('string');
                    expect(op.name.length).toBeGreaterThan(0);
                    expect(Array.isArray(op.workElements)).toBe(true);
                    expect(op.workElements.length).toBeGreaterThan(0);
                });

                it('has work elements with valid 6M types', () => {
                    const validTypes = ['Machine', 'Man', 'Material', 'Method', 'Environment', 'Measurement'];
                    const op = template.create();
                    for (const we of op.workElements) {
                        expect(validTypes).toContain(we.type);
                        expect(we.name).toBeTruthy();
                        expect(we.id).toBeTruthy();
                    }
                });

                it('has at least one function per work element', () => {
                    const op = template.create();
                    for (const we of op.workElements) {
                        expect(we.functions.length).toBeGreaterThanOrEqual(1);
                        for (const func of we.functions) {
                            expect(func.id).toBeTruthy();
                            expect(func.description).toBeTruthy();
                        }
                    }
                });

                it('has at least one failure per function', () => {
                    const op = template.create();
                    for (const we of op.workElements) {
                        for (const func of we.functions) {
                            expect(func.failures.length).toBeGreaterThanOrEqual(1);
                            for (const fail of func.failures) {
                                expect(fail.id).toBeTruthy();
                                expect(fail.description).toBeTruthy();
                            }
                        }
                    }
                });

                it('has at least one cause per failure', () => {
                    const op = template.create();
                    for (const we of op.workElements) {
                        for (const func of we.functions) {
                            for (const fail of func.failures) {
                                expect(fail.causes.length).toBeGreaterThanOrEqual(1);
                                for (const cause of fail.causes) {
                                    expect(cause.id).toBeTruthy();
                                    expect(cause.cause).toBeTruthy();
                                }
                            }
                        }
                    }
                });

                it('populates prevention and detection controls on causes', () => {
                    const op = template.create();
                    for (const we of op.workElements) {
                        for (const func of we.functions) {
                            for (const fail of func.failures) {
                                for (const cause of fail.causes) {
                                    expect(cause.preventionControl.length).toBeGreaterThan(0);
                                    expect(cause.detectionControl.length).toBeGreaterThan(0);
                                }
                            }
                        }
                    }
                });

                it('populates 3-level effects on failures', () => {
                    const op = template.create();
                    for (const we of op.workElements) {
                        for (const func of we.functions) {
                            for (const fail of func.failures) {
                                expect(fail.effectLocal).toBeTruthy();
                                expect(fail.effectNextLevel).toBeTruthy();
                                expect(fail.effectEndUser).toBeTruthy();
                            }
                        }
                    }
                });
            });
        });
    });

    describe('UUID uniqueness', () => {
        it('generates unique UUIDs across all levels within a single template', () => {
            for (const template of AMFE_TEMPLATES) {
                const op = template.create();
                const ids: string[] = [op.id];

                for (const we of op.workElements) {
                    ids.push(we.id);
                    for (const func of we.functions) {
                        ids.push(func.id);
                        for (const fail of func.failures) {
                            ids.push(fail.id);
                            for (const cause of fail.causes) {
                                ids.push(cause.id);
                            }
                        }
                    }
                }

                expect(new Set(ids).size).toBe(ids.length);
            }
        });

        it('generates different UUIDs on each create() call', () => {
            for (const template of AMFE_TEMPLATES) {
                const op1 = template.create();
                const op2 = template.create();

                // Top-level IDs must differ
                expect(op1.id).not.toBe(op2.id);

                // Work element IDs must differ
                expect(op1.workElements[0].id).not.toBe(op2.workElements[0].id);
            }
        });
    });

    describe('independence of instances', () => {
        it('modifying one instance does not affect another', () => {
            const template = AMFE_TEMPLATES[0]; // Soldadura
            const op1 = template.create();
            const op2 = template.create();

            // Mutate op1
            op1.name = 'MODIFIED';
            op1.workElements[0].name = 'MODIFIED WE';

            // op2 should be unchanged
            expect(op2.name).not.toBe('MODIFIED');
            expect(op2.workElements[0].name).not.toBe('MODIFIED WE');
        });
    });
});

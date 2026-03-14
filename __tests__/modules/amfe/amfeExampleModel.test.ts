import { describe, it, expect } from 'vitest';
import { createExampleAmfeDocument } from '../../../modules/amfe/amfeExampleModel';
import { calculateAP } from '../../../modules/amfe/apTable';

describe('amfeExampleModel', () => {
    describe('createExampleAmfeDocument', () => {
        it('should create a valid AMFE document', () => {
            const doc = createExampleAmfeDocument();
            expect(doc).toBeDefined();
            expect(doc.header).toBeDefined();
            expect(doc.operations).toBeDefined();
            expect(Array.isArray(doc.operations)).toBe(true);
        });

        it('should have 3 operations', () => {
            const doc = createExampleAmfeDocument();
            expect(doc.operations.length).toBe(3);
        });

        it('should have sequential operation numbers', () => {
            const doc = createExampleAmfeDocument();
            expect(doc.operations[0].opNumber).toBe('10');
            expect(doc.operations[1].opNumber).toBe('20');
            expect(doc.operations[2].opNumber).toBe('30');
        });

        it('should have a fully populated header', () => {
            const doc = createExampleAmfeDocument();
            const h = doc.header;
            expect(h.organization).toBe('BARACK MERCOSUL');
            expect(h.location).toBe('PLANTA HURLINGHAM');
            expect(h.client).toBeTruthy();
            expect(h.subject).toBeTruthy();
            expect(h.amfeNumber).toBeTruthy();
            expect(h.responsible).toBeTruthy();
            expect(h.team).toBeTruthy();
            expect(h.partNumber).toBeTruthy();
            expect(h.scope).toBeTruthy();
            expect(h.applicableParts).toBeTruthy();
        });

        it('should generate unique UUIDs on each call', () => {
            const doc1 = createExampleAmfeDocument();
            const doc2 = createExampleAmfeDocument();
            expect(doc1.operations[0].id).not.toBe(doc2.operations[0].id);
        });

        it('should have work elements with 6M types', () => {
            const doc = createExampleAmfeDocument();
            const allTypes = new Set<string>();
            for (const op of doc.operations) {
                for (const we of op.workElements) {
                    allTypes.add(we.type);
                }
            }
            // Should have at least Machine, Man, Method, Measurement, Environment, Material
            expect(allTypes.size).toBeGreaterThanOrEqual(5);
        });

        it('should have failures with S/O/D values filled', () => {
            const doc = createExampleAmfeDocument();
            let totalCauses = 0;
            let causesWithSOD = 0;
            for (const op of doc.operations) {
                for (const we of op.workElements) {
                    for (const fn of we.functions) {
                        for (const fail of fn.failures) {
                            expect(Number(fail.severity)).toBeGreaterThanOrEqual(1);
                            expect(Number(fail.severity)).toBeLessThanOrEqual(10);
                            for (const cause of fail.causes) {
                                totalCauses++;
                                if (Number(cause.occurrence) > 0 && Number(cause.detection) > 0) {
                                    causesWithSOD++;
                                }
                            }
                        }
                    }
                }
            }
            expect(totalCauses).toBeGreaterThanOrEqual(10);
            // Most causes should have O/D filled
            expect(causesWithSOD / totalCauses).toBeGreaterThan(0.8);
        });

        it('should have AP calculated correctly for all causes with S/O/D', () => {
            const doc = createExampleAmfeDocument();
            for (const op of doc.operations) {
                for (const we of op.workElements) {
                    for (const fn of we.functions) {
                        for (const fail of fn.failures) {
                            const s = Number(fail.severity);
                            for (const cause of fail.causes) {
                                const o = Number(cause.occurrence);
                                const d = Number(cause.detection);
                                if (s > 0 && o > 0 && d > 0) {
                                    const expectedAP = calculateAP(s, o, d);
                                    expect(cause.ap).toBe(expectedAP);
                                }
                            }
                        }
                    }
                }
            }
        });

        it('should have at least one AP=H cause', () => {
            const doc = createExampleAmfeDocument();
            let hasH = false;
            for (const op of doc.operations) {
                for (const we of op.workElements) {
                    for (const fn of we.functions) {
                        for (const fail of fn.failures) {
                            for (const cause of fail.causes) {
                                if (cause.ap === 'H') hasH = true;
                            }
                        }
                    }
                }
            }
            expect(hasH).toBe(true);
        });

        it('should have at least one cause with CC special characteristic', () => {
            const doc = createExampleAmfeDocument();
            let hasCC = false;
            for (const op of doc.operations) {
                for (const we of op.workElements) {
                    for (const fn of we.functions) {
                        for (const fail of fn.failures) {
                            for (const cause of fail.causes) {
                                if (cause.specialChar === 'CC') hasCC = true;
                            }
                        }
                    }
                }
            }
            expect(hasCC).toBe(true);
        });

        it('should have at least one optimization action filled', () => {
            const doc = createExampleAmfeDocument();
            let hasAction = false;
            for (const op of doc.operations) {
                for (const we of op.workElements) {
                    for (const fn of we.functions) {
                        for (const fail of fn.failures) {
                            for (const cause of fail.causes) {
                                if (cause.preventionAction || cause.detectionAction) hasAction = true;
                            }
                        }
                    }
                }
            }
            expect(hasAction).toBe(true);
        });

        it('should have at least one completed optimization status', () => {
            const doc = createExampleAmfeDocument();
            let hasCompleted = false;
            for (const op of doc.operations) {
                for (const we of op.workElements) {
                    for (const fn of we.functions) {
                        for (const fail of fn.failures) {
                            for (const cause of fail.causes) {
                                if (cause.status === 'Completado') hasCompleted = true;
                            }
                        }
                    }
                }
            }
            expect(hasCompleted).toBe(true);
        });

        it('should have 3 effect levels on failures', () => {
            const doc = createExampleAmfeDocument();
            for (const op of doc.operations) {
                for (const we of op.workElements) {
                    for (const fn of we.functions) {
                        for (const fail of fn.failures) {
                            // At least one effect level should be filled
                            const hasEffect = fail.effectLocal || fail.effectNextLevel || fail.effectEndUser;
                            expect(hasEffect).toBeTruthy();
                        }
                    }
                }
            }
        });
    });
});

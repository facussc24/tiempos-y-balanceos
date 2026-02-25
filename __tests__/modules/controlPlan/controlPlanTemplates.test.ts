import { describe, it, expect } from 'vitest';
import { CP_TEMPLATES } from '../../../modules/controlPlan/controlPlanTemplates';

describe('CP Templates (R6B)', () => {
    it('has 6 templates', () => {
        expect(CP_TEMPLATES.length).toBe(6);
    });

    it('all templates have unique IDs', () => {
        const ids = CP_TEMPLATES.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    for (const template of CP_TEMPLATES) {
        describe(`Template: ${template.name}`, () => {
            it('generates non-empty items array', () => {
                const items = template.create();
                expect(items.length).toBeGreaterThan(0);
            });

            it('generates items with unique IDs each call', () => {
                const items1 = template.create();
                const items2 = template.create();
                const ids1 = items1.map(i => i.id);
                const ids2 = items2.map(i => i.id);
                // IDs within a single call are unique
                expect(new Set(ids1).size).toBe(ids1.length);
                // IDs across calls are different
                for (const id of ids1) {
                    expect(ids2).not.toContain(id);
                }
            });

            it('all items have processDescription set', () => {
                const items = template.create();
                for (const item of items) {
                    expect(item.processDescription.trim()).not.toBe('');
                }
            });

            it('all items have at least one characteristic', () => {
                const items = template.create();
                for (const item of items) {
                    const hasProduct = (item.productCharacteristic || '').trim() !== '';
                    const hasProcess = (item.processCharacteristic || '').trim() !== '';
                    expect(hasProduct || hasProcess).toBe(true);
                }
            });

            it('all items have controlMethod set', () => {
                const items = template.create();
                for (const item of items) {
                    expect(item.controlMethod.trim()).not.toBe('');
                }
            });
        });
    }
});

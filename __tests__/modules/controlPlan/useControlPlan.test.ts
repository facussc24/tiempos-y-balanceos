import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('uuid', () => {
    let counter = 0;
    return { v4: () => `mock-uuid-${++counter}` };
});

import { useControlPlan } from '../../../modules/controlPlan/useControlPlan';
import { ControlPlanDocument } from '../../../modules/controlPlan/controlPlanTypes';

describe('useControlPlan', () => {
    describe('initialization', () => {
        it('starts with empty document', () => {
            const { result } = renderHook(() => useControlPlan());
            expect(result.current.data.items).toHaveLength(0);
            expect(result.current.data.header).toBeDefined();
        });

        it('has default header values', () => {
            const { result } = renderHook(() => useControlPlan());
            expect(result.current.data.header.organization).toBe('');
        });
    });

    describe('addItem', () => {
        it('creates an item with unique ID', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            expect(result.current.data.items).toHaveLength(1);
            expect(result.current.data.items[0].id).toBeTruthy();
        });

        it('creates items with empty fields', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            const item = result.current.data.items[0];
            expect(item.processStepNumber).toBe('');
            expect(item.processDescription).toBe('');
            expect(item.controlMethod).toBe('');
            expect(item.reactionPlan).toBe('');
        });

        it('appends to existing items', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.addItem());
            expect(result.current.data.items).toHaveLength(2);
            expect(result.current.data.items[0].id).not.toBe(result.current.data.items[1].id);
        });
    });

    describe('removeItem', () => {
        it('removes item by ID', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.addItem());
            const idToRemove = result.current.data.items[0].id;
            const idToKeep = result.current.data.items[1].id;

            act(() => result.current.removeItem(idToRemove));

            expect(result.current.data.items).toHaveLength(1);
            expect(result.current.data.items[0].id).toBe(idToKeep);
        });

        it('does nothing for non-existent ID', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.removeItem('nonexistent'));
            expect(result.current.data.items).toHaveLength(1);
        });
    });

    describe('updateItem', () => {
        it('updates a specific field', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            const id = result.current.data.items[0].id;

            act(() => result.current.updateItem(id, 'processDescription', 'Soldadura MIG'));

            expect(result.current.data.items[0].processDescription).toBe('Soldadura MIG');
        });

        it('does not affect other items', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.addItem());
            const id1 = result.current.data.items[0].id;

            act(() => result.current.updateItem(id1, 'sampleSize', 'n=5'));

            expect(result.current.data.items[0].sampleSize).toBe('n=5');
            expect(result.current.data.items[1].sampleSize).toBe('');
        });
    });

    describe('moveItem', () => {
        it('moves item down', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.addItem());
            const id1 = result.current.data.items[0].id;
            const id2 = result.current.data.items[1].id;

            act(() => result.current.moveItem(id1, 'down'));

            expect(result.current.data.items[0].id).toBe(id2);
            expect(result.current.data.items[1].id).toBe(id1);
        });

        it('moves item up', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.addItem());
            const id1 = result.current.data.items[0].id;
            const id2 = result.current.data.items[1].id;

            act(() => result.current.moveItem(id2, 'up'));

            expect(result.current.data.items[0].id).toBe(id2);
            expect(result.current.data.items[1].id).toBe(id1);
        });

        it('does nothing when moving first item up', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.addItem());
            const id1 = result.current.data.items[0].id;

            act(() => result.current.moveItem(id1, 'up'));

            expect(result.current.data.items[0].id).toBe(id1); // unchanged
        });

        it('does nothing when moving last item down', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.addItem());
            const id2 = result.current.data.items[1].id;

            act(() => result.current.moveItem(id2, 'down'));

            expect(result.current.data.items[1].id).toBe(id2); // unchanged
        });
    });

    describe('updateHeader', () => {
        it('updates a header field', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.updateHeader('organization', 'BARACK'));
            expect(result.current.data.header.organization).toBe('BARACK');
        });
    });

    describe('loadData', () => {
        it('replaces entire document', () => {
            const { result } = renderHook(() => useControlPlan());
            const doc: ControlPlanDocument = {
                header: { controlPlanNumber: '', phase: 'production' as const, partNumber: 'ABC', latestChangeLevel: '', partName: '', organization: 'Test Org', supplier: '', supplierCode: '', keyContactPhone: '', date: '', revision: '1', responsible: 'Juan', approvedBy: '', client: 'Toyota', coreTeam: '', customerEngApproval: '', customerQualityApproval: '', otherApproval: '', linkedAmfeProject: '', applicableParts: '' },
                items: [{ id: 'loaded-1', processStepNumber: '10', processDescription: 'Op', machineDeviceTool: '', characteristicNumber: '', productCharacteristic: '', processCharacteristic: '', specialCharClass: '', specification: '', evaluationTechnique: '', sampleSize: '', sampleFrequency: '', controlMethod: '', reactionPlan: '', reactionPlanOwner: '', controlProcedure: '' }],
            };

            act(() => result.current.loadData(doc));

            expect(result.current.data.header.organization).toBe('Test Org');
            expect(result.current.data.items).toHaveLength(1);
            expect(result.current.data.items[0].processStepNumber).toBe('10');
        });
    });

    describe('resetData', () => {
        it('clears to empty state', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.updateHeader('organization', 'Test'));
            expect(result.current.data.items).toHaveLength(1);

            act(() => result.current.resetData());

            expect(result.current.data.items).toHaveLength(0);
            expect(result.current.data.header.organization).toBe('');
        });
    });

    describe('setItems', () => {
        it('replaces items array', () => {
            const { result } = renderHook(() => useControlPlan());
            act(() => result.current.addItem());
            act(() => result.current.addItem());

            const newItems = [{ id: 'new-1', processStepNumber: '20', processDescription: 'New', machineDeviceTool: '', characteristicNumber: '', productCharacteristic: '', processCharacteristic: '', specialCharClass: '', specification: '', evaluationTechnique: '', sampleSize: '', sampleFrequency: '', controlMethod: '', reactionPlan: '', reactionPlanOwner: '', controlProcedure: '' }];
            act(() => result.current.setItems(newItems));

            expect(result.current.data.items).toHaveLength(1);
            expect(result.current.data.items[0].processStepNumber).toBe('20');
        });
    });
});

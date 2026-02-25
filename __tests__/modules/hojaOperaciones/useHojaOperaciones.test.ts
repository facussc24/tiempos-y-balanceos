import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHojaOperaciones } from '../../../modules/hojaOperaciones/useHojaOperaciones';
import {
    HoDocument,
    EMPTY_HO_HEADER,
    DEFAULT_REACTION_PLAN_TEXT,
    createEmptyHoSheet,
} from '../../../modules/hojaOperaciones/hojaOperacionesTypes';

// ============================================================================
// HELPERS
// ============================================================================

function makeDoc(sheetCount = 1): HoDocument {
    const sheets = Array.from({ length: sheetCount }, (_, i) =>
        createEmptyHoSheet(`op-${i}`, String((i + 1) * 10), `Operacion ${i + 1}`),
    );
    return {
        header: { ...EMPTY_HO_HEADER, organization: 'Test Org' },
        sheets,
    };
}

// ============================================================================
// DOCUMENT LIFECYCLE
// ============================================================================

describe('useHojaOperaciones – lifecycle', () => {
    it('starts with empty document', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        expect(result.current.data.sheets).toEqual([]);
        expect(result.current.activeSheetId).toBeNull();
    });

    it('loadData sets document and activates first sheet', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc(2);

        act(() => result.current.loadData(doc));

        expect(result.current.data.sheets).toHaveLength(2);
        expect(result.current.activeSheetId).toBe(doc.sheets[0].id);
    });

    it('loadData with empty sheets sets activeSheetId to null', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc: HoDocument = { header: { ...EMPTY_HO_HEADER }, sheets: [] };

        act(() => result.current.loadData(doc));

        expect(result.current.activeSheetId).toBeNull();
    });

    it('resetData clears everything', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        act(() => result.current.loadData(makeDoc(2)));
        act(() => result.current.resetData());

        expect(result.current.data.sheets).toEqual([]);
        expect(result.current.activeSheetId).toBeNull();
    });
});

// ============================================================================
// NAVIGATION
// ============================================================================

describe('useHojaOperaciones – navigation', () => {
    it('setActiveSheet changes active sheet', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc(3);
        act(() => result.current.loadData(doc));

        act(() => result.current.setActiveSheet(doc.sheets[2].id));
        expect(result.current.activeSheetId).toBe(doc.sheets[2].id);
    });

    it('setActiveSheet to null works', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        act(() => result.current.loadData(makeDoc(1)));
        act(() => result.current.setActiveSheet(null));

        expect(result.current.activeSheetId).toBeNull();
    });
});

// ============================================================================
// HEADER
// ============================================================================

describe('useHojaOperaciones – header', () => {
    it('updateHeader changes a header field', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        act(() => result.current.loadData(makeDoc()));

        act(() => result.current.updateHeader('organization', 'Barack'));
        expect(result.current.data.header.organization).toBe('Barack');
    });

    it('updateHeader preserves other fields', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        act(() => result.current.loadData(makeDoc()));

        act(() => result.current.updateHeader('client', 'VW'));
        expect(result.current.data.header.organization).toBe('Test Org');
        expect(result.current.data.header.client).toBe('VW');
    });
});

// ============================================================================
// SHEET FIELDS
// ============================================================================

describe('useHojaOperaciones – sheet fields', () => {
    it('updateSheetField changes a string field', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.updateSheetField(doc.sheets[0].id, 'sector', 'COSTURA'));
        expect(result.current.data.sheets[0].sector).toBe('COSTURA');
    });

    it('updateSheetField does not touch other sheets', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc(2);
        act(() => result.current.loadData(doc));

        act(() => result.current.updateSheetField(doc.sheets[0].id, 'sector', 'SOLDADURA'));
        expect(result.current.data.sheets[1].sector).toBe('');
    });
});

// ============================================================================
// STEPS
// ============================================================================

describe('useHojaOperaciones – steps', () => {
    it('addStep creates a new step with correct number', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addStep(doc.sheets[0].id));
        expect(result.current.data.sheets[0].steps).toHaveLength(1);
        expect(result.current.data.sheets[0].steps[0].stepNumber).toBe(1);
    });

    it('addStep increments step number', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addStep(doc.sheets[0].id));
        act(() => result.current.addStep(doc.sheets[0].id));
        expect(result.current.data.sheets[0].steps).toHaveLength(2);
        expect(result.current.data.sheets[0].steps[1].stepNumber).toBe(2);
    });

    it('removeStep removes the correct step', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addStep(doc.sheets[0].id));
        act(() => result.current.addStep(doc.sheets[0].id));
        const stepId = result.current.data.sheets[0].steps[0].id;

        act(() => result.current.removeStep(doc.sheets[0].id, stepId));
        expect(result.current.data.sheets[0].steps).toHaveLength(1);
        expect(result.current.data.sheets[0].steps[0].id).not.toBe(stepId);
    });

    it('updateStep changes a field on the correct step', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addStep(doc.sheets[0].id));
        const stepId = result.current.data.sheets[0].steps[0].id;

        act(() => result.current.updateStep(doc.sheets[0].id, stepId, 'description', 'Tomar pieza'));
        expect(result.current.data.sheets[0].steps[0].description).toBe('Tomar pieza');
    });

    it('updateStep toggles isKeyPoint', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addStep(doc.sheets[0].id));
        const stepId = result.current.data.sheets[0].steps[0].id;

        act(() => result.current.updateStep(doc.sheets[0].id, stepId, 'isKeyPoint', true));
        expect(result.current.data.sheets[0].steps[0].isKeyPoint).toBe(true);
    });

    it('reorderSteps moves step and renumbers', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addStep(doc.sheets[0].id));
        act(() => result.current.addStep(doc.sheets[0].id));
        act(() => result.current.addStep(doc.sheets[0].id));

        const originalFirst = result.current.data.sheets[0].steps[0].id;

        act(() => result.current.reorderSteps(doc.sheets[0].id, 0, 2));

        const steps = result.current.data.sheets[0].steps;
        expect(steps[2].id).toBe(originalFirst);
        // Renumbered sequentially
        expect(steps.map(s => s.stepNumber)).toEqual([1, 2, 3]);
    });

    it('reorderSteps ignores invalid indices', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addStep(doc.sheets[0].id));
        const before = result.current.data.sheets[0].steps[0].id;

        act(() => result.current.reorderSteps(doc.sheets[0].id, -1, 0));
        act(() => result.current.reorderSteps(doc.sheets[0].id, 0, 99));

        expect(result.current.data.sheets[0].steps[0].id).toBe(before);
    });
});

// ============================================================================
// PPE & HAZARDS
// ============================================================================

describe('useHojaOperaciones – PPE & hazards', () => {
    it('togglePpe adds an item', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.togglePpe(doc.sheets[0].id, 'anteojos'));
        expect(result.current.data.sheets[0].safetyElements).toContain('anteojos');
    });

    it('togglePpe removes an existing item', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.togglePpe(doc.sheets[0].id, 'guantes'));
        act(() => result.current.togglePpe(doc.sheets[0].id, 'guantes'));
        expect(result.current.data.sheets[0].safetyElements).not.toContain('guantes');
    });

    it('toggleHazard adds a hazard', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.toggleHazard(doc.sheets[0].id, 'altoVoltaje'));
        expect(result.current.data.sheets[0].hazardWarnings).toContain('altoVoltaje');
    });

    it('toggleHazard removes an existing hazard', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.toggleHazard(doc.sheets[0].id, 'ruido'));
        act(() => result.current.toggleHazard(doc.sheets[0].id, 'ruido'));
        expect(result.current.data.sheets[0].hazardWarnings).not.toContain('ruido');
    });
});

// ============================================================================
// VISUAL AIDS
// ============================================================================

describe('useHojaOperaciones – visual aids', () => {
    it('addVisualAid creates a new aid', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addVisualAid(doc.sheets[0].id, 'base64data', 'Vista frontal'));

        const aids = result.current.data.sheets[0].visualAids;
        expect(aids).toHaveLength(1);
        expect(aids[0].imageData).toBe('base64data');
        expect(aids[0].caption).toBe('Vista frontal');
        expect(aids[0].order).toBe(0);
    });

    it('addVisualAid increments order', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addVisualAid(doc.sheets[0].id, 'img1', 'Foto 1'));
        act(() => result.current.addVisualAid(doc.sheets[0].id, 'img2', 'Foto 2'));

        expect(result.current.data.sheets[0].visualAids[1].order).toBe(1);
    });

    it('removeVisualAid removes the correct aid', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addVisualAid(doc.sheets[0].id, 'img1', 'A'));
        act(() => result.current.addVisualAid(doc.sheets[0].id, 'img2', 'B'));
        const aidId = result.current.data.sheets[0].visualAids[0].id;

        act(() => result.current.removeVisualAid(doc.sheets[0].id, aidId));
        expect(result.current.data.sheets[0].visualAids).toHaveLength(1);
        expect(result.current.data.sheets[0].visualAids[0].caption).toBe('B');
    });

    it('updateVisualAid changes a field', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.addVisualAid(doc.sheets[0].id, 'img', 'Old caption'));
        const aidId = result.current.data.sheets[0].visualAids[0].id;

        act(() => result.current.updateVisualAid(doc.sheets[0].id, aidId, 'caption', 'New caption'));
        expect(result.current.data.sheets[0].visualAids[0].caption).toBe('New caption');
    });
});

// ============================================================================
// QUALITY CHECKS
// ============================================================================

describe('useHojaOperaciones – quality checks', () => {
    it('updateQualityCheckRegistro changes only the registro field', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        // Add a quality check manually for testing
        doc.sheets[0].qualityChecks = [{
            id: 'qc-1',
            characteristic: 'Dimension A',
            specification: '5mm',
            evaluationTechnique: 'Calibre',
            frequency: '100%',
            controlMethod: 'Inspeccion visual',
            reactionAction: 'Segregar',
            reactionContact: 'Supervisor',
            specialCharSymbol: 'SC',
            registro: '',
            cpItemId: 'cp-1',
        }];
        act(() => result.current.loadData(doc));

        act(() => result.current.updateQualityCheckRegistro(doc.sheets[0].id, 'qc-1', 'PLN-001'));

        const qc = result.current.data.sheets[0].qualityChecks[0];
        expect(qc.registro).toBe('PLN-001');
        expect(qc.characteristic).toBe('Dimension A');
    });
});

// ============================================================================
// REACTION PLAN
// ============================================================================

describe('useHojaOperaciones – reaction plan', () => {
    it('updateReactionPlan changes text', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.updateReactionPlan(doc.sheets[0].id, 'Nuevo plan'));
        expect(result.current.data.sheets[0].reactionPlanText).toBe('Nuevo plan');
    });

    it('updateReactionContact changes contact', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.updateReactionContact(doc.sheets[0].id, 'Lider de celda'));
        expect(result.current.data.sheets[0].reactionContact).toBe('Lider de celda');
    });
});

// ============================================================================
// STATUS
// ============================================================================

describe('useHojaOperaciones – status', () => {
    it('updateStatus changes sheet status', () => {
        const { result } = renderHook(() => useHojaOperaciones());
        const doc = makeDoc();
        act(() => result.current.loadData(doc));

        act(() => result.current.updateStatus(doc.sheets[0].id, 'aprobado'));
        expect(result.current.data.sheets[0].status).toBe('aprobado');
    });
});

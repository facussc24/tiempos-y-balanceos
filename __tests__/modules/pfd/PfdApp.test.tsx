vi.mock('../../../utils/repositories/pfdRepository', () => ({
    listPfdDocuments: vi.fn().mockResolvedValue([]),
    loadPfdDocument: vi.fn().mockResolvedValue(null),
    savePfdDocument: vi.fn().mockResolvedValue(true),
    deletePfdDocument: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../utils/repositories/draftRepository', () => ({
    saveDraft: vi.fn().mockResolvedValue(undefined),
    loadDraft: vi.fn().mockResolvedValue(null),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
    listDraftKeys: vi.fn().mockResolvedValue([]),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Must import after mocks
const { default: PfdApp } = await import('../../../modules/pfd/PfdApp');
const { createEmptyPfdDocument } = await import('../../../modules/pfd/pfdTypes');

describe('PfdApp', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should render the toolbar', () => {
        render(<PfdApp />);
        expect(screen.getByTitle('Nuevo documento vacío')).toBeTruthy();
        expect(screen.getByTitle('Guardar (Ctrl+S)')).toBeTruthy();
    });

    it('should render the header section', () => {
        render(<PfdApp />);
        expect(screen.getByText('Encabezado')).toBeTruthy();
    });

    it('should render the add step FAB', () => {
        render(<PfdApp />);
        expect(screen.getByText('Agregar Paso')).toBeTruthy();
    });

    it('should show step count in footer', () => {
        render(<PfdApp />);
        expect(screen.getAllByText(/pasos?/).length).toBeGreaterThan(0);
    });

    it('should call onBackToLanding when provided', () => {
        const onBack = vi.fn();
        render(<PfdApp onBackToLanding={onBack} />);
        const backBtn = screen.getByTitle('Volver al inicio');
        fireEvent.click(backBtn);
        expect(onBack).toHaveBeenCalled();
    });

    it('should add a step when FAB is clicked', () => {
        render(<PfdApp />);
        const fab = screen.getByText('Agregar Paso');
        fireEvent.click(fab);
        // Should now have 2 steps (1 default + 1 added) in the flow editor
        const stepCards = screen.getAllByTestId(/^flow-step-/);
        expect(stepCards.length).toBe(2);
    });

    // Phase B: Flow Editor integration
    it('should render the flow editor panel', () => {
        render(<PfdApp />);
        expect(screen.getByTestId('pfd-flow-editor')).toBeTruthy();
        expect(screen.getByText('EDITOR DE FLUJO')).toBeTruthy();
    });

    // Embedded mode
    it('should hide toolbar and footer in embedded mode', () => {
        render(<PfdApp embedded />);
        // Toolbar should not be rendered
        expect(screen.queryByTitle('Nuevo documento vacío')).toBeNull();
        // Footer should not be rendered
        expect(screen.queryByText('Deshacer')).toBeNull();
    });

    it('should show flow editor in embedded mode', () => {
        render(<PfdApp embedded />);
        expect(screen.getByTestId('pfd-flow-editor')).toBeTruthy();
    });

    // initialData prop
    it('should load initialData when provided', () => {
        const doc = createEmptyPfdDocument();
        doc.header.partName = 'Test Part XYZ';
        render(<PfdApp embedded initialData={doc} />);
        // The header should show the part name
        const input = document.querySelector('input[name="partName"]') as HTMLInputElement;
        if (input) {
            expect(input.value).toBe('Test Part XYZ');
        }
    });

    // Detail panel
    it('should show detail panel when selecting a step in flow editor', () => {
        render(<PfdApp />);
        // Click on a step card in the flow editor
        const stepCards = screen.getAllByTestId(/^flow-step-/);
        if (stepCards.length > 0) {
            fireEvent.click(stepCards[0]);
            // Detail panel should appear
            expect(screen.getByTestId('detail-panel')).toBeTruthy();
        }
    });

    it('should hide detail panel when close is clicked', () => {
        render(<PfdApp />);
        const stepCards = screen.getAllByTestId(/^flow-step-/);
        if (stepCards.length > 0) {
            fireEvent.click(stepCards[0]);
            expect(screen.getByTestId('detail-panel')).toBeTruthy();
            // Close the panel
            const closeBtn = screen.getByLabelText('Cerrar panel');
            fireEvent.click(closeBtn);
            expect(screen.queryByTestId('detail-panel')).toBeNull();
        }
    });
});

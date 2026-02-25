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
const PfdApp = (await import('../../../modules/pfd/PfdApp')).default;

describe('PfdApp', () => {
    it('should render the toolbar', () => {
        render(<PfdApp />);
        expect(screen.getByTitle('Nuevo documento')).toBeTruthy();
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
        // Should now have 2 steps (1 default + 1 added)
        const rows = document.querySelectorAll('[data-step-id]');
        expect(rows.length).toBe(2);
    });
});

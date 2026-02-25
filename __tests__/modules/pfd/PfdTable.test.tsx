import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PfdTable from '../../../modules/pfd/PfdTable';
import { createEmptyStep, PfdStep, PFD_COLUMNS } from '../../../modules/pfd/pfdTypes';

function makeStep(overrides?: Partial<PfdStep>): PfdStep {
    return { ...createEmptyStep(), stepNumber: 'OP 10', description: 'Test', ...overrides };
}

describe('PfdTable', () => {
    const defaultProps = {
        steps: [makeStep()],
        onUpdateStep: vi.fn(),
        onRemoveStep: vi.fn(),
        onMoveStep: vi.fn(),
    };

    it('should render column headers', () => {
        const { container } = render(
            <table><PfdTable {...defaultProps} /></table>
        );
        for (const col of PFD_COLUMNS) {
            expect(container.textContent).toContain(col.label);
        }
    });

    it('should render step data', () => {
        render(<table><PfdTable {...defaultProps} /></table>);
        expect(screen.getByDisplayValue('OP 10')).toBeTruthy();
        expect(screen.getByDisplayValue('Test')).toBeTruthy();
    });

    it('should show empty state when no steps', () => {
        render(<table><PfdTable {...defaultProps} steps={[]} /></table>);
        expect(screen.getByText(/No hay pasos definidos/)).toBeTruthy();
    });

    it('should render multiple steps', () => {
        const steps = [
            makeStep({ stepNumber: 'OP 10', description: 'First' }),
            makeStep({ stepNumber: 'OP 20', description: 'Second' }),
        ];
        render(<table><PfdTable {...defaultProps} steps={steps} /></table>);
        expect(screen.getByDisplayValue('OP 10')).toBeTruthy();
        expect(screen.getByDisplayValue('OP 20')).toBeTruthy();
    });

    it('should hide actions column in readOnly mode', () => {
        const { container } = render(
            <table><PfdTable {...defaultProps} readOnly /></table>
        );
        expect(container.querySelector('[title="Eliminar paso"]')).toBeNull();
    });

    it('should call onRemoveStep when delete clicked', () => {
        const onRemove = vi.fn();
        render(
            <table><PfdTable {...defaultProps} onRemoveStep={onRemove} /></table>
        );
        const deleteBtn = screen.getByTitle('Eliminar paso');
        fireEvent.click(deleteBtn);
        expect(onRemove).toHaveBeenCalledWith(defaultProps.steps[0].id);
    });

    it('should render CC/SC badges in readOnly mode', () => {
        const step = makeStep({ productSpecialChar: 'CC' });
        render(<table><PfdTable {...defaultProps} steps={[step]} readOnly /></table>);
        expect(screen.getByText('CC')).toBeTruthy();
    });

    it('should render rework row with red background (C3-N1)', () => {
        const step = makeStep({ isRework: true, rejectDisposition: 'rework' });
        const { container } = render(<table><PfdTable {...defaultProps} steps={[step]} /></table>);
        const row = container.querySelector('[data-step-id]');
        expect(row?.className).toContain('bg-red-50');
    });

    it('should render external process row with blue background', () => {
        const step = makeStep({ isExternalProcess: true });
        const { container } = render(<table><PfdTable {...defaultProps} steps={[step]} /></table>);
        const row = container.querySelector('[data-step-id]');
        expect(row?.className).toContain('bg-blue-50');
    });

    it('should show template and add buttons in empty state (C3-U3)', () => {
        const onAddStep = vi.fn();
        const onLoadTemplate = vi.fn();
        render(
            <table><PfdTable {...defaultProps} steps={[]} onAddStep={onAddStep} onLoadTemplate={onLoadTemplate} /></table>
        );
        const addBtn = screen.getByText('Agregar paso vacío');
        const templateBtn = screen.getByText('Plantilla básica (8 pasos)');
        expect(addBtn).toBeTruthy();
        expect(templateBtn).toBeTruthy();
    });

    it('should call onLoadTemplate when template button clicked (C3-U3)', () => {
        const onLoadTemplate = vi.fn();
        render(
            <table><PfdTable {...defaultProps} steps={[]} onLoadTemplate={onLoadTemplate} /></table>
        );
        fireEvent.click(screen.getByText('Plantilla básica (8 pasos)'));
        expect(onLoadTemplate).toHaveBeenCalled();
    });

    it('should call onAddStep when add button clicked (C3-U3)', () => {
        const onAddStep = vi.fn();
        render(
            <table><PfdTable {...defaultProps} steps={[]} onAddStep={onAddStep} /></table>
        );
        fireEvent.click(screen.getByText('Agregar paso vacío'));
        expect(onAddStep).toHaveBeenCalled();
    });

    it('should not show template/add buttons in readOnly empty state', () => {
        render(
            <table><PfdTable {...defaultProps} steps={[]} readOnly onAddStep={vi.fn()} onLoadTemplate={vi.fn()} /></table>
        );
        expect(screen.queryByText('Agregar paso vacío')).toBeNull();
        expect(screen.queryByText('Plantilla básica (8 pasos)')).toBeNull();
    });

    it('should render scrap disposition with orange background (C3-N1)', () => {
        const step = makeStep({ rejectDisposition: 'scrap', scrapDescription: 'Motivo' });
        const { container } = render(<table><PfdTable {...defaultProps} steps={[step]} /></table>);
        const row = container.querySelector('[data-step-id]');
        expect(row?.className).toContain('bg-orange-50');
    });

    it('should render sort disposition with yellow background (C3-N1)', () => {
        const step = makeStep({ rejectDisposition: 'sort', scrapDescription: 'Criterio' });
        const { container } = render(<table><PfdTable {...defaultProps} steps={[step]} /></table>);
        const row = container.querySelector('[data-step-id]');
        expect(row?.className).toContain('bg-yellow-50');
    });

    it('should render focus-within ring on rows (C3-U1)', () => {
        const { container } = render(<table><PfdTable {...defaultProps} /></table>);
        const row = container.querySelector('[data-step-id]');
        expect(row?.className).toContain('focus-within:ring-2');
    });

    it('should show manufacturing template button in empty state (C4-U3)', () => {
        const onLoadManufacturingTemplate = vi.fn();
        render(
            <table><PfdTable {...defaultProps} steps={[]} onLoadManufacturingTemplate={onLoadManufacturingTemplate} /></table>
        );
        const btn = screen.getByText('Plantilla manufactura (11 pasos)');
        expect(btn).toBeTruthy();
        fireEvent.click(btn);
        expect(onLoadManufacturingTemplate).toHaveBeenCalled();
    });
});

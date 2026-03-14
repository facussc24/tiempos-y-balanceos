import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PfdFlowEditor from '../../../modules/pfd/PfdFlowEditor';
import { createEmptyStep, PfdStep } from '../../../modules/pfd/pfdTypes';

/** Helper to create a test step with sensible defaults */
function makeStep(overrides?: Partial<PfdStep>): PfdStep {
    return {
        ...createEmptyStep(),
        stepNumber: 'OP 10',
        description: 'Soldadura por puntos',
        ...overrides,
    };
}

/** Create a set of varied test steps */
function makeTestSteps(): PfdStep[] {
    return [
        makeStep({ id: 'step-1', stepNumber: 'OP 10', description: 'Recepcion MP', stepType: 'storage' }),
        makeStep({ id: 'step-2', stepNumber: 'OP 20', description: 'Soldadura por puntos', stepType: 'operation', machineDeviceTool: 'Robot ZAC 1' }),
        makeStep({ id: 'step-3', stepNumber: 'OP 30', description: 'Inspeccion visual', stepType: 'inspection' }),
        makeStep({ id: 'step-4', stepNumber: 'OP 40', description: 'Almacenamiento final', stepType: 'storage' }),
    ];
}

/** Create steps with parallel branches */
function makeBranchedSteps(): PfdStep[] {
    return [
        makeStep({ id: 'main-1', stepNumber: 'OP 10', description: 'Recepcion', branchId: '', branchLabel: '' }),
        makeStep({ id: 'branch-a1', stepNumber: 'OP 20', description: 'Linea A paso 1', branchId: 'A', branchLabel: 'Linea A' }),
        makeStep({ id: 'branch-a2', stepNumber: 'OP 25', description: 'Linea A paso 2', branchId: 'A', branchLabel: 'Linea A' }),
        makeStep({ id: 'branch-b1', stepNumber: 'OP 30', description: 'Linea B paso 1', branchId: 'B', branchLabel: 'Linea B' }),
        makeStep({ id: 'main-2', stepNumber: 'OP 40', description: 'Convergencia', branchId: '', branchLabel: '' }),
    ];
}

const defaultProps = {
    steps: makeTestSteps(),
    selectedStepId: null,
    onSelectStep: vi.fn(),
    onInsertAfter: vi.fn(),
    onRemoveStep: vi.fn(),
    onMoveStep: vi.fn(),
    onUpdateStep: vi.fn(),
    onDuplicateStep: vi.fn(),
    readOnly: false,
    isOpen: true,
    onToggle: vi.fn(),
};

describe('PfdFlowEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the toggle header even when collapsed', () => {
        render(<PfdFlowEditor {...defaultProps} isOpen={false} />);
        expect(screen.getByText('EDITOR DE FLUJO')).toBeTruthy();
    });

    it('should not render flow content when collapsed (isOpen=false)', () => {
        render(<PfdFlowEditor {...defaultProps} isOpen={false} />);
        expect(screen.queryByTestId('flow-step-step-1')).toBeNull();
    });

    it('should show empty state message when no steps and isOpen', () => {
        render(<PfdFlowEditor {...defaultProps} steps={[]} />);
        expect(screen.getByTestId('empty-state')).toBeTruthy();
        expect(screen.getByText(/No hay pasos/)).toBeTruthy();
    });

    it('should render step cards when steps provided', () => {
        render(<PfdFlowEditor {...defaultProps} />);
        expect(screen.getByTestId('flow-step-step-1')).toBeTruthy();
        expect(screen.getByTestId('flow-step-step-2')).toBeTruthy();
        expect(screen.getByTestId('flow-step-step-3')).toBeTruthy();
        expect(screen.getByTestId('flow-step-step-4')).toBeTruthy();
    });

    it('should show step number and description in cards', () => {
        render(<PfdFlowEditor {...defaultProps} />);
        const card = screen.getByTestId('flow-step-step-2');
        expect(card.textContent).toContain('OP 20');
        expect(card.textContent).toContain('Soldadura por puntos');
    });

    it('should highlight selected step with data-selected attribute', () => {
        render(<PfdFlowEditor {...defaultProps} selectedStepId="step-2" />);
        const selected = screen.getByTestId('flow-step-step-2');
        expect(selected.getAttribute('data-selected')).toBe('true');
        // Other steps should NOT be selected
        const other = screen.getByTestId('flow-step-step-1');
        expect(other.getAttribute('data-selected')).toBeNull();
    });

    it('should call onSelectStep when clicking a step', () => {
        const onSelectStep = vi.fn();
        render(<PfdFlowEditor {...defaultProps} onSelectStep={onSelectStep} />);
        fireEvent.click(screen.getByTestId('flow-step-step-3'));
        expect(onSelectStep).toHaveBeenCalledWith('step-3');
    });

    it('should show insert buttons between steps when not readOnly', () => {
        render(<PfdFlowEditor {...defaultProps} />);
        // Between step-1 and step-2 there should be an insert button for step-1
        const insertBtn = screen.getByTestId('insert-after-step-1');
        expect(insertBtn).toBeTruthy();
    });

    it('should call onInsertAfter when clicking an insert button', () => {
        const onInsertAfter = vi.fn();
        render(<PfdFlowEditor {...defaultProps} onInsertAfter={onInsertAfter} />);
        fireEvent.click(screen.getByTestId('insert-after-step-1'));
        expect(onInsertAfter).toHaveBeenCalledWith('step-1');
    });

    it('should not show insert buttons when readOnly', () => {
        render(<PfdFlowEditor {...defaultProps} readOnly />);
        expect(screen.queryByTestId('insert-after-step-1')).toBeNull();
    });

    it('should show parallel branch layout for branched steps', () => {
        render(<PfdFlowEditor {...defaultProps} steps={makeBranchedSteps()} />);
        expect(screen.getByTestId('parallel-group')).toBeTruthy();
        expect(screen.getByTestId('branch-lane-A')).toBeTruthy();
        expect(screen.getByTestId('branch-lane-B')).toBeTruthy();
    });

    it('should show fork header for parallel groups', () => {
        render(<PfdFlowEditor {...defaultProps} steps={makeBranchedSteps()} />);
        expect(screen.getByTestId('fork-header')).toBeTruthy();
        expect(screen.getByText('FLUJO PARALELO')).toBeTruthy();
    });

    it('should show join footer after parallel groups', () => {
        render(<PfdFlowEditor {...defaultProps} steps={makeBranchedSteps()} />);
        expect(screen.getByTestId('join-footer')).toBeTruthy();
        expect(screen.getByText('CONVERGENCIA')).toBeTruthy();
    });

    it('should call onToggle when toggle header is clicked', () => {
        const onToggle = vi.fn();
        render(<PfdFlowEditor {...defaultProps} onToggle={onToggle} />);
        fireEvent.click(screen.getByTestId('flow-editor-toggle'));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should show context menu on right-click of a step', () => {
        render(<PfdFlowEditor {...defaultProps} />);
        const card = screen.getByTestId('flow-step-step-2');
        fireEvent.contextMenu(card);
        expect(screen.getByTestId('flow-context-menu')).toBeTruthy();
        expect(screen.getByText('Insertar paso abajo')).toBeTruthy();
        expect(screen.getByText('Duplicar')).toBeTruthy();
        expect(screen.getByText('Mover arriba')).toBeTruthy();
        expect(screen.getByText('Mover abajo')).toBeTruthy();
        expect(screen.getByText('Eliminar')).toBeTruthy();
    });

    it('should show CC badge on steps with CC special char', () => {
        const steps = [makeStep({ id: 'cc-step', stepNumber: 'OP 10', productSpecialChar: 'CC' })];
        render(<PfdFlowEditor {...defaultProps} steps={steps} />);
        expect(screen.getByTestId('badge-cc')).toBeTruthy();
        expect(screen.getByTestId('badge-cc').textContent).toBe('CC');
    });

    it('should show SC badge on steps with SC special char', () => {
        const steps = [makeStep({ id: 'sc-step', stepNumber: 'OP 10', processSpecialChar: 'SC' })];
        render(<PfdFlowEditor {...defaultProps} steps={steps} />);
        expect(screen.getByTestId('badge-sc')).toBeTruthy();
        expect(screen.getByTestId('badge-sc').textContent).toBe('SC');
    });

    it('should show EXT badge on external process steps', () => {
        const steps = [makeStep({ id: 'ext-step', stepNumber: 'OP 10', isExternalProcess: true })];
        render(<PfdFlowEditor {...defaultProps} steps={steps} />);
        expect(screen.getByTestId('badge-ext')).toBeTruthy();
        expect(screen.getByTestId('badge-ext').textContent).toBe('EXT');
    });

    it('should display step count in header', () => {
        render(<PfdFlowEditor {...defaultProps} />);
        expect(screen.getByText('4 pasos')).toBeTruthy();
    });

    it('should not show context menu on right-click in readOnly mode', () => {
        render(<PfdFlowEditor {...defaultProps} readOnly />);
        const card = screen.getByTestId('flow-step-step-2');
        fireEvent.contextMenu(card);
        expect(screen.queryByTestId('flow-context-menu')).toBeNull();
    });
});

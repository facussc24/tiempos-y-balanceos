import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PfdStepDetailPanel from '../../../modules/pfd/PfdStepDetailPanel';
import type { PfdStepDetailPanelProps } from '../../../modules/pfd/PfdStepDetailPanel';
import { createEmptyStep, PfdStep } from '../../../modules/pfd/pfdTypes';

// Mock PfdSymbolPicker
vi.mock('../../../modules/pfd/PfdSymbolPicker', () => ({
    default: (props: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
        <select
            data-testid="symbol-picker"
            value={props.value}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => props.onChange(e.target.value)}
            disabled={props.disabled}
        >
            <option value="operation">Op</option>
            <option value="transport">Transporte</option>
            <option value="inspection">Inspeccion</option>
        </select>
    ),
}));

// Mock PfdSymbols
vi.mock('../../../modules/pfd/PfdSymbols', () => ({
    PfdSymbol: ({ type, size }: { type: string; size?: number }) => (
        <span data-testid="pfd-symbol" data-type={type} data-size={size}>
            {type}
        </span>
    ),
}));

// Mock lucide-react X icon
vi.mock('lucide-react', () => ({
    X: (props: Record<string, unknown>) => <span data-testid="x-icon" {...props}>X</span>,
}));

function makeStep(overrides?: Partial<PfdStep>): PfdStep {
    return {
        ...createEmptyStep('OP 20'),
        description: 'Soldadura MIG',
        machineDeviceTool: 'Robot ZAC',
        productCharacteristic: 'Cordón continuo',
        productSpecialChar: 'none',
        processCharacteristic: 'Amperaje',
        processSpecialChar: 'none',
        reference: 'PL-001',
        department: 'Producción',
        notes: 'Nota de prueba',
        rejectDisposition: 'none',
        isExternalProcess: false,
        branchId: '',
        branchLabel: '',
        ...overrides,
    };
}

function renderPanel(propOverrides?: Partial<PfdStepDetailPanelProps>) {
    const defaultProps: PfdStepDetailPanelProps = {
        step: makeStep(),
        onUpdateStep: vi.fn(),
        onBatchUpdateStep: vi.fn(),
        onClose: vi.fn(),
        readOnly: false,
        ...propOverrides,
    };
    const result = render(<PfdStepDetailPanel {...defaultProps} />);
    return { ...result, props: defaultProps };
}

describe('PfdStepDetailPanel', () => {
    it('shows empty state when step is null', () => {
        renderPanel({ step: null });
        expect(screen.getByTestId('detail-panel-empty')).toBeTruthy();
        expect(screen.getByText(/Seleccion/)).toBeTruthy();
    });

    it('shows step details when step is provided', () => {
        renderPanel();
        expect(screen.getByTestId('detail-panel')).toBeTruthy();
        expect(screen.queryByTestId('detail-panel-empty')).toBeNull();
    });

    it('displays step number and description in header', () => {
        renderPanel({ step: makeStep({ stepNumber: 'OP 30', description: 'Pintura electroforética' }) });
        const title = screen.getByTestId('detail-panel-title');
        expect(title.textContent).toContain('OP 30');
    });

    it('shows PfdSymbolPicker for step type', () => {
        renderPanel();
        const picker = screen.getByTestId('symbol-picker');
        expect(picker).toBeTruthy();
        expect((picker as HTMLSelectElement).value).toBe('operation');
    });

    it('updates description when changed', () => {
        const { props } = renderPanel();
        const textarea = screen.getByTestId('detail-description');
        fireEvent.change(textarea, { target: { value: 'New description' } });
        expect(props.onUpdateStep).toHaveBeenCalledWith(
            props.step!.id,
            'description',
            'New description',
        );
    });

    it('shows CC/SC dropdowns', () => {
        renderPanel();
        const productSelect = screen.getByTestId('detail-productSpecialChar');
        const processSelect = screen.getByTestId('detail-processSpecialChar');
        expect(productSelect).toBeTruthy();
        expect(processSelect).toBeTruthy();
        // Each has 3 options: —, CC, SC
        expect((productSelect as HTMLSelectElement).options.length).toBe(3);
        expect((processSelect as HTMLSelectElement).options.length).toBe(3);
    });

    it('shows branch dropdown with options', () => {
        renderPanel();
        const branchSelect = screen.getByTestId('detail-branchId');
        expect(branchSelect).toBeTruthy();
        const options = (branchSelect as HTMLSelectElement).options;
        // —, A, B, C, D
        expect(options.length).toBe(5);
        expect(options[0].value).toBe('');
        expect(options[1].value).toBe('A');
        expect(options[2].value).toBe('B');
        expect(options[3].value).toBe('C');
        expect(options[4].value).toBe('D');
    });

    it('shows branch label input when branch is selected', () => {
        renderPanel({ step: makeStep({ branchId: 'A', branchLabel: 'Mecanizado' }) });
        const labelInput = screen.getByTestId('detail-branchLabel');
        expect(labelInput).toBeTruthy();
        expect((labelInput as HTMLInputElement).value).toBe('Mecanizado');
    });

    it('hides branch label input when no branch selected', () => {
        renderPanel({ step: makeStep({ branchId: '', branchLabel: '' }) });
        expect(screen.queryByTestId('detail-branchLabel')).toBeNull();
    });

    it('shows disposition dropdown', () => {
        renderPanel();
        const select = screen.getByTestId('detail-rejectDisposition');
        expect(select).toBeTruthy();
        const options = (select as HTMLSelectElement).options;
        expect(options.length).toBe(4);
        expect(options[0].value).toBe('none');
        expect(options[1].value).toBe('rework');
        expect(options[2].value).toBe('scrap');
        expect(options[3].value).toBe('sort');
    });

    it('shows rework return field when disposition is rework', () => {
        renderPanel({ step: makeStep({ rejectDisposition: 'rework', reworkReturnStep: 'OP 10' }) });
        const input = screen.getByTestId('detail-reworkReturnStep');
        expect(input).toBeTruthy();
        expect((input as HTMLInputElement).value).toBe('OP 10');
    });

    it('shows scrap description when disposition is scrap', () => {
        renderPanel({ step: makeStep({ rejectDisposition: 'scrap', scrapDescription: 'Material defectuoso' }) });
        const input = screen.getByTestId('detail-scrapDescription');
        expect(input).toBeTruthy();
        expect((input as HTMLInputElement).value).toBe('Material defectuoso');
    });

    it('shows external process checkbox', () => {
        renderPanel();
        const checkbox = screen.getByTestId('detail-isExternalProcess') as HTMLInputElement;
        expect(checkbox).toBeTruthy();
        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(false);
    });

    it('calls onClose when close button clicked', () => {
        const { props } = renderPanel();
        const closeBtn = screen.getByLabelText('Cerrar panel');
        fireEvent.click(closeBtn);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onBatchUpdateStep for disposition changes', () => {
        const { props } = renderPanel();
        const select = screen.getByTestId('detail-rejectDisposition');
        fireEvent.change(select, { target: { value: 'rework' } });
        expect(props.onBatchUpdateStep).toHaveBeenCalledWith(props.step!.id, {
            rejectDisposition: 'rework',
            isRework: true,
        });
    });

    it('readOnly mode: inputs are disabled', () => {
        renderPanel({ readOnly: true });
        const stepNumber = screen.getByTestId('detail-stepNumber') as HTMLInputElement;
        const description = screen.getByTestId('detail-description') as HTMLTextAreaElement;
        const productChar = screen.getByTestId('detail-productCharacteristic') as HTMLInputElement;
        const processChar = screen.getByTestId('detail-processCharacteristic') as HTMLInputElement;
        const productSC = screen.getByTestId('detail-productSpecialChar') as HTMLSelectElement;
        const processSC = screen.getByTestId('detail-processSpecialChar') as HTMLSelectElement;
        const reference = screen.getByTestId('detail-reference') as HTMLInputElement;
        const department = screen.getByTestId('detail-department') as HTMLInputElement;
        const notes = screen.getByTestId('detail-notes') as HTMLInputElement;
        const disposition = screen.getByTestId('detail-rejectDisposition') as HTMLSelectElement;
        const external = screen.getByTestId('detail-isExternalProcess') as HTMLInputElement;
        const symbolPicker = screen.getByTestId('symbol-picker') as HTMLSelectElement;

        expect(stepNumber.disabled).toBe(true);
        expect(description.disabled).toBe(true);
        // machineDeviceTool removed from UI (hidden per spec)
        expect(productChar.disabled).toBe(true);
        expect(processChar.disabled).toBe(true);
        expect(productSC.disabled).toBe(true);
        expect(processSC.disabled).toBe(true);
        expect(reference.disabled).toBe(true);
        expect(department.disabled).toBe(true);
        expect(notes.disabled).toBe(true);
        expect(disposition.disabled).toBe(true);
        expect(external.disabled).toBe(true);
        expect(symbolPicker.disabled).toBe(true);
    });
});

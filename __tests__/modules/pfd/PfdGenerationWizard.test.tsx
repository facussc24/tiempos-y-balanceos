/**
 * Tests for PfdGenerationWizard — 4-step modal wizard for generating PFD from AMFE.
 *
 * Tests navigation (step forward/back/jump), modal open/close behavior,
 * and end-to-end generation flow.
 */

// Mock sub-step components to avoid pulling in their heavy dependency trees.
// Each renders a simple div with identifiable text so we can verify which step is shown.
vi.mock('../../../modules/pfd/PfdWizardStepOps', () => ({
    default: ({ amfeDoc }: any) => (
        <div data-testid="step-ops">StepOps ({amfeDoc.operations?.length ?? 0} ops)</div>
    ),
}));
vi.mock('../../../modules/pfd/PfdWizardStepFlow', () => ({
    default: () => <div data-testid="step-flow">StepFlow</div>,
}));
vi.mock('../../../modules/pfd/PfdWizardStepInspections', () => ({
    default: () => <div data-testid="step-inspections">StepInspections</div>,
}));
vi.mock('../../../modules/pfd/PfdWizardStepPreview', () => ({
    default: () => <div data-testid="step-preview">StepPreview</div>,
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PfdGenerationWizard from '../../../modules/pfd/PfdGenerationWizard';
import type { AmfeDocument } from '../../../modules/amfe/amfeTypes';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function createTestAmfeDoc(): AmfeDocument {
    return {
        header: {
            partNumber: 'P-001',
            subject: 'Test Part',
            client: 'Test Client',
            organization: 'Barack Mercosul',
            location: 'Hurlingham',
            team: 'Test Team',
            responsible: 'Test User',
            processResponsible: '',
            approvedBy: '',
            modelYear: '2026',
            startDate: '',
            revDate: '',
            amfeNumber: '',
            confidentiality: '',
            revision: '',
            scope: '',
            applicableParts: '',
        },
        operations: [
            { id: 'op-1', opNumber: '10', name: 'Soldadura por puntos', workElements: [] },
            { id: 'op-2', opNumber: '20', name: 'Inspeccion visual', workElements: [] },
            { id: 'op-3', opNumber: '30', name: 'Almacenamiento final', workElements: [] },
        ],
    };
}

const defaultProps = () => ({
    amfeDoc: createTestAmfeDoc(),
    projectName: 'Test Project',
    isOpen: true,
    onComplete: vi.fn(),
    onCancel: vi.fn(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PfdGenerationWizard', () => {
    // ------------------------------------------------------------------
    // Visibility
    // ------------------------------------------------------------------

    it('renders nothing when isOpen=false', () => {
        const props = defaultProps();
        const { container } = render(
            <PfdGenerationWizard {...props} isOpen={false} />,
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders modal when isOpen=true', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('shows wizard title "Generar Flujograma desde AMFE"', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);
        expect(screen.getByText('Generar Flujograma desde AMFE')).toBeTruthy();
    });

    it('shows "3 operaciones disponibles" in subtitle', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);
        expect(screen.getByText('3 operaciones disponibles')).toBeTruthy();
    });

    // ------------------------------------------------------------------
    // Step 1 initial state
    // ------------------------------------------------------------------

    it('shows step 1 title "Revisar Operaciones" initially', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);
        expect(screen.getByText(/Paso 1.*Revisar Operaciones/)).toBeTruthy();
    });

    it('shows 4 progress step buttons', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);
        // Each wizard step has a button in the progress bar with its title as a span
        expect(screen.getByText('Revisar Operaciones', { selector: 'span' })).toBeTruthy();
        expect(screen.getByText('Organizar Flujo', { selector: 'span' })).toBeTruthy();
        expect(screen.getByText('Inspecciones', { selector: 'span' })).toBeTruthy();
        expect(screen.getByText('Vista Previa', { selector: 'span' })).toBeTruthy();
    });

    it('"Anterior" button is disabled on step 1', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);
        const anteriorBtn = screen.getByText('Anterior').closest('button')!;
        expect(anteriorBtn.disabled).toBe(true);
    });

    // ------------------------------------------------------------------
    // Navigation: forward / back
    // ------------------------------------------------------------------

    it('clicking "Siguiente" advances to step 2 ("Organizar Flujo")', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);

        fireEvent.click(screen.getByText('Siguiente'));

        expect(screen.getByText(/Paso 2.*Organizar Flujo/)).toBeTruthy();
        expect(screen.getByTestId('step-flow')).toBeTruthy();
    });

    it('clicking "Anterior" goes back to step 1', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);

        // Go forward to step 2
        fireEvent.click(screen.getByText('Siguiente'));
        expect(screen.getByText(/Paso 2/)).toBeTruthy();

        // Go back
        const anteriorBtn = screen.getByText('Anterior').closest('button')!;
        fireEvent.click(anteriorBtn);
        expect(screen.getByText(/Paso 1.*Revisar Operaciones/)).toBeTruthy();
    });

    it('clicking step 4 progress button jumps to step 4 (Vista Previa)', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);

        // The progress bar has a button with title "Vista Previa"
        const step4Btn = screen.getByTitle('Vista Previa');
        fireEvent.click(step4Btn);

        expect(screen.getByText(/Paso 4.*Vista Previa/)).toBeTruthy();
        expect(screen.getByTestId('step-preview')).toBeTruthy();
    });

    // ------------------------------------------------------------------
    // Step 4: "Generar Flujograma" button
    // ------------------------------------------------------------------

    it('step 4 shows "Generar Flujograma" button instead of "Siguiente"', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);

        // Jump to step 4
        fireEvent.click(screen.getByTitle('Vista Previa'));

        expect(screen.getByText('Generar Flujograma')).toBeTruthy();
        expect(screen.queryByText('Siguiente')).toBeNull();
    });

    // ------------------------------------------------------------------
    // Cancel / close
    // ------------------------------------------------------------------

    it('clicking "Cancelar" calls onCancel', () => {
        const props = defaultProps();
        render(<PfdGenerationWizard {...props} />);

        fireEvent.click(screen.getByText('Cancelar'));
        expect(props.onCancel).toHaveBeenCalledTimes(1);
    });

    it('clicking X button calls onCancel', () => {
        const props = defaultProps();
        render(<PfdGenerationWizard {...props} />);

        fireEvent.click(screen.getByLabelText('Cerrar wizard'));
        expect(props.onCancel).toHaveBeenCalledTimes(1);
    });

    it('clicking backdrop calls onCancel', () => {
        const props = defaultProps();
        render(<PfdGenerationWizard {...props} />);

        // The backdrop is the outermost div wrapping the modal dialog
        const backdrop = screen.getByRole('dialog').parentElement!;
        fireEvent.click(backdrop);
        expect(props.onCancel).toHaveBeenCalledTimes(1);
    });

    it('pressing Escape calls onCancel', () => {
        const props = defaultProps();
        render(<PfdGenerationWizard {...props} />);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(props.onCancel).toHaveBeenCalledTimes(1);
    });

    // ------------------------------------------------------------------
    // Generation
    // ------------------------------------------------------------------

    it('clicking "Generar Flujograma" on step 4 calls onComplete with a PfdDocument', () => {
        const props = defaultProps();
        render(<PfdGenerationWizard {...props} />);

        // Jump to step 4
        fireEvent.click(screen.getByTitle('Vista Previa'));
        // Click generate
        fireEvent.click(screen.getByText('Generar Flujograma'));

        expect(props.onComplete).toHaveBeenCalledTimes(1);
        const doc = props.onComplete.mock.calls[0][0];
        // It should be a PfdDocument with at least id, header, steps
        expect(doc).toHaveProperty('id');
        expect(doc).toHaveProperty('header');
        expect(doc).toHaveProperty('steps');
    });

    it('the generated PfdDocument has steps array with length > 0', () => {
        const props = defaultProps();
        render(<PfdGenerationWizard {...props} />);

        fireEvent.click(screen.getByTitle('Vista Previa'));
        fireEvent.click(screen.getByText('Generar Flujograma'));

        const doc = props.onComplete.mock.calls[0][0];
        expect(Array.isArray(doc.steps)).toBe(true);
        expect(doc.steps.length).toBeGreaterThan(0);
    });

    it('the generated PfdDocument header has partNumber from AMFE', () => {
        const props = defaultProps();
        render(<PfdGenerationWizard {...props} />);

        fireEvent.click(screen.getByTitle('Vista Previa'));
        fireEvent.click(screen.getByText('Generar Flujograma'));

        const doc = props.onComplete.mock.calls[0][0];
        expect(doc.header.partNumber).toBe('P-001');
    });

    // ------------------------------------------------------------------
    // Sub-step rendering
    // ------------------------------------------------------------------

    it('renders StepOps component on step 1', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);
        expect(screen.getByTestId('step-ops')).toBeTruthy();
        expect(screen.getByText(/StepOps.*3 ops/)).toBeTruthy();
    });

    it('renders StepInspections component on step 3', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);

        // Click the Inspecciones progress button to jump to step 3
        fireEvent.click(screen.getByTitle('Inspecciones'));

        expect(screen.getByText(/Paso 3.*Inspecciones/)).toBeTruthy();
        expect(screen.getByTestId('step-inspections')).toBeTruthy();
    });

    it('"Anterior" button is enabled on step 2', () => {
        render(<PfdGenerationWizard {...defaultProps()} />);

        fireEvent.click(screen.getByText('Siguiente'));
        const anteriorBtn = screen.getByText('Anterior').closest('button')!;
        expect(anteriorBtn.disabled).toBe(false);
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SolicitudProcedureViewer from '../../../modules/solicitud/SolicitudProcedureViewer';
import {
    PROCEDURE_METADATA,
    PROCEDURE_SECTIONS,
    RELATED_DOCUMENTS,
} from '../../../modules/solicitud/solicitudProcedureContent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderViewer(overrides: Partial<React.ComponentProps<typeof SolicitudProcedureViewer>> = {}) {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
    };
    return render(<SolicitudProcedureViewer {...defaultProps} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SolicitudProcedureViewer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when isOpen is false', () => {
        const { container } = renderViewer({ isOpen: false });
        expect(container.innerHTML).toBe('');
    });

    it('renders modal dialog when isOpen is true', () => {
        renderViewer({ isOpen: true });
        expect(screen.getByRole('dialog')).toBeDefined();
    });

    it('renders with correct aria attributes', () => {
        renderViewer({ isOpen: true });
        const dialog = screen.getByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.getAttribute('aria-label')).toBe('Procedimiento SGC');
    });

    it('shows procedure title from PROCEDURE_METADATA', () => {
        renderViewer({ isOpen: true });
        expect(screen.getByText(PROCEDURE_METADATA.title)).toBeDefined();
    });

    it('shows form number and revision in header', () => {
        renderViewer({ isOpen: true });
        // Form number appears in header and footer
        const formNumberElements = screen.getAllByText(
            (_, element) => !!element?.textContent?.includes(PROCEDURE_METADATA.formNumber),
        );
        expect(formNumberElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders all regular sections (non-section-7) as cards', () => {
        renderViewer({ isOpen: true });
        const regularSections = PROCEDURE_SECTIONS.filter((s) => s.number !== '7');
        for (const section of regularSections) {
            expect(screen.getByText(section.title)).toBeDefined();
        }
    });

    it('renders section 7 (Documentos Relacionados) with its title', () => {
        renderViewer({ isOpen: true });
        const docSection = PROCEDURE_SECTIONS.find((s) => s.number === '7');
        if (docSection) {
            expect(screen.getByText(docSection.title)).toBeDefined();
        }
    });

    it('renders related documents list with codes', () => {
        renderViewer({ isOpen: true });
        for (const doc of RELATED_DOCUMENTS) {
            expect(screen.getByText(doc.code)).toBeDefined();
        }
    });

    it('renders related documents list with titles', () => {
        renderViewer({ isOpen: true });
        for (const doc of RELATED_DOCUMENTS) {
            expect(screen.getByText(doc.title)).toBeDefined();
        }
    });

    it('renders close button with accessible label', () => {
        renderViewer({ isOpen: true });
        expect(screen.getByLabelText('Cerrar')).toBeDefined();
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        renderViewer({ isOpen: true, onClose });
        fireEvent.click(screen.getByLabelText('Cerrar'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
        const onClose = vi.fn();
        renderViewer({ isOpen: true, onClose });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
        const onClose = vi.fn();
        renderViewer({ isOpen: true, onClose });
        // The backdrop is the first child div with bg-black/40 class
        const backdrop = document.querySelector('.bg-black\\/40');
        expect(backdrop).not.toBeNull();
        fireEvent.click(backdrop!);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows "Procedimiento SGC" label in top bar', () => {
        renderViewer({ isOpen: true });
        // The top bar label
        const labels = screen.getAllByText('Procedimiento SGC');
        expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it('renders section numbers in numbered circles', () => {
        renderViewer({ isOpen: true });
        for (const section of PROCEDURE_SECTIONS) {
            // Each section number should appear as text content
            const numberElements = screen.getAllByText(section.number);
            expect(numberElements.length).toBeGreaterThanOrEqual(1);
        }
    });
});

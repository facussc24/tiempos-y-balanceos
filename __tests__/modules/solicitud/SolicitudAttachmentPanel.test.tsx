import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SolicitudAttachmentPanel from '../../../modules/solicitud/SolicitudAttachmentPanel';
import type { SolicitudAttachment } from '../../../modules/solicitud/solicitudTypes';

// ---------------------------------------------------------------------------
// Mock the lazy-imported solicitudAttachments module
// ---------------------------------------------------------------------------

const mockSelectAttachmentFiles = vi.fn().mockResolvedValue([]);
const mockUploadAttachment = vi.fn().mockResolvedValue({ success: true, attachment: null });
const mockDeleteServerAttachment = vi.fn().mockResolvedValue(undefined);
const mockOpenAttachmentFile = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../modules/solicitud/solicitudAttachments', () => ({
    selectAttachmentFiles: (...args: unknown[]) => mockSelectAttachmentFiles(...args),
    uploadAttachment: (...args: unknown[]) => mockUploadAttachment(...args),
    deleteServerAttachment: (...args: unknown[]) => mockDeleteServerAttachment(...args),
    openAttachmentFile: (...args: unknown[]) => mockOpenAttachmentFile(...args),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockAttachments: SolicitudAttachment[] = [
    {
        fileName: 'plano.pdf',
        fileSize: 1024,
        fileType: 'pdf',
        relativePath: 'adjuntos/plano.pdf',
        uploadedAt: '2026-03-06T10:00:00Z',
        uploadedBy: 'test',
    },
    {
        fileName: 'foto.jpg',
        fileSize: 2048,
        fileType: 'jpg',
        relativePath: 'adjuntos/foto.jpg',
        uploadedAt: '2026-03-06T11:00:00Z',
        uploadedBy: 'test',
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPanel(overrides: Partial<React.ComponentProps<typeof SolicitudAttachmentPanel>> = {}) {
    const defaultProps = {
        attachments: [],
        serverFolderPath: 'Y:\\Ingenieria\\SGC-001',
        serverAvailable: true,
        readOnly: false,
        onAttachmentsChange: vi.fn(),
    };
    return render(<SolicitudAttachmentPanel {...defaultProps} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SolicitudAttachmentPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders "Sin archivos adjuntos" when attachments list is empty', () => {
        renderPanel({ attachments: [] });
        expect(screen.getByText('Sin archivos adjuntos')).toBeDefined();
    });

    it('renders the header with "Archivos Adjuntos" title', () => {
        renderPanel();
        expect(screen.getByText('Archivos Adjuntos')).toBeDefined();
    });

    it('shows file list with correct file names when attachments are provided', () => {
        renderPanel({ attachments: mockAttachments });
        expect(screen.getByText('plano.pdf')).toBeDefined();
        expect(screen.getByText('foto.jpg')).toBeDefined();
    });

    it('shows formatted file sizes for each attachment', () => {
        renderPanel({ attachments: mockAttachments });
        // 1024 bytes = 1.0 KB, 2048 bytes = 2.0 KB
        expect(screen.getByText('1.0 KB')).toBeDefined();
        expect(screen.getByText('2.0 KB')).toBeDefined();
    });

    it('shows attachment count badge when attachments exist', () => {
        renderPanel({ attachments: mockAttachments });
        expect(screen.getByText('(2)')).toBeDefined();
    });

    it('shows upload button when canUpload is true (not readOnly, server available, folder exists)', () => {
        renderPanel({
            attachments: [],
            serverAvailable: true,
            serverFolderPath: 'Y:\\Ingenieria\\SGC-001',
            readOnly: false,
        });
        expect(screen.getByText('Adjuntar')).toBeDefined();
    });

    it('hides upload button when readOnly is true', () => {
        renderPanel({ readOnly: true });
        expect(screen.queryByText('Adjuntar')).toBeNull();
    });

    it('hides upload button when server is not available', () => {
        renderPanel({ serverAvailable: false });
        expect(screen.queryByText('Adjuntar')).toBeNull();
    });

    it('shows server unavailable notice when server is not available and not readOnly', () => {
        renderPanel({ serverAvailable: false, readOnly: false });
        expect(
            screen.getByText(/Servidor no disponible/),
        ).toBeDefined();
    });

    it('does not show server unavailable notice when readOnly', () => {
        renderPanel({ serverAvailable: false, readOnly: true });
        expect(screen.queryByText(/Servidor no disponible/)).toBeNull();
    });

    it('shows "save first" notice when server available but no serverFolderPath', () => {
        renderPanel({ serverAvailable: true, serverFolderPath: null, readOnly: false });
        expect(
            screen.getByText(/Guarde la solicitud para crear la carpeta/),
        ).toBeDefined();
    });

    it('renders delete buttons for attachments when not readOnly', () => {
        renderPanel({ attachments: mockAttachments, readOnly: false });
        const deleteButtons = screen.getAllByTitle('Eliminar');
        expect(deleteButtons).toHaveLength(2);
    });

    it('hides delete buttons when readOnly', () => {
        renderPanel({ attachments: mockAttachments, readOnly: true });
        expect(screen.queryByTitle('Eliminar')).toBeNull();
    });

    it('renders open file buttons for each attachment', () => {
        renderPanel({ attachments: mockAttachments });
        const openButtons = screen.getAllByTitle('Abrir archivo');
        expect(openButtons).toHaveLength(2);
    });

    it('shows inline confirmation when delete button is clicked', () => {
        renderPanel({ attachments: mockAttachments });

        const deleteButtons = screen.getAllByTitle('Eliminar');
        fireEvent.click(deleteButtons[0]);

        // Should show inline confirmation with Sí/No buttons
        expect(screen.getByText('Eliminar?')).toBeDefined();
        expect(screen.getByText('Sí')).toBeDefined();
        expect(screen.getByText('No')).toBeDefined();
    });

    it('does not remove attachment if inline confirm is cancelled', () => {
        const onAttachmentsChange = vi.fn();
        renderPanel({ attachments: mockAttachments, onAttachmentsChange });

        const deleteButtons = screen.getAllByTitle('Eliminar');
        fireEvent.click(deleteButtons[0]);

        // Click "No" to cancel
        fireEvent.click(screen.getByText('No'));

        expect(onAttachmentsChange).not.toHaveBeenCalled();
        // Confirmation UI should disappear
        expect(screen.queryByText('Eliminar?')).toBeNull();
    });

    it('removes attachment when inline confirm Sí is clicked', async () => {
        const onAttachmentsChange = vi.fn();
        renderPanel({ attachments: mockAttachments, onAttachmentsChange });

        const deleteButtons = screen.getAllByTitle('Eliminar');
        fireEvent.click(deleteButtons[0]);

        // Click "Sí" to confirm
        fireEvent.click(screen.getByText('Sí'));

        // Should call onAttachmentsChange with the remaining attachment
        await vi.waitFor(() => {
            expect(onAttachmentsChange).toHaveBeenCalledWith([mockAttachments[1]]);
        });
    });
});

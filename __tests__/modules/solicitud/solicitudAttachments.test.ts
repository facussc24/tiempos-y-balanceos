import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted before imports)
// ---------------------------------------------------------------------------

vi.mock('../../../utils/networkUtils', () => ({
    joinPath: vi.fn((...segments: string[]) => segments.filter(Boolean).join('\\')),
    getFilename: vi.fn((p: string) => {
        const parts = p.replace(/\//g, '\\').split('\\');
        return parts[parts.length - 1] || p;
    }),
}));

vi.mock('../../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
    validateAttachment,
    uploadAttachment,
    listServerAttachments,
    deleteServerAttachment,
    selectAttachmentFiles,
    openAttachmentFile,
} from '../../../modules/solicitud/solicitudAttachments';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../../../modules/solicitud/solicitudTypes';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('solicitudAttachments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // validateAttachment
    // -----------------------------------------------------------------------

    describe('validateAttachment', () => {
        it('rejects blocked executable extensions', () => {
            const result = validateAttachment('C:\\files\\malware.exe', 1024);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('.exe');
        });

        it('rejects .bat extension', () => {
            const result = validateAttachment('C:\\files\\script.bat', 500);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('.bat');
        });

        it('rejects .ps1 extension', () => {
            const result = validateAttachment('C:\\files\\hack.ps1', 200);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('.ps1');
        });

        it('rejects files exceeding MAX_ATTACHMENT_SIZE_BYTES', () => {
            const oversized = MAX_ATTACHMENT_SIZE_BYTES + 1;
            const result = validateAttachment('C:\\files\\huge.pdf', oversized);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('tamano maximo');
        });

        it('rejects empty files (0 bytes)', () => {
            const result = validateAttachment('C:\\files\\empty.pdf', 0);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('vacio');
        });

        it('accepts a valid PDF file within size limit', () => {
            const result = validateAttachment('C:\\files\\plano.pdf', 1024 * 100);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('accepts files with no extension', () => {
            const result = validateAttachment('C:\\files\\README', 512);
            expect(result.valid).toBe(true);
        });

        it('accepts a file at exactly MAX_ATTACHMENT_SIZE_BYTES', () => {
            const result = validateAttachment('C:\\files\\big.zip', MAX_ATTACHMENT_SIZE_BYTES);
            expect(result.valid).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // uploadAttachment (web-safe stub)
    // -----------------------------------------------------------------------

    describe('uploadAttachment', () => {
        it('returns failure with descriptive error (not supported in web mode)', async () => {
            const result = await uploadAttachment(
                'C:\\local\\plano.pdf',
                'Y:\\solicitudes\\SOL-001\\adjuntos',
                'Juan'
            );

            expect(result.success).toBe(false);
            expect(result.attachment).toBeUndefined();
            expect(result.error).toContain('modo web');
        });
    });

    // -----------------------------------------------------------------------
    // listServerAttachments (web-safe stub)
    // -----------------------------------------------------------------------

    describe('listServerAttachments', () => {
        it('returns empty array (not supported in web mode)', async () => {
            const result = await listServerAttachments('Y:\\adjuntos');
            expect(result).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // deleteServerAttachment (web-safe stub)
    // -----------------------------------------------------------------------

    describe('deleteServerAttachment', () => {
        it('returns false (not supported in web mode)', async () => {
            const result = await deleteServerAttachment('Y:\\adjuntos', 'ghost.pdf');
            expect(result).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // selectAttachmentFiles (browser path)
    // -----------------------------------------------------------------------

    describe('selectAttachmentFiles', () => {
        it('uses browser file input (always in web mode)', async () => {
            // The function creates an input element and clicks it. Since jsdom doesn't
            // fully simulate file dialogs, simulate cancel to resolve the promise.
            const promise = selectAttachmentFiles();

            // Find the hidden input that was appended to the body
            const input = document.querySelector('input[type="file"]');
            expect(input).not.toBeNull();

            // Simulate cancel to resolve the promise
            if (input) {
                input.dispatchEvent(new Event('cancel'));
            }

            const result = await promise;
            expect(result).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // openAttachmentFile (web-safe stub)
    // -----------------------------------------------------------------------

    describe('openAttachmentFile', () => {
        it('throws with a descriptive error (not supported in web mode)', async () => {
            await expect(openAttachmentFile('Y:\\file.pdf')).rejects.toThrow(
                'solo esta disponible en la aplicacion de escritorio'
            );
        });
    });
});

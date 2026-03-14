/**
 * Tests for HoVisualAidPanel image compression, validation, and size limits.
 *
 * The compressImage function uses the browser canvas API.
 * We mock Image and canvas for deterministic testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    compressImage,
    isValidImageFormat,
    dataUriByteSize,
    MAX_IMAGE_DIMENSION,
    MAX_IMAGE_QUALITY,
    MAX_IMAGE_BYTES,
    SUPPORTED_IMAGE_REGEX,
} from '../../../modules/hojaOperaciones/HoVisualAidPanel';

// ============================================================================
// MOCK SETUP
// ============================================================================

/** Creates a mock canvas context that records draw calls. */
function createMockContext(): CanvasRenderingContext2D {
    return {
        drawImage: vi.fn(),
        // Provide stubs for other CanvasRenderingContext2D members as needed
    } as unknown as CanvasRenderingContext2D;
}

/** Build a fake data URI of a given approximate byte size. */
function makeFakeDataUri(mime: string, approxBytes: number): string {
    // base64 uses ~4/3 chars per byte
    const b64Chars = Math.ceil((approxBytes * 4) / 3);
    const payload = 'A'.repeat(b64Chars);
    return `data:${mime};base64,${payload}`;
}

// We store references so each test can customize behavior
let mockCtx: CanvasRenderingContext2D;
let mockToDataURL: ReturnType<typeof vi.fn>;
let capturedImageInstances: Array<{ onload: (() => void) | null; onerror: (() => void) | null; src: string; width: number; height: number }>;

beforeEach(() => {
    mockCtx = createMockContext();
    // Default: return a small JPEG data URI (~50 bytes payload)
    mockToDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,' + 'A'.repeat(68));

    // Mock document.createElement for 'canvas'
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
            const canvas = {
                width: 0,
                height: 0,
                getContext: vi.fn().mockReturnValue(mockCtx),
                toDataURL: mockToDataURL,
            };
            return canvas as unknown as HTMLCanvasElement;
        }
        return origCreateElement(tag);
    });

    // Mock the global Image constructor
    capturedImageInstances = [];
    vi.stubGlobal('Image', class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        width = 800;
        height = 600;
        private _src = '';

        get src(): string {
            return this._src;
        }
        set src(val: string) {
            this._src = val;
            // Trigger onload asynchronously
            capturedImageInstances.push(this);
            setTimeout(() => {
                if (this.onload) this.onload();
            }, 0);
        }
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('image compression constants', () => {
    it('MAX_IMAGE_DIMENSION is 1024', () => {
        expect(MAX_IMAGE_DIMENSION).toBe(1024);
    });

    it('MAX_IMAGE_QUALITY is 0.7', () => {
        expect(MAX_IMAGE_QUALITY).toBe(0.7);
    });

    it('MAX_IMAGE_BYTES is 2 MB', () => {
        expect(MAX_IMAGE_BYTES).toBe(2 * 1024 * 1024);
    });

    it('SUPPORTED_IMAGE_REGEX matches jpeg, png, webp, gif, bmp', () => {
        expect(SUPPORTED_IMAGE_REGEX.test('data:image/jpeg;base64,abc')).toBe(true);
        expect(SUPPORTED_IMAGE_REGEX.test('data:image/png;base64,abc')).toBe(true);
        expect(SUPPORTED_IMAGE_REGEX.test('data:image/webp;base64,abc')).toBe(true);
        expect(SUPPORTED_IMAGE_REGEX.test('data:image/gif;base64,abc')).toBe(true);
        expect(SUPPORTED_IMAGE_REGEX.test('data:image/bmp;base64,abc')).toBe(true);
        expect(SUPPORTED_IMAGE_REGEX.test('data:text/plain;base64,abc')).toBe(false);
    });
});

// ============================================================================
// isValidImageFormat
// ============================================================================

describe('isValidImageFormat', () => {
    it('accepts data:image/jpeg', () => {
        expect(isValidImageFormat('data:image/jpeg;base64,/9j/4AAQSkZJRg')).toBe(true);
    });

    it('accepts data:image/png', () => {
        expect(isValidImageFormat('data:image/png;base64,iVBORw0KGgo')).toBe(true);
    });

    it('accepts data:image/webp', () => {
        expect(isValidImageFormat('data:image/webp;base64,UklGR')).toBe(true);
    });

    it('accepts data:image/gif', () => {
        expect(isValidImageFormat('data:image/gif;base64,R0lGODlh')).toBe(true);
    });

    it('accepts data:image/bmp', () => {
        expect(isValidImageFormat('data:image/bmp;base64,Qk0')).toBe(true);
    });

    it('rejects data:text/plain', () => {
        expect(isValidImageFormat('data:text/plain;base64,abc')).toBe(false);
    });

    it('rejects data:application/pdf', () => {
        expect(isValidImageFormat('data:application/pdf;base64,JVBERi0')).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isValidImageFormat('')).toBe(false);
    });

    it('rejects random text', () => {
        expect(isValidImageFormat('not a data uri at all')).toBe(false);
    });
});

// ============================================================================
// dataUriByteSize
// ============================================================================

describe('dataUriByteSize', () => {
    it('computes correct byte size for small payload', () => {
        // 4 base64 chars = 3 bytes
        const uri = 'data:image/jpeg;base64,AAAA';
        expect(dataUriByteSize(uri)).toBe(3);
    });

    it('handles padding with ==', () => {
        // "AA==" => 1 byte
        const uri = 'data:image/png;base64,AA==';
        expect(dataUriByteSize(uri)).toBe(1);
    });

    it('handles padding with single =', () => {
        // "AAA=" => 2 bytes
        const uri = 'data:image/png;base64,AAA=';
        expect(dataUriByteSize(uri)).toBe(2);
    });

    it('returns 0 for malformed URI without comma', () => {
        expect(dataUriByteSize('no-comma-here')).toBe(0);
    });
});

// ============================================================================
// compressImage
// ============================================================================

describe('compressImage', () => {
    it('resolves with a compressed data URI for a valid image', async () => {
        const input = 'data:image/png;base64,iVBORw0KGgo';
        const result = await compressImage(input);
        expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('calls canvas.toDataURL with jpeg and quality', async () => {
        const input = 'data:image/png;base64,iVBORw0KGgo';
        await compressImage(input, 1024, 0.7);
        expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.7);
    });

    it('scales down image when wider than maxDimension', async () => {
        // Override Image mock to simulate a 2048x1024 image
        vi.stubGlobal('Image', class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            width = 2048;
            height = 1024;
            private _src = '';
            get src(): string { return this._src; }
            set src(val: string) {
                this._src = val;
                setTimeout(() => { if (this.onload) this.onload(); }, 0);
            }
        });

        const input = 'data:image/png;base64,iVBORw0KGgo';
        await compressImage(input, 1024, 0.7);

        // The canvas should have been drawn at scaled dimensions
        expect(mockCtx.drawImage).toHaveBeenCalled();
        const call = (mockCtx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0];
        // drawImage(img, 0, 0, width, height)
        const drawnWidth = call[3] as number;
        const drawnHeight = call[4] as number;
        expect(drawnWidth).toBeLessThanOrEqual(1024);
        expect(drawnHeight).toBeLessThanOrEqual(1024);
        // Proportional: 2048->1024, 1024->512
        expect(drawnWidth).toBe(1024);
        expect(drawnHeight).toBe(512);
    });

    it('scales down image when taller than maxDimension', async () => {
        vi.stubGlobal('Image', class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            width = 600;
            height = 2000;
            private _src = '';
            get src(): string { return this._src; }
            set src(val: string) {
                this._src = val;
                setTimeout(() => { if (this.onload) this.onload(); }, 0);
            }
        });

        const input = 'data:image/jpeg;base64,/9j/4AAQ';
        await compressImage(input, 1024, 0.7);

        const call = (mockCtx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0];
        const drawnWidth = call[3] as number;
        const drawnHeight = call[4] as number;
        expect(drawnHeight).toBeLessThanOrEqual(1024);
        expect(drawnWidth).toBeLessThanOrEqual(1024);
        // 2000->1024, ratio=0.512, 600*0.512=307
        expect(drawnHeight).toBe(1024);
        expect(drawnWidth).toBe(Math.round(600 * (1024 / 2000)));
    });

    it('does not upscale small images', async () => {
        vi.stubGlobal('Image', class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            width = 200;
            height = 150;
            private _src = '';
            get src(): string { return this._src; }
            set src(val: string) {
                this._src = val;
                setTimeout(() => { if (this.onload) this.onload(); }, 0);
            }
        });

        const input = 'data:image/png;base64,iVBORw0KGgo';
        await compressImage(input, 1024, 0.7);

        const call = (mockCtx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0];
        const drawnWidth = call[3] as number;
        const drawnHeight = call[4] as number;
        expect(drawnWidth).toBe(200);
        expect(drawnHeight).toBe(150);
    });

    it('rejects when post-compression size exceeds MAX_IMAGE_BYTES', async () => {
        // Make toDataURL return a huge payload (>2MB)
        const hugePayload = 'A'.repeat(3 * 1024 * 1024); // ~2.25 MB decoded
        mockToDataURL.mockReturnValue('data:image/jpeg;base64,' + hugePayload);

        const input = 'data:image/png;base64,iVBORw0KGgo';
        await expect(compressImage(input)).rejects.toThrow('excede el limite de 2 MB');
    });

    it('rejects when image fails to load (onerror)', async () => {
        vi.stubGlobal('Image', class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            width = 0;
            height = 0;
            private _src = '';
            get src(): string { return this._src; }
            set src(val: string) {
                this._src = val;
                setTimeout(() => { if (this.onerror) this.onerror(); }, 0);
            }
        });

        const input = 'data:image/png;base64,INVALID';
        await expect(compressImage(input)).rejects.toThrow('No se pudo cargar la imagen');
    });

    it('rejects when canvas context is null', async () => {
        // Override createElement to return canvas with null context
        const origCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: vi.fn().mockReturnValue(null),
                    toDataURL: mockToDataURL,
                } as unknown as HTMLCanvasElement;
            }
            return origCreateElement(tag);
        });

        const input = 'data:image/png;base64,iVBORw0KGgo';
        await expect(compressImage(input)).rejects.toThrow('contexto 2D');
    });

    it('uses default parameters matching constants', async () => {
        const input = 'data:image/jpeg;base64,/9j/4AAQ';
        await compressImage(input);
        // Should use MAX_IMAGE_QUALITY = 0.7
        expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.7);
    });

    it('respects custom maxDimension and quality parameters', async () => {
        vi.stubGlobal('Image', class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            width = 1000;
            height = 1000;
            private _src = '';
            get src(): string { return this._src; }
            set src(val: string) {
                this._src = val;
                setTimeout(() => { if (this.onload) this.onload(); }, 0);
            }
        });

        const input = 'data:image/png;base64,iVBORw0KGgo';
        await compressImage(input, 512, 0.5);

        expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.5);
        const call = (mockCtx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(call[3]).toBe(512);
        expect(call[4]).toBe(512);
    });
});

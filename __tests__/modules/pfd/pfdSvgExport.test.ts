vi.mock('../../../utils/filenameSanitization', () => ({
    sanitizeFilename: vi.fn((name: string) => name.replace(/[^a-zA-Z0-9 _-]/g, '_')),
}));

vi.mock('../../../src/assets/ppe/ppeBase64', () => ({
    getLogoBase64: vi.fn().mockResolvedValue('data:image/png;base64,MOCK_LOGO_DATA'),
}));

import { buildPfdSvg, exportPfdSvg } from '../../../modules/pfd/pfdSvgExport';
import type { PfdDocument, PfdStep, PfdHeader } from '../../../modules/pfd/pfdTypes';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeHeader(overrides?: Partial<PfdHeader>): PfdHeader {
    return {
        partNumber: 'P-001',
        partName: 'Cubierta izquierda',
        engineeringChangeLevel: '',
        modelYear: '2026',
        documentNumber: 'DOC-100',
        revisionLevel: 'A',
        revisionDate: '2026-01-01',
        companyName: 'Barack Mercosul',
        plantLocation: 'Hurlingham',
        supplierCode: '',
        customerName: 'ACME Corp',
        coreTeam: '',
        keyContact: '',
        processPhase: 'production',
        preparedBy: 'Juan',
        preparedDate: '2026-01-01',
        approvedBy: 'Carlos',
        approvedDate: '2026-01-01',
        ...overrides,
    };
}

function makeStep(overrides?: Partial<PfdStep>): PfdStep {
    return {
        id: 'step-1',
        stepNumber: 'OP 10',
        stepType: 'operation',
        description: 'Inyeccion de cubierta',
        machineDeviceTool: '',
        productCharacteristic: '',
        productSpecialChar: 'none',
        processCharacteristic: '',
        processSpecialChar: 'none',
        reference: '',
        department: '',
        notes: '',
        isRework: false,
        isExternalProcess: false,
        reworkReturnStep: '',
        rejectDisposition: 'none',
        scrapDescription: '',
        branchId: '',
        branchLabel: '',
        ...overrides,
    };
}

function makeDoc(steps: PfdStep[] = [], headerOverrides?: Partial<PfdHeader>): PfdDocument {
    return {
        id: 'doc-1',
        header: makeHeader(headerOverrides),
        steps,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pfdSvgExport', () => {
    describe('buildPfdSvg', () => {
        it('should return SVG with "Sin pasos definidos" for empty document', () => {
            const doc = makeDoc([]);
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('Sin pasos definidos');
            expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('width="400"');
            expect(svg).toContain('height="200"');
        });

        it('should include DOCTYPE html and <html tag for non-empty documents', () => {
            const doc = makeDoc([makeStep()]);
            const html = buildPfdSvg(doc);

            expect(html).toMatch(/^<!DOCTYPE html>/);
            expect(html).toContain('<html');
        });

        it('should render a single step with step number and description', () => {
            const doc = makeDoc([
                makeStep({ stepNumber: 'OP 10', description: 'Corte de chapa' }),
            ]);
            const html = buildPfdSvg(doc);

            // The mapper extracts just the number from "OP 10"
            expect(html).toContain('10');
            expect(html).toContain('Corte de chapa');
        });

        it('should render step numbers for multiple steps', () => {
            const doc = makeDoc([
                makeStep({ id: 's1', stepNumber: 'OP 10', description: 'Corte' }),
                makeStep({ id: 's2', stepNumber: 'OP 20', description: 'Soldadura' }),
                makeStep({ id: 's3', stepNumber: 'OP 30', description: 'Pintura' }),
            ]);
            const html = buildPfdSvg(doc);

            expect(html).toContain('Corte');
            expect(html).toContain('Soldadura');
            expect(html).toContain('Pintura');
        });

        it('should render parallel branches with lane backgrounds and labels', () => {
            const doc = makeDoc([
                makeStep({ id: 's1', stepNumber: 'OP 10', description: 'Recepcion', branchId: '' }),
                makeStep({ id: 's2', stepNumber: 'OP 20', description: 'Soldadura', branchId: 'A', branchLabel: 'Linea ZAC' }),
                makeStep({ id: 's3', stepNumber: 'OP 30', description: 'Pintura', branchId: 'B', branchLabel: 'Linea Galvanizado' }),
                makeStep({ id: 's4', stepNumber: 'OP 40', description: 'Ensamble', branchId: '' }),
            ]);
            const html = buildPfdSvg(doc);

            // Branch structure renders with parallel lanes
            expect(html).toContain('min-w-[400px]');
            // Step descriptions appear
            expect(html).toContain('Soldadura');
            expect(html).toContain('Pintura');
        });

        it('should render CC label when productSpecialChar is CC', () => {
            const doc = makeDoc([
                makeStep({ productSpecialChar: 'CC' }),
            ]);
            const html = buildPfdSvg(doc);

            expect(html).toContain('CC');
        });

        it('should render SC label when processSpecialChar is SC', () => {
            const doc = makeDoc([
                makeStep({ processSpecialChar: 'SC' }),
            ]);
            const html = buildPfdSvg(doc);

            expect(html).toContain('SC');
        });

        it('should render both CC and SC labels when both are present', () => {
            const doc = makeDoc([
                makeStep({ productSpecialChar: 'CC', processSpecialChar: 'SC' }),
            ]);
            const html = buildPfdSvg(doc);

            expect(html).toContain('CC, SC');
        });

        it('should render legend with REFERENCIAS title and 5 step type labels', () => {
            const doc = makeDoc([makeStep()]);
            const html = buildPfdSvg(doc);

            expect(html).toContain('REFERENCIAS');
            const expectedLabels = [
                'OPERACION',
                'TRASLADO',
                'ALMACENADO',
                'INSPECCION',
                'CONDICION',
            ];
            for (const label of expectedLabels) {
                expect(html).toContain(label);
            }
        });

        it('should include document metadata in header', () => {
            const doc = makeDoc([makeStep()], {
                partName: 'Cubierta izquierda',
                partNumber: 'P-001',
                companyName: 'Barack Mercosul',
                customerName: 'ACME Corp',
                modelYear: '2026',
            });
            const html = buildPfdSvg(doc);

            expect(html).toContain('DIAGRAMA DE FLUJO DE PROCESO');
            expect(html).toContain('Cubierta izquierda');
            expect(html).toContain('Barack Mercosul');
            expect(html).toContain('ACME Corp');
            expect(html).toContain('2026');
        });

        it('should escape HTML special characters in descriptions', () => {
            const doc = makeDoc([
                makeStep({ description: '<script>alert("xss")</script>' }),
            ]);
            const html = buildPfdSvg(doc);

            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        it('should render step number inside the shape for an operation', () => {
            const doc = makeDoc([
                makeStep({ id: 's1', stepType: 'operation', stepNumber: 'OP 10' }),
            ]);
            const html = buildPfdSvg(doc);

            // Step number "10" (extracted from "OP 10") appears in output
            expect(html).toContain('>10<');
        });

        it('should render machine and department text', () => {
            const doc = makeDoc([
                makeStep({ machineDeviceTool: 'Prensa 200T', department: 'Estampado' }),
            ]);
            const html = buildPfdSvg(doc);

            expect(html).toContain('Prensa 200T');
            expect(html).toContain('Estampado');
        });

        it('should embed logo as <img> tag when logoBase64 is provided', () => {
            const doc = makeDoc([makeStep()]);
            const html = buildPfdSvg(doc, 'data:image/png;base64,TESTLOGO');

            expect(html).toContain('<img');
            expect(html).toContain('data:image/png;base64,TESTLOGO');
        });

        it('should show BARACK MERCOSUL text fallback when no logo provided', () => {
            const doc = makeDoc([makeStep()]);
            const html = buildPfdSvg(doc);

            expect(html).toContain('BARACK');
            expect(html).toContain('MERCOSUL');
        });

        it('should render document number in header', () => {
            const doc = makeDoc([makeStep()]);
            const html = buildPfdSvg(doc);

            expect(html).toContain('DOC-100');
            expect(html).toContain('Código del Documento');
        });

        it('should not contain SVG artifacts in non-empty HTML output', () => {
            const doc = makeDoc([makeStep()]);
            const html = buildPfdSvg(doc);

            // No SVG defs, no arrowMarker, no dropShadow
            expect(html).not.toContain('id="arrowMarker"');
            expect(html).not.toContain('id="dropShadow"');
            expect(html).not.toContain('feDropShadow');
        });

        it('should render decision node description', () => {
            const doc = makeDoc([
                makeStep({ stepType: 'decision', stepNumber: 'DEC 10', description: 'Aprobado?' }),
            ]);
            const html = buildPfdSvg(doc);

            expect(html).toContain('Aprobado?');
        });

        it('should render white background via inline style', () => {
            const doc = makeDoc([makeStep()]);
            const html = buildPfdSvg(doc);

            // Tailwind bg-white class or CSS body background
            expect(html).toContain('bg-white');
        });

        it('should produce a valid HTML document with DOCTYPE', () => {
            const doc = makeDoc([makeStep()]);
            const html = buildPfdSvg(doc);

            expect(html).toMatch(/^<!DOCTYPE html>/);
            expect(html).toContain('<html');
            expect(html).toContain('</html>');
        });
    });

    describe('exportPfdSvg', () => {
        let mockClick: ReturnType<typeof vi.fn>;
        let mockCreateObjectURL: ReturnType<typeof vi.fn>;
        let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
        let capturedHref: string;
        let capturedDownload: string;

        beforeEach(() => {
            vi.useFakeTimers();
            mockClick = vi.fn();
            mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
            mockRevokeObjectURL = vi.fn();
            capturedHref = '';
            capturedDownload = '';

            global.URL.createObjectURL = mockCreateObjectURL as (obj: Blob | MediaSource) => string;
            global.URL.revokeObjectURL = mockRevokeObjectURL as (url: string) => void;

            // Mock document.createElement for anchor + body append/remove
            vi.spyOn(document, 'createElement').mockImplementation(function (this: Document, tag: string) {
                if (tag === 'a') {
                    const link = {
                        click: mockClick,
                        style: {} as CSSStyleDeclaration,
                    } as any;
                    Object.defineProperty(link, 'href', {
                        get() { return capturedHref; },
                        set(v) { capturedHref = v; },
                        configurable: true,
                    });
                    Object.defineProperty(link, 'download', {
                        get() { return capturedDownload; },
                        set(v) { capturedDownload = v; },
                        configurable: true,
                    });
                    return link as HTMLAnchorElement;
                }
                return Document.prototype.createElement.call(this, tag);
            });
            vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
            vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
        });

        afterEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it('should create a Blob with HTML content and trigger download', async () => {
            const doc = makeDoc([makeStep()]);
            await exportPfdSvg(doc);

            // URL created from blob
            expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);

            // Link href set to blob URL
            expect(capturedHref).toBe('blob:mock-url');

            // Link click triggered
            expect(mockClick).toHaveBeenCalledTimes(1);

            // Appended to and removed from DOM
            expect(document.body.appendChild).toHaveBeenCalled();
            expect(document.body.removeChild).toHaveBeenCalled();

            // Filename includes PFD_ prefix and .html extension
            expect(capturedDownload).toMatch(/^PFD_.*\.html$/);
        });

        it('should revoke object URL after timeout', async () => {
            const doc = makeDoc([makeStep()]);
            await exportPfdSvg(doc);

            expect(mockRevokeObjectURL).not.toHaveBeenCalled();
            vi.advanceTimersByTime(5000);
            expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });

        it('should use partName in the filename', async () => {
            const doc = makeDoc([makeStep()], { partName: 'Cubierta' });
            await exportPfdSvg(doc);

            expect(capturedDownload).toContain('Cubierta');
        });

        it('should create blob with text/html MIME type', async () => {
            const doc = makeDoc([makeStep()]);
            await exportPfdSvg(doc);

            const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
            expect(blobArg).toBeInstanceOf(Blob);
            expect(blobArg.type).toBe('text/html;charset=utf-8');
        });
    });
});

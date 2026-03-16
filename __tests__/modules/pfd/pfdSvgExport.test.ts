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

        it('should include xml declaration and xmlns attribute', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
            expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
        });

        it('should render a single step with step number and description', () => {
            const doc = makeDoc([
                makeStep({ stepNumber: 'OP 10', description: 'Corte de chapa' }),
            ]);
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('OP 10');
            expect(svg).toContain('Corte de chapa');
            expect(svg).toContain('class="pfd-node"');
            expect(svg).toContain('data-step-number="OP 10"');
        });

        it('should render arrows between multiple steps', () => {
            const doc = makeDoc([
                makeStep({ id: 's1', stepNumber: 'OP 10', description: 'Corte' }),
                makeStep({ id: 's2', stepNumber: 'OP 20', description: 'Soldadura' }),
                makeStep({ id: 's3', stepNumber: 'OP 30', description: 'Pintura' }),
            ]);
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('OP 10');
            expect(svg).toContain('OP 20');
            expect(svg).toContain('OP 30');
            // Arrows between steps (monochrome dark #374151)
            expect(svg).toContain('class="pfd-arrow"');
            expect(svg).toContain('stroke="#374151"');
            // At least 2 arrows for 3 steps
            const arrowCount = (svg.match(/class="pfd-arrow"/g) || []).length;
            expect(arrowCount).toBe(2);
        });

        it('should render parallel branches with lane backgrounds and FLUJO PARALELO label', () => {
            const doc = makeDoc([
                makeStep({ id: 's1', stepNumber: 'OP 10', description: 'Recepcion', branchId: '', }),
                makeStep({ id: 's2', stepNumber: 'OP 20', description: 'Soldadura', branchId: 'A', branchLabel: 'Linea ZAC' }),
                makeStep({ id: 's3', stepNumber: 'OP 30', description: 'Pintura', branchId: 'B', branchLabel: 'Linea Galvanizado' }),
                makeStep({ id: 's4', stepNumber: 'OP 40', description: 'Ensamble', branchId: '' }),
            ]);
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('FLUJO PARALELO');
            expect(svg).toContain('CONVERGENCIA');
            // Fork/join visual elements
            expect(svg).toContain('class="pfd-fork"');
            expect(svg).toContain('class="pfd-join"');
            // Branch labels
            expect(svg).toContain('Linea ZAC');
            expect(svg).toContain('Linea Galvanizado');
            // Branch backgrounds (monochrome — same neutral gray for all branches)
            expect(svg).toContain('#F9FAFB'); // bg for branches
        });

        it('should render CC badge when productSpecialChar is CC', () => {
            const doc = makeDoc([
                makeStep({ productSpecialChar: 'CC' }),
            ]);
            const svg = buildPfdSvg(doc);

            // CC badge (monochrome — white bg, dark stroke, black text)
            expect(svg).toContain('>CC<');
        });

        it('should render SC badge when processSpecialChar is SC', () => {
            const doc = makeDoc([
                makeStep({ processSpecialChar: 'SC' }),
            ]);
            const svg = buildPfdSvg(doc);

            // SC badge (monochrome — white bg, dark stroke, black text)
            expect(svg).toContain('>SC<');
        });

        it('should render CC badge (not SC) when both product and process have special chars', () => {
            const doc = makeDoc([
                makeStep({ productSpecialChar: 'CC', processSpecialChar: 'SC' }),
            ]);
            const svg = buildPfdSvg(doc);

            // CC takes priority: hasCC = true means hasSC = false
            expect(svg).toContain('>CC<');
            expect(svg).not.toContain('>SC<');
        });

        it('should render EXT badge when isExternalProcess is true', () => {
            const doc = makeDoc([
                makeStep({ isExternalProcess: true }),
            ]);
            const svg = buildPfdSvg(doc);

            // EXT badge (monochrome — white bg, dark stroke, black text)
            expect(svg).toContain('>EXT<');
        });

        it('should render legend with all 7 step types', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('LEYENDA:');
            expect(svg).toContain('class="pfd-legend"');
            // All 7 step type labels from PFD_STEP_TYPES
            const expectedLabels = [
                'Operaci\u00F3n',
                'Transporte',
                'Inspecci\u00F3n',
                'Almacenamiento',
                'Demora / Espera',
                'Decisi\u00F3n',
                'Op. + Inspecci\u00F3n',
            ];
            for (const label of expectedLabels) {
                expect(svg).toContain(label);
            }
        });

        it('should include document metadata in header', () => {
            const doc = makeDoc([makeStep()], {
                partName: 'Cubierta izquierda',
                partNumber: 'P-001',
                companyName: 'Barack Mercosul',
                plantLocation: 'Hurlingham',
                customerName: 'ACME Corp',
                modelYear: '2026',
            });
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('DIAGRAMA DE FLUJO DEL PROCESO');
            expect(svg).toContain('Cubierta izquierda');
            expect(svg).toContain('P-001');
            expect(svg).toContain('Barack Mercosul');
            expect(svg).toContain('Hurlingham');
            expect(svg).toContain('ACME Corp');
            expect(svg).toContain('2026');
        });

        it('should escape HTML special characters in descriptions', () => {
            const doc = makeDoc([
                makeStep({ description: '<script>alert("xss")</script>' }),
            ]);
            const svg = buildPfdSvg(doc);

            expect(svg).not.toContain('<script>');
            expect(svg).toContain('&lt;script&gt;');
        });

        it('should render correct SVG symbol for each step type', () => {
            const doc = makeDoc([
                makeStep({ id: 's1', stepType: 'operation', stepNumber: 'OP 10' }),
            ]);
            const svg = buildPfdSvg(doc);

            // Operation uses <circle> with monochrome dark border
            expect(svg).toContain('<circle');
            expect(svg).toContain('#374151'); // DARK monochrome border
        });

        it('should render machine and department as sub-info line', () => {
            const doc = makeDoc([
                makeStep({ machineDeviceTool: 'Prensa 200T', department: 'Estampado' }),
            ]);
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('Prensa 200T');
            expect(svg).toContain('Estampado');
        });

        it('should embed logo when logoBase64 is provided', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc, 'data:image/png;base64,TESTLOGO');

            expect(svg).toContain('<image');
            expect(svg).toContain('data:image/png;base64,TESTLOGO');
            expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
        });

        it('should show text fallback when no logo provided', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            // No <image> element, instead shows BARACK text
            expect(svg).not.toContain('<image');
            expect(svg).toContain('BARACK');
            expect(svg).toContain('MERCOSUL');
        });

        it('should include xmlns:xlink for image support', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('xmlns:xlink');
        });

        it('should render SGC form number in header', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('I-AC-005.1-R01');
        });

        it('should include SVG defs with filters and markers', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            // Drop shadow filter
            expect(svg).toContain('id="dropShadow"');
            expect(svg).toContain('feDropShadow');
            // Arrow marker
            expect(svg).toContain('id="arrowMarker"');
        });

        it('should apply drop shadow and white fill to nodes', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            expect(svg).toContain('filter="url(#dropShadow)"');
            // Monochrome nodes use white fill (B/W printable, PPAP-ready)
            expect(svg).toContain('fill="white"');
        });

        it('should render bezier arrows with markers instead of polygons', () => {
            const doc = makeDoc([
                makeStep({ id: 's1' }),
                makeStep({ id: 's2' }),
            ]);
            const svg = buildPfdSvg(doc);

            // Arrow uses path with curve (C command)
            expect(svg).toContain('marker-end="url(#arrowMarker)"');
            const arrowPaths = svg.match(/<path d="M [^"]*C [^"]*"/g);
            expect(arrowPaths).toBeTruthy();
        });

        it('should render CC accent bar on CC steps', () => {
            const doc = makeDoc([
                makeStep({ productSpecialChar: 'CC' }),
            ]);
            const svg = buildPfdSvg(doc);

            // Black accent bar (3px wide, monochrome)
            expect(svg).toContain('width="3"');
            expect(svg).toContain('fill="#111827"');
        });

        it('should render decision nodes with shadow and thicker border', () => {
            const doc = makeDoc([
                makeStep({ stepType: 'decision', stepNumber: 'DEC 10', description: 'Aprobado?' }),
            ]);
            const svg = buildPfdSvg(doc);

            // Decision nodes use drop shadow
            expect(svg).toContain('filter="url(#dropShadow)"');
            // Decision nodes have thicker border (2.5px)
            expect(svg).toContain('stroke-width="2.5"');
        });

        it('should render clean white background', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            // Monochrome design: plain white background (B/W printable)
            expect(svg).toContain('fill="white"');
        });

        it('should use responsive width with viewBox for centering', () => {
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            // SVG uses width="100%" for responsive centering in browsers
            expect(svg).toContain('width="100%"');
            expect(svg).toContain('preserveAspectRatio="xMidYMin meet"');
            // viewBox contains the real canvas dimensions
            const viewBoxMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
            expect(viewBoxMatch).toBeTruthy();
            const canvasW = parseInt(viewBoxMatch![1], 10);
            // Canvas must be at least as wide as the legend (7 items × 135 + 75 = 1020) + 2×48 pad = 1116
            expect(canvasW).toBeGreaterThanOrEqual(1116);
        });

        it('should not let legend overflow canvas (startX must be >= 0)', () => {
            // Single-node doc (narrow content) — legend must still fit
            const doc = makeDoc([makeStep()]);
            const svg = buildPfdSvg(doc);

            // The LEYENDA text should be fully visible
            expect(svg).toContain('LEYENDA:');
            // Canvas dimensions are in viewBox
            const viewBoxMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
            expect(viewBoxMatch).toBeTruthy();
            // Verify no negative x coordinates on legend text
            const legendMatch = svg.match(/class="pfd-legend"[\s\S]*?<text x="([^"]+)"/);
            expect(legendMatch).toBeTruthy();
            const legendX = parseFloat(legendMatch![1]);
            expect(legendX).toBeGreaterThanOrEqual(0);
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

        it('should create a Blob with SVG content and trigger download', async () => {
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

            // Filename includes PFD_ prefix and .svg extension
            expect(capturedDownload).toMatch(/^PFD_.*\.svg$/);
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

        it('should fetch logo and embed it in SVG content', async () => {
            const doc = makeDoc([makeStep()]);
            await exportPfdSvg(doc);

            // The blob should contain SVG with the logo
            const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
            expect(blobArg).toBeInstanceOf(Blob);
            expect(blobArg.type).toBe('image/svg+xml;charset=utf-8');
        });
    });
});


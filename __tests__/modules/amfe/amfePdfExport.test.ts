import { describe, it, expect } from 'vitest';
import { getAmfePdfPreviewHtml } from '../../../modules/amfe/amfePdfExport';
import { AmfeDocument, ActionPriority, createEmptyCause } from '../../../modules/amfe/amfeTypes';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

function buildTestDoc(): AmfeDocument {
    const cause1 = { ...createEmptyCause(), cause: 'Electrodo desgastado', preventionControl: 'Cambio preventivo', detectionControl: 'Inspeccion visual', occurrence: 6, detection: 4, ap: ActionPriority.HIGH, preventionAction: 'Comprar electrodos', responsible: 'Juan', targetDate: '2026-03-01', status: 'Pendiente' };
    const cause2 = { ...createEmptyCause(), cause: 'Gas insuficiente', preventionControl: 'Sensor de flujo', detectionControl: 'Ensayo UT', occurrence: 3, detection: 5, ap: ActionPriority.MEDIUM };
    const cause3 = { ...createEmptyCause(), cause: 'Humedad ambiente', preventionControl: 'Control HVAC', detectionControl: 'Registro T/HR', occurrence: 2, detection: 2, ap: ActionPriority.LOW };

    return {
        header: {
            organization: 'Barack Mercosul',
            location: 'Planta 1',
            client: 'OEM Test',
            modelYear: '2026',
            subject: 'Test AMFE',
            startDate: '2026-01-15',
            revDate: '',
            team: 'Equipo A',
            amfeNumber: 'AMFE-001',
            responsible: 'Carlos',
            confidentiality: '',
            partNumber: 'P-1234',
            processResponsible: 'Maria',
            revision: 'Rev 2',
            approvedBy: 'Director',
            scope: 'Soldadura chasis',
            applicableParts: '',
        },
        operations: [{
            id: 'op1',
            opNumber: '10',
            name: 'Soldadura MIG',
            workElements: [{
                id: 'we1',
                type: 'Machine',
                name: 'Robot Soldadura',
                functions: [{
                    id: 'fn1',
                    description: 'Aplicar cordon segun spec',
                    requirements: 'ISO 3834',
                    failures: [{
                        id: 'fail1',
                        description: 'Cordon incompleto',
                        effectLocal: 'Retrabajo',
                        effectNextLevel: 'Reclamo cliente',
                        effectEndUser: 'Falla estructural',
                        severity: 9,
                        causes: [cause1, cause2],
                    }],
                }],
            }, {
                id: 'we2',
                type: 'Environment',
                name: 'Ambiente planta',
                functions: [{
                    id: 'fn2',
                    description: 'Mantener condiciones ambientales',
                    requirements: '',
                    failures: [{
                        id: 'fail2',
                        description: 'Porosidad por humedad',
                        effectLocal: 'Scrap',
                        effectNextLevel: 'Lote rechazado',
                        effectEndUser: 'Degradacion estetica',
                        severity: 5,
                        causes: [cause3],
                    }],
                }],
            }],
        }],
    };
}

function buildEmptyDoc(): AmfeDocument {
    return {
        header: {
            organization: '', location: '', client: '', modelYear: '',
            subject: '', startDate: '', revDate: '', team: '', amfeNumber: '',
            responsible: '', confidentiality: '', partNumber: '',
            processResponsible: '', revision: '', approvedBy: '', scope: '', applicableParts: '',
        },
        operations: [],
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('amfePdfExport', () => {
    describe('getAmfePdfPreviewHtml', () => {
        describe('full template', () => {
            it('contains the project title', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('Test AMFE');
            });

            it('contains header metadata', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('Barack Mercosul');
                expect(html).toContain('OEM Test');
                expect(html).toContain('P-1234');
                expect(html).toContain('Carlos');
                expect(html).toContain('AMFE-001');
                expect(html).toContain('Rev 2');
            });

            it('renders operation and work element rows', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('Soldadura MIG');
                expect(html).toContain('Robot Soldadura');
                expect(html).toContain('Ambiente planta');
            });

            it('renders failure and cause data', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('Cordon incompleto');
                expect(html).toContain('Electrodo desgastado');
                expect(html).toContain('Gas insuficiente');
                expect(html).toContain('Falla estructural');
            });

            it('renders AP colors for H/M/L', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('#DC2626'); // red for H
                expect(html).toContain('#FACC15'); // yellow for M
                expect(html).toContain('#16A34A'); // green for L
            });

            it('renders S/O/D values', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('>9<'); // severity
                expect(html).toContain('>6<'); // occurrence
                expect(html).toContain('>4<'); // detection
            });

            it('renders table headers', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('Modo de Falla');
                expect(html).toContain('Control Prev.');
                expect(html).toContain('Control Det.');
                expect(html).toContain('Acción Prev.');
            });

            it('handles empty document', () => {
                const doc = buildEmptyDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('Sin Título');
                expect(html).toContain('<table');
            });
        });

        describe('summary template', () => {
            it('only shows H and M priority causes', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'summary');
                expect(html).toContain('Electrodo desgastado'); // H
                expect(html).toContain('Gas insuficiente'); // M
                expect(html).not.toContain('Humedad ambiente'); // L — should be excluded
            });

            it('shows AP summary counts', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'summary');
                expect(html).toContain('AP Alto (H)');
                expect(html).toContain('AP Medio (M)');
                expect(html).toContain('AP Bajo (L)');
                expect(html).toContain('Total Causas');
            });

            it('shows "no hay causas" message for empty doc', () => {
                const doc = buildEmptyDoc();
                const html = getAmfePdfPreviewHtml(doc, 'summary');
                expect(html).toContain('No hay causas con AP Alto o Medio');
            });

            it('contains Resumen de Prioridades title', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'summary');
                expect(html).toContain('Resumen de Prioridades');
            });
        });

        describe('actionPlan template', () => {
            it('shows open actions only', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'actionPlan');
                expect(html).toContain('Comprar electrodos'); // has preventionAction + status=Pendiente
            });

            it('does not show causes without actions', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'actionPlan');
                // cause2 (Gas insuficiente) has no preventionAction or detectionAction
                expect(html).not.toContain('Gas insuficiente');
            });

            it('shows "no hay acciones" for empty doc', () => {
                const doc = buildEmptyDoc();
                const html = getAmfePdfPreviewHtml(doc, 'actionPlan');
                expect(html).toContain('No hay acciones abiertas');
            });

            it('contains Plan de Acciones title', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'actionPlan');
                expect(html).toContain('Plan de Acciones');
            });

            it('shows responsible and dates', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'actionPlan');
                expect(html).toContain('Juan');
                expect(html).toContain('2026-03-01');
                expect(html).toContain('Pendiente');
            });
        });

        describe('HTML safety', () => {
            it('escapes HTML special characters in data', () => {
                const doc = buildTestDoc();
                doc.header.organization = '<script>alert("xss")</script>';
                doc.header.subject = 'Test & "quotes"';
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).not.toContain('<script>');
                expect(html).toContain('&lt;script&gt;');
                expect(html).toContain('Test &amp; &quot;quotes&quot;');
            });
        });

        // ---------------------------------------------------------------
        // Round 5 D1: Empty cause rows show "Sin causas definidas"
        // ---------------------------------------------------------------
        describe('empty cause rows (Round 5)', () => {
            it('shows "Sin causas definidas" when failure has no causes', () => {
                const doc = buildTestDoc();
                // Remove all causes from first failure
                doc.operations[0].workElements[0].functions[0].failures[0].causes = [];
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('Sin causas definidas');
            });

            it('uses colspan for empty cause placeholder', () => {
                const doc = buildTestDoc();
                doc.operations[0].workElements[0].functions[0].failures[0].causes = [];
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('colspan="21"');
            });

            it('does not show placeholder when causes exist', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                // Doc has 3 causes across 2 failures, no empty ones
                expect(html).not.toContain('Sin causas definidas');
            });
        });

        // ---------------------------------------------------------------
        // Round 5 D2: Page break control
        // ---------------------------------------------------------------
        describe('page break control (Round 5)', () => {
            it('includes table-header-group for thead repeat', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('table-header-group');
            });

            it('includes page-break-inside on table', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('page-break-inside');
            });
        });

        // ---------------------------------------------------------------
        // Flat rows (no rowspan) for safe page breaks
        // ---------------------------------------------------------------
        describe('flat rows for safe page breaks', () => {
            it('full template has NO rowspan attributes (flat rows)', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).not.toContain('rowspan');
            });

            it('repeats operation number in every cause row', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                // Op 10 has 3 causes across 2 failures → 3 rows all with "10"
                const matches = html.match(/>10<\/td>/g);
                expect(matches?.length).toBe(3);
            });

            it('shows operation name only on first row of each operation', () => {
                const doc = buildTestDoc();
                const html = getAmfePdfPreviewHtml(doc, 'full');
                // "Soldadura MIG" should appear once (first row only)
                const nameMatches = html.match(/Soldadura MIG/g);
                expect(nameMatches?.length).toBe(1);
            });

            it('uses thick top border for visual operation grouping', () => {
                // Build doc with 2 operations to trigger the border on second op
                const doc = buildTestDoc();
                const cause = { ...createEmptyCause(), cause: 'Test' };
                doc.operations.push({
                    id: 'op2',
                    opNumber: '20',
                    name: 'Ensamble',
                    workElements: [{
                        id: 'we3', type: 'Man', name: 'Operador',
                        functions: [{
                            id: 'fn3', description: 'Ensamblar', requirements: '',
                            failures: [{
                                id: 'fail3', description: 'Mal ensamblado',
                                effectLocal: '', effectNextLevel: '', effectEndUser: '',
                                severity: 5, causes: [cause],
                            }],
                        }],
                    }],
                });
                const html = getAmfePdfPreviewHtml(doc, 'full');
                expect(html).toContain('border-top:2px solid #2563EB');
                expect(html).toContain('Ensamble');
            });

            it('handles large documents (many operations) without rowspan', () => {
                const doc = buildTestDoc();
                // Add 9 more operations (10 total) for multi-page scenario
                for (let i = 2; i <= 10; i++) {
                    const causes = Array.from({ length: 3 }, (_, j) => ({
                        ...createEmptyCause(),
                        cause: `Causa ${i}-${j + 1}`,
                        occurrence: 3,
                        detection: 4,
                        ap: j === 0 ? ActionPriority.HIGH : ActionPriority.LOW,
                    }));
                    doc.operations.push({
                        id: `op${i}`,
                        opNumber: String(i * 10),
                        name: `Operacion ${i}`,
                        workElements: [{
                            id: `we${i}`, type: 'Machine', name: `Maquina ${i}`,
                            functions: [{
                                id: `fn${i}`, description: `Funcion ${i}`, requirements: '',
                                failures: [{
                                    id: `fail${i}`, description: `Falla ${i}`,
                                    effectLocal: `Local ${i}`, effectNextLevel: `Next ${i}`,
                                    effectEndUser: `EndUser ${i}`, severity: 7,
                                    causes,
                                }],
                            }],
                        }],
                    });
                }

                const html = getAmfePdfPreviewHtml(doc, 'full');
                // No rowspan anywhere
                expect(html).not.toContain('rowspan');
                // All 10 operations present
                for (let i = 2; i <= 10; i++) {
                    expect(html).toContain(`Operacion ${i}`);
                }
                // Count total <tr> in tbody: 3 (original) + 9 ops × 3 causes = 30 rows
                const trCount = (html.match(/<tr/g) || []).length;
                expect(trCount).toBeGreaterThanOrEqual(30); // 30 data rows + 1 header row
                // Verify page-break-inside:auto on table
                expect(html).toContain('page-break-inside:auto');
            });
        });
    });
});

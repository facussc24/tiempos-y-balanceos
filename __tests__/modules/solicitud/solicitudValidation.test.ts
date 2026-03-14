import { validateSolicitud, hasErrors, type ValidationIssue } from '../../../modules/solicitud/solicitudValidation';
import { createEmptySolicitud } from '../../../modules/solicitud/solicitudTypes';
import type { SolicitudDocument } from '../../../modules/solicitud/solicitudTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validProducto(): SolicitudDocument {
    const doc = createEmptySolicitud('producto');
    doc.header.solicitante = 'Juan Perez';
    doc.header.areaDepartamento = 'Ingenieria';
    doc.producto = { codigo: 'ABC-123', descripcion: 'Tornillo M8', cliente: 'Toyota' };
    return doc;
}

function validInsumo(): SolicitudDocument {
    const doc = createEmptySolicitud('insumo');
    doc.header.solicitante = 'Maria Lopez';
    doc.header.areaDepartamento = 'Compras';
    doc.insumo = { codigo: 'INS-001', descripcion: 'Aceite SAE 20', unidadMedida: 'lt', requiereGeneracionInterna: false };
    return doc;
}

function fieldNames(issues: ValidationIssue[]): string[] {
    return issues.map(i => i.field);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('solicitudValidation', () => {
    describe('validateSolicitud — producto', () => {
        it('reports errors for empty producto solicitud', () => {
            const doc = createEmptySolicitud('producto');
            const issues = validateSolicitud(doc);
            const fields = fieldNames(issues);
            expect(fields).toContain('solicitante');
            expect(fields).toContain('areaDepartamento');
            expect(fields).toContain('codigo');
            expect(fields).toContain('descripcion');
            expect(fields).toContain('cliente');
            expect(issues.every(i => i.severity === 'error')).toBe(true);
        });

        it('returns no errors for a fully valid producto', () => {
            const issues = validateSolicitud(validProducto());
            const errors = issues.filter(i => i.severity === 'error');
            expect(errors).toHaveLength(0);
        });

        it('reports error when solicitante is missing', () => {
            const doc = validProducto();
            doc.header.solicitante = '';
            const issues = validateSolicitud(doc);
            expect(fieldNames(issues)).toContain('solicitante');
        });

        it('reports error when areaDepartamento is missing', () => {
            const doc = validProducto();
            doc.header.areaDepartamento = '  ';
            const issues = validateSolicitud(doc);
            expect(fieldNames(issues)).toContain('areaDepartamento');
        });

        it('reports error when producto codigo is missing', () => {
            const doc = validProducto();
            doc.producto!.codigo = '';
            const issues = validateSolicitud(doc);
            expect(fieldNames(issues)).toContain('codigo');
        });

        it('reports error when cliente is missing for producto', () => {
            const doc = validProducto();
            doc.producto!.cliente = '';
            const issues = validateSolicitud(doc);
            expect(fieldNames(issues)).toContain('cliente');
        });
    });

    describe('validateSolicitud — insumo', () => {
        it('reports errors for empty insumo solicitud', () => {
            const doc = createEmptySolicitud('insumo');
            const issues = validateSolicitud(doc);
            const fields = fieldNames(issues);
            expect(fields).toContain('solicitante');
            expect(fields).toContain('areaDepartamento');
            expect(fields).toContain('codigo');
            expect(fields).toContain('descripcion');
        });

        it('returns no errors for a fully valid insumo', () => {
            const issues = validateSolicitud(validInsumo());
            const errors = issues.filter(i => i.severity === 'error');
            expect(errors).toHaveLength(0);
        });

        it('reports error when insumo codigo is missing', () => {
            const doc = validInsumo();
            doc.insumo!.codigo = '';
            const issues = validateSolicitud(doc);
            expect(fieldNames(issues)).toContain('codigo');
        });

        it('produces warning when requiereGeneracionInterna is true', () => {
            const doc = validInsumo();
            doc.insumo!.requiereGeneracionInterna = true;
            const issues = validateSolicitud(doc);
            const warning = issues.find(i => i.field === 'requiereGeneracionInterna');
            expect(warning).toBeDefined();
            expect(warning!.severity).toBe('warning');
        });
    });

    describe('codigo length validation', () => {
        it('reports error when codigo exceeds 50 characters', () => {
            const doc = validProducto();
            doc.producto!.codigo = 'A'.repeat(51);
            const issues = validateSolicitud(doc);
            const lengthError = issues.find(
                i => i.field === 'codigo' && i.message.includes('50'),
            );
            expect(lengthError).toBeDefined();
            expect(lengthError!.severity).toBe('error');
        });
    });

    describe('hasErrors', () => {
        it('returns true when errors are present', () => {
            const issues: ValidationIssue[] = [
                { field: 'solicitante', message: 'obligatorio', severity: 'error' },
            ];
            expect(hasErrors(issues)).toBe(true);
        });

        it('returns false when only warnings are present', () => {
            const issues: ValidationIssue[] = [
                { field: 'requiereGeneracionInterna', message: 'warning msg', severity: 'warning' },
            ];
            expect(hasErrors(issues)).toBe(false);
        });

        it('returns false for empty issues array', () => {
            expect(hasErrors([])).toBe(false);
        });
    });
});

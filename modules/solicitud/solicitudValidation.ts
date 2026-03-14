/**
 * Solicitud Validation
 *
 * Validation rules for Solicitud de Generacion de Codigo documents.
 */

import type { SolicitudDocument } from './solicitudTypes';

export interface ValidationIssue {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

export function validateSolicitud(doc: SolicitudDocument): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Required common fields
    if (!doc.header.solicitante.trim()) issues.push({ field: 'solicitante', message: 'El solicitante es obligatorio', severity: 'error' });
    if (!doc.header.areaDepartamento.trim()) issues.push({ field: 'areaDepartamento', message: 'El area/departamento es obligatorio', severity: 'error' });

    if (doc.tipo === 'producto' && doc.producto) {
        if (!doc.producto.codigo.trim()) issues.push({ field: 'codigo', message: 'El codigo del producto es obligatorio', severity: 'error' });
        if (!doc.producto.descripcion.trim()) issues.push({ field: 'descripcion', message: 'La descripcion del producto es obligatoria', severity: 'error' });
        if (!doc.producto.cliente.trim()) issues.push({ field: 'cliente', message: 'El cliente es obligatorio para productos', severity: 'error' });
    }

    if (doc.tipo === 'insumo' && doc.insumo) {
        if (!doc.insumo.codigo.trim()) issues.push({ field: 'codigo', message: 'El codigo del insumo es obligatorio', severity: 'error' });
        if (!doc.insumo.descripcion.trim()) issues.push({ field: 'descripcion', message: 'La descripcion del insumo es obligatoria', severity: 'error' });
    }

    // Warnings
    if (doc.tipo === 'insumo' && doc.insumo?.requiereGeneracionInterna) {
        issues.push({ field: 'requiereGeneracionInterna', message: 'Se requiere generacion interna del codigo de proveedor', severity: 'warning' });
    }

    // Code length validation
    const codigo = doc.tipo === 'producto' ? doc.producto?.codigo : doc.insumo?.codigo;
    if (codigo && codigo.length > 50) {
        issues.push({ field: 'codigo', message: 'El codigo no debe superar 50 caracteres', severity: 'error' });
    }

    return issues;
}

/** Check if there are any errors (not just warnings) */
export function hasErrors(issues: ValidationIssue[]): boolean {
    return issues.some(i => i.severity === 'error');
}

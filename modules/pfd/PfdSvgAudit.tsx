/**
 * PFD SVG Audit — Visual audit page for all SVG export scenarios
 * TEMPORARY: Remove after audit is complete.
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { PfdDocument, PfdStep } from './pfdTypes';
import { createEmptyStep } from './pfdTypes';
import { buildPfdSvg } from './pfdSvgExport';

// ============================================================================
// Helper to create a full PfdDocument from partial data
// ============================================================================
function mkDoc(header: Partial<PfdDocument['header']>, steps: PfdStep[]): PfdDocument {
    return {
        id: 'audit-' + Math.random().toString(36).slice(2),
        header: {
            partNumber: header.partNumber || 'TEST-001',
            partName: header.partName || 'Pieza de prueba',
            engineeringChangeLevel: header.engineeringChangeLevel ?? '',
            modelYear: header.modelYear || '2025',
            documentNumber: header.documentNumber || 'PFD-TEST',
            revisionLevel: header.revisionLevel || 'A',
            revisionDate: header.revisionDate ?? '',
            companyName: header.companyName || 'Barack Mercosul',
            plantLocation: header.plantLocation || 'Hurlingham, BA',
            supplierCode: header.supplierCode || 'BM-001',
            customerName: header.customerName || 'Cliente Test',
            coreTeam: header.coreTeam || 'Equipo',
            keyContact: header.keyContact ?? '',
            processPhase: header.processPhase || 'production',
            preparedBy: header.preparedBy || 'Auditor',
            preparedDate: header.preparedDate ?? '',
            approvedBy: header.approvedBy || 'Aprobador',
            approvedDate: header.approvedDate ?? '',
            applicableParts: header.applicableParts,
            linkedAmfeId: header.linkedAmfeId,
            linkedCpId: header.linkedCpId,
        },
        steps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

function mkStep(overrides: Partial<PfdStep>): PfdStep {
    return { ...createEmptyStep(overrides.stepNumber || ''), ...overrides };
}

// ============================================================================
// Scenario 1: Minimal flow (2 steps)
// ============================================================================
function scenario1(): PfdDocument {
    return mkDoc(
        { partName: 'Pieza mínima', partNumber: 'MIN-001' },
        [
            mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción' }),
            mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Envío' }),
        ]
    );
}

// ============================================================================
// Scenario 2: Linear flow 8-10 steps, mixed characteristics
// ============================================================================
function scenario2(): PfdDocument {
    return mkDoc(
        { partName: 'Eje de transmisión', partNumber: 'EJE-100', linkedAmfeId: 'AMFE-EJE-01', linkedCpId: 'CP-EJE-01' },
        [
            mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción MP' }),
            mkStep({ stepNumber: 'OP 10', stepType: 'operation', description: 'Torneado CNC', machineDeviceTool: 'Torno CNC Mazak', productCharacteristic: 'Diámetro exterior', processCharacteristic: 'Velocidad de corte', department: 'Mecanizado', cycleTimeMinutes: 5 }),
            mkStep({ stepNumber: 'OP 20', stepType: 'operation', description: 'Fresado', machineDeviceTool: 'Centro mecanizado Haas', productCharacteristic: 'Ranura chavetero', department: 'Mecanizado', cycleTimeMinutes: 8 }),
            mkStep({ stepNumber: 'OP 30', stepType: 'inspection', description: 'Control dimensional', machineDeviceTool: 'CMM Zeiss', productCharacteristic: 'Cotas críticas', productSpecialChar: 'CC', processCharacteristic: 'Método de medición', processSpecialChar: 'SC', department: 'Calidad', cycleTimeMinutes: 3, linkedAmfeOperationId: 'AMFE-030', linkedCpItemIds: ['CP-030-01'] }),
            mkStep({ stepNumber: '', stepType: 'transport', description: 'Transporte a tratamiento térmico' }),
            mkStep({ stepNumber: 'OP 40', stepType: 'operation', description: 'Tratamiento térmico', machineDeviceTool: 'Horno continuo', processCharacteristic: 'Temperatura / Tiempo', processSpecialChar: 'CC', department: 'TT', cycleTimeMinutes: 45 }),
            mkStep({ stepNumber: 'OP 50', stepType: 'combined', description: 'Rectificado + inspección', machineDeviceTool: 'Rectificadora cilíndrica', productCharacteristic: 'Rugosidad superficial', productSpecialChar: 'SC', department: 'Mecanizado', cycleTimeMinutes: 6, linkedCpItemIds: ['CP-050-01'] }),
            mkStep({ stepNumber: 'OP 60', stepType: 'operation', description: 'Embalaje', department: 'Expedición' }),
            mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Almacenamiento y envío' }),
        ]
    );
}

// ============================================================================
// Scenario 3: Extremely long text
// ============================================================================
function scenario3(): PfdDocument {
    return mkDoc(
        {
            partName: 'Componente electromecánico de alta precisión para sistema de dirección asistida eléctrica',
            partNumber: 'CEHP-EPS-00123-REV-C',
            applicableParts: 'CEHP-EPS-00123, CEHP-EPS-00124, CEHP-EPS-00125, CEHP-EPS-00126 (variantes para modelos sedan, SUV, pickup y van del programa global)',
            engineeringChangeLevel: 'Rev. C — Actualización de tolerancia dimensional según ECN-2025-0847',
            keyContact: 'Ing. María Alejandra Fernández de los Santos Gutiérrez',
            coreTeam: 'Ing. Pérez, Ing. González, Tec. Rodríguez, Lic. Martínez, Tec. Sánchez',
        },
        [
            mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción e inspección entrante de materia prima según procedimiento de calidad aprobado' }),
            mkStep({
                stepNumber: 'OP 10', stepType: 'operation',
                description: 'Mecanizado CNC de carcasa principal del módulo electromecánico de dirección asistida eléctrica',
                machineDeviceTool: 'Centro de mecanizado 5 ejes Mazak Variaxis i-800 con pallet automático y medición en proceso',
                productCharacteristic: 'Diámetro interior de alojamiento del motor eléctrico ±0.005mm según plano ES-DRW-2025-0847',
                productSpecialChar: 'CC',
                processCharacteristic: 'Velocidad de husillo, avance programado, profundidad de corte y compensación de herramienta',
                processSpecialChar: 'CC',
                department: 'Mecanizado CNC',
                notes: 'Verificar compensación de herramienta cada 50 piezas. Registrar valores en planilla de seguimiento de proceso. Notificar a Calidad ante cualquier desviación mayor a 0.003mm del valor nominal.',
                cycleTimeMinutes: 12,
            }),
            mkStep({
                stepNumber: 'OP 20', stepType: 'inspection',
                description: 'Inspección dimensional completa en sala de metrología climatizada según plan de control',
                machineDeviceTool: 'Máquina de medición por coordenadas Zeiss PRISMO Ultra con cabezal rotativo VAST XXT',
                productCharacteristic: 'Todas las cotas del plano ES-DRW-2025-0847 Rev.C incluyendo GD&T (posición, cilindricidad, perpendicularidad)',
                productSpecialChar: 'CC',
                processCharacteristic: 'Programa CNC de medición verificado y validado con patrón certificado por laboratorio externo acreditado',
                processSpecialChar: 'SC',
                department: 'Metrología',
                notes: 'Realizar MSA (R&R) cada 6 meses. Última calibración de CMM: 2025-09-15. Próxima calibración programada: 2026-03-15.',
                cycleTimeMinutes: 8,
            }),
            mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Almacenamiento en área climatizada con control de temperatura y humedad según especificación del cliente' }),
        ]
    );
}

// ============================================================================
// Scenario 4: All disposition types
// ============================================================================
function scenario4(): PfdDocument {
    return mkDoc(
        { partName: 'Brida de acero', partNumber: 'BRI-200', linkedAmfeId: 'AMFE-BRI-01' },
        [
            mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción MP' }),
            mkStep({ stepNumber: 'OP 10', stepType: 'operation', description: 'Forjado', machineDeviceTool: 'Prensa 500T', department: 'Forja', cycleTimeMinutes: 4 }),
            mkStep({
                stepNumber: 'OP 20', stepType: 'inspection', description: 'Inspección visual',
                rejectDisposition: 'rework', reworkReturnStep: 'OP 10',
                productCharacteristic: 'Aspecto superficial', productSpecialChar: 'SC',
                machineDeviceTool: 'Lupa 10x', department: 'Calidad',
                linkedAmfeOperationId: 'AMFE-020', linkedCpItemIds: ['CP-020-01'],
            }),
            mkStep({ stepNumber: 'OP 30', stepType: 'operation', description: 'Mecanizado', machineDeviceTool: 'Torno CNC', department: 'Mecanizado', cycleTimeMinutes: 6 }),
            mkStep({
                stepNumber: 'OP 40', stepType: 'combined', description: 'Acabado + control',
                rejectDisposition: 'scrap', scrapDescription: 'Piezas con fisuras internas',
                productCharacteristic: 'Integridad estructural', productSpecialChar: 'CC',
                processCharacteristic: 'Parámetros ultrasonido', processSpecialChar: 'SC',
                machineDeviceTool: 'Equipo UT', department: 'Calidad',
            }),
            mkStep({
                stepNumber: 'OP 50', stepType: 'inspection', description: 'Inspección final dimensional',
                rejectDisposition: 'sort', scrapDescription: 'Seleccionar 100%',
                productCharacteristic: 'Cotas críticas', productSpecialChar: 'CC',
                machineDeviceTool: 'CMM', department: 'Calidad',
                notes: 'Frecuencia de muestreo según AQL Level II',
            }),
            mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Envío' }),
        ]
    );
}

// ============================================================================
// Scenario 5: Parallel flow with 3 branches
// ============================================================================
function scenario5(): PfdDocument {
    return mkDoc(
        { partName: 'Módulo de asiento', partNumber: 'MOD-ASI-300', linkedAmfeId: 'AMFE-ASI-01', linkedCpId: 'CP-ASI-01' },
        [
            mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción MP' }),
            mkStep({ stepNumber: 'OP 10', stepType: 'operation', description: 'Preparación de componentes', department: 'Logística' }),
            // Branch A
            mkStep({ stepNumber: 'OP 20', stepType: 'operation', description: 'Inyección espuma PU', branchId: 'A', branchLabel: 'Espuma', machineDeviceTool: 'Inyectora PU', productCharacteristic: 'Densidad', productSpecialChar: 'SC', processCharacteristic: 'Temperatura molde', processSpecialChar: 'CC', department: 'Inyección', linkedAmfeOperationId: 'AMFE-020', linkedCpItemIds: ['CP-020-01'] }),
            mkStep({ stepNumber: 'OP 25', stepType: 'delay', description: 'Curado espuma', branchId: 'A', branchLabel: 'Espuma', cycleTimeMinutes: 20 }),
            // Branch B
            mkStep({ stepNumber: 'OP 30', stepType: 'operation', description: 'Corte de tela', branchId: 'B', branchLabel: 'Tapizado', machineDeviceTool: 'Cortadora CNC', productCharacteristic: 'Dimensiones corte', department: 'Corte', cycleTimeMinutes: 3 }),
            mkStep({ stepNumber: 'OP 35', stepType: 'operation', description: 'Costura de funda', branchId: 'B', branchLabel: 'Tapizado', machineDeviceTool: 'Máquina costura', productCharacteristic: 'Resistencia costura', productSpecialChar: 'CC', processCharacteristic: 'Tensión hilo', processSpecialChar: 'SC', department: 'Costura', linkedAmfeOperationId: 'AMFE-035', linkedCpItemIds: ['CP-035-01', 'CP-035-02'] }),
            mkStep({ stepNumber: 'OP 38', stepType: 'inspection', description: 'Inspección costura', branchId: 'B', branchLabel: 'Tapizado', department: 'Calidad', rejectDisposition: 'rework', reworkReturnStep: 'OP 35' }),
            // Branch C
            mkStep({ stepNumber: 'OP 40', stepType: 'operation', description: 'Doblado estructura metálica', branchId: 'C', branchLabel: 'Estructura', machineDeviceTool: 'Dobladora CNC', productCharacteristic: 'Ángulo / longitud', productSpecialChar: 'CC', department: 'Metal', cycleTimeMinutes: 4 }),
            mkStep({ stepNumber: 'OP 45', stepType: 'combined', description: 'Soldadura + verificación', branchId: 'C', branchLabel: 'Estructura', machineDeviceTool: 'Soldadora MIG', processCharacteristic: 'Corriente / Velocidad', processSpecialChar: 'CC', department: 'Soldadura', cycleTimeMinutes: 5 }),
            // Convergence
            mkStep({ stepNumber: 'OP 50', stepType: 'operation', description: 'Ensamble módulo completo', machineDeviceTool: 'Dispositivo manual', department: 'Ensamble', cycleTimeMinutes: 8 }),
            mkStep({ stepNumber: 'OP 60', stepType: 'inspection', description: 'Inspección final', machineDeviceTool: 'Calibre / Torquímetro', productCharacteristic: 'Funcionalidad completa', productSpecialChar: 'CC', department: 'Calidad', linkedAmfeOperationId: 'AMFE-060', linkedCpItemIds: ['CP-060-01'] }),
            mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Envío al cliente' }),
        ]
    );
}

// ============================================================================
// Scenario 6: Parallel with unequal node heights
// ============================================================================
function scenario6(): PfdDocument {
    return mkDoc(
        { partName: 'Test alturas desiguales', partNumber: 'ALT-001' },
        [
            mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción' }),
            // Branch A - tall nodes (both characteristics)
            mkStep({ stepNumber: 'OP 10', stepType: 'operation', description: 'Operación compleja A1', branchId: 'A', branchLabel: 'Línea A (alta)', productCharacteristic: 'Caract. producto detallada', productSpecialChar: 'CC', processCharacteristic: 'Caract. proceso detallada', processSpecialChar: 'SC', machineDeviceTool: 'Máquina A', department: 'Sector A', cycleTimeMinutes: 10, linkedAmfeOperationId: 'AMFE-A1', linkedCpItemIds: ['CP-A1'] }),
            mkStep({ stepNumber: 'OP 15', stepType: 'inspection', description: 'Inspección completa A2', branchId: 'A', branchLabel: 'Línea A (alta)', productCharacteristic: 'Dimensional completo', productSpecialChar: 'SC', processCharacteristic: 'Método medición', machineDeviceTool: 'CMM', department: 'Calidad' }),
            // Branch B - short nodes (no characteristics)
            mkStep({ stepNumber: 'OP 20', stepType: 'operation', description: 'Op. simple B1', branchId: 'B', branchLabel: 'Línea B (baja)' }),
            mkStep({ stepNumber: 'OP 25', stepType: 'operation', description: 'Op. simple B2', branchId: 'B', branchLabel: 'Línea B (baja)' }),
            // Convergence
            mkStep({ stepNumber: 'OP 30', stepType: 'operation', description: 'Ensamble final', department: 'Ensamble' }),
            mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Envío' }),
        ]
    );
}

// ============================================================================
// Scenario 7: Many notes (10+ steps with notes)
// ============================================================================
function scenario7(): PfdDocument {
    const steps: PfdStep[] = [
        mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción', notes: 'Verificar certificado de calidad del proveedor' }),
    ];
    for (let i = 1; i <= 10; i++) {
        steps.push(mkStep({
            stepNumber: `OP ${i * 10}`,
            stepType: i % 3 === 0 ? 'inspection' : 'operation',
            description: `Paso ${i} del proceso`,
            machineDeviceTool: `Equipo ${i}`,
            department: `Sector ${String.fromCharCode(64 + (i % 4 + 1))}`,
            notes: `Nota del paso ${i}: Verificar condiciones de proceso. Registro obligatorio en bitácora de producción. Frecuencia: cada ${i * 5} piezas.`,
        }));
    }
    steps.push(mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Envío', notes: 'FIFO estricto — máximo 3 días de stock' }));
    return mkDoc({ partName: 'Test muchas notas', partNumber: 'NOT-001' }, steps);
}

// ============================================================================
// Scenario 8: Empty optional header fields
// ============================================================================
function scenario8(): PfdDocument {
    return mkDoc(
        {
            partName: 'Pieza básica',
            partNumber: 'BAS-001',
            engineeringChangeLevel: '',
            revisionDate: '',
            keyContact: '',
            applicableParts: '',
            preparedDate: '',
            approvedDate: '',
            linkedAmfeId: undefined,
            linkedCpId: undefined,
        },
        [
            mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción' }),
            mkStep({ stepNumber: 'OP 10', stepType: 'operation', description: 'Operación principal' }),
            mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Envío' }),
        ]
    );
}

// ============================================================================
// Scenario 9: Decision node with characteristics
// ============================================================================
function scenario9(): PfdDocument {
    return mkDoc(
        { partName: 'Test decisión con caract.', partNumber: 'DEC-001' },
        [
            mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción' }),
            mkStep({ stepNumber: 'OP 10', stepType: 'operation', description: 'Preparación', machineDeviceTool: 'Mesa de trabajo' }),
            mkStep({
                stepNumber: 'OP 20', stepType: 'decision',
                description: 'Clasificación por nivel de calidad',
                productCharacteristic: 'Nivel de defectos visuales según catálogo',
                productSpecialChar: 'SC',
                processCharacteristic: 'Criterio de clasificación según norma interna',
                processSpecialChar: 'none',
                department: 'Calidad',
                notes: 'Usar catálogo de defectos versión 2025',
            }),
            mkStep({ stepNumber: 'OP 30', stepType: 'operation', description: 'Procesamiento', department: 'Producción' }),
            mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Envío' }),
        ]
    );
}

// ============================================================================
// Scenario 10: Stress test 25+ steps
// ============================================================================
function scenario10(): PfdDocument {
    const steps: PfdStep[] = [
        mkStep({ stepNumber: 'REC', stepType: 'storage', description: 'Recepción e inspección de materia prima', department: 'Almacén', notes: 'Acero, aluminio, plásticos técnicos, tornillería', machineDeviceTool: 'Balanza / Calibre' }),
        mkStep({ stepNumber: '', stepType: 'transport', description: 'Transporte a producción', department: 'Logística' }),
        mkStep({ stepNumber: 'OP 10', stepType: 'operation', description: 'Corte de chapa', machineDeviceTool: 'Cizalla CNC', department: 'Corte', cycleTimeMinutes: 2, productCharacteristic: 'Dimensiones', processCharacteristic: 'Fuerza de corte' }),
        mkStep({ stepNumber: 'OP 20', stepType: 'operation', description: 'Estampado', machineDeviceTool: 'Prensa 300T', department: 'Estampado', cycleTimeMinutes: 3, productCharacteristic: 'Forma geométrica', productSpecialChar: 'SC', processCharacteristic: 'Presión / Velocidad', processSpecialChar: 'CC' }),
        mkStep({ stepNumber: 'OP 30', stepType: 'inspection', description: 'Control dimensional estampado', machineDeviceTool: 'CMM', department: 'Calidad', rejectDisposition: 'rework', reworkReturnStep: 'OP 20', productCharacteristic: 'Cotas estampado', productSpecialChar: 'CC', notes: 'Muestreo cada 100 piezas', linkedAmfeOperationId: 'AMFE-030', linkedCpItemIds: ['CP-030'] }),
        mkStep({ stepNumber: '', stepType: 'transport', description: 'Transporte a soldadura' }),
        // Parallel: Branch A - Soldadura, Branch B - Mecanizado, Branch C - Tratamiento superficial
        mkStep({ stepNumber: 'OP 40', stepType: 'operation', description: 'Soldadura MIG componente A', branchId: 'A', branchLabel: 'Soldadura', machineDeviceTool: 'Robot soldadura Fanuc', department: 'Soldadura', cycleTimeMinutes: 5, productCharacteristic: 'Penetración cordón', productSpecialChar: 'CC', processCharacteristic: 'Corriente / Velocidad hilo', processSpecialChar: 'CC', linkedAmfeOperationId: 'AMFE-040' }),
        mkStep({ stepNumber: 'OP 45', stepType: 'combined', description: 'Inspección soldadura + retoque', branchId: 'A', branchLabel: 'Soldadura', machineDeviceTool: 'Equipo rx portátil', department: 'Calidad', rejectDisposition: 'scrap', productCharacteristic: 'Integridad soldadura', productSpecialChar: 'CC' }),
        mkStep({ stepNumber: 'OP 50', stepType: 'operation', description: 'Mecanizado CNC', branchId: 'B', branchLabel: 'Mecanizado', machineDeviceTool: 'Centro mecanizado Haas', department: 'CNC', cycleTimeMinutes: 8, productCharacteristic: 'Tolerancias', productSpecialChar: 'SC', processCharacteristic: 'RPM / Avance', processSpecialChar: 'SC' }),
        mkStep({ stepNumber: 'OP 55', stepType: 'inspection', description: 'Control dimensional CNC', branchId: 'B', branchLabel: 'Mecanizado', machineDeviceTool: 'Calibre pasa/no-pasa', department: 'Calidad', rejectDisposition: 'sort', linkedCpItemIds: ['CP-055'] }),
        mkStep({ stepNumber: 'OP 60', stepType: 'operation', description: 'Zincado electrolítico', branchId: 'C', branchLabel: 'Superficie', machineDeviceTool: 'Línea galvánica', department: 'TT Superficial', cycleTimeMinutes: 30, processCharacteristic: 'Espesor capa / Tiempo inmersión', processSpecialChar: 'SC', isExternalProcess: true }),
        mkStep({ stepNumber: 'OP 65', stepType: 'delay', description: 'Secado y curado', branchId: 'C', branchLabel: 'Superficie', department: 'TT Superficial', cycleTimeMinutes: 60, notes: 'Mínimo 60 min a temperatura ambiente' }),
        // Convergence
        mkStep({ stepNumber: 'OP 70', stepType: 'operation', description: 'Subensamble A+B', machineDeviceTool: 'Dispositivo de ensamble', department: 'Ensamble', cycleTimeMinutes: 6, productCharacteristic: 'Ajuste correcto' }),
        mkStep({ stepNumber: 'OP 75', stepType: 'operation', description: 'Ensamble final A+B+C', machineDeviceTool: 'Atornilladora automática', department: 'Ensamble', cycleTimeMinutes: 8, productCharacteristic: 'Torque de apriete', productSpecialChar: 'CC', processCharacteristic: 'Par torquímetro', processSpecialChar: 'CC', linkedAmfeOperationId: 'AMFE-075', linkedCpItemIds: ['CP-075-01', 'CP-075-02'] }),
        mkStep({ stepNumber: 'OP 80', stepType: 'decision', description: 'Clasificación por modelo', department: 'Ensamble', notes: 'Separar por destino: Modelo A / Modelo B / Exportación' }),
        mkStep({ stepNumber: 'OP 85', stepType: 'inspection', description: 'Inspección funcional', machineDeviceTool: 'Banco de pruebas funcional', department: 'Calidad', productCharacteristic: 'Funcionalidad completa, hermeticidad, ruido', productSpecialChar: 'CC', processCharacteristic: 'Parámetros de ensayo', notes: 'Ensayo al 100% de la producción', cycleTimeMinutes: 4, linkedAmfeOperationId: 'AMFE-085', linkedCpItemIds: ['CP-085-01', 'CP-085-02', 'CP-085-03'] }),
        mkStep({ stepNumber: 'OP 90', stepType: 'inspection', description: 'Inspección final y liberación', machineDeviceTool: 'Calibre / Torquímetro', department: 'Calidad', rejectDisposition: 'sort', productCharacteristic: 'Dimensiones generales', productSpecialChar: 'SC', notes: 'Según plan de control vigente' }),
        mkStep({ stepNumber: '', stepType: 'transport', description: 'Transporte a embalaje', department: 'Expedición' }),
        mkStep({ stepNumber: 'OP 100', stepType: 'operation', description: 'Embalaje e identificación', machineDeviceTool: 'Embaladora / Etiquetadora', department: 'Expedición', cycleTimeMinutes: 3 }),
        mkStep({ stepNumber: 'OP 105', stepType: 'operation', description: 'Paletizado', machineDeviceTool: 'Apilador eléctrico', department: 'Expedición', notes: 'Máximo 4 capas por pallet' }),
        mkStep({ stepNumber: 'ENV', stepType: 'storage', description: 'Almacenamiento producto terminado', department: 'Expedición', notes: 'FIFO — máximo 5 días stock' }),
        mkStep({ stepNumber: 'DESP', stepType: 'transport', description: 'Despacho al cliente', department: 'Expedición' }),
    ];
    return mkDoc({
        partName: 'Conjunto de soporte motor',
        partNumber: 'CSM-500',
        linkedAmfeId: 'AMFE-CSM-500 Rev.C',
        linkedCpId: 'CP-CSM-500 Rev.C',
        engineeringChangeLevel: 'Rev. C',
        keyContact: 'Ing. Martínez',
        applicableParts: 'CSM-500, CSM-501, CSM-502',
        preparedDate: '2025-10-01',
        approvedDate: '2025-11-15',
        revisionDate: '2025-11-20',
    }, steps);
}

// ============================================================================
// Scenarios map
// ============================================================================
const SCENARIOS: { id: string; label: string; description: string; build: () => PfdDocument }[] = [
    { id: '1', label: 'Flujo mínimo (2 pasos)', description: 'Solo REC → ENV. Sin características, sin notas, sin linked docs.', build: scenario1 },
    { id: '2', label: 'Flujo lineal (9 pasos)', description: 'Mezcla de pasos con/sin características. Transport incluido.', build: scenario2 },
    { id: '3', label: 'Texto largo', description: 'Descripciones, características y header con texto muy largo.', build: scenario3 },
    { id: '4', label: 'Disposiciones', description: 'Rework, scrap, sort. Flechas de retrabajo.', build: scenario4 },
    { id: '5', label: '3 branches', description: 'Flujo paralelo con 3 ramas + convergencia.', build: scenario5 },
    { id: '6', label: 'Alturas desiguales', description: 'Branch A con nodos altos, Branch B con nodos bajos.', build: scenario6 },
    { id: '7', label: 'Muchas notas (12 pasos)', description: '10+ pasos con notas. Sección NOTAS grande.', build: scenario7 },
    { id: '8', label: 'Header vacío', description: 'Sin campos opcionales del header.', build: scenario8 },
    { id: '9', label: 'Decisión con caract.', description: 'Nodo decision con productCharacteristic y processCharacteristic.', build: scenario9 },
    { id: '10', label: 'Stress test (22 pasos)', description: '22+ pasos, branches, disposiciones, todo.', build: scenario10 },
];

// ============================================================================
// Component
// ============================================================================
const PfdSvgAudit: React.FC = () => {
    const [selectedId, setSelectedId] = useState('1');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const svgContent = useMemo(() => {
        const scenario = SCENARIOS.find(s => s.id === selectedId);
        if (!scenario) return '';
        const doc = scenario.build();
        return buildPfdSvg(doc, '');
    }, [selectedId]);

    const blobUrl = useMemo(() => {
        if (!svgContent) return '';
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        return URL.createObjectURL(blob);
    }, [svgContent]);

    const handleSelect = useCallback((id: string) => {
        setSelectedId(id);
    }, []);

    return (
        <div className="min-h-full bg-gray-100">
            {/* Top bar */}
            <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-4 sticky top-0 z-50">
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">AUDIT</span>
                <span className="text-sm font-medium">PFD SVG Export — Auditoría Visual</span>
                <span className="text-xs text-gray-400 ml-auto">Escenario actual: {selectedId}</span>
            </div>

            {/* Scenario selector */}
            <div className="bg-white border-b p-3 flex flex-wrap gap-2 sticky top-[44px] z-40">
                {SCENARIOS.map(s => (
                    <button
                        key={s.id}
                        onClick={() => handleSelect(s.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                            selectedId === s.id
                                ? 'bg-blue-600 text-white border-blue-700'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                        title={s.description}
                    >
                        {s.id}. {s.label}
                    </button>
                ))}
            </div>

            {/* Description */}
            <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
                <span className="text-xs text-yellow-800">
                    {SCENARIOS.find(s => s.id === selectedId)?.description}
                </span>
            </div>

            {/* SVG render */}
            <div className="p-4">
                <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                    <iframe
                        ref={iframeRef}
                        src={blobUrl}
                        className="w-full border-0"
                        style={{ minHeight: '800px', height: '100vh' }}
                        title="SVG Preview"
                    />
                </div>
            </div>
        </div>
    );
};

export default PfdSvgAudit;

/**
 * Patagonia Inserto — Manual Control Plan Items
 *
 * 9 items that don't auto-generate from AMFE:
 * - Op 10:  Material identification (7 materials)
 * - Op 100: Temperature check, Machine parameters
 * - Op 105: Refilado vs pieza patrón
 * - Op 110: ASPECTO CC, COSTURA CC
 * - Op 120: 8 pcs/caja, apilado 3x3, etiqueta
 *
 * Source: HO PDF (I-IN-002.4-R01) and seed scripts.
 */

import { v4 as uuidv4 } from 'uuid';
import { ControlPlanItem } from './controlPlanTypes';

/**
 * Returns the 9 manual CP items for INSERTO PATAGONIA.
 * These are appended to the auto-generated CP items from the AMFE.
 */
export function getPatagoniaManualCpItems(): ControlPlanItem[] {
    return [
        // ── Op 10: Material identification ──────────────────────────────
        {
            id: uuidv4(),
            processStepNumber: '10',
            processDescription: 'RECEPCIONAR MATERIA PRIMA',
            machineDeviceTool: 'Planilla de recepción / Documentación',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Identificación correcta de cada material recibido (7 materiales)',
            specialCharClass: 'SC',
            specification: 'Cada material verificado contra planilla: código, lote, color, fecha',
            evaluationTechnique: 'Visual / Documentación',
            sampleSize: '100%',
            sampleFrequency: 'Cada recepción',
            controlMethod: 'Verificación visual y documental contra planilla de recepción',
            reactionPlan: 'Rechazar material no conforme. Identificar como "En espera". Notificar a Calidad.',
            reactionPlanOwner: 'Operador de Producción / Calidad',
            amfeAp: 'M',
            amfeSeverity: 8,
            operationCategory: 'recepcion',
        },
        // ── Op 100: Temperature ─────────────────────────────────────────
        {
            id: uuidv4(),
            processStepNumber: '100',
            processDescription: 'Tapizado - Tapizado semiautomático',
            machineDeviceTool: 'Termómetro infrarrojo',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Temperatura de vinilo y sustrato dentro de rango operativo',
            specialCharClass: 'SC',
            specification: 'Rango de temperatura según set-up de proceso',
            evaluationTechnique: 'Termómetro infrarrojo',
            sampleSize: '1 medición',
            sampleFrequency: 'Cada 2 horas',
            controlMethod: 'Medición y registro en planilla de set-up',
            reactionPlan: 'Detener proceso. Verificar temperatura de máquina. Ajustar parámetros. Reiniciar producción tras OK.',
            reactionPlanOwner: 'Calidad / Líder de Producción',
            amfeAp: 'M',
            amfeSeverity: 8,
            operationCategory: 'tapizado',
        },
        // ── Op 100: Machine parameters ──────────────────────────────────
        {
            id: uuidv4(),
            processStepNumber: '100',
            processDescription: 'Tapizado - Tapizado semiautomático',
            machineDeviceTool: 'Timer / Display de máquina',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Parámetros de máquina (tiempos de ciclo) conformes a set-up',
            specialCharClass: 'SC',
            specification: 'Tiempos de ciclo según planilla de set-up',
            evaluationTechnique: 'Timer / Display de máquina',
            sampleSize: '1 verificación',
            sampleFrequency: 'Inicio de turno',
            controlMethod: 'Lectura de display y registro en planilla de set-up',
            reactionPlan: 'No iniciar producción hasta corregir parámetros. Notificar a Mantenimiento.',
            reactionPlanOwner: 'Operador de Producción / Mantenimiento',
            amfeAp: 'H',
            amfeSeverity: 8,
            operationCategory: 'tapizado',
        },
        // ── Op 105: Refilado ────────────────────────────────────────────
        {
            id: uuidv4(),
            processStepNumber: '105',
            processDescription: 'REFILADO POST-TAPIZADO',
            machineDeviceTool: 'Mesa de refilado / Cutter / Pieza patrón',
            characteristicNumber: '',
            productCharacteristic: 'Refilado conforme a pieza patrón',
            processCharacteristic: '',
            specialCharClass: 'SC',
            specification: 'Bordes refilados conformes a pieza patrón, sin material sobrante ni corte excesivo',
            evaluationTechnique: 'Comparación visual contra pieza patrón',
            sampleSize: '1 pieza',
            sampleFrequency: 'Inicio de turno / cambio de lote',
            controlMethod: '',
            reactionPlan: 'Contener piezas del lote. Verificar cutter. Refilar nuevamente si es recuperable.',
            reactionPlanOwner: 'Operador de Producción / Líder',
            amfeAp: 'H',
            amfeSeverity: 8,
            operationCategory: 'refilado',
        },
        // ── Op 110: ASPECTO CC ──────────────────────────────────────────
        {
            id: uuidv4(),
            processStepNumber: '110',
            processDescription: 'Inspección Final - CONTROL FINAL DE CALIDAD',
            machineDeviceTool: 'Puesto de inspección',
            characteristicNumber: '',
            productCharacteristic: 'ASPECTO: Sin manchas, roturas, despegues ni deformaciones',
            processCharacteristic: '',
            specialCharClass: 'CC',
            specification: 'Sin defectos visuales de aspecto según criterio de aceptación',
            evaluationTechnique: 'Inspección visual 100%',
            sampleSize: '100%',
            sampleFrequency: 'Cada pieza',
            controlMethod: '',
            reactionPlan: 'Segregar pieza NC. Contener lote. Notificar a Supervisor de Calidad.',
            reactionPlanOwner: 'Control de Calidad (CC)',
            amfeAp: 'H',
            amfeSeverity: 9,
            operationCategory: 'inspeccion',
        },
        // ── Op 110: COSTURA CC ──────────────────────────────────────────
        {
            id: uuidv4(),
            processStepNumber: '110',
            processDescription: 'Inspección Final - CONTROL FINAL DE CALIDAD',
            machineDeviceTool: 'Puesto de inspección',
            characteristicNumber: '',
            productCharacteristic: 'COSTURA: Continua, sin saltos ni hilos sueltos',
            processCharacteristic: '',
            specialCharClass: 'CC',
            specification: 'Costura conforme a imagen de referencia, sin saltos, roturas ni hilos sueltos',
            evaluationTechnique: 'Inspección visual 100%',
            sampleSize: '100%',
            sampleFrequency: 'Cada pieza',
            controlMethod: '',
            reactionPlan: 'Segregar pieza NC. Contener lote. Notificar a Supervisor de Calidad.',
            reactionPlanOwner: 'Control de Calidad (CC)',
            amfeAp: 'H',
            amfeSeverity: 9,
            operationCategory: 'inspeccion',
        },
        // ── Op 120: 8 piezas por caja ───────────────────────────────────
        {
            id: uuidv4(),
            processStepNumber: '120',
            processDescription: 'Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
            machineDeviceTool: 'Caja 496mm x 634mm x 170mm',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Cantidad correcta: 8 piezas por caja',
            specialCharClass: '',
            specification: '8 unidades por caja',
            evaluationTechnique: 'Conteo visual',
            sampleSize: '100%',
            sampleFrequency: 'Cada caja',
            controlMethod: 'Conteo visual antes de cerrar caja',
            reactionPlan: 'Reabrir caja. Contar y ajustar cantidad. Registrar desvío.',
            reactionPlanOwner: 'Operador de Producción',
            amfeAp: 'M',
            amfeSeverity: 4,
            operationCategory: 'embalaje',
        },
        // ── Op 120: Apilado 3x3 ────────────────────────────────────────
        {
            id: uuidv4(),
            processStepNumber: '120',
            processDescription: 'Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
            machineDeviceTool: 'Pallet',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Apilado correcto: 3 cajas/piso, máx. 3 pisos',
            specialCharClass: '',
            specification: '3 cajas por piso, máximo 3 pisos (72 piezas por pallet)',
            evaluationTechnique: 'Visual',
            sampleSize: '100%',
            sampleFrequency: 'Cada pallet',
            controlMethod: 'Verificación visual del apilado',
            reactionPlan: 'Rearmar pallet. Verificar integridad de piezas.',
            reactionPlanOwner: 'Operador de Producción',
            amfeAp: 'M',
            amfeSeverity: 7,
            operationCategory: 'embalaje',
        },
        // ── Op 120: Etiqueta ────────────────────────────────────────────
        {
            id: uuidv4(),
            processStepNumber: '120',
            processDescription: 'Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
            machineDeviceTool: 'Etiquetadora / Manual',
            characteristicNumber: '',
            productCharacteristic: 'Etiqueta de producto terminado presente y correcta',
            processCharacteristic: '',
            specialCharClass: '',
            specification: 'Etiqueta con código de producto, lote, fecha y cantidad correctos',
            evaluationTechnique: 'Visual',
            sampleSize: '100%',
            sampleFrequency: 'Cada caja',
            controlMethod: 'Verificación visual de etiqueta contra OP',
            reactionPlan: 'Corregir etiqueta. Verificar trazabilidad.',
            reactionPlanOwner: 'Operador de Producción',
            amfeAp: 'M',
            amfeSeverity: 4,
            operationCategory: 'embalaje',
        },
    ];
}

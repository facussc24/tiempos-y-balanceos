/**
 * Control Plan Quick Templates
 *
 * Predefined CP item sets for common manufacturing processes.
 * Each template generates an array of ControlPlanItem with fresh UUIDs,
 * pre-filled control methods, sampling, and evaluation techniques
 * based on AIAG CP 2024 best practices.
 *
 * Mirrors the 6 process categories from amfeTemplates.ts.
 */

import { v4 as uuidv4 } from 'uuid';
import { ControlPlanItem } from './controlPlanTypes';

/** Template metadata for UI display. */
export interface CpTemplate {
    id: string;
    name: string;
    description: string;
    icon: string; // emoji
    category: 'fabrication' | 'assembly' | 'finishing' | 'inspection';
    /** Factory: creates fresh CP items with new UUIDs each call. */
    create: () => ControlPlanItem[];
}

// --- Helper ---

function mkItem(overrides: Partial<ControlPlanItem> & { processDescription: string }): ControlPlanItem {
    return {
        processStepNumber: '',
        processDescription: overrides.processDescription,
        machineDeviceTool: '',
        characteristicNumber: '',
        productCharacteristic: '',
        processCharacteristic: '',
        specialCharClass: '',
        specification: '',
        evaluationTechnique: '',
        sampleSize: '',
        sampleFrequency: '',
        controlMethod: '',
        reactionPlan: '',
        reactionPlanOwner: '',
        ...overrides,
        id: uuidv4(), // always fresh
    };
}

// ============================================================================
// TEMPLATES
// ============================================================================

export const CP_TEMPLATES: CpTemplate[] = [
    {
        id: 'tapizado',
        name: 'Tapizado Automotriz',
        description: 'Items para tapizado: corte, costura CNC, adhesivado, conformado, control final',
        icon: '🪑',
        category: 'assembly',
        create: () => [
            mkItem({
                processStepNumber: '20',
                processDescription: 'Corte de Componentes',
                machineDeviceTool: 'Mesa de corte',
                processCharacteristic: 'Dimensiones de corte',
                controlMethod: 'Control con Mylar post-corte',
                evaluationTechnique: 'Mylar / plantilla de control',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada lote',
                reactionPlan: 'Segregar lote. Verificar cuchilla y plantilla. Recontrol 100%.',
            }),
            mkItem({
                processStepNumber: '50',
                processDescription: 'Costura en Máquina CNC',
                machineDeviceTool: 'Máquina CNC doble aguja',
                processCharacteristic: 'Tensión de hilo',
                specialCharClass: 'CC',
                controlMethod: 'Verificación de tensión con tensiómetro + sensor automático',
                evaluationTechnique: 'Tensiómetro calibrado',
                sampleSize: '100%',
                sampleFrequency: 'Continuo (sensor) + manual inicio turno',
                reactionPlan: 'Detener costura. Ajustar tensión. Reinspeccionar últimas 10 piezas.',
            }),
            mkItem({
                processStepNumber: '50',
                processDescription: 'Costura en Máquina CNC',
                machineDeviceTool: 'Máquina CNC doble aguja',
                productCharacteristic: 'Integridad de puntada (sin saltos)',
                specialCharClass: 'CC',
                controlMethod: 'Inspección visual 100% post-costura',
                evaluationTechnique: 'Patrón visual de referencia',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                reactionPlan: 'Segregar pieza. Verificar aguja y tensión. Si recurrente, detener y recalibrar.',
            }),
            mkItem({
                processStepNumber: '50',
                processDescription: 'Costura en Máquina CNC',
                productCharacteristic: 'Contaminación metálica (fragmento de aguja)',
                specialCharClass: 'CC',
                controlMethod: 'Detector de metales 100%',
                evaluationTechnique: 'Detector de metales en línea',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                reactionPlan: 'Scrap de pieza. Protocolo de aguja rota: conteo de fragmentos, inspección lote.',
            }),
            mkItem({
                processStepNumber: '90',
                processDescription: 'Adhesivado',
                processCharacteristic: 'Cobertura de adhesivo en zona de unión',
                specialCharClass: 'SC',
                controlMethod: 'Inspección visual de cobertura + test de pelado manual',
                evaluationTechnique: 'Inspección visual / test de tracción manual',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                reactionPlan: 'Reproceso (OP 103). Si falla test de pelado: segregar y escalar a calidad.',
            }),
            mkItem({
                processStepNumber: '100',
                processDescription: 'Tapizado Semiautomático',
                productCharacteristic: 'Ausencia de arrugas en tapizado',
                controlMethod: 'Inspección visual 100% post-tapizado',
                evaluationTechnique: 'Patrón visual aprobado / muestra límite',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                reactionPlan: 'Retrabajo de conformado. Si recurrente, verificar parámetros de máquina.',
            }),
            mkItem({
                processStepNumber: '100',
                processDescription: 'Tapizado Semiautomático',
                processCharacteristic: 'Alineación de costura con referencias',
                controlMethod: 'Verificación visual de simetría y alineación',
                evaluationTechnique: 'Marcas de referencia en funda y espuma',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
            }),
            mkItem({
                processStepNumber: '110',
                processDescription: 'Control Final de Calidad',
                productCharacteristic: 'Conformidad visual, dimensional y funcional',
                specialCharClass: 'SC',
                controlMethod: 'Inspección según pauta de control final',
                evaluationTechnique: 'Pauta de inspección + muestras patrón',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                reactionPlan: 'Segregar producto. Clasificar defecto. Pieza irrecuperable → scrap (OP 111).',
            }),
        ],
    },
    {
        id: 'soldadura',
        name: 'Soldadura',
        description: 'Items para soldadura: corriente, gas, posicion, aspecto, penetracion',
        icon: '🔥',
        category: 'fabrication',
        create: () => [
            mkItem({
                processDescription: 'Soldadura',
                processCharacteristic: 'Corriente de soldadura',
                specification: '',
                controlMethod: 'Monitoreo parametros maquina',
                evaluationTechnique: 'Display maquina soldadora',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Soldadura',
                processCharacteristic: 'Flujo de gas protector',
                controlMethod: 'Caudalimetro con alarma',
                evaluationTechnique: 'Caudalimetro',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Soldadura',
                processCharacteristic: 'Posicion de pieza en fixture',
                controlMethod: 'Poka-Yoke de posicionamiento',
                evaluationTechnique: 'Sensor presencia',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
            }),
            mkItem({
                processDescription: 'Soldadura',
                productCharacteristic: 'Aspecto visual del cordon',
                controlMethod: 'Inspeccion visual por operador',
                evaluationTechnique: 'Patron visual de referencia',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada hora',
                reactionPlan: 'Segregar piezas sospechosas. Ajustar parametros.',
            }),
            mkItem({
                processDescription: 'Soldadura',
                productCharacteristic: 'Penetración del cordón',
                controlMethod: 'Ensayo destructivo periódico',
                evaluationTechnique: 'Corte metalográfico',
                sampleSize: '1 pieza',
                sampleFrequency: 'Inicio turno',
                reactionPlan: 'Detener producción. Verificar últimas piezas. Recalificar proceso.',
            }),
        ],
    },
    {
        id: 'ensamble',
        name: 'Ensamble',
        description: 'Items para ensamble: torque, presión, secuencia, ajuste, dimensional',
        icon: '🔧',
        category: 'assembly',
        create: () => [
            mkItem({
                processDescription: 'Ensamble',
                processCharacteristic: 'Torque de apriete',
                controlMethod: 'Torquímetro electrónico con registro',
                evaluationTechnique: 'Torquímetro calibrado',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                reactionPlan: 'Retrabajar apriete. Verificar calibración herramienta.',
            }),
            mkItem({
                processDescription: 'Ensamble',
                processCharacteristic: 'Presión de prensado',
                controlMethod: 'Monitoreo presión con límites',
                evaluationTechnique: 'Manómetro/Transductor',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Ensamble',
                processCharacteristic: 'Secuencia de montaje',
                controlMethod: 'Poka-Yoke de secuencia',
                evaluationTechnique: 'Sistema de verificación',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
            }),
            mkItem({
                processDescription: 'Ensamble',
                productCharacteristic: 'Ajuste entre componentes',
                controlMethod: 'Galga pasa/no-pasa',
                evaluationTechnique: 'Galga calibrada',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada hora',
            }),
            mkItem({
                processDescription: 'Ensamble',
                productCharacteristic: 'Verificación dimensional final',
                controlMethod: 'Medición dimensional',
                evaluationTechnique: 'Calibre/CMM',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada turno',
                reactionPlan: 'Contener producto. Verificar últimas N piezas.',
            }),
        ],
    },
    {
        id: 'pintura',
        name: 'Pintura',
        description: 'Items para pintura: espesor, adherencia, color, curado, limpieza',
        icon: '🎨',
        category: 'finishing',
        create: () => [
            mkItem({
                processDescription: 'Pintura',
                productCharacteristic: 'Espesor de capa',
                controlMethod: 'Medición espesor por turno',
                evaluationTechnique: 'Medidor espesor película',
                sampleSize: '3 piezas',
                sampleFrequency: 'Cada hora',
                reactionPlan: 'Ajustar boquilla/presión. Reinspeccionar último lote.',
            }),
            mkItem({
                processDescription: 'Pintura',
                productCharacteristic: 'Adherencia de pintura',
                controlMethod: 'Ensayo cross-hatch periódico',
                evaluationTechnique: 'Kit cross-hatch ASTM D3359',
                sampleSize: '1 pieza',
                sampleFrequency: 'Inicio turno',
                reactionPlan: 'Verificar pretratamiento. Detener hasta corrección.',
            }),
            mkItem({
                processDescription: 'Pintura',
                productCharacteristic: 'Color / apariencia',
                controlMethod: 'Inspección visual contra patrón',
                evaluationTechnique: 'Patrón color aprobado',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada lote',
            }),
            mkItem({
                processDescription: 'Pintura',
                processCharacteristic: 'Temperatura horno curado',
                controlMethod: 'Monitoreo temperatura horno',
                evaluationTechnique: 'Termopar / Registrador',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Pintura',
                processCharacteristic: 'Limpieza superficial previa',
                controlMethod: 'Verificación limpieza con test de agua',
                evaluationTechnique: 'Test rotura película agua',
                sampleSize: '3 piezas',
                sampleFrequency: 'Inicio turno',
            }),
        ],
    },
    {
        id: 'mecanizado',
        name: 'Mecanizado CNC',
        description: 'Items para CNC: dimensión crítica, rugosidad, velocidad, herramienta',
        icon: '⚙️',
        category: 'fabrication',
        create: () => [
            mkItem({
                processDescription: 'Mecanizado CNC',
                productCharacteristic: 'Dimensión crítica',
                controlMethod: 'SPC en dimensión crítica',
                evaluationTechnique: 'Calibre / CMM',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada hora',
                reactionPlan: 'Ajustar offset. Verificar últimas piezas. Revalidar con CMM.',
            }),
            mkItem({
                processDescription: 'Mecanizado CNC',
                productCharacteristic: 'Rugosidad superficial',
                controlMethod: 'Medición rugosidad periódica',
                evaluationTechnique: 'Rugosímetro',
                sampleSize: '1 pieza',
                sampleFrequency: 'Cada 50 piezas',
            }),
            mkItem({
                processDescription: 'Mecanizado CNC',
                processCharacteristic: 'Velocidad de corte / avance',
                controlMethod: 'Verificación parámetros CNC',
                evaluationTechnique: 'Display CNC / programa',
                sampleSize: '100%',
                sampleFrequency: 'Cada setup',
            }),
            mkItem({
                processDescription: 'Mecanizado CNC',
                processCharacteristic: 'Desgaste de herramienta',
                controlMethod: 'Cambio preventivo por vida útil',
                evaluationTechnique: 'Contador piezas / inspección visual',
                sampleSize: '100%',
                sampleFrequency: 'Según tabla vida herramienta',
                reactionPlan: 'Cambiar herramienta. Verificar últimas 5 piezas.',
            }),
        ],
    },
    {
        id: 'inyeccion',
        name: 'Inyección Plástica',
        description: 'Items para inyección: peso, temperatura, presión, ciclo, rebabas',
        icon: '🏭',
        category: 'fabrication',
        create: () => [
            mkItem({
                processDescription: 'Inyección Plástica',
                productCharacteristic: 'Peso de pieza',
                controlMethod: 'Pesaje estadístico',
                evaluationTechnique: 'Balanza de precisión',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada hora',
                reactionPlan: 'Ajustar dosificación. Segregar piezas fuera de rango.',
            }),
            mkItem({
                processDescription: 'Inyección Plástica',
                processCharacteristic: 'Temperatura masa / barril',
                controlMethod: 'Monitoreo temperatura continuo',
                evaluationTechnique: 'Termopar máquina',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Inyección Plástica',
                processCharacteristic: 'Presión de inyección / compactación',
                controlMethod: 'Monitoreo presión con límites',
                evaluationTechnique: 'Transductor presión',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Inyección Plástica',
                processCharacteristic: 'Tiempo de ciclo',
                controlMethod: 'Alarma por desviación de ciclo',
                evaluationTechnique: 'Timer máquina',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Inyección Plástica',
                productCharacteristic: 'Rebabas / línea de partición',
                controlMethod: 'Inspección visual 100%',
                evaluationTechnique: 'Patrón visual',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                reactionPlan: 'Rebarbado manual. Verificar estado del molde.',
            }),
        ],
    },
    {
        id: 'inspeccion',
        name: 'Inspección Final',
        description: 'Items para inspección: dimensional, visual, funcional, certificado',
        icon: '🔍',
        category: 'inspection',
        create: () => [
            mkItem({
                processDescription: 'Inspección Final',
                productCharacteristic: 'Verificación dimensional',
                controlMethod: 'Medición según pauta de inspección',
                evaluationTechnique: 'Calibre / CMM',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada lote',
                reactionPlan: 'Contener lote. Reinspección 100% si falla.',
            }),
            mkItem({
                processDescription: 'Inspección Final',
                productCharacteristic: 'Inspección visual / aspecto',
                controlMethod: 'Inspección visual contra patrón',
                evaluationTechnique: 'Patrón visual aprobado',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
            }),
            mkItem({
                processDescription: 'Inspección Final',
                productCharacteristic: 'Ensayo funcional',
                controlMethod: 'Test funcional según especificación',
                evaluationTechnique: 'Banco de ensayo',
                sampleSize: '1 pieza',
                sampleFrequency: 'Cada lote',
                reactionPlan: 'Segregar lote. Escalar a ingeniería de calidad.',
            }),
            mkItem({
                processDescription: 'Inspección Final',
                productCharacteristic: 'Certificado de material',
                controlMethod: 'Verificación certificado vs orden compra',
                evaluationTechnique: 'Revisión documental',
                sampleSize: '100%',
                sampleFrequency: 'Cada recepción',
                reactionPlan: 'Rechazar lote. Solicitar reposición con certificado conforme.',
            }),
        ],
    },
];

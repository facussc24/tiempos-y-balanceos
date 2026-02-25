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
                productCharacteristic: 'Penetracion del cordon',
                controlMethod: 'Ensayo destructivo periodico',
                evaluationTechnique: 'Corte metalografico',
                sampleSize: '1 pieza',
                sampleFrequency: 'Inicio turno',
                reactionPlan: 'Detener produccion. Verificar ultimas piezas. Recalificar proceso.',
            }),
        ],
    },
    {
        id: 'ensamble',
        name: 'Ensamble',
        description: 'Items para ensamble: torque, presion, secuencia, ajuste, dimensional',
        icon: '🔧',
        category: 'assembly',
        create: () => [
            mkItem({
                processDescription: 'Ensamble',
                processCharacteristic: 'Torque de apriete',
                controlMethod: 'Torquimetro electronico con registro',
                evaluationTechnique: 'Torquimetro calibrado',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                reactionPlan: 'Retrabajar apriete. Verificar calibracion herramienta.',
            }),
            mkItem({
                processDescription: 'Ensamble',
                processCharacteristic: 'Presion de prensado',
                controlMethod: 'Monitoreo presion con limites',
                evaluationTechnique: 'Manometro/Transductor',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Ensamble',
                processCharacteristic: 'Secuencia de montaje',
                controlMethod: 'Poka-Yoke de secuencia',
                evaluationTechnique: 'Sistema de verificacion',
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
                productCharacteristic: 'Verificacion dimensional final',
                controlMethod: 'Medicion dimensional',
                evaluationTechnique: 'Calibre/CMM',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada turno',
                reactionPlan: 'Contener producto. Verificar ultimas N piezas.',
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
                controlMethod: 'Medicion espesor por turno',
                evaluationTechnique: 'Medidor espesor pelicula',
                sampleSize: '3 piezas',
                sampleFrequency: 'Cada hora',
                reactionPlan: 'Ajustar boquilla/presion. Reinspeccionar ultimo lote.',
            }),
            mkItem({
                processDescription: 'Pintura',
                productCharacteristic: 'Adherencia de pintura',
                controlMethod: 'Ensayo cross-hatch periodico',
                evaluationTechnique: 'Kit cross-hatch ASTM D3359',
                sampleSize: '1 pieza',
                sampleFrequency: 'Inicio turno',
                reactionPlan: 'Verificar pretratamiento. Detener hasta correccion.',
            }),
            mkItem({
                processDescription: 'Pintura',
                productCharacteristic: 'Color / apariencia',
                controlMethod: 'Inspeccion visual contra patron',
                evaluationTechnique: 'Patron color aprobado',
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
                controlMethod: 'Verificacion limpieza con test de agua',
                evaluationTechnique: 'Test rotura pelicula agua',
                sampleSize: '3 piezas',
                sampleFrequency: 'Inicio turno',
            }),
        ],
    },
    {
        id: 'mecanizado',
        name: 'Mecanizado CNC',
        description: 'Items para CNC: dimension critica, rugosidad, velocidad, herramienta',
        icon: '⚙️',
        category: 'fabrication',
        create: () => [
            mkItem({
                processDescription: 'Mecanizado CNC',
                productCharacteristic: 'Dimension critica',
                controlMethod: 'SPC en dimension critica',
                evaluationTechnique: 'Calibre / CMM',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada hora',
                reactionPlan: 'Ajustar offset. Verificar ultimas piezas. Revalidar con CMM.',
            }),
            mkItem({
                processDescription: 'Mecanizado CNC',
                productCharacteristic: 'Rugosidad superficial',
                controlMethod: 'Medicion rugosidad periodica',
                evaluationTechnique: 'Rugosimetro',
                sampleSize: '1 pieza',
                sampleFrequency: 'Cada 50 piezas',
            }),
            mkItem({
                processDescription: 'Mecanizado CNC',
                processCharacteristic: 'Velocidad de corte / avance',
                controlMethod: 'Verificacion parametros CNC',
                evaluationTechnique: 'Display CNC / programa',
                sampleSize: '100%',
                sampleFrequency: 'Cada setup',
            }),
            mkItem({
                processDescription: 'Mecanizado CNC',
                processCharacteristic: 'Desgaste de herramienta',
                controlMethod: 'Cambio preventivo por vida util',
                evaluationTechnique: 'Contador piezas / inspeccion visual',
                sampleSize: '100%',
                sampleFrequency: 'Segun tabla vida herramienta',
                reactionPlan: 'Cambiar herramienta. Verificar ultimas 5 piezas.',
            }),
        ],
    },
    {
        id: 'inyeccion',
        name: 'Inyeccion Plastica',
        description: 'Items para inyeccion: peso, temperatura, presion, ciclo, rebabas',
        icon: '🏭',
        category: 'fabrication',
        create: () => [
            mkItem({
                processDescription: 'Inyeccion Plastica',
                productCharacteristic: 'Peso de pieza',
                controlMethod: 'Pesaje estadistico',
                evaluationTechnique: 'Balanza de precision',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada hora',
                reactionPlan: 'Ajustar dosificacion. Segregar piezas fuera de rango.',
            }),
            mkItem({
                processDescription: 'Inyeccion Plastica',
                processCharacteristic: 'Temperatura masa / barril',
                controlMethod: 'Monitoreo temperatura continuo',
                evaluationTechnique: 'Termopar maquina',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Inyeccion Plastica',
                processCharacteristic: 'Presion de inyeccion / compactacion',
                controlMethod: 'Monitoreo presion con limites',
                evaluationTechnique: 'Transductor presion',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Inyeccion Plastica',
                processCharacteristic: 'Tiempo de ciclo',
                controlMethod: 'Alarma por desviacion de ciclo',
                evaluationTechnique: 'Timer maquina',
                sampleSize: '100%',
                sampleFrequency: 'Continuo',
            }),
            mkItem({
                processDescription: 'Inyeccion Plastica',
                productCharacteristic: 'Rebabas / linea de particion',
                controlMethod: 'Inspeccion visual 100%',
                evaluationTechnique: 'Patron visual',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
                reactionPlan: 'Rebarbado manual. Verificar estado del molde.',
            }),
        ],
    },
    {
        id: 'inspeccion',
        name: 'Inspeccion Final',
        description: 'Items para inspeccion: dimensional, visual, funcional, certificado',
        icon: '🔍',
        category: 'inspection',
        create: () => [
            mkItem({
                processDescription: 'Inspeccion Final',
                productCharacteristic: 'Verificacion dimensional',
                controlMethod: 'Medicion segun pauta de inspeccion',
                evaluationTechnique: 'Calibre / CMM',
                sampleSize: '5 piezas',
                sampleFrequency: 'Cada lote',
                reactionPlan: 'Contener lote. Reinspeccion 100% si falla.',
            }),
            mkItem({
                processDescription: 'Inspeccion Final',
                productCharacteristic: 'Inspeccion visual / aspecto',
                controlMethod: 'Inspeccion visual contra patron',
                evaluationTechnique: 'Patron visual aprobado',
                sampleSize: '100%',
                sampleFrequency: 'Cada pieza',
            }),
            mkItem({
                processDescription: 'Inspeccion Final',
                productCharacteristic: 'Ensayo funcional',
                controlMethod: 'Test funcional segun especificacion',
                evaluationTechnique: 'Banco de ensayo',
                sampleSize: '1 pieza',
                sampleFrequency: 'Cada lote',
                reactionPlan: 'Segregar lote. Escalar a ingenieria de calidad.',
            }),
            mkItem({
                processDescription: 'Inspeccion Final',
                productCharacteristic: 'Certificado de material',
                controlMethod: 'Verificacion certificado vs orden compra',
                evaluationTechnique: 'Revision documental',
                sampleSize: '100%',
                sampleFrequency: 'Cada recepcion',
                reactionPlan: 'Rechazar lote. Solicitar reposicion con certificado conforme.',
            }),
        ],
    },
];

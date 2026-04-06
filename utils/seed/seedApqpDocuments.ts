/**
 * APQP Document Seed Script
 *
 * Creates PRELIMINARY PFD, AMFE, CP, and HO documents for 5 products.
 * Run once from browser console: window.__seedApqp()
 *
 * Products:
 * 1. Telas Planas PWA
 * 2. Telas Termoformadas PWA
 * 3. Armrest Door Panel Patagonia (VWA)
 * 4. Insert Patagonia (VWA)
 * 5. Top Roll Patagonia (VWA)
 */

import type {
    AmfeOperation, AmfeWorkElement, AmfeFunction,
    AmfeFailure, AmfeCause, WorkElementType, AmfeHeaderData,
} from '../../modules/amfe/amfeTypes';
import type {
    ControlPlanDocument, ControlPlanItem, ControlPlanHeader,
} from '../../modules/controlPlan/controlPlanTypes';
import type {
    PfdDocument, PfdStep, PfdStepType, PfdHeader,
} from '../../modules/pfd/pfdTypes';
import type {
    HoDocument, HojaOperacion, PpeItem, HoDocumentHeader,
} from '../../modules/hojaOperaciones/hojaOperacionesTypes';
import { DEFAULT_REACTION_PLAN_TEXT } from '../../modules/hojaOperaciones/hojaOperacionesTypes';
import { saveAmfeDocument } from '../repositories/amfeRepository';
import { saveCpDocument } from '../repositories/cpRepository';
import { savePfdDocument } from '../repositories/pfdRepository';
import { saveHoDocument } from '../repositories/hoRepository';
import { getDatabase } from '../database';

// ============================================================================
// HELPERS — compact factories
// ============================================================================

// Seeded PRNG for deterministic UUIDs — all preview contexts generate identical data
class SeededRng {
    private s: number;
    constructor(seed: number) { this.s = seed; }
    next(): number { this.s = (this.s * 1664525 + 1013904223) & 0x7fffffff; return this.s / 0x7fffffff; }
    uuid(): string {
        const h = () => Math.floor(this.next() * 0x10000).toString(16).padStart(4, '0');
        return `${h()}${h()}-${h()}-4${h().slice(1)}-${(8 + Math.floor(this.next() * 4)).toString(16)}${h().slice(1)}-${h()}${h()}${h()}`;
    }
}
let _rng = new SeededRng(20260314);
const uid = () => _rng.uuid();

function mkCause(cause: string, pc: string, dc: string): AmfeCause {
    return {
        id: uid(), cause,
        preventionControl: pc, detectionControl: dc,
        occurrence: '', detection: '', ap: '',
        characteristicNumber: '', specialChar: '', filterCode: '',
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: '',
    };
}

function mkFail(desc: string, eL: string, eN: string, eE: string, causes: AmfeCause[]): AmfeFailure {
    return { id: uid(), description: desc, effectLocal: eL, effectNextLevel: eN, effectEndUser: eE, severity: '', causes };
}

function mkFn(desc: string, fails: AmfeFailure[]): AmfeFunction {
    return { id: uid(), description: desc, requirements: '', failures: fails };
}

function mkWe(type: WorkElementType, name: string, fns: AmfeFunction[]): AmfeWorkElement {
    return { id: uid(), type, name, functions: fns };
}

function mkOp(num: string, name: string, wes: AmfeWorkElement[], funcItem = '', funcPaso = ''): AmfeOperation {
    return { id: uid(), opNumber: num, name, workElements: wes, focusElementFunction: funcItem, operationFunction: funcPaso };
}

function mkPfdStep(num: string, type: PfdStepType, desc: string, machine = '', pChar = '', prChar = '',
    reject: 'none' | 'rework' | 'scrap' | 'sort' = 'none', rejectInfo = ''): PfdStep {
    return {
        id: uid(), stepNumber: num, stepType: type, description: desc,
        machineDeviceTool: machine,
        productCharacteristic: pChar, productSpecialChar: 'none',
        processCharacteristic: prChar, processSpecialChar: 'none',
        reference: '', department: 'Producción', notes: '',
        isRework: false, isExternalProcess: false,
        reworkReturnStep: reject === 'rework' ? rejectInfo : '',
        rejectDisposition: reject, scrapDescription: reject === 'scrap' ? rejectInfo : '',
        branchId: '', branchLabel: '',
    };
}

function mkCpItem(sn: string, desc: string, machine: string, pC: string, prC: string,
    spec: string, evalT: string, size: string, freq: string, ctrl: string, react: string, sc = ''): ControlPlanItem {
    return {
        id: uid(), processStepNumber: sn, processDescription: desc,
        machineDeviceTool: machine, componentMaterial: '', characteristicNumber: '',
        productCharacteristic: pC, processCharacteristic: prC,
        specialCharClass: sc, specification: spec,
        evaluationTechnique: evalT, sampleSize: size,
        sampleFrequency: freq, controlMethod: ctrl,
        reactionPlan: react, reactionPlanOwner: 'Líder de Producción',
        controlProcedure: '',
    };
}

function mkHoSheet(opId: string, num: string, name: string, ppe: PpeItem[],
    steps: { d: string; k?: boolean; r?: string }[]): HojaOperacion {
    return {
        id: uid(), amfeOperationId: opId,
        operationNumber: num, operationName: name,
        hoNumber: `HO-${num}`, sector: 'Producción',
        puestoNumber: '', vehicleModel: '',
        partCodeDescription: '',
        safetyElements: ppe, hazardWarnings: [],
        steps: steps.map((s, i) => ({
            id: uid(), stepNumber: i + 1, description: s.d,
            isKeyPoint: s.k || false, keyPointReason: s.r || '',
        })),
        qualityChecks: [],
        reactionPlanText: DEFAULT_REACTION_PLAN_TEXT,
        reactionContact: 'Líder de Producción',
        visualAids: [],
        preparedBy: 'F. Santoro', approvedBy: '',
        date: '2026-03-14', revision: 'A', status: 'borrador',
    };
}

const TEAM = 'Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)';

function mkAmfeHeader(partName: string, client: string, pn: string, amfeNum: string): AmfeHeaderData {
    return {
        organization: 'Barack Mercosul', location: 'Hurlingham, Buenos Aires',
        client, modelYear: '2026',
        subject: `Proceso de fabricación - ${partName}`,
        startDate: '2026-03-14', revDate: '2026-03-14',
        team: TEAM, amfeNumber: amfeNum,
        responsible: 'F. Santoro', confidentiality: 'Confidencial',
        partNumber: pn, processResponsible: 'F. Santoro',
        revision: 'A', approvedBy: '',
        scope: 'Proceso de producción completo', applicableParts: '',
    };
}

function mkPfdHeader(partName: string, pn: string, customer: string, docNum: string, amfePrj = ''): PfdHeader {
    return {
        partNumber: pn, partName, engineeringChangeLevel: '', modelYear: '2026',
        documentNumber: docNum, revisionLevel: 'A', revisionDate: '2026-03-14',
        processPhase: 'pre-launch',
        companyName: 'Barack Mercosul', plantLocation: 'Hurlingham, Buenos Aires',
        supplierCode: '', customerName: customer,
        coreTeam: TEAM, keyContact: 'F. Santoro',
        preparedBy: 'F. Santoro', preparedDate: '2026-03-14',
        approvedBy: '', approvedDate: '',
        linkedAmfeProject: amfePrj,
    };
}

function mkCpHeader(partName: string, pn: string, client: string, cpNum: string, amfePrj: string): ControlPlanHeader {
    return {
        controlPlanNumber: cpNum, phase: 'preLaunch',
        partNumber: pn, latestChangeLevel: '', partName, applicableParts: '',
        organization: 'Barack Mercosul', supplier: 'Barack Mercosul',
        supplierCode: '', keyContactPhone: '',
        date: '2026-03-14', revision: 'A',
        responsible: 'F. Santoro', approvedBy: '', plantApproval: 'Gonzalo Cal', client,
        coreTeam: TEAM,
        customerApproval: '', otherApproval: '',
        linkedAmfeProject: amfePrj,
    };
}

function mkHoHeader(client: string, pn: string, desc: string, amfePrj: string, cpPrj: string): HoDocumentHeader {
    return {
        formNumber: 'I-IN-002.4-R01', organization: 'Barack Mercosul',
        client, partNumber: pn, partDescription: desc,
        applicableParts: '', linkedAmfeProject: amfePrj, linkedCpProject: cpPrj,
    };
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

let _seedRunning = false;

async function seedAllApqpDocuments(): Promise<string> {
    // Prevent concurrent runs
    if (_seedRunning) return 'SKIPPED: Seed already running';
    _seedRunning = true;

    try {
        return await _doSeed();
    } finally {
        _seedRunning = false;
    }
}

async function _doSeed(): Promise<string> {
    // Reset PRNG to produce identical UUIDs every run
    _rng = new SeededRng(20260314);

    // Use Supabase directly — the SupabaseAdapter's exec_sql_write RPC
    // silently fails for complex INSERT OR REPLACE statements.
    const { supabase } = await import('../supabaseClient');
    const log: string[] = [];

    const ok = (result: boolean, label: string) => {
        if (!result) throw new Error(`SAVE FAILED: ${label}`);
    };

    // Clean existing seed data via Supabase direct API
    const seedProjects = ['Telas Planas PWA', 'Telas Termoformadas PWA', 'Armrest Door Panel Patagonia', 'Insert Patagonia', 'Top Roll Patagonia'];
    for (const p of seedProjects) {
        await supabase.from('amfe_documents').delete().like('project_name', `%${p}`);
        await supabase.from('cp_documents').delete().like('project_name', `%${p}`);
        await supabase.from('ho_documents').delete().like('linked_amfe_project', `%${p}`);
    }
    for (const p of ['Telas Planas', 'Telas Termoformadas', 'Armrest Door Panel', 'Insert', 'Top Roll']) {
        await supabase.from('pfd_documents').delete().eq('part_name', p);
    }
    log.push('Cleaned existing seed data');

    // ========================================================================
    // PRODUCT 1: TELAS PLANAS PWA (HILUX 581D)
    // Ref: FLUJOGRAMA_150_TELAS_581D_REV.pdf, AMFE Rev D, Try out 25/03/2026
    // 12 part numbers: 219463-219475. Material: Punz. PES 110 + TNT PP 30 BCO
    // ========================================================================
    {
        const P = 'Telas Planas PWA';
        const PN = '21-9463';
        const CL = 'PWA';
        const amfeId = uid(), cpId = uid(), pfdId = uid(), hoId = uid();

        // --- AMFE Operations (only real manufacturing ops — no storage/transport per rules) ---
        const ops = [
            mkOp('OP 10', 'Recepción de materia prima', [
                mkWe('Material', 'Tela PES 110 + TNT PP 30 Blanco / Hilo Caimán Poliéster 120 / Hilo Poliéster Texturizado / Aplix Metal Resin 208mm', [
                    mkFn('Recibir e identificar materiales conforme a plan de control de recepción', [
                        mkFail('Identificación incorrecta', 'Problemas en orden del stock', 'Material incorrecto ingresa al proceso', 'Producto con material equivocado',
                            [mkCause('Etiqueta del proveedor no coincide con OC', 'Procedimiento de recepción P-14 documentado', 'Inspección de recepción vs remito y OC')]),
                        mkFail('Ubicación en sector incorrecto', 'Problemas en orden del stock', 'Confusión de materiales en producción', 'Producto con material equivocado',
                            [mkCause('Falta de identificación de sector', 'Identificación visual de sectores con cartelería', 'Inspección de recepción de materiales')]),
                        mkFail('Material distinto según plan de control de recepción', 'Problemas con operaciones posteriores', 'Producto fuera de especificación', 'Reclamo del cliente',
                            [mkCause('Falta de control de recepción', 'Procedimiento de recepción P-14 con checklist', 'Inspección de recepción de materiales')]),
                        mkFail('Omisión de la recepción de material', 'Problemas en orden del stock', 'Material sin verificar ingresa al proceso', 'Riesgo de calidad en campo',
                            [mkCause('No se cumple procedimiento de recepción', 'Procedimiento P-14 obligatorio, registro de recepción', 'Auditoría de proceso de recepción')]),
                    ]),
                ]),
            ]),
            mkOp('OP 15', 'Preparación de corte', [
                mkWe('Method', 'Procedimiento de tendido/encimado y tizada', [
                    mkFn('Tender tela sobre mesa de corte y posicionar tizada', [
                        mkFail('Desplazamiento involuntario del material TNT provocando falta de perforaciones y colocación incorrecta de los aplix',
                            'Problemas en operaciones posteriores (falta de aplix en ubicaciones correctas)', 'Retrabajo o rechazo de pieza', 'Producto defectuoso',
                            [mkCause('Operario no verificó el enrase de las líneas de contorno del TNT con respecto a la posición de referencia para el punzonado',
                                'Hoja de operaciones con líneas de referencia impresas para punzonado', 'Inspección visual de las perforaciones inmediatamente después de punzonar y antes de entregar la pieza a la siguiente operación')]),
                        mkFail('Tela mal tendida (arrugas, tensión desigual)', 'Corte impreciso, variación dimensional', 'Piezas fuera de dimensión', 'Producto defectuoso',
                            [mkCause('Operador no sigue procedimiento de tendido/encimado', 'Instrucción de trabajo de tendido documentada en HO', 'Verificación visual del tendido antes de corte')]),
                        mkFail('Ploteo de patrón/tizada incorrecto', 'Desperdicio de material', 'Piezas con forma incorrecta', 'Retrabajo o scrap',
                            [mkCause('Programa de ploteo erróneo o desactualizado', 'Verificación de programa vs plano vigente antes de corte', 'Control de primera pieza cortada vs mylar')]),
                    ]),
                    mkFn('Posicionar tela del lado correcto (liso vs felpudo) según pieza patrón', [
                        mkFail('Tela posicionada del lado incorrecto (liso vs felpudo invertido) en tizada',
                            'Pieza cortada con cara incorrecta, no detectable hasta costura', 'Pieza cosida con cara incorrecta visible, retrabajo completo fuera de línea', 'Aspecto visual no conforme del asiento',
                            [mkCause('Falta de definición del lado correcto de tela en tizada. Dificultad visual para diferenciar liso de felpudo en ref. 67/68',
                                'Ayuda visual en puesto de corte con foto de lado correcto por referencia', 'Control visual post-corte con pieza patrón')]),
                    ]),
                ]),
            ]),
            mkOp('OP 20', 'Corte de componentes', [
                mkWe('Machine', 'Cortadora automática', [
                    mkFn('Cortar tela a dimensiones especificadas según dimensional con cantidad de orificios según plan de control', [
                        mkFail('Largo distinto al especificado', 'Inutilización del material', 'Pieza no conforme en cliente', 'Producto defectuoso',
                            [mkCause('Programación equivocada de la máquina de corte automática', 'Set up de la máquina de corte automática', 'Control con pieza patrón')]),
                        mkFail('Ancho distinto al especificado', 'Inutilización del material', 'Pieza no conforme en cliente', 'Producto defectuoso',
                            [mkCause('Programación equivocada de la máquina de corte automática', 'Set up de la máquina de corte automática', 'Control con pieza patrón')]),
                        mkFail('Falta de orificios', 'Imposibilidad de realizar el proceso posterior', 'Pieza no ensambla en cliente', 'Producto no funcional',
                            [mkCause('Programación equivocada de la máquina de corte automática', 'Set up de la máquina de corte automática', 'Control visual')]),
                        mkFail('Orificios fuera de posición', 'Imposibilidad de realizar el proceso posterior', 'Pieza no ensambla en cliente', 'Producto no funcional',
                            [mkCause('Programación equivocada de la máquina de corte automática', 'Set up de la máquina de corte automática', 'Control con pieza patrón')]),
                        mkFail('Diámetro de orificios fuera de especificación', 'Imposibilidad de realizar el proceso posterior', 'Pieza no ensambla en cliente', 'Producto no funcional',
                            [mkCause('Programación equivocada de la máquina de corte automática', 'Set up de la máquina de corte automática', 'Control con pieza patrón')]),
                        mkFail('TNT plegado involuntariamente al cargar, provocando desplazamiento del contorno y pérdida de posición de referencia',
                            'La pieza requiere retrabajo completo fuera de línea para corregir perforaciones y ubicación de aplix', 'Retrabajo o rechazo de pieza', 'Producto defectuoso',
                            [mkCause('El operario carga el TNT con un pliegue no detectado en la mesa de corte', 'Hoja de Operaciones HO-20 con instrucción de verificación de pliegues', 'Inspección visual posterior al corte')]),
                    ]),
                ]),
            ]),
            mkOp('OP 25', 'Control con mylar', [
                mkWe('Measurement', 'Mylar / Plantilla de control', [
                    mkFn('Verificar conformidad dimensional de piezas cortadas contra mylar', [
                        mkFail('Pieza fuera de tolerancia no detectada', 'Pieza no conforme pasa a costura', 'Producto fuera de especificación en cliente', 'Producto defectuoso',
                            [mkCause('Mylar desgastado o desactualizado', 'Plan de verificación de mylar periódico', 'Auditoría de producto en proceso')]),
                    ]),
                ]),
            ]),
            mkOp('OP 30', 'Preparación de kits de componentes', [
                mkWe('Method', 'Procedimiento de armado de kits', [
                    mkFn('Armar kits con todos los componentes necesarios por pieza', [
                        mkFail('Kit incompleto (falta componente)', 'Parada en operación siguiente', 'Producto incompleto', 'Retrabajo o scrap',
                            [mkCause('Error del operador en armado de kit', 'Lista de componentes por producto en HO, ayuda visual', 'Verificación visual del kit armado')]),
                        mkFail('Componente equivocado en el kit', 'Producto con componente incorrecto', 'Producto fuera de especificación', 'Reclamo de cliente',
                            [mkCause('Confusión de componentes similares', 'Identificación clara por componente, ayuda visual con fotos', 'Control visual vs lista de kit')]),
                    ]),
                ]),
            ]),
            mkOp('OP 40', 'Costura recta', [
                mkWe('Machine', 'Máquina de costura', [
                    mkFn('Costura fuerte, sin arruga ni pliegues con hilo según especificaciones', [
                        mkFail('Falta de costura', 'Scrap', 'Producto no conforme en cliente', 'Producto defectuoso',
                            [mkCause('Carreteles mal ubicados', 'Mantenimiento primer nivel', 'Control visual / Muestra patrón'),
                             mkCause('Aguja mal ubicada', 'Mantenimiento primer nivel', 'Control visual / Muestra patrón')]),
                        mkFail('Costura floja / deficiente', 'Retrabajo', 'Desprendimiento en uso', 'Falla funcional del producto',
                            [mkCause('Falla en la tensión del hilo', 'Mantenimiento primer nivel', 'Control visual / Muestra patrón')]),
                        mkFail('Costura salteada', 'Scrap', 'Producto no conforme en cliente', 'Producto defectuoso',
                            [mkCause('Peine dañado', 'Mantenimiento primer nivel', 'Control visual / Muestra patrón'),
                             mkCause('Aguja despuntada', 'Mantenimiento primer nivel', 'Control visual / Muestra patrón')]),
                        mkFail('Arrugas / Pliegues', 'Scrap', 'Rechazo visual en cliente', 'Aspecto no aceptable',
                            [mkCause('Hilo enredado', 'Mantenimiento primer nivel', 'Control visual / Muestra patrón')]),
                        mkFail('Refuerzo costurado opuesto al airbag se encuentra posicionado de manera inversa', 'Scrap', 'Producto no conforme', 'Falla funcional',
                            [mkCause('Falla del operario en posicionamiento del refuerzo', 'Hoja de operaciones con instrucción de posicionamiento', 'Autocontrol visual')]),
                    ]),
                ]),
            ]),
            mkOp('OP 50', 'Troquelado de refuerzos', [
                mkWe('Machine', 'Troquel / Prensa hidráulica', [
                    mkFn('Troquelar refuerzos (250 g/m2 y 1000 g/m2) a forma según plano', [
                        mkFail('Forma fuera de especificación', 'Refuerzo no conforme', 'Refuerzo no ensambla correctamente', 'Producto con rigidez deficiente',
                            [mkCause('Troquel desgastado o dañado', 'Mantenimiento preventivo de troquel', 'Control dimensional con gauge')]),
                        mkFail('Rebabas en bordes de corte', 'Retrabajo manual necesario', 'Posible daño al material', 'Riesgo de calidad',
                            [mkCause('Holgura excesiva en troquel', 'Control de gap de troquel en setup', 'Inspección visual y táctil 100%')]),
                    ]),
                ]),
            ]),
            mkOp('OP 60', 'Troquelado de aplix', [
                mkWe('Machine', 'Troquel / Prensa', [
                    mkFn('Troquelar Aplix Metal Resin 208mm a dimensiones según plano', [
                        mkFail('Dimensión incorrecta del Aplix troquelado', 'Aplix no conforme', 'Fijación deficiente en ensamble', 'Desprendimiento en uso',
                            [mkCause('Troquel de Aplix desgastado', 'Mantenimiento preventivo de troquel', 'Control dimensional del Aplix troquelado')]),
                    ]),
                ]),
            ]),
            mkOp('OP 70', 'Pegado de dots aplix', [
                mkWe('Man', 'Operador de colocado', [
                    mkFn('Colocar dots/clips en posición correcta con cantidad correcta según plano', [
                        mkFail('Dots/clips colocados en posición incorrecta', 'Retrabajo de la pieza', 'Pieza no sujeta correctamente al sustrato', 'Insatisfacción del cliente',
                            [mkCause('Orificios fuera de posición', 'Control con pieza patrón', 'Control visual')]),
                        mkFail('Falta de dots/clips', 'Retrabajo de la pieza', 'Falla de sujeción', 'Producto no funcional',
                            [mkCause('Falta de orificios', 'Control con pieza patrón', 'Control visual')]),
                    ]),
                ]),
            ]),
            mkOp('OP 80', 'Control final de calidad', [
                mkWe('Measurement', 'Patrón visual / Cinta métrica', [
                    mkFn('Verificar conformidad total del producto terminado', [
                        mkFail('Dimensional fuera de especificación', 'Rechazo de cliente', 'Producto no conforme en ensamble', 'Producto defectuoso',
                            [mkCause('Programación equivocada de la máquina de corte automática', 'Set up documentado de la máquina', 'Control dimensional de la pieza')]),
                        mkFail('Mayor cantidad de piezas por medio', 'Reclamo de cliente', 'Cliente recibe cantidad incorrecta', 'Diferencia de inventario',
                            [mkCause('Error de conteo', 'Control adicional con otro método', 'Autocontrol / Auditoría de producto terminado')]),
                        mkFail('Menor cantidad de piezas por medio', 'Reclamo de cliente', 'Cliente recibe cantidad incorrecta', 'Parada de línea en cliente',
                            [mkCause('Error de conteo', 'Control adicional con otro método', 'Autocontrol / Auditoría de producto terminado')]),
                    ]),
                ]),
            ]),
            mkOp('OP 110', 'Embalaje y etiquetado de producto terminado', [
                mkWe('Method', 'Procedimiento de embalaje según GE-251', [
                    mkFn('Embalar, identificar y proteger producto para despacho', [
                        mkFail('Error de identificación', 'Pérdida de rastreabilidad del producto / Reclamo del Cliente', 'Entrega equivocada', 'Cliente recibe pieza incorrecta',
                            [mkCause('Error de identificación por parte del operador', 'Organización de etiquetas', 'Autocontrol / Auditoría de producto terminado')]),
                        mkFail('Falta de identificación', 'Pérdida de rastreabilidad del producto / Reclamo del Cliente', 'Entrega sin trazabilidad', 'Cliente no puede rastrear producto',
                            [mkCause('Falla de operario', 'Instrucción de embalaje visual en puesto según GE-251', 'Autocontrol / Auditoría de producto terminado')]),
                    ]),
                ]),
            ]),
        ];

        { const amfeDoc = { header: mkAmfeHeader('Telas Planas', CL, PN, 'AMFE-1'), operations: ops }; const { error: e1 } = await supabase.from('amfe_documents').upsert({ id: amfeId, amfe_number: 'AMFE-1', project_name: P, data: amfeDoc, status: 'draft', operation_count: ops.length, cause_count: 0, ap_h_count: 0, ap_m_count: 0, coverage_percent: 0, start_date: '2026-03-14', last_revision_date: '2026-03-14', revisions: [], checksum: '' }); ok(!e1, 'P1-AMFE'); }

        // --- PFD (matches FLUJOGRAMA_150_TELAS_581D_REV.pdf + WIP storage) ---
        const pfdDoc: PfdDocument = {
            id: pfdId,
            header: mkPfdHeader('Telas Planas', PN, CL, 'PFD-TP-001', 'PWA/TELAS_PLANAS'),
            steps: [
                // Recepción
                mkPfdStep('OP 10', 'storage', 'RECEPCION DE MATERIA PRIMA', '', 'Certificado de calidad, estado del material', 'Condiciones de transporte', 'scrap', 'Material no conforme → Rechazo a proveedor'),
                mkPfdStep('10a', 'storage', 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA PENDIENTE DE CONTROL', '', '', '', 'none', ''),
                mkPfdStep('10b', 'inspection', 'INSPECCION DE MATERIA PRIMA', '', 'Estado del material, identificación', '', 'none', ''),
                mkPfdStep('10c', 'decision', 'MATERIAL CONFORME?', '', '', '', 'scrap', 'NO → Reclamo de calidad al proveedor'),
                mkPfdStep('10d', 'transport', 'TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO)', '', '', '', 'none', ''),
                mkPfdStep('10e', 'storage', 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA', '', '', '', 'none', ''),
                mkPfdStep('10f', 'transport', 'TRASLADO: TELAS A SECTOR DE MESA DE CORTE', '', '', '', 'none', ''),
                // Preparación y corte
                mkPfdStep('OP 15', 'operation', 'PREPARACION DE CORTE', 'Mesa de corte, plotter', 'Calidad del tendido, lado correcto de tela', 'Programa de ploteo/tizada', 'rework', 'OP 15'),
                mkPfdStep('OP 20', 'operation', 'CORTE DE COMPONENTES', 'Cortadora automática', 'Dimensiones de corte, orificios', 'Set up de máquina de corte', 'scrap', 'Pieza fuera de dimensión → Scrap'),
                mkPfdStep('OP 25', 'inspection', 'CONTROL CON MYLAR', 'Mylar / Plantilla', 'Conformidad dimensional vs mylar', '', 'scrap', 'Pieza no conforme → Scrap'),
                mkPfdStep('25a', 'decision', 'PRODUCTO CONFORME?', '', '', '', 'scrap', 'NO → Scrap'),
                // Kits + WIP storage
                mkPfdStep('OP 30', 'operation', 'PREPARACION DE KITS DE COMPONENTES', '', 'Kit completo y correcto', '', 'rework', 'OP 30'),
                mkPfdStep('30a', 'storage', 'EMBOLSADO WIP: PIEZAS CORTADAS EN BOLSA CON ETIQUETA WIP (REFERENCIA + CANTIDAD)', 'Bolsa plástica, etiqueta WIP', 'Identificación WIP correcta', '', 'none', ''),
                mkPfdStep('30b', 'transport', 'TRASLADO: KITS DE COMPONENTES A SECTOR DE BLANCO', '', '', '', 'none', ''),
                // Parallel branch: Troquelado
                { ...mkPfdStep('50a', 'transport', 'TRASLADO: MATERIAL APLIX Y REFUERZOS A SECTOR DE TROQUELADO', '', '', '', 'none', ''), branchId: 'B', branchLabel: 'Troquelado' },
                { ...mkPfdStep('OP 50', 'operation', 'TROQUELADO DE REFUERZOS', 'Troquel / Prensa hidráulica', 'Forma y dimensiones del refuerzo', 'Presión de prensa', 'scrap', 'Forma incorrecta → Scrap'), branchId: 'B', branchLabel: 'Troquelado' },
                { ...mkPfdStep('OP 60', 'operation', 'TROQUELADO DE APLIX', 'Troquel / Prensa', 'Dimensiones del Aplix', 'Set up de troquel', 'scrap', 'Dimensión incorrecta → Scrap'), branchId: 'B', branchLabel: 'Troquelado' },
                { ...mkPfdStep('60a', 'transport', 'TRASLADO: APLIX A SECTOR DE BLANCO', '', '', '', 'none', ''), branchId: 'B', branchLabel: 'Troquelado' },
                // Costura y acabado
                mkPfdStep('OP 40', 'operation', 'COSTURA RECTA', 'Máquina de costura', 'Alineación y resistencia de costura', 'Tensión de hilo, velocidad', 'rework', 'OP 40'),
                mkPfdStep('40a', 'decision', 'LLEVA OVERLOCK?', '', '', '', 'none', ''),
                mkPfdStep('OP 70', 'operation', 'PEGADO DE DOTS APLIX', 'Plantilla de posición', 'Posición y cantidad de dots/clips', '', 'rework', 'OP 70'),
                // Control final y reprocesos
                mkPfdStep('OP 80', 'inspection', 'CONTROL FINAL DE CALIDAD', 'Patrón visual, cinta métrica', 'Aspecto, dimensiones, cantidad', '', 'sort', ''),
                mkPfdStep('80a', 'decision', 'PRODUCTO CONFORME?', '', '', '', 'sort', ''),
                mkPfdStep('OP 90', 'operation', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', '', '', '', 'none', ''),
                mkPfdStep('OP 100', 'operation', 'REPROCESO: ELIMINACION DE HILO SOBRANTE', '', '', '', 'rework', 'OP 80'),
                mkPfdStep('OP 101', 'operation', 'REPROCESO: REUBICACION DE APLIX', '', '', '', 'rework', 'OP 80'),
                mkPfdStep('OP 102', 'operation', 'REPROCESO: CORRECCION DE COSTURA DESVIADA / FLOJA', '', '', '', 'rework', 'OP 80'),
                // Embalaje final
                mkPfdStep('OP 110', 'operation', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', 'Bolsa BA 80 100, etiqueta ET-SATO-100X60', 'Identificación correcta, cantidad correcta', 'Según GE-251', 'rework', 'OP 110'),
                mkPfdStep('110a', 'transport', 'TRASLADO A SECTOR DE PRODUCTO TERMINADO', '', '', '', 'none', ''),
                mkPfdStep('110b', 'storage', 'ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)', '', '', '', 'none', ''),
            ],
            createdAt: '2026-03-14T12:00:00.000Z', updatedAt: '2026-03-14T12:00:00.000Z',
        };
        { const { error: e2 } = await supabase.from('pfd_documents').upsert({ id: pfdId, part_name: 'Telas Planas', part_number: PN, data: { header: pfdDoc.header, steps: pfdDoc.steps }, created_at: pfdDoc.createdAt, updated_at: pfdDoc.updatedAt }); ok(!e2, 'P1-PFD'); }

        // --- CP (matches AMFE operations + new try-out finding) ---
        const cpDoc: ControlPlanDocument = {
            header: mkCpHeader('Telas Planas', PN, CL, 'CP-TP-001', P),
            items: [
                // OP 10 Recepción
                mkCpItem('OP 10', 'Recepción de materia prima', '', 'Estado del material', 'Condiciones de transporte', 'Sin daños, manchas ni arrugas', 'Visual', '1 rollo', 'Cada recepción', 'Registro de recepción s/ P-14', 'Rechazar lote y notificar al proveedor s/ P-14'),
                mkCpItem('OP 10', 'Recepción de materia prima', '', 'Identificación de lote', '', 'Coincide con orden de compra', 'Visual vs remito', '100%', 'Cada recepción', 'Verificación de remito', 'Separar y verificar con compras s/ P-14'),
                mkCpItem('OP 10', 'Recepción de materia prima', '', 'Flamabilidad', '', 'Vel. propagación ≤ 100 mm/min', 'Certificado de laboratorio', '1 muestra', 'Cada lote de material', 'Certificado proveedor + ensayo periódico', 'Rechazar lote, notificar proveedor s/ P-14', 'SC'),
                // OP 15 Preparación de corte
                mkCpItem('OP 15', 'Preparación de corte', 'Mesa de corte, plotter', 'Calidad del tendido', 'Programa de ploteo/tizada', 'Tela sin arrugas ni tensión desigual', 'Visual', '100%', 'Cada tendido', 'Verificación de tendido antes de corte', 'Re-tender tela s/ P-09/I'),
                mkCpItem('OP 15', 'Preparación de corte', 'Mesa de corte', 'Lado correcto de tela (liso vs felpudo)', '', 'Lado liso/felpudo según pieza patrón por referencia', 'Control visual con pieza patrón', 'Primeras 5 piezas', 'Cada inicio de lote / cambio de referencia', 'Ayuda visual en puesto con foto de lado correcto', 'Detener producción, verificar tizada, corregir s/ P-09/I'),
                // OP 20 Corte
                mkCpItem('OP 20', 'Corte de componentes', 'Cortadora automática', 'Dimensiones de corte (largo y ancho)', 'Set up de máquina de corte automática', '±2mm vs plano', 'Control con pieza patrón', '5 piezas', 'Inicio de lote', 'Planilla de control dimensional', 'Ajustar set up y re-cortar s/ P-09/I'),
                mkCpItem('OP 20', 'Corte de componentes', 'Cortadora automática', 'Presencia y posición de orificios', 'Set up de máquina de corte automática', 'Según plano, orificios presentes y en posición', 'Control visual', '100%', 'Cada pieza', 'Inspección visual post-corte', 'Verificar set up, separar lote s/ P-09/I'),
                // OP 25 Control con mylar
                mkCpItem('OP 25', 'Control con mylar', 'Mylar / Plantilla', 'Conformidad dimensional vs mylar', '', 'Conforme a mylar vigente', 'Superposición con mylar', '5 piezas', 'Inicio de lote + cada 50 piezas', 'Registro de control dimensional', 'Scrap pieza no conforme s/ P-13'),
                // OP 40 Costura
                mkCpItem('OP 40', 'Costura recta', 'Máquina de costura', 'Alineación de costura', 'Tensión de hilo', 'Sin saltos, sin arrugas, sin pliegues', 'Control visual / Muestra patrón', '5 piezas', 'Inicio turno + cada hora', 'Inspección en proceso', 'Ajustar máquina y separar sospechosas s/ P-09/I'),
                mkCpItem('OP 40', 'Costura recta', 'Máquina de costura', 'Resistencia de costura', '', 'Min. TBD N', 'Ensayo de tracción', '1 pieza', '1x turno', 'Registro de ensayo destructivo', 'Detener, ajustar tensión, retener lote s/ P-09/I'),
                mkCpItem('OP 40', 'Costura recta', 'Máquina de costura', 'Posición de refuerzo costurado (aplica ref. 67/68)', '', 'Refuerzo opuesto al airbag en posición correcta', 'Autocontrol visual', '100%', 'Cada pieza', 'Inspección visual vs HO', 'Separar pieza, corregir posición s/ P-09/I'),
                // OP 50 Troquelado refuerzos
                mkCpItem('OP 50', 'Troquelado de refuerzos', 'Troquel / Prensa', 'Forma troquelada del refuerzo', 'Presión de prensa', 'Conforme a plano', 'Control dimensional con gauge', '5 piezas', 'Inicio + c/50 pzas', 'Control con gauge', 'Cambiar troquel, separar lote s/ P-09/I'),
                // OP 60 Troquelado aplix
                mkCpItem('OP 60', 'Troquelado de aplix', 'Troquel / Prensa', 'Dimensión del Aplix troquelado', 'Set up de troquel', 'Conforme a plano', 'Control dimensional', '5 piezas', 'Inicio + c/50 pzas', 'Control dimensional', 'Cambiar troquel, separar lote s/ P-09/I'),
                // OP 70 Pegado dots
                mkCpItem('OP 70', 'Pegado de dots aplix', 'Plantilla de posición', 'Posición de dots/clips', '', 'Conforme a plano', 'Control visual vs pieza patrón', '100%', 'Cada pieza', 'Inspección visual', 'Reposicionar dots s/ P-09/I'),
                mkCpItem('OP 70', 'Pegado de dots aplix', 'Plantilla de posición', 'Cantidad de dots/clips', '', 'Según plano por referencia', 'Control visual', '100%', 'Cada pieza', 'Inspección visual', 'Completar dots faltantes s/ P-09/I'),
                // OP 80 Control final
                mkCpItem('OP 80', 'Control final de calidad', 'Patrón visual, cinta métrica', 'Aspecto visual general', '', 'Sin defectos según patrón', 'Visual vs patrón', '100%', 'Cada pieza', 'Inspección final', 'Separar no conforme s/ P-13'),
                mkCpItem('OP 80', 'Control final de calidad', 'Cinta métrica', 'Dimensiones generales', '', '±2mm vs plano', 'Cinta métrica', '5 piezas', 'Cada lote', 'Planilla dimensional', 'Retener lote, verificar proceso s/ P-09/I'),
                mkCpItem('OP 80', 'Control final de calidad', '', 'Cantidad de piezas por medio', '', '50 pzas/medio (ref. 63-68), 25 pzas/medio (ref. 69-75)', 'Conteo', '100%', 'Cada medio', 'Verificación de conteo', 'Corregir cantidad s/ P-09/I'),
                // OP 110 Embalaje
                mkCpItem('OP 110', 'Embalaje y etiquetado de PT', 'Etiqueta ET-SATO-100X60', 'Identificación correcta', '', 'Etiqueta legible con código, cant., lote, fecha', 'Visual', '100%', 'Cada bolsa', 'Verificación de etiqueta', 'Corregir etiqueta s/ P-09/I'),
            ],
        };
        { const { error: e3 } = await supabase.from('cp_documents').upsert({ id: cpId, project_name: P, linked_amfe_id: amfeId, data: cpDoc,  }); ok(!e3, 'P1-CP'); }

        // --- HO ---
        const hoDoc: HoDocument = {
            header: mkHoHeader(CL, PN, 'Telas Planas', P, P),
            sheets: [
                mkHoSheet(ops[0].id, 'OP 10', 'Recepción de materia prima', ['guantes', 'zapatos'], [
                    { d: 'Recibir material del proveedor, verificar remito vs orden de compra' },
                    { d: 'Inspeccionar visualmente el estado del material (sin daños, manchas, arrugas)', k: true, r: 'Detectar material no conforme antes de ingresarlo al proceso' },
                    { d: 'Verificar identificación del material vs plan de control de recepción' },
                    { d: 'Registrar la recepción en planilla de control s/ P-14' },
                    { d: 'Almacenar en zona designada con identificación de lote' },
                ]),
                mkHoSheet(ops[1].id, 'OP 15', 'Preparación de corte', ['guantes', 'zapatos'], [
                    { d: 'Verificar que la tela está en condiciones (sin defectos visibles)' },
                    { d: 'Verificar el lado correcto de la tela (liso vs felpudo) según ayuda visual del puesto y pieza patrón', k: true, r: 'Evitar inversión del lado de tela (detectado en try out 25/03/2026). Refs 67/68 son difíciles de diferenciar visualmente' },
                    { d: 'Tender tela sobre mesa de corte sin arrugas ni tensión desigual, verificando enrase de líneas de contorno', k: true, r: 'Tendido correcto para corte preciso y posición correcta de perforaciones' },
                    { d: 'Cargar programa de ploteo/tizada y verificar que corresponde al plano vigente' },
                    { d: 'Ejecutar ploteo del patrón sobre la tela' },
                ]),
                mkHoSheet(ops[2].id, 'OP 20', 'Corte de componentes', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar que la cortadora está calibrada y la cuchilla en buen estado' },
                    { d: 'Verificar set up de la máquina de corte automática según programa', k: true, r: 'Set up correcto para cumplir dimensiones y orificios' },
                    { d: 'Verificar que el TNT no tiene pliegues antes de cargar en mesa de corte', k: true, r: 'Pliegue no detectado causa desplazamiento de contorno y pérdida de referencia de perforaciones' },
                    { d: 'Ejecutar el corte según programa' },
                    { d: 'Verificar dimensiones y presencia de orificios de las primeras 5 piezas con pieza patrón' },
                    { d: 'Separar piezas cortadas e identificar lote' },
                ]),
                mkHoSheet(ops[3].id, 'OP 25', 'Control con mylar', ['anteojos', 'zapatos'], [
                    { d: 'Tomar pieza cortada del lote' },
                    { d: 'Superponer mylar sobre la pieza y verificar conformidad dimensional', k: true, r: 'Detectar piezas fuera de tolerancia antes de costura' },
                    { d: 'Registrar resultado en planilla de control dimensional' },
                    { d: 'Separar piezas OK y NOK' },
                ]),
                mkHoSheet(ops[4].id, 'OP 30', 'Preparación de kits de componentes', ['guantes', 'zapatos'], [
                    { d: 'Verificar lista de componentes del kit según referencia de la pieza' },
                    { d: 'Armar kit con todos los componentes necesarios', k: true, r: 'Kit completo y correcto para evitar paradas en costura' },
                    { d: 'Embolar piezas cortadas en bolsa con etiqueta WIP (referencia + cantidad)' },
                    { d: 'Trasladar bolsa WIP a sector de costura/blanco' },
                ]),
                mkHoSheet(ops[5].id, 'OP 40', 'Costura recta', ['anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar tensión del hilo y estado de aguja/peine de la máquina de costura' },
                    { d: 'Posicionar piezas en la guía de costura', k: true, r: 'Alineación crítica para calidad visual y funcional' },
                    { d: 'Para ref. 67/68: verificar posición correcta del refuerzo costurado opuesto al airbag', k: true, r: 'Refuerzo invertido genera desalineación de orificios, detectado en 8D recurrentes' },
                    { d: 'Ejecutar costura según instrucción de trabajo (sin saltos, sin arrugas, sin pliegues)' },
                    { d: 'Inspeccionar visualmente cada pieza cosida vs muestra patrón' },
                ]),
                mkHoSheet(ops[6].id, 'OP 50', 'Troquelado de refuerzos', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar estado del troquel (sin desgaste, sin daños)' },
                    { d: 'Posicionar refuerzo en troquel', k: true, r: 'Centrado correcto para forma conforme a plano' },
                    { d: 'Accionar prensa según parámetros de proceso' },
                    { d: 'Retirar refuerzo troquelado y verificar con gauge' },
                ]),
                mkHoSheet(ops[7].id, 'OP 60', 'Troquelado de aplix', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar estado del troquel de Aplix' },
                    { d: 'Posicionar Aplix Metal Resin en troquel' },
                    { d: 'Accionar prensa según parámetros' },
                    { d: 'Verificar dimensiones del Aplix troquelado' },
                ]),
                mkHoSheet(ops[8].id, 'OP 70', 'Pegado de dots aplix', ['guantes', 'zapatos'], [
                    { d: 'Verificar que la superficie de la pieza está limpia' },
                    { d: 'Posicionar dots/clips usando plantilla de referencia', k: true, r: 'Posición y cantidad correcta para sujeción del panel' },
                    { d: 'Verificar posición y cantidad de cada dot/clip vs plano' },
                ]),
                mkHoSheet(ops[9].id, 'OP 80', 'Control final de calidad', ['anteojos', 'zapatos'], [
                    { d: 'Tomar pieza del buffer de producción' },
                    { d: 'Inspeccionar aspecto visual comparando con patrón de referencia', k: true, r: 'Detectar todos los defectos visuales' },
                    { d: 'Verificar dimensiones con cinta métrica' },
                    { d: 'Verificar cantidad de piezas por medio (50 para ref. 63-68, 25 para ref. 69-75)' },
                    { d: 'Registrar resultado en planilla de control final' },
                    { d: 'Separar piezas OK y NOK en contenedores identificados' },
                ]),
                mkHoSheet(ops[10].id, 'OP 110', 'Embalaje y etiquetado de producto terminado', ['guantes', 'zapatos'], [
                    { d: 'Verificar que las piezas pasaron control final' },
                    { d: 'Apilar y ordenar piezas fuera de la bolsa BA 80 100', k: true, r: 'Introducir piezas suavemente para evitar marcas o deformaciones' },
                    { d: 'Introducir piezas ordenadas dentro de la bolsa' },
                    { d: 'Verificar cantidad de piezas por bolsa según GE-251' },
                    { d: 'Colocar etiqueta ET-SATO-100X60 con código, cantidad, lote, fecha' },
                    { d: 'Confirmar legibilidad completa de la etiqueta' },
                ]),
            ],
        };
        { const { error: e4 } = await supabase.from('ho_documents').upsert({ id: hoId, linked_amfe_project: P, linked_amfe_id: amfeId, linked_cp_id: cpId, data: hoDoc,  }); ok(!e4, 'P1-HO'); }
        log.push(`Product 1: ${P} - PFD + AMFE + CP + HO created`);
    }

    // ========================================================================
    // PRODUCT 2: TELAS TERMOFORMADAS PWA
    // ========================================================================
    {
        const P = 'Telas Termoformadas PWA';
        const PN = 'TBD-TT-PWA';
        const CL = 'PWA';
        const amfeId = uid(), cpId = uid(), pfdId = uid(), hoId = uid();

        // CC cause for flamabilidad
        const ccFlamabilidad: AmfeCause = { ...mkCause('Material no cumple ensayo de flamabilidad', 'Certificado de flamabilidad del proveedor', 'Ensayo de flamabilidad por lote'), specialChar: 'CC' };

        const ops = [
            mkOp('OP 10', 'Recepción de materia prima', [
                mkWe('Material', 'Tela termoformable / Refuerzos / Hilos / Aplix', [
                    mkFn('Recibir e identificar materiales conforme a plan de control', [
                        mkFail('Identificación incorrecta del material', 'Material incorrecto ingresa al proceso', 'Producto con material equivocado', 'Reclamo de cliente',
                            [mkCause('Etiqueta del proveedor no coincide con OC', 'Verificación de remito vs orden de compra', 'Inspección visual de identificación')]),
                        mkFail('Material distinto según plan de control', 'Producción con material no aprobado', 'Producto fuera de especificación', 'Rechazo del cliente',
                            [mkCause('Error de despacho del proveedor', 'Auditoría a proveedor, acuerdo de calidad', 'Inspección de recepción contra ficha técnica')]),
                        mkFail('Omisión de la recepción', 'Material ingresa sin control', 'Producto con material no verificado', 'Riesgo de calidad en campo',
                            [mkCause('Falta de procedimiento o no se cumple', 'Procedimiento de recepción documentado', 'Registro de recepción obligatorio')]),
                        mkFail('Material no cumple flamabilidad', 'Material no conforme segregado', 'Producto con riesgo de inflamabilidad', 'Riesgo de seguridad al usuario',
                            [ccFlamabilidad]),
                        mkFail('Refuerzo 600 g/m2 fuera de especificación', 'Refuerzo no conforme', 'Producto con rigidez incorrecta', 'Falla funcional del producto',
                            [mkCause('Lote de refuerzo fuera de tolerancia de gramaje', 'Certificado de gramaje del proveedor', 'Verificación de gramaje en recepción')]),
                        mkFail('Refuerzo 1500 g/m2 fuera de especificación', 'Refuerzo no conforme', 'Producto con rigidez incorrecta', 'Falla funcional del producto',
                            [mkCause('Lote de refuerzo fuera de tolerancia de gramaje', 'Certificado de gramaje del proveedor', 'Verificación de gramaje en recepción')]),
                        mkFail('Hilo Caimán Polyester 120 fuera de especificación', 'Hilo no conforme', 'Costura con resistencia incorrecta', 'Falla de costura en campo',
                            [mkCause('Proveedor entrega hilo fuera de tolerancia', 'Certificado de calidad del proveedor', 'Verificación visual y dimensional en recepción')]),
                        mkFail('Hilo Polyester texturizado fuera de especificación', 'Hilo no conforme', 'Costura con resistencia incorrecta', 'Falla de costura en campo',
                            [mkCause('Proveedor entrega hilo fuera de tolerancia', 'Certificado de calidad del proveedor', 'Verificación visual y dimensional en recepción')]),
                        mkFail('Aplix fuera de especificación', 'Aplix no conforme', 'Fijación deficiente del producto', 'Desprendimiento en uso',
                            [mkCause('Lote de Aplix fuera de tolerancia', 'Certificado de calidad del proveedor', 'Verificación visual y dimensional en recepción')]),
                    ]),
                ]),
            ], 'Asegurar la conformidad de materiales recibidos', 'Verificar e identificar materiales según plan de control'),
            mkOp('OP 15', 'Preparación de corte', [
                mkWe('Method', 'Procedimiento de tendido y ploteo', [
                    mkFn('Tender tela sobre mesa de corte y plotear patrón', [
                        mkFail('Tela mal tendida (arrugas, tensión desigual)', 'Corte impreciso', 'Piezas fuera de dimensión', 'Producto defectuoso',
                            [mkCause('Operador no sigue procedimiento de tendido', 'Instrucción de trabajo de tendido documentada', 'Verificación visual antes de corte')]),
                        mkFail('Ploteo de patrón incorrecto', 'Desperdicio de material', 'Piezas con forma incorrecta', 'Retrabajo o scrap',
                            [mkCause('Programa de ploteo erróneo o desactualizado', 'Verificación de programa vs plano vigente', 'Control de primera pieza cortada')]),
                    ]),
                ]),
            ], 'Preparar material para corte conforme', 'Tender tela y plotear patrón correctamente'),
            mkOp('OP 20', 'Corte de componentes', [
                mkWe('Machine', 'Cortadora / Mesa de corte', [
                    mkFn('Cortar tela a dimensiones especificadas según plano', [
                        mkFail('Dimensiones fuera de tolerancia', 'Pieza no conforme', 'Retrabajo en cliente', 'Producto defectuoso',
                            [mkCause('Calibración incorrecta de cortadora', 'Plan de calibración periódico', 'Control dimensional con plantilla')]),
                        mkFail('Corte irregular con rebabas', 'Aspecto visual deficiente', 'Rechazo en inspección', 'Insatisfacción visual',
                            [mkCause('Desgaste de cuchilla', 'Mantenimiento preventivo de cuchillas', 'Inspección visual 100%')]),
                    ]),
                ]),
            ], 'Obtener componentes cortados conformes a plano', 'Cortar material según dimensiones especificadas'),
            mkOp('OP 30', 'Preparación de kits de componentes', [
                mkWe('Man', 'Operador de preparación', [
                    mkFn('Armar kits con todos los componentes necesarios por pieza', [
                        mkFail('Kit incompleto (falta componente)', 'Parada en operación siguiente', 'Producto incompleto', 'Retrabajo o scrap',
                            [mkCause('Error del operador en armado de kit', 'Lista de componentes por producto, instrucción de trabajo', 'Verificación visual del kit armado')]),
                        mkFail('Componente equivocado en el kit', 'Producto con componente incorrecto', 'Producto fuera de especificación', 'Reclamo de cliente',
                            [mkCause('Confusión de componentes similares', 'Identificación clara por componente, ayuda visual', 'Control visual vs lista de kit')]),
                    ]),
                ]),
            ], 'Proveer kits completos y correctos para producción', 'Armar y verificar kits de componentes'),
            mkOp('OP 40', 'Termoformado de telas', [
                mkWe('Machine', 'Termoformadora', [
                    mkFn('Conformar pieza a geometría 3D mediante calor y presión', [
                        mkFail('Deformación dimensional', 'Pieza fuera de tolerancia', 'No ensambla en cliente', 'Producto no funcional',
                            [mkCause('Temperatura de proceso incorrecta', 'Parámetros documentados, control automático', 'Control dimensional post-formado')]),
                        mkFail('Arrugas o burbujas en superficie', 'Defecto visual', 'Rechazo visual', 'Aspecto no aceptable',
                            [mkCause('Distribución desigual del material', 'Pre-calentamiento uniforme, procedimiento de carga', 'Inspección visual 100%')]),
                    ]),
                ]),
                mkWe('Method', 'Parámetros de termoformado', [
                    mkFn('Mantener parámetros de proceso dentro de rango', [
                        mkFail('Espesor desigual en pieza formada', 'Zona débil en producto', 'Falla en uso', 'Riesgo de rotura',
                            [mkCause('Tiempo de calentamiento insuficiente', 'Receta de proceso documentada', 'Medición de espesor con micrómetro')]),
                    ]),
                ]),
            ], 'Obtener pieza termoformada conforme a geometría', 'Conformar tela mediante calor y presión'),
            mkOp('OP 50', 'Corte láser de telas termoformadas', [
                mkWe('Machine', 'Cortadora láser', [
                    mkFn('Cortar contorno de pieza termoformada con láser', [
                        mkFail('Contorno fuera de dimensión', 'Pieza requiere retrabajo', 'No ensambla en cliente', 'Producto defectuoso',
                            [mkCause('Programa de corte láser desactualizado o error de setup', 'Verificación de programa antes de inicio', 'Control dimensional con plantilla')]),
                        mkFail('Quemaduras o marcas de láser', 'Defecto visual', 'Rechazo por apariencia', 'Aspecto no aceptable',
                            [mkCause('Potencia de láser excesiva o velocidad incorrecta', 'Parámetros documentados en receta', 'Inspección visual 100%')]),
                    ]),
                ]),
            ], 'Obtener pieza con contorno conforme a plano', 'Cortar contorno de pieza termoformada con láser'),
            mkOp('OP 60', 'Troquelado de refuerzos', [
                mkWe('Machine', 'Troquel / Prensa hidráulica', [
                    mkFn('Troquelar refuerzos a forma según plano', [
                        mkFail('Forma fuera de especificación', 'Refuerzo no conforme', 'Refuerzo no ensambla correctamente', 'Producto con rigidez deficiente',
                            [mkCause('Troquel desgastado o dañado', 'Mantenimiento preventivo de troquel', 'Control dimensional con gauge')]),
                        mkFail('Rebabas en bordes de corte', 'Retrabajo manual necesario', 'Posible daño al operador o material', 'Riesgo de calidad',
                            [mkCause('Holgura excesiva en troquel', 'Control de gap de troquel en setup', 'Inspección visual y táctil 100%')]),
                    ]),
                ]),
            ], 'Obtener refuerzos troquelados conformes a plano', 'Troquelar refuerzos según especificación'),
            mkOp('OP 70', 'Troquelado de Aplix', [
                mkWe('Machine', 'Troquel / Prensa', [
                    mkFn('Troquelar Aplix a dimensiones según plano', [
                        mkFail('Dimensión incorrecta del Aplix troquelado', 'Aplix no conforme', 'Fijación deficiente', 'Desprendimiento en uso',
                            [mkCause('Troquel de Aplix desgastado', 'Mantenimiento preventivo de troquel', 'Control dimensional del Aplix troquelado')]),
                        mkFail('Rebabas en Aplix troquelado', 'Retrabajo manual', 'Dificultad de aplicación', 'Aspecto deficiente',
                            [mkCause('Holgura en troquel de Aplix', 'Control de gap en setup', 'Inspección visual y táctil')]),
                    ]),
                ]),
            ], 'Obtener Aplix troquelado conforme a plano', 'Troquelar Aplix a dimensión especificada'),
            mkOp('OP 80', 'Costura de refuerzos', [
                mkWe('Machine', 'Máquina de coser industrial', [
                    mkFn('Coser refuerzos a la pieza termoformada', [
                        mkFail('Costura salteada', 'Refuerzo mal fijado', 'Desprendimiento en ensamble', 'Falla funcional del producto',
                            [mkCause('Aguja desgastada o tensión incorrecta', 'Cambio de aguja programado, control de tensión', 'Inspección visual en proceso')]),
                        mkFail('Costura floja', 'Refuerzo con fijación débil', 'Desprendimiento en uso', 'Falla funcional del producto',
                            [mkCause('Ajuste incorrecto del tensor de hilo', 'Parámetros documentados en instrucción de trabajo', 'Inspección visual y ensayo manual')]),
                        mkFail('Hilo incorrecto', 'Costura con material inadecuado', 'Resistencia de costura incorrecta', 'Falla de costura en campo',
                            [mkCause('Error en selección de hilo', 'Instrucción de trabajo con especificación de hilo', 'Verificación de hilo antes de inicio')]),
                        mkFail('Posición del refuerzo incorrecta', 'Refuerzo descentrado', 'Producto fuera de especificación', 'Falla funcional',
                            [mkCause('Falta de plantilla o error de posicionamiento', 'Plantilla de posición, instrucción de trabajo', 'Inspección visual vs plano')]),
                    ]),
                ]),
            ], 'Fijar refuerzos mediante costura conforme a especificación', 'Coser refuerzos en posición correcta'),
            mkOp('OP 90', 'Aplicación de Aplix', [
                mkWe('Man', 'Operador de aplicación', [
                    mkFn('Aplicar Aplix en posiciones según plano', [
                        mkFail('Cantidad incorrecta de Aplix', 'Producto con fijación incompleta', 'Fijación deficiente en ensamble', 'Desprendimiento en uso',
                            [mkCause('Error del operador en conteo', 'Instrucción de trabajo con cantidad especificada', 'Verificación de cantidad por pieza')]),
                        mkFail('Posición incorrecta del Aplix', 'Aplix fuera de zona especificada', 'Interferencia en ensamble', 'Fijación deficiente',
                            [mkCause('Falta de plantilla o error de posicionamiento', 'Plantilla de posición, instrucción de trabajo', 'Inspección visual vs plano')]),
                        mkFail('Aplix no adherido correctamente', 'Aplix se despega en manipulación', 'Falla de fijación', 'Desprendimiento en uso',
                            [mkCause('Superficie contaminada o presión insuficiente', 'Limpieza de superficie, presión documentada', 'Verificación de adherencia manual')]),
                    ]),
                ]),
            ], 'Aplicar Aplix en cantidad y posición correcta', 'Posicionar y adherir Aplix según plano'),
            mkOp('OP 100', 'Control final de calidad', [
                mkWe('Measurement', 'Instrumentos de inspección / Patrón visual', [
                    mkFn('Verificar conformidad total del producto terminado', [
                        mkFail('Defecto de apariencia no detectado', 'Producto no conforme liberado', 'Rechazo visual en cliente', 'Insatisfacción del cliente',
                            [mkCause('Error del inspector o criterio insuficiente', 'Capacitación en criterios de aceptación, patrón visual actualizado', 'Auditoría de producto terminado')]),
                        mkFail('Defecto dimensional no detectado', 'Producto fuera de tolerancia liberado', 'No ensambla en cliente', 'Producto defectuoso',
                            [mkCause('Falta de control dimensional o instrumento inadecuado', 'Instrucción de control con instrumentos especificados', 'Control dimensional con gauge')]),
                        mkFail('Falta de componentes no detectada', 'Producto incompleto liberado', 'Producto no funcional en cliente', 'Reclamo de cliente',
                            [mkCause('Inspector no verifica lista de componentes', 'Lista de verificación obligatoria', 'Control visual vs lista de componentes')]),
                    ]),
                ]),
            ], 'Asegurar que solo producto conforme sea liberado', 'Verificar conformidad visual, dimensional y de componentes'),
            mkOp('OP 120', 'Embalaje y etiquetado', [
                mkWe('Method', 'Procedimiento de embalaje', [
                    mkFn('Embalar, identificar y proteger producto para despacho', [
                        mkFail('Mayor cantidad embalada', 'Diferencia de inventario', 'Cliente recibe cantidad incorrecta', 'Reclamo de cliente por exceso',
                            [mkCause('Error de conteo del operador', 'Instrucción de embalaje con cantidad especificada', 'Verificación de cantidad antes de cerrar')]),
                        mkFail('Menor cantidad embalada', 'Diferencia de inventario', 'Cliente recibe cantidad insuficiente', 'Parada de línea en cliente',
                            [mkCause('Error de conteo del operador', 'Instrucción de embalaje con cantidad especificada', 'Verificación de cantidad antes de cerrar')]),
                        mkFail('Error de identificación en etiqueta', 'Confusión de producto', 'Cliente recibe producto equivocado', 'Reclamo de cliente',
                            [mkCause('Error en carga de datos de etiqueta', 'Procedimiento de etiquetado con verificación cruzada', 'Verificación de etiqueta vs producto')]),
                        mkFail('Falta de identificación', 'Producto sin trazabilidad', 'Cliente no puede identificar producto', 'Rechazo de cliente',
                            [mkCause('Omisión del etiquetado', 'Procedimiento de etiquetado obligatorio', 'Verificación de etiqueta antes de despacho')]),
                    ]),
                ]),
            ], 'Embalar y etiquetar producto conforme para despacho', 'Proteger e identificar producto terminado'),
        ];

        { const amfeDoc2 = { header: mkAmfeHeader('Telas Termoformadas', CL, PN, 'AMFE-2'), operations: ops }; const { error: e5 } = await supabase.from('amfe_documents').upsert({ id: amfeId, amfe_number: 'AMFE-2', project_name: P, data: amfeDoc2, status: 'draft', operation_count: ops.length, cause_count: 0, ap_h_count: 0, ap_m_count: 0, coverage_percent: 0, start_date: '2026-03-14', last_revision_date: '2026-03-14', revisions: [], checksum: '' }); ok(!e5, 'P2-AMFE'); }

        { const pfdDoc2 = {
            id: pfdId,
            header: mkPfdHeader('Telas Termoformadas', PN, CL, 'PFD-TT-001', 'PWA/TELAS_TERMOFORMADAS'),
            steps: [
                mkPfdStep('OP 10', 'storage', 'Recepción de materia prima (tela termoformable, refuerzos, hilos, Aplix)', '', 'Certificado de calidad, flamabilidad', 'Condición del material', 'scrap', 'Material no conforme → Rechazo a proveedor'),
                mkPfdStep('', 'storage', 'Almacenado en sector de materia prima'),
                mkPfdStep('', 'transport', 'Traslado: material aprobado a sector de corte'),
                mkPfdStep('OP 15', 'operation', 'Preparación de corte (tendido y ploteo)', 'Mesa de corte, plotter', 'Calidad del tendido', 'Programa de ploteo', 'rework', 'OP 15'),
                mkPfdStep('OP 20', 'operation', 'Corte de componentes según plano', 'Cortadora / Mesa de corte', 'Dimensiones de corte', 'Velocidad y presión de corte', 'scrap', 'Pieza fuera de dimensión → Scrap'),
                mkPfdStep('OP 30', 'operation', 'Preparación de kits de componentes', '', 'Kit completo y correcto', '', 'rework', 'OP 30'),
                mkPfdStep('', 'inspection', 'Control con Mylar'),
                mkPfdStep('', 'storage', 'Almacenamiento en medios WIP'),
                mkPfdStep('', 'transport', 'Traslado: a termoformado'),
                mkPfdStep('OP 40', 'operation', 'Termoformado de telas (conformado 3D por calor y presión)', 'Termoformadora', 'Forma, espesor, aspecto', 'Temperatura, presión, tiempo', 'scrap', 'Deformación irreversible → Scrap'),
                mkPfdStep('', 'transport', 'Traslado: a corte láser'),
                mkPfdStep('OP 50', 'operation', 'Corte láser de telas termoformadas', 'Cortadora láser', 'Contorno, bordes limpios', 'Potencia, velocidad', 'scrap', 'Corte defectuoso → Scrap'),
                mkPfdStep('', 'transport', 'Traslado: a troquelado'),
                mkPfdStep('OP 60', 'operation', 'Troquelado de refuerzos', 'Troquel / Prensa hidráulica', 'Forma y dimensiones', 'Presión, alineación', 'scrap', 'Forma incorrecta → Scrap'),
                mkPfdStep('OP 70', 'operation', 'Troquelado de Aplix', 'Troquel / Prensa', 'Dimensión de Aplix', 'Alineación troquel', 'scrap', 'Dimensión incorrecta → Scrap'),
                mkPfdStep('', 'storage', 'Almacenamiento en medios WIP'),
                mkPfdStep('', 'transport', 'Traslado: a costura'),
                mkPfdStep('OP 80', 'operation', 'Costura de refuerzos', 'Máquina de coser industrial', 'Costura, posición refuerzo', 'Tensión de hilo', 'rework', 'OP 80'),
                mkPfdStep('OP 90', 'operation', 'Aplicación de Aplix', '', 'Cantidad, posición, adherencia', '', 'rework', 'OP 90'),
                mkPfdStep('', 'transport', 'Traslado: a control final'),
                mkPfdStep('OP 100', 'inspection', 'Control final de calidad', 'Patrón visual, instrumentos', 'Aspecto, dimensiones, componentes', '', 'sort', ''),
                mkPfdStep('OP 120', 'storage', 'Embalaje y etiquetado de producto terminado', 'Caja, film, etiquetadora', 'Identificación, cantidad', 'Protección adecuada', 'rework', 'OP 120'),
            ],
            createdAt: '2026-03-14T12:00:00.000Z', updatedAt: '2026-03-14T12:00:00.000Z',
        }; const { error: e6 } = await supabase.from('pfd_documents').upsert({ id: pfdId, part_name: 'Telas Termoformadas', part_number: PN, data: { header: pfdDoc2.header, steps: pfdDoc2.steps }, created_at: pfdDoc2.createdAt, updated_at: pfdDoc2.updatedAt }); ok(!e6, 'P2-PFD'); }

        { const cpDoc2 = {
            header: mkCpHeader('Telas Termoformadas', PN, CL, 'CP-TT-001', P),
            items: [
                mkCpItem('OP 10', 'Recepción de materia prima', '', 'Identificación del material', '', 'Coincide con OC y ficha técnica', 'Visual vs remito', '100%', 'Cada recepción', 'Registro de recepción', 'Separar y verificar con compras'),
                mkCpItem('OP 10', 'Recepción de materia prima', '', 'Estado del material', '', 'Sin daños, manchas ni arrugas', 'Visual', '1 rollo', 'Cada recepción', 'Registro de recepción', 'Rechazar y notificar proveedor'),
                mkCpItem('OP 10', 'Recepción de materia prima', '', 'Flamabilidad', '', 'Según norma del cliente', 'Certificado de flamabilidad', 'Por certificado', 'Cada lote de material', 'Certificado proveedor + ensayo periódico', 'Rechazar lote, notificar proveedor', 'CC'),
                mkCpItem('OP 10', 'Recepción de materia prima', '', 'Gramaje refuerzo 600 g/m2', '', '600 g/m2 ±TBD%', 'Balanza / Certificado', 'Por certificado', 'Cada lote', 'Registro de recepción', 'Rechazar lote, notificar proveedor'),
                mkCpItem('OP 10', 'Recepción de materia prima', '', 'Gramaje refuerzo 1500 g/m2', '', '1500 g/m2 ±TBD%', 'Balanza / Certificado', 'Por certificado', 'Cada lote', 'Registro de recepción', 'Rechazar lote, notificar proveedor'),
                mkCpItem('OP 15', 'Preparación de corte', 'Mesa de corte, plotter', 'Calidad del tendido', 'Programa de ploteo', 'Tela sin arrugas ni tensión desigual', 'Visual', '100%', 'Cada tendido', 'Verificación de tendido', 'Re-tender tela'),
                mkCpItem('OP 20', 'Corte de componentes', 'Cortadora', 'Dimensiones de corte', 'Velocidad de corte', '±2mm vs plano', 'Cinta métrica / plantilla', '5 pzas', 'Inicio lote', 'Control dimensional', 'Ajustar cortadora y re-cortar'),
                mkCpItem('OP 30', 'Preparación de kits', '', 'Kit completo', '', 'Todos los componentes según lista', 'Visual vs lista', '100%', 'Cada kit', 'Lista de componentes', 'Completar kit antes de liberar'),
                mkCpItem('OP 40', 'Termoformado', 'Termoformadora', 'Forma 3D', 'Temperatura', 'Conforme a plano, T=TBD°C ±5°C', 'Gauge + termocupla', '3 pzas', 'Inicio + c/hora', 'SPC de temperatura', 'Ajustar parámetros, retener lote'),
                mkCpItem('OP 40', 'Termoformado', 'Termoformadora', 'Espesor', 'Tiempo ciclo', 'TBD mm ±0.2mm', 'Micrómetro', '1 pza', 'C/hora', 'Registro de espesor', 'Ajustar tiempo de calentamiento'),
                mkCpItem('OP 40', 'Termoformado', 'Termoformadora', 'Aspecto superficial', '', 'Sin arrugas ni burbujas', 'Visual', '100%', 'Cada pieza', 'Inspección visual', 'Separar, ajustar proceso'),
                mkCpItem('OP 50', 'Corte láser', 'Cortadora láser', 'Contorno de corte', 'Potencia y velocidad', 'Conforme a plano', 'Control dimensional con plantilla', '5 pzas', 'Inicio lote', 'Control de contorno', 'Ajustar programa'),
                mkCpItem('OP 60', 'Troquelado de refuerzos', 'Troquel / Prensa', 'Forma troquelada', 'Presión de prensa', 'Conforme a plano', 'Gauge', '5 pzas', 'Inicio + c/50 pzas', 'Control con gauge', 'Cambiar troquel, separar lote'),
                mkCpItem('OP 70', 'Troquelado de Aplix', 'Troquel / Prensa', 'Dimensión de Aplix', 'Alineación troquel', 'Conforme a plano', 'Control dimensional', '5 pzas', 'Inicio lote', 'Control dimensional', 'Ajustar troquel'),
                mkCpItem('OP 80', 'Costura de refuerzos', 'Máquina de coser', 'Costura continua sin saltos', 'Tensión de hilo', 'Sin costuras salteadas ni flojas', 'Visual', '100%', 'Cada pieza', 'Inspección en proceso', 'Ajustar máquina, separar sospechosas'),
                mkCpItem('OP 80', 'Costura de refuerzos', 'Máquina de coser', 'Posición del refuerzo', '', 'Conforme a plano (±TBD mm)', 'Visual vs plano', '100%', 'Cada pieza', 'Inspección visual', 'Reposicionar y re-coser'),
                mkCpItem('OP 90', 'Aplicación de Aplix', '', 'Cantidad de Aplix', '', 'Según especificación por pieza', 'Visual vs instrucción', '100%', 'Cada pieza', 'Inspección visual', 'Completar cantidad faltante'),
                mkCpItem('OP 90', 'Aplicación de Aplix', '', 'Posición y adherencia de Aplix', '', 'Conforme a plano (±2mm), adherido', 'Visual vs plano + verificación manual', '100%', 'Cada pieza', 'Inspección visual', 'Reposicionar o reemplazar Aplix'),
                mkCpItem('OP 100', 'Control final de calidad', 'Patrón visual, instrumentos', 'Aspecto visual general', '', 'Sin defectos según patrón', 'Visual vs patrón', '100%', 'Cada pieza', 'Inspección final', 'Separar NOK, notificar calidad'),
                mkCpItem('OP 100', 'Control final de calidad', 'Cinta métrica / gauge', 'Dimensiones generales', '', '±2mm vs plano', 'Cinta métrica / gauge', '5 pzas', 'Cada lote', 'Planilla dimensional', 'Retener lote, verificar proceso'),
                mkCpItem('OP 120', 'Embalaje y etiquetado', 'Etiquetadora', 'Cantidad embalada', '', 'Según orden de producción', 'Conteo', '100%', 'Cada caja', 'Verificación de cantidad', 'Corregir cantidad'),
                mkCpItem('OP 120', 'Embalaje y etiquetado', 'Etiquetadora', 'Identificación (etiqueta)', '', 'Etiqueta correcta (código, cant., lote)', 'Visual', '100%', 'Cada caja', 'Verificación de etiqueta', 'Corregir etiqueta'),
            ],
        }; const { error: e7 } = await supabase.from('cp_documents').upsert({ id: cpId, project_name: P, linked_amfe_id: amfeId, data: cpDoc2,  }); ok(!e7, 'P2-CP'); }

        { const hoDoc2 = {
            header: mkHoHeader(CL, PN, 'Telas Termoformadas', P, P),
            sheets: [
                mkHoSheet(ops[0].id, 'OP 10', 'Recepción de materia prima', ['guantes', 'zapatos'], [
                    { d: 'Recibir material, verificar remito vs OC' },
                    { d: 'Inspeccionar visualmente el material (sin daños, manchas, arrugas)', k: true, r: 'Detectar material no conforme antes de ingresar al proceso' },
                    { d: 'Verificar identificación del material contra ficha técnica' },
                    { d: 'Registrar recepción en planilla' },
                    { d: 'Almacenar con identificación de lote en sector de MP' },
                ]),
                mkHoSheet(ops[1].id, 'OP 15', 'Preparación de corte', ['guantes', 'zapatos'], [
                    { d: 'Verificar que la tela está en condiciones (sin defectos visibles)' },
                    { d: 'Tender tela sobre mesa de corte sin arrugas ni tensión desigual', k: true, r: 'Tendido correcto para corte preciso' },
                    { d: 'Cargar programa de ploteo y verificar que corresponde al plano vigente' },
                    { d: 'Ejecutar ploteo del patrón sobre la tela' },
                ]),
                mkHoSheet(ops[2].id, 'OP 20', 'Corte de componentes', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar calibración de cortadora y estado de cuchilla' },
                    { d: 'Posicionar tela según plantilla', k: true, r: 'Alineación para dimensiones correctas' },
                    { d: 'Ejecutar corte según programa/plantilla' },
                    { d: 'Verificar dimensiones de las primeras 5 piezas contra plano' },
                    { d: 'Separar piezas cortadas e identificar lote' },
                ]),
                mkHoSheet(ops[3].id, 'OP 30', 'Preparación de kits', ['guantes', 'zapatos'], [
                    { d: 'Consultar lista de componentes para el producto a armar' },
                    { d: 'Seleccionar y verificar cada componente del kit', k: true, r: 'Kit completo y correcto para evitar paradas' },
                    { d: 'Armar kit en bandeja identificada' },
                    { d: 'Verificar kit armado vs lista de componentes' },
                ]),
                mkHoSheet(ops[4].id, 'OP 40', 'Termoformado', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar temperatura de termoformadora según receta' },
                    { d: 'Cargar material en molde asegurando distribución uniforme', k: true, r: 'Evitar arrugas y variación de espesor' },
                    { d: 'Ejecutar ciclo de termoformado' },
                    { d: 'Retirar pieza y verificar forma visualmente' },
                    { d: 'Medir espesor con micrómetro según frecuencia' },
                ]),
                mkHoSheet(ops[5].id, 'OP 50', 'Corte láser', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar programa de corte láser vs plano vigente' },
                    { d: 'Posicionar pieza termoformada en fixture', k: true, r: 'Alineación correcta para contorno conforme' },
                    { d: 'Ejecutar ciclo de corte láser' },
                    { d: 'Verificar contorno con plantilla' },
                    { d: 'Inspeccionar bordes (sin quemaduras ni marcas)' },
                ]),
                mkHoSheet(ops[6].id, 'OP 60', 'Troquelado de refuerzos', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar estado del troquel (sin desgaste, sin daños)' },
                    { d: 'Posicionar refuerzo en troquel', k: true, r: 'Centrado correcto para forma conforme' },
                    { d: 'Accionar prensa según parámetros de proceso' },
                    { d: 'Retirar refuerzo troquelado y verificar con gauge' },
                ]),
                mkHoSheet(ops[7].id, 'OP 70', 'Troquelado de Aplix', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar estado del troquel de Aplix' },
                    { d: 'Posicionar Aplix en troquel', k: true, r: 'Dimensión correcta para fijación' },
                    { d: 'Accionar prensa de corte' },
                    { d: 'Verificar dimensión del Aplix troquelado' },
                ]),
                mkHoSheet(ops[8].id, 'OP 80', 'Costura de refuerzos', ['anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar tipo de hilo y tensión de la máquina de coser' },
                    { d: 'Posicionar refuerzo en la pieza según plantilla', k: true, r: 'Posición correcta para funcionalidad del producto' },
                    { d: 'Ejecutar costura según instrucción de trabajo' },
                    { d: 'Inspeccionar costura (sin saltos, tensión correcta)' },
                ]),
                mkHoSheet(ops[9].id, 'OP 90', 'Aplicación de Aplix', ['guantes', 'zapatos'], [
                    { d: 'Verificar que la superficie está limpia y seca' },
                    { d: 'Posicionar Aplix usando plantilla de referencia', k: true, r: 'Posición y cantidad correcta para fijación' },
                    { d: 'Presionar cada Aplix con firmeza para asegurar adherencia' },
                    { d: 'Verificar cantidad y posición vs plano' },
                ]),
                mkHoSheet(ops[10].id, 'OP 100', 'Control final de calidad', ['anteojos', 'zapatos'], [
                    { d: 'Tomar pieza del buffer de producción' },
                    { d: 'Inspeccionar aspecto visual comparando con patrón de referencia', k: true, r: 'Detectar todos los defectos visuales' },
                    { d: 'Verificar dimensiones con cinta métrica/gauge' },
                    { d: 'Verificar presencia de todos los componentes (refuerzos, Aplix)' },
                    { d: 'Registrar resultado en planilla de control final' },
                    { d: 'Separar piezas OK y NOK en contenedores identificados' },
                ]),
                mkHoSheet(ops[11].id, 'OP 120', 'Embalaje y etiquetado', ['guantes', 'zapatos'], [
                    { d: 'Verificar que las piezas pasaron control final (etiqueta verde)' },
                    { d: 'Contar piezas y verificar cantidad vs orden de producción', k: true, r: 'Cantidad correcta para evitar reclamos' },
                    { d: 'Colocar piezas en caja según instrucción de embalaje' },
                    { d: 'Completar etiqueta con código de pieza, cantidad, lote, fecha' },
                    { d: 'Verificar etiqueta vs producto antes de cerrar' },
                    { d: 'Cerrar caja y posicionar en zona de despacho' },
                ]),
            ],
        }; const { error: e8 } = await supabase.from('ho_documents').upsert({ id: hoId, linked_amfe_project: P, linked_amfe_id: amfeId, linked_cp_id: cpId, data: hoDoc2,  }); ok(!e8, 'P2-HO'); }
        log.push(`Product 2: ${P} - PFD + AMFE + CP + HO created`);
    }

    // ========================================================================
    // PRODUCT 3: ARMREST DOOR PANEL PATAGONIA (VWA)
    // ========================================================================
    {
        const P = 'Armrest Door Panel Patagonia';
        const PN = 'TBD-ARM-PAT';
        const CL = 'VWA';
        const amfeId = uid(), cpId = uid(), pfdId = uid(), hoId = uid();

        const ops = [
            mkOp('OP 10', 'Recepción de materia prima', [
                mkWe('Material', 'Cuero/Vinilo, sustrato, adhesivo, hilo', [
                    mkFn('Recibir materiales conforme a especificación', [
                        mkFail('Material fuera de especificación (color, gramaje, espesor)', 'Producción detenida', 'Diferencia de color vs muestra', 'Aspecto visual inaceptable',
                            [mkCause('Proveedor envía lote fuera de tolerancia', 'Acuerdo de calidad con proveedor, certificado por lote', 'Inspección de recepción: color, gramaje, espesor')]),
                    ]),
                ]),
                mkWe('Machine', 'Autoelevador / Zorra hidráulica', [
                    mkFn('Transportar material recibido a zona de almacén de forma segura.', []),
                ]),
                mkWe('Man', 'Operador de recepción / Calidad', [
                    mkFn('Verificar documentación y estado del material recibido. Registrar en sistema.', []),
                ]),
                mkWe('Measurement', 'Calibres / Balanza / Cinta métrica', [
                    mkFn('Medir gramaje, espesor y verificar color contra muestra aprobada.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones / Ayudas visuales de recepción', [
                    mkFn('Definir criterios de aceptación y secuencia de verificación de materiales.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de materiales.', []),
                ]),
            ], 'Asegurar la conformidad de la calidad y cantidad de material recibido', 'Garantizar la estabilidad y la integridad física del material durante el transporte interno'),
            mkOp('OP 20', 'Corte de cuero/vinilo', [
                mkWe('Machine', 'Cortadora CNC / Mesa de corte', [
                    mkFn('Cortar material de recubrimiento a medida', [
                        mkFail('Dimensiones fuera de tolerancia', 'Pieza no conforme', 'No tapiza correctamente', 'Aspecto deficiente',
                            [mkCause('Programa de corte desactualizado o error de setup', 'Verificación de programa antes de inicio', 'Control dimensional con plantilla')]),
                        mkFail('Daño en superficie del material', 'Scrap de materia prima costosa', 'Defecto visual', 'Cliente insatisfecho',
                            [mkCause('Superficie de mesa contaminada o herramienta dañada', 'Limpieza de mesa, MP de herramientas', 'Inspección visual 100%')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de corte', [
                    mkFn('Operar la cortadora según instrucción de trabajo. Verificar primera pieza.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de corte', [
                    mkFn('Definir programa de corte, secuencia y criterios de verificación dimensional.', []),
                ]),
                mkWe('Material', 'Cuchillas / Regla / Plantillas', [
                    mkFn('Proveer herramientas de corte en buen estado para operación conforme.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de corte.', []),
                ]),
            ], 'Proveer material cortado conforme a requerimientos dimensionales y de trazabilidad', 'Lograr el contorno/forma geométrica del patrón conforme al modelo/plano'),
            mkOp('OP 30', 'Refilado', [
                mkWe('Machine', 'Refiladora / Herramienta de corte', [
                    mkFn('Eliminar exceso de material en bordes', [
                        mkFail('Exceso de material remanente', 'No ensambla correctamente', 'Interferencia en montaje', 'Producto defectuoso',
                            [mkCause('Desgaste de cuchilla de refilado', 'MP de cuchillas, control de filo', 'Inspección visual de bordes')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de refilado', [
                    mkFn('Operar la refiladora según instrucción de trabajo. Verificar bordes.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de refilado', [
                    mkFn('Definir técnica de refilado y criterios de aceptación de bordes.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección de bordes.', []),
                ]),
            ], 'Proveer piezas refiladas conformes a especificación dimensional', 'Eliminar material excedente manteniendo la geometría de la pieza'),
            mkOp('OP 40', 'Costura', [
                mkWe('Machine', 'Máquina de coser industrial', [
                    mkFn('Unir piezas de recubrimiento mediante costura decorativa y estructural', [
                        mkFail('Costura desalineada o irregular', 'Defecto visual', 'Rechazo por apariencia', 'Aspecto inaceptable para cliente final',
                            [mkCause('Guía de costura incorrecta o desgastada', 'Verificación de guía en setup, IT documentada', 'Inspección visual en proceso')]),
                        mkFail('Puntadas saltadas o rotas', 'Costura débil', 'Desprendimiento en uso', 'Falla funcional',
                            [mkCause('Aguja desgastada o tensión incorrecta', 'Cambio de aguja programado, control de tensión', 'Inspección visual + ensayo de tracción')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de costura decorativa', [
                    mkFn('Mantener calidad de costura decorativa visible al cliente', [
                        mkFail('Costura irregular por manipulación incorrecta', 'Defecto visual en costura decorativa', 'Rechazo por apariencia', 'Aspecto no premium',
                            [mkCause('Operador inexperto en costura decorativa VWA', 'Capacitación en costura decorativa, matriz de habilidades', 'Inspección visual 100%')]),
                    ]),
                ]),
                mkWe('Method', 'Hoja de operaciones de costura', [
                    mkFn('Definir patrón de costura, tensión de hilo y secuencia de trabajo.', []),
                ]),
                mkWe('Material', 'Hilo / Aguja / Bobina', [
                    mkFn('Proveer insumos de costura conformes a especificación (tipo, color, calibre).', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para costura decorativa.', []),
                ]),
            ], 'Unir componentes mediante costura conforme a patrón y especificación', 'Realizar costura según patrón validado'),
            mkOp('OP 50', 'Inyección de sustrato', [
                mkWe('Machine', 'Inyectora', [
                    mkFn('Inyectar sustrato plástico para estructura del armrest', [
                        mkFail('Pieza incompleta (short shot)', 'Pieza descartada', 'Falta de rigidez', 'Producto no funcional',
                            [mkCause('Presión de inyección insuficiente o material frío', 'Parámetros de inyección documentados, control SPC', 'Inspección visual + control de peso')]),
                        mkFail('Rebabas excesivas', 'Retrabajo de desbarbado', 'Dificultad de ensamble', 'Posible corte al usuario',
                            [mkCause('Desgaste de molde o fuerza de cierre insuficiente', 'MP de molde, control de fuerza de cierre', 'Inspección visual 100%')]),
                        mkFail('Alabeo/deformación', 'Pieza no ensambla', 'Rechazo dimensional', 'Gap visible en vehículo',
                            [mkCause('Enfriamiento desigual o tiempo de ciclo inadecuado', 'Receta de proceso optimizada', 'Control dimensional con gauge')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de inyección', [
                    mkFn('Operar inyectora según receta de proceso. Verificar piezas y registrar datos.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de inyección', [
                    mkFn('Definir parámetros de inyección, secuencia de arranque y controles en proceso.', []),
                ]),
                mkWe('Material', 'Resina / Materia prima plástica', [
                    mkFn('Proveer material plástico conforme a especificación (grado, humedad, MFI).', []),
                ]),
                mkWe('Environment', 'Temperatura ambiente - Ley 19587', [
                    mkFn('Mantener condiciones ambientales controladas para estabilidad del proceso de inyección.', []),
                ]),
            ], 'Proveer sustrato inyectado con geometría y propiedades mecánicas conformes', 'Inyectar sustrato según parámetros de proceso validados'),
            mkOp('OP 60', 'Adhesivado', [
                mkWe('Method', 'Proceso de aplicación de adhesivo', [
                    mkFn('Aplicar adhesivo para unión recubrimiento-sustrato', [
                        mkFail('Adherencia insuficiente', 'Desprendimiento del recubrimiento', 'Desprendimiento en uso del vehículo', 'Reclamo de garantía',
                            [mkCause('Cantidad de adhesivo insuficiente o superficie contaminada', 'Dosificación controlada, limpieza de superficies', 'Ensayo de pelado periódico')]),
                        mkFail('Exceso de adhesivo visible', 'Defecto visual', 'Manchas visibles', 'Aspecto no aceptable',
                            [mkCause('Dosificación excesiva', 'Control de gramaje de adhesivo', 'Inspección visual')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de adhesivado', [
                    mkFn('Aplicar adhesivo según instrucción de trabajo. Verificar dosificación.', []),
                ]),
                mkWe('Material', 'Adhesivo / Solvente de limpieza', [
                    mkFn('Proveer adhesivo dentro de vida útil y condiciones de almacenamiento correctas.', []),
                ]),
                mkWe('Environment', 'Temperatura y ventilación - Ley 19587', [
                    mkFn('Mantener condiciones ambientales adecuadas para aplicación y curado de adhesivo.', []),
                ]),
            ], 'Asegurar adherencia entre materiales según especificación', 'Aplicar adhesivo en cantidades y zonas especificadas'),
            mkOp('OP 70', 'Tapizado', [
                mkWe('Man', 'Operador de tapizado', [
                    mkFn('Recubrir sustrato con material de cuero/vinilo', [
                        mkFail('Arrugas en recubrimiento', 'Defecto visual', 'Rechazo por apariencia', 'Aspecto inaceptable',
                            [mkCause('Tensión insuficiente del material durante tapizado', 'Instrucción de trabajo con técnica de tensión', 'Inspección visual 100%')]),
                        mkFail('Desalineación del recubrimiento', 'Pieza no conforme', 'Costuras descentradas visible', 'Aspecto no profesional',
                            [mkCause('Posicionamiento incorrecto del recubrimiento', 'Marcas de referencia en sustrato', 'Inspección visual vs patrón')]),
                    ]),
                ]),
                mkWe('Method', 'Hoja de operaciones de tapizado', [
                    mkFn('Definir técnica de tensado, secuencia de fijación y criterios visuales.', []),
                ]),
                mkWe('Material', 'Cuero/Vinilo cortado y cosido', [
                    mkFn('Proveer recubrimiento conforme a especificación dimensional y visual.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección de tapizado.', []),
                ]),
            ], 'Cubrir sustrato con material de terminación conforme a patrón', 'Tapizar manteniendo tensión uniforme y sin arrugas'),
            mkOp('OP 80', 'Control final e inspección', [
                mkWe('Measurement', 'Instrumentos de inspección, patrón', [
                    mkFn('Verificar conformidad visual, dimensional y funcional', [
                        mkFail('Liberación de producto no conforme', 'Costo de retrabajo/scrap', 'Reclamo de VWA', 'Riesgo de imagen de marca',
                            [mkCause('Error de inspección, criterio ambiguo', 'Patrón visual actualizado, capacitación', 'Auditoría de producto terminado')]),
                    ]),
                ]),
                mkWe('Man', 'Inspector de calidad', [
                    mkFn('Ejecutar inspección visual y dimensional según plan de control.', []),
                ]),
                mkWe('Method', 'Plan de control / Criterios de aceptación VWA', [
                    mkFn('Definir criterios de aceptación, frecuencia y método de inspección.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para detección de defectos.', []),
                ]),
            ], 'Verificar conformidad total del producto terminado', 'Inspeccionar contra criterios de aceptación del cliente'),
            mkOp('OP 90', 'Embalaje y despacho', [
                mkWe('Method', 'Procedimiento de embalaje VDA', [
                    mkFn('Embalar según requerimientos VWA', [
                        mkFail('Daño en transporte por embalaje inadecuado', 'Scrap de producto terminado', 'Rechazo en recepción VWA', 'Línea de VWA detenida',
                            [mkCause('No cumplimiento de instrucción de embalaje', 'Instrucción de embalaje VDA, capacitación', 'Verificación de embalaje antes de despacho')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de embalaje', [
                    mkFn('Embalar y etiquetar producto según instrucción VDA.', []),
                ]),
                mkWe('Material', 'Cajas / Film / Etiquetas VDA', [
                    mkFn('Proveer materiales de embalaje conformes a requerimiento VWA.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para verificación de embalaje.', []),
                ]),
            ], 'Proteger y despachar producto conforme a requerimientos logísticos', 'Embalar e identificar producto para transporte seguro'),
        ];

        ok(await saveAmfeDocument(amfeId, 'AMFE-3', P, { header: mkAmfeHeader('Armrest Door Panel', CL, PN, 'AMFE-3'), operations: ops }, 'draft'), 'P3-AMFE');

        ok(await savePfdDocument(pfdId, {
            id: pfdId,
            header: mkPfdHeader('Armrest Door Panel', PN, CL, 'PFD-ARM-001', 'VWA/PATAGONIA/ARMREST_DOOR_PANEL'),
            steps: [
                mkPfdStep('OP 10', 'storage', 'Recepción MP (cuero/vinilo, sustrato, adhesivo, hilo)', '', 'Color, gramaje, espesor', '', 'scrap', 'Material no conforme → Rechazo a proveedor'),
                mkPfdStep('OP 20', 'operation', 'Corte de cuero/vinilo', 'Cortadora CNC', 'Dimensiones, aspecto superficie', 'Programa CNC', 'scrap', 'Corte incorrecto en material costoso → Scrap'),
                mkPfdStep('OP 30', 'operation', 'Refilado de bordes', 'Refiladora', 'Bordes limpios', 'Filo de cuchilla', 'rework', 'OP 30'),
                mkPfdStep('OP 40', 'operation', 'Costura decorativa y estructural', 'Máquina de coser industrial', 'Alineación, resistencia costura', 'Tensión, velocidad', 'rework', 'OP 40'),
                mkPfdStep('OP 50', 'operation', 'Inyección de sustrato plástico', 'Inyectora', 'Peso, dimensiones, ausencia de defectos', 'Presión, temperatura, tiempo ciclo', 'scrap', 'Short shot / deformación → Scrap (regrind)'),
                mkPfdStep('OP 60', 'operation', 'Adhesivado de recubrimiento a sustrato', 'Equipo de adhesivado', 'Adherencia', 'Gramaje adhesivo, limpieza superficie', 'rework', 'OP 60'),
                mkPfdStep('OP 70', 'operation', 'Tapizado (recubrimiento del sustrato)', 'Mesa de tapizado', 'Sin arrugas, alineación correcta', 'Tensión del material', 'rework', 'OP 70'),
                mkPfdStep('OP 80', 'inspection', 'Control final e inspección', 'Patrón, gauge, instrumentos', 'Aspecto, dimensiones, funcionalidad', '', 'sort', ''),
                mkPfdStep('OP 90', 'storage', 'Embalaje VDA y despacho', 'Contenedor VDA', 'Identificación VWA correcta', 'Protección adecuada', 'rework', 'OP 90'),
            ],
            createdAt: '2026-03-14T12:00:00.000Z', updatedAt: '2026-03-14T12:00:00.000Z',
        }), 'P3-PFD');

        ok(await saveCpDocument(cpId, P, {
            header: mkCpHeader('Armrest Door Panel', PN, CL, 'CP-ARM-001', P),
            items: [
                mkCpItem('OP 10', 'Recepción MP', '', 'Color del material', '', 'Conforme a muestra aprobada', 'Visual vs muestra', '1 rollo', 'Cada lote', 'Registro de recepción', 'Rechazar lote', 'SC'),
                mkCpItem('OP 10', 'Recepción MP', '', 'Gramaje', '', 'TBD g/m² ±5%', 'Balanza', '1 muestra', 'Cada lote', 'Registro de recepción', 'Rechazar y notificar proveedor'),
                mkCpItem('OP 20', 'Corte', 'Cortadora CNC', 'Dimensiones de corte', 'Programa CNC', '±1.5mm vs plano', 'Cinta métrica / plantilla', '5 pzas', 'Inicio lote', 'Control dimensional', 'Ajustar programa, re-cortar'),
                mkCpItem('OP 30', 'Refilado', 'Refiladora', 'Bordes limpios', 'Estado de cuchilla', 'Sin rebabas, sin exceso', 'Visual + tacto', '100%', 'Cada pieza', 'Inspección visual', 'Refilar manualmente'),
                mkCpItem('OP 40', 'Costura', 'Máquina de coser', 'Alineación costura', 'Tensión hilo', '±1mm vs referencia', 'Visual + regla', '5 pzas', 'Inicio turno + c/hora', 'Inspección en proceso', 'Ajustar guía, retener'),
                mkCpItem('OP 50', 'Inyección', 'Inyectora', 'Peso de pieza', 'Presión inyección', 'TBD g ±2%', 'Balanza', '5 pzas', 'Inicio + c/hora', 'SPC de peso', 'Ajustar parámetros', 'CC'),
                mkCpItem('OP 50', 'Inyección', 'Inyectora', 'Dimensiones críticas', 'Temp. molde', '±0.3mm vs plano', 'Gauge/CMM', '3 pzas', 'Inicio turno', 'Control dimensional', 'Ajustar proceso, retener lote', 'CC'),
                mkCpItem('OP 50', 'Inyección', 'Inyectora', 'Aspecto visual (sin rebabas, marcas)', '', 'Sin defectos visibles', 'Visual', '100%', 'Cada pieza', 'Inspección visual', 'Separar, mantenimiento molde'),
                mkCpItem('OP 60', 'Adhesivado', 'Equipo adhesivado', 'Adherencia', 'Gramaje adhesivo', 'Min. TBD N (ensayo pelado)', 'Ensayo de pelado', '1 pza', '1x turno', 'Registro de ensayo', 'Detener, revisar proceso', 'SC'),
                mkCpItem('OP 70', 'Tapizado', 'Mesa tapizado', 'Ausencia de arrugas', 'Tensión del material', 'Sin arrugas visibles', 'Visual vs patrón', '100%', 'Cada pieza', 'Inspección visual', 'Retapizar o separar'),
                mkCpItem('OP 70', 'Tapizado', 'Mesa tapizado', 'Alineación del recubrimiento', '', 'Costuras centradas, simétrico', 'Visual vs patrón', '100%', 'Cada pieza', 'Inspección visual', 'Reposicionar o separar'),
                mkCpItem('OP 80', 'Control final', 'Patrón, gauge', 'Aspecto visual general', '', 'Conforme a patrón VWA', 'Visual vs patrón', '100%', 'Cada pieza', 'Inspección final', 'Separar NOK, notificar calidad', 'CC'),
                mkCpItem('OP 80', 'Control final', 'CMM / gauge', 'Dimensiones funcionales', '', '±0.5mm vs plano', 'Gauge / CMM', '5 pzas', 'Cada lote', 'Planilla dimensional', 'Retener lote'),
                mkCpItem('OP 90', 'Embalaje', 'Contenedor VDA', 'Identificación VWA', '', 'Etiqueta VDA correcta', 'Visual', '100%', 'Cada contenedor', 'Check embalaje VDA', 'Corregir identificación'),
            ],
        }, amfeId), 'P3-CP');

        ok(await saveHoDocument(hoId, {
            header: mkHoHeader(CL, PN, 'Armrest Door Panel', P, P),
            sheets: [
                mkHoSheet(ops[0].id, 'OP 10', 'Recepción de materia prima', ['guantes', 'zapatos'], [
                    { d: 'Verificar remito vs orden de compra' },
                    { d: 'Inspeccionar color vs muestra aprobada', k: true, r: 'El color es característica SC para VWA' },
                    { d: 'Verificar gramaje y espesor según especificación' },
                    { d: 'Registrar en planilla de recepción y almacenar' },
                ]),
                mkHoSheet(ops[1].id, 'OP 20', 'Corte de cuero/vinilo', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar programa CNC y estado de herramienta' },
                    { d: 'Posicionar material en mesa de corte', k: true, r: 'Orientación del grano del cuero' },
                    { d: 'Ejecutar programa de corte' },
                    { d: 'Verificar dimensiones de primeras piezas' },
                    { d: 'Inspeccionar superficie por daños' },
                ]),
                mkHoSheet(ops[2].id, 'OP 30', 'Refilado', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar estado de cuchilla de refilado' },
                    { d: 'Refilar bordes según referencia', k: true, r: 'Exceso causa interferencia en ensamble' },
                    { d: 'Verificar bordes limpios' },
                ]),
                mkHoSheet(ops[3].id, 'OP 40', 'Costura', ['anteojos', 'zapatos'], [
                    { d: 'Verificar tensión de hilo y estado de aguja' },
                    { d: 'Posicionar piezas en guía de costura', k: true, r: 'Costura decorativa visible al cliente' },
                    { d: 'Ejecutar costura según patrón' },
                    { d: 'Inspeccionar alineación y resistencia' },
                ]),
                mkHoSheet(ops[4].id, 'OP 50', 'Inyección de sustrato', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar parámetros de inyectora según receta' },
                    { d: 'Verificar limpieza de molde y aplicar desmoldante si aplica' },
                    { d: 'Ejecutar ciclo de inyección', k: true, r: 'Parámetros críticos: presión, temperatura, tiempo' },
                    { d: 'Retirar pieza y verificar visualmente (sin short shot, sin rebabas)' },
                    { d: 'Pesar pieza y registrar en SPC' },
                ]),
                mkHoSheet(ops[5].id, 'OP 60', 'Adhesivado', ['guantes', 'anteojos', 'zapatos', 'respirador'], [
                    { d: 'Preparar superficies: limpiar sustrato y recubrimiento' },
                    { d: 'Aplicar adhesivo según gramaje especificado', k: true, r: 'Gramaje correcto para adherencia conforme' },
                    { d: 'Posicionar recubrimiento sobre sustrato' },
                    { d: 'Aplicar presión según procedimiento' },
                ]),
                mkHoSheet(ops[6].id, 'OP 70', 'Tapizado', ['guantes', 'zapatos'], [
                    { d: 'Verificar que sustrato adhesivado está en condición' },
                    { d: 'Posicionar recubrimiento con marcas de referencia alineadas', k: true, r: 'Alineación y tensión uniformes para evitar arrugas' },
                    { d: 'Tensar y fijar recubrimiento' },
                    { d: 'Inspeccionar ausencia de arrugas y alineación' },
                ]),
                mkHoSheet(ops[7].id, 'OP 80', 'Control final', ['anteojos', 'zapatos'], [
                    { d: 'Inspeccionar aspecto visual vs patrón VWA', k: true, r: 'Último punto de control antes del cliente' },
                    { d: 'Verificar dimensiones funcionales con gauge' },
                    { d: 'Registrar en planilla de control final' },
                    { d: 'Separar OK y NOK en contenedores identificados' },
                ]),
                mkHoSheet(ops[8].id, 'OP 90', 'Embalaje VDA', ['guantes', 'zapatos'], [
                    { d: 'Colocar piezas aprobadas en contenedor VDA' },
                    { d: 'Aplicar protección entre capas' },
                    { d: 'Completar etiqueta VDA con datos requeridos' },
                    { d: 'Posicionar en zona de despacho' },
                ]),
            ],
        }, amfeId, cpId), 'P3-HO');
        log.push(`Product 3: ${P} - PFD + AMFE + CP + HO created`);
    }

    // ========================================================================
    // PRODUCT 4: INSERT PATAGONIA (VWA)
    // ========================================================================
    {
        const P = 'Insert Patagonia';
        const PN = 'TBD-INS-PAT';
        const CL = 'VWA';
        const amfeId = uid(), cpId = uid(), pfdId = uid(), hoId = uid();

        const ops = [
            mkOp('OP 10', 'Recepción de materia prima', [
                mkWe('Material', 'Vinilo, sustrato, adhesivo, insertos, hilo', [
                    mkFn('Recibir materiales conforme a especificación VWA', [
                        mkFail('Material fuera de especificación', 'Retraso producción', 'Defecto en producto final', 'Reclamo de garantía',
                            [mkCause('Proveedor entrega material no conforme', 'Certificado de calidad por lote', 'Inspección de recepción')]),
                    ]),
                ]),
                mkWe('Machine', 'Autoelevador / Zorra hidráulica', [
                    mkFn('Transportar material recibido a zona de almacén de forma segura.', []),
                ]),
                mkWe('Man', 'Operador de recepción / Calidad', [
                    mkFn('Verificar documentación y estado del material recibido. Registrar en sistema.', []),
                ]),
                mkWe('Measurement', 'Calibres / Balanza / Cinta métrica', [
                    mkFn('Medir gramaje, espesor y verificar color contra muestra aprobada.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones / Ayudas visuales de recepción', [
                    mkFn('Definir criterios de aceptación y secuencia de verificación de materiales.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de materiales.', []),
                ]),
            ], 'Asegurar la conformidad de la calidad y cantidad de material recibido', 'Garantizar la estabilidad y la integridad física del material durante el transporte interno'),
            mkOp('OP 20', 'Corte de vinilo', [
                mkWe('Machine', 'Cortadora CNC', [
                    mkFn('Cortar vinilo a medida según programa', [
                        mkFail('Dimensiones fuera de tolerancia', 'Pieza no conforme', 'No tapiza correctamente', 'Producto defectuoso',
                            [mkCause('Error de programa o setup', 'Verificación de programa', 'Control dimensional')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de corte', [
                    mkFn('Operar la cortadora CNC según instrucción de trabajo. Verificar primera pieza.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de corte', [
                    mkFn('Definir programa de corte, secuencia y criterios de verificación dimensional.', []),
                ]),
                mkWe('Material', 'Cuchillas / Regla / Plantillas', [
                    mkFn('Proveer herramientas de corte en buen estado para operación conforme.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de corte.', []),
                ]),
            ], 'Proveer material cortado conforme a requerimientos dimensionales y de trazabilidad', 'Lograr el contorno/forma geométrica del patrón conforme al modelo/plano'),
            mkOp('OP 30', 'Refilado', [
                mkWe('Machine', 'Refiladora', [
                    mkFn('Eliminar exceso de material', [
                        mkFail('Bordes irregulares', 'Pieza no conforme', 'Interferencia en montaje', 'Producto defectuoso',
                            [mkCause('Cuchilla desgastada', 'MP de cuchillas', 'Inspección visual de bordes')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de refilado', [
                    mkFn('Operar la refiladora según instrucción de trabajo. Verificar bordes.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de refilado', [
                    mkFn('Definir técnica de refilado y criterios de aceptación de bordes.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección de bordes.', []),
                ]),
            ], 'Proveer piezas refiladas conformes a especificación dimensional', 'Eliminar material excedente manteniendo la geometría de la pieza'),
            mkOp('OP 40', 'Costura CNC', [
                mkWe('Machine', 'Máquina de costura CNC', [
                    mkFn('Realizar costura automatizada de precisión', [
                        mkFail('Patrón de costura incorrecto', 'Defecto visual crítico', 'Rechazo por VWA', 'Aspecto inaceptable',
                            [mkCause('Programa de costura erróneo o desactualizado', 'Verificación de programa vs plano', 'Inspección visual 100% + comparación con muestra')]),
                        mkFail('Rotura de hilo durante costura', 'Pieza con costura incompleta', 'Costura débil', 'Falla funcional',
                            [mkCause('Hilo defectuoso o tensión excesiva', 'Control de calidad de hilo, parámetros documentados', 'Detector automático de rotura + inspección visual')]),
                    ]),
                ]),
                mkWe('Method', 'Programa y parámetros CNC', [
                    mkFn('Gestionar programa CNC y parámetros de costura', [
                        mkFail('Programa desactualizado cargado en máquina', 'Patrón de costura no corresponde a la revisión vigente', 'Rechazo por VWA', 'Producto no conforme',
                            [mkCause('Falta de control de versiones de programas', 'Procedimiento de gestión de programas CNC, backup', 'Verificación de versión vs plano antes de inicio')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de costura CNC', [
                    mkFn('Operar la máquina de costura CNC. Cargar piezas y verificar patrón.', []),
                ]),
                mkWe('Material', 'Hilo / Aguja / Bobina', [
                    mkFn('Proveer insumos de costura conformes a especificación (tipo, color, calibre).', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección de costura.', []),
                ]),
            ], 'Unir componentes mediante costura conforme a patrón y especificación', 'Realizar costura CNC según programa validado'),
            mkOp('OP 50', 'Troquelado', [
                mkWe('Machine', 'Troquel / Prensa', [
                    mkFn('Troquelar forma de inserto', [
                        mkFail('Forma fuera de especificación', 'Inserto no encaja', 'No ensambla', 'Producto defectuoso',
                            [mkCause('Troquel desgastado', 'MP de troquel', 'Control con gauge')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de troquelado', [
                    mkFn('Operar la prensa según instrucción de trabajo. Verificar con gauge.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de troquelado', [
                    mkFn('Definir parámetros de prensa, posicionamiento y criterios dimensionales.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección de troquelado.', []),
                ]),
            ], 'Proveer pieza con forma final troquelada conforme a plano', 'Troquelar forma definitiva según especificación'),
            mkOp('OP 60', 'Inyección', [
                mkWe('Machine', 'Inyectora', [
                    mkFn('Inyectar sustrato plástico', [
                        mkFail('Pieza incompleta (short shot)', 'Scrap', 'Falta de rigidez', 'No funcional',
                            [mkCause('Presión o temperatura insuficiente', 'Receta documentada, SPC', 'Control de peso + visual')]),
                        mkFail('Rebabas', 'Retrabajo', 'Interferencia', 'Posible corte',
                            [mkCause('Desgaste de molde', 'MP de molde', 'Inspección visual')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de inyección', [
                    mkFn('Operar inyectora según receta de proceso. Verificar piezas y registrar datos.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de inyección', [
                    mkFn('Definir parámetros de inyección, secuencia de arranque y controles en proceso.', []),
                ]),
                mkWe('Material', 'Resina / Materia prima plástica', [
                    mkFn('Proveer material plástico conforme a especificación (grado, humedad, MFI).', []),
                ]),
                mkWe('Environment', 'Temperatura ambiente - Ley 19587', [
                    mkFn('Mantener condiciones ambientales controladas para estabilidad del proceso de inyección.', []),
                ]),
            ], 'Proveer sustrato inyectado con geometría y propiedades mecánicas conformes', 'Inyectar sustrato según parámetros de proceso validados'),
            mkOp('OP 70', 'Prearmado', [
                mkWe('Method', 'Proceso de preensamble', [
                    mkFn('Ensamblar componentes previo al tapizado', [
                        mkFail('Componentes mal posicionados', 'Pieza no conforme', 'Ensamble deficiente en cliente', 'Funcionalidad comprometida',
                            [mkCause('Fixture de prearmado desalineado', 'Verificación de fixture periódica', 'Inspección visual + funcional')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de prearmado', [
                    mkFn('Ensamblar subcomponentes según secuencia definida. Verificar posición.', []),
                ]),
                mkWe('Machine', 'Fixture de prearmado', [
                    mkFn('Proveer fixture calibrado para posicionamiento correcto de componentes.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para verificación de ensamble.', []),
                ]),
            ], 'Ensamblar subcomponentes preparando la pieza para tapizado', 'Colocar y posicionar componentes según secuencia definida'),
            mkOp('OP 80', 'Adhesivado', [
                mkWe('Method', 'Proceso de adhesivado', [
                    mkFn('Aplicar adhesivo para unión recubrimiento-sustrato', [
                        mkFail('Adherencia insuficiente', 'Desprendimiento', 'Desprendimiento en uso', 'Reclamo garantía',
                            [mkCause('Gramaje insuficiente o superficie contaminada', 'Control de gramaje, limpieza de superficies', 'Ensayo de pelado')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de adhesivado', [
                    mkFn('Aplicar adhesivo según instrucción de trabajo. Verificar dosificación.', []),
                ]),
                mkWe('Material', 'Adhesivo / Solvente de limpieza', [
                    mkFn('Proveer adhesivo dentro de vida útil y condiciones de almacenamiento correctas.', []),
                ]),
                mkWe('Environment', 'Temperatura y ventilación - Ley 19587', [
                    mkFn('Mantener condiciones ambientales adecuadas para aplicación y curado de adhesivo.', []),
                ]),
            ], 'Asegurar adherencia entre materiales según especificación', 'Aplicar adhesivo en cantidades y zonas especificadas'),
            mkOp('OP 90', 'Tapizado', [
                mkWe('Man', 'Operador de tapizado', [
                    mkFn('Recubrir sustrato con vinilo', [
                        mkFail('Arrugas en recubrimiento', 'Defecto visual', 'Rechazo', 'Aspecto inaceptable',
                            [mkCause('Tensión insuficiente', 'IT con técnica de tensión', 'Inspección visual 100%')]),
                    ]),
                ]),
                mkWe('Method', 'Hoja de operaciones de tapizado', [
                    mkFn('Definir técnica de tensado, secuencia de fijación y criterios visuales.', []),
                ]),
                mkWe('Material', 'Vinilo cortado y cosido', [
                    mkFn('Proveer recubrimiento conforme a especificación dimensional y visual.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección de tapizado.', []),
                ]),
            ], 'Cubrir sustrato con material de terminación conforme a patrón', 'Tapizar manteniendo tensión uniforme y sin arrugas'),
            mkOp('OP 100', 'Control final e inspección', [
                mkWe('Measurement', 'Instrumentos, patrón VWA', [
                    mkFn('Verificar conformidad total', [
                        mkFail('Liberación de producto no conforme', 'Costo interno', 'Reclamo VWA', 'Riesgo de imagen',
                            [mkCause('Error de inspección', 'Capacitación, patrón actualizado', 'Auditoría de producto')]),
                    ]),
                ]),
                mkWe('Man', 'Inspector de calidad', [
                    mkFn('Ejecutar inspección visual y dimensional según plan de control.', []),
                ]),
                mkWe('Method', 'Plan de control / Criterios de aceptación VWA', [
                    mkFn('Definir criterios de aceptación, frecuencia y método de inspección.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para detección de defectos.', []),
                ]),
            ], 'Verificar conformidad total del producto terminado', 'Inspeccionar contra criterios de aceptación del cliente'),
            mkOp('OP 110', 'Embalaje y despacho', [
                mkWe('Method', 'Procedimiento de embalaje VDA', [
                    mkFn('Embalar según requerimientos VWA', [
                        mkFail('Daño en transporte', 'Scrap de PT', 'Rechazo VWA', 'Línea VWA detenida',
                            [mkCause('Embalaje inadecuado', 'Instrucción de embalaje VDA', 'Verificación antes de despacho')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de embalaje', [
                    mkFn('Embalar y etiquetar producto según instrucción VDA.', []),
                ]),
                mkWe('Material', 'Cajas / Film / Etiquetas VDA', [
                    mkFn('Proveer materiales de embalaje conformes a requerimiento VWA.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para verificación de embalaje.', []),
                ]),
            ], 'Proteger y despachar producto conforme a requerimientos logísticos', 'Embalar e identificar producto para transporte seguro'),
        ];

        ok(await saveAmfeDocument(amfeId, 'AMFE-4', P, { header: mkAmfeHeader('Insert', CL, PN, 'AMFE-4'), operations: ops }, 'draft'), 'P4-AMFE');

        ok(await savePfdDocument(pfdId, {
            id: pfdId,
            header: mkPfdHeader('Insert', PN, CL, 'PFD-INS-001', 'VWA/PATAGONIA/INSERTO'),
            steps: [
                mkPfdStep('OP 10', 'storage', 'Recepción MP (vinilo, sustrato, adhesivo, insertos, hilo)', '', 'Color, gramaje, espesor', '', 'scrap', 'Material no conforme → Rechazo a proveedor'),
                mkPfdStep('OP 20', 'operation', 'Corte de vinilo', 'Cortadora CNC', 'Dimensiones', 'Programa CNC', 'scrap', 'Pieza fuera de dimensión → Scrap'),
                mkPfdStep('OP 30', 'operation', 'Refilado de bordes', 'Refiladora', 'Bordes limpios', 'Estado cuchilla', 'rework', 'OP 30'),
                mkPfdStep('OP 40', 'operation', 'Costura CNC de precisión', 'Costura CNC', 'Patrón costura, resistencia', 'Programa, tensión', 'rework', 'OP 40'),
                mkPfdStep('OP 50', 'operation', 'Troquelado de forma', 'Troquel / Prensa', 'Dimensiones, forma', 'Presión', 'scrap', 'Forma defectuosa → Scrap'),
                mkPfdStep('OP 60', 'operation', 'Inyección de sustrato', 'Inyectora', 'Peso, dimensiones, aspecto', 'Presión, temp, tiempo', 'scrap', 'Short shot / defectos → Scrap (regrind)'),
                mkPfdStep('OP 70', 'operation', 'Prearmado de componentes', 'Fixture de prearmado', 'Posición componentes', 'Alineación fixture', 'rework', 'OP 70'),
                mkPfdStep('OP 80', 'operation', 'Adhesivado', 'Equipo de adhesivado', 'Adherencia', 'Gramaje adhesivo', 'rework', 'OP 80'),
                mkPfdStep('OP 90', 'operation', 'Tapizado', 'Mesa de tapizado', 'Sin arrugas, alineación', 'Tensión material', 'rework', 'OP 90'),
                mkPfdStep('OP 100', 'inspection', 'Control final e inspección', 'Patrón VWA, gauge', 'Aspecto, dimensiones', '', 'sort', ''),
                mkPfdStep('OP 110', 'storage', 'Embalaje VDA y despacho', 'Contenedor VDA', 'Identificación VWA', '', 'rework', 'OP 110'),
            ],
            createdAt: '2026-03-14T12:00:00.000Z', updatedAt: '2026-03-14T12:00:00.000Z',
        }), 'P4-PFD');

        ok(await saveCpDocument(cpId, P, {
            header: mkCpHeader('Insert', PN, CL, 'CP-INS-001', P),
            items: [
                mkCpItem('OP 10', 'Recepción', '', 'Color del vinilo', '', 'Conforme a muestra', 'Visual vs muestra', '1 rollo', 'Cada lote', 'Registro recepción', 'Rechazar lote', 'SC'),
                mkCpItem('OP 20', 'Corte', 'Cortadora CNC', 'Dimensiones', 'Programa', '±1.5mm', 'Plantilla / cinta', '5 pzas', 'Inicio lote', 'Control dimensional', 'Ajustar, re-cortar'),
                mkCpItem('OP 30', 'Refilado', 'Refiladora', 'Bordes', '', 'Sin rebabas', 'Visual', '100%', 'Cada pieza', 'Inspección visual', 'Refilar'),
                mkCpItem('OP 40', 'Costura CNC', 'Costura CNC', 'Patrón costura', 'Programa', 'Conforme a plano', 'Visual + muestra', '100%', 'Cada pieza', 'Inspección visual', 'Reprogramar, separar', 'SC'),
                mkCpItem('OP 50', 'Troquelado', 'Prensa', 'Forma', 'Presión', 'Conforme a plano', 'Gauge', '5 pzas', 'Inicio + c/50', 'Control gauge', 'Cambiar troquel'),
                mkCpItem('OP 60', 'Inyección', 'Inyectora', 'Peso', 'Presión, temp', 'TBD g ±2%', 'Balanza', '5 pzas', 'Inicio + c/hora', 'SPC peso', 'Ajustar parámetros', 'CC'),
                mkCpItem('OP 60', 'Inyección', 'Inyectora', 'Dimensiones', '', '±0.3mm', 'Gauge/CMM', '3 pzas', 'Inicio turno', 'Control dimensional', 'Ajustar, retener', 'CC'),
                mkCpItem('OP 70', 'Prearmado', 'Fixture', 'Posición componentes', '', 'Conforme a plano', 'Visual + funcional', '100%', 'Cada pieza', 'Inspección funcional', 'Reposicionar'),
                mkCpItem('OP 80', 'Adhesivado', 'Eq. adhesivado', 'Adherencia', 'Gramaje', 'Min TBD N', 'Ensayo pelado', '1 pza', '1x turno', 'Registro ensayo', 'Detener, revisar', 'SC'),
                mkCpItem('OP 90', 'Tapizado', 'Mesa tapizado', 'Sin arrugas', '', 'Sin arrugas visibles', 'Visual', '100%', 'Cada pieza', 'Inspección visual', 'Retapizar o separar'),
                mkCpItem('OP 100', 'Control final', 'Patrón, gauge', 'Aspecto general', '', 'Conforme a patrón VWA', 'Visual', '100%', 'Cada pieza', 'Inspección final', 'Separar NOK', 'CC'),
                mkCpItem('OP 110', 'Embalaje', 'Contenedor VDA', 'Identificación', '', 'Etiqueta VDA correcta', 'Visual', '100%', 'Cada cont.', 'Check VDA', 'Corregir'),
            ],
        }, amfeId), 'P4-CP');

        ok(await saveHoDocument(hoId, {
            header: mkHoHeader(CL, PN, 'Insert', P, P),
            sheets: [
                mkHoSheet(ops[0].id, 'OP 10', 'Recepción MP', ['guantes', 'zapatos'], [
                    { d: 'Verificar remito vs OC' },
                    { d: 'Inspeccionar color, gramaje, espesor', k: true, r: 'Material crítico para VWA' },
                    { d: 'Registrar y almacenar con ID de lote' },
                ]),
                mkHoSheet(ops[1].id, 'OP 20', 'Corte de vinilo', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar programa CNC y herramienta' },
                    { d: 'Posicionar material', k: true, r: 'Orientación correcta del material' },
                    { d: 'Ejecutar corte y verificar dimensiones' },
                ]),
                mkHoSheet(ops[2].id, 'OP 30', 'Refilado', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar estado de cuchilla' },
                    { d: 'Refilar bordes' },
                    { d: 'Verificar bordes limpios' },
                ]),
                mkHoSheet(ops[3].id, 'OP 40', 'Costura CNC', ['anteojos', 'zapatos'], [
                    { d: 'Verificar programa de costura CNC vs plano' },
                    { d: 'Cargar piezas en máquina', k: true, r: 'Posicionamiento preciso para patrón correcto' },
                    { d: 'Ejecutar ciclo de costura' },
                    { d: 'Inspeccionar patrón de costura vs muestra aprobada' },
                ]),
                mkHoSheet(ops[4].id, 'OP 50', 'Troquelado', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar estado de troquel' },
                    { d: 'Posicionar pieza en troquel', k: true, r: 'Centrado para forma correcta' },
                    { d: 'Accionar prensa' },
                    { d: 'Verificar con gauge' },
                ]),
                mkHoSheet(ops[5].id, 'OP 60', 'Inyección', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar parámetros de inyectora' },
                    { d: 'Verificar molde limpio' },
                    { d: 'Ejecutar ciclo', k: true, r: 'Parámetros CC' },
                    { d: 'Retirar pieza, inspeccionar, pesar' },
                ]),
                mkHoSheet(ops[6].id, 'OP 70', 'Prearmado', ['guantes', 'zapatos'], [
                    { d: 'Preparar componentes en orden de ensamble' },
                    { d: 'Posicionar en fixture', k: true, r: 'Alineación correcta de componentes' },
                    { d: 'Verificar posición y funcionalidad' },
                ]),
                mkHoSheet(ops[7].id, 'OP 80', 'Adhesivado', ['guantes', 'anteojos', 'zapatos', 'respirador'], [
                    { d: 'Limpiar superficies' },
                    { d: 'Aplicar adhesivo según gramaje', k: true, r: 'Gramaje correcto para adherencia' },
                    { d: 'Unir piezas y aplicar presión' },
                ]),
                mkHoSheet(ops[8].id, 'OP 90', 'Tapizado', ['guantes', 'zapatos'], [
                    { d: 'Posicionar recubrimiento', k: true, r: 'Alineación y tensión uniforme' },
                    { d: 'Tensar y fijar' },
                    { d: 'Inspeccionar visualmente' },
                ]),
                mkHoSheet(ops[9].id, 'OP 100', 'Control final', ['anteojos', 'zapatos'], [
                    { d: 'Inspeccionar vs patrón VWA', k: true, r: 'Último punto de control' },
                    { d: 'Verificar dimensiones con gauge' },
                    { d: 'Registrar y separar OK/NOK' },
                ]),
                mkHoSheet(ops[10].id, 'OP 110', 'Embalaje VDA', ['guantes', 'zapatos'], [
                    { d: 'Embalar en contenedor VDA' },
                    { d: 'Etiquetar con datos VWA' },
                    { d: 'Ubicar en zona de despacho' },
                ]),
            ],
        }, amfeId, cpId), 'P4-HO');
        log.push(`Product 4: ${P} - PFD + AMFE + CP + HO created`);
    }

    // ========================================================================
    // PRODUCT 5: TOP ROLL PATAGONIA (VWA)
    // ========================================================================
    {
        const P = 'Top Roll Patagonia';
        const PN = 'TBD-TR-PAT';
        const CL = 'VWA';
        const amfeId = uid(), cpId = uid(), pfdId = uid(), hoId = uid();

        const ops = [
            mkOp('OP 5', 'Recepción de materia prima', [
                mkWe('Material', 'PP, adhesivo HotMelt, film IMG', [
                    mkFn('Recibir materiales conforme a especificación', [
                        mkFail('Material fuera de especificación', 'Retraso producción', 'Defecto en producto', 'Reclamo',
                            [mkCause('Material no conforme del proveedor', 'Certificado de calidad, auditoría', 'Inspección de recepción')]),
                    ]),
                ]),
                mkWe('Machine', 'Autoelevador / Zorra hidráulica', [
                    mkFn('Transportar material recibido a zona de almacén de forma segura.', []),
                ]),
                mkWe('Man', 'Operador de recepción / Calidad', [
                    mkFn('Verificar documentación y estado del material recibido. Registrar en sistema.', []),
                ]),
                mkWe('Measurement', 'Calibres / Balanza / Cinta métrica', [
                    mkFn('Medir propiedades del material (MFI, espesor) y verificar contra certificado.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones / Ayudas visuales de recepción', [
                    mkFn('Definir criterios de aceptación y secuencia de verificación de materiales.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección visual de materiales.', []),
                ]),
            ], 'Asegurar la conformidad de la calidad y cantidad de material recibido', 'Garantizar la estabilidad y la integridad física del material durante el transporte interno'),
            mkOp('OP 10', 'Inyección de sustrato PP', [
                mkWe('Machine', 'Inyectora', [
                    mkFn('Inyectar sustrato de polipropileno', [
                        mkFail('Pieza incompleta (short shot)', 'Scrap', 'Falta de rigidez', 'No funcional',
                            [mkCause('Parámetros de inyección fuera de rango', 'Receta documentada, monitoreo automático', 'Control de peso + inspección visual')]),
                        mkFail('Marcas de flujo visibles', 'Defecto visual', 'Rechazo', 'Aspecto inaceptable',
                            [mkCause('Velocidad de inyección incorrecta o temp. baja', 'Optimización de parámetros, SPC', 'Inspección visual 100%')]),
                        mkFail('Deformación/alabeo', 'No ensambla', 'Rechazo dimensional', 'Gap visible',
                            [mkCause('Enfriamiento desigual', 'Control de temp. de molde', 'Gauge dimensional')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de inyección', [
                    mkFn('Operar inyectora según receta de proceso. Verificar piezas y registrar datos SPC.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de inyección', [
                    mkFn('Definir parámetros de inyección, secuencia de arranque y controles en proceso.', []),
                ]),
                mkWe('Material', 'Resina PP / Materia prima', [
                    mkFn('Proveer polipropileno conforme a especificación (grado, humedad, MFI).', []),
                ]),
                mkWe('Environment', 'Temperatura ambiente - Ley 19587', [
                    mkFn('Mantener condiciones ambientales controladas para estabilidad del proceso de inyección.', []),
                ]),
            ], 'Proveer sustrato inyectado con geometría y propiedades mecánicas conformes', 'Inyectar sustrato PP según parámetros de proceso validados'),
            mkOp('OP 20', 'Adhesivado HotMelt', [
                mkWe('Machine', 'Aplicadora de HotMelt', [
                    mkFn('Aplicar adhesivo HotMelt en sustrato para unión con film', [
                        mkFail('Distribución desigual de adhesivo', 'Zonas sin adherencia', 'Desprendimiento de film', 'Defecto funcional',
                            [mkCause('Boquilla obstruida o temperatura incorrecta', 'Limpieza periódica, control de temperatura', 'Inspección visual de patrón de adhesivo')]),
                        mkFail('Temperatura de HotMelt fuera de rango', 'Adherencia deficiente', 'Desprendimiento', 'Reclamo garantía',
                            [mkCause('Falla de control de temperatura', 'Termopar calibrado, alarma automática', 'Monitoreo de temperatura continuo')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de adhesivado HotMelt', [
                    mkFn('Operar aplicadora HotMelt según instrucción. Verificar cobertura uniforme.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de adhesivado', [
                    mkFn('Definir temperatura, patrón de aplicación y criterios de verificación de cobertura.', []),
                ]),
                mkWe('Material', 'Adhesivo HotMelt', [
                    mkFn('Proveer adhesivo HotMelt dentro de vida útil y almacenamiento correcto.', []),
                ]),
                mkWe('Environment', 'Temperatura y ventilación - Ley 19587', [
                    mkFn('Mantener condiciones ambientales adecuadas para aplicación de HotMelt.', []),
                ]),
            ], 'Asegurar adherencia entre materiales según especificación', 'Aplicar adhesivo HotMelt en cantidades y zonas especificadas'),
            mkOp('OP 30', 'IMG (In-Mold Graining)', [
                mkWe('Machine', 'Prensa IMG', [
                    mkFn('Aplicar textura y film decorativo mediante IMG', [
                        mkFail('Textura defectuosa o incompleta', 'Defecto visual crítico', 'Rechazo por VWA', 'Aspecto no premium',
                            [mkCause('Temperatura o presión de IMG incorrecta', 'Receta de proceso documentada, control automático', 'Inspección visual 100% vs muestra aprobada')]),
                        mkFail('Adherencia del film insuficiente', 'Film se despega', 'Desprendimiento en uso', 'Reclamo garantía',
                            [mkCause('Preparación inadecuada de sustrato o film', 'Procedimiento de preparación, control de HotMelt', 'Ensayo de pelado periódico')]),
                    ]),
                ]),
                mkWe('Method', 'Preparación de materiales IMG', [
                    mkFn('Preparar sustrato y film para proceso IMG', [
                        mkFail('Film mal posicionado o con arrugas pre-proceso', 'Textura despareja o marcas', 'Defecto visual', 'Aspecto inaceptable',
                            [mkCause('Manipulación incorrecta del film o falta de procedimiento', 'Instrucción de manipulación de film, condiciones de almacenamiento', 'Verificación visual pre-carga en prensa')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de prensa IMG', [
                    mkFn('Operar prensa IMG según receta. Cargar sustrato y film correctamente.', []),
                ]),
                mkWe('Environment', 'Temperatura ambiente - Ley 19587', [
                    mkFn('Mantener condiciones ambientales controladas para estabilidad del proceso IMG.', []),
                ]),
            ], 'Aplicar textura superficial conforme a especificación de diseño', 'Gravar textura en molde según parámetros validados'),
            mkOp('OP 40', 'Trimming', [
                mkWe('Machine', 'Router CNC / Cortadora', [
                    mkFn('Recortar exceso de material post-IMG', [
                        mkFail('Corte irregular o incompleto', 'Pieza no conforme', 'No ensambla', 'Producto defectuoso',
                            [mkCause('Desgaste de herramienta o programa incorrecto', 'MP de herramientas, verificación programa', 'Inspección visual + dimensional')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de trimming CNC', [
                    mkFn('Operar router CNC según programa. Verificar contorno y bordes.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de trimming', [
                    mkFn('Definir programa CNC de recorte, secuencia y criterios dimensionales.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección de contorno.', []),
                ]),
            ], 'Proveer pieza con contorno final conforme a plano', 'Recortar material excedente según programa CNC'),
            mkOp('OP 50', 'Edge Folding (doblado de bordes)', [
                mkWe('Machine', 'Equipo de edge folding', [
                    mkFn('Doblar bordes del film sobre el sustrato', [
                        mkFail('Plegado incompleto', 'Borde expuesto', 'Borde visible, rechazo', 'Aspecto no terminado',
                            [mkCause('Temperatura o presión insuficiente', 'Parámetros documentados', 'Inspección visual de bordes')]),
                        mkFail('Arrugas en el doblez', 'Defecto visual', 'Rechazo por apariencia', 'Aspecto no premium',
                            [mkCause('Exceso de material en esquinas', 'Técnica de doblado optimizada', 'Inspección visual 100%')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de edge folding', [
                    mkFn('Operar equipo de doblado de bordes. Verificar plegado completo.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de edge folding', [
                    mkFn('Definir parámetros de temperatura, presión y técnica de doblado.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección de bordes plegados.', []),
                ]),
            ], 'Doblar bordes de la pieza conforme a especificación', 'Plegar bordes manteniendo adhesión y geometría'),
            mkOp('OP 60', 'Soldado (welding)', [
                mkWe('Machine', 'Soldadora ultrasónica / térmica', [
                    mkFn('Soldar componentes al conjunto', [
                        mkFail('Soldadura insuficiente', 'Unión débil', 'Desprendimiento en uso', 'Falla de seguridad',
                            [mkCause('Energía de soldadura insuficiente o superficie contaminada', 'Parámetros documentados, limpieza pre-soldadura', 'Ensayo de resistencia de soldadura')]),
                        mkFail('Quemaduras o marcas de soldadura', 'Defecto visual', 'Rechazo', 'Aspecto inaceptable',
                            [mkCause('Energía excesiva o tiempo excesivo', 'Control de parámetros', 'Inspección visual')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de soldadura', [
                    mkFn('Operar soldadora según parámetros validados. Verificar unión y aspecto.', []),
                ]),
                mkWe('Method', 'Hoja de operaciones de soldado', [
                    mkFn('Definir parámetros de soldadura (energía, amplitud, tiempo) y controles.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para inspección de soldadura.', []),
                ]),
            ], 'Unir componentes mediante soldadura conforme a especificación', 'Soldar según parámetros validados de tiempo y temperatura'),
            mkOp('OP 70', 'Control final e inspección', [
                mkWe('Measurement', 'Instrumentos de inspección, patrón VWA', [
                    mkFn('Verificar conformidad visual, dimensional y funcional', [
                        mkFail('Liberación de producto no conforme', 'Costo interno', 'Reclamo VWA', 'Riesgo imagen marca',
                            [mkCause('Error de inspección', 'Capacitación, patrón actualizado', 'Auditoría de producto')]),
                    ]),
                ]),
                mkWe('Man', 'Inspector de calidad', [
                    mkFn('Ejecutar inspección visual y dimensional según plan de control.', []),
                ]),
                mkWe('Method', 'Plan de control / Criterios de aceptación VWA', [
                    mkFn('Definir criterios de aceptación, frecuencia y método de inspección.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para detección de defectos.', []),
                ]),
            ], 'Verificar conformidad total del producto terminado', 'Inspeccionar contra criterios de aceptación del cliente'),
            mkOp('OP 80', 'Embalaje y despacho', [
                mkWe('Method', 'Procedimiento de embalaje VDA', [
                    mkFn('Embalar según requerimientos VWA', [
                        mkFail('Daño en transporte', 'Scrap PT', 'Rechazo VWA', 'Línea detenida',
                            [mkCause('Embalaje inadecuado', 'Instrucción de embalaje VDA', 'Verificación antes de despacho')]),
                    ]),
                ]),
                mkWe('Man', 'Operador de embalaje', [
                    mkFn('Embalar y etiquetar producto según instrucción VDA.', []),
                ]),
                mkWe('Material', 'Cajas / Film / Etiquetas VDA', [
                    mkFn('Proveer materiales de embalaje conformes a requerimiento VWA.', []),
                ]),
                mkWe('Environment', 'Iluminación - Ley 19587', [
                    mkFn('Proveer condiciones de iluminación adecuadas para verificación de embalaje.', []),
                ]),
            ], 'Proteger y despachar producto conforme a requerimientos logísticos', 'Embalar e identificar producto para transporte seguro'),
        ];

        ok(await saveAmfeDocument(amfeId, 'AMFE-5', P, { header: mkAmfeHeader('Top Roll', CL, PN, 'AMFE-5'), operations: ops }, 'draft'), 'P5-AMFE');

        ok(await savePfdDocument(pfdId, {
            id: pfdId,
            header: mkPfdHeader('Top Roll', PN, CL, 'PFD-TR-001', 'VWA/PATAGONIA/TOP_ROLL'),
            steps: [
                mkPfdStep('OP 5', 'storage', 'Recepción MP (PP, adhesivo HotMelt, film IMG)', '', 'Certificado calidad', '', 'scrap', 'Material no conforme → Rechazo a proveedor'),
                mkPfdStep('OP 10', 'operation', 'Inyección de sustrato PP', 'Inyectora', 'Peso, dimensiones, aspecto', 'Presión, temp, tiempo ciclo', 'scrap', 'Short shot / deformación → Scrap (regrind)'),
                mkPfdStep('OP 20', 'operation', 'Adhesivado HotMelt', 'Aplicadora HotMelt', 'Distribución adhesivo', 'Temperatura, caudal', 'rework', 'OP 20'),
                mkPfdStep('OP 30', 'operation', 'IMG (In-Mold Graining) - textura + film', 'Prensa IMG', 'Textura, adherencia film', 'Temperatura, presión, tiempo', 'scrap', 'Textura defectuosa → Scrap'),
                mkPfdStep('OP 40', 'operation', 'Trimming (recorte CNC)', 'Router CNC', 'Contorno, bordes limpios', 'Programa, velocidad', 'scrap', 'Sobre-corte → Scrap'),
                mkPfdStep('OP 50', 'operation', 'Edge Folding (doblado de bordes)', 'Equipo edge folding', 'Doblez completo, sin arrugas', 'Temperatura, presión', 'rework', 'OP 50'),
                mkPfdStep('OP 60', 'operation', 'Soldado de componentes', 'Soldadora ultrasónica', 'Resistencia de soldadura', 'Energía, amplitud, tiempo', 'scrap', 'Soldadura defectuosa → Scrap'),
                mkPfdStep('OP 70', 'inspection', 'Control final e inspección', 'Patrón VWA, gauge, CMM', 'Aspecto, dimensiones, funcionalidad', '', 'sort', ''),
                mkPfdStep('OP 80', 'storage', 'Embalaje VDA y despacho', 'Contenedor VDA', 'Identificación VWA', '', 'rework', 'OP 80'),
            ],
            createdAt: '2026-03-14T12:00:00.000Z', updatedAt: '2026-03-14T12:00:00.000Z',
        }), 'P5-PFD');

        ok(await saveCpDocument(cpId, P, {
            header: mkCpHeader('Top Roll', PN, CL, 'CP-TR-001', P),
            items: [
                mkCpItem('OP 5', 'Recepción', '', 'Estado del material PP', '', 'Sin contaminación, MFI conforme', 'Visual + certificado', '1 lote', 'Cada recepción', 'Registro recepción', 'Rechazar lote'),
                mkCpItem('OP 10', 'Inyección PP', 'Inyectora', 'Peso de pieza', 'Presión inyección', 'TBD g ±2%', 'Balanza', '5 pzas', 'Inicio + c/hora', 'SPC peso', 'Ajustar parámetros', 'CC'),
                mkCpItem('OP 10', 'Inyección PP', 'Inyectora', 'Dimensiones críticas', 'Temp molde', '±0.3mm', 'Gauge/CMM', '3 pzas', 'Inicio turno', 'Control dimensional', 'Ajustar, retener', 'CC'),
                mkCpItem('OP 10', 'Inyección PP', 'Inyectora', 'Aspecto (sin marcas flujo)', '', 'Sin defectos visibles', 'Visual', '100%', 'Cada pieza', 'Inspección visual', 'Separar, ajustar velocidad'),
                mkCpItem('OP 20', 'Adhesivado HotMelt', 'Aplicadora', 'Distribución adhesivo', 'Temperatura HotMelt', 'Cobertura uniforme, T=TBD°C ±5°C', 'Visual + termómetro', '5 pzas', 'Inicio + c/hora', 'Monitoreo temperatura', 'Ajustar boquilla/temp', 'SC'),
                mkCpItem('OP 30', 'IMG', 'Prensa IMG', 'Textura', 'Temp, presión IMG', 'Conforme a muestra aprobada', 'Visual vs muestra', '100%', 'Cada pieza', 'Inspección visual', 'Ajustar parámetros, separar', 'CC'),
                mkCpItem('OP 30', 'IMG', 'Prensa IMG', 'Adherencia film', '', 'Min TBD N', 'Ensayo pelado', '1 pza', '1x turno', 'Registro ensayo', 'Detener, revisar HotMelt', 'CC'),
                mkCpItem('OP 40', 'Trimming', 'Router CNC', 'Contorno', 'Programa', 'Conforme a plano', 'Gauge + visual', '5 pzas', 'Inicio lote', 'Control contorno', 'Recalibrar CNC'),
                mkCpItem('OP 50', 'Edge Folding', 'Eq. edge folding', 'Doblez completo', 'Temp, presión', 'Sin bordes expuestos', 'Visual', '100%', 'Cada pieza', 'Inspección visual', 'Re-doblar o separar'),
                mkCpItem('OP 50', 'Edge Folding', 'Eq. edge folding', 'Sin arrugas en doblez', '', 'Sin arrugas visibles', 'Visual', '100%', 'Cada pieza', 'Inspección visual', 'Separar, ajustar técnica'),
                mkCpItem('OP 60', 'Soldado', 'Soldadora US', 'Resistencia soldadura', 'Energía, amplitud', 'Min TBD N', 'Ensayo destructivo', '1 pza', '1x turno', 'Registro ensayo', 'Detener, ajustar, retener', 'CC'),
                mkCpItem('OP 60', 'Soldado', 'Soldadora US', 'Aspecto (sin quemaduras)', '', 'Sin marcas visibles', 'Visual', '100%', 'Cada pieza', 'Inspección visual', 'Ajustar energía'),
                mkCpItem('OP 70', 'Control final', 'Patrón, gauge', 'Aspecto visual general', '', 'Conforme a patrón VWA', 'Visual vs patrón', '100%', 'Cada pieza', 'Inspección final', 'Separar NOK', 'CC'),
                mkCpItem('OP 70', 'Control final', 'CMM/gauge', 'Dimensiones funcionales', '', '±0.5mm', 'CMM/gauge', '5 pzas', 'Cada lote', 'Planilla dimensional', 'Retener lote'),
                mkCpItem('OP 80', 'Embalaje', 'Contenedor VDA', 'Identificación VWA', '', 'Etiqueta VDA correcta', 'Visual', '100%', 'Cada contenedor', 'Check VDA', 'Corregir ID'),
            ],
        }, amfeId), 'P5-CP');

        ok(await saveHoDocument(hoId, {
            header: mkHoHeader(CL, PN, 'Top Roll', P, P),
            sheets: [
                mkHoSheet(ops[0].id, 'OP 5', 'Recepción MP', ['guantes', 'zapatos'], [
                    { d: 'Verificar remito vs OC' },
                    { d: 'Inspeccionar material PP, film IMG, adhesivo', k: true, r: 'Material crítico para proceso IMG' },
                    { d: 'Registrar y almacenar' },
                ]),
                mkHoSheet(ops[1].id, 'OP 10', 'Inyección PP', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar parámetros de inyectora según receta' },
                    { d: 'Verificar limpieza de molde' },
                    { d: 'Ejecutar ciclo de inyección', k: true, r: 'Parámetros CC para peso y dimensiones' },
                    { d: 'Retirar pieza, inspeccionar visualmente' },
                    { d: 'Pesar y registrar en SPC' },
                ]),
                mkHoSheet(ops[2].id, 'OP 20', 'Adhesivado HotMelt', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar temperatura de HotMelt' },
                    { d: 'Aplicar adhesivo asegurando cobertura uniforme', k: true, r: 'Distribución uniforme para adherencia del film IMG' },
                    { d: 'Verificar visualmente el patrón de adhesivo' },
                ]),
                mkHoSheet(ops[3].id, 'OP 30', 'IMG', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar parámetros de prensa IMG (temp, presión, tiempo)' },
                    { d: 'Posicionar sustrato adhesivado y film en prensa', k: true, r: 'Posicionamiento correcto para textura uniforme' },
                    { d: 'Ejecutar ciclo IMG' },
                    { d: 'Retirar pieza e inspeccionar textura vs muestra aprobada', k: true, r: 'Textura es CC para VWA' },
                ]),
                mkHoSheet(ops[4].id, 'OP 40', 'Trimming', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar programa CNC y estado de herramienta' },
                    { d: 'Posicionar pieza en fixture', k: true, r: 'Posición correcta para contorno conforme' },
                    { d: 'Ejecutar programa de trimming' },
                    { d: 'Verificar contorno y bordes' },
                ]),
                mkHoSheet(ops[5].id, 'OP 50', 'Edge Folding', ['guantes', 'anteojos', 'zapatos'], [
                    { d: 'Verificar parámetros (temperatura, presión)' },
                    { d: 'Posicionar pieza en equipo' },
                    { d: 'Ejecutar doblado de bordes', k: true, r: 'Doblez completo sin arrugas' },
                    { d: 'Inspeccionar todos los bordes' },
                ]),
                mkHoSheet(ops[6].id, 'OP 60', 'Soldado', ['guantes', 'anteojos', 'zapatos', 'proteccionAuditiva'], [
                    { d: 'Verificar parámetros de soldadora (energía, amplitud)' },
                    { d: 'Posicionar componentes a soldar' },
                    { d: 'Ejecutar soldadura', k: true, r: 'Energía y tiempo críticos para resistencia' },
                    { d: 'Inspeccionar visualmente (sin quemaduras)' },
                ]),
                mkHoSheet(ops[7].id, 'OP 70', 'Control final', ['anteojos', 'zapatos'], [
                    { d: 'Inspeccionar aspecto visual vs patrón VWA', k: true, r: 'Último control antes del cliente' },
                    { d: 'Verificar dimensiones con gauge/CMM' },
                    { d: 'Registrar en planilla de control final' },
                    { d: 'Separar OK y NOK' },
                ]),
                mkHoSheet(ops[8].id, 'OP 80', 'Embalaje VDA', ['guantes', 'zapatos'], [
                    { d: 'Colocar piezas en contenedor VDA' },
                    { d: 'Aplicar protección entre capas' },
                    { d: 'Completar etiqueta VDA' },
                    { d: 'Ubicar en zona de despacho' },
                ]),
            ],
        }, amfeId, cpId), 'P5-HO');
        log.push(`Product 5: ${P} - PFD + AMFE + CP + HO created`);
    }

    log.push('--- SEED COMPLETE: 5 products x 4 document types = 20 documents ---');
    return log.join('\n');
}

// Register on window for browser console execution
(window as any).__seedApqp = seedAllApqpDocuments;

/**
 * SGC Document Catalog — Barack Mercosul
 *
 * Complete index of the company's Quality Management System documentation.
 * Source: Y:\BARACK\CALIDAD\DOCUMENTACION SGC\SISTEMA\SISTEMA SGC
 *
 * Cataloged: 2026-02-19
 *
 * Each document has:
 *  - path: relative path from SGC root
 *  - size: file size in bytes
 *  - date: last modified date (YYYY-MM-DD)
 *  - relevance: how relevant it is to our software
 *     'core'     = directly used/replicated in our software (AMFE, HO, CP, etc.)
 *     'high'     = strongly related to features we have or will build
 *     'medium'   = useful context for AI suggestions or validation rules
 *     'low'      = general SGC documentation, not directly used
 *     'obsolete' = old versions kept for history
 */

export type SgcRelevance = 'core' | 'high' | 'medium' | 'low' | 'obsolete';

export interface SgcDocument {
    path: string;
    size: number;
    date: string;
    relevance: SgcRelevance;
    /** Optional note about what this document is / how it relates to our software */
    note?: string;
}

export interface SgcSection {
    name: string;
    description: string;
    /** How this section relates to the software */
    softwareRelevance: string;
    documents: SgcDocument[];
}

// ============================================================================
// SECTION 1: AYUDAS VISUALES (Visual Aids)
// ============================================================================

const AYUDAS_VISUALES: SgcSection = {
    name: 'Ayudas Visuales',
    description: 'Visual aid documents for production operations — the core of what HO module replicates',
    softwareRelevance: 'CORE — Our HO (Hojas de Operaciones) module is the digital version of these visual aids',
    documents: [
        // This folder was empty in the catalog — visual aids are managed per-product elsewhere
        // The actual HO documents are in Instructivos/PRODUCCION/
    ],
};

// ============================================================================
// SECTION 2: FACTIBILIDAD (Feasibility Analysis)
// ============================================================================

const FACTIBILIDAD: SgcSection = {
    name: 'FACTIBILIDAD',
    description: 'Feasibility analysis templates and models for new projects/products',
    softwareRelevance: 'MEDIUM — Related to APQP process, could feed into AMFE initial data',
    documents: [
        { path: 'FACTIBILIDAD/P-03.3 Analisis de factibilidad B.xls', size: 84992, date: '2019-06-25', relevance: 'medium', note: 'Current feasibility analysis template' },
        { path: 'FACTIBILIDAD/P-03.3 Analisis de factibilidad B2.xls', size: 84480, date: '2019-01-15', relevance: 'medium' },
        { path: 'FACTIBILIDAD/P-03.3 Analisis de factibilidad B3.xls', size: 88576, date: '2019-11-28', relevance: 'medium' },
        { path: 'FACTIBILIDAD/P-03.3 Analisis de factibilidad B4.xls', size: 95232, date: '2020-10-29', relevance: 'medium', note: 'Latest version' },
        { path: 'FACTIBILIDAD/MODELOS/Form-120 Analisis de Factibilidad (20-05-11).xls', size: 135680, date: '2018-06-28', relevance: 'low', note: 'External model' },
        { path: 'FACTIBILIDAD/MODELOS/I-PY-001.5 Analisis de Factibilidad A.xls', size: 59904, date: '2018-06-28', relevance: 'low' },
        { path: 'FACTIBILIDAD/MODELOS/P-SG-03.1 Analisis de Factibilidad y riesgo de proyectos C.xlsx', size: 20302, date: '2018-06-28', relevance: 'low' },
        { path: 'FACTIBILIDAD/MODELOS/P-SG-7.2-3 Analisis de factibilidad Rev.00.xls', size: 38400, date: '2018-06-28', relevance: 'low' },
    ],
};

// ============================================================================
// SECTION 3: FORMULARIOS (Forms)
// ============================================================================

const FORMULARIOS: SgcSection = {
    name: 'Formularios',
    description: 'Standard forms used in quality processes',
    softwareRelevance: 'HIGH — Plan de Control template is the basis for our CP module',
    documents: [
        { path: 'Formularios/PC Plan de control Rev 2.xls', size: 93696, date: '2020-11-26', relevance: 'core', note: 'CORE: Plan de Control template — our CP module replicates this' },
    ],
};

// ============================================================================
// SECTION 4: IDENTIFICACIONES (Product Identification & Labels)
// ============================================================================

const IDENTIFICACIONES: SgcSection = {
    name: 'IDENTIFICACIONES',
    description: 'Product labels, identification etiquetas, logos, and printer drivers for label printers',
    softwareRelevance: 'LOW — Label printing is separate from our balancing/AMFE software',
    documents: [
        // ~130 label files (etiquetas), logos, printer drivers
        // Summarized by category rather than listing each one:
        { path: 'IDENTIFICACIONES/Logo Barack.png', size: 128428, date: '2020-10-20', relevance: 'high', note: 'Company logo — used in our HO PDF header' },
        { path: 'IDENTIFICACIONES/Logo Barack.jpg', size: 6296, date: '2013-02-12', relevance: 'high', note: 'Company logo JPG variant' },
        { path: 'IDENTIFICACIONES/Logo Barack nuevo-03.png', size: 188684, date: '2024-07-19', relevance: 'high', note: 'New Barack logo' },
        { path: 'IDENTIFICACIONES/logo barack.bmp', size: 69174, date: '2012-08-24', relevance: 'low', note: 'BMP variant' },
        // Etiquetas are organized by client and product type
        // code39/ subfolder has barcode fonts
        // Gprinter drivers/ has printer software
        // IDENTIFICACION MIRGOR/ has Mirgor-specific labels
    ],
};

// ============================================================================
// SECTION 5: INSTRUCTIVOS (Work Instructions) — BY DEPARTMENT
// ============================================================================

// 5A: CALIDAD (Quality)
const INSTRUCTIVOS_CALIDAD: SgcSection = {
    name: 'Instructivos/CALIDAD',
    description: 'Quality department work instructions — ~63 current instructivos + annexes',
    softwareRelevance: 'CORE — Contains AMFE, HO, and Control Plan templates and instructions',
    documents: [
        // === CORE documents for our software ===
        { path: 'Instructivos/CALIDAD/I-AC-005.3 Analisis del modo de falla y sus efectos C.xlsx', size: 164697, date: '2021-11-30', relevance: 'core', note: 'CORE: Current AMFE template — our AMFE module replicates this' },
        { path: 'Instructivos/CALIDAD/I-IN-002.4 Hoja de operaciones C.xlsx', size: 48128, date: '2024-07-19', relevance: 'core', note: 'OLDER COPY in CALIDAD — see INGENIERIA/Anexos for latest version' },
        { path: 'Instructivos/INGENIERIA/Anexos/I-IN-002.4 Hoja de operaciones C.xlsx', size: 126797, date: '2025-12-29', relevance: 'core', note: 'CORE: LATEST HO template (Dec 2025, 126KB) — our HO module replicates this (form I-IN-002.4-R01)' },
        { path: 'Instructivos/INGENIERIA/Anexos/Obsoleto/I-IN-002.4 Hoja de operaciones A.xls', size: 45568, date: '2011-10-12', relevance: 'obsolete', note: 'HO Rev A (original 2011)' },
        { path: 'Instructivos/INGENIERIA/Anexos/Obsoleto/I-IN-002.4 Hoja de operaciones B.xlsx', size: 296754, date: '2022-08-09', relevance: 'obsolete', note: 'HO Rev B (2022)' },
        { path: 'Instructivos/INGENIERIA/Anexos/Obsoleto/I-IN-002.4-R01 - Hoja de operaciones.xlsx', size: 296868, date: '2023-08-11', relevance: 'obsolete', note: 'HO with R01 suffix variant (2023)' },
        { path: 'Instructivos/CALIDAD/I-AC-005.2 Plan de control C.xls', size: 46592, date: '2021-11-30', relevance: 'core', note: 'CORE: Current Control Plan template — our CP module replicates this' },

        // === HIGH relevance — inspection, reaction plans, quality alerts ===
        { path: 'Instructivos/CALIDAD/I-AC-001 Inspeccion recepcion mat. prima e insumos C.doc', size: 67584, date: '2024-09-12', relevance: 'high', note: 'Incoming inspection procedure' },
        { path: 'Instructivos/CALIDAD/I-AC-002 Inspeccion y ensayos en proceso D.doc', size: 66560, date: '2024-09-10', relevance: 'high', note: 'In-process inspection — relates to Control Plan' },
        { path: 'Instructivos/CALIDAD/I-AC-003 Inspeccion y ensayos finales de Producto Terminado B.doc', size: 83456, date: '2024-09-12', relevance: 'high', note: 'Final product inspection' },
        { path: 'Instructivos/CALIDAD/I-AC-004 Atencion de reclamos y rechazos B.doc', size: 77312, date: '2019-05-16', relevance: 'high', note: 'Claims/complaints handling — feeds into 8D' },
        { path: 'Instructivos/CALIDAD/I-AC-005 APQP Planificacion avanzada de la calidad C.doc', size: 96256, date: '2019-05-16', relevance: 'high', note: 'APQP process — parent process for AMFE/CP/HO' },
        { path: 'Instructivos/CALIDAD/I-AC-005.1 Diagrama de flujo del proceso C.xlsx', size: 83312, date: '2021-11-30', relevance: 'high', note: 'Process flow diagram template' },
        { path: 'Instructivos/CALIDAD/I-AC-005.5 SPC B.xls', size: 5324800, date: '2020-09-22', relevance: 'medium', note: 'SPC template' },
        { path: 'Instructivos/CALIDAD/I-AC-005.6 MSA C.xlsx', size: 4124549, date: '2024-08-09', relevance: 'medium', note: 'Measurement System Analysis' },
        { path: 'Instructivos/CALIDAD/I-AC-005.7 Revision de factibilidad B.xls', size: 37888, date: '2020-09-22', relevance: 'medium', note: 'Feasibility review' },
        { path: 'Instructivos/CALIDAD/I-AC-006 Inspeccion patron y set up E.doc', size: 69120, date: '2024-09-10', relevance: 'medium', note: 'Pattern and setup inspection' },
        { path: 'Instructivos/CALIDAD/I-AC-007 Gestion de calibracion de instrumentos y herramentales E.doc', size: 73728, date: '2024-09-12', relevance: 'medium' },
        { path: 'Instructivos/CALIDAD/I-AC-008 Auditoria interna de procesos C.doc', size: 87040, date: '2024-09-12', relevance: 'medium', note: 'Internal process audit' },
        { path: 'Instructivos/CALIDAD/I-AC-008.1 Check list de Auditoria por capas - LPA E.xls', size: 97792, date: '2024-09-12', relevance: 'medium', note: 'Layered Process Audit checklist' },
        { path: 'Instructivos/CALIDAD/I-AC-008.2 Check list de Auditoria de Producto C.xls', size: 83456, date: '2024-09-12', relevance: 'medium' },
        { path: 'Instructivos/CALIDAD/I-AC-008.3 Check list de Auditoria de proceso D.xls', size: 70656, date: '2024-09-11', relevance: 'medium' },
        { path: 'Instructivos/CALIDAD/I-AC-009 Revision por la direccion D.doc', size: 61440, date: '2024-09-12', relevance: 'low' },
        { path: 'Instructivos/CALIDAD/I-AC-010 Control de Material No Conforme E.doc', size: 77312, date: '2024-09-12', relevance: 'high', note: 'NC material control — relates to reaction plans' },
        { path: 'Instructivos/CALIDAD/I-AC-011 Mejora continua B.doc', size: 62464, date: '2024-07-19', relevance: 'medium', note: 'Continuous improvement' },
        { path: 'Instructivos/CALIDAD/I-AC-012 Aprobacion de partes de produccion PPAP B.doc', size: 88064, date: '2024-10-28', relevance: 'high', note: 'PPAP — requires AMFE and CP' },
        { path: 'Instructivos/CALIDAD/I-AC-012.1 PPAP checklist B.xlsx', size: 25430, date: '2024-10-28', relevance: 'medium' },

        // === MEDIUM relevance — annexes and supporting docs ===
        { path: 'Instructivos/CALIDAD/I-AC-005.4.3 Diagrama Causa efecto (Ishikawa) A.xlsx', size: 14427, date: '2019-05-16', relevance: 'medium', note: 'Ishikawa diagram template — useful for AMFE cause analysis' },
        { path: 'Instructivos/CALIDAD/I-AC-005.4 Apariencia, funcionalidad y dimensiones A.xlsx', size: 63244, date: '2020-03-13', relevance: 'medium' },
        { path: 'Instructivos/CALIDAD/I-AC-005.4.1 Matriz de caracteristicas especiales A.xlsx', size: 13753, date: '2019-05-16', relevance: 'high', note: 'CC/SC special characteristics matrix' },
        { path: 'Instructivos/CALIDAD/I-AC-005.4.2 Criterios para CC y SC A.xlsx', size: 12571, date: '2019-05-16', relevance: 'high', note: 'CC/SC criteria — used in our AMFE/CP validation' },
    ],
};

// 5B: COMPRAS (Purchasing)
const INSTRUCTIVOS_COMPRAS: SgcSection = {
    name: 'Instructivos/COMPRAS',
    description: 'Purchasing department instructions — supplier evaluation, purchasing process',
    softwareRelevance: 'LOW — Not directly related to production balancing',
    documents: [
        { path: 'Instructivos/COMPRAS/I-CO-001 Proceso de compras C.doc', size: 62976, date: '2024-07-19', relevance: 'low' },
        { path: 'Instructivos/COMPRAS/I-CO-002 Evaluacion de proveedores C.doc', size: 68608, date: '2024-07-19', relevance: 'low' },
        { path: 'Instructivos/COMPRAS/I-CO-002.1 Registro de proveedores aprobados A.xls', size: 171008, date: '2022-01-20', relevance: 'low' },
    ],
};

// 5C: DIRECCION (Management)
const INSTRUCTIVOS_DIRECCION: SgcSection = {
    name: 'Instructivos/DIRECCION',
    description: 'Management directives — customer satisfaction, objectives, KPIs',
    softwareRelevance: 'LOW — Strategic level, not operational',
    documents: [
        { path: 'Instructivos/DIRECCION/I-DI-001 Satisfaccion de clientes C.doc', size: 69632, date: '2024-07-19', relevance: 'low' },
        { path: 'Instructivos/DIRECCION/I-DI-001.1 Tablero de comando - Balanced Score Card D.xls', size: 53248, date: '2024-07-19', relevance: 'low' },
    ],
};

// 5D: INGENIERIA (Engineering)
const INSTRUCTIVOS_INGENIERIA: SgcSection = {
    name: 'Instructivos/INGENIERIA',
    description: 'Engineering instructions — process design, tooling, change control',
    softwareRelevance: 'HIGH — Engineering processes directly feed into AMFE and line balancing',
    documents: [
        { path: 'Instructivos/INGENIERIA/I-IN-001 Ingenieria de proceso B.doc', size: 84992, date: '2024-09-11', relevance: 'high', note: 'Process engineering — defines how operations are designed' },
        { path: 'Instructivos/INGENIERIA/I-IN-001.1 FICHA TECNICA B.xlsx', size: 22207, date: '2024-09-11', relevance: 'high', note: 'Technical data sheet template' },
        { path: 'Instructivos/INGENIERIA/I-IN-001.2 Solicitud de modificacion interna B.xls', size: 42496, date: '2024-09-11', relevance: 'medium', note: 'Internal modification request' },
        { path: 'Instructivos/INGENIERIA/I-IN-002 Capacitacion al operador de produccion C.doc', size: 75264, date: '2024-09-11', relevance: 'high', note: 'Operator training — references HO as training material' },
        { path: 'Instructivos/INGENIERIA/I-IN-002.1 Planilla de polivalencia B.xlsx', size: 50553, date: '2024-09-11', relevance: 'medium', note: 'Skill matrix (polivalencia)' },
        { path: 'Instructivos/INGENIERIA/I-IN-002.2 Validacion de proceso A.xls', size: 42496, date: '2020-09-22', relevance: 'medium' },
        { path: 'Instructivos/INGENIERIA/I-IN-002.3 Hoja estandar de calidad A.xlsx', size: 38804, date: '2021-11-30', relevance: 'high', note: 'Standard quality sheet — companion to HO' },
        // I-IN-002.4 is the HO template listed under CALIDAD
        { path: 'Instructivos/INGENIERIA/I-IN-003 Diseno y desarrollo de herramental e instalaciones B.doc', size: 91648, date: '2024-09-11', relevance: 'medium' },
        { path: 'Instructivos/INGENIERIA/I-IN-004 Control de cambios del producto y proceso B.doc', size: 63488, date: '2024-09-11', relevance: 'high', note: 'Change control — triggers AMFE revision and HO update' },
    ],
};

// 5E: LOGISTICA (Logistics)
const INSTRUCTIVOS_LOGISTICA: SgcSection = {
    name: 'Instructivos/LOGISTICA',
    description: 'Logistics instructions — shipping, receiving, warehousing',
    softwareRelevance: 'LOW — Logistics operations not in our scope',
    documents: [
        { path: 'Instructivos/LOGISTICA/I-LO-001 Expedicion D.doc', size: 80384, date: '2024-07-19', relevance: 'low' },
        { path: 'Instructivos/LOGISTICA/I-LO-002 Recepcion de materiales D.doc', size: 64512, date: '2024-07-19', relevance: 'low' },
        { path: 'Instructivos/LOGISTICA/I-LO-003 Almacenamiento C.doc', size: 85504, date: '2024-07-19', relevance: 'low' },
        { path: 'Instructivos/LOGISTICA/I-LO-004 Planificacion de la produccion D.doc', size: 109568, date: '2024-07-19', relevance: 'medium', note: 'Production planning — sets parameters that affect line balancing' },
    ],
};

// 5F: MANTENIMIENTO (Maintenance)
const INSTRUCTIVOS_MANTENIMIENTO: SgcSection = {
    name: 'Instructivos/MANTENIMIENTO',
    description: 'Maintenance department instructions — TPM, preventive maintenance',
    softwareRelevance: 'MEDIUM — Maintenance affects machine availability in line balancing',
    documents: [
        { path: 'Instructivos/MANTENIMIENTO/I-MT-001 Mantenimiento preventivo D.doc', size: 72704, date: '2024-07-19', relevance: 'medium', note: 'Preventive maintenance — affects machine OEE' },
        { path: 'Instructivos/MANTENIMIENTO/I-MT-001.1 Listado de Maquinas A.xlsx', size: 22040, date: '2024-07-19', relevance: 'medium', note: 'Machine list — could populate our station/machine catalog' },
        { path: 'Instructivos/MANTENIMIENTO/I-MT-001.2 Seguimiento del mantenimiento preventivo A.xlsx', size: 29025, date: '2021-11-30', relevance: 'low' },
        { path: 'Instructivos/MANTENIMIENTO/I-MT-002 Mantenimiento correctivo A.doc', size: 62976, date: '2020-09-22', relevance: 'low' },
        { path: 'Instructivos/MANTENIMIENTO/I-MT-002.1 Orden de reparacion A.xls', size: 32768, date: '2020-09-22', relevance: 'low' },
        { path: 'Instructivos/MANTENIMIENTO/I-MT-003 Solicitud de insumos de mantenimiento A.xls', size: 31232, date: '2020-09-22', relevance: 'low' },
    ],
};

// 5G: PRODUCCION (Production)
const INSTRUCTIVOS_PRODUCCION: SgcSection = {
    name: 'Instructivos/PRODUCCION',
    description: 'Production instructions — line operations, process control, visual aids',
    softwareRelevance: 'HIGH — Directly related to line balancing and HO module',
    documents: [
        { path: 'Instructivos/PRODUCCION/I-PR-001 Linea de Produccion Montaje. C.doc', size: 65024, date: '2024-09-11', relevance: 'high', note: 'Assembly line operations — core of what we balance' },
        { path: 'Instructivos/PRODUCCION/I-PR-002 Moldeo C.doc', size: 62976, date: '2024-09-11', relevance: 'high', note: 'Molding process' },
        { path: 'Instructivos/PRODUCCION/I-PR-003 Costura C.doc', size: 58368, date: '2024-09-11', relevance: 'high', note: 'Sewing process' },
        { path: 'Instructivos/PRODUCCION/I-PR-004 Corte de telas (splitting) C.doc', size: 62976, date: '2024-09-11', relevance: 'high', note: 'Fabric cutting process' },
    ],
};

// 5H: PROYECTO (Project)
const INSTRUCTIVOS_PROYECTO: SgcSection = {
    name: 'Instructivos/PROYECTO',
    description: 'Project management instructions — new product launch, APQP timing',
    softwareRelevance: 'MEDIUM — Project timing drives AMFE/CP/HO creation deadlines',
    documents: [
        { path: 'Instructivos/PROYECTO/I-PY-001 Lanzamiento de un nuevo producto B.doc', size: 71680, date: '2024-07-19', relevance: 'medium' },
        { path: 'Instructivos/PROYECTO/I-PY-001.1 Listado de actividades de proyecto B.xls', size: 33280, date: '2023-07-25', relevance: 'medium' },
        { path: 'Instructivos/PROYECTO/I-PY-001.2 Matriz RACI de proyecto B.xlsx', size: 13606, date: '2024-07-19', relevance: 'low' },
        { path: 'Instructivos/PROYECTO/I-PY-001.3 Resumen de planificacion de la calidad C.doc', size: 94208, date: '2024-07-19', relevance: 'medium', note: 'Quality planning summary — references AMFE/CP timelines' },
        { path: 'Instructivos/PROYECTO/I-PY-001.4 Planilla de lecciones aprendidas A.xlsx', size: 13651, date: '2020-09-22', relevance: 'low' },
    ],
};

// 5I: RECURSOS HUMANOS (HR)
const INSTRUCTIVOS_RRHH: SgcSection = {
    name: 'Instructivos/RECURSOS HUMANOS',
    description: 'HR instructions — operator training, skill assessment, performance evaluation',
    softwareRelevance: 'LOW — HR processes not in scope, but polivalencia matrix is relevant',
    documents: [
        { path: 'Instructivos/RECURSOS HUMANOS/I-RH-001 Incorporacion del personal A.doc', size: 64000, date: '2019-05-16', relevance: 'low' },
        { path: 'Instructivos/RECURSOS HUMANOS/I-RH-002 Evaluacion de desempeno B.doc', size: 85504, date: '2024-07-19', relevance: 'low' },
        { path: 'Instructivos/RECURSOS HUMANOS/I-RH-002.1 Formulario evaluacion 90.xls', size: 132608, date: '2024-07-19', relevance: 'low' },
        { path: 'Instructivos/RECURSOS HUMANOS/I-RH-002.2 Evaluaciones de desempeno operarios B.xlsx', size: 127095, date: '2024-07-19', relevance: 'low' },
    ],
};

// 5J: SALUD Y SEGURIDAD (Health & Safety)
const INSTRUCTIVOS_SEGURIDAD: SgcSection = {
    name: 'Instructivos/SALUD Y SEGURIDAD',
    description: 'Health & safety instructions — PPE requirements, workplace safety',
    softwareRelevance: 'HIGH — PPE requirements feed directly into HO EPP section',
    documents: [
        // This section was referenced but specific files were not fully enumerated
        // in the original catalog — the PPE pictograms we use are from this department
    ],
};

// ============================================================================
// SECTION 6: MANUAL DE FUNCIONES (Role Manuals)
// ============================================================================

const MANUAL_FUNCIONES: SgcSection = {
    name: 'Manual de funciones',
    description: 'Job descriptions and role catalogs for all positions (~43 current roles + evaluation templates)',
    softwareRelevance: 'LOW — Org structure reference, but defines who does AMFE/CP activities',
    documents: [
        { path: 'Manual de funciones/Catalogo Manuel de Funciones G.xls', size: 57856, date: '2025-04-08', relevance: 'low', note: 'Current role catalog (Rev G)' },
        // Current role docs (F-01 through F-43) with latest revisions
        { path: 'Manual de funciones/F-01 Representante de la Direccion C.doc', size: 51712, date: '2013-07-16', relevance: 'low' },
        { path: 'Manual de funciones/F-02 Direccion General C.doc', size: 59904, date: '2013-07-16', relevance: 'low' },
        { path: 'Manual de funciones/F-03 Gerente Industrial C.doc', size: 69632, date: '2013-07-16', relevance: 'low' },
        { path: 'Manual de funciones/F-06 Responsable de Calidad D.doc', size: 62464, date: '2015-03-19', relevance: 'medium', note: 'Quality Manager role — owns AMFE/CP processes' },
        { path: 'Manual de funciones/F-12 Auditor de Calidad de Proceso E.doc', size: 65024, date: '2019-03-19', relevance: 'medium', note: 'Process auditor — uses LPA checklists' },
        { path: 'Manual de funciones/F-15 At. de clientes - Calidad de Proveedores F.doc', size: 59904, date: '2020-06-22', relevance: 'low' },
        { path: 'Manual de funciones/F-16 Responsable de Ingenieria B.doc', size: 63488, date: '2019-03-19', relevance: 'medium', note: 'Engineering Manager — owns HO and process design' },
        { path: 'Manual de funciones/F-21 Analista de calidad C.doc', size: 51200, date: '2019-03-19', relevance: 'medium', note: 'Quality Analyst — creates/updates AMFE and CP' },
        // ~160+ obsolete role versions in Manual de funciones/Manual de funciones EJEMPLO/
        // ~50+ obsolete versions in Manual de funciones/Obsoletos/
    ],
};

// ============================================================================
// SECTION 7: MANUAL DEL SGC (Quality Management System Manual)
// ============================================================================

const MANUAL_SGC: SgcSection = {
    name: 'Manual del SGC',
    description: 'Quality Management System manual — 11 chapters (MC-00 through MC-10), ISO 9001/IATF 16949 structure',
    softwareRelevance: 'MEDIUM — Defines the overall QMS framework our software supports',
    documents: [
        { path: 'Manual del SGC/Catalogo Manual de gestion de la Calidad D.xls', size: 390144, date: '2022-07-26', relevance: 'medium', note: 'QMS manual catalog' },
        { path: 'Manual del SGC/Mapeo de los procesos.docx', size: 168498, date: '2019-04-25', relevance: 'medium', note: 'Process map — shows how departments interact' },
        { path: 'Manual del SGC/MC-00 Mensaje de la Direccion C.doc', size: 57856, date: '2025-02-27', relevance: 'low', note: 'Management message' },
        { path: 'Manual del SGC/MC-01 Introduccion B.doc', size: 59392, date: '2022-01-27', relevance: 'low' },
        { path: 'Manual del SGC/MC-02 Alcance y Revisiones E.doc', size: 62976, date: '2025-02-28', relevance: 'low', note: 'Scope and revisions' },
        { path: 'Manual del SGC/MC-03 Terminos y definiciones A.doc', size: 51712, date: '2022-01-27', relevance: 'medium', note: 'Terms and definitions — useful for AI prompts' },
        { path: 'Manual del SGC/MC-04 Contexto de la organizacion G.doc', size: 291840, date: '2025-04-09', relevance: 'medium', note: 'Org context (latest Rev G, April 2025)' },
        { path: 'Manual del SGC/MC-05 Liderazgo C.doc', size: 78848, date: '2025-03-26', relevance: 'low' },
        { path: 'Manual del SGC/MC-06 Planificacion D.doc', size: 63488, date: '2025-04-09', relevance: 'low' },
        { path: 'Manual del SGC/MC-07 Apoyo E.doc', size: 126976, date: '2025-04-09', relevance: 'medium', note: 'Support — training, competence, awareness' },
        { path: 'Manual del SGC/MC-08 Operacion H.doc', size: 165376, date: '2025-04-09', relevance: 'high', note: 'Operations (Rev H) — APQP, AMFE, CP, production control rules' },
        { path: 'Manual del SGC/MC-09 Evaluacion del desempeno E.doc', size: 107520, date: '2025-04-09', relevance: 'medium', note: 'Performance evaluation — KPI definitions' },
        { path: 'Manual del SGC/MC-10 Mejora E.doc', size: 90624, date: '2025-03-31', relevance: 'medium', note: 'Improvement — NC management, corrective actions' },
        { path: 'Manual del SGC/Politica de Calidad_Barack_rev 2020.docx', size: 31177, date: '2025-12-15', relevance: 'low', note: 'Quality policy' },
        { path: 'Manual del SGC/Manual del SGC.rar', size: 312147, date: '2025-03-13', relevance: 'low' },
    ],
};

// ============================================================================
// SECTION 8: MEDIO AMBIENTE (Environmental Management)
// ============================================================================

const MEDIO_AMBIENTE: SgcSection = {
    name: 'MEDIO AMBIENTE',
    description: 'Environmental management system — ISO 14001, waste management, environmental aspects',
    softwareRelevance: 'LOW — Environmental management is separate from production quality',
    documents: [
        { path: 'MEDIO AMBIENTE/Politica Medio Ambiental_Barack 2024 - Abril 2023.docx', size: 27643, date: '2024-07-19', relevance: 'low' },
        { path: 'MEDIO AMBIENTE/PLAN AUDITORIA BARACK ARGENTINA SGA ETAPA I 07-2024 (003).pdf', size: 758737, date: '2024-07-23', relevance: 'low' },
        { path: 'MEDIO AMBIENTE/MANUAL/MSGA Manual del SGA_Barack_Rev.1.docx', size: 151851, date: '2024-08-27', relevance: 'low' },
        { path: 'MEDIO AMBIENTE/MATRICES/RG-6.1.2-01 Barack_Identificacion y analisis de aspectos e impactos ambientales_Rev.0.xls', size: 96768, date: '2024-07-23', relevance: 'low' },
        { path: 'MEDIO AMBIENTE/PROCEDIMIENTOS/PG 8.1_Gestion de Residuos_Rev.1.docx', size: 34184, date: '2024-07-16', relevance: 'low' },
        { path: 'MEDIO AMBIENTE/PROCEDIMIENTOS/PG-8.2 Preparacion y respuesta ante emergencias Fecha 6-2024.doc', size: 143360, date: '2024-07-17', relevance: 'low' },
        { path: 'MEDIO AMBIENTE/INSTRUCTIVOS/Metodologia para la Segregacion y Clasificacion de Residuos9.1-.docx', size: 30650, date: '2024-07-16', relevance: 'low' },
    ],
};

// ============================================================================
// SECTION 9: PROCEDIMIENTOS (Procedures)
// ============================================================================

const PROCEDIMIENTOS: SgcSection = {
    name: 'Procedimientos',
    description: 'Company-wide procedures (P-01 through P-22) — the backbone of the QMS',
    softwareRelevance: 'HIGH — Defines rules for document control, NC handling, corrective actions, audits',
    documents: [
        { path: 'Procedimientos/Catalogo Procedimientos Calidad C.xls', size: 394752, date: '2022-07-26', relevance: 'medium', note: 'Procedures catalog' },
        { path: 'Procedimientos/Catalogo accesos a clientes.xls', size: 38400, date: '2025-09-16', relevance: 'low' },

        // P-01: Management Responsibilities
        { path: 'Procedimientos/P-01 Responsabilidades de la Direccion E.doc', size: 68608, date: '2025-04-09', relevance: 'low' },

        // P-02: QMS
        { path: 'Procedimientos/P-02 Sistema de gestion de la calidad D.doc', size: 84992, date: '2025-04-09', relevance: 'medium', note: 'QMS procedure — defines document hierarchy' },

        // P-03: Contract Review
        { path: 'Procedimientos/P-03 Revision de contrato A.doc', size: 62464, date: '2019-05-16', relevance: 'low' },

        // P-05: Document Control
        { path: 'Procedimientos/P-05 Control de los documentos C.docx', size: 78000, date: '2026-02-11', relevance: 'high', note: 'Document control (latest Feb 2026!) — defines how docs are numbered and controlled' },

        // P-07: Customer-Supplied Product
        { path: 'Procedimientos/P-07 Control de los productos suministrados por el cliente A.doc', size: 75264, date: '2019-05-16', relevance: 'low' },

        // P-08: Identification and Traceability
        { path: 'Procedimientos/P-08 Identificacion y rastreabilidad del producto E.doc', size: 1096704, date: '2022-03-23', relevance: 'medium', note: 'Traceability — lot tracking rules' },

        // P-09: Process Control
        { path: 'Procedimientos/P-09 Control de los procesos B.doc', size: 73216, date: '2020-11-24', relevance: 'high', note: 'Process control — defines how CP and HO are used in production' },

        // P-10: Inspection
        { path: 'Procedimientos/P-10 Inspeccion y ensayos B.docx', size: 39041, date: '2025-04-11', relevance: 'high', note: 'Inspection procedure (latest Rev B, April 2025)' },

        // P-11: Measurement Equipment
        { path: 'Procedimientos/P-11 Control de equipos de inspeccion, medicion y ensayo C.doc', size: 89600, date: '2024-02-06', relevance: 'medium' },

        // P-12: Inspection Status
        { path: 'Procedimientos/P-12 Estado de inspeccion y ensayo D.doc', size: 321536, date: '2025-04-10', relevance: 'medium' },

        // P-13: Non-conforming Product Control
        { path: 'Procedimientos/P-13 Control de las salidas no conformes C.doc', size: 68096, date: '2025-04-11', relevance: 'high', note: 'NC control — reaction plans, quality alerts' },

        // P-14: Corrective Actions
        { path: 'Procedimientos/P-14 No conformidad y accion correctiva D.doc', size: 83968, date: '2025-11-06', relevance: 'high', note: '8D/Corrective actions (latest Nov 2025)' },

        // P-15: Handling/Storage
        { path: 'Procedimientos/P-15 Manejo, almacenamiento, empaque, conservacion y entrega E.doc', size: 69632, date: '2025-04-11', relevance: 'low' },

        // P-16: Records Control
        { path: 'Procedimientos/P-16 Control de los registros A.doc', size: 59904, date: '2019-05-16', relevance: 'medium' },

        // P-17: Internal Audits
        { path: 'Procedimientos/P-17 Auditorias internas de calidad B.doc', size: 74752, date: '2020-09-11', relevance: 'medium' },

        // P-18: Training
        { path: 'Procedimientos/P-18 Formacion F.doc', size: 94208, date: '2025-06-04', relevance: 'medium', note: 'Training procedure (latest Rev F, June 2025)' },

        // P-20: Statistical Techniques
        { path: 'Procedimientos/P-20 Tecnicas estadisticas B.doc', size: 68096, date: '2020-07-06', relevance: 'medium', note: 'SPC rules — relates to CP measurement methods' },

        // P-21: Contingency Plans
        { path: 'Procedimientos/P-21 Planes de contingencia E.doc', size: 73728, date: '2025-09-02', relevance: 'medium', note: 'Contingency plans (latest Rev E)' },

        // P-22: Risk Analysis
        { path: 'Procedimientos/P-22 Analisis del contexto, partes interesadas y gestion de riesgos B.doc', size: 112640, date: '2020-09-07', relevance: 'medium', note: 'Risk management procedure' },

        // Key Annexes
        { path: 'Procedimientos/Anexos/P-09.1 Reaccion ante una NO conformidad B.1.xls', size: 160768, date: '2025-11-06', relevance: 'high', note: 'NC reaction plan template (latest Nov 2025)' },
        { path: 'Procedimientos/Anexos/P-13.4 Alerta de Calidad C.xlsx', size: 98329, date: '2021-07-21', relevance: 'high', note: 'Quality Alert template' },
        { path: 'Procedimientos/Anexos/P-13.7 Registro de situaciones inusuales A.2.xlsx', size: 14533, date: '2025-04-11', relevance: 'medium' },
        { path: 'Procedimientos/Anexos/P-13.8 Plan de Reaccion - Situaciones Inusuales A.xls', size: 247296, date: '2023-07-25', relevance: 'high', note: 'Unusual situation reaction plan' },
        { path: 'Procedimientos/Anexos/P-14.1 Reporte 8D B.xls', size: 253440, date: '2019-08-28', relevance: 'high', note: '8D Report template' },
        { path: 'Procedimientos/Anexos/P-14.5 Occurence and Outflow - 8D report A.xls', size: 428032, date: '2021-11-30', relevance: 'high', note: 'Occurrence and Outflow analysis for 8D' },
        { path: 'Procedimientos/Anexos/P-22 Anexo II_Analisis del Contexto y Riesgos_Barack - 2025.xlsx', size: 151393, date: '2025-02-16', relevance: 'medium' },
        { path: 'Procedimientos/Anexos/P-05.1 Catalogo de Documentos A.xls', size: 44544, date: '2025-02-28', relevance: 'medium', note: 'Master document catalog' },
    ],
};

// ============================================================================
// SECTION 10: RESPONSABLE DE SEGURIDAD DEL PRODUCTO (Product Safety)
// ============================================================================

const SEGURIDAD_PRODUCTO: SgcSection = {
    name: 'Resposable de seguridad del producto',
    description: 'Product safety representative documentation — IATF 16949 requirement',
    softwareRelevance: 'LOW — Product safety officer role, not directly in our software',
    documents: [
        { path: 'Resposable de seguridad del producto/PSCR - M. Meszaros.jpeg', size: 79262, date: '2024-08-02', relevance: 'low' },
        { path: 'Resposable de seguridad del producto/Responsable Seguridad del Producto.docx', size: 25277, date: '2021-05-13', relevance: 'low' },
    ],
};

// ============================================================================
// ROOT-LEVEL FILES
// ============================================================================

const ROOT_FILES: SgcSection = {
    name: 'Root Files',
    description: 'Top-level SGC files — defect bibles and master catalog',
    softwareRelevance: 'MEDIUM — Defect bibles are reference for AMFE failure modes',
    documents: [
        { path: 'Biblia de defectos Proyecto APB PATAGONIA.pptx', size: 1798858, date: '2026-01-30', relevance: 'medium', note: 'Defect bible — APB Patagonia project' },
        { path: 'Biblia de defectos Proyecto INSERTO PATAGONIA.pptx', size: 1709144, date: '2026-01-30', relevance: 'medium', note: 'Defect bible — Inserto Patagonia project' },
        { path: 'Biblia de defectos Proyecto IP PATAGONIA VW.pptx', size: 1494832, date: '2026-01-27', relevance: 'medium', note: 'Defect bible — IP Patagonia VW project' },
        { path: 'Catalogo SGC  - con responsables.xlsx', size: 126164, date: '2025-08-04', relevance: 'high', note: 'SGC catalog with responsible persons' },
        { path: 'Catalogo SGC.xlsx', size: 123680, date: '2026-02-10', relevance: 'high', note: 'Master SGC catalog (latest Feb 2026)' },
    ],
};

// ============================================================================
// COMPLETE CATALOG EXPORT
// ============================================================================

export const SGC_CATALOG: SgcSection[] = [
    AYUDAS_VISUALES,
    FACTIBILIDAD,
    FORMULARIOS,
    IDENTIFICACIONES,
    INSTRUCTIVOS_CALIDAD,
    INSTRUCTIVOS_COMPRAS,
    INSTRUCTIVOS_DIRECCION,
    INSTRUCTIVOS_INGENIERIA,
    INSTRUCTIVOS_LOGISTICA,
    INSTRUCTIVOS_MANTENIMIENTO,
    INSTRUCTIVOS_PRODUCCION,
    INSTRUCTIVOS_PROYECTO,
    INSTRUCTIVOS_RRHH,
    INSTRUCTIVOS_SEGURIDAD,
    MANUAL_FUNCIONES,
    MANUAL_SGC,
    MEDIO_AMBIENTE,
    PROCEDIMIENTOS,
    SEGURIDAD_PRODUCTO,
    ROOT_FILES,
];

// ============================================================================
// UTILITY: Get documents by relevance
// ============================================================================

/** Get all documents with a given relevance level */
export function getDocumentsByRelevance(relevance: SgcRelevance): SgcDocument[] {
    return SGC_CATALOG.flatMap(section => section.documents.filter(d => d.relevance === relevance));
}

/** Get all CORE documents (directly replicated in our software) */
export function getCoreDocuments(): SgcDocument[] {
    return getDocumentsByRelevance('core');
}

/** Get all documents relevant to a specific software module */
export function getDocumentsForModule(module: 'amfe' | 'controlPlan' | 'hojaOperaciones' | 'lineBalancing'): SgcDocument[] {
    const keywords: Record<string, string[]> = {
        amfe: ['AMFE', 'falla', 'failure', 'modo de falla', '005.3', 'Ishikawa', 'causa', 'CC', 'SC', 'caracteristicas especiales'],
        controlPlan: ['Plan de control', 'control plan', '005.2', 'SPC', 'MSA', 'inspeccion', 'ensayo'],
        hojaOperaciones: ['Hoja de operaciones', '002.4', 'visual', 'operacion', 'EPP', 'seguridad personal'],
        lineBalancing: ['Linea de Produccion', 'Montaje', 'Moldeo', 'Costura', 'polivalencia', 'proceso'],
    };

    const moduleKeywords = keywords[module] || [];
    return SGC_CATALOG.flatMap(section =>
        section.documents.filter(d => {
            const searchText = `${d.path} ${d.note || ''}`.toLowerCase();
            return moduleKeywords.some(kw => searchText.includes(kw.toLowerCase()));
        }),
    );
}

/** Summary statistics */
export function getSgcStats(): { totalSections: number; totalDocuments: number; byRelevance: Record<SgcRelevance, number> } {
    const allDocs = SGC_CATALOG.flatMap(s => s.documents);
    const byRelevance = { core: 0, high: 0, medium: 0, low: 0, obsolete: 0 };
    for (const d of allDocs) {
        byRelevance[d.relevance]++;
    }
    return {
        totalSections: SGC_CATALOG.length,
        totalDocuments: allDocs.length,
        byRelevance,
    };
}

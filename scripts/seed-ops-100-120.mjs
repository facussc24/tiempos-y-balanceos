// seed-ops-100-120.mjs
// Operations 100-120 for AMFE INSERTO (Patagonia / VW)
// Covers: Tapizado (100), Reproceso Adhesivo (103), Inspección Final (110, 111), Embalaje (120)

import { mkCause, mkFailure, mkFunc, mkWE, mkOp, uuid } from './seed-amfe-inserto.mjs';

// ─── Operation 100: TAPIZADO - Tapizado semiautomático ──────────────────────

const op100 = mkOp(100, 'Tapizado - Tapizado semiautomático', [
    mkWE('Machine', 'Máquina de tapizado semiautomático', [
        {
            desc: 'Tapizar el sustrato del IP con el material (piel/tela/vinilo) asegurando adhesión completa y libre de arrugas',
            req: 'Adherir el vinilo al sustrato del IP en la zona principal asegurando posición y pegado según especificación',
            failures: [
                {
                    desc: 'El operador intenta quitar la pieza durante el proceso de tapizado antes de finalizado',
                    efLocal: 'Riesgo para la salud del operador',
                    efClient: 'No afecta',
                    efUser: 'No afecta',
                    S: 10,
                    causes: [{
                        cause: 'Error del operario',
                        prev: 'Sensor de proximidad: Incorporado a la máquina (Barrera de luz / Interlock)',
                        det: 'Visual',
                        O: 2, D: 8, ap: 'L', sc: 'CC',
                        obs: 'OS/CC - Critical Characteristic. TBD: Confirmar parámetros y Poka-Yokes cuando llegue la máquina de tapizado',
                    }],
                },
                {
                    desc: 'Se coloca una pieza plástica de otro producto',
                    efLocal: 'Scrap',
                    efClient: 'No afecta',
                    efUser: 'No afecta',
                    S: 1,
                    causes: [{
                        cause: 'Error del operario',
                        prev: 'Poka-Yoke de Diseño: Moldes específicos que impiden el encastre físico de piezas incorrectas',
                        det: 'Visual',
                        O: 1, D: 8, ap: 'L',
                    }],
                },
                {
                    desc: 'Se coloca mal el vinilo',
                    efLocal: 'Potencial scrap',
                    efClient: 'Potencial parada de línea',
                    efUser: 'Reclamo de aspecto',
                    S: 8,
                    causes: [{
                        cause: 'Error del operario',
                        prev: 'Diseño del producto: Piquetes y zonas demarcadas',
                        det: 'Visual',
                        O: 3, D: 8, ap: 'M',
                    }],
                },
                {
                    desc: 'Mal colocado de la pieza plástica',
                    efLocal: 'Scrap',
                    efClient: 'Parada de línea',
                    efUser: 'Potencial reclamo',
                    S: 2,
                    causes: [{
                        cause: 'Error del operario',
                        prev: 'Poka-Yoke Técnico: La máquina detecta si la pieza está mal colocada y no realiza el proceso',
                        det: 'Visual',
                        O: 2, D: 8, ap: 'L',
                    }],
                },
                {
                    desc: 'Falla el proceso automático',
                    efLocal: 'Scrap',
                    efClient: 'Parada de línea',
                    efUser: 'Potencial reclamo',
                    S: 8,
                    causes: [{
                        cause: 'Falla de la máquina',
                        prev: 'Mantenimiento preventivo',
                        det: 'Visual: El operador ve que la máquina paró',
                        O: 5, D: 8, ap: 'M', sc: 'SC',
                    }],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador + Líder', []),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Medios / Troquel', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 103: REPROCESO: FALTA DE ADHESIVO ────────────────────────────

const op103 = mkOp(103, 'REPROCESO: FALTA DE ADHESIVO', [
    mkWE('Man', 'Operador de calidad + Líder', [
        {
            desc: 'Restaurar la conformidad del componente eliminando el defecto detectado',
            req: 'Restituir la capa de adhesivo en áreas donde estaba ausente',
            failures: [
                {
                    desc: 'Falta de adhesivo / Cobertura incompleta',
                    efLocal: 'Scrap del 100%',
                    efClient: 'Paro de línea / Problemas de Ensamble',
                    efUser: 'Apariencia / Ruido',
                    S: 8,
                    causes: [
                        {
                            cause: 'Omisión por fatiga o distracción: El operador olvida aplicar adhesivo en una sección específica por falta de ayudas visuales',
                            prev: 'Instrucciones de proceso y ayudas visuales disponibles en el puesto',
                            det: 'Inspección de calidad',
                            O: 6, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Instrucción deficiente: La Hoja de Operación Estándar (SOS) de reproceso no especifica el patrón de recorrido',
                            prev: 'La hoja de instrucción detalla el método de aplicación y el patrón de recorrido',
                            det: 'Inspección de calidad',
                            O: 4, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'La herramienta manual no carga suficiente adhesivo o el adhesivo se secó parcialmente',
                            prev: 'La pistola de adhesivado evita que se seque el adhesivo y carga una cantidad suficiente',
                            det: 'Inspección de calidad',
                            O: 3, D: 8, ap: 'M',
                        },
                    ],
                },
                {
                    desc: 'Exceso de adhesivo / se aplica adhesivo donde no corresponde',
                    efLocal: 'Retrabajo en línea',
                    efClient: 'El exceso de pegamento interfiere con los clips o puntos de fijación del IP',
                    efUser: 'Vibración, ruidos o aspecto',
                    S: 4,
                    causes: [
                        {
                            cause: 'Sobre-procesamiento: El operador aplica "doble capa" creyendo que "más es mejor"',
                            prev: 'La instrucción detalla que no se debe aplicar más de 1 vez el adhesivo',
                            det: 'Inspección de calidad',
                            O: 5, D: 8, ap: 'M', sc: 'SC',
                        },
                        {
                            cause: 'No existe una plantilla o máscara de protección para tapar zonas donde no lleva adhesivo',
                            prev: 'Instrucciones de proceso detallan donde aplicar el adhesivo',
                            det: 'Inspección de calidad',
                            O: 7, D: 8, ap: 'H', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Lapicera / Bolsas / Piquete / Medios / Etiquetas', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 110: Inspección Final - CONTROL FINAL DE CALIDAD ─────────────

const op110 = mkOp(110, 'Inspección Final - CONTROL FINAL DE CALIDAD', [
    mkWE('Man', 'Operador de calidad', [
        {
            desc: 'Asegurar la conformidad del producto terminado según Plan de Control; Prevenir el escape de piezas no conformes',
            req: 'Verificar/Confirmar la conformidad del producto terminado',
            failures: [
                {
                    desc: 'Vinilo despegado',
                    efLocal: 'SCRAP',
                    efClient: 'Rechazo de piezas / Reclamo de apariencia',
                    efUser: 'Reclamo de apariencia',
                    S: 8,
                    causes: [{
                        cause: 'Falta / ausencia de adhesivo',
                        prev: 'Hojas de operaciones / ayudas visuales',
                        det: 'Visual',
                        O: 4, D: 8, ap: 'H', sc: 'SC',
                    }],
                },
                {
                    desc: 'Aprobación de Pieza No Conforme',
                    efLocal: 'Una porción de la producción requiere Retrabajo Fuera de Línea',
                    efClient: 'Producto defectuoso desencadena Plan de Reacción Importante',
                    efUser: 'Degradación de la Función Secundaria',
                    S: 5,
                    causes: [{
                        cause: 'Omisión o error en la ejecución de la verificación',
                        prev: 'Lista de Verificación (Checklist) y Mantenimiento/Calibración de instrumentos',
                        det: 'Auditoría de Proceso y Verificación manual/visual',
                        O: 5, D: 8, ap: 'M', sc: 'SC',
                    }],
                },
            ],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Lapicera / Bolsas plásticas', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 111: Inspección Final - CLASIFICACIÓN Y SEGREGACIÓN DE PRODUCTO NO CONFORME ──

const op111 = mkOp(111, 'Inspección Final - CLASIFICACIÓN Y SEGREGACIÓN DE PRODUCTO NO CONFORME', [
    mkWE('Man', 'Operador de calidad', [
        {
            desc: 'Segregar producto (conforme y no conforme) según Plan de Control; Prevenir el escape de piezas no conformes',
            req: 'Clasificar producto (Conforme / No conforme) y Segregar producto',
            failures: [
                {
                    desc: 'Pieza NC clasificada como Conforme',
                    efLocal: 'Fuerte posibilidad de incorporar procesos adicionales de clasificación',
                    efClient: 'Parada de línea mayor a un turno completo o Suspensión de envíos',
                    efUser: 'Pérdida de la función primaria del vehículo',
                    S: 8,
                    causes: [
                        {
                            cause: 'Contenedores OK/NC no están claramente diferenciados o rotulados',
                            prev: 'Instrucción Visual',
                            det: 'Inspección Visual',
                            O: 8, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Instrucción de Trabajo del puesto de Clasificación y Segregación es ambigua respecto al destino final',
                            prev: 'Instrucción Visual',
                            det: 'Inspección Visual',
                            O: 8, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Operador coloca Pieza NC en contenedor OK por error',
                            prev: 'Instrucción Visual',
                            det: 'Inspección Visual',
                            O: 5, D: 8, ap: 'H', sc: 'SC',
                        },
                    ],
                },
                {
                    desc: 'Mezcla de producto NC con OK en el contenedor de Embalaje (Contaminación)',
                    efLocal: 'Fuerte posibilidad de clasificación adicional',
                    efClient: 'Parada de línea entre una hora y un turno. Reparación o reemplazo en campo',
                    efUser: 'Pérdida de la función primaria del vehículo',
                    S: 8,
                    causes: [
                        {
                            cause: 'Operador coloca piezas NC en OK por error de distracción',
                            prev: 'Instrucción Visual',
                            det: 'Inspección Visual',
                            O: 5, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Contenedores no están físicamente separados / El proceso de traslado no está diseñado para evitar proximidad',
                            prev: 'Instrucción Visual',
                            det: 'Inspección Visual',
                            O: 8, D: 8, ap: 'H', sc: 'SC',
                        },
                    ],
                },
                {
                    desc: 'Etiqueta o tarjeta de identificación de Scrap/Retrabajo omitida',
                    efLocal: 'Fuerte posibilidad de clasificación adicional',
                    efClient: '',
                    efUser: '',
                    S: 5,
                    causes: [
                        {
                            cause: 'Operador omite el paso de identificación',
                            prev: 'Instrucción Visual',
                            det: 'Inspección Visual',
                            O: 1, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Insumos de identificación no disponibles (No hay etiquetas/tarjetas)',
                            prev: '-',
                            det: '-',
                            O: 1, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'El procedimiento de segregación no requiere la colocación de la tarjeta antes de la colocación en el contenedor NC',
                            prev: 'Instrucción Visual',
                            det: 'Inspección Visual',
                            O: 1, D: 8, ap: 'H', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Etiquetas / Bolsas / Lapicera / Medios', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 120: Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO ──

const op120 = mkOp(120, 'Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', [
    mkWE('Man', 'Operador de calidad', [
        {
            desc: 'Mantener/Asegurar la integridad física y conformidad del producto; Establecer/Garantizar trazabilidad y conteo exacto',
            req: 'Obtener producto conforme, correctamente contenido y protegido, con trazabilidad establecida',
            failures: [
                {
                    desc: 'Pieza deformada por mal posicionamiento en el embalaje',
                    efLocal: 'Daño permanente en la espuma o en la costura',
                    efClient: 'Paro de línea temporal o devolución del lote / Defecto notorio y disconformidad inmediata',
                    efUser: '- (El error se corrige antes de llegar al usuario)',
                    S: 7,
                    causes: [{
                        cause: 'Mal posicionamiento / Sin separadores',
                        prev: 'Uso de separadores, bandejas o estructuras que mantienen la forma del apoyacabezas durante el embalaje y almacenaje',
                        det: 'Inspección visual del operador: Al momento de ubicar',
                        O: 3, D: 8, ap: 'M',
                    }],
                },
                {
                    desc: 'Colocación de mayor o menor cantidad de piezas por medio',
                    efLocal: '100% producción requiere retrabajo en estación',
                    efClient: 'Plan de reacción importante por desvío de cantidad',
                    efUser: '- (El error se corrige antes de llegar al usuario)',
                    S: 4,
                    causes: [{
                        cause: 'Falta de control en la cantidad cargada por medio debido a ausencia de guía visual o desatención del operador',
                        prev: 'Estándar visual con foto de referencia indicando la cantidad por medio, visible en el puesto de trabajo',
                        det: 'Verificación visual del medio completo antes del cierre',
                        O: 3, D: 6, ap: 'M',
                    }],
                },
            ],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Etiquetas / Bolsas / Lapicera / Medios', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Export ──────────────────────────────────────────────────────────────────

export const ops100to120 = [op100, op103, op110, op111, op120];

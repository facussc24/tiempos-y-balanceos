// ─── AMFE INSERTO: Operations 60–92 ─────────────────────────────────────────
// Troquelado, Inyección Plástica, Prearmado de Espuma, Adhesivado
// ─────────────────────────────────────────────────────────────────────────────

import { mkCause, mkFailure, mkFunc, mkWE, mkOp, mkWipOp, uuid } from './seed-amfe-inserto.mjs';

// ─── Operation 60: TROQUELADO - Troquelado de espuma ────────────────────────

const op60 = mkOp(60, 'TROQUELADO - Troquelado de espuma', [
    mkWE('Machine', 'Troqueladora puente', [
        {
            desc: 'Generar la geometría/contorno final de la pieza troquelada',
            failures: [
                {
                    desc: 'Parte ensamblada con material incorrecto',
                    efLocal: 'Scrap / Retrabajo total del lote afectado',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 8,
                    causes: [{
                        cause: 'Operario selecciona material incorrecto',
                        prev: 'La instrucción de proceso y la lista de materiales detallan que material utilizar / Identificación con código correcto correspondiente',
                        det: 'Inspección humana visual / Set up de lanzamiento',
                        O: 7, D: 8, ap: 'H', sc: 'SC',
                    }],
                },
                {
                    desc: 'Material fuera de posición',
                    efLocal: 'Scrap / Retrabajo',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 8,
                    causes: [{
                        cause: 'Operario no alinea la pieza con la referencia visual',
                        prev: 'Marcas visuales para posicionado',
                        det: 'Control visual de posicionado',
                        O: 6, D: 8, ap: 'H', sc: 'SC',
                    }],
                },
                {
                    desc: 'Troquel/Herramental incorrecto en la máquina',
                    efLocal: 'Scrap / Retrabajo total del lote',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 7,
                    causes: [{
                        cause: 'Operario selecciona troquel equivocado',
                        prev: 'Identificación correcta de troqueles y codificación colocada en HO (Documentación/Instrucción)',
                        det: 'Control visual de troquel a utilizar según HO (Inspección humana)',
                        O: 6, D: 8, ap: 'H', sc: 'SC',
                    }],
                },
                {
                    desc: 'Fallo en la Conformación de la Pieza',
                    efLocal: 'Scrap / Retrabajo',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 8,
                    causes: [{
                        cause: 'Desgaste o daño del utillaje/troquel',
                        prev: 'Mantenimiento Preventivo y Predictivo del troquel',
                        det: 'Inspección Visual 100% de la pieza',
                        O: 3, D: 8, ap: 'M', sc: '',
                        obs: 'TBD: Confirmar parámetros cuando llegue la troqueladora',
                    }],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Medios / Troquel', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 61: TROQUELADO - ALMACENAMIENTO EN MEDIOS WIP ────────────────

const op61 = mkWipOp(61, 'TROQUELADO',
    'Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona siguiente.',
    'Permitir el Ensamble de la Pieza',
    'Garantizar la Apariencia Estética del Interior y la Integridad Funcional del Producto sin Ruidos Objetables durante la Vida Útil Esperada.',
    7
);

// ─── Operation 70: INYECCIÓN PLÁSTICA - INYECCIÓN DE PIEZAS PLÁSTICAS ───────

const op70 = mkOp(70, 'INYECCIÓN PLÁSTICA - INYECCIÓN DE PIEZAS PLÁSTICAS', [
    mkWE('Machine', 'Máquina inyectora de plástico', [
        {
            desc: 'Fabricar la pieza plástica cumpliendo especificaciones dimensionales y apariencia',
            failures: [
                {
                    desc: 'Llenado Incompleto de Pieza',
                    efLocal: 'Scrap / Retrabajo',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 8,
                    causes: [
                        {
                            cause: 'Presión de Inyección fuera de especificación',
                            prev: 'Monitoreo automático de presión y mantenimiento preventivo con calibración periódica de sensores',
                            det: 'Detección automática de llenado incompleto',
                            O: 5, D: 7, ap: 'M', sc: 'SC',
                            obs: 'TBD: Parámetros de inyección a definir cuando lleguen las máquinas',
                        },
                        {
                            cause: 'Temperatura de fusión del material demasiado baja',
                            prev: 'Programa de Mantenimiento y Calibración del Sistema Térmico y Verificación Estándar de la Configuración de Potencia',
                            det: 'Verificación Visual y Dimensional de Aprobación de la Primera Pieza tras el set-up o cambio de turno',
                            O: 4, D: 8, ap: 'M', sc: 'SC',
                            obs: 'TBD: Parámetros de inyección a definir cuando lleguen las máquinas',
                        },
                    ],
                },
                {
                    desc: 'Omitir la operación de inspección dimensional de cotas index',
                    efLocal: 'Pieza fuera de especificación no detectada',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 7,
                    causes: [
                        {
                            cause: 'Operador omite la verificación dimensional de la cota index',
                            prev: 'Lista de Verificación (Checklist) para asegurar que el paso se incluya al inicio del turno',
                            det: 'Auditoría de Proceso',
                            O: 5, D: 9, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Instrucción de trabajo ambigua sobre la frecuencia o metodología',
                            prev: 'Las Hojas de Proceso describen el método operativo y las pautas de control del Plan de Control',
                            det: 'Cada dos meses se verifica una pieza con su documentación; las diferencias se registran como No Conformidades internas',
                            O: 5, D: 9, ap: 'H', sc: 'SC',
                        },
                    ],
                },
                {
                    desc: 'Rebaba Excesiva / Exceso de Material',
                    efLocal: 'Retrabajo / Scrap',
                    efClient: 'Parada de línea menor a una hora',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 7,
                    causes: [
                        {
                            cause: 'Fuerza de Cierre insuficiente',
                            prev: 'Mantenimiento Preventivo (MP) programado de la Unidad de Cierre / Instrucción de Set-up',
                            det: 'Monitoreo Automático de Presión de Cierre (Primario) / Inspección dimensional manual por muestreo (Secundario)',
                            O: 3, D: 5, ap: 'L', sc: 'SC',
                            obs: 'TBD: Parámetros de inyección a definir cuando lleguen las máquinas',
                        },
                        {
                            cause: 'Molde o cavidad contaminada con material residual',
                            prev: 'Procedimiento de limpieza y purga estandarizado para la cavidad y línea de partición del molde',
                            det: 'Inspección visual por parte del operador de la cavidad',
                            O: 5, D: 8, ap: 'M', sc: 'SC',
                        },
                        {
                            cause: 'Parámetros de Inyección configurados incorrectamente',
                            prev: 'Instrucción de Set-up Estandarizada (Plan de Control / Hoja de Proceso) que detalla valores nominales y rangos de tolerancia',
                            det: 'Aprobación de la Primera Pieza (First Piece Approval): Inspección de los parámetros de la máquina y verificación dimensional',
                            O: 5, D: 8, ap: 'M', sc: 'SC',
                            obs: 'TBD: Parámetros de inyección a definir cuando lleguen las máquinas',
                        },
                        {
                            cause: 'Mantenimiento Preventivo y Calibración de Sensores de la máquina',
                            prev: 'Mantenimiento Preventivo del molde para verificar el correcto sellado de la línea de partición',
                            det: 'Monitoreo Automático de Parámetros',
                            O: 4, D: 7, ap: 'M', sc: '',
                            obs: 'TBD: Parámetros de inyección a definir cuando lleguen las máquinas',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Etiquetas / Medios', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 71: INYECCIÓN PLÁSTICA - ALMACENAMIENTO EN MEDIOS WIP ────────
// Non-standard WIP: Failure 2 has D=4, Failure 3 has prev='-' and D=10

const op71 = mkOp(71, 'INYECCIÓN PLÁSTICA - ALMACENAMIENTO EN MEDIOS WIP', [
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        {
            desc: 'Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona de prearmado.',
            failures: [
                {
                    desc: 'Faltante/exceso de componentes en la caja del kit',
                    efLocal: 'Una porción de la producción sea descartada (scrap)',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 7,
                    causes: [{
                        cause: 'El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP.',
                        prev: 'Existencia de documentación de proceso para la preparación del kit, que guía la cantidad y tipo de componentes',
                        det: 'Verificación manual o conteo visual del kit por parte del operador',
                        O: 7, D: 8, ap: 'H', sc: 'SC',
                    }],
                },
                {
                    desc: 'Componente incorrecto (variante o color) incluido.',
                    efLocal: 'Una porción de la producción afectada debe ser desechada',
                    efClient: 'Esto requeriría una acción de reparación o reemplazo en campo o una detención del envío',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 7,
                    causes: [{
                        cause: 'Mano de Obra no realiza la verificación visual contra la Orden de Producción (OP)',
                        prev: 'La Orden de Producción (OP) se encuentra disponible y formalizada al igual que la instrucción del operador',
                        det: 'El operador compara físicamente el componente contra la referencia de la OP antes de incluirlo en el kit',
                        O: 7, D: 4, ap: 'H', sc: 'SC',
                    }],
                },
                {
                    desc: 'Pieza dañada (rasgadura, mancha) incluida en el kit.',
                    efLocal: 'Descartar (scrap) una porción de la producción',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 7,
                    causes: [{
                        cause: 'El Operador (Mano de Obra) no sigue el procedimiento de revisión visual de defectos (rasgaduras o manchas)',
                        prev: '-',
                        det: 'No existe detección implementada para este modo de falla',
                        O: 7, D: 10, ap: 'H', sc: 'SC',
                        obs: 'CRITICO: D=10 indica que NO hay detección. Definir control de inspección visual.',
                    }],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 80: PREARMADO DE ESPUMA ──────────────────────────────────────

const op80 = mkOp(80, 'PREARMADO DE ESPUMA', [
    mkWE('Man', 'Operador de producción', [
        {
            desc: 'Ensamblar Componentes (Espuma y Plástico) con Adhesión Mínima Requerida. Adherir espuma adhesivada a pieza plástica, asegurando una alineación correcta.',
            failures: [
                {
                    desc: 'Adhesión defectuosa',
                    efLocal: 'Retrabajo / Scrap',
                    efClient: 'Parada de línea menor a una hora',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 6,
                    causes: [{
                        cause: 'Error del operario / Incorrecta alineación del separador de espuma',
                        prev: 'Ayudas Visuales: Piezas patrón y Hoja de operación estándar',
                        det: 'Control visual del operario / Set Up: Autocontrol visual',
                        O: 7, D: 8, ap: 'H', sc: 'SC',
                    }],
                },
                {
                    desc: 'Pérdida de adherencia',
                    efLocal: 'Scrap / Retrabajo',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 8,
                    causes: [{
                        cause: 'Error del operario / Burbujas en el adhesivo del separador',
                        prev: '1- Piezas patrón de referencia, 2- Hoja de operación con parámetros y ayuda visual, 3- Set Up de control',
                        det: 'Control visual del operario: Verificar ausencia de burbujas',
                        O: 4, D: 6, ap: 'H', sc: 'SC',
                    }],
                },
            ],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Etiquetas / Medios', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 81: PREARMADO - ALMACENAMIENTO EN MEDIOS WIP ─────────────────

const op81 = mkWipOp(81, 'PREARMADO',
    'Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona de adhesivado.',
    'Permitir el Ensamble de la Pieza',
    'Garantizar la Apariencia Estética del Interior y la Integridad Funcional del Producto sin Ruidos Objetables durante la Vida Útil Esperada.',
    7
);

// ─── Operation 90: ADHESIVADO - ADHESIVAR PIEZAS ────────────────────────────

const op90 = mkOp(90, 'ADHESIVADO - ADHESIVAR PIEZAS', [
    mkWE('Machine', 'Pistola de adhesivado', [
        {
            desc: 'Entregar la pieza inyectada y adhesivada sin defectos. Aplicar adhesivo y unir piezas, logrando adhesión completa y uniforme.',
            failures: [
                {
                    desc: 'Adhesión insuficiente o fuera de especificación',
                    efLocal: 'Scrap / Retrabajo',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 8,
                    causes: [
                        {
                            cause: 'Uso de adhesivo o reticulante vencido/degradado (Mala gestión de Materiales)',
                            prev: 'Set-up de lanzamiento: Verificación manual de fechas de caducidad',
                            det: 'Gestión de stock (FIFO)',
                            O: 4, D: 5, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Proporción de mezcla incorrecta',
                            prev: 'Hoja de proceso detalla como realizar la mezcla correctamente',
                            det: 'Inspección visual: El operador mira la mezcla',
                            O: 7, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Exceso o falta de adhesivo',
                            prev: 'Instrucciones de proceso: Documento estándar',
                            det: 'Pieza patrón e Inspección visual: Comparación visual contra muestra límite',
                            O: 6, D: 8, ap: 'H', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Medios', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 91: ADHESIVADO - INSPECCIONAR PIEZA ADHESIVADA ───────────────
// Inspection station after Op 90 — catches the same adhesion failure

const op91 = mkOp(91, 'ADHESIVADO - INSPECCIONAR PIEZA ADHESIVADA', [
    mkWE('Machine', 'Pistola de adhesivado', [
        {
            desc: 'Verificar la conformidad de la adhesión y la característica visual del producto',
            failures: [
                {
                    desc: 'Adhesión insuficiente o fuera de especificación',
                    efLocal: 'Scrap / Retrabajo',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 8,
                    causes: [
                        {
                            cause: 'Uso de adhesivo o reticulante vencido/degradado (Mala gestión de Materiales)',
                            prev: 'Set-up de lanzamiento: Verificación manual de fechas de caducidad',
                            det: 'Gestión de stock (FIFO)',
                            O: 4, D: 5, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Proporción de mezcla incorrecta',
                            prev: 'Hoja de proceso detalla como realizar la mezcla correctamente',
                            det: 'Inspección visual: El operador mira la mezcla',
                            O: 7, D: 8, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Exceso o falta de adhesivo',
                            prev: 'Instrucciones de proceso: Documento estándar',
                            det: 'Pieza patrón e Inspección visual: Comparación visual contra muestra límite',
                            O: 6, D: 8, ap: 'H', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', []),
    mkWE('Material', 'Medios', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Operation 92: ADHESIVADO - ALMACENAMIENTO EN MEDIOS WIP ────────────────
// Non-standard WIP: Failure 2 has prev='-' and D=10, Failure 3 has D=10

const op92 = mkOp(92, 'ADHESIVADO - ALMACENAMIENTO EN MEDIOS WIP', [
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales', [
        {
            desc: 'Preparar Kit completo y ordenado de componentes (según la Orden de Producción); Contener componentes en medios definidos; Etiquetar caja con identificación mínima obligatoria (N° de parte/modelo, OP, Fecha/Turno); y Mover kits a la zona siguiente.',
            failures: [
                {
                    desc: 'Faltante/exceso de componentes en la caja del kit',
                    efLocal: 'Una porción de la producción sea descartada (scrap)',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 7,
                    causes: [{
                        cause: 'El Operador no realiza el conteo/verificación completo de la cantidad de componentes según la OP.',
                        prev: 'Existencia de documentación de proceso para la preparación del kit, que guía la cantidad y tipo de componentes',
                        det: 'Verificación manual o conteo visual del kit por parte del operador',
                        O: 7, D: 8, ap: 'H', sc: 'SC',
                    }],
                },
                {
                    desc: 'Componente incorrecto (variante o color) incluido.',
                    efLocal: 'Una porción de la producción afectada debe ser desechada',
                    efClient: 'Esto requeriría una acción de reparación o reemplazo en campo o una detención del envío',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 7,
                    causes: [{
                        cause: 'Mano de Obra no realiza la verificación visual contra la Orden de Producción (OP)',
                        prev: '-',
                        det: 'No existe detección implementada para este modo de falla',
                        O: 7, D: 10, ap: 'H', sc: 'SC',
                        obs: 'CRITICO: D=10 indica que NO hay detección ni prevención. Definir controles.',
                    }],
                },
                {
                    desc: 'Pieza dañada (rasgadura, mancha) incluida en el kit.',
                    efLocal: 'Descartar (scrap) una porción de la producción',
                    efClient: 'Parada de línea entre una hora y un turno de producción completo',
                    efUser: 'Degradación de la función secundaria del vehículo',
                    S: 7,
                    causes: [{
                        cause: 'El Operador (Mano de Obra) no sigue el procedimiento de revisión visual de defectos (rasgaduras o manchas)',
                        prev: 'Instrucción de trabajo',
                        det: 'No existe detección implementada para este modo de falla',
                        O: 7, D: 10, ap: 'H', sc: 'SC',
                        obs: 'CRITICO: D=10 indica que NO hay detección. Definir control de inspección visual.',
                    }],
                },
            ],
        },
    ]),
    mkWE('Man', 'Operador de producción / Líder de equipo', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── Export ─────────────────────────────────────────────────────────────────

export const ops60to92 = [op60, op61, op70, op71, op80, op81, op90, op91, op92];

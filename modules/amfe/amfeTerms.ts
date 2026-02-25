/**
 * AMFE VDA Terminology Definitions
 *
 * AIAG-VDA standard terms with Spanish descriptions.
 * Used for column header tooltips to guide users through the methodology.
 */

export interface AmfeTerm {
    abbrev: string;
    term: string;
    definition: string;
}

export const AMFE_TERMS: Record<string, AmfeTerm> = {
    OP_NUMBER: {
        abbrev: 'Item',
        term: 'Número de Operación',
        definition: 'Número secuencial del paso del proceso (ej: 10, 20, 30).',
    },
    OP_NAME: {
        abbrev: 'Paso',
        term: 'Nombre de Operación',
        definition: 'Descripción del paso del proceso productivo.',
    },
    WE: {
        abbrev: '6M',
        term: 'Elemento de Trabajo (6M)',
        definition: 'Componente del proceso: Máquina, Mano de Obra, Material, Método, Medio Ambiente o Medición.',
    },
    FUNC: {
        abbrev: 'Func',
        term: 'Función',
        definition: 'Qué debe hacer el elemento de trabajo. Formato: Verbo + Sustantivo (ej: "Mantener temperatura > 200C").',
    },
    FE: {
        abbrev: 'FE',
        term: 'Efecto de Falla',
        definition: '3 niveles: Efecto interno (planta propia), efecto en planta cliente, efecto en usuario final. La severidad se evalúa por el peor efecto.',
    },
    S: {
        abbrev: 'S',
        term: 'Severidad',
        definition: 'Gravedad del efecto (1-10). 10 = seguridad/regulatorio, 9 = muy severo, 1 = sin efecto perceptible. Se toma el MAX de los 3 niveles.',
    },
    FM: {
        abbrev: 'FM',
        term: 'Modo de Falla',
        definition: 'Forma en que la función puede fallar. Es el negativo/opuesto de la función (ej: "No mantiene temperatura").',
    },
    FC: {
        abbrev: 'FC',
        term: 'Causa de Falla',
        definition: 'Razón por la cual ocurre el modo de falla. Cada falla puede tener múltiples causas independientes.',
    },
    PC: {
        abbrev: 'PC',
        term: 'Control de Prevención',
        definition: 'Control que previene o reduce la probabilidad de que la causa ocurra (ej: Mantenimiento preventivo, Poka-Yoke).',
    },
    O: {
        abbrev: 'O',
        term: 'Ocurrencia',
        definition: 'Probabilidad de que la causa ocurra (1-10). 10 = muy frecuente, 1 = extremadamente improbable. Evaluar con los controles de prevención actuales.',
    },
    DC: {
        abbrev: 'DC',
        term: 'Control de Detección',
        definition: 'Control que detecta la falla o su causa antes de llegar al cliente (ej: Inspección visual, sensor automático).',
    },
    D: {
        abbrev: 'D',
        term: 'Detección',
        definition: 'Capacidad del control de detección (1-10). 10 = prácticamente imposible detectar, 1 = detección segura/automática.',
    },
    AP: {
        abbrev: 'AP',
        term: 'Prioridad de Acción',
        definition: 'H (Alto) / M (Medio) / L (Bajo). Calculado de tabla S x O x D según AIAG-VDA. AP=H requiere acción de optimización obligatoria.',
    },
    CHAR_NUM: {
        abbrev: 'No.Car',
        term: 'Número de Característica',
        definition: 'Vínculo con el Plan de Control. Referencia cruzada a la característica especial del producto/proceso.',
    },
    SPECIAL_CHAR: {
        abbrev: 'Car.',
        term: 'Característica Especial',
        definition: 'CC = Crítica (S>=9), SC = Significativa (S>=7-8). Se transfiere automáticamente al Plan de Control.',
    },
    FILTER_CODE: {
        abbrev: 'Filtro',
        term: 'Código de Filtro',
        definition: 'Código interno de clasificación/filtrado (opcional).',
    },
    PREV_ACTION: {
        abbrev: 'Acc.Prev',
        term: 'Acción Preventiva',
        definition: 'Acción de optimización para reducir ocurrencia. Obligatoria cuando AP=H.',
    },
    DET_ACTION: {
        abbrev: 'Acc.Det',
        term: 'Acción Detectiva',
        definition: 'Acción de optimización para mejorar detección. Obligatoria cuando AP=H.',
    },
    RESPONSIBLE: {
        abbrev: 'Resp.',
        term: 'Responsable',
        definition: 'Persona responsable de implementar la acción de optimización.',
    },
    TARGET_DATE: {
        abbrev: 'F.Obj.',
        term: 'Fecha Objetivo',
        definition: 'Fecha planificada de implementación de la acción.',
    },
    STATUS: {
        abbrev: 'Estado',
        term: 'Estado',
        definition: 'Pendiente, En Proceso, Completado o Cancelado.',
    },
    ACTION_TAKEN: {
        abbrev: 'Acc.Tom.',
        term: 'Acción Tomada',
        definition: 'Descripción de la acción efectivamente implementada.',
    },
    COMPLETION_DATE: {
        abbrev: 'F.Cierre',
        term: 'Fecha de Cierre',
        definition: 'Fecha real de completamiento de la acción.',
    },
    S_NEW: {
        abbrev: 'S*',
        term: 'Severidad (nueva)',
        definition: 'Severidad re-evaluada después de implementar las acciones.',
    },
    O_NEW: {
        abbrev: 'O*',
        term: 'Ocurrencia (nueva)',
        definition: 'Ocurrencia re-evaluada después de implementar las acciones.',
    },
    D_NEW: {
        abbrev: 'D*',
        term: 'Detección (nueva)',
        definition: 'Detección re-evaluada después de implementar las acciones.',
    },
    AP_NEW: {
        abbrev: 'AP*',
        term: 'AP (nueva)',
        definition: 'Prioridad de Acción re-calculada con los nuevos valores S/O/D.',
    },
    OBS: {
        abbrev: 'Obs.',
        term: 'Observaciones',
        definition: 'Notas adicionales, justificaciones o comentarios.',
    },
};

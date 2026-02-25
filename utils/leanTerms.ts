/**
 * Lean Manufacturing Terms Dictionary
 * 
 * Centralized definitions for technical terms used in the software.
 * Each term includes:
 * - term: Technical name (English)
 * - simple: Simplified name (Spanish)
 * - definition: Clear explanation for non-experts
 * - formula: Mathematical formula (if applicable)
 * - example: Practical example to illustrate the concept
 * 
 * @module leanTerms
 * @version 1.0.0
 */

export interface LeanTermDefinition {
    term: string;
    simple: string;
    definition: string;
    formula?: string;
    example?: string;
}

/**
 * Dictionary of Lean Manufacturing terms with user-friendly explanations
 */
export const LEAN_TERMS: Record<string, LeanTermDefinition> = {
    // === Production Metrics ===
    OEE: {
        term: "OEE (Overall Equipment Effectiveness)",
        simple: "Eficiencia General del Equipo",
        definition: "Mide qué tan bien funciona una máquina o estación comparado con su máximo potencial teórico. Un OEE del 100% significa producción perfecta: sin paradas y a máxima velocidad.",
        formula: "OEE = Disponibilidad × Rendimiento",
        example: "Si tu máquina tiene OEE = 85%, significa que produce 85% de lo que podría en condiciones perfectas. El 15% restante se pierde en paradas o velocidad reducida."
    },

    TAKT_TIME: {
        term: "Takt Time",
        simple: "Ritmo de Producción",
        definition: "Es el tiempo máximo que puedes tardar en producir una pieza para cumplir con la demanda del cliente. Marca el 'pulso' o ritmo ideal de la línea de producción.",
        formula: "Takt Time = Tiempo Disponible / Demanda",
        example: "Si tienes 480 minutos de trabajo por día y el cliente pide 240 piezas, tu Takt Time es 2 minutos por pieza. Cada 2 minutos debe salir una pieza terminada."
    },

    CYCLE_TIME: {
        term: "Cycle Time",
        simple: "Tiempo de Ciclo",
        definition: "Es el tiempo real que tarda en completarse un ciclo de trabajo en una estación. Idealmente debe ser menor o igual al Takt Time para cumplir la demanda.",
        formula: "Cycle Time = Tiempo de la operación más larga del ciclo",
        example: "Si una estación tarda 1.8 minutos en completar su trabajo y el Takt es 2 minutos, está bien balanceada. Si tarda 2.5 minutos, es un cuello de botella."
    },

    PCE: {
        term: "PCE (Process Cycle Efficiency)",
        simple: "Eficiencia del Ciclo del Proceso",
        definition: "Porcentaje del tiempo total (Lead Time) que realmente se agrega valor al producto. En la industria típica es entre 1-5%. Un PCE mayor a 25% se considera clase mundial.",
        formula: "PCE = (Tiempo de Valor Agregado / Lead Time) × 100",
        example: "Si una pieza tarda 10 días en atravesar la planta pero solo se trabaja en ella 4 horas totales, el PCE es muy bajo (menos de 2%)."
    },

    // === Time Metrics ===
    LEAD_TIME: {
        term: "Lead Time",
        simple: "Tiempo Total",
        definition: "Es el tiempo total desde que inicia un proceso hasta que termina. Incluye todo: tiempo de trabajo, esperas, transportes, etc.",
        formula: "Lead Time = Tiempo de Valor Agregado + Tiempo de Espera",
        example: "Si una pieza entra a la planta el lunes y sale terminada el viernes, el Lead Time es 5 días."
    },

    VA_TIME: {
        term: "Value Added Time",
        simple: "Tiempo de Valor Agregado",
        definition: "Es el tiempo en que realmente se trabaja sobre el producto para transformarlo. Es el único tiempo que el cliente estaría dispuesto a pagar.",
        example: "Soldar, ensamblar, pintar son actividades de valor agregado. Esperar, transportar o inspeccionar no agregan valor."
    },

    NVA_TIME: {
        term: "Non-Value Added Time",
        simple: "Tiempo Sin Valor Agregado",
        definition: "Es el tiempo en que el producto está en el proceso pero NO se le agrega valor: esperas, transportes, inspecciones, almacenamiento.",
        example: "Una pieza esperando en un buffer o siendo transportada entre estaciones es tiempo NVA."
    },

    CHANGEOVER_TIME: {
        term: "Changeover Time (C/O)",
        simple: "Tiempo de Cambio",
        definition: "Tiempo que toma cambiar de producir un tipo de producto a otro. Incluye ajustes, limpieza, cambio de herramientas, etc.",
        example: "Si tardas 30 minutos en preparar la máquina para cambiar de producir modelo A a modelo B, ese es tu C/O."
    },

    // === Balancing Metrics ===
    BALANCING_EFFICIENCY: {
        term: "Balancing Efficiency",
        simple: "Eficiencia del Balanceo",
        definition: "Mide qué tan bien distribuida está la carga de trabajo entre las estaciones. Un balanceo perfecto (100%) significa que todas las estaciones tienen la misma carga.",
        formula: "Eficiencia = (Suma de tiempos / (Nº estaciones × Tiempo mayor)) × 100",
        example: "Si tienes 3 estaciones con tiempos de 50s, 55s y 45s, la eficiencia del balanceo sería (150 / (3×55)) × 100 = 91%."
    },

    SATURATION: {
        term: "Station Saturation",
        simple: "Saturación de Estación",
        definition: "Porcentaje del Takt Time que una estación está ocupada. Una saturación mayor a 100% indica sobrecarga (cuello de botella).",
        formula: "Saturación = (Tiempo de Estación / Takt Time) × 100",
        example: "Si el Takt es 60s y una estación tarda 54s, su saturación es 90%. Si tarda 72s, está sobrecargada al 120%."
    },

    IDLE_TIME: {
        term: "Idle Time",
        simple: "Tiempo Ocioso",
        definition: "Tiempo en que un operario o máquina está disponible pero sin trabajo. Es desperdicio de capacidad.",
        formula: "Idle Time = Takt Time - Tiempo de Estación",
        example: "Si el Takt es 60s y la estación solo tarda 45s, hay 15s de tiempo ocioso por ciclo."
    },

    // === Inventory & Flow ===
    WIP: {
        term: "WIP (Work in Progress)",
        simple: "Trabajo en Proceso",
        definition: "Cantidad de productos que están dentro del proceso de producción: ya empezaron pero aún no terminaron. Más WIP generalmente significa más Lead Time.",
        formula: "Lead Time ≈ WIP / Tasa de Producción",
        example: "Si tienes 100 piezas en proceso y produces 10/hora, aproximadamente cada pieza tarda 10 horas en salir."
    },

    BUFFER: {
        term: "Buffer Stock",
        simple: "Stock de Amortiguación",
        definition: "Inventario intencional entre procesos para absorber variaciones y evitar que las estaciones se queden sin trabajo.",
        example: "Un buffer de 2 horas entre soldadura y pintura significa que pintura puede seguir trabajando 2 horas si soldadura se detiene."
    },

    KANBAN: {
        term: "Kanban",
        simple: "Señal de Reposición",
        definition: "Sistema visual para controlar el flujo de materiales. Cuando se consume un contenedor, la tarjeta Kanban señala que hay que reponer.",
        formula: "Nº Kanbans = (Demanda × Lead Time × Factor de Seguridad) / Capacidad del Contenedor",
        example: "Si consumes 10 piezas/hora, el proveedor tarda 2 horas en reponer, y usas contenedores de 15 piezas, necesitas al menos 2 Kanbans."
    },

    // === Lean Concepts ===
    HEIJUNKA: {
        term: "Heijunka",
        simple: "Nivelación de Producción",
        definition: "Técnica de programar la producción para evitar picos y valles. En vez de hacer primero todo modelo A y luego todo modelo B, se alternan en pequeños lotes.",
        example: "En lugar de hacer 100 piezas A por la mañana y 100 B por la tarde, hacer A-B-A-B en lotes de 10 cada 30 minutos."
    },

    YAMAZUMI: {
        term: "Yamazumi Chart",
        simple: "Gráfico de Carga de Trabajo",
        definition: "Gráfico de barras apiladas que muestra visualmente la carga de trabajo de cada estación comparada con el Takt Time. Ayuda a identificar desbalances.",
        example: "Las barras que sobrepasan la línea del Takt indican estaciones sobrecargadas; las muy bajas indican capacidad ociosa."
    },

    VSM: {
        term: "VSM (Value Stream Mapping)",
        simple: "Mapa de Flujo de Valor",
        definition: "Diagrama que visualiza todo el flujo de materiales e información desde el proveedor hasta el cliente. Ayuda a identificar desperdicios y oportunidades de mejora.",
        example: "Un VSM típico muestra procesos (rectángulos), inventarios (triángulos) y la 'escalera de tiempo' que separa valor agregado de esperas."
    },

    // === Personnel ===
    HEADCOUNT: {
        term: "Headcount",
        simple: "Cantidad de Operarios",
        definition: "Número total de personas necesarias para operar la línea de producción al ritmo requerido.",
        formula: "Headcount = Tiempo Total de Trabajo / (Takt Time × Eficiencia)",
        example: "Si el trabajo total suma 600 segundos, el Takt es 60s y la eficiencia es 85%, necesitas 600/(60×0.85) ≈ 12 operarios."
    },

    MULTI_MANNING: {
        term: "Multi-Manning",
        simple: "Operarios en Paralelo",
        definition: "Asignar más de un operario a una misma estación para dividir el trabajo y reducir el tiempo de ciclo.",
        example: "Si una estación tarda 120s y el Takt es 60s, poner 2 operarios trabajando en paralelo reduce el tiempo efectivo a 60s."
    }
};

/**
 * Get a term definition by key
 * @param key - The term key (e.g., 'OEE', 'TAKT_TIME')
 * @returns The term definition or undefined
 */
export function getTerm(key: string): LeanTermDefinition | undefined {
    return LEAN_TERMS[key.toUpperCase().replace(/\s+/g, '_')];
}

/**
 * Get all terms for a category
 * Useful for building help pages or glossaries
 */
export function getAllTerms(): LeanTermDefinition[] {
    return Object.values(LEAN_TERMS);
}

/**
 * Search terms by keyword
 * @param keyword - Search keyword
 * @returns Array of matching terms
 */
export function searchTerms(keyword: string): LeanTermDefinition[] {
    const lowerKeyword = keyword.toLowerCase();
    return Object.values(LEAN_TERMS).filter(term =>
        term.term.toLowerCase().includes(lowerKeyword) ||
        term.simple.toLowerCase().includes(lowerKeyword) ||
        term.definition.toLowerCase().includes(lowerKeyword)
    );
}

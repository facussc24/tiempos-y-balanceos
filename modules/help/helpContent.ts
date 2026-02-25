/**
 * Help Center Content Module
 * 
 * All static content for the HelpCenter component.
 * Extracted to improve maintainability and allow independent testing.
 * 
 * @module helpContent
 */

import {
    BookOpen, Activity, BarChart2, Calculator,
    Users, Clock, Split, ClipboardCheck, LayoutList,
    Network, Box, Rocket, Target, Layers, Binary, Scale, SortDesc
} from 'lucide-react';

// ==================== TYPES ====================
export interface HelpItem {
    term: string;
    definition: string;
    category: 'General' | 'Cálculos' | 'Simulación' | 'Balanceo' | 'Prerrequisitos';
    icon: React.ComponentType<{ size?: number; className?: string }>;
}

export type HelpTab = 'start' | 'concepts' | 'formulas' | 'faq';

export interface QuickStartStep {
    step: number;
    title: string;
    desc: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: ColorKey;
}

export interface FaqItem {
    q: string;
    a: string;
}

export interface FormulaItem {
    title: string;
    symbol: string;
    formula: string;
    desc: string;
    color: ColorKey;
}

// ==================== COLOR MAP ====================
// Explicit color map to avoid Tailwind JIT issues
export const COLOR_MAP = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', bgLight: 'bg-blue-50', border: 'border-blue-100' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', bgLight: 'bg-indigo-50', border: 'border-indigo-100' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', bgLight: 'bg-purple-50', border: 'border-purple-100' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', bgLight: 'bg-emerald-50', border: 'border-emerald-100' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', bgLight: 'bg-amber-50', border: 'border-amber-100' },
} as const;

export type ColorKey = keyof typeof COLOR_MAP;

// ==================== GLOSSARY ====================
export const GLOSSARY: HelpItem[] = [
    {
        term: "Diagrama de Red (PDM)",
        definition: "Representación gráfica de la secuencia lógica de producción. Los Nodos (Círculos) son tareas y las Flechas indican dependencia. Regla Clave: Una tarea no puede iniciar hasta que sus predecesoras terminen. Es el 'mapa' vital para calcular el Peso Posicional (RPW) y evitar errores de secuencia en el balanceo.",
        category: "Prerrequisitos",
        icon: Network
    },
    {
        term: "Checklist: Trabajo Estandarizado",
        definition: "Antes de cronometrar, ¿el método es consistente? Si cada operario hace la tarea de forma diferente, los tiempos no sirven. Defina primero el paso a paso.",
        category: "Prerrequisitos",
        icon: ClipboardCheck
    },
    {
        term: "Checklist: 5S y Orden",
        definition: "La inestabilidad destruye el balanceo. Si el operario pierde tiempo buscando herramientas, el estudio de tiempos se contamina. Asegure 'Un lugar para cada cosa' antes de medir.",
        category: "Prerrequisitos",
        icon: LayoutList
    },
    {
        term: "Takt Time (Ritmo Cliente)",
        definition: "Es la velocidad a la que debes producir para satisfacer la demanda. Se calcula como: Tiempo Disponible / Demanda Diaria. Si produces más lento que el Takt, no entregas a tiempo. Si produces más rápido, generas sobreproducción.",
        category: "General",
        icon: Clock
    },
    {
        term: "OEE (Eficiencia Global)",
        definition: "Indicador que mide qué tan efectiva es tu línea. Considera Disponibilidad (¿La máquina funciona?) y Rendimiento (¿Va a la velocidad correcta?). Barack Mercosul reduce el tiempo disponible basándose en este porcentaje para ser realista.",
        category: "General",
        icon: Activity
    },
    {
        term: "Tiempo Estándar",
        definition: "Es el tiempo que debería tardar un operario calificado trabajando a un ritmo normal. Incluye el tiempo promedio observado, ajustado por la valoración del ritmo (VR) y los suplementos por fatiga.",
        category: "Cálculos",
        icon: Calculator
    },
    {
        term: "Desviación Estándar (σ)",
        definition: "Mide qué tan 'inestable' es un operario. Si un operario tarda 10s, luego 15s, luego 8s, tiene una desviación alta (σ alta). Esto genera riesgo de cuellos de botella aleatorios.",
        category: "Cálculos",
        icon: BarChart2
    },
    {
        term: "Concurrencia (Tiempo Absorbido)",
        definition: "Ocurre cuando un operario realiza una tarea manual MIENTRAS la máquina está trabajando (Ciclo Automático). El tiempo manual se 'esconde' o absorbe detrás del tiempo de máquina, reduciendo el ciclo total.",
        category: "Balanceo",
        icon: Split
    },
    {
        term: "Multi-Manning (Réplicas)",
        definition: "Estrategia de poner múltiples recursos (operarios o máquinas) en paralelo en una misma estación para dividir la carga de trabajo y cumplir con un Takt Time agresivo.",
        category: "Balanceo",
        icon: Users
    },
    {
        term: "Lead Time (Tiempo de Entrega)",
        definition: "Tiempo total que una pieza tarda en recorrer la línea desde entrada hasta salida (puerta a puerta). Es la suma del tiempo de proceso (VA) y el tiempo de espera en inventarios (NVA). Reducir el Lead Time es el objetivo principal del VSM.",
        category: "General",
        icon: Clock
    },
    {
        term: "PCE (Eficiencia de Ciclo de Proceso)",
        definition: "Process Cycle Efficiency = (Tiempo VA / Lead Time Total) × 100. Mide qué porcentaje del tiempo total agrega valor. Típico: 1-5%, Lean Intermedio: 5-15%, Lean Avanzado: 15-25%, World Class: >25%.",
        category: "Cálculos",
        icon: Activity
    },
    {
        term: "Ley de Little (WIP Calculator)",
        definition: "Lead Time = WIP / Demanda. Fórmula fundamental del VSM. Explica por qué reducir el inventario (WIP) es la clave para reducir el tiempo de entrega. Más inventario = más tiempo esperando.",
        category: "Cálculos",
        icon: Box
    },
    {
        term: "Tiempo Ponderado (mix)",
        definition: "En líneas mixtas, es el promedio de tiempo de una tarea considerando la demanda relativa de cada producto. Si el Producto A (70%) tarda 10s y el Producto B (30%) tarda 20s, el tiempo ponderado es 13s. El balanceo usa este valor para saturar estaciones.",
        category: "Cálculos",
        icon: Scale
    },
    {
        term: "Heijunka (Nivelación)",
        definition: "Técnica para suavizar la producción mezclando modelos en una secuencia fija (ej: A-A-B-A-A-B) en lugar de lotes grandes. Reduce el inventario y estabiliza la carga de trabajo en estaciones que varían por modelo.",
        category: "Balanceo",
        icon: SortDesc
    }
];

// ==================== QUICK START ====================
export const QUICK_START: QuickStartStep[] = [
    { step: 1, title: "Vincular Carpeta", desc: "Conecta tu carpeta de proyectos (local o de red) para guardar y gestionar archivos.", icon: Layers, color: "blue" },
    { step: 2, title: "Crear Tareas", desc: "Define las operaciones del proceso con sus tiempos estándar y dependencias.", icon: ClipboardCheck, color: "indigo" },
    { step: 3, title: "Configurar Demanda", desc: "Establece la demanda diaria, turnos activos y OEE objetivo en el Panel.", icon: Target, color: "purple" },
    { step: 4, title: "Balancear Línea", desc: "Asigna tareas a estaciones para optimizar el flujo y cumplir el Takt Time.", icon: BarChart2, color: "emerald" },
    { step: 5, title: "Simular Flujo", desc: "Ejecuta la simulación de flujo para validar el balanceo con eventos discretos.", icon: Binary, color: "amber" },
];

// ==================== FAQ ====================
export const FAQ_ITEMS: FaqItem[] = [
    {
        q: "¿Por qué la eficiencia supera 100%?",
        a: "En sistemas con Multi-Manning, múltiples operarios trabajan en paralelo sobre una misma estación. Esto puede mostrar >100% de 'saturación' porque estás utilizando más de un recurso para cumplir el ciclo. Es normal y esperado en líneas con máquinas/inyectoras."
    },
    {
        q: "¿Cómo interpreto el semáforo de riesgo?",
        a: "🟢 Verde (<5%): Proceso robusto, ejecutar con confianza. 🟡 Amarillo (5-15%): Sensible, monitorear de cerca. 🔴 Rojo (>15%): Riesgo inaceptable, requiere rebalanceo o agregar recursos."
    },
    {
        q: "¿Qué es el Tiempo Disponible vs Pérdida por Balanceo?",
        a: "El 'Tiempo Disponible' (vs Takt) mide el tiempo libre del operario por ciclo para hacer tareas secundarias. La 'Pérdida por Balanceo' (vs TCR) mide el tiempo desperdiciado por imperfecciones en la distribución de carga."
    },
    {
        q: "¿Por qué me pide Desviación Estándar (σ)?",
        a: "La desviación estándar mide la variabilidad real de tus operarios. Se usa para detectar outliers y calcular el tamaño de muestra necesario. Puedes ingresar múltiples tomas de tiempo (mínimo 5) o estimar manualmente un σ aproximado."
    },
    {
        q: "¿Puedo usar el software sin conectar una carpeta?",
        a: "Sí, existe el 'Modo Local/Demo' que guarda todo en la memoria del navegador. Sin embargo, perderás los datos si limpias el cache. Para proyectos reales, se recomienda vincular una carpeta."
    },
    {
        q: "¿Qué significa 'Concurrencia' en una tarea?",
        a: "Indica que la tarea manual se ejecuta MIENTRAS la máquina trabaja. El tiempo se 'absorbe' detrás del ciclo automático, reduciendo el tiempo total. Si separas tareas concurrentes, el tiempo absorbido se convierte en penalización."
    },
];

// ==================== FORMULAS ====================
export const FORMULAS: FormulaItem[] = [
    {
        title: "Tiempo de Ciclo Objetivo (Takt Time)",
        symbol: "C_req",
        formula: "T_Disponible / Demanda",
        desc: "Formula: C_req = T_P/P. Es el ritmo cardiaco de la línea. Si produces más lento, no cumples. Si produces más rápido, generas sobreproducción.",
        color: "blue"
    },
    {
        title: "Eficiencia de Línea (E)",
        symbol: "E",
        formula: "( Σ T_Tareas ) / ( N_Real * TCR )",
        desc: "Mide el uso del tiempo. NOTA: Valores >100% (Súper-Utilización) son normales en Multi-Manning, indicando que se usan varios operarios para acelerar una estación por encima del ciclo base.",
        color: "indigo"
    },
    {
        title: "Mínimo Teórico de Estaciones",
        symbol: "N_min",
        formula: "RedondeoUp( Σ T_Neto / Tc )",
        desc: "Número ideal de estaciones asumiendo una distribución perfecta. Es el límite inferior teórico.",
        color: "emerald"
    },
    {
        title: "Tiempo de Ciclo Real",
        symbol: "TCR",
        formula: "Max( Estación_1, ..., Estación_n )",
        desc: "El tiempo de la estación más lenta (cuello de botella). Dicta la velocidad de salida real de toda la línea.",
        color: "amber"
    },
    {
        title: "Peso Posicional (RPW)",
        symbol: "RPW",
        formula: "T_Tarea + Σ T_Sucesoras",
        desc: "Prioridad de asignación. Tareas con más sucesores tienen mayor peso y deben asignarse primero para respetar precedencias.",
        color: "purple"
    },
];

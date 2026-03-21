/**
 * Control Plan Defaults
 *
 * Intelligent defaults for auto-filling Control Plan fields based on
 * AMFE data (AP, severity, phase). Validated against AIAG-VDA standard
 * and Control Plan 1st Edition (2024) via NotebookLM consultation.
 *
 * Rules:
 * - sampleSize/Frequency: based on AP + phase
 * - reactionPlan: based on severity level
 * - specification: inferred from failure/cause description keywords
 * - reactionPlanOwner: inferred from severity + AP + operation category
 * - evaluationTechnique (process rows): inferred from detection control keywords
 */

import { ControlPlanPhase } from './controlPlanTypes';

type ActionPriority = 'H' | 'M' | 'L' | '';

interface DefaultsInput {
    ap: ActionPriority;
    severity: number;
    phase: ControlPlanPhase;
}

interface DefaultsOutput {
    sampleSize: string;
    sampleFrequency: string;
    reactionPlan: string;
    /** Which fields were auto-filled — for UI suggestion markers. */
    autoFilledFields: string[];
}

/**
 * Get suggested defaults for a Control Plan item based on AMFE cause data.
 * Returns empty strings for fields that should NOT be auto-filled.
 */
export function getControlPlanDefaults(input: DefaultsInput): DefaultsOutput {
    const { ap, severity, phase } = input;
    const isPreLaunch = phase === 'preLaunch';
    const autoFilledFields: string[] = [];

    // --- Sample Size & Frequency ---
    // Per AIAG CP 2024: Pre-Launch = 100%; Production = event-based (plant standard)
    let sampleSize = '';
    let sampleFrequency = '';

    if (ap === 'H') {
        sampleSize = '100%';
        sampleFrequency = '100%';
        autoFilledFields.push('sampleSize', 'sampleFrequency');
    } else if (ap === 'M') {
        if (isPreLaunch) {
            sampleSize = '100%';
            sampleFrequency = '100% (Pre-Lanzamiento)';
        } else if (severity >= 9) {
            sampleSize = '1 pieza';
            sampleFrequency = 'Inicio y fin de turno';
        } else {
            sampleSize = '1 pieza';
            sampleFrequency = 'Cada lote';
        }
        autoFilledFields.push('sampleSize', 'sampleFrequency');
    } else if (ap === 'L') {
        // AP=L items only reach here if they are SC/CC (IATF 16949 §8.3.3.3).
        // Reduced controls: event-based monitoring.
        if (severity >= 9) {
            // CC with low AP: residual risk high due to severity
            sampleSize = '1 pieza';
            sampleFrequency = 'Cada lote';
        } else if (severity >= 5) {
            // SC with low AP: periodic control
            sampleSize = '1 pieza';
            sampleFrequency = 'Cada lote';
        }
        if (sampleSize) {
            autoFilledFields.push('sampleSize', 'sampleFrequency');
        }
        // reactionPlan is severity-based (below) — still applies for AP=L SC/CC
    }

    // --- Reaction Plan based on Severity ---
    let reactionPlan = '';

    if (severity >= 9) {
        reactionPlan = 'Detener línea. Escalar a Gerencia. Segregar producto.';
        autoFilledFields.push('reactionPlan');
    } else if (severity >= 7) {
        reactionPlan = 'Contener producto sospechoso. Verificar últimas N piezas. Corregir proceso.';
        autoFilledFields.push('reactionPlan');
    } else if (severity >= 4) {
        reactionPlan = 'Ajustar proceso. Reinspeccionar último lote.';
        autoFilledFields.push('reactionPlan');
    }
    // severity < 4: leave empty for user to decide

    return { sampleSize, sampleFrequency, reactionPlan, autoFilledFields };
}

// ─── Inference helpers (ported from seed script heuristics) ─────────────────

/**
 * Infer specification text from failure/cause description keywords.
 * For PRODUCT rows: analyzes failure.description.
 * For PROCESS rows: analyzes cause.cause.
 */
export function inferSpecification(
    rowType: 'product' | 'process',
    failDescription: string,
    causeDescription: string,
): string {
    if (rowType === 'product') {
        const d = (failDescription || '').toLowerCase();
        if (d.includes('fuera de medida') || d.includes('dimensional')) return 'Según plano / tolerancia dimensional';
        if (d.includes('contaminación') || d.includes('suciedad')) return 'Libre de contaminación visual';
        if (d.includes('adhesión') || d.includes('adhesivo') || d.includes('despegu')) return 'Adhesión completa sin despegues';
        if (d.includes('costura') || d.includes('hilo') || d.includes('puntada')) return 'Costura continua según especificación';
        if (d.includes('aspecto') || d.includes('apariencia') || d.includes('visual')) return 'Sin defectos visuales de aspecto';
        if (d.includes('refilado') || d.includes('rebaba')) return 'Conforme a pieza patrón';
        if (d.includes('deformad') || d.includes('deformación')) return 'Sin deformaciones';
        if (d.includes('identificación') || d.includes('trazabilidad') || d.includes('etiqueta')) return 'Identificación completa (código, lote, fecha)';
        if (d.includes('parámetro') || d.includes('temperatura')) return 'Dentro de rango de set-up';
        if (d.includes('golpe') || d.includes('daño') || d.includes('rotura')) return 'Sin daños físicos visibles';
        if (d.includes('falta') || d.includes('ausencia') || d.includes('omisión')) return 'Presencia verificada al 100%';
        if (d.includes('color') || d.includes('tono')) return 'Color conforme a muestra patrón';
        // AIAG-VDA: specification is from engineering design — do not use a generic fallback
        return '';
    } else {
        const d = (causeDescription || '').toLowerCase();
        if (d.includes('temperatura')) return 'Rango de temperatura según set-up';
        if (d.includes('tiempo') || d.includes('ciclo')) return 'Tiempos de ciclo según set-up';
        if (d.includes('presión')) return 'Presión según parámetros de proceso';
        if (d.includes('color') || d.includes('variante')) return 'Color/variante según OP';
        if (d.includes('vencimiento') || d.includes('fecha')) return 'Dentro de fecha de vigencia';
        if (d.includes('cantidad') || d.includes('conteo')) return 'Cantidad según remito/OP';
        if (d.includes('torque') || d.includes('ajuste')) return 'Torque/ajuste según especificación';
        if (d.includes('velocidad')) return 'Velocidad según parámetros de proceso';
        return 'Según instrucción de proceso';
    }
}

/**
 * Infer reaction plan owner from severity, AP, and operation category.
 * Returns a role (not a specific person) as a starting point for the user.
 */
export function inferReactionPlanOwner(
    severity: number,
    ap: ActionPriority,
    operationCategory: string,
): string {
    const cat = (operationCategory || '').toLowerCase();
    if (severity >= 9 || ap === 'H') {
        if (cat === 'inspeccion' || cat === 'clasificacion' || cat === 'control') {
            return 'Supervisor de Calidad';
        }
        return 'Líder de Producción / Calidad';
    }
    if (severity >= 7) {
        return 'Líder de Producción';
    }
    return 'Operador de Producción';
}

/**
 * Infer evaluation technique for PROCESS rows from detection control text.
 * Product rows already get evaluationTechnique from cause.detectionControl directly.
 */
export function inferProcessEvaluationTechnique(detectionControl: string): string {
    const d = (detectionControl || '').toLowerCase();
    if (d.includes('visual')) return 'Inspección visual';
    if (d.includes('auditor')) return 'Auditoría de proceso';
    if (d.includes('set') || d.includes('puesta')) return 'Verificación de set-up';
    if (d.includes('dimensional') || d.includes('calibre') || d.includes('galga')) return 'Control dimensional';
    if (d.includes('monitor') || d.includes('sensor') || d.includes('automát')) return 'Monitoreo automático';
    if (d.includes('poka') || d.includes('yoke') || d.includes('interlock')) return 'Poka-Yoke / Dispositivo anti-error';
    if (d.includes('registro') || d.includes('planilla')) return 'Verificación documental';
    if (d) return 'Verificación operativa';
    return '';
}

/**
 * Check if a Control Plan document has missing required fields that should
 * block export. Returns list of issues.
 */
export function validateControlPlanForExport(
    items: { reactionPlanOwner: string; reactionPlan: string; sampleSize: string; controlMethod: string }[]
): string[] {
    const issues: string[] = [];
    let missingOwnerCount = 0;

    for (const item of items) {
        if (!item.reactionPlanOwner.trim()) {
            missingOwnerCount++;
        }
    }

    if (missingOwnerCount > 0) {
        issues.push(
            `${missingOwnerCount} item(s) sin Responsable de Reaccion. ` +
            `Debe asignarse una persona especifica (operador, supervisor), no un departamento generico.`
        );
    }

    return issues;
}

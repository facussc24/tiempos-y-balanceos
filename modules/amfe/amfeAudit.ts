/**
 * AMFE Audit Module
 *
 * Deterministic checks for AMFE quality and completeness,
 * plus optional AI-powered review for top-risk causes.
 *
 * Checks run instantly (no API calls). AI review is separate and optional.
 */

import { AmfeDocument, AmfeCause, AmfeFailure, ActionPriority } from './amfeTypes';
import { queryGemini, GeminiError } from '../../utils/geminiClient';

// ============================================================================
// TYPES
// ============================================================================

export type AuditSeverity = 'critical' | 'warning' | 'info';

export interface AuditIssue {
    severity: AuditSeverity;
    category: string;
    message: string;
    /** Location path for navigation: "Op > WE > Func > Failure > Cause" */
    location: string;
    /** Suggestion for fixing the issue */
    suggestion?: string;
}

export interface AuditReport {
    issues: AuditIssue[];
    /** Summary counts */
    critical: number;
    warnings: number;
    info: number;
    /** Score 0-100 (higher = better) */
    score: number;
    /** Timestamp of the audit */
    timestamp: number;
}

export interface AiReviewResult {
    missingFailureModes: string[];
    controlGaps: string[];
    generalObservations: string[];
}

// ============================================================================
// DETERMINISTIC AUDIT CHECKS
// ============================================================================

/**
 * Run all deterministic audit checks on an AmfeDocument.
 * Returns an AuditReport with issues sorted by severity.
 */
export function runAudit(doc: AmfeDocument): AuditReport {
    const issues: AuditIssue[] = [];

    if (doc.operations.length === 0) {
        issues.push({
            severity: 'info',
            category: 'Estructura',
            message: 'El AMFE no tiene operaciones definidas.',
            location: 'Documento',
        });
        return buildReport(issues);
    }

    // Check each operation
    for (const op of doc.operations) {
        const opName = op.name || op.opNumber || 'Operación sin nombre';

        // Check: Operation has at least 1 work element
        if (op.workElements.length === 0) {
            issues.push({
                severity: 'warning',
                category: 'Estructura',
                message: 'Operación sin elementos de trabajo (6M).',
                location: opName,
                suggestion: 'Agregar al menos un elemento 6M (Máquina, Mano de Obra, etc.).',
            });
            continue;
        }

        // Check: Operation has at least 2 different 6M types
        const uniqueTypes = new Set(op.workElements.map(we => we.type));
        if (uniqueTypes.size < 2) {
            issues.push({
                severity: 'info',
                category: '6M Cobertura',
                message: `Solo ${uniqueTypes.size} tipo(s) de 6M. Se recomienda al menos 2.`,
                location: opName,
                suggestion: 'Considerar agregar elementos de otros tipos 6M para mejor cobertura.',
            });
        }

        for (const we of op.workElements) {
            for (const func of we.functions) {
                // Check: Function has at least 1 failure mode
                if (func.failures.length === 0) {
                    issues.push({
                        severity: 'warning',
                        category: 'Completitud',
                        message: 'Función sin modos de falla definidos.',
                        location: `${opName} > ${we.type} > ${func.description || 'Función'}`,
                        suggestion: 'Cada función debe tener al menos un modo de falla analizado.',
                    });
                }

                for (const fail of func.failures) {
                    const failLoc = `${opName} > ${fail.description || 'Falla'}`;
                    const s = toNum(fail.severity);

                    // Check: Failure mode has a description
                    if (!fail.description?.trim()) {
                        issues.push({
                            severity: 'warning',
                            category: 'Completitud',
                            message: 'Modo de falla sin descripción.',
                            location: `${opName} > ${we.type} > ${func.description || 'Función'}`,
                        });
                    }

                    // Check: Severity is assigned
                    if (s === 0) {
                        issues.push({
                            severity: 'warning',
                            category: 'Riesgo',
                            message: 'Severidad (S) no asignada.',
                            location: failLoc,
                            suggestion: 'Asignar severidad de 1 a 10 segun escala AIAG-VDA.',
                        });
                    }

                    // Check: At least one cause
                    if (fail.causes.length === 0) {
                        issues.push({
                            severity: 'warning',
                            category: 'Completitud',
                            message: 'Modo de falla sin causas definidas.',
                            location: failLoc,
                            suggestion: 'Agregar al menos una causa raiz.',
                        });
                    }

                    for (const cause of fail.causes) {
                        const causeLoc = `${failLoc} > ${cause.cause || 'Causa'}`;
                        const o = toNum(cause.occurrence);
                        const d = toNum(cause.detection);
                        const ap = String(cause.ap || '').toUpperCase();

                        // Check: Cause has a description
                        if (!cause.cause?.trim()) {
                            issues.push({
                                severity: 'info',
                                category: 'Completitud',
                                message: 'Causa sin descripcion.',
                                location: failLoc,
                            });
                        }

                        // Check: AP=H without completed actions
                        if (ap === 'H') {
                            const hasPreventiveAction = cause.preventionAction?.trim();
                            const hasDetectionAction = cause.detectionAction?.trim();
                            const hasResponsible = cause.responsible?.trim();
                            const hasTargetDate = cause.targetDate?.trim();

                            if (!hasPreventiveAction && !hasDetectionAction) {
                                issues.push({
                                    severity: 'critical',
                                    category: 'AP Alto',
                                    message: 'AP=H sin acciones preventivas ni detectivas asignadas.',
                                    location: causeLoc,
                                    suggestion: 'Las causas AP=H requieren acciones obligatorias segun AIAG-VDA.',
                                });
                            }
                            if (!hasResponsible) {
                                issues.push({
                                    severity: 'critical',
                                    category: 'AP Alto',
                                    message: 'AP=H sin responsable asignado.',
                                    location: causeLoc,
                                });
                            }
                            if (!hasTargetDate) {
                                issues.push({
                                    severity: 'critical',
                                    category: 'AP Alto',
                                    message: 'AP=H sin fecha objetivo.',
                                    location: causeLoc,
                                });
                            }
                        }

                        // Check: O>6 without prevention control
                        if (o > 6 && !cause.preventionControl?.trim()) {
                            issues.push({
                                severity: 'warning',
                                category: 'Controles',
                                message: `O=${o} sin control preventivo definido.`,
                                location: causeLoc,
                                suggestion: 'Las causas con ocurrencia alta necesitan controles preventivos.',
                            });
                        }

                        // Check: D>6 without detection control
                        if (d > 6 && !cause.detectionControl?.trim()) {
                            issues.push({
                                severity: 'warning',
                                category: 'Controles',
                                message: `D=${d} sin control de deteccion definido.`,
                                location: causeLoc,
                                suggestion: 'Las causas con deteccion baja necesitan metodos de deteccion.',
                            });
                        }

                        // Check: Generic controls for high severity
                        if (s >= 8) {
                            const generic = isGenericControl(cause.preventionControl) || isGenericControl(cause.detectionControl);
                            if (generic) {
                                issues.push({
                                    severity: 'warning',
                                    category: 'Controles',
                                    message: 'Control generico para severidad alta (S≥8). Se recomienda control especifico.',
                                    location: causeLoc,
                                    suggestion: 'Para S>=8, usar controles especificos: Poka-Yoke, SPC, inspeccion 100%.',
                                });
                            }
                        }

                        // Check: O/D not assigned when cause has text
                        if (cause.cause?.trim()) {
                            if (o === 0) {
                                issues.push({
                                    severity: 'info',
                                    category: 'Riesgo',
                                    message: 'Ocurrencia (O) no asignada.',
                                    location: causeLoc,
                                });
                            }
                            if (d === 0) {
                                issues.push({
                                    severity: 'info',
                                    category: 'Riesgo',
                                    message: 'Deteccion (D) no asignada.',
                                    location: causeLoc,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    return buildReport(issues);
}

// ============================================================================
// AI REVIEW (optional, 1 API call)
// ============================================================================

const AI_REVIEW_SYSTEM_PROMPT = `Eres un auditor experto en AMFE (PFMEA) AIAG-VDA para manufactura automotriz.

Revisa el AMFE proporcionado y busca:
1. Modos de falla FALTANTES tipicos para cada operacion
2. Brechas en controles (causas sin controles adecuados)
3. Observaciones generales de calidad

RESPONDE con JSON estricto sin markdown:
{
  "missingFailureModes": ["modo faltante 1 (en operacion X)", "..."],
  "controlGaps": ["brecha 1", "..."],
  "generalObservations": ["observacion 1", "..."]
}

Maximo 5 items por categoria. Se conciso y especifico.`;

/**
 * Request an AI review of the AMFE for completeness.
 * Sends top-risk items to Gemini for analysis.
 *
 * @param doc - The AMFE document to review
 * @param signal - Optional AbortSignal
 * @returns AiReviewResult with AI observations
 * @throws GeminiError on API failures
 */
export async function requestAiReview(
    doc: AmfeDocument,
    signal?: AbortSignal,
): Promise<AiReviewResult> {
    const { serializeAmfeCompact } = await import('./amfeChangeAnalysis');
    const serialized = serializeAmfeCompact(doc);
    if (!serialized) {
        throw new GeminiError('El AMFE esta vacio.', 'PARSE_ERROR');
    }

    const userPrompt = `AMFE A REVISAR:
${serialized}

Identifica modos de falla faltantes, brechas en controles y observaciones generales.`;

    const result = await queryGemini(
        AI_REVIEW_SYSTEM_PROMPT,
        userPrompt,
        30000,
        signal,
    );

    return parseAiReviewResponse(result.text);
}

/**
 * Parse AI review response.
 */
export function parseAiReviewResponse(text: string): AiReviewResult {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objMatch) {
        throw new GeminiError('No se pudo parsear la respuesta de revision IA', 'PARSE_ERROR');
    }

    try {
        const parsed = JSON.parse(objMatch[0]);
        return {
            missingFailureModes: toStringArray(parsed.missingFailureModes, 5),
            controlGaps: toStringArray(parsed.controlGaps, 5),
            generalObservations: toStringArray(parsed.generalObservations, 5),
        };
    } catch {
        throw new GeminiError('Respuesta de revision IA no es JSON valido', 'PARSE_ERROR');
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function toNum(v: number | string | undefined): number {
    if (v == null || v === '') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
}

/** Check if a control text is too generic */
function isGenericControl(text?: string): boolean {
    if (!text?.trim()) return false;
    const lower = text.toLowerCase().trim();
    const genericPatterns = [
        'inspeccion visual',
        'control visual',
        'revision visual',
        'verificacion visual',
        'chequeo visual',
        'autocontrol',
        'operador verifica',
    ];
    return genericPatterns.some(p => lower === p || lower.startsWith(p + ' '));
}

function buildReport(issues: AuditIssue[]): AuditReport {
    // Sort: critical first, then warning, then info
    const sortOrder: Record<AuditSeverity, number> = { critical: 0, warning: 1, info: 2 };
    issues.sort((a, b) => sortOrder[a.severity] - sortOrder[b.severity]);

    const critical = issues.filter(i => i.severity === 'critical').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const info = issues.filter(i => i.severity === 'info').length;

    // Simple scoring: start at 100, subtract per issue type
    const score = Math.max(0, Math.min(100,
        100 - (critical * 15) - (warnings * 5) - (info * 1)
    ));

    return {
        issues,
        critical,
        warnings,
        info,
        score,
        timestamp: Date.now(),
    };
}

function toStringArray(value: any, maxItems: number): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((v: any) => typeof v === 'string' && v.trim())
        .slice(0, maxItems)
        .map(String);
}

/**
 * B4_classificationErrors.ts
 *
 * Audit: Cross-check AMFE severity/occurrence/detection/AP ratings against
 * CP classifications (CC/SC) and internal consistency rules.
 *
 * Rules checked:
 *   R1 — High severity without CC/SC in CP
 *   R2 — AP=H without corrective action
 *   R3 — O=1 AND D=1 simultaneously (statistically implausible)
 *   R4 — Empty effects on failure modes
 *   R5 — Severity > 0 without effects
 *   R6 — Detection rating vs control type mismatch
 */
import {
    ensureAuth,
    fetchAllAmfeDocs,
    fetchAllCpDocs,
    writeResults,
} from './supabaseHelper.js';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Finding {
    product: string;
    docId: string;
    operation: string;
    opNumber: string;
    failureMode?: string;
    cause?: string;
    severity?: number;
    occurrence?: number;
    detection?: number;
    ap?: string;
    rule: string;
    level: 'ERROR' | 'WARNING';
    reason: string;
    cpSpecialChar?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Safely parse a numeric value that may be string or number. Returns NaN if invalid. */
function num(value: unknown): number {
    if (value === null || value === undefined || value === '') return NaN;
    return Number(value);
}

/** Check if a string is empty/blank */
function isEmpty(s: unknown): boolean {
    return !s || String(s).trim() === '';
}

/** Normalize text for keyword matching (lowercase, strip accents) */
function norm(s: string): string {
    return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    await ensureAuth();
    console.log('Auth OK — fetching documents...');

    const [amfeDocs, cpDocs] = await Promise.all([
        fetchAllAmfeDocs(),
        fetchAllCpDocs(),
    ]);

    console.log(`Fetched: ${amfeDocs.length} AMFE, ${cpDocs.length} CP`);

    // ── Build map: AMFE doc ID → CP doc ────────────────────────────────────
    const cpByAmfeId = new Map<string, Array<{ id: string; raw: any; parsed: any }>>();
    for (const cp of cpDocs) {
        const linkedAmfeId = cp.raw.linked_amfe_id as string;
        if (linkedAmfeId) {
            const arr = cpByAmfeId.get(linkedAmfeId) || [];
            arr.push(cp);
            cpByAmfeId.set(linkedAmfeId, arr);
        }
    }

    const findings: Finding[] = [];

    // ── Walk every AMFE document ───────────────────────────────────────────
    for (const amfeDoc of amfeDocs) {
        const product = (amfeDoc.raw.project_name as string) || amfeDoc.id;
        const operations = amfeDoc.parsed.operations || [];

        // Get linked CP docs for this AMFE
        const linkedCps = cpByAmfeId.get(amfeDoc.id) || [];
        // Collect all CP items across linked CPs, indexed by processStepNumber
        const cpItemsByOpNumber = new Map<string, any[]>();
        for (const cp of linkedCps) {
            for (const item of (cp.parsed.items || [])) {
                const stepNum = String(item.processStepNumber || '').trim();
                const arr = cpItemsByOpNumber.get(stepNum) || [];
                arr.push(item);
                cpItemsByOpNumber.set(stepNum, arr);
            }
        }

        for (const op of operations) {
            const opName = op.name || '';
            const opNumber = String(op.opNumber || '?');
            const workElements = op.workElements || [];

            // Get CP items for this operation number
            const cpItemsForOp = cpItemsByOpNumber.get(opNumber) || [];

            // Determine best CC/SC classification for this operation in CP
            const cpHasCC = cpItemsForOp.some((item: any) => item.specialCharClass === 'CC');
            const cpHasSC = cpItemsForOp.some((item: any) =>
                item.specialCharClass === 'SC' || item.specialCharClass === 'CC'
            );
            const cpBestClass = cpHasCC ? 'CC' : cpItemsForOp.some((item: any) => item.specialCharClass === 'SC') ? 'SC' : '';

            for (const we of workElements) {
                for (const fn of (we.functions || [])) {
                    for (const failure of (fn.failures || [])) {
                        const failureDesc = failure.description || '(sin descripción)';
                        const severity = num(failure.severity);

                        // ── Rule 4: Empty effects ──────────────────────────────
                        const localEmpty = isEmpty(failure.effectLocal);
                        const nextEmpty = isEmpty(failure.effectNextLevel);
                        const endUserEmpty = isEmpty(failure.effectEndUser);
                        const allEffectsEmpty = localEmpty && nextEmpty && endUserEmpty;

                        if (allEffectsEmpty) {
                            findings.push({
                                product,
                                docId: amfeDoc.id,
                                operation: opName,
                                opNumber,
                                failureMode: failureDesc,
                                severity: isNaN(severity) ? undefined : severity,
                                rule: 'R4',
                                level: 'ERROR',
                                reason: 'Modo de falla sin ningún efecto definido (local, siguiente nivel, usuario final). Todo modo de falla debe tener al menos un efecto.',
                            });
                        }

                        // ── Rule 5: Severity > 0 without effects ──────────────
                        if (!isNaN(severity) && severity > 0 && allEffectsEmpty) {
                            findings.push({
                                product,
                                docId: amfeDoc.id,
                                operation: opName,
                                opNumber,
                                failureMode: failureDesc,
                                severity,
                                rule: 'R5',
                                level: 'ERROR',
                                reason: `Severidad ${severity} asignada pero los 3 campos de efecto están vacíos. La severidad debe derivarse de los efectos.`,
                            });
                        }

                        // ── Rule 1: High severity without CC/SC ────────────────
                        // Only check if we have linked CP docs
                        if (linkedCps.length > 0 && !isNaN(severity)) {
                            if (severity >= 9 && !cpHasCC) {
                                findings.push({
                                    product,
                                    docId: amfeDoc.id,
                                    operation: opName,
                                    opNumber,
                                    failureMode: failureDesc,
                                    severity,
                                    rule: 'R1',
                                    level: 'ERROR',
                                    reason: `Severidad ${severity} (≥9) requiere clasificación CC en Plan de Control. ${cpBestClass ? `Actual: ${cpBestClass}` : 'No hay CC ni SC para esta operación en CP.'}`,
                                    cpSpecialChar: cpBestClass || '(vacío)',
                                });
                            }

                            // Severity 5-8: check for SC if any cause has O>=4
                            if (severity >= 5 && severity <= 8) {
                                const hasHighOccurrence = (failure.causes || []).some((c: any) => {
                                    const o = num(c.occurrence);
                                    return !isNaN(o) && o >= 4;
                                });
                                if (hasHighOccurrence && !cpHasSC) {
                                    findings.push({
                                        product,
                                        docId: amfeDoc.id,
                                        operation: opName,
                                        opNumber,
                                        failureMode: failureDesc,
                                        severity,
                                        rule: 'R1',
                                        level: 'ERROR',
                                        reason: `Severidad ${severity} con O≥4 requiere clasificación SC (o CC) en Plan de Control. ${cpBestClass ? `Actual: ${cpBestClass}` : 'No hay SC ni CC para esta operación en CP.'}`,
                                        cpSpecialChar: cpBestClass || '(vacío)',
                                    });
                                }
                            }
                        }

                        // ── Walk causes ────────────────────────────────────────
                        for (const cause of (failure.causes || [])) {
                            const causeDesc = cause.cause || '(sin causa)';
                            const occurrence = num(cause.occurrence);
                            const detection = num(cause.detection);

                            // ── Rule 2: AP=H without corrective action ────────
                            if (cause.ap === 'H') {
                                const hasPrevAction = !isEmpty(cause.preventionAction);
                                const hasDetAction = !isEmpty(cause.detectionAction);
                                if (!hasPrevAction && !hasDetAction) {
                                    findings.push({
                                        product,
                                        docId: amfeDoc.id,
                                        operation: opName,
                                        opNumber,
                                        failureMode: failureDesc,
                                        cause: causeDesc,
                                        severity: isNaN(severity) ? undefined : severity,
                                        occurrence: isNaN(occurrence) ? undefined : occurrence,
                                        detection: isNaN(detection) ? undefined : detection,
                                        ap: 'H',
                                        rule: 'R2',
                                        level: 'ERROR',
                                        reason: 'AP=H (prioridad alta) sin acción correctiva. Debe tener al menos una acción de prevención o detección.',
                                    });
                                }
                            }

                            // ── Rule 3: O=1 AND D=1 ───────────────────────────
                            if (!isNaN(occurrence) && !isNaN(detection) && occurrence === 1 && detection === 1) {
                                findings.push({
                                    product,
                                    docId: amfeDoc.id,
                                    operation: opName,
                                    opNumber,
                                    failureMode: failureDesc,
                                    cause: causeDesc,
                                    severity: isNaN(severity) ? undefined : severity,
                                    occurrence: 1,
                                    detection: 1,
                                    ap: cause.ap || '',
                                    rule: 'R3',
                                    level: 'WARNING',
                                    reason: 'O=1 y D=1 simultáneamente es estadísticamente implausible: la falla supuestamente nunca ocurre Y siempre se detecta.',
                                });
                            }

                            // ── Rule 6: Detection rating vs control mismatch ──
                            if (!isNaN(detection)) {
                                const controlText = norm(cause.detectionControl || '');

                                // Good detection (D<=3) — check if control justifies it
                                if (detection <= 3 && controlText.length > 0) {
                                    const hasAutomatedKeyword = /automat|poka.yoke|sensor|camara|camera|galga|celda/.test(controlText);
                                    if (!hasAutomatedKeyword) {
                                        findings.push({
                                            product,
                                            docId: amfeDoc.id,
                                            operation: opName,
                                            opNumber,
                                            failureMode: failureDesc,
                                            cause: causeDesc,
                                            detection,
                                            rule: 'R6',
                                            level: 'WARNING',
                                            reason: `D=${detection} (detección muy buena) pero el control de detección no menciona métodos automáticos (poka-yoke, sensor, cámara, etc.): "${cause.detectionControl || ''}"`,
                                        });
                                    }
                                }

                                // Poor detection (D>=8) but control claims automated method
                                if (detection >= 8 && controlText.length > 0) {
                                    const claimsAutomated = /poka.yoke|automatico/.test(controlText);
                                    if (claimsAutomated) {
                                        findings.push({
                                            product,
                                            docId: amfeDoc.id,
                                            operation: opName,
                                            opNumber,
                                            failureMode: failureDesc,
                                            cause: causeDesc,
                                            detection,
                                            rule: 'R6',
                                            level: 'WARNING',
                                            reason: `D=${detection} (detección pobre) pero el control menciona poka-yoke o automático: "${cause.detectionControl || ''}". Si el control es automático, D debería ser ≤3.`,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Summary ─────────────────────────────────────────────────────────────

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  B4: CLASSIFICATION & RATING ERRORS AUDIT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Group by rule
    const byRule = new Map<string, Finding[]>();
    for (const f of findings) {
        const arr = byRule.get(f.rule) || [];
        arr.push(f);
        byRule.set(f.rule, arr);
    }

    const errors = findings.filter(f => f.level === 'ERROR');
    const warnings = findings.filter(f => f.level === 'WARNING');

    console.log(`Total findings: ${findings.length}`);
    console.log(`  ERRORS: ${errors.length}`);
    console.log(`  WARNINGS: ${warnings.length}`);
    console.log();

    const ruleDescriptions: Record<string, string> = {
        R1: 'Severidad alta sin CC/SC en Plan de Control',
        R2: 'AP=H sin acción correctiva',
        R3: 'O=1 y D=1 simultáneamente (implausible)',
        R4: 'Modo de falla sin efectos',
        R5: 'Severidad > 0 sin efectos',
        R6: 'Detección vs tipo de control inconsistente',
    };

    for (const rule of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) {
        const ruleFindingsArr = byRule.get(rule) || [];
        const ruleErrors = ruleFindingsArr.filter(f => f.level === 'ERROR').length;
        const ruleWarnings = ruleFindingsArr.filter(f => f.level === 'WARNING').length;

        console.log(`── ${rule}: ${ruleDescriptions[rule]} ──`);
        console.log(`   Count: ${ruleFindingsArr.length} (${ruleErrors} errors, ${ruleWarnings} warnings)`);

        if (ruleFindingsArr.length === 0) {
            console.log('   (ninguno encontrado)\n');
            continue;
        }

        for (const f of ruleFindingsArr) {
            console.log(`   [${f.level}] ${f.product} — OP ${f.opNumber}: "${f.operation}"`);
            if (f.failureMode) console.log(`     Falla: "${f.failureMode}"`);
            if (f.cause) console.log(`     Causa: "${f.cause}"`);

            const ratings: string[] = [];
            if (f.severity !== undefined) ratings.push(`S=${f.severity}`);
            if (f.occurrence !== undefined) ratings.push(`O=${f.occurrence}`);
            if (f.detection !== undefined) ratings.push(`D=${f.detection}`);
            if (f.ap) ratings.push(`AP=${f.ap}`);
            if (f.cpSpecialChar) ratings.push(`CP=${f.cpSpecialChar}`);
            if (ratings.length > 0) console.log(`     Ratings: ${ratings.join(', ')}`);

            console.log(`     ${f.reason}`);
            console.log();
        }
    }

    // ── By product summary ──────────────────────────────────────────────────
    const byProduct = new Map<string, Finding[]>();
    for (const f of findings) {
        const arr = byProduct.get(f.product) || [];
        arr.push(f);
        byProduct.set(f.product, arr);
    }

    console.log('── POR PRODUCTO ───────────────────────────────────────────────\n');
    for (const [product, productFindings] of byProduct) {
        const pErrors = productFindings.filter(f => f.level === 'ERROR').length;
        const pWarnings = productFindings.filter(f => f.level === 'WARNING').length;
        console.log(`  ${product}: ${productFindings.length} (${pErrors} errors, ${pWarnings} warnings)`);
    }

    // ── Write results ───────────────────────────────────────────────────────

    const results = {
        timestamp: new Date().toISOString(),
        summary: {
            totalFindings: findings.length,
            errors: errors.length,
            warnings: warnings.length,
            byRule: Object.fromEntries(
                ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map(r => [r, (byRule.get(r) || []).length])
            ),
            byProduct: Object.fromEntries(
                [...byProduct.entries()].map(([p, arr]) => [p, arr.length])
            ),
        },
        findings,
    };

    writeResults('B4_classificationErrors.json', results);

    console.log('\nDone.');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});

/**
 * _markFlamabilidadCC.mjs — Marca causas de flamabilidad como CC en los AMFEs de cabina interior.
 *
 * Regla:
 *   - Cabina interior = todos los AMFEs (Patagonia Headrest/Armrest/Insert/IP_PADS/Top Roll + Telas PWA/HILUX)
 *   - `.claude/rules/amfe.md`: "Flamabilidad es OBLIGATORIA como CC en toda pieza de cabina interior"
 *   - Regla CC: S>=9 O requerimiento legal/seguridad (flamabilidad es legal/seguridad)
 *
 * Matching:
 *   - Primario: texto de la causa (cause || description) contiene "flamab", "flamm",
 *     "flammability", "combustib", "TL 1010", "BSDM0500"
 *   - Propagado: si el modo de falla PADRE menciona flamabilidad, TODAS sus causas
 *     se tratan como causas de flamabilidad (para cubrir el caso "Material fuera de
 *     especificacion requerida" bajo fm.description="Flamabilidad fuera de norma")
 *
 * Para cada causa que matchee:
 *   - Si specialChar es '' o null: setear a "CC"
 *   - Si severity < 9: subir a 9
 *   - Recalcular AP con calculateAP() oficial (puede subir a H)
 *   - characteristicNumber vacio: dejar vacio (NO inventar)
 *
 * Si un AMFE no tiene causas de flamabilidad: skip (NO inventar causas nuevas).
 *
 * Uso:
 *   node scripts/_markFlamabilidadCC.mjs             # dry-run
 *   node scripts/_markFlamabilidadCC.mjs --apply     # escribir a Supabase
 */

import {
    connectSupabase,
    listAmfes,
    readAmfe,
    saveAmfe,
    calculateAP,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';

// Keywords que identifican una causa de flamabilidad (case-insensitive substring match).
const FLAM_KEYWORDS = [
    'flamab',
    'flamm',
    'flammability',
    'combustib',
    'tl 1010',
    'tl1010',
    'bsdm0500',
    'bsdm 0500',
];

function matchesFlamability(text) {
    if (!text) return false;
    const norm = String(text).toLowerCase();
    return FLAM_KEYWORDS.some(k => norm.includes(k));
}

async function main() {
    const { apply } = parseSafeArgs();
    const sb = await connectSupabase();

    const amfes = await listAmfes(sb);
    console.log(`Encontrados ${amfes.length} AMFEs en Supabase.\n`);

    const amfesWithFlam = [];
    const amfesWithoutFlam = [];
    let totalCausesMarked = 0;

    for (const meta of amfes) {
        const { id, amfe_number, doc } = await readAmfe(sb, meta.id);

        let modifiedInThisAmfe = 0;
        const changesForAudit = [];

        // Recorrer operations -> workElements -> functions -> failures -> causes
        for (const op of doc.operations || []) {
            const opNum = String(op.opNumber || op.operationNumber || '');
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fm of fn.failures || []) {
                        const failureIsFlam = matchesFlamability(fm.description || '');
                        for (const cause of fm.causes || []) {
                            const causeText = cause.cause || cause.description || '';
                            const causeIsFlam = matchesFlamability(causeText);
                            if (!failureIsFlam && !causeIsFlam) continue;
                            const text = causeText || fm.description || '';

                            // Match: se aplican las 3 transformaciones
                            const before = {
                                specialChar: cause.specialChar ?? '',
                                severity: cause.severity,
                                ap: cause.ap ?? cause.actionPriority ?? '',
                            };

                            let changed = false;

                            // 1) specialChar vacio -> CC
                            const scCurrent = (cause.specialChar ?? '').toString().trim().toUpperCase();
                            if (scCurrent === '') {
                                cause.specialChar = 'CC';
                                changed = true;
                            }

                            // 2) severity < 9 -> subir a 9 (flamabilidad debe ser 9-10)
                            const sevNum = Number(cause.severity);
                            if (!Number.isFinite(sevNum) || sevNum < 9) {
                                cause.severity = 9;
                                changed = true;
                            }

                            // 3) Recalcular AP con tabla oficial
                            const newAp = calculateAP(
                                Number(cause.severity),
                                Number(cause.occurrence),
                                Number(cause.detection)
                            );
                            if (newAp && newAp !== (cause.ap || cause.actionPriority)) {
                                cause.ap = newAp;
                                cause.actionPriority = newAp;
                                changed = true;
                            } else if (newAp) {
                                // Asegurar alias sincronizados (ambos deben existir)
                                cause.ap = newAp;
                                cause.actionPriority = newAp;
                            }

                            // characteristicNumber vacio: dejar vacio (NO inventar)

                            if (changed) {
                                modifiedInThisAmfe++;
                                totalCausesMarked++;
                                changesForAudit.push({
                                    op: opNum,
                                    text: text.slice(0, 60),
                                    before,
                                    after: {
                                        specialChar: cause.specialChar,
                                        severity: cause.severity,
                                        ap: cause.ap,
                                    },
                                });
                            }
                        }
                    }
                }
            }
        }

        if (modifiedInThisAmfe === 0) {
            amfesWithoutFlam.push({ id, amfe_number, project: meta.project_name });
            continue;
        }

        amfesWithFlam.push({
            id,
            amfe_number,
            project: meta.project_name,
            count: modifiedInThisAmfe,
            changes: changesForAudit,
        });

        for (const ch of changesForAudit) {
            logChange(apply, `${amfe_number} OP${ch.op} "${ch.text}"`, {
                before: `SC="${ch.before.specialChar}" S=${ch.before.severity} AP=${ch.before.ap}`,
                after: `SC="${ch.after.specialChar}" S=${ch.after.severity} AP=${ch.after.ap}`,
            });
        }

        if (apply) {
            await saveAmfe(sb, id, doc, { expectedAmfeNumber: amfe_number });
        }
    }

    console.log('\n=== RESUMEN ===');
    console.log(`Total causas marcadas CC: ${totalCausesMarked}`);
    console.log(`\nAMFEs con causas de flamabilidad (${amfesWithFlam.length}):`);
    for (const a of amfesWithFlam) {
        console.log(`  - ${a.amfe_number} [${a.project || '-'}] (${a.count} causas)`);
    }
    console.log(`\nAMFEs SIN causas de flamabilidad (${amfesWithoutFlam.length}) — GAP, Fak decide si dicta manualmente:`);
    for (const a of amfesWithoutFlam) {
        console.log(`  - ${a.amfe_number} [${a.project || '-'}]`);
    }

    finish(apply);
}

main().catch(e => {
    console.error('ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
});

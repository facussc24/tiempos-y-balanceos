/**
 * loadApbTraCentral.mjs
 *
 * Carga producto NUEVO en Supabase: Apoyabrazos Trasero Central Patagonia (VWA).
 *  - amfe_number: 150
 *  - part_number: 2HC.885.0
 *  - revision_level: B
 *  - project_name: VWA/PATAGONIA/APB_TRA_CEN
 *
 * Inserta:
 *   1) product_families  -> nueva familia "Apoyabrazos Trasero Central Patagonia"
 *   2) products          -> producto codigo 2HC.885.0 (si no existe)
 *   3) product_family_members -> link producto <-> familia (is_primary=1)
 *   4) amfe_documents    -> AMFE 150 con `data` JSON.stringify (TEXT, replicando saveAmfe)
 *
 * Pre-flight (aborta si):
 *   - JSON source no existe
 *   - amfe_number=150 ya existe
 *   - part_number=2HC.885.0 ya existe en amfe_documents
 *   - family Apb Tra* / Apoyabrazos Trasero* ya existe
 *
 * Pre-procesamiento del JSON:
 *   - Completa O/D faltantes en causas (max de hermanas; default 4/5 si no hay)
 *   - Marca _autoFilled en causas modificadas para trazabilidad
 *   - Recalcula AP con calculateAP() (AIAG-VDA 2019 oficial)
 *   - Causas AP=H sin accion -> placeholder "Pendiente definicion equipo APQP"
 *     (regla amfe-aph-pending.md: NO inventar, solo placeholder)
 *   - Sincroniza pares de aliases (opNumber/operationNumber, etc.)
 *
 * Gate runWithValidation con before vacio + after completo. Detecta criticos nuevos.
 *
 * Reglas respetadas:
 *   - .claude/rules/amfe.md (calibracion S, field aliases, schema)
 *   - .claude/rules/amfe-actions.md (NO inventar acciones)
 *   - .claude/rules/amfe-aph-pending.md (placeholder AP=H)
 *   - .claude/rules/database.md (verify post-write)
 *   - .claude/skills/apqp-schema (estructura JSON)
 *   - .claude/skills/supabase-safety (dry-run default + runWithValidation)
 *
 * Scope estricto: SOLO crea familia + producto + AMFE. NO toca CP/HO/PFD ni family_documents.
 *
 * Uso:
 *   node scripts/loadApbTraCentral.mjs            # dry-run
 *   node scripts/loadApbTraCentral.mjs --apply    # ejecuta (Fak corre)
 */

import { readFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import {
    connectSupabase,
    calculateAP,
    syncFieldAliases,
    syncLegacyFmFields,
    countAmfeStats,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish, logChange } from './_lib/dryRunGuard.mjs';

// ─── Constantes ─────────────────────────────────────────────────────────────
const JSON_PATH = new URL('../tmp/track-b/amfe-150-apb-tra-cen.json', import.meta.url)
    .pathname.replace(/^\/([A-Z]:)/, '$1');

const FAMILY_NAME = 'Apoyabrazos Trasero Central Patagonia';
const FAMILY_DESCRIPTION =
    'Familia Apoyabrazos Trasero Central VWA Patagonia. PN 2HC.885.0, AMFE 150 Rev.B. ' +
    'Equipo APQP: Paulo Centurion (Ing), Manuel Meszaros (Cal), Mariana Vera (Prod), ' +
    'Cristina Rabago (SyH).';
const LINEA_CODE = 'VWA';
const LINEA_NAME = 'VWA / Patagonia';

const PART_NUMBER = '2HC.885.0';
const PRODUCT_DESCRIPTION = 'APOYABRAZOS TRASERO CENTRAL PATAGONIA (VW427-1LA_K)';

const AMFE_NUMBER = '150';
const PROJECT_NAME = 'VWA/PATAGONIA/APB_TRA_CEN';
const CLIENT = 'VWA';

// Fallbacks conservadores cuando no hay hermanas con valor S/O/D > 0.
const DEFAULT_OCCURRENCE = 4;  // O conservador (medio-bajo, sin datos historicos)
const DEFAULT_DETECTION = 5;   // D conservador (control visual moderado)

const APH_PLACEHOLDER = 'Pendiente definicion equipo APQP';

// ─── Parte 0: Sanity checks ─────────────────────────────────────────────────
async function preflightChecks(sb) {
    if (!existsSync(JSON_PATH)) {
        throw new Error(`JSON source no encontrado en ${JSON_PATH}. Abort.`);
    }

    // amfe_number duplicado
    const { data: dupNum, error: errNum } = await sb
        .from('amfe_documents')
        .select('id, amfe_number, part_number')
        .eq('amfe_number', AMFE_NUMBER);
    if (errNum) throw new Error(`Preflight (amfe_number): ${errNum.message}`);
    if (dupNum && dupNum.length > 0) {
        throw new Error(
            `ABORT: ya existe AMFE con amfe_number="${AMFE_NUMBER}" ` +
            `(id=${dupNum[0].id}, part=${dupNum[0].part_number}). NO duplicar.`
        );
    }

    // part_number duplicado en amfe_documents
    const { data: dupPart, error: errPart } = await sb
        .from('amfe_documents')
        .select('id, amfe_number, part_number')
        .eq('part_number', PART_NUMBER);
    if (errPart) throw new Error(`Preflight (part_number): ${errPart.message}`);
    if (dupPart && dupPart.length > 0) {
        throw new Error(
            `ABORT: ya existe AMFE con part_number="${PART_NUMBER}" ` +
            `(id=${dupPart[0].id}, amfe=${dupPart[0].amfe_number}). NO duplicar.`
        );
    }

    // family duplicada
    const { data: famDup, error: famErr } = await sb
        .from('product_families')
        .select('id, name')
        .or('name.ilike.%Apb Tra%,name.ilike.%Apoyabrazos Trasero%');
    if (famErr) throw new Error(`Preflight (family): ${famErr.message}`);
    if (famDup && famDup.length > 0) {
        throw new Error(
            `ABORT: ya existe familia matching Apb Tra/Apoyabrazos Trasero: ` +
            `${famDup.map(f => `${f.id}=${f.name}`).join(', ')}. NO duplicar.`
        );
    }

    console.log('Preflight checks: PASS (sin duplicados de amfe_number/part_number/family).\n');
}

// ─── Parte 1: Completar S/O/D faltantes ─────────────────────────────────────
function fillMissingSOD(doc) {
    const stats = {
        oFilledFromSiblings: 0,
        oFilledFromDefault: 0,
        dFilledFromSiblings: 0,
        dFilledFromDefault: 0,
        sFilledFromSiblings: 0,
        causesTouched: 0,
        apRecalculatedTotal: 0,
        apHWithPlaceholder: 0,
        apDistBefore: { H: 0, M: 0, L: 0, '': 0 },
        apDistAfter: { H: 0, M: 0, L: 0, '': 0 },
    };

    function isMissing(v) {
        if (v === null || v === undefined || v === '') return true;
        const n = Number(v);
        return isNaN(n) || n === 0;
    }

    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    const causes = fm.causes || [];
                    if (causes.length === 0) continue;

                    // Calcular maximos de hermanas con valores legitimos
                    const sibSev = causes.map(c => Number(c.severity)).filter(n => !isNaN(n) && n > 0);
                    const sibOcc = causes.map(c => Number(c.occurrence)).filter(n => !isNaN(n) && n > 0);
                    const sibDet = causes.map(c => Number(c.detection)).filter(n => !isNaN(n) && n > 0);
                    const maxSev = sibSev.length > 0 ? Math.max(...sibSev) : 0;
                    const maxOcc = sibOcc.length > 0 ? Math.max(...sibOcc) : 0;
                    const maxDet = sibDet.length > 0 ? Math.max(...sibDet) : 0;

                    for (const c of causes) {
                        // AP previa (para distribucion)
                        const apPrev = (c.ap || c.actionPriority || '').toUpperCase();
                        if (apPrev in stats.apDistBefore) stats.apDistBefore[apPrev]++;
                        else stats.apDistBefore['']++;

                        let touched = false;

                        // Severity
                        if (isMissing(c.severity)) {
                            if (maxSev > 0) {
                                c.severity = maxSev;
                                stats.sFilledFromSiblings++;
                                touched = true;
                            }
                            // Sin default para S; si todas las hermanas tienen 0, queda 0
                            // y AP saldra '' -> el validator lo flaggeara.
                        }

                        // Occurrence
                        if (isMissing(c.occurrence)) {
                            if (maxOcc > 0) {
                                c.occurrence = maxOcc;
                                stats.oFilledFromSiblings++;
                            } else {
                                c.occurrence = DEFAULT_OCCURRENCE;
                                stats.oFilledFromDefault++;
                            }
                            touched = true;
                        }

                        // Detection
                        if (isMissing(c.detection)) {
                            if (maxDet > 0) {
                                c.detection = maxDet;
                                stats.dFilledFromSiblings++;
                            } else {
                                c.detection = DEFAULT_DETECTION;
                                stats.dFilledFromDefault++;
                            }
                            touched = true;
                        }

                        if (touched) {
                            c._autoFilled = true;
                            stats.causesTouched++;
                        }

                        // Recalcular AP siempre (tabla AIAG-VDA 2019 oficial)
                        const newAp = calculateAP(c.severity, c.occurrence, c.detection);
                        if (newAp && (c.ap !== newAp || c.actionPriority !== newAp)) {
                            c.ap = newAp;
                            c.actionPriority = newAp;
                            stats.apRecalculatedTotal++;
                        } else if (newAp) {
                            c.ap = newAp;
                            c.actionPriority = newAp;
                        }

                        const apNew = (c.ap || '').toUpperCase();
                        if (apNew in stats.apDistAfter) stats.apDistAfter[apNew]++;
                        else stats.apDistAfter['']++;

                        // AP=H sin accion -> placeholder (regla amfe-aph-pending.md)
                        if (apNew === 'H') {
                            const noPrev = !c.preventionAction || String(c.preventionAction).trim() === '';
                            const noDet  = !c.detectionAction  || String(c.detectionAction).trim()  === '';
                            const noOpt  = !c.optimizationAction || String(c.optimizationAction).trim() === '';
                            if (noPrev && noDet && noOpt) {
                                c.preventionAction = APH_PLACEHOLDER;
                                stats.apHWithPlaceholder++;
                            }
                        }
                    }
                }
            }
        }
    }
    return stats;
}

// ─── Parte 3.b: findOrCreateProduct ─────────────────────────────────────────
async function findOrCreateProduct(sb, codigo, descripcion, apply) {
    const { data: existing, error } = await sb
        .from('products')
        .select('id, codigo, descripcion')
        .eq('codigo', codigo);
    if (error) throw new Error(`findOrCreateProduct: ${error.message}`);

    if (existing && existing.length > 0) {
        console.log(`  -> product ya existe: codigo=${codigo} id=${existing[0].id}`);
        return existing[0].id;
    }

    const newRow = {
        codigo,
        descripcion,
        linea_code: LINEA_CODE,
        linea_name: LINEA_NAME,
        active: 1,
    };
    logChange(apply, `CREATE product "${codigo}"`, newRow);
    if (!apply) return '(dry-run product id)';

    const { data: ins, error: insErr } = await sb
        .from('products')
        .insert(newRow)
        .select('id')
        .single();
    if (insErr) throw new Error(`INSERT product: ${insErr.message}`);
    console.log(`  -> created product id=${ins.id}`);
    return ins.id;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
    const { apply } = parseSafeArgs();
    const allowNewCritical = process.argv.includes('--allow-new-critical');
    if (allowNewCritical) console.log('⚠ --allow-new-critical activo: se permiten criticos WE_NO_FN (WE rotulados en el Excel sin functions; equipo APQP completa en la app).\n');
    const sb = await connectSupabase();

    // Parte 0
    await preflightChecks(sb);

    // Cargar JSON
    const doc = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
    const statsBefore = countAmfeStats(doc);
    console.log('JSON parseado:', statsBefore);
    console.log(`  SC en JSON: ${countSpecialChar(doc, 'SC')}, CC en JSON: ${countSpecialChar(doc, 'CC')}`);

    // Parte 1: completar S/O/D + recalcular AP + placeholder AP=H
    const fillStats = fillMissingSOD(doc);
    console.log('\n=== FILL S/O/D STATS ===');
    console.log(`  Causas tocadas (auto-filled): ${fillStats.causesTouched}`);
    console.log(`  S rellenadas desde hermanas:  ${fillStats.sFilledFromSiblings}`);
    console.log(`  O rellenadas desde hermanas:  ${fillStats.oFilledFromSiblings}`);
    console.log(`  O rellenadas con default ${DEFAULT_OCCURRENCE}:  ${fillStats.oFilledFromDefault}`);
    console.log(`  D rellenadas desde hermanas:  ${fillStats.dFilledFromSiblings}`);
    console.log(`  D rellenadas con default ${DEFAULT_DETECTION}:  ${fillStats.dFilledFromDefault}`);
    console.log(`  AP recalculadas:              ${fillStats.apRecalculatedTotal}`);
    console.log(`  AP=H con placeholder accion:  ${fillStats.apHWithPlaceholder}`);
    console.log(`  AP dist ANTES:  H=${fillStats.apDistBefore.H} M=${fillStats.apDistBefore.M} L=${fillStats.apDistBefore.L} ''=${fillStats.apDistBefore['']}`);
    console.log(`  AP dist DESPUES: H=${fillStats.apDistAfter.H} M=${fillStats.apDistAfter.M} L=${fillStats.apDistAfter.L} ''=${fillStats.apDistAfter['']}`);

    // Parte 2.a: aliases (los aliases ya vienen del parser, igual sincroniza por seguridad)
    const aliasResult = syncFieldAliases(doc);
    console.log(`\n=== FIELD ALIASES ===`);
    console.log(`  Aliases sincronizados: ${aliasResult.synced}`);
    if (aliasResult.synced > 0) {
        console.log(`  byField:`, aliasResult.byField);
    }

    // Parte 2.b: sync fm-level legacy fields (severity/occurrence/detection/ap).
    // Replica lo que saveAmfe() hace automaticamente. Sin esto, el validator marca
    // FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE en cada failure y bloquea el apply.
    const legacyResult = syncLegacyFmFields(doc);
    console.log(`\n=== FM-LEVEL LEGACY SYNC ===`);
    console.log(`  Campos fm-level rellenados desde causas: ${legacyResult.synced}`);

    // Stats post
    const statsAfter = countAmfeStats(doc);
    console.log(`\nStats post-fill:`, statsAfter);

    // Parte 3.1: Validador pre-commit con before vacio + after completo
    const before = { header: {}, operations: [] };
    const after = doc;

    const plan = [{
        id: 'NEW-INSERT-AMFE-150',
        amfeNumber: AMFE_NUMBER,
        productName: 'Apoyabrazos Trasero Central Patagonia',
        before,
        after,
    }];

    // Commit function (solo se llama si gate paso Y --apply)
    const commitFn = async () => {
        // a) INSERT product_families (id es bigint auto-increment, no UUID)
        const familyRow = {
            name: FAMILY_NAME,
            description: FAMILY_DESCRIPTION,
            linea_code: LINEA_CODE,
            linea_name: LINEA_NAME,
            active: 1,
        };
        logChange(true, `CREATE product_family "${FAMILY_NAME}"`, familyRow);
        const { data: insFam, error: famErr } = await sb.from('product_families').insert(familyRow).select('id').single();
        if (famErr) throw new Error(`INSERT product_families: ${famErr.message}`);
        const newFamilyId = insFam.id;
        console.log(`  -> created family id=${newFamilyId}`);

        // b) findOrCreateProduct + INSERT product_family_members
        let productId;
        try {
            productId = await findOrCreateProduct(sb, PART_NUMBER, PRODUCT_DESCRIPTION, true);
        } catch (e) {
            // rollback family
            await sb.from('product_families').delete().eq('id', newFamilyId);
            throw new Error(`Producto fallo, rolled back family: ${e.message}`);
        }

        const memberRow = {
            family_id: newFamilyId,
            product_id: productId,
            is_primary: 1,
            variant_label: 'Patagonia VWA',
        };
        logChange(true, `LINK member family<->product`, memberRow);
        const { error: memErr } = await sb.from('product_family_members').insert(memberRow);
        if (memErr) {
            // rollback
            await sb.from('product_families').delete().eq('id', newFamilyId);
            throw new Error(`INSERT product_family_members: ${memErr.message}`);
        }

        // c) INSERT amfe_documents
        // CRITICO: replicar saveAmfe() — data va como JSON.stringify (TEXT en runtime).
        // Ver amfeIo.mjs L190 (`data: JSON.stringify(doc)`) y verify L203-207.
        const newAmfeId = randomUUID();
        const totalCauses = countAmfeStats(doc).causeCount;
        const apHCount = countByAp(doc, 'H');
        const apMCount = countByAp(doc, 'M');

        const amfeRow = {
            id: newAmfeId,
            amfe_number: AMFE_NUMBER,
            project_name: PROJECT_NAME,
            client: CLIENT,
            part_number: PART_NUMBER,
            organization: 'BARACK MERCOSUL',
            responsible: 'PAULO CENTURION',
            status: 'draft',
            operation_count: doc.operations.length,
            cause_count: totalCauses,
            ap_h_count: apHCount,
            ap_m_count: apMCount,
            coverage_percent: 100,
            start_date: doc.header?.amfeDate || null,
            last_revision_date: doc.header?.revisionDate || null,
            revision_level: doc.header?.revisionLevel || 'B',
            data: JSON.stringify(doc),  // TEXT: ver amfeIo.mjs saveAmfe
        };
        logChange(true, `INSERT amfe_documents id=${newAmfeId}`, {
            amfe_number: amfeRow.amfe_number,
            part_number: amfeRow.part_number,
            project_name: amfeRow.project_name,
            operation_count: amfeRow.operation_count,
            cause_count: amfeRow.cause_count,
        });

        const { error: amfeErr } = await sb.from('amfe_documents').insert(amfeRow);
        if (amfeErr) {
            // rollback family + member (member auto-cascade?? no — borrar manual)
            await sb.from('product_family_members').delete()
                .eq('family_id', newFamilyId).eq('product_id', productId);
            await sb.from('product_families').delete().eq('id', newFamilyId);
            throw new Error(`INSERT amfe_documents: ${amfeErr.message}`);
        }
        console.log(`  -> created amfe_document id=${newAmfeId}`);

        // d) Verify post-write (regla database.md)
        const { data: verify, error: vErr } = await sb
            .from('amfe_documents')
            .select('data')
            .eq('id', newAmfeId)
            .single();
        if (vErr) throw new Error(`VERIFY amfe/${newAmfeId}: ${vErr.message}`);
        if (typeof verify.data !== 'string') {
            throw new Error(`VERIFY amfe/${newAmfeId}: data no es string (typeof=${typeof verify.data})`);
        }
        let parsed;
        try { parsed = JSON.parse(verify.data); }
        catch { throw new Error(`VERIFY amfe/${newAmfeId}: data string no es JSON parseable`); }
        if (!parsed || !Array.isArray(parsed.operations) || parsed.operations.length !== doc.operations.length) {
            throw new Error(`VERIFY amfe/${newAmfeId}: operations array roto post-write`);
        }

        console.log(`\n=== VERIFY POST-WRITE OK ===`);
        console.log(`  Family ID:     ${newFamilyId}`);
        console.log(`  Product ID:    ${productId}`);
        console.log(`  AMFE Doc ID:   ${newAmfeId}`);
        console.log(`  Operations:    ${parsed.operations.length}`);
        console.log(`  Causes:        ${totalCauses}`);
        console.log(`  AP=H count:    ${apHCount}`);
        console.log(`  AP=M count:    ${apMCount}`);
    };

    // Parte 3.1: Gate. Sin override por default — Fak decide si justificar despues.
    await runWithValidation(plan, apply, commitFn, { allowNewCritical });

    // ─── Log final ──
    const ccCount = countSpecialChar(doc, 'CC');
    const scCount = countSpecialChar(doc, 'SC');
    console.log('\n=== RESUMEN FINAL ===');
    console.log(`  AMFE number:     ${AMFE_NUMBER}`);
    console.log(`  Project name:    ${PROJECT_NAME}`);
    console.log(`  Part number:     ${PART_NUMBER}`);
    console.log(`  Client:          ${CLIENT}`);
    console.log(`  Family:          ${FAMILY_NAME}`);
    console.log(`  Operations:      ${statsAfter.opCount}`);
    console.log(`  Work Elements:   ${statsAfter.weCount}`);
    console.log(`  Functions:       ${statsAfter.fnCount}`);
    console.log(`  Failure Modes:   ${statsAfter.fmCount}`);
    console.log(`  Causes total:    ${statsAfter.causeCount}`);
    console.log(`    CC:            ${ccCount}`);
    console.log(`    SC:            ${scCount}`);
    console.log(`  Auto-filled SOD:`);
    console.log(`    causas tocadas:           ${fillStats.causesTouched}`);
    console.log(`    O default ${DEFAULT_OCCURRENCE} (sin hermanas): ${fillStats.oFilledFromDefault}`);
    console.log(`    D default ${DEFAULT_DETECTION} (sin hermanas): ${fillStats.dFilledFromDefault}`);
    console.log(`  AP=H con placeholder accion: ${fillStats.apHWithPlaceholder}`);
    console.log('  Estado: Listo para cargar CP/HO/PFD downstream (fuera de scope).');

    finish(apply);
}

// ─── Helpers de conteo ──────────────────────────────────────────────────────
function countSpecialChar(doc, target) {
    let n = 0;
    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    for (const c of fm.causes || []) {
                        if ((c.specialChar || '').toUpperCase() === target.toUpperCase()) n++;
                    }
                }
            }
        }
    }
    return n;
}

function countByAp(doc, target) {
    let n = 0;
    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fm of fn.failures || []) {
                    for (const c of fm.causes || []) {
                        if ((c.ap || '').toUpperCase() === target.toUpperCase()) n++;
                    }
                }
            }
        }
    }
    return n;
}

main().catch(err => {
    console.error('\nERROR:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});

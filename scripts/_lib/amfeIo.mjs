/**
 * amfeIo.mjs — Helper centralizado de I/O Supabase para scripts APQP
 *
 * Elimina boilerplate repetido en scripts/*.mjs (40+ scripts, ~1800 LoC duplicadas).
 *
 * Convenciones (OBLIGATORIAS, no negociables):
 *   - Las columnas `data` de amfe/cp/ho/pfd_documents son TEXT (no JSONB).
 *     Al leer: JSON.parse. Al escribir: JSON.stringify.
 *     Ver .claude/memory/feedback_amfe_data_is_text.md
 *   - parseData() maneja double-serialization (incidente 2026-04-06).
 *   - calculateAP() replica la tabla AIAG-VDA 2019 oficial de modules/amfe/apTable.ts
 *     (los .mjs no pueden importar .ts sin build).
 *   - Guards por id + amfe_number obligatorios en escrituras.
 *
 * Convive con _lib/dryRunGuard.mjs. No lo reemplaza: dryRunGuard maneja CLI flag +
 * logging; amfeIo maneja I/O y validacion.
 *
 * Uso tipico:
 *   import { connectSupabase, readAmfe, saveAmfe, findOperation, calculateAP } from './_lib/amfeIo.mjs';
 *   const sb = await connectSupabase();
 *   const { doc } = await readAmfe(sb, '<uuid>');
 *   const op = findOperation(doc, '40');
 *   // modificar op ...
 *   await saveAmfe(sb, '<uuid>', doc, { expectedAmfeNumber: 'AMFE-HF-PAT' });
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ─── Env + connect ──────────────────────────────────────────────────────────

/**
 * Lee .env.local del proyecto (subiendo un nivel desde scripts/).
 * Replica el patron de _backup.mjs — no requiere paquete dotenv.
 * @returns {Record<string,string>} diccionario de variables
 */
export function loadEnv() {
    const envPath = new URL('../../.env.local', import.meta.url)
        .pathname.replace(/^\/([A-Z]:)/, '$1');
    const envText = readFileSync(envPath, 'utf8');
    return Object.fromEntries(
        envText.split('\n')
            .filter(l => l.includes('=') && !l.startsWith('#'))
            .map(l => {
                const i = l.indexOf('=');
                return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
            })
    );
}

/**
 * Crea cliente Supabase autenticado con credenciales de .env.local.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export async function connectSupabase() {
    const env = loadEnv();
    const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    const res = await sb.auth.signInWithPassword({
        email: env.VITE_AUTO_LOGIN_EMAIL,
        password: env.VITE_AUTO_LOGIN_PASSWORD,
    });
    if (res.error) {
        throw new Error(`AUTH FAILED: ${res.error.message}`);
    }
    return sb;
}

// ─── Parse seguro (handles double-serialization) ────────────────────────────

/**
 * Parsea el campo `data` de un documento APQP. Maneja el caso de double-serialization
 * (incidente 2026-04-06: 8 AMFEs quedaron con string anidado dentro de string).
 * @param {string|object|null} raw
 * @returns {object|null}
 */
export function parseData(raw) {
    if (raw == null) return null;
    if (typeof raw !== 'string') return raw;
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') {
            // Double-serialization: intentar otro parse
            try { return JSON.parse(parsed); } catch { return parsed; }
        }
        return parsed;
    } catch {
        return null;
    }
}

// ─── Read por tabla ─────────────────────────────────────────────────────────

async function readRow(sb, table, id, fields) {
    const { data: row, error } = await sb.from(table)
        .select(fields.join(', '))
        .eq('id', id)
        .single();
    if (error) throw new Error(`READ ${table}/${id}: ${error.message}`);
    return row;
}

/**
 * Lee un AMFE por id. Devuelve {row, doc} — row sin tocar (para guards extra),
 * doc ya parseado listo para modificar.
 * @returns {Promise<{id, amfe_number, row, doc}>}
 */
export async function readAmfe(sb, id) {
    const row = await readRow(sb, 'amfe_documents', id,
        ['id', 'amfe_number', 'project_name', 'operation_count', 'cause_count', 'data']);
    const doc = parseData(row.data);
    if (!doc) throw new Error(`AMFE ${id}: data is null or unparseable`);
    return { id: row.id, amfe_number: row.amfe_number, row, doc };
}

export async function readCp(sb, id) {
    const row = await readRow(sb, 'cp_documents', id, ['id', 'cp_number', 'data']);
    const doc = parseData(row.data);
    if (!doc) throw new Error(`CP ${id}: data is null or unparseable`);
    return { id: row.id, cp_number: row.cp_number, row, doc };
}

export async function readHo(sb, id) {
    const row = await readRow(sb, 'ho_documents', id, ['id', 'data']);
    const doc = parseData(row.data);
    if (!doc) throw new Error(`HO ${id}: data is null or unparseable`);
    return { id: row.id, row, doc };
}

export async function readPfd(sb, id) {
    const row = await readRow(sb, 'pfd_documents', id, ['id', 'part_number', 'part_name', 'data']);
    const doc = parseData(row.data);
    if (!doc) throw new Error(`PFD ${id}: data is null or unparseable`);
    return { id: row.id, part_name: row.part_name, row, doc };
}

/**
 * Lista todos los AMFEs (metadata sin data para performance).
 * @returns {Promise<Array<{id, amfe_number, project_name, operation_count, cause_count}>>}
 */
export async function listAmfes(sb) {
    const { data, error } = await sb.from('amfe_documents')
        .select('id, amfe_number, project_name, operation_count, cause_count');
    if (error) throw new Error(`LIST amfes: ${error.message}`);
    return data;
}

/**
 * Lista todos los PFDs.
 */
export async function listPfds(sb) {
    const { data, error } = await sb.from('pfd_documents')
        .select('id, part_number, part_name, step_count');
    if (error) throw new Error(`LIST pfds: ${error.message}`);
    return data;
}

// ─── Write por tabla (con guards + verify) ──────────────────────────────────

/**
 * Guarda un AMFE. Obliga JSON.stringify (data es TEXT).
 * Verifica post-write leyendo de vuelta y parseando.
 * @param {object} sb
 * @param {string} id
 * @param {object} doc
 * @param {{expectedAmfeNumber?: string, extraFields?: object}} [opts]
 */
export async function saveAmfe(sb, id, doc, opts = {}) {
    guardDataShape(doc, 'amfe');

    // Guard amfe_number si se especifico
    if (opts.expectedAmfeNumber) {
        const current = await readAmfe(sb, id);
        guardAmfeNumber(current.amfe_number, opts.expectedAmfeNumber, id);
    }

    // AUTO-SYNC: campos legacy fm-level que se dejaron vacios pero las causas
    // tienen valor. Exports/UIs legacy leen fm.X — mantenerlo sincronizado con
    // cause[] evita que aparezcan celdas vacias. Opt-out con { skipLegacySync: true }.
    if (!opts.skipLegacySync) {
        syncLegacyFmFields(doc);
    }

    const payload = { data: JSON.stringify(doc), ...(opts.extraFields || {}) };
    // Extra guard: nunca permitir pasar objeto directo en data
    if (typeof payload.data !== 'string') {
        throw new Error(`saveAmfe WRITE GUARD: data must be string, got ${typeof payload.data}`);
    }

    const { error } = await sb.from('amfe_documents').update(payload).eq('id', id);
    if (error) throw new Error(`SAVE amfe/${id}: ${error.message}`);

    // Verify round-trip
    const { data: verify, error: vErr } = await sb.from('amfe_documents')
        .select('data').eq('id', id).single();
    if (vErr) throw new Error(`VERIFY amfe/${id}: ${vErr.message}`);
    if (typeof verify.data !== 'string') {
        throw new Error(`VERIFY amfe/${id}: data is not string (typeof=${typeof verify.data})`);
    }
    const parsed = parseData(verify.data);
    if (!parsed || !Array.isArray(parsed.operations)) {
        throw new Error(`VERIFY amfe/${id}: operations array broken after write`);
    }
}

export async function saveCp(sb, id, doc, opts = {}) {
    guardDataShape(doc, 'cp');
    const payload = { data: JSON.stringify(doc), ...(opts.extraFields || {}) };
    if (typeof payload.data !== 'string') throw new Error('saveCp: data must be string');
    const { error } = await sb.from('cp_documents').update(payload).eq('id', id);
    if (error) throw new Error(`SAVE cp/${id}: ${error.message}`);
}

export async function saveHo(sb, id, doc, opts = {}) {
    guardDataShape(doc, 'ho');
    const payload = { data: JSON.stringify(doc), ...(opts.extraFields || {}) };
    if (typeof payload.data !== 'string') throw new Error('saveHo: data must be string');
    const { error } = await sb.from('ho_documents').update(payload).eq('id', id);
    if (error) throw new Error(`SAVE ho/${id}: ${error.message}`);
}

export async function savePfd(sb, id, doc, opts = {}) {
    guardDataShape(doc, 'pfd');
    const payload = { data: JSON.stringify(doc), ...(opts.extraFields || {}) };
    if (typeof payload.data !== 'string') throw new Error('savePfd: data must be string');
    const { error } = await sb.from('pfd_documents').update(payload).eq('id', id);
    if (error) throw new Error(`SAVE pfd/${id}: ${error.message}`);
}

// ─── Legacy fm-level sync (VDA 2019 migracion) ──────────────────────────────

/**
 * Sincroniza campos legacy a nivel failure desde las causas.
 *
 * El schema AmfeFailure tiene 13 campos @deprecated que fueron migrados a
 * AmfeCause[]. Exports y UIs legacy pueden leer fm.X — si queda vacio mientras
 * cause[] tiene valor, aparecen celdas en blanco en el Excel/PDF export.
 * Este sync mantiene fm.X coherente con cause[] como fallback visual.
 *
 * Estrategia:
 *  - Numericos (severity/occurrence/detection): max entre causas.
 *  - Strings (cause/effect/preventionControl/etc): si fm esta vacio, copia de
 *    la primera causa con valor; si tiene contenido distinto al de causes, lo
 *    preserva tal como esta.
 *
 * Idempotente: correr 2 veces da el mismo resultado.
 *
 * @param {object} doc — Documento AMFE parseado. Se muta in-place.
 * @returns {{synced: number}} cantidad de fields fm-level sincronizados.
 */
export function syncLegacyFmFields(doc) {
    let synced = 0;
    if (!doc?.operations) return { synced };

    const numericFields = ['severity', 'occurrence', 'detection'];
    const aliasFields = [
        { fm: 'ap', alt: 'actionPriority' },
        { fm: 'actionPriority', alt: 'ap' },
    ];
    const textFields = [
        'preventionControl', 'detectionControl',
        'specialChar', 'classification',
    ];

    for (const op of doc.operations) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fm of (fn.failures || [])) {
                    const causes = fm.causes || [];
                    if (causes.length === 0) continue;

                    // Numericos: max
                    for (const f of numericFields) {
                        if (!(f in fm)) continue;
                        const fmVal = fm[f];
                        const fmEmpty = fmVal === '' || fmVal === null || fmVal === undefined || fmVal === 0;
                        if (!fmEmpty) continue;
                        const vals = causes.map(c => Number(c[f])).filter(n => !isNaN(n) && n > 0);
                        if (vals.length > 0) {
                            fm[f] = Math.max(...vals);
                            synced++;
                        }
                    }

                    // Aliases (ap / actionPriority)
                    for (const { fm: f, alt } of aliasFields) {
                        if (!(f in fm)) continue;
                        const fmVal = fm[f];
                        if (fmVal !== '' && fmVal !== null && fmVal !== undefined) continue;
                        for (const c of causes) {
                            const v = c[f] || c[alt];
                            if (v) { fm[f] = v; synced++; break; }
                        }
                    }

                    // Textos: copiar del primero con valor
                    for (const f of textFields) {
                        if (!(f in fm)) continue;
                        const fmVal = fm[f];
                        const fmEmpty = fmVal === '' || fmVal === null || fmVal === undefined;
                        if (!fmEmpty) continue;
                        for (const c of causes) {
                            const v = c[f];
                            if (v && String(v).trim() !== '') { fm[f] = v; synced++; break; }
                        }
                    }
                }
            }
        }
    }

    return { synced };
}

// ─── Guards ─────────────────────────────────────────────────────────────────

export function guardId(actualId, expectedId, label = 'guard') {
    if (actualId !== expectedId) {
        throw new Error(`${label}: id mismatch (actual=${actualId}, expected=${expectedId})`);
    }
}

export function guardAmfeNumber(actualNum, expectedNum, ctx = '') {
    if (actualNum !== expectedNum) {
        throw new Error(`amfe_number mismatch ${ctx}: actual="${actualNum}", expected="${expectedNum}"`);
    }
}

/**
 * Verifica que el documento tenga el array canonico esperado.
 * - amfe: operations[]
 * - cp: items[]
 * - ho: sheets[]
 * - pfd: steps[]
 */
export function guardDataShape(doc, type) {
    if (!doc || typeof doc !== 'object') throw new Error(`guardDataShape: doc no es objeto (type=${type})`);
    const key = { amfe: 'operations', cp: 'items', ho: 'sheets', pfd: 'steps' }[type];
    if (!key) throw new Error(`guardDataShape: tipo desconocido "${type}"`);
    if (!Array.isArray(doc[key])) {
        throw new Error(`guardDataShape(${type}): doc.${key} no es array`);
    }
}

// ─── Navegacion AMFE ────────────────────────────────────────────────────────

/**
 * Normaliza texto para matching robusto.
 * Lowercase + NFD (decompose) + strip diacritics + trim + collapse whitespace.
 */
export function normalizeText(s) {
    if (s == null) return '';
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Busca operacion por numero. Matchea opNumber || operationNumber (ambos aliases usados).
 */
export function findOperation(doc, opNum) {
    const target = String(opNum).trim();
    return (doc.operations || []).find(op =>
        String(op.opNumber || op.operationNumber || '').trim() === target
    );
}

/**
 * Busca work element por nombre dentro de una operacion (matching normalizado).
 */
export function findWorkElement(op, weName) {
    const target = normalizeText(weName);
    return (op.workElements || []).find(we => normalizeText(we.name) === target);
}

/**
 * Busca failure por descripcion dentro de una function (matching normalizado).
 */
export function findFailure(fn, desc) {
    const target = normalizeText(desc);
    return (fn.failures || []).find(fm => normalizeText(fm.description) === target);
}

/**
 * Busca causa por texto (alias: cause || description).
 */
export function findCauseByText(causes, desc) {
    const target = normalizeText(desc);
    return (causes || []).find(c => normalizeText(c.cause || c.description) === target);
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Cuenta estructura completa del AMFE.
 * @returns {{opCount, weCount, fnCount, fmCount, causeCount}}
 */
export function countAmfeStats(doc) {
    const ops = Array.isArray(doc?.operations) ? doc.operations : [];
    let weCount = 0, fnCount = 0, fmCount = 0, causeCount = 0;
    for (const op of ops) {
        const wes = Array.isArray(op?.workElements) ? op.workElements : [];
        weCount += wes.length;
        for (const we of wes) {
            const fns = Array.isArray(we?.functions) ? we.functions : [];
            fnCount += fns.length;
            for (const fn of fns) {
                const fms = Array.isArray(fn?.failures) ? fn.failures : [];
                fmCount += fms.length;
                for (const fm of fms) {
                    const cs = Array.isArray(fm?.causes) ? fm.causes : [];
                    causeCount += cs.length;
                }
            }
        }
    }
    return { opCount: ops.length, weCount, fnCount, fmCount, causeCount };
}

// ─── calculateAP (replica AIAG-VDA 2019 oficial) ────────────────────────────
// Replicado de modules/amfe/apTable.ts porque .mjs no puede importar .ts.
// Si apTable.ts cambia, actualizar aqui. La tabla es stable (estandar publicado).

function apRule(s, o, d) {
    if (s <= 1) return 'L';
    if (s <= 3) {
        if (o >= 8 && d >= 5) return 'M';
        return 'L';
    }
    if (s <= 6) {
        if (o >= 8) return d >= 5 ? 'H' : 'M';
        if (o >= 6) return d >= 2 ? 'M' : 'L';
        if (o >= 4) return d >= 7 ? 'M' : 'L';
        return 'L';
    }
    if (s <= 8) {
        if (o >= 8) return 'H';
        if (o >= 6) return d >= 2 ? 'H' : 'M';
        if (o >= 4) return d >= 7 ? 'H' : 'M';
        if (o >= 2) return d >= 5 ? 'M' : 'L';
        return 'L';
    }
    // s = 9-10
    if (o >= 6) return 'H';
    if (o >= 4) return d >= 2 ? 'H' : 'M';
    if (o >= 2) {
        if (d >= 7) return 'H';
        if (d >= 5) return 'M';
        return 'L';
    }
    return 'L';
}

/**
 * Calcula Action Priority (AP) siguiendo AIAG-VDA 2019 PFMEA.
 * @param {number} s severity 1-10
 * @param {number} o occurrence 1-10
 * @param {number} d detection 1-10
 * @returns {'H'|'M'|'L'|''} '' si inputs invalidos
 */
export function calculateAP(s, o, d) {
    if (s == null || o == null || d == null) return '';
    if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
    const sInt = Math.round(Number(s));
    const oInt = Math.round(Number(o));
    const dInt = Math.round(Number(d));
    if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
    return apRule(sInt, oInt, dInt);
}

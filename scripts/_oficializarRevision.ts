/**
 * _oficializarRevision.ts — Oficializa una nueva revision de un AMFE.
 *
 * Hace TODO el circuito de una revision oficial (I-AC-005 / I-IN-002):
 *   1. Gates: assertAmfeExportable (S/O/D) + validateAmfeDoc (0 criticos).
 *   2. Junta los cambios: amfe_change_log pendientes; si no hay, diff contra el
 *      ultimo snapshot; si sigue vacio, exige --desc.
 *   3. Sube el nivel de revision (A→B→…), fecha AR de hoy.
 *   4. Escribe Supabase (solo --apply): snapshot a document_revisions →
 *      update amfe_documents (rev/revDate/revisions/status=approved) via
 *      runWithValidation → marca change_log consumido → update amfe_registry
 *      (rev, fechas, estado=Liberado, proxima revision +6 meses).
 *   5. Exporta el Excel oficial (Caratula + AMFE) a exports/oficializar/.
 *   6. Y: mueve el vigente a OBSOLETO, copia el nuevo, deja log de rollback.
 *   7. Regenera el Listado Maestro.
 *
 * Uso:
 *   # dry-run live (necesita env VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   npx tsx scripts/_oficializarRevision.ts 159 [--desc "..."]
 *   # dry-run offline (sin env), leyendo un dump JSON:
 *   npx tsx scripts/_oficializarRevision.ts 159 --dump reports/oficializar_159.json
 *   # aplicar de verdad (live):
 *   SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npx tsx scripts/_oficializarRevision.ts 159 --apply
 *
 * Por defecto es DRY-RUN: no escribe nada. --apply activa las escrituras (solo live).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, renameSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import type { AmfeLifecycleStatus } from '../modules/amfe/amfeCaratulaSheet';
import { getNextRevisionLevel } from '../utils/revisionUtils';
import { diffAmfeDocs } from '../modules/amfe/amfeChangeDiff';
import type { AmfeDocument } from '../modules/amfe/amfeTypes';
import { runWithValidation } from './_lib/dryRunGuard.mjs';
import { saveAmfe, parseData } from './_lib/amfeIo.mjs';
import { regenerarListadoMaestro } from './_generarListadoMaestro.mjs';
import { RUTA_BASE_AMFE, CARPETA_OBSOLETO } from './_lib/serverPaths.mjs';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const positional = argv.filter(a => !a.startsWith('--'));
const flag = (name: string): boolean => argv.includes(`--${name}`);
const opt = (name: string): string | null => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};

const AMFE_NRO = positional[0];
const APPLY = flag('apply');
const DESC = opt('desc');
const LEGAJO = opt('legajo');
const DUMP = opt('dump');

if (!AMFE_NRO) {
    console.error('Uso: npx tsx scripts/_oficializarRevision.ts <nro> [--desc "..."] [--legajo <ruta>] [--dump <file>] [--apply]');
    process.exit(1);
}

const log = (msg: string) => console.info(msg);
const STAGING = 'exports/oficializar';
const REPORTS = 'reports';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fechaAR(d = new Date()): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function mas6MesesAR(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return fechaAR(d);
}

interface DumpData {
    doc: { id: string; amfe_number: string; data: string; revisions: string; status: string };
    registry: { amfe_code: string; producto: string; server_path: string; historial: string } | null;
    pending: Array<{ id: number; summary: string; op_number: string }>;
    lastSnapshot: { snapshot_data: string; revision_level: string } | null;
}

// ─── Lectura de datos (live o dump) ──────────────────────────────────────────

async function connect(): Promise<SupabaseClient> {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Faltan VITE_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno (o usá --dump para dry-run offline).');
    }
    return createClient(url, key, { auth: { persistSession: false } });
}

async function leerDatos(sb: SupabaseClient | null): Promise<DumpData> {
    if (DUMP) {
        if (!existsSync(DUMP)) throw new Error(`No existe el dump: ${DUMP}`);
        return JSON.parse(readFileSync(DUMP, 'utf8')) as DumpData;
    }
    if (!sb) throw new Error('Sin conexion Supabase y sin --dump.');
    const { data: doc, error: e1 } = await sb.from('amfe_documents')
        .select('id,amfe_number,data,revisions,status').eq('amfe_number', AMFE_NRO).single();
    if (e1 || !doc) throw new Error(`No encontré el AMFE ${AMFE_NRO} en amfe_documents: ${e1?.message}`);
    const { data: registry } = await sb.from('amfe_registry')
        .select('amfe_code,producto,server_path,historial').eq('amfe_code', AMFE_NRO).single();
    const { data: pending } = await sb.from('amfe_change_log')
        .select('id,summary,op_number').eq('document_id', doc.id).is('consumed_in_rev', null)
        .order('created_at', { ascending: true }).order('id', { ascending: true });
    const { data: snaps } = await sb.from('document_revisions')
        .select('snapshot_data,revision_level').eq('module', 'amfe').eq('document_id', doc.id)
        .order('created_at', { ascending: false }).limit(1);
    return {
        doc, registry: registry ?? null,
        pending: pending ?? [],
        lastSnapshot: snaps && snaps.length ? snaps[0] : null,
    };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    if (DUMP && APPLY) throw new Error('--dump es solo para dry-run offline; no se puede --apply desde un dump.');

    const sb = DUMP ? null : await connect();
    const { doc, registry, pending, lastSnapshot } = await leerDatos(sb);

    const parsed = parseData(doc.data) as AmfeDocument;
    if (!parsed || !Array.isArray(parsed.operations)) throw new Error('El doc no tiene operations[] — data corrupta.');

    const revActual = String(parsed.header?.revision || registry?.amfe_code && 'A' || 'A');
    const revNueva = getNextRevisionLevel(revActual);
    const hoy = fechaAR();

    log(`\n═══ OFICIALIZAR AMFE ${AMFE_NRO} ═══`);
    log(`Producto: ${registry?.producto || parsed.header?.subject || '(s/d)'}`);
    log(`Revisión: ${revActual} → ${revNueva}   Fecha: ${hoy}`);

    // ── Gate 1: exportable (S/O/D) ──
    const { assertAmfeExportable } = await import('../modules/amfe/amfeExcelExport');
    try {
        assertAmfeExportable(parsed);
        log('Gate S/O/D: OK');
    } catch (e) {
        log(`\n❌ Gate S/O/D FALLÓ:\n${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
    }

    // ── Cambios que alimentan la revisión ──
    let summaries: string[] = [];
    let fuente = '';
    if (pending.length) {
        summaries = pending.map(p => p.summary);
        fuente = `${pending.length} cambio(s) del change-log`;
    } else if (lastSnapshot) {
        const prev = parseData(lastSnapshot.snapshot_data) as AmfeDocument;
        const diff = diffAmfeDocs(prev, parsed);
        summaries = diff.map(d => d.summary);
        fuente = summaries.length ? `${summaries.length} cambio(s) vs snapshot rev ${lastSnapshot.revision_level}` : 'sin diferencias vs snapshot';
    }
    if (!summaries.length) {
        if (!DESC) {
            log('\n❌ No hay cambios pendientes ni diff contra snapshot. Pasá --desc "motivo de la revisión".');
            process.exit(1);
        }
        summaries = [DESC];
        fuente = '--desc (manual)';
    }
    const descripcion = DESC || summaries.join('; ');

    log(`\nCambios (${fuente}):`);
    summaries.slice(0, 20).forEach(s => log(`  • ${s}`));
    if (summaries.length > 20) log(`  … y ${summaries.length - 20} más`);

    // ── Plan de archivos en Y: ──
    const serverPath = registry?.server_path || '';
    const prod = (registry?.producto || parsed.header?.subject || AMFE_NRO)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // sacar acentos
        .replace(/[^a-zA-Z0-9 _-]/g, '').trim();
    const nombreNuevo = `AMFE ${AMFE_NRO} - ${prod} - Rev.${revNueva}.xlsx`;
    log('\nArchivos en Y::');
    if (serverPath) {
        const abs = join(RUTA_BASE_AMFE, serverPath);
        log(`  Vigente actual → OBSOLETO: ${serverPath}`);
        log(`  Nuevo: ${join(dirname(serverPath), nombreNuevo)}`);
        if (!DUMP && !existsSync(abs)) log(`  ⚠ El archivo vigente no existe en disco: ${abs}`);
    } else {
        log('  ⚠ Sin server_path en el registry — no se moverá/copiará nada. Definir la ubicación primero.');
    }
    log(`Export local: ${join(STAGING, nombreNuevo)}`);
    log('Listado Maestro: se regenera desde amfe_registry.');

    // ── Construir el workbook oficial (siempre, para verificar que exporta) ──
    parsed.header.revision = revNueva;
    parsed.header.revDate = hoy;
    const nuevaRevisionEntry = { rev: revNueva, date: hoy, description: descripcion, modifiedBy: 'FS' };
    const revisionsPrev = (() => { try { return JSON.parse(doc.revisions || '[]'); } catch { return []; } })();
    const revisionsNew = [...revisionsPrev, nuevaRevisionEntry];

    const wb = buildAmfeOficialWorkbook(parsed, { revisions: revisionsNew, status: 'approved' as AmfeLifecycleStatus });

    if (!APPLY) {
        // En dry-run igual escribimos el Excel de preview local (no toca Supabase ni Y:).
        mkdirSync(STAGING, { recursive: true });
        const previewPath = join(STAGING, `PREVIEW_${nombreNuevo}`);
        writeFileSync(previewPath, Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer));
        log(`\n→ DRY-RUN. Preview del Excel escrito en ${previewPath}. Nada más se tocó.`);
        log('   Agregá --apply (con env de Supabase) para oficializar de verdad.');
        return;
    }

    // ══════════════════ APPLY (live) ══════════════════
    if (!sb) throw new Error('--apply requiere conexión Supabase.');
    mkdirSync(STAGING, { recursive: true });
    mkdirSync(REPORTS, { recursive: true });
    const rollback: Array<Record<string, string>> = [];

    // 1. Snapshot del estado ACTUAL (rev vieja) a document_revisions
    log('\n[1/6] Snapshot a document_revisions…');
    const { error: eSnap } = await sb.from('document_revisions').insert({
        module: 'amfe', document_id: doc.id, revision_level: revActual,
        description: `Estado previo a rev ${revNueva}`, revised_by: 'FS',
        snapshot_data: doc.data, parent_revision_level: '',
    });
    if (eSnap) throw new Error(`Snapshot falló: ${eSnap.message}`);

    // 2. Update amfe_documents.data (+ revisions/status/rev level) via runWithValidation
    log('[2/6] Update amfe_documents (con validación)…');
    const before = parseData(doc.data);
    await runWithValidation(
        [{ id: doc.id, amfeNumber: AMFE_NRO, productName: registry?.producto || '', before, after: parsed }],
        true,
        async () => {
            await saveAmfe(sb, doc.id, parsed, {
                expectedAmfeNumber: AMFE_NRO,
                extraFields: {
                    revisions: JSON.stringify(revisionsNew),
                    status: 'approved',
                    revision_level: revNueva,
                    last_revision_date: hoy,
                },
            });
        },
    );

    // 3. Marcar change_log consumido
    log('[3/6] Marcar change-log consumido…');
    await sb.from('amfe_change_log').update({ consumed_in_rev: revNueva })
        .eq('document_id', doc.id).is('consumed_in_rev', null);

    // 4. Update amfe_registry
    log('[4/6] Update amfe_registry…');
    const historial = (() => { try { return JSON.parse(registry?.historial || '[]'); } catch { return []; } })();
    historial.push({ rev: revNueva, date: hoy, description: descripcion, solicitante: 'FS', aprobador: '', vinculo: '' });
    if (registry) {
        await sb.from('amfe_registry').update({
            rev_actual: revNueva, fecha_ultima_rev: hoy, estado: 'Liberado',
            proxima_revision: mas6MesesAR(), historial: JSON.stringify(historial),
        }).eq('amfe_code', AMFE_NRO);
    }

    // 5. Export + archivos en Y:
    log('[5/6] Exportar Excel y archivar en Y:…');
    const localPath = join(STAGING, nombreNuevo);
    writeFileSync(localPath, Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer));
    rollback.push({ op: 'export', dst: localPath });

    if (serverPath) {
        const absVigente = join(RUTA_BASE_AMFE, serverPath);
        const carpeta = dirname(absVigente);
        const obsoletoDir = join(carpeta, CARPETA_OBSOLETO);
        if (existsSync(absVigente)) {
            mkdirSync(obsoletoDir, { recursive: true });
            const dstObs = join(obsoletoDir, basename(absVigente));
            renameSync(absVigente, dstObs);
            rollback.push({ op: 'move', from: absVigente, to: dstObs });
        }
        const dstNuevo = join(carpeta, nombreNuevo);
        copyFileSync(localPath, dstNuevo);
        rollback.push({ op: 'copy', from: localPath, to: dstNuevo });
        if (LEGAJO) {
            mkdirSync(LEGAJO, { recursive: true });
            const dstLegajo = join(LEGAJO, nombreNuevo);
            copyFileSync(localPath, dstLegajo);
            rollback.push({ op: 'copy', from: localPath, to: dstLegajo });
        }
        // registry.server_path nuevo (relativo)
        const nuevoRel = join(dirname(serverPath), nombreNuevo);
        await sb.from('amfe_registry').update({ server_path: nuevoRel }).eq('amfe_code', AMFE_NRO);
    }
    const rollbackPath = join(REPORTS, `oficializar_${AMFE_NRO}_${revNueva}.json`);
    writeFileSync(rollbackPath, JSON.stringify({ amfe: AMFE_NRO, rev: revNueva, fecha: hoy, ops: rollback }, null, 2));
    log(`   Log de rollback: ${rollbackPath}`);

    // 6. Regenerar Listado Maestro (dump fresco del registry)
    log('[6/6] Regenerar Listado Maestro…');
    const { data: allRegistry } = await sb.from('amfe_registry').select('*');
    const dumpReg = join(REPORTS, `registry_dump_${revNueva}.json`);
    writeFileSync(dumpReg, JSON.stringify(allRegistry ?? [], null, 2));
    await regenerarListadoMaestro({ dump: dumpReg, publicar: true, log });

    log(`\n✅ AMFE ${AMFE_NRO} oficializado a rev ${revNueva}. Excel: ${localPath}`);
    log('   Recordá correr el backup: node scripts/_backup.mjs');
}

main().catch(e => { console.error(`\n❌ ERROR: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });

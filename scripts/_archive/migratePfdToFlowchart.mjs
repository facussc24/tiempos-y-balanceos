/**
 * Migra los documentos del modulo PFD viejo (tabla pfd_documents) al formato
 * nuevo del modulo Flowchart (tabla flowchart_documents).
 *
 * Flags:
 *   --dry-run   No escribe a Supabase. Solo reporta que haria.
 *   --no-backup Skip the JSON backup step.
 *   --force     Sobreescribe archive/pfd-legacy/pfd_documents_backup.json si existe.
 *
 * Uso tipico:
 *   node scripts/migratePfdToFlowchart.mjs --dry-run
 *   node scripts/migratePfdToFlowchart.mjs
 *
 * Requiere credenciales Supabase en .env.local (mismo patron que scripts/_backup.mjs).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// --------------------------------------------------------------------------
// CLI flags
// --------------------------------------------------------------------------
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const DO_BACKUP = !args.has('--no-backup');
const FORCE = args.has('--force');

// --------------------------------------------------------------------------
// Paths
// --------------------------------------------------------------------------
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const archiveDir = new URL('../archive/pfd-legacy/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const backupPath = `${archiveDir}pfd_documents_backup.json`;
const reportPath = `${archiveDir}migration-report.md`;

// --------------------------------------------------------------------------
// Logging helpers
// --------------------------------------------------------------------------
function log(msg) { console.log(msg); }
function warn(msg) { console.warn(`  ! ${msg}`); }
function err(msg) { console.error(`  X ${msg}`); }

// --------------------------------------------------------------------------
// Supabase client
// --------------------------------------------------------------------------
function loadEnv() {
    const envText = readFileSync(envPath, 'utf8');
    return Object.fromEntries(
        envText
            .split('\n')
            .filter((l) => l.includes('=') && !l.startsWith('#'))
            .map((l) => {
                const i = l.indexOf('=');
                return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
            })
    );
}

async function getSupabase() {
    const env = loadEnv();
    const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    const { error } = await sb.auth.signInWithPassword({
        email: env.VITE_AUTO_LOGIN_EMAIL,
        password: env.VITE_AUTO_LOGIN_PASSWORD,
    });
    if (error) throw new Error(`Supabase login failed: ${error.message}`);
    return sb;
}

// --------------------------------------------------------------------------
// Mapping logic
// --------------------------------------------------------------------------

/** Map the legacy PFD stepType enum to a Flowchart node type. */
function mapType(oldType) {
    switch ((oldType || '').toLowerCase()) {
        case 'operation':  return 'operation';
        case 'inspection': return 'inspection';
        case 'transport':  return 'transfer';
        case 'storage':    return 'storage';
        case 'decision':   return 'condition';
        case 'op-ins':     return 'op-ins';
        case 'combined':   return 'op-ins';
        default:           return 'operation';
    }
}

/** Map a legacy PFD step to a Flowchart node. */
function mapStepToNode(step) {
    const raw = step?.description ?? step?.name ?? '';
    return {
        type: mapType(step?.stepType ?? step?.type),
        stepId: (step?.stepNumber ?? '').toString(),
        description: String(raw).toUpperCase(),
    };
}

/** Derive productCodes from an AMFE's applicableParts field. */
function deriveProductCodes(applicableParts) {
    if (!applicableParts || typeof applicableParts !== 'string') return [];
    const lines = applicableParts
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    return lines.map((line) => ({
        code: line,
        level: '',
        description: '',
        version: '',
    }));
}

/** Build a FlowchartDocument from a legacy PFD row + matching AMFE row. */
function buildFlowchart(pfd, amfe) {
    const header = pfd.data?.header ?? {};
    const partName = header.partName ?? '';
    const partNumber = header.partNumber ?? 'TBD';
    const revision = header.revisionLevel ?? 'A';
    const updatedAt = pfd.updated_at || new Date().toISOString();

    const linkedAmfeProject =
        header.linkedAmfeProject ||
        pfd.project_name ||
        partName ||
        'sin-proyecto';

    const client =
        (amfe && amfe.client) ||
        pfd.client ||
        (String(linkedAmfeProject).startsWith('PWA') ? 'PWA' : 'VWA');

    const flowchart = {
        id: randomUUID(),
        linkedAmfeProject,
        header: {
            title: `Flujograma de Proceso — ${partName || 'SIN NOMBRE'}`,
            documentCode: `FLJ-${partNumber}`,
            revision,
            date: String(updatedAt).slice(0, 10),
            preparedBy: 'Facundo Santoro',
            reviewedBy: 'Manuel Meszaros',
            project: partName || linkedAmfeProject || '',
            client,
        },
        productCodes: deriveProductCodes(amfe?.data?.header?.applicableParts),
        nodes: Array.isArray(pfd.data?.steps) ? pfd.data.steps.map(mapStepToNode) : [],
        createdAt: pfd.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    return flowchart;
}

// --------------------------------------------------------------------------
// Supabase helpers
// --------------------------------------------------------------------------

/** Check whether flowchart_documents exists. */
async function tableExists(sb) {
    const { data, error } = await sb.rpc('exec_sql_read', {
        query:
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='flowchart_documents'",
        params: [],
    });
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
}

/** Try to create the table via exec_sql_write (swallows DDL errors). */
async function tryCreateTable(sb) {
    const ddl = `CREATE TABLE IF NOT EXISTS flowchart_documents (
        id                  TEXT PRIMARY KEY,
        linked_amfe_project TEXT NOT NULL UNIQUE,
        data                JSONB NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sb.rpc('exec_sql_write', { query: ddl, params: [] });
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main() {
    log('====================================================================');
    log(' Migracion PFD -> Flowchart');
    log('====================================================================');
    log(`Modo        : ${DRY_RUN ? 'DRY-RUN (sin escribir)' : 'REAL'}`);
    log(`Backup json : ${DO_BACKUP ? 'si' : 'no'}`);
    log(`Force       : ${FORCE ? 'si' : 'no'}`);
    log('');

    // 1. Connect
    log('1. Conectando a Supabase...');
    let sb;
    try {
        sb = await getSupabase();
    } catch (e) {
        err(e.message || e);
        process.exit(2);
    }
    log('   OK');

    // 2. Load PFD rows
    log('2. Leyendo pfd_documents...');
    const { data: pfdRows, error: pfdErr } = await sb.from('pfd_documents').select('*');
    if (pfdErr) {
        err(`No se pudo leer pfd_documents: ${pfdErr.message}`);
        process.exit(3);
    }
    if (!Array.isArray(pfdRows) || pfdRows.length === 0) {
        warn('No hay documentos en pfd_documents. Nada que migrar.');
        process.exit(0);
    }
    // Supabase returns `data` as object for JSONB; if TEXT, parse it.
    for (const r of pfdRows) {
        if (typeof r.data === 'string') {
            try { r.data = JSON.parse(r.data); } catch { /* leave as-is */ }
        }
    }
    log(`   OK (${pfdRows.length} documentos)`);

    // 3. Backup JSON
    if (DO_BACKUP) {
        log('3. Backup JSON preventivo...');
        if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });
        if (existsSync(backupPath) && !FORCE) {
            log(`   OK (ya existe, se conserva: ${backupPath})`);
        } else {
            writeFileSync(backupPath, JSON.stringify(pfdRows, null, 2));
            log(`   OK (${backupPath})`);
        }
    }

    // 4. Load AMFE rows for productCode derivation
    log('4. Leyendo amfe_documents para derivar productCodes...');
    const { data: amfeRows, error: amfeErr } = await sb.from('amfe_documents').select('*');
    if (amfeErr) {
        warn(`No se pudieron leer amfe_documents: ${amfeErr.message}`);
    }
    for (const r of amfeRows || []) {
        if (typeof r.data === 'string') {
            try { r.data = JSON.parse(r.data); } catch { /* leave */ }
        }
    }
    const amfeByProject = new Map();
    for (const a of amfeRows || []) {
        if (a.project_name) amfeByProject.set(a.project_name, a);
    }
    log(`   OK (${amfeRows?.length ?? 0} AMFEs indexados por project_name)`);

    // 5. Ensure table exists (only blocking on real run)
    log('5. Verificando tabla flowchart_documents...');
    let exists = await tableExists(sb);
    if (!exists) {
        log('   Tabla no existe. Intentando crearla via exec_sql_write...');
        await tryCreateTable(sb);
        exists = await tableExists(sb);
    }
    if (exists) {
        log('   OK');
    } else if (DRY_RUN) {
        warn('La tabla flowchart_documents NO existe todavia.');
        warn('El dry-run continua con el mapeo, pero para el run real vas a necesitar:');
        warn('  Aplicar supabase/migrations/004_flowchart_documents.sql desde el');
        warn('  SQL Editor de Supabase dashboard (el rol authenticated no puede crear tablas).');
    } else {
        err('La tabla flowchart_documents no existe en Supabase y no pudo crearse');
        err('desde el rol `authenticated` (falta privilegio CREATE en schema public).');
        err('');
        err('Aplicar supabase/migrations/004_flowchart_documents.sql desde el');
        err('SQL Editor del dashboard de Supabase y volver a correr:');
        err('   node scripts/migratePfdToFlowchart.mjs');
        process.exit(4);
    }

    // 6. Map and collect
    log('6. Mapeando PFD -> Flowchart...');
    const migrated = [];
    const skipped = [];
    const warnings = [];

    for (const pfd of pfdRows) {
        try {
            if (!pfd.data || typeof pfd.data !== 'object' || !Array.isArray(pfd.data.steps)) {
                skipped.push({ id: pfd.id, reason: 'data malformado (sin steps array)' });
                warn(`[${pfd.id}] data malformado — skipped`);
                continue;
            }

            const linkedAmfeProject =
                pfd.data?.header?.linkedAmfeProject ||
                pfd.project_name ||
                pfd.data?.header?.partName ||
                'sin-proyecto';

            const amfe = amfeByProject.get(linkedAmfeProject) || null;
            if (!amfe) {
                warnings.push({
                    id: pfd.id,
                    linkedAmfeProject,
                    msg: 'No se encontro AMFE que matchee con project_name. productCodes quedara vacio.',
                });
            }

            const flowchart = buildFlowchart(pfd, amfe);

            // Detect duplicate linkedAmfeProject among source PFDs
            const prior = migrated.find((m) => m.flowchart.linkedAmfeProject === flowchart.linkedAmfeProject);
            if (prior) {
                const priorUpdated = new Date(prior.sourcePfd.updated_at || 0).getTime();
                const thisUpdated = new Date(pfd.updated_at || 0).getTime();
                if (thisUpdated > priorUpdated) {
                    warnings.push({
                        id: pfd.id,
                        linkedAmfeProject: flowchart.linkedAmfeProject,
                        msg: `Conflicto con PFD ${prior.sourcePfd.id}. Este es mas reciente — se prefiere este.`,
                    });
                    // replace
                    const idx = migrated.indexOf(prior);
                    migrated[idx] = { sourcePfd: pfd, flowchart, amfeMatched: !!amfe };
                } else {
                    warnings.push({
                        id: pfd.id,
                        linkedAmfeProject: flowchart.linkedAmfeProject,
                        msg: `Conflicto con PFD ${prior.sourcePfd.id}. Aquel es mas reciente — se descarta este.`,
                    });
                    skipped.push({ id: pfd.id, reason: 'conflicto linkedAmfeProject (version mas vieja)' });
                }
                continue;
            }

            migrated.push({ sourcePfd: pfd, flowchart, amfeMatched: !!amfe });
        } catch (e) {
            skipped.push({ id: pfd.id, reason: (e && e.message) || String(e) });
            warn(`[${pfd.id}] error en mapeo: ${(e && e.message) || e}`);
        }
    }
    log(`   OK migrados=${migrated.length} skipped=${skipped.length} warnings=${warnings.length}`);

    // 7. Report mapped docs
    log('');
    log('7. Documentos mapeados:');
    for (const m of migrated) {
        const pc = m.flowchart.productCodes.length;
        const nodes = m.flowchart.nodes.length;
        log(
            `   - [${m.sourcePfd.id.slice(0, 8)}...] "${m.flowchart.header.project}" ` +
            `(linkedAmfeProject="${m.flowchart.linkedAmfeProject}") ` +
            `nodes=${nodes} productCodes=${pc} amfeMatched=${m.amfeMatched}`
        );
    }

    if (warnings.length > 0) {
        log('');
        log('Warnings:');
        for (const w of warnings) log(`   ! [${w.id}] ${w.linkedAmfeProject}: ${w.msg}`);
    }
    if (skipped.length > 0) {
        log('');
        log('Skipped:');
        for (const s of skipped) log(`   X [${s.id}] ${s.reason}`);
    }

    // 8. Write to Supabase
    if (DRY_RUN) {
        log('');
        log('8. DRY-RUN: no se escribe nada a Supabase.');
    } else {
        log('');
        log('8. Escribiendo a flowchart_documents (upsert by linked_amfe_project)...');
        let okCount = 0;
        let errCount = 0;
        for (const m of migrated) {
            const row = {
                id: m.flowchart.id,
                linked_amfe_project: m.flowchart.linkedAmfeProject,
                // JSONB column — pass object directly, NEVER JSON.stringify
                data: m.flowchart,
                created_at: m.flowchart.createdAt,
                updated_at: m.flowchart.updatedAt,
            };
            const { error: upErr } = await sb
                .from('flowchart_documents')
                .upsert(row, { onConflict: 'linked_amfe_project' });
            if (upErr) {
                errCount += 1;
                err(`[${m.flowchart.linkedAmfeProject}] ${upErr.message}`);
            } else {
                okCount += 1;
            }
        }
        log(`   OK escritos=${okCount} fallidos=${errCount}`);
        if (errCount > 0) {
            skipped.push(
                ...migrated
                    .slice(-errCount)
                    .map((m) => ({ id: m.sourcePfd.id, reason: 'upsert fallo' }))
            );
        }
    }

    // 9. Write markdown report
    log('');
    log('9. Escribiendo migration-report.md...');
    const lines = [];
    lines.push(`# Migracion PFD -> Flowchart — Reporte`);
    lines.push('');
    lines.push(`- Fecha     : ${new Date().toISOString()}`);
    lines.push(`- Modo      : ${DRY_RUN ? 'DRY-RUN' : 'REAL'}`);
    lines.push(`- Total PFD : ${pfdRows.length}`);
    lines.push(`- Migrados  : ${migrated.length}`);
    lines.push(`- Skipped   : ${skipped.length}`);
    lines.push(`- Warnings  : ${warnings.length}`);
    lines.push('');
    lines.push('## Documentos migrados');
    lines.push('');
    lines.push('| Source PFD ID | linkedAmfeProject | project | nodes | productCodes | amfeMatched |');
    lines.push('|---------------|-------------------|---------|-------|--------------|-------------|');
    for (const m of migrated) {
        lines.push(
            `| ${m.sourcePfd.id} | ${m.flowchart.linkedAmfeProject} | ` +
            `${m.flowchart.header.project} | ${m.flowchart.nodes.length} | ` +
            `${m.flowchart.productCodes.length} | ${m.amfeMatched ? 'yes' : 'no'} |`
        );
    }
    if (warnings.length > 0) {
        lines.push('');
        lines.push('## Warnings');
        lines.push('');
        for (const w of warnings) lines.push(`- **${w.id}** (${w.linkedAmfeProject}): ${w.msg}`);
    }
    if (skipped.length > 0) {
        lines.push('');
        lines.push('## Skipped');
        lines.push('');
        for (const s of skipped) lines.push(`- **${s.id}**: ${s.reason}`);
    }
    lines.push('');
    lines.push('## Detalle por documento migrado');
    lines.push('');
    for (const m of migrated) {
        lines.push(`### ${m.flowchart.linkedAmfeProject}`);
        lines.push('');
        lines.push(`- **Source PFD id**: ${m.sourcePfd.id}`);
        lines.push(`- **New Flowchart id**: ${m.flowchart.id}`);
        lines.push(`- **Header**: ${JSON.stringify(m.flowchart.header)}`);
        lines.push(`- **productCodes (${m.flowchart.productCodes.length})**:`);
        for (const pc of m.flowchart.productCodes) {
            lines.push(`  - \`${pc.code}\``);
        }
        lines.push(`- **nodes (${m.flowchart.nodes.length})**:`);
        for (const n of m.flowchart.nodes) {
            const d = (n.description || '').slice(0, 80);
            lines.push(`  - [${n.type}] ${n.stepId || '-'} — ${d}`);
        }
        lines.push('');
    }

    if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });
    writeFileSync(reportPath, lines.join('\n'));
    log(`   OK ${reportPath}`);

    // 10. Final summary
    log('');
    log('====================================================================');
    log(` RESUMEN`);
    log('====================================================================');
    log(`  migrados  = ${migrated.length}`);
    log(`  skipped   = ${skipped.length}`);
    log(`  warnings  = ${warnings.length}`);
    log(`  dry-run   = ${DRY_RUN}`);
    log('');

    process.exit(0);
}

main().catch((e) => {
    console.error('FATAL:', e?.stack || e);
    process.exit(1);
});

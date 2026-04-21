/**
 * Restore generico desde un backup guardado en backups/<timestamp>/
 *
 * USO:
 *   node scripts/_restore.mjs <timestamp> [tabla]              # dry-run
 *   node scripts/_restore.mjs <timestamp> [tabla] --apply      # ejecuta
 *   node scripts/_restore.mjs --list                           # lista backups disponibles
 *
 * EJEMPLOS:
 *   node scripts/_restore.mjs --list
 *   node scripts/_restore.mjs 2026-04-20T19-42-58                          # TODAS las tablas, dry-run
 *   node scripts/_restore.mjs 2026-04-20T19-42-58 amfe_documents           # solo 1 tabla, dry-run
 *   node scripts/_restore.mjs 2026-04-20T19-42-58 amfe_documents --apply   # ejecuta
 *
 * SEGURIDAD:
 *   - Dry-run por default. Imprime filas que va a crear/actualizar.
 *   - Hace un backup fresco ANTES de restaurar (snapshot del estado actual).
 *   - Usa upsert: si el id existe, actualiza; si no existe, inserta.
 *   - NUNCA borra filas que existan en Supabase pero no en el backup (comportamiento conservador).
 *     -> Si queres eliminar esas filas despues, hay que hacerlo a mano.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIST = args.includes('--list');
const posArgs = args.filter(a => !a.startsWith('--'));
const TS = posArgs[0];
const SINGLE_TABLE = posArgs[1];

const projectRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const backupsRoot = `${projectRoot}/backups`;

// --- LIST MODE --------------------------------------------------------
if (LIST) {
    const entries = readdirSync(backupsRoot)
        .filter(n => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(n))
        .sort()
        .reverse()
        .slice(0, 20);
    console.log('Ultimos 20 backups disponibles:\n');
    for (const e of entries) {
        const dir = `${backupsRoot}/${e}`;
        const files = readdirSync(dir).filter(f => f.endsWith('.json'));
        console.log(`  ${e}  (${files.length} tablas)`);
    }
    console.log(`\nUso: node scripts/_restore.mjs <timestamp> [tabla] [--apply]`);
    process.exit(0);
}

if (!TS) {
    console.error('ERROR: falta timestamp del backup. Corre con --list para ver los disponibles.');
    process.exit(1);
}

const backupDir = `${backupsRoot}/${TS}`;
if (!existsSync(backupDir)) {
    console.error(`ERROR: no existe el backup ${backupDir}`);
    process.exit(1);
}

// --- CONNECT ----------------------------------------------------------
const envPath = `${projectRoot}/.env.local`;
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// --- PRE-RESTORE BACKUP (si vamos a ejecutar) -------------------------
if (APPLY) {
    console.log('Haciendo backup del estado actual antes de restaurar...\n');
    const preTs = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    const preDir = `${backupsRoot}/${preTs}`;
    mkdirSync(preDir, { recursive: true });

    const tablesToBackup = SINGLE_TABLE
        ? [SINGLE_TABLE]
        : readdirSync(backupDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));

    for (const t of tablesToBackup) {
        const { data, error } = await sb.from(t).select('*');
        if (error) { console.log(`  X ${t}: ${error.message}`); continue; }
        for (const row of (data || [])) {
            if (typeof row.data === 'string') row.data = JSON.parse(row.data);
        }
        writeFileSync(`${preDir}/${t}.json`, JSON.stringify(data, null, 2));
        console.log(`  Snapshot previo: ${t} (${(data || []).length} rows)`);
    }
    console.log(`\nSi algo sale mal: node scripts/_restore.mjs ${preTs} --apply\n`);
}

// --- RESTORE ----------------------------------------------------------
const files = SINGLE_TABLE
    ? [`${SINGLE_TABLE}.json`]
    : readdirSync(backupDir).filter(f => f.endsWith('.json'));

console.log(`${APPLY ? 'RESTAURANDO' : 'DRY-RUN'} desde ${TS}\n`);

let totalUpserts = 0;
let totalConflicts = 0;

for (const file of files) {
    const table = file.replace('.json', '');
    const filePath = `${backupDir}/${file}`;
    if (!existsSync(filePath)) {
        console.log(`  X ${table}: no hay snapshot en el backup`);
        continue;
    }

    const rows = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(rows)) {
        console.log(`  X ${table}: formato invalido`);
        continue;
    }

    console.log(`\n${table}: ${rows.length} filas en backup`);

    if (!APPLY) {
        // Dry-run: mostrar resumen y primera fila
        if (rows.length > 0) {
            const ids = rows.map(r => r.id).filter(Boolean).slice(0, 5);
            console.log(`  Primeros ids: ${ids.join(', ')}${rows.length > 5 ? '...' : ''}`);
        }
        continue;
    }

    // Apply: upsert en lotes de 100
    const BATCH = 100;
    let done = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await sb.from(table).upsert(batch, { onConflict: 'id' });
        if (error) {
            console.log(`  X batch ${i}-${i + batch.length}: ${error.message}`);
            totalConflicts += batch.length;
            continue;
        }
        done += batch.length;
        totalUpserts += batch.length;
    }
    console.log(`  OK ${done}/${rows.length} restauradas`);
}

console.log(`\n${APPLY ? 'LISTO' : 'DRY-RUN'}. Upserts: ${totalUpserts}. Conflictos: ${totalConflicts}.`);
if (!APPLY) console.log('Agrega --apply para ejecutar.');
process.exit(0);

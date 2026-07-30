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
//
// 2026-07-30: antes esta lista filtraba por el regex /^\d{4}-...T\d{2}-\d{2}-\d{2}$/,
// asi que ESCONDIA toda carpeta con nombre distinto — incluidas las unicas que
// quedaban (2026-06-25_amarok_final, 2026-06-25_amarok_load) y las dos que alguien
// habia renombrado a VACIO_NO_RESTAURAR_* como advertencia. Resultado: en una
// emergencia la herramienta contestaba "no hay backups".
//
// Ahora lista CUALQUIER carpeta con .json adentro y dice cuantas filas tiene cada
// una, para que un backup vacio se vea a simple vista en vez de esconderse.
if (LIST) {
    const carpetas = readdirSync(backupsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .reverse();

    if (carpetas.length === 0) {
        console.log('No hay ninguna carpeta de backup en backups/.');
        console.log('Genera uno con: node scripts/_backup.mjs');
        process.exit(0);
    }

    console.log(`Backups en backups/ (${carpetas.length}):\n`);

    for (const nombre of carpetas) {
        const dir = `${backupsRoot}/${nombre}`;
        const archivos = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_manifest.json');

        let filas = 0;
        let ilegibles = 0;
        for (const f of archivos) {
            try {
                const contenido = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8') || '[]');
                filas += Array.isArray(contenido) ? contenido.length : 0;
            } catch {
                ilegibles++;
            }
        }

        // El manifest lo escribe _backup.mjs desde 2026-07-30 y trae el veredicto.
        let nota = '';
        if (existsSync(`${dir}/_manifest.json`)) {
            try {
                const m = JSON.parse(readFileSync(`${dir}/_manifest.json`, 'utf8'));
                const probs = (m.problemas || []).length;
                nota = probs ? `  [manifest: ${probs} problema(s)]` : '  [manifest: OK]';
            } catch { nota = '  [manifest ilegible]'; }
        }

        let estado;
        if (archivos.length === 0) estado = 'SIN ARCHIVOS — NO RESTAURAR';
        else if (filas === 0) estado = 'VACIO — NO RESTAURAR';
        else if (ilegibles > 0) estado = `PARCIAL — ${ilegibles} archivo(s) ilegible(s)`;
        else estado = 'con datos';

        console.log(`  ${nombre}`);
        console.log(`      ${archivos.length} tabla(s), ${filas} fila(s) — ${estado}${nota}`);
    }

    console.log(`\nUso: node scripts/_restore.mjs <carpeta> [tabla] [--apply]`);
    console.log('Sin --apply es dry-run. Nunca restaures desde una carpeta marcada VACIO.');
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

/**
 * Backup completo de Supabase. Guarda un JSON por tabla en backups/<timestamp>/.
 *
 * QUE SE ARREGLO EL 2026-07-30
 *
 * 1. La lista de tablas estaba ESCRITA A MANO (12 tablas) y se habia quedado vieja.
 *    Quedaban afuera, entre otras: amfe_registry (68 filas), bom_documents (10),
 *    projects (16), drafts (24), medios_pieces (37), medios_container_types (10),
 *    medios_projects (2), schema_version (5), user_roles (1). Ahora la lista se
 *    DESCUBRE de information_schema y el backup falla si aparece una tabla con
 *    filas que no quedo respaldada.
 *
 * 2. No habia paginacion. Supabase corta en 1000 filas por request: `products` ya
 *    tiene 491 y venia creciendo, asi que el backup estaba a mitad de camino de
 *    truncarse en silencio. Ahora se pagina con .range() y se compara la cantidad
 *    traida contra el conteo real de la tabla.
 *
 * 3. La unica asercion era "amfe_documents > 0". Cualquier OTRA tabla podia volver
 *    vacia y el backup se declaraba valido. Ahora hay una asercion POR TABLA.
 *
 * El fallo que esto previene es real: los backups del 8/7 al 27/7 de 2026 salieron
 * vacios porque faltaba VITE_AUTO_LOGIN_PASSWORD y RLS devolvia 0 filas SIN error.
 * Nadie se entero durante 19 dias. La regla que sale de ahi: **una lista vacia nunca
 * puede significar "no pude leer"**.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const rutaLocal = (relativa) =>
    new URL(relativa, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const envText = readFileSync(rutaLocal('../.env.local'), 'utf8');
const env = Object.fromEntries(
    envText
        .split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
);

const REQUERIDAS = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_AUTO_LOGIN_EMAIL',
    'VITE_AUTO_LOGIN_PASSWORD',
];
const faltan = REQUERIDAS.filter((k) => !env[k]);
if (faltan.length) {
    console.error(`\n✗ BACKUP ABORTADO — faltan variables en .env.local: ${faltan.join(', ')}`);
    console.error('  Sin login, las tablas con RLS devuelven 0 filas y el backup queda vacio.');
    console.error('  Un backup vacio que se reporta OK es peor que no hacer backup: si despues');
    console.error('  alguien restaura desde ahi, borra todo.\n');
    process.exit(1);
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data: auth, error: authError } = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authError || !auth?.user) {
    console.error(`\n✗ BACKUP ABORTADO — no se pudo autenticar: ${authError?.message || 'sin usuario'}`);
    console.error('  Revisar VITE_AUTO_LOGIN_EMAIL / VITE_AUTO_LOGIN_PASSWORD en .env.local.\n');
    process.exit(1);
}
console.log(`  auth OK: ${auth.user.email}`);

// --------------------------------------------------------------------------
// 1. Descubrir las tablas y sus conteos REALES.
//    Se usa el mismo RPC que usa la app (exec_sql_read). Si no esta disponible,
//    ABORTAR: hacer backup de una lista adivinada es como no hacerlo.
// --------------------------------------------------------------------------
const SQL_INVENTARIO = `
  select table_name,
         (xpath('/row/c/text()',
           query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                        false, true, '')))[1]::text::bigint as filas
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name`;

const { data: inventario, error: errInv } = await sb.rpc('exec_sql_read', {
    query: SQL_INVENTARIO,
    params: [],
});

if (errInv || !Array.isArray(inventario) || inventario.length === 0) {
    console.error(`\n✗ BACKUP ABORTADO — no se pudo listar las tablas: ${errInv?.message || 'respuesta vacia'}`);
    console.error('  Sin el inventario no se puede garantizar que el backup este completo.\n');
    process.exit(1);
}

const conteoEsperado = new Map(inventario.map((r) => [r.table_name, Number(r.filas)]));
const conFilas = [...conteoEsperado.entries()].filter(([, n]) => n > 0);
console.log(`  inventario: ${conteoEsperado.size} tablas, ${conFilas.length} con filas`);

// --------------------------------------------------------------------------
// 2. Bajar cada tabla, paginando.
// --------------------------------------------------------------------------
const PAGINA = 1000;

async function bajarTabla(tabla) {
    const filas = [];
    for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await sb.from(tabla).select('*').range(desde, desde + PAGINA - 1);
        if (error) return { error: error.message };
        filas.push(...(data || []));
        if (!data || data.length < PAGINA) break;
    }
    return { filas };
}

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = rutaLocal(`../backups/${ts}`);
mkdirSync(dir, { recursive: true });

const manifest = { generado: new Date().toISOString(), usuario: auth.user.email, tablas: {} };
const problemas = [];
let total = 0;

for (const [tabla, esperadas] of conteoEsperado) {
    if (esperadas === 0) {
        manifest.tablas[tabla] = { esperadas: 0, respaldadas: 0, estado: 'vacia-en-origen' };
        continue;
    }

    const { filas, error } = await bajarTabla(tabla);
    if (error) {
        console.log(`  X  ${tabla}: ${error}`);
        problemas.push(`${tabla}: no se pudo leer (${error})`);
        manifest.tablas[tabla] = { esperadas, respaldadas: 0, estado: 'ERROR', error };
        continue;
    }

    // Los campos JSON se guardan parseados para que el archivo sea legible y
    // para que un restore no double-serialice (bug conocido del proyecto).
    for (const row of filas) {
        if (typeof row.data === 'string') {
            try {
                row.data = JSON.parse(row.data);
            } catch {
                problemas.push(`${tabla}: la fila ${row.id} tiene 'data' que no es JSON valido`);
            }
        }
    }

    writeFileSync(`${dir}/${tabla}.json`, JSON.stringify(filas, null, 2));
    total += filas.length;

    // ASERCION POR TABLA: lo traido tiene que coincidir con lo que hay en origen.
    if (filas.length !== esperadas) {
        console.log(`  X  ${tabla}: ${filas.length} filas, se esperaban ${esperadas}`);
        problemas.push(`${tabla}: respaldadas ${filas.length} de ${esperadas} (RLS, paginacion o borrado concurrente)`);
        manifest.tablas[tabla] = { esperadas, respaldadas: filas.length, estado: 'DESCUADRE' };
    } else {
        console.log(`  OK ${tabla}: ${filas.length} filas`);
        manifest.tablas[tabla] = { esperadas, respaldadas: filas.length, estado: 'ok' };
    }
}

manifest.totalFilas = total;
manifest.problemas = problemas;
writeFileSync(`${dir}/_manifest.json`, JSON.stringify(manifest, null, 2));

console.log(`\nBackup: ${dir}`);
console.log(`Total: ${total} filas en ${conFilas.length} tablas con datos`);

// --------------------------------------------------------------------------
// 3. Veredicto. Cualquier descuadre invalida el backup COMPLETO.
// --------------------------------------------------------------------------
if (problemas.length) {
    console.error(`\n✗ BACKUP INVALIDO — ${problemas.length} problema(s):`);
    for (const p of problemas) console.error(`    - ${p}`);
    console.error(`\n  NO restaurar desde ${dir}.`);
    console.error('  Causa tipica: login sin permisos (RLS devuelve vacio) o proyecto pausado.\n');
    process.exit(1);
}

// Evidencia para .claude/hooks/mcp-write-gate.sh, que bloquea DELETE/UPDATE de
// documentos APQP sin backup reciente. Se escribe SOLO aca, o sea unicamente
// despues de que pasaron TODAS las aserciones por tabla: el flag significa
// "hay un backup restaurable", no "el script corrio".
try {
    const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
    writeFileSync(`${tmp}/claude-backup-ok.flag`, `${Math.floor(Date.now() / 1000)}\n${dir}\n`);
} catch {
    console.log('  (aviso: no se pudo escribir la evidencia para el gate de escrituras)');
}

console.log(`✓ Backup valido: ${conFilas.length}/${conFilas.length} tablas con datos, conteos coinciden`);
process.exit(0);

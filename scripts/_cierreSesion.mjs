/**
 * _cierreSesion.mjs — el protocolo de fin de sesion, MEDIDO en vez de recordado.
 *
 * CLAUDE.md exige 5 pasos al cerrar (LECCIONES, backup si hubo datos, auditor,
 * build+commit+push, Escritorio archivado). Hasta hoy los recordaba un hook con
 * cooldown (session-close-guard.sh) y no los chequeaba nadie. Este script mide lo
 * medible y reporta el checklist; lo que es juicio humano (que leccion anotar, si
 * una tarea esta terminada) queda listado como paso manual, no se automatiza.
 *
 * DELIBERADAMENTE NO ejecuta nada irreversible: no commitea, no pushea, no archiva
 * y no borra flags. Commit y push los hace Claude por nombre de archivo (regla
 * git-deploy.md); archivar una tarea es decision de cierre (escritorio-tareas.md).
 * Lo unico que corre es `npm run build`, que es local y reversible — con tope de
 * 10 minutos adentro, porque el que espera sin tope no sabe si se colgo.
 *
 *   node scripts/_cierreSesion.mjs              # checklist completo (corre npm run build)
 *   node scripts/_cierreSesion.mjs --sin-build  # sin build (rapido; el build queda como aviso)
 *
 * Sale con 0 si no falta nada bloqueante, 1 si hay pasos pendientes.
 *
 * Evidencia que lee (nunca escribe):
 *   %TEMP%/claude-supabase-write.flag           la sesion escribio Supabase (supabase-write-flag.sh)
 *   %TEMP%/claude-supabase-write.flag.avisado   idem, ya avisado por session-close-guard.sh
 *   %TEMP%/claude-backup-ok.flag                ultimo backup VALIDO (lo escribe solo _backup.mjs
 *                                               despues de pasar todas las aserciones por tabla)
 *   backups/<ts>/_manifest.json                 fallback si el flag de backup no esta
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import {
    listar, clasificarEntrada, fechasDeTarea, diasDesde, leerIndice,
    verificarInvariantes, CARPETA_EN_ESPERA, ESCRITORIO_DEFAULT, ARCHIVO_DEFAULT,
} from './_escritorio.mjs';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..');

// Umbrales del gate de LECCIONES (los mismos de session-close-guard.sh y
// session-start-context.sh — si se cambian alla, cambiarlos aca).
export const LECCIONES_AVISO = 26624;
export const LECCIONES_TOPE = 28672;

const c = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', b: '\x1b[34m', d: '\x1b[2m', x: '\x1b[0m' };
const say = (s = '') => console.log(s);

// ─────────────────────────────────────────────────────────────────────────────
// Funciones puras (las ejerce __tests__/scripts/cierreSesion.test.mjs)
// ─────────────────────────────────────────────────────────────────────────────

/** La carpeta temporal donde los hooks bash y los scripts node dejan sus flags.
 *  En esta PC /tmp de Git Bash y process.env.TEMP son la MISMA carpeta (verificado
 *  con cygpath 2026-08-30) — por eso un flag escrito por un hook se lee desde node. */
export function carpetaTemporal(env = process.env) {
    return env.TMPDIR || env.TEMP || env.TMP || '/tmp';
}

/** Epoch (segundos) de la primera linea de un flag, o null si no es un numero. */
export function leerEpochFlag(texto) {
    const n = Number(String(texto ?? '').trim().split(/\r?\n/)[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Separa la salida de `git status --porcelain` en cambios versionados (tracked,
 * van a commit por nombre) y sin versionar (??, a decidir: commit o su lugar).
 * Excluye lo mismo que session-close-guard.sh: scratchpad, deps, build, lock.
 */
export function clasificarPorcelain(salida) {
    const versionados = [];
    const sinVersionar = [];
    for (const linea of String(salida ?? '').split(/\r?\n/)) {
        if (!linea.trim()) continue;
        const ruta = linea.slice(3).trim();
        if (/scratchpad|node_modules|\/dist\/|^dist\/|package-lock/i.test(ruta)) continue;
        if (linea.startsWith('??')) sinVersionar.push(ruta);
        else versionados.push(ruta);
    }
    return { versionados, sinVersionar };
}

/**
 * Estado del paso git: arbol limpio y push al dia (regla git-deploy).
 * En una rama sin upstream (worktree) el push se mide contra origin/main:
 * `sinLlegarAMain` = commits propios que main todavia no tiene (null = no se
 * pudo comparar). Un commit que no llego a main BLOQUEA igual que un push
 * pendiente — Fak prueba en produccion, y produccion sale de main (hallazgo
 * del auditor 2026-08-30: el aviso generico dejaba pasar exactamente eso).
 */
export function evaluarGit({ versionados, sinVersionar, sinPush, sinUpstream, sinLlegarAMain, rama }) {
    if (versionados.length) {
        return {
            estado: 'falta',
            detalle: `${versionados.length} archivo(s) modificados sin commitear:\n`
                + versionados.slice(0, 12).map((f) => `      ${f}`).join('\n')
                + (versionados.length > 12 ? `\n      ${c.d}… y ${versionados.length - 12} mas${c.x}` : ''),
        };
    }
    if (sinUpstream) {
        if (sinLlegarAMain == null) {
            return { estado: 'aviso', detalle: `la rama "${rama}" no tiene upstream y no se pudo comparar contra origin/main` };
        }
        if (sinLlegarAMain > 0) {
            return { estado: 'falta', detalle: `${sinLlegarAMain} commit(s) en "${rama}" que origin/main todavia no tiene — pushear a main (git-deploy.md)` };
        }
    } else if (sinPush > 0) {
        return { estado: 'falta', detalle: `${sinPush} commit(s) sin pushear en "${rama}"` };
    }
    if (sinVersionar.length) {
        return {
            estado: 'aviso',
            detalle: `arbol limpio, pero hay ${sinVersionar.length} archivo(s) sin versionar (commitear por nombre o llevarlos a su lugar):\n`
                + sinVersionar.slice(0, 8).map((f) => `      ${f}`).join('\n'),
        };
    }
    return { estado: 'ok', detalle: `arbol limpio y push al dia en "${rama}"` };
}

/**
 * Estado del paso backup. `escritura` y `backup` son epochs en segundos (o null).
 * La regla es temporal, no de calendario: un backup solo cuenta si es POSTERIOR
 * a la ultima escritura — un backup de ayer no cubre lo que se escribio hoy, y
 * una escritura vieja sin backup posterior sigue pendiente aunque pasen dias.
 */
export function evaluarBackup({ escritura, backup }) {
    if (!escritura) return { estado: 'no-aplica', detalle: 'esta sesion no escribio en Supabase (sin flag de escritura)' };
    const cuando = new Date(escritura * 1000).toLocaleString('es-AR');
    if (!backup) return { estado: 'falta', detalle: `hubo escritura en Supabase (${cuando}) y no hay NINGUN backup valido registrado — node scripts/_backup.mjs` };
    if (backup < escritura) {
        return {
            estado: 'falta',
            detalle: `el ultimo backup valido (${new Date(backup * 1000).toLocaleString('es-AR')}) es ANTERIOR a la ultima escritura (${cuando}) — node scripts/_backup.mjs`,
        };
    }
    return { estado: 'ok', detalle: `escritura cubierta por backup valido del ${new Date(backup * 1000).toLocaleString('es-AR')}` };
}

/** Estado del gate de tamaño de LECCIONES_APRENDIDAS (regla lecciones-consolidacion). */
export function evaluarLecciones(bytes) {
    if (bytes == null) return { estado: 'aviso', detalle: 'no se pudo leer docs/LECCIONES_APRENDIDAS.md' };
    const kb = (bytes / 1024).toFixed(1);
    if (bytes > LECCIONES_TOPE) return { estado: 'falta', detalle: `${kb} KB — PASO el tope duro de 28 KB: consolidar YA (fusionar patrones, graduar a regla/memoria, archivar)` };
    if (bytes > LECCIONES_AVISO) return { estado: 'falta', detalle: `${kb} KB — paso el aviso de 26 KB: pasada de CONSOLIDACION antes de cerrar (no pelear bytes)` };
    return { estado: 'ok', detalle: `${kb} KB, bajo el aviso de 26 KB` };
}

/** 1 si algun check quedo en 'falta'; 'aviso', 'manual' y 'no-aplica' no bloquean. */
export function veredicto(checks) {
    return checks.some((ch) => ch.estado === 'falta') ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relevadores (tocan git / filesystem / npm)
// ─────────────────────────────────────────────────────────────────────────────

function git(args) {
    // stderr en pipe: un "fatal: no upstream" es un estado esperado del checklist
    // (rama de worktree sin publicar), no ruido para la consola.
    return execSync(`git ${args}`, {
        cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}

function chequearGit() {
    try {
        const rama = git('rev-parse --abbrev-ref HEAD');
        const { versionados, sinVersionar } = clasificarPorcelain(git('status --porcelain'));
        let sinPush = 0;
        let sinUpstream = false;
        let sinLlegarAMain = null;
        try { sinPush = Number(git('rev-list --count @{u}..HEAD')); } catch {
            sinUpstream = true;
            // Rama de worktree sin publicar: el destino real es main (git-deploy.md).
            try { sinLlegarAMain = Number(git('rev-list --count origin/main..HEAD')); } catch { /* sin origin/main local */ }
        }
        return evaluarGit({ versionados, sinVersionar, sinPush, sinUpstream, sinLlegarAMain, rama });
    } catch (e) {
        return { estado: 'aviso', detalle: `no se pudo leer git: ${e.message.split('\n')[0]}` };
    }
}

function chequearBuild(saltear) {
    if (saltear) return { estado: 'aviso', detalle: 'salteado con --sin-build — correr npm run build antes del commit (git-deploy.md)' };
    const t0 = Date.now();
    try {
        execSync('npm run build', {
            cwd: REPO, encoding: 'utf8', windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 10 * 60 * 1000,        // tope adentro: esperar sin tope no es supervisar
        });
        return { estado: 'ok', detalle: `npm run build OK en ${Math.round((Date.now() - t0) / 1000)} s` };
    } catch (e) {
        const cola = [e.stdout, e.stderr].filter(Boolean).join('\n')
            .split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-12)
            .map((l) => `      ${l}`).join('\n');
        const motivo = e.killed ? 'se corto por TIMEOUT a los 10 min' : 'FALLO';
        return { estado: 'falta', detalle: `npm run build ${motivo}:\n${cola}` };
    }
}

/** Ultima escritura Supabase conocida: el flag vivo o el ya-avisado, el mas nuevo. */
function ultimaEscrituraSupabase(tmp) {
    const epochs = ['claude-supabase-write.flag', 'claude-supabase-write.flag.avisado']
        .map((f) => path.join(tmp, f))
        .filter((p) => fs.existsSync(p))
        .map((p) => leerEpochFlag(fs.readFileSync(p, 'utf8')))
        .filter((n) => n != null);
    return epochs.length ? Math.max(...epochs) : null;
}

/**
 * Ultimo backup VALIDO: primero el flag (solo lo escribe _backup.mjs tras pasar
 * todas las aserciones), si no esta se cae al _manifest.json mas nuevo sin
 * problemas. Un manifest con problemas NO cuenta: ese backup no es restaurable.
 */
function ultimoBackupValido(tmp) {
    const flag = path.join(tmp, 'claude-backup-ok.flag');
    if (fs.existsSync(flag)) {
        const epoch = leerEpochFlag(fs.readFileSync(flag, 'utf8'));
        if (epoch != null) return epoch;
    }
    const dirBackups = path.join(REPO, 'backups');
    if (!fs.existsSync(dirBackups)) return null;
    const carpetas = fs.readdirSync(dirBackups, { withFileTypes: true })
        .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse();
    for (const carpeta of carpetas) {
        try {
            const manifest = JSON.parse(fs.readFileSync(path.join(dirBackups, carpeta, '_manifest.json'), 'utf8'));
            if (Array.isArray(manifest.problemas) && manifest.problemas.length === 0 && manifest.generado) {
                return Math.floor(new Date(manifest.generado).getTime() / 1000);
            }
        } catch { /* carpeta sin manifest o ilegible: seguir buscando */ }
    }
    return null;
}

function chequearLecciones() {
    try {
        return evaluarLecciones(fs.statSync(path.join(REPO, 'docs', 'LECCIONES_APRENDIDAS.md')).size);
    } catch {
        return evaluarLecciones(null);
    }
}

/**
 * El Escritorio: cuantas tareas siguen abiertas, cuales llevan 7+ dias (candidatas
 * a estar cerradas sin archivar — decide Fak, por eso es aviso y no falta), y si
 * el archivo de cerradas mantiene sus invariantes (eso SI bloquea: un indice roto
 * es un problema mio, no una decision pendiente).
 */
async function chequearEscritorio() {
    if (!fs.existsSync(ESCRITORIO_DEFAULT)) {
        return { estado: 'aviso', detalle: `el Escritorio no es accesible desde aca (${ESCRITORIO_DEFAULT})` };
    }
    try {
        const entradas = listar(ESCRITORIO_DEFAULT);
        const esTarea = (e) => clasificarEntrada(e.nombre, e.dir) === 'tarea';
        const vista = entradas.filter(esTarea);
        const bandeja = entradas.find((e) => clasificarEntrada(e.nombre, e.dir) === 'espera');
        const enEspera = bandeja ? listar(bandeja.ruta).filter(esTarea) : [];
        const todas = [...vista, ...enEspera].map((t) => ({ ...t, fecha: fechasDeTarea(t) }));
        const viejas = todas.filter((t) => t.fecha.ms && diasDesde(t.fecha.ms) >= 7);

        const problemas = [];
        if (fs.existsSync(ARCHIVO_DEFAULT)) {
            const anios = listar(ARCHIVO_DEFAULT).filter((e) => e.dir && /^\d{4}$/.test(e.nombre)).map((e) => e.nombre);
            for (const anio of anios) {
                const filas = await leerIndice(ARCHIVO_DEFAULT, anio);
                const archivadas = listar(path.join(ARCHIVO_DEFAULT, anio)).filter((e) => e.dir).map((e) => e.nombre);
                problemas.push(...verificarInvariantes(filas, { archivadas }).map((p) => `${anio}: ${p}`));
            }
        }
        if (problemas.length) {
            return {
                estado: 'falta',
                detalle: `el archivo de cerradas rompe ${problemas.length} invariante(s):\n`
                    + problemas.slice(0, 6).map((p) => `      ${p}`).join('\n'),
            };
        }

        const resumen = `${vista.length} a la vista + ${enEspera.length} en ${CARPETA_EN_ESPERA} = ${todas.length} abiertas`;
        if (viejas.length) {
            return {
                estado: 'aviso',
                detalle: `${resumen}; ${viejas.length} llevan 7+ dias (¿cerradas sin archivar, o trabadas?):\n`
                    + viejas.sort((a, b) => a.fecha.ms - b.fecha.ms).slice(0, 8)
                        .map((t) => `      ${String(diasDesde(t.fecha.ms)).padStart(3)}d  ${t.nombre}`).join('\n')
                    + `\n      ${c.d}(si alguna se cerro esta sesion: node scripts/_escritorio.mjs --archivar)${c.x}`,
            };
        }
        return { estado: 'ok', detalle: `${resumen}, ninguna con 7+ dias; archivo de cerradas integro` };
    } catch (e) {
        return { estado: 'aviso', detalle: `no se pudo relevar el Escritorio: ${e.message.split('\n')[0]}` };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const ICONO = {
    ok: `${c.g}✓${c.x}`, falta: `${c.r}✗${c.x}`, aviso: `${c.y}⚠${c.x}`,
    'no-aplica': `${c.d}○${c.x}`, manual: `${c.b}▸${c.x}`,
};

function imprimir(checks) {
    say(`\n${c.b}CIERRE DE SESION${c.x}  ${c.d}protocolo CLAUDE.md — medido, no recordado${c.x}\n`);
    for (const ch of checks) say(`  ${ICONO[ch.estado]}  ${ch.paso}${c.x}\n     ${ch.detalle}\n`);
}

async function main(argv) {
    const sinBuild = argv.includes('--sin-build');
    const tmp = carpetaTemporal();

    const checks = [
        { paso: 'LECCIONES_APRENDIDAS bajo el gate de consolidacion', ...chequearLecciones() },
        { paso: 'Backup Supabase posterior a la ultima escritura', ...evaluarBackup({ escritura: ultimaEscrituraSupabase(tmp), backup: ultimoBackupValido(tmp) }) },
        { paso: 'Build de produccion', ...chequearBuild(sinBuild) },
        { paso: 'Git: commit + push (regla git-deploy)', ...chequearGit() },
        { paso: 'Escritorio: cola de tareas y archivo de cerradas', ...(await chequearEscritorio()) },
        // Lo que ningun script puede medir — se lista para que no se olvide, no bloquea:
        { paso: 'Auditor al cerrar tareas de codigo', estado: 'manual', detalle: 'lanzar el agente `auditor` si esta sesion toco codigo' },
        { paso: 'Lecciones y memorias de la sesion', estado: 'manual', detalle: 'si Fak corrigio, decidio o revelo algo: LECCIONES_APRENDIDAS + memoria con fuente' },
        { paso: 'Entregables de tareas Barack', estado: 'manual', detalle: 'cada entregable en su carpeta por tipo de la biblioteca — en el Escritorio no queda nada mio' },
    ];

    imprimir(checks);
    const codigo = veredicto(checks);
    const faltan = checks.filter((ch) => ch.estado === 'falta').length;
    if (codigo === 0) say(`${c.g}Listo para cerrar${c.x} ${c.d}(los ▸ se resuelven a criterio, este script no los mide)${c.x}\n`);
    else say(`${c.r}NO cerrar todavia:${c.x} faltan ${faltan} paso(s) medibles.\n`);
    return codigo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    main(process.argv.slice(2)).then((n) => process.exit(n));
}

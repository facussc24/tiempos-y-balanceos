/**
 * _nube.mjs — sincroniza el CEREBRO (memorias + config de Claude + secretos del repo)
 * contra OneDrive, para que otra PC arranque sabiendo todo lo que sabe esta.
 *
 * QUE VA Y QUE NO — y por que (decidido el 2026-09-03)
 *
 *  - El CODIGO no viaja por aca: ya esta en GitHub (facussc24/tiempos-y-balanceos) y la
 *    otra PC lo baja con `git clone`. Meter el repo en OneDrive seria duplicar 240 MB de
 *    .git y ademas arriesgarlo: OneDrive sincroniza archivos mientras git los escribe y
 *    corrompe el historial. El unico caso donde harian falta commits que no estan en
 *    GitHub es si quedaron sin pushear — este script lo chequea y avisa.
 *
 *  - Los TRANSCRIPTS de sesion (~/.claude/projects/ *.jsonl, 1,6 GB) tampoco: son el
 *    diario de cada charla, no el conocimiento. Lo destilado ya vive en memory/ y en
 *    docs/LECCIONES_APRENDIDAS.md.
 *
 *  - .venv-cad tampoco: un venv copiado entre PCs no arranca (las rutas quedan escritas
 *    adentro de los scripts del entorno). Se rehace con pip.
 *
 *  - SI van .sgc-cache y .arb-cache: son regenerables, pero regenerarlos exige el
 *    servidor Y: y el ERP a mano. Sin ellos la otra PC arranca ciega.
 *
 *  - SI va .mail-cache (agregado el 2026-09-03): el buzon volcado a JSONL. Se regenera
 *    con `--sync`, pero solo mientras Outlook clasico tenga el .ost al dia — un mail
 *    borrado o una cuenta dada de baja ya no vuelven. Ademas es la unica copia que hay
 *    fuera de Exchange, y esa tarde OneDrive estuvo 14 h sin subir nada sin avisar.
 *
 * SEGURIDAD
 *  - Por defecto TODO es dry-run. Sin `--aplicar` no se copia ni se borra un solo byte.
 *  - `--subir` usa espejo (/MIR): borra en la nube lo que ya no existe local. Esta PC es
 *    la fuente de verdad.
 *  - `--bajar` NUNCA borra en local (/E, no /MIR). Si en la otra PC hay una memoria nueva
 *    que la nube no tiene, bajar no se la come.
 *
 * USO
 *    node scripts/_nube.mjs                  estado: que difiere y cuando fue el ultimo sync
 *    node scripts/_nube.mjs --subir          dry-run de la subida (no toca nada)
 *    node scripts/_nube.mjs --subir --aplicar
 *    node scripts/_nube.mjs --bajar          dry-run de la bajada
 *    node scripts/_nube.mjs --bajar --aplicar
 *    node scripts/_nube.mjs --liberar        deja la copia SOLO en la nube (0 bytes en disco)
 *
 * DOS PC DE FAK (08/10/2026: la de Ingenieria y la notebook de Calidad, CATA)
 *    node scripts/_nube.mjs --sincronizar [--aplicar]
 *        Las dos direcciones a la vez, sin espejo: gana el archivo mas nuevo, nada se borra, y lo
 *        local que se va a pisar y esta PC edito despues de su ultimo sync se guarda antes en
 *        <nube>\_conflictos\<PC>\<fecha>\. Solo memoria, reglas, skills, agentes, comandos, hooks,
 *        planes y las claves: los caches (.sgc-cache, .arb-cache, .mail-cache) y settings.json
 *        quedan para --subir/--bajar a mano (el buzon lo escriben las dos PC y los settings traen
 *        rutas de la PC de origen). Si el repo esta limpio y atras de GitHub, lo trae (--ff-only).
 *        Logica pura y probada: scripts/_lib/nubeSincronizar.mjs.
 *    node scripts/_nube.mjs --registrar-tarea     tarea de Windows "Barack - mi asistente al dia":
 *        al iniciar sesion (5 min despues, para que OneDrive llegue) y cada 2 h; corre _nubeSync.ps1
 *    node scripts/_nube.mjs --desregistrar-tarea
 */
import { spawnSync, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { construirFlags } from './_lib/nubeFlags.mjs';
import { buscarNube, buscarNubeVieja } from './_lib/nubeRutas.mjs';
import {
    recorrer, planDeIntercambio, resguardarConflictos, estadoConSync, ultimoSyncDe, lineaPlan, selloFecha,
} from './_lib/nubeSincronizar.mjs';
import { psRun } from './_lib/powershell.mjs';

const HOME = homedir();
// El repo es el padre de scripts/, no una ruta fija: si se clona en otra carpeta, el
// script escribe .env.local y los caches DONDE ESTA, no en C:\Dev\BarackMercosul.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLAUDE = join(HOME, '.claude');

// La carpeta de OneDrive corporativo lleva el nombre del tenant y el usuario de Windows
// cambia segun la PC: se busca, no se hardcodea (`_lib/nubeRutas.mjs`, que ademas la
// encuentra cuando es un reparse point). Si no aparece ninguna, se cae a la canonica
// para que los mensajes de error muestren una ruta concreta.
const NUBE_INGENIERIA = buscarNube(HOME);
const NUBE_VIEJA = buscarNubeVieja(HOME);
// TRANSICION (01/10/2026, regla nube-ingenieria.md). La copia pasa de la OneDrive personal de Fak a
// `Claude Fak` en la nube de Ingenieria. Mientras esa carpeta este vacia y la vieja siga existiendo,
// se LEE de la vieja (leer de ahi no rompe la regla). SUBIR va siempre a Ingenieria.
const EN_TRANSICION = !process.argv.includes('--subir') && !process.argv.includes('--sincronizar')
    && !existsSync(join(NUBE_INGENIERIA, 'claude-memoria')) && existsSync(join(NUBE_VIEJA, 'claude-memoria'));
const NUBE = EN_TRANSICION ? NUBE_VIEJA : NUBE_INGENIERIA;

// Cada pieza: [clave, carpeta local, subcarpeta en la nube, que es]
const PIEZAS = [
    ['memoria', join(CLAUDE, 'projects', 'C--Dev-BarackMercosul', 'memory'), 'claude-memoria', 'lo que Claude aprendio de Fak'],
    ['reglas', join(CLAUDE, 'rules'), 'claude-config\\rules', 'reglas globales de Claude Code'],
    ['skills', join(CLAUDE, 'skills'), 'claude-config\\skills', 'skills globales'],
    ['agentes', join(CLAUDE, 'agents'), 'claude-config\\agents', 'definiciones de subagentes'],
    ['comandos', join(CLAUDE, 'commands'), 'claude-config\\commands', 'slash commands propios'],
    ['hooks', join(CLAUDE, 'hooks'), 'claude-config\\hooks', 'los guards que me frenan'],
    ['planes', join(CLAUDE, 'plans'), 'claude-config\\plans', 'planes guardados'],
    ['sgc-cache', join(REPO, '.sgc-cache'), 'repo-privado\\.sgc-cache', 'extractos de documentos del SGC'],
    ['arb-cache', join(REPO, '.arb-cache'), 'repo-privado\\.arb-cache', 'fotos de exports del ERP arb'],
    ['mail-cache', join(REPO, '.mail-cache'), 'repo-privado\\.mail-cache', 'el buzon volcado a JSONL (5.300+ mails)'],
];

// Archivos sueltos: [carpeta de origen, nombre, subcarpeta nube, que es]
const SUELTOS = [
    [CLAUDE, 'settings.json', 'claude-config', 'settings globales de Claude Code'],
    [REPO, '.env.local', 'repo-privado', 'credenciales Supabase (NO van a git)'],
    [REPO, '.env.example', 'repo-privado', 'plantilla de variables'],
    [REPO, '.qr-secret', 'repo-privado', 'clave de firma de los QR de documentos'],
];

const args = process.argv.slice(2);
const subir = args.includes('--subir');
const bajar = args.includes('--bajar');
const aplicar = args.includes('--aplicar');
const liberar = args.includes('--liberar');
const sincronizar = args.includes('--sincronizar');
const registrarTarea = args.includes('--registrar-tarea');
const desregistrarTarea = args.includes('--desregistrar-tarea');

if (subir && bajar) {
    console.error('\n[X] --subir y --bajar juntos no. Una direccion por vez.\n');
    process.exit(1);
}
if (sincronizar && (subir || bajar || liberar)) {
    console.error('\n[X] --sincronizar va solo (ya son las dos direcciones).\n');
    process.exit(1);
}

// El permiso "solo para Fak" sobre la carpeta NO es condicion para subir: lo decidio el el 01/10/2026,
// sabiendo que adentro van claves, su buzon y las memorias y que la carpeta la abre todo Ingenieria
// ("si no importa eso, ya fue la privacidad"). Hasta ese mensaje este script se negaba a subir sin una
// marca de permiso verificado. No volver a proponerlo (igual que el cifrado, 03/09 y 05/09).

/** Corre robocopy. `listar` = /L: enumera lo que HARIA, sin tocar nada. */
function robocopy(origen, destino, { direccion, listar, soloArchivo }) {
    const flags = construirFlags({ origen, destino, direccion, soloArchivo, listar });
    const r = spawnSync('robocopy', flags, { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
    const salida = (r.stdout || '') + (r.stderr || '');
    // Robocopy: 0-7 son estados normales (0 = nada que hacer), >=8 es error real.
    const err = (r.status ?? 16) >= 8 ? salida.trim().split('\n').slice(-3).join(' ').trim() : null;
    // La linea de resumen es "  Archivos:  <total> <copiado> <omitido> ..." (o "Files:" en ingles).
    const m = salida.match(/(?:Archivos|Files)\s*:\s*(\d+)\s+(\d+)/);
    return { archivos: m ? parseInt(m[2], 10) : 0, err };
}

const humano = (n) => (n === 0 ? '--' : `${n} archivo${n === 1 ? '' : 's'}`);

/** Si hay commits sin pushear, la nube NO alcanza: la otra PC clona de GitHub. */
function estadoRepo() {
    try {
        const sinPushear = execSync('git rev-list --count origin/main..main', {
            cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        return { sinPushear: parseInt(sinPushear, 10) };
    } catch {
        return { sinPushear: -1 };
    }
}

console.log('\n' + '='.repeat(74));
console.log('  CEREBRO BARACK  <->  OneDrive');
console.log('='.repeat(74));
console.log(`  local : ${CLAUDE}`);
console.log(`          ${REPO}`);
console.log(`  nube  : ${NUBE}`);
if (EN_TRANSICION) {
    console.log('          (lugar VIEJO, solo para leer: la carpeta nueva de Ingenieria todavia esta vacia)');
    console.log(`  nueva : ${NUBE_INGENIERIA}`);
}

const est = estadoRepo();
if (est.sinPushear > 0) {
    console.log(`\n  [!] El repo tiene ${est.sinPushear} commit(s) SIN PUSHEAR a GitHub.`);
    console.log('      La otra PC clona de GitHub, asi que eso NO le llega. Pushear primero.');
} else if (est.sinPushear === 0) {
    console.log('\n  [OK] Repo al dia con GitHub — la otra PC lo baja con git clone.');
}

// ── --liberar: dejar la copia solo en la nube ───────────────────────────────────
// OneDrive "Archivos a pedido": el archivo queda como puntero de 0 bytes en disco y se
// baja solo cuando algo lo abre. Reversible con `attrib -U +P /s`. Robocopy compara por
// fecha y tamano (metadata, que sigue estando), asi que un --subir posterior no rehidrata
// los 288 MB: solo baja lo que de verdad tenga que copiar.
if (liberar) {
    if (!existsSync(NUBE)) {
        console.error('\n[X] La carpeta en la nube no existe todavia. Correr --subir --aplicar primero.\n');
        process.exit(1);
    }
    console.log('\n  Marcando la copia como "solo en la nube"...\n');
    const r = spawnSync('attrib', ['+U', '-P', join(NUBE, '*'), '/s'], {
        encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
    });
    if ((r.status ?? 1) !== 0) {
        console.error(`  [X] attrib fallo: ${(r.stderr || r.stdout || '').trim().slice(0, 300)}\n`);
        process.exit(1);
    }
    console.log('  [OK] Hecho. Los archivos siguen ahi y se abren igual: Windows los baja solo.');
    console.log('       Lo que OneDrive todavia no termino de subir se libera cuando termine.');
    console.log('       Para volver a tenerlos en disco: attrib -U +P "<carpeta>\\*" /s\n');
    process.exit(0);
}

// ── --registrar-tarea / --desregistrar-tarea: "Barack - mi asistente al dia" ────
// Igual que las otras tareas del repo (_nocturno, _arbVigilante): conhost --headless + powershell
// -File, al iniciar sesion y repetida, sin administrador. El .ps1 deja el log en .claude/state/.
const NOMBRE_TAREA = 'Barack - mi asistente al dia';
if (registrarTarea || desregistrarTarea) {
    const ps1 = join(REPO, 'scripts', '_nubeSync.ps1');
    const comillas = (s) => String(s).replace(/'/g, "''");
    try {
        if (desregistrarTarea) {
            psRun(`Unregister-ScheduledTask -TaskName '${NOMBRE_TAREA}' -Confirm:$false -ErrorAction SilentlyContinue\n'OK'`, { timeout: 60000 });
            console.log(`\n  [OK] Tarea "${NOMBRE_TAREA}" sacada de esta PC.\n`);
            process.exit(0);
        }
        if (!existsSync(ps1)) { console.error(`\n[X] No existe ${ps1}\n`); process.exit(1); }
        const script = [
            "$ErrorActionPreference = 'Stop'",
            `$nombre = '${comillas(NOMBRE_TAREA)}'`,
            `$ps1 = '${comillas(ps1)}'`,
            `$repo = '${comillas(REPO)}'`,
            "$accion = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\\conhost.exe') -Argument ('--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"' + $ps1 + '\"') -WorkingDirectory $repo",
            '$alEntrar = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME',
            "$alEntrar.Delay = 'PT5M'",
            '$cada2h = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(10) -RepetitionInterval (New-TimeSpan -Hours 2)',
            '$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -Priority 6',
            '$quien = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited',
            'Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger @($alEntrar, $cada2h) -Settings $ajustes -Principal $quien -Force | Out-Null',
            "'OK'",
        ].join('\n');
        const out = psRun(script, { timeout: 60000 });
        if (!/OK/.test(out)) { console.error(`\n[X] PowerShell no confirmo: ${out.trim().slice(0, 300)}\n`); process.exit(1); }
        console.log(`\n  [OK] Tarea "${NOMBRE_TAREA}" registrada: al iniciar sesion (5 min despues) y cada 2 h.`);
        console.log(`       Corre: node scripts/_nube.mjs --sincronizar --aplicar   (log en .claude\\state\\nube-sync.log)`);
        console.log(`       Para probarla ya: schtasks /run /tn "${NOMBRE_TAREA}"\n`);
        process.exit(0);
    } catch (e) {
        console.error(`\n[X] No pude ${desregistrarTarea ? 'sacar' : 'registrar'} la tarea: ${String(e.message || e).slice(0, 400)}\n`);
        process.exit(1);
    }
}

// ── Sin flags: solo informar ────────────────────────────────────────────────────
if (!subir && !bajar && !sincronizar) {
    const estadoPath = join(NUBE, '_ESTADO.json');
    if (existsSync(estadoPath)) {
        const e = JSON.parse(readFileSync(estadoPath, 'utf8'));
        console.log(`\n  Ultimo sync : ${e.fecha}  (desde ${e.pc}, repo en ${e.commitRepo})`);
    } else {
        console.log('\n  Ultimo sync : nunca — la carpeta en la nube todavia no existe.');
    }
    console.log('\n  Pendiente de subir ahora mismo (dry-run, no toco nada):\n');
    let total = 0;
    for (const [clave, local, sub] of PIEZAS) {
        if (!existsSync(local)) { console.log(`    ${clave.padEnd(11)} (no existe local)`); continue; }
        const r = robocopy(local, join(NUBE, sub), { direccion: 'subir', listar: true });
        total += r.archivos;
        console.log(`    ${clave.padEnd(11)} ${humano(r.archivos)}${r.err ? '  [X] ' + r.err : ''}`);
    }
    console.log(`\n  Total: ${humano(total)}`);
    console.log('\n  Para subir : node scripts/_nube.mjs --subir --aplicar');
    console.log('  Para bajar : node scripts/_nube.mjs --bajar --aplicar\n');
    process.exit(0);
}

// Bajar de una carpeta que no existe salteaba las 13 piezas y terminaba diciendo
// "se bajarian --", que se lee igual que "no habia nada que traer". Una lista vacia
// nunca puede significar "no pude leer" (misma leccion que _backup.mjs).
if ((bajar || sincronizar) && !existsSync(NUBE)) {
    console.error(`\n[X] NO EXISTE en esta PC la carpeta de la nube de Ingenieria con la memoria de Claude:\n    ${NUBE}\n`);
    console.error('    Sin eso no hay nada que bajar. Suele ser una de tres:');
    console.error('      1. Esta PC no tiene sincronizada la biblioteca de Ingenieria con la cuenta de Fak');
    console.error('         (la carpeta "Claude Fak" tiene permiso solo para el): abrir el sitio "Ingenieria y');
    console.error('         Proyecto" en Teams o SharePoint, entrar a Documentos y apretar "Sincronizar".');
    console.error('      2. OneDrive todavia no termino de sincronizar la carpeta.');
    console.error('      3. Nunca se subio: correr "--subir --aplicar" en la PC que tiene la memoria.');
    console.error('\n    NO seguir trabajando como si estuviera todo: sin memorias ni .env.local');
    console.error('    la sesion no puede leer Supabase ni sabe como trabaja Fak.\n');
    process.exit(1);
}

// ── --sincronizar: las dos PC de Fak sobre la misma copia ───────────────────────
// Gana el mas nuevo por archivo (robocopy /E /XO en las dos piernas), nada se borra, y lo que esta
// PC edito despues de su ultimo sync y la nube trae mas nuevo se resguarda antes de pisarlo.
if (sincronizar) {
    const PC = process.env.COMPUTERNAME || 'desconocida';
    const SINCRONIZABLES = new Set(['memoria', 'reglas', 'skills', 'agentes', 'comandos', 'hooks', 'planes']);
    const estadoPath = join(NUBE, '_ESTADO.json');
    let estado = null;
    try { estado = JSON.parse(readFileSync(estadoPath, 'utf8')); } catch { estado = null; }
    const ultimo = ultimoSyncDe(estado, PC);
    const sello = selloFecha();

    console.log('\n  Modo: SINCRONIZAR  (nube <-> esta PC: gana el mas nuevo, nada se borra)');
    console.log(`  ${aplicar ? '>> APLICANDO DE VERDAD' : '>> DRY-RUN — no se copia nada'}`);
    console.log(`  Ultimo sync de esta PC (${PC}): ${ultimo ? new Date(ultimo).toLocaleString('es-AR', { hour12: false }) : 'nunca — todo lo que se pise se resguarda'}\n`);

    let total = 0; let conflictosGuardados = 0; let fallosSync = 0; const avisos = [];
    for (const [clave, local, sub] of PIEZAS) {
        if (!SINCRONIZABLES.has(clave)) continue;
        const enNube = join(NUBE, sub);
        const plan = planDeIntercambio({ local: recorrer(local), nube: recorrer(enNube), ultimoSync: ultimo });
        console.log(lineaPlan(clave, plan));
        if (!plan.bajan.length && !plan.suben.length) continue;
        if (aplicar) {
            if (plan.conflictos.length) {
                const r = resguardarConflictos({ localDir: local, nubeRaiz: NUBE, pieza: clave, conflictos: plan.conflictos, pc: PC, sello });
                conflictosGuardados += r.guardados.length;
                for (const f of r.fallos) avisos.push(`no pude resguardar ${clave}/${f}`);
                if (r.carpeta) console.log(`               resguardo en ${r.carpeta}`);
            }
            mkdirSync(local, { recursive: true });
            mkdirSync(enNube, { recursive: true });
        }
        for (const [origen, destino] of [[enNube, local], [local, enNube]]) {
            if (!existsSync(origen)) continue;
            const r = robocopy(origen, destino, { direccion: 'intercambiar', listar: !aplicar });
            total += r.archivos;
            if (r.err) { fallosSync++; console.log(`               [X] ${r.err}`); }
        }
    }
    for (const [dir, nombre, sub] of SUELTOS) {
        if (nombre === 'settings.json') continue;   // trae rutas de la PC de origen: lo deja ajustar_settings.mjs al instalar
        const enNube = join(NUBE, sub);
        let n = 0;
        for (const [origen, destino] of [[enNube, dir], [dir, enNube]]) {
            if (!existsSync(join(origen, nombre))) continue;
            if (aplicar) mkdirSync(destino, { recursive: true });
            const r = robocopy(origen, destino, { direccion: 'intercambiar', listar: !aplicar, soloArchivo: nombre });
            n += r.archivos;
            if (r.err) { fallosSync++; console.log(`    ${nombre.padEnd(11)} [X] ${r.err}`); }
        }
        total += n;
        console.log(`    ${nombre.padEnd(11)} ${n ? `${n} archivo${n === 1 ? '' : 's'}` : 'al dia'}`);
    }

    // El codigo viaja por GitHub, no por la nube: si el repo esta limpio y atras, se trae; si tiene
    // commits sin pushear, se avisa (la otra PC no los ve). Sin red, se dice y se sigue.
    const git = estadoGitCompleto();
    if (!git) avisos.push('git: no pude consultar GitHub (sin red o sin origin); el codigo no se toco');
    else {
        if (git.adelante > 0) avisos.push(`git: ${git.adelante} commit(s) sin pushear — la otra PC no los ve hasta el push`);
        if (git.detras > 0 && !git.limpio) avisos.push(`git: hay ${git.detras} commit(s) nuevos en GitHub pero el arbol tiene cambios: no se trae nada`);
        if (git.detras > 0 && git.limpio) {
            if (aplicar) {
                try {
                    execSync('git pull --ff-only --quiet origin main', { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
                    console.log(`    repo        trajo ${git.detras} commit(s) de GitHub`);
                } catch (e) { avisos.push(`git pull fallo: ${String(e.message || e).split('\n')[0].slice(0, 200)}`); }
            } else console.log(`    repo        traeria ${git.detras} commit(s) de GitHub`);
        } else if (git.detras === 0) console.log('    repo        al dia con GitHub');
    }

    if (aplicar && fallosSync === 0) {
        const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return '?'; } })();
        mkdirSync(NUBE, { recursive: true });
        writeFileSync(estadoPath, JSON.stringify(estadoConSync(estado, { pc: PC, archivos: total, conflictos: conflictosGuardados, commitRepo: commit }), null, 2), 'utf8');
    }

    console.log('\n' + '-'.repeat(74));
    for (const a of avisos) console.log(`  [!] ${a}`);
    if (fallosSync) { console.log(`  [X] ${fallosSync} copia(s) fallaron. Revisar arriba.`); process.exit(1); }
    console.log(aplicar
        ? `  [OK] Sincronizado: ${humano(total)} movidos${conflictosGuardados ? `, ${conflictosGuardados} conflicto(s) resguardado(s)` : ''}.`
        : `  [DRY-RUN] Se moverian ${humano(total)}. Agregar --aplicar para hacerlo.`);
    console.log('-'.repeat(74) + '\n');
    process.exit(0);
}

/** Limpio / detras / adelante contra origin/main, con fetch. null si no se pudo consultar. */
function estadoGitCompleto() {
    const g = (cmd, timeout = 30000) => execSync(cmd, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout }).trim();
    try {
        const limpio = g('git status --porcelain') === '';
        g('git fetch --quiet origin main', 60000);
        const detras = parseInt(g('git rev-list --count main..origin/main'), 10);
        const adelante = parseInt(g('git rev-list --count origin/main..main'), 10);
        if (!Number.isFinite(detras) || !Number.isFinite(adelante)) return null;
        return { limpio, detras, adelante };
    } catch { return null; }
}

// ── Subida / bajada ─────────────────────────────────────────────────────────────
const listar = !aplicar;
console.log(`\n  Modo: ${subir ? 'SUBIR  (esta PC -> nube, espejo)' : 'BAJAR  (nube -> esta PC, sin borrar)'}`);
console.log(`  ${aplicar ? '>> APLICANDO DE VERDAD' : '>> DRY-RUN — no se copia ni se borra nada'}\n`);

if (subir && aplicar) mkdirSync(NUBE, { recursive: true });

let totalArch = 0;
let fallos = 0;

for (const [clave, local, sub, que] of PIEZAS) {
    const enNube = join(NUBE, sub);
    const [origen, destino] = subir ? [local, enNube] : [enNube, local];
    if (!existsSync(origen)) {
        console.log(`    ${clave.padEnd(11)} -- origen no existe, salteado`);
        continue;
    }
    const r = robocopy(origen, destino, { direccion: subir ? 'subir' : 'bajar', listar });
    totalArch += r.archivos;
    if (r.err) { fallos++; console.log(`    ${clave.padEnd(11)} [X] ${r.err}`); }
    else console.log(`    ${clave.padEnd(11)} ${humano(r.archivos).padEnd(16)} ${que}`);
}

for (const [dir, nombre, sub, que] of SUELTOS) {
    const enNube = join(NUBE, sub);
    const [origen, destino] = subir ? [dir, enNube] : [enNube, dir];
    if (!existsSync(join(origen, nombre))) {
        console.log(`    ${nombre.padEnd(11)} -- no existe en origen, salteado`);
        continue;
    }
    // Va la direccion REAL, no un 'false': que sea un archivo suelto ya evita el /MIR
    // adentro de construirFlags. Pasar espejo:false aca metia /XO tambien en la SUBIDA,
    // y entonces un .env.local editado no subia y el resumen lo mostraba igual que
    // "no habia nada que subir" (auditoria 03/09).
    const r = robocopy(origen, destino, { direccion: subir ? 'subir' : 'bajar', listar, soloArchivo: nombre });
    totalArch += r.archivos;
    if (r.err) { fallos++; console.log(`    ${nombre.padEnd(11)} [X] ${r.err}`); }
    else console.log(`    ${nombre.padEnd(11)} ${humano(r.archivos).padEnd(16)} ${que}`);
}

if (subir && aplicar && fallos === 0) {
    const commit = (() => {
        try { return execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8' }).trim(); }
        catch { return '?'; }
    })();
    writeFileSync(join(NUBE, '_ESTADO.json'), JSON.stringify({
        fecha: new Date().toISOString().slice(0, 16).replace('T', ' '),
        pc: process.env.COMPUTERNAME || 'desconocida',
        commitRepo: commit,
        archivosUltimoSync: totalArch,
    }, null, 2), 'utf8');
    writeFileSync(join(NUBE, 'LEEME.txt'), leeme(), 'utf8');
}

console.log('\n' + '-'.repeat(74));
if (fallos) {
    console.log(`  [X] ${fallos} pieza(s) fallaron. Revisar arriba.`);
    process.exit(1);
}
console.log(aplicar
    ? `  [OK] Listo. ${humano(totalArch)} ${subir ? 'subidos' : 'bajados'}.`
    : `  [DRY-RUN] Se ${subir ? 'subirian' : 'bajarian'} ${humano(totalArch)}. Agregar --aplicar para hacerlo.`);
console.log('-'.repeat(74) + '\n');

function leeme() {
    return [
        '========================================================================',
        '  MEMORIA Y CONFIGURACION DE CLAUDE (Fak) — NUBE DE INGENIERIA',
        '  Carpeta con permiso solo para Fak: tiene claves. No compartirla.',
        '  Lo actualiza solo scripts/_nube.mjs — no editar a mano.',
        '========================================================================',
        '',
        'Esto NO es el codigo. El codigo vive en GitHub:',
        '    https://github.com/facussc24/tiempos-y-balanceos',
        '',
        'Esto es todo lo demas: lo que Claude aprendio, la configuracion, y los',
        'archivos del repo que a proposito NO van a git (credenciales, caches).',
        '',
        '',
        '------------------------------------------------------------------------',
        '  PARA DEJAR OTRA PC ANDANDO — 3 pasos',
        '------------------------------------------------------------------------',
        '',
        '1) Instalar Node y Claude Code, y clonar el repo:',
        '',
        '       git clone https://github.com/facussc24/tiempos-y-balanceos.git C:\\Dev\\BarackMercosul',
        '       cd C:\\Dev\\BarackMercosul',
        '       npm install',
        '',
        '2) Con la cuenta de Fak, sincronizar la biblioteca de Ingenieria: en Teams o',
        '   SharePoint, sitio "Ingenieria y Proyecto" > Documentos > "Sincronizar".',
        '   Asi aparece esta misma carpeta ("Claude Fak") del otro lado.',
        '',
        '3) Traer la memoria y la configuracion (lo corre Claude solo al arrancar):',
        '',
        '       node scripts/_nube.mjs --bajar --aplicar',
        '',
        '   Ese comando deja las memorias, las reglas, los hooks, los skills y las',
        '   credenciales en su lugar. Listo.',
        '',
        '',
        '------------------------------------------------------------------------',
        '  DESPUES, PARA MANTENERLO AL DIA',
        '------------------------------------------------------------------------',
        '',
        '  En la PC donde trabajaste:      node scripts/_nube.mjs --subir --aplicar',
        '  En la otra, antes de arrancar:  node scripts/_nube.mjs --bajar --aplicar',
        '  Para ver como esta la cosa:     node scripts/_nube.mjs',
        '',
        'Solo viaja lo que cambio: si tocaste 3 memorias, copia 3 archivos, no todo.',
        'Sin --aplicar los tres comandos son dry-run y no tocan nada.',
        '',
        '',
        '------------------------------------------------------------------------',
        '  QUE HAY EN CADA CARPETA',
        '------------------------------------------------------------------------',
        '',
        '  claude-memoria/   Lo que Claude sabe de como trabajas. Lo mas valioso de',
        '                    todo esto: sin esta carpeta el Claude de la otra PC',
        '                    arranca de cero.',
        '  claude-config/    rules, skills, agents, commands, hooks, settings.json.',
        '                    Las reglas y los guards que evitan que repita errores.',
        '  repo-privado/     .env.local (Supabase), .qr-secret, y los caches',
        '                    .sgc-cache (documentos del SGC) y .arb-cache (ERP).',
        '                    Nada de esto puede ir a GitHub: el repo es publico.',
        '  _ESTADO.json      Cuando fue el ultimo sync, desde que PC, y en que commit',
        '                    estaba el repo en ese momento.',
        '',
        '',
        '------------------------------------------------------------------------',
        '  LO QUE NO ESTA ACA, A PROPOSITO',
        '------------------------------------------------------------------------',
        '',
        '  * El repo con su historial -> esta en GitHub, se clona. Meterlo tambien',
        '    aca seria duplicarlo, y OneDrive corrompe .git si sincroniza mientras',
        '    git escribe.',
        '  * Los transcripts de cada sesion (1,6 GB) -> es el diario de las charlas,',
        '    no el conocimiento. Lo que vale ya esta destilado en claude-memoria/ y',
        '    en docs/LECCIONES_APRENDIDAS.md (que si viaja en el repo).',
        '  * .venv-cad -> un entorno de Python copiado entre PCs no arranca. pip.',
        '  * Las contrasenas del servidor, del Wi-Fi y de los navegadores. Windows',
        '    las cifra contra la PC. Esas hay que tenerlas a mano aparte.',
        '',
    ].join('\n');
}

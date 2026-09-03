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
 */
import { spawnSync, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const HOME = homedir();
const REPO = 'C:\\Dev\\BarackMercosul';
const CLAUDE = join(HOME, '.claude');
const NUBE = join(HOME, 'OneDrive - BARACK ARGENTINA SRL', 'Barack-cerebro');

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

if (subir && bajar) {
    console.error('\n[X] --subir y --bajar juntos no. Una direccion por vez.\n');
    process.exit(1);
}

/** Corre robocopy. `listar` = /L: enumera lo que HARIA, sin tocar nada. */
function robocopy(origen, destino, { espejo, listar, soloArchivo }) {
    const flags = [origen, destino];
    // Un archivo suelto va SIN /E: con recursion, robocopy encuentra el mismo nombre en
    // subcarpetas (los worktrees de .claude tienen su propio .env.example) y copia de mas.
    if (soloArchivo) flags.push(soloArchivo);
    else flags.push(espejo ? '/MIR' : '/E');
    flags.push('/NFL', '/NDL', '/NJH', '/R:2', '/W:2', '/XD', 'node_modules', '__pycache__');
    if (listar) flags.push('/L');
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

// ── Sin flags: solo informar ────────────────────────────────────────────────────
if (!subir && !bajar) {
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
        const r = robocopy(local, join(NUBE, sub), { espejo: true, listar: true });
        total += r.archivos;
        console.log(`    ${clave.padEnd(11)} ${humano(r.archivos)}${r.err ? '  [X] ' + r.err : ''}`);
    }
    console.log(`\n  Total: ${humano(total)}`);
    console.log('\n  Para subir : node scripts/_nube.mjs --subir --aplicar');
    console.log('  Para bajar : node scripts/_nube.mjs --bajar --aplicar\n');
    process.exit(0);
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
    const r = robocopy(origen, destino, { espejo: subir, listar });
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
    // Archivo suelto: nunca espejo — /MIR aca borraria el resto de la carpeta destino.
    const r = robocopy(origen, destino, { espejo: false, listar, soloArchivo: nombre });
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
        '  CEREBRO BARACK EN LA NUBE',
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
        '2) Iniciar sesion en OneDrive con la cuenta de Barack, para que aparezca',
        '   esta misma carpeta del otro lado.',
        '',
        '3) Traer el cerebro:',
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

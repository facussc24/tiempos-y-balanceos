#!/usr/bin/env node
/**
 * _pendriveAsistente.mjs — arma en un pendrive "mi asistente completo" para otra PC de Fak (CATA, la notebook): el instalador,
 * la memoria, las skills, reglas, agentes, comandos, hooks, planes, el settings y las claves.
 *
 * Por que existe: desde el 20/10/2026 las skills y la configuracion viven SOLO en las PC de Fak, no en la nube
 * (Fak: *"lo que no quiero es que tengan mis skills... quiero tenerlas en local"*, *"no me molesta tener que pasarle
 * a CATA cada tanto por el pendrive"*; `scripts/_lib/soloLocal.mjs`). Este es el camino para llevarlas.
 *
 *   node scripts/_pendriveAsistente.mjs --destino E:\              # dice que copiaria (no escribe nada)
 *   node scripts/_pendriveAsistente.mjs --destino E:\ --aplicar    # lo copia a E:\MI ASISTENTE\
 *
 * En la otra PC: doble clic en `E:\MI ASISTENTE\Instalar-Mi-PC.cmd`. El instalador (`tools/instalar_mi_pc/`) ve la
 * carpeta `nube\` al lado de `programa\` y toma todo de ahi. No borra nada en el pendrive ni en la PC: robocopy /E.
 * El destino no puede ser una nube (frena `frenarSiEsNube`).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frenarSiEsNube } from './_lib/soloLocal.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLAUDE = join(homedir(), '.claude');
const INST = join(REPO, 'tools', 'instalar_mi_pc');
export const CARPETA = 'MI ASISTENTE';

/** [origen, destino relativo a <destino>\MI ASISTENTE] — carpetas */
export const CARPETAS = [
    [join(CLAUDE, 'projects', 'C--Dev-BarackMercosul', 'memory'), 'nube/claude-memoria'],
    [join(CLAUDE, 'rules'), 'nube/claude-config/rules'],
    [join(CLAUDE, 'skills'), 'nube/claude-config/skills'],
    [join(CLAUDE, 'agents'), 'nube/claude-config/agents'],
    [join(CLAUDE, 'commands'), 'nube/claude-config/commands'],
    [join(CLAUDE, 'hooks'), 'nube/claude-config/hooks'],
    [join(CLAUDE, 'plans'), 'nube/claude-config/plans'],
];
/** [origen, destino relativo] — archivos sueltos */
export const ARCHIVOS = [
    [join(CLAUDE, 'settings.json'), 'nube/claude-config/settings.json'],
    [join(REPO, '.env.local'), 'nube/repo-privado/.env.local'],
    [join(REPO, '.env.example'), 'nube/repo-privado/.env.example'],
    [join(REPO, '.qr-secret'), 'nube/repo-privado/.qr-secret'],
    [join(INST, 'Instalar-Mi-PC.cmd'), 'Instalar-Mi-PC.cmd'],
    [join(INST, 'LEEME.txt'), 'LEEME.txt'],
    [join(INST, 'instalar_mi_pc.ps1'), 'programa/instalar_mi_pc.ps1'],
    [join(INST, 'ajustar_settings.mjs'), 'programa/ajustar_settings.mjs'],
];

function robocopy(origen, destino, listar) {
    const flags = [origen, destino, '/E', '/COPY:DAT', '/R:1', '/W:1', '/NP', '/NFL', '/NDL', '/NJH', '/XD', 'node_modules', '__pycache__', '.git'];
    if (listar) flags.push('/L');
    const r = spawnSync('robocopy', flags, { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
    const salida = (r.stdout || '') + (r.stderr || '');
    const m = salida.match(/(?:Archivos|Files)\s*:\s*(\d+)\s+(\d+)/);
    return { total: m ? parseInt(m[1], 10) : 0, copiados: m ? parseInt(m[2], 10) : 0, err: (r.status ?? 16) >= 8 ? salida.trim().split('\n').slice(-3).join(' ') : null };
}

const esElPrograma = !!process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (esElPrograma) {
    const args = process.argv.slice(2);
    const i = args.indexOf('--destino');
    const destino = i >= 0 ? args[i + 1] : null;
    const aplicar = args.includes('--aplicar');
    if (!destino) { console.error('uso: node scripts/_pendriveAsistente.mjs --destino E:\\ [--aplicar]'); process.exit(1); }
    const base = join(resolve(destino), CARPETA);
    try { frenarSiEsNube(base, 'El pendrive del asistente'); } catch (e) { console.error(`[X] ${e.message}`); process.exit(1); }
    if (!existsSync(resolve(destino))) { console.error(`[X] No existe ${resolve(destino)} (¿el pendrive esta enchufado?). No se copio nada.`); process.exit(1); }
    console.log(`\n  ${aplicar ? 'COPIANDO a' : '[DRY-RUN] copiaria a'} ${base}\n`);
    let fallos = 0;
    for (const [origen, rel] of CARPETAS) {
        if (!existsSync(origen)) { console.log(`    -- ${rel}: no existe ${origen}, salteado`); continue; }
        const r = robocopy(origen, join(base, ...rel.split('/')), !aplicar);
        if (r.err) { fallos++; console.log(`    [X] ${rel}: ${r.err}`); } else console.log(`    ${String(r.total).padStart(5)} archivos  ${rel}${aplicar ? ` (${r.copiados} nuevos o cambiados)` : ''}`);
    }
    for (const [origen, rel] of ARCHIVOS) {
        if (!existsSync(origen)) { console.log(`    -- ${rel}: no existe ${origen}, salteado`); continue; }
        if (aplicar) { const d = join(base, ...rel.split('/')); mkdirSync(dirname(d), { recursive: true }); copyFileSync(origen, d); }
        console.log(`        1 archivo   ${rel}`);
    }
    if (fallos) { console.log(`\n  [X] ${fallos} copia(s) fallaron.`); process.exit(1); }
    console.log(aplicar
        ? `\n  [OK] Listo. En la otra PC: doble clic en ${join(base, 'Instalar-Mi-PC.cmd')}\n`
        : '\n  (no se copio nada: agregar --aplicar)\n');
}

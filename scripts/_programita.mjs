/**
 * _programita.mjs — la página local «Tareas en segundo plano» (el «programita de Barack», tanda 6 del plan del sistema,
 * 17/10/2026). No es un programa nuevo ni un mod: junta en UNA página lo que ya existe y hoy no se ve en ningún lado.
 *
 * Fak, audio del 15/10 17:58: «con el logo de Barack arriba a la izquierda… que nos vaya diciendo qué tareas corren en
 * segundo plano: los mails, las sincronizaciones, qué estamos haciendo en este momento, si la nube está bien
 * sincronizada… lo descubrí con la skill de impresión 3D, que tenía errores… y me di cuenta solo preguntándole».
 *
 * Qué muestra, y de dónde lo lee (solo lee; no le habla a la impresora ni toca ninguna tarea):
 *   (a) las sesiones con actividad en las últimas horas: el registro de la app (%APPDATA%\Claude\claude-code-sessions)
 *       y la conversación de cada una, con estadoDe() de _lib/colgados.mjs (la misma lectura de _colgados.mjs);
 *   (b) las tareas programadas de Windows «Barack - …»: el resultado sale de SU registro (mails.log, nube-sync.log,
 *       nocturno.json…); de Windows solo la próxima corrida y si está apagada;
 *   (c) la nube: scripts/_nubeSubio.ps1 (cada 10 min: tarda ~15 s) y el _ESTADO.json de la nube de Ingeniería;
 *   (d) la impresora: el seguimiento.log más nuevo que deja `bambu_red.py --seguir` y su última foto;
 *   (e) el último selftest de cada skill de entregable (cada 6 h; ~15 s en total).
 * La lista de tareas y selftests vive en scripts/_lib/programita.data.json; la lógica pura en scripts/_lib/programita.mjs.
 *
 * Uso:
 *   node scripts/_programita.mjs               la regenera cada 30 s y la abre en el navegador (Ctrl+C la para)
 *   node scripts/_programita.mjs --una-vez     una sola vez y sale
 *   opciones: --sin-abrir · --medir-ya (corre nube y selftests ahora) · --sin-medir (no corre nada caro)
 *             --sin-windows (no le pregunta a Windows) · --sin-sesiones · --repo <carpeta> · --salida <carpeta>
 *             --cada <segundos>
 * La página queda en <repo>\.claude\state\programita\tareas.html (local, no va a la nube ni al repo).
 * Sale con 2 ante un argumento que no conoce.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { colaDe, estadoDe } from './_lib/colgados.mjs';
import { RAIZ_APP } from './_hijaEstado.mjs';
import { buscarNube } from './_lib/nubeRutas.mjs';
import {
  armarTarea, estadoSesion, html, leerArb, leerEstadoNube, leerMails, leerNocheTarea, leerNube, leerResultado,
  leerSeguimiento, leerSelftest, leerWindows,
} from './_lib/programita.mjs';
import { cargarTema, sha256 } from './_lib/temaCasa.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, '_lib', 'programita.data.json'), 'utf8'));

/** La raíz del repo PRINCIPAL (no la de un worktree): ahí viven los registros de las tareas. */
export function raizPrincipal(desde = AQUI) {
  const r = spawnSync('git', ['-C', desde, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' });
  const comun = (r.stdout || '').trim();
  if (r.status === 0 && comun) return path.dirname(path.resolve(comun));
  return path.resolve(desde, '..');
}

const leer = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return null; } };

function ruta(plantilla, repo) {
  return path.normalize(plantilla
    .replace('{repo}', repo)
    .replace(/%([A-Z_]+)%/g, (_, v) => process.env[v] ?? (v === 'USERPROFILE' ? os.homedir() : '')));
}

/** Las tareas «Barack*» de Windows: última corrida, resultado, próxima y estado. */
function tareasWindows() {
  const ps = "Get-ScheduledTask -TaskName 'Barack*' -ErrorAction SilentlyContinue | ForEach-Object { $i = $_ | Get-ScheduledTaskInfo; "
    + "$ms = { param($d) if ($d -and $d.Year -gt 2000) { ([DateTimeOffset]$d).ToUnixTimeMilliseconds() } else { $null } }; "
    + "[pscustomobject]@{ nombre = $_.TaskName; estado = [string]$_.State; ultimaMs = (& $ms $i.LastRunTime); ultimoResultado = $i.LastTaskResult; proximaMs = (& $ms $i.NextRunTime) } } | ConvertTo-Json -Compress";
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 30000 });
  const mapa = new Map();
  try {
    const d = JSON.parse((r.stdout || '').trim() || '[]');
    for (const t of Array.isArray(d) ? d : [d]) mapa.set(t.nombre, t);
  } catch { /* sin dato: cada tarea lo dice */ }
  return mapa;
}

function leerTarea(def, repo, win, ahora) {
  const p = def.registro ? ruta(def.registro, repo) : null;
  let lectura;
  if (def.lector === 'mails') lectura = leerMails(leer(p));
  else if (def.lector === 'resultado') lectura = leerResultado(leer(p), ahora);
  else if (def.lector === 'noche') lectura = leerNocheTarea(leer(p), mtime(p));
  else if (def.lector === 'arb') {
    // 64 KB de cola: el registro no repite renglones iguales, así que la falla puede estar lejos del final
    lectura = leerArb(leer(p), def.registro_log ? colaDe(ruta(def.registro_log, repo), 65536) : [], ahora);
  } else lectura = leerWindows(win);
  return armarTarea(def, lectura, win, ahora);
}

/** Los registros de la app de las sesiones no archivadas con actividad en las últimas `horas`. */
function sesiones(ahora, horas) {
  const raizApp = RAIZ_APP();
  const proyectos = path.join(os.homedir(), '.claude', 'projects');
  let dirsProy = [];
  try { dirsProy = fs.readdirSync(proyectos, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(proyectos, d.name)); } catch { /* sin conversaciones */ }
  const out = [];
  const recorrer = (dir, prof) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && prof < 2 && !e.name.startsWith('_')) recorrer(p, prof + 1);
      else if (e.isFile() && /^local_.*\.json$/.test(e.name)) {
        if ((mtime(p) ?? 0) < ahora - horas * 3600000) continue;
        let d; try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
        if (d.isArchived || !(d.lastActivityAt > ahora - horas * 3600000)) continue;
        let est = null;
        if (d.cliSessionId) {
          const conv = dirsProy.map((x) => path.join(x, `${d.cliSessionId}.jsonl`)).find((x) => fs.existsSync(x));
          if (conv) est = estadoDe(colaDe(conv), ahora, { minutos: 10 });
        }
        out.push(estadoSesion(d, est, ahora));
      }
    }
  };
  recorrer(raizApp, 0);
  return out.sort((a, b) => (b.ultimaMs ?? 0) - (a.ultimaMs ?? 0));
}

/** El seguimiento.log más nuevo debajo de las carpetas de la impresora (hasta 4 niveles). */
function ultimoSeguimiento(raices) {
  let mejor = null;
  const recorrer = (dir, prof) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && prof < 4) recorrer(p, prof + 1);
      else if (e.isFile() && e.name === 'seguimiento.log') {
        const m = mtime(p);
        if (m && (!mejor || m > mejor.mtimeMs)) mejor = { ruta: p, mtimeMs: m };
      }
    }
  };
  for (const r of raices) recorrer(r, 0);
  return mejor;
}

/** La foto más nueva de la carpeta del seguimiento, copiada al lado de la página (una sola, si cambió). */
function copiarFoto(carpeta, salida) {
  let fotos = [];
  try { fotos = fs.readdirSync(carpeta).filter((n) => /\.jpe?g$/i.test(n)).map((n) => ({ n, m: mtime(path.join(carpeta, n)) })); } catch { return null; }
  if (!fotos.length) return null;
  const f = fotos.sort((a, b) => b.m - a.m)[0];
  const destino = path.join(salida, 'impresora.jpg');
  if ((mtime(destino) ?? 0) < f.m) fs.copyFileSync(path.join(carpeta, f.n), destino);
  return { archivo: 'impresora.jpg', cuandoMs: f.m };
}

function medirNube(repo) {
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(repo, 'scripts', '_nubeSubio.ps1')], { encoding: 'utf8', timeout: 180000 });
  return { codigo: r.status ?? -1, texto: `${r.stdout || ''}${r.error ? `\n${r.error.message}` : ''}`, cuandoMs: Date.now() };
}

function correrSelftest(def, repo) {
  const salidas = [];
  for (const [exe, ...args] of def.comandos) {
    const r = spawnSync(exe, args, { cwd: repo, encoding: 'utf8', timeout: 180000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    const ult = `${r.stdout || ''}\n${r.stderr || ''}`.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() ?? '';
    salidas.push({ ok: r.status === 0, ult: r.error ? `no arrancó: ${r.error.message}` : ult });
  }
  const malo = salidas.find((s) => !s.ok);
  return { ok: !malo, resumen: (malo ?? salidas[salidas.length - 1]).ult.slice(0, 160), cuandoMs: Date.now() };
}

/** Arma y escribe la página una vez. Devuelve la ruta del HTML. */
export function generar(op) {
  const ahora = Date.now();
  const { repo, salida } = op;
  fs.mkdirSync(salida, { recursive: true });
  // el logo sale del tema (verificado por sha256 contra el oficial); la copia de la pagina se compara en cada vuelta y
  // se repone si alguien la cambio (tanda 16: antes solo se copiaba si faltaba)
  const logo = path.join(salida, 'logo.png');
  const oficial = cargarTema();
  if (!fs.existsSync(logo) || sha256(logo) !== oficial.logo.sha256) fs.copyFileSync(oficial.logo.ruta, logo);
  const archivoMedido = path.join(salida, 'medido.json');
  let medido = {};
  try { medido = JSON.parse(fs.readFileSync(archivoMedido, 'utf8')); } catch { medido = {}; }
  medido.selftests ??= {};
  if (!op.sinMedir) {
    if (op.medirYa || !(medido.nube?.cuandoMs > ahora - CANON.nube_cada_minutos * 60000)) medido.nube = medirNube(repo);
    for (const def of CANON.selftests) {
      if (!def.comandos.length) continue;
      if (op.medirYa || !(medido.selftests[def.skill]?.cuandoMs > ahora - CANON.selftests_cada_horas * 3600000)) medido.selftests[def.skill] = correrSelftest(def, repo);
    }
    fs.writeFileSync(archivoMedido, JSON.stringify(medido, null, 1), 'utf8');
  }
  const win = op.sinWindows ? new Map() : tareasWindows();
  const seg = ultimoSeguimiento(CANON.impresora_carpetas.map((r) => ruta(r, repo)));
  const impresora = { ...leerSeguimiento(seg ? leer(seg.ruta) : null, seg?.mtimeMs ?? null, ahora, { umbral: CANON.detector_umbral, recienteMin: CANON.impresora_reciente_minutos }), carpeta: seg ? path.dirname(seg.ruta) : null };
  const foto = seg ? copiarFoto(path.dirname(seg.ruta), salida) : null;
  // la carpeta de la memoria por el canon de carpetas (mudanza del 17/10/2026: nueva si existe, si no la vieja)
  const nubeIng = path.join(buscarNube(os.homedir(), {}), '_ESTADO.json');
  const pagina = html({
    ahora, pc: process.env.COMPUTERNAME, refresco: CANON.refresco_segundos, logo: 'logo.png',
    sesionesHoras: CANON.sesiones_horas, selftestsHoras: CANON.selftests_cada_horas,
    sesiones: op.sinSesiones ? [] : sesiones(ahora, CANON.sesiones_horas),
    tareas: CANON.tareas.map((def) => leerTarea(def, repo, win.get(def.nombre) ?? null, ahora)),
    nube: leerNube(medido.nube), nubePcs: leerEstadoNube(leer(nubeIng)),
    impresora, foto: foto?.archivo ?? null, fotoMs: foto?.cuandoMs ?? null,
    selftests: CANON.selftests.map((def) => leerSelftest(def, medido.selftests[def.skill])),
  });
  const destino = path.join(salida, 'tareas.html');
  fs.writeFileSync(destino, pagina, 'utf8');
  return destino;
}

function main() {
  const SOLO = ['--una-vez', '--sin-abrir', '--medir-ya', '--sin-medir', '--sin-windows', '--sin-sesiones'];
  const CON_VALOR = ['--repo', '--salida', '--cada'];
  const args = process.argv.slice(2);
  const op = {};
  for (let i = 0; i < args.length; i++) {
    if (SOLO.includes(args[i])) { op[args[i]] = true; continue; }
    if (CON_VALOR.includes(args[i]) && i + 1 < args.length) { op[args[i]] = args[++i]; continue; }
    console.log(`no conozco el argumento ${args[i]}. No hago nada.\nuso: node scripts/_programita.mjs [--una-vez] [--sin-abrir] [--medir-ya] [--sin-medir] [--sin-windows] [--sin-sesiones] [--repo <carpeta>] [--salida <carpeta>] [--cada <segundos>]`);
    process.exit(2);
  }
  const repo = path.resolve(op['--repo'] ?? raizPrincipal());
  const salida = path.resolve(op['--salida'] ?? path.join(repo, '.claude', 'state', 'programita'));
  const cada = /^\d+$/.test(op['--cada'] ?? '') ? Math.max(1, Number(op['--cada'])) : CANON.refresco_segundos;
  const o = { repo, salida, sinMedir: !!op['--sin-medir'], medirYa: !!op['--medir-ya'], sinWindows: !!op['--sin-windows'], sinSesiones: !!op['--sin-sesiones'] };
  const una = () => { try { return generar(o); } catch (e) { console.log(`[programita] no pude armar la página: ${e.message}`); return null; } };
  // La primera vez sin lo caro, para que la página aparezca enseguida; lo caro entra en la vuelta siguiente.
  const destino = generar({ ...o, sinMedir: true });
  console.log(`[programita] ${destino}`);
  if (op['--una-vez']) { if (!o.sinMedir) una(); return; }
  if (!op['--sin-abrir']) spawnSync('cmd', ['/c', 'start', '', destino], { stdio: 'ignore' });
  una();
  console.log(`[programita] se regenera cada ${cada} s; Ctrl+C para parar.`);
  setInterval(una, cada * 1000);
}

if (process.argv[1] && /_programita\.mjs$/.test(process.argv[1])) main();

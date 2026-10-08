/**
 * _nocturno.mjs — la noche de Claude: gasta los creditos mensuales de la API (plan Max) en trabajo
 * util mientras la notebook no se usa, y deja el resultado para la sesion de la manana.
 *
 * Pasos (cada uno independiente: el que falla queda 'error' y los demas siguen):
 *   0. clave presente (si no, exit 3) y presupuesto del mes (en rojo no arranca, salvo --sin-tope)
 *   1. preauditoria  la pre-auditoria de los AMFE que cambiaron (scripts/_preauditarAmfe.mjs)
 *   2. mails         hasta 12 pedidos sin respuesta, una linea cada uno con su area (Haiku). Se
 *                    ETIQUETA el area, no se filtra nada.
 *   3. novedades     los lunes (o si paso una semana): _novedadesClaude.mjs y un resumen de 8
 *                    renglones "nos sirve / nos puede romper" (Sonnet)
 * Deja .claude/state/nocturno.json (lo lee el tablero y la sesion de la manana) y una linea en
 * .sgc-cache/api/nocturno.log. No toca el repo, ni Supabase (solo lectura), ni el arb, ni Outlook.
 * La logica pura vive en scripts/_lib/nocturno.mjs; las reglas, en .claude/rules/api-claude.md.
 *
 * Uso:
 *   node scripts/_nocturno.mjs                    la noche entera (lo corre la tarea de Windows)
 *   node scripts/_nocturno.mjs --simular          que haria y cuanto costaria, sin gastar ni guardar
 *   node scripts/_nocturno.mjs --solo mails       un paso solo (preauditoria | mails | novedades)
 *   node scripts/_nocturno.mjs --sin-tope         corre aunque el presupuesto del mes este en rojo
 *   node scripts/_nocturno.mjs --estado           la ultima noche: linea, pasos y edad
 *   node scripts/_nocturno.mjs --agendar          registra la tarea diaria de las 06:30 (pide la clave)
 *   node scripts/_nocturno.mjs --desagendar       la borra
 *
 * Sale con 0 ok · 1 fallo un paso · 2 argumento · 3 falta la clave.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  crearCliente, leerClave, llamar, estimarUsd, presupuestoDelMes, selloLocal, usd, MENSAJE_SIN_CLAVE, DIR_API,
} from './_lib/claudeApi.mjs';
import { correr as correrPreauditoria, escribirAtomico } from './_preauditarAmfe.mjs';
import { tokensAprox } from './_lib/preauditoriaAmfe.mjs';
import { claveHilo, MAILS_JSONL } from './_lib/mailCache.mjs';
import { cuerpoPropio } from './_lib/vozGate.mjs';
import { avisoHook } from './_lib/novedadesClaude.mjs';
import { psRun } from './_lib/powershell.mjs';
import {
  PASOS, NOMBRE_TAREA, HORA_TAREA, debeArrancar, correrPasos, elegirPedidos, emparejarMails, recortarCuerpo,
  SYSTEM_MAILS, armarPedidoMails, lineasDeMails, tocaNovedades, novedadesSinCambios, SYSTEM_NOVEDADES,
  armarEstado, edadHoras, comandoAgendar, comandoDesagendar, comandoEstadoTarea, leerEstadoTarea,
} from './_lib/nocturno.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
export const RUTA_ESTADO = path.join(RAIZ, '.claude', 'state', 'nocturno.json');
const RUTA_LOG = path.join(DIR_API, 'nocturno.log');
const DIR_NOVEDADES = process.env.BARACK_NOVEDADES_DIR || path.join(RAIZ, '.sgc-cache', 'x-seguimiento');

const leerJson = (ruta) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return null; } };

// ─────────────────────────────────────────────────────────────────────────────
// Paso 2: mails sin respuesta
// ─────────────────────────────────────────────────────────────────────────────

/** Los pedidos sin respuesta, como los arma _mails.py (mismo llamado que _escritorio.mjs). */
function pedidosSinRespuesta() {
  const r = spawnSync('python', [path.join(AQUI, '_mails.py'), '--sin-respuesta', '--json', '--dias', '5', '--ventana', '45'], {
    encoding: 'utf8', timeout: 120000, cwd: RAIZ, windowsHide: true,
    env: { ...process.env, BARACK_MAIL_CACHE: path.dirname(MAILS_JSONL), PYTHONIOENCODING: 'utf-8' },
  });
  let datos = null;
  try { datos = JSON.parse(String(r.stdout || '').trim().split(/\r?\n/).pop()); } catch { /* sin JSON */ }
  if (datos?.error) throw new Error(`_mails.py: ${datos.error} (sin cache de mails no hay pedidos que mirar)`);
  if (r.status !== 0 || !datos || !Array.isArray(datos.pedidos)) {
    throw new Error(`no pude correr _mails.py --sin-respuesta (${String(r.stderr || r.error?.message || `salio con ${r.status}`).trim().slice(0, 200)})`);
  }
  return datos.pedidos;
}

/** Del cache (23 MB), solo los mails que hacen falta: los de esos ids o esos hilos. Sin cargar todo. */
async function mailsDeLosPedidos(pedidos, jsonl = MAILS_JSONL) {
  if (!fs.existsSync(jsonl)) return [];
  const ids = new Set(pedidos.map((p) => String(p.id || '')).filter(Boolean));
  const claves = new Set(pedidos.map((p) => p.hilo || claveHilo(p.asunto)));
  const out = [];
  const rl = readline.createInterface({ input: fs.createReadStream(jsonl, 'utf8'), crlfDelay: Infinity });
  for await (const linea of rl) {
    if (!linea.trim()) continue;
    let m;
    try { m = JSON.parse(linea); } catch { continue; }
    if (!ids.has(String(m.id || '')) && !claves.has(claveHilo(m.asunto))) continue;
    out.push({ id: m.id, asunto: String(m.asunto ?? ''), de: String(m.de ?? ''), fecha: String(m.fecha ?? ''), carpeta: String(m.carpeta ?? ''), cuerpo: String(m.cuerpo ?? '') });
  }
  return out;
}

async function pasoMails({ cliente, simular }) {
  const elegidos = elegirPedidos(pedidosSinRespuesta());
  if (!elegidos.length) return { detalle: '0 mails sin respuesta', datos: [] };
  const pares = emparejarMails(elegidos, await mailsDeLosPedidos(elegidos), claveHilo)
    .map(({ pedido, mail }) => ({ pedido, cuerpo: mail ? recortarCuerpo(mail.cuerpo, cuerpoPropio) : '' }));
  const pedido = armarPedidoMails(pares);
  if (simular) {
    const est = estimarUsd('haiku', { entrada: tokensAprox(SYSTEM_MAILS) + tokensAprox(pedido.usuario), salida: 2000 });
    return { detalle: `${elegidos.length} mails para resumir (simulado, ~${usd(est)})`, datos: [] };
  }
  const r = await llamar(cliente, { modelo: 'haiku', effort: 'low', system: SYSTEM_MAILS, ...pedido, maxTokens: 8000, tarea: 'nocturno:mails' });
  const lineas = lineasDeMails(elegidos, r.json);
  const sinResumen = lineas.filter((l) => /^\(sin resumen/.test(l.linea)).length;
  return { detalle: `${lineas.length} mails resumidos${sinResumen ? ` (${sinResumen} sin resumen)` : ''}`, costoUsd: r.costoUsd, datos: lineas };
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 3: novedades de Claude
// ─────────────────────────────────────────────────────────────────────────────

const listados = () => {
  try {
    return fs.readdirSync(DIR_NOVEDADES).filter((f) => /^novedades_.*\.md$/.test(f))
      .map((f) => ({ f, ms: fs.statSync(path.join(DIR_NOVEDADES, f)).mtimeMs }))
      .sort((a, b) => b.ms - a.ms);
  } catch { return []; }
};

async function pasoNovedades({ cliente, simular, ahora }) {
  const aviso = avisoHook(leerJson(path.join(DIR_NOVEDADES, '_estado.json')) || {}, ahora);
  if (!tocaNovedades(ahora, aviso)) return { saltado: true, detalle: 'no tocaba (los lunes, o si paso una semana)' };
  if (simular) return { detalle: 'tocaba: correria _novedadesClaude.mjs y un resumen con Sonnet (simulado)' };
  const desde = Date.now() - 1000;
  const r = spawnSync(process.execPath, [path.join(AQUI, '_novedadesClaude.mjs')], { encoding: 'utf8', timeout: 10 * 60 * 1000, cwd: RAIZ, windowsHide: true });
  if (r.status !== 0) throw new Error(`_novedadesClaude.mjs salio con ${r.status}: ${String(r.stderr || r.stdout || r.error?.message || '').trim().slice(-200)}`);
  const nuevo = listados().find((x) => x.ms >= desde);
  if (!nuevo) throw new Error('_novedadesClaude.mjs no dejo un listado nuevo: resultado vacio');
  const texto = fs.readFileSync(path.join(DIR_NOVEDADES, nuevo.f), 'utf8');
  if (novedadesSinCambios(texto)) return { detalle: 'sin cambios', datos: { listado: nuevo.f } };
  const resp = await llamar(cliente, { modelo: 'sonnet', effort: 'medium', system: SYSTEM_NOVEDADES, usuario: texto, maxTokens: 8000, tarea: 'nocturno:novedades' });
  const resumen = resp.texto.trim();
  if (!resumen) throw Object.assign(new Error('el resumen de novedades vino vacio'), { costoUsd: resp.costoUsd });
  const sello = selloLocal(ahora).replace(/[: ]/g, '').replace(/-/g, '').slice(0, 12);
  const ruta = path.join(DIR_NOVEDADES, `resumen_${sello}.md`);
  escribirAtomico(ruta, `# Novedades de Claude — resumen de la noche (${selloLocal(ahora).slice(0, 16)})\n\nDe ${nuevo.f}. Para la sesion de la manana: se cruza con lo que ya tenemos antes de proponerle algo a Fak; nada se aplica solo.\n\n${resumen}\n`);
  const renglones = resumen.split(/\r?\n/).filter((l) => l.trim().startsWith('-')).length;
  return { detalle: `${renglones} renglon(es) en ${path.basename(ruta)}`, costoUsd: resp.costoUsd, datos: { listado: nuevo.f, resumen: ruta } };
}

// ─────────────────────────────────────────────────────────────────────────────
// La noche
// ─────────────────────────────────────────────────────────────────────────────

function guardarEstado(estado) {
  escribirAtomico(RUTA_ESTADO, `${JSON.stringify(estado, null, 2)}\n`);
  fs.mkdirSync(path.dirname(RUTA_LOG), { recursive: true });
  fs.appendFileSync(RUTA_LOG, `${selloLocal()}  ${estado.lineaTablero}\n`, 'utf8');
}

async function noche({ simular, solo, sinTope }) {
  const inicio = new Date();
  const clave = leerClave();
  if (!clave && !simular) {
    guardarEstado(armarEstado({ inicio, fin: new Date(), noArranco: 'falta la clave de la API (node scripts/_claude.mjs --check)', presupuesto: presupuestoDelMes() }));
    console.error(MENSAJE_SIN_CLAVE);
    return 3;
  }
  const cliente = clave ? crearCliente() : null;
  const arranque = debeArrancar(presupuestoDelMes(), { sinTope });
  if (!arranque.ok) {
    if (!simular) guardarEstado(armarEstado({ inicio, fin: new Date(), noArranco: arranque.motivo, presupuesto: presupuestoDelMes() }));
    console.log(arranque.motivo);
    return 0;
  }

  const datos = { hallazgos: null, reporte: null, mails: [], resumenNovedades: null };
  const pasos = await correrPasos([
    {
      nombre: 'preauditoria',
      correr: async () => {
        const r = await correrPreauditoria({ simular, cliente, ahora: inicio });
        if (simular) return { detalle: r.linea };
        datos.hallazgos = { revisados: r.revisados, saltados: r.saltados, total: r.hallazgos, nuevos: r.nuevos, errores: r.errores };
        datos.reporte = r.reporte;
        if (r.errores && !r.revisados) throw Object.assign(new Error(`los ${r.errores} AMFE a revisar dieron error (ver ${path.basename(r.reporte)})`), { costoUsd: r.costoUsd });
        return { detalle: r.linea.replace(/ · \$[\d.]+$/, ''), costoUsd: r.costoUsd };
      },
    },
    {
      nombre: 'mails',
      correr: async () => { const r = await pasoMails({ cliente, simular }); datos.mails = r.datos || []; return r; },
    },
    {
      nombre: 'novedades',
      correr: async () => { const r = await pasoNovedades({ cliente, simular, ahora: inicio }); datos.resumenNovedades = r.datos?.resumen ?? null; return r; },
    },
  ], {
    solo,
    alTerminar: (p) => console.log(`[${p.estado}] ${p.nombre}: ${p.detalle}${p.costoUsd ? ` (${usd(p.costoUsd)})` : ''}`),
  });

  const estado = armarEstado({ inicio, fin: new Date(), pasos, presupuesto: presupuestoDelMes(), ...datos });
  if (simular) {
    console.log(`${estado.lineaTablero}\n(simulado: no se gasto ni se guardo nada${clave ? '' : '; sin clave, los tokens son aproximados'})`);
  } else {
    guardarEstado(estado);
    console.log(estado.lineaTablero);
    if (datos.reporte) console.log(`Reporte de la pre-auditoria (para la sesion de la manana): ${datos.reporte}`);
  }
  return pasos.some((p) => p.estado === 'error') ? 1 : 0;
}

function mostrarEstado() {
  const e = leerJson(RUTA_ESTADO);
  if (!e) { console.log(`No hay noche registrada (${path.relative(RAIZ, RUTA_ESTADO)} no existe).`); return 0; }
  const h = edadHoras(e);
  console.log(e.lineaTablero);
  console.log(`de hace ${h ?? '?'} h${h != null && h > 26 ? ' — VIEJO: la ultima noche no corrio o fallo antes de escribir' : ''}`);
  for (const p of e.pasos || []) console.log(`  [${p.estado}] ${p.nombre}: ${p.detalle}`);
  for (const m of e.mails || []) console.log(`  mail [${m.area}] ${m.asunto} — ${m.linea}`);
  if (e.reporte) console.log(`  reporte: ${e.reporte}`);
  return 0;
}

const USO = `uso: node scripts/_nocturno.mjs [--simular] [--solo ${PASOS.join('|')}] [--sin-tope] | --estado | --agendar | --desagendar`;

async function main(argv) {
  const CON_VALOR = ['--solo'];
  const SIN_VALOR = ['--simular', '--sin-tope', '--agendar', '--desagendar', '--estado'];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (SIN_VALOR.includes(a)) { op[a] = true; continue; }
    if (CON_VALOR.includes(a) && i + 1 < argv.length) { op[a] = argv[++i]; continue; }
    console.error(`no conozco el argumento ${a}. No hago nada.\n${USO}`);
    return 2;
  }
  if (op['--solo'] && !PASOS.includes(op['--solo'])) { console.error(`--solo va con uno de: ${PASOS.join(', ')}. No hago nada.`); return 2; }

  if (op['--estado']) return mostrarEstado();
  if (op['--desagendar']) {
    const s = psRun(comandoDesagendar()).trim();
    console.log(s === 'BORRADA' ? `Tarea "${NOMBRE_TAREA}" borrada.` : `La tarea "${NOMBRE_TAREA}" no estaba agendada.`);
    return 0;
  }
  if (op['--agendar']) {
    if (!leerClave()) { console.error(`No agendo la noche: sin la clave fallaria cada manana.\n\n${MENSAJE_SIN_CLAVE}`); return 3; }
    psRun(comandoAgendar({ raiz: RAIZ }), { timeout: 60000 });
    const t = leerEstadoTarea(psRun(comandoEstadoTarea(), { timeout: 30000 }));
    if (!t.agendada) { console.error('Register-ScheduledTask no dio error pero la tarea no aparece. No esta agendada.'); return 1; }
    console.log(`Agendada: "${NOMBRE_TAREA}" todos los dias a las ${HORA_TAREA} (si la notebook esta apagada, corre al prenderla). Estado ${t.estado}, proxima ${t.proxima}.`);
    return 0;
  }
  try {
    return await noche({ simular: !!op['--simular'], solo: op['--solo'] || null, sinTope: !!op['--sin-tope'] });
  } catch (e) {
    console.error(`La noche fallo antes de terminar: ${e?.message ?? e}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; setTimeout(() => process.exit(code), 1500).unref(); });
}

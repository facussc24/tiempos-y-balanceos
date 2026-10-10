/**
 * _nocturno.mjs — la noche de Claude: gasta los creditos de la API (plan Max) en trabajo util mientras
 * la notebook no se usa, y deja el resultado para la sesion de la manana.
 *
 * Pasos (cada uno independiente: el que falla queda 'error' y los demas siguen):
 *   0. clave presente (si no, exit 3) y presupuesto del CICLO de facturacion (en rojo no arranca, salvo --sin-tope)
 *   1. preauditoria  la pre-auditoria de los AMFE que cambiaron (scripts/_preauditarAmfe.mjs), hasta 6 por
 *                    noche (los de updated_at mas viejo primero; el resto queda para la noche siguiente). El
 *                    estado y el reporte se guardan AMFE por AMFE: una corrida cortada conserva lo hecho.
 *   2. mails         hasta 12 pedidos sin respuesta, una linea cada uno con su area (Haiku). Se
 *                    ETIQUETA el area, no se filtra nada.
 *   3. prioridades   hasta 4 renglones "[fuente] que hacer · por que hoy" que ORDENAN lo que ya existe
 *                    (seguimientos con fecha, hilos de tareas abiertas con mails nuevos, mails sin
 *                    respuesta, carpetas del Escritorio, lo que dejo esta misma noche). Una llamada a
 *                    Sonnet; el codigo descarta todo renglon cuya fuente no este en la entrada. Va a
 *                    .claude/state/prioridades.md: es una sugerencia para la sesion de la manana, no para Fak.
 *   4. novedades     TODOS los dias: _novedadesClaude.mjs y, si trae algo nuevo, un resumen corto de hasta 4
 *                    renglones con Haiku; los lunes (o pasada una semana) el resumen largo de hasta 8 con
 *                    Sonnet sobre los listados de la semana ("nos sirve / nos puede romper")
 *   5-7. SEMANALES, al final (corren si su ultima corrida COMPLETA, anotada por la noche en
 *                    .claude/state/nocturno-semanal.json, tiene 7 dias o mas; --solo <paso> los fuerza):
 *        vigilante   _lib/vigilarPrecios.mjs: baja pricing, creditos y deprecaciones y compara con PRECIOS (sin modelo)
 *        propuestas  _propuestasSkills.mjs: revisor Sonnet + refutador Opus sobre los 20 skills mas usados (~$2,5)
 *        disparo     _pruebaDisparoSkills.mjs: Haiku dice que skill cargaria para mensajes reales de Fak (~$0,01)
 *                    Los dos ultimos leen los transcripts UNA vez entre los dos.
 * Deja .claude/state/nocturno.json (lo lee el tablero y la sesion de la manana) y una linea en
 * .sgc-cache/api/nocturno.log. No toca el repo, ni Supabase (solo lectura), ni el arb, ni Outlook: todo lo
 * que escribe ESTE proceso pasa por scripts/_lib/escrituraSegura.mjs (solo .claude/state, .sgc-cache y
 * reports/staging). Los scripts que lanza aparte (_novedadesClaude.mjs, _hilosAbiertos.mjs) escriben por su
 * cuenta en esas mismas carpetas ignoradas, sin pasar por esa puerta.
 * La logica pura vive en scripts/_lib/nocturno.mjs; las reglas, en .claude/rules/api-claude.md.
 *
 * DOS FRENOS ademas del presupuesto del ciclo, los dos antes de cada paso:
 *   - tope por corrida: BARACK_API_TOPE_CORRIDA_USD (por defecto $8). Si lo gastado en ESTA corrida lo
 *     supera, los pasos que faltan quedan 'saltado' ("tope por corrida ($X de $8)") y la noche sale con 1.
 *   - tres pasos seguidos en error: la noche se frena y lo anota.
 *   --sin-tope levanta el del ciclo y el de la corrida.
 *
 * Uso:
 *   node scripts/_nocturno.mjs                    la noche entera (lo corre la tarea de Windows)
 *   node scripts/_nocturno.mjs --simular          que haria y cuanto costaria, sin gastar ni guardar
 *   node scripts/_nocturno.mjs --solo mails       un paso solo (preauditoria | mails | prioridades | novedades |
 *                                                 vigilante | propuestas | disparo; un semanal con --solo corre aunque no toque)
 *   node scripts/_nocturno.mjs --sin-tope         corre aunque el presupuesto del ciclo este en rojo o la corrida pase su tope
 *   node scripts/_nocturno.mjs --estado           la ultima noche: linea, pasos, prioridades y edad
 *   node scripts/_nocturno.mjs --agendar          registra la tarea diaria de las 06:30 (pide la clave)
 *   node scripts/_nocturno.mjs --desagendar       la borra
 *
 * Sale con 0 ok · 1 fallo un paso o la noche se corto sola · 2 argumento · 3 falta la clave.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  crearCliente, leerClave, llamar, estimarUsd, presupuestoDelMes, topeCorridaUsd, selloLocal, usd, MENSAJE_SIN_CLAVE, DIR_API,
} from './_lib/claudeApi.mjs';
import { correr as correrPreauditoria } from './_preauditarAmfe.mjs';
import { tokensAprox, TOPE_AMFE_POR_NOCHE } from './_lib/preauditoriaAmfe.mjs';
import { escribirSeguro, agregarSeguro } from './_lib/escrituraSegura.mjs';
import { claveHilo, MAILS_JSONL } from './_lib/mailCache.mjs';
import { cuerpoPropio } from './_lib/vozGate.mjs';
import { avisoHook } from './_lib/novedadesClaude.mjs';
import { psRun } from './_lib/powershell.mjs';
import { listar, ESCRITORIO_DEFAULT, esEnEspera, clasificarEntrada, diasDesde } from './_escritorio.mjs';
import { leerTranscripts } from './_lib/transcriptsFak.mjs';
import { correr as correrPropuestas } from './_propuestasSkills.mjs';
import { correr as correrDisparo } from './_pruebaDisparoSkills.mjs';
import { correr as correrVigilante } from './_lib/vigilarPrecios.mjs';
import {
  PASOS, NOMBRE_TAREA, HORA_TAREA, debeArrancar, correrPasos, elegirPedidos, emparejarMails, recortarCuerpo,
  SYSTEM_MAILS, armarPedidoMails, lineasDeMails, tocaNovedades, novedadesSinCambios, planNovedades, juntarListados, resumirNovedades,
  reunirEntradas, armarPedidoPrioridades, SYSTEM_PRIORIDADES, generarPrioridades, textoPrioridades, lineaRenglon,
  armarEstado, edadHoras, comandoAgendar, comandoDesagendar, comandoEstadoTarea, leerEstadoTarea,
  ultimaCorrida, anotarCorrida, corridaCompleta, tocaSemanal, detalleVigilante,
} from './_lib/nocturno.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
export const RUTA_ESTADO = path.join(RAIZ, '.claude', 'state', 'nocturno.json');
export const RUTA_PRIORIDADES = path.join(RAIZ, '.claude', 'state', 'prioridades.md');
const RUTA_LOG = path.join(DIR_API, 'nocturno.log');
const DIR_NOVEDADES = process.env.BARACK_NOVEDADES_DIR || path.join(RAIZ, '.sgc-cache', 'x-seguimiento');

const leerJson = (ruta) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return null; } };
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const p2 = (x) => String(x).padStart(2, '0');
/** "jueves 08/10/2026": el dia de la noche, escrito para el modelo (que no tiene reloj). */
const fechaEscrita = (f) => `${DIAS_SEMANA[f.getDay()]} ${p2(f.getDate())}/${p2(f.getMonth() + 1)}/${f.getFullYear()}`;

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
// Paso 3: prioridades del dia
// ─────────────────────────────────────────────────────────────────────────────

/** El texto de `_seguimientos.mjs --hook` (vacio si no hay nada abierto o no hay memoria en esta PC). Si el script se cae
 *  (sale distinto de 0) es un ERROR del paso, no "0 seguimientos": un vacio por rotura no es un resultado (auditor 09/10/2026). */
function seguimientosHook() {
  const r = spawnSync(process.execPath, [path.join(AQUI, '_seguimientos.mjs'), '--hook'], { encoding: 'utf8', timeout: 30000, cwd: RAIZ, windowsHide: true });
  if (r.error || r.status !== 0) throw new Error(`_seguimientos.mjs --hook: ${String(r.stderr || r.error?.message || `salio con ${r.status}`).trim().slice(0, 200)}`);
  return String(r.stdout || '');
}

/** El `cruce` de `_hilosAbiertos.mjs --json` (el JSON sale en varias lineas: se parsea la salida entera). */
function hilosAbiertos() {
  const r = spawnSync(process.execPath, [path.join(AQUI, '_hilosAbiertos.mjs'), '--json'], { encoding: 'utf8', timeout: 180000, cwd: RAIZ, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`_hilosAbiertos.mjs --json: ${String(r.stderr || r.error?.message || `salio con ${r.status}`).trim().slice(0, 200)}`);
  const datos = JSON.parse(String(r.stdout || '').trim());
  return Array.isArray(datos?.cruce) ? datos.cruce : [];
}

/** Las carpetas del Escritorio (la cola de tareas) con sus dias sin cambios; `_EN ESPERA` se abre una por una. Solo nombres y dias. */
function carpetasDelEscritorio(ahora) {
  const ms = ahora.getTime();
  const out = [];
  for (const e of listar(ESCRITORIO_DEFAULT)) {
    const clase = clasificarEntrada(e.nombre, e.dir);
    if (clase === 'tarea') {
      out.push({ nombre: e.nombre, dias: diasDesde(e.mtime, ms), enEspera: false });
    } else if (clase === 'espera' && esEnEspera(e.nombre)) {
      for (const t of listar(e.ruta)) {
        if (clasificarEntrada(t.nombre, t.dir) === 'tarea') out.push({ nombre: t.nombre, dias: diasDesde(t.mtime, ms), enEspera: true });
      }
    }
  }
  return out.sort((a, b) => a.dias - b.dias);
}

async function pasoPrioridades({ cliente, simular, ahora, hechos, datos }) {
  const { entradas, avisos } = reunirEntradas({
    fuentes: { seguimientos: seguimientosHook, hilos: hilosAbiertos, escritorio: () => carpetasDelEscritorio(ahora) },
    mails: datos.mails, pasos: hechos, hallazgos: datos.hallazgos,
  });
  const aviso = avisos.length ? ` · no se pudo leer: ${avisos.join('; ')}` : '';
  const fecha = fechaEscrita(ahora);
  if (simular) {
    if (!entradas.length) return { detalle: `0 entradas: no llamaria al modelo (simulado)${aviso}`, datos: [] };
    const est = estimarUsd('sonnet', { entrada: tokensAprox(SYSTEM_PRIORIDADES) + tokensAprox(armarPedidoPrioridades(entradas, { fecha }).usuario), salida: 2500 });
    return { detalle: `${entradas.length} entradas para ordenar (simulado, ~${usd(est)})${aviso}`, datos: [] };
  }
  const r = await generarPrioridades({ entradas, fecha, llamarModelo: (opciones) => llamar(cliente, opciones) });
  escribirSeguro(RUTA_PRIORIDADES, textoPrioridades({ renglones: r.renglones, descartados: r.descartados, fecha: selloLocal(ahora).slice(0, 16), avisos }));
  datos.prioridades = r.renglones;
  return { detalle: `${r.detalle}${aviso}`, costoUsd: r.costoUsd, datos: r.renglones };
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 4: novedades de Claude
// ─────────────────────────────────────────────────────────────────────────────

const listados = () => {
  try {
    return fs.readdirSync(DIR_NOVEDADES).filter((f) => /^novedades_.*\.md$/.test(f))
      .map((f) => ({ f, ms: fs.statSync(path.join(DIR_NOVEDADES, f)).mtimeMs }))
      .sort((a, b) => b.ms - a.ms);
  } catch { return []; }
};

/** Los listados de los ultimos 7 dias con su texto (para el resumen largo del lunes). */
const listadosDeLaSemana = (ahoraMs) => listados()
  .filter((x) => x.ms >= ahoraMs - 7 * 86400000).slice(0, 12)
  .map((x) => ({ f: x.f, ms: x.ms, texto: fs.readFileSync(path.join(DIR_NOVEDADES, x.f), 'utf8') }));

async function pasoNovedades({ cliente, simular, ahora }) {
  const aviso = avisoHook(leerJson(path.join(DIR_NOVEDADES, '_estado.json')) || {}, ahora);
  const largo = tocaNovedades(ahora, aviso);
  if (simular) {
    return { detalle: `correria _novedadesClaude.mjs y, si trae algo nuevo, un resumen ${largo ? 'largo con Sonnet (la semana)' : 'corto con Haiku (lo de hoy)'} (simulado)` };
  }
  const desde = Date.now() - 1000;
  const r = spawnSync(process.execPath, [path.join(AQUI, '_novedadesClaude.mjs')], { encoding: 'utf8', timeout: 10 * 60 * 1000, cwd: RAIZ, windowsHide: true });
  if (r.status !== 0) throw new Error(`_novedadesClaude.mjs salio con ${r.status}: ${String(r.stderr || r.stdout || r.error?.message || '').trim().slice(-200)}`);
  const nuevo = listados().find((x) => x.ms >= desde);
  if (!nuevo) throw new Error('_novedadesClaude.mjs no dejo un listado nuevo: resultado vacio');
  const hoy = fs.readFileSync(path.join(DIR_NOVEDADES, nuevo.f), 'utf8');
  // la lectura corre todos los dias y su estado avanza todos los dias: el listado de hoy trae SOLO lo de hoy;
  // el resumen largo del lunes necesita la semana
  const texto = largo ? juntarListados(listadosDeLaSemana(ahora.getTime()), { ahoraMs: ahora.getTime() }) : hoy;
  const plan = planNovedades(ahora, aviso, !novedadesSinCambios(texto));
  if (plan.accion === 'saltar') return { detalle: 'sin cambios', datos: { listado: nuevo.f } };
  const res = await resumirNovedades({ plan, texto, llamarModelo: (opciones) => llamar(cliente, opciones) });
  const sello = selloLocal(ahora).replace(/[: ]/g, '').replace(/-/g, '').slice(0, 12);
  const ruta = path.join(DIR_NOVEDADES, `resumen_${sello}.md`);
  escribirSeguro(ruta, `# Novedades de Claude — resumen ${plan.largo ? 'de la semana' : 'de hoy'} (${selloLocal(ahora).slice(0, 16)})\n\nDe ${nuevo.f}${plan.largo ? ' y los listados de los ultimos 7 dias' : ''}. Para la sesion de la manana: se cruza con lo que ya tenemos antes de proponerle algo a Fak; nada se aplica solo.\n\n${res.resumen}\n`);
  const renglones = res.resumen.split(/\r?\n/).filter((l) => l.trim().startsWith('-')).length;
  return { detalle: `${renglones} renglon(es) en ${path.basename(ruta)} (${res.modelo})`, costoUsd: res.costoUsd, datos: { listado: nuevo.f, resumen: ruta } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pasos 5 a 7: los semanales (vigilante de precios, propuestas de skills, prueba de disparo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El registro de la ultima corrida COMPLETA de cada semanal (.claude/state, ignorado por git). Lo escribe solo la
 * noche, y solo cuando el paso salio completo (`corridaCompleta`): una corrida que fallo o salio a medias no se
 * anota y la noche siguiente la reintenta. Una corrida a mano de los scripts sueltos no cuenta.
 */
export const RUTA_SEMANAL = path.join(RAIZ, '.claude', 'state', 'nocturno-semanal.json');

/**
 * Envuelve un paso semanal: si su ultima corrida completa tiene menos de 7 dias queda 'saltado' (salvo --solo ese
 * paso). `correr` devuelve { detalle, costoUsd, datos, completa }; con `completa` (y sin simular) se anota la fecha.
 */
export function semanal(nombre, { solo, ahora, simular, ruta = RUTA_SEMANAL }, correr) {
  return async () => {
    const ultima = ultimaCorrida(nombre, leerJson(ruta));
    const t = tocaSemanal(ultima, ahora);
    if (!t.toca && solo !== nombre) return { saltado: true, detalle: `no toca: la última completa fue hace ${t.dias} día${t.dias === 1 ? '' : 's'} (${ultima})` };
    const r = await correr();
    if (r?.completa && !simular) {
      escribirSeguro(ruta, `${JSON.stringify(anotarCorrida(leerJson(ruta), nombre, selloLocal(ahora).slice(0, 10)), null, 2)}\n`);
    } else if (!simular) {
      r.detalle = `${r.detalle} · incompleta: se reintenta la próxima noche`;
    }
    return r;
  };
}

async function pasoVigilante({ simular, ahora }) {
  // simulando usa las paginas guardadas y no escribe nada; de verdad baja las tres paginas y guarda su JSON
  const r = await correrVigilante({ simular, guardar: !simular, ahora });
  return { detalle: `${detalleVigilante(r)}${simular ? ' (simulado, páginas guardadas)' : ''}`, datos: { json: r.rutaJson ?? null, diferencias: r.diferencias?.length ?? 0 }, completa: corridaCompleta('vigilante', r) };
}

async function pasoPropuestas({ cliente, simular, ahora, transcripts }) {
  const r = await correrPropuestas({ simular, cliente, transcripts: await transcripts(), ahora });
  if (simular) return { detalle: `${r.resumen.linea.replace(/^simulado: /, '')} (simulado, ~${usd(r.estimadoUsd.probable)} probable)` };
  const s = r.resumen;
  if (s.errores && !s.revisados) throw Object.assign(new Error(`los ${s.errores} skills a revisar dieron error (ver ${s.dir})`), { costoUsd: s.costoUsd });
  return { detalle: `${s.propuestas} para verificar de ${s.revisados} revisado${s.revisados === 1 ? '' : 's'}${s.errores ? ` · ${s.errores} con error` : ''}`, costoUsd: s.costoUsd, datos: { dir: s.dir }, completa: corridaCompleta('propuestas', r) };
}

async function pasoDisparo({ cliente, simular, ahora, transcripts }) {
  const r = await correrDisparo({ simular, cliente, transcripts: await transcripts(), ahora });
  if (simular) return { detalle: `${r.resumen.linea.replace(/^simulado: /, '')} (simulado)` };
  const s = r.resumen;
  const pct = s.mensajes ? Math.round((s.exactos / s.mensajes) * 100) : 0;
  return { detalle: `${pct} % coincide en ${s.mensajes} mensajes · ${s.peores.length} descriptions a mirar`, costoUsd: s.costoUsd, datos: { archivo: s.archivo }, completa: corridaCompleta('disparo', r) };
}

// ─────────────────────────────────────────────────────────────────────────────
// La noche
// ─────────────────────────────────────────────────────────────────────────────

function guardarEstado(estado) {
  escribirSeguro(RUTA_ESTADO, `${JSON.stringify(estado, null, 2)}\n`);
  agregarSeguro(RUTA_LOG, `${selloLocal()}  ${estado.lineaTablero}\n`);
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

  const datos = { hallazgos: null, reporte: null, mails: [], resumenNovedades: null, prioridades: null, semanales: {} };
  const hechos = [];                         // los pasos ya terminados: el de prioridades mira lo que dejaron
  // propuestas y disparo leen los mismos transcripts (~40 s): una sola lectura, y solo si alguno toca
  let lectura = null;
  const transcripts = () => (lectura ??= leerTranscripts({ ahora: inicio, desde: new Date(inicio.getTime() - 90 * 86400e3), tope: 20000 }));
  const ctxSemanal = { solo, ahora: inicio, simular };
  const guardarSemanal = (nombre) => (r) => { if (r?.datos) datos.semanales[nombre] = r.datos; return r; };
  const pasos = await correrPasos([
    {
      nombre: 'preauditoria',
      correr: async () => {
        // el tope por corrida tambien ADENTRO de la pasada (cola H18): es el primer paso, lo gastado hasta aca es 0
        const r = await correrPreauditoria({ simular, cliente, ahora: inicio, max: TOPE_AMFE_POR_NOCHE, topeUsd: sinTope ? null : topeCorridaUsd() });
        if (simular) return { detalle: r.linea };
        datos.hallazgos = { revisados: r.revisados, saltados: r.saltados, diferidos: r.diferidos, porTope: r.porTope ?? 0, total: r.hallazgos, nuevos: r.nuevos, errores: r.errores };
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
      nombre: 'prioridades',
      correr: () => pasoPrioridades({ cliente, simular, ahora: inicio, hechos, datos }),
    },
    {
      nombre: 'novedades',
      correr: async () => { const r = await pasoNovedades({ cliente, simular, ahora: inicio }); datos.resumenNovedades = r.datos?.resumen ?? null; return r; },
    },
    { nombre: 'vigilante', correr: semanal('vigilante', ctxSemanal, () => pasoVigilante({ simular, ahora: inicio }).then(guardarSemanal('vigilante'))) },
    { nombre: 'propuestas', correr: semanal('propuestas', ctxSemanal, () => pasoPropuestas({ cliente, simular, ahora: inicio, transcripts }).then(guardarSemanal('propuestas'))) },
    { nombre: 'disparo', correr: semanal('disparo', ctxSemanal, () => pasoDisparo({ cliente, simular, ahora: inicio, transcripts }).then(guardarSemanal('disparo'))) },
  ], {
    solo,
    topeCorridaUsd: sinTope ? null : topeCorridaUsd(),
    alTerminar: (p) => {
      hechos.push(p);
      console.log(`[${p.estado}] ${p.nombre}: ${p.detalle}${p.costoUsd ? ` (${usd(p.costoUsd)})` : ''}`);
    },
  });

  const estado = armarEstado({ inicio, fin: new Date(), pasos, presupuesto: presupuestoDelMes(), ...datos });
  if (simular) {
    console.log(`${estado.lineaTablero}\n(simulado: no se gasto ni se guardo nada${clave ? '' : '; sin clave, los tokens son aproximados'})`);
  } else {
    guardarEstado(estado);
    console.log(estado.lineaTablero);
    if (datos.reporte) console.log(`Reporte de la pre-auditoria (para la sesion de la manana): ${datos.reporte}`);
    if (datos.prioridades) console.log(`Prioridades sugeridas (para la sesion de la manana): ${path.relative(RAIZ, RUTA_PRIORIDADES)}`);
  }
  if (estado.corte) console.log(`La noche se corto sola: ${estado.corte.detalle}.`);
  return pasos.some((p) => p.estado === 'error' || p.corte) ? 1 : 0;
}

function mostrarEstado() {
  const e = leerJson(RUTA_ESTADO);
  if (!e) { console.log(`No hay noche registrada (${path.relative(RAIZ, RUTA_ESTADO)} no existe).`); return 0; }
  const h = edadHoras(e);
  console.log(e.lineaTablero);
  console.log(`de hace ${h ?? '?'} h${h != null && h > 26 ? ' — VIEJO: la ultima noche no corrio o fallo antes de escribir' : ''}`);
  if (e.corte) console.log(`  SE CORTO SOLA: ${e.corte.detalle}`);
  for (const p of e.pasos || []) console.log(`  [${p.estado}] ${p.nombre}: ${p.detalle}`);
  for (const m of e.mails || []) console.log(`  mail [${m.area}] ${m.asunto} — ${m.linea}`);
  (e.prioridades || []).forEach((r, i) => console.log(`  prioridad ${lineaRenglon(r, i)}`));
  if (e.reporte) console.log(`  reporte: ${e.reporte}`);
  for (const [n, d] of Object.entries(e.semanales || {})) console.log(`  ${n}: ${d.json || d.dir || d.archivo || '-'}`);
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

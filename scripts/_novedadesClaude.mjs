/**
 * _novedadesClaude.mjs — trae lo NUEVO que publicaron las cuentas que Fak sigue sobre Claude Code y lo nuevo del
 * registro de cambios oficial, y lo deja listado para leer. No decide nada y no toca nada del sistema.
 *
 * Pedido de Fak, 04/10/2026: "siempre dicen che, usa esto, mejora aquello... ¿necesitas mi usuario de X o vos mismo
 * podes leer los tweets?". No hace falta su usuario: la lista sale de la busqueda publica de FxTwitter (un servicio
 * de terceros que lee X sin sesion) y del CHANGELOG oficial en GitHub. Si la busqueda deja de andar, lo dice.
 *
 * Uso:
 *   node scripts/_novedadesClaude.mjs                 lo nuevo desde la ultima lectura (la primera vez, 8 dias)
 *   node scripts/_novedadesClaude.mjs --dias 30       lo de los ultimos 30 dias
 *   node scripts/_novedadesClaude.mjs --desde 2026-09-01
 *   node scripts/_novedadesClaude.mjs --cuenta trq212 solo esa cuenta
 *   node scripts/_novedadesClaude.mjs --simular       lee y muestra el resumen, sin guardar nada
 *   node scripts/_novedadesClaude.mjs --hook          (arranque de sesion) un renglon si paso una semana sin leer; no sale a internet
 *
 * Deja en .sgc-cache/x-seguimiento/ (fuera de git): novedades_<fecha>.md (el listado), crudo/<fecha>_<cuenta>.json
 * y _estado.json (hasta donde se leyo cada cuenta y la ultima version vista). Sale con 1 si no pudo leer NADA.
 * Las cuentas y las direcciones viven en scripts/_lib/novedadesClaude.data.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { urlBusqueda, filtrar, versionesNuevas, listado, aDia, avisoHook, estadoNuevo } from './_lib/novedadesClaude.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, '_lib', 'novedadesClaude.data.json'), 'utf8'));
const DESTINO = process.env.BARACK_NOVEDADES_DIR || path.join(AQUI, '..', '.sgc-cache', 'x-seguimiento');

const CON_VALOR = ['--dias', '--desde', '--cuenta'];
const SIN_VALOR = ['--simular', '--hook'];
const args = process.argv.slice(2);
const op = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (SIN_VALOR.includes(a)) { op[a] = true; continue; }
  if (CON_VALOR.includes(a) && i + 1 < args.length) { op[a] = args[++i]; continue; }
  console.log(`no conozco el argumento ${a}. No hago nada.\nuso: [--dias N | --desde AAAA-MM-DD] [--cuenta <usuario>] [--simular]`);
  process.exit(2);
}

const leerEstado = () => { try { const e = JSON.parse(fs.readFileSync(path.join(DESTINO, '_estado.json'), 'utf8')); return e && typeof e === 'object' ? e : { cuentas: {}, registro: {} }; } catch { return { cuentas: {}, registro: {} }; } };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function traer(url, comoTexto = false) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'barack-novedades/1 (lectura de posteos publicos)' } });
    if (!r.ok) throw new Error(`respondio ${r.status}`);
    return comoTexto ? await r.text() : await r.json();
  } finally { clearTimeout(t); }
}

/** Todas las paginas de una cuenta desde `desde`, hasta el tope de paginas. `tope` = se corto por el tope y quedaba mas. */
async function leerCuenta(usuario, desde) {
  const todos = [];
  let cursor = null;
  let tope = true;
  for (let p = 0; p < CANON.paginas_maximo; p++) {
    const j = await traer(urlBusqueda(CANON.busqueda, usuario, desde, cursor));
    if (!j || j.code !== 200 || !Array.isArray(j.results)) throw new Error(`la busqueda no devolvio una lista (codigo ${j && j.code})`);
    todos.push(...j.results);
    const sig = j.cursor && j.cursor.bottom;
    if (!j.results.length || !sig || sig === cursor) { tope = false; break; }
    cursor = sig;
    await esperar(400);
  }
  return { todos, tope };
}

const ahora = new Date();
const estado = leerEstado();
// --hook (arranque de sesion): solo mira la fecha de la ultima lectura; no sale a internet ni guarda nada
if (op['--hook']) { try { const a = avisoHook(estado, ahora); if (a) console.log(a); } catch { /* el arranque no se frena por esto */ } process.exit(0); }
const cuentas = CANON.cuentas.filter((c) => !op['--cuenta'] || c.usuario.toLowerCase() === String(op['--cuenta']).toLowerCase());
if (!cuentas.length) { console.log(`la cuenta ${op['--cuenta']} no esta en la lista (scripts/_lib/novedadesClaude.data.json)`); process.exit(2); }
if (op['--desde'] && !/^\d{4}-\d{2}-\d{2}$/.test(op['--desde'])) { console.log('--desde va como AAAA-MM-DD'); process.exit(2); }
if (op['--dias'] && !/^\d{1,3}$/.test(op['--dias'])) { console.log('--dias va con un numero de dias'); process.exit(2); }
const pidioRango = !!(op['--desde'] || op['--dias']);
const desdePedido = op['--desde'] || aDia(new Date(ahora.getTime() - Number(op['--dias'] || CANON.dias_por_defecto) * 86400000));

const porCuenta = [];
let leidas = 0;
for (const c of cuentas) {
  const previo = (estado.cuentas || {})[c.usuario] || {};
  // sin rango pedido: desde un dia antes de la ultima lectura (y se descarta lo ya visto por su numero)
  const desde = !pidioRango && previo.leido_hasta ? aDia(new Date(Date.parse(previo.leido_hasta) - 86400000)) : desdePedido;
  try {
    const { todos: crudo, tope } = await leerCuenta(c.usuario, desde);
    const { items, fuera } = filtrar(crudo, c.usuario, { minRespuesta: CANON.me_gusta_minimo_respuesta, ultimoId: pidioRango ? null : previo.ultimo_id || null });
    porCuenta.push({ ...c, desde, items, fuera, crudo, tope });
    leidas++;
  } catch (e) {
    porCuenta.push({ ...c, desde, items: [], fuera: {}, error: String(e && e.message ? e.message : e) });
  }
  await esperar(400);
}

let versiones = [];
let errorRegistro = null;
const ultimaVista = (estado.registro || {}).ultima_version || null;
if (!op['--cuenta']) {
  try { versiones = versionesNuevas(await traer(CANON.registro_de_cambios, true), ultimaVista, { primeraVez: CANON.versiones_primera_vez }); leidas++; }
  catch (e) { errorRegistro = String(e && e.message ? e.message : e); }
}

const cuando = `${aDia(ahora)} ${String(ahora.getUTCHours()).padStart(2, '0')}:${String(ahora.getUTCMinutes()).padStart(2, '0')} UTC`;
const texto = listado({ cuando, desde: desdePedido, porCuenta, versiones, errorRegistro, ultimaVersionVista: ultimaVista });

for (const c of porCuenta) console.log(c.error ? `@${c.usuario}: NO se pudo leer (${c.error})` : `@${c.usuario}: ${c.items.length} para leer desde el ${c.desde} (afuera: ${c.fuera.respuesta_suelta} respuestas sueltas, ${c.fuera.ya_visto} ya vistos)`);
if (!op['--cuenta']) console.log(errorRegistro ? `registro de cambios: NO se pudo leer (${errorRegistro})` : `registro de cambios: ${versiones.length} version(es) nueva(s)${versiones.length ? ` (${versiones[versiones.length - 1].version} a ${versiones[0].version})` : ''}`);

if (op['--simular']) { console.log('(simulado: no se guardo nada)'); process.exit(leidas ? 0 : 1); }
if (!leidas) { console.log('No se pudo leer ninguna fuente: no guardo nada.'); process.exit(1); }

fs.mkdirSync(path.join(DESTINO, 'crudo'), { recursive: true });
const sello = `${aDia(ahora)}_${String(ahora.getUTCHours()).padStart(2, '0')}${String(ahora.getUTCMinutes()).padStart(2, '0')}`;
for (const c of porCuenta) if (!c.error) fs.writeFileSync(path.join(DESTINO, 'crudo', `${sello}_${c.usuario}.json`), JSON.stringify(c.crudo), 'utf8');
const archivo = path.join(DESTINO, `novedades_${sello}.md`);
fs.writeFileSync(archivo, texto, 'utf8');

// el estado avanza solo en lo que se leyo entero, y nunca retrocede (la cuenta la hace estadoNuevo)
for (const c of porCuenta) if (c.tope) console.log(`@${c.usuario}: llego al tope de ${CANON.paginas_maximo} paginas y quedaba mas: esa cuenta no avanza; corre de nuevo con --cuenta ${c.usuario} --desde <una fecha mas cercana>.`);
const nuevo = estadoNuevo(estado, { porCuenta, versiones, errorRegistro, pidioRango, unaSolaCuenta: !!op['--cuenta'], ahora });
if (pidioRango) console.log('(rango pedido: es una consulta; no se movio hasta donde se leyo cada cuenta)');
fs.writeFileSync(path.join(DESTINO, '_estado.json'), `${JSON.stringify(nuevo, null, 2)}\n`, 'utf8');
console.log(`Listado: ${archivo}`);

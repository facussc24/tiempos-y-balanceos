/**
 * _preauditarAmfe.mjs — pre-auditoria de los AMFE vivos con la API de Anthropic (creditos del plan Max).
 *
 * QUE HACE. Lee los AMFE de Supabase con un cliente que SOLO puede leer (candado 2), se queda con los
 * que cambiaron desde la ultima revision, y por cada uno: Sonnet SENALA lo que un ingeniero de proceso
 * miraria dos veces; el codigo descarta lo que no tiene cita textual, lo que habla de un AP=H sin
 * accion (estado valido) y lo repetido; Opus trata de REFUTAR lo que queda. Lo que sobrevive va a un
 * archivo de trabajo para la sesion de Claude de la manana (reports/staging/, fuera de git), que lo
 * verifica contra la fuente antes de decirle una palabra a Fak. Nada se escribe en Supabase.
 * La logica pura vive en scripts/_lib/preauditoriaAmfe.mjs; las reglas, en .claude/rules/api-claude.md.
 *
 * Uso:
 *   node scripts/_preauditarAmfe.mjs                   los AMFE que cambiaron desde la ultima revision, hasta 6 por corrida
 *                                                      (los de updated_at mas viejo primero; el resto queda para la noche siguiente)
 *   node scripts/_preauditarAmfe.mjs --max 3           otro tope por corrida (a mano, con --todos o --amfe no hay tope salvo que se pida)
 *   node scripts/_preauditarAmfe.mjs --simular         no gasta: proyecta, cuenta tokens (o los aproxima, con rango x1,0 a x1,3) y estima el costo
 *   node scripts/_preauditarAmfe.mjs --todos           los 21 enteros, cambien o no
 *   node scripts/_preauditarAmfe.mjs --amfe AMFE-HF-PAT  uno solo
 *   node scripts/_preauditarAmfe.mjs --json            el resultado como JSON (para otro script)
 *
 * Sale con 0 ok · 1 fallo algo (un AMFE con error tambien) · 2 argumento · 3 falta la clave de la API.
 * Lo usa el job nocturno (scripts/_nocturno.mjs) por `correr()`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  crearCliente, leerClave, llamar, contarTokens, estimarUsd, enParalelo, presupuestoDelMes,
  selloLocal, usd, ErrorApi, DIR_API,
} from './_lib/claudeApi.mjs';
import { conectarSoloLectura, leerAmfesVivos } from './_lib/supabaseSoloLectura.mjs';
import { parseData } from './_lib/amfeIo.mjs';
import { escribirSeguro } from './_lib/escrituraSegura.mjs';
import {
  proyectarAmfe, conocidosDelValidador, SYSTEM_REVISOR, armarPedidoRevisor, filtrarHallazgos,
  SYSTEM_REFUTADOR, armarPedidoRefutador, aplicarVeredictos, amfesACorrer, elegirParaNoche, estadoNuevo, marcarNuevos,
  normalizarEstado, tokensAprox, tokensConMargen, armarReporte, lineaResumen, TOPE_AMFE_POR_NOCHE,
} from './_lib/preauditoriaAmfe.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');

/** Estado entre noches (que se reviso con que updated_at, que hallazgos ya se vieron). Fuera de git. */
export const DIR_PREAUDITORIA = process.env.BARACK_PREAUDITORIA_DIR || path.join(DIR_API, 'preauditoria');
/** El reporte de la noche. reports/ esta en .gitignore: cita texto de AMFE y el repo es publico. */
export const DIR_REPORTES = path.join(RAIZ, 'reports', 'staging');

/**
 * Lo que se le pide a cada modelo. `maxTokens` es un TOPE, no un gasto: el pensamiento adaptativo
 * cuenta dentro del tope, y una respuesta cortada es un error (ErrorApi 'truncado'), no un resultado.
 * Con 8000 un AMFE de 25K tokens podia quedar cortado; 16000 es el default sin streaming del SDK.
 */
export const REVISOR = Object.freeze({ modelo: 'sonnet', effort: 'medium', cacheTtl: '5m', maxTokens: 16000, tarea: 'preauditoria:revisor' });
export const REFUTADOR = Object.freeze({ modelo: 'opus', effort: 'high', cacheTtl: '5m', maxTokens: 16000, tarea: 'preauditoria:refutador' });
/** Salida supuesta para estimar con --simular (incluye el pensamiento, que se cobra como salida). */
const SALIDA_SUPUESTA = { revisor: 4000, refutador: 5000 };

const leerJson = (ruta) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return null; } };

/**
 * Alias de la escritura segura (scripts/_lib/escrituraSegura.mjs): a .tmp y renombrar, y SOLO en las
 * carpetas permitidas de la noche. Queda exportado con el nombre viejo para no romper imports.
 */
export const escribirAtomico = escribirSeguro;

const diaCompacto = (ahora) => selloLocal(ahora).slice(0, 10).replace(/-/g, '');

/** Un AMFE: revisor -> filtro de codigo -> refutador (solo si quedo algo) -> marcar lo nuevo. */
async function revisarUno(cliente, fila, estado, { dirLedger }) {
  const r = {
    amfe_number: fila.amfe_number, project_name: fila.project_name, updated_at: fila.updated_at,
    operaciones: null, conocidos: null, propuestos: 0, descartadosCodigo: 0, descartadosRefutador: 0,
    mantenidos: [], costoUsd: 0,
  };
  try {
    const doc = parseData(fila.data);
    if (!doc || typeof doc !== 'object') throw new Error('el campo data no se pudo leer como JSON');
    const proyeccion = proyectarAmfe(doc, { amfeNumber: fila.amfe_number, projectName: fila.project_name });
    r.operaciones = proyeccion.operaciones;
    if (!proyeccion.causas.size) throw new Error('el AMFE no tiene ninguna causa: no hay nada que revisar (y 0 nunca es un resultado)');
    const conocidos = conocidosDelValidador(doc, { amfeNumber: fila.amfe_number, projectName: fila.project_name });
    r.conocidos = conocidos;

    const rev = await llamar(cliente, { ...REVISOR, system: SYSTEM_REVISOR, ...armarPedidoRevisor({ proyeccion, conocidos }), dirLedger });
    r.costoUsd += rev.costoUsd;
    const propuestos = Array.isArray(rev.json?.hallazgos) ? rev.json.hallazgos : [];
    r.propuestos = propuestos.length;
    const { hallazgos } = filtrarHallazgos(propuestos, proyeccion);
    r.descartadosCodigo = propuestos.length - hallazgos.length;
    if (!hallazgos.length) return r;

    const ref = await llamar(cliente, { ...REFUTADOR, system: SYSTEM_REFUTADOR, ...armarPedidoRefutador({ proyeccion, conocidos, hallazgos }), dirLedger });
    r.costoUsd += ref.costoUsd;
    const { mantenidos, descartados } = aplicarVeredictos(hallazgos, ref.json?.veredictos);
    r.descartadosRefutador = descartados.length;
    r.mantenidos = marcarNuevos(fila.amfe_number, mantenidos, estado);
    return r;
  } catch (e) {
    // una respuesta cortada o rechazada igual se cobro: el costo viene adentro del ErrorApi
    r.costoUsd += Number(e?.respuesta?.costoUsd) || 0;
    return { ...r, error: String(e?.message ?? e).slice(0, 400) };
  }
}

/** --simular: lo que costaria, sin gastar. count_tokens es gratis; sin clave se aproxima por caracteres. */
async function estimarUno(cliente, fila) {
  const doc = parseData(fila.data);
  if (!doc || typeof doc !== 'object') return { amfe_number: fila.amfe_number, error: 'el campo data no se pudo leer' };
  const proyeccion = proyectarAmfe(doc, { amfeNumber: fila.amfe_number, projectName: fila.project_name });
  const conocidos = conocidosDelValidador(doc, { amfeNumber: fila.amfe_number, projectName: fila.project_name });
  const pedido = armarPedidoRevisor({ proyeccion, conocidos });
  let tokens = null;
  let medido = false;
  if (cliente) {
    try { tokens = await contarTokens(cliente, { modelo: REVISOR.modelo, system: SYSTEM_REVISOR, usuario: pedido.usuario }); medido = true; } catch { /* se aproxima */ }
  }
  if (tokens == null) tokens = tokensAprox(SYSTEM_REVISOR) + tokensAprox(pedido.usuario);
  // Lo aproximado es un RANGO (x1,0 a x1,3: el tokenizador nuevo da hasta 30 % mas); lo medido con
  // count_tokens ya es el tokenizador real y no se infla.
  const tokensMax = medido ? tokens : tokensConMargen(tokens);
  const revisor = estimarUsd(REVISOR.modelo, { entrada: tokens, salida: SALIDA_SUPUESTA.revisor });
  const refutador = estimarUsd(REFUTADOR.modelo, { entrada: tokens + 1500, salida: SALIDA_SUPUESTA.refutador });
  const revisorMax = estimarUsd(REVISOR.modelo, { entrada: tokensMax, salida: SALIDA_SUPUESTA.revisor });
  const refutadorMax = estimarUsd(REFUTADOR.modelo, { entrada: tokensMax + 1500, salida: SALIDA_SUPUESTA.refutador });
  return {
    amfe_number: fila.amfe_number, operaciones: proyeccion.operaciones, causas: proyeccion.causas.size,
    tokens, tokensMax, medido, revisor, refutador, revisorMax, refutadorMax,
  };
}

/**
 * El nombre del reporte de ESTA corrida. El del dia (PREAUDITORIA_AMFE_AAAAMMDD.md) si todavia no existe;
 * si ya hay uno de otra corrida del mismo dia (la primera pasada completa se reparte en varias corridas
 * por el tope), con la hora: una corrida nueva no pisa los hallazgos de la anterior.
 */
export function rutaReporte(dirReportes, ahora = new Date()) {
  const dia = diaCompacto(ahora);
  const delDia = path.join(dirReportes, `PREAUDITORIA_AMFE_${dia}.md`);
  if (!fs.existsSync(delDia)) return delDia;
  const hora = selloLocal(ahora).slice(11);
  const conHora = path.join(dirReportes, `PREAUDITORIA_AMFE_${dia}_${hora.slice(0, 5).replace(':', '')}.md`);
  if (!fs.existsSync(conHora)) return conHora;
  return path.join(dirReportes, `PREAUDITORIA_AMFE_${dia}_${hora.replace(/:/g, '')}.md`);
}

const redondeo6 = (x) => Math.round(x * 1e6) / 1e6;

/**
 * La pasada entera. Devuelve { revisados, saltados, diferidos, hallazgos, nuevos, errores, costoUsd, reporte, linea }.
 * Con `simular` no escribe nada ni gasta; devuelve ademas `estimacion`.
 * Tira ErrorApi 'sin_clave' si falta la clave (salvo simulando) y un Error con `codigo: 2` si `amfe`
 * no existe.
 *
 * `max` es el tope de AMFE por corrida (la noche pasa TOPE_AMFE_POR_NOCHE): se revisan los de
 * `updated_at` mas viejo y el resto queda `diferido` para la noche siguiente, sin tocar el estado. Con
 * `amfe` (se pidio ese) no hay tope.
 *
 * INCREMENTAL. El estado (`estado.json`) y el reporte se escriben DESPUES DE CADA AMFE, no al final:
 * el envoltorio de Windows corta el proceso a los 55 minutos, y una corrida cortada tiene que conservar
 * lo ya revisado (y ya pagado). Las dos escrituras van juntas y sin `await` en el medio: un AMFE nunca
 * queda marcado como revisado sin que sus hallazgos esten en el reporte.
 */
export async function correr({
  simular = false, todos = false, amfe = null, max = null, cliente = null, sb = null, ahora = new Date(),
  dir = DIR_PREAUDITORIA, dirReportes = DIR_REPORTES, dirLedger = DIR_API, concurrencia = 3, log = () => {},
  topeUsd = null,
} = {}) {
  let api = cliente;
  if (!api && (!simular || leerClave())) api = crearCliente();
  const base = sb ?? await conectarSoloLectura();
  const filas = await leerAmfesVivos(base, { minimo: 1 });
  const rutaEstado = path.join(dir, 'estado.json');
  const estado = normalizarEstado(leerJson(rutaEstado));
  const hayQueRevisar = amfesACorrer(filas, estado, { todos, soloAmfe: amfe });
  if (amfe && !hayQueRevisar.length) {
    const e = new Error(`no encuentro el AMFE "${amfe}" entre los ${filas.length} vivos (${filas.map((f) => f.amfe_number).slice(0, 8).join(', ')}…).`);
    e.codigo = 2;
    throw e;
  }
  // el tope por corrida: los que no entran NO se tocan y vuelven a la lista la noche siguiente
  const { elegidos: aCorrer, diferidos } = elegirParaNoche(hayQueRevisar, estado, { max: amfe ? null : max, todos });
  const porRevisar = new Set(hayQueRevisar.map((f) => f.amfe_number));
  const saltados = amfe ? [] : filas.filter((f) => !porRevisar.has(f.amfe_number));
  log(`${filas.length} AMFE vivos · a revisar: ${aCorrer.length}${diferidos.length ? ` (${diferidos.length} quedan para la proxima noche)` : ''} · sin cambios desde la ultima revision: ${saltados.length}`);

  if (simular) {
    const estimacion = await enParalelo(aCorrer, concurrencia, (f) => estimarUno(api, f));
    const suma = (campo) => estimacion.reduce((s, x) => s + (x[campo] || 0), 0);
    const [revisor, refutador, revisorMax, refutadorMax] = ['revisor', 'refutador', 'revisorMax', 'refutadorMax'].map(suma);
    const nota = diferidos.length ? ` · ${diferidos.length} quedan para la próxima noche` : '';
    return {
      simulado: true, revisados: 0, saltados: saltados.length, diferidos: diferidos.length, hallazgos: 0, nuevos: 0,
      errores: estimacion.filter((x) => x.error).length, costoUsd: 0, reporte: null, estimacion,
      estimadoUsd: { soloRevisor: revisor, probable: revisor + refutador / 2, tope: revisor + refutador },
      // el mismo calculo con +30 % de tokens en lo aproximado (igual al de arriba si todo se midio con count_tokens)
      estimadoMaxUsd: { soloRevisor: revisorMax, probable: revisorMax + refutadorMax / 2, tope: revisorMax + refutadorMax },
      linea: `simulado: ${aCorrer.length} AMFE a revisar · ${usd(revisor)} el revisor · hasta ${usd(revisor + refutador)} si todos pasan al refutador${nota}`,
    };
  }

  // ── la pasada: estado y reporte se guardan AMFE por AMFE ──
  const rutaInforme = rutaReporte(dirReportes, ahora);
  const fecha = selloLocal(ahora).slice(0, 16);
  const hechos = new Array(aCorrer.length);          // en el orden de aCorrer, aunque terminen desordenados
  const porTope = [];                                 // los que no arrancaron porque la pasada ya paso su tope
  let estadoActual = estado;
  const gastado = () => hechos.reduce((s, r) => s + (r?.costoUsd || 0), 0);
  const guardar = () => {
    const parciales = hechos.filter(Boolean);
    escribirSeguro(rutaEstado, `${JSON.stringify(estadoActual, null, 2)}\n`);
    escribirSeguro(rutaInforme, armarReporte({
      fecha, resultados: parciales, saltados, diferidos, porTope, enCurso: aCorrer.length - parciales.length - porTope.length,
      costoUsd: redondeo6(parciales.reduce((s, r) => s + (r.costoUsd || 0), 0)),
      presupuesto: presupuestoDelMes({ dir: dirLedger }), estado: estadoActual,
    }));
  };
  await enParalelo(aCorrer, concurrencia, async (f, i) => {
    // TOPE ADENTRO (09/10/2026, cola H18): la noche mira su tope por corrida solo ENTRE pasos; con 6 AMFE y el
    // refutador Opus, esta pasada sola puede pasarlo. Antes de arrancar cada AMFE se mira lo ya gastado: el que
    // no arranca NO toca el estado y vuelve a la lista la noche siguiente, como un diferido.
    // Lo gastado cuenta solo los AMFE TERMINADOS: con concurrencia 3 los tres primeros arrancan siempre, y lo que se
    // puede pasar es el tope mas hasta 3 AMFE en curso (~$0,35 cada uno con refutador). Es un freno pasivo, como el de la noche.
    if (topeUsd != null && gastado() > topeUsd) {
      porTope.push(f);
      log(`  ${f.amfe_number}: no arranca, la pasada ya gasto ${usd(gastado())} (tope ${usd(topeUsd)})`);
      return null;
    }
    const r = await revisarUno(api, f, estado, { dirLedger });
    log(`  ${f.amfe_number}: ${r.error ? `ERROR ${r.error}` : `${r.mantenidos.length} hallazgo(s) · propuso ${r.propuestos} · ${usd(r.costoUsd)}`}`);
    // sin await de aca hasta guardar(): el resultado, el estado y el reporte quedan o no quedan juntos
    hechos[i] = r;
    if (!r.error) estadoActual = estadoNuevo(estadoActual, [r], { ahora });
    guardar();
    return r;
  });
  // nada que revisar, o todo frenado por el tope: igual queda el estado y el reporte del dia
  if (!aCorrer.length || porTope.length) guardar();

  const resultados = hechos.filter(Boolean);
  const costoUsd = redondeo6(resultados.reduce((s, r) => s + (r.costoUsd || 0), 0));
  const presupuesto = presupuestoDelMes({ dir: dirLedger });
  const errores = resultados.filter((r) => r.error).length;
  const resumen = {
    revisados: resultados.length - errores,
    saltados: saltados.length,
    diferidos: diferidos.length + porTope.length,
    porTope: porTope.length,
    hallazgos: resultados.reduce((s, r) => s + r.mantenidos.length, 0),
    nuevos: resultados.reduce((s, r) => s + r.mantenidos.filter((h) => h.nuevo).length, 0),
    errores,
    costoUsd,
  };
  return { ...resumen, reporte: rutaInforme, linea: lineaResumen(resumen), presupuesto };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const USO = `uso: node scripts/_preauditarAmfe.mjs [--simular] [--todos | --amfe <numero>] [--max <N>] [--json]   (--max por defecto ${TOPE_AMFE_POR_NOCHE}; con --todos o --amfe, sin tope)`;

async function main(argv) {
  const CON_VALOR = ['--amfe', '--max'];
  const SIN_VALOR = ['--simular', '--todos', '--json'];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (SIN_VALOR.includes(a)) { op[a] = true; continue; }
    if (CON_VALOR.includes(a) && i + 1 < argv.length) { op[a] = argv[++i]; continue; }
    console.error(`no conozco el argumento ${a}. No hago nada.\n${USO}`);
    return 2;
  }
  if (op['--todos'] && op['--amfe']) { console.error(`--todos y --amfe juntos no: uno u otro.\n${USO}`); return 2; }
  if (op['--max'] !== undefined && !/^[1-9]\d{0,3}$/.test(op['--max'])) { console.error(`--max va con un numero entero de 1 en adelante, no "${op['--max']}". No hago nada.\n${USO}`); return 2; }
  const comoJson = !!op['--json'];
  // sin --max: el tope de la noche para la pasada incremental; una pasada pedida a mano (--todos, --amfe) va entera
  const max = op['--max'] !== undefined ? Number(op['--max']) : (op['--todos'] || op['--amfe']) ? null : TOPE_AMFE_POR_NOCHE;
  try {
    const r = await correr({
      simular: !!op['--simular'], todos: !!op['--todos'], amfe: op['--amfe'] || null, max,
      log: comoJson ? () => {} : (t) => console.log(t),
    });
    if (comoJson) { console.log(JSON.stringify(r)); return r.errores ? 1 : 0; }
    if (r.simulado) {
      for (const x of r.estimacion) {
        console.log(x.error ? `  ${x.amfe_number}: ${x.error}`
          : `  ${x.amfe_number}: ${x.operaciones} op · ${x.causas} causas · ${x.tokens} tokens${x.medido ? '' : ` (aprox.: hasta ${x.tokensMax} con el tokenizador nuevo)`} · revisor ${usd(x.revisor)} · refutador ${usd(x.refutador)}`);
      }
      const e = r.estimadoUsd;
      const m = r.estimadoMaxUsd;
      console.log(`Estimado: ${usd(e.soloRevisor)} solo el revisor · ${usd(e.probable)} probable · ${usd(e.tope)} tope.`);
      if (m && Math.round(m.tope * 100) !== Math.round(e.tope * 100)) {
        console.log(`Con +30 % de tokens (el tokenizador nuevo, en lo aproximado): ${usd(m.soloRevisor)} solo el revisor · ${usd(m.probable)} probable · ${usd(m.tope)} tope.`);
      }
      if (r.diferidos) console.log(`${r.diferidos} AMFE quedan para la proxima noche (tope --max ${max}).`);
      console.log('(simulado: no se gasto ni se guardo nada)');
      return r.errores ? 1 : 0;
    }
    console.log(r.linea);
    console.log(`Reporte (para la sesion de la manana, no para Fak): ${r.reporte}`);
    if (r.presupuesto) console.log(`${r.presupuesto.ciclo?.texto ?? 'Mes'}: ${usd(r.presupuesto.gastadoUsd)} de ${usd(r.presupuesto.presupuestoUsd)} (${r.presupuesto.semaforo})`);
    return r.errores ? 1 : 0;
  } catch (e) {
    if (e instanceof ErrorApi && e.tipo === 'sin_clave') { console.error(e.message); return 3; }
    if (e?.codigo === 2) { console.error(e.message); return 2; }
    console.error(`La pre-auditoria fallo: ${e?.message ?? e}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  // exitCode y no process.exit: que la salida termine de escribirse; el timer (unref) corta si el
  // cliente de Supabase deja un refresco de sesion vivo.
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; setTimeout(() => process.exit(code), 1500).unref(); });
}

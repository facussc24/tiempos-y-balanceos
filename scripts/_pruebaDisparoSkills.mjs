/**
 * _pruebaDisparoSkills.mjs — la prueba de disparo de los skills, con Haiku 5.5 (creditos del plan Max;
 * propuesta C de `.sgc-cache/investigacion-2026-10-08/R3_api_anthropic_noche_de_claude.md`).
 *
 * QUE HACE. Lee los transcripts de Claude Code (solo lectura) y arma la verdad de terreno: mensajes REALES de
 * Fak y los skills que se cargaron de verdad en el turno de cada uno, mas mensajes de sesiones donde no se
 * cargo ninguno. A Haiku (effort low, esquema, prefijo cacheado con las descriptions de todos los skills) se
 * le dan hasta 200 mensajes en lotes de 25 y dice que skill cargaria o "ninguna". El codigo cuenta por skill
 * aciertos, faltantes (debia cargarse y no) y de mas, y lista las descriptions con peor resultado con los
 * mensajes reales que fallaron. Nada se escribe fuera de `.sgc-cache/api/disparo-skills/`.
 * La logica pura vive en scripts/_lib/disparoSkills.mjs; como leer el resultado, en su cabecera.
 *
 * Uso:
 *   node scripts/_pruebaDisparoSkills.mjs --simular      arma la verdad de terreno y estima el costo, sin llamar
 *   node scripts/_pruebaDisparoSkills.mjs                la prueba entera
 *   node scripts/_pruebaDisparoSkills.mjs --max 100 --dias 60 --solo-repo --json
 *
 * Sale con 0 ok · 1 fallo algo · 2 argumento · 3 falta la clave de la API. Lo usa el job nocturno por `correr()`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  crearCliente, llamar, costoUsd as costoDeUso, enParalelo, selloLocal, usd, ErrorApi, DIR_API,
} from './_lib/claudeApi.mjs';
import { leerTranscripts } from './_lib/transcriptsFak.mjs';
import { RAIZ, escribirEnBase, basesPermitidas, tokensAprox } from './_lib/propuestasSkills.mjs';
import {
  listaDeSkills, armarVerdad, armarSystem, armarSchema, armarPedidoLote, enLotes, interpretarLote, puntuar,
  peoresDescriptions, armarInforme, tokensDeItems, TOPE_MENSAJES, TAMANO_LOTE,
} from './_lib/disparoSkills.mjs';

/** Haiku 5.5, esfuerzo bajo: es volumen barato (`api-claude.md` §2). */
export const DISPARO = Object.freeze({ modelo: 'haiku', effort: 'low', cacheTtl: '5m', maxTokens: 6000, tarea: 'disparo-skills:haiku' });
/** Salida supuesta por lote para estimar (el JSON de 25 ids). */
const SALIDA_SUPUESTA_POR_LOTE = 900;

const redondear = (x) => Math.round(x * 1e6) / 1e6;

/** Lo que costaria la prueba: el primer lote escribe el cache del prefijo, los demas lo leen. */
export function estimarCosto(systemTokens, lotes) {
  let usdTotal = 0;
  lotes.forEach((lote, i) => {
    const uso = { input_tokens: tokensDeItems(lote) + 60, output_tokens: SALIDA_SUPUESTA_POR_LOTE };
    if (i === 0) uso.cache_creation_input_tokens = systemTokens; else uso.cache_read_input_tokens = systemTokens;
    usdTotal += costoDeUso(DISPARO.modelo, uso);
  });
  return redondear(usdTotal);
}

/**
 * La prueba entera. Devuelve { simulado, skills, items, puntaje, peores, costoUsd, resumen, archivo } con
 * `resumen.linea` lista para el tablero. Con `simular` no llama ni escribe. Tira ErrorApi 'sin_clave' si falta
 * la clave (salvo simulando).
 *
 *   max           mensajes de la muestra (200)        dias   dias de transcripts que se leen (90)
 *   soloRepo      sin los skills de ~/.claude/skills  transcripts  { mensajes } ya leidos
 *   cliente       cliente de la API (los tests pasan uno falso)
 */
export async function correr({
  simular = false, max = TOPE_MENSAJES, dias = 90, soloRepo = false, cliente = null, transcripts = null, raiz = RAIZ,
  dirSalida = null, ahora = new Date(), dirLedger = DIR_API, tamanoLote = TAMANO_LOTE, concurrencia = 3, log = () => {},
  dirUsuario = undefined, skills: skillsDados = null,
} = {}) {
  const fecha = selloLocal(ahora).slice(0, 10);
  // sin clave se corta ANTES de leer los transcripts (son ~40 s de lectura)
  const api = simular ? null : (cliente ?? crearCliente());
  const skills = skillsDados ?? listaDeSkills({ raiz, conUsuario: !soloRepo, ...(dirUsuario ? { dirUsuario } : {}) });
  if (!skills.length) throw new Error(`no encuentro ningun skill con description en ${path.join(raiz, '.claude', 'skills')}.`);
  const nombres = skills.map((s) => s.nombre);

  const tr = transcripts ?? await leerTranscripts({ ahora, desde: new Date(new Date(ahora).getTime() - dias * 86400e3), tope: 20000 });
  const verdad = armarVerdad(tr.mensajes ?? [], nombres, { max });
  log(`${skills.length} skills · ${(tr.mensajes ?? []).length} mensajes de Fak en ${dias} dias${tr.archivos != null ? ` (${tr.archivos} archivos)` : ''} · muestra: ${verdad.items.length} (${verdad.items.filter((i) => i.tipo === 'positivo').length} con carga, ${verdad.items.filter((i) => i.tipo === 'ninguna').length} sin carga)`);
  if (!verdad.items.length) throw new Error('la verdad de terreno quedo vacia: no hay mensajes de Fak con o sin carga de skills en los transcripts leidos. Con 0 mensajes la prueba no mide nada.');

  const system = armarSystem(skills);
  const lotes = enLotes(verdad.items, tamanoLote);
  const systemTokens = tokensAprox(system);

  if (simular) {
    const estimadoUsd = estimarCosto(systemTokens, lotes);
    return {
      simulado: true, skills, items: verdad.items, verdad, puntaje: null, peores: [], costoUsd: 0, estimadoUsd, systemTokens, lotes: lotes.length,
      resumen: { mensajes: verdad.items.length, positivos: verdad.items.filter((i) => i.tipo === 'positivo').length, costoUsd: 0, linea: `simulado: ${verdad.items.length} mensajes en ${lotes.length} lotes · ${usd(estimadoUsd)} estimado con Haiku` },
    };
  }

  const schema = armarSchema(nombres);
  let costo = 0;
  const predicciones = new Map();
  const cuentas = { faltaron: 0, repetidos: 0 }; // lo que el modelo hizo mal en la primera vuelta

  const pedirLote = async (lote, tarea) => {
    const r = await llamar(api, { ...DISPARO, tarea, system, usuario: armarPedidoLote(lote), schema, dirLedger, ahora });
    costo += r.costoUsd;
    return interpretarLote(r.json, lote, nombres);
  };
  const juntar = (res, primera = true) => {
    for (const [id, p] of res.predicciones) predicciones.set(id, p);
    if (primera) { cuentas.faltaron += res.faltan.length; cuentas.repetidos += res.repetidos.length; }
  };

  // el primer lote solo: escribe el cache del prefijo; los demas, en paralelo, ya lo leen
  juntar(await pedirLote(lotes[0], DISPARO.tarea));
  const resto = await enParalelo(lotes.slice(1), concurrencia, (lote) => pedirLote(lote, DISPARO.tarea));
  resto.forEach(juntar);

  // lo que el modelo no devolvio (o devolvio repetido) se reintenta UNA vez; si sigue faltando, no se mide
  const pendientes = verdad.items.filter((it) => !predicciones.has(it.id));
  let reintento = false;
  if (pendientes.length) {
    reintento = true;
    for (const lote of enLotes(pendientes, tamanoLote)) juntar(await pedirLote(lote, `${DISPARO.tarea}:reintento`), false);
  }

  const puntaje = puntuar(verdad.items, predicciones, nombres);
  const peores = peoresDescriptions(puntaje, skills);
  costo = redondear(costo);
  const md = armarInforme({
    fecha, verdad, puntaje, peores, skills, costoUsd: costo, modelo: 'Haiku 5.5',
    loteras: { lotes: lotes.length, faltan: cuentas.faltaron, repetidos: cuentas.repetidos, reintento },
  });
  const dirBase = dirSalida ?? process.env.BARACK_DISPARO_DIR ?? path.join(raiz, '.sgc-cache', 'api', 'disparo-skills');
  const archivo = escribirEnBase(dirBase, `${fecha}.md`, md, { permitidos: basesPermitidas({ raiz, variable: 'BARACK_DISPARO_DIR' }) });

  const g = puntaje.global;
  const resumen = {
    mensajes: g.evaluados, positivos: g.positivos, sinRespuesta: g.sinRespuesta,
    exactos: g.exactos, peores: peores.map((p) => p.skill), costoUsd: costo, archivo,
    linea: `disparo de skills: ${g.evaluados} mensajes · ${g.evaluados ? Math.round((g.exactos / g.evaluados) * 100) : 0} % coincide con lo que se cargo · ${peores.length} descriptions a mirar${g.sinRespuesta ? ` · ${g.sinRespuesta} sin respuesta` : ''} · $${costo.toFixed(2)}`,
  };
  return { simulado: false, skills, items: verdad.items, verdad, puntaje, peores, costoUsd: costo, resumen, archivo };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const USO = 'uso: node scripts/_pruebaDisparoSkills.mjs [--simular] [--max <N>] [--dias <N>] [--solo-repo] [--json]';

async function main(argv) {
  const CON_VALOR = ['--max', '--dias'];
  const SIN_VALOR = ['--simular', '--json', '--solo-repo'];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (SIN_VALOR.includes(a)) { op[a] = true; continue; }
    if (CON_VALOR.includes(a) && i + 1 < argv.length) { op[a] = argv[++i]; continue; }
    console.error(`no conozco el argumento ${a}. No hago nada.\n${USO}`);
    return 2;
  }
  const numero = (k, def) => {
    if (op[k] == null) return def;
    const n = Number(op[k]);
    return Number.isInteger(n) && n > 0 ? n : NaN;
  };
  const max = numero('--max', TOPE_MENSAJES);
  const dias = numero('--dias', 90);
  if (Number.isNaN(max) || Number.isNaN(dias)) { console.error(`--max y --dias llevan un numero entero mayor que 0.\n${USO}`); return 2; }
  const comoJson = !!op['--json'];
  try {
    const r = await correr({
      simular: !!op['--simular'], max, dias, soloRepo: !!op['--solo-repo'],
      log: comoJson ? () => {} : (t) => console.log(t),
    });
    if (comoJson) {
      console.log(JSON.stringify({ simulado: r.simulado, items: r.items.length, positivos: r.resumen.positivos, estimadoUsd: r.estimadoUsd ?? null, puntaje: r.puntaje, peores: r.peores, costoUsd: r.costoUsd, resumen: r.resumen }));
      return 0;
    }
    if (r.simulado) {
      const por = {};
      for (const it of r.items) for (const s of (it.etiqueta.length ? it.etiqueta : ['(ninguna)'])) por[s] = (por[s] || 0) + 1;
      console.log(`Verdad de terreno (muestra): ${Object.entries(por).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(' · ')}`);
      console.log(`Descartados: ${Object.entries(r.verdad.descartados).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ') || 'ninguno'} · disponibles: ${r.verdad.disponibles.positivos} con carga, ${r.verdad.disponibles.ningunas} sin carga`);
      console.log(`Prefijo (descriptions de ${r.skills.length} skills): ~${r.systemTokens} tokens · ${r.lotes} lotes de ${TAMANO_LOTE}`);
      console.log(`Estimado: ${usd(r.estimadoUsd)} con Haiku. (simulado: no se llamo a la API ni se escribio nada)`);
      return 0;
    }
    console.log(r.resumen.linea);
    console.log(`Informe (para la sesion de la manana, no para Fak): ${r.archivo}`);
    return 0;
  } catch (e) {
    if (e instanceof ErrorApi && e.tipo === 'sin_clave') { console.error(e.message); return 3; }
    console.error(`La prueba de disparo fallo: ${e?.message ?? e}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; setTimeout(() => process.exit(code), 1500).unref(); });
}

/**
 * _propuestasSkills.mjs — propuestas de mejora para los skills del repo, con la API de Anthropic
 * (creditos del plan Max; propuesta D de `.sgc-cache/investigacion-2026-10-08/R3_api_anthropic_noche_de_claude.md`).
 *
 * QUE HACE. Para cada skill (`.claude/skills/*`, y con --con-usuario tambien `~/.claude/skills`):
 *   1. chequeos SIN modelo: rutas que el SKILL.md nombra y no existen, tamano en KB y tokens, cargas en los
 *      ultimos 30 dias (de los transcripts), description larga o sin palabras de disparo;
 *   2. un dossier de hasta 12 K tokens armado por codigo: el SKILL.md, las ultimas 5 cargas con los 3
 *      mensajes de Fak que siguieron a cada una, y las lineas de las lecciones que lo nombran;
 *   3. un revisor (Sonnet 5.5, medium) propone hasta 4 cambios de una lista cerrada, cada uno con DOS citas
 *      textuales; el codigo descarta lo que no cita bien, trae numeros que el dossier no tiene o llega con el
 *      SKILL.md cambiado; un refutador (Opus 5.5, high) mata lo que choque con una regla de `.claude/rules/`
 *      o sea gusto;
 *   4. lo que sobrevive va a `.sgc-cache/api/propuestas/AAAA-MM-DD/<skill>.md` y a un `_resumen.md`.
 * NUNCA edita un skill: las propuestas son para la sesion de la manana, que las verifica y aplica a mano
 * (regla `mejora-implementada.md`). Solo escribe adentro de la carpeta de propuestas (`escribirEnBase`, que pasa por `escrituraSegura.mjs`).
 * La logica pura vive en scripts/_lib/propuestasSkills.mjs; los candados, en `.claude/rules/api-claude.md`.
 *
 * Uso:
 *   node scripts/_propuestasSkills.mjs --simular            no gasta ni escribe: dossiers, tamanos y estimacion
 *   node scripts/_propuestasSkills.mjs                      los 20 skills mas usados
 *   node scripts/_propuestasSkills.mjs --skill flujogramas  uno solo
 *   node scripts/_propuestasSkills.mjs --max 5 --dias 60 --con-usuario --json
 *
 * Sale con 0 ok · 1 fallo algo (un skill con error tambien) · 2 argumento · 3 falta la clave de la API.
 * Lo usa el job nocturno por `correr()`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  crearCliente, leerClave, llamar, contarTokens, estimarUsd, enParalelo, selloLocal, usd, ErrorApi, DIR_API,
} from './_lib/claudeApi.mjs';
import { leerTranscripts } from './_lib/transcriptsFak.mjs';
import {
  RAIZ, leerSkills, leerFuentesLecciones, leccionesQueNombran, chequearSkill, armarDossier, indiceDeNombres,
  SYSTEM_REVISOR, armarPedidoRevisor, filtrarPropuestas, SYSTEM_REFUTADOR, armarPedidoRefutador, resumenReglas,
  aplicarVeredictos, armarMarkdownSkill, armarResumen, escribirEnBase, basesPermitidas, nombreArchivoSeguro,
  hashTexto, tokensAprox,
} from './_lib/propuestasSkills.mjs';

/** Lo que se le pide a cada modelo. `maxTokens` es un TOPE, no un gasto (una respuesta cortada es un error). */
export const REVISOR = Object.freeze({ modelo: 'sonnet', effort: 'medium', cacheTtl: '5m', maxTokens: 16000, tarea: 'propuestas-skills:revisor' });
export const REFUTADOR = Object.freeze({ modelo: 'opus', effort: 'high', cacheTtl: '5m', maxTokens: 16000, tarea: 'propuestas-skills:refutador' });
/** Salida supuesta para estimar con --simular (incluye el pensamiento, que se cobra como salida). */
const SALIDA_SUPUESTA = { revisor: 3000, refutador: 3000 };
/** De cada diez revisiones, cuantas llegan al refutador (supuesto para la estimacion "probable"). */
const PROBABILIDAD_REFUTADOR = 0.6;
const TOKENS_REGLAS_Y_PROPUESTAS = 2700;

/** Prioridad de revision: lo mas usado primero (cargas en 30 dias, cargas totales, lecciones, tamano). */
export const porPrioridad = (a, b) => (b.chequeo.cargas30 - a.chequeo.cargas30)
  || (b.chequeo.cargasTotal - a.chequeo.cargasTotal)
  || (b.chequeo.lecciones - a.chequeo.lecciones)
  || (b.chequeo.kb - a.chequeo.kb)
  || a.skill.nombre.localeCompare(b.skill.nombre);

const redondear = (x) => Math.round(x * 1e6) / 1e6;

async function estimarUno(cliente, { skill, dossier }) {
  const pedido = armarPedidoRevisor(dossier);
  let tokens = null;
  let medido = false;
  if (cliente) {
    try { tokens = await contarTokens(cliente, { modelo: REVISOR.modelo, system: SYSTEM_REVISOR, usuario: pedido.usuario }); medido = true; } catch { /* se aproxima */ }
  }
  if (tokens == null) tokens = tokensAprox(SYSTEM_REVISOR) + dossier.tokens + 60;
  const revisor = estimarUsd(REVISOR.modelo, { entrada: tokens, salida: SALIDA_SUPUESTA.revisor });
  const refutador = estimarUsd(REFUTADOR.modelo, { entrada: dossier.tokens + TOKENS_REGLAS_Y_PROPUESTAS, salida: SALIDA_SUPUESTA.refutador });
  return { nombre: skill.nombre, tokens, medido, dossierTokens: dossier.tokens, revisor, refutador };
}

/** Un skill: revisor -> filtro de codigo -> refutador (solo si quedo algo) -> hash vuelto a mirar. */
async function revisarUno(api, { skill, dossier }, { reglas, dirLedger, leerHashActual, ahora }) {
  const r = { propuestas: [], descartadas: [], propuestasModelo: 0, costoUsd: 0, error: null };
  try {
    const rev = await llamar(api, { ...REVISOR, system: SYSTEM_REVISOR, ...armarPedidoRevisor(dossier), dirLedger, ahora });
    r.costoUsd += rev.costoUsd;
    const delModelo = Array.isArray(rev.json?.propuestas) ? rev.json.propuestas : [];
    r.propuestasModelo = delModelo.length;
    const filtro = filtrarPropuestas(delModelo, dossier, { hashActual: leerHashActual(skill) });
    r.descartadas.push(...filtro.descartadas);
    if (!filtro.propuestas.length) return r;

    const ref = await llamar(api, { ...REFUTADOR, system: SYSTEM_REFUTADOR, ...armarPedidoRefutador({ dossier, reglas, propuestas: filtro.propuestas }), dirLedger, ahora });
    r.costoUsd += ref.costoUsd;
    const { mantenidas, descartadas } = aplicarVeredictos(filtro.propuestas, ref.json?.veredictos);
    r.descartadas.push(...descartadas);
    // el refutador tarda: si el skill cambio mientras tanto, lo que se propuso ya no es sobre este texto
    if (leerHashActual(skill) !== dossier.hash) {
      r.descartadas.push(...mantenidas.map((p) => ({ ...p, motivo: 'hash_cambio' })));
      return r;
    }
    r.propuestas = mantenidas;
    return r;
  } catch (e) {
    // una respuesta cortada o rechazada igual se cobro: el costo viene adentro del ErrorApi
    r.costoUsd += Number(e?.respuesta?.costoUsd) || 0;
    r.error = String(e?.message ?? e).slice(0, 400);
    return r;
  }
}

/**
 * La pasada entera. Devuelve { skills, propuestas, descartadas, costoUsd, resumen } (y `estimacion` si se
 * simula). Con `simular` no gasta ni escribe nada. Tira ErrorApi 'sin_clave' si falta la clave (salvo
 * simulando) y un Error con `codigo: 2` si `skill` no existe.
 *
 *   skill        el nombre de uno solo
 *   max          cuantos revisa el modelo (los chequeos de codigo corren sobre todos); 20 por defecto
 *   conUsuario   suma ~/.claude/skills
 *   dias         cuantos dias de transcripts se leen (90)
 *   transcripts  { cargas, mensajes } ya leidos (la noche los lee una vez para varias tareas)
 *   cliente      cliente de la API (los tests pasan uno falso)
 */
export async function correr({
  simular = false, skill = null, max = 20, conUsuario = false, dias = 90, cliente = null, transcripts = null,
  raiz = RAIZ, dirSalida = null, ahora = new Date(), dirLedger = DIR_API, concurrencia = 3, log = () => {},
  fuentesLecciones = null, reglas = null, indice = null, existe = fs.existsSync, noEsDeFak = null,
  dirUsuario = undefined, leerHashActual = (s) => { try { return hashTexto(fs.readFileSync(s.ruta, 'utf8')); } catch { return null; } },
} = {}) {
  const fecha = selloLocal(ahora).slice(0, 10);
  // sin clave se corta ANTES de leer los transcripts (son ~40 s de lectura)
  const apiReal = simular ? null : (cliente ?? crearCliente());
  const todos = leerSkills({ raiz, conUsuario, ...(dirUsuario ? { dirUsuario } : {}) });
  if (!todos.length) throw new Error(`no encuentro ningun skill en ${path.join(raiz, '.claude', 'skills')}.`);
  let elegidosPorNombre = null;
  if (skill) {
    elegidosPorNombre = todos.filter((s) => s.nombre.toLowerCase() === String(skill).toLowerCase());
    if (!elegidosPorNombre.length) {
      const e = new Error(`no encuentro el skill "${skill}" entre los ${todos.length} (${todos.map((s) => s.nombre).slice(0, 8).join(', ')}…).`);
      e.codigo = 2;
      throw e;
    }
  }

  const tr = transcripts ?? await leerTranscripts({ ahora, desde: new Date(new Date(ahora).getTime() - dias * 86400e3), tope: 20000 });
  const cargas = tr.cargas ?? [];
  log(`${todos.length} skills · ${cargas.length} cargas en ${dias} dias de transcripts${tr.archivos != null ? ` (${tr.archivos} archivos)` : ''}`);
  const fuentes = fuentesLecciones ?? leerFuentesLecciones({ raiz });
  const idx = indice ?? indiceDeNombres(raiz);

  const trabajo = todos.map((s) => {
    const lecs = leccionesQueNombran(s.nombre, fuentes);
    const chequeo = chequearSkill(s, { raiz, existe, indice: idx, cargas, ahora, lecciones: lecs });
    return { skill: s, lecs, chequeo };
  });

  const aRevisar = (elegidosPorNombre
    ? trabajo.filter((t) => elegidosPorNombre.includes(t.skill))
    : [...trabajo].sort(porPrioridad).slice(0, Math.max(0, max)));
  for (const t of aRevisar) {
    t.dossier = armarDossier({ skill: t.skill, chequeo: t.chequeo, cargas, lecciones: t.lecs, noEsDeFak: noEsDeFak ?? undefined });
  }
  const filaBase = (t) => ({
    nombre: t.skill.nombre, origen: t.skill.origen, kb: t.chequeo.kb, tokens: t.chequeo.tokens, cargas30: t.chequeo.cargas30,
    cargasTotal: t.chequeo.cargasTotal, rutasMuertas: t.chequeo.rutasMuertas.length, descriptionLargo: t.chequeo.descriptionLargo,
    descriptionLarga: t.chequeo.descriptionLarga, sinGatillo: t.chequeo.sinGatillo, avisos: t.chequeo.avisos,
    revisado: false, propuestas: null, descartadas: null, costoUsd: 0, error: null,
  });

  if (simular) {
    let api = cliente;
    if (!api && leerClave()) api = crearCliente();
    const estimacion = await enParalelo(aRevisar, concurrencia, (t) => estimarUno(api, t));
    const revisor = estimacion.reduce((s, x) => s + x.revisor, 0);
    const refutador = estimacion.reduce((s, x) => s + x.refutador, 0);
    const estimadoUsd = {
      soloRevisor: redondear(revisor), probable: redondear(revisor + refutador * PROBABILIDAD_REFUTADOR), tope: redondear(revisor + refutador),
    };
    const filas = trabajo.map((t) => {
      const e = estimacion.find((x) => x.nombre === t.skill.nombre);
      return { ...filaBase(t), dossierTokens: t.dossier?.tokens ?? null, casos: t.dossier?.nCasos ?? null, lecciones: t.lecs.length, recortado: !!t.dossier?.recortado, estimadoUsd: e ? redondear(e.revisor + e.refutador * PROBABILIDAD_REFUTADOR) : null };
    });
    return {
      simulado: true, skills: filas, propuestas: [], descartadas: [], costoUsd: 0, estimacion, estimadoUsd,
      resumen: { skills: todos.length, revisados: 0, propuestas: 0, descartadas: 0, errores: 0, costoUsd: 0, archivos: [], linea: `simulado: ${aRevisar.length} de ${todos.length} skills a revisar · ${usd(revisor)} el revisor · hasta ${usd(revisor + refutador)} si todos pasan al refutador` },
    };
  }

  const api = apiReal;
  const reglasTexto = reglas ?? resumenReglas({ raiz });
  const dirDia = path.join(dirSalida ?? process.env.BARACK_PROPUESTAS_DIR ?? path.join(raiz, '.sgc-cache', 'api', 'propuestas'), fecha);
  const permitidos = basesPermitidas({ raiz });
  const archivos = [];

  const resultados = await enParalelo(aRevisar, concurrencia, async (t) => {
    const r = await revisarUno(api, t, { reglas: reglasTexto, dirLedger, leerHashActual, ahora });
    log(`  ${t.skill.nombre}: ${r.error ? `ERROR ${r.error}` : `${r.propuestas.length} propuesta(s) · propuso ${r.propuestasModelo} · ${usd(r.costoUsd)}`}`);
    try {
      archivos.push(escribirEnBase(dirDia, `${nombreArchivoSeguro(t.skill.nombre)}.md`, armarMarkdownSkill({
        fecha, skill: t.skill, chequeo: t.chequeo, dossier: t.dossier, propuestas: r.propuestas, descartadas: r.descartadas, error: r.error, costoUsd: r.costoUsd,
      }), { permitidos }));
    } catch (e) {
      r.error = r.error || String(e?.message ?? e).slice(0, 400);
    }
    return { t, r };
  });

  const porSkill = new Map(resultados.map(({ t, r }) => [t.skill.nombre, r]));
  const filas = trabajo.map((t) => {
    const r = porSkill.get(t.skill.nombre);
    const f = filaBase(t);
    if (!r) return f;
    return { ...f, revisado: !r.error, propuestas: r.propuestas.length, descartadas: r.descartadas.length, costoUsd: r.costoUsd, error: r.error };
  });
  const costoUsd = redondear(resultados.reduce((s, x) => s + (x.r.costoUsd || 0), 0));
  archivos.push(escribirEnBase(dirDia, '_resumen.md', armarResumen({ fecha, filas, costoUsd }), { permitidos }));

  const propuestas = resultados.flatMap(({ t, r }) => r.propuestas.map((p) => ({ skill: t.skill.nombre, ...p })));
  const descartadas = resultados.flatMap(({ t, r }) => r.descartadas.map((d) => ({ skill: t.skill.nombre, ...d })));
  const errores = resultados.filter((x) => x.r.error).length;
  const resumen = {
    skills: todos.length, revisados: resultados.length - errores, propuestas: propuestas.length, descartadas: descartadas.length, errores, costoUsd, dir: dirDia, archivos,
    linea: `propuestas de skills: ${resultados.length - errores} revisado${resultados.length - errores === 1 ? '' : 's'} de ${todos.length} · ${propuestas.length} propuesta${propuestas.length === 1 ? '' : 's'} para verificar${errores ? ` · ${errores} con error` : ''} · $${costoUsd.toFixed(2)}`,
  };
  return { simulado: false, skills: filas, propuestas, descartadas, costoUsd, resumen };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const USO = 'uso: node scripts/_propuestasSkills.mjs [--simular] [--skill <nombre>] [--max <N>] [--dias <N>] [--con-usuario] [--json]';

async function main(argv) {
  const CON_VALOR = ['--skill', '--max', '--dias'];
  const SIN_VALOR = ['--simular', '--json', '--con-usuario'];
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
  const max = numero('--max', 20);
  const dias = numero('--dias', 90);
  if (Number.isNaN(max) || Number.isNaN(dias)) { console.error(`--max y --dias llevan un numero entero mayor que 0.\n${USO}`); return 2; }
  const comoJson = !!op['--json'];
  try {
    const r = await correr({
      simular: !!op['--simular'], skill: op['--skill'] || null, max, dias, conUsuario: !!op['--con-usuario'],
      log: comoJson ? () => {} : (t) => console.log(t),
    });
    if (comoJson) {
      const { skills, propuestas, descartadas, costoUsd, resumen, estimadoUsd } = r;
      console.log(JSON.stringify({ simulado: r.simulado, skills, propuestas, descartadas, costoUsd, resumen, estimadoUsd }));
      return resumen.errores ? 1 : 0;
    }
    if (r.simulado) {
      for (const f of r.skills.filter((x) => x.dossierTokens != null)) {
        console.log(`  ${f.nombre.padEnd(30)} ${String(f.kb).padStart(5)} KB · dossier ~${f.dossierTokens} tokens${f.recortado ? ' (recortado)' : ''} · casos ${f.casos} · lecciones ${f.lecciones} · ${usd(f.estimadoUsd)}`);
      }
      const avisos = r.skills.filter((x) => x.avisos.length);
      console.log(`Chequeos de codigo (sobre los ${r.skills.length} skills): ${r.skills.filter((x) => x.rutasMuertas).length} con rutas inexistentes · ${r.skills.filter((x) => x.sinGatillo).length} con description sin disparo · ${r.skills.filter((x) => x.descriptionLarga).length} con description de mas de 400 caracteres · ${r.skills.filter((x) => !x.cargasTotal).length} sin cargas en los transcripts · ${avisos.length} con algun aviso.`);
      console.log(`Estimado: ${usd(r.estimadoUsd.soloRevisor)} solo el revisor · ${usd(r.estimadoUsd.probable)} probable · ${usd(r.estimadoUsd.tope)} tope. (simulado: no se gasto ni se escribio nada)`);
      return 0;
    }
    console.log(r.resumen.linea);
    console.log(`Propuestas (para la sesion de la manana, no para Fak): ${r.resumen.dir}`);
    return r.resumen.errores ? 1 : 0;
  } catch (e) {
    if (e instanceof ErrorApi && e.tipo === 'sin_clave') { console.error(e.message); return 3; }
    if (e?.codigo === 2) { console.error(e.message); return 2; }
    console.error(`Las propuestas de skills fallaron: ${e?.message ?? e}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; setTimeout(() => process.exit(code), 1500).unref(); });
}

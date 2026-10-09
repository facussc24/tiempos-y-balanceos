/**
 * disparoSkills.mjs — lo puro de scripts/_pruebaDisparoSkills.mjs: la PRUEBA DE DISPARO de los skills.
 *
 * POR QUE EXISTE (08/10/2026). Un skill solo sirve si se carga cuando hace falta. El 02/10 el skill
 * `explicar-mejor` estaba en la lista y no se cargo (`.claude/rules/mejora-implementada.md`). Probar un skill
 * "de verdad" necesita Claude Code (lanzarlo desde la noche esta prohibido: `api-claude.md` candado 3), pero lo
 * que decide si se carga es la `description`, y eso si se puede medir: a un modelo barato (Haiku) se le da la
 * lista de descriptions y mensajes REALES de Fak, y se compara lo que dice que cargaria con lo que se cargo de
 * verdad en esa sesion.
 *
 * VERDAD DE TERRENO. De los transcripts (transcriptsFak.mjs): cada mensaje real de Fak es un "turno", y los
 * skills que se cargaron DENTRO de ese turno (no despues de un aviso de tarea ni de un hook) son su etiqueta.
 *   - positivos: mensajes cuyo turno cargo uno o mas skills de la lista actual;
 *   - sin carga ("ninguna"): mensajes de una sesion donde todavia no se habia cargado ningun skill y cuyo
 *     turno no cargo ninguno (sin esto, "de mas" no se puede medir);
 *   - se sacan los turnos que cargaron un skill que no esta en la lista (plugins, skills borradas): la
 *     etiqueta es dudosa.
 *
 * COMO LEER EL RESULTADO. "Faltante": el modelo no eligio el skill que se cargo. "De mas": el modelo eligio un
 * skill que en esa sesion NO se cargo. Un "de mas" no es un error del modelo sin mirar: puede ser justo el caso
 * del 02/10 (el skill debia cargarse y no se cargo), o que ya estuviera cargado, o que lo ejecutara un hook y no
 * la description (explicar-mejor se carga porque un hook se lo exige). Y mide la description sola contra los
 * skills locales: la lista real de Claude Code trae tambien los de los plugins.
 *
 * Es codigo puro salvo la lectura de skills y la escritura del informe (`escribirEnBase`). Se prueba en
 * __tests__/scripts/disparoSkills.test.mjs.
 */
import { leerSkills, leerComandos, hashTexto, tokensAprox, normal } from './propuestasSkills.mjs';

export const NINGUNA = 'ninguna';
export const TOPE_MENSAJES = 200;
export const TAMANO_LOTE = 25;
export const MAX_SKILLS_POR_MENSAJE = 2;

// ─────────────────────────────────────────────────────────────────────────────
// La lista de skills que ve el modelo
// ─────────────────────────────────────────────────────────────────────────────

/** Los skills y comandos con su description, sin repetir nombre (gana el del repo): [{ nombre, description, origen }]. */
export function listaDeSkills({ raiz, conUsuario = true, dirUsuario } = {}) {
  const todos = [
    ...leerSkills({ ...(raiz ? { raiz } : {}), conUsuario, ...(dirUsuario ? { dirUsuario } : {}) }),
    ...leerComandos(raiz ? { raiz } : {}),
  ];
  const vistos = new Set();
  const out = [];
  for (const s of todos) {
    const k = s.nombre.toLowerCase();
    if (vistos.has(k) || !s.description) continue;
    vistos.add(k);
    out.push({ nombre: s.nombre, description: s.description.replace(/\s+/g, ' ').trim(), origen: s.origen });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ─────────────────────────────────────────────────────────────────────────────
// La verdad de terreno
// ─────────────────────────────────────────────────────────────────────────────

const corta = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * De los mensajes reales de Fak (con `cargas` y `skillsAntes`, como los entrega transcriptsFak.mjs) arma la
 * muestra de la prueba. Devuelve { items, descartados, disponibles }.
 *   items:    [{ id, fecha, sesion, texto, etiqueta: [skill...], tipo: 'positivo' | 'ninguna' }]
 *   opciones: max (200), proporcionNinguna (0.35: lo minimo de la muestra que son mensajes sin carga), largoMin (15),
 *             largoMax (3000), largoPrompt (1200: lo que se le muestra al modelo de cada mensaje)
 * El muestreo es deterministico (se ordena por el hash del texto), asi dos corridas con los mismos
 * transcripts miden lo mismo.
 */
export function armarVerdad(mensajes, nombresConocidos, {
  max = TOPE_MENSAJES, proporcionNinguna = 0.35, largoMin = 15, largoMax = 3000, largoPrompt = 1200,
} = {}) {
  const conocidos = new Map([...nombresConocidos].map((n) => [String(n).toLowerCase(), String(n)]));
  const descartados = { corto: 0, largo: 0, repetido: 0, skill_desconocido: 0, sesion_con_skills: 0 };
  const vistos = new Set();
  const positivos = [];
  const ningunas = [];
  for (const m of Array.isArray(mensajes) ? mensajes : []) {
    const texto = String(m?.texto ?? '').trim();
    if (texto.length < largoMin) { descartados.corto++; continue; }
    if (texto.length > largoMax) { descartados.largo++; continue; }
    const clave = normal(texto);
    if (vistos.has(clave)) { descartados.repetido++; continue; }
    vistos.add(clave);
    const cargas = [...new Set((m.cargas || []).map((c) => String(c).toLowerCase()))];
    const base = { fecha: m.fecha ?? null, sesion: m.sesion ?? null, texto: corta(texto, largoPrompt) };
    if (cargas.length) {
      if (cargas.some((c) => !conocidos.has(c))) { descartados.skill_desconocido++; continue; }
      positivos.push({ ...base, etiqueta: cargas.map((c) => conocidos.get(c)).sort(), tipo: 'positivo' });
    } else if (!(m.skillsAntes || []).length) {
      ningunas.push({ ...base, etiqueta: [], tipo: 'ninguna' });
    } else {
      descartados.sesion_con_skills++;
    }
  }
  const disponibles = { positivos: positivos.length, ningunas: ningunas.length };

  const porHash = (a, b) => hashTexto(a.texto).localeCompare(hashTexto(b.texto));
  const objetivoNinguna = Math.min(ningunas.length, Math.round(max * proporcionNinguna));
  const objetivoPositivos = Math.max(0, max - objetivoNinguna);

  // los positivos: de a uno por combinacion de etiqueta en cada ronda hasta llegar al objetivo (si no, un
  // skill que se carga mucho, como explicar-mejor, seria el 40 % de la muestra)
  const grupos = new Map();
  for (const p of [...positivos].sort(porHash)) {
    const k = p.etiqueta.join('+');
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  const elegidos = [];
  const colas = [...grupos.values()];
  for (let ronda = 0; elegidos.length < objetivoPositivos && colas.some((c) => c.length > ronda); ronda++) {
    for (const c of colas) {
      if (c.length > ronda && elegidos.length < objetivoPositivos) elegidos.push(c[ronda]);
    }
  }
  // si faltan positivos para el cupo, el resto se llena con mensajes sin carga
  const cupoNinguna = Math.min(ningunas.length, Math.max(objetivoNinguna, max - elegidos.length));
  const sinCarga = [...ningunas].sort(porHash).slice(0, cupoNinguna);

  const items = [...elegidos, ...sinCarga]
    .sort((a, b) => String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')) || hashTexto(a.texto).localeCompare(hashTexto(b.texto)))
    .slice(0, max)
    .map((it, i) => ({ id: i + 1, ...it }));
  return { items, descartados, disponibles };
}

// ─────────────────────────────────────────────────────────────────────────────
// El pedido a Haiku
// ─────────────────────────────────────────────────────────────────────────────

/** El prefijo estable (cacheable): la regla y la lista de skills con su description. */
export function armarSystem(skills) {
  const lista = skills.map((s) => `- ${s.nombre}: ${s.description}`).join('\n');
  return `Sos el selector de skills de un asistente de Claude Code en Barack Mercosul, una autopartista argentina (tapizado, espumado, corte, costura, inyeccion). El asistente trabaja con Fak, de Ingenieria. Un skill es un conjunto de instrucciones que el asistente carga ANTES de contestar cuando la description del skill calza con lo que se le pide. Te paso la lista de skills con su description y, despues, mensajes reales que Fak le escribio al asistente. Para cada mensaje decidi que skills cargaria el asistente, mirando SOLO el mensaje y las descriptions.

REGLAS:
- Elegi un skill solo si su description calza con lo que el mensaje pide hacer. Si el mensaje es una pregunta suelta, una respuesta corta, una charla o no calza con ningun skill, contesta "${NINGUNA}".
- Como mucho ${MAX_SKILLS_POR_MENSAJE} skills por mensaje. Si elegis alguno, no pongas "${NINGUNA}".
- No tenes la conversacion anterior: decidi con lo que dice el mensaje. No supongas lo que no esta escrito.
- Devolve un resultado por cada mensaje, con su id, una sola vez cada uno.

SKILLS DISPONIBLES (nombre: description):
${lista}`;
}

/** El esquema: un resultado por id, con los skills elegidos (de la lista cerrada) o "ninguna". */
export function armarSchema(nombres) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['respuestas'],
    properties: {
      respuestas: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'skills'],
          properties: {
            id: { type: 'integer', description: 'el id del mensaje' },
            skills: { type: 'array', items: { type: 'string', enum: [...nombres, NINGUNA] } },
          },
        },
      },
    },
  };
}

/** El mensaje de usuario de un lote: cada mensaje con su id. */
export function armarPedidoLote(lote) {
  const cuerpo = lote.map((it) => `<mensaje id="${it.id}">\n${it.texto}\n</mensaje>`).join('\n');
  return `Mensajes de Fak (decidi que skills cargaria el asistente para cada uno):\n\n${cuerpo}\n\nDevolve el JSON.`;
}

/** Parte la muestra en lotes de `tamano`. */
export function enLotes(items, tamano = TAMANO_LOTE) {
  const out = [];
  for (let i = 0; i < items.length; i += tamano) out.push(items.slice(i, i + tamano));
  return out;
}

/**
 * Lo que contesto el modelo para un lote. Cada id tiene que volver UNA vez: un id que falta o que viene
 * repetido NO se cuenta como "ninguna" (inflaria los faltantes): queda en `faltan` / `repetidos`.
 * Devuelve { predicciones: Map(id -> [skills]), faltan: [ids], repetidos: [ids], ajenos: [ids] }.
 */
export function interpretarLote(json, lote, nombresValidos) {
  const validos = new Set([...nombresValidos].map((n) => String(n)));
  const idsLote = new Set(lote.map((it) => it.id));
  const cuenta = new Map();
  const ultimo = new Map();
  const ajenos = [];
  for (const r of Array.isArray(json?.respuestas) ? json.respuestas : []) {
    if (!r || !Number.isInteger(r.id)) continue;
    if (!idsLote.has(r.id)) { ajenos.push(r.id); continue; }
    cuenta.set(r.id, (cuenta.get(r.id) || 0) + 1);
    ultimo.set(r.id, r);
  }
  const predicciones = new Map();
  const faltan = [];
  const repetidos = [];
  for (const it of lote) {
    const n = cuenta.get(it.id) || 0;
    if (n === 0) { faltan.push(it.id); continue; }
    if (n > 1) { repetidos.push(it.id); continue; }
    const crudos = Array.isArray(ultimo.get(it.id).skills) ? ultimo.get(it.id).skills.map(String) : [];
    const elegidos = [...new Set(crudos.filter((s) => validos.has(s)))].slice(0, MAX_SKILLS_POR_MENSAJE);
    predicciones.set(it.id, elegidos);
  }
  return { predicciones, faltan, repetidos, ajenos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Puntaje
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aciertos, faltantes y de mas, por skill y en total. `predicciones` es Map(id -> [skills]) o un objeto
 * { id: [skills] }; un mensaje sin prediccion no se mide (queda en `sinRespuesta`).
 * Por skill:  debia (cuantos mensajes lo cargaron de verdad), aciertos (el modelo tambien lo eligio),
 *             faltantes (debia y no lo eligio), demas (lo eligio y esa sesion no lo cargo),
 *             precision = aciertos / (aciertos + demas), recall = aciertos / debia (null si no se puede calcular).
 */
export function puntuar(items, predicciones, nombres) {
  const pred = predicciones instanceof Map ? predicciones : new Map(Object.entries(predicciones || {}).map(([k, v]) => [Number(k), v]));
  const porSkill = new Map([...nombres].map((n) => [n, { skill: n, debia: 0, aciertos: 0, faltantes: 0, demas: 0 }]));
  const filaDe = (n) => { if (!porSkill.has(n)) porSkill.set(n, { skill: n, debia: 0, aciertos: 0, faltantes: 0, demas: 0 }); return porSkill.get(n); };
  const global = { evaluados: 0, sinRespuesta: 0, exactos: 0, positivos: 0, positivosExactos: 0, ningunas: 0, ningunasBien: 0 };
  const errores = [];
  for (const it of items) {
    const p = pred.get(it.id);
    if (!p) { global.sinRespuesta++; continue; }
    global.evaluados++;
    const elegidos = p.filter((s) => s !== NINGUNA);
    const debia = new Set(it.etiqueta);
    const eligio = new Set(elegidos);
    for (const s of debia) { const f = filaDe(s); f.debia++; if (eligio.has(s)) f.aciertos++; else f.faltantes++; }
    for (const s of eligio) if (!debia.has(s)) filaDe(s).demas++;
    const exacto = debia.size === eligio.size && [...debia].every((s) => eligio.has(s));
    if (exacto) global.exactos++;
    if (it.tipo === 'positivo') { global.positivos++; if (exacto) global.positivosExactos++; } else { global.ningunas++; if (exacto) global.ningunasBien++; }
    if (!exacto) errores.push({ id: it.id, texto: it.texto, debia: [...debia], eligio: [...eligio], tipo: it.tipo });
  }
  const filas = [...porSkill.values()].map((f) => ({
    ...f,
    precision: f.aciertos + f.demas > 0 ? f.aciertos / (f.aciertos + f.demas) : null,
    recall: f.debia > 0 ? f.aciertos / f.debia : null,
  }));
  return { filas, global, errores };
}

/** Los skills con peor resultado (mas faltantes + de mas), con los mensajes que fallaron. */
export function peoresDescriptions(puntaje, skills, { top = 8, ejemplos = 3 } = {}) {
  const descr = new Map(skills.map((s) => [s.nombre, s.description]));
  return puntaje.filas
    .filter((f) => f.faltantes + f.demas > 0)
    .sort((a, b) => (b.faltantes + b.demas) - (a.faltantes + a.demas) || (a.recall ?? 1) - (b.recall ?? 1) || a.skill.localeCompare(b.skill))
    .slice(0, top)
    .map((f) => ({
      ...f,
      description: descr.get(f.skill) ?? '',
      faltaron: puntaje.errores.filter((e) => e.debia.includes(f.skill) && !e.eligio.includes(f.skill)).slice(0, ejemplos),
      sobraron: puntaje.errores.filter((e) => e.eligio.includes(f.skill) && !e.debia.includes(f.skill)).slice(0, ejemplos),
    }));
}

const pct = (x) => (x == null ? '-' : `${Math.round(x * 100)} %`);
const lista = (a) => (a.length ? a.join(' + ') : NINGUNA);

/** El informe para la sesion de la manana. */
export function armarInforme({ fecha, verdad, puntaje, peores, skills, costoUsd = 0, loteras = null, modelo = 'haiku' }) {
  const L = [];
  const g = puntaje.global;
  L.push(`# Prueba de disparo de skills — ${fecha}`, '');
  L.push('**Para la sesión de Claude de la mañana, no para Fak.** Mide si la `description` de cada skill hace que se cargue con los mensajes REALES de Fak: se le da la lista de descriptions a un modelo barato (Haiku) y se compara lo que dice que cargaría con lo que se cargó de verdad en esa sesión.', '');
  L.push('Cómo leerlo:');
  L.push('- **Faltante**: el skill se cargó de verdad en ese turno y el modelo no lo eligió con la description sola. Candidata a mejorar la description.');
  L.push('- **De más**: el modelo eligió un skill que en esa sesión no se cargó. No es un error del modelo sin mirar: puede ser justo el caso del 02/10 (debía cargarse y no se cargó, `mejora-implementada.md`), o que ya estuviera cargado, o que lo ejecute un hook y no la description (`explicar-mejor`).');
  L.push('- Mide la description contra los skills locales; la lista real de Claude Code trae también los de los plugins. Cada mensaje se juzga solo, sin la conversación anterior. Es una candidata, no un veredicto.', '');
  L.push(`- mensajes evaluados: ${g.evaluados} (${g.positivos} con carga, ${g.ningunas} sin carga)${g.sinRespuesta ? ` · sin respuesta del modelo: ${g.sinRespuesta} (no cuentan)` : ''}`);
  L.push(`- coincidencia exacta con lo que se cargó: ${g.evaluados ? Math.round((g.exactos / g.evaluados) * 100) : 0} % (con carga: ${g.positivos ? Math.round((g.positivosExactos / g.positivos) * 100) : 0} % · sin carga: ${g.ningunas ? Math.round((g.ningunasBien / g.ningunas) * 100) : 0} %)`);
  L.push(`- muestra: ${verdad.items.length} de ${verdad.disponibles.positivos} mensajes con carga y ${verdad.disponibles.ningunas} sin carga disponibles · modelo ${modelo} · costo $${Number(costoUsd).toFixed(2)}`, '');
  L.push('## Por skill', '');
  L.push('| skill | debía cargarse | acertó | faltante | de más | precisión | recall |');
  L.push('|---|---|---|---|---|---|---|');
  for (const f of [...puntaje.filas].filter((x) => x.debia || x.demas).sort((a, b) => (b.debia + b.demas) - (a.debia + a.demas) || a.skill.localeCompare(b.skill))) {
    L.push(`| ${f.skill} | ${f.debia} | ${f.aciertos} | ${f.faltantes} | ${f.demas} | ${pct(f.precision)} | ${pct(f.recall)} |`);
  }
  const sinDatos = puntaje.filas.filter((x) => !x.debia && !x.demas).map((x) => x.skill);
  if (sinDatos.length) L.push('', `Sin mensajes en la muestra que los cargaran ni modelo que los eligiera (${sinDatos.length}): ${sinDatos.join(', ')}.`);
  L.push('', '## Descriptions con peor resultado', '');
  if (!peores.length) L.push('Ninguna: el modelo coincidió con lo que se cargó en toda la muestra.', '');
  for (const p of peores) {
    L.push(`### ${p.skill} — ${p.faltantes} faltante${p.faltantes === 1 ? '' : 's'}, ${p.demas} de más`);
    L.push(`description actual: "${corta(p.description, 500)}"`);
    for (const e of p.faltaron) L.push(`- FALTANTE: "${corta(e.texto, 300)}" → el modelo eligió: ${lista(e.eligio)}`);
    for (const e of p.sobraron) L.push(`- DE MÁS: "${corta(e.texto, 300)}" → en esa sesión se cargó: ${lista(e.debia)}`);
    L.push('');
  }
  if (loteras) L.push(`_(lotes: ${loteras.lotes} · ids que el modelo no devolvió: ${loteras.faltan} · repetidos: ${loteras.repetidos} · reintento: ${loteras.reintento ? 'sí' : 'no'})_`);
  return `${L.join('\n').trimEnd()}\n`;
}

/** Tokens aproximados de la muestra, para estimar. */
export const tokensDeItems = (items) => items.reduce((s, it) => s + tokensAprox(it.texto) + 12, 0);

/**
 * nocturno.mjs — lo puro de scripts/_nocturno.mjs: la noche de Claude que gasta los creditos de la
 * API del plan Max en trabajo util mientras la notebook no se usa.
 *
 * LO QUE APRENDIMOS ANTES (y por que esto tiene esta forma). La auto-mejora nocturna anterior se
 * APAGO el 04/08/2026: 0 auditorias exitosas en 280.370 lineas de log, 47.522 timeouts y un fork
 * bomb de `claude -p`. Por eso la noche nueva es un `node` suelto que habla con la API por el SDK:
 *   - nunca lanza `claude -p` ni procesos en cadena; los pasos corren uno detras del otro;
 *   - cada paso es independiente: el que falla queda como 'error' con su detalle y los demas siguen;
 *   - ningun paso deja un archivo a medias (se escribe a .tmp y se renombra);
 *   - "resultado vacio" es error, no exito: el envoltorio .ps1 lo verifica mirando el estado;
 *   - no toca el repo, ni Supabase (solo lectura), ni el arb, ni Outlook: lo prueba
 *     __tests__/scripts/candadosNocturno.test.mjs leyendo el texto de estos archivos.
 *
 * El entregable de la noche es un archivo de TRABAJO para la sesion de la manana
 * (.claude/state/nocturno.json + reports/staging/), nunca un informe para Fak.
 */

export const NOMBRE_TAREA = 'Barack - Noche de Claude (API)';
export const HORA_TAREA = '06:30';
/**
 * El orden en que corren. `--solo <paso>` acepta uno de estos. Los cuatro primeros corren todas las noches;
 * los tres ultimos (PASOS_SEMANALES) una vez por semana y al final, para que una corrida cortada ya haya hecho
 * lo diario.
 */
export const PASOS = Object.freeze(['datos', 'preauditoria', 'mails', 'prioridades', 'novedades', 'vigilante', 'propuestas', 'disparo']);
/**
 * `datos` (10/10/2026, etapa 1 de P55): la copia de Supabase en la biblioteca de Ingenieria. Va PRIMERO porque
 * no usa modelo ni gasta, y asi una noche cortada por tiempo o por el tope igual la deja al dia. Corre como
 * proceso aparte (`_datosSincronizar.mjs --aplicar`): lee Supabase y escribe archivos en la biblioteca, que
 * esta fuera de las carpetas de `escrituraSegura`. La noche solo lee su codigo de salida y su linea.
 */
export function leerSalidaDatos(stdout) {
  const ultima = String(stdout ?? '').trim().split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'));
  if (!ultima) return null;
  try { const j = JSON.parse(ultima); return j && typeof j === 'object' ? j : null; } catch { return null; }
}
/**
 * Los pasos semanales (09/10/2026, cola H15; frecuencia de R3 §2: vigilante ~$0, propuestas de skills ~$2-2,5,
 * disparo ~$0,01). Cada uno corre si su ultima corrida COMPLETA tiene DIAS_SEMANAL dias o mas; esa fecha la anota
 * la propia noche en .claude/state/nocturno-semanal.json SOLO cuando el paso salio completo (ver `corridaCompleta`),
 * asi una noche con la notebook apagada no pierde la semana y una que fallo (sin red, 529) se reintenta la noche
 * siguiente. `--solo <paso>` lo fuerza. (Hasta la auditoria del 09/10 la fecha salia de que existiera su archivo de
 * salida, y los programas lo escriben tambien cuando todo fallo: la semana se perdia.)
 */
export const PASOS_SEMANALES = Object.freeze(['vigilante', 'propuestas', 'disparo']);
export const DIAS_SEMANAL = 7;
export const HORAS_VIEJO = 26;

// ─────────────────────────────────────────────────────────────────────────────
// Arranque y pasos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Arranca la noche? Con el presupuesto del CICLO en rojo NO (salvo `sinTope`): es el freno del
 * gasto del ciclo, y es pasivo (no corta una llamada a mitad, decide antes de empezar). El otro
 * freno, el de UNA corrida, lo aplica `correrPasos` antes de cada paso.
 */
export function debeArrancar(presupuesto, { sinTope = false } = {}) {
  if (!presupuesto) return { ok: true, motivo: '' };
  if (presupuesto.semaforo === 'rojo' && !sinTope) {
    return { ok: false, motivo: `presupuesto del ciclo en rojo (${presupuesto.ciclo?.texto ?? 'mes'}): $${Number(presupuesto.gastadoUsd).toFixed(2)} de $${presupuesto.presupuestoUsd}. No arranco (--sin-tope para forzar).` };
  }
  return { ok: true, motivo: '' };
}

/** Pasos seguidos en error a partir de los cuales la noche se frena sola. */
export const MAX_ERRORES_SEGUIDOS = 3;

/**
 * Corre los pasos en orden. Cada paso: { nombre, correr: async () => ({ detalle, costoUsd?, saltado?, datos? }) }.
 * Un paso que tira queda 'error' con el mensaje; uno que devuelve `saltado` queda 'saltado'; con
 * `solo` los demas quedan 'saltado'. Nunca tira: devuelve [{ nombre, estado, detalle, costoUsd, datos }].
 *
 * DOS CORTES, los dos antes de arrancar un paso (la noche decide, no corta una llamada a mitad):
 *   - TOPE POR CORRIDA. `topeCorridaUsd` (null = sin tope): si lo gastado en ESTA corrida (la suma del
 *     costoUsd de los pasos ya hechos, tambien los que fallaron: se cobraron) SUPERA el tope, los pasos
 *     que faltan quedan 'saltado' con el detalle "tope por corrida ($X de $8)". Es el tope de Anthropic
 *     para una corrida que se descontrola (3 a 5 veces el costo normal); el otro tope es el del ciclo.
 *   - PASOS SIN RESULTADO. Si `maxErroresSeguidos` pasos EJECUTADOS quedan en error uno detras de otro
 *     (un 'ok' reinicia la cuenta; un 'saltado' no cuenta ni reinicia), la noche se frena: algo de
 *     fondo anda mal (sin red, clave vencida) y seguir solo gasta. Los que faltan quedan 'saltado'.
 * Las filas afectadas llevan `corte` ('tope_corrida' | 'errores_seguidos') y `corteDetalle`.
 */
export async function correrPasos(pasos, { solo = null, alTerminar = () => {}, topeCorridaUsd = null, maxErroresSeguidos = MAX_ERRORES_SEGUIDOS } = {}) {
  const out = [];
  let gastado = 0;
  let seguidos = 0;
  let corte = null;                       // { motivo, detalle } una vez decidido, vale para el resto
  for (const p of pasos) {
    let fila;
    if (solo && p.nombre !== solo) {
      fila = { nombre: p.nombre, estado: 'saltado', detalle: `--solo ${solo}`, costoUsd: 0, datos: null };
    } else {
      if (!corte && topeCorridaUsd != null && gastado > topeCorridaUsd) {
        corte = { motivo: 'tope_corrida', detalle: `tope por corrida (${plata(gastado)} de $${Number(topeCorridaUsd)})` };
      }
      if (corte) {
        fila = { nombre: p.nombre, estado: 'saltado', detalle: corte.detalle, costoUsd: 0, datos: null, corte: corte.motivo, corteDetalle: corte.detalle };
      } else {
        try {
          const r = (await p.correr()) || {};
          fila = {
            nombre: p.nombre,
            estado: r.saltado ? 'saltado' : 'ok',
            detalle: String(r.detalle ?? ''),
            costoUsd: Number(r.costoUsd) || 0,
            datos: r.datos ?? null,
          };
        } catch (e) {
          fila = {
            nombre: p.nombre, estado: 'error', detalle: String(e?.message ?? e).slice(0, 400),
            costoUsd: Number(e?.costoUsd ?? e?.respuesta?.costoUsd) || 0, datos: null,
          };
        }
        gastado += fila.costoUsd;
        if (fila.estado === 'error') seguidos += 1; else if (fila.estado === 'ok') seguidos = 0;
        if (seguidos >= maxErroresSeguidos) {
          corte = { motivo: 'errores_seguidos', detalle: `${seguidos} pasos seguidos en error: se frena la noche` };
          fila.corte = corte.motivo;
          fila.corteDetalle = corte.detalle;
        }
      }
    }
    out.push(fila);
    alTerminar(fila);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pasos semanales: cuando tocan
// ─────────────────────────────────────────────────────────────────────────────

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La ultima corrida COMPLETA de un paso semanal, leida del registro que lleva la noche
 * (`.claude/state/nocturno-semanal.json` = { vigilante: 'AAAA-MM-DD', propuestas: ..., disparo: ... }).
 * Devuelve 'AAAA-MM-DD' o null (nunca corrio completo, o el registro no se entiende).
 */
export function ultimaCorrida(paso, registro) {
  if (!PASOS_SEMANALES.includes(paso)) throw new Error(`ultimaCorrida: paso semanal desconocido "${paso}"`);
  const f = registro && typeof registro === 'object' ? registro[paso] : null;
  return typeof f === 'string' && FECHA_RE.test(f) ? f : null;
}

/** El registro con la corrida completa de `paso` anotada en `fecha` ('AAAA-MM-DD'). Puro: devuelve uno nuevo. */
export function anotarCorrida(registro, paso, fecha) {
  if (!PASOS_SEMANALES.includes(paso)) throw new Error(`anotarCorrida: paso semanal desconocido "${paso}"`);
  if (!FECHA_RE.test(String(fecha))) throw new Error(`anotarCorrida: fecha invalida "${fecha}"`);
  const base = registro && typeof registro === 'object' && !Array.isArray(registro) ? registro : {};
  return { ...base, [paso]: fecha };
}

/**
 * ¿La corrida de un semanal cuenta como la de la semana? Solo si salio COMPLETA; si no, el paso puede quedar 'ok'
 * (con lo que si se leyo, para la manana) pero la semana no se da por hecha y la noche siguiente lo reintenta.
 *   vigilante   las tres paginas leidas y sin avisos de invariante (una fila que falta en la tabla es un aviso)
 *   propuestas  al menos un skill revisado y no mas de 1 de cada 4 con error (un skill que falla siempre no puede
 *               hacer que la pasada entera, ~$2,5, se repita todas las noches)
 *   disparo     termino (el programa tira si no) con al menos un mensaje evaluado
 */
export function corridaCompleta(paso, r) {
  if (paso === 'vigilante') {
    const errores = Array.isArray(r?.errores) ? r.errores : [];
    return ['precios', 'creditos', 'deprecaciones'].every((k) => r?.[k]?.ok) && !errores.length;
  }
  if (paso === 'propuestas') {
    const s = r?.resumen ?? {};
    const revisados = Number(s.revisados) || 0;
    const errores = Number(s.errores) || 0;
    return revisados > 0 && errores * 4 <= revisados + errores;
  }
  if (paso === 'disparo') return (Number(r?.resumen?.mensajes) || 0) > 0;
  return false;
}

/**
 * ¿Toca el paso semanal hoy? `ultima` 'AAAA-MM-DD' o null (nunca corrio: toca). Se cuentan dias de
 * calendario local, no horas: la noche corre a las 06:30 pero la notebook puede prenderse mas tarde.
 * Devuelve { toca, dias } (dias = null si nunca corrio).
 */
export function tocaSemanal(ultima, ahora = new Date(), dias = DIAS_SEMANAL) {
  if (!ultima || !/^\d{4}-\d{2}-\d{2}$/.test(String(ultima))) return { toca: true, dias: null };
  const [a, m, d] = String(ultima).split('-').map(Number);
  const f = ahora instanceof Date ? ahora : new Date(ahora);
  const hoy = Date.UTC(f.getFullYear(), f.getMonth(), f.getDate());
  const pasaron = Math.round((hoy - Date.UTC(a, m - 1, d)) / 86400000);
  return { toca: pasaron >= dias, dias: pasaron };
}

/**
 * El detalle del paso `vigilante` a partir del resultado de vigilarPrecios.correr(). Las diferencias son el
 * HALLAZGO del paso (no un error): van en el detalle para que la sesion de la manana las vea. Sin la pagina de
 * PRECIOS el paso es un error: "sin cambios" sin haberla leido seria mentira (auditoria del 09/10). Cada pagina que
 * no se leyo y cada aviso (una fila que falta en la tabla) se nombran con su motivo.
 */
export function detalleVigilante(r) {
  const errores = Array.isArray(r?.errores) ? r.errores : [];
  const dif = Array.isArray(r?.diferencias) ? r.diferencias : [];
  const motivo = (seccion) => errores.filter((e) => e.seccion === seccion).map((e) => corto(e.mensaje, 70)).join('; ') || 'sin detalle';
  if (!r?.precios?.ok) {
    throw new Error(`no se pudo leer la página de precios de Anthropic (${motivo('pricing')}): sin ella no se sabe si algo cambió`);
  }
  const partes = [];
  if (dif.length) {
    partes.push(`${dif.length} diferencia${dif.length === 1 ? '' : 's'} con lo nuestro: ${dif.slice(0, 3).map((x) => `${x.modelo || x.seccion || '?'} ${x.campo}`).join(', ')}${dif.length > 3 ? '…' : ''}`);
  } else {
    partes.push('sin cambios en lo leído');
  }
  for (const [k, seccion] of [['creditos', 'creditos'], ['deprecaciones', 'deprecaciones']]) {
    if (!r?.[k]?.ok) partes.push(`sin leer ${k} (${motivo(seccion)})`);
  }
  const avisos = errores.filter((e) => e.tipo === 'invariante' || (e.seccion === 'pricing' && r.precios.ok));
  if (avisos.length) partes.push(`${avisos.length} aviso${avisos.length === 1 ? '' : 's'}: ${avisos.slice(0, 2).map((e) => corto(e.mensaje, 70)).join('; ')}`);
  return partes.join(' · ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Mails sin respuesta: elegir, recortar, pedir, filtrar
// ─────────────────────────────────────────────────────────────────────────────

export const TOPE_MAILS = 12;
export const TOPE_CUERPO = 1500;
export const AREAS = Object.freeze(['ingenieria', 'calidad', 'logistica', 'otra']);

/** Hasta `tope` pedidos, los mas viejos primero (como los devuelve _mails.py --sin-respuesta). */
export function elegirPedidos(pedidos, tope = TOPE_MAILS) {
  return (Array.isArray(pedidos) ? pedidos : []).filter((p) => p && p.asunto).slice(0, tope);
}

/**
 * Para cada pedido, el mail que corresponde: el de su `id` (el ultimo recibido del hilo), o si no
 * esta, el mas nuevo de la Bandeja con la misma clave de hilo. `mails`: [{ id, asunto, de, fecha,
 * carpeta, cuerpo }]. `claveHilo` se inyecta (vive en mailCache.mjs). Devuelve [{ pedido, mail|null }].
 */
export function emparejarMails(pedidos, mails, claveHilo) {
  const porId = new Map();
  const porClave = new Map();
  for (const m of mails) {
    if (m.id) porId.set(String(m.id), m);
    if (!/bandeja de entrada/i.test(String(m.carpeta ?? ''))) continue;
    const k = claveHilo(m.asunto);
    const previo = porClave.get(k);
    if (!previo || String(m.fecha) > String(previo.fecha)) porClave.set(k, m);
  }
  return pedidos.map((p) => ({ pedido: p, mail: (p.id && porId.get(String(p.id))) || porClave.get(p.hilo || claveHilo(p.asunto)) || null }));
}

/** El cuerpo propio del mail (sin lo citado ni la firma; `cuerpoPropio` se inyecta), recortado. */
export function recortarCuerpo(texto, cuerpoPropio, tope = TOPE_CUERPO) {
  let t = '';
  try { t = cuerpoPropio(texto); } catch { t = String(texto ?? ''); }
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > tope ? `${t.slice(0, tope)}…` : t;
}

export const SYSTEM_MAILS = `Resumís mails que le mandaron a Facundo (ingeniero de procesos de Barack Mercosul, autopartista argentina) y que él todavía no contestó. Para cada mail, UNA línea de hasta 120 caracteres que diga qué le piden, en castellano rioplatense simple, sin saludo ni adornos. Si el mail no pide nada concreto, decí "no pide nada concreto: <de qué habla>".

El área es de quién es el tema, no de quién escribe: "ingenieria" (procesos, AMFE, planos, BOM, hojas de proceso, tiempos, dispositivos), "calidad" (reclamos, auditorías, PPAP, controles, 8D), "logistica" (embalaje, envíos, stock, proveedores, compras), "otra" (lo demás). Se etiqueta, no se filtra: todos los mails van en la respuesta, en el mismo orden, con el asunto tal cual.

No inventes plazos, nombres ni números que no estén en el mail. No propongas respuestas. Devolvés SOLO el JSON del esquema.`;

export const SCHEMA_MAILS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['lineas'],
  properties: {
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['asunto', 'linea', 'area'],
        properties: {
          asunto: { type: 'string' },
          linea: { type: 'string', description: 'que piden, hasta 120 caracteres' },
          area: { type: 'string', enum: [...AREAS] },
        },
      },
    },
  },
});

/** El mensaje para Haiku: un bloque por mail, numerado, con lo minimo. */
export function armarPedidoMails(pares) {
  const bloques = pares.map(({ pedido, cuerpo }, i) => [
    `### ${i + 1}. asunto: ${pedido.asunto}`,
    `de: ${pedido.de} · fecha: ${pedido.fecha} · ${pedido.dias} días sin respuesta${pedido.estado && pedido.estado !== 'sin respuesta' ? ` · ${pedido.estado}` : ''}`,
    cuerpo ? `cuerpo:\n${cuerpo}` : 'cuerpo: (no está en el cache: resumí por el asunto)',
  ].join('\n'));
  return { usuario: `${bloques.join('\n\n')}\n\nDevolvé el JSON con una línea por mail, en el mismo orden.`, schema: SCHEMA_MAILS };
}

const corto = (t, n) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/**
 * Lo que vuelve de Haiku contra lo que se le mando: una linea por pedido, en el orden de los
 * pedidos. Si el modelo salteo uno o cambio el asunto, ese pedido queda con la linea "(sin resumen)"
 * en vez de desaparecer: un mail que se cae del resumen es un pedido que nadie ve.
 */
export function lineasDeMails(pedidos, respuesta) {
  const lineas = Array.isArray(respuesta?.lineas) ? respuesta.lineas : [];
  return pedidos.map((p, i) => {
    const l = lineas[i] && corto(lineas[i].asunto, 200) === corto(p.asunto, 200)
      ? lineas[i]
      : lineas.find((x) => corto(x?.asunto, 200) === corto(p.asunto, 200));
    return {
      asunto: corto(p.asunto, 120),
      de: corto(p.de, 40),
      dias: Number(p.dias) || 0,
      estado: p.estado || 'sin respuesta',
      linea: l ? corto(l.linea, 120) : '(sin resumen: abrir el mail)',
      area: l && AREAS.includes(l.area) ? l.area : 'otra',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Novedades de Claude
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Toca el resumen LARGO (Sonnet, hasta 8 renglones, sobre la semana)? Los lunes, o si `avisoHook` dice
 * que paso una semana sin una lectura completa. Desde el 08/10/2026 la lectura corre todos los dias; lo
 * que cambia con el dia es el resumen: el diario es corto y con Haiku.
 */
export function tocaNovedades(ahora, aviso) {
  return ahora.getDay() === 1 || !!String(aviso ?? '').trim();
}

/**
 * Que hacer con las novedades de hoy, puro. `hayNovedades`: ¿el texto a resumir trae algo (un posteo o una
 * version nueva)? Sin eso no vale una llamada. Con algo nuevo: el lunes (o pasada una semana) Sonnet con el
 * resumen largo; cualquier otro dia Haiku `low` con el corto. Devuelve { accion: 'saltar' | 'haiku' |
 * 'sonnet', modelo, effort, system, maxTokens, tarea, largo }.
 */
export function planNovedades(ahora, aviso, hayNovedades) {
  if (!hayNovedades) return { accion: 'saltar', largo: false };
  if (tocaNovedades(ahora, aviso)) {
    return { accion: 'sonnet', modelo: 'sonnet', effort: 'medium', system: SYSTEM_NOVEDADES, maxTokens: 8000, tarea: 'nocturno:novedades', largo: true };
  }
  return { accion: 'haiku', modelo: 'haiku', effort: 'low', system: SYSTEM_NOVEDADES_DIARIO, maxTokens: 4000, tarea: 'nocturno:novedades-diario', largo: false };
}

/**
 * El texto del resumen LARGO: los listados de la semana. Como la lectura corre todos los dias y su
 * estado avanza todos los dias, el listado del lunes trae SOLO lo del dia; la semana se arma juntando los
 * `novedades_*.md` de los ultimos `dias`. `listados`: [{ f, ms, texto }]. Los que no traen nada nuevo se
 * saltean; el mas nuevo va primero; `tope` caracteres en total (lo mas viejo es lo que se corta).
 */
export function juntarListados(listados, { ahoraMs = Date.now(), dias = 7, tope = 120000 } = {}) {
  const desde = ahoraMs - dias * 86400000;
  const piezas = (Array.isArray(listados) ? listados : [])
    .filter((x) => x && Number(x.ms) >= desde && !novedadesSinCambios(x.texto))
    .sort((a, b) => b.ms - a.ms)
    .map((x) => `## ${x.f}\n\n${String(x.texto).trim()}`);
  let total = 0;
  const entran = [];
  for (const pieza of piezas) {
    if (entran.length && total + pieza.length > tope) break;
    entran.push(pieza);
    total += pieza.length;
  }
  return entran.join('\n\n---\n\n');
}

/**
 * Resume las novedades segun el plan. `llamarModelo(opciones)` se inyecta (en la noche es `llamar` con el
 * cliente; en el test, uno de mentira): devuelve { texto, costoUsd }. Con plan 'saltar' no llama a nadie.
 * Un resumen vacio es un error (con el costo adentro: se cobro), nunca un "sin novedades" mudo.
 */
export async function resumirNovedades({ plan, texto, llamarModelo }) {
  if (!plan || plan.accion === 'saltar') return { resumen: null, costoUsd: 0, modelo: null, llamo: false };
  const resp = await llamarModelo({ modelo: plan.modelo, effort: plan.effort, system: plan.system, usuario: texto, maxTokens: plan.maxTokens, tarea: plan.tarea });
  const resumen = String(resp?.texto ?? '').trim();
  if (!resumen) throw Object.assign(new Error('el resumen de novedades vino vacio'), { costoUsd: Number(resp?.costoUsd) || 0 });
  return { resumen, costoUsd: Number(resp?.costoUsd) || 0, modelo: plan.modelo, llamo: true };
}

/** Un listado de _novedadesClaude.mjs sin posteos ni versiones nuevas no vale una llamada. */
export function novedadesSinCambios(texto) {
  const t = String(texto ?? '');
  return !/^- \*\*/m.test(t) && !/^### \d+\.\d+\.\d+/m.test(t);
}

export const SYSTEM_NOVEDADES = `Leés el listado de novedades de Claude Code (posteos públicos del equipo de Anthropic y el registro de cambios oficial) para un repo de ingeniería de procesos que usa Claude Code todos los días con hooks, skills, subagentes, scripts en Node y la API de Anthropic. Devolvés como mucho 8 renglones, en castellano rioplatense simple, cada uno con la forma:

- nos sirve: <qué y para qué, en una frase> — <URL>
- nos puede romper: <qué y por qué, en una frase> — <URL>

Solo lo que está en el listado; cada renglón con la URL del posteo o "registro de cambios <versión>". Sin introducción ni cierre. Si no hay nada que sirva ni que pueda romper, un solo renglón: "- sin novedades que nos toquen".`;

/** El resumen de todos los dias: lo mismo pero corto (Haiku) y sobre lo de hoy. El de los lunes (Sonnet) es el largo. */
export const SYSTEM_NOVEDADES_DIARIO = `Leés lo nuevo de hoy sobre Claude Code (posteos públicos del equipo de Anthropic y el registro de cambios oficial) para un repo de ingeniería de procesos que usa Claude Code todos los días con hooks, skills, subagentes, scripts en Node y la API de Anthropic. Devolvés como mucho 4 renglones, en castellano rioplatense simple, cada uno con la forma:

- nos sirve: <qué y para qué, en una frase> — <URL>
- nos puede romper: <qué y por qué, en una frase> — <URL>

Solo lo que está en el texto; cada renglón con la URL del posteo o "registro de cambios <versión>". Sin introducción ni cierre. Si no hay nada que sirva ni que pueda romper, un solo renglón: "- sin novedades que nos toquen".`;

// ─────────────────────────────────────────────────────────────────────────────
// Prioridades: hasta 4 renglones que ordenan lo que YA existe
// ─────────────────────────────────────────────────────────────────────────────
//
// Casi todo es codigo; el modelo solo ORDENA. Las entradas son cosas que ya existen y que otro script
// ya calcula (seguimientos con fecha, hilos de tareas abiertas con mails nuevos, la cola del Escritorio,
// los mails sin respuesta que acaba de resumir el paso `mails` y el resultado de los pasos de esta
// misma noche). Cada entrada lleva una FUENTE de una lista cerrada que arma el codigo:
//   seguimiento:<id> · hilo:<tarea> · mail:<asunto> · escritorio:<carpeta> · noche:<paso>
// y el codigo DESCARTA todo renglon cuya fuente no este en la entrada: un renglon sin fuente real es un
// invento (regla: la maquina puede matar un hallazgo, nunca aprobar un dato). Es una SUGERENCIA para la
// sesion de la manana, que la contrasta con la fuente antes de decirle algo a Fak.

export const TOPE_PRIORIDADES = 4;
const TOPE_ESCRITORIO = 80;
const TOPE_ESCRITORIO_EN_ESPERA = 20;
const TOPE_HILOS = 10;

/** Para comparar fuentes: sin diferencia de mayusculas ni de espacios repetidos. */
export const normalizarFuente = (f) => String(f ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const fechaCorta = (ms) => { const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`; };

/** Las lineas "- <id>: ..." de `node scripts/_seguimientos.mjs --hook`. Si dice que NO SE PUDO LEER, eso tambien es una entrada. */
export function entradasSeguimientos(textoHook) {
  const out = [];
  const texto = String(textoHook ?? '');
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^- ([A-Za-z0-9_.-]+): (.+)$/.exec(linea.trim());
    if (m) out.push({ fuente: `seguimiento:${m[1]}`, texto: corto(m[2], 400) });
  }
  if (/NO SE PUDO LEER/i.test(texto)) {
    out.push({ fuente: 'noche:seguimientos', texto: 'no se pudo leer la memoria de seguimientos con fecha: mientras tanto nadie avisa que toca insistir' });
  }
  return out;
}

/** `cruce` de `_hilosAbiertos.mjs --json`: tareas del Escritorio con mails del mismo hilo que la carpeta no tiene. */
export function entradasHilos(cruce) {
  return (Array.isArray(cruce) ? cruce : []).slice(0, TOPE_HILOS).map((t) => {
    const nuevos = Array.isArray(t.nuevos) ? t.nuevos : [];
    const u = nuevos[nuevos.length - 1] || {};
    const n = nuevos.length;
    return {
      fuente: `hilo:${corto(t.nombre, 80)}`,
      texto: `${n} mail${n === 1 ? '' : 's'} nuevo${n === 1 ? '' : 's'} del mismo hilo desde el ${t.desde ? fechaCorta(t.desde) : '?'}; el último, ${String(u.fecha ?? '').slice(0, 10)} de ${corto(u.de, 30)}: «${corto(u.asunto, 60)}»${t.enEspera ? ' (la tarea está en _EN ESPERA)' : ''}`,
    };
  });
}

/** Carpetas del Escritorio: SOLO el nombre y los dias (por la fecha del archivo, que es aproximada: OneDrive la pisa). */
export function entradasEscritorio(carpetas) {
  const lista = Array.isArray(carpetas) ? carpetas : [];
  const raiz = lista.filter((c) => !c.enEspera).slice(0, TOPE_ESCRITORIO);
  const espera = lista.filter((c) => c.enEspera).slice(0, TOPE_ESCRITORIO_EN_ESPERA);
  return [...raiz, ...espera].map((c) => ({
    fuente: `escritorio:${corto(c.nombre, 80)}`,
    texto: `carpeta sin cambios hace ${Math.max(0, Number(c.dias) || 0)} día${Number(c.dias) === 1 ? '' : 's'} (por la fecha del archivo, aproximado)${c.enEspera ? ' · está en _EN ESPERA (baja prioridad)' : ''}`,
  }));
}

/** Lo que dejo el paso `mails` de esta noche (la salida de `lineasDeMails`). */
export function entradasMails(lineas) {
  return (Array.isArray(lineas) ? lineas : []).map((m) => ({
    fuente: `mail:${corto(m.asunto, 120)}`,
    texto: `${Number(m.dias) || 0} días sin respuesta · de ${corto(m.de, 30)} · área ${m.area || 'otra'}: ${corto(m.linea, 120)}`,
  }));
}

/** Los pasos de esta noche que ya corrieron: un error se dice; la pre-auditoria dice cuantos hallazgos dejo para verificar. */
export function entradasNoche({ pasos = [], hallazgos = null } = {}) {
  const out = [];
  for (const p of pasos) {
    if (p.estado === 'error') out.push({ fuente: `noche:${p.nombre}`, texto: `el paso ${p.nombre} de esta noche falló: ${corto(p.detalle, 150)}` });
  }
  if (hallazgos && hallazgos.total > 0) {
    out.push({ fuente: 'noche:preauditoria', texto: `la pre-auditoría de AMFE dejó ${hallazgos.total} hallazgo${hallazgos.total === 1 ? '' : 's'} para verificar (${hallazgos.nuevos || 0} nuevo${hallazgos.nuevos === 1 ? '' : 's'}) en el reporte de reports/staging` });
  }
  return out;
}

/**
 * Junta las entradas de todas las fuentes. Cada fuente de DATOS se pide con una funcion (`leer`) que se
 * inyecta: si una tira, el paso sigue con las otras y el motivo queda en `avisos` (no se pierde en silencio).
 * `fuentes`: { seguimientos: () => texto, hilos: () => cruce, escritorio: () => carpetas }.
 * Dos entradas con la misma fuente (dos mails con el mismo asunto) quedan en una: la primera.
 * Devuelve { entradas: [{ fuente, texto }], avisos: [texto] }.
 */
export function reunirEntradas({ fuentes = {}, mails = [], pasos = [], hallazgos = null } = {}) {
  const avisos = [];
  const leer = (nombre, fn, entradas) => {
    if (typeof fn !== 'function') return [];
    try { return entradas(fn()); } catch (e) { avisos.push(`${nombre}: ${corto(e?.message ?? e, 120)}`); return []; }
  };
  const todas = [
    ...leer('seguimientos', fuentes.seguimientos, entradasSeguimientos),
    ...leer('hilos abiertos', fuentes.hilos, entradasHilos),
    ...entradasMails(mails),
    ...leer('Escritorio', fuentes.escritorio, entradasEscritorio),
    ...entradasNoche({ pasos, hallazgos }),
  ];
  const vistas = new Set();
  const entradas = [];
  for (const e of todas) {
    const k = normalizarFuente(e.fuente);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    entradas.push(e);
  }
  return { entradas, avisos };
}

export const SYSTEM_PRIORIDADES = `Ordenás lo que tiene pendiente Facundo, ingeniero de procesos de Barack Mercosul (autopartista argentina), para que la sesión de la mañana sepa por dónde empezar. Te paso una lista de ENTRADAS; cada una empieza con su FUENTE entre corchetes (por ejemplo [seguimiento:reunion-amfe-calidad]). Son cosas que ya existen: seguimientos con fecha (hay que volver a insistir en una fecha), tareas abiertas del Escritorio que tienen mails nuevos en su hilo, mails que nadie contestó, carpetas del Escritorio y resultados de la noche.

Devolvés hasta 4 renglones, del más urgente al menos urgente. Cada renglón: "fuente" (copiada EXACTA de una entrada de la lista; si la copiás distinta, el renglón se descarta), "texto" (qué hacer hoy, en una frase de hasta 120 caracteres, en castellano rioplatense simple) y "porque" (por qué hoy, hasta 80 caracteres: vencido, respuesta nueva, N días sin contestar, hoy toca insistir).

Reglas: usá solo lo que dicen las entradas; no inventes plazos, nombres, números ni mails que no estén. No propongas qué contestar ni qué valores poner: decí qué mirar o hacer. Lo que está en _EN ESPERA es de baja prioridad: solo si algo más lo hace urgente. Si hay menos de 4 cosas que valgan la pena, devolvé menos; si no hay ninguna, una lista vacía. Devolvés SOLO el JSON del esquema.`;

/** El esquema, con la lista cerrada de fuentes como `enum` (ademas el codigo vuelve a filtrar). */
export function schemaPrioridades(fuentes) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['renglones'],
    properties: {
      renglones: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['fuente', 'texto', 'porque'],
          properties: {
            fuente: { type: 'string', enum: [...fuentes] },
            texto: { type: 'string', description: 'que hacer hoy, hasta 120 caracteres' },
            porque: { type: 'string', description: 'por que hoy, hasta 80 caracteres' },
          },
        },
      },
    },
  };
}

/** El mensaje: una linea por entrada, "[fuente] texto". `fecha` es el dia de la noche, ya escrito ("jueves 08/10/2026"). */
export function armarPedidoPrioridades(entradas, { fecha = '' } = {}) {
  const lista = entradas.map((e) => `[${e.fuente}] ${e.texto}`).join('\n');
  return {
    usuario: `Hoy es ${fecha || 'hoy'}.\n\nENTRADAS:\n${lista}\n\nDevolvé el JSON con hasta ${TOPE_PRIORIDADES} renglones, del más urgente al menos urgente.`,
    schema: schemaPrioridades(entradas.map((e) => e.fuente)),
  };
}

/**
 * Lo que volvio del modelo contra lo que se le mando. Se DESCARTA todo renglon cuya fuente no este en
 * las entradas (comparada sin mayusculas ni espacios repetidos; se queda con la fuente escrita por el
 * codigo, no la del modelo), el que viene sin texto y el que repite una fuente. Maximo 4.
 * Devuelve { renglones: [{ fuente, texto, porque }], descartados: [{ fuente, motivo }] }.
 */
export function filtrarRenglones(respuesta, entradas, { tope = TOPE_PRIORIDADES } = {}) {
  const canonica = new Map(entradas.map((e) => [normalizarFuente(e.fuente), e.fuente]));
  const renglones = [];
  const descartados = [];
  const usadas = new Set();
  for (const r of Array.isArray(respuesta?.renglones) ? respuesta.renglones : []) {
    const clave = normalizarFuente(r?.fuente);
    const texto = corto(r?.texto, 140);
    if (!canonica.has(clave)) { descartados.push({ fuente: corto(r?.fuente, 80), motivo: 'su fuente no estaba en la entrada' }); continue; }
    if (usadas.has(clave)) { descartados.push({ fuente: canonica.get(clave), motivo: 'fuente repetida' }); continue; }
    if (!texto) { descartados.push({ fuente: canonica.get(clave), motivo: 'sin texto' }); continue; }
    if (renglones.length >= tope) { descartados.push({ fuente: canonica.get(clave), motivo: `pasaba el tope de ${tope}` }); continue; }
    usadas.add(clave);
    renglones.push({ fuente: canonica.get(clave), texto, porque: corto(r?.porque, 100) });
  }
  return { renglones, descartados };
}

/** "1. [fuente] que hacer · por que hoy" */
export const lineaRenglon = (r, i) => `${i + 1}. [${r.fuente}] ${r.texto}${r.porque ? ` · ${r.porque}` : ''}`;

/** El contenido de .claude/state/prioridades.md: dice arriba para quien es. */
export function textoPrioridades({ renglones, descartados = [], fecha = '', avisos = [] }) {
  const L = [`# Prioridades sugeridas por la noche — ${fecha}`, ''];
  L.push('**Para la sesión de Claude de la mañana, no para Fak.** Son sugerencias de un modelo que ordena cosas que ya existen; cada renglón nombra su fuente entre corchetes. Antes de decirle algo a Fak se contrasta con esa fuente (el seguimiento, el hilo, el mail, la carpeta) y se descarta lo que ya no sea cierto.', '');
  if (renglones.length) L.push(...renglones.map(lineaRenglon));
  else L.push('Sin prioridades esta noche (no había entradas, o ninguna valía un renglón).');
  if (descartados.length) L.push('', `_Descartados por el código: ${descartados.length} (${descartados.map((d) => `${d.fuente || '?'}: ${d.motivo}`).join('; ')})_`);
  if (avisos.length) L.push('', `_Fuentes que no se pudieron leer: ${avisos.join('; ')}_`);
  return `${L.join('\n')}\n`;
}

/**
 * El paso entero con el modelo inyectado. `llamarModelo(opciones)` -> { json, costoUsd }. Sin entradas NO se
 * llama al modelo (0 entradas no es un pedido). Devuelve { renglones, descartados, entradas, llamo, costoUsd, detalle }.
 */
export async function generarPrioridades({ entradas, llamarModelo, fecha = '' }) {
  if (!entradas.length) {
    return { renglones: [], descartados: [], entradas: 0, llamo: false, costoUsd: 0, detalle: '0 entradas: no se llamó al modelo' };
  }
  const resp = await llamarModelo({ modelo: 'sonnet', effort: 'medium', system: SYSTEM_PRIORIDADES, ...armarPedidoPrioridades(entradas, { fecha }), maxTokens: 8000, tarea: 'nocturno:prioridades' });
  const costoUsd = Number(resp?.costoUsd) || 0;
  if (!Array.isArray(resp?.json?.renglones)) throw Object.assign(new Error('la respuesta de prioridades no trae la lista "renglones"'), { costoUsd });
  const { renglones, descartados } = filtrarRenglones(resp.json, entradas);
  return {
    renglones, descartados, entradas: entradas.length, llamo: true, costoUsd,
    detalle: `${renglones.length} ${renglones.length === 1 ? 'renglón' : 'renglones'} de ${entradas.length} entradas${descartados.length ? ` (${descartados.length} descartado${descartados.length === 1 ? '' : 's'} por el código)` : ''}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de la noche y linea del tablero
// ─────────────────────────────────────────────────────────────────────────────

const p2 = (x) => String(x).padStart(2, '0');
const ddmm = (f) => `${p2(f.getDate())}/${p2(f.getMonth() + 1)}`;
const hhmm = (f) => `${p2(f.getHours())}:${p2(f.getMinutes())}`;
const plata = (x) => `$${(Math.round((Number(x) || 0) * 100) / 100).toFixed(2).replace('.', ',')}`;

/**
 * La linea que lee el tablero:
 * "Noche 08/10 06:31 · pre-auditoría AMFE: 3 revisados · 2 hallazgos para verificar (1 nuevo) ·
 *  4 mails resumidos · prioridades: 4 · novedades: sin cambios · $0,41 (mes $12,30 de $170, verde)"
 * Si el paso `prioridades` no corrio, esa parte no aparece. Si la noche se corto sola, termina en
 * "CORTADA: tope por corrida ($9,00 de $8)" o "CORTADA: 3 pasos seguidos en error: se frena la noche".
 */
export function lineaTablero({ fin, pasos = [], costoUsd = 0, presupuesto = null, noArranco = '', prioridades = null } = {}) {
  const f = fin instanceof Date ? fin : new Date(fin ?? Date.now());
  const partes = [`Noche ${ddmm(f)} ${hhmm(f)}`];
  if (noArranco) {
    partes.push(`no arrancó: ${noArranco}`);
  } else {
    const paso = (n) => pasos.find((p) => p.nombre === n);
    // la copia en la nube solo ocupa lugar si escribio algo o si fallo (sin cambios, que es lo normal, no se dice)
    const dat = paso('datos');
    if (dat?.estado === 'error') partes.push(`copia en la nube: ERROR (${corto(dat.detalle, 90)})`);
    else if (dat?.estado === 'ok' && !/ 0 archivo\(s\) escritos/.test(dat.detalle)) partes.push(`copia en la nube: ${corto(dat.detalle, 90)}`);
    const pre = paso('preauditoria');
    if (pre) {
      if (pre.estado === 'error') partes.push(`pre-auditoría AMFE: ERROR (${corto(pre.detalle, 80)})`);
      else if (pre.estado === 'ok') partes.push(pre.detalle || 'pre-auditoría AMFE: ok');
    }
    const mails = paso('mails');
    if (mails) {
      if (mails.estado === 'error') partes.push(`mails: ERROR (${corto(mails.detalle, 80)})`);
      else if (mails.estado === 'ok') partes.push(mails.detalle || 'mails: ok');
    }
    const pri = paso('prioridades');
    if (pri) {
      if (pri.estado === 'error') partes.push(`prioridades: ERROR (${corto(pri.detalle, 60)})`);
      else if (pri.estado === 'ok') partes.push(`prioridades: ${Array.isArray(prioridades) ? prioridades.length : (pri.detalle || 'ok')}`);
    }
    const nov = paso('novedades');
    if (nov) {
      if (nov.estado === 'error') partes.push(`novedades: ERROR (${corto(nov.detalle, 60)})`);
      else if (nov.estado === 'ok') partes.push(`novedades: ${nov.detalle || 'ok'}`);
      else if (nov.estado === 'saltado' && !nov.corte && !/^--solo/.test(nov.detalle)) partes.push('novedades: no tocaba');
    }
    // los semanales: solo si corrieron (un 'saltado' porque no tocaba no ocupa lugar en la linea)
    for (const [n, etiqueta] of [['vigilante', 'precios'], ['propuestas', 'propuestas de skills'], ['disparo', 'disparo de skills']]) {
      const s = paso(n);
      if (!s) continue;
      if (s.estado === 'error') partes.push(`${etiqueta}: ERROR (${corto(s.detalle, 60)})`);
      else if (s.estado === 'ok') partes.push(`${etiqueta}: ${corto(s.detalle, 90)}`);
    }
    // la noche se corto sola (tope por corrida o pasos seguidos en error): que se vea en la linea
    const cortada = pasos.find((p) => p.corte);
    if (cortada) partes.push(`CORTADA: ${cortada.corteDetalle || cortada.detalle}`);
  }
  const mes = presupuesto ? ` (mes ${plata(presupuesto.gastadoUsd)} de $${presupuesto.presupuestoUsd}, ${presupuesto.semaforo})` : '';
  partes.push(`${plata(costoUsd)}${mes}`);
  return partes.join(' · ');
}

/** El JSON de .claude/state/nocturno.json (lo lee el tablero y la sesion de la manana). */
export function armarEstado({ inicio, fin, pasos = [], presupuesto = null, noArranco = '', mails = [], hallazgos = null, reporte = null, resumenNovedades = null, prioridades = null, semanales = null }) {
  const costoUsd = Math.round(pasos.reduce((s, p) => s + (Number(p.costoUsd) || 0), 0) * 1e6) / 1e6;
  const fi = fin instanceof Date ? fin : new Date(fin);
  const ini = inicio instanceof Date ? inicio : new Date(inicio);
  const local = (f) => `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())} ${hhmm(f)}:${p2(f.getSeconds())}`;
  return {
    fecha: local(fi).slice(0, 10),
    inicio: local(ini),
    fin: local(fi),
    finMs: fi.getTime(),
    pasos: pasos.map(({ nombre, estado, detalle, costoUsd: c, corte }) => ({ nombre, estado, detalle, costoUsd: Number(c) || 0, ...(corte ? { corte } : {}) })),
    costoUsd,
    presupuesto,
    noArranco: noArranco || null,
    // si la noche se frena sola (tope por corrida, pasos seguidos en error), el motivo queda anotado aca
    corte: (() => { const c = pasos.find((p) => p.corte); return c ? { motivo: c.corte, detalle: c.corteDetalle || c.detalle } : null; })(),
    lineaTablero: lineaTablero({ fin: fi, pasos, costoUsd, presupuesto, noArranco, prioridades }),
    mails,
    prioridades: Array.isArray(prioridades) ? prioridades : [],
    hallazgos,
    reporte,
    resumenNovedades,
    // donde dejo su salida cada semanal que corrio esta noche (vigilante: json; propuestas: dir; disparo: archivo)
    semanales: semanales && Object.keys(semanales).length ? semanales : null,
  };
}

/** ¿El estado es viejo? (mas de HORAS_VIEJO horas: la noche no corrio o fallo antes de escribir) */
export function edadHoras(estado, ahora = Date.now()) {
  const ms = Number(estado?.finMs);
  if (!Number.isFinite(ms)) return null;
  return Math.round(((ahora - ms) / 3600000) * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// La tarea de Windows (texto de PowerShell; lo corre _nocturno.mjs con psRun)
// ─────────────────────────────────────────────────────────────────────────────

const comillaPs = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * El script que registra la tarea diaria. Mismo patron que scripts/_arbVigilante.ps1 (probado en esta
 * PC): conhost --headless para que no aparezca ventana, usuario interactivo sin elevar. Es una
 * notebook: StartWhenAvailable la corre al prenderla si a la hora estaba apagada (por eso 06:30 y no
 * 03:00). El tope de 1 hora corta una corrida colgada.
 */
export function comandoAgendar({ raiz, hora = HORA_TAREA, tarea = NOMBRE_TAREA } = {}) {
  if (!raiz) throw new Error('comandoAgendar: falta la raiz del repo');
  if (!/^\d{2}:\d{2}$/.test(hora)) throw new Error(`hora invalida: ${hora}`);
  const ps1 = `${String(raiz).replace(/[\\/]+$/, '')}\\scripts\\_nocturno.ps1`;
  return [
    "$ErrorActionPreference = 'Stop'",
    `$raiz = ${comillaPs(raiz)}`,
    `$accion = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\\conhost.exe') -Argument ${comillaPs(`--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`)} -WorkingDirectory $raiz`,
    `$cuando = New-ScheduledTaskTrigger -Daily -At ${comillaPs(hora)}`,
    '$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -Priority 6',
    '$quien = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited',
    `Register-ScheduledTask -TaskName ${comillaPs(tarea)} -Action $accion -Trigger $cuando -Settings $ajustes -Principal $quien -Force | Out-Null`,
    `$t = Get-ScheduledTask -TaskName ${comillaPs(tarea)}`,
    `$i = Get-ScheduledTaskInfo -TaskName ${comillaPs(tarea)}`,
    "Write-Output ('{0}|{1}' -f $t.State, $i.NextRunTime.ToString('dd/MM HH:mm'))",
  ].join('\n');
}

export function comandoDesagendar({ tarea = NOMBRE_TAREA } = {}) {
  return [
    `$t = Get-ScheduledTask -TaskName ${comillaPs(tarea)} -ErrorAction SilentlyContinue`,
    "if (-not $t) { Write-Output 'NO-ESTABA'; exit 0 }",
    `Unregister-ScheduledTask -TaskName ${comillaPs(tarea)} -Confirm:$false`,
    "Write-Output 'BORRADA'",
  ].join('\n');
}

/** Una linea "estado|proxima|ultima|resultado" o "NO-AGENDADA". */
export function comandoEstadoTarea({ tarea = NOMBRE_TAREA } = {}) {
  return [
    `$t = Get-ScheduledTask -TaskName ${comillaPs(tarea)} -ErrorAction SilentlyContinue`,
    "if (-not $t) { Write-Output 'NO-AGENDADA'; exit 0 }",
    `$i = Get-ScheduledTaskInfo -TaskName ${comillaPs(tarea)}`,
    "$f = { param($d) if ($d -and $d.Year -gt 2000) { $d.ToString('dd/MM HH:mm') } else { '-' } }",
    "Write-Output ('{0}|{1}|{2}|{3}' -f $t.State, (& $f $i.NextRunTime), (& $f $i.LastRunTime), $i.LastTaskResult)",
  ].join('\n');
}

/** Interpreta la salida de comandoEstadoTarea. */
export function leerEstadoTarea(salida) {
  const s = String(salida ?? '').trim().split(/\r?\n/).pop() || '';
  if (!s || s === 'NO-AGENDADA') return { agendada: false };
  const [estado, proxima, ultima, resultado] = s.split('|');
  return { agendada: true, estado, proxima, ultima, resultado: resultado ?? null };
}

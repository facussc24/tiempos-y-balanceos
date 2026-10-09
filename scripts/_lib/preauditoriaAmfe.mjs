/**
 * preauditoriaAmfe.mjs — lo puro de scripts/_preauditarAmfe.mjs: proyectar un AMFE a texto
 * compacto, armar los pedidos al revisor (Sonnet) y al refutador (Opus), filtrar lo que vuelve
 * con reglas duras, llevar el estado (que AMFE se reviso y que hallazgo ya se vio) y escribir el
 * reporte para la sesion de la manana.
 *
 * QUE ES Y QUE NO ES (decisiones del proyecto que esto respeta al pie de la letra):
 *   - El modelo SENALA, nunca aprueba ni propone un dato: ni S/O/D, ni controles, ni acciones, ni
 *     texto de reemplazo (`docs/auto-mejora/2026-09-30-automejora-10-frentes.md`: "No: LLM que
 *     proponga S/O/D o acciones"; `coordinador.md`: "la maquina puede MATAR un hallazgo, nunca
 *     APROBAR un dato"). Por eso el segundo paso es un REFUTADOR: Opus trata de matar cada
 *     hallazgo; solo sobrevive lo que no pudo refutar.
 *   - Un AP=H con la accion vacia es un ESTADO VALIDO (`amfe.md` §4; incidente del 30/03/2026 con
 *     408 acciones inventadas). No se flaggea, no se cuenta, no se insinua. Lo filtra el codigo
 *     aunque el modelo lo diga.
 *   - "Un hallazgo sin cita no es hallazgo" (`auditoria-cliente.md`): cada hallazgo trae la cita
 *     TEXTUAL del AMFE y el codigo lo verifica contra la proyeccion; si no esta, se descarta.
 *   - Lo que ya marca el validador deterministico (`amfeValidator.mjs`) no se repite: se le pasa
 *     al modelo la lista de lo conocido.
 *   - El reporte NO es un informe para Fak (regla no_hacer_informes): es un archivo de trabajo
 *     para la sesion de Claude de la manana, que verifica cada hallazgo contra la fuente y le lleva
 *     a Fak solo lo confirmado, en 4 renglones. El repo es publico: el reporte va a reports/
 *     staging/ (ignorado por git).
 *
 * Todo lo de este archivo es puro (sin red, sin disco): se prueba en
 * __tests__/scripts/preauditoriaAmfe.test.mjs.
 */
import crypto from 'node:crypto';
import { validateAmfeDoc } from './amfeValidator.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de hallazgo
// ─────────────────────────────────────────────────────────────────────────────

/** Lo unico que el revisor puede senalar. Lo que no entra aca no es su trabajo. */
export const TIPOS = Object.freeze([
  'causa_no_corresponde_a_la_falla',
  'efecto_incoherente_con_la_falla',
  'control_no_ataca_la_causa',
  'texto_incoherente_o_truncado',
  'inconsistencia_interna',
  'huella_de_ia_o_placeholder',
]);

export const TIPO_LEGIBLE = Object.freeze({
  causa_no_corresponde_a_la_falla: 'la causa no corresponde a ese modo de falla',
  efecto_incoherente_con_la_falla: 'el efecto no se sigue de la falla',
  control_no_ataca_la_causa: 'el control no ataca la causa',
  texto_incoherente_o_truncado: 'texto incoherente o cortado',
  inconsistencia_interna: 'inconsistencia interna del documento',
  huella_de_ia_o_placeholder: 'huella de IA o texto de relleno',
});

export const TOPE_HALLAZGOS_POR_AMFE = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Proyeccion compacta (una linea por causa, con referencia estable)
// ─────────────────────────────────────────────────────────────────────────────

const v = (x) => { const s = String(x ?? '').replace(/\s+/g, ' ').trim(); return s || '(vacio)'; };
const vacio = (x) => !String(x ?? '').trim();

/**
 * El AMFE como texto plano, una linea por causa, cada una con una referencia `O1.W2.F1.X3.C2`
 * (operacion, elemento, funcion, falla, causa; indices desde 1) que el modelo tiene que devolver
 * tal cual. Devuelve tambien `causas` (ref -> {ap, accionVacia, ...}) para los filtros duros.
 * Acepta los dos juegos de nombres de campo que conviven en los datos (alias historicos).
 */
export function proyectarAmfe(doc, { amfeNumber = '', projectName = '' } = {}) {
  const L = [];
  const causas = new Map();
  L.push(`AMFE ${v(amfeNumber)} — ${v(projectName)}`);
  const ops = Array.isArray(doc?.operations) ? doc.operations : [];
  ops.forEach((op, oi) => {
    const opNum = op?.opNumber ?? op?.operationNumber;
    const opName = op?.name ?? op?.operationName;
    L.push('', `== OP ${v(opNum)} ${v(opName)} | funcion de la operacion: ${v(op?.operationFunction ?? op?.focusElementFunction)}`);
    (Array.isArray(op?.workElements) ? op.workElements : []).forEach((we, wi) => {
      L.push(`  WE [${v(we?.type)}] ${v(we?.name)}`);
      (Array.isArray(we?.functions) ? we.functions : []).forEach((fn, fi) => {
        L.push(`    F: ${v(fn?.description ?? fn?.functionDescription)} | requisito: ${v(fn?.requirements)}`);
        (Array.isArray(fn?.failures) ? fn.failures : []).forEach((fm, xi) => {
          L.push(`      FALLA: ${v(fm?.description ?? fm?.failureMode)} | S=${v(fm?.severity)} | efecto local: ${v(fm?.effectLocal)} | siguiente: ${v(fm?.effectNextLevel)} | usuario: ${v(fm?.effectEndUser)}`);
          (Array.isArray(fm?.causes) ? fm.causes : []).forEach((c, ci) => {
            const ref = `O${oi + 1}.W${wi + 1}.F${fi + 1}.X${xi + 1}.C${ci + 1}`;
            const ap = String(c?.ap ?? c?.actionPriority ?? '').trim().toUpperCase();
            const accionVacia = vacio(c?.preventionAction) && vacio(c?.detectionAction) && vacio(c?.optimizationAction);
            const linea = `        [${ref}] CAUSA: ${v(c?.cause ?? c?.description)} | O=${v(c?.occurrence)} D=${v(c?.detection)} AP=${v(ap)}`
              + ` | control prev: ${v(c?.preventionControl ?? c?.preventiveControl)} | control det: ${v(c?.detectionControl)}`
              + ` | accion prev: ${v(c?.preventionAction)} | accion det: ${v(c?.detectionAction)} | accion opt: ${v(c?.optimizationAction)}`
              + ` | CC/SC: ${v(c?.specialChar)}`;
            L.push(linea);
            causas.set(ref, {
              ref, ap, accionVacia, opNum: v(opNum), opName: v(opName), we: v(we?.name),
              falla: v(fm?.description ?? fm?.failureMode), causa: v(c?.cause ?? c?.description),
            });
          });
        });
      });
    });
  });
  return { texto: L.join('\n'), causas, operaciones: ops.length };
}

/** Lineas de lo que YA marca el validador deterministico, para que el modelo no lo repita. */
export function conocidosDelValidador(doc, { amfeNumber = '', projectName = '', tope = 60 } = {}) {
  let r;
  try { r = validateAmfeDoc(doc, projectName, amfeNumber); } catch { r = { critical: [], warning: [] }; }
  const todos = [...(r?.critical || []).map((i) => ({ ...i, nivel: 'CRITICO' })), ...(r?.warning || []).map((i) => ({ ...i, nivel: 'aviso' }))];
  const lineas = todos.slice(0, tope).map((i) => {
    const donde = [i.opNum != null ? `OP ${i.opNum}` : '', i.opName, i.weName, i.fmDesc, i.causeDesc].filter(Boolean).map(v).join(' / ');
    return `- ${i.nivel} ${v(i.type)} en ${donde || '(documento)'}: ${v(i.message).slice(0, 160)}`;
  });
  return { lineas, criticos: (r?.critical || []).length, avisos: (r?.warning || []).length, recortado: todos.length > tope };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los pedidos: revisor (Sonnet) y refutador (Opus)
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_REVISOR = `Sos revisor de AMFE de proceso (AIAG-VDA 2019) en Barack Mercosul, una autopartista argentina que hace tapizado y espumado de asientos, apoyacabezas, paneles de puerta, insertos, corte de telas y costura, inyeccion y hot melt. Leés un AMFE ya cargado y SEÑALÁS lo que un ingeniero de proceso con experiencia miraría dos veces. No corregís nada.

QUÉ SEÑALÁS (solo estos seis tipos):
1. causa_no_corresponde_a_la_falla: la causa escrita no puede producir ese modo de falla (habla de otra cosa, otra operación, otro material).
2. efecto_incoherente_con_la_falla: el efecto (local, siguiente o usuario) no se sigue de esa falla.
3. control_no_ataca_la_causa: el control de prevención o de detección no actúa sobre esa causa (previene otra cosa, o detecta algo que esa causa no produce).
4. texto_incoherente_o_truncado: una frase cortada, pegada de otra fila, con palabras que no cierran, o ilegible.
5. inconsistencia_interna: dos filas del mismo documento que se contradicen (misma causa con distinta S/O/D sin motivo, misma falla con efectos opuestos, duplicados).
6. huella_de_ia_o_placeholder: texto de relleno ("TBD", "a definir", "xxx", "pendiente", "lorem") o frases genéricas que no dicen nada del proceso.

REGLAS DURAS (si dudás, NO lo reportás):
- NUNCA propongas valores, acciones, controles ni texto de reemplazo. Tu trabajo es señalar, no completar. Si sentís la tentación de escribir "debería decir...", no lo escribas.
- Un AP=H con las acciones vacías es un ESTADO VÁLIDO y normativo en esta casa: no es hallazgo, no lo menciones, no lo cuentes. Lo mismo un AP=M o L sin acción.
- Lo que ya marca el validador automático (te lo paso en la lista "YA DETECTADO") no lo repitas.
- Las convenciones de la casa son dato duro, no error: controles que citan una hoja de operación o un set up, materiales nombrados por su fórmula (ej. "110 + 30" para una tela de 140 g/m2), siglas internas, nombres de máquinas y proveedores. Una causa de 4 a 7 palabras es el estilo normal, no un texto cortado.
- No señales ortografía, tildes ni estilo.
- Cada hallazgo lleva la CITA TEXTUAL del AMFE: copiá exacto un fragmento de la línea (la causa, el control o el efecto tal cual están escritos). Sin cita exacta, el hallazgo se descarta.
- Como mucho ${TOPE_HALLAZGOS_POR_AMFE} hallazgos: los que más le importan a un ingeniero de proceso. Confianza honesta: "alta" solo si lo defenderías frente al dueño del documento.
- Usá la referencia [O1.W2.F1.X3.C2] de la línea de la causa, tal cual.
- Escribí "por_que" en castellano rioplatense simple, una frase, sin tecnicismos de software.

Devolvés SOLO el JSON del esquema. Si no hay nada que señalar, devolvés {"hallazgos": []}.`;

export const SCHEMA_HALLAZGOS = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['hallazgos'],
  properties: {
    hallazgos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'tipo', 'cita', 'por_que', 'confianza'],
        properties: {
          ref: { type: 'string', description: 'la referencia de la linea de la causa, ej. O3.W1.F2.X1.C2' },
          tipo: { type: 'string', enum: [...TIPOS] },
          cita: { type: 'string', description: 'fragmento TEXTUAL copiado del AMFE' },
          por_que: { type: 'string', description: 'una frase, en castellano simple' },
          confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        },
      },
    },
  },
});

/** El mensaje de usuario para el revisor: lo conocido + la proyeccion entera del AMFE. */
export function armarPedidoRevisor({ proyeccion, conocidos }) {
  const ya = conocidos?.lineas?.length
    ? `YA DETECTADO por el validador automático (${conocidos.criticos} críticos, ${conocidos.avisos} avisos${conocidos.recortado ? ', lista recortada' : ''}) — no lo repitas:\n${conocidos.lineas.join('\n')}`
    : 'YA DETECTADO por el validador automático: nada.';
  return {
    usuario: `${ya}\n\nAMFE A REVISAR (una línea por causa; la referencia va entre corchetes):\n\n${proyeccion.texto}\n\nDevolvé el JSON.`,
    schema: SCHEMA_HALLAZGOS,
  };
}

export const SYSTEM_REFUTADOR = `Sos el auditor final de una revisión de AMFE en Barack Mercosul (autopartista: tapizado, espumado, corte, costura, inyección). Un revisor te pasa hallazgos sobre un AMFE. Tu trabajo es MATAR hallazgos, no agregar: solo sobrevive lo que no pudiste refutar. La máquina puede descartar un hallazgo; nunca aprueba un dato ni propone uno.

Para cada hallazgo, tratá de refutarlo:
- ¿La cita existe tal cual en el AMFE? Si no, se_descarta.
- ¿Es un problema real para un ingeniero de proceso, o es gusto, estilo, ortografía? Si es gusto, se_descarta.
- ¿Puede ser una convención de la casa? (controles que citan hojas de operación o set up, materiales por fórmula, siglas internas, causas cortas de 4 a 7 palabras, nombres de máquinas). Si es plausible que sea convención, se_descarta.
- ¿Habla de un AP=H (o M, o L) con la acción vacía? Eso es un estado VÁLIDO: se_descarta.
- ¿Ya lo marca el validador automático (lista YA DETECTADO)? se_descarta.
- ¿La explicación propone un valor, una acción o un texto de reemplazo? se_descarta (no es el trabajo del revisor).
- Si queda alguna duda razonable, se_descarta. Preferimos perder un hallazgo cierto que molestar al dueño del documento con uno falso: el historial de la casa es de 40 a 50 % de falsos positivos en revisiones automáticas.

Devolvé SOLO el JSON del esquema, un veredicto por hallazgo recibido, con la misma ref y tipo. El motivo, en castellano simple, una frase.`;

export const SCHEMA_REFUTACION = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['veredictos'],
  properties: {
    veredictos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'tipo', 'veredicto', 'motivo'],
        properties: {
          ref: { type: 'string' },
          tipo: { type: 'string' },
          veredicto: { type: 'string', enum: ['se_mantiene', 'se_descarta'] },
          motivo: { type: 'string' },
        },
      },
    },
  },
});

/** El mensaje para el refutador: el AMFE, lo conocido y los hallazgos ya filtrados por codigo. */
export function armarPedidoRefutador({ proyeccion, conocidos, hallazgos }) {
  const lista = hallazgos.map((h, i) => `${i + 1}. [${h.ref}] ${h.tipo} (confianza ${h.confianza})\n   cita: "${h.cita}"\n   por qué: ${h.por_que}`).join('\n');
  const ya = conocidos?.lineas?.length ? `YA DETECTADO por el validador automático:\n${conocidos.lineas.join('\n')}` : 'YA DETECTADO por el validador automático: nada.';
  return {
    usuario: `${ya}\n\nAMFE:\n\n${proyeccion.texto}\n\nHALLAZGOS A REFUTAR:\n${lista}\n\nDevolvé el JSON con un veredicto por hallazgo.`,
    schema: SCHEMA_REFUTACION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros duros (codigo, no prompt)
// ─────────────────────────────────────────────────────────────────────────────

const normal = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const RE_ACCION_VACIA = /acci[oó]n(es)?[^.]{0,60}(vac[ií]|sin (definir|completar|cargar|accion)|falta|no (hay|tiene|define|est[aá])|pendiente|en blanco|a definir)|(sin|falta|no hay|no tiene) (una )?acci[oó]n/i;
const ORDEN_CONFIANZA = { alta: 0, media: 1, baja: 2 };

/** Una cita alcanza si tiene 4 caracteres o 2 palabras (ya normalizada): "HO 12" si, "TBD" no. */
export const citaSuficiente = (citaNormal) => {
  const c = String(citaNormal ?? '').trim();
  return c.length >= 4 || c.split(' ').filter(Boolean).length >= 2;
};

/**
 * Lo que vuelve del revisor pasa por reglas que no dependen del modelo:
 *   - la ref tiene que existir en la proyeccion;
 *   - la cita tiene que estar TEXTUAL en el AMFE (sin tildes ni mayusculas, espacios colapsados) y
 *     tener al menos 4 caracteres o 2 palabras (`citaSuficiente`: "HO 12", 5 caracteres, es una
 *     cita valida de un control de la casa; con el minimo viejo de 6 se descartaba, smoke 08/10);
 *   - un AP=H/M/L con la accion vacia nunca es hallazgo, diga lo que diga el modelo;
 *   - sin duplicados (ref + tipo), y a lo sumo TOPE_HALLAZGOS_POR_AMFE, los de mas confianza primero.
 * Devuelve { hallazgos, descartados: { sin_ref, sin_cita, ap_sin_accion, tipo_invalido, duplicado, tope } }.
 */
export function filtrarHallazgos(hallazgos, proyeccion) {
  const descartados = { sin_ref: 0, sin_cita: 0, ap_sin_accion: 0, tipo_invalido: 0, duplicado: 0, tope: 0 };
  const textoN = normal(proyeccion.texto);
  const vistos = new Set();
  const buenos = [];
  for (const h of Array.isArray(hallazgos) ? hallazgos : []) {
    if (!h || typeof h !== 'object') continue;
    const causa = proyeccion.causas.get(String(h.ref ?? '').trim());
    if (!causa) { descartados.sin_ref++; continue; }
    if (!TIPOS.includes(h.tipo)) { descartados.tipo_invalido++; continue; }
    const cita = normal(h.cita);
    if (!citaSuficiente(cita) || cita === '(vacio)' || !textoN.includes(cita)) { descartados.sin_cita++; continue; }
    if (causa.accionVacia && RE_ACCION_VACIA.test(`${h.por_que ?? ''} ${h.cita ?? ''}`)) { descartados.ap_sin_accion++; continue; }
    const k = `${causa.ref}|${h.tipo}`;
    if (vistos.has(k)) { descartados.duplicado++; continue; }
    vistos.add(k);
    buenos.push({
      ref: causa.ref, tipo: h.tipo, cita: String(h.cita).trim(), por_que: String(h.por_que ?? '').trim(),
      confianza: ORDEN_CONFIANZA[h.confianza] != null ? h.confianza : 'baja',
      donde: `OP ${causa.opNum} ${causa.opName} / ${causa.we} / ${causa.falla} / ${causa.causa}`,
    });
  }
  buenos.sort((a, b) => ORDEN_CONFIANZA[a.confianza] - ORDEN_CONFIANZA[b.confianza]);
  if (buenos.length > TOPE_HALLAZGOS_POR_AMFE) descartados.tope = buenos.length - TOPE_HALLAZGOS_POR_AMFE;
  return { hallazgos: buenos.slice(0, TOPE_HALLAZGOS_POR_AMFE), descartados };
}

/**
 * Aplica los veredictos del refutador. Un hallazgo sin veredicto se DESCARTA (si el refutador no
 * lo miro, no se le lleva a nadie). Devuelve { mantenidos, descartados: [{...h, motivo}] }.
 */
export function aplicarVeredictos(hallazgos, veredictos) {
  const porClave = new Map();
  for (const vd of Array.isArray(veredictos) ? veredictos : []) {
    if (vd && vd.ref) porClave.set(`${String(vd.ref).trim()}|${vd.tipo}`, vd);
  }
  const mantenidos = [];
  const descartados = [];
  for (const h of hallazgos) {
    const vd = porClave.get(`${h.ref}|${h.tipo}`) || [...porClave.values()].find((x) => String(x.ref).trim() === h.ref);
    if (vd && vd.veredicto === 'se_mantiene') mantenidos.push({ ...h, motivo_refutador: String(vd.motivo ?? '').trim() });
    else descartados.push({ ...h, motivo: vd ? String(vd.motivo ?? '').trim() : 'el refutador no lo miro: se descarta' });
  }
  return { mantenidos, descartados };
}

/** Identidad de un hallazgo entre noches: AMFE + ref + tipo + cita. */
export function claveHallazgo(amfeNumber, h) {
  return crypto.createHash('sha1').update(`${amfeNumber}|${h.ref}|${h.tipo}|${normal(h.cita)}`).digest('hex').slice(0, 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado entre noches y seleccion de que revisar
// ─────────────────────────────────────────────────────────────────────────────

export const estadoInicial = () => ({ revisados: {}, vistos: {} });

/** `estado` puede venir roto: se toma como vacio. */
export function normalizarEstado(estado) {
  const e = estado && typeof estado === 'object' ? estado : {};
  return {
    revisados: e.revisados && typeof e.revisados === 'object' ? { ...e.revisados } : {},
    vistos: e.vistos && typeof e.vistos === 'object' ? { ...e.vistos } : {},
  };
}

/**
 * Que AMFE se revisan esta noche: los que cambiaron (`updated_at` mas nuevo que la ultima
 * revision) o nunca se revisaron. `todos` fuerza la pasada completa; `soloAmfe` limita a uno.
 * Revisar todas las noches los 21 enteros seria gastar en ruido (el mismo documento, los mismos
 * hallazgos): el credito que vence no es motivo para quemarlo.
 */
export function amfesACorrer(filas, estado, { todos = false, soloAmfe = null } = {}) {
  const e = normalizarEstado(estado);
  const lista = Array.isArray(filas) ? filas : [];
  if (soloAmfe) return lista.filter((f) => String(f.amfe_number ?? '').toLowerCase() === String(soloAmfe).toLowerCase());
  if (todos) return lista;
  return lista.filter((f) => {
    const prev = e.revisados[f.amfe_number];
    if (!prev || !prev.updated_at) return true;
    return String(f.updated_at ?? '') > String(prev.updated_at);
  });
}

/** Cuantos AMFE como maximo revisa UNA corrida de la noche (la pasada completa de 21 se reparte en varias noches). */
export const TOPE_AMFE_POR_NOCHE = 6;

const orden = (a, b) => { const x = String(a ?? ''); const y = String(b ?? ''); return x < y ? -1 : x > y ? 1 : 0; };

/**
 * El tope por corrida. De los AMFE que habria que revisar (`aCorrer`, ya filtrados por `amfesACorrer`),
 * se eligen hasta `max`; el resto son `diferidos` y NO se tocan: no entran al estado, asi que la noche
 * siguiente siguen en la lista (o sea: "quedan para la noche siguiente" sin guardar nada aparte).
 *   - modo incremental: los de `updated_at` mas VIEJO primero (desempate por numero), de modo que lo que
 *     cambio hace poco espera y lo que lleva mas tiempo sin mirarse pasa;
 *   - con `todos`: los que NUNCA se revisaron o hace mas que se revisaron, para que repetir la pasada
 *     completa con tope vaya rotando y no revise siempre los mismos.
 * Sin `max` (o 0, o algo que no es un entero), todos entran, en el orden en que vinieron.
 */
export function elegirParaNoche(aCorrer, estado, { max = null, todos = false } = {}) {
  const lista = Array.isArray(aCorrer) ? [...aCorrer] : [];
  const tope = Number.isInteger(max) && max > 0 ? max : null;
  if (!tope || lista.length <= tope) return { elegidos: lista, diferidos: [] };
  const e = normalizarEstado(estado);
  const viejoPrimero = (a, b) => orden(a.updated_at, b.updated_at) || orden(a.amfe_number, b.amfe_number);
  const revisadoDe = (f) => e.revisados[f.amfe_number]?.revisado || '';
  lista.sort(todos ? (a, b) => orden(revisadoDe(a), revisadoDe(b)) || viejoPrimero(a, b) : viejoPrimero);
  return { elegidos: lista.slice(0, tope), diferidos: lista.slice(tope) };
}

/** El estado despues de la noche: que se reviso (con su updated_at) y que hallazgos ya se vieron. */
export function estadoNuevo(estado, resultados, { ahora = new Date(), topeVistos = 3000 } = {}) {
  const e = normalizarEstado(estado);
  const sello = ahora.toISOString();
  for (const r of resultados) {
    if (r.error) continue;
    e.revisados[r.amfe_number] = { updated_at: r.updated_at ?? null, revisado: sello, hallazgos: r.mantenidos.length };
    for (const h of r.mantenidos) e.vistos[claveHallazgo(r.amfe_number, h)] = e.vistos[claveHallazgo(r.amfe_number, h)] || sello;
  }
  const claves = Object.entries(e.vistos).sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, topeVistos);
  e.vistos = Object.fromEntries(claves);
  return e;
}

/** Marca cuales de los mantenidos ya se habian visto otra noche (para que la manana sepa que es nuevo). */
export function marcarNuevos(amfeNumber, mantenidos, estado) {
  const e = normalizarEstado(estado);
  return mantenidos.map((h) => ({ ...h, nuevo: !e.vistos[claveHallazgo(amfeNumber, h)] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimacion (para --simular) y reporte
// ─────────────────────────────────────────────────────────────────────────────

/** Caracteres por token del castellano con el tokenizador viejo (medido en el repo el 08/10/2026). */
export const CARACTERES_POR_TOKEN = 3.5;
/**
 * Los modelos 4.7 en adelante usan un tokenizador que da hasta 30 % MAS tokens para el mismo texto
 * (documentacion de Anthropic, leida el 08/10/2026). Como no se sabe cuanto da en este castellano
 * hasta contarlo con la clave (`count_tokens` es gratis), `--simular` muestra el rango x1,0 a x1,3.
 */
export const MARGEN_TOKENIZADOR = 1.3;

/**
 * Cuantos caracteres entran en un token: BARACK_TOKENS_POR_CARACTER, o 3,5. (El nombre de la variable
 * dice "tokens por caracter" pero lo que se guarda es el recorrido inverso, caracteres por token: es
 * el numero que se mide y se recalibra con `count_tokens`.) Un valor fuera de 1 a 10 se ignora.
 */
export function caracteresPorToken(env = process.env) {
  const v = Number(String(env?.BARACK_TOKENS_POR_CARACTER ?? '').trim().replace(',', '.'));
  return Number.isFinite(v) && v >= 1 && v <= 10 ? v : CARACTERES_POR_TOKEN;
}

/** Tokens aproximados de un texto en castellano (3,5 caracteres por token por defecto). Solo para estimar. */
export const tokensAprox = (texto, { env = process.env } = {}) => Math.ceil(String(texto ?? '').length / caracteresPorToken(env));

/** El tope de un rango de tokens APROXIMADOS (x1,3). Lo medido con `count_tokens` no se infla. */
export const tokensConMargen = (tokens) => Math.ceil(Number(tokens || 0) * MARGEN_TOKENIZADOR);

const fechaCorta = (iso) => String(iso ?? '').slice(0, 16).replace('T', ' ');

/**
 * El archivo para la SESION DE LA MANANA. Dice arriba para quien es y que hacer con el. Nunca se
 * le manda a Fak tal cual: el verifica contra la fuente y lleva 4 renglones.
 */
export function armarReporte({ fecha, resultados, saltados = [], diferidos = [], enCurso = 0, costoUsd = 0, presupuesto = null, estado } = {}) {
  const L = [];
  const total = resultados.reduce((s, r) => s + (r.mantenidos?.length || 0), 0);
  const nuevos = resultados.reduce((s, r) => s + (r.mantenidos?.filter((h) => h.nuevo).length || 0), 0);
  const errores = resultados.filter((r) => r.error);
  L.push(`# Pre-auditoría nocturna de AMFE — ${fecha}`, '');
  L.push('**Para la sesión de Claude de la mañana, no para Fak.** Cada hallazgo de acá lo señaló un modelo (Sonnet) y lo dejó pasar otro (Opus) tratando de refutarlo; igual es una CANDIDATA, no una verdad. Antes de decir una palabra: abrir el AMFE en Supabase, verificar la cita contra la fuente, descartar lo que sea convención de la casa, y llevarle a Fak solo lo confirmado, en 4 renglones, sin informe. Nada de acá se aplica solo. Un AP=H sin acción nunca es hallazgo.', '');
  L.push(`- AMFE revisados esta noche: ${resultados.length - errores.length}${saltados.length ? ` · sin cambios desde la última revisión (no se tocaron): ${saltados.length}` : ''}${errores.length ? ` · con error: ${errores.length}` : ''}`);
  if (diferidos.length) {
    const nombres = diferidos.slice(0, 8).map((d) => d.amfe_number ?? d).join(', ');
    L.push(`- Quedaron para la próxima noche (tope por noche): ${diferidos.length} (${nombres}${diferidos.length > 8 ? ', …' : ''})`);
  }
  if (enCurso > 0) L.push(`- De esta corrida NO terminaron: ${enCurso} (si la corrida ya terminó, se cortó antes: lo revisado hasta acá quedó guardado y el resto vuelve a entrar la próxima noche)`);
  L.push(`- Hallazgos que sobrevivieron al refutador: ${total} (${nuevos} nuevos; el resto ya se había visto otra noche)`);
  L.push(`- Costo de la noche: $${costoUsd.toFixed(2)}${presupuesto ? ` · ${presupuesto.ciclo?.texto ?? 'mes'}: $${presupuesto.gastadoUsd.toFixed(2)} de $${presupuesto.presupuestoUsd} (${presupuesto.semaforo})` : ''}`);
  L.push('');
  for (const r of resultados) {
    L.push(`## ${r.amfe_number} — ${r.project_name || ''}`.trim());
    L.push(`_actualizado en Supabase: ${fechaCorta(r.updated_at)} · ${r.operaciones ?? '?'} operaciones · validador: ${r.conocidos?.criticos ?? '?'} críticos / ${r.conocidos?.avisos ?? '?'} avisos_`);
    if (r.error) { L.push('', `ERROR: ${r.error}`, ''); continue; }
    if (!r.mantenidos.length) {
      L.push('', `Sin hallazgos que sobrevivan. (El revisor propuso ${r.propuestos ?? 0}; el filtro de código descartó ${r.descartadosCodigo ?? 0} y el refutador ${r.descartadosRefutador ?? 0}.)`, '');
      continue;
    }
    L.push('');
    r.mantenidos.forEach((h, i) => {
      L.push(`${i + 1}. ${h.nuevo ? '**NUEVO** · ' : ''}${TIPO_LEGIBLE[h.tipo] || h.tipo} · confianza ${h.confianza} · \`${h.ref}\``);
      L.push(`   - dónde: ${h.donde}`);
      L.push(`   - cita: "${h.cita}"`);
      L.push(`   - por qué: ${h.por_que}`);
      if (h.motivo_refutador) L.push(`   - el refutador lo dejó pasar porque: ${h.motivo_refutador}`);
    });
    L.push('', `_(propuestos ${r.propuestos ?? 0} · descartó el código ${r.descartadosCodigo ?? 0} · descartó el refutador ${r.descartadosRefutador ?? 0})_`, '');
  }
  if (estado) L.push(`_Estado: ${Object.keys(estado.revisados || {}).length} AMFE con revisión registrada · ${Object.keys(estado.vistos || {}).length} hallazgos vistos en total._`);
  return `${L.join('\n').trimEnd()}\n`;
}

/** Una linea para el tablero: lo que paso, sin adjetivos. */
export function lineaResumen({ revisados = 0, saltados = 0, diferidos = 0, hallazgos = 0, nuevos = 0, errores = 0, costoUsd = 0 } = {}) {
  const partes = [`pre-auditoría AMFE: ${revisados} revisado${revisados === 1 ? '' : 's'}`];
  if (saltados) partes.push(`${saltados} sin cambios`);
  if (diferidos) partes.push(`${diferidos} para la próxima noche`);
  partes.push(hallazgos ? `${hallazgos} hallazgo${hallazgos === 1 ? '' : 's'} para verificar (${nuevos} nuevo${nuevos === 1 ? '' : 's'})` : 'sin hallazgos que sobrevivan');
  if (errores) partes.push(`${errores} con error`);
  partes.push(`$${costoUsd.toFixed(2)}`);
  return partes.join(' · ');
}

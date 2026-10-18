/**
 * aptitudMaquina.mjs — la CUENTA del control estadistico preliminar (aptitud de maquina), con el criterio del
 * instructivo de la casa. Logica pura: la usan `scripts/_aptitudMaquina.mjs` y su test.
 *
 * Tanda 13, item 2 (equipo «fuera de la caja», 15/10/2026): la cuenta y el criterio ya estaban escritos en la memoria
 * `project_estudio_agujero_insert_patagonia` y se rehacian a mano cada vez. Caso de respuesta conocida, 28/07/2026:
 * distancia al borde 12,04 · 13,10 · 13,10 · 13,72 -> promedio 12,99 · recorrido 1,68 · s 0,70 (s MUESTRAL, n-1: la
 * poblacional daria 0,60).
 *
 * ES UNA CALCULADORA, NO EL ESTUDIO. El I-AC-021 es un instructivo de Calidad (sigla I-AC): el estudio lo hace el grupo
 * de trabajo, con su planilla, su evaluacion del sistema de medicion y su software (softcep o spc1). Esto solo hace la
 * cuenta y dice, con las palabras del instructivo, si la muestra alcanza.
 *
 * El criterio sale del instructivo, no de mi (extracto local del 01/10/2026:
 * `.sgc-cache/claude-por-area/examen/_demo-anterior-1005-141546/publicado/conocimiento/comun/extractos/
 *  I-AC-021 Control estadistico preliminar.md`, original
 * `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\SISTEMA\SISTEMA SGC\Instructivos\CALIDAD\I-AC-021 Control estadistico preliminar A.doc`, rev A):
 *   - «Recolectar y graficar los 25 primeros subgrupos» y calcular los limites de control preliminares (paso 3).
 *   - Referencia 3: «el tamaño del subgrupo debera ser de 5 piezas» (en todos los casos).
 *   - Referencia 4: limites TENTATIVOS con los ocho primeros subgrupos, «excepto cuando la medicion se haga en forma
 *     consecutiva».
 *   - Paso 4: si el proceso no es estable, el grupo de trabajo analiza las causas; estabilidad y normalidad, con softcep
 *     o spc1. Recien con proceso estable y distribucion normal se calculan PP y PPK (paso 5): PP y PPK >= 1,67.
 *   - Referencia 5: con graficos de medias moviles y rangos, PP y PPK >= 1,33 (esta calculadora no arma ese grafico).
 *
 * Constantes de la carta X-R para subgrupos de 5: A2 = 0,577, D3 = 0, D4 = 2,114 (manual SPC de AIAG, 2.a ed., apendice
 * de constantes). La normalidad NO se calcula aca: lo dice la salida.
 */

export const SUBGRUPO = 5;               // I-AC-021, referencia 3
export const SUBGRUPOS_PRELIMINARES = 25; // I-AC-021, paso 3
export const SUBGRUPOS_TENTATIVOS = 8;    // I-AC-021, referencia 4
export const PP_MINIMO = 1.67;            // I-AC-021, paso 5
export const PP_MINIMO_MEDIAS_MOVILES = 1.33; // I-AC-021, referencia 5
export const CONSTANTES_N5 = Object.freeze({ A2: 0.577, D3: 0, D4: 2.114 });

export const AVISO = 'Es la cuenta, no el estudio: el control estadistico preliminar (I-AC-021) es de Calidad y lo hace el grupo de trabajo con su planilla y su software.';

/** Numero con coma decimal y 2 decimales (como escribe la casa). */
export const coma = (x, dec = 2) => (Number.isFinite(x) ? x.toFixed(dec).replace('.', ',') : '—');

/**
 * Texto -> lista de valores. Separadores: espacios, punto y coma, tabulador o salto de linea. La coma es DECIMAL
 * (12,04); tambien se acepta el punto (12.04). Un token con dos comas («12,04,13,10») o con letras es un error: no se
 * adivina donde se corta un numero.
 */
export function parsearValores(texto) {
  const tokens = String(texto ?? '').split(/[\s;]+/).map((t) => t.trim()).filter(Boolean);
  const valores = tokens.map((t) => {
    if (!/^-?\d+([.,]\d+)?$/.test(t)) {
      throw new Error(`no entiendo el valor "${t}": van numeros separados por espacio o punto y coma (la coma es decimal: 12,04)`);
    }
    return Number(t.replace(',', '.'));
  });
  if (!valores.length) throw new Error('no hay ningun valor');
  return valores;
}

const suma = (a) => a.reduce((s, x) => s + x, 0);

/** Resumen de una lista: n, promedio, recorrido, desvio MUESTRAL (n-1), minimo y maximo. */
export function resumen(valores) {
  if (!Array.isArray(valores) || !valores.length || valores.some((x) => !Number.isFinite(x))) {
    throw new Error('el resumen necesita una lista de numeros');
  }
  const n = valores.length;
  const media = suma(valores) / n;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const s = n > 1 ? Math.sqrt(suma(valores.map((x) => (x - media) ** 2)) / (n - 1)) : NaN;
  return { n, media, recorrido: max - min, s, min, max };
}

/** Parte la lista en subgrupos de 5 en el orden en que se tomaron; lo que no completa un subgrupo queda aparte. */
export function subgrupos(valores, tam = SUBGRUPO) {
  const grupos = [];
  for (let i = 0; i + tam <= valores.length; i += tam) grupos.push(valores.slice(i, i + tam));
  return { grupos, sobran: valores.length % tam };
}

/** Limites de la carta X-R con los subgrupos dados (de 5). */
export function limitesXR(grupos) {
  const { A2, D3, D4 } = CONSTANTES_N5;
  const medias = grupos.map((g) => suma(g) / g.length);
  const rangos = grupos.map((g) => Math.max(...g) - Math.min(...g));
  const xbb = suma(medias) / medias.length;
  const rb = suma(rangos) / rangos.length;
  const lim = {
    xbb, rb,
    lcsX: xbb + A2 * rb, lciX: xbb - A2 * rb,
    lcsR: D4 * rb, lciR: D3 * rb,
  };
  const fuera = [];
  medias.forEach((m, i) => { if (m > lim.lcsX || m < lim.lciX) fuera.push({ subgrupo: i + 1, que: 'promedio', valor: m }); });
  rangos.forEach((r, i) => { if (r > lim.lcsR || r < lim.lciR) fuera.push({ subgrupo: i + 1, que: 'recorrido', valor: r }); });
  return { ...lim, medias, rangos, fuera };
}

/**
 * PP y PPK con el desvio total (muestral) de todos los valores. Con una sola tolerancia se calcula solo PPK de ese
 * lado; sin ninguna, nada (la tolerancia la dice el plano o el plan de control, no esta cuenta).
 */
export function aptitud({ media, s }, { lie, lse } = {}) {
  const hayLie = Number.isFinite(lie);
  const hayLse = Number.isFinite(lse);
  if (!hayLie && !hayLse) return null;
  if (hayLie && hayLse && lse <= lie) throw new Error(`la tolerancia superior (${lse}) tiene que ser mayor que la inferior (${lie})`);
  if (!(s > 0)) return { pp: NaN, ppk: NaN, motivo: 'el desvio es cero: con todas las piezas iguales no se puede calcular' };
  const pp = hayLie && hayLse ? (lse - lie) / (6 * s) : NaN;
  const lados = [];
  if (hayLse) lados.push((lse - media) / (3 * s));
  if (hayLie) lados.push((media - lie) / (3 * s));
  return { pp, ppk: Math.min(...lados) };
}

/**
 * El estudio entero sobre una lista de valores en el orden en que se tomaron.
 *   nivel: 'insuficiente' (menos de 8 subgrupos) | 'tentativo' (8 a 24) | 'preliminar' (25 o mas)
 *   estable: solo con limites calculados (sin puntos fuera de los limites del X-R; es la regla 1, la unica que se mira)
 *   aptitud: solo en 'preliminar', estable y con tolerancia
 */
export function estudio(valores, { lie, lse } = {}) {
  const res = resumen(valores);
  const { grupos, sobran } = subgrupos(valores);
  const k = grupos.length;
  const out = { resumen: res, subgrupos: k, sobran, nivel: 'insuficiente', limites: null, estable: null, aptitud: null, avisos: [] };
  if (k < SUBGRUPOS_TENTATIVOS) {
    out.avisos.push(`MUESTRA INSUFICIENTE: ${res.n} valores son ${k} subgrupo(s) de ${SUBGRUPO}. El I-AC-021 pide ${SUBGRUPOS_PRELIMINARES} subgrupos (${SUBGRUPOS_PRELIMINARES * SUBGRUPO} piezas) para los limites preliminares y deja trazar limites tentativos desde ${SUBGRUPOS_TENTATIVOS} (${SUBGRUPOS_TENTATIVOS * SUBGRUPO} piezas). Con esto no hay limites ni aptitud: solo el resumen.`);
    return out;
  }
  out.nivel = k >= SUBGRUPOS_PRELIMINARES ? 'preliminar' : 'tentativo';
  const usados = out.nivel === 'preliminar' ? grupos.slice(0, SUBGRUPOS_PRELIMINARES) : grupos;
  out.limites = limitesXR(usados);
  out.estable = out.limites.fuera.length === 0;
  if (out.nivel === 'tentativo') {
    out.avisos.push(`LIMITES TENTATIVOS (${k} subgrupos): el I-AC-021 los permite desde ${SUBGRUPOS_TENTATIVOS} subgrupos, salvo que la medicion se haya hecho en forma consecutiva. PP y PPK recien con ${SUBGRUPOS_PRELIMINARES} subgrupos.`);
  } else if (k > SUBGRUPOS_PRELIMINARES) {
    out.avisos.push(`Los limites salen de los ${SUBGRUPOS_PRELIMINARES} primeros subgrupos (I-AC-021, paso 3); hay ${k - SUBGRUPOS_PRELIMINARES} subgrupo(s) mas que no entran en la cuenta de los limites.`);
  }
  if (sobran) out.avisos.push(`Quedan ${sobran} valor(es) al final que no completan un subgrupo de ${SUBGRUPO}: entran en el resumen, no en la carta.`);
  if (!out.estable) {
    out.avisos.push(`PROCESO NO ESTABLE: ${out.limites.fuera.length} punto(s) fuera de los limites de la carta. El I-AC-021 (paso 4) dice que el grupo de trabajo analiza e identifica las causas: no se calcula PP ni PPK.`);
    return out;
  }
  if (out.nivel === 'preliminar') {
    // PP y PPK con los MISMOS valores con que se miro la estabilidad (los 25 subgrupos de la carta): un subgrupo 26 o los
    // valores que sobran nunca se verificaron estables y no entran en la aptitud (revision de la sesion madre, 17/10).
    const delEstudio = resumen(usados.flat());
    out.resumenAptitud = delEstudio;
    if (delEstudio.n < res.n) out.avisos.push(`PP y PPK salen de los ${delEstudio.n} valores de los ${SUBGRUPOS_PRELIMINARES} subgrupos de la carta; los otros ${res.n - delEstudio.n} no entran (no se verifico que esten estables).`);
    const ap = aptitud(delEstudio, { lie, lse });
    if (!ap) {
      out.avisos.push('Sin tolerancia no se calcula PP ni PPK: pasar --lie y/o --lse (salen del plano o del plan de control).');
    } else {
      out.aptitud = { ...ap, minimo: PP_MINIMO };
      out.avisos.push(`La normalidad no la verifica esta cuenta: el I-AC-021 (paso 4) la pide con softcep o spc1 antes de tomar PP y PPK. Con graficos de medias moviles el minimo es ${coma(PP_MINIMO_MEDIAS_MOVILES)} (referencia 5); esta carta es X-R.`);
    }
  }
  return out;
}

/** Texto para la consola. */
export function informe(e) {
  const r = e.resumen;
  const l = [];
  l.push(`Valores: ${r.n} · promedio ${coma(r.media)} · recorrido ${coma(r.recorrido)} · s ${coma(r.s)} (muestral, n-1) · minimo ${coma(r.min)} · maximo ${coma(r.max)}`);
  l.push(`Subgrupos de ${SUBGRUPO}: ${e.subgrupos}${e.sobran ? ` (sobran ${e.sobran})` : ''} · nivel: ${e.nivel}`);
  if (e.limites) {
    const x = e.limites;
    l.push(`Carta X-R: promedio de promedios ${coma(x.xbb, 3)} · LCS ${coma(x.lcsX, 3)} · LCI ${coma(x.lciX, 3)} | recorrido medio ${coma(x.rb, 3)} · LCS ${coma(x.lcsR, 3)} · LCI ${coma(x.lciR, 3)}`);
    for (const f of x.fuera) l.push(`  fuera de limites: subgrupo ${f.subgrupo}, ${f.que} ${coma(f.valor, 3)}`);
  }
  if (e.aptitud) {
    const a = e.aptitud;
    const cumple = (v) => (Number.isFinite(v) ? (v >= a.minimo ? 'llega' : 'NO llega') : '');
    l.push(`PP ${coma(a.pp)} ${cumple(a.pp)} · PPK ${coma(a.ppk)} ${cumple(a.ppk)} (el I-AC-021 pide ${coma(a.minimo)} o mas)${a.motivo ? ` · ${a.motivo}` : ''}`);
  }
  for (const a of e.avisos) l.push(a);
  l.push(AVISO);
  return l.join('\n');
}

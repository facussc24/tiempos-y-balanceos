/**
 * planControlAmfe.mjs — el cruce AMFE <-> plan de control (P6, etapa 2).
 *
 * Por que existe. Fak, 10/10/2026 18:58: *"los controles de deteccion del AMFE no coinciden con los
 * del plan de control, o los AMFE tienen controles medio inventados o genericos"*. Y el 06/10 el
 * plan de Calidad del APB tenia la columna de caracteristicas especiales vacia y un control final
 * que miraba la costura oculta («4 en 16 mm») en vez de la vista («6 en 25 ±0,5»).
 *
 * Que hace (plan `docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md` §7.1, §7.2, §7.4 etapa 2 y §7.6),
 * siempre sobre el JSON intermedio de `planControlCheck.mjs` y sin tocar el AMFE ni Supabase:
 *   - `propuestaDeSiglas()`: la HOJA APARTE. Por caracteristica (operacion + falla) y causa: la S
 *     maxima de la falla, la O, el nivel que da el criterio de la casa y la regla. NO asigna nada:
 *     la columna del plan solo se copia del `specialChar` de las causas vinculadas por id, y lo
 *     controla `gate3Siglas()`. El criterio sale de `core/amfe/caracteristicasEspeciales.data.json`
 *     via `amfeValidator.mjs` (fuente unica: no se duplica aca).
 *   - `gate7ControlFinal()`: el control final acepta solo caracteristicas que una fuente marca
 *     apariencia o funcion (declaradas en las entradas, con su cita). Nada de heuristica por palabras.
 *   - `cruceAmfePlan()` / `gate8AmfeVsPlan()`: tres capas. (1) vinculo por id; (2) instrumento +
 *     frecuencia, identificados por codigo MC### o termino exacto del canon; (3) el texto se
 *     muestra y nunca decide. Estados: OK · GENERICO · DIFERENTE · SIN FILA · SIN CAUSA.
 *   - `casosCruce()`: los seis chequeos del §7.6, con el criterio de la casa (critica = S 9-10).
 *
 * Los hallazgos salen con la misma forma que los de la etapa 1: { gate, nivel, op, itemId, mensaje }.
 */
import { nivelPorCriterio, nivelDeSigla, normalizarSigla, esSinMarca, CARACTERISTICAS_ESPECIALES } from './amfeValidator.mjs';
import { sinAcentos } from './amfeAutoria.mjs';
import { TBD, CONFLICTO, FRENO, AVISO } from './planControlCheck.mjs';
import { CANON, instrumentoDe, frecuenciasDe, esIdentificable } from './controlCanon.mjs';

// el catalogo y la identificacion de un control viven en controlCanon.mjs (los comparte el validador de AMFE)
export { CANON, instrumentoDe, frecuenciasDe, esIdentificable };


/** Los cinco del §7.2 mas FILA SIN METODO (revision por la API, 11/10/2026): vinculo hecho y la fila sin instrumento con papel; no es SIN FILA porque el arreglo es otro. */
export const ESTADOS = ['OK', 'GENERICO', 'DIFERENTE', 'FILA SIN METODO', 'SIN FILA', 'SIN CAUSA'];
const norm = (s) => sinAcentos(String(s ?? '')).replace(/\s+/g, ' ').trim();
const h = (gate, nivel, op, itemId, mensaje) => ({ gate, nivel, op: String(op ?? ''), itemId: itemId || '', mensaje });
const sinValor = (v) => v === TBD || v === CONFLICTO || v === '' || v === null || v === undefined;
const esCritica = (causa) => Number(causa.S) >= CARACTERISTICAS_ESPECIALES.criterio.CRITICA.severidad_min;

// ---------------------------------------------------------------------------
// Identificar un control: codigo de calibracion o termino exacto del canon
// ---------------------------------------------------------------------------

/**
 * El plan cubre el instrumento del AMFE: mismo codigo si los dos lo traen, y TODOS los tipos que
 * declara el AMFE estan en el plan (un «visual + calibre» contra una fila con solo balanza no es
 * lo mismo). Un lado con solo codigo y el otro con solo tipo: no se puede afirmar que sea el mismo.
 */
function planCubre(amfe, plan) {
  if (amfe.codigo && plan.codigo && amfe.codigo !== plan.codigo) return false;
  if (amfe.tipos.length && plan.tipos.length) return amfe.tipos.every((x) => plan.tipos.includes(x));
  return !!amfe.codigo && amfe.codigo === plan.codigo;
}
/** Un lado trae solo el codigo y el otro solo el tipo: no hay con que comparar. */
const sinBaseParaComparar = (amfe, plan) => !(amfe.codigo && plan.codigo) && !(amfe.tipos.length && plan.tipos.length);
const nombreIns = (ins) => (ins ? [ins.codigo, ...(ins.tipos || []), ...(ins.referencias || []).map((r) => `ref. ${r}`)].filter(Boolean).join(' + ') || '(sin instrumento)' : '(sin instrumento)');

// ---------------------------------------------------------------------------
// Propuesta de siglas (hoja aparte) y gate 3
// ---------------------------------------------------------------------------

const REGLA = {
  CRITICA: `critica: ${CARACTERISTICAS_ESPECIALES.criterio.CRITICA.texto}`,
  SIGNIFICATIVA: `significativa: ${CARACTERISTICAS_ESPECIALES.criterio.SIGNIFICATIVA.texto}`,
  NINGUNA: 'ninguna: S menor a 5, o S 5 a 8 con O menor a 4',
};

/** Sigla normalizada de una causa, o '' si la celda dice "sin caracteristica" ("-", "N/A", vacio). */
export const siglaDe = (raw) => (esSinMarca(raw) ? '' : normalizarSigla(raw));

/**
 * La propuesta por criterio, causa por causa. No asigna: muestra S, O y la regla al lado de la
 * sigla que la causa YA tiene en el AMFE, y marca la diferencia. La S es la del MODO DE FALLA
 * (la comparten todas sus causas: es la que usa el validador de la casa); si una causa arrastra
 * una severity propia distinta, se informa y no se usa. Para una critica, la MARCA (D/TLD) la
 * designa el cliente en el plano: aca solo se dice el nivel.
 *
 * Las diferencias son las mismas que frena `amfeValidator.mjs` (CAUSE_SC_FUERA_DE_REGLA,
 * CAUSE_CC_LOW_SEVERITY, SIGLA_DESCONOCIDA) mas las candidatas: un test las compara.
 */
export function propuestaDeSiglas(plan) {
  const causas = plan.catalog?.amfeCauses || [];
  const filas = causas.map((c) => {
    const S = Number(c.S);
    const nivel = nivelPorCriterio(S, c.O);
    const sigla = siglaDe(c.specialChar);
    const nivelActual = sigla ? nivelDeSigla(sigla) : null;
    const diferencias = [];
    if (sigla && !nivelActual) diferencias.push('SIGLA_DESCONOCIDA');
    else if (nivelActual === 'CRITICA' && nivel !== 'CRITICA') diferencias.push(c.specialCharSource ? 'CRITICA_DESIGNADA_POR_EL_CLIENTE_CON_S_MENOR_A_9' : 'SIGLA_FUERA_DE_REGLA');
    // SC, OS y HI comparten el criterio de la significativa (S 5 a 8 y O >= 4)
    else if (sigla && nivelActual !== 'CRITICA' && nivel !== 'SIGNIFICATIVA') diferencias.push('SIGLA_FUERA_DE_REGLA');
    if (!sigla && nivel) diferencias.push('CANDIDATA_SIN_SIGLA');
    if (c.SCausa !== null && c.SCausa !== undefined && Number(c.SCausa) !== S) diferencias.push('S_PROPIA_EN_LA_CAUSA');
    return {
      op: c.op, caracteristica: c.falla, fallaId: c.fallaId || '', causeId: c.id, causa: c.causa,
      S, SCausa: c.SCausa ?? null, O: Number(c.O),
      nivelPorCriterio: nivel || '', regla: REGLA[nivel || 'NINGUNA'],
      siglaActual: sigla, nivelActual: nivelActual || '', designadaPor: c.specialCharSource || '',
      diferencias,
      nota: nivel === 'CRITICA' ? 'la marca de una critica (D/TLD para VW) la designa el cliente en el plano, que no se leyo: aca va solo el nivel' : '',
      enPlan: plan.items.filter((i) => (i.amfeCauseIds || []).includes(c.id)).map((i) => i.key),
    };
  });
  const cuenta = (f) => filas.filter(f).length;
  const deSigla = (x) => x.diferencias.some((d) => d.startsWith('SIGLA') || d.startsWith('CRITICA_'));
  return {
    filas,
    resumen: {
      causas: filas.length,
      conSigla: cuenta((x) => x.siglaActual),
      coinciden: cuenta((x) => x.siglaActual && !deSigla(x)),
      siglaFueraDeRegla: cuenta((x) => x.diferencias.includes('SIGLA_FUERA_DE_REGLA')),
      siglaDesconocida: cuenta((x) => x.diferencias.includes('SIGLA_DESCONOCIDA')),
      candidatasSinSigla: cuenta((x) => x.diferencias.includes('CANDIDATA_SIN_SIGLA')),
      criticasPorCriterio: cuenta((x) => x.nivelPorCriterio === 'CRITICA'),
      sPropiaEnLaCausa: cuenta((x) => x.diferencias.includes('S_PROPIA_EN_LA_CAUSA')),
      vinculadasAlPlan: cuenta((x) => x.enPlan.length),
    },
  };
}

/** Las siglas de la columna de una fila, tal como se escriben (`SC + D/TLD`), a lista normalizada. */
const siglasDeColumna = (texto) => String(texto || '').split(' + ').map(siglaDe).filter(Boolean);

/**
 * Gate 3 (§7.1 corregido): la columna de clasificacion de cada fila es EXACTAMENTE la union de los
 * `specialChar` de sus causas vinculadas. Una sigla de mas (calculada, heredada, tipeada) frena;
 * una de menos tambien. Una fila sin vinculo lleva la columna vacia. Y una sigla que ninguna
 * fuente reconoce (W, Wichtig) no pasa a la columna aunque el AMFE la tenga: frena.
 */
export function gate3Siglas(plan) {
  const out = [];
  const causas = new Map((plan.catalog?.amfeCauses || []).map((c) => [c.id, c]));
  for (const item of plan.items) {
    const esperadas = [...new Set((item.amfeCauseIds || []).map((id) => siglaDe(causas.get(id)?.specialChar)).filter(Boolean))].sort();
    const tiene = [...new Set((item.classification || []).map(siglaDe).filter(Boolean))].sort();
    const texto = [...new Set(siglasDeColumna(item.specialCharClass))].sort();
    if (tiene.join('|') !== esperadas.join('|') || texto.join('|') !== esperadas.join('|')) {
      out.push(h('gate3', FRENO, item.processStepNumber, item.id, `clasificacion "${item.specialCharClass || tiene.join(' + ') || '(vacia)'}" distinta de las siglas de sus causas vinculadas (${esperadas.join(' + ') || 'ninguna'}): la columna solo se copia del AMFE`));
    }
    for (const s of tiene.filter((x) => !nivelDeSigla(x))) out.push(h('gate3', FRENO, item.processStepNumber, item.id, `la sigla "${s}" no es de ninguna fuente (I-AC-005, AIAG-VDA, VW): no se copia al plan, se corrige en el AMFE`));
    for (const id of item.amfeCauseIds || []) if (!causas.has(id)) out.push(h('gate3', FRENO, item.processStepNumber, item.id, `la fila cita la causa ${id}, que no esta en el AMFE leido`));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gate 7: el control final mira lo que una fuente marca apariencia / funcion
// ---------------------------------------------------------------------------

const numerosDe = (texto) => (String(texto ?? '').match(/\d+(?:[.,]\d+)?/g) || []).map((n) => String(Number(n.replace(',', '.'))));
/** Las claves aparecen en el texto EN ESE ORDEN («16x4» no es «4 en 16»). */
const enOrden = (nums, claves) => { let i = 0; for (const n of nums) if (n === String(Number(String(claves[i]).replace(',', '.')))) { i += 1; if (i === claves.length) return true; } return false; };

/**
 * La caracteristica declarada que corresponde a un texto: aquella cuyas `claves` (los numeros que
 * la identifican, escritos en las entradas) estan TODAS en el texto. Si dos empatan, ninguna
 * (ambigua). No hay otra forma de coincidir: sin claves declaradas, no hay coincidencia.
 */
export function caracteristicaDeclaradaDe(texto, declaradas) {
  const nums = numerosDe(texto);
  const candidatas = (declaradas || []).filter((d) => (d.claves || []).length && enOrden(nums, d.claves));
  if (!candidatas.length) return { declarada: null, ambigua: false };
  const max = Math.max(...candidatas.map((d) => d.claves.length));
  const mejores = candidatas.filter((d) => d.claves.length === max);
  return mejores.length === 1 ? { declarada: mejores[0], ambigua: false } : { declarada: null, ambigua: true };
}

const VISIBLES = ['apariencia', 'funcion'];

/**
 * Gate 7. Sobre las filas de control final del plan generado: con valor y marcada apariencia /
 * funcion pasa; marcada OCULTA frena («mira la oculta»); con valor y sin marca frena (no se acepta
 * lo que ninguna fuente marco); TBD avisa. Sobre el plan existente de Calidad (diagnostico): la
 * oculta frena y lo que falta marcar se lista.
 */
export function gate7ControlFinal(plan, { planExistente = null } = {}) {
  const out = [];
  const legibles = new Set(plan.sources.filter((s) => s.readable).map((s) => s.id));
  const todas = plan.catalog?.declaredCharacteristics || [];
  const declaradas = todas.filter((d) => legibles.has(d.fuente?.sourceId));
  for (const d of todas.filter((x) => !legibles.has(x.fuente?.sourceId))) out.push(h('gate7', FRENO, '', '', `la caracteristica declarada "${d.descripcion}" cita ${d.fuente?.sourceId ?? '(sin fuente)'}, que no esta entre las fuentes leidas: no se usa`));
  // la fila de set up del puesto de control final no es una caracteristica de la pieza
  const finales = plan.items.filter((i) => i.section === 'final' && i.rowKind !== 'setup');
  if (!finales.length) out.push(h('gate7', AVISO, '', '', 'el plan no tiene filas de control final'));
  if (!declaradas.some((d) => VISIBLES.includes(d.visibilidad))) out.push(h('gate7', AVISO, '', '', 'ninguna caracteristica esta marcada apariencia o funcion en una fuente: el control final no tiene contra que aceptarse'));
  const juzgar = (texto, op, itemId, donde, generado) => {
    const { declarada, ambigua } = caracteristicaDeclaradaDe(texto, declaradas);
    if (declarada?.visibilidad === 'oculta') out.push(h('gate7', FRENO, op, itemId, `${donde}: "${String(texto).slice(0, 70)}" es ${declarada.descripcion}, que ${declarada.fuente.sourceId} marca OCULTA: el control final mira lo que se ve o funciona${declarada.enSuLugar ? ` (${declarada.enSuLugar})` : ''}`));
    else if (declarada && VISIBLES.includes(declarada.visibilidad)) return;
    else out.push(h('gate7', generado ? FRENO : AVISO, op, itemId, `${donde}: "${String(texto).slice(0, 70)}" ${ambigua ? 'coincide con mas de una caracteristica declarada' : 'no esta marcada apariencia ni funcion en ninguna fuente'}: falta marcarla`));
  };
  // plan generado: la fila de control final se acepta por REFERENCIA (`characteristicRef` = id de una
  // caracteristica declarada), no por su texto. Sin referencia no pasa; una oculta, tampoco.
  for (const item of finales) {
    const texto = !sinValor(item.specification) ? item.specification : item.productCharacteristic;
    if (sinValor(texto)) { out.push(h('gate7', AVISO, item.processStepNumber, item.id, `control final ${item.characteristicNumber}: sin caracteristica definida (TBD)`)); continue; }
    const donde = `control final ${item.characteristicNumber} "${String(texto).slice(0, 60)}"`;
    const d = declaradas.find((x) => x.id === item.characteristicRef);
    if (!item.characteristicRef) out.push(h('gate7', FRENO, item.processStepNumber, item.id, `${donde}: sin referencia a una caracteristica marcada apariencia o funcion en una fuente`));
    else if (!d) out.push(h('gate7', FRENO, item.processStepNumber, item.id, `${donde}: cita la caracteristica ${item.characteristicRef}, que no esta declarada con una fuente leida`));
    else if (!VISIBLES.includes(d.visibilidad)) out.push(h('gate7', FRENO, item.processStepNumber, item.id, `${donde}: es ${d.descripcion}, que ${d.fuente.sourceId} marca ${String(d.visibilidad).toUpperCase()}: el control final mira lo que se ve o funciona${d.enSuLugar ? ` (${d.enSuLugar})` : ''}`));
  }
  const opsFinal = new Set(plan.items.filter((i) => i.section === 'final').map((i) => i.processStepNumber));
  for (const f of (planExistente?.filas || []).filter((x) => x.ops.some((o) => opsFinal.has(o)) && x.spec)) {
    juzgar(f.spec, f.ops.join('-'), '', `plan existente fila ${f.fila}`, false);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gate 8: AMFE <-> plan, en tres capas
// ---------------------------------------------------------------------------

/**
 * El cruce completo. Una entrada por cada par causa-fila vinculado (OK / GENERICO / DIFERENTE /
 * FILA SIN METODO), una por cada causa cuyo control de DETECCION no tiene fila vinculada (SIN FILA:
 * un vinculo solo de prevencion no la cubre) y una por cada fila sin causa (SIN CAUSA, con su
 * grupo: recepcion, requisito de cliente, proceso).
 *
 * OK quiere decir «el instrumento y la frecuencia coinciden»; que la fila mida la MISMA
 * caracteristica lo afirma el vinculo, que es humano.
 */
export function cruceAmfePlan(plan, canon = CANON) {
  const causas = plan.catalog?.amfeCauses || [];
  const porId = new Map(causas.map((c) => [c.id, c]));
  const pares = [];
  for (const item of plan.items) {
    const links = item.amfeLinks?.length ? item.amfeLinks : (item.amfeCauseIds || []).map((causeId) => ({ causeId, control: item.rowKind === 'setup' ? 'prevencion' : 'deteccion' }));
    for (const link of links) {
      const c = porId.get(link.causeId);
      if (!c) continue;
      const textoAmfe = link.control === 'prevencion' ? c.preventionControl : c.detectionControl;
      const textoPlan = [item.evaluationTechnique, item.sampleFrequency].filter((x) => !sinValor(x)).join(' · ');
      const insAmfe = instrumentoDe(textoAmfe, canon);
      const insPlan = sinValor(item.evaluationTechnique) ? null : instrumentoDe(item.evaluationTechnique, canon);
      const frecAmfe = frecuenciasDe(textoAmfe, canon);
      const frecPlan = sinValor(item.sampleFrequency) ? [] : frecuenciasDe(item.sampleFrequency, canon);
      const critica = esCritica(c);
      let estado; let detalle; let frena = false;
      if (!esIdentificable(insAmfe)) {
        estado = critica ? 'DIFERENTE' : 'GENERICO';
        frena = critica;
        detalle = `el control de ${link.control} del AMFE ("${textoAmfe || '(vacio)'}") no tiene instrumento identificable${insAmfe?.referencias?.length ? ` (solo ${insAmfe.referencias.join(', ')})` : ''}: re-evaluar la D (hoy ${c.D})${critica ? `; con S ${c.S} una critica no puede quedar con un control que no se identifica` : ''}`;
      } else if (!esIdentificable(insPlan)) {
        estado = 'FILA SIN METODO';
        frena = critica;
        detalle = `la fila vinculada no tiene instrumento con papel (${sinValor(item.evaluationTechnique) ? item.evaluationTechnique || 'vacio' : `"${item.evaluationTechnique}"`}): el AMFE declara ${nombreIns(insAmfe)} y ningun papel del plan lo respalda`;
      } else if (!planCubre(insAmfe, insPlan)) {
        estado = 'DIFERENTE'; frena = true;
        detalle = sinBaseParaComparar(insAmfe, insPlan)
          ? `no se puede afirmar que sea el mismo instrumento: el AMFE dice ${nombreIns(insAmfe)} y el plan ${nombreIns(insPlan)} (uno trae solo el codigo y el otro solo el tipo)`
          : `instrumento distinto: el AMFE dice ${nombreIns(insAmfe)} y el plan ${nombreIns(insPlan)}`;
      } else if (frecAmfe.length && !frecPlan.length) {
        estado = 'DIFERENTE'; frena = true;
        detalle = `el AMFE trae frecuencia (${frecAmfe.join(', ')}) y la de la fila no se reconoce o no tiene papel ("${item.sampleFrequency}")`;
      } else if (frecAmfe.length && !frecAmfe.every((f) => frecPlan.includes(f))) {
        estado = 'DIFERENTE'; frena = true;
        detalle = `frecuencia distinta: el AMFE dice ${frecAmfe.join(', ')} y el plan ${frecPlan.join(', ')}`;
      } else {
        estado = 'OK';
        detalle = `mismo instrumento (${nombreIns(insPlan)})${frecAmfe.length ? ` y misma frecuencia (${frecAmfe.join(', ')})` : '; el AMFE no trae frecuencia'}`;
      }
      pares.push({
        estado, frena, causeId: c.id, itemId: item.id, itemKey: item.key, opCausa: c.op, opFila: item.processStepNumber,
        aguasAbajo: link.control === 'deteccion' && Number(item.processStepNumber) > Math.max(...((plan.catalog.amfeOps || []).find((a) => a.n === c.op)?.numeros || [c.op]).map(Number)),
        control: link.control, falla: c.falla, causa: c.causa, S: Number(c.S), O: c.O, D: c.D, sigla: c.specialChar || '',
        textoAmfe, textoPlan, instrumentoAmfe: nombreIns(insAmfe), instrumentoPlan: nombreIns(insPlan), detalle,
      });
    }
  }
  const conDeteccion = new Set(pares.filter((p) => p.control === 'deteccion').map((p) => p.causeId));
  const conPrevencion = new Set(pares.filter((p) => p.control === 'prevencion').map((p) => p.causeId));
  const sinFila = causas.filter((c) => c.detectionControl && !conDeteccion.has(c.id)).map((c) => ({
    estado: 'SIN FILA', causeId: c.id, itemId: '', opCausa: c.op, falla: c.falla, causa: c.causa, S: Number(c.S), O: c.O, D: c.D, sigla: c.specialChar || '',
    textoAmfe: c.detectionControl, instrumentoAmfe: nombreIns(instrumentoDe(c.detectionControl, canon)),
    detalle: conPrevencion.has(c.id) ? 'el control de deteccion no tiene fila vinculada (la causa solo esta vinculada por su control de prevencion)' : 'causa con control de deteccion en el AMFE y ninguna fila vinculada',
  }));
  const sinCausa = plan.items.filter((i) => !(i.amfeCauseIds || []).length).map((i) => ({
    estado: 'SIN CAUSA', itemId: i.id, itemKey: i.key, opFila: i.processStepNumber,
    grupo: i.section === 'recepcion' ? 'recepcion' : i.packagingSheetId ? 'requisito de cliente' : 'proceso',
    textoPlan: [i.productCharacteristic, i.processCharacteristic].filter((x) => !sinValor(x) && x !== 'N/A').join(' · ') || TBD,
    detalle: 'fila del plan sin causa del AMFE vinculada',
  }));
  return { pares, sinFila, sinCausa };
}

const porOp = (lista, campo) => { const m = new Map(); for (const x of lista) m.set(x[campo], (m.get(x[campo]) || 0) + 1); return [...m.entries()]; };

/**
 * Gate 8 como hallazgos. DIFERENTE frena; GENERICO y FILA SIN METODO avisan (frenan sobre una
 * critica); SIN FILA y SIN CAUSA avisan agrupados por operacion (el detalle va en el reporte). Un
 * vinculo que apunta a una causa o una fila que no existe frena. Sin ningun vinculo, los estados
 * que comparan NO se evaluaron: se dice, no es un verde.
 */
export function gate8AmfeVsPlan(plan, canon = CANON) {
  const out = [];
  if (!plan.sources.some((s) => s.kind === 'amfe' && s.readable)) return [h('gate8', FRENO, '', '', 'sin AMFE en las entradas: el cruce AMFE <-> plan no se puede hacer (el gate no aprueba en vacio)')];
  if (!(plan.catalog?.amfeCauses || []).length) return [h('gate8', FRENO, '', '', 'el AMFE se leyo SIN causas (0): o el archivo no tiene la forma esperada, o esta vacio; el cruce no se puede hacer (el gate no aprueba en vacio)')];
  for (const v of plan.vinculosInvalidos || []) out.push(h('gate8', FRENO, '', '', `vinculo invalido: ${v.motivo} (causeId ${v.causeId}, itemKey ${v.itemKey})`));
  const { pares, sinFila, sinCausa } = cruceAmfePlan(plan, canon);
  if (!pares.length) out.push(h('gate8', FRENO, '', '', 'NO EVALUADO: ninguna causa esta vinculada a una fila (tabla vinculos.causaAFila vacia), asi que OK / GENERICO / DIFERENTE / FILA SIN METODO no se pudieron evaluar: la base no esta cruzada con el AMFE y no se emite como plan'));
  for (const p of pares) {
    if (p.estado === 'OK') continue;
    out.push(h('gate8', p.frena ? FRENO : AVISO, p.opFila, p.itemId, `${p.estado}: causa "${p.causa}" (OP ${p.opCausa}, S${p.S} O${p.O} D${p.D})${p.aguasAbajo ? ` detectada aguas abajo en la ${p.opFila}` : p.opCausa !== p.opFila && !String(p.opCausa).includes(p.opFila) ? ` vinculada a una fila de la ${p.opFila}` : ''}: ${p.detalle}`));
  }
  for (const [op, n] of porOp(sinFila, 'opCausa')) out.push(h('gate8', AVISO, op, '', `SIN FILA: ${n} causa(s) de la operacion ${op} con control de deteccion en el AMFE y ninguna fila vinculada`));
  for (const grupo of ['recepcion', 'requisito de cliente', 'proceso']) {
    const lista = sinCausa.filter((x) => x.grupo === grupo);
    if (lista.length) out.push(h('gate8', AVISO, '', '', `SIN CAUSA (${grupo}): ${lista.length} fila(s) del plan sin causa del AMFE vinculada (operaciones ${[...new Set(lista.map((x) => x.opFila))].join(', ')})`));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Los seis chequeos del §7.6
// ---------------------------------------------------------------------------

/**
 * Seis chequeos entre el AMFE y el plan, cada uno con lo que lista y sus hallazgos. La severidad
 * alta es la critica de la casa (S 9-10), no S >= 8. `comparacion` es la salida de
 * `compararConPlanExistente()` (opcional): suma las operaciones que le faltan al plan de Calidad.
 */
export function casosCruce(plan, { comparacion = null, canon = CANON } = {}) {
  const { flowOps = [], amfeOps = [], amfeCauses = [] } = plan.catalog || {};
  const ops = flowOps.filter((p) => p.tipo !== 'storage');
  const { pares } = cruceAmfePlan(plan, canon);
  const hallazgos = [];
  const push = (caso, nivel, op, itemId, mensaje) => hallazgos.push(h(caso, nivel, op, itemId, mensaje));

  // 1. una operacion que esta en uno solo de los documentos, en los dos sentidos
  const unmatched = {
    flujogramaSinAmfe: ops.filter((p) => !amfeOps.some((a) => a.numeros.includes(p.n))).map((p) => p.n),
    amfeSinFlujograma: amfeOps.flatMap((a) => a.numeros.filter((n) => !flowOps.some((p) => p.n === n))),
    flujogramaSinPlan: ops.filter((p) => !plan.items.some((i) => i.processStepNumber === p.n)).map((p) => p.n),
    flujogramaSinPlanExistente: comparacion ? comparacion.faltan.map((x) => x.split(' ')[0]) : null,
  };
  for (const [donde, lista] of Object.entries(unmatched)) if (lista?.length) push('UNMATCHED_PROCESS_STEP', donde === 'flujogramaSinPlan' ? FRENO : AVISO, '', '', `${donde}: ${lista.join(', ')}`);

  // 2. fila sin metodo de control: vale o TBD (la celda vacia la frena el gate de la etapa 1); aca se lista
  const missingControl = plan.items.filter((i) => sinValor(i.evaluationTechnique) || sinValor(i.controlMethod)).map((i) => ({ op: i.processStepNumber, itemId: i.id, key: i.key, tecnica: i.evaluationTechnique, registro: i.controlMethod }));
  for (const [op, n] of porOp(missingControl, 'op')) push('MISSING_CONTROL', AVISO, op, '', `${n} fila(s) de la operacion ${op} con el instrumento o el registro en TBD`);

  // 3. caracteristica especial del AMFE que el plan no marca
  const conSigla = amfeCauses.filter((c) => siglaDe(c.specialChar));
  const sinMarcar = conSigla.filter((c) => !plan.items.some((i) => (i.amfeCauseIds || []).includes(c.id) && (i.classification || []).map(siglaDe).includes(siglaDe(c.specialChar))));
  const vinculadasSinMarca = sinMarcar.filter((c) => plan.items.some((i) => (i.amfeCauseIds || []).includes(c.id)));
  for (const c of vinculadasSinMarca) push('SPECIAL_CHARACTERISTIC_NOT_CONTROLLED', FRENO, c.op, '', `la causa "${c.causa}" tiene ${c.specialChar} en el AMFE y su fila vinculada no la lleva`);
  const sueltas = sinMarcar.filter((c) => !vinculadasSinMarca.includes(c));
  // IATF 16949 8.3.3.3: el plan documenta las caracteristicas especiales. Con siglas en el AMFE que
  // ninguna fila lleva, la base no se puede emitir como plan: un FRENO, y el detalle por operacion
  if (sueltas.length) push('SPECIAL_CHARACTERISTIC_NOT_CONTROLLED', FRENO, '', '', `${sueltas.length} de las ${conSigla.length} causas con sigla en el AMFE no tienen fila que la lleve: la base no documenta esas caracteristicas especiales y no se emite como plan hasta vincularlas`);
  for (const [op, n] of porOp(sueltas, 'op')) push('SPECIAL_CHARACTERISTIC_NOT_CONTROLLED', AVISO, op, '', `${n} causa(s) con sigla en el AMFE (operacion ${op}) sin fila vinculada: la columna de clasificacion queda vacia`);

  // 4. severidad alta sin plan de reaccion
  const sinReaccion = plan.items.filter((i) => sinValor(i.reactionPlan));
  const missingReaction = sinReaccion.map((i) => ({ op: i.processStepNumber, itemId: i.id, critica: (i.amfeCauseIds || []).some((id) => { const c = amfeCauses.find((x) => x.id === id); return c && esCritica(c); }) }));
  for (const x of missingReaction.filter((r) => r.critica)) push('MISSING_REACTION_PLAN', FRENO, x.op, x.itemId, 'fila vinculada a una causa critica (S 9-10) sin plan de reaccion');
  for (const [op, n] of porOp(missingReaction.filter((r) => !r.critica), 'op')) push('MISSING_REACTION_PLAN', AVISO, op, '', `${n} fila(s) de la operacion ${op} sin plan de reaccion`);

  // 5. el control de deteccion no tiene instrumento identificable (todas las causas, vinculadas o no)
  const debiles = amfeCauses.filter((c) => !esIdentificable(instrumentoDe(c.detectionControl, canon)));
  const weak = debiles.map((c) => ({ op: c.op, causeId: c.id, causa: c.causa, S: Number(c.S), D: c.D, control: c.detectionControl }));
  if (weak.length) push('WEAK_DETECTION_METHOD', AVISO, '', '', `${weak.length} de ${amfeCauses.length} causas con un control de deteccion sin instrumento identificable (por operacion: ${porOp(weak, 'op').map(([op, n]) => `${op}: ${n}`).join(' · ')})`);

  // 6. lo mismo sobre una critica: frena si esta vinculada (DIFERENTE en el gate 8), avisa si no
  const highWeak = weak.filter((w) => w.S >= CARACTERISTICAS_ESPECIALES.criterio.CRITICA.severidad_min);
  for (const w of highWeak) {
    const vinculada = pares.some((p) => p.causeId === w.causeId);
    push('HIGH_SEVERITY_WEAK_CONTROL', vinculada ? FRENO : AVISO, w.op, '', `causa critica (S${w.S}) "${w.causa}" con control "${w.control}", sin instrumento identificable${vinculada ? '' : ' (sin fila vinculada)'}`);
  }

  return { unmatched, missingControl, specialNotControlled: sinMarcar.map((c) => ({ op: c.op, causeId: c.id, sigla: c.specialChar, vinculada: vinculadasSinMarca.includes(c) })), missingReaction, weak, highWeak, hallazgos };
}

// ---------------------------------------------------------------------------
// Todo junto y reporte
// ---------------------------------------------------------------------------

export function correrEtapa2(plan, { planExistente = null, comparacion = null, canon = CANON } = {}) {
  const casos = casosCruce(plan, { comparacion, canon });
  return {
    hallazgos: [...gate3Siglas(plan), ...gate7ControlFinal(plan, { planExistente }), ...gate8AmfeVsPlan(plan, canon), ...casos.hallazgos],
    propuesta: propuestaDeSiglas(plan),
    cruce: cruceAmfePlan(plan, canon),
    casos,
  };
}

const corto = (s, n = 60) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, n);

/** La hoja aparte: propuesta de siglas por criterio. Va a su propio archivo; no es parte del plan. */
export function propuestaMarkdown(plan, propuesta = propuestaDeSiglas(plan)) {
  const r = propuesta.resumen;
  const L = [];
  L.push(`# Propuesta de siglas por criterio — ${plan.header?.partName || ''} (hoja aparte)`);
  L.push('');
  L.push('Esto NO asigna nada. La columna de clasificacion del plan se copia de la sigla que cada causa ya tiene en el AMFE; asignar o cambiar una sigla es de Ingenieria (o del cliente, en el plano).');
  L.push(`Criterio (${CARACTERISTICAS_ESPECIALES.criterio_fuente.split(';')[0]}): ${REGLA.CRITICA} · ${REGLA.SIGNIFICATIVA}. La S es la del modo de falla (la comparten todas sus causas) y la O, la de cada causa.`);
  L.push('');
  L.push(`Causas: ${r.causas} · con sigla en el AMFE: ${r.conSigla} (${r.coinciden} que el criterio sostiene, ${r.siglaFueraDeRegla} fuera de regla, ${r.siglaDesconocida} desconocidas) · sin sigla y el criterio da nivel: ${r.candidatasSinSigla} · criticas por criterio (S 9-10): ${r.criticasPorCriterio} · causas que arrastran una severidad propia distinta de la de su modo de falla (no se usa): ${r.sPropiaEnLaCausa} · vinculadas a una fila del plan: ${r.vinculadasAlPlan}`);
  L.push('');
  const dif = propuesta.filas.filter((x) => x.diferencias.some((d) => d !== 'S_PROPIA_EN_LA_CAUSA'));
  L.push(`## Diferencias de sigla (${dif.length})`);
  L.push('');
  L.push('| OP | Caracteristica (falla) | Causa | S | O | Criterio | Sigla en el AMFE | Diferencia |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const x of dif) L.push(`| ${x.op} | ${corto(x.caracteristica)} | ${corto(x.causa)} | ${x.S}${x.diferencias.includes('S_PROPIA_EN_LA_CAUSA') ? ` (la causa arrastra ${x.SCausa})` : ''} | ${x.O} | ${x.nivelPorCriterio || '-'} | ${x.siglaActual || '-'} | ${x.diferencias.join(', ')} |`);
  L.push('');
  L.push('## Todas las causas');
  L.push('');
  L.push('| OP | Caracteristica (falla) | Causa | S | O | Regla | Criterio | Sigla en el AMFE | En el plan |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const x of propuesta.filas) L.push(`| ${x.op} | ${corto(x.caracteristica, 45)} | ${corto(x.causa, 45)} | ${x.S} | ${x.O} | ${x.regla} | ${x.nivelPorCriterio || '-'}${x.nota ? ' (*)' : ''} | ${x.siglaActual || '-'} | ${x.enPlan.length ? 'si' : '-'} |`);
  L.push('');
  L.push('(*) la marca de una critica (D/TLD para VW) la designa el cliente en el plano, que no se leyo: aca va solo el nivel.');
  return L.join('\n');
}

/** Las secciones de la etapa 2 para el reporte del plan. */
export function reporteEtapa2(plan, etapa2, { conHallazgos = true } = {}) {
  const { propuesta, cruce, casos, hallazgos } = etapa2;
  const L = [];
  const r = propuesta.resumen;
  L.push('## Siglas (gate 3)');
  L.push(`- Columna de clasificacion: ${plan.items.filter((i) => (i.classification || []).length).length} fila(s) con sigla, todas copiadas del AMFE por vinculo; el resto, vacia.`);
  L.push(`- Propuesta por criterio (hoja aparte, propuesta_siglas.md): ${r.causas} causas, ${r.conSigla} con sigla en el AMFE (${r.siglaFueraDeRegla} fuera de regla), ${r.candidatasSinSigla} sin sigla que el criterio marca.`);
  L.push('');
  L.push('## Gate 8: AMFE <-> plan');
  const n = (e) => cruce.pares.filter((p) => p.estado === e).length;
  L.push(cruce.pares.length
    ? `OK ${n('OK')} · GENERICO ${n('GENERICO')} · DIFERENTE ${n('DIFERENTE')} · FILA SIN METODO ${n('FILA SIN METODO')} · SIN FILA ${cruce.sinFila.length} · SIN CAUSA ${cruce.sinCausa.length}`
    : `NO EVALUADO (ninguna causa vinculada): OK, GENERICO, DIFERENTE y FILA SIN METODO no se pudieron evaluar · SIN FILA ${cruce.sinFila.length} · SIN CAUSA ${cruce.sinCausa.length}`);
  L.push('');
  if (cruce.pares.length) {
    L.push('| Estado | OP causa | OP fila | Control | Causa | S/O/D | AMFE dice | Plan dice | Detalle |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const p of cruce.pares) L.push(`| ${p.estado} | ${p.opCausa} | ${p.opFila} | ${p.control} | ${corto(p.causa, 40)} | ${p.S}/${p.O}/${p.D} | ${corto(p.textoAmfe, 45)} | ${corto(p.textoPlan, 45) || TBD} | ${corto(p.detalle, 110)} |`);
    L.push('');
  }
  L.push(`### SIN FILA (${cruce.sinFila.length}): causas con control en el AMFE y ninguna fila vinculada`);
  L.push('| OP | Falla | Causa | S/O/D | Sigla | Control de deteccion del AMFE | Instrumento |');
  L.push('|---|---|---|---|---|---|---|');
  for (const c of cruce.sinFila) L.push(`| ${c.opCausa} | ${corto(c.falla, 40)} | ${corto(c.causa, 40)} | ${c.S}/${c.O}/${c.D} | ${c.sigla || '-'} | ${corto(c.textoAmfe, 55)} | ${c.instrumentoAmfe} |`);
  L.push('');
  L.push(`### SIN CAUSA (${cruce.sinCausa.length}): filas del plan sin causa vinculada`);
  for (const g of ['recepcion', 'requisito de cliente', 'proceso']) {
    const lista = cruce.sinCausa.filter((x) => x.grupo === g);
    L.push(`- ${g} (${lista.length}): ${lista.map((x) => `OP ${x.opFila} ${corto(x.textoPlan, 35)}`).join(' · ') || 'ninguna'}`);
  }
  L.push('');
  L.push('## Los seis chequeos AMFE <-> plan (§7.6)');
  L.push(`- UNMATCHED_PROCESS_STEP: flujograma sin AMFE: ${casos.unmatched.flujogramaSinAmfe.join(', ') || 'ninguna'} · AMFE sin flujograma: ${casos.unmatched.amfeSinFlujograma.join(', ') || 'ninguna'} · flujograma sin fila en este plan: ${casos.unmatched.flujogramaSinPlan.join(', ') || 'ninguna'}${casos.unmatched.flujogramaSinPlanExistente ? ` · flujograma sin fila en el plan de Calidad: ${casos.unmatched.flujogramaSinPlanExistente.join(', ') || 'ninguna'}` : ''}`);
  L.push(`- MISSING_CONTROL: ${casos.missingControl.length} fila(s) con el instrumento o el registro en TBD (operaciones ${[...new Set(casos.missingControl.map((x) => x.op))].join(', ')})`);
  L.push(`- SPECIAL_CHARACTERISTIC_NOT_CONTROLLED: ${casos.specialNotControlled.length} causa(s) con sigla en el AMFE que el plan no marca (${casos.specialNotControlled.filter((x) => x.vinculada).length} con fila vinculada)`);
  L.push(`- MISSING_REACTION_PLAN: ${casos.missingReaction.length} fila(s) sin plan de reaccion (${casos.missingReaction.filter((x) => x.critica).length} sobre una critica)`);
  L.push(`- WEAK_DETECTION_METHOD: ${casos.weak.length} causa(s) con control de deteccion sin instrumento identificable`);
  L.push(`- HIGH_SEVERITY_WEAK_CONTROL: ${casos.highWeak.length} de esas sobre una critica (S 9-10): ${casos.highWeak.map((w) => `OP ${w.op} "${corto(w.control, 50)}"`).join(' · ') || 'ninguna'}`);
  L.push('');
  if (!conHallazgos) return L.join('\n');
  L.push('## Hallazgos de la etapa 2');
  const porGate = {};
  for (const x of hallazgos) (porGate[x.gate] ||= []).push(x);
  for (const [g, lista] of Object.entries(porGate)) {
    L.push(`### ${g}: ${lista.filter((x) => x.nivel === FRENO).length} FRENO · ${lista.filter((x) => x.nivel === AVISO).length} AVISO`);
    for (const x of lista) L.push(`- ${x.nivel} · OP ${x.op || '-'} · ${x.mensaje}`);
    L.push('');
  }
  return L.join('\n');
}

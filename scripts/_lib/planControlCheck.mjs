/**
 * planControlCheck.mjs — arma el JSON intermedio de un plan de control y corre sus gates (P6, etapa 1).
 *
 * Por que existe: el 06/10/2026 cuatro revisores le encontraron 36 celdas al plan del APB Patagonia
 * que Calidad habia armado a mano (operaciones del flujograma que faltaban, un set up con texto de
 * otra maquina, parametros sin valor, dos fichas de embalaje y una sola en el plan, un calibre con
 * certificado NO OK, codigos de hilo distintos entre la HO y el arb). Fak, 09/10/2026: *"no somos
 * muy buenos haciendolos"*. Cada uno de esos errores es un gate de aca.
 *
 * Que hace y que no (plan `docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md` §7):
 *   - `armarPlan()` construye el JSON: superconjunto de `ControlPlanItem` de la app
 *     (`modules/controlPlan/controlPlanTypes.ts`) con `sourceRef` por celda, `status`, `conflicts`,
 *     `rowOrigin`, un `catalog` con lo que dijo cada fuente y la lista de `pendientes`.
 *   - Regla de celda: toda celda del formulario es un valor con >= 1 `sourceRef` a una fuente
 *     LEIDA, o el literal `TBD`, o `CONFLICTO` con los dos valores en `conflicts[]`. Vacio prohibido.
 *     Una convencion del formulario (N/A en la columna que no aplica, "Set up de maquina", la
 *     numeracion 1.0/2.0) solo entra si esta ESCRITA en las entradas, con su clave: sin clave, TBD.
 *   - NO escribe en Supabase, NO genera el .xls (etapa 3), NO asigna siglas (copia el `specialChar`
 *     de las causas vinculadas por id en la tabla `vinculos.causaAFila`; la propuesta por S/O es
 *     etapa 2), NO vincula por parecido de texto ni por numero, NO toma el AMFE ni el plan viejo
 *     como papel de una especificacion.
 *   - Los gates leen SOLO el JSON (su `catalog`): asi se prueban con fixtures y sin Supabase.
 *
 * Revisado por la API (Opus, 10/10/2026, `.sgc-cache/sesion-2026-10-10/API_P6_revision_diff_opus.md`):
 * de ahi salen el bloque de reaccion leido de la HO (antes era un texto fijo), las convenciones
 * por clave, el encabezado y los conflictos bajo el gate 4, el gate 1 que frena con una HO sin
 * items, y el vinculo solo por tabla explicita (el numero de caracteristica de la fila lo pone el
 * formulario, no el plano: no sirve para vincular).
 *
 * Los hallazgos salen como { gate, nivel: 'FRENO' | 'AVISO', op, itemId, mensaje }.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { esVacioHo, expandirNumeros } from './planControlFuentes.mjs';
import { sinAcentos } from './amfeAutoria.mjs';

export const TBD = 'TBD';
export const CONFLICTO = 'CONFLICTO';
export const FRENO = 'FRENO';
export const AVISO = 'AVISO';
export const FASES = ['prototipo', 'prelanzamiento', 'produccion'];

/** Las columnas del formulario I-AC-005.1: sobre ESTAS vale la regla de celda. */
export const CAMPOS_FORMULARIO = [
  'processStepNumber', 'processDescription', 'machineDeviceTool', 'characteristicNumber',
  'productCharacteristic', 'processCharacteristic', 'specification', 'evaluationTechnique',
  'sampleSize', 'sampleFrequency', 'controlMethod', 'reactionPlanOwner', 'reactionPlan',
];
/** Campos del encabezado que tambien llevan papel (los de firma y fecha de aprobacion quedan afuera). */
export const CAMPOS_ENCABEZADO = ['documentNumber', 'partName', 'partNumber', 'companyName', 'customerName', 'coreTeam', 'preparedBy', 'phase', 'revisionLevel'];
/** Fuentes que valen como papel para una FRECUENCIA (§7.1 gate 6). */
const FUENTES_FRECUENCIA = { recepcion: ['recepcion'], proceso: ['ho', 'ficha'] };
/** Codigos de instrumento de la casa (cronograma de calibracion): MC + 3 cifras (MC167, MC184, MC212, MC406). Otro formato no se reconoce: limite conocido. */
const RE_INSTRUMENTO = /\bMC\s?-?\s?(\d{3})\b/i;
/** Codigos con la forma de los hilos del arb (FX284-E0PTO, FX483TK-E0PTO): es lo unico que `codigosEnHo` reconoce; un DK/1840400 o un ET-SATO-100X60 mal escrito en la HO no se detecta (limite conocido). */
const RE_CODIGO = /\b[A-Z]{2,}\d{2,}[A-Z0-9]*-[A-Z0-9]{3,}\b/g;
const RE_SET_UP = /set\s*-?\s*up/i;
const ES_STORAGE = (p) => p.tipo === 'storage';

const sha = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 10);
const norm = (s) => sinAcentos(String(s ?? '')).replace(/\s+/g, ' ').trim();
const mayus = (s) => String(s ?? '').toUpperCase();
export const codigoInstrumento = (texto) => { const m = String(texto ?? '').match(RE_INSTRUMENTO); return m ? `MC${m[1]}` : ''; };

// ---------------------------------------------------------------------------
// Construccion del plan
// ---------------------------------------------------------------------------

function filaVacia(op, nombre, section, rowKind, key) {
  const item = { id: `${op}:${rowKind}:${sha(key)}`, key, processStepNumber: String(op), processDescription: nombre, section, rowKind };
  for (const c of CAMPOS_FORMULARIO) if (!(c in item)) item[c] = TBD;
  Object.assign(item, {
    componentMaterial: '', specialCharClass: '', classification: [], controlProcedure: '',
    amfeCauseIds: [], linkedAmfeOperationId: '', amfeFailureId: '', hoQcItemId: '', flowOpId: '', bomLineId: '', packagingSheetId: '',
    materialCode: '', materialFamily: '', instrumentCode: '', rowOrigin: [], sourceRef: {}, conflicts: [], notes: [], status: 'OK',
  });
  return item;
}

/** Pone un valor con sus referencias en una celda del formulario. */
function poner(item, campo, valor, refs) {
  const lista = (Array.isArray(refs) ? refs : [refs]).filter(Boolean);
  if (!lista.length) throw new Error(`poner(${campo}): un valor sin referencia no entra al plan`);
  item[campo] = valor;
  item.sourceRef[campo] = lista;
}

/** El estado de una fila se DERIVA de sus celdas; no se guarda otra cosa. */
export function estadoDeFila(item) {
  if ((item.conflicts || []).length || CAMPOS_FORMULARIO.some((c) => item[c] === CONFLICTO)) return CONFLICTO;
  if (CAMPOS_FORMULARIO.some((c) => item[c] === TBD)) return TBD;
  return 'OK';
}

function refHo(ho, hoja, celda) { return { sourceId: ho.sourceId, kind: 'ho', loc: { sheet: hoja, cell: celda } }; }
function refFlujo(f, paso) { return { sourceId: f.sourceId, kind: 'flujograma', loc: { path: paso.loc, stepId: paso.n } }; }
function refAmfe(a, causa) { return { sourceId: a.sourceId, kind: 'amfe', loc: { opId: causa.opId, causeId: causa.id } }; }
function refBom(b, m) { return { sourceId: b.sourceId, kind: 'bom', loc: { rows: m.filas, codigo: m.codigo } }; }
function refDecl(id, nota) { return { sourceId: id, kind: 'declarada', loc: { nota } }; }
function refProc(id, nota) { return { sourceId: id, kind: 'procedimiento', loc: { nota } }; }

function fuentesDelPlan({ flujograma, amfe, ho, bom, planExistente, entradas }) {
  const sources = [];
  const hash = (p) => { try { return p && fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16) : ''; } catch { return ''; } };
  if (flujograma) sources.push({ id: flujograma.sourceId, kind: 'flujograma', doc: flujograma.doc, revision: flujograma.revision, path: flujograma.path || '', sha256: hash(flujograma.path), readable: true });
  if (amfe) sources.push({ id: amfe.sourceId, kind: 'amfe', doc: amfe.doc, revision: amfe.revision, path: amfe.meta?.path || 'Supabase live: amfe_documents', supabaseId: amfe.meta?.id || '', updatedAt: amfe.meta?.updatedAt || '', readable: true });
  if (ho) sources.push({ id: ho.sourceId, kind: 'ho', doc: `${ho.doc} ${entradas?.ho?.nota || ''}`.trim(), revision: ho.hojas[0]?.rev || '', path: ho.path || '', sha256: hash(ho.path), readable: true, sheets: ho.hojas.map((h) => ({ sheet: h.hoja, opNumber: h.op })) });
  if (bom) sources.push({ id: bom.sourceId, kind: 'bom', doc: bom.doc, path: bom.path || '', sha256: hash(bom.path), readable: true });
  if (planExistente) sources.push({ id: planExistente.sourceId, kind: 'plan_existente', doc: planExistente.doc, path: planExistente.path || '', sha256: hash(planExistente.path), readable: true, note: 'solo para comparar: no es papel de una especificacion' });
  for (const [id, p] of Object.entries(entradas?.procedimientos || {})) sources.push({ id, kind: 'procedimiento', doc: p.doc, path: p.path || '', sha256: hash(p.path), readable: !!(p.path && fs.existsSync(p.path)) });
  // lo DECLARADO en las entradas (escrito por Ingenieria, con su cita) es legible por definicion: el
  // papel es el propio archivo de entradas, y la fuente queda marcada como `declarada` para que se vea
  sources.push({ id: 'ENTRADAS', kind: 'declarada', doc: `Entradas declaradas de la pieza ${entradas?.pieza || ''} (scripts/_lib/planControlEntradas.data.json)`.trim(), readable: true });
  if (entradas?.convenciones) sources.push({ id: 'CONVENCION-FORMULARIO', kind: 'declarada', doc: entradas.convenciones.doc, path: entradas.convenciones.fuente || '', readable: true, claves: Object.keys(entradas.convenciones).filter((k) => !['doc', 'fuente'].includes(k)) });
  if (entradas?.roles) sources.push({ id: 'ROLES-HO', kind: 'declarada', doc: `Referencias de responsables de la HO (${entradas.roles._fuente || ''})`, readable: !!ho });
  if (entradas?.phase) sources.push({ id: 'FASE', kind: 'declarada', doc: `Fase del plan: ${entradas.phaseFuente || 'declarada en las entradas'}`, readable: true });
  if (entradas?.recepcion) sources.push({ id: 'PLANES-RECEPCION', kind: 'recepcion', doc: entradas.recepcion._doc || 'Planes de recepcion por familia', readable: entradas.recepcion.readable === true });
  if (entradas?.fichasEmbalaje) {
    sources.push({ id: 'FICHAS-EMBALAJE', kind: 'ficha', doc: 'Fichas de embalaje vigentes (el contenido vive en el servidor)', readable: false });
    const f = entradas.fichasEmbalaje.fuente;
    if (f?.id) sources.push({ id: f.id, kind: 'declarada', doc: f.doc || f.id, path: f.path || '', sha256: hash(f.path), readable: !!(f.path && fs.existsSync(f.path)) });
  }
  if (entradas?.calibracion) sources.push({ id: 'CRONOGRAMA-CALIBRACION', kind: 'calibracion', doc: entradas.calibracion._fuente || 'Cronograma de calibracion', readable: entradas.calibracion.readable === true });
  // una fuente declarada es legible solo si lo dice (readable: true) o si su archivo existe
  for (const f of entradas?.fuentesDeclaradas || []) sources.push({ id: f.id, kind: f.kind || 'declarada', doc: f.doc, path: f.loc || '', readable: f.readable === true || !!(f.path && fs.existsSync(f.path)), fecha: f.fecha || '' });
  return sources;
}

/**
 * Arma el plan. Cada entrada puede faltar (`null`): lo que venia de ella queda TBD y la fuente no
 * aparece en `sources` (eso es lo que prueba la mutacion del §7.5).
 */
export function armarPlan({ flujograma, amfe = null, ho = null, bom = null, planExistente = null, entradas = {} }) {
  if (!flujograma) throw new Error('armarPlan: sin flujograma no hay plan (la numeracion la manda el flujograma)');
  const sources = fuentesDelPlan({ flujograma, amfe, ho, bom, planExistente, entradas });
  const legible = (id) => sources.some((s) => s.id === id && s.readable);
  const roles = entradas.roles || {};
  const rol = (abrev) => roles[abrev] || abrev;
  /** Una convencion del formulario entra SOLO si esta escrita en las entradas con esa clave. */
  const conv = (clave) => (entradas.convenciones?.[clave] ? { sourceId: 'CONVENCION-FORMULARIO', kind: 'declarada', loc: { clave, nota: entradas.convenciones[clave] } } : null);

  const flowOps = flujograma.pasos.map((p) => ({ ...p, id: `flow:${p.n}` }));
  const opsPlan = flowOps.filter((p) => !ES_STORAGE(p));
  const amfeOps = (amfe?.operations || []).map((o) => ({ id: o.id, n: o.n, numeros: o.numeros, nombre: o.nombre }));
  const amfeCauses = amfe?.causas || [];
  const hoSheets = (ho?.hojas || []).map((h) => ({ sheet: h.hoja, opNumber: h.op, nombre: h.nombre, rev: h.rev, fecha: h.fecha, texto: h.texto, reaccion: h.reaccion || [] }));
  const hoQcItems = (ho?.hojas || []).flatMap((h) => h.ciclo.map((c) => ({ ...c, sourceRef: refHo(ho, h.hoja, `I${c.fila}`) })));
  const bomLines = (bom?.materiales || []).map((m) => ({ ...m, id: `bom:${mayus(m.codigo)}`, sourceRef: refBom(bom, m) }));
  const packagingSheets = (entradas.fichasEmbalaje?.vigentes || []).map((f) => ({ id: `ficha:${f.doc}`, ...f }));
  const gages = Object.entries(entradas.calibracion?.instrumentos || {}).map(([codigo, g]) => ({ codigo, ...g }));
  const catalog = { flowOps, amfeOps, amfeCauses, hoSheets, hoQcItems, bomLines, packagingSheets, gages };

  const items = [];
  const pendientes = [];
  const pendiente = (item, field, que, porque) => { if (!pendientes.some((p) => p.itemId === item.id && p.field === field)) pendientes.push({ itemId: item.id, field, op: item.processStepNumber, que, porque }); };
  const sacarPendiente = (item, field) => { const i = pendientes.findIndex((p) => p.itemId === item.id && p.field === field); if (i >= 0) pendientes.splice(i, 1); };
  /** Pone el valor si hay referencia; si no, la celda queda TBD y va a pendientes. */
  const ponerO = (item, campo, valor, refs, que, porque) => { const lista = (Array.isArray(refs) ? refs : [refs]).filter(Boolean); if (lista.length) poner(item, campo, valor, lista); else pendiente(item, campo, que, porque); };
  const amfeOpDe = (n) => amfeOps.find((o) => o.numeros.includes(String(n)));

  // --- encabezado -----------------------------------------------------------
  const H = { sourceRef: {} };
  const ponerH = (campo, valor, refs) => { const lista = (Array.isArray(refs) ? refs : [refs]).filter(Boolean); H[campo] = lista.length ? valor : TBD; H.sourceRef[campo] = lista; };
  ponerH('documentNumber', 'I-AC-005.1', conv('formulario'));
  ponerH('partName', entradas.partName || TBD, entradas.partName ? refDecl('ENTRADAS', 'partName') : null);
  ponerH('partNumber', flujograma.products.map((p) => p.code).join(' / ') || TBD, flujograma.products.length ? { sourceId: flujograma.sourceId, kind: 'flujograma', loc: { path: 'products' } } : null);
  ponerH('applicableParts', flujograma.products.map((p) => p.code), { sourceId: flujograma.sourceId, kind: 'flujograma', loc: { path: 'products' } });
  ponerH('companyName', amfe?.header?.companyName || amfe?.header?.organization || TBD, amfe?.header?.companyName || amfe?.header?.organization ? { sourceId: amfe.sourceId, kind: 'amfe', loc: { path: 'header.companyName' } } : null);
  ponerH('customerName', flujograma.header?.client || TBD, flujograma.header?.client ? { sourceId: flujograma.sourceId, kind: 'flujograma', loc: { path: 'header.client' } } : null);
  ponerH('coreTeam', amfe?.header?.coreTeam ? [].concat(amfe.header.coreTeam).join(', ') : TBD, amfe?.header?.coreTeam ? { sourceId: amfe.sourceId, kind: 'amfe', loc: { path: 'header.coreTeam' } } : null);
  ponerH('preparedBy', entradas.preparedBy || TBD, entradas.preparedBy ? refDecl('ENTRADAS', 'preparedBy') : null);
  ponerH('phase', FASES.includes(entradas.phase) ? entradas.phase : TBD, FASES.includes(entradas.phase) ? refDecl('FASE', entradas.phaseFuente || '') : null);
  ponerH('revisionLevel', '0', conv('emisionInicial'));
  ponerH('revisionDate', TBD, null);
  ponerH('srCharacteristic', TBD, null);          // sale de la asignacion de siglas (etapa 2)
  for (const c of ['customerApproval', 'approvedBy', 'plantApproval', 'cpNumber', 'supplierCode', 'contact', 'customerCode', 'dateOriginal', 'dateRevision', 'dateFum']) ponerH(c, TBD, null);
  const revisions = conv('emisionInicial')
    ? [{ rev: '0', date: TBD, item: 'N/A', details: 'EMISION INICIAL', pswDate: '', modifiedBy: entradas.preparedBy || TBD, sourceRef: [conv('emisionInicial'), entradas.preparedBy ? refDecl('ENTRADAS', 'preparedBy') : null].filter(Boolean) }]
    : [];
  const approvals = { calidad: '', produccion: '', ingenieria: '', cliente: '' };  // firmas: fuera de la regla de celda

  // --- recepcion (operacion 10 del flujograma) -------------------------------
  const opRecep = opsPlan.find((p) => p.n === '10');
  if (opRecep) {
    const familias = entradas.recepcion?.familias || {};
    const recepLegible = legible('PLANES-RECEPCION');
    let k = 0;
    for (const m of bomLines) {
      const fam = familias[m.codigo];
      if (m.seAbre || fam?.compra === false) {
        pendientes.push({ itemId: '', field: 'materialCode', op: '10', que: `${m.codigo} (${m.descripcion}) no se recibe: es un semielaborado propio (se fabrica); se reciben sus componentes${m.hijos?.length ? ` (${m.hijos.join(', ')})` : ''}`, porque: 'BOM de ultimo nivel con hijos en .1' });
        continue;
      }
      k += 1;
      const item = filaVacia('10', opRecep.nombre, 'recepcion', 'recepcion', `bom:${mayus(m.codigo)}`);
      item.flowOpId = opRecep.id; item.bomLineId = m.id; item.materialCode = m.codigo;
      item.rowOrigin = [refFlujo(flujograma, opRecep), m.sourceRef];
      poner(item, 'processStepNumber', '10', refFlujo(flujograma, opRecep));
      poner(item, 'processDescription', opRecep.nombre, refFlujo(flujograma, opRecep));
      ponerO(item, 'machineDeviceTool', 'N/A', conv('naMaquinaRecepcion'), `${m.codigo}: maquina de recepcion`, 'sin convencion escrita');
      ponerO(item, 'characteristicNumber', `${k}.0`, conv('numeracionPorOperacion'), `${m.codigo}: numero de caracteristica`, 'sin convencion escrita');
      poner(item, 'productCharacteristic', `${m.descripcion} (codigo ${m.codigo})`, m.sourceRef);
      item.componentMaterial = `${m.descripcion} (codigo ${m.codigo})`;
      item.materialFamily = fam?.familia || '';
      if (fam?.familia && !recepLegible) item.notes.push(`familia ${fam.familia}: de la tabla codigo -> familia de EJEMPLO de las entradas (los planes de recepcion no se leyeron)`);
      if (!fam) pendiente(item, 'materialFamily', `${m.codigo}: sin familia de recepcion en la tabla`, 'no esta en la tabla codigo -> familia');
      else if (!fam.familia) pendiente(item, 'materialFamily', `${m.codigo}: ${fam.nota || 'sin familia de recepcion'}`, 'la tabla lo marca sin familia');
      // caracteristica, especificacion, instrumento y muestreo salen del plan de recepcion de la familia: no leido -> TBD
      for (const c of ['processCharacteristic', 'specification', 'evaluationTechnique', 'sampleSize', 'sampleFrequency']) {
        pendiente(item, c, `${m.codigo}: ${c} del plan de recepcion de la familia ${fam?.familia || '(sin familia)'}`, recepLegible ? 'familia sin plan' : 'los planes de recepcion viven en el servidor y no se leyeron');
      }
      ponerO(item, 'controlMethod', 'P-10/I', [conv('metodoRecepcion'), legible('P-10') ? refProc('P-10', entradas.procedimientos?.['P-10']?.recepcion || '§5.1') : null], `${m.codigo}: metodo de control de recepcion`, 'sin convencion escrita');
      ponerO(item, 'reactionPlanOwner', 'Auditor de recepcion', legible('P-10') ? refProc('P-10', '§5.1: "el auditor de recepcion verificara la documentacion que envia el proveedor... luego efectuara el control"') : null, `${m.codigo}: responsable de recepcion`, 'P-10 no leido');
      ponerO(item, 'reactionPlan', 'Segun P-14', [conv('reaccionRecepcion'), legible('P-14') ? refProc('P-14', 'no conformidad del material recibido') : null], `${m.codigo}: plan de reaccion de recepcion`, 'sin convencion escrita');
      vincularCausas(item, amfeCauses, amfe, entradas, amfeOpDe('10'));
      items.push(item);
    }
  }

  // --- codigos que la HO nombra distinto que la BOM (gate d) -----------------
  const codigosHo = codigosEnHo(hoSheets);
  const discrepancias = discrepanciasDeCodigo(codigosHo, bomLines);
  for (const d of discrepancias) {
    const fila = items.find((i) => i.bomLineId === `bom:${d.bom}`);
    if (!fila) continue;
    fila.conflicts.push({ field: 'materialCode', values: [{ value: d.bom, sourceRef: fila.sourceRef.productCharacteristic?.[0] }, { value: d.ho, sourceRef: refHo(ho, d.sheet, 'texto de la hoja') }] });
    pendiente(fila, 'materialCode', `la HO (hoja ${d.sheet}) nombra ${d.ho} y la BOM del arb ${d.bom}`, 'dos papeles, dos codigos: corregir uno');
  }

  // --- proceso, control final y embalaje ---------------------------------------
  const valoresDeclarados = (entradas.fuentesDeclaradas || []).flatMap((f) => (f.valores || []).map((v) => ({ ...v, fuente: f })));
  for (const op of opsPlan.filter((p) => p.n !== '10')) {
    const section = op.n === '110' ? 'embalaje' : op.tipo === 'op-ins' && /CONTROL FINAL/i.test(op.nombre) ? 'final' : 'proceso';
    const amfeOp = amfeOpDe(op.n);
    const hojas = hoSheets.filter((h) => h.opNumber === op.n);
    const itemsHo = hoQcItems.filter((c) => c.op === op.n);
    const notaSinAmfe = amfe && !amfeOp ? `sin analisis AMFE: la operacion ${op.n} del flujograma no esta en el ${amfe.sourceId}` : '';
    const reaccionHo = hojas.find((h) => h.reaccion?.length);
    let n = 0;
    const nuevaFila = (rowKind, key) => {
      n += 1;
      const item = filaVacia(op.n, op.nombre, section, rowKind, key);
      item.flowOpId = op.id;
      item.linkedAmfeOperationId = amfeOp?.id || '';
      item.rowOrigin = [refFlujo(flujograma, op)];
      poner(item, 'processStepNumber', op.n, refFlujo(flujograma, op));
      poner(item, 'processDescription', op.nombre, refFlujo(flujograma, op));
      ponerO(item, 'characteristicNumber', `${n}.0`, conv('numeracionPorOperacion'), `${op.n}: numero de caracteristica`, 'sin convencion escrita');
      if (notaSinAmfe) item.notes.push(notaSinAmfe);
      const maq = entradas.maquinas?.[op.n];
      if (maq && ho && hojas.some((h) => h.sheet === String(maq.sheet))) poner(item, 'machineDeviceTool', maq.machineDeviceTool, refHo(ho, String(maq.sheet), maq.nota || 'texto de la hoja'));
      else pendiente(item, 'machineDeviceTool', `${op.n}: maquina/equipo`, 'la HO de esta operacion no la nombra');
      // el plan de reaccion es el bloque PLAN DE REACCION ANTE NO CONFORME de la HO, tal cual, con sus celdas
      if (reaccionHo) poner(item, 'reactionPlan', reaccionHo.reaccion.map((r) => r.texto).join(' / '), reaccionHo.reaccion.map((r) => refHo(ho, reaccionHo.sheet, r.celda)));
      else pendiente(item, 'reactionPlan', `${op.n}: plan de reaccion`, hojas.length ? 'la HO no tiene el bloque PLAN DE REACCION ANTE NO CONFORME' : 'sin hoja de operaciones leida');
      return item;
    };
    const ponerCiclo = (item, c, { esSetUp }) => {
      item.hoQcItemId = c.id;
      item.rowOrigin.push(c.sourceRef);
      const ref = (col) => refHo(ho, c.hoja, `${col}${c.fila}`);
      const campoTexto = esSetUp ? 'processCharacteristic' : 'productCharacteristic';
      // la HO tiene UNA celda por item y el formulario dos (caracteristica y especificacion): la misma
      // celda de la HO respalda las dos; un item en blanco o en PENDIENTE deja las dos en TBD
      if (esVacioHo(c.caracteristica)) {
        pendiente(item, campoTexto, `${op.n}: la HO (hoja ${c.hoja}) tiene el item en ${c.caracteristica || 'blanco'}`, 'la HO no lo definio');
        pendiente(item, 'specification', `${op.n}: especificacion del item en blanco de la HO (hoja ${c.hoja})`, 'la HO no lo definio');
      } else {
        poner(item, campoTexto, c.caracteristica, ref('I'));
        poner(item, 'specification', c.caracteristica, ref('I'));
        item.notes.push('la HO no separa la caracteristica de su especificacion: la misma celda respalda las dos columnas');
      }
      ponerO(item, esSetUp ? 'productCharacteristic' : 'processCharacteristic', 'N/A', conv(esSetUp ? 'naEnProductoDeSetUp' : 'naColumnaQueNoAplica'), `${op.n}: columna que no aplica`, 'sin convencion escrita');
      if (!esVacioHo(c.metodo)) { poner(item, 'evaluationTechnique', c.metodo, ref('L')); item.instrumentCode = codigoInstrumento(c.metodo); }
      else pendiente(item, 'evaluationTechnique', `${op.n}: instrumento/metodo de "${c.caracteristica}"`, `la HO dice "${c.metodo || '-'}"`);
      pendiente(item, 'sampleSize', `${op.n}: tamano de muestra de "${c.caracteristica}"`, 'la HO no tiene columna de tamano de muestra');
      if (!esVacioHo(c.frec)) poner(item, 'sampleFrequency', c.frec, ref('P'));
      else pendiente(item, 'sampleFrequency', `${op.n}: frecuencia de "${c.caracteristica}"`, `la HO dice "${c.frec || '-'}"`);
      if (!esVacioHo(c.registro)) poner(item, 'controlMethod', c.registro, ref('R'));
      else pendiente(item, 'controlMethod', `${op.n}: registro de "${c.caracteristica}"`, `la HO dice "${c.registro || '-'}"`);
      if (!esVacioHo(c.resp)) poner(item, 'reactionPlanOwner', rol(c.resp), [ref('N'), legible('ROLES-HO') ? refDecl('ROLES-HO', `${c.resp} = ${rol(c.resp)}`) : null]);
      else pendiente(item, 'reactionPlanOwner', `${op.n}: responsable de "${c.caracteristica}"`, `la HO dice "${c.resp || '-'}"`);
      // un valor declarado por otra fuente para ESTE item (por id): si difiere, CONFLICTO con los dos
      for (const v of valoresDeclarados.filter((x) => x.hoQcItemId === c.id)) {
        const campo = v.field || 'specification';
        if (!legible(v.fuente.id)) { item.notes.push(`${v.fuente.doc} declara "${v.valor}" para ${campo}, pero la fuente no es legible (sin readable: true): no entra`); continue; }
        const refDeclarada = { sourceId: v.fuente.id, kind: v.fuente.kind || 'declarada', loc: { nota: v.fuente.loc || '' } };
        if (item[campo] === TBD) { poner(item, campo, v.valor, refDeclarada); sacarPendiente(item, campo); continue; }
        if (norm(item[campo]) === norm(v.valor)) { item.sourceRef[campo].push(refDeclarada); continue; }
        const valorHo = item[campo];
        const refHoCelda = item.sourceRef[campo][0];
        item.conflicts.push({ field: campo, values: [{ value: valorHo, sourceRef: refHoCelda }, { value: v.valor, sourceRef: refDeclarada }] });
        poner(item, campo, CONFLICTO, [refHoCelda, refDeclarada]);
        pendiente(item, campo, `${op.n}: "${c.caracteristica}": la HO dice "${c.caracteristica}" y ${v.fuente.doc} dice "${v.valor}"`, 'dos papeles con valores distintos');
        // la caracteristica sale de la MISMA celda de la HO y lleva el valor adentro: no puede quedar como dato bueno al lado de un CONFLICTO
        if (item[campoTexto] === valorHo) {
          item.conflicts.push({ field: campoTexto, values: [{ value: valorHo, sourceRef: refHoCelda }, { value: v.valor, sourceRef: refDeclarada }] });
          poner(item, campoTexto, CONFLICTO, [refHoCelda, refDeclarada]);
          pendiente(item, campoTexto, `${op.n}: la caracteristica de la HO trae el valor en conflicto ("${c.caracteristica}")`, 'misma celda que la especificacion en CONFLICTO');
        }
      }
    };

    // filas de set up: una por item que la HO marca con Registro = Set up (el formulario las agrupa
    // bajo "Set up de Maquina" al renderizar: etapa 3). Sin items, una sola fila TBD para que el hueco se vea.
    const utiles = itemsHo.filter((c) => !c.remite);
    const setUps = utiles.filter((c) => RE_SET_UP.test(c.registro));
    if (setUps.length) {
      for (const c of setUps) {
        const item = nuevaFila('setup', `setup:${c.id}`);
        ponerCiclo(item, c, { esSetUp: true });
        vincularCausas(item, amfeCauses, amfe, entradas, amfeOp);
        items.push(item);
      }
    } else {
      const setUp = nuevaFila('setup', `setup:${op.n}`);
      ponerO(setUp, 'productCharacteristic', 'N/A', conv('naEnProductoDeSetUp'), `${op.n}: columna PRODUCTO del set up`, 'sin convencion escrita');
      ponerO(setUp, 'processCharacteristic', 'Set up de maquina', conv('setUpDeMaquina'), `${op.n}: fila de set up`, 'sin convencion escrita');
      for (const c of ['specification', 'evaluationTechnique', 'sampleSize', 'sampleFrequency', 'controlMethod', 'reactionPlanOwner']) {
        pendiente(setUp, c, `${op.n}: set up sin items en la HO (${hojas.length ? `hoja ${hojas.map((h) => h.sheet).join('/')}` : 'sin hoja'})`, 'ningun item del ciclo de control lleva Registro = Set up');
      }
      vincularCausas(setUp, amfeCauses, amfe, entradas, amfeOp);
      items.push(setUp);
    }

    // una fila por item del ciclo de control que no es set up (los TBD repetidos de la misma operacion se juntan en uno)
    const vistos = new Set();
    const controles = utiles.filter((c) => !RE_SET_UP.test(c.registro));
    for (const c of controles) {
      const clave = esVacioHo(c.caracteristica) ? `tbd:${op.n}` : `ho:${c.id}`;
      if (vistos.has(clave)) {
        const fila = items.find((i) => i.key === clave);
        fila.hoQcItemId = `${fila.hoQcItemId} + ${c.id}`;
        fila.rowOrigin.push(c.sourceRef);
        continue;
      }
      vistos.add(clave);
      const item = nuevaFila('producto', clave);
      ponerCiclo(item, c, { esSetUp: false });
      vincularCausas(item, amfeCauses, amfe, entradas, amfeOp);
      items.push(item);
    }
    if (!controles.length) {
      // la HO no tiene ningun control sobre la pieza en esta operacion (o no hay hoja): una fila TBD,
      // para que la operacion exista en el plan y el hueco se vea
      const item = nuevaFila('producto', `sin-ho:${op.n}`);
      for (const c of ['productCharacteristic', 'specification', 'evaluationTechnique', 'sampleSize', 'sampleFrequency', 'controlMethod', 'reactionPlanOwner']) {
        pendiente(item, c, `${op.n}: ${hojas.length ? `la HO (hoja ${hojas.map((h) => h.sheet).join('/')}) no tiene items de control sobre la pieza` : 'sin hoja de operaciones'}`, 'sin papel');
      }
      ponerO(item, 'processCharacteristic', 'N/A', conv('naColumnaQueNoAplica'), `${op.n}: columna que no aplica`, 'sin convencion escrita');
      vincularCausas(item, amfeCauses, amfe, entradas, amfeOp);
      items.push(item);
    }

    // embalaje: ademas, una fila por ficha vigente
    if (section === 'embalaje') {
      const fuenteNombre = entradas.fichasEmbalaje?.fuente?.id && legible(entradas.fichasEmbalaje.fuente.id) ? entradas.fichasEmbalaje.fuente.id : '';
      for (const f of packagingSheets) {
        const item = nuevaFila('producto', `ficha:${f.doc}`);
        item.packagingSheetId = f.id;
        // la fila EXISTE porque el papel que lista las fichas vigentes la nombra; el contenido de la ficha no se leyo
        if (fuenteNombre) item.rowOrigin.push({ sourceId: fuenteNombre, kind: 'declarada', loc: { nota: `ficha ${f.doc} nombrada como vigente` } });
        ponerO(item, 'productCharacteristic', `Embalaje segun ficha ${f.doc}${f.que ? ` (${f.que})` : ''}`, fuenteNombre ? { sourceId: fuenteNombre, kind: 'declarada', loc: { nota: `ficha ${f.doc}: nombre y descripcion tal como los da esa fuente, no el contenido de la ficha` } } : null, `110: ficha ${f.doc} sin papel legible que la nombre`, 'la lista de fichas vigentes no tiene fuente legible');
        ponerO(item, 'processCharacteristic', 'N/A', conv('naColumnaQueNoAplica'), '110: columna que no aplica', 'sin convencion escrita');
        for (const c of ['specification', 'evaluationTechnique', 'sampleSize', 'sampleFrequency', 'controlMethod', 'reactionPlanOwner']) {
          pendiente(item, c, `110: ${c} de la ficha ${f.doc}`, f.readable === false ? 'la ficha vive en el servidor y no se leyo' : 'ficha sin leer');
        }
        vincularCausas(item, amfeCauses, amfe, entradas, amfeOp);
        items.push(item);
      }
    }
  }

  for (const item of items) {
    item.status = estadoDeFila(item);
    for (const c of CAMPOS_FORMULARIO) {
      if ((item[c] === TBD || item[c] === CONFLICTO) && !pendientes.some((p) => p.itemId === item.id && p.field === c)) pendiente(item, c, `${item.processStepNumber}: ${c}`, 'sin papel');
    }
  }
  return { header: H, revisions, approvals, sources, catalog, items, pendientes, discrepanciasCodigo: discrepancias };
}

/**
 * Vinculo causa -> fila: SOLO por la tabla explicita de las entradas (`vinculos.causaAFila`:
 * { causeId, itemKey }). Ni por texto ni por numero: el `characteristicNumber` de la fila lo pone
 * el formulario (1.0, 2.0 por operacion) y el de la causa, el plano; no son el mismo numero.
 * La sigla de la fila = union de los `specialChar` de las causas vinculadas (copiada, no calculada).
 */
function vincularCausas(item, amfeCauses, amfe, entradas, amfeOp) {
  if (!amfe || !amfeOp) return;
  const explicitos = (entradas.vinculos?.causaAFila || []).filter((v) => v.itemKey === item.key).map((v) => v.causeId);
  const causas = amfeCauses.filter((c) => c.opId === amfeOp.id && explicitos.includes(c.id));
  item.amfeCauseIds = causas.map((c) => c.id);
  const siglas = [...new Set(causas.map((c) => c.specialChar).filter(Boolean))];
  item.classification = siglas;
  item.specialCharClass = siglas.join(' / ');
  item.sourceRef.specialCharClass = causas.filter((c) => c.specialChar).map((c) => refAmfe(amfe, c));
  for (const c of causas.filter((c) => c.specialChar)) item.notes.push(`sigla ${c.specialChar} copiada de la causa "${c.causa}" (S${c.S} O${c.O}, ${c.id})`);
}

export function codigosEnHo(hoSheets) {
  const out = [];
  for (const h of hoSheets || []) {
    for (const m of mayus(h.texto).matchAll(RE_CODIGO)) {
      if (!out.some((x) => x.codigo === m[0] && x.sheet === h.sheet)) out.push({ codigo: m[0], sheet: h.sheet, op: h.opNumber });
    }
  }
  return out;
}

/** FX284TK-E0PTO (HO) contra FX284-E0PTO (BOM): mismo sufijo, mismo arranque, distinto codigo. Si hay varios parecidos gana el de arranque mas largo en comun. */
export function discrepanciasDeCodigo(codigosHo, bomLines) {
  const bom = (bomLines || []).map((m) => mayus(m.codigo));
  const comun = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  const out = [];
  for (const c of codigosHo || []) {
    if (bom.includes(c.codigo)) continue;
    const [pref, suf] = c.codigo.split('-');
    const candidatos = bom.filter((b) => b.includes('-') && b.split('-')[1] === suf && comun(b.split('-')[0], pref) >= 4).sort((x, y) => comun(y, c.codigo) - comun(x, c.codigo));
    if (candidatos.length) out.push({ ho: c.codigo, bom: candidatos[0], sheet: c.sheet, op: c.op });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gates (leen SOLO el JSON)
// ---------------------------------------------------------------------------

const h = (gate, nivel, op, itemId, mensaje) => ({ gate, nivel, op: String(op ?? ''), itemId: itemId || '', mensaje });

/** Gate 0: operaciones del flujograma sin operacion en el AMFE (y al reves). Aviso: la diferencia es del AMFE. */
export function gate0FlujogramaVsAmfe(plan) {
  const out = [];
  const { flowOps, amfeOps } = plan.catalog;
  if (!plan.sources.some((s) => s.kind === 'amfe' && s.readable)) return [h('gate0', AVISO, '', '', 'sin AMFE en las entradas: no se puede cruzar con el flujograma')];
  for (const op of flowOps.filter((p) => !ES_STORAGE(p))) {
    if (!amfeOps.some((a) => a.numeros.includes(op.n))) out.push(h('gate0', AVISO, op.n, '', `la operacion ${op.n} ${op.nombre} del flujograma no esta en el AMFE: sus filas salen marcadas "sin analisis AMFE"`));
  }
  for (const a of amfeOps) {
    const sinFlujo = a.numeros.filter((n) => !flowOps.some((p) => p.n === n));
    if (sinFlujo.length) out.push(h('gate0', AVISO, a.n, '', `la operacion ${a.n} ${a.nombre} del AMFE no esta en el flujograma (${sinFlujo.join(', ')})`));
  }
  return out;
}

/** Gate 1: cada operacion tiene fila; cada item del ciclo de control de la HO tiene fila; las causas del AMFE sin fila se listan. */
export function gate1Filas(plan) {
  const out = [];
  const { flowOps, hoQcItems, amfeCauses } = plan.catalog;
  const hoLegible = plan.sources.some((s) => s.kind === 'ho' && s.readable);
  if (!hoLegible) out.push(h('gate1', FRENO, '', '', 'fuente HO ausente o ilegible: sin hoja de operaciones no hay items de control que cubrir (el gate no aprueba en vacio)'));
  else if (!hoQcItems.length) out.push(h('gate1', FRENO, '', '', 'la HO se leyo pero no tiene ningun item de ciclo de control: o las hojas no se llaman como la operacion, o falta "Características a controlar" (el gate no aprueba en vacio)'));
  for (const op of flowOps.filter((p) => !ES_STORAGE(p))) {
    if (!plan.items.some((i) => i.flowOpId === op.id)) out.push(h('gate1', FRENO, op.n, '', `la operacion ${op.n} ${op.nombre} no tiene ninguna fila`));
  }
  for (const c of hoQcItems.filter((x) => !x.remite)) {
    if (!plan.items.some((i) => String(i.hoQcItemId).split(' + ').includes(c.id))) out.push(h('gate1', FRENO, c.op, '', `el item "${c.caracteristica}" de la HO (hoja ${c.hoja}, fila ${c.fila}) no tiene fila`));
  }
  for (const c of hoQcItems.filter((x) => x.remite)) out.push(h('gate1', AVISO, c.op, '', `la HO (hoja ${c.hoja}, fila ${c.fila}) remite al plan de control ("${c.caracteristica}"): esa operacion no tiene controles propios en la HO`));
  const sinFila = amfeCauses.filter((c) => c.detectionControl && !plan.items.some((i) => i.amfeCauseIds.includes(c.id)));
  for (const c of sinFila) out.push(h('gate1', AVISO, c.op, '', `causa sin fila: "${c.causa}" (${c.falla}; control de deteccion "${c.detectionControl}"; ${c.id})`));
  return out;
}

/** Gate 2: cada material comprado de la BOM tiene su fila de recepcion; familia e instrumento. */
export function gate2Recepcion(plan) {
  const out = [];
  const { bomLines } = plan.catalog;
  if (!plan.sources.some((s) => s.kind === 'bom' && s.readable)) return [h('gate2', FRENO, '10', '', 'fuente BOM ausente: sin BOM no se sabe que se recibe')];
  const recepLegible = plan.sources.some((s) => s.kind === 'recepcion' && s.readable);
  for (const m of bomLines) {
    const fila = plan.items.find((i) => i.section === 'recepcion' && i.bomLineId === m.id);
    if (m.seAbre) { if (fila) out.push(h('gate2', AVISO, '10', fila.id, `${m.codigo} es un semielaborado propio y tiene fila de recepcion`)); continue; }
    if (!fila) { out.push(h('gate2', FRENO, '10', '', `el material ${m.codigo} (${m.descripcion}) de la BOM no tiene fila de recepcion`)); continue; }
    if (!fila.materialFamily) out.push(h('gate2', AVISO, '10', fila.id, `${m.codigo}: sin familia de recepcion (instrumento TBD)`));
    else if (!recepLegible) out.push(h('gate2', AVISO, '10', fila.id, `${m.codigo}: familia ${fila.materialFamily} de la tabla de EJEMPLO (los planes de recepcion no se leyeron)`));
    if (fila.evaluationTechnique === TBD) out.push(h('gate2', AVISO, '10', fila.id, `${m.codigo}: instrumento TBD (plan de recepcion de la familia ${fila.materialFamily || '?'} no leido)`));
  }
  return out;
}

/** Gate 4: regla de celda — valor con sourceRef a fuente leida, o TBD, o CONFLICTO con dos valores de dos papeles leidos. Encabezado, origen de fila, siglas y pendientes incluidos. */
export function gate4SourceRef(plan) {
  const out = [];
  const legibles = new Set(plan.sources.filter((s) => s.readable).map((s) => s.id));
  const refsOk = (refs, op, itemId, que) => {
    if (!refs?.length) { out.push(h('gate4', FRENO, op, itemId, `${que} sin sourceRef`)); return; }
    for (const r of refs) if (!legibles.has(r?.sourceId)) out.push(h('gate4', FRENO, op, itemId, `${que} cita ${r?.sourceId ?? '?'}, que no esta entre las fuentes leidas`));
  };
  for (const c of CAMPOS_ENCABEZADO) {
    const v = plan.header?.[c];
    if (v === TBD || v === '' || v === undefined) continue;
    refsOk(plan.header.sourceRef?.[c], '', 'encabezado', `encabezado.${c} = "${String(v).slice(0, 40)}"`);
  }
  for (const item of plan.items) {
    refsOk(item.rowOrigin, item.processStepNumber, item.id, 'origen de la fila (rowOrigin)');
    for (const c of CAMPOS_FORMULARIO) {
      const v = item[c];
      if (v === TBD) {
        if (!plan.pendientes.some((p) => p.itemId === item.id && p.field === c)) out.push(h('gate4', FRENO, item.processStepNumber, item.id, `${c} es TBD y no esta en la lista de pendientes`));
        continue;
      }
      if (v === CONFLICTO) {
        const conf = item.conflicts.find((x) => x.field === c);
        const ids = new Set((conf?.values || []).map((x) => x.sourceRef?.sourceId).filter(Boolean));
        if (!conf || conf.values.length < 2 || ids.size < 2) { out.push(h('gate4', FRENO, item.processStepNumber, item.id, `${c} dice CONFLICTO sin dos valores de dos papeles distintos`)); continue; }
        for (const val of conf.values) refsOk([val.sourceRef], item.processStepNumber, item.id, `${c} en CONFLICTO, valor "${String(val.value).slice(0, 30)}"`);
        continue;
      }
      if (v === '' || v === null || v === undefined) continue;   // lo frena gateCeldaVacia
      refsOk(item.sourceRef?.[c], item.processStepNumber, item.id, `${c} = "${String(v).slice(0, 60)}"`);
    }
    for (const conf of item.conflicts.filter((x) => !CAMPOS_FORMULARIO.includes(x.field))) {
      const ids = new Set((conf.values || []).map((x) => x.sourceRef?.sourceId).filter(Boolean));
      if (conf.values.length < 2 || ids.size < 2) out.push(h('gate4', FRENO, item.processStepNumber, item.id, `conflicto en ${conf.field} sin dos valores de dos papeles distintos`));
      for (const val of conf.values) refsOk([val.sourceRef], item.processStepNumber, item.id, `conflicto en ${conf.field}, valor "${String(val.value).slice(0, 30)}"`);
    }
    if (item.specialCharClass) refsOk(item.sourceRef.specialCharClass, item.processStepNumber, item.id, `sigla "${item.specialCharClass}"`);
    if (estadoDeFila(item) !== item.status) out.push(h('gate4', FRENO, item.processStepNumber, item.id, `status guardado "${item.status}" distinto del derivado "${estadoDeFila(item)}"`));
  }
  for (const p of plan.pendientes.filter((x) => x.itemId)) {
    const item = plan.items.find((i) => i.id === p.itemId);
    if (!item) { out.push(h('gate4', FRENO, p.op, p.itemId, `pendiente ${p.field} de una fila que no existe`)); continue; }
    if (CAMPOS_FORMULARIO.includes(p.field) && item[p.field] !== TBD && item[p.field] !== CONFLICTO) out.push(h('gate4', FRENO, p.op, p.itemId, `pendiente colgado: ${p.field} ya vale "${String(item[p.field]).slice(0, 40)}"`));
  }
  return out;
}

/** Gate 6: la fase es una entrada; la frecuencia de recepcion sale del plan de recepcion y la de proceso de la HO (o TBD). */
export function gate6Frecuencia(plan) {
  const out = [];
  if (!FASES.includes(plan.header.phase)) out.push(h('gate6', FRENO, '', '', `fase "${plan.header.phase}": sin fase (prototipo / prelanzamiento / produccion) no se decide que muestreo aplica`));
  for (const item of plan.items) {
    if (item.sampleFrequency === TBD) continue;
    const permitidas = item.section === 'recepcion' ? FUENTES_FRECUENCIA.recepcion : FUENTES_FRECUENCIA.proceso;
    const refs = item.sourceRef.sampleFrequency || [];
    const malas = refs.filter((r) => !permitidas.includes(r.kind));
    if (malas.length || !refs.length) out.push(h('gate6', FRENO, item.processStepNumber, item.id, `frecuencia "${item.sampleFrequency}" con fuente ${malas.map((r) => r.sourceId).join(', ') || 'ninguna'}: en ${item.section} solo vale ${permitidas.join('/')} (o TBD)`));
  }
  return out;
}

/** Gate calibracion: todo instrumento con codigo se busca en el cronograma; NO OK o uso/area que no es recepcion frena. */
export function gateCalibracion(plan, { planExistente = null } = {}) {
  const out = [];
  const gages = plan.catalog.gages || [];
  const legible = plan.sources.some((s) => s.kind === 'calibracion' && s.readable);
  const mirar = (codigo, op, itemId, donde, esRecepcion) => {
    const g = gages.find((x) => x.codigo.toUpperCase() === codigo.toUpperCase());
    if (!g) { out.push(h('gateCalibracion', AVISO, op, itemId, `${codigo} (${donde}): sin dato de calibracion (${legible ? 'no esta en el cronograma' : 'el cronograma no se leyo'})`)); return; }
    const noOk = /NO\s*OK/i.test(String(g.certificadoExterno || '')) || /vencid/i.test(String(g.estado || ''));
    const otroUso = esRecepcion && /proceso/i.test(String(g.uso || ''));
    if (noOk || otroUso) out.push(h('gateCalibracion', FRENO, op, itemId, `${codigo} (${donde}): ${[noOk ? `certificado externo ${g.certificadoExterno}` : '', otroUso ? `figura como ${g.uso} en ${g.area}` : ''].filter(Boolean).join('; ')}`));
  };
  for (const item of plan.items) {
    const codigo = item.instrumentCode || codigoInstrumento(item.evaluationTechnique);
    if (codigo) mirar(codigo, item.processStepNumber, item.id, `fila ${item.key}`, item.section === 'recepcion');
  }
  for (const f of planExistente?.filas || []) {
    const codigo = codigoInstrumento(f.calibre);
    if (codigo) mirar(codigo, f.ops[0] || '', '', `plan existente fila ${f.fila}: ${f.proceso || f.producto}`, f.ops.includes('10'));
  }
  return out;
}

/** Gate maquina / set up: lo que dice la fila de set up (incluida su caracteristica) y la maquina salen de la HO de ESA operacion. */
export function gateMaquinaSetUp(plan) {
  const out = [];
  const hojasDe = (op) => plan.catalog.hoSheets.filter((s) => s.opNumber === String(op));
  const PERMITIDAS_FUERA_HO = { productCharacteristic: ['CONVENCION-FORMULARIO'], processCharacteristic: ['CONVENCION-FORMULARIO'], reactionPlanOwner: ['ROLES-HO'] };
  for (const item of plan.items.filter((i) => i.section !== 'recepcion')) {
    const hojas = hojasDe(item.processStepNumber).map((s) => s.sheet);
    if (item.rowKind === 'setup') {
      for (const c of ['productCharacteristic', 'processCharacteristic', 'specification', 'evaluationTechnique', 'sampleSize', 'sampleFrequency', 'controlMethod', 'reactionPlanOwner']) {
        if (item[c] === CONFLICTO || item[c] === TBD) continue;   // los dos papeles del conflicto ya los exige el gate 4
        for (const r of item.sourceRef[c] || []) {
          if ((PERMITIDAS_FUERA_HO[c] || []).includes(r.sourceId)) continue;
          if (r.kind !== 'ho' || !hojas.includes(String(r.loc?.sheet))) out.push(h('gateMaquinaSetUp', FRENO, item.processStepNumber, item.id, `set up de la ${item.processStepNumber}: ${c} cita ${r.sourceId} hoja ${r.loc?.sheet ?? '?'}, que no es la HO de esta operacion (${hojas.join('/') || 'sin hoja'})`));
        }
      }
    }
    if (item.machineDeviceTool !== TBD && item.machineDeviceTool !== 'N/A') {
      const refs = item.sourceRef.machineDeviceTool || [];
      const hoja = refs.find((r) => r.kind === 'ho' && hojas.includes(String(r.loc?.sheet)));
      // la maquina tiene que estar escrita en alguna hoja de ESA operacion (la 20 tiene 20, 20.1 y 20.2)
      const texto = hojasDe(item.processStepNumber).map((s) => s.texto).join(' \n ');
      if (!hoja) out.push(h('gateMaquinaSetUp', FRENO, item.processStepNumber, item.id, `maquina "${item.machineDeviceTool}" sin referencia a la HO de la ${item.processStepNumber}`));
      else if (!norm(texto).includes(norm(item.machineDeviceTool))) out.push(h('gateMaquinaSetUp', FRENO, item.processStepNumber, item.id, `maquina "${item.machineDeviceTool}": ninguna hoja de la HO de la ${item.processStepNumber} (${hojas.join('/')}) la nombra`));
    }
  }
  return out;
}

/** Gate fichas de embalaje: todas las vigentes tienen fila. */
export function gateFichasEmbalaje(plan) {
  const out = [];
  const fichas = plan.catalog.packagingSheets || [];
  if (!fichas.length) out.push(h('gateFichas', AVISO, '110', '', 'ninguna ficha de embalaje declarada como vigente'));
  for (const f of fichas) {
    if (!plan.items.some((i) => i.packagingSheetId === f.id)) out.push(h('gateFichas', FRENO, '110', '', `la ficha de embalaje ${f.doc} (${f.que || ''}) no tiene fila`));
  }
  return out;
}

/** Gate codigo BOM <-> HO: un codigo que la HO escribe distinto que la BOM tiene que estar como CONFLICTO en la fila del material. */
export function gateCodigoBomVsHo(plan) {
  const out = [];
  const discrepancias = discrepanciasDeCodigo(codigosEnHo(plan.catalog.hoSheets), plan.catalog.bomLines);
  for (const d of discrepancias) {
    const fila = plan.items.find((i) => i.bomLineId === `bom:${d.bom}`);
    const marcado = fila?.conflicts.some((c) => c.field === 'materialCode' && c.values.some((v) => v.value === d.ho));
    out.push(h('gateCodigoBomVsHo', marcado ? AVISO : FRENO, d.op, fila?.id || '', `la HO (hoja ${d.sheet}) nombra ${d.ho} y la BOM del arb ${d.bom}${marcado ? ': CONFLICTO marcado en la fila' : ': falta marcar el CONFLICTO'}`));
  }
  const sueltos = codigosEnHo(plan.catalog.hoSheets).filter((c) => !plan.catalog.bomLines.some((m) => mayus(m.codigo) === c.codigo) && !discrepancias.some((d) => d.ho === c.codigo));
  for (const c of sueltos) out.push(h('gateCodigoBomVsHo', AVISO, c.op, '', `la HO (hoja ${c.sheet}) nombra el codigo ${c.codigo}, que la BOM no tiene`));
  return out;
}

/** Gate celda vacia: en el formulario, vale o TBD. */
export function gateCeldaVacia(plan) {
  const out = [];
  for (const item of plan.items) {
    for (const c of CAMPOS_FORMULARIO) {
      if (item[c] === '' || item[c] === null || item[c] === undefined) out.push(h('gateCeldaVacia', FRENO, item.processStepNumber, item.id, `${c} vacio: va un valor con papel o TBD`));
    }
  }
  return out;
}

export const GATES = {
  gate0: gate0FlujogramaVsAmfe, gate1: gate1Filas, gate2: gate2Recepcion, gate4: gate4SourceRef, gate6: gate6Frecuencia,
  gateCalibracion, gateMaquinaSetUp, gateFichas: gateFichasEmbalaje, gateCodigoBomVsHo, gateCeldaVacia,
};

export function correrGates(plan, { planExistente = null } = {}) {
  return Object.values(GATES).flatMap((g) => g(plan, { planExistente }));
}

// ---------------------------------------------------------------------------
// Contra el plan existente de Calidad (diagnostico; no es fuente)
// ---------------------------------------------------------------------------

const PLACEHOLDER_SPEC = /^(ver hoja de operaciones\.?|ver hoja de set ?up\.?|\?|tbd|pendiente)?$/i;

/**
 * Que le falta al plan que ya existe, medido contra el flujograma y la HO: operaciones sin fila,
 * filas con la especificacion en blanco o "ver hoja de operaciones" donde la HO tampoco la tiene,
 * y filas de set up cuyo texto no esta en la HO de esa operacion.
 */
export function compararConPlanExistente(plan, planExistente) {
  const ops = plan.catalog.flowOps.filter((p) => !ES_STORAGE(p));
  const enPlan = new Set((planExistente.filas || []).flatMap((f) => f.ops));
  const faltan = ops.filter((p) => !enPlan.has(p.n)).map((p) => `${p.n} ${p.nombre}`);
  const sinValor = (planExistente.filas || []).filter((f) => (f.proceso || f.producto) && !/set ?up/i.test(f.nombre) && PLACEHOLDER_SPEC.test(f.spec) && f.ops.length).map((f) => ({ fila: f.fila, op: f.ops.join('-'), que: f.proceso || f.producto, dice: f.spec || '(vacia)' }));
  // set up: las palabras de la celda contra la HO de ESA operacion. Si la HO de la operacion no
  // tiene (casi) ninguna, el texto no salio de ahi; se nombra otra operacion solo si su HO tiene la mayoria.
  const setUpAjeno = [];
  if (plan.catalog.hoSheets.length) {
    for (const f of (planExistente.filas || []).filter((x) => /set ?up/i.test(x.nombre) && x.spec && x.ops.length)) {
      const tokens = [...new Set(norm(f.spec).split(/[^A-Z0-9]+/).filter((t) => t.length >= 5 && !/^(HOJA|SEGUN|PARA|OPERACION|CORRECTO|CORRECTA|MEDIOS)$/.test(t)))];
      if (!tokens.length) continue;
      const puntaje = (sheets) => tokens.filter((t) => sheets.some((s) => norm(s.texto).includes(t))).length;
      const enPropia = puntaje(plan.catalog.hoSheets.filter((s) => f.ops.includes(s.opNumber)));
      if (enPropia / tokens.length >= 0.5) continue;
      const otras = [...new Set(plan.catalog.hoSheets.filter((s) => !f.ops.includes(s.opNumber)).map((s) => s.opNumber))]
        .map((op) => ({ op, n: puntaje(plan.catalog.hoSheets.filter((s) => s.opNumber === op)) })).filter((x) => x.n / tokens.length >= 0.5).sort((a, b) => b.n - a.n);
      setUpAjeno.push({ fila: f.fila, op: f.ops.join('-'), spec: f.spec.slice(0, 80), enPropia, tokens: tokens.length, deOtra: otras.slice(0, 2).map((x) => `${x.op} (${x.n} de ${tokens.length} palabras)`).join(', ') });
    }
  }
  return { doc: planExistente.doc, faltan, sinValor, setUpAjeno };
}

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

export function reporteMarkdown(plan, hallazgos, comparacion = null) {
  const L = [];
  const frenos = hallazgos.filter((x) => x.nivel === FRENO);
  L.push(`# Plan de control (base preliminar, JSON intermedio) — ${plan.header.partName}`);
  L.push('');
  L.push(`Piezas: ${plan.header.partNumber} · Fase: ${plan.header.phase} · Filas: ${plan.items.length} · Pendientes (TBD/CONFLICTO): ${plan.pendientes.length} · Hallazgos: ${frenos.length} FRENO, ${hallazgos.length - frenos.length} AVISO`);
  L.push('');
  L.push('## Fuentes');
  for (const s of plan.sources) L.push(`- ${s.readable ? 'leida' : 'NO leida'} · ${s.id} · ${s.doc}${s.revision ? ` · rev ${s.revision}` : ''}${s.path ? ` · ${s.path}` : ''}${s.updatedAt ? ` · updated_at ${s.updatedAt}` : ''}`);
  L.push('');
  const porEstado = (e) => plan.items.filter((i) => i.status === e).length;
  L.push(`## Filas: ${porEstado('OK')} OK · ${porEstado(TBD)} con TBD · ${porEstado(CONFLICTO)} con CONFLICTO`);
  L.push('');
  L.push('| OP | Tipo | Nº | Producto | Proceso | Sigla | Especificacion | Instrumento | Frec. | Registro | Resp. | Estado |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  const corto = (s, n = 45) => String(s ?? '').replace(/\|/g, '/').slice(0, n);
  for (const i of plan.items) L.push(`| ${i.processStepNumber} | ${i.rowKind} | ${i.characteristicNumber} | ${corto(i.productCharacteristic)} | ${corto(i.processCharacteristic)} | ${i.specialCharClass} | ${corto(i.specification)} | ${corto(i.evaluationTechnique, 30)} | ${corto(i.sampleFrequency, 25)} | ${corto(i.controlMethod, 20)} | ${corto(i.reactionPlanOwner, 25)} | ${i.status} |`);
  L.push('');
  for (const i of plan.items.filter((x) => x.conflicts.length)) {
    for (const c of i.conflicts) L.push(`- **CONFLICTO** OP ${i.processStepNumber} ${c.field}: ${c.values.map((v) => `"${v.value}" (${v.sourceRef?.sourceId})`).join(' vs ')}`);
  }
  L.push('');
  L.push('## Hallazgos de los gates');
  const porGate = {};
  for (const x of hallazgos) (porGate[x.gate] ||= []).push(x);
  for (const [g, lista] of Object.entries(porGate)) {
    L.push(`### ${g}: ${lista.filter((x) => x.nivel === FRENO).length} FRENO · ${lista.filter((x) => x.nivel === AVISO).length} AVISO`);
    for (const x of lista) L.push(`- ${x.nivel} · OP ${x.op || '-'} · ${x.mensaje}`);
    L.push('');
  }
  if (comparacion) {
    L.push(`## Contra el plan existente: ${comparacion.doc}`);
    L.push(`- Operaciones del flujograma sin fila en ese plan (${comparacion.faltan.length}): ${comparacion.faltan.join(' · ') || 'ninguna'}`);
    L.push(`- Filas con la especificacion sin valor (${comparacion.sinValor.length}): ${comparacion.sinValor.map((x) => `OP ${x.op} "${x.que}" dice "${x.dice}"`).join(' · ') || 'ninguna'}`);
    L.push(`- Set up cuyo texto no sale de la HO de esa operacion (${comparacion.setUpAjeno.length}): ${comparacion.setUpAjeno.map((x) => `OP ${x.op} (fila ${x.fila}): ${x.enPropia} de ${x.tokens} palabras en su HO${x.deOtra ? `; la HO de la ${x.deOtra} si las tiene` : ''}: "${x.spec}"`).join(' · ') || 'ninguno'}`);
    L.push('');
  }
  L.push('## Pendientes (lo que no tiene papel o tiene dos)');
  for (const p of plan.pendientes) L.push(`- OP ${p.op} · ${p.field} · ${p.que} — ${p.porque}`);
  return L.join('\n');
}

export { expandirNumeros };

// Parser FIEL v3: AMFE AIAG-VDA (Excel descolocado) -> intermedio Barack.
// Asigna FM a OPERACIÓN por CLASE DE PROCESO (texto FM primero, luego función adyacente).
// Lista de operaciones objetivo por producto (agrupa 50/51 y 52/53 como el PC). NO escribe Supabase.
// uso: node scripts/_parseAmfeXlsxAmarok.mjs [128|129] [full]
import XLSX from 'xlsx-js-style';
import { writeFileSync, mkdirSync } from 'fs';
let calculateAP;
try { ({ calculateAP } = await import('./_lib/amfeIo.mjs')); } catch (e) { calculateAP = () => ''; }

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const nk = (s) => norm(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const numOrNull = (v) => { const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? n : null; };

const FILES = {
  '128': { path: 'D:\\AMFE 128 REV6.xlsx', sheet: 'IP DECORATIVE 115', ip: '115' },
  '129': { path: 'D:\\AMFE 129 REV8.xlsx', sheet: 'IP DECORATIVE 116', ip: '116' },
};
// operaciones objetivo por producto (clase -> {num, name})
const TARGETS = {
  '128': [
    ['recepcion', '10', 'RECEPCIONAR MATERIA PRIMA'], ['corte', '20', 'CORTAR VINILO / TELA'],
    ['costura_vista', '30', 'COSTURA VISTA'], ['costura_union', '31', 'COSTURA UNIÓN'],
    ['reproceso_costura', '32', 'REPROCESO: CORRECCIÓN DE COSTURA DESVIADA / FLOJA'], ['refilado', '33', 'REFILADO DE FUNDA TERMINADA'],
    ['adhesivado', '40', 'ADHESIVADO DE PIEZAS'], ['tapizado', '50/51', 'TAPIZADO SEMIAUTOMÁTICO (PRE-MONTAJE + PEGADO)'],
    ['virolado', '52/53', 'VIROLADO + REFILADO DE PIEZAS'], ['inspeccion', '60', 'CONTROL FINAL DE CALIDAD'], ['embalaje', '70', 'EMBALAJE'],
  ],
  '129': [
    ['recepcion', '10', 'RECEPCIONAR MATERIA PRIMA'], ['corte', '20', 'CORTAR VINILO / TELA'],
    ['costura_vista', '30', 'COSTURA VISTA'], ['costura_union', '31', 'COSTURA UNIÓN'],
    ['reproceso_costura', '32', 'REPROCESO: CORRECCIÓN DE COSTURA DESVIADA / FLOJA'], ['refilado', '33', 'REFILADO DE FUNDA TERMINADA'],
    ['adhesivado', '40', 'ADHESIVADO DE PIEZAS'], ['tapizado', '50/51', 'TAPIZADO SEMIAUTOMÁTICO (PRE-MONTAJE + PEGADO)'],
    ['virolado', '52/53', 'VIROLADO + REFILADO DE PIEZAS'], ['soldadura', '54', 'SOLDADURA'],
    ['reproceso_soldadura', '55', 'REPROCESO: CORRECCIÓN DE PUNTOS DE SOLDADURA'], ['inspeccion', '60', 'CONTROL FINAL DE CALIDAD'], ['embalaje', '70', 'EMBALAJE'],
  ],
};

function effectLevel(label) {
  const k = nk(label);
  if (k.includes('usuario final')) return 'end';
  if (k.includes('organismos regul')) return 'reg';
  if (k.includes('cliente externo')) return 'next';
  if (k.startsWith('barack') || k.includes('cliente interno') || k.includes('en planta')) return 'local';
  return null;
}
const RECIPIENT_RE = /(barack|cliente externo|cliente interno|usuario final|organismos regul)/i;

function processClass(text) {
  const k = nk(text);
  if (/(trazabilidad|materia prima recib|recepcion de materia|verificar.*cumplimiento.*recib)/.test(k)) return 'recepcion';
  if (/soldad/.test(k)) {
    if (/(correccion|reproceso|re-?soldad|punta de soldadura suci|daño .*marca al material|instruccion de trabajo .*repro)/.test(k)) return 'reproceso_soldadura';
    return 'soldadura';
  }
  if (/(remocion de costura|reproceso.*costura|correccion de costura|costura floja|costura desviada|retrabajo.*costura|daño o corte al material base|se genera daño o corte)/.test(k)) return 'reproceso_costura';
  if (/(refilado|recortar talon)/.test(k)) return 'refilado';
  if (/(adhesiv|superficies a pegar)/.test(k)) return 'adhesivado';
  if (/(tapiza|pre-?montaje|pegado automatic|pegado semiautomatic|alineacion del vinilo|vinilo no llego a cubrir|coloca.*pieza plastica|coloca mal el vinilo|falla el proceso automatic|mal colocado de la pieza|atrapamiento de mano)/.test(k)) return 'tapizado';
  if (/(virolad|guantes anticorte|exceso de refilado|falta de refilado|aplicar calor|contacto del operador con (herramienta|superficie)|se colocan los plasticos)/.test(k)) return 'virolado';
  if (/(se inspecciona|aprobacion de (pieza|producto) no conforme|defecto (dimensional|de apariencia).*no detectad|defecto.*no detectad|inspeccion final|inspeccionar pieza)/.test(k)) return 'inspeccion';
  // OJO: NO usar "embalaj" genérico (aparece como CAUSA "embalaje inadecuado" en recepción).
  if (/(piezas por medio|identificacion (incorrecta|de pieza|del producto)|falta de identificacion|cantidad correcta de piezas|cantidad de piezas por medio|se embalaje la pieza|medios de embalaje)/.test(k)) return 'embalaje';
  if (/(desviacion en el corte|corte incompleto|corte irregular|seleccion incorrecta del material|vinilo mal identificad|contaminacion del material durante el corte|cortar vinilo|paneles que forman|corte de los pliegos|se obtienen los paneles)/.test(k)) return 'corte';
  if (/costura vista/.test(k)) return 'costura_vista';
  if (/costura union/.test(k)) return 'costura_union';
  if (/costura/.test(k)) return 'costura';
  return null;
}
// clase de un FM: la FUNCIÓN DE OPERACIÓN adyacente MANDA (es la operación real),
// el texto del FM es la descripción de la falla y puede contradecir la operación
// (Excel descolocado). Orden: función adyacente -> texto FM -> función forward-fill -> causa.
// clases cuyo TEXTO de FM es específico de UNA sola operación (el texto manda).
const TRUSTED_TEXT = ['recepcion', 'corte', 'soldadura', 'reproceso_soldadura', 'reproceso_costura', 'inspeccion', 'embalaje', 'adhesivado'];
function classifyFM(fmText, cause, afn, ff) {
  const t = (s) => nk(s || '');
  const txtCls = processClass(fmText);
  // 1. texto específico de una sola operación -> manda
  if (txtCls && TRUSTED_TEXT.includes(txtCls)) return txtCls;
  // 2. clases ambiguas (costura/refilado/tapizado/virolado): manda la función adyacente (la operación real)
  const fnCls = processClass(afn);
  if (fnCls && fnCls !== 'costura') return fnCls;
  if (fnCls === 'costura' || /costura/.test(t(afn))) {
    if (/vista/.test(t(afn))) return 'costura_vista';
    if (/uni[oó]n/.test(t(afn))) return 'costura_union';
  }
  // 3. texto ambiguo no-costura (refilado/tapizado/virolado) si la función no resolvió
  if (txtCls && txtCls !== 'costura') return txtCls;
  // 4. forward-fill función
  const ffCls = processClass(ff);
  if (ffCls && ffCls !== 'costura') return ffCls;
  // 5. costura genérica -> vista/union por función
  if (txtCls === 'costura' || fnCls === 'costura' || ffCls === 'costura') {
    const both = t(`${afn} ${ff}`);
    if (/vista/.test(both)) return 'costura_vista';
    if (/uni[oó]n/.test(both)) return 'costura_union';
    return 'costura';
  }
  return processClass(cause) || null;
}

function buildColMap(headerRow) {
  const cm = {}; const used = new Set();
  const want = [
    ['item', s => /1-\s*item del proceso/i.test(s)], ['step', s => /2-\s*paso del proceso/i.test(s)],
    ['we', s => /3-\s*elemento de trabajo del proceso/i.test(s) && !/funcion/i.test(s)],
    ['funcItem', s => /1-\s*funcion del item/i.test(s)], ['funcStep', s => /2-\s*funcion del paso/i.test(s)],
    ['funcWE', s => /3-\s*funcion del elemento de trabajo/i.test(s)], ['effect', s => /efecto de la falla/i.test(s)],
    ['fm', s => /modos? de fallas?/i.test(s)], ['fc', s => /causa de la falla/i.test(s)],
  ];
  for (const [field, test] of want) for (let c = 0; c < headerRow.length; c++) { if (used.has(c)) continue; if (test(norm(headerRow[c]))) { cm[field] = c; used.add(c); break; } }
  const seq = { sev: [], occ: [], det: [], ce: [] };
  for (let c = 0; c < headerRow.length; c++) { const k = nk(headerRow[c]); if (k === 'severidad') seq.sev.push(c); else if (k === 'ocurrencia') seq.occ.push(c); else if (k === 'deteccion') seq.det.push(c); else if (/caracteristicas especiales/.test(k)) seq.ce.push(c); }
  cm.severity = seq.sev[0]; cm.sevNew = seq.sev[1]; cm.occurrence = seq.occ[0]; cm.occNew = seq.occ[1];
  cm.detection = seq.det[0]; cm.detNew = seq.det[1]; cm.specialChar = seq.ce[0]; cm.specNew = seq.ce[1];
  for (const [field, re] of [['prevControl', /controles preventivos/i], ['detControl', /controles detectivos/i], ['ap', /amfe ap/i], ['prevAction', /accion preventiva/i], ['detAction', /accion detectiva/i], ['responsible', /persona responsable/i], ['targetDate', /fecha objetivo/i], ['status', /estatus/i], ['actionTaken', /accion tomada/i], ['completionDate', /fecha de terminacion/i], ['apNew', /ap fmea/i], ['observations', /observa/i]])
    for (let c = 0; c < headerRow.length; c++) if (re.test(nk(headerRow[c]))) { cm[field] = c; break; }
  return cm;
}

const opRe = /OPERACI[OÓ]N\s*N?[°º]?\s*([\d\/]+)/i;
const isTemplatePrompt = (s) => /^¿.*\?$/.test(s) || /^requerimiento/i.test(s) || /^\d/.test(s) || !s;

function parseFile(key) {
  const { path, sheet, ip } = FILES[key];
  const wb = XLSX.readFile(path, { cellStyles: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '', blankrows: true });
  const cell = (r, c) => (c == null ? '' : norm((rows[r] || [])[c]));
  let hr = -1;
  for (let r = 0; r < Math.min(30, rows.length); r++) { const j = nk((rows[r] || []).join(' | ')); if (j.includes('severidad') && j.includes('ocurrencia') && j.includes('modos de falla')) { hr = r; break; } }
  if (hr < 0) throw new Error('sin header ' + sheet);
  const cm = buildColMap(rows[hr]);
  let last = hr;
  for (let r = hr + 1; r < rows.length; r++) if ((rows[r] || []).some(v => norm(v) !== '')) last = r;

  const markers = [];
  for (let r = hr + 1; r <= last; r++) { const m = cell(r, cm.step).match(opRe); if (m) markers.push({ num: m[1], row: r }); }
  const nearestMarkerNum = (row) => markers.slice().sort((a, b) => Math.abs(a.row - row) - Math.abs(b.row - row))[0]?.num || '';

  const fmRows = [];
  for (let r = hr + 1; r <= last; r++) if (cell(r, cm.fm)) fmRows.push(r);
  const ffFunc = []; let cur = '';
  for (let r = 0; r <= last; r++) { const v = cell(r, cm.funcStep); if (v && !isTemplatePrompt(v)) cur = v; ffFunc[r] = cur; }
  const fItemAll = [];
  for (let r = hr + 1; r <= last; r++) { const v = cell(r, cm.funcItem); if (v && !fItemAll.includes(v)) fItemAll.push(v); }
  let rawCause = 0; for (let r = hr + 1; r <= last; r++) if (cell(r, cm.fc)) rawCause++;
  const adjacentFn = (fmRow) => { for (let j = fmRow - 1; j <= Math.min(last, fmRow + 4); j++) { const v = cell(j, cm.funcStep); if (v && !isTemplatePrompt(v)) return v; } return ffFunc[fmRow] || ''; };

  // target ops
  const targets = TARGETS[key].map(([cls, num, name]) => ({ cls, num, name, failures: [], funcs: {} }));
  const byClass = Object.fromEntries(targets.map(t => [t.cls, t]));
  const unassigned = [];

  fmRows.forEach((fmRow, fi) => {
    const fmEnd = (fi + 1 < fmRows.length) ? fmRows[fi + 1] - 1 : last;
    const fmText = cell(fmRow, cm.fm);
    const eff = { local: [], next: [], end: [], reg: [] }; let curR = null, sevByLevel = {};
    for (let r = fmRow; r <= fmEnd; r++) { const e = cell(r, cm.effect), s = numOrNull(cell(r, cm.severity)); if (e) { if (RECIPIENT_RE.test(e)) curR = effectLevel(e); else if (curR) eff[curR].push(e); } if (s != null && curR) sevByLevel[curR] = Math.max(sevByLevel[curR] || 0, s); }
    const fmSeverity = Math.max(0, ...Object.values(sevByLevel)) || null;
    const causeRows = []; for (let r = fmRow; r <= fmEnd; r++) if (cell(r, cm.fc)) causeRows.push(r);
    const causes = causeRows.map((cRow, ci) => {
      const cEnd = ci + 1 < causeRows.length ? causeRows[ci + 1] - 1 : fmEnd;
      const firstIn = (col) => { for (let r = cRow; r <= cEnd; r++) { const v = cell(r, col); if (v) return v; } return ''; };
      const occ = numOrNull(firstIn(cm.occurrence)), det = numOrNull(firstIn(cm.detection));
      const ap = (fmSeverity && occ && det) ? calculateAP(fmSeverity, occ, det) : '';
      return { cause: firstIn(cm.fc) || cell(cRow, cm.fc), severity: fmSeverity, occurrence: occ, detection: det, apExcel: firstIn(cm.ap), ap, preventionControl: firstIn(cm.prevControl), detectionControl: firstIn(cm.detControl), specialChar: firstIn(cm.specialChar), preventionAction: firstIn(cm.prevAction), detectionAction: firstIn(cm.detAction), responsible: firstIn(cm.responsible), targetDate: firstIn(cm.targetDate), status: firstIn(cm.status), actionTaken: firstIn(cm.actionTaken), completionDate: firstIn(cm.completionDate), severityNew: numOrNull(firstIn(cm.sevNew)), occurrenceNew: numOrNull(firstIn(cm.occNew)), detectionNew: numOrNull(firstIn(cm.detNew)), observations: firstIn(cm.observations) };
    });
    const afn = adjacentFn(fmRow);
    let cls = classifyFM(fmText, causes[0]?.cause || '', afn, ffFunc[fmRow]);
    let target = cls && byClass[cls];
    if (cls === 'costura' && !target) { // genérico costura sin vista/union -> marcador
      const nm = nearestMarkerNum(fmRow); target = targets.find(t => t.num === nm && t.cls.startsWith('costura')) || byClass['costura_vista']; }
    if (!target) { // sin clase -> marcador más cercano mapeado a target
      const nm = nearestMarkerNum(fmRow);
      target = targets.find(t => t.num === nm || t.num.split('/').includes(nm)) || null;
      unassigned.push(`r${fmRow} "${fmText.slice(0,40)}" cls=${cls} afn="${afn.slice(0,20)}" -> ${target?.num || 'NINGUNO'}`);
    }
    if (!target) target = byClass['embalaje']; // último recurso (no debería pasar)
    const fail = { fm: fmText, effectLocal: eff.local.join(' '), effectNextLevel: eff.next.join(' '), effectEndUser: [...eff.end, ...eff.reg.filter(x => !/^(-|no aplica|n\/a)$/i.test(x))].join(' '), severity: fmSeverity, causes, _row: fmRow, _fn: afn, _cls: cls };
    target.failures.push(fail);
    if (afn) target.funcs[afn] = (target.funcs[afn] || 0) + 1;
  });

  const operations = targets.map(t => ({
    operationNumber: t.num, operationName: t.name, cls: t.cls,
    focusElementFunction: fItemAll.join('\n / '),
    operationFunction: Object.entries(t.funcs).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    failures: t.failures.sort((a, b) => a._row - b._row),
  }));
  const parsedFM = operations.reduce((a, o) => a + o.failures.length, 0);
  const parsedCause = operations.reduce((a, o) => a + o.failures.reduce((b, f) => b + f.causes.length, 0), 0);
  return { meta: { key, ip, sheet, headerRow: hr, lastRow: last, colMap: cm }, integrity: { rawFM: fmRows.length, parsedFM, rawCause, parsedCause, unassigned }, operations };
}

const argKey = process.argv[2], full = process.argv[3] === 'full';
const keys = argKey ? [argKey] : ['128', '129'];
mkdirSync('tmp', { recursive: true });
for (const k of keys) {
  const res = parseFile(k);
  writeFileSync(`tmp/amfe${k}.parsed.json`, JSON.stringify(res, null, 1));
  console.log(`\n#### AMFE ${k} (IP ${res.meta.ip}) ####`);
  console.log('INTEGRIDAD:', JSON.stringify({ rawFM: res.integrity.rawFM, parsedFM: res.integrity.parsedFM, rawCause: res.integrity.rawCause, parsedCause: res.integrity.parsedCause }),
    res.integrity.rawFM === res.integrity.parsedFM && res.integrity.rawCause === res.integrity.parsedCause ? 'OK ✓' : '*** MISMATCH ***');
  if (res.integrity.unassigned.length) { console.log(`  ⚠ FM sin clase (asignados por marcador), ${res.integrity.unassigned.length}:`); res.integrity.unassigned.forEach(x => console.log('     ' + x)); }
  for (const op of res.operations) {
    const nC = op.failures.reduce((a, f) => a + f.causes.length, 0);
    console.log(`  OP ${String(op.operationNumber).padEnd(6)} "${op.operationName.slice(0,44)}" FM:${op.failures.length} C:${nC}`);
    if (full) for (const f of op.failures) console.log(`       FM "${f.fm.slice(0,50)}" (cls:${f._cls})`);
  }
}
console.log('\nDONE');

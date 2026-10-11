/**
 * planControlCheck — el JSON intermedio del plan de control y sus gates, en las dos direcciones.
 *
 * La respuesta conocida es el plan del APB Patagonia que Calidad armo a mano y cuatro revisores
 * corrigieron el 06/10/2026 (plan P6 §7.4, etapa 1): operaciones 51/60/71/81/82/101 sin fila,
 * GE-280 y GE-276, ET-SATO con instrumento TBD, CONFLICTO de la hotmelera (190-210 vs 185 °C) y
 * del hilo (FX284TK vs FX284), parametros de la 70 y la 80 en TBD, atraque y alineacion de la 41
 * desde la HO-971, el MC212 marcado, el set up de la 30 sin texto de costura. Y la aprobacion:
 * cero celdas con valor sin sourceRef.
 *
 * Los fixtures son recortes de lo real (__tests__/fixtures/planControl/): ningun test lee
 * Supabase. Los lectores de Excel se prueban contra los archivos reales de exports/ solo si estan
 * en esta PC (en CI se saltean). El VERDE es el plan sano; el ROJO de cada gate es el defecto que
 * el 06/10 existio de verdad.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  leerAmfe, operacionesDelFlujograma, expandirNumeros, opsDeCelda, esVacioHo, remiteAlPlan, textoCelda,
  leerHoXlsx, leerBomXlsx, leerPlanExistenteXls, leerEntradas,
} from '../../scripts/_lib/planControlFuentes.mjs';
import {
  armarPlan, correrGates, compararConPlanExistente, reporteMarkdown, estadoDeFila, codigosEnHo, discrepanciasDeCodigo,
  gate0FlujogramaVsAmfe, gate1Filas, gate2Recepcion, gate4SourceRef, gate6Frecuencia, gateCalibracion, gateMaquinaSetUp,
  gateFichasEmbalaje, gateCodigoBomVsHo, gateCeldaVacia, CAMPOS_FORMULARIO, TBD, CONFLICTO, FRENO, AVISO,
} from '../../scripts/_lib/planControlCheck.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(AQUI, '..', 'fixtures', 'planControl');
const RAIZ = path.join(AQUI, '..', '..');
const leer = (f) => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));
const clonar = (x) => JSON.parse(JSON.stringify(x));

const flujoJson = leer('flujograma153.json');
const FLUJOGRAMA = { sourceId: 'FLUJOGRAMA-153', doc: 'Flujograma 153 Rev. E', revision: 'E', path: '', header: flujoJson.header, products: flujoJson.products, pasos: operacionesDelFlujograma(flujoJson) };
const AMFE_DOC = leer('amfe161_recorte.json');
const HO = leer('ho971_ciclo.json');
const BOM = leer('bom_apb.json');
const PC = leer('pc_apb_0610.json');
const ENTRADAS_REPO = leerEntradas('APB');

/** Las entradas del APB con las rutas apuntadas a los fixtures (en CI no esta .sgc-cache ni exports/). */
function entradas(mutar = () => {}) {
  const e = clonar(ENTRADAS_REPO);
  for (const p of Object.keys(e.procedimientos)) e.procedimientos[p].path = path.join(FIX, `${p}.stub.md`);
  e.fichasEmbalaje.fuente.path = path.join(FIX, 'QUE QUEDA PARA LA REUNION CON NICO.txt');
  mutar(e);
  return e;
}
const amfe = (doc = AMFE_DOC) => leerAmfe(doc, { numeroCasa: '161' });
const armar = (over = {}) => armarPlan({ flujograma: FLUJOGRAMA, amfe: amfe(), ho: HO, bom: BOM, planExistente: PC, entradas: entradas(), ...over });
const frenos = (lista) => lista.filter((x) => x.nivel === FRENO);
const filasDe = (plan, op) => plan.items.filter((i) => i.processStepNumber === String(op));
const refsDe = (item) => Object.values(item.sourceRef).flat();

const HO_XLSX = path.join(RAIZ, 'exports/HO_CORREGIDAS_20261007/APB/APB PATAGONIA HO 971.xlsx');
const BOM_XLSX = path.join(RAIZ, 'exports/BOM_OFICIAL_PATAGONIA_ULTIMO_NIVEL_ARB.xlsx');
const PC_XLS = path.join(RAIZ, 'exports/PC_NICO_20261006/PC APB PATAGONIA Rev 0 - correcciones de Ingenieria 06-10-2026.xls');

describe('lectores: lo que dice cada papel', () => {
  it('el flujograma 153 Rev. E tiene las 23 operaciones, con la 23 como storage', () => {
    const ns = FLUJOGRAMA.pasos.map((p) => p.n);
    expect(ns).toEqual(['10', '20', '21', '22', '23', '30', '40', '41', '50', '51', '60', '70', '71', '80', '81', '82', '90', '91', '92', '93', '100', '101', '110']);
    expect(FLUJOGRAMA.pasos.find((p) => p.n === '23').tipo).toBe('storage');
    expect(FLUJOGRAMA.pasos.find((p) => p.n === '10').sigla).toBe('D/TLD , SC');
  });
  it('el AMFE "90-92" cubre las tres operaciones y las causas traen su sigla y su control', () => {
    const a = amfe();
    expect(a.sourceId).toBe('AMFE-161');
    expect(a.operations.find((o) => o.n === '90-92').numeros).toEqual(['90', '91', '92']);
    const c = a.causas.find((x) => x.op === '41');
    expect(c.specialChar).toBe('SC');
    expect(c.detectionControl.length).toBeGreaterThan(0);
  });
  it('rangos y listas de operaciones: "92-90", "90/92", "90 y 91", "Operación 90 al 93"', () => {
    expect(expandirNumeros('41')).toEqual(['41']);
    expect(expandirNumeros('92-90')).toEqual(['90', '91', '92']);
    expect(expandirNumeros('90/92')).toEqual(['90', '92']);
    expect(expandirNumeros('90 y 91')).toEqual(['90', '91']);
    expect(opsDeCelda('Operación 90-93')).toEqual(['90', '91', '92', '93']);
    expect(opsDeCelda('Operación 90 al 93')).toEqual(['90', '91', '92', '93']);
    expect(opsDeCelda('Operación 10.')).toEqual(['10']);
    expect(opsDeCelda('Recepción')).toEqual([]);
  });
  it('celdas de la HO: "-", "–", "?", "N/D" y "PENDIENTE / TBD" no son dato; "N/A" si; "Según plan de control vigente" remite', () => {
    for (const t of ['-', '--', '–', '?', 'N/D', 'S/D', 'TBD', 'PENDIENTE / TBD', '']) expect(esVacioHo(t)).toBe(true);
    for (const t of ['N/A', 'Visual', '1', 'Inicio de turno']) expect(esVacioHo(t)).toBe(false);
    expect(remiteAlPlan('Según plan de control')).toBe(true);
    expect(remiteAlPlan('Según plan de control vigente')).toBe(true);
    expect(remiteAlPlan('Peso 120 +/- 5g')).toBe(false);
    expect(textoCelda({ richText: [{ text: ' Caracter' }, { text: 'ísticas  a controlar ' }] })).toBe('Características a controlar');
    expect(textoCelda({ formula: 'A1+1' })).toBe('');
    expect(textoCelda({ sharedFormula: 'B2', result: 4 })).toBe('4');
    expect(textoCelda({ raro: 1 })).toBe('');
  });
  it('la HO leida (fixture): una hoja por operacion, el ciclo con su celda, el bloque de reaccion en la columna B, y la hoja 10 remite al plan', () => {
    expect(HO.hojas.map((h) => h.hoja)).toContain('20.2');
    expect(HO.hojas.find((h) => h.hoja === '80').ciclo[0]).toMatchObject({ id: 'HO-971/80/I30', caracteristica: expect.stringMatching(/190 y 210/), registro: 'Set up' });
    expect(HO.hojas.find((h) => h.hoja === '10').ciclo[0].remite).toBe(true);
    expect(HO.hojas.find((h) => h.hoja === '40').reaccion.map((r) => r.celda)).toEqual(['B28', 'B29', 'B30', 'B31']);
    expect(HO.hojas.find((h) => h.hoja === '51').ciclo.map((c) => c.caracteristica)).toEqual([expect.stringMatching(/^Aspecto/), 'Peso 120 +/- 5g', 'Cota index 214 +/- 1mm', 'Control en calibre DIM']);
  });
  it('la BOM leida (fixture): el semielaborado INY-APB se abre en sus hijos; los 12 materiales comprados quedan', () => {
    const abren = BOM.materiales.filter((m) => m.seAbre);
    expect(abren.map((m) => m.codigo).sort()).toEqual(['INY-APB0001-V1', 'INY-APB0002-V1', 'INY-APB0003-V1', 'INY-APB0004-V1']);
    expect(abren[0].hijos).toEqual(['22020541', 'ET-SATO-50X20']);
    expect(BOM.materiales.filter((m) => !m.seAbre).length).toBe(12);
  });
  it('el plan existente (fixture): "Operación 90-93" son cuatro operaciones y el TEST DE LAY OUT no hereda la 110', () => {
    const ops = new Set(PC.filas.flatMap((f) => f.ops));
    expect([...ops]).toContain('93');
    expect([...ops]).not.toContain('1');
    expect(PC.filas.filter((f) => f.seccion === 'TEST DE LAY OUT').every((f) => f.ops.length === 0)).toBe(true);
  });
  it.skipIf(!fs.existsSync(HO_XLSX))('leerHoXlsx sobre el Excel real de la HO-971 da lo mismo que el fixture', async () => {
    const ho = await leerHoXlsx(HO_XLSX, { doc: 'HO-971' });
    expect(ho.sourceId).toBe('HO-971');
    expect(ho.hojas.length).toBe(26);
    expect(ho.hojas.map((h) => ({ hoja: h.hoja, ciclo: h.ciclo.map((c) => c.id), reaccion: h.reaccion.length }))).toEqual(HO.hojas.map((h) => ({ hoja: h.hoja, ciclo: h.ciclo.map((c) => c.id), reaccion: h.reaccion.length })));
  });
  it.skipIf(!fs.existsSync(BOM_XLSX))('leerBomXlsx sobre el informe real del arb da los mismos materiales que el fixture', () => {
    const bom = leerBomXlsx(BOM_XLSX, ['N 231', 'N 267', 'N 297', 'N 328']);
    expect(bom.materiales.map((m) => `${m.codigo}:${m.seAbre}`)).toEqual(BOM.materiales.map((m) => `${m.codigo}:${m.seAbre}`));
    expect(() => leerBomXlsx(BOM_XLSX, ['N 999'])).toThrow(/N 999/);
  });
  it.skipIf(!fs.existsSync(PC_XLS))('leerPlanExistenteXls sobre el .xls real de Calidad da las mismas filas que el fixture', () => {
    const pc = leerPlanExistenteXls(PC_XLS, { hoja: 'PC APB' });
    expect(pc.filas.map((f) => `${f.fila}:${f.ops.join('-')}`)).toEqual(PC.filas.map((f) => `${f.fila}:${f.ops.join('-')}`));
  });
});

describe('respuesta conocida: el APB del 06/10/2026', () => {
  const plan = armar();
  const hallazgos = correrGates(plan, { planExistente: PC });
  const comparacion = compararConPlanExistente(plan, PC);

  it('aprobacion: cero celdas con valor sin sourceRef (filas y encabezado), cero celdas vacias, estado coherente, ids deterministas', () => {
    expect(frenos(gate4SourceRef(plan))).toEqual([]);
    expect(gateCeldaVacia(plan)).toEqual([]);
    expect(plan.items.length).toBeGreaterThan(60);
    for (const i of plan.items) expect(i.status).toBe(estadoDeFila(i));
    expect(plan.header.partNumber).toBe('N 231 / N 267 / N 297 / N 328');
    expect(plan.header.phase).toBe('prelanzamiento');
    const otra = armar();
    expect(otra.items.map((i) => i.id)).toEqual(plan.items.map((i) => i.id));
    expect(new Set(plan.items.map((i) => i.id)).size).toBe(plan.items.length);
  });
  it('contra el plan de Calidad faltan la 51, 60, 71, 81, 82 y 101 (y la 21 y 22 que estaban adentro de la 20)', () => {
    const ns = comparacion.faltan.map((x) => x.split(' ')[0]);
    expect(ns).toEqual(['21', '22', '51', '60', '71', '81', '82', '101']);
  });
  it('gate 0: el AMFE vivo del 05/10 SI analiza esas operaciones (medido): cero faltantes; sin ellas en el AMFE, las lista', () => {
    expect(gate0FlujogramaVsAmfe(plan).filter((x) => /no esta en el AMFE/.test(x.mensaje))).toEqual([]);
    const sinSeis = clonar(AMFE_DOC);
    sinSeis.operations = sinSeis.operations.filter((o) => !['51', '60', '71', '81', '82', '101'].includes(o.operationNumber));
    const rojo = armar({ amfe: amfe(sinSeis) });
    const faltan = gate0FlujogramaVsAmfe(rojo).filter((x) => /no esta en el AMFE/.test(x.mensaje)).map((x) => x.op);
    expect(faltan).toEqual(['51', '60', '71', '81', '82', '101']);
    for (const op of faltan) {
      expect(filasDe(rojo, op).length).toBeGreaterThan(0);
      expect(filasDe(rojo, op).every((i) => i.notes.some((n) => /sin analisis AMFE/.test(n)))).toBe(true);
    }
  });
  it('GE-280 y GE-276: una fila cada una con el nombre (del txt del 06/10), el contenido TBD; sin la fila, el gate frena', () => {
    const fichas = filasDe(plan, '110').filter((i) => i.packagingSheetId);
    expect(fichas.map((i) => i.packagingSheetId).sort()).toEqual(['ficha:GE-276', 'ficha:GE-280']);
    for (const f of fichas) {
      expect(f.productCharacteristic).toMatch(/GE-2[78]/);
      expect(f.sourceRef.productCharacteristic).toEqual([{ sourceId: 'NICO-20261006', kind: 'declarada', loc: { nota: expect.stringMatching(/nombre y descripcion/) } }]);
      expect(f.rowOrigin.map((r) => r.sourceId)).toContain('NICO-20261006');
      for (const c of ['specification', 'evaluationTechnique', 'sampleFrequency', 'controlMethod']) expect(f[c]).toBe(TBD);
    }
    expect(gateFichasEmbalaje(plan)).toEqual([]);
    const rojo = clonar(plan);
    rojo.items = rojo.items.filter((i) => i.packagingSheetId !== 'ficha:GE-276');
    expect(frenos(gateFichasEmbalaje(rojo)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/GE-276/)]);
  });
  it('ET-SATO: fila de recepcion con instrumento TBD y sin familia; sin la fila, el gate 2 frena; el semielaborado propio no se recibe; la familia de ejemplo se avisa', () => {
    const et = plan.items.filter((i) => /^ET-SATO/.test(i.materialCode));
    expect(et.map((i) => i.materialCode).sort()).toEqual(['ET-SATO-100X60', 'ET-SATO-50X20']);
    for (const i of et) { expect(i.evaluationTechnique).toBe(TBD); expect(i.materialFamily).toBe(''); expect(i.controlMethod).toBe('P-10/I'); expect(i.reactionPlanOwner).toBe('Auditor de recepcion'); }
    const g2 = gate2Recepcion(plan);
    expect(g2.filter((x) => /ET-SATO-100X60: sin familia/.test(x.mensaje)).length).toBe(1);
    expect(g2.filter((x) => /VIN-SKM-001: familia VINILO de la tabla de EJEMPLO/.test(x.mensaje)).length).toBe(1);
    expect(frenos(g2)).toEqual([]);
    expect(plan.items.filter((i) => i.section === 'recepcion').length).toBe(12);
    expect(plan.items.some((i) => /^INY-APB/.test(i.materialCode))).toBe(false);
    expect(plan.pendientes.some((p) => /INY-APB0001-V1.*no se recibe.*22020541/.test(p.que))).toBe(true);
    const rojo = clonar(plan);
    rojo.items = rojo.items.filter((i) => i.materialCode !== 'ET-SATO-50X20');
    expect(frenos(gate2Recepcion(rojo)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/ET-SATO-50X20/)]);
  });
  it('hotmelera: la HO dice 190-210 y la receta 185: CONFLICTO con los dos papeles (HO-971 y la receta); sin el segundo valor o con la receta no legible, el gate 4 frena / la celda queda TBD', () => {
    const fila = plan.items.find((i) => i.hoQcItemId === 'HO-971/80/I30');
    expect(fila.rowKind).toBe('setup');
    expect(fila.specification).toBe(CONFLICTO);
    expect(fila.processCharacteristic).toBe(CONFLICTO);   // la caracteristica sale de la misma celda y trae el valor adentro
    expect(fila.status).toBe(CONFLICTO);
    const conf = fila.conflicts.find((c) => c.field === 'specification');
    expect(conf.values.map((v) => [v.value.slice(0, 20), v.sourceRef.sourceId])).toEqual([['Temperatura de la má', 'HO-971'], ['185 °C (consigna de ', 'RECETA-HOTMELT-20260826']]);
    expect(plan.pendientes.filter((p) => p.itemId === fila.id && p.field === 'specification').length).toBe(1);
    const rojo = clonar(plan);
    rojo.items.find((i) => i.id === fila.id).conflicts = [];
    expect(frenos(gate4SourceRef(rojo)).some((x) => /CONFLICTO sin dos valores/.test(x.mensaje))).toBe(true);
    const sinReceta = armar({ entradas: entradas((e) => { e.fuentesDeclaradas[0].readable = false; }) });
    const filaSinReceta = sinReceta.items.find((i) => i.hoQcItemId === 'HO-971/80/I30');
    expect(filaSinReceta.specification).toMatch(/190 y 210/);
    expect(filaSinReceta.status).toBe(TBD);
    expect(frenos(gate4SourceRef(sinReceta))).toEqual([]);
  });
  it('hilo: hoy la HO dice FX284-E0PTO (sin conflicto); con el FX284TK-E0PTO del 06/10 la fila del hilo queda en CONFLICTO; los otros codigos de la BOM no dan falsos positivos', () => {
    expect(discrepanciasDeCodigo(codigosEnHo(plan.catalog.hoSheets), plan.catalog.bomLines)).toEqual([]);
    expect(frenos(gateCodigoBomVsHo(plan))).toEqual([]);
    expect(codigosEnHo(plan.catalog.hoSheets).map((c) => c.codigo)).toEqual(expect.arrayContaining(['FX284-E0PTO', 'FX483TK-E0PTO']));
    const ho0610 = clonar(HO);
    const h40 = ho0610.hojas.find((h) => h.hoja === '40');
    h40.texto = h40.texto.replace(/FX284-E0PTO/g, 'FX284TK-E0PTO');
    const viejo = armar({ ho: ho0610 });
    expect(viejo.discrepanciasCodigo).toEqual([{ ho: 'FX284TK-E0PTO', bom: 'FX284-E0PTO', sheet: '40', op: '40' }]);
    const fila = viejo.items.find((i) => i.materialCode === 'FX284-E0PTO');
    expect(fila.status).toBe(CONFLICTO);
    expect(fila.conflicts[0].values.map((v) => v.value)).toEqual(['FX284-E0PTO', 'FX284TK-E0PTO']);
    expect(frenos(gateCodigoBomVsHo(viejo))).toEqual([]);
    expect(frenos(gate4SourceRef(viejo))).toEqual([]);
    const rojo = clonar(viejo);
    rojo.items.find((i) => i.materialCode === 'FX284-E0PTO').conflicts = [];
    expect(frenos(gateCodigoBomVsHo(rojo)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/falta marcar el CONFLICTO/)]);
    // un texto que nombre los demas codigos de la BOM tal cual no es discrepancia
    const texto = BOM.materiales.map((m) => m.codigo).join(' ');
    expect(discrepanciasDeCodigo(codigosEnHo([{ sheet: 'x', opNumber: '10', texto }]), plan.catalog.bomLines)).toEqual([]);
  });
  it('70 y 80: los parametros sin valor quedan TBD y en la lista de pendientes', () => {
    const f70 = filasDe(plan, '70');
    const f80 = filasDe(plan, '80');
    expect(f70.length).toBeGreaterThan(0);
    expect(f80.length).toBeGreaterThan(1);
    expect(f70.every((i) => i.specification === TBD)).toBe(true);
    expect(f80.filter((i) => i.hoQcItemId !== 'HO-971/80/I30').every((i) => i.specification === TBD)).toBe(true);
    expect(plan.pendientes.filter((p) => p.op === '70' && p.field === 'specification').length).toBeGreaterThan(0);
    expect(comparacion.sinValor.filter((x) => x.op === '70').length).toBeGreaterThanOrEqual(9);
    expect(comparacion.sinValor.filter((x) => x.op === '80').length).toBeGreaterThanOrEqual(4);
  });
  it('41: atraque y alineacion de la linea vista salen de la HO-971 hoja 41, con su celda; el plan de reaccion es el bloque de la HO', () => {
    const f41 = filasDe(plan, '41');
    const atraque = f41.find((i) => /Atraque/.test(i.productCharacteristic));
    const alineacion = f41.find((i) => /Alineaci/.test(i.productCharacteristic));
    expect(atraque.sourceRef.productCharacteristic).toEqual([{ sourceId: 'HO-971', kind: 'ho', loc: { sheet: '41', cell: 'I31' } }]);
    expect(alineacion.sourceRef.productCharacteristic[0].loc).toEqual({ sheet: '41', cell: 'I29' });
    expect(atraque.specification).toBe('Atraque inicio/fin: 3 a 4 puntadas');
    expect(alineacion.specification).toBe('Alineación y continuidad de la línea vista');
    expect(atraque.evaluationTechnique).toBe(TBD);   // la HO dice "-"
    expect(atraque.reactionPlan).toMatch(/DETENGA LA OPERACI/);
    expect(atraque.sourceRef.reactionPlan.map((r) => r.loc.cell)).toEqual(['B29', 'B30', 'B31', 'B32']);
    expect(atraque.processCharacteristic).toBe('N/A');
    expect(atraque.sourceRef.processCharacteristic[0]).toMatchObject({ sourceId: 'CONVENCION-FORMULARIO', loc: { clave: 'naColumnaQueNoAplica' } });
  });
  it('MC212: el calibre de las grampas frena (certificado NO OK, control de proceso); sin el dato de calibracion solo avisa', () => {
    const cal = gateCalibracion(plan, { planExistente: PC });
    expect(frenos(cal).map((x) => x.mensaje)).toEqual([expect.stringMatching(/MC212.*NO OK/), expect.stringMatching(/MC212.*NO OK/)]);
    expect(cal.some((x) => x.nivel === AVISO && /MC167/.test(x.mensaje))).toBe(true);
    const sinTabla = armar({ entradas: entradas((e) => { e.calibracion.instrumentos = {}; }) });
    expect(frenos(gateCalibracion(sinTabla, { planExistente: PC }))).toEqual([]);
    expect(gateCalibracion(sinTabla, { planExistente: PC }).filter((x) => /MC212/.test(x.mensaje)).length).toBe(2);
  });
  it('30: el set up sale TBD sin ninguna referencia a la 40 o 41, y el del plan de Calidad no tiene ni una palabra en la HO de la 30', () => {
    const setUps = filasDe(plan, '30').filter((i) => i.rowKind === 'setup');
    expect(setUps.length).toBe(1);
    expect(setUps[0].specification).toBe(TBD);
    expect(setUps[0].processCharacteristic).toBe('Set up de maquina');
    const hojas = refsDe(setUps[0]).filter((r) => r.kind === 'ho').map((r) => r.loc.sheet);
    expect(hojas.length).toBeGreaterThan(0);
    expect(hojas.every((s) => s.startsWith('30'))).toBe(true);
    expect(gateMaquinaSetUp(plan)).toEqual([]);
    expect(comparacion.setUpAjeno.filter((x) => x.op === '30')).toEqual([expect.objectContaining({ enPropia: 0 })]);
  });
  it('gate 1: cada operacion y cada item de la HO tienen fila; las causas del AMFE sin fila se listan como aviso; sin fila para un item, frena', () => {
    const g1 = gate1Filas(plan);
    expect(frenos(g1)).toEqual([]);
    expect(g1.filter((x) => /causa sin fila/.test(x.mensaje)).length).toBeGreaterThan(10);
    expect(g1.filter((x) => /remite al plan de control/.test(x.mensaje)).map((x) => x.op)).toEqual(['10']);
    const rojo = clonar(plan);
    rojo.items = rojo.items.filter((i) => i.hoQcItemId !== 'HO-971/41/I31');
    expect(frenos(gate1Filas(rojo)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/hoja 41, fila 31/)]);
  });
  it('el reporte se escribe y nombra lo que importa', () => {
    const md = reporteMarkdown(plan, hallazgos, comparacion);
    for (const t of ['CONFLICTO', 'GE-276', 'MC212', 'ET-SATO-50X20', '51 CONTROL DE PIEZA INYECTADA', 'Pendientes', 'leida · HO-971', 'NO leida · FICHAS-EMBALAJE']) expect(md).toContain(t);
  });
});

describe('gemelos rojos de los gates que el plan sano no dispara', () => {
  const plan = armar();
  it('gate 4: un valor sin sourceRef, o que cita una fuente no leida, o un pendiente colgado, o un encabezado sin papel, frena', () => {
    const rojo = clonar(plan);
    const fila = rojo.items.find((i) => i.processStepNumber === '41' && i.rowKind === 'producto');
    fila.sourceRef.productCharacteristic = [];
    expect(frenos(gate4SourceRef(rojo)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/productCharacteristic .* sin sourceRef/)]);
    const rojo2 = clonar(plan);
    rojo2.sources.find((s) => s.id === 'HO-971').readable = false;
    expect(frenos(gate4SourceRef(rojo2)).length).toBeGreaterThan(20);
    const rojo3 = clonar(plan);
    rojo3.items[0].status = 'OK'; rojo3.items[0].specification = TBD;
    expect(frenos(gate4SourceRef(rojo3)).some((x) => /status guardado/.test(x.mensaje))).toBe(true);
    const rojo4 = clonar(plan);
    rojo4.pendientes.push({ itemId: rojo4.items[5].id, field: 'processStepNumber', op: '10', que: 'x', porque: 'y' });
    expect(frenos(gate4SourceRef(rojo4)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/pendiente colgado: processStepNumber/)]);
    const rojo5 = clonar(plan);
    rojo5.header.sourceRef.partName = [];
    expect(frenos(gate4SourceRef(rojo5)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/encabezado\.partName .* sin sourceRef/)]);
    const rojo6 = clonar(plan);
    rojo6.items[0].rowOrigin = [];
    expect(frenos(gate4SourceRef(rojo6)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/rowOrigin.* sin sourceRef/)]);
  });
  it('gate 4: una sigla sin causa del AMFE que la respalde frena; copiada de una causa vinculada por la tabla explicita, pasa; el numero de caracteristica NO vincula', () => {
    const rojo = clonar(plan);
    rojo.items.find((i) => i.processStepNumber === '41').specialCharClass = 'SC';
    expect(frenos(gate4SourceRef(rojo)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/sigla "SC" sin sourceRef/)]);
    const op41 = AMFE_DOC.operations.find((o) => o.operationNumber === '41');
    const causa = op41.workElements[0].functions[0].failures[0].causes[0];
    const key = plan.items.find((i) => i.hoQcItemId === 'HO-971/41/I31').key;
    const verde = armar({ entradas: entradas((e) => { e.vinculos.causaAFila = [{ causeId: causa.id, itemKey: key }]; }) });
    const fila = verde.items.find((i) => i.key === key);
    expect(fila.amfeCauseIds).toEqual([causa.id]);
    expect(fila.classification).toEqual(['SC']);
    expect(fila.sourceRef.specialCharClass[0]).toEqual({ sourceId: 'AMFE-161', kind: 'amfe', loc: { opId: op41.id, causeId: causa.id } });
    expect(fila.notes.some((n) => /sigla SC copiada de la causa/.test(n))).toBe(true);
    expect(frenos(gate4SourceRef(verde))).toEqual([]);
    expect(gate1Filas(verde).filter((x) => x.mensaje.includes(causa.id))).toEqual([]);
    const porNumero = clonar(AMFE_DOC);
    porNumero.operations.find((o) => o.operationNumber === '41').workElements[0].functions[0].failures[0].causes[0].characteristicNumber = '1.0';
    expect(armar({ amfe: amfe(porNumero) }).items.filter((i) => i.amfeCauseIds.length)).toEqual([]);
  });
  it('gate 6: sin fase frena; una frecuencia de proceso que cita al AMFE frena', () => {
    const sinFase = armar({ entradas: entradas((e) => { delete e.phase; }) });
    expect(sinFase.header.phase).toBe(TBD);
    expect(frenos(gate6Frecuencia(sinFase)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/sin fase/)]);
    expect(gate6Frecuencia(plan)).toEqual([]);
    const rojo = clonar(plan);
    const fila = rojo.items.find((i) => i.processStepNumber === '80' && i.rowKind === 'setup');
    fila.sampleFrequency = 'Cada hora'; fila.sourceRef.sampleFrequency = [{ sourceId: 'AMFE-161', kind: 'amfe', loc: {} }];
    expect(frenos(gate6Frecuencia(rojo)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/AMFE-161.*solo vale ho\/ficha/)]);
  });
  it('gate maquina / set up: una maquina que la HO de esa operacion no nombra frena; un set up cuya caracteristica cita otra hoja frena', () => {
    const rojo = armar({ entradas: entradas((e) => { e.maquinas['30'].machineDeviceTool = 'Maquina de coser'; }) });
    expect(frenos(gateMaquinaSetUp(rojo)).map((x) => x.mensaje)).toEqual(expect.arrayContaining([expect.stringMatching(/Maquina de coser.*ninguna hoja de la HO de la 30/)]));
    const rojo2 = clonar(plan);
    const setUp30 = rojo2.items.find((i) => i.processStepNumber === '30' && i.rowKind === 'setup');
    setUp30.processCharacteristic = 'hilo correcto, crochet ok'; setUp30.sourceRef.processCharacteristic = [{ sourceId: 'HO-971', kind: 'ho', loc: { sheet: '40', cell: 'I26' } }];
    expect(frenos(gateMaquinaSetUp(rojo2)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/set up de la 30: processCharacteristic cita HO-971 hoja 40/)]);
  });
  it('gate 1 no aprueba en vacio: una HO legible sin items de ciclo de control frena', () => {
    const hoSinItems = clonar(HO);
    for (const h of hoSinItems.hojas) h.ciclo = [];
    const vacio = armar({ ho: hoSinItems });
    expect(frenos(gate1Filas(vacio)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/no tiene ningun item de ciclo de control/)]);
  });
  it('gate celda vacia: una celda en blanco frena; una convencion sin clave deja la celda TBD en vez de inventar la nota', () => {
    const rojo = clonar(plan);
    rojo.items[3].sampleSize = '';
    expect(gateCeldaVacia(rojo).map((x) => x.mensaje)).toEqual([expect.stringMatching(/sampleSize vacio/)]);
    expect(CAMPOS_FORMULARIO).toContain('reactionPlan');
    const sinConv = armar({ entradas: entradas((e) => { delete e.convenciones.naMaquinaRecepcion; delete e.convenciones.setUpDeMaquina; }) });
    expect(sinConv.items.find((i) => i.section === 'recepcion').machineDeviceTool).toBe(TBD);
    expect(sinConv.items.find((i) => i.processStepNumber === '30' && i.rowKind === 'setup').processCharacteristic).toBe(TBD);
    expect(frenos(gate4SourceRef(sinConv))).toEqual([]);
  });
});

describe('mutacion: sin la HO-971 en las entradas (plan P6 §7.5.1)', () => {
  const base = armar();
  const mutado = armar({ ho: null });
  it('ninguna celda cita la HO, lo que solo venia de ella pasa a TBD fila por fila, y no aparece ningun valor nuevo', () => {
    const refsHo = mutado.items.flatMap(refsDe).filter((r) => r.sourceId === 'HO-971');
    expect(refsHo).toEqual([]);
    expect(mutado.sources.some((s) => s.id === 'HO-971')).toBe(false);
    const porId = new Map(mutado.items.map((i) => [i.id, i]));
    let soloHo = 0;
    let filasConservadas = 0;
    for (const i of base.items) {
      const m = porId.get(i.id);
      if (m) filasConservadas += 1;
      for (const c of CAMPOS_FORMULARIO) {
        const refs = i.sourceRef[c] || [];
        if (refs.length && refs.every((r) => r.sourceId === 'HO-971')) {
          soloHo += 1;
          if (m) expect(m[c]).toBe(TBD);
        }
      }
    }
    expect(soloHo).toBeGreaterThan(30);
    expect(filasConservadas).toBeGreaterThan(20);
    // fila por fila: una celda del mutado que no es TBD tiene que valer lo mismo que en la base, o venir de otra fuente que no es la HO
    // (el numero de caracteristica es la numeracion del formulario, 1.0/2.0 por operacion, y se vuelve a contar con menos filas)
    const basePorId = new Map(base.items.map((i) => [i.id, i]));
    for (const i of mutado.items) {
      const b = basePorId.get(i.id);
      for (const c of CAMPOS_FORMULARIO.filter((x) => x !== 'characteristicNumber')) {
        if (i[c] === TBD) continue;
        if (b) expect(i[c]).toBe(b[c]);
        else expect((i.sourceRef[c] || []).every((r) => r.sourceId !== 'HO-971')).toBe(true);
      }
    }
    expect(mutado.items.length).toBeLessThan(base.items.length);
  });
  it('los gates no aprueban en vacio: el gate 1 frena por fuente HO ausente; el gate 4 sigue limpio; la receta no sobrevive sola', () => {
    expect(frenos(gate1Filas(mutado)).map((x) => x.mensaje)).toEqual([expect.stringMatching(/fuente HO ausente/)]);
    expect(frenos(gate4SourceRef(mutado))).toEqual([]);
    expect(gateCeldaVacia(mutado)).toEqual([]);
    expect(mutado.items.some((i) => i.status === CONFLICTO && i.processStepNumber === '80')).toBe(false);
    expect(mutado.items.flatMap(refsDe).some((r) => r.sourceId === 'RECETA-HOTMELT-20260826')).toBe(false);
  });
});

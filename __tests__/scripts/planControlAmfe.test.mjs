/**
 * planControlAmfe — el cruce AMFE <-> plan de control (P6 etapa 2), en las dos direcciones.
 *
 * Respuesta conocida (plan P6 §7.4 etapa 2, medida sobre el AMFE 161 vivo del 05/10/2026, 171
 * causas): la propuesta de siglas va en hoja aparte y la columna del plan queda vacia; con una
 * tabla de vinculos de EJEMPLO (fixture marcado como tal) la columna es igual a las siglas de las
 * causas vinculadas; hoy las 171 causas estan sin fila; el control final del plan de Calidad mira
 * «4 en 16 mm», que es la costura de union (oculta), y eso sale marcado. Cada estado del gate 8 y
 * cada chequeo del §7.6 tiene su gemelo rojo.
 *
 * Fixtures: recortes de lo real en __tests__/fixtures/planControl/. Ningun test lee Supabase.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerAmfe, operacionesDelFlujograma, leerEntradas } from '../../scripts/_lib/planControlFuentes.mjs';
import { armarPlan, compararConPlanExistente, TBD, CONFLICTO, FRENO, AVISO } from '../../scripts/_lib/planControlCheck.mjs';
import { validateAmfeDoc } from '../../scripts/_lib/amfeValidator.mjs';
import {
  instrumentoDe, frecuenciasDe, esIdentificable, propuestaDeSiglas, propuestaMarkdown, gate3Siglas, gate7ControlFinal,
  caracteristicaDeclaradaDe, cruceAmfePlan, gate8AmfeVsPlan, casosCruce, correrEtapa2, reporteEtapa2, ESTADOS, CANON,
} from '../../scripts/_lib/planControlAmfe.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(AQUI, '..', 'fixtures', 'planControl');
const leer = (f) => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));
const clonar = (x) => JSON.parse(JSON.stringify(x));

const flujoJson = leer('flujograma153.json');
const FLUJOGRAMA = { sourceId: 'FLUJOGRAMA-153', doc: 'Flujograma 153 Rev. E', revision: 'E', path: '', header: flujoJson.header, products: flujoJson.products, pasos: operacionesDelFlujograma(flujoJson) };
const AMFE_DOC = leer('amfe161_recorte.json');
const HO = leer('ho971_ciclo.json');
const BOM = leer('bom_apb.json');
const PC = leer('pc_apb_0610.json');
const VINCULOS = leer('vinculos_ejemplo.json');
const ENTRADAS_REPO = leerEntradas('APB');

function entradas(mutar = () => {}) {
  const e = clonar(ENTRADAS_REPO);
  for (const p of Object.keys(e.procedimientos)) e.procedimientos[p].path = path.join(FIX, `${p}.stub.md`);
  e.fichasEmbalaje.fuente.path = path.join(FIX, 'QUE QUEDA PARA LA REUNION CON NICO.txt');
  mutar(e);
  return e;
}
const amfe = (doc = AMFE_DOC) => leerAmfe(doc, { numeroCasa: '161' });
const armar = ({ vinculos = [], doc = AMFE_DOC, mutar = () => {}, ...over } = {}) => armarPlan({
  flujograma: FLUJOGRAMA, amfe: amfe(doc), ho: HO, bom: BOM, planExistente: PC,
  entradas: entradas((e) => { e.vinculos.causaAFila = vinculos; mutar(e); }), ...over,
});
const frenos = (lista) => lista.filter((x) => x.nivel === FRENO);
const id = (plan, pref) => plan.catalog.amfeCauses.find((c) => c.id.startsWith(pref)).id;
/** Un AMFE con una causa cambiada (por prefijo de id) y, si se pide, su modo de falla tambien. */
function amfeCon(pref, cambio, cambioFalla = null) {
  const doc = clonar(AMFE_DOC);
  let n = 0;
  for (const op of doc.operations) for (const we of op.workElements) for (const fn of we.functions) for (const f of fn.failures) for (const c of f.causes) if (c.id.startsWith(pref)) { Object.assign(c, cambio); if (cambioFalla) Object.assign(f, cambioFalla); n += 1; }
  if (n !== 1) throw new Error(`amfeCon: ${pref} aparece ${n} veces`);
  return doc;
}
/** Cambia el MODO DE FALLA de una causa (la S vive ahi). */
const amfeConFalla = (pref, cambioFalla) => amfeCon(pref, {}, cambioFalla);

const VIVO = armar();                                   // como esta hoy: sin vinculos
const CON = armar({ vinculos: VINCULOS.causaAFila });   // con la tabla de EJEMPLO

describe('identificar un control: codigo MC### o termino exacto del canon', () => {
  it('el termino mas largo gana y un control puede traer mas de un instrumento', () => {
    expect(instrumentoDe('Contra calibre')).toMatchObject({ tipos: ['CALIBRE_DE_CONTROL'], clase: 'instrumento' });
    expect(instrumentoDe('Calibre Vernier').tipos).toEqual(['CALIBRE']);
    expect(instrumentoDe('CON CALIBRE MC167')).toMatchObject({ codigo: 'MC167', tipos: ['CALIBRE'] });
    expect(instrumentoDe('Pesaje en balanza por entrega / regla').tipos).toEqual(['BALANZA', 'REGLA']);
    expect(instrumentoDe('Medición de ancho con cinta métrica por entrega').tipos).toEqual(['CINTA_METRICA']);
    expect(instrumentoDe('Visual - plantilla Mylar').tipos).toEqual(['PLANTILLA_MYLAR']);
  });
  it('visual, pieza patron y certificado del proveedor NO son un instrumento identificable', () => {
    for (const t of ['Inspección visual', 'Visual', 'Control visual del operario', 'Inspección de calidad', 'Verificación de certificado de inflamabilidad del proveedor', '', TBD]) expect(esIdentificable(instrumentoDe(t))).toBe(false);
    const patron = instrumentoDe('Inspección visual 100% + pieza patron');
    expect(patron).toMatchObject({ clase: 'referencia', referencias: ['PATRON'], tipos: [] });
    expect(esIdentificable(patron)).toBe(false);
    expect(instrumentoDe('Verificación vs patron')).toBe(null);   // «patron» suelto no es un termino del canon
    expect(instrumentoDe('recalibrar el equipo')).toBe(null);     // «calibre» adentro de otra palabra no cuenta
  });
  it('frecuencias por termino exacto; lo que el canon no tiene no se reconoce', () => {
    expect(frecuenciasDe('Inspección visual 100% + calibre')).toEqual(['100%']);
    expect(frecuenciasDe('Medición con calibre digital por lote')).toEqual(['POR_LOTE']);
    expect(frecuenciasDe('Inicio turno / Mantenimiento / Corte de energía')).toEqual(['INICIO_DE_TURNO']);
    expect(frecuenciasDe('Al inicio, medio y fin de producción.')).toEqual([]);
    expect(frecuenciasDe('1')).toEqual([]);
    expect(CANON.clases_identificables).toEqual(['instrumento']);
  });
});

describe('propuesta de siglas: hoja aparte, nunca la columna del plan', () => {
  const prop = propuestaDeSiglas(VIVO);
  it('medido sobre el AMFE 161: 171 causas, 50 con sigla que el criterio sostiene (0 fuera de regla) y 4 candidatas sin sigla (las de la 60 y la 71)', () => {
    expect(prop.resumen).toMatchObject({ causas: 171, conSigla: 50, coinciden: 50, siglaFueraDeRegla: 0, siglaDesconocida: 0, candidatasSinSigla: 4, criticasPorCriterio: 3, vinculadasAlPlan: 0 });
    const pref = (dif) => prop.filas.filter((x) => x.diferencias.includes(dif)).map((x) => x.causeId.slice(0, 8)).sort();
    expect(pref('SIGLA_FUERA_DE_REGLA')).toEqual([]);
    expect(pref('CANDIDATA_SIN_SIGLA')).toEqual(['0e7653fa', '3e4c9706', 'a1cb3b6c', 'acf25e7d']);
    expect(prop.filas.filter((x) => x.diferencias.includes('CANDIDATA_SIN_SIGLA')).map((x) => x.op).sort()).toEqual(['60', '60', '71', '71']);
  });
  it('la propuesta dice lo mismo que el validador de la casa sobre el mismo AMFE (la S es la del modo de falla)', () => {
    const v = validateAmfeDoc(clonar(AMFE_DOC), 'APB', '161').all;
    const n = (tipo) => v.filter((x) => x.type === tipo).length;
    expect(n('CAUSE_SC_FUERA_DE_REGLA') + n('CAUSE_CC_LOW_SEVERITY')).toBe(prop.resumen.siglaFueraDeRegla);
    expect(n('SIGLA_DESCONOCIDA')).toBe(prop.resumen.siglaDesconocida);
    expect(n('CAUSE_SEVERITY_PROPIA')).toBe(prop.resumen.sPropiaEnLaCausa);
    expect(prop.resumen.sPropiaEnLaCausa).toBeGreaterThan(0);
    // y con un defecto de verdad los dos lo ven: una SC sobre un modo de falla con S4
    const malo = amfeConFalla('53c9310d', { severity: 4 });
    expect(validateAmfeDoc(clonar(malo), 'APB', '161').all.filter((x) => x.type === 'CAUSE_SC_FUERA_DE_REGLA').length).toBeGreaterThan(0);
    expect(propuestaDeSiglas(armar({ doc: malo })).resumen.siglaFueraDeRegla).toBe(validateAmfeDoc(clonar(malo), 'APB', '161').all.filter((x) => x.type === 'CAUSE_SC_FUERA_DE_REGLA').length);
  });
  it('la S es la del MODO DE FALLA: la severidad suelta que arrastra una causa no decide nada, solo se informa', () => {
    // «Hilo inadecuado» (OP 40) arrastra severity 4 y su modo de falla tiene 8: su SC vale (S8 O4)
    const a742 = prop.filas.find((x) => x.causeId.startsWith('a742fa5e'));
    expect(a742).toMatchObject({ S: 8, SCausa: 4, O: 4, nivelPorCriterio: 'SIGNIFICATIVA', siglaActual: 'SC' });
    expect(a742.diferencias).toEqual(['S_PROPIA_EN_LA_CAUSA']);
    // cambiarle la severity a la CAUSA no mueve el nivel; cambiarsela al modo de falla, si
    expect(propuestaDeSiglas(armar({ doc: amfeCon('a742fa5e', { severity: 2 }) })).filas.find((x) => x.causeId.startsWith('a742fa5e')).nivelPorCriterio).toBe('SIGNIFICATIVA');
    const baja = propuestaDeSiglas(armar({ doc: amfeConFalla('a742fa5e', { severity: 4 }) })).filas.find((x) => x.causeId.startsWith('a742fa5e'));
    expect(baja).toMatchObject({ S: 4, nivelPorCriterio: '' });
    expect(baja.diferencias).toContain('SIGLA_FUERA_DE_REGLA');
    // S 5 a 8 con O 3 no es candidata
    const o3 = propuestaDeSiglas(armar({ doc: amfeCon('0e7653fa', { occurrence: 3 }) })).filas.find((x) => x.causeId.startsWith('0e7653fa'));
    expect(o3.diferencias).not.toContain('CANDIDATA_SIN_SIGLA');
  });
  it('una critica (S9) da el NIVEL y dice que la marca la designa el plano; la palabra «flamabilidad» no decide nada', () => {
    const criticas = prop.filas.filter((x) => x.nivelPorCriterio === 'CRITICA');
    expect(criticas.length).toBe(3);
    for (const c of criticas) { expect(c.S).toBe(9); expect(c.nota).toMatch(/la designa el cliente en el plano/); expect(c.siglaActual).toBe('D/TLD'); expect(c.diferencias.filter((d) => d !== 'S_PROPIA_EN_LA_CAUSA')).toEqual([]); }
    // el mismo modo de falla con S7: ya no es critica por mas que el texto diga flamabilidad, y su D/TLD queda fuera de regla
    const baja = propuestaDeSiglas(armar({ doc: amfeConFalla('34327bf9', { severity: 7 }) })).filas.find((x) => x.causeId.startsWith('34327bf9'));
    expect(baja.causa).toMatch(/flamabilidad/i);
    expect(baja.nivelPorCriterio).toBe('');
    expect(baja.diferencias).toContain('SIGLA_FUERA_DE_REGLA');
    // si la designo el cliente (specialCharSource), no es «fuera de regla»: se informa la diferencia, no se sube la S
    const cliente = propuestaDeSiglas(armar({ doc: amfeCon('34327bf9', { specialCharSource: 'plano VW' }, { severity: 7 }) })).filas.find((x) => x.causeId.startsWith('34327bf9'));
    expect(cliente.diferencias).toContain('CRITICA_DESIGNADA_POR_EL_CLIENTE_CON_S_MENOR_A_9');
    // «-» y «N/A» no son una sigla; OS y HI comparten el criterio de la significativa
    const guion = propuestaDeSiglas(armar({ doc: amfeCon('53c9310d', { specialChar: '-' }) })).filas.find((x) => x.causeId.startsWith('53c9310d'));
    expect(guion).toMatchObject({ siglaActual: '' });
    expect(guion.diferencias).toContain('CANDIDATA_SIN_SIGLA');
    expect(propuestaDeSiglas(armar({ doc: amfeCon('53c9310d', { specialChar: 'OS' }) })).filas.find((x) => x.causeId.startsWith('53c9310d')).diferencias).not.toContain('SIGLA_FUERA_DE_REGLA');
    // una sigla que ninguna fuente reconoce no se adivina
    const w = propuestaDeSiglas(armar({ doc: amfeCon('53c9310d', { specialChar: 'W' }) })).filas.find((x) => x.causeId.startsWith('53c9310d'));
    expect(w.diferencias).toContain('SIGLA_DESCONOCIDA');
  });
  it('la propuesta NO entra a la columna: sin vinculos, ninguna fila lleva sigla aunque el criterio proponga 4 y el AMFE tenga 50', () => {
    expect(VIVO.items.filter((i) => i.classification.length || i.specialCharClass)).toEqual([]);
    expect(gate3Siglas(VIVO)).toEqual([]);
    const md = propuestaMarkdown(VIVO, prop);
    expect(md).toContain('Esto NO asigna nada');
    expect(md).toContain('CANDIDATA_SIN_SIGLA');
    expect(md).toContain('## Diferencias de sigla (4)');
  });
  it('con la tabla de vinculos de EJEMPLO la columna es igual a las siglas de las causas vinculadas, y cada sigla dice de que causa salio', () => {
    expect(VINCULOS._doc).toMatch(/^EJEMPLO/);
    const conSigla = CON.items.filter((i) => i.classification.length);
    expect(conSigla.map((i) => `${i.key}=${i.specialCharClass}`).sort()).toEqual(['bom:VIN-SKM-001=D/TLD', 'ho:HO-971/40/I26=SC', 'ho:HO-971/41/I27=SC', 'setup:93=SC', 'sin-ho:100=SC']);
    for (const i of conSigla) {
      const causas = i.amfeCauseIds.map((c) => CON.catalog.amfeCauses.find((x) => x.id === c));
      expect(i.classification).toEqual([...new Set(causas.map((c) => c.specialChar).filter(Boolean))]);
      expect(i.sourceRef.specialCharClass.map((r) => r.loc.causeId)).toEqual(causas.filter((c) => c.specialChar).map((c) => c.id));
      expect(i.notes.some((n) => /copiada de la causa/.test(n))).toBe(true);
    }
    // una causa vinculada sin sigla no le pone nada a la fila
    expect(CON.items.find((i) => i.key === 'setup:HO-971/51/I25')).toMatchObject({ classification: [], specialCharClass: '' });
    expect(gate3Siglas(CON)).toEqual([]);
    expect(propuestaDeSiglas(CON).resumen.vinculadasAlPlan).toBe(8);
  });
  it('gate 3 rojo: una sigla puesta a mano (calculada, heredada o de mas) frena; una de menos tambien', () => {
    const rojo = clonar(VIVO);
    Object.assign(rojo.items.find((i) => i.key === 'ho:HO-971/41/I27'), { classification: ['SC'], specialCharClass: 'SC' });
    expect(gate3Siglas(rojo).map((x) => x.mensaje)).toEqual([expect.stringMatching(/"SC" distinta de las siglas de sus causas vinculadas \(ninguna\)/)]);
    const rojo2 = clonar(CON);
    Object.assign(rojo2.items.find((i) => i.key === 'bom:VIN-SKM-001'), { classification: [], specialCharClass: '' });
    expect(gate3Siglas(rojo2).map((x) => x.mensaje)).toEqual([expect.stringMatching(/\(vacia\).*D\/TLD/)]);
    const rojo3 = clonar(CON);
    rojo3.items.find((i) => i.key === 'bom:VIN-SKM-001').amfeCauseIds.push('no-existe');
    expect(gate3Siglas(rojo3).some((x) => /no esta en el AMFE leido/.test(x.mensaje))).toBe(true);
    // una sigla que ninguna fuente reconoce no pasa a la columna aunque el AMFE la tenga
    const w = armar({ vinculos: VINCULOS.causaAFila, doc: amfeCon('53c9310d', { specialChar: 'W' }) });
    expect(gate3Siglas(w).map((x) => x.mensaje)).toEqual([expect.stringMatching(/la sigla "W" no es de ninguna fuente/)]);
    // «D / TLD» con espacios, «sc» en minuscula y «-» no rompen la copia: se normalizan
    const raro = armar({ vinculos: [...VINCULOS.causaAFila, { causeId: id(VIVO, '81fbc92b'), itemKey: 'bom:VIN-SKM-001' }, { causeId: id(VIVO, '8649d6b1'), itemKey: 'bom:VIN-SKM-001' }], doc: amfeCon('34327bf9', { specialChar: 'D / TLD' }) });
    const filaRara = raro.items.find((i) => i.key === 'bom:VIN-SKM-001');
    expect(filaRara.specialCharClass).toBe('D/TLD + SC');
    expect(gate3Siglas(raro)).toEqual([]);
    expect(armar({ vinculos: VINCULOS.causaAFila, doc: amfeCon('53c9310d', { specialChar: 'N/A' }) }).items.find((i) => i.key === 'ho:HO-971/41/I27').classification).toEqual([]);
  });
});

describe('gate 7: el control final mira lo que una fuente marca apariencia o funcion', () => {
  const declaradas = VIVO.catalog.declaredCharacteristics;
  it('las claves declaradas son numeros enteros del texto: «160 mm» no es «16» y «24 piezas» no es «4»', () => {
    expect(caracteristicaDeclaradaDe('Largo de puntada 4mm (4puntadas 16+/-1mm)', declaradas).declarada.id).toBe('COSTURA-UNION-APB');
    expect(caracteristicaDeclaradaDe('6 en 25 mm (+/- 0,5)', declaradas).declarada.id).toBe('COSTURA-VISTA-APB');
    expect(caracteristicaDeclaradaDe('Largo 160 mm, 24 piezas, 4 cajas', declaradas).declarada).toBe(null);
    expect(caracteristicaDeclaradaDe('Sin pliegues o arrugas', declaradas).declarada).toBe(null);
    expect(caracteristicaDeclaradaDe('4 en 16 y 6 en 25', declaradas)).toEqual({ declarada: null, ambigua: true });
    expect(caracteristicaDeclaradaDe('Etiqueta 16x4', declaradas).declarada).toBe(null);   // las claves van en su orden
    expect(caracteristicaDeclaradaDe('4,0 puntadas en 16,0 mm', declaradas).declarada.id).toBe('COSTURA-UNION-APB');
  });
  it('APB: el plan de Calidad mira «4 en 16 mm» (la costura de union, oculta) y sale marcado; lo demas se lista como falta marcar; el plan generado tiene la 100 en TBD', () => {
    const g7 = gate7ControlFinal(VIVO, { planExistente: PC });
    expect(frenos(g7).map((x) => x.mensaje)).toEqual([expect.stringMatching(/plan existente fila 206.*4puntadas 16.*costura de union.*HO-971 marca OCULTA.*6 puntadas en 25 mm/)]);
    expect(g7.filter((x) => x.nivel === AVISO && /plan existente fila \d+.*falta marcarla/.test(x.mensaje)).length).toBe(7);
    expect(g7.filter((x) => /sin caracteristica definida \(TBD\)/.test(x.mensaje)).map((x) => x.op)).toEqual(['100']);
  });
  it('plan generado: una fila de control final con valor pasa solo por referencia a una caracteristica de apariencia o funcion', () => {
    const fila = (mut) => { const p = clonar(VIVO); const i = p.items.find((x) => x.key === 'sin-ho:100'); Object.assign(i, { productCharacteristic: 'Largo de puntada', specification: '6 en 25 mm (±0,5)' }, mut); return p; };
    expect(frenos(gate7ControlFinal(fila({ characteristicRef: 'COSTURA-VISTA-APB' })))).toEqual([]);
    expect(frenos(gate7ControlFinal(fila({}))).map((x) => x.mensaje)).toEqual([expect.stringMatching(/sin referencia a una caracteristica marcada apariencia o funcion/)]);
    expect(frenos(gate7ControlFinal(fila({ characteristicRef: 'COSTURA-UNION-APB', specification: '4 en 16 mm (±1)' }))).map((x) => x.mensaje)).toEqual([expect.stringMatching(/marca OCULTA/)]);
    expect(frenos(gate7ControlFinal(fila({ characteristicRef: 'NO-EXISTE' }))).map((x) => x.mensaje)).toEqual([expect.stringMatching(/no esta declarada con una fuente leida/)]);
  });
  it('no aprueba en vacio: sin caracteristicas declaradas avisa que no hay contra que aceptar; una declarada sin fuente leida frena y no se usa', () => {
    const sin = armar({ mutar: (e) => { e.caracteristicasDeclaradas.lista = []; } });
    const g = gate7ControlFinal(sin, { planExistente: PC });
    expect(g.some((x) => /ninguna caracteristica esta marcada apariencia o funcion/.test(x.mensaje))).toBe(true);
    expect(frenos(g)).toEqual([]);   // sin la declaracion, el «4 en 16» no se puede marcar: solo se lista
    expect(g.filter((x) => /falta marcarla/.test(x.mensaje)).length).toBe(8);
    const sinFuente = armar({ mutar: (e) => { e.caracteristicasDeclaradas.lista[0].fuente.sourceId = 'PLANO-NO-LEIDO'; } });
    expect(frenos(gate7ControlFinal(sinFuente, { planExistente: PC })).map((x) => x.mensaje)).toEqual([expect.stringMatching(/cita PLANO-NO-LEIDO.*no se usa/)]);
  });
});

describe('gate 8: AMFE <-> plan en tres capas', () => {
  const cruce = cruceAmfePlan(CON);
  const par = (pref) => cruce.pares.find((p) => p.causeId.startsWith(pref));
  it('hoy (sin vinculos): las 171 causas estan SIN FILA, las 75 filas SIN CAUSA (12 recepcion, 2 requisito de cliente, 61 proceso), y lo demas es NO EVALUADO: frena, no es verde', () => {
    const c = cruceAmfePlan(VIVO);
    expect(c.pares).toEqual([]);
    expect(c.sinFila.length).toBe(171);
    expect(c.sinCausa.length).toBe(VIVO.items.length);
    const grupos = (g) => c.sinCausa.filter((x) => x.grupo === g).length;
    expect([grupos('recepcion'), grupos('requisito de cliente'), grupos('proceso')]).toEqual([12, 2, VIVO.items.length - 14]);
    const g8 = gate8AmfeVsPlan(VIVO);
    expect(frenos(g8).map((x) => x.mensaje)).toEqual([expect.stringMatching(/^NO EVALUADO.*no se emite como plan/)]);
    expect(g8.filter((x) => /^SIN FILA/.test(x.mensaje)).length).toBe(20);   // una linea por operacion del AMFE
    expect(g8.filter((x) => /^SIN CAUSA/.test(x.mensaje)).map((x) => x.mensaje.match(/\((.*?)\)/)[1])).toEqual(['recepcion', 'requisito de cliente', 'proceso']);
  });
  it('con la tabla de EJEMPLO sale cada estado, con el texto de los dos lados al lado', () => {
    expect(ESTADOS).toEqual(['OK', 'GENERICO', 'DIFERENTE', 'FILA SIN METODO', 'SIN FILA', 'SIN CAUSA']);
    const n = (e) => cruce.pares.filter((p) => p.estado === e).length;
    expect([n('OK'), n('GENERICO'), n('DIFERENTE'), n('FILA SIN METODO')]).toEqual([1, 3, 2, 2]);
    expect(cruce.sinFila.length).toBe(164);   // 171 - 7 vinculadas por deteccion (la de prevencion sigue sin fila)
    expect(cruce.sinCausa.length).toBe(CON.items.length - 8);
    expect(par('8649d6b1')).toMatchObject({ estado: 'OK', textoAmfe: 'Pesaje en balanza calibrada', instrumentoAmfe: 'BALANZA', instrumentoPlan: 'BALANZA', frena: false });
    // «verificacion visual del estado del mylar» mira AL mylar, no CON el mylar: no es un instrumento
    expect(par('15bf3bde')).toMatchObject({ estado: 'GENERICO', textoAmfe: expect.stringMatching(/estado del mylar/) });
    expect(par('53c9310d')).toMatchObject({ estado: 'GENERICO', frena: false, textoAmfe: 'Inspección visual', detalle: expect.stringMatching(/re-evaluar la D \(hoy 8\)/) });
    expect(par('81fbc92b')).toMatchObject({ estado: 'FILA SIN METODO', frena: false, instrumentoAmfe: 'CALIBRE', detalle: expect.stringMatching(/no tiene instrumento con papel \(TBD\)/) });
  });
  it('DIFERENTE frena: «calibre» no es «contra calibre», y una critica (S9) con «verificacion de certificado» sube de GENERICO a DIFERENTE', () => {
    expect(par('13634826')).toMatchObject({ estado: 'DIFERENTE', frena: true, opCausa: '50', opFila: '51', aguasAbajo: true, detalle: 'instrumento distinto: el AMFE dice CALIBRE y el plan CALIBRE_DE_CONTROL' });
    expect(par('34327bf9')).toMatchObject({ estado: 'DIFERENTE', frena: true, S: 9, sigla: 'D/TLD', detalle: expect.stringMatching(/una critica no puede quedar con un control que no se identifica/) });
    expect(frenos(gate8AmfeVsPlan(CON)).map((x) => x.mensaje.slice(0, 9))).toEqual(['DIFERENTE', 'DIFERENTE']);
    // el mismo modo de falla con S7 es GENERICO y no frena
    const s7 = cruceAmfePlan(armar({ vinculos: VINCULOS.causaAFila, doc: amfeConFalla('34327bf9', { severity: 7 }) })).pares.find((p) => p.causeId.startsWith('34327bf9'));
    expect(s7).toMatchObject({ estado: 'GENERICO', frena: false });
  });
  it('el vinculo cruza operaciones (una causa de la 41 detectada en el control final 100) y la capa 3 no decide', () => {
    expect(par('0a2c5bf9')).toMatchObject({ estado: 'GENERICO', opCausa: '41', opFila: '100', aguasAbajo: true });
    expect(gate8AmfeVsPlan(CON).some((x) => /detectada aguas abajo en la 100/.test(x.mensaje))).toBe(true);
    // el mismo texto en los dos lados no alcanza: «Visual» contra «Visual» sigue siendo GENERICO
    const v = [{ causeId: id(VIVO, '0a2c5bf9'), itemKey: 'ho:HO-971/51/I23' }];
    const igual = cruceAmfePlan(armar({ vinculos: v })).pares[0];
    expect([igual.textoAmfe, igual.textoPlan.split(' · ')[0], igual.estado]).toEqual(['Visual', 'Visual', 'GENERICO']);
  });
  it('set up se compara contra la PREVENCION, y una causa vinculada solo por prevencion sigue SIN FILA para su deteccion', () => {
    expect(par('2290f05f')).toMatchObject({ control: 'prevencion', estado: 'FILA SIN METODO', instrumentoAmfe: 'MANOMETRO', textoAmfe: expect.stringMatching(/manometro en el set up/) });
    const sf = cruce.sinFila.find((c) => c.causeId.startsWith('2290f05f'));
    expect(sf.detalle).toMatch(/solo esta vinculada por su control de prevencion/);
    // por defecto: fila de set up -> prevencion; las demas -> deteccion
    const v = [{ causeId: id(VIVO, '2290f05f'), itemKey: 'setup:93' }, { causeId: id(VIVO, '53c9310d'), itemKey: 'ho:HO-971/41/I27' }];
    expect(cruceAmfePlan(armar({ vinculos: v })).pares.map((p) => p.control)).toEqual(['deteccion', 'prevencion']);
  });
  it('gemelos de la capa 2: frecuencia distinta, frecuencia del plan que no se reconoce, y un control con dos instrumentos contra una fila con uno', () => {
    const k21 = 'setup:HO-971/21.2/I37';   // «CON CALIBRE MC167», «Antes de cada corte»
    const con = (det) => cruceAmfePlan(armar({ vinculos: [{ causeId: id(VIVO, '81fbc92b'), itemKey: k21, control: 'deteccion' }], doc: amfeCon('81fbc92b', { detectionControl: det }) })).pares[0];
    expect(con('Calibre antes de cada corte')).toMatchObject({ estado: 'OK', detalle: expect.stringMatching(/misma frecuencia \(ANTES_DE_CADA_CORTE\)/) });
    expect(con('Calibre antes de cada corte, 100%')).toMatchObject({ estado: 'DIFERENTE' });   // dos frecuencias en el AMFE: tienen que estar las dos
    expect(con('MC167')).toMatchObject({ estado: 'OK' });
    // el comodin de la HO («Calibre / Instrumento») no identifica nada: no puede dar OK
    const comodin = cruceAmfePlan(armar({ vinculos: [{ causeId: id(VIVO, '13634826'), itemKey: 'ho:HO-971/50/I36' }] })).pares[0];
    expect(comodin).toMatchObject({ textoAmfe: 'Control con calibre por muestreo', estado: 'FILA SIN METODO', detalle: expect.stringMatching(/"Calibre \/ Instrumento"/) });
    expect(con('Calibre MC167')).toMatchObject({ estado: 'OK' });
    expect(con('Calibre 100%')).toMatchObject({ estado: 'DIFERENTE', detalle: 'frecuencia distinta: el AMFE dice 100% y el plan ANTES_DE_CADA_CORTE' });
    expect(con('Calibre MC413')).toMatchObject({ estado: 'DIFERENTE', detalle: expect.stringMatching(/MC413.*MC167/) });
    expect(con('Calibre y balanza')).toMatchObject({ estado: 'DIFERENTE', detalle: expect.stringMatching(/BALANZA \+ CALIBRE.*MC167 \+ CALIBRE/) });
    // la fila Balanza de la 51 tiene una frecuencia que el canon no reconoce: si el AMFE trae frecuencia, no es OK
    const k51 = 'setup:HO-971/51/I25';
    const b = cruceAmfePlan(armar({ vinculos: [{ causeId: id(VIVO, '8649d6b1'), itemKey: k51, control: 'deteccion' }], doc: amfeCon('8649d6b1', { detectionControl: 'Pesaje en balanza por lote' }) })).pares[0];
    expect(b).toMatchObject({ estado: 'DIFERENTE', detalle: expect.stringMatching(/no se reconoce o no tiene papel/) });
  });
  it('un vinculo que apunta a una causa o a una fila que no existe frena; sin AMFE el gate no aprueba en vacio', () => {
    const malo = armar({ vinculos: [{ causeId: 'no-existe', itemKey: 'setup:93' }, { causeId: id(VIVO, '53c9310d'), itemKey: 'fila-que-no-esta' }] });
    expect(malo.vinculosInvalidos.map((v) => v.motivo)).toEqual(['la causa no esta en el AMFE leido', 'la fila no existe en el plan']);
    expect(frenos(gate8AmfeVsPlan(malo)).map((x) => x.mensaje.slice(0, 16))).toEqual(['vinculo invalido', 'vinculo invalido', 'NO EVALUADO: nin']);
    const tipeo = armar({ vinculos: [{ causeId: id(VIVO, '2290f05f'), itemKey: 'setup:93', control: 'detección' }, { causeId: id(VIVO, '53c9310d'), itemKey: 'ho:HO-971/41/I27' }, { causeId: id(VIVO, '53c9310d'), itemKey: 'ho:HO-971/41/I27', control: 'prevencion' }] });
    expect(tipeo.vinculosInvalidos.map((v) => v.motivo)).toEqual(['control "detección" no es "prevencion" ni "deteccion"', 'el par causa-fila esta repetido']);
    const sinAmfe = armar({ amfe: null });
    expect(gate8AmfeVsPlan(sinAmfe)).toEqual([expect.objectContaining({ nivel: FRENO, mensaje: expect.stringMatching(/sin AMFE/) })]);
    // un AMFE que se leyo con 0 causas (archivo con otra forma) tampoco aprueba
    const vacio = armar({ doc: { header: AMFE_DOC.header, operations: [] } });
    expect(gate8AmfeVsPlan(vacio)).toEqual([expect.objectContaining({ nivel: FRENO, mensaje: expect.stringMatching(/SIN causas \(0\)/) })]);
  });
});

describe('los seis chequeos del §7.6, con el criterio de la casa (critica = S 9-10)', () => {
  const comparacion = compararConPlanExistente(VIVO, PC);
  const vivo = casosCruce(VIVO, { comparacion });
  const con = casosCruce(CON, { comparacion });
  const de = (r, caso) => r.hallazgos.filter((x) => x.gate === caso);
  it('UNMATCHED_PROCESS_STEP: el AMFE «90-92» cubre 90, 91 y 92; contra el plan de Calidad faltan 21, 22, 51, 60, 71, 81, 82 y 101; una operacion inventada se marca', () => {
    expect(vivo.unmatched).toEqual({ flujogramaSinAmfe: [], amfeSinFlujograma: [], flujogramaSinPlan: [], flujogramaSinPlanExistente: ['21', '22', '51', '60', '71', '81', '82', '101'] });
    const doc = clonar(AMFE_DOC);
    doc.operations = doc.operations.filter((o) => o.operationNumber !== '60');
    doc.operations.push({ id: 'x', operationNumber: '95', operationName: 'OPERACION QUE EL FLUJOGRAMA NO TIENE', workElements: [] });
    const rojo = casosCruce(armar({ doc }));
    expect([rojo.unmatched.flujogramaSinAmfe, rojo.unmatched.amfeSinFlujograma]).toEqual([['60'], ['95']]);
    const sinFila = clonar(VIVO);
    sinFila.items = sinFila.items.filter((i) => i.processStepNumber !== '30');
    expect(frenos(de(casosCruce(sinFila), 'UNMATCHED_PROCESS_STEP')).map((x) => x.mensaje)).toEqual(['flujogramaSinPlan: 30']);
  });
  it('MISSING_CONTROL: lista las filas con el instrumento o el registro en TBD; incluye la 70 y la 80 (y bastante mas: 40, 41, 100...)', () => {
    const ops = [...new Set(vivo.missingControl.map((x) => x.op))];
    for (const op of ['70', '80', '40', '41', '100']) expect(ops).toContain(op);
    expect(vivo.missingControl.length).toBe(VIVO.items.filter((i) => i.evaluationTechnique === TBD || i.controlMethod === TBD).length);
    expect(vivo.missingControl.length).toBeGreaterThan(40);
    expect(ops).not.toContain('51');   // la 51 tiene instrumento y registro en todas sus filas
    expect(de(vivo, 'MISSING_CONTROL').every((x) => x.nivel === AVISO)).toBe(true);
    // gemelo: una fila de la 51 que pierde su instrumento (TBD o CONFLICTO) entra a la lista
    for (const valor of [TBD, CONFLICTO]) {
      const rojo = clonar(VIVO);
      rojo.items.find((i) => i.key === 'setup:HO-971/51/I25').evaluationTechnique = valor;
      const r = casosCruce(rojo);
      expect(r.missingControl.length).toBe(vivo.missingControl.length + 1);
      expect(r.missingControl.map((x) => x.op)).toContain('51');
    }
  });
  it('SPECIAL_CHARACTERISTIC_NOT_CONTROLLED: hoy la columna esta vacia frente a las 50 siglas del AMFE 161 y eso frena la emision; con vinculos bajan a 45; una fila con SC de OTRA causa no cubre a esta', () => {
    expect(vivo.specialNotControlled.length).toBe(50);
    expect(frenos(de(vivo, 'SPECIAL_CHARACTERISTIC_NOT_CONTROLLED')).map((x) => x.mensaje)).toEqual([expect.stringMatching(/^50 de las 50 causas con sigla/)]);
    expect(con.specialNotControlled.length).toBe(45);
    const rojo = clonar(CON);
    Object.assign(rojo.items.find((i) => i.key === 'ho:HO-971/41/I27'), { classification: [], specialCharClass: '' });
    const r = casosCruce(rojo);
    expect(r.specialNotControlled.filter((x) => x.vinculada).map((x) => x.causeId.slice(0, 8))).toEqual(['53c9310d']);
    expect(frenos(de(r, 'SPECIAL_CHARACTERISTIC_NOT_CONTROLLED')).some((x) => /su fila vinculada no la lleva/.test(x.mensaje))).toBe(true);
    const sinSiglas = casosCruce(armar({ doc: (() => { const d = clonar(AMFE_DOC); for (const op of d.operations) for (const we of op.workElements) for (const fn of we.functions) for (const f of fn.failures) for (const c of f.causes) c.specialChar = ''; return d; })() }));
    expect(de(sinSiglas, 'SPECIAL_CHARACTERISTIC_NOT_CONTROLLED')).toEqual([]);
  });
  it('MISSING_REACTION_PLAN: lista las filas sin plan de reaccion; frena solo sobre una causa critica vinculada', () => {
    expect(vivo.missingReaction.length).toBe(VIVO.items.filter((i) => i.reactionPlan === TBD).length);
    expect(vivo.missingReaction.length).toBeGreaterThan(0);
    expect(frenos(de(vivo, 'MISSING_REACTION_PLAN'))).toEqual([]);
    const rojo = clonar(CON);
    rojo.items.find((i) => i.key === 'bom:VIN-SKM-001').reactionPlan = TBD;
    expect(frenos(de(casosCruce(rojo), 'MISSING_REACTION_PLAN')).map((x) => x.mensaje)).toEqual([expect.stringMatching(/causa critica \(S 9-10\) sin plan de reaccion/)]);
    const sinCampo = clonar(CON);
    delete sinCampo.items.find((i) => i.key === 'bom:VIN-SKM-001').reactionPlan;
    expect(frenos(de(casosCruce(sinCampo), 'MISSING_REACTION_PLAN')).length).toBe(1);
  });
  it('WEAK_DETECTION_METHOD: 150 de las 171 causas tienen un control de deteccion sin instrumento del canon (medido); con una regla deja de contarse', () => {
    expect(vivo.weak.length).toBe(150);
    expect(de(vivo, 'WEAK_DETECTION_METHOD').map((x) => x.mensaje)).toEqual([expect.stringMatching(/^150 de 171 causas/)]);
    expect(casosCruce(armar({ doc: amfeCon('53c9310d', { detectionControl: 'Regla, 1 pieza por lote' }) })).weak.length).toBe(149);
  });
  it('HIGH_SEVERITY_WEAK_CONTROL: las 3 D/TLD de flamabilidad detectan con «verificacion de certificado»: aviso sin vincular, freno vinculada; con S8 no entra', () => {
    expect(vivo.highWeak.map((w) => [w.op, w.S])).toEqual([['10', 9], ['10', 9], ['10', 9]]);
    expect(de(vivo, 'HIGH_SEVERITY_WEAK_CONTROL').map((x) => x.nivel)).toEqual([AVISO, AVISO, AVISO]);
    expect(de(con, 'HIGH_SEVERITY_WEAK_CONTROL').map((x) => x.nivel).sort()).toEqual([AVISO, AVISO, FRENO]);
    const s8 = casosCruce(armar({ doc: amfeConFalla('34327bf9', { severity: 8 }) }));
    expect(s8.highWeak.some((w) => w.causeId.startsWith('34327bf9'))).toBe(false);
    expect(s8.highWeak.length).toBeLessThan(3);
  });
});

describe('todo junto', () => {
  it('correrEtapa2 sobre el APB de hoy: frena por el control final de Calidad, por las siglas sin documentar y porque el gate 8 no se pudo evaluar; el reporte lo dice', () => {
    const comparacion = compararConPlanExistente(VIVO, PC);
    const e2 = correrEtapa2(VIVO, { planExistente: PC, comparacion });
    expect(frenos(e2.hallazgos).map((x) => x.gate).sort()).toEqual(['SPECIAL_CHARACTERISTIC_NOT_CONTROLLED', 'gate7', 'gate8']);
    expect(reporteEtapa2(VIVO, e2, { conHallazgos: false })).not.toContain('## Hallazgos de la etapa 2');
    const md = reporteEtapa2(VIVO, e2);
    for (const t of ['NO EVALUADO', 'SIN FILA (171)', 'SIN CAUSA (75)', 'propuesta_siglas.md', 'flujograma sin fila en el plan de Calidad: 21, 22, 51, 60, 71, 81, 82, 101', 'marca OCULTA']) expect(md).toContain(t);
    const e2con = correrEtapa2(CON, { planExistente: PC, comparacion });
    expect(reporteEtapa2(CON, e2con)).toContain('OK 1 · GENERICO 3 · DIFERENTE 2 · FILA SIN METODO 2 · SIN FILA 164');
  });
});

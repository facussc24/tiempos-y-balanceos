/**
 * fichaPieza — el chequeo de coherencia entre los documentos VIGENTES de una pieza, en las dos
 * direcciones (plan docs/PLAN_FICHA_CONFIGURACION_PIEZA_2026-10-17.md, tanda 13 item 1).
 *
 * Estos casos son puros (fichas armadas en el test con los valores que dicen los papeles reales):
 * corren en el CI de GitHub, donde no estan la nube ni antiword. Los mismos casos contra los
 * archivos reales, en fichaPiezaCasosReales.test.mjs.
 *
 * Cada ROJO es un caso que paso de verdad (memorias project_ppap_novax_tapizadas_puerta,
 * project_boms_patagonia_procesos, project_espuma_ippad_vs_insert, project_beon_revisiones_patagonia);
 * cada VERDE es el documento sano: si el chequeo lo marcara, terminaria apagado.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizar, compararAtributos, compararCliente, queTocaUnCambio, registrarDocumento,
  documentoDeNombre, resumenComparacion,
} from '../../scripts/_lib/fichaPieza.mjs';

const doc = (id, extra = {}) => ({ id, tipo: id.split(':')[0], numero: id.split(':')[1], letra: 'A', ...extra });
const at = (atributo, documento, texto, extra = {}) => ({ atributo, documento, texto, fuente: `prueba ${documento}`, ...extra });

describe('normalizar', () => {
  it('adhesivo: el codigo del arb y el nombre comercial caen en la misma marca', () => {
    expect(normalizar('adhesivo', 'ADHESIVO FA X 18 L. (AD - ADFA15)').valor).toBe('Fenoclor FA');
    expect(normalizar('adhesivo', 'Adhesivo base solvente Fenoclor (codigo AD - ADFA15)').valor).toBe('Fenoclor FA');
    expect(normalizar('adhesivo', 'adhesivo termofusible (SikaMelt) en la unidad fusora').valor).toBe('SikaMelt');
  });
  it('adhesivo que no esta en el canon: no se adivina', () => {
    expect(normalizar('adhesivo', 'Pegamento X').valor).toBeNull();
  });
  it('densidad en kg/m3', () => {
    expect(normalizar('espuma.densidad', 'Espuma de PU densidad 35Kg/m3 +/-5Kg/m3').valor).toBe(35);
    expect(normalizar('espuma.densidad', 'ESPUMA DE PU DENSIDAD 35KG/M3').valor).toBe(35);
    expect(normalizar('espuma.densidad', 'Espuma de PU densidad 45Kg/m3').valor).toBe(45);
  });
  it('ancho en mm, venga en mm, cm o m', () => {
    expect(normalizar('espuma.ancho_rollo', '1400 de ancho por rollo.').valor).toBe(1400);
    expect(normalizar('espuma.ancho_rollo', '1400mm de ancho por rollo minimo').valor).toBe(1400);
    expect(normalizar('espuma.ancho_tizada', '<WIDTH>115.0000</WIDTH>', { unidad: 'cm' }).valor).toBe(1150);
    expect(normalizar('espuma.ancho_rollo', '1,5 m').valor).toBe(1500);
    expect(normalizar('espuma.ancho_rollo', 'ancho rollo 1,4', { unidad: 'm' }).valor).toBe(1400);
  });
  it('puntada: «6 puntadas en 25 mm» y «6 ±0,5 en 25 mm» son lo mismo', () => {
    expect(normalizar('costura.vista.puntada', '6 puntadas en 25 mm (±0,5)').valor).toBe('6 en 25');
    expect(normalizar('costura.vista.puntada', '6 ±0,5 en 25 mm; a 4 ±0,5 mm').valor).toBe('6 en 25');
    expect(normalizar('costura.vista.puntada', 'Toma 4 mm (±1) / Puntadas 6 en 25').valor).toBe('6 en 25');
    expect(normalizar('costura.vista.puntada', '4 en 16 mm ±1').valor).toBe('4 en 16');
  });
  it('letra de revision citada', () => {
    expect(normalizar('cita.flujograma', 'Flujograma Base | 154 Rev. B (08/09/2026)').valor).toBe('B');
  });
});

describe('compararAtributos: caso 1, el adhesivo del Insert', () => {
  const ficha = {
    documentos: [doc('ho:990'), doc('bom:insert'), doc('amfe:158')],
    atributos: [
      at('adhesivo', 'ho:990', 'Verificar la temperatura del adhesivo termofusible (SikaMelt) (140°C - 160°C)'),
      at('adhesivo', 'bom:insert', 'ADHESIVO FA X 18 L. (AD - ADFA15)'),
      at('adhesivo', 'amfe:158', 'Adhesivo base solvente Fenoclor (codigo AD - ADFA15)'),
    ],
  };
  it('HO SikaMelt contra BOM y AMFE Fenoclor da ROJO y nombra quien dice que', () => {
    const r = compararAtributos(ficha).find((x) => x.atributo === 'adhesivo');
    expect(r.estado).toBe('rojo');
    expect(r.valores.find((v) => v.documento === 'ho:990').valor).toBe('SikaMelt');
    expect(r.valores.filter((v) => v.valor === 'Fenoclor FA').map((v) => v.documento).sort()).toEqual(['amfe:158', 'bom:insert']);
  });
  it('gemelo: si la HO dijera Fenoclor, da VERDE', () => {
    const sana = structuredClone(ficha);
    sana.atributos[0].texto = 'Aplicar adhesivo Fenoclor FA';
    expect(compararAtributos(sana).find((x) => x.atributo === 'adhesivo').estado).toBe('verde');
  });
  it('un documento que NO es vigente no entra en la comparacion (el error del 14/10)', () => {
    const conViejo = structuredClone(ficha);
    conViejo.documentos[0].vigente = false;
    const r = compararAtributos(conViejo).find((x) => x.atributo === 'adhesivo');
    expect(r.estado).toBe('verde');
    expect(r.fueraDeComparacion.map((v) => v.documento)).toEqual(['ho:990']);
  });
});

describe('compararAtributos: caso 2, el ancho del rollo de ESPUMA (no se mezcla con el vinilo)', () => {
  const ficha = {
    documentos: [doc('ft:141'), doc('ft:copia-legajo'), doc('tizada:26-1-26'), doc('bom:insert')],
    atributos: [
      at('espuma.ancho_rollo', 'ft:141', '1400 de ancho por rollo.'),
      at('espuma.ancho_rollo', 'ft:copia-legajo', '1200 de ancho por rollo.'),
      at('espuma.ancho_tizada', 'tizada:26-1-26', '<WIDTH>115.0000</WIDTH>', { unidad: 'cm', rol: 'tope', de: 'espuma.ancho_rollo' }),
      at('vinilo.ancho_rollo', 'bom:insert', 'SANLEATHER IV CL74 S782 1,1X1400 ESP3,00'),
    ],
  };
  it('FT141 1400 contra la copia del legajo 1200 da ROJO', () => {
    const r = compararAtributos(ficha).find((x) => x.atributo === 'espuma.ancho_rollo');
    expect(r.estado).toBe('rojo');
    expect(r.valores.map((v) => v.valor).sort()).toEqual([1200, 1400]);
  });
  it('el vinilo es otro material: no entra en el atributo de la espuma', () => {
    const r = compararAtributos(ficha).find((x) => x.atributo === 'espuma.ancho_rollo');
    expect(r.valores.some((v) => v.documento === 'bom:insert')).toBe(false);
  });
  it('una tizada mas ancha que el rollo declarado es ROJO; una mas angosta, no', () => {
    const ancha = { documentos: [doc('ft:141'), doc('tizada:x')], atributos: [
      at('espuma.ancho_rollo', 'ft:141', '1200 de ancho por rollo.'),
      at('espuma.ancho_tizada', 'tizada:x', '<WIDTH>135.0000</WIDTH>', { unidad: 'cm', rol: 'tope', de: 'espuma.ancho_rollo' }),
    ] };
    expect(compararAtributos(ancha).find((x) => x.atributo === 'espuma.ancho_tizada').estado).toBe('rojo');
    ancha.atributos[1].texto = '<WIDTH>115.0000</WIDTH>';
    expect(compararAtributos(ancha).find((x) => x.atributo === 'espuma.ancho_tizada').estado).toBe('verde');
  });
  it('gemelo: dos fichas tecnicas que dicen 1400 dan VERDE', () => {
    const sana = structuredClone(ficha);
    sana.atributos[1].texto = '1400 de ancho por rollo.';
    expect(compararAtributos(sana).find((x) => x.atributo === 'espuma.ancho_rollo').estado).toBe('verde');
  });
  it('una referencia (un pedido por mail) se muestra pero no decide', () => {
    const conRef = structuredClone(ficha);
    conRef.atributos[1].texto = '1400 de ancho por rollo.';
    conRef.atributos.push(at('espuma.ancho_rollo', 'mail:marcelo', '1,5 m', { rol: 'referencia' }));
    const r = compararAtributos(conRef).find((x) => x.atributo === 'espuma.ancho_rollo');
    expect(r.estado).toBe('verde');
    expect(r.referencias.map((v) => v.valor)).toEqual([1500]);
  });
});

describe('compararAtributos: caso 3, la densidad de la MISMA espuma en dos piezas', () => {
  const ficha = {
    documentos: [doc('ft:141'), doc('bom:insert'), doc('ft:149', { pieza: 'ip-pad', porMaterial: '427ESP001TRO01' })],
    atributos: [
      at('espuma.densidad', 'ft:141', 'Espuma de PU densidad 35Kg/m3 +/-5Kg/m3'),
      at('espuma.densidad', 'bom:insert', 'ESPUMA DE PU DENSIDAD 35KG/M3'),
      at('espuma.densidad', 'ft:149', 'Espuma de PU densidad 45Kg/m3'),
    ],
  };
  it('FT141 35 contra FT149 45 sobre el mismo codigo de espuma da ROJO y dice que es por material compartido', () => {
    const r = compararAtributos(ficha).find((x) => x.atributo === 'espuma.densidad');
    expect(r.estado).toBe('rojo');
    const de149 = r.valores.find((v) => v.documento === 'ft:149');
    expect(de149.valor).toBe(45);
    expect(de149.otraPieza).toBe('ip-pad');
    expect(r.detalle).toMatch(/427ESP001TRO01/);
  });
  it('gemelo: sin la ficha de la otra pieza, los documentos del Insert cierran', () => {
    const solo = structuredClone(ficha);
    solo.atributos.pop();
    expect(compararAtributos(solo).find((x) => x.atributo === 'espuma.densidad').estado).toBe('verde');
  });
});

describe('compararAtributos: las operaciones', () => {
  const base = () => ({
    documentos: [doc('flujograma:154'), doc('amfe:158')],
    atributos: [
      at('operaciones', 'flujograma:154', '10 20 21 22 50 60 70 71 80 90', { lista: ['10', '20', '21', '22', '50', '60', '70', '71', '80', '90'] }),
      at('operaciones', 'amfe:158', '10 20 21 22 50 60 70-71 80 90', { lista: ['10', '20', '21', '22', '50', '60', '70', '71', '80', '90'] }),
    ],
  });
  it('mismas operaciones (el AMFE agrupa 70-71): VERDE', () => {
    expect(compararAtributos(base()).find((x) => x.atributo === 'operaciones').estado).toBe('verde');
  });
  it('una operacion que el AMFE no tiene: ROJO, y dice cual falta en cual', () => {
    const f = base();
    f.atributos[1].lista = f.atributos[1].lista.filter((n) => n !== '80');
    const r = compararAtributos(f).find((x) => x.atributo === 'operaciones');
    expect(r.estado).toBe('rojo');
    expect(r.detalle).toMatch(/80/);
    expect(r.detalle).toMatch(/amfe:158/);
  });
});

describe('excepciones escritas de la casa (plan §3: se escriben con su fuente, no se esconden)', () => {
  const ficha = () => ({
    documentos: [doc('flujograma:154'), doc('amfe:158')],
    atributos: [
      at('operaciones', 'flujograma:154', '', { lista: ['10', '110', '111', '120'] }),
      at('operaciones', 'amfe:158', '', { lista: ['10', '110', '120'] }),
    ],
    excepciones: [{ atributo: 'operaciones', documento: 'amfe:158', noLleva: ['111'], fuente: 'numeracionPatagonia.data.json: la 111 no lleva AMFE propio (amfe.md §9)' }],
  });
  it('la 111 que el AMFE no lleva por convencion no da rojo, y el detalle lo dice con la fuente', () => {
    const r = compararAtributos(ficha()).find((x) => x.atributo === 'operaciones');
    expect(r.estado).toBe('verde');
    expect(r.detalle).toMatch(/111.*amfe\.md §9/);
  });
  it('gemelo: otra operacion que falta sigue dando rojo', () => {
    const f = ficha();
    f.atributos[1].lista = ['10', '120'];
    const r = compararAtributos(f).find((x) => x.atributo === 'operaciones');
    expect(r.estado).toBe('rojo');
    expect(r.detalle).toMatch(/amfe:158 no tiene 110/);
    expect(r.detalle).not.toMatch(/no tiene 110, 111/);
  });
  it('una tizada de vigencia a confirmar que se pasa del rollo: el rojo lo avisa', () => {
    const f = { documentos: [doc('ft:141'), doc('tizada:x', { vigente: 'a confirmar' })], atributos: [
      at('espuma.ancho_rollo', 'ft:141', '1200 de ancho por rollo.'),
      at('espuma.ancho_tizada', 'tizada:x', '<WIDTH>135.0000</WIDTH>', { unidad: 'cm', rol: 'tope', de: 'espuma.ancho_rollo' }),
    ] };
    expect(compararAtributos(f).find((x) => x.atributo === 'espuma.ancho_tizada').detalle).toMatch(/vigencia a confirmar: tizada:x/);
  });
});

describe('compararAtributos: la costura del APB de puerta (la otra direccion: tiene que dar VERDE)', () => {
  const ficha = {
    // La especificacion de agosto de 2025 decia 4 en 16 y ya no es la vigente (memoria
    // reference_valores_costura_patagonia_confirmados): sin el paso (a) daria un rojo falso.
    documentos: [doc('ho:971'), doc('costura:valores-14-10'), doc('costura:especificacion-2025-08-28', { vigente: false })],
    atributos: [
      at('costura.vista.puntada', 'ho:971', 'Toma 4 mm (±1) / Puntadas 6 en 25'),
      at('costura.vista.puntada', 'costura:valores-14-10', '6 ±0,5 en 25 mm; a 4 ±0,5 mm'),
      at('costura.vista.puntada', 'costura:especificacion-2025-08-28', '4 en 16 mm'),
    ],
  };
  it('HO 971 6 en 25 y los valores vigentes del 14/10 6 en 25: VERDE (la especificacion vieja queda afuera)', () => {
    const r = compararAtributos(ficha).find((x) => x.atributo === 'costura.vista.puntada');
    expect(r.estado).toBe('verde');
    expect(r.fueraDeComparacion.map((v) => v.documento)).toEqual(['costura:especificacion-2025-08-28']);
  });
  it('gemelo: si la HO dijera 4 en 16, ROJO', () => {
    const mal = structuredClone(ficha);
    mal.atributos[0].texto = 'Puntadas 4 en 16';
    expect(compararAtributos(mal).find((x) => x.atributo === 'costura.vista.puntada').estado).toBe('rojo');
  });
});

describe('la letra que CITA un documento contra la vigente del citado', () => {
  const ficha = () => ({
    documentos: [doc('flujograma:154', { letra: 'D' }), doc('ho:990')],
    atributos: [at('cita.flujograma', 'ho:990', 'Flujograma Base | 154 Rev. B (08/09/2026)', { cita: 'flujograma:154' })],
  });
  it('la HO-990 dice «154 Rev. B» y el flujograma vigente es la D: ROJO', () => {
    const r = compararAtributos(ficha()).find((x) => x.atributo === 'cita.flujograma');
    expect(r.estado).toBe('rojo');
    expect(r.detalle).toMatch(/ho:990 dice B/);
    expect(r.detalle).toMatch(/flujograma:154 dice D/);
  });
  it('gemelo: si citara la D, VERDE', () => {
    const f = ficha();
    f.atributos[0].texto = 'Flujograma Base | 154 Rev. D (06/10/2026)';
    expect(compararAtributos(f).find((x) => x.atributo === 'cita.flujograma').estado).toBe('verde');
  });
});

describe('rol «menciona»: nombra el material sin dar un valor', () => {
  const ficha = {
    documentos: [doc('amfe:158'), doc('ho:990')],
    atributos: [
      at('espuma', 'amfe:158', 'OP 10: Espuma de poliuretano del panel decorativo (codigo 427-ESP-001-TRO-01)', { rol: 'menciona' }),
      at('espuma', 'ho:990', 'espuma de poliuretano (PUR) con el espesor y densidad especificados', { rol: 'menciona' }),
    ],
  };
  it('no se compara (dos textos distintos no son un rojo)', () => {
    expect(compararAtributos(ficha).find((x) => x.atributo === 'espuma')).toBeUndefined();
  });
  it('si entra en «que toca un cambio», tambien por el codigo escrito con guiones', () => {
    expect(queTocaUnCambio(ficha, { atributo: 'espuma' }).documentos.map((d) => d.id).sort()).toEqual(['amfe:158', 'ho:990']);
    expect(queTocaUnCambio(ficha, { codigo: '427ESP001TRO01' }).documentos.map((d) => d.id)).toEqual(['amfe:158']);
  });
});

describe('hilos: el conjunto de codigos de cada documento', () => {
  it('BOM y AMFE con los mismos cuatro hilos: VERDE aunque esten en otro orden', () => {
    const f = { documentos: [doc('bom:arb'), doc('amfe:158')], atributos: [
      at('hilo', 'bom:arb', 'FX284-E0PTO Hilo union + FX483TK-E0PTO HILO JET BLACK + FX483TK-11930E ALPE + FX483TK-11703E GRAY'),
      at('hilo', 'amfe:158', 'Hilo vista (Jet Black FX483TK-E0PTO, Alpe Gray FX483TK-11930E, Gray Violet FX483TK-11703E) + Hilo de union (codigo FX284-E0PTO)'),
    ] };
    expect(compararAtributos(f).find((x) => x.atributo === 'hilo').estado).toBe('verde');
    f.atributos[1].texto = 'Hilo de union (codigo FX284-E0PTO)';
    expect(compararAtributos(f).find((x) => x.atributo === 'hilo').estado).toBe('rojo');
  });
});

describe('materiales: los codigos que nombra el AMFE tienen que estar en la BOM del arb', () => {
  const ficha = () => ({
    documentos: [doc('bom:arb'), doc('amfe:158')],
    atributos: [
      at('materiales.codigos', 'bom:arb', '52110 427ESP001TRO01 AD - ADFA15 1246030223 ET-SATO-100X60', { rol: 'universo', lista: ['52110', '427ESP001TRO01', 'AD - ADFA15', '1246030223', 'ET-SATO-100X60'] }),
      at('materiales.codigos', 'amfe:158', 'Film adhesivo Tesa 52110 (codigo 52110-00000-00) + Espuma (codigo 427-ESP-001-TRO-01) + Adhesivo Fenoclor (codigo AD - ADFA15)'),
    ],
  });
  it('todo lo que nombra el AMFE esta en la BOM (aunque con otra grafia): VERDE, y dice lo que la BOM tiene sin nombrar', () => {
    const r = compararAtributos(ficha()).find((x) => x.atributo === 'materiales.codigos');
    expect(r.estado).toBe('verde');
    expect(r.detalle).toMatch(/1246030223/);
    expect(r.detalle).toMatch(/ET-SATO-100X60/);
  });
  it('gemelo: el AMFE nombra un adhesivo que la BOM no tiene: ROJO', () => {
    const f = ficha();
    f.atributos[1].texto += ' + Adhesivo Sika (codigo 923852)';
    const r = compararAtributos(f).find((x) => x.atributo === 'materiales.codigos');
    expect(r.estado).toBe('rojo');
    expect(r.detalle).toMatch(/amfe:158 nombra 923852/);
  });
});

describe('detalles que la revision por API encontro', () => {
  it('cuatro renglones de la MISMA BOM no son una comparacion: UNA FUENTE', () => {
    const f = { documentos: [doc('bom:arb')], atributos: [1, 2, 3, 4].map(() => at('vinilo.ancho_rollo', 'bom:arb', 'SANLEATHER 1,1X1400 ESP3,00')) };
    expect(compararAtributos(f).find((x) => x.atributo === 'vinilo.ancho_rollo').estado).toBe('una_fuente');
  });
  it('un rojo que sale de un documento con vigencia a confirmar lo dice', () => {
    const f = { documentos: [doc('ho:990', { vigente: 'a confirmar' }), doc('bom:arb')], atributos: [at('adhesivo', 'ho:990', 'SikaMelt'), at('adhesivo', 'bom:arb', 'ADFA15')] };
    expect(compararAtributos(f).find((x) => x.atributo === 'adhesivo').detalle).toMatch(/vigencia a confirmar: ho:990/);
  });
  it('la letra citada se lee aunque venga en mayusculas («REV. B»)', () => {
    expect(normalizar('cita.flujograma', 'FLUJOGRAMA 154 REV. B').valor).toBe('B');
  });
  it('--cambio dice que un documento es de otra pieza', () => {
    const f = { documentos: [doc('ft:149', { pieza: 'ip-pad' })], atributos: [at('espuma.densidad', 'ft:149', '45Kg/m3')] };
    expect(queTocaUnCambio(f, { atributo: 'espuma' }).documentos[0].pieza).toBe('ip-pad');
  });
});

describe('un solo papel no es una comparacion', () => {
  it('atributo con una sola fuente vigente: UNA FUENTE, ni verde ni rojo', () => {
    const f = { documentos: [doc('ft:141')], atributos: [at('espuma.densidad', 'ft:141', '35Kg/m3')] };
    expect(compararAtributos(f).find((x) => x.atributo === 'espuma.densidad').estado).toBe('una_fuente');
  });
  it('un texto que no se pudo normalizar es A CONFIRMAR, no un valor', () => {
    const f = { documentos: [doc('ho:990'), doc('bom:insert')], atributos: [
      at('adhesivo', 'ho:990', 'Aplicar el adhesivo'), at('adhesivo', 'bom:insert', 'AD - ADFA15'),
    ] };
    const r = compararAtributos(f).find((x) => x.atributo === 'adhesivo');
    expect(r.estado).toBe('una_fuente');
    expect(r.sinValor.map((v) => v.documento)).toEqual(['ho:990']);
  });
});

describe('compararCliente: caso 4, lo que vio el cliente contra lo nuestro', () => {
  const ficha = {
    documentos: [
      doc('flujograma:157', { letra: 'B', cliente: [{ letra: 'A', donde: 'BeOn', fuente: 'txt BeOn 15/10' }] }),
      doc('ho:985', { letra: 'A', cliente: [{ letra: 'A', donde: 'BeOn', fuente: 'txt BeOn 15/10' }] }),
      doc('amfe:149', { letra: 'A', cliente: [{ letra: 'A', donde: 'BeOn', fuente: 'txt BeOn 15/10' }] }),
    ],
    atributos: [
      at('costura.vista.puntada', 'ho:985', 'Puntadas 4 en 16'),
      at('costura.vista.puntada', 'ho:985', '6 puntadas en 25 mm (±0,5)', { rol: 'cliente', donde: 'BeOn' }),
    ],
  };
  it('flujograma 157: el cliente tiene la A y nosotros la B: ROJO', () => {
    const r = compararCliente(ficha).find((x) => x.documento === 'flujograma:157');
    expect(r.estado).toBe('rojo');
    expect(r.detalle).toMatch(/A/);
  });
  it('HO-985: misma letra A, pero lo que tiene el cliente dice 6 en 25 y lo nuestro 4 en 16: ROJO', () => {
    const r = compararCliente(ficha).find((x) => x.documento === 'ho:985');
    expect(r.estado).toBe('rojo');
    expect(r.detalle).toMatch(/misma letra/i);
  });
  it('gemelo: AMFE 149, misma letra y nada distinto: VERDE', () => {
    expect(compararCliente(ficha).find((x) => x.documento === 'amfe:149').estado).toBe('verde');
  });
  it('sin dato de lo que vio el cliente: A CONFIRMAR, nunca verde', () => {
    const f = { documentos: [doc('flujograma:154', { letra: 'D', cliente: [{ letra: null, estado: 'a confirmar', fuente: 'PPAP de Novax' }] })], atributos: [] };
    expect(compararCliente(f)[0].estado).toBe('a_confirmar');
  });
  it('el cliente tiene una letra pero la nuestra no se sabe: A CONFIRMAR, no rojo', () => {
    const f = { documentos: [doc('pc:insert', { letra: null, cliente: [{ letra: '0', donde: 'mail', fuente: 'mail 15/10' }] })], atributos: [] };
    const r = compararCliente(f)[0];
    expect(r.estado).toBe('a_confirmar');
    expect(r.detalle).not.toMatch(/undefined|null/);
  });
  it('letra inferida (deducida por fecha, no leida): A CONFIRMAR con la letra probable, nunca rojo ni verde', () => {
    const f = { documentos: [doc('flujograma:154', { letra: 'D', cliente: [{ letra: 'B', inferida: true, fuente: 'mail 08/09' }] })], atributos: [] };
    const r = compararCliente(f)[0];
    expect(r.estado).toBe('a_confirmar');
    expect(r.detalle).toMatch(/probablemente.*B.*inferid/);
    const igualLetra = { documentos: [doc('flujograma:154', { letra: 'B', cliente: [{ letra: 'B', inferida: true, fuente: 'mail' }] })], atributos: [] };
    expect(compararCliente(igualLetra)[0].estado).toBe('a_confirmar');
  });
});

describe('queTocaUnCambio', () => {
  const ficha = {
    documentos: [doc('ho:990'), doc('bom:insert'), doc('amfe:158'), doc('flujograma:154'), doc('ft:141')],
    atributos: [
      at('adhesivo', 'ho:990', 'SikaMelt'), at('adhesivo', 'bom:insert', 'AD - ADFA15', { codigo: 'AD - ADFA15' }),
      at('adhesivo', 'amfe:158', 'Fenoclor (codigo AD - ADFA15)', { codigo: 'AD - ADFA15' }),
      at('espuma.densidad', 'ft:141', '35Kg/m3', { codigo: '427ESP001TRO01' }),
    ],
  };
  it('por atributo: lista los documentos que lo nombran y el recordatorio del ECR', () => {
    const r = queTocaUnCambio(ficha, { atributo: 'adhesivo' });
    expect(r.documentos.map((d) => d.id).sort()).toEqual(['amfe:158', 'bom:insert', 'ho:990']);
    expect(r.recordatorio).toMatch(/I-IN-003/);
  });
  it('por codigo del arb', () => {
    expect(queTocaUnCambio(ficha, { codigo: '427ESP001TRO01' }).documentos.map((d) => d.id)).toEqual(['ft:141']);
  });
  it('un atributo que ningun documento nombra: lista vacia y lo dice (no inventa)', () => {
    const r = queTocaUnCambio(ficha, { atributo: 'hilo.union' });
    expect(r.documentos).toEqual([]);
    expect(r.aviso).toMatch(/ningun documento/i);
  });
});

describe('registrarDocumento y documentoDeNombre (lo que llama un emisor)', () => {
  it('lee tipo, numero y letra del nombre que usa _emitirApqp', () => {
    expect(documentoDeNombre('flujograma', 'FLUJOGRAMA 154 - INSERT - Rev.D')).toEqual({ tipo: 'flujograma', numero: '154', letra: 'D' });
    expect(documentoDeNombre('amfe', 'AMFE 158 - INSERT - Rev.A')).toEqual({ tipo: 'amfe', numero: '158', letra: 'A' });
    expect(documentoDeNombre('amfe', 'sin numero')).toBeNull();
  });
  it('agrega una emision al documento que existe, sin borrar lo que habia', () => {
    const f = { documentos: [doc('flujograma:154', { letra: 'C', emisiones: [{ letra: 'C', fecha: '2026-09-11' }] })], atributos: [] };
    const g = registrarDocumento(f, { tipo: 'flujograma', numero: '154', letra: 'D', emision: { fecha: '2026-10-18', destino: 'x' } });
    const d = g.documentos[0];
    expect(d.letra).toBe('D');
    expect(d.emisiones.map((e) => e.letra)).toEqual(['C', 'D']);
    expect(f.documentos[0].letra).toBe('C');   // no muta la original
  });
  it('un documento que la ficha no tiene: devuelve null (el emisor dice «sin ficha» y sigue)', () => {
    expect(registrarDocumento({ documentos: [], atributos: [] }, { tipo: 'amfe', numero: '999', letra: 'A' })).toBeNull();
  });
});

describe('resumenComparacion', () => {
  it('cuenta rojos y sale con 1 si hay alguno', () => {
    const f = { documentos: [doc('ho:990'), doc('bom:insert')], atributos: [at('adhesivo', 'ho:990', 'SikaMelt'), at('adhesivo', 'bom:insert', 'ADFA15')] };
    const r = resumenComparacion(f);
    expect(r.rojos).toBe(1);
    expect(r.codigoSalida).toBe(1);
  });
});

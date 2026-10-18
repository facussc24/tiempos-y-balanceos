/**
 * fichaPieza contra los PAPELES REALES (respuesta conocida del plan, tanda 13 item 1).
 *
 * Tres capas:
 *   1. La ficha versionada del Insert (data/configuracion/insert-patagonia.json), tal como la dejo
 *      `--relevar`: corre en todos lados, tambien en el CI de GitHub.
 *   2. Releer HOY los archivos de la nube y de exports/ (HO-990, FT141, FT149, copia de la ficha del
 *      legajo, tizadas, HO 971, valores de costura, BeOn): solo en una PC con la nube sincronizada,
 *      antiword, pdftotext y python-pptx. Donde falta algo, el test lo dice y se saltea con el motivo.
 *   3. Fichas armadas EN EL TEST para las piezas que no son el Insert (caso 4: IP PAD; el verde: APB de
 *      puerta). El pedido es una sola pieza en data/configuracion; estas no se guardan.
 *
 * Supabase no se toca desde los tests: el AMFE 158 entra por la capa 1 (lo leyo `--relevar` live).
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { leerFicha, compararAtributos, compararCliente, queTocaUnCambio } from '../../scripts/_lib/fichaPieza.mjs';
import { relevarFicha, letraDe, letraEnFecha, extraerDeTexto } from '../../scripts/_lib/fichaRelevar.mjs';
import { hay, checkoutPrincipal, flujogramaDelRepo } from '../../scripts/_lib/fichaLectores.mjs';
import { buscarBiblioteca } from '../../scripts/_lib/nubeRutas.mjs';

const ficha = leerFicha('insert-patagonia');
const porAtributo = (f, a) => compararAtributos(f).find((x) => x.atributo === a);

describe('ayudantes del relevamiento (puros)', () => {
  it('letraDe lee la letra de un nombre o de un renglon', () => {
    expect(letraDe('HO-990_INSERT_PATAGONIA_REV.A.pptx')).toBe('A');
    expect(letraDe('GE - 278 INSERT - cajon negro Rev C.pdf')).toBe('C');
    expect(letraDe('AMFE VWA-PAT-IPPADS-001, Revision A, fecha rev. 02/07/2026')).toBe('A');
    expect(letraDe('PC INSERTO PATAGONIA REV 0.pdf')).toBe('0');
    expect(letraDe('FLUJOGRAMA_154-INSERT.pdf')).toBeNull();
    expect(letraDe('Previsto para el lunes')).toBeNull();
  });
  it('letraEnFecha: la ultima letra del historial con fecha hasta ese dia', () => {
    const revs = [{ letra: 'A', fecha: '12/11/2025' }, { letra: 'B', fecha: '08/09/2026' }, { letra: 'C', fecha: '11/09/2026' }];
    expect(letraEnFecha(revs, '2026-09-08')).toBe('B');
    expect(letraEnFecha(revs, '2026-09-10')).toBe('B');
    expect(letraEnFecha(revs, '2025-01-01')).toBeNull();
  });
  it('extraerDeTexto: con un grupo en el patron se guarda solo esa columna', () => {
    const t = 'APB de puerta | 4 en 16 mm ±1; margen 8 mm ±1 | 6 ±0,5 en 25 mm; a 4 ±0,5 mm | Union 30/3';
    const r = extraerDeTexto(t, [{ atributo: 'costura.vista.puntada', patron: 'APB de puerta \\| [^|]+ \\| ([^|]+)' }], { documento: 'x' });
    expect(r[0].texto).toBe('6 ±0,5 en 25 mm; a 4 ±0,5 mm');
  });
  it('extraerDeTexto: una entrada por frase distinta; con lista, los numeros juntos', () => {
    const t = 'OP 10 RECEPCION | OP 20 CORTE | OP 20 CORTE | adhesivo termofusible (SikaMelt) en la fusora';
    const base = { documento: 'ho:990', fuente: 'x' };
    expect(extraerDeTexto(t, [{ atributo: 'operaciones', patron: 'OP (\\d+)', lista: true }], base)[0].lista).toEqual(['10', '20']);
    expect(extraerDeTexto(t, [{ atributo: 'adhesivo', patron: '[^|]{0,30}sika\\s*melt[^|]{0,10}' }], base)).toHaveLength(1);
  });
});

describe('capa 1: la ficha versionada del Insert (los casos 1, 2 y 3 del plan, con datos del 18/10/2026)', () => {
  it('caso 1, adhesivo: las HO-990 dicen SikaMelt; la BOM del arb, la del legajo y el AMFE 158 dicen Fenoclor: ROJO', () => {
    const r = porAtributo(ficha, 'adhesivo');
    expect(r.estado).toBe('rojo');
    const de = (v) => r.valores.filter((x) => x.valor === v).map((x) => x.documento);
    expect(de('SikaMelt')).toEqual(expect.arrayContaining(['ho:990']));
    expect(de('Fenoclor FA')).toEqual(expect.arrayContaining(['bom:arb', 'amfe:158']));
  });
  it('caso 2, ancho del rollo de espuma: FT141 dice 1400 y la copia del legajo 1200: ROJO; el vinilo va aparte', () => {
    const r = porAtributo(ficha, 'espuma.ancho_rollo');
    expect(r.estado).toBe('rojo');
    expect(r.valores.find((v) => v.documento === 'ft:141').valor).toBe(1400);
    expect(r.valores.find((v) => v.documento === 'ft:141-copia-legajo').valor).toBe(1200);
    expect(r.valores.some((v) => v.documento.startsWith('bom'))).toBe(false);
    expect(porAtributo(ficha, 'vinilo.ancho_rollo').estado).toBe('verde');
  });
  it('caso 2, tizadas: la de 26-1-26 (115 cm) entra en el rollo; la de 9-9-25 (135 cm) no entra en el de 1200: ROJO', () => {
    const r = porAtributo(ficha, 'espuma.ancho_tizada');
    expect(r.estado).toBe('rojo');
    expect(r.detalle).toMatch(/9-9-25 usa 1350/);
  });
  it('caso 3, densidad: FT141 35 contra FT149 45 sobre la misma espuma 427ESP001TRO01 (IP PAD): ROJO', () => {
    const r = porAtributo(ficha, 'espuma.densidad');
    expect(r.estado).toBe('rojo');
    expect(r.valores.find((v) => v.documento === 'ft:149')).toMatchObject({ valor: 45, otraPieza: 'ip-pad' });
    expect(r.valores.find((v) => v.documento === 'ft:141').valor).toBe(35);
  });
  it('la HO-990 cita el flujograma 154 en Rev. B y el vigente es la D: ROJO', () => {
    expect(porAtributo(ficha, 'cita.flujograma').estado).toBe('rojo');
  });
  it('lo que tiene que dar verde da verde: los hilos de la BOM y del AMFE', () => {
    expect(porAtributo(ficha, 'hilo').estado).toBe('verde');
  });
  it('quiz 1: la letra del 154 que vio Novax sale de la ficha, marcada como inferida, con su mail', () => {
    const c = compararCliente(ficha).find((x) => x.documento === 'flujograma:154');
    const d = ficha.documentos.find((x) => x.id === 'flujograma:154');
    expect(c.estado).toBe('rojo');
    expect(d.cliente[0]).toMatchObject({ letra: 'B', inferida: true, fecha: '2026-09-08' });
    expect(d.cliente[0].fuente).toMatch(/Giacopuzzi/);
  });
  it('la BOM dice siempre de que fecha es el export del arb', () => {
    expect(ficha.documentos.find((x) => x.id === 'bom:arb').exportDelArb).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('lo que no se puede leer desde casa queda a confirmar con su fuente (Y:, Artemis)', () => {
    const p = ficha.pendientes.map((x) => `${x.que} ${x.zanja || ''}`).join('\n');
    expect(p).toMatch(/Artemis/);
    expect(p).toMatch(/Y:/);
  });
  it('paso (c): el cambio de espuma del 09/10 tocó la BOM del arb y la del legajo; la lista las trae (y ademas lo que tambien nombra la espuma)', () => {
    const r = queTocaUnCambio(ficha, { atributo: 'espuma' });
    const ids = r.documentos.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['bom:arb', 'bom:legajo']));
    expect(ids).toEqual(expect.arrayContaining(['amfe:158', 'ft:141']));
    expect(r.recordatorio).toMatch(/I-IN-003/);
    expect(queTocaUnCambio(ficha, { codigo: '427ESP001TRO01' }).documentos.map((d) => d.id)).toEqual(expect.arrayContaining(['bom:arb', 'bom:legajo', 'amfe:158']));
  });
});

// --- capa 2 y 3: archivos reales -------------------------------------------------------------
const BIB = buscarBiblioteca();
const PRINCIPAL = await checkoutPrincipal();
const NOVAX = join(BIB, 'PROYECTOS', 'NOVAX copia servidor 13-10', 'Tapizadas puerta');
const BEON = join(BIB, 'ASISTENTE INGENIERIA', '6- PEDIDOS ENTRE PC (FACUNDO)', 'BeOn practica 13-10-2026', 'BeOn Patagonia - revisiones que vio VW 15-10-2026.txt');
const HO985 = join(PRINCIPAL, 'exports', 'IPPAD_COSTURA_6EN25_20261014', 'HO985_correccion', 'corregida', 'HO-985 - IP PAD REV.A.pdf');
const HO971 = join(NOVAX, '26- Instrucciones de Proceso', 'APB DE PUERTA', 'APB PATAGONIA HO 971 REV.A.pdf');
const COSTURA = join(PRINCIPAL, 'exports', 'IPPAD_COSTURA_6EN25_20261014', 'Costura Patagonia - valores 14-10-2026.pptx');

const herramientas = hay('antiword') && hay('pdftotext') && hay('python');
const motivo = (...rutas) => {
  if (!herramientas) return 'faltan antiword, pdftotext o python-pptx en esta PC (en el CI no estan)';
  const falta = rutas.find((r) => !existsSync(r));
  return falta ? `no esta en esta PC: ${falta}` : null;
};
const saltear = (m) => { if (m) console.warn(`  (salteado: ${m})`); return Boolean(m); };

describe('capa 2: releer hoy los archivos del Insert da lo mismo que la ficha', () => {
  const m = motivo(NOVAX);
  it.skipIf(saltear(m))('HO-990, FT141, FT149, copia del legajo y tizadas: los mismos rojos', async () => {
    const soloArchivos = { ...ficha, fuentes: ficha.fuentes.filter((f) => ['pptx', 'doc', 'mrk'].includes(f.lector)) };
    const { ficha: hoy, fallas } = await relevarFicha(soloArchivos);
    expect(fallas).toEqual([]);
    expect(porAtributo(hoy, 'adhesivo').valores.map((v) => v.valor)).toEqual(expect.arrayContaining(['SikaMelt']));
    expect(porAtributo(hoy, 'espuma.ancho_rollo').estado).toBe('rojo');
    expect(porAtributo(hoy, 'espuma.densidad').estado).toBe('rojo');
  }, 120_000);
});

describe('capa 3: caso 4, el IP PAD contra lo que vio VW en BeOn (ficha armada en el test)', () => {
  const m = motivo(BEON, HO985);
  it.skipIf(saltear(m))('flujograma 157: VW tiene la A y el repo la B; HO-985: misma letra A, VW con 6 en 25 y la nuestra 4 en 16: los dos ROJO; AMFE 149: VERDE', async () => {
    const ipPad = {
      pieza: { clave: 'ip-pad-prueba' },
      documentos: [
        { id: 'flujograma:157', tipo: 'flujograma', numero: '157' },
        // La letra de la HO-985 y del AMFE 149 de nuestro lado: tabla exports/BEON_REVISIONES_20261015/NUESTRO_LADO.md
        // («HO-985 ... A (985: hoja 42 corregida 15/10, sigue A)», «AMFE 149 IP PAD A»).
        { id: 'ho:985', tipo: 'ho', numero: '985', letra: 'A' },
        { id: 'amfe:149', tipo: 'amfe', numero: '149', letra: 'A' },
      ],
      fuentes: [
        { id: 'f157', documento: 'flujograma:157', lector: 'flujograma', clave: '157-IP-PAD' },
        { id: 'ho985', documento: 'ho:985', lector: 'pdf', ruta: HO985, extraer: [{ atributo: 'costura.vista.puntada', patron: '\\d+ puntadas en \\d+ mm' }] },
        { id: 'beon', lector: 'beon', ruta: BEON, cliente: [
          { documento: 'flujograma:157', tipo: 'FLUJOGRAMA', informe: '2HC 858 417 B FAM' },
          { documento: 'ho:985', tipo: 'HOJA DE PROCESO', informe: '2HC 858 417 B FAM', extraer: [{ atributo: 'costura.vista.puntada', patron: '\\d+ puntadas en \\d+ mm' }] },
          { documento: 'amfe:149', tipo: 'AMFE', informe: '2HC 858 417 B FAM' },
        ] },
      ],
      atributos: [],
    };
    const { ficha: f, fallas } = await relevarFicha(ipPad);
    expect(fallas).toEqual([]);
    const c = Object.fromEntries(compararCliente(f).map((x) => [x.documento, x]));
    expect(flujogramaDelRepo('157-IP-PAD').letra).not.toBe('A');
    expect(c['flujograma:157'].estado).toBe('rojo');
    expect(c['ho:985'].estado).toBe('rojo');
    expect(c['ho:985'].detalle).toMatch(/6 en 25/);
    expect(c['ho:985'].detalle).toMatch(/4 en 16/);
    expect(c['amfe:149'].estado).toBe('verde');
  }, 120_000);
});

describe('capa 3: la costura del APB de puerta (6 en 25, corregida el 14/10) da VERDE entre los documentos internos', () => {
  const m = motivo(HO971, COSTURA);
  it.skipIf(saltear(m))('HO 971 del legajo y los valores vigentes del 14/10 dicen 6 en 25 en la vista', async () => {
    const apb = {
      pieza: { clave: 'apb-puerta-prueba' },
      documentos: [{ id: 'ho:971', tipo: 'ho', numero: '971' }, { id: 'costura:valores-14-10', tipo: 'costura', numero: 'valores-14-10' }],
      fuentes: [
        { id: 'ho971', documento: 'ho:971', lector: 'pdf', ruta: HO971, extraer: [{ atributo: 'costura.vista.puntada', patron: 'costura vista[^\\n]*?\\d+ puntadas en \\d+' }] },
        { id: 'valores', documento: 'costura:valores-14-10', lector: 'pptx', ruta: COSTURA, // columnas de la hoja 2: pieza | union | VISTA | hilos
          extraer: [{ atributo: 'costura.vista.puntada', patron: 'APB de puerta \\| [^|]+ \\| ([^|]+)', hoja: 2 }] },
      ],
      atributos: [],
    };
    const { ficha: f, fallas } = await relevarFicha(apb);
    expect(fallas).toEqual([]);
    const r = porAtributo(f, 'costura.vista.puntada');
    expect(r.valores.map((v) => v.valor)).toEqual(['6 en 25', '6 en 25']);
    expect(r.estado).toBe('verde');
  }, 120_000);
});

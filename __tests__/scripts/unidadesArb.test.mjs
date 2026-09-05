/**
 * Tests del maestro de unidades (scripts/_lib/unidadesArb.mjs) y de su cableado en
 * scripts/_validarConsumos.mjs (Ola 4, item 15, 05/09/2026).
 *
 * Por que existe: la regla "la unidad NO se elige, SE BUSCA en el maestro" existia desde julio
 * pero el validador solo la aplicaba con --insumos a mano, y desde el 28/08 el INSUMOS.TXT de
 * C:\tmp era el listado IMPRESO (sin columna de unidad): la regla no se podia ejecutar y nadie
 * lo noto. 4 de las 7 correcciones que llegaron de afuera entre julio y septiembre fueron de
 * unidad (aplix m2→ML, Haartz, P703, folio rollo/m2).
 *
 * Los fixtures copian la FORMA de los exports reales del 01/09/2026 (cabecera de RELACIONES,
 * bloques de +7 columnas por nivel, la fila partida de los hilos, el listado impreso con ESC@ y
 * marcos ³) y las familias de unidad medidas sobre la poblacion (UN 2106, KG 1443, MTS 503...).
 * Cada check se ve fallar (rojo) y pasar (verde): memoria un_control_se_audita_en_las_dos_direcciones.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizarUnidad, compararUnidad, formatoInsumosTxt, parsearInsumosTxt, parsearInsumosCsv,
  unidadesDeRelaciones, cargarMaestroUnidades, CANON,
} from '../../scripts/_lib/unidadesArb.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VALIDADOR = path.resolve(AQUI, '..', '..', 'scripts', '_validarConsumos.mjs');

// ─── fixtures con la forma de los exports reales ─────────────────────────────
const CAB_REL = ['Artículo', 'Rubro', 'Medida', 'Descripción', 'Unidad', 'Consumo', 'Modulo', 'Proceso', ''];
const cabeceraRelaciones = () => [...CAB_REL, ...CAB_REL.map((h) => (h === 'Artículo' ? 'Sub-Artículo' : h)), ...CAB_REL].join('\t');
const fila = (cells, offset = 0) => [...Array(offset).fill(''), ...cells].join('\t');

const RELACIONES = [
  cabeceraRelaciones(),
  '',
  fila(['001021', '1', 'CONNCT-HEX', 'CONECTOR', 'UN', '1,00000000', 'MONTAJE', 'MONTAJE', '']),
  fila(['001021', '1', 'APLIX-A999R8395', 'APLIX 16MM', 'MTL', '0,25260000', 'MONTAJE', 'MONTAJE', '']),
  // nivel 2: el semielaborado FUN-002 cuelga del padre y su bloque arranca en la columna 7
  fila(['FUN-002-607-FZH', '1', 'BX69-11527E', 'HILO UNION NEGRO TEX 70 - 40/3 (P703)', 'KG', '0,00060000', ''], 7),
  // fila partida: la descripcion trae un \r en el maestro; unidad y consumo caen en la linea siguiente
  fila(['001021', '1', 'HILO-PART-01', 'HILO POLIESTER', '', '', '', '', '']),
  fila(['TEX 40 NEGRO', 'KGS', '0,00050000', '', '']),
  // unidad vacia en el maestro, con consumo en la misma linea (caso real V8550450A1600A)
  fila(['00157072-03-NHZ', '1', 'V8550450A1600A', 'ACELLA 2248 MISTRAL 1,35MM - ANCHO 1.60M', '', '0,31000000', '', '', '']),
  // el mismo codigo con DOS unidades distintas en dos padres
  fila(['00157077-02-NHZ', '1', 'DOBLE-001', 'CINTA', 'MTS', '0,10000000', '', '', '']),
  fila(['00162062-03-NHZ', '1', 'DOBLE-001', 'CINTA', 'MT2', '0,10000000', '', '', '']),
].join('\r\n');

const INSUMOS_LISTADO = '\x1b@\r\n' + '                    Hoja 1\r\n' + '³ Codigo        ³ Descripcion              ³\r\n' + '³ CONNCT-HEX    ³ CONECTOR                 ³\r\n';
const INSUMOS_TABULADO = [
  'Rubro Codigo\tRubro\tCodigo\tDescripcion\tMedida\tU.Medida\tProveedor',
  '1 CONNCT-HEX\t1\tCONNCT-HEX\tCONECTOR\t\tUN\t',
  '1 SOLO-TAB-01\t1\tSOLO-TAB-01\tSOLO EN EL TABULADO\t\tLTS\t',
].join('\r\n');
const BACKUP_CSV = [
  'codigo,descripcion,unidad',
  'CONNCT-HEX,CONECTOR,UN',
  'APLIX-A999R8395,"APLIX 16MM, GANCHO",MT2',
  'SOLO-BACKUP-01,ETIQUETA VIEJA,UNID',
  'SIN-UNIDAD-01,ALGO SIN UNIDAD,',
].join('\n');

let dir;
const escribir = (rel, contenido, enc = 'latin1') => {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from(contenido, enc));
  return p;
};
let tmpDir, cacheDir;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unidadesArb-'));
  tmpDir = path.join(dir, 'tmp');
  cacheDir = path.join(dir, 'cache');
  escribir('tmp/RELACIONES.TXT', RELACIONES);
  escribir('tmp/INSUMOS.TXT', INSUMOS_LISTADO);
  escribir('cache/insumos.csv', 'codigo,descripcion,unidad\n', 'utf8'); // vacio desde el 01/09
  escribir('cache/insumos_20260802_backup.csv', BACKUP_CSV, 'utf8');
});
afterAll(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows a veces retiene */ } });

// ─── familias ────────────────────────────────────────────────────────────────
describe('normalizarUnidad / compararUnidad — familias medidas sobre el maestro', () => {
  it('UN, UNI y UNID son la misma unidad escrita distinto (grafia), no un error', () => {
    expect(compararUnidad('UN', 'UNID')).toBe('grafia');
    expect(compararUnidad('uni', 'UN')).toBe('grafia');
    expect(compararUnidad('KG', 'KGS.')).toBe('grafia');
    expect(compararUnidad('MTS', 'ML')).toBe('grafia'); // MTS en este maestro es metro lineal
    expect(compararUnidad('MTL', 'MTS')).toBe('grafia');
  });
  it('dos familias distintas SI son error: los 4 casos que llegaron de afuera', () => {
    expect(compararUnidad('MT2', 'MTL')).toBe('distinta'); // aplix m2 → ML
    expect(compararUnidad('M2', 'ML')).toBe('distinta');   // Haartz
    expect(compararUnidad('UN', 'KG')).toBe('distinta');
    expect(compararUnidad('ROLL', 'MT2')).toBe('distinta'); // folio rollo/m2
  });
  it('vacia de un lado = sin-dato; iguales = igual; una grafia desconocida se compara tal cual', () => {
    expect(compararUnidad('', 'UN')).toBe('sin-dato');
    expect(compararUnidad('UN', '')).toBe('sin-dato');
    expect(compararUnidad('KG', 'KG')).toBe('igual');
    expect(compararUnidad('HSSER', 'HSSER')).toBe('igual');
    expect(compararUnidad('HSSER', 'UN')).toBe('distinta');
    expect(normalizarUnidad('  unid ')).toEqual({ crudo: 'UNID', familia: 'UN' });
    expect(normalizarUnidad(null)).toEqual({ crudo: '', familia: '' });
  });
  it('toda grafia del canon resuelve a su familia y ninguna esta en dos familias', () => {
    const vistas = new Map();
    for (const [fam, grafias] of Object.entries(CANON.unidades_alias)) {
      if (fam.startsWith('_')) continue;
      for (const g of grafias) {
        expect(normalizarUnidad(g).familia, `${g} deberia ser ${fam}`).toBe(fam);
        expect(vistas.has(g), `${g} esta en ${vistas.get(g)} y en ${fam}`).toBe(false);
        vistas.set(g, fam);
      }
    }
    // las 14 grafias que aparecen en RELACIONES del 01/09 tienen familia
    for (const g of ['UN', 'KG', 'MTS', 'LTS', 'MT2', 'UNI', 'MTL', 'BI', 'ROLL', 'UNID', 'LAT', 'CAJ', 'FT2', 'GRS']) {
      expect(vistas.has(g), `${g} no esta en unidades_alias`).toBe(true);
    }
  });
});

// ─── parsers ─────────────────────────────────────────────────────────────────
describe('INSUMOS.TXT: el tabulado sirve, el listado impreso no', () => {
  it('detecta el formato', () => {
    expect(formatoInsumosTxt(INSUMOS_LISTADO)).toBe('listado');
    expect(formatoInsumosTxt(INSUMOS_TABULADO)).toBe('tabulado');
    expect(formatoInsumosTxt('')).toBe('vacio');
  });
  it('del tabulado saca codigo (col 2) y unidad (col 5); del listado, nada', () => {
    const m = parsearInsumosTxt(INSUMOS_TABULADO);
    expect([...m]).toEqual([['CONNCT-HEX', 'UN'], ['SOLO-TAB-01', 'LTS']]);
    expect(parsearInsumosTxt(INSUMOS_LISTADO).size).toBe(0);
  });
  it('el csv del cache: descripcion con comas y BOM no rompen; la unidad vacia queda vacia', () => {
    const m = parsearInsumosCsv('\uFEFF' + BACKUP_CSV);
    expect(m.get('APLIX-A999R8395')).toBe('MT2');
    expect(m.get('SIN-UNIDAD-01')).toBe('');
    expect(m.size).toBe(4);
  });
});

describe('RELACIONES.TXT: la unidad que el arb imprime en cualquier nivel del arbol', () => {
  it('lee nivel 1, nivel 2 (+7 columnas) y la fila partida de los hilos; la continuacion no es un codigo', () => {
    const { mapa, dobles } = unidadesDeRelaciones(RELACIONES);
    expect(mapa.get('CONNCT-HEX')).toBe('UN');
    expect(mapa.get('APLIX-A999R8395')).toBe('MTL');
    expect(mapa.get('BX69-11527E')).toBe('KG');
    expect(mapa.get('HILO-PART-01')).toBe('KGS');       // rescatada de la linea siguiente
    expect(mapa.has('TEX 40 NEGRO')).toBe(false);      // el resto de la descripcion no es un codigo
    expect(mapa.has('V8550450A1600A')).toBe(false);    // sin unidad en el maestro: no se inventa
    expect(dobles).toEqual([{ codigo: 'DOBLE-001', unidades: ['MTS', 'MT2'] }]);
  });
  it('un archivo vacio o solo cabecera da mapa vacio, sin excepcion', () => {
    expect(unidadesDeRelaciones('').mapa.size).toBe(0);
    expect(unidadesDeRelaciones(cabeceraRelaciones()).mapa.size).toBe(0);
  });
});

// ─── loader ──────────────────────────────────────────────────────────────────
describe('cargarMaestroUnidades: la fuente mas nueva gana y declara cual fue', () => {
  it('junta RELACIONES + backup, ignora el listado impreso (con aviso) y el csv vacio', () => {
    const r = cargarMaestroUnidades({ tmpDir, cacheDir });
    expect(r.fuentes.map((f) => f.nombre)).toEqual(['RELACIONES.TXT', '.arb-cache/insumos_20260802_backup.csv']);
    expect(r.avisos.some((a) => /listado IMPRESO/.test(a))).toBe(true);
    expect(r.avisos.some((a) => /DOBLE-001 sale con DOS unidades/.test(a))).toBe(true);
    // RELACIONES (hoy) le gana al backup (02/08) en el codigo compartido
    expect(r.mapa.get('APLIX-A999R8395')).toMatchObject({ unidad: 'MTL', fuente: 'RELACIONES.TXT' });
    // el backup aporta lo que RELACIONES no tiene
    expect(r.mapa.get('SOLO-BACKUP-01')).toMatchObject({ unidad: 'UNID', fuente: '.arb-cache/insumos_20260802_backup.csv' });
    expect(r.mapa.get('SOLO-BACKUP-01').fecha.toISOString().slice(0, 10)).toBe('2026-08-02');
    expect(r.mapa.get('SIN-UNIDAD-01').unidad).toBe('');
  });
  it('detecta el CAMBIO DE ETIQUETA entre fotos (el aplix: MT2 el 02/08, MTL hoy) y no confunde grafias', () => {
    const r = cargarMaestroUnidades({ tmpDir, cacheDir });
    expect(r.cambios.map((c) => c.codigo)).toEqual(['APLIX-A999R8395']);
    expect(r.cambios[0].antes.unidad).toBe('MT2');
    expect(r.cambios[0].ahora.unidad).toBe('MTL');
    // CONNCT-HEX es UN en las dos fotos: no es cambio
    expect(r.historico.get('CONNCT-HEX').map((h) => h.unidad)).toEqual(['UN', 'UN']);
  });
  it('un INSUMOS.TXT tabulado entra como maestro; --insumos a mano gana sobre todo', () => {
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'unidadesArb2-'));
    fs.writeFileSync(path.join(dir2, 'INSUMOS.TXT'), Buffer.from(INSUMOS_TABULADO, 'latin1'));
    const r = cargarMaestroUnidades({ tmpDir: dir2, cacheDir });
    expect(r.fuentes[0].nombre).toBe('INSUMOS.TXT');
    expect(r.mapa.get('SOLO-TAB-01').unidad).toBe('LTS');
    expect(r.avisos.some((a) => /listado IMPRESO/.test(a))).toBe(false);

    const extra = path.join(dir2, 'mano.csv');
    fs.writeFileSync(extra, 'codigo,descripcion,unidad\nCONNCT-HEX,CONECTOR,CAJ\n');
    const r2 = cargarMaestroUnidades({ tmpDir, cacheDir, extra });
    expect(r2.mapa.get('CONNCT-HEX')).toMatchObject({ unidad: 'CAJ', fuente: '--insumos mano.csv' });

    const listado = path.join(dir2, 'listado.txt');
    fs.writeFileSync(listado, Buffer.from(INSUMOS_LISTADO, 'latin1'));
    const r3 = cargarMaestroUnidades({ tmpDir: dir2, cacheDir, extra: listado });
    expect(r3.avisos.some((a) => /--insumos .*no le saque ninguna unidad/.test(a))).toBe(true);
    fs.rmSync(dir2, { recursive: true, force: true });
  });
  it('sin ninguna fuente: mapa vacio y sin excepcion', () => {
    const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'unidadesArb3-'));
    const r = cargarMaestroUnidades({ tmpDir: vacio, cacheDir: vacio });
    expect(r.mapa.size).toBe(0);
    expect(r.fuentes).toEqual([]);
    fs.rmSync(vacio, { recursive: true, force: true });
  });
});

// ─── el validador de punta a punta ───────────────────────────────────────────
function correrValidador(csv, args = []) {
  const tabla = path.join(dir, `tabla-${Math.random().toString(36).slice(2)}.csv`);
  fs.writeFileSync(tabla, csv);
  const res = spawnSync(process.execPath, [VALIDADOR, tabla, '--arb-dir', tmpDir, '--arb-cache', cacheDir, ...args], { encoding: 'utf8' });
  return { status: res.status, out: res.stdout + res.stderr };
}

describe('_validarConsumos.mjs busca el maestro solo y frena la unidad equivocada', () => {
  it('ROJO: UN vs KG es FAIL (exit 1); grafia es INFO; codigo desconocido y cambio de etiqueta son WARN', () => {
    const { status, out } = correrValidador([
      'codigo;descripcion;consumo;unidad',
      'CONNCT-HEX;CONECTOR;1;KG',              // FAIL: el maestro dice UN
      'SOLO-BACKUP-01;ETIQUETA VIEJA;2;UN',    // INFO: UNID vs UN, misma familia
      'NUEVO-999;ALGO NUEVO;3;UN',             // WARN: no esta en el maestro
      'APLIX-A999R8395;APLIX 16MM;0,2526;MTL', // WARN: cambio de etiqueta MT2 → MTL
      'SIN-UNIDAD-01;ALGO;1;UN',               // WARN: el maestro no tiene unidad
      'BX69-11527E;HILO;0,0006;',              // WARN: la tabla no trae unidad
    ].join('\n'));
    expect(status).toBe(1);
    expect(out).toContain('Maestro de unidades: RELACIONES.TXT');
    expect(out).toMatch(/\[FAIL\] UNIDAD_VS_MAESTRO: CONNCT-HEX: tabla dice "KG", maestro dice "UN" \(RELACIONES\.TXT \d{4}-\d{2}-\d{2}\)/);
    expect(out).toMatch(/\[INFO\] UNIDAD_GRAFIA: SOLO-BACKUP-01: "UN" y "UNID"/);
    expect(out).toMatch(/\[WARN\] UNIDAD_CODIGO_SIN_MAESTRO: NUEVO-999/);
    expect(out).toMatch(/\[WARN\] UNIDAD_CAMBIO_ETIQUETA: APLIX-A999R8395: era "MT2" \(\.arb-cache\/insumos_20260802_backup\.csv 2026-08-02\) y hoy es "MTL" \(RELACIONES\.TXT/);
    expect(out).toMatch(/\[WARN\] UNIDAD_MAESTRO_VACIA: SIN-UNIDAD-01/);
    expect(out).toMatch(/\[WARN\] UNIDAD_VACIA_EN_TABLA: BX69-11527E/);
    expect(out).toMatch(/\[WARN\] UNIDAD_FUENTE: .*listado IMPRESO/);
    expect(out).toMatch(/Resultado: 1 FAIL/);
  });
  it('VERDE: la tabla con las unidades del maestro pasa (exit 0) sin UNIDAD_VS_MAESTRO', () => {
    const { status, out } = correrValidador([
      'codigo;descripcion;consumo;unidad',
      'CONNCT-HEX;CONECTOR;1;UN',
      'BX69-11527E;HILO UNION;0,0006;KG',
      'HILO-PART-01;HILO POLIESTER;0,0005;KG', // el maestro dice KGS: misma familia
    ].join('\n'));
    expect(status).toBe(0);
    expect(out).not.toContain('UNIDAD_VS_MAESTRO');
    expect(out).toMatch(/Resultado: 0 FAIL/);
  });
  it('sin columna de unidad avisa TABLA_SIN_UNIDAD y no revienta', () => {
    const { status, out } = correrValidador(['codigo;descripcion;consumo', 'CONNCT-HEX;CONECTOR;1'].join('\n'));
    expect(status).toBe(0);
    expect(out).toContain('[WARN] TABLA_SIN_UNIDAD');
  });
  it('--insumos a mano sigue funcionando y gana sobre el resto', () => {
    const mano = path.join(dir, 'mano.csv');
    fs.writeFileSync(mano, 'codigo,descripcion,unidad\nCONNCT-HEX,CONECTOR,KG\n');
    const { status, out } = correrValidador(['codigo;descripcion;consumo;unidad', 'CONNCT-HEX;CONECTOR;1;UN'].join('\n'), ['--insumos', mano]);
    expect(status).toBe(1);
    expect(out).toMatch(/UNIDAD_VS_MAESTRO: CONNCT-HEX: tabla dice "UN", maestro dice "KG" \(--insumos mano\.csv/);
  });
  it('sin ninguna fuente de maestro avisa UNIDAD_SIN_MAESTRO (no valida en silencio)', () => {
    const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'unidadesArb4-'));
    const tabla = path.join(vacio, 't.csv');
    fs.writeFileSync(tabla, 'codigo;descripcion;consumo;unidad\nCONNCT-HEX;CONECTOR;1;UN\n');
    const res = spawnSync(process.execPath, [VALIDADOR, tabla, '--arb-dir', vacio, '--arb-cache', vacio], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('[WARN] UNIDAD_SIN_MAESTRO');
    expect(res.stdout).toContain('Maestro de unidades: NINGUNA FUENTE');
    fs.rmSync(vacio, { recursive: true, force: true });
  });
});

describe('el canon de consumos tiene la regla de las tres fuentes', () => {
  it('BOM = maestro = factura, con fuente y herramientas', () => {
    expect(CANON.unidades_tres_fuentes.regla_corta).toMatch(/BOM = maestro = factura/);
    expect(CANON.unidades_tres_fuentes.fuente).toMatch(/unidad_oc_es_etiqueta_del_maestro/);
    expect(CANON.unidades_fuentes.orden.length).toBe(4);
  });
});

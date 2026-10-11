/**
 * Tests de scripts/_xlsxComparar.py (cola HOY-18a) — LAS DOS DIRECCIONES, corriendo el programa por su ruta.
 *
 * Fak, 06/10/2026, sobre el plan de control de Nico: "no me lo abras, auditalo... poneme el antes". El programa
 * compara dos Excel y devuelve la tabla «hoja, celda, antes, después». Los dos libros se arman acá, chicos, con
 * openpyxl. Tambien cubre `verificar()` de _xlsxCorregirTexto.py, que desde hoy usa la misma lectura.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(RAIZ, 'scripts', '_xlsxComparar.py');
const py = (args, opts = {}) => spawnSync('python', args, { encoding: 'utf8', cwd: RAIZ, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 60000, ...opts });
const hayPython = py(['-c', 'import openpyxl']).status === 0;

let dir;
const en = (n) => path.join(dir, n);

// Arma los libros de prueba de una vez (un solo arranque de python).
const ARMAR = `
import sys, openpyxl
d = sys.argv[1]
def libro(nombre, hojas):
    wb = openpyxl.Workbook(); wb.remove(wb.active)
    for titulo, celdas in hojas:
        ws = wb.create_sheet(titulo)
        for k, v in celdas.items(): ws[k] = v
    wb.save(d + '/' + nombre)
base = [('OP 10', {'A1': 'Operación', 'B1': 'Control', 'A2': 'Corte', 'B2': 'Calibre, 3 piezas por lote', 'C2': 5, 'D2': '=C2*2'}),
        ('OP 20', {'A1': 'Costura', 'B1': 'Muestra patrón'})]
libro('antes.xlsx', base)
libro('igual.xlsx', base)
libro('una_celda.xlsx', [('OP 10', {**base[0][1], 'B2': 'Calibre, 5 piezas por lote'}), base[1]])
libro('tres_cambios.xlsx', [('OP 10', {**base[0][1], 'C2': 7, 'D2': '=C2*3'}), ('OP 20', {'A1': 'Costura', 'B1': 'Muestra patrón al inicio de turno'})])
libro('hoja_de_mas.xlsx', base + [('OP 30', {'A1': 'Embalaje'})])
libro('hoja_de_menos.xlsx', base[:1])
libro('celda_borrada.xlsx', [('OP 10', {k: v for k, v in base[0][1].items() if k != 'B2'}), base[1]])
libro('salto_windows.xlsx', [('OP 10', {'A1': 'uno\\r\\ndos'})])
libro('salto_unix.xlsx', [('OP 10', {'A1': 'uno\\ndos'})])
libro('texto_vacio.xlsx', [('H', {'A1': 'x', 'B1': ''})])
libro('celda_vacia.xlsx', [('H', {'A1': 'x'})])
libro('texto_y_numero_a.xlsx', [('H', {'A1': 3})])
libro('texto_y_numero_b.xlsx', [('H', {'A1': '3'})])
`;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-comparar-'));
  if (hayPython) {
    const r = py(['-c', ARMAR, dir.replace(/\\/g, '/')]);
    if (r.status !== 0) throw new Error(`no pude armar los libros de prueba: ${r.stderr}`);
  }
});
afterAll(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* nada */ } });

const comparar = (a, b, ...extra) => py([SCRIPT, en(a), en(b), ...extra]);
const enJson = (a, b) => { const r = comparar(a, b, '--json'); return { status: r.status, datos: JSON.parse(r.stdout) }; };

describe.skipIf(!hayPython)('_xlsxComparar.py · la tabla «hoja, celda, antes, después»', () => {
  it('VERDE: dos libros iguales → sale con 0 y sin filas', () => {
    const r = comparar('antes.xlsx', 'igual.xlsx');
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/Sin diferencias/);
    expect(r.stdout).not.toMatch(/\| Hoja \| Celda/);
    expect(enJson('antes.xlsx', 'igual.xlsx').datos).toMatchObject({ iguales: true, cambios: [], hojas_agregadas: [], hojas_quitadas: [] });
  });

  it('ROJO: una celda distinta aparece con su ANTES y su DESPUÉS, y sale con 1', () => {
    const r = comparar('antes.xlsx', 'una_celda.xlsx');
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/\| OP 10 \| B2 \| valor \| «Calibre, 3 piezas por lote» \| «Calibre, 5 piezas por lote» \|/);
    expect(r.stdout).toMatch(/1 celda\(s\) distinta\(s\)/);
    const { datos } = enJson('antes.xlsx', 'una_celda.xlsx');
    expect(datos.cambios).toEqual([{ hoja: 'OP 10', celda: 'B2', que: 'valor', antes: 'Calibre, 3 piezas por lote', despues: 'Calibre, 5 piezas por lote' }]);
  });

  it('ROJO: tres cambios (un valor, una fórmula y una celda de otra hoja) dan exactamente tres filas', () => {
    const { status, datos } = enJson('antes.xlsx', 'tres_cambios.xlsx');
    expect(status).toBe(1);
    expect(datos.cambios.map((c) => `${c.hoja}!${c.celda}:${c.que}`)).toEqual(['OP 10!C2:valor', 'OP 10!D2:fórmula', 'OP 20!B1:valor']);
    expect(datos.cambios[1]).toMatchObject({ antes: '=C2*2', despues: '=C2*3' });
    expect(datos.cambios[0]).toMatchObject({ antes: 5, despues: 7 });
  });

  it('ROJO: una hoja agregada o quitada se lista, y sale con 1 aunque las celdas comunes sean iguales', () => {
    const mas = comparar('antes.xlsx', 'hoja_de_mas.xlsx');
    expect(mas.status).toBe(1);
    expect(mas.stdout).toMatch(/Hoja AGREGADA \(está solo en el de después\): OP 30/);
    expect(mas.stdout).toMatch(/Sin diferencias en las celdas/);
    const menos = enJson('antes.xlsx', 'hoja_de_menos.xlsx');
    expect(menos.status).toBe(1);
    expect(menos.datos).toMatchObject({ hojas_quitadas: ['OP 20'], hojas_agregadas: [], cambios: [] });
  });

  it('ROJO: una celda que se vació figura con «(vacía)» en el después; y al revés', () => {
    expect(comparar('antes.xlsx', 'celda_borrada.xlsx').stdout).toMatch(/\| OP 10 \| B2 \| valor \| «Calibre, 3 piezas por lote» \| \(vacía\) \|/);
    expect(comparar('celda_borrada.xlsx', 'antes.xlsx').stdout).toMatch(/\| OP 10 \| B2 \| valor \| \(vacía\) \| «Calibre, 3 piezas por lote» \|/);
  });

  it('ROJO: el número 3 y el texto «3» son distintos, y se ve cuál es cuál', () => {
    const r = comparar('texto_y_numero_a.xlsx', 'texto_y_numero_b.xlsx');
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/\| H \| A1 \| valor \| 3 \| «3» \|/);
  });

  it('VERDE: un salto de línea de Windows y uno de Unix adentro de un texto son lo mismo', () => {
    expect(comparar('salto_windows.xlsx', 'salto_unix.xlsx').status).toBe(0);
  });

  it('VERDE: una celda con un texto vacío y una celda vacía son lo mismo (ruido medido en una hoja real)', () => {
    expect(comparar('texto_vacio.xlsx', 'celda_vacia.xlsx').status).toBe(0);
  });

  it('sale con 2 y no compara: archivo que no existe, extensión que no es, el mismo archivo dos veces, argumento de más', () => {
    expect(comparar('antes.xlsx', 'no_existe.xlsx')).toMatchObject({ status: 2 });
    fs.writeFileSync(en('viejo.xls'), 'x');
    expect(comparar('antes.xlsx', 'viejo.xls').stdout).toMatch(/No es un \.xlsx ni un \.xlsm/);
    expect(comparar('antes.xlsx', 'antes.xlsx').stdout).toMatch(/mismo archivo/);
    expect(comparar('antes.xlsx', 'igual.xlsx', '--apply')).toMatchObject({ status: 2 });
    expect(py([SCRIPT, en('antes.xlsx')]).status).toBe(2);
    fs.writeFileSync(en('roto.xlsx'), 'esto no es un excel');
    expect(comparar('antes.xlsx', 'roto.xlsx')).toMatchObject({ status: 2 });
  });

  it('SOLO LEE: los dos libros quedan byte por byte como estaban', () => {
    const huella = (n) => fs.readFileSync(en(n)).toString('base64').length + ':' + fs.statSync(en(n)).mtimeMs;
    const antes = [huella('antes.xlsx'), huella('tres_cambios.xlsx')];
    comparar('antes.xlsx', 'tres_cambios.xlsx');
    comparar('antes.xlsx', 'tres_cambios.xlsx', '--json');
    expect([huella('antes.xlsx'), huella('tres_cambios.xlsx')]).toEqual(antes);
    expect(fs.readdirSync(dir).filter((f) => /\.tmp$|^~\$/.test(f))).toEqual([]);
  });
});

describe.skipIf(!hayPython)('_xlsxCorregirTexto.py · sigue verificando igual con la lectura compartida', () => {
  // Se prueba `verificar()` directo: el script entero necesita un libro guardado por Excel (con su tabla de textos
  // compartidos) y los de este test los escribe openpyxl.
  const verificar = (origen, destino, hoja, celda, esperado) => py(['-c',
    'import sys; sys.path.insert(0, sys.argv[1]); from _xlsxCorregirTexto import verificar; sys.exit(verificar(sys.argv[2], sys.argv[3], {(sys.argv[4], sys.argv[5]): sys.argv[6]}))',
    path.join(RAIZ, 'scripts'), en(origen), en(destino), hoja, celda, esperado]);

  it('VERDE: cambió solo la celda pedida y quedó como se esperaba → 0 errores', () => {
    const r = verificar('antes.xlsx', 'una_celda.xlsx', 'OP 10', 'B2', 'Calibre, 5 piezas por lote');
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/verificacion: OK, solo cambiaron las 1 celdas pedidas/);
  });

  it('ROJO: la celda pedida no quedó como se esperaba y además cambiaron otras dos → 3 errores', () => {
    // `verificar()` mira VALORES calculados, como siempre: la fórmula de D2 cambió, pero un libro que Excel nunca
    // abrió no tiene valor guardado para una fórmula, así que no la ve. El comparador sí (mira también la fórmula).
    const r = verificar('antes.xlsx', 'tres_cambios.xlsx', 'OP 10', 'B2', 'Calibre, 5 piezas por lote');
    expect(r.status).toBe(3);
    expect(r.stdout).toMatch(/ERROR OP 10!B2 quedo 'Calibre, 3 piezas por lote' y se esperaba/);
    expect((r.stdout.match(/cambio sin pedirlo/g) || []).length).toBe(2);
  });

  it('ROJO: una celda esperada que quedó vacía también se mira (no viene en la lectura: se suma a mano)', () => {
    const r = verificar('celda_borrada.xlsx', 'celda_borrada.xlsx', 'OP 10', 'B2', 'algo');
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/ERROR OP 10!B2 quedo None y se esperaba 'algo'/);
  });
});

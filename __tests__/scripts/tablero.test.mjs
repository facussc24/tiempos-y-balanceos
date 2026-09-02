/**
 * Tests del tablero (G6 del rol coordinador).
 *
 * EL CASO QUE MAS IMPORTA es el "gemelo rojo" del conteo: la primera version de
 * filasEscritorio() leia `e.esDirectorio` cuando listar() devuelve `e.dir`, y por eso
 * informaba **0 carpetas abiertas teniendo 58**. No tiraba error: devolvia cero en silencio,
 * que es el verde vacio clasico — un control que da lo mismo para todos los casos no detecta
 * nada, y un cero no es respuesta hasta que el mismo control da ROJO contra un caso rojo
 * (feedback_un_control_se_audita_en_las_dos_direcciones).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { filasEscritorio, tieneNotas, chequear, MINUTOS_VIEJO } from '../../scripts/_tablero.mjs';

let base;

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'tablero-test-'));
  // Dos tareas legibles, una con notas y otra con el mail que la origino
  fs.mkdirSync(path.join(base, 'Tarea con notas'));
  fs.writeFileSync(path.join(base, 'Tarea con notas', '_QUE HAY QUE HACER.txt'), 'algo');
  fs.mkdirSync(path.join(base, 'Tarea con mail'));
  fs.writeFileSync(path.join(base, 'Tarea con mail', 'pedido.msg'), 'x');
  // Una legible con un nombre de notas que NINGUNA lista de nombres hubiera adivinado
  fs.mkdirSync(path.join(base, 'Tarea con investigacion'));
  fs.writeFileSync(path.join(base, 'Tarea con investigacion', '_INVESTIGACION - rol coordinador.md'), '# x');
  // Una MUDA de verdad: ni notas ni mail
  fs.mkdirSync(path.join(base, 'Tarea muda'));
  fs.writeFileSync(path.join(base, 'Tarea muda', 'planilla.xlsx'), 'x');
  // La bandeja _EN ESPERA, cuyo contenido sigue ABIERTO
  fs.mkdirSync(path.join(base, '_EN ESPERA', 'Tarea corrida de la vista'), { recursive: true });
  fs.writeFileSync(path.join(base, '_EN ESPERA', 'Tarea corrida de la vista', 'notas.txt'), 'x');
  // Ruido que NO es tarea
  fs.writeFileSync(path.join(base, 'acceso.lnk'), 'x');
  fs.mkdirSync(path.join(base, 'TAREAS CERRADAS'));
});

afterAll(() => { try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* temp */ } });

describe('tablero · leer la fuente', () => {
  it('1. GEMELO ROJO del conteo: con carpetas presentes NO puede devolver 0', () => {
    const filas = filasEscritorio(base);
    expect(filas.length).toBeGreaterThan(0);   // el bug real del 02/09 fallaba justo aca
    expect(filas.length).toBe(5);              // 4 en la raiz + 1 en _EN ESPERA
  });

  it('2. la bandeja _EN ESPERA no cuenta como UNA tarea: se entra y se cuentan las de adentro', () => {
    const filas = filasEscritorio(base);
    expect(filas.find((f) => f.nombre === '_EN ESPERA')).toBeUndefined();
    expect(filas.find((f) => f.nombre === 'Tarea corrida de la vista')?.ubicacion).toBe('_EN ESPERA');
  });

  it('3. los accesos directos y el archivo de cerradas no son tareas', () => {
    const nombres = filasEscritorio(base).map((f) => f.nombre);
    expect(nombres).not.toContain('acceso.lnk');
    expect(nombres).not.toContain('TAREAS CERRADAS');
  });

  it('4. legible = tiene notas O el mail; el nombre del archivo no importa', () => {
    expect(tieneNotas(path.join(base, 'Tarea con notas'))).toBe(true);
    expect(tieneNotas(path.join(base, 'Tarea con mail'))).toBe(true);
    expect(tieneNotas(path.join(base, 'Tarea con investigacion'))).toBe(true);  // falso positivo real
    expect(tieneNotas(path.join(base, 'Tarea muda'))).toBe(false);
  });
});

describe('tablero · --check, los tres modos en que el tablero miente', () => {
  const sinSalida = { salida: path.join(os.tmpdir(), 'no-existe-tablero.md') };

  it('5. canta las carpetas de las que no se sabe nada', () => {
    const p = chequear({ escritorio: filasEscritorio(base), encargos: [], sesiones: [] }, sinSalida);
    expect(p.join(' ')).toMatch(/sin notas legibles/);
    expect(p.join(' ')).toMatch(/Tarea muda/);
  });

  it('6. canta una sesion con dos encargos abiertos a la vez', () => {
    const encargos = [
      { id: 'E1', a: 'barackmercosul-c9', entregable: 'uno' },
      { id: 'E2', a: 'barackmercosul-c9', entregable: 'otro' },
    ];
    expect(chequear({ escritorio: [], encargos, sesiones: [] }, sinSalida).join(' ')).toMatch(/dos encargos|2 encargos/);
  });

  it('7. canta un tablero viejo — el error de repetir una foto de hace una hora', () => {
    const f = path.join(base, 'tablero-viejo.md');
    fs.writeFileSync(f, '# viejo');
    const ahora = Date.now() + (MINUTOS_VIEJO + 5) * 60000;
    const p = chequear({ escritorio: [], encargos: [], sesiones: [] }, { ahora, salida: f });
    expect(p.join(' ')).toMatch(/minutos/);
  });

  it('8. VERDE: todo legible, un encargo por sesion, sin tablero viejo -> sin problemas', () => {
    const escritorio = filasEscritorio(base).filter((f) => f.legible);
    const encargos = [
      { id: 'E1', a: 'barackmercosul-c9', entregable: 'uno' },
      { id: 'E2', a: 'barackmercosul-c7', entregable: 'otro' },
    ];
    expect(chequear({ escritorio, encargos, sesiones: [] }, sinSalida)).toEqual([]);
  });
});

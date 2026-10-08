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
import { filasEscritorio, tieneNotas, chequear, MINUTOS_VIEJO, filasNocturno, armarMarkdown, HORAS_NOCHE_VIEJA } from '../../scripts/_tablero.mjs';

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

describe('tablero · la noche de Claude (fuente: nocturno)', () => {
  const ahora = new Date(2026, 9, 8, 9, 0).getTime();
  const noche = (horasAtras) => ({
    fecha: '2026-10-08', finMs: ahora - horasAtras * 3600000,
    lineaTablero: 'Noche 08/10 06:31 · pre-auditoría AMFE: 3 revisados · 4 mails resumidos · $0,41 (mes $12,30 de $100, verde)',
    mails: [{ asunto: 'BOM IP Pad', linea: 'pide la BOM actualizada', area: 'ingenieria', dias: 7 }],
    reporte: path.join(base, 'reports', 'staging', 'PREAUDITORIA_AMFE_20261008.md'),
  });
  const escribir = (nombre, e) => { const f = path.join(base, nombre); fs.writeFileSync(f, JSON.stringify(e)); return f; };

  it('9. ausente: null, y el tablero dice que no hay noche (no inventa una)', () => {
    expect(filasNocturno(path.join(base, 'no-existe.json'), { ahora })).toBeNull();
    const md = armarMarkdown({ escritorio: [], encargos: [], sesiones: [], nocturno: null }, ahora);
    expect(md).toMatch(/## Noche \(fuente: nocturno · foto/);
    expect(md).toMatch(/Sin noche registrada/);
  });

  it('10. fresca: la linea, cada mail con su area y el reporte; sin VIEJO', () => {
    const n = filasNocturno(escribir('noche-fresca.json', noche(2.5)), { ahora });
    expect(n).toMatchObject({ fuente: 'nocturno', horas: 2.5, vieja: false });
    const md = armarMarkdown({ escritorio: [], encargos: [], sesiones: [], nocturno: n }, ahora);
    expect(md).toMatch(/- Noche 08\/10 06:31 · pre-auditoría AMFE/);
    expect(md).toMatch(/mail \[ingenieria\] BOM IP Pad — pide la BOM actualizada \(7 d\)/);
    expect(md).toMatch(/PREAUDITORIA_AMFE_20261008\.md/);
    expect(md).not.toMatch(/VIEJO/);
  });

  it(`11. vieja (mas de ${HORAS_NOCHE_VIEJA} h): se marca VIEJO y no se reporta como de hoy`, () => {
    const n = filasNocturno(escribir('noche-vieja.json', noche(HORAS_NOCHE_VIEJA + 4)), { ahora });
    expect(n.vieja).toBe(true);
    const md = armarMarkdown({ escritorio: [], encargos: [], sesiones: [], nocturno: n }, ahora);
    expect(md).toMatch(/⚠ VIEJO — es de hace 30 h/);
  });

  it('12. un JSON roto es "sin noche", no un tablero que se cae', () => {
    const f = path.join(base, 'noche-rota.json');
    fs.writeFileSync(f, '{roto');
    expect(filasNocturno(f, { ahora })).toBeNull();
  });
});

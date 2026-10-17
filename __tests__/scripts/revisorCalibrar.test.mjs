/**
 * revisorCalibrar.test.mjs — la calibracion del revisor-pedido no le pasa la respuesta y lee bien el veredicto
 * (tanda 9, pieza 1). Los casos son los de evals/revisor-pedido/casos.json (sesiones reales).
 */
import fs from 'node:fs';
import { armarPrompt, parsearVeredicto, evaluar, cuerpoDelAgente, CASOS, AGENTE } from '../../scripts/_revisorCalibrar.mjs';

const casos = JSON.parse(fs.readFileSync(CASOS, 'utf8')).casos;

describe('casos de calibracion del revisor-pedido', () => {
  it('hay devueltos y aprobados, cada uno con pedido, definicion de hecho, quiz de 3 y entregable', () => {
    expect(casos.filter((c) => c.tipo === 'devuelto').length).toBeGreaterThanOrEqual(2);
    expect(casos.filter((c) => c.tipo === 'aprobado').length).toBeGreaterThanOrEqual(2);
    for (const c of casos) {
      expect(c.pedido.length, c.id).toBeGreaterThan(40);
      expect(c.definicion_de_hecho.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.definicion_de_hecho.length, c.id).toBeLessThanOrEqual(5);
      expect(c.quiz.length, c.id).toBe(3);
      expect((c.entregable.rutas || []).length + (c.entregable.texto ? 1 : 0), c.id).toBeGreaterThan(0);
      expect(['CUMPLE', 'NO CUMPLE']).toContain(c.esperado);
    }
  });

  it('ROJO si se filtra: el prompt NO lleva la reaccion de Fak, ni lo esperado, ni el tipo de caso', () => {
    for (const c of casos) {
      const p = armarPrompt(c, { cuerpo: 'CUERPO' });
      expect(p, c.id).not.toContain(c.reaccion_fak);
      expect(p, c.id).not.toMatch(/devuelto|aprobado/i);
      expect(p, c.id).not.toContain(c.esperado === 'CUMPLE' ? 'esperado' : 'NO CUMPLE (esperado)');
      expect(p, c.id).toContain(c.pedido.slice(0, 60));
    }
  });

  it('el cuerpo del agente sale sin el frontmatter, y el agente no puede escribir ni lanzar agentes', () => {
    const t = fs.readFileSync(AGENTE, 'utf8');
    const cuerpo = cuerpoDelAgente(t);
    expect(cuerpo.startsWith('# Revisor contra el pedido')).toBe(true);
    const front = t.slice(0, t.indexOf(cuerpo));
    expect(front).toMatch(/omitClaudeMd: true/);
    expect(front).toMatch(/model: sonnet/);
    expect(front).not.toMatch(/^\s+- (Write|Edit|Agent|NotebookEdit)\s*$/m);
  });
});

describe('parsearVeredicto y evaluar', () => {
  it('distingue NO CUMPLE de CUMPLE (las dos direcciones) y devuelve null si no lo dijo', () => {
    expect(parsearVeredicto('VEREDICTO: NO CUMPLE  ·  2 Importante')).toBe('NO CUMPLE');
    expect(parsearVeredicto('**VEREDICTO: CUMPLE** · 0 Importante')).toBe('CUMPLE');
    expect(parsearVeredicto('veredicto:  no   cumple')).toBe('NO CUMPLE');
    expect(parsearVeredicto('El entregable cumple con lo pedido')).toBeNull();
  });

  it('cuenta aciertos por corrida y casos estables', () => {
    const cs = [{ id: 'a', tipo: 'devuelto', esperado: 'NO CUMPLE' }, { id: 'b', tipo: 'aprobado', esperado: 'CUMPLE' }];
    const r = evaluar(cs, { a: ['VEREDICTO: NO CUMPLE', 'VEREDICTO: CUMPLE'], b: ['VEREDICTO: CUMPLE'] });
    expect(r.corridas).toBe(3);
    expect(r.aciertos).toBe(2);
    expect(r.casosEstables).toBe(1);
  });
});

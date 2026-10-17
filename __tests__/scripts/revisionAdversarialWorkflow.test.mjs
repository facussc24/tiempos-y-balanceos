/**
 * revisionAdversarialWorkflow.test.mjs — el workflow guardado de revision adversarial (tanda 9, pieza 3).
 * La corrida real sobre un diff plantado se hace con la tool Workflow (informe en docs/auditorias/); aca se prueba lo
 * que se puede sin agentes: que el `meta` sea un literal puro con las fases que usa, que sus agentes sean de una
 * definicion propia (lo exige el guardian de agentes), que respete el tope de 10 por defecto y que el informe arranque
 * con el conteo y deje lugar a la respuesta de cada hallazgo. El cuerpo se ejecuta con agentes de mentira.
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(RAIZ, '.claude', 'workflows', 'revision-adversarial.js'), 'utf8');

/** Corre el cuerpo del workflow con agent/pipeline/parallel de mentira. */
async function correr(args, respuestas) {
  const cuerpo = SRC.replace(/^export const meta = [\s\S]*?\n}\n/, '');
  const llamadas = [];
  const agent = async (prompt, opts) => { llamadas.push({ prompt, opts }); return respuestas(prompt, opts); };
  const parallel = async (ths) => Promise.all(ths.map((t) => t().catch(() => null)));
  const pipeline = async (items, ...etapas) => Promise.all(items.map(async (it, i) => {
    let v = it; for (const e of etapas) { try { v = await e(v, it, i); } catch { return null; } } return v;
  }));
  const fn = new Function('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', `return (async () => {${cuerpo}})()`);
  const r = await fn(args, agent, parallel, pipeline, () => {}, () => {});
  return { r, llamadas };
}

describe('revision-adversarial.js', () => {
  it('meta es un literal puro, con nombre, descripcion y las dos fases que usa el cuerpo', () => {
    const m = SRC.match(/^export const meta = ([\s\S]*?\n})\n/);
    expect(m).toBeTruthy();
    expect(m[1]).not.toMatch(/\$\{|\.\.\.|\(\)/);
    const meta = new Function(`return ${m[1]}`)();
    expect(meta.name).toBe('revision-adversarial');
    expect(meta.phases.map((p) => p.title)).toEqual(['Lentes', 'Verificar']);
    expect(SRC).not.toMatch(/Date\.now|Math\.random|new Date\(\)/);
  });

  it('con 2 defectos plantados que las lentes encuentran: los confirma, cuenta y deja lugar a la respuesta; todos los agentes son investigador y no pasan de 10', async () => {
    const plantados = [
      { archivo: 'scripts/_lib/revisorPedido.mjs', linea: 64, clase: 'TRUE_BUG', etiqueta: 'Importante', titulo: 'falla abierto: sin registro devuelve ok', caso: 'leido=false -> ok' },
      { archivo: 'scripts/_lib/revisorPedido.mjs', linea: 46, clase: 'TRUE_BUG', etiqueta: 'Importante', titulo: 'revisor se pisa con la ultima linea', caso: 'revisor en la linea 1, otra linea despues -> false' },
    ];
    const { r, llamadas } = await correr({ repo: 'C:/tmp/x', rama: 'plantado' }, (prompt, opts) => {
      if (opts.phase === 'Lentes') return { hallazgos: opts.label === 'lente:controles' ? [plantados[0]] : opts.label === 'lente:correctitud' ? [plantados[1], { ...plantados[1], linea: 20, clase: 'DOC', etiqueta: 'Nit', titulo: 'comentario viejo' }] : [] };
      return { refutado: false, etiqueta: 'Importante', caso: 'reproducido' };
    });
    expect(r.confirmados).toHaveLength(2);
    expect(r.conteo).toEqual({ Importante: 2, Nit: 1, Preexistente: 0 });
    expect(r.informe.split('\n')[2]).toMatch(/^\*\*2 Importante, 1 Nit, 0 Preexistente\*\*/);
    expect(r.informe).toMatch(/respuesta: ____/);
    expect(llamadas.every((l) => l.opts.agentType === 'investigador')).toBe(true);
    expect(llamadas.length).toBeLessThanOrEqual(10);
  });

  it('un hallazgo que el verificador refuta no cuenta, y el tope de verificacion se respeta y se dice', async () => {
    const muchos = Array.from({ length: 5 }, (_, i) => ({ archivo: 'a.mjs', linea: i + 1, clase: 'TRUE_BUG', etiqueta: 'Importante', titulo: `b${i}`, caso: 'c' }));
    const { r, llamadas } = await correr({ repo: '.', maxVerificar: 2, lentes: [{ key: 'unica', enfoque: 'todo' }] }, (p, o) =>
      (o.phase === 'Lentes' ? { hallazgos: muchos } : { refutado: true, etiqueta: 'Importante', caso: 'no se reproduce' }));
    expect(llamadas.filter((l) => l.opts.phase === 'Verificar')).toHaveLength(2);
    expect(r.confirmados).toHaveLength(0);
    expect(r.refutados).toHaveLength(2);
    expect(r.sinVerificar).toHaveLength(3);
    expect(r.conteo.Importante).toBe(3);   // los 3 sin verificar cuentan; los refutados no
  });
});

/**
 * reviewMd.test.mjs — REVIEW.md del repo y los de cada tipo de entregable (tanda 9, pieza 2) traen lo que pide el molde
 * del post de claude.dev del 15/10/2026 y los dos revisores los leen al arrancar.
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '..', '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

describe('REVIEW.md', () => {
  const r = leer('REVIEW.md');
  it('define las tres etiquetas, el tope de nits, las rutas a saltear, la evidencia y el resumen con el conteo', () => {
    for (const s of ['**Importante**', '**Nit**', '**Preexistente**', '3 por informe', 'Rutas que no se revisan', 'archivo y línea', 'arranca con el conteo', '2 rondas']) {
      expect(r, s).toContain(s);
    }
  });
  it('dice que NO es falla lo que Fak ya decidio (datos de la empresa en el repo, AP=H sin accion)', () => {
    expect(r).toMatch(/Datos de la empresa en el repo/);
    expect(r).toMatch(/AP=H con la acción vacía/);
  });
  it('trae la respuesta a cada hallazgo que mide el ruido', () => {
    expect(r).toMatch(/arreglado \/ rechazado \/ a propósito \/ no importa/);
  });
});

describe('docs/review por tipo de entregable', () => {
  for (const tipo of ['hojas-de-proceso', 'amfe', 'mail']) {
    it(`${tipo}: existe, apunta a su regla y trae quejas de Fak con fecha`, () => {
      const t = leer(`docs/review/${tipo}.md`);
      expect(t).toMatch(/REVIEW\.md/);
      expect(t).toMatch(/\| Qué mirar \(Importante\) \|/);
      expect((t.match(/\d{2}\/\d{2}/g) || []).length).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('los revisores lo leen', () => {
  it('el auditor y el revisor-pedido nombran REVIEW.md y docs/review, y el auditor etiqueta', () => {
    const a = leer('.claude/agents/auditor.md');
    const rp = leer('.claude/agents/revisor-pedido.md');
    for (const t of [a, rp]) { expect(t).toContain('REVIEW.md'); expect(t).toContain('docs/review/'); }
    expect(a).toMatch(/Importante \/ Nit \/ Preexistente/);
  });
});

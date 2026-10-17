/**
 * evalBanco.test.mjs — el banco de casos de resultado (tanda 9, pieza 4): el complemento chico lleva solo lo del banco,
 * las reglas entran como una skill generada sin su frontmatter, y el resumen lee el JSON de `claude plugin eval`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { armarComplemento, resumir, informe, skillDeReglas, conRuns, MANIFIESTO } from '../../scripts/_evalBanco.mjs';

const M = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));
const RAIZ = path.resolve(__dirname, '..', '..');

describe('manifiesto de bancos', () => {
  it('amfe y mail con 5 casos cada uno, todos existen con prompt y criterio, y las reglas existen', () => {
    for (const n of ['amfe', 'mail']) {
      const b = M.bancos[n];
      expect(b.casos, n).toHaveLength(5);
      for (const c of b.casos) {
        expect(fs.existsSync(path.join(RAIZ, c, 'prompt.md')), c).toBe(true);
        expect(fs.readdirSync(path.join(RAIZ, c, 'graders')).length, c).toBeGreaterThan(0);
      }
      for (const r of b.reglas) expect(fs.existsSync(path.join(RAIZ, r)), r).toBe(true);
    }
  });
  it('los bancos por skill (tanda 12): cada caso existe, cada skill existe y el brazo con lleva solo la skill', () => {
    const porSkill = Object.entries(M.bancos).filter(([n]) => !['amfe', 'mail'].includes(n));
    expect(porSkill.length).toBeGreaterThan(0);
    for (const [n, b] of porSkill) {
      expect(b.casos.length, n).toBeGreaterThanOrEqual(2);
      expect(b.reglas, n).toEqual([]);
      for (const s of b.skills) expect(fs.existsSync(path.join(RAIZ, '.claude', 'skills', s, 'SKILL.md')), s).toBe(true);
      for (const c of b.casos) {
        expect(fs.existsSync(path.join(RAIZ, c, 'prompt.md')), c).toBe(true);
        expect(fs.readdirSync(path.join(RAIZ, c, 'graders')).length, c).toBeGreaterThan(0);
      }
    }
  });
});

describe('armarComplemento', () => {
  it('pone solo las skills del banco, la skill de reglas sin frontmatter, los casos con su runs y el indicador de disparo', () => {
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'evalbanco-test-'));
    const r = armarComplemento('amfe', M.bancos.amfe, dst, { runs: 1 });
    expect(r.skills).toEqual(['amfe-domain', 'amfe-cookbook', 'reglas-amfe']);
    expect(fs.readdirSync(path.join(dst, 'skills')).sort()).toEqual(['amfe-cookbook', 'amfe-domain', 'reglas-amfe']);
    const regla = fs.readFileSync(path.join(dst, 'skills', 'reglas-amfe', 'SKILL.md'), 'utf8');
    expect(regla.startsWith('---\nname: reglas-amfe\n')).toBe(true);
    expect(regla).not.toMatch(/\npaths:/);
    expect(r.casos).toHaveLength(5);
    const p = fs.readFileSync(path.join(dst, 'evals', 'siglas-s7-o3', 'prompt.md'), 'utf8');
    expect(p).toMatch(/^runs: 1$/m);
    expect(fs.readFileSync(path.join(dst, 'evals', 'siglas-s7-o3', 'graders', 'zz-se-disparo.md'), 'utf8').startsWith(['---', 'type: tool_used', 'tool: Skill', 'min: 1', '---'].join('\n'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(dst, '.claude-plugin', 'plugin.json'), 'utf8')).skills).toBe('./skills');
  });
  it('skillDeReglas y conRuns', () => {
    expect(skillDeReglas('x', 'usa "esto"', ['---\npaths:\n  - a\n---\n# R1', '# R2'])).toBe('---\nname: reglas-x\ndescription: "usa \'esto\'"\n---\n\n# R1\n\n---\n\n# R2\n');
    expect(conRuns('---\nruns: 3\n---', null)).toBe('---\nruns: 3\n---');
  });
});

describe('resumir e informe', () => {
  const json = { costUsd: 1.2, durationSeconds: 300, cases: [
    { name: 'A', dir: 'evals/a', arms: { with: [{ score: 1, graders: [{ withOnly: true, passed: true }] }, { score: 0.5, graders: [] }], without: [{ score: 0 }, { score: 0 }] } },
    { name: 'B', dir: 'evals/b', arms: { with: [{ score: 0, error: 'boom', graders: [] }], without: [] } },
  ] };
  it('promedia por brazo, calcula la diferencia, el pase por umbral, el disparo y los errores', () => {
    const r = resumir(json, 0.7);
    expect(r.filas[0]).toMatchObject({ caso: 'A', con: 0.75, sin: 0, delta: 0.75, pasa: true, disparo: 1, errores: 0 });
    expect(r.filas[1]).toMatchObject({ caso: 'B', con: 0, sin: null, delta: null, pasa: false, errores: 1 });
  });
  it('el informe arranca con cuantos pasan', () => {
    const md = informe('amfe', resumir(json, 0.7), { fecha: '2026-10-17', umbral: 0.7, runs: 2 });
    expect(md.split('\n')[2]).toMatch(/^\*\*1 de 2 casos pasan el umbral/);
    expect(md).toMatch(/\| A \| 75 % \| 0 % \| \+75 pts \| sí \| 1 de 2 \| 0 \|/);
  });
});

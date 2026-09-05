// Tests de scripts/_lib/cerebroLint.mjs — cada check en ROJO (un cerebro con el defecto) y
// en VERDE (un cerebro sano da cero hallazgos). Los fixtures se arman en un directorio
// temporal con la misma forma que el real: <repo>/CLAUDE.md, .claude/rules, .claude/skills,
// .claude/hooks, scripts/, docs/ y <memoria>/MEMORY.md + memorias.
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  relevarCerebro, lintCerebro, resolverLink, leerFrontmatter, reglasDeTabla, slugProyecto, dirMemoriaDe,
  chequearWikilinks, chequearIndice, chequearFrontmatter, chequearRutas, chequearTablasClaude, chequearCerradas, chequearGlobales,
  resumir, LIMITES,
} from '../../scripts/_lib/cerebroLint.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cerebro-lint-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;

const fm = ({ name, description = 'desc', type = 'feedback', metadata = true }) => metadata
  ? `---\nname: ${name}\ndescription: "${description}"\nmetadata:\n  type: ${type}\n---\n`
  : `---\nname: ${name}\ndescription: ${description}\ntype: ${type}\n---\n`;

/** Arma un cerebro de prueba y lo releva. Todo tiene defaults sanos: lo que se pasa lo sobreescribe. */
function armar({ memorias, indice, reglas, skills = ['arb-operar'], hooks = ['cad-guard.sh'], archivos = ['scripts/_backup.mjs', 'docs/GUIA.md'], claude, globales = null, archivadas = [] } = {}) {
  const base = path.join(TMP, `c${n++}`);
  const repo = path.join(base, 'repo');
  const memoria = path.join(base, 'memory');
  fs.mkdirSync(path.join(repo, '.claude', 'rules'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.claude', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.mkdirSync(memoria, { recursive: true });
  for (const s of skills) fs.mkdirSync(path.join(repo, '.claude', 'skills', s), { recursive: true });
  for (const h of hooks) fs.writeFileSync(path.join(repo, '.claude', 'hooks', h), '#!/bin/bash\n');
  for (const a of archivos) { fs.mkdirSync(path.dirname(path.join(repo, a)), { recursive: true }); fs.writeFileSync(path.join(repo, a), '// x\n'); }
  const reglasDef = reglas ?? { 'core-prohibiciones': { paths: false }, 'amfe': { paths: true } };
  for (const [stem, r] of Object.entries(reglasDef)) {
    const cab = r.paths ? `---\npaths:\n  - "modules/**"\n---\n` : '';
    fs.writeFileSync(path.join(repo, '.claude', 'rules', `${stem}.md`), `${cab}# ${stem}\n${r.texto ?? ''}\n`);
  }
  const memDef = memorias ?? {
    feedback_uno: { texto: 'Ver [[reference_dos]] y [[dos]] y skill `arb-operar`.' },
    reference_dos: { texto: 'Corre `scripts/_backup.mjs`; regla `amfe.md`; hook `cad-guard.sh`; memoria `uno`.' },
  };
  for (const [stem, m] of Object.entries(memDef)) {
    fs.writeFileSync(path.join(memoria, `${stem}.md`), (m.fm ?? fm({ name: stem, type: stem.split('_')[0] })) + (m.texto ?? ''));
  }
  if (archivadas.length) {
    fs.mkdirSync(path.join(memoria, '_archive_x'), { recursive: true });
    for (const a of archivadas) fs.writeFileSync(path.join(memoria, '_archive_x', `${a}.md`), fm({ name: a }) + 'vieja');
  }
  fs.writeFileSync(path.join(memoria, 'MEMORY.md'), indice ?? `# Memory Index\n\n## A\n${Object.keys(memDef).map((s) => `- ${s}.md — gancho`).join('\n')}\n`);
  const sinPaths = Object.entries(reglasDef).filter(([, r]) => !r.paths).map(([s]) => `| \`${s}.md\` | x |`).join('\n');
  const conPaths = Object.entries(reglasDef).filter(([, r]) => r.paths).map(([s]) => `| \`${s}.md\` | x |`).join('\n');
  fs.writeFileSync(path.join(repo, 'CLAUDE.md'), claude ?? `# X\n\n| Siempre cargadas | Contenido |\n|---|---|\n${sinPaths}\n\n| Con \`paths:\` (cargan al tocar) | Ambito |\n|---|---|\n${conPaths}\n\nTexto con \`docs/GUIA.md\`.\n`);
  fs.writeFileSync(path.join(repo, 'docs', 'LECCIONES_APRENDIDAS.md'), '# L\n- memoria `dos`.\n');
  let g = null;
  if (globales) {
    g = path.join(base, 'global');
    fs.mkdirSync(path.join(g, 'rules'), { recursive: true });
    for (const [stem, texto] of Object.entries(globales)) fs.writeFileSync(path.join(g, 'rules', `${stem}.md`), texto);
  }
  return relevarCerebro({ repo, memoria, globales: g });
}
const de = (hs, check) => hs.filter((h) => h.check === check);

describe('cerebroLint — VERDE: un cerebro sano no tiene hallazgos', () => {
  it('links por archivo, por prefijo, regla, skill, hook, memoria `x`, rutas existentes y tablas en orden', () => {
    const c = armar();
    expect(lintCerebro(c)).toEqual([]);
  });
  it('resolverLink: por name: del frontmatter, por prefijo, regla, skill; [[:space:]] no es un link', () => {
    const c = armar({ memorias: { project_tres: { fm: fm({ name: 'tres_nombre', type: 'project' }), texto: 'x [[:space:]] y' } } });
    expect(resolverLink('tres_nombre', c)).toBe('memoria');
    expect(resolverLink('tres', c)).toBe('memoria');
    expect(resolverLink('project_tres', c)).toBe('memoria');
    expect(resolverLink('amfe', c)).toBe('regla');
    expect(resolverLink('arb-operar', c)).toBe('skill');
    expect(resolverLink('nada', c)).toBe(null);
    expect(de(lintCerebro(c), 'wikilinks')).toEqual([]);
  });
  it('slug y carpeta de memoria de un repo', () => {
    expect(slugProyecto('C:\\Dev\\BarackMercosul')).toBe('C--Dev-BarackMercosul');
    expect(dirMemoriaDe('C:\\Dev\\BarackMercosul', 'C:\\Users\\f')).toBe(path.join('C:\\Users\\f', '.claude', 'projects', 'C--Dev-BarackMercosul', 'memory'));
  });
  it('leerFrontmatter: type arriba o bajo metadata, comillas, paths:', () => {
    expect(leerFrontmatter(fm({ name: 'a', type: 'project' })).type).toBe('project');
    expect(leerFrontmatter(fm({ name: 'a', type: 'user', metadata: false })).type).toBe('user');
    expect(leerFrontmatter('---\nname: r\npaths:\n  - "x/**"\n---\n').conPaths).toBe(true);
    expect(leerFrontmatter('sin frontmatter')).toBe(null);
  });
});

describe('cerebroLint — ROJO: cada defecto se ve', () => {
  it('wikilink roto es falta; hacia una memoria archivada es aviso', () => {
    const c = armar({ memorias: { feedback_uno: { texto: '[[no_existe]] y [[vieja]]' } }, archivadas: ['project_vieja'] });
    const hs = chequearWikilinks(c);
    expect(hs.map((h) => h.nivel).sort()).toEqual(['aviso', 'falta']);
    expect(hs.find((h) => h.nivel === 'falta').detalle).toMatch(/\[\[no_existe\]\]/);
    expect(hs.find((h) => h.nivel === 'aviso').detalle).toMatch(/ARCHIVADA/);
  });
  it('indice: memoria sin puntero, puntero fantasma, puntero a archivada', () => {
    const c = armar({
      memorias: { feedback_uno: {}, reference_dos: {} },
      indice: '# I\n> CLAUDE.md y MEMORY.md tienen CRLF; ver README.md\n- feedback_uno.md — x · project_fantasma.md — y · project_vieja.md — z\n',
      archivadas: ['project_vieja'],
    });
    const hs = chequearIndice(c);
    expect(hs.some((h) => h.archivo === 'memory/reference_dos.md' && /sin puntero/.test(h.detalle))).toBe(true);
    expect(hs.some((h) => /project_fantasma\.md, que no existe/.test(h.detalle))).toBe(true);
    expect(hs.some((h) => /project_vieja\.md, que esta en _archive/.test(h.detalle))).toBe(true);
    expect(hs.every((h) => h.nivel === 'falta')).toBe(true);
    expect(hs.some((h) => /cita (CLAUDE|README|MEMORY)\.md/.test(h.detalle))).toBe(false);   // no son punteros
    expect(hs).toHaveLength(3);
  });
  it('indice: aviso a 22 KB o 180 lineas, falta a 25 KB o 200', () => {
    const linea = (i) => `- feedback_uno.md — gancho ${i}`;
    const largo = (k) => `# I\n${Array.from({ length: k }, (_, i) => linea(i)).join('\n')}\n`;
    expect(chequearIndice(armar({ memorias: { feedback_uno: {} }, indice: largo(185) })).map((h) => h.nivel)).toEqual(['aviso']);
    expect(chequearIndice(armar({ memorias: { feedback_uno: {} }, indice: largo(205) })).map((h) => h.nivel)).toEqual(['falta']);
    const gordo = `# I\n- feedback_uno.md — ${'x'.repeat(LIMITES.indice_tope_bytes)}\n`;
    expect(chequearIndice(armar({ memorias: { feedback_uno: {} }, indice: gordo })).map((h) => h.nivel)).toEqual(['falta']);
  });
  it('frontmatter: sin ---, sin description, type invalido (falta); name distinto del archivo (aviso)', () => {
    const c = armar({ memorias: {
      feedback_a: { fm: '' , texto: 'sin frontmatter' },
      feedback_b: { fm: '---\nname: feedback_b\nmetadata:\n  type: feedback\n---\n' },
      feedback_c: { fm: fm({ name: 'feedback_c', type: 'nota' }) },
      feedback_d: { fm: fm({ name: 'otro_nombre' }) },
    } });
    const hs = chequearFrontmatter(c);
    expect(hs.find((h) => h.archivo === 'memory/feedback_a.md').detalle).toMatch(/sin frontmatter/);
    expect(hs.find((h) => h.archivo === 'memory/feedback_b.md').detalle).toMatch(/sin description/);
    expect(hs.find((h) => h.archivo === 'memory/feedback_c.md').detalle).toMatch(/fuera de/);
    const d = hs.find((h) => h.archivo === 'memory/feedback_d.md');
    expect(d.nivel).toBe('aviso');
    expect(d.detalle).toMatch(/otro_nombre/);
  });
  it('rutas: script inexistente (falta), mudado a scripts/_archive (aviso), regla/skill/hook/memoria inexistentes, lista de memorias', () => {
    const c = armar({
      memorias: {
        feedback_uno: { texto: 'Corre `scripts/_noExiste.mjs --apply`, `scripts/_viejo.mjs`, regla `nada.md`, skill `inventado`, hook `x-guard.sh`, memoria `perdida`. Memorias `dos`, `otra_perdida` y `mail_corto`.' },
        reference_dos: {},
        feedback_mail_corto_como_los_de_fak: {},
      },
      archivos: ['scripts/_archive/_viejo.mjs'],
    });
    const hs = chequearRutas(c);
    const det = hs.map((h) => `${h.nivel}:${h.detalle}`).join('\n');
    expect(det).toMatch(/falta:`scripts\/_noExiste\.mjs` no existe/);
    expect(det).toMatch(/aviso:`scripts\/_viejo\.mjs` se mudo a scripts\/_archive/);
    expect(det).toMatch(/falta:regla `nada\.md` no existe/);
    expect(det).toMatch(/falta:skill `inventado` no existe/);
    expect(det).toMatch(/falta:hook `x-guard\.sh` no existe/);
    expect(det).toMatch(/falta:memoria `perdida` no existe/);
    expect(det).toMatch(/falta:memoria `otra_perdida` no existe/);   // segundo item de la lista
    expect(det).not.toMatch(/`dos`|`mail_corto`/);                    // por prefijo y por handle unico
  });
  it('resolverLink: un handle que esta contenido en UNA sola memoria resuelve; en dos, no', () => {
    const c = armar({ memorias: { feedback_mi_medicion_no_le_gana_a_la_pieza_en_la_mano: {}, feedback_mail_corto_como_los_de_fak: {}, feedback_mail_dice_que_mando: {} } });
    expect(resolverLink('pieza_en_la_mano', c)).toBe('memoria');
    expect(resolverLink('mail_corto', c)).toBe('memoria');
    expect(resolverLink('feedback_mail', c)).toBe(null);            // lo contienen dos
    expect(resolverLink('mano', c)).toBe(null);                      // demasiado corto para un handle
  });
  it('tablas de CLAUDE.md: regla con paths en "siempre", regla sin paths en la otra, faltante y fantasma', () => {
    const claude = '# X\n\n| Siempre cargadas | Contenido |\n|---|---|\n| `amfe.md` | mal |\n| `fantasma.md` | no existe |\n\n| Con `paths:` (cargan al tocar) | Ambito |\n|---|---|\n| `core-prohibiciones.md` | mal |\n';
    const c = armar({ claude, reglas: { 'core-prohibiciones': { paths: false }, amfe: { paths: true }, testing: { paths: true } } });
    const det = chequearTablasClaude(c).map((h) => h.detalle).join('\n');
    expect(det).toMatch(/`amfe\.md` figura como "siempre cargada" pero tiene paths/);
    expect(det).toMatch(/`core-prohibiciones\.md` figura en la tabla de paths: pero no tiene paths/);
    expect(det).toMatch(/`testing\.md` no figura en ninguna/);
    expect(det).toMatch(/cita `fantasma\.md`, que no existe/);
    expect(reglasDeTabla(claude, /^\|\s*Siempre cargadas/)).toEqual(['amfe', 'fantasma']);
    expect(reglasDeTabla('sin tablas', /^\|\s*Siempre cargadas/)).toBe(null);
  });
  it('cerradas: CERRADO en el gancho o la description es aviso; "no reenviar"/"backlog" la salvan; "lo cerrado" en minuscula no cuenta', () => {
    const c = armar({
      memorias: {
        project_a: { fm: fm({ name: 'project_a', type: 'project' }) },
        project_b: { fm: fm({ name: 'project_b', type: 'project', description: 'TAREA CERRADA 25/08, no reenviar los 3 viejos' }) },
        project_c: { fm: fm({ name: 'project_c', type: 'project' }) },
        project_d: { fm: fm({ name: 'project_d', type: 'project', description: 'lo cerrado se archiva en la biblioteca' }) },
        project_e: { fm: fm({ name: 'project_e', type: 'project', description: 'CERRADO 2026-08-30 — la rama fue borrada' }) },
      },
      indice: '# I\n- project_a.md — 🟢 CI CERRADO 30/08; backlog: e2e · project_b.md — x · project_c.md — 🟡 abierta · project_d.md — cola · project_e.md — 🟢 CERRADO 30/08\n',
    });
    const hs = chequearCerradas(c);
    expect(hs.map((h) => h.archivo)).toEqual(['memory/project_e.md']);
    expect(hs[0].nivel).toBe('aviso');
  });
  it('globales: una regla de ~/.claude/rules que duplica una del repo es aviso; una propia no', () => {
    const c = armar({ globales: { amfe: '# copia', 'solo-global': '# propia' } });
    const hs = chequearGlobales(c);
    expect(hs).toHaveLength(1);
    expect(hs[0].archivo).toBe('~/.claude/rules/amfe.md');
    expect(hs[0].nivel).toBe('aviso');
  });
  it('resumir: falta manda; solo avisos es aviso; nada es ok', () => {
    expect(resumir([]).estado).toBe('ok');
    expect(resumir([{ check: 'x', nivel: 'aviso', archivo: 'a', detalle: 'd' }]).estado).toBe('aviso');
    const r = resumir([{ check: 'wikilinks', nivel: 'falta', archivo: 'a', detalle: 'd' }, { check: 'x', nivel: 'aviso', archivo: 'a', detalle: 'd' }]);
    expect(r.estado).toBe('falta');
    expect(r.detalle).toMatch(/1 roto\(s\) \(wikilinks 1\) \+ 1 aviso/);
  });
});

// Auditoria independiente del 05/09 (Ola 3): dos gaps latentes, 0 ocurrencias en el corpus real.
describe('cerebroLint — BOM y bloques de codigo (auditoria 05/09)', () => {
  it('VERDE: una memoria con BOM UTF-8 adelante del frontmatter se lee entera (name, description, type)', () => {
    const conBom = '\uFEFF' + fm({ name: 'feedback_uno' });
    const c = armar({ memorias: { feedback_uno: { fm: conBom, texto: 'ok' }, reference_dos: {} } });
    expect(de(lintCerebro(c), 'frontmatter')).toEqual([]);
    expect(leerFrontmatter('\uFEFF---\nname: x\ndescription: d\ntype: feedback\n---\n')).toMatchObject({ name: 'x', type: 'feedback' });
  });
  it('un [[wikilink]] de EJEMPLO dentro de ``` no es un link; el mismo texto afuera del bloque si rompe', () => {
    const ejemplo = 'Asi se escribe un link:\n```md\nVer [[no_existe_ejemplo]] al final.\n```\n';
    const c = armar({ memorias: { feedback_uno: { texto: ejemplo }, reference_dos: {} } });
    expect(de(lintCerebro(c), 'wikilinks')).toEqual([]);
    const c2 = armar({ memorias: { feedback_uno: { texto: 'Ver [[no_existe_ejemplo]] al final.' }, reference_dos: {} } });
    expect(de(lintCerebro(c2), 'wikilinks')).toHaveLength(1);
  });
});

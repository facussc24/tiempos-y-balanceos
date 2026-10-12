// __tests__/scripts/mejorasPublicar.test.mjs
// @vitest-environment node
/**
 * tools/claude-area/mejoras/publicar.mjs (Fak, 12/10/2026): las mejoras van a la nube de Ingenieria para que el Claude
 * de otra persona las ofrezca y le instale solo las que elija. Se prueba sobre un paquete chico armado aca.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { armarMejoras, publicar, claudeMdPara, MARCA_INICIO, MARCA_FIN, CARPETA, carpetaDe } from '../../tools/claude-area/mejoras/publicar.mjs';

const persona = { clave: 'carlos', nombre: 'Carlos Baptista', nombre_corto: 'Carlos', puesto: 'Gerente de Ingenieria', mail: 'cbaptista@barackmercosul.com', conocimiento: ['comun', 'ingenieria'] };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let raiz;
beforeAll(() => { raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'mejoras-')); });
afterAll(() => { try { fs.rmSync(raiz, { recursive: true, force: true }); } catch { /* temporal */ } });

function paquete(nombre, { memoriaExtra = '' } = {}) {
  const p = path.join(raiz, nombre);
  const w = (rel, t) => { const f = path.join(p, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
  w('memoria/MEMORY.md', '# Memoria\n- reference_arb.md — el arb\n');
  w('memoria/feedback_principios_de_trabajo.md', 'principios\n');
  w('memoria/reference_arb.md', `El arb es el ERP.${memoriaExtra}\n`);
  w('skills/arb-operar/SKILL.md', '---\nname: arb-operar\ndescription: Operar el ERP arb por teclado. Usar cuando haya que cargar.\n---\nhoy\n');
  w('skills/leer-planos/SKILL.md', '---\nname: leer-planos\ndescription: Leer planos.\n---\nigual\n');
  w('agentes/buscador.md', 'buscador\n');
  w('conocimiento/comun/INDICE.md', 'indice\n');
  return p;
}
function anterior(nombre = 'anterior') {
  const p = path.join(raiz, nombre);
  const w = (rel, t) => { const f = path.join(p, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
  w('memoria/reference_arb.md', 'viejo\n');
  w('memoria/user_quien_es.md', 'el usuario es otra persona\n');
  w('skills/arb-operar/SKILL.md', 'viejo\n');
  w('skills/leer-planos/SKILL.md', '---\nname: leer-planos\ndescription: Leer planos.\n---\nigual\n');
  w('subagentes/investigador.md', 'inv\n');
  return p;
}

describe('mejoras para otra persona, por la nube', () => {
  it('arma 4 mejoras; solo ofrece las habilidades que cambiaron; lo viejo para sacar va solo por su huella', () => {
    const ms = armarMejoras({ persona, paquete: paquete('p1'), anterior: anterior(), fecha: '12/10/2026' });
    expect(ms.map((m) => m.id)).toEqual(['01-tu-claude-sabe-que-sos-vos', '02-habilidades-al-dia', '03-ayudante-buscador', '04-fichas-de-la-empresa']);
    const sk = ms[1].archivos.map((a) => a.destino);
    expect(sk).toEqual(['SKILLS/arb-operar/SKILL.md']);                      // leer-planos sigue igual: no se ofrece
    expect(ms[1].archivos[0].conocidos).toEqual([sha('viejo\n')]);            // la version vieja nuestra se reconoce
    expect(ms[1].detalle.join('\n')).toMatch(/arb-operar\*\*: Operar el ERP arb por teclado\./);
    expect(ms[0].reemplaza).toEqual([{ en: 'MEMORIA', sha256: sha('el usuario es otra persona\n') }]);
  });

  it('el CLAUDE.md lleva las dos marcas, el nombre de la persona y ningun hueco sin llenar', () => {
    const t = claudeMdPara(persona, '12/10/2026');
    expect(t.startsWith(MARCA_INICIO)).toBe(true);
    expect(t.trimEnd().endsWith(MARCA_FIN)).toBe(true);
    expect(t).toMatch(/Trabajás con \*\*Carlos Baptista\*\*, Gerente de Ingenieria/);
    expect(t).not.toMatch(/\{\{|direccion|DESINSTALAR|herramientas -->/);
  });

  it('publica: el catalogo dice la huella de cada archivo escrito, y la carpeta anterior no se borra', () => {
    const out = path.join(raiz, 'nube');
    const ms = armarMejoras({ persona, paquete: paquete('p2'), anterior: anterior(), fecha: '12/10/2026' });
    expect(publicar({ persona, mejoras: ms, out, version: 'v1', aplicar: true }).ok).toBe(true);
    const r2 = publicar({ persona, mejoras: ms, out, version: 'v2', aplicar: true });
    const cat = JSON.parse(fs.readFileSync(path.join(r2.carpeta, 'catalogo.json'), 'utf8'));
    expect(cat.version).toBe('v2');
    for (const m of cat.mejoras) for (const a of m.archivos) expect(sha(fs.readFileSync(path.join(r2.carpeta, ...a.origen.split('/'))))).toBe(a.sha256);
    expect(fs.existsSync(path.join(r2.carpeta, 'LEEME - para el Claude que lo lee.md'))).toBe(true);
    expect(fs.readdirSync(path.join(out, CARPETA)).filter((n) => n.startsWith(`${persona.nombre}.anterior-`))).toHaveLength(1);
  });

  it('rojo: si algo de Facundo se cuela (su apodo), no se publica nada', () => {
    const out = path.join(raiz, 'nube-roja');
    const ms = armarMejoras({ persona, paquete: paquete('p3', { memoriaExtra: ' Lo pidio Fak.' }), anterior: anterior(), fecha: '12/10/2026' });
    const r = publicar({ persona, mejoras: ms, out, version: 'v1', aplicar: true });
    expect(r.problemas.length).toBeGreaterThan(0);
    expect(fs.existsSync(carpetaDe(out, persona))).toBe(false);
  });

  it('una actualizacion reconoce lo que se instalo con la version anterior (no parece cambiado por la persona)', () => {
    const out = path.join(raiz, 'nube-upd');
    const v1 = armarMejoras({ persona, paquete: paquete('u1'), anterior: anterior(), fecha: '12/10/2026' });
    publicar({ persona, mejoras: v1, out, version: '2026-10-12', aplicar: true });
    const v2 = armarMejoras({ persona, paquete: paquete('u2', { memoriaExtra: ' Y algo nuevo.' }), anterior: anterior(), fecha: '13/10/2026' });
    const r2 = publicar({ persona, mejoras: v2, out, version: '2026-10-13', aplicar: true });   // otro dia
    const cat = JSON.parse(fs.readFileSync(path.join(r2.carpeta, 'catalogo.json'), 'utf8'));
    const ref = cat.mejoras[0].archivos.find((a) => a.destino === 'MEMORIA/reference_arb.md');
    expect(ref.conocidos).toContain(sha('El arb es el ERP.\n'));   // lo de la v1
    expect(ref.conocidos).toContain(sha('viejo\n'));               // y lo del 07/10
    const ant = JSON.parse(fs.readFileSync(path.join(out, CARPETA, fs.readdirSync(path.join(out, CARPETA)).find((n) => n.includes('.anterior-')), 'catalogo.json'), 'utf8'));
    expect(cat.mejoras[0].version).not.toBe(ant.mejoras[0].version);   // cambio algo: se ofrece de nuevo
    expect(cat.mejoras[2].version).toBe(ant.mejoras[2].version);       // los ayudantes no cambiaron: otro dia, misma version
    // el mismo dia, con algo cambiado, tambien se ofrece (antes la version era la fecha y no)
    const r3 = publicar({ persona, mejoras: armarMejoras({ persona, paquete: paquete('u3', { memoriaExtra: ' Otra cosa.' }), anterior: anterior(), fecha: '13/10/2026' }), out, version: '2026-10-13', aplicar: true });
    const cat3 = JSON.parse(fs.readFileSync(path.join(r3.carpeta, 'catalogo.json'), 'utf8'));
    expect(cat3.mejoras[0].version).not.toBe(cat.mejoras[0].version);
  });

  it('tres publicaciones seguidas (mismo segundo) no chocan al guardar la anterior', () => {
    const out = path.join(raiz, 'nube-seg');
    const ms = armarMejoras({ persona, paquete: paquete('s1'), fecha: 'x' });
    for (const v of ['v1', 'v2', 'v3']) expect(publicar({ persona, mejoras: ms, out, version: v, aplicar: true }).ok).toBe(true);
    expect(fs.readdirSync(path.join(out, CARPETA)).filter((n) => n.includes('.armando-'))).toHaveLength(0);
  });

  it('cada persona tiene su carpeta: publicar para Pedro no toca la de Carlos', () => {
    const out = path.join(raiz, 'nube-otra');
    const ms = armarMejoras({ persona, paquete: paquete('o1'), fecha: 'x' });
    const rc = publicar({ persona, mejoras: ms, out, version: 'v1', aplicar: true });
    const antes = fs.readFileSync(path.join(rc.carpeta, 'catalogo.json'));
    const pedro = { ...persona, clave: 'pedro', nombre: 'Pedro Ergo', nombre_corto: 'Pedro', mail: 'paergo@barackmercosul.com' };
    const rp = publicar({ persona: pedro, mejoras: ms, out, version: 'v2', aplicar: true });
    expect(rp.ok).toBe(true);
    expect(rp.carpeta).not.toBe(rc.carpeta);
    expect(fs.readFileSync(path.join(rc.carpeta, 'catalogo.json'))).toEqual(antes);
    expect(fs.readdirSync(path.join(out, CARPETA)).filter((n) => !n.includes('.'))).toEqual(['Carlos Baptista', 'Pedro Ergo']);
  });

  it('rojo: si alguien deja en la carpeta de Carlos un catalogo de otra persona, no se publica encima', () => {
    const out = path.join(raiz, 'nube-mezcla');
    const ms = armarMejoras({ persona, paquete: paquete('o2'), fecha: 'x' });
    const c = carpetaDe(out, persona);
    fs.mkdirSync(c, { recursive: true });
    fs.writeFileSync(path.join(c, 'catalogo.json'), JSON.stringify({ para: { nombre: 'Pedro Ergo' }, mejoras: [] }));
    expect(publicar({ persona, mejoras: ms, out, version: 'v1', aplicar: true }).problemas.join('\n')).toMatch(/carpeta de Pedro Ergo/);
  });

  it('un destino fuera de las cuatro carpetas no se publica', () => {
    const ms = armarMejoras({ persona, paquete: paquete('d1'), fecha: 'x' });
    ms[2].archivos.push({ destino: 'AGENTES/../../Startup/x.cmd', contenido: Buffer.from('x'), conocidos: [] });
    expect(publicar({ persona, mejoras: ms, out: path.join(raiz, 'nube-d'), version: 'v1' }).problemas.join('\n')).toMatch(/destino que no se puede publicar/);
  });

  it('las memorias viejas de las subcarpetas _archive tambien se sacan por su huella', () => {
    const ant = anterior('anterior-a');
    fs.mkdirSync(path.join(ant, 'memoria', '_archive_x'), { recursive: true });
    fs.writeFileSync(path.join(ant, 'memoria', '_archive_x', 'viejo.md'), 'archivada\n');
    const ms = armarMejoras({ persona, paquete: paquete('a1'), anterior: ant, fecha: 'x' });
    expect(ms[0].reemplaza.map((r) => r.sha256)).toContain(sha('archivada\n'));
  });

  it('la ficha de habilidades: descripcion plegada (>) y las que solo cambiaron por la limpieza', () => {
    const p = paquete('f1');
    fs.writeFileSync(path.join(p, 'skills', 'leer-planos', 'SKILL.md'), '---\nname: leer-planos\ndescription: >\n  Leer planos de cliente.\n  Usar cuando.\n---\nla persona aprueba\n');
    const ant = anterior('anterior-f');
    fs.writeFileSync(path.join(ant, 'skills', 'leer-planos', 'SKILL.md'), '---\nname: leer-planos\ndescription: >\n  Leer planos de cliente.\n  Usar cuando.\n---\nFak aprueba\n');
    const det = armarMejoras({ persona, paquete: p, anterior: ant, fecha: 'x' })[1].detalle.join('\n');
    expect(det).toMatch(/\*\*leer-planos\*\*: Leer planos de cliente\./);
    expect(det).not.toMatch(/\*\*: >/);
    expect(det).toMatch(/sin el mail, la PC ni las copias fijas de Facundo[\s\S]*leer-planos/);
  });

  it('el CLAUDE.md no da por hechos los ayudantes ni las fichas, y el arb no queda bajo los ayudantes', () => {
    const t = claudeMdPara(persona, '12/10/2026');
    expect(t).toContain('Tus ayudantes son los que haya en `~\\.claude\\agents\\` (con la mejora 3 son tres)');
    expect(t).toMatch(/Si existe `~\\\.claude\\fichas-barack`/);
    expect(t.indexOf('**arb:**')).toBeLessThan(t.indexOf('## Tus ayudantes'));
    expect(t).toMatch(/programas \(`python scripts/);
  });

  it('en seco no escribe nada', () => {
    const out = path.join(raiz, 'nube-seca');
    const r = publicar({ persona, mejoras: armarMejoras({ persona, paquete: paquete('p4'), fecha: 'x' }), out, version: 'v1' });
    expect(r).toMatchObject({ ok: true, seco: true });
    expect(fs.existsSync(out)).toBe(false);
  });
});

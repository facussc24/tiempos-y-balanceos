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
import { armarMejoras, publicar, claudeMdPara, MARCA_INICIO, MARCA_FIN, CARPETA } from '../../tools/claude-area/mejoras/publicar.mjs';

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
function anterior() {
  const p = path.join(raiz, 'anterior');
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
    expect(fs.readdirSync(out).filter((n) => n.startsWith(`${CARPETA}.anterior-`))).toHaveLength(1);
  });

  it('rojo: si algo de Facundo se cuela (su apodo), no se publica nada', () => {
    const out = path.join(raiz, 'nube-roja');
    const ms = armarMejoras({ persona, paquete: paquete('p3', { memoriaExtra: ' Lo pidio Fak.' }), anterior: anterior(), fecha: '12/10/2026' });
    const r = publicar({ persona, mejoras: ms, out, version: 'v1', aplicar: true });
    expect(r.problemas.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(out, CARPETA))).toBe(false);
  });

  it('en seco no escribe nada', () => {
    const out = path.join(raiz, 'nube-seca');
    const r = publicar({ persona, mejoras: armarMejoras({ persona, paquete: paquete('p4'), fecha: 'x' }), out, version: 'v1' });
    expect(r).toMatchObject({ ok: true, seco: true });
    expect(fs.existsSync(out)).toBe(false);
  });
});

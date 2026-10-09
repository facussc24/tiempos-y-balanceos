// @vitest-environment node
/**
 * Tests de las propuestas de mejora de skills: lo puro (scripts/_lib/propuestasSkills.mjs) y la pasada entera
 * (`correr` de scripts/_propuestasSkills.mjs) con un cliente de la API FALSO y una carpeta de repo temporal.
 *
 * Las reglas que se prueban son las de la casa, no gustos: el modelo propone con DOS citas textuales y el
 * codigo las verifica contra el texto que de verdad se mando; una cita inventada, un numero que el dossier no
 * tiene o un SKILL.md que cambio mientras se revisaba tiran la propuesta; el refutador que no miro una
 * propuesta la descarta; y NADA escribe fuera de la carpeta de propuestas (ni en `.claude/skills`).
 * Sin red, sin .env.local, sin los transcripts de verdad: tiene que pasar en el CI.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../../scripts/_lib/propuestasSkills.mjs';
import { correr, porPrioridad } from '../../scripts/_propuestasSkills.mjs';
import { leerLedger } from '../../scripts/_lib/claudeApi.mjs';

const RAIZ_REPO = path.resolve(fileURLToPath(import.meta.url), '../../..');
const NO_ES = ['<task-notification', '<system-reminder', 'Stop hook feedback', '[Image:'];

const ARCHIVOS_NUEVOS = ['scripts/_lib/transcriptsFak.mjs', 'scripts/_lib/propuestasSkills.mjs', 'scripts/_propuestasSkills.mjs', 'scripts/_lib/disparoSkills.mjs', 'scripts/_pruebaDisparoSkills.mjs'];

let dir;
const VARIABLES = ['BARACK_PROPUESTAS_DIR', 'BARACK_API_DIR'];
const guardadas = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'propuestas-test-'));
  process.env.BARACK_API_DIR = dir; // el ledger de gasto de los tests cae en la carpeta temporal (la puerta de escritura de la noche lo exige)
});
afterEach(() => {
  for (const v of VARIABLES) { if (guardadas[v] === undefined) delete process.env[v]; else process.env[v] = guardadas[v]; }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

const SKILL_UNO = `---
name: uno
description: Primer skill de prueba. Usar cuando haya que probar propuestas de mejora.
---

# Uno

Nunca cargar el consumo sin la planilla oficial de Mesa de Corte.
La merma maxima es del 5 por ciento segun la planilla.
Los detalles estan en \`scripts/_lib/muerta.mjs\` y en \`scripts/_lib/viva.mjs\`.

## Cierre

Avisar a Fak cuando termine la carga.
`;

/** Un repo chico: dos skills, dos reglas (una con frontmatter), lecciones y un script que existe. */
function armarRepo(extra = {}) {
  const w = (rel, texto) => { const r = path.join(dir, rel); fs.mkdirSync(path.dirname(r), { recursive: true }); fs.writeFileSync(r, texto, 'utf8'); return r; };
  const uno = w('raiz/.claude/skills/uno/SKILL.md', extra.skillUno ?? SKILL_UNO);
  w('raiz/.claude/skills/dos/SKILL.md', '---\nname: dos\ndescription: Segundo skill, sin disparo\n---\n\n# Dos\n\nNada que ver.\n');
  w('raiz/.claude/skills/vacia/notas.txt', 'esta carpeta no tiene SKILL.md');
  w('raiz/.claude/rules/regla-a.md', '---\ndescription: La regla A con frontmatter\npaths:\n  - "scripts/**"\n---\n\n# Regla A: no inventar datos\n\ncuerpo\n');
  w('raiz/.claude/rules/regla-b.md', '# Regla B sin frontmatter\n\ncuerpo\n');
  w('raiz/scripts/_lib/viva.mjs', '// existe\n');
  w('raiz/docs/LECCIONES_APRENDIDAS.md', '# Lecciones\n\n- **08/10 — La planilla manda**: el consumo del vinilo sale de la planilla de Mesa de Corte; graduado al skill `uno` y a la regla.\n- Otra linea que no nombra nada.\n');
  return { raiz: path.join(dir, 'raiz'), uno };
}

const carga = (skill, dia, previo, siguientes = []) => ({ skill, nombre: skill, fecha: `2026-10-${String(dia).padStart(2, '0')}T10:00:00.000Z`, sesion: `sesion-${dia}-abcdef`, mensajeAnterior: previo, mismoTurno: true, siguientes });

describe('propuestasSkills · frontmatter y lectura', () => {
  it('parsea una linea, comillas, bloques plegados (>) y literales (|), continuaciones y listas anidadas', () => {
    const fm = P.parsearFrontmatter([
      '---', 'name: cad-design', 'description: >', '  Diseño y modificacion de piezas 3D.', '  Usar cuando Fak pida modelar.', '', '  Segundo parrafo.',
      'user-invocable: false', 'titulo: "Con: dos puntos y \\"comillas\\""', "otro: 'it''s'", 'literal: |', '  linea 1', '  linea 2',
      'paths:', '  - "scripts/**"', '  - "docs/**"', 'larga: texto que sigue', '  en la linea de abajo', '---', '', '# Cuerpo',
    ].join('\n'));
    expect(fm.tieneFrontmatter).toBe(true);
    expect(fm.campos.name).toBe('cad-design');
    expect(fm.campos.description).toBe('Diseño y modificacion de piezas 3D. Usar cuando Fak pida modelar.\nSegundo parrafo.');
    expect(fm.campos['user-invocable']).toBe('false');
    expect(fm.campos.titulo).toBe('Con: dos puntos y "comillas"');
    expect(fm.campos.otro).toBe("it's");
    expect(fm.campos.literal).toBe('linea 1\nlinea 2');
    expect(fm.campos.paths).toContain('scripts/**');
    expect(fm.campos.larga).toBe('texto que sigue en la linea de abajo');
    expect(fm.cuerpo.trim()).toBe('# Cuerpo');
  });

  it('sin frontmatter devuelve el texto entero; con BOM y CRLF tambien lee', () => {
    expect(P.parsearFrontmatter('# solo cuerpo')).toMatchObject({ tieneFrontmatter: false, cuerpo: '# solo cuerpo' });
    const fm = P.parsearFrontmatter('\uFEFF---\r\nname: x\r\ndescription: hola\r\n---\r\ncuerpo');
    expect(fm.campos).toMatchObject({ name: 'x', description: 'hola' });
  });

  it('los skills REALES del repo se leen con description (ninguna queda en ">")', () => {
    const skills = P.leerSkills({ raiz: RAIZ_REPO });
    expect(skills.length).toBeGreaterThan(10);
    for (const s of skills) {
      expect(s.description, s.nombre).not.toBe('>');
      expect(s.description.length, s.nombre).toBeGreaterThan(20);
    }
    expect(skills.find((s) => s.nombre === 'cad-design').description).toMatch(/^Diseño y modificación/);
  });

  it('leerSkills: saltea carpetas sin SKILL.md, calcula KB, tokens y hash', () => {
    const { raiz } = armarRepo();
    const skills = P.leerSkills({ raiz });
    expect(skills.map((s) => s.nombre)).toEqual(['dos', 'uno']);
    const uno = skills.find((s) => s.nombre === 'uno');
    expect(uno.hash).toBe(P.hashTexto(SKILL_UNO));
    expect(uno.tokens).toBe(Math.ceil(SKILL_UNO.length / 3.5));
    expect(uno.origen).toBe('repo');
  });
});

describe('propuestasSkills · chequeos sin modelo', () => {
  it('rutasMuertas: solo la que apunta al repo y no existe; ejemplos, datos, servidor y carpetas que se generan no cuentan', () => {
    const { raiz } = armarRepo();
    const texto = [
      '`scripts/_lib/viva.mjs` existe.', '`scripts/_lib/muerta.mjs` no existe.', 'ejemplo `foo.md` y `scripts/_auditFoo.mjs`.', 'dato pelado `tabla.csv` y `Rev6.pdf`.',
      'servidor `Y:\\BARACK\\x.xlsx` y `FLUJOGRAMAS/Listado.xlsx`.', 'generado `.sgc-cache/api/x.json` y `exports/lote/a.pdf`.', 'plantilla `docs/{nombre}.md` y `scripts/_x_AAAAMMDD.mjs`.',
      'comodin diaN `scripts/contenido_diaN.py`.', 'memoria `feedback_algo.md`.', 'url https://sitio.com/a/b.md y `viva.mjs` pelado.',
    ].join('\n');
    const skill = P.skillDeTexto({ texto: `---\nname: t\ndescription: x\n---\n${texto}`, nombreCarpeta: 't', ruta: path.join(raiz, '.claude/skills/t/SKILL.md'), dir: path.join(raiz, '.claude/skills/t'), origen: 'repo' });
    const { muertas } = P.rutasMuertas(skill, { raiz });
    expect(muertas.map((m) => m.ruta)).toEqual(['scripts/_lib/muerta.mjs']);
  });

  it('una ruta pelada se busca por nombre en las carpetas de codigo (indice)', () => {
    const { raiz } = armarRepo();
    const mk = (t) => P.skillDeTexto({ texto: t, nombreCarpeta: 't', ruta: 'x', dir: path.join(raiz, '.claude/skills/t'), origen: 'repo' });
    expect(P.rutasMuertas(mk('usar `viva.mjs` siempre'), { raiz }).muertas).toEqual([]);
    expect(P.rutasMuertas(mk('usar `hojalib_que_no_esta.py` siempre'), { raiz }).muertas.map((m) => m.ruta)).toEqual(['hojalib_que_no_esta.py']);
  });

  it('description: el largo y las palabras de disparo', () => {
    expect(P.descriptionDispara('Usar cuando haya que exportar un AMFE')).toBe(true);
    expect(P.descriptionDispara('Cargarlo ANTES de contestar')).toBe(true);
    expect(P.descriptionDispara('Editar video en Barack — armar un institucional desde tomas crudas')).toBe(false);
    const { raiz } = armarRepo();
    const largo = `---\nname: l\ndescription: ${'palabra '.repeat(70)}\n---\n`;
    const s = P.skillDeTexto({ texto: largo, nombreCarpeta: 'l', ruta: 'x', dir: path.join(raiz, 'x'), origen: 'repo' });
    const ch = P.chequearSkill(s, { raiz, indice: new Set() });
    expect(ch.descriptionLarga).toBe(true);
    expect(ch.sinGatillo).toBe(true);
    expect(ch.avisos.join(' | ')).toMatch(/mas de 400/);
    expect(ch.avisos.join(' | ')).toMatch(/sin cargas/);
  });

  it('cargas en 30 dias vs total, por nombre del skill (tambien plugin:skill por su nombre corto)', () => {
    const ahora = new Date('2026-10-08T12:00:00Z');
    const cargas = [carga('uno', 7, 'a'), carga('uno', 1, 'b'), { ...carga('uno', 1, 'c'), fecha: '2026-08-01T10:00:00.000Z' }, carga('dos', 7, 'd'), { skill: 'plug:uno', nombre: 'uno', fecha: '2026-10-05T10:00:00.000Z' }];
    expect(P.cargasDe(cargas, 'uno', { ahora, dias: 30 })).toHaveLength(3);
    expect(P.cargasDe(cargas, 'uno', { ahora })).toHaveLength(4);
    expect(P.cargasDe(cargas, 'tres')).toHaveLength(0);
  });

  it('lecciones: solo las que nombran al skill como skill, no una palabra suelta', () => {
    const fuentes = [
      { nombre: 'LECCIONES_APRENDIDAS.md', texto: '- Graduado al skill `flujogramas` §1.5.\n- Hay que imprimir el flujograma en A3.\n- Ver skills/imprimir/SKILL.md.\n- usar `imprimir` para la RICOH.\n' },
      { nombre: 'snapshot.md', texto: '- Graduado al skill `flujogramas` §1.5.\n- El skill editar-video no sirve para esto.\n' },
    ];
    expect(P.leccionesQueNombran('flujogramas', fuentes).map((l) => l.fuente)).toEqual(['LECCIONES_APRENDIDAS.md']);
    expect(P.leccionesQueNombran('imprimir', fuentes)).toHaveLength(2);
    expect(P.leccionesQueNombran('editar-video', fuentes)).toHaveLength(1);
    expect(P.leccionesQueNombran('apqp', fuentes)).toHaveLength(0);
  });
});

/** Un dossier de prueba con casos y lecciones. */
function dossierDeUno({ cargas = null, lecciones = null, topeTokens } = {}) {
  const { raiz } = armarRepo();
  const skill = P.leerSkills({ raiz }).find((s) => s.nombre === 'uno');
  const todasLasCargas = cargas ?? [
    carga('uno', 3, 'Carga el consumo del arb sin esperar la planilla de Pablo', ['No, esperemos a Pablo', 'Mejor armame la tabla']),
    carga('uno', 5, 'Subi el consumo nuevo', ['<task-notification>fin</task-notification>', 'Pasame la ruta del archivo']),
  ];
  const lecs = lecciones ?? P.leccionesQueNombran('uno', P.leerFuentesLecciones({ raiz }));
  const chequeo = P.chequearSkill(skill, { raiz, cargas: todasLasCargas, ahora: new Date('2026-10-08T12:00:00Z'), lecciones: lecs, indice: new Set(['viva.mjs']) });
  return { raiz, skill, chequeo, dossier: P.armarDossier({ skill, chequeo, cargas: todasLasCargas, lecciones: lecs, noEsDeFak: NO_ES, ...(topeTokens ? { topeTokens } : {}) }) };
}

describe('propuestasSkills · el dossier', () => {
  it('trae el SKILL.md, los chequeos, los casos (con los mensajes de Fak) y las lecciones; lo automatico queda afuera', () => {
    const { dossier } = dossierDeUno();
    expect(dossier.texto).toContain('Nunca cargar el consumo sin la planilla oficial de Mesa de Corte.');
    expect(dossier.texto).toContain('ruta inexistente: scripts/_lib/muerta.mjs');
    expect(dossier.texto).toContain('Carga el consumo del arb sin esperar la planilla de Pablo');
    expect(dossier.texto).toContain('Mejor armame la tabla');
    expect(dossier.texto).toContain('La planilla manda');
    expect(dossier.texto).not.toContain('fin</task-notification>');
    expect(dossier.nCasos).toBe(2);
    expect(dossier.tieneCasos).toBe(true);
    expect(dossier.tieneLecciones).toBe(true);
    expect(dossier.rutasMuertas).toEqual(['scripts/_lib/muerta.mjs']);
    expect(dossier.hash).toBe(P.hashTexto(SKILL_UNO));
  });

  it('SIN cargas no se arma la seccion de casos (y el pedido al revisor lo avisa)', () => {
    const { dossier } = dossierDeUno({ cargas: [] });
    expect(dossier.tieneCasos).toBe(false);
    expect(dossier.partes.casos).toBe('');
    expect(dossier.texto).not.toContain('CASOS REALES');
    const pedido = P.armarPedidoRevisor(dossier);
    expect(pedido.usuario).toMatch(/no tiene cargas registradas/);
    expect(P.tiposPermitidos(dossier)).not.toContain('description_no_dispara');
  });

  it('las ultimas 5 cargas, de la mas nueva a la mas vieja, con 3 mensajes siguientes y 400 caracteres por mensaje', () => {
    const cargas = Array.from({ length: 7 }, (_, i) => carga('uno', i + 1, `mensaje previo numero ${i + 1} ${'x'.repeat(500)}`, ['uno de mas', 'dos de mas', 'tres de mas', 'cuatro de mas']));
    const { dossier } = dossierDeUno({ cargas });
    expect(dossier.nCasos).toBe(5);
    expect(dossier.partes.casos).toContain('mensaje previo numero 7');
    expect(dossier.partes.casos).toContain('mensaje previo numero 3');
    expect(dossier.partes.casos).not.toContain('mensaje previo numero 2 ');
    expect(dossier.partes.casos).not.toContain('cuatro de mas');
    expect(dossier.partes.casos).not.toMatch(/x{401}/);
  });

  it('INVARIANTE sobre los skills REALES del repo: ningun dossier pasa de 12 K tokens y todos traen el hash y el SKILL.md', () => {
    const cargas = Array.from({ length: 6 }, (_, i) => ({ ...carga('x', i + 1, `mensaje ${'largo '.repeat(100)}`, ['uno', 'dos', 'tres']) }));
    const skills = P.leerSkills({ raiz: RAIZ_REPO });
    expect(skills.length).toBeGreaterThan(10);
    for (const s of skills) {
      const chequeo = P.chequearSkill(s, { raiz: RAIZ_REPO, indice: new Set(), cargas: cargas.map((c) => ({ ...c, skill: s.nombre, nombre: s.nombre })) });
      const d = P.armarDossier({ skill: s, chequeo, cargas: cargas.map((c) => ({ ...c, skill: s.nombre, nombre: s.nombre })), lecciones: [{ fuente: 'LECCIONES_APRENDIDAS.md', linea: `- una leccion que nombra el skill \`${s.nombre}\`` }], noEsDeFak: NO_ES });
      expect(d.tokens, s.nombre).toBeLessThanOrEqual(P.TOPE_TOKENS_DOSSIER);
      expect(d.texto, s.nombre).toContain(s.hash.slice(0, 12));
      expect(d.partes.skill.length, s.nombre).toBeGreaterThan(500);
    }
  });

  it('un skill gigante se recorta por secciones, marca lo omitido y el dossier no pasa de 12 K tokens', () => {
    const secciones = Array.from({ length: 12 }, (_, i) => `## Seccion ${i + 1}\n\nregla numero ${i + 1}: ${'texto de relleno de la seccion '.repeat(190)}\n`).join('\n');
    const grande = P.skillDeTexto({ texto: `---\nname: grande\ndescription: Usar cuando haya algo grande\n---\n\n# Grande\n\n${secciones}`, nombreCarpeta: 'grande', ruta: 'x', dir: path.join(dir, 'x'), origen: 'repo' });
    expect(grande.tokens).toBeGreaterThan(14000);
    const chequeo = P.chequearSkill(grande, { raiz: dir, indice: new Set() });
    const d = P.armarDossier({ skill: grande, chequeo, cargas: [], lecciones: [], noEsDeFak: NO_ES });
    expect(d.tokens).toBeLessThanOrEqual(P.TOPE_TOKENS_DOSSIER);
    expect(d.recortado).toBe(true);
    expect(d.omitidas.length).toBeGreaterThan(0);
    expect(d.texto).toContain('seccion omitida por tamaño');
    expect(d.partes.skill).toContain('## Seccion 1');
    expect(d.partes.skill).not.toContain('regla numero 12:');
    expect(P.tiposPermitidos(d)).toContain('demasiado_larga');
    // una cita de lo que se omitio NO se encuentra: se busca en lo que de verdad se mando
    const f = P.filtrarPropuestas([{ tipo: 'contradiccion_interna', cita_skill: 'regla numero 12: texto de relleno', cita_caso: '## Seccion 1', por_que: 'x', cambio_propuesto: 'Borrar la seccion repetida del final', confianza: 'alta' }], d);
    expect(f.propuestas).toHaveLength(0);
    expect(f.cuenta.cita_skill_no_esta).toBe(1);
  });
});

describe('propuestasSkills · el filtro de codigo', () => {
  const buena = (extra = {}) => ({
    tipo: 'leccion_no_reflejada', cita_skill: 'Nunca cargar el consumo sin la planilla oficial de Mesa de Corte',
    cita_caso: 'Carga el consumo del arb sin esperar la planilla de Pablo', por_que: 'Fak pidio cargar sin la planilla y el skill no dice que hacer',
    cambio_propuesto: 'Agregar: si Pablo confirma el consumo por mail, esa confirmacion reemplaza a la planilla.', confianza: 'alta', ...extra,
  });

  it('una propuesta bien citada pasa; los textos se comparan sin tildes, mayusculas ni espacios de mas', () => {
    const { dossier } = dossierDeUno();
    const f = P.filtrarPropuestas([buena({ cita_skill: 'NUNCA   cargar el consumo sin la planilla oficial de mesa de corte' })], dossier);
    expect(f.propuestas).toHaveLength(1);
    expect(f.descartadas).toHaveLength(0);
  });

  it('ROJO: una cita del skill inventada se descarta', () => {
    const { dossier } = dossierDeUno();
    const f = P.filtrarPropuestas([buena({ cita_skill: 'Siempre usar hielo seco para enfriar el corte' })], dossier);
    expect(f.propuestas).toHaveLength(0);
    expect(f.cuenta).toEqual({ cita_skill_no_esta: 1 });
  });

  it('ROJO: una cita del caso inventada se descarta, aunque la del skill sea buena', () => {
    const { dossier } = dossierDeUno();
    const f = P.filtrarPropuestas([buena({ cita_caso: 'Fak dijo que ya no hace falta la planilla de Mesa de Corte' })], dossier);
    expect(f.propuestas).toHaveLength(0);
    expect(f.cuenta).toEqual({ cita_caso_no_esta: 1 });
  });

  it('la cita del skill tiene que estar en el SKILL.md, no en un mensaje de Fak (y la del caso puede estar en cualquier parte del dossier)', () => {
    const { dossier } = dossierDeUno();
    expect(P.filtrarPropuestas([buena({ cita_skill: 'Carga el consumo del arb sin esperar la planilla de Pablo' })], dossier).cuenta).toEqual({ cita_skill_no_esta: 1 });
    const otro = P.filtrarPropuestas([buena({ tipo: 'contradiccion_interna', cita_caso: 'La merma maxima es del 5 por ciento segun la planilla' })], dossier);
    expect(otro.propuestas).toHaveLength(1);
  });

  it('citas cortas, de una palabra o iguales entre si no valen', () => {
    const { dossier } = dossierDeUno();
    expect(P.filtrarPropuestas([buena({ cita_skill: 'Nunca' })], dossier).cuenta).toEqual({ cita_skill_no_esta: 1 });    expect(P.filtrarPropuestas([buena({ cita_caso: 'Nunca cargar el consumo sin la planilla oficial de Mesa de Corte' })], dossier).cuenta).toEqual({ citas_iguales: 1 });
  });

  it('ROJO: un numero o codigo que el dossier no trae tira la propuesta; uno que si trae, no', () => {
    const { dossier } = dossierDeUno();
    const mal = P.filtrarPropuestas([buena({ cambio_propuesto: 'Agregar: el tope de merma pasa al 8 por ciento y a 1250 piezas por lote.' })], dossier);
    expect(mal.propuestas).toHaveLength(0);
    expect(mal.cuenta).toEqual({ numero_inventado: 1 });
    expect(mal.descartadas[0].numeros_que_faltan).toEqual(['1250']);
    const bien = P.filtrarPropuestas([buena({ cambio_propuesto: 'Agregar: la merma maxima sigue en 5 por ciento (ver la leccion del 08/10).' })], dossier);
    expect(bien.propuestas).toHaveLength(1);
    expect(P.tokensConNumeros('lote 2.1.205 del 08/10/2026, 1 y 8 piezas, AMFE-173, a1')).toEqual(['2.1.205', '08/10/2026', 'amfe-173', 'a1']);
  });

  it('ROJO: si el SKILL.md cambio de hash desde que se armo el dossier, se invalida todo', () => {
    const { dossier } = dossierDeUno();
    const f = P.filtrarPropuestas([buena(), buena({ tipo: 'contradiccion_interna', cita_caso: 'La merma maxima es del 5 por ciento segun la planilla' })], dossier, { hashActual: 'otro-hash' });
    expect(f.propuestas).toHaveLength(0);
    expect(f.cuenta).toEqual({ hash_cambio: 2 });
  });

  it('un tipo fuera de la lista, o que este dossier no permite, se descarta (ruta_muerta sin rutas muertas, description sin casos)', () => {
    const { dossier } = dossierDeUno();
    expect(P.filtrarPropuestas([buena({ tipo: 'estilo' })], dossier).cuenta).toEqual({ tipo_invalido: 1 });
    const sinMuertas = dossierDeUno({ cargas: [] });
    const ruta = buena({ tipo: 'ruta_muerta', cita_skill: 'Los detalles estan en `scripts/_lib/muerta.mjs`', cita_caso: 'ruta inexistente: scripts/_lib/muerta.mjs', cambio_propuesto: 'Corregir la ruta a la que existe hoy en el repo.' });
    expect(P.filtrarPropuestas([ruta], dossier).propuestas).toHaveLength(1);
    expect(P.filtrarPropuestas([buena({ tipo: 'description_no_dispara' })], sinMuertas.dossier).cuenta).toEqual({ tipo_no_permitido: 1 });
  });

  it('sin cambio concreto, duplicadas y mas de 4: se descartan; quedan las de mas confianza primero', () => {
    const { dossier } = dossierDeUno();
    expect(P.filtrarPropuestas([buena({ cambio_propuesto: 'ok' })], dossier).cuenta).toEqual({ sin_cambio: 1 });
    expect(P.filtrarPropuestas([buena(), buena()], dossier).cuenta).toEqual({ duplicada: 1 });
    const citas = ['La merma maxima es del 5 por ciento segun la planilla', 'Avisar a Fak cuando termine la carga', 'Los detalles estan en `scripts/_lib/muerta.mjs`', 'y en `scripts/_lib/viva.mjs`', 'Nunca cargar el consumo sin la planilla oficial'];
    const cinco = citas.map((c, i) => buena({ tipo: 'contradiccion_interna', cita_skill: c, confianza: i === 4 ? 'alta' : 'baja', cita_caso: 'Carga el consumo del arb sin esperar la planilla de Pablo' }));
    const f = P.filtrarPropuestas(cinco, dossier);
    expect(f.propuestas).toHaveLength(4);
    expect(f.propuestas[0].cita_skill).toBe('Nunca cargar el consumo sin la planilla oficial');
    expect(f.cuenta).toEqual({ tope: 1 });
  });

  it('aplicarVeredictos: el refutador que no miro una propuesta la descarta', () => {
    const props = [buena(), buena({ tipo: 'contradiccion_interna' }), buena({ tipo: 'instruccion_obsoleta' })];
    const r = P.aplicarVeredictos(props, [{ numero: 1, veredicto: 'se_mantiene', motivo: 'el caso lo prueba' }, { numero: 2, veredicto: 'se_descarta', motivo: 'es gusto' }]);
    expect(r.mantenidas.map((p) => p.tipo)).toEqual(['leccion_no_reflejada']);
    expect(r.mantenidas[0].motivo_refutador).toBe('el caso lo prueba');
    expect(r.descartadas.map((d) => d.motivo)).toEqual(['refutador: es gusto', 'el refutador no la miro: se descarta']);
  });

  it('las reglas para el refutador: nombre y primera linea DESPUES del frontmatter', () => {
    const { raiz } = armarRepo();
    expect(P.resumenReglas({ raiz })).toEqual([
      { nombre: 'regla-a.md', linea: 'Regla A: no inventar datos', descripcion: 'La regla A con frontmatter' },
      { nombre: 'regla-b.md', linea: 'Regla B sin frontmatter', descripcion: '' },
    ]);
    const reales = P.resumenReglas({ raiz: RAIZ_REPO });
    expect(reales.length).toBeGreaterThan(20);
    expect(reales.find((r) => r.nombre === 'api-claude.md').linea).not.toBe('---');
  });
});

describe('propuestasSkills · escritura segura: SOLO adentro de la carpeta permitida', () => {
  it('escribe atomico adentro de la base permitida y no deja .tmp', () => {
    const base = path.join(dir, 'permitida');
    const ruta = P.escribirEnBase(base, '2026-10-08/uno.md', 'hola', { permitidos: [base] });
    expect(fs.readFileSync(ruta, 'utf8')).toBe('hola');
    expect(fs.readdirSync(path.join(base, '2026-10-08')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('ROJO: ../, rutas absolutas y la propia base se rechazan sin tocar el disco', () => {
    const base = path.join(dir, 'permitida');
    const rutas = ['../fuera.md', 'a/../../fuera.md', path.join(dir, 'fuera.md'), '', '.'];
    if (path.sep === '\\') rutas.push('..\\fuera.md'); // en Windows la barra invertida tambien sube
    for (const rel of rutas) {
      expect(() => P.escribirEnBase(base, rel, 'x', { permitidos: [base] }), rel).toThrow(P.ErrorSalida);
    }
    expect(fs.existsSync(path.join(dir, 'fuera.md'))).toBe(false);
    expect(fs.existsSync(base)).toBe(false);
  });

  it('ROJO: una base fuera de las permitidas se rechaza, incluso la que solo se PARECE (.sgc-cache-x)', () => {
    const permitida = path.join(dir, '.sgc-cache');
    expect(() => P.escribirEnBase(path.join(dir, '.sgc-cache-x'), 'a.md', 'x', { permitidos: [permitida] })).toThrow(/no esta entre las permitidas/);
    expect(() => P.escribirEnBase(dir, 'a.md', 'x', { permitidos: [permitida] })).toThrow(/no esta entre las permitidas/);
    expect(() => P.escribirEnBase(path.join(permitida, 'api'), 'a.md', 'x', { permitidos: [] })).toThrow(/no esta entre las permitidas/);
    expect(P.baseEsPermitida(path.join(permitida, 'api', 'propuestas'), [permitida])).toBe(true);
    expect(fs.existsSync(path.join(dir, '.sgc-cache-x'))).toBe(false);
  });

  it('ROJO: nunca escribe en la configuracion del asistente (.claude/skills, rules, hooks...), ni aunque la base lo permita', () => {
    const { raiz } = armarRepo();
    const antes = fs.readFileSync(path.join(raiz, '.claude/skills/uno/SKILL.md'), 'utf8');
    expect(() => P.escribirEnBase(path.join(raiz, '.claude', 'skills'), 'uno/SKILL.md', 'pisado', { permitidos: [raiz] })).toThrow(/configuracion del asistente/);
    expect(() => P.escribirEnBase(path.join(raiz, '.sgc-cache'), '../.claude/skills/uno/SKILL.md', 'pisado', { permitidos: [path.join(raiz, '.sgc-cache')] })).toThrow(P.ErrorSalida);
    expect(() => P.escribirEnBase(path.join(raiz, '.claude', 'rules'), 'x.md', 'x', { permitidos: [raiz] })).toThrow(P.ErrorSalida);
    expect(fs.readFileSync(path.join(raiz, '.claude/skills/uno/SKILL.md'), 'utf8')).toBe(antes);
  });

  it('las carpetas permitidas son .sgc-cache del repo y la de la variable de entorno', () => {
    expect(P.basesPermitidas({ raiz: '/r', env: {} })).toEqual([path.join('/r', '.sgc-cache')]);
    expect(P.basesPermitidas({ raiz: '/r', env: { BARACK_PROPUESTAS_DIR: '/t' } })).toEqual([path.join('/r', '.sgc-cache'), '/t']);
    expect(P.basesPermitidas({ raiz: '/r', env: { OTRA: '/t' }, variable: 'OTRA' })).toEqual([path.join('/r', '.sgc-cache'), '/t']);
  });

  it('el nombre de archivo de un skill es seguro (los dos puntos de los plugins no valen en Windows)', () => {
    expect(P.nombreArchivoSeguro('anthropic-skills:pptx')).toBe('anthropic-skills_pptx');
    expect(P.nombreArchivoSeguro('../../etc/passwd')).toBe('etc_passwd');
    expect(P.nombreArchivoSeguro('..')).toBe('skill');
    expect(P.nombreArchivoSeguro('Flujogramas')).toBe('flujogramas');
  });

  // los mismos patrones que candadosNocturno.test.mjs (2b): en la noche se escribe SOLO por escrituraSegura.mjs
  const DIRECTAS = [/\bwriteFile(Sync)?\s*\(/, /\bappendFile(Sync)?\s*\(/, /\bcreateWriteStream\s*\(/, /\b(rename|copyFile|cp)(Sync)?\s*\(/, /\b(mkdir|rm|rmdir|unlink)(Sync)?\s*\(/];

  it('CANDADO DE TEXTO: ningun archivo de estas tareas escribe con fs directo; la lib pasa por la puerta de escritura de la noche', () => {
    for (const rel of ARCHIVOS_NUEVOS) {
      const texto = fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
      const hallados = DIRECTAS.filter((re) => re.test(texto)).map(String);
      expect(hallados, `${rel} escribe con fs directo`).toEqual([]);
    }
    expect(fs.readFileSync(path.join(RAIZ_REPO, 'scripts/_lib/propuestasSkills.mjs'), 'utf8')).toMatch(/from '\.\/escrituraSegura\.mjs'/);
  });

  it('GEMELO ROJO del candado de texto: un archivo que escribe donde no debe se caza, y leer no', () => {
    const caza = (t) => DIRECTAS.some((re) => re.test(t));
    expect(caza("fs.writeFileSync('.claude/skills/x/SKILL.md', texto)")).toBe(true);
    expect(caza('fs.mkdirSync(path.dirname(destino), { recursive: true })')).toBe(true);
    expect(caza('fs.renameSync(tmp, destino)')).toBe(true);
    expect(caza("const t = fs.readFileSync('.claude/skills/x/SKILL.md', 'utf8')")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La pasada entera con una API falsa
// ─────────────────────────────────────────────────────────────────────────────

describe('propuestasSkills · la pasada entera con API falsa', () => {
  const usage = { input_tokens: 9000, output_tokens: 700 };
  const texto = (obj) => [{ type: 'text', text: JSON.stringify(obj) }];
  const CITA_SKILL = 'Nunca cargar el consumo sin la planilla oficial de Mesa de Corte';
  const CITA_CASO = 'Carga el consumo del arb sin esperar la planilla de Pablo';
  const valida = { tipo: 'leccion_no_reflejada', cita_skill: CITA_SKILL, cita_caso: CITA_CASO, por_que: 'Fak pidio cargar sin la planilla y el skill no dice que hacer', cambio_propuesto: 'Agregar: si Pablo confirma el consumo por mail, esa confirmacion reemplaza a la planilla.', confianza: 'alta' };
  const citaInventada = { ...valida, tipo: 'contradiccion_interna', cita_skill: 'Siempre usar hielo seco para enfriar el corte' };
  const numeroInventado = { ...valida, tipo: 'instruccion_obsoleta', cambio_propuesto: 'Agregar: el tope de merma pasa a 1250 piezas por lote en todas las planillas.' };

  /** `alRevisar` / `alRefutar` son ganchos para que el test toque el disco en medio de la pasada. */
  function apiFalsa({ propuestas = [valida, citaInventada, numeroInventado], veredictos = null, alRevisar = null, alRefutar = null, falla = null } = {}) {
    const pedidos = [];
    return {
      pedidos,
      messages: { countTokens: async () => ({ input_tokens: 4321 }) },
      beta: {
        messages: {
          create: async (p) => {
            const user = p.messages[0].content;
            pedidos.push({ model: p.model, user, system: p.system, params: p });
            if (falla && falla(p, user)) throw Object.assign(new Error('sobrecargada'), { status: 529 });
            if (p.model === 'claude-sonnet-5-5') {
              if (alRevisar) alRevisar(user);
              return { id: 'r', model: p.model, stop_reason: 'end_turn', usage, content: texto({ propuestas }) };
            }
            if (alRefutar) alRefutar(user);
            return { id: 'x', model: p.model, stop_reason: 'end_turn', usage, content: texto({ veredictos: veredictos ?? [{ numero: 1, veredicto: 'se_mantiene', motivo: 'el caso prueba que falta la regla' }] }) };
          },
        },
      },
    };
  }

  const opciones = (extra = {}) => {
    const salida = path.join(dir, 'salida');
    process.env.BARACK_PROPUESTAS_DIR = salida;
    const repo = armarRepo();
    return {
      raiz: repo.raiz, dirSalida: salida, dirLedger: path.join(dir, 'ledger'), ahora: new Date(2026, 9, 8, 6, 31), indice: new Set(['viva.mjs']),
      transcripts: { cargas: [carga('uno', 7, 'Carga el consumo del arb sin esperar la planilla de Pablo', ['No, esperemos a Pablo'])], mensajes: [], archivos: 1 },
      noEsDeFak: NO_ES, ...extra,
    };
  };
  const leer = (rel) => fs.readFileSync(path.join(dir, 'salida', '2026-10-08', rel), 'utf8');
  const arbol = (base) => {
    const out = [];
    const rec = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = path.join(d, e.name); if (e.isDirectory()) rec(r); else out.push(path.relative(base, r).replace(/\\/g, '/')); } };
    rec(base);
    return out.sort();
  };

  it('revisor -> filtro de codigo -> refutador -> archivo por skill y _resumen.md; lo inventado no llega al refutador', async () => {
    const api = apiFalsa();
    const o = opciones({ cliente: api, skill: 'uno' });
    const antes = arbol(o.raiz);
    const r = await correr(o);
    expect(api.pedidos.map((p) => p.model)).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5']);
    expect(api.pedidos[1].user).toContain('regla-a.md: Regla A: no inventar datos');
    expect(api.pedidos[1].user).not.toContain('hielo seco');
    expect(api.pedidos[1].user).not.toContain('1250');
    expect(r.propuestas).toHaveLength(1);
    expect(r.propuestas[0]).toMatchObject({ skill: 'uno', tipo: 'leccion_no_reflejada', motivo_refutador: 'el caso prueba que falta la regla' });
    expect(r.descartadas.map((d) => d.motivo).sort()).toEqual(['cita_skill_no_esta', 'numero_inventado']);
    expect(r.costoUsd).toBeGreaterThan(0);
    expect(r.resumen).toMatchObject({ skills: 2, revisados: 1, propuestas: 1, descartadas: 2, errores: 0 });
    const md = leer('uno.md');
    expect(md).toMatch(/Para la sesión de Claude de la mañana, no para Fak/);
    expect(md).toContain(`cita del skill: "${CITA_SKILL}"`);
    expect(md).toContain('el refutador la dejó pasar porque: el caso prueba que falta la regla');
    expect(md).toContain('cita_skill_no_esta');
    expect(md).toContain('scripts/_lib/muerta.mjs');
    const res = leer('_resumen.md');
    expect(res).toMatch(/\| uno \|/);
    expect(res).toMatch(/\| dos \|/);
    expect(arbol(path.join(dir, 'salida'))).toEqual(['2026-10-08/_resumen.md', '2026-10-08/uno.md']);
    expect(leerLedger('2026-10', path.join(dir, 'ledger')).map((e) => e.tarea)).toEqual(['propuestas-skills:revisor', 'propuestas-skills:refutador']);
    expect(arbol(o.raiz)).toEqual(antes); // ni un archivo nuevo ni tocado en el repo (los skills quedan como estaban)
    expect(fs.readFileSync(path.join(o.raiz, '.claude/skills/uno/SKILL.md'), 'utf8')).toBe(SKILL_UNO);
  });

  it('el revisor va en Sonnet medium y el refutador en Opus high, con esquema', async () => {
    const api = apiFalsa();
    await correr(opciones({ cliente: api, skill: 'uno' }));
    const [rev, ref] = api.pedidos.map((p) => p.params);
    expect(rev.model).toBe('claude-sonnet-5-5');
    expect(rev.output_config.effort).toBe('medium');
    expect(rev.output_config.format.schema.properties.propuestas).toBeTruthy();
    expect(ref.model).toBe('claude-opus-5-5');
    expect(ref.output_config.effort).toBe('high');
    expect(ref.output_config.format.schema.properties.veredictos).toBeTruthy();
  });

  it('ROJO: si el SKILL.md cambia mientras revisa el revisor, la propuesta se invalida y ni se llama al refutador', async () => {
    const o = opciones({});
    const api = apiFalsa({ alRevisar: () => fs.appendFileSync(path.join(o.raiz, '.claude/skills/uno/SKILL.md'), '\nUna linea nueva que escribio otra sesion.\n') });
    const r = await correr({ ...o, cliente: api, skill: 'uno' });
    expect(api.pedidos.map((p) => p.model)).toEqual(['claude-sonnet-5-5']);
    expect(r.propuestas).toHaveLength(0);
    expect(r.descartadas.filter((d) => d.motivo === 'hash_cambio')).toHaveLength(3);
    expect(leer('uno.md')).toMatch(/Sin propuestas que sobrevivan/);
  });

  it('ROJO: si el SKILL.md cambia mientras revisa el refutador, lo que habia pasado tambien se invalida', async () => {
    const o = opciones({});
    const api = apiFalsa({ alRefutar: () => fs.appendFileSync(path.join(o.raiz, '.claude/skills/uno/SKILL.md'), '\nOtro cambio.\n') });
    const r = await correr({ ...o, cliente: api, skill: 'uno' });
    expect(api.pedidos.map((p) => p.model)).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5']);
    expect(r.propuestas).toHaveLength(0);
    expect(r.descartadas.map((d) => d.motivo)).toContain('hash_cambio');
  });

  it('sin cargas no hay casos en el pedido, y sin propuestas buenas no se llama al refutador', async () => {
    const api = apiFalsa({ propuestas: [citaInventada] });
    const r = await correr(opciones({ cliente: api, skill: 'uno', transcripts: { cargas: [], mensajes: [] } }));
    expect(api.pedidos).toHaveLength(1);
    expect(api.pedidos[0].user).not.toContain('CASOS REALES');
    expect(api.pedidos[0].user).toMatch(/no tiene cargas registradas/);
    expect(r.propuestas).toHaveLength(0);
    expect(r.resumen.revisados).toBe(1);
  });

  it('un refutador que no mira la propuesta la descarta', async () => {
    const api = apiFalsa({ veredictos: [] });
    const r = await correr(opciones({ cliente: api, skill: 'uno' }));
    expect(r.propuestas).toHaveLength(0);
    expect(r.descartadas.map((d) => d.motivo)).toContain('el refutador no la miro: se descarta');
  });

  it('--simular no gasta ni escribe: arma dossiers, cuenta tokens (gratis) y estima', async () => {
    const api = apiFalsa();
    const o = opciones({ cliente: api, simular: true });
    const r = await correr(o);
    expect(r.simulado).toBe(true);
    expect(api.pedidos).toEqual([]);
    expect(r.skills).toHaveLength(2);
    expect(r.skills.find((s) => s.nombre === 'uno')).toMatchObject({ rutasMuertas: 1, casos: 1, lecciones: 1 });
    expect(r.estimacion[0]).toMatchObject({ tokens: 4321, medido: true });
    expect(r.estimadoUsd.tope).toBeGreaterThan(r.estimadoUsd.soloRevisor);
    expect(fs.existsSync(path.join(dir, 'salida'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'ledger'))).toBe(false);
  });

  it('un skill que falla no tumba a los demas: queda con error, con su archivo, y el resumen lo cuenta', async () => {
    const api = apiFalsa({ falla: (p, user) => user.includes('SKILL "dos"') });
    const o = opciones({ cliente: api, transcripts: { cargas: [carga('uno', 7, 'Carga el consumo del arb sin esperar la planilla de Pablo'), carga('dos', 6, 'hola')], mensajes: [] } });
    const r = await correr(o);
    expect(r.resumen).toMatchObject({ revisados: 1, errores: 1, propuestas: 1 });
    expect(leer('dos.md')).toMatch(/ERROR: la API fallo/);
    expect(leer('uno.md')).toMatch(/cita del skill/);
    expect(r.skills.find((s) => s.nombre === 'dos').error).toMatch(/sobrecargada/);
  });

  it('--max: los chequeos de codigo corren sobre todos y el modelo revisa solo los mas usados', async () => {
    const api = apiFalsa({ propuestas: [] });
    const o = opciones({ cliente: api, max: 1, transcripts: { cargas: [carga('dos', 7, 'hola'), carga('dos', 6, 'hola de nuevo'), carga('uno', 5, 'chau')], mensajes: [] } });
    const r = await correr(o);
    expect(api.pedidos).toHaveLength(1);
    expect(api.pedidos[0].user).toContain('SKILL "dos"');
    expect(r.skills.map((s) => [s.nombre, s.revisado])).toEqual([['dos', true], ['uno', false]]);
    expect(r.skills.find((s) => s.nombre === 'uno').rutasMuertas).toBe(1);
  });

  it('un skill que no existe es error de argumento (codigo 2), no "0 revisados"', async () => {
    const api = apiFalsa();
    await expect(correr(opciones({ cliente: api, skill: 'no-existe' }))).rejects.toMatchObject({ codigo: 2 });
    expect(api.pedidos).toEqual([]);
  });

  it('el orden de prioridad: mas cargas en 30 dias primero, despues las totales, las lecciones y el tamano', () => {
    const t = (n, c30, ct, lec, kb) => ({ skill: { nombre: n }, chequeo: { cargas30: c30, cargasTotal: ct, lecciones: lec, kb } });
    const orden = [t('d', 0, 0, 0, 50), t('c', 2, 9, 0, 1), t('b', 5, 5, 0, 1), t('a', 5, 5, 3, 1)].sort(porPrioridad).map((x) => x.skill.nombre);
    expect(orden).toEqual(['a', 'b', 'c', 'd']);
  });
});

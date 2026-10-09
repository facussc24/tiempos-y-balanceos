// @vitest-environment node
/**
 * Tests de la prueba de disparo de skills: lo puro (scripts/_lib/disparoSkills.mjs) y la prueba entera
 * (`correr` de scripts/_pruebaDisparoSkills.mjs) con un cliente de la API FALSO y mensajes de ejemplo.
 *
 * Lo que se prueba: la verdad de terreno sale de los TURNOS (un skill cargado despues de un aviso no cuenta;
 * un skill desconocido saca el mensaje de la muestra); un id que el modelo no devuelve NO se cuenta como
 * "ninguna" (se reintenta una vez y si sigue faltando no se mide); y las cuentas de aciertos / faltantes /
 * de mas dan lo que dan sobre 6 mensajes de respuesta conocida. Sin red, sin .env.local, sin los transcripts
 * de verdad: tiene que pasar en el CI.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as D from '../../scripts/_lib/disparoSkills.mjs';
import { correr, estimarCosto } from '../../scripts/_pruebaDisparoSkills.mjs';
import { leerLedger } from '../../scripts/_lib/claudeApi.mjs';

let dir;
const VARIABLES = ['BARACK_DISPARO_DIR', 'BARACK_API_DIR'];
const guardadas = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'disparo-test-'));
  process.env.BARACK_API_DIR = dir; // el ledger de gasto cae en la carpeta temporal (la puerta de escritura de la noche lo exige)
});
afterEach(() => {
  for (const v of VARIABLES) { if (guardadas[v] === undefined) delete process.env[v]; else process.env[v] = guardadas[v]; }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

const SKILLS = [
  { nombre: 'uno', description: 'Cargar consumos en el arb. Usar cuando haya que cargar la planilla de consumos.' },
  { nombre: 'dos', description: 'Armar flujogramas de proceso. Usar cuando Fak pida un flujograma.' },
  { nombre: 'tres', description: 'Imprimir PDFs. Usar cuando pidan imprimir.' },
];
const NOMBRES = SKILLS.map((s) => s.nombre);
let reloj = 0; // fechas distintas por defecto: el orden de la muestra sale de la fecha
const msg = (texto, cargas = [], extra = {}) => ({ fecha: new Date(Date.UTC(2026, 9, 1, 10, 0, reloj++)).toISOString(), sesion: 's1', texto, cargas, skillsAntes: [], ...extra });

describe('disparoSkills · el puntaje (6 mensajes de respuesta conocida)', () => {
  // etiqueta = lo que se cargo de verdad; pred = lo que dijo el modelo
  const items = [
    { id: 1, tipo: 'positivo', etiqueta: ['uno'], texto: 'a' },
    { id: 2, tipo: 'positivo', etiqueta: ['dos'], texto: 'b' },
    { id: 3, tipo: 'positivo', etiqueta: ['uno', 'dos'], texto: 'c' },
    { id: 4, tipo: 'ninguna', etiqueta: [], texto: 'd' },
    { id: 5, tipo: 'ninguna', etiqueta: [], texto: 'e' },
    { id: 6, tipo: 'positivo', etiqueta: ['tres'], texto: 'f' },
  ];
  const pred = new Map([[1, ['uno']], [2, []], [3, ['uno']], [4, ['uno']], [5, []], [6, ['dos']]]);

  it('aciertos, faltantes y de mas por skill', () => {
    const p = D.puntuar(items, pred, NOMBRES);
    const f = Object.fromEntries(p.filas.map((x) => [x.skill, x]));
    expect(f.uno).toMatchObject({ debia: 2, aciertos: 2, faltantes: 0, demas: 1 });
    expect(f.dos).toMatchObject({ debia: 2, aciertos: 0, faltantes: 2, demas: 1 });
    expect(f.tres).toMatchObject({ debia: 1, aciertos: 0, faltantes: 1, demas: 0 });
    expect(f.uno.precision).toBeCloseTo(2 / 3, 6);
    expect(f.uno.recall).toBe(1);
    expect(f.dos.precision).toBe(0);
    expect(f.dos.recall).toBe(0);
    expect(f.tres.precision).toBeNull(); // el modelo nunca lo eligio: no hay precision que calcular
  });

  it('globales: coincidencia exacta con lo que se cargo, con y sin carga', () => {
    const { global: g, errores } = D.puntuar(items, pred, NOMBRES);
    expect(g).toMatchObject({ evaluados: 6, sinRespuesta: 0, exactos: 2, positivos: 4, positivosExactos: 1, ningunas: 2, ningunasBien: 1 });
    expect(errores.map((e) => e.id)).toEqual([2, 3, 4, 6]);
    expect(errores.find((e) => e.id === 3)).toMatchObject({ debia: ['uno', 'dos'], eligio: ['uno'] });
  });

  it('un mensaje sin prediccion no se mide: ni como "ninguna" ni como falta', () => {
    const sin = new Map([[1, ['uno']], [4, []]]);
    const { global: g, filas } = D.puntuar(items, sin, NOMBRES);
    expect(g).toMatchObject({ evaluados: 2, sinRespuesta: 4, exactos: 2 });
    expect(filas.find((f) => f.skill === 'dos').debia).toBe(0);
  });

  it('acepta las predicciones como objeto {id: [...]} y "ninguna" no cuenta como skill', () => {
    const { filas } = D.puntuar(items.slice(0, 1), { 1: ['uno', D.NINGUNA] }, NOMBRES);
    expect(filas.find((f) => f.skill === 'uno')).toMatchObject({ aciertos: 1, demas: 0 });
  });

  it('las descriptions con peor resultado, con los mensajes que fallaron', () => {
    const p = D.puntuar(items, pred, NOMBRES);
    const peores = D.peoresDescriptions(p, SKILLS);
    expect(peores.map((x) => x.skill)).toEqual(['dos', 'tres', 'uno']); // dos: 2 faltantes + 1 de mas = 3; tres y uno: 1 cada uno, y gana el de menor recall (tres 0 %, uno 100 %)
    const dos = peores[0];
    expect(dos.description).toMatch(/flujogramas/);
    expect(dos.faltaron.map((e) => e.id)).toEqual([2, 3]);
    expect(dos.sobraron.map((e) => e.id)).toEqual([6]);
    expect(D.peoresDescriptions(D.puntuar([items[0]], new Map([[1, ['uno']]]), NOMBRES), SKILLS)).toEqual([]);
  });

  it('el informe explica como leerlo (incluido el caso del 02/10) y trae la tabla y los ejemplos', () => {
    const p = D.puntuar(items, pred, NOMBRES);
    const verdad = { items, disponibles: { positivos: 4, ningunas: 2 }, descartados: {} };
    const md = D.armarInforme({ fecha: '2026-10-08', verdad, puntaje: p, peores: D.peoresDescriptions(p, SKILLS), skills: SKILLS, costoUsd: 0.0123, loteras: { lotes: 1, faltan: 0, repetidos: 0, reintento: false } });
    expect(md).toMatch(/Para la sesión de Claude de la mañana, no para Fak/);
    expect(md).toMatch(/02\/10/);
    expect(md).toMatch(/\| uno \| 2 \| 2 \| 0 \| 1 \| 67 % \| 100 % \|/);
    expect(md).toMatch(/\| dos \| 2 \| 0 \| 2 \| 1 \| 0 % \| 0 % \|/);
    expect(md).toMatch(/FALTANTE: "b" → el modelo eligió: ninguna/);
    expect(md).toMatch(/DE MÁS: "f" → en esa sesión se cargó: tres/);
    expect(md).toMatch(/costo \$0\.01/);
  });
});

describe('disparoSkills · la verdad de terreno', () => {
  it('positivos de skills conocidos, "ninguna" de sesiones sin skills; el resto no entra y cada descarte se cuenta', () => {
    const mensajes = [
      msg('Cargame el consumo del arb con la planilla de Pablo', ['uno']),
      msg('Armame el flujograma de esta pieza nueva', ['Dos']),
      msg('Necesito algo que carga un plugin de afuera', ['anthropic-skills:xlsx']),
      msg('Mezcla de un skill nuestro y uno de afuera', ['uno', 'claude-api']),
      msg('Contame que hace este script de backups viejo'),
      msg('Pregunta en una sesion donde ya se cargo un skill', [], { skillsAntes: ['uno'] }),
      msg('corto'),
      msg('x'.repeat(3500)),
      msg('Contame que hace este script de backups viejo'),
    ];
    const v = D.armarVerdad(mensajes, NOMBRES);
    expect(v.items.map((i) => [i.tipo, i.etiqueta])).toEqual([['positivo', ['uno']], ['positivo', ['dos']], ['ninguna', []]].map(([t, e]) => [t, e]));
    expect(v.descartados).toEqual({ corto: 1, largo: 1, repetido: 1, skill_desconocido: 2, sesion_con_skills: 1 });
    expect(v.disponibles).toEqual({ positivos: 2, ningunas: 1 });
    expect(v.items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('el muestreo reparte: un skill que se carga mucho no se come la muestra, y es deterministico', () => {
    const mensajes = [
      ...Array.from({ length: 30 }, (_, i) => msg(`mensaje de explicar numero ${i} para el skill uno`, ['uno'], { fecha: `2026-10-0${1 + (i % 7)}T10:00:00.000Z` })),
      msg('mensaje raro para el skill dos que se carga poco', ['dos']),
      msg('mensaje raro para el skill tres que se carga poco', ['tres']),
      ...Array.from({ length: 30 }, (_, i) => msg(`pregunta suelta sin skills numero ${i} en el chat`)),
    ];
    const a = D.armarVerdad(mensajes, NOMBRES, { max: 10 });
    expect(a.items).toHaveLength(10);
    const etiquetas = a.items.flatMap((i) => i.etiqueta);
    expect(etiquetas).toContain('dos');
    expect(etiquetas).toContain('tres');
    expect(a.items.filter((i) => i.tipo === 'ninguna').length).toBeGreaterThanOrEqual(3); // al menos el 35 %
    const b = D.armarVerdad([...mensajes].reverse(), NOMBRES, { max: 10 });
    expect(b.items.map((i) => i.texto)).toEqual(a.items.map((i) => i.texto));
  });

  it('si faltan positivos, la muestra se llena con mensajes sin carga hasta el tope', () => {
    const mensajes = [msg('Cargame el consumo del arb con la planilla', ['uno']), ...Array.from({ length: 20 }, (_, i) => msg(`pregunta suelta numero ${i} sin ningun skill`))];
    const v = D.armarVerdad(mensajes, NOMBRES, { max: 10 });
    expect(v.items).toHaveLength(10);
    expect(v.items.filter((i) => i.tipo === 'positivo')).toHaveLength(1);
  });

  it('el texto que ve el modelo se acorta a largoPrompt', () => {
    const v = D.armarVerdad([msg(`Cargame el consumo ${'del arb '.repeat(200)}`, ['uno'])], NOMBRES, { largoPrompt: 100 });
    expect(v.items[0].texto.length).toBeLessThanOrEqual(100);
  });
});

describe('disparoSkills · el pedido a Haiku y su respuesta', () => {
  it('el prefijo trae todas las descriptions; el esquema acota los nombres y suma "ninguna"', () => {
    const sys = D.armarSystem(SKILLS);
    for (const s of SKILLS) expect(sys).toContain(`- ${s.nombre}: ${s.description}`);
    const esquema = D.armarSchema(NOMBRES);
    expect(esquema.properties.respuestas.items.properties.skills.items.enum).toEqual(['uno', 'dos', 'tres', 'ninguna']);
    expect(esquema.properties.respuestas.items.required).toEqual(['id', 'skills']);
  });

  it('los lotes llevan cada mensaje con su id', () => {
    const lote = [{ id: 3, texto: 'hola' }, { id: 4, texto: 'chau' }];
    expect(D.armarPedidoLote(lote)).toContain('<mensaje id="3">\nhola\n</mensaje>');
    expect(D.enLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('un id que falta o viene repetido NO es "ninguna"; un skill fuera de la lista se tira; como mucho 2', () => {
    const lote = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
    const r = D.interpretarLote({ respuestas: [
      { id: 1, skills: ['uno'] },
      { id: 2, skills: ['uno', 'dos', 'tres'] },
      { id: 3, skills: ['skill-inventado'] },
      { id: 3, skills: ['dos'] },
      { id: 99, skills: ['uno'] },
      { id: 5, skills: ['ninguna'] },
    ] }, lote, NOMBRES);
    expect([...r.predicciones.entries()]).toEqual([[1, ['uno']], [2, ['uno', 'dos']], [5, []]]); // "ninguna" queda como lista vacia
    expect(r.faltan).toEqual([4]);
    expect(r.repetidos).toEqual([3]);
    expect(r.ajenos).toEqual([99]);
    expect(D.interpretarLote({ respuestas: [{ id: 1, skills: ['skill-inventado'] }] }, [{ id: 1 }], NOMBRES).predicciones.get(1)).toEqual([]);
    expect(D.interpretarLote(null, lote, NOMBRES).faltan).toEqual([1, 2, 3, 4, 5]);
  });

  it('la estimacion: el primer lote escribe el cache y los demas lo leen (mas barato que escribirlo en todos)', () => {
    const lotes = [[{ texto: 'a'.repeat(350) }], [{ texto: 'b'.repeat(350) }], [{ texto: 'c'.repeat(350) }]];
    const conCache = estimarCosto(5000, lotes);
    expect(conCache).toBeGreaterThan(0);
    expect(conCache).toBeLessThan(estimarCosto(5000, [lotes[0]]) * 3);
  });
});

describe('disparoSkills · la lista de skills', () => {
  it('skills del repo + comandos con description + skills del usuario, sin repetir nombre', () => {
    const w = (rel, t) => { const r = path.join(dir, rel); fs.mkdirSync(path.dirname(r), { recursive: true }); fs.writeFileSync(r, t, 'utf8'); };
    w('raiz/.claude/skills/uno/SKILL.md', '---\nname: uno\ndescription: Skill uno. Usar cuando haya que probar.\n---\n');
    w('raiz/.claude/skills/solo-en-repo/SKILL.md', '---\nname: solo-en-repo\ndescription: >\n  Skill con la description\n  en dos lineas.\n---\n');
    w('raiz/.claude/commands/comando.md', '---\nname: comando\ndescription: Un comando del repo\n---\nCuerpo');
    w('raiz/.claude/commands/sin-description.md', '# sin frontmatter');
    w('usuario/uno/SKILL.md', '---\nname: uno\ndescription: El del usuario, repetido\n---\n');
    w('usuario/propio/SKILL.md', '---\nname: propio\ndescription: Un skill del usuario\n---\n');
    const lista = D.listaDeSkills({ raiz: path.join(dir, 'raiz'), conUsuario: true, dirUsuario: path.join(dir, 'usuario') });
    expect(lista.map((s) => [s.nombre, s.origen])).toEqual([['comando', 'comando'], ['propio', 'usuario'], ['solo-en-repo', 'repo'], ['uno', 'repo']]);
    expect(lista.find((s) => s.nombre === 'solo-en-repo').description).toBe('Skill con la description en dos lineas.');
    expect(D.listaDeSkills({ raiz: path.join(dir, 'raiz'), conUsuario: false }).map((s) => s.nombre)).toEqual(['comando', 'solo-en-repo', 'uno']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La prueba entera con una API falsa
// ─────────────────────────────────────────────────────────────────────────────

describe('disparoSkills · la prueba entera con API falsa', () => {
  const usage = { input_tokens: 5200, output_tokens: 300, cache_read_input_tokens: 0 };

  /**
   * Haiku de mentira: 'planilla' -> uno, 'flujograma' -> dos, las dos palabras -> los dos, nada -> ninguna.
   * `omitir(nroLlamada, id)` dice si no devuelve un id; `repetir` devuelve un id dos veces.
   */
  function apiFalsa({ omitir = () => false, repetir = () => false } = {}) {
    const pedidos = [];
    return {
      pedidos,
      messages: { countTokens: async () => ({ input_tokens: 1 }) },
      beta: {
        messages: {
          create: async (p) => {
            const n = pedidos.length;
            const user = p.messages[0].content;
            pedidos.push({ model: p.model, system: p.system, user, params: p });
            const respuestas = [];
            for (const m of user.matchAll(/<mensaje id="(\d+)">\n([\s\S]*?)\n<\/mensaje>/g)) {
              const id = Number(m[1]);
              if (omitir(n, id)) continue;
              const t = m[2].toLowerCase();
              const skills = [t.includes('planilla') ? 'uno' : null, t.includes('flujograma') ? 'dos' : null].filter(Boolean);
              respuestas.push({ id, skills: skills.length ? skills : ['ninguna'] });
              if (repetir(n, id)) respuestas.push({ id, skills: ['tres'] });
            }
            return { id: `h${n}`, model: p.model, stop_reason: 'end_turn', usage, content: [{ type: 'text', text: JSON.stringify({ respuestas }) }] };
          },
        },
      },
    };
  }

  const MENSAJES = [
    msg('Cargame el consumo del arb con la planilla de Pablo', ['uno'], { fecha: '2026-10-01T10:00:00.000Z' }),
    msg('Armame el flujograma de esta pieza nueva por favor', ['dos'], { fecha: '2026-10-01T11:00:00.000Z' }),
    msg('Necesito la planilla nueva y tambien el flujograma', ['uno', 'dos'], { fecha: '2026-10-01T12:00:00.000Z' }),
    msg('Contame que hace este script de backups viejo', [], { fecha: '2026-10-01T13:00:00.000Z' }),
    msg('Gracias, ahora pasame la ruta del archivo final', [], { fecha: '2026-10-01T14:00:00.000Z' }),
    msg('Revisame la planilla de consumos de esta semana', [], { fecha: '2026-10-01T15:00:00.000Z' }),
    msg('Mostrame el flujograma que armaste ayer', ['uno'], { fecha: '2026-10-01T16:00:00.000Z' }),
  ];

  const armar = (extra = {}) => {
    process.env.BARACK_DISPARO_DIR = path.join(dir, 'disparo');
    const r = path.join(dir, 'raiz');
    for (const s of SKILLS.slice(0, 2)) {
      fs.mkdirSync(path.join(r, '.claude/skills', s.nombre), { recursive: true });
      fs.writeFileSync(path.join(r, '.claude/skills', s.nombre, 'SKILL.md'), `---\nname: ${s.nombre}\ndescription: ${s.description}\n---\n\n# ${s.nombre}\n`, 'utf8');
    }
    return { raiz: r, soloRepo: true, dirSalida: path.join(dir, 'disparo'), dirLedger: path.join(dir, 'ledger'), ahora: new Date(2026, 9, 8, 6, 31), transcripts: { mensajes: MENSAJES, archivos: 1 }, ...extra };
  };

  it('verdad de terreno -> Haiku por lotes -> aciertos / faltantes / de mas -> informe en la carpeta permitida', async () => {
    const api = apiFalsa();
    const r = await correr(armar({ cliente: api, tamanoLote: 4 }));
    expect(api.pedidos).toHaveLength(2);
    expect(r.puntaje.global).toMatchObject({ evaluados: 7, sinRespuesta: 0, exactos: 5, positivos: 4, ningunas: 3 });
    const f = Object.fromEntries(r.puntaje.filas.map((x) => [x.skill, x]));
    expect(f.uno).toMatchObject({ debia: 3, aciertos: 2, faltantes: 1, demas: 1 });
    expect(f.dos).toMatchObject({ debia: 2, aciertos: 2, faltantes: 0, demas: 1 });
    expect(r.peores.map((p) => p.skill)).toEqual(['uno', 'dos']);
    expect(r.costoUsd).toBeGreaterThan(0);
    expect(r.resumen.linea).toMatch(/disparo de skills: 7 mensajes · 71 %/);
    const md = fs.readFileSync(path.join(dir, 'disparo', '2026-10-08.md'), 'utf8');
    expect(md).toMatch(/Prueba de disparo de skills — 2026-10-08/);
    expect(md).toMatch(/FALTANTE: "Mostrame el flujograma que armaste ayer"/);
    expect(md).toMatch(/DE MÁS: "Revisame la planilla de consumos de esta semana"/);
    expect(fs.readdirSync(path.join(dir, 'disparo'))).toEqual(['2026-10-08.md']);
    expect(leerLedger('2026-10', path.join(dir, 'ledger')).map((e) => e.tarea)).toEqual(['disparo-skills:haiku', 'disparo-skills:haiku']);
  });

  it('Haiku 5.5 con esfuerzo bajo, esquema, sin fallback y con el mismo prefijo en todos los lotes (se cachea)', async () => {
    const api = apiFalsa();
    await correr(armar({ cliente: api, tamanoLote: 3 }));
    expect(api.pedidos.length).toBeGreaterThanOrEqual(3);
    for (const p of api.pedidos) {
      expect(p.model).toBe('claude-haiku-5-5');
      expect(p.params.output_config.effort).toBe('low');
      expect(p.params.output_config.format.schema.properties.respuestas).toBeTruthy();
      expect(p.params.fallbacks).toBeUndefined();
      expect(p.system).toEqual(api.pedidos[0].system);
      expect(p.system[0].cache_control).toEqual({ type: 'ephemeral' });
    }
  });

  it('un id que el modelo no devuelve se reintenta UNA vez y entra al puntaje (no se cuenta como "ninguna")', async () => {
    const api = apiFalsa({ omitir: (n, id) => n === 0 && id === 1 });
    const r = await correr(armar({ cliente: api, tamanoLote: 4 }));
    expect(api.pedidos).toHaveLength(3);
    expect(api.pedidos[2].user).toContain('<mensaje id="1">');
    expect(api.pedidos[2].user).not.toContain('<mensaje id="2">');
    expect(r.puntaje.global).toMatchObject({ evaluados: 7, sinRespuesta: 0 });
    expect(leerLedger('2026-10', path.join(dir, 'ledger')).map((e) => e.tarea).at(-1)).toBe('disparo-skills:haiku:reintento');
    expect(fs.readFileSync(path.join(dir, 'disparo', '2026-10-08.md'), 'utf8')).toMatch(/reintento: sí/);
  });

  it('si despues del reintento sigue faltando, ese mensaje queda fuera del puntaje (no suma faltantes ni aciertos)', async () => {
    const api = apiFalsa({ omitir: (n, id) => id === 1 });
    const r = await correr(armar({ cliente: api, tamanoLote: 4 }));
    expect(r.puntaje.global).toMatchObject({ evaluados: 6, sinRespuesta: 1 });
    expect(r.puntaje.filas.find((x) => x.skill === 'uno').debia).toBe(2); // el id 1 era de uno y no se midio
    expect(r.resumen.linea).toMatch(/1 sin respuesta/);
  });

  it('un id repetido tampoco se mide a la primera: se reintenta', async () => {
    const api = apiFalsa({ repetir: (n, id) => n === 0 && id === 2 });
    const r = await correr(armar({ cliente: api, tamanoLote: 4 }));
    expect(api.pedidos).toHaveLength(3);
    expect(r.puntaje.global.sinRespuesta).toBe(0);
  });

  it('--simular no llama ni escribe: arma la verdad de terreno y estima el costo', async () => {
    const api = apiFalsa();
    const r = await correr(armar({ cliente: api, simular: true }));
    expect(r.simulado).toBe(true);
    expect(api.pedidos).toEqual([]);
    expect(r.items).toHaveLength(7);
    expect(r.estimadoUsd).toBeGreaterThan(0);
    expect(r.lotes).toBe(1);
    expect(fs.existsSync(path.join(dir, 'disparo'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'ledger'))).toBe(false);
  });

  it('sin mensajes la prueba tira (un 0 no es un resultado) y sin skills tambien', async () => {
    await expect(correr(armar({ cliente: apiFalsa(), transcripts: { mensajes: [] } }))).rejects.toThrow(/verdad de terreno quedo vacia/);
    await expect(correr(armar({ cliente: apiFalsa(), raiz: path.join(dir, 'vacia') }))).rejects.toThrow(/no encuentro ningun skill/);
  });

  it('ROJO: no escribe fuera de su carpeta ni toca los skills', async () => {
    const o = armar({ cliente: apiFalsa() });
    const antes = fs.readFileSync(path.join(o.raiz, '.claude/skills/uno/SKILL.md'), 'utf8');
    await correr(o);
    expect(fs.readFileSync(path.join(o.raiz, '.claude/skills/uno/SKILL.md'), 'utf8')).toBe(antes);
    expect(fs.readdirSync(dir).sort()).toEqual(['disparo', 'ledger', 'raiz']);
    // una carpeta de salida fuera de las permitidas (la de BARACK_DISPARO_DIR y .sgc-cache) se rechaza antes de escribir
    await expect(correr(armar({ cliente: apiFalsa(), dirSalida: path.join(dir, 'no-permitida') }))).rejects.toThrow(/no esta entre las permitidas/);
    expect(fs.existsSync(path.join(dir, 'no-permitida'))).toBe(false);
  });
});

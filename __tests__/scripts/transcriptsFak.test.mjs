// @vitest-environment node
/**
 * Tests de scripts/_lib/transcriptsFak.mjs — el lector en streaming de los transcripts de Claude Code.
 *
 * Todo con jsonl chicos escritos en una carpeta temporal, con la FORMA de los transcripts reales (medida el
 * 08/10/2026): `origin.kind`, `isSidechain`, `isMeta`, `tool_use` de nombre Skill y un `prompt_snapshot` que
 * trae el texto `"name":"Skill","input"` en la lista de herramientas (y NO es una carga). Sin red, sin los
 * transcripts de verdad: tiene que pasar en el CI.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as T from '../../scripts/_lib/transcriptsFak.mjs';

const NO_ES = T.cargarNoEsDeFak();

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcripts-test-')); });
afterEach(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

let n = 0;
const ts = (dia = 1) => `2026-10-${String(dia).padStart(2, '0')}T10:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}.000Z`;
const base = (extra) => ({ uuid: `u${++n}`, timestamp: ts(extra?.dia), sessionId: 'ses-1', ...extra });
const humano = (texto, extra = {}) => base({ type: 'user', message: { role: 'user', content: texto }, origin: { kind: 'human' }, ...extra });
const cargaSkill = (skill, id, extra = {}) => base({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Skill', input: { skill } }] }, ...extra });
const resultado = (id) => base({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const jsonl = (objs) => objs.map((o) => JSON.stringify(o)).join('\n') + '\n';
const escribir = (rel, objs, mtime = null) => {
  const ruta = path.join(dir, rel);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, typeof objs === 'string' ? objs : jsonl(objs), 'utf8');
  if (mtime) fs.utimesSync(ruta, mtime, mtime);
  return ruta;
};

/** Una sesion con todos los casos raros juntos. */
const sesionCompleta = () => [
  base({ type: 'attachment', attachment: { type: 'prompt_snapshot', tools: [{ name: 'Skill', input: { skill: 'fantasma' } }] } }),
  humano('Necesito cargar el consumo nuevo en el arb'),
  cargaSkill('arb-operar', 't1'),
  cargaSkill('arb-operar', 't1'), // la misma carga repetida en otra linea / otro archivo
  resultado('t1'),
  cargaSkill('carga-arb', 't2'),
  base({ type: 'user', message: { role: 'user', content: '<task-notification>termino la tarea</task-notification>' }, origin: { kind: 'task-notification' } }),
  cargaSkill('imds', 't3'), // llega despues de un aviso: no la disparo el mensaje de Fak
  base({ type: 'user', isMeta: true, message: { role: 'user', content: 'Stop hook feedback: pendientes' } }),
  humano('<system-reminder>hook de cierre</system-reminder>\nexplicame mejor el flujo'),
  base({ type: 'user', message: { role: 'user', content: '<task-notification>sin origin, transcript viejo</task-notification>' } }),
  base({ type: 'user', message: { role: 'user', content: 'dale, segui con el siguiente paso' } }), // transcript viejo, sin origin: es de Fak
  humano('encargo de un subagente', { isSidechain: true }),
  cargaSkill('flujogramas', 't4', { isSidechain: true }),
  base({ type: 'user', message: { role: 'user', content: 'otra sesion me manda esto' }, origin: { kind: 'peer' } }),
  humano('ultimo mensaje del dia'),
];

describe('transcriptsFak · lo puro', () => {
  it('la lista no_es_de_fak sale del canon (no hay otra copia) y tira si no se puede leer', () => {
    expect(NO_ES).toContain('<task-notification');
    expect(NO_ES.length).toBeGreaterThan(5);
    expect(() => T.cargarNoEsDeFak(path.join(dir, 'no-existe.json'))).toThrow(/no puedo leer/);
    const vacio = path.join(dir, 'canon.json');
    fs.writeFileSync(vacio, JSON.stringify({ otra_cosa: 1 }));
    expect(() => T.cargarNoEsDeFak(vacio)).toThrow(/no trae la lista/);
  });

  it('quitarAvisos saca los system-reminder de cualquier parte del mensaje', () => {
    expect(T.quitarAvisos('<system-reminder>a</system-reminder>\nhola <system-reminder>b</system-reminder>')).toBe('hola');
  });

  it('mensajeDeFak: origin.kind manda; sin origin valen las reglas viejas; meta, compactado y sidechain no son de Fak', () => {
    const msg = (c, extra = {}) => ({ type: 'user', message: { content: c }, ...extra });
    expect(T.mensajeDeFak(msg('hola', { origin: { kind: 'human' } }), NO_ES)).toBe('hola');
    expect(T.mensajeDeFak(msg('hola', { origin: { kind: 'peer' } }), NO_ES)).toBe('');
    expect(T.mensajeDeFak(msg('hola', { origin: { kind: 'task-notification' } }), NO_ES)).toBe('');
    expect(T.mensajeDeFak(msg('hola'), NO_ES)).toBe('hola');
    expect(T.mensajeDeFak(msg('<task-notification>x'), NO_ES)).toBe('');
    expect(T.mensajeDeFak(msg('Stop hook feedback:\nalgo'), NO_ES)).toBe('');
    expect(T.mensajeDeFak(msg('hola', { isMeta: true }), NO_ES)).toBe('');
    expect(T.mensajeDeFak(msg('resumen', { isCompactSummary: true }), NO_ES)).toBe('');
    expect(T.mensajeDeFak(msg('hola', { isSidechain: true }), NO_ES)).toBe('');
    // lo que la app escribe como si fuera de Fak (el boton de reintentar, el aviso de limite de uso...)
    for (const automatico of ['Intentar nuevamente', 'Alcancé mi límite de uso mientras trabajabas, pero ya se restableció. Continúa donde lo dejaste.', 'The app was quit while you were working. Please continue from where you left off.']) {
      expect(T.mensajeDeFak(msg(automatico, { origin: { kind: 'human' } }), NO_ES), automatico).toBe('');
    }
    expect(T.AUTOMATICOS_DE_LA_APP.every((p) => NO_ES.includes(p))).toBe(true);
    expect(T.mensajeDeFak({ type: 'assistant', message: { content: 'hola' } }, NO_ES)).toBe('');
    // un mensaje en bloques: se queda con los de texto que no son avisos
    expect(T.mensajeDeFak(msg([{ type: 'text', text: '[Image: source: x.png]' }, { type: 'text', text: 'mirá esto' }, { type: 'image', source: {} }]), NO_ES)).toBe('mirá esto');
  });

  it('cargasDeSkill: solo un tool_use Skill de un asistente (el prompt_snapshot no cuenta); normaliza mayusculas y barra', () => {
    expect(T.cargasDeSkill(cargaSkill('Flujogramas', 'a'))).toEqual([{ id: 'a', skill: 'flujogramas' }]);
    expect(T.cargasDeSkill(cargaSkill('/imds', 'b'))).toEqual([{ id: 'b', skill: 'imds' }]);
    expect(T.cargasDeSkill(cargaSkill('imds', 'c', { isSidechain: true }))).toEqual([]);
    expect(T.cargasDeSkill({ type: 'attachment', attachment: { tools: [{ name: 'Skill', input: { skill: 'x' } }] } })).toEqual([]);
    expect(T.cargasDeSkill({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'z', name: 'Bash', input: { command: 'ls' } }] } })).toEqual([]);
    expect(T.nombreCorto('anthropic-skills:xlsx')).toBe('xlsx');
  });

  it('lineaInteresa: el prefiltro deja pasar mensajes y cargas, y corta los resultados de herramientas', () => {
    expect(T.lineaInteresa(JSON.stringify(humano('hola')))).toBe(true);
    expect(T.lineaInteresa(Buffer.from(JSON.stringify(cargaSkill('imds', 'q'))))).toBe(true);
    expect(T.lineaInteresa(JSON.stringify(resultado('t1')))).toBe(false);
    expect(T.lineaInteresa(Buffer.from(JSON.stringify(resultado('t1'))))).toBe(false);
    expect(T.lineaInteresa(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hola' }] } }))).toBe(false);
  });
});

describe('transcriptsFak · una sesion entera', () => {
  it('mensajes reales, cargas con su mensaje anterior, turno y los 3 siguientes', async () => {
    const ruta = escribir('c/ses-1.jsonl', sesionCompleta());
    const r = await T.leerArchivo(ruta, { noEsDeFak: NO_ES });
    expect(r.mensajes.map((m) => m.texto)).toEqual([
      'Necesito cargar el consumo nuevo en el arb',
      'explicame mejor el flujo',
      'dale, segui con el siguiente paso',
      'ultimo mensaje del dia',
    ]);
    const [m1, m2] = r.mensajes;
    expect(m1.cargas).toEqual(['arb-operar', 'arb-operar', 'carga-arb']); // sin dedupe (no hay `vistos`)
    expect(m1.skillsAntes).toEqual([]);
    expect(m2.skillsAntes.sort()).toEqual(['arb-operar', 'carga-arb', 'imds']);
    expect(m2.sesion).toBe('ses-1');
    expect(r.cargas.some((c) => c.skill === 'fantasma' || c.skill === 'flujogramas')).toBe(false);
    const t3 = r.cargas.find((c) => c.skill === 'imds');
    expect(t3.mismoTurno).toBe(false); // despues de un aviso de tarea
    expect(t3.mensajeAnterior).toBe('Necesito cargar el consumo nuevo en el arb');
    expect(t3.siguientes).toHaveLength(3);
  });

  it('con `vistos` la misma carga no se cuenta dos veces; los 3 siguientes son los mensajes de Fak que vinieron despues', async () => {
    const ruta = escribir('c/ses-1.jsonl', sesionCompleta());
    const r = await T.leerArchivo(ruta, { noEsDeFak: NO_ES, vistos: new Set() });
    const t1 = r.cargas.filter((c) => c.skill === 'arb-operar');
    expect(t1).toHaveLength(1);
    expect(t1[0]).toMatchObject({ mismoTurno: true, mensajeAnterior: 'Necesito cargar el consumo nuevo en el arb', nombre: 'arb-operar' });
    expect(t1[0].siguientes).toEqual(['explicame mejor el flujo', 'dale, segui con el siguiente paso', 'ultimo mensaje del dia']);
    expect(r.mensajes[0].cargas).toEqual(['arb-operar', 'carga-arb']);
  });

  it('un mensaje de Fak sin cargas en su turno queda con cargas vacias (el "ninguna" de la prueba de disparo)', async () => {
    const ruta = escribir('c/ses-2.jsonl', [humano('contame que hace este script de backups'), cargaSkill('imds', 'x1', { isSidechain: true }), humano('gracias, ahora pasame la ruta')]);
    const r = await T.leerArchivo(ruta, { noEsDeFak: NO_ES });
    expect(r.mensajes.map((m) => m.cargas)).toEqual([[], []]);
    expect(r.cargas).toEqual([]);
  });

  it('sin mensaje anterior: la carga igual sale, con mensajeAnterior null y mismoTurno false', async () => {
    const ruta = escribir('c/ses-3.jsonl', [cargaSkill('imds', 'y1')]);
    const r = await T.leerArchivo(ruta, { noEsDeFak: NO_ES });
    expect(r.cargas).toHaveLength(1);
    expect(r.cargas[0]).toMatchObject({ mensajeAnterior: null, mismoTurno: false });
  });

  it('`desde` recorta lo que sale pero conserva el estado: el mensaje anterior de una carga puede ser de antes', async () => {
    const ruta = escribir('c/ses-4.jsonl', [
      humano('mensaje viejo del dia uno', { dia: 1 }),
      cargaSkill('imds', 'v1', { dia: 1 }),
      cargaSkill('carga-arb', 'v2', { dia: 5 }),
      humano('mensaje nuevo del dia cinco', { dia: 5 }),
      cargaSkill('cad-design', 'v3', { dia: 5 }),
    ]);
    const r = await T.leerArchivo(ruta, { noEsDeFak: NO_ES, desde: new Date('2026-10-03T00:00:00Z') });
    expect(r.mensajes.map((m) => m.texto)).toEqual(['mensaje nuevo del dia cinco']);
    expect(r.cargas.map((c) => c.skill)).toEqual(['carga-arb', 'cad-design']);
    expect(r.cargas[0].mensajeAnterior).toBe('mensaje viejo del dia uno');
  });

  it('lineas gigantes entre medio y caracteres de varios bytes: ninguna se pierde ni se parte (bloques de 4 MB)', async () => {
    const lineas = [];
    for (let i = 0; i < 3000; i++) lineas.push(JSON.stringify(humano(`mensaje ${i} ${'ñé'.repeat(700)}`)));
    lineas.splice(1500, 0, JSON.stringify(resultado('grande')).replace('"ok"', `"${'ñ'.repeat(3_000_000)}"`)); // ~6 MB de resultado de herramienta
    const ruta = escribir('c/grande.jsonl', lineas.join('\n') + '\n');
    expect(fs.statSync(ruta).size).toBeGreaterThan(9_000_000);
    const cuenta = { lineas: 0 };
    const r = await T.leerArchivo(ruta, { noEsDeFak: NO_ES });
    expect(r.mensajes).toHaveLength(3000);
    expect(r.mensajes[0].texto.startsWith('mensaje 0 ñéñé')).toBe(true);
    expect(r.mensajes[2999].texto).toBe(`mensaje 2999 ${'ñé'.repeat(700)}`);
    expect(r.lineas).toBe(3001);
    void cuenta;
  });

  it('un archivo sin salto de linea final tambien se lee completo', async () => {
    const ruta = escribir('c/sin-fin.jsonl', JSON.stringify(humano('ultima linea sin salto')));
    const r = await T.leerArchivo(ruta, { noEsDeFak: NO_ES });
    expect(r.mensajes.map((m) => m.texto)).toEqual(['ultima linea sin salto']);
  });
});

describe('transcriptsFak · carpetas y archivos', () => {
  it('carpetasDelRepo: la principal y las de sus worktrees, no las de otro proyecto', () => {
    for (const nombre of ['C--Dev-BarackMercosul', 'C--Dev-BarackMercosul--claude-worktrees-abc', 'C--Dev-BarackMercosul-otra', 'C--ClaudeBarack', 'C--Dev-BarackMercosul--claude-worktrees-def']) {
      fs.mkdirSync(path.join(dir, nombre), { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'C--Dev-BarackMercosul--claude-worktrees-archivo'), 'no es carpeta');
    const r = T.carpetasDelRepo({ base: dir, repo: 'C:\\Dev\\BarackMercosul' }).map((p) => path.basename(p)).sort();
    expect(r).toEqual(['C--Dev-BarackMercosul', 'C--Dev-BarackMercosul--claude-worktrees-abc', 'C--Dev-BarackMercosul--claude-worktrees-def']);
    expect(T.slugDeRepo('C:\\Dev\\BarackMercosul')).toBe('C--Dev-BarackMercosul');
  });

  it('listarJsonl: solo el primer nivel y solo lo modificado desde `desde` (los viejos ni se abren)', () => {
    escribir('c/nuevo.jsonl', [humano('hola desde el nuevo')]);
    escribir('c/viejo.jsonl', [humano('hola desde el viejo')], new Date('2026-01-01T00:00:00Z'));
    escribir('c/uuid-de-sesion/subagents/agente.jsonl', [humano('encargo de un subagente')]);
    escribir('c/notas.txt', 'no es jsonl');
    const todos = T.listarJsonl([path.join(dir, 'c')]).map((a) => a.nombre).sort();
    expect(todos).toEqual(['nuevo.jsonl', 'viejo.jsonl']);
    const recientes = T.listarJsonl([path.join(dir, 'c')], { desde: new Date('2026-09-01T00:00:00Z') }).map((a) => a.nombre);
    expect(recientes).toEqual(['nuevo.jsonl']);
  });

  it('leerTranscripts: junta carpetas, dedupe entre archivos (un resume repite el historial), ordena por fecha y respeta `tope`', async () => {
    const compartida = [humano('mensaje compartido por dos archivos', { uuid: 'fijo-1', dia: 2 }), cargaSkill('imds', 'toolu_fijo', { dia: 2 })];
    escribir('a/s1.jsonl', [...compartida, humano('solo en el primero', { dia: 3 })]);
    escribir('b/s2.jsonl', [...compartida, humano('solo en el segundo', { dia: 4 })]);
    const r = await T.leerTranscripts({ carpetas: [path.join(dir, 'a'), path.join(dir, 'b')], desde: new Date('2026-09-01T00:00:00Z'), noEsDeFak: NO_ES });
    expect(r.archivos).toBe(2);
    expect(r.mensajes.map((m) => m.texto)).toEqual(['mensaje compartido por dos archivos', 'solo en el primero', 'solo en el segundo']);
    expect(r.cargas).toHaveLength(1);
    expect(r.truncado).toBe(false);
    expect(r.mensajes.map((m) => m.fecha)).toEqual([...r.mensajes.map((m) => m.fecha)].sort());

    const corto = await T.leerTranscripts({ carpetas: [path.join(dir, 'a'), path.join(dir, 'b')], desde: new Date('2026-09-01T00:00:00Z'), noEsDeFak: NO_ES, tope: 1 });
    expect(corto.archivos).toBe(1);
    expect(corto.truncado).toBe(true);
  });

  it('leerTranscripts sin `desde` mira los ultimos 90 dias a partir de `ahora` (los tests no dependen del reloj)', async () => {
    escribir('a/reciente.jsonl', [humano('hola')]);
    escribir('a/viejo.jsonl', [humano('hola')], new Date('2026-01-01T00:00:00Z'));
    const hoy = fs.statSync(path.join(dir, 'a', 'reciente.jsonl')).mtime;
    const r = await T.leerTranscripts({ carpetas: [path.join(dir, 'a')], ahora: hoy, noEsDeFak: NO_ES });
    expect(r.archivosEncontrados).toBe(1);
    expect(new Date(r.desde).getTime()).toBe(hoy.getTime() - 90 * 86400e3);
  });
});

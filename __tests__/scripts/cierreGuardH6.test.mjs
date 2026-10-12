// __tests__/scripts/cierreGuardH6.test.mjs
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CANON, relevarTranscript, nuevoEstadoRelevamiento, pasada, subagentesDe, resultadoRelevamiento, entregablesSinAbrir,
} from '../../scripts/_lib/cierreGuard.mjs';

const T = (min) => new Date(Date.UTC(2026, 9, 10, 12, 0) + min * 60000).toISOString();
const MS = (min) => Date.parse(T(min));
const fak = (min, texto) => ({ type: 'user', timestamp: T(min), message: { role: 'user', content: texto } });
const uso = (min, id, name, input) => ({ type: 'assistant', ...(min == null ? {} : { timestamp: T(min) }), message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
const res = (min, id) => ({ type: 'user', timestamp: T(min), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const HO = (n) => ({ file_path: `C:\\Dev\\BarackMercosul\\exports\\X\\HO-${n}.pdf` });

let raiz; let n = 0;
beforeAll(() => { raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-h6-')); });
afterAll(() => { try { fs.rmSync(raiz, { recursive: true, force: true }); } catch { /* temporal */ } });

// Registro con un subagente en <sesion>/subagents/, como lo deja Claude Code. Una fila puede ser f(repo).
function registro(principal, sub = []) {
  const dir = path.join(raiz, `s${++n}`);
  fs.mkdirSync(path.join(dir, 'ses', 'subagents'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'repo'), { recursive: true });
  // Ruta larga: en un TEMP con nombres 8.3 (FACUND~1) `dentroDelRepo` resuelve el `~` solo si la carpeta del archivo
  // existe en disco, y `.claude/hooks` no se crea en estos tests. Con la ruta larga desde el vamos no hace falta.
  const repo = fs.realpathSync.native(path.join(dir, 'repo'));
  const jsonl = (filas) => `${filas.map((f) => JSON.stringify(typeof f === 'function' ? f(repo) : f)).join('\n')}\n`;
  const tp = path.join(dir, 'ses.jsonl');
  fs.writeFileSync(tp, jsonl(principal));
  if (sub.length) fs.writeFileSync(path.join(dir, 'ses', 'subagents', 'agent-a1.jsonl'), jsonl(sub));
  return { tp, repo };
}

// El orden opuesto al de produccion: todos los subagentes antes que el principal (el intercalado extremo).
async function subagentesPrimero(tp, repo) {
  const st = nuevoEstadoRelevamiento();
  for (const f of subagentesDe(tp)) await pasada(f, st, { completa: false, repo });
  await pasada(tp, st, { completa: true, repo });
  return resultadoRelevamiento(st);
}

describe('H6 · las miradas de un subagente no desalojan las del turno', () => {
  const viejas = Array.from({ length: 650 }, (_, i) => [uso(10, `sv${i}`, 'Read', { file_path: `C:\\Viejo\\v-${i}.pdf` }), res(10, `sv${i}`)]).flat();
  const cierre = 'Quedó en exports/X/HO-1.pdf.';
  const archivo = { nombre: 'ho-1.pdf', rel: 'exports/X/HO-1.pdf', mtimeMs: MS(100) + 20000 };

  it('verde: con 650 miradas viejas de subagente, la del turno sigue y el chequeo 4 no reclama', async () => {
    const { tp, repo } = registro([fak(0, 'arranca'), fak(100, 'armame la hoja HO-1'), uso(101, 'm1', 'Read', HO(1)), res(101, 'm1')], viejas);
    const rel = await relevarTranscript(tp, { repo });
    expect(rel.miradas.some((m) => m.txt.endsWith('/ho-1.pdf'))).toBe(true);
    expect(entregablesSinAbrir(cierre, rel, [archivo])).toEqual([]);
  });

  it('verde: 700 miradas de subagente DENTRO del turno quedan todas (12/10: con tope de 600, viejo y nuevo guardaban 600 distintas)', async () => {
    const delTurno = Array.from({ length: 700 }, (_, i) => [uso(101, `st${i}`, 'Read', { file_path: `C:\\Turno\\t-${i}.pdf` }), res(101, `st${i}`)]).flat();
    const { tp, repo } = registro([fak(0, 'arranca'), fak(100, 'revisá todo')], [...viejas, ...delTurno]);
    const rel = await relevarTranscript(tp, { repo });
    expect(rel.miradas).toHaveLength(700);                       // las 650 viejas afuera, las 700 del turno adentro
    expect(rel.miradas.some((m) => m.txt.endsWith('/t-0.pdf'))).toBe(true);
    expect(rel.miradas.some((m) => m.txt.endsWith('/t-699.pdf'))).toBe(true);
  });

  it('rojo: sin mirada del turno, el chequeo 4 reclama igual (la poda no tapa la falta)', async () => {
    const { tp, repo } = registro([fak(0, 'arranca'), fak(100, 'armame la hoja HO-1')], viejas);
    const rel = await relevarTranscript(tp, { repo });
    expect(entregablesSinAbrir(cierre, rel, [archivo])).toHaveLength(1);
  });
});

describe('H6 · corte por turno de las miradas de subagentes (por la hora del RESULTADO)', () => {
  const principal = [fak(0, 'arranca'), fak(100, 'revisá las hojas')];
  it('verde: lanzada antes del turno y terminada después, entra', async () => {
    const { tp, repo } = registro(principal, [uso(99, 'sa', 'Read', HO(2)), res(102, 'sa')]);
    const rel = await relevarTranscript(tp, { repo });
    expect(rel.miradas).toEqual([{ txt: 'c:/dev/barackmercosul/exports/x/ho-2.pdf', ts: MS(102), esRead: true }]);
  });
  it('rojo: terminada antes del turno, queda afuera', async () => {
    const { tp, repo } = registro(principal, [uso(10, 'sb', 'Read', HO(3)), res(10, 'sb')]);
    expect((await relevarTranscript(tp, { repo })).miradas).toEqual([]);
  });
});

describe('H6 · una escritura de subagente sin hora cuenta como posterior a la prueba', () => {
  const PIEZA = '.claude/hooks/correccion-guard.sh';
  const PRUEBA = 'node scripts/_probarMejora.mjs --mensaje "hola"';
  const conSub = (minSub) => registro(
    [fak(0, 'probalo con un mensaje real'), uso(5, 'p1', 'Bash', { command: PRUEBA }), res(6, 'p1')],
    [(repo) => uso(minSub, 'w1', 'Write', { file_path: path.join(repo, ...PIEZA.split('/')), content: 'x' })],
  );
  it('precondición: el canon reconoce la pieza y la prueba', () => {
    expect(new RegExp(CANON.mejora.sistema_re, 'i').test(PIEZA)).toBe(true);
    expect(new RegExp(CANON.mejora.mensajes_re, 'i').test(PIEZA)).toBe(true);
    expect(new RegExp(CANON.mejora.prueba_re, 'i').test(PRUEBA)).toBe(true);
  });
  it('verde: escrita (con hora) antes de la prueba → probada', async () => {
    const { tp, repo } = conSub(2);
    const rel = await relevarTranscript(tp, { repo });
    expect(rel.sistema.deMensajes).toEqual([PIEZA]);
    expect(rel.sistema.probada).toBe(true);
  });
  it('rojo: escrita sin hora → no probada (antes valía un seq chico contra horas)', async () => {
    const { tp, repo } = conSub(null);
    expect((await relevarTranscript(tp, { repo })).sistema.probada).toBe(false);
  });
});

describe('H6 · la respuesta no depende del orden principal/subagentes', () => {
  const principal = [
    fak(0, 'arranca'), fak(30, 'armame el informe'),
    uso(31, 'mg', 'Bash', { command: 'python scripts/gen.py' }), res(33, 'mg'),
    uso(34, 'mw', 'Write', { file_path: 'D:\\Entregas\\informe.pdf', content: 'x' }), res(34, 'mw'),
    uso(35, 'mr', 'Read', { file_path: 'D:\\Entregas\\informe.pdf' }), res(35, 'mr'),
  ];
  const sub = (conRead) => [
    uso(20, 'sg', 'Bash', { command: 'python scripts/otro.py' }), res(21, 'sg'),
    ...(conRead ? [uso(32, 'sr', 'Read', HO(3)), res(32, 'sr')] : []),
    (repo) => uso(32, 'sw', 'Write', { file_path: path.join(repo, '.claude', 'hooks', 'correccion-guard.sh'), content: 'x' }),
    uso(33, 'so', 'Read', { file_path: 'C:\\x\\abierto.pdf' }),   // sin resultado: tiene que sobrevivir al mensaje de Fak
  ];

  it('verde: subagentes primero = principal primero, campo por campo', async () => {
    const { tp, repo } = registro(principal, sub(true));
    const a = await relevarTranscript(tp, { repo });
    expect(a.entregables).toHaveLength(1);                  // que el caso ejercite lo que el orden rompia
    expect(a.ventanas.length).toBeGreaterThanOrEqual(2);
    expect(a.miradas.length).toBeGreaterThanOrEqual(3);
    expect(a.sistema.archivos.length).toBeGreaterThanOrEqual(1);
    expect(await subagentesPrimero(tp, repo)).toEqual(a);
  });

  it('rojo: la comparación no es ciega (sin el Read del subagente, difiere)', async () => {
    const r1 = registro(principal, sub(true));
    const r2 = registro(principal, sub(false));
    expect(await subagentesPrimero(r2.tp, r2.repo)).not.toEqual(await relevarTranscript(r1.tp, { repo: r1.repo }));
  });
});

describe('H8 · armar la respuesta no toca el estado', () => {
  const armar = () => {
    const st = nuevoEstadoRelevamiento();
    st.ventanas.push([MS(2), MS(3)]); st.abiertas.set('x', MS(1)); st.inicio = MS(0); st.sinVentana = true;
    return st;
  };
  it('verde: dos veces, la misma respuesta y st.ventanas intacto', () => {
    const st = armar();
    const r1 = resultadoRelevamiento(st);
    expect(resultadoRelevamiento(st).ventanas).toEqual(r1.ventanas);
    expect(st.ventanas).toHaveLength(1);
  });
  it('rojo: lo abierto y el "sin hora" salen como ventanas eternas, ordenadas', () => {
    expect(resultadoRelevamiento(armar()).ventanas).toEqual([[MS(0), Infinity], [MS(1), Infinity], [MS(2), MS(3)]]);
  });
});

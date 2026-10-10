/**
 * Tests de las reglas de la tanda (cola HOY-17, 10/10/2026) — scripts/_lib/tandaReglas.mjs, el codigo 5 del latido,
 * el renglon que suma el cierre-guard y `_orquestador.mjs --hora`. LAS DOS DIRECCIONES.
 *
 * El ROJO es el caso real del 10/10/2026 (sesion ae95ec7e, el orquestador de las 48 h): de 14:57 a 18:36 desperto 25
 * veces seguidas con el latido, relanzo, leyo el estado, escribio "sin cambios, sin novedades tuyas" y volvio a dormir;
 * y no hizo ningun pedido a la API hasta las 18:48. El VERDE es lo que hizo desde las 18:45: contesto Fak, lanzo dos
 * hijas, commiteo y mando un plan a revisar por la API. Los registros de aca son sinteticos con la forma y las horas
 * del real (el real pesa cientos de MB): la corrida sobre el real esta anotada en tandaCanon.data.json.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as T from '../../scripts/_lib/tandaReglas.mjs';
import * as H from '../../scripts/_lib/horaGuard.mjs';
import { main as latido } from '../../scripts/_latido.mjs';
import { renglonesDeLaHora, ledgerEnVentana } from '../../scripts/_orquestador.mjs';
import { decidir } from '../../scripts/_lib/cierreGuard.mjs';

// ── armado de un registro con la forma del real ───────────────────────────────────────────────
const ms = (hhmm) => Date.parse(`2026-10-10T${hhmm}:00-03:00`);
const iso = (m) => new Date(m).toISOString();
let n = 0;
const asst = (m, ...bloques) => JSON.stringify({ type: 'assistant', timestamp: iso(m), message: { role: 'assistant', content: bloques } });
const texto = (t) => ({ type: 'text', text: t });
const uso = (name, input) => ({ type: 'tool_use', id: `tu_${++n}`, name, input });
const vuelve = (m, bloque, error = false) => JSON.stringify({ type: 'user', timestamp: iso(m), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: bloque.id, is_error: error, content: 'ok' }] } });
const fak = (m, t) => JSON.stringify({ type: 'user', timestamp: iso(m), origin: { kind: 'human' }, message: { role: 'user', content: t } });
const LISTA = 'C:\\Dev\\BarackMercosul\\docs\\drafts\\LISTA_ORQUESTADOR_2026-10-10.md';

/** Un despertar del caso real: relanza el latido, lee el estado y escribe el renglon. Sin commit, sin archivos. */
function despertarQuieto(hhmm) {
  const m = ms(hhmm);
  const a = uso('Bash', { command: 'node scripts/_latido.mjs', description: 'LATIDO del orquestador (relanzado; espera 9 minutos y despierta la sesión)', run_in_background: true });
  const b = uso('Bash', { command: 'date; node scripts/_colgados.mjs; git log --oneline -1', description: 'Hora, colgados y último commit' });
  return [
    asst(m, texto(`Latido (${hhmm}): relanzo y reviso.`), a, b),
    vuelve(m + 20000, a), vuelve(m + 25000, b),
    asst(m + 40000, texto(`${hhmm}: sin cambios, nada colgado, sin novedades tuyas. Latido corriendo; vuelvo a mirar en 9 minutos.`)),
  ];
}
/** 14:40 del real: arreglo el vigilante de precios, anoto en la lista y commiteo. */
function turnoConTrabajo(hhmm) {
  const m = ms(hhmm);
  const e = uso('Edit', { file_path: 'C:\\Dev\\BarackMercosul\\scripts\\_lib\\vigilarPrecios.mjs' });
  const l = uso('Edit', { file_path: LISTA });
  const c = uso('Bash', { command: "cd C:/Dev/BarackMercosul && git add scripts/_lib/vigilarPrecios.mjs && git commit -q -m 'fix(precios): el apostrofo' -- scripts/_lib/vigilarPrecios.mjs && git push -q origin main" });
  return [asst(m, texto('Test en verde (74). Tacho H19 en la cola y commiteo el chico con sus rutas.'), e, l, c), vuelve(m + 5000, e), vuelve(m + 6000, l), vuelve(m + 30000, c)];
}
/** 18:43-18:48 del real: Fak contesta, se lanzan dos hijas y sale el primer pedido a la API. */
function turnoVerde() {
  const m = ms('18:43');
  const h1 = uso('mcp__scheduled-tasks__run_scheduled_task', { taskId: 'hija-cierre-h5-h6-20261010' });
  const h2 = uso('mcp__ccd_session_mgmt__send_message', { session_id: 'local_218252c2', message: '[ENCARGO E261010-ca84]' });
  const api = uso('Bash', { command: 'cd C:/Dev/BarackMercosul && node scripts/_apiTarea.mjs --tarea P55-revision --pedido x.md --adjunto docs/PLAN_P55.md --salida y.md --modelo opus --effort medium', description: 'Revisión del plan P55 por la API (Opus, créditos)' });
  return [
    fak(ms('18:40'), '¿te quedaste esperándome? es gravísimo. pensá la mejor manera'),
    asst(m, texto('Tenés razón: a las 14:40 me quedé esperando una respuesta tuya en vez de decidir. Decido yo y sigo.'), h1, h2, api),
    vuelve(m + 60000, h1), vuelve(m + 61000, h2), vuelve(ms('18:48'), api),
  ];
}

let dir;
const escribir = (nombre, lineas) => { const p = path.join(dir, nombre); fs.writeFileSync(p, `${lineas.join('\n')}\n`, 'utf8'); return p; };
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanda-test-')); n = 0; });
afterEach(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* nada */ } });
const sinCommits = () => 0;

// ── 1. lo que se lee del registro ─────────────────────────────────────────────────────────────
describe('tandaReglas · lo que paso se lee del registro', () => {
  it('cuenta lo que VOLVIO bien: un commit, un pedido a la API, archivos, subagentes y hijas', () => {
    const lineas = [...turnoConTrabajo('14:40'), ...turnoVerde()];
    const ag = uso('Agent', { subagent_type: 'auditor', prompt: 'x' });
    lineas.push(asst(ms('18:50'), ag));
    const ev = T.recorrer(lineas, ms('14:00'), { lista: LISTA });
    expect(ev).toMatchObject({ ok: true, textoChars: expect.any(Number) });
    expect(ev.commits).toHaveLength(1);
    expect(ev.api).toHaveLength(1);
    expect(ev.escrituras).toHaveLength(1);          // vigilarPrecios.mjs; la lista NO cuenta
    expect(ev.hijas).toHaveLength(2);
    expect(ev.agentes).toHaveLength(1);
    expect(ev.fak).toHaveLength(1);
  });

  it('NO cuenta: lo que fallo, --estimar, un grep que nombra el script, git log, y lo anterior a la hora', () => {
    const fallo = uso('Bash', { command: 'node scripts/_apiTarea.mjs --tarea x --pedido p.md --salida s.md' });
    const estimar = uso('Bash', { command: 'node scripts/_apiTarea.mjs --tarea x --pedido p.md --estimar' });
    const grep = uso('Bash', { command: 'grep -n "node scripts/_apiTarea.mjs" docs/x.md; git log --oneline -3 --grep commit' });
    const commitRoto = uso('Bash', { command: 'git commit -m "x" -- a.mjs' });
    const prosa = uso('Bash', { command: "git add a.md && git diff --stat\ncat <<'EOF'\nnode scripts/_apiTarea.mjs --tarea no --pedido p --salida s\ngit commit -m prosa\nEOF" });
    const m = ms('15:00');
    const lineas = [
      ...turnoConTrabajo('13:00'),                                  // antes de la hora pedida
      asst(m, fallo, estimar, grep, commitRoto, prosa),
      vuelve(m + 1000, fallo, true), vuelve(m + 2000, estimar), vuelve(m + 3000, grep), vuelve(m + 4000, commitRoto, true), vuelve(m + 5000, prosa),
    ];
    const ev = T.recorrer(lineas, ms('14:00'));
    expect(ev.api).toHaveLength(0);
    expect(ev.commits).toHaveLength(0);
    expect(ev.escrituras).toHaveLength(0);
    expect(ev.cubre).toBe(true);                                    // el tramo empieza antes de las 14:00
  });

  it('tambien cuenta `_claude.mjs --preguntar`; un subagente (isSidechain) no es la sesion; `hastaMs` corta', () => {
    const p = uso('Bash', { command: 'node scripts/_claude.mjs --preguntar "¿esto cierra?" --modelo opus' });
    const lado = JSON.stringify({ type: 'assistant', isSidechain: true, timestamp: iso(ms('15:01')), message: { content: [uso('Write', { file_path: 'C:\\x\\a.mjs' })] } });
    const lineas = [asst(ms('15:00'), p), vuelve(ms('15:01'), p), lado, ...turnoVerde()];
    expect(T.recorrer(lineas, ms('14:00'))).toMatchObject({ api: [expect.any(Number), expect.any(Number)], escrituras: [] });
    expect(T.recorrer(lineas, ms('14:00'), { hastaMs: ms('16:00') }).api).toHaveLength(1);
  });

  it('lee el archivo desde el final y encuentra el registro de una sesion por su id', () => {
    const home = dir;
    fs.mkdirSync(path.join(home, '.claude', 'projects', 'C--Dev-X'), { recursive: true });
    const p = path.join(home, '.claude', 'projects', 'C--Dev-X', 'ses-1.jsonl');
    fs.writeFileSync(p, `${[...turnoConTrabajo('14:40'), ...despertarQuieto('14:57')].join('\n')}\n`);
    expect(T.buscarRegistro('ses-1', home)).toBe(p);
    expect(T.buscarRegistro('otra', home)).toBeNull();
    expect(T.leerEventos(p, ms('14:00')).commits).toHaveLength(1);
    expect(T.inicioDelRegistro(p)).toBe(ms('14:40'));
    expect(T.leerEventos(path.join(dir, 'no-existe.jsonl'), 0)).toMatchObject({ ok: false });
  });
});

// ── 2. la regla de no quedarse parado ─────────────────────────────────────────────────────────
describe('tandaReglas · despertares seguidos sin avance con una pregunta abierta (el 10/10, 14:57 → 18:36)', () => {
  const tarde = () => [...turnoConTrabajo('14:40'), ...despertarQuieto('14:48'), ...despertarQuieto('14:57'), ...despertarQuieto('15:07'), ...despertarQuieto('15:16'), ...turnoVerde(), ...despertarQuieto('18:56')];
  const despertar = (registro, hhmm, extra = {}) => T.registrarDespertar({ sesion: 'orq', ahora: new Date(ms(hhmm)), hastaMs: ms(hhmm), home: dir, registro, commitsRepo: sinCommits, ...extra });

  it('ROJO: el caso real. La cuenta sube 1, 2, 3 y al tercero es PARADO; el aviso dice que hacer', () => {
    const reg = escribir('orq.jsonl', tarde());
    expect(despertar(reg, '14:47', { inicioMs: ms('14:38') })).toMatchObject({ ok: true, sinAvance: 0, parado: false });   // el turno de las 14:40 commiteo
    expect(despertar(reg, '14:56')).toMatchObject({ sinAvance: 1, parado: false });
    expect(despertar(reg, '15:06')).toMatchObject({ sinAvance: 2, parado: false });
    const r = despertar(reg, '15:15');
    expect(r).toMatchObject({ sinAvance: 3, parado: true });
    expect(r.pregunta.por.join(' ')).toMatch(/sin novedades tuyas/);
    const aviso = T.textoAvisoParado(r);
    expect(aviso).toMatch(/^PARADO: 3 despertares seguidos/);
    expect(aviso).toMatch(/lo que no depende de la respuesta/);
  });

  it('VERDE: Fak contesta, se lanzan hijas y sale un pedido a la API → la cuenta vuelve a 0', () => {
    const reg = escribir('orq.jsonl', tarde());
    for (const h of ['14:47', '14:56', '15:06', '15:15']) despertar(reg, h, { inicioMs: ms('14:38') });
    despertar(reg, '18:36', { inicioMs: ms('18:27') });          // el ultimo despertar quieto del real, antes de que Fak escriba
    const r = despertar(reg, '18:55');
    expect(r).toMatchObject({ sinAvance: 0, parado: false, hablaFak: true });
    expect(r.avance.por.join(' ')).toMatch(/hija/);
    expect(r.avance.por.join(' ')).toMatch(/API/);
  });

  it('VERDE: sin pregunta abierta, tres despertares quietos NO son «parado» (espera a una hija, por ejemplo)', () => {
    const quieto = (hhmm) => [asst(ms(hhmm), texto(`${hhmm}: la hija sigue con el auditor.`))];
    const reg = escribir('h.jsonl', [...quieto('14:48'), ...quieto('14:57'), ...quieto('15:07'), ...quieto('15:16')]);
    for (const h of ['14:56', '15:06']) despertar(reg, h, { inicioMs: ms('14:40') });
    expect(despertar(reg, '15:15')).toMatchObject({ sinAvance: 3, parado: false, pregunta: { abierta: false } });
  });

  it('VERDE: un commit de OTRA sesion en el repo (una hija) es avance', () => {
    const reg = escribir('orq.jsonl', tarde());
    despertar(reg, '14:56', { inicioMs: ms('14:50') });
    expect(despertar(reg, '15:06', { commitsRepo: () => 2 })).toMatchObject({ sinAvance: 0 });
  });

  it('la lista tambien abre la pregunta: renglones de «Lo que necesita a Fak», sin los tachados ni los [x]', () => {
    const lista = path.join(dir, 'lista.md');
    fs.writeFileSync(lista, '# Lista\n\n## Lo pedido\n- [ ] uno\n\n## Lo que necesita a Fak (para cuando vuelva)\n\n- **P84** (el modo de arranque de las hijas)\n- [x] P83 contestada\n- ~~P55 contestada~~\n- P83 contestada el 10/10 (queda aviso)\n- P55: resuelta a las 18:58\n\n## Registro\n- 11:00 arranqué\n');
    expect(T.preguntasEnLista(lista)).toEqual(['P84 (el modo de arranque de las hijas)']);
    expect(T.preguntasEnLista(path.join(dir, 'no.md'))).toEqual([]);
    const quieto = (hhmm) => [asst(ms(hhmm), texto(`${hhmm}: sin cambios.`))];
    const reg = escribir('q.jsonl', [...quieto('14:48'), ...quieto('14:57'), ...quieto('15:07')]);
    for (const h of ['14:56', '15:06']) despertar(reg, h, { inicioMs: ms('14:40'), lista });
    expect(despertar(reg, '15:15', { lista })).toMatchObject({ sinAvance: 3, parado: true });
  });

  it('falla ABIERTO: sin registro no cuenta nada y no toca el estado', () => {
    expect(T.registrarDespertar({ sesion: 'nadie', home: dir })).toMatchObject({ ok: false });
    expect(T.leerTanda('nadie', dir)).toEqual({});
  });

  // Lo que encontro la revision por la API del 10/10 (cada caso fallaba antes del arreglo).
  it('falla ABIERTO: si git no contesta no se sabe si una hija commiteo → no cuenta ni guarda', () => {
    const reg = escribir('orq.jsonl', tarde());
    despertar(reg, '14:56', { inicioMs: ms('14:50') });
    expect(despertar(reg, '15:06', { commitsRepo: () => null })).toMatchObject({ ok: false });
    expect(T.leerTanda('orq', dir).sinAvance).toBe(1);
  });

  it('dos latidos de la misma sesion que despiertan juntos son UN despertar', () => {
    const reg = escribir('orq.jsonl', tarde());
    despertar(reg, '14:56', { inicioMs: ms('14:50') });
    expect(despertar(reg, '15:06')).toMatchObject({ sinAvance: 2 });
    const otra = T.registrarDespertar({ sesion: 'orq', ahora: new Date(ms('15:06') + 20000), home: dir, registro: reg, commitsRepo: sinCommits });
    expect(otra).toMatchObject({ ok: true, repetido: true, sinAvance: 2 });
    expect(T.leerTanda('orq', dir).sinAvance).toBe(2);
  });

  it('una cuenta de otra tanda (el despertar anterior es de hace mas de media hora) arranca de cero', () => {
    const reg = escribir('orq.jsonl', [...despertarQuieto('14:57'), ...despertarQuieto('15:07'), ...despertarQuieto('17:30')]);
    despertar(reg, '15:06', { inicioMs: ms('14:50') });
    expect(despertar(reg, '15:15')).toMatchObject({ sinAvance: 2 });
    expect(despertar(reg, '17:39', { inicioMs: ms('17:30') })).toMatchObject({ sinAvance: 1 });
  });

  it('un pedido a la API que se lanzo antes de un despertar y volvio despues cuenta en la ventana en que VOLVIO', () => {
    const api = uso('Bash', { command: 'node scripts/_apiTarea.mjs --tarea largo --pedido p.md --salida s.md' });
    const reg = escribir('largo.jsonl', [asst(ms('15:04'), texto('Lo mando a revisar.'), api), ...despertarQuieto('15:07'), vuelve(ms('15:08'), api), ...despertarQuieto('15:16')]);
    expect(despertar(reg, '15:06', { inicioMs: ms('15:00') }).avance.por.join(' ')).not.toMatch(/API/);     // todavia no volvio
    const r = despertar(reg, '15:15');
    expect(r.sinAvance).toBe(0);
    expect(r.avance.por.join(' ')).toMatch(/1 pedido\(s\) a la API/);
  });

  it('anotar en la lista no es avance aunque la ruta venga con barras de Git Bash', () => {
    const e = uso('Edit', { file_path: 'C:\\Dev\\BarackMercosul\\docs\\drafts\\LISTA_ORQUESTADOR_2026-10-10.md' });
    const lineas = [asst(ms('15:00'), e)];
    expect(T.recorrer(lineas, ms('14:00'), { lista: '/c/Dev/BarackMercosul/docs/drafts/LISTA_ORQUESTADOR_2026-10-10.md' }).escrituras).toHaveLength(0);
    expect(T.recorrer(lineas, ms('14:00'), { lista: 'C:/Dev/BarackMercosul/docs/otra.md' }).escrituras).toHaveLength(1);
  });
});

describe('tandaReglas · que comando es un pedido a la API y cual un commit (lineas reales de Git Bash)', () => {
  it.each([
    'node scripts/_apiTarea.mjs --tarea x --pedido p.md --salida s.md',
    'cd C:/Dev/BarackMercosul && timeout 560 node scripts/_apiTarea.mjs --tarea x --pedido p.md --salida s.md 2>&1 | tail -3',
    'timeout 600s node scripts/_apiTarea.mjs --tarea x --pedido p.md --salida s.md',
    'BARACK_API_DIR=/tmp/x node --max-old-space-size=4096 scripts/_apiTarea.mjs --tarea x --pedido p.md --salida s.md',
    '"C:/Program Files/nodejs/node.exe" scripts/_apiTarea.mjs --tarea x --pedido p.md --salida s.md',
    'node scripts/_claude.mjs --preguntar "¿esto cierra?" --modelo opus',
    // auditor 10/10: 3 de 23 pedidos reales no se contaban por el `-c` de otro comando de la misma linea
    'timeout 560 node scripts/_apiTarea.mjs --tarea HOY17-revision --pedido p.md --salida s.md 2>&1 | tail -3; cat s.md | wc -c',
    'node scripts/_apiTarea.mjs --tarea x --pedido p.md --salida s.md && grep -c ERROR s.md',
    'env BARACK_API_DIR=/tmp/x node scripts/_apiTarea.mjs --tarea x --pedido p.md --salida s.md',
    'if [ -f p.md ]; then node scripts/_apiTarea.mjs --tarea x --pedido p.md --salida s.md; fi',
    'for f in a b; do node scripts/_apiTarea.mjs --tarea $f --pedido $f.md --salida $f.out; done',
  ])('API: %s', (cmd) => { expect(T.claseDeComando(cmd)).toBe('api'); });

  it.each([
    'node scripts/_apiTarea.mjs --tarea x --pedido "a;b" --estimar',
    'grep -n "node scripts/_apiTarea.mjs" docs/x.md',
    'node scripts/_claude.mjs --ledger',
    'cat scripts/_apiTarea.mjs | head -40',
    'node --check scripts/_apiTarea.mjs',
    'node scripts/_apiTarea.mjs --help',
  ])('NO es un pedido: %s', (cmd) => { expect(T.claseDeComando(cmd)).not.toBe('api'); });

  it.each([
    "git commit -q -m 'x' -- a.mjs",
    'cd C:/Dev/BarackMercosul && git add a.mjs && git commit -m "x" -- a.mjs && git push -q origin main',
    'git --no-pager commit -m x -- a.mjs',
    'git -c user.name="A B" commit -m x -- a.mjs',
    'GIT_AUTHOR_DATE=2026-10-10 git commit -m x -- a.mjs',
  ])('commit: %s', (cmd) => { expect(T.claseDeComando(cmd)).toBe('commit'); });

  it.each([
    'git log --oneline -3 --grep commit',
    'git commit --dry-run -m x -- a.mjs',
    'git status --short; echo "falta el git commit"',
    'git show --stat HEAD',
  ])('NO es un commit: %s', (cmd) => { expect(T.claseDeComando(cmd)).toBeNull(); });
});

describe('tandaReglas · un registro que no se llega a leer no se mide', () => {
  it('un archivo de 9 MB: el primer tramo (8 MB) no llega a la hora pedida y el segundo trae el archivo entero → se mide', () => {
    // 3 renglones chicos despues de un relleno de 9 MB: el primer tramo (8 MB) no llega a las 11:00 y el segundo es el archivo entero
    const relleno = asst(ms('11:30'), texto('x'.repeat(9 * 1048576)));
    const reg = escribir('grande.jsonl', [asst(ms('11:00'), texto('arranqué')), relleno, ...despertarQuieto('15:07')]);
    const ev = T.leerEventos(reg, ms('10:00'));
    expect(ev.ok).toBe(true);                        // con el segundo tramo entra el archivo entero
    expect(ev.textoChars).toBeGreaterThan(9 * 1048576);
    expect(T.TOPE_LECTURA_BYTES).toBe(64 * 1048576);
  });
  it('recorrer: un renglon viejo suelto al principio del tramo no alcanza para darlo por cubierto', () => {
    const viejo = asst(ms('09:00'), texto('resumen de un compactado'));
    const nuevos = Array.from({ length: 12 }, (_, i) => asst(ms('15:00') + i * 60000, texto('x')));
    expect(T.recorrer([viejo, ...nuevos], ms('14:00')).cubre).toBe(false);
    expect(T.recorrer([...Array.from({ length: 12 }, (_, i) => asst(ms('13:00') + i * 60000, texto('x'))), ...nuevos], ms('14:00')).cubre).toBe(true);
  });
});

describe('tandaReglas · (sigue) el estado', () => {
  it('avisoParaCierre no dice PARADO si la cuenta no tiene una pregunta abierta, ni si es vieja', () => {
    const ahora = new Date(ms('15:20'));
    H.fijar({ sesion: 'p', hasta: new Date(ms('23:00')), ahora, home: dir });
    const reg = escribir('p.jsonl', [asst(ms('15:10'), texto('x'))]);
    fs.mkdirSync(path.join(dir, '.claude', '.tanda'), { recursive: true });
    const guardar = (o) => fs.writeFileSync(T.rutaTanda('p', dir), JSON.stringify(o));
    guardar({ sinAvance: 5, parado: false, ultimo_ms: ms('15:16') });
    expect(T.avisoParaCierre({ sesion: 'p', registro: reg, ahora, home: dir })).toBe('');
    guardar({ sinAvance: 5, parado: true, ultimo_ms: ms('15:16') });
    expect(T.avisoParaCierre({ sesion: 'p', registro: reg, ahora, home: dir })).toMatch(/PARADO: el latido lleva 5 despertares/);
    guardar({ sinAvance: 5, parado: true, ultimo_ms: ms('13:00') });
    expect(T.avisoParaCierre({ sesion: 'p', registro: reg, ahora, home: dir })).toBe('');
  });
});

// ── 3. la regla de la API ─────────────────────────────────────────────────────────────────────
describe('tandaReglas · 2 horas con trabajo y 0 pedidos a la API (el 10/10, 11:00 → 18:48)', () => {
  const ev = (o = {}) => ({ ok: true, api: [], agentes: [], textoChars: 4313, ...o });      // 4.313: lo medido a las 18:45
  const ahoraMs = ms('18:45');

  it('ROJO: la sesion lleva mas de 2 h, escribio texto y no hizo ningun pedido', () => {
    const r = T.evaluarApi({ ev: ev(), ahoraMs, inicioMs: ms('11:00') });
    expect(r).toMatchObject({ aviso: true, pedidos: 0 });
    expect(T.textoAvisoApi(r)).toMatch(/_apiTarea\.mjs/);
  });
  it('ROJO: poco texto pero lanzo un subagente (una revision que pudo ir por la API)', () => {
    expect(T.evaluarApi({ ev: ev({ textoChars: 800, agentes: [1] }), ahoraMs, inicioMs: ms('11:00') }).aviso).toBe(true);
  });
  it('VERDE: hubo un pedido (las 18:48 del real)', () => {
    expect(T.evaluarApi({ ev: ev({ api: [ms('18:48')] }), ahoraMs: ms('19:00'), inicioMs: ms('11:00') })).toMatchObject({ aviso: false, pedidos: 1 });
  });
  it('VERDE: la sesion lleva menos de 2 horas, o no hubo trabajo de texto ni subagentes (17:00 del real: 2.876)', () => {
    expect(T.evaluarApi({ ev: ev(), ahoraMs, inicioMs: ms('17:30') }).aviso).toBe(false);
    expect(T.evaluarApi({ ev: ev({ textoChars: 2876 }), ahoraMs: ms('17:00'), inicioMs: ms('11:00') }).aviso).toBe(false);
  });
  it('VERDE: sin registro no se sabe → no avisa', () => {
    expect(T.evaluarApi({ ev: { ok: false }, ahoraMs, inicioMs: ms('11:00') }).aviso).toBe(false);
    expect(T.estadoApi({ sesion: 'nadie', home: dir }).aviso).toBe(false);
  });
});

// ── 4. como llega: el codigo de salida del latido ─────────────────────────────────────────────
describe('el latido sale con 5 cuando hay un aviso (lo unico suyo que la sesion ve es el codigo de salida)', () => {
  const sesion = 'ses-latido';
  const correr = async (medir) => {
    let t = ms('15:06');
    const dicho = [];
    H.fijar({ sesion, hasta: new Date(ms('23:00')), ahora: new Date(t), home: dir });
    const code = await latido(['--minutos', '1', '--sesion', sesion], { env: {}, home: dir, ahora: () => new Date(t), esperar: async (x) => { t += x; }, log: (s) => dicho.push(s), pid: 4242, ...(medir ? { medir } : {}) });
    return { code, dicho: dicho.join('\n') };
  };

  it('ROJO: con un aviso sale con 5 y lo deja escrito (para quien abra la salida)', async () => {
    const r = await correr(() => ({ avisos: ['PARADO: 3 despertares seguidos sin avance'] }));
    expect(r.code).toBe(H.SALIDA_AVISO);
    expect(r.code).toBe(5);
    expect(r.dicho).toMatch(/PARADO: 3 despertares/);
    expect(r.dicho).toMatch(/_orquestador\.mjs --hora/);
  });
  it('VERDE: sin avisos sale con 0, como siempre', async () => {
    expect((await correr(() => ({ avisos: [] }))).code).toBe(0);
  });
  it('falla ABIERTO: si medir tira, o no hay registro (la medicion real), sale con 0', async () => {
    expect((await correr(() => { throw new Error('roto'); })).code).toBe(0);
    expect((await correr(null)).code).toBe(0);
  });
  it('sin hora vigente sigue saliendo con 4 y no mide nada', async () => {
    let midio = false;
    const code = await latido(['--sesion', 'sin-hora'], { env: {}, home: dir, log: () => {}, medir: () => { midio = true; return { avisos: ['x'] }; } });
    expect(code).toBe(H.SALIDA_SIN_HORA);
    expect(midio).toBe(false);
  });
  it('el texto con que se explica el latido nombra el codigo 5 y el chequeo de la hora', () => {
    expect(H.COMO_LANZAR).toMatch(/exit code 5/);
    expect(H.COMO_LANZAR).toMatch(/_orquestador\.mjs --hora/);
    expect(H.COMO_LANZAR).toMatch(/exit code 0/);
    expect(H.COMO_LANZAR).toMatch(/exit code 4/);
  });
});

describe('alDespertar · junta los avisos y no repite el de la API antes de una hora', () => {
  it('el aviso de la API sale una vez y vuelve recien pasada la hora', () => {
    const largo = 'x'.repeat(4313);
    const reg = escribir('api.jsonl', [asst(ms('11:00'), texto('arranqué')), asst(ms('17:30'), texto(largo)), asst(ms('18:55'), texto(largo)), asst(ms('19:50'), texto(largo))]);
    // el registro llega hasta las 19:50: se mide con la hora real de la PC, que es posterior. Para no depender del reloj,
    // se mira la funcion pura con la ventana de cada momento.
    const a1 = T.alDespertar({ sesion: 's', ahora: new Date(ms('19:55')), home: dir, registro: reg, commitsRepo: sinCommits });
    expect(a1.avisos.some((a) => /^API: 0 pedidos/.test(a))).toBe(true);
    const a2 = T.alDespertar({ sesion: 's', ahora: new Date(ms('20:04')), home: dir, registro: reg, commitsRepo: sinCommits });
    expect(a2.avisos.some((a) => /^API:/.test(a))).toBe(false);
    const a3 = T.alDespertar({ sesion: 's', ahora: new Date(ms('20:56')), home: dir, registro: reg, commitsRepo: sinCommits });
    expect(a3.avisos.some((a) => /^API:/.test(a))).toBe(true);
  });
  it('nunca tira: sin registro devuelve una lista vacia', () => {
    expect(T.alDespertar({ sesion: 'nadie', home: dir }).avisos).toEqual([]);
  });
});

// ── 5. el cierre: un renglon en un freno que ya salia, ningun freno nuevo ─────────────────────
describe('cierre-guard · las reglas de la tanda viajan en los frenos 3 y 5 y NO agregan ninguno', () => {
  const deps = (extra = {}) => ({
    fueraEnEsteTurno: async () => ({ fuera: false, ultimoMensajeFak: 'dale, cerralo' }),
    pendientes: () => [], enCooldown: () => false, marcar: () => {}, yaReclamado: () => false, reclamar: () => {}, exportsDelTurno: () => [],
    avisoTanda: () => '\nADEMAS, las reglas de la tanda (aviso, no frena): API: 0 pedidos de esta sesión', ...extra,
  });
  const informe = `${Array.from({ length: 40 }, (_, i) => `- Punto ${i + 1}: ${'detalle '.repeat(10)}`).join('\n')}\n\nListo: todo commiteado y pusheado.`;

  it('freno 5 (el cierre es un informe): trae el renglon de la tanda', async () => {
    const r = await decidir({ session_id: 's-tanda', last_assistant_message: informe }, deps());
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/informe/);
    expect(r.detalle).toMatch(/reglas de la tanda \(aviso, no frena\)/);
  });
  it('freno 3 (pendientes medibles): tambien', async () => {
    const r = await decidir({ session_id: 's-tanda', last_assistant_message: 'Listo, quedó todo commiteado.' }, deps({ pendientes: () => ['hay 1 archivo(s) sin commitear'] }));
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/pendientes/);
    expect(r.detalle).toMatch(/reglas de la tanda/);
  });
  it('SIN FRENO NUEVO: un turno que no frenaba sigue sin frenar aunque haya aviso de la tanda', async () => {
    for (const t of ['15:16: sin cambios. Sin novedades tuyas. Latido corriendo; vuelvo a mirar a las 15:24.', 'Listo, quedó todo commiteado.']) {
      expect((await decidir({ session_id: 's-tanda', last_assistant_message: t }, deps())).ok, t).toBe(true);
    }
  });
  it('falla ABIERTO: si la medicion tira, el freno sale igual que antes', async () => {
    const r = await decidir({ session_id: 's-tanda', last_assistant_message: informe }, deps({ avisoTanda: () => { throw new Error('roto'); } }));
    expect(r.ok).toBe(false);
    expect(r.detalle).not.toMatch(/reglas de la tanda/);
  });
  it('avisoParaCierre: sin una hora vigente no dice nada; con hora vigente y 2 h sin API, lo dice', () => {
    const largo = 'x'.repeat(4313);
    const reg = escribir('c.jsonl', [asst(ms('11:00'), texto('arranqué')), asst(ms('18:30'), texto(largo))]);
    const ahora = new Date(ms('18:45'));
    expect(T.avisoParaCierre({ sesion: 'c', registro: reg, ahora, home: dir })).toBe('');
    H.fijar({ sesion: 'c', hasta: new Date(ms('23:00')), ahora, home: dir });
    expect(T.avisoParaCierre({ sesion: 'c', registro: reg, ahora, home: dir })).toMatch(/aviso, no frena\): API: 0 pedidos/);
  });
});

// ── 6. el chequeo de la hora ──────────────────────────────────────────────────────────────────
describe('_orquestador.mjs --hora · imprime el estado de las reglas y de las hijas', () => {
  const base = (extra = {}) => ({
    vigente: () => ({ hasta: '2026-10-11 23:00', lista: LISTA }),
    latidoVivo: () => ({ vivo: true, senal: { despierta_ms: ms('15:24') } }),
    buscarRegistro: () => 'C:\\x\\orq.jsonl',
    estadoApi: () => ({ aviso: false, pedidos: 1, textoChars: 5344, agentes: 0 }),
    leerTanda: () => ({ sinAvance: 0 }),
    preguntasEnLista: () => [],
    ledgerEnVentana: () => ({ pedidos: 3, usd: 1.11, tareas: [] }),
    hijasRecientes: () => [{ id: 'local_218252c2-0273', titulo: 'Hija 2' }],
    estadoHija: () => ({ ok: true, ojos: [], datos: [], app: { title: 'Hija 2 · cierre H5+H6', model: 'claude-opus-5-5', permissionMode: 'bypassPermissions' }, transcript: { archivo: 'C:\\x\\h.jsonl', ultimoTs: ms('15:10') } }),
    leerEventos: () => ({ commits: [ms('15:05')] }),
    ...extra,
  });
  const hora = (extra) => renglonesDeLaHora({ sesion: 'ae95ec7e-065a', ahora: new Date(ms('15:16')), deps: base(extra) });

  // Lo que encontro el auditor el 10/10.
  it('si no pudo medir NO dice «0 pedidos» ni «sin commits»: dice que no se pudo medir', () => {
    const sinRegistro = hora({ buscarRegistro: () => null, estadoApi: () => ({ aviso: false, pedidos: 0, motivo: 'sin registro' }) }).renglones.join('\n');
    expect(sinRegistro).toMatch(/NO SE PUDO MEDIR los pedidos de esta sesión \(no encuentro su registro\)/);
    expect(sinRegistro).not.toMatch(/API: 0 pedido/);
    const ilegible = hora({ estadoApi: () => ({ aviso: false, pedidos: 0, motivo: 'la ventana no entra en lo que se lee del registro' }), leerEventos: () => ({ ok: false, motivo: 'registro ilegible', commits: [] }) }).renglones.join('\n');
    expect(ilegible).toMatch(/NO SE PUDO MEDIR/);
    expect(ilegible).toMatch(/commits: no se pudo medir \(registro ilegible\)/);
    expect(ilegible).not.toMatch(/sin commits en su registro/);
  });
  it('una cuenta de otra tanda no se muestra como actual ni avisa PARADO', () => {
    const r = hora({ leerTanda: () => ({ sinAvance: 7, parado: true, ultimo: '2026-10-10 11:00', ultimo_ms: ms('11:00') }), preguntasEnLista: () => ['P84'] });
    expect(r.renglones.join('\n')).toMatch(/sin cuenta vigente \(la última anotada es de otra tanda/);
    expect(r.avisos).toEqual([]);
  });

  it('VERDE: sin avisos lo dice, y lista la hija con su modelo, su modo y su ultimo commit', () => {
    const r = hora();
    const t = r.renglones.join('\n');
    expect(r.avisos).toEqual([]);
    expect(t).toMatch(/Sin avisos de las reglas de la tanda/);
    expect(t).toMatch(/API: 1 pedido\(s\) de esta sesión/);
    expect(t).toMatch(/3 pedido\(s\), US\$ 1\.11/);
    expect(t).toMatch(/Sesión lanzada local_218252c2.*claude-opus-5-5.*bypassPermissions.*último commit/);
    expect(t).toMatch(/Cupo: no se puede medir desde acá/);            // no inventa un numero
  });
  it('ROJO: el 10/10 a las 15:16. Tres despertares sin avance con una pregunta abierta y 0 pedidos → dos avisos', () => {
    const r = hora({
      estadoApi: () => ({ aviso: true, pedidos: 0, textoChars: 4733, agentes: 0 }),
      leerTanda: () => ({ sinAvance: 3, ultimo: '2026-10-10 15:16', espera: { ms: ms('15:07'), frase: 'sin novedades tuyas' } }),
      preguntasEnLista: () => ['P84 (el modo de arranque de las hijas)'],
    });
    expect(r.avisos).toHaveLength(2);
    const t = r.renglones.join('\n');
    expect(t).toMatch(/AVISO · API: 0 pedidos/);
    expect(t).toMatch(/AVISO · PARADO: 3 despertares/);
    expect(t).toMatch(/«P84 \(el modo de arranque de las hijas\)»/);
  });
  it('una hija que arranco mal trae su OJO; una que no se puede leer no rompe el informe', () => {
    const t = hora({
      hijasRecientes: () => [{ id: 'local_e4632689' }, { id: 'local_rota' }],
      estadoHija: ({ id }) => { if (id === 'local_rota') throw new Error('sin registro'); return { ok: false, ojos: ['arrancó en «default», no en «bypassPermissions»'], datos: [], app: { title: 'Hija 1', model: 'claude-fable-5-1', permissionMode: 'default' }, transcript: null }; },
    }).renglones.join('\n');
    expect(t).toMatch(/OJO: arrancó en «default»/);
    expect(t).toMatch(/Sesión lanzada local_rota: no se pudo leer/);
  });
  it('el ledger se lee por ventana y no cuenta lo de afuera; sin archivo da cero', () => {
    const d = path.join(dir, 'api'); fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, 'ledger_2026-10.jsonl'), [
      '{"ts":"2026-10-10 18:48:21","tarea":"sesion:P55-revision","costoUsd":0.300836}',
      '{"ts":"2026-10-10 19:11:39","tarea":"sesion:p55-etapa1-revision","costoUsd":0.331928}',
      '{"ts":"2026-10-10 06:31:00","tarea":"nocturno","costoUsd":1.51}', 'renglon roto',
    ].join('\n'));
    const local = (t) => new Date(t.replace(' ', 'T')).getTime();
    const r = ledgerEnVentana(local('2026-10-10 18:00:00'), local('2026-10-10 20:00:00'), d);
    expect(r.pedidos).toBe(2);
    expect(r.usd).toBeCloseTo(0.632764, 5);
    expect(ledgerEnVentana(0, 1, path.join(dir, 'nada'))).toMatchObject({ pedidos: 0, usd: 0 });
  });
});

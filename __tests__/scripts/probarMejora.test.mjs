/**
 * _probarMejora.mjs (regla mejora-implementada.md, 02/10/2026): una mejora del sistema no esta implementada hasta
 * que se la probo con un mensaje REAL de Fak por el camino real, y se VIO llegar en los transcripts.
 *
 * El caso que la origino: el hook explicar-prompt tenia 41 tests en verde y el primer mensaje real que lo
 * necesitaba no recibio nada, porque llego con un aviso de la app adelante. Aca se prueba, en las dos direcciones,
 * que esta herramienta SI ve esa clase de falla (con un hook de prueba que tiene el defecto viejo) y que no acusa
 * a un hook sano.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REPO, DATOS, AVISO_APP, RESPUESTA_COMUN, hooksDe, probarMensaje, claseDe, sesionesAbiertas, mensajesConAviso, llego, chequearAvisos,
} from '../../scripts/_lib/probarMejora.mjs';
import { leerArgumentos } from '../../scripts/_probarMejora.mjs';
import { declaraCierre, evaluarPermiso, evaluarAnuncio, CANON } from '../../scripts/_lib/cierreGuard.mjs';

const INCIDENTE = 'che ene que estaod esta hace que sea faicl de entender esta taare adigmaos le pdoemos apsar las hojas de rpcoeos anico?';
const COMUN = 'a ver abri la de hot melt ais la reviso..';
const carpeta = (nombre) => fs.mkdtempSync(path.join(os.tmpdir(), `${nombre}-`));
const LARGO = 120000;

describe('_probarMejora — argumentos: lo que no conoce frena antes de hacer nada', () => {
  it('ROJO: argumento desconocido, valor que falta, nada que hacer, o una palabra suelta en vez de un mensaje real', () => {
    expect(leerArgumentos(['--mensaje', INCIDENTE, '--borrar']).error).toMatch(/no conozco/);
    expect(leerArgumentos(['--mensaje']).error).toMatch(/le falta su valor/);
    expect(leerArgumentos(['--mensaje', '--llego']).error).toMatch(/le falta su valor/);
    expect(leerArgumentos([]).error).toMatch(/falta --mensaje/);
    expect(leerArgumentos(['--mensaje', 'hola']).error).toMatch(/uno real de Fak/);
  });
  it('VERDE: varios mensajes, --espera, --llego con --desde, --sesiones', () => {
    expect(leerArgumentos(['--mensaje', INCIDENTE, '--mensaje', COMUN, '--espera', 'EXPLICAR-MEJOR'])).toMatchObject({ mensajes: [INCIDENTE, COMUN], espera: 'EXPLICAR-MEJOR' });
    expect(leerArgumentos(['--llego', '--desde', '2026-10-02T11:44:18Z'])).toMatchObject({ llego: true, desde: '2026-10-02T11:44:18Z' });
    expect(leerArgumentos(['--sesiones']).sesiones).toBe(true);
  });
  it('la corrida con --mensaje es la que el cierre-guard cuenta como prueba (y --llego solo, no)', () => {
    const re = new RegExp(CANON.mejora.prueba_re, 'i');
    expect(re.test(`node scripts/_probarMejora.mjs --mensaje "${INCIDENTE}"`)).toBe(true);
    expect(re.test('node scripts/_probarMejora.mjs --espera X --mensaje "che en que estado esta"')).toBe(true);
    expect(re.test('node scripts/_probarMejora.mjs --llego')).toBe(false);
    expect(re.test('cat scripts/_probarMejora.mjs; echo --mensaje')).toBe(false);
  });
});

describe('_probarMejora — un mensaje real por los hooks de verdad (bash -> node)', () => {
  it('la respuesta "comun" con que se prueba el cierre no dispara ningun otro chequeo del cierre-guard', () => {
    expect(declaraCierre(RESPUESTA_COMUN)).toBe(false);
    expect(evaluarPermiso(RESPUESTA_COMUN).bloquea).toBe(false);
    expect(evaluarAnuncio(RESPUESTA_COMUN, { total: 0, delTurno: 0 }).bloquea).toBe(false);
  });
  it('ROJO→VERDE del incidente: el mensaje de Fak recibe el aviso de explicar en las DOS formas, y el cierre frena una respuesta comun', () => {
    const r = probarMensaje(INCIDENTE, { espera: 'EXPLICAR-MEJOR' });
    expect(r.fallas).toEqual([]);
    const ex = r.mensajes.find((m) => m.hook === 'explicar-prompt.sh');
    expect(ex.pelado).toMatch(/\[EXPLICAR-MEJOR\]/);
    expect(ex.pelado).toMatch(/escalon 3/);
    expect(ex.conAviso).toBe(ex.pelado);
    expect(ex.distinto).toBe(false);
    expect(r.cierre).toHaveLength(1);
    expect(r.cierre[0]).toMatchObject({ hook: 'cierre-guard.sh', frena: true });
    expect(r.cierre[0].motivo).toMatch(/sin cambiar la forma/);
  }, LARGO);
  it('VERDE: un mensaje comun no recibe nada y el cierre lo deja pasar; con --espera, que no llegue es una falla', () => {
    const r = probarMensaje(COMUN);
    expect(r.fallas).toEqual([]);
    expect(r.mensajes.every((m) => m.pelado === '' && m.conAviso === '')).toBe(true);
    expect(r.cierre[0].frena).toBe(false);
    expect(probarMensaje(COMUN, { espera: 'EXPLICAR-MEJOR' }).fallas.join(' ')).toMatch(/ningun hook devolvio "EXPLICAR-MEJOR"/);
  }, LARGO);
  it('ROJO: un hook con el defecto del 02/10 (toma por automatico el mensaje que llega con un aviso adelante) queda a la vista', () => {
    const raiz = carpeta('pm-raiz');
    fs.mkdirSync(path.join(raiz, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(raiz, 'hook-viejo.mjs'), [
      "let s = ''; process.stdin.on('data', (d) => { s += d; }).on('end', () => {",
      "  const p = JSON.parse(s).prompt;",
      "  if (/^\\s*<system-reminder/.test(p)) return;",
      "  if (/entender/.test(p)) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: '[AVISO-VIEJO] explicar' } }));",
      '});',
    ].join('\n'));
    fs.writeFileSync(path.join(raiz, '.claude', 'settings.json'), JSON.stringify({ hooks: { UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: 'node "${CLAUDE_PROJECT_DIR}/hook-viejo.mjs"' }] }] } }));
    const r = probarMensaje(INCIDENTE, { raiz, tmp: path.join(raiz, 'tmp') });
    expect(r.mensajes[0]).toMatchObject({ pelado: '[AVISO-VIEJO] explicar', conAviso: '', distinto: true });
    expect(r.fallas.join(' ')).toMatch(/contesta distinto si el mensaje llega con un aviso de la app adelante/);
    expect(r.cierre).toEqual([]);                                  // ese settings no tiene cierre-guard: no se inventa uno
  }, LARGO);
  it('los hooks que corre son los de settings.json, y cada aviso en prueba tiene su hook ahi', () => {
    const cmds = hooksDe(REPO, 'UserPromptSubmit');
    expect(cmds.length).toBeGreaterThanOrEqual(3);
    for (const a of DATOS.avisos) {
      expect(cmds.some((c) => c.includes(`${a.id}.sh`)), a.id).toBe(true);
      expect(a.marca).toMatch(/^\[[A-Z-]+\]$/);
      expect(Number.isFinite(Date.parse(a.desde)), a.desde).toBe(true);
    }
    expect(AVISO_APP).toMatch(/^<system-reminder>[\s\S]+<\/system-reminder>\s+$/);
  });
});

describe('_probarMejora — sesiones abiertas: que toma sola una sesion y que no', () => {
  it('claseDe: hooks y guardianes solos; skills al cargar; reglas con paths al tocar; CLAUDE.md y reglas sin paths al arrancar', () => {
    expect(claseDe('.claude/hooks/explicar-prompt.sh')).toBe('sola');
    expect(claseDe('.claude/settings.json')).toBe('sola');
    expect(claseDe('scripts/_lib/explicarCanon.data.json')).toBe('sola');
    expect(claseDe('.claude/skills/explicar-mejor/SKILL.md')).toBe('al-cargar');
    expect(claseDe('.claude/rules/amfe.md', true)).toBe('al-tocar');
    expect(claseDe('.claude/rules/git-deploy.md', false)).toBe('al-arrancar');
    expect(claseDe('CLAUDE.md')).toBe('al-arrancar');
  });
  it('VERDE: solo hooks y guardianes, ya en el checkout principal → "lo toman solas, no hace falta reabrir"', () => {
    const s = sesionesAbiertas(REPO, ['.claude/hooks/explicar-prompt.sh', 'scripts/_lib/explicarGuard.mjs'], REPO);
    expect(s.reabrir).toEqual([]);
    expect(s.faltanEnPrincipal).toEqual([]);
    expect(s.texto.at(-1)).toMatch(/las sesiones abiertas lo toman solas, no hace falta reabrir nada/);
    expect(s.texto.join('\n')).not.toMatch(/OJO/);
  });
  it('ROJO: CLAUDE.md o una regla → hay que reabrir; la regla con `paths:` se lee del archivo', () => {
    const s = sesionesAbiertas(REPO, ['CLAUDE.md', '.claude/rules/git-deploy.md', '.claude/rules/amfe.md', '.claude/hooks/explicar-prompt.sh'], REPO);
    expect(s.piezas.find((p) => p.pieza === '.claude/rules/amfe.md').clase).toBe('al-tocar');
    expect(s.piezas.find((p) => p.pieza === '.claude/rules/git-deploy.md').clase).toBe('al-arrancar');
    expect(s.reabrir).toEqual(['CLAUDE.md', '.claude/rules/git-deploy.md', '.claude/rules/amfe.md']);
    expect(s.texto.at(-1)).toMatch(/hay que REABRIRLAS/);
  });
  it('ROJO: si el checkout de donde corren los hooks no tiene el cambio, lo dice (un worktree no existe para las sesiones)', () => {
    const otro = carpeta('pm-principal');
    const s = sesionesAbiertas(REPO, ['.claude/hooks/explicar-prompt.sh', 'scripts/_lib/explicarGuard.mjs'], otro);
    expect(s.faltanEnPrincipal).toHaveLength(2);
    expect(s.texto.join('\n')).toMatch(/OJO: las sesiones corren lo que hay en .*2 de 2 pieza\(s\) todavia no estan ahi/);
  });
  it('sin piezas cambiadas no hay nada que avisar', () => {
    expect(sesionesAbiertas(REPO, [], REPO).texto).toEqual(['No hay piezas del sistema cambiadas (hooks, skills, reglas, guardianes): no hay nada que avisar.']);
  });
});

describe('_probarMejora — ¿llego? lo que debia recibir el aviso y lo que lo recibio', () => {
  const l = (o) => JSON.stringify(o);
  const T = (n) => `2026-10-02T17:${String(n).padStart(2, '0')}:00.000Z`;
  const fak = (n, contenido) => l({ type: 'user', timestamp: T(n), origin: { kind: 'human' }, message: { role: 'user', content: contenido } });
  const aviso = (n, texto) => l({ type: 'attachment', timestamp: T(n), attachment: { type: 'hook_additional_context', hookEvent: 'UserPromptSubmit', hookName: 'UserPromptSubmit', content: [texto] } });
  const EXPLICAR = DATOS.avisos.find((a) => a.id === 'explicar-prompt');
  function proyecto(lineasPorSesion) {
    const raiz = carpeta('pm-proyectos');
    const dir = path.join(raiz, `${DATOS.proyectos_prefijo}--prueba`);
    fs.mkdirSync(dir, { recursive: true });
    for (const [nombre, lineas] of Object.entries(lineasPorSesion)) {
      const f = path.join(dir, `${nombre}.jsonl`);
      fs.writeFileSync(f, lineas.join('\n') + '\n');
      fs.utimesSync(f, new Date(T(59)), new Date(T(59)));         // la fecha del archivo no depende del reloj del que corre el test
    }
    return { raiz, dir };
  }
  // 61a9a9ac, tal como quedo: el mensaje del incidente con el aviso de la app adelante y SIN contexto de hook despues.
  const incidente = [fak(16, [{ type: 'text', text: AVISO_APP }, { type: 'text', text: INCIDENTE }]), l({ type: 'assistant', timestamp: T(17), message: { content: [{ type: 'text', text: 'tabla' }] } })];
  const bien = [fak(20, 'no te entendi un carajo'), aviso(20, '[EXPLICAR-MEJOR] Fak no entendio…'), l({ type: 'assistant', timestamp: T(21), message: { content: [{ type: 'text', text: 'ok' }] } })];
  const otroAviso = [fak(30, 'no entiendo nada'), aviso(30, '[CORRECCION-GUARD] Fak esta corrigiendo')];
  const noSonDeFak = [
    l({ type: 'user', timestamp: T(40), origin: { kind: 'task-notification' }, message: { content: '<task-notification>no entendi, explicame</task-notification>' } }),
    l({ type: 'user', timestamp: T(41), isCompactSummary: true, message: { content: 'This session is being continued from a previous conversation. Fak: no entiendo, explicame' } }),
    l({ type: 'user', timestamp: T(42), isMeta: true, message: { content: 'Stop hook feedback: explicame' } }),
    l({ type: 'user', timestamp: T(43), message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: 'no entiendo explicame' }] } }),
    fak(44, COMUN),
  ];

  it('mensajesConAviso: separa lo que escribio Fak, marca si venia con un aviso adelante y si le llego el contexto del hook', async () => {
    const { dir } = proyecto({ aaaa1111: [...incidente, ...bien, ...otroAviso, ...noSonDeFak] });
    const ms = await mensajesConAviso(path.join(dir, 'aaaa1111.jsonl'), { marca: EXPLICAR.marca });
    expect(ms.map((m) => [m.texto.slice(0, 22), m.conAviso, m.llego])).toEqual([
      ['che ene que estaod est', true, false],
      ['no te entendi un caraj', false, true],
      ['no entiendo nada', false, false],                       // le llego OTRO aviso, no el de explicar
      [COMUN.slice(0, 22), false, false],
    ]);
  });
  it('ROJO: llego() cuenta lo que debia y no llego, y dice cual', async () => {
    const { raiz } = proyecto({ aaaa1111: [...incidente, ...bien, ...noSonDeFak], bbbb2222: bien });
    const r = await llego(EXPLICAR, { proyectos: raiz, desde: '2026-10-02T00:00:00Z' });
    expect(r).toMatchObject({ medible: true, debia: 3, llego: 2 });
    expect(r.faltaron).toHaveLength(1);
    expect(r.faltaron[0]).toMatchObject({ sesion: 'aaaa1111', conAviso: true });
    // el mismo caso como paso de _cierreSesion: reciente = falta; viejo = aviso
    const hoy = Date.parse(T(50));
    const reciente = await chequearAvisos({ proyectos: raiz, desde: '2026-10-02T00:00:00Z', ahora: hoy });
    expect(reciente.estado).toBe('falta');
    expect(reciente.detalle).toMatch(/debia 3, llego 2/);
    expect(reciente.detalle).toMatch(/venia con un aviso de la app adelante/);
    const viejo = await chequearAvisos({ proyectos: raiz, desde: '2026-10-02T00:00:00Z', ahora: hoy + 10 * 86400000 });
    expect(viejo.estado).toBe('aviso');
  });
  it('VERDE: todo lo que debia llegar, llego → ok; `desde` deja afuera lo anterior al arreglo', async () => {
    const { raiz } = proyecto({ aaaa1111: [...incidente, ...bien] });
    expect(await chequearAvisos({ proyectos: raiz, desde: T(19) })).toMatchObject({ estado: 'ok' });
    expect((await llego(EXPLICAR, { proyectos: raiz, desde: T(19) }))).toMatchObject({ debia: 1, llego: 1, faltaron: [] });
  });
  it('sin ningun mensaje que lo dispare no es un verde: la mejora todavia no se vio funcionar', async () => {
    const { raiz } = proyecto({ aaaa1111: noSonDeFak });
    const r = await chequearAvisos({ proyectos: raiz, desde: '2026-10-02T00:00:00Z' });
    expect(r.estado).toBe('aviso');
    expect(r.detalle).toMatch(/no se vio funcionar/);
    expect((await chequearAvisos({ proyectos: path.join(raiz, 'no-existe'), desde: '2026-10-02T00:00:00Z' })).estado).toBe('aviso');
  });
  it('un aviso sin su funcion en DEBIA figura "sin medidor", no como verde', async () => {
    expect(await llego({ id: 'hook-que-no-existe', marca: '[X]', desde: '2026-01-01T00:00:00Z' }, { proyectos: os.tmpdir() })).toMatchObject({ medible: false, debia: 0 });
  });
});

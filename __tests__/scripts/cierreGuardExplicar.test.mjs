/**
 * cierre-guard · chequeo 7 (02/10/2026): Fak pidio que se lo explique y el turno contesto sin cambiar la forma.
 *
 * El caso real: sesion 61a9a9ac, 02/10/2026 14:16. Fak: "che ene que estaod esta hace que sea faicl de entender
 * esta taare adigmaos le pdoemos apsar las hojas de rpcoeos anico?". La respuesta fue una tabla y una lista; el
 * skill `explicar-mejor` estaba en la lista y no se cargo. Fak, 14:31: "te pedi antes que me lo des facil de
 * entender y no aplicaste la mejora que habiamos implementado... me respondiste normal como si no recordaras esa
 * conversacion".
 *
 * Tres cosas se prueban, en las dos direcciones:
 *   1. el chequeo 7: bloquea si el turno no cargo el skill ni mostro un dibujo o una pagina, y pasa con cada salida;
 *   2. el mensaje de Fak llego con un aviso de la app ADELANTE y el relevador lo tomaba por un aviso entero: el turno
 *      no arrancaba ahi y el chequeo 2 reclamo la ruta de algo entregado en el turno ANTERIOR (lo que paso 14:19);
 *   3. el pendiente de "mejora sin probar" (regla mejora-implementada.md) al declarar un cierre.
 * Los transcripts se arman con las formas que escribe Claude Code (origin, isMeta, isCompactSummary, queued_command).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decidir, relevarTranscript, evaluarExplicar, pendientesDeMejora, REPO, CANON } from '../../scripts/_lib/cierreGuard.mjs';
import { CANON as CANON_EXPLICAR } from '../../scripts/_lib/explicarGuard.mjs';

const INCIDENTE = 'che ene que estaod esta hace que sea faicl de entender esta taare adigmaos le pdoemos apsar las hojas de rpcoeos anico?';
const AVISO_APP = '<system-reminder>\nThe user started your suggested background task task_eee4ad8a ("Agregar guard que frene git commit sin rutas") in a separate local session. It is running independently. You will be notified here when it ends.\n</system-reminder>\n\n';
// Asi arranco la respuesta real: una tabla.
const RESPUESTA = '**Hoy no, enteras no.** Se le puede pasar una parte.\n\n| Hoja | ¿Se la paso a Nico? | Qué falta |\n|---|---|---|\n| Hot melt del Top Roll (HO-992 y HO-993) | Sí, con una salvedad | El número de hoja |\n\nLo que falta para pasarle todo: tres fotos y el número de las dos hojas.';

const l = (o) => JSON.stringify(o);
const T = (n) => `2026-10-02T17:${String(n).padStart(2, '0')}:00.000Z`;
const fak = (n, texto) => l({ type: 'user', timestamp: T(n), origin: { kind: 'human' }, message: { role: 'user', content: texto } });
// Como llego de verdad: dos bloques de texto, el aviso de la app y despues lo que escribio Fak.
const fakConAviso = (n, texto) => l({ type: 'user', timestamp: T(n), origin: { kind: 'human' }, promptSource: 'sdk', message: { role: 'user', content: [{ type: 'text', text: AVISO_APP }, { type: 'text', text: texto }] } });
const usa = (n, name, input, id = `toolu_${n}_${name}`) => l({ type: 'assistant', timestamp: T(n), message: { content: [{ type: 'tool_use', id, name, input }] } });
const dice = (n, texto) => l({ type: 'assistant', timestamp: T(n), message: { content: [{ type: 'text', text: texto }] } });
const ESCRITORIO = 'C:\\Users\\FacundoS-PC\\OneDrive - BARACK ARGENTINA SRL\\Desktop\\Nicolas Perez - HO de puertas\\_QUE HAY QUE HACER.txt';

// El turno anterior entrego algo en el Escritorio; despues llega el mensaje del incidente.
const antes = [fak(1, 'dale, dejame anotado lo que hay que hacer en la carpeta de la tarea'), usa(2, 'Edit', { file_path: ESCRITORIO, old_string: 'a', new_string: 'b' }), dice(3, `Quedó en ${ESCRITORIO}`)];
const incidente = [...antes, fakConAviso(16, INCIDENTE)];

const archivo = (lineas) => {
  const f = path.join(os.tmpdir(), `cg-explicar-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(f, lineas.join('\n') + '\n');
  return f;
};
const deps = { pendientes: () => [], enCooldown: () => false, marcar: () => {}, yaReclamado: () => false, reclamar: () => {} };
async function cierre(lineas, texto = RESPUESTA, extra = {}) {
  const f = archivo(lineas);
  try { return await decidir({ session_id: 's7', transcript_path: f, last_assistant_message: texto, ...extra }, deps); } finally { fs.unlinkSync(f); }
}
async function relevar(lineas) {
  const f = archivo(lineas);
  try { return await relevarTranscript(f); } finally { fs.unlinkSync(f); }
}

describe('chequeo 7 · ROJO: el incidente del 02/10/2026 tal como paso', () => {
  it('el relevador ve el mensaje de Fak aunque llegue con un aviso de la app adelante, y el turno arranca AHI', async () => {
    const r = await relevar([...incidente, dice(17, RESPUESTA)]);
    expect(r.ultimoMensajeFak).toBe(INCIDENTE);
    expect(r.fuera).toBe(false);                                   // el Edit del Escritorio es del turno anterior
    expect(r.explicar).toEqual({ skill: false, dibujo: false, pagina: false, envio: false });
  });
  it('bloquea: pidio "faicl de entender" y se contesto una tabla sin cargar el skill', async () => {
    const r = await cierre([...incidente, dice(17, RESPUESTA)]);
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/Fak pidio que se lo expliques y contestaste sin cambiar la forma/);
    expect(r.titulo).not.toMatch(/afuera del repo/);               // lo que salto de verdad a las 14:19, por el turno mal cortado
    expect(r.detalle).toMatch(/che ene que estaod esta hace que sea faicl de entender/);
    expect(r.detalle).toMatch(/verlo en la lista no es usarlo/);
    expect(r.detalle).toMatch(/escalon 3/);                        // pedia el estado de una tarea: va la pagina
    expect(r.detalle).toMatch(/No aplica explicar-mejor:/);        // la salida
  });
  it('bloquea aunque el skill se haya cargado en un turno ANTERIOR: se mide el turno de este mensaje', async () => {
    const r = await cierre([fak(1, 'no entiendo'), usa(2, 'Skill', { skill: 'explicar-mejor' }), dice(3, 'Es así.'), fakConAviso(16, INCIDENTE), dice(17, RESPUESTA)]);
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/sin cambiar la forma/);
  });
  it('bloquea con lo que Fak escribe MIENTRAS trabajo (queued_command): ese es su ultimo mensaje', async () => {
    const enCola = l({ type: 'attachment', timestamp: T(20), attachment: { type: 'queued_command', commandMode: 'prompt', prompt: `${AVISO_APP}no te entendi un carajo` } });
    const r = await relevar([fak(1, 'no entiendo'), usa(2, 'Skill', { skill: 'explicar-mejor' }), enCola, dice(21, 'Sigue igual.')]);
    expect(r.ultimoMensajeFak).toBe('no te entendi un carajo');
    expect(r.explicar.skill).toBe(false);                          // el skill se cargo ANTES de ese mensaje
    expect(evaluarExplicar('Sigue igual.', r).bloquea).toBe(true);
  });
  it('sin pedido de estado el aviso no manda una pagina', async () => {
    const r = await cierre([fak(1, 'no te entendi un carajo, no te entendi literalmente nada.'), dice(2, RESPUESTA)]);
    expect(r.ok).toBe(false);
    expect(r.detalle).not.toMatch(/escalon 3/);
  });
});

describe('chequeo 7 · VERDE: el turno cambio la forma, o el aviso no aplica', () => {
  it.each([
    ['cargo el skill', usa(17, 'Skill', { skill: 'explicar-mejor' })],
    ['cargo el skill con prefijo de plugin', usa(17, 'Skill', { skill: 'barack:explicar-mejor' })],
    ['leyo el SKILL.md', usa(17, 'Read', { file_path: 'C:\\Dev\\BarackMercosul\\.claude\\skills\\explicar-mejor\\SKILL.md' })],
    ['mostro un dibujo', usa(17, 'mcp__visualize__show_widget', { title: 'estado_tarea_nico', widget_code: '<svg></svg>' })],
    ['escribio una pagina', usa(17, 'Write', { file_path: 'C:\\Dev\\BarackMercosul\\exports\\explicaciones\\estado-tarea-nico.html', content: '<html></html>' })],
    ['mostro una pagina', usa(17, 'SendUserFile', { files: ['exports/explicaciones/estado-tarea-nico.html'], status: 'normal', display: 'render' })],
    ['publico una pagina', usa(17, 'Artifact', { file_path: 'x.html' })],
    ['entrego un archivo (el pedido era de un entregable)', usa(17, 'SendUserFile', { files: ['C:\\Dev\\BarackMercosul\\exports\\hojas\\HO-992.pptx'], status: 'normal' })],
  ])('pasa: %s', async (_, uso) => {
    const r = await cierre([...incidente, uso, dice(18, RESPUESTA)]);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });
  it('pasa: escribio el entregable afuera del repo y el cierre dice la ruta (sigue con sus reglas)', async () => {
    const r = await cierre([...incidente, usa(17, 'Edit', { file_path: ESCRITORIO, old_string: 'a', new_string: 'b' }), dice(18, 'x')], `Corregido. Quedó en ${ESCRITORIO}`);
    expect(r.ok).toBe(true);
  });
  it('pasa: la respuesta DICE que no aplica, con el renglon que pide el aviso', async () => {
    const texto = 'No aplica explicar-mejor: hablás de la hoja que va para Nico, que sigue con las reglas de las hojas de proceso.\n\nLa corrijo ahora.';
    expect((await cierre([...incidente, dice(17, texto)], texto)).ok).toBe(true);
    const alReves = 'Explicar-mejor no aplica: las palabras son de Manuel.';
    expect((await cierre([...incidente, dice(17, alReves)], alReves)).ok).toBe(true);
    expect(CANON_EXPLICAR.cierre.no_aplica_re).toBeTruthy();
  });
  it('pasa: un mensaje comun, y uno que solo pide corto ("sintetiza" no exige el skill)', async () => {
    expect((await cierre([...antes, fak(20, 'a ver abri la de hot melt ais la reviso..'), dice(21, 'Abierta.')], 'Abierta.')).ok).toBe(true);
    expect((await cierre([...antes, fak(20, 'sinteintezame que paso'), dice(21, 'Pasó esto.')], 'Pasó esto.')).ok).toBe(true);
  });
  it('pasa: Fak cargo el skill a mano con /explicar-mejor', async () => {
    const comando = l({ type: 'user', timestamp: T(17), isMeta: true, message: { content: '<command-message>explicar-mejor</command-message>\n<command-name>/explicar-mejor</command-name>' } });
    expect((await cierre([...incidente, comando, dice(18, RESPUESTA)])).ok).toBe(true);
  });
  it('pasa: stop_hook_active (segundo Stop del turno), sin loops', async () => {
    expect((await cierre([...incidente, dice(17, RESPUESTA)], RESPUESTA, { stop_hook_active: true })).ok).toBe(true);
  });
});

describe('chequeo 7 · lo que NO escribio Fak no cuenta como su ultimo mensaje', () => {
  const comun = [fak(1, 'corregi el amfe 173, ojo con la op 20')];
  it('un aviso de tarea, el resumen de un compactado, lo que manda otra sesion y el aviso de un hook no son de Fak', async () => {
    const r = await relevar([
      ...comun,
      l({ type: 'user', timestamp: T(5), origin: { kind: 'task-notification', producer: 'session-task' }, message: { content: '<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n<summary>el agente dice: no entendi nada, explicame</summary>\n</task-notification>' } }),
      l({ type: 'user', timestamp: T(6), isCompactSummary: true, isVisibleInTranscriptOnly: true, message: { content: 'This session is being continued from a previous conversation that ran out of context. Fak dijo: no te entendi un carajo, explicame mejor.' } }),
      l({ type: 'user', timestamp: T(7), isMeta: true, origin: { kind: 'peer', name: 'barackmercosul-51' }, message: { content: 'Another Claude session sent a message: <cross-session-message>no entiendo, explicame</cross-session-message>' } }),
      l({ type: 'user', timestamp: T(8), message: { content: [{ type: 'text', text: AVISO_APP }, { type: 'text', text: '<cross-session-message from="local_20b5">no entendi, explicame mejor</cross-session-message>' }] } }),
      l({ type: 'user', timestamp: T(9), isMeta: true, message: { content: 'Stop hook feedback:\n[bash cierre-guard.sh]: CIERRE-GUARD: Fak pidio que se lo expliques' } }),
      l({ type: 'user', timestamp: T(10), message: { content: AVISO_APP } }),
    ]);
    expect(r.ultimoMensajeFak).toBe('corregi el amfe 173, ojo con la op 20');
    expect(evaluarExplicar(RESPUESTA, r).bloquea).toBe(false);
  });
  it('ROJO de control: la misma frase escrita por Fak si cuenta', async () => {
    const r = await relevar([...comun, fak(5, 'no entendi nada, explicame')]);
    expect(evaluarExplicar(RESPUESTA, r).bloquea).toBe(true);
  });
});

describe('chequeo 7 · convive con los otros chequeos: un turno se frena una sola vez', () => {
  it('si ademas la cola pide permiso, sale UN aviso con las dos cosas', async () => {
    const texto = `${RESPUESTA}\n\nDecime y arranco.`;
    const r = await cierre([...incidente, dice(17, texto)], texto);
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/pidiendo permiso/);
    expect(r.detalle).toMatch(/ADEMAS, Fak pidio que se lo expliques/);
    expect(r.detalle).toMatch(/No aplica explicar-mejor:/);
  });
  it('si ademas termina anunciando trabajo, idem; y sin pedido de explicar el aviso del anuncio queda como estaba', async () => {
    const texto = `${RESPUESTA}\n\nSigo con las fotos.`;
    const r = await cierre([...incidente, dice(17, texto)], texto);
    expect(r.titulo).toMatch(/anunciando trabajo/);
    expect(r.detalle).toMatch(/ADEMAS, Fak pidio/);
    const comun = await cierre([...antes, fak(20, 'dale segui'), dice(21, texto)], texto);
    expect(comun.titulo).toMatch(/anunciando trabajo/);
    expect(comun.detalle).not.toMatch(/ADEMAS/);
  });
});

describe('cierre-guard.sh — el hook de verdad (bash -> node) con el transcript del incidente', () => {
  const HOOK = path.join(process.cwd(), '.claude', 'hooks', 'cierre-guard.sh');
  const correr = (payload) => spawnSync('bash', [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
  it('ROJO: exit 2 y el motivo por stderr · VERDE: con el skill cargado, exit 0', () => {
    const rojo = archivo([...incidente, dice(17, RESPUESTA)]);
    const verde = archivo([...incidente, usa(17, 'Skill', { skill: 'explicar-mejor' }), dice(18, RESPUESTA)]);
    try {
      const r = correr({ session_id: 's7', transcript_path: rojo, last_assistant_message: RESPUESTA });
      expect(r.status, r.stderr).toBe(2);
      expect(r.stderr).toMatch(/sin cambiar la forma/);
      const v = correr({ session_id: 's7', transcript_path: verde, last_assistant_message: RESPUESTA });
      expect(v.status, v.stderr).toBe(0);
      expect(v.stderr).toBe('');
    } finally { fs.unlinkSync(rojo); fs.unlinkSync(verde); }
  });
});

// ─────────────────────────────── regla mejora-implementada.md: una pieza del sistema no se cierra sin probarla
describe('pendiente de "mejora sin probar" (chequeo 3)', () => {
  const enRepo = (...p) => path.join(REPO, ...p);
  const edita = (n, ...p) => usa(n, 'Edit', { file_path: enRepo(...p), old_string: 'a', new_string: 'b' });
  const prueba = (n) => usa(n, 'Bash', { command: 'node scripts/_probarMejora.mjs --mensaje "che ene que estaod esta hace que sea faicl de entender"' });

  it('relevarTranscript junta las piezas del sistema que la sesion escribio (tambien desde un worktree) y nada mas', async () => {
    const r = await relevar([
      fak(1, 'agrega el aviso'),
      edita(2, '.claude', 'skills', 'explicar-mejor', 'SKILL.md'),
      edita(3, '.claude', 'worktrees', 'xenodochial-archimedes-510110', 'scripts', '_lib', 'explicarCanon.data.json'),
      edita(4, 'scripts', '_lib', 'cierreGuard.mjs'),
      edita(5, '.claude', 'settings.json'),
      edita(6, 'CLAUDE.md'),
      edita(7, '__tests__', 'scripts', 'explicarGuard.test.mjs'),
      edita(8, 'docs', 'LECCIONES_APRENDIDAS.md'),
      edita(9, 'scripts', '_backup.mjs'),
      edita(10, 'modules', 'amfe', 'apTable.ts'),
    ]);
    expect(r.sistema.archivos.sort()).toEqual(['.claude/settings.json', '.claude/skills/explicar-mejor/SKILL.md', 'CLAUDE.md', 'scripts/_lib/cierreGuard.mjs', 'scripts/_lib/explicarCanon.data.json']);
    expect(r.sistema.probada).toBe(false);
  });
  it('probada = la prueba con un mensaje real corrio DESPUES de la ultima escritura', async () => {
    const hook = ['.claude', 'hooks', 'explicar-prompt.sh'];
    expect((await relevar([fak(1, 'x'), edita(2, ...hook), prueba(3)])).sistema.probada).toBe(true);
    expect((await relevar([fak(1, 'x'), edita(2, ...hook), prueba(3), edita(4, ...hook)])).sistema.probada).toBe(false);
    expect((await relevar([fak(1, 'x'), prueba(2), edita(3, ...hook)])).sistema.probada).toBe(false);
    // nombrar el script sin correr la prueba (un cat, un --llego) no cuenta
    expect((await relevar([fak(1, 'x'), edita(2, ...hook), usa(3, 'Bash', { command: 'cat scripts/_probarMejora.mjs' })])).sistema.probada).toBe(false);
    expect((await relevar([fak(1, 'x'), edita(2, ...hook), usa(3, 'Bash', { command: 'node scripts/_probarMejora.mjs --llego' })])).sistema.probada).toBe(false);
  });
  it('pendientesDeMejora: sin piezas tocadas no pide nada; con piezas pide la prueba y el aviso de las sesiones abiertas', () => {
    expect(pendientesDeMejora('Listo, pusheado.', { archivos: [], probada: false })).toEqual([]);
    expect(pendientesDeMejora('Listo, pusheado.', undefined)).toEqual([]);
    const dos = pendientesDeMejora('Listo, pusheado.', { archivos: ['scripts/_lib/explicarGuard.mjs'], probada: false });
    expect(dos).toHaveLength(2);
    expect(dos[0]).toMatch(/_probarMejora\.mjs --mensaje/);
    expect(dos[1]).toMatch(/sesiones abiertas/);
    const uno = pendientesDeMejora('Listo, pusheado.', { archivos: ['scripts/_lib/explicarGuard.mjs'], probada: true });
    expect(uno).toHaveLength(1);
    expect(uno[0]).toMatch(/sesiones abiertas/);
    for (const cierreBien of ['Listo. Las sesiones abiertas lo toman solas.', 'Pusheado. Las sesiones que ya están abiertas hay que reabrirlas.', 'Listo: reabrí las otras sesiones para que tomen la regla.'])
      expect(pendientesDeMejora(cierreBien, { archivos: ['CLAUDE.md'], probada: true }), cierreBien).toEqual([]);
    expect(CANON.mejora.sistema_re).toBeTruthy();
  });
  it('ROJO: declarar el cierre con un hook tocado y sin probar bloquea · VERDE: probado y dicho, pasa', async () => {
    const hook = ['.claude', 'hooks', 'explicar-prompt.sh'];
    const rojo = await cierre([fak(1, 'agrega el aviso'), edita(2, ...hook), dice(3, 'x')], 'Listo, commiteado y pusheado.');
    expect(rojo.ok).toBe(false);
    expect(rojo.titulo).toMatch(/pendientes medibles/);
    expect(rojo.detalle).toMatch(/no las probaste despues del ultimo cambio con un mensaje REAL de Fak/);
    expect(rojo.detalle).toMatch(/sesiones abiertas/);
    const verde = await cierre([fak(1, 'agrega el aviso'), edita(2, ...hook), prueba(3), dice(4, 'x')], 'Listo, commiteado y pusheado. Las sesiones abiertas lo toman solas.');
    expect(verde.ok).toBe(true);
    const sinPiezas = await cierre([fak(1, 'corregi el test'), edita(2, '__tests__', 'scripts', 'x.test.mjs'), dice(3, 'x')], 'Listo, commiteado y pusheado.');
    expect(sinPiezas.ok).toBe(true);
  });
});

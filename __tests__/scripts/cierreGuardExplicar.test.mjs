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
    expect(r.explicar).toEqual({ skill: false, dibujo: false, pagina: false, envio: false, noAplica: false });
    expect(r.encargo).toBe(false);
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
  // Auditoria 02/10: de 12 turnos reales que pasaban, 5 eran pedidos de explicacion que pasaban SOLO por haber
  // escrito algo afuera del repo; y cualquier .html (el index.html de la app) contaba como "pagina".
  it('ROJO: escribir algo afuera del repo no exime, y un .html que no es una pagina de explicacion tampoco', async () => {
    const afuera = await cierre([...incidente, usa(17, 'Edit', { file_path: ESCRITORIO, old_string: 'a', new_string: 'b' }), dice(18, 'x')], `Corregido. Quedó en ${ESCRITORIO}`);
    expect(afuera.ok).toBe(false);
    expect(afuera.titulo).toMatch(/sin cambiar la forma/);
    const indexDeLaApp = await cierre([...incidente, usa(17, 'Edit', { file_path: 'C:\\Dev\\BarackMercosul\\index.html', old_string: 'a', new_string: 'b' }), dice(18, RESPUESTA)]);
    expect(indexDeLaApp.ok).toBe(false);
    const conElRenglon = `No aplica explicar-mejor: es la hoja que va para Nico.\n\nCorregida. Quedó en ${ESCRITORIO}`;
    expect((await cierre([...incidente, usa(17, 'Edit', { file_path: ESCRITORIO, old_string: 'a', new_string: 'b' }), dice(18, 'x')], conElRenglon)).ok).toBe(true);
  });
  it('pasa: la respuesta DICE que no aplica, con el renglon que pide el aviso', async () => {
    const texto = 'No aplica explicar-mejor: hablás de la hoja que va para Nico, que sigue con las reglas de las hojas de proceso.\n\nLa corrijo ahora.';
    expect((await cierre([...incidente, dice(17, texto)], texto)).ok).toBe(true);
    const alReves = 'Explicar-mejor no aplica: las palabras son de Manuel.';
    expect((await cierre([...incidente, dice(17, alReves)], alReves)).ok).toBe(true);
    expect(CANON_EXPLICAR.cierre.no_aplica_re).toBeTruthy();
  });
  // Auditoria 02/10: el renglon valia para UN cierre; un aviso de fin de agente despertaba la sesion y el
  // segundo cierre del mismo turno frenaba (4 turnos reales con 2 cierres o mas).
  it('pasa: el renglon "No aplica" vale para todo el turno, aunque un aviso de tarea lo despierte y haya otro cierre', async () => {
    const renglon = 'No aplica explicar-mejor: es el mail de Carlos, que sigue con las reglas de los mails.\n\nLo rehago más corto.';
    const aviso = l({ type: 'user', timestamp: T(19), origin: { kind: 'task-notification' }, message: { content: '<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n</task-notification>' } });
    const turno = [...incidente, dice(17, renglon), aviso, dice(20, 'El agente terminó: el mail quedó en Borradores.')];
    expect((await relevar(turno)).explicar.noAplica).toBe(true);
    expect((await cierre(turno, 'El agente terminó: el mail quedó en Borradores.')).ok).toBe(true);
    // un mensaje nuevo de Fak arranca otro turno: el renglon de antes ya no vale
    const otro = [...turno, fakConAviso(30, 'no entendi nada, explicame'), dice(31, RESPUESTA)];
    expect((await relevar(otro)).explicar.noAplica).toBe(false);
    expect((await cierre(otro)).ok).toBe(false);
  });
  it('el renglon cuenta si lo dijo el ASISTENTE en un texto; que aparezca en un archivo que se escribe no cuenta', async () => {
    const escribeUnTest = usa(17, 'Write', { file_path: 'C:\\Dev\\BarackMercosul\\__tests__\\x.test.mjs', content: 'No aplica explicar-mejor: esto es el texto de un test' });
    expect((await relevar([...incidente, escribeUnTest])).explicar.noAplica).toBe(false);
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

// ─────────────────────────────── auditoria del 02/10/2026: quien escribio el mensaje
describe('chequeo 7 · mensajes en cola y encargos (auditoria 02/10)', () => {
  const enCola = (n, prompt, origin = { kind: 'human' }) => l({ type: 'attachment', timestamp: T(n), attachment: { type: 'queued_command', commandMode: 'prompt', prompt, origin } });
  it('VERDE: lo que encola OTRA sesion (origin peer) no es de Fak, aunque diga "no entiendo, explicame"', async () => {
    const r = await relevar([fak(1, 'corregi el amfe 173'), enCola(5, 'No entiendo el estado, explicame mejor que hiciste', { kind: 'peer', name: 'barackmercosul-51' }), dice(6, RESPUESTA)]);
    expect(r.ultimoMensajeFak).toBe('corregi el amfe 173');
    expect(evaluarExplicar(RESPUESTA, r).bloquea).toBe(false);
  });
  it('ROJO: y el mensaje de otra sesion no tapa el pedido de Fak que venia antes', async () => {
    const r = await relevar([fak(1, 'no entiendo nada explicame mejor'), enCola(5, 'Parte de situacion: contestame en 5 lineas', { kind: 'peer' }), dice(6, RESPUESTA)]);
    expect(r.ultimoMensajeFak).toBe('no entiendo nada explicame mejor');
    expect(evaluarExplicar(RESPUESTA, r).bloquea).toBe(true);
  });
  it('ROJO: un mensaje en cola con una imagen llega como lista de bloques: se lee su texto, no "[object Object]"', async () => {
    const r = await relevar([fak(1, 'corregi el amfe 173'), enCola(5, [{ type: 'image', source: { type: 'base64', media_type: 'image/webp', data: 'UklGR' } }, { type: 'text', text: 'no entiendo esta pantalla explicame' }]), dice(6, RESPUESTA)]);
    expect(r.ultimoMensajeFak).toBe('no entiendo esta pantalla explicame');
    expect(evaluarExplicar(RESPUESTA, r).bloquea).toBe(true);
  });
  it('VERDE: una imagen en cola sin texto, o un aviso de tarea encolado, no pisan el ultimo mensaje de Fak', async () => {
    const r = await relevar([fak(1, 'corregi el amfe 173'), enCola(5, [{ type: 'image', source: {} }]), enCola(6, '<task-notification>fin</task-notification>'), dice(7, 'ok')]);
    expect(r.ultimoMensajeFak).toBe('corregi el amfe 173');
  });

  // El primer mensaje de una sesion lanzada por otra es un ENCARGO: lo redacto otra sesion y puede citar a Fak.
  const WORKTREE = '<system-reminder>\nYou are operating in a git worktree.\nWorktree path: C:\\Dev\\BarackMercosul\\.claude\\worktrees\\x\n</system-reminder>\n';
  const encargo = l({ type: 'user', timestamp: T(1), origin: { kind: 'human' }, promptSource: 'sdk', message: { role: 'user', content: [{ type: 'text', text: WORKTREE }, { type: 'text', text: 'Repo C:\\Dev\\BarackMercosul. Fak escribio que no entiende y pidio que sea faicl de entender. Arregla el hook y deja los tests.' }] } });
  it('VERDE: el encargo de otra sesion que cita palabras de Fak no exige el skill', async () => {
    const r = await relevar([encargo, usa(2, 'Edit', { file_path: path.join(REPO, 'scripts', '_backup.mjs'), old_string: 'a', new_string: 'b' }), dice(3, 'Hecho.')]);
    expect(r.encargo).toBe(true);
    expect(evaluarExplicar('Hecho.', r)).toMatchObject({ bloquea: false, motivo: expect.stringMatching(/encargo/) });
    expect((await cierre([encargo, dice(3, 'Arreglado el hook.')], 'Arreglado el hook.')).ok).toBe(true);
  });
  it('ROJO: en esa misma sesion, lo que despues escribe Fak si cuenta', async () => {
    const r = await relevar([encargo, dice(3, 'Hecho.'), fak(10, 'no entendi que hiciste, explicame'), dice(11, RESPUESTA)]);
    expect(r.encargo).toBe(false);
    expect(evaluarExplicar(RESPUESTA, r).bloquea).toBe(true);
  });
  it('ROJO de control: el aviso de la app por una tarea sugerida NO convierte el mensaje de Fak en un encargo', async () => {
    expect((await relevar([...incidente, dice(17, RESPUESTA)])).encargo).toBe(false);
  });
});

// ─────────────────────────────── regla mejora-implementada.md: una pieza del sistema no se cierra sin probarla
describe('pendiente de "mejora sin probar" (chequeo 3)', () => {
  const enRepo = (...p) => path.join(REPO, ...p);
  const edita = (n, ...p) => usa(n, 'Edit', { file_path: enRepo(...p), old_string: 'a', new_string: 'b' });
  const COMANDO = 'node scripts/_probarMejora.mjs --mensaje "che ene que estaod esta hace que sea faicl de entender"';
  // la prueba y su resultado: cuenta cuando vuelve sin error
  const prueba = (n, { error = false, comando = COMANDO } = {}) => [
    usa(n, 'Bash', { command: comando }, `toolu_prueba_${n}`),
    l({ type: 'user', timestamp: T(n), message: { content: [{ type: 'tool_result', tool_use_id: `toolu_prueba_${n}`, content: error ? 'Exit code 1\nRESULTADO: 1 falla(s)' : 'RESULTADO: sin fallas.', ...(error ? { is_error: true } : {}) }] } }),
  ];
  const HOOK = ['.claude', 'hooks', 'explicar-prompt.sh'];

  it('tres listas: lo que lee los mensajes de Fak, lo que pide avisar de las sesiones abiertas, y lo demas', async () => {
    const r = await relevar([
      fak(1, 'agrega el aviso'),
      edita(2, '.claude', 'skills', 'explicar-mejor', 'SKILL.md'),
      edita(3, '.claude', 'worktrees', 'xenodochial-archimedes-510110', 'scripts', '_lib', 'explicarCanon.data.json'),
      edita(4, 'scripts', '_lib', 'cierreGuard.mjs'),
      edita(5, '.claude', 'settings.json'),
      edita(6, 'CLAUDE.md'),
      edita(7, '.claude', 'rules', 'git-deploy.md'),
      edita(8, '.claude', 'hooks', 'dev-server-guard.sh'),
      edita(9, 'core', 'amfe', 'caracteristicasEspeciales.data.json'),
      // lo que NO entra (auditoria: la primera version tomaba 225 archivos, 106 de ellos scripts de skills)
      edita(10, '.claude', 'skills', 'hojas-de-proceso', 'hoja_proceso_check.py'),
      edita(11, 'scripts', '_lib', 'dryRunGuard.mjs'),
      edita(12, 'scripts', '_lib', 'consumosCanon.data.json'),
      edita(13, '__tests__', 'scripts', 'explicarGuard.test.mjs'),
      edita(14, 'docs', 'LECCIONES_APRENDIDAS.md'),
      edita(15, 'modules', 'amfe', 'apTable.ts'),
    ]);
    expect(r.sistema.deMensajes.sort()).toEqual(['.claude/settings.json', 'core/amfe/caracteristicasEspeciales.data.json', 'scripts/_lib/cierreGuard.mjs', 'scripts/_lib/explicarCanon.data.json']);
    expect(r.sistema.archivos.sort()).toEqual(['.claude/hooks/dev-server-guard.sh', '.claude/rules/git-deploy.md', '.claude/settings.json', 'CLAUDE.md', 'core/amfe/caracteristicasEspeciales.data.json', 'scripts/_lib/cierreGuard.mjs', 'scripts/_lib/explicarCanon.data.json']);
    expect(r.sistema.probada).toBe(false);
  });
  it('los hooks de mensajes y el cierre-guard de settings.json estan en la lista de lo que exige la prueba', () => {
    const s = JSON.parse(fs.readFileSync(path.join(REPO, '.claude', 'settings.json'), 'utf8'));
    const re = new RegExp(CANON.mejora.mensajes_re, 'i');
    const scripts = [...s.hooks.UserPromptSubmit, ...s.hooks.Stop].flatMap((g) => g.hooks.map((h) => h.command.match(/\.claude\/hooks\/[\w.-]+\.sh/)?.[0])).filter(Boolean);
    expect(scripts.length).toBeGreaterThanOrEqual(4);
    // dev-server-guard mira servidores de desarrollo, no lo que escribe Fak: _probarMejora no lo corre
    for (const h of scripts.filter((x) => !x.includes('dev-server-guard'))) expect(re.test(h), `${h} lee mensajes de Fak y no esta en cierreCanon mejora.mensajes_re`).toBe(true);
  });
  it('probada = la prueba corrio DESPUES del ultimo cambio y volvio sin error', async () => {
    expect((await relevar([fak(1, 'x'), edita(2, ...HOOK), ...prueba(3)])).sistema.probada).toBe(true);
    expect((await relevar([fak(1, 'x'), edita(2, ...HOOK), ...prueba(3), edita(4, ...HOOK)])).sistema.probada).toBe(false);
    expect((await relevar([fak(1, 'x'), ...prueba(2), edita(3, ...HOOK)])).sistema.probada).toBe(false);
    expect((await relevar([fak(1, 'x'), edita(2, ...HOOK), ...prueba(3, { error: true })])).sistema.probada).toBe(false);        // la prueba fallo
    expect((await relevar([fak(1, 'x'), edita(2, ...HOOK), usa(3, 'Bash', { command: COMANDO })])).sistema.probada).toBe(false);  // todavia no volvio
    // nombrar el script sin correr la prueba no cuenta: un cat, un grep, un echo, un --llego, el mensaje de un commit
    for (const comando of ['cat scripts/_probarMejora.mjs', `grep -n "${COMANDO}" docs/x.md`, `echo ${COMANDO}`, 'node scripts/_probarMejora.mjs --llego', `git commit -m "corri ${COMANDO.replace(/"/g, '')}" -- x.md`])
      expect((await relevar([fak(1, 'x'), edita(2, ...HOOK), ...prueba(3, { comando })])).sistema.probada, comando).toBe(false);
    // editar despues algo que NO lee mensajes (una regla, un test) no vence la prueba
    expect((await relevar([fak(1, 'x'), edita(2, ...HOOK), ...prueba(3), edita(4, '.claude', 'rules', 'git-deploy.md'), edita(5, '__tests__', 'scripts', 'x.test.mjs')])).sistema.probada).toBe(true);
  });
  // TRUE BUG de la auditoria: el orden normal de la casa (editar -> probar -> git add -> commit por ruta -> push)
  // frenaba el cierre, porque `git add` contaba como un cambio nuevo a la pieza ya probada.
  it('VERDE: editar, probar y despues `git add` + commit + push no vence la prueba; un `sed -i` despues, si', async () => {
    const commit = usa(5, 'Bash', { command: 'git add .claude/hooks/explicar-prompt.sh && git commit -m "fix" -- .claude/hooks/explicar-prompt.sh && git push origin main' });
    const orden = [fak(1, 'agrega el aviso'), edita(2, ...HOOK), ...prueba(3), commit, dice(6, 'x')];
    expect((await relevar(orden)).sistema.probada).toBe(true);
    expect((await cierre(orden, 'Listo, commiteado y pusheado. Las sesiones abiertas lo toman solas.')).ok).toBe(true);
    const tocaDespues = usa(5, 'Bash', { command: 'sed -i s/a/b/ .claude/hooks/explicar-prompt.sh && git add .claude/hooks/explicar-prompt.sh' });
    expect((await relevar([fak(1, 'x'), edita(2, ...HOOK), ...prueba(3), tocaDespues])).sistema.probada).toBe(false);
  });
  it('pendientesDeMejora: la prueba se pide solo por lo que lee mensajes; el aviso de las sesiones, por cualquier pieza', () => {
    expect(pendientesDeMejora('Listo, pusheado.', { archivos: [], deMensajes: [], probada: false })).toEqual([]);
    expect(pendientesDeMejora('Listo, pusheado.', undefined)).toEqual([]);
    const dos = pendientesDeMejora('Listo, pusheado.', { archivos: ['scripts/_lib/explicarGuard.mjs'], deMensajes: ['scripts/_lib/explicarGuard.mjs'], probada: false });
    expect(dos).toHaveLength(2);
    expect(dos[0]).toMatch(/_probarMejora\.mjs --mensaje/);
    expect(dos[1]).toMatch(/sesiones abiertas/);
    const uno = pendientesDeMejora('Listo, pusheado.', { archivos: ['scripts/_lib/explicarGuard.mjs'], deMensajes: ['scripts/_lib/explicarGuard.mjs'], probada: true });
    expect(uno).toHaveLength(1);
    expect(uno[0]).toMatch(/sesiones abiertas/);
    // una regla o CLAUDE.md: no hay mensaje que probar, pero Fak tiene que saber si reabre
    const regla = pendientesDeMejora('Listo, pusheado.', { archivos: ['.claude/rules/git-deploy.md'], deMensajes: [], probada: false });
    expect(regla).toHaveLength(1);
    expect(regla[0]).toMatch(/sesiones abiertas/);
    for (const cierreBien of ['Listo. Las sesiones abiertas lo toman solas.', 'Pusheado. Las sesiones que ya están abiertas hay que reabrirlas.', 'Listo: reabrí las otras sesiones para que tomen la regla.'])
      expect(pendientesDeMejora(cierreBien, { archivos: ['CLAUDE.md'], deMensajes: [], probada: false }), cierreBien).toEqual([]);
  });
  it('ROJO: declarar el cierre con un hook de mensajes tocado y sin probar bloquea · VERDE: probado y dicho, pasa', async () => {
    const rojo = await cierre([fak(1, 'agrega el aviso'), edita(2, ...HOOK), dice(3, 'x')], 'Listo, commiteado y pusheado.');
    expect(rojo.ok).toBe(false);
    expect(rojo.titulo).toMatch(/pendientes medibles/);
    expect(rojo.detalle).toMatch(/no las probaste despues del ultimo cambio con un mensaje REAL suyo/);
    expect(rojo.detalle).toMatch(/sesiones abiertas/);
    const verde = await cierre([fak(1, 'agrega el aviso'), edita(2, ...HOOK), ...prueba(3), dice(4, 'x')], 'Listo, commiteado y pusheado. Las sesiones abiertas lo toman solas.');
    expect(verde.ok).toBe(true);
    // lo que se edita todos los dias (un skill, un test, LECCIONES) no deja pendientes
    const sinPiezas = await cierre([fak(1, 'corregi el test'), edita(2, '__tests__', 'scripts', 'x.test.mjs'), edita(3, '.claude', 'skills', 'hojas-de-proceso', 'SKILL.md'), dice(4, 'x')], 'Listo, commiteado y pusheado.');
    expect(sinPiezas.ok).toBe(true);
  });
});

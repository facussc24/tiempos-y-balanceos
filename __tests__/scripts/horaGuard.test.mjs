// horaGuard: cuando Fak deja a Claude trabajando solo HASTA UNA HORA, que no cierre antes.
// Cubre hora-prompt.sh (UserPromptSubmit, aviso) y hora-guard.sh (Stop, frena con exit 2).
// Los mensajes de "REALES" son de Fak, textuales, con sus errores de tipeo (03/10/2026 y anteriores).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as H from '../../scripts/_lib/horaGuard.mjs';

const RAIZ = process.cwd();
let home;
beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'hora-guard-')); });
afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

const D = (txt) => H.aFecha(txt);
const REALES = {
  las8: 'dejo la tnobook cargandno yo vuevloa ami cas acomo a ala s8pm asi que quedate labruadnoc omo minimo hasta esa hroa testneaod etc dale y no me amdanse sninugunc artel de aprobacicon aim sino te quedass colgaod boludO!!! pensane meajroar lso videos que s eyo dale depodeos depslagea usbganetnetns...',
  las10: 'segui con las tres cosas pendientes y no pares pero atne sivnesitga ocmo jeorar cuando te digo litelamrent labrua hasta 8 pro ejempl ivneistga que fallao qy que pdomeosa hcer par aqueno vuevlea a suceder etnends? si quere sdpelga agnetnes sonnet que te ayuden ene sta tarea investiga como suelen ahcer si queres otra speornas no se pero busacle una oslcucion rpiemro a eso y luego continura hasta mañana a als 10am hasta esa hora no apres audita no se busa cque cosa shacer pro tuc uetna',
  diseno3d: 'Continúa con el diseño 3D mañana a las 10am quiero ver hasta donde llegaste ponerte un agente o un cronómetro algo para mejorar el diseño hasta esa hora usa agente es paralelado si hace falta….',
  las4am: 'aide aok? asi que nad apoentne un cronrormetro siq ueres par pabraura hasta las 4am hora armgentenia y abrimelo cuando temirens asi em depsie',
  todoElDia: 'si pero no pares osea continua de fomra autntotoam sin parar entendes? deja de depender de mi osea.... te dequiero dejar laburando todo el dia si hace flata ene sta tarea entendes?',
};
const NO_PIDEN = [
  'hace 6 hora sme dice uqe tmeirnast ey son las 1 1no te quedaste hasta las 8 entoences deicme porque defendete',   // un reclamo, en pasado
  'me lo enviaron ayer a las 21hs aparenemente tenes acceos a los amils?',
  'plxi ena rb aparenemtne las neuvas telas que cargmaos tieneel consumo hasta 10 veces mayor podemos verifiaclro prof avor?',
  'progrma ale mail con el ultimo pwoer point par aenviarse mañana 8am podes hacerlo correomcent o es muy difciicl',
  'par ano em enteinste croe usbiste las 4 fotos d edescargas la ide aera no repetir',                            // "croe" es "creo", no "cron"
  'la reunion con el director es el lunes a las 10',
  'bueno como seguimos? te recuerdo que el lunes debo presentar esta implementacion',
];

describe('horaGuard — ¿el mensaje pone una hora para trabajar?', () => {
  it('los pedidos reales de Fak se reconocen, con su hora', () => {
    const a = H.pideHasta(REALES.las8);
    expect(a.pide).toBe(true);
    expect(a.horas.map((h) => `${h.hora}${h.sufijo}`)).toContain('8pm');
    const b = H.pideHasta(REALES.las10);
    expect(b.pide).toBe(true);
    expect(b.manana).toBe(true);
    expect(b.horas.map((h) => `${h.hora}${h.sufijo}`)).toContain('10am');
    expect(b.senales).toContain('no_pares+hasta');
    expect(H.pideHasta(REALES.diseno3d).pide).toBe(true);
    expect(H.pideHasta(REALES.las4am).horas.map((h) => `${h.hora}${h.sufijo}`)).toContain('4am');
    const c = H.pideHasta(REALES.todoElDia);
    expect(c.pide).toBe(true);
    expect(c.sin_hora).toBe(true);
    expect(H.pideHasta('laburá hasta las 8').pide).toBe(true);
    expect(H.pideHasta('seguí trabajando hasta que vuelva').sin_hora).toBe(true);
  });

  it('ROJO: una hora que no es un pedido de trabajar no dispara (un reclamo, un mail a las 21hs, "hasta 10 veces")', () => {
    for (const t of NO_PIDEN) expect(H.pideHasta(t).pide, t).toBe(false);
  });

  it('el aviso dice que hay que armar, y con una hora ya vigente no lo repite entero; el latido no es un pedido', () => {
    const ahora = D('2026-10-03 13:50');
    const aviso = H.avisoDe(REALES.las8, { ahora });
    expect(aviso.startsWith(H.MARCA)).toBe(true);
    expect(aviso).toContain('--fijar');
    expect(aviso).toContain('CronCreate');
    expect(aviso).toContain(H.NO_APLICA);
    for (const t of NO_PIDEN) expect(H.avisoDe(t, { ahora }), t).toBe(null);
    const estado = { hasta: '2026-10-04 10:00', lista: 'C:\\x\\lista.md', latido: 'abc' };
    expect(H.avisoDe(REALES.las10, { estado, ahora })).toContain('Ya hay una hora fijada');
    expect(H.avisoDe('como va eso?', { estado, ahora })).toContain('Sigue vigente');
    expect(H.avisoDe('pará, dejalo así', { estado, ahora })).toContain('--terminar');
    expect(H.avisoDe('para que quede claro, seguí', { estado, ahora })).toContain('Sigue vigente');   // "para" preposicion
    expect(H.avisoDe('como va eso?', { estado: null, ahora })).toBe(null);
    expect(H.avisoDe('LATIDO (aviso automático, no es Facundo). Facundo pidió trabajar SIN PARAR hasta las 10:00', { estado, ahora })).toBe(null);
  });
});

describe('horaGuard — el estado: fijar, latido, terminar', () => {
  const sesion = 'sesion-1';
  it('fijar exige una hora futura y razonable y un archivo de lista que exista; terminar antes de hora pide el motivo', () => {
    const ahora = D('2026-10-03 23:15');
    expect(H.fijar({ sesion, hasta: 'las 10', ahora, home }).ok).toBe(false);
    expect(H.fijar({ sesion, hasta: '2026-10-03 20:00', ahora, home }).ok).toBe(false);           // ya paso
    expect(H.fijar({ sesion, hasta: '2026-10-09 10:00', ahora, home }).ok).toBe(false);           // mas de 36 horas
    expect(H.fijar({ sesion, hasta: '2026-10-04 10:00', lista: path.join(home, 'no-esta.md'), ahora, home }).ok).toBe(false);
    expect(H.fijar({ sesion: null, hasta: '2026-10-04 10:00', ahora, home }).ok).toBe(false);
    const lista = path.join(home, 'lista.md'); fs.writeFileSync(lista, '# lista\n');
    const r = H.fijar({ sesion, hasta: '2026-10-04 10:00', lista, pedido: 'hasta mañana a las 10am', ahora, home });
    expect(r.ok).toBe(true);
    expect(r.estado).toMatchObject({ hasta: '2026-10-04 10:00', latido: null });
    expect(H.vigente(sesion, { ahora, home }).hasta).toBe('2026-10-04 10:00');
    expect(H.vigente('otra-sesion', { ahora, home })).toBe(null);
    expect(H.registrarLatido({ sesion: 'otra-sesion', id: 'x', home }).ok).toBe(false);
    expect(H.registrarLatido({ sesion, id: '94e959d4', home }).estado.latido).toBe('94e959d4');
    expect(H.terminar({ sesion, ahora, home }).ok).toBe(false);                                     // antes de hora y sin motivo
    expect(H.vigente(sesion, { ahora, home })).not.toBe(null);
    expect(H.terminar({ sesion, porque: 'Fak dijo: pará, dejalo así', ahora, home }).ok).toBe(true);
    expect(H.vigente(sesion, { ahora, home })).toBe(null);
    // pasada la hora ya no esta vigente y se termina sin motivo
    H.fijar({ sesion, hasta: '2026-10-04 10:00', lista, ahora, home });
    expect(H.vigente(sesion, { ahora: D('2026-10-04 10:01'), home })).toBe(null);
    expect(H.terminar({ sesion, ahora: D('2026-10-04 10:01'), home })).toMatchObject({ ok: true, vencio: true });
    expect(H.contexto({ ahora, home })).toBe('');
  });

  it('el renglon para el arranque y la compactacion nombra la hora, la lista y el latido', () => {
    const ahora = D('2026-10-03 23:15');
    const lista = path.join(home, 'lista.md'); fs.writeFileSync(lista, '# lista\n');
    H.fijar({ sesion, hasta: '2026-10-04 10:00', lista, ahora, home });
    const c = H.contexto({ ahora, home });
    expect(c).toContain('2026-10-04 10:00');
    expect(c).toContain('lista.md');
    expect(c).toContain('SIN ARMAR');
    expect(H.contexto({ ahora: D('2026-10-04 11:00'), home })).toBe('');
  });
});

describe('hora-guard (Stop) — decide si el turno puede cerrar', () => {
  const sesion = 'sesion-1';
  const ahora = D('2026-10-03 17:10');
  const fijarHasta = (hasta = '2026-10-03 20:00') => {
    const lista = path.join(home, 'lista.md'); fs.writeFileSync(lista, '# lista\n');
    return H.fijar({ sesion, hasta, lista, ahora: D('2026-10-03 13:55'), home });
  };
  const stop = (extra) => H.decidirStop({ session_id: sesion, last_assistant_message: 'Sigo con el punto 3 de la lista.', ...extra }, { ahora, home, ultimoDeFak: () => '' });

  it('ROJO: hora vigente y ningun aviso programado vivo -> frena, tambien en el segundo intento del turno', () => {
    fijarHasta();
    expect(stop({ session_crons: [] })).toMatchObject({ ok: false, motivo: 'sin_latido' });
    expect(stop({ session_crons: [], stop_hook_active: true })).toMatchObject({ ok: false, motivo: 'sin_latido' });
    expect(stop({})).toMatchObject({ ok: false, motivo: 'sin_latido' });                              // sin el dato y sin registro
    // un latido registrado que ya murio (la app se reinicio) no cuenta si Claude Code dice que no hay ninguno
    H.registrarLatido({ sesion, id: 'viejo', home });
    expect(stop({ session_crons: [] })).toMatchObject({ ok: false, motivo: 'sin_latido' });
  });

  it('ROJO: hora vigente, latido vivo y el mensaje se despide como si hubiera terminado (el caso del 03/10 a las 17:10)', () => {
    fijarHasta();
    const r = stop({ session_crons: [{ id: 'a' }], last_assistant_message: 'Lo que quedó hecho: ... Resumen final para Facundo.' });
    expect(r).toMatchObject({ ok: false, motivo: 'cierre_antes_de_hora' });
    expect(r.mensaje).toContain('2026-10-03 20:00');
    // una sola vez por turno: el segundo intento pasa (no hay bucle), porque el latido lo va a despertar
    expect(stop({ session_crons: [{ id: 'a' }], last_assistant_message: 'Resumen final.', stop_hook_active: true }).ok).toBe(true);
  });

  it('declaraFin: «Terminé.» se despide; «cuando termine la suite, sigo» y «terminé la hoja 3 y sigo» no (04/10/2026)', () => {
    // ROJO: se despiden
    for (const t of ['Terminé.', 'Ya terminé con todo', 'Terminé por hoy, mañana sigo', 'Terminé todo lo de la lista', 'Eso es todo', 'Resumen final para Facundo', 'Quedó todo listo']) {
      expect(H.declaraFin(t), t).toBe(true);
    }
    // VERDE: avisos de que se sigue (el del 04/10 a la 1:42 era el primero, textual)
    for (const t of ['Sigo trabajando: corre la suite completa del plugin en la rama principal; cuando termine, armo y ensayo el paquete 9.',
      'Terminé la hoja 3 y sigo con la 4', 'Espero a que termine el agente', 'Hasta que termine el build no publico', 'Sigo con el punto 3 de la lista.']) {
      expect(H.declaraFin(t), t).toBe(false);
    }
  });

  it('VERDE: hora vigente, latido vivo y un mensaje que no cierra -> pasa (espera el proximo latido)', () => {
    fijarHasta();
    expect(stop({ session_crons: [{ id: 'a' }] })).toMatchObject({ ok: true, motivo: 'vigente_con_latido' });
    H.registrarLatido({ sesion, id: 'a', home });
    expect(stop({})).toMatchObject({ ok: true, motivo: 'vigente_con_latido' });                        // sin el dato, vale el registrado
  });

  it('VERDE: llego la hora, o es otra sesion, o es un agente -> pasa', () => {
    fijarHasta();
    expect(H.decidirStop({ session_id: sesion, last_assistant_message: 'Resumen final.', session_crons: [] }, { ahora: D('2026-10-03 20:01'), home, ultimoDeFak: () => '' }).ok).toBe(true);
    expect(H.decidirStop({ session_id: 'otra', last_assistant_message: 'Resumen final.' }, { ahora, home, ultimoDeFak: () => '' }).ok).toBe(true);
    expect(stop({ agent_id: 'x', session_crons: [] }).ok).toBe(true);
  });

  it('ROJO: el ultimo mensaje de Fak ponia una hora y no se fijo; VERDE: se fijo, o el cierre dice que no aplica', () => {
    const sinFijar = (final, extra = {}) => H.decidirStop({ session_id: sesion, transcript_path: 'x', last_assistant_message: final, ...extra }, { ahora, home, ultimoDeFak: () => REALES.las8 });
    expect(sinFijar('Dale, arranco.')).toMatchObject({ ok: false, motivo: 'hora_sin_fijar' });
    expect(sinFijar('Dale, arranco.', { stop_hook_active: true }).ok).toBe(true);
    expect(sinFijar(`${H.NO_APLICA} es un reclamo, no un pedido.`).ok).toBe(true);
    fijarHasta();
    expect(sinFijar('Dale, arranco.', { session_crons: [{ id: 'a' }] }).ok).toBe(true);
    // y un mensaje de Fak que no pone ninguna hora no frena nada
    expect(H.decidirStop({ session_id: 'otra', transcript_path: 'x', last_assistant_message: 'Listo.' }, { ahora, home, ultimoDeFak: () => NO_PIDEN[0] }).ok).toBe(true);
  });
});

describe('los wrappers hora-prompt.sh y hora-guard.sh llegan a horaGuard.mjs', () => {
  const correr = (hook, payload, env = {}) => spawnSync('bash', [path.join(RAIZ, '.claude', 'hooks', hook)], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...env } });

  it('hora-prompt.sh: con el mensaje real de Fak sale el aviso; con uno comun, nada. exit 0 siempre', () => {
    const si = correr('hora-prompt.sh', { hook_event_name: 'UserPromptSubmit', session_id: 'prueba-sin-estado', prompt: REALES.las10 });
    expect(si.status).toBe(0);
    expect(JSON.parse(si.stdout).hookSpecificOutput.additionalContext).toContain(H.MARCA);
    const no = correr('hora-prompt.sh', { hook_event_name: 'UserPromptSubmit', session_id: 'prueba-sin-estado', prompt: NO_PIDEN[1] });
    expect(no.status).toBe(0);
    expect(no.stdout).toBe('');
  });

  it('hora-guard.sh: VERDE exit 0 sin nada vigente; ROJO exit 2 con una hora vigente y sin latido (HOME de prueba)', () => {
    const verde = correr('hora-guard.sh', { hook_event_name: 'Stop', session_id: 'prueba-sin-estado', last_assistant_message: 'Listo.' }, { HOME: home, USERPROFILE: home });
    expect(verde.status).toBe(0);
    const lista = path.join(home, 'lista.md'); fs.writeFileSync(lista, '# lista\n');
    const manana = new Date(Date.now() + 3 * 3600 * 1000);
    expect(H.fijar({ sesion: 'prueba-hora', hasta: manana, lista, home }).ok).toBe(true);
    const rojo = correr('hora-guard.sh', { hook_event_name: 'Stop', session_id: 'prueba-hora', last_assistant_message: 'Sigo.', session_crons: [] }, { HOME: home, USERPROFILE: home });
    expect(rojo.status).toBe(2);
    expect(rojo.stderr).toContain(H.MARCA);
    const conLatido = correr('hora-guard.sh', { hook_event_name: 'Stop', session_id: 'prueba-hora', last_assistant_message: 'Sigo.', session_crons: [{ id: 'a' }] }, { HOME: home, USERPROFILE: home });
    expect(conLatido.status).toBe(0);
  });

  it('session-start-context.sh: al compactar y al reanudar reimprime el pedido vigente de ESA sesion, y de ninguna otra', () => {
    const lista = path.join(home, 'lista.md'); fs.writeFileSync(lista, '# lista\n');
    expect(H.fijar({ sesion: 'prueba-hora', hasta: new Date(Date.now() + 3 * 3600 * 1000), lista, home }).ok).toBe(true);
    const arranque = (modo, session_id) => spawnSync('bash', [path.join(RAIZ, '.claude', 'hooks', 'session-start-context.sh'), modo],
      { input: JSON.stringify({ hook_event_name: 'SessionStart', session_id }), encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: RAIZ } });
    const compacta = arranque('compact', 'prueba-hora');
    expect(compacta.status).toBe(0);
    expect(compacta.stdout).toContain('POST-COMPACT');
    expect(compacta.stdout).toContain(H.MARCA);
    expect(compacta.stdout).toContain('lista.md');
    expect(arranque('compact', 'otra-sesion').stdout).not.toContain(H.MARCA);
  });
});

// horaGuard con TEXTO DE MAQUINA (23/10/2026). El informe de un subagente llega a la sesion como un turno de usuario
// («<agent-message …>» + «[Subagent hand-back] …») y los frenos lo tomaban por un mensaje de Fak: el freno de hora leyo
// «14:32, 2, 5, 7, 3, 4 am» de un informe y freno el cierre del turno pidiendo fijar una hora que nadie pidio
// (PUNTOS_DEBILES_23-10 §2). Los tests de horaGuard.test.mjs usan mensajes cortos de Fak y no lo vieron.
// Los renglones del fixture son TEXTUALES del registro 749f61db del 23/10 (queue-operation enqueue): el de las 14:31
// («retoca hasta 2 veces»), el de las 14:44 («las 5 formas», «las 7 quejas», «si se alarga») y el de las 15:14 (el
// informe del critico, con «14:32», «4am» y las frases de los otros dos citadas adentro).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from '../../scripts/_lib/horaGuard.mjs';
import { esAutomatico } from '../../scripts/_lib/correccionGuard.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RENGLONES = fs.readFileSync(path.join(AQUI, 'fixtures', 'registro_749f61db_23-10.jsonl'), 'utf8').split('\n').filter(Boolean);
const renglon = (ts) => {
  const r = RENGLONES.find((l) => l.includes(`"${ts}"`) && l.includes('"enqueue"'));
  if (!r) throw new Error(`falta el renglon ${ts} en el fixture`);
  return r;
};
const INFORMES = {
  veces_1431: renglon('2026-10-23T14:31:54.105Z'),
  formas_1444: renglon('2026-10-23T14:44:10.799Z'),
  critico_1514: renglon('2026-10-23T15:14:26.283Z'),
};
const textoDe = (r) => JSON.parse(r).content;
/** El informe sin el sobre (lo que escribio el subagente): por si un dia llega sin «<agent-message». */
const cuerpo = (t) => t.slice(t.indexOf('The report follows:') + 'The report follows:'.length).replace(/<\/agent-message>\s*$/, '');

// Un pedido real de Fak (horaGuard.test.mjs, REALES.las10, textual con sus errores de tipeo): tiene que seguir frenando.
const PEDIDO_REAL = 'segui con las tres cosas pendientes y no pares pero atne sivnesitga ocmo jeorar cuando te digo litelamrent labrua hasta 8 pro ejempl ivneistga que fallao qy que pdomeosa hcer par aqueno vuevlea a suceder etnends? si quere sdpelga agnetnes sonnet que te ayuden ene sta tarea investiga como suelen ahcer si queres otra speornas no se pero busacle una oslcucion rpiemro a eso y luego continura hasta mañana a als 10am hasta esa hora no apres audita no se busa cque cosa shacer pro tuc uetna';

let home;
beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'hora-informes-')); });
afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

describe('horaGuard — el informe de un subagente NO es un mensaje de Fak (23/10/2026)', () => {
  it('ROJO antes (a): los tres informes reales empiezan con «<agent-message» y ahora son automaticos; no generan aviso', () => {
    const ahora = H.aFecha('2026-10-23 14:45');
    const estado = { hasta: '2026-10-23 20:00', lista: 'C:\\x\\lista.md' };
    for (const [nombre, r] of Object.entries(INFORMES)) {
      const t = textoDe(r);
      expect(t.startsWith('<agent-message'), nombre).toBe(true);
      expect(esAutomatico(t), nombre).toBe(true);
      expect(H.avisoDe(t, { ahora }), nombre).toBe(null);
      expect(H.avisoDe(t, { estado, ahora }), nombre).toBe(null);        // con una hora vigente tampoco: no es Fak hablando
      expect(H.mensajeDeFakEn(r), nombre).toBe(null);                     // el lector del registro (permisoGuard, tandaReglas)
    }
    // el otro prefijo de la lista: el informe sin el sobre de «<agent-message»
    expect(esAutomatico('[Subagent hand-back] The text below is the final report of a subagent')).toBe(true);
  });

  it('ROJO antes (b y c): el cuerpo de los informes, sin el sobre, tampoco pide trabajar hasta una hora', () => {
    // antes: 14:31 verbo+hasta («hasta 2 veces»), 14:44 reloj+hora («las 5 formas» + «alarga»), 15:14 verbo+hasta
    for (const [nombre, r] of Object.entries(INFORMES)) expect(H.pideHasta(cuerpo(textoDe(r))).pide, nombre).toBe(false);
  });

  it('Stop: con el informe como ultimo renglon, el ultimo mensaje de Fak es el suyo y no se frena el cierre', () => {
    const t = path.join(home, 'registro.jsonl');
    fs.writeFileSync(t, [
      JSON.stringify({ type: 'user', timestamp: '2026-10-23T14:20:00.000Z', message: { content: 'dale segui con la investigacion de los frenos' } }),
      JSON.stringify({ type: 'assistant', timestamp: '2026-10-23T14:21:00.000Z', message: { content: [{ type: 'text', text: 'Lanzo al crítico.' }] } }),
      INFORMES.veces_1431,
      INFORMES.formas_1444,
    ].join('\n'));
    const u = H.ultimoDeFakConHora(t);
    expect(u.texto).toBe('dale segui con la investigacion de los frenos');
    expect(u.ms).toBe(Date.parse('2026-10-23T14:20:00.000Z'));
    const stop = H.decidirStop({ session_id: 'sesion-informes', transcript_path: t, last_assistant_message: 'Llegó el informe del crítico; lo reviso y sigo.' }, { ahora: H.aFecha('2026-10-23 14:45'), home });
    expect(stop).toMatchObject({ ok: true, motivo: 'nada_vigente' });
    // VERDE que sigue: un pedido real de Fak con hora, despues del informe, SI frena
    fs.appendFileSync(t, `\n${JSON.stringify({ type: 'user', timestamp: '2026-10-23T14:50:00.000Z', message: { content: PEDIDO_REAL } })}`);
    const rojo = H.decidirStop({ session_id: 'sesion-informes', transcript_path: t, last_assistant_message: 'Dale, arranco.' }, { ahora: H.aFecha('2026-10-23 14:51'), home });
    expect(rojo).toMatchObject({ ok: false, motivo: 'hora_sin_fijar' });
  });

  it('ROJO antes (d): un renglon de usuario con origen que no es humano no es de Fak, aunque su texto no tenga sobre', () => {
    // ARMADO sobre el texto real: el cuerpo del informe de las 14:44 en un renglon `user` con origin peer y sin isMeta
    // (en el registro esos renglones vienen con isMeta; si un dia no, el criterio de cierreGuard.mjs:934 los saltea igual)
    const r = JSON.stringify({ type: 'user', timestamp: '2026-10-23T14:44:11.000Z', origin: { kind: 'peer' }, message: { content: cuerpo(textoDe(INFORMES.formas_1444)) } });
    expect(H.mensajeDeFakEn(r)).toBe(null);
    const tarea = JSON.stringify({ type: 'user', timestamp: '2026-10-23T14:44:12.000Z', origin: { kind: 'task-notification' }, message: { content: 'quedate laburando hasta las 20' } });
    expect(H.mensajeDeFakEn(tarea)).toBe(null);
    // VERDE: lo que escribio Fak (origin human, o sin origin como en los registros viejos) se sigue leyendo
    const fak = JSON.stringify({ type: 'user', timestamp: '2026-10-23T14:50:00.000Z', origin: { kind: 'human' }, message: { content: 'quedate laburando hasta las 20' } });
    expect(H.mensajeDeFakEn(fak)).toMatchObject({ texto: 'quedate laburando hasta las 20' });
    const viejo = JSON.stringify({ type: 'user', timestamp: '2026-10-23T14:50:00.000Z', message: { content: 'quedate laburando hasta las 20' } });
    expect(H.mensajeDeFakEn(viejo)).toMatchObject({ texto: 'quedate laburando hasta las 20' });
  });
});

describe('horaGuard — la hora y el reloj, exactos (23/10/2026)', () => {
  const palabras = (t) => t.split(' ');
  it('(b) «las N» solo es hora con a / para / desde / hasta adelante; «alas N» es el «a las» pegado', () => {
    // frases textuales de los informes de las 14:44
    for (const t of ['b las 5 formas mas probables de', 'con las 7 quejas por preguntas', 'tercero las 3 quejas que mas se repiten', 'son las 6 y media']) {
      expect(H.horasEn(palabras(t)), t).toEqual([]);
    }
    for (const [t, h] of [['a las 20', 20], ['hasta las 8', 8], ['para las 10', 10], ['desde las 9', 9], ['alas 8', 8], ['hasta la 1', 1], ['hasta 8', 8]]) {
      expect(H.horasEn(palabras(t)).map((x) => x.hora), t).toEqual([h]);
    }
  });

  it('(b) una hora pelada despues de «hasta» no cuenta si sigue veces, dias, piezas, kg o mil', () => {
    for (const t of ['retoca hasta 2 veces los archivos', 'ausente hasta 3 dias', 'hasta 6 piezas por hora', 'hasta 5 kg de espuma', 'hasta 10 mil metros']) {
      expect(H.horasEn(palabras(t)), t).toEqual([]);
    }
    // con un verbo de trabajar cerca (antes: verbo+hasta)
    expect(H.pideHasta('pero el guard falla: retoca hasta 2 veces los archivos de guard y no los puede mejorar').pide).toBe(false);
  });

  it('(b) «las 5 formas» al lado de un reloj de verdad no es un pedido (antes: reloj+hora)', () => {
    expect(H.pideHasta('Las 5 formas más probables de que falle el cronómetro del banco').pide).toBe(false);
  });

  it('(c) «alarga» no es «alarma»: el reloj corto va exacto (antes: reloj+hora); los largos aceptan tipeo', () => {
    expect(H.pideHasta('Boris suma cuando se equivoca, pero «si se alarga, se borra»; la revisión es a las 10').pide).toBe(false);
    // VERDE que sigue
    expect(H.pideHasta('ponete una alarma a las 10 y seguí').senales).toContain('reloj+hora');
    expect(H.pideHasta('aide aok? asi que nad apoentne un cronrormetro siq ueres par pabraura hasta las 4am hora armgentenia').pide).toBe(true);
  });

  it('(c) el reloj tiene que estar cerca de la hora, no en cualquier parte del texto (antes: reloj+hora)', () => {
    const lejos = 'Seguí trabajando en la planilla a las 10:30 con el informe de Pedro, que trae los consumos del mes, las fotos de la línea, los datos del arb y las notas del turno de ayer; el cronómetro de la máquina marca el ciclo';
    expect(H.pideHasta(lejos).pide).toBe(false);
    // VERDE: el mismo reloj al lado de la hora
    expect(H.pideHasta('poné un cronómetro para las 10:30 y seguí con la planilla').senales).toContain('reloj+hora');
  });

  it('VERDE: los pedidos reales de Fak siguen reconociendose con su hora', () => {
    const p = H.pideHasta(PEDIDO_REAL);
    expect(p.pide).toBe(true);
    expect(p.horas.map((h) => `${h.hora}${h.sufijo}`)).toContain('10am');
    expect(H.avisoDe(PEDIDO_REAL, { ahora: H.aFecha('2026-10-23 14:50') })).toContain(H.MARCA);
    for (const t of ['laburá hasta las 8', 'quedate laburando hasta 8', 'labura hasta las 20 hs', 'continua desde las 9 hasta las 12']) expect(H.pideHasta(t).pide, t).toBe(true);
  });

  it('(b) «hasta N notebooks / agentes / archivos / sesiones / %» cuenta cosas, no es una hora (mensaje de Fak del 23/10, textual)', () => {
    // registro 8ec29120, 23/10 14:18: el freno de hora leia «hasta 3 notoboks» como las 3
    const FAK_1418 = 'no se osea yo decia vasrias notbooks apra avanzr mas rapido en el aprendizaje entendeS? puedo djearte hasta 3 notoboks con catia par auqe es madnes ordene sy te pasen reustlaods tnendes? por la nube pdoraias coimucanoirte...';
    expect(H.pideHasta(FAK_1418).pide).toBe(false);
    for (const t of ['hasta 3 notebooks', 'hasta 2 notebook', 'hasta 4 agentes', 'hasta 1 agente', 'hasta 5 archivos', 'hasta 1 archivo', 'hasta 3 sesiones', 'hasta 1 sesion', 'hasta 20 %']) {
      expect(H.horasEn(palabras(t)), t).toEqual([]);
    }
    // VERDE que sigue: con el articulo es una hora, aunque despues diga notebooks
    expect(H.horasEn(palabras('hasta las 3')).map((x) => x.hora)).toEqual([3]);
    expect(H.pideHasta('dejá laburando las 3 notebooks hasta las 3').pide).toBe(true);
  });

  it('VERDE: el «hasta» mal escrito antes del articulo sigue valiendo («hsata las 20», «asta las 8», «hasat la 1»)', () => {
    for (const [t, h] of [['quedate laburando hsata las 20', 20], ['segui asta las 8', 8], ['labura hasat la 1', 1]]) {
      const p = H.pideHasta(t);
      expect(p.pide, t).toBe(true);
      expect(p.horas.map((x) => x.hora), t).toEqual([h]);
    }
  });
});

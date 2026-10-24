/**
 * Tests de la cita de Fak en el encargo (item 6g del viernes 23/10/2026, opcion 3 del informe 01: ancla por pregunta).
 *
 * LA FALLA: el 23/10 ~12:30 Fak pidio buscar «repositorios con Claudes ya entrenados, con skills ya hechas» y la sesion
 * lanzo un Opus a buscar «ejercicios 3D publicos con respuesta». Fak: «esto es gravisimo... que no me entiendas».
 *
 * LAS DOS DIRECCIONES, con los textos REALES del registro 749f61db (fixtures/encargoCita_749f61db_23-10.json, sacados
 * por programa con mensajesDeFak): una cita rastreada pasa SIN aviso; una inventada, la que falta y la de un turno que no
 * escribio Fak avisan hasta el 30/10 y frenan desde el 31/10 (fecha inyectada, hora de Argentina); el trabajo propio
 * declarado pasa con aviso. decidir() no cambia: los tests que ya existen lo llaman sin transcript ni fecha.
 */
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decidir, revisarCita, preguntasDe, bloquePedido, fechaAR, frena, CITA, mensajesDeFakDeLaSesion } from '../../scripts/_lib/coordinadorGuard.mjs';
import { mensajesDeFak } from '../../scripts/_lib/mailOkFak.mjs';

const RAIZ = process.cwd();
const FX = JSON.parse(fs.readFileSync(path.join(RAIZ, '__tests__/scripts/fixtures/encargoCita_749f61db_23-10.json'), 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'encargo-cita-'));
const HOME = path.join(TMP, 'home');
fs.mkdirSync(path.join(HOME, '.claude'), { recursive: true });
afterAll(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temp */ } });

const HOY = new Date('2026-10-23T15:31:00Z');          // 23/10 12:31 AR, el momento del incidente
const ULTIMO_AVISO = new Date('2026-10-31T01:30:00Z'); // 30/10 22:30 AR: en UTC ya es 31/10 y todavia AVISA
const PRIMER_FRENO = new Date('2026-10-31T03:30:00Z'); // 31/10 00:30 AR: FRENA

const SID = FX.sesion;
const deFak = (texto, timestamp, extra = {}) => ({ type: 'user', sessionId: SID, timestamp, message: { role: 'user', content: texto }, ...extra });
let n = 0;
function transcript(lineas) {
  const f = path.join(TMP, `tr-${n++}.jsonl`);
  fs.writeFileSync(f, `${lineas.map((x) => JSON.stringify(x)).join('\n')}\n`);
  return f;
}
const REALES = FX.mensajesFak.map((m) => deFak(m.texto, m.timestamp));
const TR_REAL = transcript(REALES);
const lanzamiento = (d) => FX.lanzamientos.find((l) => l.description === d);

// Un prompt largo como los de la casa (los de menos de 600 caracteres son pasos mecanicos y no se revisan).
const RELLENO = 'Solo lectura e internet: no escribas ni edites archivos y no instales nada. Castellano argentino simple. '
  + 'Cada afirmacion con URL y fecha; separa "dice la fuente" de "inferido". '.repeat(8);
const agente = (prompt, extra = {}, tp = TR_REAL) => ({ tool_name: 'Agent', session_id: SID, transcript_path: tp,
  tool_input: { description: 'Repos con skills 3D ya hechas', subagent_type: 'investigador', prompt, ...extra } });
const revisar = (payload, ahora = HOY, extra = {}) => revisarCita(payload, { ok: true }, { ahora, home: HOME, ...extra });

// La frase de Fak del 23/10 12:30 (15:30:13Z), copiada TAL CUAL y corregida como la citaria una sesion.
const LITERAL = 'te pdioq ue ancaleis is hay reposiutoc son claudes ya entradaods ose aocn ksilsl ya hechas';
const CORREGIDA = 'te pedí que analices si hay repositorios con Claudes ya entrenados, o sea con skills ya hechas';
// El ancla es un trozo de la cita TAL COMO ESTA ESCRITA (con la literal, el trozo lleva el tipeo de Fak).
const TROZO = { [LITERAL]: 'reposiutoc son claudes ya entradaods', [CORREGIDA]: 'repositorios con Claudes ya entrenados' };
const conCita = (cita, preguntas = [
  `1. ¿Qué repositorios públicos traen skills, agentes o configuraciones de Claude Code ya armadas para diseño 3D? [sale de: "${TROZO[cita] || 'x'}"]`,
  '2. Para cada uno: licencia, última actualización y si corre en Windows. [agregado mío]',
]) => [RELLENO, '', `PEDIDO DE FAK: "${cita}"`, '', 'TU PREGUNTA:', ...preguntas, 'ENTREGA: maximo 40 lineas.'].join('\n');

describe('6g · VERDE: la cita rastreada a un mensaje real de Fak pasa sin aviso', () => {
  it('C1 · la frase de Fak copiada tal cual y corregida (15:30:13Z), con cada pregunta anclada', () => {
    for (const cita of [LITERAL, CORREGIDA]) {
      const r = revisar(agente(conCita(cita)));
      expect(r.resultado, cita).toBe('cita rastreada');
      expect(r.nivel).toBe('ok');
      expect(r.texto).toEqual([]);
      expect(r.faltan).toEqual([]);
      // tambien el 31/10: lo que esta bien no frena nunca
      expect(revisar(agente(conCita(cita)), PRIMER_FRENO).nivel).toBe('ok');
    }
  });

  it('C2 · lo que mostro el informe 01: la cita del incidente ERA de Fak (12:28). El freno no ve el error de sentido', () => {
    const hasta1229 = FX.mensajesFak.filter((m) => m.timestamp <= '2026-10-23T15:29:29').map((m) => ({ ts: Date.parse(m.timestamp), texto: m.texto }));
    const preg = ['1. ¿Que repos ya hicieron partes? [sale de: "debe haber algun repo"]'];
    // Su segunda parte sale del mensaje de las 12:28, dos antes del ultimo (despues vinieron «si podiras lanzar 3 opus»
    // y «y algunso sonnet»): una cita real con una pregunta que no salia de ella pasa el rastro.
    const segunda = revisar(agente(conCita('debe haber algun repo que ya haya hecho partes', preg)), HOY, { mensajes: hasta1229 });
    expect(segunda.resultado).toBe('cita rastreada');
    expect(segunda.detalle).toMatch(/de=2 palabras/);
    // La cita entera, como la escribio la sesion (corregida y juntando dos frases), NO pasa: «normalmente no creamos
    // cosas de cero» contra «noormanete no cermaos cosa de s de0» tiene 2 de 4 palabras con tipeo de mas. La marca por
    // el tipeo, no por el sentido: copiada tal cual, pasa.
    const entera = revisar(agente(conCita('normalmente no creamos cosas de cero... debe haber algun repo que ya haya hecho partes', preg)), HOY, { mensajes: hasta1229 });
    expect(entera.resultado).toBe('cita no rastreada');
    expect(entera.faltan[0]).toMatch(/«normalmente no creamos cosas de cero» no está/);
    const tal = revisar(agente(conCita('noormanete no cermaos cosa de s de0... debe haber algun repo que ya haecho hecho algunas aprtes', preg)), HOY, { mensajes: hasta1229 });
    expect(tal.resultado).toBe('cita rastreada');
    expect(tal.detalle).toMatch(/literal/);
    // la misma cita contra mensajes de Fak que no la tienen NO se rastrea
    const antes = [{ ts: 1, texto: 'dame un repote cad 1 minuto de como van' }, { ts: 2, texto: 'abrime un txxt con el bloque de la v4 pero antes decime que carjao pensas' }];
    expect(revisar(agente(conCita('debe haber algun repo que ya haya hecho partes', preg)), HOY, { mensajes: antes }).resultado).toBe('cita no rastreada');
  });

  it('C2b · palabras parecidas SUELTAS por un mensaje largo de Fak no rastrean (tienen que estar juntas, como una subcadena)', () => {
    // «revisa las cotas del molde nuevo» daba 0,80 contra el mensaje de las 12:28 contando palabras sueltas (cotas ~ cosas,
    // nuevo ~ nueb); ese mensaje no habla de cotas ni de moldes.
    expect(revisar(agente(conCita('revisa las cotas del molde nuevo que te mande', ['1. x [agregado mío]']))).resultado).toBe('cita no rastreada');
  });
});

describe('6g · ROJO: cita inventada, sin cita, o de un turno que no escribio Fak → AVISO hasta el 30/10, FRENO desde el 31/10', () => {
  // La frase que la sesion se habia propuesto a si misma un mensaje antes del incidente, rotulada como de Fak.
  const INVENTADA = 'sumar mas ejercicios publicos con respuesta conocida al banco';

  it('C3 · cita inventada: avisa el 23/10 y el 30/10 a las 22:30 AR (ya 31/10 en UTC); frena el 31/10 a las 00:30 AR', () => {
    const p = agente(conCita(INVENTADA, ['1. ¿Que bancos de ejercicios 3D traen respuesta verificable? [sale de: "ejercicios publicos con respuesta"]']));
    const a = revisar(p, HOY);
    expect(a.resultado).toBe('cita no rastreada');
    expect(a.nivel).toBe('aviso');
    expect(a.texto.join('\n')).toMatch(/PEDIDO DE FAK: "/);
    expect(a.texto.join('\n')).toMatch(/último mensaje de Fak \(12:30\), textual: «no te pdio ejercicos/);
    expect(revisar(p, ULTIMO_AVISO).nivel).toBe('aviso');
    const f = revisar(p, PRIMER_FRENO);
    expect(f.nivel).toBe('freno');
    expect(f.texto[0]).toMatch(/FRENO/);
    expect(f.faltan.join(' ')).toMatch(/no está en ningún mensaje de Fak/);
  });

  it('C4 · sin renglon PEDIDO DE FAK: el lanzamiento REAL del incidente (23/10 12:29, «Ejercicios 3D públicos con respuesta»)', () => {
    const l = lanzamiento('Ejercicios 3D públicos con respuesta');
    const p = agente(l.prompt, { description: l.description, subagent_type: l.subagent_type });
    const a = revisar(p);
    expect(a.resultado).toBe('sin cita');
    expect(a.nivel).toBe('aviso');
    expect(a.faltan[0]).toMatch(/no hay un renglón «PEDIDO DE FAK/);
    expect(a.faltan.join(' ')).toMatch(/TU PREGUNTA.*no dice de qué frase sale/);   // su «TU PREGUNTA» no tiene ancla
    expect(revisar(p, PRIMER_FRENO).nivel).toBe('freno');
  });

  it('C5 · «PEDIDO DE FAK» resumido con palabras de la sesion, sin comillas (real: «3 notebooks coordinadas por la nube», 12:29)', () => {
    const l = lanzamiento('3 notebooks coordinadas por la nube');
    const a = revisar(agente(l.prompt, { description: l.description }));
    expect(a.resultado).toBe('sin cita');
    expect(a.faltan[0]).toMatch(/no trae su frase entre comillas/);
    expect(revisar(agente(l.prompt), PRIMER_FRENO).nivel).toBe('freno');
  });

  it('C6 · una cita de menos de 6 palabras no alcanza', () => {
    const a = revisar(agente(conCita('si dale hacelo')));
    expect(a.resultado).toBe('sin cita');
    expect(a.faltan[0]).toMatch(/menos de 6 palabras/);
  });

  it('C7 · cita rastreada pero una pregunta sin ancla, o con un ancla que no esta en la cita ni en Fak', () => {
    const sinAncla = revisar(agente(conCita(LITERAL, ['1. ¿Qué repositorios traen skills ya hechas? [sale de: "reposiutoc son claudes ya entradaods"]', '2. ¿Y bancos de ejercicios 3D con respuesta?'])));
    expect(sinAncla.resultado).toBe('cita rastreada');
    expect(sinAncla.nivel).toBe('aviso');
    expect(sinAncla.faltan).toHaveLength(1);
    expect(sinAncla.faltan[0]).toMatch(/«2\. ¿Y bancos.*no dice de qué frase sale/);
    const anclaFalsa = revisar(agente(conCita(LITERAL, ['1. ¿Qué bancos de ejercicios hay? [sale de: "bancos de ejercicios con respuesta verificable"]'])), PRIMER_FRENO);
    expect(anclaFalsa.nivel).toBe('freno');
    expect(anclaFalsa.faltan[0]).toMatch(/el ancla \[sale de: "bancos de ejercicios/);
  });
});

describe('6g · lo que NO cuenta como palabras de Fak (no_es_de_fak y los prefijos locales del canon)', () => {
  const FRASE = 'buscame los planos de la pieza del techo en la carpeta de Calidad ahora';
  const casos = {
    'aviso de tarea (<task-notification)': `<task-notification>\n<task-id>x</task-id>\n${FRASE}\n</task-notification>`,
    'informe de un subagente (<agent-message)': `<agent-message from="ab87e493e84f27c01">\n[Subagent hand-back] ${FRASE}`,
    'mensaje de otra sesion (<cross-session-message)': `<cross-session-message from="otra">${FRASE}</cross-session-message>`,
    'encargo de otra sesion ([ENCARGO …])': `[ENCARGO E261023-abcd]\nPARA: barackmercosul-c9\n\n${FRASE}`,
    'arranque de una hija de start_session (Background …, sin origin: medido el 23/10)': `Background (from the session that started this one):\n${FRASE}`,
  };
  for (const [nombre, texto] of Object.entries(casos)) {
    it(`C8 · ROJO · ${nombre}`, () => {
      const tp = transcript([...REALES, deFak(texto, '2026-10-23T15:31:30.000Z')]);
      const a = revisar(agente(conCita(FRASE, ['1. ¿Donde estan? [sale de: "los planos de la pieza del techo"]']), {}, tp));
      expect(a.resultado).toBe('cita no rastreada');
    });
  }

  it('C9 · VERDE · lo que Fak escribio DESPUES de un aviso de la app es suyo; lo de adentro del aviso, no', () => {
    const tp = transcript([...REALES, deFak(`<system-reminder>The user opened the file ${'x'.repeat(10)} y tambien revisa las cotas del molde nuevo</system-reminder>${FRASE}`, '2026-10-23T15:31:30.000Z')]);
    expect(revisar(agente(conCita(FRASE, ['1. ¿Donde estan? [sale de: "los planos de la pieza del techo"]']), {}, tp)).resultado).toBe('cita rastreada');
    const dentro = revisar(agente(conCita('revisa las cotas del molde nuevo que te mande', ['1. x [agregado mío]']), {}, tp));
    expect(dentro.resultado).toBe('cita no rastreada');
  });

  it('C10 · una hija sin ningun mensaje de Fak (solo su Background y un informe): no rastreada, y dice por que', () => {
    const tp = transcript([deFak(`Background (from the session that started this one):\n${CORREGIDA}`, '2026-10-23T15:31:00.000Z'),
      deFak('<agent-message from="a1">\n[Subagent hand-back] listo', '2026-10-23T15:32:00.000Z')]);
    const a = revisar(agente(conCita(CORREGIDA), {}, tp));
    expect(a.resultado).toBe('cita no rastreada');
    expect(a.faltan[0]).toMatch(/no tiene ningún mensaje de Fak/);
    expect(mensajesDeFakDeLaSesion({ transcript_path: tp }, HOME)).toEqual([]);
  });
});

describe('6g · trabajo propio, exentos, canales y lo que no se revisa', () => {
  it('C11 · «PEDIDO DE FAK: ninguno (trabajo propio: …)» pasa con aviso, tambien el 31/10; sin el por que, es «sin cita»', () => {
    const p = agente(`${RELLENO}\n\nPEDIDO DE FAK: ninguno (trabajo propio: auditoria del diff antes de fundir la rama 6g)\n\nRevisá el diff.`);
    for (const ahora of [HOY, PRIMER_FRENO]) {
      const r = revisar(p, ahora);
      expect(r.resultado).toBe('trabajo propio');
      expect(r.nivel).toBe('aviso');
      expect(r.texto[0]).toMatch(/trabajo propio, sin pedido de Fak detrás: auditoria del diff/);
    }
    const sinPorQue = revisar(agente(`${RELLENO}\n\nPEDIDO DE FAK: ninguno\n\nRevisá el diff. [agregado mío]`), PRIMER_FRENO);
    expect(sinPorQue.resultado).toBe('sin cita');
    expect(sinPorQue.nivel).toBe('freno');
  });

  it('C12 · exentos del informe 01: auditor/revisor/buscador, paso mecanico corto o que arranca con «Leé ENTERO» / «Trabajás en»', () => {
    const l = lanzamiento('Ejercicios 3D públicos con respuesta');
    for (const t of CITA.tiposExentos) expect(revisar(agente(l.prompt, { subagent_type: t }), PRIMER_FRENO).resultado).toBe('exento');
    expect(revisar(agente('Relevá los codigos incompletos de la BOM de ductos y devolvé una tabla.'), PRIMER_FRENO).resultado).toBe('exento');
    expect(revisar(agente(`Leé ENTERO el archivo C:/Dev/x.md y decime que dice. ${RELLENO}`), PRIMER_FRENO).resultado).toBe('exento');
    expect(revisar(agente(`Trabajás en C:/Dev/wt-6g: corré los tests. ${RELLENO}`), PRIMER_FRENO).resultado).toBe('exento');
    // investigador con el mismo prompt NO es exento
    expect(revisar(agente(l.prompt), PRIMER_FRENO).nivel).toBe('freno');
  });

  it('C13 · el encargo a otra sesion tambien: start_session con prompt y SendMessage con [ENCARGO]; no un subagente propio ni el escape', () => {
    const encargo = `[ENCARGO E261023-abcd]\nPARA: barackmercosul-c9\nENTREGABLE (uno solo): x\nORIGEN: fak\n\n${RELLENO}\nArmá la tabla.`;
    const start = { tool_name: 'mcp__ccd_session__start_session', session_id: SID, transcript_path: TR_REAL, tool_input: { title: 'barackmercosul-c9', prompt: encargo } };
    expect(revisar(start, PRIMER_FRENO).nivel).toBe('freno');
    const bien = encargo.replace('Armá la tabla.', `PEDIDO DE FAK: "${LITERAL}"\nArmá la tabla de repos. [sale de: "reposiutoc son claudes"]`);
    expect(revisar({ ...start, tool_input: { ...start.tool_input, prompt: bien } }, PRIMER_FRENO).nivel).toBe('ok');
    const msg = { tool_name: 'SendMessage', session_id: SID, transcript_path: TR_REAL, tool_input: { to: 'barackmercosul-c9', message: encargo } };
    expect(revisar(msg, PRIMER_FRENO).nivel).toBe('freno');
    expect(revisarCita(msg, { ok: true, escape: '/x' }, { ahora: PRIMER_FRENO, home: HOME })).toBeNull();
    expect(revisarCita(msg, { ok: true, subagentePropio: 'auditor-img' }, { ahora: PRIMER_FRENO, home: HOME })).toBeNull();
    expect(revisarCita(msg, { ok: false }, { ahora: PRIMER_FRENO, home: HOME })).toBeNull();
    expect(revisar({ ...msg, tool_input: { to: 'x', message: 'Gracias, recibido.' } }, PRIMER_FRENO)).toBeNull();   // no es encargo
    expect(revisar({ tool_name: 'mcp__ccd_session__hand_off_to_session', tool_input: { remaining_plan: RELLENO } }, PRIMER_FRENO)).toBeNull();
    expect(revisar({ tool_name: 'Bash', tool_input: { command: 'ls' } }, PRIMER_FRENO)).toBeNull();
  });

  it('C14 · transcript que no se puede leer: avisa y NO frena nunca (no se frena por no poder mirar)', () => {
    const a = revisar(agente(conCita(LITERAL), {}, path.join(TMP, 'no-existe.jsonl')), PRIMER_FRENO);
    expect(a.resultado).toBe('sin transcript');
    expect(a.nivel).toBe('aviso');
  });

  it('C15 · decidir() no cambio su contrato: un Agent largo sin cita sigue dando { ok: true } sin aviso', () => {
    const l = lanzamiento('Ejercicios 3D públicos con respuesta');
    expect(decidir(agente(l.prompt), { hayEscape: () => false })).toEqual({ ok: true });
  });
});

describe('6g · piezas: preguntas, bloque, fecha, registro y la cola del transcript', () => {
  it('C16 · las preguntas reales: «PREGUNTAS» numeradas (40 puntos) son 4; «TU PREGUNTA» sin lista es 1; sin seccion, el encargo entero', () => {
    expect(preguntasDe(lanzamiento('Poner a prueba los 40 puntos').prompt)).toHaveLength(4);
    const inc = preguntasDe(lanzamiento('Ejercicios 3D públicos con respuesta').prompt);
    expect(inc).toHaveLength(1);
    expect(inc[0].texto).toMatch(/bancos o colecciones PUBLICAS/);
    expect(inc[0].texto).not.toMatch(/ENTREGA/);
    const sin = preguntasDe('Revisá el diff y decime si hay un bug.');
    expect(sin).toHaveLength(1);
    expect(sin[0].etiqueta).toMatch(/el encargo/);
  });

  it('C17 · el bloque del pedido: un renglon, o varios mientras la comilla siga abierta; y las variantes del rotulo', () => {
    expect(bloquePedido('x\nPEDIDO DE FAK: "una frase"\nTU PREGUNTA: y').texto).toBe('"una frase"');
    expect(bloquePedido('PEDIDO DE FAK (23/10 12:28): «una frase\nque sigue abajo»\nlo de abajo ya no').texto).toBe('«una frase\nque sigue abajo»');
    expect(bloquePedido('**PEDIDO DE FAK**: "x"')).not.toBeNull();
    expect(bloquePedido('PEDIDO / PLAN DE FAK: algo')).toBeNull();
  });

  it('C18 · la fecha es la de Argentina: el 30/10 22:30 AR avisa, el 31/10 00:30 AR frena', () => {
    expect(fechaAR(ULTIMO_AVISO)).toBe('2026-10-30');
    expect(frena(ULTIMO_AVISO)).toBe(false);
    expect(fechaAR(PRIMER_FRENO)).toBe('2026-10-31');
    expect(frena(PRIMER_FRENO)).toBe(true);
    expect(CITA.avisoHasta).toBe('2026-10-30');
  });

  it('C19 · cada caso revisado deja su renglon en ~/.claude/.encargo-cita.log (aca, un HOME de prueba)', () => {
    const f = path.join(HOME, '.claude', CITA.registro);
    const antes = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length : 0;
    revisar(agente(conCita(LITERAL)));
    revisar(agente('corto'));
    const nuevas = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(antes);
    expect(nuevas).toHaveLength(2);
    const [a, b] = nuevas.map((l) => l.split('\t'));
    expect(a).toHaveLength(7);
    expect(a[0]).toBe('2026-10-23 12:31:00');
    expect(a.slice(1, 6)).toEqual([SID, 'Agent', 'investigador', 'cita rastreada', 'ok']);
    expect(b[4]).toBe('exento');
    const todos = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')[4]);
    for (const r of ['cita rastreada', 'cita no rastreada', 'sin cita', 'trabajo propio']) expect(todos).toContain(r);
  });

  it('C20 · mensajesDeFak con colaBytes: sin el parametro lee igual que antes; con una cola chica, solo los ultimos', () => {
    expect(mensajesDeFak(TR_REAL)).toEqual(mensajesDeFak(TR_REAL, {}));
    expect(mensajesDeFak(TR_REAL)).toHaveLength(6);
    const ultimaLinea = `${JSON.stringify(REALES[REALES.length - 1])}\n`;
    const cola = mensajesDeFak(TR_REAL, { colaBytes: Buffer.byteLength(ultimaLinea) + 10 });
    expect(cola).toHaveLength(1);
    expect(cola[0].texto).toMatch(/^no te pdio ejercicos/);
  });
});

describe('6g · main() por proceso (HOME de prueba): el aviso llega por additionalContext y el freno de G4 sigue', () => {
  const correr = (payload) => spawnSync(process.execPath, [path.join(RAIZ, 'scripts/_lib/coordinadorGuard.mjs')],
    { input: JSON.stringify(payload), env: { ...process.env, HOME, USERPROFILE: HOME }, encoding: 'utf8', timeout: 30000 });
  const contexto = (s) => JSON.parse(s.stdout).hookSpecificOutput.additionalContext;

  it('C21 · un Agent sin cita: exit 0 y el aviso en JSON (hoy es antes del 31/10)', () => {
    if (fechaAR(new Date()) > CITA.avisoHasta) return;   // desde el 31/10 este mismo caso frena: lo cubre C3/C4 con la fecha inyectada
    const l = lanzamiento('Ejercicios 3D públicos con respuesta');
    const s = correr(agente(l.prompt, { description: l.description }));
    expect(s.status).toBe(0);
    const ctx = contexto(s);
    expect(ctx).toMatch(/COORDINADOR-GUARD — AVISO/);
    expect(ctx).toMatch(/PEDIDO DE FAK: "/);
  });

  it('C22 · el aviso de «tool desconocida» de decidir() ya no se pierde: sale por additionalContext', () => {
    const s = correr({ tool_name: 'mcp__otro__dispatch_job', tool_input: { prompt: 'x' } });
    expect(s.status).toBe(0);
    expect(contexto(s)).toMatch(/arranca trabajo en otro lado y el guardian no la revisa/);
  });

  it('C23 · la cita rastreada con sus anclas: exit 0 y nada en stdout; una orden irreversible sigue saliendo con 2', () => {
    const ok = correr(agente(conCita(LITERAL)));
    expect(ok.status).toBe(0);
    expect(ok.stdout).toBe('');
    const g4 = correr(agente(`${conCita(LITERAL)}\nCuando termines cerra el arb.`));
    expect(g4.status).toBe(2);
    expect(g4.stderr).toMatch(/BLOQUEO/);
  });
});

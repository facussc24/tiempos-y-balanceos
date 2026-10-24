// El OK de Fak tiene que llegar DESPUES de que el borrador quedo armado en su pantalla.
// Caso real del 08/10/2026 (sesion 5af511d9), con sus mensajes textuales y sus horas UTC:
//   12:08:27 Fak (escribe mientras trabajo): "...arma el mial y mandalo y tarea cerrada gracias"
//   12:14:33 y 12:16:48 _prepararMail.py arma el borrador · 12:19:01 _mailEnviar.py --enviar  -> salio sin que lo viera
//   12:25:14 se arma la respuesta con el link · 12:26:56 Fak: "ok envia el rpoximoi mail..."  -> ese si
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pedidoDeEnvio, ultimoMensajeDeFak, veredicto, claveAsunto, mensajesDeFak, primerMensajeDeFak } from '../../scripts/_lib/mailOkFak.mjs';

const s = (iso) => Date.parse(iso) / 1000;
const ASUNTO = 'tiempos forrado ductos patagonia - videos del 07/10';

function transcript(lineas) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailok-'));
  const f = path.join(dir, 't.jsonl');
  fs.writeFileSync(f, lineas.map((o) => JSON.stringify(o)).join('\n'));
  return f;
}
const encolado = (ts, prompt, extra = {}) => ({ type: 'attachment', timestamp: ts, attachment: { type: 'queued_command', commandMode: 'prompt', prompt, ...extra } });
const usuario = (ts, content, extra = {}) => ({ type: 'user', timestamp: ts, message: { role: 'user', content }, ...extra });

const MANDALO = 'mandale el video a paulo en el cuerpo sintniezale los timeposdigamos arma el mial y mandalo y tarea cerrada gracias';
const OK_DESPUES = 'ok envia el rpoximoi mail repsonddieondo al ultimo mio digmaos... esta bien....';

describe('pedidoDeEnvio', () => {
  it('reconoce el envio real, con --id o --buscar, tambien con --forzar', () => {
    expect(pedidoDeEnvio('python scripts/_mailEnviar.py --buscar "Tiempos forrado ductos Patagonia" --enviar')).toEqual({ id: '', buscar: 'Tiempos forrado ductos Patagonia' });
    expect(pedidoDeEnvio('timeout 170 python scripts/_mailEnviar.py --id ABC123 --forzar --enviar').id).toBe('ABC123');
  });
  it('el dry-run, el selftest y otros scripts no son envio', () => {
    expect(pedidoDeEnvio('python scripts/_mailEnviar.py --buscar "x"')).toBeNull();
    expect(pedidoDeEnvio('python scripts/_mailEnviar.py --selftest')).toBeNull();
    expect(pedidoDeEnvio('python scripts/_prepararMail.py mail.json')).toBeNull();
  });
});

describe('ultimoMensajeDeFak', () => {
  it('cuenta lo que Fak escribe mientras trabajo y no cuenta avisos, resultados ni el feedback de un hook', () => {
    const f = transcript([
      encolado('2026-10-08T12:08:27.102Z', MANDALO),
      usuario('2026-10-08T12:10:00.000Z', [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }]),
      encolado('2026-10-08T12:14:38.306Z', '<task-notification>\n<task-id>b3hk91qsp</task-id>'),
      usuario('2026-10-08T12:15:00.000Z', 'Stop hook feedback:\n[bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/cierre-guard.sh"]: CIERRE-GUARD: ...'),
      encolado('2026-10-08T12:16:00.000Z', 'mensaje de otra sesion', { origin: { kind: 'peer' } }),
    ]);
    expect(ultimoMensajeDeFak(f)).toBe(Date.parse('2026-10-08T12:08:27.102Z'));
  });
  it('sin transcript da 0 (y eso bloquea)', () => {
    expect(ultimoMensajeDeFak(path.join(os.tmpdir(), 'no-existe-mailok.jsonl'))).toBe(0);
  });
});

describe('veredicto — el incidente del 08/10/2026', () => {
  const registro = [{ entry_id: 'E1', clave: ASUNTO, armado_epoch: s('2026-10-08T12:16:48.370Z') }];
  const pedido = pedidoDeEnvio('python scripts/_mailEnviar.py --buscar "Tiempos forrado ductos Patagonia" --enviar');

  it('BLOQUEA: el "mandalo" es anterior al borrador', () => {
    const v = veredicto({ pedido, ultimoFakMs: Date.parse('2026-10-08T12:08:27.102Z'), registro });
    expect(v.ok).toBe(false);
    expect(v.motivo).toMatch(/todavia no lo vio/);
  });
  it('PASA: Fak contesto despues de verlo armado', () => {
    const reg = [{ entry_id: 'E2', clave: claveAsunto('RE: Tiempos forrado ductos Patagonia - videos del 07/10'), armado_epoch: s('2026-10-08T12:25:14.950Z') }];
    const f = transcript([encolado('2026-10-08T12:08:27.102Z', MANDALO), encolado('2026-10-08T12:26:56.751Z', OK_DESPUES)]);
    const v = veredicto({ pedido: pedidoDeEnvio('python scripts/_mailEnviar.py --id E2 --enviar'), ultimoFakMs: ultimoMensajeDeFak(f), registro: reg });
    expect(v.ok).toBe(true);
  });
  it('BLOQUEA un borrador que no armo ninguno de los tres scripts (como el responder_paulo.py suelto de ese dia)', () => {
    const v = veredicto({ pedido: pedidoDeEnvio('python scripts/_mailEnviar.py --id OTRO --forzar --enviar'), ultimoFakMs: Date.parse('2026-10-08T13:14:03Z'), registro });
    expect(v.ok).toBe(false);
  });
  it('BLOQUEA un registro viejo sin la hora real de armado (guardado_ts de Outlook esta 3 h corrido)', () => {
    const viejo = [{ entry_id: 'E3', clave: ASUNTO, guardado_ts: s('2026-10-08T09:25:31.231Z') }];
    const v = veredicto({ pedido, ultimoFakMs: Date.parse('2026-10-08T12:26:56Z'), registro: viejo });
    expect(v.ok).toBe(false);
  });
  it('BLOQUEA si no se pudo leer ningun mensaje de Fak', () => {
    expect(veredicto({ pedido, ultimoFakMs: 0, registro }).ok).toBe(false);
  });
  it('con varios borradores del mismo asunto manda el mas nuevo', () => {
    const reg = [...registro, { entry_id: 'E9', clave: ASUNTO, armado_epoch: s('2026-10-08T12:30:00Z') }];
    expect(veredicto({ pedido, ultimoFakMs: Date.parse('2026-10-08T12:27:00Z'), registro: reg }).ok).toBe(false);
  });
});

// 24/10/2026: el primer mensaje real de Fak (su prompt) se lee del PRINCIPIO del transcript, con un tope de bytes, para el
// guardian 6g (coordinadorGuard.mensajesDeFakDeLaSesion): la cola de colaBytes lo pierde en una sesion larga.
describe('primerMensajeDeFak: el prompt de la sesion, leyendo solo la cabeza del transcript', () => {
  const linea = (texto, ts) => JSON.stringify({ type: 'user', sessionId: 's1', timestamp: ts, message: { role: 'user', content: texto } });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'primer-fak-'));
  const f = path.join(tmp, 'tr.jsonl');
  const L1 = linea('arranca la tanda del viernes y segui hasta las ocho de la noche', '2026-10-23T16:01:00.000Z');
  const L2 = linea('otro mensaje, mas tarde', '2026-10-23T17:01:00.000Z');
  const L3 = linea('y el ultimo', '2026-10-23T18:01:00.000Z');
  fs.writeFileSync(f, `${L1}\n${L2}\n${L3}\n`);

  it('sin tope lee todo y devuelve el primero; con la cola (colaBytes) el primero no esta', () => {
    expect(primerMensajeDeFak(f).texto).toMatch(/^arranca la tanda/);
    const cola = mensajesDeFak(f, { colaBytes: L3.length + 1 });
    expect(cola.map((m) => m.texto)).toEqual(['y el ultimo']);
  });
  it('con un tope que corta la segunda linea, la cortada se descarta sola y el primero vuelve entero', () => {
    const p = primerMensajeDeFak(f, { cabezaBytes: L1.length + 1 + Math.floor(L2.length / 2) });
    expect(p.texto).toMatch(/^arranca la tanda/);
    expect(p.ts).toBe(Date.parse('2026-10-23T16:01:00.000Z'));
  });
  it('un tope mas chico que la primera linea, o un archivo que no existe: null (nadie inventa un prompt)', () => {
    expect(primerMensajeDeFak(f, { cabezaBytes: 20 })).toBe(null);
    expect(primerMensajeDeFak(path.join(tmp, 'no-existe.jsonl'))).toBe(null);
  });
  it('el primero no cuenta si es un resultado de herramienta o un aviso de la app', () => {
    const g = path.join(tmp, 'tr2.jsonl');
    const aviso = JSON.stringify({ type: 'user', sessionId: 's1', timestamp: '2026-10-23T16:00:00.000Z', message: { role: 'user', content: '<task-notification>x</task-notification>' } });
    fs.writeFileSync(g, `${aviso}\n${L1}\n`);
    expect(primerMensajeDeFak(g).texto).toMatch(/^arranca la tanda/);
  });
});

// cierre-guard con TEXTO DE MAQUINA (23/10/2026, PUNTOS_DEBILES_23-10 §2).
// El chequeo 1 (pide permiso) buscaba «cuando (me )?digas» en la cola del mensaje sin distinguir una cita: el
// 23/10 a las 14:49 (registro 749f61db) el cierre decia «Que cuando digas «vamos a mejorar X» lo haga solo» —citaba
// un pedido de Fak, no esperaba un permiso— y el control freno el turno. El texto del fixture es TEXTUAL de ese
// mensaje. Los dos casos que dieron origen al patron (cierreGuard.test.mjs) tienen que seguir frenando.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluarPermiso, relevarTranscript, CANON } from '../../scripts/_lib/cierreGuard.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RENGLONES = fs.readFileSync(path.join(AQUI, 'fixtures', 'registro_749f61db_23-10.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const CIERRE_1449 = RENGLONES.find((o) => o.type === 'assistant' && o.timestamp === '2026-10-23T14:49:26.874Z').message.content.map((b) => b.text).join('\n');

describe('cierre-guard · «cuando digas» seguido de una cita no es un pedido de permiso (23/10/2026)', () => {
  it('ROJO antes: el cierre real de las 14:49 citaba el pedido de Fak y ahora pasa el chequeo 1', () => {
    expect(CIERRE_1449).toContain('Que cuando digas «vamos a mejorar X» lo haga solo');
    expect(evaluarPermiso(CIERRE_1449)).toEqual({ bloquea: false });
    // las tres comillas que corta el patron: « " “
    for (const t of ['Quedó anotado tu pedido: que cuando digas «vamos a mejorar X» lo haga solo.', 'Queda tu regla: cuando me digas "mandalo" es el OK del mail.', 'Lo anoté así: cuando digas “dale” con la placa libre, se imprime.']) {
      expect(evaluarPermiso(t).bloquea, t).toBe(false);
    }
  });

  it('VERDE que sigue: los casos que dieron origen al patron frenan, tambien con una cita en otra parte del mensaje', () => {
    for (const t of ['Ese lo hago cuando digas.', 'Lo cierro cuando me digas.', 'Lo de «Propongo» ya quedó. El resto lo hago cuando digas.', `${CIERRE_1449}\n\nEl informe final lo armo cuando me digas.`]) {
      const r = evaluarPermiso(t);
      expect(r.bloquea, t).toBe(true);
      expect(r.frase, t).toMatch(/cuando (me )?digas/i);
    }
    expect(CANON.permiso.find((p) => /^cuando/.test(p.re)).re).toBe('cuando (me )?digas\\b(?!\\s*[«"“])');
  });

  it('VERDE (ya pasaba, queda como guardia): el informe de un subagente en cola no es el ultimo mensaje de Fak para el relevador', async () => {
    const informes = RENGLONES.filter((o) => o.type === 'queue-operation').map((o) => JSON.stringify(o));
    const f = path.join(os.tmpdir(), `cg-informes-${process.pid}-${Date.now()}.jsonl`);
    fs.writeFileSync(f, [
      JSON.stringify({ type: 'user', timestamp: '2026-10-23T14:20:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'dale segui con la investigacion de los frenos' } }),
      ...informes,
    ].join('\n') + '\n');
    try {
      const r = await relevarTranscript(f);
      expect(r.ultimoMensajeFak).toBe('dale segui con la investigacion de los frenos');
    } finally { fs.unlinkSync(f); }
  });
});

// GATE del cableado de Stop (cola P10, plan §6.4): cierre-guard y hora-guard exponen correrStop(payload) -> {rc, stderr}
// sin leer stdin ni salir del proceso, y en el segundo Stop del mismo turno (stop_hook_active) las dos dejan pasar sin
// tirar. Mientras este archivo este rojo, stop-hooks.sh NO se cablea. Aparte de stopHooks.test.mjs por el mismo motivo
// que promptHooks.gate.test.mjs.
import { describe, expect, it } from 'vitest';
import { cargarPiezas } from '../../scripts/_lib/hookComun.mjs';
import { PIEZAS_REALES, correr } from '../../scripts/_lib/stopHooks.mjs';

describe('GATE stopHooks: las piezas reales', () => {
  it('cierre-guard y hora-guard exponen correrStop (si falla, al modulo nombrado le falta ese export)', async () => {
    const avisos = [];
    const piezas = await cargarPiezas(PIEZAS_REALES, { avisar: (m) => avisos.push(m) });
    expect(avisos).toEqual([]);
    expect(piezas.map((p) => p.nombre)).toEqual(['cierre-guard', 'hora-guard']);
  });
  it('segundo Stop del mismo turno: las dos corren, ninguna tira, rc 0 y sin mensaje', async () => {
    const piezas = await cargarPiezas(PIEZAS_REALES, { avisar: () => {} });
    const log = [];
    const r = await correr({ session_id: 'gate-stop-hooks', stop_hook_active: true, last_assistant_message: 'Listo.' }, piezas, { registrar: (o) => log.push(o) });
    expect(log).toEqual([]);
    expect(r).toEqual({ rc: 0, stderr: '' });
  }, 30000);
});

// correrStop de cierreGuard y de horaGuard: el contrato que usan cierre-guard.sh (por el CLI) y el Stop fusionado
// (stopHooks.mjs, cola P10). Lo que faltaba probar desde el commit C0 de P9: «el medidor no carga» (hooksTiempos.mjs
// roto o ausente) no puede dejar al cierre sin decidir.
import { describe, expect, it } from 'vitest';
import { correrStop } from '../../scripts/_lib/cierreGuard.mjs';
import { correrStop as correrStopHora, atenderPrompt, atender } from '../../scripts/_lib/horaGuard.mjs';

const FRENA = async () => ({ ok: false, titulo: 'TITULO DEL FRENO', detalle: 'detalle del freno' });
const PASA = async () => ({ ok: true });

describe('cierreGuard.correrStop', () => {
  it('ROJO: una decision que frena sale como rc 2 con el titulo y el detalle, uno por renglon', async () => {
    expect(await correrStop({ session_id: 's' }, { decidirFn: FRENA, importarMedidor: async () => ({}) })).toEqual({ rc: 2, stderr: 'TITULO DEL FRENO\ndetalle del freno' });
  });

  it('VERDE: una decision que deja pasar sale como rc 0 sin texto', async () => {
    expect(await correrStop({ session_id: 's' }, { decidirFn: PASA, importarMedidor: async () => ({}) })).toEqual({ rc: 0, stderr: '' });
  });

  it('el medidor no carga (el import tira): se decide igual, sin medir', async () => {
    const roto = async () => { throw new Error('hooksTiempos.mjs roto'); };
    expect(await correrStop({ session_id: 's' }, { decidirFn: FRENA, importarMedidor: roto })).toEqual({ rc: 2, stderr: 'TITULO DEL FRENO\ndetalle del freno' });
    expect(await correrStop({ session_id: 's' }, { decidirFn: PASA, importarMedidor: roto })).toEqual({ rc: 0, stderr: '' });
  });

  it('el medidor carga pero no trae correrMedido (una version vieja): se decide igual', async () => {
    expect(await correrStop({ session_id: 's' }, { decidirFn: FRENA, importarMedidor: async () => ({ otraCosa: 1 }) })).toMatchObject({ rc: 2 });
  });

  it('con el medidor, la decision pasa por el y llega igual', async () => {
    const llamadas = [];
    const medidor = { correrMedido: async ({ decidir, payload }) => { llamadas.push(payload.session_id); return decidir(payload); } };
    expect(await correrStop({ session_id: 'medida' }, { decidirFn: FRENA, importarMedidor: async () => medidor })).toMatchObject({ rc: 2 });
    expect(llamadas).toEqual(['medida']);
  });

  it('si la decision tira, correrStop tira (el CLI lo vuelve exit 0 y el Stop fusionado lo anota)', async () => {
    const tira = async () => { throw new Error('boom'); };
    await expect(correrStop({}, { decidirFn: tira, importarMedidor: async () => ({}) })).rejects.toThrow('boom');
  });

  it('segundo Stop del mismo turno (stop_hook_active): la decision real deja pasar', async () => {
    expect(await correrStop({ session_id: 'gate', stop_hook_active: true, last_assistant_message: 'Listo.' })).toEqual({ rc: 0, stderr: '' });
  }, 30000);
});

describe('horaGuard: los nombres del contrato', () => {
  it('correrStop: sin datos, un agente o el segundo Stop dejan pasar; nunca tira', () => {
    expect(correrStopHora(null)).toEqual({ rc: 0, stderr: '' });
    expect(correrStopHora({ agent_id: 'a1' })).toEqual({ rc: 0, stderr: '' });
    expect(correrStopHora('no es un objeto')).toEqual({ rc: 0, stderr: '' });
  });

  it('atenderPrompt es atender con SOLO el pedido', () => {
    const inocente = { hook_event_name: 'UserPromptSubmit', session_id: 'x', prompt: 'hola' };
    expect(atenderPrompt(inocente)).toEqual(atender(inocente));
    expect(atenderPrompt({ prompt: 'laburá hasta las 8' })).toBeNull();   // sin el nombre del evento no es un mensaje de Fak
  });
});

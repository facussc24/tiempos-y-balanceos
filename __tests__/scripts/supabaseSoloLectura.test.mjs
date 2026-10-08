// @vitest-environment node
/**
 * Tests de scripts/_lib/supabaseSoloLectura.mjs — el candado 2 de la noche hecho codigo.
 *
 * El usuario de .env.local PUEDE escribir (RLS `FOR ALL TO authenticated`) y los hooks de Claude Code
 * no corren para el `node` del Programador de tareas: el unico que garantiza "solo lectura" es este
 * envoltorio. Se prueba en las dos direcciones: leer pasa, cualquier escritura tira. Y una lista
 * vacia es "no pude leer", nunca "no hay AMFE" (los backups vacios de julio 2026).
 */
import { describe, it, expect } from 'vitest';
import { soloLectura, leerAmfesVivos } from '../../scripts/_lib/supabaseSoloLectura.mjs';

/** Un cliente con la forma del de Supabase que anota lo que se le pide. */
function clienteFalso(filas, { error = null } = {}) {
  const llamadas = [];
  const tabla = (t) => {
    const anotar = (m) => (...args) => { llamadas.push([m, t, ...args]); return Promise.resolve({ data: null, error: null }); };
    return {
      select: (...args) => { llamadas.push(['select', t, ...args]); return Promise.resolve({ data: filas, error }); },
      insert: anotar('insert'), update: anotar('update'), upsert: anotar('upsert'), delete: anotar('delete'),
    };
  };
  return { from: tabla, rpc: (...a) => { llamadas.push(['rpc', ...a]); return Promise.resolve({}); }, llamadas };
}

const ESCRITURAS = ['insert', 'update', 'upsert', 'delete'];

describe('supabaseSoloLectura · candado 2', () => {
  it('VERDE: select pasa al cliente de verdad', async () => {
    const real = clienteFalso([{ id: 1 }]);
    const { data } = await soloLectura(real).from('amfe_documents').select('id');
    expect(data).toEqual([{ id: 1 }]);
    expect(real.llamadas).toEqual([['select', 'amfe_documents', 'id']]);
  });

  it.each(ESCRITURAS)('ROJO: %s sobre una tabla tira y no llega al cliente', (m) => {
    const real = clienteFalso([]);
    const sb = soloLectura(real);
    expect(() => sb.from('amfe_documents')[m]).toThrow(/SOLO LECTURA/);
    expect(real.llamadas).toEqual([]);
  });

  it('ROJO: rpc y las escrituras a nivel cliente tiran', () => {
    const real = clienteFalso([]);
    const sb = soloLectura(real);
    expect(() => sb.rpc).toThrow(/SOLO LECTURA/);
    for (const m of ESCRITURAS) expect(() => sb[m]).toThrow(/SOLO LECTURA/);
    expect(real.llamadas).toEqual([]);
  });

  it('no se le puede agregar un metodo despues (esta congelado)', () => {
    const sb = soloLectura(clienteFalso([]));
    expect(Object.isFrozen(sb)).toBe(true);
    expect(Object.isFrozen(sb.from('x'))).toBe(true);
    expect(sb.soloLectura).toBe(true);
  });
});

describe('supabaseSoloLectura · leerAmfesVivos', () => {
  const veintiuno = Array.from({ length: 21 }, (_, i) => ({ id: `id${i}`, amfe_number: `AMFE-${i}`, updated_at: '2026-10-01', data: '{}' }));

  it('ROJO: 0 filas tira (con RLS, nada es "no pude leer")', async () => {
    await expect(leerAmfesVivos(soloLectura(clienteFalso([])))).rejects.toThrow(/0 fila/);
    await expect(leerAmfesVivos(soloLectura(clienteFalso(null)))).rejects.toThrow(/0 fila/);
  });

  it('ROJO: menos que el minimo pedido tambien tira', async () => {
    await expect(leerAmfesVivos(soloLectura(clienteFalso(veintiuno.slice(0, 3))), { minimo: 20 })).rejects.toThrow(/al menos 20/);
  });

  it('ROJO: el error de Supabase sube con su mensaje', async () => {
    await expect(leerAmfesVivos(soloLectura(clienteFalso(null, { error: { message: 'JWT expired' } })))).rejects.toThrow(/JWT expired/);
  });

  it('VERDE: con los 21 de hoy devuelve los 21', async () => {
    const filas = await leerAmfesVivos(soloLectura(clienteFalso(veintiuno)), { minimo: 1 });
    expect(filas).toHaveLength(21);
  });
});

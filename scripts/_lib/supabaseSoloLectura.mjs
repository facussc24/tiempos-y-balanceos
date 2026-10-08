/**
 * supabaseSoloLectura.mjs — un cliente de Supabase que SOLO puede leer.
 *
 * POR QUE EXISTE (08/10/2026). Los scripts nocturnos (pre-auditoria de AMFE con la API de
 * Anthropic) corren solos, sin nadie que confirme nada. El usuario con el que se loguea
 * `connectSupabase()` puede escribir (la politica RLS de la app es `FOR ALL TO authenticated`), y
 * los hooks de Claude Code no corren para un `node` que lanza el Programador de tareas. Entonces
 * "solo lectura" no lo garantiza ni la base ni un hook: lo garantiza este envoltorio, que expone
 * `from(tabla).select(...)` y nada mas. Un `update`, `insert`, `upsert`, `delete` o `rpc` no
 * existen como metodo: tocarlos tira.
 *
 * Es el candado 2 ("solo lectura sobre bases vivas") hecho codigo. Lo complementa el test
 * `__tests__/scripts/candadosNocturno.test.mjs`, que barre los scripts nocturnos para que no
 * importen nada que escriba (las funciones save* de amfeIo y companeros).
 *
 * Uso:
 *   import { conectarSoloLectura } from './_lib/supabaseSoloLectura.mjs';
 *   const sb = await conectarSoloLectura();
 *   const { data, error } = await sb.from('amfe_documents').select('id, amfe_number, updated_at, data');
 */
import { connectSupabase } from './amfeIo.mjs';

const ESCRITURAS = ['insert', 'update', 'upsert', 'delete', 'rpc'];

/**
 * Envuelve un cliente real. Solo deja `from(tabla).select(...)`. Cualquier intento de escritura
 * tira un Error que dice que esto es solo lectura (asi se ve en el log de la noche).
 */
export function soloLectura(sb) {
  const negar = (que) => () => {
    throw new Error(`SOLO LECTURA: ${que} no esta permitido en el cliente nocturno (candado 2). Un script que necesite escribir no corre de noche.`);
  };
  const envueltoTabla = (tabla) => {
    const q = sb.from(tabla);
    const out = { select: (...args) => q.select(...args) };
    for (const m of ESCRITURAS) Object.defineProperty(out, m, { get: negar(`${m}() sobre ${tabla}`) });
    return Object.freeze(out);
  };
  const cliente = { from: envueltoTabla, soloLectura: true };
  for (const m of ESCRITURAS) Object.defineProperty(cliente, m, { get: negar(`${m}()`) });
  return Object.freeze(cliente);
}

/** Login normal (con .env.local) y despues el envoltorio. */
export async function conectarSoloLectura() {
  return soloLectura(await connectSupabase());
}

/**
 * Lee todos los AMFE vivos con lo que necesita la noche. Falla FUERTE si vuelven 0 filas: con
 * RLS, "nada" casi siempre es "no pude leer", no "no hay AMFE" (incidente de los backups vacios,
 * julio 2026). `minimo` es la cantidad por debajo de la cual tambien se desconfia (hoy hay 21).
 */
export async function leerAmfesVivos(sb, { minimo = 1 } = {}) {
  const { data, error } = await sb.from('amfe_documents')
    .select('id, amfe_number, project_name, status, revision_level, updated_at, operation_count, cause_count, data');
  if (error) throw new Error(`no pude leer amfe_documents: ${error.message}`);
  const filas = Array.isArray(data) ? data : [];
  if (filas.length < minimo) {
    throw new Error(`amfe_documents devolvio ${filas.length} fila(s) y se esperaban al menos ${minimo}: con RLS, una lista corta es "no pude leer", no "no hay". No se sigue.`);
  }
  return filas;
}

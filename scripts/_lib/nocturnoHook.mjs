/**
 * nocturnoHook.mjs — un renglon al arrancar la sesion si la ultima noche de Claude NO CORRIO, no arranco o fallo
 * (viernes 23/10/2026, punto debil 6b: el 23/10 a las 06:30 nocturno.json quedo en «no arranco: presupuesto del ciclo en
 * rojo» y ninguna sesion lo dijo; antes de eso, una noche que no corria no dejaba nada visible salvo la edad del archivo).
 *
 * Lo llama .claude/hooks/session-start-context.sh al arrancar (no al compactar). Solo LEE .claude/state/nocturno.json
 * (BARACK_NOCTURNO_ESTADO lo cambia: lo usan los tests) y arma la linea con lineaNoche() de ./nocturno.mjs (pura).
 * Nada si la noche corrio bien: el detalle lo da `node scripts/_nocturno.mjs --estado`. Sale SIEMPRE con 0: un hook de
 * contexto no frena nada. Es liviano a proposito (no importa _nocturno.mjs, que carga la API y los mails).
 *
 *   node scripts/_lib/nocturnoHook.mjs --hook
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineaNoche } from './nocturno.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
export const RUTA_RELATIVA = '.claude/state/nocturno.json';

export function rutaEstado(env = process.env) {
  return env.BARACK_NOCTURNO_ESTADO || path.join(RAIZ, '.claude', 'state', 'nocturno.json');
}

/** El estado leido, null si no existe, o { roto: <motivo> } si el archivo esta pero no es JSON. */
export function leerEstado(ruta) {
  let texto;
  try {
    texto = fs.readFileSync(ruta, 'utf8');
  } catch (e) {
    if (e?.code === 'ENOENT') return null;
    return { roto: e?.message ?? String(e) };
  }
  try {
    return JSON.parse(texto);
  } catch (e) {
    return { roto: `JSON roto: ${e?.message ?? e}` };
  }
}

/** La linea para el hook ('' si no hay nada que decir). */
export function lineaHook({ ruta = rutaEstado(), ahora = Date.now() } = {}) {
  const e = leerEstado(ruta);
  if (e && e.roto) return `[NOCHE] ${RUTA_RELATIVA} no se puede leer (${e.roto}): la ultima noche dejo el estado roto. Ver: node scripts/_nocturno.mjs --estado`;
  return lineaNoche(e, { ahora, ruta: RUTA_RELATIVA });
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  if (process.argv.includes('--hook')) {
    try {
      const l = lineaHook();
      if (l) console.log(l);
    } catch {
      // un hook de contexto no frena: si algo falla, no se dice nada (el detalle lo da --estado)
    }
  } else {
    console.log('uso: node scripts/_lib/nocturnoHook.mjs --hook');
  }
  process.exit(0);
}

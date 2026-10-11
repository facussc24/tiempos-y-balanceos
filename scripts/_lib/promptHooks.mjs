/**
 * promptHooks.mjs — los cuatro hooks de UserPromptSubmit en UN node (cola P10, plan §2: de 8 procesos a 2 por mensaje;
 * R6: 2.800 a 3.786 ms cada uno, 62 cancelados en el mes).
 *
 * Lee el pedido una vez y corre en orden las piezas de siempre: caracteristicas especiales, correccion-guard,
 * explicar-prompt, hora-prompt. Cada pieza devuelve el texto de su additionalContext ('' = nada) y aca se juntan en un
 * solo JSON, en ese orden, separados por una linea en blanco. El texto de cada una es EL MISMO que daba suelta (no se
 * agrega ni se saca una marca): asi los `--espera` de _probarMejora.mjs lo siguen encontrando. Nunca bloquea: exit 0
 * siempre. Una pieza que tira no tumba a las otras (como cuando eran procesos aparte); avisa por stderr.
 * Contrato de pieza: `atender(payload) -> texto | {additionalContext} | {hookSpecificOutput:{additionalContext}} | JSON`.
 * El programa se arranca con `--correr`, NO con `--hook`: `--hook` es la bandera con la que cada pieza vieja decide
 * correr como programa, y aca esas piezas se IMPORTAN (si vieran `--hook` en argv, leerian un stdin ya consumido).
 * Tests: promptHooks.test.mjs (dobles), promptHooks.gate.test.mjs (las piezas reales cargan y no escriben solas),
 * promptHooks.igualdad.test.mjs (20 mensajes reales: fusionado = cuatro sueltos).
 *
 *   printf '%s' "$JSON" | node scripts/_lib/promptHooks.mjs --correr   # exit 0 siempre
 */
import { cargarPiezas, esPrograma, leerStdin, parsearPayload } from './hookComun.mjs';

export const EVENTO = 'UserPromptSubmit';
export const MARCA = '[PROMPT-HOOKS]';
export const SEPARADOR = '\n\n';

/** Las piezas reales, en el orden en que corrian en settings.json. `exportacion`: la funcion del contrato en cada modulo. */
export const PIEZAS_REALES = [
  { nombre: 'caracteristicas-especiales-prompt', modulo: './caracteristicasEspecialesPrompt.mjs', exportacion: 'atender' },
  { nombre: 'correccion-guard', modulo: './correccionGuard.mjs', exportacion: 'atender' },
  { nombre: 'explicar-prompt', modulo: './explicarGuard.mjs', exportacion: 'atender' },
  { nombre: 'hora-prompt', modulo: './horaGuard.mjs', exportacion: 'atenderPrompt' },
];

/** Lo que devuelve una pieza, en texto plano. Acepta las formas en que un hook ya habla: texto, JSON de hook, objeto. */
export function textoDe(r) {
  if (r == null || r === false) return '';
  if (typeof r === 'string') {
    const s = r.trim();
    if (s.startsWith('{')) { try { return textoDe(JSON.parse(s)); } catch { /* era texto que arranca con llave */ } }
    return s;
  }
  if (typeof r === 'object') return String(r.hookSpecificOutput?.additionalContext ?? r.additionalContext ?? '').trim();
  return '';
}

/** Corre las piezas en orden sobre el MISMO payload y arma la salida del hook (null = nada que inyectar). */
export async function correr(payload, piezas, { avisar = (m) => process.stderr.write(m) } = {}) {
  const partes = [];
  for (const p of piezas) {
    try {
      const t = textoDe(await p.fn(payload));
      if (t) partes.push(t);
    } catch (e) {
      // igual que cuando eran procesos sueltos: la que falla no tumba a las demas, pero queda dicho
      avisar(`${MARCA} ${p.nombre} fallo: ${String(e?.message || e).slice(0, 120)}; sigue sin ella.\n`);
    }
  }
  return partes.length ? { hookSpecificOutput: { hookEventName: EVENTO, additionalContext: partes.join(SEPARADOR) } } : null;
}

if (esPrograma(import.meta.url) && process.argv.includes('--correr')) {
  const payload = parsearPayload(await leerStdin());
  const out = await correr(payload, await cargarPiezas(PIEZAS_REALES, { marca: MARCA }));
  // en Windows el pipe de stdout es asincronico: salir recien cuando se escribio (si no, la app recibe un JSON cortado)
  if (out) process.stdout.write(JSON.stringify(out), () => process.exit(0)); else process.exit(0);
}

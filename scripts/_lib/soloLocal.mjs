/**
 * soloLocal.mjs — que piezas de la configuracion de Claude NO viajan por la nube de Ingenieria. Desde el 23/10/2026: NINGUNA.
 *
 * Fak, 23/10/2026 15:30 (revierte su regla del 20/10): *"me gustaría volver a subir la inteligencia a la nube para
 * sincronizar entre mis notebooks... así no pierdo tiempo con esa mierda... github, nube, así laburo más rápido; el otro
 * día te había dicho que no pero mejor sí, ya fue, skills todo; necesito que mis notebooks siempre estén sincronizadas"*.
 * Desde ahi las skills, reglas, agentes, comandos, hooks, planes y el settings vuelven a `claude-config\` de
 * `ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\` (nunca a la nube personal `OneDrive - BARACK ARGENTINA SRL\`),
 * y cada notebook las baja con `node scripts/_nube.mjs --bajar --aplicar` (o la tarea `--sincronizar` cada 2 h).
 * Historia: del 20 al 23/10/2026 estuvieron solo en las PC (*"quiero tenerlas en local"*) y viajaban por pendrive
 * (`scripts/_pendriveAsistente.mjs`, que sigue andando para una PC sin la biblioteca sincronizada).
 *
 * Lo que NO cambia: los armadores de asistentes para OTRAS personas (`tools/claude-area/persona/armar.mjs`,
 * `armar_herramientas.mjs`, `tools/claude-area/mejoras/publicar.mjs`) siguen sin escribir en una nube (`frenarSiEsNube`):
 * lo de Fak fue sobre sus notebooks, no sobre publicar sus skills para los compañeros.
 */

/** Piezas de `_nube.mjs` que no viajan por la nube. Vacia desde el 23/10/2026 (Fak: "skills todo"). */
export const PIEZAS_SOLO_LOCAL = new Set();

/** Archivos sueltos de `_nube.mjs` que no viajan. Vacia desde el 23/10/2026: el settings vuelve a subir y bajar. */
export const SUELTOS_SOLO_LOCAL = new Set();

/** Subcarpeta de la nube donde va la configuracion (skills, reglas, agentes, comandos, hooks, planes, settings). */
export const CARPETA_CONFIG_EN_NUBE = 'claude-config';

/**
 * ¿La ruta cae adentro de una nube de la empresa? Las dos carpetas de OneDrive de Barack llevan el nombre de la
 * organizacion: `BARACK ARGENTINA SRL\` (la biblioteca de Ingenieria) y `OneDrive - BARACK ARGENTINA SRL\` (la personal).
 */
export function esRutaDeNube(ruta) {
    return /[\\/][^\\/]*barack argentina srl[\\/]/i.test(`${String(ruta || '').replace(/[\\/]+$/, '')}\\`);
}

/** Frena (tira) si `ruta` es de una nube. `que` dice que se queria escribir, para el mensaje. */
export function frenarSiEsNube(ruta, que) {
    if (!esRutaDeNube(ruta)) return;
    throw new Error(`${que} no se escribe en la nube (regla vigente del 23/10/2026: la configuracion va a la nube de Ingenieria por _nube.mjs, nunca escrita a mano en la nube; `
        + `a otra PC van por pendrive). Destino rechazado: ${ruta}. Elegir una carpeta local (ej. C:\\Dev\\ASISTENTE-LOCAL\\...). No se escribio nada.`);
}

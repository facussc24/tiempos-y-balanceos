/**
 * soloLocal.mjs — las skills, reglas, agentes, hooks y la configuracion de Claude viven SOLO en las PC de Fak.
 *
 * Fak, 20/10/2026: *"lo que no quiero es que tengan mis skills... quiero tenerlas en local"*, *"si quiero usar la nube
 * pero me molesta que mi codigo este subido ahi"*, *"no me molesta tener que pasarle a CATA cada tanto por el pendrive"*.
 * La memoria, los registros de las charlas y los mails siguen yendo a la nube; esto no.
 *
 * Lo usan `scripts/_nube.mjs` (no sube ni sincroniza estas piezas) y los armadores de asistentes para otras personas
 * (`tools/claude-area/persona/armar.mjs`, `tools/claude-area/mejoras/publicar.mjs`), que no escriben en una nube.
 * Lo que habia en la nube se movio el 20/10/2026 a `C:\Dev\ASISTENTE-LOCAL\` (copia verificada antes de sacarlo).
 */

/** Piezas de `_nube.mjs` que ya no viajan por la nube. */
export const PIEZAS_SOLO_LOCAL = new Set(['reglas', 'skills', 'agentes', 'comandos', 'hooks', 'planes']);

/** Archivos sueltos de `_nube.mjs` que ya no viajan (el settings trae los hooks y la configuracion). */
export const SUELTOS_SOLO_LOCAL = new Set(['settings.json']);

/** Subcarpeta de la nube donde estaba la configuracion: si reaparece, la subio una PC con el programa viejo. */
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
    throw new Error(`${que} no se escribe en la nube (Fak, 20/10/2026: las skills y la configuracion viven solo en su PC; `
        + `a otra PC van por pendrive). Destino rechazado: ${ruta}. Elegir una carpeta local (ej. C:\\Dev\\ASISTENTE-LOCAL\\...). No se escribio nada.`);
}

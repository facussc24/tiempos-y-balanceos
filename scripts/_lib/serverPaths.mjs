/**
 * serverPaths.mjs — Rutas del arbol oficial de AMFEs en el servidor de Ingenieria (Y:)
 *
 * Carpeta 13 del SGC (I-AC-005.3). NO confundir con exportPathManager.ts de la app,
 * que apunta a OTRO arbol (Y:\INGENIERIA). Estas constantes son la unica fuente
 * de rutas para los scripts de inventario/oficializacion/reorganizacion.
 *
 * Convencion de archivo: el AMFE vigente vive en la raiz de la carpeta de producto;
 * las revisiones anteriores van a la subcarpeta OBSOLETO.
 */

export const RUTA_BASE_AMFE =
    'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)';

export const RUTA_LISTADO = `${RUTA_BASE_AMFE}\\1. LISTADO DE AMFES`;
export const ARCHIVO_LISTADO_MAESTRO = `${RUTA_LISTADO}\\Listado_Maestro_AMFE.xlsx`;

export const RUTA_PROCESO = `${RUTA_BASE_AMFE}\\AMFES DE PROCESO`;
export const RUTA_MAESTROS = `${RUTA_BASE_AMFE}\\AMFES MAESTROS`;

/** Subcarpeta donde se archivan revisiones viejas (existen variantes de nombre). */
export const CARPETA_OBSOLETO = 'OBSOLETO';

/** Carpeta historica sin organizar dentro de AMFES DE PROCESO. */
export const CARPETA_QUILOMBO = '1.ORGANIZAR';

// ─────────────────────────────────────────────────────────────────────────────
// Biblioteca de Ingenieria sincronizada (SharePoint) — NO es el servidor Y:
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Biblioteca del departamento, sincronizada localmente. NO es espacio personal: lo que se
 * deja aca lo ve quien tenga acceso al sitio, y el nombre de la carpeta dice NUNCA BORRAR.
 * Esta organizada POR TIPO DE DOCUMENTO (FICHAS DE EMBALAJE, 2. CONSUMO DE MATERIAL BOM,
 * 5. 3D, ULM GATE 2, DESVIOS...), con control documental via LISTADO MAESTRO I-IN-001.
 */
export const RUTA_BIBLIOTECA_INGENIERIA =
    'C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\INGENIERIA BARACK (NUNCA BORRAR)';

/**
 * La rama donde vive una carpeta POR TIPO DE DOCUMENTO: `FICHAS DE EMBALAJE`,
 * `2. CONSUMO DE MATERIAL BOM`, `5. 3D`, `ULM GATE 2`, `DESVIOS`, `FLUJOGRAMA`…
 * Esa es la casa definitiva de cada entregable: una tarea no esta cerrada hasta que el
 * archivo llego a la suya (regla `escritorio-tareas.md` §1).
 * La LISTA no se hardcodea — se lee del disco, porque el que manda es el arbol real.
 */
export const RUTA_BIBLIOTECA_GENERAL = `${RUTA_BIBLIOTECA_INGENIERIA}\\1- GENERAL`;

/** Archivo del RASTRO de las tareas cerradas (mails, capturas, borradores). Regla `escritorio-tareas.md`. */
export const RUTA_TAREAS_CERRADAS = `${RUTA_BIBLIOTECA_GENERAL}\\TAREAS CERRADAS`;

/** La cola de pendientes: una carpeta por tarea abierta. */
export const RUTA_ESCRITORIO = 'C:\\Users\\FacundoS-PC\\OneDrive - BARACK ARGENTINA SRL\\Desktop';


/** Nombres de carpeta que marcan contenido archivado/obsoleto (case-insensitive). */
const RE_OBSOLETO = /^(obsoletos?|old)$/i;

/** true si algun segmento del path relativo marca contenido obsoleto/archivado. */
export function esRutaObsoleta(relPath) {
    return relPath.split('\\').some(seg => RE_OBSOLETO.test(seg.trim()));
}

/** true si el path relativo cae dentro de la carpeta 1.ORGANIZAR. */
export function esRutaQuilombo(relPath) {
    return relPath.split('\\').some(seg => seg.trim() === CARPETA_QUILOMBO);
}

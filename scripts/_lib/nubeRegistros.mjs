/**
 * nubeRegistros.mjs — los registros de las charlas con Claude Code de esta PC
 * (~/.claude/projects/<carpeta>\*.jsonl) suben a la nube de Ingenieria con
 * `_nube.mjs --sincronizar`. Logica pura; se prueba con un robocopy de mentira en
 * `__tests__/scripts/nubeRegistros.test.mjs`.
 *
 * TODAS LAS CARPETAS, no solo las del repo (Fak, 15/10/2026: "la notebook de calidad esta subiendo
 * automaticamente el historial de chat?... si quiero"). Hasta ese dia subian solo las C--Dev-BarackMercosul*:
 * la notebook no habia subido ninguna charla, y en esta PC quedaban afuera 42 charlas abiertas sin carpeta
 * (C--Users-FacundoS-PC). Quedan afuera los temporales y las charlas de estudio (EXCLUIR_REGISTROS). El nombre de
 * cada archivo es el id de la sesion: dos PC no se pisan aunque compartan el nombre de la carpeta.
 *
 * POR QUE SUBEN (HOY-6, Fak 09/10/2026: "subilas a la nube... ¿se borran las viejas?")
 *  - Son la fuente de los informes de errores (R4 leyo desde el 01/09) y Claude Code los borra en la
 *    PC a los `cleanupPeriodDays` dias (30 si la clave no esta, segun su doc). Sin copia afuera el
 *    informe pierde el pasado.
 *  - SOLO SUBEN: no bajan (cada PC tiene sus charlas) y nunca se borran en la nube. Por eso no entran
 *    en `--subir`, que es espejo (/MIR): lo que la PC ya borro se borraria tambien alla.
 *  - `memory/` (adentro de la misma carpeta) no va por aca: ya es la pieza 'memoria' y esa si baja.
 */
import { readdirSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { esCarpeta } from './nubeRutas.mjs';

/**
 * Carpetas de proyecto que NO suben: un scratchpad temporal (C:\Users\<u>\AppData\Local\Temp[\...]) y las
 * charlas de estudio personal de Fak (Documents\estudio, D:\KIT-ESTUDIO-CLAUDE), que no son de Barack y la
 * carpeta de la nube la ve Ingenieria.
 */
export const EXCLUIR_REGISTROS = /-AppData-Local-Temp(-|$)|estudio/i;
/** Donde quedan en la nube: una subcarpeta por carpeta de proyecto. */
export const SUBCARPETA_REGISTROS = 'claude-registros';
/** Lo que pide la fila: los .jsonl del primer nivel, no las subcarpetas. */
export const PATRON_REGISTROS = '*.jsonl';
/** P42: con 30 (el defecto) quedan agujeros entre dos lecturas de R4. */
export const DIAS_MINIMOS_LIMPIEZA = 90;
export const DIAS_LIMPIEZA_POR_DEFECTO = 30;

/**
 * Carpetas de `projectsDir` cuyos registros suben.
 * @returns {Array<{nombre: string, local: string}>|null} null si no se pudo leer `projectsDir`: una lista
 *   vacia se leeria igual que "no hay charlas" (misma leccion que _backup.mjs). [] si se leyo y no hay.
 */
export function carpetasDeRegistros(projectsDir) {
    let nombres;
    try { nombres = readdirSync(projectsDir); } catch { return null; }
    return nombres
        .filter((n) => !EXCLUIR_REGISTROS.test(n))
        .map((n) => ({ nombre: n, local: join(projectsDir, n) }))
        .filter((c) => esCarpeta(c.local));
}

/**
 * Cuantos registros (.jsonl del primer nivel) hay en esas carpetas. Queda anotado por PC en `_ESTADO.json`
 * para comprobar desde la otra PC que esta subio sus charlas. Una carpeta que no se puede leer cuenta 0.
 */
export function contarRegistros(carpetas, leer = readdirSync) {
    let n = 0;
    for (const { local } of carpetas || []) {
        try { n += leer(local).filter((f) => f.toLowerCase().endsWith('.jsonl')).length; } catch { /* cuenta 0 */ }
    }
    return n;
}

/**
 * Una pierna PC -> nube por carpeta, con la direccion 'intercambiar' (la que no borra y deja ganar al mas
 * nuevo) y solo los .jsonl. `robocopy` y `mkdir` se inyectan para probarlo sin tocar disco.
 * @returns {{ resultados: Array<{nombre: string, archivos: number, err: string|null}>, archivos: number, fallos: number }}
 */
export function subirRegistros({ carpetas, nube, robocopy, aplicar, mkdir = mkdirSync }) {
    const resultados = [];
    for (const { nombre, local } of carpetas) {
        const destino = join(nube, SUBCARPETA_REGISTROS, nombre);
        // Sin --aplicar no se crea ni la carpeta: dry-run es dry-run (SEGURIDAD de _nube.mjs).
        if (aplicar) mkdir(destino, { recursive: true });
        const r = robocopy(local, destino, { direccion: 'intercambiar', listar: !aplicar, soloArchivo: PATRON_REGISTROS });
        resultados.push({ nombre, archivos: r.archivos, err: r.err || null });
    }
    return {
        resultados,
        archivos: resultados.reduce((s, r) => s + r.archivos, 0),
        fallos: resultados.filter((r) => r.err).length,
    };
}

/** `~/.claude/settings.json` parseado, o null si no se pudo leer (el aviso lo dice; no se asume 30 en silencio). */
export function leerSettings(ruta, leer = readFileSync) {
    try { return JSON.parse(leer(ruta, 'utf8')); } catch { return null; }
}

/**
 * Aviso si esta PC va a borrar los registros antes de los 90 dias; null si esta bien. Se mira en cada PC
 * porque settings.json no viaja con --sincronizar (trae rutas de la PC de origen).
 */
export function avisoLimpieza(settings, minimo = DIAS_MINIMOS_LIMPIEZA) {
    if (!settings || typeof settings !== 'object') {
        return `settings.json: no pude leerlo; sin "cleanupPeriodDays": ${minimo} Claude Code borra los registros a los ${DIAS_LIMPIEZA_POR_DEFECTO} dias`;
    }
    const dias = settings.cleanupPeriodDays;
    if (dias === undefined) return `settings.json: falta "cleanupPeriodDays" (Claude Code borra los registros a los ${DIAS_LIMPIEZA_POR_DEFECTO} dias): ponerlo en ${minimo}`;
    // `!(dias >= minimo)` y no `dias < minimo`: asi un NaN o un string tambien avisan.
    if (typeof dias !== 'number' || !(dias >= minimo)) return `settings.json: "cleanupPeriodDays" es ${JSON.stringify(dias)} y tiene que ser ${minimo} o mas (P42)`;
    return null;
}

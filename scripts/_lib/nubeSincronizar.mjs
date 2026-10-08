/**
 * nubeSincronizar.mjs — la logica pura de `_nube.mjs --sincronizar` (08/10/2026).
 *
 * POR QUE EXISTE. Hasta el 08/10 la nube tenia UNA fuente de verdad: la PC de Ingenieria subia
 * con espejo (/MIR) y la otra PC bajaba sin borrar. Desde que Fak trabaja tambien en la notebook
 * de Calidad (CATA), las dos PC escriben memorias y configuracion: un espejo desde cualquiera de
 * las dos borraria en la nube lo que agrego la otra. La regla pasa a ser:
 *
 *     gana el archivo mas nuevo, nada se borra, y lo que se pisa se guarda antes.
 *
 * Robocopy ya resuelve "gana el mas nuevo" (/E /XO en las dos piernas, `construirFlags` con
 * direccion 'intercambiar'). Lo que robocopy NO hace es avisar cuando pisa un archivo que ESTA PC
 * edito despues del ultimo sync y la otra PC tambien toco: eso es un conflicto real, y la version
 * local se guarda en `<nube>\_conflictos\<PC>\<fecha>\<pieza>\<ruta>` antes de que la nube la pise.
 *
 * Todo lo de aca es puro o trabaja sobre carpetas que se le pasan: los tests corren en temporales.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Carpetas que nunca se recorren (igual que el /XD de robocopy, mas .git). */
export const EXCLUIDAS = new Set(['node_modules', '__pycache__', '.git']);

/** Dos relojes de dos PC (y OneDrive) no coinciden al milisegundo: menos de esto es "igual". */
export const TOLERANCIA_MS = 2000;

/**
 * Recorre una carpeta y devuelve { 'ruta/relativa': { mtimeMs, size } }. Solo metadata: un
 * puntero de OneDrive (archivo "solo en la nube") no se baja por un stat.
 */
export function recorrer(dir) {
    const out = new Map();
    if (!fs.existsSync(dir)) return out;
    const pila = [''];
    while (pila.length) {
        const rel = pila.pop();
        const abs = rel ? path.join(dir, rel) : dir;
        let entradas;
        try { entradas = fs.readdirSync(abs, { withFileTypes: true }); } catch { continue; }
        for (const e of entradas) {
            if (EXCLUIDAS.has(e.name)) continue;
            const relHijo = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) { pila.push(relHijo); continue; }
            if (!e.isFile()) continue;
            try {
                const st = fs.statSync(path.join(abs, e.name));
                out.set(relHijo, { mtimeMs: st.mtimeMs, size: st.size });
            } catch { /* OneDrive puede negar el stat un instante */ }
        }
    }
    return out;
}

/**
 * Que haria el intercambio entre `local` y `nube` para una pieza.
 *
 * @param {object} o
 * @param {Map} o.local     salida de recorrer(carpeta local)
 * @param {Map} o.nube      salida de recorrer(carpeta en la nube)
 * @param {number} o.ultimoSync  epoch ms del ultimo sync de ESTA PC (0 si nunca)
 * @returns {{ bajan: string[], suben: string[], iguales: number, conflictos: string[] }}
 *   conflictos ⊂ bajan: la nube es mas nueva Y esta PC edito el archivo despues de su ultimo sync.
 */
export function planDeIntercambio({ local, nube, ultimoSync = 0 }) {
    const bajan = []; const suben = []; const conflictos = []; let iguales = 0;
    const rutas = new Set([...local.keys(), ...nube.keys()]);
    for (const rel of [...rutas].sort()) {
        const l = local.get(rel); const n = nube.get(rel);
        if (l && !n) { suben.push(rel); continue; }
        if (!l && n) { bajan.push(rel); continue; }
        const dif = n.mtimeMs - l.mtimeMs;
        if (Math.abs(dif) <= TOLERANCIA_MS) { iguales++; continue; }
        if (dif > 0) {
            bajan.push(rel);
            if (l.mtimeMs > ultimoSync + TOLERANCIA_MS) conflictos.push(rel);
        } else {
            suben.push(rel);
        }
    }
    return { bajan, suben, iguales, conflictos };
}

/** `AAAA-MM-DD_HHMM` local, para nombrar la carpeta de resguardo. */
export function selloFecha(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * Copia la version LOCAL de cada conflicto a `<nube>\_conflictos\<pc>\<sello>\<pieza>\<rel>` antes
 * de que la pierna de bajada la pise. Devuelve las rutas guardadas. Si una copia falla, se anota y
 * se sigue: perder el resguardo de un archivo no puede frenar el sync de los demas.
 */
export function resguardarConflictos({ localDir, nubeRaiz, pieza, conflictos, pc, sello = selloFecha() }) {
    const guardados = []; const fallos = [];
    if (!conflictos.length) return { guardados, fallos, carpeta: null };
    const carpeta = path.join(nubeRaiz, '_conflictos', pc, sello, pieza);
    for (const rel of conflictos) {
        const origen = path.join(localDir, rel);
        const destino = path.join(carpeta, rel);
        try {
            fs.mkdirSync(path.dirname(destino), { recursive: true });
            fs.copyFileSync(origen, destino);
            guardados.push(destino);
        } catch (e) {
            fallos.push(`${rel}: ${e.message}`);
        }
    }
    return { guardados, fallos, carpeta };
}

/**
 * Lee/actualiza el estado por PC de `_ESTADO.json` (se mantiene lo que ya habia: fecha, pc,
 * commitRepo del ultimo --subir siguen ahi para los que lo leen).
 */
export function estadoConSync(previo, { pc, ahora = new Date(), archivos = 0, conflictos = 0, commitRepo = '?' }) {
    const e = previo && typeof previo === 'object' ? { ...previo } : {};
    e.por_pc = { ...(e.por_pc || {}) };
    e.por_pc[pc] = {
        ultimoSync: ahora.toISOString(),
        modo: 'sincronizar',
        archivos,
        conflictos,
        commitRepo,
    };
    return e;
}

/** epoch ms del ultimo sync de esta PC segun `_ESTADO.json`; 0 si no hay. */
export function ultimoSyncDe(estado, pc) {
    const iso = estado?.por_pc?.[pc]?.ultimoSync;
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(t) ? t : 0;
}

/** Resumen de una pieza en una linea, para la consola. */
export function lineaPlan(clave, plan) {
    const partes = [];
    if (plan.bajan.length) partes.push(`bajan ${plan.bajan.length}`);
    if (plan.suben.length) partes.push(`suben ${plan.suben.length}`);
    if (plan.conflictos.length) partes.push(`CONFLICTOS ${plan.conflictos.length} (se guardan antes)`);
    if (!partes.length) partes.push('al dia');
    return `    ${clave.padEnd(11)} ${partes.join(' · ')}`;
}

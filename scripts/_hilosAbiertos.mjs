/**
 * _hilosAbiertos.mjs — los mails que una tarea abierta del Escritorio NO vio (08/10/2026).
 *
 * Fak, 08/10/2026: *"hoy hubo un problema: un consumo que Carlos ya habia pasado en un mail de el, me
 * habia enviado el consumo correcto en un segundo mail, y yo nunca lo vi; era una tarea que habia
 * quedado ahi pendiente y abierta... como esa puede haber otras, y nunca mas puede volver a pasar"*.
 *
 * Por cada tarea del Escritorio (a la vista y en `_EN ESPERA`) lee los .msg del primer nivel (son el
 * pedido: asunto, de, fecha), arma la clave del hilo y busca en el cache del buzon
 * (`.mail-cache/mails.jsonl`) los mails del mismo hilo POSTERIORES al .msg mas nuevo de la carpeta.
 *
 *   node scripts/_hilosAbiertos.mjs            el detalle
 *   node scripts/_hilosAbiertos.mjs --hook     lo que imprime el arranque de sesion (nada si no hay nada)
 *   node scripts/_hilosAbiertos.mjs --json
 *   ... --escritorio <carpeta>  --cache <mails.jsonl>  --estado <carpeta>   (para probar)
 *
 * Cada .msg se lee UNA vez: lo leido queda en `.claude/state/hilos-cache.json` por ruta, fecha y
 * tamaño (un .msg del Escritorio puede ser un puntero de OneDrive y leerlo baja megas). Solo lectura:
 * no toca el Escritorio ni el buzon. Si algo falla, no frena el arranque: imprime nada y sale 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerMsg } from './_leerMsg.mjs';
import { listar, esEnEspera, ESCRITORIO_DEFAULT } from './_escritorio.mjs';
import { leerMailsDesde, MAILS_JSONL } from './_lib/mailCache.mjs';
import { cruzarTareas, textoHook, textoDetalle, ultimaFechaMsg, fechaMs } from './_lib/hilosAbiertos.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
export const ESTADO_DEFAULT = path.join(RAIZ, '.claude', 'state');

function leerArgs(argv) {
    const a = { hook: false, json: false };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        if (k === '--hook') a.hook = true;
        else if (k === '--json') a.json = true;
        else if (k.startsWith('--') && i + 1 < argv.length) a[k.slice(2)] = argv[++i];
    }
    return a;
}

/** Cache de .msg leidos: { 'ruta|mtime|size': { asunto, de, fecha } }. */
function abrirCache(dirEstado) {
    const ruta = path.join(dirEstado, 'hilos-cache.json');
    let datos = {};
    try { datos = JSON.parse(fs.readFileSync(ruta, 'utf8')) || {}; } catch { datos = {}; }
    let sucio = false;
    return {
        leerMsgCacheado(rutaMsg, mtime, size) {
            const clave = `${rutaMsg}|${Math.round(mtime)}|${size}`;
            if (datos[clave]) return datos[clave];
            let v = null;
            try {
                const m = leerMsg(rutaMsg);
                v = { asunto: m.asunto ?? '', de: m.de ?? '', fecha: m.fecha ? new Date(m.fecha).toISOString() : '' };
            } catch { v = { asunto: '', de: '', fecha: '' }; }   // .msg roto o puntero: no define hilo
            datos[clave] = v; sucio = true;
            return v;
        },
        guardar() {
            if (!sucio) return;
            try {
                fs.mkdirSync(dirEstado, { recursive: true });
                // Se poda lo que ya no existe en el disco para que no crezca para siempre.
                const vivo = {};
                for (const [k, v] of Object.entries(datos)) { if (fs.existsSync(k.split('|')[0])) vivo[k] = v; }
                fs.writeFileSync(path.join(dirEstado, 'hilos-cache.json'), JSON.stringify(vivo), 'utf8');
            } catch { /* el cache es una comodidad, no un dato */ }
        },
    };
}

/** Las tareas del Escritorio con sus .msg del primer nivel: [{ nombre, enEspera, msgs }]. */
export function relevarTareas(escritorio, cache) {
    const tareas = [];
    const sumar = (entrada, enEspera) => {
        const msgs = [];
        const candidatos = entrada.dir ? listar(entrada.ruta) : [entrada];
        for (const e of candidatos) {
            if (e.dir || !e.nombre.toLowerCase().endsWith('.msg')) continue;
            let size = 0;
            try { size = fs.statSync(e.ruta).size; } catch { /* sigue */ }
            msgs.push(cache.leerMsgCacheado(e.ruta, e.mtime, size));
        }
        if (msgs.length) tareas.push({ nombre: entrada.nombre, enEspera, msgs });
    };
    for (const e of listar(escritorio)) {
        if (e.dir && esEnEspera(e.nombre)) {
            for (const t of listar(e.ruta)) sumar(t, true);
        } else {
            sumar(e, false);
        }
    }
    return tareas;
}

export async function correr({ escritorio = ESCRITORIO_DEFAULT, jsonl = MAILS_JSONL, estado = ESTADO_DEFAULT } = {}) {
    const cache = abrirCache(estado);
    const tareas = relevarTareas(escritorio, cache);
    cache.guardar();
    // Se lee el cache desde el .msg mas viejo que haya en las tareas (menos un dia de margen).
    let desde = Infinity;
    for (const t of tareas) { const u = ultimaFechaMsg(t.msgs); if (u && u < desde) desde = u; }
    if (!Number.isFinite(desde)) return { tareas: tareas.length, cruce: [] };
    const desdeISO = new Date(desde - 86400000).toISOString().slice(0, 10);
    const mails = await leerMailsDesde(desdeISO, jsonl);
    const cruce = cruzarTareas(tareas, mails);
    return { tareas: tareas.length, mails: mails.length, cruce };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    const a = leerArgs(process.argv.slice(2));
    try {
        const r = await correr({ escritorio: a.escritorio, jsonl: a.cache, estado: a.estado });
        if (a.json) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        else if (a.hook) { const t = textoHook(r.cruce); if (t) process.stdout.write(`${t}\n`); }
        else process.stdout.write(`${textoDetalle(r.cruce)}\n`);
        process.exit(0);
    } catch (e) {
        if (!a.hook) process.stderr.write(`hilos abiertos: ${e.message}\n`);
        process.exit(a.hook ? 0 : 1);
    }
}

export { fechaMs };

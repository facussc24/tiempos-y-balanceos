/**
 * _lib/lectorMails.mjs — lo comun de los lectores de la tanda 14 (indice de adjuntos 3D/DXF, Planner de Carlos y parte
 * de INCA): leer la copia local de mails, sacar los repetidos y escribir la salida sin que viaje una clave.
 *
 * QUE HACE Y QUE NO:
 *   - Lee SOLO `.mail-cache/mails.jsonl` (lo llena `_mails.py --sync`). No abre Outlook, no baja adjuntos, no escribe
 *     en el buzon ni en la nube.
 *   - Desde un worktree la copia no esta (es gitignoreada): se busca en el checkout principal, como hace
 *     `rutaMailsPorDefecto()` de `_automatizacionCandidatos.mjs`.
 *   - La salida va a `exports/` del checkout principal y esos nombres estan en `.gitignore`: el repo es publico y lo que
 *     dicen los mails no se commitea (`mailCache.mjs`).
 *   - Todo texto que sale de un mail pasa por `taparClaves()`: la clave de API de Pedro sigue en un mail suyo del 09/10.
 *
 * Los repetidos: el mismo mail aparece en «Bandeja de entrada», «Elementos eliminados», «Problemas de sincronizacion» y
 * «Conflictos» (medido el 17/10/2026: 6.165 renglones; 286 en Eliminados y 284 en Problemas). Se cuenta una vez por
 * (fecha, remitente, destinatario, asunto, adjuntos, principio del cuerpo: `claveMail`), y se queda la copia de la Bandeja o de
 * Enviados si existe. Borradores y Bandeja de salida
 * no cuentan (no salieron); Correo no deseado tampoco.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { raizPrincipal } from './nubeOrden.mjs';
import { normalizarTexto, fechaLocal } from './mailCache.mjs';
import { taparClaves, sinMarcaDelAsistente } from '../_automatizacionCandidatos.mjs';

export { taparClaves, normalizarTexto, fechaLocal };

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** La copia local de mails: la de este checkout o la del principal (desde un worktree). Null si no hay ninguna. */
export function rutaMailsJsonl(raiz = RAIZ) {
    for (const r of [raiz, raizPrincipal(raiz)]) {
        const p = path.join(r, '.mail-cache', 'mails.jsonl');
        if (fs.existsSync(p)) return p;
    }
    return null;
}

/** Donde va la salida por defecto: `exports/<nombre>` del checkout principal. */
export function salidaPorDefecto(nombre, raiz = RAIZ) {
    return path.join(raizPrincipal(raiz), 'exports', nombre);
}

/** 'entrada' | 'enviados' | 'otra' (eliminados, sincronizacion, archivo) | null (no cuenta). */
export function claseCarpeta(carpeta) {
    const c = normalizarTexto(carpeta);
    if (/borradores|bandeja de salida|correo no deseado/.test(c)) return null;
    if (c.includes('bandeja de entrada')) return 'entrada';
    if (c.includes('elementos enviados')) return 'enviados';
    return 'otra';
}

/**
 * La clave de un mail para no contarlo dos veces: fecha + remitente + destinatario + asunto + adjuntos + el principio
 * del cuerpo sin enlaces (el aviso de una tarea asignada a tres personas son tres mails con el mismo cuerpo). El cuerpo hace falta: el 28/04/2026 17:21 Carlos asigno 8 tareas distintas en el Planner y los 8 avisos
 * tienen la misma fecha, remitente y asunto («You've been assigned a task»); sin el cuerpo quedaban en uno (medido el
 * 17/10: 38 tareas daban 29). Las copias del mismo mail en dos carpetas tienen el mismo cuerpo.
 */
export function claveMail(m) {
    const huella = normalizarTexto(String(m.cuerpo ?? '').replace(/<https?:\/\/[^>]*>/g, ' ')).slice(0, 1500);
    const adjuntos = (m.adjuntos ?? []).map((a) => String(a).toLowerCase()).join('/');
    return [String(m.fecha ?? ''), normalizarTexto(m.de), normalizarTexto(m.para), normalizarTexto(m.asunto), adjuntos, huella].join('|');
}

/**
 * Lee la copia y devuelve los mails que cuentan, sin repetidos. `conCuerpo` false deja afuera el cuerpo (20 MB).
 * `filtro(m)` (opcional) descarta antes de guardar, para no tener en memoria lo que no se usa.
 */
export async function leerMails(jsonl, { conCuerpo = false, filtro = null } = {}) {
    const elegido = new Map();
    let leidos = 0;
    let fechaMin = '';
    let fechaMax = '';
    if (!jsonl || !fs.existsSync(jsonl)) return { mails: [], leidos, fechaMin, fechaMax };
    const rl = readline.createInterface({ input: fs.createReadStream(jsonl, 'utf8'), crlfDelay: Infinity });
    for await (const linea of rl) {
        if (!linea.trim()) continue;
        let m;
        try { m = JSON.parse(linea); } catch { continue; }
        leidos += 1;
        const fecha = String(m.fecha ?? '');
        if (fecha && (!fechaMin || fecha < fechaMin)) fechaMin = fecha;
        if (fecha > fechaMax) fechaMax = fecha;
        const clase = claseCarpeta(m.carpeta);
        if (!clase) continue;
        const liviano = {
            id: String(m.id ?? ''),
            carpeta: String(m.carpeta ?? ''),
            clase,
            fecha,
            de: String(m.de ?? ''),
            de_mail: String(m.de_mail ?? ''),
            para: String(m.para ?? ''),
            cc: String(m.cc ?? ''),
            asunto: String(m.asunto ?? ''),
            adjuntos: Array.isArray(m.adjuntos) ? m.adjuntos.map(String) : [],
            cuerpo: conCuerpo ? String(m.cuerpo ?? '') : '',
        };
        if (filtro && !filtro({ ...liviano, cuerpo: String(m.cuerpo ?? '') })) continue;
        const k = claveMail({ ...liviano, cuerpo: String(m.cuerpo ?? '') });
        const previo = elegido.get(k);
        // Se queda la copia de la Bandeja o de Enviados: es la que `_mails.py --ver <id>` encuentra seguro.
        if (!previo || (previo.clase === 'otra' && liviano.clase !== 'otra')) elegido.set(k, liviano);
    }
    const mails = [...elegido.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    return { mails, leidos, fechaMin, fechaMax };
}

/** Texto de un mail listo para una celda de una tabla markdown: sin clave, sin barras ni saltos. */
export function celda(texto) {
    return sinMarcaDelAsistente(taparClaves(texto)).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

/** Escribe la salida (crea la carpeta). El texto ya viene tapado; se vuelve a tapar por las dudas. */
export function escribirSalida(ruta, texto) {
    fs.mkdirSync(path.dirname(path.resolve(ruta)), { recursive: true });
    fs.writeFileSync(ruta, taparClaves(texto) + '\n', 'utf8');
}

/** `--x valor` y banderas sueltas. Una opcion desconocida frena (no se adivina lo que se quiso pedir). */
export function leerArgs(argv, conValor, banderas = []) {
    const a = {};
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        if (k === '--help' || k === '-h') { a.ayuda = true; continue; }
        if (banderas.includes(k)) { a[k.slice(2)] = true; continue; }
        if (conValor.includes(k)) {
            const v = argv[++i];
            if (v === undefined || v.startsWith('--')) throw new Error(`falta el valor de ${k}`);
            a[k.slice(2)] = v;
            continue;
        }
        throw new Error(`opcion desconocida: ${k}`);
    }
    return a;
}

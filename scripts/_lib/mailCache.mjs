/**
 * _lib/mailCache.mjs — leer el cache de mails y cruzarlo contra la cola de tareas.
 *
 * POR QUE EXISTE (los tres relevamientos que lo motivaron):
 *   Los pedidos que llegan por mail NO se vuelven carpeta solos. En los relevamientos del
 *   03/08, 14/08 y 19/08/2026 el mismo barrido manual de la Bandeja de entrada contra los
 *   nombres de carpeta destapo SIETE pedidos invisibles — mails reales esperando respuesta
 *   que ninguna carpeta del Escritorio representaba (el caso extremo estuvo 24 dias parado
 *   y la respuesta ya existia). Ese barrido era a mano cada vez; aca queda automatico.
 *
 * QUE HACE Y QUE NO:
 *   - Lee `.mail-cache/mails.jsonl` (lo llena `_mails.py --sync`, solo lectura de Outlook).
 *   - Devuelve listas para OJEAR: candidatas, no verdades. Un mail sin carpeta puede ser
 *     charla sin tarea; una carpeta puede matchear de casualidad. El que decide es el humano.
 *   - NO crea carpetas, NO manda mails, NO escribe nada. Detect-only.
 *   - El contenido de los mails NUNCA va a un archivo del repo (es publico): de aca salen
 *     lineas por consola y nada mas.
 *
 * El complemento de `_entregas.mjs`: aquel arranca de los ARCHIVOS de las tareas y pregunta
 * "¿salio?"; este arranca de los MAILS que entraron y pregunta "¿tiene carpeta?".
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const MAILS_JSONL = path.join(RAIZ, '.mail-cache', 'mails.jsonl');

// ─────────────────────────────────────────────────────────────────────────────
// Normalizacion y tokens
// ─────────────────────────────────────────────────────────────────────────────

/** Sin tildes, sin puntuacion, minusculas: "RV: Alta código Caimarí" -> "rv alta codigo caimari". */
export function normalizarTexto(s) {
    return String(s ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9ñ]+/g, ' ')
        .trim().replace(/\s+/g, ' ');
}

/**
 * Solo palabras funcionales y muletillas de mail. Las palabras de dominio (solicitud,
 * pedido, consumo...) NO van aca: en un nombre de carpeta como "Leo solicitud" son
 * justamente la señal que hace matchear.
 */
const STOPWORDS = new Set([
    'de', 'la', 'el', 'los', 'las', 'del', 'para', 'por', 'con', 'en', 'y', 'o', 'a', 'un',
    'una', 'unos', 'unas', 'al', 'lo', 'le', 'les', 'se', 'su', 'sus', 'que', 'como', 'mas',
    'muy', 'es', 'son', 'fue', 'ser', 'hay', 'ya', 'si', 'no', 'mi', 'tu', 'nos', 'me', 'te',
    'sobre', 'entre', 'hasta', 'desde', 'donde', 'cuando', 'este', 'esta', 'estos', 'estas',
    'eso', 'esa', 're', 'rv', 'fw', 'fwd', 'fyi', 'hola', 'gracias', 'saludos', 'buenos',
    'buenas', 'dias', 'tardes', 'noches', 'mail', 'correo',
]);

/**
 * Raiz aproximada para que el plural no rompa el match ("tope" tiene que encontrar a
 * "TOPES DE PABLO"). Español simple: -es en palabras largas, -s en el resto.
 */
export function raiz(token) {
    const t = String(token);
    if (t.length >= 6 && t.endsWith('es') && !/\d/.test(t)) return t.slice(0, -2);
    if (t.length >= 4 && t.endsWith('s') && !/\d/.test(t)) return t.slice(0, -1);
    return t;
}

/** Tokens con señal: sin stopwords y sin restos de 1-2 letras (salvo que tengan numero: "6a", "3d"). */
export function tokensSignificativos(s) {
    return normalizarTexto(s).split(' ')
        .filter((t) => t && !STOPWORDS.has(t) && (t.length >= 3 || /\d/.test(t)))
        .map(raiz);
}

/**
 * Palabras largas que NOMBRAN UNA CLASE de cosa (un tipo de pedido, de documento, de accion,
 * de material o de pieza), el proyecto paraguas y la reunion diaria: cualquier tarea puede
 * tenerlas, asi que compartir UNA con una carpeta no dice que el mail sea esa tarea.
 *
 * El 24/09/2026 `_escritorio.mjs` escondio "Consulta Consumo Hilos" (Federico, 21/09) detras
 * de las cinco carpetas con "consumo" en el nombre ("Top Roll Patagonia - consumo Haartz"...)
 * y "Material Felpa 21-6416" (22/09) detras de "Formato de consumo unitario de material".
 * Medido sobre la Bandeja real de los 30 dias anteriores: 33 hilos se daban por "con carpeta"
 * por UN solo token y 32 los tapaba una carpeta de otro tema. La lista sale de esa medicion:
 * las palabras que tapaban, y las de la misma clase que aparecen en esos asuntos o en los
 * nombres de las carpetas (abiertas, en espera y cerradas).
 *
 * Solo van palabras de 7 letras o mas: las mas cortas ("codigo", "plano") ya no alcanzan solas.
 * Se escriben en singular: el plural sale solo. Agregar una palabra nunca esconde un mail,
 * solo hace aparecer alguno de mas — ante la duda, se agrega.
 */
export const PALABRAS_GENERICAS = [
    // lo que pide un mail
    'consulta', 'pregunta', 'solicitud', 'propuesta', 'pendiente', 'urgente', 'seguimiento',
    'relevamiento', 'prioridad',
    // documentos
    'formato', 'informe', 'informacion', 'presentacion', 'factibilidad', 'flujograma',
    'plantilla', 'documentacion', 'revision',
    // acciones
    'actualizacion', 'actualizar', 'actualizado', 'modificacion', 'modificar', 'modificado',
    'corregido', 'revisar', 'verificar', 'imprimir', 'mejorar',
    // materiales, cosas y tipos de pieza
    'consumo', 'material', 'proceso', 'proyecto', 'producto', 'proveedor', 'cliente',
    'maquina', 'dispositivo', 'impresora', 'estanteria', 'inserto', 'headrest', 'apoyacabeza',
    // el proyecto paraguas (media cola es suya) y la reunion diaria de prioridades
    'patagonia', 'asaichi',
];

const pluralDe = (p) => (/[aeiou]$/.test(p) ? `${p}s` : `${p}es`);
/** Las palabras de arriba como las deja tokensSignificativos, en singular y en plural. */
export const GENERICAS = new Set(PALABRAS_GENERICAS.flatMap((p) => {
    const n = normalizarTexto(p);
    return [raiz(n), raiz(pluralDe(n))];
}));

/**
 * ¿Este token, compartido SOLO, alcanza para decir que el mail es esa tarea?
 *
 *  - Con numero: solo si parece un codigo — 4 digitos o mas y que no sea un año (asg1050,
 *    6416, p280828, 11010843). Un pedazo corto es una fecha o una cantidad: el "21" de
 *    "21-09" o de "21-6614" tapo "Material Felpa 21-6416" tanto como la palabra "material",
 *    y "2026", "09", "3d" o "5" tapaban 17 hilos del mismo relevamiento.
 *  - Sin numero: un nombre propio — un apellido, un cliente, un producto (caimari, cozzuol,
 *    sinoyqx): 7 letras o mas y que no sea una PALABRAS_GENERICAS.
 */
export function identificaSolo(token) {
    const t = String(token);
    if (/\d/.test(t)) return (t.match(/\d/g) ?? []).length >= 4 && !/^(19|20)\d\d$/.test(t);
    return t.length >= 7 && !GENERICAS.has(t);
}

/**
 * ¿El asunto de un mail "es" alguna de las tareas de la cola?
 *
 * Dos tokens distintos en comun alcanzan ("alta codigo caimari" vs "nuevo codigo caimari");
 * uno solo alcanza unicamente si `identificaSolo` (un codigo o un nombre propio). El mismo
 * token repetido en el asunto sigue siendo uno. El costo de tapar un pedido invisible es
 * mayor que el de listar un mail de mas.
 */
export function matcheaTarea(tokensMail, tokensTarea) {
    const bolsa = new Set(tokensTarea);
    const comunes = [...new Set(tokensMail)].filter((t) => bolsa.has(t));
    if (comunes.length >= 2) return true;
    return comunes.some(identificaSolo);
}

/** "RV: RE: RV: asunto" -> "asunto", para agrupar un hilo entero en una sola linea. */
export function claveHilo(asunto) {
    let s = normalizarTexto(asunto);
    let previo;
    do { previo = s; s = s.replace(/^(re|rv|fw|fwd)\s+/, ''); } while (s !== previo);
    return s;
}

/**
 * Mails que nunca son una tarea: automaticos (no-reply y compañia) y los saludos de
 * cumpleaños internos de Barack (en la primera corrida real, 30/08/2026, eran 3 de los 11
 * hilos listados — puro ruido). Cada exclusion nueva ESCONDE mails: agregar solo casos
 * inequivocos como estos, nunca palabras de dominio.
 */
export function esRuido(mail) {
    if (/no-?_?reply|noreply|postmaster|mailer-?daemon|donotreply/i.test(`${mail.de_mail ?? ''} ${mail.de ?? ''}`)) return true;
    return /feli(z|ces) cumple/.test(normalizarTexto(mail.asunto ?? ''));
}

/** 'entrada' | 'borradores' | 'salida' | 'otro' — a partir del nombre de carpeta de Outlook. */
export function tipoCarpeta(carpeta) {
    const c = normalizarTexto(carpeta);
    if (c.includes('bandeja de entrada')) return 'entrada';
    if (c.includes('borradores')) return 'borradores';
    if (c.includes('bandeja de salida')) return 'salida';
    return 'otro';
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura del cache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los mails desde `desdeISO` (AAAA-MM-DD), livianos: sin cuerpo, que pesa 20 MB en total
 * y aca no hace falta. Streaming como `indexarAdjuntos` de `_entregas.mjs`.
 */
export async function leerMailsDesde(desdeISO, jsonl = MAILS_JSONL) {
    const out = [];
    if (!fs.existsSync(jsonl)) return out;
    const rl = readline.createInterface({ input: fs.createReadStream(jsonl, 'utf8'), crlfDelay: Infinity });
    for await (const linea of rl) {
        if (!linea.trim()) continue;
        let m;
        try { m = JSON.parse(linea); } catch { continue; }
        const fecha = String(m.fecha ?? '');
        if (!fecha || fecha < desdeISO) continue;
        out.push({
            fecha,
            carpeta: String(m.carpeta ?? ''),
            de: String(m.de ?? ''),
            de_mail: String(m.de_mail ?? ''),
            para: String(m.para ?? ''),
            asunto: String(m.asunto ?? ''),
            adjuntos: (m.adjuntos ?? []).length,
        });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// El cruce
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cruza los mails recientes contra los nombres de las tareas (abiertas + cerradas).
 * Devuelve:
 *   sinCarpeta  — hilos de la Bandeja de entrada que no matchean ninguna tarea: las
 *                 candidatas a pedido invisible. Uno por hilo, el mail mas nuevo.
 *   noAvisados  — Borradores y Bandeja de salida recientes: la firma de "hecho pero no
 *                 avisado" (el patron que explicaba 30 de 30 tareas sin cerrar el 03/08).
 *                 Solo se reporta: los mails los manda Fak, o van por _mailEnviar.py.
 */
export function cruzarMailsConTareas(mails, nombresTareas) {
    const tareas = nombresTareas.map((n) => tokensSignificativos(n)).filter((t) => t.length);

    const hilos = new Map();          // claveHilo -> { mail mas nuevo, cuantos }
    const noAvisados = [];
    for (const m of mails) {
        const tipo = tipoCarpeta(m.carpeta);
        if (tipo === 'borradores' || tipo === 'salida') { noAvisados.push({ ...m, tipo }); continue; }
        if (tipo !== 'entrada' || esRuido(m)) continue;
        const k = claveHilo(m.asunto);
        if (!k) continue;
        const previo = hilos.get(k);
        if (!previo) hilos.set(k, { ...m, mails: 1 });
        else { previo.mails += 1; if (m.fecha > previo.fecha) Object.assign(previo, m); }
    }

    const sinCarpeta = [...hilos.values()]
        .filter((h) => { const tk = tokensSignificativos(h.asunto); return !tareas.some((t) => matcheaTarea(tk, t)); })
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    noAvisados.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    return { sinCarpeta, noAvisados };
}

/**
 * AAAA-MM-DD en hora LOCAL (no `toISOString()`, que es UTC): las fechas del cache y el
 * `date.today()` de `_mails.py` son locales, y despues de las 21:00 de Argentina el dia UTC ya
 * es el siguiente — el 05/09/2026 a las 21:30 el corte de "ultimos N dias" corria un dia.
 */
export function fechaLocal(fecha = new Date()) {
    const f = fecha instanceof Date ? fecha : new Date(fecha);
    const p = (n) => String(n).padStart(2, '0');
    return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
}

/** AAAA-MM-DD (local) de hace `dias` dias. */
export function fechaCorte(dias, ahora = Date.now()) {
    return fechaLocal(new Date(ahora - dias * 86400000));
}

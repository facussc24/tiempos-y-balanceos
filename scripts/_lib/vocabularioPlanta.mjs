/**
 * vocabularioPlanta.mjs - en un documento para la planta va solo vocabulario que Barack usa.
 *
 * Gemelo de `vocabulario_planta.py`: lee el MISMO `vocabularioPlanta.data.json` y hace lo mismo.
 * El test de paridad (`__tests__/scripts/vocabularioPlanta.test.mjs`) corre las dos sobre los
 * mismos textos y exige la misma respuesta. Si se toca una regla aca, se toca alla.
 *
 * Origen (Fak, 08/10/2026): un flujograma generado por Claude decia «RESTITUCION DE CONTROL DE
 * MATERIA PRIMA (IQC) CON CUARENTENA...» y Fak: «no se entiende un carajo... es gravisimo...
 * jamas podes poner algo que yo no pueda defender o que no entienda... nadie lo va a entender,
 * incluso los gerentes». Los controles de antes miran palabras PROHIBIDAS (lista negra): una
 * palabra nueva que nadie penso en prohibir pasaba. Este es una LISTA BLANCA: una palabra pasa
 * si Barack la usa (esta en lo que escribieron sus personas) o si alguien la aprobo con fuente.
 *
 * Que cuenta como palabra: minusculas, sin tildes ni virgulilla, solo a-z de 2 a 40 letras. Un
 * trozo con ALGUN numero es un codigo y no se mira (2HC.858.417, N 231, MP8147, 21-9689, OP-10).
 * Las siglas cuentan: IQC no pasa si no esta en el corpus. Las unidades se ignoran.
 *
 * Uso desde otro motor (por ejemplo tools/flowchart/propuestas):
 *     import { revisarVocabularioFlujograma, exigirVocabulario } from '../../scripts/_lib/vocabularioPlanta.mjs';
 *     const hallazgos = revisarVocabularioFlujograma(doc);   // [] = pasa
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
export const DATOS = path.join(AQUI, 'vocabularioPlanta.data.json');
// Las otras listas de palabras prohibidas que ya existian: se LEEN, no se copian (una sola fuente).
const VOCAB_HOJAS = path.join(RAIZ, '.claude', 'skills', 'hojas-de-proceso', 'vocabulario.data.json');
const FORBIDDEN_AMFE = path.join(RAIZ, 'core', 'amfe', 'forbiddenContent.data.json');

const TROZO = /[a-z0-9]+(?:[._/-][a-z0-9]+)*/g;
const URL_MAIL = /(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+/g;
// Rutas de Windows (C:\Dev\...), de red (\\servidor\...) y nombres de archivo (ico_13756.png): los
// specs de las hojas llevan las rutas de los iconos EPP en el mismo campo que el texto.
const RUTA = /[a-z]:[\\/][^\s"'<>|]*|\\\\[^\s"'<>|]+|\b[\w-]+\.(?:png|jpe?g|ico|gif|bmp|svg|pdf|xlsx?|docx?|pptx?|json|py|mjs|txt|csv)\b/g;
const SEPARA = /[._/-]/;
const TIENE_NUMERO = /[0-9]/;
const MIN_LARGO = 2;
const MAX_LARGO = 40;

/** Minusculas y sin tildes ni virgulilla. Igual que `plano` de vocabulario_planta.py. */
export const plano = (s) => String(s ?? '').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();

/** Las palabras de un texto, en orden y con repetidas. */
export function palabras(texto) {
    const t = plano(texto).replace(URL_MAIL, ' ').replace(RUTA, ' ');
    const out = [];
    for (const trozo of t.match(TROZO) ?? []) {
        if (TIENE_NUMERO.test(trozo)) continue;
        for (const p of trozo.split(SEPARA)) {
            if (p.length >= MIN_LARGO && p.length <= MAX_LARGO) out.push(p);
        }
    }
    return out;
}

/** Formas que cuentan como LA MISMA palabra para el corpus: plural y genero. */
export function variantes(p) {
    const bases = new Set([p]);
    if (p.endsWith('ones') && p.length > 5) bases.add(p.slice(0, -2));
    if (p.endsWith('ces') && p.length > 4) bases.add(p.slice(0, -3) + 'z');
    if (p.endsWith('es') && p.length > 4) bases.add(p.slice(0, -2));
    if (p.endsWith('s') && p.length > 3) bases.add(p.slice(0, -1));
    const out = new Set();
    for (const b of bases) {
        out.add(b); out.add(`${b}s`); out.add(`${b}es`);
        if (b.length > 3 && 'ao'.includes(b[b.length - 1])) {
            const g = b.slice(0, -1) + (b[b.length - 1] === 'a' ? 'o' : 'a');
            out.add(g); out.add(`${g}s`);
        }
    }
    return out;
}

const cache = new Map();

/** Lee el data.json y le suma las otras listas de prohibidas. Si falta un archivo FALLA: un
 *  control que no encuentra su lista y sigue como si nada esta apagado. */
export function cargar(ruta = DATOS) {
    const clave = path.resolve(ruta);
    if (cache.has(clave)) return cache.get(clave);
    const d = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    const ignoradas = new Set();
    for (const blk of Object.values(d.ignoradas ?? {})) {
        if (blk && typeof blk === 'object') for (const w of blk.palabras ?? []) ignoradas.add(w);
    }
    // Sin fuente no entra (Fak, 08/10/2026): una entrada a mano sin fuente rompe la carga.
    for (const [seccion, lista] of [['aprobadas', d.aprobadas ?? {}], ['prohibidas', d.prohibidas ?? {}]]) {
        for (const [k, v] of Object.entries(lista)) {
            if (!v || typeof v !== 'object' || !String(v.fuente ?? '').trim()) {
                throw new Error(`vocabularioPlanta.data.json: "${k}" de ${seccion} no tiene fuente`);
            }
            const ps = palabras(k);
            if (k !== plano(k) || ps.length !== 1 || ps[0] !== k) {
                throw new Error(`vocabularioPlanta.data.json: "${k}" de ${seccion} tiene que ser UNA palabra en minusculas y sin tildes`);
            }
        }
    }
    const patrones = [];
    const hojas = JSON.parse(fs.readFileSync(VOCAB_HOJAS, 'utf8'));
    for (const e of hojas.prohibidos ?? []) {
        patrones.push({
            rx: new RegExp(e.patron), reemplazo: e.reemplazo ?? '', motivo: e.motivo ?? '',
            fuente: `${e.fuente ?? ''} [vocabulario.data.json de hojas-de-proceso]`,
        });
    }
    const amfe = JSON.parse(fs.readFileSync(FORBIDDEN_AMFE, 'utf8'));
    for (const [lista, motivo] of [['PENINSULAR_TERMS', 'espanolismo que en Barack no se dice'],
        ['ENGLISH_RANDOM_TERMS', 'ingles o castellano que nadie en Barack usa']]) {
        for (const t of amfe[lista] ?? []) {
            patrones.push({
                rx: new RegExp(`\\b${plano(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), reemplazo: '', motivo,
                fuente: `core/amfe/forbiddenContent.data.json ${lista}`,
            });
        }
    }
    const r = {
        datos: d, reglas: d.reglas ?? {}, corpus: d.corpus ?? {}, fuentes: d.corpus_fuentes ?? [],
        ignoradas, aprobadas: d.aprobadas ?? {}, prohibidas: d.prohibidas ?? {}, patrones,
    };
    cache.set(clave, r);
    return r;
}

function evidencia(e, reglas) {
    if (e[0] >= (reglas.min_docs_ho ?? 1) || e[1] >= (reglas.min_docs_sgc ?? 1)) return true;
    // Lo que dice Fak en el chat NO alcanza solo salvo que `min_mensajes_fak` sea un numero: medido el
    // 08/10/2026, de las 1.969 palabras que solo estan en sus mensajes (3+ veces) la mitad son typos
    // («bine», «lso», «digmaos») y el resto castellano de chat o jerga de programacion (commit, build).
    const minimo = reglas.min_mensajes_fak;
    return Boolean(minimo) && e[2] >= minimo;
}

const fuenteDe = (e, fuentes) => e.slice(3).filter((x) => Number.isInteger(x) && x >= 0 && x < fuentes.length).map((x) => fuentes[x]);

/** ['ok'|'prohibida'|'fuera', info] para UNA palabra ya normalizada. */
export function evaluarPalabra(p, cfg) {
    const vs = [...variantes(p)].sort();
    for (const v of vs) {
        if (Object.prototype.hasOwnProperty.call(cfg.prohibidas, v)) {
            const e = cfg.prohibidas[v];
            return ['prohibida', { reemplazo: e.reemplazo ?? '', nota: e.nota ?? '', fuente: e.fuente ?? '' }];
        }
    }
    for (const v of vs) {
        if (cfg.ignoradas.has(v)) return ['ok', { por: 'ignorada' }];
        if (Object.prototype.hasOwnProperty.call(cfg.aprobadas, v)) return ['ok', { por: 'aprobada', fuente: cfg.aprobadas[v].fuente ?? '' }];
    }
    for (const v of vs) {
        const e = Object.prototype.hasOwnProperty.call(cfg.corpus, v) ? cfg.corpus[v] : null;
        if (e && evidencia(e, cfg.reglas)) return ['ok', { por: 'corpus', palabra: v, fuentes: fuenteDe(e, cfg.fuentes) }];
    }
    return ['fuera', {}];
}

/** items: [[donde, texto], ...]. Devuelve un hallazgo por palabra y lugar; [] = el documento pasa. */
export function revisarTextos(items, ruta = DATOS) {
    const cfg = cargar(ruta);
    const out = [];
    for (const [donde, texto] of items) {
        if (typeof texto !== 'string' || !texto.trim()) continue;
        const vistas = new Set();
        for (const p of palabras(texto)) {
            if (vistas.has(p)) continue;
            vistas.add(p);
            const [estado, info] = evaluarPalabra(p, cfg);
            if (estado === 'prohibida') {
                out.push({ palabra: p, motivo: 'prohibida', donde, texto, reemplazo: info.reemplazo, nota: info.nota, fuente: info.fuente });
            } else if (estado === 'fuera') {
                out.push({ palabra: p, motivo: 'fuera_del_corpus', donde, texto, reemplazo: '', nota: '', fuente: '' });
            }
        }
        const pl = plano(texto);
        for (const { rx, reemplazo, motivo, fuente } of cfg.patrones) {
            const m = rx.exec(pl);
            if (m) {
                const exist = out.find((h) => h.palabra === m[0] && h.donde === donde);
                if (exist) {
                    if (exist.motivo !== 'prohibida' || (!exist.reemplazo && reemplazo)) {
                        exist.motivo = 'prohibida';
                        exist.reemplazo = reemplazo || exist.reemplazo;
                        exist.nota = motivo || exist.nota;
                        exist.fuente = fuente || exist.fuente;
                    }
                } else {
                    out.push({ palabra: m[0], motivo: 'prohibida', donde, texto, reemplazo, nota: motivo, fuente });
                }
            }
        }
    }
    return out;
}

/** Agrupa por palabra: {palabra: {motivo, donde: [lugares], reemplazo, nota, fuente}}. */
export function resumir(hallazgos) {
    const r = {};
    for (const h of hallazgos) {
        const e = r[h.palabra] ??= { motivo: h.motivo, donde: [], reemplazo: h.reemplazo, nota: h.nota, fuente: h.fuente };
        e.donde.push(h.donde);
        if (h.motivo === 'prohibida') e.motivo = 'prohibida';
    }
    return r;
}

/** El mensaje que lee Fak: cada palabra, por que, y en que renglon esta. */
export function textoDeHallazgos(hallazgos, maximoLugares = 3) {
    const lineas = [];
    for (const [p, e] of Object.entries(resumir(hallazgos)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        const lugares = e.donde.slice(0, maximoLugares).join(', ')
            + (e.donde.length > maximoLugares ? ` (+${e.donde.length - maximoLugares} mas)` : '');
        if (e.motivo === 'prohibida') {
            const sug = e.reemplazo ? ` -> va "${e.reemplazo}"` : '';
            lineas.push(`  "${p}": prohibida${sug}. ${e.nota} [${e.fuente}]\n      en: ${lugares}`);
        } else {
            lineas.push(`  "${p}": no la usa nadie de Barack (no esta en sus hojas, procedimientos ni en lo que dice Fak).\n      en: ${lugares}`);
        }
    }
    return lineas.join('\n');
}

// ─── flujogramas ────────────────────────────────────────────────────────────
// Claves del JSON que NO son texto que se imprime (numeros de paso, tipos de figura, colores...).
const CLAVES_SIN_TEXTO = new Set(['type', 'stepId', 'criticalColor', 'direction', 'lineWidth', 'branchColumnWidth',
    'incomingConnector', 'targetId', 'mergeDown', 'critical']);

/**
 * Todos los textos que el motor de flujogramas IMPRIME: cajetin (header), productos, historial
 * de revisiones y cada nodo del flujo (pasos, condiciones, ramas laterales, retrabajos, leyenda).
 * Las claves que empiezan con `_` son notas de quien arma el JSON y no se imprimen: no entran.
 * Devuelve [[donde, texto], ...] con el camino al renglon (`flow[3].branchSide.description`).
 */
export function textosDeFlujograma(doc) {
    const items = [];
    const rec = (valor, camino) => {
        if (typeof valor === 'string') { items.push([camino, valor]); return; }
        if (Array.isArray(valor)) { valor.forEach((v, i) => rec(v, `${camino}[${i}]`)); return; }
        if (valor && typeof valor === 'object') {
            for (const [k, v] of Object.entries(valor)) {
                if (k.startsWith('_') || CLAVES_SIN_TEXTO.has(k)) continue;
                rec(v, camino ? `${camino}.${k}` : k);
            }
        }
    };
    for (const k of ['header', 'products', 'revisions', 'flow']) {
        if (doc?.[k] !== undefined) rec(doc[k], k);
    }
    return items;
}

/** El control del generador de flujogramas: [] = pasa. */
export function revisarVocabularioFlujograma(doc, ruta = DATOS) {
    return revisarTextos(textosDeFlujograma(doc), ruta);
}

/** Version bloqueante para scripts: imprime y devuelve false si hay palabras fuera. */
export function exigirVocabulario(items, { nombre = 'el documento', log = console.error, ruta = DATOS } = {}) {
    const h = revisarTextos(items, ruta);
    if (!h.length) return true;
    log(`\n  ${nombre.toUpperCase()} NO SE GENERA: tiene ${Object.keys(resumir(h)).length} palabra(s) que Barack no usa.`);
    log(textoDeHallazgos(h));
    log('\n  Se reemplaza por la palabra que la planta usa. Si la palabra es correcta, se agrega a\n'
        + '  `aprobadas` de scripts/_lib/vocabularioPlanta.data.json CON su fuente (un documento de\n'
        + '  Barack o un mensaje de Fak). Sin fuente no entra (Fak, 08/10/2026).');
    return false;
}

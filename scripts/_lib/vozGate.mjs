/**
 * _lib/vozGate.mjs — el mail que sale a nombre de Fak tiene que sonar a Fak.
 *
 * POR QUE EXISTE
 *   `.claude/rules/mail-envio.md` dice desde el 11/09/2026 "Revise, no Revisamos" (Fak:
 *   *"revise porque revisamos, yo revise"*), y al dia siguiente Fak volvio a pedir lo mismo:
 *   la regla estaba escrita y no la medi­a nadie. Este archivo es su enforcement.
 *
 * DE DONDE SALEN LOS NUMEROS
 *   Del corpus real: `.mail-cache/mails.jsonl`, carpeta "Elementos enviados", **hasta
 *   2026-02** (voz pura: antes de que yo empezara a redactarle). n = 935 mails.
 *   Cada chequeo lleva al lado cuantos mails de Fak lo dispararian; los ROJO estan
 *   calibrados para no pasar de ~1% de falsos positivos sobre ese corpus. Se reproduce con
 *   `node scripts/_vozFak.mjs --selftest`.
 *
 * LO QUE NO HACE
 *   No corrige el texto ni lo reescribe. Marca y explica; el que redacta decide.
 *   Un ROJO frena el envio en `_mailEnviar.py`; un AMARILLO solo avisa.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanForbidden } from './forbiddenContent.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const PERFIL_JSON = path.join(AQUI, 'vozFak.data.json');

export const ROJO = 'rojo';
export const AMARILLO = 'amarillo';

/** Numeros por defecto, por si el perfil todavia no se genero. Los pisa vozFak.data.json. */
export const PERFIL_DEFAULT = {
    n: 935,
    // testamento: 2500 — arriba del p99 real de Fak (1.787). El escribe mails largos de vez en
    // cuando (9 de 935 pasan los 2.000) y el gate no puede llamarle error a eso.
    largo: { mediana: 148, p75: 305, p90: 585, testamento: 2500 },
    saludos: ['buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'buenas', 'hola', 'estimados'],
    cierres: ['saludos', 'slds', 'gracias', 'muchas gracias', 'saludos cordiales', 'quedo a disposicion'],
};

export function cargarPerfil(ruta = PERFIL_JSON) {
    try {
        const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        return { ...PERFIL_DEFAULT, ...j, largo: { ...PERFIL_DEFAULT.largo, ...(j.largo || {}) } };
    } catch {
        return PERFIL_DEFAULT;
    }
}

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * El cuerpo que escribio el que firma, sin la firma de Outlook ni el mail citado abajo.
 * Espejo en JS de `texto_propio()` de scripts/_mails.py.
 */
/**
 * HTML a texto. `_prepararMail.py` acepta `cuerpo_html`, y Outlook devuelve `HTMLBody`: si el
 * gate mide el marcado, cuenta los tags como largo del mail — una firma con tabla se pasa sola
 * de los 2.500 caracteres y el semaforo da ROJO por algo que el destinatario ni ve. Se desarma
 * solo lo que cambia la MEDICION: bloques que no son texto, saltos de linea y entidades.
 */
function aTexto(html) {
    return String(html)
        .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<td[^>]*>/gi, ' | ')          // la tabla tiene que SEGUIR pareciendo una tabla
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n');
}

export function cuerpoPropio(texto) {
    let t = String(texto ?? '').replace(/\r/g, '');
    if (/<(br|p|div|table|span|html|body|td)\b[^>]*>/i.test(t)) t = aTexto(t);
    // Borrador `_mail*.txt`: arriba llevan la nota para Fak y la cabecera PARA:/ASUNTO:. Eso no
    // es el mail — si se mide, el semaforo habla de un texto que el destinatario no va a leer.
    // Se exige el par PARA:/ASUNTO: EN MAYUSCULAS y al principio: asi lo escriben mis
    // borradores. Con la bandera /i esto tambien matcheaba el "Para:/Asunto:" que Outlook
    // pone al citar un mail ajeno, y entonces el gate se ponia a medir el texto de OTRO
    // como si fuera de Fak (el corpus salto de 935 a 1030 mails y aparecio "hola Facu").
    const cabecera = t.slice(0, 400).match(/^PARA:[\s\S]{0,300}?^ASUNTO:.*$/m);
    if (cabecera) t = t.slice(t.indexOf(cabecera[0]) + cabecera[0].length);
    // El mail citado abajo: encabezados de Outlook (es/en), separadores y "El X escribio:".
    const citado = t.search(/^\s*(De:|From:|Para:|To:|Enviado el:|Sent:|-{2,}\s*Mensaje original|El .{0,40} escribi[oó]:|[_-]{5,}\s*$)/m);
    if (citado >= 0) t = t.slice(0, citado);
    // La firma. Outlook la pone el; cuando aparece, lo de abajo ya no es texto propio.
    const firma = t.search(/Facundo\s+(Martin\s+)?Santoro|Obtener Outlook|Enviado desde|f\.santoro@/i);
    if (firma >= 0) t = t.slice(0, firma);
    return t.trim();
}

/**
 * El saludo: la formula, y hasta 3 nombres propios CERRADOS por coma o dos puntos.
 * El cierre con [,:] es lo que evita comerse la primera palabra de la oracion — la primera
 * version usaba [,: ] y se tragaba "Actualizamos ", con lo que el gate daba verde justo a
 * los dos mails que lo motivaron.
 */
const RE_SALUDO = /^\s*(?:(?:buen(?:os)?\s+d[ií]as?|buenas?(?:\s+tardes|\s+noches)?|hola|estimad[oa]s?)\s*[,:!.]?\s*)?(?:[A-ZÁÉÍÓÚÑ][\wáéíóúñ.]*\s*[,:]\s*){0,3}/i;

export function primeraOracion(texto) {
    const cuerpo = String(texto ?? '').trim().replace(RE_SALUDO, '');
    const fin = cuerpo.search(/[.\n?]/);
    return (fin > 0 ? cuerpo.slice(0, fin) : cuerpo.slice(0, 200)).trim();
}

/** Verbos de trabajo TERMINADO en 1a persona del plural. "necesitamos" no esta: no es trabajo hecho. */
const RE_PLURAL_TRABAJO = /\b(logramos|hicimos|revisamos|corregimos|analizamos|detectamos|armamos|actualizamos|desarrollamos|modificamos|verificamos|cargamos|generamos|completamos|alineamos|ajustamos|recalculamos|medimos|relevamos)\b/i;

/**
 * Cuando el plural es legitimo y de Fak: hay un tercero de verdad, es algo a futuro con el
 * otro, o el sujeto es el area hacia afuera ("Les informamos que...").
 * Los 5 casos reales del corpus que cubre cada rama estan en el selftest.
 */
const RE_PLURAL_LEGITIMO = /(junto con|juntos|nos reunimos|te parece si|avisame|reuni[oó]n|entre todos|con el equipo|les? (informamos|comunicamos|comentamos)|quer[ií]a informarles|vamos a|lo vamos|acordamos|si (al )?revisa)/i;

/** Cada chequeo: codigo, nivel, como detecta, que decir, y el dato del corpus que lo calibra. */
const CHEQUEOS = [
    {
        codigo: 'PLURAL_APERTURA', nivel: ROJO, corpus: "1 de 935 mails de Fak",
        motivo: 'El mail abre en plural contando trabajo propio. Fak: "revise porque revisamos, yo revise".',
        buscar(t) {
            const o = primeraOracion(t);
            if (!RE_PLURAL_TRABAJO.test(o)) return null;
            // Tiene que ser el VERBO DE APERTURA, no un plural en una subordinada. Fak escribe
            // "los archivos de tiempos que hicimos" y eso es suyo; lo mio es "Corregimos en el arb".
            const palabras = o.split(/\s+/).slice(0, 3);
            const i = palabras.findIndex((p) => RE_PLURAL_TRABAJO.test(p));
            if (i < 0) return null;
            if (i > 0 && /^(que|y|o|donde|cuando)$/i.test(palabras[i - 1])) return null;
            const hasta = t.indexOf(o) >= 0 ? t.slice(0, t.indexOf(o) + o.length + 1) : o;
            if (RE_PLURAL_LEGITIMO.test(hasta)) return null;
            return [{ fragmento: palabras[i].replace(/[^\wáéíóúñ]/gi, ''), contexto: o.slice(0, 90) }];
        },
    },
    {
        codigo: 'PLURAL_CUERPO', nivel: AMARILLO, corpus: '22 de 26 casos del corpus son de Fak: el plural NO esta prohibido',
        motivo: 'Plural en el cuerpo: si el trabajo lo hiciste vos solo va en singular; si hubo alguien mas, nombralo.',
        buscar(t) {
            if (RE_PLURAL_LEGITIMO.test(t)) return null;
            const o = primeraOracion(t);
            const resto = t.replace(o, ' ');
            const hits = [...resto.matchAll(new RegExp(RE_PLURAL_TRABAJO.source, 'gi'))];
            return hits.length ? hits.map((h) => ({ fragmento: h[0], contexto: '' })) : null;
        },
    },
    {
        codigo: 'SE_DE_INFORME', nivel: ROJO, corpus: "1 de 935",
        motivo: 'Impersonal de informe. El mail lo firma una persona: "corregi", no "se procedio a corregir".',
        buscar: (t) => grep(t, /\bse\s+(procedi[oó]|llev[oó]\s+a\s+cabo|efectu[oó])\b/gi),
    },
    {
        codigo: 'SE_IMPERSONAL', nivel: AMARILLO, corpus: '4 de 935 (Fak lo usa cuando el hecho es del sistema)',
        motivo: 'Impersonal: revisar si el que hizo eso fuiste vos. Si lo hiciste vos, va en primera persona.',
        buscar: (t) => grep(t, /\bse\s+(realiz[oó]|constat[oó]|verific[oó]|detect[oó])\b/gi),
    },
    {
        codigo: 'FORMULA_FORMAL', nivel: ROJO, corpus: "0 de 935",
        motivo: 'Formula que Fak no usa nunca. Cierra con "Saludos." (con un cliente, "Saludos cordiales,").',
        buscar: (t) => grep(t, /\b(cordialmente|atentamente|quedo a su entera disposici[oó]n|reciba un cordial saludo)\b/gi),
    },
    {
        codigo: 'POR_LA_PRESENTE', nivel: AMARILLO, corpus: "2 de 935",
        motivo: 'Arranque de nota formal. Fak arranca con el objeto: "Adjunto...", "Te envio...".',
        buscar: (t) => grep(t, /por (medio de )?la presente/gi),
    },
    {
        codigo: 'GIRO_N_COSAS', nivel: ROJO, corpus: '0 de 935 — y aparece en 3 borradores mios',
        motivo: 'El "Tres cosas para mirar:" + lista es marca mia, no de Fak. Decilo corrido.',
        buscar: (t) => grep(t, /\b(dos|tres|cuatro|cinco|seis|\d+)\s+(cosas|puntos|temas)\s+(para|que|a)\b/gi),
    },
    {
        codigo: 'TABLA_EN_EL_CUERPO', nivel: ROJO, corpus: "0 de 935",
        motivo: 'Tabla en el cuerpo del mail. Los numeros van en el adjunto: para eso lo abren.',
        buscar: (t) => grep(t, /^\s*\|.*\|/gm),
    },
    {
        codigo: 'VINETAS', nivel: AMARILLO, corpus: '0 de 935 mails de Fak usan vinetas',
        motivo: 'Fak enumera con parrafos sueltos separados por una linea en blanco, sin guiones.',
        buscar: (t) => grep(t, /^\s*[-•*]\s+\S/gm),
    },
    {
        codigo: 'SECCION_NUMERADA', nivel: AMARILLO, corpus: "0 de 935",
        motivo: 'Secciones numeradas: "marca IA" (Fak, 20/08/2026: "es obvio que lo armaste vos de esa forma").',
        buscar: (t) => grep(t, /^\s*\d+[.)]\s+[A-ZÁÉÍÓÚ]/gm),
    },
    {
        codigo: 'CONDICIONAL_DE_RECOMENDACION', nivel: AMARILLO, corpus: "0 de 935",
        motivo: 'Fak no recomienda en condicional: dice que hizo o que necesita.',
        buscar: (t) => grep(t, /\b(convendr[ií]a|habr[ií]a que|ser[ií]a conveniente|corresponder[ií]a|ser[ií]a recomendable)\b/gi),
    },
    {
        codigo: 'CIERRE_AJENO', nivel: AMARILLO, corpus: '"abrazo" y "como va" 0 de 935; "lo vemos" 1',
        motivo: 'Cierre que no es suyo. El de Fak: "Saludos." / "Cualquier duda, avisame."',
        buscar: (t) => grep(t, /\b(abrazo|como va|lo vemos juntos|cualquier cosa lo vemos)\b/gi),
    },
    {
        codigo: 'EXPLICO_DE_MAS', nivel: AMARILLO, corpus: 'Fak, 01/09/2026: "aclaras siempre demasiado loco, que entren y revisen ellos"',
        motivo: 'Conector de informe: el mail dice QUE se manda, no como se llego.',
        buscar: (t) => grep(t, /\b(en resumen|a modo de|cabe aclarar|dicho esto|por consiguiente|en consecuencia|vale aclarar)\b/gi),
    },
];

function grep(texto, re) {
    const hits = [...String(texto).matchAll(re)];
    return hits.length ? hits.map((h) => ({ fragmento: h[0].trim(), contexto: '' })) : null;
}

/** En que linea del texto cae un fragmento (1-based), para poder senalarlo. */
function lineaDe(texto, fragmento) {
    const i = texto.toLowerCase().indexOf(String(fragmento).toLowerCase());
    return i < 0 ? null : texto.slice(0, i).split('\n').length;
}

/**
 * Revisa el cuerpo de un mail contra la voz medida de Fak.
 * @returns {{hallazgos: Array, rojos: number, amarillos: number, largo: number, perfil: object}}
 */
export function revisarVoz(textoCrudo, perfil = cargarPerfil()) {
    const texto = cuerpoPropio(textoCrudo);
    const hallazgos = [];
    const agregar = (codigo, nivel, motivo, corpus, h) => hallazgos.push({
        codigo, nivel, motivo, corpus,
        fragmento: h.fragmento, contexto: h.contexto, linea: lineaDe(texto, h.fragmento),
    });

    for (const ch of CHEQUEOS) {
        const hits = ch.buscar(texto);
        if (hits) for (const h of hits) agregar(ch.codigo, ch.nivel, ch.motivo, ch.corpus, h);
    }

    // Largo: contra la distribucion real, no contra un numero elegido por mi.
    const largo = texto.length;
    if (largo > perfil.largo.testamento) {
        agregar('LARGO_TESTAMENTO', ROJO,
            `${largo} caracteres. Fak, 20/08/2026: "le mandaste un testamento".`,
            `su mediana es ${perfil.largo.mediana} y su p90 ${perfil.largo.p90} (n=${perfil.n})`,
            { fragmento: texto.slice(0, 40), contexto: '' });
    } else if (largo > perfil.largo.p90) {
        agregar('LARGO_SOBRE_P90', AMARILLO,
            `${largo} caracteres: mas largo que el 90% de los mails de Fak.`,
            `mediana ${perfil.largo.mediana} · p75 ${perfil.largo.p75} · p90 ${perfil.largo.p90}`,
            { fragmento: texto.slice(0, 40), contexto: '' });
    }

    // Tildes: Fak tiene typos, pero inconsistentes. Un texto largo con CERO tildes es mio.
    const palabrasConTilde = (texto.match(/\b(codigo|numeracion|revision|maquina|tambien|informacion|produccion|operacion|deberia|dia|esta|mando|articulo|analisis|ultimo|proximo)\b/gi) || []).length;
    if (texto.length > 200 && !/[áéíóúÁÉÍÓÚ]/.test(texto) && palabrasConTilde >= 2) {
        agregar('SIN_UNA_SOLA_TILDE', AMARILLO,
            'Texto largo sin una sola tilde: eso no es un typo, es como escribo yo.',
            '10 de 935 mails de Fak (el suele mezclar: "dias" y "día" en el mismo mail)',
            { fragmento: texto.slice(0, 40), contexto: '' });
    }

    // Vocabulario: se reusa la lista canonica que ya valida los AMFE.
    const { forbidden, warnings } = scanForbidden(texto);
    for (const f of forbidden) {
        // Los nombres de equipo son ROJO en un AMFE (ahi el equipo se inventa); en un mail el
        // equipo puede ser justo el tema del que se habla — Fak escribio "pistola de ultrasonido"
        // en un mail real del 14/02/2025. Aca queda en amarillo.
        const esEquipo = /equipo/i.test(f.kind);
        agregar(esEquipo ? 'EQUIPO_A_VERIFICAR' : 'VOCABULARIO_PROHIBIDO', esEquipo ? AMARILLO : ROJO,
            `"${f.term}" — ${f.kind}.${esEquipo ? ' Verificar que ese equipo exista con ese nombre.' : ' Fak: "queda obvio que los hiciste vos".'}`,
            'core/amfe/forbiddenContent.data.json', { fragmento: f.term, contexto: '' });
    }
    for (const w of warnings) {
        agregar('VOCABULARIO_CLAUDE', AMARILLO, `"${w.term}" — ${w.kind}.`,
            'core/amfe/forbiddenContent.data.json', { fragmento: w.term, contexto: '' });
    }

    return {
        hallazgos,
        rojos: hallazgos.filter((h) => h.nivel === ROJO).length,
        amarillos: hallazgos.filter((h) => h.nivel === AMARILLO).length,
        largo, perfil,
    };
}

/** Salida para consola, la misma que ve el hook y la que imprime _prepararMail.py. */
export function formatear(res, { titulo = 'VOZ DEL MAIL' } = {}) {
    const l = [];
    const semaforo = res.rojos ? '[ROJO]' : res.amarillos ? '[AMARILLO]' : '[VERDE]';
    l.push(`${semaforo} ${titulo} — ${res.largo} caracteres (mediana de Fak: ${res.perfil.largo.mediana})`);
    if (!res.hallazgos.length) {
        l.push('   Suena a Fak: primera persona, corto, sin formulas.');
        return l.join('\n');
    }
    for (const h of res.hallazgos) {
        const donde = h.linea ? `linea ${h.linea}` : '';
        l.push(`   ${h.nivel === ROJO ? 'ROJO    ' : 'AMARILLO'} ${h.codigo} ${donde}`);
        l.push(`            "${h.fragmento}" ${h.contexto ? `en: "${h.contexto}..."` : ''}`);
        l.push(`            ${h.motivo}`);
        l.push(`            [corpus: ${h.corpus}]`);
    }
    if (res.rojos) l.push(`   ${res.rojos} ROJO: no sale asi. Reescribir y volver a pasar el chequeo.`);
    return l.join('\n');
}

/**
 * Caracteristicas especiales — simbologia interna de Barack y su conversion a cliente.
 *
 * Las siglas NO son universales y en Barack conviven tres notaciones. Fuentes abiertas y
 * verificadas el 08/09/2026 (memoria `caracteristicas_especiales_notacion_barack`):
 *
 *  - Instructivo del SGC `I-AC-005 Emision y control del AMFE y plan de control` rev.B
 *    (y su rev.A de 2018/2019, misma tabla): Caracteristica critica = `CC` (S 9 o 10),
 *    Caracteristica significativa = `CS` (S 5 a 8, O >= 4). Cierra con: "Sera utilizada la
 *    simbologia especificada por el Cliente cuando el mismo asi lo requiera."
 *  - Manual AMFE SETEC / AIAG-VDA 1a ed., pag. 129 (AMFE de proceso): critica = `∇`,
 *    significativa = `SC`, mas `OS` (seguridad del operador) y `HI` (alto impacto).
 *  - `I-PY-001.7 Listado carac. especiales prod-proc`, hoja "Tipos de caracteristicas",
 *    tabla de conversion exigida por IATF 16949: interna `CC` -> VW `D/TLD`, interna `SC` ->
 *    VW `Wichtig (W)`; para PWA la critica se consulta en su CSR y la significativa es `SC`.
 *
 * Ningun documento de trabajo de Barack usa `CS`: todos escriben `SC`, que es la sigla del
 * manual. Por eso `CS` se acepta como alias de `SC` en vez de tratarse como valor invalido.
 *
 * Decision de Fak, 08/09/2026: en la documentacion que va a VW se usa la simbologia de VW
 * (`D/TLD` y `W`), que es justamente lo que ya manda el I-AC-005. La CLASIFICACION la sigue
 * asignando Fak o el cliente (`core-prohibiciones.md` §2); esto solo traduce la sigla.
 *
 * DE DONDE SALE CADA SIGLA — barrido del 08/09/2026 sobre todo lo que tiene Barack
 * (24 normas VW del legajo VW427 + Formel Q + Formel Q Anexo + CSR IATF + QMA):
 *  - `D/TLD` esta EN DOCUMENTOS DE VW. Formel Q Capacidad de Calidad 8a ed. jun-2015,
 *    pag. 28 §7.5: "El Cliente tiene dos tipos de identificaciones que tienen el mismo
 *    rango (la 'D' mas antigua y la 'TLD' mas reciente)". Tambien VW Group CSR IATF 16949
 *    ene-2018 pag. 2 §8.2.3.1.2 ("parts with D/TLD-marking") y VW 01058 pag. 31 §5.1.4.
 *  - `W` NO aparece en NINGUN documento de VW que tenga Barack. El unico "wichtig" de todo
 *    el barrido es la palabra dentro de "Funktionswichtige Teile (FWT)", que es otra cosa.
 *    Su unica fuente es la tabla de conversion del `I-PY-001.7` (hoja "Tipos de
 *    caracteristicas", celda E22), un archivo interno de Barack.
 *  - Eso NO invalida la tabla: el mismo Formel Q §7.5 dice que si el proveedor usa una
 *    simbologia distinta a la del Cliente "debera definir una correlacion entre su
 *    identificacion/simbologia y la del Cliente (p. e. por medio de una matriz de
 *    correlacion)" y que esa matriz debe estar bajo control de documentos. El I-PY-001.7 ES
 *    esa matriz. Por eso la leyenda de abajo cita para `W` el I-PY-001.7 y no una norma VW:
 *    escribir "simbologia VW" al lado de `W` seria afirmar algo que ninguna norma respalda.
 *  Rutas exactas de cada documento: memoria `caracteristicas_especiales_notacion_barack`.
 */

/** Nivel canonico interno. Es lo que se compara en las reglas, nunca el texto crudo. */
export type SpecialCharLevel = 'CRITICA' | 'SIGNIFICATIVA' | 'SEGURIDAD_OPERADOR' | 'ALTO_IMPACTO';

/** Todas las siglas que significan lo mismo, vengan del instructivo, del manual o del cliente. */
const ALIASES: Record<SpecialCharLevel, readonly string[]> = {
    CRITICA: ['CC', 'CS/CC', '∇', '▽', 'D', 'D/TLD', 'TLD'],
    SIGNIFICATIVA: ['SC', 'CS', 'W', 'WICHTIG', 'W (WICHTIG)'],
    SEGURIDAD_OPERADOR: ['OS'],
    ALTO_IMPACTO: ['HI'],
};

/** Sigla que corresponde a cada nivel segun el destinatario del documento. */
export const SIMBOLOGIA = {
    /** Interna de Barack (I-AC-005 + practica reAL: CC/SC). */
    INTERNA: { CRITICA: 'CC', SIGNIFICATIVA: 'SC', SEGURIDAD_OPERADOR: 'OS', ALTO_IMPACTO: 'HI' },
    /** VW / VWA — tabla de conversion del I-PY-001.7. */
    VW: { CRITICA: 'D/TLD', SIGNIFICATIVA: 'W', SEGURIDAD_OPERADOR: 'OS', ALTO_IMPACTO: 'HI' },
} as const satisfies Record<string, Record<SpecialCharLevel, string>>;

const normalize = (raw: string | undefined | null): string =>
    (raw || '')
        .trim()
        .toUpperCase()
        // "SC 1", "SC1", "D/TLD 3" — el numero es el ID de la caracteristica en el
        // I-PY-001.7, no parte de la sigla.
        .replace(/\s*\d+$/, '')
        .trim();

/**
 * Nivel canonico de una marca, sea cual sea la notacion en que este escrita.
 * Devuelve null si la celda esta vacia o la sigla no la reconoce ninguna de las tres fuentes
 * (en ese caso NO se adivina: se reporta como desconocida).
 */
export function nivelDeCaracteristica(raw: string | undefined | null): SpecialCharLevel | null {
    const v = normalize(raw);
    if (!v) return null;
    for (const [nivel, siglas] of Object.entries(ALIASES) as [SpecialCharLevel, readonly string[]][]) {
        if (siglas.includes(v)) return nivel;
    }
    return null;
}

/** true si la marca significa "critica", escrita como CC, ∇, D o D/TLD. */
export const esCritica = (raw: string | undefined | null): boolean =>
    nivelDeCaracteristica(raw) === 'CRITICA';

/** true si la marca significa "significativa", escrita como SC, CS o W. */
export const esSignificativa = (raw: string | undefined | null): boolean =>
    nivelDeCaracteristica(raw) === 'SIGNIFICATIVA';

/** true si hay texto pero ninguna de las tres fuentes lo reconoce. */
export const esMarcaDesconocida = (raw: string | undefined | null): boolean =>
    !!normalize(raw) && nivelDeCaracteristica(raw) === null;

/** Traduce una marca a la simbologia del destinatario. Deja intacto lo que no reconoce. */
export function convertirSimbologia(
    raw: string | undefined | null,
    destino: keyof typeof SIMBOLOGIA,
): string {
    const nivel = nivelDeCaracteristica(raw);
    if (!nivel) return (raw || '').trim();
    const sufijo = (raw || '').trim().match(/\s*(\d+)$/);
    return SIMBOLOGIA[destino][nivel] + (sufijo ? ` ${sufijo[1]}` : '');
}

// ============================================================================
// Leyenda imprimible — que significa cada sigla y de que documento sale
// ============================================================================

/**
 * Fuente de cada sigla, tal como se imprime en el documento. Se cita el documento
 * REAL (ver cabecera): una sigla sin fuente verificada no lleva fuente inventada.
 */
const FUENTE_POR_SIGLA: Readonly<Record<string, string>> = {
    'D/TLD': 'simbologia VW — Formel Q Capacidad de Calidad §7.5',
    'D': 'simbologia VW — Formel Q Capacidad de Calidad §7.5',
    'TLD': 'simbologia VW — Formel Q Capacidad de Calidad §7.5',
    'W': 'tabla de conversion I-PY-001.7',
    'WICHTIG': 'tabla de conversion I-PY-001.7',
    'CC': 'instructivo I-AC-005',
    'CS': 'instructivo I-AC-005',
    'SC': 'manual AMFE AIAG-VDA pag. 129',
    '∇': 'manual AMFE AIAG-VDA pag. 129',
    '▽': 'manual AMFE AIAG-VDA pag. 129',
    'OS': 'manual AMFE AIAG-VDA pag. 129',
    'HI': 'manual AMFE AIAG-VDA pag. 129',
};

/** Como se nombra cada nivel en la leyenda del documento. */
const TEXTO_NIVEL: Readonly<Record<SpecialCharLevel, string>> = {
    CRITICA: 'CARACTERISTICA CRITICA',
    SIGNIFICATIVA: 'CARACTERISTICA SIGNIFICATIVA',
    SEGURIDAD_OPERADOR: 'SEGURIDAD DEL OPERADOR',
    ALTO_IMPACTO: 'ALTO IMPACTO',
};

/** Orden en que se listan los niveles en la leyenda (de mas grave a menos). */
const ORDEN_NIVEL: readonly SpecialCharLevel[] =
    ['CRITICA', 'SIGNIFICATIVA', 'SEGURIDAD_OPERADOR', 'ALTO_IMPACTO'];

/** Una linea de la leyenda: la sigla tal como esta en el documento y que significa. */
export interface EntradaLeyenda { mark: string; meaning: string; }

/**
 * Leyenda de las siglas REALMENTE usadas en un documento.
 *
 * Nace del pedido de Fak del 08/09/2026 ("estaria bueno que este en el AMFE eso tambien,
 * que lo explique... asi todos saben cuando abren el AMFE"): el que abre el AMFE impreso
 * no tiene al lado la tabla de conversion, y `W` no la habia visto nunca nadie.
 *
 * Se construye desde las marcas que trae el documento, NO desde una lista fija: si el
 * AMFE no marca nada, no hay leyenda; si trae una sigla que ninguna de las tres fuentes
 * reconoce, se lista igual diciendo que no esta definida — no se adivina que quiso decir.
 */
export function leyendaDeMarcas(
    marcas: Iterable<string | null | undefined>,
): EntradaLeyenda[] {
    const vistas = new Map<string, { meaning: string; orden: number }>();
    for (const raw of marcas) {
        const v = normalize(raw);
        if (!v || vistas.has(v)) continue;
        const nivel = nivelDeCaracteristica(v);
        if (!nivel) {
            vistas.set(v, {
                meaning: 'SIGLA NO DEFINIDA en el I-AC-005, el manual AMFE ni el I-PY-001.7 — verificar.',
                orden: ORDEN_NIVEL.length,
            });
            continue;
        }
        const partes = [TEXTO_NIVEL[nivel]];
        const fuente = FUENTE_POR_SIGLA[v];
        if (fuente) partes.push(fuente);
        const interna = SIMBOLOGIA.INTERNA[nivel];
        if (interna !== v) partes.push(`equivale a "${interna}" en la simbologia interna de Barack`);
        vistas.set(v, { meaning: `${partes.join(' — ')}.`, orden: ORDEN_NIVEL.indexOf(nivel) });
    }
    return [...vistas.entries()]
        .sort((a, b) => a[1].orden - b[1].orden || a[0].localeCompare(b[0]))
        .map(([mark, { meaning }]) => ({ mark, meaning }));
}

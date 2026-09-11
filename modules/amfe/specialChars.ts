/**
 * Caracteristicas especiales — criterio, niveles y simbologia segun el destinatario.
 *
 * FUENTE UNICA: `core/amfe/caracteristicasEspeciales.data.json` (criterio S/O, aliases,
 * simbologia por cliente, texto de la leyenda y las fuentes con su pagina). Este modulo no
 * repite las tablas: las lee. Regla always-on con la historia y las fuentes:
 * `.claude/rules/caracteristicas-especiales.md`. Pedido de Fak, 11/09/2026: *"no quiero que
 * nunca mas lo olvides"*.
 *
 * Resumen de lo que dicen los documentos (todos abiertos, pagina en el JSON):
 *  - I-AC-005 rev.B punto 5 y manual AIAG-VDA (SETEC pag. 129): critica = S 9 o 10 -> `CC`;
 *    significativa = S 5 a 8 **y** O >= 4 -> `CS` (todos escriben `SC`).
 *  - Formel Q Capacidad de Calidad pag. 28 §7.5: `D` y `TLD` son UNA sola marca de VW, de
 *    mismo rango (D la vieja, TLD la nueva) = documentacion obligatoria LEGAL, la designa el
 *    cliente en el plano (VW 01058 §5.1.4). Equivale a nuestra CC. VW no tiene sigla de
 *    significativa (§7.2: el proveedor nombra las suyas): para VW se escribe `SC`. `W` no
 *    existe en ninguna norma (Fak 09/09/2026).
 *  - La sigla de una causa se justifica SOLO con su S y su O: nunca porque otro documento
 *    la tenia. Asignarla sigue siendo de Fak o del cliente (`core-prohibiciones.md` §2).
 */
import data from '../../core/amfe/caracteristicasEspeciales.data.json';

/** Nivel canonico interno. Es lo que se compara en las reglas, nunca el texto crudo. */
export type SpecialCharLevel = 'CRITICA' | 'SIGNIFICATIVA' | 'SEGURIDAD_OPERADOR' | 'ALTO_IMPACTO';

/** Nivel que se decide por S y O (OS y HI no salen del criterio: los declara el equipo). */
export type NivelPorCriterio = 'CRITICA' | 'SIGNIFICATIVA';

interface Criterio { severidad_min: number; severidad_max: number; ocurrencia_min: number; texto: string; }

/** Todas las siglas que significan lo mismo, vengan del instructivo, del manual o del cliente. */
const ALIASES = data.aliases as Record<SpecialCharLevel, readonly string[]>;

/** Celdas que dicen "sin caracteristica" con texto ("-", "—", "N/A"). */
const SIN_MARCA: readonly string[] = data.sin_marca;

/** Umbrales del I-AC-005 punto 5: critica S >= 9; significativa S 5-8 y O >= 4. */
export const CRITERIO = data.criterio as Record<NivelPorCriterio, Criterio>;

/** Sigla que corresponde a cada nivel segun el destinatario del documento. */
export const SIMBOLOGIA = data.simbologia as Record<'INTERNA' | 'VW', Record<SpecialCharLevel, string>>;

/** Como se nombra cada nivel en la leyenda del documento. */
const TEXTO_NIVEL = data.texto_nivel as Record<SpecialCharLevel, string>;

const normalize = (raw: string | undefined | null): string =>
    (raw || '')
        .trim()
        .toUpperCase()
        // "SC 1", "SC1", "D/TLD 3" — el numero es el ID de la caracteristica en el
        // I-PY-001.7, no parte de la sigla.
        .replace(/\s*\d+$/, '')
        // "D / TLD" es la misma marca que "D/TLD": los espacios alrededor de la barra son
        // tipeo, no notacion (auditor 11/09/2026; sin esto caia en sigla desconocida).
        .replace(/\s*\/\s*/g, '/')
        .replace(/\s+/g, ' ')
        .trim();

/**
 * Nivel canonico de una marca, sea cual sea la notacion en que este escrita.
 * Devuelve null si la celda esta vacia o la sigla no la reconoce ninguna de las fuentes
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

/** true si la marca significa "significativa", escrita como SC o CS. */
export const esSignificativa = (raw: string | undefined | null): boolean =>
    nivelDeCaracteristica(raw) === 'SIGNIFICATIVA';

/** true si la celda dice "sin caracteristica" con texto ("-", "—", "N/A") o esta vacia. */
export const esSinMarca = (raw: string | undefined | null): boolean =>
    SIN_MARCA.includes(normalize(raw));

/** true si hay texto (que no es "-") pero ninguna fuente lo reconoce: W, Wichtig, Clave, PV2005... */
export const esMarcaDesconocida = (raw: string | undefined | null): boolean =>
    !!normalize(raw) && !esSinMarca(raw) && nivelDeCaracteristica(raw) === null;

/**
 * Nivel que el criterio del I-AC-005 asigna a una causa por su S y su O.
 * CRITICA si S >= 9 (O indistinto); SIGNIFICATIVA si S 5-8 y O >= 4; null si ninguna.
 * Es una SUGERENCIA por criterio: asignar la sigla es de Fak o del cliente.
 */
export function nivelPorCriterio(
    severidad: number | string | undefined | null,
    ocurrencia: number | string | undefined | null,
): NivelPorCriterio | null {
    const s = Number(severidad);
    const o = Number(ocurrencia);
    if (!Number.isFinite(s) || s <= 0) return null;
    if (s >= CRITERIO.CRITICA.severidad_min) return 'CRITICA';
    const r = CRITERIO.SIGNIFICATIVA;
    if (s >= r.severidad_min && s <= r.severidad_max && Number.isFinite(o) && o >= r.ocurrencia_min) return 'SIGNIFICATIVA';
    return null;
}

/**
 * Sigla que corresponderia a S y O en la simbologia del destinatario (CC/SC interna, D/TLD y SC
 * para VW), o null si el criterio no da ninguna. Es lo que muestra el boton de sugerencia de la
 * tabla y lo que imprime el listado por criterio; NO asigna nada.
 */
export function siglaSugerida(
    severidad: number | string | undefined | null,
    ocurrencia: number | string | undefined | null,
    destino: keyof typeof SIMBOLOGIA = 'INTERNA',
): string | null {
    const nivel = nivelPorCriterio(severidad, ocurrencia);
    return nivel ? SIMBOLOGIA[destino][nivel] : null;
}

/**
 * true si la marca escrita es coherente con S y O de la causa: una critica exige S >= 9 y
 * una significativa S 5-8 y O >= 4. Una celda vacia, "-", OS o HI no se juzgan por este
 * criterio (devuelve true); una sigla desconocida tampoco entra aca (`esMarcaDesconocida`).
 */
export function marcaCoherenteConCriterio(
    raw: string | undefined | null,
    severidad: number | string | undefined | null,
    ocurrencia: number | string | undefined | null,
): boolean {
    const nivel = nivelDeCaracteristica(raw);
    if (nivel !== 'CRITICA' && nivel !== 'SIGNIFICATIVA') return true;
    return nivelPorCriterio(severidad, ocurrencia) === nivel;
}

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
// Leyenda imprimible — que significa cada sigla
// ============================================================================

/** Orden en que se listan los niveles en la leyenda (de mas grave a menos). */
const ORDEN_NIVEL: readonly SpecialCharLevel[] =
    ['CRITICA', 'SIGNIFICATIVA', 'SEGURIDAD_OPERADOR', 'ALTO_IMPACTO'];

/** Una linea de la leyenda: la sigla tal como esta en el documento y que significa. */
export interface EntradaLeyenda { mark: string; meaning: string; }

/**
 * Leyenda de las siglas REALMENTE usadas en un documento.
 *
 * Nace del pedido de Fak del 08/09/2026 ("estaria bueno que este en el AMFE eso tambien,
 * que lo explique... asi todos saben cuando abren el AMFE"). Ese mismo dia fijo el formato:
 * en caratula y flujograma **no se citan instructivos ni manuales**: va solo
 * "CARACTERISTICA CRITICA" / "CARACTERISTICA SIGNIFICATIVA" (LECCIONES 08/09). Las fuentes
 * viven en el JSON y en la regla, no en el documento que lee planta y cliente.
 *
 * Se construye desde las marcas que trae el documento, NO desde una lista fija: si el
 * AMFE no marca nada, no hay leyenda; si trae una sigla que ninguna fuente reconoce, se
 * lista igual diciendo que no esta definida — no se adivina que quiso decir.
 */
export function leyendaDeMarcas(
    marcas: Iterable<string | null | undefined>,
): EntradaLeyenda[] {
    const vistas = new Map<string, { meaning: string; orden: number }>();
    for (const raw of marcas) {
        const v = normalize(raw);
        if (!v || vistas.has(v) || esSinMarca(v)) continue;
        const nivel = nivelDeCaracteristica(v);
        if (!nivel) {
            vistas.set(v, { meaning: 'SIGLA NO DEFINIDA — VERIFICAR.', orden: ORDEN_NIVEL.length });
            continue;
        }
        vistas.set(v, { meaning: TEXTO_NIVEL[nivel], orden: ORDEN_NIVEL.indexOf(nivel) });
    }
    return [...vistas.entries()]
        .sort((a, b) => a[1].orden - b[1].orden || a[0].localeCompare(b[0]))
        .map(([mark, { meaning }]) => ({ mark, meaning }));
}

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

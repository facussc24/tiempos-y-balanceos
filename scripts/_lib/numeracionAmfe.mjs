/**
 * numeracionAmfe.mjs — los numeros de operacion que un AMFE cubre, leidos de sus filas.
 *
 * Sacado tal cual de `_verificarNumeracion.mjs` el 18/10/2026 para que la ficha de configuracion por
 * pieza (`fichaPieza.mjs`, tanda 13) cuente las operaciones del AMFE con la MISMA regla que el chequeo de
 * numeracion, en vez de escribir otra. Lo usan los dos.
 */

/**
 * Los numeros de operacion que el AMFE CUBRE — no solo los que numera.
 *
 * Criterio de Fak (18/08/2026, "opcion C"): el flujograma DESGLOSA lo que el AMFE AGRUPA,
 * y eso esta bien mientras el AMFE lo DECLARE. Una fila que dice `"OP 20-27 CORTE DE
 * VINILO"` cubre las ocho operaciones de corte del flujograma; una que dice
 * `"OP 30 / 32-34 COSTURA UNION"` cubre la 30 y las 32 a 34.
 *
 * Sin leer ese rango, el chequeo le exigiria al AMFE una fila por cada paso del flujograma
 * y la convencion de la casa quedaria marcada como error para siempre. Con el rango leido,
 * declararlo SIRVE: es la diferencia entre agrupar y desalinearse.
 */
export const RANGO_RE = /\bOPS?\.?\s+([\d\s\-/,]+?)\s+[A-ZÁÉÍÓÚÑ]/i;

export function cubiertosPorNombre(nombre) {
    const m = RANGO_RE.exec(String(nombre || ''));
    if (!m) return [];
    const out = [];
    for (const parte of m[1].split(/[/,]/)) {
        const rango = parte.trim().match(/^(\d+)\s*-\s*(\d+)$/);
        if (rango) {
            const [, a, b] = rango.map(Number);
            for (let n = a; n <= b; n++) out.push(String(n));
        } else if (/^\d+$/.test(parte.trim())) {
            out.push(parte.trim());
        }
    }
    return out;
}

/**
 * Una fila del AMFE puede cubrir dos pasos del flujograma y numerarse `70-71`. Pasa cuando el
 * flujograma separa un paso y su control y el AMFE los analiza juntos (Fak, 08/09/2026 sobre el
 * INSERT: "lo del 71 no me importa en el AMFE, pone 70-71 y listo"). Devuelve los dos numeros;
 * si no es un rango, el numero tal cual.
 */
export function expandirRango(n) {
    const rango = n.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!rango) return [n];
    const [, a, b] = rango.map(Number);
    if (!(b > a) || b - a > 20) return [n];   // "103-2" o basura: no se inventa un rango
    const out = [];
    for (let i = a; i <= b; i++) out.push(String(i));
    return out;
}

export function numerosDe(doc) {
    const out = [];
    for (const o of doc.operations || []) {
        const n = String(o.opNumber ?? o.operationNumber ?? '').trim();
        if (n) out.push(...expandirRango(n));
        out.push(...cubiertosPorNombre(o.name ?? o.operationName));
    }
    return [...new Set(out)];
}

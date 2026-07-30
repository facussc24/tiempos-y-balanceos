/**
 * Traduccion de SQL para SupabaseAdapter.
 *
 * Estas funciones son PURAS y viven fuera de utils/database.ts a proposito: son el
 * unico codigo de traduccion de SQL que corre en produccion y hasta 2026-07-30 no
 * tenian ni un test (los 3329 tests de la suite corren contra InMemoryAdapter, que
 * nunca se ejecuta en produccion). Sacarlas de la clase las hace testeables.
 */

/**
 * Reemplaza los marcadores `$1`, `$2`, ... por los valores literales escapados.
 *
 * En UNA sola pasada, a proposito. La implementacion anterior iteraba los
 * parametros en orden inverso llamando `replaceAll('$' + (i+1), valor)`; el orden
 * inverso evitaba que `$1` pisara a `$10`, pero cada iteracion volvia a mirar el
 * texto YA sustituido. Consecuencia: un `$1` que viniera DENTRO de un dato se
 * reemplazaba por el valor de otro parametro.
 *
 * No era teorico: `saveAmfeDocument` manda el JSON completo del AMFE como `$22`,
 * detras de 21 parametros, y en pesos argentinos `$1`, `$10` o `$1.500` son
 * prefijos que matchean. El resultado era SQL invalido (el guardado fallaba
 * devolviendo `false` sin explicar por que) o, en el peor caso, SQL inyectado.
 *
 * Un `replace` con funcion de reemplazo recorre el string original de izquierda a
 * derecha y NUNCA re-inspecciona lo que ya insertó, asi que el problema desaparece
 * por construccion. Ademas la funcion evita que los `$&` / `$1` que puedan venir
 * dentro del valor se interpreten como referencias de reemplazo.
 *
 * Un marcador sin parametro correspondiente se deja intacto: es un bug del llamador
 * y taparlo con NULL lo esconderia.
 */
export function inlineParams(sql: string, params: readonly unknown[]): string {
    return sql.replace(/\$(\d+)/g, (match, digits: string) => {
        const indice = Number(digits) - 1;
        if (indice < 0 || indice >= params.length) return match;
        return sqlLiteral(params[indice]);
    });
}

/**
 * Convierte un valor de JS al literal SQL correspondiente.
 * Las comillas simples se duplican, que es el escape estandar de SQL.
 */
export function sqlLiteral(val: unknown): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    return `'${String(val).replace(/'/g, "''")}'`;
}

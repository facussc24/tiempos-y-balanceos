/**
 * ordenProceso.mjs — que una renumeracion NO pueda dar vuelta el orden de un proceso real.
 *
 * EL INCIDENTE QUE LO ORIGINA (18/08/2026, encontrado el 23/08)
 * 12:40 — `_corregirOrdenApoyacabezasTraseros.mjs` deja los AMFE 153 y 155 con
 *         50 INSERCION DE VARILLA -> 60 ENFUNDADO -> 70 INYECCION DE PU,
 *         porque Fak lo dijo del puesto: *"se coloca la varilla, la funda, y luego se
 *         inyecta"*, *"lo tengo 100% claro eso"*.
 * 16:47 — `_alinearAmfesPatagonia.mjs`, renumerando contra el flujograma, mapea
 *         `INSERCION DE VARILLA 50 -> 41` y `ENFUNDADO 60 -> 40`.
 *         El par quedo INVERTIDO. El mensaje del commit no lo menciona.
 *
 * Los dos scripts hicieron bien lo suyo: el segundo ubica cada operacion POR NOMBRE (nunca
 * por posicion) y renumera de mayor a menor, que son sus dos guardas. Ninguna de las dos
 * mira el ORDEN RELATIVO entre operaciones. Se ubico bien la operacion y se la mando al
 * numero equivocado.
 *
 * QUE HACE ESTE MODULO — y que NO hace
 * Verifica que un plan de renumeracion PRESERVE el orden relativo de las cadenas declaradas.
 * **No decide cual es el orden correcto**: compara el despues contra el antes. Si el orden
 * ya estaba mal, sigue mal y este modulo no opina — eso es a proposito. Un gate escrito sobre
 * un diagnostico sin confirmar no protege, enforca (leccion del 21/08).
 *
 * Por eso alcanza para el caso abierto: hoy NO sabemos si va varilla->funda o funda->varilla
 * (regla `amfe.md` §12, lo define Fak), pero SI sabemos que nadie puede darlo vuelta callado.
 */

/**
 * Cadenas de operaciones cuyo orden relativo es un hecho del proceso fisico.
 * Cada paso es un regex contra el NOMBRE de la operacion. Si en un documento falta
 * alguno de los pasos, ese paso se ignora y se comparan los que esten (el delantero
 * suma bolsa/carga y cierre de molde en el medio; los traseros no los tienen).
 */
export const CADENAS_DE_PROCESO = [
    {
        id: 'APOYACABEZAS_PU',
        aplicaA: /HEADREST|APOYACABEZA/i,
        fuente: 'Fak 18/08/2026: "se coloca la varilla, la funda, y luego se inyecta" · '
              + 'Fak 23/08/2026: "agarras la estructura, le metes la funda y despues pasas a la inyeccion"',
        pasos: [
            { nombre: 'VARILLA', re: /INSERCION\s+DE\s+VARILLA/i },
            { nombre: 'ENFUNDADO', re: /^\s*ENFUNDADO\s*$/i },
            { nombre: 'PU', re: /INYECCION\s+DE\s+PU\b/i },
        ],
    },
];

const numeroDe = (op) => {
    const crudo = String(op?.opNumber ?? op?.operationNumber ?? '').trim();
    return /^\d+$/.test(crudo) ? Number(crudo) : NaN;
};
const nombreDe = (op) => String(op?.name ?? op?.operationName ?? '').trim();

/**
 * Devuelve la secuencia de pasos de una cadena, ordenada por numero de operacion.
 * @param {Array} operaciones
 * @param {object} cadena  una entrada de CADENAS_DE_PROCESO
 * @returns {string[]} nombres de paso presentes, en el orden en que quedan numerados
 */
export function secuenciaDeCadena(operaciones, cadena) {
    const encontrados = [];
    for (const paso of cadena.pasos) {
        const op = (operaciones || []).find((o) => paso.re.test(nombreDe(o)));
        if (!op) continue;
        const n = numeroDe(op);
        if (!Number.isFinite(n)) continue;
        encontrados.push({ paso: paso.nombre, n });
    }
    return encontrados.sort((a, b) => a.n - b.n).map((x) => x.paso);
}

/**
 * Compara el orden de las cadenas antes y despues de un cambio.
 *
 * @param {Array} opsAntes    operaciones del documento ANTES
 * @param {Array} opsDespues  operaciones del documento DESPUES
 * @param {string} etiqueta   para el mensaje (nro de AMFE o nombre de producto)
 * @returns {Array<{cadena:string, antes:string[], despues:string[], detalle:string}>}
 *          vacio si ninguna cadena se invirtio
 */
export function ordenInvertido(opsAntes, opsDespues, etiqueta = '') {
    const hallazgos = [];
    for (const cadena of CADENAS_DE_PROCESO) {
        const antes = secuenciaDeCadena(opsAntes, cadena);
        const despues = secuenciaDeCadena(opsDespues, cadena);
        // Solo comparamos los pasos que estan en las DOS fotos: agregar o sacar una
        // operacion es otro tipo de cambio y no lo juzga este modulo.
        const comunes = new Set(antes.filter((p) => despues.includes(p)));
        const a = antes.filter((p) => comunes.has(p));
        const d = despues.filter((p) => comunes.has(p));
        if (a.length < 2 || a.join('>') === d.join('>')) continue;
        hallazgos.push({
            cadena: cadena.id,
            antes: a,
            despues: d,
            detalle: `${etiqueta ? etiqueta + ': ' : ''}la renumeracion invierte el orden de `
                + `${cadena.id}: antes ${a.join(' -> ')}, despues ${d.join(' -> ')}. `
                + `Este orden es un hecho del proceso (${cadena.fuente}). `
                + `Si el cambio es intencional, decirlo explicito y que lo confirme Fak.`,
        });
    }
    return hallazgos;
}

/**
 * Guarda para scripts de renumeracion: aborta si el plan invierte una cadena.
 * Se llama con el documento antes y el documento despues, ya construidos en memoria.
 *
 * @param {object} docAntes
 * @param {object} docDespues
 * @param {string} etiqueta
 * @param {{permitirInversion?: boolean}} opts  permitirInversion solo con OK explicito de Fak
 */
export function assertOrdenPreservado(docAntes, docDespues, etiqueta = '', opts = {}) {
    const hallazgos = ordenInvertido(docAntes?.operations, docDespues?.operations, etiqueta);
    if (!hallazgos.length) return;
    for (const h of hallazgos) console.error(`\n  🔴 ORDEN_PROCESO_ALTERADO — ${h.detalle}`);
    if (opts.permitirInversion) {
        console.error('  (permitirInversion=true — sigue porque lo autorizaron explicitamente)\n');
        return;
    }
    console.error('\n  Abortado. Si de verdad hay que invertirlo, pasar { permitirInversion: true }');
    console.error('  y dejar escrito quien lo decidio y cuando.\n');
    process.exit(1);
}

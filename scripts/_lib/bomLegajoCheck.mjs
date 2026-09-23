/**
 * bomLegajoCheck.mjs — ¿la BOM ultimo nivel del legajo APQP quedo al dia con el ultimo cambio?
 *
 * Fak, 22/09/2026: *"cada vez que modificamos la bom... la bom ultimo nivel ahi en el apqp...
 * sino siempre me va a quedar desactualizado el apqp"*. Hacerlo es `scripts/_bomLegajo.py`
 * (skill `carga-arb` §4b); ESTO es lo que avisa cuando no se hizo.
 *
 * Criterio: por cada familia de `bomLegajos.data.json`, el PDF de difusion mas nuevo de su
 * carpeta de la biblioteca (`Modificaciones BOM ARB_*.pdf`) NO puede ser posterior a su
 * `BOM ARB ultimo nivel_<familia>_*.pdf` del legajo. Si lo es, hubo un cambio de BOM que no
 * llego al APQP. Lo corre `scripts/_cierreSesion.mjs`.
 *
 * `evaluarBomLegajo()` es pura (la prueba el test); `relevarBomLegajo()` lee el disco.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DATOS = path.join(AQUI, 'bomLegajos.data.json');
const RE_DIFUSION = /^Modificaciones BOM ARB_.*\.pdf$/i;
const TOLERANCIA_MS = 60 * 1000;   // mismo minuto: el legajo se genera con el mismo export

function masNuevo(carpeta, filtro) {
    if (!fs.existsSync(carpeta)) return null;
    let max = null;
    for (const n of fs.readdirSync(carpeta)) {
        if (!filtro(n)) continue;
        const t = fs.statSync(path.join(carpeta, n)).mtimeMs;
        if (max === null || t > max) max = t;
    }
    return max;
}

export function relevarBomLegajo(datos = JSON.parse(fs.readFileSync(DATOS, 'utf8'))) {
    const raiz = datos.raiz_biblioteca.replace(/^~/, os.homedir());
    const legajoAlcanzable = Object.values(datos.familias).some((f) => fs.existsSync(f.legajo));
    const familias = Object.entries(datos.familias).map(([familia, f]) => {
        const prefijo = `BOM ARB ultimo nivel_${familia}_`.toLowerCase();
        const carpeta = path.join(raiz, f.biblioteca);
        return {
            familia,
            bibliotecaExiste: fs.existsSync(carpeta),
            ultimaDifusion: masNuevo(carpeta, (n) => RE_DIFUSION.test(n)),
            ultimoLegajo: masNuevo(f.legajo, (n) => n.toLowerCase().startsWith(prefijo) && n.toLowerCase().endsWith('.pdf')),
        };
    });
    return { legajoAlcanzable, familias };
}

export function evaluarBomLegajo({ legajoAlcanzable, familias }) {
    // Una biblioteca que no se lee NO es "sin difusion": sin esto la familia se caia del
    // control en silencio y el total daba verde (lo encontro el auditor el 23/09/2026).
    const ciegas = familias.filter((f) => f.bibliotecaExiste === false).map((f) => f.familia);
    const aviso = ciegas.length ? ` | sin leer la biblioteca de: ${ciegas.join(', ')} (revisar la ruta en bomLegajos.data.json)` : '';
    const conDifusion = familias.filter((f) => f.ultimaDifusion !== null);
    if (!conDifusion.length) {
        return ciegas.length
            ? { estado: 'aviso', detalle: 'no se pudo medir' + aviso }
            : { estado: 'no-aplica', detalle: 'ninguna familia registrada tiene PDF de difusion' };
    }
    if (!legajoAlcanzable) {
        return { estado: 'aviso', detalle: 'no se ven los legajos (Y: sin montar): node scripts/_montarDiscos.mjs y volver a medir' };
    }
    const atrasadas = conDifusion.filter((f) => f.ultimoLegajo === null || f.ultimaDifusion > f.ultimoLegajo + TOLERANCIA_MS);
    if (atrasadas.length) {
        return {
            estado: 'falta',
            detalle: 'BOM ultimo nivel sin subir al legajo APQP: ' + atrasadas.map((f) => f.familia).join(', ')
                + ' -> python scripts/_bomLegajo.py <familia> --fecha dd/mm/aaaa --act "..." --apply' + aviso,
        };
    }
    if (ciegas.length) return { estado: 'aviso', detalle: `${conDifusion.length} familia(s) al dia` + aviso };
    return { estado: 'ok', detalle: `${conDifusion.length} familia(s): el legajo tiene la BOM del ultimo cambio` };
}

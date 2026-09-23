/**
 * Saca de los AMFE de Supabase el placeholder "Pendiente definicion equipo APQP".
 *
 * Por que: Fak, 21/09/2026, viendo el PDF del AMFE 131: *"saca esa mierda, no la quiero ni ver
 * en el AMFE"* (regla `amfe.md` §4). Ese dia se limpio solo el 131; el 22/09 quedaban 570 celdas
 * en 16 de los 20 AMFE (438 en optimizationAction). Fak aprobo sacarlas el 22/09/2026
 * ("dale podes arrancar si soluciona todo").
 *
 * QUE HACE: una celda cuyo texto ENTERO es el placeholder (con o sin tilde, "con", "TBD —" adelante
 * o punto final) queda VACIA. Es lo que manda la regla: un AP=H sin accion va con la celda vacia
 * (§4) y un control que falta tambien (§6, "Falta dato -> dejar vacio").
 * Si la celda junta varios controles con " + " (como los junta syncLegacyFmFields), se saca solo
 * el pedazo que es el placeholder y el resto queda igual.
 * QUE NO HACE: si la frase esta ADENTRO de un texto de otra forma, no la toca: la lista al final
 * para que la mire una persona. No toca S, O, D, AP ni ninguna sigla.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (amfe.md §14) y guarda con
 * saveAmfe (stringify + relectura).
 *
 * Uso:
 *   node scripts/_sacarPlaceholderProhibido.mjs            # dry-run, todos los AMFE
 *   node scripts/_sacarPlaceholderProhibido.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';
import { pathToFileURL } from 'node:url';

const { apply } = parseSafeArgs();

const quitarTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Texto ENTERO = placeholder (variantes vistas en los scripts viejos). */
const ES_PLACEHOLDER = /^(tbd\s*[—–-]\s*)?pendiente\s+definicion\s+(con\s+)?(el\s+)?equipo\s+apqp\.?$/i;
const CONTIENE = /pendiente\s+definicion\s+(con\s+)?(el\s+)?equipo\s+apqp/i;

export function esPlaceholder(valor) {
    return typeof valor === 'string' && ES_PLACEHOLDER.test(quitarTildes(valor.trim()));
}

/**
 * Vacia, en el lugar, todo string del arbol cuyo texto entero es el placeholder.
 * Devuelve { vaciadas: [{ruta}], adentroDeTexto: [{ruta, texto}] }.
 */
export function vaciarPlaceholder(nodo, ruta = '', out = { vaciadas: [], adentroDeTexto: [] }) {
    if (Array.isArray(nodo)) {
        nodo.forEach((x, i) => vaciarPlaceholder(x, `${ruta}[${i}]`, out));
    } else if (nodo && typeof nodo === 'object') {
        for (const [k, v] of Object.entries(nodo)) {
            const r = ruta ? `${ruta}.${k}` : k;
            if (typeof v === 'string') {
                if (esPlaceholder(v)) { nodo[k] = ''; out.vaciadas.push({ ruta: r }); continue; }
                // Controles concatenados con " + " (asi los junta syncLegacyFmFields): se saca
                // SOLO el pedazo que es el placeholder y queda el control real, sin tocarlo.
                const partes = v.split(' + ');
                if (partes.length > 1 && partes.some(esPlaceholder)) {
                    nodo[k] = partes.filter((p) => !esPlaceholder(p)).join(' + ');
                    out.vaciadas.push({ ruta: r, recortada: true });
                    continue;
                }
                if (CONTIENE.test(quitarTildes(v))) out.adentroDeTexto.push({ ruta: r, texto: v });
            } else {
                vaciarPlaceholder(v, r, out);
            }
        }
    }
    return out;
}

const esCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (esCli) {
    const sb = await connectSupabase();
    const lista = await listAmfes(sb);
    const plan = [];
    const pendientesDeMirar = [];
    let total = 0;
    const porCampo = {};

    for (const meta of lista) {
        const { doc: before, amfe_number } = await readAmfe(sb, meta.id);
        const after = structuredClone(before);
        const r = vaciarPlaceholder(after);
        for (const x of r.adentroDeTexto) pendientesDeMirar.push({ amfe: amfe_number, ...x });
        if (!r.vaciadas.length) continue;
        for (const v of r.vaciadas) {
            const campo = v.ruta.replace(/\[\d+\]/g, '[]').split('.').slice(-1)[0];
            porCampo[campo] = (porCampo[campo] || 0) + 1;
        }
        total += r.vaciadas.length;
        console.log(`${String(amfe_number).padEnd(22)} ${String(r.vaciadas.length).padStart(4)} celdas`);
        plan.push({ id: meta.id, amfeNumber: amfe_number, productName: meta.project_name, before, after });
    }

    console.log(`\nTOTAL: ${total} celdas en ${plan.length} AMFE`);
    console.log('Por campo:', porCampo);
    if (pendientesDeMirar.length) {
        console.log(`\nNO TOCADAS (la frase esta adentro de un texto mas largo): ${pendientesDeMirar.length}`);
        for (const p of pendientesDeMirar) console.log(`  ${p.amfe} · ${p.ruta}\n    "${p.texto.slice(0, 160)}"`);
    }

    await runWithValidation(plan, apply, async () => {
        for (const c of plan) {
            await saveAmfe(sb, c.id, c.after, { expectedAmfeNumber: c.amfeNumber });
            logChange(apply, `guardado ${c.amfeNumber}`);
        }
    });
    finish(apply);
}

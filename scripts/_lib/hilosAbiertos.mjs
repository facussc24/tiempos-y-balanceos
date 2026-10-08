/**
 * hilosAbiertos.mjs — la logica pura de `scripts/_hilosAbiertos.mjs` (08/10/2026).
 *
 * CASO QUE LO ORIGINO (Fak, 08/10/2026, audio): Carlos habia mandado en un SEGUNDO mail el consumo
 * correcto de un material; la tarea seguia abierta en el Escritorio con el primer mail adentro, y
 * nadie cruzo las dos cosas. *"Como esa puede haber otras, y nunca mas puede volver a pasar"*.
 *
 * La idea: cada tarea del Escritorio nace de uno o mas .msg. Esos .msg fijan el HILO (la clave del
 * asunto sin RE/RV) y la FECHA hasta la que la carpeta esta al dia. Todo mail del cache del buzon
 * (.mail-cache/mails.jsonl) que sea del mismo hilo y POSTERIOR a esa fecha es un mail que la tarea
 * no vio. Se lista al arrancar la sesion.
 *
 * Lo que NO hace: decidir si el mail nuevo cambia la tarea. Eso lo lee la sesion.
 */
import { claveHilo, esRuido } from './mailCache.mjs';

/** 'AAAA-MM-DD HH:MM' (como esta en el cache) o Date -> epoch ms; NaN si no se puede. */
export function fechaMs(f) {
    if (f instanceof Date) return f.getTime();
    const s = String(f ?? '').trim();
    if (!s) return NaN;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)).getTime();
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : NaN;
}

/**
 * Las claves de hilo de una tarea a partir de sus .msg ({ asunto, de, fecha }).
 * Un asunto vacio no define hilo (seria "todos los mails sin asunto").
 */
export function clavesDeTarea(msgs) {
    const claves = new Set();
    for (const m of msgs) {
        const c = claveHilo(m?.asunto ?? '');
        if (c && c.length >= 3) claves.add(c);
    }
    return claves;
}

/** La fecha del .msg mas nuevo de la tarea (epoch ms); 0 si ninguno tiene fecha. */
export function ultimaFechaMsg(msgs) {
    let max = 0;
    for (const m of msgs) {
        const t = fechaMs(m?.fecha);
        if (Number.isFinite(t) && t > max) max = t;
    }
    return max;
}

/**
 * Los mails del cache que son del mismo hilo que la tarea y posteriores a su ultimo .msg.
 * `mails` son los registros livianos de `leerMailsDesde()` ({ fecha, de, de_mail, asunto, carpeta }).
 * Un minuto de tolerancia: el mismo mail guardado como .msg y en el cache puede diferir en segundos.
 */
export function mailsNuevosDelHilo({ claves, desde, mails, toleranciaMs = 60_000 }) {
    if (!claves || !claves.size) return [];
    const out = [];
    for (const m of mails) {
        if (esRuido(m)) continue;
        const c = claveHilo(m.asunto ?? '');
        if (!claves.has(c)) continue;
        const t = fechaMs(m.fecha);
        if (!Number.isFinite(t) || t <= desde + toleranciaMs) continue;
        out.push(m);
    }
    out.sort((a, b) => fechaMs(a.fecha) - fechaMs(b.fecha));
    return out;
}

/**
 * Cruza todas las tareas. `tareas` = [{ nombre, msgs: [{asunto, de, fecha}] }].
 * Devuelve solo las que tienen mails nuevos, con el detalle.
 */
export function cruzarTareas(tareas, mails) {
    const res = [];
    for (const t of tareas) {
        const claves = clavesDeTarea(t.msgs || []);
        if (!claves.size) continue;
        const desde = ultimaFechaMsg(t.msgs);
        const nuevos = mailsNuevosDelHilo({ claves, desde, mails });
        if (!nuevos.length) continue;
        res.push({ nombre: t.nombre, enEspera: !!t.enEspera, desde, nuevos });
    }
    res.sort((a, b) => fechaMs(b.nuevos.at(-1).fecha) - fechaMs(a.nuevos.at(-1).fecha));
    return res;
}

const ddmm = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const corto = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/**
 * Lo que imprime el hook de arranque: nada si no hay nada; si hay, un encabezado y una linea
 * por tarea (hasta `tope`), con el ultimo mail del hilo. Es lo que la sesion lee primero.
 */
export function textoHook(cruce, { tope = 8 } = {}) {
    if (!cruce.length) return '';
    const lineas = [`[HILOS ABIERTOS — ${cruce.length} tarea(s) del Escritorio con mails del mismo hilo que la carpeta no tiene. Detalle: node scripts/_hilosAbiertos.mjs]`];
    for (const t of cruce.slice(0, tope)) {
        const u = t.nuevos.at(-1);
        const n = t.nuevos.length;
        lineas.push(`- ${corto(t.nombre, 60)}${t.enEspera ? ' (en _EN ESPERA)' : ''}: ${n} mail${n === 1 ? '' : 's'} nuevo${n === 1 ? '' : 's'} desde el ${ddmm(t.desde)} · ultimo ${ddmm(fechaMs(u.fecha))} de ${corto(u.de, 24)}: «${corto(u.asunto, 50)}»`);
    }
    if (cruce.length > tope) lineas.push(`- ... y ${cruce.length - tope} mas.`);
    return lineas.join('\n');
}

/** El detalle completo para la consola. */
export function textoDetalle(cruce) {
    if (!cruce.length) return 'Hilos abiertos: ninguna tarea del Escritorio tiene mails nuevos de su hilo.';
    const out = [`Hilos abiertos: ${cruce.length} tarea(s) con mails que la carpeta no tiene\n`];
    for (const t of cruce) {
        out.push(`${t.nombre}${t.enEspera ? '  (en _EN ESPERA)' : ''}`);
        out.push(`  carpeta al dia hasta el ${new Date(t.desde).toLocaleString('es-AR', { hour12: false }).slice(0, 16)}`);
        for (const m of t.nuevos) {
            out.push(`  ${m.fecha}  ${corto(m.de, 28).padEnd(28)}  ${corto(m.asunto, 70)}  [${corto(m.carpeta?.split('/').pop() ?? '', 22)}]`);
        }
        out.push('');
    }
    return out.join('\n');
}

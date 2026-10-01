/**
 * comun.mjs - cosas chicas que comparten `tablero.mjs` e `inventario_resumen.mjs`.
 *
 * Todo lo que llega de la nube es DATO (CONTRATO.md): nunca se usa como ruta, se lee con tope de
 * tamano, y lo que se muestra en un informe pasa antes por `sanitizar` / `celda`.
 * Sin dependencias: solo modulos de Node.
 */
import fs from 'node:fs';
import path from 'node:path';

export const TOPE_JSON_BYTES = 256 * 1024;

/**
 * Lee un JSON sin tirar nunca: devuelve { ok:true, dato } o { ok:false, motivo } con el motivo en
 * castellano simple. Tolera BOM UTF-8 y UTF-16 (el `Out-File` de PowerShell 5.1 escribe UTF-16).
 */
export function leerJson(ruta, tope = TOPE_JSON_BYTES) {
    try {
        const st = fs.statSync(ruta);
        if (!st.isFile()) return { ok: false, motivo: 'no es un archivo' };
        if (st.size === 0) return { ok: false, motivo: 'está vacío' };
        if (st.size > tope) return { ok: false, motivo: 'es demasiado grande' };
        const buf = fs.readFileSync(ruta);
        let texto;
        if (buf[0] === 0xff && buf[1] === 0xfe) texto = buf.subarray(2).toString('utf16le');
        else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) texto = buf.subarray(3).toString('utf8');
        else texto = buf.toString('utf8');
        return { ok: true, dato: JSON.parse(texto) };
    } catch (e) {
        if (e instanceof SyntaxError) return { ok: false, motivo: 'tiene el contenido cortado o roto' };
        return { ok: false, motivo: 'no se pudo abrir' };
    }
}

/** Texto de una sola linea, sin caracteres de control, con tope de largo. */
export function sanitizar(valor, max = 120) {
    const t = String(valor ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return t.length > max ? t.slice(0, max - 1).trimEnd() + '...' : t;
}

/** Para una celda de tabla Markdown: una linea, sin barras ni HTML que rompan o disfracen la tabla. */
export function celda(valor, max = 120) {
    return sanitizar(valor, max).replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const dos = (n) => String(n).padStart(2, '0');

/** dd/mm/aaaa (hora local). */
export function fechaCorta(d) {
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** dd/mm/aaaa hh:mm (hora local). */
export function fechaHora(d) {
    return `${fechaCorta(d)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** dd/mm (para la linea resumen). */
export function diaMes(d) {
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}`;
}

/**
 * Convierte un texto de fecha del contrato ("2026-10-01T18:00:00" o "2026-10-01") en Date, o null.
 * Sin zona horaria vale como hora local de la PC que lo escribio; una fecha sola es medianoche local
 * (no UTC: en Argentina `new Date("2026-10-01")` caeria el dia anterior).
 */
export function leerFecha(valor) {
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
    if (typeof valor !== 'string') return null;
    const t = valor.trim();
    if (!t) return null;
    const solo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    const d = solo ? new Date(Number(solo[1]), Number(solo[2]) - 1, Number(solo[3])) : new Date(t);
    if (Number.isNaN(d.getTime())) return null;
    const anio = d.getFullYear();
    if (anio < 2000 || anio > 2100) return null;
    return d;
}

/** "2026-01-31" -> "31/01/2026"; si no entiende el texto devuelve vacio. */
export function fechaIsoACorta(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(texto ?? ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** 1,9 (coma decimal, una cifra). */
export function decimal(n) {
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

/** "hace 5 horas" / "hace 1,9 días". */
export function hace(dias) {
    if (dias < 0) return 'en el futuro';
    const horas = dias * 24;
    if (horas < 1) return 'hace menos de 1 hora';
    if (horas < 24) {
        const h = Math.round(horas);
        return `hace ${h} hora${h === 1 ? '' : 's'}`;
    }
    return `hace ${decimal(dias)} días`;
}

export function plural(n, uno, varios) {
    return n === 1 ? uno : varios;
}

/** Escribe un archivo de texto sin dejarlo a medias: temporal en la misma carpeta + renombrar. */
export function escribirAtomico(ruta, texto) {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    const tmp = `${ruta}.tmp-${process.pid}`;
    try {
        fs.writeFileSync(tmp, texto, 'utf8');
        fs.renameSync(tmp, ruta);
    } catch (e) {
        try { fs.unlinkSync(tmp); } catch { /* no estaba */ }
        throw e;
    }
}

/** Lee `--clave valor` y `--bandera` de la linea de comandos. */
export function leerArgumentos(argv) {
    const opciones = {};
    const banderas = new Set();
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const nombre = a.slice(2);
        const sig = argv[i + 1];
        if (sig !== undefined && !sig.startsWith('--')) { opciones[nombre] = sig; i++; }
        else banderas.add(nombre);
    }
    return { opciones, banderas };
}

/**
 * Carpeta `4- BUZON` donde las PC dejan salud, avisos e inventario. Sale de `--buzon`, o de la
 * variable CLAUDE_AREA_NUBE (CONTRATO.md). Devuelve null si no hay ninguna de las dos: nunca se
 * adivina la ruta real de la nube.
 */
export function carpetaBuzon(opciones, env = process.env) {
    if (opciones.buzon) return path.resolve(opciones.buzon);
    if (env.CLAUDE_AREA_NUBE) return path.join(path.resolve(env.CLAUDE_AREA_NUBE), '4- BUZON');
    return null;
}

/** "ahora" para los calculos; `--ahora` existe para las pruebas. */
export function ahoraDe(opciones) {
    if (opciones.ahora) {
        const d = leerFecha(opciones.ahora);
        if (d) return d;
    }
    return new Date();
}

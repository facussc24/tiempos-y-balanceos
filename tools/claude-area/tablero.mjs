#!/usr/bin/env node
/**
 * tablero.mjs - le dice al administrador que PC estan al dia y cuales no.
 *
 * Lee `4- BUZON\salud\<pc>.json` (una por PC) y `4- BUZON\avisos\<pc>\*`, y arma `TABLERO.md`:
 * una linea por PC con semaforo en texto, arriba UNA linea resumen y abajo los avisos agrupados.
 * Solo LEE esas carpetas; lo unico que escribe es el TABLERO.md (atomico). No manda nada a nadie.
 *
 * SEMAFORO (plan-maestro 3.3; los bordes: "menos de 2 dias" y "mas de 7 dias" son estrictos)
 *   VERDE     version instalada al dia con la publicada + firma bien + sincronizo hace menos de 2 dias
 *   AMARILLO  atrasada, o sin politica (modo basico), o sin sincronizar entre 2 y 7 dias
 *   ROJO      mas de 7 dias sin sincronizar, firma mal, errores, o el archivo de salud roto / ausente
 * Cuando una PC cae en dos colores gana el peor.
 *
 * USO
 *   node tools/claude-area/tablero.mjs                       arma TABLERO.md en 4- BUZON
 *   node tools/claude-area/tablero.mjs --linea               imprime solo la linea resumen (no escribe nada)
 *   Opciones: --buzon <carpeta 4- BUZON>  --salida <TABLERO.md>  --stdout  --ahora <fecha>
 *   Sin --buzon se usa la variable CLAUDE_AREA_NUBE (CONTRATO.md). Sale con 1 si no encuentra la carpeta.
 *
 * Avisos (formato en CONTRATO.md): un archivo por aviso en `avisos\<pc>\`; JSON con
 * { nivel, tipo, mensaje, cuando } o texto suelto (la primera linea es el mensaje).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    leerJson, sanitizar, celda, fechaCorta, fechaHora, diaMes, leerFecha, hace, plural,
    escribirAtomico, leerArgumentos, carpetaBuzon, ahoraDe,
} from './comun.mjs';

const DIAS_VERDE = 2;      // menos de 2 dias sin sincronizar = verde
const DIAS_ROJO = 7;       // mas de 7 dias sin sincronizar = rojo
const TOPE_AVISOS_JSON = 64 * 1024;
const TOPE_AVISOS_POR_PC = 5000;
const MS_DIA = 86400000;

const ORDEN_ESTADO = { ROJO: 0, AMARILLO: 1, VERDE: 2 };

// ---------------------------------------------------------------------------------------------
// Semaforo de una PC
// ---------------------------------------------------------------------------------------------

function entero(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function cantidadErrores(errores) {
    if (Array.isArray(errores)) return errores.length;
    if (errores === undefined || errores === null || errores === '' || errores === false) return 0;
    return 1;
}

function textoDeError(e) {
    if (e && typeof e === 'object') return sanitizar(e.mensaje ?? e.message ?? JSON.stringify(e), 100);
    return sanitizar(e, 100);
}

/**
 * Clasifica una salud.json ya leida.
 * @param salud objeto del contrato
 * @param ctx { ahora: Date, versionReferencia: number }  (versionReferencia = la mayor "publicada vista" de todas las PC)
 * @returns { estado, motivos:[{nivel:'ROJO'|'AMARILLO', texto, corto}], dias }  dias = dias desde la ultima sync buena (null si no hay)
 */
export function clasificarPc(salud, ctx) {
    const motivos = [];
    const rojo = (texto, corto) => motivos.push({ nivel: 'ROJO', texto, corto });
    const amarillo = (texto, corto) => motivos.push({ nivel: 'AMARILLO', texto, corto });

    // Firma
    if (salud.firma_ok === false) rojo('la firma del paquete no verifica', 'con la firma mal');
    else if (salud.firma_ok !== true) amarillo('no informó si la firma estaba bien', 'sin informar la firma');

    // Sincronizacion
    const ultima = leerFecha(salud.ultima_sync_ok);
    let dias = null;
    if (!ultima) {
        rojo('nunca sincronizó bien (o la fecha no se entiende)', 'sin sincronizar nunca');
    } else {
        dias = (ctx.ahora.getTime() - ultima.getTime()) / MS_DIA;
        const desde = diaMes(ultima);
        if (dias > DIAS_ROJO) rojo(`${hace(dias)} que no sincroniza (desde el ${desde})`, `sin sincronizar desde el ${desde}`);
        else if (dias >= DIAS_VERDE) amarillo(`${hace(dias)} que no sincroniza (desde el ${desde})`, `sin sincronizar desde el ${desde}`);
        else if (dias < -0.25) amarillo('la fecha de su última sincronización está en el futuro (reloj de la PC adelantado)', 'con el reloj adelantado');
    }

    // Errores
    const nErr = cantidadErrores(salud.errores);
    if (nErr > 0) {
        const primero = Array.isArray(salud.errores) ? textoDeError(salud.errores[0]) : textoDeError(salud.errores);
        rojo(`${nErr} error${nErr === 1 ? '' : 'es'}: ${primero}`, 'con errores');
    }

    // Version
    const inst = entero(salud.version_instalada);
    const ref = Math.max(entero(salud.version_publicada_vista), entero(ctx.versionReferencia));
    if (inst < 1) amarillo('todavía no tiene ninguna versión instalada', 'sin versión instalada');
    else if (inst < ref) amarillo(`atrasada: tiene la versión ${inst} y ya hay la ${ref}`, `atrasada (tiene la ${inst}, ya hay la ${ref})`);

    // Politica (modo basico)
    const pol = salud.politica;
    const conPolitica = pol !== undefined && pol !== null && pol !== false && String(pol).trim().toLowerCase() !== 'no' && String(pol).trim() !== '';
    if (!conPolitica) amarillo('sin política instalada (modo básico)', 'sin política');

    const estado = motivos.some((m) => m.nivel === 'ROJO') ? 'ROJO' : motivos.length ? 'AMARILLO' : 'VERDE';
    // Rojos primero, y dentro del color el orden en que se fueron chequeando (firma, sync, errores...).
    motivos.sort((a, b) => ORDEN_ESTADO[a.nivel] - ORDEN_ESTADO[b.nivel]);
    return { estado, motivos, dias };
}

// ---------------------------------------------------------------------------------------------
// Lectura de las carpetas
// ---------------------------------------------------------------------------------------------

function listarArchivos(dir, extension) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isFile() && (!extension || e.name.toLowerCase().endsWith(extension)))
            .map((e) => e.name)
            .sort();
    } catch { return []; }
}

function listarSubcarpetas(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
            .map((e) => e.name)
            .sort();
    } catch { return []; }
}

/** Una entrada por cada `<pc>.json` de la carpeta de salud, leible o no. */
export function leerSalud(dir) {
    const pcs = [];
    for (const nombre of listarArchivos(dir, '.json')) {
        const id = nombre.slice(0, -'.json'.length);
        const r = leerJson(path.join(dir, nombre));
        if (r.ok && r.dato && typeof r.dato === 'object' && !Array.isArray(r.dato)) pcs.push({ id, salud: r.dato, archivo: nombre });
        else pcs.push({ id, salud: null, archivo: nombre, error: r.ok ? 'no tiene el formato de un archivo de salud' : r.motivo });
    }
    return pcs;
}

function normalizarNivel(n) {
    const t = String(n ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (t === 'urgente' || t === 'hoy' || t === 'semanal') return t;
    return 'sin nivel';
}

function tipoDesdeNombre(nombre) {
    const sinExt = nombre.replace(/\.[^.]+$/, '');
    const t = sinExt.replace(/^[\d\-_T:.]+[-_]?/, '').trim();
    return t || 'otros';
}

function avisoDeArchivo(ruta, nombre) {
    let mtime;
    try { mtime = fs.statSync(ruta).mtime; } catch { mtime = null; }
    if (nombre.toLowerCase().endsWith('.json')) {
        const r = leerJson(ruta, TOPE_AVISOS_JSON);
        if (!r.ok) return { error: r.motivo };
        const obj = Array.isArray(r.dato) ? r.dato[0] : r.dato;
        if (!obj || typeof obj !== 'object') return { error: 'no tiene el formato de un aviso' };
        return {
            nivel: normalizarNivel(obj.nivel),
            tipo: sanitizar(obj.tipo || tipoDesdeNombre(nombre), 60) || 'otros',
            mensaje: sanitizar(obj.mensaje ?? obj.texto ?? '', 200) || '(sin texto)',
            cuando: leerFecha(obj.cuando) || mtime,
        };
    }
    try {
        const buf = Buffer.alloc(2048);
        const fd = fs.openSync(ruta, 'r');
        let n = 0;
        try { n = fs.readSync(fd, buf, 0, buf.length, 0); } finally { fs.closeSync(fd); }
        const linea = buf.subarray(0, n).toString('utf8').split(/\r?\n/).map((l) => l.replace(/^#+\s*/, '').trim()).find((l) => l) || '';
        return { nivel: 'sin nivel', tipo: sanitizar(tipoDesdeNombre(nombre), 60) || 'otros', mensaje: sanitizar(linea, 200) || '(sin texto)', cuando: mtime };
    } catch { return { error: 'no se pudo abrir' }; }
}

/**
 * Lee los avisos. Con `contenido:false` solo mira que carpetas hay (para la linea del hook, que
 * tiene que ser rapida).
 */
export function leerAvisos(dir, { contenido = true } = {}) {
    const pcs = listarSubcarpetas(dir);
    const avisos = [];
    const ilegibles = [];
    const recortados = [];
    if (!contenido) return { pcs, avisos, ilegibles, recortados };
    for (const pc of pcs) {
        const carpeta = path.join(dir, pc);
        let nombres = listarArchivos(carpeta);
        if (nombres.length > TOPE_AVISOS_POR_PC) {
            recortados.push({ pc, total: nombres.length });
            nombres = nombres.slice(-TOPE_AVISOS_POR_PC);   // los nombres llevan fecha: quedan los ultimos
        }
        for (const nombre of nombres) {
            const a = avisoDeArchivo(path.join(carpeta, nombre), nombre);
            if (a.error) ilegibles.push({ lugar: `avisos/${pc}/${nombre}`, motivo: a.error });
            else avisos.push({ pc, ...a });
        }
    }
    return { pcs, avisos, ilegibles, recortados };
}

/** Junta los avisos iguales: mismo nivel + tipo + PC = una linea con el conteo. */
export function agruparAvisos(avisos) {
    const grupos = new Map();
    for (const a of avisos) {
        const clave = [a.nivel, a.tipo.toLowerCase(), a.pc.toLowerCase()].join('\u0000');
        let g = grupos.get(clave);
        if (!g) { g = { nivel: a.nivel, tipo: a.tipo, pc: a.pc, cantidad: 0, mensajes: new Set(), ultimo: null, ultimoMensaje: '' }; grupos.set(clave, g); }
        g.cantidad++;
        g.mensajes.add(a.mensaje);
        if (!g.ultimo || (a.cuando && a.cuando > g.ultimo)) { g.ultimo = a.cuando || g.ultimo; g.ultimoMensaje = a.mensaje; }
        if (!g.ultimoMensaje) g.ultimoMensaje = a.mensaje;
    }
    return [...grupos.values()];
}

// ---------------------------------------------------------------------------------------------
// Armado del tablero
// ---------------------------------------------------------------------------------------------

/** "12 PC: 10 verdes, 1 amarilla, 1 roja: compras-02 sin sincronizar desde el 24/09" */
export function lineaResumen(filas) {
    const n = filas.length;
    if (n === 0) return 'Sin PC: todavía no llegó ningún archivo de salud.';
    const cuenta = (e) => filas.filter((f) => f.estado === e).length;
    const v = cuenta('VERDE'), a = cuenta('AMARILLO'), r = cuenta('ROJO');
    const partes = [];
    if (v === n && n > 1) partes.push('todas verdes');
    else {
        if (v) partes.push(`${v} ${plural(v, 'verde', 'verdes')}`);
        if (a) partes.push(`${a} ${plural(a, 'amarilla', 'amarillas')}`);
        if (r) partes.push(`${r} ${plural(r, 'roja', 'rojas')}`);
    }
    let linea = `${n} PC: ${partes.join(', ')}`;
    // Se nombran las rojas; si no hay ninguna, las amarillas. Tope 3 para que entre en una linea.
    const nombrar = r ? filas.filter((f) => f.estado === 'ROJO') : filas.filter((f) => f.estado === 'AMARILLO');
    if (nombrar.length) {
        nombrar.sort((x, y) => (y.dias ?? Infinity) - (x.dias ?? Infinity) || x.pc.localeCompare(y.pc));
        const primeras = nombrar.slice(0, 3).map((f) => `${f.pc} ${f.motivos[0].corto}`);
        const resto = nombrar.length - primeras.length;
        linea += `: ${primeras.join('; ')}${resto > 0 ? ` y ${resto} más` : ''}`;
    }
    return linea;
}

/**
 * Junta todo y devuelve { filas, linea, markdown, ilegibles }.
 * @param entradas { saludDir, avisosDir, ahora, soloLinea }
 */
export function armarTablero({ saludDir, avisosDir, ahora = new Date(), soloLinea = false }) {
    const leidas = leerSalud(saludDir);
    const ilegibles = [];

    const versionReferencia = Math.max(0, ...leidas.filter((p) => p.salud).map((p) => entero(p.salud.version_publicada_vista)));
    const filas = [];
    const vistos = new Set();
    for (const p of leidas) {
        vistos.add(p.id.toLowerCase());
        if (!p.salud) {
            ilegibles.push({ lugar: `salud/${p.archivo}`, motivo: p.error });
            filas.push({
                pc: sanitizar(p.id, 60), area: '', usuario: '', estado: 'ROJO', dias: null, ultimaSync: null, salud: null,
                motivos: [{ nivel: 'ROJO', texto: `no se pudo leer su archivo de salud (${p.error})`, corto: 'con el archivo de salud roto' }],
            });
            continue;
        }
        const c = clasificarPc(p.salud, { ahora, versionReferencia });
        const pcDeclarada = sanitizar(p.salud.pc, 60);
        if (pcDeclarada && pcDeclarada.toLowerCase() !== p.id.toLowerCase()) {
            c.motivos.push({ nivel: 'AMARILLO', texto: `el archivo se llama ${sanitizar(p.id, 60)} pero dice ser de ${pcDeclarada}`, corto: 'con el archivo a nombre de otra PC' });
            if (c.estado === 'VERDE') c.estado = 'AMARILLO';
            c.motivos.sort((x, y) => ORDEN_ESTADO[x.nivel] - ORDEN_ESTADO[y.nivel]);
        }
        filas.push({
            pc: sanitizar(p.id, 60), area: sanitizar(p.salud.area, 30), usuario: sanitizar(p.salud.usuario_windows, 40),
            estado: c.estado, dias: c.dias, ultimaSync: leerFecha(p.salud.ultima_sync_ok), motivos: c.motivos,
            versionInstalada: entero(p.salud.version_instalada),
            versionPublicada: Math.max(entero(p.salud.version_publicada_vista), versionReferencia), salud: p.salud,
        });
    }

    // PC que dejaron avisos pero nunca mandaron su archivo de salud
    const avisosLeidos = leerAvisos(avisosDir, { contenido: !soloLinea });
    for (const pc of avisosLeidos.pcs) {
        if (vistos.has(pc.toLowerCase())) continue;
        filas.push({
            pc: sanitizar(pc, 60), area: '', usuario: '', estado: 'ROJO', dias: null, ultimaSync: null, salud: null,
            motivos: [{ nivel: 'ROJO', texto: 'dejó avisos pero no tiene archivo de salud', corto: 'sin archivo de salud (solo dejó avisos)' }],
        });
    }

    filas.sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || (b.dias ?? Infinity) - (a.dias ?? Infinity) || a.pc.localeCompare(b.pc));
    const linea = lineaResumen(filas);
    if (soloLinea) return { filas, linea, markdown: '', ilegibles };

    ilegibles.push(...avisosLeidos.ilegibles);
    const markdown = escribirMarkdown({ filas, linea, avisosLeidos, ilegibles, ahora });
    return { filas, linea, markdown, ilegibles };
}

function textoMotivos(f) {
    if (!f.motivos.length) return '';
    return f.motivos.map((m) => m.texto).join('; ');
}

function textoSync(f) {
    if (!f.ultimaSync) return 'nunca';
    return `${fechaHora(f.ultimaSync)} (${hace(f.dias)})`;
}

function escribirMarkdown({ filas, linea, avisosLeidos, ilegibles, ahora }) {
    const L = [];
    L.push('# Tablero de las PC con Claude');
    L.push('');
    L.push(`**${linea}**`);
    L.push('');
    L.push(`Armado el ${fechaCorta(ahora)} a las ${fechaHora(ahora).slice(-5)}.`);
    L.push('');
    L.push('Cómo se lee: **VERDE** = tiene la última versión, la firma está bien y sincronizó hace menos de 2 días. '
        + '**AMARILLO** = está atrasada, no tiene política instalada o hace entre 2 y 7 días que no sincroniza. '
        + '**ROJO** = hace más de 7 días que no sincroniza, la firma está mal o hay errores. Cuando una PC cae en dos colores, vale el peor.');
    L.push('');
    L.push('## Estado de cada PC');
    L.push('');
    if (!filas.length) {
        L.push('Todavía no llegó ningún archivo de salud.');
    } else {
        L.push('| Estado | PC | Área | Usuario | Versión | Última sincronización | Motivo |');
        L.push('|---|---|---|---|---|---|---|');
        for (const f of filas) {
            const atras = f.versionInstalada && f.versionInstalada < f.versionPublicada ? ` (ya hay la ${f.versionPublicada})` : '';
            const version = f.salud ? (f.versionInstalada ? `${f.versionInstalada}${atras}` : '-') : '-';
            L.push(`| ${f.estado} | ${celda(f.pc, 60)} | ${celda(f.area || '-', 30)} | ${celda(f.usuario || '-', 40)} | ${version} | ${f.salud ? textoSync(f) : '-'} | ${celda(textoMotivos(f) || '-', 300)} |`);
        }
        // Datos del entorno: informativos, no cambian el color.
        const conDatos = filas.filter((f) => f.salud);
        if (conDatos.length) {
            L.push('');
            L.push('## Cómo está cada PC por dentro');
            L.push('');
            L.push('Son datos para mirar; no cambian el color.');
            L.push('');
            L.push('| PC | Outlook | Python | Ve Y: | Ve Z: | Disco libre | Política |');
            L.push('|---|---|---|---|---|---|---|');
            for (const f of conDatos) {
                const s = f.salud;
                const sn = (v) => (v === true ? 'sí' : v === false ? 'no' : '-');
                const outlook = ({ clasico: 'clásico', nuevo: 'nuevo', cerrado: 'cerrado', no: 'no tiene' })[String(s.outlook ?? '').toLowerCase()] ?? s.outlook ?? '-';
                const politica = ({ si: 'sí', no: 'no' })[String(s.politica ?? '').toLowerCase()] ?? s.politica ?? '-';
                const disco = Number.isFinite(Number(s.disco_libre_gb)) && s.disco_libre_gb !== null && s.disco_libre_gb !== '' ? `${Math.round(Number(s.disco_libre_gb))} GB` : '-';
                L.push(`| ${celda(f.pc, 60)} | ${celda(outlook || '-', 20)} | ${sn(s.python)} | ${sn(s.ve_Y)} | ${sn(s.ve_Z)} | ${disco} | ${celda(politica || '-', 20)} |`);
            }
        }
    }

    L.push('');
    L.push('## Avisos');
    L.push('');
    const grupos = agruparAvisos(avisosLeidos.avisos);
    if (!grupos.length) {
        L.push('No hay avisos.');
    } else {
        const pcsConAvisos = new Set(avisosLeidos.avisos.map((a) => a.pc.toLowerCase())).size;
        L.push(`${avisosLeidos.avisos.length} ${plural(avisosLeidos.avisos.length, 'aviso', 'avisos')} de ${pcsConAvisos} ${plural(pcsConAvisos, 'PC', 'PC')}. Lo que se repite va en una sola línea con el conteo.`);
        const niveles = [['urgente', 'Urgente'], ['hoy', 'Para mirar hoy'], ['semanal', 'Semanal'], ['sin nivel', 'Sin nivel indicado']];
        for (const [nivel, titulo] of niveles) {
            const delNivel = grupos.filter((g) => g.nivel === nivel);
            if (!delNivel.length) continue;
            L.push('');
            L.push(`### ${titulo}`);
            const tipos = [...new Set(delNivel.map((g) => g.tipo.toLowerCase()))].sort();
            for (const tipoClave of tipos) {
                const delTipo = delNivel.filter((g) => g.tipo.toLowerCase() === tipoClave).sort((a, b) => a.pc.localeCompare(b.pc));
                L.push('');
                L.push(`**${celda(delTipo[0].tipo, 60)}**`);
                for (const g of delTipo) {
                    const distintos = g.mensajes.size > 1 ? ` con ${g.mensajes.size} textos distintos` : '';
                    const veces = g.cantidad > 1
                        ? ` (${g.cantidad} veces${distintos}${g.ultimo ? `, el último el ${fechaCorta(g.ultimo)}` : ''})`
                        : (g.ultimo ? ` (${fechaCorta(g.ultimo)})` : '');
                    L.push(`- ${celda(g.pc, 60)}: ${celda(g.ultimoMensaje, 200)}${veces}`);
                }
            }
        }
    }
    for (const r of avisosLeidos.recortados) {
        L.push('');
        L.push(`Ojo: ${celda(r.pc, 60)} tiene ${r.total} archivos de avisos; se leyeron solo los últimos ${TOPE_AVISOS_POR_PC}.`);
    }

    if (ilegibles.length) {
        L.push('');
        L.push('## Archivos que no se pudieron leer');
        L.push('');
        L.push('Para que no se pierdan: no frenan el tablero, pero conviene mirarlos.');
        L.push('');
        for (const i of ilegibles) L.push(`- ${celda(i.lugar, 150)}: ${celda(i.motivo, 100)}`);
    }
    L.push('');
    return L.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Linea de comandos
// ---------------------------------------------------------------------------------------------

function main(argv) {
    const { opciones, banderas } = leerArgumentos(argv);
    const buzon = carpetaBuzon(opciones);
    if (!buzon) {
        console.error('No sé dónde están las carpetas de las PC. Pasá --buzon <carpeta> o definí la variable CLAUDE_AREA_NUBE.');
        return 1;
    }
    const saludDir = path.join(buzon, 'salud');
    const avisosDir = path.join(buzon, 'avisos');
    if (!fs.existsSync(saludDir)) {
        console.error('No encuentro la carpeta de salud de las PC (¿la nube está sincronizada?).');
        return 1;
    }
    const ahora = ahoraDe(opciones);
    const soloLinea = banderas.has('linea');
    const t = armarTablero({ saludDir, avisosDir, ahora, soloLinea });
    if (soloLinea) { console.log(t.linea); return 0; }
    if (banderas.has('stdout')) { console.log(t.markdown); return 0; }
    const salida = opciones.salida ? path.resolve(opciones.salida) : path.join(buzon, 'TABLERO.md');
    escribirAtomico(salida, t.markdown);
    console.log(t.linea);
    console.log(`Tablero escrito: ${salida}`);
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}

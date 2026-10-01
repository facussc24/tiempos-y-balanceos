#!/usr/bin/env node
/**
 * inventario_resumen.mjs - junta las listas de programas de todas las PC en un INVENTARIO.md.
 *
 * Lee `4- BUZON\inventario\<pc>.json` (lo que escribe `inventario.ps1`) y, si existe,
 * `4- BUZON\conocidos.json` (la lista que mantiene el administrador). Arma `INVENTARIO.md`:
 * cuantas PC hay, cada programa con en cuantas PC esta y que versiones, los que estan en una sola
 * PC y los que NO figuran en la lista de conocidos.
 *
 * El informe DESCRIBE. No recomienda sacar nada ni dice que algo "sobra": toda decision sobre un
 * programa la toma una persona (plan-maestro 7.4, vacio G2). Solo lee; lo unico que escribe es el
 * INVENTARIO.md (atomico).
 *
 * conocidos.json (lo carga el administrador; formato en CONTRATO.md):
 *   { "conocidos": [ { "nombre": "TeamViewer*", "para_que": "Soporte remoto de IT" },
 *                    { "patron": "^Microsoft Visual C\\+\\+ .* Redistributable", "para_que": "..." } ] }
 *   "nombre" es el nombre del programa (sin distinguir mayusculas); un * vale por cualquier texto.
 *   "patron" es una expresion regular para quien la sepa escribir.
 *
 * USO
 *   node tools/claude-area/inventario_resumen.mjs
 *   Opciones: --buzon <4- BUZON>  --inventario <carpeta>  --conocidos <archivo>  --salida <INVENTARIO.md>
 *             --stdout  --ahora <fecha>
 *   Sin --buzon se usa la variable CLAUDE_AREA_NUBE (CONTRATO.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    leerJson, sanitizar, celda, fechaCorta, leerFecha, plural,
    escribirAtomico, leerArgumentos, carpetaBuzon, ahoraDe,
} from './comun.mjs';

const DIAS_LISTA_VIEJA = 14;
const MS_DIA = 86400000;
const MAX_VERSIONES = 6;
const MAX_PC_NOMBRADAS = 5;

const colapsar = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// ---------------------------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------------------------

/** Lee todos los `*.json` de la carpeta de inventario. Un archivo roto se reporta y no frena al resto. */
export function leerInventarios(dir) {
    const pcs = [];
    const ilegibles = [];
    let nombres = [];
    try {
        nombres = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json')).map((e) => e.name).sort();
    } catch { /* carpeta inexistente: queda vacio */ }

    for (const archivo of nombres) {
        const r = leerJson(path.join(dir, archivo), 8 * 1024 * 1024);
        if (!r.ok) { ilegibles.push({ lugar: `inventario/${archivo}`, motivo: r.motivo }); continue; }
        const d = r.dato;
        if (!d || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.programas)) {
            ilegibles.push({ lugar: `inventario/${archivo}`, motivo: 'no tiene el formato de una lista de programas' });
            continue;
        }
        const programas = [];
        let sinNombre = 0;
        for (const p of d.programas) {
            if (!p || typeof p !== 'object' || typeof p.nombre !== 'string' || !sanitizar(p.nombre)) { sinNombre++; continue; }
            programas.push({
                nombre: sanitizar(p.nombre, 150),
                version: sanitizar(p.version, 60),
                editor: sanitizar(p.editor, 80),
                instalado: sanitizar(p.instalado, 20),
                alcance: p.alcance === 'usuario' ? 'usuario' : 'maquina',
            });
        }
        if (sinNombre) ilegibles.push({ lugar: `inventario/${archivo}`, motivo: `${sinNombre} ${plural(sinNombre, 'renglón', 'renglones')} sin nombre de programa (se salteó)` });
        const id = sanitizar(d.pc, 60) || sanitizar(archivo.replace(/\.json$/i, ''), 60);
        pcs.push({ id, archivo, usuario: sanitizar(d.usuario_windows, 40), relevado: leerFecha(d.relevado), programas });
    }

    // Dos archivos de la misma PC (por ejemplo una copia en conflicto de la nube): vale el mas nuevo.
    const porPc = new Map();
    const repetidas = [];
    for (const p of pcs) {
        const k = p.id.toLowerCase();
        const previa = porPc.get(k);
        if (!previa) { porPc.set(k, p); continue; }
        const nueva = (p.relevado?.getTime() ?? 0) > (previa.relevado?.getTime() ?? 0) ? p : previa;
        const vieja = nueva === p ? previa : p;
        porPc.set(k, nueva);
        repetidas.push({ lugar: `inventario/${vieja.archivo}`, motivo: `es otra lista de ${vieja.id}; se usó la más nueva (${nueva.archivo})` });
    }
    ilegibles.push(...repetidas);
    return { pcs: [...porPc.values()].sort((a, b) => a.id.localeCompare(b.id)), ilegibles };
}

function regexDeNombre(nombre) {
    const partes = colapsar(nombre).split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`^${partes.join('.*')}$`, 'i');
}

/** Lee `conocidos.json`. Devuelve { existe, entradas:[{ coincide(nombre), paraQue }], problemas }. */
export function leerConocidos(ruta) {
    const res = { existe: false, entradas: [], problemas: [] };
    if (!ruta || !fs.existsSync(ruta)) return res;
    res.existe = true;
    const r = leerJson(ruta);
    if (!r.ok) { res.problemas.push(`conocidos.json: ${r.motivo}`); return res; }
    const lista = Array.isArray(r.dato) ? r.dato : r.dato?.conocidos;
    if (!Array.isArray(lista)) { res.problemas.push('conocidos.json: no tiene la lista "conocidos"'); return res; }
    lista.forEach((e, i) => {
        if (!e || typeof e !== 'object') { res.problemas.push(`conocidos.json: el renglón ${i + 1} no se entiende`); return; }
        const paraQue = sanitizar(e.para_que ?? e.uso ?? '', 200);
        try {
            if (typeof e.patron === 'string' && e.patron.trim()) {
                const re = new RegExp(e.patron, 'i');
                res.entradas.push({ coincide: (n) => re.test(n), paraQue });
            } else if (typeof e.nombre === 'string' && e.nombre.trim()) {
                const re = regexDeNombre(e.nombre);
                res.entradas.push({ coincide: (n) => re.test(colapsar(n)), paraQue });
            } else {
                res.problemas.push(`conocidos.json: el renglón ${i + 1} no tiene "nombre" ni "patron"`);
            }
        } catch {
            res.problemas.push(`conocidos.json: el renglón ${i + 1} tiene un patrón que no se puede usar (se salteó)`);
        }
    });
    return res;
}

// ---------------------------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------------------------

/**
 * Agrupa por programa (mismo nombre, sin distinguir mayusculas ni espacios de mas).
 * Devuelve la lista ordenada por nombre.
 */
export function contarProgramas(pcs, conocidos) {
    const mapa = new Map();
    for (const pc of pcs) {
        for (const p of pc.programas) {
            const clave = colapsar(p.nombre);
            let g = mapa.get(clave);
            if (!g) {
                g = { nombre: p.nombre, pcs: new Set(), versiones: new Map(), editores: new Set(), alcances: new Set(), paraQue: null, conocido: false };
                mapa.set(clave, g);
            }
            g.pcs.add(pc.id);
            if (p.editor) g.editores.add(p.editor);
            g.alcances.add(p.alcance);
            const v = p.version || '(sin versión)';
            if (!g.versiones.has(v)) g.versiones.set(v, new Set());
            g.versiones.get(v).add(pc.id);
        }
    }
    const lista = [...mapa.values()];
    for (const g of lista) {
        const hit = conocidos.entradas.find((e) => e.coincide(g.nombre));
        if (hit) { g.conocido = true; g.paraQue = hit.paraQue; }
    }
    return lista.sort((a, b) => colapsar(a.nombre).localeCompare(colapsar(b.nombre)));
}

function textoVersiones(g) {
    const orden = [...g.versiones.entries()].sort((a, b) => b[1].size - a[1].size || b[0].localeCompare(a[0], undefined, { numeric: true }));
    const mostrar = orden.slice(0, MAX_VERSIONES).map(([v, set]) => (g.versiones.size === 1 ? v : `${v} (${set.size} PC)`));
    const resto = orden.length - mostrar.length;
    return mostrar.join(', ') + (resto > 0 ? ` y ${resto} más` : '');
}

function textoPcs(g, tope = MAX_PC_NOMBRADAS) {
    const nombres = [...g.pcs].sort((a, b) => a.localeCompare(b));
    if (nombres.length <= tope) return nombres.join(', ');
    return `${nombres.slice(0, tope).join(', ')} y ${nombres.length - tope} más`;
}

// ---------------------------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------------------------

export function armarInforme({ pcs, ilegibles = [], conocidos, ahora = new Date() }) {
    const programas = contarProgramas(pcs, conocidos);
    const nPc = pcs.length;
    const sinClasificar = programas.filter((g) => !g.conocido);
    const enUnaPc = programas.filter((g) => g.pcs.size === 1);

    const L = [];
    L.push('# Programas instalados en las PC');
    L.push('');
    L.push(`Armado el ${fechaCorta(ahora)}.`);
    L.push('');
    L.push('Esto es una foto de los programas que cada PC dijo tener. Solo describe lo que hay: no dice que algo esté de más ni que haya que sacarlo. Cualquier decisión sobre un programa la toma una persona.');
    L.push('');
    L.push('Qué se junta de cada PC: nombre del programa, versión, editor, fecha de instalación y si está para toda la PC o solo para un usuario. No se junta nada de los archivos, del historial ni de lo que usa la persona. Esta lista la ve solamente el administrador.');
    L.push('');

    if (!nPc) {
        L.push('Todavía no hay ninguna lista de programas.');
    } else {
        L.push('## En números');
        L.push('');
        L.push(`- PC con lista de programas: ${nPc}`);
        L.push(`- Programas distintos: ${programas.length}`);
        if (conocidos.existe) {
            L.push(`- Programas que figuran en la lista de conocidos: ${programas.length - sinClasificar.length}`);
            L.push(`- Programas que no figuran en la lista de conocidos: ${sinClasificar.length}`);
        } else {
            L.push('- Todavía no hay lista de conocidos (el archivo conocidos.json), así que no se separan los programas por ese lado.');
        }
        L.push(nPc > 1 ? `- Programas que están en una sola PC: ${enUnaPc.length}` : '- Con una sola PC no se puede comparar qué programas están en una sola.');
        L.push('');

        L.push('## PC relevadas');
        L.push('');
        L.push('| PC | Usuario | Relevada el | Programas |');
        L.push('|---|---|---|---|');
        for (const p of pcs) {
            let cuando = p.relevado ? fechaCorta(p.relevado) : 'sin fecha';
            if (p.relevado && (ahora.getTime() - p.relevado.getTime()) / MS_DIA > DIAS_LISTA_VIEJA) cuando += ` (hace más de ${DIAS_LISTA_VIEJA} días)`;
            L.push(`| ${celda(p.id, 60)} | ${celda(p.usuario || '-', 40)} | ${cuando} | ${p.programas.length} |`);
        }
        L.push('');

        if (conocidos.existe) {
            L.push('## Programas que no figuran en la lista de conocidos');
            L.push('');
            L.push('Que un programa esté acá no quiere decir que esté mal: quiere decir que nadie lo cargó todavía en conocidos.json con su "para qué es". Para sumarlo, se agrega a esa lista.');
            L.push('');
            if (!sinClasificar.length) {
                L.push('Todos los programas figuran en la lista de conocidos.');
            } else {
                L.push('| Programa | Editor | En cuántas PC | Cuáles | Versiones |');
                L.push('|---|---|---|---|---|');
                for (const g of sinClasificar) {
                    L.push(`| ${celda(g.nombre, 150)} | ${celda([...g.editores].join(', ') || '-', 80)} | ${g.pcs.size} de ${nPc} | ${celda(textoPcs(g), 120)} | ${celda(textoVersiones(g), 160)} |`);
                }
            }
            L.push('');
        }

        if (nPc > 1) {
            L.push('## Programas que están en una sola PC');
            L.push('');
            if (!enUnaPc.length) {
                L.push('Ningún programa está en una sola PC.');
            } else {
                L.push('| Programa | PC | Versión | Para qué es (según conocidos.json) |');
                L.push('|---|---|---|---|');
                for (const g of enUnaPc) {
                    const para = g.conocido ? (g.paraQue || 'figura en conocidos, sin aclaración') : (conocidos.existe ? 'no figura' : '-');
                    L.push(`| ${celda(g.nombre, 150)} | ${celda(textoPcs(g), 60)} | ${celda(textoVersiones(g), 80)} | ${celda(para, 200)} |`);
                }
            }
            L.push('');
        }

        L.push('## Lista completa');
        L.push('');
        L.push('Un programa por renglón. Si el nombre de un programa trae la versión adentro, cada versión sale como un renglón distinto.');
        L.push('');
        L.push('| Programa | En cuántas PC | Versiones | Para qué es (según conocidos.json) |');
        L.push('|---|---|---|---|');
        for (const g of programas) {
            const para = g.conocido ? (g.paraQue || 'figura en conocidos, sin aclaración') : (conocidos.existe ? 'no figura' : '-');
            L.push(`| ${celda(g.nombre, 150)} | ${g.pcs.size} de ${nPc} | ${celda(textoVersiones(g), 160)} | ${celda(para, 200)} |`);
        }
        L.push('');
    }

    const avisos = [...conocidos.problemas.map((m) => ({ lugar: 'conocidos.json', motivo: m.replace(/^conocidos\.json:\s*/, '') })), ...ilegibles];
    if (avisos.length) {
        L.push('## Archivos o renglones que no se pudieron usar');
        L.push('');
        L.push('No frenan el informe, pero conviene mirarlos.');
        L.push('');
        for (const a of avisos) L.push(`- ${celda(a.lugar, 150)}: ${celda(a.motivo, 200)}`);
        L.push('');
    }

    return {
        markdown: L.join('\n'),
        resumen: { pcs: nPc, programas: programas.length, sinClasificar: conocidos.existe ? sinClasificar.length : null, enUnaPc: nPc > 1 ? enUnaPc.length : null },
        programas,
    };
}

// ---------------------------------------------------------------------------------------------
// Linea de comandos
// ---------------------------------------------------------------------------------------------

function main(argv) {
    const { opciones, banderas } = leerArgumentos(argv);
    const buzon = carpetaBuzon(opciones);
    const dirInventario = opciones.inventario ? path.resolve(opciones.inventario) : (buzon ? path.join(buzon, 'inventario') : null);
    if (!dirInventario) {
        console.error('No sé dónde están las listas de programas. Pasá --inventario <carpeta> (o --buzon <carpeta>) o definí la variable CLAUDE_AREA_NUBE.');
        return 1;
    }
    if (!fs.existsSync(dirInventario)) {
        console.error('No encuentro la carpeta con las listas de programas (¿la nube está sincronizada?).');
        return 1;
    }
    const rutaConocidos = opciones.conocidos ? path.resolve(opciones.conocidos) : (buzon ? path.join(buzon, 'conocidos.json') : path.join(path.dirname(dirInventario), 'conocidos.json'));
    const { pcs, ilegibles } = leerInventarios(dirInventario);
    const conocidos = leerConocidos(rutaConocidos);
    const inf = armarInforme({ pcs, ilegibles, conocidos, ahora: ahoraDe(opciones) });
    if (banderas.has('stdout')) { console.log(inf.markdown); return 0; }
    const salida = opciones.salida ? path.resolve(opciones.salida) : path.join(buzon ?? path.dirname(dirInventario), 'INVENTARIO.md');
    escribirAtomico(salida, inf.markdown);
    console.log(`${inf.resumen.pcs} PC, ${inf.resumen.programas} programas distintos.`);
    console.log(`Informe escrito: ${salida}`);
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}

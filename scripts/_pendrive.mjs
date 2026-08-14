/**
 * _pendrive.mjs — "pasame lo ultimo de X al pendrive".
 *
 * SIN shebang a proposito (ver `__tests__/scripts/convencionesScripts.test.mjs`).
 *
 * POR QUE EXISTE: el 14/08/2026 ese pedido —dos archivos al pendrive, sacar los dos viejos—
 * tardo 20 minutos. Ocho fueron buscar donde habian quedado, cinco mirar en las carpetas
 * equivocadas, cuatro pelear con PowerShell. Trabajo real: tres.
 *
 * USO
 *   node scripts/_pendrive.mjs "<pieza> plotter"            # muestra el plan, no toca nada
 *   node scripts/_pendrive.mjs "<pieza> plotter" --aplicar  # copia y saca lo superado
 *   node scripts/_pendrive.mjs --unidades                   # que hay conectado
 *
 * LAS TRES COSAS QUE HACE, Y POR QUE ASI
 *   1. BUSCAR: delega en `_entregas.mjs`. No arma su propio arbol — si el indice y el
 *      copiador buscan distinto, tarde o temprano copian cosas distintas.
 *   2. DETECTAR la unidad extraible sola. Si hay mas de una, las muestra y NO adivina:
 *      copiar al pendrive equivocado no avisa, y el archivo se entrega igual.
 *   3. COPIAR con md5 y, antes de sacar lo superado, dejarlo en la carpeta de la tarea.
 *      El pendrive no tiene Papelera: lo que se borra ahi no vuelve. Por eso lo viejo se
 *      MUEVE (copia -> verifica -> borra), nunca se borra y despues se ve.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { relevar, familiaEntregable, fmtFecha, cortar } from './_entregas.mjs';
import { unidadesExtraibles } from './_lib/powershell.mjs';
import { copiarVerificado, moverVerificado, revisarDestino, nombreLibre } from './_lib/copiaVerificada.mjs';

const c = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
const say = (s = '') => console.log(s);

/** Carpeta donde se guarda lo que se saca del pendrive. Va DENTRO de la carpeta de la tarea. */
export const CARPETA_SUPERADOS = 'SUPERADOS - salieron del pendrive';

// ─────────────────────────────────────────────────────────────────────────────
// Funciones puras (las ejerce __tests__/scripts/pendrive.test.mjs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Que hay en el pendrive que quede SUPERADO por lo que vamos a copiar.
 *
 * Superado = misma familia de documento (`familiaEntregable`) pero distinto archivo. Un
 * RevA cuando entra el RevB queda superado; un DXF de otra pieza no. Que sea la MISMA
 * funcion que usa el indice es lo que evita que "lo viejo" signifique dos cosas distintas.
 */
export function superadosPor(entrantes, enPendrive) {
    const familias = new Map(entrantes.map((e) => [familiaEntregable(e.nombre), e.nombre]));
    return enPendrive
        .filter((p) => {
            const f = familiaEntregable(p.nombre);
            return familias.has(f) && familias.get(f) !== p.nombre;
        })
        .map((p) => ({ ...p, reemplazadoPor: familias.get(familiaEntregable(p.nombre)) }));
}

/** Los que ya estan en el pendrive con el mismo nombre: no hay nada que copiar. */
export const yaEstan = (entrantes, enPendrive) => {
    const nombres = new Set(enPendrive.map((p) => p.nombre.toLowerCase()));
    return entrantes.filter((e) => nombres.has(e.nombre.toLowerCase()));
};

// ─────────────────────────────────────────────────────────────────────────────
// Unidad
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La unidad a la que copiar. Devuelve `{unidad}` o `{error}` — nunca elige por su cuenta
 * entre varias: la letra cambia de un dia para el otro y no hay forma de saber cual es "la"
 * sin mirar la etiqueta.
 */
export function elegirUnidad(unidades, pedida = null) {
    if (pedida) {
        const q = String(pedida).replace(/[:\\/]+$/, '').toLowerCase();
        const u = unidades.find((v) => v.letra.toLowerCase().startsWith(q) || v.etiqueta.toLowerCase().includes(q));
        return u ? { unidad: u } : { error: `no encontre una unidad extraible que sea "${pedida}"` };
    }
    if (unidades.length === 0) return { error: 'no hay ninguna unidad extraible conectada. Enchufá el pendrive.' };
    if (unidades.length === 1) return { unidad: unidades[0] };
    return { error: `hay ${unidades.length} unidades extraibles conectadas. Elegí con --unidad <letra o etiqueta>.` };
}

const listarUnidades = (unidades) => {
    if (!unidades.length) { say(`${c.y}⚠${c.x}  no hay ninguna unidad extraible conectada.`); return; }
    for (const u of unidades) {
        say(`  ${c.b}${u.letra}${c.x}  ${u.etiqueta}   ${c.d}${u.libreGB.toFixed(1)} GB libres de ${u.totalGB.toFixed(1)}${c.x}`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// El comando
// ─────────────────────────────────────────────────────────────────────────────

async function cmd(termino, { aplicar, unidadPedida }) {
    const { filas } = await relevar();
    const terminos = termino.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (s) => { const t = String(s ?? '').toLowerCase(); return terminos.every((w) => t.includes(w)); };

    // Una tarea matchea por su nombre o por el de alguno de sus entregables.
    const tareas = filas.filter((f) => hit(f.tarea) || (f.familias ?? []).some((g) => hit(g.entregable)));
    if (!tareas.length) {
        say(`\n${c.y}No encontre ninguna tarea abierta que matchee "${termino}".${c.x}`);
        say(`${c.d}Puede estar ya cerrada. Buscá con:  node scripts/_entregas.mjs --buscar "${termino}"${c.x}`);
        return 1;
    }

    // De cada tarea, el ultimo de cada documento distinto: eso es "lo ultimo de X".
    const entrantes = tareas.flatMap((t) => (t.familias ?? []).map((g) => ({ ...g, tarea: t.tarea, dirTarea: t.ruta })));

    say();
    say(`${c.b}LO ULTIMO DE "${termino}"${c.x}   ${entrantes.length} archivo(s) en ${tareas.length} tarea(s)`);
    for (const e of entrantes) say(`  ${cortar(e.entregable, 52)} ${c.d}${fmtFecha(e.mtime)}  ·  ${e.tarea}${c.x}`);

    const unidades = unidadesExtraibles();
    const { unidad, error } = elegirUnidad(unidades, unidadPedida);
    if (error) {
        say();
        say(`${c.r}✗${c.x}  ${error}`);
        if (unidades.length) { say(`${c.d}Conectadas:${c.x}`); listarUnidades(unidades); }
        return 1;
    }
    say();
    say(`${c.b}PENDRIVE${c.x}  ${unidad.letra}  ${unidad.etiqueta}   ${c.d}${unidad.libreGB.toFixed(1)} GB libres${c.x}`);

    const destinoDir = `${unidad.letra}\\`;
    const enPendrive = fs.readdirSync(destinoDir, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => ({ nombre: d.name, ruta: path.join(destinoDir, d.name) }));

    const repetidos = yaEstan(entrantes.map((e) => ({ nombre: e.entregable })), enPendrive);
    const aCopiar = entrantes.filter((e) => !repetidos.some((r) => r.nombre.toLowerCase() === e.entregable.toLowerCase()));
    const superados = superadosPor(entrantes.map((e) => ({ nombre: e.entregable })), enPendrive);

    say();
    say(`${c.b}PLAN${c.x}`);
    for (const e of aCopiar) say(`  ${c.g}copiar${c.x}   ${e.entregable}`);
    for (const r of repetidos) say(`  ${c.d}ya esta  ${r.nombre}${c.x}`);
    for (const s of superados) say(`  ${c.y}sacar${c.x}    ${s.nombre}   ${c.d}(lo reemplaza ${s.reemplazadoPor})${c.x}`);
    if (!aCopiar.length && !superados.length) { say(`  ${c.d}nada que hacer: el pendrive ya está al día.${c.x}`); return 0; }

    // Lo superado vuelve a la carpeta de la tarea que lo genero. Si un archivo del pendrive
    // no se puede atribuir a ninguna, NO se toca: sacarlo seria borrarlo sin red.
    const carpetaDe = new Map(entrantes.map((e) => [familiaEntregable(e.entregable), e.dirTarea]));
    const respaldoDe = (s) => path.join(carpetaDe.get(familiaEntregable(s.nombre)), CARPETA_SUPERADOS);

    if (!aplicar) {
        say();
        say(`${c.d}Esto es lo que HARIA. Nada se toco todavia.${c.x}`);
        if (superados.length) {
            say(`${c.d}Lo superado no se borra: se mueve (copia → verifica md5 → recién ahí se saca del`);
            say(`   pendrive, que no tiene Papelera) a la subcarpeta "${CARPETA_SUPERADOS}" de su tarea.${c.x}`);
        }
        // Se avisa ACA de una ruta que no va a entrar, no despues de copiar la mitad.
        for (const e of aCopiar) {
            const errs = revisarDestino(path.join(destinoDir, e.entregable));
            for (const x of errs) say(`${c.r}✗${c.x}  ${e.entregable}: ${x}`);
        }
        say();
        say(`Para hacerlo:  ${c.b}node scripts/_pendrive.mjs "${termino}" --aplicar${c.x}`);
        return 0;
    }

    say();
    say(`${c.b}APLICANDO${c.x}`);
    let fallos = 0;

    // Primero se COPIA lo nuevo. Si algo falla, el pendrive queda como estaba y no se saco nada.
    for (const e of aCopiar) {
        const destino = path.join(destinoDir, e.entregable);
        try {
            const { bytes } = copiarVerificado(e.ruta, destino);
            say(`  ${c.g}✓${c.x} ${e.entregable}   ${c.d}${(bytes / 1024).toFixed(0)} KB, md5 verificado${c.x}`);
        } catch (err) { fallos += 1; say(`  ${c.r}✗${c.x} ${e.entregable}: ${err.message}`); }
    }
    if (fallos) {
        say();
        say(`${c.r}${fallos} copia(s) fallaron — no saco nada del pendrive.${c.x} Arreglar eso primero.`);
        return 1;
    }

    // Recien con lo nuevo adentro y verificado se saca lo viejo.
    for (const s of superados) {
        const dirResp = respaldoDe(s);
        try {
            fs.mkdirSync(dirResp, { recursive: true });
            // nombreLibre: si en una corrida anterior ya se respaldo otro archivo con este
            // mismo nombre, el nuevo va como "... (2)". Pisarlo seria borrar el respaldo
            // viejo justo en la carpeta que existe para que nada se pierda.
            const destino = nombreLibre(path.join(dirResp, s.nombre));
            moverVerificado(s.ruta, destino);
            say(`  ${c.y}→${c.x} ${s.nombre}   ${c.d}guardado en ${CARPETA_SUPERADOS}`
                + `${path.basename(destino) !== s.nombre ? ` como "${path.basename(destino)}"` : ''}`
                + ` y sacado del pendrive${c.x}`);
        } catch (err) { say(`  ${c.r}✗${c.x} ${s.nombre} NO se saco (sigue en el pendrive): ${err.message}`); }
    }
    say();
    say(`${c.g}Listo.${c.x} Verificalo abriendo un archivo del pendrive antes de llevarlo.`);
    return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Separa el termino de busqueda de los flags. Devuelve `{termino, sueltos}`.
 *
 * `sueltos` son las palabras que quedaron fuera y NO se usan: pasa cuando se olvidan las
 * comillas (`_pendrive.mjs armrest door panel`). Descartarlas en silencio ampliaria el
 * matcheo a tareas que no se buscaron, asi que se cantan.
 */
export function parsearArgs(args) {
    const libres = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--unidad');
    return { termino: libres[0] ?? null, sueltos: libres.slice(1) };
}

async function main(argv) {
    const args = argv.slice(2);
    const flag = (n, def = null) => { const i = args.indexOf(n); return i === -1 ? def : args[i + 1] ?? true; };

    if (args.includes('--unidades')) { say(); listarUnidades(unidadesExtraibles()); return 0; }

    const { termino, sueltos } = parsearArgs(args);
    if (!termino) {
        say('\nuso:  node scripts/_pendrive.mjs "<palabras de la tarea>" [--aplicar] [--unidad <letra|etiqueta>]');
        say('      node scripts/_pendrive.mjs --unidades\n');
        return 1;
    }
    if (sueltos.length) {
        say(`\n${c.r}✗${c.x}  Faltan las comillas: solo estoy buscando "${termino}" y quedaron afuera `
            + `${sueltos.map((s) => `"${s}"`).join(', ')}.`);
        say(`${c.d}   Poné todo junto entre comillas:  node scripts/_pendrive.mjs "${termino} ${sueltos.join(' ')}"${c.x}\n`);
        return 1;
    }
    return cmd(termino, { aplicar: args.includes('--aplicar'), unidadPedida: flag('--unidad') });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    main(process.argv).then((n) => process.exit(n > 0 ? 1 : 0));
}

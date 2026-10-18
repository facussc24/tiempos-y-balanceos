/**
 * _nubeMudar.mjs — la MUDANZA de la nube: todo lo del asistente a una sola carpeta, «ASISTENTE INGENIERIA»
 * (encargo E261017-012b; Fak, 17/10/2026 ~19:50: «si hace falta mover cosas movelas... prefiero organizar todo bien de
 * una vez»). El plan es el del simulado de la tanda 7 (`node scripts/_nubeSimular.mjs`), con FACUNDO entera adentro.
 *
 *   node scripts/_nubeMudar.mjs              --simular (por defecto): el plan, con conteos, sin mover nada
 *   node scripts/_nubeMudar.mjs --aplicar    mueve carpeta por carpeta y verifica cada una
 *
 * QUE Y EN QUE ORDEN: la lista y el orden son los de `scripts/_lib/nubeCarpetas.data.json` (el mismo canon con el que
 * los programas encuentran cada carpeta): primero las partes que viven adentro de una carpeta que despues se mueve
 * entera (el buzon y los mails), despues las de la raiz. Cada carpeta va de su ruta VIEJA a su ruta NUEVA.
 *
 * COMO SE MUEVE: `rename` adentro de la misma biblioteca. Para OneDrive es un cambio de lugar (metadato): no vuelve a
 * subir nada ni baja lo que esta solo en la nube. Nada se copia ni se borra.
 *
 * QUE FRENA, ANTES DE MOVER (el plan lo dice y --aplicar no arranca):
 *   - una carpeta que tiene la ruta vieja Y la nueva a la vez (no se mezclan dos carpetas);
 *   - archivos sin subir a la nube (sin el atributo ReparsePoint, medido con scripts/_lib/nubeMedir.ps1);
 *   - una ruta que en SharePoint pasaria del tope (400 caracteres; prefijo y tope en el canon).
 * QUE FRENA, DURANTE: despues de cada carpeta se cuenta de nuevo, en el lugar nuevo, archivo por archivo (ruta relativa
 * y tamaño): si falta uno, sobra uno o cambio un tamaño, PARA ahi, lo dice y no sigue con las demas.
 *
 * Lo medido (antes y despues de cada carpeta) queda en exports/explicaciones/nube_mudanza_<fecha>.json.
 * Solo lee y renombra: no abre ningun archivo (contar y medir por atributos no los baja de la nube).
 */
import { readdirSync, lstatSync, mkdirSync, renameSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { buscarBiblioteca, esCarpeta, CANON_CARPETAS } from './_lib/nubeRutas.mjs';
import { medirPorAtributos, rutaSalida, mb, cargarCanon } from './_lib/nubeOrden.mjs';

/** Archivos que OneDrive y Windows dejan solos y no son de nadie (los mismos que ignora nubeMedir.ps1). */
const IGNORADO = (n) => n === 'Thumbs.db' || n === 'desktop.ini' || n.startsWith('~$') || n.startsWith('.849C9593');

/**
 * Cuenta una carpeta entera sin abrir nada: { archivos, carpetas, bytes, lista: Map(relativa -> tamaño), maxLargo }.
 * `lstat` no sigue enlaces ni baja un archivo que vive solo en la nube. `largoDe(rel)` da el largo que tendria en
 * SharePoint cada archivo, para el tope.
 */
export function contar(dir, largoDe = null, excluir = []) {
    const fuera = new Set(excluir.map((x) => x.toLowerCase()));
    const lista = new Map();
    let carpetas = 0, bytes = 0, maxLargo = 0, maxRuta = '';
    const pila = [dir];
    while (pila.length) {
        const d = pila.pop();
        for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            const rel = relative(dir, p);
            if (largoDe) { const l = largoDe(rel); if (l > maxLargo) { maxLargo = l; maxRuta = rel; } }
            const st = lstatSync(p);
            if (st.isDirectory()) { if (fuera.has(p.toLowerCase())) continue; carpetas++; pila.push(p); continue; }
            if (IGNORADO(e.name)) continue;
            lista.set(rel, st.size);
            bytes += st.size;
        }
    }
    return { archivos: lista.size, carpetas, bytes, lista, maxLargo, maxRuta };
}

/** Lo que falta, lo que sobra y lo que cambio de tamaño entre dos conteos. */
export function comparar(antes, despues) {
    const faltan = [], cambian = [], sobran = [];
    for (const [rel, t] of antes.lista) {
        if (!despues.lista.has(rel)) faltan.push(rel);
        else if (despues.lista.get(rel) !== t) cambian.push(rel);
    }
    for (const rel of despues.lista.keys()) if (!antes.lista.has(rel)) sobran.push(rel);
    const iguales = !faltan.length && !cambian.length && !sobran.length && antes.carpetas === despues.carpetas;
    return { iguales, faltan, cambian, sobran };
}

/**
 * El plan sobre la biblioteca `bib`: una fila por carpeta del canon, en su orden.
 * estado: 'mover' (esta la vieja y no la nueva) · 'ya_movida' (solo la nueva) · 'no_esta' (ninguna) · 'las_dos' (frena).
 */
export function planMudanza(bib, canon = CANON_CARPETAS, existe = esCarpeta) {
    return canon.carpetas.map((c) => {
        const nueva = join(bib, ...c.nueva);
        const viejas = c.viejas.map((t) => join(bib, ...t));
        const vieja = viejas.find((v) => existe(v)) || null;
        const hayNueva = existe(nueva);
        const estado = vieja && hayNueva ? 'las_dos' : vieja ? 'mover' : hayNueva ? 'ya_movida' : 'no_esta';
        return { clave: c.clave, que: c.que, origen: vieja, destino: nueva, estado };
    });
}

/** Largo de la ruta en SharePoint de un archivo que, adentro de la carpeta movida, tiene la ruta relativa `rel`. */
export function largoSharePoint(destinoRel, rel, canon = CANON_CARPETAS) {
    return (canon.sharepoint_prefijo + [destinoRel, rel].filter(Boolean).join('/')).replace(/\\/g, '/').length;
}

function linea(t = '') { console.log(t); }

/**
 * Los LEEME de la carpeta unica (los textos del simulado: `nubeOrden.data.json`, `leeme_raiz` y `destinos[].leeme`,
 * cinco renglones cada uno). Uno que no existe se crea; uno que ya existe y no empieza con esos renglones los recibe
 * ARRIBA, con todo lo que tenia abajo (nunca se pisa: el de 1- INSTALAR y el de 5- FACUNDO traen instrucciones).
 * Devuelve [{ ruta, accion: 'creado'|'agregado arriba'|'actualizado'|'ya estaba'|'falta la carpeta' }].
 */
export function escribirLeemes(bib, orden, unica = CANON_CARPETAS.unica, { escribir = true } = {}) {
    const lista = [{ carpeta: join(bib, unica), renglones: orden.leeme_raiz.map((l) => l.replace('{NOMBRE}', unica)) },
        ...orden.destinos.map((d) => ({ carpeta: join(bib, unica, d.nombre), renglones: d.leeme }))];
    const out = [];
    for (const { carpeta, renglones } of lista) {
        if (!esCarpeta(carpeta)) { out.push({ ruta: join(carpeta, 'LEEME.txt'), accion: 'falta la carpeta' }); continue; }
        const ruta = join(carpeta, 'LEEME.txt');
        const nuevo = renglones.join('\r\n') + '\r\n';
        if (!existsSync(ruta)) { if (escribir) writeFileSync(ruta, nuevo, 'utf8'); out.push({ ruta, accion: 'creado' }); continue; }
        const viejo = readFileSync(ruta, 'utf8').replace(/^﻿/, '');
        const sus = viejo.split(/\r?\n/);
        // los cinco renglones completos, no solo el primero (revision por API, 18/10): si estan iguales, nada; si arranca con
        // el mismo primer renglon pero los otros cambiaron en el canon, se cambian esos cinco y lo de abajo queda igual
        if (renglones.every((l, i) => sus[i] === l)) { out.push({ ruta, accion: 'ya estaba' }); continue; }
        if (sus[0] === renglones[0]) {
            if (escribir) writeFileSync(ruta, [...renglones, ...sus.slice(renglones.length)].join('\r\n'), 'utf8');
            out.push({ ruta, accion: 'actualizado' });
            continue;
        }
        if (escribir) writeFileSync(ruta, nuevo + '\r\n' + viejo, 'utf8');
        out.push({ ruta, accion: 'agregado arriba' });
    }
    return out;
}

/**
 * Mueve UNA carpeta y la verifica. Justo antes: lo que falta subir (si no es 0, no se mueve) y el conteo archivo por
 * archivo; despues: el conteo en el lugar nuevo, que tiene que ser identico, y la carpeta vieja que ya no tiene que
 * estar. Devuelve la fila del registro con `ok` y, si no, `motivo` (y `diferencias`). `renombrar` y `sinSubirAhora`
 * se pasan desde afuera para probarlo sin la nube.
 */
export function moverYVerificar(f, { relBib = (p) => p, sinSubirAhora = () => 0, renombrar = renameSync } = {}) {
    const fila = { clave: f.clave, origen: relBib(f.origen), destino: relBib(f.destino) };
    const pend = sinSubirAhora(f);
    fila.sin_subir_antes = pend;
    if (pend !== 0) return { ...fila, ok: false, motivo: pend === null ? 'no se pudo medir si quedaba algo sin subir: no se movio' : `${pend} archivo(s) sin subir a la nube justo antes de mover: no se movio` };
    const antes = contar(f.origen);
    fila.antes = { archivos: antes.archivos, carpetas: antes.carpetas, bytes: antes.bytes };
    if (existsSync(f.destino)) return { ...fila, ok: false, motivo: `ya existe ${fila.destino}: no se mezclan dos carpetas` };
    try {
        mkdirSync(dirname(f.destino), { recursive: true });
        renombrar(f.origen, f.destino);
    } catch (e) {
        return { ...fila, ok: false, motivo: `no se pudo mover (${e.code || ''} ${e.message}); la carpeta quedo donde estaba` };
    }
    let despues;
    try { despues = contar(f.destino); } catch (e) {
        return { ...fila, ok: false, motivo: `se movio, pero no se pudo contar en el lugar nuevo (${e.code || ''} ${e.message}): revisar a mano antes de seguir` };
    }
    const cmp = comparar(antes, despues);
    fila.despues = { archivos: despues.archivos, carpetas: despues.carpetas, bytes: despues.bytes };
    fila.origen_sigue = existsSync(f.origen);
    if (!cmp.iguales) return { ...fila, ok: false, motivo: `el conteo no coincide (antes ${antes.archivos} archivos / ${antes.carpetas} carpetas / ${antes.bytes} bytes; despues ${despues.archivos} / ${despues.carpetas} / ${despues.bytes})`, diferencias: { faltan: cmp.faltan, 'cambiaron de tamaño': cmp.cambian, sobran: cmp.sobran } };
    if (fila.origen_sigue) return { ...fila, ok: false, motivo: `la carpeta vieja sigue existiendo despues de mover: ${fila.origen}` };
    return { ...fila, ok: true };
}

/**
 * `opciones` es para probarlo con una biblioteca de mentira: `home` (de donde sale la biblioteca), `medir` (en vez de
 * nubeMedir.ps1, que mira los atributos de OneDrive) y `dirRegistro` (en vez de exports/explicaciones del checkout principal).
 */
export function main(argv = process.argv.slice(2), { home, medir = medirPorAtributos, dirRegistro } = {}) {
    const desconocidos = argv.filter((a) => !['--simular', '--aplicar'].includes(a));
    if (desconocidos.length) { console.error(`Argumento desconocido: ${desconocidos.join(' ')} (solo --simular o --aplicar)`); return 2; }
    const aplicar = argv.includes('--aplicar');
    const bib = buscarBiblioteca(home);
    if (!bib) { console.error('No encuentro la biblioteca de Ingenieria sincronizada en esta PC.'); return 2; }
    const plan = planMudanza(bib);
    const aMover = plan.filter((f) => f.estado === 'mover');
    linea(`${aplicar ? 'MUDANZA' : 'SIMULADO (no se mueve nada)'} — biblioteca: ${bib}`);
    linea(`Carpeta unica: ${CANON_CARPETAS.unica}\n`);

    // 1) Antes de tocar nada: contar todo, medir lo que falta subir y el largo en SharePoint.
    const relBib = (p) => relative(bib, p);
    const medicion = aMover.length ? medir(bib, aMover.map((f) => relBib(f.origen)), { topeSeg: 600 }) : { carpetas: [] };
    const sinSubirDe = new Map(medicion.carpetas.map((c) => [c.nombre, c]));
    const frenos = [];
    for (const f of plan) {
        if (f.estado === 'las_dos') frenos.push(`«${f.clave}»: existen la vieja (${relBib(f.origen)}) y la nueva (${relBib(f.destino)}) a la vez; no se mezclan`);
        if (f.estado !== 'mover') continue;
        // una parte que se mueve aparte (el buzon adentro del area vieja) no cuenta en la de afuera
        const partes = aMover.filter((g) => g !== f && g.origen.toLowerCase().startsWith((f.origen + sep).toLowerCase())).map((g) => g.origen);
        f.antes = contar(f.origen, (rel) => largoSharePoint(relBib(f.destino), rel), partes);
        const m = sinSubirDe.get(relBib(f.origen));
        f.sinSubir = m ? m.total.sin_subir : null;
        f.medidoPs = m ? { archivos: m.total.archivos, bytes: m.total.bytes, terminado: m.terminado } : null;
        if (f.sinSubir === null || (m && !m.terminado)) frenos.push(`«${f.clave}»: no se pudo medir que todo este subido (${relBib(f.origen)})`);
        else if (f.sinSubir > 0) frenos.push(`«${f.clave}»: ${f.sinSubir} archivo(s) sin subir a la nube en ${relBib(f.origen)}`);
        if (f.antes.maxLargo > CANON_CARPETAS.sharepoint_tope) frenos.push(`«${f.clave}»: una ruta quedaria de ${f.antes.maxLargo} caracteres en SharePoint (tope ${CANON_CARPETAS.sharepoint_tope}): ${f.antes.maxRuta}`);
    }

    linea('Carpeta'.padEnd(16) + 'Estado'.padEnd(12) + 'Archivos'.padStart(9) + 'Carpetas'.padStart(9) + 'Peso'.padStart(10) + 'Sin subir'.padStart(10) + 'Ruta mas larga'.padStart(15));
    for (const f of plan) {
        const a = f.antes;
        linea(f.clave.padEnd(16) + f.estado.padEnd(12) + (a ? String(a.archivos) : '-').padStart(9) + (a ? String(a.carpetas) : '-').padStart(9)
            + (a ? mb(a.bytes) : '-').padStart(10) + (f.sinSubir ?? '-').toString().padStart(10) + (a ? String(a.maxLargo) : '-').padStart(15));
        if (f.estado !== 'no_esta') linea(`    ${f.origen ? relBib(f.origen) : '(ya no esta en el lugar viejo)'}  ->  ${relBib(f.destino)}`);
    }
    linea('');
    if (frenos.length) {
        linea('NO SE PUEDE MOVER todavia:');
        for (const x of frenos) linea(`  [X] ${x}`);
        return 1;
    }
    if (!aMover.length) {
        linea('No queda nada por mover: todas las carpetas del canon estan en su lugar nuevo (o no existen).');
        // los LEEME se completan igual (si una corrida anterior paro antes de escribirlos)
        for (const l of escribirLeemes(bib, cargarCanon(), CANON_CARPETAS.unica, { escribir: aplicar })) if (l.accion !== 'ya estaba') linea(`[LEEME] ${aplicar ? '' : '(se haria) '}${l.accion.padEnd(16)} ${relBib(l.ruta)}`);
        return 0;
    }
    if (!aplicar) { linea(`Se moverian ${aMover.length} carpeta(s), en este orden. Para hacerlo: node scripts/_nubeMudar.mjs --aplicar`); return 0; }

    // 2) Mover, de a una, y contar de nuevo en el lugar nuevo.
    const registro = { fecha: new Date().toISOString(), biblioteca: bib, unica: CANON_CARPETAS.unica, carpetas: [] };
    // el registro va al lado del simulado (exports/explicaciones del checkout principal); fecha LOCAL, no la de UTC
    const hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    // una segunda corrida no pisa la de antes: si el nombre del dia ya esta, la hora con segundos y, si tambien, un numero
    const dir = dirRegistro || dirname(rutaSalida('x.md'));
    const base = `nube_mudanza_${hoy}`;
    let salida = join(dir, `${base}.json`);
    for (let i = 1; existsSync(salida); i++) salida = join(dir, `${base}_${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}${i > 1 ? `_${i}` : ''}.json`);
    // sin registro no se mueve: lo que se movio tiene que quedar anotado con su conteo
    const guardar = () => { mkdirSync(dirname(salida), { recursive: true }); writeFileSync(salida, JSON.stringify(registro, null, 2), 'utf8'); };
    try { guardar(); } catch (e) { linea(`[X] No puedo escribir el registro (${salida}): ${e.message}. No se movio nada.`); return 1; }
    const sinSubirAhora = (f) => {
        const m = medir(bib, [relBib(f.origen)], { topeSeg: 600 }).carpetas[0];
        return m && m.terminado ? m.total.sin_subir : null;
    };
    for (const f of aMover) {
        const fila = moverYVerificar(f, { relBib, sinSubirAhora });
        registro.carpetas.push(fila);
        try { guardar(); } catch (e) {
            // ya se movio: que el conteo quede al menos en la pantalla, y no se sigue con la siguiente
            linea(`[X] PARE: «${f.clave}» ${fila.ok ? 'se movio y verifico' : 'quedo a medias'}, pero no pude escribir el registro (${e.message}).`);
            linea(`    Su fila: ${JSON.stringify(fila)}`);
            return 1;
        }
        if (!fila.ok) {
            linea(`[X] PARE en «${f.clave}»: ${fila.motivo}`);
            if (fila.diferencias) for (const [n, l] of Object.entries(fila.diferencias)) if (l.length) linea(`    ${n} (${l.length}): ${l.slice(0, 10).join(' · ')}`);
            linea(`    Las carpetas de antes de esta ya se movieron y verificaron; registro: ${salida}`);
            return 1;
        }
        linea(`[OK] ${f.clave.padEnd(15)} ${String(fila.antes.archivos).padStart(6)} archivos, ${String(fila.antes.carpetas).padStart(5)} carpetas, ${mb(fila.antes.bytes).padStart(9)}  ->  ${fila.destino}`);
    }
    // 3) Los LEEME, despues de medir (no entran en el conteo de antes y despues de cada carpeta).
    registro.leemes = escribirLeemes(bib, cargarCanon());
    try { guardar(); } catch (e) { linea(`[!] Las carpetas se movieron y verificaron, pero no pude anotar los LEEME en el registro (${e.message}).`); }
    for (const l of registro.leemes) linea(`[LEEME] ${l.accion.padEnd(16)} ${relBib(l.ruta)}`);
    linea(`\nListo: ${aMover.length} carpeta(s) movidas, todas con el mismo conteo antes y despues. Registro: ${salida}`);
    return 0;
}

const esPrincipal = !!process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1]).toLowerCase();
if (esPrincipal) process.exit(main());


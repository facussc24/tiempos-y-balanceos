/**
 * _nubeMapa.mjs — el MAPA de la biblioteca de Ingenieria entera (tanda 7 del plan del sistema, pieza 3 bis; 17/10/2026).
 *
 * SOLO LEE y NO BAJA NADA: cada carpeta de primer y segundo nivel con su tipo (regla con motivo, en
 * `nubeOrden.data.json`), quien escribe ahi (INFERIDO de las fechas, del archivo mas nuevo y de los programas de la casa
 * que la nombran: los archivos sincronizados no dicen quien los hizo), que programa la usa (busqueda por tramo de ruta
 * en el repo, en ~/.claude, en las tareas de Windows y en los programas que corren copiados en otras PC) y cuantos
 * archivos y cuanto pesa (por atributos: `nubeMedir.ps1` no abre ningun archivo). Mide el espacio libre de C: antes y
 * despues como prueba. De aca sale el plan por carpeta que Fak aprueba despues; el mapa no propone nada.
 *
 *   node scripts/_nubeMapa.mjs                     → exports/explicaciones/nube_mapa_2026-10-16.md
 *   node scripts/_nubeMapa.mjs --tope 300          (segundos por carpeta de primer nivel; por defecto 240)
 *   node scripts/_nubeMapa.mjs --archivo otro.md
 */
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { buscarBiblioteca, esCarpeta } from './_lib/nubeRutas.mjs';
import {
    cargarCanon, leerArgs, rutaSalida, buscarReferencias, buscarConAlias, porArchivo, recolectar, sumarCopiasDeLaNube, leerTareasDeWindows,
    medirPorAtributos, tipoDeCarpeta, quienEscribe, fraseEspacio, mb, celda, recortar,
} from './_lib/nubeOrden.mjs';

const ARCHIVO_POR_DEFECTO = 'nube_mapa_2026-10-16.md';

/** Resume los programas de una carpeta: cuantos de codigo o tarea y cuales (los primeros), y cuantos de texto. */
export function resumenProgramas(refs, max = 4) {
    const arch = porArchivo(refs);
    const cod = arch.filter((a) => a.categoria !== 'texto');
    const txt = arch.filter((a) => a.categoria === 'texto');
    const nombres = cod.slice(0, max).map((a) => `\`${a.ruta.replace(/^nube: /, 'nube:')}\``).join(', ') + (cod.length > max ? ` y ${cod.length - max} más` : '');
    return { codigo: cod.length, texto: txt.length, nombres };
}

/**
 * Arma el .md del mapa. `d.carpetas`: [{ nombre, tipo, medida, programas, sub: [{ nombre, tipo, medida, programas }] }],
 * ya calculado; esta funcion solo escribe (se prueba con datos de mentira).
 */
export function renderMapa(d) {
    const { medicion, carpetas, sueltos, dias = 30, canon = null } = d;
    const quien = (t, n) => quienEscribe(t, n, dias, canon);
    const porque = (tipo) => (tipo.heredado ? 'como su carpeta de arriba' : recortar(tipo.motivo, 70));
    const L = [];
    L.push('# Mapa de la biblioteca de Ingeniería — solo lectura, nada se movió');
    L.push('');
    L.push(`Medido el ${medicion.medido} con \`node scripts/_nubeMapa.mjs\`. ${fraseEspacio(medicion.libre_antes, medicion.libre_despues)}`);
    L.push('');
    L.push(`De acá sale el plan por carpeta, que vos aprobás después. Este mapa no propone nada: dice qué hay, de qué tipo es, quién escribe y qué programa lo usa.`);
    L.push('');
    const total = carpetas.reduce((s, c) => s + (c.medida?.total?.archivos || 0), 0);
    const bytes = carpetas.reduce((s, c) => s + (c.medida?.total?.bytes || 0), 0);
    const disco = carpetas.reduce((s, c) => s + (c.medida?.total?.bytes_disco || 0), 0);
    const sinTerminar = carpetas.filter((c) => c.medida && !c.medida.terminado);
    L.push(`**En números:** ${carpetas.length} carpetas de primer nivel y ${carpetas.reduce((s, c) => s + c.sub.length, 0)} de segundo nivel; ${total.toLocaleString('es-AR')} archivos, ${mb(bytes)} en la nube, de los que ${mb(disco)} están también en esta PC.${sinTerminar.length ? ` **${sinTerminar.length} carpeta${sinTerminar.length === 1 ? '' : 's'} no terminó de recorrerse** en su tope de tiempo (${sinTerminar.map((c) => `\`${c.nombre}\``).join(', ')}): sus números son parciales y dicen «no terminó».` : ' Todas las carpetas se recorrieron enteras.'}${sueltos.length ? ` Además hay ${sueltos.length} archivo${sueltos.length === 1 ? '' : 's'} suelto${sueltos.length === 1 ? '' : 's'} en la raíz (${sueltos.map((s) => `\`${s}\``).join(', ')}).` : ''}`);
    L.push('');
    const porTipo = new Map();
    for (const c of carpetas) porTipo.set(c.tipo.tipo, (porTipo.get(c.tipo.tipo) || 0) + 1);
    L.push('| Tipo | Carpetas de primer nivel |');
    L.push('|---|---:|');
    for (const [t, n] of [...porTipo].sort((a, b) => b[1] - a[1])) L.push(`| ${t} | ${n} |`);
    L.push('');
    L.push('## Primer nivel');
    L.push('');
    L.push(`«Quién escribe» es una **inferencia**: los archivos sincronizados no dicen quién los hizo. Sale del nombre y la carpeta del archivo más nuevo (un archivo por PC lo deja un programa; un mail, la copia de mails; un «PEDIDO», las sesiones de Facundo), de cuántos cambiaron en los últimos ${dias} días y de si un programa de la casa la nombra. «Programas» = archivos de código o tareas que la buscan por su nombre (se rompen si la carpeta cambia de lugar); «texto» = reglas, memorias y documentos que la nombran.`);
    L.push('');
    L.push('| Carpeta | Tipo | Por qué ese tipo | Archivos | Peso | En esta PC | Último cambio | Quién escribe (inferido) | Programas | Texto |');
    L.push('|---|---|---|---:|---:|---:|---|---|---|---:|');
    for (const c of carpetas) {
        const t = c.medida?.total;
        const p = c.programas;
        L.push(`| \`${celda(c.nombre)}\` | ${c.tipo.tipo} | ${celda(porque(c.tipo))} | ${t ? `${t.archivos.toLocaleString('es-AR')}${c.medida.terminado ? '' : ' (no terminó)'}` : '—'} | ${t ? mb(t.bytes) : '—'} | ${t ? mb(t.bytes_disco) : '—'} | ${t?.ultima || '—'} | ${celda(quien(t, p.codigo))} | ${p.codigo ? `${p.codigo}: ${celda(p.nombres)}` : '—'} | ${p.texto || '—'} |`);
    }
    L.push('');
    L.push('## Por qué cada tipo');
    L.push('');
    const motivos = new Map();
    for (const c of carpetas) if (!c.tipo.heredado) motivos.set(c.tipo.tipo, c.tipo.motivo);
    for (const [t, m] of motivos) L.push(`- **${t}**: ${m}`);
    L.push('');
    L.push('## Segundo nivel, carpeta por carpeta');
    L.push('');
    for (const c of carpetas) {
        if (!c.sub.length) continue;
        L.push(`### \`${c.nombre}\` (${c.tipo.tipo})`);
        L.push('');
        if (c.nota) { L.push(c.nota); L.push(''); }
        L.push('| Subcarpeta | Tipo | Por qué ese tipo | Archivos | Peso | En esta PC | Último cambio | Quién escribe (inferido) | Programas |');
        L.push('|---|---|---|---:|---:|---:|---|---|---|');
        for (const s of c.sub) {
            const t = s.medida;
            L.push(`| \`${celda(recortar(s.nombre, 60))}\` | ${s.tipo.tipo} | ${celda(porque(s.tipo))} | ${t ? t.archivos.toLocaleString('es-AR') : '—'} | ${t ? mb(t.bytes) : '—'} | ${t ? mb(t.bytes_disco) : '—'} | ${t?.ultima || '—'} | ${celda(quien(t, s.programas.codigo))} | ${s.programas.codigo ? `${s.programas.codigo}: ${celda(s.programas.nombres)}` : '—'} |`);
        }
        if (c.medida && !c.medida.terminado) L.push(`\n_Esta carpeta pasó su tope de tiempo: las subcarpetas que no se alcanzaron a recorrer pueden figurar con menos archivos de los que tienen._`);
        L.push('');
    }
    L.push('## Cómo se midió y qué no se ve');
    L.push('');
    L.push('- Peso, fecha y «en esta PC» salen de los atributos (`scripts/_lib/nubeMedir.ps1`, en prioridad baja): el marcador «solo en la nube» (0x400000) dice qué está bajado. Ningún archivo se abrió, y el espacio libre de C: de arriba es la prueba.');
    L.push('- Los programas se buscan por el nombre de la carpeta como parte de una ruta. Una subcarpeta cuenta solo en archivos que nombran también a su carpeta de arriba (así «AMFE» o «Tiempos» no se confunden entre carpetas). En el código no cuentan los comentarios.');
    L.push('- **No se ve**: quién es la persona que guardó cada archivo (OneDrive no lo deja en el atributo), ni lo que corre adentro de las PC de Carlos, Calidad, Pedro y Federico. Las carpetas del tipo «sin clasificar» no las nombra ninguna regla todavía.');
    L.push('- La carpeta de lo nuestro (qué se movería a la carpeta única y quién la busca) tiene su propio simulado: `exports/explicaciones/nube_simulado_2026-10-16.md`.');
    return L.join('\n') + '\n';
}

function main() {
    let args;
    try { args = leerArgs(process.argv.slice(2), ['--archivo', '--tope']); } catch (e) { console.error(e.message); process.exit(2); }
    const tope = args.tope ? Number(args.tope) : 240;
    if (!Number.isFinite(tope) || tope < 10 || tope > 3600) { console.error('--tope son segundos entre 10 y 3600'); process.exit(2); }
    const salida = rutaSalida(args.archivo || ARCHIVO_POR_DEFECTO);
    const canon = cargarCanon();
    const bib = buscarBiblioteca();
    if (!bib) { console.error('No encuentro la biblioteca de Ingenieria sincronizada en esta PC.'); process.exit(2); }

    const nombres = readdirSync(bib).sort((a, b) => a.localeCompare(b, 'es'));
    const dirs = nombres.filter((n) => esCarpeta(join(bib, n)));
    // archivos sueltos en la raiz: el nombre alcanza (statSync lee metadatos, no el contenido); se saltean los de sistema
    const sueltos = nombres.filter((n) => !dirs.includes(n) && !/^\.849C9593|^desktop\.ini$|^Thumbs\.db$/i.test(n)).filter((n) => { try { return statSync(join(bib, n)).isFile(); } catch { return false; } });

    console.log(`Midiendo ${dirs.length} carpetas de primer nivel por atributos (tope ${tope} s cada una; no se abre ningun archivo)...`);
    const medicion = medirPorAtributos(bib, dirs, { topeSeg: tope, leibles: { carpetas: canon.copias_en_la_nube.carpetas, extensiones: canon.copias_en_la_nube.extensiones } });

    console.log('Buscando que programas nombran cada carpeta...');
    const archivos = recolectar(canon, { home: homedir() });
    sumarCopiasDeLaNube(archivos, bib, medicion.leibles, canon);
    archivos.push(...leerTareasDeWindows());

    const carpetas = [];
    for (const m of medicion.carpetas) {
        const tipo = tipoDeCarpeta(m.nombre, 1, canon);
        // la carpeta nuestra usa sus propios filtros y sus nombres de antes; un nombre comun, que el archivo hable de la
        // biblioteca y que el renglon la use como ruta (no el servidor Y: ni una hoja de operaciones)
        const propia = canon.carpetas.find((c) => c.nombre === m.nombre);
        const nombresCarpeta = [m.nombre, ...(propia?.alias || [])];
        const refs = propia
            ? buscarConAlias(archivos, nombresCarpeta, { canon, excluirSiAntes: propia.excluir_si_antes, exigirEnArchivo: propia.exigir_en_archivo, excluirLinea: propia.excluir_linea_si })
            : buscarReferencias(archivos, m.nombre, { canon, exigirEnArchivo: canon.exigir_biblioteca, lineaDeRuta: true, excluirLinea: canon.excluir_linea_si });
        const sub = Object.entries(m.sub || {}).map(([n, med]) => ({
            nombre: n,
            tipo: tipoDeCarpeta(n, 2, canon, tipo),
            medida: med,
            programas: resumenProgramas(buscarReferencias(archivos, n, { canon, tambien: nombresCarpeta, lineaDeRuta: true, excluirLinea: canon.excluir_linea_si }), 3),
        }));
        const c = { nombre: m.nombre, tipo, medida: m, programas: resumenProgramas(refs), sub };
        if (m.nombre === 'Claude Fak') c.nota = 'Adentro están `investigaciones-gemini` (la convención de Gemini de la tanda 5: prompts, respuestas y lo verificado) y `viernes-17-plan-sistema` (el plan del sistema y sus informes); las dos viajan con `Claude Fak` a la carpeta única.';
        carpetas.push(c);
    }

    const md = renderMapa({ medicion, carpetas, sueltos, canon });
    mkdirSync(dirname(salida), { recursive: true });
    writeFileSync(salida, md, 'utf8');
    const nSub = carpetas.reduce((s, c) => s + c.sub.length, 0);
    const conProg = carpetas.filter((c) => c.programas.codigo).length;
    console.log(`Listo: ${salida}`);
    console.log(`${carpetas.length} carpetas de primer nivel, ${nSub} de segundo; ${conProg} de primer nivel con algun programa que las busca. Libre en C: ${mb(medicion.libre_antes)} antes, ${mb(medicion.libre_despues)} despues (ningun archivo se abrio). Nada se movio.`);
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(process.argv[1]).toLowerCase()) main();

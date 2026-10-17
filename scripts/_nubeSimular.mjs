/**
 * _nubeSimular.mjs — el SIMULADO de la carpeta unica de la nube (H48, tanda 7 del plan del sistema, 17/10/2026).
 *
 * SOLO LEE. No mueve, no borra, no crea nada en la nube: no tiene `--aplicar`. Lista las carpetas nuestras de la
 * raiz de la biblioteca de Ingenieria, a que subcarpeta de la carpeta unica irian (arbol del plan del 08/10 §1.4),
 * cuanto pesan (por atributos: ningun archivo se abre), QUE PROGRAMAS las buscan por su nombre (repo, ~/.claude,
 * tareas de Windows y los programas que corren copiados en otras PC), si el guardian de firma frenaria las rutas
 * nuevas, y los LEEME propuestos. Fak decide con esto delante; mover es P56, con su si.
 *
 *   node scripts/_nubeSimular.mjs                          → exports/explicaciones/nube_simulado_2026-10-16.md
 *   node scripts/_nubeSimular.mjs --nombre "SISTEMA INGENIERIA" --archivo nube_simulado_otro.md
 *
 * --nombre: una de las opciones de `nubeOrden.data.json` (nombres_carpeta_unica); por defecto la primera.
 * --archivo: un nombre .md pelado; siempre queda en exports/explicaciones/. Un argumento desconocido frena.
 */
import { readdirSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { buscarBiblioteca, esCarpeta } from './_lib/nubeRutas.mjs';
import {
    cargarCanon, leerArgs, rutaSalida, planCarpetaUnica, leemes, buscarReferencias, buscarConAlias, porArchivo, porPc,
    dependientesDeNubeRutas, recolectar, sumarCopiasDeLaNube, leerTareasDeWindows, medirPorAtributos, fraseEspacio, mb, celda, recortar,
} from './_lib/nubeOrden.mjs';
import { firmaIaEnEscritura } from './_lib/guardianes.mjs';

const ARCHIVO_POR_DEFECTO = 'nube_simulado_2026-10-16.md';

/** ¿El guardian de firma frenaria escribir en esta ruta de la nube? (Se le pasa como un New-Item, que no es lectura.) */
export function frenaGuardian(ruta) {
    return firmaIaEnEscritura(`New-Item -ItemType Directory -Path "${ruta}\\x"`, '', { bash: true });
}

/** Las rutas nuevas que hay que probar contra el guardian: la raiz, cada destino y lo que viaja adentro de 5-. */
export function rutasAProbar(bib, nombreUnico, canon, subDeClaudeFak = []) {
    const base = `${bib}\\${nombreUnico}`;
    const out = [base];
    for (const d of canon.destinos) out.push(`${base}\\${d.nombre}`);
    const cinco = canon.destinos.find((d) => d.id === '5');
    for (const s of subDeClaudeFak) out.push(`${base}\\${cinco.nombre}\\${s}`);
    return out;
}

/** Arma el .md del simulado. `d` trae todo lo medido; no lee nada por su cuenta (se prueba con datos de mentira). */
export function renderSimulado(d) {
    const { canon, nombreUnico, plan, medicion, refs, dependNubeRutas, guardian, noLeidos, chats, forma = [] } = d;
    const prefOtra = canon.se_instalan_en_otras_pc.prefijos;
    const seInstala = (ruta) => prefOtra.some((p) => ruta.startsWith(p));
    const med = new Map(medicion.carpetas.map((c) => [c.nombre, c]));
    // todo el codigo y las tareas que se rompen, por nombre o por forma, con las carpetas de cada uno
    const codigo = new Map();
    const sumar = (carpeta, x) => { const k = `${x.origen}|${x.ruta}`; if (!codigo.has(k)) codigo.set(k, { ...x, carpetas: new Set() }); codigo.get(k).carpetas.add(carpeta); };
    for (const [carpeta, r] of refs) for (const x of r) if (x.categoria !== 'texto') sumar(carpeta, x);
    for (const f of forma) for (const x of f.refs) if (x.categoria !== 'texto') sumar(`${f.afecta} (por la forma)`, x);
    const enOtraPc = [...codigo.values()].filter((x) => x.origen === 'copia en la nube');
    const soloForma = (x) => [...x.carpetas].every((c) => c.endsWith('(por la forma)'));
    const enEsta = [...codigo.values()].filter((x) => x.origen !== 'copia en la nube' && !soloForma(x));
    const aRevisar = [...codigo.values()].filter((x) => x.origen !== 'copia en la nube' && soloForma(x));
    const L = [];
    const opcion = canon.nombres_carpeta_unica.find((o) => o.nombre === nombreUnico);
    L.push(`# Simulado de la carpeta única de la nube — nada se movió ni se borró`);
    L.push('');
    L.push(`Medido el ${medicion.medido} con \`node scripts/_nubeSimular.mjs\` (solo lee). Nombre usado en este simulado: **${nombreUnico}**. ${fraseEspacio(medicion.libre_antes, medicion.libre_despues)}`);
    L.push('');
    L.push('## Lo que necesito de vos');
    L.push('');
    L.push(`1. **El sí a este simulado.** ${canon.si_general} Con este sí se mueve; antes se publican los programas que buscan las carpetas en los dos lugares, el viejo y el nuevo, para que los mails de cada PC no dejen de subir.`);
    L.push(`2. **El nombre de la carpeta única** (no lleva la palabra Claude). Las dos opciones:`);
    for (const o of canon.nombres_carpeta_unica) L.push(`   - «${o.nombre}»: ${o.nota}`);
    L.push(`   - El del plan del 08/10, «${canon.nombre_descartado.nombre}», queda afuera: ${canon.nombre_descartado.motivo}`);
    const facundo = plan.filas.find((f) => f.nombre === 'FACUNDO');
    if (facundo && facundo.opciones) {
        L.push(`3. **Qué hacemos con \`FACUNDO\`.** ${facundo.motivo} Las tres opciones:`);
        facundo.opciones.forEach((o, i) => L.push(`   ${String.fromCharCode(97 + i)}. ${o}`));
    }
    L.push('');
    L.push('## Cómo quedaría');
    L.push('');
    L.push('```');
    L.push(`Ingeniería y Proyecto - General\\`);
    L.push(`  ${nombreUnico}\\`);
    for (const dst of canon.destinos) {
        const vienen = plan.filas.filter((f) => f.destino_id === dst.id && f.existe).map((f) => f.nombre);
        const partes = plan.filas.flatMap((f) => f.partes.filter((p) => p.destino.includes(dst.nombre)).map((p) => `${f.nombre}\\${p.sub}`));
        const todo = [...vienen, ...partes];
        L.push(`    ${dst.nombre}\\`.padEnd(48) + (todo.length ? `← ${todo.join(' + ')}` : '(vacía, con su LEEME)'));
    }
    L.push('```');
    L.push('');
    if (plan.nuevas.length) L.push(`**Ojo:** en la raíz hay ${plan.nuevas.length} carpeta${plan.nuevas.length === 1 ? '' : 's'} que parece${plan.nuevas.length === 1 ? '' : 'n'} nuestra${plan.nuevas.length === 1 ? '' : 's'} y no está${plan.nuevas.length === 1 ? '' : 'n'} en la lista: ${plan.nuevas.map((n) => `\`${n}\``).join(', ')}.\n`);
    L.push('## Carpeta por carpeta');
    L.push('');
    L.push('Peso total = lo que ocupa en la nube. «En esta PC» = la parte que ya está bajada en el disco. «Sin subir» = archivos que todavía no llegaron a la nube.');
    L.push('');
    L.push('| Carpeta de hoy | Iría a | Archivos | Peso total | En esta PC | Sin subir | Último cambio | Código que la busca | Texto que la nombra |');
    L.push('|---|---|---:|---:|---:|---:|---|---:|---:|');
    for (const f of plan.filas) {
        const m = med.get(f.nombre);
        const r = refs.get(f.nombre) || [];
        const cod = porArchivo(r).filter((x) => x.categoria !== 'texto').length;
        const txt = porArchivo(r).filter((x) => x.categoria === 'texto').length;
        const destino = f.ya_no_esta ? `ya no está (${f.ya_no_esta})` : f.destino ? `\`${f.destino}\`` : '**lo decidís vos** (punto 3)';
        // si una parte va a otro lado, la fila dice lo que QUEDA para el destino de la carpeta (el total menos las partes)
        const resto = { ...(m?.total || {}) };
        for (const p of f.partes) {
            const mp = m?.sub?.[p.sub];
            if (mp) for (const k of ['archivos', 'bytes', 'bytes_disco', 'sin_subir']) resto[k] -= mp[k];
        }
        const sufijo = f.partes.length ? ' (sin lo de abajo)' : '';
        const numeros = m && m.existe
            ? `${resto.archivos}${sufijo}${m.terminado ? '' : ' (no terminó)'} | ${mb(resto.bytes)} | ${mb(resto.bytes_disco)} | ${resto.sin_subir} | ${m.total.ultima || '—'}`
            : '— | — | — | — | —';
        L.push(`| \`${celda(f.nombre)}\` | ${celda(destino)} | ${numeros} | ${cod} | ${txt} |`);
        for (const p of f.partes) {
            const mp = m && m.sub ? m.sub[p.sub] : null;
            const rp = refs.get(`${f.nombre}\\${p.sub}`) || [];
            L.push(`| ↳ \`${celda(p.sub)}\` | \`${celda(p.destino)}\` | ${mp ? `${mp.archivos} | ${mb(mp.bytes)} | ${mb(mp.bytes_disco)} | ${mp.sin_subir} | ${mp.ultima || '—'}` : '— | — | — | — | —'} | ${porArchivo(rp).filter((x) => x.categoria !== 'texto').length} | ${porArchivo(rp).filter((x) => x.categoria === 'texto').length} |`);
        }
    }
    L.push('');
    for (const f of plan.filas) {
        L.push(`- \`${f.nombre}\`: ${f.motivo}`);
        for (const p of f.partes) L.push(`  - \`${p.sub}\`: ${p.motivo}`);
    }
    L.push('');
    L.push('## Qué deja de andar en cada PC si se mueve sin cambiar nada');
    L.push('');
    L.push('Lo que corre en cada PC y busca alguna de estas carpetas, por su nombre o por su forma. De las PC de los compañeros se ve lo que está publicado en la nube para ellas, no lo que tienen instalado adentro (puede ser otra versión).');
    L.push('');
    L.push('| PC | Qué programa | Qué carpeta busca |');
    L.push('|---|---|---|');
    for (const p of porPc([...codigo.values()], canon)) {
        if (!p.programas.length) { L.push(`| ${p.pc} | ninguno de los que se pudieron leer | — |`); continue; }
        const carpetasPc = new Set(p.programas.flatMap((x) => [...x.carpetas]));
        const progs = p.programas.slice(0, 6).map((x) => `\`${x.ruta.replace(/^nube: /, 'nube:').replace(/^programa de esta PC: /, '%LOCALAPPDATA%\\')}\``).join(', ') + (p.programas.length > 6 ? ` y ${p.programas.length - 6} más` : '');
        L.push(`| ${p.pc} | ${celda(progs)} | ${celda([...carpetasPc].map((c) => `\`${c}\``).join(', '))} |`);
    }
    L.push('');
    L.push('De dónde sale que cada programa corre en esa PC:');
    for (const p of canon.pcs) L.push(`- ${p.pc}: ${p.fuente}.`);
    L.push('');
    L.push('## Qué programas buscan cada carpeta por su nombre');
    L.push('');
    L.push('«Código» se rompe si la carpeta cambia de lugar (un programa que arma la ruta con ese nombre). «Tarea» es una tarea programada que la nombra. «Texto» queda desactualizado pero no rompe nada (reglas, memorias, habilidades, documentos). La búsqueda es por el nombre como parte de una ruta, no como palabra suelta: «FACUNDO» no cuenta a Facundo Santoro, ni a `VARIOS\\FACUNDO`, ni al usuario FACUNDO del arb. Cuenta también el nombre que tenía antes de la cuarentena, en mayúsculas o minúsculas (los programas lo siguen buscando así). En el código no cuentan los comentarios, y los encargos de las sesiones lanzadas por otra sesión (corren una sola vez) cuentan como texto. Los números son de ARCHIVOS.');
    L.push('');
    for (const f of plan.filas) {
        const grupos = [[f.nombre, refs.get(f.nombre) || []], ...f.partes.map((p) => [`${f.nombre}\\${p.sub}`, refs.get(`${f.nombre}\\${p.sub}`) || []])];
        for (const [titulo, r] of grupos) {
            L.push(`### \`${titulo}\``);
            L.push('');
            const arch = porArchivo(r);
            const cod = arch.filter((a) => a.categoria !== 'texto');
            const txt = arch.filter((a) => a.categoria === 'texto');
            if (!cod.length) L.push('- Código y tareas: **ninguno** la busca por su nombre.');
            else {
                L.push(`- Código y tareas (${cod.length}):`);
                for (const a of cod) L.push(`  - ${a.categoria === 'tarea' ? 'tarea · ' : ''}${a.origen === 'copia en la nube' ? '**corre copiado en otra PC** · ' : ''}${seInstala(a.ruta) ? '**se instala en otras PC** · ' : ''}\`${a.ruta}\` (renglón ${a.lineas.slice(0, 6).join(', ')}${a.lineas.length > 6 ? '…' : ''}): \`${recortar(a.ejemplo, 110).replace(/`/g, "'")}\``);
            }
            if (titulo === 'Claude Fak' && dependNubeRutas.length) {
                L.push(`- Además, **${dependNubeRutas.length} programas la usan sin nombrarla**: importan \`scripts/_lib/nubeRutas.mjs\`, cuya \`CARPETA_EN_INGENIERIA = 'Claude Fak'\` les da la ruta. Cambiando esa constante (y \`buscarNube()\` para que busque en los dos lugares) se arreglan todos: ${dependNubeRutas.map((x) => `\`${x}\``).join(', ')}.`);
            }
            if (txt.length) {
                L.push(`- Texto que la nombra (${txt.length} archivo${txt.length === 1 ? '' : 's'}): ${txt.slice(0, 12).map((a) => `\`${a.ruta}\``).join(', ')}${txt.length > 12 ? `, y ${txt.length - 12} más` : ''}.`);
            }
            L.push('');
        }
    }
    L.push('## Programas que la buscan por la FORMA, sin nombrarla');
    L.push('');
    L.push('Estos no aparecen arriba porque no escriben el nombre de la carpeta: recorren la raíz de la biblioteca buscando una carpeta que tenga algo adentro. Si la carpeta baja un nivel, a la carpeta única, dejan de encontrarla igual.');
    L.push('');
    for (const f of forma) {
        const arch = porArchivo(f.refs).filter((a) => a.categoria !== 'texto');
        L.push(`### Una carpeta de la raíz con «${f.tramo}» adentro (afecta a \`${f.afecta}\`)`);
        L.push('');
        L.push(f.que);
        L.push('');
        if (!arch.length) L.push('- Ningún programa leído la busca así.');
        for (const a of arch) L.push(`- ${a.origen === 'copia en la nube' ? '**corre copiado en otra PC** · ' : ''}${seInstala(a.ruta) ? '**se instala en otras PC** · ' : ''}\`${a.ruta}\` (renglón ${a.lineas.slice(0, 6).join(', ')}${a.lineas.length > 6 ? '…' : ''}): \`${recortar(a.ejemplo, 110).replace(/`/g, "'")}\``);
        L.push('');
    }
    L.push('## Lo que el guardián de firma diría de las rutas nuevas');
    L.push('');
    L.push('El guardián firma-ia frena guardar en la nube cualquier ruta con la palabra Claude, salvo las carpetas que tiene exentas. Probado en vivo con su propia función (`firmaIaEnEscritura`), sobre una escritura en cada ruta nueva:');
    L.push('');
    L.push('| Nombre | Ruta | ¿La frena? |');
    L.push('|---|---|---|');
    for (const g of guardian) L.push(`| ${g.nombre} | \`${celda(g.corta)}\` | ${g.frena ? '**sí**' : 'no'} |`);
    L.push('');
    const frenadas = guardian.filter((g) => g.frena && g.nombre !== canon.nombre_descartado.nombre);
    if (frenadas.length) L.push(`Lo que frena son las subcarpetas que viajan adentro de \`5-\` y llevan «claude» en su nombre (\`claude-memoria\`, \`claude-config\`, \`claude-registros\`). Hoy pasan porque el guardián exime «…\\Claude Fak» colgada de la raíz; después de mover, esa excepción tiene que nombrar la ruta nueva (\`FIRMA_EXENTOS_RE\` en \`scripts/_lib/guardianes.mjs\` y \`rutas_excluidas\` en \`scripts/_lib/firmaIA.data.json\`), con su test en las dos direcciones.\n`);
    const cb = guardian.filter((g) => g.nombre === canon.nombre_descartado.nombre);
    if (cb.length && cb.every((g) => !g.frena)) L.push(`«${canon.nombre_descartado.nombre}» **no** lo frena, al revés de lo que dice el plan: pasa por la excepción de la cuarentena «Claude Barack», que no distingue mayúsculas. Es una casualidad del guardián, no un permiso; igual va afuera porque nombra a Claude.\n`);
    L.push('## Lo que hay que cambiar antes de mover (con tu sí)');
    L.push('');
    const item = (x) => `   - \`${x.ruta}\`${seInstala(x.ruta) ? ' **(se instala en otras PC: además de cambiarlo, hay que reinstalarlo allá)**' : ''} (${[...x.carpetas].map((c) => `\`${c}\``).join(', ')})`;
    L.push(`1. **En esta PC y el repo: ${enEsta.length} archivo${enEsta.length === 1 ? '' : 's'} de código o tarea** que nombran la carpeta. Cada uno tiene que buscar en los dos lugares (el viejo y el nuevo) y publicarse ANTES de mover:`);
    for (const x of enEsta.sort((a, b) => a.ruta.localeCompare(b.ruta))) L.push(item(x));
    if (aRevisar.length) {
        L.push(`   Y ${aRevisar.length} más que solo usan la FORMA («_entrada», «1- PUBLICADO»): algunos la buscan desde la raíz y otros la usan adentro de una carpeta que ya encontraron; hay que revisarlos uno por uno antes de mover:`);
        for (const x of aRevisar.sort((a, b) => a.ruta.localeCompare(b.ruta))) L.push(item(x));
    }
    L.push(`2. **Copiados en otras PC: ${enOtraPc.length}.** Corren en las PC de Carlos, de Calidad, de Pedro o de Federico: arreglar el repo no los arregla; hay que publicarles la versión nueva y que su tarea la tome.${enOtraPc.length ? '' : ' Ninguno de los que se pudieron leer nombra estas carpetas.'}`);
    for (const x of enOtraPc.sort((a, b) => a.ruta.localeCompare(b.ruta))) L.push(`   - \`${x.ruta}\` (${[...x.carpetas].map((c) => `\`${c}\``).join(', ')})`);
    if (noLeidos.length) L.push(`   - Sin leer, porque viven solo en la nube y abrirlos los bajaría: ${noLeidos.length} archivo${noLeidos.length === 1 ? '' : 's'} (${noLeidos.slice(0, 5).map((x) => `\`${x}\``).join(', ')}${noLeidos.length > 5 ? '…' : ''}).`);
    L.push(`3. **El guardián de firma**: la excepción de \`Claude Fak\` pasa a la ruta nueva (ver la sección de arriba).`);
    L.push(`4. **Después de mover**, la prueba del plan: los mails de cada PC siguen subiendo${d.entradas?.length ? ` (hoy hay ${d.entradas.length} carpetas de entrada: ${d.entradas.map((e) => `\`${e}\``).join(', ')}; las ${d.entradas.length} tienen que seguir recibiendo)` : ''} y \`node scripts/_nube.mjs --sincronizar\` corre en las dos PC de Facundo.`);
    L.push('');
    L.push('## Los LEEME propuestos (cinco renglones cada uno; todavía no se escribieron en la nube)');
    L.push('');
    for (const l of leemes(canon, nombreUnico)) {
        L.push(`**\`${l.carpeta}\\LEEME.txt\`**`);
        L.push('');
        L.push('```');
        for (const r of l.renglones) L.push(r);
        L.push('```');
        L.push('');
    }
    L.push('## Los chats de cada PC');
    L.push('');
    L.push(chats);
    L.push('');
    L.push('## Cómo se midió y qué no se pudo ver');
    L.push('');
    L.push(`- El peso y la fecha salen de los atributos de cada archivo (\`scripts/_lib/nubeMedir.ps1\`): el marcador «solo en la nube» (0x400000) dice qué está en esta PC; ningún archivo se abrió. Las carpetas de lo nuestro se recorrieron enteras${medicion.carpetas.every((c) => c.terminado) ? '' : ' (las marcadas «no terminó» pasaron su tope de tiempo: su número es parcial)'}.`);
    L.push('- La búsqueda de programas abarca el repo (`scripts`, `tools`, `.claude`, `mods`), `~/.claude` (avisos de arranque, tareas programadas de la app, agentes, mi memoria), las tareas de Windows de esta PC y los programas que están en la nube y corren copiados en otras PC (solo los que ya estaban bajados).');
    L.push('- **No se ve**: lo que está instalado DENTRO de las PC de Carlos, Calidad, Pedro y Federico (su copia puede ser de otra versión que la de la nube), ni las tareas de Windows de esas PC. Lo que corre ahí se ve recién por su salud después de mover.');
    L.push(`- La opción de nombre usada fue «${nombreUnico}»${opcion ? '' : ' (no está en la lista del canon)'}; con la otra cambian solo las rutas.`);
    return L.join('\n') + '\n';
}

function main() {
    let args;
    try { args = leerArgs(process.argv.slice(2), ['--nombre', '--archivo']); } catch (e) { console.error(e.message); process.exit(2); }
    const canon = cargarCanon();
    const nombreUnico = args.nombre || canon.nombres_carpeta_unica[0].nombre;
    if (!canon.nombres_carpeta_unica.some((o) => o.nombre === nombreUnico)) {
        console.error(`--nombre tiene que ser uno de: ${canon.nombres_carpeta_unica.map((o) => o.nombre).join(' · ')}`);
        process.exit(2);
    }
    const salida = rutaSalida(args.archivo || ARCHIVO_POR_DEFECTO);
    const bib = buscarBiblioteca();
    if (!bib) { console.error('No encuentro la biblioteca de Ingenieria sincronizada en esta PC.'); process.exit(2); }

    const nombresRaiz = readdirSync(bib).filter((n) => esCarpeta(join(bib, n)));
    const plan = planCarpetaUnica(nombresRaiz, canon, nombreUnico);
    const aMedir = [...plan.filas.filter((f) => f.existe).map((f) => f.nombre), ...plan.nuevas];
    console.log(`Midiendo ${aMedir.length} carpetas por atributos (no se abre ningun archivo)...`);
    const medicion = medirPorAtributos(bib, aMedir, { topeSeg: 180, leibles: { carpetas: canon.copias_en_la_nube.carpetas, extensiones: canon.copias_en_la_nube.extensiones } });

    console.log('Buscando que programas nombran cada carpeta...');
    const archivos = recolectar(canon, { home: homedir() });
    const noLeidos = sumarCopiasDeLaNube(archivos, bib, medicion.leibles, canon);
    archivos.push(...leerTareasDeWindows());

    const refs = new Map();
    for (const f of plan.filas) {
        refs.set(f.nombre, buscarConAlias(archivos, [f.nombre, ...f.alias], { canon, excluirSiAntes: f.excluir_si_antes, exigirEnArchivo: f.exigir_en_archivo, excluirLinea: f.excluir_linea_si }));
        for (const p of f.partes) refs.set(`${f.nombre}\\${p.sub}`, buscarReferencias(archivos, p.sub, { canon, tambien: [f.nombre, ...f.alias] }));
    }
    const dependNubeRutas = dependientesDeNubeRutas(archivos, canon);
    const forma = canon.busquedas_por_forma.map((b) => ({ ...b, refs: buscarReferencias(archivos, b.tramo, { canon, exigirEnArchivo: b.exigir_en_archivo }) }));

    const cf = medicion.carpetas.find((c) => c.nombre === 'Claude Fak');
    const subClaude = cf ? Object.keys(cf.sub || {}).filter((s) => /claude/i.test(s)) : [];
    const guardian = [];
    for (const o of [...canon.nombres_carpeta_unica.map((x) => x.nombre), canon.nombre_descartado.nombre]) {
        for (const r of rutasAProbar(bib, o, canon, subClaude)) guardian.push({ nombre: o, corta: r.slice(bib.length + 1), frena: !!frenaGuardian(r) });
    }

    const reg = cf && cf.sub ? cf.sub['claude-registros'] : null;
    const chats = reg
        ? `Sí: desde el 15/10 los chats de cada PC suben solos a la nube (\`_nube.mjs --sincronizar\`, cada 2 horas; lógica en \`scripts/_lib/nubeRegistros.mjs\`), a \`Claude Fak\\claude-registros\\\`: hoy hay ${reg.archivos} archivos (${mb(reg.bytes)}) y el último llegó el ${reg.ultima}. Solo suben: todavía no bajan a la otra PC (plan del 16/10, §0 punto 11, y §7 punto 14, que lo deja decidido como cambio chico). Es lo que preguntaba \`duda.txt\`.`
        : 'No encontré la carpeta de los registros de las charlas en `Claude Fak` (no se pudo medir).';

    // las carpetas de entrada de los mails (una por persona o casilla): listar nombres no baja nada
    let entradas = [];
    try { entradas = readdirSync(join(bib, '_CUARENTENA_Claude Barack', 'mails', '_entrada')).filter((n) => esCarpeta(join(bib, '_CUARENTENA_Claude Barack', 'mails', '_entrada', n))); } catch { /* sin la carpeta: el paso 4 no las nombra */ }

    const md = renderSimulado({ canon, nombreUnico, plan, medicion, refs, dependNubeRutas, guardian, noLeidos, chats, forma, entradas });
    mkdirSync(dirname(salida), { recursive: true });
    writeFileSync(salida, md, 'utf8');
    const nCod = new Set([...refs.values()].flat().filter((x) => x.categoria !== 'texto').map((x) => `${x.origen}|${x.ruta}`)).size;
    console.log(`Listo: ${salida}`);
    console.log(`${plan.filas.length} carpetas en la lista (${aMedir.length} medidas), ${nCod} archivos de codigo o tarea que las buscan por nombre, ${dependNubeRutas.length} que dependen de Claude Fak por nubeRutas.mjs. Nada se movio.`);
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(process.argv[1]).toLowerCase()) main();

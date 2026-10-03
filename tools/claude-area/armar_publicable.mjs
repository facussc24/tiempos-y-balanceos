#!/usr/bin/env node
/**
 * armar_publicable.mjs — arma la carpeta de ORIGEN del proyecto "un Claude por area" y, si se pide, la
 * publica firmada con `scripts/_paquete.mjs --publicar --proyecto area`.
 *
 * La carpeta de origen (staging) queda con esta forma, que es la que la lista `publicar.data.json` espera:
 *   marketplace/   .claude-plugin/marketplace.json (solo el plugin barack-area) + plugins/barack-area/** (sin tests)
 *   casa/          CLAUDE.md y donde-vive.md del plugin (las reglas de la casa)
 *   conocimiento/  comun/ y una carpeta por area, tal como las deja el agente de conocimiento
 *   programas/     _paquete.mjs, sync_area.ps1, inventario.ps1
 * Al publicar, ademas, `hola/CLAUDE.md` se copia a `<1- PUBLICADO>\CLAUDE.md`: es lo que lee Claude cuando alguien
 * abre esa carpeta y escribe "instala". Ese archivo queda FUERA de lo firmado (es el arranque; ver el informe).
 *
 * USO
 *   node tools/claude-area/armar_publicable.mjs --plugin-repo C:\Dev\barack-claude [--conocimiento <carpeta>]
 *        [--salida <carpeta vacia>] [--publicar] [--nube <1- PUBLICADO>] [--clave <publicador.key>] [--nota "..."] [--simular]
 *
 * Sin dependencias. No borra nada: la salida por defecto es una carpeta nueva con fecha en la carpeta temporal.
 * Codigos de salida: 0 bien · 1 no se armo o no se publico.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../../scripts/_paquete.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ_REPO = path.resolve(AQUI, '..', '..');
export const RUTA_LISTA = path.join(AQUI, 'publicar.data.json');
export const RUTA_HOLA = path.join(AQUI, 'hola', 'CLAUDE.md');
export const RUTA_INSTALAR_CMD = path.join(AQUI, 'hola', 'Instalar.cmd');
export const NOMBRE_PLUGIN = P.NOMBRE_PLUGIN;
/** Lo que NO se copia del plugin ni del conocimiento. */
export const NO_COPIAR = new Set(['tests', 'node_modules', '.git', '__pycache__', 'tmp', 'Thumbs.db', 'desktop.ini', '.DS_Store']);
export const SUFIJOS_NO = ['.test.mjs', '.pyc', '.tmp', '.log', '.bak'];
/** [de donde (relativo a --programas-de), a donde (relativo al staging)] */
export const PROGRAMAS = [
    ['scripts/_paquete.mjs', 'programas/_paquete.mjs'],
    ['tools/claude-area/sync_area.ps1', 'programas/sync_area.ps1'],
    ['tools/claude-area/inventario.ps1', 'programas/inventario.ps1'],
];

/** Donde viaja el Node del plugin (relativo al staging). Es la ruta que `hooks/hooks.json` del plugin llama y la que
 *  la lista declara en `ejecutables`. */
export const REL_NODE = `marketplace/plugins/${P.NOMBRE_PLUGIN}/bin/node.exe`;
/** El node.exe que se publica: `CLAUDE_AREA_NODE_EXE` (las pruebas ponen uno chico) o el mismo que corre este programa. */
export function nodePorDefecto(env = process.env) {
    if (env.CLAUDE_AREA_NODE_EXE) return env.CLAUDE_AREA_NODE_EXE;
    return process.platform === 'win32' && /node\.exe$/i.test(process.execPath) ? process.execPath : null;
}

const sello = (d) => P.selloCarpeta(d);
const excluido = (nombre) => NO_COPIAR.has(nombre) || SUFIJOS_NO.some((s) => nombre.toLowerCase().endsWith(s));

/** Copia un arbol (sin enlaces, sin lo excluido). Devuelve las rutas relativas copiadas. */
function copiarArbol(origen, destino, copiados = []) {
    fs.mkdirSync(destino, { recursive: true });
    for (const d of fs.readdirSync(origen, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        if (excluido(d.name) || d.isSymbolicLink()) continue;
        const o = path.join(origen, d.name);
        const t = path.join(destino, d.name);
        if (d.isDirectory()) copiarArbol(o, t, copiados);
        else if (d.isFile()) { fs.copyFileSync(o, t); copiados.push(t); }
    }
    return copiados;
}

/**
 * Arma el staging. Devuelve { estado: 'armado'|'error', salida, errores, avisos, copiados, plugin, areas }.
 * No publica nada.
 */
export function armarPublicable({ pluginRepo, conocimiento = null, programasDe = RAIZ_REPO, salida = null, ahora = new Date(), nodeExe = nodePorDefecto() }) {
    const res = { estado: 'error', errores: [], avisos: [], salida, copiados: { marketplace: 0, casa: 0, conocimiento: 0, programas: 0 }, areas: {}, plugin: null, node: null };
    if (!pluginRepo) { res.errores.push('falta --plugin-repo (la carpeta del repo del plugin, p. ej. C:\\Dev\\barack-claude)'); return res; }
    const repo = path.resolve(pluginRepo);
    const marketplaceJson = path.join(repo, '.claude-plugin', 'marketplace.json');
    const carpetaPlugin = path.join(repo, 'plugins', NOMBRE_PLUGIN);
    const pluginJson = path.join(carpetaPlugin, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(marketplaceJson)) res.errores.push(`no encuentro el marketplace del repo del plugin: ${marketplaceJson}`);
    if (!fs.existsSync(pluginJson)) res.errores.push(`no encuentro el plugin ${NOMBRE_PLUGIN} en ${carpetaPlugin}`);
    const market = P.leerJson(marketplaceJson);
    const entrada = market && Array.isArray(market.plugins) ? market.plugins.find((p) => p && p.name === NOMBRE_PLUGIN) : null;
    if (market && !entrada) res.errores.push(`el marketplace del repo no lista el plugin ${NOMBRE_PLUGIN}`);
    const plug = P.leerJson(pluginJson);
    if (fs.existsSync(pluginJson) && !plug) res.errores.push(`el plugin.json de ${NOMBRE_PLUGIN} no se puede leer`);
    for (const [de] of PROGRAMAS) if (!fs.existsSync(path.join(programasDe, ...de.split('/')))) res.errores.push(`falta el programa ${de} en ${programasDe}`);
    if (res.errores.length) return res;

    // la salida: nueva, o vacia (lo que quede de un armado anterior se publicaria)
    const out = salida ? path.resolve(salida) : path.join(os.tmpdir(), `claude-area-publicable-${sello(ahora)}`);
    res.salida = out;
    if (fs.existsSync(out) && fs.readdirSync(out).length) { res.errores.push(`la carpeta de salida ya tiene cosas: ${out}. Pasá una vacía o nueva (lo viejo que quede ahí se publicaría)`); return res; }
    fs.mkdirSync(out, { recursive: true });

    // 1) marketplace: solo el plugin barack-area
    const nuevoMarket = {
        name: market.name || P.NOMBRE_MARKETPLACE,
        owner: market.owner || { name: 'Ingenieria Barack Mercosul' },
        description: 'Marketplace del proyecto "un Claude por area" de Barack Mercosul: solo el plugin barack-area. Lo arma tools/claude-area/armar_publicable.mjs y viaja firmado.',
        metadata: { pluginRoot: './plugins' },
        plugins: [{ ...entrada, source: `./plugins/${NOMBRE_PLUGIN}` }],
    };
    if (nuevoMarket.name !== P.NOMBRE_MARKETPLACE) res.avisos.push(`el marketplace del repo se llama "${nuevoMarket.name}" y el instalador habilita "${NOMBRE_PLUGIN}@${P.NOMBRE_MARKETPLACE}": el plugin no se va a encontrar`);
    P.escribirAtomico(path.join(out, 'marketplace', '.claude-plugin', 'marketplace.json'), `${JSON.stringify(nuevoMarket, null, 2)}\n`);
    res.copiados.marketplace = 1 + copiarArbol(carpetaPlugin, path.join(out, 'marketplace', 'plugins', NOMBRE_PLUGIN)).length;
    res.plugin = { nombre: plug.name, version: plug.version || null };

    // 1 bis) el Node del plugin. Los controles (hooks.json) lo llaman por SU ruta: asi corren en una PC que no tiene
    // Node ni Git. Si un control no puede arrancar, el programa sigue SIN frenar nada: sin este archivo no se arma.
    const destinoNode = path.join(out, ...REL_NODE.split('/'));
    if (!nodeExe || !fs.existsSync(nodeExe)) res.errores.push(`no encuentro el Node para el plugin (${nodeExe || 'esta PC no corre node.exe'}): pasá --node <ruta a node.exe>. Sin él los controles no corren en una PC sin Node`);
    else {
        fs.mkdirSync(path.dirname(destinoNode), { recursive: true });
        fs.copyFileSync(nodeExe, destinoNode);
        res.copiados.marketplace++;
        res.node = { de: nodeExe, bytes: fs.statSync(destinoNode).size };
    }

    // 2) casa: las reglas de la casa del plugin
    const casa = path.join(carpetaPlugin, 'casa');
    if (!fs.existsSync(path.join(casa, 'CLAUDE.md'))) res.errores.push(`el plugin no trae casa/CLAUDE.md (las reglas de la casa): ${casa}`);
    else res.copiados.casa = copiarArbol(casa, path.join(out, 'casa')).length;

    // 3) conocimiento: comun/ y una carpeta por area; lo suelto en la raiz es comun; otra carpeta es un error
    const dirCon = conocimiento ? path.resolve(conocimiento) : path.join(repo, 'conocimiento');
    if (!fs.existsSync(dirCon)) res.avisos.push(`todavía no existe la carpeta de conocimiento (${dirCon}): se publica sin conocimiento`);
    else {
        for (const d of fs.readdirSync(dirCon, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
            if (excluido(d.name) || d.isSymbolicLink()) continue;
            if (d.isFile()) { fs.mkdirSync(path.join(out, 'conocimiento', 'comun'), { recursive: true }); fs.copyFileSync(path.join(dirCon, d.name), path.join(out, 'conocimiento', 'comun', d.name)); res.copiados.conocimiento++; res.areas.comun = (res.areas.comun || 0) + 1; continue; }
            if (!d.isDirectory()) continue;
            const id = d.name.toLowerCase();
            if (!P.AREAS.includes(id)) { res.errores.push(`la carpeta de conocimiento "${d.name}" no es un área del contrato (${P.AREAS.join(', ')}): no se publica`); continue; }
            const n = copiarArbol(path.join(dirCon, d.name), path.join(out, 'conocimiento', id)).length;
            res.copiados.conocimiento += n;
            res.areas[id] = (res.areas[id] || 0) + n;
        }
    }

    // 4) programas
    for (const [de, a] of PROGRAMAS) {
        const destino = path.join(out, ...a.split('/'));
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.copyFileSync(path.join(programasDe, ...de.split('/')), destino);
        res.copiados.programas++;
    }

    // 5) el hola (no va adentro del staging: se copia a la raiz de 1- PUBLICADO al publicar)
    if (!fs.existsSync(RUTA_HOLA)) res.avisos.push(`no encuentro ${RUTA_HOLA}: la nube queda sin el CLAUDE.md de arranque`);

    P.escribirAtomico(path.join(out, '_ARMADO.json'), P.jsonCanonico({ armado: P.isoLocal(ahora), plugin_repo: repo, plugin: res.plugin, conocimiento: dirCon, programas_de: programasDe, copiados: res.copiados, areas: res.areas }));
    res.estado = res.errores.length ? 'error' : 'armado';
    return res;
}

/** Publica el staging con la lista del proyecto y deja el hola en la raiz de la nube. Devuelve el resultado de publicar() + `hola`. */
export function publicarPublicable({ salida, nube, clavePrivada, notas = [], simular = false, forzar = false, identidad = P.identidadLocal(), ahora = new Date(), abrirClaude = null }) {
    const lista = P.cargarLista(RUTA_LISTA);
    const r = P.publicar({ origen: salida, nube, lista, notas, simular, forzar, clavePrivada, proyecto: 'area', identidad, ahora });
    r.hola = 'no';
    if (!simular && (r.estado === 'publicado' || r.estado === 'sin_novedades') && fs.existsSync(RUTA_HOLA)) {
        const texto = fs.readFileSync(RUTA_HOLA, 'utf8');
        const destino = path.join(nube, 'CLAUDE.md');
        let actual = null;
        try { actual = fs.readFileSync(destino, 'utf8'); } catch { actual = null; }
        if (actual !== texto) { P.escribirAtomico(destino, texto); r.hola = actual === null ? 'creado' : 'actualizado'; } else r.hola = 'igual';
    }
    // el instalador de doble clic, al lado del hola (tambien fuera de lo firmado: solo llama al programa firmado).
    // Un .cmd con fines de linea de Linux falla en los saltos: se escribe siempre con CRLF.
    r.instalar_cmd = 'no';
    if (!simular && (r.estado === 'publicado' || r.estado === 'sin_novedades') && fs.existsSync(RUTA_INSTALAR_CMD)) {
        const texto = fs.readFileSync(RUTA_INSTALAR_CMD, 'utf8').replace(/\r?\n/g, '\r\n');
        const destino = path.join(nube, 'Instalar.cmd');
        let actual = null;
        try { actual = fs.readFileSync(destino, 'utf8'); } catch { actual = null; }
        if (actual !== texto) { P.escribirAtomico(destino, texto); r.instalar_cmd = actual === null ? 'creado' : 'actualizado'; } else r.instalar_cmd = 'igual';
    }
    // el interruptor de "al terminar, abrir Claude solo en la carpeta" (lo lee Instalar.cmd: vale si empieza con "si").
    // Va por CONTENIDO y no por existir: en la nube no se borra nada, asi que apagarlo es escribirle "no".
    // Sin `abrirClaude` no se toca lo que haya.
    r.abrir_claude = 'no_tocado';
    if (abrirClaude !== null && !simular && (r.estado === 'publicado' || r.estado === 'sin_novedades')) {
        const destino = path.join(nube, NOMBRE_ABRIR_CLAUDE);
        const texto = textoAbrirClaude(abrirClaude);
        let actual = null;
        try { actual = fs.readFileSync(destino, 'utf8'); } catch { actual = null; }
        if (actual !== texto) { P.escribirAtomico(destino, texto); r.abrir_claude = abrirClaude ? 'prendido' : 'apagado'; } else r.abrir_claude = 'igual';
    }
    return r;
}

export const NOMBRE_ABRIR_CLAUDE = 'abrir-claude.txt';
/** Lo que se escribe en abrir-claude.txt: la primera palabra es la que lee Instalar.cmd (solo ASCII, CRLF). */
export const textoAbrirClaude = (prendido) => `${prendido ? 'si' : 'no'}\r\n\r\nEste archivo lo lee Instalar.cmd. Si la primera linea dice "si", al terminar de instalar abre el programa\r\nClaude en la carpeta C:\\ClaudeBarack con "hola" ya escrito. Si dice "no", muestra los pasos para abrirlo a mano.\r\nLo cambia Ingenieria al publicar (--abrir-claude si|no).\r\n`;

/** Las opciones que existen; cualquier otra es un error y no se hace nada. */
export const OPCIONES_CON_VALOR = ['plugin-repo', 'conocimiento', 'programas-de', 'salida', 'nube', 'clave', 'nota', 'node', 'abrir-claude'];
export const OPCIONES_BANDERA = ['publicar', 'simular', 'forzar', 'nube-real'];

export function parsear(argv) {
    const a = { notas: [] };
    const conValor = new Set(OPCIONES_CON_VALOR);
    const banderas = new Set(OPCIONES_BANDERA);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h' || arg === '/?') { a.help = true; continue; }
        if (!arg.startsWith('--')) { a.error = `no entiendo "${arg}": las opciones empiezan con -- (probá --help)`; break; }
        const k = arg.slice(2);
        if (conValor.has(k)) {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith('--')) { a.error = `--${k} necesita un valor`; break; }
            if (k === 'nota') a.notas.push(v); else a[k] = v;
            i++;
        } else if (banderas.has(k)) a[k] = true;
        else { a.error = `opción desconocida: ${arg} (probá --help). No se hizo nada`; break; }
    }
    return a;
}

function uso() {
    console.log('Uso: node tools/claude-area/armar_publicable.mjs --plugin-repo <repo del plugin> [--conocimiento <carpeta>] [--salida <carpeta vacia>] [--node <node.exe>]');
    console.log('     [--publicar] [--nube <1- PUBLICADO>] [--clave <publicador.key>] [--nota "..."] [--simular] [--forzar]');
    console.log('     [--abrir-claude si|no]  que Instalar.cmd, al terminar, abra Claude solo en la carpeta (sin la opcion no se toca).');
    console.log('     Para publicar hay que decir a que nube: --nube, la variable CLAUDE_AREA_NUBE, o --nube-real (la de la biblioteca, buscada por nombre).');
    console.log('     --help muestra esto y no hace nada.');
}

function main() {
    const a = parsear(process.argv.slice(2));
    if (a.error) { console.error(`✗ ${a.error}`); return 1; }
    if (a.help) { uso(); return 0; }
    if (!a['plugin-repo']) { uso(); return 1; }
    if (a['abrir-claude'] !== undefined && !['si', 'no'].includes(a['abrir-claude'])) { console.error('✗ --abrir-claude lleva "si" o "no". No se hizo nada.'); return 1; }
    if (a.publicar && !a.nube && !process.env.CLAUDE_AREA_NUBE && !a['nube-real']) {
        console.error('✗ Sin --nube ni CLAUDE_AREA_NUBE, --publicar iría a la nube REAL del proyecto. Si es eso lo que querés, pasá --nube-real. No se hizo nada.');
        return 1;
    }
    const r = armarPublicable({ pluginRepo: a['plugin-repo'], conocimiento: a.conocimiento || null, programasDe: a['programas-de'] ? path.resolve(a['programas-de']) : RAIZ_REPO, salida: a.salida || null, ...(a.node ? { nodeExe: path.resolve(a.node) } : {}) });
    console.log(`Origen armado en ${r.salida || '(nada)'}`);
    for (const av of r.avisos) console.log(`  Aviso: ${av}`);
    if (r.estado !== 'armado') { console.error(`✗ No se armó (${r.errores.length} problema(s)):`); for (const e of r.errores) console.error(`    - ${e}`); return 1; }
    console.log(`  plugin ${r.plugin.nombre} ${r.plugin.version || ''} (${r.copiados.marketplace} archivos) · casa ${r.copiados.casa} · conocimiento ${r.copiados.conocimiento} (${Object.entries(r.areas).map(([k, v]) => `${k} ${v}`).join(', ') || 'nada'}) · programas ${r.copiados.programas}`);
    if (!a.publicar) { console.log('Sin --publicar no se publica nada. Para publicar: agregá --publicar (y --simular para ver qué pasaría).'); return 0; }

    const env = process.env;
    const nube = a.nube ? path.resolve(a.nube) : (env.CLAUDE_AREA_NUBE ? path.join(path.resolve(env.CLAUDE_AREA_NUBE), P.PROYECTOS.area.publicado) : P.buscarNube(undefined, 'area'));
    const clavePrivada = a.clave ? path.resolve(a.clave) : P.rutaClavePrivadaPorDefecto(env);
    const p = publicarPublicable({ salida: r.salida, nube, clavePrivada, notas: a.notas, simular: !!a.simular, forzar: !!a.forzar, abrirClaude: a['abrir-claude'] === undefined ? null : a['abrir-claude'] === 'si' });
    console.log(`Nube → ${nube || '(sin carpeta de nube)'}`);
    if (p.estado === 'rechazado') { console.error(`✗ NO SE PUBLICO NADA (${p.errores.length} problema(s)):`); for (const e of p.errores.slice(0, 40)) console.error(`    - ${e}`); return 1; }
    for (const av of p.avisos) console.log(`  Aviso: ${av}`);
    if (p.estado === 'simulado') { console.log(`Simulado: se publicaría la versión ${p.version} (${p.nuevos.length} nuevos, ${p.cambiados.length} cambiados, ${p.retirados.length} retirados). No se escribió nada.`); return 0; }
    const abrir = p.abrir_claude && p.abrir_claude !== 'no_tocado' ? `; abrir Claude solo: ${p.abrir_claude}` : '';
    if (p.estado === 'sin_novedades') { console.log(`Sin novedades: la versión ${p.version} ya es igual a lo armado (hola: ${p.hola}${abrir}).`); return 0; }
    console.log(`✓ Publicada la versión ${p.version}: ${p.archivos} archivos, ${p.firmada ? 'firmada' : 'SIN FIRMA'}; hola: ${p.hola}${abrir}.`);
    return 0;
}

const comoScript = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (comoScript) process.exitCode = main();

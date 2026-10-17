#!/usr/bin/env node
/**
 * ajustar_settings.mjs - deja el settings.json de Claude Code de Fak (el que viaja por la nube de Ingenieria) listo para
 * OTRA PC, sin las cosas que son de la PC de origen:
 *   - las rutas de usuario (C:\Users\<otro>\...) pasan a la carpeta de usuario de esta PC (los hooks las usan);
 *   - env.PATH sale: es la lista de carpetas de la otra PC y pisaria la de esta;
 *   - el asistente "por area" (plugin barack-area@barack) queda apagado y su marketplace sale: es el que contesta
 *     «instalar programas es de la administracion» (08/10/2026, notebook de Calidad).
 *
 * Uso: node ajustar_settings.mjs --origen <settings.json de la nube> --destino <~/.claude/settings.json> --home <carpeta de usuario>
 *      [--ensayo]   (dice que haria, no escribe)
 * Si el destino ya existe, antes se guarda una copia como settings.json.antes-del-instalador (una sola vez).
 * Escribe UN renglon JSON con el resultado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_POR_AREA = 'barack-area@barack';
export const MARKETPLACE_POR_AREA = 'barack';

const RE_USUARIO = /([A-Za-z]:)([\\/])Users\2([^\\/"\s]+)/g;

/**
 * Los hooks GLOBALES de la casa (~/.claude/hooks): toda PC de Fak los tiene que tener cableados en su settings.json
 * (tanda 1.7 del plan del sistema, 16/10/2026). Viajan por la nube con `_nube.mjs` (claude-config\hooks); el cableado no
 * viaja tal cual porque trae la carpeta de usuario de la PC de origen: se arma aca con la de ESTA PC.
 */
export const HOOKS_GLOBALES = [
    { archivo: 'agentes-guard.sh', evento: 'PreToolUse', matcher: 'Agent|Task|Workflow', arg: '' },
    { archivo: 'carpeta-guard.sh', evento: 'SessionStart', matcher: 'startup|resume|clear|compact', arg: 'inicio' },
    { archivo: 'carpeta-guard.sh', evento: 'UserPromptSubmit', matcher: '', arg: 'prompt' },
    { archivo: 'pedidos-pendientes.sh', evento: 'SessionStart', matcher: 'startup|resume|clear|compact', arg: '' },
];

/** El comando con que se cablea un hook global, con la carpeta de usuario de esta PC y barras normales (como el de agentes-guard). */
export function comandoHook(home, h) {
    const base = String(home).replace(/\\/g, '/').replace(/\/+$/, '');
    return `bash "${base}/.claude/hooks/${h.archivo}"${h.arg ? ` ${h.arg}` : ''}`;
}

/** El .sh de un hook global en ESTA PC (~/.claude/hooks/<archivo>). */
const rutaHook = (home, archivo) => path.join(String(home).replace(/\//g, '\\'), '.claude', 'hooks', archivo);

/**
 * Cablea en `settings.hooks` los hooks globales que falten; los que ya estan (con cualquier forma de ruta o de comillas)
 * no se tocan ni se duplican, y un hook cuyo .sh NO esta en esta PC no se cablea (bash saldria con 127 en cada mensaje;
 * auditor 16/10, H2): se anota en `saltados`. Devuelve los nombres de los que agrego.
 * @param {{existe?: (ruta: string) => boolean, saltados?: string[]}} [o] `existe` se inyecta en los tests.
 */
export function asegurarHooksGlobales(settings, home, { existe = (r) => fs.existsSync(r), saltados = [] } = {}) {
    if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) settings.hooks = {};
    const agregados = [];
    for (const h of HOOKS_GLOBALES) {
        const lista = Array.isArray(settings.hooks[h.evento]) ? settings.hooks[h.evento] : [];
        // "/.claude/hooks/<archivo>" seguido del argumento (si lo lleva) y fin, con comillas de cualquier tipo o sin ellas.
        const re = new RegExp(`[\\\\/]\\.claude[\\\\/]hooks[\\\\/]${h.archivo.replace(/\./g, '\\.')}["']?${h.arg ? `\\s+${h.arg}` : ''}\\s*$`, 'i');
        const ya = lista.some((g) => (g && Array.isArray(g.hooks) ? g.hooks : []).some((x) => re.test(String((x && x.command) || '').trim())));
        if (ya) continue;
        const etiqueta = `${h.archivo}${h.arg ? ` ${h.arg}` : ''}`;
        if (!existe(rutaHook(home, h.archivo))) { saltados.push(etiqueta); continue; }
        if (!Array.isArray(settings.hooks[h.evento])) settings.hooks[h.evento] = [];   // la lista del evento nace recien al cablear
        settings.hooks[h.evento].push({ matcher: h.matcher, hooks: [{ type: 'command', command: comandoHook(home, h) }] });
        agregados.push(etiqueta);
    }
    return agregados;
}

/** Las carpetas de usuario que aparecen en los valores del settings y NO son la de `home` (ni Public ni un nombre corto 8.3). */
export function usuariosAjenos(settings, home) {
    const propio = String(home).replace(/[\\/]+$/, '').split(/[\\/]/).pop().toLowerCase();
    const vistos = new Set();
    const recorrer = (v) => {
        if (typeof v === 'string') {
            for (const m of v.matchAll(RE_USUARIO)) {
                const u = m[3];
                if (u.toLowerCase() !== propio && u.toLowerCase() !== 'public' && !u.includes('~')) vistos.add(u);
            }
        } else if (Array.isArray(v)) v.forEach(recorrer);
        else if (v && typeof v === 'object') Object.values(v).forEach(recorrer);
    };
    recorrer(settings);
    return [...vistos];
}

/**
 * @param {string} texto  contenido del settings.json de origen
 * @param {{home: string}} o  carpeta de usuario de ESTA PC (C:\Users\xxx)
 * @returns {{texto: string, cambios: string[]}}
 */
export function ajustarSettings(texto, { home, existe } = {}) {
    const j = JSON.parse(String(texto).replace(/^\uFEFF/, ''));
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('el settings.json no es un objeto');
    const cambios = [];
    const homeNorm = String(home).replace(/[\\/]+$/, '');
    const usuarioNuevo = homeNorm.split(/[\\/]/).pop();
    let rutas = 0;
    const recorrer = (v) => {
        if (typeof v === 'string') {
            return v.replace(RE_USUARIO, (m, unidad, sep, usuario) => {
                if (usuario.toLowerCase() === usuarioNuevo.toLowerCase()) return m;
                rutas++;
                return homeNorm.split(/[\\/]/).join(sep);
            });
        }
        if (Array.isArray(v)) return v.map(recorrer);
        if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = recorrer(x); return o; }
        return v;
    };
    const r = recorrer(j);
    if (rutas) cambios.push(`${rutas} ruta(s) de la otra PC pasadas a ${homeNorm}`);
    if (r.env && typeof r.env === 'object' && 'PATH' in r.env) { delete r.env.PATH; cambios.push('env.PATH de la otra PC sacado'); }
    if (r.enabledPlugins && typeof r.enabledPlugins === 'object' && r.enabledPlugins[PLUGIN_POR_AREA] !== false && PLUGIN_POR_AREA in r.enabledPlugins) {
        r.enabledPlugins[PLUGIN_POR_AREA] = false;
        cambios.push('asistente por area apagado');
    }
    if (r.extraKnownMarketplaces && typeof r.extraKnownMarketplaces === 'object' && MARKETPLACE_POR_AREA in r.extraKnownMarketplaces) {
        delete r.extraKnownMarketplaces[MARKETPLACE_POR_AREA];
        cambios.push('marketplace del asistente por area sacado');
    }
    const saltados = [];
    const hooks = asegurarHooksGlobales(r, homeNorm, { ...(existe ? { existe } : {}), saltados });
    if (hooks.length) cambios.push(`${hooks.length} hook(s) globales cableados: ${hooks.join(', ')}`);
    if (saltados.length) cambios.push(`${saltados.length} hook(s) globales sin cablear porque su .sh no esta en esta PC: ${saltados.join(', ')}`);
    return { texto: `${JSON.stringify(r, null, 2)}\n`, cambios };
}

/**
 * El settings.json que `_nube.mjs --bajar` acaba de dejar en ESTA PC (o el que `--sincronizar` encuentra): si sus valores
 * traen rutas de OTRO usuario es el de la PC de origen y se ajusta entero (ajustarSettings); si ya es de esta PC, solo se
 * cablean los hooks globales que falten y cuyo .sh existe (el PATH y lo demas quedan). Con `dryRun` (lo que _nube.mjs hace
 * sin --aplicar) dice que cambiaria y no toca el archivo. Lo que se va a escribir se vuelve a leer como JSON ANTES de
 * escribirlo; no quedan archivos aparte (auditor 16/10, H3 y H16).
 * @returns {{cambios: string[], dryRun: boolean}} cambios vacio = no habia nada que ajustar.
 */
export function ajustarSettingsLocal(ruta, { home, dryRun = false, existe } = {}) {
    const texto = fs.readFileSync(ruta, 'utf8');
    const j = JSON.parse(String(texto).replace(/^﻿/, ''));
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('el settings.json no es un objeto');
    let salida; let cambios;
    if (usuariosAjenos(j, home).length) {
        ({ texto: salida, cambios } = ajustarSettings(texto, { home, existe }));
    } else {
        const saltados = [];
        const hooks = asegurarHooksGlobales(j, home, { ...(existe ? { existe } : {}), saltados });
        if (!hooks.length) return { cambios: [], dryRun };
        salida = `${JSON.stringify(j, null, 2)}\n`;
        cambios = [`${hooks.length} hook(s) globales cableados: ${hooks.join(', ')}`];
        if (saltados.length) cambios.push(`${saltados.length} sin cablear porque su .sh no esta en esta PC: ${saltados.join(', ')}`);
    }
    if (dryRun) return { cambios, dryRun };
    JSON.parse(salida);                      // lo que se va a escribir se lee entero antes de tocar el archivo
    fs.writeFileSync(ruta, salida, 'utf8');
    return { cambios, dryRun };
}

function leerArgs(argv) {
    const a = {};
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        if (k === '--ensayo') a.ensayo = true;
        else if (k.startsWith('--') && i + 1 < argv.length) a[k.slice(2)] = argv[++i];
    }
    return a;
}

const mismaRuta = (a, b) => { const r = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } }; return r(a).toLowerCase() === r(b).toLowerCase(); };
if (process.argv[1] && mismaRuta(process.argv[1], fileURLToPath(import.meta.url))) {
    const a = leerArgs(process.argv.slice(2));
    const salir = (o, c) => { process.stdout.write(`${JSON.stringify(o)}\n`); process.exit(c); };
    if (!a.origen || !a.destino || !a.home) salir({ resultado: 'error', detalle: 'faltan --origen, --destino y --home' }, 1);
    try {
        const { texto, cambios } = ajustarSettings(fs.readFileSync(a.origen, 'utf8'), { home: a.home });
        let respaldo = null;
        if (!a.ensayo) {
            fs.mkdirSync(path.dirname(a.destino), { recursive: true });
            if (fs.existsSync(a.destino)) {
                respaldo = `${a.destino}.antes-del-instalador`;
                if (!fs.existsSync(respaldo)) fs.copyFileSync(a.destino, respaldo); else respaldo = null;
            }
            const tmp = `${a.destino}.${process.pid}.nuevo`;
            fs.writeFileSync(tmp, texto, 'utf8');
            JSON.parse(fs.readFileSync(tmp, 'utf8'));      // lo escrito se vuelve a leer
            fs.renameSync(tmp, a.destino);
        }
        salir({ resultado: a.ensayo ? 'ensayo' : 'ok', cambios, respaldo }, 0);
    } catch (e) {
        salir({ resultado: 'error', detalle: String(e && e.message ? e.message : e).slice(0, 200) }, 1);
    }
}

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
 * @param {string} texto  contenido del settings.json de origen
 * @param {{home: string}} o  carpeta de usuario de ESTA PC (C:\Users\xxx)
 * @returns {{texto: string, cambios: string[]}}
 */
export function ajustarSettings(texto, { home }) {
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
    return { texto: `${JSON.stringify(r, null, 2)}\n`, cambios };
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

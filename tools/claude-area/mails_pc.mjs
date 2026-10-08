#!/usr/bin/env node
/**
 * mails_pc.mjs - deja en la nube de Ingenieria los mails de TRABAJO de una PC con mas de una cuenta de Outlook, en segundo
 * plano y sin Claude. Caso: la notebook de Calidad (08/10/2026): Fak pidio que todos los mails de las cuentas de Calidad que
 * hay en esa PC aparezcan en la suya.
 *
 * Es el mismo programa de mails_area.mjs (el mismo filtro de lo privado, la misma lista de lo privado, el mismo lector de
 * Outlook, solo lectura) corrido UNA VEZ POR CUENTA. Lo que agrega:
 *   - Descubre las cuentas: le pregunta al Outlook abierto que buzones tiene (`mails_outlook.ps1 -Listar`).
 *   - Elige cuales suben. Sube una cuenta si es de la empresa (@barackmercosul.com) Y su casilla trae alguna de las palabras de
 *     `incluir` de la configuracion (por defecto «calidad»), Y no es de lo privado, Y no la saco Ingenieria. Todo lo demas se
 *     lista como «no sube», con el motivo, para que se vea que se dejo afuera.
 *   - Cada cuenta va a su carpeta (`_entrada\<lo de antes de la arroba>`) y lleva su propio estado y su propia lista de lo ya
 *     subido, asi que una cuenta que se corta no frena a las otras.
 *   - Sin el dia de espera ni el aviso: la persona es quien lo instalo y lo pidio (mails_area.mjs `sinEspera`).
 *
 * Quien decide: la configuracion que dejo el instalador en ESTA PC (`estado\config.json`: de quien es la PC y que cuentas
 * entran) y, desde la nube, un archivo de control que SOLO puede apagar o sacar cuentas, nunca sumar:
 *   <carpeta de mails>\_control\<NOMBRE DE LA PC>.json   { "apagado": true, "excluir": ["otra@barackmercosul.com"] }
 * (para apagarla desde Ingenieria; para sumar una cuenta se vuelve a correr el instalador con la lista nueva).
 *
 * Uso (desde su instalacion, `<raiz>\programas\`):
 *   node mails_pc.mjs --raiz <raiz> --carpeta-mails "<biblioteca de Ingenieria>\...\mails"
 *        [--inventario] [--simular] [--max-minutos 15]
 *   --inventario  no lee ningun mail: dice que cuentas tiene el Outlook y cuales subirian.
 * Escribe UN renglon JSON con el resultado. Codigos: 0 bien (incluye «apagado» y «sin_casillas») - 1 error - 3 esta no es la
 * PC de la configuracion - 4 Outlook clasico no esta abierto o no contesta - 5 falta lo privado - 6 no se ve la nube.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
    correr, casillaLimpia, cargarPrivados, esPrivada, carpetaDeMailsIndicada, autorDe, normalizar, mismaPc, identidadReal, isoLocal,
} from './mails_area.mjs';

export const DOMINIO = 'barackmercosul.com';
export const INCLUIR_POR_DEFECTO = ['calidad'];
export const DIAS_ATRAS_PC = 3650;       // «todos los mails que haya»: el primer pasaje trae todo lo que hay, lo mas nuevo primero
export const MAX_MINUTOS_PC = 15;
export const SEGUNDOS_DE_LISTAR = 120;

const leerJson = (ruta) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } };
const esArchivo = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

/** Los textos de una lista de la configuracion: solo los que son texto, en minusculas y sin repetir. */
const textos = (v) => [...new Set((Array.isArray(v) ? v : []).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().toLowerCase()))];

function coincidePc(archivo, pc) {
    if (!archivo || !pc) return false;
    const base = archivo.replace(/\.json$/i, '');
    const a = normalizar(base);
    const b = normalizar(pc);
    if (!a || !b) return false;
    if (a === b) return true;
    const cortoA = a.split('.')[0];
    const cortoB = b.split('.')[0];
    if (cortoA === cortoB) return true;
    if (cortoA.slice(0, 15) === cortoB.slice(0, 15)) return true;
    return mismaPc(a, b) || mismaPc(b, a);
}

/**
 * El archivo de control de la nube: SOLO puede apagar o sacar cuentas. Cualquier otra cosa que traiga (sumar cuentas, otra
 * lista de «incluir») no cuenta. Si existe pero no se puede leer, asume apagado por seguridad (fail-closed).
 */
export function leerControl(carpetaMails, pc) {
    const vacio = { apagado: false, excluir: [] };
    if (!carpetaMails || !pc) return vacio;
    const dir = path.join(carpetaMails, '_control');
    let nombre = null;
    try {
        const archivos = fs.readdirSync(dir);
        nombre = archivos.find((n) => n.toLowerCase().endsWith('.json') && coincidePc(n, pc)) || null;
    } catch {
        return vacio;
    }
    if (!nombre) return vacio;
    const cerradoPorSeguridad = {
        apagado: true,
        excluir: [],
        ilegible: true,
        detalle: 'el archivo de control de esta PC no se puede leer (asume apagado por seguridad)',
    };
    let contenido = null;
    try {
        contenido = fs.readFileSync(path.join(dir, nombre), 'utf8').replace(/^\uFEFF/, '').trim();
    } catch {
        return cerradoPorSeguridad;
    }
    if (!contenido) return cerradoPorSeguridad;
    let d = null;
    try {
        d = JSON.parse(contenido);
    } catch {
        return cerradoPorSeguridad;
    }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return cerradoPorSeguridad;
    return { apagado: d.apagado === true, excluir: textos(d.excluir).map((x) => casillaLimpia(x)).filter(Boolean) };
}

/**
 * Comprueba si el fragmento local de la casilla contiene la palabra de forma segura:
 * evita que cadenas cortas (como "." o "a") matcheen casillas personales.
 * Exige largo minimo seguro (al menos 3 caracteres alfanumericos) y coincidencia de
 * palabra completa (token), prefijo numerado (ej: calidad2) o palabra de largo seguro (>= 4).
 */
function matcheaPalabra(local, palabra) {
    const p = normalizar(palabra).replace(/[^a-z0-9]/g, '');
    if (!p || p.length < 3) return false;
    const tokens = normalizar(local).split(/[^a-z0-9]+/g).filter(Boolean);
    if (tokens.includes(p)) return true;
    if (tokens.some((tok) => tok.startsWith(p) && /^\d+$/.test(tok.slice(p.length)))) return true;
    if (p.length >= 4 && tokens.some((tok) => tok.includes(p))) return true;
    return false;
}

/**
 * Cuales de los buzones del Outlook suben. Funcion pura (la prueban sin Outlook).
 * `buzones`: [{ casilla, nombre, tipo, predeterminada }] como los lista el lector. Devuelve { suben, omitidas }; cada una trae
 * su motivo: sin_casilla · carpeta_publica · otro_dominio · no_es_de_calidad · privada · excluida · repetida.
 */
export function elegirCasillas(buzones, config, priv, control = { excluir: [] }) {
    const incluir = textos(config && config.incluir);
    const palabras = (incluir.length ? incluir : INCLUIR_POR_DEFECTO).filter((x) => !x.includes('@'));
    const exactas = (incluir.length ? incluir : []).filter((x) => x.includes('@')).map(casillaLimpia).filter(Boolean);
    const dominio = String((config && config.dominio) || DOMINIO).toLowerCase();
    const sacadas = new Set((control.excluir || []).map(casillaLimpia).filter(Boolean));
    const suben = [];
    const omitidas = [];
    const vistas = new Set();
    // el buzon principal primero: si una casilla esta dos veces, queda el principal
    const orden = [...(Array.isArray(buzones) ? buzones : [])].sort((a, b) => (b && b.predeterminada === true) - (a && a.predeterminada === true));
    for (const b of orden) {
        if (!b || typeof b !== 'object') continue;
        const casilla = casillaLimpia(b.casilla);
        const base = { casilla: casilla || '', nombre: String(b.nombre ?? ''), tipo: String(b.tipo ?? 'otro') };
        if (!casilla) { omitidas.push({ ...base, motivo: 'sin_casilla' }); continue; }
        if (base.tipo === 'publica') { omitidas.push({ ...base, motivo: 'carpeta_publica' }); continue; }
        if (casilla.split('@')[1] !== dominio) { omitidas.push({ ...base, motivo: 'otro_dominio' }); continue; }
        if (esPrivada(casilla, priv)) { omitidas.push({ ...base, motivo: 'privada' }); continue; }
        if (sacadas.has(casilla)) { omitidas.push({ ...base, motivo: 'excluida' }); continue; }
        const local = normalizar(casilla.split('@')[0]);
        if (!exactas.includes(casilla) && !palabras.some((p) => matcheaPalabra(local, p))) { omitidas.push({ ...base, motivo: 'no_es_de_calidad' }); continue; }
        if (vistas.has(casilla)) { omitidas.push({ ...base, motivo: 'repetida' }); continue; }
        vistas.add(casilla);
        const autor = autorDe({ mail: casilla });
        if (!autor) { omitidas.push({ ...base, motivo: 'sin_casilla' }); continue; }
        suben.push({ ...base, autor });
    }
    return { suben, omitidas };
}

/** Le pregunta al Outlook abierto que buzones tiene (el lector con -Listar). Nunca tira: dice que paso. */
export async function listarCasillas({ lector, env, segundos = SEGUNDOS_DE_LISTAR }) {
    const salida = { buzones: [], outlook: null, completa: false };
    const ps = path.join(env.SystemRoot || env.SYSTEMROOT || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    if (!esArchivo(lector)) { salida.outlook = { estado: 'error', detalle: 'no esta el lector de Outlook' }; return salida; }
    const hijo = spawn(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', lector, '-Listar'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    hijo.on('error', () => { salida.outlook = { estado: 'error', detalle: 'no pude arrancar el lector de Outlook (PowerShell)' }; });
    const cortar = () => { try { hijo.kill(); } catch { /* ya termino */ } };
    const reloj = setTimeout(() => { salida.outlook = salida.outlook || { estado: 'no_responde', detalle: 'Outlook no contesto a tiempo' }; cortar(); }, segundos * 1000);
    try {
        const rl = readline.createInterface({ input: hijo.stdout, crlfDelay: Infinity });
        for await (const ln of rl) {
            let j;
            try { j = JSON.parse(ln); } catch { continue; }
            if (!j || typeof j !== 'object') continue;
            if (j.t === 'casilla') salida.buzones.push({ casilla: String(j.casilla ?? ''), nombre: String(j.nombre ?? ''), tipo: String(j.tipo ?? 'otro'), predeterminada: j.predeterminada === true });
            else if (j.t === 'estado') salida.outlook = { estado: String(j.estado || 'error'), detalle: String(j.detalle || '') };
            else if (j.t === 'fin') salida.completa = j.completa === true;
        }
    } finally { clearTimeout(reloj); cortar(); }
    if (!salida.completa && !salida.outlook) salida.outlook = { estado: 'no_responde', detalle: 'el lector de Outlook no termino' };
    return salida;
}

const CODIGO = { ok: 0, parcial: 0, apagado: 0, sin_casillas: 0, inventario: 0, simulado: 0, pausado: 0, error: 1, sin_config: 1, otra_pc: 3, outlook_cerrado: 4, outlook_nuevo: 4, sin_outlook: 4, outlook_no_responde: 4, sin_filtro: 5, filtro_incompleto: 5, sin_nube: 6 };
const DE_OUTLOOK = { cerrado: 'outlook_cerrado', nuevo: 'outlook_nuevo', no_instalado: 'sin_outlook', no_responde: 'outlook_no_responde' };

/**
 * Una corrida. `opciones`: { raiz, carpetaMails, inventario, simular, maxMinutos } (la raiz es `...\BarackMailsPC`: ahi estan
 * `programas`, `casa` —con la lista de lo privado— y `estado` —con config.json—). SOLO PARA LAS PRUEBAS (no llegan por la
 * linea de comandos): { config, listar, fuentes (casilla -> .jsonl), lector, ahora, env, identidad, segundosSinRespuesta }.
 * Devuelve { codigo, resumen } y no tira excepciones por lo esperable.
 */
export async function correrPc(opciones) {
    const env = opciones.env || process.env;
    const raiz = path.resolve(opciones.raiz);
    const casa = path.join(raiz, 'casa');
    const estado = path.join(raiz, 'estado');
    const fin = (resultado, extra = {}) => ({ codigo: CODIGO[resultado] ?? 1, resumen: { resultado, ...extra } });

    const config = opciones.config || leerJson(path.join(estado, 'config.json'));
    if (!config || typeof config !== 'object' || !config.pc || !config.usuario) return fin('sin_config', { detalle: 'no esta la configuracion de esta PC (la deja el instalador)' });
    const real = opciones.identidad && typeof opciones.identidad === 'object' ? opciones.identidad : identidadReal();
    if (!mismaPc(config.pc, real.pc) || normalizar(config.usuario) !== normalizar(real.usuario)) {
        return fin('otra_pc', { detalle: 'la configuracion es de otra PC u otro usuario de Windows: no leo nada', pc: real.pc });
    }
    const carpetaMails = carpetaDeMailsIndicada(opciones.carpetaMails);
    if (!carpetaMails) return fin('sin_nube', { pc: real.pc, detalle: 'no veo la biblioteca de Ingenieria (se reintenta)' });

    const control = leerControl(carpetaMails, real.pc);
    if (control.apagado) return fin('apagado', { pc: real.pc, detalle: control.detalle || 'Ingenieria la apago desde la nube' });

    const priv = cargarPrivados(path.join(casa, 'publicado', 'conocimiento', 'comun', 'mails_privados.json'));
    if (priv.estado === 'falta' || priv.estado === 'roto') return fin('sin_filtro', { pc: real.pc, detalle: 'no esta la lista de lo privado en lo instalado, o no se puede leer' });
    if (priv.estado === 'incompleto') return fin('filtro_incompleto', { pc: real.pc, detalle: 'la lista de lo privado esta sin completar o mal escrita' });

    const lector = opciones.lector || path.join(path.dirname(fileURLToPath(import.meta.url)), 'mails_outlook.ps1');
    const lista = opciones.listar ? await opciones.listar() : await listarCasillas({ lector, env });
    if (lista.outlook && lista.buzones.length === 0) return fin(DE_OUTLOOK[lista.outlook.estado] || 'error', { pc: real.pc, detalle: lista.outlook.detalle });

    const { suben, omitidas } = elegirCasillas(lista.buzones, config, priv, control);
    const cuentas = lista.buzones.map((b) => ({ casilla: b.casilla, nombre: b.nombre, tipo: b.tipo }));
    if (opciones.inventario) return fin('inventario', { pc: real.pc, cuentas, suben: suben.map((s) => s.casilla), omitidas });
    if (suben.length === 0) return fin('sin_casillas', { pc: real.pc, cuentas, omitidas, detalle: 'ninguna cuenta de este Outlook es de Calidad: no se copia nada' });

    // el tiempo se reparte entre las cuentas: una que se corta no deja a las otras sin su turno
    const total = Number(opciones.maxMinutos) > 0 ? Number(opciones.maxMinutos) : MAX_MINUTOS_PC;
    const porCuenta = Math.max(2, Math.floor(total / suben.length));
    const dias = Number(config.dias_atras) > 0 ? Number(config.dias_atras) : DIAS_ATRAS_PC;
    const gracia = Number.isFinite(config.gracia_horas) && config.gracia_horas >= 0 ? config.gracia_horas : 0;
    const resultados = [];
    for (const s of suben) {
        const r = await correr({
            home: casa, estado: path.join(estado, s.autor), carpetaMails,
            persona: { nombre: s.nombre || s.autor, mail: s.casilla, mails: 'sube' },
            buzonPorCasilla: true, sinEspera: true, graciaHoras: gracia, diasAtras: dias, maxMinutos: porCuenta,
            simular: opciones.simular, lector, env, ahora: opciones.ahora, identidad: real, segundosSinRespuesta: opciones.segundosSinRespuesta,
            fuenteJsonl: opciones.fuentes ? opciones.fuentes[s.casilla] : undefined,
        });
        const x = r.resumen;
        resultados.push({
            casilla: s.casilla, autor: s.autor, tipo: s.tipo, resultado: x.resultado, detalle: x.detalle,
            revisados: x.revisados, nuevos: x.nuevos, entrada: x.entrada, cuarentena: x.cuarentena, privado: x.privado, fallados: x.fallados, completa: x.completa,
        });
    }
    const buenas = resultados.filter((x) => x.resultado === 'ok' || x.resultado === 'parcial' || x.resultado === 'simulado' || x.resultado === 'pausado');
    const resultado = resultados.every((x) => x.resultado === 'ok') ? 'ok' : (buenas.length ? 'parcial' : resultados[0].resultado);
    return fin(resultado, { pc: real.pc, escrito: isoLocal(opciones.ahora instanceof Date ? opciones.ahora : new Date()), casillas: resultados, omitidas });
}

function leerArgs(argv) {
    const a = {};
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        if (k === '--simular') a.simular = true;
        else if (k === '--inventario') a.inventario = true;
        else if (k.startsWith('--') && i + 1 < argv.length) a[k.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    }
    return a;
}

const mismaRuta = (a, b) => { const r = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } }; return r(a).toLowerCase() === r(b).toLowerCase(); };
const esElPrograma = !!process.argv[1] && mismaRuta(process.argv[1], fileURLToPath(import.meta.url));
if (esElPrograma) {
    const a = leerArgs(process.argv.slice(2));
    const salir = (resumen, codigo) => { process.stdout.write(`${JSON.stringify(resumen)}\n`); process.exit(codigo); };
    if (!a.raiz) salir({ resultado: 'error', detalle: 'falta --raiz' }, 1);
    // Corre solo desde su instalacion (`<raiz>\programas\`) y con la casa y la configuracion de ESA raiz: por la linea de
    // comandos no hay otra fuente de mails, ni otro lector, ni otra configuracion, ni otra hora.
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    if (path.basename(aqui).toLowerCase() !== 'programas' || !mismaRuta(a.raiz, path.resolve(aqui, '..'))) {
        salir({ resultado: 'error', detalle: 'este programa corre solo desde su instalacion y con la configuracion de esa instalacion' }, 1);
    }
    correrPc({ raiz: a.raiz, carpetaMails: a.carpetaMails, inventario: a.inventario, simular: a.simular, maxMinutos: a.maxMinutos })
        .then(({ codigo, resumen }) => salir(resumen, codigo))
        .catch((e) => salir({ resultado: 'error', detalle: String(e && e.message ? e.message : e).slice(0, 200) }, 1));
}

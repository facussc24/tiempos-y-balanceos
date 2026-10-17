#!/usr/bin/env node
/**
 * _automatizacionCandidatos.mjs — de donde salen los candidatos de la cola de automatizacion de Barack para Pedro
 * (plan del sistema 16/10/2026, tanda 8 punto 2 bis; cola en la nube de Ingenieria: `AUTOMATIZACION BARACK\cola.md`).
 *
 * Una vez por quincena relee los mails de la casa (la copia local que arma `scripts/_mails.py`) buscando los
 * procesos largos nombrados (ECR/ECO, arb, BeOn, la impresora) y los que se hacen "a mano", y PROPONE filas para la
 * cola, cada una con la cita del mail de donde sale. No decide: Fak elige cuales suben a la cola.
 *
 *   node scripts/_automatizacionCandidatos.mjs                 propuesta de los ultimos 15 dias, por pantalla
 *   node scripts/_automatizacionCandidatos.mjs --dias 120      otra ventana
 *   node scripts/_automatizacionCandidatos.mjs --out <archivo> ademas la deja en ese archivo (nunca en la cola)
 *   node scripts/_automatizacionCandidatos.mjs --cola <ruta>   la cola contra la que se marca "ya esta" (si no, la de la nube)
 *   node scripts/_automatizacionCandidatos.mjs --mails <ruta>  el _mails.py a usar (si no, el del checkout que tenga .mail-cache)
 *
 * Lo que NO hace, a proposito:
 *   - No abre Outlook ni escribe en el buzon: a `_mails.py` solo le pide `--buscar` y `--ver`, que leen la copia local
 *     (`llamarMails()` frena cualquier otra opcion; el test lo prueba y busca en este archivo las que abren Outlook).
 *   - No pisa la cola: `--out` se niega si apunta a `cola.md`. La cola la edita Fak (o una sesion con su OK).
 *   - No copia una clave: toda cita pasa por `taparClaves()` (la clave de API de Pedro estuvo en un mail suyo del 09/10).
 * Las palabras que busca viven en `scripts/_lib/automatizacionCandidatos.data.json`. Test:
 * `__tests__/scripts/automatizacionCandidatos.test.mjs`. Salida: 0 bien, 1 error de uso o de lectura.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buscarBiblioteca } from './_lib/nubeRutas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, '_lib', 'automatizacionCandidatos.data.json'), 'utf8'));

/** Las dos unicas opciones de `_mails.py` que se usan: las dos leen la copia local, ninguna abre Outlook. */
export const OPCIONES_PERMITIDAS = Object.freeze(['--buscar', '--ver']);

/** Tapa claves de API y tokens para que no viajen en una cita (patron de Anthropic y genericos largos). */
export function taparClaves(texto) {
    return String(texto ?? '')
        .replace(/sk-ant-[A-Za-z0-9_\-]{8,}/g, '[clave retirada]')
        .replace(/\b(sk|pk|rk)-[A-Za-z0-9]{20,}\b/g, '[clave retirada]')
        .replace(/\b(api[_ ]?key|token|clave)\s*[:=]\s*\S{12,}/gi, '$1: [clave retirada]');
}

/**
 * La propuesta se guarda en la nube de Ingenieria, y ahi ningun documento nombra al asistente ni a su fabricante
 * (`core-prohibiciones.md` §9). Una cita que los nombra se deja con una marca entre corchetes, que se ve como edicion.
 */
export function sinMarcaDelAsistente(texto) {
    return String(texto ?? '')
        .replace(/(?<![a-z])(?<!jean-)claude(?![a-z])/gi, '[el asistente]')
        .replace(/anthropic/gi, '[el proveedor]');
}

/** Lee la salida de `_mails.py --buscar` (texto) y devuelve los mails: fecha, asunto, de, para, id. */
export function parsearBusqueda(texto) {
    const mails = [];
    let actual = null;
    for (const cruda of String(texto ?? '').split(/\r?\n/)) {
        const linea = cruda.replace(/\s+$/, '');
        const cab = linea.match(/^\[(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?)\]\s+(.*)$/);
        if (cab) {
            actual = { fecha: cab[1], asunto: cab[2].trim(), de: '', carpeta: '', para: '', id: '' };
            mails.push(actual);
            continue;
        }
        if (!actual) continue;
        const de = linea.match(/^\s+de:\s*(.*?)\s+carpeta:\s+(.*)$/) || linea.match(/^\s+de:\s+(.*)$/);
        if (de && !actual.de && !actual.carpeta) { actual.de = de[1].trim(); actual.carpeta = (de[2] || '').trim(); continue; }
        const para = linea.match(/^\s+para:\s+(.*)$/);
        if (para) { actual.para = para[1].trim(); continue; }
        const id = linea.match(/^\s+id:\s+(\S+)/);
        if (id) { actual.id = id[1]; actual = null; }
    }
    return mails.filter((m) => m.id);
}

/** El cuerpo de la salida de `_mails.py --ver`: lo que queda despues del segundo renglon de "=====". */
export function cuerpoDeVer(texto) {
    const lineas = String(texto ?? '').split(/\r?\n/);
    let rayas = 0;
    const cuerpo = [];
    for (const l of lineas) {
        if (/^={20,}\s*$/.test(l)) { rayas++; continue; }
        if (rayas >= 2) cuerpo.push(l.replace(/\s+$/, ''));
    }
    return cuerpo;
}

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function esEncabezado(linea, canon) {
    const l = sinTildes(linea.trim());
    return canon.lineas_de_encabezado.some((e) => l.startsWith(e));
}

/** Donde empieza lo citado de otro mail (el reenviado o la respuesta de abajo). */
function empiezaCita(linea) {
    const l = linea.trim();
    if (/^_{10,}/.test(l) || /^-{3,}\s*original/i.test(l)) return true;
    if (/^(de|from):\s/i.test(l)) return true;
    if (/(escribi[oó]|wrote):\s*$/i.test(l)) return true;
    return false;
}

/**
 * Elige la frase del mail que sostiene la propuesta: primero, en lo que escribio el remitente, un renglon que nombre
 * el tema o una palabra de dolor; si no hay, el mismo criterio en lo citado; si tampoco, el primer renglon con
 * contenido. Nunca un encabezado ("De:", "Asunto:") ni una firma corta. Devuelve '' si no hay nada que citar.
 */
export function extraerCita(lineasCuerpo, terminos, canon = CANON) {
    const propias = [];
    const citadas = [];
    let enCita = false;
    for (const l of lineasCuerpo) {
        if (!enCita && empiezaCita(l)) enCita = true;
        const t = l.trim();
        if (t.length < 15 || esEncabezado(t, canon)) continue;
        (enCita ? citadas : propias).push(t);
    }
    const conTema = (arr) => arr.find((t) => contieneTermino(t, terminos));
    const conDolor = (arr) => arr.find((t) => contieneTermino(t, canon.palabras_de_dolor));
    const elegida = conTema(propias) || conTema(citadas) || conDolor(propias) || conDolor(citadas)
        || propias.find((t) => t.length >= 20) || citadas.find((t) => t.length >= 20) || '';
    const corta = elegida.length > 220 ? elegida.slice(0, 217).trimEnd() + '...' : elegida;
    return taparClaves(corta);
}

/**
 * True si el termino aparece como palabra (o frase) entera, sin tildes ni mayusculas: «ecr» no vale adentro de
 * «decrypt» ni «arb» adentro de «arbol». `_mails.py --buscar` busca por pedazo de texto; esto separa lo que sirve.
 */
export function contieneTermino(texto, terminos) {
    const t = sinTildes(String(texto ?? ''));
    return terminos.some((x) => {
        const p = sinTildes(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^a-z0-9])${p}`).test(t);
    });
}

/**
 * True si el mail no aporta: un aviso automatico (boletin, Microsoft) o una copia que no es el mail mandado
 * (borradores, eliminados, conflictos de sincronizacion: repiten el mismo texto con otra hora).
 */
export function esMailExcluido(mail, canon = CANON) {
    const de = sinTildes(`${mail.de} ${mail.asunto}`);
    const carpeta = sinTildes(mail.carpeta || '');
    return canon.excluir_remitentes.some((x) => de.includes(sinTildes(x)))
        || (canon.excluir_carpetas || []).some((x) => carpeta.includes(sinTildes(x)));
}

/** Lee la cola y dice que temas ya tienen fila (por el texto `en_la_cola` de cada tema). */
export function temasYaEnLaCola(textoCola, canon = CANON) {
    const cola = sinTildes(textoCola ?? '');
    const ya = new Set();
    for (const t of canon.temas) {
        if (t.en_la_cola && cola.includes(sinTildes(t.en_la_cola))) ya.add(t.id);
    }
    return ya;
}

/** Fecha AAAA-MM-DD de hace N dias (hora local). */
export function haceDias(n, hoy = new Date()) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n);
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Corre `_mails.py` con una de las opciones permitidas. Cualquier otra opcion (sync, adjuntos, abrir, nuevos,
 * agenda, borradores, limpiar) tira error ANTES de lanzar nada: esas abren Outlook o escriben.
 */
export function llamarMails(rutaMails, args, ejecutar = spawnSync) {
    if (!Array.isArray(args) || !OPCIONES_PERMITIDAS.includes(args[0])) {
        throw new Error(`_automatizacionCandidatos: _mails.py solo se llama con ${OPCIONES_PERMITIDAS.join(' o ')} (pidio: ${args?.[0]})`);
    }
    const extra = args.slice(1).filter((a) => /^--/.test(a));
    const extrasPermitidos = ['--desde', '--hasta', '--limite', '--asunto', '--buzon', '--carpeta'];
    for (const e of extra) {
        if (!extrasPermitidos.includes(e)) throw new Error(`_automatizacionCandidatos: opcion no permitida para _mails.py: ${e}`);
    }
    const r = ejecutar('python', [rutaMails, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        timeout: 120_000,
        windowsHide: true,
    });
    if (r.error) throw new Error(`_automatizacionCandidatos: no pude correr _mails.py (${r.error.message})`);
    if (r.status !== 0) throw new Error(`_automatizacionCandidatos: _mails.py salio con ${r.status}: ${(r.stderr || r.stdout || '').trim().slice(0, 300)}`);
    return r.stdout || '';
}

/**
 * Arma la propuesta: por tema, los mails de la ventana (sin repetir), el mas nuevo primero, y hasta N citas.
 * `leer` es la funcion que le pide a `_mails.py` (inyectable para el test).
 */
export function armarPropuesta({ leer, desde, yaEnCola = new Set(), canon = CANON }) {
    const filas = [];
    for (const tema of canon.temas) {
        const porId = new Map();
        for (const termino of tema.terminos) {
            const salida = leer(['--buscar', termino, '--desde', desde, '--limite', '200']);
            for (const m of parsearBusqueda(salida)) {
                if (!esMailExcluido(m, canon) && !porId.has(m.id)) porId.set(m.id, m);
            }
        }
        const mails = [...porId.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
        const citas = [];
        const vistas = new Set();
        let falsos = 0;
        for (const m of mails) {
            if (citas.length >= canon.citas_por_tema) break;
            const cuerpo = cuerpoDeVer(leer(['--ver', m.id]));
            // la busqueda es por pedazo de texto: si el termino no esta como palabra, el mail no habla del tema
            if (!contieneTermino(`${m.asunto}\n${cuerpo.join('\n')}`, tema.terminos)) { falsos++; continue; }
            const cita = extraerCita(cuerpo, tema.terminos, canon);
            const clave = sinTildes(cita);
            if (cita && !vistas.has(clave)) { vistas.add(clave); citas.push({ ...m, cita }); }
        }
        filas.push({ tema, total: mails.length, falsos, ultimo: mails[0]?.fecha ?? null, citas, yaEnCola: yaEnCola.has(tema.id) });
    }
    return filas;
}

/** La propuesta como Markdown, lista para pegar debajo de «Candidatos propuestos» de la cola. */
export function aMarkdown(filas, { desde, hoy }) {
    const out = [];
    out.push(`# Candidatos propuestos para la cola — relevamiento del ${hoy}`);
    out.push('');
    out.push(`Mails de la casa desde el ${desde}. Cada tema trae cuantos mails lo nombran y hasta ${CANON.citas_por_tema} citas, el mas nuevo primero.`);
    out.push('Es una propuesta: Facundo decide que sube a la cola. Un tema con 0 mails no quiere decir que el proceso ande bien: quiere decir que en esta ventana nadie lo escribio.');
    out.push('');
    for (const f of filas) {
        const estado = f.yaEnCola ? 'ya tiene fila en la cola: sumar la evidencia nueva si cambia algo' : 'NO tiene fila en la cola: candidato a mirar';
        out.push(`## ${f.tema.nombre}`);
        const descartados = f.falsos ? ` (de los abiertos para citar, ${f.falsos} no hablaban del tema: la palabra estaba adentro de otra)` : '';
        out.push(`- ${f.total} mail${f.total === 1 ? '' : 's'} con esas palabras (busqueda por texto: es un tope, no un conteo exacto)${f.ultimo ? ` · el ultimo del ${f.ultimo}` : ''} · ${estado}${descartados}`);
        for (const c of f.citas) {
            out.push(`- «${sinMarcaDelAsistente(c.cita)}» — ${c.de || 'sin remitente'}, ${c.fecha}, asunto «${sinMarcaDelAsistente(taparClaves(c.asunto))}» (id ${c.id})`);
        }
        out.push('');
    }
    return out.join('\n');
}

/** El `_mails.py` que tiene la copia local de los mails: el de este checkout, o el del checkout principal. */
export function rutaMailsPorDefecto(raizRepo = path.resolve(AQUI, '..')) {
    const candidatos = [raizRepo, path.resolve(raizRepo, '..', '..', '..')];
    for (const r of candidatos) {
        const py = path.join(r, 'scripts', '_mails.py');
        if (fs.existsSync(py) && fs.existsSync(path.join(r, '.mail-cache', 'mails.jsonl'))) return py;
    }
    return path.join(raizRepo, 'scripts', '_mails.py');
}

function leerArgs(argv) {
    const a = { dias: CANON.ventana_dias, out: null, cola: null, mails: null };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = () => { const x = argv[++i]; if (x === undefined) throw new Error(`falta el valor de ${k}`); return x; };
        if (k === '--dias') a.dias = Number(v());
        else if (k === '--out') a.out = v();
        else if (k === '--cola') a.cola = v();
        else if (k === '--mails') a.mails = v();
        else if (k === '--help' || k === '-h') a.ayuda = true;
        else throw new Error(`opcion desconocida: ${k}`);
    }
    if (!Number.isFinite(a.dias) || a.dias < 1) throw new Error('--dias tiene que ser un numero mayor que 0');
    return a;
}

function main() {
    let args;
    try { args = leerArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
    if (args.ayuda) {
        console.log('Uso: node scripts/_automatizacionCandidatos.mjs [--dias N] [--out <archivo>] [--cola <ruta>] [--mails <ruta>]');
        return;
    }
    const rutaCola = args.cola || path.join(buscarBiblioteca(), 'AUTOMATIZACION BARACK', 'cola.md');
    if (args.out && path.basename(args.out).toLowerCase() === 'cola.md') {
        console.error('No piso la cola: --out tiene que ser otro archivo (la cola la decide Facundo).');
        process.exit(1);
    }
    const textoCola = fs.existsSync(rutaCola) ? fs.readFileSync(rutaCola, 'utf8') : '';
    if (!textoCola) console.error(`(aviso) no encontre la cola en ${rutaCola}: todos los temas salen como "sin fila".`);
    const rutaMails = args.mails || rutaMailsPorDefecto();
    const hoy = haceDias(0);
    const desde = haceDias(args.dias);
    let filas;
    try {
        filas = armarPropuesta({ leer: (a) => llamarMails(rutaMails, a), desde, yaEnCola: temasYaEnLaCola(textoCola) });
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
    const md = aMarkdown(filas, { desde, hoy });
    console.log(md);
    if (args.out) {
        fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
        fs.writeFileSync(args.out, md + '\n', 'utf8');
        console.error(`(dejado en ${args.out})`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

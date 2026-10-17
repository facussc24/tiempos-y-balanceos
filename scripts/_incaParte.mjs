/**
 * _incaParte.mjs — el parte semanal de VW (INCA) que llega por mail cada miercoles, leido de la copia local (tanda 14
 * del plan del sistema, item 11).
 *
 * POR QUE EXISTE: VW le manda a Fak «INCA: weekly status report» (`inca-mail@volkswagen.de`) con las piezas de Barack
 * que todavia no estan asignadas a un acuerdo de capacidad (BKA) y los BKA en rojo («potential shortages»). El texto
 * avisa que, pasadas 2 semanas, se le notifica al comprador de VW. Ningun programa de la casa leia esos mails (informe D
 * del 15/10, punto 1: 6 piezas sin BKA desde abril y el B00000330933 del apoyabrazos trasero en rojo 17 semanas).
 *
 * QUE HACE Y QUE NO:
 *   - Lee SOLO la copia local de mails (los partes de `inca-mail@volkswagen.de`; los RE y RV de Carlos no son partes).
 *     No abre INCA ni Outlook.
 *   - Las piezas sin BKA no estan escritas en el texto del mail: estan en el enlace del numero («…&tlks=_2HT853839,…»).
 *     Se leen de ahi; si el numero del mail no coincide con las piezas del enlace, se avisa.
 *   - Lista el ultimo parte, la serie de todos los partes y, por BKA en rojo, desde cuando y hasta cuando aparece.
 *   - NO decide si esas piezas le tocan a Barack: eso se mira en INCA (lo decide Fak).
 *
 *   node scripts/_incaParte.mjs [--mails <jsonl>] [--out <archivo.md>]   -> exports/inca_parte_<fecha>.md
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    rutaMailsJsonl, salidaPorDefecto, leerMails, celda, escribirSalida, leerArgs, fechaLocal,
} from './_lib/lectorMails.mjs';

export const REMITENTE_INCA = 'inca-mail@volkswagen.de';

export function esParteInca(m) {
    return String(m.de_mail).toLowerCase() === REMITENTE_INCA && /^INCA: weekly status report/i.test(String(m.asunto).trim());
}

const MESES = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

/** «from Wednesday 29. July 2026, 06:17» -> «2026-07-29». Null si el mail no lo dice. */
export function fechaDelParte(cuerpo) {
    const m = /status report from \w+ (\d{1,2})\. (\w+) (\d{4})/i.exec(String(cuerpo ?? ''));
    if (!m || !MESES[m[2].toLowerCase()]) return null;
    return `${m[3]}-${String(MESES[m[2].toLowerCase()]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

/** Las piezas del enlace `tlks=_A,_B` (sin el guion bajo de adelante), en el orden del mail. */
export function piezasDelEnlace(linea) {
    const m = /[?&]tlks=([^&>\s]+)/.exec(decodeURIComponent(String(linea ?? '')));
    if (!m) return [];
    return m[1].split(',').map((p) => p.replace(/^_+/, '').trim()).filter(Boolean);
}

/**
 * Lee un parte: { fecha, cw, sinBka: { total, masDeDosSemanas, piezas }, otrasTareas: [{ tarea, total }], rojos: [...] }.
 * Cada rojo: { bka, descripcion, pieza, estado }.
 */
export function leerParte(m) {
    const cuerpo = String(m.cuerpo ?? '');
    const lineas = cuerpo.split(/\r?\n/);
    const parte = {
        fecha: fechaDelParte(cuerpo) ?? m.fecha.slice(0, 10), cw: /CW\s*(\d{1,2}\.\d{4})/i.exec(m.asunto)?.[1] ?? '',
        recibido: m.fecha, sinBka: { total: 0, masDeDosSemanas: 0, piezas: [] }, otrasTareas: [], rojos: [],
    };
    for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];
        const sinUrl = l.replace(/<https?:\/\/[^>]*>/g, ' ');
        if (/^Parts to be assigned to BKA/i.test(l.trim())) {
            const nums = [...sinUrl.matchAll(/(?:^|\s)(\d+)(?=\s|$)/g)].map((x) => Number(x[1])).filter((n) => n < 100000);
            const cols = sinUrl.split('\t').map((c) => c.trim()).filter(Boolean);
            parte.sinBka.total = Number(cols[2] ?? nums[nums.length - 2] ?? 0) || 0;
            parte.sinBka.masDeDosSemanas = Number(cols[3] ?? nums[nums.length - 1] ?? 0) || 0;
            parte.sinBka.piezas = piezasDelEnlace(l);
            continue;
        }
        const tarea = /^(Update or activate the BKA'?s|Check the refused BKA'?s|New BKA accept)\s+(\d+)/i.exec(l.trim());
        if (tarea) { parte.otrasTareas.push({ tarea: tarea[1], total: Number(tarea[2]) }); continue; }
        const rojo = /^(B\d{11})\b/.exec(l.trim());
        if (rojo) {
            const cols = sinUrl.split('\t').map((c) => c.trim()).filter(Boolean);
            // cols: [bka, descripcion, proveedor, pieza, estado]
            parte.rojos.push({ bka: rojo[1], descripcion: cols[1] ?? '', pieza: (cols[3] ?? '').trim(), estado: cols[4] ?? '' });
        }
    }
    return parte;
}

/** Ordena los partes por fecha y arma la historia: por pieza sin BKA y por BKA en rojo, primera y ultima vez. */
export function historia(partes) {
    const orden = [...partes].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    const piezas = new Map();
    const rojos = new Map();
    for (const p of orden) {
        for (const pz of p.sinBka.piezas) {
            const h = piezas.get(pz) ?? { pieza: pz, primera: p.fecha, ultima: p.fecha, partes: 0 };
            h.ultima = p.fecha; h.partes += 1; piezas.set(pz, h);
        }
        for (const r of p.rojos.filter((x) => /red/i.test(x.estado))) {
            const h = rojos.get(r.bka) ?? { ...r, primera: p.fecha, ultima: p.fecha, partes: 0 };
            h.ultima = p.fecha; h.partes += 1; rojos.set(r.bka, h);
        }
    }
    return { orden, piezas: [...piezas.values()], rojos: [...rojos.values()] };
}

const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

/** El markdown. `meta`: { hoy, leidos, fechaMin, fechaMax }. */
export function aMarkdown(partes, meta) {
    const { orden, piezas, rojos } = historia(partes);
    const ultimo = orden[orden.length - 1];
    const o = [];
    o.push(`# Parte semanal de VW (INCA) — lo que dicen los mails (${meta.hoy})`);
    o.push('');
    o.push(`Fuente: los partes «INCA: weekly status report» de \`${REMITENTE_INCA}\` en la copia local de mails (${meta.leidos} renglones leidos; la copia va del ${meta.fechaMin} al ${meta.fechaMax}). No se abrio INCA ni Outlook. Las piezas salen del enlace del numero de piezas (el texto del mail no las escribe).`);
    o.push('');
    o.push('**Lo que este listado NO dice:** si esas piezas le tocan a Barack o estan asi a proposito. Eso se mira en INCA.');
    o.push('');
    if (!ultimo) { o.push('No hay ningun parte en la copia.'); return o.join('\n'); }
    o.push(`## Ultimo parte: ${dmy(ultimo.fecha)} (semana ${celda(ultimo.cw)})`);
    o.push('');
    o.push(`- **Piezas sin acuerdo de capacidad (BKA): ${ultimo.sinBka.total}** (${ultimo.sinBka.masDeDosSemanas} con mas de 2 semanas: VW le avisa al comprador).`);
    if (ultimo.sinBka.piezas.length !== ultimo.sinBka.total) o.push(`- ⚠ El mail dice ${ultimo.sinBka.total} y el enlace trae ${ultimo.sinBka.piezas.length} piezas: revisar en INCA.`);
    o.push('');
    o.push('| Pieza | Aparece sin BKA desde el parte del | Partes en que aparece |');
    o.push('|---|---|---|');
    for (const pz of ultimo.sinBka.piezas) { const h = piezas.find((x) => x.pieza === pz); o.push(`| ${celda(pz)} | ${dmy(h?.primera)} | ${h?.partes ?? 0} de ${orden.length} |`); }
    o.push('');
    if (ultimo.otrasTareas.some((t) => t.total)) o.push(`Otras tareas abiertas en el ultimo parte: ${ultimo.otrasTareas.filter((t) => t.total).map((t) => `${celda(t.tarea)} ${t.total}`).join(' · ')}.\n`);
    o.push(`BKA en rojo en el ultimo parte: ${ultimo.rojos.length ? ultimo.rojos.map((r) => `${r.bka} ${celda(r.descripcion)} (${celda(r.pieza)})`).join(' · ') : 'ninguno'}.`);
    o.push('');
    o.push('## BKA en rojo («potential shortages»), todos los partes');
    o.push('');
    if (!rojos.length) o.push('Ninguno.');
    else {
        o.push('| BKA | Descripcion | Pieza | Primer parte en rojo | Ultimo parte en rojo | Partes en rojo |');
        o.push('|---|---|---|---|---|---|');
        for (const r of rojos) o.push(`| ${r.bka} | ${celda(r.descripcion)} | ${celda(r.pieza)} | ${dmy(r.primera)} | ${dmy(r.ultima)} | ${r.partes} |`);
    }
    o.push('');
    o.push('## Piezas sin BKA, todos los partes');
    o.push('');
    o.push('| Pieza | Primer parte | Ultimo parte | Partes en que aparece |');
    o.push('|---|---|---|---|');
    for (const h of [...piezas].sort((a, b) => (a.primera < b.primera ? -1 : 1))) o.push(`| ${celda(h.pieza)} | ${dmy(h.primera)} | ${dmy(h.ultima)} | ${h.partes} |`);
    o.push('');
    o.push('## La serie, parte por parte');
    o.push('');
    o.push('| Parte | Semana | Sin BKA | Mas de 2 semanas | Piezas del enlace | BKA en rojo |');
    o.push('|---|---|---|---|---|---|');
    for (const p of orden) {
        o.push(`| ${dmy(p.fecha)} | ${celda(p.cw)} | ${p.sinBka.total} | ${p.sinBka.masDeDosSemanas} | ${p.sinBka.piezas.map(celda).join(', ') || '—'} | ${p.rojos.filter((r) => /red/i.test(r.estado)).map((r) => r.bka).join(', ') || '—'} |`);
    }
    return o.join('\n');
}

async function main() {
    let a;
    try { a = leerArgs(process.argv.slice(2), ['--mails', '--out']); } catch (e) { console.error(e.message); process.exit(1); }
    if (a.ayuda) { console.log('Uso: node scripts/_incaParte.mjs [--mails <mails.jsonl>] [--out <archivo.md>]'); return; }
    const jsonl = a.mails || rutaMailsJsonl();
    if (!jsonl) { console.error('No encontre la copia local de mails (.mail-cache/mails.jsonl) ni aca ni en el checkout principal.'); process.exit(1); }
    const { mails, leidos, fechaMin, fechaMax } = await leerMails(jsonl, { conCuerpo: true, filtro: esParteInca });
    // El mismo parte puede estar dos veces con distinta hora de llegada (reenvio de Outlook): uno por fecha del parte.
    const porFecha = new Map();
    for (const p of mails.map(leerParte)) if (!porFecha.has(p.fecha)) porFecha.set(p.fecha, p);
    const partes = [...porFecha.values()];
    const hoy = fechaLocal();
    const md = aMarkdown(partes, { hoy, leidos, fechaMin, fechaMax });
    const out = a.out || salidaPorDefecto(`inca_parte_${hoy}.md`);
    escribirSalida(out, md);
    const { orden } = historia(partes);
    const u = orden[orden.length - 1];
    console.log(`Dejado en ${out}`);
    console.log(`${partes.length} partes; el ultimo (${u ? dmy(u.fecha) : '—'}) trae ${u ? u.sinBka.total : 0} piezas sin BKA: ${u ? u.sinBka.piezas.join(', ') : ''}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

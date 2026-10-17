/**
 * _plannerCarlos.mjs — las tareas del Planner «Actividades Ingenieria» de Carlos, leidas de los avisos que Microsoft
 * manda por mail (tanda 14 del plan del sistema, item 14).
 *
 * POR QUE EXISTE: Carlos le asigna tareas a Fak en un plan de Microsoft Planner y Microsoft avisa por mail («You've
 * been assigned a task», «You have late tasks»). Esos avisos ya estan en la copia local y ningun programa los usaba:
 * `_mails.py` los descarta como robot (`_es_ruido`) y la agenda de Outlook (`--agenda`) no los ve. El conector de
 * Microsoft 365 esta descartado (la cuenta de la empresa no se conecta, Fak 15/10): esto lee el mismo circuito de
 * mails. Informe D del 15/10, punto 4.
 *
 * QUE HACE Y QUE NO:
 *   - Lee SOLO la copia local de mails. No abre Planner, Outlook ni Teams.
 *   - Junta, por tarea (el id que trae el enlace de Planner; sin id, por el nombre): quien la asigno y cuando, el
 *     vencimiento, cuantos avisos de vencida llegaron, el primero y el ultimo, y el atraso mas grande que dijo un aviso.
 *   - NO dice si una tarea esta abierta: Planner no manda mail cuando alguien la completa. Dice «asignada el …, ultimo
 *     aviso de vencida el …», que es lo unico que el mail sostiene.
 *   - Las fechas: los avisos en ingles vienen mes/dia/año («7/1/2026» = 1 de julio, y el aviso del 08/07 dice «7 days
 *     late»); los en castellano, dia/mes/año.
 *
 *   node scripts/_plannerCarlos.mjs [--mails <jsonl>] [--out <archivo.md>]   -> exports/planner_carlos_<fecha>.md
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    rutaMailsJsonl, salidaPorDefecto, leerMails, celda, escribirSalida, leerArgs, normalizarTexto, fechaLocal,
} from './_lib/lectorMails.mjs';

export const PLAN_CARLOS = 'Actividades Ingenieria';

/** ¿Es un aviso del Planner? Por el remitente de Microsoft o por el asunto de «te asignaron una tarea». */
export function esAvisoPlanner(m) {
    if (/planner\.office365\.com/i.test(m.de_mail)) return true;
    return /^(you'?ve been assigned a task|se le ha asignado una tarea)/i.test(String(m.asunto).trim());
}

/** 'en' si el aviso esta en ingles (fechas mes/dia/año), 'es' si no. */
export function idiomaAviso(cuerpo) {
    return /\bIn the plan\b|assigned (you )?a task|You have|days? late|Due in|No due date|Open in browser/i.test(cuerpo) ? 'en' : 'es';
}

/** «7/1/2026» -> «2026-07-01» en ingles, «2026-01-07» en castellano. Null si no es una fecha. */
export function fechaDeAviso(texto, idioma) {
    const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(texto ?? ''));
    if (!m) return null;
    const [a, b, anio] = [Number(m[1]), Number(m[2]), m[3]];
    const [mes, dia] = idioma === 'en' ? [a, b] : [b, a];
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const URL = /<https?:\/\/[^>]*>/g;
/** El id de la tarea, si el enlace es de Planner: `.../PlanViews/<plan>/<tarea>?...`. */
export function idDeTarea(linea) {
    const m = /PlanViews\/[^/?>\s]+\/([^/?>\s]+)/.exec(String(linea ?? ''));
    return m ? m[1] : null;
}
const sinUrl = (s) => String(s ?? '').replace(URL, '').replace(/[͏‌​ ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Que dice el renglon de una seccion de un aviso de vencimientos: 'vencida' | 'vence hoy' | 'por vencer' | null. */
export function estadoDeEncabezado(linea) {
    const t = normalizarTexto(linea);
    if (/^you have (a |an )?late tasks?$|^tienes? (una )?tareas? retrasadas?$/.test(t)) return 'vencida';
    if (/^you have (a )?tasks? due today$|^tienes? (una )?tareas? que vencen? hoy$/.test(t)) return 'vence hoy';
    if (/^you have (an )?upcoming tasks?( due)?$|^tienes? (una )?tareas? (que vencen? )?proximamente$/.test(t)) return 'por vencer';
    return null;
}

/**
 * Las tareas que nombra un aviso de vencimientos («You have late tasks» y compañia): una entrada por tarea, con el
 * estado de la seccion en la que aparece, el plan, el vencimiento y el texto de atraso («6 days late»).
 */
export function tareasDeVencimientos(cuerpo) {
    const idioma = idiomaAviso(cuerpo);
    const lineas = String(cuerpo ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out = [];
    let estado = null;
    for (let i = 0; i < lineas.length; i++) {
        const e = estadoDeEncabezado(sinUrl(lineas[i]));
        if (e) { estado = e; continue; }
        const plan = /^(?:In the plan|En el plan)\s+(.+?)\s*<https?:/i.exec(lineas[i]);
        if (!plan || i === 0) continue;
        const lineaTarea = lineas[i - 1];
        const fechaLinea = lineas[i + 1] ?? '';
        const vence = fechaDeAviso(fechaLinea, idioma);
        const atraso = sinUrl(fechaLinea.replace(/\d{1,2}\/\d{1,2}\/\d{4}/, ''));
        out.push({
            titulo: sinUrl(lineaTarea), id: idDeTarea(lineaTarea), plan: sinUrl(plan[1]), estado: estado ?? 'sin seccion',
            vence, atraso, dias: /(\d+)\s*(?:days?|d[ií]as?)\s*(?:late|tarde)/i.exec(atraso)?.[1] ? Number(/(\d+)/.exec(atraso)[1]) : null,
        });
    }
    return out;
}

/** La tarea de un aviso de «te asignaron una tarea»: titulo, id, plan, quien la asigno y el vencimiento (o null). */
export function tareaDeAsignacion(cuerpo, deMail = '') {
    const idioma = idiomaAviso(cuerpo);
    const lineas = String(cuerpo ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => sinUrl(l));
    const quien = /^(.+?)\s+(?:assigned a task to you|assigned you a task|te ha asignado una tarea|le ha asignado una tarea)/i.exec(sinUrl(lineas[0] ?? ''))?.[1] ?? deMail;
    let plan = /Plan:\s*(.+)$/i.exec(lineas.map(sinUrl).find((l) => /^Plan:/i.test(l)) ?? '')?.[1]?.trim() ?? null;
    // El renglon de la tarea es el primero con un enlace que trae el id de la tarea; en los avisos de 2023 (plan
    // «Tareas», sin id en el enlace) es el que sigue al renglon del plan o de «te ha asignado».
    let i = lineas.findIndex((l) => idDeTarea(l));
    if (i < 0) {
        const j = lineas.findIndex((l, k) => k > 0 && /te ha asignado una tarea\s*$|assigned you a task\s*$/i.test(sinUrl(l)));
        i = j >= 0 ? j + 1 : -1;
    }
    if (i < 0 || i >= lineas.length) return null;
    // Sin renglon «Plan:» (avisos de 2023), el plan es el primer renglon con enlace entre el saludo y la tarea.
    if (!plan) plan = lineas.slice(1, i).map((l) => (/<https?:/.test(l) && !/asignado una tarea|assigned/i.test(sinUrl(l)) ? sinUrl(l) : '')).find(Boolean) || null;
    const fechaLinea = lineas[i + 1] ?? '';
    return {
        titulo: sinUrl(lineas[i]), id: idDeTarea(lineas[i]), plan, asigno: sinUrl(quien),
        vence: fechaDeAviso(fechaLinea, idioma), sinVencimiento: /sin fecha|no due date/i.test(fechaLinea),
    };
}

const clave = (t) => t.id || `titulo:${normalizarTexto(t.plan)}:${normalizarTexto(t.titulo)}`;

/**
 * Junta los avisos por tarea. Devuelve { tareas, avisosAsignacion, avisosVencimiento, renglonesVencida }.
 * Cada tarea: titulo, plan, asigno, asignadaA, asignadaEl, vence, avisosVencida, primerVencida, ultimoVencida,
 * maxDias, ultimoAviso, deFak (true si la asigno Fak a otro: sale de Enviados).
 */
export function juntar(mails) {
    const tareas = new Map();
    let avisosAsignacion = 0;
    let avisosVencimiento = 0;
    let renglonesVencida = 0;
    const tarea = (t) => {
        const k = clave(t);
        const prev = tareas.get(k) ?? { id: t.id, titulo: t.titulo, plan: t.plan, asigno: null, asignadaA: null, asignadaEl: null, vence: null, venceCambio: [], avisosVencida: 0, primerVencida: null, ultimoVencida: null, maxDias: null, ultimoAviso: null, deFak: false };
        if (t.titulo) prev.titulo = t.titulo;
        if (!prev.plan && t.plan) prev.plan = t.plan;
        tareas.set(k, prev);
        return prev;
    };
    const nuevoVence = (p, v) => { if (v && p.vence && v !== p.vence && !p.venceCambio.includes(p.vence)) p.venceCambio.push(p.vence); if (v) p.vence = v; };
    for (const m of mails) {
        if (!esAvisoPlanner(m)) continue;
        const dia = m.fecha.slice(0, 10);
        if (/assigned a task|asignado una tarea/i.test(m.asunto)) {
            const t = tareaDeAsignacion(m.cuerpo, m.de);
            if (!t) continue;
            avisosAsignacion += 1;
            const p = tarea(t);
            p.asigno = t.asigno || m.de;
            // Una tarea asignada a tres personas manda tres avisos: se juntan los nombres.
            const a = m.clase === 'enviados' ? m.para : 'Facundo Santoro';
            p.asignadaA = p.asignadaA && !p.asignadaA.split('; ').includes(a) ? `${p.asignadaA}; ${a}` : (p.asignadaA || a);
            p.deFak = m.clase === 'enviados';
            if (!p.asignadaEl || dia < p.asignadaEl) p.asignadaEl = dia;
            nuevoVence(p, t.vence);
            continue;
        }
        const lista = tareasDeVencimientos(m.cuerpo);
        if (!lista.length) continue;
        avisosVencimiento += 1;
        for (const t of lista) {
            const p = tarea(t);
            nuevoVence(p, t.vence);
            if (!p.ultimoAviso || dia > p.ultimoAviso) p.ultimoAviso = dia;
            if (t.estado !== 'vencida') continue;
            renglonesVencida += 1;
            p.avisosVencida += 1;
            if (!p.primerVencida || dia < p.primerVencida) p.primerVencida = dia;
            if (!p.ultimoVencida || dia > p.ultimoVencida) p.ultimoVencida = dia;
            if (t.dias != null && (p.maxDias == null || t.dias > p.maxDias)) p.maxDias = t.dias;
        }
    }
    return { tareas: [...tareas.values()], avisosAsignacion, avisosVencimiento, renglonesVencida };
}

const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

/** El markdown. `meta`: { hoy, leidos, contados, fechaMin, fechaMax }. */
export function aMarkdown(res, meta) {
    const deCarlos = res.tareas.filter((t) => normalizarTexto(t.plan) === normalizarTexto(PLAN_CARLOS) && !t.deFak);
    const deFak = res.tareas.filter((t) => t.deFak);
    const otras = res.tareas.filter((t) => !t.deFak && normalizarTexto(t.plan) !== normalizarTexto(PLAN_CARLOS));
    const conAsignacion = deCarlos.filter((t) => t.asignadaEl);
    const vencidas = deCarlos.filter((t) => t.avisosVencida > 0);
    const ultimo = deCarlos.map((t) => t.ultimoAviso).filter(Boolean).sort().pop();
    const fechasAsig = conAsignacion.map((t) => t.asignadaEl).sort();
    const o = [];
    o.push(`# Planner «${PLAN_CARLOS}» — lo que dicen los avisos por mail (${meta.hoy})`);
    o.push('');
    o.push(`Fuente: los avisos de Microsoft Planner de la copia local de mails (${meta.leidos} renglones leidos, ${meta.contados} avisos del Planner sin repetir; la copia va del ${meta.fechaMin} al ${meta.fechaMax}). No se abrio Planner, Outlook ni Teams.`);
    o.push('');
    o.push('**Lo que este listado NO dice:** si una tarea esta abierta o cerrada. Planner no avisa por mail cuando alguien completa una tarea; por eso cada fila dice cuando se asigno y cuando llego el ultimo aviso de vencida, nunca «abierta».');
    o.push('');
    o.push('## Resumen');
    o.push('');
    o.push(`- **${deCarlos.length} tareas distintas** del plan «${PLAN_CARLOS}» asignadas a Fak: ${conAsignacion.length} con su aviso de asignacion en la copia${fechasAsig.length ? ` (del ${dmy(fechasAsig[0])} al ${dmy(fechasAsig[fechasAsig.length - 1])})` : ''} y ${deCarlos.length - conAsignacion.length} que solo aparecen en avisos de vencimiento (se asignaron antes de la copia o por otro camino).`);
    o.push(`- **${vencidas.length} tareas tuvieron al menos un aviso de vencida**; en total ${res.renglonesVencida} renglones de «vencida» repartidos en ${res.avisosVencimiento} mails de vencimientos (un mail trae varias tareas).`);
    o.push(`- ${res.avisosAsignacion} mails de «te asignaron una tarea» en total (incluye los que Fak mando a otros y los del plan viejo).`);
    o.push(`- Ultimo aviso del plan de Carlos en la copia: **${dmy(ultimo)}**. Despues no llego ninguno: con los mails solos no se sabe si el plan se dejo de usar o se apagaron los avisos.`);
    o.push(`- ${deFak.length} tareas que Fak asigno a otros (salen de Elementos enviados) y ${otras.length} de otros planes (el plan «Tareas» de 2023), al final.`);
    o.push('');
    o.push(`## Tareas de «${PLAN_CARLOS}» asignadas a Fak — la mas nueva primero`);
    o.push('');
    o.push('| Tarea | Asigno | Asignada el | Vence | Avisos de vencida | Primer y ultimo aviso de vencida | Mayor atraso que dijo un aviso |');
    o.push('|---|---|---|---|---|---|---|');
    const orden = (t) => t.asignadaEl || t.primerVencida || t.ultimoAviso || '';
    for (const t of [...deCarlos].sort((a, b) => (orden(a) < orden(b) ? 1 : -1))) {
        const vence = t.vence ? dmy(t.vence) + (t.venceCambio.length ? ` (antes ${t.venceCambio.map(dmy).join(', ')})` : '') : '—';
        o.push(`| ${celda(t.titulo)} | ${celda(t.asigno) || '(no hay aviso de asignacion)'} | ${dmy(t.asignadaEl)} | ${vence} | ${t.avisosVencida} | ${t.avisosVencida ? `${dmy(t.primerVencida)} → ${dmy(t.ultimoVencida)}` : '—'} | ${t.maxDias != null ? `${t.maxDias} dias` : '—'} |`);
    }
    o.push('');
    o.push('## Tareas que Fak asigno a otros');
    o.push('');
    if (!deFak.length) o.push('Ninguna.');
    else {
        o.push('| Tarea | Plan | A quien | Asignada el | Vence |');
        o.push('|---|---|---|---|---|');
        for (const t of [...deFak].sort((a, b) => ((a.asignadaEl ?? '') < (b.asignadaEl ?? '') ? 1 : -1))) o.push(`| ${celda(t.titulo)} | ${celda(t.plan)} | ${celda(t.asignadaA)} | ${dmy(t.asignadaEl)} | ${dmy(t.vence)} |`);
    }
    o.push('');
    o.push('## Otros planes (no son del plan de Carlos)');
    o.push('');
    if (!otras.length) o.push('Ninguno.');
    else {
        o.push('| Tarea | Plan | Asigno | Asignada el | Vence | Avisos de vencida |');
        o.push('|---|---|---|---|---|---|');
        for (const t of otras) o.push(`| ${celda(t.titulo)} | ${celda(t.plan)} | ${celda(t.asigno) || '—'} | ${dmy(t.asignadaEl)} | ${dmy(t.vence)} | ${t.avisosVencida} |`);
    }
    return o.join('\n');
}

async function main() {
    let a;
    try { a = leerArgs(process.argv.slice(2), ['--mails', '--out']); } catch (e) { console.error(e.message); process.exit(1); }
    if (a.ayuda) { console.log('Uso: node scripts/_plannerCarlos.mjs [--mails <mails.jsonl>] [--out <archivo.md>]'); return; }
    const jsonl = a.mails || rutaMailsJsonl();
    if (!jsonl) { console.error('No encontre la copia local de mails (.mail-cache/mails.jsonl) ni aca ni en el checkout principal.'); process.exit(1); }
    const { mails, leidos, fechaMin, fechaMax } = await leerMails(jsonl, { conCuerpo: true, filtro: esAvisoPlanner });
    const res = juntar(mails);
    const hoy = fechaLocal();
    const md = aMarkdown(res, { hoy, leidos, contados: mails.length, fechaMin, fechaMax });
    const out = a.out || salidaPorDefecto(`planner_carlos_${hoy}.md`);
    escribirSalida(out, md);
    const deCarlos = res.tareas.filter((t) => normalizarTexto(t.plan) === normalizarTexto(PLAN_CARLOS) && !t.deFak);
    console.log(`Dejado en ${out}`);
    console.log(`${deCarlos.length} tareas de «${PLAN_CARLOS}» asignadas a Fak · ${res.avisosAsignacion} avisos de asignacion · ${res.avisosVencimiento} mails de vencimientos con ${res.renglonesVencida} renglones de vencida.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

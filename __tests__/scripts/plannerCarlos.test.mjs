/**
 * `scripts/_plannerCarlos.mjs` (tanda 14, item 14): las tareas del Planner «Actividades Ingenieria» leidas de los
 * avisos por mail.
 *
 * Lo que se cuida, en las dos direcciones:
 *   - fechas: en ingles mes/dia («7/1/2026» = 1 de julio: el aviso del 08/07 dice «7 days late»), en castellano dia/mes;
 *   - un aviso de vencimientos trae varias tareas, cada una con la seccion en la que aparece (vencida / por vencer);
 *   - 8 tareas asignadas en el mismo minuto son 8, no 1 (el 28/04 17:21 pasaba eso);
 *   - lo que Fak asigno a otros va aparte, y una tarea a tres personas es una con tres nombres;
 *   - el plan viejo «Tareas» (2023) no se mezcla con el de Carlos;
 *   - la salida nunca dice «abierta» y no lleva la clave de API.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    fechaDeAviso, idiomaAviso, tareaDeAsignacion, tareasDeVencimientos, estadoDeEncabezado, diasDeAtraso, juntar, aMarkdown, esAvisoPlanner, textoEstado, PLAN_CARLOS,
} from '../../scripts/_plannerCarlos.mjs';
import { leerMails } from '../../scripts/_lib/lectorMails.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(AQUI, '..', '..', 'scripts', '_plannerCarlos.mjs');
const CLAVE = ['sk', 'ant', 'api03', 'PRUEBA' + 'y'.repeat(28)].join('-');
const PEDAZO_DE_CLAVE = /sk\W*ant\W*api|prueba\W*y{8}/i;   // cualquier pedazo, tambien partido
const CASOS = JSON.parse(fs.readFileSync(path.join(AQUI, 'lectoresMailTanda14.casos.json'), 'utf8'));
const mail = (id) => JSON.parse(JSON.stringify(CASOS.planner.find((m) => m.id === id)).replaceAll('{{CLAVE_FALSA}}', CLAVE));

/** Los 8 avisos de «te asignaron una tarea» del mismo minuto, cada uno con su tarea. */
function mismoMinuto() {
    const P = CASOS.planner_mismo_minuto;
    return P.titulos.map((t, i) => ({
        ...mail('P01'), id: `M${i}`, fecha: P.fecha,
        cuerpo: `Carlos assigned a task to you \n \tPlan: Actividades Ingenieria \t\n \tCarlos assigned you a task in Actividades Ingenieria <https://planner.cloud.microsoft/x/Home/PlanViews/PLANX?a=1>  \n${t} <https://planner.cloud.microsoft/x/Home/PlanViews/PLANX/TAREA${i}?Type=AssignedTo> \t\n \t5/7/2026 \t\n`,
    }));
}

function jsonlDe(mails) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-'));
    const p = path.join(dir, 'mails.jsonl');
    fs.writeFileSync(p, mails.map((m) => JSON.stringify(m)).join('\n') + '\n');
    return p;
}

async function todo() {
    const jsonl = jsonlDe([...CASOS.planner.map((m) => mail(m.id)), ...mismoMinuto()]);
    const { mails } = await leerMails(jsonl, { conCuerpo: true, filtro: esAvisoPlanner });
    return { jsonl, mails, res: juntar(mails) };
}

describe('las fechas de los avisos', () => {
    it('en ingles es mes/dia; en castellano dia/mes', () => {
        expect(fechaDeAviso('\t7/1/2026\t7 days late', 'en')).toBe('2026-07-01');
        expect(fechaDeAviso('18/11/2025', 'es')).toBe('2025-11-18');
        expect(fechaDeAviso('sin fecha', 'es')).toBeNull();
        expect(fechaDeAviso('13/13/2026', 'en')).toBeNull();
    });
    it('el idioma sale del texto del aviso', () => {
        expect(idiomaAviso(mail('P02').cuerpo)).toBe('en');
        expect(idiomaAviso(mail('P07').cuerpo)).toBe('es');
        expect(idiomaAviso(mail('P04').cuerpo)).toBe('es');
    });
    it('el aviso del 08/07 dice «7 days late» de una tarea que vence el 01/07: mes/dia es lo que cierra', () => {
        const [t] = tareasDeVencimientos(mail('P02').cuerpo);
        const atraso = (Date.parse('2026-07-08') - Date.parse(t.vence)) / 86400000;
        expect(atraso).toBe(7);
        expect(t.dias).toBe(7);
    });
});

describe('leer un aviso', () => {
    it('el de asignacion: tarea, id del enlace, quien la asigno y vencimiento', () => {
        const t = tareaDeAsignacion(mail('P01').cuerpo);
        expect(t).toMatchObject({ titulo: 'Telas Nuevas PWa 21-9694 y 21-9695', id: 'TAREATELAS', plan: PLAN_CARLOS, asigno: 'Carlos', vence: '2026-07-01' });
    });
    it('el de 2023 sin renglon «Plan:» toma el plan del primer enlace y dice «sin fecha»', () => {
        const t = tareaDeAsignacion(mail('P06').cuerpo);
        expect(t).toMatchObject({ titulo: 'FACU Y TOMY', plan: 'Tareas', asigno: 'Pablo', vence: null, sinVencimiento: true });
    });
    it('un aviso de vencimientos trae varias tareas con su seccion', () => {
        const l = tareasDeVencimientos(mail('P03').cuerpo);
        expect(l.map((x) => [x.id, x.estado, x.vence])).toEqual([
            ['TAREABEON', 'vencida', '2026-06-19'], ['TAREABOM', 'vencida', '2026-06-24'], ['TAREATELAS', 'por vencer', '2026-07-01'],
        ]);
    });
    it('los encabezados en los dos idiomas', () => {
        expect(estadoDeEncabezado('You have a late task')).toBe('vencida');
        expect(estadoDeEncabezado('You have late tasks')).toBe('vencida');
        expect(estadoDeEncabezado('Tiene una tarea retrasada')).toBe('vencida');
        expect(estadoDeEncabezado('You have an upcoming task')).toBe('por vencer');
        expect(estadoDeEncabezado('Tiene una tarea próximamente')).toBe('por vencer');
        expect(estadoDeEncabezado('You have a task due today')).toBe('vence hoy');
        expect(estadoDeEncabezado('Hi Facundo. You have a task due.')).toBeNull();
    });
    it('las dos formas del castellano de 2023 que faltaban (auditor de la tanda 14, nit 5)', () => {
        expect(estadoDeEncabezado('Tiene una tarea vencida hoy')).toBe('vence hoy');
        expect(diasDeAtraso('1 día de retraso')).toBe(1);
        expect(diasDeAtraso('4 días tarde')).toBe(4);
        expect(diasDeAtraso('7 days late')).toBe(7);
        expect(diasDeAtraso('Due in 6 days')).toBeNull();
    });
});

describe('juntar por tarea', () => {
    it('8 tareas asignadas en el mismo minuto son 8 (no se pierden como repetidas)', async () => {
        const { res } = await todo();
        const delMinuto = res.tareas.filter((t) => /^TAREA\d$/.test(t.id ?? ''));
        expect(delMinuto).toHaveLength(8);
    });
    it('los avisos de vencida se cuentan por tarea, con el primero, el ultimo y el mayor atraso', async () => {
        const { res } = await todo();
        const telas = res.tareas.find((t) => t.id === 'TAREATELAS');
        expect(telas).toMatchObject({ asigno: 'Carlos', asignadaEl: '2026-06-23', vence: '2026-07-01', avisosVencida: 1, primerVencida: '2026-07-08', ultimoVencida: '2026-07-08', maxDias: 7 });
        const beon = res.tareas.find((t) => t.id === 'TAREABEON');
        expect(beon.asignadaEl).toBeNull();          // no hay aviso de asignacion: no se inventa
    });
    it('lo que Fak asigno a otros va aparte, y a tres personas es una tarea con sus nombres', async () => {
        const { res } = await todo();
        const proc = res.tareas.filter((t) => t.id === 'TAREAPROC');
        expect(proc).toHaveLength(1);
        expect(proc[0].deFak).toBe(true);
        expect(proc[0].asignadaA).toBe('Leonardo Enrique Lattanzi; Paulo Hernan Centurion');
    });
    it('el estado de cada tarea es el del ULTIMO aviso que la nombra (revision por API, punto 2)', async () => {
        const { res } = await todo();
        const por = (id) => res.tareas.find((t) => t.id === id);
        expect(textoEstado(por('TAREATELAS').ultimoEstado)).toBe('vencida, 7 dias (aviso del 08/07/2026)');
        expect(textoEstado(por('TAREABOM').ultimoEstado)).toBe('vencida, 1 dia (aviso del 25/06/2026)');
        expect(textoEstado(por('TAREA0').ultimoEstado)).toBe('asignada (aviso del 28/04/2026)');
        expect(textoEstado(null)).toBe('—');
    });
    it('una tarea que Carlos le asigna a Fak y Fak reasigna sale en las dos listas, no se cae de una (punto 5)', async () => {
        const deCarlos = mail('P01');
        const reasignada = { ...mail('P04'), id: 'R1', fecha: '2026-06-24 10:00', cuerpo: mail('P04').cuerpo.replace('TAREAPROC', 'TAREATELAS').replace('Armar procedimiento de carga en ARB', 'Telas Nuevas PWa 21-9694 y 21-9695') };
        const { mails } = await leerMails(jsonlDe([deCarlos, reasignada]), { conCuerpo: true, filtro: esAvisoPlanner });
        const res = juntar(mails);
        const md = aMarkdown(res, { hoy: '2026-10-17', leidos: 2, contados: mails.length, fechaMin: 'a', fechaMax: 'b' });
        const [carlos, fak] = md.split('## Tareas que Fak asigno a otros');
        expect(carlos).toContain('Telas Nuevas PWa 21-9694 y 21-9695');
        expect(fak.split('## Otros planes')[0]).toContain('Leonardo Enrique Lattanzi');
    });
    it('el plan viejo «Tareas» no se mezcla con el de Carlos', async () => {
        const { res, mails } = await todo();
        const md = aMarkdown(res, { hoy: '2026-10-17', leidos: 20, contados: mails.length, fechaMin: 'a', fechaMax: 'b' });
        const seccionCarlos = md.split('## Tareas que Fak asigno a otros')[0];
        expect(seccionCarlos).not.toContain('FACU Y TOMY');
        expect(seccionCarlos).not.toContain('gestión de mantenimiento');
        expect(md.split('## Otros planes')[1]).toContain('FACU Y TOMY');
    });
});

describe('la salida', () => {
    it('nunca dice que una tarea esta «abierta» y explica por que', async () => {
        const { res, mails } = await todo();
        const md = aMarkdown(res, { hoy: '2026-10-17', leidos: 20, contados: mails.length, fechaMin: 'a', fechaMax: 'b' });
        expect(md).toContain('Lo que este listado NO dice');
        const filas = md.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Tarea'));
        expect(filas.some((l) => /\babierta\b/i.test(l))).toBe(false);
    });
    it('una clave de API en el titulo de una tarea no llega a la salida', async () => {
        const { res, mails } = await todo();
        const md = aMarkdown(res, { hoy: '2026-10-17', leidos: 20, contados: mails.length, fechaMin: 'a', fechaMax: 'b' });
        expect(md).not.toContain(CLAVE);
        expect(md).not.toMatch(/sk-ant-/);
        expect(md).not.toMatch(PEDAZO_DE_CLAVE);
        expect(md).toContain('[clave retirada]');
    });
    it('la corrida entera da el numero de tareas medido y escribe el archivo', async () => {
        const { jsonl } = await todo();
        const out = path.join(path.dirname(jsonl), 'planner.md');
        const r = spawnSync(process.execPath, [SCRIPT, '--mails', jsonl, '--out', out], { encoding: 'utf8' });
        expect(r.status).toBe(0);
        // TELAS, BEON, BOM, CLAVE y las 8 del mismo minuto: 12 del plan de Carlos asignadas a Fak
        expect(r.stdout).toMatch(/12 tareas de «Actividades Ingenieria» asignadas a Fak/);
        expect(fs.readFileSync(out, 'utf8')).not.toMatch(PEDAZO_DE_CLAVE);
    });
});

/**
 * `scripts/_incaParte.mjs` (tanda 14, item 11): el parte semanal de VW (INCA) leido de la copia local de mails.
 *
 * Lo que se cuida, en las dos direcciones:
 *   - las piezas sin acuerdo de capacidad salen del ENLACE del numero (el texto del mail no las escribe);
 *   - la fecha es la del parte («from Wednesday 14. October 2026»), no la de llegada;
 *   - los RE y RV de Carlos sobre un parte no son partes;
 *   - el BKA en rojo con su primer y ultimo parte;
 *   - si el numero del mail no coincide con las piezas del enlace, la salida lo avisa;
 *   - una clave de API en el texto de un parte no llega a la salida.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esParteInca, fechaDelParte, piezasDelEnlace, leerParte, historia, huecos, aMarkdown } from '../../scripts/_incaParte.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(AQUI, '..', '..', 'scripts', '_incaParte.mjs');
const CLAVE = ['sk', 'ant', 'api03', 'PRUEBA' + 'z'.repeat(28)].join('-');
const PEDAZO_DE_CLAVE = /sk\W*ant\W*api|prueba\W*z{8}/i;   // cualquier pedazo, tambien partido
const CASOS = JSON.parse(fs.readFileSync(path.join(AQUI, 'lectoresMailTanda14.casos.json'), 'utf8'));
const mails = () => CASOS.inca.map((m) => JSON.parse(JSON.stringify(m).replaceAll('{{CLAVE_FALSA}}', CLAVE)));
const partes = () => mails().filter(esParteInca).map(leerParte);
const SEIS = ['2HT881901D_YZM', '2HT853839', '2HC858417D', '2HT881901E', '2HT881901D', '2HT881901E_OHE'];

describe('leer un parte', () => {
    it('las piezas salen del enlace, sin el guion bajo de adelante y en el orden del mail', () => {
        expect(piezasDelEnlace('6 <https://lso.volkswagen.de/inca/x?command=findTLKs&tlks=_2HT853839,_2HC858417D&duns=1>')).toEqual(['2HT853839', '2HC858417D']);
        expect(piezasDelEnlace('sin enlace')).toEqual([]);
    });
    it('la fecha es la del parte, no la de llegada', () => {
        expect(fechaDelParte('this is your weekly INCA status report from Wednesday 14. October 2026, 06:17.')).toBe('2026-10-14');
        expect(fechaDelParte('otra cosa')).toBeNull();
    });
    it('los RE y RV de Carlos no son partes', () => {
        expect(mails().filter(esParteInca).map((m) => m.id)).toEqual(['I01', 'I02', 'I03']);
    });
    it('el ultimo parte: 6 piezas sin BKA, 6 con mas de 2 semanas, ningun rojo', () => {
        const p = leerParte(mails()[0]);
        expect(p).toMatchObject({ fecha: '2026-10-14', cw: '42.2026' });
        expect(p.sinBka).toEqual({ total: 6, masDeDosSemanas: 6, piezas: SEIS });
        expect(p.rojos).toEqual([]);
    });
    it('Total y «> 2 Weeks» son dos columnas, y las piezas salen del enlace del Total (forma del parte CW14 del 01/04: 6 y 3)', () => {
        // parche del auditor de la tanda 14 (nit 1): sin este caso, leer las piezas del segundo enlace o la columna «> 2»
        // del Total dejaba los tests en verde y cambiaba la salida real
        const enlace = (pzs) => `<https://lso.volkswagen.de/inca/x?command=findTLKs&tlks=${pzs.map((p) => `_${p}`).join(',')}&duns=1>`;
        const seis = ['2HT881901E_OHE', '2HT853839', '2HC858417D', '2HT881901E', '2HT881901D', '2HT881901D_YZM'];
        const tres = ['2HT881901E_OHE', '2HT853839', '2HT881901D_YZM'];
        const cuerpo = [
            'this is your weekly INCA status report from Wednesday 01. April 2026, 06:48.',
            'Task description\tSupplier\tTotal\t> 2 Weeks*\t',
            `Parts to be assigned to BKA\t978890452 - Barack Argentina SRL\t6 ${enlace(seis)}  \t3 ${enlace(tres)}  \t`,
        ].join('\n');
        const p = leerParte({ fecha: '2026-04-01 01:48', asunto: 'INCA: weekly status report CW 14.2026', cuerpo });
        expect(p.sinBka).toEqual({ total: 6, masDeDosSemanas: 3, piezas: seis });
    });
    it('un % mal formado en otro lado del renglon no frena la lectura de las piezas', () => {
        expect(piezasDelEnlace('6 <https://lso.volkswagen.de/inca/x?a=100%&tlks=_A1,_B2&duns=1>')).toEqual(['A1', 'B2']);
    });
    it('el valor de tlks codificado se lee igual, y con un % mal formado adentro no frena (ronda 2 del auditor)', () => {
        expect(piezasDelEnlace('6 <https://lso.volkswagen.de/inca/x?tlks=_A1%2C_B2&duns=1>')).toEqual(['A1', 'B2']);
        expect(piezasDelEnlace('6 <https://lso.volkswagen.de/inca/x?tlks=_A1%2C_B2%ZZ&duns=1>')).toEqual(['A1', 'B2%ZZ']);
    });
    it('el rojo del apoyabrazos trasero, con su pieza', () => {
        const p = leerParte(mails()[1]);
        expect(p.rojos).toEqual([{ bka: 'B00000330933', descripcion: 'ARMREST REAR', pieza: '2HC885081', estado: 'Red' }]);
    });
});

describe('de corrido desde (revision por API, punto 7)', () => {
    it('una pieza que salio y volvio esta «de corrido» desde que volvio; la primera vez queda aparte', () => {
        const parte = (fecha, piezas) => ({ fecha, cw: '', sinBka: { total: piezas.length, masDeDosSemanas: 0, piezas }, otrasTareas: [], rojos: [] });
        const { piezas } = historia([parte('2026-04-01', ['A', 'B']), parte('2026-04-08', ['B']), parte('2026-04-15', ['A', 'B'])]);
        expect(piezas.find((x) => x.pieza === 'A')).toMatchObject({ primera: '2026-04-01', deCorridoDesde: '2026-04-15', partes: 2 });
        expect(piezas.find((x) => x.pieza === 'B')).toMatchObject({ primera: '2026-04-01', deCorridoDesde: '2026-04-01', partes: 3 });
        const md = aMarkdown([parte('2026-04-01', ['A']), parte('2026-04-08', []), parte('2026-04-15', ['A'])], { hoy: 'h', leidos: 3, fechaMin: 'a', fechaMax: 'b' });
        expect(md).toContain('| A | 15/04/2026 | 01/04/2026 | 2 de 3 |');
    });
});

describe('la historia', () => {
    it('el BKA en rojo con su primer y ultimo parte', () => {
        const { rojos, orden } = historia(partes());
        expect(orden.map((p) => p.fecha)).toEqual(['2026-04-15', '2026-07-29', '2026-10-14']);
        expect(rojos).toHaveLength(1);
        expect(rojos[0]).toMatchObject({ bka: 'B00000330933', primera: '2026-04-15', ultima: '2026-07-29', partes: 2 });
    });
});

describe('los partes que faltan en la copia', () => {
    it('del 20/05 al 17/06 faltan tres miercoles; semanas seguidas no dan hueco', () => {
        const f = (d) => ({ fecha: d });
        expect(huecos([f('2026-05-13'), f('2026-05-20'), f('2026-06-17'), f('2026-06-24')])).toEqual(['2026-05-27', '2026-06-03', '2026-06-10']);
        expect(huecos([f('2026-10-07'), f('2026-10-14')])).toEqual([]);
    });
    it('la salida avisa los que faltan y que las cuentas son de los partes que estan', () => {
        const md = aMarkdown(partes(), { hoy: '2026-10-17', leidos: 4, fechaMin: 'a', fechaMax: 'b' });
        expect(md).toMatch(/\*\*Partes que faltan en la copia\*\*/);
        expect(md).toContain('22/04/2026');                 // entre el 15/04 y el 29/07 de la muestra
        expect(md).toContain('son de los 3 que estan, no de semanas corridas');
    });
});

describe('la salida', () => {
    it('lista las piezas del ultimo parte con desde cuando aparecen', () => {
        const md = aMarkdown(partes(), { hoy: '2026-10-17', leidos: 4, fechaMin: 'a', fechaMax: 'b' });
        expect(md).toContain('## Ultimo parte: 14/10/2026 (semana 42.2026)');
        expect(md).toContain('**Piezas sin acuerdo de capacidad (BKA): 6**');
        for (const p of SEIS) expect(md).toContain(`| ${p} |`);
        expect(md).toContain('Lo que este listado NO dice');
    });
    it('avisa cuando el numero del mail no coincide con las piezas del enlace', () => {
        const p = partes().find((x) => x.fecha === '2026-04-15');
        expect(p.sinBka.total).toBe(7);
        expect(p.sinBka.piezas).toHaveLength(6);
        const md = aMarkdown([p], { hoy: '2026-10-17', leidos: 1, fechaMin: 'a', fechaMax: 'b' });
        expect(md).toMatch(/El mail dice 7 y el enlace trae 6 piezas/);
        const ok = aMarkdown([partes().find((x) => x.fecha === '2026-10-14')], { hoy: '2026-10-17', leidos: 1, fechaMin: 'a', fechaMax: 'b' });
        expect(ok).not.toMatch(/El mail dice/);
    });
    it('una clave de API en el texto de un parte no llega a la salida', () => {
        const md = aMarkdown(partes(), { hoy: '2026-10-17', leidos: 4, fechaMin: 'a', fechaMax: 'b' });
        expect(md).not.toContain(CLAVE);
        expect(md).not.toMatch(/sk-ant-/);
        expect(md).not.toMatch(PEDAZO_DE_CLAVE);
        expect(md).toContain('[clave retirada]');
    });
    it('la corrida entera lista las piezas del ultimo parte', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inca-'));
        const jsonl = path.join(dir, 'mails.jsonl');
        fs.writeFileSync(jsonl, mails().map((m) => JSON.stringify(m)).join('\n') + '\n');
        const out = path.join(dir, 'inca.md');
        const r = spawnSync(process.execPath, [SCRIPT, '--mails', jsonl, '--out', out], { encoding: 'utf8' });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain(`3 partes; el ultimo (14/10/2026) trae 6 piezas sin BKA: ${SEIS.join(', ')}.`);
        expect(fs.readFileSync(out, 'utf8')).not.toMatch(PEDAZO_DE_CLAVE);
    });
});

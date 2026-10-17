/**
 * `scripts/_adjuntosIndice.mjs` (tanda 14, item 13): indice de los 3D y DXF que llegaron por mail.
 *
 * Lo que se cuida, en las dos direcciones:
 *   - el caso conocido: «estanteria inserto» trae los dos mails (25/08 y 28/08) que el 09/10 se dieron por perdidos, y
 *     no trae la estanteria de cajas; «tope top roll» junta las 6 versiones en una pieza; «pin» no trae nada;
 *   - el mismo mail en dos carpetas cuenta una vez; un borrador no cuenta;
 *   - los comprimidos van aparte, «sin abrir»;
 *   - una clave de API en un asunto, un nombre de archivo o un cuerpo no llega a la salida.
 * Los mails son de muestra (`lectoresMailTanda14.casos.json`); la clave falsa se arma aca, por codigo.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    tipoAdjunto, piezaDe, filasDeAdjuntos, buscar, porPieza, aMarkdown,
} from '../../scripts/_adjuntosIndice.mjs';
import { leerMails } from '../../scripts/_lib/lectorMails.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SCRIPT = path.join(RAIZ, 'scripts', '_adjuntosIndice.mjs');
const CLAVE = ['sk', 'ant', 'api03', 'PRUEBA' + 'x'.repeat(28)].join('-');
const CASOS = JSON.parse(fs.readFileSync(path.join(AQUI, 'lectoresMailTanda14.casos.json'), 'utf8'));

function jsonlDe(mails) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adjuntos-'));
    const p = path.join(dir, 'mails.jsonl');
    fs.writeFileSync(p, mails.map((m) => JSON.stringify(m).replaceAll('{{CLAVE_FALSA}}', CLAVE)).join('\n') + '\n');
    return p;
}

async function filas() {
    const { mails } = await leerMails(jsonlDe(CASOS.adjuntos));
    return { mails, filas: filasDeAdjuntos(mails) };
}

describe('que es un adjunto de diseño', () => {
    it('las extensiones pedidas y las sumadas son diseño, sin importar mayusculas', () => {
        for (const n of ['a.step', 'a.STP', 'a.igs', 'a.iges', 'a.STL', 'a.dxf', 'a.plt', 'a.DWG', 'a.3dm', 'a.CATPart', 'a.sldprt', 'a.3mf', 'a.jt']) expect(tipoAdjunto(n)).toBe('cad');
    });
    it('los comprimidos van aparte y lo demas no entra', () => {
        expect(tipoAdjunto('ESTANTERIA.rar')).toBe('comprimido');
        expect(tipoAdjunto('x.ZIP')).toBe('comprimido');
        expect(tipoAdjunto('ARCHIVO DE VW.tar')).toBe('comprimido');
        for (const n of ['plano.pdf', 'image.png', 'video.mp4', 'sin_extension', 'x.xlsx']) expect(tipoAdjunto(n)).toBeNull();
    });
});

describe('la pieza de un archivo (sin la version del final)', () => {
    it('saca letras y numeros de version, «-1» y «modelo»', () => {
        expect(piezaDe('TOPE TOP ROLL 10B.STL')).toBe('tope top roll');
        expect(piezaDe('TOPE TOP ROLL 2A.STL')).toBe('tope top roll');
        expect(piezaDe('ESTANTERIA INSERTO -1.rar')).toBe('estanteria inserto');
        expect(piezaDe('PIEZA v3.dxf')).toBe('pieza');
    });
    it('no deja el nombre vacio ni toca las palabras de la pieza', () => {
        expect(piezaDe('1.stl')).toBe('1');
        expect(piezaDe('ESTANTERIA ARMADA ESPUMA INSERTO.rar')).toBe('estanteria armada espuma inserto');
    });
});

describe('los repetidos y lo que no salio', () => {
    it('el mismo mail en la Bandeja y en Eliminados cuenta una vez, y se queda la copia de la Bandeja', async () => {
        const { mails } = await filas();
        const estos = mails.filter((m) => m.asunto === 'ESTANTERIA INSERTO MODIFICADO');
        expect(estos).toHaveLength(1);
        expect(estos[0].id).toBe('A03');
    });
    it('un borrador no cuenta', async () => {
        const { filas: f } = await filas();
        expect(f.some((x) => x.archivo === 'PLANO BORRADOR.dxf')).toBe(false);
    });
    it('dos mails distintos del mismo minuto, remitente y asunto son dos (avisos del Planner del 28/04)', async () => {
        const base = { carpeta: 'x / Bandeja de entrada', fecha: '2026-04-28 17:21', de: 'Carlos Baptista', de_mail: 'c', para: '', cc: '', asunto: 'You\'ve been assigned a task', adjuntos: [] };
        const { mails } = await leerMails(jsonlDe([{ ...base, id: '1', cuerpo: 'tarea uno' }, { ...base, id: '2', cuerpo: 'tarea dos' }]));
        expect(mails).toHaveLength(2);
    });
});

describe('caso conocido: el 3D de la estanteria del inserto (dado por perdido el 09/10)', () => {
    it('«estanteria inserto» trae los dos mails de agosto y no la estanteria de cajas', async () => {
        const { filas: f } = await filas();
        const r = buscar(f, 'estanteria inserto');
        expect(r.map((x) => x.fecha).sort()).toEqual(['2026-08-25 16:02', '2026-08-28 16:45']);
        expect(r.map((x) => x.archivo).sort()).toEqual(['ESTANTERIA ARMADA ESPUMA INSERTO.rar', 'ESTANTERIA INSERTO -1.rar']);
        expect(r.every((x) => x.tipo === 'comprimido')).toBe(true);
        expect(r.some((x) => x.asunto === 'ESTANTERIA DE CAJAS')).toBe(false);
    });
    it('«tope top roll» junta las 6 versiones en una sola pieza, en orden', async () => {
        const { filas: f } = await filas();
        const piezas = porPieza(buscar(f, 'tope top roll'));
        expect(piezas).toHaveLength(1);
        const archivos = [...piezas[0].archivos.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map((a) => a.archivo);
        expect(archivos.filter((a) => a.endsWith('A.STL')).map((a) => a.replace(/\D/g, ''))).toEqual(['2', '3', '4', '6', '7', '10']);
        expect(piezas[0].mails.size).toBe(7);           // 6 de Pablo y el reenvio de Fak
    });
    it('«pin» no trae nada (el mail de los pines lleva fotos y video, no un 3D)', async () => {
        const { filas: f } = await filas();
        expect(buscar(f, 'pin')).toHaveLength(0);
    });
});

describe('dos piezas distintas con el mismo nombre de archivo', () => {
    it('la tabla por pieza muestra los asuntos: «ESTANTERIA.rar» y «ESTANTERIA-1.rar» del 21/08 son dos estanterias', () => {
        const base = { carpeta: 'x / Bandeja de entrada', clase: 'entrada', de: 'Pablo Gamboa', de_mail: 'p', para: 'Carlos Baptista', cc: '', cuerpo: '' };
        const mails = [
            { ...base, id: '1', fecha: '2026-08-21 11:19', asunto: 'ESTANTERIA DE CAJAS', adjuntos: ['ESTANTERIA.rar'] },
            { ...base, id: '2', fecha: '2026-08-21 12:19', asunto: 'RE: ESTANTERIA IP Y TOP ROLL', adjuntos: ['ESTANTERIA-1.rar'] },
        ];
        const f = filasDeAdjuntos(mails);
        expect(porPieza(f)).toHaveLength(1);           // el nombre solo no las separa...
        const md = aMarkdown(f, { hoy: '2026-10-17', leidos: 2, contados: 2, fechaMin: 'a', fechaMax: 'b' });
        const fila = md.split('\n').find((l) => l.startsWith('| estanteria |'));
        expect(fila).toContain('«ESTANTERIA DE CAJAS»');  // ...pero los asuntos se ven al lado, sin el «RE:»
        expect(fila).toContain('«ESTANTERIA IP Y TOP ROLL»');
    });
});

describe('la salida', () => {
    it('los comprimidos tienen su seccion «sin abrir» y el resumen los cuenta aparte', async () => {
        const { mails, filas: f } = await filas();
        const md = aMarkdown(f, { hoy: '2026-10-17', leidos: 16, contados: mails.length, fechaMin: 'a', fechaMax: 'b' });
        expect(md).toMatch(/\*\*3 comprimidos sin abrir\*\*/);
        expect(md).toContain('## Detalle — comprimidos sin abrir');
        expect(md).toContain('ESTANTERIA INSERTO -1.rar');
    });
    it('una clave de API en el asunto o en el nombre del archivo no llega a la salida', async () => {
        const { mails, filas: f } = await filas();
        const md = aMarkdown(f, { hoy: '2026-10-17', leidos: 16, contados: mails.length, fechaMin: 'a', fechaMax: 'b' });
        expect(md).not.toContain(CLAVE);
        expect(md).not.toMatch(/sk-ant-/);
        expect(md).toContain('[clave retirada]');
    });
    it('la corrida entera escribe el archivo pedido, sin la clave, y frena con una opcion desconocida', () => {
        const jsonl = jsonlDe(CASOS.adjuntos);
        const out = path.join(path.dirname(jsonl), 'indice.md');
        const r = spawnSync(process.execPath, [SCRIPT, '--mails', jsonl, '--out', out], { encoding: 'utf8' });
        expect(r.status).toBe(0);
        const md = fs.readFileSync(out, 'utf8');
        expect(md).toContain('# Adjuntos 3D y DXF que llegaron por mail');
        expect(md).not.toMatch(/sk-ant-/);
        expect(r.stdout).not.toMatch(/sk-ant-/);
        const mal = spawnSync(process.execPath, [SCRIPT, '--abrir-outlook'], { encoding: 'utf8' });
        expect(mal.status).toBe(1);
        expect(mal.stderr).toContain('opcion desconocida');
    });
});

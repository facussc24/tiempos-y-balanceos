#!/usr/bin/env node
/**
 * publicar.mjs - deja en la biblioteca de Ingenieria (la nube) la carpeta con el instalador de los mails de la PC de Calidad:
 *
 *   <biblioteca>\INSTALAR MAILS EN LA PC DE CALIDAD\
 *       Mails-PC-Calidad.cmd      <- el doble clic
 *       LEEME.txt
 *       programa\                 <- instalar.ps1, subir.ps1, mails_pc.mjs, mails_area.mjs, mails_outlook.ps1, casillas.json
 *
 * Copia desde tools/claude-area. No borra nada de la carpeta: solo agrega o reemplaza estos archivos. Si ya esta publicado
 * lo mismo, no toca nada. `casillas.json` de la nube no se pisa si ya existe (es lo que se edita para sumar cuentas).
 *
 *   node tools/claude-area/mails_pc/publicar.mjs           # dice que haria
 *   node tools/claude-area/mails_pc/publicar.mjs --aplicar # lo hace
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buscarBiblioteca } from '../../../scripts/_lib/nubeRutas.mjs';

export const CARPETA = 'INSTALAR EN UNA PC NUEVA/2- Mails de Calidad';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const AREA = path.resolve(AQUI, '..');
/** [origen, destino dentro de CARPETA, se pisa si ya existe] */
export const ARCHIVOS = [
    [path.join(AQUI, 'Mails-PC-Calidad.cmd'), 'Mails-PC-Calidad.cmd', true],
    [path.join(AQUI, 'instalar.cmd'), 'instalar.cmd', true],
    [path.join(AQUI, 'LEEME.txt'), 'LEEME.txt', true],
    [path.join(AQUI, 'instalar.ps1'), 'programa/instalar.ps1', true],
    [path.join(AQUI, 'subir.ps1'), 'programa/subir.ps1', true],
    [path.join(AQUI, 'casillas.json'), 'programa/casillas.json', false],
    [path.join(AREA, 'mails_pc.mjs'), 'programa/mails_pc.mjs', true],
    [path.join(AREA, 'mails_area.mjs'), 'programa/mails_area.mjs', true],
    [path.join(AREA, 'mails_outlook.ps1'), 'programa/mails_outlook.ps1', true],
];

const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** Lo que hay que hacer, sin hacerlo: [{ destino, estado: 'nuevo'|'distinto'|'igual'|'se_respeta' }]. */
export function plan(biblioteca) {
    const base = path.join(biblioteca, CARPETA);
    return ARCHIVOS.map(([origen, rel, pisa]) => {
        const destino = path.join(base, ...rel.split('/'));
        let estado = 'nuevo';
        if (fs.existsSync(destino)) estado = !pisa ? 'se_respeta' : (hash(origen) === hash(destino) ? 'igual' : 'distinto');
        return { origen, destino, estado };
    });
}

export function aplicar(biblioteca) {
    const hecho = [];
    for (const p of plan(biblioteca)) {
        if (p.estado !== 'nuevo' && p.estado !== 'distinto') continue;
        fs.mkdirSync(path.dirname(p.destino), { recursive: true });
        const tmp = `${p.destino}.${process.pid}.subiendo`;
        fs.copyFileSync(p.origen, tmp);
        fs.renameSync(tmp, p.destino);
        if (hash(p.origen) !== hash(p.destino)) throw new Error(`no quedo igual: ${p.destino}`);
        hecho.push(p.destino);
    }
    return hecho;
}

const esElPrograma = !!process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (esElPrograma) {
    const bib = buscarBiblioteca();
    if (!bib) { console.error('No veo la biblioteca de Ingenieria en esta PC.'); process.exit(1); }
    for (const p of plan(bib)) console.log(`${p.estado.padEnd(10)} ${p.destino}`);
    if (process.argv.includes('--aplicar')) {
        const hecho = aplicar(bib);
        console.log(`\nPublicado: ${hecho.length} archivo(s) en ${path.join(bib, CARPETA)}`);
    } else console.log('\n(solo dice que haria: --aplicar para publicarlo)');
}

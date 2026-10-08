#!/usr/bin/env node
/**
 * publicar.mjs - deja en la biblioteca de Ingenieria (la nube) el instalador de "mi asistente completo" para una PC nueva:
 *
 *   <biblioteca>\INSTALAR EN UNA PC NUEVA\
 *       LEEME.txt
 *       1- Mi asistente completo\   Instalar-Mi-PC.cmd (el doble clic) + programa\ (instalar_mi_pc.ps1, ajustar_settings.mjs)
 *       2- Mails de Calidad\        (lo publica tools/claude-area/mails_pc/publicar.mjs)
 *
 * Una sola carpeta con dos doble clic numerados (Fak, 08/10/2026: la nube estaba hecha un quilombo). No borra nada: solo
 * agrega o reemplaza estos archivos. Sin nombres con la palabra del asistente (regla firma-IA).
 *
 *   node tools/instalar_mi_pc/publicar.mjs            # dice que haria
 *   node tools/instalar_mi_pc/publicar.mjs --aplicar  # lo hace
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buscarBiblioteca } from '../../scripts/_lib/nubeRutas.mjs';

export const CARPETA = 'INSTALAR EN UNA PC NUEVA';
export const SUBCARPETA = '1- Mi asistente completo';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
/** [origen, destino dentro de CARPETA] */
export const ARCHIVOS = [
    [path.join(AQUI, 'LEEME_CARPETA.txt'), 'LEEME.txt'],
    [path.join(AQUI, 'Instalar-Mi-PC.cmd'), `${SUBCARPETA}/Instalar-Mi-PC.cmd`],
    [path.join(AQUI, 'LEEME.txt'), `${SUBCARPETA}/LEEME.txt`],
    [path.join(AQUI, 'instalar_mi_pc.ps1'), `${SUBCARPETA}/programa/instalar_mi_pc.ps1`],
    [path.join(AQUI, 'ajustar_settings.mjs'), `${SUBCARPETA}/programa/ajustar_settings.mjs`],
];

const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** Lo que hay que hacer, sin hacerlo: [{ origen, destino, estado: 'nuevo'|'distinto'|'igual' }]. */
export function plan(biblioteca) {
    const base = path.join(biblioteca, CARPETA);
    return ARCHIVOS.map(([origen, rel]) => {
        const destino = path.join(base, ...rel.split('/'));
        const estado = !fs.existsSync(destino) ? 'nuevo' : (hash(origen) === hash(destino) ? 'igual' : 'distinto');
        return { origen, destino, estado };
    });
}

export function aplicar(biblioteca) {
    const hecho = [];
    for (const p of plan(biblioteca)) {
        if (p.estado === 'igual') continue;
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

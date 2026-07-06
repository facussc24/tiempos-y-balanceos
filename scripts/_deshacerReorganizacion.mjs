/**
 * _deshacerReorganizacion.mjs — Revierte un renombrado hecho por _reorganizarServidorAmfe.mjs.
 *
 * Lee el log JSON de rollback (reports/reorganizacion_<ts>.json) y aplica los renames
 * inversos. Solo renombra; nunca borra. Salta lo que ya no existe o cuyo destino existe.
 *
 * Uso: node scripts/_deshacerReorganizacion.mjs reports/reorganizacion_<ts>.json
 */

import { readFileSync, existsSync, renameSync } from 'node:fs';

const logPath = process.argv[2];
if (!logPath || !existsSync(logPath)) {
    console.error('Uso: node scripts/_deshacerReorganizacion.mjs <log_de_rollback.json>');
    process.exit(1);
}

const { rollback = [] } = JSON.parse(readFileSync(logPath, 'utf8'));
let hechos = 0, saltados = 0;
// Aplicar en orden inverso al que se hicieron.
for (const step of [...rollback].reverse()) {
    if (step.op !== 'rename') { saltados++; continue; }
    const { from, to } = step; // from/to ya estan invertidos para deshacer
    if (!existsSync(from)) { console.warn(`SALTADO: no existe ${from}`); saltados++; continue; }
    if (existsSync(to)) { console.warn(`SALTADO: destino ya existe ${to}`); saltados++; continue; }
    renameSync(from, to);
    hechos++;
}
console.info(`Deshecho: ${hechos} rename(s) | saltados: ${saltados}.`);

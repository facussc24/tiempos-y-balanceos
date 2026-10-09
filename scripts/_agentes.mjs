/**
 * _agentes.mjs — ver y fijar el presupuesto de subagentes (08/10/2026).
 *
 * El guardian `~/.claude/hooks/agentes-guard.sh` cobra puntos por ventana de 10 minutos segun el modelo
 * (haiku 1 · sonnet 4 · opus 8 · fable 20; 40 puntos por defecto). Fak: "en algunas tareas quiero
 * destinar mas presupuesto... necesito entenderlo". Esto lo muestra y lo deja escrito.
 *
 *   node scripts/_agentes.mjs                                  estado: presupuesto vigente, puntos usados, pase
 *   node scripts/_agentes.mjs --presupuesto 20 --porque "investigacion grande de la noche del 08/10"
 *       sube el presupuesto a 20 Sonnet (80 puntos cada 10 min) por 12 h y anota el motivo
 *       (--presupuesto 0 apaga el conteo; igual que `echo 0 > ~/.claude/.agent-limit`)
 *   node scripts/_agentes.mjs --normal                         vuelve al default (10 Sonnet = 40 puntos)
 *   node scripts/_agentes.mjs --historial                      las subas anotadas (cuando, cuanto, por que)
 *
 * Regla: la suba la decide Claude al arrancar una tarea que lo merece y lo dice, o la pide Fak textual
 * (techo-agentes.md). Siempre con --porque: una suba sin motivo no se anota. Lo unico que este programa
 * saca del disco es el archivo de UN numero (`.agent-limit`), con --normal, y lo anota en el registro.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resumenVentana, limiteVigente, lineaRegistro, textoEstado, presupuestoPuntos } from './_lib/agentesPresupuesto.mjs';

const BASE = path.join(os.homedir(), '.claude');
const LOG = path.join(BASE, '.agent-spawns.log');
const LIMITE = path.join(BASE, '.agent-limit');
const PASE = path.join(BASE, '.agent-opus-ok');
const REGISTRO = path.join(BASE, '.agent-presupuestos.log');

function leerArgs(argv) {
    const a = {};
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        if (k === '--normal' || k === '--historial') a[k.slice(2)] = true;
        else if ((k === '--presupuesto' || k === '--porque') && i + 1 < argv.length) a[k.slice(2)] = argv[++i];
        else { console.error(`no conozco el argumento ${k}. No hago nada.`); process.exit(2); }
    }
    return a;
}

const lineas = () => { try { return fs.readFileSync(LOG, 'utf8').split('\n'); } catch { return []; } };
const mtimeSeg = (ruta) => { try { return Math.floor(fs.statSync(ruta).mtimeMs / 1000); } catch { return null; } };
const ahora = Math.floor(Date.now() / 1000);

function estado() {
    const ls = lineas();
    const ventana = resumenVentana(ls, { ahora });
    const hoy = resumenVentana(ls, { ahora, ventanaSeg: 24 * 3600 });
    let contenido = null;
    try { contenido = fs.readFileSync(LIMITE, 'utf8'); } catch { contenido = null; }
    const limite = limiteVigente({ contenido, modificadoSeg: mtimeSeg(LIMITE), ahora });
    const paseMod = mtimeSeg(PASE);
    const pase = paseMod != null && ahora - paseMod <= 43200;
    console.log(textoEstado({ ventana, limite, pase, hoy }));
}

const a = leerArgs(process.argv.slice(2));
if (a.historial) {
    let t = '';
    try { t = fs.readFileSync(REGISTRO, 'utf8'); } catch { t = ''; }
    console.log(t.trim() ? `cuando\tlimite\tpuntos\tPC\tpor que\n${t.trim()}` : 'Sin subas anotadas.');
} else if (a.normal) {
    // El default es "sin archivo": se saca el archivo del numero (uno solo, en ~/.claude), nada mas.
    try { fs.unlinkSync(LIMITE); } catch { /* ya no estaba */ }
    fs.appendFileSync(REGISTRO, `${lineaRegistro({ limite: 10, porque: 'vuelve al default (--normal)' })}\n`, 'utf8');
    console.log('Presupuesto de vuelta en el default: 10 Sonnet = 40 puntos cada 10 min.');
} else if (a.presupuesto != null) {
    const n = Number(a.presupuesto);
    if (!Number.isInteger(n) || n < 0 || n > 9999) { console.error('--presupuesto quiere un entero de 0 a 9999 (N Sonnet; 0 = sin conteo).'); process.exit(2); }
    if (!a.porque || !String(a.porque).trim()) { console.error('Una suba sin motivo no se anota: agrega --porque "<la tarea y quien lo pidio>".'); process.exit(2); }
    fs.mkdirSync(BASE, { recursive: true });
    fs.writeFileSync(LIMITE, `${n}\n`, 'utf8');
    fs.appendFileSync(REGISTRO, `${lineaRegistro({ limite: n, porque: a.porque })}\n`, 'utf8');
    console.log(`Presupuesto: ${n === 0 ? 'SIN CONTEO' : `${n} Sonnet = ${presupuestoPuntos(n)} puntos cada 10 min`} por 12 h. Motivo anotado: ${a.porque}`);
} else {
    estado();
}

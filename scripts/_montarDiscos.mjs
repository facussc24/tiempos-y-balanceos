/**
 * _montarDiscos.mjs — reconecta Y: (\\SERVER\compartido) y Z: (\\SERVER\sistema).
 *
 * POR QUE EXISTE
 * El 24/08/2026 perdimos ~20 minutos "diagnosticando la red" con el servidor perfecto.
 * Dos causas, las dos evitables:
 *   1) Se intento montar por IP (`\\192.168.1.177\compartido`). Por IP Windows NO aplica
 *      las credenciales guardadas: pide usuario y termina en error 1223. **Por NOMBRE
 *      (`\\SERVER\...`) monta solo.** Nunca cambiar el nombre por la IP para "arreglar".
 *   2) El .ps1 se genero con un heredoc de bash y bash se comio un backslash, asi que
 *      PowerShell recibio `\server\compartido` y devolvio "error de sistema 67 - no se
 *      encuentra el nombre de red". Ese 67 parecia del servidor y era nuestro.
 * Detalle completo: memoria `reference_discos_red_y_z_solo_por_cable`.
 *
 * ⚠️ SEGURIDAD DE EJECUCION (pedido explicito de Fak, 24/08/2026, por un script previo
 * que dejo la CPU al 100% y le calento la notebook). Este script, a proposito:
 *   · corre UNA vez y termina — no hay bucle, no hay `while`, no hay reintento infinito;
 *   · NO crea tarea programada, servicio, hook ni nada residente;
 *   · NO queda en background: son llamadas sincronicas con timeout duro de 20 s c/u;
 *   · cierra stdin en cada llamada, asi `net use` NUNCA se queda esperando una contrasena
 *     (ese es el caso que dejaria un proceso colgado);
 *   · si algo falla, imprime el motivo y sale — no insiste.
 * Si algun dia se le agrega un reintento, que sea con tope contado y que se vea aca.
 *
 * Uso:  node scripts/_montarDiscos.mjs            (monta si hace falta, y verifica)
 *       node scripts/_montarDiscos.mjs --check    (solo diagnostica, no toca nada)
 */

import { execFileSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';

const SOLO_CHEQUEAR = process.argv.includes('--check');

const DISCOS = [
    { letra: 'Y:', unc: '\\\\SERVER\\compartido', sanoAprox: 219 },
    { letra: 'Z:', unc: '\\\\SERVER\\sistema', sanoAprox: 28 },
];

/** Corre un comando con timeout duro y stdin cerrado. Nunca lanza: devuelve texto. */
function correr(cmd, args, timeout = 20_000) {
    try {
        return execFileSync(cmd, args, {
            timeout,                       // tope duro: jamas queda colgado
            stdio: ['ignore', 'pipe', 'pipe'], // stdin cerrado => no espera contrasena
            encoding: 'latin1',
            windowsHide: true,
        }).toString();
    } catch (e) {
        return `[fallo] ${(e.stderr || e.stdout || e.message || '').toString().trim()}`;
    }
}

/**
 * Responde de verdad? No alcanza con que la letra exista: hay que poder LEER.
 *
 * LIMITACION CONOCIDA, a la vista y medida: `readdirSync` no acepta timeout. Si la
 * unidad quedara MAPEADA PERO MUERTA, esta llamada se bloquea hasta que Windows
 * agota su propio timeout de red, que puede pasar los 20 s de las llamadas `net`.
 * NO consume CPU —es espera de I/O, no un loop— asi que no repite el incidente que
 * motivo las advertencias de la cabecera; lo unico que sufre es la promesa de que
 * esto termina rapido SIEMPRE.
 *
 * Se probo reemplazarlo por `dir` en subproceso con timeout y dio FALSO NEGATIVO
 * ("no responde" con los discos montados), o sea empeoraba la funcion principal
 * para cubrir un caso de borde. Se deja el mecanismo que funciona y la limitacion
 * escrita. Si algun dia molesta de verdad, la salida es un chequeo previo por
 * `net use <letra>` (que no toca el filesystem) — pero medirlo antes de cambiarlo.
 */
function responde(letra) {
    try {
        if (!existsSync(`${letra}\\`)) return null;
        return readdirSync(`${letra}\\`).length;
    } catch {
        return null;
    }
}

console.log('Discos de red Barack — Y: y Z:\n');

let faltaAlguno = false;
for (const d of DISCOS) {
    const n = responde(d.letra);
    if (n === null) {
        console.log(`  ${d.letra} no responde`);
        faltaAlguno = true;
    } else {
        console.log(`  ${d.letra} OK — ${n} elementos (sano ≈ ${d.sanoAprox})`);
    }
}

if (!faltaAlguno) {
    console.log('\nLos dos discos ya estaban montados. No toco nada.');
    process.exit(0);
}

if (SOLO_CHEQUEAR) {
    console.log('\n--check: no monto nada. Corre sin --check para reconectar.');
    process.exit(1);
}

console.log('\nReconectando por NOMBRE (\\\\SERVER\\...), nunca por IP...\n');

for (const d of DISCOS) {
    if (responde(d.letra) !== null) continue;
    // Un mapeo muerto no se reconecta solo: hay que borrarlo antes.
    correr('net', ['use', d.letra, '/delete', '/y']);
    const salida = correr('net', ['use', d.letra, d.unc, '/persistent:yes']);
    const n = responde(d.letra);
    if (n === null) {
        console.log(`  ${d.letra} FALLO — ${salida.replace(/\s+/g, ' ').trim()}`);
    } else {
        console.log(`  ${d.letra} montado y verificado — ${n} elementos`);
    }
}

const quedanMal = DISCOS.filter(d => responde(d.letra) === null);
if (quedanMal.length === 0) {
    console.log('\nListo: los dos discos responden.');
    process.exit(0);
}

console.log(`\nQuedo sin montar: ${quedanMal.map(d => d.letra).join(', ')}`);
console.log('Que mirar, en este orden (lo demas son falsos negativos conocidos):');
console.log('  1. Estas en una red de Barack?  ->  ipconfig  (deberia dar 192.168.1.x)');
console.log('  2. El nombre resuelve?          ->  nslookup server   (deberia dar 192.168.1.177)');
console.log('  3. Si pide usuario y contrasena: la escribe Fak, no se guarda en ningun script.');
console.log('  NO sirven para diagnosticar: ping (el server no responde ICMP),');
console.log('  nbtstat (el server no tiene NetBIOS) ni net view (da 1702 aun estando sano).');
process.exit(1);

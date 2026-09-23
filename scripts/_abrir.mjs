/**
 * Abre un archivo en la PC de Fak con su programa y CONFIRMA que quedo una ventana abierta.
 *
 * Por que existe (22/09/2026): Fak pidio "abrimelo" 22 veces en el mes, y mas de una vez la
 * respuesta fue "Abierto en tu visor" sin que se abriera nada (08/09: *"no lo veo abierto"*;
 * 21/09: el PDF habia quedado en el scratchpad). Lanzar un programa no es verlo abierto: esto
 * da OK solo si aparece una ventana cuyo titulo nombra al archivo.
 *
 * Uso:
 *   node scripts/_abrir.mjs "<ruta del archivo>" [--espera 20]
 * Salida: "ABIERTO: <programa> — <titulo>" (exit 0) · "NO SE VE ABIERTO ..." (exit 1) ·
 *         archivo inexistente (exit 2). Ante un NO, no se le dice a Fak que esta abierto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Nombre sin extension, normalizado para comparar con un titulo de ventana. */
function base(ruta) {
    return path.basename(ruta, path.extname(ruta)).toLowerCase();
}

/**
 * ¿El titulo de la ventana nombra al archivo? Excel/Word/Acrobat/Edge ponen el nombre (a veces
 * sin extension, a veces cortado con "..."): se compara el nombre sin extension y, si es largo,
 * sus primeros 25 caracteres.
 */
export function tituloCoincide(titulo, ruta) {
    const t = String(titulo || '').toLowerCase();
    const b = base(ruta);
    if (!t || !b) return false;
    if (t.includes(b)) return true;
    return b.length > 25 && t.includes(b.slice(0, 25));
}

/** Carpetas donde Fak no va a buscar un archivo despues (sirven para mirar, no para dejar). */
export function esCarpetaTemporal(ruta) {
    return /[\\/](Temp|tmp)[\\/]|[\\/]scratchpad[\\/]|[\\/]AppData[\\/]Local[\\/]Temp[\\/]/i.test(ruta);
}

function ps(comando) {
    return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', comando],
        { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
}

function ventanas() {
    const out = ps("Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress");
    if (!out.trim()) return [];
    const j = JSON.parse(out);
    return Array.isArray(j) ? j : [j];
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function main(argv) {
    const i = argv.indexOf('--espera');
    const espera = i >= 0 ? Number(argv[i + 1]) : 20;
    const ruta = argv.find((a, k) => !a.startsWith('--') && argv[k - 1] !== '--espera');
    if (!ruta) { console.log('Uso: node scripts/_abrir.mjs "<ruta>" [--espera 20]'); return 2; }
    const abs = path.resolve(ruta);
    if (!fs.existsSync(abs)) { console.error(`ERROR: no existe ${abs}`); return 2; }
    if (esCarpetaTemporal(abs)) {
        console.log('OJO: esta en una carpeta temporal; si Fak lo tiene que encontrar despues, va a su carpeta de trabajo.');
    }
    ps(`Start-Process -FilePath '${abs.replace(/'/g, "''")}'`);
    for (let s = 0; s < espera; s += 2) {
        await dormir(2000);
        const v = ventanas().find((w) => tituloCoincide(w.MainWindowTitle, abs));
        if (v) { console.log(`ABIERTO: ${v.ProcessName} — ${v.MainWindowTitle}`); return 0; }
    }
    console.log(`NO SE VE ABIERTO: ninguna ventana nombra a "${path.basename(abs)}" despues de ${espera} s. No decirle a Fak que esta abierto; pasarle la ruta.`);
    return 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main(process.argv.slice(2)).then((n) => process.exit(n));
}

/**
 * nubeVersion.mjs — version minima de Claude Code para las dos PC de Fak (H40, R2 #4): 2.1.293.
 * `_nube.mjs --sincronizar` la mira y AVISA si la PC esta atras; no frena nada, la memoria tiene que
 * viajar igual. Las PC por area tienen su propio aviso en S2-8, no aca.
 * Logica pura probada en `__tests__/scripts/nubeVersion.test.mjs` con un exec de mentira.
 */
import { execSync } from 'child_process';

export const VERSION_MINIMA_CLAUDE = '2.1.293';

/** `claude --version` imprime "2.1.293 (Claude Code)": se queda con los tres numeros. null si no hay. */
export function parsearVersion(texto) {
    const m = String(texto || '').match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Por numero y no por texto: "2.1.1000" es mas nueva que "2.1.293" aunque como string ordene antes. */
export function compararVersiones(a, b) {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
}

/** Salida de `claude --version`, o null si no se pudo correr (sin claude en el PATH de la tarea, colgado). */
export function leerVersionClaude(exec = execSync) {
    try {
        return String(exec('claude --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000, windowsHide: true })).trim();
    } catch { return null; }
}

/** Linea para la lista de avisos de --sincronizar, o null si la version alcanza. */
export function avisoVersion(texto, minima = VERSION_MINIMA_CLAUDE) {
    const actual = parsearVersion(texto);
    if (!actual) return `claude: no pude leer la version instalada (minima para las PC de Fak: ${minima}); correr "claude --version" a mano`;
    if (compararVersiones(actual, parsearVersion(minima)) < 0) {
        return `claude: esta PC tiene ${actual.join('.')} y la minima es ${minima}: actualizar (claude update)`;
    }
    return null;
}

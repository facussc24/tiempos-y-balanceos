/**
 * Rotacion guiada de VITE_AUTO_LOGIN_PASSWORD (la credencial del dev-login y
 * del backup). Pensado para que lo corra FAK en una terminal:
 *
 *     node scripts/_rotarPasswordDev.mjs
 *
 * Que hace:
 *   1. Genera una contraseña fuerte al azar EN ESTA MAQUINA y la copia al
 *      portapapeles (no se muestra completa en pantalla).
 *   2. Abre el dashboard de Supabase en el navegador para que la pegues en
 *      el usuario admin@barack.com (Update/Reset password).
 *   3. Cuando confirmas con ENTER, la escribe en .env.local (solo local,
 *      gitignoreado — NUNCA va al repo ni a workflows, regla dev-login.md).
 *   4. Corre scripts/_backup.mjs para verificar que el login anda: si el
 *      backup sale valido, la rotacion quedo cerrada y ademas tenes el
 *      primer backup real desde el 25/06.
 *
 * Por que existe: la contraseña anterior quedo publicada en el bundle de
 * GitHub Pages (incidente 2026-07-30). Rotarla la invalida. Claude no puede
 * elegir ni tipear contraseñas — este script deja ese paso en manos de Fak
 * sin que la contraseña pase por ningun chat ni archivo del repo.
 */
import { randomInt } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const RUTA_ENV = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const URL_USUARIOS = 'https://supabase.com/dashboard/project/fbfsbbewmgoegjgnkkag/auth/users';
const USUARIO = 'admin@barack.com';

// Sin comillas, espacios ni caracteres que puedan romper el parseo de .env.local
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789.-_!';
const LARGO = 20;

function generarPassword() {
    let p = '';
    for (let i = 0; i < LARGO; i++) p += ALFABETO[randomInt(ALFABETO.length)];
    return p;
}

function copiarAlPortapapeles(texto) {
    const r = spawnSync('clip', { input: texto, windowsHide: true });
    return r.status === 0;
}

function abrirNavegador(url) {
    try {
        spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } catch {
        console.log(`  (abrir a mano: ${url})`);
    }
}

function esperarEnter(mensaje) {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(mensaje, () => { rl.close(); resolve(); });
    });
}

function escribirEnEnvLocal(password) {
    if (!existsSync(RUTA_ENV)) {
        console.error(`\n✗ No existe ${RUTA_ENV} — crear el archivo primero.`);
        process.exit(1);
    }
    const original = readFileSync(RUTA_ENV, 'utf8');
    const linea = `VITE_AUTO_LOGIN_PASSWORD=${password}`;
    let nuevo;
    if (/^VITE_AUTO_LOGIN_PASSWORD=.*$/m.test(original)) {
        nuevo = original.replace(/^VITE_AUTO_LOGIN_PASSWORD=.*$/m, linea);
    } else if (/^VITE_AUTO_LOGIN_EMAIL=.*$/m.test(original)) {
        // La agrega pegada al email, que es donde se espera encontrarla
        nuevo = original.replace(/^(VITE_AUTO_LOGIN_EMAIL=.*)$/m, `$1\n${linea}`);
    } else {
        nuevo = original.replace(/\n*$/, '\n') + linea + '\n';
    }
    writeFileSync(RUTA_ENV, nuevo, 'utf8'); // sin BOM
}

console.log('\n=== Rotacion de la contraseña del dev-login (admin@barack.com) ===\n');

const password = generarPassword();
const enPortapapeles = copiarAlPortapapeles(password);

if (enPortapapeles) {
    console.log('  1. Contraseña nueva generada y COPIADA AL PORTAPAPELES.');
    console.log(`     (empieza con "${password.slice(0, 3)}..." — no se muestra entera)`);
} else {
    console.log('  1. Contraseña nueva generada (no se pudo copiar al portapapeles):');
    console.log(`     ${password}`);
}

console.log('\n  2. Se abre el dashboard de Supabase. Ahi:');
console.log(`     - clic en el usuario ${USUARIO}`);
console.log('     - opcion "Update password" / "Reset password" (menu "..." del usuario)');
console.log('     - PEGAR la contraseña (Ctrl+V) y guardar\n');
abrirNavegador(URL_USUARIOS);

await esperarEnter('  3. Cuando este guardada en Supabase, apreta ENTER para seguir... ');

escribirEnEnvLocal(password);
console.log(`\n  ✓ .env.local actualizado (${RUTA_ENV})`);

console.log('\n  4. Verificando con un backup real (usa el login nuevo)...\n');
const backup = spawnSync('node', [new URL('./_backup.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')], {
    stdio: 'inherit',
});

if (backup.status === 0) {
    console.log('\n✓ LISTO. Contraseña rotada, .env.local al dia y backup valido.');
    console.log('  La contraseña vieja (la que quedo publicada) ya no sirve.');
    console.log('  Si la app en produccion te pide login de nuevo, entra con la nueva');
    console.log('  (el navegador te va a ofrecer guardarla).');
} else {
    console.error('\n✗ El backup fallo. Causa mas probable: la contraseña pegada en');
    console.error('  Supabase no coincide con la generada. Corre este script de nuevo');
    console.error('  (genera otra y repite los pasos).');
    process.exit(1);
}

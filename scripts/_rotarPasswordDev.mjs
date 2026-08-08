/**
 * Rotacion guiada de VITE_AUTO_LOGIN_PASSWORD (la credencial del dev-login y
 * del backup). Pensado para que lo corra FAK en una terminal:
 *
 *     node scripts/_rotarPasswordDev.mjs
 *
 * Que hace:
 *   1. Genera una contraseña fuerte al azar EN ESTA MAQUINA y arma la orden
 *      SQL que la setea en el usuario admin@barack.com. Copia la orden
 *      COMPLETA al portapapeles (la contraseña no se muestra en pantalla).
 *   2. Abre el SQL Editor del dashboard de Supabase: pegar (Ctrl+V) y Run.
 *      (El panel de usuarios NO sirve para esto: solo ofrece "Send password
 *      recovery", y admin@barack.com no es un mail real — verificado
 *      2026-08-08. Por eso se setea por SQL, que no depende de ningun mail.)
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
const URL_SQL_EDITOR = 'https://supabase.com/dashboard/project/fbfsbbewmgoegjgnkkag/sql/new';
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

// La contraseña se setea via SQL Editor (el panel de usuarios solo ofrece un
// mail de recuperacion, y admin@barack.com no es un mail real). El RETURNING
// hace que la corrida exitosa muestre 1 fila con el email — esa es la señal
// de que anduvo. crypt/gen_salt verificados contra la base el 2026-08-08.
const sqlRotacion =
    `update auth.users\n` +
    `set encrypted_password = extensions.crypt('${password}', extensions.gen_salt('bf'))\n` +
    `where email = '${USUARIO}'\n` +
    `returning email;`;

const enPortapapeles = copiarAlPortapapeles(sqlRotacion);

if (enPortapapeles) {
    console.log('  1. Contraseña nueva generada. La orden SQL que la setea quedo');
    console.log('     COPIADA AL PORTAPAPELES (la contraseña viaja adentro, no se muestra).');
} else {
    console.log('  1. No se pudo copiar al portapapeles. Copia a mano esta orden SQL:');
    console.log('\n' + sqlRotacion + '\n');
    console.log('     ⚠ La contraseña quedo impresa aca arriba: CERRA ESTA TERMINAL');
    console.log('       al terminar, asi no queda en el historial de la consola.');
}

console.log('\n  2. Se abre el SQL Editor de Supabase. Ahi:');
console.log('     - clic en el area de texto grande y PEGAR (Ctrl+V)');
console.log('     - boton "Run" (o Ctrl+Enter)');
console.log(`     - tiene que responder UNA fila con "${USUARIO}". Si dice`);
console.log('       "Success. No rows returned", el email no matcheo: avisale a Claude.\n');
abrirNavegador(URL_SQL_EDITOR);

await esperarEnter('  3. Cuando el Run haya devuelto esa fila, apreta ENTER para seguir... ');

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
    console.error('\n✗ El backup fallo. COMO LEER ESTO:');
    console.error('  - Si arriba dice "auth OK": la contraseña quedo BIEN (no repitas nada);');
    console.error('    fallo otra cosa del backup. Avisale a Claude con el mensaje de arriba.');
    console.error('  - Si dice "no se pudo autenticar": el Run del SQL Editor no se hizo o');
    console.error('    fallo. Corre este script de nuevo y repeti los pasos.');
    process.exit(1);
}

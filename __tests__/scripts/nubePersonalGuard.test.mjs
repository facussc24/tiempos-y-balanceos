/**
 * nube-personal-guard — los dos sentidos.
 *
 * Regla dura de Fak, 01/10/2026: "no quiero nada en mi nube personal... solo laburamos en la nube
 * de ingenieria... dejalo bien anotado como regla dura, no podemos volver a fallar".
 * Los ROJOS son lo que ya paso (30/09: quise pasar una carpeta a su OneDrive personal; 01/10: subi
 * 277 archivos ahi sin que lo pidiera). Los VERDES son el trabajo de todos los dias, que no se
 * puede frenar: guardar en la biblioteca de Ingenieria, leer de la personal, sacar cosas de ahi y
 * el Escritorio (Windows lo guarda adentro de la nube personal).
 *
 * Regla: .claude/rules/nube-ingenieria.md
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GUARDIANES, matriz, escribeEnNubePersonal } from '../../scripts/_lib/guardianes.mjs';

const PERSONAL = 'C:\\Users\\Alguien\\OneDrive - BARACK ARGENTINA SRL';
const PERSONAL_POSIX = '/c/Users/Alguien/OneDrive - BARACK ARGENTINA SRL';
const INGENIERIA = 'C:\\Users\\Alguien\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\INGENIERIA BARACK (NUNCA BORRAR)\\1- GENERAL';

/** ctx minimo, con la forma que arma parsear() cuando el JSON del hook se leyo bien. */
const ctx = (tool, { cmd = '', file = '' } = {}) => ({
    ok: true, tool, toolL: tool.toLowerCase(), cmd, cmd6: cmd, file, fileL: file, body6: '', raw: '', cwd: '',
    rescate: { tool: tool.toLowerCase(), cmd, file, content: '' },
});
const correr = (c, env = { HOME: os.tmpdir() }) => GUARDIANES['nube-personal-guard'](c, { env });
const bloquea = (c) => correr(c)?.tipo === 'bloqueo';

const ROJOS = [
    ['Write de un archivo nuevo en la nube personal', ctx('Write', { file: `${PERSONAL}\\Simulador\\index.html` })],
    ['Edit de un archivo de la nube personal', ctx('Edit', { file: `${PERSONAL}\\Barack-cerebro\\claude-memoria\\x.md` })],
    ['cp hacia la nube personal', ctx('Bash', { cmd: `cp -r /c/Dev/juego "${PERSONAL_POSIX}/Juego"` })],
    ['mover una carpeta de Ingenieria a la personal (el caso del 30/09)', ctx('Bash', { cmd: `mv "${INGENIERIA}\\VARIOS\\juego" "${PERSONAL}\\juego"` })],
    ['Copy-Item hacia la nube personal', ctx('PowerShell', { cmd: `Copy-Item C:\\Dev\\x.zip "${PERSONAL}\\x.zip"` })],
    ['robocopy hacia la nube personal', ctx('Bash', { cmd: `robocopy C:\\Dev\\x "${PERSONAL}\\Barack-cerebro\\x" /E` })],
    ['crear una carpeta en la nube personal', ctx('Bash', { cmd: `mkdir -p "${PERSONAL_POSIX}/Proyecto nuevo"` })],
    ['redirigir una salida a la nube personal', ctx('Bash', { cmd: `node scripts/x.mjs > "${PERSONAL_POSIX}/salida.txt"` })],
];

const VERDES = [
    ['Write en la biblioteca de Ingenieria', ctx('Write', { file: `${INGENIERIA}\\AMFE\\DATOS\\x.json` })],
    ['cp hacia la biblioteca de Ingenieria', ctx('Bash', { cmd: `cp x.pdf "${INGENIERIA}\\FLUJOGRAMA\\x.pdf"` })],
    ['leer de la nube personal', ctx('Bash', { cmd: `ls "${PERSONAL_POSIX}" && cat "${PERSONAL_POSIX}/Barack-cerebro/sync.json"` })],
    ['SACAR algo de la personal hacia Ingenieria', ctx('Bash', { cmd: `mv "${PERSONAL}\\Barack-cerebro" "${INGENIERIA}\\x"` })],
    ['copiar de la personal al repo', ctx('Bash', { cmd: `cp "${PERSONAL_POSIX}/Barack-cerebro/a.md" /c/Dev/BarackMercosul/tmp/a.md` })],
    ['crear una carpeta en Ingenieria y despues copiar DESDE la personal', ctx('Bash', { cmd: `mkdir -p "${INGENIERIA}\\x" && cp "${PERSONAL}\\a.pdf" "${INGENIERIA}\\x\\a.pdf"` })],
    ['el Escritorio (Windows lo guarda en la nube personal): la cola de tareas sigue andando', ctx('Write', { file: `${PERSONAL}\\Desktop\\Tarea X\\borrador.md` })],
    ['copiar un rastro a la carpeta de la tarea, en el Escritorio', ctx('Bash', { cmd: `cp pedido.msg "${PERSONAL}\\Desktop\\Tarea X\\pedido.msg"` })],
    ['un comando que no nombra ninguna nube', ctx('Bash', { cmd: 'npm run build && git status' })],
    ['un commit que la nombra en el mensaje', ctx('Bash', { cmd: 'git commit -m "regla: nada va a OneDrive - BARACK ARGENTINA SRL"' })],
    ['Write en el repo', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\scripts\\x.mjs' })],
];

describe('nube-personal-guard', () => {
    it.each(ROJOS)('ROJO: %s', (_que, c) => { expect(bloquea(c)).toBe(true); });
    it.each(VERDES)('VERDE: %s', (_que, c) => { expect(correr(c)).toBe(null); });

    it('el bloqueo dice a donde iba y cual es la nube que corresponde', () => {
        const r = correr(ctx('Write', { file: `${PERSONAL}\\x\\y.pdf` }));
        expect(r.texto).toContain('nube PERSONAL');
        expect(r.texto).toContain(`${PERSONAL}\\x\\y.pdf`);
        expect(r.texto).toContain('Ingenieria y Proyecto - General');
        expect(r.texto).toContain('nube-ingenieria.md');
    });

    it('con el OK de Fak (marca de un uso) pasa UNA vez y vuelve a quedar armado', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'np-ok-'));
        try {
            fs.mkdirSync(path.join(home, '.claude'));
            fs.writeFileSync(path.join(home, '.claude', '.nube-personal-ok'), '');
            const c = () => ctx('Write', { file: `${PERSONAL}\\x.pdf` });
            const env = { HOME: home, USERPROFILE: home };
            expect(correr(c(), env)?.tipo).toBe('aviso');
            expect(correr(c(), env)?.tipo).toBe('bloqueo');
        } finally { fs.rmSync(home, { recursive: true, force: true }); }
    });

    it('corre con las cuatro herramientas (esta en la matriz)', () => {
        for (const t of ['Bash', 'PowerShell', 'Write', 'Edit']) expect(matriz(t)).toContain('nube-personal-guard');
    });

    it('escribeEnNubePersonal devuelve el DESTINO, no el origen', () => {
        expect(escribeEnNubePersonal(`cp a.txt "${PERSONAL}\\b.txt"`)).toBe(`${PERSONAL}\\b.txt`);
        expect(escribeEnNubePersonal(`cp "${PERSONAL}\\b.txt" a.txt`)).toBe('');
    });
});

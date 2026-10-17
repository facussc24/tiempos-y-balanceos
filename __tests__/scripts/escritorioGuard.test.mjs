/**
 * Tests del hook `escritorio-guard.sh` — que BLOQUEE de verdad.
 *
 * Los payloads se arman con JSON.stringify a proposito: escribirlos a mano en una string
 * de shell colapsa los backslashes de Windows y el hook termina cayendo en su rama de
 * fallback, con lo cual el test pasa por el motivo equivocado. (Paso al escribir esto.)
 *
 * exit 2 = bloqueado · exit 0 = permitido.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { esperados } from './guardianesRonda3.mjs';

const HOOK = path.resolve(process.cwd(), '.claude/hooks/escritorio-guard.sh');
const ESC = 'C:\\Users\\facun\\OneDrive\\Escritorio';
const BIB = 'C:\\Users\\facun\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - INGENIERIA BARACK (NUNCA BORRAR)';
const ARCH = `${BIB}\\1- GENERAL\\TAREAS CERRADAS`;
// Cooldown propio: si el test usara el de ~/.claude compartiria archivo con el guard vivo de
// la sesion, y el test del recordatorio pasaria a depender de si Claude toco el Escritorio en
// la ultima hora. Da rojo sin motivo — y a veces verde por el motivo equivocado.
const FLAGDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'escritorio-guard-'));
const FLAG = path.join(FLAGDIR, 'escritorio-guard.flag');

/** Corre el hook con el cooldown ya consumido, para aislar los bloqueos duros del recordatorio. */
function correr(toolInput, { conCooldown = true } = {}) {
    if (conCooldown) {
        fs.writeFileSync(FLAG, String(Math.floor(Date.now() / 1000)));
    } else if (fs.existsSync(FLAG)) {
        fs.rmSync(FLAG);
    }
    const r = spawnSync('bash', [HOOK], {
        input: JSON.stringify(toolInput),
        encoding: 'utf8',
        env: { ...process.env, ESCRITORIO_GUARD_FLAGDIR: FLAGDIR },
    });
    return { code: r.status, err: r.stderr ?? '', out: r.stdout ?? '' };
}

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });
const escribir = (file_path) => ({ tool_name: 'Write', tool_input: { file_path, content: 'x' } });

describe('escritorio-guard — borrar', () => {
    it('1. bloquea rm en el Escritorio', () => {
        const r = correr(bash(`rm -rf "${ESC}\\Insert"`));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/NADA SE BORRA NUNCA/);
    });
    it('2. bloquea Remove-Item en _TERMINADAS', () => {
        expect(correr(bash(`Remove-Item -Recurse "${ESC}\\_TERMINADAS 2026\\x"`)).code).toBe(2);
    });
    it('3. bloquea shutil.rmtree apuntando al Escritorio', () => {
        expect(correr(bash(`python -c "import shutil; shutil.rmtree(r'${ESC}\\x')"`)).code).toBe(2);
    });
    it('4. NO bloquea un rm fuera del Escritorio', () => {
        expect(correr(bash('rm -rf node_modules/.vite')).code).toBe(0);
    });
    it('4b. "del Escritorio" en prosa NO es un borrado — `del` es alias de Remove-Item y a la vez preposicion', () => {
        const msg = 'git commit -m "docs: la sintesis va antes de tocar cosas del Escritorio (OneDrive, Y:)"';
        expect(correr(bash(msg), { conCooldown: false }).code).toBe(0);
    });
    it('4c. bloquea borrar en la biblioteca de Ingenieria, que dice NUNCA BORRAR', () => {
        const r = correr(bash(`rm -rf "${BIB}\\1- GENERAL\\FICHAS DE EMBALAJE\\x.xlsx"`));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/NUNCA BORRAR/);
    });
    it('4d. un mensaje de commit con "del" Y una ruta real citada tampoco es un borrado', () => {
        // Con cooldown puesto a proposito: aisla la rama de borrado del recordatorio 1x/h,
        // que SI se dispara con este comando (toca la zona) y daria un falso rojo.
        const msg = `git commit -m "feat: el rastro va a 1- GENERAL\\TAREAS CERRADAS; antes salia del Escritorio"`;
        expect(correr(bash(msg)).code).toBe(0);
    });
    it('4e. pero `del`/`rd` de verdad (alias CMD, con o sin flags) SI se bloquean', () => {
        expect(correr(bash(`del "${ARCH}\\2026\\x"`)).code).toBe(2);
        expect(correr(bash(`rd /s /q "${ARCH}\\2026"`)).code).toBe(2);
        expect(correr(bash(`del /f /q "${ARCH}\\2026\\x"`)).code).toBe(2);
    });
});

describe('escritorio-guard — mover a mano', () => {
    it('5. bloquea mv hacia TAREAS CERRADAS', () => {
        const r = correr(bash(`mv "${ESC}\\X" "${ARCH}\\2026\\"`));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/Mover y registrar son UNA operacion/);
    });
    it('6. bloquea Move-Item sacando algo del archivo, y la vieja _TERMINADAS sigue cubierta', () => {
        expect(correr(bash(`Move-Item "${ARCH}\\2026\\X" "${ESC}"`)).code).toBe(2);
        expect(correr(bash(`mv "${ESC}\\_TERMINADAS 2026\\X" "${ARCH}\\2026\\"`)).code).toBe(2);
    });
    it('7. deja pasar el script autorizado, que es la via correcta', () => {
        expect(correr(bash('node scripts/_escritorio.mjs --archivar "X" --cerrada 2026-07-31 --que "a" --donde "b"')).code).toBe(0);
    });
    it('8. mover DENTRO del Escritorio, sin tocar el archivo, no se bloquea', () => {
        expect(correr(bash(`mv "${ESC}\\a.txt" "${ESC}\\Insert\\a.txt"`)).code).toBe(0);
    });

    // Tanda 3, pieza 4 (16/10/2026; si de Fak del 15/10): el archivo y el verbo tienen que estar en el MISMO comando, y un
    // cp que COPIA desde el archivo para leer no es archivar. Casos VERDE = frenos falsos reales del informe de CATA
    // (`casa_guardianes_frenos.md` §3 P3); ROJO = los verdaderos de siempre (5 y 6 de arriba) y sus variantes.
    const T26 = '/c/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingeniería y Proyecto - General/INGENIERIA BARACK (NUNCA BORRAR)/1- GENERAL/TAREAS CERRADAS/2026';
    const SCR = 'C:/Users/FACUND~1/AppData/Local/Temp/claude/C--Dev-BarackMercosul/b3209884-a3dc-4d60-9cec-41e14f639b1b/scratchpad';
    it('8b. VERDE — el cp y el archivo en pedazos distintos del comando (02/10 13:03)', () => {
        expect(correr(bash(`cp /c/tmp/RELACIONES.TXT .arb-cache/RELACIONES_20261002.TXT && LEO="${T26}/2026-07-31 - Modificacion arb por Leo"; ls "$LEO" 2>/dev/null | head; python scripts/_arbSustituir.py --tabla x.csv`)).code).toBe(0);
    });
    it('8c. VERDE — copiar DESDE el archivo hacia el scratchpad, para leer (02/10 15:35 y 14/10 17:45)', () => {
        expect(correr(bash(`cd "$TEMP/claude/C--Dev-BarackMercosul/5dcc2c5c/scratchpad" && mkdir -p evip && cp "${T26}/2026-07-31 - Modificacion arb por Leo/Modificaciones BOM ARB_20260731.pdf" evip/leo.pdf 2>/dev/null; ls evip`)).code).toBe(0);
        expect(correr(bash(`S="${SCR}"; T="${T26}"; cp "$T/2026-08-13 - PLANTILLA LASER INSERTO DEL R2/PLANTILLA.dxf" "$T/2026-08-13 - PLANTILLA LASER  INSERTO TRASERO R2/PLANTILLA.dxf" "$S/src/"; ls "$T/2026-08-13 - PLANTILLA LASER INSERTO DEL R2/"`)).code).toBe(0);
    });
    it('8d. ROJO — copiar HACIA el archivo, mover desde o hacia (tambien con variables), y el codigo pegado que mueve', () => {
        for (const c of [
            `cp "${SCR}/x.pdf" "${T26}/2026-10-16 - Tarea/"`,
            `T="${T26}"; cp a.pdf "$T/2026-10-16 - Tarea/"`,
            `T="${T26}"; mv "$T/2026-07-31 - Modificacion arb por Leo" "${ESC}\\Leo"`,
            `robocopy "${ESC}\\Tarea" "${T26}/2026-10-16 - Tarea" /E`,
            `python -c "import shutil; shutil.move(r'${ESC}\\Tarea', r'${ARCH}\\2026\\2026-10-16 - Tarea')"`,
            // auditor Opus 17/10 (TRUE BUG 1): con un cd adelante, por find -exec y por xargs
            `cd "${T26}" && mv "/c/Users/FacundoS-PC/OneDrive - BARACK ARGENTINA SRL/Desktop/2026-10-01 - Tarea" .`,
            `find "/c/Users/FacundoS-PC/OneDrive - BARACK ARGENTINA SRL/Desktop" -maxdepth 1 -name "2026-10-01*" -exec mv {} "${T26}/" \\;`,
            `ls -d "/c/Users/FacundoS-PC/OneDrive - BARACK ARGENTINA SRL/Desktop/2026-10-01"* | xargs -I{} mv {} "${T26}/"`,
        ]) {
            const r = correr(bash(c));
            expect(r.code, c).toBe(2);
            expect(r.err, c).toMatch(/Mover y registrar son UNA operacion/);
        }
    }, 60_000);
    // Ronda 2 (17/10, hallazgo 7): el archivo en una variable de $(cygpath …) o de un for, --target-directory= y cp -rt
    it('8e. ROJO (ronda 2) — el archivo de cerradas en una variable que no se resuelve, o como destino explicito', () => {
        const T26w = `C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\INGENIERIA BARACK (NUNCA BORRAR)\\1- GENERAL\\TAREAS CERRADAS\\2026`;
        const D = '/c/Users/FacundoS-PC/OneDrive - BARACK ARGENTINA SRL/Desktop';
        for (const c of [
            `ARCH="$(cygpath -u '${T26w}')"; mv "${D}/Tarea" "$ARCH/2026-10-17 - Tarea"`,
            `for d in "${T26}"; do mv "${D}/Tarea" "$d/"; done`,
            `cp --target-directory="${T26}" "${D}/x.pdf"`,
            `cp -rt "${T26}" "${D}/Tarea"`,
        ]) {
            const r = correr(bash(c));
            expect(r.code, c).toBe(2);
            expect(r.err, c).toMatch(/Mover y registrar son UNA operacion/);
        }
    }, 60_000);
});

describe('escritorio-guard — escrituras', () => {
    it('9. bloquea tocar el listado de tareas cerradas a mano', () => {
        const r = correr(escribir(`${ARCH}\\2026\\LISTADO DE TAREAS CERRADAS 2026.xlsx`));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/no se toca a mano/);
    });
    it('10. bloquea el LEEME suelto en una carpeta de Fak (incidente 2026-07-24)', () => {
        const r = correr(escribir(`${ESC}\\Insert\\LEEME - por que esta aca.txt`));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/archivo auxiliar suelto/);
    });
    it('11. bloquea README.md y NOTAS.txt igual', () => {
        expect(correr(escribir(`${ESC}\\Insert\\README.md`)).code).toBe(2);
        expect(correr(escribir(`${ESC}\\Insert\\notas.txt`)).code).toBe(2);
    });
    it('12. bloquea GENERAR el entregable dentro del Escritorio (regla escritorio-tareas.md §1b, 2026-08-28)', () => {
        // El Escritorio guarda el RASTRO; el producto se escribe DIRECTO en su carpeta por tipo.
        const r = correr(escribir(`${ESC}\\Insert\\Consumos SMRC.xlsx`));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/GENERANDO un entregable adentro del Escritorio/);
    });
    it('12b. el mismo entregable en su carpeta por tipo de la biblioteca SI pasa', () => {
        expect(correr(escribir(`${BIB}\\2. CONSUMO DE MATERIAL BOM\\Consumos SMRC.xlsx`)).code).toBe(0);
    });
    it('13. no se mete con archivos del repo', () => {
        expect(correr(escribir('C:\\Dev\\BarackMercosul\\README.md')).code).toBe(0);
    });
});

describe('escritorio-guard — recordatorio', () => {
    beforeEach(() => { if (fs.existsSync(FLAG)) fs.rmSync(FLAG); });
    // Cambio deliberado 05/09/2026 (Ola 2): el recordatorio ya NO bloquea. Sale como
    // additionalContext (JSON en stdout) con exit 0, y el cooldown de 1 h sigue igual.
    it('14. sin cooldown recuerda el procedimiento al tocar el Escritorio, y despues calla', () => {
        const primero = correr(bash(`ls "${ESC}"`), { conCooldown: false });
        expect(primero.code).toBe(0);
        expect(primero.err).toBe('');
        const ctx = JSON.parse(primero.out).hookSpecificOutput;
        expect(ctx.hookEventName).toBe('PreToolUse');
        expect(ctx.additionalContext).toMatch(/CERRADA = la ultima accion/);
        const segundo = correr(bash(`ls "${ESC}"`));
        expect(segundo.code).toBe(0);
        expect(segundo.out).toBe('');
    });
    it('15. un comando que no toca el Escritorio nunca molesta', () => {
        expect(correr(bash('npm run build'), { conCooldown: false }).code).toBe(0);
    });
});

// Ronda 3 (17/10/2026): los casos del auditor a ciegas de la ronda 2, por su id (`guardianesRonda3.mjs`). 2 = frena, 0 = pasa.
describe('ronda 3 — los agujeros del auditor a ciegas de la ronda 2 (escritorio)', () => {
    const G = 'escritorio-guard';

    it('ROJO (ronda 3, T3) — robocopy desde /tmp hacia el archivo de cerradas: /tmp es el TEMP, no un switch', () => {
        esperados(G, ['X-E11', 'X-E12', 'N-E06']);
    });
    it('ROJO (ronda 3, T4) — mv con --target= abreviado o con -t pegado hacia el archivo de cerradas', () => {
        esperados(G, ['N-E01', 'N-E02', 'H7-E06', 'H7-E07', 'H7-E08', 'H7-V1', 'H7-V2']);
    });
    it('ROJO (ronda 3, T5) — eval, exec -a, timeout -s y env -u adelante del mv o el cp hacia el archivo de cerradas', () => {
        esperados(G, ['N-E03', 'N-E04', 'N-E05', 'N-E07', 'N-E08', 'N-E09']);
    });
});

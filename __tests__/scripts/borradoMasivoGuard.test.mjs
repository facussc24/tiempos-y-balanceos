/**
 * Tests del hook `borrado-masivo-guard.sh` — que BLOQUEE de verdad.
 *
 * Cada caso "bloquea" esta calcado del incidente 2026-08-07: un .ps1 para rescatar
 * ~17 archivos CAD que termino moviendo 942 (toda la carpeta REVISAR de Fak) a un
 * arbol de carpetas fantasma, aplanando 242 subcarpetas.
 *
 * Los payloads van con JSON.stringify a proposito: a mano en una string de shell los
 * backslashes de Windows se colapsan y el hook cae en su rama de fallback — el test
 * pasaria por el motivo equivocado.
 *
 * OJO con este archivo: contiene los patrones peligrosos como DATO. El guardian tiene
 * una excepcion para rutas de test justamente por eso — sin ella se bloquea a si mismo
 * (paso al escribirlo). Esa excepcion se prueba en el ultimo describe.
 *
 * exit 2 = bloqueado · exit 0 = permitido.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const HOOK = path.resolve(process.cwd(), '.claude/hooks/borrado-masivo-guard.sh');

function correr(toolInput) {
    const r = spawnSync('bash', [HOOK], {
        input: JSON.stringify(toolInput),
        encoding: 'utf8',
    });
    return { code: r.status, err: r.stderr ?? '' };
}

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });
const escribir = (file_path, content) => ({ tool_name: 'Write', tool_input: { file_path, content } });

describe('V1 — -Include ignorado junto a -Recurse (lo que amplio el alcance a 942)', () => {
    it('bloquea el listado del incidente cuando MUEVE lo listado', () => {
        const r = correr(bash(
            "powershell -Command \"Get-ChildItem -LiteralPath 'C:\\x' -Recurse -File -Include *.step,*.dxf | Move-Item -Destination 'C:\\y'\""));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/V1/);
    });

    it('y en un .ps1 que copia y borra lo listado (alias al principio de renglon incluido)', () => {
        const ps1 = "$l = Get-ChildItem -LiteralPath $args[0] -Recurse -File -Include *.step\nforeach ($f in $l) {\n  cp $f.FullName $args[1]\n}\n";
        expect(correr(escribir('C:\\tmp\\rescatar.ps1', ps1)).err).toMatch(/V1/);
    });

    it('22/09/2026: el mismo listado de SOLO LECTURA pasa (no mueve ni borra nada)', () => {
        expect(correr(bash(
            "powershell -Command \"Get-ChildItem -LiteralPath 'C:\\x' -Recurse -File -Include *.step,*.dxf | Select-Object FullName\"")).code).toBe(0);
        // "fuera del telefono" adentro de un echo no es el alias `del` (4af94165, 07/09)
        expect(correr(bash(
            "echo \"videos fuera del telefono\"; powershell -Command \"Get-ChildItem -Path C:\\Dev -Recurse -Include *.MOV | Format-Table\"")).code).toBe(0);
    });

    it('permite -Recurse con -Filter (la forma correcta)', () => {
        expect(correr(bash(
            "powershell -Command \"Get-ChildItem -LiteralPath 'C:\\x' -Recurse -Filter *.step\"")).code).toBe(0);
    });

    it('permite -Include cuando el Path termina en \\* (ahi si funciona)', () => {
        expect(correr(bash(
            "powershell -Command \"Get-ChildItem -Path 'C:\\x\\*' -Recurse -Include *.step\"")).code).toBe(0);
    });

    it('permite -Include sin -Recurse', () => {
        expect(correr(bash(
            "powershell -Command \"Get-ChildItem -LiteralPath 'C:\\x' -Include *.step\"")).code).toBe(0);
    });
});

describe('V2 — .ps1 con acentos (lo que creo el arbol de carpetas fantasma)', () => {
    it('bloquea un .ps1 con una ruta acentuada, que es como nacio el fantasma', () => {
        const r = correr(escribir('C:\\tmp\\mover.ps1',
            "$BIB = 'C:\\Users\\x\\Ingeniería y Proyecto - General'\nGet-Item $BIB\n"));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/V2/);
    });

    it('permite un .ps1 en ASCII puro', () => {
        expect(correr(escribir('C:\\tmp\\ok.ps1',
            '$p = $args[0]\nGet-Item -LiteralPath $p\n')).code).toBe(0);
    });

    it('no se mete con acentos fuera de un .ps1', () => {
        expect(correr(escribir('C:\\tmp\\notas.md', 'Ingeniería y Proyecto')).code).toBe(0);
    });
});

describe('V3 — borrado permanente en vez de Papelera', () => {
    it('bloquea Remove-Item -Force', () => {
        const r = correr(bash("powershell -Command \"Remove-Item -LiteralPath 'C:\\x' -Force\""));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/V3/);
    });

    it('bloquea Remove-Item -Recurse', () => {
        expect(correr(bash("powershell -Command \"Remove-Item 'C:\\x' -Recurse\"")).code).toBe(2);
    });

    // Ojo con la ruta del caso: desde la auditoria del 07/08, `/tmp` y el scratchpad estan
    // EXCLUIDOS a proposito (son efimeros). Para probar el bloqueo hay que apuntar a algo
    // real. Este test usaba /c/tmp/x y quedo verde-por-el-motivo-equivocado hasta el fix.
    it('bloquea el borrado recursivo forzado de shell sobre una ruta real', () => {
        expect(correr(bash(['rm', '-rf', '/c/Dev/BarackMercosul/modules/x'].join(' '))).code).toBe(2);
    });

    it('bloquea shutil.rmtree', () => {
        expect(correr(bash('python -c "import shutil; shutil.rmtree(d)"')).code).toBe(2);
    });

    it('permite el envio a Papelera, que es la salida recomendada', () => {
        expect(correr(bash(
            "powershell -Command \"[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin')\"")).code).toBe(0);
    });
});

describe('V4 — script que borra/mueve en lote sin dry-run', () => {
    const loteDestructivo = [
        'Get-ChildItem -Path $R -Recurse | ForEach-Object {',
        '  Copy-Item -LiteralPath $_.FullName -Destination $D',
        '  Remove-Item -LiteralPath $_.FullName',
        '}',
    ].join('\n');

    it('bloquea el patron del incidente: recorrer + copiar + borrar, sin dry-run', () => {
        const r = correr(escribir('C:\\tmp\\rescatar.ps1', loteDestructivo));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/V4/);
    });

    it('permite el mismo script si tiene dry-run', () => {
        const conDryRun = 'param([switch]$DryRun)\n' + loteDestructivo;
        expect(correr(escribir('C:\\tmp\\rescatar.ps1', conDryRun)).code).toBe(0);
    });

    it('permite -WhatIf, que es el dry-run nativo de PowerShell', () => {
        const conWhatIf = loteDestructivo.replace(
            'Remove-Item -LiteralPath $_.FullName',
            'Remove-Item -LiteralPath $_.FullName -WhatIf');
        expect(correr(escribir('C:\\tmp\\rescatar.ps1', conWhatIf)).code).toBe(0);
    });

    it('no molesta a un movimiento suelto, sin bucle', () => {
        expect(correr(escribir('C:\\tmp\\uno.sh', 'mv "$1" "$2"\n')).code).toBe(0);
    });
});

describe('no molesta al trabajo normal', () => {
    it('permite leer y listar', () => {
        expect(correr(bash('ls -la /c/tmp && find /c/tmp -type f | wc -l')).code).toBe(0);
    });

    it('permite git', () => {
        expect(correr(bash('git add docs/x.md && git commit -m "x"')).code).toBe(0);
    });

    it('permite escribir un .md cualquiera', () => {
        expect(correr(escribir('C:\\tmp\\a.md', '# hola\ncontenido')).code).toBe(0);
    });

    it('permite el script del repo, que ya trae dry-run', () => {
        expect(correr(bash('node scripts/_escritorio.mjs --archivar "X" --dry-run')).code).toBe(0);
    });
});

describe('correcciones que salieron de la auditoria de cierre (07/08)', () => {
    it('V4 agarra el bucle NATIVO de Python — el mismo incidente en otro lenguaje', () => {
        const py = [
            'import os, shutil',
            'for f in os.listdir(origen):',
            '    shutil.move(os.path.join(origen, f), destino)',
        ].join('\n');
        const r = correr(escribir('C:\\tmp\\mover.py', py));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/V4/);
    });

    it('V4 sigue permitiendo el mismo .py con dry-run', () => {
        const py = [
            'import os, shutil',
            'DRY_RUN = True',
            'for f in os.listdir(origen):',
            '    shutil.move(os.path.join(origen, f), destino)',
        ].join('\n');
        expect(correr(escribir('C:\\tmp\\mover.py', py)).code).toBe(0);
    });

    it('V3 NO bloquea git rm: lo borrado sigue en el historial', () => {
        expect(correr(bash('git rm -rf modules/oldFeature/')).code).toBe(0);
    });

    it('V3 NO bloquea limpiar el scratchpad ni carpetas temporales', () => {
        expect(correr(bash('rm -rf /c/Users/x/AppData/Local/Temp/claude/scratchpad/w')).code).toBe(0);
        expect(correr(bash('rm -rf node_modules && npm ci')).code).toBe(0);
    });

    it('pero SIGUE bloqueando el borrado recursivo en una carpeta de Fak', () => {
        const r = correr(bash('rm -rf "C:/Users/FacundoS-PC/OneDrive - BARACK ARGENTINA SRL/Desktop/REVISAR"'));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/V3/);
    });
});

describe('la excepcion de test/guardianes — sin ella el hook se bloquea a si mismo', () => {
    it('deja escribir un archivo de test que CITA los patrones', () => {
        expect(correr(escribir(
            'C:\\Dev\\BarackMercosul\\__tests__\\scripts\\x.test.mjs',
            'Remove-Item -Force ; shutil.rmtree(d)')).code).toBe(0);
    });

    it('deja editar el propio guardian, que los cita en su mensaje de ayuda', () => {
        expect(correr(escribir(
            'C:\\Dev\\BarackMercosul\\.claude\\hooks\\borrado-masivo-guard.sh',
            'echo "Remove-Item -Force"')).code).toBe(0);
    });

    it('pero un .ps1 de verdad con el mismo contenido SI se bloquea', () => {
        expect(correr(escribir('C:\\tmp\\real.ps1', 'Remove-Item -Force $p')).code).toBe(2);
    });

    // 06/09/2026 — la politica administrada de Claude Barack PROHIBE esos comandos en las PCs
    // de la empresa, y para eso tiene que citarlos en `permissions.deny`.
    it('deja escribir la politica administrada de Claude Code, que cita los patrones para PROHIBIRLOS', () => {
        expect(correr(escribir(
            'C:\\Dev\\barack-claude\\politica\\managed-settings.base.json',
            '{"permissions":{"deny":["Bash(rm -rf*)","Bash(Remove-Item*-Recurse*)"]}}')).code).toBe(0);
        expect(correr(escribir(
            'C:\\Program Files\\ClaudeCode\\managed-settings.json',
            '{"permissions":{"deny":["Bash(rm -rf*)"]}}')).code).toBe(0);
    });

    it('pero un .json cualquiera con el mismo contenido SI se bloquea', () => {
        const r = correr(escribir('C:\\tmp\\config.json', '{"cmd":"Remove-Item -Recurse -Force $p"}'));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/V3/);
    });

    // Hallazgo del auditor 06/09: la excepcion tiene que estar anclada al INICIO del nombre del
    // archivo. "Contiene la palabra" no alcanza: un prefijo o sufijo arbitrario sigue bloqueado.
    it('y un .json que solo CONTIENE "managed-settings" en el nombre tambien se bloquea', () => {
        for (const p of ['C:\\tmp\\managed-settings-hack.json', 'C:\\tmp\\evil-managed-settings-x.json', 'C:\\tmp\\managed-settingsX.json']) {
            const r = correr(escribir(p, '{"cmd":"Remove-Item -Recurse -Force $p"}'));
            expect(r.code, p).toBe(2);
            expect(r.err, p).toMatch(/V3/);
        }
    });
});

describe('V5 — git worktree remove con un ENLACE adentro (23/09/2026: se llevo 38 paquetes de node_modules)', () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-v5-'));
    const destino = path.join(TMP, 'instalacion');
    const conEnlace = path.join(TMP, 'wt-con-enlace');
    const sinEnlace = path.join(TMP, 'wt-sin-enlace');
    fs.mkdirSync(destino);
    fs.writeFileSync(path.join(destino, 'paquete.txt'), 'x');
    fs.mkdirSync(conEnlace);
    fs.mkdirSync(sinEnlace);
    fs.writeFileSync(path.join(sinEnlace, 'package.json'), '{}');
    // 'junction' en Windows (como el worktree real); en Linux node lo crea como symlink comun.
    fs.symlinkSync(destino, path.join(conEnlace, 'node_modules'), 'junction');
    afterAll(() => {
        fs.unlinkSync(path.join(conEnlace, 'node_modules'));
        fs.rmSync(TMP, { recursive: true, force: true });
    });

    it('ROJO — el worktree tiene node_modules enlazado: bloquea y nombra el enlace', () => {
        for (const cmd of [
            `git worktree remove "${conEnlace}"`,
            `git worktree remove --force "${conEnlace}"`,
            `git -C "${TMP}" worktree remove wt-con-enlace`,
        ]) {
            const r = correr(bash(cmd));
            expect(r.code, cmd).toBe(2);
            expect(r.err, cmd).toMatch(/V5/);
            expect(r.err, cmd).toMatch(/node_modules/);
        }
    });
    it('VERDE — sin enlaces adentro, sacar el worktree no se frena', () => {
        expect(correr(bash(`git worktree remove "${sinEnlace}"`)).code).toBe(0);
        expect(correr(bash('git worktree list')).code).toBe(0);
    });
    it('el destino del enlace sigue intacto (el test no borra nada)', () => {
        expect(fs.existsSync(path.join(destino, 'paquete.txt'))).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// P18 (tanda 3 del plan del sistema, 16/10/2026; si de Fak del 09/10). Los casos VERDE son los frenos FALSOS reales
// del informe de CATA (`casa_guardianes_frenos.md` §3 P1, 15/10/2026), recortados a lo que decide; los ROJO, los
// verdaderos del §4 y las variantes que el arreglo NO tiene que dejar pasar. Medido con scripts/_frenosMedir.mjs.
describe('P18 — temporales de mktemp, __pycache__ y scripts que prueban un guardian', () => {
    const RF = ['rm', '-rf'].join(' ');                 // el patron se arma, para que el texto del test no lo repita
    const conCwd = (command, cwd) => ({ tool_name: 'Bash', tool_input: { command }, cwd });
    const SCRATCH = 'C:\\Users\\FACUND~1\\AppData\\Local\\Temp\\claude\\C--Dev-BarackMercosul\\4dde7a6e-01d4-435b-a3f0-d83fef9535bd\\scratchpad';

    it('VERDE — la carpeta que el mismo comando creo con mktemp (30/09 y 11/10)', () => {
        for (const cmd of [
            `file .claude/agents/*.md; T=$(mktemp -d); mkdir -p $T/.claude/agents; cp ~/.claude/agents/*.md $T/.claude/agents/; ${RF} "$T"`,
            `D=$(mktemp -d) && BARACK_MAIL_CACHE="$D/c" PYTHONIOENCODING=utf-8 python __tests__/scripts/mailsBorradoresConsola.py "$D/s"; ${RF} "$D"`,
            `T="$(mktemp -d)"; cd scripts && printf '%s' '{}' | HOME="$T" bash -c "true"; cat "$T/.claude/.permiso-guard.log"; cd .. && ${RF} "$T"`,
        ]) expect(correr(bash(cmd)).code, cmd).toBe(0);
    });
    it('VERDE — __pycache__ (24/09 y 13/10)', () => {
        for (const cmd of [
            `cd C:/Dev/BarackMercosul/.claude/worktrees/confident-swartz-cdafac && ${RF} scripts/_lib/__pycache__ && git status --short`,
            `cd /c/Dev/BarackMercosul/.claude/skills && grep -rl "b9bc6219" impresion-3d-bambu | wc -l; ${RF} impresion-3d-bambu/scripts/__pycache__`,
        ]) expect(correr(bash(cmd)).code, cmd).toBe(0);
    });
    it('VERDE — un borrado comun al lado no hace frenar el de tmp/ del repo (01/10, con la carpeta de la sesion)', () => {
        const cmd = `node scripts/_tmp_ut_gemelo.mjs >/dev/null 2>&1; rm -f scripts/_tmp_ut_gemelo.mjs; ${RF} tmp/uppertrim_gemelo`;
        expect(correr(conCwd(cmd, 'C:\\Dev\\BarackMercosul')).code).toBe(0);
    });
    it('VERDE — un node -e que le pasa casos de TEXTO a un guardian (06/10)', () => {
        const cmd = `cd /c/Dev/barack-claude-outlook && node -e "import('file:///C:/Dev/barack-claude-outlook/plugins/barack-area/hooks/pc-guard.mjs').then(m=>{ const c=['${RF} Trabajo/viejos/', 'del /q a.txt', 'rm a.txt; echo ok']; for (const x of c) console.log(JSON.stringify(m.nombresDelComando(x)), x); })"`;
        expect(correr(bash(cmd)).code).toBe(0);
    });
    it('VERDE — Write de una sonda de guardianes con los borrados como casos de texto (04/10, sonda_controles.mjs)', () => {
        const body = [
            "const controles = {};",
            "for (const n of ['servidor', 'pc']) controles[n] = await import(pathToFileURL(path.join(plugin, 'hooks', `${n}-guard.mjs`)).href);",
            'const CASOS = [',
            "  ['pc', 'PowerShell', `Remove-Item -Recurse -Force '${U}\\\\Desktop\\\\*'`, 'frenar'],",
            `  ['pc', 'Bash', '${RF} ~/Documents/proyecto', 'frenar'],`,
            '];',
            'for (const [g, h, c] of CASOS) console.log(g, controles[g].evaluar(h, c));',
        ].join('\n');
        expect(correr(escribir('C:\\Dev\\BarackMercosul\\.sgc-cache\\claude-por-area\\examen\\sonda_controles.mjs', body)).code).toBe(0);
    });
    it('VERDE — un script que borra la carpeta que creo en el TEMP (02/10 probarMejora.mjs; 30/09 _partirPlotter.py)', () => {
        const js = [
            "import { spawnSync } from 'node:child_process';",
            "const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probar-mejora-'));",
            'try { for (const cmd of hooks) spawnSync(\'bash\', [\'-c\', cmd]); } finally {',
            '  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* el TEMP se limpia solo */ }',
            '}',
        ].join('\n');
        expect(correr(escribir('C:\\Dev\\BarackMercosul\\scripts\\_lib\\probarMejora.mjs', js)).code).toBe(0);
        const py = "import tempfile, shutil\ntmp = tempfile.mkdtemp(prefix='partir_')\ntry:\n    for k in range(2):\n        pass\nfinally:\n    shutil.rmtree(tmp, ignore_errors=True)\n";
        expect(correr(escribir('C:\\Dev\\BarackMercosul\\scripts\\_partirPlotter.py', py)).code).toBe(0);
    });
    it('VERDE — Write en el scratchpad que solo CITA el patron en una expresion (12/10, hoy28_clasificar.mjs)', () => {
        const body = "const RE = new RegExp('rm +-|Remove-Item|rmtree|rmSync|DeletePermanently', 'i');\nlet n = 0;\nfor (const p of partes) if (RE.test(p)) n++;\nconsole.log(n);\n";
        expect(correr(escribir(`${SCRATCH}\\hoy28_clasificar.mjs`, body)).code).toBe(0);
    });

    it('ROJO — los verdaderos del informe siguen frenando (§4: la biblioteca, otra carpeta de C:/Dev)', () => {
        for (const cmd of [
            `${RF} "/c/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingeniería y Proyecto - General/INGENIERIA BARACK (NUNCA BORRAR)/x"`,
            `${RF} /c/Dev/civ-wt /c/Dev/simulador-civilizaciones`,
        ]) expect(correr(bash(cmd)).code, cmd).toBe(2);
    });
    it('ROJO — mktemp no tapa lo que sale del TEMP: subir con .., una carpeta propia (-p), otra variable', () => {
        for (const cmd of [
            `T=$(mktemp -d); ${RF} "$T/../.."`,
            `T=$(mktemp -d -p /c/Users/FacundoS-PC/Desktop); ${RF} "$T"`,
            `T=$(mktemp -d); X=$(pwd); ${RF} "$X"`,
            `T=$(mktemp -d); ${RF} "$T" /c/Dev/BarackMercosul/exports/x`,
        ]) expect(correr(bash(cmd)).code, cmd).toBe(2);
    });
    it('ROJO — un node -e que BORRA de verdad, o un borrado afuera del codigo pegado, sigue frenando', () => {
        for (const cmd of [
            // (la forma `require('fs').rmSync(` no la ve el patron ni antes de P18: queda anotada como agujero aparte)
            "node -e \"const fs = require('fs'); fs.rmSync('C:/Dev/BarackMercosul/exports', { recursive: true })\"",
            `node -e "import('x/hooks/pc-guard.mjs').then(m => console.log(m.nombresDelComando('${RF} a')))"; ${RF} /c/Dev/otra`,
            `node -e "import('x/hooks/pc-guard.mjs'); require('child_process').execSync('${RF} /c/Dev/otra')"`,
        ]) expect(correr(bash(cmd)).code, cmd).toBe(2);
    });
    it('ROJO (auditor Opus 17/10, TRUE BUG 4) — un script del scratchpad que LANZA el texto por otras vias no es dato', () => {
        for (const [nombre, js] of [
            ['cp.exec', `import cp from 'node:child_process';\nfor (const x of ['${RF} /c/Dev/otra']) cp.exec(x);\n`],
            ['exec renombrado', `import { exec as correr } from 'node:child_process';\nfor (const x of ['${RF} /c/Dev/otra']) correr(x);\n`],
            ['import dinamico', `const cp = await import('node:child_process');\nfor (const x of ['${RF} /c/Dev/otra']) cp.exec(x);\n`],
            ['asyncio', `import asyncio\nfor x in ['${RF} /c/Dev/otra']:\n    asyncio.run(asyncio.create_subprocess_shell(x))\n`],
            // ronda 2, detalle 9
            ['system importado', `from os import system\nfor x in ['${RF} /c/Dev/otra']:\n    system(x)\n`],
            ['import_module', `import importlib\nm = importlib.import_module('o' + 's')\nfor x in ['${RF} /c/Dev/otra']:\n    getattr(m, 'sys' + 'tem')(x)\n`],
        ]) expect(correr(escribir(`${SCRATCH}\\sonda_${nombre.replace(/\s/g, '_')}.${/^(?:asyncio|system importado|import_module)$/.test(nombre) ? 'py' : 'mjs'}`, js)).code, nombre).toBe(2);
    }, 60_000);
    it('ROJO (ronda 2, hallazgo 8) — el nombre de la variable de mkdtemp reasignado, o usado como parametro de un ayudante', () => {
        for (const [f, s] of [
            ['C:\\Dev\\BarackMercosul\\scripts\\_x.py', "import tempfile, shutil\nd = tempfile.mkdtemp()\nshutil.rmtree(d)\nd = r'Y:/INGENIERIA/x'\nshutil.rmtree(d)\n"],
            ['C:\\Dev\\BarackMercosul\\scripts\\_limpiar.py', "import tempfile, shutil\nd = tempfile.mkdtemp()\ndef limpiar(d):\n    shutil.rmtree(d)\nlimpiar(r'Y:/INGENIERIA/x')\n"],
            ['C:\\Dev\\BarackMercosul\\scripts\\_limpiar.mjs', "import fs from 'node:fs';\nconst d = fs.mkdtempSync(path.join(os.tmpdir(), 'x'));\nfunction limpiar(d) { fs.rmSync(d, { recursive: true }); }\nlimpiar('Y:/INGENIERIA/x');\n"],
        ]) expect(correr(escribir(f, s)).code, f).toBe(2);
    }, 60_000);
    it('ROJO — un script con un borrado REAL sigue frenando, este en el scratchpad o en scripts/', { timeout: 60_000 }, () => {
        const real = "import fs from 'node:fs';\nfs.rmSync('C:/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingenieria y Proyecto - General/x', { recursive: true });\n";
        expect(correr(escribir(`${SCRATCH}\\limpiar.mjs`, real)).code).toBe(2);
        const py = "import shutil\nfor d in destinos:\n    shutil.rmtree(d)\n";
        expect(correr(escribir('C:\\Dev\\BarackMercosul\\scripts\\_limpiar.py', py)).code).toBe(2);
        // una sonda que ademas LANZA el texto como comando ya no es dato
        const lanza = `import { execSync } from 'node:child_process';\nconst c = await import('x/pc-guard.mjs');\nfor (const x of ['${RF} /c/Dev/otra']) execSync(x);\n`;
        expect(correr(escribir(`${SCRATCH}\\sonda.mjs`, lanza)).code).toBe(2);
        // mkdtemp afuera del TEMP del sistema, o tempfile con dir=: no es un temporal
        const fuera = "const d = fs.mkdtempSync('C:/Users/FacundoS-PC/Desktop/x-');\nfs.rmSync(d, { recursive: true });\n";
        expect(correr(escribir('C:\\Dev\\BarackMercosul\\scripts\\_x.mjs', fuera)).code).toBe(2);
        const pyDir = "import tempfile, shutil\nd = tempfile.mkdtemp(dir=r'Y:\\\\INGENIERIA')\nshutil.rmtree(d)\n";
        expect(correr(escribir('C:\\Dev\\BarackMercosul\\scripts\\_x.py', pyDir)).code).toBe(2);
    });
});

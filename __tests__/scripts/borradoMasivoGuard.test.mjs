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
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

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
    it('bloquea el comando exacto que fallo', () => {
        const r = correr(bash(
            "powershell -Command \"Get-ChildItem -LiteralPath 'C:\\x' -Recurse -File -Include *.step,*.dxf\""));
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/V1/);
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
});

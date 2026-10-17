/**
 * apqp-cliente-guard — los dos sentidos.
 *
 * Un gate que no puede dar VERDE esta tan roto como el que no puede dar ROJO, asi que cada
 * caso en rojo tiene su gemelo en verde. Los ROJOS son los que ocurrieron de verdad el
 * 21/09/2026 (emiti un flujograma Rev.A en el paquete que va al cliente y escribi en un
 * listado maestro, las dos sin OK de Fak); los VERDES son lo que Fak dejo explicitamente
 * autorizado ese mismo dia.
 *
 * Regla: .claude/rules/autonomy-contract.md §F
 *
 * Vivio un rato en `scripts/_lib/` y eso rompio el CI: vitest levanta cualquier `*.test.mjs`
 * del repo y un archivo sin `describe`/`it` cuenta como archivo en rojo ("No test suite found
 * in file"). Los tests van en `__tests__/`.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUARDIANES, evaluar } from '../../scripts/_lib/guardianes.mjs';

const LEGAJO = 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\PPAP CLIENTES\\REYDEL-SMRC\\APB P21\\P21 SSRT-MY2026 HILO NARANJA\\APQP';
// El paquete del cliente vive adentro de `1. Imput`, junto al resto de lo que mando el
// cliente (Fak, 21/09/2026: "podes dejar todo eso dentro de input, en la carpeta original
// del cliente"). Estuvo un rato en el casillero 31 por decision mia, asi que el gate tiene
// que frenar en las DOS: la carpeta se reconoce por su nombre `PPAP_<part number>_<n>`, no
// por donde este colgada.
const PAQUETE = `${LEGAJO}\\1. Imput\\PPAP_00257327-01-NHZD_328\\05 - Process Flow & Standar Work`;
const PAQUETE_VIEJO = `${LEGAJO}\\31-Aprobacion de piezas de Produccion(PPAP)\\PPAP_00257327-01-NHZD_328\\05 - Process Flow & Standar Work`;
const LISTADO = 'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)\\1. LISTADO DE AMFES\\Listado_Maestro_AMFE.xlsx';

/** ctx minimo, con la forma que arma parsear() cuando el JSON del hook se leyo bien. */
const ctx = (tool, { cmd = '', file = '' } = {}) => ({
    ok: true,
    toolL: tool.toLowerCase(),
    cmd6: cmd,
    fileL: file,
    body6: '',
    raw: '',
    rescate: { tool: tool.toLowerCase(), cmd, file, content: '' },
});

const correr = (c) => GUARDIANES['apqp-cliente-guard'](c, { env: {} });
const bloquea = (c) => {
    const r = correr(c);
    return Boolean(r && r.tipo === 'bloqueo');
};

const ROJOS = [
    ['Write directo adentro del paquete del cliente', ctx('Write', { file: `${PAQUETE}\\FLUJOGRAMA 159.pdf` })],
    ['cp hacia el paquete del cliente', ctx('Bash', { cmd: `cp /c/tmp/f.pdf "${PAQUETE}\\FLUJOGRAMA 159.pdf"` })],
    ['Copy-Item hacia el paquete del cliente', ctx('PowerShell', { cmd: `Copy-Item f.pdf "${PAQUETE}\\f.pdf"` })],
    ['el paquete en su ubicacion vieja tambien se frena', ctx('Bash', { cmd: `cp f.pdf "${PAQUETE_VIEJO}\\f.pdf"` })],
    ['Write directo sobre un listado maestro', ctx('Write', { file: LISTADO })],
    ['script de alta en un listado maestro con --apply', ctx('Bash', { cmd: 'py -3 scripts/_registrarAmfe173.py --apply' })],
    ['el otro script de alta, con --apply', ctx('Bash', { cmd: 'py -3 scripts/_registrarFlujograma159.py --apply' })],
    ['el script de alta despues de un cd (la forma real de correrlo)',
        ctx('Bash', { cmd: 'cd /c/Dev/BarackMercosul && py -3 scripts/_registrarAmfe173.py --apply' })],
];

const VERDES = [
    ['el plano del cliente en su casillero del legajo (autorizado por Fak)',
        ctx('Bash', { cmd: `cp plano.pdf "${LEGAJO}\\6-Planos de la pieza\\RP-00238891.pdf"` })],
    ['MOVER el paquete entero del cliente a 1. Imput (es lo que pidio Fak)',
        ctx('Bash', { cmd: `mv "${LEGAJO}\\31-Aprobacion de piezas de Produccion(PPAP)\\PPAP_00257327-01-NHZD_328" "${LEGAJO}\\1. Imput\\"` })],
    ['el flujograma en el casillero 20 del legajo',
        ctx('Bash', { cmd: `cp f.pdf "${LEGAJO}\\20- Flujograma de proceso\\FLUJOGRAMA 159.pdf"` })],
    ['SACAR un archivo del paquete del cliente',
        ctx('Bash', { cmd: `rm -f "${PAQUETE}\\FLUJOGRAMA 159.pdf"` })],
    ['el mismo script de alta, en DRY-RUN',
        ctx('Bash', { cmd: 'py -3 scripts/_registrarAmfe173.py' })],
    ['LEER el listado maestro',
        ctx('Bash', { cmd: `py -3 -c "from openpyxl import load_workbook; load_workbook(r'${LISTADO}')"` })],
    // Falso positivo real del 21/09/2026: un script que solo ABRIA el listado para verificar
    // la fila cayo en rojo porque su regex incluia `[^>]*` y mas adelante una barra, y el
    // detector de escritura miraba el `>` de redireccion. Bloquear una lectura es peor que no
    // bloquear: el gate termina apagado. El `>` quedo solo para el paquete del cliente.
    ['LEER el listado con un script cuyo texto tiene ">" y barras',
        ctx('Bash', { cmd: `py -3 -c "import re; re.findall(r'Id=([^>]+)Target=', z.read('xl/_rels/workbook.xml.rels'))" ${LISTADO}` })],
    // Tercer falso positivo del mismo dia: nombrar el script de alta como ARGUMENTO de un
    // grep o un ls es leerlo. El ultimo corte fue justo sobre el comando con el que iba a
    // arreglar la fila que el gate cuida.
    ['LEER el script de alta con grep (su texto tiene --apply)',
        ctx('Bash', { cmd: 'grep -n "def \\|--apply" scripts/_registrarAmfe173.py' })],
    ['LISTAR el script de alta',
        ctx('Bash', { cmd: 'ls -la scripts/_registrarAmfe173.py scripts/_registrarFlujograma159.py' })],
    ['listar la carpeta del paquete del cliente',
        ctx('Bash', { cmd: `ls -la "${PAQUETE}"` })],
    ['un Write cualquiera del repo',
        ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\scripts\\_algo.mjs' })],
    ['la propia regla que nombra las carpetas',
        ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\.claude\\rules\\autonomy-contract.md' })],
];

describe('apqp-cliente-guard', () => {
    describe('ROJO — bloquea (exit 2)', () => {
        for (const [titulo, c] of ROJOS) {
            it(titulo, () => expect(bloquea(c)).toBe(true));
        }
    });

    describe('VERDE — deja pasar (exit 0)', () => {
        for (const [titulo, c] of VERDES) {
            it(titulo, () => expect(bloquea(c)).toBe(false));
        }
    });

    it('el mensaje de bloqueo dice CUAL es la ruta y a donde va en su lugar', () => {
        const r = correr(ctx('Write', { file: `${PAQUETE}\\x.pdf` }));
        expect(r.texto).toContain('PAQUETE QUE VA AL CLIENTE');
        expect(r.texto).toContain('PPAP_00257327-01-NHZD_328');
        expect(r.texto).toMatch(/CALIDAD/);
        expect(r.texto).toContain('autonomy-contract.md');
    });

    it('el gate puede dar rojo Y puede dar verde (ninguna de las dos listas quedo vacia)', () => {
        expect(ROJOS.length).toBeGreaterThan(3);
        expect(VERDES.length).toBeGreaterThan(3);
    });

    /**
     * El escape del listado maestro, con su HOME propio para no tocar el del usuario.
     *
     * Existe porque un gate que no se puede pasar ni con autorizacion no se respeta: se
     * esquiva, y ahi deja de existir. Es de UN uso — se consume al pasar — asi que un OK de
     * Fak vale por UNA carga y no queda la puerta abierta.
     */
    it('con el OK de Fak pasa UNA vez, y la segunda vuelve a bloquear', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'apqp-ok-'));
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        const env = { HOME: home };
        const c = () => ctx('Bash', { cmd: 'py -3 scripts/_registrarAmfe173.py --apply' });

        // sin el flag: bloquea
        expect(GUARDIANES['apqp-cliente-guard'](c(), { env })?.tipo).toBe('bloqueo');

        // con el flag: pasa con aviso
        fs.writeFileSync(path.join(home, '.claude', '.apqp-listado-ok'), '');
        expect(GUARDIANES['apqp-cliente-guard'](c(), { env })?.tipo).toBe('aviso');

        // y el flag se consumio: la siguiente vuelve a bloquear
        expect(fs.existsSync(path.join(home, '.claude', '.apqp-listado-ok'))).toBe(false);
        expect(GUARDIANES['apqp-cliente-guard'](c(), { env })?.tipo).toBe('bloqueo');

        fs.rmSync(home, { recursive: true, force: true });
    });

    it('el escape NO abre el paquete del cliente: eso no tiene salida', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'apqp-ok-'));
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(home, '.claude', '.apqp-listado-ok'), '');
        const r = GUARDIANES['apqp-cliente-guard'](ctx('Write', { file: `${PAQUETE}\\x.pdf` }), { env: { HOME: home } });
        expect(r?.tipo).toBe('bloqueo');
        // y no se consumio el flag, porque no es lo que ese flag autoriza
        expect(fs.existsSync(path.join(home, '.claude', '.apqp-listado-ok'))).toBe(true);
        fs.rmSync(home, { recursive: true, force: true });
    });
});

// Por el camino real: el JSON del hook pasa por parsear(), que deja `toolL` con la mayuscula del nombre («Write»).
// Hasta el 11/10/2026 el guardian comparaba con 'write' y la rama de Write/Edit no corria nunca en vivo: los casos de
// arriba pasaban porque arman el contexto a mano, en minuscula.
describe('apqp-cliente-guard por el camino real (evaluar con el JSON del hook)', () => {
    const json = (tool, file) => JSON.stringify({ tool_name: tool, tool_input: { file_path: file, content: 'x', new_string: 'x' }, cwd: 'C:\\Dev\\BarackMercosul', session_id: 'test' });
    const bloqueos = (tool, file, opciones = {}) => evaluar(json(tool, file), { nombres: ['apqp-cliente-guard'], env: { HOME: os.tmpdir() }, marcar: false, ...opciones }).res.bloqueos.length;

    it('ROJO: un Write o un Edit sobre un listado maestro, y adentro del paquete del cliente', () => {
        expect(bloqueos('Write', LISTADO)).toBe(1);
        expect(bloqueos('Edit', LISTADO)).toBe(1);
        expect(bloqueos('Write', `${PAQUETE}\\FLUJOGRAMA 159.pdf`)).toBe(1);
    });

    it('VERDE: un Write cualquiera del repo', () => {
        expect(bloqueos('Write', 'C:\\Dev\\BarackMercosul\\scripts\\_algo.mjs')).toBe(0);
        expect(bloqueos('Edit', 'C:\\Dev\\BarackMercosul\\.claude\\rules\\autonomy-contract.md')).toBe(0);
    });

    it('quien consulta sin ser la sesion de Fak (escapes: false) no usa ni consume el permiso del listado', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'apqp-esc-'));
        const marca = path.join(home, '.claude', '.apqp-listado-ok');
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        fs.writeFileSync(marca, '');
        const env = { HOME: home };
        expect(bloqueos('Write', LISTADO, { env, escapes: false })).toBe(1);
        expect(fs.existsSync(marca)).toBe(true);
        expect(bloqueos('Write', LISTADO, { env })).toBe(0);
        expect(fs.existsSync(marca)).toBe(false);
    });
});

// P13 (tanda 3 del plan del sistema, 16/10/2026; si de Fak del 15/10). Los VERDE son los frenos FALSOS reales del informe
// de CATA (`casa_guardianes_frenos.md` §3 P4), recortados a lo que decide; los ROJO, los verdaderos y las variantes que el
// arreglo no tiene que dejar pasar. Medido con scripts/_frenosMedir.mjs: 8 falsos -> 1 (el que queda escribia de verdad).
describe('P13 — origen o destino: copiar el listado para LEERLO no es escribirlo (Bash)', () => {
    const HO = 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\HOJAS DE OPERACIONES\\3- LISTADO\\Listado hojas de proceso.xlsx';
    const FLUJO = 'Y:/Ingenieria/Documentacion Gestion Ingenieria/8. Flujograma Sinóptico (I-IN-002III)/1. LISTADO DE FLUJOGRAMAS';
    const SCR = 'C:/Users/FACUND~1/AppData/Local/Temp/claude/C--Dev-BarackMercosul/a27eabc3-6f16-4975-8a56-576b60a29524/scratchpad';
    const json = (command, cwd = 'C:\\Dev\\BarackMercosul') => JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd, session_id: 'test' });
    const frena = (command, cwd) => evaluar(json(command, cwd), { nombres: ['apqp-cliente-guard'], env: { HOME: os.tmpdir() }, marcar: false, escapes: false }).res.bloqueos.length === 1;

    it('VERDE — el listado como ORIGEN de un cp hacia el scratchpad, exports o C:\\tmp (24/09, 14/10, 15/10)', () => {
        for (const c of [
            `H="/y/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES"; timeout 60 find "$H/1- CLIENTES/SMRC/P21" -maxdepth 3 | head -40; cp "$H/3- LISTADO/Listado hojas de proceso.xlsx" "${SCR}/listado_ho.xlsx"`,
            `cd /c/tmp/setup && cp "/y/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/3- LISTADO/Listado hojas de proceso.xlsx" listado_ho.xlsx 2>&1 | tail -1; python -X utf8 -c "import openpyxl; wb=openpyxl.load_workbook('listado_ho.xlsx',read_only=True)"`,
            `D="${FLUJO}"; ls -la "$D" | grep -i '~\\$' && exit 1; mkdir -p C:/Dev/BarackMercosul/exports/BEON/listado_respaldo; cp -p "$D/Listado_Maestro_FLUJOGRMAS.xlsx" C:/Dev/BarackMercosul/exports/BEON/listado_respaldo/`,
            `S="$TEMP/claude/C--Dev-BarackMercosul/f14f5aae/scratchpad" && L="Y:/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/3- LISTADO/Listado hojas de proceso.xlsx" && ls -la "$L" && cp "$L" "$S/listado_copia.xlsx"`,
        ]) expect(frena(c), c).toBe(false);
    });
    it('VERDE — abrir el listado con openpyxl desde un python pegado, sin guardarlo (01/10, 13/10)', () => {
        const py = `python - <<'EOF'\nimport openpyxl, shutil, os\nsrc = r"${HO}"\ndst = os.path.join(os.environ['TEMP'],'claude','x','scratchpad','listado_copia.xlsx')\nshutil.copy2(src,dst)\nwb = openpyxl.load_workbook(dst, data_only=True)\nprint(wb.sheetnames)\nEOF`;
        expect(frena(py)).toBe(false);
        // la copia local puede llamarse como un listado (13/10: listado_maestro_ing.xlsx en el scratchpad)
        const py2 = `python - <<'EOF'\nimport os,shutil\ng=r'C:\\x\\LISTADO MAESTRO DE INGENIERIA - I-IN-001 - REV 8.xlsx'\ndst=os.path.join(os.environ['TEMP'],'claude','x','scratchpad','listado_maestro_ing.xlsx')\nshutil.copyfile(g,dst)\nEOF`;
        expect(frena(py2)).toBe(false);
    });

    it('ROJO — copiar HACIA el listado, o el listado a otra carpeta del servidor', () => {
        for (const c of [
            `cp ${SCR}/listado.xlsx "${HO.replace(/\\/g, '/')}"`,
            `cp -p "${FLUJO}/Listado_Maestro_FLUJOGRMAS.xlsx" "Y:/Ingenieria/otra carpeta/"`,
            `robocopy "${SCR}" "Y:/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/3- LISTADO" "Listado hojas de proceso.xlsx"`,
            `D="Y:/x/1. LISTADO DE AMFES"; cp x.xlsx "$D/Listado_Maestro_AMFE.xlsx"`,
        ]) expect(frena(c), c).toBe(true);
        // auditor Opus 17/10 (TRUE BUG 2 y 3): MOVER el listado al TEMP lo saca del servidor; un destino en una variable de $(…)
        for (const c of [
            `mv "${HO.replace(/\\/g, '/')}" "$TEMP/listado.xlsx"`,
            `robocopy "Y:/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/3- LISTADO" C:/tmp "Listado hojas de proceso.xlsx" /MOV`,
            `D="$(cygpath -u "Y:/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/3- LISTADO/Listado hojas de proceso.xlsx")"; cp /c/tmp/nuevo.xlsx "$D"`,
        ]) expect(frena(c), c).toBe(true);
        // 21/09 17:50: la copia de respaldo al LADO del maestro, en el servidor (cd adentro de la carpeta del listado)
        expect(frena('cd "/y/Ingenieria/Documentacion Gestion Ingenieria/13. Analisis/1. LISTADO DE AMFES" && cp "Listado_Maestro_AMFE.xlsx" "Listado_Maestro_AMFE_backup_$(date +%Y%m%d).xlsx"')).toBe(true);
    });
    it('ROJO — el codigo pegado que GUARDA el listado (15/10 13:39: COM con wb.Save(); openpyxl; shutil hacia el listado)', () => {
        const com = `cp -p "${FLUJO}/Listado_Maestro_FLUJOGRMAS.xlsx" C:/Dev/BarackMercosul/exports/x/; cat > "${SCR}/listado157.py" <<'EOF'\nimport win32com.client as win32\nf=r'Y:\\x\\Listado_Maestro_FLUJOGRMAS.xlsx'\nxl=win32.DispatchEx('Excel.Application')\nwb=xl.Workbooks.Open(f, 0, False)\nwb.Worksheets('Listado FLUJOGRAMAS').Range('M62').Value='B'\nwb.Save(); wb.Close(False)\nEOF\npython "${SCR}/listado157.py"`;
        expect(frena(com)).toBe(true);
        expect(frena(`python -c "import openpyxl; L=r'${HO}'; wb=openpyxl.load_workbook(L); wb.save(L)"`)).toBe(true);
        expect(frena(`python - <<'EOF'\nimport shutil\nsrc = r"C:\\tmp\\nuevo.xlsx"\ndst = r"${HO}"\nshutil.copy(src, dst)\nEOF`)).toBe(true);
        expect(frena(`node -e "require('fs').copyFileSync('C:/tmp/n.xlsx', 'Y:/x/Listado_Maestro_AMFE.xlsx')"`)).toBe(true);
    });
    it('ROJO — un script del TEMP corrido por RUTA que guarda el listado (15/10 13:55, listado152.py)', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apqp-p13-'));
        const script = path.join(dir, 'listado152.py');
        fs.writeFileSync(script, "import win32com.client as w\nf=r'Y:\\x\\Listado_Maestro_FLUJOGRMAS.xlsx'\nwb=w.DispatchEx('Excel.Application').Workbooks.Open(f)\nwb.Save()\n");
        const p = script.replace(/\\/g, '/');
        expect(frena(`cp -p "${FLUJO}/Listado_Maestro_FLUJOGRMAS.xlsx" exports/x/antes.xlsx; python "${p}"`)).toBe(true);
        // el mismo script sin guardar: pasa (leer el listado no es escribirlo)
        fs.writeFileSync(script, "import openpyxl\nwb=openpyxl.load_workbook(r'Y:\\x\\Listado_Maestro_FLUJOGRMAS.xlsx', read_only=True)\nprint(wb.sheetnames)\n");
        expect(frena(`python "${p}"`)).toBe(false);
    });
    // Ronda 2 (17/10, hallazgo 2): lo pegado a powershell / pwsh y el heredoc que alimenta a bash se vuelven a mirar
    it('ROJO (ronda 2, hallazgo 2) — Copy-Item / Move-Item / cp adentro de powershell -Command, pwsh -c o un heredoc a bash', () => {
        for (const c of [
            `powershell -NoProfile -Command "Copy-Item C:\\tmp\\n.xlsx '${HO}'"`,
            `pwsh -c "Move-Item C:\\tmp\\n.xlsx '${HO}'"`,
            `bash <<'EOF'\ncp /c/tmp/n.xlsx "${HO.replace(/\\/g, '/')}"\nEOF`,
            `powershell -Command "Move-Item '${HO}' C:\\Dev\\BarackMercosul\\exports\\x.xlsx"`,
        ]) expect(frena(c), c).toBe(true);
        expect(frena(`powershell -NoProfile -Command "Copy-Item '${HO}' C:\\Dev\\BarackMercosul\\exports\\x.xlsx"`)).toBe(false); // copiar para leer
    });
    // Ronda 2 (17/10, hallazgo 3): `/c/tmp` es una ruta, no un switch de robocopy (Git Bash la convierte a C:/tmp)
    it('ROJO (ronda 2, hallazgo 3) — robocopy con el origen escrito /c/… hacia la carpeta del listado', () => {
        const AMFE = 'Ingenieria/Documentacion Gestion Ingenieria/13. Analisis del modo de falla y sus efectos ( I-AC-005.3)/1. LISTADO DE AMFES';
        for (const c of [
            `robocopy /c/tmp "/y/${AMFE}" Listado_Maestro_AMFE.xlsx /Y`,
            `robocopy /c/tmp "Y:\\${AMFE.replace(/\//g, '\\')}" Listado_Maestro_AMFE.xlsx /Y`,
        ]) expect(frena(c), c).toBe(true);
        expect(frena(`robocopy "Y:\\${AMFE.replace(/\//g, '\\')}" /c/tmp Listado_Maestro_AMFE.xlsx /R:1 /W:1`)).toBe(false); // traerlo para leer
    });
    it('ROJO — los _registrar* --apply siguen frenando (los verdaderos del informe)', () => {
        expect(frena('py -3 scripts/_registrarRevFlujograma.py 153 D 01/10/2026 --apply 2>&1 | tail -6')).toBe(true);
        expect(frena('cd /c/Dev/BarackMercosul && python scripts/_registrarUpperTrimListados.py flujograma --apply 2>&1 | tail -20')).toBe(true);
    });
});

// Ronda 3 (17/10/2026): los casos del auditor a ciegas de la ronda 2, por su id, desde `guardianesRonda3.casos.json`
// (las rutas reales, con sus parentesis). 2 = frena, 0 = pasa.
describe('ronda 3 — los agujeros del auditor a ciegas de la ronda 2 (apqp-cliente)', () => {
    const CASOS = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'guardianesRonda3.casos.json'), 'utf8')).casos;
    const r3 = (id) => {
        const c = CASOS.find((x) => x.id === id);
        if (!c) throw new Error(`no esta el caso ${id}`);
        const raw = JSON.stringify({ tool_name: c.tool, tool_input: c.input, session_id: 'ronda3', cwd: 'C:\\Dev\\BarackMercosul' });
        return evaluar(raw, { nombres: ['apqp-cliente-guard'], env: { HOME: os.tmpdir() }, marcar: false, escapes: false }).res.bloqueos.length ? 2 : 0;
    };
    const esperados = (ids) => { for (const id of ids) expect(r3(id), id).toBe(CASOS.find((x) => x.id === id).esperado); };

    it('ROJO (ronda 3, T1) — el .Save() de COM adentro de powershell -Command sobre el listado vuelve a frenar', () => {
        esperados(['N-A08', 'N-A09']);
        esperados(['H2-A03', 'H2-A04', 'H2-A07', 'H2-X04', 'H2-sh', 'H2-V1', 'H2-V2']);   // los de la ronda 2 siguen igual
    });
    it('ROJO (ronda 3, T2) — un parentesis de la ruta REAL del listado (AMFE, flujogramas) ya no corta el destino', () => {
        // shutil.copy, copyFileSync y to_excel encima del listado real; el mismo en flujogramas; el code de una MCP
        esperados(['X-A11', 'X-A12', 'X-A13', 'X-A14', 'X-A15', 'X-A16', 'N-C05', 'X-C08']);
        // VERDE: traer el listado real (con sus parentesis) a una carpeta local para leerlo
        const leer = `python -c "import shutil; shutil.copy(r'${LISTADO}', r'C:\\tmp\\l.xlsx')"`;
        expect(evaluar(JSON.stringify({ tool_name: 'Bash', tool_input: { command: leer }, session_id: 'ronda3', cwd: 'C:\\Dev\\BarackMercosul' }),
            { nombres: ['apqp-cliente-guard'], env: { HOME: os.tmpdir() }, marcar: false, escapes: false }).res.bloqueos.length).toBe(0);
    });
});

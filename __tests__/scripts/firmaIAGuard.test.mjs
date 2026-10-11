/**
 * firma-ia-guard — los dos sentidos.
 *
 * Regla de Fak, 08/10/2026: el listado de hojas de proceso decia "Claude" en la columna CREADO POR
 * de 14 filas (HO 972 a 984 y 118) y tenia una pestaña oculta "_CONTEXTO_CLAUDE" ("CONTEXTO PARA
 * EL PROXIMO CLAUDE"). *"Es un error gravisimo, no puede volver a suceder nunca algo asi... en
 * ningun tipo de documento"* y *"contexto claude tampoco hace falta, nunca mas crear algo asi"*.
 *
 * Los ROJOS son las formas de escribir eso en un documento (la columna, la pestaña, las
 * propiedades, un nombre de archivo en el servidor). Los VERDES son el trabajo de todos los dias
 * que nombra a Claude sin meterlo en un documento: commits, memoria, reglas, el asistente de area,
 * la carpeta de configuracion "Claude Fak", leer y buscar.
 *
 * Regla: .claude/rules/core-prohibiciones.md §9 · detector: scripts/_lib/firmaIA.py
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../../scripts/_lib/guardianes.mjs';

const { GUARDIANES, matriz, firmaIaEnEscritura } = G;
const esSoloLectura = G.esSoloLectura ?? (() => null);   // nace con HOY-16

const LISTADO = 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\HOJAS DE OPERACIONES\\3- LISTADO\\Listado hojas de proceso.xlsx';
const NUBE = 'C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\INGENIERIA BARACK (NUNCA BORRAR)';

const ctx = (tool, { cmd = '', file = '', content = '' } = {}) => ({
    ok: true, tool, toolL: tool.toLowerCase(), cmd, cmd6: cmd, file, fileL: file, content, body6: content, raw: '', cwd: '',
    rescate: { tool: tool.toLowerCase(), cmd, file, content },
});
const bloquea = (c) => GUARDIANES['firma-ia-guard'](c, { env: {} })?.tipo === 'bloqueo';

const ROJOS = [
    ['COM: la columna CREADO POR con Claude (el caso del listado)', ctx('Bash', { cmd: `python -c "ws.Cells(r, 10).Value = 'Claude'"` })],
    ['openpyxl: una celda con Claude', ctx('Bash', { cmd: `python x.py && python -c "ws['J74'] = 'Claude'"` })],
    ['COM: texto para el proximo Claude en una celda', ctx('PowerShell', { cmd: `$ws.Range('A1').Value2 = 'CONTEXTO PARA EL PRÓXIMO CLAUDE'` })],
    ['CREADO POR: IA', ctx('Bash', { cmd: `node scripts/x.mjs --creado-por "IA"` })],
    ['un archivo con Claude en el nombre en el servidor', ctx('Bash', { cmd: `cp notas.txt "Y:/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/3- LISTADO/_CONTEXTO_CLAUDE.txt"` })],
    ['una carpeta con Claude en el nombre en la nube de Ingenieria', ctx('Bash', { cmd: `mkdir -p "${NUBE}\\2- PROYECTOS\\Hecho por Claude"` })],
    ['un Write en el servidor que nombra a Claude', ctx('Write', { file: 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\PPAP CLIENTES\\VW\\nota.txt', content: 'Revisado con Claude el 08/10.' })],
    ['un Write en exports que nombra a ChatGPT', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\exports\\TIEMPOS\\tabla.csv', content: 'op;tiempo;fuente\n10;2:47;ChatGPT' })],
    ['un Write en la nube de Ingenieria que habla de inteligencia artificial', ctx('Write', { file: `${NUBE}\\1- GENERAL\\resumen.md`, content: 'Preparado con inteligencia artificial.' })],
    // HOY-16c (11/10/2026, 5 de 5.339): los cinco que hasta hoy eran Write/Edit de un .py o un .json del repo (ahora en
    // VERDES_HOY16C), en su forma de comando: lo que el script HACE sigue frenando por Bash.
    ['openpyxl: cell(value=Claude), por Bash', ctx('Bash', { cmd: `python -c "ws.cell(row=r, column=10, value='Claude')"` })],
    ['la pestaña oculta para el proximo Claude, por Bash', ctx('Bash', { cmd: `python -c "ctx = wb.create_sheet('_CONTEXTO_CLAUDE'); ctx.sheet_state = 'hidden'"` })],
    ['propiedades del archivo: autor Claude, por Bash', ctx('Bash', { cmd: `python -c "prs.core_properties.author = 'Claude'"` })],
    ['un dato con autor IA, por Bash al JSON del flujograma', ctx('Bash', { cmd: `node -e "d.elaboro = 'Claude'; fs.writeFileSync('tools/flowchart/data/170.json', JSON.stringify(d))"` })],
    ['un parrafo de Word con hecho con Claude, por Bash', ctx('Bash', { cmd: `python -c "doc.add_paragraph('Informe armado con Claude')"` })],
];

const VERDES = [
    ['commit con la firma del repo', ctx('Bash', { cmd: `git commit -m "fix(x): algo\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- a.py` })],
    ['buscar Claude en el listado', ctx('Bash', { cmd: `grep -n "Claude" "${LISTADO}"` })],
    ['correr el detector', ctx('Bash', { cmd: `python scripts/_sinFirmaIA.py "${LISTADO}"` })],
    ['poner CREADO POR = F.Santoro', ctx('Bash', { cmd: `python -c "ws.Cells(r, 10).Value = 'F.Santoro'"` })],
    ['la memoria cuenta el incidente', ctx('Write', { file: 'C:\\Users\\FacundoS-PC\\.claude\\projects\\C--Dev-BarackMercosul\\memory\\feedback_x.md', content: 'El listado decia "Claude" en CREADO POR: author = Claude no va.' })],
    ['una regla cita el caso', ctx('Edit', { file: 'C:\\Dev\\BarackMercosul\\.claude\\rules\\core-prohibiciones.md', content: 'CREADO POR = Claude esta prohibido' })],
    ['las LECCIONES citan el caso', ctx('Edit', { file: 'C:\\Dev\\BarackMercosul\\docs\\LECCIONES_APRENDIDAS.md', content: 'elaboró: Claude' })],
    ['el asistente de area nombra a Claude por diseño', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\tools\\claude-area\\manual\\ventana.ps1', content: `param([string]$Proceso = 'Claude')` })],
    ['grabar la ventana de Claude', ctx('Bash', { cmd: `python tools/claude-area/video/grabar_ventana.py --titulo "Claude" --segundos 30` })],
    ['la carpeta de configuracion Claude Fak en la nube', ctx('Bash', { cmd: `node scripts/_nube.mjs --subir "${NUBE}\\..\\Claude Fak\\memoria"` })],
    ['un script que lee la config de Claude Desktop', ctx('Edit', { file: 'C:\\Dev\\BarackMercosul\\scripts\\_paquete.mjs', content: `const cfg = leerJson(path.join(env.APPDATA, 'Claude', 'claude_desktop_config.json'));` })],
    ['copiar una HO al servidor', ctx('Bash', { cmd: `cp "HO-990 REV.A.pptx" "Y:/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/1- CLIENTES/NOVAX/HO 990 - INSERT/"` })],
    ['la palabra autoria no es autor + IA', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\scripts\\_lib\\amfeAutoria.mjs', content: 'const autoria = revisarAutoria(doc);' })],
    ['un Write de un script del repo que no escribe documentos', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\scripts\\_novedadesClaude.mjs', content: `const FUENTES = ['Claude Devs', 'Lydia Hallie'];` })],
];

// ── HOY-16 (11/10/2026, con el si de Fak del 10/10 23:57: «si a todo... si consideras que son cambios positivos dale
// para adelante», a la pregunta «¿aflojo el guardian de firma para dos casos que hoy frena de mas?») ──────────────
// Dos casos REALES del 10/10 que el guardian frenaba de mas (textuales, en firmaIAGuard.casosReales.json) tienen que
// pasar; y sus GEMELOS tienen que seguir frenando. El criterio es el VERBO (¿el comando escribe?) y el DESTINO
// (¿un documento de Barack o el registro interno de la app?), nunca «si la ruta dice Claude, pasa».
const REALES = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'firmaIAGuard.casosReales.json'), 'utf8'));
const NP = '/c/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingeniería y Proyecto - General';
const INTERNO = '/c/Users/FacundoS-PC/AppData/Roaming/Claude/claude-code-sessions/d762571e/44b7605b';

const VERDES_HOY16 = [
    ['REAL 10/10 12:12: el inventario de solo lectura (echo, for, find, wc, awk, ls, grep) de las carpetas de la nube', ctx('Bash', { cmd: REALES.lectura_1212 })],
    ['REAL 10/10 11:30: el id del modelo en el registro interno de la app (scheduled-tasks.json)', ctx('Bash', { cmd: REALES.registro_interno_1130 })],
    ['una lectura que no EMPIEZA por el verbo de lectura: cd … && find … | wc', ctx('Bash', { cmd: `cd /c/Dev && find "${NP}/Claude Fak" -maxdepth 2 -type f | wc -l` })],
    ['una lectura con una variable adelante', ctx('Bash', { cmd: `n=$(ls "${NP}/Base Claude Ingenieria" | wc -l); echo "$n archivos"` })],
    ['cat de un archivo de la carpeta de configuracion', ctx('Bash', { cmd: `echo ---; cat "${NP}/Claude Fak/memoria/MEMORY.md" | head -5` })],
    ['listar una carpeta de la nube que nombra a Claude (mirar no es escribir)', ctx('Bash', { cmd: `echo "que hay:"; ls "${NP}/2- PROYECTOS/Hecho por Claude" 2>/dev/null | grep -i claude` })],
    ['el id del modelo en el registro interno, con python -c', ctx('Bash', { cmd: `python -c "import json; p='${INTERNO}/scheduled-tasks.json'; d=json.load(open(p)); d['model']='claude-sonnet-5-5'; json.dump(d, open(p,'w'))"` })],
    ['el id del modelo en la configuracion de ~/.claude', ctx('Bash', { cmd: `node -e "const f='C:/Users/FacundoS-PC/.claude/settings.json'; const s=require('fs'); const j=JSON.parse(s.readFileSync(f)); j['advisorModel'] = 'claude-opus-5-5'; s.writeFileSync(f, JSON.stringify(j,null,2))"` })],
];

const ROJOS_HOY16 = [
    // gemelo 1: una celda de xlsx con «Claude», aunque la linea empiece o siga con lecturas
    ['una celda con Claude despues de un find', ctx('Bash', { cmd: `echo ok; find . -name "*.py" | head -3; python -c "ws['J74'] = 'Claude'"` })],
    ['una celda con Claude adentro de un heredoc', ctx('Bash', { cmd: `ls exports\npython - <<'EOF'\nimport openpyxl\nws['J74'] = 'Claude'\nEOF` })],
    // gemelo 2: CREADO POR con una IA
    ['CREADO POR con una IA despues de un ls', ctx('Bash', { cmd: `cd /c/Dev && ls exports | head -2; node scripts/x.mjs --creado-por "IA"` })],
    ['un campo de autoria con una IA en el registro interno tambien frena (la excepcion es solo el id del modelo)', ctx('Bash', { cmd: `python - "${INTERNO}/scheduled-tasks.json" <<'EOF'\nt['autor'] = 'Claude'\nEOF` })],
    ['una nota «hecho por Claude» en el registro interno tambien frena', ctx('Bash', { cmd: `python - "${INTERNO}/scheduled-tasks.json" <<'EOF'\nt['nota'] = 'armado por Claude a la noche'\nEOF` })],
    // gemelo 3: el id del modelo en una celda
    ['el id del modelo en una celda, sin ruta', ctx('Bash', { cmd: `python -c "ws['J74'] = 'claude-opus-5-5'"` })],
    ['el id del modelo en una celda del listado del servidor', ctx('Bash', { cmd: `python - "${LISTADO}" <<'EOF'\nws['J74'] = 'claude-opus-5-5'\nEOF` })],
    ['el id del modelo en una celda, con el registro interno nombrado y un xlsx al lado', ctx('Bash', { cmd: `D="${INTERNO}"; python -c "import openpyxl; wb=openpyxl.load_workbook('listado.xlsx'); ws=wb.active; ws['A1'] = 'claude-opus-5-5'; wb.save('listado.xlsx')"` })],
    ['el id del modelo, con el registro interno Y una ruta de la nube en el mismo comando', ctx('Bash', { cmd: `cp "${INTERNO}/a.json" "${NP}/2- PROYECTOS/"; python -c "t['model'] = 'claude-opus-5-5'"` })],
    ['el id del modelo por COM en una celda, con el registro interno nombrado', ctx('PowerShell', { cmd: `$d = "$env:APPDATA\\Claude\\x.json"; $ws.Range('A1').Value2 = 'claude-opus-5-5'` })],
    // gemelo 4: un archivo con «claude» en el nombre copiado a la nube
    ['copiar a la nube un archivo con claude en el nombre', ctx('Bash', { cmd: `cp notas.txt "${NP}/2- PROYECTOS/contexto_claude.txt"` })],
    ['una lectura y despues la copia a la nube', ctx('Bash', { cmd: `ls "${NP}/Claude Fak"; cp a.txt "${NP}/2- PROYECTOS/notas claude.txt"` })],
    ['find con -exec que copia a una carpeta con Claude en el nombre', ctx('Bash', { cmd: `find "${NP}/1- GENERAL" -name "*.txt" -exec cp {} "${NP}/Hecho por Claude/" ;` })],
    ['find con -delete', ctx('Bash', { cmd: `find "${NP}/Hecho por Claude" -type f -delete` })],
    ['echo con redireccion a la nube', ctx('Bash', { cmd: `echo hola > "${NP}/2- PROYECTOS/de_claude.txt"` })],
    ['cat con tee a la nube', ctx('Bash', { cmd: `cat a.txt | tee "${NP}/2- PROYECTOS/claude.txt"` })],
    ['una escritura escondida en una sustitucion', ctx('Bash', { cmd: `ls "$(mkdir -p "${NP}/2- PROYECTOS/claude notas")"` })],
    ['awk que escribe un archivo', ctx('Bash', { cmd: `awk '{print > "${NP}/2- PROYECTOS/claude.txt"}' a.txt` })],
    ['sed que escribe un archivo', ctx('Bash', { cmd: `sed -n 'w ${NP}/2- PROYECTOS/claude.txt' a.txt` })],
    ['xargs con una copia', ctx('Bash', { cmd: `ls *.txt | xargs -I{} cp {} "${NP}/Hecho por Claude/"` })],
    ['PowerShell: Copy-Item a una carpeta con Claude en el nombre', ctx('PowerShell', { cmd: `Get-ChildItem . ; Copy-Item a.txt "C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\2- PROYECTOS\\claude.txt"` })],
];

// Las 9 formas que el auditor del 11/10/2026 encontro en la PRIMERA version de este cambio (una escritura que pasaba y
// antes frenaba; informe en .sgc-cache/auditorias/HOY16_firma_ia_guard_auditor_2026-10-11.md). Todas tienen que frenar.
const DEST = `${NP}/2- PROYECTOS/notas claude.txt`;
const ROJOS_AUDITOR = [
    ['git que NO es el primer verbo y escribe afuera del repo: diff --output', ctx('Bash', { cmd: `cd /c/Dev/BarackMercosul && git diff --output="${DEST}"` })],
    ['git archive -o a la nube, despues de un cd', ctx('Bash', { cmd: `cd /c/Dev/BarackMercosul; git archive -o "${NP}/2- PROYECTOS/claude.zip" HEAD` })],
    ['git con un alias que copia', ctx('Bash', { cmd: `echo x; git -c alias.z='!cp a.txt "${DEST}"' z` })],
    ['GIT_EXTERNAL_DIFF delante de git, en el medio de la linea', ctx('Bash', { cmd: `ls; GIT_EXTERNAL_DIFF='cp a.txt "${DEST}" #' git diff` })],
    ['sustitucion de proceso: cat <(cp …)', ctx('Bash', { cmd: `cat <(cp a.txt "${DEST}")` })],
    ['sed con dos programas, el segundo escribe', ctx('Bash', { cmd: `sed -n -e 1p -e 'w ${DEST}' a.txt` })],
    ['uniq con un archivo de salida', ctx('Bash', { cmd: `uniq a.txt "${DEST}"` })],
    ['un comentario con una comilla suelta que se traga la linea de abajo', ctx('Bash', { cmd: `ls # don't\ncp a.txt "${DEST}"\necho 'fin'` })],
    ['un parentesis entre comillas adentro de una sustitucion', ctx('Bash', { cmd: `echo "$(echo ')' ; cp a.txt "${DEST}")"` })],
    ['awk -f con una variable de salida', ctx('Bash', { cmd: `awk -f prog.awk -v out="${DEST}" a.txt` })],
    ['awk -o', ctx('Bash', { cmd: `awk -o"${DEST}" '{print}' a.txt` })],
    ['find con el flag escapado', ctx('Bash', { cmd: `find . -name "*.txt" \\-fprint "${DEST}"` })],
    ['sort --out= abreviado', ctx('Bash', { cmd: `sort --out="${DEST}" a.txt` })],
    ["un escape $'…' que arma una redireccion", ctx('Bash', { cmd: `echo hola $'\\x3e' "${DEST}"; cp a.txt "${DEST}"` })],
    // (b): el «id» no es cualquier nombre con dos guiones, y nombrar el registro interno no alcanza
    ['una pestaña con un nombre con guiones que no es un id de modelo', ctx('Bash', { cmd: `python - "${INTERNO}/a.json" <<'EOF'\nwb.create_sheet('Claude-Contexto-HO')\nEOF` })],
    ['el id del modelo en el JSON del flujograma (ruta relativa), con el registro interno nombrado', ctx('Bash', { cmd: `D="${INTERNO}"; python -c "import json; d=json.load(open('tools/flowchart/data/170.json')); d['elaboro'] = 'claude-opus-5-5'; json.dump(d, open('tools/flowchart/data/170.json','w'))"` })],
    ['el id del modelo en un txt de exports, con el registro interno nombrado', ctx('Bash', { cmd: `ls "${INTERNO}"; python -c "d = {}; d['nota'] = 'claude-opus-5-5'; open('exports/nota.txt','w').write(str(d))"` })],
    ['el id del modelo en un archivo suelto (sin barra), con el registro interno nombrado', ctx('Bash', { cmd: `D="${INTERNO}"; python -c "t = {}; t['m'] = 'claude-opus-5-5'; open('notas.json','w').write(str(t))"` })],
    ['el id del modelo por una ruta de red, con el registro interno nombrado', ctx('Bash', { cmd: `D="${INTERNO}"; python -c "t = {}; t['m'] = 'claude-opus-5-5'; open(r'\\\\server\\BARACK\\nota','w').write(str(t))"` })],
    ['el id del modelo con ${HOME} con llaves hacia afuera del registro', ctx('Bash', { cmd: `D="${INTERNO}"; python -c "t = {}; t['m'] = 'claude-opus-5-5'" > "\${HOME}/Desktop/nota"` })],
    ['el id del modelo subiendo con .. desde el registro interno', ctx('Bash', { cmd: `python - "${INTERNO}/../../../../Desktop/nota" <<'EOF'\nt['m'] = 'claude-opus-5-5'\nEOF` })],
    ['el id del modelo con pandas', ctx('Bash', { cmd: `D="${INTERNO}"; python -c "import pandas as pd; df = pd.DataFrame(); df['m'] = 'claude-opus-5-5'; df.to_excel(salida)"` })],
    // segunda pasada del auditor (11/10/2026): dos formas mas
    ['awk entre comillas dobles con una variable de la shell que esconde la redireccion', ctx('Bash', { cmd: `G='>'; awk "{print $G \\"${DEST}\\"}" a.txt` })],
    ['el id del modelo en una celda con el registro interno nombrado y una plantilla de Office de salida', ctx('Bash', { cmd: `D="${INTERNO}"; python -c "ws['A1'] = 'claude-opus-5-5'; wb.save('plantilla.xlt')"` })],
    ['el id del modelo con una variable que apunta a la nube',ctx('Bash', { cmd: `D="${INTERNO}"; N="${NP}"; python - "$N/nota" <<'EOF'\nt['m'] = 'claude-opus-5-5'\nEOF` })],
];

describe('firma-ia-guard · HOY-16: las formas que encontro el auditor en la primera version siguen frenando', () => {
    for (const [nombre, c] of ROJOS_AUDITOR) it(`ROJO: ${nombre}`, () => expect(bloquea(c)).toBe(true));
    it('PowerShell no usa el camino de «solo lectura» de Bash', () => {
        const cmd = `echo "x"; ls "${NP}/2- PROYECTOS/Hecho por Claude"`;
        expect(bloquea(ctx('Bash', { cmd }))).toBe(false);
        expect(bloquea(ctx('PowerShell', { cmd }))).toBe(true);
    });
    it('un commit con el mensaje en un heredoc que cuenta el caso sigue pasando (el mensaje de un commit no es un documento)', () => {
        expect(bloquea(ctx('Bash', { cmd: `git commit -F - -- scripts/_lib/guardianes.mjs <<'EOF'\nfix(firma): el listado decia CREADO POR = Claude y ws['J74'] = 'Claude'\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nEOF\ngit show --stat HEAD | tail -3` }))).toBe(false);
    });
    it('el id de un modelo es solo un id de modelo', () => {
        for (const si of ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'claude-3-5-sonnet-20241022']) expect(bloquea(ctx('Bash', { cmd: `python - "${INTERNO}/a.json" <<'EOF'\nt['model'] = '${si}'\nEOF` })), si).toBe(false);
        for (const no of ['Claude', 'claude-fak', 'Claude-Opus', 'claude-contexto-ho', 'claude-opus-5-5 y Gemini', 'hecho con claude-opus-5-5', 'claude-3']) expect(bloquea(ctx('Bash', { cmd: `python - "${INTERNO}/a.json" <<'EOF'\nt['model'] = '${no}'\nEOF` })), no).toBe(true);
    });
});

// El contexto COMO LO ARMA EL DESPACHADOR en vivo: `toolL` conserva la mayuscula del nombre («Bash», «Write»). Los
// casos de arriba lo arman en minuscula, y por eso el 11/10/2026 los tests daban verde y la prueba en vivo freno.
const ctxVivo = (tool, { cmd = '', file = '', content = '' } = {}) => ({ ...ctx(tool, { cmd, file, content }), toolL: tool });

describe('firma-ia-guard · con el contexto como lo arma el despachador (el nombre de la herramienta con mayuscula)', () => {
    it('VERDE: los dos casos reales del 10/10 pasan tambien asi', () => {
        expect(bloquea(ctxVivo('Bash', { cmd: REALES.lectura_1212 }))).toBe(false);
        expect(bloquea(ctxVivo('Bash', { cmd: REALES.registro_interno_1130 }))).toBe(false);
    });
    it('ROJO: los gemelos de Bash frenan igual; y la lectura por PowerShell no usa el camino de Bash', () => {
        for (const [nombre, c] of [...ROJOS_HOY16, ...ROJOS_AUDITOR]) if (c.tool === 'Bash') expect(bloquea(ctxVivo('Bash', { cmd: c.cmd })), nombre).toBe(true);
        expect(bloquea(ctxVivo('PowerShell', { cmd: `echo "x"; ls "${NP}/2- PROYECTOS/Hecho por Claude"` }))).toBe(true);
    });
    const deArchivo = (c) => c.tool === 'Write' || c.tool === 'Edit';
    it('ROJO (HOY-16b): en vivo el contenido de un Write o un Edit SE revisa (hasta el 11/10 miraba un comando vacio)', () => {
        for (const [nombre, c] of ROJOS) if (deArchivo(c)) expect(bloquea(ctxVivo(c.tool, { file: c.file, content: c.content })), nombre).toBe(true);
    });
    it('VERDE (HOY-16b): los Write y Edit de todos los dias pasan igual en vivo', () => {
        for (const [nombre, c] of VERDES) if (deArchivo(c)) expect(bloquea(ctxVivo(c.tool, { file: c.file, content: c.content })), nombre).toBe(false);
    });
    it('HOY-16b, por evaluar() con el JSON como llega del despachador: rojo sale con 2, verde con 0', () => {
        const exit = (tool, input) => G.evaluar(JSON.stringify({ tool_name: tool, tool_input: input }), { nombres: ['firma-ia-guard'], marcar: false, env: {} }).salida.exit;
        const CSV = 'C:\\Dev\\BarackMercosul\\exports\\TIEMPOS\\tabla.csv';
        expect(exit('Write', { file_path: CSV, content: 'op;tiempo;fuente\n10;2:47;ChatGPT' })).toBe(2);
        expect(exit('Edit', { file_path: 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\PPAP CLIENTES\\VW\\nota.txt', old_string: 'x', new_string: 'Revisado con Claude el 08/10.' })).toBe(2);
        expect(exit('Write', { file_path: CSV, content: 'op;tiempo;fuente\n10;2:47;video IMG_0383' })).toBe(0);
        expect(exit('Write', { file_path: 'C:\\Dev\\BarackMercosul\\exports\\explicaciones\\cierre.html', content: '<p>Claude revisa el cierre</p>' })).toBe(0);
    });
});

// ── HOY-16c (11/10/2026): un script no es un documento, el TEMP no es de la empresa. Medido con
// `node scripts/_medirFirmaWrite.mjs` sobre 12 dias: 5.339 Write/Edit, frenaria 5. Dos eran documentos de verdad (un LEEME.txt en
// la nube de Ingenieria; el armar.py de una guia sobre la IA, legitima); tres eran SCRIPTS (.py, .mjs) en exports/ o en el TEMP de
// la sesion, y uno era el medidor de este mismo control con un fixture «CREADO POR = Claude». Lo que un script PRODUCE lo revisa
// _sinFirmaIA.py al escribirse o imprimirse. Las dos excepciones valen SOLO para el contenido de un Write / Edit con JSON sano.
const TEMP = 'C:\\Users\\FACUND~1\\AppData\\Local\\Temp';
const EXPORTS = 'C:\\Dev\\BarackMercosul\\exports';
const VERDES_HOY16C = [
    // los tres de la medicion, en su forma
    ['un .py en exports/ con la IA en un campo de autoria (el fixture del medidor)', 'Write', `${EXPORTS}\\UPPER_TRIM_CONSUMO_VINILO_20261006\\armar.py`, `CASOS = [("CREADO POR", "Claude"), ("CREADO POR", "F.Santoro")]  # fixture`],
    ['un .mjs en el TEMP de la sesion (nombre corto FACUND~1) que nombra a la IA', 'Write', `${TEMP}\\x\\scratchpad\\medir.mjs`, `const CASO = { 'CREADO POR': 'Claude' };`],
    ['un .html en el TEMP, con barras normales, que nombra a la IA', 'Write', 'C:/Users/x/AppData/Local/Temp/y/pagina.html', '<p>Autor: Claude</p>'],
    ['un .py en el TEMP, todo en minuscula (el armar.py de ppt_pedro)', 'Write', 'c:/users/x/appdata/local/temp/ppt_pedro/armar.py', `cp.title = 'Claude en Barack - Como empezar'`],
    ['un .txt en el /tmp de msys', 'Write', '/tmp/nota.txt', 'Autor: Claude'],
    // hasta el 11/10 eran ROJOS de este archivo: scripts del repo que ponen una IA en un documento al CORRER. Lo que hacen sigue
    // frenando por Bash (sus gemelos python -c estan en ROJOS) y el documento que producen lo frena _sinFirmaIA.py.
    ['openpyxl: cell(value=Claude) en un .py del repo', 'Write', 'C:\\Dev\\BarackMercosul\\scripts\\_cargarHo.py', `ws.cell(row=r, column=10, value="Claude")`],
    ['la pestaña oculta para el proximo Claude en un .py del repo', 'Write', 'C:\\Dev\\BarackMercosul\\scripts\\_registrar.py', `ctx = wb.create_sheet('_CONTEXTO_CLAUDE')\nctx.sheet_state = 'hidden'`],
    ['propiedades del archivo: autor Claude en un .py del repo', 'Edit', 'C:\\Dev\\BarackMercosul\\scripts\\img\\hojalib.py', `prs.core_properties.author = "Claude"`],
    ['un parrafo de Word con hecho con Claude en un .py del repo', 'Write', 'C:\\Dev\\BarackMercosul\\scripts\\_informe.py', `doc.add_paragraph("Informe armado con Claude")`],
];
const ROJOS_HOY16C = [
    ['un .csv en exports/ con la IA en la columna de autoria', 'Write', `${EXPORTS}\\TIEMPOS\\_p.csv`, 'op;tiempo;creado por\n10;2:47;Claude'],
    ['un .txt en la nube de Ingenieria que nombra a la IA (el LEEME.txt de la medicion)', 'Write', `${NUBE}\\1- GENERAL\\AMFE\\DATOS\\LEEME.txt`, 'Carpeta ordenada con Claude el 01/10/2026.'],
    // un .py en la nube FRENA: ahi lo ve el equipo, como el _trabajo de HOY-16b; la excepcion de scripts es para afuera del servidor
    // y de la nube, y medido no cuesta nada (ninguno de los 5 frenos en 12 dias era un script en la nube)
    ['un .py en la nube de Ingenieria que nombra a la IA', 'Write', `${NUBE}\\1- GENERAL\\AMFE\\DATOS\\armar.py`, '# armado con Claude\nprint(1)'],
    ['un .json en el servidor con la IA en un campo de autoria', 'Edit', 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\HOJAS DE OPERACIONES\\3- LISTADO\\datos.json', '{"creado_por": "Claude"}'],
    // un .json es un DATO, no un script (auditor Opus 11/10 03:00): el 170.json del flujograma se dibuja en el cajetin como «Elaborado por»
    ['un Edit de un .json del repo con la IA en un campo de autoria', 'Edit', 'C:\\Dev\\BarackMercosul\\tools\\flowchart\\data\\170.json', `{"elaboro": "Claude", "fecha": "08/10/2026"}`],
    ['un script en exports/ con claude en el NOMBRE (el nombre si se mira, regla 4)', 'Write', `${EXPORTS}\\HO\\notas_claude.py`, 'print(1)'],
    ['salir del TEMP con ..', 'Write', `${TEMP}\\..\\..\\..\\Desktop\\nota.txt`, 'Autor: Claude'],
    ['una carpeta que solo se llama parecido al TEMP', 'Write', 'C:\\Users\\x\\AppData\\Local\\Temporal\\nota.txt', 'Autor: Claude'],
    ['un .txt en exports/ con un campo de autoria', 'Write', `${EXPORTS}\\HO\\nota.txt`, 'Elaboro: Claude'],
    ['una extension que solo termina parecido (.jsonld no es .json)', 'Write', `${EXPORTS}\\HO\\datos.jsonld`, '{"author": "Claude"}'],
];

describe('firma-ia-guard · HOY-16c: un script no es un documento y el TEMP no es de la empresa (11/10/2026, 5 de 5.339)', () => {
    for (const [nombre, tool, f, c] of VERDES_HOY16C) it(`VERDE: ${nombre}`, () => {
        expect(bloquea(ctxVivo(tool, { file: f, content: c }))).toBe(false);
        expect(bloquea(ctx(tool, { file: f, content: c }))).toBe(false);
        expect(firmaIaEnEscritura(c, f)).not.toBeNull();   // sin la excepcion frenaba: el verde lo da la excepcion
    });
    for (const [nombre, tool, f, c] of ROJOS_HOY16C) it(`ROJO: ${nombre}`, () => {
        expect(bloquea(ctxVivo(tool, { file: f, content: c }))).toBe(true);
        expect(bloquea(ctx(tool, { file: f, content: c }))).toBe(true);
    });
    it('por evaluar() con el JSON como llega del despachador: el .csv de exports y el .txt de la nube salen con 2; el .py de exports, el .mjs y el .html del TEMP con 0', () => {
        const exit = (tool, input) => G.evaluar(JSON.stringify({ tool_name: tool, tool_input: input }), { nombres: ['firma-ia-guard'], marcar: false, env: {} }).salida.exit;
        expect(exit('Write', { file_path: `${EXPORTS}\\TIEMPOS\\_p.csv`, content: 'op;tiempo;creado por\n10;2:47;Claude' })).toBe(2);
        expect(exit('Edit', { file_path: `${NUBE}\\1- GENERAL\\AMFE\\DATOS\\LEEME.txt`, old_string: 'x', new_string: 'Carpeta ordenada con Claude.' })).toBe(2);
        expect(exit('Write', { file_path: `${EXPORTS}\\UPPER_TRIM_CONSUMO_VINILO_20261006\\armar.py`, content: 'CASOS = [("CREADO POR", "Claude")]' })).toBe(0);
        expect(exit('Write', { file_path: `${TEMP}\\x\\scratchpad\\medir.mjs`, content: `const CASO = { 'CREADO POR': 'Claude' };` })).toBe(0);
        expect(exit('Write', { file_path: 'C:/Users/x/AppData/Local/Temp/y/pagina.html', content: '<p>Autor: Claude</p>' })).toBe(0);
    });
    it('auditor Opus 11/10 03:00: ninguna excepcion vale en la nube ni en el servidor; un .json es un dato; .sgc-cache es interno; preparedBy es autoria', () => {
        const exit = (tool, input) => G.evaluar(JSON.stringify({ tool_name: tool, tool_input: input }), { nombres: ['firma-ia-guard'], marcar: false, env: {} }).salida.exit;
        // ROJO: `exports\explicaciones` y `_trabajo` solo cuentan adentro del repo; en la nube o en Y: los ve el equipo
        expect(exit('Write', { file_path: `${NUBE}\\2- PROYECTOS\\exports\\X\\_trabajo\\LISTADO.csv`, content: 'creado por;Claude' })).toBe(2);
        expect(exit('Write', { file_path: 'Y:\\BARACK\\CALIDAD\\exports\\explicaciones\\a.csv', content: 'creado por;Claude' })).toBe(2);
        // ROJO: un AppData\Local\Temp del servidor no es la carpeta temporal del usuario
        expect(exit('Write', { file_path: 'Y:\\BARACK\\AppData\\Local\\Temp\\x.csv', content: 'creado por;Claude' })).toBe(2);
        // ROJO: un .json es un dato, no un script (el 170.json del flujograma se dibuja en el cajetin)
        expect(exit('Write', { file_path: `${EXPORTS}\\X\\datos.json`, content: '{"creado_por": "Claude"}' })).toBe(2);
        expect(exit('Write', { file_path: 'C:\\Dev\\BarackMercosul\\tools\\flowchart\\data\\x.json', content: '{"preparedBy": "Claude"}' })).toBe(2);
        // VERDE: la cache interna del repo nunca sale de la PC (notas de investigacion que nombran a la IA a proposito)
        expect(exit('Write', { file_path: 'C:\\Dev\\BarackMercosul\\.sgc-cache\\investigacion-2026-10-11\\HALLAZGOS.md', content: 'autor: claude\n' })).toBe(0);
        // VERDE sigue: el .py de exports del repo y el .mjs del TEMP del usuario
        expect(exit('Write', { file_path: `${EXPORTS}\\X\\armar.py`, content: 'AUTOR = "Claude"' })).toBe(0);
    });
    it('ROJO: con el JSON roto las excepciones no valen (red de seguridad, hacia el lado de frenar)', () => {
        const roto = { ok: false, raw: '', rescate: { tool: 'Write', cmd: '', file: `${TEMP}\\x\\scratchpad\\medir.mjs`, content: `const CASO = { 'CREADO POR': 'Claude' };` } };
        expect(bloquea(roto)).toBe(true);
    });
    it('esScript y esArchivoTemporal: por extension exacta y por carpeta, sin ..', () => {
        for (const si of ['a.py', 'a.MJS', 'x/a.cjs', 'a.js', 'a.ts', 'a.sh', 'a.ps1']) expect(G.esScript(si), si).toBe(true);
        // .json / .jsonl / .yml son DATOS (auditor Opus 11/10 03:00: un datos.json en exports con "creado_por": "Claude" pasaba)
        for (const no of ['a.txt', 'a.csv', 'a.html', 'a.pyc', 'a.jsonld', 'a.py.bak', 'a.json', 'a.jsonl', 'a.yml', '']) expect(G.esScript(no), no).toBe(false);
        for (const si of [`${TEMP}\\a.txt`, 'C:/Users/x/AppData/Local/Temp/a.txt', '/c/Users/x/AppData/Local/Temp/a', 'c:\\users\\x\\appdata\\local\\temp\\a', '/tmp/a']) expect(G.esArchivoTemporal(si), si).toBe(true);
        // anclada al TEMP del usuario: un AppData\Local\Temp en el servidor no es temporal (auditor Opus 11/10 03:00)
        for (const no of [`${TEMP}\\..\\a.txt`, 'C:\\Users\\x\\AppData\\Local\\Temporal\\a', 'C:\\Users\\x\\AppData\\Roaming\\Temp\\a', 'C:\\Dev\\BarackMercosul\\tmp\\a', 'tmp/a', 'Y:\\BARACK\\AppData\\Local\\Temp\\x.csv', '']) expect(G.esArchivoTemporal(no), no).toBe(false);
        for (const si of ['C:\\Dev\\BarackMercosul\\.sgc-cache\\investigacion-2026-10-11\\HALLAZGOS.md', '/c/Dev/BarackMercosul/.sgc-cache/x/a.md']) expect(G.esCacheInterna(si), si).toBe(true);
        for (const no of ['C:\\Dev\\BarackMercosul\\.sgc-cache\\..\\exports\\a.csv', 'C:\\Dev\\BarackMercosul\\exports\\a.md', '']) expect(G.esCacheInterna(no), no).toBe(false);
    });
});

describe('firma-ia-guard · HOY-16: mira el verbo y el destino, no si la ruta dice Claude', () => {
    for (const [nombre, c] of VERDES_HOY16) it(`VERDE: ${nombre}`, () => expect(GUARDIANES['firma-ia-guard'](c, { env: {} })?.texto ?? null).toBeNull());
    for (const [nombre, c] of ROJOS_HOY16) it(`ROJO: ${nombre}`, () => expect(bloquea(c)).toBe(true));
    it('esSoloLectura: cada comando simple de la linea, y lo que no conoce cuenta como escritura', () => {
        for (const si of ['ls', 'echo hola', `find "${NP}" -type f -printf '%s\\n' 2>/dev/null | awk '{t+=$1} END{print t}'`, 'for d in a b; do if [ -d "$d" ]; then echo "$d"; else echo no; fi; done', 'grep -rn claude . | sort | uniq -c | head', 'x=$(cat a.txt | wc -l); echo "$x"', 'sed -n 1,5p a.txt', 'cat a.txt 2>&1 >/dev/null']) {
            expect(esSoloLectura(si), si).toBe(true);
        }
        for (const no of ['', 'cp a b', 'ls > lista.txt', 'ls >> lista.txt', 'cat a | tee b', 'find . -delete', 'find . -exec rm {} ;', 'find . -fprint x', 'sort -o b a', 'sed -i s/a/b/ x', 'sed s/a/b/ x', 'python x.py', 'node -e "1"', 'ls; rm x', 'echo $(rm x)', 'echo `touch x`', 'awk \'{print > "f"}\' a', 'awk \'{system("rm x")}\' a', 'ls | xargs rm', 'cat <<EOF\nhola\nEOF', 'git log', 'curl http://x', 'mv a b', 'mkdir x', 'Copy-Item a b', 'Set-Content a b', 'ls & rm x', 'cat a.txt > "$f"']) {
            expect(esSoloLectura(no), no).toBe(false);
        }
    });
});

describe('firma-ia-guard', () => {
    it('corre con Bash, PowerShell, Write y Edit', () => {
        for (const t of ['Bash', 'PowerShell', 'Write', 'Edit']) expect(matriz(t)).toContain('firma-ia-guard');
    });
    for (const [nombre, c] of ROJOS) it(`ROJO: ${nombre}`, () => expect(bloquea(c)).toBe(true));
    for (const [nombre, c] of VERDES) it(`VERDE: ${nombre}`, () => expect(bloquea(c)).toBe(false));
    it('el mensaje dice que va en su lugar', () => {
        const r = GUARDIANES['firma-ia-guard'](ROJOS[0][1], { env: {} });
        expect(r.texto).toMatch(/F\.Santoro/);
        expect(r.texto).toMatch(/memoria o al repo/);
    });
    it('firmaIaEnEscritura devuelve null en texto sin IA', () => {
        expect(firmaIaEnEscritura('ws.Cells(1,1).Value = "HO 990"', '')).toBeNull();
    });
});

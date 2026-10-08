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
import { GUARDIANES, matriz, firmaIaEnEscritura } from '../../scripts/_lib/guardianes.mjs';

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
    ['openpyxl: cell(value=Claude)', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\scripts\\_cargarHo.py', content: `ws.cell(row=r, column=10, value="Claude")` })],
    ['la pestaña oculta para el proximo Claude', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\scripts\\_registrar.py', content: `ctx = wb.create_sheet('_CONTEXTO_CLAUDE')\nctx.sheet_state = 'hidden'` })],
    ['COM: texto para el proximo Claude en una celda', ctx('PowerShell', { cmd: `$ws.Range('A1').Value2 = 'CONTEXTO PARA EL PRÓXIMO CLAUDE'` })],
    ['propiedades del archivo: autor Claude', ctx('Edit', { file: 'C:\\Dev\\BarackMercosul\\scripts\\img\\hojalib.py', content: `prs.core_properties.author = "Claude"` })],
    ['un dato con autor IA', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\tools\\flowchart\\data\\170.json', content: `{"elaboro": "Claude", "fecha": "08/10/2026"}` })],
    ['CREADO POR: IA', ctx('Bash', { cmd: `node scripts/x.mjs --creado-por "IA"` })],
    ['un parrafo de Word con hecho con Claude', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\scripts\\_informe.py', content: `doc.add_paragraph("Informe armado con Claude")` })],
    ['un archivo con Claude en el nombre en el servidor', ctx('Bash', { cmd: `cp notas.txt "Y:/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/3- LISTADO/_CONTEXTO_CLAUDE.txt"` })],
    ['una carpeta con Claude en el nombre en la nube de Ingenieria', ctx('Bash', { cmd: `mkdir -p "${NUBE}\\2- PROYECTOS\\Hecho por Claude"` })],
    ['un Write en el servidor que nombra a Claude', ctx('Write', { file: 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\PPAP CLIENTES\\VW\\nota.txt', content: 'Revisado con Claude el 08/10.' })],
    ['un Write en exports que nombra a ChatGPT', ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\exports\\TIEMPOS\\tabla.csv', content: 'op;tiempo;fuente\n10;2:47;ChatGPT' })],
    ['un Write en la nube de Ingenieria que habla de inteligencia artificial', ctx('Write', { file: `${NUBE}\\1- GENERAL\\resumen.md`, content: 'Preparado con inteligencia artificial.' })],
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

/**
 * Ningun .py del repo cierra PowerPoint sin mirar si Fak tenia algo abierto — los dos sentidos.
 *
 * PowerPoint es de UNA sola instancia: `Dispatch("PowerPoint.Application")` se engancha al que ya
 * esta abierto y un `Quit()` sin condicion cierra tambien el deck que Fak este mirando. Paso el
 * 23/09/2026 y volvio el 02/10/2026 en un script recien escrito (`scripts/hilos/pptx_a_png.py`,
 * borrado). El patron de la casa es el de `scripts/img/exportar_png.py`: guardar
 * `habia_abiertas = ppt.Presentations.Count` antes de abrir y hacer `Quit()` solo si
 * `habia_abiertas == 0 and ppt.Presentations.Count == 0`.
 *
 * Los ROJOS son las formas en que ya fallo o puede fallar (cada una, un script real del repo o una
 * variante de el). Los VERDES son las formas del patron que ya estan escritas, y lo que nombra a
 * Quit sin cerrar PowerPoint (el Quit de Excel, un comentario, un docstring).
 *
 * Logica: `scripts/_lib/powerpointQuit.mjs`. No abre PowerPoint: lee los .py como texto.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXCLUIDAS, abrePowerPoint, quitsDePowerPoint, quitsSinResguardo, matanElProceso, sinResguardo, pysDelRepo, barrer } from '../../scripts/_lib/powerpointQuit.mjs';

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../../..');
const PY = (...renglones) => renglones.join('\n') + '\n';
const ABRE = 'ppt = win32com.client.Dispatch("PowerPoint.Application")';

const ROJOS = [
    ['Quit pelado al final (el del 23/09 y el del 02/10)', PY(
        'import win32com.client',
        ABRE,
        'pres = ppt.Presentations.Open(ruta, WithWindow=False)',
        'pres.SaveAs(pdf, 32)',
        'pres.Close()',
        'ppt.Quit()',
    )],
    ['Quit pelado adentro de un finally', PY(
        ABRE,
        'try:',
        '    pres = ppt.Presentations.Open(ruta, WithWindow=False)',
        '    pres.Close()',
        'finally:',
        '    ppt.Quit()',
    )],
    ['mira solo el "antes": si Fak abre un deck mientras exporta, se lo cierra', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'try:',
        '    pres = ppt.Presentations.Open(ruta, WithWindow=False)',
        '    pres.Close()',
        'finally:',
        '    if habia_abiertas == 0:',
        '        try:',
        '            ppt.Quit()',
        '        except Exception:',
        '            pass',
    )],
    ['mira solo el "despues"', PY(
        ABRE,
        'pres = ppt.Presentations.Open(ruta, WithWindow=False)',
        'pres.Close()',
        'if ppt.Presentations.Count == 0:',
        '    ppt.Quit()',
    )],
    ['Quit nombrado sin parentesis en una tupla: un grep de ".Quit(" no lo ve', PY(
        'app=win32com.client.Dispatch("PowerPoint.Application")',
        'pres=app.Presentations.Open(src, WithWindow=False)',
        'try:',
        '    pres.Export(dst, "PNG", 1800, 1273)',
        'finally:',
        '    for f in (pres.Close, app.Quit):',
        '        try: f()',
        '        except Exception: pass',
    )],
    ['el Quit esta en el else del resguardo', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '    print("nada abierto")',
        'else:',
        '    ppt.Quit()',
    )],
    ['el Quit esta en el else del resguardo, adentro de una funcion', PY(
        'def a_pdf(ruta):',
        '    ' + ABRE,
        '    habia_abiertas = ppt.Presentations.Count',
        '    pres = ppt.Presentations.Open(ruta)',
        '    pres.Close()',
        '    if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '        print("nada abierto")',
        '    else:',
        '        ppt.Quit()',
    )],
    ['quit en minuscula: COM no distingue mayusculas', PY(
        ABRE,
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'ppt.quit()',
    )],
    ['el ProgID con la version', PY(
        'ppt = win32com.client.Dispatch("PowerPoint.Application.16")',
        'ppt.Quit()',
    )],
    ['PowerPoint llega de otro modulo: el archivo no nombra el ProgID', PY(
        'from oficina import abrir_powerpoint',
        'ppt = abrir_powerpoint()',
        'pres = ppt.Presentations.Open(ruta, WithWindow=False)',
        'pres.Close()',
        'ppt.Quit()',
    )],
    ['la variable que era de Excel pasa a ser otra cosa', PY(
        'from oficina import abrir_powerpoint',
        'app = win32com.client.DispatchEx("Excel.Application")',
        'app.Quit()',
        'app = abrir_powerpoint()',
        'pres = app.Presentations.Open(ruta)',
        'pres.Close()',
        'app.Quit()',
    )],
    ['el ProgID se elige en el mismo renglon', PY(
        'app = win32com.client.Dispatch("Excel.Application" if tipo == "xlsx" else "PowerPoint.Application")',
        'app.Quit()',
    )],
    ['las dos partes unidas con or', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'if habia_abiertas == 0 or ppt.Presentations.Count == 0:',
        '    ppt.Quit()',
    )],
    ['el resguardo negado', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'if not (habia_abiertas == 0 and ppt.Presentations.Count == 0):',
        '    ppt.Quit()',
    )],
    ['el "antes" se mide DESPUES de abrir la propia', PY(
        ABRE,
        'pres = ppt.Presentations.Open(ruta)',
        'habia_abiertas = ppt.Presentations.Count',
        'pres.Close()',
        'if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '    ppt.Quit()',
    )],
    ['el "antes" no sale de Presentations.Count', PY(
        ABRE,
        'habia_abiertas = 0',
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '    ppt.Quit()',
    )],
    ['el resguardo mira a una variable y el Quit es de otra', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'otra = ppt',
        'if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '    otra.Quit()',
    )],
    ['el resguardo esta afuera de la funcion que hace el Quit', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '    def cerrar():',
        '        ppt.Quit()',
    )],
    ['Quit encadenado al Dispatch', PY(
        'import win32com.client',
        'win32com.client.Dispatch("PowerPoint.Application").Quit()',
    )],
    ['Quit por getattr', PY(
        ABRE,
        'getattr(ppt, "Quit")()',
    )],
    ['comillas simples y DispatchEx (el que quedo suelto en scripts/hotmelt)', PY(
        'import win32com.client',
        "powerpoint = win32com.client.DispatchEx('PowerPoint.Application')",
        "print('PowerPoint COM OK')",
        'powerpoint.Quit()',
    )],
    ['dos funciones: una bien y la otra sin resguardo', PY(
        'def a_pdf(p):',
        '    ' + ABRE,
        '    habia_abiertas = ppt.Presentations.Count',
        '    pres = ppt.Presentations.Open(p)',
        '    pres.Close()',
        '    if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '        ppt.Quit()',
        '',
        'def a_png(p):',
        '    ' + ABRE,
        '    pres = ppt.Presentations.Open(p)',
        '    pres.Close()',
        '    ppt.Quit()',
    )],
];

const VERDES = [
    ['el patron de exportar_png.py', PY(
        'def exportar(pptx_path):',
        '    ' + ABRE,
        '    # Si Fak tiene una presentacion abierta, PowerPoint no se cierra: un Quit() le cerro el deck',
        '    habia_abiertas = ppt.Presentations.Count',
        '    try:',
        '        pres = ppt.Presentations.Open(pptx_path, WithWindow=False)',
        '        pres.Close()',
        '    finally:',
        '        if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '            ppt.Quit()',
    )],
    ['a nivel de modulo, con otros nombres (lamina_proceso/exportar.py)', PY(
        'pp = win32com.client.Dispatch("PowerPoint.Application")',
        'abiertas = pp.Presentations.Count',
        'pres = pp.Presentations.Open(pptx, True, False, False)',
        'try:',
        '    pres.Slides(1).Export(png, "PNG", 4961, 3508)  # A3 a 300 dpi',
        'finally:',
        '    pres.Close()',
        '    if abiertas == 0 and pp.Presentations.Count == 0:',
        '        pp.Quit()',
    )],
    ['el cierre no puede voltear el proceso: el if adentro de un try', PY(
        'app=win32com.client.Dispatch("PowerPoint.Application")',
        'habia_abiertas=app.Presentations.Count',
        'pres=app.Presentations.Open(src, WithWindow=False)',
        'try:',
        '    pres.Export(dst, "PNG", 1800, 1273)',
        'finally:',
        '    try: pres.Close()',
        '    except Exception: pass',
        '    try:',
        '        if habia_abiertas == 0 and app.Presentations.Count == 0:',
        '            app.Quit()',
        '    except Exception: pass',
    )],
    ['el Quit adentro de un try, debajo del if', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '    try:',
        '        ppt.Quit()',
        '    except Exception:',
        '        pass',
    )],
    ['las dos partes en dos if anidados', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'if habia_abiertas == 0:',
        '    if ppt.Presentations.Count == 0:',
        '        ppt.Quit()',
    )],
    ['la condicion partida en dos renglones', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'if (habia_abiertas == 0',
        '        and ppt.Presentations.Count == 0):',
        '    ppt.Quit()',
    )],
    ['if y Quit en el mismo renglon', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'if habia_abiertas == 0 and ppt.Presentations.Count == 0: ppt.Quit()',
    )],
    ['el mismo archivo abre Excel en instancia propia: ese Quit no es de PowerPoint', PY(
        'xl = win32com.client.DispatchEx("Excel.Application")',
        'wb = xl.Workbooks.Open(planilla)',
        'wb.Close(False)',
        'xl.Quit()',
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'pres = ppt.Presentations.Open(ruta)',
        'pres.Close()',
        'if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '    ppt.Quit()',
    )],
    ['el resguardo adentro de un if ajeno que lleva or', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'if quiere_pdf or quiere_png:',
        '    pres = ppt.Presentations.Open(ruta)',
        '    pres.Close()',
        '    if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '        ppt.Quit()',
    )],
    ['el resguardo adentro de un if ajeno que lleva not (', PY(
        ABRE,
        'habia_abiertas = ppt.Presentations.Count',
        'if not (os.path.exists(pdf)):',
        '    pres = ppt.Presentations.Open(ruta)',
        '    pres.Close()',
        '    if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '        ppt.Quit()',
    )],
    ['Quit nombrado solo en un comentario y en un docstring', PY(
        '"""Exporta sin cerrar PowerPoint: aca no va ningun ppt.Quit()."""',
        ABRE,
        'pres = ppt.Presentations.Open(ruta, WithWindow=False)',
        'pres.Close()   # sin ppt.Quit(): lo que tenga abierto Fak queda como estaba',
    )],
    ['dos funciones, cada una con su resguardo', PY(
        'def a_pdf(p):',
        '    ' + ABRE,
        '    habia_abiertas = ppt.Presentations.Count',
        '    pres = ppt.Presentations.Open(p)',
        '    pres.Close()',
        '    if habia_abiertas == 0 and ppt.Presentations.Count == 0:',
        '        ppt.Quit()',
        '',
        'def a_png(p):',
        '    ' + ABRE,
        '    habia = ppt.Presentations.Count',
        '    pres = ppt.Presentations.Open(p)',
        '    pres.Close()',
        '    if habia == 0 and ppt.Presentations.Count == 0:',
        '        ppt.Quit()',
    )],
];

describe('powerpointQuit — el analizador, en las dos direcciones', () => {
    it.each(ROJOS)('ROJO: %s', (_nombre, fuente) => {
        expect(abrePowerPoint(fuente)).toBe(true);
        const malos = sinResguardo(fuente);
        expect(malos.length).toBeGreaterThan(0);
        for (const m of malos) {
            expect(m.linea).toBeGreaterThan(0);
            expect(m.falta).not.toBe('');
        }
    });

    it.each(VERDES)('VERDE: %s', (nombre, fuente) => {
        expect(abrePowerPoint(fuente)).toBe(true);
        expect(sinResguardo(fuente)).toEqual([]);
        // el verde es porque leyo el Quit y lo encontro resguardado, no porque no lo vio
        const sinQuit = nombre.startsWith('Quit nombrado solo');
        expect(quitsDePowerPoint(fuente).length > 0).toBe(!sinQuit);
    });

    it('el rojo dice el renglon y que le falta', () => {
        const [, fuente] = ROJOS.find(([n]) => n.startsWith('mira solo el "antes"'));
        const [malo] = quitsSinResguardo(fuente);
        expect(malo.linea).toBe(9);
        expect(malo.receptor).toBe('ppt');
        expect(malo.falta).toContain('ppt.Presentations.Count == 0');
    });

    it('en el archivo con dos funciones marca solo la que no tiene resguardo', () => {
        const [, fuente] = ROJOS.find(([n]) => n.startsWith('dos funciones'));
        expect(quitsDePowerPoint(fuente).map((q) => [q.linea, q.falta === ''])).toEqual([[7, true], [13, false]]);
    });

    it('un archivo que no abre PowerPoint no se juzga: su Quit es de otra aplicacion', () => {
        const fuente = PY(
            '"""Convierte a PDF con Excel. No usa PowerPoint.Application."""',
            'xl = win32com.client.DispatchEx("Excel.Application")',
            'xl.Quit()',
        );
        expect(abrePowerPoint(fuente)).toBe(false);
        expect(quitsDePowerPoint(fuente)).toEqual([]);
        expect(sinResguardo(fuente)).toEqual([]);
    });

    it('ROJO: matar el proceso POWERPNT es el mismo daño sin pasar por Quit', () => {
        const taskkill = PY('import subprocess', 'subprocess.run(["taskkill", "/IM", "POWERPNT.EXE", "/F"])');
        const psutil = PY(
            'import psutil',
            'for p in psutil.process_iter():',
            '    if p.name() == "POWERPNT.EXE":',
            '        p.kill()',
        );
        const powershell = PY('os.system("powershell -Command Stop-Process -Name POWERPNT -Force")');
        for (const fuente of [taskkill, psutil, powershell]) {
            expect(matanElProceso(fuente).map((h) => h.receptor)).toEqual(['POWERPNT']);
            expect(sinResguardo(fuente).length).toBe(1);
        }
    });

    it('VERDE: preguntar si PowerPoint esta abierto no es matarlo', () => {
        const fuente = PY(
            'import subprocess',
            'out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq POWERPNT.EXE", "/NH"], capture_output=True, text=True).stdout',
            'abierto = "POWERPNT.EXE" in out.upper()   # sin taskkill: solo se mira',
        );
        expect(sinResguardo(fuente)).toEqual([]);
    });
});

/** Los que abrian PowerPoint el 02/10/2026. Si alguno se borra o se muda, sale de la lista. */
const CONOCIDOS = [
    'scripts/hotmelt/falta_filmar_hotmelt.py', 'scripts/hotmelt/generar_hojas_hotmelt.py',
    'scripts/hotmelt/generar_hojas_hotmelt_a3.py', 'scripts/hotmelt/pptx2png.py',
    'scripts/img/exportar_png.py', 'scripts/img/falta_filmar.py',
    'scripts/lamina_proceso/exportar.py', 'scripts/scratch/_numerarHojasGamboa.py',
    'scripts/tryout/export.py', 'scripts/tryout/pdf.py', 'scripts/tryout/pdf6.py',
    'scripts/tryout/render6.py', 'scripts/tryout/verificar.py', 'scripts/tryout/verificar6.py',
];

describe('powerpointQuit — los .py del repo', () => {
    const { abren, quits, hallazgos } = barrer(RAIZ);

    it('el barrido encuentra los scripts que abren PowerPoint y les lee el Quit (no pasa por barrer cero)', () => {
        expect(pysDelRepo(RAIZ).length).toBeGreaterThan(100);
        const estan = CONOCIDOS.filter((p) => fs.existsSync(path.join(RAIZ, p)));
        expect(estan.length).toBeGreaterThanOrEqual(10);
        expect(estan.filter((p) => !abren.includes(p)), 'abren PowerPoint y el barrido no los vio').toEqual([]);
        expect(estan.filter((p) => !(quits[p] >= 1)), 'tienen un Quit y el barrido no se lo leyo').toEqual([]);
    });

    it('no entra a las carpetas de one-shots archivados', () => {
        expect(EXCLUIDAS).toEqual(['scripts/_archive/', 'scripts/archive/']);
        expect(pysDelRepo(RAIZ).filter((p) => EXCLUIDAS.some((x) => p.startsWith(x)))).toEqual([]);
    });

    it('el patron de referencia (scripts/img/exportar_png.py) da verde y tiene un Quit que leer', () => {
        const fuente = fs.readFileSync(path.join(RAIZ, 'scripts/img/exportar_png.py'), 'utf8');
        expect(quitsDePowerPoint(fuente).map((q) => q.falta)).toEqual(['']);
    });

    it('ninguno cierra PowerPoint sin el resguardo', () => {
        const lista = hallazgos.map((h) => `${h.archivo}:${h.linea} — ${h.receptor}.Quit: ${h.falta}`);
        expect(lista, 'PowerPoint es de una sola instancia: este Quit le cierra a Fak el deck que tenga abierto. '
            + 'Patron: `habia_abiertas = ppt.Presentations.Count` antes de abrir, y '
            + '`if habia_abiertas == 0 and ppt.Presentations.Count == 0: ppt.Quit()` (scripts/img/exportar_png.py)').toEqual([]);
    });
});

"""
_xlsxAPdf.py — convierte .xlsx a PDF con Excel, y VERIFICA la copia resultante.

Por que existe y por que verifica tanto (lecciones del 14/08/2026):
  - Un EXCEL.EXE colgado de una corrida anterior deja el archivo tomado: la exportacion
    falla en silencio y queda en disco el PDF VIEJO, que despues se da por bueno.
    -> se BORRA el destino antes de generar; si falla, el archivo FALTA y se nota.
  - `ExportAsFixedFormat` no siempre lanza cuando el destino esta tomado.
    -> despues de generar se re-lee el PDF y se cuentan paginas y bytes.
  - Excel COM con argumentos NOMBRADOS se comporta distinto que con posicionales.
    -> todo posicional.

El unico borrado que hace es el del PDF que va a regenerar en la MISMA carpeta de trabajo,
y lo hace despues de imprimir el plan con el conteo (guard de borrado masivo, 07/08/2026).
Nunca toca otra carpeta ni otra extension.

Uso:  python scripts/_xlsxAPdf.py <carpeta_con_xlsx>            (dry-run: solo muestra el plan)
      python scripts/_xlsxAPdf.py <carpeta_con_xlsx> --apply
"""
import os
import sys
import glob

try:
    import win32com.client as win32
except ImportError:
    sys.exit('ERROR: falta pywin32 (win32com). No se puede convertir sin Excel.')


def chequear_excel_abierto():
    """
    Si Fak tiene Excel abierto con trabajo sin guardar, ABORTA en vez de matarlo.

    La primera version arrancaba con `taskkill /F /IM EXCEL.EXE`, que no distingue el Excel
    huerfano de una corrida anterior del Excel que Fak esta usando: le habria volado una
    planilla del arb sin guardar y sin preguntar. Ahora se mira antes de tocar nada.
    """
    try:
        app = win32.GetObject(Class='Excel.Application')
    except Exception:                                          # noqa: BLE001
        return  # no hay ninguna instancia: camino limpio

    sin_guardar = []
    try:
        for wb in app.Workbooks:
            if not wb.Saved:
                sin_guardar.append(wb.Name)
    except Exception:                                          # noqa: BLE001
        sin_guardar = ['(no se pudo leer la lista de libros)']

    if sin_guardar:
        print('ABORTADO: hay Excel abierto con cambios sin guardar.')
        for n in sin_guardar:
            print(f'  - {n}')
        print('Guardalos y cerra Excel, despues volve a correr esto.')
        sys.exit(1)
    # Hay Excel abierto pero todo guardado: se usa esa instancia, no se mata nada.


def paginas_pdf(ruta):
    """
    Cuenta paginas ABRIENDO el PDF, no contando bytes.

    El primer intento fue `crudo.count(b'/Type /Page')` sobre el binario y daba 0 en los 8
    archivos, con los PDF perfectamente bien: Excel guarda los objetos en streams
    comprimidos, asi que esa marca no aparece en texto plano. Un control que da cero para
    todos los casos no esta detectando nada, esta roto (17/08/2026).
    """
    import fitz  # PyMuPDF
    with fitz.open(ruta) as doc:
        return doc.page_count


def configurar_pagina(wb):
    """
    A4 apaisado y ajustado a UNA pagina de ancho, que es como sale el AMFE oficial.

    Sin esto el AMFE del apoyabrazos salia en 74 paginas verticales en vez de las 8
    apaisadas del documento que se entrego el 14/08: la tabla es ancha y, sin ajuste,
    Excel la parte en columnas sueltas y el PDF queda inusable.
    `Zoom = False` es imprescindible — si Zoom tiene un valor, FitToPages se ignora.
    """
    for i in range(1, wb.Sheets.Count + 1):
        ps = wb.Sheets(i).PageSetup
        ps.Orientation = 2        # xlLandscape
        ps.PaperSize = 9          # xlPaperA4
        ps.Zoom = False
        ps.FitToPagesWide = 1
        ps.FitToPagesTall = False


def armar_plan(carpeta):
    # `abspath` no es cosmetico: normaliza las barras a `\`. Con barras `/` Excel ABRE el
    # libro pero `ExportAsFixedFormat` no escribe y NO LANZA — falla en silencio y el PDF
    # nunca aparece. Diagnosticado el 17/08/2026.
    carpeta = os.path.abspath(carpeta)
    xlsxs = sorted(os.path.abspath(p) for p in glob.glob(os.path.join(carpeta, '*.xlsx'))
                   if not os.path.basename(p).startswith('~'))
    return [(src, os.path.splitext(src)[0] + '.pdf') for src in xlsxs]


def mostrar_plan(plan, carpeta):
    print(f'CARPETA: {carpeta}')
    print(f'PLAN — {len(plan)} archivo(s) a convertir:\n')
    a_pisar = 0
    for src, dst in plan:
        existe = os.path.exists(dst)
        if existe:
            a_pisar += 1
        marca = 'REEMPLAZA' if existe else 'nuevo    '
        print(f'  {marca}  {os.path.basename(src)}')
        print(f'             -> {os.path.basename(dst)}')
    print(f'\n  TOTAL: {len(plan)} a convertir, {a_pisar} PDF existente(s) que se regeneran.')
    print('  (solo se toca esta carpeta, solo extension .pdf)')


def convertir(plan):
    chequear_excel_abierto()
    excel = win32.Dispatch('Excel.Application')
    excel.Visible = False
    excel.DisplayAlerts = False

    ok, fallos = [], []
    try:
        for src, dst in plan:
            # Borrar ANTES: si la generacion falla, tiene que FALTAR el archivo,
            # no sobrevivir el de la corrida anterior.
            if os.path.exists(dst):
                try:
                    os.remove(dst)
                except OSError as e:
                    fallos.append((os.path.basename(src), f'no se pudo borrar el PDF previo: {e}'))
                    continue

            wb = None
            try:
                wb = excel.Workbooks.Open(src, False, True)   # posicionales
                configurar_pagina(wb)
                wb.ExportAsFixedFormat(0, dst)                # 0 = xlTypePDF
            except Exception as e:                            # noqa: BLE001
                fallos.append((os.path.basename(src), str(e)))
                continue
            finally:
                if wb is not None:
                    wb.Close(False)

            # Verificar la COPIA, no el hecho de haber llamado a la API.
            if not os.path.exists(dst):
                fallos.append((os.path.basename(src), 'el PDF no quedo en disco'))
                continue
            bytes_pdf = os.path.getsize(dst)
            if bytes_pdf < 20000:
                fallos.append((os.path.basename(dst), f'PDF sospechosamente chico: {bytes_pdf} b'))
                continue
            try:
                paginas = paginas_pdf(dst)
            except Exception as e:                            # noqa: BLE001
                fallos.append((os.path.basename(dst), f'no se pudo releer: {e}'))
                continue
            if paginas < 1:
                fallos.append((os.path.basename(dst), 'PDF sin paginas'))
                continue
            ok.append((os.path.basename(dst), bytes_pdf, paginas))
    finally:
        excel.Quit()
        del excel

    print(f'\n=== CONVERTIDOS {len(ok)}/{len(plan)} ===')
    for nombre, b, pg in ok:
        print(f'  OK  {pg:>3} pag  {b:>9,} b  {nombre}')
    if fallos:
        print(f'\n=== FALLARON {len(fallos)} ===')
        for nombre, err in fallos:
            print(f'  FALLO  {nombre}: {err}')
        sys.exit(1)
    print('\nTodos los PDF generados y releidos OK.')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('Uso: python scripts/_xlsxAPdf.py <carpeta_con_xlsx> [--apply]')
    carpeta = sys.argv[1]
    plan = armar_plan(carpeta)
    if not plan:
        sys.exit(f'ERROR: no hay .xlsx en {carpeta}')
    mostrar_plan(plan, carpeta)
    if '--apply' not in sys.argv:
        print('\nDRY-RUN. Agrega --apply para convertir.')
        sys.exit(0)
    convertir(plan)

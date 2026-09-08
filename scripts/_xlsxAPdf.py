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


def configurar_pagina(wb, bloques_por_hoja=None):
    """
    A4 apaisado y ajustado a UNA pagina de ancho, que es como sale el AMFE oficial.

    Sin esto el AMFE del apoyabrazos salia en 74 paginas verticales en vez de las 8
    apaisadas del documento que se entrego el 14/08: la tabla es ancha y, sin ajuste,
    Excel la parte en columnas sueltas y el PDF queda inusable.
    `Zoom = False` es imprescindible — si Zoom tiene un valor, FitToPages se ignora.

    La CARATULA es la excepcion: es un formulario de una sola hoja (I-AC-005.3), asi que va
    ajustada tambien a UNA pagina de alto. Fak, 08/09/2026: *"intentemos que las revisiones
    solo ocupen una hoja"*. Ajustar el alto es lo unico que lo garantiza sin recortar texto:
    achicar filas o dejar menos renglones libres CORTA lo que no entra, que es justo lo que
    el habia visto ("termino todo bastante cortado, eso no puede pasar"). Con el AMFE 158
    la caratula mide 595 pt contra ~487 utiles: Excel la imprime al 82%, que se lee.
    """
    for i in range(1, wb.Sheets.Count + 1):
        hoja = wb.Sheets(i)
        ps = hoja.PageSetup
        ps.Orientation = 2        # xlLandscape
        ps.PaperSize = 9          # xlPaperA4
        ps.Zoom = False
        ps.FitToPagesWide = 1
        es_caratula = str(hoja.Name).strip().lower().startswith('caratula')
        ps.FitToPagesTall = 1 if es_caratula else False
        # Ningun salto de pagina puede caer adentro de una celda combinada: Excel la corta.
        if not es_caratula and bloques_por_hoja:
            # `HPageBreaks` viene VACIO hasta que Excel pagina, y con el libro abierto sin
            # ventana no pagina solo. Preguntar `Pages.Count` es lo que lo obliga: sin esta
            # linea el ajuste no hacia nada y no daba ningun error (visto el 08/09/2026).
            try:
                _ = ps.Pages.Count
            except Exception:                                 # noqa: BLE001
                pass
            acomodar_saltos(hoja, bloques_por_hoja.get(str(hoja.Name), []))



# Alto util de una A4 apaisada con los margenes que usa este script (0,75" arriba y abajo):
# 595,32 pt de hoja menos 108 pt de margenes. Se usa como cota CONSERVADORA: el documento va
# escalado a un ancho de pagina, y al achicarse entran mas puntos de fila por hoja, no menos.
ALTO_UTIL_PT = 487.0


def bloques_combinados(ruta_xlsx, alto_max_pt=ALTO_UTIL_PT):
    """
    Por hoja, los rangos de filas de las celdas COMBINADAS que ENTRAN en una pagina.

    Se leen del xlsx con openpyxl y no por COM: por COM habria que preguntarle `MergeArea`
    a cada celda del rango usado (miles de llamadas), y el dato es el mismo.

    Se descartan los bloques mas altos que una hoja. En el AMFE la columna de operacion se
    combina sobre TODA la operacion —hay uno de 92 filas— y ese bloque se va a partir haga
    lo que haga: adelantarle el salto no lo salva, tira el documento entero a una sola
    pagina. El que se puede salvar es el bloque chico que quedo a caballo del salto.
    """
    import openpyxl
    libro = openpyxl.load_workbook(ruta_xlsx, data_only=True)
    try:
        salida = {}
        for hoja in libro.worksheets:
            alto = lambda f: (hoja.row_dimensions[f].height or 15)
            rangos = set()
            for m in hoja.merged_cells.ranges:
                if m.max_row <= m.min_row:
                    continue
                if sum(alto(f) for f in range(m.min_row, m.max_row + 1)) <= alto_max_pt:
                    rangos.add((m.min_row, m.max_row))
            salida[hoja.title] = sorted(rangos)
        return salida
    finally:
        libro.close()


def acomodar_saltos(hoja_com, bloques, tope=200):
    """
    Adelanta los saltos de pagina que caen adentro de un bloque combinado.

    Excel expone en `HPageBreaks` los saltos que calculo. Si uno cae en la fila r y hay un
    bloque combinado (a..b) con a < r <= b, ese bloque queda partido y Excel RECORTA lo que
    no entro. Se agrega un salto manual antes de la fila `a`, con lo que el bloque entero
    arranca la pagina nueva. Cada salto agregado corre los siguientes, asi que se repite
    hasta que ninguno parta nada (`tope` es la red por si algo no converge).

    Devuelve cuantos saltos se movieron.
    """
    if not bloques:
        return 0

    def saltos():
        # Dos cosas que Excel hace y que rompen el ajuste si no se las tiene en cuenta:
        #   - despues de un `Add`, la lista de saltos queda con SOLO los manuales hasta que
        #     el libro se vuelve a paginar. Preguntar `Pages.Count` es lo que lo obliga; sin
        #     esta linea el bucle creia haber terminado en la primera vuelta.
        #   - reusar el handle de la coleccion despues de un `Add` tira un COM error.
        # Las dos se vieron el 08/09/2026 y las dos fallaban EN SILENCIO.
        try:
            _ = hoja_com.PageSetup.Pages.Count
        except Exception:                                     # noqa: BLE001
            pass
        hb = hoja_com.HPageBreaks
        filas = []
        for i in range(1, hb.Count + 1):
            try:
                filas.append(hb.Item(i).Location.Row)
            except Exception:                                 # noqa: BLE001
                break
        return filas

    movidos = 0
    puestos = set()
    for _ in range(tope):
        filas = saltos()
        partido = next(((r, a) for r in filas for (a, b) in bloques
                        if a < r <= b and a > 1 and a not in puestos), None)
        if partido is None:
            return movidos
        _, inicio = partido
        try:
            hoja_com.HPageBreaks.Add(hoja_com.Rows(inicio))
        except Exception:                                     # noqa: BLE001
            return movidos
        puestos.add(inicio)
        movidos += 1
    return movidos


def texto_recortado(ruta_xlsx, ruta_pdf, tope=12):
    """
    Celdas cuyo texto esta en el xlsx pero NO en el PDF: salieron recortadas al imprimir.

    Existe porque el recorte es INVISIBLE en el Excel. El 08/09/2026 la caratula del AMFE
    158 se entrego con el DETALLES terminando en "TOMADAS DE LA HO-": en la celda estaba el
    texto completo y el unico lugar donde se veia el problema era el PDF. "Eso no puede
    pasar" (Fak). Comparar contra el PDF es la unica verificacion que mira lo que se entrega.

    Dos causas conocidas de recorte, las dos reales:
      - alto de fila insuficiente para el texto con wrap (se arregla estimando bien el alto);
      - celda COMBINADA que cae sobre un salto de pagina: Excel la corta y no la continua.

    Se comparan los textos sin espacios: el PDF parte las lineas donde quiere.
    """
    import re
    import openpyxl
    import fitz

    norma = lambda s: re.sub(r'\s+', '', str(s)).upper()
    with fitz.open(ruta_pdf) as doc:
        pdf = norma(''.join(pagina.get_text() for pagina in doc))

    faltantes = []
    libro = openpyxl.load_workbook(ruta_xlsx, data_only=True)
    try:
        for hoja in libro.worksheets:
            for fila in hoja.iter_rows():
                for celda in fila:
                    v = celda.value
                    if v is None or not str(v).strip():
                        continue
                    if norma(v) not in pdf:
                        faltantes.append((hoja.title, celda.coordinate, str(v)))
    finally:
        libro.close()
    return faltantes[:tope], len(faltantes)


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

    ok, fallos, recortes = [], [], []
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
                configurar_pagina(wb, bloques_combinados(src))
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
            try:
                muestra, cuantas = texto_recortado(src, dst)
            except Exception as e:                            # noqa: BLE001
                muestra, cuantas = [], -1
                print(f'  (no se pudo cruzar el texto de {os.path.basename(dst)}: {e})')
            if cuantas > 0:
                recortes.append((os.path.basename(dst), cuantas, muestra))
            ok.append((os.path.basename(dst), bytes_pdf, paginas))
    finally:
        excel.Quit()
        del excel

    print(f'\n=== CONVERTIDOS {len(ok)}/{len(plan)} ===')
    for nombre, b, pg in ok:
        print(f'  OK  {pg:>3} pag  {b:>9,} b  {nombre}')
    if recortes:
        print('\n=== TEXTO QUE NO LLEGO AL PDF ===')
        print('  (esta en la celda pero no se imprime: alto de fila corto, o celda combinada')
        print('   partida por un salto de pagina — Excel la corta y no la continua)')
        for nombre, cuantas, muestra in recortes:
            print(f'  {nombre}: {cuantas} celda(s)')
            for hoja, coord, txt in muestra:
                print(f'      {hoja}!{coord}  {txt[:80]}')

    if fallos:
        print(f'\n=== FALLARON {len(fallos)} ===')
        for nombre, err in fallos:
            print(f'  FALLO  {nombre}: {err}')
        sys.exit(1)
    if recortes:
        print('\nPDF generados, pero HAY TEXTO RECORTADO (ver arriba): revisar antes de entregar.')
    else:
        print('\nTodos los PDF generados y releidos OK, y ninguna celda salio recortada.')


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

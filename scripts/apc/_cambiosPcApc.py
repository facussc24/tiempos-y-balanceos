"""
_cambiosPcApc.py — hoja simple con los cambios del plan de control de los apoyacabezas Patagonia
(Rev 0 de Calidad -> propuesta de Ingenieria del 15/10/2026), para mandar junto con el Excel.

Fak, 15/10/2026: "arma un archivo que se entienda facil que cambiamos y porque". Va a Calidad (A. Aguayo,
N. Perez, M. Meszaros, C. Rodriguez): palabras de planta, cada cambio con su papel, sin citar normas y sin
contar como se llego a cada error (regla core-prohibiciones §1 y memoria mails a Calidad sin flancos).

Uso:  python scripts/apc/_cambiosPcApc.py <carpeta_salida>   -> .xlsx + .pdf
"""
import os
import sys

from openpyxl import Workbook
from openpyxl.drawing.image import Image
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

LOGO = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    'tools', 'flowchart', 'assets', 'barack_logo.png')
NOMBRE = 'Cambios plan de control apoyacabezas Patagonia 15-10-2026'

CAMBIOS = [
    ('General', 'Numeración 10 - 20 - 30 - 40 - 50 - 80 - 100',
     'Numeración del flujograma 152 Rev. A: 10, 20, 21, 22, 30, 31, 32, 40, 41, 42, 50, 51, 52, 60, 70, 71, 72, 80',
     'Para que coincida con el flujograma y con los AMFE 151, 153 y 155'),
    ('General', 'Varias características en la misma fila',
     'Una característica por fila, con su marca SC o D (en rojo)',
     'Como el resto de los planes de control. Las marcas salen de los AMFE'),
    ('Encabezado', 'Característica S/R con SI y NO marcados. N° de parte vacío',
     'S/R: SI. N° de parte con los cuatro códigos de cada pieza',
     'Los AMFE tienen características D (flamabilidad, emisiones)'),
    ('10 Recepción', '11 materiales en el delantero y 10 en los traseros. Poliol POLI-PLUS FF 629 e isocianato ISO-PLUS 1290',
     '17 materiales en el delantero y 16 en los traseros: se suman embudo PIP, bolsa de inyección, precinto, bolsa de '
     'embalaje y etiquetas. '
     'Poliol POLI-PLUS FF636 e isocianato ISO-PLUS 1355',
     'Son los materiales y componentes cargados en la BOM del arb (29/09/2026)'),
    ('10 Recepción vinilos', 'Vinilo "PVC 1,1 + PU 1,0". Espesor "2,1 +/-" y gramaje 800 a 1000 g/m²',
     'Vinilo PVC 1 mm + espuma PU 4,5 mm. Espesor total 5,05 a 6,15 mm, gramaje 1022 a 1249 g/m², ancho mínimo 1400 mm, '
     'flamabilidad < 100 mm/min',
     'Es el vinilo que Sansuy recomendó para la inyección (marzo 2026). Valores de su especificación y de los certificados de recepción'),
    ('10 Recepción', 'Hilo de unión FX284TK-E0PTO',
     'Hilo de unión FX284-E0PTO', 'Es el código de la aprobación de pieza de Linhanyl, del arb y del plan de recepción 1043'),
    ('10 Recepción', 'Hilos y astas con controles generales',
     'Hilos y astas con las características de sus planes de recepción (hilos 1043, 1062, 1063, 1064; '
     'astas 1063, 1064, 1065)', 'Para que coincida con lo que controla recepción'),
    ('20 a 22 Corte', 'Una sola operación. Cuchilla con calibre MC 212 al inicio de turno',
     '20 Preparación y carga de vinilo · 21 Corte automático · 22 Control con Mylar (± 1 mm). '
     'Cuchilla 4 mm mínimo con calibre MC167 antes de cada corte',
     'Según las hojas de operaciones 968, 969 y 970'),
    ('30 Refilado', "'Operación 30 y 30,2'",
     'Operación 30 Refilado de componentes cortados (sector costura): set up de la refiladora y ancho 10 ± 2 mm con regla MC 310; '
     'vinilo sin dañar contra patrón', 'Está en el flujograma y en el AMFE'),
    ('31 Costura unión', 'Margen y aguja en TBD. Sin atraque',
     'Toma 8 ± 1 mm en vinilo y 8 ± 2 mm en tela. 4 puntadas en 16 mm (± 1). Atraque de 3 a 4 puntadas. '
     'Aguja N° 18', 'Valores de costura de Patagonia y hojas de operaciones'),
    ('32 Costura vista', 'Era la 40. Filas escritas como defectos, sin medida',
     'Separación al borde 4 ± 1 mm. 4 puntadas en 16 mm (± 1). Color del hilo según versión, el L0 con hilo negro '
     'FX483TK-E0PTO. Aguja N° 22', 'Valores de costura de Patagonia. El L0 lleva costura decorativa negra desde el pedido de Leo Lattanzi (05/08/2026)'),
    ('40 a 51 Tapizado y carga del molde', 'No estaban',
     'Una fila por operación con lo que la hoja manda verificar (funda asentada, vinilo sobre la varilla, precinto, '
     'bolsa y boquilla)', 'Están en el flujograma y en las hojas de operaciones'),
    ('52 Inyección PU', "Era la 50: 'Ver hoja de set up'",
     'Parámetros a controlar: temperatura de poliol e isocianato, caudal, relación de mezcla, peso del shot, tiempo de '
     'inyección, temperatura del molde, tiempo de curado, ambiente y agitación. Verificación de las alarmas de la máquina',
     'Variables que se registran en las pruebas de la PIP y controles del AMFE. Los valores faltan (ver abajo)'),
    ('60 Control final', "Era la 80: '5 piezas por lote de inyección de sustrato plástico', Metrología",
     'Primera pieza contra calibre de forma MC506 (delantero), MC507 (trasero central) y MC508 (trasero lateral). '
     'Aspecto según biblia de defectos y pieza patrón. Etiqueta de trazabilidad',
     'Según la hoja de operaciones (pestaña 60) y el cronograma de calibración'),
    ('70 a 72 Reprocesos', 'No estaban', 'Agregados. Puntada floja con el método de la aguja',
     'Están en el flujograma'),
    ('80 Embalaje', "Era la 100: 'Según hoja de operaciones'",
     '48 piezas por bin en los tres: delantero en bin plástico verde (GE-103), traseros en bin azul metálico (GE-104 y GE-105). '
     'Bolsa individual, etiqueta por pieza y láminas de cartón; las astas no tocan la zona vista',
     'Fichas de embalaje Rev. D'),
    ('Test de lay out', 'Solo PV 2005', 'Se suman compresión PV 3410, flamabilidad y emisiones, y dimensional anual',
     'Pedido de VW en la auditoría de 2025'),
]

FALTA = [
    'Valores de la inyección PU (temperaturas, caudal, relación, shot, tiempos): pedir a Lattanzi.',
    'Planes de recepción que no encontramos: vinilos Patagonia, tela Rennes, FF636, ISO 1355 y los insumos de la PIP.',
    'Tela Rennes: espesor y gramaje (no encontramos especificación ni certificado).',
    'Cámara de flamabilidad MC184: en el cronograma de calibración figura vencida desde el 11/09/2026.',
    'Calibre MC212 (espesor en recepción): en el cronograma está asignado a Conversión de Cintas. Confirmar qué calibre usa recepción.',
]


def main():
    salida = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
    os.makedirs(salida, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = 'Cambios'
    fino = Side(style='thin', color='808080')
    borde = Border(left=fino, right=fino, top=fino, bottom=fino)
    azul = PatternFill('solid', fgColor='1F3864')
    for col, ancho in zip('ABCD', (20, 38, 62, 42)):
        ws.column_dimensions[col].width = ancho
    if os.path.exists(LOGO):
        img = Image(LOGO)
        img.height, img.width = 38, 38 * img.width / img.height
        ws.add_image(img, 'A1')
    ws.row_dimensions[1].height = 32
    ws['B1'] = 'Plan de control apoyacabezas Patagonia — cambios sobre la Rev 0'
    ws['B1'].font = Font(name='Arial', size=13, bold=True)
    ws['B2'] = 'Delantero, trasero central y trasero lateral · 15/10/2026'
    ws['B2'].font = Font(name='Arial', size=10)
    fila = 4
    for i, t in enumerate(('Operación', 'Qué había en la Rev 0', 'Cómo queda', 'Por qué')):
        c = ws.cell(fila, i + 1, t)
        c.font = Font(name='Arial', size=10, bold=True, color='FFFFFF')
        c.fill = azul
        c.alignment = Alignment(vertical='center', wrap_text=True)
        c.border = borde
    for cambio in CAMBIOS:
        fila += 1
        for i, t in enumerate(cambio):
            c = ws.cell(fila, i + 1, t)
            c.font = Font(name='Arial', size=9, bold=(i == 0))
            c.alignment = Alignment(vertical='top', wrap_text=True)
            c.border = borde
        largo = max(len(cambio[2]) / 60, len(cambio[1]) / 36, len(cambio[3]) / 40)
        ws.row_dimensions[fila].height = max(15, 12.5 * (int(largo) + 1))
    fila += 2
    ws.cell(fila, 1, 'Lo que falta definir').font = Font(name='Arial', size=11, bold=True)
    for t in FALTA:
        fila += 1
        ws.cell(fila, 1, '•').alignment = Alignment(horizontal='right', vertical='top')
        c = ws.cell(fila, 2, t)
        c.font = Font(name='Arial', size=9)
        ws.merge_cells(start_row=fila, start_column=2, end_row=fila, end_column=4)
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    wb.properties.creator = 'Facundo Santoro'
    wb.properties.lastModifiedBy = 'Facundo Santoro'
    destino = os.path.join(salida, NOMBRE + '.xlsx')
    wb.save(destino)
    exportar_pdf(destino)
    print(destino)


def exportar_pdf(xlsx):
    """Una sola hoja A4 apaisada (el _xlsxAPdf.py del repo deja libre el alto, pensado para hojas de proceso)."""
    import win32com.client as win32
    pdf = os.path.splitext(xlsx)[0] + '.pdf'
    if os.path.exists(pdf):
        os.remove(pdf)
    xl = win32.DispatchEx('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(xlsx, 0, True)
        ps = wb.Worksheets(1).PageSetup
        ps.Zoom = False
        ps.FitToPagesWide = 1
        ps.FitToPagesTall = 1
        wb.Worksheets(1).ExportAsFixedFormat(0, pdf)
        wb.Close(False)
    finally:
        xl.Quit()
    if not os.path.exists(pdf):
        raise RuntimeError('no se genero el PDF')


if __name__ == '__main__':
    main()

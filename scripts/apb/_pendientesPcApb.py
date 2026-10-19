"""
_pendientesPcApb.py — hoja simple que acompaña la propuesta del plan de control del APB trasero central
Patagonia (19/10/2026): lo que falta definir para que el plan quede definitivo, separado por quien lo tiene
que contestar, y aparte la propuesta de siglas del AMFE 150 (para Fak, que es quien las asigna).

Palabras de planta, cada punto con su papel, sin contar como se llego a cada diferencia
(core-prohibiciones §1; memoria mails a Calidad sin flancos).

Uso:  python scripts/apb/_pendientesPcApb.py <carpeta_salida> <amfe150.json>   -> .xlsx + .pdf (y la propuesta de siglas .xlsx)
"""
import json
import os
import sys

from openpyxl import Workbook
from openpyxl.drawing.image import Image
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

LOGO = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    'tools', 'flowchart', 'assets', 'barack_logo.png')
NOMBRE = 'Pendientes plan de control APB trasero central Patagonia 19-10-2026'
NOMBRE_SIGLAS = 'Propuesta de siglas AMFE 150 APB trasero central 19-10-2026'

# (para quien, operacion, que falta, de donde sale lo que hay hoy)
PENDIENTES = [
    ('Calidad', '10 Recepción', 'Plan de recepción del vinilo Sansuy 197.025.0425-6 (TIPO IV IS LE 1,10 mm): tolerancia de espesor y gramaje',
     'No hay plan de recepción de este código. Hoy el plan usa los instrumentos del AMFE y los datos de la BOM (1,10 mm de espesor, rollo de 1,40 m); '
     'flamabilidad < 100 mm/min como en los planes de recepción de vinilos Sansuy'),
    ('Calidad', '10 Recepción', 'Planes de recepción de los fieltros 427TEL003COR01 y RES30020TIT, del Aplix APLIX_225LLB, del cierre 427VAR001COS01 y de la cinta sarga 5825',
     'No hay planes de estos códigos. El plan usa los valores del AMFE (480 g/m², 270 a 320 g/m², cierre 360 ± 1 mm)'),
    ('Calidad', '10 Recepción', 'Controles de recepción de los consignados de VW (estructura 2HC.885.925, posavasos 2HC.885.119, marco 2HC.885.725, tornillo 2HC.075.701.GS)',
     'No hay planes de estos códigos. El plan usa los controles del AMFE; el marco no tiene control en el AMFE y su aspecto queda TBD'),
    ('Calidad', '10 Recepción', 'Poliol FF-629: el plan de recepción 822 no tiene unidades en viscosidad, densidad y tiempos, y dice vencimiento "según certificado" '
     '(el AMFE pide vida útil remanente de 6 meses). Isocianato 1394: el 819 escribe la densidad en "gr/m³"', 'Planes de recepción 822 y 819 Rev. B'),
    ('Calidad', 'Instrumentos', 'Cámara de flamabilidad MC184 vencida desde el 11/09/2026 y calibre MC413 de recepción vencido desde el 08/07/2026',
     'Cronograma de calibración 2026 Rev. 7'),
    ('Calidad', 'Instrumentos', 'Códigos MC de la regla de costura, la plantilla Mylar del APB trasero central, el calibre de tapizado, la regla de largo de capa, '
     'las balanzas (recepción y pieza espumada), el termómetro y los calibres de la cinta',
     'No figuran en el cronograma 2026 Rev. 7 asignados a esta pieza. Sí está el calibre de forma MC505 (APB TAPA PATAGONIA); '
     'la balanza MC481 está en inyección VWA sin pieza asignada'),
    ('Calidad', '40, 50 y 60', 'Frecuencia y registro de los valores medibles (margen, puntadas, peso): el plan los deja en 100 % de autocontrol, como la hoja '
     'de operaciones 986 y el plan Rev. 1', 'VW pidió en su auditoría VDA 6.3 que se registren los valores medibles de costura'),
    ('Calidad', 'Encabezado', 'Número de plan, letra de revisión, equipo y contacto', 'La revisión es sobre el plan Rev. 1 del 31/07/2026'),
    ('Calidad', 'Lay out', 'Cotas del plano y ensayos de VW para el test de lay out anual', 'Plano del cliente y requisitos de VW'),
    ('Calidad', '80 y 82 Retrabajos', 'Si VW aprobó los retrabajos de la pieza', 'Los retrabajos están en el flujograma 151, el AMFE 150 y la hoja de operaciones 986'),
    ('Leo Lattanzi', '50 Inyección PU', 'Tolerancias del tiempo de colada, el caudal y las presiones; temperatura de poliol, isocianato y molde',
     'Validación de espumado de marzo 2026: programa N° 9, colada 7,00 s, caudal 4,00 kg/min, relación 200/40, presión 0,8 / 1,3 bar, corrección 100 % / 65 %'),
    ('Leo Lattanzi', '50 Inyección PU', 'Peso de la pieza espumada con su tolerancia', 'Validación de marzo 2026: una pieza pesó 1.608 g'),
    ('Planta', '20 Corte', 'Valores de velocidad de la máquina y tensión del vinilo', 'La hoja de operaciones nombra un instructivo de parámetros por producto'),
    ('Planta', '40 / 50', 'Número de la máquina de coser y de la inyectora', 'Para completar la columna de máquina (la mesa de corte es la BM 149)'),
    ('Planta', '60 Tapizado', 'Temperatura y tiempo del horno', 'El set up del horno lo nombran la hoja de operaciones 986, el AMFE 150 y el plan Rev. 1, sin valores'),
    ('Planta', '80 Retrabajo', 'Largo máximo del hilo sobrante', 'El AMFE pide definirlo en la instrucción de retrabajo'),
    ('Ingeniería', 'Hoja de operaciones 986', 'Embalaje: la hoja dice 126 piezas por medio 111970; la ficha vigente GE-102 Rev. C dice 30 piezas por cajón CKV3755',
     'El plan va con la GE-102 Rev. C (07/10/2026)'),
    ('Ingeniería', 'Hoja de operaciones 986', 'Hojas 30, 80 y 82 sin ciclo de control; hoja 40 sin el control de puntadas y margen; peso de la hoja 50 en TBD',
     'El plan ya tiene esos controles'),
    ('Ingeniería', 'AMFE 150', 'Códigos que no coinciden con la BOM del arb: hilo FX284TK-E0PTO (arb: FX284-E0PTO), cinta 5826 de 25 mm (arb: 5825 de 24 mm), '
     'fieltros PA3840 y 427VIN026COR01 (arb: 427TEL003COR01 y RES30020TIT)', 'BOM arb último nivel del 22/09/2026'),
    ('Ingeniería', 'AMFE 150', 'Op 10 nombra "tela tapizado"; la BOM no tiene tela (el tapizado es el vinilo)', 'BOM arb último nivel del 22/09/2026'),
    ('Ingeniería', 'AMFE 150', 'Op 40 tiene modos de falla de costura vista y de dobladillo; la pieza no lleva costura vista. '
     'Op 40 tiene "sellado del orificio inferior" en la máquina de coser (es de la op 50)', 'Especificación de costura y cinta del 05/10/2026'),
    ('Ingeniería', 'AMFE 150', 'Op 90 dice "apoyacabezas" en la prevención del embalaje; op 50 nombra un "inserto EPP"; op 20 tiene una causa de '
     '"instrucción del reproceso"', 'La pieza no lleva inserto EPP (BOM arb del 22/09/2026)'),
    ('Ingeniería', 'AMFE 150', 'Isocianato: el AMFE pide vida útil remanente de 6 meses desde la recepción; el plan de recepción 819 dice 6 meses desde producido',
     'El plan va con el plan de recepción 819'),
]


def borde():
    s = Side(style='thin', color='999999')
    return Border(left=s, right=s, top=s, bottom=s)


def hoja(ws, titulo, subtitulo, encabezados, filas, anchos):
    azul = PatternFill('solid', fgColor='1F3864')
    for i, w in enumerate(anchos):
        ws.column_dimensions[chr(65 + i)].width = w
    if os.path.exists(LOGO):
        img = Image(LOGO)
        img.height, img.width = 38, 38 * img.width / img.height
        ws.add_image(img, 'A1')
    ws.row_dimensions[1].height = 32
    ws['B1'] = titulo
    ws['B1'].font = Font(name='Arial', size=13, bold=True)
    ws['B2'] = subtitulo
    ws['B2'].font = Font(name='Arial', size=10)
    fila = 4
    for i, t in enumerate(encabezados):
        c = ws.cell(fila, i + 1, t)
        c.font = Font(name='Arial', size=10, bold=True, color='FFFFFF')
        c.fill = azul
        c.alignment = Alignment(vertical='center', wrap_text=True)
        c.border = borde()
    for f in filas:
        fila += 1
        for i, t in enumerate(f):
            c = ws.cell(fila, i + 1, t)
            c.font = Font(name='Arial', size=9, bold=(i == 0))
            c.alignment = Alignment(vertical='top', wrap_text=True)
            c.border = borde()
        largo = max(len(str(t)) / max(anchos[i] * 1.1, 1) for i, t in enumerate(f))
        ws.row_dimensions[fila].height = max(15, 12.5 * (int(largo) + 1))
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True


def siglas(amfe_json):
    """Lo que el criterio de I-AC-005 rev.B marca y el AMFE 150 no tiene asignado (S 9-10 = critica; S 5-8 y O >= 4 = SC)."""
    d = json.load(open(amfe_json, encoding='utf-8'))['data']
    grupos = {}
    for op in d['operations']:
        for we in op.get('workElements', []):
            for fn in we.get('functions', []):
                for fm in fn.get('failures', []):
                    for c in fm.get('causes', []):
                        s = int(c.get('severity') or fm.get('severity') or 0)   # la S de la causa, no la del modo de falla
                        o = int(c.get('occurrence') or 0)
                        if (c.get('specialChar') or '').strip():
                            continue
                        crit = 'Crítica (D)' if s >= 9 else ('SC' if 5 <= s <= 8 and o >= 4 else '')
                        if not crit:
                            continue
                        k = (str(op['opNumber']), fm['description'], crit)
                        grupos.setdefault(k, set()).add((s, o))
    filas = []
    for (op, fm, crit), so in grupos.items():
        filas.append((op, fm, ', '.join(f'S{s} O{o}' for s, o in sorted(so)), crit))
    filas.sort(key=lambda f: (0 if f[3].startswith('Cr') else 1, int(f[0])))
    return filas


def exportar_pdf(xlsx):
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
        ps.FitToPagesTall = False
        wb.Worksheets(1).ExportAsFixedFormat(0, pdf)
        wb.Close(False)
    finally:
        xl.Quit()
    if not os.path.exists(pdf):
        raise RuntimeError('no se genero el PDF')


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    salida, amfe_json = os.path.abspath(sys.argv[1]), sys.argv[2]
    os.makedirs(salida, exist_ok=True)

    wb = Workbook()
    ws = wb.active
    ws.title = 'Pendientes'
    hoja(ws, 'Plan de control APB trasero central Patagonia — lo que falta definir',
         '2HC.885.081 RL1 · propuesta de Ingeniería del 19/10/2026', ('Quién', 'Operación', 'Qué falta', 'Lo que hay hoy'),
         PENDIENTES, (14, 18, 62, 62))
    wb.properties.creator = 'Facundo Santoro'
    wb.properties.lastModifiedBy = 'Facundo Santoro'
    destino = os.path.join(salida, NOMBRE + '.xlsx')
    wb.save(destino)
    exportar_pdf(destino)
    print(destino)

    wb = Workbook()
    ws = wb.active
    ws.title = 'Propuesta de siglas'
    filas = siglas(amfe_json)
    hoja(ws, 'AMFE 150 APB trasero central — siglas que marca el criterio y no están asignadas',
         'Criterio I-AC-005 rev.B: S 9 o 10 = crítica (D); S 5 a 8 con O 4 o más = SC. Las asigna Fak.',
         ('Op', 'Modo de falla', 'S y O de sus causas', 'El criterio marca'), filas, (6, 80, 22, 16))
    wb.properties.creator = 'Facundo Santoro'
    wb.properties.lastModifiedBy = 'Facundo Santoro'
    destino = os.path.join(salida, NOMBRE_SIGLAS + '.xlsx')
    wb.save(destino)
    print(destino, len(filas), 'modos de falla')


if __name__ == '__main__':
    main()

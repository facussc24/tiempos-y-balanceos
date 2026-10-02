# -*- coding: utf-8 -*-
"""
plan_medicion_hilos.py - arma la planilla y el PowerPoint del plan de medicion de consumo de hilos.

Uso:
    python scripts/hilos/plan_medicion_hilos.py <carpeta de salida> [--capturas <carpeta con los png>]

Datos:
    base_20261002.json   foto del 02/10/2026: piezas del programa de Costura (semanas 40 y 41) con los
                         hilos que tienen en el arb (la arma el cruce programa x export RELACIONES).
    modelos_costura.py   costuras de cada pieza y hilo de arriba / abajo, segun la hoja de operaciones.

Todos los numeros del PowerPoint los cuenta el codigo a partir de esos dos archivos.
"""
import io
import json
import os
import sys
from collections import OrderedDict

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from modelos_costura import MODELOS, SIN_COSTURA, nombre_tela, rol_del_hilo  # noqa: E402

FECHA = '02/10/2026'
SEMANAS = 'semanas 40 y 41'
PIEZAS_POR_MEDICION = 30
PRIMERO = ('Patagonia', 'Costura Blanco')       # por donde se empieza (Fak, 02/10/2026)
ORDEN_SECTOR = ['Patagonia', 'Costura Blanco', 'Amarok', 'Ford P703', 'P21']
LOGO = os.path.join(AQUI, '..', '..', 'tools', 'flowchart', 'assets', 'barack_logo.png')


# ---------------------------------------------------------------------------- datos

def cargar():
    with io.open(os.path.join(AQUI, 'base_20261002.json'), encoding='utf-8') as fh:
        crudo = json.load(fh)
    base = OrderedDict((b['art'], b) for b in crudo['base'])
    modelos = []
    for m in MODELOS:
        faltan = [p for p in m['piezas'] if p not in base]
        if faltan:
            raise SystemExit('modelo %s: piezas que no estan en el programa: %s' % (m['modelo'], faltan))
        activas = [p for p in m['piezas'] if base[p]['W40'] + base[p]['W41'] > 0]
        modelos.append(dict(m, activas=activas, modelo=m['modelo'] or nombre_tela(activas or m['piezas'])))
    modelos.sort(key=lambda m: ORDEN_SECTOR.index(m['sector']))
    # control: toda pieza del programa con hilo en el arb tiene que estar en un modelo
    en_modelo = {p for m in modelos for p in m['piezas']}
    sueltas = [a for a, b in base.items() if b['hilos'] and a not in en_modelo and b['W40'] + b['W41'] > 0]
    if sueltas:
        raise SystemExit('piezas con hilo y programa que no estan en ningun modelo: %s' % sueltas)
    for a in SIN_COSTURA:
        if base[a]['hilos']:
            raise SystemExit('%s figura sin costura pero tiene hilo en el arb' % a)
    # control: todo articulo con programa esta en un modelo o en la lista de los que no se cosen
    huerfanos = [a for a, b in base.items() if b['W40'] + b['W41'] > 0 and a not in en_modelo and a not in SIN_COSTURA]
    if huerfanos:
        raise SystemExit('articulos con programa que no estan ni en un modelo ni en SIN_COSTURA: %s' % huerfanos)
    return base, modelos


def sin_coser(base):
    """Articulos del programa de Costura (con cantidad) que no llevan hilo."""
    return [a for a in SIN_COSTURA if base[a]['W40'] + base[a]['W41'] > 0]


def a_medir(modelos):
    return [m for m in modelos if m['activas']]


def familias(modelos):
    """Resumen por familia: [(sector, familia, cliente, piezas, modelos, costuras, mediciones)]."""
    out = OrderedDict()
    for m in a_medir(modelos):
        f = out.setdefault((m['sector'], m['familia']), {'cliente': m['cliente'], 'piezas': 0, 'modelos': 0,
                                                         'costuras': [], 'mediciones': 0})
        f['piezas'] += len(m['activas'])
        f['modelos'] += 1
        f['mediciones'] += len(m['costuras'])
        for c in m['costuras']:
            nombre = c[1].split(' (')[0]
            if nombre not in f['costuras']:
                f['costuras'].append(nombre)
    return [(k[0], k[1], v['cliente'], v['piezas'], v['modelos'], ' + '.join(v['costuras']), v['mediciones'])
            for k, v in out.items()]


NOMBRE_HILO = {'HILO CAIMAN 120': 'Caimán 120', 'HILO POLI TEXT': 'Texturizado'}


def hilos_del_modelo(base, m):
    """Los hilos que tienen hoy en el arb las piezas del modelo, en un renglon. Un hilo que cambia de color
    segun el nivel se junta: 'FX483TK (3 colores)'."""
    por_tipo = OrderedDict()
    for p in m['activas']:
        for h in base[p]['hilos']:
            tipo = NOMBRE_HILO.get(h['cod']) or h['cod'].split('-')[0]
            por_tipo.setdefault(tipo, [])
            if h['cod'] not in por_tipo[tipo]:
                por_tipo[tipo].append(h['cod'])
    partes = []
    for tipo, cods in por_tipo.items():
        if tipo in NOMBRE_HILO.values():
            partes.append(tipo)
        elif len(cods) == 1:
            partes.append(cods[0])
        else:
            partes.append('%s (%d colores)' % (tipo, len(cods)))
    return ' · '.join(partes) if partes else '-'


# ---------------------------------------------------------------------------- planilla

AZUL_XL = '1F3A5F'
BORDE = Border(*(Side(style='thin', color='999999'),) * 4)


def _titulo(ws, texto):
    ws['B2'] = texto
    ws['B2'].font = Font(name='Calibri', size=14, bold=True, color=AZUL_XL)


def _encabezado(ws, fila, titulos):
    for j, t in enumerate(titulos):
        c = ws.cell(row=fila, column=2 + j, value=t)
        c.font = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor=AZUL_XL)
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        c.border = BORDE
    ws.row_dimensions[fila].height = 32


def _fila(ws, fila, valores, centrar=()):
    for j, v in enumerate(valores):
        c = ws.cell(row=fila, column=2 + j, value=v)
        c.font = Font(name='Calibri', size=10)
        c.border = BORDE
        c.alignment = Alignment(horizontal='center' if j in centrar else 'left', vertical='center', wrap_text=True)


def _anchos(ws, anchos):
    ws.column_dimensions['A'].width = 3
    for j, a in enumerate(anchos):
        ws.column_dimensions[get_column_letter(2 + j)].width = a


def _pagina(ws, ultima_col, fila_titulos):
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = '%d:%d' % (fila_titulos, fila_titulos)
    ws.freeze_panes = ws.cell(row=fila_titulos + 1, column=2)
    ws.sheet_view.showGridLines = False
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.page_margins.top = ws.page_margins.bottom = 0.5


def planilla(base, modelos, salida):
    wb = Workbook()

    # --- hoja 1: una fila por medicion (modelo x costura), para llenar en planta
    ws = wb.active
    ws.title = 'Mediciones'
    _titulo(ws, 'Consumo de hilos - planilla de medición')
    tit = ['N°', 'Sector', 'Modelo', 'Piezas', 'Operación', 'Costura', 'Hilo 1', 'Hilo 2',
           'Máquina', 'Fecha', 'Piezas cosidas', 'Hilo 1: peso inicial (g)', 'Hilo 1: peso final (g)',
           'Hilo 2: peso inicial (g)', 'Hilo 2: peso final (g)', 'Balanza', 'Hilo 1: g por pieza', 'Hilo 2: g por pieza']
    _encabezado(ws, 4, tit)
    f = 5
    n = 0
    for m in a_medir(modelos):
        for ops, nombre, arriba, abajo, maquina in m['costuras']:
            n += 1
            if nombre != 'Overlock':   # en las rectas el hilo 1 es el de arriba (aguja) y el 2 el de abajo (bobina)
                arriba = 'Arriba: ' + arriba[0].lower() + arriba[1:] if arriba.startswith('Confirmar') else 'Arriba: ' + arriba
                abajo = 'Abajo: ' + abajo[0].lower() + abajo[1:] if abajo.startswith('Confirmar') else 'Abajo: ' + abajo
            _fila(ws, f, [n, m['sector'], m['modelo'], ' / '.join(m['activas']), int(ops) if ops.isdigit() else ops,
                          nombre, arriba, abajo, maquina,
                          None, None, None, None, None, None, None,
                          '=IF(OR(L{0}="",M{0}="",N{0}=""),"",(M{0}-N{0})/L{0})'.format(f),
                          '=IF(OR(L{0}="",O{0}="",P{0}=""),"",(O{0}-P{0})/L{0})'.format(f)],
                  centrar=(0, 4, 9, 10, 11, 12, 13, 14, 15, 16, 17))
            for col in (18, 19):
                ws.cell(row=f, column=col).number_format = '0.00'
            f += 1
    _anchos(ws, [5, 14, 30, 34, 13, 20, 32, 32, 20, 11, 9, 11, 11, 11, 11, 10, 11, 11])
    _pagina(ws, 19, 4)

    # --- hoja 2: una fila por pieza y por hilo, con lo que hoy dice el arb
    ws = wb.create_sheet('Piezas e hilos')
    _titulo(ws, 'Consumo de hilos - piezas con programa de costura en las %s de 2026' % SEMANAS)
    tit = ['Sector', 'Cliente', 'Modelo', 'Pieza', 'Descripción', 'Costura', 'Hilo', 'Descripción del hilo',
           'Consumo en arb', 'Unidad', 'Programa sem. 40', 'Programa sem. 41']
    _encabezado(ws, 4, tit)
    f = 5
    for m in a_medir(modelos):
        for p in m['activas']:
            b = base[p]
            desc = b['desc'] or b.get('pe_desc') or ''
            hilos = b['hilos'] or [None]
            for h in hilos:
                fila = [m['sector'], m['cliente'], m['modelo'], p, desc]
                if h is None:
                    fila += ['', '', '', None, '']
                else:
                    rol = next((r for pref, r in m.get('rol', ()) if h['cod'].startswith(pref)), None)
                    fila += [rol or rol_del_hilo(h['cod']), h['cod'], h['desc'], h['cons'], h['un']]
                fila += [b['W40'], b['W41']]
                _fila(ws, f, fila, centrar=(8, 9, 10, 11))
                ws.cell(row=f, column=10).number_format = '0.00000000'
                f += 1
    _anchos(ws, [14, 9, 30, 19, 28, 16, 17, 42, 11, 8, 10, 10])
    _pagina(ws, 13, 4)

    wb.save(salida)
    return n


# ---------------------------------------------------------------------------- PowerPoint

AZUL = RGBColor(0x1F, 0x3A, 0x5F)
GRIS_TXT = RGBColor(0x59, 0x59, 0x59)
NEGRO = RGBColor(0x22, 0x22, 0x22)
BLANCO = RGBColor(0xFF, 0xFF, 0xFF)
FONDO_PAR = RGBColor(0xF3, 0xF5, 0xF8)
VERDE = RGBColor(0x2E, 0x7D, 0x32)
NARANJA = RGBColor(0xE0, 0x8A, 0x00)
ROJO = RGBColor(0xC6, 0x28, 0x28)
FUENTE = 'Calibri'


def texto(cuadro, s, size, color, bold=False, align=PP_ALIGN.LEFT):
    tf = cuadro.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = s
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    r.font.name = FUENTE
    return tf


def parrafo(tf, s, size, color, bold=False, espacio=6):
    p = tf.add_paragraph()
    p.space_before = Pt(espacio)
    r = p.add_run()
    r.text = s
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    r.font.name = FUENTE
    return p


def celda(c, s, size, color, fondo, bold=False, align=PP_ALIGN.LEFT):
    c.fill.solid()
    c.fill.fore_color.rgb = fondo
    c.vertical_anchor = MSO_ANCHOR.MIDDLE
    c.margin_left = c.margin_right = Inches(0.1)
    c.margin_top = c.margin_bottom = Inches(0.03)
    tf = c.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = str(s)
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    r.font.name = FUENTE


def caja(slide, x, y, w, h, color, lineas, forma=MSO_SHAPE.ROUNDED_RECTANGLE):
    """lineas = [(texto, tamaño, negrita)]"""
    c = slide.shapes.add_shape(forma, Inches(x), Inches(y), Inches(w), Inches(h))
    c.fill.solid()
    c.fill.fore_color.rgb = color
    c.line.fill.background()
    c.shadow.inherit = False
    tf = c.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(0.12)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    for i, (s, size, bold) in enumerate(lineas):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = s
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = BLANCO
        r.font.name = FUENTE
    return c


def cabecera(prs, titulo, bajada=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    texto(slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(10.5), Inches(0.7)), titulo, 30, AZUL, bold=True)
    if bajada:
        texto(slide.shapes.add_textbox(Inches(0.5), Inches(0.95), Inches(10.5), Inches(0.4)), bajada, 15, GRIS_TXT)
    slide.shapes.add_picture(LOGO, Inches(11.33), Inches(0.33), width=Inches(1.5))
    return slide


def tabla(slide, x, y, anchos, titulos, filas, alto=0.42, size=12, centrar=(), negrita=(0,), fondos=None):
    marco = slide.shapes.add_table(len(filas) + 1, len(anchos), Inches(x), Inches(y),
                                   Inches(sum(anchos)), Inches(alto * (len(filas) + 1)))
    t = marco.table
    for i, a in enumerate(anchos):
        t.columns[i].width = Inches(a)
    for fila in t.rows:
        fila.height = Inches(alto)
    for j, s in enumerate(titulos):
        celda(t.cell(0, j), s, size, BLANCO, AZUL, bold=True, align=PP_ALIGN.CENTER if j in centrar else PP_ALIGN.LEFT)
    for i, fila in enumerate(filas, start=1):
        fondo = FONDO_PAR if i % 2 == 0 else BLANCO
        for j, s in enumerate(fila):
            f = fondos.get((i - 1, j)) if fondos else None
            celda(t.cell(i, j), s, size, BLANCO if f else NEGRO, f or fondo, bold=(j in negrita) or bool(f),
                  align=PP_ALIGN.CENTER if j in centrar else PP_ALIGN.LEFT)
    return t


def imagen(slide, ruta, x, y, w_max, h_max):
    from PIL import Image
    with Image.open(ruta) as im:
        w, h = im.size
    escala = min(w_max / w, h_max / h)
    return slide.shapes.add_picture(ruta, Inches(x), Inches(y), width=Inches(w * escala), height=Inches(h * escala))


def powerpoint(base, modelos, salida, capturas):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    med = a_medir(modelos)
    fams = familias(modelos)
    n_piezas = sum(len(m['activas']) for m in med)
    n_modelos = len(med)
    n_mediciones = sum(len(m['costuras']) for m in med)

    # ---- 1. que es y cuanto es
    s = cabecera(prs, 'Consumo de hilos · Plan de medición', 'Piezas con programa de costura en las %s · %s' % (SEMANAS, FECHA))
    x = 0.5
    for num, rotulo, color in ((n_piezas, 'piezas que hoy se cosen', AZUL), (n_modelos, 'modelos distintos', AZUL),
                               (n_mediciones, 'mediciones de %d piezas' % PIEZAS_POR_MEDICION, VERDE)):
        caja(s, x, 1.65, 3.9, 1.25, color, [(str(num), 40, True), (rotulo, 16, False)])
        x += 4.2
    tf = texto(s.shapes.add_textbox(Inches(0.5), Inches(3.3), Inches(12.3), Inches(3.6)),
               'Qué vamos a hacer', 20, AZUL, bold=True)
    parrafo(tf, 'Medir en planta cuánto hilo lleva cada pieza, costura por costura, pesando los conos antes y después de coser %d piezas.' % PIEZAS_POR_MEDICION, 17, NEGRO, espacio=10)
    parrafo(tf, 'Con ese número se corrige el consumo de cada hilo en el arb.', 17, NEGRO, espacio=10)
    parrafo(tf, 'Un modelo junta las piezas que se cosen igual: izquierda y derecha, y los colores.', 17, NEGRO, espacio=10)
    parrafo(tf, 'Empezamos por %s.' % ' y '.join(PRIMERO), 17, NEGRO, bold=True, espacio=10)

    # ---- 2. como se mide
    s = cabecera(prs, 'Cómo se mide', 'Igual para todas las piezas')
    pasos = [('1', 'Pesar los conos y las bobinas'), ('2', 'Coser %d piezas seguidas en la misma máquina' % PIEZAS_POR_MEDICION),
             ('3', 'Pesar otra vez'), ('4', 'Diferencia ÷ %d = hilo por pieza' % PIEZAS_POR_MEDICION)]
    x = 0.5
    for num, t in pasos:
        caja(s, x, 1.6, 2.9, 1.3, AZUL if num != '4' else VERDE, [(num, 26, True), (t, 14, False)], forma=MSO_SHAPE.PENTAGON if num != '4' else MSO_SHAPE.ROUNDED_RECTANGLE)
        x += 3.13
    texto(s.shapes.add_textbox(Inches(0.5), Inches(3.15), Inches(6.2), Inches(0.4)), 'Qué se pesa en cada costura', 18, AZUL, bold=True)
    filas = [f for f in QUE_SE_PESA if f[0] in {c for m in med for c in _tipos(m)}]
    tabla(s, 0.5, 3.65, (2.3, 3.6), ('COSTURA', 'SE PESA'), [f[1:] for f in filas], alto=0.44, size=13)
    cab, paso = os.path.join(capturas, 'ho971_cab.png'), os.path.join(capturas, 'ho971_paso.png')
    if os.path.exists(cab) and os.path.exists(paso):
        imagen(s, cab, 6.75, 3.25, 6.08, 1.2)
        imagen(s, paso, 6.75, 4.25, 6.08, 1.6)
        texto(s.shapes.add_textbox(Inches(6.75), Inches(5.55), Inches(6.08), Inches(0.6)),
              'Hoja de operaciones 971, operación 41: el hilo vista va en la aguja y el de unión en la bobina.', 12, GRIS_TXT)
    texto(s.shapes.add_textbox(Inches(0.5), Inches(6.55), Inches(12.3), Inches(0.5)),
          'Balanza: las del Laboratorio (MC160 o MC341, de 0,01 g). En Costura no hay balanza calibrada.', 14, NEGRO, bold=True)

    # ---- 3. que piezas
    fuera = sin_coser(base)
    s = cabecera(prs, 'Qué piezas entran', 'Las que se cosen y tienen programa en las %s' % SEMANAS)
    filas, fondos = [], {}
    for i, (sector, familia, cliente, piezas, nmod, costuras, nmed) in enumerate(fams):
        primero = sector in PRIMERO
        filas.append(('1°' if primero else '2°', sector, familia, cliente, piezas, nmod, costuras, nmed))
        fondos[(i, 0)] = VERDE if primero else NARANJA
    filas.append(('', 'Total', '', '', n_piezas, n_modelos, '', n_mediciones))
    alto = min(0.42, 5.2 / (len(filas) + 1))
    tabla(s, 0.5, 1.55, (0.9, 1.8, 2.7, 1.1, 0.95, 1.2, 2.33, 1.35),
          ('ORDEN', 'SECTOR', 'FAMILIA', 'CLIENTE', 'PIEZAS', 'MODELOS', 'COSTURAS', 'MEDICIONES'),
          filas, alto=alto, size=12, centrar=(0, 3, 4, 5, 7), negrita=(1,), fondos=fondos)
    if set(fuera) != FUERA_DE_LA_NOTA:
        raise SystemExit('la nota de los que no se cosen nombra %s y los datos dan %s' % (sorted(FUERA_DE_LA_NOTA), sorted(fuera)))
    if fuera:
        texto(s.shapes.add_textbox(Inches(0.5), Inches(1.6 + alto * (len(filas) + 1)), Inches(12.3), Inches(0.6)),
              'Quedan afuera %d artículos que están en el programa de Costura y no llevan hilo: %s.'
              % (len(fuera), NOTA_SIN_COSTURA), 12, GRIS_TXT)

    # ---- 4, 5 y 6. el detalle, una fila por modelo
    for titulo, grupo in (('Primero: Patagonia', [m for m in med if m['sector'] == 'Patagonia']),
                          ('Primero: Costura Blanco', [m for m in med if m['sector'] == 'Costura Blanco']),
                          ('Después: Amarok, P703 y P21', [m for m in med if m['sector'] not in PRIMERO])):
        if not grupo:
            continue
        filas = [(m['modelo'], ', '.join(m['activas']), ' + '.join(c[1] for c in m['costuras']), hilos_del_modelo(base, m))
                 for m in grupo]
        nmed = sum(len(m['costuras']) for m in grupo)
        s = cabecera(prs, titulo, '%d modelos · %d mediciones de %d piezas' % (len(grupo), nmed, PIEZAS_POR_MEDICION))
        alto = min(0.5, 5.4 / (len(filas) + 1))
        tabla(s, 0.5, 1.5, (2.9, 3.9, 2.6, 2.93), ('MODELO', 'PIEZAS', 'COSTURAS', 'HILOS EN EL ARB'),
              filas, alto=alto, size=11 if len(filas) > 10 else 12)

    # ---- 6. lo que hay que definir con Produccion
    s = cabecera(prs, 'Lo que hay que definir con Producción', 'Ninguna hoja de operaciones dice en cuál máquina de la planta se cose')
    puntos = [
        ('En qué máquina se cose cada costura de cada modelo.', 'En el apoyabrazo P703 la unión va en recta simple y la vista en recta de doble aguja.'),
        ('Si una costura se reparte entre varias máquinas.', 'Se pesan los conos de todas, o se cosen las %d en una sola.' % PIEZAS_POR_MEDICION),
        ('Cómo se pesa el hilo de abajo.', 'Las bobinas se cargan desde un cono: se pesa ese cono o las bobinas.'),
        ('Qué día se cose cada modelo.', 'Para estar con la balanza cuando salen las %d piezas seguidas.' % PIEZAS_POR_MEDICION),
        ('Quién pesa y anota.', 'Los conos van y vuelven del Laboratorio: en Costura no hay balanza calibrada.'),
    ]
    y = 1.6
    for i, (t, sub) in enumerate(puntos, start=1):
        caja(s, 0.5, y, 0.7, 0.8, AZUL, [(str(i), 22, True)])
        tf = texto(s.shapes.add_textbox(Inches(1.4), Inches(y - 0.02), Inches(11.3), Inches(0.9)), t, 18, NEGRO, bold=True)
        parrafo(tf, sub, 14, GRIS_TXT, espacio=2)
        y += 1.05

    # ---- 7. de donde sale la lista
    cap = os.path.join(capturas, 'programa_w41.png')
    if os.path.exists(cap):
        s = cabecera(prs, 'De dónde salen los datos', 'Programa de producción, BOM del arb y hojas de operaciones')
        imagen(s, cap, 0.5, 1.5, 6.6, 5.6)
        tf = texto(s.shapes.add_textbox(Inches(7.3), Inches(1.45), Inches(5.6), Inches(1.5)), 'Piezas: programa de producción', 16, AZUL, bold=True)
        parrafo(tf, '2- 26W41 Programa de Producción.xlsx, hoja Difusion (y el de la semana 40).', 13, NEGRO)
        parrafo(tf, 'Y:\\PRODUCCION\\PCP\\Barack Argentina', 12, GRIS_TXT)
        tf = texto(s.shapes.add_textbox(Inches(7.3), Inches(3.0), Inches(5.6), Inches(0.8)), 'Hilos: BOM del arb', 16, AZUL, bold=True)
        parrafo(tf, 'Export de Relaciones del %s. Ejemplo: apoyabrazo de puerta N 231.' % FECHA, 13, NEGRO)
        arb = os.path.join(capturas, 'arb_n231.png')
        if os.path.exists(arb):
            imagen(s, arb, 7.3, 3.95, 5.55, 2.0)
        tf = texto(s.shapes.add_textbox(Inches(7.3), Inches(6.05), Inches(5.6), Inches(0.9)), 'Costuras: hojas de operaciones', 16, AZUL, bold=True)
        parrafo(tf, 'La vigente de cada pieza. La 971 se ve en "Cómo se mide".', 13, NEGRO)

    prs.save(salida)
    return n_piezas, n_modelos, n_mediciones


# Los articulos de SIN_COSTURA, dichos en un renglon (HO 907 Rev.15; HO 913; HO 909 y 957; planilla de Produccion)
NOTA_SIN_COSTURA = ('Top Roll P703 (solo se refila) y las telas 21-6416, 21-6766, 21-7339, 21-8908 y 21-8909 '
                    '(grampas, aplix o termoformado)')
FUERA_DE_LA_NOTA = {'0247615-03-FZHE', '0247616-03-FZHE', '21-6416', '21-6766', '21-7339', '21-8908', '21-8909'}

# Que se pesa segun el tipo de costura: (tipo, costura, se pesa)
QUE_SE_PESA = [
    ('union', 'Unión', 'Un solo hilo, arriba y abajo'),
    ('vista', 'Vista', 'Hilo vista arriba + hilo de unión abajo'),
    ('cnc', 'Doble pespunte CNC (Insert)', '2 conos arriba + 2 bobinas abajo'),
    ('overlock', 'Overlock (telas)', 'Todos los conos de la máquina'),
    ('recta', 'Recta (telas)', 'Cono de arriba + bobina'),
]


def _tipos(m):
    out = set()
    for _ops, nombre, *_ in m['costuras']:
        n = nombre.lower()
        if 'cnc' in n:
            out.add('cnc')
        elif 'overlock' in n:
            out.add('overlock')
        elif 'recta' in n:
            out.add('recta')
        elif 'vista' in n or 'pespunte' in n:
            out.add('vista')
        else:
            out.add('union')
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        raise SystemExit(__doc__)
    salida = os.path.abspath(args[0])
    capturas = salida
    if '--capturas' in sys.argv:
        capturas = os.path.abspath(sys.argv[sys.argv.index('--capturas') + 1])
    os.makedirs(salida, exist_ok=True)
    base, modelos = cargar()
    xlsx = os.path.join(salida, 'Consumo de hilos - Planilla de medicion.xlsx')
    pptx = os.path.join(salida, 'Consumo de hilos - Plan de medicion.pptx')
    n = planilla(base, modelos, xlsx)
    piezas, nmod, nmed = powerpoint(base, modelos, pptx, capturas)
    if n != nmed:
        raise SystemExit('la planilla tiene %d mediciones y el PowerPoint dice %d' % (n, nmed))
    print('piezas %d · modelos %d · mediciones %d' % (piezas, nmod, nmed))
    print(xlsx)
    print(pptx)


if __name__ == '__main__':
    main()

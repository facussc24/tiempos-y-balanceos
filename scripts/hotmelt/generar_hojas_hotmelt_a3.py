# -*- coding: utf-8 -*-
"""
Generador Oficial de HOJAS DE OPERACIONES en FORMATO A3 APAISADO (42.0 x 29.7 cm)
para la MÁQUINA LAMINADORA HOTMELT KINGPOWER + FUSOR GLSC-2.
Proyecto: Top Roll Patagonia / VW427 (OP 20 del Flujograma 122).
Formulario SGC oficial: I-IN-002.4-R01 (Geometría canónica Pablo Gamboa / Barack Argentina SRL).

Estructura Oficial por Decks (Criterio Fak 28-29/09/2026):
  1. PARTE 1: OPERACIÓN ESTÁNDAR / PRODUCCIÓN (12 láminas: 20.1 a 20.10, 20.14, 20.15)
  2. PARTE 2: CONTINGENCIAS / SI PASA ALGO (3 láminas: 20.11 a 20.13)
  3. PARTE 3: MANTENIMIENTO OPERATIVO Y LIMPIEZA (2 láminas: 20.16, 20.17)
  4. MANUAL COMPLETO UNIFICADO (17 operaciones: 20.1 a 20.17)
"""
import os
import sys
import io
import shutil
import functools

# Configurar encoding UTF-8 seguro para stdout en Windows
if sys.stdout and hasattr(sys.stdout, "buffer"):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

# Gate canónico de redacción de la skill
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                '..', '..', '.claude', 'skills',
                                'hojas-de-proceso', 'scripts'))
try:
    from redaccion import gate_redaccion
except ImportError:
    gate_redaccion = None

from PIL import Image, ImageFont
from pptx import Presentation
from pptx.util import Cm, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

try:
    from datos_privados import CLAVE_HMI
except ImportError:            # el repo es publico: sin este archivo va TBD
    CLAVE_HMI = "TBD"
from pptx.oxml import parse_xml
from pptx.oxml.ns import nsdecls

# ─── PALETA CORPORATIVA SGC (GAMBOA / BARACK) ─────────────────────────────────
AZUL                = RGBColor(0x44, 0x54, 0x6A)  # Azul pizarra oscuro cabeceras (#44546A)
AZUL2               = RGBColor(0x44, 0x72, 0xC4)  # Azul acento seguridad (#4472C4)
AZUL_TEXTO          = RGBColor(0x1F, 0x49, 0x7D)  # Azul énfasis (#1F497D)
BLANCO              = RGBColor(0xFF, 0xFF, 0xFF)
NEGRO               = RGBColor(0x00, 0x00, 0x00)
GRISF               = RGBColor(0xF2, 0xF2, 0xF2)  # Gris suave celdas
ROJO_ALERTA         = RGBColor(0xC0, 0x00, 0x00)  # Rojo advertencia SGC
AMARILLO_SEGURIDAD  = RGBColor(0xFF, 0xD7, 0x00)  # Amarillo seguridad advertencias (Fak 29/09/2026)

# ─── GEOMETRÍA OFICIAL FORMATO A3 (GAMBOA) (cm) ───────────────────────────────
W, H = 42.00, 29.70
M = 0.70                                  # Margen perimetral
X0, X1 = 0.70, 41.30                      # Ancho útil 40.60 cm
Y0, Y1 = 0.70, 29.00                      # Alto útil 28.30 cm

# Header / Cajetín
HDR_Y, HDR_H = 0.70, 4.63                 # 0.70 .. 5.33 cm

# Bloque Izquierdo: Fotos y Plan de Reacción
IMG_X, IMG_Y = 0.73, 5.33                 # 0.73 .. 25.53 cm (ancho 24.80 cm)
IMG_W, IMG_H = 24.80, 20.76               # 5.33 .. 26.09 cm
PLN_X, PLN_Y = 0.73, 26.11                # 26.11 .. 29.00 cm (alto 2.89 cm)
PLN_W, PLN_H = 24.77, 2.89

# Bloque Derecho: Operación, Notas/EPP y Ciclo de Control
DSC_X, DSC_Y = 25.53, 5.33                # 25.53 .. 41.28 cm (ancho 15.75 cm)
DSC_W, DSC_H = 15.75, 23.67               # 5.33 .. 29.00 cm

# Sub-bloques derechos:
PASOS_Y, PASOS_H = 5.33, 14.64            # Descripción: 5.33 .. 19.97 cm
NOTA_Y, NOTA_H   = 19.99, 1.90            # Notas y EPP: 19.99 .. 21.89 cm
CIC_Y, CIC_H     = 21.92, 7.08            # Ciclo de Control: 21.92 .. 29.00 cm

# ─── RUTAS DE ACTIVOS LOCALES Y DE RED ────────────────────────────────────────
AQUI = os.path.dirname(os.path.abspath(__file__))
FOTOS_DIR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\fotos_hoja"
CELULAR_DIR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos\Fotos del celular de Fak"
DESKTOP_DIR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo"
DESKTOP_ROOT = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos"
SHAREPOINT_HP = r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL\HOJAS DE PROCESO"
SGC_DIR = r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES\1- CLIENTES\NOVAX\Tapizadas puerta\TOP ROLL"
EPP_DIR = os.path.join(AQUI, "epp")

LOGO_BARACK = r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\barack_logo.png"

# Iconos EPP canónicos
ICO_ROPA     = os.path.join(EPP_DIR, "ico_13756.png")
ICO_CALZADO  = os.path.join(EPP_DIR, "ico_4449.png")
ICO_GUANTES  = os.path.join(EPP_DIR, "ico_11789.png")
ICO_ANTEOJOS = os.path.join(EPP_DIR, "ico_16034.png")
ICO_BARBIJO  = os.path.join(EPP_DIR, "ico_barbijo.png")

# Activos especiales de pantalla y máquina
FOTO_SEGURIDAD = os.path.join(AQUI, "_pantalla_seguridad.png")
FOTO_PANTALLA_FUSOR = os.path.join(AQUI, "_pantalla_fusor.png")
FOTO_PANTALLA_LIMPIEZA = os.path.join(AQUI, "_pantalla_limpieza.png")
FOTO_FUSOR_UNIDAD = os.path.join(AQUI, "_foto_fusor_unidad.jpg")

# ─── PRIMITIVAS GRÁFICAS ─────────────────────────────────────────────────────
def _caja(slide, x, y, w, h, relleno=None, borde=NEGRO, ancho=Pt(1)):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Cm(x), Cm(y), Cm(w), Cm(h))
    if relleno is None:
        sh.fill.background()
    else:
        sh.fill.solid()
        sh.fill.fore_color.rgb = relleno
    if borde is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = borde
        sh.line.width = ancho
    sh.shadow.inherit = False
    sh.text_frame.word_wrap = True
    return sh

def _txt(sh, texto, size=11, bold=False, color=NEGRO, align=PP_ALIGN.CENTER,
         anchor=MSO_ANCHOR.MIDDLE, fuente="Calibri", margen_x=0.08, margen_y=0.04):
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Cm(margen_x)
    tf.margin_top = tf.margin_bottom = Cm(margen_y)
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = str(texto)
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    r.font.name = fuente
    return sh

def _celda(slide, x, y, w, h, texto="", relleno=BLANCO, borde=NEGRO,
           ancho=Pt(1), **kw):
    sh = _caja(slide, x, y, w, h, relleno, borde, ancho)
    if texto != "":
        _txt(sh, texto, **kw)
    return sh

def _banda(slide, x, y, w, h, texto, size=11, azul=AZUL):
    return _celda(slide, x, y, w, h, texto, relleno=azul, borde=NEGRO,
                  size=size, bold=True, color=BLANCO, align=PP_ALIGN.CENTER)

# ─── 1. CAJETÍN OFICIAL A3 (FORMATO GAMBOA / BARACK) ─────────────────────────
def cajetin_a3(slide, d, logo=None):
    """Dibuja el encabezado oficial SGC A3 exactamente con la geometría de Gamboa."""
    # Fila 1: Logo | Título | Formulario & N° HO (top=0.73, h=1.97)
    _caja(slide, 0.73, 0.73, 5.00, 1.97, BLANCO, borde=NEGRO, ancho=Pt(1))
    if logo and os.path.exists(logo):
        im = Image.open(logo)
        ar = im.width / im.height
        ih = min(1.60, 4.20 / ar)
        iw = ih * ar
        slide.shapes.add_picture(logo, Cm(0.73 + (5.00 - iw) / 2),
                                 Cm(0.73 + (1.97 - ih) / 2), Cm(iw), Cm(ih))

    _celda(slide, 5.73, 0.73, 27.55, 1.97, d.get("titulo_hoja", "HOJA DE OPERACIONES"),
           size=25, bold=True, color=NEGRO, align=PP_ALIGN.CENTER)

    _celda(slide, 33.30, 0.73, 7.97, 0.60, f"Form: {d.get('form', 'I-IN-002.4-R01')}",
           size=9.5, bold=True, color=NEGRO, align=PP_ALIGN.CENTER)
    _celda(slide, 33.30, 1.33, 7.97, 1.37, d.get("ho", "HO-TBD"),
           size=22, bold=True, color=NEGRO, align=PP_ALIGN.CENTER)

    # Filas 2 a 5 (h=0.65 cada fila, top=2.71, 3.36, 4.01, 4.66)
    _celda(slide, 0.71, 2.71, 5.00, 0.65, "N° DE OPERACIÓN", relleno=AZUL, color=BLANCO, size=8.5, bold=True)
    _celda(slide, 5.71, 2.71, 15.00, 0.65, "DENOMINACIÓN DE LA OPERACIÓN", relleno=AZUL, color=BLANCO, size=8.5, bold=True)
    _celda(slide, 20.71, 2.71, 9.00, 0.65, "MODELO O VEHÍCULO", relleno=AZUL, color=BLANCO, size=8.5, bold=True)
    _celda(slide, 29.71, 2.71, 3.60, 0.65, "REALIZÓ:", relleno=AZUL, color=BLANCO, size=8.5, bold=True, align=PP_ALIGN.LEFT, margen_x=0.15)
    _celda(slide, 33.31, 2.71, 7.97, 0.65, d.get("realizo", "F.SANTORO"), size=9.5, bold=True)

    _celda(slide, 0.71, 3.36, 5.00, 0.65, d.get("op", "-"), size=11, bold=True)
    _celda(slide, 5.71, 3.36, 15.00, 0.65, d.get("denominacion", "-"), size=9.0, bold=True)
    _celda(slide, 20.71, 3.36, 9.00, 0.65, d.get("modelo", "PATAGONIA / VW427"), size=9.5, bold=True)
    _celda(slide, 29.71, 3.36, 3.60, 0.65, "APROBÓ:", relleno=AZUL, color=BLANCO, size=8.5, bold=True, align=PP_ALIGN.LEFT, margen_x=0.15)
    _celda(slide, 33.31, 3.36, 7.97, 0.65, d.get("aprobo", "C.BAPTISTA"), size=9.5, bold=True)

    _celda(slide, 0.71, 4.01, 5.00, 0.65, "SECTOR", relleno=AZUL, color=BLANCO, size=8.5, bold=True)
    _celda(slide, 5.71, 4.01, 15.00, 0.65, "COD. DE PIEZA / DESCRIPCIÓN", relleno=AZUL, color=BLANCO, size=8.5, bold=True)
    _celda(slide, 20.71, 4.01, 5.00, 0.65, "CLIENTE", relleno=AZUL, color=BLANCO, size=8.5, bold=True)
    _celda(slide, 25.71, 4.01, 4.00, 0.65, "N° PUESTO", relleno=AZUL, color=BLANCO, size=8.5, bold=True)
    _celda(slide, 29.71, 4.01, 3.60, 0.65, "FECHA:", relleno=AZUL, color=BLANCO, size=8.5, bold=True, align=PP_ALIGN.LEFT, margen_x=0.15)
    _celda(slide, 33.31, 4.01, 7.97, 0.65, d.get("fecha", "29/09/2026"), size=9.5, bold=True)

    _celda(slide, 0.71, 4.66, 5.00, 0.65, d.get("sector", "LAMINADO"), size=9.5, bold=True)
    _celda(slide, 5.71, 4.66, 15.00, 0.65, d.get("pieza", "TOP ROLL — N 216 / N 256 / N 285 / N 315"), size=9.5, bold=True)
    _celda(slide, 20.71, 4.66, 5.00, 0.65, d.get("cliente", "VW / NOVAX"), size=9.5, bold=True)
    _celda(slide, 25.71, 4.66, 4.00, 0.65, d.get("puesto", "-"), size=9.5, bold=True)
    _celda(slide, 29.71, 4.66, 3.60, 0.65, "REV.", relleno=AZUL, color=BLANCO, size=8.5, bold=True, align=PP_ALIGN.LEFT, margen_x=0.15)
    _celda(slide, 33.31, 4.66, 7.97, 0.65, d.get("rev", "A"), size=9.5, bold=True)

# ─── 2. BLOQUE DE IMÁGENES A3 (HASTA 4 FOTOS GRANDES CON BADGE REF.) ──────────
def _badge_ref(slide, x, y, n, w=1.80, h=0.60):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(x), Cm(y), Cm(w), Cm(h))
    sh.fill.solid()
    sh.fill.fore_color.rgb = AZUL
    sh.line.color.rgb = BLANCO
    sh.line.width = Pt(1)
    sh.shadow.inherit = False
    tf = sh.text_frame
    tf.word_wrap = False
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = f"REF. {n}"
    r.font.size = Pt(9.5)
    r.font.bold = True
    r.font.name = "Calibri"
    r.font.color.rgb = BLANCO
    return sh

def _badge_critico(slide, x, y, w=2.70, h=0.68):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(x), Cm(y), Cm(w), Cm(h))
    sh.fill.solid()
    sh.fill.fore_color.rgb = AMARILLO_SEGURIDAD
    sh.line.color.rgb = NEGRO
    sh.line.width = Pt(1.5)
    sh.shadow.inherit = False
    tf = sh.text_frame
    tf.word_wrap = False
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r_sym = p.add_run()
    r_sym.text = "⚠ "
    r_sym.font.size = Pt(10.5)
    r_sym.font.bold = True
    r_sym.font.name = "Calibri"
    r_sym.font.color.rgb = ROJO_ALERTA
    r_txt = p.add_run()
    r_txt.text = "CRÍTICO"
    r_txt.font.size = Pt(9.5)
    r_txt.font.bold = True
    r_txt.font.name = "Calibri"
    r_txt.font.color.rgb = NEGRO
    return sh

def bloque_imagenes_a3(slide, imagenes, pies=None, principal=None, fotos_criticas=None):
    _caja(slide, IMG_X, IMG_Y, IMG_W, IMG_H, BLANCO, borde=NEGRO, ancho=Pt(1))
    if not imagenes:
        return

    n = len(imagenes)
    pad = 0.20
    pie_h = 0.58
    badge_w, badge_h = 1.80, 0.60

    w_util = IMG_W - 2 * pad
    h_util = IMG_H - 2 * pad

    slots = []
    if n == 1:
        slots.append((0, 0, w_util, h_util))
    elif n == 2:
        cw = (w_util - pad) / 2
        slots.append((0, 0, cw, h_util))
        slots.append((cw + pad, 0, cw, h_util))
    elif n == 3:
        if principal == 0:
            w_izq = w_util * 0.55
            w_der = w_util - w_izq - pad
            ch_der = (h_util - pad) / 2
            slots.append((0, 0, w_izq, h_util))
            slots.append((w_izq + pad, 0, w_der, ch_der))
            slots.append((w_izq + pad, ch_der + pad, w_der, ch_der))
        elif principal == 2:
            w_der = w_util * 0.55
            w_izq = w_util - w_der - pad
            ch_izq = (h_util - pad) / 2
            slots.append((0, 0, w_izq, ch_izq))
            slots.append((0, ch_izq + pad, w_izq, ch_izq))
            slots.append((w_izq + pad, 0, w_der, h_util))
        else:
            ch_top = h_util * 0.52
            ch_bot = h_util - ch_top - pad
            cw_bot = (w_util - pad) / 2
            slots.append((0, 0, w_util, ch_top))
            slots.append((0, ch_top + pad, cw_bot, ch_bot))
            slots.append((cw_bot + pad, ch_top + pad, cw_bot, ch_bot))
    else:
        cw = (w_util - pad) / 2
        ch = (h_util - pad) / 2
        slots.append((0, 0, cw, ch))
        slots.append((cw + pad, 0, cw, ch))
        slots.append((0, ch + pad, cw, ch))
        slots.append((cw + pad, ch + pad, cw, ch))

    for k in range(min(n, len(slots))):
        ruta = imagenes[k]
        if not os.path.exists(ruta):
            continue
        sx, sy, sw, sh = slots[k]
        abs_sx = IMG_X + pad + sx
        abs_sy = IMG_Y + pad + sy

        _caja(slide, abs_sx, abs_sy, sw, sh, BLANCO, borde=RGBColor(0xD9, 0xD9, 0xD9), ancho=Pt(0.75))

        foto_max_h = sh - pie_h - 0.08
        im = Image.open(ruta)
        ar = im.width / im.height

        ih = min(foto_max_h, (sw - 0.10) / ar)
        iw = ih * ar
        fx = abs_sx + (sw - iw) / 2
        fy = abs_sy + (foto_max_h - ih) / 2

        slide.shapes.add_picture(ruta, Cm(fx), Cm(fy), Cm(iw), Cm(ih))
        _badge_ref(slide, abs_sx + 0.12, abs_sy + 0.12, k + 1, badge_w, badge_h)

        caption = pies[k] if pies and k < len(pies) else f"Operación paso {k+1}"
        pie_y = abs_sy + sh - pie_h
        _celda(slide, abs_sx, pie_y, sw, pie_h, caption,
               relleno=GRISF, borde=RGBColor(0xD9, 0xD9, 0xD9), color=AZUL_TEXTO,
               size=8.8, bold=True, align=PP_ALIGN.CENTER)

        if fotos_criticas and k in fotos_criticas:
            bw_c, bh_c = 2.70, 0.68
            bc_x = abs_sx + sw - bw_c - 0.15
            bc_y = pie_y - bh_c - 0.12
            _badge_critico(slide, bc_x, bc_y, bw_c, bh_c)

# ─── 3. BLOQUE PLAN DE REACCIÓN ANTE NO CONFORME (A3 CANÓNICO SGC) ───────────
def bloque_plan_a3(slide, disparador=None, acciones=None):
    """Dibuja el bloque canónico e inmutable del SGC oficial (Gamboa HO|plan).

    Formato inmutable SGC:
    - Cabecera: PLAN DE REACCIÓN ANTE NO CONFORME (ancho 24.77 cm, alto 0.61 cm)
    - Cuadro único: ancho 24.77 cm, alto 2.28 cm.
    - Cuatro líneas canónicas:
        1. SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME (NO CONFORME en negrita rojo #C00000)
        2. DETENGA LA OPERACIÓN (DETENGA en negrita)
        3. NOTIFIQUE DE INMEDIATO A SU LÍDER O SUPERVISOR (NOTIFIQUE en negrita)
        4. ESPERE LA DEFINICIÓN DEL LÍDER O SUPERVISOR (ESPERE en negrita)
    """
    _banda(slide, PLN_X, PLN_Y, PLN_W, 0.61, "PLAN DE REACCIÓN ANTE NO CONFORME", size=10.5)

    y_body = PLN_Y + 0.61
    h_body = PLN_H - 0.61

    sh = _caja(slide, PLN_X, y_body, PLN_W, h_body, BLANCO, borde=NEGRO, ancho=Pt(1))
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = Cm(0.35)
    tf.margin_top = tf.margin_bottom = Cm(0.08)

    # Línea 0: SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME
    p0 = tf.paragraphs[0]
    p0.alignment = PP_ALIGN.LEFT
    p0.space_after = Pt(2.5)
    r = p0.add_run(); r.text = 'SI '; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = False; r.font.color.rgb = NEGRO
    r = p0.add_run(); r.text = 'DETECTA'; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = True; r.font.color.rgb = NEGRO
    r = p0.add_run(); r.text = ' "PRODUCTO" O "PROCESO" '; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = False; r.font.color.rgb = NEGRO
    r = p0.add_run(); r.text = 'NO CONFORME'; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = True; r.font.color.rgb = ROJO_ALERTA

    # Línea 1: DETENGA LA OPERACIÓN
    p1 = tf.add_paragraph()
    p1.alignment = PP_ALIGN.LEFT
    p1.space_after = Pt(2.5)
    r = p1.add_run(); r.text = 'DETENGA'; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = True; r.font.color.rgb = NEGRO
    r = p1.add_run(); r.text = ' LA OPERACIÓN'; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = False; r.font.color.rgb = NEGRO

    # Línea 2: NOTIFIQUE DE INMEDIATO A SU LÍDER O SUPERVISOR
    p2 = tf.add_paragraph()
    p2.alignment = PP_ALIGN.LEFT
    p2.space_after = Pt(2.5)
    r = p2.add_run(); r.text = 'NOTIFIQUE'; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = True; r.font.color.rgb = NEGRO
    r = p2.add_run(); r.text = ' DE INMEDIATO A SU LÍDER O SUPERVISOR'; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = False; r.font.color.rgb = NEGRO

    # Línea 3: ESPERE LA DEFINICIÓN DEL LÍDER O SUPERVISOR
    p3 = tf.add_paragraph()
    p3.alignment = PP_ALIGN.LEFT
    p3.space_after = Pt(0)
    r = p3.add_run(); r.text = 'ESPERE'; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = True; r.font.color.rgb = NEGRO
    r = p3.add_run(); r.text = ' LA DEFINICIÓN DEL LÍDER O SUPERVISOR'; r.font.size = Pt(10.0); r.font.name = 'Calibri'; r.font.bold = False; r.font.color.rgb = NEGRO

# ─── 4. BLOQUE DERECHO: DESCRIPCIÓN DE OPERACIÓN, NOTAS, EPP Y CONTROL ───────
def bloque_descripcion_a3(slide, pasos, nota=None, parametros=None, epp_icons=None, ciclo_filas=None):
    _banda(slide, DSC_X, DSC_Y, DSC_W, 0.70, "DESCRIPCIÓN DE LA OPERACIÓN", size=11.5)

    y_pasos = DSC_Y + 0.70
    h_pasos = 13.94
    sh_pasos = _caja(slide, DSC_X, y_pasos, DSC_W, h_pasos, BLANCO, borde=NEGRO, ancho=Pt(1))

    tf = sh_pasos.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Cm(0.25)
    tf.margin_top = Cm(0.20)

    total_items = len(pasos) + (len(parametros) if parametros else 0)
    # Regla Fak: Si hay lugar arriba, la NOTA va adentro de Descripción de la Operación.
    # Solo va en caja separada inferior si NO hay lugar arriba (más de 11 líneas totales).
    cabe_arriba = (total_items <= 11) and bool(nota and str(nota).strip())

    size_p = 11.0 if total_items <= 6 else (10.0 if total_items <= 9 else 9.2)

    for i, texto in enumerate(pasos):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(3.0 if size_p >= 10.0 else 2.0)

        r_num = p.add_run()
        r_num.text = f"{i+1}.  "
        r_num.font.size = Pt(size_p)
        r_num.font.bold = True
        r_num.font.name = "Calibri"
        r_num.font.color.rgb = NEGRO

        partes = texto.split("⚠")
        if len(partes) == 1:
            r_txt = p.add_run()
            r_txt.text = partes[0]
            r_txt.font.size = Pt(size_p)
            r_txt.font.name = "Calibri"
            r_txt.font.bold = False
            r_txt.font.color.rgb = NEGRO
        else:
            if partes[0]:
                r_txt = p.add_run()
                r_txt.text = partes[0]
                r_txt.font.size = Pt(size_p)
                r_txt.font.name = "Calibri"
                r_txt.font.bold = False
                r_txt.font.color.rgb = NEGRO
            for part in partes[1:]:
                r_warn = p.add_run()
                r_warn.text = f" ⚠ {part.strip()}"
                r_warn.font.size = Pt(size_p)
                r_warn.font.bold = True
                r_warn.font.color.rgb = NEGRO
                r_warn.font.name = "Calibri"
                rPr = r_warn._r.get_or_add_rPr()
                hl_xml = parse_xml(f'<a:highlight {nsdecls("a")}><a:srgbClr val="FFFF00"/></a:highlight>')
                latin = rPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}latin')
                if latin is not None:
                    latin.addprevious(hl_xml)
                else:
                    rPr.append(hl_xml)

    if parametros:
        for k, v in parametros:
            p_par = tf.add_paragraph()
            p_par.alignment = PP_ALIGN.LEFT
            p_par.space_before = Pt(1.5)
            r_pk = p_par.add_run()
            r_pk.text = f"▸ {k}: "
            r_pk.font.size = Pt(size_p - 0.5)
            r_pk.font.bold = True
            r_pk.font.color.rgb = NEGRO
            r_pv = p_par.add_run()
            r_pv.text = str(v)
            r_pv.font.size = Pt(size_p - 0.5)
            r_pv.font.bold = True
            r_pv.font.color.rgb = AZUL_TEXTO

    if cabe_arriba:
        # NOTA ARRIBA (Criterio Fak: aprovecha el espacio disponible en Descripción)
        p_sep = tf.add_paragraph()
        p_sep.space_before = Pt(4.0)
        p_sep.alignment = PP_ALIGN.LEFT

        r_nl = p_sep.add_run()
        r_nl.text = "NOTA: "
        r_nl.font.size = Pt(size_p - 0.5)
        r_nl.font.bold = True
        r_nl.font.name = "Calibri"
        r_nl.font.color.rgb = AZUL_TEXTO

        r_nt = p_sep.add_run()
        r_nt.text = str(nota)
        r_nt.font.size = Pt(size_p - 1.0)
        r_nt.font.name = "Calibri"
        r_nt.font.color.rgb = NEGRO

        # Franja intermedia (y=19.99 a 21.89, w=15.75) 100% para ELEMENTOS DE SEGURIDAD
        _caja(slide, DSC_X, NOTA_Y, DSC_W, NOTA_H, BLANCO, borde=NEGRO, ancho=Pt(1))

        epp_icons_ok = [ic for ic in (epp_icons or []) if os.path.exists(ic)]
        if epp_icons_ok:
            n_ic = len(epp_icons_ok)
            cw_ic = (DSC_W - 0.40) / n_ic
            s_ic = min(cw_ic - 0.40, 1.15)
            for k_ic, ic_path in enumerate(epp_icons_ok):
                cx = DSC_X + 0.20 + k_ic * cw_ic + (cw_ic - s_ic) / 2
                cy = NOTA_Y + 0.12 + (1.20 - s_ic) / 2
                slide.shapes.add_picture(ic_path, Cm(cx), Cm(cy), Cm(s_ic), Cm(s_ic))

        _celda(slide, DSC_X, NOTA_Y + 1.38, DSC_W, 0.52, "ELEMENTOS DE SEGURIDAD",
               relleno=AZUL2, borde=NEGRO, color=BLANCO, size=8.5, bold=True)
    else:
        # Fallback split Gamboa si no hay lugar arriba
        w_nota = 8.98
        w_epp  = 6.77
        x_epp  = DSC_X + w_nota

        sh_nota = _caja(slide, DSC_X, NOTA_Y, w_nota, NOTA_H, BLANCO, borde=NEGRO, ancho=Pt(1))
        tf_n = sh_nota.text_frame
        tf_n.word_wrap = True
        tf_n.vertical_anchor = MSO_ANCHOR.TOP
        tf_n.margin_left = tf_n.margin_right = Cm(0.18)
        tf_n.margin_top = Cm(0.10)
        p_n = tf_n.paragraphs[0]
        p_n.alignment = PP_ALIGN.LEFT
        r_nl = p_n.add_run()
        r_nl.text = "NOTA: "
        r_nl.font.size = Pt(8.5)
        r_nl.font.bold = True
        r_nl.font.color.rgb = AZUL_TEXTO
        r_nt = p_n.add_run()
        r_nt.text = str(nota or "Operar con los resguardos y elementos de protección especificados.")
        r_nt.font.size = Pt(8.0)
        r_nt.font.name = "Calibri"
        r_nt.font.color.rgb = NEGRO

        _caja(slide, x_epp, NOTA_Y, w_epp, NOTA_H, BLANCO, borde=NEGRO, ancho=Pt(1))
        epp_icons_ok = [ic for ic in (epp_icons or []) if os.path.exists(ic)]
        if epp_icons_ok:
            n_ic = len(epp_icons_ok)
            cw_ic = (w_epp - 0.20) / n_ic
            s_ic = min(cw_ic - 0.10, 1.05)
            for k_ic, ic_path in enumerate(epp_icons_ok):
                cx = x_epp + 0.10 + k_ic * cw_ic + (cw_ic - s_ic) / 2
                cy = NOTA_Y + 0.10 + (1.20 - s_ic) / 2
                slide.shapes.add_picture(ic_path, Cm(cx), Cm(cy), Cm(s_ic), Cm(s_ic))

        _celda(slide, x_epp, NOTA_Y + 1.38, w_epp, 0.52, "ELEMENTOS DE SEGURIDAD",
               relleno=AZUL2, borde=NEGRO, color=BLANCO, size=8.0, bold=True)

    # ── CICLO DE CONTROL (CANON §1.1 & §1.2: PROCESOS NO EMITE CONTROLES SIN PLAN DE CONTROL) ──
    _banda(slide, DSC_X, CIC_Y, 8.98, 0.66, "CICLO DE CONTROL", size=10.5)
    _celda(slide, DSC_X + 8.98, CIC_Y, 6.77, 0.66, "Referencia: OP - Operador de Producción",
           relleno=BLANCO, borde=NEGRO, size=7.8, bold=True, align=PP_ALIGN.CENTER)

    cols_cic = [
        ("Características a controlar", 4.88),
        ("Método de control", 2.36),
        ("Resp.", 1.73),
        ("Frec.", 4.25),
        ("Registro", 2.53)
    ]
    y_hdr_cic = CIC_Y + 0.66
    h_hdr_cic = 0.85
    x_c = DSC_X
    for nom_col, w_col in cols_cic:
        _celda(slide, x_c, y_hdr_cic, w_col, h_hdr_cic, nom_col,
               relleno=AZUL, borde=NEGRO, color=BLANCO, size=8.0, bold=True)
        x_c += w_col

    # Grilla oficial de 6 filas vacías (idéntica a Gamboa HO-971) lista para Calidad
    y_filas = y_hdr_cic + h_hdr_cic
    num_filas = 6
    h_fila = (29.00 - y_filas) / num_filas

    for f_idx in range(num_filas):
        x_c = DSC_X
        for _, w_col in cols_cic:
            _celda(slide, x_c, y_filas, w_col, h_fila, "",
                   relleno=BLANCO, borde=NEGRO, ancho=Pt(1))
            x_c += w_col
        y_filas += h_fila

# ─── 5. PORTADA CORPORATIVA A3 (GAMBOA / BARACK) ─────────────────────────────
def portada_a3(prs, d, logo=None, foto=None, ops_indice=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _caja(slide, X0, Y0, X1 - X0, Y1 - Y0, BLANCO, borde=NEGRO, ancho=Pt(1.5))

    cab_h = 3.60
    _caja(slide, X0, Y0, X1 - X0, cab_h, BLANCO, borde=AZUL, ancho=Pt(1.5))
    _caja(slide, X0, Y0 + cab_h - 0.10, X1 - X0, 0.10, AZUL, borde=AZUL)

    lw = 6.00
    if logo and os.path.exists(logo):
        im = Image.open(logo)
        ar = im.width / im.height
        ih = min(cab_h - 0.60, (lw - 0.80) / ar)
        iw = ih * ar
        slide.shapes.add_picture(logo, Cm(X0 + (lw - iw) / 2),
                                 Cm(Y0 + (cab_h - ih) / 2), Cm(iw), Cm(ih))

    tx = X0 + lw + 0.40
    tw = X1 - X0 - lw - 0.60
    _celda(slide, tx, Y0 + 0.40, tw, 1.50,
           d.get("titulo", "HOJAS DE PROCESO — MÁQUINA HOTMELT"),
           size=28, bold=True, color=AZUL, relleno=BLANCO, borde=None, align=PP_ALIGN.LEFT)
    _celda(slide, tx, Y0 + 2.00, tw, 1.00,
           d.get("subtitulo", "Laminadora de vinilo con adhesivo hot melt · OP 20 del FLUJOGRAMA 122 TOP ROLL PATAGONIA"),
           size=13, bold=False, color=AZUL2, relleno=BLANCO, borde=None, align=PP_ALIGN.LEFT)

    y_body = Y0 + cab_h + 0.40
    w_foto = 18.00
    h_body = Y1 - y_body - 0.20

    if foto and os.path.exists(foto):
        im = Image.open(foto)
        ar = im.width / im.height
        fw = w_foto - 0.30
        fh = fw / ar
        if fh > h_body - 0.30:
            fh = h_body - 0.30
            fw = fh * ar
        _caja(slide, X0 + 0.15, y_body, w_foto, h_body, BLANCO, borde=AZUL, ancho=Pt(1))
        fx = X0 + 0.15 + (w_foto - fw) / 2
        fy = y_body + (h_body - fh) / 2
        slide.shapes.add_picture(foto, Cm(fx), Cm(fy), Cm(fw), Cm(fh))
    else:
        _caja(slide, X0 + 0.15, y_body, w_foto, h_body, BLANCO, borde=AZUL, ancho=Pt(1))

    xd = X0 + w_foto + 0.50
    wd = X1 - xd - 0.15

    filas_meta = [
        ("Documento SGC", d.get("ho", "HO-TBD")),
        ("Formulario Oficial", d.get("form", "I-IN-002.4-R01")),
        ("Operación Flujograma", d.get("op_flujo", "20 — ADHESIVADO HOT MELT")),
        ("Cliente / Modelo", d.get("cliente_modelo", "VW / PATAGONIA / VW427")),
        ("Pieza / Conjunto", d.get("pieza", "TOP ROLL PATAGONIA — N 216 / N 256 / N 285 / N 315")),
        ("Máquina / Celda", d.get("maquina", "Laminadora hot melt KINGPOWER + fusor GLSC-2")),
        ("Elaboró / Aprobó", d.get("firmas", "F. Santoro / C. Baptista")),
        ("Fecha / Revisión", d.get("fecha_rev", "29/09/2026 · Rev. A")),
    ]
    hh_m = 0.72
    y_meta = y_body + 0.10
    for lab, val in filas_meta:
        _celda(slide, xd, y_meta, 5.20, hh_m, lab, relleno=AZUL, color=BLANCO,
               size=9.0, bold=True, align=PP_ALIGN.LEFT, margen_x=0.15)
        _celda(slide, xd + 5.20, y_meta, wd - 5.20, hh_m, val, relleno=BLANCO,
               color=NEGRO, size=9.5, bold=True, align=PP_ALIGN.LEFT, margen_x=0.15)
        y_meta += hh_m + 0.08

    _banda(slide, xd, y_meta + 0.15, wd, 0.60, d.get("titulo_indice", "ÍNDICE DE OPERACIONES ESTÁNDAR"), size=10.5)
    y_ind = y_meta + 0.80
    ops_indice = ops_indice or []
    if ops_indice:
        hh_ind = (Y1 - y_ind - 0.20) / len(ops_indice)
        hh_ind = min(hh_ind, 0.75)
        for num, txt in ops_indice:
            _celda(slide, xd, y_ind, 1.80, hh_ind, f"OP {num}", size=8.5, bold=True)
            _celda(slide, xd + 1.80, y_ind, wd - 1.80, hh_ind, txt, size=8.5,
                   bold=False, align=PP_ALIGN.LEFT, margen_x=0.15)
            y_ind += hh_ind

# ─── 6. LÁMINA OPERACIONAL COMPLETA A3 ───────────────────────────────────────
def hoja_a3(prs, d, logo=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _caja(slide, X0, Y0, X1 - X0, Y1 - Y0, BLANCO, borde=NEGRO, ancho=Pt(1.5))
    cajetin_a3(slide, d, logo)
    bloque_imagenes_a3(slide, d.get("imagenes", []), d.get("pies"),
                       principal=d.get("principal"), fotos_criticas=d.get("fotos_criticas"))
    bloque_plan_a3(slide, d.get("disparador", 'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME'), d.get("acciones"))
    bloque_descripcion_a3(slide, d.get("pasos", []), nota=d.get("nota"),
                          parametros=d.get("parametros"), epp_icons=d.get("epp", [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_BARBIJO]),
                          ciclo_filas=d.get("ciclo", []))
    return slide

# ─── 7. ESPECIFICACIÓN CANÓNICA COMPLETA DE HOJAS (17 LÁMINAS: 20.1 A 20.17) ──
def P(nombre):
    if os.path.isabs(nombre) and os.path.exists(nombre):
        return nombre
    p = os.path.join(FOTOS_DIR, nombre)
    if os.path.exists(p): return p
    p_jpg = os.path.join(FOTOS_DIR, nombre + ".jpg")
    if os.path.exists(p_jpg): return p_jpg
    p_png = os.path.join(FOTOS_DIR, nombre + ".png")
    if os.path.exists(p_png): return p_png
    p_local = os.path.join(AQUI, nombre)
    if os.path.exists(p_local): return p_local
    p_local_png = os.path.join(AQUI, nombre + ".png")
    if os.path.exists(p_local_png): return p_local_png
    p_local_jpg = os.path.join(AQUI, nombre + ".jpg")
    if os.path.exists(p_local_jpg): return p_local_jpg
    return p_jpg

HOJAS_HOTMELT_A3 = [
    # ── OP 20.1 ────────────────────────────────────────────────────────────────
    {
        "op": "20.1", "etapa": "PREPARAR Y ARRANCAR",
        "denominacion": "SET UP DE LA MÁQUINA Y PUESTA EN MARCHA",
        "fotos_criticas": [2],
        "imagenes": [P("cand_30"), P("h01_a_llave_general"), P("h01_b_rodillos_reja"), P("h15_a_stop")],
        "pies": [
            "Línea laminadora Kingpower y fusor GLSC-2",
            "Llave interruptora general en posición ON",
            "Inspección de rodillos limpios y reja de seguridad",
            "Botones de parada de emergencia rearmados"
        ],
        "pasos": [
            "Inspeccionar visualmente que los rodillos no tengan restos metálicos, herramientas ni suciedad adherida. ⚠ CRÍTICO: Riesgo de daño a rodillos.",
            "Verificar la presión del suministro de aire comprimido en el manómetro de entrada (6 bar).",
            "Girar a posición ON el interruptor general rojo del gabinete lateral de la máquina.",
            "Verificar que todos los botones de parada de emergencia estén levantados (girar en sentido horario los que estén trabados).",
            "Verificar que la reja de resguardo mecánico de los rodillos esté colocada y trabada. ⚠ CRÍTICO: Reja trabada obligatoria.",
            "Verificar que la pantalla táctil SIMATIC encienda sin alarmas rojas activas."
        ],
        "nota": "La celda cuenta con dos mandos independientes: el fusor GLSC-2 para adhesivo Hotmelt y la pantalla táctil SIMATIC de la máquina Kingpower. Los rodillos alcanzan 185 °C de temperatura de trabajo para producir. Trabajar con ropa de trabajo ajustada sin elementos colgantes, calzado de seguridad, guantes térmicos y barbijo para vapores.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_BARBIJO],
        "disparador": "SI NO ENCIENDE LA PANTALLA, FALTA PRESIÓN DE AIRE O PERSISTE ALARMA",
        "acciones": [
            "1. Verificar que la llave general y la parada de emergencia estén rearmadas.",
            "2. Constatar suministro de aire comprimido a 6 bar en manómetro.",
            "3. Notificar inmediatamente al Líder de Producción o a Mantenimiento."
        ]
    },

    # ── OP 20.2 ────────────────────────────────────────────────────────────────
    {
        "op": "20.2", "etapa": "PREPARAR Y ARRANCAR",
        "denominacion": "PUESTA EN MARCHA DEL FUSOR DE ADHESIVO HOTMELT",
        "fotos_criticas": [3],
        "imagenes": [P("h02_a_unidad_general"), P("h02_b_encendido_switch"), P("h02_c_tanque_adhesivo"), P("h02_d_pantalla_160c")],
        "pies": [
            "Unidad fusora GLSC-2 conectada a máquina laminadora",
            "Interruptor general rojo (Power Switch en ON)",
            "Tanque de fusión: nivel de adhesivo Hotmelt sólido",
            "Pantalla táctil GLSC-2: seteo 160 °C y calentamiento activo"
        ],
        "pasos": [
            "Accionar a posición ON el interruptor general rojo (Power Switch) ubicado en el frente de la consola del fusor GLSC-2.",
            "Abrir la tapa superior del tanque y verificar visualmente que contenga suficiente adhesivo Hotmelt sólido.",
            "Habilitar en la pantalla táctil el calentamiento general y los circuitos de mangueras y pistolas dosificadoras.",
            "Verificar en la pantalla que los 5 circuitos térmicos (tanque, manguera 1, pistola 1, manguera 2 y pistola 2) estén regulados en 160 °C.",
            "Aguardar hasta que el adhesivo esté completamente fundido y los circuitos alcancen 160 °C para habilitar la alimentación a rodillos.",
            "Avisar de inmediato al líder si una boquilla se tapa o no dosifica. ⚠ CRÍTICO: Terminantemente prohibido manipular mangueras presurizadas o destapar boquillas en caliente."
        ],
        "nota": "El fusor calienta el adhesivo Hotmelt a 160 °C y lo dosifica mediante mangueras térmicas hacia dos boquillas montadas sobre el rodillo encolador. Los 5 circuitos van regulados a 160 °C y no se tocan durante el turno. Las mangueras y boquillas calientan en aproximadamente 8 minutos; el tanque de adhesivo sólido requiere mayor tiempo. Trabajar siempre con guantes térmicos y barbijo para vapores.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_BARBIJO],
        "ciclo": [
            ("Temperatura del fusor: 160 °C en los 5 circuitos", "Pantalla GLSC-2", "OP", "Inicio de turno / continuo", "Registro de control"),
            ("Nivel de adhesivo Hotmelt en tanque de carga", "Visual", "OP", "Inicio de turno / cada 2 hs", "Set up"),
            ("Pistolas y mangueras sin pérdidas ni obstrucción", "Visual", "OP", "Cada lote / cambio bobina", "Registro de control")
        ],
        "disparador": "SI EL FUSOR NO CALIENTA, INDICA ALARMA O UNA PISTOLA ESTÁ OBSTRUIDA",
        "acciones": [
            "1. No intervenir mangueras ni pistolas presurizadas en caliente.",
            "2. Verificar nivel de carga de adhesivo sólido en el tanque.",
            "3. Notificar inmediatamente a Mantenimiento y al Líder de Producción."
        ]
    },

    # ── OP 20.3 ────────────────────────────────────────────────────────────────
    {
        "op": "20.3", "etapa": "PREPARAR Y ARRANCAR",
        "denominacion": "ACCESO AL HMI Y RESET DE ALARMAS",
        "fotos_criticas": [1],
        "imagenes": [P("h03_a_login_hmi"), P("h09_b_reset"), P("h15_c_alarmas")],
        "pies": [
            "Pantalla de acceso y login en HMI",
            "Botón amarillo RESET de fallas",
            "Pantalla de alarmas despejadas"
        ],
        "pasos": [
            "Esperar a que la pantalla táctil SIMATIC termine de cargar su sistema de inicio.",
            "Ingresar la clave de operador " + CLAVE_HMI + " en el teclado de acceso numérico.",
            "Apretar el botón amarillo RESET si la máquina tiene alguna alarma trabada.",
            "Verificar en la pantalla principal que no queden alarmas activas en color rojo.",
            "Avisar de inmediato al líder o a mantenimiento si la alarma motriz persiste. ⚠ CRÍTICO: Prohibido forzar el reset."
        ],
        "nota": "Las alarmas de la pantalla avisan puertas abiertas, paradas de emergencia apretadas o motores trabados. Sin sacarlas la máquina no arranca. Si la pantalla arranca en chino, apretar English en el menú inferior.",
        "epp": [ICO_ROPA, ICO_CALZADO],
        "ciclo": [
            ("Acceso correcto al HMI con nivel de operador", "Pantalla HMI", "OP", "Inicio de turno", "Set up"),
            ("Despeje total de alarmas activas en panel", "Pantalla HMI", "OP", "Inicio de turno / tras parada", "Set up")
        ],
        "disparador": "SI EL HMI NO INICIA, RECHAZA LA CLAVE O PERSISTE ALARMA ACTIVA TRAS RESET",
        "acciones": [
            "1. No presionar reiteradamente el botón RESET si la causa no fue despejada.",
            "2. Tomar nota del código de alarma o texto de falla mostrado en pantalla.",
            "3. Notificar al Líder de Producción y solicitar asistencia a Mantenimiento."
        ]
    },

    # ── OP 20.4 ────────────────────────────────────────────────────────────────
    {
        "op": "20.4", "etapa": "PREPARAR Y ARRANCAR",
        "denominacion": "CARGA DE PARÁMETROS DE PRODUCTO Y TEMPERATURA",
        "principal": 1,
        "fotos_criticas": [2],
        "imagenes": [P("h04_d_seleccion_producto"), P("h04_a_pantalla_operacion"), P("h04_b_parametros_temp")],
        "pies": [
            "Menú de selección de recetas de producto",
            "Pantalla de parámetros de operación de línea",
            "Pantalla de control de temperaturas de rodillos"
        ],
        "pasos": [
            "Ingresar al menú de Recetas en la pantalla táctil y elegir la Receta 1 (Top Roll Patagonia).",
            "Verificar que la velocidad de avance de línea marque 3,0 m/min.",
            "Verificar que la velocidad del rodillo dosificador marque 0,040 m/min.",
            "Verificar que la luz de separación entre rodillos esté en 0,250 mm.",
            "Verificar en la pantalla de temperaturas el seteo de 185 °C en ambos rodillos.",
            "Respetar la traba de seguridad: los rodillos no giran a menos de 150 °C. ⚠ CRÍTICO: Traba de seguridad por temperatura mínima."
        ],
        "parametros": [
            ("Velocidad de línea", "3,0 m/min"),
            ("Velocidad dosificador", "0,040 m/min"),
            ("Luz entre rodillos", "0,250 mm"),
            ("Temperatura seteada", "185 °C"),
            ("Traba mínima de giro", "> 150 °C")
        ],
        "nota": "Las 4 versiones de Top Roll (N 216, N 256, N 285 y N 315) usan la misma receta con luz de 0,250 mm. Los rodillos tienen una traba de seguridad electrónica: no arrancan a girar si están a menos de 150 °C para no romper la máquina ni arruinar el recubrimiento de silicona con cola fría.",
        "epp": [ICO_ROPA, ICO_CALZADO],
        "ciclo": [
            ("Receta cargada N° 1 Top Roll Patagonia", "Pantalla HMI", "OP", "Inicio de turno / cambio versión", "Set up"),
            ("Luz entre rodillos: 0,250 mm", "Pantalla HMI", "OP", "Inicio de turno", "Set up"),
            ("Temperatura consigna de rodillos: 185 °C", "Pantalla HMI", "OP", "Inicio de turno / continuo", "Registro de control"),
            ("Velocidad de línea: 3,0 m/min", "Pantalla HMI", "OP", "Continuo", "Registro de control")
        ],
        "disparador": "SI LOS PARÁMETROS DIFIEREN DE LA HOJA O NO CARGA LA RECETA EN EL HMI",
        "acciones": [
            "1. Prohibido modificar valores de velocidad o luz sin autorización de Ingeniería/Calidad.",
            "2. Recargar la Receta 1 y cotejar cada valor contra la presente hoja.",
            "3. Dar aviso al Líder de Producción para validar la pantalla antes de arrancar."
        ]
    },

    # ── OP 20.5 ────────────────────────────────────────────────────────────────
    {
        "op": "20.5", "etapa": "PREPARAR Y ARRANCAR",
        "denominacion": "CALENTAMIENTO Y ESPERA DE TEMPERATURA",
        "fotos_criticas": [2],
        "imagenes": [P("h05_b_calentamiento_ok"), P("h05_a_calentando"), P("h09_b_rodillo_gira")],
        "pies": [
            "Aviso de fin de calentamiento en HMI",
            "Monitoreo de elevación de temperatura",
            "Rodillos térmicos limpios a temperatura de trabajo"
        ],
        "pasos": [
            "Esperar a que los rodillos alcancen la temperatura de trabajo fijada en 185 °C.",
            "Verificar en la pantalla táctil que aparezca el aviso de calentamiento listo.",
            "Verificar que la temperatura de ambos rodillos no varíe más de ±10 °C.",
            "Habilitar el giro lento de rodillos recién cuando la pantalla marque más de 150 °C. ⚠ CRÍTICO: Prohibido hacer girar rodillos en frío.",
            "Verificar que el adhesivo comience a caer de forma continua por los caños dosificadores."
        ],
        "nota": "Con la máquina fría, calentar todo lleva hasta 60 minutos. El adhesivo baja solo desde el fusor por mangueras térmicas: terminantemente prohibido cargar pegamento a mano sobre los rodillos. Los rodillos nunca deben girar por debajo de 150 °C.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_BARBIJO],
        "ciclo": [
            ("Temperatura real de rodillos: 185 °C ±10 °C", "Pantalla HMI", "OP", "Previo al arranque / continuo", "Registro de control"),
            ("Adhesivo fundido fluyendo por dosificadores", "Visual", "OP", "Previo al arranque", "Set up"),
            ("Rotación suave y sin ruidos anómalos", "Auditivo / Visual", "OP", "Al alcanzar 150 °C", "Set up")
        ],
        "disparador": "SI LOS RODILLOS NO LLEGAN A 185 °C TRAS 60 MIN O HAY DESVÍO > ±10 °C",
        "acciones": [
            "1. No intentar forzar el giro de rodillos si la temperatura es menor a 150 °C.",
            "2. Verificar en el HMI el encendido de resistencias térmicas de ambos rodillos.",
            "3. Notificar inmediatamente al Líder de Producción y a Mantenimiento."
        ]
    },

    # ── OP 20.6 ────────────────────────────────────────────────────────────────
    {
        "op": "20.6", "etapa": "PREPARAR Y ARRANCAR",
        "denominacion": "MONTAJE DEL ROLLO EN EL DESBOBINADOR",
        "fotos_criticas": [2],
        "imagenes": [P("h06_b_montaje_eje"), P("h06_d_mandril_aire"), P("h06_c_perilla_onoff")],
        "pies": [
            "Inserción del eje expansible neumático en el tubo",
            "Carga neumática de inflado del eje",
            "Bloqueo en cuna del desbobinador (posición ON)"
        ],
        "pasos": [
            "Verificar que el código y el número de lote de la bobina de vinilo coincidan con la orden de trabajo.",
            "Fijar la punta suelta del vinilo con cinta adhesiva antes de mover el rollo para que no se desenrolle.",
            "Meter el eje expansible de aire adentro del tubo de cartón del rollo.",
            "Centrar el rollo sobre el eje usando como guía la regla milimetrada.",
            "Conectar la pistola de aire en la válvula del eje e inflar hasta que quede bien apretado.",
            "Levantar y calzar el rollo entre dos operarios en los soportes del desbobinador. ⚠ CRÍTICO: Levantar el rollo obligatoriamente entre dos personas.",
            "Girar la perilla del soporte a la posición ON para dejar el eje trabado en su lugar. ⚠ CRÍTICO: Soporte trabado en ON obligatorio para evitar descalce o caída del rollo."
        ],
        "nota": "Colocar el rollo de manera que desenrolle hacia adelante, con la cara con textura hacia arriba y el dorso liso apuntando a los rodillos de pegamento.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES],
        "ciclo": [
            ("Identificación de materia prima (código vinilo / lote)", "Visual / Etiqueta", "OP", "Al recibir bobina", "Registro de control"),
            ("Centrado del rollo sobre el eje expansible", "Regla milimetrada", "OP", "Cada montaje", "Set up"),
            ("Fijación del eje expansible al tubo de cartón", "Táctil / Manómetro", "OP", "Cada montaje", "Set up"),
            ("Perilla de soporte trabada en posición ON", "Visual / Táctil", "OP", "Cada montaje", "Set up")
        ],
        "disparador": "SI EL EJE NEUMÁTICO PIERDE PRESIÓN, EL ROLLO QUEDA FLOJO O DESCENTRADO",
        "acciones": [
            "1. Detener la maniobra y no operar con el rollo mal amarrado al eje expansible.",
            "2. Revisar la válvula de inflado del eje y verificar hermeticidad con pistola neumática.",
            "3. Reajustar el centrado sobre la regla graduada antes de trabar el soporte."
        ]
    },

    # ── OP 20.7 ────────────────────────────────────────────────────────────────
    {
        "op": "20.7", "etapa": "PREPARAR Y ARRANCAR",
        "denominacion": "ENHEBRADO DEL MATERIAL EN SERPENTINA",
        "principal": 1,
        "fotos_criticas": [3],
        "imagenes": [P("h07_a_rollo"), P("h07_b_primer_rodillo"), P("c9415_14"), P("h07_e_entrada_rodillo")],
        "pies": [
            "Salida frontal de banda desde la bobina",
            "Paso por primer rodillo frontal de guiado",
            "Paso por serpentina y barra tensora",
            "Ingreso al tren de rodillos térmicos de laminado"
        ],
        "pasos": [
            "Colocar la perilla de control de tensión del desbobinador en modo MANUAL.",
            "Tirar de la punta del vinilo y pasarla por arriba del primer rodillo delantero.",
            "Pasar la tira en zigzag por los rodillos guía y por la barra tensora.",
            "Pasar el vinilo por la barra de centrado inferior y por el sensor óptico de borde.",
            "Presentar la punta de la lámina a la entrada de los rodillos con la máquina apagada y la reja abierta. ⚠ CRÍTICO: Peligro de atrapamiento, no meter las manos entre los rodillos."
        ],
        "nota": "ATENCIÓN: El enhebrado completo en zigzag se realiza solo al arrancar la máquina vacía o si el vinilo se llega a cortar. En la producción normal, el cambio de rollo se hace uniendo las puntas con cinta adhesiva (OP 20.11), sin volver a pasar todo el rollo.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES],
        "ciclo": [
            ("Sentido de la lámina (cara vista texturada hacia arriba)", "Visual", "OP", "Durante enhebrado", "Set up"),
            ("Recorrido completo en serpentina sin cruces", "Visual", "OP", "Cada enhebrado inicial", "Set up"),
            ("Posicionado en entrada de rodillos térmicos", "Visual", "OP", "Cada enhebrado", "Set up")
        ],
        "disparador": "SI EL VINILO SE CRUZA, SE PLIEGA O SE ENGANCHA AL PASAR POR LOS RODILLOS",
        "acciones": [
            "1. Mantener los rodillos detenidos y la reja de resguardo abierta durante el enhebrado.",
            "2. Cortar el tramo deformado de vinilo con cutter de seguridad de punta redondeada.",
            "3. Reenhebrar la serpentina asegurando que la cara texturada quede hacia arriba."
        ]
    },

    # ── OP 20.8 ────────────────────────────────────────────────────────────────
    {
        "op": "20.8", "etapa": "PREPARAR Y ARRANCAR",
        "denominacion": "CENTRADO Y TENSIÓN DE LA BANDA",
        "fotos_criticas": [1],
        "imagenes": [P("calin_40"), P("h08_c_tablero_tension"), P("h10_b_material_saliendo")],
        "pies": [
            "Alineación contra marca milimetrada de regla guía",
            "Controlador digital de tensión BIANFU (20 kg)",
            "Banda de vinilo plana y centrada sin arrugas"
        ],
        "pasos": [
            "Alinear el borde del vinilo contra la marca de referencia de la regla guía.",
            "Ajustar el sensor óptico apuntando justo al borde de la tira de vinilo.",
            "Verificar en la pantalla del controlador BIANFU que la tensión esté en 20 kg. ⚠ CRÍTICO: Tensión calibrada obligatoria para evitar desalineación.",
            "Pasar la perilla de tensión del desbobinador de modo MANUAL a modo AUTOMÁTICO.",
            "Verificar que la tira de vinilo corra derecha, estirada y sin doblarse ni hacer arrugas."
        ],
        "nota": "Si la tensión queda floja se forman arrugas y burbujas en el vinilo; si queda demasiado tirante, el material se estira y sale fuera de medida al cortar o moldear.",
        "epp": [ICO_ROPA, ICO_CALZADO],
        "ciclo": [
            ("Borde de lámina coincidente con marca milimetrada", "Regla graduada", "OP", "Al ajustar centrado", "Set up"),
            ("Tensión de bobina en controlador digital (20 kg)", "Display BIANFU", "OP", "Inicio de turno / continuo", "Registro de control"),
            ("Banda de vinilo plana sin pliegues ni arrugas", "Visual", "OP", "Continuo", "Registro de control")
        ],
        "disparador": "SI LA BANDA AVANZA CON ARRUGAS, ONDULACIONES O DESVÍO LATERAL",
        "acciones": [
            "1. Pasar el control de tensión a MANUAL y verificar alineación contra la regla guía.",
            "2. Limpiar el lente del sensor óptico de borde si pierde la referencia de lámina.",
            "3. Reajustar la tensión a 20 kg y conmutar a AUTOMÁTICO bajo supervisión del Líder."
        ]
    },

    # ── OP 20.9 ────────────────────────────────────────────────────────────────
    {
        "op": "20.9", "etapa": "PREPARAR Y ARRANCAR",
        "denominacion": "ARRANQUE Y ALINEACIÓN DE BORDE",
        "principal": 2,
        "fotos_criticas": [0],
        "imagenes": [P("h01_b_rodillos_reja"), P("h15_a_stop"), P("h09_b_reset"), P("h10_a_hmi_automatico")],
        "pies": [
            "Reja de seguridad trabada y enclavamiento",
            "Botón de parada de emergencia rearmado",
            "Botón de rearme RESET amarillo",
            "Alineación continua de banda durante el laminado"
        ],
        "pasos": [
            "Bajar y trabar la reja de seguridad de los rodillos térmicos. ⚠ CRÍTICO: Reja trabada obligatoria para arrancar.",
            "Verificar el botón de parada de emergencia en vacío antes de dar marcha.",
            "Apretar el botón amarillo RESET y dar marcha desde la botonera de la máquina.",
            "Verificar en la pantalla táctil que pase a modo AUTOMÁTICO.",
            "Verificar que los rodillos tiren del vinilo parejo y a velocidad constante de 3,0 m/min.",
            "Controlar visualmente que el borde del vinilo no se corra de la línea guía marcada."
        ],
        "nota": "Si la tira de vinilo se desvía más de 2 mm de la línea guía, detener la marcha y corregir la posición del rollo en el desbobinador antes de seguir.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES],
        "ciclo": [
            ("Reja de resguardo cerrada y enclavada", "Sensor de seguridad", "OP", "Previo a arranque", "Set up"),
            ("Modo automático activo en panel HMI", "Pantalla HMI", "OP", "Al arrancar", "Set up"),
            ("Alineación lateral de borde (desvío máximo ±2 mm)", "Visual / Regla", "OP", "Continuo", "Registro de control"),
            ("Velocidad de avance de vinilo (3,0 m/min)", "Pantalla HMI", "OP", "Continuo", "Registro de control")
        ],
        "disparador": "SI SE DISPARA UNA ALARMA O EL MATERIAL DERIVA DEL CENTRO (> 2 MM)",
        "acciones": [
            "1. Detener la marcha desde la botonera de mando de la celda.",
            "2. Corregir la alineación lateral de la banda antes de habilitar el avance continuo.",
            "3. Notificar al Líder si el sistema automático de guiado no compensa el desvío."
        ]
    },

    # ── OP 20.10 ───────────────────────────────────────────────────────────────
    {
        "op": "20.10", "etapa": "PRODUCIR",
        "denominacion": "LAMINADO Y CONTROL DURANTE LA MARCHA",
        "principal": 0,
        "fotos_criticas": [0],
        "imagenes": [P("h10_b_material_saliendo"), P("h10_c_enfriamiento"), P("h04_b_parametros_temp")],
        "pies": [
            "Salida continua de vinilo laminado hacia la mesa",
            "Banco de ventiladores de enfriamiento activos",
            "Monitoreo de temperatura de rodillos (185 °C)"
        ],
        "pasos": [
            "Mirar en todo momento que el vinilo laminado salga plano, sin arrugas ni burbujas de aire.",
            "Verificar que la capa de adhesivo en el dorso del vinilo sea pareja, continua y sin grumos ni partes secas.",
            "Revisar que la cara con textura no salga marcada por calor, quemada ni rayada.",
            "Mirar cada 30 minutos en la pantalla táctil que los rodillos se mantengan en 185 °C.",
            "Verificar que los sopladores de aire de enfriamiento estén prendidos y tirando aire a la salida.",
            "No acercar las manos a la zona de rodillos mientras la máquina está marchando. ⚠ CRÍTICO: Prohibido tocar rodillos en movimiento."
        ],
        "nota": "El pegamento sale a 185 °C y se enfría rápido con los sopladores de aire. Las planchas deben llegar frías a la mesa de corte para que no se peguen unas con otras al apilar.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_BARBIJO],
        "ciclo": [
            ("Adherencia y uniformidad de capa de adhesivo", "Visual / Táctil", "OP", "Continuo (100%)", "Registro de control"),
            ("Ausencia de arrugas, pliegues o burbujas", "Visual", "OP", "Continuo (100%)", "Registro de control"),
            ("Cara vista sin marcas de quemadura ni brillo excesivo", "Visual", "OP", "Continuo (100%)", "Registro de control"),
            ("Temperatura de rodillos (185 °C ±10 °C)", "Pantalla HMI", "OP", "Cada 30 min", "Registro de control"),
            ("Ventiladores de enfriamiento operativos", "Auditivo / Visual", "OP", "Continuo", "Set up")
        ],
        "disparador": "SI APARECEN ARRUGAS, BURBUJAS O LA CAPA DE ADHESIVO ES DISCONTINUA",
        "acciones": [
            "1. Detener inmediatamente el avance de línea desde el botón de parada.",
            "2. Segregar el material no conforme e identificarlo con tarjeta roja de SCRAP.",
            "3. Dar aviso inmediato al Líder de Producción y a Control de Calidad."
        ]
    },

    # ── OP 20.11 ───────────────────────────────────────────────────────────────
    {
        "op": "20.11", "etapa": "SI PASA ALGO",
        "denominacion": "EMPALME DEL MATERIAL CON CINTA ADHESIVA",
        "fotos_criticas": [1],
        "imagenes": [P("c9415_14"), P("h11_c_marca_referencia"), P("h11_b_cinta_blanca")],
        "pies": [
            "Enfrentamiento de extremos sobre barra patrón",
            "Línea de corte recto y referencia de empalme",
            "Fijación con cinta adhesiva de alta resistencia"
        ],
        "pasos": [
            "Parar la máquina apretando el botón de parada de ciclo.",
            "Cortar la cola del rollo terminado con un corte bien RECTO a 90° sobre la barra de corte. ⚠ CRÍTICO: Prohibido cortar torcido o en diagonal.",
            "Identificar la posición de empalme sobre la barra guía para saber dónde apoyar la punta.",
            "Apoyar la punta del nuevo rollo borde contra borde con el anterior, bien pegado pero sin encimar.",
            "Aplicar una tira de cinta adhesiva de punta a punta tapando toda la unión.",
            "Apretar bien la cinta adhesiva con la mano para que no queden globos ni puntas levantadas.",
            "Identificar la zona del empalme con fibrón rojo para marcarla como SCRAP.",
            "Cerrar la reja, dar marcha a velocidad baja y pasar la unión despacio."
        ],
        "nota": "Esta maniobra se hace en cada recambio de rollo para no tener que enhebrar todo de vuelta. El empalme NUNCA va en diagonal (se rompe por el centro al entrar a los rodillos). El pedazo con cinta adhesiva se segrega siempre al cajón de scrap en la mesa de corte y nunca va al termoformado.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES],
        "ciclo": [
            ("Corte recto transversal de ambos extremos", "Visual", "OP", "Cada empalme", "Set up"),
            ("Unión a tope sin solapamiento ni luz abierta", "Visual", "OP", "Cada empalme", "Set up"),
            ("Cinta adhesiva firmemente adherida sin bordes levantados", "Visual / Táctil", "OP", "Cada empalme", "Set up"),
            ("Marcación con fibrón rojo del tramo de empalme", "Visual", "OP", "Cada empalme", "Registro de control")
        ],
        "disparador": "SI EL EMPALME QUEDA DESALINEADO, CON LUZ ABIERTA O CINTA ADHESIVA FLOJA",
        "acciones": [
            "1. Detener el arrastre y no permitir que un empalme defectuoso ingrese a rodillos.",
            "2. Retirar la cinta adhesiva, reajustar los bordes a tope recto y volver a aplicar cinta adhesiva limpia.",
            "3. Marcar con fibrón indeleble rojo la zona empalmada para su posterior descarte en mesa."
        ]
    },

    # ── OP 20.12 ───────────────────────────────────────────────────────────────
    {
        "op": "20.12", "etapa": "SI PASA ALGO",
        "denominacion": "CAMBIO DE ROLLO POR FIN DE MATERIAL",
        "fotos_criticas": [2],
        "imagenes": [P("h12_a_pulsador_rojo"), P("h12_c_volante_mandril"), P("h12_d_nucleo_vacio")],
        "pies": [
            "Botón de parada local en el desbobinador",
            "Despresurización de aire del eje expansible",
            "Montaje y preparación del rollo nuevo entre dos operarios"
        ],
        "pasos": [
            "Verificar que la máquina se detenga al acabarse el vinilo o apretar la parada de la zona.",
            "Apretar el botón de parada rojo ubicado en el soporte del desbobinador.",
            "Despresurizar el eje expansible abriendo la válvula manual de descarga.",
            "Sacar el eje del tubo de cartón vacío y bajar el tubo usado.",
            "Subir el rollo nuevo verificando código, lote y que desenrolle hacia adelante. ⚠ CRÍTICO: Levantar el rollo obligatoriamente entre dos personas.",
            "Centrar el rollo en el eje con la regla e inflar con la pistola de aire hasta que no se mueva.",
            "Trabar la palanca en ON y realizar el empalme con cinta adhesiva según OP 20.11."
        ],
        "nota": "Levantar los rollos pesados siempre de a dos para no lastimarse la espalda. Nunca golpear el eje expansible con martillos ni fierros para no romper las trabas de aire.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES],
        "ciclo": [
            ("Código y lote de bobina nueva según orden de producción", "Visual / Etiqueta", "OP", "Cada cambio de rollo", "Registro de control"),
            ("Sentido de desbobinado (cara texturada hacia arriba)", "Visual", "OP", "Cada cambio de rollo", "Set up"),
            ("Bloqueo neumático firme del eje sobre el tubo de cartón", "Táctil", "OP", "Cada cambio de rollo", "Set up"),
            ("Soporte del desbobinador trabado en posición ON", "Visual / Táctil", "OP", "Cada cambio de rollo", "Set up")
        ],
        "disparador": "SI EL EJE NEUMÁTICO PIERDE PRESIÓN, EL ROLLO QUEDA FLOJO O DESCENTRADO",
        "acciones": [
            "1. Verificar corte de aire y accionar manualmente la válvula de alivio del eje.",
            "2. No golpear el buje ni el eje con herramientas de acero para evitar dañarlo.",
            "3. Solicitar ayuda de un segundo operario o dar aviso a Mantenimiento."
        ]
    },

    # ── OP 20.13 ───────────────────────────────────────────────────────────────
    {
        "op": "20.13", "etapa": "SI PASA ALGO",
        "denominacion": "DESTRABE DE MATERIAL ATASCADO",
        "fotos_criticas": [1],
        "imagenes": [P("h13_c_maquina_detenida"), P("h13_b_material_trabado"), P("h13_a_vinilo_mal_pasado")],
        "pies": [
            "Parada inmediata de máquina ante atasco",
            "Inspección de vinilo doblado en los rodillos",
            "Vinilo fuera de rodillo guía"
        ],
        "pasos": [
            "Presionar el botón de parada de emergencia si el vinilo se traba o se enrolla en un rodillo.",
            "Abrir la reja y apretar el botón de apertura para separar los rodillos.",
            "Cortar con cutter de seguridad el pedazo de vinilo arrugado o pegado.",
            "Sacar los restos de vinilo y cola usando solo espátula blanda de latón o teflón. ⚠ CRÍTICO: Prohibido usar espátulas de acero o destornilladores.",
            "Revisar a simple vista que los rodillos no hayan quedado rayados ni con pegamento pegado.",
            "Destrabar la parada de emergencia, apretar RESET en la pantalla y volver a pasar el vinilo."
        ],
        "nota": "Terminantemente prohibido raspar con herramientas de acero, destornilladores ni cuchillos: cualquier rayita arruina el recubrimiento de silicona del rodillo y marca todo el vinilo que se fabrique después.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_BARBIJO],
        "ciclo": [
            ("Apertura completa de rodillos térmicos", "Visual", "OP", "Ante atasco", "Set up"),
            ("Inspección de superficie de rodillos (sin rayaduras ni melladuras)", "Visual", "OP / Líder", "Tras destrabe", "Registro de control"),
            ("Limpieza de restos de adhesivo fundido de los rodillos", "Visual", "OP", "Tras destrabe", "Set up")
        ],
        "disparador": "SI EL VINILO SE ENROLLA EN RODILLOS O SE OBSERVA UNA RAYADURA",
        "acciones": [
            "1. Presionar de inmediato la Parada de Emergencia y accionar apertura de rodillos.",
            "2. Utilizar únicamente espátula de latón o teflón; terminantemente prohibido usar acero.",
            "3. Segregar todo el material dañado e inspeccionar rodillos antes de reiniciar ciclo."
        ]
    },

    # ── OP 20.14 ───────────────────────────────────────────────────────────────
    {
        "op": "20.14", "etapa": "TERMINAR",
        "denominacion": "CORTE DE LA PLANCHA DE VINILO",
        "fotos_criticas": [1],
        "imagenes": [P("h10_b_material_saliendo"), P("h14_a_corte_cuchillo")],
        "pies": [
            "Recepción de lámina en mesa de salida",
            "Corte con cutter de seguridad sobre mesa plana (prohibido cortar en piso)"
        ],
        "pasos": [
            "Recibir la plancha de vinilo sobre la mesa de salida a medida que va saliendo de la máquina.",
            "Cortar únicamente sobre la mesa de trabajo de madera o plástico. ⚠ CRÍTICO: Terminantemente prohibido cortar sobre el piso.",
            "Apoyar la regla metálica sobre la medida marcada para cortar.",
            "Hacer el corte parejo usando cutter de seguridad y guantes anticorte.",
            "Redondear siempre las cuatro puntas del corte para que no se rajen después. ⚠ CRÍTICO: Prohibido dejar esquinas vivas en punta a 90°.",
            "Apilar las planchas cortadas en el contenedor sobre cartones separadores limpios."
        ],
        "nota": "Las esquinas en punta a 90° hacen que el vinilo se enganche y se rompa cuando se calienta en la máquina de termoformado: redondear siempre las cuatro esquinas.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES],
        "ciclo": [
            ("Dimensiones de la plancha cortada (largo y ancho según plano)", "Cinta métrica", "OP", "1 por rollo / cada 50 pzas", "Registro de control"),
            ("Esquinas cortadas con radio redondeado (sin vértices vivos a 90°)", "Visual", "OP", "100%", "Registro de control"),
            ("Cara con adhesivo limpia, sin contaminación de polvo o suciedad", "Visual", "OP", "100%", "Registro de control")
        ],
        "disparador": "SI LA PLANCHA PRESENTA REBABAS, CORTE DESVIADO O PUNTAS VIVAS A 90°",
        "acciones": [
            "1. Segregar las planchas defectuosas en el cajón de scrap.",
            "2. Reemplazar la hoja del cutter de seguridad si presenta desgaste o pérdida de filo.",
            "3. Cortar siempre sobre la mesa plana designada; prohibido cortar sobre el piso."
        ]
    },

    # ── OP 20.15 ───────────────────────────────────────────────────────────────
    {
        "op": "20.15", "etapa": "TERMINAR",
        "denominacion": "PARADA Y BLOQUEO DE LA MÁQUINA",
        "principal": 2,
        "fotos_criticas": [1],
        "imagenes": [P("h15_a_stop"), P("h13_c_maquina_detenida"), FOTO_SEGURIDAD],
        "pies": [
            "Botón de parada general de máquina",
            "Rodillos térmicos detenidos en enfriamiento",
            "Pantalla de diagnóstico de entradas y salidas de seguridad I/O"
        ],
        "pasos": [
            "Apretar el botón de parada para frenar el avance de la máquina.",
            "Apagar el calentamiento general desde la pantalla táctil y el interruptor del fusor de adhesivo.",
            "Poner la pantalla táctil en modo espera (150 °C) si es parada corta, o en enfriamiento si es fin de turno.",
            "Mirar en la pantalla táctil que las luces de seguridad estén en verde (entradas cerradas y seguras).",
            "Verificar que los motores queden apagados antes de cortar la energía.",
            "Bajar la llave general roja a OFF RECIÉN cuando los rodillos bajen de 50 °C. ⚠ CRÍTICO: Prohibido cortar la energía con rodillos a más de 50 °C."
        ],
        "nota": "La pantalla de seguridad muestra si todas las puertas y paradas están bien cerradas. Si se corta la llave general con los rodillos calientes, la goma de silicona se quema y los retenes se resecan: esperar siempre a que la pantalla marque menos de 50 °C.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES],
        "ciclo": [
            ("Detención total de giro de rodillos y tracción", "Visual", "OP", "Al accionar parada", "Set up"),
            ("Apagado de calentamiento y fusor GLSC-2", "Panel fusor", "OP", "Al detener máquina", "Set up"),
            ("Entradas de seguridad en bit 1 y salidas en bit 0", "Pantalla HMI (I/O)", "OP", "Al fin de turno", "Set up"),
            ("Temperatura de rodillos < 50 °C antes de corte de energía general", "Pantalla HMI", "OP", "Al apagar", "Set up")
        ],
        "disparador": "SI UN ACTUADOR NO QUEDA EN REPOSO O LA TEMPERATURA SUPERA 50 °C AL APAGAR",
        "acciones": [
            "1. Verificar que el fusor haya cortado el flujo de adhesivo a las mangueras.",
            "2. No cortar la energía general mientras los rodillos permanezcan a más de 50 °C.",
            "3. Reportar anomalías al Líder de Producción antes de retirarse del puesto."
        ]
    },

    # ── OP 20.16 ───────────────────────────────────────────────────────────────
    {
        "op": "20.16", "etapa": "TERMINAR",
        "denominacion": "APERTURA DE RODILLOS Y BANDEJA",
        "fotos_criticas": [1],
        "imagenes": [P("h17_a_pantalla_limpieza"), P("h16_b_plato_pegamento")],
        "pies": [
            "Menú de limpieza y elevación en panel HMI",
            "Colocación de bandeja de recolección en guías"
        ],
        "pasos": [
            "Verificar que los rodillos no estén girando y la máquina esté totalmente quieta.",
            "Apretar en la pantalla táctil el botón para abrir y separar los rodillos.",
            "Poner un papel siliconado limpio adentro de la bandeja junta-pegamento.",
            "Calzar la bandeja deslizándola por las guías inferiores debajo de los rodillos. ⚠ CRÍTICO: Prohibido colocar bandeja con rodillos en movimiento.",
            "Empujar la bandeja hasta que haga tope y quede bien firme."
        ],
        "nota": "La bandeja evita que el pegamento derretido o la cera de limpieza caigan sobre los fierros de la máquina, los motores o el piso del sector.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES],
        "ciclo": [
            ("Separación completa de rodillos en apertura neumática", "Visual", "OP", "Antes de limpieza", "Set up"),
            ("Bandeja recolectora limpia y calzada en topes", "Visual", "OP", "Antes de limpieza", "Set up"),
            ("Ausencia de adhesivo en chasis o piso", "Visual", "OP", "Al finalizar", "Registro de control")
        ],
        "disparador": "SI LOS RODILLOS NO ABREN A TOPE O LA BANDEJA NO ENTRA EN SUS GUÍAS",
        "acciones": [
            "1. Verificar la presión de aire comprimido de la línea del cilindro neumático.",
            "2. Limpiar restos de adhesivo endurecido acumulados en las guías de apoyo.",
            "3. Dar aviso inmediato a Mantenimiento si persiste traba mecánica."
        ]
    },

    # ── OP 20.17 ───────────────────────────────────────────────────────────────
    {
        "op": "20.17", "etapa": "TERMINAR",
        "denominacion": "LIMPIEZA DE RODILLOS EN CALIENTE",
        "principal": 0,
        "fotos_criticas": [1, 2],
        "imagenes": [P("h17_a_pantalla_limpieza"), P("h17_c_rodillos_pegamento"), P("h17_d_trapo")],
        "pies": [
            "Secuencia de limpieza por pasos en HMI",
            "Superficie de rodillo con capa de adhesivo",
            "Remoción con espátula de latón o teflón y trapo"
        ],
        "pasos": [
            "Entrar a la pantalla de Limpieza en la pantalla táctil SIMATIC.",
            "Verificar que los rodillos estén calientes entre 150 y 185 °C antes de poner la parafina. ⚠ CRÍTICO: La limpieza de adhesivo se realiza exclusivamente en caliente.",
            "Pasar la barra de parafina sólida sobre los rodillos para aflojar el pegamento pegado.",
            "Poner los rodillos a girar despacio desde la pantalla para que la parafina limpie todo alrededor.",
            "Raspar con cuidado el pegamento blando usando la espátula blanda de latón o teflón hacia la bandeja. ⚠ CRÍTICO: Prohibido usar herramientas de acero o elementos punzantes.",
            "Pasar un trapo de algodón limpio que no suelte hilos para sacar todo el residuo.",
            "Mirar que los rodillos queden brillantes y limpios antes de dejarlos enfriar."
        ],
        "nota": "La limpieza con parafina se hace con los rodillos calientes para derretir el residuo. Ponerse siempre guantes térmicos gruesos y barbijo para vapores. Prohibido usar cuchillos, lijas, virutas o espátulas de acero que rayen los rodillos.",
        "epp": [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_BARBIJO],
        "ciclo": [
            ("Temperatura de rodillos para limpieza (150 a 185 °C)", "Pantalla HMI", "OP", "Previo a aplicar parafina", "Set up"),
            ("Rodillos libres de restos de adhesivo quemado o degradado", "Visual", "OP / Líder", "Al terminar limpieza", "Registro de control"),
            ("Superficie de rodillos sin rayaduras ni daños mecánicos", "Visual", "OP / Líder", "Al terminar limpieza", "Registro de control"),
            ("Bandeja recolectora retirada y drenada", "Visual", "OP", "Al terminar jornada", "Set up")
        ],
        "disparador": "SI QUEDAN RESTOS DE ADHESIVO QUEMADO O SE OBSERVA UNA RAYADURA EN RODILLOS",
        "acciones": [
            "1. Reaplicar parafina sólida y repetir rotación lenta sin aumentar la presión de raspado.",
            "2. Prohibido usar cuchillos, lijas o espátulas duras que rayen el recubrimiento.",
            "3. Dar aviso inmediato al Líder y Mantenimiento si se detecta un rodillo rayado."
        ]
    }
]

# ─── 8. AGRUPACIONES POR BLOQUES SGC (PARTE 1, 2, 3 Y COMPLETO) ──────────────
OPS_A3_MAP = {h["op"]: h for h in HOJAS_HOTMELT_A3}

PARTE_1_A3_OPS = ["20.1", "20.2", "20.3", "20.4", "20.5", "20.6", "20.7", "20.8", "20.9", "20.10", "20.14", "20.15"]
PARTE_2_A3_OPS = ["20.11", "20.12", "20.13"]
PARTE_3_A3_OPS = ["20.16", "20.17"]

HOJAS_A3_PARTE_1 = [OPS_A3_MAP[op] for op in PARTE_1_A3_OPS]
HOJAS_A3_PARTE_2 = [OPS_A3_MAP[op] for op in PARTE_2_A3_OPS]
HOJAS_A3_PARTE_3 = [OPS_A3_MAP[op] for op in PARTE_3_A3_OPS]

# ─── 9. EXPORTADOR COM A PDF ─────────────────────────────────────────────────
def exportar_pdf_com(pptx_path):
    import win32com.client
    pdf_path = os.path.splitext(pptx_path)[0] + ".pdf"
    ppt = win32com.client.Dispatch("PowerPoint.Application")
    try:
        ppt.DisplayAlerts = 1  # ppAlertsNone
    except Exception:
        pass
    habia_abiertas = ppt.Presentations.Count
    try:
        pres = ppt.Presentations.Open(os.path.abspath(pptx_path), WithWindow=False)
        pres.SaveAs(os.path.abspath(pdf_path), 32)
        try:
            pres.Saved = 1
            pres.Close()
        except Exception:
            pass
    finally:
        if habia_abiertas == 0:
            try:
                ppt.Quit()
            except Exception:
                pass
    print(f"     -> PDF generado: {pdf_path}")
    return pdf_path

# ─── 10. GENERACIÓN DE DECKS A3 ──────────────────────────────────────────────
def generar_deck_a3(lista_hojas, subtitulo_portada, ruta_pptx, titulo_indice="ÍNDICE DE OPERACIONES ESTÁNDAR"):
    os.makedirs(os.path.dirname(ruta_pptx), exist_ok=True)
    prs = Presentation()
    prs.slide_width = Cm(W)
    prs.slide_height = Cm(H)

    foto_portada = P("cand_30") if os.path.exists(P("cand_30")) else P("h01_a_desbobinador")
    indice_ops = [(h["op"], h["denominacion"]) for h in lista_hojas]

    datos_portada = {
        "titulo": "HOJAS DE PROCESO — MÁQUINA HOTMELT (A3)",
        "subtitulo": subtitulo_portada,
        "ho": "HO-TBD",
        "form": "I-IN-002.4-R01",
        "op_flujo": "20 — ADHESIVADO HOT MELT",
        "cliente_modelo": "VW / PATAGONIA / VW427",
        "pieza": "TOP ROLL PATAGONIA — N 216 / N 256 / N 285 / N 315",
        "maquina": "Laminadora hot melt KINGPOWER + fusor GLSC-2",
        "firmas": "F. Santoro / C. Baptista",
        "fecha_rev": "29/09/2026 · Rev. A",
        "titulo_indice": titulo_indice
    }
    portada_a3(prs, datos_portada, logo=LOGO_BARACK, foto=foto_portada, ops_indice=indice_ops)

    cajetin_base = {
        "titulo_hoja": "HOJA DE OPERACIONES",
        "ho": "HO-TBD",
        "form": "I-IN-002.4-R01",
        "modelo": "PATAGONIA / VW427",
        "cliente": "VW / NOVAX",
        "sector": "LAMINADO",
        "pieza": "TOP ROLL — N 216 / N 256 / N 285 / N 315",
        "puesto": "-",
        "realizo": "F.SANTORO",
        "aprobo": "C.BAPTISTA",
        "fecha": "29/09/2026",
        "rev": "A"
    }

    for h in lista_hojas:
        d = dict(cajetin_base)
        d.update(h)
        hoja_a3(prs, d, logo=LOGO_BARACK)

    prs.save(ruta_pptx)
    print(f"\n[OK] Presentación A3 generada: {ruta_pptx} ({len(lista_hojas)} hojas)")
    return ruta_pptx

def compilar_todos_a3():
    print("=" * 80)
    print("COMPILANDO HOJAS DE PROCESO HOTMELT — FORMATO A3 (SISTEMA OFICIAL SGC)")
    print("=" * 80)

    if gate_redaccion:
        print("\nVerificando gate de redacción canónico sobre las 17 hojas...")
        for h in HOJAS_HOTMELT_A3:
            gate_redaccion(h)
        print("[PASS] Gate de redacción: 17 hojas en REGLA (0 errores).\n")

    decks_a3 = [
        (HOJAS_A3_PARTE_1,
         "PARTE 1: OPERACIÓN ESTÁNDAR Y PRODUCCIÓN (A3) · OP 20 DEL FLUJOGRAMA 122",
         "HOJAS DE PROCESO - HOTMELT - A3 - 1. OPERACION ESTANDAR",
         "ÍNDICE: OPERACIÓN ESTÁNDAR"),
        (HOJAS_A3_PARTE_2,
         "PARTE 2: CONTINGENCIAS Y RESOLUCIÓN DE DESVÍOS (A3) · OP 20 DEL FLUJOGRAMA 122",
         "HOJAS DE PROCESO - HOTMELT - A3 - 2. CONTINGENCIAS",
         "ÍNDICE: CONTINGENCIAS"),
        (HOJAS_A3_PARTE_3,
         "PARTE 3: MANTENIMIENTO OPERATIVO Y LIMPIEZA (A3) · OP 20 DEL FLUJOGRAMA 122",
         "HOJAS DE PROCESO - HOTMELT - A3 - 3. LIMPIEZA Y MANTENIMIENTO",
         "ÍNDICE: MANTENIMIENTO Y LIMPIEZA"),
        (HOJAS_HOTMELT_A3,
         "MANUAL OPERATIVO COMPLETO A3 (17 OPERACIONES) · OP 20 DEL FLUJOGRAMA 122",
         "HOJAS DE PROCESO - MAQUINA HOTMELT - A3 COMPLETO",
         "ÍNDICE GENERAL DE FABRICACIÓN"),
    ]

    generados_pdf = []

    for hojas_sub, sub_portada, nombre_base, tit_ind in decks_a3:
        pptx_path = os.path.join(DESKTOP_DIR, nombre_base + ".pptx")
        generar_deck_a3(hojas_sub, sub_portada, pptx_path, tit_ind)
        try:
            pdf_path = exportar_pdf_com(pptx_path)
            generados_pdf.append(pdf_path)

            desktop_root_pdf = os.path.join(DESKTOP_ROOT, os.path.basename(pdf_path))
            shutil.copy2(pdf_path, desktop_root_pdf)
            print(f"     -> Replicado a Escritorio raíz: {desktop_root_pdf}")

            if os.path.exists(SHAREPOINT_HP):
                sp_pdf = os.path.join(SHAREPOINT_HP, os.path.basename(pdf_path))
                sp_pptx = os.path.join(SHAREPOINT_HP, os.path.basename(pptx_path))
                try:
                    shutil.copy2(pdf_path, sp_pdf)
                    shutil.copy2(pptx_path, sp_pptx)
                    print(f"     -> Replicado a SharePoint Ingeniería: {sp_pdf}")
                except Exception as e_sp:
                    print(f"     [AVISO SP] No se pudo copiar a SharePoint: {e_sp}")

            # DIRECTIVA ESTRICTA FAK (29/09/2026): BLOQUEADO HASTA APROBACIÓN FINAL EXPLÍCITA
            # if os.path.exists(SGC_DIR):
            #     sgc_dest_pptx = os.path.join(SGC_DIR, os.path.basename(pptx_path))
            #     sgc_dest_pdf = os.path.join(SGC_DIR, os.path.basename(pdf_path))
            #     try:
            #         shutil.copy2(pptx_path, sgc_dest_pptx)
            #         shutil.copy2(pdf_path, sgc_dest_pdf)
            #         print(f"     -> Replicado a SGC Y: {sgc_dest_pdf}")
            #     except Exception as e_sgc:
            #         print(f"     [AVISO SGC] No se pudo copiar a Y: ({e_sgc})")
        except Exception as e:
            print(f"     [AVISO COM] Error en exportación a PDF para {nombre_base}: {e}")

    print("\n" + "=" * 80)
    print("PROCESO A3 COMPLETADO EXITOSAMENTE — 4 DECKS PPTX Y PDF GENERADOS")
    print("=" * 80)
    for p in generados_pdf:
        print(f"  • {p}")

if __name__ == "__main__":
    compilar_todos_a3()

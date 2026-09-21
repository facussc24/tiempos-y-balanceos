# -*- coding: utf-8 -*-
"""
Script para actualizar y compilar el mazo completo de HOJAS DE PROCESO IMG (OP 30)
Estructura aprobada: Portada + 11 Operaciones (30.1 a 30.11).
Lámina 30.12 eliminada.
"""
import os
import sys
import shutil
from pptx import Presentation
from pptx.util import Cm, Pt

CODE_GENERAR_HOJAS_IMG = '''# -*- coding: utf-8 -*-
"""
Generador oficial de HOJAS DE OPERACIONES para la MAQUINA MOLDEADORA IMG KINGPOWER
Proyecto: Top Roll Patagonia / VW (OP 30 del Flujograma 122).
Formulario SGC oficial: I-IN-002.4-R01 (A4 apaisado 29.7 x 21.0 cm).

Estructura Oficial Aprobada (12 láminas en total):
  Slide 1: Portada e Índice General (foto panorámica de celda con pieza conformada)
  Fase 1: Puesta en Marcha y HMI
    - 30.1: Puesta en marcha general y suministros
    - 30.2: Acceso al sistema HMI y carga de receta de producción
  Fase 2: Manejo de Rollo y Alimentación (Incorporación clave solicitada)
    - 30.3: Montaje del rollo de TPO en el desbobinador
    - 30.4: Enhebrado y pasada de lámina hacia la mesa
    - 30.5: Cambio de rollo por fin de material
  Fase 3: Operación en Modo Automático
    - 30.6: Inspección y limpieza de cavidad de molde verde
    - 30.7: Ciclo automático de calentamiento y conformado IMG
    - 30.8: Enfriamiento, corte de vacío y desmolde
  Fase 4: Calidad y Punto Crítico VW
    - 30.9: Criterios de calidad y punto crítico VW (Airbag S=10)
  Fase 5: Set-up / Cambio de Molde
    - 30.10: Set-up / Cambio de molde: Desconexión y amarre con puente grúa
    - 30.11: Set-up / Cambio de molde: Extracción sobre carro rodante

Criterios de Calidad y Estilo:
  - 100% fotos reales de planta y fotogramas de video (0% sintéticas / IA).
  - Ciclo de control vaciado (campos limpios esperando Plan de Control de Calidad).
  - Layout limpio: 1 foto principal preponderante por lámina.
  - Redacción en estilo infinitivo instruccional ("Verificar", "Montar", "Accionar").
  - Triángulo amarillo normalizado VW en la foto y en el texto (punto crítico Airbag S=10).
  - Terminología técnica argentina de planta ("puente grúa", "cajón de scrap", "cáncamos giratorios", "eje neumático expansible", "buje de cartón", "marco tensor", "clamps").
  - Lámina 30.12 (topes rojos de transporte) eliminada definitivamente.
"""
import os
import sys
import shutil
import functools
from PIL import Image, ImageFont
from pptx import Presentation
from pptx.util import Cm, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ─── PALETA CORPORATIVA SGC ──────────────────────────────────────────────────
AZUL        = RGBColor(0x44, 0x54, 0x6A)  # Azul oscuro cabeceras (#44546A)
AZUL2       = RGBColor(0x44, 0x72, 0xC4)  # Azul banda seguridad (#4472C4)
AZUL_TEXTO  = RGBColor(0x1F, 0x49, 0x7D)  # Azul énfasis texto (#1F497D)
BLANCO      = RGBColor(0xFF, 0xFF, 0xFF)
NEGRO       = RGBColor(0x00, 0x00, 0x00)
GRISF       = RGBColor(0xF2, 0xF2, 0xF2)  # Gris fondo celdas secundarias
AMARILLO_VW = RGBColor(0xFF, 0xD7, 0x00)  # Amarillo normalizado VW (#FFD700)
ROJO_BORDE  = RGBColor(0xC0, 0x00, 0x00)  # Borde rojo punto crítico (#C00000)

# ─── GEOMETRÍA OFICIAL FORMULARIO I-IN-002.4-R01 (cm) ────────────────────────
W, H = 29.7, 21.0
M = 0.70
X0, X1 = M, W - M                        # 0.70 .. 29.00 (ancho útil 28.30 cm)
HDR_Y, HDR_H = M, 4.00                   # 0.70 .. 4.70 cm

BODY_Y, BODY_H = 4.90, 9.90              # 4.90 .. 14.80 cm
IMG_W = 16.20
IMG_X = X0
DSC_X = X0 + IMG_W + 0.25                # 17.15 cm
DSC_W = X1 - DSC_X                       # 11.85 cm

CIC_Y, CIC_H = 15.00, 3.10               # 15.00 .. 18.10 cm
EPP_W = 6.40
CIC_W = X1 - X0 - EPP_W - 0.25           # 21.65 cm
EPP_X = X0 + CIC_W + 0.25                # 22.60 cm

PLN_Y = 18.30                            # 18.30 .. 20.30 cm
PLN_H = H - M - PLN_Y                    # 2.00 cm

# ─── RUTAS DE ACTIVOS LOCALES (100% REALES) ──────────────────────────────────
BASE_DIR = r"c:\\Dev\\BarackMercosul\\scripts\\img"
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
DESKTOP_DIR = r"C:\\Users\\FacundoS-PC\\OneDrive - BARACK ARGENTINA SRL\\Desktop\\Hojas de proceso maquina IMG - desde los videos\\_trabajo"
HOTMELT_GEN = r"C:\\Users\\FacundoS-PC\\OneDrive - BARACK ARGENTINA SRL\\Desktop\\Hojas de proceso maquina HOTMELT - desde los videos\\_trabajo\\generador"
EPP_DIR = os.path.join(HOTMELT_GEN, "epp")

LOGO_BARACK = r"C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\INGENIERIA BARACK (NUNCA BORRAR)\\barack_logo.png"

# Iconos EPP
ICO_ROPA     = os.path.join(EPP_DIR, "ico_13756.png")
ICO_CALZADO  = os.path.join(EPP_DIR, "ico_4449.png")
ICO_GUANTES  = os.path.join(EPP_DIR, "ico_11789.png")
ICO_ANTEOJOS = os.path.join(EPP_DIR, "ico_16034.png")
ICO_AUDITIVA = os.path.join(EPP_DIR, "ico_12924.png")

EPP_STD = [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_ANTEOJOS, ICO_AUDITIVA]
EPP_MOLD_CHANGE = [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_ANTEOJOS]

# ─── TIPOGRAFÍA Y MEDICIÓN REAL ──────────────────────────────────────────────
_TTF = {
    "Calibri": r"C:\\Windows\\Fonts\\calibri.ttf",
    "Calibri-b": r"C:\\Windows\\Fonts\\calibrib.ttf",
    "Arial": r"C:\\Windows\\Fonts\\arial.ttf",
    "Arial-b": r"C:\\Windows\\Fonts\\arialbd.ttf"
}
PT_CM = 0.03527777

@functools.lru_cache(maxsize=512)
def _fuente(nombre, bold, px):
    ruta = _TTF.get(nombre + ("-b" if bold else ""), _TTF["Calibri"])
    return ImageFont.truetype(ruta, max(int(px), 4))

def _ancho_cm(texto, size, fuente, bold):
    f = _fuente(fuente, bold, round(size * 96 / 72))
    return f.getlength(texto) / 96 * 2.54

def _achicar(texto, w_cm, h_cm, base, margen=0.06, minimo=5.5, fuente="Calibri", bold=False):
    if not texto:
        return base
    util_w = max(w_cm - 2 * margen - 0.24, 0.4)
    util_h = max(h_cm - 0.10, 0.2)
    palabras = str(texto).split()
    s = base
    while s >= minimo:
        lh = 1.22 * s * PT_CM
        lineas, actual = 1, ""
        cabe = True
        for p in palabras:
            if _ancho_cm(p, s, fuente, bold) > util_w:
                cabe = False
                break
            probar = (actual + " " + p) if actual else p
            if _ancho_cm(probar, s, fuente, bold) <= util_w:
                actual = probar
            else:
                lineas += 1
                actual = p
        if cabe and lineas * lh <= util_h:
            return s
        s -= 0.5
    return minimo

def _lineas_wrap(texto, size, w_cm, bold=False, fuente="Calibri"):
    lineas, actual = 1, ""
    for p in texto.split():
        probar = (actual + " " + p) if actual else p
        if _ancho_cm(probar, size, fuente, bold) <= w_cm:
            actual = probar
        else:
            lineas += 1
            actual = p
    return lineas

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
         anchor=MSO_ANCHOR.MIDDLE, fuente="Calibri", margen=0.06):
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Cm(margen)
    tf.margin_top = tf.margin_bottom = Cm(0.02)
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = texto
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    r.font.name = fuente
    return sh

def _celda(slide, x, y, w, h, texto="", relleno=BLANCO, borde=NEGRO,
           ancho=Pt(1), ajustar=True, **kw):
    sh = _caja(slide, x, y, w, h, relleno, borde, ancho)
    if texto != "":
        if ajustar:
            kw["size"] = _achicar(texto, w, h, kw.get("size", 11),
                                  kw.get("margen", 0.06),
                                  fuente=kw.get("fuente", "Calibri"),
                                  bold=kw.get("bold", False))
        _txt(sh, texto, **kw)
    return sh

def _banda(slide, x, y, w, h, texto, size=11, azul=AZUL):
    return _celda(slide, x, y, w, h, texto, relleno=azul, size=size, bold=True, color=BLANCO)

# ─── 1. CAJETÍN OFICIAL (I-IN-002.4-R01) ─────────────────────────────────────
C_OP, C_DEN, C_CLI, C_PUE = 3.40, 10.60, 4.20, 3.00
C_LAB, C_VAL = 2.80, 4.30
C_MOD = C_CLI + C_PUE

def cajetin(slide, d, logo=None):
    top_h = 1.60
    fila = (HDR_H - top_h) / 4

    lw, rw = 4.30, C_LAB + C_VAL
    # Celda de logo limpia en fondo blanco
    _caja(slide, X0, HDR_Y, lw, top_h, BLANCO, borde=NEGRO, ancho=Pt(1))
    if logo and os.path.exists(logo):
        im = Image.open(logo)
        ar = im.width / im.height
        ih = min(top_h - 0.30, (lw - 0.50) / ar)
        iw = ih * ar
        slide.shapes.add_picture(logo, Cm(X0 + (lw - iw) / 2),
                                 Cm(HDR_Y + (top_h - ih) / 2), Cm(iw), Cm(ih))

    _celda(slide, X0 + lw, HDR_Y, X1 - X0 - lw - rw, top_h,
           d.get("titulo_hoja", "HOJA DE OPERACIONES"), size=24, bold=True)
    _celda(slide, X1 - rw, HDR_Y, rw, top_h * 0.42,
           f"Form: {d.get('form', 'I-IN-002.4-R01')}", size=10.5, bold=True)
    _celda(slide, X1 - rw, HDR_Y + top_h * 0.42, rw, top_h * 0.58,
           d.get("ho", "HO-TBD"), size=20, bold=True)

    y = HDR_Y + top_h
    izq = [
        [("N° DE OPERACIÓN", C_OP), ("DENOMINACION DE LA OPERACIÓN", C_DEN),
         ("MODELO O VEHICULO", C_MOD)],
        [(d.get("op", ""), C_OP), (d.get("denominacion", ""), C_DEN),
         (d.get("modelo", ""), C_MOD)],
        [("SECTOR", C_OP), ("COD. DE PIEZA / DESCRIPCION", C_DEN),
         ("CLIENTE", C_CLI), ("N° PUESTO", C_PUE)],
        [(d.get("sector", ""), C_OP), (d.get("pieza", ""), C_DEN),
         (d.get("cliente", ""), C_CLI), (d.get("puesto", "-"), C_PUE)],
    ]
    der = [("REALIZO:", d.get("realizo", "")), ("APROBO:", d.get("aprobo", "")),
            ("FECHA:", d.get("fecha", "")), ("REV.", d.get("rev", "A"))]

    for i, fila_datos in enumerate(izq):
        etiqueta = (i % 2 == 0)
        yy = y + i * fila
        x = X0
        for texto, an in fila_datos:
            _celda(slide, x, yy, an, fila, str(texto),
                   relleno=(AZUL if etiqueta else BLANCO),
                   color=(BLANCO if etiqueta else NEGRO),
                   size=(8 if etiqueta else 9.5),
                   bold=(not etiqueta))
            x += an
        lab, val = der[i]
        _celda(slide, x, yy, C_LAB, fila, lab, relleno=AZUL, color=BLANCO,
               size=8.5, align=PP_ALIGN.LEFT, margen=0.12)
        _celda(slide, x + C_LAB, yy, C_VAL, fila, str(val),
               size=9.5, bold=True)

# ─── 2. BLOQUE DE IMÁGENES CON TRIÁNGULO VW ──────────────────────────────────
def bloque_imagenes(slide, imagenes, punto_critico=None):
    _banda(slide, IMG_X, BODY_Y, IMG_W, 0.60, "IMÁGENES", size=12)
    y0 = BODY_Y + 0.60
    h = BODY_H - 0.60
    _caja(slide, IMG_X, y0, IMG_W, h, BLANCO, borde=NEGRO, ancho=Pt(1))

    imgs_ok = [i for i in imagenes if os.path.exists(i)]
    if not imgs_ok:
        return

    # 1 imagen principal preponderante
    W_util, H_util = IMG_W - 0.30, h - 0.30
    if len(imgs_ok) == 1:
        ruta = imgs_ok[0]
        im = Image.open(ruta)
        ar = im.width / im.height
        iw, ih = (W_util, W_util / ar) if W_util / ar <= H_util else (H_util * ar, H_util)
        px = IMG_X + 0.15 + (W_util - iw) / 2
        py = y0 + 0.15 + (H_util - ih) / 2
        slide.shapes.add_picture(ruta, Cm(px), Cm(py), Cm(iw), Cm(ih))

        # Triángulo amarillo de punto crítico VW si aplica
        if punto_critico:
            rx = punto_critico.get("rel_x", 0.5)
            ry = punto_critico.get("rel_y", 0.5)
            tw, th = 0.85, 0.90
            tx = px + iw * rx - tw / 2
            ty = py + ih * ry - th / 2
            
            tri = slide.shapes.add_shape(MSO_SHAPE.ISOSCELES_TRIANGLE, Cm(tx), Cm(ty), Cm(tw), Cm(th))
            tri.fill.solid()
            tri.fill.fore_color.rgb = AMARILLO_VW
            tri.line.color.rgb = ROJO_BORDE
            tri.line.width = Pt(1.5)
            if "rot" in punto_critico:
                tri.rotation = punto_critico["rot"]
            
            # Etiqueta de aviso punto crítico
            lbl_w, lbl_h = 2.60, 0.55
            lbl_x = tx + tw + 0.10 if (tx + tw + lbl_w) < (IMG_X + IMG_W) else tx - lbl_w - 0.10
            lbl = _celda(slide, lbl_x, ty + (th - lbl_h)/2, lbl_w, lbl_h,
                         punto_critico.get("texto", "▲ CRÍTICO VW"),
                         relleno=AMARILLO_VW, borde=ROJO_BORDE, ancho=Pt(1.2),
                         size=8, bold=True, color=ROJO_BORDE)
    else:
        w_cada = (W_util - 0.20) / len(imgs_ok)
        for k, ruta in enumerate(imgs_ok):
            im = Image.open(ruta)
            ar = im.width / im.height
            iw, ih = (w_cada, w_cada / ar) if w_cada / ar <= H_util else (H_util * ar, H_util)
            px = IMG_X + 0.15 + k * (w_cada + 0.20) + (w_cada - iw) / 2
            py = y0 + 0.15 + (H_util - ih) / 2
            slide.shapes.add_picture(ruta, Cm(px), Cm(py), Cm(iw), Cm(ih))

# ─── 3. BLOQUE DE DESCRIPCIÓN DE LA OPERACIÓN ────────────────────────────────
def bloque_pasos(slide, pasos, nota=None):
    _banda(slide, DSC_X, BODY_Y, DSC_W, 0.60, "DESCRIPCION DE LA OPERACIÓN", size=12)
    y = BODY_Y + 0.60
    h = BODY_H - 0.60
    sh = _caja(slide, DSC_X, y, DSC_W, h, BLANCO, borde=NEGRO, ancho=Pt(1))
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Cm(0.25)
    tf.margin_top = Cm(0.20)

    util_h = h - 0.70
    util_w = DSC_W - 2 * 0.25 - 0.85
    size = 12.0
    while size > 7.0:
        lh = 1.22 * size * PT_CM
        sep = (6 if size >= 10 else 4) * PT_CM
        alto = 0
        for t in pasos:
            alto += _lineas_wrap(t, size, util_w, False) * lh + sep
        if nota:
            sn = max(size - 1, 7.5)
            alto += (_lineas_wrap(nota, sn, DSC_W - 2 * 0.25, True) * 1.22 * sn * PT_CM + 5 * PT_CM)
        if alto <= util_h:
            break
        size -= 0.5

    for i, texto in enumerate(pasos):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(4.0 if size >= 10.0 else 2.5)
        
        # Marcador numerado
        r = p.add_run()
        r.text = f"{i+1}.  "
        r.font.size = Pt(size)
        r.font.bold = True
        r.font.name = "Calibri"
        r.font.color.rgb = NEGRO

        # Texto del paso (detecta si empieza con ▲)
        r2 = p.add_run()
        r2.text = texto
        r2.font.size = Pt(size)
        r2.font.name = "Calibri"
        if "▲" in texto or "Punto Crítico" in texto:
            r2.font.bold = True
            r2.font.color.rgb = RGBColor(0xB2, 0x22, 0x22)  # Rojo oscuro para destacar
        else:
            r2.font.color.rgb = NEGRO

    if nota:
        p = tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_before = Pt(3.0)
        r = p.add_run()
        r.text = "NOTA: " + nota
        r.font.size = Pt(max(size - 1, 7.5))
        r.font.bold = True
        r.font.name = "Calibri"
        r.font.color.rgb = AZUL_TEXTO

# ─── 4. BLOQUE CICLO DE CONTROL (VACIADO SEGÚN SGC / FAK) ────────────────────
COLS_CIC = [("Características a controlar", 8.0), ("Método de control", 5.6),
            ("Resp.", 2.7), ("Frec.", 2.9), ("Registro", 3.4)]

def bloque_ciclo(slide, filas=None):
    _banda(slide, X0, CIC_Y, CIC_W, 0.55, "CICLO DE CONTROL", size=12)
    y = CIC_Y + 0.55
    total = sum(w for _, w in COLS_CIC)
    anchos = [w / total * CIC_W for _, w in COLS_CIC]
    hh = 0.48
    x = X0
    for (lab, _), an in zip(COLS_CIC, anchos):
        _celda(slide, x, y, an, hh, lab, relleno=AZUL, color=BLANCO, size=8.5, bold=True)
        x += an
    y += hh
    
    # Filas limpias con bordes intactos listas para Calidad
    filas = filas or [("", "", "", "", ""), ("", "", "", "", "")]
    fh = (CIC_Y + CIC_H - y) / len(filas)
    for f in filas:
        x = X0
        for val, an in zip(f, anchos):
            _celda(slide, x, y, an, fh, str(val), size=8.5)
            x += an
        y += fh

# ─── 5. ELEMENTOS DE SEGURIDAD (EPP) ─────────────────────────────────────────
def bloque_epp(slide, iconos, refs=("OP - Operador de Producción", "OC - Operador de Calidad")):
    _banda(slide, EPP_X, CIC_Y, EPP_W, 0.55, "ELEMENTOS DE SEGURIDAD", size=9, azul=AZUL2)
    y = CIC_Y + 0.55
    h = CIC_H - 0.55 - 0.44 * len(refs)
    _caja(slide, EPP_X, y, EPP_W, h, BLANCO, borde=NEGRO, ancho=Pt(1))
    
    iconos_ok = [ic for ic in (iconos or []) if os.path.exists(ic)]
    if iconos_ok:
        n = len(iconos_ok)
        cw = (EPP_W - 0.20) / n
        s = min(cw - 0.10, h - 0.16)
        for k, ic in enumerate(iconos_ok):
            cx = EPP_X + 0.10 + k * cw + (cw - s) / 2
            slide.shapes.add_picture(ic, Cm(cx), Cm(y + (h - s) / 2), Cm(s), Cm(s))

    yr = y + h
    for r in refs:
        _celda(slide, EPP_X, yr, EPP_W, 0.44, f"Referencia: {r}", size=7,
               align=PP_ALIGN.LEFT, margen=0.12)
        yr += 0.44

# ─── 6. PLAN DE REACCIÓN ANTE NO CONFORME ────────────────────────────────────
FIJAS = ["DETENGA LA OPERACIÓN",
         "NOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR",
         "ESPERE LA DEFINICION DEL LIDER O SUPERVISOR"]

def bloque_plan(slide, disparador, acciones=None):
    _banda(slide, X0, PLN_Y, X1 - X0, 0.48, "PLAN DE REACCION ANTE NO CONFORME", size=11)
    y = PLN_Y + 0.48
    hh = PLN_H - 0.48
    izq = 15.20

    _celda(slide, X0, y, izq, hh * 0.28, disparador, size=8.5, bold=True,
           fuente="Arial", relleno=GRISF, align=PP_ALIGN.LEFT, margen=0.15)
    fy = y + hh * 0.28
    fh = (hh * 0.72) / 3
    for t in FIJAS:
        _celda(slide, X0, fy, izq, fh, t, size=8.5, bold=True, fuente="Arial",
               align=PP_ALIGN.LEFT, margen=0.15)
        fy += fh

    der = X1 - X0 - izq
    sh = _caja(slide, X0 + izq, y, der, hh, BLANCO, borde=NEGRO, ancho=Pt(1))
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Cm(0.20)
    tf.margin_top = Cm(0.10)

    acciones = acciones or [
        "1. Segregar e identificar el material afectado en contenedor rojo.",
        "2. Dar aviso según procedimiento P-09/I.",
        "3. No reiniciar la producción sin autorización del Líder o Calidad."
    ]
    for i, t in enumerate(acciones):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(2)
        r = p.add_run()
        r.text = t
        r.font.size = Pt(8.5)
        r.font.name = "Arial"
        r.font.color.rgb = NEGRO

# ─── 7. PORTADA LIMPIA CORPORATIVA ───────────────────────────────────────────
def portada(prs, d, logo=None, foto=None, indice=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _caja(slide, X0, M, X1 - X0, H - 2 * M, BLANCO, borde=NEGRO, ancho=Pt(1.5))

    # Cabecera superior limpia: recuadro con borde corporativo
    cab_h = 3.20
    _caja(slide, X0, M, X1 - X0, cab_h, BLANCO, borde=AZUL, ancho=Pt(1.5))
    _caja(slide, X0, M + cab_h - 0.08, X1 - X0, 0.08, AZUL, borde=AZUL)

    # Logo Barack sobre blanco puro
    lw = 5.20
    if logo and os.path.exists(logo):
        im = Image.open(logo)
        ar = im.width / im.height
        ih = min(cab_h - 0.60, (lw - 0.80) / ar)
        iw = ih * ar
        slide.shapes.add_picture(logo, Cm(X0 + (lw - iw) / 2),
                                 Cm(M + (cab_h - ih) / 2), Cm(iw), Cm(ih))

    # Título y Subtítulo en azul corporativo
    tx = X0 + lw + 0.20
    tw = X1 - X0 - lw - 0.40
    _celda(slide, tx, M + 0.40, tw, 1.40,
           d.get("titulo", "HOJAS DE PROCESO — MÁQUINA MOLDEADORA IMG"),
           size=24, bold=True, color=AZUL, relleno=BLANCO, borde=None, align=PP_ALIGN.LEFT)
    _celda(slide, tx, M + 1.80, tw, 1.00,
           d.get("subtitulo", "Conformado al vacío In-Mold Graining (IMG) · OP 30 del FLUJOGRAMA 122 TOP ROLL PATAGONIA"),
           size=11.5, bold=False, color=AZUL2, relleno=BLANCO, borde=None, align=PP_ALIGN.LEFT)

    # Cuerpo: Foto grande a la izquierda
    y_body = M + cab_h + 0.35
    fw = 13.80
    bh = H - M - y_body - 0.10
    _caja(slide, X0 + 0.10, y_body, fw, bh, BLANCO, borde=AZUL, ancho=Pt(1))
    if foto and os.path.exists(foto):
        im = Image.open(foto)
        ar = im.width / im.height
        iw, ih = (fw - 0.20, (fw - 0.20) / ar) if (fw - 0.20) / ar <= (bh - 0.20) else ((bh - 0.20) * ar, bh - 0.20)
        slide.shapes.add_picture(foto, Cm(X0 + 0.10 + (fw - iw) / 2),
                                 Cm(y_body + (bh - ih) / 2), Cm(iw), Cm(ih))

    # Ficha + Índice a la derecha
    xd = X0 + fw + 0.50
    wd = X1 - xd - 0.10
    filas = [
        ("Documento SGC", d.get("ho", "HO-TBD")),
        ("Formulario Oficial", d.get("form", "I-IN-002.4-R01")),
        ("Operación Flujograma", d.get("op_flujo", "30 — CONFORMADO AL VACÍO IMG")),
        ("Cliente / Modelo", d.get("cliente_modelo", "VW / PATAGONIA")),
        ("Pieza / Conjunto", d.get("pieza", "TOP ROLL PATAGONIA — N 216 / N 256 / N 285 / N 315")),
        ("Máquina / Celda", d.get("maquina", "Moldeadora IMG KINGPOWER (Molde Hembra)")),
        ("Realizó / Aprobó", d.get("firmas", "F. Santoro / C. Baptista")),
        ("Fecha / Revisión", d.get("fecha_rev", "08/09/2026  ·  Rev. A"))
    ]
    fh = 0.62
    for i, (k, v) in enumerate(filas):
        _celda(slide, xd, y_body + i * fh, wd * 0.38, fh, k, relleno=AZUL, color=BLANCO,
               size=8.5, align=PP_ALIGN.LEFT, margen=0.10)
        _celda(slide, xd + wd * 0.38, y_body + i * fh, wd * 0.62, fh, str(v), size=9.0,
               bold=True, align=PP_ALIGN.LEFT, margen=0.10)

    yi = y_body + len(filas) * fh + 0.25
    _banda(slide, xd, yi, wd, 0.48, "HOJAS DE ESTE DOCUMENTO", size=10)
    sh = _caja(slide, xd, yi + 0.48, wd, (H - M) - (yi + 0.48) - 0.10, BLANCO, borde=NEGRO, ancho=Pt(1))
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Cm(0.18)
    tf.margin_top = Cm(0.10)

    for i, (num, nom) in enumerate(indice or []):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(2.0)
        r = p.add_run()
        r.text = f"{num}   "
        r.font.size = Pt(8.0)
        r.font.bold = True
        r.font.name = "Calibri"
        r.font.color.rgb = AZUL
        r2 = p.add_run()
        r2.text = nom
        r2.font.size = Pt(8.0)
        r2.font.name = "Calibri"
        r2.font.color.rgb = NEGRO
    return slide

# ─── 8. GENERADOR DE HOJA INDIVIDUAL ─────────────────────────────────────────
def hoja(prs, d, logo=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    cajetin(slide, d, logo)
    bloque_imagenes(slide, d.get("imagenes", []), d.get("punto_critico"))
    bloque_pasos(slide, d.get("pasos", []), d.get("nota"))
    bloque_ciclo(slide, d.get("ciclo", []))
    bloque_epp(slide, d.get("epp", EPP_STD), d.get("refs", ("OP - Operador de Producción", "OC - Operador de Calidad")))
    bloque_plan(slide, d.get("disparador", 'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME'), d.get("acciones"))
    return slide

# ─── DATOS DE LAS OPERACIONES (OP 30 — IMG) ──────────────────────────────────
CAJETIN_BASE = dict(
    titulo_hoja="HOJA DE OPERACIONES",
    ho="HO-TBD",
    form="I-IN-002.4-R01",
    modelo="PATAGONIA",
    cliente="VW",
    sector="MOLDEO IMG",
    pieza="TOP ROLL PATAGONIA — N 216 / N 256 / N 285 / N 315",
    puesto="-",
    realizo="F. Santoro",
    aprobo="C. Baptista",
    fecha="08/09/2026",
    rev="A",
)

PORTADA_IMG = dict(
    titulo="HOJAS DE PROCESO — MÁQUINA MOLDEADORA IMG",
    subtitulo="Conformado al vacío In-Mold Graining (IMG) · OP 30 del FLUJOGRAMA 122 TOP ROLL PATAGONIA",
    ho="HO-TBD",
    form="I-IN-002.4-R01",
    op_flujo="30 — CONFORMADO AL VACÍO IMG",
    cliente_modelo="VW / PATAGONIA",
    pieza="TOP ROLL PATAGONIA — N 216 / N 256 / N 285 / N 315",
    maquina="Moldeadora In-Mold Graining KINGPOWER (Molde Hembra)",
    firmas="F. Santoro / C. Baptista",
    fecha_rev="08/09/2026  ·  Rev. A",
    foto=r"C:\\Dev\\_telefono\\_vista\\2026-09-03_IMG_0623.jpg",
)

HOJAS_IMG = [
    # ── FASE 1: PUESTA EN MARCHA Y HMI ──
    dict(
        op="30.1",
        denominacion="PUESTA EN MARCHA GENERAL Y SUMINISTROS",
        imagenes=[r"C:\\Dev\\_telefono\\2026-09-04\\_frames\\IMG_0645\\IMG_0645_0001.jpg"],
        pasos=[
            "Verificar el suministro eléctrico principal accionando el seccionador rotativo general de la máquina en el gabinete de potencia.",
            "Comprobar la presión en la línea de aire comprimido en el manómetro principal (mínimo 0.60 MPa / 6 bar; valor nominal de trabajo +0.59 MPa).",
            "Verificar la circulación del circuito cerrado de agua de enfriamiento del molde (chiller en servicio, temperatura 18-22 °C, sin pérdidas).",
            'Pulsar el botón verde "POWER START" en la botonera de comando principal para energizar los servomotores y controles.',
            "Constatar que las paradas de emergencia (setas perimetrales y cortinas ópticas de seguridad) se encuentren liberadas y sin fallas activas."
        ],
        nota="Antes de energizar, verificar que el área interna de conformado y las inmediaciones del carro estén despejadas de herramientas y personal ajeno.",
        epp=EPP_STD,
        disparador='SI DETECTA ANOMALÍA EN SUMINISTRO O FALLA DE ENERGIZACIÓN',
        acciones=[
            "1. Sacar la máquina de servicio e identificarla con tarjeta de bloqueo.",
            "2. Dar aviso inmediato al Líder de Producción y Mantenimiento.",
            "3. Aguardar la intervención del personal técnico autorizado."
        ]
    ),
    dict(
        op="30.2",
        denominacion="ACCESO AL SISTEMA HMI Y CARGA DE RECETA DE PRODUCCIÓN",
        imagenes=[r"C:\\Dev\\_telefono\\2026-09-04\\_frames\\IMG_0645\\IMG_0645_0311.jpg"],
        pasos=[
            'Aguardar la inicialización del software en la pantalla táctil HMI ("Moldeadora Hembra") y seleccionar idioma español.',
            "Ingresar el PIN de seguridad de operador (1688) en el teclado táctil para habilitar el nivel de operación.",
            "Seleccionar en el menú de recetas la configuración correspondiente a Top Roll Patagonia (versión Delantera / Trasera).",
            "Verificar consignas de temperatura de conformado: Temperatura 1 = 135,0 °C, Temperatura 2 = 165,0 °C y tiempo de estirado = 5,0 s.",
            "Comprobar consigna de vacío en -0,50 MPa, presión de asistencia neumática en +0,59 MPa (mín. +0,20 MPa) y activar el calentamiento zonal."
        ],
        nota="El PIN 1688 habilita funciones de producción. Todos los parámetros térmicos y de vacío deben coincidir con la receta validada en TryOut.",
        epp=EPP_STD,
        disparador='SI DETECTA PARÁMETROS FUERA DE RANGO O FALLA EN PANTALLA HMI',
        acciones=[
            "1. No iniciar el ciclo automático de conformado.",
            "2. Dar aviso al Líder de Producción y especialista de Proceso.",
            "3. Revalidar la receta activa antes de habilitar la celda."
        ]
    ),

    # ── FASE 2: MANEJO DE ROLLO Y ALIMENTACIÓN ──
    dict(
        op="30.3",
        denominacion="MONTAJE DEL ROLLO DE TPO EN EL DESBOBINADOR",
        imagenes=[r"c:\\Dev\\BarackMercosul\\scripts\\img\\assets\\30.3_rollo_desbobinador.jpg"],
        pasos=[
            "Verificar etiqueta, código de material y número de lote de la bobina de TPO contra la orden de producción activa.",
            "Introducir el eje expansible neumático a través del buje de cartón central del rollo de TPO.",
            "Centrar el rollo con respecto a las marcas milimetradas del eje para asegurar la simetría de alimentación.",
            "Acoplar la pistola de aire comprimido a la válvula del eje e inflar a la presión de trabajo para fijar mecánicamente el buje.",
            "Calzar el eje entre dos operarios sobre las chumaceras del desbobinador y habilitar el freno neumático de tensión."
        ],
        nota="Realizar la maniobra de montaje de la bobina entre dos personas para evitar sobreesfuerzos y garantizar un apoyo suave en los soportes.",
        epp=EPP_STD,
        disparador='SI DETECTA ROLLO DAÑADO, DESALINEACIÓN O PÉRDIDA EN EJE',
        acciones=[
            "1. No cargar bobinas golpeadas, deformadas o con etiquetas dudosas.",
            "2. Purgar y re-inflar el eje expansible verificando que no pierda aire.",
            "3. Notificar al Líder de Producción ante cualquier desvío de lote."
        ]
    ),
    dict(
        op="30.4",
        denominacion="ENHEBRADO Y PASADA DE LÁMINA HACIA LA MESA",
        imagenes=[r"c:\\Dev\\BarackMercosul\\scripts\\img\\assets\\30.4_enhebrado_material.jpg"],
        pasos=[
            "Desenrollar manualmente el extremo libre de la bobina de TPO tirando hacia la entrada de la moldeadora.",
            "Pasar la banda de material a través del tren de rodillos guía y compensadores de tensión del cabezal trasero.",
            "Guiar la lámina por la garganta de entrada hacia la mesa de conformado, con la cara del grano texturado orientada hacia arriba.",
            "Alinear los laterales de la banda contra las guías de escuadra para asegurar un avance centrado y parejo.",
            "Accionar el avance manual hasta posicionar el material en el marco tensor, comprobando que no se generen pliegues ni arrugas."
        ],
        nota="Mantener las manos alejadas de los rodillos durante la pasada del material y verificar que la lámina quede libre de suciedad superficial.",
        epp=EPP_STD,
        disparador='SI DETECTA CRUCE DE LÁMINA, ARRUGAS O DESVÍO DE GUÍAS',
        acciones=[
            "1. Detener el avance manual del material.",
            "2. Reacomodar la banda sobre los rodillos tensores eliminando pliegues.",
            "3. Verificar la alineación contra topes antes de fijar con los clamps."
        ]
    ),
    dict(
        op="30.5",
        denominacion="CAMBIO DE ROLLO POR FIN DE MATERIAL",
        imagenes=[r"c:\\Dev\\BarackMercosul\\scripts\\img\\assets\\30.5_cabezal_alimentador.jpg"],
        pasos=[
            "Al detectar el aviso de fin de rollo o el corte de la lámina, detener inmediatamente el avance de tracción de la máquina.",
            "Conectar el pico de descompresión a la válvula del eje expansible para despresurizar el cilindro y liberar el agarre del buje.",
            "Retirar el buje de cartón vacío de los apoyos del desbobinador y colocarlo en el contenedor de reciclaje correspondiente.",
            "Montar y presurizar la nueva bobina de TPO sobre el eje expansible siguiendo el procedimiento indicado en la hoja 30.3.",
            "Enhebrar la punta de la nueva lámina a través de los rodillos según hoja 30.4 y reanudar el avance en modo manual hasta restablecer el ciclo."
        ],
        nota="Ante parada por cambio de rollo, verificar que el área de alimentación esté despejada antes de restablecer el avance en automático.",
        epp=EPP_STD,
        disparador='SI SE PRODUCE ATASCAMIENTO O FALLA EN ALIMENTACIÓN DE ROLLO',
        acciones=[
            "1. Detener el avance de lámina e interrumpir la tracción.",
            "2. Cortar el tramo de material arrugado o defectuoso con cutter de seguridad.",
            "3. Re-enhebrar el extremo recto y limpio antes de reiniciar producción."
        ]
    ),

    # ── FASE 3: OPERACIÓN EN MODO AUTOMÁTICO ──
    dict(
        op="30.6",
        denominacion="INSPECCIÓN Y LIMPIEZA DE CAVIDAD DE MOLDE VERDE",
        imagenes=[r"C:\\Dev\\_telefono\\2026-09-03\\_frames\\IMG_0631\\IMG_0631_0015.jpg"],
        pasos=[
            "Asegurar la detención total del ciclo y abrir la protección frontal de acceso a la cavidad de moldeo.",
            "Inspeccionar visualmente la superficie micro-porosa niquelada del molde verde para descartar polvo, rebabas o partículas extrañas.",
            "Soplar la cavidad y las micro-ranuras de vacío utilizando la pistola de aire comprimido seco, sin golpear el grabado con la boquilla.",
            "Verificar que los sellos de silicona perimetrales y los cilindros de asistencia neumática se encuentren limpios y en correcto estado.",
            "Constatar que la temperatura superficial del molde se mantenga dentro del rango operativo indicado por el chiller de enfriamiento."
        ],
        nota="Queda terminantemente prohibido el uso de espátulas metálicas, destornilladores o lijas sobre la cavidad para no dañar el grabado del grano.",
        epp=EPP_STD,
        disparador='SI DETECTA MARCAS, SUCIEDAD ADHERIDA O DAÑO EN CAVIDAD',
        acciones=[
            "1. No iniciar el ciclo de conformado con la cavidad sucia o marcada.",
            "2. Limpiar exclusivamente con paño limpio que no desprenda hilachas y aire.",
            "3. Avisar al Líder si se observan rayaduras en la superficie niquelada."
        ]
    ),
    dict(
        op="30.7",
        denominacion="CICLO AUTOMÁTICO DE CALENTAMIENTO Y CONFORMADO IMG",
        imagenes=[r"c:\\Dev\\BarackMercosul\\scripts\\img\\assets\\30.7_ciclo_automatico.jpg"],
        pasos=[
            "Verificar que la zona de moldeo esté despejada y que las cortinas ópticas de seguridad no presenten ninguna interrupción.",
            "Presionar en simultáneo ambos pulsadores bimanuales de arranque en la consola para dar inicio a la secuencia automática.",
            "El marco superior desciende y avanza la matriz de calefactores en carrera continua sobre la lámina para el calentamiento zonificado.",
            "La máquina efectúa el cierre hermético del marco tensor con los clamps neumáticos perimetrales sobre el molde verde.",
            "El sistema aplica la secuencia de vacío asistido (-0,50 MPa) con soporte neumático (+0,59 MPa) copiando el grano de la cavidad."
        ],
        nota="El conformado se realiza en ciclo continuo sin detención intermedia en caliente, evitando el enfriamiento prematuro del material TPO.",
        epp=EPP_STD,
        disparador='SI SE DISPARA ALARMA DE CICLO, INTERRUPCIÓN ÓPTICA O CAÍDA DE VACÍO',
        acciones=[
            "1. La máquina detendrá el carro y abrirá el circuito por seguridad.",
            "2. Retirar la lámina sobrecalentada y desecharla en el cajón de scrap.",
            "3. Reanudar el ciclo automático verificando el estado de vacío en pantalla."
        ]
    ),
    dict(
        op="30.8",
        denominacion="ENFRIAMIENTO, CORTE DE VACÍO Y DESMOLDE",
        imagenes=[r"c:\\Dev\\BarackMercosul\\scripts\\img\\assets\\30.8_desmolde_automatico.jpg"],
        pasos=[
            "Aguardar el fin del tiempo de conformación: el sistema corta la succión de vacío y activa la ventilación forzada de enfriamiento.",
            "La máquina activa automáticamente el pulso de contra-soplado de aire inferior para despegar suavemente la pieza del molde.",
            "El carro superior asciende a su posición de reposo y los clamps neumáticos del marco tensor se abren liberando el perímetro.",
            "Tomar la pieza conformada con guantes de protección térmica, tomándola de manera firme por las alas y bordes excedentes.",
            "Retirar la pieza hacia arriba con movimiento parejo y continuo, depositándola en la mesa intermedia para control visual."
        ],
        nota="No tirar con violencia ni retorcer la pieza mientras conserve calor para evitar deformaciones en el perfil y en la línea de debilitamiento.",
        epp=EPP_STD,
        disparador='SI LA PIEZA QUEDA ADHERIDA O PRESENTA DEFORMACIÓN AL DESMOLDAR',
        acciones=[
            "1. No utilizar herramientas punzantes para despegar la pieza del molde.",
            "2. Comprobar la presión del pulso de contra-soplado inferior.",
            "3. Segregar la pieza afectada al cajón de scrap / contenedor rojo."
        ]
    ),

    # ── FASE 4: CALIDAD Y PUNTO CRÍTICO VW ──
    dict(
        op="30.9",
        denominacion="CRITERIOS DE CALIDAD Y PUNTO CRÍTICO VW (AIRBAG S=10)",
        imagenes=[r"C:\\Dev\\_telefono\\_vista\\2026-09-03_IMG_0617.jpg"],
        punto_critico=dict(rel_x=0.48, rel_y=0.28, rot=180, texto="▲ AIRBAG (S=10)"),
        pasos=[
            "▲ Punto Crítico de Seguridad VW: Verificar en la línea de costura de Airbag la integridad del debilitamiento (AMFE Severidad S=10). Prohibida cualquier rotura, poro o adelgazamiento excesivo.",
            "Controlar visualmente la nitidez y definición homogénea del grabado texturado en toda la cara vista, sin brillo por sobrecalentamiento.",
            "Verificar la ausencia total de micro-agujeros de vacío en esquinas, zonas sobredimensionadas, pliegues o atrapamiento de aire.",
            'Comprobar que las pestañas perimetrales de material ("canto envuelto") cuenten con el ancho requerido para el armado del tapizado.',
            "Segregar de forma inmediata al cajón de scrap / contenedor rojo cualquier pieza que no cumpla con los estándares visuales y dimensionales."
        ],
        nota="▲ El espesor y estado de la costura de Airbag garantizan el correcto despliegue de seguridad según especificación estricta de Volkswagen.",
        epp=EPP_STD,
        disparador='SI DETECTA FISURA, ROTURA EN AIRBAG O DEFECTO DE GRANO / VACÍO',
        acciones=[
            "1. Segregar e identificar la pieza de inmediato en el contenedor rojo.",
            "2. Dar aviso urgente al Líder de Producción y al Inspector de Calidad.",
            "3. No liberar piezas dudosas hasta contar con la validación de Calidad."
        ]
    ),

    # ── FASE 5: SET-UP / CAMBIO DE MOLDE ──
    dict(
        op="30.10",
        denominacion="SET-UP / CAMBIO DE MOLDE: DESCONEXIÓN Y AMARRE CON PUENTE GRÚA",
        imagenes=[r"C:\\Dev\\_telefono\\2026-09-04\\_frames\\IMG_0664\\IMG_0664_0071.jpg"],
        pasos=[
            "Aplicar procedimiento LOTO bloqueando la alimentación eléctrica principal, el circuito de vacío y el aire comprimido de la máquina.",
            "Desconectar los acoples rápidos de mangueras de agua del chiller (purgar remanente) y mangueras de succión de vacío.",
            "Desconectar y proteger las fichas eléctricas de las termocuplas y sensores de posición integrados en el molde.",
            "Centrar el puente grúa sobre el centro de gravedad del molde verde (peso aprox. 1650 kg según placa técnica GS Engineering).",
            "Enganchar las 4 cadenas con grilletes de seguridad a los cáncamos giratorios del molde (Swivel Hoist Rings 1000-06-00, torque 470 Nm)."
        ],
        nota="El cambio de molde debe ser realizado por personal de Producción respetando las normas de seguridad para maniobras con el puente grúa.",
        epp=EPP_MOLD_CHANGE,
        refs=("OP - Operador de Producción", "MT - Personal de Mantenimiento"),
        disparador='SI DETECTA ANOMALÍA EN CADENAS, GRÚA O INTERFERENCIA',
        acciones=[
            "1. Detener inmediatamente el puente grúa.",
            "2. Verificar que las 4 cadenas tiren parejo y no rocen la estructura.",
            "3. Dar aviso al Líder de Producción antes de continuar con la maniobra."
        ]
    ),
    dict(
        op="30.11",
        denominacion="SET-UP / CAMBIO DE MOLDE: EXTRACCIÓN SOBRE CARRO RODANTE",
        imagenes=[r"C:\\Dev\\_telefono\\2026-09-04\\_frames\\IMG_0666\\IMG_0666_0045.jpg"],
        pasos=[
            "Aflojar y retirar los bulones de anclaje de la base del molde fijada a la bancada inferior de la moldeadora.",
            "Aproximar el carro móvil de transporte y alinear los rieles de transferencia con la estructura de la máquina.",
            "Accionar las trabas de acople y los frenos de pie del carro rodante asegurando su inmovilidad contra la máquina.",
            "Guiar el molde deslizándolo con ayuda del puente grúa suavemente sobre la cama de rodillos hasta posicionarlo en el centro del carro.",
            "Colocar las trabas mecánicas de seguridad del carro para fijar el molde antes de destrabar los frenos para su traslado a matricería."
        ],
        nota="Mantener pies y manos fuera de la zona de rodillos y puntos de pellizco durante el deslizamiento del conjunto de 1650 kg.",
        epp=EPP_MOLD_CHANGE,
        refs=("OP - Operador de Producción", "MT - Personal de Mantenimiento"),
        disparador='SI DETECTA DESALINEACIÓN DEL CARRO O TRABA MECÁNICA',
        acciones=[
            "1. Detener el desplazamiento de inmediato.",
            "2. Re-alinear las guías de transferencia sin forzar el herramental.",
            "3. Notificar al Líder si se observan daños en la cama de rodillos."
        ]
    )
]

def compilar_deck():
    print("Iniciando compilacion de Hoja de Proceso IMG (12 laminas)...")
    prs = Presentation()
    prs.slide_width = Cm(W)
    prs.slide_height = Cm(H)

    indice = [(h["op"], h["denominacion"]) for h in HOJAS_IMG]
    portada(prs, PORTADA_IMG, logo=LOGO_BARACK, foto=PORTADA_IMG.get("foto"), indice=indice)
    print("  [OK] Portada generada exitosamente.")

    for i, h in enumerate(HOJAS_IMG):
        d = dict(CAJETIN_BASE)
        d.update(h)
        hoja(prs, d, logo=LOGO_BARACK)
        print(f"  [OK] Lamina {h['op']}: {h['denominacion'][:40]}...")

    os.makedirs(DESKTOP_DIR, exist_ok=True)
    salida_desktop = os.path.join(DESKTOP_DIR, "HOJAS DE PROCESO - MAQUINA IMG.pptx")
    salida_repo = os.path.join(BASE_DIR, "HOJAS DE PROCESO - MAQUINA IMG.pptx")

    prs.save(salida_desktop)
    prs.save(salida_repo)
    print(f"\\n[OK] Presentacion guardada en:")
    print(f"  1. {salida_desktop}")
    print(f"  2. {salida_repo}")

if __name__ == "__main__":
    compilar_deck()
'''

def main():
    target_gen = r"c:\Dev\BarackMercosul\scripts\img\generar_hojas_img.py"
    print(f"Actualizando {target_gen}...")
    with open(target_gen, "w", encoding="utf-8") as f:
        f.write(CODE_GENERAR_HOJAS_IMG)
    print("generar_hojas_img.py actualizado correctamente.")

    # Ejecutar la compilación
    import subprocess
    cmd = [sys.executable, target_gen]
    print(f"Ejecutando {' '.join(cmd)}...")
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    print(res.stdout)
    if res.returncode != 0:
        print("ERROR:", res.stderr)
        sys.exit(res.returncode)

if __name__ == "__main__":
    main()

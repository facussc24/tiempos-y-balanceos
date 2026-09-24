# -*- coding: utf-8 -*-
"""
Generador oficial de HOJAS DE OPERACIONES para la MAQUINA MOLDEADORA IMG KINGPOWER
Proyecto: Top Roll Patagonia / VW (OP 30 del Flujograma 122).
Formulario SGC oficial: I-IN-002.4-R01 (A4 apaisado 29.7 x 21.0 cm).

Estructura Oficial Aprobada (11 láminas en total: Portada + 10 Operaciones):
  Slide 1: Portada e Índice General de Fabricación
  Fase 1: Puesta en Marcha y HMI
    - 30.1: Puesta en marcha general y suministros
    - 30.2: Acceso al sistema HMI y carga de receta de producción
  Fase 2: Manejo de Rollo y Alimentación (Secuencias multi-foto paso a paso)
    - 30.3: Montaje del rollo de TPO en el desbobinador (4 fotos: buje, centrado, calzado, freno)
    - 30.4: Enhebrado y pasada de lámina hacia la mesa (4 fotos: rodillos, aplanado Carlos, escuadra, selectores/avance)
    - 30.5: Cambio de rollo por fin de material (4 fotos: fin bobina, despresurización/buje, nueva bobina, re-enhebrado)
  Fase 3: Operación en Modo Automático (Secuencias multi-foto paso a paso)
    - 30.6: Inspección y limpieza de cavidad de molde verde
    - 30.7: Ciclo automático de calentamiento y conformado IMG (4 fotos: bimanual, descenso pórtico, cierre marco, vacío)
    - 30.8: Enfriamiento, corte de vacío y desmolde (4 fotos: ventilación, ascenso, pieza en molde, desmolde)
  Fase 4: Set-up / Cambio de Molde
    - 30.9: Set-up / Cambio de molde: Desconexión y amarre con puente grúa
    - 30.10: Set-up / Cambio de molde: Extracción sobre carro rodante

Criterios de Fak cumplidos estrictamente:
  - Hoja de calidad eliminada ("no soy calidad, que la haga calidad").
  - Explicación visual paso a paso con grillas multi-foto y badges identificadores de paso.
  - 100% fotos reales de planta y fotogramas de video (0% IA).
  - Ciclo de control vaciado (campos limpios listos para Calidad).
  - Redacción en infinitivo ("Verificar", "Montar", "Accionar").
  - Terminología técnica argentina ("puente grúa", "cajón de scrap", "cáncamos giratorios", "eje neumático expansible", "buje de cartón", "marco tensor", "clamps").
"""
import os
import sys
import shutil
import functools

# El vocabulario de planta y la voz del paso son del SKILL, no de esta maquina:
# valen para cualquier hoja de proceso de Barack.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                '..', '..', '.claude', 'skills',
                                'hojas-de-proceso', 'scripts'))
from redaccion import gate_redaccion  # noqa: E402
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

# ─── RUTAS DE ACTIVOS LOCALES ────────────────────────────────────────────────
BASE_DIR = r"c:\Dev\BarackMercosul\scripts\img"
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
DESKTOP_DIR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina IMG - desde los videos\_trabajo"
HOTMELT_GEN = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\generador"
EPP_DIR = os.path.join(BASE_DIR, "..", "hotmelt", "epp")

LOGO_BARACK = r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\barack_logo.png"

# Iconos EPP
ICO_ROPA     = os.path.join(EPP_DIR, "ico_13756.png")
ICO_CALZADO  = os.path.join(EPP_DIR, "ico_4449.png")
ICO_GUANTES  = os.path.join(EPP_DIR, "ico_11789.png")
ICO_ANTEOJOS = os.path.join(EPP_DIR, "ico_16034.png")
ICO_AUDITIVA = os.path.join(EPP_DIR, "ico_12924.png")

EPP_STD = [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_ANTEOJOS, ICO_AUDITIVA]

# Los dos fijos de toda hoja de Barack. El tercero lo define el riesgo del
# puesto, no la costumbre: los anteojos salieron porque nadie los usa en esta
# maquina (Fak, 21/09/2026) y meter un EPP que no se usa vacia de valor al que
# si hace falta.
EPP_IMG = [ICO_ROPA, ICO_CALZADO]
EPP_MOLD_CHANGE = [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_ANTEOJOS]

# ─── TIPOGRAFÍA Y MEDICIÓN REAL ──────────────────────────────────────────────
_TTF = {
    "Calibri": r"C:\Windows\Fonts\calibri.ttf",
    "Calibri-b": r"C:\Windows\Fonts\calibrib.ttf",
    "Arial": r"C:\Windows\Fonts\arial.ttf",
    "Arial-b": r"C:\Windows\Fonts\arialbd.ttf"
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

def _denominacion_con_hoja(d):
    """Una operacion del flujograma puede no entrar en una hoja. Se parte, y cada parte
    dice cual es: "SET UP INICIAL (HOJA 1 DE 2)". El N de operacion NO cambia — lo manda
    el flujograma (regla no-pfd-no-ho)."""
    t = d.get("denominacion", "")
    hd = d.get("hoja_de")
    return f"{t}  (HOJA {hd[0]} DE {hd[1]})" if hd else t


def cajetin(slide, d, logo=None):
    top_h = 1.60
    fila = (HDR_H - top_h) / 4

    lw, rw = 4.30, C_LAB + C_VAL
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
        [(d.get("op", ""), C_OP), (_denominacion_con_hoja(d), C_DEN),
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

# ─── 2. BLOQUE DE IMÁGENES MULTI-FOTO SECUENCIAL ─────────────────────────────
def _badge_numero(slide, x, y, n, diam=0.86):
    """El numero del paso, adentro de un circulo, arriba a la izquierda de su foto.

    Es lo que ata la foto al renglon: la foto 3 es el paso 3. Un rotulo de texto libre
    ("Paso 1-2: Login") no ata nada — se puede escribir cualquier cosa y nadie lo nota."""
    sh = slide.shapes.add_shape(MSO_SHAPE.OVAL, Cm(x), Cm(y), Cm(diam), Cm(diam))
    sh.fill.solid()
    sh.fill.fore_color.rgb = AZUL
    sh.line.color.rgb = BLANCO
    sh.line.width = Pt(1.25)
    sh.shadow.inherit = False
    tf = sh.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.word_wrap = False
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = str(n)
    r.font.size = Pt(15)
    r.font.bold = True
    r.font.name = "Calibri"
    r.font.color.rgb = BLANCO
    return sh


def _pie_foto(slide, x, y, w, h, texto):
    """Barra de pie debajo de la foto: 3 a 6 palabras, lo que se hace en ese paso."""
    _celda(slide, x, y, w, h, texto, relleno=AZUL, borde=AZUL, color=BLANCO,
           size=8.5, bold=True, align=PP_ALIGN.CENTER)


# Reparto de celdas por cantidad de fotos, en fracciones del bloque (x, y, w, h).
# n=3 da la fila de arriba entera a la PRIMERA: es la principal y asi cumple el
# criterio 1 del skill (>=45 % de la tinta y >=1,6x la segunda) sin achicar a las otras.
_REPARTO = {
    1: [(0.0, 0.0, 1.0, 1.0)],
    2: [(0.0, 0.0, 0.5, 1.0), (0.5, 0.0, 0.5, 1.0)],
    # con 3, las tres celdas son del MISMO tamano que con 4 (16:9, como el bloque): una
    # celda a lo ancho es 3,9:1 y una foto normal le llena el 45 %, que es el defecto que
    # veniamos arrastrando. La cuarta posicion queda libre y la fila de abajo va centrada.
    3: [(0.0, 0.0, 0.5, 0.5), (0.5, 0.0, 0.5, 0.5), (0.25, 0.5, 0.5, 0.5)],
    4: [(0.0, 0.0, 0.5, 0.5), (0.5, 0.0, 0.5, 0.5),
        (0.0, 0.5, 0.5, 0.5), (0.5, 0.5, 0.5, 0.5)],
}
MAX_FOTOS = 4          # con mas de 4 en A4 no se ve ninguna: la hoja se PARTE


def bloque_imagenes(slide, imagenes, pies=None, numerar=True):
    """Una foto por paso, numerada, con su pie. El indice+1 ES el numero del paso."""
    _banda(slide, IMG_X, BODY_Y, IMG_W, 0.60, "IMÁGENES", size=12)
    y0 = BODY_Y + 0.60
    h = BODY_H - 0.60
    _caja(slide, IMG_X, y0, IMG_W, h, BLANCO, borde=NEGRO, ancho=Pt(1))

    faltan = [i for i in imagenes if not os.path.exists(i)]
    if faltan:
        # Sin foto va el recuadro VACIO (nunca una leyenda que diga que falta), pero el
        # generador tiene que gritar: una ruta rota se ve igual que una hoja sin fotos.
        raise SystemExit("FOTOS QUE NO EXISTEN:\n  " + "\n  ".join(faltan))
    if not imagenes:
        return
    n = len(imagenes)
    if n > MAX_FOTOS:
        raise SystemExit(f"{n} fotos en una hoja: el tope es {MAX_FOTOS}. Partir la hoja "
                         f"en a/b (decision de Fak 07/09/2026).")

    pad = 0.15
    gap = 0.18
    pie_h = 0.52
    W_util, H_util = IMG_W - 2 * pad, h - 2 * pad

    for k, ruta in enumerate(imagenes):
        fx, fy, fw, fh = _REPARTO[n][k]
        cx = IMG_X + pad + fx * W_util + (gap / 2 if fx > 0 else 0)
        cy = y0 + pad + fy * H_util + (gap / 2 if fy > 0 else 0)
        cw = fw * W_util - (gap / 2 if fx > 0 else 0) - (gap / 2 if fx + fw < 1 else 0)
        ch = fh * H_util - (gap / 2 if fy > 0 else 0) - (gap / 2 if fy + fh < 1 else 0)

        texto_pie = (pies[k] if pies and k < len(pies) else "")
        ch_foto = ch - (pie_h if texto_pie else 0)

        im = Image.open(ruta)
        ar = im.width / im.height
        cel_ar = cw / ch_foto if ch_foto else ar
        iw, ih = (cw, cw / ar) if cw / ar <= ch_foto else (ch_foto * ar, ch_foto)
        llena = (iw * ih) / (cw * ch_foto) if cw * ch_foto else 1.0
        if llena < 0.80:
            print(f"  [AVISO] {os.path.basename(ruta)} llena el {llena:.0%} de su celda "
                  f"(es {ar:.2f}:1 y la celda {cel_ar:.2f}:1). Recortarla a {cel_ar:.2f}:1 "
                  f"para que no quede aire.")
        px = cx + (cw - iw) / 2
        py = cy + (ch_foto - ih) / 2
        slide.shapes.add_picture(ruta, Cm(px), Cm(py), Cm(iw), Cm(ih))
        if numerar:
            _badge_numero(slide, px + 0.10, py + 0.10, k + 1)
        if texto_pie:
            _pie_foto(slide, cx, cy + ch_foto, cw, pie_h, texto_pie)


# ─── 3. BLOQUE DE DESCRIPCIÓN DE LA OPERACIÓN ────────────────────────────────
def bloque_pasos(slide, pasos, nota=None, parametros=None):
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
        for k, v in (parametros or []):
            alto += 1.22 * max(size - 0.5, 8.0) * PT_CM + 2 * PT_CM
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
        
        r = p.add_run()
        r.text = f"{i+1}.  "
        r.font.size = Pt(size)
        r.font.bold = True
        r.font.name = "Calibri"
        r.font.color.rgb = NEGRO

        r2 = p.add_run()
        r2.text = texto
        r2.font.size = Pt(size)
        r2.font.name = "Calibri"
        r2.font.color.rgb = NEGRO

    for k, v in (parametros or []):
        p = tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_before = Pt(2.0)
        r = p.add_run()
        r.text = "▸ " + k + ": "
        r.font.size = Pt(max(size - 0.5, 8.0))
        r.font.name = "Calibri"
        r.font.color.rgb = NEGRO
        r2 = p.add_run()
        r2.text = str(v)
        r2.font.size = Pt(max(size - 0.5, 8.0))
        r2.font.bold = True
        r2.font.name = "Calibri"
        r2.font.color.rgb = AZUL_TEXTO

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

# ─── 4. BLOQUE CICLO DE CONTROL (VACIADO SISTEMÁTICO LISTO PARA CALIDAD) ─────
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
    
    filas = filas or [("", "", "", "", ""), ("", "", "", "", "")]
    fh = (CIC_Y + CIC_H - y) / len(filas)
    for f in filas:
        x = X0
        for val, an in zip(f, anchos):
            _celda(slide, x, y, an, fh, str(val), size=8.5)
            x += an
        y += fh

# ─── 5. ELEMENTOS DE SEGURIDAD (EPP) ─────────────────────────────────────────
def bloque_epp(slide, iconos, refs=("OP - Operador de Producción",)):
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
        "1. Segregar e identificar el material afectado en el cajón de scrap / contenedor rojo.",
        "2. Dar aviso según procedimiento P-09/I.",
        "3. No reiniciar la producción sin autorización del Líder o Supervisor."
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

    cab_h = 3.20
    _caja(slide, X0, M, X1 - X0, cab_h, BLANCO, borde=AZUL, ancho=Pt(1.5))
    _caja(slide, X0, M + cab_h - 0.08, X1 - X0, 0.08, AZUL, borde=AZUL)

    lw = 5.20
    if logo and os.path.exists(logo):
        im = Image.open(logo)
        ar = im.width / im.height
        ih = min(cab_h - 0.60, (lw - 0.80) / ar)
        iw = ih * ar
        slide.shapes.add_picture(logo, Cm(X0 + (lw - iw) / 2),
                                 Cm(M + (cab_h - ih) / 2), Cm(iw), Cm(ih))

    tx = X0 + lw + 0.20
    tw = X1 - X0 - lw - 0.40
    _celda(slide, tx, M + 0.40, tw, 1.40,
           d.get("titulo", "HOJAS DE PROCESO — MÁQUINA MOLDEADORA IMG"),
           size=24, bold=True, color=AZUL, relleno=BLANCO, borde=None, align=PP_ALIGN.LEFT)
    _celda(slide, tx, M + 1.80, tw, 1.00,
           d.get("subtitulo", "Termoformado y laminado In-Mold Graining (IMG) · OP 30 del FLUJOGRAMA 155 TOP ROLL PATAGONIA"),
           size=11.5, bold=False, color=AZUL2, relleno=BLANCO, borde=None, align=PP_ALIGN.LEFT)

    y_body = M + cab_h + 0.35
    fw = 13.80
    bh = H - M - y_body - 0.10
    # La foto va CENTRADA en el alto libre, no pegada arriba: Fak la bajo a mano el
    # 23/09/2026 ("la imagen queda mejor ahi centrada") y pidio que valga para las proximas.
    # La HOTMELT (scripts/hotmelt/hoja_pptx.py) ya la centraba. `foto_top` / `foto_dx`
    # guardan una posicion puesta a mano en un deck ya entregado, para no movérsela.
    fdx = d.get("foto_dx", 0.0)
    if foto and os.path.exists(foto):
        im = Image.open(foto)
        ar = im.width / im.height
        iw = fw - 0.20
        ih = iw / ar
        if ih > bh - 0.20:                      # la foto es mas alta que el hueco
            ih = bh - 0.20
            iw = ih * ar
        # el recuadro se ajusta a la FOTO, no al reves: si no, una foto apaisada deja dos
        # bandas blancas arriba y abajo y parece que falta algo
        bh_real = min(bh, ih + 0.20)
        top = d.get("foto_top", y_body + (bh - bh_real) / 2)
        _caja(slide, X0 + 0.10 + fdx, top, fw, bh_real, BLANCO, borde=AZUL, ancho=Pt(1))
        slide.shapes.add_picture(foto, Cm(X0 + 0.10 + fdx + (fw - iw) / 2),
                                 Cm(top + (bh_real - ih) / 2), Cm(iw), Cm(ih))
    else:
        _caja(slide, X0 + 0.10, y_body, fw, bh, BLANCO, borde=AZUL, ancho=Pt(1))

    xd = X0 + fw + 0.50
    wd = X1 - xd - 0.10
    filas = [
        ("Documento SGC", d.get("ho", "HO-TBD")),
        ("Formulario Oficial", d.get("form", "I-IN-002.4-R01")),
        ("Operación Flujograma", d.get("op_flujo", "30 — PROCESO DE TERMOFORMADO Y LAMINADO IMG")),
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
        p.space_after = Pt(2.5)
        r = p.add_run()
        r.text = f"{num}   "
        r.font.size = Pt(8.2)
        r.font.bold = True
        r.font.name = "Calibri"
        r.font.color.rgb = AZUL
        r2 = p.add_run()
        r2.text = nom
        r2.font.size = Pt(8.2)
        r2.font.name = "Calibri"
        r2.font.color.rgb = NEGRO
    return slide

# ─── 8. GENERADOR DE HOJA INDIVIDUAL ─────────────────────────────────────────
def _marcas_de(ruta):
    """Cuantos rotulos le puso rotular.py a esta foto. Lo dice el archivo, no yo."""
    import json
    sk = os.path.join(BASE_DIR, "..", "..", ".claude", "skills", "hojas-de-proceso", "scripts")
    if sk not in sys.path:
        sys.path.insert(0, sk)
    try:
        from fotodevideo import leer_origen
        o = leer_origen(ruta)
        return len(json.loads(o).get("rotulos", [])) if o else 0
    except Exception:
        return 0


# Marcas de cocina interna: nombre de archivo de video, trazabilidad, pendientes con el
# proveedor, explicaciones de como se hizo la hoja. Nada de esto le sirve al que esta
# parado al lado de la maquina, y en una hoja que firma Barack ademas queda mal.
# La lista de cocina interna vive en el SKILL (`vocabulario.data.json`), no aca:
# el gate que decide si el deck se entrega es `hoja_proceso_check.py` sobre el
# PPTX, y el 21/09 dio PASA sobre una nota prohibida porque la lista era local.
from redaccion import revisar_cocina  # noqa: E402



def _gate_texto_para_el_operario(d):
    """Lo que dice una hoja se lee de pie al lado de la maquina. Si una frase no le cambia
    nada a esa persona, no va: va a la bitacora o al PDF de pendientes."""
    import re
    op = d.get("op", "?")
    piezas = [("nota", d.get("nota") or "")]
    piezas += [(f"paso {i}", t) for i, t in enumerate(d.get("pasos", []), 1)]
    piezas += [(f"pie {i}", t) for i, t in enumerate(d.get("pies", []) or [], 1)]
    piezas += [(f"parametro {k}", str(v)) for k, v in (d.get("parametros") or [])]
    piezas += [(f"accion {i}", t) for i, t in enumerate(d.get("acciones", []) or [], 1)]
    malas = []
    for donde, t in piezas:
        for hallado, por in revisar_cocina(t):
            malas.append((donde, por, t.strip()[:70]))
    if malas:
        for donde, por, t in malas:
            print(f"  hoja {op} / {donde}: dice {por} -> \"{t}...\"")
        raise SystemExit(f"hoja {op}: hay texto de cocina interna en la hoja. Eso va a la "
                         f"bitacora o al PDF de pendientes, no adelante del operario "
                         f"(Fak, 21/09/2026).")


# Frases que afirman COMO SE COMPORTA el equipo. Para escribir una de estas hace falta un
# documento del fabricante o una medicion, no una foto: una foto muestra un instante.
AFIRMA_ESTADO = [
    r"\bqueda[n]? apagad", r"\bestan? apagad", r"\bal m[ií]nimo\b", r"\bno calienta",
    r"\bsiempre (esta|estan|queda|quedan|se)\b",
    r"\bnunca (esta|estan|queda|quedan|se)\b", r"\bno hace falta\b",
]
# Un numero con unidad. El °C suelto de una LECTURA citada va igual en parametros.
NUM_CON_UNIDAD = r"\d+[.,]?\d*\s?(°C|MPa|bar|mm|kg|min\b|seg\b|\bs\b)"


def _origen_de(ruta):
    """(video, segundo) de una foto, lo que fotodevideo.py le dejo adentro."""
    import json
    sk = os.path.join(BASE_DIR, "..", "..", ".claude", "skills", "hojas-de-proceso", "scripts")
    if sk not in sys.path:
        sys.path.insert(0, sk)
    try:
        from fotodevideo import leer_origen
        o = leer_origen(ruta)
        if not o:
            return None, None
        j = json.loads(o)
        return j.get("video"), j.get("segundo")
    except Exception:
        return None, None


def _gate_secuencia_en_orden(d):
    """Dos fotos del MISMO video, en una hoja de secuencia, van en el orden del reloj."""
    op = d.get("op", "?")
    if d.get("modo", "secuencia") != "secuencia" or not d.get("imagenes"):
        return
    if d.get("ciclos_distintos"):        # declarado a proposito, y la nota lo dice
        return
    por_video = {}
    for i, f in enumerate(d["imagenes"], 1):
        v, seg = _origen_de(f)
        if v and seg is not None:
            por_video.setdefault(v, []).append((i, seg, os.path.basename(f)))
    for v, lista in por_video.items():
        if len(lista) < 2:
            continue
        segs = [seg for _i, seg, _n in lista]
        if segs != sorted(segs):
            det = " · ".join(f"paso {i} s={seg:.0f}" for i, seg, _n in lista)
            raise SystemExit(
                f"hoja {op}: las fotos de {v} estan FUERA DE ORDEN en el tiempo ({det}). "
                f"Una secuencia se lee como un ciclo: o se toman en orden, o la hoja declara "
                f"ciclos_distintos=True y la nota lo dice.")


def _gate_secuencia_con_marca(d):
    """Cada foto de secuencia con al menos una marca: obliga a buscar el objeto del paso."""
    op = d.get("op", "?")
    if d.get("modo", "secuencia") != "secuencia" or not d.get("imagenes"):
        return
    sin = [os.path.basename(f) for f in d["imagenes"] if _marcas_de(f) == 0]
    if sin and not d.get("sin_marcas_ok"):
        print(f"  hoja {op}: fotos de secuencia sin ninguna marca -> " + ", ".join(sin))
        print("    (poner la marca obliga a buscar en el cuadro el objeto que nombra el paso; "
              "si el objeto no esta, se ve ahi. sin_marcas_ok=True si la foto se explica sola)")


TRANSCRIPCIONES = os.path.join(
    r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL",
    "Ingeniería y Proyecto - General", "INGENIERIA BARACK (NUNCA BORRAR)",
    "5- VIDEOS Y FOTOS", "1- CLIENTES", "NOVAX", "TOP ROLL", "MAQUINA MOLDEADORA IMG",
    ".claude", "transcripciones")


# Verbos con los que arranca un paso que MANDA HACER algo. Un paso que solo describe lo
# que muestra la foto no lleva ninguno.
MANDA = (
    "apretar", "poner", "pasar", "mirar", "verificar", "comprobar", "prender", "encender",
    "apagar", "abrir", "cerrar", "esperar", "cargar", "elegir", "seleccionar", "mantener",
    "sacar", "colocar", "montar", "limpiar", "controlar", "avisar", "anotar", "arrancar",
    "parar", "detener", "revisar", "ajustar", "cambiar", "retirar", "soplar", "medir",
)


def _paso_manda(t):
    import re
    p0 = re.sub(r"^[\W\d]+", "", t.strip().lower())
    return p0.startswith(MANDA) or " hay que " in " " + p0


def _gate_transcripcion_leida(d):
    """Si un paso MANDA algo y su fuente es un video, la transcripcion de ese video existe.

    No prueba que la lei, pero saca la excusa: el 21/09 escribi un paso mirando los
    fotogramas del IMG_0596 y la transcripcion de ese mismo video decia lo contrario.
    Sacarla es una linea: scripts/video/_infoDeVideos.py audio "<carpeta>" --solo 0596
    """
    import re
    op = d.get("op", "?")
    pasos = d.get("pasos", [])
    fuentes = d.get("fuentes", [])
    if not os.path.isdir(TRANSCRIPCIONES):
        return
    vids = set()
    for i, t in enumerate(pasos):
        if _paso_manda(t) and i < len(fuentes):
            vids.update(re.findall(r"IMG_(\d{3,4})", fuentes[i]))
    if not vids:
        return
    faltan = [v for v in sorted(vids)
              if not os.path.exists(os.path.join(TRANSCRIPCIONES, f"IMG_{v}.txt"))]
    if faltan:
        raise SystemExit(
            f"hoja {op}: hay pasos que MANDAN hacer algo y no esta la transcripcion de " +
            ", ".join("IMG_" + v for v in faltan) +
            ". Lo que se VE no es lo que hay que HACER: eso lo dice el audio, y se lee "
            "entero (Fak, 21/09/2026). Sacarla:\n"
            "  py -3 scripts/video/_infoDeVideos.py audio \"<carpeta de la maquina>\" "
            "--solo " + ",".join(faltan))


def _gate_cada_paso_con_fuente(d):
    """Una fuente por paso. Sin eso no compila.

    Lo que frena: convertir en instruccion algo que nadie dijo. Un paso puede DESCRIBIR lo
    que muestra una foto ("el contorno queda dibujado sobre la grilla") o MANDAR hacer algo
    ("apretar el verde"), y lo segundo necesita que alguien lo haya dicho. El 21/09 escribi
    "mirar la presion de aire antes de pedir cualquier movimiento" porque vi un manometro
    en una foto."""
    op = d.get("op", "?")
    pasos = d.get("pasos", [])
    fuentes = d.get("fuentes", [])
    if not pasos:
        return
    if len(fuentes) != len(pasos):
        raise SystemExit(
            f"hoja {op}: {len(pasos)} pasos y {len(fuentes)} fuentes. Cada paso declara de "
            f"donde sale: un video con su minuto, un documento, o quien lo dijo y cuando. "
            f"Si un paso no tiene fuente, el paso no va (Fak, 21/09/2026).")
    for i, f in enumerate(fuentes, 1):
        if not f or len(f.strip()) < 8:
            raise SystemExit(f"hoja {op} paso {i}: la fuente dice {f!r}. Eso no es una fuente.")


def _gate_no_afirmar_de_mas(d):
    """Lo que la hoja afirma del equipo sale de un documento o de una medicion; lo que sale
    de una foto es lo que la foto MUESTRA. Y un numero se declara en `parametros`, una vez."""
    import re
    op = d.get("op", "?")
    parametros = " · ".join(f"{k} {v}" for k, v in (d.get("parametros") or []))
    piezas = [("nota", d.get("nota") or "")]
    piezas += [(f"paso {i}", t) for i, t in enumerate(d.get("pasos", []), 1)]
    malas = []
    for donde, t in piezas:
        for pat in AFIRMA_ESTADO:
            m = re.search(pat, t, re.IGNORECASE)
            if m:
                malas.append((donde, f"afirma un estado del equipo (\"{m.group(0)}\") que "
                                     f"una foto no puede probar", t.strip()[:70]))
        for m in re.finditer(NUM_CON_UNIDAD, t, re.IGNORECASE):
            if m.group(0).strip() not in parametros:
                malas.append((donde, f"el valor \"{m.group(0).strip()}\" no esta declarado "
                                     f"en `parametros`", t.strip()[:70]))
    if malas:
        for donde, por, t in malas:
            print(f"  hoja {op} / {donde}: {por} -> \"{t}...\"")
        raise SystemExit(f"hoja {op}: la hoja afirma mas de lo que su fuente sostiene "
                         f"(incidente 21/09/2026, hoja 30.5).")


def _gate_una_foto_por_paso(d):
    """Lo que ata la foto al renglon, segun el tipo de hoja:

      modo="secuencia"  el proceso avanza -> UNA foto por paso, numerada 1..n.
      modo="rotulada"   un panel o una pantalla -> UNA foto con k marcas y k pasos;
                        las marcas las declara la FOTO (rotular.py las escribe adentro
                        del archivo), asi que si alguien saca una marca y no toca la
                        hoja, esto lo frena.

    Sin esto el badge miente y nadie lo ve: el 08/09 una hoja decia "Paso 3-5: Receta"
    encima de una foto general de la maquina."""
    op = d.get("op", "?")
    fotos, pasos, pies = d.get("imagenes", []), d.get("pasos", []), d.get("pies", [])
    modo = d.get("modo", "secuencia")
    # Cuantos pasos entran en una hoja. El criterio, que antes no estaba escrito y por eso
    # en el flujograma salieron hojas de 2 pasos y hojas de 12 (Fak, 21/09/2026):
    #   un paso = UNA accion que alguien hace y que se ve en UNA foto;
    #   lo que no se puede fotografiar no es un paso (condicion -> nota, valor -> parametros);
    #   entran 2 a 4 por hoja, y si sobran la hoja se parte (3+2 antes que 4+1).
    tope = 6 if modo == "rotulada" else MAX_FOTOS
    if pasos and not (2 <= len(pasos) <= tope):
        raise SystemExit(f"hoja {op}: {len(pasos)} pasos. Entran de 2 a {tope}. "
                         f"Con menos no es una hoja; con mas se parte en (HOJA 1 DE n).")
    if not fotos:
        return
    if modo == "rotulada":
        if len(fotos) != 1:
            raise SystemExit(f"hoja {op}: modo rotulada va con UNA foto, tiene {len(fotos)}.")
        k = _marcas_de(fotos[0])
        if k and k != len(pasos):
            raise SystemExit(f"hoja {op}: la foto trae {k} marcas y la hoja {len(pasos)} "
                             f"pasos. El numero del rotulo ES el numero del paso.")
        return
    if len(fotos) != len(pasos):
        raise SystemExit(f"hoja {op}: {len(fotos)} fotos y {len(pasos)} pasos. "
                         f"Va UNA foto por paso; si sobran pasos, la hoja se parte en a/b.")
    if pies and len(pies) != len(fotos):
        raise SystemExit(f"hoja {op}: {len(pies)} pies para {len(fotos)} fotos.")
    for i, t in enumerate(pies or [], 1):
        if len(t) > 46:
            raise SystemExit(f"hoja {op} pie {i}: {len(t)} caracteres. El pie son 3 a 6 "
                             f"palabras; lo largo va en el paso, no abajo de la foto.")


# Lo que Fak ya corrigio en ESTE deck y no puede volver. No va al vocabulario del skill:
# ahi la regla mira la misma frase, y "apoyar las piezas en el caballete" no tiene ninguna
# palabra de termoformado; ademas un caballete si existe en otros puestos.
CORREGIDO_POR_FAK = [
    (r"\bcaballetes?\b", "mesa",
     "Fak, 23/09/2026: «las piezas que salen de la maquina se colocan en una mesa, no en un "
     "caballete»"),
    (r"\btres puntitos\b|\b3 puntitos\b", "(sacarlo)",
     "Fak, 23/09/2026: «esa foto de los 3 puntos entendiste mal, es cualquier cosa, saca eso»"),
    # Las corner safety straps del molde de GS Engineering (IMG_0668): la chapa del molde dice
    # "DO NOT MOVE TOOL WITHOUT CORNER SAFETY STRAPS", y aun asi no van en el cambio en planta.
    (r"\b(trabas?|topes?|barras?) rojas?\b|\btopes? rojos?\b|\bsafety straps?\b|"
     r"\btopes? de transporte\b", "(no va)",
     "Fak, 24/09/2026: «el video ese con Kip y las cosas rojas es medio irrelevante, eso solo "
     "se usa para traslados hasta Estados Unidos o traslados grandes»"),
]


def _gate_corregido_por_fak(d):
    """Una correccion de Fak que vuelve a aparecer es el mismo error dos veces."""
    import re
    op = d.get("op", "?")
    piezas = [str(d.get("denominacion", "")), str(d.get("nota") or ""),
              str(d.get("disparador") or "")]
    piezas += [str(x) for x in (d.get("pasos") or []) + (d.get("pies") or [])
               + (d.get("acciones") or [])]
    todo = " ".join(piezas).lower()
    for pat, en_vez, fuente in CORREGIDO_POR_FAK:
        m = re.search(pat, todo)
        if m:
            raise SystemExit(f"hoja {op}: dice \"{m.group(0)}\" -> {en_vez}. {fuente}")


def hoja(prs, d, logo=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    cajetin(slide, d, logo)
    _gate_corregido_por_fak(d)
    _gate_una_foto_por_paso(d)
    _gate_texto_para_el_operario(d)
    _gate_cada_paso_con_fuente(d)
    _gate_transcripcion_leida(d)
    _gate_no_afirmar_de_mas(d)
    _gate_secuencia_en_orden(d)
    _gate_secuencia_con_marca(d)
    gate_redaccion(d)
    bloque_imagenes(slide, d.get("imagenes", []), d.get("pies"),
                    numerar=(d.get("modo", "secuencia") != "rotulada"))
    bloque_pasos(slide, d.get("pasos", []), d.get("nota"), d.get("parametros"))
    bloque_ciclo(slide, d.get("ciclo", []))
    bloque_epp(slide, d.get("epp", EPP_STD), d.get("refs", ("OP - Operador de Producción",)))
    bloque_plan(slide, d.get("disparador", 'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME'), d.get("acciones"))
    return slide

# ─── DATOS DE LAS OPERACIONES (OP 30 — IMG) ──────────────────────────────────
CAJETIN_BASE = dict(
    titulo_hoja="HOJA DE OPERACIONES",
    ho="HO-TBD",
    form="I-IN-002.4-R01",
    modelo="PATAGONIA",
    cliente="VW",
    sector="IMG",
    pieza="TOP ROLL PATAGONIA — N 216 / N 256 / N 285 / N 315",
    puesto="-",
    realizo="F. Santoro",
    # vacio a proposito: el documento controlado lo firma Fak, y todavia no lo
    # firmo nadie (autonomy-contract.md F). Decir "C. Baptista" en una hoja que
    # el no vio es afirmar una aprobacion que no existe.
    aprobo="",
    fecha="23/09/2026",
    rev="-",
)

PORTADA_IMG = dict(
    titulo="HOJAS DE PROCESO — MÁQUINA MOLDEADORA IMG",
    subtitulo="Termoformado y laminado In-Mold Graining (IMG) · OP 30 del FLUJOGRAMA 155 TOP ROLL PATAGONIA",
    ho="HO-TBD",
    form="I-IN-002.4-R01",
    op_flujo="30 — PROCESO DE TERMOFORMADO Y LAMINADO IMG",
    cliente_modelo="VW / PATAGONIA",
    pieza="TOP ROLL PATAGONIA — N 216 / N 256 / N 285 / N 315",
    maquina="Moldeadora In-Mold Graining KINGPOWER (Molde Hembra)",
    # Fak, 23/09/2026, editando la portada a mano antes de mandarla a aprobar
    firmas="F. Santoro / C. Baptista",
    fecha_rev="23/09/2026",
    foto=os.path.join(BASE_DIR, "assets2", "p1_listo.jpg"),
    foto_dx=0.1,          # donde la dejo Fak en este deck; los nuevos van centrados
    foto_top=7.56666,
)

A2 = os.path.join(BASE_DIR, "assets2")


def _f(n):
    return os.path.join(A2, n)


# ════════════════════════════════════════════════════════════════════════════
# LAS HOJAS — en el orden de la jornada del operario (hojas-proceso.md §17)
#   Numeradas 31 a 37 por pedido de Fak (23/09/2026); la OP del flujograma sigue siendo la 30.
#   31-32  prender la maquina y conocer el puesto
#   33-34  el vinilo: montar el rollo, enhebrarlo y darle material
#   35     arrancar en automatico (el primer corte lo hace la maquina)
#   36-37  cada ciclo: descargar, cargar sustratos y controlar la pieza
#   El APAGADO no esta filmado: esta en QUE FALTA FILMAR (falta_filmar.py), bloque 1.
#
# Todo lo que dice una hoja sale de un video de planta identificado. Lo que nadie filmo
# NO se escribe por analogia (core-prohibiciones §1): va a la lista de falta_filmar.py.
# ════════════════════════════════════════════════════════════════════════════

# ── Que entra y que sale de la OP 30 ─────────────────────────────────────────
# No sale de los videos: sale del flujograma 155 y del AMFE-TR-PAT (Supabase live, Nº 162,
# updated 11/09/2026), que existen antes que estas hojas. Cada renglon tiene que estar
# nombrado en alguna hoja, o hay una parte del trabajo que el operario hace y nadie escribio.
MATERIALES_OP30 = [
    # (que es, con que palabras puede aparecer en una hoja, de donde sale que existe)
    ("el rollo de vinilo", r"vinilo|rollo|lamina|bobina",
     "AMFE-TR-PAT OP 30, elemento de trabajo 'Rollo Pre-laminado (TPO + Hot Melt)'"),
    ("los sustratos plasticos", r"sustrato",
     "IMG_0579 min 7:42: \u00abahora tiene que poner los sustratos\u00bb"),
    ("la pieza terminada", r"\bpieza\b",
     "AMFE-TR-PAT OP 30: la salida de la operacion"),
    ("el recorte de vinilo que sobra", r"resto de vinilo|esqueleto|recorte|scrap",
     "Fak, 21/09/2026: \u00abretirar las piezas y luego el resto de vinilo\u00bb"),
]


def gate_materiales_del_deck(hojas):
    """Corre sobre el DECK entero, no sobre una hoja. Lo que falta no se ve de a una."""
    import re
    texto = []
    for h in hojas:
        texto.append(str(h.get("denominacion", "")))
        texto.append(str(h.get("nota", "")))
        texto += [str(x) for x in (h.get("pasos") or [])]
        texto += [str(x) for x in (h.get("pies") or [])]
        texto += [" ".join(map(str, p)) for p in (h.get("parametros") or [])]
    todo = " ".join(texto).lower()
    faltan = [(q, d) for q, pat, d in MATERIALES_OP30 if not re.search(pat, todo)]
    if faltan:
        print("\n  FALTA UNA PARTE DEL TRABAJO, no un paso:")
        for q, d in faltan:
            print(f"    - {q}: ninguna hoja lo nombra.")
            print(f"      existe porque: {d}")
        raise SystemExit(
            "el deck no cubre todo lo que entra y sale de la operacion. El 21/09 me faltaba "
            "el vinilo entero y ningun gate lo vio, porque todos miran una hoja por vez.")
    return True


HOJAS_IMG = [
    # ── PRENDER Y CONOCER EL PUESTO ──────────────────────────────────────────
    dict(
        op="31",
        denominacion="ENCENDIDO GENERAL Y PUESTA EN MARCHA DE SERVICIOS",
        modo="secuencia",
        imagenes=[_f("e1_llave.jpg"), _f("e2_power.jpg"), _f("n3_servicios.jpg")],
        pies=["La llave general del tablero",
              "El botón verde POWER START",
              "La fila de servicios de la pantalla"],
        sin_marcas_ok=True,
        pasos=[
            "Girar la llave general del tablero a la posición I.",
            "Apretar el botón verde POWER START del tablero y esperar a que quede encendido.",
            "Prender los servicios desde la pantalla: apretar cada botón de la fila de abajo "
            "hasta que los ocho queden en verde.",
        ],
        parametros=[
            ("Servicios a prender", "los 8 de la fila de abajo"),
            ("Qué son", "vacío, calor, lámparas, enfriador y temperatura de molde"),
        ],
        fuentes=[
            "IMG_0596 (02-09-2026) min 0:01 y 0:06, en el tablero: «¿Puedo cambiar a ON? "
            "¿Asi?» / «¿Puedes prender los corrientes?»",
            "IMG_0597 (02-09-2026) s=3,0: el boton verde POWER START encendido, con su cartel",
            "IMG_0579 (02-09-2026) min 6:22 a 6:41, el tecnico: «Primer paso es prender "
            "todos los servicios, los motores de vacio, la temperatura del horno, iluminacion, "
            "refrigeracion, que es chiller y es atemperador»",
        ],
        epp=EPP_IMG,
        disparador="SI LA MÁQUINA NO ENCIENDE O UN SERVICIO NO PASA A VERDE",
        acciones=[
            "1. No insistir con la llave ni con el botón.",
            "2. Dar aviso al Líder de Producción y a Mantenimiento.",
            "3. Esperar la intervención del personal autorizado.",
        ],
    ),

    dict(
        op="32",
        denominacion="RECONOCIMIENTO DEL PUESTO DE MANDO",
        modo="rotulada",
        imagenes=[_f("r_puesto.jpg")],
        pasos=[
            "Usar la pantalla táctil para elegir el modo y prender los servicios: los "
            "parámetros no se tocan.",
            "Usar la botonera para arrancar y parar el ciclo, como indica la hoja 35.",
            "Presionar el botón de parada de emergencia ante cualquier riesgo: hay uno en la "
            "caja colgante y otro en el panel.",
            "Prender y apagar el atemperador desde la pantalla de la máquina (Mold Temp 1 y "
            "2), no desde su display.",
            "Respetar los carteles del puesto: no entra personal no autorizado y la máquina "
            "se apaga cuando no se usa.",
        ],
        fuentes=[
            "IMG_0579 (02-09-2026) min 6:22 a 6:52: servicios y modo desde la pantalla; "
            "IMG_0596 (02-09-2026) min 0:16 a 0:24: «¿Pide un usuario cuando la prendemos? "
            "... quiere cambiar el parametro, ahi te pide»",
            "IMG_0801 (09-09-2026) s=1,1: la botonera del puesto, se ve en la foto",
            "IMG_0801 s=1,1: el hongo rojo de la caja colgante y el del panel, los dos en la foto",
            "IMG_0596 (02-09-2026) min 0:30 a 0:34, frente a los equipos de agua: «todo eso "
            "se maneja de alla, de la pantalla»; el atemperador (水式模温机, maquina de temperatura "
            "de molde) se ve en la foto, y en la fila de servicios son Mold Temp 1 y Mold "
            "Temp 2 (IMG_0579 min 6:22 a 6:41: «refrigeracion, que es chiller y es "
            "atemperador»)",
            "IMG_0801 s=1,1: los carteles «NO ENTRY to unauthorised persons» y «TURN OFF "
            "MACHINE WHEN NOT IN USE»",
        ],
        epp=EPP_IMG,
        disparador="SI FALTA UN COMANDO, ESTÁ FLOJO O NO ENCIENDE",
        acciones=[
            "1. No operar la máquina.",
            "2. Dar aviso al Líder de Producción y a Mantenimiento.",
            "3. Esperar la intervención del personal autorizado.",
        ],
    ),

    # ── EL VINILO ────────────────────────────────────────────────────────────
    dict(
        op="33",
        denominacion="ENHEBRADO DEL VINILO EN EL DESENROLLADOR",
        modo="secuencia",
        imagenes=[_f("y0_rollo_cuna.jpg"), _f("x2_enhebrar.jpg"),
                  _f("x3r_mesa_sensor.jpg"), _f("x1_desenrollador.jpg")],
        pies=["El rollo en la cuna, con el tope del eje",
              "La punta entre las barras y el rodillo",
              "La punta por debajo del sensor",
              "El material del rollo, sin torcerse"],
        sin_marcas_ok=True,
        pasos=[
            "Montar el rollo de vinilo con su eje en la cuna del desenrollador y ajustar la "
            "perilla del tope contra el rollo.",
            "Pasar la punta del material entre las barras guía naranjas y el rodillo verde.",
            "Apoyar la punta sobre la mesa de carga, pasarla por debajo del sensor y "
            "alisarla con la mano.",
            "Verificar que el material salga del rollo sin torcerse ni arrugarse.",
        ],
        nota="El sensor de la mesa es el que detecta si el material quedó bien pasado: "
             "si la punta no pasa por debajo, volver a pasarla.",
        fuentes=[
            "IMG_0393 (26-08-2026) s=34,6: el rollo ya montado, con su eje sobre el soporte. "
            "Como se sube a la cuna no esta filmado ni dicho en ninguno de los 91 videos: va en "
            "la lista de falta_filmar.py, bloque 2. El tope: IMG_0579 (02-09-2026) min 0:12 a 0:25 «lo llevo para aca y lo "
            "ajustamos / ¿esto es el tope? / si», con la mano en la perilla del cono del eje "
            "(s=12, 23 y 26)",
            "IMG_0393 (26-08-2026) s=48,5: las manos llevan la punta entre las barras guia "
            "naranjas y el rodillo verde; y en el audio, min 0:38 en chino (IMG_0393.zh.txt): "
            "走个两者中间走, pasalo por el medio de los dos",
            "Fak, 23-09-2026: «tiene un sensor ahi que detecta si pasamos bien el material». "
            "El sensor es el soporte con el cable negro al borde de la mesa (IMG_0393 s=112 y "
            "s=114, marcado en la foto); el operario apoya y alisa el material en s=114",
            "IMG_0393 (26-08-2026) s=134: el rollo en la cuna del desenrollador, con el eje "
            "y su soporte, y el material corriendo derecho a la mesa",
        ],
        epp=EPP_IMG,
        disparador="SI EL MATERIAL SALE TORCIDO O CON ARRUGAS DEL ROLLO",
        acciones=[
            "1. No forzar el rollo a mano con la máquina en marcha.",
            "2. Dar aviso al Líder de Producción.",
            "3. Esperar la intervención del personal autorizado.",
        ],
    ),

    dict(
        op="34",
        denominacion="AVANCE DEL VINILO CON LOS SELECTORES",
        modo="secuencia",
        imagenes=[_f("x6b_alimentacion.jpg"), _f("x4b_selectores.jpg"), _f("x8_lazo.jpg")],
        pies=["Selección Lámina Alimentación",
              "Selectores UNCOILER y Leather Convey",
              "El material colgando antes de la mesa"],
        sin_marcas_ok=True,
        pasos=[
            "Verificar en la pantalla, cuadro Operación del Equipo, que Selección Lámina "
            "Alimentación esté en Cuero en rollo. Si no, avisar al Líder de Producción.",
            "Dar material con los dos selectores juntos en FWD, UNCOILER y Leather Convey, "
            "y volverlos al medio para parar.",
            "Dejar siempre el material colgando entre el desenrollador y la mesa de carga, "
            "sin tensar.",
        ],
        nota="UNCOILER y Leather Convey se usan solo cuando falta material colgando. La "
             "botonera de atrás (mordaza de tiro, placas y cuchilla) no se usa en automático: "
             "el corte lo hace la máquina sola.",
        fuentes=[
            "IMG_0661 (04-09-2026) s=30: en la pantalla, cuadro «Operacion del Equipo», se lee "
            "«Seleccion Lamina Alimentacion: Cuero en rollo»",
            "IMG_0579 (02-09-2026) min 1:00 a 1:22: «lo que hace es que vos giras... y esto "
            "negrito baja», con la mano en los dos selectores (s=74 a 78) y el material "
            "bajando entre el desenrollador y la mesa (s=79 a 107). IMG_0582 min 6:08 a 6:24, "
            "el tecnico en chino: 这个上料会送料 «esto de la carga alimenta material» / "
            "因为它两个是配套的 «los dos van juntos». Las chapas UNCOILER 开卷机 y Leather "
            "Convey 皮料输送 con FWD 正转 y REV 反转 se leen en IMG_0579 s=96 (la foto)",
            "Fak, 23-09-2026: «siempre dejamos el rollo colgando». Se ve en IMG_0579 s=103 "
            "(la foto) y en IMG_0393 s=282 a 294. Nota: Fak, 23-09-2026, sobre los "
            "selectores: «lo usabamos a veces nomas»; el corte en automatico, IMG_0579 min "
            "2:48 a 2:54: «¿esto esta sincronizado automatico, que haga ese primer corte? / "
            "automatico»; la botonera de atrás explicada como mando a mano, min 2:08 a 2:24",
        ],
        epp=EPP_IMG,
        disparador="SI EL MATERIAL NO BAJA, QUEDA TENSO O AVANZA TORCIDO",
        acciones=[
            "1. Volver los dos selectores al medio.",
            "2. No tirar del material a mano con los selectores en FWD.",
            "3. Dar aviso al Líder de Producción.",
        ],
    ),

    # ── ARRANCAR ─────────────────────────────────────────────────────────────
    dict(
        op="35",
        denominacion="ARRANQUE DE LA MAQUINA EN MODO AUTOMATICO",
        modo="rotulada",
        imagenes=[_f("r2_botonera.jpg")],
        pasos=[
            "Poner el selector de modo en automático y elegir Modo Automático en la lista de "
            "la pantalla.",
            "Mantener apretado el botón azul RESET hasta que quede encendido.",
            "Apretar el botón verde de arranque de ciclo.",
            "Apretar el botón negro de la caja colgante cuando el carro de arriba empieza a "
            "moverse.",
            "Apretar el botón rojo de parada de ciclo cuando haya que parar la máquina.",
            "Presionar el botón de parada de emergencia ante cualquier riesgo.",
        ],
        nota="Solo en el primer ciclo, antes de apretar el verde: cuando el RESET queda "
             "encendido, la máquina corta la punta del vinilo. Sacar ese recorte, tirarlo al "
             "cajón de scrap y colocar los sustratos.",
        fuentes=[
            "IMG_0579 (02-09-2026) min 6:41 a 6:52: «directamente automatico», con la lista "
            "de modos en la pantalla; el selector 自动/手动 se ve en IMG_0840 s=4",
            "IMG_0579 (02-09-2026) min 7:09: «cuando este luce azul esta encendido»; min "
            "2:42: «tiene que presionar como 3 o 5 segundos»",
            "IMG_0842 (10-09-2026) min 0:00: «boton verde y despues boton negro»; el cartel "
            "循环启动 es arranque de ciclo",
            "IMG_0842 (10-09-2026) min 0:00 y 1:05 a 1:11: «boton verde y despues boton "
            "negro» / «cuando se empieza a mover el carro de arriba, recien ahi arranca, "
            "porque ahi va a buscar la placa»",
            "IMG_0840 (10-09-2026) s=4: el boton rojo con su cartel 循环停止, parada de ciclo",
            "IMG_0840 (10-09-2026) s=4: el hongo de emergencia sobre fondo amarillo. Nota: "
            "IMG_0579 min 2:46 a 2:54 «¿esto esta sincronizado automatico, que haga ese "
            "primer corte? — si, si», min 3:29 «sacar y lo tiras», y min 7:41 «encendido se "
            "puede cortar y ahora tienen que poner los sustratos», en ese orden: RESET, corte, "
            "sustratos; el verde es el paso siguiente de la hoja",
        ],
        epp=EPP_IMG,
        disparador="SI EL CICLO NO ARRANCA O LA PANTALLA MUESTRA UNA ALARMA",
        acciones=[
            "1. No repetir el arranque.",
            "2. Anotar la alarma que muestra la pantalla.",
            "3. Dar aviso al Líder de Producción.",
        ],
    ),

    # ── CADA CICLO ───────────────────────────────────────────────────────────
    dict(
        op="36",
        denominacion="DESCARGA DE PIEZAS Y CARGA DE SUSTRATOS",
        modo="secuencia",
        imagenes=[_f("d1_pieza.jpg"), _f("d2_vinilo.jpg"),
                  _f("d5_caballete.jpg"), _f("d3_sustratos.jpg")],
        pies=["Las piezas en el molde inferior",
              "El resto de vinilo sobre el molde",
              "Las piezas sobre la mesa",
              "Un sustrato en cada nido del molde"],
        sin_marcas_ok=True,
        pasos=[
            "Retirar las piezas del molde recién cuando los expulsores las levantan.",
            "Sacar del molde el resto de vinilo que sobra.",
            "Apoyar las piezas sobre la mesa sin que se toquen entre sí, para que no se "
            "marquen.",
            "Colocar un sustrato plástico nuevo en cada nido del molde y verificar que se "
            "encienda la luz de cada posición.",
        ],
        fuentes=[
            "Fak, 21-09-2026: «la maquina no se abre sola, expulsa las piezas con los "
            "expulsores, y ahi el operario tiene que retirar las piezas»; se ve en "
            "IMG_0844 s=488",
            "Fak, 21-09-2026: «y luego el resto de vinilo»; se ve en IMG_0844 s=492, el "
            "operario sacando la lamina sobrante del molde verde",
            "IMG_0844 (10-09-2026) min 6:33 a 6:36: «dale de a 2, para que no se marcan las "
            "piezas una con la otra»; las piezas sobre la mesa se ven en s=505. Fak, "
            "23-09-2026: «las piezas que salen de la maquina se colocan en una mesa, no en un "
            "caballete»",
            "IMG_0579 (02-09-2026) min 7:42 a 8:09, el tecnico: «ahora tiene que poner los "
            "sustratos» / «si lo falta, le falta luz»; se ven en s=480. IMG_0844 min 0:00 a "
            "0:04: «yo cargo las dos... el carga las otras dos»",
        ],
        epp=EPP_IMG,
        disparador="SI HAY QUE ENTRAR AL MOLDE ANTES DE QUE LOS EXPULSORES LEVANTEN LAS "
                   "PIEZAS",
        acciones=[
            "1. No entrar: esperar a que los expulsores levanten las piezas.",
            "2. Ante cualquier riesgo, presionar el botón de parada de emergencia.",
            "3. Dar aviso al Líder de Producción.",
        ],
    ),

    dict(
        op="37",
        denominacion="CONTROL DE PIEZA TERMOFORMADA",
        modo="secuencia",
        # Los "tres puntitos" salieron el 23/09. Fak: «esa foto de los 3 puntos entendiste
        # mal, es cualquier cosa, saca eso». No vuelve sin que el lo pida.
        imagenes=[_f("z1b_globito.jpg"), _f("n7b_despegue.jpg")],
        pies=["Globito en la punta: así NO",
              "Piel despegada en la punta: así NO"],
        sin_marcas_ok=True,
        pasos=[
            "Pasar la mano por la superficie de cada pieza y verificar que no tenga globitos.",
            "Verificar que la piel esté pegada en la punta, sin despegue.",
        ],
        fuentes=[
            "IMG_0859 (11-09-2026) min 0:08 a 0:21: «es la que tenia el globito» / «con eso "
            "logramos eliminar el globito». La foto es de Fak, 10-09-2026: burbuja y grano "
            "planchado en la punta",
            "IMG_0813 (09-09-2026) min 0:00: «el T17 genero este defecto que no termino de "
            "pegar bien en la punta»",
        ],
        epp=EPP_IMG,
        disparador="SI LA PIEZA SALE CON GLOBITO O CON LA PIEL DESPEGADA EN LA PUNTA",
        acciones=[
            "1. Apartar la pieza e identificarla.",
            "2. Dar aviso al Líder de Producción.",
            "3. No tocar parámetros por cuenta propia.",
        ],
    ),
]


PLANCHA_DECK = _f("_plancha_del_deck.jpg")


def gate_fotos_miradas(hojas, portada=None):
    """Las fotos del deck se MIRAN juntas antes de compilar. Este gate obliga ese paso.

    22/09/2026. Entregue el bloque del vinilo con el operario ACOSTADO y con dos fotos
    movidas. El IMG_0393 declara `rotation=-90`, pero el que filma giro el telefono a
    mitad del video: la rotacion correcta cambia segun el segundo y el metadato del
    archivo no la da. Del MISMO video, con los mismos parametros, una foto salio derecha
    y la otra de costado.

    Y no hay numero que lo cace. Probe el foco contra las 55 fotos de la carpeta: las de
    la llave general (34) y el caballete (109) estan perfectas, y `w5_selectores` (37) es
    ilegible. El percentil 99,5 tampoco separa (27 y 30 buenas contra 37 y 39 malas). Un
    umbral ahi adentro tiraba seis fotos buenas.

    Asi que el gate no juzga la foto: exige que la plancha exista y sea MAS NUEVA que la
    ultima foto que toque. Para pasarlo hay que regenerarla, y para regenerarla se abre.
    """
    fotos = []
    for h in hojas:
        fotos += list(h.get("imagenes", []))
    if portada:
        fotos.append(portada)
    fotos = [f for f in dict.fromkeys(fotos) if os.path.exists(f)]
    repo = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
    cmd = ("py -3 .claude/skills/hojas-de-proceso/scripts/fotodevideo.py contacto "
           + " ".join(f'"{os.path.relpath(f, repo)}"' for f in fotos)
           + f' --cols 3 --plancha "{os.path.relpath(PLANCHA_DECK, repo)}"')
    if not os.path.exists(PLANCHA_DECK):
        raise SystemExit("No hay plancha de contacto de las fotos del deck. Generala y "
                         "MIRALA antes de compilar:\n\n  " + cmd + "\n")
    t = os.path.getmtime(PLANCHA_DECK)
    nuevas = [os.path.basename(f) for f in fotos if os.path.getmtime(f) > t]
    if nuevas:
        raise SystemExit(f"{len(nuevas)} foto(s) cambiaron despues de la ultima plancha y "
                         f"nadie las miro:\n  " + "\n  ".join(nuevas)
                         + "\n\nRegenerala y MIRALA:\n\n  " + cmd + "\n")


def compilar_deck():
    gate_materiales_del_deck(HOJAS_IMG)
    gate_fotos_miradas(HOJAS_IMG, PORTADA_IMG.get("foto"))
    print(f"Iniciando compilacion de Hoja de Proceso IMG "
          f"({len(HOJAS_IMG) + 1} laminas: portada + {len(HOJAS_IMG)})...")
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

    prs.save(salida_repo)
    print(f"\n[OK] Presentacion guardada en:")
    print(f"  1. {salida_repo}")
    try:
        prs.save(salida_desktop)
        print(f"  2. {salida_desktop}")
    except PermissionError:
        print(f"  [AVISO] {salida_desktop} está actualmente abierto en PowerPoint. Se guardará cuando el usuario lo cierre.")

if __name__ == "__main__":
    compilar_deck()

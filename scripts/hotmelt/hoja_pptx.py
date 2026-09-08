# -*- coding: utf-8 -*-
"""
Generador de HOJAS DE OPERACIONES en PowerPoint, replicando el formulario oficial
del SGC de Barack (I-IN-002.4-R01) tal como esta en HO-985 / HO-986.

Una lamina = una operacion. Hoja A4 apaisada, para que se imprima igual que la HO
de Excel y se pueda colgar en el puesto.

Paleta y tipografia sacadas del xlsx real:
  · bandas de encabezado         #44546A (dk2 del tema), texto blanco
  · banda ELEMENTOS DE SEGURIDAD #4472C4 (accent1)
  · Calibri en todo, salvo el PLAN DE REACCION que va en Arial 10 bold
"""
import os
from pptx import Presentation
from pptx.util import Cm, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from PIL import Image

import sys

# ── los criterios de imagen viven en UN solo lugar ───────────────────────────
# El generador dibuja con los mismos numeros con los que el gate rechaza. Si el reparto o el
# umbral de legibilidad se copian aca, el dia que cambie uno el otro queda mintiendo.
_SKILL = os.path.join(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))), ".claude", "skills", "hojas-de-proceso", "scripts")
_SKILL2 = os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), ".claude", "skills", "hojas-de-proceso", "scripts")
for _p in (_SKILL2, _SKILL, r"C:\Dev\BarackMercosul\.claude\skills\hojas-de-proceso\scripts"):
    if os.path.isdir(_p) and _p not in sys.path:
        sys.path.insert(0, _p)
import hojalib as HL                                          # noqa: E402

_lineas_wrap = HL.lineas_wrap
_ancho_cm = HL.ancho_cm
_layout_principal = HL.layout_principal
_layout_grilla = HL.layout_grilla
_layout_orientacion = HL.layout_orientacion
_layout_secuencia = HL.layout_secuencia

# ─── paleta ───────────────────────────────────────────────────────────────────
AZUL   = RGBColor(0x44, 0x54, 0x6A)
AZUL2  = RGBColor(0x44, 0x72, 0xC4)
BLANCO = RGBColor(0xFF, 0xFF, 0xFF)
NEGRO  = RGBColor(0x00, 0x00, 0x00)
GRISF  = RGBColor(0xF2, 0xF2, 0xF2)

# ─── geometria (cm) ───────────────────────────────────────────────────────────
W, H = 29.7, 21.0
M = 0.7
X0, X1 = M, W - M                      # 0.70 .. 29.00   (ancho util 28.30)
HDR_Y, HDR_H = M, 4.00                 # 0.70 .. 4.70
# El bloque de imagenes se agranda todo lo que se puede sin romper el formulario:
# mas ancho (16.2 en vez de 15.2) y mas alto (9.9 en vez de 9.3), robandole a los
# bloques de abajo lo que les sobraba. Con 3 fotos por hoja quedan un 40% mas grandes.
BODY_Y, BODY_H = HL.BODY_Y, HL.BODY_H   # 4.90 .. 14.80
IMG_W = HL.IMG_W
IMG_X = X0
DSC_X = X0 + IMG_W + 0.25
DSC_W = X1 - DSC_X
CIC_Y, CIC_H = 15.00, 3.10             # 15.00 .. 18.10
EPP_W = 6.40
CIC_W = X1 - X0 - EPP_W - 0.25
EPP_X = X0 + CIC_W + 0.25
PLN_Y = 18.30                          # 18.30 .. 20.30
PLN_H = H - M - PLN_Y


# ─── primitivas ───────────────────────────────────────────────────────────────
def _caja(slide, x, y, w, h, relleno=None, borde=NEGRO, ancho=Pt(1)):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Cm(x), Cm(y), Cm(w), Cm(h))
    if relleno is None:
        sh.fill.background()
    else:
        sh.fill.solid(); sh.fill.fore_color.rgb = relleno
    if borde is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = borde; sh.line.width = ancho
    sh.shadow.inherit = False
    sh.text_frame.word_wrap = True
    return sh


from PIL import ImageFont
import functools

_TTF = {"Calibri": r"C:\Windows\Fonts\calibri.ttf",
        "Calibri-b": r"C:\Windows\Fonts\calibrib.ttf",
        "Arial": r"C:\Windows\Fonts\arial.ttf",
        "Arial-b": r"C:\Windows\Fonts\arialbd.ttf"}
PT_CM = HL.PT_CM

@functools.lru_cache(maxsize=512)
def _fuente(nombre, bold, px):
    ruta = _TTF.get(nombre + ("-b" if bold else ""), _TTF["Calibri"])
    return ImageFont.truetype(ruta, max(int(px), 4))


def _achicar(texto, w_cm, h_cm, base, margen=0.06, minimo=5.5,
             fuente="Calibri", bold=False):
    """Baja el cuerpo hasta que el texto ENTRA de verdad en la celda.
    Se mide con la fuente real (PIL/TTF), no con un promedio de ancho."""
    if not texto:
        return base
    # PowerPoint corta antes que la medicion pelada: el borde de 1 pt y su propio
    # redondeo se comen ~2 mm. Sin este margen, una linea que "entra" por 0,3 mm
    # se parte en dos y el renglon de abajo queda cortado por el borde de la celda.
    util_w = max(w_cm - 2 * margen - 0.24, 0.4)
    util_h = max(h_cm - 0.10, 0.2)
    palabras = str(texto).split()
    s = base
    while s >= minimo:
        lh = 1.22 * s * PT_CM
        lineas, actual = 1, ""
        cabe = True
        for p in palabras:
            if _ancho_cm(p, s, fuente, bold) > util_w:   # palabra sola no entra
                cabe = False; break
            probar = (actual + " " + p) if actual else p
            if _ancho_cm(probar, s, fuente, bold) <= util_w:
                actual = probar
            else:
                lineas += 1; actual = p
        if cabe and lineas * lh <= util_h:
            return s
        s -= 0.5
    return minimo


def _txt(sh, texto, size=11, bold=False, color=NEGRO, align=PP_ALIGN.CENTER,
         anchor=MSO_ANCHOR.MIDDLE, fuente="Calibri", margen=0.06):
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Cm(margen)
    tf.margin_top = tf.margin_bottom = Cm(0.02)
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run(); r.text = texto
    r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color
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
    return _celda(slide, x, y, w, h, texto, relleno=azul, size=size,
                  bold=True, color=BLANCO)


# ─── 1. cajetin ───────────────────────────────────────────────────────────────
# Anchos del cajetin, calcados del formulario I-IN-002.4-R01:
#   la fila de ARRIBA tiene 3 casilleros (Nº OP · DENOMINACION · MODELO O VEHICULO)
#   la de ABAJO tiene 4      (SECTOR · COD. DE PIEZA · CLIENTE · Nº PUESTO)
# "Nº PUESTO" es una columna angosta entre CLIENTE y el bloque de firmas, y NO se
# reemplaza por ningun campo nuevo: el formulario no tiene casillero "MAQUINA".
C_OP, C_DEN, C_CLI, C_PUE = 3.40, 10.60, 4.20, 3.00
C_LAB, C_VAL = 2.80, 4.30                          # bloque de firmas
C_MOD = C_CLI + C_PUE                              # arriba, MODELO ocupa las dos

def cajetin(slide, d, logo=None):
    top_h = 1.60
    fila = (HDR_H - top_h) / 4                      # 0.60

    # ── franja superior: logo | titulo | form + Nº HO ──
    lw, rw = 4.30, C_LAB + C_VAL
    _caja(slide, X0, HDR_Y, lw, top_h, BLANCO)
    if logo and os.path.exists(logo):
        im = Image.open(logo); ar = im.width / im.height
        ih = min(top_h - 0.30, (lw - 0.5) / ar); iw = ih * ar
        slide.shapes.add_picture(logo, Cm(X0 + (lw - iw) / 2),
                                 Cm(HDR_Y + (top_h - ih) / 2), Cm(iw), Cm(ih))
    _celda(slide, X0 + lw, HDR_Y, X1 - X0 - lw - rw, top_h,
           d.get("titulo_hoja", "HOJA DE OPERACIONES"), size=26, bold=True)
    _celda(slide, X1 - rw, HDR_Y, rw, top_h * 0.42,
           f"Form: {d.get('form', 'I-IN-002.4-R01')}", size=10.5, bold=True)
    _celda(slide, X1 - rw, HDR_Y + top_h * 0.42, rw, top_h * 0.58,
           d.get("ho", "HO-TBD"), size=22, bold=True)

    # ── 4 filas: etiqueta / valor / etiqueta / valor ──
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
                   size=(8 if etiqueta else 10),
                   bold=(not etiqueta))
            x += an
        lab, val = der[i]
        _celda(slide, x, yy, C_LAB, fila, lab, relleno=AZUL, color=BLANCO,
               size=8.5, align=PP_ALIGN.LEFT, margen=0.12)
        _celda(slide, x + C_LAB, yy, C_VAL, fila, str(val),
               size=10, bold=True)


# ─── 2. imagenes ──────────────────────────────────────────────────────────────
def _badge(slide, x, y, numero):
    """Circulo azul con el numero del PASO, montado en la esquina de la foto.

    Es lo unico que ata la foto al texto: con 4 fotos y 4 pasos sueltos, el operario tiene
    que adivinar cual mira. Va siempre que la hoja declare a que paso pertenece cada foto."""
    d = 0.70
    sh = slide.shapes.add_shape(MSO_SHAPE.OVAL, Cm(x), Cm(y), Cm(d), Cm(d))
    sh.fill.solid(); sh.fill.fore_color.rgb = AZUL
    sh.line.color.rgb = BLANCO; sh.line.width = Pt(1.5)
    sh.shadow.inherit = False
    tf = sh.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = str(numero)
    r.font.size = Pt(12); r.font.bold = True
    r.font.name = "Calibri"; r.font.color.rgb = BLANCO
    return sh


def _reparto(imagenes, principal, secuencia, W, H):
    """Elige el layout: SECUENCIA (cada foto es un paso, ninguna manda) o JERARQUIA
    (una foto es la que el paso manda mirar, va grande y el resto acompaña)."""
    ars = [Image.open(i).width / Image.open(i).height for i in imagenes]
    n = len(imagenes)
    if secuencia:
        mejor = _layout_secuencia(ars, W, H)
        if mejor:
            return mejor
    if principal is not None:
        mejor = _layout_principal(ars, W, H, principal)
        if mejor:
            return mejor
    # sin jerarquia declarada: el reparto viejo, por superficie total
    cands = [_layout_grilla(ars, W, H, c) for c in range(1, n + 1)]
    cands.append(_layout_orientacion(ars, W, H))
    cands = [c for c in cands if c]
    return max(cands, key=lambda L: sum(w * hh for _, _, w, hh in L))


def bloque_imagenes(slide, imagenes, principal=None, nums=None, secuencia=False):
    _banda(slide, IMG_X, BODY_Y, IMG_W, 0.60, "IMÁGENES", size=12)
    y0 = BODY_Y + 0.60
    h = BODY_H - 0.60
    _caja(slide, IMG_X, y0, IMG_W, h, BLANCO)
    nums = list(nums or [None] * len(imagenes))
    pares = [(r, nums[k]) for k, r in enumerate(imagenes) if os.path.exists(r)]
    if not pares:
        return                                     # recuadro VACIO, sin leyenda
    imagenes = [r for r, _ in pares]
    W, H = IMG_W - 0.2, h - 0.2
    mejor = _reparto(imagenes, principal, secuencia, W, H)

    for (ruta, num), (x, y, w, hh) in zip(pares, mejor):
        slide.shapes.add_picture(ruta, Cm(IMG_X + 0.1 + x), Cm(y0 + 0.1 + y),
                                 Cm(w), Cm(hh))
        if num is not None:
            _badge(slide, IMG_X + 0.1 + x - 0.16, y0 + 0.1 + y - 0.16, num)


def bloque_pasos(slide, pasos, nota=None, desde=1):
    """`desde`: numero del primer paso. Una operacion partida en dos laminas sigue
    numerando corrido (1-4 en la primera, 5-8 en la segunda): el operario lee UNA
    secuencia, no dos listas que arrancan de 1."""
    _banda(slide, DSC_X, BODY_Y, DSC_W, 0.60, "DESCRIPCION DE LA OPERACIÓN", size=12)
    y = BODY_Y + 0.60
    h = BODY_H - 0.60
    sh = _caja(slide, DSC_X, y, DSC_W, h, BLANCO)
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Cm(0.25)
    tf.margin_top = Cm(0.20)
    # cuerpo: el mas grande con el que TODO el bloque entra, medido con la fuente real
    util_w = DSC_W - 2 * 0.25 - 0.75          # sangria del numero
    util_h = h - 0.35
    size = 13
    while size > 7.5:
        lh = 1.22 * size * PT_CM
        sep = (7 if size >= 11 else 5) * PT_CM
        alto = 0
        for t in pasos:
            alto += _lineas_wrap(t, size, util_w, False) * lh + sep
        if nota:
            # la nota va en negrita, un cuerpo mas chica y SIN la sangria del numero:
            # se mide con su propio ancho y su propio cuerpo, no a ojo.
            sn = max(size - 1, 8)
            alto += (_lineas_wrap(nota, sn, DSC_W - 2 * 0.25, True) * 1.22 * sn * PT_CM
                     + 6 * PT_CM)
        if alto <= util_h:
            break
        size -= 0.5
    else:
        print(f"   !! NO ENTRA ni a 7.5 pt: {pasos[0][:40]}...")
    for i, texto in enumerate(pasos):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(7 if size >= 11 else 5)
        r = p.add_run(); r.text = f"{desde + i}.  "
        r.font.size = Pt(size); r.font.bold = True
        r.font.name = "Calibri"; r.font.color.rgb = NEGRO
        r = p.add_run(); r.text = texto
        r.font.size = Pt(size); r.font.name = "Calibri"; r.font.color.rgb = NEGRO
    if nota:
        p = tf.add_paragraph(); p.alignment = PP_ALIGN.LEFT
        p.space_before = Pt(6)
        r = p.add_run(); r.text = nota
        r.font.size = Pt(max(size - 1, 8)); r.font.bold = True
        r.font.name = "Calibri"; r.font.color.rgb = AZUL


# ─── 4. ciclo de control ──────────────────────────────────────────────────────
COLS_CIC = [("Características a controlar", 8.0), ("Método de control", 5.6),
            ("Resp.", 2.7), ("Frec.", 2.9), ("Registro", 3.4)]

def bloque_ciclo(slide, filas):
    _banda(slide, X0, CIC_Y, CIC_W, 0.55, "CICLO DE CONTROL", size=12)
    y = CIC_Y + 0.55
    total = sum(w for _, w in COLS_CIC)
    anchos = [w / total * CIC_W for _, w in COLS_CIC]
    hh = 0.48
    x = X0
    for (lab, _), an in zip(COLS_CIC, anchos):
        _celda(slide, x, y, an, hh, lab, relleno=AZUL, color=BLANCO,
               size=8.5, bold=True)
        x += an
    y += hh
    # Fak, 07/09/2026: el ciclo de control va VACIO hasta que Calidad emita su Plan de
    # Control. La tabla conserva bordes y cabecera; el cuerpo queda en blanco.
    filas = filas or [("", "", "", "", "")] * 2
    fh = (CIC_Y + CIC_H - y) / len(filas)
    for f in filas:
        x = X0
        for val, an in zip(f, anchos):
            _celda(slide, x, y, an, fh, str(val), size=8.5)
            x += an
        y += fh


# ─── 5. elementos de seguridad ────────────────────────────────────────────────
def bloque_epp(slide, iconos, refs=("OP - Operador de Producción",
                                    "OC - Operador de Calidad")):
    _banda(slide, EPP_X, CIC_Y, EPP_W, 0.55, "ELEMENTOS DE SEGURIDAD",
           size=9, azul=AZUL2)
    y = CIC_Y + 0.55
    h = CIC_H - 0.55 - 0.44 * len(refs)
    _caja(slide, EPP_X, y, EPP_W, h, BLANCO)
    if iconos:
        n = len(iconos)
        cw = (EPP_W - 0.2) / n
        s = min(cw - 0.12, h - 0.20)
        for k, ic in enumerate(iconos):
            if not os.path.exists(ic):
                continue
            cx = EPP_X + 0.1 + k * cw + (cw - s) / 2
            slide.shapes.add_picture(ic, Cm(cx), Cm(y + (h - s) / 2), Cm(s), Cm(s))
    yr = y + h
    for r in refs:
        _celda(slide, EPP_X, yr, EPP_W, 0.44, f"Referencia: {r}", size=7,
               align=PP_ALIGN.LEFT, margen=0.12)
        yr += 0.44


# ─── 6. plan de reaccion ──────────────────────────────────────────────────────
FIJAS = ["DETENGA LA OPERACIÓN",
         "NOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR",
         "ESPERE LA DEFINICION DEL LIDER O SUPERVISOR"]

def bloque_plan(slide, disparador, acciones=None):
    _banda(slide, X0, PLN_Y, X1 - X0, 0.48, "PLAN DE REACCION ANTE NO CONFORME", size=11)
    y = PLN_Y + 0.48
    hh = PLN_H - 0.48
    izq = 15.20
    # las tres lineas fijas necesitan aire: la del medio es la mas larga y con el
    # alto justo de una linea se arriesga a pisar la de abajo al imprimir.
    _celda(slide, X0, y, izq, hh * 0.28, disparador, size=8.5, bold=True,
           fuente="Arial", relleno=GRISF, align=PP_ALIGN.LEFT, margen=0.15)
    fy = y + hh * 0.28
    fh = (hh * 0.72) / 3
    for t in FIJAS:
        _celda(slide, X0, fy, izq, fh, t, size=8.5, bold=True, fuente="Arial",
               align=PP_ALIGN.LEFT, margen=0.15)
        fy += fh
    der = X1 - X0 - izq
    sh = _caja(slide, X0 + izq, y, der, hh, BLANCO)
    tf = sh.text_frame; tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Cm(0.2); tf.margin_top = Cm(0.12)
    for i, t in enumerate(acciones or ["TBD"]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(3)
        r = p.add_run(); r.text = t
        r.font.size = Pt(9); r.font.name = "Arial"; r.font.color.rgb = NEGRO


# ─── armado ───────────────────────────────────────────────────────────────────
def nueva_presentacion():
    prs = Presentation()
    prs.slide_width = Cm(W)
    prs.slide_height = Cm(H)
    return prs


def portada(prs, d, logo=None, foto=None, indice=None):
    """Caratula: identifica el documento y lista las hojas que vienen."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _caja(slide, X0, M, X1 - X0, H - 2 * M, BLANCO)

    # franja de titulo
    _caja(slide, X0, M, X1 - X0, 3.5, AZUL, borde=AZUL)
    if logo and os.path.exists(logo):
        im = Image.open(logo); ar = im.width / im.height
        ih = 1.5; iw = ih * ar
        blanco = _caja(slide, X0 + 0.35, M + 0.35, iw + 0.6, ih + 0.5, BLANCO, borde=None)
        slide.shapes.add_picture(logo, Cm(X0 + 0.65), Cm(M + 0.60), Cm(iw), Cm(ih))
    _celda(slide, X0 + 6.2, M + 0.45, X1 - X0 - 6.9, 1.5,
           d.get("titulo", "HOJAS DE PROCESO"), size=30, bold=True, color=BLANCO,
           relleno=AZUL, borde=None)
    _celda(slide, X0 + 6.2, M + 1.95, X1 - X0 - 6.9, 1.0,
           d.get("subtitulo", ""), size=14, color=BLANCO, relleno=AZUL, borde=None)

    y = M + 3.5 + 0.5
    # foto grande a la izquierda
    fw = 13.6
    bh = H - M - y - 0.1                      # todo el alto libre
    if foto and os.path.exists(foto):
        im = Image.open(foto); ar = im.width / im.height
        iw, ih = (fw, fw / ar) if fw / ar <= bh else (bh * ar, bh)
        slide.shapes.add_picture(foto, Cm(X0 + (fw - iw) / 2),
                                 Cm(y + (bh - ih) / 2), Cm(iw), Cm(ih))

    # ficha + indice a la derecha
    xd = X0 + fw + 0.6
    wd = X1 - xd
    filas = [("Documento", d.get("ho", "")), ("Formulario", d.get("form", "I-IN-002.4-R01")),
             ("Operación", d.get("op_flujo", "")), ("Cliente / Modelo", d.get("cliente_modelo", "")),
             ("Pieza", d.get("pieza", "")), ("Máquina", d.get("maquina", "")),
             ("Realizó / Aprobó", d.get("firmas", "")), ("Fecha / Rev.", d.get("fecha_rev", ""))]
    fh = 0.72
    for i, (k, v) in enumerate(filas):
        _celda(slide, xd, y + i * fh, wd * 0.42, fh, k, relleno=AZUL, color=BLANCO,
               size=9, align=PP_ALIGN.LEFT, margen=0.12)
        _celda(slide, xd + wd * 0.42, y + i * fh, wd * 0.58, fh, str(v), size=9.5,
               bold=True, align=PP_ALIGN.LEFT, margen=0.12)
    yi = y + len(filas) * fh + 0.5
    _banda(slide, xd, yi, wd, 0.55, "HOJAS DE ESTE DOCUMENTO", size=10)
    sh = _caja(slide, xd, yi + 0.55, wd, (M + H - 2 * M) - yi - 0.55 + 0.0, BLANCO)
    tf = sh.text_frame; tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Cm(0.2); tf.margin_top = Cm(0.15)
    # El indice se agrupa POR ETAPA. Leidas en fila, las hojas tienen una logica clara —se
    # prepara, se produce, se reacciona si algo interrumpe, y se termina—, pero una lista
    # plana no distingue lo que se hace SIEMPRE de lo que se hace SOLO SI PASA ALGO.
    # Acepta las dos formas: [(num, nombre), ...] o [(etapa, subtitulo, [(num, nombre)...]), ...]
    grupos = indice or []
    if grupos and len(grupos[0]) == 2:
        grupos = [(None, None, list(grupos))]
    primero = True
    for tit, sub, hojas in grupos:
        if tit:
            p = tf.paragraphs[0] if primero else tf.add_paragraph()
            p.alignment = PP_ALIGN.LEFT
            p.space_before = Pt(0 if primero else 6); p.space_after = Pt(1)
            r = p.add_run(); r.text = tit + "   "
            r.font.size = Pt(8.5); r.font.bold = True
            r.font.name = "Calibri"; r.font.color.rgb = AZUL
            if sub:
                r = p.add_run(); r.text = sub
                r.font.size = Pt(7); r.font.italic = True
                r.font.name = "Calibri"; r.font.color.rgb = RGBColor(0x70, 0x76, 0x84)
            primero = False
        for num, nom in hojas:
            q = tf.paragraphs[0] if primero else tf.add_paragraph()
            primero = False
            q.alignment = PP_ALIGN.LEFT; q.space_after = Pt(0)
            r = q.add_run(); r.text = ("     %s   " % num) if tit else ("%s   " % num)
            r.font.size = Pt(7.5); r.font.bold = True
            r.font.name = "Calibri"; r.font.color.rgb = AZUL
            r = q.add_run(); r.text = nom
            r.font.size = Pt(7.5); r.font.name = "Calibri"; r.font.color.rgb = NEGRO
    return slide


def hoja(prs, d, logo=None):
    """d: dict con cajetin, imagenes, pasos, ciclo, epp, plan.

    Dos formatos de hoja, y la hoja dice cual:
      · `secuencia=True` — cada foto es un paso, con su numero encima (①②③④). Si la
        operacion no entra, se parte en varias laminas y `desde` continua la numeracion.
      · el de siempre — `principal=<idx>` declara cual foto manda; las otras acompañan.
    """
    slide = prs.slides.add_slide(prs.slide_layouts[6])   # en blanco, sin heredar nada
    cajetin(slide, d, logo)
    desde = d.get("desde", 1)
    imgs = d.get("imagenes", [])
    pasos = d.get("pasos", [])
    nums = d.get("nums")
    if d.get("secuencia") and nums is None and len(imgs) == len(pasos):
        nums = list(range(desde, desde + len(imgs)))     # foto i = paso i, sin ambiguedad
    bloque_imagenes(slide, imgs, d.get("principal"), nums, d.get("secuencia", False))
    bloque_pasos(slide, pasos, d.get("nota"), desde)
    bloque_ciclo(slide, d.get("ciclo", []))
    bloque_epp(slide, d.get("epp", []), d.get("refs", ("OP - Operador de Producción",
                                                       "OC - Operador de Calidad")))
    bloque_plan(slide, d.get("disparador", "SI DETECTA \"PRODUCTO\" O \"PROCESO\" NO CONFORME"),
                d.get("acciones"))
    return slide


def bloque_imagenes_solo_fotos(slide, imagenes, principal=None, nums=None, secuencia=False):
    """Coloca las fotos en el bloque IMAGENES de una lamina QUE YA EXISTE.
    Mismo empaquetado que `bloque_imagenes`, pero sin dibujar la banda ni el recuadro:
    se usa para cambiarle las fotos a un deck ya armado sin tocarle nada mas."""
    y0 = BODY_Y + 0.60
    h = BODY_H - 0.60
    nums = list(nums or [None] * len(imagenes))
    pares = [(r, nums[k]) for k, r in enumerate(imagenes) if os.path.exists(r)]
    if not pares:
        return
    W, H = IMG_W - 0.2, h - 0.2
    mejor = _reparto([r for r, _ in pares], principal, secuencia, W, H)
    for (ruta, num), (x, y, w, hh) in zip(pares, mejor):
        slide.shapes.add_picture(ruta, Cm(IMG_X + 0.1 + x), Cm(y0 + 0.1 + y),
                                 Cm(w), Cm(hh))
        if num is not None:
            _badge(slide, IMG_X + 0.1 + x - 0.16, y0 + 0.1 + y - 0.16, num)

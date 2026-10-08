# -*- coding: utf-8 -*-
"""
Generador oficial de HOJAS DE OPERACIONES para el INSERTO DE PUERTA (INSERT)
Cliente: NOVAX / VWA
Proyecto: VW427-1LA_K PATAGONIA (Amarok)
Formulario SGC oficial: I-IN-002.4-R01 (A4 apaisado 29.7 x 21.0 cm)
Alineación estricta con Flujograma 154 Rev. B y AMFE 158 (AMFE-INS-PAT).
"""
import os
import sys
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
BASE_DIR = r"c:\Dev\BarackMercosul"
IMG_DIR = os.path.join(BASE_DIR, "tmp", "insert_images")
LOGO_BARACK = r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\barack_logo.png"
EPP_DIR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\HOTMELT - AMFE de proceso del proveedor y pantalla 20.15\_trabajo\generador\epp"

ICO_ROPA     = os.path.join(EPP_DIR, "ico_13756.png")
ICO_CALZADO  = os.path.join(EPP_DIR, "ico_4449.png")
ICO_GUANTES  = os.path.join(EPP_DIR, "ico_11789.png")
ICO_ANTEOJOS = os.path.join(EPP_DIR, "ico_16034.png")
ICO_AUDITIVA = os.path.join(EPP_DIR, "ico_12924.png")

EPP_STD = [ICO_ROPA, ICO_CALZADO, ICO_GUANTES, ICO_ANTEOJOS, ICO_AUDITIVA]

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

# ─── CAJETÍN OFICIAL (I-IN-002.4-R01) ────────────────────────────────────────
C_OP, C_DEN, C_CLI, C_PUE = 3.40, 10.60, 4.20, 3.00
C_LAB, C_VAL = 2.80, 4.30
C_MOD = C_CLI + C_PUE

def cajetin(slide, d, logo=None):
    top_h = 1.60
    fila = (HDR_H - top_h) / 4

    lw, rw = 4.30, C_LAB + C_VAL
    _caja(slide, X0, HDR_Y, lw, top_h, BLANCO, borde=NEGRO, ancho=Pt(1))
    if logo and os.path.exists(logo):
        try:
            im = Image.open(logo)
            ar = im.width / im.height
            ih = min(top_h - 0.30, (lw - 0.50) / ar)
            iw = ih * ar
            slide.shapes.add_picture(logo, Cm(X0 + (lw - iw) / 2),
                                     Cm(HDR_Y + (top_h - ih) / 2), Cm(iw), Cm(ih))
        except Exception:
            pass

    _celda(slide, X0 + lw, HDR_Y, X1 - X0 - lw - rw, top_h,
           d.get("titulo_hoja", "HOJA DE OPERACIONES"), size=24, bold=True)
    _celda(slide, X1 - rw, HDR_Y, rw, top_h * 0.42,
           f"Form: {d.get('form', 'I-IN-002.4-R01')}", size=10.5, bold=True)
    _celda(slide, X1 - rw, HDR_Y + top_h * 0.42, rw, top_h * 0.58,
           d.get("ho", "HO-990"), size=20, bold=True)

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
    der = [("REALIZO:", d.get("realizo", "F. Santoro")), ("APROBO:", d.get("aprobo", "C. Baptista")),
           ("FECHA:", d.get("fecha", "08/09/2026")), ("REV.", d.get("rev", "A"))]

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

# ─── BLOQUE DE IMÁGENES MULTI-FOTO SECUENCIAL ────────────────────────────────
def bloque_imagenes(slide, imagenes, badges=None):
    _banda(slide, IMG_X, BODY_Y, IMG_W, 0.60, "IMÁGENES", size=12)
    y0 = BODY_Y + 0.60
    h = BODY_H - 0.60
    _caja(slide, IMG_X, y0, IMG_W, h, BLANCO, borde=NEGRO, ancho=Pt(1))

    imgs_ok = [i for i in imagenes if os.path.exists(i)]
    if not imgs_ok:
        _txt(_caja(slide, IMG_X, y0, IMG_W, h, relleno=GRISF, borde=None),
             "[PENDIENTE RELEVAMIENTO FOTOGRÁFICO DE PLANTA / IMAGEN EN DESARROLLO]",
             size=11, bold=True, color=AZUL_TEXTO)
        return

    n = len(imgs_ok)
    W_util, H_util = IMG_W - 0.30, h - 0.30

    if n == 1:
        ruta = imgs_ok[0]
        try:
            im = Image.open(ruta)
            ar = im.width / im.height
            iw, ih = (W_util, W_util / ar) if W_util / ar <= H_util else (H_util * ar, H_util)
            px = IMG_X + 0.15 + (W_util - iw) / 2
            py = y0 + 0.15 + (H_util - ih) / 2
            slide.shapes.add_picture(ruta, Cm(px), Cm(py), Cm(iw), Cm(ih))
        except Exception:
            pass

    elif n == 2:
        w_cada = (W_util - 0.25) / 2
        for k, ruta in enumerate(imgs_ok):
            try:
                im = Image.open(ruta)
                ar = im.width / im.height
                iw, ih = (w_cada, w_cada / ar) if w_cada / ar <= H_util else (H_util * ar, H_util)
                px = IMG_X + 0.15 + k * (w_cada + 0.25) + (w_cada - iw) / 2
                py = y0 + 0.15 + (H_util - ih) / 2
                slide.shapes.add_picture(ruta, Cm(px), Cm(py), Cm(iw), Cm(ih))

                txt_badge = (badges[k] if badges and k < len(badges) else f"Paso {k+1}")
                bw, bh = 2.40, 0.50
                bx, by = px + 0.10, py + 0.10
                _celda(slide, bx, by, bw, bh, txt_badge, relleno=AZUL, color=BLANCO, size=7.5, bold=True)
            except Exception:
                pass

    elif n in (3, 4):
        cw = (W_util - 0.20) / 2
        ch = (H_util - 0.20) / 2
        for k, ruta in enumerate(imgs_ok[:4]):
            col = k % 2
            row = k // 2
            try:
                im = Image.open(ruta)
                ar = im.width / im.height
                iw, ih = (cw, cw / ar) if cw / ar <= ch else (ch * ar, ch)
                px = IMG_X + 0.15 + col * (cw + 0.20) + (cw - iw) / 2
                py = y0 + 0.15 + row * (ch + 0.20) + (ch - ih) / 2
                slide.shapes.add_picture(ruta, Cm(px), Cm(py), Cm(iw), Cm(ih))

                txt_badge = (badges[k] if badges and k < len(badges) else f"Paso {k+1}")
                bw, bh = 2.40, 0.46
                bx, by = px + 0.08, py + 0.08
                _celda(slide, bx, by, bw, bh, txt_badge, relleno=AZUL, color=BLANCO, size=7.5, bold=True)
            except Exception:
                pass

# ─── BLOQUE DE DESCRIPCIÓN DE LA OPERACIÓN ───────────────────────────────────
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
    size = 11.0
    while size > 7.0:
        lh = 1.22 * size * PT_CM
        sep = (5 if size >= 10 else 3) * PT_CM
        alto = 0
        for t in pasos:
            alto += _lineas_wrap(t, size, util_w, False) * lh + sep
        if nota:
            sn = max(size - 1, 7.5)
            alto += (_lineas_wrap(nota, sn, DSC_W - 2 * 0.25, True) * 1.22 * sn * PT_CM + 4 * PT_CM)
        if alto <= util_h:
            break
        size -= 0.5

    for i, texto in enumerate(pasos):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(3.5 if size >= 10.0 else 2.0)
        
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

# ─── BLOQUE CICLO DE CONTROL ─────────────────────────────────────────────────
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

# ─── ELEMENTOS DE SEGURIDAD (EPP) ────────────────────────────────────────────
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
            try:
                slide.shapes.add_picture(ic, Cm(cx), Cm(y + (h - s) / 2), Cm(s), Cm(s))
            except Exception:
                pass

    yr = y + h
    for r in refs:
        _celda(slide, EPP_X, yr, EPP_W, 0.44, f"Referencia: {r}", size=7,
               align=PP_ALIGN.LEFT, margen=0.12)
        yr += 0.44

# ─── PLAN DE REACCIÓN ANTE NO CONFORME ───────────────────────────────────────
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
        "2. Dar aviso según procedimiento P-13 (Producto No Conforme) y P-14 (Acciones Correctivas).",
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

# ─── PORTADA LIMPIA CORPORATIVA ──────────────────────────────────────────────
def portada(prs, d, logo=None, foto=None, indice=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _caja(slide, X0, M, X1 - X0, H - 2 * M, BLANCO, borde=NEGRO, ancho=Pt(1.5))

    cab_h = 3.20
    _caja(slide, X0, M, X1 - X0, cab_h, BLANCO, borde=AZUL, ancho=Pt(1.5))
    _caja(slide, X0, M + cab_h - 0.08, X1 - X0, 0.08, AZUL, borde=AZUL)

    lw = 5.20
    if logo and os.path.exists(logo):
        try:
            im = Image.open(logo)
            ar = im.width / im.height
            ih = min(cab_h - 0.60, (lw - 0.80) / ar)
            iw = ih * ar
            slide.shapes.add_picture(logo, Cm(X0 + (lw - iw) / 2),
                                     Cm(M + (cab_h - ih) / 2), Cm(iw), Cm(ih))
        except Exception:
            pass

    tx = X0 + lw + 0.20
    tw = X1 - X0 - lw - 0.40
    _celda(slide, tx, M + 0.40, tw, 1.40,
           d.get("titulo", "HOJAS DE PROCESO — INSERTO DE PUERTA (INSERT)"),
           size=23, bold=True, color=AZUL, relleno=BLANCO, borde=None, align=PP_ALIGN.LEFT)
    _celda(slide, tx, M + 1.80, tw, 1.00,
           d.get("subtitulo", "Fabricación Integral · Flujograma 154 Rev. B · Proyecto VW427 Patagonia (Amarok)"),
           size=11.5, bold=False, color=AZUL2, relleno=BLANCO, borde=None, align=PP_ALIGN.LEFT)

    y_body = M + cab_h + 0.35
    fw = 13.80
    bh = H - M - y_body - 0.10
    _caja(slide, X0 + 0.10, y_body, fw, bh, BLANCO, borde=AZUL, ancho=Pt(1))
    if foto and os.path.exists(foto):
        try:
            im = Image.open(foto)
            ar = im.width / im.height
            iw, ih = (fw - 0.20, (fw - 0.20) / ar) if (fw - 0.20) / ar <= (bh - 0.20) else ((bh - 0.20) * ar, bh - 0.20)
            slide.shapes.add_picture(foto, Cm(X0 + 0.10 + (fw - iw) / 2),
                                     Cm(y_body + (bh - ih) / 2), Cm(iw), Cm(ih))
        except Exception:
            pass

    xd = X0 + fw + 0.50
    wd = X1 - xd - 0.10
    filas = [
        ("Documento SGC", d.get("ho", "HO-990")),
        ("Formulario Oficial", d.get("form", "I-IN-002.4-R01")),
        ("Flujograma Base", d.get("flujo", "154 Rev. B (08/09/2026)")),
        ("AMFE de Proceso", d.get("amfe", "AMFE-INS-PAT (158)")),
        ("Cliente / Modelo", d.get("cliente_modelo", "NOVAX / VWA  ·  PATAGONIA")),
        ("Piezas Aplicables", d.get("pieza", "N 227 y N 389 a N 403 (24 códigos)")),
        ("Realizó / Aprobó", d.get("firmas", "F. Santoro / C. Baptista")),
        ("Fecha / Revisión", d.get("fecha_rev", "08/09/2026  ·  Rev. A"))
    ]
    fh = 0.58
    for i, (k, v) in enumerate(filas):
        _celda(slide, xd, y_body + i * fh, wd * 0.38, fh, k, relleno=AZUL, color=BLANCO,
               size=8.5, align=PP_ALIGN.LEFT, margen=0.10)
        _celda(slide, xd + wd * 0.38, y_body + i * fh, wd * 0.62, fh, str(v), size=9.0,
               bold=True, align=PP_ALIGN.LEFT, margen=0.10)

    yi = y_body + len(filas) * fh + 0.18
    _banda(slide, xd, yi, wd, 0.44, "ÍNDICE DE OPERACIONES", size=9.5)
    sh = _caja(slide, xd, yi + 0.44, wd, (H - M) - (yi + 0.44) - 0.10, BLANCO, borde=NEGRO, ancho=Pt(1))
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Cm(0.18)
    tf.margin_top = Cm(0.08)

    for i, (num, nom) in enumerate(indice or []):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(1.5)
        r = p.add_run()
        r.text = f"{num}   "
        r.font.size = Pt(7.5)
        r.font.bold = True
        r.font.name = "Calibri"
        r.font.color.rgb = AZUL
        r2 = p.add_run()
        r2.text = nom
        r2.font.size = Pt(7.5)
        r2.font.name = "Calibri"
        r2.font.color.rgb = NEGRO
    return slide

def hoja(prs, d, logo=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    cajetin(slide, d, logo)
    bloque_imagenes(slide, d.get("imagenes", []), d.get("badges"))
    bloque_pasos(slide, d.get("pasos", []), d.get("nota"))
    bloque_ciclo(slide, d.get("ciclo", []))
    bloque_epp(slide, d.get("epp", EPP_STD), d.get("refs", ("OP - Operador de Producción",)))
    bloque_plan(slide, d.get("disparador", 'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME'), d.get("acciones"))
    return slide

# ─── DATOS DE LAS OPERACIONES DE INSERT (FLUJOGRAMA 154 REV. B) ─────────────
OPERACIONES = [
    {
        "op": "10",
        "denominacion": "RECEPCIÓN DE MATERIA PRIMA",
        "sector": "RECEPCIÓN / LOGÍSTICA",
        "puesto": "ALMACÉN MP",
        "pasos": [
            "Recibir los rollos de vinilo, sustratos plásticos inyectados, insumos y espumas troqueladas en el sector de recepción.",
            "Verificar el remito del proveedor contra la orden de compra y confirmar el código de material homologado.",
            "Inspeccionar el estado exterior de los bultos asegurando que no presenten roturas, golpes ni humedad.",
            "Verificar que cada rollo y caja cuente con su etiqueta identificatoria de lote y trazabilidad.",
            "Transportar y ubicar los materiales en sus posiciones asignadas del depósito de materia prima."
        ],
        "ciclo": [
            ["Identificación y trazabilidad de lote", "Visual contra remito y orden de compra", "Logística", "100% bultos", "Remito / Sistema"],
            ["Estado del embalaje y material", "Visual (sin golpes ni humedad)", "Logística", "100% bultos", "Planilla recepción"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_01_img_02_19.jpeg"),
            os.path.join(IMG_DIR, "page_01_img_03_20.jpeg")
        ],
        "badges": ["Recepción / Pallet", "Etiquetado / Almacén"]
    },
    {
        "op": "20",
        "denominacion": "PREPARACIÓN DE CORTE",
        "sector": "MESA DE CORTE",
        "puesto": "MESA DE CORTE CNC",
        "pasos": [
            "Revisar la planilla de programación de la mesa de corte para identificar el vinilo y lote correspondiente al próximo corte.",
            "Retirar el rollo indicado del depósito de materia prima y transportarlo hasta la mesa de corte.",
            "Montar el rollo de vinilo en el soporte desbobinador y verificar el centrado respecto al ancho útil.",
            "Ajustar los rodillos tensores moviéndolos en la dirección indicada y pasar el extremo del vinilo por debajo de ellos.",
            "Presionar el botón de accionamiento para alimentar y extender la primera capa de vinilo sobre la mesa."
        ],
        "ciclo": [
            ["Código de material y color de vinilo", "Visual contra planilla de corte", "OP", "100% rollos", "Planilla de corte"],
            ["Largo de capa con demasía", "Regla metálica", "OP", "1ra capa por tizada", "N/A"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_03_img_02_45.jpeg"),
            os.path.join(IMG_DIR, "page_03_img_03_46.jpeg"),
            os.path.join(IMG_DIR, "page_04_img_02_57.jpeg"),
            os.path.join(IMG_DIR, "page_04_img_03_58.jpeg")
        ],
        "badges": ["Paso 1: Transporte", "Paso 2: Montaje rollo", "Paso 3: Ajuste rodillos", "Paso 4: Alimentación"]
    },
    {
        "op": "21",
        "denominacion": "CORTE DE COMPONENTES",
        "sector": "MESA DE CORTE",
        "puesto": "MESA DE CORTE CNC",
        "pasos": [
            "Alinear las capas de vinilo asegurando que los bordes coincidan con las líneas rojas de referencia de la mesa.",
            "Medir el ancho de la cuchilla con calibre MC167 (mínimo 4 mm) y cargar el parámetro en la herramienta cutting control.",
            "Extender el film de nylon sobre el colchón de vinilo cubriendo completamente la zona de succión.",
            "Activar la turbina de vacío mediante el botón Cutting para fijar el material a la superficie.",
            "Seleccionar el archivo de corte en el software CNC, verificar el cero de máquina e iniciar el ciclo automático.",
            "Descargar los paquetes de piezas cortadas manteniendo la identificación y trazabilidad del lote."
        ],
        "ciclo": [
            ["Ancho de cuchilla (mín. 4 mm)", "Calibre paquímetro MC167", "OP", "Antes de cada corte", "Set-up cuchilla"],
            ["Alineación cabezal y succión", "Visual y manómetro de vacío", "OP", "Antes de cada corte", "N/A"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_07_img_02_83.jpeg"),
            os.path.join(IMG_DIR, "page_08_img_05_92.jpeg"),
            os.path.join(IMG_DIR, "page_09_img_03_102.jpeg"),
            os.path.join(IMG_DIR, "page_10_img_02_109.jpeg")
        ],
        "badges": ["Paso 1: Alineación", "Paso 2: Medición cuchilla", "Paso 3: Film de succión", "Paso 4: Corte CNC"]
    },
    {
        "op": "22",
        "denominacion": "CONTROL CON PLANTILLA MYLAR",
        "sector": "MESA DE CORTE",
        "puesto": "MESA DE CORTE CNC",
        "pasos": [
            "Identificar la plantilla Mylar codificada correspondiente al modelo de pieza y material a controlar.",
            "Apoyar la pieza de vinilo cortada sobre la plantilla, haciéndola coincidir con la silueta de centrado.",
            "Verificar visualmente en todo el perímetro que los bordes de la pieza queden dentro del área OK (tolerancia ±1 mm).",
            "En caso de detectar desvíos dimensionales, detener el corte, segregar el lote e informar de inmediato al Líder o Calidad.",
            "Acondicionar las piezas conformes en los medios de transporte WIP asignados hacia el sector de Costura."
        ],
        "ciclo": [
            ["Contorno perimetral (tolerancia ±1 mm)", "Plantilla Mylar codificada", "OP / CC", "Inicio turno / Cambio lote", "Planilla Mylar"],
            ["Ausencia de mordeduras o desgarros", "Visual 100%", "OP", "100% de piezas", "N/A"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_11_img_02_118.jpeg"),
            os.path.join(IMG_DIR, "page_11_img_03_119.jpeg")
        ],
        "badges": ["Paso 1: Centrado en Mylar", "Paso 2: Verificación ±1 mm"]
    },
    {
        "op": "50",
        "denominacion": "COSTURA CNC",
        "sector": "COSTURA",
        "puesto": "MÁQUINA CNC DE COSTURA",
        "pasos": [
            "Verificar el tipo y color de hilo superior e inferior según la matriz de la Ayuda Visual para el código de pieza.",
            "Posicionar los componentes de vinilo cortados sobre la plantilla de costura asegurando su correcta orientación.",
            "Seleccionar el programa correspondiente en el panel HMI de la máquina CNC.",
            "Introducir la plantilla en las guías de la máquina hasta hacer tope y trabar los dispositivos de sujeción.",
            "Accionar el pulsador bimanual para ejecutar el ciclo de costura automática.",
            "Retirar la plantilla, extraer la pieza y verificar visualmente la puntada, alineación y remates sin saltos."
        ],
        "ciclo": [
            ["Color y tipo de hilo superior / inferior", "Visual contra Ayuda Visual", "OP", "Inicio turno / Lote", "Set-up máquina"],
            ["Calidad de costura y paso de puntada", "Visual 100% (sin saltos)", "OP", "100% de piezas", "N/A"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_17_img_03_157.jpeg"),
            os.path.join(IMG_DIR, "page_18_img_03_165.jpeg"),
            os.path.join(IMG_DIR, "page_19_img_02_170.jpeg"),
            os.path.join(IMG_DIR, "page_20_img_02_177.jpeg")
        ],
        "badges": ["Paso 1: Plantilla", "Paso 2: Panel HMI CNC", "Paso 3: Ciclo costura", "Paso 4: Control puntada"]
    },
    {
        "op": "60",
        "denominacion": "TROQUELADO DE ESPUMA",
        "sector": "TROQUELADO",
        "puesto": "PRENSA TROQUELADORA",
        "pasos": [
            "Relevar la plancha de espuma de poliuretano (PUR) con el espesor y densidad especificados en la ficha técnica.",
            "Montar el troquel de conformado del inserto en la prensa y verificar su correcta fijación y estado de filo.",
            "Alimentar la plancha de espuma hasta el tope de posicionamiento en la zona de corte de la mesa.",
            "Accionar el ciclo de troquelado de la prensa mediante el mando bimanual de seguridad.",
            "Extraer la espuma troquelada y verificar visualmente la limpieza del corte en todo el contorno perimetral.",
            "Almacenar las espumas conformadas en cajas WIP protegidas del polvo y deformaciones mecánicas."
        ],
        "ciclo": [
            ["Espesor y densidad de espuma", "Calibre / FT de materia prima", "OP / CC", "Inicio de lote", "Planilla recepción"],
            ["Contorno perimetral y cortes limpios", "Visual contra patrón", "OP", "Frecuencial turno", "N/A"]
        ],
        "imagenes": [],
        "nota": "Instrucción técnica base alineada al AMFE 158. Fotos y parámetros finos a confirmar en relevamiento de planta."
    },
    {
        "op": "70",
        "denominacion": "INYECCIÓN DE PIEZAS PLÁSTICAS",
        "sector": "INYECCIÓN PLÁSTICA",
        "puesto": "INYECTORA (PROVEEDOR / PLANTA)",
        "pasos": [
            "Verificar los parámetros de inyección cargados en la máquina según la hoja de set-up del molde de inserto.",
            "Ejecutar el ciclo automático de inyección del sustrato plástico en resina ABS/PC homologada.",
            "Retirar el sustrato inyectado del molde (robot o extracción manual) verificando el desprendimiento de la colada.",
            "Desbabar manualmente restos de material en las zonas críticas de anclaje si fuera necesario.",
            "Dejar enfriar la pieza sobre el dispositivo de apoyo para evitar deformaciones térmicas por alabeo."
        ],
        "ciclo": [
            ["Parámetros de máquina (presión / temp.)", "Display / HMI inyectora", "OP / Set-up", "Inicio turno / Lote", "Hoja parámetros"],
            ["Ausencia de rechupes, ráfagas o faltas", "Visual 100%", "OP", "100% de piezas", "N/A"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_02_img_02_29.jpeg")
        ],
        "badges": ["Pieza inyectada"]
    },
    {
        "op": "71",
        "denominacion": "CONTROL DE PIEZA INYECTADA",
        "sector": "INYECCIÓN PLÁSTICA",
        "puesto": "CONTROL DE CALIDAD EN LÍNEA",
        "pasos": [
            "Tomar el sustrato inyectado ya estabilizado térmicamente.",
            "Colocar la pieza sobre el calibre de control dimensional verificando el asentamiento de los puntos de apoyo.",
            "Controlar la presencia y correcta conformación de clips, torres de fijación y pestañas perimetrales.",
            "Verificar que la cara de apoyo para el tapizado se encuentre limpia de desmoldante, aceites o rebabas.",
            "Identificar el lote conforme y colocar las piezas en contenedores WIP hacia el sector de adhesivado."
        ],
        "ciclo": [
            ["Dimensional y geometría en calibre", "Calibre de forma y posición", "CC", "Cada 2 horas", "Planilla dimensional"],
            ["Integridad de torres y trabas", "Visual 100%", "OP", "100% de piezas", "N/A"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_02_img_02_29.jpeg")
        ],
        "badges": ["Control sobre calibre"]
    },
    {
        "op": "90",
        "denominacion": "ADHESIVADO DE COMPONENTES",
        "sector": "ADHESIVADO",
        "puesto": "CELDA DE ADHESIVADO HOT MELT",
        "pasos": [
            "Verificar la temperatura de aplicación del adhesivo termofusible (SikaMelt) en la unidad fusora (140°C - 160°C).",
            "Montar el sustrato plástico en la plantilla de fijación de la cabina de adhesivado.",
            "Aplicar el adhesivo de manera homogénea sobre la superficie activa del sustrato y sobre la espuma de PUR.",
            "Asegurar la cobertura completa en bordes y radios sin generar excesos ni acumulaciones que causen relieves.",
            "Respetar el tiempo abierto del adhesivo antes de realizar el posicionado del conjunto."
        ],
        "ciclo": [
            ["Temperatura de adhesivo en fusora", "Sensor termopar / display", "OP", "Continuo / Horario", "Planilla parámetros"],
            ["Gramaje y distribución de adhesivo", "Balanza de precisión / Patrón", "CC", "Inicio turno / Lote", "Planilla de pesadas"]
        ],
        "imagenes": [],
        "nota": "Instrucción técnica base alineada al AMFE 158. Fotos y parámetros finos a confirmar en relevamiento de planta."
    },
    {
        "op": "91",
        "denominacion": "INSPECCIÓN DE PIEZA ADHESIVADA",
        "sector": "ADHESIVADO",
        "puesto": "CONTROL ADHESIVADO",
        "pasos": [
            "Inspeccionar visualmente la superficie tratada confirmando el patrón continuo de adhesivo.",
            "Verificar que no existan zonas secas sin adhesivo ni desbordes hacia nervaduras o trabas de sujeción.",
            "Controlar el pegado preliminar de la espuma sobre el sustrato asegurando que quede perfectamente centrada.",
            "Liberar el semielaborado y transferirlo en racks WIP hacia la máquina de tapizado."
        ],
        "ciclo": [
            ["Cobertura superficial de adhesivo", "Inspección visual 100%", "OP", "100% de piezas", "N/A"],
            ["Posición de espuma sobre sustrato", "Visual contra límites de borde", "OP", "100% de piezas", "N/A"]
        ],
        "imagenes": [],
        "nota": "Instrucción técnica base alineada al AMFE 158. Fotos y parámetros finos a confirmar en relevamiento de planta."
    },
    {
        "op": "93",
        "denominacion": "REPROCESO POR FALTA DE ADHESIVO",
        "sector": "ADHESIVADO",
        "puesto": "PUESTO DE RETRABAJO FUERA DE LÍNEA",
        "pasos": [
            "Segregar la pieza detectada con falta de adhesivo o adhesión insuficiente en el puesto de retrabajo autorizado.",
            "Limpiar la superficie afectada eliminando restos sueltos o contaminantes.",
            "Reactivar térmicamente la zona con pistola de calor a temperatura regulada o aplicar adhesivo complementario.",
            "Reasentar manualmente la espuma aplicando presión controlada con rodillo suave.",
            "Reinspeccionar al 100% la adherencia antes de reintegrar la pieza al flujo de tapizado."
        ],
        "ciclo": [
            ["Temperatura de reactivación térmica", "Pistola de calor con pirómetro", "OP", "100% piezas retrabajo", "Planilla retrabajo"],
            ["Adherencia firme post-retoque", "Control táctil y visual", "Calidad / Líder", "100% piezas retrabajo", "Registro de NC"]
        ],
        "imagenes": [],
        "nota": "Instrucción técnica base alineada al AMFE 158. Retrabajo autorizado según procedimiento P-13/P-14."
    },
    {
        "op": "100",
        "denominacion": "TAPIZADO SEMIAUTOMÁTICO (HOT PRESS)",
        "sector": "TAPIZADO",
        "puesto": "MÁQUINA HOT PRESS / VACÍO",
        "pasos": [
            "Verificar los parámetros de tiempo de vacío y temperatura en el display de la máquina al inicio del turno.",
            "Colocar el sustrato plástico con la espuma prearmada en la matriz superior de la máquina de tapizado.",
            "Ubicar el vinilo cosido en la matriz inferior haciendo coincidir exactamente la costura con la guía / canaleta.",
            "Confirmar visualmente que el borde de costura esté alineado de punta a punta antes de accionar el equipo.",
            "Presionar simultáneamente ambos pulsadores bimanuales hasta que se complete el ciclo de cerrado y vacío.",
            "Extraer la pieza tapizada verificando el pegado uniforme del plano central sin arrugas ni corrimientos."
        ],
        "ciclo": [
            ["Parámetros de máquina (tiempos y vacío)", "Timer y display digital", "OP", "Inicio turno / Set-up", "Hoja parámetros"],
            ["Temperatura de vinilo y sustrato", "Termómetro infrarrojo", "Calidad", "Cada 2 horas", "Planilla calidad"],
            ["Alineación de costura en canaleta", "Visual 100%", "OP", "100% de piezas", "N/A"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_12_img_02_126.jpeg"),
            os.path.join(IMG_DIR, "page_12_img_03_127.jpeg")
        ],
        "badges": ["Paso 1: Máquina Hot Press", "Paso 2: Calce de costura en canaleta"]
    },
    {
        "op": "101",
        "denominacion": "VIROLADO MANUAL (CIERRE DE BORDES)",
        "sector": "TAPIZADO",
        "puesto": "MESA DE VIROLADO MANUAL",
        "pasos": [
            "Tomar la pieza recién salida de la OP 100. Si la pieza perdió temperatura, reactivar el adhesivo con la pistola de calor.",
            "Iniciar el pegado del borde de vinilo comenzando SIEMPRE por el extremo con radio pronunciado.",
            "Avanzar progresivamente hacia los bordes rectos estirando el vinilo de manera uniforme para evitar pliegues.",
            "ADVERTENCIA: Nunca presionar con los dedos la cara vista de la pieza; manipular sosteniendo desde el dorso.",
            "Doblar el vinilo sobrante envolviendo el borde hacia la parte posterior del sustrato plástico.",
            "Fijar la posición final del vinilo en la parte trasera del sustrato utilizando la engrampadora neumática.",
            "Realizar una inspección táctil y visual completa del perímetro confirmando bordes lisos, sin arrugas ni despegues."
        ],
        "ciclo": [
            ["Bordes lisos, pegados y sin arrugas", "Visual y táctil 100%", "OP", "100% de piezas", "N/A"],
            ["Fijación con grampas en cara trasera", "Visual 100%", "OP", "100% de piezas", "N/A"],
            ["Ausencia de hundimientos en cara vista", "Visual y táctil 100%", "OP", "100% de piezas", "N/A"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_13_img_02_130.jpeg"),
            os.path.join(IMG_DIR, "page_13_img_03_131.jpeg"),
            os.path.join(IMG_DIR, "page_14_img_02_138.jpeg"),
            os.path.join(IMG_DIR, "page_15_img_02_145.jpeg")
        ],
        "badges": ["Paso 1: Pistola de calor", "Paso 2: Inicio en radio", "Paso 3: Cierre de contorno", "Paso 4: Engrampado posterior"]
    },
    {
        "op": "102",
        "denominacion": "REFILADO POST-TAPIZADO",
        "sector": "TAPIZADO",
        "puesto": "PUESTO DE REFILADO",
        "pasos": [
            "Tomar la pieza virolada y colocarla sobre el soporte de trabajo acolchado.",
            "Con un cutter provisto de hoja en perfectas condiciones, recortar el vinilo sobrante siguiendo la línea de referencia.",
            "Tener especial precaución de no cortar material funcional que deba cubrir el sustrato ni marcar la cara plástica.",
            "Cotejar periódicamente el contorno recortado contra la pieza patrón vigente disponible en el puesto.",
            "Verificar que el corte resulte limpio, continuo y libre de flecos, desgarros o rebarbas."
        ],
        "ciclo": [
            ["Contorno de refilado contra patrón", "Pieza patrón del puesto", "OP", "Inicio turno / Lote", "Planilla del puesto"],
            ["Estado del corte (sin desgarros)", "Visual 100%", "OP", "100% de piezas", "N/A"],
            ["Estado de hoja del cutter", "Inspección de filo", "OP", "Inicio de turno / Uso", "N/A"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_16_img_02_153.jpeg")
        ],
        "badges": ["Refilado contra patrón"]
    },
    {
        "op": "110",
        "denominacion": "CONTROL FINAL DE CALIDAD",
        "sector": "CALIDAD / CONTROL FINAL",
        "puesto": "MESA DE INSPECCIÓN FINAL",
        "pasos": [
            "Tomar la pieza terminada y posicionarla bajo la luminaria adecuada del puesto de inspección final.",
            "Realizar una inspección visual 100% de la cara vista verificando color, textura, brillo y ausencia de manchas o suciedad.",
            "Controlar la línea de costura verificando rectitud, regularidad del paso y ausencia de puntadas flojas o quemadas.",
            "Inspeccionar el perímetro virolado asegurando adherencia total del vinilo sin despegues, burbujas ni arrugas.",
            "Verificar en la cara posterior la presencia correcta de las grampas y que las torres de sujeción no estén dañadas.",
            "Segregar inmediatamente las piezas no conformes identificándolas con etiqueta roja y disponer las conformes para embalaje."
        ],
        "ciclo": [
            ["Aspecto general (sin manchas ni rayas)", "Visual 100% bajo luz patrón", "CC", "100% de piezas", "Planilla control final"],
            ["Adherencia perimetral y bordes", "Visual y táctil 100%", "CC", "100% de piezas", "Planilla control final"],
            ["Alineación y calidad de costura", "Visual 100%", "CC", "100% de piezas", "Planilla control final"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_21_img_05_181.jpeg")
        ],
        "badges": ["Inspección 100% visual y táctil"]
    },
    {
        "op": "120",
        "denominacion": "EMBALAJE Y ETIQUETADO",
        "sector": "EMBALAJE / EXPEDICIÓN",
        "puesto": "PUESTO DE EMBALAJE",
        "pasos": [
            "Armar la caja contenedora especificada para el modelo según la norma de embalaje GE-278.",
            "Colocar los separadores o bandejas protectoras en el interior de la caja.",
            "Acondicionar los insertos terminados de manera ordenada respetando la cantidad máxima y posición por caja.",
            "Imprimir y colocar la etiqueta de producto terminado en el lateral de la caja en el área reglamentaria.",
            "Palletizar las cajas completas sobre el pallet de madera homologado y asegurar la carga envolviendo con film stretch."
        ],
        "ciclo": [
            ["Identificación y etiqueta PT", "Lectura código de barras y visual", "OP", "100% de cajas", "Etiqueta PT"],
            ["Cantidad de piezas y protección", "Conteo y verificación GE-278", "OP", "100% de cajas", "Packing list"]
        ],
        "imagenes": [
            os.path.join(IMG_DIR, "page_22_img_06_185.jpeg"),
            os.path.join(IMG_DIR, "page_22_img_07_186.png")
        ],
        "badges": ["Paso 1: Etiquetado de caja", "Paso 2: Palletizado y film"]
    }
]

# ─── MAIN GENERATOR ──────────────────────────────────────────────────────────
def main():
    prs = Presentation()
    prs.slide_width = Cm(W)
    prs.slide_height = Cm(H)

    # Portada
    d_portada = {
        "titulo": "HOJAS DE PROCESO — INSERTO DE PUERTA (INSERT)",
        "subtitulo": "Fabricación Integral · Flujograma 154 Rev. B · Proyecto VW427 Patagonia (Amarok)",
        "ho": "HO-990",
        "form": "I-IN-002.4-R01",
        "flujo": "154 Rev. B (08/09/2026)",
        "amfe": "AMFE-INS-PAT (158)",
        "cliente_modelo": "NOVAX / VWA  ·  PATAGONIA",
        "pieza": "N 227 y N 389 a N 403 (24 códigos)",
        "firmas": "F. Santoro / C. Baptista",
        "fecha_rev": "08/09/2026  ·  Rev. A"
    }
    foto_portada = os.path.join(IMG_DIR, "page_21_img_05_181.jpeg")
    indice = [(f"OP {op['op']}", op["denominacion"]) for op in OPERACIONES]
    
    print("Generando Portada...")
    portada(prs, d_portada, logo=LOGO_BARACK, foto=foto_portada, indice=indice)

    # Hojas individuales
    comunes = {
        "titulo_hoja": "HOJA DE OPERACIONES",
        "form": "I-IN-002.4-R01",
        "ho": "HO-990",
        "modelo": "PATAGONIA",
        "cliente": "NOVAX",
        "pieza": "N 227 y N 389 a N 403 / INSERT",
        "realizo": "F. Santoro",
        "aprobo": "C. Baptista",
        "fecha": "08/09/2026",
        "rev": "A"
    }

    for op in OPERACIONES:
        print(f"Generando OP {op['op']} {op['denominacion']}...")
        d = {**comunes, **op}
        hoja(prs, d, logo=LOGO_BARACK)

    # Guardar localmente
    out_local = os.path.join(BASE_DIR, "tmp", "HO-990_INSERT_PATAGONIA_REV.A.pptx")
    prs.core_properties.author = prs.core_properties.last_modified_by = 'Facundo Santoro'; prs.core_properties.comments = ''  # sin firma de programa (Fak, 08/10/2026: scripts/_lib/firmaIA.py)
    prs.save(out_local)
    print(f"\n¡Éxito! Archivo guardado localmente en: {out_local}")

    # Guardar en servidor PPAP NOVAX si está disponible
    out_server = r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\NOVAX\Tapizadas puerta\26- Instrucciones de Proceso\INSERT\HO-990_INSERT_PATAGONIA_REV.A.pptx"
    try:
        prs.core_properties.author = prs.core_properties.last_modified_by = 'Facundo Santoro'; prs.core_properties.comments = ''  # sin firma de programa (Fak, 08/10/2026: scripts/_lib/firmaIA.py)
        prs.save(out_server)
        print(f"¡Guardado en servidor PPAP NOVAX!: {out_server}")
    except Exception as e:
        print(f"Aviso: no se pudo guardar en red: {e}")

if __name__ == '__main__':
    main()

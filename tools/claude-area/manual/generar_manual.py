#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Arma el manual de arranque de Claude en Barack: el PDF y el mismo en PowerPoint.

Lee  contenido.json  (las paginas, como datos)  +  capturas/  (las capturas de pantalla)
Deja exports/CLAUDES_POR_AREA_20261001/Manual de arranque - Claude Barack.pdf  y  .pptx

Uso:
    python generar_manual.py              arma los dos archivos
    python generar_manual.py --grilla     deja en capturas/_grilla/ cada captura con una cuadricula
                                          de 10 en 10 y las marcas actuales, para ubicar los recuadros
    python generar_manual.py --notas      ademas pone "para que esta la pagina" en las notas del PowerPoint

Sale con:
    0  salio completo
    1  falta alguna captura, o hay una captura puesta cuya marca roja todavia esta en posicion estimada
    2  contenido.json tiene algo que no entra o esta mal escrito (lo dice en pantalla)

Solo usa python-pptx y Pillow. Las medidas de la hoja estan en milimetros (A4 apaisado) y se usan
igual para el PDF y para el PowerPoint: por eso las dos salidas son la misma pagina.
"""
import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_LINE
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Mm, Pt

AQUI = Path(__file__).resolve().parent
REPO = AQUI.parents[2]
SALIDA = REPO / "exports" / "CLAUDES_POR_AREA_20261001"
DIR_FUENTES = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"

# ------------------------------------------------------------------ medidas de la hoja (mm)
HOJA_W, HOJA_H = 297.0, 210.0          # A4 apaisado
DPI = 240                              # una captura de 1920 px entra sin achicarse
PX_MM = DPI / 25.4
MM_PT = 25.4 / 72.0                    # 1 punto en mm
MARGEN = 12.0
ANCHO = HOJA_W - 2 * MARGEN            # ancho util
BANDA_H = 26.0                         # franja azul del titulo
Y0 = BANDA_H + 6.0                     # donde empieza la imagen
TEXTO_FONDO = 196.0                    # hasta donde llega el texto de abajo
CHIP_FONDO = 197.5                     # hasta donde llega la franja "a confirmar"
PIE_Y = 200.5
SEP = 6.0                              # separacion entre la captura grande y la del costado
SANGRIA = 10.0                         # lugar de la viñeta
AIRE_IMAGEN_TEXTO = 5.0
ALTO_MINIMO_IMAGEN = 90.0              # si el texto deja menos que esto para la imagen, es un error

# ------------------------------------------------------------------ letra (puntos, a tamaño real)
TITULO_PT = 38
TEXTO_PT = 22
INTERLINEA = 1.3
ENTRE_PARRAFOS = 1.6                   # mm
TEXTO_LH = TEXTO_PT * INTERLINEA * MM_PT
CHIP_PT = 11
CHIP_LH = CHIP_PT * 1.25 * MM_PT
ROTULO_PT = 16
ROTULO_H = 8.5
TARJETA_PT = 20
TABLA_PT = 16
MAX_RENGLONES = 4                      # renglones IMPRESOS de texto por pagina
MAX_PAGINAS = 14
MAX_PALABRAS_TITULO = 6

assert TEXTO_PT >= 20 and TITULO_PT >= 34, "la letra no puede ser mas chica que 20 / 34 puntos"

# ------------------------------------------------------------------ colores
BLANCO = (255, 255, 255)
AZUL_OSC = (0x1F, 0x3A, 0x5F)
AZUL = (0x2F, 0x6F, 0xB0)
CELESTE = (0xEA, 0xF2, 0xFB)
TINTA = (0x1B, 0x27, 0x33)
GRIS = (0x6B, 0x77, 0x83)
GRIS_BORDE = (0xC9, 0xD2, 0xDC)
GRIS_FONDO = (0xE9, 0xED, 0xF1)
GRIS_FALTA = (0x4F, 0x5B, 0x67)
ROJO = (0xE1, 0x25, 0x1B)
AMBAR = (0x7A, 0x52, 0x00)
AMBAR_FONDO = (0xFF, 0xF0, 0xCC)
GROSOR_MARCA = 1.5                     # mm: se tiene que ver impreso
HALO = 0.6                             # borde blanco alrededor del rojo (por si la app es oscura)


class ErrorDeContenido(Exception):
    pass


# ================================================================== texto: medir y partir
_FUENTES = {}


def fuente(pt, negrita=False):
    clave = (pt, bool(negrita))
    if clave not in _FUENTES:
        archivo = DIR_FUENTES / ("segoeuib.ttf" if negrita else "segoeui.ttf")
        _FUENTES[clave] = ImageFont.truetype(str(archivo), max(1, round(pt * DPI / 72)))
    return _FUENTES[clave]


def ancho_txt(t, pt, negrita=False):
    return fuente(pt, negrita).getlength(t) / PX_MM


def trozos(texto):
    """'Elegí **Local** ya' -> [('Elegí ', False), ('Local', True), (' ya', False)]"""
    return [(t, i % 2 == 1) for i, t in enumerate(texto.split("**")) if t]


def separar_numero(parrafo):
    """'2. Apretá...' -> (2, 'Apretá...');  'Siempre esa' -> (None, 'Siempre esa')"""
    m = re.match(r"^(\d)\.\s+(.*)$", parrafo, re.S)
    return (int(m.group(1)), m.group(2)) if m else (None, parrafo)


def partir(texto, pt, ancho_mm, negrita=False):
    """Parte un parrafo en renglones que entren en ancho_mm.
    Devuelve renglones; cada renglon es una lista de palabras; cada palabra, una lista de (texto, negrita)."""
    palabras, actual = [], []
    for t, neg in trozos(texto):
        for i, pedazo in enumerate(t.split(" ")):
            if i > 0 and actual:
                palabras.append(actual)
                actual = []
            if pedazo:
                actual.append((pedazo, neg or negrita))
    if actual:
        palabras.append(actual)
    espacio = ancho_txt(" ", pt, negrita)
    renglones, linea, usado = [], [], 0.0
    for pal in palabras:
        w = sum(ancho_txt(t, pt, n) for t, n in pal)
        if linea and usado + espacio + w > ancho_mm:
            renglones.append(linea)
            linea, usado = [], 0.0
        if linea:
            usado += espacio
        linea.append(pal)
        usado += w
    if linea:
        renglones.append(linea)
    return renglones


def ancho_renglon(renglon, pt, negrita=False):
    espacio = ancho_txt(" ", pt, negrita)
    return sum(ancho_txt(t, pt, n) for pal in renglon for t, n in pal) + espacio * (len(renglon) - 1)


def alto_parrafos(parrafos, pt, ancho_mm, negrita=False, interlinea=INTERLINEA, entre=0.0, vinetas=False):
    w = ancho_mm - (SANGRIA if vinetas else 0.0)
    n = sum(len(partir(separar_numero(p)[1] if vinetas else p, pt, w, negrita)) for p in parrafos)
    return n * pt * interlinea * MM_PT + entre * (len(parrafos) - 1), n


# ================================================================== lienzo PDF (Pillow)
class LienzoPDF:
    def __init__(self):
        self.im = Image.new("RGB", (round(HOJA_W * PX_MM), round(HOJA_H * PX_MM)), BLANCO)
        self.d = ImageDraw.Draw(self.im)

    @staticmethod
    def px(mm):
        return int(round(mm * PX_MM))

    def rect(self, x, y, w, h, relleno=None, borde=None, grosor=0.0, punteado=False):
        caja = [self.px(x), self.px(y), self.px(x + w) - 1, self.px(y + h) - 1]
        g = max(1, self.px(grosor)) if borde and grosor > 0 else 0
        if punteado and g:
            if relleno:
                self.d.rectangle(caja, fill=relleno)
            self._punteado(caja, borde, g)
        else:
            self.d.rectangle(caja, fill=relleno, outline=borde if g else None, width=max(1, g))

    def _punteado(self, caja, color, g, raya=7.0, hueco=4.0):
        x0, y0, x1, y1 = caja
        r, h = self.px(raya), self.px(hueco)
        for (ax, ay, bx, by) in ((x0, y0, x1, y0), (x0, y1, x1, y1), (x0, y0, x0, y1), (x1, y0, x1, y1)):
            largo = max(bx - ax, by - ay)
            p = 0
            while p < largo:
                q = min(p + r, largo)
                if ay == by:
                    self.d.line([ax + p, ay, ax + q, ay], fill=color, width=g)
                else:
                    self.d.line([ax, ay + p, ax, ay + q], fill=color, width=g)
                p += r + h

    def elipse(self, x, y, w, h, relleno=None, borde=None, grosor=0.0):
        g = max(1, self.px(grosor)) if borde and grosor > 0 else 0
        self.d.ellipse([self.px(x), self.px(y), self.px(x + w), self.px(y + h)],
                       fill=relleno, outline=borde if g else None, width=g)

    def texto(self, x, y, w, h, parrafos, pt, color=TINTA, negrita=False, alinear="izq",
              anclar="arriba", interlinea=INTERLINEA, entre=0.0, vinetas=False):
        sangria = SANGRIA if vinetas else 0.0
        lh = pt * interlinea * MM_PT
        bloques = []
        for par in parrafos:
            num, cuerpo = separar_numero(par) if vinetas else (None, par)
            bloques.append((num, partir(cuerpo, pt, w - sangria, negrita)))
        alto = sum(len(r) for _, r in bloques) * lh + entre * (len(bloques) - 1)
        yy = y + {"arriba": 0.0, "medio": (h - alto) / 2, "abajo": h - alto}[anclar]
        asc, desc = fuente(pt, False).getmetrics()
        espacio = ancho_txt(" ", pt, negrita)
        for num, renglones in bloques:
            if vinetas:
                self._vineta(x, yy, lh, num)
            for reng in renglones:
                libre = w - sangria - ancho_renglon(reng, pt, negrita)
                xx = x + sangria + {"izq": 0.0, "centro": libre / 2, "der": libre}[alinear]
                base = yy * PX_MM + (lh * PX_MM - (asc + desc)) / 2 + asc
                for i, pal in enumerate(reng):
                    if i:
                        xx += espacio
                    for t, neg in pal:
                        f = fuente(pt, neg)
                        self.d.text((xx * PX_MM, base), t, font=f, fill=color, anchor="ls")
                        xx += f.getlength(t) / PX_MM
                yy += lh
            yy += entre

    def _vineta(self, x, y, lh, num):
        cy = y + lh / 2 + 0.3
        if num is None:
            d = 2.8
            self.elipse(x + 2.2, cy - d / 2, d, d, relleno=AZUL)
        else:
            self.insignia(x + 3.6, cy, num, d=7.4, pt=15, halo=False)

    def insignia(self, cx, cy, num, d=9.0, pt=18, halo=True):
        if halo:
            self.elipse(cx - d / 2 - HALO, cy - d / 2 - HALO, d + 2 * HALO, d + 2 * HALO, relleno=BLANCO)
        self.elipse(cx - d / 2, cy - d / 2, d, d, relleno=ROJO)
        self.d.text((cx * PX_MM, cy * PX_MM), str(num), font=fuente(pt, True), fill=BLANCO, anchor="mm")

    def imagen(self, ruta, x, y, w, h):
        with Image.open(ruta) as im:
            if im.mode in ("RGBA", "LA", "P"):
                im = im.convert("RGBA")
                fondo = Image.new("RGB", im.size, BLANCO)
                fondo.paste(im, mask=im.split()[-1])
                im = fondo
            else:
                im = im.convert("RGB")
            im = im.resize((max(1, self.px(w)), max(1, self.px(h))), Image.LANCZOS)
        self.im.paste(im, (self.px(x), self.px(y)))

    def marco(self, x, y, w, h):
        """Recuadro rojo: el borde va POR FUERA, para no tapar lo que marca."""
        # Pillow dibuja el borde hacia ADENTRO de la caja: se agranda la caja y el borde termina justo en la marca.
        # Primero uno blanco un poco mas ancho (se ve aunque la app sea oscura), encima el rojo.
        for extra, color in ((GROSOR_MARCA + HALO, BLANCO), (GROSOR_MARCA, ROJO)):
            self.d.rectangle([self.px(x - extra), self.px(y - extra), self.px(x + w + extra), self.px(y + h + extra)],
                             outline=color, width=max(1, self.px(extra)))

    def flecha(self, x1, y1, x2, y2):
        ang = math.atan2(y2 - y1, x2 - x1)
        largo_punta, ancho_punta, grosor = 7.5, 6.5, GROSOR_MARCA + 0.3
        bx, by = x2 - largo_punta * math.cos(ang), y2 - largo_punta * math.sin(ang)
        nx, ny = -math.sin(ang), math.cos(ang)
        for extra, color in ((HALO, BLANCO), (0.0, ROJO)):
            a = ancho_punta / 2 + extra
            punta = [(x2 + extra * 1.6 * math.cos(ang), y2 + extra * 1.6 * math.sin(ang)),
                     (bx - extra * math.cos(ang) + nx * a, by - extra * math.sin(ang) + ny * a),
                     (bx - extra * math.cos(ang) - nx * a, by - extra * math.sin(ang) - ny * a)]
            self.d.line([(x1 * PX_MM, y1 * PX_MM), (bx * PX_MM, by * PX_MM)], fill=color,
                        width=self.px(grosor + 2 * extra))
            self.d.polygon([(px_ * PX_MM, py_ * PX_MM) for px_, py_ in punta], fill=color)


# ================================================================== lienzo PowerPoint (python-pptx)
def _rgb(c):
    return RGBColor(*c)


class LienzoPPT:
    def __init__(self, prs):
        self.s = prs.slides.add_slide(prs.slide_layouts[6])
        for ph in list(self.s.placeholders):
            ph._element.getparent().remove(ph._element)

    def _forma(self, tipo, x, y, w, h, relleno, borde, grosor, punteado=False):
        sh = self.s.shapes.add_shape(tipo, Mm(x), Mm(y), Mm(w), Mm(h))
        sh.shadow.inherit = False
        if relleno:
            sh.fill.solid()
            sh.fill.fore_color.rgb = _rgb(relleno)
        else:
            sh.fill.background()
        if borde and grosor > 0:
            sh.line.color.rgb = _rgb(borde)
            sh.line.width = Mm(grosor)
            if punteado:
                sh.line.dash_style = MSO_LINE.DASH
        else:
            sh.line.fill.background()
        return sh

    def rect(self, x, y, w, h, relleno=None, borde=None, grosor=0.0, punteado=False):
        return self._forma(MSO_SHAPE.RECTANGLE, x, y, w, h, relleno, borde, grosor, punteado)

    def elipse(self, x, y, w, h, relleno=None, borde=None, grosor=0.0):
        return self._forma(MSO_SHAPE.OVAL, x, y, w, h, relleno, borde, grosor)

    def texto(self, x, y, w, h, parrafos, pt, color=TINTA, negrita=False, alinear="izq",
              anclar="arriba", interlinea=INTERLINEA, entre=0.0, vinetas=False):
        tb = self.s.shapes.add_textbox(Mm(x), Mm(y), Mm(w), Mm(h))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.auto_size = MSO_AUTO_SIZE.NONE
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = {"arriba": MSO_ANCHOR.TOP, "medio": MSO_ANCHOR.MIDDLE, "abajo": MSO_ANCHOR.BOTTOM}[anclar]
        for i, par in enumerate(parrafos):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = {"izq": PP_ALIGN.LEFT, "centro": PP_ALIGN.CENTER, "der": PP_ALIGN.RIGHT}[alinear]
            p.line_spacing = Pt(pt * interlinea)
            if entre and i < len(parrafos) - 1:
                p.space_after = Pt(entre / MM_PT)
            num, cuerpo = separar_numero(par) if vinetas else (None, par)
            if vinetas:
                self._vineta(p, num)
            for t, neg in trozos(cuerpo):
                r = p.add_run()
                r.text = t
                r.font.name = "Segoe UI"
                r.font.size = Pt(pt)
                r.font.bold = bool(neg or negrita)
                r.font.color.rgb = _rgb(color)
        return tb

    @staticmethod
    def _vineta(p, num):
        pPr = p._p.get_or_add_pPr()
        pPr.set("marL", str(int(Mm(SANGRIA))))
        pPr.set("indent", str(-int(Mm(SANGRIA))))
        clr = pPr.makeelement(qn("a:buClr"), {})
        clr.append(clr.makeelement(qn("a:srgbClr"), {"val": "%02X%02X%02X" % (AZUL if num is None else ROJO)}))
        pPr.append(clr)
        pPr.append(pPr.makeelement(qn("a:buFont"), {"typeface": "Segoe UI"}))
        if num is None:
            pPr.append(pPr.makeelement(qn("a:buChar"), {"char": "\u2022"}))
        else:
            pPr.append(pPr.makeelement(qn("a:buAutoNum"), {"type": "arabicPeriod"}))

    def insignia(self, cx, cy, num, d=9.0, pt=18, halo=True):
        sh = self._forma(MSO_SHAPE.OVAL, cx - d / 2, cy - d / 2, d, d, ROJO, BLANCO if halo else None, HALO)
        tf = sh.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = str(num)
        r.font.name = "Segoe UI"
        r.font.size = Pt(pt)
        r.font.bold = True
        r.font.color.rgb = _rgb(BLANCO)

    def imagen(self, ruta, x, y, w, h):
        self.s.shapes.add_picture(str(ruta), Mm(x), Mm(y), Mm(w), Mm(h))

    def marco(self, x, y, w, h):
        g = GROSOR_MARCA
        # en PowerPoint la linea va centrada sobre el borde: se corre media linea para que quede por fuera
        self._forma(MSO_SHAPE.RECTANGLE, x - g / 2, y - g / 2, w + g, h + g, None, BLANCO, g + 2 * HALO)
        self._forma(MSO_SHAPE.RECTANGLE, x - g / 2, y - g / 2, w + g, h + g, None, ROJO, g)

    def flecha(self, x1, y1, x2, y2):
        for color, grosor in ((BLANCO, GROSOR_MARCA + 0.3 + 2 * HALO), (ROJO, GROSOR_MARCA + 0.3)):
            c = self.s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Mm(x1), Mm(y1), Mm(x2), Mm(y2))
            c.shadow.inherit = False
            c.line.color.rgb = _rgb(color)
            c.line.width = Mm(grosor)
            ln = c.line._get_or_add_ln()
            ln.append(ln.makeelement(qn("a:tailEnd"), {"type": "triangle", "w": "med", "len": "med"}))


# ================================================================== la pagina (igual para los dos lienzos)
def ruta_captura(cap, dir_capturas):
    return Path(dir_capturas) / Path(cap["archivo"]).name


def numero_captura(cap):
    return Path(cap["archivo"]).name[:2]


def encajar(iw, ih, x, y, w, h, arriba=False):
    """Mete una imagen de iw x ih adentro de la caja sin deformarla, centrada (o pegada arriba)."""
    k = min(w / iw, h / ih)
    nw, nh = iw * k, ih * k
    return x + (w - nw) / 2, (y if arriba else y + (h - nh) / 2), nw, nh


def parrafos_chip(pag):
    grupos = {"app": [], "plan": []}
    for it in pag.get("a_confirmar", []):
        grupos[it["donde"]].append(it["que"])
    out = []
    if grupos["app"]:
        out.append("**A confirmar en la app:** " + " · ".join(grupos["app"]) + ".")
    if grupos["plan"]:
        out.append("**A confirmar antes de entregar:** " + " · ".join(grupos["plan"]) + ".")
    return out


def poner_captura(l, cap, caja, dir_capturas, lugar_rotulo=False, arriba=False):
    """lugar_rotulo: deja el lugar del rotulo aunque esta captura no lo tenga (para que dos capturas
    de la misma hoja arranquen a la misma altura). arriba: pega la imagen arriba en vez de centrarla."""
    x, y, w, h = caja
    if cap.get("rotulo"):
        l.texto(x, y, w, ROTULO_H, [cap["rotulo"]], ROTULO_PT, AZUL_OSC, negrita=True, interlinea=1.15)
    if cap.get("rotulo") or lugar_rotulo:
        y, h = y + ROTULO_H, h - ROTULO_H
    ruta = ruta_captura(cap, dir_capturas)
    if not ruta.exists():
        l.rect(x, y, w, h, relleno=GRIS_FONDO, borde=GRIS, grosor=0.6, punteado=True)
        chico = w < 150
        partes = ["**FALTA LA CAPTURA %s**" % numero_captura(cap), cap["que_se_ve"], cap["archivo"]]
        pts = (20 if chico else 28, 14 if chico else 18, 11 if chico else 13)
        altos = [alto_parrafos([p], pt, w - 16, interlinea=1.25)[0] for p, pt in zip(partes, pts)]
        yy = y + (h - sum(altos) - 8) / 2
        for p, pt, a, col in zip(partes, pts, altos, (GRIS_FALTA, GRIS_FALTA, GRIS)):
            l.texto(x + 8, yy, w - 16, a, [p], pt, col, alinear="centro", interlinea=1.25)
            yy += a + 4
        return
    with Image.open(ruta) as im:
        iw, ih = im.size
    ix, iy, nw, nh = encajar(iw, ih, x, y, w, h, arriba=arriba)
    l.imagen(ruta, ix, iy, nw, nh)
    l.rect(ix, iy, nw, nh, borde=GRIS_BORDE, grosor=0.3)
    for m in cap.get("marcas", []):
        if m["tipo"] == "recuadro":
            mx, my = ix + nw * m["x"] / 100, iy + nh * m["y"] / 100
            mw, mh = nw * m["ancho"] / 100, nh * m["alto"] / 100
            l.marco(mx, my, mw, mh)
            if m.get("numero") is not None:
                l.insignia(mx - GROSOR_MARCA, my - GROSOR_MARCA, m["numero"])
        elif m["tipo"] == "flecha":
            l.flecha(ix + nw * m["desde"][0] / 100, iy + nh * m["desde"][1] / 100,
                     ix + nw * m["hasta"][0] / 100, iy + nh * m["hasta"][1] / 100)


def poner_tabla(l, tabla, caja):
    x, y, w, h = caja
    anchos = [w * f for f in (0.50, 0.27, 0.23)]
    pad = 2.2
    filas = [tabla["encabezado"]] + tabla["filas"]
    altos = []
    for i, fila in enumerate(filas):
        gruesa = i == 0 or (i - 1) == tabla.get("resaltar", -1)
        n = max(len(partir(c, TABLA_PT, a - 2 * pad, negrita=gruesa)) for c, a in zip(fila, anchos))
        altos.append(n * TABLA_PT * 1.22 * MM_PT + 2 * pad)
    yy = y + max(0.0, (h - sum(altos)) / 2)
    for i, (fila, alto) in enumerate(zip(filas, altos)):
        resaltada = (i - 1) == tabla.get("resaltar", -1)
        fondo = AZUL_OSC if i == 0 else (AMBAR_FONDO if resaltada else (BLANCO if i % 2 else CELESTE))
        xx = x
        for c, a in zip(fila, anchos):
            l.rect(xx, yy, a, alto, relleno=fondo, borde=GRIS_BORDE, grosor=0.25)
            l.texto(xx + pad, yy, a - 2 * pad, alto, [c], TABLA_PT, BLANCO if i == 0 else TINTA,
                    negrita=(i == 0 or resaltada), anclar="medio", interlinea=1.22)
            xx += a
        yy += alto


def poner_tarjetas(l, tarjetas, caja):
    x, y, w, h = caja
    cols, hueco = 4, 4.0
    filas = math.ceil(len(tarjetas) / cols)
    tw, th = (w - hueco * (cols - 1)) / cols, (h - hueco * (filas - 1)) / filas
    pad = 4.0
    for i, t in enumerate(tarjetas):
        tx, ty = x + (i % cols) * (tw + hueco), y + (i // cols) * (th + hueco)
        l.rect(tx, ty, tw, th, relleno=BLANCO, borde=GRIS_BORDE, grosor=0.3)
        l.rect(tx, ty, tw, 1.6, relleno=AZUL)
        l.texto(tx + pad, ty + 5.0, tw - 2 * pad, 7.0, [t["area"].upper()], 14, AZUL, negrita=True, interlinea=1.15)
        alto_p, _ = alto_parrafos([t["pregunta"]], TARJETA_PT, tw - 2 * pad)
        libre = th - 13.5 - 9.5
        if alto_p > libre + 0.01:
            raise ErrorDeContenido("la pregunta de la tarjeta de %s no entra: acortala" % t["area"])
        l.texto(tx + pad, ty + 13.5, tw - 2 * pad, libre, [t["pregunta"]], TARJETA_PT, TINTA)
        l.texto(tx + pad, ty + th - 9.0, tw - 2 * pad, 6.5, ["Documento: **%s**" % t["documento"]], 13, GRIS,
                interlinea=1.15)


def dibujar_pagina(l, pag, n, total, manual, dir_capturas):
    # franja del titulo, con el numero de pagina
    l.rect(0, 0, HOJA_W, BANDA_H, relleno=AZUL_OSC)
    d = 17.0
    l.elipse(MARGEN, (BANDA_H - d) / 2, d, d, relleno=BLANCO)
    l.texto(MARGEN, (BANDA_H - d) / 2, d, d, [str(n)], 28, AZUL_OSC, negrita=True, alinear="centro",
            anclar="medio", interlinea=1.0)
    l.texto(MARGEN + d + 6, 0, ANCHO - d - 6, BANDA_H, [pag["titulo"]], TITULO_PT, BLANCO, negrita=True,
            anclar="medio", interlinea=1.0)

    # de abajo hacia arriba: pie, franja "a confirmar", texto
    l.texto(MARGEN, PIE_Y, ANCHO * 0.7, 5, ["%s · %s" % (manual["pie"], manual["version"])], 10, GRIS, interlinea=1.2)
    l.texto(MARGEN + ANCHO * 0.7, PIE_Y, ANCHO * 0.3, 5, ["Página %d de %d" % (n, total)], 10, GRIS,
            alinear="der", interlinea=1.2)
    y_fin = TEXTO_FONDO
    chip = parrafos_chip(pag)
    if chip:
        alto_chip, n_chip = alto_parrafos(chip, CHIP_PT, ANCHO - 6, interlinea=1.25)
        if n_chip > 4:
            raise ErrorDeContenido("pagina %d: lo que hay 'a confirmar' ocupa mas de 4 renglones: acortalo" % pag["numero"])
        alto_chip += 3.0
        l.rect(MARGEN, CHIP_FONDO - alto_chip, ANCHO, alto_chip, relleno=AMBAR_FONDO)
        l.rect(MARGEN, CHIP_FONDO - alto_chip, 1.2, alto_chip, relleno=AMBAR)
        l.texto(MARGEN + 4, CHIP_FONDO - alto_chip + 1.5, ANCHO - 6, alto_chip - 3, chip, CHIP_PT, AMBAR, interlinea=1.25)
        y_fin = CHIP_FONDO - alto_chip - 4.5
    alto_texto, n_reng = alto_parrafos(pag["texto"], TEXTO_PT, ANCHO, entre=ENTRE_PARRAFOS, vinetas=True)
    if n_reng > MAX_RENGLONES:
        raise ErrorDeContenido("pagina %d (%s): el texto ocupa %d renglones impresos y el maximo es %d: acortalo"
                               % (pag["numero"], pag["titulo"], n_reng, MAX_RENGLONES))
    y_texto = y_fin - alto_texto
    l.texto(MARGEN, y_texto, ANCHO, alto_texto + 1.0, pag["texto"], TEXTO_PT, TINTA, entre=ENTRE_PARRAFOS, vinetas=True)

    # la imagen: todo lo que queda
    area = (MARGEN, Y0, ANCHO, y_texto - AIRE_IMAGEN_TEXTO - Y0)
    if area[3] < ALTO_MINIMO_IMAGEN:
        raise ErrorDeContenido("pagina %d: a la imagen le quedan %.0f mm de alto (minimo %.0f): hay demasiado texto"
                               % (pag["numero"], area[3], ALTO_MINIMO_IMAGEN))
    if pag.get("tarjetas"):
        poner_tarjetas(l, pag["tarjetas"], area)
        return
    caps = [c for c in pag.get("capturas", [])
            if ruta_captura(c, dir_capturas).exists() or not c.get("opcional")]
    x, y, w, h = area
    if pag.get("tabla"):
        w1 = (w - SEP) * 0.56
        poner_captura(l, caps[0], (x, y, w1, h), dir_capturas)
        poner_tabla(l, pag["tabla"], (x + w1 + SEP, y, w - SEP - w1, h))
    elif len(caps) == 2:
        w1 = (w - SEP) * 0.60
        rot = any(c.get("rotulo") for c in caps)
        poner_captura(l, caps[0], (x, y, w1, h), dir_capturas, lugar_rotulo=rot, arriba=True)
        poner_captura(l, caps[1], (x + w1 + SEP, y, w - SEP - w1, h), dir_capturas, lugar_rotulo=rot, arriba=True)
    else:
        poner_captura(l, caps[0], area, dir_capturas)


# ================================================================== leer y controlar contenido.json
def reemplazar(obj, variables):
    if isinstance(obj, str):
        for k, v in variables.items():
            obj = obj.replace("{%s}" % k, v)
        return obj
    if isinstance(obj, list):
        return [reemplazar(o, variables) for o in obj]
    if isinstance(obj, dict):
        return {k: reemplazar(v, variables) for k, v in obj.items()}
    return obj


def cargar(ruta):
    datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
    datos["paginas"] = reemplazar(datos["paginas"], datos.get("variables", {}))
    return datos


def controlar(datos):
    """Lo que se puede controlar sin dibujar. Devuelve la lista de errores (vacia = bien)."""
    errores = []
    activas = [p for p in datos["paginas"] if p.get("activa", True)]
    if not activas:
        errores.append("no hay ninguna pagina activa")
    if len(activas) > MAX_PAGINAS:
        errores.append("hay %d paginas y el maximo es %d" % (len(activas), MAX_PAGINAS))
    vistos = set()
    for p in datos["paginas"]:
        donde = "pagina %s (%s)" % (p.get("numero"), p.get("titulo"))
        titulo = p.get("titulo", "")
        if not titulo or len(titulo.split()) > MAX_PALABRAS_TITULO:
            errores.append("%s: el titulo tiene que tener de 1 a %d palabras" % (donde, MAX_PALABRAS_TITULO))
        elif ancho_txt(titulo, TITULO_PT, True) > ANCHO - 23:
            errores.append("%s: el titulo no entra en un renglon" % donde)
        texto = p.get("texto", [])
        if not 2 <= len(texto) <= 4:
            errores.append("%s: el texto tiene que tener de 2 a 4 renglones (tiene %d)" % (donde, len(texto)))
        numeros = [separar_numero(t)[0] for t in texto if separar_numero(t)[0] is not None]
        if numeros != list(range(1, len(numeros) + 1)):
            errores.append("%s: los renglones numerados tienen que ir 1, 2, 3 seguidos" % donde)
        for t in texto + [c.get("que_se_ve", "") for c in p.get("capturas", [])]:
            if t.count("**") % 2:
                errores.append("%s: hay un ** sin cerrar en: %s" % (donde, t))
            if "{" in t or "}" in t:
                errores.append("%s: quedo una llave sin reemplazar en: %s" % (donde, t))
        caps = p.get("capturas", [])
        if not p.get("tarjetas") and not 1 <= len(caps) <= 2:
            errores.append("%s: tiene que tener 1 o 2 capturas (o tarjetas)" % donde)
        if p.get("tabla") and len(caps) != 1:
            errores.append("%s: una pagina con tabla lleva una sola captura" % donde)
        if caps and caps[0].get("opcional"):
            errores.append("%s: la captura grande no puede ser opcional" % donde)
        for c in caps:
            arch = c.get("archivo", "")
            if not re.fullmatch(r"capturas/\d\d-[a-z0-9-]+\.png", arch):
                errores.append("%s: el archivo '%s' no tiene la forma capturas/NN-nombre.png" % (donde, arch))
            if arch in vistos:
                errores.append("%s: la captura '%s' esta repetida" % (donde, arch))
            vistos.add(arch)
            if not c.get("que_se_ve"):
                errores.append("%s: a la captura '%s' le falta 'que_se_ve'" % (donde, arch))
            for m in c.get("marcas", []):
                if m.get("tipo") == "recuadro":
                    vals = [m.get("x"), m.get("y"), m.get("ancho"), m.get("alto")]
                    bien = all(isinstance(v, (int, float)) for v in vals) and m["ancho"] > 0 and m["alto"] > 0 \
                        and 0 <= m["x"] and 0 <= m["y"] and m["x"] + m["ancho"] <= 100 and m["y"] + m["alto"] <= 100
                elif m.get("tipo") == "flecha":
                    pts = list(m.get("desde", [])) + list(m.get("hasta", []))
                    bien = len(pts) == 4 and all(isinstance(v, (int, float)) and 0 <= v <= 100 for v in pts)
                else:
                    bien = False
                if not bien:
                    errores.append("%s: una marca de '%s' esta mal (recuadro o flecha, en porcentajes de 0 a 100): %s"
                                   % (donde, arch, json.dumps(m, ensure_ascii=False)))
        for it in p.get("a_confirmar", []):
            if it.get("donde") not in ("app", "plan") or not it.get("que"):
                errores.append("%s: cada 'a_confirmar' lleva donde ('app' o 'plan') y que" % donde)
    return errores


def revisar_capturas(datos, dir_capturas):
    """Que capturas faltan y que marcas siguen en posicion estimada."""
    faltan, opcionales, estimadas = [], [], []
    n = 0
    for p in datos["paginas"]:
        if not p.get("activa", True):
            continue
        n += 1
        for c in p.get("capturas", []):
            existe = ruta_captura(c, dir_capturas).exists()
            fila = (numero_captura(c), c["archivo"], n, c["que_se_ve"])
            if not existe:
                (opcionales if c.get("opcional") else faltan).append(fila)
            elif any(not m.get("posicion_confirmada") for m in c.get("marcas", [])):
                estimadas.append(fila)
    return faltan, opcionales, estimadas


# ================================================================== armar
def armar_pdf(datos, dir_capturas):
    activas = [p for p in datos["paginas"] if p.get("activa", True)]
    hojas = []
    for n, pag in enumerate(activas, 1):
        l = LienzoPDF()
        dibujar_pagina(l, pag, n, len(activas), datos["manual"], dir_capturas)
        hojas.append(l.im)
    return hojas


def armar_pptx(datos, dir_capturas, con_notas=False):
    activas = [p for p in datos["paginas"] if p.get("activa", True)]
    prs = Presentation()
    prs.slide_width, prs.slide_height = Mm(HOJA_W), Mm(HOJA_H)
    cp = prs.core_properties
    cp.title = datos["manual"]["archivo"]
    cp.author = cp.last_modified_by = "Ingeniería - Barack Mercosul"
    cp.subject = cp.keywords = cp.comments = ""
    for n, pag in enumerate(activas, 1):
        l = LienzoPPT(prs)
        dibujar_pagina(l, pag, n, len(activas), datos["manual"], dir_capturas)
        if con_notas and pag.get("error_que_evita"):
            l.s.notes_slide.notes_text_frame.text = "Para qué está esta página: evita " + \
                pag["error_que_evita"][0].lower() + pag["error_que_evita"][1:]
    return prs


def guardar(hojas, prs, dir_salida, nombre):
    dir_salida.mkdir(parents=True, exist_ok=True)
    pdf, pptx = dir_salida / (nombre + ".pdf"), dir_salida / (nombre + ".pptx")
    try:
        hojas[0].save(pdf, "PDF", save_all=True, append_images=hojas[1:], resolution=DPI, quality=95,
                      subsampling=0, title=nombre, author="Ingeniería - Barack Mercosul")
        prs.save(str(pptx))
    except PermissionError as e:
        cual = Path(e.filename).name if e.filename else nombre
        raise ErrorDeContenido("no pude guardar '%s': cerralo si esta abierto y volve a correr" % cual)
    return pdf, pptx


def hacer_grilla(datos, dir_capturas):
    """Cada captura con una cuadricula de 10 en 10 y sus marcas actuales, para leer la posicion real."""
    destino = Path(dir_capturas) / "_grilla"
    destino.mkdir(exist_ok=True)
    hechas = []
    for p in datos["paginas"]:
        for c in p.get("capturas", []):
            ruta = ruta_captura(c, dir_capturas)
            if not ruta.exists():
                continue
            im = Image.open(ruta).convert("RGB")
            w, h = im.size
            d = ImageDraw.Draw(im, "RGBA")
            f = ImageFont.truetype(str(DIR_FUENTES / "segoeuib.ttf"), max(14, w // 80))
            for k in range(0, 101, 5):
                fuerte = k % 10 == 0
                col = (0, 120, 255, 200 if fuerte else 90)
                d.line([(w * k / 100, 0), (w * k / 100, h)], fill=col, width=2 if fuerte else 1)
                d.line([(0, h * k / 100), (w, h * k / 100)], fill=col, width=2 if fuerte else 1)
                if fuerte and k < 100:
                    for pos in ((w * k / 100 + 4, 2), (2, h * k / 100 + 2)):
                        caja = d.textbbox(pos, str(k), font=f)
                        d.rectangle(caja, fill=(255, 255, 255, 220))
                        d.text(pos, str(k), font=f, fill=(0, 70, 200, 255))
            for m in c.get("marcas", []):
                if m["tipo"] == "recuadro":
                    d.rectangle([w * m["x"] / 100, h * m["y"] / 100, w * (m["x"] + m["ancho"]) / 100,
                                 h * (m["y"] + m["alto"]) / 100], outline=ROJO + (255,), width=max(4, w // 300))
                else:
                    d.line([(w * m["desde"][0] / 100, h * m["desde"][1] / 100),
                            (w * m["hasta"][0] / 100, h * m["hasta"][1] / 100)], fill=ROJO + (255,), width=max(4, w // 300))
            im.save(destino / ruta.name)
            hechas.append(ruta.name)
    return destino, hechas


def main(argv=None):
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="Arma el manual de arranque de Claude en Barack (PDF y PowerPoint).")
    ap.add_argument("--contenido", default=str(AQUI / "contenido.json"), help="otro contenido.json (para pruebas)")
    ap.add_argument("--capturas", default=str(AQUI / "capturas"), help="otra carpeta de capturas (para pruebas)")
    ap.add_argument("--salida", default=str(SALIDA), help="otra carpeta de salida (para pruebas)")
    ap.add_argument("--grilla", action="store_true", help="solo deja las capturas con cuadricula en capturas/_grilla/")
    ap.add_argument("--notas", action="store_true", help="pone 'para que esta la pagina' en las notas del PowerPoint")
    a = ap.parse_args(argv)

    try:
        datos = cargar(a.contenido)
    except (OSError, ValueError, KeyError) as e:
        print("ERROR: no pude leer %s: %s" % (a.contenido, e))
        return 2
    errores = controlar(datos)
    if errores:
        print("ERROR: contenido.json tiene %d cosa(s) para corregir:" % len(errores))
        for e in errores:
            print("  - " + e)
        return 2

    if a.grilla:
        destino, hechas = hacer_grilla(datos, a.capturas)
        print("Cuadricula hecha para %d captura(s) en %s" % (len(hechas), destino))
        for h in hechas:
            print("  " + h)
        if not hechas:
            print("  (todavia no hay ninguna captura en la carpeta)")
        return 0

    try:
        hojas = armar_pdf(datos, a.capturas)
        prs = armar_pptx(datos, a.capturas, con_notas=a.notas)
        pdf, pptx = guardar(hojas, prs, Path(a.salida), datos["manual"]["archivo"])
    except ErrorDeContenido as e:
        print("ERROR: %s" % e)
        return 2

    faltan, opcionales, estimadas = revisar_capturas(datos, a.capturas)
    print("Manual armado: %d paginas" % len(hojas))
    print("  PDF : %s" % pdf)
    print("  PPTX: %s" % pptx)
    pendientes = [(p["numero"], it) for p in datos["paginas"] if p.get("activa", True) for it in p.get("a_confirmar", [])]
    if pendientes or datos.get("a_confirmar_general"):
        print("\nA CONFIRMAR (sale impreso en la franja ambar de cada pagina hasta que se borre de contenido.json):")
        for num, it in pendientes:
            print("  pag. %2d  [%s]  %s" % (num, "en la app" if it["donde"] == "app" else "antes de entregar", it["que"]))
        for g in datos.get("a_confirmar_general", []):
            print("  general  %s" % g)
    if opcionales:
        print("\nCAPTURAS OPCIONALES QUE NO ESTAN (la pagina sale sin ellas):")
        for num, arch, pag, que in opcionales:
            print("  %s  %s  (pag. %d)  %s" % (num, arch, pag, que))
    if estimadas:
        print("\nCAPTURAS PUESTAS CON LA MARCA ROJA TODAVIA EN POSICION ESTIMADA (%d):" % len(estimadas))
        for num, arch, pag, _ in estimadas:
            print("  %s  %s  (pag. %d)" % (num, arch, pag))
        print("  -> python generar_manual.py --grilla, leer la posicion real en capturas/_grilla/, corregirla en")
        print("     contenido.json y poner \"posicion_confirmada\": true")
    if faltan:
        print("\nFALTAN %d CAPTURAS (el manual salio con un cartel gris en su lugar):" % len(faltan))
        for num, arch, pag, que in sorted(faltan):
            print("  %s  %s  (pag. %d)  %s" % (num, arch, pag, que))
    if faltan or estimadas:
        print("\nEL MANUAL NO ESTA TERMINADO: no entregarlo asi.")
        return 1
    print("\nManual completo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

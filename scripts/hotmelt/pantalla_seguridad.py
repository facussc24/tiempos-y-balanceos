# -*- coding: utf-8 -*-
"""Pantalla de SEÑALES DE SEGURIDAD del HMI (IO INPUT1) — la FOTO REAL, enderezada, con los
rotulos en castellano puestos encima.

Fak, 08/09/2026: la pantalla NO se dibuja de nuevo. Va la foto de la pantalla real, se le
corrige la perspectiva y se le pone encima el dato que uno quiere que se lea. Un dibujo en
castellano que no se parece a lo que el operario tiene adelante no le sirve para
encontrarla entre menus en chino.

Fotograma: IMG_0387, cuadro 105 (26/08/2026). El panel estaba colgado de la manija, girado
90°, asi que primero se rota y despues se rectifica con los cuatro vertices del LCD.

**Nada tapa la pantalla.** Las cuatro filas que la hoja 20.15 manda mirar se marcan con una
banda ambar transparente y un numero; el nombre en castellano y la direccion (%I0.0) van en
la banda BLANCA de la derecha, que esta fuera del LCD. Asi el operario ve la pantalla tal
cual la tiene adelante —en chino— y al lado que significa cada fila marcada.

Las alturas de las cuatro filas estan MEDIDAS sobre el LCD ya enderezado (`--ver` deja
`_lcd_enderezado.png` para volver a medirlas), no puestas a ojo.

    py -3 pantalla_seguridad.py [--ver]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

import metrica_pantalla as MP

FRAMES = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
          r"\Hojas de proceso maquina HOTMELT - desde los videos\frames")
ORIGEN = os.path.join(FRAMES, "0387", "0387_0105.jpg")

AZUL   = (31, 84, 168)
AMBAR  = (214, 140, 0)
ROJO   = (176, 32, 32)
TXT    = (20, 24, 32)
BLANCO = (255, 255, 255)
GRISTX = (108, 116, 130)

# vertices del LCD en la foto YA ROTADA 90° (1920 x 1080), en orden TL, TR, BR, BL
VERTICES = [(392, 292), (1370, 258), (1428, 905), (440, 938)]
LCD_W, LCD_H = 1400, 900
BANDA = 380                      # la columna blanca de la derecha, FUERA de la pantalla
CAB, PIE = 96, 54
W, H = LCD_W + BANDA, LCD_H + CAB + PIE

# Las cuatro señales de la hoja 20.15: numero, centro y ALTO de la fila dentro del LCD
# enderezado (900 px), y como se llama en castellano.
#
# El centro y el alto van fila por fila y estan MEDIDOS sobre `_lcd_enderezado.png`, no
# calculados con un paso fijo: la foto conserva algo de distorsion y el rotulo chino y su
# casilla no quedan a la misma altura (en la fila 1 se llevan 18 px). Con un alto unico la
# banda le cortaba el borde de arriba a las casillas %I0.0, %I0.6 y %I1.1.
FILAS = [
    (1, 227, 58, ["PARO DE EMERGENCIA"], "%I0.0"),
    (2, 287, 50, ["PUERTA DE SEGURIDAD"], "%I0.1"),
    (3, 543, 60, ["PARO DE EMERGENCIA", "DEL DESBOBINADOR"], "%I0.6"),
    (4, 695, 52, ["PARO DE EMERGENCIA", "DEL ENROLLADOR"], "%I1.1"),
]
FILA_X0, FILA_X1 = 58, 482       # la primera columna: rotulo chino + casilla del valor
BADGE_X, BADGE_R = 285, 22       # hueco vacio entre el rotulo y la casilla, en las 4 filas

CUERPO = 28                      # el texto mas chico del dibujo: 7,2 pt impreso a 16,2 cm


def _f(px, bold=False):
    for n in (("calibrib.ttf", "arialbd.ttf") if bold else ("calibri.ttf", "arial.ttf")):
        p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def _texto(d, xy, texto, px, bold=False, fill=TXT, tope=None, avisos=None):
    """Escribe y AVISA si se sale del ancho que tiene. Un texto recortado en el borde no se
    ve mirando la imagen entera: se ve midiendolo."""
    if tope is not None:
        sobra = d.textlength(texto, font=_f(px, bold)) - tope
        if sobra > 0 and avisos is not None:
            avisos.append("se pasa %.0f px: %r" % (sobra, texto))
    d.text(xy, texto, font=_f(px, bold), fill=fill)


def _coef_perspectiva(destino, origen):
    """Coeficientes para Image.PERSPECTIVE: mapean el DESTINO al ORIGEN."""
    import numpy as np
    A, B = [], []
    for (xd, yd), (xo, yo) in zip(destino, origen):
        A.append([xd, yd, 1, 0, 0, 0, -xo * xd, -xo * yd])
        A.append([0, 0, 0, xd, yd, 1, -yo * xd, -yo * yd])
        B += [xo, yo]
    return np.linalg.solve(np.array(A, dtype=float), np.array(B, dtype=float))


def enderezar():
    im = Image.open(ORIGEN).rotate(90, expand=True)
    dest = [(0, 0), (LCD_W, 0), (LCD_W, LCD_H), (0, LCD_H)]
    return im.transform((LCD_W, LCD_H), Image.PERSPECTIVE,
                        _coef_perspectiva(dest, VERTICES), Image.BICUBIC)


def _marcas(d, avisos):
    """Sobre el LCD: banda ambar transparente y el numero, en las cuatro filas."""
    for n, centro, alto, _, _ in FILAS:
        y = CAB + centro
        d.rectangle([FILA_X0, y - alto // 2, FILA_X1, y + alto // 2],
                    fill=(255, 176, 0, 62), outline=AMBAR, width=3)
        d.ellipse([BADGE_X - BADGE_R, y - BADGE_R, BADGE_X + BADGE_R, y + BADGE_R],
                  fill=AMBAR, outline=BLANCO, width=3)
        t = str(n)
        w = d.textlength(t, font=_f(30, True))
        _texto(d, (BADGE_X - w / 2, y - 20), t, 30, True, BLANCO, avisos=avisos)


def _banda(d, avisos):
    """A la derecha del LCD: que es cada numero, y que hacer con lo que muestre."""
    xb = LCD_W + 22
    xt = xb + 52
    tope = W - 18 - xt

    _texto(d, (xb, CAB + 4), "QUÉ SE MIRA", 32, True, AZUL, avisos=avisos)

    y = CAB + 52
    for n, _, _, lineas, addr in FILAS:
        d.ellipse([xb, y, xb + 40, y + 40], fill=AMBAR, outline=BLANCO, width=2)
        w = d.textlength(str(n), font=_f(28, True))
        _texto(d, (xb + 20 - w / 2, y + 4), str(n), 28, True, BLANCO, avisos=avisos)
        for k, ln in enumerate(lineas):
            _texto(d, (xt, y + 2 + k * 32), ln, CUERPO, True, TXT, tope, avisos)
        _texto(d, (xt, y + 2 + len(lineas) * 32), addr, CUERPO, False, GRISTX, tope, avisos)
        y += 96

    d.rectangle([xb - 6, CAB + 456, W - 16, CAB + 618], outline=AMBAR, width=4)
    _texto(d, (xb + 6, CAB + 468), "LAS CUATRO EN 1", 30, True, AMBAR, avisos=avisos)
    for k, ln in enumerate(["Con la máquina lista", "para operar, las cuatro",
                            "estaban en 1."]):
        _texto(d, (xb + 6, CAB + 510 + k * 34), ln, CUERPO, False, TXT, tope + 46, avisos)

    _texto(d, (xb, CAB + 648), "SI ALGUNA DA 0", 30, True, ROJO, avisos=avisos)
    for k, ln in enumerate(["No arrancar: hay un paro", "sin rearmar o la puerta",
                            "abierta."]):
        _texto(d, (xb, CAB + 688 + k * 34), ln, CUERPO, False, TXT, tope + 52, avisos)

    for k, ln in enumerate(["El resto de la pantalla no", "se controla en esta hoja."]):
        _texto(d, (xb, CAB + 812 + k * 34), ln, CUERPO, False, GRISTX, tope + 52, avisos)


def anotar(lcd):
    im = Image.new("RGB", (W, H), BLANCO)
    im.paste(lcd, (0, CAB))
    d = ImageDraw.Draw(im, "RGBA")
    avisos = []

    d.rectangle([0, 0, W, 90], fill=AZUL)
    _texto(d, (24, 22), "PANTALLA DE SEÑALES DE SEGURIDAD  —  HMI de la máquina",
           40, True, BLANCO, W - 48, avisos)

    _marcas(d, avisos)
    _banda(d, avisos)

    _texto(d, (16, H - 42),
           "IMG_0387 · fotograma 105 · 26/08/2026 — foto real de la pantalla, enderezada.  "
           "Ningún valor fue modificado.", CUERPO, False, GRISTX, W - 32, avisos)
    return im, avisos


if __name__ == "__main__":
    salida, avisos = anotar(enderezar())
    print(*MP.guardar(salida, "_pantalla_seguridad.png", cuerpo_px=CUERPO,
                      que_es="señales de seguridad del HMI"))
    print("cuerpo mas chico: %d px  ->  %.1f pt impreso a 16,2 cm"
          % (CUERPO, CUERPO / float(W) * 16.2 / 0.0353))
    for a in avisos:
        print("  AVISO  " + a)
    if not avisos:
        print("  ningun texto se sale de su ancho")
    if "--ver" in sys.argv:
        enderezar().save("_lcd_enderezado.png")
        print("_lcd_enderezado.png")

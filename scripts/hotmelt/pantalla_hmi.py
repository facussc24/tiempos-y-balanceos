# -*- coding: utf-8 -*-
"""Redibuja la pantalla del HMI tal cual es, pero limpia y en castellano.

🔴 CRITERIO DEROGADO POR FAK EL 08/09/2026. Esta pantalla esta REDIBUJADA, y ya
no se hace asi: va la FOTO REAL enderezada con el rotulo en castellano encima, sin
tapar ningun valor ("poner la foto de la pantalla real y metele un edit y ponele
encima el dato que vos queres"). El operario tiene adelante la pantalla en chino.
Hay que REHACER esta pantalla con el criterio nuevo — modelo: pantalla_seguridad.py,
regla .claude/rules/hojas-proceso.md §3. Lo de abajo queda como historia.


Es lo que hacen los manuales de maquina: la pantalla se REDIBUJA, no se fotografia.
Queda prolija impresa, el operario reconoce el layout cuando la ve en la maquina, y
—a diferencia de una foto "mejorada" con IA— cada numero es el que dice la pantalla
de verdad, no uno inventado por un modelo.

Valores leidos en IMG_9527, fotograma 5560 (28/08/2026 12:33).
"""
from PIL import Image, ImageDraw, ImageFont

import metrica_pantalla as MP
import os

W, H = 1700, 980
FONDO   = (214, 219, 233)     # gris azulado del SIMATIC
PANEL   = (232, 235, 243)
CAJA    = (252, 252, 253)
BORDE   = (150, 158, 175)
TITULO  = (60, 72, 96)
TXT     = (28, 32, 40)
AZUL    = (31, 84, 168)
NARANJA = (214, 96, 34)


def _f(px, bold=False):
    for n in (("calibrib.ttf", "arialbd.ttf") if bold else ("calibri.ttf", "arial.ttf")):
        p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def centro(d, txt, x, y, an, ft, fill):
    d.text((x + an / 2 - d.textlength(txt, font=ft) / 2, y), txt, font=ft, fill=fill)


def campo(d, x, y, an, al, valor, ft, color=TXT):
    d.rounded_rectangle([x, y, x + an, y + al], 4, fill=CAJA, outline=BORDE, width=2)
    centro(d, valor, x, y + al / 2 - ft.size * 0.62, an, ft, color)


def columna(d, x, y, an, titulo, actual, filas):
    """Una columna de rodillo: titulo, valor vivo y sus 5 parametros."""
    d.rounded_rectangle([x, y, x + an, y + 640], 8, fill=PANEL, outline=BORDE, width=2)
    centro(d, titulo, x, y + 16, an, _f(30, True), TITULO)
    # valor vivo, arriba a la izquierda, como en la pantalla real
    d.rounded_rectangle([x + 18, y + 62, x + 200, y + 116], 4, fill=(255, 255, 255), outline=NARANJA, width=3)
    centro(d, actual, x + 18, y + 74, 182, _f(32, True), NARANJA)
    d.text((x + 210, y + 78), "valor actual", font=_f(22), fill=(110, 118, 132))
    yy = y + 140
    for rot, val, resaltar in filas:
        d.text((x + 20, yy + 14), rot, font=_f(25), fill=TXT)
        campo(d, x + an - 230, yy, 150, 52, val, _f(30, True) if resaltar else _f(28),
              AZUL if resaltar else TXT)
        d.text((x + an - 70, yy + 14), "°C", font=_f(25), fill=TXT)
        yy += 84


im = Image.new("RGB", (W, H), FONDO)
d = ImageDraw.Draw(im)

# ── barra de titulo
d.rounded_rectangle([24, 20, W - 24, 92], 8, fill=(196, 203, 220), outline=BORDE, width=2)
d.rounded_rectangle([38, 30, 260, 82], 4, fill=CAJA, outline=BORDE, width=2)
d.text((52, 38), "28/08/2026", font=_f(24), fill=TXT)
d.text((52, 58), "12:33", font=_f(22), fill=(110, 118, 132))
centro(d, "AJUSTE DE PARÁMETROS: TEMPERATURA", 260, 40, W - 300, _f(36, True), TITULO)

FILAS = [("Temperatura de consigna",        "185,0", True),
         ("Temperatura de protección",      "150,0", True),
         ("Desviación de alarma superior",  "+10,0", False),
         ("Desviación de alarma inferior",  "−10,0", False),
         ("Alarma por sobretemperatura",    "220,0", True)]

columna(d, 24, 110, 640, "RODILLO DE ENCOLADO", "185,0", FILAS)
columna(d, 690, 110, 640, "RODILLO DOSIFICADOR", "184,9", FILAS)

# ── caja de la derecha: enfriamiento y espera
x, y, an = 1356, 110, 320
d.rounded_rectangle([x, y, x + an, y + 640], 8, fill=PANEL, outline=BORDE, width=2)
centro(d, "RODILLO DE COLA", x, y + 16, an, _f(28, True), TITULO)
for k, (rot, val) in enumerate([("Temperatura de\nenfriamiento", "100,0"),
                                ("Temperatura de\nespera", "150,0")]):
    yy = y + 80 + k * 220
    d.multiline_text((x + 24, yy), rot, font=_f(25), fill=TXT, spacing=6)
    campo(d, x + 60, yy + 76, 150, 52, val, _f(30, True), AZUL)
    d.text((x + 224, yy + 90), "°C", font=_f(25), fill=TXT)

# ── pie: de donde salio
d.text((28, H - 44), "Pantalla del HMI de la laminadora, redibujada.  Valores leídos el "
       "28/08/2026 12:33 — video IMG_9527, fotograma 5560.", font=_f(23), fill=(110, 118, 132))

print(*MP.guardar(im, "_pantalla_rodillos.png", cuerpo_px=30,
                 que_es="parametros de temperatura de los rodillos"))

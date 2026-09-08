# -*- coding: utf-8 -*-
"""Pantalla de PARAMETROS de la 20.4, redibujada en castellano.

🔴 CRITERIO DEROGADO POR FAK EL 08/09/2026. Esta pantalla esta REDIBUJADA, y ya
no se hace asi: va la FOTO REAL enderezada con el rotulo en castellano encima, sin
tapar ningun valor ("poner la foto de la pantalla real y metele un edit y ponele
encima el dato que vos queres"). El operario tiene adelante la pantalla en chino.
Hay que REHACER esta pantalla con el criterio nuevo — modelo: pantalla_seguridad.py,
regla .claude/rules/hojas-proceso.md §3. Lo de abajo queda como historia.


Reemplaza a las dos que habia (`_pantalla_receta.png` y `_pantalla_rodillos.png`).

Por que se fusionaron (03/09/2026): eran dos imagenes compartiendo el bloque de la hoja, y
ninguna de las dos llegaba a la mitad del cuerpo minimo legible —4,3 y 3,8 pt contra 7—.
Dos pantallas en un bloque de 16 x 9,3 cm no entran legibles: es aritmetica, no gusto. Una
sola, a ancho completo y con los campos que los 10 pasos de la hoja nombran, da 8,3 pt.

Lo que muestra es un RECORTE de la pantalla real, no un invento: son los 12 valores que la
hoja manda verificar. Los campos que la maquina trae y el paso no nombra (rodillo de apoyo,
entrada de material, enrollador de salida, alimentacion auxiliar, elevacion del desbobinador,
espesor de prensado) quedan fuera y estan declarados en el pie de la imagen.

Valores leidos en IMG_9527, fotogramas 5504 y 5560 (28/08/2026 12:33).
"""
import os

from PIL import Image, ImageDraw, ImageFont

import metrica_pantalla as MP

W, H = 1760, 872
FONDO   = (214, 219, 233)
PANEL   = (232, 235, 243)
CAJA    = (252, 252, 253)
BORDE   = (150, 158, 175)
TITULO  = (60, 72, 96)
TXT     = (28, 32, 40)
AZUL    = (31, 84, 168)
NARANJA = (214, 96, 34)
GRIS    = (110, 118, 132)
CUERPO  = 30                      # el rotulo mas chico que el operario tiene que leer


def _f(px, bold=False):
    for n in (("calibrib.ttf", "arialbd.ttf") if bold else ("calibri.ttf", "arial.ttf")):
        p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def centro(d, t, x, y, an, ft, fill):
    d.text((x + an / 2 - d.textlength(t, font=ft) / 2, y), t, font=ft, fill=fill)


def campo(d, x, y, an, al, valor, ft, color=TXT, marco=BORDE, grosor=2):
    d.rounded_rectangle([x, y, x + an, y + al], 4, fill=CAJA, outline=marco, width=grosor)
    centro(d, valor, x, y + al / 2 - ft.size * 0.62, an, ft, color)


im = Image.new("RGB", (W, H), FONDO)
d = ImageDraw.Draw(im)

# ── barra de titulo
d.rounded_rectangle([24, 20, W - 24, 92], 8, fill=(196, 203, 220), outline=BORDE, width=2)
d.rounded_rectangle([38, 30, 252, 82], 4, fill=CAJA, outline=BORDE, width=2)
d.text((52, 36), "28/08/2026", font=_f(25), fill=TXT)
d.text((52, 58), "12:33", font=_f(22), fill=GRIS)
centro(d, "PARÁMETROS DEL PRODUCTO Y DE TEMPERATURA", 252, 38, W - 290, _f(38, True), TITULO)

Y, ALTO = 110, 638

# ── izquierda: producto y velocidades
x, an = 24, 636
d.rounded_rectangle([x, Y, x + an, Y + ALTO], 8, fill=PANEL, outline=BORDE, width=2)
centro(d, "PRODUCTO Y VELOCIDADES", x, Y + 16, an, _f(30, True), TITULO)
filas = [("Receta seleccionada", "1", ""),
         ("Modelo de producto", "tpo", ""),
         ("Espesor de producto", "2,300", "mm"),
         ("Luz entre rodillos", "0,250", "mm"),
         ("Velocidad de línea", "3,000", "m/min"),
         ("Rodillo dosificador", "0,040", "m/min")]
yy = Y + 76
for rot, val, u in filas:
    d.text((x + 24, yy + 14), rot, font=_f(CUERPO), fill=TXT)
    campo(d, x + an - 268, yy, 154, 56, val, _f(32, True), AZUL)
    d.text((x + an - 104, yy + 14), u, font=_f(26), fill=TXT)
    yy += 88

# ── derecha: temperaturas de los dos rodillos, en una tabla
x2, an2 = 684, W - 708
d.rounded_rectangle([x2, Y, x2 + an2, Y + ALTO], 8, fill=PANEL, outline=BORDE, width=2)
centro(d, "TEMPERATURAS DE LOS RODILLOS  °C", x2, Y + 16, an2, _f(30, True), TITULO)

cw, c1 = 176, x2 + an2 - 396
c2 = c1 + cw + 20
centro(d, "ENCOLADO", c1, Y + 62, cw, _f(27, True), TITULO)
centro(d, "DOSIFICADOR", c2, Y + 62, cw, _f(27, True), TITULO)

temps = [("Temperatura de consigna", "185,0", "185,0", True),
         ("Temperatura de protección", "150,0", "150,0", True),
         ("Desviación de alarma superior", "+10,0", "+10,0", False),
         ("Desviación de alarma inferior", "−10,0", "−10,0", False),
         ("Alarma por sobretemperatura", "220,0", "220,0", True)]
yy = Y + 100
for rot, v1, v2, res in temps:
    d.text((x2 + 24, yy + 14), rot, font=_f(CUERPO), fill=TXT)
    for cx, v in ((c1, v1), (c2, v2)):
        campo(d, cx, yy, cw, 56, v, _f(32, True) if res else _f(30), AZUL if res else TXT)
    yy += 80

# rodillo de cola: dos valores sueltos, en su propia franja
yy += 10
d.rounded_rectangle([x2 + 18, yy, x2 + an2 - 18, yy + 74], 6, fill=(222, 226, 238),
                    outline=BORDE, width=2)
d.text((x2 + 38, yy + 24), "Rodillo de cola:", font=_f(CUERPO, True), fill=TITULO)
for k, (rot, val) in enumerate([("espera", "150,0"), ("enfriamiento", "100,0")]):
    bx = x2 + 250 + k * 330
    d.text((bx, yy + 24), rot, font=_f(CUERPO), fill=TXT)
    campo(d, bx + d.textlength(rot, font=_f(CUERPO)) + 16, yy + 10, 140, 54, val,
          _f(32, True), AZUL)

d.text((28, H - 62), "Pantalla del HMI de la laminadora, redibujada.  Valores leídos el "
       "28/08/2026 12:33 — video IMG_9527, fotogramas 5504 y 5560.", font=_f(24), fill=GRIS)
d.text((28, H - 34), "Muestra los campos que verifica esta hoja.  La pantalla real trae "
       "además otros seis: prensado, apoyo, entrada, enrollador, auxiliar y desbobinador.",
       font=_f(24), fill=GRIS)

print(*MP.guardar(im, "_pantalla_parametros.png", cuerpo_px=CUERPO,
                  que_es="parametros de producto y temperatura"))

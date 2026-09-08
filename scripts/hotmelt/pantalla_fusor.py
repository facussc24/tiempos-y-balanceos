# -*- coding: utf-8 -*-
"""Pantalla del FUSOR GLSC y pantalla de RECETA del HMI, redibujadas en castellano.

🔴 CRITERIO DEROGADO POR FAK EL 08/09/2026. Esta pantalla esta REDIBUJADA, y ya
no se hace asi: va la FOTO REAL enderezada con el rotulo en castellano encima, sin
tapar ningun valor ("poner la foto de la pantalla real y metele un edit y ponele
encima el dato que vos queres"). El operario tiene adelante la pantalla en chino.
Hay que REHACER esta pantalla con el criterio nuevo — modelo: pantalla_seguridad.py,
regla .claude/rules/hojas-proceso.md §3. Lo de abajo queda como historia.


Mismo criterio que pantalla_hmi.py: la pantalla se redibuja, no se fotografia. Cada
numero esta transcripto de un fotograma que se puede citar.
  · Fusor  -> IMG_9527 fotograma 623  (28/08/2026 22:04)
  · Receta -> IMG_9527 fotograma 1660 (28/08/2026 11:15)
"""
from PIL import Image, ImageDraw, ImageFont

import metrica_pantalla as MP
import os

FONDO  = (214, 219, 233)
PANEL  = (232, 235, 243)
CAJA   = (252, 252, 253)
BORDE  = (150, 158, 175)
TITULO = (60, 72, 96)
TXT    = (28, 32, 40)
AZUL   = (31, 84, 168)
VERDE  = (46, 125, 62)


def _f(px, bold=False):
    for n in (("calibrib.ttf", "arialbd.ttf") if bold else ("calibri.ttf", "arial.ttf")):
        p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def centro(d, t, x, y, an, ft, fill):
    d.text((x + an / 2 - d.textlength(t, font=ft) / 2, y), t, font=ft, fill=fill)


def campo(d, x, y, an, al, valor, ft, color=TXT, relleno=CAJA, borde=BORDE):
    d.rounded_rectangle([x, y, x + an, y + al], 4, fill=relleno, outline=borde, width=2)
    centro(d, valor, x, y + al / 2 - ft.size * 0.62, an, ft, color)


def cabecera(d, W, fecha, hora, titulo):
    d.rounded_rectangle([24, 20, W - 24, 92], 8, fill=(196, 203, 220), outline=BORDE, width=2)
    d.rounded_rectangle([38, 30, 260, 82], 4, fill=CAJA, outline=BORDE, width=2)
    d.text((52, 38), fecha, font=_f(24), fill=TXT)
    d.text((52, 58), hora, font=_f(22), fill=(110, 118, 132))
    centro(d, titulo, 260, 40, W - 300, _f(36, True), TITULO)


def pie(d, W, H, txt):
    """El pie dice de donde salio el dato. Se parte solo si no entra: escrito de una linea,
    se cortaba contra el borde derecho y la fuente quedaba a medias — que es justo lo que el
    pie esta para evitar."""
    ft = _f(23)
    cupo = W - 56
    lineas, actual = [], ""
    for p in txt.split(" "):
        prueba = (actual + " " + p).strip()
        if d.textlength(prueba, font=ft) <= cupo or not actual:
            actual = prueba
        else:
            lineas.append(actual)
            actual = p
    lineas.append(actual)
    y = H - 20 - 28 * len(lineas)
    for l in lineas:
        d.text((28, y), l, font=ft, fill=(110, 118, 132))
        y += 28


# ─────────────────────────── FUSOR ────────────────────────────────────────────
W, H = 1120, 900
im = Image.new("RGB", (W, H), FONDO); d = ImageDraw.Draw(im)
cabecera(d, W, "28/08/2026", "22:04", "FUSOR DE ADHESIVO — TEMPERATURAS")

x, y, an = 24, 110, W - 48
d.rounded_rectangle([x, y, x + an, y + 660], 8, fill=PANEL, outline=BORDE, width=2)
cols = [("Zona", 400), ("Mínimo", 220), ("CONSIGNA", 240), ("Máximo", 220)]
cx = x + 20
for rot, w in cols:
    centro(d, rot, cx, y + 22, w, _f(24, True), TITULO)
    cx += w

filas = [("Tanque",      "150,0", "160,0", "185,0"),
         ("Manguera 1",  "150,0", "160,0", "185,0"),
         ("Pistola 1",   "150,0", "160,0", "185,0"),
         ("Manguera 2",  "150,0", "160,0", "185,0"),
         ("Pistola 2",   "150,0", "160,0", "185,0"),
         ("Temp. externa", "40,0", "—",   "45,0")]
yy = y + 74
for zona, inf, cons, sup in filas:
    d.text((x + 30, yy + 14), zona, font=_f(26), fill=TXT)
    cx = x + 20 + 400
    campo(d, cx + 35, yy, 140, 54, inf, _f(28))
    campo(d, cx + 255, yy, 140, 54, cons, _f(32, True), AZUL)
    campo(d, cx + 480, yy, 140, 54, sup, _f(28))
    yy += 90
pie(d, W, H, "Fusor Saipu PUR, pantalla redibujada.  Los cinco circuitos van a la misma "
    "consigna.  Leído el 28/08/2026 — IMG_9527, fotograma 623.")
print(*MP.guardar(im, "_pantalla_fusor.png", cuerpo_px=28,
                 que_es="temperaturas del fusor"))


# ─────────────────────────── RECETA ───────────────────────────────────────────
W, H = 1700, 860
im = Image.new("RGB", (W, H), FONDO); d = ImageDraw.Draw(im)
cabecera(d, W, "28/08/2026", "11:15", "RECETA DEL PRODUCTO")

# izquierda: identificacion
x, y, an = 24, 110, 800
d.rounded_rectangle([x, y, x + an, y + 300], 8, fill=PANEL, outline=BORDE, width=2)
centro(d, "PRODUCTO", x, y + 16, an, _f(28, True), TITULO)
for k, (rot, val) in enumerate([("Número de receta", "1"), ("Nombre del producto", "tpo")]):
    yy = y + 80 + k * 90
    d.text((x + 30, yy + 14), rot, font=_f(27), fill=TXT)
    campo(d, x + an - 260, yy, 220, 54, val, _f(30, True), AZUL)

# izquierda abajo: medidas
y2 = y + 320
d.rounded_rectangle([x, y2, x + an, y2 + 420], 8, fill=PANEL, outline=BORDE, width=2)
centro(d, "MEDIDAS", x, y2 + 16, an, _f(28, True), TITULO)
med = [("Espesor de producto", "2,300", "mm"),
       ("Espesor de prensado", "0,000", "mm"),
       ("Luz entre rodillos",  "0,250", "mm")]
for k, (rot, val, u) in enumerate(med):
    yy = y2 + 80 + k * 100
    d.text((x + 30, yy + 14), rot, font=_f(27), fill=TXT)
    campo(d, x + an - 300, yy, 180, 54, val, _f(30, True), AZUL)
    d.text((x + an - 100, yy + 14), u, font=_f(26), fill=TXT)

# derecha: velocidades
x3, an3 = 850, W - 874
d.rounded_rectangle([x3, y, x3 + an3, y + 740], 8, fill=PANEL, outline=BORDE, width=2)
centro(d, "VELOCIDADES", x3, y + 16, an3, _f(28, True), TITULO)
vel = [("Rodillo dosificador",   "0,040", True),
       ("Rodillo de encolado",   "3,000", True),
       ("Rodillo de apoyo",      "3,000", False),
       ("Entrada de material",   "3,000", False),
       ("Enrollador (salida)",   "6,000", True),
       ("Alimentación auxiliar", "3,000", False),
       ("Elevación desbobinador","0,500", False)]
for k, (rot, val, res) in enumerate(vel):
    yy = y + 80 + k * 92
    d.text((x3 + 30, yy + 14), rot, font=_f(26), fill=TXT)
    campo(d, x3 + an3 - 300, yy, 180, 54, val, _f(29, True) if res else _f(27),
          AZUL if res else TXT)
    d.text((x3 + an3 - 105, yy + 8), "m/", font=_f(20), fill=TXT)
    d.text((x3 + an3 - 105, yy + 30), "min", font=_f(20), fill=TXT)
pie(d, W, H, "Pantalla de receta del HMI, redibujada.  Valores leídos el 28/08/2026 — "
    "video IMG_9527, fotograma 1660.   El enrollador va siempre al doble de la entrada.")
print(*MP.guardar(im, "_pantalla_receta.png", cuerpo_px=30,
                 que_es="receta del producto"))

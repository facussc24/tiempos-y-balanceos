# -*- coding: utf-8 -*-
"""Pantalla de LIMPIEZA DE RODILLOS del HMI, redibujada en castellano.

Leida en IMG_0389, fotograma 19 (26/08/2026). Esta pantalla no tiene valores numericos:
son los 3 pasos del programa de limpieza, sus notas y los botones. Por eso se puede
redibujar entera sin riesgo de equivocar un digito.

El indicador de puerta anulada se dibuja COMO ESTA EN LA MAQUINA (recuadro verde: es una
lampara de estado, no una alarma). La franja roja de abajo es anotacion NUESTRA, separada
a proposito, para que no se confunda con lo que muestra el HMI.
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
VERDE  = (150, 220, 120)
VERDET = (24, 84, 24)
ROJO   = (192, 32, 32)
GRISB  = (206, 212, 226)


def _f(px, bold=False):
    for n in (("calibrib.ttf", "arialbd.ttf") if bold else ("calibri.ttf", "arial.ttf")):
        p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def centro(d, t, x, y, an, ft, fill):
    d.text((x + an / 2 - d.textlength(t, font=ft) / 2, y), t, font=ft, fill=fill)


# 1400 px de ancho, no 1700: la imagen se acomoda por su ALTURA dentro del bloque de la
# hoja, asi que achicar el dibujo la agranda impresa. Con 1700 y cuerpo 25 daba 4,5 pt; con
# 1400 y cuerpo 30 da 8,0. Los rotulos se acortaron para que entren, sin perder la
# instruccion: lo que se saco es relleno, no contenido.
W, H = 1400, 1004
CUERPO = 30
im = Image.new("RGB", (W, H), FONDO)
d = ImageDraw.Draw(im)

# cabecera
d.rounded_rectangle([24, 20, W - 24, 92], 8, fill=(196, 203, 220), outline=BORDE, width=2)
d.rounded_rectangle([38, 30, 244, 82], 4, fill=CAJA, outline=BORDE, width=2)
d.text((52, 40), "26/08/2026", font=_f(25), fill=TXT)
centro(d, "LIMPIEZA DE RODILLOS", 244, 38, W - 280, _f(38, True), TITULO)

# ── los tres pasos, en columna, con flecha entre uno y otro
pasos = [
    ("PASO 1", "Arrancar limpieza  ·  ANULA la puerta de seguridad",
     "El eje va a la posición de limpieza.\nRecién ahí se coloca la bandeja."),
    ("PASO 2", "Agregar líquido  ·  Cierra la luz entre rodillos",
     "El líquido se agrega a mano, desde afuera.\nEl rodillo gira en continuo."),
    ("PASO 3", "Abrir la luz entre rodillos  ·  Limpieza manual",
     "El rodillo deja de girar en continuo."),
]
x, y, an = 24, 110, 1010
for k, (num, tit, nota) in enumerate(pasos):
    d.rounded_rectangle([x, y, x + an, y + 168], 8, fill=PANEL, outline=BORDE, width=2)
    d.rounded_rectangle([x + 16, y + 18, x + 158, y + 76], 6, fill=AZUL, outline=AZUL)
    centro(d, num, x + 16, y + 29, 142, _f(30, True), (255, 255, 255))
    d.text((x + 178, y + 26), tit, font=_f(30, True), fill=TITULO)
    d.multiline_text((x + 178, y + 76), nota, font=_f(CUERPO), fill=TXT, spacing=6)
    if k < 2:
        cx = x + 87
        d.line([(cx, y + 168), (cx, y + 190)], fill=AZUL, width=5)
        d.polygon([(cx - 12, y + 186), (cx + 12, y + 186), (cx, y + 206)], fill=AZUL)
    y += 196

d.rounded_rectangle([x, y, x + an, y + 62], 8, fill=GRISB, outline=BORDE, width=2)
centro(d, "FIN DE LIMPIEZA", x, y + 14, an, _f(30, True), TITULO)

# ── columna derecha: estado y botones, como los muestra el HMI
xr, anr = 1058, W - 1082
d.rounded_rectangle([xr, 110, xr + anr, 110 + 570], 8, fill=PANEL, outline=BORDE, width=2)
centro(d, "ESTADO Y MANDOS", xr, 124, anr, _f(28, True), TITULO)

d.rounded_rectangle([xr + 20, 176, xr + anr - 20, 268], 6, fill=VERDE, outline=VERDET, width=3)
centro(d, "PUERTA DE", xr + 20, 190, anr - 40, _f(27, True), VERDET)
centro(d, "SEGURIDAD", xr + 20, 216, anr - 40, _f(27, True), VERDET)
centro(d, "ANULADA", xr + 20, 240, anr - 40, _f(27, True), VERDET)

for k, t in enumerate([("Giro manual", "atrás"), ("Giro manual", "adelante"),
                       ("Parar alarma", None)]):
    yy = 292 + k * 96
    d.rounded_rectangle([xr + 20, yy, xr + anr - 20, yy + 78], 6,
                        fill=GRISB, outline=BORDE, width=2)
    if t[1]:
        centro(d, t[0], xr + 20, yy + 8, anr - 40, _f(CUERPO), TXT)
        centro(d, t[1], xr + 20, yy + 42, anr - 40, _f(CUERPO), TXT)
    else:
        centro(d, t[0], xr + 20, yy + 24, anr - 40, _f(CUERPO), TXT)

# ── franja de advertencia: anotacion nuestra, no del HMI
yw = 782
d.rounded_rectangle([24, yw, W - 24, yw + 168], 8, fill=(253, 238, 238), outline=ROJO, width=4)
d.text((48, yw + 18), "MIENTRAS DURA LA LIMPIEZA, LA PUERTA NO PROTEGE",
       font=_f(33, True), fill=ROJO)
d.multiline_text((48, yw + 66),
                 "El rodillo gira caliente con la puerta anulada.\n"
                 "El líquido se aplica desde afuera del paso de rodillos, nunca con la mano\n"
                 "entre ellos, y en ese rato no opera la máquina nadie más.",
                 font=_f(CUERPO), fill=(120, 30, 30), spacing=6)

d.text((28, H - 38), "Pantalla de limpieza del HMI, redibujada.  Leída el 26/08/2026 — "
       "IMG_0389, fotograma 19.   La franja roja es advertencia de esta hoja, no del HMI.",
       font=_f(22), fill=(110, 118, 132))

print(*MP.guardar(im, "_pantalla_limpieza.png", cuerpo_px=CUERPO,
                 que_es="pasos de la limpieza de rodillos"))

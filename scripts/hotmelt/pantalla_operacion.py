# -*- coding: utf-8 -*-
"""Pantalla de OPERACION del HMI (`操作画面`, tecla F1), redibujada en castellano.

🔴 CRITERIO DEROGADO POR FAK EL 08/09/2026. Esta pantalla esta REDIBUJADA, y ya
no se hace asi: va la FOTO REAL enderezada con el rotulo en castellano encima, sin
tapar ningun valor ("poner la foto de la pantalla real y metele un edit y ponele
encima el dato que vos queres"). El operario tiene adelante la pantalla en chino.
Hay que REHACER esta pantalla con el criterio nuevo — modelo: pantalla_seguridad.py,
regla .claude/rules/hojas-proceso.md §3. Lo de abajo queda como historia.


Es UNA sola pantalla que el operario ve en cuatro momentos distintos, asi que se genera
en tres estados y cada hoja usa el suyo:
    detenido            -> 20.15  parada de la maquina
    calentamiento_ok    -> 20.5   calentamiento y espera
    automatico          -> 20.9 arranque  y  20.10 durante la marcha

Campos y etiquetas leidos en IMG_9527 fotograma 961 (28/08/2026 11:04, el HMI en INGLES,
que es donde se leen sin traducir). La temperatura de alarma sale del fotograma 5504
(12:33), DESPUES de que el tecnico la subiera de 160 a 220 a las 12:32.

03/09/2026 — se le saco la columna PRODUCTO EN MAQUINA. Eran 7 campos que ya viven, mas
grandes, en la pantalla de la 20.4; aca solo estiraban el dibujo. En las tres hojas que la
usan el paso manda mirar el ESTADO y las temperaturas en vivo, nada mas. Sacandola, la misma
tipografia entra en 1260 px en vez de 1760 y la pantalla pasa de 3,3 pt impresos a 8,3 —
sobre el minimo de 7 pt, que es lo mas chico que Barack pone en estas hojas.
"""
from PIL import Image, ImageDraw, ImageFont

import metrica_pantalla as MP
import os, sys

FONDO   = (214, 219, 233)
PANEL   = (232, 235, 243)
CAJA    = (252, 252, 253)
BORDE   = (150, 158, 175)
TITULO  = (60, 72, 96)
TXT     = (28, 32, 40)
AZUL    = (31, 84, 168)
NARANJA = (214, 96, 34)
VERDE   = (150, 220, 120)
VERDET  = (24, 84, 24)
CELESTE = (176, 226, 236)
ROJOB   = (232, 92, 92)
APAG    = (196, 203, 220)


def _f(px, bold=False):
    for n in (("calibrib.ttf", "arialbd.ttf") if bold else ("calibri.ttf", "arial.ttf")):
        p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def centro(d, t, x, y, an, ft, fill):
    d.text((x + an / 2 - d.textlength(t, font=ft) / 2, y), t, font=ft, fill=fill)


def campo(d, x, y, an, al, valor, ft, color=TXT):
    d.rounded_rectangle([x, y, x + an, y + al], 4, fill=CAJA, outline=BORDE, width=2)
    centro(d, valor, x, y + al / 2 - ft.size * 0.62, an, ft, color)


ESTADOS = {
    "detenido": dict(banda="DETENIDO", color=ROJOB, letra=(120, 20, 20),
                     giro=False, calent=True, vivo=("150,2", "149,8"),
                     cal_ok=False, pie="20.15  ·  parada de la máquina"),
    "calentamiento_ok": dict(banda="CALENTAMIENTO COMPLETO", color=VERDE, letra=VERDET,
                             giro=False, calent=True, vivo=("184,7", "184,4"),
                             cal_ok=True, pie="20.5  ·  calentamiento y espera"),
    "automatico": dict(banda="EN MARCHA AUTOMÁTICA", color=CELESTE, letra=(20, 70, 90),
                       giro=True, calent=True, vivo=("184,7", "184,4"),
                       cal_ok=True, pie="20.9 arranque  ·  20.10 durante la marcha"),
}


def dibujar(clave):
    e = ESTADOS[clave]
    W, H = 1260, 1052
    im = Image.new("RGB", (W, H), FONDO)
    d = ImageDraw.Draw(im)

    d.rounded_rectangle([24, 20, W - 24, 92], 8, fill=(196, 203, 220), outline=BORDE, width=2)
    d.rounded_rectangle([38, 30, 244, 82], 4, fill=CAJA, outline=BORDE, width=2)
    d.text((52, 36), "28/08/2026", font=_f(25), fill=TXT)
    d.text((52, 58), "11:04", font=_f(22), fill=(110, 118, 132))
    centro(d, "PANTALLA DE OPERACIÓN", 244, 38, W - 280, _f(38, True), TITULO)

    # ── izquierda: mandos ── el paso 20.15 manda mirar estos testigos
    x, y, an = 24, 110, 588
    # el ALTO no es libre: la imagen se acomoda por su ALTURA dentro del bloque de la hoja,
    # asi que cuanto mas alta es la pantalla, MENOS ancho le toca y peor se lee. 1052 px de
    # alto le dan 10,9 cm de ancho, contra los 10,4 que necesita para llegar a 7 pt.
    ALTO = 600
    d.rounded_rectangle([x, y, x + an, y + ALTO], 8, fill=PANEL, outline=BORDE, width=2)
    centro(d, "MANDOS", x, y + 14, an, _f(28, True), TITULO)
    mandos = [("Giro del rodillo de encolado", e["giro"]),
              ("Calefacción rodillo de encolado", e["calent"]),
              ("Giro del rodillo dosificador", e["giro"]),
              ("Calefacción rodillo dosificador", e["calent"]),
              ("Posición de luz de encolado", False),
              ("Arranque de inyección de adhesivo", False),
              ("Enfriamiento de rodillos", False)]
    yy = y + 62
    for rot, on in mandos:
        d.rounded_rectangle([x + 16, yy, x + an - 84, yy + 60], 6,
                            fill=VERDE if on else APAG, outline=BORDE, width=2)
        d.text((x + 30, yy + 17), rot, font=_f(26), fill=VERDET if on else (90, 96, 110))
        d.rounded_rectangle([x + an - 68, yy + 15, x + an - 22, yy + 46], 4,
                            fill=(60, 200, 80) if on else (170, 178, 192), outline=BORDE, width=2)
        yy += 75

    # ── derecha: temperaturas
    x2, an2 = 632, W - 656
    d.rounded_rectangle([x2, y, x2 + an2, y + ALTO], 8, fill=PANEL, outline=BORDE, width=2)
    centro(d, "TEMPERATURAS  °C", x2, y + 14, an2, _f(28, True), TITULO)
    temps = [("Temperatura de alarma", "220,0", False),
             ("Temperatura de espera", "150,0", False),
             ("Temperatura de enfriamiento", "100,0", False),
             ("Rodillo de encolado", e["vivo"][0], True),
             ("Rodillo dosificador", e["vivo"][1], True)]
    yy = y + 72
    for rot, val, vivo in temps:
        d.text((x2 + 22, yy + 17), rot, font=_f(26), fill=TXT)
        if vivo:
            d.rounded_rectangle([x2 + an2 - 186, yy, x2 + an2 - 24, yy + 58], 4,
                                fill=(255, 255, 255), outline=NARANJA, width=3)
            centro(d, val, x2 + an2 - 186, yy + 12, 162, _f(32, True), NARANJA)
        else:
            campo(d, x2 + an2 - 186, yy, 162, 58, val, _f(30))
        yy += 80
    d.text((x2 + 22, yy + 24), "Las dos de abajo son la lectura en vivo.",
           font=_f(23), fill=(110, 118, 132))

    # ── banda de estado: es LO QUE EL PASO MANDA MIRAR, asi que va grande
    yb = y + ALTO + 20
    d.rounded_rectangle([24, yb, W - 24, yb + 96], 8, fill=e["color"], outline=BORDE, width=3)
    centro(d, e["banda"], 24, yb + 24, W - 48, _f(44, True), e["letra"])

    # ── testigos del fusor, uno por renglon (en 3 columnas el rotulo no entraba)
    yt = yb + 112
    testigos = [("Máquina de adhesivo sin preparar", not e["cal_ok"]),
                ("Calentamiento completo", e["cal_ok"]),
                ("Nivel de adhesivo normal", True)]
    for rot, on in testigos:
        aviso = rot.startswith("Máquina de adhesivo sin")
        col = ((250, 214, 120) if aviso else VERDE) if on else APAG
        let = ((130, 82, 10) if aviso else VERDET) if on else (90, 96, 110)
        d.rounded_rectangle([24, yt, W - 24, yt + 52], 6, fill=col, outline=BORDE, width=2)
        centro(d, rot, 24, yt + 11, W - 48, _f(27, True), let)
        yt += 58

    d.text((28, H - 34), "Pantalla de operación del HMI, redibujada.  Leída el 28/08/2026 — "
           "IMG_9527, fotogramas 961 y 5504.   Estado: " + e["pie"],
           font=_f(21), fill=(110, 118, 132))

    dst = "_pantalla_operacion_%s.png" % clave
    return MP.guardar(im, dst, cuerpo_px=30,
                      que_es="pantalla de operacion (%s)" % clave)


for k in ESTADOS:
    print(*dibujar(k))

# -*- coding: utf-8 -*-
"""Redibuja una pantalla del HMI como TABLA LIMPIA, en castellano y en el estilo Barack.

Por que existe: la foto de una pantalla filmada nunca va a ser legible impresa (reflejo
quemado, angulo, foco). Y "mejorarla" con IA generativa NO sirve para esto: reinventa los
digitos. Un 160 puede volver 180 y la foto queda MAS creible que antes. En una hoja de
planta eso es el peor error posible.

La salida de aca es distinta: cada numero se TRANSCRIBE de un fotograma que se puede citar.
La foto queda al lado, chica, como evidencia; el operario lee la tabla.
"""
from PIL import Image, ImageDraw, ImageFont
import os, sys

AZUL   = (68, 84, 106)      # dk2, el de las bandas de la HO
AZUL2  = (68, 114, 196)     # accent1
GRIS   = (242, 243, 246)
NEGRO  = (25, 25, 25)
BLANCO = (255, 255, 255)
BORDE  = (170, 176, 186)


def _f(px, bold=False):
    for n in (("calibrib.ttf", "arialbd.ttf") if bold else ("calibri.ttf", "arial.ttf")):
        p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def tabla(titulo, subtitulo, cols, filas, dst, ancho=1600, resaltar=None):
    """cols: [(rotulo, ancho_relativo), ...]   filas: [[celda, ...], ...]
       resaltar: indice de la columna que va en negrita azul (el valor que importa)"""
    pad = 14
    h_tit, h_sub, h_cab, h_fila = 76, 44, 54, 58
    alto = pad + h_tit + h_sub + h_cab + h_fila * len(filas) + pad
    im = Image.new("RGB", (ancho, alto), BLANCO)
    d = ImageDraw.Draw(im)

    x0, x1 = pad, ancho - pad
    # titulo
    d.rectangle([x0, pad, x1, pad + h_tit], fill=AZUL)
    d.text((x0 + 20, pad + 18), titulo, font=_f(38, True), fill=BLANCO)
    # subtitulo (de donde salio el dato)
    y = pad + h_tit
    d.rectangle([x0, y, x1, y + h_sub], fill=GRIS, outline=BORDE)
    d.text((x0 + 20, y + 11), subtitulo, font=_f(24), fill=(90, 96, 108))

    total = sum(w for _, w in cols)
    anchos = [w / total * (x1 - x0) for _, w in cols]
    # cabecera
    y += h_sub
    cx = x0
    for (rot, _), an in zip(cols, anchos):
        d.rectangle([cx, y, cx + an, y + h_cab], fill=AZUL2, outline=BORDE)
        ft = _f(26, True)
        d.text((cx + an / 2 - d.textlength(rot, font=ft) / 2, y + 13), rot, font=ft, fill=BLANCO)
        cx += an
    # filas
    y += h_cab
    for k, fila in enumerate(filas):
        cx = z = x0
        fondo = BLANCO if k % 2 == 0 else GRIS
        for j, (val, an) in enumerate(zip(fila, anchos)):
            d.rectangle([cx, y, cx + an, y + h_fila], fill=fondo, outline=BORDE)
            neg = (j == resaltar)
            ft = _f(30 if neg else 27, neg)
            col = AZUL2 if neg else NEGRO
            if j == 0:
                d.text((cx + 16, y + 14), str(val), font=ft, fill=col)
            else:
                d.text((cx + an / 2 - d.textlength(str(val), font=ft) / 2, y + 14),
                       str(val), font=ft, fill=col)
            cx += an
        y += h_fila
    im.save(dst, quality=96)
    return dst, im.size


if __name__ == "__main__":
    # ── Fusor GLSC — leido en IMG_9527, fotograma 623 (28/08/2026 22:04)
    print(*tabla(
        "FUSOR DE ADHESIVO — TEMPERATURAS",
        "Pantalla del fusor GLSC (sistema PUR).  Valores leidos el 28/08/2026, 22:04.",
        [("Zona", 3.2), ("Limite inferior", 2.0), ("CONSIGNA", 2.0), ("Limite superior", 2.0)],
        [["Plato (tanque)",   "150 °C", "160 °C", "185 °C"],
         ["Manguera 1",       "150 °C", "160 °C", "185 °C"],
         ["Pistola 1",        "150 °C", "160 °C", "185 °C"],
         ["Manguera 2",       "150 °C", "160 °C", "185 °C"],
         ["Pistola 2",        "150 °C", "160 °C", "185 °C"]],
        "_tabla_fusor.png", resaltar=2))

    # ── Rodillos SIMATIC — leido en IMG_9527, fotograma 5560 (28/08/2026 13:33)
    print(*tabla(
        "RODILLOS — TEMPERATURAS",
        "Pantalla de ajuste de temperatura del HMI.  Los dos rodillos, el de encolado y el "
        "dosificador, llevan los mismos valores.  Leidos el 28/08/2026, 13:33.",
        [("Parametro", 4.6), ("Valor", 2.0), ("Que pasa si no se cumple", 5.0)],
        [["Temperatura de consigna",      "185 °C", "Por debajo el adhesivo sale en hilos; por encima se quema"],
         ["Temperatura de proteccion",    "150 °C", "Por debajo los rodillos no giran"],
         ["Desviacion de alarma",         "± 10 °C", "Alarma si se aparta de la consigna"],
         ["Alarma por sobretemperatura",  "220 °C", "Corta por temperatura excesiva"],
         ["Temperatura de espera",        "150 °C", "Con la maquina parada y caliente"],
         ["Temperatura de enfriamiento",  "100 °C", "Enfriamiento a la salida"]],
        "_tabla_rodillos.png", resaltar=1))

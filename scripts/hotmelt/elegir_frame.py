# -*- coding: utf-8 -*-
"""Elige fotos entre los 10.200 fotogramas: mide el foco y arma una plancha para mirar.

Por que existe: las fotos que estan hoy en las hojas se recortaron de video grabado
caminando. Medidas las 114 (varianza del laplaciano, 08/09/2026), la mediana da 705 y el
cuarto peor esta por debajo de 328 — y justo el enhebrado, la operacion mas dificil, tiene
las peores: 22, 28, 76, 76, 97. Una foto movida no se entiende por mas grande que se
imprima, asi que antes de agrandar hay que ELEGIR mejor.

El numero no dice "linda": dice cuanto borde nitido tiene. Una foto de una superficie lisa
puntua bajo estando en foco, asi que el numero ORDENA la lista y despues se MIRA la plancha.
Nadie elige una foto sin verla.

    elegir_frame.py --frames <carpeta> [--top 24] [--desde N --hasta N]
                    [--plancha <salida.jpg>] [--copiar <carpeta> --cuantas N]
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageDraw

MAX_LADO = 900          # para medir; el recorte final sale del original


def foco(ruta):
    """Varianza del laplaciano sobre el gris. Mas alto = mas borde nitido."""
    im = Image.open(ruta).convert("L")
    im.thumbnail((MAX_LADO, MAX_LADO))
    a = np.asarray(im, dtype=np.float32)
    h, w = a.shape
    if h < 5 or w < 5:
        return 0.0
    s = (a[0:h - 2, 1:w - 1] + a[2:h, 1:w - 1] + a[1:h - 1, 0:w - 2] + a[1:h - 1, 2:w]
         - 4 * a[1:h - 1, 1:w - 1])
    return float(s.var())


def numero(nombre):
    """9527_0413.jpg -> 413. Sirve para acotar la busqueda a un tramo del video."""
    base = os.path.splitext(nombre)[0]
    cola = base.rsplit("_", 1)[-1]
    return int(cola) if cola.isdigit() else -1


def medir(carpeta, desde=None, hasta=None):
    out = []
    for n in sorted(os.listdir(carpeta)):
        if not n.lower().endswith((".jpg", ".png")):
            continue
        k = numero(n)
        if desde is not None and k < desde:
            continue
        if hasta is not None and k > hasta:
            continue
        out.append((foco(os.path.join(carpeta, n)), n))
    out.sort(reverse=True)
    return out


def plancha(carpeta, filas, salida, cols=6, celda=380):
    """Contacto con el numero de fotograma y su foco escritos encima de cada miniatura."""
    n = len(filas)
    fils = (n + cols - 1) // cols
    alto = celda * 3 // 4
    hoja = Image.new("RGB", (cols * celda, fils * (alto + 22)), (24, 24, 28))
    d = ImageDraw.Draw(hoja)
    for i, (v, nom) in enumerate(filas):
        im = Image.open(os.path.join(carpeta, nom))
        im.thumbnail((celda - 6, alto - 6))
        x = (i % cols) * celda + (celda - im.size[0]) // 2
        y = (i // cols) * (alto + 22) + (alto - im.size[1]) // 2
        hoja.paste(im, (x, y))
        d.text(((i % cols) * celda + 6, (i // cols) * (alto + 22) + alto + 4),
               "%s   foco %.0f" % (os.path.splitext(nom)[0], v), fill=(230, 230, 235))
    hoja.save(salida, quality=88)
    return hoja.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", required=True)
    ap.add_argument("--top", type=int, default=24)
    ap.add_argument("--desde", type=int)
    ap.add_argument("--hasta", type=int)
    ap.add_argument("--plancha")
    ap.add_argument("--copiar")
    ap.add_argument("--cuantas", type=int, default=6)
    a = ap.parse_args()

    filas = medir(a.frames, a.desde, a.hasta)
    if not filas:
        raise SystemExit("no hay fotogramas en ese tramo")
    vals = [v for v, _ in filas]
    print("%d fotogramas  ·  foco  max %.0f  mediana %.0f  min %.0f"
          % (len(filas), vals[0], vals[len(vals) // 2], vals[-1]))
    for v, n in filas[:a.top]:
        print("  %7.0f  %s" % (v, n))

    if a.plancha:
        w, h = plancha(a.frames, filas[:a.top], a.plancha)
        print("plancha %dx%d -> %s" % (w, h, a.plancha))
    if a.copiar:
        import shutil
        os.makedirs(a.copiar, exist_ok=True)
        for v, n in filas[:a.cuantas]:
            shutil.copy2(os.path.join(a.frames, n), os.path.join(a.copiar, n))
        print("copiados %d a %s" % (a.cuantas, a.copiar))


main()

# -*- coding: utf-8 -*-
"""medir_marca.py — donde esta cada pulsador, MEDIDO sobre la foto. No estimado a ojo.

Por que existe (Fak, 21/09/2026: *"le erraste con los cuadraditos, no estan bien puestos
sobre los botones, eso revisalo cuidadosamente... errores obvios"*). Yo habia colocado las
marcas mirando un render, despues cambie el recorte y volvi a estimar los porcentajes sin
volver a mirar. Una posicion es una DISTANCIA y una distancia se mide.

Encuentra las manchas de color saturado (pulsadores verde / rojo / azul / amarillo de la
seta) y devuelve su caja en PORCENTAJE de la foto, que es como las toma `rotular.py`.

    medir_marca.py --foto f.jpg [--min-area 0.0004] [--margen 8] [--marcado prueba.jpg]

`--margen` agranda la caja ese % de su lado, para que el recuadro rodee al pulsador y no lo
corte. El veredicto igual sale de MIRAR la imagen de prueba: esto ordena y ubica, no aprueba.
"""
from __future__ import annotations

import argparse
import colorsys

import numpy as np
from PIL import Image, ImageDraw

# (nombre, hue min, hue max) en grados; la seta amarilla y el rojo se parten aparte
COLORES = [
    ("verde", 75, 165),
    ("azul", 185, 265),
    ("amarillo", 35, 70),
    ("rojo", 340, 20),      # cruza el 0
]

# Manchas que no son de color: se buscan por luminancia. "oscuro" es lo que hay que rodear
# cuando lo marcado es una zona negra sobre fondo claro (el contorno del molde sobre la
# grilla de resistencias), y "claro" al reves.
LUZ = [("oscuro", 0.00, 0.26), ("claro", 0.93, 1.01)]


def _mascara(hsv, h0, h1, s_min=0.35, v_min=0.25):
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    if h0 <= h1:
        mh = (h >= h0) & (h <= h1)
    else:                                   # el rojo cruza el 0
        mh = (h >= h0) | (h <= h1)
    return mh & (s >= s_min) & (v >= v_min)


def _componentes(m):
    """Etiquetado por union-find sobre 4-vecinos. Sin scipy: el entorno no lo tiene."""
    H, W = m.shape
    etiq = np.zeros((H, W), dtype=np.int32)
    padre: dict[int, int] = {}

    def raiz(a):
        while padre[a] != a:
            padre[a] = padre[padre[a]]
            a = padre[a]
        return a

    def unir(a, b):
        ra, rb = raiz(a), raiz(b)
        if ra != rb:
            padre[max(ra, rb)] = min(ra, rb)

    n = 0
    for y in range(H):
        fila = m[y]
        for x in range(W):
            if not fila[x]:
                continue
            arriba = etiq[y - 1, x] if y else 0
            izq = etiq[y, x - 1] if x else 0
            if arriba and izq:
                etiq[y, x] = min(arriba, izq)
                unir(arriba, izq)
            elif arriba or izq:
                etiq[y, x] = arriba or izq
            else:
                n += 1
                padre[n] = n
                etiq[y, x] = n
    for k in list(padre):
        padre[k] = raiz(k)
    return etiq, padre


def manchas(im: Image.Image, min_area: float):
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    hsv = np.zeros_like(a)
    mx, mn = a.max(2), a.min(2)
    dif = mx - mn
    hsv[..., 2] = mx
    hsv[..., 1] = np.where(mx > 0, dif / np.maximum(mx, 1e-6), 0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.zeros_like(mx)
    m = dif > 1e-6
    idx = m & (mx == r)
    h[idx] = ((g - b)[idx] / dif[idx]) % 6
    idx = m & (mx == g)
    h[idx] = ((b - r)[idx] / dif[idx]) + 2
    idx = m & (mx == b)
    h[idx] = ((r - g)[idx] / dif[idx]) + 4
    hsv[..., 0] = (h / 6.0) % 1.0

    H, W = mx.shape
    tope = max(20, int(min_area * H * W))
    out = []
    gris = a.mean(2)
    for nombre, h0, h1 in COLORES + LUZ:
        if (nombre, h0, h1) in [(n, x, y) for n, x, y in LUZ]:
            msk = (gris >= h0) & (gris < h1)
        else:
            msk = _mascara(hsv, h0, h1)
        if msk.sum() < tope:
            continue
        etiq, padre = _componentes(msk)
        agrup: dict[int, list[int]] = {}
        ys, xs = np.nonzero(etiq)
        for y, x in zip(ys, xs):
            r_ = padre[int(etiq[y, x])]
            c = agrup.setdefault(r_, [W, H, 0, 0, 0])
            c[0] = min(c[0], int(x)); c[1] = min(c[1], int(y))
            c[2] = max(c[2], int(x)); c[3] = max(c[3], int(y))
            c[4] += 1
        for c in agrup.values():
            if c[4] < tope:
                continue
            out.append((nombre, c[0], c[1], c[2] - c[0] + 1, c[3] - c[1] + 1, c[4]))
    out.sort(key=lambda t: t[1])
    return out, (W, H)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--foto", required=True)
    ap.add_argument("--min-area", dest="min_area", type=float, default=0.0008,
                    help="area minima de una mancha, en fraccion de la foto")
    ap.add_argument("--margen", type=float, default=8.0,
                    help="cuanto agrandar la caja, en %% de su lado")
    ap.add_argument("--marcado", help="guarda una copia con las cajas dibujadas, para MIRARLA")
    a = ap.parse_args()

    im = Image.open(a.foto)
    ms, (W, H) = manchas(im, a.min_area)
    if not ms:
        print("no se encontro ninguna mancha de color: bajar --min-area o no es esta la foto")
        return 1
    print(f"{a.foto}  {W}x{H}   {len(ms)} manchas, de izquierda a derecha:\n")
    prueba = im.convert("RGB").copy() if a.marcado else None
    d = ImageDraw.Draw(prueba) if prueba else None
    for i, (nombre, x, y, w, h, area) in enumerate(ms, 1):
        mx_, my_ = w * a.margen / 100.0, h * a.margen / 100.0
        X, Y = max(0.0, x - mx_), max(0.0, y - my_)
        Wd, Hd = min(W - X, w + 2 * mx_), min(H - Y, h + 2 * my_)
        print(f"  {i}. {nombre:<9} --marca \"{X*100/W:.0f},{Y*100/H:.0f},"
              f"{Wd*100/W:.0f},{Hd*100/H:.0f}|<texto>\"     ({area} px)")
        if d:
            d.rectangle([X, Y, X + Wd, Y + Hd], outline=(206, 32, 32), width=max(2, W // 400))
            d.text((X + 4, Y + 4), str(i), fill=(206, 32, 32))
    if prueba:
        prueba.save(a.marcado, quality=92)
        print(f"\nprueba -> {a.marcado}   MIRALA: esto ubica, no aprueba.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# -*- coding: utf-8 -*-
"""El logo de Barack que hay en la biblioteca es de 151x75 px. Para una placa de 1080p
hay que agrandarlo ~3x y con un lanczos pelado las serifas quedan blandas.

Como es arte plano (un solo azul sobre transparencia), se puede agrandar sin que se note:
se interpola grande y despues se re-endurece el borde metiendo una rampa angosta en el
canal alfa (queda el antialias justo, sin la nube gris del interpolado) y se pisa el color
con el azul solido real del logo, asi no aparece halo claro alrededor de las letras.

Uso:  python logo_hd.py <ancho_destino> <salida.png>
"""
import os, sys
import numpy as np
from PIL import Image

ORIGEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "barack_logo.png")


def color_solido(im):
    """Color medio de los pixeles bien opacos: el azul real del logo."""
    a = np.asarray(im, dtype=np.float64)
    op = a[..., 3] > 200
    if not op.any():
        return np.array([0.0, 0.0, 0.0])
    return a[..., :3][op].mean(axis=0)


def rampa(alfa, ancho=0.16):
    """Endurece el borde: todo lo que estaba a medias se va a 0 o a 1, dejando una
    franja angosta de antialias alrededor del 50 %."""
    x = (alfa - 0.5) / ancho
    return np.clip(x * 0.5 + 0.5, 0.0, 1.0)


def main(ancho_dst, salida):
    im = Image.open(ORIGEN).convert("RGBA")
    w, h = im.size
    alto_dst = int(round(ancho_dst * h / w))

    grande = im.resize((ancho_dst * 4, alto_dst * 4), Image.LANCZOS)
    grande = grande.resize((ancho_dst, alto_dst), Image.LANCZOS)

    a = np.asarray(grande, dtype=np.float64) / 255.0
    alfa = rampa(a[..., 3])
    rgb = np.broadcast_to(color_solido(im) / 255.0, a[..., :3].shape).copy()

    out = np.concatenate([rgb, alfa[..., None]], axis=-1)
    Image.fromarray((np.clip(out, 0, 1) * 255).astype("uint8"), "RGBA").save(salida)
    print("logo %dx%d -> %dx%d  color %s  %s" % (
        w, h, ancho_dst, alto_dst,
        np.round(color_solido(im)).astype(int).tolist(), salida))


if __name__ == "__main__":
    main(int(sys.argv[1]), sys.argv[2])

# -*- coding: utf-8 -*-
"""Placa de apertura y de cierre del institucional: fondo claro de estudio + el logo real
de Barack, con entrada suave, un barrido de luz que le cruza por encima y una salida que
prepara la disolvencia hacia el primer plano de planta.

El fondo es CLARO a proposito: el logo de la casa es azul oscuro sobre transparencia (no
existe version en blanco) y sobre fondo oscuro no se leeria. Ademas la planta filmada es
muy blanca, asi que la disolvencia entra sin salto de luminancia.

Uso:  python placa.py entrada|salida <carpeta_destino>
"""
import sys, os, math
import numpy as np
from PIL import Image

W, H, FPS = 1920, 1080, 25
LOGO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logo_hd.png")
ANCHO_LOGO = 660                      # 4,4x el original: se lee grande sin desarmarse


def suave(x):
    """Rampa 0..1 con arranque y llegada sin golpe (smoothstep)."""
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def fondo():
    """Gris muy claro con una leve subida al centro y un tinte azul en los bordes."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    dx = (xx - W / 2) / (W / 2)
    dy = (yy - H / 2) / (H / 2)
    r = np.sqrt(dx ** 2 + dy ** 2 * 1.25)
    v = np.clip(1.0 - 0.22 * r ** 1.7, 0, 1)
    base = np.stack([v * 232, v * 235, v * 240], axis=-1)     # blanco apenas frio
    tinte = np.clip(r - 0.55, 0, None) * 26
    base[..., 0] -= tinte * 1.15
    base[..., 1] -= tinte * 0.75
    base[..., 2] -= tinte * 0.15                              # el borde se va al azul
    return np.clip(base, 0, 255)


def pegar(fondo_rgb, logo_rgba, cx, cy, alfa):
    """Compone el logo y devuelve su alfa en coordenadas del cuadro entero."""
    masc = np.zeros((H, W))
    lh, lw = logo_rgba.shape[:2]
    x0, y0 = int(cx - lw / 2), int(cy - lh / 2)
    x1, y1 = x0 + lw, y0 + lh
    sx0, sy0 = max(0, -x0), max(0, -y0)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0:
        return masc
    rec = logo_rgba[sy0:sy0 + (y1 - y0), sx0:sx0 + (x1 - x0)]
    a = (rec[..., 3:4] * alfa)
    fondo_rgb[y0:y1, x0:x1] = fondo_rgb[y0:y1, x0:x1] * (1 - a) + rec[..., :3] * 255 * a
    masc[y0:y1, x0:x1] = a[..., 0]
    return masc


_MASC = None


def _diagonal():
    """Coordenada 0..1 en diagonal, cacheada (se usa en todos los cuadros)."""
    global _MASC
    if _MASC is None:
        yy, xx = np.mgrid[0:H, 0:W]
        _MASC = (xx + (H - yy) * 0.45) / (W + H * 0.45)
    return _MASC


def barrido(img, pos, fuerza, mascara_logo):
    """Reflejo que cruza en diagonal. Va CASI TODO sobre las letras (como la luz corriendo
    por un metal) y apenas se insinua en el fondo: aplicado parejo sobre un fondo claro se
    satura en 255 y se ve como una mancha curva, no como un destello."""
    band = np.exp(-((_diagonal() - pos) / 0.070) ** 2) * fuerza
    sobre_logo = band * mascara_logo
    img = img + sobre_logo[..., None] * (255 - img) * 0.90
    img = img + band[..., None] * (255 - img) * 0.10
    return np.clip(img, 0, 255)


def render(tipo, destino):
    os.makedirs(destino, exist_ok=True)
    base = Image.open(LOGO).convert("RGBA")
    dur = 3.4 if tipo == "entrada" else 3.4
    n = int(dur * FPS)
    fnd = fondo()

    for i in range(n):
        t = i / FPS
        img = fnd.copy()

        if tipo == "entrada":
            a_logo = suave((t - 0.30) / 0.85)
            escala = 0.975 + 0.050 * suave(t / dur)
            desp = (1 - suave((t - 0.30) / 1.0)) * 16
            blanco = 1.0 - suave(t / 0.45)                 # arranca en blanco puro
            salida = suave((t - 2.80) / 0.60) * 0.35       # se abre hacia el primer plano
        else:
            a_logo = suave((t - 0.35) / 0.9) * (1 - suave((t - 2.35) / 0.75))
            escala = 1.0 + 0.035 * suave(t / dur)
            desp = 0.0
            blanco = 0.0
            salida = 0.0

        aw = int(ANCHO_LOGO * escala)
        ah = int(aw * base.size[1] / base.size[0])
        logo = np.asarray(base.resize((aw, ah), Image.LANCZOS), dtype=np.float64) / 255.0
        masc = pegar(img, logo, W / 2, H / 2 - 8 + desp, a_logo)

        if tipo == "entrada":
            p = (t - 1.05) / 1.10
            if 0.0 <= p <= 1.0:
                img = barrido(img, p * 1.25 - 0.12, 0.95 * math.sin(math.pi * p), masc)
            if blanco > 0:
                img = img * (1 - blanco) + 255 * blanco
            if salida > 0:
                img = img * (1 - salida) + 255 * salida
        else:
            fnegro = suave((t - 2.45) / 0.9)
            img = img * (1 - fnegro)

        Image.fromarray(np.clip(img, 0, 255).astype("uint8")).save(
            os.path.join(destino, "%04d.png" % i), compress_level=1)

    print("%s: %d cuadros (%.2f s) -> %s" % (tipo, n, n / FPS, destino))


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2])

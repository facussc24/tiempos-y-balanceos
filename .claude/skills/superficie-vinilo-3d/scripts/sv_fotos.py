# -*- coding: utf-8 -*-
"""sv_fotos.py — las "fotos del 3D pintado" que van a la presentacion.

Saca, con el motor foto3d del skill cad-design (trazado de rayos, camara ortografica, fondo
blanco; matplotlib esta rechazado para esto):

  <clave>_pintada.png    la piel pintada: AZUL lo que se ve, NARANJA el borde que se dobla.
                         VIOLETA = sin repartir: la piel entera cuando hay una sola, o la
                         segunda cara candidata cuando el STEP no trae piel (la primera va azul)
  <clave>_atras.png      lo mismo visto de atras: se ve el plastico gris y el borde alrededor
  <clave>_terminada.png  la pieza como queda (piel terminada en negro), si el STEP la trae

La camara NO se elige a ojo: mira de frente a la cara vista (direccion media de la piel a la
vista, medida). Se puede forzar con --elev/--azim.

Uso (Python de CAD):
  .venv-cad\\Scripts\\python.exe sv_fotos.py <modelo.npz> <clave_clases.npz> <carpeta_salida> --clave del [--elev 24 --azim 90]
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(AQUI, '..', '..', 'cad-design', 'scripts')))
import foto3d   # noqa: E402

AZUL, NARANJA, PLASTICO, OTROS, PIEL = '#2a7fd4', '#ff8c1a', '#c8c8c8', '#9a9a9a', '#3b3b3b'
SIN_CLASIFICAR = '#8e7cc3'      # violeta: no se confunde con el azul de "a la vista"


def recorte(im, margen=40):
    a = np.asarray(im); m = (a < 250).any(2)
    ys, xs = np.where(m)
    return im.crop((max(xs.min() - margen, 0), max(ys.min() - margen, 0),
                    min(xs.max() + margen, im.width), min(ys.max() + margen, im.height)))


def foto(esc, elev, azim, luz, relleno, sombra=True, px=(3200, 1700), ambiente=0.52):
    mn, mx = esc.bbox
    largo = float(np.linalg.norm(mx - mn))
    cam = foto3d.Camara((mn + mx) / 2, elev, azim, largo * 1.02, px=px)
    img, prof, ident = foto3d.render(esc, cam, sombra=sombra, luz=luz, relleno=relleno, ambiente=ambiente)
    img = foto3d.contornos(img, prof, ident, cam, fuerza=0.42)
    return recorte(Image.fromarray((img * 255).astype(np.uint8)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('modelo'); ap.add_argument('clases'); ap.add_argument('salida')
    ap.add_argument('--clave', default='pieza')
    ap.add_argument('--elev', type=float, default=None)
    ap.add_argument('--azim', type=float, default=None)
    a = ap.parse_args()
    os.makedirs(a.salida, exist_ok=True)

    ra, rb = foto3d.autotest_contornos()      # que el motor ande se prueba, no se asume
    if not (ra < 0.001 and rb > 0.005):
        raise SystemExit('el autotest del motor de imagen fallo (%.4f / %.4f)' % (ra, rb))

    z = np.load(a.modelo, allow_pickle=False); c = np.load(a.clases, allow_pickle=False)
    tri = z['V'][z['T']]
    principal = str(c['principal'])
    ptri = c['rec_tri'] if principal == 'rec' else c['term_tri']
    clase = c['clase']
    # Sin piel se pintan las caras candidatas del sustrato. Esos triangulos se SACAN del gris: dos
    # triangulos iguales, uno gris y uno azul, y el trazador muestra cualquiera de los dos (la cara
    # salia a parches: prueba a ciegas del 01/10/2026).
    candidatas = (c['cara_a'] | c['cara_b']) if not len(ptri) else np.zeros(len(tri), bool)
    sub = tri[(c['sub_rol'] == 1) & ~candidatas]; otros = tri[c['sub_rol'] == 0]

    # direccion de la camara: hacia donde mira la cara vista
    medida = True
    if len(ptri) and (clase == 1).any():
        v = ptri[clase == 1]
        n = np.cross(v[:, 1] - v[:, 0], v[:, 2] - v[:, 0])
        cs = tri[c['sub_rol'] == 1].reshape(-1, 3).mean(0)
        fuera = ((v.mean(1) - cs) * n).sum(1) < 0          # normal apuntando hacia el sustrato -> se da vuelta
        n[fuera] *= -1
        d = n.sum(0); d /= np.linalg.norm(d)
    else:
        medida = bool(c['cara_a'].any())
        cv = tri[c['cara_a']]
        n = np.cross(cv[:, 1] - cv[:, 0], cv[:, 2] - cv[:, 0]) if medida else np.array([[0, 1.0, 0.3]])
        d = n.sum(0); d /= np.linalg.norm(d)
    azim = a.azim if a.azim is not None else float(np.degrees(np.arctan2(d[1], d[0])))
    elev = a.elev if a.elev is not None else float(np.clip(np.degrees(np.arcsin(d[2])), 12, 60))
    luz_f = (np.cos(np.radians(azim)) * 0.55 - 0.25, np.sin(np.radians(azim)) * 0.55, 0.80)
    rel_f = (0.5, np.sin(np.radians(azim)) * 0.6, 0.1)
    origen = ('forzada' if (a.elev is not None or a.azim is not None) else
              'medida sobre la cara vista' if medida else 'POR DEFECTO: no hay cara vista medida, usar --elev y --azim')
    print('camara: elevacion %.0f, azimut %.0f (%s)' % (elev, azim, origen))

    def escena(pintada):
        e = foto3d.Escena(); e.agregar(sub, PLASTICO)
        if len(otros):
            e.agregar(otros, OTROS)
        if pintada and len(ptri):
            e.agregar(ptri[clase == 1], AZUL); e.agregar(ptri[clase >= 2], NARANJA)
            e.agregar(ptri[clase == 0], SIN_CLASIFICAR)      # piel sin reparto vista/doblez (TBD): no se pinta como doblez
        elif pintada:
            e.agregar(tri[c['cara_a']], AZUL); e.agregar(tri[c['cara_b']], SIN_CLASIFICAR)      # las dos candidatas
        return e

    e = escena(True).compilar()
    foto(e, elev, azim, luz_f, rel_f).save(os.path.join(a.salida, a.clave + '_pintada.png'))
    foto(e, 16, azim + 180, (-luz_f[0], -luz_f[1], 0.80), (-rel_f[0], -rel_f[1], 0.1), sombra=False, ambiente=0.62
         ).save(os.path.join(a.salida, a.clave + '_atras.png'))
    if len(c['term_tri']):
        e2 = foto3d.Escena(); e2.agregar(sub, PLASTICO)
        if len(otros):
            e2.agregar(otros, OTROS)
        e2.agregar(c['term_tri'], PIEL); e2.compilar()
        foto(e2, elev, azim, luz_f, rel_f).save(os.path.join(a.salida, a.clave + '_terminada.png'))
    print('ok: %s_pintada.png, %s_atras.png%s' % (a.clave, a.clave, ', %s_terminada.png' % a.clave if len(c['term_tri']) else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())

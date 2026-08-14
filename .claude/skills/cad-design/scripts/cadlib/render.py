# -*- coding: utf-8 -*-
"""Render unificado: vistas 3D sombreadas por capas + secciones planas.

Una sola implementacion de shade/render/secciones (antes copiada en 4 scripts).
"""
import numpy as np

from . import envcheck

envcheck.require(("matplotlib",))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

DEFAULT_VIEWS = {
    "iso": (28, -55),
    "iso2": (25, 130),
    "front": (0, -90),
    "top": (89.9, -90),
    "side": (0, 0),
}
PALETTE = ["#4a7ebb", "#e07b39", "#6aa84f", "#a64d79", "#7f8c8d"]

# Dos calidades, a proposito (medido el 2026-08-14 sobre las 6 sesiones mas grandes):
# leer renders propios era el 59% de TODO lo que entraba al contexto — 145 lecturas de
# 283 KB. Eran 5 archivos de 1540x990 por cada mirada, y se leian los 5.
#   LECTURA -> una sola hoja de contacto, la que mira el modelo. Alcanza para ver si algo
#              encaja o choca; lo que DECIDE es el numero de gate_ensamble, no la imagen.
#   ALTA    -> la que mira Fak (GATE 0, mapas de zona, antes/despues). Persona, no modelo.
DPI_LECTURA, FIGSIZE_LECTURA = 72, (7.0, 5.0)
DPI_ALTA, FIGSIZE_ALTA = 110, (14.0, 9.0)
# Los plots 2D anotados (planta/corte del gate) llevan texto de 8 pt: por debajo de 90 dpi
# la anotacion queda de 8 px y no se lee. El limite lo pone la letra, no la geometria.
DPI_PLOT = 90


def shade(tris, base, light=(0.35, -0.5, 0.8)):
    """Color por triangulo segun orientacion vs luz (iluminado plano simple)."""
    light = np.asarray(light, dtype=float)
    v1 = tris[:, 1] - tris[:, 0]
    v2 = tris[:, 2] - tris[:, 0]
    n = np.cross(v1, v2)
    nn = np.linalg.norm(n, axis=1, keepdims=True)
    nn[nn == 0] = 1
    n = n / nn
    ln = light / np.linalg.norm(light)
    inten = 0.5 + 0.5 * np.abs(n @ ln)
    base = np.array(matplotlib.colors.to_rgb(base))
    return np.clip(base * inten[:, None], 0, 1)


def _dibujar(ax, layers, points, ctr, span, elev, azim, titulo):
    """Pinta una vista sobre unos ejes ya creados. Encuadre comun a todas las vistas."""
    for tris, color, alpha in layers:
        if len(tris) == 0:
            continue
        pc = Poly3DCollection(tris, facecolors=shade(tris, color), edgecolor="none", alpha=alpha)
        ax.add_collection3d(pc)
    if points:
        for pts, color, label in points:
            if len(pts):
                ax.scatter(pts[:, 0], pts[:, 1], pts[:, 2], c=color, s=6, depthshade=False, label=label)
        ax.legend(loc="best", fontsize="small")
    ax.set_xlim(ctr[0] - span / 2, ctr[0] + span / 2)
    ax.set_ylim(ctr[1] - span / 2, ctr[1] + span / 2)
    ax.set_zlim(ctr[2] - span / 2, ctr[2] + span / 2)
    ax.set_box_aspect((1, 1, 1))
    ax.view_init(elev=elev, azim=azim)
    ax.set_proj_type("ortho")
    ax.set_xlabel("X")
    ax.set_ylabel("Y")
    ax.set_zlabel("Z")
    ax.set_title(titulo)


def render_views(layers, out_prefix, views=None, title="", points=None,
                 dpi=None, figsize=None, alta=False):
    """layers=[(tris, color, alpha)]; points=[(pts, color, label)] (ej. choques en rojo).

    Por default arma UNA hoja de contacto <out_prefix>_TODAS.png con todas las vistas en
    grilla: es la que se mira para juzgar, y cuesta ~10x menos que leer las vistas sueltas.
    Con una sola vista el nombre sigue siendo <out_prefix>_<vista>.png, como antes.

    alta=True -> resolucion de entregable (la que mira Fak) Y ademas cada vista en su
    archivo, para poder mirar una de cerca. dpi/figsize explicitos siempre mandan.

    Devuelve la lista de archivos generados.
    """
    views = views or DEFAULT_VIEWS
    if dpi is None:
        dpi = DPI_ALTA if alta else DPI_LECTURA
    if figsize is None:
        figsize = FIGSIZE_ALTA if alta else FIGSIZE_LECTURA
    allp = np.concatenate([np.asarray(t).reshape(-1, 3) for t, _, _ in layers if len(t)])
    mins, maxs = allp.min(0), allp.max(0)
    ctr = (mins + maxs) / 2
    span = (maxs - mins).max() * 1.03

    files = []
    nombres = list(views.items())
    # Con una sola vista la hoja de contacto ES la vista: no duplicar el trabajo.
    sueltas = alta or len(nombres) == 1

    if len(nombres) > 1:
        cols = 2 if len(nombres) <= 4 else 3
        filas = -(-len(nombres) // cols)
        # tamano POR CASILLA, no reescalado del figsize de una vista sola: con 3D
        # tight_layout no acomoda bien y los titulos terminan pisando los ejes de arriba.
        fig = plt.figure(figsize=(cols * 3.6, filas * 3.2 + (0.4 if title else 0)), dpi=dpi)
        for i, (vname, (elev, azim)) in enumerate(nombres, start=1):
            ax = fig.add_subplot(filas, cols, i, projection="3d")
            ax.tick_params(labelsize=6, pad=0)
            _dibujar(ax, layers, points, ctr, span, elev, azim, vname)
            ax.xaxis.label.set_size(7)
            ax.yaxis.label.set_size(7)
            ax.zaxis.label.set_size(7)
        if title:
            fig.suptitle(title, fontsize=11)
        fig.subplots_adjust(left=0.01, right=0.99, wspace=0.02, hspace=0.22,
                            top=(0.90 if title else 0.96), bottom=0.02)
        out = "%s_TODAS.png" % out_prefix
        fig.savefig(out)
        plt.close(fig)
        files.append(out)

    if sueltas:
        for vname, (elev, azim) in nombres:
            fig = plt.figure(figsize=figsize, dpi=dpi)
            ax = fig.add_subplot(111, projection="3d")
            _dibujar(ax, layers, points, ctr, span, elev, azim,
                     ("%s — %s" % (title, vname)) if title else vname)
            plt.tight_layout()
            out = "%s_%s.png" % (out_prefix, vname)
            fig.savefig(out, bbox_inches="tight")
            plt.close(fig)
            files.append(out)
    return files


def section_segments(tris, axis, c0):
    """Segmentos de interseccion de la malla con el plano axis=c0 (pares de puntos 2D)."""
    tris = np.asarray(tris)
    others = [i for i in range(3) if i != axis]
    segs = []
    dd_all = tris[:, :, axis] - c0
    mask = ~((dd_all > 0).all(axis=1) | (dd_all < 0).all(axis=1))
    for tri, dd in zip(tris[mask], dd_all[mask]):
        pts = []
        for i in range(3):
            j = (i + 1) % 3
            di, dj = dd[i], dd[j]
            if di == 0:
                pts.append(tri[i][others])
            if di * dj < 0:
                t = di / (di - dj)
                p = tri[i] + t * (tri[j] - tri[i])
                pts.append(p[others])
        if len(pts) >= 2:
            segs.append((pts[0], pts[1]))
    return segs


def render_section(section_layers, out_path, title="", xlabel="", ylabel="", scatter=None,
                   dpi=None, figsize=None, alta=False):
    """section_layers=[(segs, color, lw, label)]; scatter=(pts2d, color, label) opcional.

    Misma logica de calidad que render_views: baja para mirar, alta para entregar.
    """
    if dpi is None:
        dpi = DPI_ALTA if alta else DPI_LECTURA
    if figsize is None:
        figsize = (12.0, 9.0) if alta else (8.0, 6.0)
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    if scatter is not None:
        pts2d, color, label = scatter
        if len(pts2d):
            ax.scatter(pts2d[:, 0], pts2d[:, 1], s=1.5, c=color, label=label)
    for segs, color, lw, label in section_layers:
        first = True
        for a, b in segs:
            ax.plot([a[0], b[0]], [a[1], b[1]], color=color, lw=lw, label=(label if first else None))
            first = False
    ax.set_aspect("equal")
    ax.grid(alpha=0.3)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.legend(loc="best")
    fig.savefig(out_path, bbox_inches="tight")
    plt.close(fig)
    return out_path

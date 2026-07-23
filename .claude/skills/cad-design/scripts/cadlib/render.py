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


def render_views(layers, out_prefix, views=None, title="", points=None, dpi=110, figsize=(14, 9)):
    """layers=[(tris, color, alpha)]; points=[(pts, color, label)] (ej. choques en rojo).

    Genera <out_prefix>_<vista>.png por cada vista. Devuelve la lista de archivos.
    """
    views = views or DEFAULT_VIEWS
    allp = np.concatenate([np.asarray(t).reshape(-1, 3) for t, _, _ in layers if len(t)])
    mins, maxs = allp.min(0), allp.max(0)
    ctr = (mins + maxs) / 2
    span = (maxs - mins).max() * 1.03
    files = []
    for vname, (elev, azim) in views.items():
        fig = plt.figure(figsize=figsize, dpi=dpi)
        ax = fig.add_subplot(111, projection="3d")
        for tris, color, alpha in layers:
            if len(tris) == 0:
                continue
            pc = Poly3DCollection(tris, facecolors=shade(tris, color), edgecolor="none", alpha=alpha)
            ax.add_collection3d(pc)
        if points:
            for pts, color, label in points:
                if len(pts):
                    ax.scatter(pts[:, 0], pts[:, 1], pts[:, 2], c=color, s=6, depthshade=False, label=label)
            ax.legend(loc="best")
        ax.set_xlim(ctr[0] - span / 2, ctr[0] + span / 2)
        ax.set_ylim(ctr[1] - span / 2, ctr[1] + span / 2)
        ax.set_zlim(ctr[2] - span / 2, ctr[2] + span / 2)
        ax.set_box_aspect((1, 1, 1))
        ax.view_init(elev=elev, azim=azim)
        ax.set_proj_type("ortho")
        ax.set_xlabel("X")
        ax.set_ylabel("Y")
        ax.set_zlabel("Z")
        ax.set_title(("%s — %s" % (title, vname)) if title else vname)
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


def render_section(section_layers, out_path, title="", xlabel="", ylabel="", scatter=None, dpi=110, figsize=(12, 9)):
    """section_layers=[(segs, color, lw, label)]; scatter=(pts2d, color, label) opcional."""
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

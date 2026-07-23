# -*- coding: utf-8 -*-
# EJEMPLO HISTORICO — caso Posicionador Top Roll Trasero (2026-07). Rutas muertas, NO CORRER.
# Version generica: scripts/render_sections.py · parametros del caso: params_posicionador.json
"""Secciones del conjunto top roll + posicionador en frame posicionador (Z = bajada).
Convencion register_v2: pos_pts - T = frame auto  =>  frame posicionador = auto + T."""
import numpy as np
import gmsh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

D = r"C:\Users\facun\AppData\Local\Temp\claude\C--Dev-BarackMercosul\50f3d407-417a-4fe2-9827-45c2643c1cf3\scratchpad\posicionador"

def mesh_tris(path, lc, keep_vols=None):
    gmsh.initialize()
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("m")
    gmsh.model.occ.importShapes(path)
    gmsh.model.occ.synchronize()
    if keep_vols is not None:
        vols = gmsh.model.getEntities(3)
        drop = [(d, t) for d, t in vols if t not in keep_vols]
        if drop:
            gmsh.model.occ.remove(drop, recursive=True)
            gmsh.model.occ.synchronize()
    gmsh.option.setNumber("Mesh.MeshSizeMax", lc)
    gmsh.option.setNumber("Mesh.MeshSizeMin", lc * 0.4)
    gmsh.model.mesh.generate(2)
    tris = []
    for dim, tag in gmsh.model.getEntities(2):
        etypes, etags, enodes = gmsh.model.mesh.getElements(2, tag)
        for et, en in zip(etypes, enodes):
            if et == 2:
                ids = np.array(en).reshape(-1, 3)
                for row in ids:
                    tris.append([gmsh.model.mesh.getNode(n)[0] for n in row])
    gmsh.finalize()
    return np.array(tris)

def sample_points(path, keep_vols=None, n=30):
    gmsh.initialize()
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("m")
    gmsh.model.occ.importShapes(path)
    gmsh.model.occ.synchronize()
    if keep_vols is not None:
        vols = gmsh.model.getEntities(3)
        drop = [(d, t) for d, t in vols if t not in keep_vols]
        if drop:
            gmsh.model.occ.remove(drop, recursive=True)
            gmsh.model.occ.synchronize()
    out = []
    for dim, tag in gmsh.model.getEntities(2):
        try:
            (umin, vmin), (umax, vmax) = gmsh.model.getParametrizationBounds(2, tag)
            us = np.linspace(umin, umax, n)
            vs = np.linspace(vmin, vmax, n)
            uu, vv = np.meshgrid(us, vs)
            params = np.column_stack([uu.ravel(), vv.ravel()])
            xyz = np.array(gmsh.model.getValue(2, tag, params.ravel())).reshape(-1, 3)
            inside = np.array([gmsh.model.isInside(2, tag, p, parametric=True) for p in params], dtype=bool)
            out.append(xyz[inside])
        except Exception:
            continue
    gmsh.finalize()
    return np.concatenate(out)

def section_segments(tris, axis, c0):
    """Segmentos de interseccion de la malla con plano axis=c0; devuelve pares de puntos 2D (otros ejes)."""
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

print("mallando posicionador...")
pos_tris = mesh_tris(D + r"\posicionador_v1.step", 1.5)
print("mallando esqueleto...")
T_skel = np.load(D + r"\T_skeleton.npy")
skel_tris = mesh_tris(D + r"\toproll_tras_skeleton.step", 2.0, keep_vols={2}) + T_skel
print("muestreando pieza completa...")
T_full = np.load(D + r"\T_full_v1.npy")
full_pts = sample_points(D + r"\toproll_tras_full.stp", keep_vols={1}) + T_full
np.save(D + r"\full_pts_posframe.npy", full_pts)
print(f"pos {len(pos_tris)} tris | skel {len(skel_tris)} tris | full {len(full_pts)} pts")

stations_X = [-240, -210, -180, -150, -120, -95, 445, 460, 480, 500]
for x0 in stations_X:
    fig, ax = plt.subplots(figsize=(12, 9), dpi=110)
    sel = np.abs(full_pts[:, 0] - x0) < 0.6
    ax.scatter(full_pts[sel, 1], full_pts[sel, 2], s=1.5, c="#b8b8b8", label="pieza completa (tapizada)")
    for segs, col, lw, lab in ((section_segments(skel_tris, 0, x0), "#444444", 1.2, "esqueleto"),
                               (section_segments(pos_tris, 0, x0), "#d9534f", 1.6, "posicionador")):
        first = True
        for a, b in segs:
            ax.plot([a[0], b[0]], [a[1], b[1]], color=col, lw=lw, label=(lab if first else None))
            first = False
    ax.set_aspect("equal")
    ax.grid(alpha=0.3)
    ax.set_xlabel("Y (mm)")
    ax.set_ylabel("Z (mm)  — bajada = -Z")
    ax.set_title(f"Seccion X={x0} mm (frame posicionador)")
    ax.legend(loc="best")
    fig.savefig(D + f"\\sec_X{x0}.png", bbox_inches="tight")
    plt.close(fig)
    print(f"saved sec_X{x0}.png")

# seccion longitudinal por el centro de la lengueta del solido 2 (Y=0) y por Y=20
for y0 in (0.0, 20.0):
    fig, ax = plt.subplots(figsize=(16, 7), dpi=110)
    sel = np.abs(full_pts[:, 1] - y0) < 0.6
    ax.scatter(full_pts[sel, 0], full_pts[sel, 2], s=1.5, c="#b8b8b8", label="pieza completa")
    for segs, col, lw, lab in ((section_segments(skel_tris, 1, y0), "#444444", 1.0, "esqueleto"),
                               (section_segments(pos_tris, 1, y0), "#d9534f", 1.5, "posicionador")):
        first = True
        for a, b in segs:
            ax.plot([a[0], b[0]], [a[1], b[1]], color=col, lw=lw, label=(lab if first else None))
            first = False
    ax.set_aspect("equal")
    ax.grid(alpha=0.3)
    ax.set_xlabel("X (mm)")
    ax.set_ylabel("Z (mm)")
    ax.set_title(f"Seccion longitudinal Y={y0} mm")
    ax.legend(loc="best")
    fig.savefig(D + f"\\sec_Y{int(y0)}.png", bbox_inches="tight")
    plt.close(fig)
    print(f"saved sec_Y{int(y0)}.png")

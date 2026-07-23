# -*- coding: utf-8 -*-
# EJEMPLO HISTORICO — caso Posicionador Top Roll Trasero (2026-07). Rutas muertas, NO CORRER.
# Version generica: scripts/render_step.py (multi-archivo) · parametros del caso: params_posicionador.json
"""Render del conjunto (top roll + cabezal + empujador) en varias vistas, colores
distintos por pieza. Proof visual para Fak."""
import os
import numpy as np
import gmsh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

D = r"C:\Users\facun\AppData\Local\Temp\claude\C--Dev-BarackMercosul\50f3d407-417a-4fe2-9827-45c2643c1cf3\scratchpad\posicionador"
V2 = os.path.join(D, "v2")
DESK = r"C:\Users\facun\OneDrive\Escritorio\Posicionador TopRoll Trasero v2"

def mesh_solids(path, lc=2.5):
    gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("m"); gmsh.model.occ.importShapes(path); gmsh.model.occ.synchronize()
    gmsh.option.setNumber("Mesh.MeshSizeMax", lc); gmsh.option.setNumber("Mesh.MeshSizeMin", lc*0.5)
    gmsh.model.mesh.generate(2)
    solids = []
    for dim, tag in gmsh.model.getEntities(3):
        _, sdown = gmsh.model.getAdjacencies(dim, tag)
        tris = []
        for st in sdown:
            et, _, en = gmsh.model.mesh.getElements(2, st)
            for e, n in zip(et, en):
                if e == 2:
                    ids = np.array(n).reshape(-1, 3)
                    for row in ids:
                        tris.append([gmsh.model.mesh.getNode(x)[0] for x in row])
        bb = gmsh.model.getBoundingBox(dim, tag)
        solids.append((np.array(tris), bb))
    gmsh.finalize()
    return solids

def shade(tris, base, light=np.array([0.35, -0.5, 0.8])):
    v1 = tris[:, 1]-tris[:, 0]; v2 = tris[:, 2]-tris[:, 0]
    n = np.cross(v1, v2); nn = np.linalg.norm(n, axis=1, keepdims=True); nn[nn == 0] = 1
    n = n/nn; ln = light/np.linalg.norm(light)
    inten = 0.5 + 0.5*np.abs(n @ ln)
    base = np.array(matplotlib.colors.to_rgb(base))
    return np.clip(base*inten[:, None], 0, 1)

solids = mesh_solids(os.path.join(V2, "conjunto_v2_con_toproll.step"))
# identificar por bbox: top roll (mas ancho en X), cabezal (X min), empujador (X max)
solids.sort(key=lambda s: s[1][0])  # por X min
# el top roll es el de mayor extension X
spans = [(s[1][3]-s[1][0], i) for i, s in enumerate(solids)]
top_i = max(spans)[1]
colors = {}
for i, (tris, bb) in enumerate(solids):
    if i == top_i:
        colors[i] = "#7f8c8d"  # top roll gris
    elif bb[0] < 0:
        colors[i] = "#2980b9"  # cabezal azul
    else:
        colors[i] = "#e67e22"  # empujador naranja

allp = np.concatenate([s[0].reshape(-1, 3) for s in solids])
mins, maxs = allp.min(0), allp.max(0); ctr = (mins+maxs)/2; span = (maxs-mins).max()*1.02

views = {"iso": (26, -60), "iso2": (24, 120), "frente": (8, -90), "arriba": (78, -90), "lateral": (4, 0)}
for vname, (elev, azim) in views.items():
    fig = plt.figure(figsize=(17, 9), dpi=110)
    ax = fig.add_subplot(111, projection="3d")
    for i, (tris, bb) in enumerate(solids):
        al = 0.5 if i == top_i else 1.0
        pc = Poly3DCollection(tris, facecolors=shade(tris, colors[i]), edgecolor="none", alpha=al)
        ax.add_collection3d(pc)
    ax.set_xlim(ctr[0]-span/2, ctr[0]+span/2); ax.set_ylim(ctr[1]-span/2, ctr[1]+span/2); ax.set_zlim(ctr[2]-span/2, ctr[2]+span/2)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=elev, azim=azim); ax.set_proj_type("ortho")
    ax.set_xlabel("X"); ax.set_ylabel("Y"); ax.set_zlabel("Z")
    ax.set_title(f"Conjunto — top roll (gris) + cabezal (azul) + empujador (naranja) — {vname}")
    plt.tight_layout()
    fig.savefig(os.path.join(V2, f"conjunto_{vname}.png"), bbox_inches="tight")
    plt.close(fig)
    print(f"saved conjunto_{vname}.png")

# render final del empujador medio y cabezal (post-fix) para reemplazar los viejos
for path, name, col in ((os.path.join(V2, "empujador_pico_v2_medio_+8deg.step"), "empujador_v2_medio_iso", "#5a8ac6"),
                        (os.path.join(V2, "cabezal_posicionador_v2.step"), "cabezal_v2_iso", "#5a8ac6")):
    ss = mesh_solids(path, 1.8)
    tris = ss[0][0]
    p = tris.reshape(-1, 3); mn, mx = p.min(0), p.max(0); ct = (mn+mx)/2; sp = (mx-mn).max()*1.05
    for suf, (elev, azim) in (("", (28, -55)), ("_b", (30, 125))):
        fig = plt.figure(figsize=(11, 8), dpi=110)
        ax = fig.add_subplot(111, projection="3d")
        ax.add_collection3d(Poly3DCollection(tris, facecolors=shade(tris, col), edgecolor="none"))
        ax.set_xlim(ct[0]-sp/2, ct[0]+sp/2); ax.set_ylim(ct[1]-sp/2, ct[1]+sp/2); ax.set_zlim(ct[2]-sp/2, ct[2]+sp/2)
        ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=elev, azim=azim); ax.set_proj_type("ortho")
        ax.set_title(name)
        fig.savefig(os.path.join(V2, name+suf+".png"), bbox_inches="tight")
        plt.close(fig)
    print(f"saved {name}(.+_b).png")
print("RENDERS LISTOS")

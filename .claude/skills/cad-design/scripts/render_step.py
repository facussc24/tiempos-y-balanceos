# -*- coding: utf-8 -*-
"""Malla un STEP con gmsh y renderiza vistas ortograficas + isometrica con matplotlib."""
import sys, math
import numpy as np
import gmsh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

path = sys.argv[1]
out_prefix = sys.argv[2]
lc = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0

gmsh.initialize()
gmsh.option.setNumber("General.Terminal", 0)
gmsh.model.add("m")
gmsh.model.occ.importShapes(path)
gmsh.model.occ.synchronize()
gmsh.option.setNumber("Mesh.MeshSizeMax", lc)
gmsh.option.setNumber("Mesh.MeshSizeMin", lc * 0.4)
gmsh.model.mesh.generate(2)

vols = gmsh.model.getEntities(3)
solids = []
for dim, tag in vols:
    _, sdown = gmsh.model.getAdjacencies(dim, tag)
    tris_all = []
    for st in sdown:
        etypes, etags, enodes = gmsh.model.mesh.getElements(2, st)
        for et, en in zip(etypes, enodes):
            if et == 2:  # triangle
                node_ids = np.array(en).reshape(-1, 3)
                coords = []
                for row in node_ids:
                    pts = []
                    for nid in row:
                        c, _, _, _ = gmsh.model.mesh.getNode(nid)
                        pts.append(c)
                    coords.append(pts)
                tris_all.extend(coords)
    solids.append(np.array(tris_all))
    print(f"solid tag={tag}: {len(tris_all)} tris")
gmsh.finalize()

# limites globales
allpts = np.concatenate([s.reshape(-1, 3) for s in solids])
mins, maxs = allpts.min(0), allpts.max(0)
center = (mins + maxs) / 2
span = (maxs - mins).max()

colors = ["#4a7ebb", "#e07b39", "#6aa84f", "#a64d79"]

def shade(tris, base_rgb, light=np.array([0.4, -0.6, 0.7])):
    v1 = tris[:, 1] - tris[:, 0]
    v2 = tris[:, 2] - tris[:, 0]
    n = np.cross(v1, v2)
    norm = np.linalg.norm(n, axis=1, keepdims=True)
    norm[norm == 0] = 1
    n = n / norm
    lightn = light / np.linalg.norm(light)
    inten = 0.45 + 0.55 * np.abs(n @ lightn)
    base = np.array(matplotlib.colors.to_rgb(base_rgb))
    return np.clip(base * inten[:, None], 0, 1)

views = {
    "iso": (28, -55),
    "front_-Y": (0, -90),
    "top": (89.9, -90),
    "side_+X": (0, 0),
    "iso2": (25, 130),
}

for vname, (elev, azim) in views.items():
    fig = plt.figure(figsize=(14, 9), dpi=110)
    ax = fig.add_subplot(111, projection="3d")
    for i, tris in enumerate(solids):
        fc = shade(tris, colors[i % len(colors)])
        pc = Poly3DCollection(tris, facecolors=fc, edgecolor="none")
        ax.add_collection3d(pc)
    ax.set_xlim(center[0] - span / 2, center[0] + span / 2)
    ax.set_ylim(center[1] - span / 2, center[1] + span / 2)
    ax.set_zlim(center[2] - span / 2, center[2] + span / 2)
    ax.set_box_aspect((1, 1, 1))
    ax.view_init(elev=elev, azim=azim)
    ax.set_proj_type("ortho")
    ax.set_xlabel("X"); ax.set_ylabel("Y"); ax.set_zlabel("Z")
    ax.set_title(f"{vname}")
    plt.tight_layout()
    fig.savefig(f"{out_prefix}_{vname}.png", bbox_inches="tight")
    plt.close(fig)
    print(f"saved {out_prefix}_{vname}.png")

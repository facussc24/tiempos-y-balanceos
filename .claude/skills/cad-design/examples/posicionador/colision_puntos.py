# -*- coding: utf-8 -*-
# EJEMPLO HISTORICO — caso Posicionador Top Roll Trasero (2026-07). Rutas muertas, NO CORRER.
# Version generica: scripts/check_collision.py --render · parametros del caso: params_posicionador.json
"""Localiza EXACTAMENTE los puntos del sustrato rigido que estan dentro del empujador
medio, y los renderiza sobre el empujador. Asi se ve donde esta el choque real."""
import os
import numpy as np
import gmsh
import trimesh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

D = r"C:\Users\facun\AppData\Local\Temp\claude\C--Dev-BarackMercosul\50f3d407-417a-4fe2-9827-45c2643c1cf3\scratchpad\posicionador"
V2 = os.path.join(D, "v2")
T = np.load(D + r"\T_skeleton.npy")

def mesh_tris(path, lc, keep=None, translate=None):
    gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("m"); gmsh.model.occ.importShapes(path); gmsh.model.occ.synchronize()
    vols = gmsh.model.getEntities(3)
    if keep is not None:
        gmsh.model.occ.remove([(3, t) for _, t in vols if t not in keep], recursive=True); gmsh.model.occ.synchronize()
    if translate:
        for _, t in gmsh.model.getEntities(3):
            gmsh.model.occ.translate([(3, t)], *translate)
        gmsh.model.occ.synchronize()
    gmsh.option.setNumber("Mesh.MeshSizeMax", lc); gmsh.option.setNumber("Mesh.MeshSizeMin", lc*0.4)
    gmsh.model.mesh.generate(2)
    tris = []
    for dim, tag in gmsh.model.getEntities(2):
        et, _, en = gmsh.model.mesh.getElements(2, tag)
        for e, n in zip(et, en):
            if e == 2:
                ids = np.array(n).reshape(-1, 3)
                for row in ids:
                    tris.append([gmsh.model.mesh.getNode(x)[0] for x in row])
    gmsh.finalize()
    return np.array(tris)

emp_tris = mesh_tris(os.path.join(V2, "empujador_pico_v2_medio_+8deg.step"), 1.2)
v = emp_tris.reshape(-1, 3); f = np.arange(len(v)).reshape(-1, 3)
m = trimesh.Trimesh(vertices=v, faces=f); m.merge_vertices(); m.process()

skel_tris = mesh_tris(D + r"\toproll_tras_skeleton.step", 1.0, keep={2}, translate=(T[0], T[1], T[2]))
skel_pts = np.unique(skel_tris.reshape(-1, 3), axis=0)
zone = (skel_pts[:, 0] > 455) & (skel_pts[:, 0] < 505)
zp = skel_pts[zone]

def contains_b(m, pts, b=2000):
    o = np.zeros(len(pts), bool)
    for i in range(0, len(pts), b):
        o[i:i+b] = m.contains(pts[i:i+b])
    return o

inside = contains_b(m, zp)
coll = zp[inside]
print(f"puntos del sustrato rigido DENTRO del empujador medio: {len(coll)}")
if len(coll):
    print(f"  zona colision: X[{coll[:,0].min():.1f},{coll[:,0].max():.1f}] Y[{coll[:,1].min():.1f},{coll[:,1].max():.1f}] Z[{coll[:,2].min():.1f},{coll[:,2].max():.1f}]")
    # reparto por X
    h, e = np.histogram(coll[:, 0], bins=10)
    for hh, e0, e1 in zip(h, e[:-1], e[1:]):
        print(f"    X[{e0:.0f},{e1:.0f}]: {hh}")

def shade(tris, base, light=np.array([0.35, -0.5, 0.8])):
    v1 = tris[:, 1]-tris[:, 0]; v2 = tris[:, 2]-tris[:, 0]
    n = np.cross(v1, v2); nn = np.linalg.norm(n, axis=1, keepdims=True); nn[nn == 0] = 1
    n = n/nn; ln = light/np.linalg.norm(light); inten = 0.5+0.5*np.abs(n @ ln)
    base = np.array(matplotlib.colors.to_rgb(base)); return np.clip(base*inten[:, None], 0, 1)

# render: empujador semi + puntos de colision en rojo + pared del pico
for suf, (elev, azim) in (("iso", (22, -70)), ("top", (85, -90)), ("lat", (5, 0))):
    fig = plt.figure(figsize=(13, 10), dpi=115)
    ax = fig.add_subplot(111, projection="3d")
    ax.add_collection3d(Poly3DCollection(emp_tris, facecolors=shade(emp_tris, "#9ecae1"), edgecolor="none", alpha=0.25))
    # pared del pico (esqueleto) en la zona
    sk_zone = skel_tris[(skel_tris[:, :, 0] > 455).all(1) & (skel_tris[:, :, 0] < 505).all(1)]
    ax.add_collection3d(Poly3DCollection(sk_zone, facecolors=shade(sk_zone, "#bbbbbb"), edgecolor="none", alpha=0.35))
    if len(coll):
        ax.scatter(coll[:, 0], coll[:, 1], coll[:, 2], c="red", s=6, depthshade=False, label=f"choque ({len(coll)} pts)")
    allp = emp_tris.reshape(-1, 3)
    mn, mx = allp.min(0), allp.max(0); ct = (mn+mx)/2; sp = (mx-mn).max()*1.05
    ax.set_xlim(ct[0]-sp/2, ct[0]+sp/2); ax.set_ylim(ct[1]-sp/2, ct[1]+sp/2); ax.set_zlim(ct[2]-sp/2, ct[2]+sp/2)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=elev, azim=azim); ax.set_proj_type("ortho")
    ax.set_xlabel("X"); ax.set_ylabel("Y"); ax.set_zlabel("Z")
    ax.set_title(f"Choque empujador MEDIO vs pared rigida del pico (rojo) — {suf}")
    ax.legend()
    fig.savefig(os.path.join(V2, f"choque_{suf}.png"), bbox_inches="tight")
    plt.close(fig)
    print(f"saved choque_{suf}.png")

# -*- coding: utf-8 -*-
"""Chequeo de colision: el empujador v2 (medio y fuerte) contra el SUSTRATO RIGIDO
(esqueleto), no contra el tapizado. Si penetra el esqueleto = colision dura (la parte
rigida no se comprime). Ademas identifica los 3 solidos del modelo completo (clips?)."""
import os
import numpy as np
import gmsh
import trimesh

D = r"C:\Users\facun\AppData\Local\Temp\claude\C--Dev-BarackMercosul\50f3d407-417a-4fe2-9827-45c2643c1cf3\scratchpad\posicionador"
V2 = os.path.join(D, "v2")
T = np.load(D + r"\T_skeleton.npy")

def solids_tris(path, lc=1.5, keep=None, translate=None):
    gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("m"); gmsh.model.occ.importShapes(path); gmsh.model.occ.synchronize()
    vols = gmsh.model.getEntities(3)
    if keep is not None:
        gmsh.model.occ.remove([(3, t) for _, t in vols if t not in keep], recursive=True)
        gmsh.model.occ.synchronize()
    if translate is not None:
        for _, t in gmsh.model.getEntities(3):
            gmsh.model.occ.translate([(3, t)], *translate)
        gmsh.model.occ.synchronize()
    gmsh.option.setNumber("Mesh.MeshSizeMax", lc); gmsh.option.setNumber("Mesh.MeshSizeMin", lc*0.4)
    gmsh.model.mesh.generate(2)
    out = {}
    for dim, tag in gmsh.model.getEntities(3):
        _, sd = gmsh.model.getAdjacencies(dim, tag)
        tris = []
        for st in sd:
            et, _, en = gmsh.model.mesh.getElements(2, st)
            for e, n in zip(et, en):
                if e == 2:
                    ids = np.array(n).reshape(-1, 3)
                    for row in ids:
                        tris.append([gmsh.model.mesh.getNode(x)[0] for x in row])
        out[tag] = (np.array(tris), gmsh.model.getBoundingBox(dim, tag))
    gmsh.finalize()
    return out

def tm(tris):
    v = tris.reshape(-1, 3); f = np.arange(len(v)).reshape(-1, 3)
    m = trimesh.Trimesh(vertices=v, faces=f); m.merge_vertices(); m.process(); return m

def contains_b(m, pts, b=2000):
    o = np.zeros(len(pts), bool)
    for i in range(0, len(pts), b):
        o[i:i+b] = m.contains(pts[i:i+b])
    return o

# esqueleto RIGIDO (solo el panel, vol 2) en frame posicionador
print("mallando esqueleto (sustrato rigido)...")
skel = solids_tris(D + r"\toproll_tras_skeleton.step", lc=1.5, keep={2}, translate=(T[0], T[1], T[2]))
skel_tris = list(skel.values())[0][0]
skel_pts = np.unique(skel_tris.reshape(-1, 3), axis=0)
print(f"  esqueleto: {len(skel_pts)} pts, bbox X[{skel_pts[:,0].min():.0f},{skel_pts[:,0].max():.0f}]")

for var in ("medio_+8deg", "fuerte_+12deg", "suave_+5deg"):
    m = tm(solids_tris(os.path.join(V2, f"empujador_pico_v2_{var}.step"))[list(solids_tris(os.path.join(V2, f"empujador_pico_v2_{var}.step")).keys())[0]][0]) if False else None

# mas simple: cargar cada empujador como trimesh
for var in ("suave_+5deg", "medio_+8deg", "fuerte_+12deg"):
    d = solids_tris(os.path.join(V2, f"empujador_pico_v2_{var}.step"))
    tris = list(d.values())[0][0]
    m = tm(tris)
    # puntos del esqueleto rigido DENTRO del empujador = colision dura
    zone = (skel_pts[:, 0] > 455) & (skel_pts[:, 0] < 505)
    zp = skel_pts[zone]
    inside = contains_b(m, zp)
    n_in = int(inside.sum())
    print(f"\n=== EMPUJADOR {var}: puntos del SUSTRATO RIGIDO dentro del empujador = {n_in}")
    if n_in:
        pq = trimesh.proximity.ProximityQuery(m)
        _, dist, _ = pq.on_surface(zp[inside])
        ip = zp[inside]
        print(f"    COLISION DURA: prof max {dist.max():.2f} mm, p95 {np.percentile(dist,95):.2f}")
        print(f"    zona: X[{ip[:,0].min():.0f},{ip[:,0].max():.0f}] Z[{ip[:,2].min():.0f},{ip[:,2].max():.0f}]")
    else:
        print(f"    OK: no toca el sustrato rigido (solo comprime tapizado)")

# identificar los 3 solidos del modelo completo (clips?)
print("\n=== SOLIDOS DEL MODELO COMPLETO (toproll_tras_full) ===")
full = solids_tris(D + r"\toproll_tras_full.stp", lc=6.0, translate=(T[0], T[1], T[2]))
for tag, (tris, bb) in full.items():
    dx, dy, dz = bb[3]-bb[0], bb[4]-bb[1], bb[5]-bb[2]
    print(f"  solido {tag}: bbox X[{bb[0]:.0f},{bb[3]:.0f}] Y[{bb[1]:.0f},{bb[4]:.0f}] Z[{bb[2]:.0f},{bb[5]:.0f}]  dims {dx:.0f}x{dy:.0f}x{dz:.0f}")

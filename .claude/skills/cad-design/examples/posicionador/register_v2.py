# -*- coding: utf-8 -*-
# EJEMPLO HISTORICO — caso Posicionador Top Roll Trasero (2026-07). Rutas muertas, NO CORRER.
# Version generica: scripts/register_icp.py · parametros del caso: params_posicionador.json
"""ICP traslacion-only (signo correcto) de caras esculpidas del posicionador
contra (a) esqueleto y (b) top roll completo. Reporta offset por cara."""
import numpy as np
import gmsh
from scipy.spatial import cKDTree

D = r"C:\Users\facun\AppData\Local\Temp\claude\C--Dev-BarackMercosul\50f3d407-417a-4fe2-9827-45c2643c1cf3\scratchpad\posicionador"

def mesh_points(path, lc, keep_vols=None, per_face=False):
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
    if per_face:
        faces = {}
        for dim, tag in gmsh.model.getEntities(2):
            stype = gmsh.model.getType(2, tag)
            _, nc, _ = gmsh.model.mesh.getNodes(2, tag, includeBoundary=True)
            faces[tag] = (stype, np.array(nc).reshape(-1, 3))
        gmsh.finalize()
        return faces
    _, nc, _ = gmsh.model.mesh.getNodes(2, -1)
    pts = np.unique(np.array(nc).reshape(-1, 3), axis=0)
    gmsh.finalize()
    return pts

print("posicionador (por cara)...")
pos_faces = mesh_points(D + r"\posicionador_v1.step", 2.0, per_face=True)
sculpt = np.concatenate([p for (t, p) in pos_faces.values() if t in ("BSpline surface", "Torus", "Cylinder")])
sculpt = np.unique(sculpt, axis=0)
print(f"  {len(sculpt)} pts esculpidos")

def sample_points(path, keep_vols=None, n=25):
    """Muestreo parametrico de superficies sin mallar (robusto ante geometria sucia)."""
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
    return np.unique(np.concatenate(out), axis=0)

targets = {
    "skeleton": mesh_points(D + r"\toproll_tras_skeleton.step", 2.5, keep_vols={2}),
    "full_v1": sample_points(D + r"\toproll_tras_full.stp", keep_vols={1}),
}
for name, pts in targets.items():
    print(f"  target {name}: {len(pts)} pts")

results = {}
for name, tgt in targets.items():
    tree = cKDTree(tgt)
    T = np.array([-3723.4, 834.4, 0.6])  # arranque: etapa 1
    for it in range(120):
        d, idx = tree.query(sculpt - T)   # posicionador llevado al frame del target
        k = max(200, int(len(sculpt) * 0.6))
        sel = np.argsort(d)[:k]
        resid = tgt[idx[sel]] - (sculpt[sel] - T)  # vector target - punto_pos (en frame target)
        delta = resid.mean(axis=0)
        T -= delta   # si el target esta "mas alla", acercar el posicionador restando
        if np.linalg.norm(delta) < 5e-5:
            break
    d, idx = tree.query(sculpt - T)
    sel = np.argsort(d)[:k]
    rms = np.sqrt((d[sel] ** 2).mean())
    print(f"\n=== {name}: T=({T[0]:.3f},{T[1]:.3f},{T[2]:.3f}) it={it} rms60={rms:.3f}")
    for thr in (0.3, 0.5, 1.0, 1.5, 2.0, 3.0):
        print(f"   <{thr}mm: {(d<thr).sum()} ({100*(d<thr).mean():.1f}%)")
    print(f"   mediana={np.median(d):.2f} p25={np.percentile(d,25):.2f} p75={np.percentile(d,75):.2f}")
    results[name] = (T.copy(), d.copy())
    np.save(D + f"\\T_{name}.npy", T)

# offsets por cara del posicionador contra el mejor target
best = min(results, key=lambda n: np.median(results[n][1]))
T, _ = results[best]
tree = cKDTree(targets[best])
print(f"\n=== distancias por cara del posicionador vs {best} (caras con mediana <6mm):")
rows = []
for tag, (stype, pts) in pos_faces.items():
    d, _ = tree.query(pts - T)
    rows.append((np.median(d), tag, stype, len(pts), np.percentile(d, 10)))
rows.sort()
for med, tag, stype, n, p10 in rows:
    if med < 6:
        print(f"   cara {tag:4d} {stype:18s} n={n:5d}  mediana={med:.2f}  p10={p10:.2f}")

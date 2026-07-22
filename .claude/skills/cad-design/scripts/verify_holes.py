# -*- coding: utf-8 -*-
"""Verifica que la cabeza avellanada M5 despeja el solido en los 4 agujeros de cada pieza
(ring-test: anillo r=4.75 mm en el frente de placa, ningun punto adentro) y extrae las
posiciones reales de los 8 agujeros para regenerar la plantilla desde el CAD medido."""
import os
import numpy as np
import gmsh
import trimesh

D = r"C:\Users\facun\AppData\Local\Temp\claude\C--Dev-BarackMercosul\50f3d407-417a-4fe2-9827-45c2643c1cf3\scratchpad\posicionador"
V2 = os.path.join(D, "v2")

# frame local
b = np.array([0.0147, 0.9898, 0.1419]); b /= np.linalg.norm(b)
a = np.array([0.9999, -0.0148, 0.0]); a = a - (a @ b) * b; a /= np.linalg.norm(a)
c = np.cross(a, b); c /= np.linalg.norm(c)
M = np.column_stack([a, b, c])  # local->global

def mesh_tm(path, lc=1.2):
    gmsh.initialize()
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("m")
    gmsh.model.occ.importShapes(path)
    gmsh.model.occ.synchronize()
    gmsh.option.setNumber("Mesh.MeshSizeMax", lc)
    gmsh.option.setNumber("Mesh.MeshSizeMin", lc * 0.4)
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
    v = np.array(tris).reshape(-1, 3)
    f = np.arange(len(v)).reshape(-1, 3)
    m = trimesh.Trimesh(vertices=v, faces=f); m.merge_vertices(); m.process()
    return m

def hole_axes_from_step(path):
    """Devuelve [(centro_frente_global, axis_global(b), 'izq/der + arriba/abajo')] leyendo los cilindros."""
    gmsh.initialize()
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("h")
    gmsh.model.occ.importShapes(path)
    gmsh.model.occ.synchronize()
    axes = []
    for dim, tag in gmsh.model.getEntities(2):
        if gmsh.model.getType(2, tag) != "Cylinder":
            continue
        # radio via masa/altura no directo; usar bbox para ubicar el eje
        bb = gmsh.model.getBoundingBox(2, tag)
        # centro del cilindro en local
        cg = np.array([(bb[0]+bb[3])/2, (bb[1]+bb[4])/2, (bb[2]+bb[5])/2])
        loc = M.T @ cg
        # radio aproximado por extension perpendicular a b
        axes.append((tag, cg, loc, bb))
    gmsh.finalize()
    return axes

def contains_batched(m, pts, batch=2000):
    out = np.zeros(len(pts), bool)
    for i in range(0, len(pts), batch):
        out[i:i+batch] = m.contains(pts[i:i+batch])
    return out

# posiciones teoricas de los agujeros (frame local) segun build corregido
# empujador: u in {u0+10, u1-10}={446.715,503.372} ; w in {w_bot+10,w_top-10}={773.410,805.161}
# cabezal: extraidos por auditor u in {-243.710,-76.243? }; los mido del STEP
def ring_test(m, centers_local, r=4.75, n=48, front_v=None, label=""):
    """centers_local: lista (u,w). front_v: v del frente de placa (local). Anillo a r en el frente,
    empujado 0.2mm hacia adentro para no tocar la superficie exacta."""
    bad = []
    for (u, w) in centers_local:
        ang = np.linspace(0, 2*np.pi, n, endpoint=False)
        ring_local = np.column_stack([u + r*np.cos(ang), np.full(n, front_v - 0.2), w + r*np.sin(ang)])
        ring_global = ring_local @ M.T
        inside = contains_batched(m, ring_global)
        bad.append(int(inside.sum()))
    return bad

print("=== EMPUJADOR MEDIO (rebuild margen 10mm) ===")
m_emp = mesh_tm(os.path.join(V2, "empujador_pico_v2_medio_+8deg.step"))
print(f"watertight={m_emp.is_watertight} vol={m_emp.volume/1000:.1f}cm3")
u0, u1 = 436.715, 513.372
w_bot, w_top = 763.410, 815.161
front_v = 76.007
centers = [(u0+10, w_bot+10), (u1-10, w_bot+10), (u0+10, w_top-10), (u1-10, w_top-10)]
labels = ["izq-abajo", "der-abajo", "izq-arriba", "der-arriba"]
# radio de cabeza DIN 7991 M5 = 4.6; probamos anillo a 4.75 (cabeza + 0.15 margen)
bad = ring_test(m_emp, centers, r=4.75, front_v=front_v)
print("ring-test cabeza M5 (r=4.75mm) — puntos DENTRO del solido (0 = la cabeza asienta libre):")
for lbl, (u, w), nb in zip(labels, centers, bad):
    luz_barra = 497.075 - u if u > 462 else u - 462.101  # dist al flanco de barra
    print(f"  {lbl:12s} u={u:.2f} w={w:.2f}: dentro={nb}  (luz a barra: {abs(luz_barra):.2f}mm)")

# margen real a la barra del par derecho
print(f"\npar derecho en u={u1-10:.3f}; flanco derecho barra u=497.075 -> luz {u1-10-497.075:.3f}mm (cabeza r=4.6 -> gap {u1-10-497.075-4.6:.3f}mm)")

print("\n=== CABEZAL ===")
m_cab = mesh_tm(os.path.join(V2, "cabezal_posicionador_v2.step"))
print(f"watertight={m_cab.is_watertight} vol={m_cab.volume/1000:.1f}cm3")

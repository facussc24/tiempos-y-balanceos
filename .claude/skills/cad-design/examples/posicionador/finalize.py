# -*- coding: utf-8 -*-
# EJEMPLO HISTORICO — caso Posicionador Top Roll Trasero (2026-07). Rutas muertas, NO CORRER.
# Version generica: scripts/export_deliverables.py + cadlib.geom.extract_cylinder_axes · parametros del caso: params_posicionador.json
"""Cierre: (1) extrae posiciones REALES de los 8 agujeros de los STEP, (2) regenera
plantilla PNG+DXF desde lo medido, (3) regenera STL fino del cabezal, (4) rearma el
conjunto con top roll, (5) copia todo al Escritorio."""
import os, shutil
import numpy as np
import gmsh

D = r"C:\Users\facun\AppData\Local\Temp\claude\C--Dev-BarackMercosul\50f3d407-417a-4fe2-9827-45c2643c1cf3\scratchpad\posicionador"
V2 = os.path.join(D, "v2")
DESK = r"C:\Users\facun\OneDrive\Escritorio\Posicionador TopRoll Trasero v2"
os.makedirs(DESK, exist_ok=True)

b = np.array([0.0147, 0.9898, 0.1419]); b /= np.linalg.norm(b)
a = np.array([0.9999, -0.0148, 0.0]); a = a - (a @ b) * b; a /= np.linalg.norm(a)
c = np.cross(a, b); c /= np.linalg.norm(c)
M = np.column_stack([a, b, c])

def extract_holes(path, r_target=2.65, tol=0.15):
    """Cilindros de radio ~2.65 (M5 pasante). Devuelve (u,w,v_front) en frame local."""
    gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("h"); gmsh.model.occ.importShapes(path); gmsh.model.occ.synchronize()
    holes = []
    for dim, tag in gmsh.model.getEntities(2):
        if gmsh.model.getType(2, tag) != "Cylinder":
            continue
        # muestreo parametrico para hallar eje y radio
        try:
            (u0p, v0p), (u1p, v1p) = gmsh.model.getParametrizationBounds(2, tag)
        except Exception:
            continue
        us = np.linspace(u0p, u1p, 16); vs = np.linspace(v0p, v1p, 6)
        uu, vv = np.meshgrid(us, vs)
        pr = np.column_stack([uu.ravel(), vv.ravel()])
        xyz = np.array(gmsh.model.getValue(2, tag, pr.ravel())).reshape(-1, 3)
        loc = xyz @ M  # a local
        ctr = loc.mean(0)
        # radio = dist media en el plano (u,w) al centro
        rr = np.sqrt((loc[:, 0]-ctr[0])**2 + (loc[:, 2]-ctr[2])**2).mean()
        if abs(rr - r_target) < tol:
            holes.append((ctr[0], ctr[2], loc[:, 1].max()))  # u, w, v_front(max)
    gmsh.finalize()
    # dedup por (u,w)
    uniq = []
    for h in holes:
        if not any(abs(h[0]-x[0]) < 1 and abs(h[1]-x[1]) < 1 for x in uniq):
            uniq.append(h)
    return uniq

cab = extract_holes(os.path.join(V2, "cabezal_posicionador_v2.step"))
emp = extract_holes(os.path.join(V2, "empujador_pico_v2_medio_+8deg.step"))
print(f"cabezal: {len(cab)} agujeros | empujador: {len(emp)} agujeros")
# ordenar con w redondeado (evita que ruido de micrones invierta izq/der) — abajo->arriba, izq->der
cab.sort(key=lambda h: (round(h[1]), round(h[0])))
emp.sort(key=lambda h: (round(h[1]), round(h[0])))
# origen = agujero inferior-izquierdo REAL del cabezal (min w, min u)
o_u, o_w = cab[0][0], cab[0][1]
print(f"origen (agujero inf-izq cabezal, local): u={o_u:.3f} w={o_w:.3f}")

def rel(h):
    return (h[0]-o_u, h[1]-o_w)
cab_r = [rel(h) for h in cab]
emp_r = [rel(h) for h in emp]
print("cabezal (rel):", [(round(x,2), round(y,2)) for x,y in cab_r])
print("empujador (rel):", [(round(x,2), round(y,2)) for x,y in emp_r])

# --- placas (bbox local de cada pieza, para dibujar el contorno)
def plate_rect(path):
    gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("p"); gmsh.model.occ.importShapes(path); gmsh.model.occ.synchronize()
    pts = []
    for d, t in gmsh.model.getEntities(0):
        bb = gmsh.model.getBoundingBox(0, t); pts.append([bb[0], bb[1], bb[2]])
    gmsh.finalize()
    loc = np.array(pts) @ M
    return loc[:, 0].min()-o_u, loc[:, 2].min()-o_w, loc[:, 0].max()-o_u, loc[:, 2].max()-o_w

cab_plate = plate_rect(os.path.join(V2, "cabezal_posicionador_v2.step"))
emp_plate = plate_rect(os.path.join(V2, "empujador_pico_v2_medio_+8deg.step"))
print(f"cab_plate {tuple(round(x,1) for x in cab_plate)}  emp_plate {tuple(round(x,1) for x in emp_plate)}")

# distancia de referencia = agujero inf-izq empujador (min u, con w redondeado)
emp_ref = min(emp_r, key=lambda p: (round(p[1]), round(p[0])))
print(f"referencia horizontal cabezal->empujador: {emp_ref[0]:.1f} mm ; desnivel {emp_ref[1]:.1f} mm")

# ============ PLANTILLA
import matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
fig, ax = plt.subplots(figsize=(16, 6), dpi=130)
for rect, name in ((cab_plate, "CABEZAL (placa 10 mm)"), (emp_plate, "EMPUJADOR (placa 7 mm)")):
    x0, y0, x1, y1 = rect
    ax.add_patch(plt.Rectangle((x0, y0), x1-x0, y1-y0, fill=False, ec="#333", lw=1.5))
    ax.annotate(name, ((x0+x1)/2, y1+6), ha="center", fontsize=10, fontweight="bold")
for hx, hy in cab_r + emp_r:
    ax.add_patch(plt.Circle((hx, hy), 2.65, fill=False, ec="#c22", lw=1.4))
    ax.plot([hx-5, hx+5], [hy, hy], color="#c22", lw=0.5)
    ax.plot([hx, hx], [hy-5, hy+5], color="#c22", lw=0.5)
    ax.annotate(f"({hx:.1f}, {hy:.1f})", (hx, hy-9), ha="center", fontsize=7.5, color="#c22")
ax.annotate("", xy=(emp_ref[0], -18), xytext=(0, -18), arrowprops=dict(arrowstyle="<->", color="#06c"))
ax.annotate(f"{emp_ref[0]:.1f} mm entre agujeros de referencia".replace(".", ","), (emp_ref[0]/2, -26), ha="center", fontsize=9, color="#06c")
ax.set_xlim(-40, emp_ref[0]+100); ax.set_ylim(-45, 175); ax.set_aspect("equal"); ax.grid(alpha=0.25)
ax.set_title("Plantilla de agujereado — Posicionador Top Roll Trasero v2 · 8 agujeros pasantes o5,3 (tornillo M5)\n"
             "Origen (0,0) = agujero inferior izquierdo del cabezal · cotas en mm EN EL PLANO de la tabla de montaje")
ax.set_xlabel("horizontal (mm)"); ax.set_ylabel("vertical (mm)")
fig.savefig(os.path.join(V2, "plantilla_agujeros.png"), bbox_inches="tight"); plt.close(fig)
print("saved plantilla_agujeros.png")

# DXF
def dxf_write(path, circles, rects, texts):
    L = ["0", "SECTION", "2", "ENTITIES"]
    for (cx, cy, r) in circles:
        L += ["0", "CIRCLE", "8", "AGUJEROS", "10", f"{cx:.2f}", "20", f"{cy:.2f}", "30", "0", "40", f"{r:.2f}"]
    for (x0, y0, x1, y1) in rects:
        for (ax_, ay, bx, by) in ((x0,y0,x1,y0),(x1,y0,x1,y1),(x1,y1,x0,y1),(x0,y1,x0,y0)):
            L += ["0","LINE","8","PLACAS","10",f"{ax_:.2f}","20",f"{ay:.2f}","30","0","11",f"{bx:.2f}","21",f"{by:.2f}","31","0"]
    for (tx, ty, h, s) in texts:
        L += ["0","TEXT","8","TEXTO","10",f"{tx:.2f}","20",f"{ty:.2f}","30","0","40",f"{h:.2f}","1", s]
    L += ["0","ENDSEC","0","EOF"]
    open(path, "w", encoding="ascii").write("\n".join(L)+"\n")

dxf_write(os.path.join(V2, "plantilla_agujeros.dxf"),
          [(x, y, 2.65) for x, y in cab_r + emp_r], [cab_plate, emp_plate],
          [(0, -30, 5, "ORIGEN=AGUJERO INF IZQ CABEZAL - 8x D5.3 PASANTE M5 - COTAS MM"),
           (cab_plate[0], cab_plate[3]+4, 5, "CABEZAL PLACA 10MM"),
           (emp_plate[0], emp_plate[3]+4, 5, "EMPUJADOR PLACA 7MM")])
print("saved plantilla_agujeros.dxf")

# ============ STL fino del cabezal
gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0)
gmsh.model.add("cabstl"); gmsh.model.occ.importShapes(os.path.join(V2, "cabezal_posicionador_v2.step"))
gmsh.model.occ.synchronize()
gmsh.option.setNumber("Mesh.MeshSizeMax", 1.2)
gmsh.option.setNumber("Mesh.MeshSizeMin", 0.3)
gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 40)
gmsh.model.mesh.generate(2)
gmsh.write(os.path.join(V2, "cabezal_posicionador_v2.stl"))
gmsh.finalize()
print(f"STL cabezal fino: {os.path.getsize(os.path.join(V2,'cabezal_posicionador_v2.stl'))//1024} KB")

# ============ CONJUNTO con top roll
T = np.load(D + r"\T_skeleton.npy")
gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0)
gmsh.model.add("conj"); occ = gmsh.model.occ
occ.importShapes(D + r"\toproll_tras_skeleton.step"); occ.synchronize()
vols = gmsh.model.getEntities(3)
bbs = {t: gmsh.model.getBoundingBox(3, t) for _, t in vols}
keep = max(bbs, key=lambda t: (bbs[t][5]-bbs[t][2]))
occ.remove([(3, t) for _, t in vols if t != keep], recursive=True)
occ.translate([(3, keep)], T[0], T[1], T[2]); occ.synchronize()
occ.importShapes(os.path.join(V2, "cabezal_posicionador_v2.step"))
occ.importShapes(os.path.join(V2, "empujador_pico_v2_medio_+8deg.step")); occ.synchronize()
print(f"conjunto: {len(gmsh.model.getEntities(3))} solidos")
gmsh.write(os.path.join(V2, "conjunto_v2_con_toproll.step"))
gmsh.finalize()
print("saved conjunto_v2_con_toproll.step")

# ============ COPIA a Escritorio
for f in ["empujador_pico_v2_suave_+5deg.step", "empujador_pico_v2_suave_+5deg.stl",
          "empujador_pico_v2_medio_+8deg.step", "empujador_pico_v2_medio_+8deg.stl",
          "empujador_pico_v2_fuerte_+12deg.step", "empujador_pico_v2_fuerte_+12deg.stl",
          "cabezal_posicionador_v2.step", "cabezal_posicionador_v2.stl",
          "conjunto_v2_con_toproll.step", "plantilla_agujeros.png", "plantilla_agujeros.dxf"]:
    shutil.copy(os.path.join(V2, f), DESK)
print("copiado a Escritorio")
print(f"\nreferencia empujador: {emp_ref[0]:.2f} mm horizontal, {emp_ref[1]:.2f} mm desnivel")

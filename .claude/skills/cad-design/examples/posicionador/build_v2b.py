# -*- coding: utf-8 -*-
# EJEMPLO HISTORICO — caso Posicionador Top Roll Trasero (2026-07). Rutas muertas, NO CORRER.
# Version generica: modelado de referencia gmsh OCC (hoy: build123d o gmsh a mano) · parametros del caso: params_posicionador.json
"""Empujador v2 (corregido): la cara de empuje parte del plano REAL de la v1
(por las aristas sup e inf medidas) y se rota EXTRA grados sobre la arista superior,
avanzando abajo (zona de la solapa). Variantes SUAVE/MEDIO/FUERTE.
Filetes en frame local (antes de transformar). STL con malla por curvatura."""
import os
import numpy as np
import gmsh

D = r"C:\Users\facun\AppData\Local\Temp\claude\C--Dev-BarackMercosul\50f3d407-417a-4fe2-9827-45c2643c1cf3\scratchpad\posicionador"
OUT = os.path.join(D, "v2")
os.makedirs(OUT, exist_ok=True)

b = np.array([0.0147, 0.9898, 0.1419]); b /= np.linalg.norm(b)
a = np.array([0.9999, -0.0148, 0.0])
a = a - (a @ b) * b; a /= np.linalg.norm(a)      # ortogonalizar exacto contra b
c = np.cross(a, b); c /= np.linalg.norm(c)
M = np.column_stack([a, b, c])
assert abs(np.linalg.det(M) - 1) < 1e-9, np.linalg.det(M)
# eje+angulo de la rotacion M (para occ.rotate, que preserva tipos de superficie)
ang_R = np.arccos(np.clip((np.trace(M) - 1) / 2, -1, 1))
axis_R = np.array([M[2, 1] - M[1, 2], M[0, 2] - M[2, 0], M[1, 0] - M[0, 1]])
axis_R /= np.linalg.norm(axis_R)
print(f"rotacion local->global: {np.degrees(ang_R):.3f} deg sobre eje ({axis_R[0]:.4f},{axis_R[1]:.4f},{axis_R[2]:.4f})")

# medidas locales (corrida anterior)
u0, u1 = 436.715, 513.372          # placa
v_back, v_front = 69.007, 76.007   # placa espesor 7
w_bot, w_top = 763.410, 815.161    # placa alto 51.75
ub0, ub1 = 462.101, 497.075        # barra ancho 34.97
wb_bot, wb_top = 774.161, 805.495  # barra alto 31.33
# cara de empuje v1: aristas (promedio izq/der)
v_top_edge = (182.274 + 183.250) / 2   # 182.762 en w=805.495
v_bot_edge = (175.584 + 176.952) / 2   # 176.268 en w=774.163
H_face = wb_top - wb_bot
slope_v1 = (v_top_edge - v_bot_edge) / H_face   # ~0.2071 (cara inclinada "arriba adelante")
ang_v1 = np.degrees(np.arctan(slope_v1))
print(f"cara v1: arista sup v={v_top_edge:.3f}, inf v={v_bot_edge:.3f}, pendiente {slope_v1:.4f} = {ang_v1:.2f} deg (frame dispositivo)")

VARIANTES = [("suave", 5.0), ("medio", 8.0), ("fuerte", 12.0)]

for nombre, extra in VARIANTES:
    ang_new = np.radians(ang_v1) - np.radians(extra)   # menos pendiente "arriba adelante" = abajo avanza
    s_new = np.tan(ang_new)
    v_bot_new = v_top_edge - H_face * s_new
    adv = v_bot_new - v_bot_edge
    print(f"\n=== {nombre.upper()} (+{extra} deg): arista inferior avanza {adv:+.2f} mm (v {v_bot_edge:.2f} -> {v_bot_new:.2f})")

    gmsh.initialize()
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add(nombre)
    occ = gmsh.model.occ

    plate = occ.addBox(u0, v_back, w_bot, u1 - u0, v_front - v_back, w_top - w_bot)
    bar = occ.addBox(ub0, v_front - 1.0, wb_bot, ub1 - ub0, (v_top_edge + 20) - (v_front - 1.0), wb_top - wb_bot)

    # cortador: caja cuyo frente pasa por la arista superior, rotada al angulo nuevo
    cut = occ.addBox(ub0 - 10, v_top_edge, wb_bot - 40, (ub1 - ub0) + 20, 60, (wb_top - wb_bot) + 80)
    # plano frontal del cortador = v = v_top_edge (vertical local). Rotar sobre eje u en la arista superior.
    # cinematica: v_plano(w) = v_top_edge + (wb_top - w)*tan(phi)  =>  phi = -arctan(s_new)
    # (chequeo: extra=0 -> phi=-11.71 deg reproduce la cara v1 con v_bot=176.27)
    phi = -np.arctan(s_new)
    occ.rotate([(3, cut)], 0, v_top_edge, wb_top, 1, 0, 0, phi)
    r = occ.cut([(3, bar)], [(3, cut)])
    bar_tag = r[0][0][1]
    r = occ.fuse([(3, plate)], [(3, bar_tag)])
    solid = r[0][0][1]
    occ.synchronize()

    # agujeros M5 avellanados (frente = +v). Margen 10 mm simetrico:
    # el par derecho DEBE quedar a >=4.6+1.5 mm del flanco de barra (u=497.075)
    # para que asiente la cabeza DIN 7991 (hallazgo auditoria 1: con margen 12
    # quedaba a 4.30 mm y la cabeza pisaba la barra).
    holes = []
    for uu in (u0 + 10.0, u1 - 10.0):
        for ww in (w_bot + 10.0, w_top - 10.0):
            cyl = occ.addCylinder(uu, v_back - 1, ww, 0, (v_front - v_back) + 2, 0, 2.65)
            cone = occ.addCone(uu, v_front + 0.01, ww, 0, -2.56, 0, 5.2, 2.65)
            holes += [(3, cyl), (3, cone)]
    r = occ.cut([(3, solid)], holes)
    solid = r[0][0][1]
    occ.synchronize()

    # filetes EN LOCAL: arista inferior de la cara de empuje y arista superior (entrada)
    def current_solid():
        vols = gmsh.model.getEntities(3)
        assert len(vols) == 1, f"hay {len(vols)} solidos"
        return vols[0][1]

    def edges_in(lo, hi, eps=2.0):
        return [t for d, t in gmsh.model.getEntitiesInBoundingBox(
            lo[0]-eps, lo[1]-eps, lo[2]-eps, hi[0]+eps, hi[1]+eps, hi[2]+eps, 1)]

    def try_fillet(lo, hi, rad, lbl):
        occ.synchronize()
        s = current_solid()
        etags = edges_in(lo, hi)
        if not etags:
            print(f"    SIN arista {lbl} — no se filetea")
            return
        try:
            occ.fillet([s], etags, [rad])
            occ.synchronize()
            print(f"    fillet {lbl} R{rad} OK (aristas {etags})")
        except Exception as ex:
            print(f"    fillet {lbl} fallo: {ex}")
            occ.synchronize()

    try_fillet((ub0+0.5, v_bot_new-1.5, wb_bot-0.5), (ub1-0.5, v_bot_new+1.5, wb_bot+0.5), 3.0, "inferior (presion)")
    try_fillet((ub0+0.5, v_top_edge-1.5, wb_top-0.5), (ub1-0.5, v_top_edge+1.5, wb_top+0.5), 1.5, "superior (entrada)")
    solid = current_solid()

    # transformar local -> global con rotacion rigida (preserva planos/cilindros)
    occ.rotate([(3, solid)], 0, 0, 0, axis_R[0], axis_R[1], axis_R[2], ang_R)
    occ.synchronize()

    vols = gmsh.model.getEntities(3)
    assert len(vols) == 1
    vol = occ.getMass(3, vols[0][1])
    print(f"    volumen {vol/1000:.1f} cm3")

    base = os.path.join(OUT, f"empujador_pico_v2_{nombre}_+{int(extra)}deg")
    gmsh.write(base + ".step")
    gmsh.option.setNumber("Mesh.MeshSizeMax", 3.0)
    gmsh.option.setNumber("Mesh.MeshSizeMin", 0.5)
    gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 24)
    gmsh.model.mesh.generate(2)
    gmsh.write(base + ".stl")
    gmsh.finalize()
    print(f"    -> {base}.step ({os.path.getsize(base + '.step')//1024}KB) .stl ({os.path.getsize(base + '.stl')//1024}KB)")

# limpiar los de la corrida equivocada
for f in os.listdir(OUT):
    if "deg_v2" in f:
        os.remove(os.path.join(OUT, f))
        print(f"borrado (corrida anterior): {f}")
print("\nLISTO")

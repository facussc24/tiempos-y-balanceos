# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe smoke_test.py --out <dir>
"""Smoke test integral de cadlib con geometria sintetica (ground truth por construccion).

Verifica: entorno (un solo interprete), mallado watertight, colision detectada/limpia,
extraccion de 4 cilindros r=2.65, ICP recupera una T conocida, renders, secciones,
manifest de workdir con gate de evidencia, y build123d exporta STEP+STL+GLB.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import envcheck, geom, render, workdir  # noqa: E402

import numpy as np  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True, help="directorio de trabajo del smoke (se crea)")
    args = ap.parse_args()

    envcheck.require(("gmsh", "trimesh", "scipy", "matplotlib", "numpy", "build123d"))
    if sys.version_info[:2] != (3, 12):
        print("AVISO: interprete %d.%d (canonico: 3.12 del .venv-cad)" % sys.version_info[:2])

    w = workdir.ensure_workdir(args.out)
    tdir = os.path.join(w, "in")

    import make_test_geometry
    paths = make_test_geometry.make(tdir)
    print("[1/8] geometria sintetica OK (%d STEPs)" % len(paths))

    m_sub = geom.step_to_trimesh(paths["substrate"], lc=2.0, require_watertight=True)
    assert abs(m_sub.volume - 100 * 8 * 60) / (100 * 8 * 60) < 0.01, m_sub.volume
    print("[2/8] substrate watertight, volumen %.0f mm3 (esperado 48000)" % m_sub.volume)

    wall_pts = geom.mesh_nodes(paths["substrate"], lc=1.5)
    m_clear = geom.step_to_trimesh(paths["clear"], lc=2.0)
    m_coll = geom.step_to_trimesh(paths["colliding"], lc=2.0)
    n_clear = int(geom.contains_batched(m_clear, wall_pts).sum())
    inside_coll = geom.contains_batched(m_coll, wall_pts)
    n_coll = int(inside_coll.sum())
    assert n_clear == 0, "fixture con 1mm de luz NO debe contener puntos de la pared (dio %d)" % n_clear
    assert n_coll > 0, "fixture que penetra 3mm DEBE contener puntos de la pared"
    print("[3/8] colision: clear=0 pts, colliding=%d pts DENTRO (correcto)" % n_coll)

    holes = geom.extract_cylinder_axes(paths["plate"], r_target=2.65, tol=0.15)
    assert len(holes) == 4, "esperaba 4 agujeros r=2.65, encontre %d" % len(holes)
    r_err = max(abs(h["radius"] - 2.65) for h in holes)
    print("[4/8] 4 agujeros extraidos, error max de radio %.3f mm" % r_err)

    T_true = np.array([5.0, 3.0, -2.0])
    # geometria CURVA (blob): ICP fija los 3 ejes. Nubes identicas => trim=1.0
    # (el trim recorta outliers entre nubes DISTINTAS; con nubes iguales descarta
    # justo los puntos informativos).
    blob_pts = geom.mesh_nodes(paths["blob"], lc=1.5)
    T, d, rms, its = geom.icp_translation(blob_pts + T_true, blob_pts, seed=(4.0, 2.0, -1.0), trim=1.0)
    err = np.abs(T - T_true).max()
    assert err < 0.01, "ICP no recupero la T conocida (err %.3f mm, T=%s)" % (err, T)
    # control NEGATIVO: caja lisa se desliza tangencialmente — la leccion documentada
    # "validar ICP con features unicos, no con perfiles constantes" hecha assert.
    Tw, _, _, _ = geom.icp_translation(wall_pts + T_true, wall_pts, seed=(4.0, 2.0, -1.0), trim=1.0)
    err_wall = np.abs(Tw - T_true).max()
    assert err_wall > 0.3, "la caja lisa DEBERIA deslizar (si esto falla, revisar el control negativo)"
    print("[5/8] ICP: blob err %.4f mm (%d its) | control negativo caja err %.2f mm (desliza, esperado)"
          % (err, its, err_wall))

    sub_tris = geom.step_to_tris(paths["substrate"], lc=2.0)
    coll_tris = geom.step_to_tris(paths["colliding"], lc=2.0)
    files = render.render_views(
        [(sub_tris, "#7f8c8d", 0.45), (coll_tris, "#e07b39", 0.9)],
        os.path.join(w, "renders", "smoke"),
        views={"iso": (28, -55), "top": (89.9, -90)},
        title="smoke: pared + fixture que penetra",
        points=[(wall_pts[inside_coll], "red", "choque (%d pts)" % n_coll)],
    )
    assert all(os.path.isfile(f) for f in files)
    segs = render.section_segments(sub_tris, 0, 50.0)
    assert len(segs) > 0, "la seccion X=50 debe cortar la pared"
    render.render_section(
        [(segs, "#444444", 1.2, "pared"), (render.section_segments(coll_tris, 0, 50.0), "#d9534f", 1.6, "fixture")],
        os.path.join(w, "renders", "smoke_sec_X50.png"),
        title="Seccion X=50", xlabel="Y (mm)", ylabel="Z (mm)")
    print("[6/8] renders (%d PNG) + seccion OK" % (len(files) + 1))

    workdir.set_transform(w, "test", T, source="in/test_substrate.step", rms=rms)
    assert np.allclose(workdir.get_transform(w, "test"), T)
    try:
        workdir.get_transform(w, "no-existe")
        raise AssertionError("get_transform de nombre inexistente debia fallar")
    except KeyError as e:
        assert "Disponibles" in str(e)
    workdir.record_evidence(w, "collision_check", fixture="in/test_fixture_clear.step",
                            substrate="in/test_substrate.step", n_inside=0)
    workdir.require_evidence(w, "collision_check", fixture="in/test_fixture_clear.step")
    try:
        workdir.require_evidence(w, "collision_check", fixture="otra.step")
        raise AssertionError("require_evidence sin evidencia debia abortar")
    except SystemExit:
        pass
    print("[7/8] manifest: transforms + evidencia + gate OK")

    from build123d import (BuildPart, BuildSketch, Plane, RectangleRounded, extrude,
                           Locations, Circle, Mode, export_step, export_stl)
    L, A, H, D, MARG = 80.0, 60.0, 5.0, 6.0, 12.0
    with BuildPart() as pieza:
        with BuildSketch(Plane.XY):
            RectangleRounded(L, A, radius=6)
        extrude(amount=H)
        with BuildSketch(pieza.faces().sort_by()[-1]):
            with Locations((L / 2 - MARG, A / 2 - MARG), (-(L / 2 - MARG), A / 2 - MARG),
                           (L / 2 - MARG, -(A / 2 - MARG)), (-(L / 2 - MARG), -(A / 2 - MARG))):
                Circle(D / 2)
        extrude(amount=-H, mode=Mode.SUBTRACT)
    part = pieza.part
    assert bool(part.is_valid), "geometria build123d invalida"
    out3d = os.path.join(w, "out")
    export_step(part, os.path.join(out3d, "smoke_b3d.step"))
    export_stl(part, os.path.join(out3d, "smoke_b3d.stl"))
    glb = "no"
    try:
        from build123d import export_gltf
        export_gltf(part, os.path.join(out3d, "smoke_b3d.glb"), binary=True)
        glb = "si"
    except Exception as e:
        print("  (GLB fallo: %s)" % e)
    b3d_holes = geom.extract_cylinder_axes(os.path.join(out3d, "smoke_b3d.step"), r_target=3.0, tol=0.15)
    assert len(b3d_holes) == 4, "la pieza build123d debe tener 4 agujeros r=3.0 (dio %d)" % len(b3d_holes)
    print("[8/8] build123d: STEP+STL exportados (GLB: %s), 4 agujeros verificados via gmsh" % glb)

    # --- gate de cuerpos/cavidades de export_deliverables: par BIEN/MAL -----------------
    # El MAL es test_sealed_cavity (caja con hueco interior sellado): mallada da 2 cuerpos
    # y el interior con volumen NEGATIVO — exactamente lo que un laminador tapa a ciegas.
    # Caso real 2026-08-18: quitar 2 agujeros M5 sello el vaciado que ventilaban de
    # casualidad y un STL con 8 cuerpos paso el gate viejo (que juzgaba un re-mallado, no
    # el archivo entregado).
    envcheck.require(("trimesh",))
    import trimesh

    def _cuerpos(step_path):
        import gmsh
        stl_p = step_path.replace(".step", "_gate.stl")
        with geom.gmsh_session():
            geom._load(step_path)
            gmsh.option.setNumber("Mesh.MeshSizeMax", 2.0)
            gmsh.option.setNumber("Mesh.Binary", 1)
            gmsh.model.mesh.generate(2)
            gmsh.write(stl_p)
        mm = trimesh.load(stl_p)
        cs = mm.split(only_watertight=False)
        return len(cs), sum(1 for c in cs if c.volume < 0)

    n_ok, neg_ok = _cuerpos(paths["substrate"])
    n_mal, neg_mal = _cuerpos(paths["sealed_cavity"])
    assert n_ok == 1 and neg_ok == 0, "la caja sana debe dar 1 cuerpo/0 negativos (dio %d/%d)" % (n_ok, neg_ok)
    assert n_mal == 2 and neg_mal == 1, ("la cavidad sellada DEBE detectarse como 2 cuerpos/1 negativo "
                                         "(dio %d/%d) — si esto falla, el gate de cuerpos quedo ciego" % (n_mal, neg_mal))
    print("[9/9] gate cuerpos/cavidades: sano 1/0, cavidad sellada 2/1 (discrimina)")

    print("\nSMOKE OK — cadlib funcionando de punta a punta en %s" % w)


if __name__ == "__main__":
    main()

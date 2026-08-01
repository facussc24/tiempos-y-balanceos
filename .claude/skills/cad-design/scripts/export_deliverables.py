# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe export_deliverables.py --help
"""Exporta y entrega piezas (STEP + STL binario + GLB opcional) — CON GATE DE EVIDENCIA.

Este es el enforcement REAL del gate pre-entrega (el hook cad-guard solo recuerda):
por cada pieza exige en el manifest (1) collision_check con n_inside=0 y (2) un render
mas nuevo que el STEP. Sin evidencia NO entrega. Override explicito --skip-gate con
--reason, y queda huella en el manifest.
"""
import argparse
import glob
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import envcheck, geom, workdir  # noqa: E402

import gmsh  # noqa: E402


def _stl_export(step_path, stl_path, lc, curvature):
    with geom.gmsh_session():
        geom._load(step_path)
        gmsh.option.setNumber("Mesh.MeshSizeMax", lc)
        gmsh.option.setNumber("Mesh.MeshSizeMin", lc * 0.25)
        gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", curvature)
        gmsh.option.setNumber("Mesh.Binary", 1)
        gmsh.model.mesh.generate(2)
        gmsh.write(stl_path)


def _aviso_frame_impresion(base, mesh):
    """Avisa si la pieza sale en coordenadas del cliente en vez de listas para imprimir.

    Incidente 2026-07-31: dos piezas entregadas en el frame del cliente, o sea inclinadas y a
    metros del origen — el laminador las recibe torcidas. El entregable impreso va apoyado en
    z=0 y centrado en XY -> `a_plano.py --normal=x,y,z`.
    Es AVISO, no gate: hay entregables (conjuntos, contrapiezas) que si van en el frame cliente.
    """
    lo, hi = mesh.bounds
    centro = (lo + hi) / 2.0
    lejos = max(abs(centro[0]), abs(centro[1])) > 200.0
    despegada = abs(lo[2]) > 1.0
    if lejos or despegada:
        print("  AVISO frame de impresion en '%s': centro XY (%.0f, %.0f), z_min %.2f.\n"
              "    Si esto se imprime, pasarla por a_plano.py (apoyada en z=0, centrada)."
              % (base, centro[0], centro[1], lo[2]))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--pieces", nargs="+", required=True, help="STEPs a entregar (tipicamente en out/)")
    ap.add_argument("--deliver", required=True, help="carpeta destino de la entrega")
    ap.add_argument("--stl-lc", type=float, default=geom.LC_PRINT)
    ap.add_argument("--stl-curvature", type=int, default=geom.CURVATURE_PRINT)
    ap.add_argument("--glb", action="store_true", help="exportar tambien GLB (visor web)")
    ap.add_argument("--skip-gate", action="append", default=[], choices=["collision", "render"],
                    help="saltear un gate (queda registrado; exige --reason)")
    ap.add_argument("--reason", default=None, help="justificacion del --skip-gate")
    args = ap.parse_args()

    if args.skip_gate and not args.reason:
        raise SystemExit("--skip-gate exige --reason (la huella queda en el manifest)")

    w = workdir.ensure_workdir(args.workdir)

    # ---- GATES por pieza ----
    for piece in args.pieces:
        base = os.path.basename(piece)
        if not os.path.isfile(piece):
            raise SystemExit("No existe la pieza: %s" % piece)

        if "collision" not in args.skip_gate:
            ev = workdir.find_evidence(w, "collision_check", fixture=base)
            if ev is None:
                raise SystemExit(
                    "[GATE colision] Sin collision_check para '%s' en el manifest.\n"
                    "Correr: check_collision.py --workdir %s --fixture %s --substrate <cliente.step>\n"
                    "(o --skip-gate collision --reason '...' si genuinamente no aplica)" % (base, w, piece))
            if ev.get("n_inside", 1) != 0:
                raise SystemExit(
                    "[GATE colision] El ultimo collision_check de '%s' dio %s puntos DENTRO (%s).\n"
                    "Corregir la pieza y re-verificar antes de entregar." % (base, ev.get("n_inside"), ev.get("date")))

        if "render" not in args.skip_gate:
            step_mtime = os.path.getmtime(piece)
            renders = glob.glob(os.path.join(w, "renders", "*.png"))
            fresh = [r for r in renders if os.path.getmtime(r) >= step_mtime]
            if not fresh:
                raise SystemExit(
                    "[GATE render] Ningun PNG en %s/renders es mas nuevo que %s.\n"
                    "Renderizar y MIRAR el resultado (render_step.py / check_collision.py --render) "
                    "antes de entregar." % (w, base))

    # ---- export + entrega ----
    os.makedirs(args.deliver, exist_ok=True)
    delivered = []
    for piece in args.pieces:
        base = os.path.splitext(os.path.basename(piece))[0]
        stl = os.path.join(os.path.dirname(piece) or ".", base + ".stl")
        _stl_export(piece, stl, args.stl_lc, args.stl_curvature)
        # watertight del STL de entrega (gate CADGenBench nivel 1: validez)
        m = geom.step_to_trimesh(piece, lc=args.stl_lc)
        if not m.is_watertight:
            raise SystemExit("[GATE validez] La malla de '%s' NO es watertight — no se entrega." % base)
        _aviso_frame_impresion(base, m)
        outs = [piece, stl]
        if args.glb:
            envcheck.require(("trimesh",))
            import trimesh
            glb = os.path.join(os.path.dirname(piece) or ".", base + ".glb")
            trimesh.load(stl).export(glb)
            outs.append(glb)
        for f in outs:
            shutil.copy(f, args.deliver)
            delivered.append(os.path.basename(f))
        print("entregado: %s (%s)" % (base, ", ".join(os.path.splitext(x)[1] for x in outs)))

    workdir.record_evidence(w, "delivery", dest=args.deliver, files=delivered,
                            skipped_gates=args.skip_gate, reason=args.reason)
    print("\nENTREGA OK -> %s (%d archivos). Evidencia registrada en el manifest." % (args.deliver, len(delivered)))
    print("Ultimo paso humano: ABRIR los archivos y mirarlos (regla verify-before-close).")


if __name__ == "__main__":
    main()

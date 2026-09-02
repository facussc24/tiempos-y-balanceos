# -*- coding: utf-8 -*-
"""Par BIEN/MAL de los gates de ENTREGA — test de regresion, no de humo.

Correr:  .venv-cad\Scripts\python.exe test_gates_entrega.py [--out <carpeta>]

Los tres agujeros que cierra (auditoria del 2026-08-24, los tres demostrados en corrida
antes de arreglarlos):
  A) la evidencia se buscaba por NOMBRE de archivo -> retocar la pieza despues de
     verificarla y entregarla daba "ENTREGA OK" con 653 puntos DENTRO;
  B) el gate de ensamble se disparaba si el archivo se LLAMABA "ENSAMBLE";
  C) --confirmar de gate_zona traia --quien default "Fak" y --evidencia default "":
     el propio agente podia autofirmar el gate mas caro del sistema.

Cada control tiene que poder dar ROJO: se corre el caso que ANTES pasaba y se exige que
ahora sea rechazado, y ademas el caso legitimo, para que no quede un gate que rechaza
todo (eso tambien es un control ciego).

No borra nada: cada corrida usa un workdir nuevo con marca de tiempo.
"""
import os
import shutil
import subprocess
import argparse
import sys
import tempfile
import time

SCR = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
_ap = argparse.ArgumentParser(description=__doc__,
                              formatter_class=argparse.RawDescriptionHelpFormatter)
_ap.add_argument("--out", default=None, help="carpeta donde armar el workdir del test")
_ARGS = _ap.parse_args()
W = os.path.join(_ARGS.out or tempfile.gettempdir(),
                 "test_gates_%s" % time.strftime("%Y%m%d_%H%M%S"))


def run(script, *args):
    p = subprocess.run([PY, os.path.join(SCR, script)] + list(args),
                       capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def geometria():
    import cadquery as cq
    # con un agujero pasante: gate_zona necesita una abertura real que inventariar
    sub = (cq.Workplane("XY").box(100, 100, 20, centered=(True, True, False))
           .faces(">Z").workplane().hole(20))
    cq.exporters.export(sub, os.path.join(W, "in", "sustrato.step"))
    # apoya justo encima: no penetra y TOCA
    bueno = cq.Workplane("XY").workplane(offset=20).box(100, 100, 10, centered=(True, True, False))
    cq.exporters.export(bueno, os.path.join(W, "out", "pieza.step"))
    shutil.copy(os.path.join(W, "out", "pieza.step"), os.path.join(W, "pieza_BUENA.step"))
    # metido 3 mm dentro del sustrato
    malo = cq.Workplane("XY").workplane(offset=17).box(100, 100, 10, centered=(True, True, False))
    cq.exporters.export(malo, os.path.join(W, "pieza_MALA.step"))
    # ensamble de 2 solidos, con nombre que NO dice "ensamble"
    # apoyados sobre el sustrato (z=20), como la pieza buena: el gate de colision los deja
    # pasar y asi el test llega al gate de ensamble, que es lo que se quiere probar
    a = cq.Workplane("XY").workplane(offset=20).box(40, 40, 10, centered=(True, True, False)).val()
    b = cq.Workplane("XY").workplane(offset=45).box(40, 40, 10, centered=(True, True, False)).val()
    cq.exporters.export(cq.Compound.makeCompound([a, b]), os.path.join(W, "out", "conjunto.step"))


def main():
    for d in ("in", "out", "renders", "cache", "entrega"):
        os.makedirs(os.path.join(W, d), exist_ok=True)
    geometria()
    sus = os.path.join(W, "in", "sustrato.step")
    pieza = os.path.join(W, "out", "pieza.step")
    png = os.path.join(W, "renders", "cualquiera.png")
    fallos = []

    def check(nombre, cond, detalle):
        print(("  [OK]    " if cond else "  [FALLA] ") + nombre)
        if not cond:
            fallos.append(nombre)
            print("          " + detalle.strip()[:700].replace("\n", "\n          "))

    print("\n1) check_collision sobre la pieza BUENA")
    rc, out = run("check_collision.py", "--workdir", W, "--fixture", pieza, "--substrate", sus)
    check("la pieza buena verifica sin choque", rc == 0, out)
    open(png, "wb").write(b"\x89PNG\r\n\x1a\n")

    print("\n2) EXPLOIT: pisar la pieza con la que CHOCA y entregar (antes daba ENTREGA OK)")
    shutil.copy(os.path.join(W, "pieza_MALA.step"), pieza)
    os.utime(png, None)
    rc, out = run("export_deliverables.py", "--workdir", W, "--pieces", pieza,
                  "--deliver", os.path.join(W, "entrega"), "--skip-gate", "zona", "--skip-gate", "proceso",
                  "--reason", "test sintetico")
    check("entregar una pieza retocada post-verificacion queda RECHAZADO",
          rc != 0 and "NO habla del archivo" in out, out)

    print("\n3) contraprueba: re-verificar la pieza mala -> el gate la caza por CHOQUE")
    rc, out = run("check_collision.py", "--workdir", W, "--fixture", pieza, "--substrate", sus)
    check("check_collision detecta el choque de la pieza mala", rc != 0, out)

    print("\n4) contraprueba: la pieza BUENA re-verificada SI se entrega")
    shutil.copy(os.path.join(W, "pieza_BUENA.step"), pieza)
    rc, out = run("check_collision.py", "--workdir", W, "--fixture", pieza, "--substrate", sus)
    check("la buena vuelve a verificar", rc == 0, out)
    os.utime(png, None)
    rc, out = run("export_deliverables.py", "--workdir", W, "--pieces", pieza,
                  "--deliver", os.path.join(W, "entrega"), "--skip-gate", "zona", "--skip-gate", "proceso",
                  "--reason", "test sintetico")
    check("la pieza verificada de verdad SI se entrega", rc == 0 and "ENTREGA OK" in out, out)

    print("\n5) gate de ensamble por CONTENIDO: 2 solidos en 'conjunto.step'")
    conj = os.path.join(W, "out", "conjunto.step")
    run("check_collision.py", "--workdir", W, "--fixture", conj, "--substrate", sus)
    os.utime(png, None)
    rc, out = run("export_deliverables.py", "--workdir", W, "--pieces", conj,
                  "--deliver", os.path.join(W, "entrega"), "--skip-gate", "zona", "--skip-gate", "proceso",
                  "--reason", "test sintetico")
    check("un ensamble que no se llama ENSAMBLE dispara el gate igual",
          rc != 0 and "GATE ensamble" in out, out)

    print("\n6) GATE 0: --confirmar sin archivo de evidencia")
    rc, out = run("gate_zona.py", "inventario", sus, "--workdir", W,
                  "--confirmar", "A1", "--quien", "Fak", "--evidencia", "lo confirmo de palabra")
    check("no se puede autofirmar la confirmacion de zona",
          rc != 0 and "ARCHIVO QUE EXISTA" in out, out)

    print("\n" + ("TODOS LOS CONTROLES DAN LO ESPERADO" if not fallos
                  else "FALLARON: %s" % ", ".join(fallos)))
    print("workdir del test: %s" % W)
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())

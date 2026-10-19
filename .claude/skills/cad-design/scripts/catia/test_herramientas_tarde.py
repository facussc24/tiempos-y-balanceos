"""Pruebas SIN CATIA de lo que la practica del 19/10 de tarde paso a la skill, en las dos direcciones:
1. medir(): con un cuerpo VACIO (Shapes.Count = 0) se niega sin tocar el SPA (medirlo rompe la sesion: ej13, ej38);
   con un cuerpo con operaciones, o algo que no es un cuerpo (sin Shapes), sigue al SPA.
2. pantalla.elegir_monitor: con dos pantallas elige la que no es la principal; con una, None.
3. acomodar_cotas.se_pisan: cajas que se tocan si, separadas no (con margen).
4. de_build123d.tramos (corre en .venv-cad: si no hay build123d, se saltea con aviso): un arco de 180 grados sale
   partido en dos y las puntas de los tramos que se tocan coinciden exacto (redondeo)."""
import os
import subprocess
import sys
import tempfile
import types

AQUI = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia_test_"))
sys.path.insert(0, AQUI)
import catia_base as cb  # noqa: E402
import acomodar_cotas as ac  # noqa: E402
import pantalla  # noqa: E402

fallas = []


def chequear(nombre, cond, detalle=""):
    print(("   ok    " if cond else "   FALLA ") + nombre + ("" if cond else f"  [{detalle}]"))
    if not cond:
        fallas.append(nombre)


# 1. medir con cuerpo vacio
toco_spa = []
doc = types.SimpleNamespace(GetWorkbench=lambda n: toco_spa.append(n) or (_ for _ in ()).throw(RuntimeError("SPA")))
part = types.SimpleNamespace(CreateReferenceFromObject=lambda o: o)
vacio = types.SimpleNamespace(Shapes=types.SimpleNamespace(Count=0))
try:
    cb.medir(doc, part, vacio)
    chequear("medir() con cuerpo vacio se niega", False, "no se nego")
except ValueError:
    chequear("medir() con cuerpo vacio se niega (ValueError)", toco_spa == [], toco_spa)
except RuntimeError:
    chequear("medir() con cuerpo vacio se niega", False, "fue al SPA con el cuerpo vacio")
lleno = types.SimpleNamespace(Shapes=types.SimpleNamespace(Count=3))
toco_spa.clear()
try:
    cb.medir(doc, part, lleno)
except RuntimeError:
    pass
chequear("medir() con cuerpo con operaciones va al SPA", toco_spa == ["SPAWorkbench"], toco_spa)
toco_spa.clear()
try:
    cb.medir(doc, part, types.SimpleNamespace())          # una helice, una cara: no tiene Shapes
except RuntimeError:
    pass
chequear("medir() con algo que no es cuerpo va al SPA", toco_spa == ["SPAWorkbench"], toco_spa)

# 2. pantalla
m1 = {"Flags": 1, "Device": "D1", "Work": (0, 0, 1536, 816)}
m2 = {"Flags": 0, "Device": "D2", "Work": (1920, 0, 3840, 1032)}
chequear("dos pantallas: elige la que no es la principal", pantalla.elegir_monitor([m1, m2]) is m2)
chequear("dos pantallas en otro orden: igual", pantalla.elegir_monitor([m2, m1]) is m2)
chequear("una sola pantalla: None (no mueve)", pantalla.elegir_monitor([m1]) is None)

# 3. cotas que se pisan
chequear("cajas encimadas se pisan", ac.se_pisan([0, 0, 10, 5], [8, 2, 20, 7]))
chequear("cajas separadas no se pisan", not ac.se_pisan([0, 0, 10, 5], [15, 0, 20, 5]))
chequear("a 0,5 con margen 1 se pisan", ac.se_pisan([0, 0, 10, 5], [10.5, 0, 20, 5]))

# 4. de_build123d.tramos en .venv-cad
VENV = r"C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe"
if os.path.exists(VENV):
    codigo = (
        "import sys, json, math; sys.path.insert(0, r'%s')\n"
        "from build123d import BuildSketch, BuildLine, Line, ThreePointArc, make_face\n"
        "from de_build123d import tramos\n"
        "with BuildSketch() as s:\n"
        "    with BuildLine():\n"
        "        Line((-10, 0), (10, 0)); ThreePointArc((10, 0), (0, 10), (-10, 0))\n"
        "    make_face()\n"
        "t = tramos(s.sketch.faces()[0])\n"
        "arcos = [x for x in t if x[0] == 'A']\n"
        "puntas = [(x[1], x[2]) if x[0] == 'L' else (x[3], x[4]) for x in t]\n"
        "cierra = all(puntas[i][1] == puntas[(i + 1) %% len(puntas)][0] for i in range(len(puntas)))\n"
        "print(json.dumps({'arcos': len(arcos), 'cierra': cierra}))\n") % AQUI
    r = subprocess.run([VENV, "-c", codigo], capture_output=True, text=True)
    try:
        import json
        res = json.loads(r.stdout.strip().splitlines()[-1])
        chequear("de_build123d: el semicirculo sale partido en DOS arcos", res["arcos"] == 2, res)
        chequear("de_build123d: las puntas de tramos seguidos coinciden exacto", res["cierra"], res)
    except Exception as e:  # noqa: BLE001
        chequear("de_build123d corrio", False, (r.stderr or str(e))[-300:])
else:
    print("   (salteado) de_build123d: no hay .venv-cad en esta PC")

print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS {fallas}")
sys.exit(1 if fallas else 0)

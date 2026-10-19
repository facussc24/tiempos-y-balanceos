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

# 2 bis. pantalla.py corrido a mano sin pid con una CATIA que no es mia: se niega y no mueve nada
import runpy  # noqa: E402
_orig = (cb._guardado, cb.cnext_abiertos, cb.es_mia, sys.argv)
cb._guardado, cb.cnext_abiertos, cb.es_mia = (lambda: {"pid": 4242}), (lambda: [4242]), (lambda p, g: False)
sys.argv = ["pantalla.py"]
movidas = []
_mw = pantalla.win32gui.MoveWindow
pantalla.win32gui.MoveWindow = lambda *a: movidas.append(a)
try:
    runpy.run_path(os.path.join(AQUI, "pantalla.py"), run_name="__main__")
    chequear("pantalla.py a mano con una CATIA ajena se niega", False, "no se nego")
except SystemExit as e:
    chequear("pantalla.py a mano con una CATIA ajena se niega", "no es la que arranque" in str(e) and not movidas, str(e))
except Exception as e:  # noqa: BLE001
    chequear("pantalla.py a mano con una CATIA ajena se niega", False, repr(e)[:80])
finally:
    cb._guardado, cb.cnext_abiertos, cb.es_mia, sys.argv = _orig
    pantalla.win32gui.MoveWindow = _mw

# 3. cotas que se pisan
chequear("cajas encimadas se pisan", ac.se_pisan([0, 0, 10, 5], [8, 2, 20, 7]))
chequear("cajas separadas no se pisan", not ac.se_pisan([0, 0, 10, 5], [15, 0, 20, 5]))
chequear("a 0,5 con margen 1 se pisan", ac.se_pisan([0, 0, 10, 5], [10.5, 0, 20, 5]))

# 3 ter. destino_afuera con las cajas reales del carro (ej66c, coordenadas de vista); frente 0..1000 x 0..800
CONT = (0.0, 0.0, 1000.0, 800.0)
u = {}
abajo = ac.destino_afuera([452.5, 11.8, 547.5, 35.2], CONT, 50.0, u)
arriba = ac.destino_afuera([452.5, 781.8, 547.5, 805.2], CONT, 50.0, u)
izq = ac.destino_afuera([-8.2, 365.0, 15.2, 435.0], CONT, 50.0, u)
der = ac.destino_afuera([901.8, 365.0, 925.2, 435.0], CONT, 50.0, u)
chequear("el 1000 de abajo sale por abajo (y < 0)", abajo is not None and abajo[2] == "abajo" and abajo[1] < 0, abajo)
chequear("el 1000 de arriba sale por arriba (y > 800)", arriba is not None and arriba[2] == "arriba" and arriba[1] > 800,
         arriba)
chequear("los 740 salen por los costados",
         izq[2] == "izquierda" and izq[0] < 0 and der[2] == "derecha" and der[0] > 1000, (izq, der))
chequear("una cota que ya esta afuera no se mueve", ac.destino_afuera([452.5, 900.0, 547.5, 925.0], CONT, 50.0, {}) is None)
u2 = {}
p1 = ac.destino_afuera([0, 780, 100, 800], CONT, 50.0, u2)
p2 = ac.destino_afuera([200, 780, 300, 800], CONT, 50.0, u2)
chequear("dos del mismo lado se escalonan de a un paso", abs((p2[1] - p1[1]) - 50.0) < 1e-9, (p1, p2))

# 3 bis. acomodar() con un plano falso (Views / Dimensions / GetBoundaryBox por Evaluate)
class Dim:
    def __init__(self, valor, tipo, caja_):
        self.valor, self.DimType, self.caja = valor, tipo, list(caja_)

    def GetValue(self):
        return types.SimpleNamespace(Value=self.valor)

    def MoveValue(self, x, y, *_):
        w, h = self.caja[2] - self.caja[0], self.caja[3] - self.caja[1]
        self.caja = [x - w / 2, y - h / 2, x + w / 2, y + h / 2]


class Lista:
    def __init__(self, items):
        self.items = items

    @property
    def Count(self):
        return len(self.items)

    def Item(self, i):
        return self.items[i - 1]

    def Remove(self, i):
        del self.items[i - 1]


def vista(nombre, dims):
    return types.SimpleNamespace(Name=nombre, Dimensions=Lista(dims))


def plano():
    planta = vista("Planta", [Dim(40.0, 0, (0, 0, 8, 3)), Dim(10.0, 0, (20, 0, 28, 3)), Dim(10.0, 0, (40, 0, 48, 3))])
    frente = vista("Frente", [Dim(40.0, 0, (0, 50, 8, 53)), Dim(40.0, 9, (20, 50, 28, 53)),
                              Dim(90.0, 0, (60, 50, 68, 53)), Dim(90.0, 0, (60, 50, 68, 53))])
    return types.SimpleNamespace(Views=Lista([planta, frente])), planta, frente


def evaluar(_macro, _l, _f, args):
    x0, y0, x1, y1 = args[0].caja
    return ";".join(str(v) for v in (x0, y0, x1, y0, x1, y1, x0, y1))


cfake = types.SimpleNamespace(SystemService=types.SimpleNamespace(Evaluate=evaluar))
hoja, planta, frente = plano()
r = ac.acomodar(cfake, hoja)
chequear("acomodar() por defecto no saca ninguna cota", r["repetidas_sacadas"] == 0 and
         planta.Dimensions.Count == 3 and frente.Dimensions.Count == 4, r)
chequear("acomodar() separa dos cotas con la MISMA caja", r["siguen_pisadas"] == 0 and r["movimientos"] > 0, r)
hoja, planta, frente = plano()
r = ac.acomodar(cfake, hoja, sacar_repetidas=True)
chequear("sacar_repetidas: dentro de una misma vista nunca (los dos 10 de la planta quedan)",
         planta.Dimensions.Count == 3, [d.valor for d in planta.Dimensions.items])
chequear("sacar_repetidas: entre vistas, mismo valor y tipo (el 40 del frente) sale y se lista",
         [(s["vista"], s["valor"], s["tipo"]) for s in r["sacadas"]] == [("Frente", 40.0, 0)], r["sacadas"])
chequear("sacar_repetidas: mismo valor y OTRO tipo (el diametro 40) queda",
         any(d.valor == 40.0 and d.DimType == 9 for d in frente.Dimensions.items))
r = ac.acomodar(cfake, plano()[0], orden=["Front view"])
chequear("una vista pedida que no existe se avisa", r["vistas_que_no_estan"] == ["Front view"], r)

# 4. de_build123d.tramos en .venv-cad
VENV = r"C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe"
if os.path.exists(VENV):
    rc = subprocess.run([VENV, os.path.join(AQUI, "_b123d_casos.py")], capture_output=True, text=True)
    try:
        import json as _json
        k = _json.loads(rc.stdout.strip().splitlines()[-1])
        chequear("de_build123d: 300 perfiles girados, ninguno ABIERTO", k["girados_abiertos"] == 0, k)
        chequear("de_build123d: circunferencia entera en 3 arcos y cerrada", k["circulo_arcos"] == 3 and k["circulo_abierto"] == 0, k)
        chequear("de_build123d: una cara con agujero se niega", k["con_agujero"] == "se nego", k)
        chequear("de_build123d: sector de 300 en arcos < 180 que suman 300",
                 all(g < 180 for g in k["sector_grados"]) and abs(sum(k["sector_grados"]) - 300) < 0.01, k["sector_grados"])
    except Exception as e:  # noqa: BLE001
        chequear("de_build123d (casos) corrio", False, (rc.stderr or str(e))[-300:])
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

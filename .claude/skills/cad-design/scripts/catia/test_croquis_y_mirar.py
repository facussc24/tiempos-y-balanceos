"""Pruebas sin CATIA, en las dos direcciones, de lo que la practica del 19/10 paso a la skill:
1. angulos_arco: el arco corto entre dos puntos, en el sentido que dibuja CATIA (antihorario); 180 justos se rechaza.
2. centro_agregado: hacia donde crecio una operacion (el pad que salio para afuera, ej26); sin cambio de volumen -> None.
3. elegir_sentido: queda la orientacion que suma mas aunque la otra tambien sume (la revolucion para adentro, ej31b).
4. Registro.mostrar: con CATIA_MIRAR=lento encuadra y pausa; sin la variable o con «1» no toca el visor.
5. captura deja la ventana en Layout 2 (arbol + pieza); 0 es SOLO el arbol (la pantalla en blanco de Fak)."""
import math
import os
import sys
import types

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catia_base as cb  # noqa: E402
from croquis import angulos_arco, centro_agregado, elegir_sentido  # noqa: E402

fallas = []


def chequear(nombre, cond):
    print(("   ok    " if cond else "   FALLA ") + nombre)
    if not cond:
        fallas.append(nombre)


# 1. arcos
ini, fin, pa, pb = angulos_arco((0, 0), (1, 0), (0, 1))                 # de 0 a 90
chequear("arco 0 -> 90 grados por el camino corto", abs(ini) < 1e-9 and abs(fin - math.pi / 2) < 1e-9 and pa == (1, 0))
ini, fin, pa, pb = angulos_arco((0, 0), (0, 1), (1, 0))                 # dado al reves: se da vuelta
chequear("arco dado al reves se da vuelta (CATIA dibuja antihorario)", pa == (1, 0) and pb == (0, 1))
ini, fin, pa, pb = angulos_arco((6, 0), (13.87, -39.22), (13.87, 39.22))   # el de afuera del Light Cap, por la cima
chequear("arco de 157 grados pasa por la cima (angulo 0)", ini < 0 < fin and fin - ini < math.pi)
try:
    angulos_arco((0, 0), (1, 0), (-1, 0))
    chequear("arco de 180 justos se rechaza", False)
except ValueError:
    chequear("arco de 180 justos se rechaza", True)

# 2. centro de lo agregado
m0 = {"volume": 1000.0, "cdg_mm": [0.0, 0.0, 0.0]}
m1 = {"volume": 2000.0, "cdg_mm": [0.0, -20.0, 0.0]}                    # lo agregado esta en y = -40 (afuera)
c = centro_agregado(m0, m1)
chequear("centro de lo agregado (y = -40)", c is not None and abs(c[1] + 40) < 1e-9)
chequear("sin cambio de volumen -> None", centro_agregado(m0, m0) is None)

# 3. elegir sentido: las dos suman; gana la que suma mas, y queda puesta
estado = {"v": 0.0}
part = types.SimpleNamespace(Update=lambda: None)
cual, v = elegir_sentido(part, lambda: estado["v"], lambda: estado.update(v=18998.0), lambda: estado.update(v=41620.0))
chequear("gana la que suma mas (41 620 contra 18 998)", cual == "b" and v == 41620.0 and estado["v"] == 41620.0)
cual, v = elegir_sentido(part, lambda: estado["v"], lambda: estado.update(v=41620.0), lambda: estado.update(v=18998.0))
chequear("si gana la primera, se vuelve a poner la primera", cual == "a" and estado["v"] == 41620.0)
cual, v = elegir_sentido(part, lambda: estado["v"], lambda: estado.update(v=500.0), lambda: estado.update(v=300.0),
                         quiero="menos")
chequear("quiero='menos' (un vaciado: el que deja menos)", cual == "b" and estado["v"] == 300.0)


# 4. mostrar
class Visor:
    def __init__(self):
        self.llamadas = []
        self.Viewpoint3D = types.SimpleNamespace(PutSightDirection=lambda d: self.llamadas.append("dir"),
                                                 PutUpDirection=lambda d: self.llamadas.append("up"))

    def Reframe(self):
        self.llamadas.append("reframe")

    def Update(self):
        self.llamadas.append("update")


visor = Visor()
catia = types.SimpleNamespace(ActiveWindow=types.SimpleNamespace(ActiveViewer=visor, Layout=0))
reg = cb.Registro("_test_mirar")
reg.catia = catia
os.environ["CATIA_PAUSA"] = "0"
for valor, espera in ((None, False), ("1", False), ("lento", True)):
    visor.llamadas.clear()
    if valor is None:
        os.environ.pop("CATIA_MIRAR", None)
    else:
        os.environ["CATIA_MIRAR"] = valor
    reg.mostrar()
    chequear(f"CATIA_MIRAR={valor}: {'encuadra' if espera else 'no toca el visor'}", ("reframe" in visor.llamadas) == espera)
os.environ.pop("CATIA_MIRAR", None)

# 5. la captura deja Layout 2 (se lee en el codigo: correrla pide CATIA)
fuente = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "catia_base.py"), encoding="utf-8").read()
cuerpo_captura = fuente.split("def captura(")[1].split("\ndef ")[0]
chequear("captura deja ActiveWindow.Layout = 2 al terminar", "Layout = 2" in cuerpo_captura.split("return png")[0][-400:])

print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS {fallas}")
sys.exit(1 if fallas else 0)

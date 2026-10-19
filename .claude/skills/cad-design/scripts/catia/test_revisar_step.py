"""Pruebas de revisar_step.py (corre en .venv-cad) con casos de respuesta conocida:
1. caja 50 x 30 x 20 en caras sueltas con un agujero de 2 x 2 en la de arriba (ej53): UN lazo libre de 8 mm;
2. la misma caja sana con una cara dada vuelta: CERO bordes libres;
3. una esfera solida: sus aristas degeneradas (los polos, largo 0) NO cuentan como bordes abiertos.
(El caso real two_wireless.stp —contorno 777,8 + dos huecos de cargador de 116,3— no viaja en el repo: ver catia.md.)"""
import json
import os
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
fallas = []


def chequear(nombre, cond, detalle=""):
    print(("   ok    " if cond else "   FALLA ") + nombre + ("" if cond else f"  [{detalle}]"))
    if not cond:
        fallas.append(nombre)


def revisar(ruta):
    r = subprocess.run([sys.executable, os.path.join(AQUI, "revisar_step.py"), ruta], capture_output=True, text=True)
    return json.loads([x for x in r.stdout.splitlines() if x.startswith("{")][-1])


a = revisar(os.path.join(AQUI, "_casos_fem", "caja_agujero_2x2.step"))
p = a["superficies_sueltas"]
chequear("agujero 2 x 2: 6 caras sueltas y UN lazo libre de 8 mm cerrado",
         p["caras"] == 6 and len(p["lazos"]) == 1 and abs(p["lazos"][0]["largo_mm"] - 8.0) < 1e-6 and p["lazos"][0]["cerrado"], p)
b = revisar(os.path.join(AQUI, "_casos_fem", "caja_cara_dada_vuelta.step"))
chequear("caja sana con una cara dada vuelta: cero bordes libres",
         b["superficies_sueltas"]["bordes_libres"] == 0 and b["superficies_sueltas"]["lazos"] == [], b)

from build123d import Sphere, export_step  # noqa: E402
esf = os.path.join(tempfile.mkdtemp(prefix="revstep_"), "esfera.step")
export_step(Sphere(10), esf)
c = revisar(esf)
s0 = c["solidos"][0]
chequear("esfera: solido valido, 0 bordes abiertos (los polos degenerados no cuentan)",
         s0["valido"] and s0["bordes_abiertos"] == 0 and s0["aristas_degeneradas"] >= 1, s0)

print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS {fallas}")
sys.exit(1 if fallas else 0)

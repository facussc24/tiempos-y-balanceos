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


def revisar(ruta, codigo=False):
    r = subprocess.run([sys.executable, os.path.join(AQUI, "revisar_step.py"), ruta], capture_output=True, text=True)
    j = json.loads([x for x in r.stdout.splitlines() if x.startswith("{")][-1])
    return (j, r.returncode) if codigo else j


def caso(n):
    return os.path.join(AQUI, "_casos_fem", n)


RENDIJAS = "rendijas_bordes_que_cierran_al_recoser"
a = revisar(caso("caja_agujero_2x2.step"))["superficies_sueltas"]
chequear("agujero 2 x 2: un pedazo con UN lazo libre de 8 mm y ninguna rendija",
         a["pedazos"] == 1 and a["por_pedazo"][0]["lazos"] == [{"largo_mm": 8.0, "cerrado": True}] and a[RENDIJAS] == 0, a)
b = revisar(caso("caja_cara_dada_vuelta.step"))["superficies_sueltas"]
chequear("caja sana con una cara dada vuelta: cero bordes libres (la cara dada vuelta NO se detecta)",
         b["bordes_libres"] == 0, b)
r5 = revisar(caso("caja_rendija_005.step"))["superficies_sueltas"]
chequear("rendija de 0,05 (ej48): no revienta y los 8 bordes libres CIERRAN al coser a 0,1 (son rendijas)",
         r5["bordes_libres"] == 8 and r5[RENDIJAS] == 8, r5)
rp = revisar(caso("caja_cara_repetida.step"))["superficies_sueltas"]
chequear("cara repetida: no revienta y la cuenta (1 repetida, queda como pedazo aparte)",
         rp["caras_repetidas"] == 1 and rp["pedazos"] == 2, rp)
sr = revisar(caso("solido_cara_de_menos.step"))
chequear("solido declarado con una cara de menos: el lector lo deja en superficies y se avisa solido_roto_probable",
         sr["solidos_declarados"] == 1 and sr["solidos_leidos"] == 0 and sr["solido_roto_probable"], sr)
bj, bc = revisar(caso("basura.step"), codigo=True)
chequear("archivo basura: sale con codigo 2 y error (no da «sano»)", bc == 2 and "error" in bj, (bc, bj))

from build123d import Sphere, export_step  # noqa: E402
esf = os.path.join(tempfile.mkdtemp(prefix="revstep_"), "esfera.step")
export_step(Sphere(10), esf)
c = revisar(esf)
s0 = c["solidos"][0]
chequear("esfera: solido valido, 0 bordes abiertos (los polos degenerados no cuentan)",
         s0["valido"] and s0["bordes_abiertos"] == 0 and s0["aristas_degeneradas"] >= 1, s0)

print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS {fallas}")
sys.exit(1 if fallas else 0)

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

# ronda 2 del auditor (19/10)
n13 = revisar(caso("n13_ensamble_instancia_y_roto.step"))
chequear("una pieza repetida en el ensamble NO tapa al solido roto (formas distintas 1 < declarados 2)",
         n13["solido_roto_probable"] and n13["formas_distintas"] == 1 and n13["solidos_leidos"] == 2, n13)
n13b = revisar(caso("n13b_ensamble_control.step"))
chequear("el mismo roto sin la repetida tambien avisa", n13b["solido_roto_probable"], n13b)
r2 = revisar(caso("n05_rendija_0.2.step"))["superficies_sueltas"]
chequear("rendija de 0,2: NO cierra al recoser a 0,1 (8 bordes libres, 0 rendijas)",
         r2["bordes_libres"] == 8 and r2[RENDIJAS] == 0, r2)
g3 = revisar(caso("g03_hueco_las_dos_pieles_abiertas.step"))
chequear("solido hueco (BREP_WITH_VOIDS) con las dos pieles abiertas: se cuenta como declarado y avisa",
         g3["solidos_declarados"] == 1 and g3["solido_roto_probable"], g3)
nx, nc = revisar(os.path.join(AQUI, "_casos_fem", "no_existe.step"), codigo=True)
chequear("archivo que no existe: codigo 2 y error", nc == 2 and "error" in nx, (nc, nx))

from build123d import Sphere, export_step  # noqa: E402
esf = os.path.join(tempfile.mkdtemp(prefix="revstep_"), "esfera.step")
export_step(Sphere(10), esf)
c = revisar(esf)
s0 = c["solidos"][0]
chequear("esfera: solido valido, 0 bordes abiertos (los polos degenerados no cuentan)",
         s0["valido"] and s0["bordes_abiertos"] == 0 and s0["aristas_degeneradas"] >= 1, s0)

print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS {fallas}")
sys.exit(1 if fallas else 0)

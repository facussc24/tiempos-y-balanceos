# -*- coding: utf-8 -*-
# Interprete: C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I (build123d).
"""barrido_palanca.py - la parte que gira, ¿choca o pellizca en alguna pose del recorrido, no solo en los extremos?

    python barrido_palanca.py <conjunto.json | conjunto.stl | conjunto.step> [--paso 2.5] [--dedo 25] [--mano 100]
           [--tope-seg 120]

Lee el .json del conjunto (si le pasan el .stl o el .step, busca el .json de al lado): partes y sus STEP, la parte que
se mueve ("movil"), el eje ({"origen", "dir"}, giro positivo con la regla de la mano derecha alrededor de "dir") y el
rango en grados. Gira la parte movil de la primera a la ultima pose en pasos de --paso grados, INCLUIDA la ultima, y en
cada pose mide contra cada parte fija:
  - CHOQUE: volumen de la interseccion (booleano exacto de OpenCascade). > 0,001 mm3 = ROJO, con la pose.
  - LUZ: distancia minima (exacta, BRepExtrema) contra las partes fijas que NO son "junta" (la junta es la que sostiene
    el eje: su luz es constante y se juzga con otro control; contra la junta se mide igual el choque).
ROJO si hay choque en alguna pose o si la luz minima cae por debajo de --dedo mm (P12: dedo 25 mm). Las poses con luz
por debajo de --mano (100 mm) se informan como aviso, no dan rojo. Con --paso igual al rango (solo los extremos) se ve
el control ciego que solo mira 0 y 60.
Cronometro: el barrido entero (sin contar la carga de los STEP) va en medidas.segundos_barrido; si pasa --tope-seg se
dice en el detalle.

Salida: UNA linea JSON en stdout; codigo 0 verde, 3 rojo, 2 error.
"""
import argparse
import json
import os
import sys
import time

_FD = os.dup(1)
os.dup2(2, 1)

NOMBRE = "barrido_palanca"


def salir(res, codigo):
    sys.stdout.flush()
    os.dup2(_FD, 1)
    os.write(1, (json.dumps(res, ensure_ascii=False) + "\n").encode("utf-8"))
    os._exit(codigo)


def unir(x):
    """intersect() de build123d devuelve una forma, una ShapeList o None: se lleva todo a una forma (o None)."""
    from build123d import Compound
    if x is None:
        return None
    if isinstance(x, (list, tuple)):
        return Compound(children=list(x)) if len(x) else None
    return x


def volumen(x):
    x = unir(x)
    return sum(s.volume for s in x.solids()) if x is not None else 0.0


def leer_json(arch):
    base, ext = os.path.splitext(arch)
    j = arch if ext.lower() == ".json" else base + ".json"
    if not os.path.exists(j):
        raise FileNotFoundError("falta el json del conjunto: %s" % j)
    return json.load(open(j, encoding="utf-8")), os.path.dirname(os.path.abspath(j))


def poses(a0, a1, paso):
    out, a = [], a0
    while a < a1 - 1e-9:
        out.append(round(a, 6))
        a += paso
    out.append(a1)                                  # la ultima pose va siempre
    return out


def cajas_se_tocan(b1, b2, margen=0.0):
    return not (b1.max.X + margen < b2.min.X or b2.max.X + margen < b1.min.X or
                b1.max.Y + margen < b2.min.Y or b2.max.Y + margen < b1.min.Y or
                b1.max.Z + margen < b2.min.Z or b2.max.Z + margen < b1.min.Z)


def main():
    from build123d import Axis, import_step
    ap = argparse.ArgumentParser()
    ap.add_argument("archivo")
    ap.add_argument("--paso", type=float, default=2.5)
    ap.add_argument("--dedo", type=float, default=25.0)
    ap.add_argument("--mano", type=float, default=100.0)
    ap.add_argument("--tope-seg", type=float, default=120.0)
    a = ap.parse_args()
    if a.paso <= 0:
        raise SystemExit("--paso tiene que ser mayor que 0")
    meta, d = leer_json(a.archivo)
    arch = meta["archivos"]
    movil = meta["movil"]
    junta = set(meta.get("junta", []))
    fijos = [p for p in meta["partes"] if p != movil]
    sol = {p: import_step(os.path.join(d, arch[p])) for p in meta["partes"]}
    eje = Axis(tuple(meta["eje"]["origen"]), tuple(meta["eje"]["dir"]))
    a0, a1 = meta["rango_grados"]
    t0 = time.time()
    curva, choques, pellizcos, avisos = [], [], [], []
    for ang in poses(a0, a1, a.paso):
        m = sol[movil].rotate(eje, ang)
        bm = m.bounding_box()
        fila = {"grados": ang, "choque_mm3": {}, "luz_mm": {}}
        for f in fijos:
            vol = 0.0
            if cajas_se_tocan(bm, sol[f].bounding_box()):
                vol = volumen(m.intersect(sol[f]))
            if vol > 1e-3:
                fila["choque_mm3"][f] = round(vol, 3)
            if f not in junta:
                fila["luz_mm"][f] = 0.0 if vol > 1e-3 else round(m.distance_to(sol[f]), 2)
        luz = min(fila["luz_mm"].values()) if fila["luz_mm"] else None
        fila["luz_min_mm"] = luz
        curva.append(fila)
        if fila["choque_mm3"]:
            choques.append(ang)
        elif luz is not None and luz < a.dedo:
            pellizcos.append(ang)
        elif luz is not None and luz < a.mano:
            avisos.append(ang)
    seg = time.time() - t0
    con_luz = [c for c in curva if c["luz_min_mm"] is not None]
    peor = min(con_luz, key=lambda c: c["luz_min_mm"]) if con_luz else None
    sin_choque = [c for c in con_luz if not c["choque_mm3"]]
    peor_libre = min(sin_choque, key=lambda c: c["luz_min_mm"]) if sin_choque else None
    med = {"poses": len(curva), "paso_grados": a.paso, "rango_grados": [a0, a1], "movil": movil,
           "junta_sin_luz": sorted(junta), "segundos_barrido": round(seg, 1),
           "poses_con_choque": choques, "poses_luz_menor_dedo": pellizcos, "poses_luz_menor_mano": avisos,
           "luz_min_sin_choque_mm": peor_libre["luz_min_mm"] if peor_libre else None,
           "pose_luz_min_sin_choque": peor_libre["grados"] if peor_libre else None,
           "umbrales": {"dedo_mm": a.dedo, "mano_mm": a.mano, "_fuente": "P12 de PROPUESTAS_SKILL_3D_2026-10-23 "
                        "(dedo 25 mm, mano 100 mm)"},
           "curva": [{"g": c["grados"], "luz": c["luz_min_mm"], "choque": c["choque_mm3"] or None} for c in curva]}
    motivos = []
    if choques:
        primera = curva[[c["grados"] for c in curva].index(choques[0])]
        motivos.append("CHOCA en %d pose(s), de %.1f a %.1f grados (a %.1f: %s mm3)"
                       % (len(choques), choques[0], choques[-1], choques[0],
                          ", ".join("%s %.1f" % (k, v) for k, v in primera["choque_mm3"].items())))
    if peor_libre and peor_libre["luz_min_mm"] < a.dedo:
        motivos.append("la luz se cierra a %.1f mm a %.1f grados (menos que un dedo, %.0f mm)"
                       % (peor_libre["luz_min_mm"], peor_libre["grados"], a.dedo))
    if motivos:
        det = "; ".join(motivos)
    else:
        det = "recorre %s a %s grados en %d poses sin choque; luz minima %.1f mm a %.1f grados" % (
            a0, a1, len(curva), peor["luz_min_mm"], peor["grados"]) if peor else "sin partes contra las que medir luz"
    if avisos:
        det += " | aviso: luz menor que una mano (%.0f mm) en %d pose(s)" % (a.mano, len(avisos))
    if seg > a.tope_seg:
        det += " | el barrido tardo %.0f s, mas que el tope de %.0f s: subir --paso" % (seg, a.tope_seg)
    salir({"corrector": NOMBRE, "veredicto": "rojo" if motivos else "verde", "detalle": det, "medidas": med},
          3 if motivos else 0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        salir({"corrector": NOMBRE, "veredicto": "error", "detalle": "argumentos: %s" % e, "medidas": {}}, 2)
    except Exception as e:  # noqa: BLE001
        salir({"corrector": NOMBRE, "veredicto": "error", "detalle": "%s: %s" % (type(e).__name__, e),
               "medidas": {}}, 2)

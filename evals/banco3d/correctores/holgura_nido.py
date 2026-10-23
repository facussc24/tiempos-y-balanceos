# -*- coding: utf-8 -*-
# Interprete: C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I (build123d).
"""holgura_nido.py - ¿la pieza entra en su nido con la luz pedida, de cada lado?

    python holgura_nido.py <conjunto.json | conjunto.stl | conjunto.step> [--min 0.1] [--max 0.4] [--alturas 3]

Lee el .json del conjunto (si le pasan el .stl o el .step, busca el .json de al lado): STEP de la pieza y del nido.
  1. CHOQUE: volumen de la interseccion pieza-nido (booleano exacto de OpenCascade). > 0,001 mm3 = ROJO, con el volumen.
  2. LUZ POR LADO: la pieza apoya en el fondo del nido, asi que la distancia minima global da siempre 0 y no sirve
     (seria un control ciego). Se cortan rebanadas de 1 mm de la pieza y del nido a --alturas alturas entre el fondo y
     el borde del nido (sin tocar el fondo) y, por cada cara lateral de la pieza, se mide la distancia a la rebanada del
     nido. La luz de ese lado es la menor de las alturas. ROJO si algun lado queda fuera de [--min, --max].
     Un nido corrido (0,2 de un lado y 0,6 del otro) da rojo por el lado de 0,6: no alcanza con el minimo.
Umbrales por defecto: holgura 0,2 por lado con +-0,1 (pedido del banco, 23/10/2026; la ficha FDM de la casa dice
0,3-0,5 por lado para lo que entra en un vano impreso: para una pieza impresa, pasar --min/--max de esa ficha).

Salida: UNA linea JSON en stdout; codigo 0 verde, 3 rojo, 2 error.
"""
import argparse
import json
import os
import sys

_FD = os.dup(1)
os.dup2(2, 1)

NOMBRE = "holgura_nido"


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


def lado(n):
    """nombre del lado segun la normal hacia afuera de la cara de la pieza"""
    ejes = [("x", n.X), ("y", n.Y), ("z", n.Z)]
    e, v = max(ejes, key=lambda t: abs(t[1]))
    return ("+" if v > 0 else "-") + e


def main():
    from build123d import Align, Box, Pos, import_step
    ap = argparse.ArgumentParser()
    ap.add_argument("archivo")
    ap.add_argument("--min", type=float, default=0.1)
    ap.add_argument("--max", type=float, default=0.4)
    ap.add_argument("--alturas", type=int, default=3)
    a = ap.parse_args()
    meta, d = leer_json(a.archivo)
    arch = meta["archivos"]
    pieza = import_step(os.path.join(d, arch[meta.get("pieza", "pieza")]))
    nido = import_step(os.path.join(d, arch[meta.get("nido", "nido")]))
    med = {"umbrales": {"min_mm": a.min, "max_mm": a.max, "por_lado": True,
                        "_fuente": "pedido del banco 23/10/2026 (0,2 por lado); no es dato de proceso de Barack"}}
    motivos = []
    vol = volumen(pieza.intersect(nido))
    med["choque_mm3"] = round(vol, 4)
    if vol > 1e-3:
        motivos.append("la pieza CHOCA con el nido: %.3f mm3 de material en comun" % vol)
    bp, bn = pieza.bounding_box(), nido.bounding_box()
    z_lo, z_hi = bp.min.Z + 1.0, min(bp.max.Z, bn.max.Z) - 1.0     # sin el fondo y sin el borde
    if z_hi <= z_lo:
        raise RuntimeError("la pieza no queda adentro del nido en altura: no hay donde medir la luz")
    n = max(1, a.alturas)
    alturas = [z_lo + (z_hi - z_lo) * (i + 0.5) / n for i in range(n)]
    gran = Box(10 * max(bn.size.X, 1) + 100, 10 * max(bn.size.Y, 1) + 100, 1.0, align=(Align.CENTER,) * 3)
    luz = {}
    for z in alturas:
        losa = Pos(bn.center().X, bn.center().Y, z) * gran
        rp, rn = unir(pieza.intersect(losa)), unir(nido.intersect(losa))
        if rp is None or rn is None:
            continue
        for f in rp.faces():
            nrm = f.normal_at()
            if abs(nrm.Z) > 0.1:
                continue                  # tapas de la rebanada: no son caras laterales
            dd = f.distance_to(rn)
            k = lado(nrm)
            luz[k] = min(luz.get(k, 1e9), dd)
    med["alturas_mm"] = [round(z, 2) for z in alturas]
    med["luz_por_lado_mm"] = {k: round(v, 4) for k, v in sorted(luz.items())}
    for k, v in sorted(luz.items()):
        if vol > 1e-3 and v < 1e-6:
            continue                       # ese lado ya esta contado como choque
        if v < a.min:
            motivos.append("lado %s: luz %.2f mm, menos que %.2f (%s)" % (k, v, a.min,
                                                                     "entra apretada" if v < 1e-6 else "justa"))
        elif v > a.max:
            motivos.append("lado %s: luz %.2f mm, mas que %.2f (la pieza baila)" % (k, v, a.max))
    if not luz:
        motivos.append("no se encontro ninguna cara lateral de la pieza para medir")
    det = "; ".join(motivos) if motivos else "sin choque; luz por lado %s mm (rango %.2f a %.2f)" % (
        ", ".join("%s %.2f" % (k, v) for k, v in sorted(luz.items())), a.min, a.max)
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

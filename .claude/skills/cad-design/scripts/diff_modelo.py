#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""diff_modelo.py — corregir por parametros sin romper lo demas: que cambio entre dos versiones de un modelo, y si
cambio algo que NO se pidio tocar (propuesta 4 / P9 del informe del sistema 3D, 24/10/2026).

Por que existe: el 20/10 cada correccion rehacia el modelo entero (anexo 00 de docs/investigacion-3d-2026-10-23/,
causa 5) y nada miraba si lo que no se toco seguia igual. Afuera, el modo de falla documentado de editar un CAD es
«edit the requested feature while changing unrelated parts» (MUSE, arXiv 2605.28579, informe §3.7) y el patron de
jarvis-onshape-mcp es devolver con cada cambio un diff de caja, masa y numero de piezas (informe §4.4).

  diff_modelo.py antes.step despues.step [--puede-cambiar nombre1,nombre2] [--zona x0,y0,z0,x1,y1,z1]
                 [--tol 0.01] [--json salida.json]
  diff_modelo.py --autotest

- Cada solido de las dos versiones con su volumen, area, caja y centro; se emparejan por NOMBRE del STEP y, si no hay
  nombres, por volumen y centro. El diff dice cuantos solidos hay antes y despues, cuales cambiaron y cuanto.
- «Lo demas no cambio»: todo solido que NO esta en --puede-cambiar tiene que ser el mismo (volumen y area a 1e-6
  relativo, y la superficie a menos de --tol mm en los dos sentidos). Con --zona (una sola pieza que se edita en un
  lugar), la superficie de AFUERA de la zona (menos un margen de 1 mm) tiene que ser la misma.
- Sale con 0 si solo cambio lo permitido, 3 si cambio algo mas (lo nombra), 2 si no pudo medir. Antes de juzgar corre
  su propio par BIEN/MAL (una caja con un agujero que se mueve dentro de la zona y otra con un agujero que se mueve
  fuera): si no los separa, sale con 3 sin juzgar nada (la casa: «la maquina puede MATAR un dato, nunca APROBARLO»).
- Una zona con coordenadas negativas se escribe pegada: --zona=-22,-10,-6,-5,10,6 (si no, argparse corta con 2).
- Limites (sin fuente de Barack, medidos el 24/10): la superficie se muestrea con 6.000 puntos por pieza y el margen de
  la zona es 1 mm; un cambio chico (un agujero de 1 x 0,5) puede no verse en la superficie: con --zona lo ve el volumen
  de afuera de la zona; sin zona (conjunto), el volumen de cada solido a 1e-6.
"""
import argparse
import json
import math
import os
import sys

MARGEN_ZONA = 1.0
PUNTOS = 6000


def _solidos(ruta):
    """Los solidos con su NOMBRE del STEP: el nombre vive en las piezas hijas del conjunto que devuelve import_step
    (forma.solids() los devuelve sin nombre; medido el 24/10). Sin hijas con nombre: solido_1, solido_2..."""
    from build123d import import_step
    forma = import_step(ruta)
    globales = forma.solids()           # geometria en coordenadas GLOBALES (con la ubicacion de cada padre)
    nombres = []

    def recorrer(x, nombre_padre=""):
        propio = (getattr(x, "label", "") or "").strip()
        if propio.upper() == "COMPOUND":                 # nombre que pone build123d cuando el STEP no trae uno
            propio = ""
        nombre = propio or nombre_padre
        hijos = list(getattr(x, "children", None) or [])
        if not hijos:
            nombres.extend([nombre] * len(x.solids()))
            return
        for h in hijos:
            recorrer(h, nombre)
    recorrer(forma)
    # revisor 24/10: la geometria de las hojas viene SIN la ubicacion de sus padres (un subconjunto movido daba «igual»):
    # la geometria sale siempre de forma.solids() y de las hojas solo el NOMBRE, si la cantidad coincide
    if len(nombres) != len(globales):
        nombres = [""] * len(globales)
    out = [{"nombre": n, "forma": s} for n, s in zip(nombres, globales)]
    vistos = {}
    for i, s in enumerate(out):
        n = s["nombre"] or f"solido_{i + 1}"
        vistos[n] = vistos.get(n, 0) + 1
        s["nombre"] = n if vistos[n] == 1 else f"{n}_{vistos[n]}"
    return out


def _datos(s):
    from build123d import CenterOf
    f = s["forma"]
    bb = f.bounding_box()
    c = f.center(CenterOf.MASS)
    return {"nombre": s["nombre"], "volumen": f.volume, "area": f.area,
            "caja": [bb.min.X, bb.min.Y, bb.min.Z, bb.max.X, bb.max.Y, bb.max.Z], "centro": [c.X, c.Y, c.Z]}


def _malla(forma):
    import numpy as np
    import trimesh
    verts, tris = forma.tessellate(0.02, 0.1)
    return trimesh.Trimesh(np.array([[v.X, v.Y, v.Z] for v in verts], dtype=float), np.array(tris, dtype=int),
                           process=False)


def _muestras(m, zona=None, n=PUNTOS):
    """Puntos repartidos parejo sobre la superficie (por area), sin los de adentro de la zona agrandada MARGEN_ZONA."""
    import numpy as np
    import trimesh
    P, _ = trimesh.sample.sample_surface_even(m, n * 2, seed=7) if hasattr(trimesh.sample, "sample_surface_even") \
        else trimesh.sample.sample_surface(m, n * 2, seed=7)
    P = np.asarray(P, dtype=float)
    if zona is not None:
        z = np.array(zona, dtype=float)
        dentro = np.all((P >= z[:3] - MARGEN_ZONA) & (P <= z[3:] + MARGEN_ZONA), axis=1)
        P = P[~dentro]
    return P[:n]


def _distancia(fa, fb, zona=None):
    """Mayor distancia de PUNTO A SUPERFICIE entre las dos piezas, en los dos sentidos, afuera de la zona (puntos de una
    contra los triangulos de la otra: dos nubes de puntos sueltos dan centimetros sobre una cara plana grande aunque
    sea la misma, lo cazo el autotest el 24/10). None si no quedan puntos."""
    import trimesh
    ma, mb = _malla(fa), _malla(fb)
    pa, pb = _muestras(ma, zona), _muestras(mb, zona)
    if len(pa) == 0 or len(pb) == 0:
        return None
    _, da, _ = trimesh.proximity.closest_point(mb, pa)
    _, db, _ = trimesh.proximity.closest_point(ma, pb)
    return float(max(da.max(), db.max()))


def _emparejar(antes, despues):
    """[(a, d)] por nombre; los que no tienen nombre propio, por volumen y centro."""
    pares, libres = [], list(despues)
    for a in antes:
        mismo = [d for d in libres if d["nombre"] == a["nombre"] and not a["nombre"].startswith("solido_")]
        if mismo:
            pares.append((a, mismo[0]))
            libres.remove(mismo[0])
    for a in [x for x in antes if all(x is not p[0] for p in pares)]:
        if not libres:
            pares.append((a, None))
            continue
        da = _datos(a)

        def costo(d):
            dd = _datos(d)
            return abs(dd["volumen"] - da["volumen"]) / max(da["volumen"], 1e-9) + math.dist(dd["centro"], da["centro"])
        d = min(libres, key=costo)
        pares.append((a, d))
        libres.remove(d)
    return pares, libres


class NoMedido(Exception):
    pass


def comparar(ruta_antes, ruta_despues, puede_cambiar=(), zona=None, tol=0.01):
    antes, despues = _solidos(ruta_antes), _solidos(ruta_despues)
    if not antes or not despues:            # auditor 24/10: dos STEP de caras sueltas daban «0 -> 0, VERDE»
        raise NoMedido(f"sin solidos: antes {len(antes)}, despues {len(despues)} (un STEP de caras sueltas no se compara)")
    pares, nuevos = _emparejar(antes, despues)
    filas, prohibidos = [], []
    for a, d in pares:
        da = _datos(a)
        if d is None:
            # una pieza que desaparece es rojo SIEMPRE, tambien la que se pidio cambiar (auditor 24/10: el conjunto sin
            # el pedestal, con --puede-cambiar pedestal, daba verde): «cambiar» no es «sacar»
            filas.append({"nombre": da["nombre"], "estado": "desaparecio", "volumen_antes": round(da["volumen"], 3)})
            prohibidos.append(f"{da['nombre']}: desaparecio")
            continue
        dd = _datos(d)
        dv = dd["volumen"] - da["volumen"]
        igual_num = (abs(dv) <= 1e-6 * max(da["volumen"], 1.0)
                     and abs(dd["area"] - da["area"]) <= 1e-6 * max(da["area"], 1.0))
        dist = _distancia(a["forma"], d["forma"], zona if len(antes) == 1 and len(despues) == 1 else None)
        igual = igual_num and dist is not None and dist <= tol
        if zona is not None and len(antes) == 1 and len(despues) == 1:
            # una pieza con zona: lo que importa es AFUERA de la zona: la superficie Y el volumen de afuera (auditor
            # 24/10: un agujero de 1 x 0,5 afuera de la zona pasaba con solo la superficie, que muestrea 6.000 puntos)
            from build123d import Box, Location
            z = zona
            caja = Box(z[3] - z[0], z[4] - z[1], z[5] - z[2]).moved(
                Location(((z[0] + z[3]) / 2, (z[1] + z[4]) / 2, (z[2] + z[5]) / 2)))
            va, vd = (a["forma"] - caja).volume, (d["forma"] - caja).volume
            fila_vol_afuera = round(vd - va, 4)
            igual = dist is not None and dist <= tol and abs(vd - va) <= max(1e-6 * va, 1e-3)
        fila = {"nombre": da["nombre"], "estado": "igual" if igual else "cambio", "dif_volumen_mm3": round(dv, 3),
                "dif_area_mm2": round(dd["area"] - da["area"], 3),
                "dist_superficie_mm": None if dist is None else round(dist, 4),
                "corrimiento_centro_mm": round(math.dist(dd["centro"], da["centro"]), 4)}
        if zona is not None and len(antes) == 1 and len(despues) == 1:
            fila["dif_volumen_afuera_de_la_zona_mm3"] = fila_vol_afuera
        filas.append(fila)
        if not igual and da["nombre"] not in puede_cambiar:
            prohibidos.append(f"{da['nombre']}: cambio (volumen {dv:+.3f} mm3, superficie hasta "
                              f"{'?' if dist is None else round(dist, 3)} mm{' afuera de la zona' if zona else ''})")
    for d in nuevos:
        dd = _datos(d)
        filas.append({"nombre": dd["nombre"], "estado": "nuevo", "volumen_despues": round(dd["volumen"], 3)})
        if dd["nombre"] not in puede_cambiar:
            prohibidos.append(f"{dd['nombre']}: solido nuevo")
    resumen = {"solidos_antes": len(antes), "solidos_despues": len(despues),
               "volumen_antes": round(sum(_datos(a)["volumen"] for a in antes), 3),
               "volumen_despues": round(sum(_datos(d)["volumen"] for d in despues), 3)}
    return {"resumen": resumen, "solidos": filas, "cambio_lo_que_no_se_pidio": prohibidos,
            "puede_cambiar": list(puede_cambiar), "zona": zona, "tol_mm": tol}


def _par_autotest(carpeta):
    """Caja 60 x 40 x 10 con dos agujeros de 6; la zona es la del agujero A. BIEN: A se corre 3 mm; MAL: se corre B."""
    from build123d import Box, Cylinder, Location, export_step
    def pieza(xa, xb):
        b = Box(60, 40, 10) - Cylinder(3, 20).moved(Location((xa, 0, 0))) - Cylinder(3, 20).moved(Location((xb, 0, 0)))
        return b
    rutas = {}
    for nombre, (xa, xb) in {"antes": (-15, 15), "bien": (-12, 15), "mal": (-15, 18)}.items():
        rutas[nombre] = os.path.join(carpeta, f"autotest_{nombre}.step")
        export_step(pieza(xa, xb), rutas[nombre])
    zona = [-22.0, -10.0, -6.0, -5.0, 10.0, 6.0]
    return rutas, zona


def autotest():
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        rutas, zona = _par_autotest(td)
        rb = comparar(rutas["antes"], rutas["bien"], zona=zona)
        rm = comparar(rutas["antes"], rutas["mal"], zona=zona)
    ok = not rb["cambio_lo_que_no_se_pidio"] and bool(rm["cambio_lo_que_no_se_pidio"])
    return ok, rb, rm


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("antes", nargs="?")
    ap.add_argument("despues", nargs="?")
    ap.add_argument("--puede-cambiar", default="", help="nombres de solidos (del STEP) que se pidio cambiar, con comas")
    ap.add_argument("--zona", help="x0,y0,z0,x1,y1,z1: lo unico que puede cambiar en una pieza de un solo solido")
    ap.add_argument("--tol", type=float, default=0.01, help="mm: distancia de superficie que cuenta como igual")
    ap.add_argument("--json", help="escribe el resultado en este archivo")
    ap.add_argument("--autotest", action="store_true")
    a = ap.parse_args(argv)
    ok, rb, rm = autotest()
    if not ok:
        print("AUTOTEST FALLO: el control no separa el agujero que se mueve adentro de la zona del que se mueve afuera")
        print(json.dumps({"bien": rb["cambio_lo_que_no_se_pidio"], "mal": rm["cambio_lo_que_no_se_pidio"]}))
        return 3
    if a.autotest:
        print("AUTOTEST OK: BIEN sin cambios prohibidos; MAL:", rm["cambio_lo_que_no_se_pidio"])
        return 0
    if not (a.antes and a.despues):
        print("uso: diff_modelo.py antes.step despues.step [--puede-cambiar a,b] [--zona ...]")
        return 2
    for r in (a.antes, a.despues):
        if not os.path.isfile(r):
            print(f"NO MEDIDO: no existe {r}")
            return 2
    zona = [float(x) for x in a.zona.split(",")] if a.zona else None
    if zona is not None and (len(zona) != 6 or any(zona[i] > zona[i + 3] for i in range(3))):
        print("NO MEDIDO: --zona se escribe x0,y0,z0,x1,y1,z1 con x0<=x1, y0<=y1, z0<=z1")
        return 2
    if zona is not None and (len(_solidos(a.antes)) != 1 or len(_solidos(a.despues)) != 1):
        print("NO MEDIDO: --zona es para UNA pieza (un solido antes y despues); en un conjunto se usa --puede-cambiar")
        return 2
    puede = [x.strip() for x in a.puede_cambiar.split(",") if x.strip()]
    try:
        r = comparar(a.antes, a.despues, puede, zona, a.tol)
    except NoMedido as e:
        print(f"NO MEDIDO: {e}")
        return 2
    s = r["resumen"]
    print(f"solidos {s['solidos_antes']} -> {s['solidos_despues']}; volumen {s['volumen_antes']} -> "
          f"{s['volumen_despues']} mm3")
    for f in r["solidos"]:
        print(f"  {f['nombre']}: {f['estado']}" + (f" (volumen {f['dif_volumen_mm3']:+} mm3, superficie hasta "
                                                    f"{f['dist_superficie_mm']} mm)" if f["estado"] == "cambio" else ""))
    if a.json:
        with open(a.json, "w", encoding="utf-8") as fh:
            json.dump(r, fh, ensure_ascii=False, indent=1)
    if r["cambio_lo_que_no_se_pidio"]:
        print("ROJO: cambio algo que no se pidio tocar:")
        for p in r["cambio_lo_que_no_se_pidio"]:
            print("  -", p)
        return 3
    print("VERDE: solo cambio lo que se pidio" + (f" ({', '.join(puede)})" if puede else "")
          + (" (afuera de la zona, igual)" if zona else "") + f"; igual = a {a.tol} mm de superficie")
    return 0


if __name__ == "__main__":
    sys.exit(main())

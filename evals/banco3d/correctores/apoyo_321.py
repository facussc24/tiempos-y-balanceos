# -*- coding: utf-8 -*-
# Interprete: C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I (build123d, shapely, numpy).
"""apoyo_321.py - ¿el dispositivo ubica la pieza con el principio 3-2-1?

    python apoyo_321.py <conjunto.json | conjunto.stl | conjunto.step> [--cobertura-min 0.25] [--colineal-rel 0.05]
           [--sep-sec-min 0.3] [--tol-contacto 0.05]

Lee el .json del conjunto (si le pasan el .stl o el .step, busca el .json de al lado): la pieza, la parte de los
apoyos y los puntos de apoyo por plano (primario 3, secundario 2, terciario 1) con la normal de cada plano.

ROJO si:
  - no son 3 + 2 + 1 (4 en el primario = sobredeterminado: se apoya en 3 y el cuarto queda en el aire o la fuerza;
    2 = la pieza gira sobre la linea);
  - algun punto declarado no toca la pieza Y la parte de los apoyos (distancia > --tol-contacto): el json no puede
    decir una cosa y la geometria otra;
  - los 3 del primario estan casi alineados (triangulo < --colineal-rel de la huella) o el triangulo cubre menos de
    --cobertura-min de la huella de la pieza sobre ese plano;
  - el centro de masa de la pieza, proyectado sobre el plano primario, cae fuera del triangulo (se vuelca);
  - los 2 del secundario estan a menos de --sep-sec-min del largo de la pieza en esa direccion (la pieza gira).
Umbrales del banco (23/10/2026), sin fuente de Barack: van en el JSON de salida.

Salida: UNA linea JSON en stdout; codigo 0 verde, 3 rojo, 2 error.
"""
import argparse
import json
import os
import sys

_FD = os.dup(1)
os.dup2(2, 1)

NOMBRE = "apoyo_321"
ESPERADO = {"primario": 3, "secundario": 2, "terciario": 1}


def salir(res, codigo):
    sys.stdout.flush()
    os.dup2(_FD, 1)
    os.write(1, (json.dumps(res, ensure_ascii=False) + "\n").encode("utf-8"))
    os._exit(codigo)


def leer_json(arch):
    base, ext = os.path.splitext(arch)
    j = arch if ext.lower() == ".json" else base + ".json"
    if not os.path.exists(j):
        raise FileNotFoundError("falta el json del conjunto: %s" % j)
    return json.load(open(j, encoding="utf-8")), os.path.dirname(os.path.abspath(j))


def base_plano(n):
    import numpy as np
    n = np.asarray(n, float)
    n = n / np.linalg.norm(n)
    a = np.array([1.0, 0, 0]) if abs(n[0]) < 0.9 else np.array([0, 1.0, 0])
    u = np.cross(n, a)
    u /= np.linalg.norm(u)
    return n, u, np.cross(n, u)


def main():
    import numpy as np
    from shapely.geometry import MultiPoint, Point, Polygon
    ap = argparse.ArgumentParser()
    ap.add_argument("archivo")
    ap.add_argument("--cobertura-min", type=float, default=0.25)
    ap.add_argument("--colineal-rel", type=float, default=0.05)
    ap.add_argument("--sep-sec-min", type=float, default=0.3)
    ap.add_argument("--tol-contacto", type=float, default=0.05)
    a = ap.parse_args()
    meta, d = leer_json(a.archivo)
    ap_ = meta["apoyos"]
    motivos, med = [], {"umbrales": {"cobertura_min": a.cobertura_min, "colineal_rel": a.colineal_rel,
                                    "sep_sec_min": a.sep_sec_min, "tol_contacto_mm": a.tol_contacto,
                                    "_fuente": "umbrales del banco (23/10/2026), sin fuente de Barack"}}
    cuenta = {k: len(ap_.get(k, {}).get("puntos", [])) for k in ESPERADO}
    med["cuenta"] = cuenta
    for k, n in ESPERADO.items():
        if cuenta[k] != n:
            extra = (" (sobredeterminado: un apoyo rigido de mas)" if cuenta[k] > n else
                     " (falta un apoyo: la pieza gira o se hamaca)")
            motivos.append("plano %s con %d apoyos, el 3-2-1 pide %d%s" % (k, cuenta[k], n, extra))

    # geometria real: contacto de cada punto y huella / centro de masa de la pieza
    from build123d import import_step, Vertex, CenterOf
    arch = meta.get("archivos", {})
    pieza = import_step(os.path.join(d, arch[meta["pieza"]]))
    apoyos = import_step(os.path.join(d, arch[meta["parte_apoyos"]])) if meta.get("parte_apoyos") else None
    sin_tocar = []
    for k in ESPERADO:
        for p in ap_.get(k, {}).get("puntos", []):
            v = Vertex(*p)
            dp = pieza.distance_to(v)
            da = apoyos.distance_to(v) if apoyos is not None else 0.0
            if dp > a.tol_contacto or da > a.tol_contacto:
                sin_tocar.append({"plano": k, "punto": p, "a_pieza_mm": round(dp, 3), "a_apoyo_mm": round(da, 3)})
    med["puntos_que_no_tocan"] = sin_tocar
    if sin_tocar:
        motivos.append("%d punto(s) declarado(s) no tocan la pieza y el apoyo a la vez" % len(sin_tocar))
    if apoyos is None:
        med["aviso"] = "el json no nombra la parte de los apoyos: solo se mide contacto con la pieza"

    prim = ap_.get("primario", {})
    if prim.get("puntos"):
        n, u, w = base_plano(prim["normal"])
        verts = np.array([[x.X, x.Y, x.Z] for x in pieza.vertices()], float)
        # la huella se mide sobre la malla de la pieza, no sobre la caja que la encierra
        from build123d import export_stl
        import tempfile
        import trimesh
        tmp = os.path.join(tempfile.mkdtemp(), "p.stl")
        export_stl(pieza, tmp, tolerance=0.1)
        verts = np.asarray(trimesh.load(tmp, force="mesh").vertices, float)
        huella = MultiPoint([(x @ u, x @ w) for x in verts]).convex_hull
        pts = np.asarray(prim["puntos"], float)
        p2 = [(x @ u, x @ w) for x in pts]
        c = pieza.center(CenterOf.MASS)
        c2 = Point(np.array([c.X, c.Y, c.Z]) @ u, np.array([c.X, c.Y, c.Z]) @ w)
        med["huella_mm2"] = round(float(huella.area), 1)
        med["centro_masa"] = [round(c.X, 2), round(c.Y, 2), round(c.Z, 2)]
        if len(pts) >= 3:
            poli = MultiPoint(p2).convex_hull
            area = float(poli.area) if isinstance(poli, Polygon) else 0.0
            cob = area / float(huella.area)
            med["area_apoyo_primario_mm2"] = round(area, 1)
            med["cobertura"] = round(cob, 3)
            if cob < a.colineal_rel:
                motivos.append("los apoyos del primario estan casi alineados: cubren %.1f %% de la huella "
                               "(la pieza se hamaca sobre la linea)" % (100 * cob))
            elif cob < a.cobertura_min:
                motivos.append("el triangulo del primario cubre %.1f %% de la huella (minimo %.0f %%)"
                               % (100 * cob, 100 * a.cobertura_min))
            if area > 0:
                marg = float(poli.exterior.distance(c2)) * (1 if poli.contains(c2) else -1)
                med["margen_centro_masa_mm"] = round(marg, 2)
                if marg < 0:
                    motivos.append("el centro de masa cae %.1f mm afuera del apoyo primario (se vuelca)" % -marg)
            else:
                motivos.append("el apoyo primario no tiene area (puntos en linea)")

    sec = ap_.get("secundario", {})
    if len(sec.get("puntos", [])) == 2:
        p, q = (np.asarray(x, float) for x in sec["puntos"])
        dirv = (q - p) / max(np.linalg.norm(q - p), 1e-9)
        bb = pieza.bounding_box()
        largo = abs(dirv[0]) * bb.size.X + abs(dirv[1]) * bb.size.Y + abs(dirv[2]) * bb.size.Z
        sep = float(np.linalg.norm(q - p))
        med["separacion_secundario_mm"] = round(sep, 1)
        med["separacion_secundario_rel"] = round(sep / largo, 3) if largo else None
        if largo and sep / largo < a.sep_sec_min:
            motivos.append("los 2 apoyos del secundario estan a %.0f mm (%.0f %% del largo, minimo %.0f %%)"
                           % (sep, 100 * sep / largo, 100 * a.sep_sec_min))
    normales = [ap_[k]["normal"] for k in ESPERADO if k in ap_ and ap_[k].get("normal")]
    if len(normales) == 3:
        nn = [np.asarray(x, float) / np.linalg.norm(x) for x in normales]
        dots = [abs(float(nn[i] @ nn[j])) for i, j in ((0, 1), (0, 2), (1, 2))]
        med["planos_perpendiculares_max_coseno"] = round(max(dots), 3)
        if max(dots) > 0.1:
            motivos.append("los tres planos de apoyo no son perpendiculares entre si")
    if motivos:
        det = "; ".join(motivos)
    else:
        det = ("3-2-1: primario cubre %.0f %% de la huella, centro de masa a %.1f mm del borde, secundario separado "
               "%.0f %% del largo" % (100 * med.get("cobertura", 0), med.get("margen_centro_masa_mm", 0),
                                      100 * (med.get("separacion_secundario_rel") or 0)))
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

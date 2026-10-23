# -*- coding: utf-8 -*-
# Interprete: C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I (trimesh, shapely, numpy).
"""estabilidad_apoyo.py - la pieza apoyada sobre su cara de uso, ¿se queda quieta o se hamaca?

    python estabilidad_apoyo.py <pieza.stl | pieza.step | pieza.json> [--cara abajo|arriba] [--tol 0.3]
           [--area-min-rel 0.25] [--margen-min 10] [--version v14] [--sin-eval]

Dos capas:
  1. GEOMETRIA (siempre): apoya la pieza sobre un plano rigido por la cara elegida (abajo = la z minima). Puntos de la
     malla a menos de --tol del plano = zona de apoyo; su casco convexo = poligono de apoyo. Se proyecta el centro de
     masa (malla cerrada) y se mide la distancia al borde del poligono. ROJO si el poligono tiene area 0 (2 puntos o una
     linea), si cubre menos de --area-min-rel de la huella de la pieza, o si el centro de masa cae a menos de
     --margen-min mm del borde (o afuera).
  2. ENVOLTORIO de eval_casos_3d.py (solo si la pieza es una version conocida del virolador del Upper Trim): si el .json
     de al lado (o --version) nombra una version de data/casos_3d.json, se exige que el sha256 del STL sea el del
     archivo real de esa version (tabla de abajo) y se corre eval_casos_3d.py --solo <v> por subprocess. ROJO si A2
     (ventana) o A3 (asiento) dan ROJO, o si A1 da ROJO y A1b (4 coplanares) no da VERDE. Lo que no se pudo medir
     queda en medidas.sin_dato y en el detalle: no se tapa.

Por que dos capas: la falla real de la v14 («se hamaca en la mano», 13/10) NO se ve apoyando la pieza en una mesa (da
verde con 30 mm de margen); se ve en la ventana de asiento y en la simulacion apretando, que es lo que juzga
eval_casos_3d.py. La capa geometrica caza el fondo convexo o el apoyo en linea.

Salida: UNA linea JSON en stdout; codigo 0 verde, 3 rojo, 2 error.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile

_FD = os.dup(1)
os.dup2(2, 1)          # todo el ruido de las librerias va a stderr; stdout queda para la linea JSON

NOMBRE = "estabilidad_apoyo"
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
EVAL = os.path.join(REPO, ".claude", "skills", "cad-design", "scripts", "eval_casos_3d.py")
CASOS = os.path.join(REPO, ".claude", "skills", "cad-design", "data", "casos_3d.json")
SIM_N = r"C:\Dev\_utrim\out\sim_asiento.json"
SIM_P = r"C:\Dev\_utrim\out\sim_asiento_punta.json"
# sha256 del STL real de cada version (nube de Ingenieria, 5. 3D/VWA/PATAGONIA - VIROLADOR UPPER TRIM), medido 23/10/2026
SHA_VERSION = {
    "v14": "e19246cae52fe1f0afb6a37671a686b4be3cf60dbea18e56647c1af20a6d0914",
    "v16": "48aa8294ee934f51bae41de9c3183368fb881dbf63113d9ea30d4149f39acc82",
}


def salir(res, codigo):
    sys.stdout.flush()
    os.dup2(_FD, 1)
    os.write(1, (json.dumps(res, ensure_ascii=False) + "\n").encode("utf-8"))
    os._exit(codigo)


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def resolver(arch):
    """devuelve (ruta del STL o STEP, meta del json o {})"""
    base, ext = os.path.splitext(arch)
    meta = {}
    if ext.lower() == ".json":
        meta = json.load(open(arch, encoding="utf-8"))
        d = os.path.dirname(arch)
        cand = [os.path.join(d, meta[k]) for k in ("stl", "step") if meta.get(k)]
        cand += [base + ".stl", base + ".step"]
        for c in cand:
            if os.path.exists(c):
                return c, meta
        raise FileNotFoundError("el json no apunta a ningun STL/STEP que exista")
    if not os.path.exists(arch):
        raise FileNotFoundError(arch)
    if os.path.exists(base + ".json"):
        meta = json.load(open(base + ".json", encoding="utf-8"))
    return arch, meta


def cargar(ruta):
    import trimesh
    if ruta.lower().endswith((".step", ".stp")):
        from build123d import import_step, export_stl
        tmp = os.path.join(tempfile.mkdtemp(), "p.stl")
        export_stl(import_step(ruta), tmp, tolerance=0.05)
        ruta = tmp
    return trimesh.load(ruta, force="mesh")


def geometria(m, cara, tol, area_min_rel, margen_min):
    import numpy as np
    from shapely.geometry import MultiPoint, Point
    v = np.asarray(m.vertices, dtype=float)
    giro = np.array([1.0, -1.0, -1.0])           # dar vuelta la pieza: 180 grados alrededor de X
    if cara == "arriba":
        v = v * giro
    z0 = v[:, 2].min()
    sop = v[v[:, 2] < z0 + tol][:, :2]
    poli = MultiPoint([tuple(p) for p in sop]).convex_hull
    huella = MultiPoint([tuple(p) for p in v[:, :2]]).convex_hull
    estanca = bool(m.is_watertight)
    c = np.asarray(m.center_mass if estanca else m.centroid, dtype=float)
    if cara == "arriba":
        c = c * giro
    pc = Point(c[0], c[1])
    area = float(poli.area) if poli.geom_type == "Polygon" else 0.0
    if area > 0:
        margen = float(poli.exterior.distance(pc)) * (1 if poli.contains(pc) else -1)
    else:
        margen = -float(poli.distance(pc)) if not poli.is_empty else None
    rel = area / float(huella.area) if huella.area > 0 else 0.0
    motivos = []
    if area <= 1e-6:
        motivos.append("apoya en %s: no hay superficie de apoyo (se hamaca)" % poli.geom_type)
    elif rel < area_min_rel:
        motivos.append("el apoyo cubre %.1f %% de la huella (minimo %.0f %%)" % (100 * rel, 100 * area_min_rel))
    if margen is None or margen < margen_min:
        motivos.append("el centro de masa queda a %s mm del borde del apoyo (minimo %.1f)"
                       % ("?" if margen is None else "%.1f" % margen, margen_min))
    med = {"cara": cara, "tol_mm": tol, "puntos_apoyo": int(len(sop)), "area_apoyo_mm2": round(area, 1),
           "area_huella_mm2": round(float(huella.area), 1), "apoyo_sobre_huella": round(rel, 3),
           "margen_cm_mm": None if margen is None else round(margen, 2),
           "centro_masa": [round(float(x), 2) for x in c], "malla_cerrada": estanca,
           "umbrales": {"area_min_rel": area_min_rel, "margen_min_mm": margen_min, "tol_mm": tol,
                        "_fuente": "umbrales del banco (23/10/2026), sin fuente de Barack: a calibrar"}}
    aviso = None if estanca else "la malla no es cerrada: el centro de masa es aproximado"
    return motivos, med, aviso


def envoltorio(version, ruta):
    """corre eval_casos_3d.py --solo <version> y aplica la regla de veredicto (ver docstring)."""
    out = {"version": version, "eval": EVAL}
    sin = []
    if version not in SHA_VERSION:
        return ["la version %s no tiene sha registrado en el corrector: no se puede atar el archivo a la version"
                % version], out, sin
    s = sha(ruta) if ruta.lower().endswith(".stl") else None
    out["sha256"] = s
    if s != SHA_VERSION[version]:
        return ["el archivo dice ser la %s pero su sha256 no es el del STL real de esa version" % version], out, sin
    tmp = os.path.join(tempfile.mkdtemp(), "eval.json")
    cmd = [sys.executable, "-I", EVAL, "--casos", CASOS, "--solo", version, "--salida", tmp]
    if os.path.exists(SIM_N):
        cmd += ["--sim-normal", SIM_N]
        if os.path.exists(SIM_P):
            cmd += ["--sim-punta", SIM_P]
    else:
        cmd += ["--sin-sim"]
        sin.append("A3_asiento (no esta %s)" % SIM_N)
    out["comando"] = " ".join(os.path.basename(x) if i < 3 else x for i, x in enumerate(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
    if not os.path.exists(tmp):
        raise RuntimeError("eval_casos_3d.py no dejo salida: " + (r.stderr or r.stdout)[-300:])
    res = json.load(open(tmp, encoding="utf-8"))["resultado"][version]
    v = {k: x.get("veredicto") for k, x in res.items()}
    out["veredictos"] = v
    out["regla"] = "ROJO si A2 o A3 ROJO, o si A1 ROJO y A1b no VERDE; un SIN DATO no da verde: se informa"
    out["detalle_eval"] = {k: {kk: vv for kk, vv in x.items() if kk != "veredicto"} for k, x in res.items()}
    mot = []
    if v.get("A2_ventana") == "ROJO":
        d = res["A2_ventana"]
        mot.append("ventana de asiento: banda %s mm, punta %s mm (%s)" % (d.get("banda_mm"), d.get("punta_mm"),
                                                                         d.get("umbral")))
    if v.get("A3_asiento") == "ROJO":
        d = res["A3_asiento"]
        mot.append("simulacion apretando: se hamaca mas de 0,3 mm en %s %% de los casos (max %s mm)"
                   % (d.get("hamaca_pct_hoy"), d.get("hamaca_max_mm_hoy")))
    if v.get("A1_apoyos") == "ROJO" and v.get("A1b_4_2_1") != "VERDE":
        mot.append("apoyos: %s" % res["A1_apoyos"].get("motivo"))
    sin += ["%s (eval_casos_3d)" % k for k, x in v.items() if x == "SIN DATO"]
    return mot, out, sin


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("archivo")
    ap.add_argument("--cara", default="abajo", choices=["abajo", "arriba"])
    ap.add_argument("--tol", type=float, default=0.3)
    ap.add_argument("--area-min-rel", type=float, default=0.25)
    ap.add_argument("--margen-min", type=float, default=10.0)
    ap.add_argument("--version", default=None, help="version del virolador en casos_3d.json (si no, la del .json)")
    ap.add_argument("--sin-eval", action="store_true", help="solo la capa geometrica (se dice)")
    a = ap.parse_args()
    ruta, meta = resolver(a.archivo)
    m = cargar(ruta)
    motivos, med, aviso = geometria(m, a.cara, a.tol, a.area_min_rel, a.margen_min)
    medidas = {"geometria": med, "archivo": os.path.basename(ruta), "veredicto_geometria":
               "rojo" if motivos else "verde"}
    version = a.version or meta.get("version_casos_3d")
    sin = []
    if version and not a.sin_eval:
        mot2, out, sin = envoltorio(version, ruta)
        motivos += mot2
        medidas["eval_casos_3d"] = out
        medidas["veredicto_eval"] = "rojo" if mot2 else "verde"
    elif version:
        sin.append("envoltorio eval_casos_3d salteado a proposito (--sin-eval)")
    medidas["sin_dato"] = sin
    if motivos:
        det = "; ".join(motivos)
    else:
        det = ("apoya en %.0f mm2 (%.0f %% de la huella), centro de masa a %.1f mm del borde"
               % (med["area_apoyo_mm2"], 100 * med["apoyo_sobre_huella"], med["margen_cm_mm"]))
        if version and "eval_casos_3d" in medidas:     # con --sin-eval no hay envoltorio (23/10: KeyError)
            det += "; eval_casos_3d %s: %s" % (version, medidas["eval_casos_3d"].get("veredictos"))
    if aviso:
        det += " | aviso: " + aviso
    if sin:
        det += " | sin dato: " + ", ".join(sin)
    salir({"corrector": NOMBRE, "veredicto": "rojo" if motivos else "verde", "detalle": det, "medidas": medidas},
          3 if motivos else 0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        salir({"corrector": NOMBRE, "veredicto": "error", "detalle": "argumentos: %s" % e, "medidas": {}}, 2)
    except Exception as e:  # noqa: BLE001
        salir({"corrector": NOMBRE, "veredicto": "error", "detalle": "%s: %s" % (type(e).__name__, e),
               "medidas": {}}, 2)

#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""QUE SON las caras libres de un STEP, antes de que alguien mida contra ellas.

Una cara LIBRE es una superficie que no pertenece a ningun solido. gmsh las descarta por
default (highestDimOnly=True) y nadie se entera de que existieron. Peor todavia es
activarlas sin saber que son: en un panel de cliente esas caras eran el VINILO ya modelado,
a ~0,96 mm de la pared de plastico. La misma ranura media 12,95 mm con las caras libres
apagadas (envolvente de las paredes) y 11,03 con las caras libres prendidas (superficie del
vinilo). Se dimensiono un utillaje contra el vinilo y despues se le volvio a restar el
espesor del vinilo: contado DOS VECES, el macho salio 2,11 mm angosto y no tocaba nada. Dos
verificaciones "independientes" confirmaron el numero equivocado, porque las tres
mediciones compartian el mismo criterio: ninguna se pregunto QUE eran esas caras.

Lo que delato la verdad al final es una sola observacion, y es la que este CLI automatiza:
la distancia del solido a la cara libre era 0,960 mm y el espesor de tela declarado 0,920.
UN OFFSET CONSTANTE QUE COINCIDE CON UN ESPESOR DE MATERIAL DECLARADO NO ES UNA PARED:
ES UNA CAPA. Y una capa no se mide como si fuera geometria — en una luz interna corre la
cota 2 x offset.

QUE HACE
  1. cuenta las caras libres y las agrupa por OFFSET (mediana de la distancia al solido mas
     cercano) — la agrupacion por conectividad no alcanza: en el caso real las 112 caras
     forman UN solo shell pero conviven dos offsets distintos (0,500 y 0,966 mm);
  2. por grupo mide mediana + dispersion (IQR, p95-p5) y la FRACCION MESETA = que parte de
     los puntos cae dentro de +-tol de la mediana. La meseta es el criterio duro: una capa
     tiene meseta ~1,00, una superficie de verdad tiene meseta ~0,1;
  3. compara el offset contra los espesores candidatos de --espesores (tela, pintura, grano);
  4. clasifica cada grupo:
       CAPA DE MATERIAL         offset constante que coincide con un espesor declarado
       SUPERFICIE DE CONSTRUCCION  offset constante que no coincide con nada declarado
       GEOMETRIA REAL           offset variable (y no pegada a ninguna capa)
       SIN CLASIFICAR           ni una cosa ni la otra -> exit 2, nadie mide a ciegas.

AUTOTEST OBLIGATORIO (corre en CADA invocacion, no se puede saltear)
  Construye aca mismo un par sintetico y exige que el detector los SEPARE:
    MAL  = caja + superficie offset a 0,92 mm  -> tiene que decir CAPA DE MATERIAL
    BIEN = caja + cara libre inclinada (0,5 a 8 mm) -> tiene que decir GEOMETRIA REAL
  Si el par no separa: exit 3. No se juzga ningun STEP con un detector que no probo
  distinguir — es la leccion de los gates que se "validaron" dos veces contra una pieza
  buena y quedaron ciegos las dos.

USO
  clasificar_caras_libres.py <archivo.stp> --espesores 0.92,0.5 [--lc 1.5] [--json out.json]
  clasificar_caras_libres.py --solo-autotest

SALIDA
  0 = todas las caras libres quedaron clasificadas
  2 = quedaron caras libres SIN CLASIFICAR (o el STEP no tiene solido contra que medir,
      o no se paso --espesores y entonces capa y superficie de construccion no se separan)
  3 = el autotest no separo el par sintetico
"""
import argparse
import json
import os
import shutil
import sys
import tempfile
import time
from contextlib import contextmanager

import numpy as np

CAPA = "CAPA DE MATERIAL"
CONSTR = "SUPERFICIE DE CONSTRUCCION"
REAL = "GEOMETRIA REAL"
NC = "SIN CLASIFICAR"

LC_DEF = 1.5            # tamano de malla del solido (chordal error tipico << 0,01 mm)
MAX_PTS = 400           # puntos de consulta por cara libre
TOL_MESETA = 0.05       # mm; ancho de la banda para contar la meseta
MESETA_CTE = 0.75       # meseta >= (junto con IQR chico) -> offset CONSTANTE
MESETA_VAR = 0.50       # meseta <= -> offset VARIABLE
IQR_VAR = 4.0           # IQR >= IQR_VAR x TOL_MESETA -> offset VARIABLE
TOL_GRUPO = 0.05        # mm; salto entre medianas para cortar un grupo (single linkage)
TOL_ESPESOR = 0.10      # mm; |offset - espesor| para decir que coincide
MIN_PTS = 6             # menos puntos que esto en una cara = no se puede medir
COINCIDENTE = 0.02      # mm; offset por debajo de esto = cara pegada al solido


# --------------------------------------------------------------------------------------
# medicion
# --------------------------------------------------------------------------------------
@contextmanager
def _gmsh(verbosidad=0):
    import gmsh
    gmsh.initialize()
    try:
        gmsh.option.setNumber("General.Terminal", 0)
        gmsh.option.setNumber("General.Verbosity", verbosidad)
        gmsh.model.add("m")
        yield gmsh
    finally:
        gmsh.finalize()


@contextmanager
def _sin_ruido():
    """Tapa el fd 1 mientras escribe OCC.

    El writer de STEP imprime su cabecera desde C++, o sea que no lo apagan ni
    General.Terminal ni General.Verbosity: hay que desviar el descriptor. Si no, el
    autotest ensucia la salida con 20 lineas y encima salen ANTES del encabezado, porque
    el buffer de Python todavia no se vacio.
    """
    sys.stdout.flush()
    fd = sys.stdout.fileno()
    copia = os.dup(fd)
    nulo = os.open(os.devnull, os.O_WRONLY)
    try:
        os.dup2(nulo, fd)
        yield
    finally:
        sys.stdout.flush()
        os.dup2(copia, fd)
        os.close(copia)
        os.close(nulo)


def _tris(gmsh, tags, xyz):
    out = []
    for st in tags:
        et, _, en = gmsh.model.mesh.getElements(2, st)
        for e, n in zip(et, en):
            if e == 2:  # triangulo de 3 nodos
                out.append(xyz[np.asarray(n, dtype=np.int64).reshape(-1, 3)])
    return np.concatenate(out) if out else np.zeros((0, 3, 3))


def _area(T):
    if not len(T):
        return 0.0
    return float(np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1).sum() / 2)


def medir(path, lc=LC_DEF, curvatura=0.0, max_pts=MAX_PTS, semilla=0):
    """Carga el STEP y devuelve, por cara libre, su distancia al solido mas cercano.

    El solido se mide con su MALLA (punto-triangulo exacto via trimesh), no con un KDTree
    de nodos: con lc=1,5 un KDTree de nodos mete hasta 0,26 mm de error lateral y eso solo
    ya destruye la dispersion, que es justo el numero que decide si hay capa o no.
    """
    import trimesh
    t0 = time.time()
    with _gmsh() as gmsh:
        if not os.path.isfile(path):
            raise FileNotFoundError("No existe el archivo 3D: %s" % path)
        gmsh.model.occ.importShapes(path, highestDimOnly=False)
        gmsh.model.occ.synchronize()
        n_sol = len(gmsh.model.getEntities(3))
        libres, ligadas, curvas = [], [], {}
        for _, t in gmsh.model.getEntities(2):
            arriba, abajo = gmsh.model.getAdjacencies(2, t)
            if arriba.size:
                ligadas.append(t)
            else:
                libres.append(t)
                curvas[t] = set(int(c) for c in abajo)
        tipos = {t: gmsh.model.getType(2, t) for t in libres}
        if libres:
            gmsh.option.setNumber("Mesh.MeshSizeMax", lc)
            gmsh.option.setNumber("Mesh.MeshSizeMin", lc * 0.3)
            if curvatura:
                gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", curvatura)
            gmsh.model.mesh.generate(2)
            tags, coords, _ = gmsh.model.mesh.getNodes()
            tags = np.asarray(tags, dtype=np.int64)
            xyz = np.zeros((int(tags.max()) + 1, 3)) if len(tags) else np.zeros((1, 3))
            xyz[tags] = np.asarray(coords, dtype=float).reshape(-1, 3)
            T_sol = _tris(gmsh, ligadas, xyz)
            T_lib = {t: _tris(gmsh, [t], xyz) for t in libres}
        else:
            T_sol, T_lib = np.zeros((0, 3, 3)), {}

    pq = None
    if len(T_sol):
        ms = trimesh.Trimesh(vertices=T_sol.reshape(-1, 3),
                             faces=np.arange(len(T_sol) * 3).reshape(-1, 3), process=False)
        ms.merge_vertices()
        pq = trimesh.proximity.ProximityQuery(ms)

    rng = np.random.default_rng(semilla)
    caras = []
    for t in libres:
        T = T_lib[t]
        f = {"tag": int(t), "tipo": tipos[t], "area": _area(T), "curvas": curvas[t],
             "n": 0, "d": None, "motivo": None}
        p = np.unique(T.reshape(-1, 3), axis=0) if len(T) else np.zeros((0, 3))
        if pq is None:
            f["motivo"] = "el STEP no tiene ningun solido contra que medir"
        elif len(p) < MIN_PTS:
            f["motivo"] = "solo %d puntos de malla (bajar --lc)" % len(p)
        else:
            if len(p) > max_pts:
                p = p[rng.choice(len(p), max_pts, replace=False)]
            _, d, _ = pq.on_surface(p)
            f["n"], f["d"] = len(p), np.asarray(d, dtype=float)
        caras.append(f)
    return {"path": path, "n_solidos": n_sol, "n_caras": len(libres) + len(ligadas),
            "n_libres": len(libres), "n_ligadas": len(ligadas), "caras": caras,
            "tri_solido": len(T_sol), "seg": time.time() - t0, "lc": lc}


# --------------------------------------------------------------------------------------
# agrupacion y clasificacion
# --------------------------------------------------------------------------------------
def _stats(d, tol=TOL_MESETA):
    m = float(np.median(d))
    q = np.percentile(d, [5, 25, 75, 95])
    return {"mediana": m, "p5": float(q[0]), "p95": float(q[3]),
            "iqr": float(q[2] - q[1]), "rango90": float(q[3] - q[0]),
            "meseta": float(np.mean(np.abs(d - m) <= tol)),
            "min": float(d.min()), "max": float(d.max())}


def agrupar(caras, tol_grupo=TOL_GRUPO):
    """Agrupa por OFFSET (single linkage sobre la mediana por cara).

    Por conectividad NO alcanza: en el panel real las 112 caras libres cuelgan de un unico
    shell y ahi adentro conviven una capa a 0,500 y otra a 0,966. Agrupadas por topologia
    quedaban promediadas en un solo numero que no es ninguno de los dos.
    """
    med = [(c["tag"], float(np.median(c["d"]))) for c in caras if c["d"] is not None]
    med.sort(key=lambda kv: kv[1])
    grupos, act = [], []
    for tag, m in med:
        if act and m - act[-1][1] > tol_grupo:
            grupos.append(act)
            act = []
        act.append((tag, m))
    if act:
        grupos.append(act)
    porTag = {c["tag"]: c for c in caras}
    out = []
    for i, g in enumerate(grupos, 1):
        miembros = [porTag[t] for t, _ in g]
        d = np.concatenate([c["d"] for c in miembros])
        gr = _stats(d)
        gr.update({"id": i, "caras": miembros, "n_caras": len(miembros), "n": len(d),
                   "area": sum(c["area"] for c in miembros),
                   "spread_medianas": g[-1][1] - g[0][1],
                   "curvas": set().union(*[c["curvas"] for c in miembros])})
        out.append(gr)
    sin = [c for c in caras if c["d"] is None]
    return out, sin


def constancia(g, tol=TOL_MESETA):
    """CONSTANTE / VARIABLE / DUDOSO con DOS numeros, no uno.

    IQR = el nucleo de la distribucion (aguanta 25 % de outliers de cada lado). Los puntos
    del BORDE de una cara libre tienen como solido mas cercano una pared perpendicular, no
    la de atras, asi que meten cola: esa cola es un efecto de perimetro/area (o sea, de
    mallado), no geometria, y por eso no puede decidir sola.
    MESETA = que fraccion de la cara esta efectivamente sobre el offset. Ataja el caso que
    el IQR no ve: media cara plana y media rampa puede dar IQR chico y no es una capa.
    Se pide que las DOS cierren; si se contradicen, el grupo queda DUDOSO a proposito.
    """
    if g["iqr"] <= tol and g["meseta"] >= MESETA_CTE:
        return "CONSTANTE"
    if g["iqr"] >= IQR_VAR * tol or g["meseta"] <= MESETA_VAR:
        return "VARIABLE"
    return "DUDOSO"


def clasificar(grupos, espesores, tol_espesor=TOL_ESPESOR):
    """Clasifica cada grupo. El orden importa: primero constante/variable, despues espesor."""
    for g in grupos:
        g["espesor"], g["dif_espesor"] = None, None
        if espesores:
            e = min(espesores, key=lambda x: abs(g["mediana"] - x))
            if abs(g["mediana"] - e) <= tol_espesor:
                g["espesor"], g["dif_espesor"] = e, g["mediana"] - e
        g["offset"] = constancia(g)
        if g["offset"] == "CONSTANTE":
            if g["espesor"] is not None:
                g["clase"] = CAPA
                g["por_que"] = ("offset constante %.4f mm que coincide con el espesor "
                                "declarado %.3f (dif %+.3f)"
                                % (g["mediana"], g["espesor"], g["dif_espesor"]))
            elif not espesores:
                g["clase"] = NC
                g["por_que"] = ("offset constante %.4f mm pero no se paso --espesores: "
                                "capa y superficie de construccion no se pueden separar"
                                % g["mediana"])
            elif g["mediana"] <= COINCIDENTE:
                g["clase"] = CONSTR
                g["por_que"] = ("pegada al solido (%.4f mm): cara duplicada o de "
                                "construccion, no es material" % g["mediana"])
            else:
                g["clase"] = CONSTR
                g["por_que"] = ("offset constante %.4f mm que NO coincide con ningun "
                                "espesor declarado (%s)"
                                % (g["mediana"], ", ".join("%.3f" % e for e in espesores)))
        elif g["offset"] == "VARIABLE":
            g["clase"] = REAL
            g["por_que"] = ("offset variable (%.3f a %.3f mm, IQR %.3f, meseta %.2f): sigue "
                            "una forma propia, no un offset"
                            % (g["min"], g["max"], g["iqr"], g["meseta"]))
            if g["min"] <= COINCIDENTE:
                g["por_que"] += "; toca el solido y se aleja -> parece cerrar volumen"
        else:
            g["clase"] = NC
            g["por_que"] = ("IQR %.4f y meseta %.2f se contradicen (constante pide IQR<=%.3f "
                            "y meseta>=%.2f; variable pide IQR>=%.3f o meseta<=%.2f). No se "
                            "puede afirmar que es"
                            % (g["iqr"], g["meseta"], TOL_MESETA, MESETA_CTE,
                               IQR_VAR * TOL_MESETA, MESETA_VAR))

    # Una cara que ARRANCA en una capa y se despega (fillet, borde vuelto, radio de la
    # tela) es parte de la misma capa aunque su offset varie. Se detecta por topologia:
    # comparte curva con un grupo ya clasificado CAPA. Sin esto, los bordes de la capa se
    # reportarian como geometria real y alguien mediria justo ahi.
    capas = [g for g in grupos if g["clase"] == CAPA]
    for g in grupos:
        g["pegado_a"] = sorted(o["id"] for o in grupos
                               if o is not g and (g["curvas"] & o["curvas"]))
        if g["clase"] != REAL or not capas:
            continue
        madres = [c for c in capas if g["curvas"] & c["curvas"]]
        if madres:
            g["clase"] = CAPA
            g["transicion"] = True
            g["por_que"] = ("offset variable (%.3f a %.3f mm) pero comparte borde con la(s) "
                            "capa(s) %s: es el canto/fillet de la capa, no una pared. "
                            "Toca ademas los grupos %s"
                            % (g["min"], g["max"],
                               ", ".join("#%d de %.3f mm" % (c["id"], c["mediana"])
                                         for c in madres),
                               g["pegado_a"] or "ninguno"))
    return grupos


# --------------------------------------------------------------------------------------
# informe
# --------------------------------------------------------------------------------------
def informe(res, grupos, sin, espesores, mostrar=30):
    print("ARCHIVO   %s" % os.path.basename(res["path"]))
    print("  solidos %d | caras %d = %d de solido + %d LIBRES | malla lc=%.2f (%d tri) "
          "| %.1f s" % (res["n_solidos"], res["n_caras"], res["n_ligadas"],
                        res["n_libres"], res["lc"], res["tri_solido"], res["seg"]))
    if not res["n_libres"]:
        print("  sin caras libres: el STEP es solo solido, se puede medir de frente.")
        return
    print("  espesores candidatos: %s"
          % (", ".join("%.3f" % e for e in espesores) if espesores else "NINGUNO (--espesores)"))
    print("\nGRUPOS DE CARAS LIBRES (por offset al solido mas cercano)")
    print("  %-3s %5s %5s %10s %8s %8s %7s %7s  %s"
          % ("id", "caras", "n", "area mm2", "offset", "IQR", "p95-p5", "meseta", "clase"))
    for g in sorted(grupos, key=lambda x: x["mediana"]):
        print("  %-3d %5d %5d %10.1f %8.4f %8.4f %7.4f %7.2f  %s"
              % (g["id"], g["n_caras"], g["n"], g["area"], g["mediana"], g["iqr"],
                 g["rango90"], g["meseta"], g["clase"]))
        print("      %s" % g["por_que"])
        if g["n_caras"] <= mostrar:
            print("      caras: %s" % ", ".join(str(c["tag"]) for c in g["caras"]))
        else:
            top = sorted(g["caras"], key=lambda c: -c["area"])[:mostrar]
            print("      caras (%d; las %d de mayor area): %s ..."
                  % (g["n_caras"], mostrar, ", ".join(str(c["tag"]) for c in top)))
    for c in sin:
        print("  [SIN MEDIR] cara %d (%s, %.1f mm2): %s"
              % (c["tag"], c["tipo"], c["area"], c["motivo"]))

    capas = [g for g in grupos if g["clase"] == CAPA]
    ncl = [g for g in grupos if g["clase"] == NC]
    print("\nVEREDICTO")
    if capas:
        print("  [!] HAY CAPA DE MATERIAL sobre el solido. NO medir contra estas caras:")
        for g in capas:
            if g.get("transicion"):
                continue
            print("      #%d  %.3f mm sobre %d caras (%.0f mm2)%s  -> una luz interna medida "
                  "aca sale %.3f mm mas chica"
                  % (g["id"], g["mediana"], g["n_caras"], g["area"],
                     "" if g["espesor"] is None else
                     " = espesor declarado %.3f" % g["espesor"], 2 * g["mediana"]))
        tr = [g for g in capas if g.get("transicion")]
        if tr:
            print("      + %d grupo(s) de canto/fillet de esas capas: %s"
                  % (len(tr), ", ".join("#%d" % g["id"] for g in tr)))
        print("      El espesor de la capa NO se vuelve a restar despues: ya esta modelado.")
    for g in grupos:
        if g["clase"] == CONSTR:
            print("  [i] offset constante %.4f mm sin espesor declarado que lo explique "
                  "(%d caras): o falta declararlo, o es una superficie de construccion."
                  % (g["mediana"], g["n_caras"]))
    if ncl or sin:
        print("  [X] quedaron %d grupo(s) y %d cara(s) SIN CLASIFICAR: no medir hasta "
              "resolverlas." % (len(ncl), len(sin)))
    elif not capas:
        print("  sin capas: las caras libres son geometria real o superficies de "
              "construccion identificadas.")


# --------------------------------------------------------------------------------------
# AUTOTEST — par sintetico BIEN/MAL, obligatorio en cada corrida
# --------------------------------------------------------------------------------------
E_SYN = 0.92          # espesor de la capa del sintetico MAL
Z_SYN = 10.0          # altura de la caja


def _sintetico(carpeta, capa):
    """Caja de 40x30x10 mas UNA cara libre.

    capa=True  -> rectangulo paralelo a la tapa, a 0,92 mm: es una CAPA (offset constante).
    capa=False -> rectangulo INCLINADO, de 0,5 a 8 mm de la tapa: es GEOMETRIA REAL.
    Los dos archivos tienen exactamente 1 solido y exactamente 1 cara libre, asi que lo
    unico que los separa es el criterio que este CLI dice medir.
    """
    f = os.path.join(carpeta, "syn_%s.step" % ("capa" if capa else "real"))
    with _gmsh() as gmsh:
        gmsh.model.occ.addBox(0, 0, 0, 40, 30, Z_SYN)
        if capa:
            gmsh.model.occ.addRectangle(0, 0, Z_SYN + E_SYN, 40, 30)
        else:
            pt = [gmsh.model.occ.addPoint(*c) for c in
                  ((0, 0, Z_SYN + 0.5), (40, 0, Z_SYN + 8.0),
                   (40, 30, Z_SYN + 8.0), (0, 30, Z_SYN + 0.5))]
            ln = [gmsh.model.occ.addLine(pt[i], pt[(i + 1) % 4]) for i in range(4)]
            gmsh.model.occ.addPlaneSurface([gmsh.model.occ.addCurveLoop(ln)])
        gmsh.model.occ.synchronize()
        with _sin_ruido():
            gmsh.write(f)
    return f


def _rayos(path, lc=1.5):
    """SEGUNDA medicion del offset, con otro algoritmo: rayo a lo largo de la normal.

    La proximidad punto-triangulo (trimesh) y la interseccion rayo-malla no comparten una
    linea de codigo. Si las dos dan el mismo numero, el offset no depende del criterio de
    una sola. Esto esta aca por el incidente que motivo todo el CLI: dos verificaciones
    'independientes' confirmaron un numero equivocado porque las dos median igual.
    """
    import trimesh
    with _gmsh() as gmsh:
        gmsh.model.occ.importShapes(path, highestDimOnly=False)
        gmsh.model.occ.synchronize()
        libres, ligadas = [], []
        for _, t in gmsh.model.getEntities(2):
            (libres if not gmsh.model.getAdjacencies(2, t)[0].size else ligadas).append(t)
        if not libres or not ligadas:
            return None
        gmsh.option.setNumber("Mesh.MeshSizeMax", lc)
        gmsh.option.setNumber("Mesh.MeshSizeMin", lc * 0.3)
        gmsh.model.mesh.generate(2)
        tags, coords, _ = gmsh.model.mesh.getNodes()
        tags = np.asarray(tags, dtype=np.int64)
        xyz = np.zeros((int(tags.max()) + 1, 3))
        xyz[tags] = np.asarray(coords, dtype=float).reshape(-1, 3)
        T = _tris(gmsh, ligadas, xyz)
        ps, ns = [], []
        for t in libres:
            (u0, v0), (u1, v1) = gmsh.model.getParametrizationBounds(2, t)
            for fu in (0.3, 0.5, 0.7):
                for fv in (0.3, 0.5, 0.7):
                    q = np.array([u0 + fu * (u1 - u0), v0 + fv * (v1 - v0)])
                    if not gmsh.model.isInside(2, t, q, parametric=True):
                        continue
                    ps.append(np.array(gmsh.model.getValue(2, t, q)))
                    ns.append(np.array(gmsh.model.getNormal(t, q)))
    if not ps or not len(T):
        return None
    ms = trimesh.Trimesh(vertices=T.reshape(-1, 3),
                         faces=np.arange(len(T) * 3).reshape(-1, 3), process=False)
    ms.merge_vertices()
    d = []
    for p, n in zip(ps, ns):
        h = []
        for s in (+1.0, -1.0):
            loc, _, _ = ms.ray.intersects_location(np.array([p]), np.array([s * n]),
                                                   multiple_hits=False)
            if len(loc):
                h.append(float(np.linalg.norm(loc[0] - p)))
        if h:
            d.append(min(h))
    return float(np.median(d)) if d else None


def _corrida_sintetica(path):
    res = medir(path, lc=1.5)
    grupos, sin = agrupar(res["caras"])
    grupos = clasificar(grupos, [E_SYN])
    return res, grupos, sin


def autotest(verboso=True):
    """Devuelve la lista de problemas. Vacia = el detector separa el par."""
    prob = []
    carpeta = tempfile.mkdtemp(prefix="carlib_")
    try:
        out, ray = {}, {}
        for capa, nom in ((True, "MAL  (capa offset 0,92)"), (False, "BIEN (cara inclinada)")):
            f = _sintetico(carpeta, capa)
            res, grupos, sin = _corrida_sintetica(f)
            if capa:
                ray[capa] = _rayos(f)
            g = grupos[0] if len(grupos) == 1 else None
            out[capa] = (res, g, sin)
            if verboso:
                print("    %-26s libres=%d grupos=%d  offset=%s  meseta=%s  -> %s"
                      % (nom, res["n_libres"], len(grupos),
                         "n/d" if g is None else "%.4f" % g["mediana"],
                         "n/d" if g is None else "%.2f" % g["meseta"],
                         "n/d" if g is None else g["clase"]))
            if res["n_libres"] != 1:
                prob.append("%s: el detector vio %d caras libres, tiene que ver 1"
                            % (nom, res["n_libres"]))
            if sin:
                prob.append("%s: %d cara(s) sin medir" % (nom, len(sin)))
            if g is None:
                prob.append("%s: %d grupos, tiene que dar 1" % (nom, len(grupos)))

        gm = out[True][1]
        gb = out[False][1]
        if gm is not None:
            if gm["clase"] != CAPA:
                prob.append("MAL: una superficie a 0,92 mm CONSTANTES quedo como '%s' -> "
                            "FALSO NEGATIVO, es la ceguera exacta que se quiere evitar"
                            % gm["clase"])
            if abs(gm["mediana"] - E_SYN) > 0.02:
                prob.append("MAL: offset medido %.4f contra %.3f construido -> la medicion "
                            "no es la distancia que dice ser" % (gm["mediana"], E_SYN))
            r = ray.get(True)
            if verboso:
                print("    control independiente por RAYOS: %s contra %.4f de proximidad"
                      % ("n/d" if r is None else "%.4f" % r, gm["mediana"]))
            if r is None:
                prob.append("MAL: el control por rayos no devolvio ninguna distancia -> "
                            "el offset queda apoyado en un solo algoritmo")
            elif abs(r - gm["mediana"]) > 0.005:
                prob.append("MAL: proximidad %.4f y rayos %.4f no coinciden -> el numero "
                            "depende del criterio de medicion, no de la pieza"
                            % (gm["mediana"], r))
        if gb is not None:
            if gb["clase"] != REAL:
                prob.append("BIEN: una cara libre que es geometria real quedo como '%s' -> "
                            "FALSO POSITIVO, el CLI llamaria capa a cualquier cosa"
                            % gb["clase"])
        if gm is not None and gb is not None:
            sep = gm["meseta"] - gb["meseta"]
            if verboso:
                print("    separacion de meseta: %.2f (MAL) - %.2f (BIEN) = %.2f"
                      % (gm["meseta"], gb["meseta"], sep))
            if sep < 0.40:
                prob.append("la meseta no separa el par (%.2f): el criterio es CIEGO" % sep)
    finally:
        shutil.rmtree(carpeta, ignore_errors=True)
    return prob


# --------------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", nargs="?", help="archivo STEP a clasificar")
    ap.add_argument("--espesores", default="",
                    help="espesores candidatos en mm, separados por coma (tela, pintura, "
                         "grano). Sin esto una capa no se puede separar de una superficie "
                         "de construccion y la corrida sale con codigo 2")
    ap.add_argument("--lc", type=float, default=LC_DEF, help="tamano de malla (mm)")
    ap.add_argument("--curvatura", type=float, default=0.0,
                    help="Mesh.MeshSizeFromCurvature para radios chicos (0 = apagado)")
    ap.add_argument("--tol-espesor", type=float, default=TOL_ESPESOR,
                    help="mm; |offset - espesor| para decir que coincide")
    ap.add_argument("--tol-grupo", type=float, default=TOL_GRUPO,
                    help="mm; salto entre medianas que corta un grupo")
    ap.add_argument("--max-puntos", type=int, default=MAX_PTS,
                    help="puntos de consulta por cara libre")
    ap.add_argument("--json", default=None, help="volcar el resultado a un JSON")
    ap.add_argument("--solo-autotest", action="store_true")
    a = ap.parse_args()

    print("AUTOTEST del detector (par sintetico BIEN/MAL)")
    prob = autotest()
    if prob:
        print("  [AUTOTEST FALLA]")
        for p in prob:
            print("    - " + p)
        print("  No se juzga ningun STEP con un detector que no probo distinguir.")
        return 3
    print("  [AUTOTEST OK] separa una capa de una cara libre que es geometria real.\n")
    if a.solo_autotest:
        return 0
    if not a.step:
        raise SystemExit("falta el STEP (o usar --solo-autotest)")

    espesores = sorted(float(x) for x in a.espesores.replace(";", ",").split(",") if x.strip())
    res = medir(a.step, lc=a.lc, curvatura=a.curvatura, max_pts=a.max_puntos)
    grupos, sin = agrupar(res["caras"], tol_grupo=a.tol_grupo)
    grupos = clasificar(grupos, espesores, tol_espesor=a.tol_espesor)
    informe(res, grupos, sin, espesores)

    if a.json:
        json.dump({"archivo": os.path.abspath(a.step), "solidos": res["n_solidos"],
                   "caras_libres": res["n_libres"], "espesores": espesores,
                   "grupos": [{k: v for k, v in g.items()
                               if k not in ("caras", "curvas")} |
                              {"tags": [c["tag"] for c in g["caras"]]} for g in grupos],
                   "sin_medir": [{"tag": c["tag"], "motivo": c["motivo"]} for c in sin]},
                  open(a.json, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print("\njson -> %s" % a.json)

    if res["n_libres"] and (sin or any(g["clase"] == NC for g in grupos)):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())

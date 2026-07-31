# -*- coding: utf-8 -*-
"""Inspeccion topologica de un STEP SIN MALLAR: encontrar y medir features finos.

Por que existe: buscar un grabado/logo a ojo en renders cuesta 5-10 min por corrida de
mallado (y con 9 M de triangulos ni se ve). La respuesta esta en la TOPOLOGIA del STEP y
se lee en segundos. Caso real Upper Trim VW427 (2026-07-31): 1 h 20 min de mallados para
un dato que sale en 12 s — y encima el numero salio MAL (ver "trampas" abajo).

Camino canonico para "hay un grabado aca? que profundidad tiene?":

    with topo.open_step(ruta) as m:
        fb  = topo.face_boxes(m)                 # tabla de caras, instantaneo
        cl  = topo.find_fine_features(m)         # clusters de caras chicas
        vec = topo.face_neighbors(m, cl[0]["tags"])
        med = topo.measure_offset(m, cl[0]["tags"])

Criterio duro (el que evita el error de bulto): **si el feature no tiene caras de flanco,
no hay relieve** — es un contorno imprentado sobre la superficie, no una cavidad. Eso lo
dice la topologia (`face_neighbors`), no el render.

Trampas ya pagadas, no repetirlas:
 1. `gmsh.model.removeEntities(..., recursive=False)` NO recorta el modelo para mallar:
    la malla sigue saliendo de la pieza entera. Si despues elegis "la cara con mas nodos"
    terminas midiendo contra la superficie equivocada (asi salio -0,700 mm donde va 0,000).
    Este modulo no recorta nada: filtra por tags y lee geometria exacta.
 2. `np.linalg.svd` sobre la matriz de puntos completa revienta la RAM (1,75 TiB con 490k
    puntos). Ajustar planos con `geom.fit_plane` (covarianza 3x3).
 3. `scipy.cluster.hierarchy.linkage` sobre miles de caras: `pdist` pide decenas de GiB.
    Aca se agrupa con grilla + `scipy.ndimage.label`, que es O(n).
 4. `importShapes` con el default `highestDimOnly=True` TIRA las caras libres, que es
    justo donde vive el logo. `open_step` carga con False (ver `geom._load`).
"""
import sys
from contextlib import contextmanager

import numpy as np

from . import envcheck, geom

envcheck.require(("gmsh", "numpy", "scipy"))

import gmsh  # noqa: E402
from scipy import ndimage  # noqa: E402

FREE = -1          # marca de cara SIN solido padre (cara libre / imprentada)
MAX_CELLS = 20_000_000  # tope de celdas de la grilla de clustering (memoria)
TOL_PLANO = 1e-3   # mm: por debajo de esto un feature se considera plano

FACE_DTYPE = np.dtype([
    ("tag", "i8"), ("solid", "i8"),
    ("xmin", "f8"), ("ymin", "f8"), ("zmin", "f8"),
    ("xmax", "f8"), ("ymax", "f8"), ("zmax", "f8"),
    ("dx", "f8"), ("dy", "f8"), ("dz", "f8"),
    ("cx", "f8"), ("cy", "f8"), ("cz", "f8"),
    ("diag", "f8"), ("area_bbox", "f8"),
])


class Model(object):
    """Handle de un STEP ya cargado en la sesion gmsh abierta.

    Pasarlo en vez de la ruta cuando se encadenan varias consultas: importar un STEP de
    14 MB cuesta ~10 s, todo lo demas de este modulo cuesta milisegundos. Cargar una vez.
    """

    __slots__ = ("path",)

    def __init__(self, path):
        self.path = path

    def __repr__(self):
        return "Model(%r)" % self.path


@contextmanager
def open_step(path, keep=None, highest_dim_only=False):
    """Sesion gmsh con el STEP cargado -> Model, para encadenar consultas sin re-importar.

    highest_dim_only=False a proposito: asi entran las caras LIBRES (las que no pertenecen
    a ningun solido), que es donde suelen estar los grabados imprentados sobre la clase A.
    """
    with geom.gmsh_session():
        geom._load(path, keep=keep, highest_dim_only=highest_dim_only)
        yield Model(path)


@contextmanager
def _ctx(src):
    """Acepta indistintamente una ruta o un Model ya abierto."""
    if isinstance(src, Model):
        yield src
    else:
        with open_step(src) as m:
            yield m


def _solid_owner():
    """Mapa cara -> solido padre (FREE si la cara es libre). Requiere sesion abierta."""
    owner = {}
    for _, vol in gmsh.model.getEntities(3):
        _, sdown = gmsh.model.getAdjacencies(3, vol)
        for s in sdown:
            owner[int(s)] = int(vol)
    return owner


def face_boxes(src):
    """Tabla de TODAS las caras del STEP: tag, solido, bbox, dims, centro, diagonal, area.

    Devuelve un ndarray estructurado (dtype FACE_DTYPE) -> se accede por nombre de columna:
    `fb["diag"]`, `fb["tag"][fb["solid"] == topo.FREE]`, etc.

    - `solid` = tag del solido padre, o `topo.FREE` (-1) si la cara es libre.
    - `area_bbox` = producto de las DOS extensiones mayores del bbox. Es una cota superior
      barata del area real de la cara (el area exacta sale de `gmsh.model.occ.getMass`,
      que es bastante mas cara si se pide para miles de caras).

    No malla nada: 2737 caras se leen en ~0,1 s.
    """
    with _ctx(src):
        tags = [t for _, t in gmsh.model.getEntities(2)]
        if not tags:
            raise RuntimeError("El STEP no tiene caras")
        owner = _solid_owner()
        bb = np.array([gmsh.model.getBoundingBox(2, t) for t in tags], dtype=float)

    out = np.zeros(len(tags), dtype=FACE_DTYPE)
    out["tag"] = tags
    out["solid"] = [owner.get(int(t), FREE) for t in tags]
    for i, nm in enumerate(("xmin", "ymin", "zmin", "xmax", "ymax", "zmax")):
        out[nm] = bb[:, i]
    d = bb[:, 3:6] - bb[:, 0:3]
    out["dx"], out["dy"], out["dz"] = d[:, 0], d[:, 1], d[:, 2]
    c = (bb[:, 3:6] + bb[:, 0:3]) / 2.0
    out["cx"], out["cy"], out["cz"] = c[:, 0], c[:, 1], c[:, 2]
    out["diag"] = np.linalg.norm(d, axis=1)
    ds = np.sort(d, axis=1)
    out["area_bbox"] = ds[:, 1] * ds[:, 2]
    return out


def _grid_clusters(lo, hi, cell, max_cells=MAX_CELLS):
    """Etiqueta caras por vecindad rasterizando sus BBOX en una grilla + ndimage.label.

    Se rasteriza el bbox entero de cada cara, no su centro: dos caras quedan en el mismo
    cluster si sus bbox estan a menos de ~`cell`. Medir la separacion entre bbox (y no
    entre centros) hace que el resultado deje de depender del tamano de celda: en el
    simbolo del Upper Trim los centros estan a 5,4 mm pero los bbox a 1,4 mm — con
    centros, `cell` de 5 partia el simbolo en dos y `cell` de 6 no; con bbox, no.

    Grilla + label es O(n). NO usar scipy.cluster.hierarchy.linkage: su `pdist` es O(n^2)
    y con miles de caras pide decenas de GiB antes de calcular nada.
    """
    lo = np.asarray(lo, dtype=float)
    hi = np.asarray(hi, dtype=float)
    span = hi.max(0) - lo.min(0)
    for _ in range(12):
        dims = np.floor(span / cell).astype(np.int64) + 4
        if float(np.prod(dims.astype(float))) <= max_cells:
            break
        factor = (float(np.prod(dims.astype(float))) / max_cells) ** (1.0 / 3.0)
        cell = cell * max(factor, 1.001)
        sys.stderr.write("[topo] grilla demasiado fina, subo cell a %.3f mm\n" % cell)
    origen = lo.min(0) - cell
    ilo = np.floor((lo - origen) / cell).astype(np.int64)
    ihi = np.floor((hi - origen) / cell).astype(np.int64)
    dims = ihi.max(0) + 2
    grid = np.zeros(tuple(int(x) for x in dims), dtype=bool)
    for a, b in zip(ilo, ihi):
        grid[a[0]:b[0] + 1, a[1]:b[1] + 1, a[2]:b[2] + 1] = True
    lab, _n = ndimage.label(grid, structure=np.ones((3, 3, 3), dtype=np.int8))
    return lab[ilo[:, 0], ilo[:, 1], ilo[:, 2]], cell


def find_fine_features(src, max_diag=None, min_diag=0.0, cell=None, min_faces=2,
                       only_free=False, solids=None, max_cells=MAX_CELLS):
    """Agrupa las caras CHICAS por vecindad -> lista de clusters candidatos a feature fino.

    Un grabado, un logo o una nervadura fina son varias caras chicas pegadas entre si y
    lejos del resto del detalle. Esto las junta sin mallar y sin que le pasen tags.

    Parametros
      max_diag  : diagonal maxima de bbox para considerar una cara "chica".
                  None -> 5% de la diagonal del modelo.
      min_diag  : descarta slivers por debajo de esto (default 0 = no descarta).
      cell      : lado de celda de la grilla de agrupacion. None -> 0,3 * max_diag.
                  Dos caras caen en el mismo cluster si sus BBOX estan a menos de ~`cell`
                  (se rasteriza el bbox completo, no el centro — ver `_grid_clusters`).
      min_faces : minimo de caras por cluster para reportarlo.
      only_free : True -> solo caras libres (sin solido padre). Los grabados imprentados
                  sobre la clase A suelen venir asi en los STEP de cliente.
      solids    : lista de tags de solido a los que limitarse (None = todos).

    Devuelve lista de dicts ordenada por cantidad de caras (desc) y luego por diagonal:
      {"tags", "n_caras", "bbox", "dims", "diag", "centro", "libre"}
    """
    fb = face_boxes(src)
    modelo_diag = float(np.linalg.norm(
        [fb["xmax"].max() - fb["xmin"].min(),
         fb["ymax"].max() - fb["ymin"].min(),
         fb["zmax"].max() - fb["zmin"].min()]))
    if max_diag is None:
        max_diag = 0.05 * modelo_diag
    if cell is None:
        cell = 0.3 * max_diag
    if cell <= 0:
        raise ValueError("cell debe ser > 0 (recibio %s)" % cell)

    m = (fb["diag"] <= max_diag) & (fb["diag"] >= min_diag)
    if only_free:
        m &= fb["solid"] == FREE
    if solids is not None:
        m &= np.isin(fb["solid"], list(solids))
    sel = fb[m]
    if len(sel) == 0:
        return []

    lo_all = np.column_stack([sel["xmin"], sel["ymin"], sel["zmin"]])
    hi_all = np.column_stack([sel["xmax"], sel["ymax"], sel["zmax"]])
    labels, _cell = _grid_clusters(lo_all, hi_all, cell, max_cells=max_cells)

    out = []
    for lab in np.unique(labels):
        g = sel[labels == lab]
        if len(g) < min_faces:
            continue
        lo = np.array([g["xmin"].min(), g["ymin"].min(), g["zmin"].min()])
        hi = np.array([g["xmax"].max(), g["ymax"].max(), g["zmax"].max()])
        out.append({
            "tags": sorted(int(t) for t in g["tag"]),
            "n_caras": int(len(g)),
            "bbox": tuple(lo) + tuple(hi),
            "dims": tuple(hi - lo),
            "diag": float(np.linalg.norm(hi - lo)),
            "centro": tuple((lo + hi) / 2.0),
            "libre": bool((g["solid"] == FREE).all()),
        })
    out.sort(key=lambda c: (-c["n_caras"], c["diag"]))
    return out


def face_neighbors(src, tags):
    """Que caras comparten curvas con el grupo `tags`, y cuantas comparten (via getBoundary).

    Es lo que distingue un grabado REAL de un contorno imprentado: si las caras del feature
    comparten TODAS sus curvas con una unica cara vecina, no hay caras de flanco -> no hay
    pared -> no hay relieve. Si aparecen varias vecinas, hay flancos (o el feature esta
    incompleto y falta agregarle caras).

    Devuelve {"tags", "n_curvas", "vecinos": [(tag, curvas_compartidas), ...] desc}.
    """
    tags = [int(t) for t in tags]
    if not tags:
        raise ValueError("face_neighbors necesita al menos una cara")
    sfeat = set(tags)
    with _ctx(src):
        curvas = set()
        for t in tags:
            for _, c in gmsh.model.getBoundary([(2, t)], combined=False, oriented=False,
                                               recursive=False):
                curvas.add(int(c))
        cuenta = {}
        for c in curvas:
            up, _ = gmsh.model.getAdjacencies(1, c)
            for f in up:
                f = int(f)
                if f not in sfeat:
                    cuenta[f] = cuenta.get(f, 0) + 1
    vecinos = sorted(cuenta.items(), key=lambda kv: (-kv[1], kv[0]))
    return {"tags": sorted(tags), "n_curvas": len(curvas), "vecinos": vecinos}


def sample_face(src, tag, n=30, respect_trim=False):
    """Puntos sobre una cara por getParametrizationBounds + getValue (sin mallar).

    LIMITACION IMPORTANTE: `getValue` evalua la superficie SUBYACENTE, no respeta el
    recorte (trimming) de la cara. Los puntos caen sobre la superficie infinita/extendida,
    asi que sirven para AJUSTAR EL PLANO y MEDIR OFFSETS (que es para lo que esta), pero
    NO para dibujar el contorno real del feature. Para el contorno hay que mallar y tomar
    los nodos de esa cara (`geom.mesh_nodes(..., per_face=True)`).

    respect_trim=True filtra con `gmsh.model.isInside` punto por punto: da el contorno
    correcto pero es un loop de Python — con n=30 son 900 llamadas, con n=250 son 62.500.
    Default False a proposito.
    """
    with _ctx(src):
        (u0, v0), (u1, v1) = gmsh.model.getParametrizationBounds(2, int(tag))
        uu, vv = np.meshgrid(np.linspace(u0, u1, n), np.linspace(v0, v1, n))
        par = np.column_stack([uu.ravel(), vv.ravel()])
        xyz = np.asarray(gmsh.model.getValue(2, int(tag), par.ravel()), dtype=float).reshape(-1, 3)
        if respect_trim:
            dentro = np.array([gmsh.model.isInside(2, int(tag), p, parametric=True) for p in par],
                              dtype=bool)
            xyz = xyz[dentro]
    if len(xyz) == 0:
        raise RuntimeError("La cara %s no devolvio puntos (n=%d, respect_trim=%s)"
                           % (tag, n, respect_trim))
    return xyz


def face_normal(src, tag):
    """Normal de la cara en el centro de su dominio parametrico (para orientar el signo)."""
    with _ctx(src):
        (u0, v0), (u1, v1) = gmsh.model.getParametrizationBounds(2, int(tag))
        nrm = np.asarray(gmsh.model.getNormal(int(tag), [(u0 + u1) / 2.0, (v0 + v1) / 2.0]),
                         dtype=float).ravel()[:3]
    n = np.linalg.norm(nrm)
    if n < 1e-12:
        raise RuntimeError("Normal degenerada en la cara %s" % tag)
    return nrm / n


def fit_plane_robust(P):
    """Plano por autovector menor de la covarianza 3x3 -> (normal, centroide, dists).

    Alias explicito de `geom.fit_plane` (una sola implementacion, ahi vive el detalle).
    La garantia que importa: NUNCA arma un SVD de la matriz de puntos completa.
    """
    return geom.fit_plane(P)


def measure_offset(src, tags_feature, tag_referencia=None, n=30, n_ref=250, margen=1.0,
                   tol_plano=TOL_PLANO):
    """Cuanto sobresale (o se hunde) un feature respecto de la superficie que lo rodea.

    - Ajusta un plano a las caras del feature (covarianza 3x3) y orienta la normal hacia
      afuera con `gmsh.model.getNormal`.
    - Si no se pasa `tag_referencia`, la deduce: la cara vecina que comparte MAS curvas.
    - Muestrea la referencia y se queda con los puntos que caen en la ventana del feature
      (bbox + `margen` mm). Proyecta contra la normal comun.

    Signo: offset > 0 = el feature SOBRESALE de la referencia; < 0 = esta HUNDIDO;
    0 = al ras (contorno imprentado, sin profundidad).

    `tiene_flancos` = hay caras de pared. True si aparece mas de una vecina, o si el propio
    feature tiene espesor en la direccion de la normal (> tol_plano). Si es False, el
    feature es un parche plano al ras: NO es una cavidad, por mas que en el render parezca.

    Devuelve un dict con normal, centro, inclinacion, planitud, tamano en plano, offsets
    (medio/min/max), vecinos y los conteos de puntos usados.
    """
    tags = [int(t) for t in tags_feature]
    with _ctx(src) as m:
        vec = face_neighbors(m, tags)
        if tag_referencia is None:
            if not vec["vecinos"]:
                raise RuntimeError(
                    "El feature %s no tiene caras vecinas: no hay referencia contra que medir. "
                    "Pasar tag_referencia a mano." % tags)
            tag_referencia = int(vec["vecinos"][0][0])
        else:
            tag_referencia = int(tag_referencia)

        P = np.concatenate([sample_face(m, t, n=n) for t in tags])
        normal, centro, dev = fit_plane_robust(P)
        # orientar con la normal real de la cara mas grande del feature (el signo del
        # autovector es arbitrario y el signo del offset depende de el)
        fb = face_boxes(m)
        sel = fb[np.isin(fb["tag"], tags)]
        t_big = int(sel["tag"][np.argmax(sel["area_bbox"])]) if len(sel) else tags[0]
        if float(normal @ face_normal(m, t_big)) < 0:
            normal = -normal
            dev = -dev

        R = sample_face(m, tag_referencia, n=n_ref)

    planitud = float(np.abs(dev).max())
    lo, hi = P.min(0) - margen, P.max(0) + margen
    dentro = np.all((R >= lo) & (R <= hi), axis=1)
    if not dentro.any():
        raise RuntimeError(
            "Ningun punto de la cara de referencia %d cayo en la ventana del feature. "
            "Subir n_ref (esta en %d) o margen (esta en %.2f mm)." % (tag_referencia, n_ref, margen))
    # d_ref = cuanto esta la referencia POR ENCIMA del plano del feature -> offset = -d_ref
    off = -((R[dentro] - centro) @ normal)

    # tamano del feature medido EN SU PLANO (los dos ejes del plano ajustado)
    e1 = np.cross(normal, [0.0, 0.0, 1.0])
    if np.linalg.norm(e1) < 1e-6:
        e1 = np.cross(normal, [0.0, 1.0, 0.0])
    e1 = e1 / np.linalg.norm(e1)
    e2 = np.cross(normal, e1)
    a = (P - centro) @ e1
    b = (P - centro) @ e2

    return {
        "tags": sorted(tags),
        "tag_referencia": tag_referencia,
        "vecinos": vec["vecinos"],
        "n_curvas": vec["n_curvas"],
        "n_vecinos": len(vec["vecinos"]),
        "tiene_flancos": bool(len(vec["vecinos"]) > 1 or planitud > tol_plano),
        "normal": normal,
        "centro": centro,
        "inclinacion_vs_Z_deg": float(np.degrees(np.arccos(min(abs(float(normal[2])), 1.0)))),
        "planitud_mm": planitud,
        "tam_en_plano_mm": (float(a.max() - a.min()), float(b.max() - b.min())),
        "offset_medio_mm": float(off.mean()),
        "offset_min_mm": float(off.min()),
        "offset_max_mm": float(off.max()),
        "n_pts_feature": int(len(P)),
        "n_pts_ref": int(dentro.sum()),
    }

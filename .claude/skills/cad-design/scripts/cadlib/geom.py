# -*- coding: utf-8 -*-
"""Nucleo geometrico: cargar STEP, mallar, colision, muestreo, cilindros, planos, ICP.

Unifica los helpers que estaban copiados con variantes en 6 scripts del caso
posicionador (solids_tris / mesh_tris / mesh_tm / mesh_solids / mesh_points / inline).
"""
import os
import sys
from contextlib import contextmanager

from . import envcheck

envcheck.require(("gmsh", "numpy"))

import gmsh
import numpy as np

# --- criterio de mallado (unico lugar donde viven estos numeros) ---
LC_PREVIEW = 3.0     # renders rapidos / exploracion
LC_ANALYSIS = 1.5    # colision, registracion, secciones
LC_PRINT = 1.2       # STL final de impresion
CURVATURE_DRAFT = 24  # MeshSizeFromCurvature para variantes intermedias
CURVATURE_PRINT = 40  # STL final (curvas suaves; archivo mas pesado)
CONTAINS_BATCH = 2000  # trimesh.contains por lotes de 2000 o revienta la RAM


@contextmanager
def gmsh_session(terminal=0):
    """initialize/finalize protegidos: un fallo adentro no deja gmsh colgado."""
    gmsh.initialize()
    try:
        gmsh.option.setNumber("General.Terminal", terminal)
        gmsh.model.add("m")
        yield gmsh
    finally:
        gmsh.finalize()


def _load(path, keep=None, translate=None, highest_dim_only=True):
    """importShapes + filtro de solidos + traslacion. Requiere sesion gmsh abierta.

    OJO con highest_dim_only (default True = el default de gmsh): descarta las caras
    LIBRES, las que no pertenecen a ningun solido. En STEPs de cliente ahi viven los
    grabados/logos imprentados sobre la clase A. Caso real de un panel de cliente: con True
    entran 2548 caras y el logo NO EXISTE; con False entran 2737 y aparecen las 189
    caras libres (entre ellas los 2 simbolos). `cadlib.topo` carga siempre con False.
    """
    if not os.path.isfile(path):
        raise FileNotFoundError("No existe el archivo 3D: %s" % path)
    # Se importa SIEMPRE con False y, si hacen falta solo los solidos, se sacan las caras
    # libres DESPUES. Cuesta lo mismo e impone que el descarte sea visible: antes el
    # importShapes con True las borraba en silencio y nadie se enteraba de cuantas.
    gmsh.model.occ.importShapes(path, highestDimOnly=False)
    gmsh.model.occ.synchronize()
    if highest_dim_only:
        libres = [(2, t) for _, t in gmsh.model.getEntities(2)
                  if not gmsh.model.getAdjacencies(2, t)[0].size]
        if libres:
            gmsh.model.occ.remove(libres, recursive=True)
            gmsh.model.occ.synchronize()
            sys.stderr.write(
                "[cadlib.geom] AVISO: %s trae %d caras LIBRES (no pertenecen a ningun "
                "solido) y se descartaron.\n"
                "  QUE SON esas caras hay que AVERIGUARLO, no suponerlo. Hay dos casos y "
                "dan resultados opuestos:\n"
                "    (a) SON la pared, y el solido es una envolvente -> medir con "
                "caras_libres=True.\n"
                "    (b) son una CAPA sobre la pared (tapizado, vinilo, pintura) -> medir "
                "con False, o contas\n"
                "        el espesor de la capa DOS VECES.\n"
                "  Este aviso decia (a) como si fuera la regla y costo las dos veces: el "
                "2026-08-09 se dimensiono\n"
                "  con la envolvente y el macho salio ancho; el 2026-08-12, siguiendo el "
                "aviso, se midio contra las\n"
                "  caras sueltas —que eran el VINILO— y el macho salio 2,11 mm ANGOSTO: no "
                "tocaba nada.\n"
                "  COMO SE DECIDE (30 s): medir la misma luz de las dos formas y mirar el "
                "corte crudo de cruces.\n"
                "  Si las sueltas caen ADENTRO del solido y el offset por lado se parece al "
                "espesor de una capa\n"
                "  conocida, son caso (b). Si caen AFUERA, son caso (a).\n"
                % (os.path.basename(path), len(libres)))
    if keep is not None:
        keep = set(keep)
        vols = gmsh.model.getEntities(3)
        drop = [(d, t) for d, t in vols if t not in keep]
        if drop:
            gmsh.model.occ.remove(drop, recursive=True)
            gmsh.model.occ.synchronize()
    if translate is not None:
        vols = gmsh.model.getEntities(3)
        if vols:
            gmsh.model.occ.translate(vols, *[float(x) for x in translate])
            gmsh.model.occ.synchronize()


def _mesh_2d(lc, curvature=None):
    gmsh.option.setNumber("Mesh.MeshSizeMax", lc)
    gmsh.option.setNumber("Mesh.MeshSizeMin", lc * 0.4)
    if curvature is not None:
        gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", curvature)
    gmsh.model.mesh.generate(2)


def _node_xyz():
    """Mapa tag->coordenadas de todos los nodos de la malla actual."""
    tags, coords, _ = gmsh.model.mesh.getNodes()
    tags = np.asarray(tags, dtype=np.int64)
    xyz = np.zeros((int(tags.max()) + 1, 3)) if len(tags) else np.zeros((1, 3))
    xyz[tags] = np.asarray(coords, dtype=float).reshape(-1, 3)
    return xyz


def _surface_tris(surf_tags, xyz):
    tris = []
    for st in surf_tags:
        etypes, _, enodes = gmsh.model.mesh.getElements(2, st)
        for et, en in zip(etypes, enodes):
            if et == 2:  # triangulo de 3 nodos
                ids = np.asarray(en, dtype=np.int64).reshape(-1, 3)
                tris.append(xyz[ids])
    if not tris:
        return np.zeros((0, 3, 3))
    return np.concatenate(tris)


def step_to_tris(path, lc=LC_ANALYSIS, keep=None, translate=None, per_solid=False,
                 caras_libres=False):
    """STEP -> triangulos (N,3,3). per_solid=True -> dict tag -> (tris, bbox)."""
    with gmsh_session():
        _load(path, keep=keep, translate=translate,
              highest_dim_only=not caras_libres)
        _mesh_2d(lc)
        xyz = _node_xyz()
        if per_solid:
            out = {}
            for dim, tag in gmsh.model.getEntities(3):
                _, sdown = gmsh.model.getAdjacencies(dim, tag)
                out[tag] = (_surface_tris(sdown, xyz), gmsh.model.getBoundingBox(dim, tag))
            if not out:
                raise RuntimeError("El STEP no tiene solidos: %s" % path)
            return out
        tris = _surface_tris([t for _, t in gmsh.model.getEntities(2)], xyz)
        if len(tris) == 0:
            raise RuntimeError("Malla vacia (0 triangulos) para %s — revisar lc o la geometria" % path)
        return tris


def step_to_trimesh(path, lc=LC_ANALYSIS, keep=None, translate=None, require_watertight=False,
                    caras_libres=False):
    """STEP -> trimesh.Trimesh listo para contains/volumen. ValueError si queda vacia.

    caras_libres=True trae tambien las caras que no pertenecen a ningun solido, y la malla
    deja de ser watertight (o sea `contains` no sirve).

    CUAL DE LOS DOS ES "LA LUZ DE VERDAD" DEPENDE DEL ARCHIVO, y hay que medirlo. Este
    docstring afirmaba que True daba la luz real; sobre el panel del Upper Trim eso era
    FALSO y mando el diseno al lado equivocado dos veces seguidas:

      2026-08-09  se midio con False (12,96 = envolvente) -> macho ancho.
      2026-08-12  se midio con True  (10,90 = el VINILO)  -> macho 2,11 mm ANGOSTO, no
                  tocaba nada. Las caras sueltas de ese panel eran el tapizado ya modelado,
                  a 0,95 mm por dentro de cada pared.

    El discriminador es barato: medir la misma luz de las dos formas y mirar el corte crudo
    de cruces a lo largo del rayo. Si las caras sueltas caen ADENTRO de la luz del solido y
    el offset por lado se parece al espesor de una capa conocida (tapizado, pintura), son
    una CAPA -> medir con False. Si caen AFUERA, son la pared -> medir con True.
    """
    envcheck.require(("trimesh",))
    import trimesh
    tris = step_to_tris(path, lc=lc, keep=keep, translate=translate,
                        caras_libres=caras_libres)
    v = tris.reshape(-1, 3)
    f = np.arange(len(v)).reshape(-1, 3)
    m = trimesh.Trimesh(vertices=v, faces=f)
    m.merge_vertices()
    m.process()
    if len(m.faces) == 0:
        raise ValueError("Malla vacia tras process() para %s" % path)
    if require_watertight and not m.is_watertight:
        raise ValueError("Malla NO watertight para %s (contains daria resultados invalidos)" % path)
    return m


def mesh_nodes(path, lc, keep=None, translate=None, per_face=False, caras_libres=False):
    """Nodos de malla de superficie. per_face=True -> dict tag -> (tipo_superficie, pts)."""
    with gmsh_session():
        _load(path, keep=keep, translate=translate,
              highest_dim_only=not caras_libres)
        _mesh_2d(lc)
        if per_face:
            faces = {}
            for dim, tag in gmsh.model.getEntities(2):
                stype = gmsh.model.getType(2, tag)
                _, nc, _ = gmsh.model.mesh.getNodes(2, tag, includeBoundary=True)
                faces[tag] = (stype, np.asarray(nc, dtype=float).reshape(-1, 3))
            return faces
        _, nc, _ = gmsh.model.mesh.getNodes(2, -1)
        pts = np.unique(np.asarray(nc, dtype=float).reshape(-1, 3), axis=0)
        if len(pts) == 0:
            raise RuntimeError("0 nodos de superficie para %s" % path)
        return pts


def sample_surface_points(path, keep=None, n=25):
    """Muestreo parametrico getValue+isInside (robusto ante geometria 'sucia' que no malla)."""
    out = []
    with gmsh_session():
        _load(path, keep=keep)
        for dim, tag in gmsh.model.getEntities(2):
            try:
                (umin, vmin), (umax, vmax) = gmsh.model.getParametrizationBounds(2, tag)
                us = np.linspace(umin, umax, n)
                vs = np.linspace(vmin, vmax, n)
                uu, vv = np.meshgrid(us, vs)
                params = np.column_stack([uu.ravel(), vv.ravel()])
                xyz = np.asarray(gmsh.model.getValue(2, tag, params.ravel())).reshape(-1, 3)
                inside = np.array([gmsh.model.isInside(2, tag, p, parametric=True) for p in params], dtype=bool)
                if inside.any():
                    out.append(xyz[inside])
            except Exception:
                continue
    if not out:
        raise RuntimeError("El muestreo parametrico no devolvio puntos para %s" % path)
    return np.unique(np.concatenate(out), axis=0)


def contains_batched(mesh, pts, batch=CONTAINS_BATCH):
    """trimesh.contains por lotes (batch>~2000 revienta la RAM en piezas grandes)."""
    pts = np.asarray(pts, dtype=float)
    out = np.zeros(len(pts), bool)
    for i in range(0, len(pts), batch):
        out[i:i + batch] = mesh.contains(pts[i:i + batch])
    return out


def _kasa_circle(xy):
    """Ajuste algebraico de circulo (Kasa) — funciona tambien con arcos parciales."""
    A = np.column_stack([2 * xy[:, 0], 2 * xy[:, 1], np.ones(len(xy))])
    b = (xy ** 2).sum(1)
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    cx, cy = sol[0], sol[1]
    r = float(np.sqrt(max(sol[2] + cx * cx + cy * cy, 0.0)))
    return np.array([cx, cy]), r


def extract_cylinder_axes(path, r_target=None, tol=0.15, keep=None, n_u=24, n_v=5):
    """Caras 'Cylinder' del STEP -> [{center, axis, radius}] con dedup de caras partidas.

    r_target/tol filtran por radio (ej. r_target=2.65 para agujero pasante M5).
    """
    found = []
    with gmsh_session():
        _load(path, keep=keep)
        for dim, tag in gmsh.model.getEntities(2):
            if gmsh.model.getType(2, tag) != "Cylinder":
                continue
            try:
                (u0, v0), (u1, v1) = gmsh.model.getParametrizationBounds(2, tag)
            except Exception:
                continue
            us = np.linspace(u0, u1, n_u)
            vs = np.linspace(v0, v1, n_v)
            uu, vv = np.meshgrid(us, vs)
            params = np.column_stack([uu.ravel(), vv.ravel()])
            xyz = np.asarray(gmsh.model.getValue(2, tag, params.ravel())).reshape(len(vs), len(us), 3)
            best = None
            # cual parametro es el AXIAL: probar ambos y quedarse con el ajuste de circulo mas limpio
            for axial_first in (True, False):
                grid = xyz if axial_first else np.transpose(xyz, (1, 0, 2))
                ax_dir = grid[-1].mean(0) - grid[0].mean(0)
                nrm = np.linalg.norm(ax_dir)
                if nrm < 1e-9:
                    continue
                ax_dir = ax_dir / nrm
                e1 = np.cross(ax_dir, [0.0, 0.0, 1.0])
                if np.linalg.norm(e1) < 1e-6:
                    e1 = np.cross(ax_dir, [0.0, 1.0, 0.0])
                e1 /= np.linalg.norm(e1)
                e2 = np.cross(ax_dir, e1)
                flat = grid.reshape(-1, 3)
                xy = np.column_stack([flat @ e1, flat @ e2])
                c2, r = _kasa_circle(xy)
                resid = float(np.abs(np.linalg.norm(xy - c2, axis=1) - r).mean())
                if best is None or resid < best[0]:
                    center = c2[0] * e1 + c2[1] * e2 + (flat @ ax_dir).mean() * ax_dir
                    best = (resid, center, ax_dir, r)
            if best is None or best[0] > 0.2:
                continue
            found.append({"center": best[1], "axis": best[2], "radius": best[3], "tag": tag})
    if r_target is not None:
        found = [h for h in found if abs(h["radius"] - r_target) < tol]
    # dedup: misma direccion de eje y centros a <1 mm en el plano perpendicular = mismo agujero
    uniq = []
    for h in found:
        dup = False
        for u in uniq:
            if abs(float(h["axis"] @ u["axis"])) > 0.99:
                d = h["center"] - u["center"]
                d_perp = d - (d @ u["axis"]) * u["axis"]
                if np.linalg.norm(d_perp) < 1.0:
                    dup = True
                    break
        if not dup:
            uniq.append(h)
    return uniq


def bbox_medido(dim, tag, n_curva=32):
    """Bbox REAL de una entidad gmsh, midiendo la geometria RECORTADA.

    `gmsh.model.getBoundingBox` (y `BRepBndLib` sin triangulacion) acotan la superficie
    NURBS SIN RECORTAR: sobre una pieza de cliente eso INFLA el resultado. Medido el
    2026-08-24 sobre el Insert SAB1740: getBoundingBox dio 625,11 x 86,32 x 289,96 y la
    pieza mide 552,73 x 58,01 x 151,02 — el alto salia 1,9 VECES mas grande. Ese numero
    inflado viajo a un documento de ingenieria y dimensiono un dispositivo entero.

    Aca se muestrean las CURVAS de borde, que SI estan recortadas exactas. Es una cota
    por el borde: si una cara abombada tuviera su apice adentro, quedaria corta por lo
    que abomba. Contra la triangulacion fina del Insert (deflexion 0,1) el error fue
    0,02 mm en 552,73 — el orden del abombado de una pared de 2,3 mm. Devuelve:
        (lo, hi, lo_cad, hi_cad)   todos np.array(3,)
    """
    if dim == 3:
        _, sdown = gmsh.model.getAdjacencies(3, tag)
    elif dim == 2:
        sdown = [tag]
    else:
        raise ValueError("bbox_medido: dim debe ser 2 o 3, no %r" % dim)

    pts = []
    for st in sdown:
        _, cdown = gmsh.model.getAdjacencies(2, int(st))
        for ct in cdown:
            try:
                (t0,), (t1,) = gmsh.model.getParametrizationBounds(1, int(ct))
            except Exception:
                continue
            ts = np.linspace(t0, t1, n_curva).tolist()
            try:
                pts.append(np.asarray(gmsh.model.getValue(1, int(ct), ts), float).reshape(-1, 3))
            except Exception:
                pass
    bb = gmsh.model.getBoundingBox(dim, tag)
    lo_cad, hi_cad = np.array(bb[:3], float), np.array(bb[3:], float)
    if not pts:
        return lo_cad, hi_cad, lo_cad, hi_cad
    P = np.concatenate(pts)
    return P.min(0), P.max(0), lo_cad, hi_cad


def aviso_bbox_inflado(lo, hi, lo_cad, hi_cad, que="", tol=0.02):
    """Devuelve el texto de aviso si el bbox del CAD esta inflado, o '' si coinciden."""
    d, d_cad = hi - lo, hi_cad - lo_cad
    peor = 0.0
    for a in range(3):
        if d[a] > 1e-9:
            peor = max(peor, d_cad[a] / d[a] - 1.0)
    if peor <= tol:
        return ""
    ejes = "XYZ"
    det = "  ".join("%s %.2f vs %.2f" % (ejes[a], d[a], d_cad[a]) for a in range(3))
    return ("AVISO bbox inflado%s: la envolvente SIN recortar es hasta %.0f%% mas grande que "
            "la pieza real.\n  medido (geometria recortada): %s\n  Usar el MEDIDO. "
            "El del CAD acota la NURBS entera, no el trozo que existe." %
            ((" en " + que) if que else "", 100 * peor, det))


def fit_plane(pts):
    """Mejor plano por autovector menor de la covarianza 3x3 -> (normal, centroide, dists).

    NO usar np.linalg.svd(pts - ctr): el default es full_matrices=True, o sea que arma
    U de N x N. Con 490.000 puntos numpy pide 1,75 TiB y el proceso muere. La matriz de
    covarianza es 3x3 SIEMPRE, sin importar cuantos puntos entren (caso real Upper Trim,
    2026-07-31). El resultado es el mismo plano; el signo de la normal es arbitrario en
    los dos metodos — orientarla con gmsh.model.getNormal si el signo importa.
    """
    pts = np.asarray(pts, dtype=float)
    if len(pts) < 3:
        raise ValueError("fit_plane necesita al menos 3 puntos (recibio %d)" % len(pts))
    ctr = pts.mean(0)
    q = pts - ctr
    cov = (q.T @ q) / max(len(q) - 1, 1)
    _, vecs = np.linalg.eigh(cov)  # eigh: autovalores ascendentes -> vecs[:,0] = menor
    normal = vecs[:, 0]
    return normal, ctr, q @ normal


def orthonormal_frame(b, a_hint):
    """Frame local M=[a,b,c] (Gram-Schmidt de a_hint contra b). det(M)=+1 garantizado."""
    b = np.asarray(b, dtype=float)
    b = b / np.linalg.norm(b)
    a = np.asarray(a_hint, dtype=float)
    a = a - (a @ b) * b
    a = a / np.linalg.norm(a)
    c = np.cross(a, b)
    c = c / np.linalg.norm(c)
    M = np.column_stack([a, b, c])
    if abs(np.linalg.det(M) - 1) > 1e-9:
        raise ValueError("Frame no ortonormal directo: det=%s" % np.linalg.det(M))
    return M


def rotation_axis_angle(M):
    """Matriz de rotacion -> (eje, angulo) para occ.rotate (preserva tipos de superficie)."""
    ang = float(np.arccos(np.clip((np.trace(M) - 1) / 2, -1, 1)))
    axis = np.array([M[2, 1] - M[1, 2], M[0, 2] - M[2, 0], M[1, 0] - M[0, 1]])
    nrm = np.linalg.norm(axis)
    if nrm < 1e-12:
        return np.array([0.0, 0.0, 1.0]), 0.0
    return axis / nrm, ang


def icp_translation(src, tgt, seed=(0.0, 0.0, 0.0), iters=120, trim=0.6, tol=5e-5):
    """ICP traslacion-only trimmed (algoritmo probado del posicionador).

    Convencion: src - T vive en el frame de tgt. Devuelve (T, dist_final, rms_trim, iteraciones).
    OJO: validar contra features UNICOS — perfiles constantes no fijan el eje longitudinal.
    """
    envcheck.require(("scipy",))
    from scipy.spatial import cKDTree
    src = np.asarray(src, dtype=float)
    tgt = np.asarray(tgt, dtype=float)
    tree = cKDTree(tgt)
    T = np.asarray(seed, dtype=float).copy()
    k = max(200, int(len(src) * trim))
    it = 0
    for it in range(iters):
        d, idx = tree.query(src - T)
        sel = np.argsort(d)[:k]
        resid = tgt[idx[sel]] - (src[sel] - T)
        delta = resid.mean(axis=0)
        T -= delta
        if np.linalg.norm(delta) < tol:
            break
    d, _ = tree.query(src - T)
    sel = np.argsort(d)[:k]
    rms = float(np.sqrt((d[sel] ** 2).mean()))
    return T, d, rms, it + 1

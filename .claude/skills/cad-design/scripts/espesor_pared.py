#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""PARED MINIMA IMPRIMIBLE — mide el espesor local de una pieza y dice si hay una pared que no imprime.

POR QUE EXISTE (fallo real, memoria de la casa). «Un alma quedo de 0,30 mm — menos de un cordon, no imprime»
(reference/lecciones-caras.md l.42-44, leccion 12): lo agregado antes de los cortes se lo comieron los cortes y
nadie midio la pared que quedaba. Es el control 1.2 de la investigacion de revision de diseno del 24/10/2026
(04_decision.md). Convive con viga_voladizo.py --t-min 1,2 (lamina que flexiona, 3 perimetros): este es para
CUALQUIER pared, aquel para la lamina.

QUE MIDE. Para cada triangulo de la malla de cada cara se tira una GRILLA DENSA de rayos (~1 por paso^2 mm2,
paso 0,5 mm) HACIA ADENTRO del material, perpendicular a la cara, y se mide la distancia hasta la primera pared de
enfrente (trimesh + embree, ya en .venv-cad). Informa el minimo y donde esta, el area de cara bajo cada umbral y el %
de rayos que impacto (menos de 40 % = NO MEDIDO, nunca verde). Cada solido se mide por separado.

UMBRALES (paredCanon.data.json, cada uno con su fuente):
    ROJO   < 0,45 mm  un perimetro con boquilla 0,4 (ficha-fdm.md G3, Prusa KB), SOLO si las dos caras que mide el
                      rayo son PARALELAS (angulo < 0,1 grado: ruido de punto flotante del STEP, no criterio de
                      diseno). Una pared de caras paralelas de 0,30 mm es un alma que no imprime, sin ningun
                      numero a ojo.
    AVISO  < 0,8 mm   dos perimetros (G3; valor por defecto de augura). Una CUNA (caras que convergen de a poco, ej.
                      100 x 60 de 3 a 0,3 mm) es AVISO y nunca rojo: separarla de la punta de un pin pediria un
                      angulo a ojo (04_decision.md). La cuna es la que augura no ve (mira el centro de cada cara).
    PUNTA             el vertice de un cono o el filo de un pin tambien "se afina a 0", pero en una zona mas corta
                      que lo fino que es (zona fina = umbral / tan(angulo entre caras)). Se cuenta aparte
                      (puntas_sin_juzgar) y no avisa. Es el unico numero a ojo del control y solo gobierna el AVISO:
                      cuna_extension_min_veces_umbral en el canon (null = todo par que converge avisa).
    «Con carga 1,5 a 2 mm» sale NO MEDIDO: falta saber que pared carga (dato del pliego).

SALIDA PARA FAK. Hasta el 31/10/2026 un rojo AVISA (exit 0). Desde el 01/11 un rojo FRENA (exit 1) con una sola salida
de Fak: --acepto-pared "<frase de Fak, 10+ caracteres>" con --workdir; queda en el manifest atada a la firma del STEP
y vale para esa firma sola (patron de gate_aristas.py --acepto-cantos). El AVISO no frena nunca.

AUTOTEST propio BIEN/MAL en CADA corrida (no se puede saltear): un bloque de 40 x 20 x 10 con dos bolsillos que dejan
un alma de 1,6 (verde), 0,30 (rojo) y 0,60 (aviso); un pin Ø5 con punta conica de 4 mm (verde: no da falso rojo y SI
llega a medir la punta) y una cuna de 100 x 60 de 3 a 0,3 mm (aviso). Si el par no separa, sale con codigo 3 y NO juzga
la pieza.

USO
    espesor_pared.py --step pieza.step [--paso 0.5] [--workdir W] [--json out.json]
                     [--acepto-pared "<frase de Fak>"] [--tope-seg N] [--max-rayos N]
    espesor_pared.py --solo-autotest            # probar el control sin juzgar ninguna pieza

CODIGOS DE SALIDA
    0  verde, AVISO (incluye el rojo hasta el 31/10) o ACEPTADO con la frase de Fak
    1  FRENO (rojo desde el 01/11), frase corta, frase usada para otra firma, aceptacion sin --workdir
    2  NO MEDIDO (STEP ilegible o truncado, sin solidos, malla que no cierra, menos de 40 % de impacto, demasiados
       rayos, tope de tiempo, falta embree): nunca verde
    3  el AUTOTEST fallo: el control no probo distinguir, no se juzga nada

ORIGEN DEL METODO. Rayos hacia adentro desde las caras hasta la pared de enfrente: es el metodo de augura 0.1.7
(wall_thickness.py, Apache-2.0, github.com/pzfreo/augura). NO se copio codigo de augura: la muestra, la malla, los
rayos (embree), la clasificacion por angulo entre caras y todo lo demas son propios. Por eso no se trae su LICENSE a
reference/; el valor 0,8 (2 x 0,4) se cita de el en el canon.
"""
import argparse
import json
import math
import os
import sys
import time

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
CANON = os.path.join(AQUI, "paredCanon.data.json")

PARALELAS, CUNA, PUNTA = 0, 1, 2
NOMBRE_CLASE = {PARALELAS: "paralelas", CUNA: "cuna", PUNTA: "punta"}
EPS_ORIGEN = 2e-3          # los rayos arrancan 2 micras adentro para no pegarle a su propia cara
BLOQUE_RAYOS = 200_000
PRESUPUESTO_NORMAL_AT = 3000   # caras que no son plano/cilindro/cono/esfera/toro: normal_at es lento (~250 us)


class NoMedido(Exception):
    """La medicion no se pudo hacer: el control NUNCA da verde en este caso (exit 2)."""


# =========================================================================================
# CANON, FECHA Y MODO
# =========================================================================================
def canon():
    with open(CANON, encoding="utf-8") as f:
        return json.load(f)


def hoy_pared(hoy_arg=None):
    """La fecha de hoy. --hoy o CAD_HOY solo valen con CAD_GATE_TEST=1 (los tests); si no, el reloj."""
    from datetime import date
    simulada = hoy_arg or os.environ.get("CAD_HOY", "").strip() or None
    if simulada:
        if os.environ.get("CAD_GATE_TEST") != "1":
            raise NoMedido("--hoy / CAD_HOY solo valen con CAD_GATE_TEST=1 (fecha simulada de los tests)")
        return date.fromisoformat(simulada)
    return date.today()


def modo_pared(veredicto, hoy, aviso_hasta, aceptada=False):
    """verde | aviso | aceptado | freno. Una sola funcion para el control y para sus tests.

    Solo un ROJO frena y solo despues del aviso_hasta; el AVISO (pared de 0,45 a 0,8 con caras paralelas, o cuna)
    nunca frena."""
    from datetime import date
    if isinstance(aviso_hasta, str):
        aviso_hasta = date.fromisoformat(aviso_hasta)
    if veredicto == "verde":
        return "verde"
    if veredicto == "aviso":
        return "aviso"
    if aceptada:
        return "aceptado"
    return "aviso" if hoy <= aviso_hasta else "freno"


def _mm(x, dec=3):
    return ("%.*f" % (dec, float(x))).replace(".", ",")


def _dia_siguiente(iso):
    from datetime import date, timedelta
    return (date.fromisoformat(iso) + timedelta(days=1)).isoformat()


# =========================================================================================
# MALLA DE CADA SOLIDO DEL STEP
# =========================================================================================
def leer_step(ruta):
    if not os.path.isfile(ruta):
        raise NoMedido("no existe el archivo: %s" % ruta)
    if not ruta.lower().endswith((".step", ".stp")):
        raise NoMedido("el control trabaja sobre STEP (las normales exactas de cada cara)")
    with open(ruta, "rb") as fh:
        fh.seek(max(0, os.path.getsize(ruta) - 4096))
        cola = fh.read()
    if b"END-ISO-10303-21" not in cola:
        raise NoMedido("STEP truncado o incompleto (no termina en END-ISO-10303-21;)")
    from build123d import import_step
    try:
        return import_step(ruta)
    except Exception as e:
        raise NoMedido("STEP ilegible: %s: %s" % (type(e).__name__, e))


def mallar(solido, tol_lineal, tol_angular):
    """Vertices, triangulos e indice de cara B-Rep de cada triangulo (con la orientacion de la cara)."""
    from OCP.BRep import BRep_Tool
    from OCP.TopAbs import TopAbs_REVERSED
    from OCP.TopLoc import TopLoc_Location
    solido.mesh(tol_lineal, tol_angular)
    verts, tris, fid = [], [], []
    desde = 0
    for k, cara in enumerate(solido.faces()):
        loc = TopLoc_Location()
        poly = BRep_Tool.Triangulation_s(cara.wrapped, loc)
        if poly is None:
            continue
        tr = loc.Transformation()
        nodos = np.array([[q.X(), q.Y(), q.Z()] for q in
                          (poly.Node(i).Transformed(tr) for i in range(1, poly.NbNodes() + 1))], float)
        t = np.array([[x.Value(1), x.Value(2), x.Value(3)] for x in poly.Triangles()], int) - 1
        if len(t) == 0:
            continue
        if cara.wrapped.Orientation() == TopAbs_REVERSED:
            t = t[:, [0, 2, 1]]
        verts.append(nodos)
        tris.append(t + desde)
        fid.append(np.full(len(t), k, int))
        desde += len(nodos)
    if not tris:
        raise NoMedido("el solido no se pudo mallar")
    return np.vstack(verts), np.vstack(tris), np.concatenate(fid)


def cerrar_malla(V, T, FID, nombre):
    """trimesh con los vertices unidos, orientada hacia afuera. NoMedido si no es un solido cerrado."""
    import trimesh
    m = trimesh.Trimesh(vertices=V, faces=T, process=False)
    m.merge_vertices()
    if len(m.faces) != len(FID):
        raise NoMedido("%s: la malla perdio triangulos al unir vertices" % nombre)
    util = m.area_faces > 1e-12
    if not util.all():
        m.update_faces(util)
        FID = FID[util]
    if not (m.is_watertight and m.is_winding_consistent):
        raise NoMedido("%s: la malla no cierra o no es orientable (STEP invalido): arreglar el solido antes de "
                       "medir la pared" % nombre)
    if m.volume < 0:
        m.invert()
    if m.volume <= 0:
        raise NoMedido("%s: volumen nulo" % nombre)
    if "ray_pyembree" not in type(m.ray).__module__:
        raise NoMedido("falta embree (embreex) en este Python: sin eso los rayos tardan horas")
    return m, FID


# =========================================================================================
# GRILLA DENSA DE PUNTOS SOBRE CADA TRIANGULO
# =========================================================================================
def _subdivisiones(m, paso):
    tri = m.triangles
    e1 = tri[:, 1] - tri[:, 0]
    e2 = tri[:, 2] - tri[:, 0]
    k = paso * 1.4          # con la reticula doblada al triangulo queda ~1 punto por paso^2
    n1 = np.maximum(1, np.ceil(np.linalg.norm(e1, axis=1) / k)).astype(np.int64)
    n2 = np.maximum(1, np.ceil(np.linalg.norm(e2, axis=1) / k)).astype(np.int64)
    return tri[:, 0], e1, e2, n1, n2


def contar_muestras(m, paso):
    """Cuantos rayos pide la malla con ese paso (reticula + 3 sondas por triangulo)."""
    _, _, _, n1, n2 = _subdivisiones(m, paso)
    return int((n1 * n2).sum()) + 3 * len(n1)


def lotes_de_muestras(m, paso):
    """Genera (puntos, triangulo, peso en mm2) en lotes. >= 1 punto por triangulo: reticula del paralelogramo doblada
    al triangulo (los puntos nunca caen en una arista: desfase 1/3 y 2/3), mas 3 sondas por triangulo pegadas a sus
    vertices (a paso/5 o al 5 % de la arista, lo que sea menor; peso 0: no suman area). Sin las sondas la grilla no
    llega a la punta de una cuna ni al vertice de un cono: el centro de un triangulo chico queda lejos de su punta."""
    A, e1, e2, n1, n2 = _subdivisiones(m, paso)
    area = m.area_faces
    clave = n1 * 1_000_003 + n2
    for c in np.unique(clave):
        todos = np.nonzero(clave == c)[0]
        a, b = int(n1[todos[0]]), int(n2[todos[0]])
        u, v = np.meshgrid((np.arange(a) + 1 / 3) / a, (np.arange(b) + 1 / 3) / b, indexing="ij")
        u, v = u.ravel(), v.ravel()
        plegar = (u + v) > 1.0
        u = np.where(plegar, 1.0 - u, u)
        v = np.where(plegar, 1.0 - v, v)
        n = a * b
        por_lote = max(1, BLOQUE_RAYOS // n)
        for i in range(0, len(todos), por_lote):
            idx = todos[i:i + por_lote]
            pts = A[idx, None, :] + u[None, :, None] * e1[idx, None, :] + v[None, :, None] * e2[idx, None, :]
            yield pts.reshape(-1, 3), np.repeat(idx, n), np.repeat(area[idx] / n, n)
    # sondas pegadas a cada vertice (A, B y C), hacia las dos aristas que salen de el
    B, C = A + e1, A + e2
    d = paso / 5.0
    for O, X, Y in ((A, B, C), (B, C, A), (C, A, B)):
        for i in range(0, len(A), BLOQUE_RAYOS):
            s = slice(i, i + BLOQUE_RAYOS)
            ex, ey = X[s] - O[s], Y[s] - O[s]
            fx = np.minimum(0.05, d / np.maximum(np.linalg.norm(ex, axis=1), 1e-12))
            fy = np.minimum(0.05, d / np.maximum(np.linalg.norm(ey, axis=1), 1e-12))
            yield O[s] + fx[:, None] * ex + fy[:, None] * ey, np.arange(len(A))[s], np.zeros(len(ex))


def agrupar(lotes, tam):
    """Junta lotes chicos hasta tener al menos `tam` puntos (menos llamadas al motor de rayos)."""
    cola, n = [], 0
    for lote in lotes:
        cola.append(lote)
        n += len(lote[0])
        if n >= tam:
            yield tuple(np.concatenate([x[k] for x in cola]) for k in range(3))
            cola, n = [], 0
    if cola:
        yield tuple(np.concatenate([x[k] for x in cola]) for k in range(3))


# =========================================================================================
# NORMALES EXACTAS (B-Rep) PARA SABER SI LAS DOS CARAS SON PARALELAS
# =========================================================================================
def _info_cara(cara):
    """Datos analiticos de la superficie de una cara: plano, cilindro, cono, esfera o toro (None si es otra)."""
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    from OCP.GeomAbs import GeomAbs_Cone, GeomAbs_Cylinder, GeomAbs_Plane, GeomAbs_Sphere, GeomAbs_Torus
    ad = BRepAdaptor_Surface(cara.wrapped)
    t = ad.GetType()

    def vec(x):
        return np.array([x.X(), x.Y(), x.Z()], float)
    if t == GeomAbs_Plane:
        return ("plano", vec(ad.Plane().Axis().Direction()))
    if t == GeomAbs_Cylinder:
        ax = ad.Cylinder().Axis()
        return ("cilindro", vec(ax.Location()), vec(ax.Direction()))
    if t == GeomAbs_Cone:
        c = ad.Cone()
        return ("cono", vec(c.Axis().Location()), vec(c.Axis().Direction()), float(c.SemiAngle()))
    if t == GeomAbs_Sphere:
        return ("esfera", vec(ad.Sphere().Location()))
    if t == GeomAbs_Torus:
        c = ad.Torus()
        return ("toro", vec(c.Axis().Location()), vec(c.Axis().Direction()), float(c.MajorRadius()))
    return None


def _unit(x):
    k = np.linalg.norm(x, axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        return x / k[:, None]


def _radial(P, o, d):
    w = P - o
    return _unit(w - (w @ d)[:, None] * d)


def normales_exactas(caras, info, fid, P, n_malla, presupuesto):
    """Normal EXTERIOR exacta de la cara B-Rep `fid[i]` en el punto P[i]. El signo sale de la normal de la faceta
    (la malla ya esta orientada hacia afuera). Devuelve (normales, ok) con ok False donde no hubo forma exacta."""
    from build123d import Vector
    N = np.full(P.shape, np.nan)
    gastado = 0
    for f in np.unique(fid):
        idx = np.nonzero(fid == f)[0]
        if f not in info:
            info[f] = _info_cara(caras[f])
        inf = info[f]
        p = P[idx]
        if inf is None:
            for i in idx:
                if gastado >= presupuesto:
                    break
                gastado += 1
                try:
                    q = caras[f].normal_at(Vector(float(P[i, 0]), float(P[i, 1]), float(P[i, 2])))
                    N[i] = (q.X, q.Y, q.Z)
                except Exception:
                    pass
            continue
        tipo = inf[0]
        if tipo == "plano":
            n = np.tile(inf[1], (len(idx), 1))
        elif tipo == "cilindro":
            n = _radial(p, inf[1], inf[2])
        elif tipo == "cono":
            r = _radial(p, inf[1], inf[2])
            n = math.cos(inf[3]) * r - math.sin(inf[3]) * inf[2]
        elif tipo == "esfera":
            n = _unit(p - inf[1])
        else:
            r = _radial(p, inf[1], inf[2])
            n = _unit(p - (inf[1] + inf[3] * r))
        N[idx] = n
    N = _unit(N)
    ok = np.isfinite(N).all(axis=1)
    N[ok] = np.where(((N[ok] * n_malla[ok]).sum(axis=1) < 0)[:, None], -N[ok], N[ok])
    return N, ok


def clasificar(m, FID, caras, info, P, tri_o, tri_h, t, c):
    """Clase de cada rayo fino segun el angulo entre la cara de donde sale y la cara que pega.
    Devuelve (clase, angulo en grados, cantidad que no pudo clasificar)."""
    n_o_malla = m.face_normals[tri_o]
    n_h_malla = m.face_normals[tri_h]
    dest = P - n_o_malla * t[:, None]
    n_o, ok_o = normales_exactas(caras, info, FID[tri_o], P, n_o_malla, PRESUPUESTO_NORMAL_AT)
    n_h, ok_h = normales_exactas(caras, info, FID[tri_h], dest, n_h_malla, PRESUPUESTO_NORMAL_AT)
    exacto = ok_o & ok_h
    # donde no hubo normal exacta (superficie libre: BSpline, revolucion, offset, pasado el presupuesto) se usa la de
    # la faceta; con eso NUNCA se declara paralela (no se puede certificar): como mucho es cuna, que avisa y no frena
    n_o = np.where(ok_o[:, None], n_o, n_o_malla)
    n_h = np.where(ok_h[:, None], n_h, n_h_malla)
    cos_phi = np.clip(-(n_o * n_h).sum(axis=1), -1.0, 1.0)
    phi = np.degrees(np.arccos(cos_phi))
    clase = np.full(len(t), CUNA, int)
    par = exacto & (phi <= c["tol_paralelas_grados"])
    clase[par] = PARALELAS
    k = c.get("cuna_extension_min_veces_umbral")
    if k is not None:
        # zona fina = umbral / tan(phi); cuna si mide al menos k veces el umbral  <=>  tan(phi) <= 1/k
        tan_phi = np.tan(np.radians(np.minimum(phi, 89.999)))
        clase[~par & (tan_phi * k > 1.0)] = PUNTA
    return clase, phi, int((~exacto).sum())


# =========================================================================================
# MEDICION
# =========================================================================================
def lanzar(m, P, N_adentro):
    """Distancia desde cada punto hasta la primera pared de enfrente (nan donde no pega) y triangulo que pega."""
    t = np.full(len(P), np.nan)
    th = np.full(len(P), -1, np.int64)
    loc, ir, it = m.ray.intersects_location(P + N_adentro * EPS_ORIGEN, N_adentro, multiple_hits=False)
    if len(ir):
        t[ir] = np.linalg.norm(loc - P[ir], axis=1)
        th[ir] = it
    return t, th


def medir_solido(solido, nombre, c, paso, t0, tope_seg, max_rayos):
    V, T, FID = mallar(solido, c["tol_malla_mm"], c["tol_angular_rad"])
    m, FID = cerrar_malla(V, T, FID, nombre)
    caras = solido.faces()
    pedidos = contar_muestras(m, paso)
    if pedidos > max_rayos:
        raise NoMedido("%s pide %d rayos con paso %s mm y el tope es %d: subir --max-rayos (el paso no se agranda en "
                       "silencio: una grilla gruesa se salta la punta de una cuna)"
                       % (nombre, pedidos, _mm(paso, 2), max_rayos))
    t_aviso = c["umbral_aviso_mm"]
    n_total, n_hit = 0, 0
    min_todos = (math.inf, None)
    finos = []
    for P, TRI, W in agrupar(lotes_de_muestras(m, paso), BLOQUE_RAYOS):
        if time.time() - t0 > tope_seg:
            raise NoMedido("tope de %s s: la medicion no termino" % _mm(tope_seg, 0))
        t, th = lanzar(m, P, -m.face_normals[TRI])
        pega = np.isfinite(t)
        n_total += len(P)
        n_hit += int(pega.sum())
        if pega.any():
            j = int(np.nanargmin(t))
            if t[j] < min_todos[0]:
                min_todos = (float(t[j]), P[j].copy())
        fino = pega & (t < t_aviso)
        if fino.any():
            q = np.nonzero(fino)[0]
            finos.append((P[q], TRI[q], th[q], t[q], W[q]))
    if finos:
        Pf = np.vstack([x[0] for x in finos])
        tri_o = np.concatenate([x[1] for x in finos])
        tri_h = np.concatenate([x[2] for x in finos])
        tf = np.concatenate([x[3] for x in finos])
        wf = np.concatenate([x[4] for x in finos])
        clase, phi, n_sin = clasificar(m, FID, caras, {}, Pf, tri_o, tri_h, tf, c)
        dest = Pf - m.face_normals[tri_o] * tf[:, None]
    else:
        Pf = np.zeros((0, 3)); tf = np.zeros(0); wf = np.zeros(0); dest = np.zeros((0, 3))
        clase = np.zeros(0, int); phi = np.zeros(0); n_sin = 0
    return {"nombre": nombre, "triangulos": int(len(m.faces)), "rayos": n_total, "impactos": n_hit,
            "min_todos": min_todos, "P": Pf, "t": tf, "w": wf, "dest": dest, "clase": clase, "phi": phi,
            "aproximadas": n_sin, "area": float(m.area), "volumen": float(m.volume)}


def _mas_fino(t, mask):
    """Indice del rayo mas fino dentro de la mascara (None si no hay ninguno)."""
    if not mask.any():
        return None
    idx = np.nonzero(mask)[0]
    return idx[int(np.argmin(t[idx]))]


def medir_formas(solidos, c, paso=None, tope_seg=None, max_rayos=None, t0=None):
    """Mide una lista de solidos de build123d. Devuelve el dict con todo lo medido (sin veredicto de modo)."""
    t0 = t0 or time.time()
    paso = paso if paso is not None else float(c["paso_mm"])
    tope_seg = tope_seg if tope_seg is not None else float(c["tope_segundos"])
    max_rayos = max_rayos if max_rayos is not None else int(c["max_rayos"])
    if not solidos:
        raise NoMedido("el STEP no trae solidos")
    partes = [medir_solido(s, "solido %d" % (k + 1), c, paso, t0, tope_seg, max_rayos)
              for k, s in enumerate(solidos)]
    rayos = sum(p["rayos"] for p in partes)
    impactos = sum(p["impactos"] for p in partes)
    pct = 100.0 * impactos / rayos if rayos else 0.0
    P = np.vstack([p["P"] for p in partes])
    t = np.concatenate([p["t"] for p in partes])
    w = np.concatenate([p["w"] for p in partes])
    dest = np.vstack([p["dest"] for p in partes])
    clase = np.concatenate([p["clase"] for p in partes])
    phi = np.concatenate([p["phi"] for p in partes])
    t_rojo, t_aviso = c["umbral_rojo_mm"], c["umbral_aviso_mm"]
    par, cuna = clase == PARALELAS, clase == CUNA
    punta = clase == PUNTA
    juzgado = par | cuna
    todos = min(p["min_todos"][0] for p in partes)
    punto_todos = [p["min_todos"][1] for p in partes if p["min_todos"][0] == todos][0]

    def info(mask):
        j = _mas_fino(t, mask)
        if j is None:
            return None
        return {"espesor_mm": round(float(t[j]), 4), "punto": [round(float(x), 3) for x in P[j]],
                "enfrente": [round(float(x), 3) for x in dest[j]], "angulo_grados": round(float(phi[j]), 3),
                "clase": NOMBRE_CLASE[int(clase[j])]}

    caja = None
    if juzgado.any():
        caja = [round(float(x), 2) for x in np.concatenate([P[juzgado].min(axis=0), P[juzgado].max(axis=0)])]
    res = {
        "solidos": len(partes), "triangulos": sum(p["triangulos"] for p in partes), "paso_mm": paso,
        "rayos": rayos, "impacto_pct": round(pct, 2), "area_mm2": round(sum(p["area"] for p in partes), 2),
        "espesor_min_todos_mm": round(float(todos), 4) if math.isfinite(todos) else None,
        "espesor_min_todos_punto": [round(float(x), 3) for x in punto_todos] if punto_todos is not None else None,
        "fino_juzgado": info(juzgado),
        "paralelas": info(par), "cunas": info(cuna), "puntas": info(punta),
        "paralelas_bajo_rojo_mm2": round(float(w[par & (t < t_rojo)].sum()), 2),
        "paralelas_bajo_aviso_mm2": round(float(w[par].sum()), 2),
        "cunas_bajo_aviso_mm2": round(float(w[cuna].sum()), 2),
        "puntas_sin_juzgar_rayos": int(punta.sum()),
        "puntas_sin_juzgar_mm2": round(float(w[punta].sum()), 3),
        "normal_aproximada_rayos": int(sum(p["aproximadas"] for p in partes)),
        "caja_zona_fina": caja,
        "rojos_rayos": int((par & (t < t_rojo)).sum()),
        "avisos_rayos": int((par | cuna).sum()),
    }
    if pct < float(c["impacto_min_pct"]):
        raise NoMedido("solo impacto el %s %% de los rayos (menos de %s %% la medicion no es valida): la malla esta "
                       "abierta o con las normales al reves" % (_mm(pct, 1), c["impacto_min_pct"]))
    if res["rojos_rayos"]:
        res["veredicto"] = "rojo"
    elif res["avisos_rayos"]:
        res["veredicto"] = "aviso"
    else:
        res["veredicto"] = "verde"
    res["segundos_medicion"] = round(time.time() - t0, 2)
    return res


# =========================================================================================
# PIEZAS DE ENSAYO (las de 04_decision.md, 1.2) — las usa el autotest y test_espesor_pared.py
# =========================================================================================
def pieza_alma(w):
    """Bloque 40 x 20 x 10 con dos bolsillos (arriba y abajo, 32 x 12, borde de 4 mm) que dejan un alma de w mm."""
    from build123d import Box, Pos
    alto = 5.0 - w / 2.0
    sup = Pos(0, 0, w / 2.0 + (alto + 1.0) / 2.0) * Box(32, 12, alto + 1.0)
    inf = Pos(0, 0, -(w / 2.0 + (alto + 1.0) / 2.0)) * Box(32, 12, alto + 1.0)
    return Box(40, 20, 10) - sup - inf


def pieza_pin():
    """Pin Ø5 de 10 mm con punta conica de 4 mm que termina en un vertice (se afina a 0)."""
    from build123d import Cone, Cylinder, Pos
    return Cylinder(2.5, 10) + Pos(0, 0, 7) * Cone(2.5, 0.0, 4.0)


def pieza_cuna(largo=100.0, ancho=60.0, grueso_ancho=3.0, grueso_fino=0.3):
    """Cuna de largo x ancho que va de grueso_ancho a grueso_fino de espesor (caras que convergen 1,55 grados)."""
    from build123d import Face, Vector, Wire, extrude
    pts = [Vector(0, 0, 0), Vector(largo, 0, 0), Vector(largo, 0, grueso_fino), Vector(0, 0, grueso_ancho)]
    cara = Face(Wire.make_polygon(pts, close=True))
    return extrude(cara, amount=ancho, dir=Vector(0, 1, 0))


def alma_con_pin(w):
    """Bloque con alma de w mm y, sobre la cara del extremo x = 20, un pin Ø5 con punta conica que sale hacia +X.
    Es la pieza base del ejercicio 25 del banco: la BIEN (w = 1,6) y los MAL de alma (0,30 y 0,60) solo cambian w."""
    from build123d import Pos, Rot
    pin = Rot(0, 90, 0) * pieza_pin()       # el eje del pin pasa a X y la punta mira a +X
    bb = pin.bounding_box()
    # la base del pin entra 2 mm en el bloque (cara x = 20): solape para fundir sin caras coincidentes
    return pieza_alma(w) + Pos(20 - 2.0 - bb.min.X, 0, 0) * pin


def autotest(c):
    """Lista de problemas; vacia = el control separa BIEN de MAL en las dos direcciones."""
    prob = []
    casos = (
        ("BIEN alma de 1,6", lambda: pieza_alma(1.6), "verde", (1.6, 1.6)),
        ("MAL  alma de 0,30", lambda: pieza_alma(0.30), "rojo", (0.30, 0.30)),
        ("MAL  alma de 0,60", lambda: pieza_alma(0.60), "aviso", (0.60, 0.60)),
        ("BIEN pin de 5 mm con punta conica", pieza_pin, "verde", None),
        ("MAL  cuna 100x60 de 3 a 0,3", pieza_cuna, "aviso", (0.30, 0.34)),
    )
    for nombre, f, esperado, rango in casos:
        try:
            forma = f()
            r = medir_formas(forma.solids(), c)
        except Exception as e:
            prob.append("%s: el control fallo (%s: %s)" % (nombre, type(e).__name__, e))
            continue
        fj = r["fino_juzgado"]
        print("    %-34s veredicto=%-5s minimo=%s mm  (juzgado: %s)  puntas=%d  rayos=%d  %.1f s"
              % (nombre, r["veredicto"], _mm(r["espesor_min_todos_mm"]), _mm(fj["espesor_mm"]) if fj else "-",
                 r["puntas_sin_juzgar_rayos"], r["rayos"], r["segundos_medicion"]))
        if r["veredicto"] != esperado:
            prob.append("%s: esperado %s, dio %s" % (nombre, esperado, r["veredicto"]))
        if rango is not None:
            medido = fj["espesor_mm"] if fj else r["espesor_min_todos_mm"]
            if medido is None or not (rango[0] - 0.03 <= medido <= rango[1] + 0.03):
                prob.append("%s: el minimo medido %s no esta en %s-%s" % (nombre, medido, rango[0], rango[1]))
        if nombre.startswith("MAL  alma") and fj and abs(fj["punto"][2]) > float(nombre.split()[-1].replace(",", ".")) / 2 + 0.05:
            prob.append("%s: el minimo esta fuera del alma (punto %s)" % (nombre, fj["punto"]))
        if "cuna" in nombre:
            if r["paralelas_bajo_aviso_mm2"] > 0 or r["rojos_rayos"]:
                prob.append("%s: la cuna dio paralelas/rojo (el angulo entre caras es 1,55 grados)" % nombre)
            if not r["cunas"] or r["cunas"]["punto"][0] < 90.0:
                prob.append("%s: el minimo no esta en la punta fina (x > 90): %s" % (nombre, r["cunas"]))
        if "pin" in nombre:
            if r["puntas_sin_juzgar_rayos"] < 1 or r["espesor_min_todos_mm"] is None or r["espesor_min_todos_mm"] > 0.3:
                prob.append("%s: la grilla no llego a la punta del cono (min de todos los rayos %s, puntas %d): el "
                            "ensayo de 'no da falso rojo' no probo nada" % (nombre, r["espesor_min_todos_mm"],
                                                                            r["puntas_sin_juzgar_rayos"]))
    return prob


_AUTOTEST_OK = {}


def correr_autotest(c):
    """El autotest corre en cada invocacion del programa; dentro de un mismo proceso (los tests) se hace una vez."""
    if "prob" not in _AUTOTEST_OK:
        print("AUTOTEST del control de pared minima (piezas BIEN/MAL propias)")
        _AUTOTEST_OK["prob"] = autotest(c)
    return _AUTOTEST_OK["prob"]


# =========================================================================================
# CLI
# =========================================================================================
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--step")
    ap.add_argument("--paso", type=float, default=None, help="separacion media entre rayos [mm]; por defecto el canon")
    ap.add_argument("--max-rayos", type=int, default=None)
    ap.add_argument("--tope-seg", type=float, default=None)
    ap.add_argument("--solo-autotest", action="store_true")
    ap.add_argument("--json", default=None)
    ap.add_argument("--workdir", default=None, help="workdir con manifest.json donde queda la evidencia")
    ap.add_argument("--acepto-pared", default=None, metavar="FRASE",
                    help="Fak asume la pared fina: frase de 10 caracteres o mas; queda en el manifest con fecha, "
                         "firma del STEP y minimo (exige --workdir)")
    ap.add_argument("--hoy", default=None, help="fecha simulada AAAA-MM-DD (solo con CAD_GATE_TEST=1)")
    a = ap.parse_args(argv)
    t0 = time.time()
    try:
        c = canon()
    except (OSError, ValueError) as e:
        print("NO MEDIDO: no se pudo leer %s (%s)" % (CANON, e))
        return 2
    res = {"gate": "pared_minima", "medido": False, "veredicto": "no_medido", "modo": None, "step": a.step,
           "step_firma": None, "umbral_rojo_mm": c["umbral_rojo_mm"], "umbral_aviso_mm": c["umbral_aviso_mm"],
           "hoy": None, "aviso_hasta": c["aviso_hasta"], "con_carga": "NO MEDIDO", "motivo": None}

    def cerrar(codigo, texto):
        res["segundos"] = round(time.time() - t0, 1)
        print(texto)
        if a.workdir and a.step and not a.solo_autotest:
            try:
                from cadlib import workdir as _wd
                _wd.ensure_workdir(a.workdir)
                ev = {k: v for k, v in res.items() if k not in ("gate", "modo")}
                _wd.record_evidence(a.workdir, "pared_minima", fixture=os.path.basename(a.step), **ev)
            except Exception as e:                               # pragma: no cover
                print("  (no se pudo escribir la evidencia en el manifest: %s)" % e)
        if a.json:
            with open(a.json, "w", encoding="utf-8") as f:
                json.dump(res, f, indent=1, ensure_ascii=False)
        print(json.dumps(res, ensure_ascii=True), flush=True)
        return codigo

    def no_medido(motivo):
        res["motivo"] = motivo
        return cerrar(2, "NO MEDIDO: %s. Un control que no midio nunca da verde." % motivo)

    try:
        hoy = hoy_pared(a.hoy)
    except (NoMedido, ValueError) as e:
        return no_medido(str(e))
    res["hoy"] = hoy.isoformat()

    prob = correr_autotest(c)
    if prob:
        print("  [AUTOTEST FALLA]")
        for x in prob:
            print("    - " + x)
        print("  No se juzga ninguna pieza con un control que no probo distinguir.")
        return 3
    print("  [AUTOTEST OK] el control separa BIEN de MAL.\n")
    if a.solo_autotest:
        return 0
    if not a.step:
        print("hace falta --step (o --solo-autotest)")
        return 2
    if a.acepto_pared is not None and len(a.acepto_pared.strip()) < int(c["frase_minima"]):
        res["motivo"] = "frase corta"
        return cerrar(1, "NO SE ACEPTA: --acepto-pared necesita la frase de Fak (%d caracteres o mas); llego '%s' "
                      "(frase corta)" % (int(c["frase_minima"]), a.acepto_pared))
    if a.acepto_pared is not None and not a.workdir:
        res["motivo"] = "aceptacion sin manifest"
        return cerrar(1, "NO SE ACEPTA: la aceptacion queda escrita en el manifest; falta --workdir")
    if os.path.isfile(a.step):
        from cadlib import workdir as _wd
        res["step_firma"] = _wd.file_signature(a.step)
    t_med = time.time()                       # el reloj de la medicion arranca despues del autotest
    try:
        forma = leer_step(a.step)
        r = medir_formas(forma.solids(), c, paso=a.paso, tope_seg=a.tope_seg, max_rayos=a.max_rayos, t0=t_med)
    except NoMedido as e:
        return no_medido(str(e))
    except Exception as e:
        return no_medido("error inesperado: %s: %s" % (type(e).__name__, e))
    res.update(r)
    res["medido"] = True
    _imprimir(a, r, c)

    aceptada = False
    if r["veredicto"] == "rojo" and a.acepto_pared is not None:
        from cadlib import workdir as _wd
        frase = a.acepto_pared.strip()
        man = _wd.load_manifest(a.workdir) if os.path.isfile(os.path.join(a.workdir, _wd.MANIFEST)) else {}
        otra = [e for e in man.get("evidence", []) if e.get("kind") == "pared_aceptada"
                and (e.get("frase") or "").strip() == frase and e.get("step_firma") != res["step_firma"]]
        if otra:
            res["motivo"] = "frase usada para otra version"
            return cerrar(1, "NO SE ACEPTA: esa frase ya acepto otra version del STEP (firma %s; hoy %s). Una "
                          "aceptacion vale para UNA firma: mirar la pieza nueva y escribir otra."
                          % (otra[-1].get("step_firma"), res["step_firma"]))
        _wd.ensure_workdir(a.workdir)
        minimo = (r["paralelas"] or {}).get("espesor_mm")
        _wd.record_evidence(a.workdir, "pared_aceptada", fixture=os.path.basename(a.step), step=a.step,
                            step_firma=res["step_firma"], frase=frase, fecha=hoy.isoformat(),
                            espesor_min_mm=minimo, rayos_rojos=r["rojos_rayos"],
                            umbral_rojo_mm=c["umbral_rojo_mm"])
        res["aceptacion"] = {"frase": frase, "fecha": hoy.isoformat(), "espesor_min_mm": minimo}
        aceptada = True
    modo = modo_pared(r["veredicto"], hoy, c["aviso_hasta"], aceptada)
    res["modo"] = modo
    resumen = _resumen(r, c)
    if modo == "verde":
        return cerrar(0, "[OK] ninguna pared bajo %s mm (con la salvedad: 'con carga %s mm' NO MEDIDO)"
                      % (_mm(c["umbral_aviso_mm"], 1), c["con_carga"]["umbral_mm"]))
    if modo == "aceptado":
        return cerrar(0, "[ACEPTADO] %s. Queda en el manifest: frase, fecha, firma del STEP y minimo." % resumen)
    salidas = "; ".join(c["salidas"])
    if modo == "aviso" and r["veredicto"] == "rojo":
        return cerrar(0, "AVISO: %s; freno desde %s. Salidas: %s" % (resumen, _dia_siguiente(c["aviso_hasta"]), salidas))
    if modo == "aviso":
        return cerrar(0, "AVISO: %s (el aviso no frena). Mirar si esa pared tiene que ser asi." % resumen)
    return cerrar(1, "FRENO: %s. Salidas: %s" % (resumen, salidas))


def _resumen(r, c):
    fj = r["fino_juzgado"]
    partes = []
    if r["rojos_rayos"]:
        pp = r["paralelas"]
        partes.append("pared de caras paralelas de %s mm (< %s) en (%s)" % (
            _mm(pp["espesor_mm"]), _mm(c["umbral_rojo_mm"], 2), ", ".join(_mm(x, 2) for x in pp["punto"])))
    elif fj:
        partes.append("pared fina de %s mm (< %s, %s) en (%s)" % (
            _mm(fj["espesor_mm"]), _mm(c["umbral_aviso_mm"], 1), fj["clase"], ", ".join(_mm(x, 2) for x in fj["punto"])))
    if r["caja_zona_fina"]:
        partes.append("zona fina en la caja [%s]" % ", ".join(_mm(x, 2) for x in r["caja_zona_fina"]))
    return "; ".join(partes) or "sin pared fina"


def _imprimir(a, r, c):
    print("pieza: %s   solidos %d   triangulos %d   paso %s mm   rayos %d   impacto %s %%"
          % (os.path.basename(a.step), r["solidos"], r["triangulos"], _mm(r["paso_mm"], 2), r["rayos"],
             _mm(r["impacto_pct"], 1)))
    print("  espesor minimo de todos los rayos (con las puntas de aristas y vertices): %s mm"
          % (_mm(r["espesor_min_todos_mm"]) if r["espesor_min_todos_mm"] is not None else "-"))
    for clave, titulo in (("paralelas", "caras PARALELAS"), ("cunas", "CUNA (caras que convergen)")):
        x = r[clave]
        if x:
            print("  %-28s minimo %s mm en (%s)  angulo entre caras %s grados"
                  % (titulo, _mm(x["espesor_mm"]), ", ".join(_mm(v, 2) for v in x["punto"]),
                     _mm(x["angulo_grados"], 2)))
    print("  area de cara con rayo fino (cada pared cuenta desde sus dos caras):")
    print("    paralelas bajo %s mm: %s mm2   paralelas bajo %s mm: %s mm2   cuna bajo %s mm: %s mm2"
          % (_mm(c["umbral_rojo_mm"], 2), _mm(r["paralelas_bajo_rojo_mm2"], 2), _mm(c["umbral_aviso_mm"], 1),
             _mm(r["paralelas_bajo_aviso_mm2"], 2), _mm(c["umbral_aviso_mm"], 1), _mm(r["cunas_bajo_aviso_mm2"], 2)))
    if r["puntas_sin_juzgar_rayos"]:
        pu = r["puntas"]
        print("  PUNTAS (no se juzgan, no avisan): %d rayos, %s mm2; la mas fina %s mm en (%s)"
              % (r["puntas_sin_juzgar_rayos"], _mm(r["puntas_sin_juzgar_mm2"], 2), _mm(pu["espesor_mm"]),
                 ", ".join(_mm(v, 2) for v in pu["punto"])))
    if r["normal_aproximada_rayos"]:
        print("  [OJO] %d rayos finos sin normal exacta (superficie que no es plano/cilindro/cono/esfera/toro, o pasado "
              "el presupuesto): el angulo sale de la malla y nunca cuentan como paralelas (avisan, no frenan)"
              % r["normal_aproximada_rayos"])
    if r["caja_zona_fina"]:
        print("  caja de la zona fina: %s" % r["caja_zona_fina"])
    print("  con carga (%s mm): NO MEDIDO - falta saber que pared carga (dato del pliego)" % c["con_carga"]["umbral_mm"])


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as _e:                                       # pragma: no cover
        print("NO MEDIDO: error inesperado: %s: %s" % (type(_e).__name__, _e))
        sys.exit(2)

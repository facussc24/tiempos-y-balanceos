# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr:
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe gate_ensamble.py --help
"""GATE de ENSAMBLE — el dispositivo esta DONDE tiene que estar, no solo "adentro".

Por que existe (fallo real, 2026-08-07): se entrego un STEP con dos solidos, la pieza del
cliente y un dispositivo, en su supuesta posicion de trabajo. Se verifico con
  (a) el bbox del dispositivo cae dentro del bbox de la pieza, y
  (b) el volumen se conservo tras la transformacion.
Las dos dieron bien. El dispositivo estaba corrido decenas de mm y sus machos quedaron
FUERA de las ranuras. El cliente lo abrio en su visor y lo vio en dos segundos.

Ninguna de las dos metricas PODIA verlo, y no es mala suerte:
  * un dispositivo corrido sigue cayendo dentro del bbox de una pieza mas grande;
  * el volumen no cambia por trasladar — de eso se trata trasladar.
Las dos miden la pieza contra si misma. Ninguna mide el ENCASTRE.

Lo que si ve un corrimiento, y es lo que mide este gate:

 1. EMPAREJAMIENTO macho-hembra. El usuario declara que abertura de la pieza tiene que
    recibir un saliente del dispositivo (--pareja <centro de la abertura>). El gate busca
    el contorno REAL de esa abertura en la topologia (el punto declarado solo sirve para
    ubicarla), le arma su plano, y mide EN ESE PLANO:
      - la distancia entre el centro de la abertura y el centro del saliente;
      - que fraccion del saliente cae DENTRO del contorno de la abertura;
      - que fraccion de la abertura queda ocupada;
      - el tamano del saliente contra el de la abertura. Un macho que entra en un agujero
        es MAS CHICO que el agujero: si en el plano hay un area 26 veces mayor, eso no es
        un macho, es el cuerpo del dispositivo apoyado encima o atravesando.
    Un corrimiento de 60 mm sale como 60 mm, no como "todo bien".

 2. INTERFERENCIA CLASIFICADA POR ZONA. Un total de puntos en choque no dice nada: el
    contacto BUSCADO del macho contra la pared de la ranura tambien suma, y suma mucho.
    El gate hace la INTERSECCION BOOLEANA de los dos solidos: cada solido que sale de ahi
    es una zona de choque separada, con su volumen exacto en mm3, su centro y su tamano.
    Despues clasifica cada zona: la que entra entera en el prisma de una abertura
    declarada es contacto buscado; el resto es CHOQUE. Asi se distingue "el macho aprieta
    contra la pared" de "la base atraviesa la pieza".

 3. RENDER OBLIGATORIO Y MIRABLE: planta y corte por el macho, los dos solidos en colores
    distintos y ENCUADRADOS EN LA ZONA — no el plano general del bbox, donde una ranura de
    10 mm en una pieza de 260 mm no se ve. Si el render no se genera, el gate FALLA.
    Nunca aprueba sin render.

Ejemplo (dos ranuras que reciben cada una su macho):
  gate_ensamble.py --step ENSAMBLE.step --solido-pieza 1 --solido-disp 2 \\
      --pareja X1,Y1,Z1 --pareja X2,Y2,Z2 --tol 2.0 --render renders/gate

Sin --pareja el gate NO adivina: lista las aberturas de la pieza con sus coordenadas
listas para copiar y sale con codigo 2.

Nota de implementacion: aca NO se usa trimesh.contains. En este venv no hay embree, el
intersector es el de numpy puro y tarda minutos por cada mil puntos. Todo se resuelve con
secciones planas (rellenadas por paridad) y con el booleano de OCC, que ademas da el
volumen exacto de cada choque en vez de un conteo de puntos.

Codigos de salida: 0 OK · 1 falla dura · 2 falta informacion (no decidir, preguntar)
                   3 interprete equivocado (cadlib.envcheck)
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom, render, workdir  # noqa: E402
import gate_zona as GZ  # noqa: E402  (reusa la busqueda de lazos internos ya probada)

import numpy as np  # noqa: E402
import gmsh  # noqa: E402

OK, FALLA, FALTA_INFO = 0, 1, 2

COLOR_PIEZA = "#4a7ebb"
COLOR_DISP = "#e07b39"
COLOR_ABERTURA = "#2e7d32"
COLOR_CHOQUE = "#c62828"
COLOR_SALIENTE = "#7b1fa2"

MIN_BYTES_RENDER = 5000   # un PNG mas chico que esto es un lienzo vacio, no un render
MAX_TRIS_3D = 30000       # matplotlib se arrastra por encima de esto
EPS_PLANO = 0.01          # mm: corta apenas al costado del plano exacto, para no caer
                          # sobre una cara del dispositivo que sea coplanar con el


# =====================================================================================
# cache en disco (el STEP del cliente tarda ~12 s solo en importarse)
# =====================================================================================
def _firma(path):
    st = os.stat(path)
    return "%d-%d" % (st.st_size, int(st.st_mtime))


def _cacheado(cachedir, nombre, calcular):
    os.makedirs(cachedir, exist_ok=True)
    p = os.path.join(cachedir, nombre + ".json")
    if os.path.isfile(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f), True
    v = calcular()
    with open(p, "w", encoding="utf-8") as f:
        json.dump(v, f)
    return v, False


# =====================================================================================
# solidos, mallas e interseccion booleana
# =====================================================================================
def _inventario_solidos(step):
    """[(tag, volumen_mm3, bbox)] sin mallar nada."""
    out = []
    with geom.gmsh_session():
        geom._load(step)
        for d, t in gmsh.model.occ.getEntities(3):
            out.append((int(t), float(gmsh.model.occ.getMass(d, t)),
                        np.asarray(gmsh.model.getBoundingBox(d, t), dtype=float)))
    return out


def _zonas_choque(step, tag_p, tag_d):
    """Interseccion booleana pieza ∩ dispositivo -> una zona por solido resultante.

    Cada solido que devuelve OCC es un pedazo de material COMPARTIDO, separado de los
    demas. Eso es el clustering hecho por el kernel, exacto y con volumen en mm3 — no
    una nube de puntos con un umbral de agrupamiento inventado.
    """
    zonas = []
    with geom.gmsh_session():
        geom._load(step)
        out, _ = gmsh.model.occ.intersect([(3, tag_p)], [(3, tag_d)],
                                          removeObject=True, removeTool=True)
        gmsh.model.occ.synchronize()
        for d, t in out:
            bb = np.asarray(gmsh.model.getBoundingBox(d, t), dtype=float)
            zonas.append({"vol": float(gmsh.model.occ.getMass(d, t)),
                          "centro": [float(x) for x in gmsh.model.occ.getCenterOfMass(d, t)],
                          "lo": bb[0:3].tolist(), "hi": bb[3:6].tolist(),
                          "ext": (bb[3:6] - bb[0:3]).tolist()})
    zonas.sort(key=lambda z: -z["vol"])
    return zonas


def _malla(step, tag, lc, cachedir, quiet=False):
    """Malla de UN solido del ensamble, cacheada (mallar una pieza de cliente cuesta minutos)."""
    import trimesh
    os.makedirs(cachedir, exist_ok=True)
    # La firma (tamano-mtime) va en el nombre. Sin ella, regenerar el ensamble con el
    # MISMO nombre de archivo devolvia la malla vieja y el gate juzgaba la version
    # anterior: dio FALLA sobre un ensamble ya corregido. Las claves de lazos_ y
    # choque_ si la llevaban; esta se habia quedado afuera.
    st = os.stat(step)
    nom = "%s_s%d_lc%.2f_%d-%d.ply" % (
        os.path.splitext(os.path.basename(step))[0].replace(" ", "_"), tag, lc,
        st.st_size, int(st.st_mtime))
    p = os.path.join(cachedir, nom)
    if os.path.isfile(p):
        m = trimesh.load(p, process=False)
        if not quiet:
            print("  solido %d: malla del cache (%d tris)" % (tag, len(m.faces)))
        return m
    if not quiet:
        print("  solido %d: mallando a lc=%.2f (la primera vez tarda minutos)..." % (tag, lc))
        sys.stdout.flush()
    m = geom.step_to_trimesh(step, lc=lc, keep={tag})
    m.export(p)
    if not quiet:
        print("  solido %d: %d tris, watertight=%s" % (tag, len(m.faces), m.is_watertight))
    return m


# =====================================================================================
# la hembra: contorno real de la abertura + su frame local
# =====================================================================================
def _centroide_poly(Q):
    """Centroide de AREA del poligono (el promedio de puntos se corre si el contorno esta
    muestreado desparejo, y el centro de la abertura es justo lo que se va a comparar)."""
    x, y = Q[:, 0], Q[:, 1]
    x1, y1 = np.roll(x, -1), np.roll(y, -1)
    a = x * y1 - x1 * y
    A = a.sum() / 2.0
    if abs(A) < 1e-9:
        return Q.mean(0)
    return np.array([((x + x1) * a).sum() / (6 * A), ((y + y1) * a).sum() / (6 * A)])


def _frame_abertura(poly, hacia):
    """Poligono 3D del lazo -> (centro3D, ex, ey, ez, Q2D, largo, ancho, planitud).

    ez = normal del plano, apuntando al lado donde vive el dispositivo.
    ey = eje LARGO del contorno, ex = el corto. El corte util de una ranura es el
    transversal: conviene que caiga sobre un eje del frame y no de refilon.
    """
    n, u0, v0, ctr, planitud = GZ._plano_local(poly, hacia)
    Q0 = np.column_stack([(poly - ctr) @ u0, (poly - ctr) @ v0])
    q = Q0 - Q0.mean(0)
    _, V = np.linalg.eigh(q.T @ q)          # eigh: ascendente -> V[:,0] = menor varianza
    corto, largo = V[:, 0], V[:, 1]
    ex = corto[0] * u0 + corto[1] * v0
    ey = largo[0] * u0 + largo[1] * v0
    ez = n / np.linalg.norm(n)
    if float(np.cross(ex, ey) @ ez) < 0:
        ex = -ex
    Q = np.column_stack([(poly - ctr) @ ex, (poly - ctr) @ ey])
    c2 = _centroide_poly(Q)
    return (ctr + c2[0] * ex + c2[1] * ey, ex, ey, ez, Q - c2,
            float(np.ptp(Q[:, 1])), float(np.ptp(Q[:, 0])), planitud)


def _buscar_abertura(lazos, punto, radio, hacia):
    """Lazo de la pieza mas cercano al punto declarado -> (dict, [mas cercanos])."""
    tabla = [{"cara": c, "poly": p, "centro_aprox": p.mean(0),
              "d": float(np.linalg.norm(p.mean(0) - punto))} for c, p in lazos]
    tabla.sort(key=lambda r: r["d"])
    cerca = [r for r in tabla if r["d"] <= radio]
    if not cerca:
        return None, tabla[:8]
    e = cerca[0]
    ctr3, ex, ey, ez, Q, largo, ancho, plan = _frame_abertura(e["poly"], hacia - e["centro_aprox"])
    e.update({"centro": ctr3, "ex": ex, "ey": ey, "ez": ez, "Q": Q, "largo": largo,
              "ancho": ancho, "planitud": plan, "area": GZ._area2d(Q), "otros": cerca[1:]})
    return e, tabla[:8]


def _a_local(P, ab):
    """Puntos globales (...,3) -> coordenadas del frame de la abertura."""
    M = np.column_stack([ab["ex"], ab["ey"], ab["ez"]])
    return (np.asarray(P, dtype=float).reshape(-1, 3) - ab["centro"]) @ M


def _tris_local(m, ab):
    M = np.column_stack([ab["ex"], ab["ey"], ab["ez"]])
    return ((m.triangles.reshape(-1, 3) - ab["centro"]) @ M).reshape(-1, 3, 3)


# =====================================================================================
# 1) el saliente: seccion del dispositivo EN el plano de la abertura
# =====================================================================================
def _segmentos(tris_local, eje, c0):
    s = render.section_segments(tris_local, eje, c0)
    return np.asarray(s, dtype=float).reshape(-1, 2, 2) if s else np.zeros((0, 2, 2))


def _rasterizar(segs, gx, gy):
    """Relleno por PARIDAD (scanline) de los lazos cerrados de una seccion.

    La seccion de una malla estanca son lazos cerrados: para cada fila y, un punto esta
    adentro si deja un numero impar de cruces a su izquierda. Es exacto y cuesta una
    pasada por fila — reemplaza al trimesh.contains, que en este venv (sin embree) tarda
    minutos por cada mil puntos.
    """
    img = np.zeros((len(gx), len(gy)), bool)
    if not len(segs):
        return img
    A, B = segs[:, 0], segs[:, 1]
    for j, y in enumerate(gy):
        m = (A[:, 1] > y) != (B[:, 1] > y)
        if not m.any():
            continue
        a, b = A[m], B[m]
        xs = np.sort(a[:, 0] + (y - a[:, 1]) * (b[:, 0] - a[:, 0]) / (b[:, 1] - a[:, 1]))
        img[:, j] = (np.searchsorted(xs, gx, side="right") % 2) == 1
    return img


def _medir_saliente(ab, td, paso, busqueda, z_corte):
    """Que hay del dispositivo en el plano de la abertura, cuanto y donde."""
    from scipy import ndimage
    Q = ab["Q"]
    lo, hi = Q.min(0) - busqueda, Q.max(0) + busqueda
    gx = np.arange(lo[0], hi[0] + paso, paso)
    gy = np.arange(lo[1], hi[1] + paso, paso)
    img = _rasterizar(_segmentos(td, 2, z_corte + EPS_PLANO), gx, gy)
    XX, YY = np.meshgrid(gx, gy, indexing="ij")
    G2 = np.column_stack([XX.ravel(), YY.ravel()])
    en_ab = GZ._dentro(Q, G2).reshape(img.shape)
    n_ab = max(int(en_ab.sum()), 1)
    area_ab = n_ab * paso * paso
    lab, nl = ndimage.label(img, structure=np.ones((3, 3), int))
    clusters = []
    for k in range(1, nl + 1):
        sel = lab == k
        n = int(sel.sum())
        if n < 3:
            continue
        idx = np.argwhere(sel)
        c = np.array([gx[idx[:, 0]].mean(), gy[idx[:, 1]].mean()])
        sol = int((sel & en_ab).sum())
        clusters.append({"n": n, "area": n * paso * paso, "centro2d": c,
                         "dist": float(np.linalg.norm(c)), "solape": sol,
                         "frac_dentro": sol / float(n),
                         "frac_abertura": sol / float(n_ab),
                         "relacion": (n * paso * paso) / area_ab,
                         "ext": [float(np.ptp(gx[idx[:, 0]])), float(np.ptp(gy[idx[:, 1]]))],
                         "celdas": np.column_stack([gx[idx[:, 0]], gy[idx[:, 1]]])})
    # el saliente es el que MAS tapa la abertura; si ninguno la toca, el mas cercano
    clusters.sort(key=lambda c: (-c["solape"], c["dist"]))
    return {"clusters": clusters, "saliente": clusters[0] if clusters else None,
            "area_abertura": area_ab, "z_corte": z_corte,
            "ocupacion": float((img & en_ab).sum()) / n_ab}


# =====================================================================================
# 2) clasificar cada zona de choque
# =====================================================================================
def _en_prisma(P, ab, holgura, prof):
    """Mascara: que puntos caen dentro del prisma de la abertura (+holgura lateral)."""
    L = _a_local(P, ab)
    xy = L[:, :2]
    d = GZ._dist_poligono(xy, ab["Q"])
    d[GZ._dentro(ab["Q"], xy)] = 0.0
    return (np.abs(L[:, 2]) <= prof) & (d <= holgura)


def _esquinas(z):
    lo, hi = np.asarray(z["lo"]), np.asarray(z["hi"])
    return np.array([[lo[0] if b & 1 else hi[0], lo[1] if b & 2 else hi[1],
                      lo[2] if b & 4 else hi[2]] for b in range(8)])


def _clasificar_zonas(zonas, aberturas, holgura, prof):
    """Una zona es contacto BUSCADO si entra ENTERA en el prisma de alguna abertura."""
    for z in zonas:
        z["pareja"] = None
        for ab in aberturas:
            if _en_prisma(_esquinas(z), ab, holgura, prof).all():
                z["pareja"] = ab["idx"]
                break
        z["dmin"] = min(float(np.linalg.norm(np.asarray(z["centro"]) - ab["centro"]))
                        for ab in aberturas)
    return zonas


# =====================================================================================
# 3) render: planta + corte, encuadrados en la zona
# =====================================================================================
def _dibujar(ax, segs, color, lw, label):
    for i, (a, b) in enumerate(segs):
        ax.plot([a[0], b[0]], [a[1], b[1]], color=color, lw=lw,
                label=(label if i == 0 else None), solid_capstyle="round")


def _renders(dirout, ab, tp, td, sal, choques, lim, titulo):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    k = ab["idx"]
    Qc = np.vstack([ab["Q"], ab["Q"][:1]])
    s = sal["saliente"] if sal else None
    files = []

    # ---------------- PLANTA: el plano de la abertura --------------------------------
    z0 = sal["z_corte"] + EPS_PLANO if sal else EPS_PLANO
    fig, ax = plt.subplots(figsize=(9, 6.75), dpi=render.DPI_PLOT)
    if s is not None:
        c = s["celdas"]
        ax.scatter(c[:, 0], c[:, 1], s=3, c=COLOR_DISP, alpha=0.13, linewidths=0, zorder=0,
                   label="dispositivo (material en el plano)")
    _dibujar(ax, _segmentos(tp, 2, z0), COLOR_PIEZA, 1.2, "pieza (seccion)")
    _dibujar(ax, _segmentos(td, 2, z0), COLOR_DISP, 1.7, "dispositivo (seccion)")
    ax.plot(Qc[:, 0], Qc[:, 1], color=COLOR_ABERTURA, lw=2.8, label="ABERTURA (contorno real)")
    ax.plot(0, 0, "P", color=COLOR_ABERTURA, ms=13, mec="k", mew=0.6, label="centro abertura")
    for j, (cxy, vol) in enumerate(choques):
        ax.plot(cxy[0], cxy[1], "o", color=COLOR_CHOQUE, ms=9, mec="k", mew=0.6,
                label="choque (zona de material compartido)" if j == 0 else None)
        ax.annotate("%.0f mm3" % vol, (cxy[0], cxy[1]), textcoords="offset points",
                    xytext=(7, 6), color=COLOR_CHOQUE, fontsize=8, fontweight="bold")
    if s is not None:
        cm = s["centro2d"]
        ax.plot(cm[0], cm[1], "X", color=COLOR_SALIENTE, ms=15, mec="k", mew=0.6,
                label="centro del saliente")
        ax.annotate("", xy=(cm[0], cm[1]), xytext=(0, 0),
                    arrowprops=dict(arrowstyle="<->", color=COLOR_SALIENTE, lw=2.2, ls="--"))
        ax.text(cm[0] / 2, cm[1] / 2, "  %.2f mm" % float(np.linalg.norm(cm)),
                color=COLOR_SALIENTE, fontsize=15, fontweight="bold")
    ax.set_xlim(lim[0], lim[1])
    ax.set_ylim(lim[2], lim[3])
    ax.set_aspect("equal")
    ax.grid(alpha=0.3)
    ax.set_xlabel("eje CORTO de la abertura [mm]")
    ax.set_ylabel("eje LARGO de la abertura [mm]")
    ax.set_title("PLANTA en el plano de la abertura — %s" % titulo)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), fontsize=8, framealpha=0.95)
    f = os.path.join(dirout, "planta_p%d.png" % k)
    fig.savefig(f, bbox_inches="tight")
    plt.close(fig)
    files.append(f)

    # ---------------- CORTE: por la abertura y por el saliente -----------------------
    ym = float(s["centro2d"][1]) if s is not None else 0.0
    cortes = [(0.0, "corte POR LA ABERTURA  (y = 0)"),
              (ym, "corte POR EL SALIENTE  (y = %.1f mm)" % ym)]
    segs = {y0: (_segmentos(tp, 1, y0), _segmentos(td, 1, y0)) for y0, _ in cortes}
    # el alto se ajusta a lo que hay entre los limites en x, no a media pantalla vacia
    zz = [S.reshape(-1, 2)[:, 1] for par in segs.values() for S in par
          if len(S) and ((S.reshape(-1, 2)[:, 0] > lim[0]) & (S.reshape(-1, 2)[:, 0] < lim[1])).any()]
    zz = np.concatenate(zz) if zz else np.array([-10.0, 10.0])
    alto = max(float(np.abs(zz).max()) * 1.15, 12.0)
    fig, axs = plt.subplots(1, 2, figsize=(11.5, 5.4), dpi=render.DPI_PLOT)
    for ax2, (y0, tit) in zip(axs, cortes):
        _dibujar(ax2, segs[y0][0], COLOR_PIEZA, 1.5, "pieza")
        _dibujar(ax2, segs[y0][1], COLOR_DISP, 1.9, "dispositivo")
        ax2.axvline(0, color=COLOR_ABERTURA, ls="--", lw=1.5, label="eje de la abertura")
        ax2.axhline(0, color="#777", ls=":", lw=1.1, label="plano de la abertura")
        if s is not None:
            ax2.axvline(s["centro2d"][0], color=COLOR_SALIENTE, ls="--", lw=1.5,
                        label="eje del saliente")
        ax2.set_xlim(lim[0], lim[1])
        ax2.set_ylim(-alto, alto)
        ax2.set_aspect("equal")
        ax2.grid(alpha=0.3)
        ax2.set_xlabel("eje CORTO de la abertura [mm]")
        ax2.set_ylabel("altura sobre el plano de la abertura [mm]")
        ax2.set_title(tit, fontsize=10)
        ax2.legend(loc="upper right", fontsize=8)
    fig.suptitle("CORTE — %s" % titulo)
    f = os.path.join(dirout, "corte_p%d.png" % k)
    fig.savefig(f, bbox_inches="tight")
    plt.close(fig)
    files.append(f)

    # ---------------- vista 3D sombreada, recortada a la zona ------------------------
    # NUNCA submuestrear los triangulos para que "entren": una malla diezmada se dibuja
    # como una nube de manchas con agujeros y parece un defecto de la pieza. O entra
    # entera o no se hace la vista 3D (que es de apoyo; las obligatorias son las 2D).
    def _crop(t):
        c = t.mean(1)
        return t[(c[:, 0] > lim[0]) & (c[:, 0] < lim[1]) &
                 (c[:, 1] > lim[2]) & (c[:, 1] < lim[3]) & (np.abs(c[:, 2]) < 30)]

    cp, cd = _crop(tp), _crop(td)
    if len(cp) + len(cd) > MAX_TRIS_3D:
        print("  (vista 3D omitida: %d triangulos en la zona, mas de %d. Las 2D mandan.)"
              % (len(cp) + len(cd), MAX_TRIS_3D))
    elif len(cp) or len(cd):
        Q3 = np.column_stack([ab["Q"], np.zeros(len(ab["Q"]))])
        files += render.render_views(
            [(cp, COLOR_PIEZA, 0.55), (cd, COLOR_DISP, 0.95)],
            os.path.join(dirout, "vista3d_p%d" % k), views={"iso": (28, -55)},
            title=titulo, points=[(Q3, COLOR_ABERTURA, "abertura")], figsize=(11, 9))
    return files


# =====================================================================================
def cmd(args):
    t0 = time.time()
    step = args.step
    if not os.path.isfile(step):
        sys.stderr.write("[gate_ensamble] no existe el STEP: %s\n" % step)
        return FALTA_INFO
    dirout = args.render
    os.makedirs(dirout, exist_ok=True)
    w = workdir.ensure_workdir(args.workdir) if args.workdir else None
    cachedir = os.path.join(w, "cache") if w else os.path.join(dirout, ".cache")
    sig = _firma(step)

    print("=" * 88)
    print("GATE DE ENSAMBLE — %s" % os.path.basename(step))
    print("=" * 88)

    # ---------- solidos ----------
    inv = _inventario_solidos(step)
    print("\nSOLIDOS DEL ENSAMBLE (%d)" % len(inv))
    for t, vol, bb in inv:
        print("  tag %-3d vol %9.1f cm3   bbox %7.1f x %7.1f x %7.1f mm   centro (%.1f, %.1f, %.1f)"
              % (t, vol / 1000.0, bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2],
                 (bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2))
    if len(inv) < 2:
        print("\n[FALTA INFO] el STEP tiene %d solido(s). Un gate de ensamble necesita 2 o mas."
              % len(inv))
        return FALTA_INFO
    tags = {t for t, _, _ in inv}
    for nom, tg in (("--solido-pieza", args.solido_pieza), ("--solido-disp", args.solido_disp)):
        if tg not in tags:
            print("\n[FALTA INFO] %s=%d no existe. Tags disponibles: %s" % (nom, tg, sorted(tags)))
            return FALTA_INFO
    if args.solido_pieza == args.solido_disp:
        print("\n[FALTA INFO] --solido-pieza y --solido-disp son el mismo solido.")
        return FALTA_INFO
    bb_p = [b for t, _, b in inv if t == args.solido_pieza][0]
    bb_d = [b for t, _, b in inv if t == args.solido_disp][0]
    ctr_d = (bb_d[0:3] + bb_d[3:6]) / 2

    dentro_bbox = bool(np.all(bb_d[0:3] >= bb_p[0:3]) and np.all(bb_d[3:6] <= bb_p[3:6]))
    print("\nLO QUE NO ALCANZA (se imprime para el contraste):")
    print("  el bbox del dispositivo cae dentro del de la pieza: %s   (dato, NO criterio)"
          % ("SI" if dentro_bbox else "NO"))
    print("  ese chequeo, y el de 'el volumen se conservo tras la transformacion', dan bien")
    print("  con el dispositivo corrido 60 mm. Por eso este gate mide el ENCASTRE, no la caja.")

    # ---------- aberturas de la pieza ----------
    print("\nContornos internos de la pieza (solido %d)..." % args.solido_pieza)
    sys.stdout.flush()
    crudo, del_cache = _cacheado(
        cachedir, "lazos_%s_s%d_%.1f_%.1f" % (sig, args.solido_pieza, args.min_lazo, args.max_lazo),
        lambda: [[c, p.tolist()] for c, s, p in
                 GZ._lazos_internos(step, args.min_lazo, args.max_lazo) if s == args.solido_pieza])
    lazos = [(int(c), np.asarray(p, dtype=float)) for c, p in crudo]
    print("  %d contornos internos%s" % (len(lazos), " (del cache)" if del_cache else ""))
    if not lazos:
        print("\n[FALTA INFO] la pieza no tiene contornos internos entre %.1f y %.1f mm de diagonal."
              % (args.min_lazo, args.max_lazo))
        return FALTA_INFO

    if not args.pareja:
        print("\n[FALTA INFO] no declaraste ninguna pareja macho-hembra (--pareja x,y,z).")
        print("El gate NO adivina cual saliente va en cual abertura. Aberturas de la pieza,")
        print("de la mas grande a la mas chica, con la coordenada lista para copiar:\n")
        tabla = []
        for cara, poly in lazos:
            c3, _, _, _, _, L, A, _ = _frame_abertura(poly, ctr_d - poly.mean(0))
            tabla.append((L, A, c3, cara))
        tabla.sort(key=lambda r: -r[0])
        for L, A, c3, cara in tabla[:15]:
            print("   cara %-5d  %7.2f x %6.2f mm    --pareja %.2f,%.2f,%.2f"
                  % (cara, L, A, c3[0], c3[1], c3[2]))
        return FALTA_INFO

    aberturas = []
    for i, spec in enumerate(args.pareja, 1):
        try:
            v = [float(x) for x in spec.split(",")]
        except ValueError:
            v = []
        if len(v) not in (3, 4):
            print("\n[FALTA INFO] --pareja mal escrita: '%s'. Formato: x,y,z[,radio]" % spec)
            return FALTA_INFO
        punto = np.array(v[:3])
        radio = v[3] if len(v) == 4 else args.radio_busqueda
        ab, cerca = _buscar_abertura(lazos, punto, radio, ctr_d)
        if ab is None:
            print("\n[FALTA INFO] pareja %d: no hay ninguna abertura a menos de %.1f mm del punto"
                  % (i, radio))
            print("declarado (%.2f, %.2f, %.2f). Las mas cercanas:" % tuple(punto))
            for r in cerca:
                print("   cara %-5d  a %8.2f mm   centro (%.2f, %.2f, %.2f)"
                      % (r["cara"], r["d"], *r["centro_aprox"]))
            print("Corregir la coordenada, o ampliar el radio: --pareja x,y,z,<radio>")
            return FALTA_INFO
        ab["idx"] = i
        ab["declarado"] = punto
        aberturas.append(ab)

    print("\nABERTURAS EMPAREJADAS")
    for ab in aberturas:
        print("  pareja %d: cara %d · %.2f x %.2f mm · area %.1f mm2 · planitud %.4f mm"
              % (ab["idx"], ab["cara"], ab["largo"], ab["ancho"], ab["area"], ab["planitud"]))
        print("            centro real (%.2f, %.2f, %.2f) — a %.2f mm del punto declarado"
              % (*ab["centro"], float(np.linalg.norm(ab["centro"] - ab["declarado"]))))
        if ab["otros"]:
            print("            [aviso] hay %d abertura(s) mas dentro del radio; se tomo la mas cercana"
                  % len(ab["otros"]))

    # ---------- mallas ----------
    print("\nMALLAS (lc=%.2f)" % args.lc)
    m_pieza = _malla(step, args.solido_pieza, args.lc, cachedir)
    m_disp = _malla(step, args.solido_disp, args.lc, cachedir)

    fallas = []
    res_parejas = []

    # =========================== 1) EMPAREJAMIENTO ==================================
    print("\n" + "-" * 88)
    print("1) EMPAREJAMIENTO MACHO-HEMBRA   (tolerancia entre centros: %.2f mm)" % args.tol)
    print("-" * 88)
    for ab in aberturas:
        ab["_tp"] = _tris_local(m_pieza, ab)
        ab["_td"] = _tris_local(m_disp, ab)
        sal = _medir_saliente(ab, ab["_td"], args.paso, args.busqueda, args.z_corte)
        ab["_sal"] = sal
        print("\npareja %d — abertura de %.2f x %.2f mm (area %.1f mm2) en (%.2f, %.2f, %.2f)"
              % (ab["idx"], ab["largo"], ab["ancho"], sal["area_abertura"], *ab["centro"]))
        if sal["saliente"] is None:
            print("  el dispositivo NO CRUZA el plano de la abertura en %.0f mm a la redonda."
                  % args.busqueda)
            print("  [FALLA] no hay ningun saliente que emparejar con esta abertura.")
            fallas.append("pareja %d: no hay saliente en el plano de la abertura" % ab["idx"])
            res_parejas.append({"pareja": ab["idx"], "cara": ab["cara"], "saliente": False,
                                "ok": False})
            continue
        s = sal["saliente"]
        print("  material del dispositivo en ese plano: %d grupo(s)" % len(sal["clusters"]))
        for j, c in enumerate(sal["clusters"][:5], 1):
            print("    grupo %d: %8.1f mm2 (%5.1f x %5.1f mm) · su centro a %7.2f mm del de la"
                  " abertura · dentro de ella %5.1f %%"
                  % (j, c["area"], c["ext"][0], c["ext"][1], c["dist"], 100 * c["frac_dentro"]))
        d = s["dist"]
        print("  SALIENTE tomado: el grupo que mas tapa la abertura (%.1f mm2)" % s["area"])
        print("  >> ocupacion de la abertura: %.1f %%   (minimo %.1f %%)"
              % (100 * sal["ocupacion"], 100 * args.min_ocupacion))
        print("  >> distancia entre centros, proyectada al plano de la abertura: %.2f mm"
              "   (tolerancia %.2f)" % (d, args.tol))
        print("     descompuesta: %+.2f mm sobre el eje corto · %+.2f mm sobre el eje largo"
              % (s["centro2d"][0], s["centro2d"][1]))
        print("  >> fraccion del saliente DENTRO del contorno: %.1f %%   (minimo %.1f %%)"
              % (100 * s["frac_dentro"], 100 * args.min_dentro))
        print("  >> tamano del saliente contra la abertura: %.1f veces   (maximo %.1f)"
              % (s["relacion"], args.max_relacion))
        ok = True
        if s["relacion"] > args.max_relacion:
            print("  [FALLA] eso NO es un saliente: %.1f mm2 de material continuo, %.1f veces el"
                  " area de la abertura (%.1f mm2). Un macho que entra en un agujero es MAS CHICO"
                  " que el agujero. Lo que hay en el plano es el cuerpo del dispositivo apoyado o"
                  " atravesando, no un macho encastrado."
                  % (s["area"], s["relacion"], sal["area_abertura"]))
            fallas.append("pareja %d: el saliente mide %.0f veces la abertura (es el cuerpo, "
                          "no un macho)" % (ab["idx"], s["relacion"]))
            ok = False
        if sal["ocupacion"] < args.min_ocupacion:
            print("  [FALLA] la abertura quedo ocupada solo al %.1f %% (min %.1f %%): no entro"
                  " nada en ella." % (100 * sal["ocupacion"], 100 * args.min_ocupacion))
            fallas.append("pareja %d: abertura ocupada al %.1f %%"
                          % (ab["idx"], 100 * sal["ocupacion"]))
            ok = False
        if d > args.tol:
            print("  [FALLA] el saliente esta a %.2f mm del centro de la abertura (tol %.2f)."
                  " NO entra." % (d, args.tol))
            fallas.append("pareja %d: centros a %.2f mm (tol %.2f)" % (ab["idx"], d, args.tol))
            ok = False
        if s["frac_dentro"] < args.min_dentro:
            print("  [FALLA] solo el %.1f %% del saliente cae dentro del contorno (min %.1f %%):"
                  " el resto apoya sobre material macizo."
                  % (100 * s["frac_dentro"], 100 * args.min_dentro))
            fallas.append("pareja %d: %.1f %% del saliente dentro del contorno"
                          % (ab["idx"], 100 * s["frac_dentro"]))
            ok = False
        if ok:
            print("  OK: el saliente entra en la abertura.")
        res_parejas.append({
            "pareja": ab["idx"], "cara": ab["cara"], "saliente": True,
            "centro_abertura": [round(float(x), 3) for x in ab["centro"]],
            "abertura_mm": [round(ab["largo"], 2), round(ab["ancho"], 2)],
            "area_abertura_mm2": round(sal["area_abertura"], 1),
            "ocupacion_abertura": round(float(sal["ocupacion"]), 4),
            "dist_centros_mm": round(d, 3),
            "offset_corto_mm": round(float(s["centro2d"][0]), 3),
            "offset_largo_mm": round(float(s["centro2d"][1]), 3),
            "area_saliente_mm2": round(float(s["area"]), 1),
            "relacion_area": round(float(s["relacion"]), 2),
            "frac_saliente_dentro": round(float(s["frac_dentro"]), 4), "ok": ok})

    # =========================== 2) INTERFERENCIA ===================================
    print("\n" + "-" * 88)
    print("2) INTERFERENCIA CLASIFICADA POR ZONA   (interseccion booleana de los 2 solidos)")
    print("-" * 88)
    sys.stdout.flush()
    zonas, del_cache = None, False
    try:
        zonas, del_cache = _cacheado(cachedir, "choque_%s_%d_%d" % (sig, args.solido_pieza,
                                                                   args.solido_disp),
                                     lambda: _zonas_choque(step, args.solido_pieza, args.solido_disp))
    except Exception as e:  # noqa: BLE001 — si no se puede medir, no se aprueba
        print("[FALLA] el booleano de interferencia reviento: %s: %s" % (type(e).__name__, e))
        fallas.append("no se pudo medir la interferencia (booleano fallido)")
        zonas = []
    if zonas is not None:
        _clasificar_zonas(zonas, aberturas, args.holgura, args.prof_contacto)
    buscadas = [z for z in zonas if z["pareja"] is not None]
    choques = [z for z in zonas if z["pareja"] is None and z["vol"] >= args.min_choque]
    menores = [z for z in zonas if z["pareja"] is None and z["vol"] < args.min_choque]
    print("zonas de material compartido: %d · volumen total %.1f mm3%s"
          % (len(zonas), sum(z["vol"] for z in zonas), " (del cache)" if del_cache else ""))
    if buscadas:
        print("\n  CONTACTO BUSCADO — la zona entra entera en el prisma de una abertura declarada:")
        for z in buscadas:
            print("    pareja %d · %8.2f mm3 · centro (%.1f, %.1f, %.1f) · %.1f x %.1f x %.1f mm"
                  % (z["pareja"], z["vol"], *z["centro"], *z["ext"]))
    if choques:
        print("\n  CHOQUE — fuera de toda abertura declarada:")
        for j, z in enumerate(choques, 1):
            print("    zona %d · %8.2f mm3 · centro (%.1f, %.1f, %.1f) · %.1f x %.1f x %.1f mm"
                  % (j, z["vol"], *z["centro"], *z["ext"]))
            print("             a %.1f mm de la abertura mas cercana — no es el contacto del macho"
                  % z["dmin"])
        fallas.append("%d zona(s) de choque fuera de las parejas; la mayor, %.1f mm3"
                      % (len(choques), choques[0]["vol"]))
    if menores:
        print("\n  (%d zona(s) por debajo de %.2f mm3 ignoradas como esquirlas del booleano)"
              % (len(menores), args.min_choque))
    if not zonas:
        print("  0 zonas: los solidos no se tocan.")
    elif not choques:
        print("\n  OK: toda la interferencia cae dentro de las parejas declaradas.")

    # =========================== 3) RENDER ==========================================
    print("\n" + "-" * 88)
    print("3) RENDER (obligatorio)")
    print("-" * 88)
    sys.stdout.flush()
    esperados, generados, err = [], [], None
    try:
        for ab in aberturas:
            s = ab["_sal"]["saliente"]
            pts = [np.zeros(2), ab["Q"].min(0), ab["Q"].max(0)]
            if s is not None:
                pts.append(s["centro2d"])
            A = np.array(pts)
            m = args.margen_render
            span = float(max(np.ptp(A[:, 0]), np.ptp(A[:, 1]))) + 2 * m
            cx, cy = (A[:, 0].min() + A[:, 0].max()) / 2, (A[:, 1].min() + A[:, 1].max()) / 2
            lim = [cx - span / 2, cx + span / 2, cy - span / 2, cy + span / 2]
            ch = []
            for z in choques:
                L = _a_local(np.asarray(z["centro"]), ab)[0]
                if lim[0] < L[0] < lim[1] and lim[2] < L[1] < lim[3]:
                    ch.append((L[:2], z["vol"]))
            titulo = "%s · pareja %d" % (os.path.basename(step), ab["idx"])
            generados += _renders(dirout, ab, ab["_tp"], ab["_td"], ab["_sal"], ch, lim, titulo)
            esperados += [os.path.join(dirout, "planta_p%d.png" % ab["idx"]),
                          os.path.join(dirout, "corte_p%d.png" % ab["idx"])]
    except Exception as e:  # noqa: BLE001 — cualquier fallo de render es falla del gate
        err = "%s: %s" % (type(e).__name__, e)
    faltan = [f for f in esperados
              if not (os.path.isfile(f) and os.path.getsize(f) >= MIN_BYTES_RENDER)]
    if err:
        print("[FALLA] el render reviento: %s" % err)
        fallas.append("render no generado (%s)" % err)
    if faltan or not esperados:
        print("[FALLA] faltan renders obligatorios: %s"
              % (", ".join(os.path.basename(f) for f in faltan) or "no se genero ninguno"))
        fallas.append("render obligatorio faltante — el gate no aprueba sin render")
    else:
        for f in sorted(set(generados)):
            if os.path.isfile(f):
                print("  %s   (%.0f KB)" % (f, os.path.getsize(f) / 1024.0))
        print("  MIRARLOS. El gate mide; la planta y el corte son para que se VEA.")

    # =========================== VEREDICTO ==========================================
    print("\n" + "=" * 88)
    if fallas:
        print("VEREDICTO: FALLA — NO ENTREGAR")
        for f in fallas:
            print("   · %s" % f)
        cod = FALLA
    else:
        print("VEREDICTO: OK — el ensamble esta bien posicionado")
        cod = OK
    print("tiempo: %.0f s" % (time.time() - t0))
    print("=" * 88)

    salida = {"step": os.path.basename(step), "solido_pieza": args.solido_pieza,
              "solido_disp": args.solido_disp, "tol_mm": args.tol, "parejas": res_parejas,
              "interferencia": {
                  "zonas": len(zonas), "vol_total_mm3": round(sum(z["vol"] for z in zonas), 2),
                  "contacto_buscado": [{"pareja": z["pareja"], "vol": round(z["vol"], 2)}
                                       for z in buscadas],
                  "choques": [{"vol": round(z["vol"], 2),
                               "centro": [round(x, 2) for x in z["centro"]],
                               "ext": [round(x, 2) for x in z["ext"]],
                               "dist_abertura_mm": round(z["dmin"], 2)} for z in choques]},
              "renders": [os.path.basename(f) for f in sorted(set(generados))],
              "fallas": fallas, "codigo": cod,
              "fixture": os.path.basename(args.step), "ok": cod == 0,
              "motivo": "; ".join(fallas) if fallas else ""}
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(salida, fh, indent=1, ensure_ascii=False)
        print("json -> %s" % args.json)
    if w:
        salida = dict(salida)
        salida["step_firma"] = workdir.file_signature(args.step)
        workdir.record_evidence(w, "ensamble_posicionado", **salida)
    return cod


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--step", required=True, help="STEP del ensamble (2 solidos o mas)")
    ap.add_argument("--solido-pieza", type=int, default=1, help="tag del solido de la pieza (%(default)s)")
    ap.add_argument("--solido-disp", type=int, default=2, help="tag del solido del dispositivo (%(default)s)")
    ap.add_argument("--pareja", action="append", default=[], metavar="x,y,z[,radio]",
                    help="centro aproximado de una abertura que TIENE que recibir un saliente. "
                         "Repetible. Sin esto el gate no adivina: lista las aberturas y sale con 2.")
    ap.add_argument("--tol", type=float, default=2.0,
                    help="mm maximos entre el centro de la abertura y el del saliente (%(default)s)")
    ap.add_argument("--min-dentro", type=float, default=0.90,
                    help="fraccion minima del saliente dentro del contorno (%(default)s)")
    ap.add_argument("--min-ocupacion", type=float, default=0.50,
                    help="fraccion minima de la abertura que el saliente tiene que ocupar (%(default)s)")
    ap.add_argument("--max-relacion", type=float, default=4.0,
                    help="area del saliente / area de la abertura por encima de la cual eso ya no "
                         "es un macho sino el cuerpo del dispositivo (%(default)s)")
    ap.add_argument("--z-corte", type=float, default=-1.0,
                    help="mm respecto del plano de la abertura donde se mide el saliente; "
                         "negativo = ADENTRO del agujero. El default (%(default)s) mide 1 mm "
                         "adentro a proposito: ahi vive el macho y no la brida que apoya sobre "
                         "la cara. Con 0 se mide la brida y todo parece gigante. Subirlo (o "
                         "ponerlo en 0) si la pared de la abertura es mas fina que eso.")
    ap.add_argument("--render", required=True, metavar="DIR",
                    help="carpeta de renders. OBLIGATORIO: sin render el gate no aprueba nada.")
    ap.add_argument("--lc", type=float, default=geom.LC_ANALYSIS, help="tamano de malla (%(default)s)")
    ap.add_argument("--paso", type=float, default=0.5,
                    help="mm de la grilla que mide el saliente en el plano (%(default)s)")
    ap.add_argument("--busqueda", type=float, default=90.0,
                    help="mm alrededor de la abertura donde se busca el saliente (%(default)s)")
    ap.add_argument("--radio-busqueda", type=float, default=25.0,
                    help="mm para encontrar la abertura real cerca del punto declarado (%(default)s)")
    ap.add_argument("--min-lazo", type=float, default=3.0, help="diagonal minima del contorno (%(default)s)")
    ap.add_argument("--max-lazo", type=float, default=250.0, help="diagonal maxima del contorno (%(default)s)")
    ap.add_argument("--holgura", type=float, default=3.0,
                    help="mm alrededor del contorno que siguen contando como contacto buscado (%(default)s)")
    ap.add_argument("--prof-contacto", type=float, default=25.0,
                    help="mm de profundidad del prisma de la abertura (%(default)s)")
    ap.add_argument("--min-choque", type=float, default=1.0,
                    help="mm3 minimos para que una zona cuente como choque (%(default)s)")
    ap.add_argument("--margen-render", type=float, default=25.0,
                    help="mm de margen alrededor de la zona en los renders (%(default)s)")
    ap.add_argument("--workdir", default=None, help="deja la evidencia en su manifest.json")
    ap.add_argument("--json", default=None, help="volcar los numeros a un .json")
    args = ap.parse_args()
    sys.exit(cmd(args))


if __name__ == "__main__":
    main()

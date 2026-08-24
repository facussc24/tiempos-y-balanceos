# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr:
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe gate_zona.py --help
"""GATE 0 ejecutable — QUE zona es, ANTES de medir y de modelar.

Por que existe (todos fallos reales sobre la MISMA pieza):
  * se modelaron 3 versiones agarrandose de las ranuras de los listones cuando la zona
    era el hueco del cargador: ninguna de las 7 verificaciones lo detecto porque TODAS
    median contra la zona elegida por mi;
  * ya con la zona confirmada se midio el contorno de un REBAJE COSMETICO creyendo que
    era una abertura — el panel era macizo ahi;
  * una lengueta quedo fundida a la placa y en el render no se veia;
  * cuatro errores de signo seguidos al reubicar una pieza.

Los cuatro se cazan MIDIENDO, no mirando. Este script mide:

  inventario  TODAS las aberturas de la pieza, ordenadas por tamano, cada una
              clasificada PASANTE / REBAJE / ESCALON por PARIDAD DE RAYOS (no por
              profundidad de pared, que es heuristica). Si queda mas de una candidata
              grande NO elige: sale con codigo 2 = preguntarle a Fak.
  pasante     un candidato puntual: "creo que aca hay un agujero" -> si/no en segundos.
  macizo      "esta zona tiene que ser AIRE (luz de una lengueta, vano)": lo verifica
              con puntos interiores, que es lo unico que ve un cuello macizo.
  pose        despues de mover una pieza: comprobar que quedo DONDE dije (bbox, centro,
              volumen, luz con signo contra otra pieza). Mata los errores de signo.

Codigos de salida: 0 OK · 1 falla dura · 2 AMBIGUO (no decidir, preguntar) · 3 interprete
equivocado (cadlib.envcheck) · 4 falta evidencia en el manifest.

Metodo de la clasificacion (el que corrige el fallo del rebaje cosmetico):
para cada lazo interno de cada cara se tiran rayos DENTRO del lazo y un anillo de rayos
AFUERA (sobre el material de al lado), y se comparan los impactos. Si adentro hay 2
impactos menos que afuera, falta el panel -> PASANTE. Si hay los mismos, ahi hay material
-> es un rebaje/grabado por mas que el contorno se vea perfecto. Es diferencial, asi que
no se cree nada sobre lo que haya detras.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom, render, topo, workdir  # noqa: E402

import numpy as np  # noqa: E402
import gmsh  # noqa: E402

OK, FALLA, AMBIGUO = 0, 1, 2

# ---------- parametros con nombre (nada de literales sueltos en el codigo) ----------
K_CURVA = 32          # puntos por curva al reconstruir el poligono de un lazo
MARGEN_PARED = 0.8    # mm: los rayos interiores se apartan esto de la pared del lazo
ANILLO = 3.0          # mm: cuanto afuera del lazo va el anillo de control
N_ANILLO = 24         # rayos de control por lazo
MAX_INT = 60          # tope de rayos interiores por lazo
DELTA_PASANTE = 2     # impactos de diferencia que definen "falta el panel"


# =====================================================================================
# malla (cacheada: mallar la pieza del cliente cuesta ~40 s, releerla ~1 s)
# =====================================================================================
def _malla(path, lc, w=None, quiet=False):
    import trimesh
    if w:
        nom = "malla_%s_lc%.2f.ply" % (os.path.splitext(os.path.basename(path))[0], lc)
        p = os.path.join(w, "cache", nom)
        if os.path.isfile(p):
            m = trimesh.load(p, process=False)
            if not quiet:
                print("malla del cache: %s (%d tris)" % (nom, len(m.faces)))
            return m
    if not quiet:
        print("mallando %s a lc=%.2f (la primera vez tarda ~40 s)..." % (os.path.basename(path), lc))
        sys.stdout.flush()
    m = geom.step_to_trimesh(path, lc=lc)
    if not m.is_watertight:
        sys.stderr.write("[gate_zona] AVISO: la malla NO es estanca — la paridad de rayos "
                         "puede dar numeros impares. Bajar --lc.\n")
    if w:
        os.makedirs(os.path.join(w, "cache"), exist_ok=True)
        m.export(os.path.join(w, "cache", nom))
        workdir.cache_path(w, "malla_%s" % os.path.splitext(os.path.basename(path))[0], nom)
    return m


# =====================================================================================
# topologia: lazos internos de cada cara -> poligono 3D
# =====================================================================================
def _grupos_de_curvas(cur):
    """Union-find sobre los puntos compartidos -> lista de lazos (listas de curvas)."""
    pts = {c: {abs(t) for _, t in gmsh.model.getBoundary([(1, c)], oriented=False,
                                                         recursive=False)} for c in cur}
    padre = {c: c for c in cur}

    def find(a):
        while padre[a] != a:
            padre[a] = padre[padre[a]]
            a = padre[a]
        return a

    for i, a in enumerate(cur):
        for b in cur[i + 1:]:
            if pts[a] & pts[b]:
                ra, rb = find(a), find(b)
                if ra != rb:
                    padre[ra] = rb
    g = {}
    for c in cur:
        g.setdefault(find(c), []).append(c)
    return list(g.values())


def _pts_curva(c, k=K_CURVA):
    pb = gmsh.model.getParametrizationBounds(1, c)
    ts = np.linspace(pb[0][0], pb[1][0], k)
    return np.asarray(gmsh.model.getValue(1, c, list(ts)), dtype=float).reshape(-1, 3)


def _poligono(g, k=K_CURVA):
    """Curvas de un lazo -> polilinea ORDENADA (encadenada por proximidad de extremos).

    Ordenar importa: con los puntos desordenados el test de punto-en-poligono da
    cualquier cosa, y con orden angular (el atajo obvio) una ranura larga se rompe.
    """
    segs = [_pts_curva(c, k) for c in g]
    poly = list(segs.pop(0))
    while segs:
        fin = poly[-1]
        best = None
        for i, s in enumerate(segs):
            for d, rev in ((float(np.linalg.norm(s[0] - fin)), False),
                           (float(np.linalg.norm(s[-1] - fin)), True)):
                if best is None or d < best[0]:
                    best = (d, i, rev)
        d, i, rev = best
        s = segs.pop(i)
        if rev:
            s = s[::-1]
        poly.extend(s[1:] if d < 1e-6 else s)
    return np.asarray(poly, dtype=float)


def _bbox_grupo(g):
    B = np.array([gmsh.model.getBoundingBox(1, c) for c in g], dtype=float)
    return B[:, 0:3].min(0), B[:, 3:6].max(0)


def _lazos_internos(path, min_diag, max_diag, caras=None):
    """[(cara, solido, poligono3D)] de TODOS los lazos internos de la pieza.

    El lazo mas grande de cada cara es su contorno exterior -> se descarta.
    """
    out = []
    fb = topo.face_boxes(path)
    orden = {int(f["tag"]): (int(f["solid"]), float(f["area_bbox"])) for f in fb}
    with topo.open_step(path):
        tags = [t for _, t in gmsh.model.getEntities(2)]
        if caras:
            tags = [t for t in tags if t in caras]
        for tag in tags:
            cur = [abs(t) for _, t in gmsh.model.getBoundary([(2, tag)], oriented=False,
                                                             recursive=False)]
            if len(cur) < 2:
                continue
            gs = _grupos_de_curvas(cur)
            if len(gs) < 2:
                continue
            cajas = [_bbox_grupo(g) for g in gs]
            diags = [float(np.linalg.norm(hi - lo)) for lo, hi in cajas]
            ext = int(np.argmax(diags))          # el mayor es el contorno exterior
            for i, g in enumerate(gs):
                if i == ext or not (min_diag <= diags[i] <= max_diag):
                    continue
                out.append((int(tag), orden.get(int(tag), (topo.FREE, 0.0))[0], _poligono(g)))
    return out


# =====================================================================================
# geometria 2D del lazo
# =====================================================================================
def _plano_local(poly, n_hint):
    n, ctr, dev = geom.fit_plane(poly)
    if float(n @ n_hint) < 0:
        n = -n
    u = np.cross(n, [0.0, 0.0, 1.0])
    if np.linalg.norm(u) < 1e-6:
        u = np.cross(n, [0.0, 1.0, 0.0])
    u = u / np.linalg.norm(u)
    v = np.cross(n, u)
    return n, u, v, ctr, float(np.abs(dev).max())


def _obb2d(Q):
    """Largo x ancho del lazo en SUS ejes principales (no en los ejes arbitrarios u,v)."""
    q = Q - Q.mean(0)
    _, V = np.linalg.eigh(q.T @ q)
    return float(np.ptp(q @ V[:, 1])), float(np.ptp(q @ V[:, 0]))


def _area2d(Q):
    x, y = Q[:, 0], Q[:, 1]
    return float(abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))) / 2.0)


def _dist_poligono(pts, Q):
    A = Q
    B = np.roll(Q, -1, axis=0)
    AB = B - A
    L2 = (AB ** 2).sum(1)
    L2[L2 == 0] = 1e-12
    t = np.clip(((pts[:, None, :] - A[None]) * AB[None]).sum(2) / L2[None], 0.0, 1.0)
    proy = A[None] + t[..., None] * AB[None]
    return np.linalg.norm(pts[:, None, :] - proy, axis=2).min(1)


def _dentro(Q, pts):
    from matplotlib.path import Path
    return Path(np.vstack([Q, Q[:1]])).contains_points(pts)


def _muestras_interior(Q, margen=MARGEN_PARED, maxn=MAX_INT):
    lo, hi = Q.min(0), Q.max(0)
    dim = max(float((hi - lo).min()), 0.2)
    paso = max(dim / 5.0, 0.4)
    gx = np.arange(lo[0], hi[0] + paso, paso)
    gy = np.arange(lo[1], hi[1] + paso, paso)
    P = np.column_stack([g.ravel() for g in np.meshgrid(gx, gy)])
    if len(P) > 4000:
        P = P[:: len(P) // 4000 + 1]
    P = P[_dentro(Q, P)]
    for mg in (margen, margen * 0.4, 0.0):
        S = P[_dist_poligono(P, Q) >= mg] if len(P) else P
        if len(S):
            break
    if not len(S):
        c = Q.mean(0)[None, :]
        S = c if _dentro(Q, c)[0] else np.zeros((0, 2))
    if len(S) > maxn:
        S = S[np.linspace(0, len(S) - 1, maxn).astype(int)]
    return S


def _muestras_anillo(Q, off=ANILLO, k=N_ANILLO):
    """Anillo de control AFUERA del lazo: normal promediada sobre un arco (una normal
    de bisectriz entre 2 aristas se da vuelta cuando hay vertices a decimas de mm)."""
    n = len(Q)
    kk = max(1, n // 40)
    d = np.roll(Q, -kk, 0) - np.roll(Q, kk, 0)
    nn = np.linalg.norm(d, axis=1, keepdims=True)
    nn[nn == 0] = 1.0
    d = d / nn
    nor = np.column_stack([d[:, 1], -d[:, 0]])
    s = np.sign(((Q - Q.mean(0)) * nor).sum(1))
    s[s == 0] = 1.0
    R = Q + off * nor * s[:, None]
    R = R[np.linspace(0, len(R) - 1, min(k * 3, len(R))).astype(int)]
    R = R[~_dentro(Q, R)]
    if len(R):
        R = R[_dist_poligono(R, Q) >= off * 0.5]
    if len(R) > k:
        R = R[np.linspace(0, len(R) - 1, k).astype(int)]
    return R


# =====================================================================================
# rayos
# =====================================================================================
def _tirar(m, P3, n, D):
    """-> (impactos por rayo, t del 1er impacto, t del 2do). t = distancia desde afuera."""
    orig = P3 + n[None, :] * D
    dirs = np.tile(-n, (len(P3), 1))
    loc, ir, _ = m.ray.intersects_location(orig, dirs, multiple_hits=True)
    cnt = np.bincount(ir, minlength=len(P3)) if len(ir) else np.zeros(len(P3), int)
    t1 = np.full(len(P3), np.nan)
    t2 = np.full(len(P3), np.nan)
    if len(ir):
        t = np.linalg.norm(loc - orig[ir], axis=1)
        o = np.lexsort((t, ir))
        ir_s, t_s = ir[o], t[o]
        primero = np.ones(len(ir_s), bool)
        primero[1:] = ir_s[1:] != ir_s[:-1]
        t1[ir_s[primero]] = t_s[primero]
        seg = (~primero)
        seg[1:] &= primero[:-1]
        if seg.any():
            t2[ir_s[seg]] = t_s[seg]
    return cnt, t1, t2


def _med(a):
    a = a[~np.isnan(a)]
    return float(np.median(a)) if len(a) else float("nan")


# =====================================================================================
# INVENTARIO
# =====================================================================================
def _clasificar(cnt_in, cnt_out, t1_in, t1_out, t2_out):
    base = float(np.median(cnt_out)) if len(cnt_out) else float("nan")
    val = float(np.median(cnt_in)) if len(cnt_in) else float("nan")
    espesor = _med(t2_out - t1_out)
    prof = _med(t1_in) - _med(t1_out)
    if not len(cnt_out) or base < 2:
        ver = "SIN CONTROL"
    elif val <= base - DELTA_PASANTE:
        ver = "PASANTE"
    elif val >= base:
        ver = "REBAJE" if prof > 0.05 else ("RESALTE" if prof < -0.05 else "IMPRENTADO")
    else:
        ver = "AMBIGUO"
    return ver, base, val, espesor, prof


def _familias(pas, tol=0.15):
    """Agrupa las pasantes por tamano parecido. Una feature que se repite 3 o 6 veces
    casi nunca es 'la' feature: si la candidata mas grande pertenece a una familia de
    varias, no hay que elegir — hay que preguntar."""
    fam = []
    for f in pas:
        for g in fam:
            if abs(f["largo"] - g["largo"]) <= tol * g["largo"] and \
               abs(f["ancho"] - g["ancho"]) <= tol * max(g["ancho"], 0.5):
                g["miembros"].append(f)
                break
        else:
            fam.append({"largo": f["largo"], "ancho": f["ancho"], "miembros": [f]})
    return fam


def cmd_inventario(args):
    w = workdir.ensure_workdir(args.workdir) if args.workdir else None
    caras = {int(x) for x in args.cara.split(",")} if args.cara else None

    print("== 1/3 topologia: lazos internos ==")
    lazos = _lazos_internos(args.step, args.min_lazo, args.max_lazo, caras)
    print("   %d lazo(s) interno(s) entre %.1f y %.1f mm de diagonal" %
          (len(lazos), args.min_lazo, args.max_lazo))
    if not lazos:
        print("Nada que clasificar. Subir --max-lazo o bajar --min-lazo.")
        return FALLA

    print("== 2/3 malla para trazado de rayos ==")
    m = _malla(args.step, args.lc, w)
    D = float(np.linalg.norm(m.bounds[1] - m.bounds[0])) * 1.1

    print("== 3/3 paridad de rayos (adentro del lazo vs anillo de control) ==")
    reg, todos, marcas = [], [], []
    for cara, sol, poly in lazos:
        n_hint = poly.mean(0) - m.centroid
        n, u, v, ctr, plan = _plano_local(poly, n_hint)
        Q = np.column_stack([(poly - ctr) @ u, (poly - ctr) @ v])
        Si = _muestras_interior(Q, args.margen)
        Sa = _muestras_anillo(Q, args.anillo)
        if not len(Si):
            continue
        P_in = ctr + Si[:, 0:1] * u + Si[:, 1:2] * v
        P_out = ctr + Sa[:, 0:1] * u + Sa[:, 1:2] * v if len(Sa) else np.zeros((0, 3))
        reg.append(dict(cara=cara, solido=sol, n=n, u=u, v=v, ctr=ctr, Q=Q, poly=poly,
                        plan=plan, ni=len(P_in), na=len(P_out)))
        todos.append(np.vstack([P_in, P_out]) if len(P_out) else P_in)
        marcas.append((len(P_in), len(P_out)))
    if not reg:
        print("Ningun lazo dejo puntos interiores utiles.")
        return FALLA

    P = np.vstack(todos)
    n_com = np.mean([r["n"] for r in reg], axis=0)
    n_com = n_com / np.linalg.norm(n_com)
    # cada lazo con SU normal (los lazos de las dos caras del panel miran al reves)
    filas = []
    off = 0
    for r, (ni, na) in zip(reg, marcas):
        blk = P[off:off + ni + na]
        off += ni + na
        cnt, t1, t2 = _tirar(m, blk, r["n"], D)
        cin, cout = cnt[:ni], cnt[ni:]
        ver, base, val, esp, prof = _clasificar(cin, cout, t1[:ni], t1[ni:], t2[ni:])
        largo, ancho = _obb2d(r["Q"])
        filas.append(dict(cara=r["cara"], solido=r["solido"], verdicto=ver,
                          largo=largo, ancho=ancho, area=_area2d(r["Q"]),
                          centro=r["ctr"], n=r["n"], espesor=esp, prof=prof,
                          impactos_dentro=val, impactos_afuera=base,
                          planitud=r["plan"], n_rayos=(ni, na), Q=r["Q"], poly=r["poly"]))

    filas.sort(key=lambda f: -f["area"])
    filas = _dedup(filas)

    print("\n%-4s %-11s %14s %9s %9s %8s  %-26s" %
          ("id", "veredicto", "largo x ancho", "area", "espesor", "prof", "centro (x,y,z)"))
    for i, f in enumerate(filas):
        f["id"] = "A%d" % (i + 1)
        print("%-4s %-11s %6.2f x %5.2f %8.0f %9s %8s  (%7.1f,%7.1f,%7.1f)%s" %
              (f["id"], f["verdicto"], f["largo"], f["ancho"], f["area"],
               "%.2f" % f["espesor"] if f["espesor"] == f["espesor"] else "-",
               "%.2f" % f["prof"] if f["prof"] == f["prof"] else "-",
               f["centro"][0], f["centro"][1], f["centro"][2],
               "  <- misma abertura vista de los 2 lados" if f.get("bilateral") else ""))

    pas = [f for f in filas if f["verdicto"] == "PASANTE" and f["area"] >= args.min_area]
    otras = [f for f in filas if f["verdicto"] != "PASANTE" and f["area"] >= args.min_area]
    print("\n%d abertura(s) PASANTE(S) de area >= %.0f mm2. "
          "%d contorno(s) que NO son abertura (rebaje/resalte/grabado): NO medirlos como si lo fueran."
          % (len(pas), args.min_area, len(otras)))
    fam = _familias(pas)
    if pas:
        print("familias por tamano:")
        for g in fam:
            print("   %d x  %6.2f x %5.2f mm   [%s]%s"
                  % (len(g["miembros"]), g["largo"], g["ancho"],
                     ", ".join(x["id"] for x in g["miembros"]),
                     "   <- SE REPITE: casi nunca es 'la' feature" if len(g["miembros"]) > 1 else ""))

    if args.render or args.render3d:
        _mapa(args.step, m, filas, w, args.render3d)

    if w:
        workdir.record_evidence(
            w, "inventario_aberturas", step=os.path.basename(args.step), lc=args.lc,
            n_pasantes=len(pas), n_no_aberturas=len(otras),
            pasantes=[{"id": f["id"], "largo": round(f["largo"], 2), "ancho": round(f["ancho"], 2),
                       "area": round(f["area"], 1),
                       "centro": [round(float(x), 2) for x in f["centro"]]} for f in pas])

    if args.confirmar:
        if not args.quien:
            print("\n[GATE 0] --confirmar exige --quien (quien miro el mapa y lo confirmo).")
            return FALLA
        if not args.evidencia or not os.path.isfile(args.evidencia):
            print("\n[GATE 0] --confirmar exige --evidencia apuntando a un ARCHIVO QUE EXISTA")
            print("         (el render circulado que devolvio Fak, una foto, un mail exportado).")
            print("         Una frase no alcanza: este gate nacio del error mas caro del sistema")
            print("         y no puede quedar autofirmado por el mismo agente que lo corre.")
            print("         Recibido: %r" % (args.evidencia,))
            return FALLA
        el = [f for f in filas if f["id"] in {x.strip() for x in args.confirmar.split(",")}]
        if not el:
            print("\n[GATE 0] --confirmar %s no coincide con ningun id de la tabla." % args.confirmar)
            return FALLA
        if not w:
            print("\n[GATE 0] --confirmar necesita --workdir para dejar la evidencia.")
            return FALLA
        guardada = os.path.join(w, "renders", "confirmacion_%s_%s"
                                % (args.confirmar.replace(",", "-"),
                                   os.path.basename(args.evidencia)))
        shutil.copy(args.evidencia, guardada)
        workdir.record_evidence(
            w, "zona_confirmada", step=os.path.basename(args.step),
            ids=[f["id"] for f in el], quien=args.quien,
            evidencia=os.path.basename(guardada),
            evidencia_firma=workdir.file_signature(guardada),
            zonas=[{"id": f["id"], "verdicto": f["verdicto"],
                    "largo": round(f["largo"], 2), "ancho": round(f["ancho"], 2),
                    "centro": [round(float(x), 2) for x in f["centro"]]} for f in el])
        print("\n[GATE 0] zona CONFIRMADA por %s: %s. Evidencia archivada en %s y firmada "
              "en el manifest." % (args.quien, ", ".join(f["id"] for f in el), guardada))
        return OK

    if not pas:
        print("\n[GATE 0] NO hay ninguna abertura pasante. Si estabas por medir un contorno "
              "de arriba, es un rebaje: el panel es MACIZO ahi.")
        return FALLA
    fam0 = [g for g in fam if pas[0] in g["miembros"]][0]
    comp = [f for f in pas if f["area"] >= args.ratio * pas[0]["area"]]
    razones = []
    if len(comp) > 1:
        razones.append("hay %d candidatas de tamano comparable (%s)"
                       % (len(comp), ", ".join("%s %.0f mm2" % (f["id"], f["area"]) for f in comp[:5])))
    if len(fam0["miembros"]) > 1:
        razones.append("la mayor (%s) es una de %d features IGUALES (%s)"
                       % (pas[0]["id"], len(fam0["miembros"]),
                          ", ".join(x["id"] for x in fam0["miembros"])))
    if razones:
        print("\n[GATE 0] AMBIGUO: %s." % "; y ".join(razones))
    else:
        print("\n[GATE 0] la candidata dominante es %s (%.2f x %.2f mm), %.0fx mas grande que "
              "la siguiente." % (pas[0]["id"], pas[0]["largo"], pas[0]["ancho"],
                                 pas[0]["area"] / pas[1]["area"] if len(pas) > 1 else 0))
    print("         NO decidir solo: mandarle renders/gate0_mapa_%s.png a Fak, que circule cual es,"
          % os.path.splitext(os.path.basename(args.step))[0])
    print("         y recien volver con:")
    print("         gate_zona.py inventario <step> --workdir <W> --confirmar <id[,id]> "
          "--quien Fak --evidencia \"<como lo confirmo>\"")
    return AMBIGUO


def _dedup(filas):
    """Una chapa tiene DOS caras y las dos 'contienen' la abertura: unificar.

    Se conserva la de menor area como BOCA y se anota la otra como salida (la diferencia
    entre las dos ES la conicidad).
    """
    out = []
    for f in filas:
        gemela = None
        for g in out:
            d = f["centro"] - g["centro"]
            lat = float(np.linalg.norm(d - (d @ g["n"]) * g["n"]))
            axi = abs(float(d @ g["n"]))
            tope = max(4.0, 2.5 * (g["espesor"] if g["espesor"] == g["espesor"] else 2.0))
            if axi <= tope and lat <= 0.35 * max(g["ancho"], 1.0) and \
               0.25 <= f["area"] / max(g["area"], 1e-6) <= 4.0 and \
               f["verdicto"] == g["verdicto"]:
                gemela = g
                break
        if gemela is None:
            out.append(f)
        else:
            gemela["bilateral"] = True
            gemela["salida"] = (f["largo"], f["ancho"])
            if f["area"] < gemela["area"]:
                for k in ("largo", "ancho", "area", "Q", "poly", "centro", "n", "cara"):
                    gemela[k], f[k] = f[k], gemela[k]
                gemela["salida"] = (f["largo"], f["ancho"])
    return out


def _mapa(step, m, filas, w, tres_d=False):
    """El MAPA numerado: es la imagen que se le manda a Fak para que circule la zona."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    pas = [f for f in filas if f["verdicto"] == "PASANTE"]
    ref = pas[0] if pas else filas[0]
    n, ctr = ref["n"], ref["centro"]
    u = np.cross(n, [0.0, 0.0, 1.0])
    if np.linalg.norm(u) < 1e-6:
        u = np.cross(n, [0.0, 1.0, 0.0])
    u /= np.linalg.norm(u)
    v = np.cross(n, u)
    V = m.vertices
    V = V[np.linspace(0, len(V) - 1, min(len(V), 90000)).astype(int)]
    a = (V - ctr) @ u
    b = (V - ctr) @ v
    c = (V - ctr) @ n
    fig, ax = plt.subplots(figsize=(14, 10))
    ax.scatter(a, b, s=1.0, c=c, cmap="Greys", alpha=0.55, linewidths=0,
               vmin=float(np.percentile(c, 2)), vmax=float(np.percentile(c, 98)))
    col = {"PASANTE": "#c0392b", "REBAJE": "#7f8c8d", "RESALTE": "#5d6d7e",
           "IMPRENTADO": "#95a5a6", "AMBIGUO": "#e67e22", "SIN CONTROL": "#e67e22"}
    for f in filas:
        P = f["poly"]
        ax.plot((P - ctr) @ u, (P - ctr) @ v, "-", lw=2.2 if f["verdicto"] == "PASANTE" else 1.0,
                color=col.get(f["verdicto"], "#333333"))
        if f["verdicto"] == "PASANTE" or f["area"] >= 25:
            ax.annotate("%s %s\n%.1f x %.1f" % (f["id"], f["verdicto"], f["largo"], f["ancho"]),
                        ((f["centro"] - ctr) @ u, (f["centro"] - ctr) @ v),
                        fontsize=8, ha="center", va="center", weight="bold",
                        color=col.get(f["verdicto"], "#333333"),
                        bbox=dict(fc="white", ec="none", alpha=0.75, pad=1.2))
    ax.set_aspect("equal")
    ax.grid(alpha=0.25)
    ax.set_xlabel("mm")
    ax.set_ylabel("mm")
    ax.set_title("GATE 0 — %s\nROJO = abertura PASANTE (se puede meter algo) · GRIS = rebaje / "
                 "resalte / grabado: ahi el panel es MACIZO\nMarcame con un circulo CUAL es la zona"
                 % os.path.basename(step), fontsize=13, weight="bold")
    d = os.path.join(w, "renders") if w else os.path.dirname(os.path.abspath(step))
    os.makedirs(d, exist_ok=True)
    stem = os.path.splitext(os.path.basename(step))[0]
    p = os.path.join(d, "gate0_mapa_%s.png" % stem)
    fig.tight_layout()
    fig.savefig(p, dpi=125)
    plt.close(fig)
    print("mapa -> %s" % p)
    if not tres_d:
        return
    try:
        F = m.faces
        if len(F) > 30000:   # Poly3DCollection con 166k triangulos tarda minutos
            F = F[np.linspace(0, len(F) - 1, 30000).astype(int)]
        tris = m.vertices[F]
        pts = [(np.array([f["centro"] for f in pas]), "red", "aberturas pasantes")] if pas else None
        for f in render.render_views([(tris, "#bbbbbb", 0.35)],
                                     os.path.join(d, "gate0_%s" % stem),
                                     views={"iso": (25, -60), "vista": (0, -90)},
                                     title="GATE 0 %s" % os.path.basename(step), points=pts):
            print("render -> %s" % f)
    except Exception as e:  # el mapa 2D es el entregable; el 3D es de apoyo
        sys.stderr.write("[gate_zona] render 3D omitido: %s\n" % e)


# =====================================================================================
# PASANTE (chequeo puntual)
# =====================================================================================
def cmd_pasante(args):
    w = workdir.ensure_workdir(args.workdir) if args.workdir else None
    m = _malla(args.step, args.lc, w)
    D = float(np.linalg.norm(m.bounds[1] - m.bounds[0])) * 1.1
    p0 = np.array([float(x) for x in args.punto.split(",")])
    n = np.array([float(x) for x in args.normal.split(",")]) if args.normal else \
        (p0 - m.centroid)
    n = n / np.linalg.norm(n)
    u = np.cross(n, [0.0, 0.0, 1.0])
    if np.linalg.norm(u) < 1e-6:
        u = np.cross(n, [0.0, 1.0, 0.0])
    u /= np.linalg.norm(u)
    v = np.cross(n, u)
    ang = np.linspace(0, 2 * np.pi, 16, endpoint=False)
    P_in = p0 + np.concatenate([[[0.0, 0.0]], np.column_stack(
        [args.radio * 0.5 * np.cos(ang), args.radio * 0.5 * np.sin(ang)])]) @ np.vstack([u, v])
    P_out = p0 + np.column_stack([(args.radio + args.anillo) * np.cos(ang),
                                  (args.radio + args.anillo) * np.sin(ang)]) @ np.vstack([u, v])
    ci, t1i, _ = _tirar(m, P_in, n, D)
    co, t1o, t2o = _tirar(m, P_out, n, D)
    ver, base, val, esp, prof = _clasificar(ci, co, t1i, t1o, t2o)
    print("punto (%.2f, %.2f, %.2f) normal (%.4f, %.4f, %.4f)" % (tuple(p0) + tuple(n)))
    print("impactos: adentro %.0f (r=%.1f mm) · alrededor %.0f (r=%.1f mm)"
          % (val, args.radio * 0.5, base, args.radio + args.anillo))
    print("espesor local del material alrededor: %.2f mm" % esp)
    if ver in ("REBAJE", "RESALTE", "IMPRENTADO"):
        print("veredicto: %s — NO ES ABERTURA, ahi hay material. La superficie de adentro esta "
              "%.2f mm %s que la de alrededor." % (ver, abs(prof), "mas hundida" if prof > 0 else "mas alta"))
    else:
        print("veredicto: %s" % ver)
    if w:
        workdir.record_evidence(w, "pasante", step=os.path.basename(args.step),
                                punto=[round(float(x), 2) for x in p0], verdicto=ver,
                                impactos_dentro=val, impactos_afuera=base,
                                espesor=round(esp, 3) if esp == esp else None)
    if args.esperado and args.esperado.upper() != ver:
        print("\n[FALLA] esperabas %s y es %s." % (args.esperado.upper(), ver))
        return FALLA
    return OK if ver == "PASANTE" else (FALLA if args.esperado else OK)


# =====================================================================================
# MACIZO (¿esta zona es aire o material?)
# =====================================================================================
def cmd_macizo(args):
    w = workdir.ensure_workdir(args.workdir) if args.workdir else None
    m = _malla(args.step, args.lc, w)
    if not m.is_watertight:
        print("AVISO: malla no estanca — 'contains' puede mentir. Bajar --lc.")
    c = [float(x) for x in args.caja.split(",")]
    if len(c) != 6:
        raise SystemExit("--caja necesita 6 numeros: xmin,ymin,zmin,xmax,ymax,zmax")
    lo, hi = np.array(c[:3]), np.array(c[3:])
    ejes = [np.arange(lo[i], hi[i] + args.paso, args.paso) for i in range(3)]
    G = np.stack(np.meshgrid(*ejes, indexing="ij"), -1)
    P = G.reshape(-1, 3)
    print("caja %.1f x %.1f x %.1f mm · %d puntos interiores (paso %.2f)"
          % (*(hi - lo), len(P), args.paso))
    dentro = geom.contains_batched(m, P)
    frac = float(dentro.mean())
    print("MATERIAL: %.1f %% de los puntos (%d de %d)" % (100 * frac, dentro.sum(), len(P)))
    aire = (~dentro).reshape(G.shape[:3])
    luz = None
    if aire.any():
        from scipy import ndimage
        lab, nl = ndimage.label(aire)
        tam = ndimage.sum(aire, lab, range(1, nl + 1))
        k = int(np.argmax(tam)) + 1
        idx = np.array(np.where(lab == k))
        dims = (idx.max(1) - idx.min(1) + 1) * args.paso
        luz = [round(float(x), 2) for x in dims]
        print("hueco de aire mas grande: %.2f x %.2f x %.2f mm (%d regiones de aire)"
              % (dims[0], dims[1], dims[2], nl))
    if w:
        workdir.record_evidence(w, "macizo", step=os.path.basename(args.step),
                                caja=c, frac_material=round(frac, 4), luz=luz)
    if args.esperado == "aire" and frac > args.tol_frac:
        print("\n[FALLA] esperabas AIRE y hay %.1f %% de material. Ahi NO hay ni luz ni abertura: "
              "si era una lengueta que tenia que flexionar, esta FUNDIDA a la placa. En el render "
              "no se ve; solo lo ven los puntos interiores." % (100 * frac))
        return FALLA
    if args.esperado == "material" and frac < 1.0 - args.tol_frac:
        print("\n[FALLA] esperabas MATERIAL y hay %.1f %% de aire." % (100 * (1 - frac)))
        return FALLA
    return OK


# =====================================================================================
# POSE (¿la transformacion dejo la pieza donde dije?)
# =====================================================================================
def _parse_zona(s):
    eje, rng = s.split(":")
    lo, hi = (float(x) for x in rng.split(","))
    return ("XYZ".index(eje.upper()), lo, hi)


def cmd_pose(args):
    w = workdir.ensure_workdir(args.workdir) if args.workdir else None
    A = _malla(args.pieza, args.lc, w)
    bb = np.array([A.bounds[0], A.bounds[1]])
    print("pieza   : %s" % os.path.basename(args.pieza))
    print("bbox    : X[%.3f, %.3f]  Y[%.3f, %.3f]  Z[%.3f, %.3f]"
          % (bb[0, 0], bb[1, 0], bb[0, 1], bb[1, 1], bb[0, 2], bb[1, 2]))
    print("centro  : (%.3f, %.3f, %.3f)   volumen: %.1f mm3" % (*A.centroid, A.volume))
    fallas = []

    def chk(nombre, real, esp, tol):
        real = np.atleast_1d(np.asarray(real, dtype=float))
        esp = np.atleast_1d(np.asarray(esp, dtype=float))
        d = real - esp
        ok = bool(np.all(np.abs(d) <= tol))
        print("assert %-9s esperado %s · real %s · delta %s · tol %.3f -> %s"
              % (nombre, np.round(esp, 3), np.round(real, 3), np.round(d, 3), tol,
                 "OK" if ok else "FALLA"))
        if not ok:
            if np.all(np.abs(real + esp) <= tol) or np.all(np.sign(d) == -np.sign(esp)) and \
               np.all(np.abs(np.abs(real) - np.abs(esp)) <= tol):
                print("       >>> el valor esta con el SIGNO CAMBIADO: la transformacion "
                      "se aplico al reves.")
            fallas.append(nombre)

    if args.esperar_centro:
        chk("centro", A.centroid, [float(x) for x in args.esperar_centro.split(",")], args.tol)
    if args.esperar_bbox:
        chk("bbox", bb.ravel(), [float(x) for x in args.esperar_bbox.split(",")], args.tol)
    if args.esperar_volumen is not None:
        chk("volumen", A.volume, args.esperar_volumen, args.tol_volumen)

    luz = None
    if args.referencia:
        B = _malla(args.referencia, args.lc, w)
        pts = B.vertices
        for eje, lo, hi in map(_parse_zona, args.zona):
            pts = pts[(pts[:, eje] > lo) & (pts[:, eje] < hi)]
        if not len(pts):
            raise SystemExit("La zona filtrada dejo 0 puntos de la referencia — revisar --zona")
        if len(pts) > args.max_pts:
            pts = pts[np.linspace(0, len(pts) - 1, args.max_pts).astype(int)]
        import trimesh
        sd = trimesh.proximity.ProximityQuery(A).signed_distance(pts)  # >0 = adentro de A
        luz = float(-sd.max())
        print("referencia: %s (%d pts)" % (os.path.basename(args.referencia), len(pts)))
        print("LUZ con signo: %+.3f mm  (%s)"
              % (luz, "hay separacion" if luz > 0 else "PENETRA %.3f mm" % (-luz)))
        if args.esperar_luz is not None:
            chk("luz", luz, args.esperar_luz, args.tol)

    if w:
        workdir.record_evidence(w, "pose", pieza=os.path.basename(args.pieza),
                                referencia=os.path.basename(args.referencia) if args.referencia else None,
                                centro=[round(float(x), 3) for x in A.centroid],
                                volumen=round(float(A.volume), 1),
                                luz=round(luz, 3) if luz is not None else None,
                                asserts_fallados=fallas)
    if fallas:
        print("\n[FALLA] no se cumplio: %s. NO seguir modelando sobre esta pose." % ", ".join(fallas))
        return FALLA
    print("\nOK: la pieza quedo donde se esperaba.")
    return OK


# =====================================================================================
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("inventario", help="todas las aberturas, clasificadas y ordenadas",
                       description="Lista TODAS las aberturas de la pieza ordenadas por area y "
                                   "clasifica cada una por paridad de rayos. Deja el mapa "
                                   "numerado que se le manda a Fak. Si hay mas de una candidata "
                                   "comparable NO elige: sale 2.\n\n"
                                   "Ej: gate_zona.py inventario pieza.stp --workdir W --render",
                       formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("step")
    a.add_argument("--workdir", default=None, help="deja la evidencia en su manifest.json")
    a.add_argument("--cara", default=None, help="limitar a estos tags de cara (coma)")
    a.add_argument("--min-lazo", type=float, default=3.0, help="diagonal minima (mm, %(default)s)")
    a.add_argument("--max-lazo", type=float, default=250.0, help="diagonal maxima (mm, %(default)s)")
    a.add_argument("--min-area", type=float, default=15.0,
                   help="area minima para que cuente como candidata (mm2, %(default)s)")
    a.add_argument("--ratio", type=float, default=0.35,
                   help="si la 2da candidata supera esta fraccion de la 1ra -> AMBIGUO (%(default)s)")
    a.add_argument("--lc", type=float, default=geom.LC_ANALYSIS, help="tamano de malla (%(default)s)")
    a.add_argument("--margen", type=float, default=MARGEN_PARED, help="mm de la pared (%(default)s)")
    a.add_argument("--anillo", type=float, default=ANILLO, help="mm del anillo de control (%(default)s)")
    a.add_argument("--render", action="store_true",
                   help="mapa 2D numerado (renders/gate0_mapa.png) — es la imagen para Fak")
    a.add_argument("--render3d", action="store_true",
                   help="ademas, vistas 3D (mas lento: la malla se decima a 30k triangulos)")
    a.add_argument("--confirmar", default=None, help="id(s) que Fak confirmo, ej: A1 o A1,A2")
    a.add_argument("--quien", default=None,
                   help="quien confirmo la zona (obligatorio con --confirmar)")
    a.add_argument("--evidencia", default=None,
                   help="RUTA a un ARCHIVO que exista: el render que Fak devolvio circulado, "
                        "una foto, un mail exportado. Obligatorio con --confirmar. Antes el "
                        "default era una cadena vacia y --quien salia 'Fak' solo: el mismo "
                        "agente al que se le desconfia podia autofirmar el gate mas caro.")
    a.set_defaults(func=cmd_inventario)

    b = sub.add_parser("pasante", help="un candidato puntual: abertura o rebaje",
                       description="Chequeo puntual sin topologia: tira rayos en un disco de "
                                   "radio --radio y los compara con un anillo afuera.\n\n"
                                   "Ej: gate_zona.py pasante p.stp --punto 12,-3,44 --radio 4",
                       formatter_class=argparse.RawDescriptionHelpFormatter)
    b.add_argument("step")
    b.add_argument("--punto", required=True, help="x,y,z sobre el supuesto hueco")
    b.add_argument("--normal", default=None, help="nx,ny,nz (default: radial desde el centroide)")
    b.add_argument("--radio", type=float, default=4.0, help="mm del supuesto hueco (%(default)s)")
    b.add_argument("--anillo", type=float, default=ANILLO, help="mm (%(default)s)")
    b.add_argument("--lc", type=float, default=geom.LC_ANALYSIS)
    b.add_argument("--workdir", default=None)
    b.add_argument("--esperado", default=None,
                   choices=["pasante", "rebaje", "resalte", "imprentado"])
    b.set_defaults(func=cmd_pasante)

    c = sub.add_parser("macizo", help="esa zona es aire o material? (puntos interiores)",
                       description="Un cuello macizo NO tiene nodos de malla adentro: buscar ahi "
                                   "nodos devuelve 'libre' cuando en realidad esta fundido. Esto "
                                   "usa puntos INTERIORES.\n\n"
                                   "Ej: gate_zona.py macizo --pieza f.step "
                                   "--caja 10,-2,4,18,2,6 --esperado aire",
                       formatter_class=argparse.RawDescriptionHelpFormatter)
    c.add_argument("--pieza", dest="step", required=True)
    c.add_argument("--caja", required=True, help="xmin,ymin,zmin,xmax,ymax,zmax")
    c.add_argument("--paso", type=float, default=0.5, help="mm entre puntos (%(default)s)")
    c.add_argument("--esperado", default=None, choices=["aire", "material"])
    c.add_argument("--tol-frac", type=float, default=0.02, help="fraccion tolerada (%(default)s)")
    c.add_argument("--lc", type=float, default=geom.LC_PRINT)
    c.add_argument("--workdir", default=None)
    c.set_defaults(func=cmd_macizo)

    d = sub.add_parser("pose", help="la transformacion dejo la pieza donde dije?",
                       description="Toda transformacion que se aplica 'para que algo quede en X' "
                                   "termina comprobando que quedo en X. Si el valor sale con el "
                                   "signo cambiado, lo dice con todas las letras.\n\n"
                                   "Ej: gate_zona.py pose --pieza out/f.step --referencia in/p.stp "
                                   "--esperar-luz -0.20 --tol 0.05",
                       formatter_class=argparse.RawDescriptionHelpFormatter)
    d.add_argument("--pieza", required=True)
    d.add_argument("--referencia", default=None, help="STEP contra el que se mide la luz")
    d.add_argument("--esperar-centro", default=None, help="x,y,z")
    d.add_argument("--esperar-bbox", default=None, help="xmin,ymin,zmin,xmax,ymax,zmax")
    d.add_argument("--esperar-volumen", type=float, default=None, help="mm3")
    d.add_argument("--esperar-luz", type=float, default=None,
                   help="mm; negativo = apriete/penetracion buscada")
    d.add_argument("--tol", type=float, default=0.05, help="mm (%(default)s)")
    d.add_argument("--tol-volumen", type=float, default=1.0, help="mm3 (%(default)s)")
    d.add_argument("--zona", action="append", default=[], help="acotar la referencia, ej X:455,505")
    d.add_argument("--max-pts", type=int, default=4000)
    d.add_argument("--lc", type=float, default=geom.LC_ANALYSIS)
    d.add_argument("--workdir", default=None)
    d.set_defaults(func=cmd_pose)

    args = ap.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()

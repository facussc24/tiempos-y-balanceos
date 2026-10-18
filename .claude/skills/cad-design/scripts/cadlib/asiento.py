# -*- coding: utf-8 -*-
"""asiento — cómo asienta un utillaje RÍGIDO sobre un panel con capa BLANDA (tapizado, espuma, goma).

Tanda 2 del plan del sistema (17/10/2026), plan `docs/PLAN_3D_GATE_ASIENTO_2026-10-16.md`. Es el núcleo de
`C:\\Dev\\_utrim\\sim_asiento.py` (13/10, virolador del Upper Trim) llevado a cadlib y generalizado: las rutas, la grilla,
las zonas, los puntos de la mano y los sorteos dejan de estar adentro del código y vienen de una ESCENA (un dict, ver
`data/asiento_casos.json`). Lo usa `gate_asiento.py`.

Modelo (el mismo del 13/10, sin cambiar una cuenta): el panel y la pieza se miran como alturas sobre una grilla XY en el
frame de la pieza (z crece hacia el panel). La pieza es un cuerpo rígido que solo sube y gira poco; para cada lugar donde
aprieta la mano se busca la pose de reposo con un programa lineal (subir lo más posible el punto apretado sin atravesar
nada). Si la pose cambia según dónde se aprieta, la pieza SE HAMACA; se mide cuánto se mueve la esquina que más se mueve.

Tres preguntas, una por función:
  inventario()  — cuántos apoyos rígidos tocan el panel en la pose de DISEÑO y si alguno está metido en el blando.
  ventana()     — cuánto puede variar la altura del panel y la pieza sigue apretando sin tocar plástico.
  simular()     — se hamaca en N de 100 casos y cuánto se mueve apretando en la punta.

Límites (que se dicen en la salida del gate): los rayos son verticales, así que la ubicación en el PLANO (X, Y, giro en
Z) no se mide acá; un elemento más angosto que el paso de la grilla no lo ve la simulación (se avisa con
`no_vistos_por_la_simulacion()`); los sorteos son la hipótesis del 13/10, no una medición del tapizado.
"""
import hashlib
import json
import os

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))


# =====================================================================================
# grilla y zonas
# =====================================================================================
class Grilla(object):
    """Los puntos XY donde se mira todo. `desfase` corre la grilla hacia adentro (regla de no aliasear con el borde)."""

    def __init__(self, x, y, paso, desfase):
        self.paso = float(paso)
        self.xs = np.arange(x[0], x[1], paso) + desfase
        self.ys = np.arange(y[0], y[1], paso) + desfase
        X, Y = np.meshgrid(self.xs, self.ys)
        self.shape = X.shape
        self.XY = np.column_stack([X.ravel(), Y.ravel()])


def grilla_de(escena):
    g = escena["grilla"]
    return Grilla(g["x"], g["y"], g["paso"], g.get("desfase", 0.137))


def en_rects(XY, rects):
    """Máscara de los puntos adentro de alguno de los rectángulos {cx, cy, hx, hy} (|x-cx| < hx y |y-cy| < hy)."""
    m = np.zeros(len(XY), bool)
    for r in rects or []:
        m |= (np.abs(XY[:, 0] - r["cx"]) < r["hx"]) & (np.abs(XY[:, 1] - r["cy"]) < r["hy"])
    return m


def primer_z(malla, XY, desde, sentido):
    """z del primer impacto de un rayo vertical que sale de `desde` en el sentido dado (+1 sube, -1 baja)."""
    o = np.column_stack([XY, np.full(len(XY), float(desde))])
    d = np.tile([0.0, 0.0, float(sentido)], (len(XY), 1))
    loc, ir, _ = malla.ray.intersects_location(o, d, multiple_hits=False)
    z = np.full(len(XY), np.nan)
    z[ir] = loc[:, 2]
    return z


# =====================================================================================
# el panel (con caché firmada) y la pieza
# =====================================================================================
def _firma_texto(*partes):
    return hashlib.sha1("|".join(str(p) for p in partes).encode("utf-8")).hexdigest()[:16]


def mallas_panel(escena, cache_dir=None, log=print):
    """(plástico, plástico+capa blanda) como trimesh en el frame de la escena.

    El plástico es el sólido (caras_libres=False); la capa blanda son las caras libres del STEP (caras_libres=True),
    como en el original. Mallar el panel tarda ~5 min: la malla se guarda en `cache_dir` con la FIRMA del STEP, del
    frame y de `lc` (un caché sin la firma del archivo miente, cad-3d.md GATE 3)."""
    import trimesh
    from cadlib import geom, workdir as wd
    p = escena["panel"]
    fr = json.load(open(p["frame"], encoding="utf-8"))
    MR = np.column_stack([np.array(fr[k]) for k in ("ex", "ey", "ez")])
    ORI = np.array(fr["origen"])
    firma = _firma_texto(wd.file_signature(p["step"]), wd.file_signature(p["frame"]), p["lc"])
    ruta = os.path.join(cache_dir, "asiento_panel_%s.npz" % firma) if cache_dir else None
    if ruta and os.path.isfile(ruta):
        c = np.load(ruta)
        return (trimesh.Trimesh(vertices=c["Vs"], faces=c["Fs"], process=False),
                trimesh.Trimesh(vertices=c["Vt"], faces=c["Ft"], process=False), firma)
    out = []
    for cl in (False, True):
        log("  mallando el panel (%s), tarda unos minutos..." % ("con la capa blanda" if cl else "plastico solo"))
        m = geom.step_to_trimesh(p["step"], lc=p["lc"], require_watertight=False, caras_libres=cl)
        out.append(trimesh.Trimesh(vertices=(MR.T @ (m.vertices - ORI).T).T, faces=m.faces, process=False))
    if ruta:
        os.makedirs(cache_dir, exist_ok=True)
        np.savez(ruta, Vs=out[0].vertices, Fs=out[0].faces, Vt=out[1].vertices, Ft=out[1].faces)
    return out[0], out[1], firma


def alturas_panel(escena, malla_s, malla_t, gr):
    d = escena.get("rayos", {}).get("panel_desde", -60)
    return primer_z(malla_s, gr.XY, d, 1), primer_z(malla_t, gr.XY, d, 1)


def alturas_pieza(malla_pieza, gr, escena):
    """Lo más alto de la pieza en cada punto de la grilla (rayo de arriba hacia abajo, como el original)."""
    return primer_z(malla_pieza, gr.XY, escena.get("rayos", {}).get("pieza_desde", 20), -1)


def grilla_inventario(escena, paso=0.25, desfase=0.037):
    """Grilla FINA para contar apoyos (0,25 mm). La de la simulación (1 mm) no ve un elemento más angosto que su paso:
    el tercer pasador de la v14 (0,9 mm de ancho) cae entre dos de sus puntos. Mirar el vértice más alto de cada celda
    tampoco sirve: cerca del borde de una ranura la celda mezcla dos alturas del panel y marca falsos «metidos»
    (probado el 17/10: 18 apoyos fantasma alrededor del anillo)."""
    g = escena["grilla"]
    return Grilla(g["x"], g["y"], paso, desfase)


# =====================================================================================
# el panel que ve la pieza
# =====================================================================================
def mascaras(escena, gr, Hs, Ht):
    zp = en_rects(gr.XY, escena.get("zonas_plastico"))
    tap = ~zp & ~np.isnan(Ht) & (np.isnan(Hs) | (Hs - Ht > 0.05))
    return zp, tap


def panel_nominal(Hs, Ht, zp, abiertas):
    """El panel tal como está en el archivo (sin ceder): en las zonas de plástico manda el plástico; lo abierto no
    existe."""
    H = np.where(zp, Hs, Ht)
    return np.where(abiertas, np.nan, H)


# =====================================================================================
# reposo
# =====================================================================================
def reposo(g, XY, fx, fy, centro, lim_z, lim_giro):
    """Pose (z, giro en x, giro en y) que sube lo más posible el punto (fx, fy) sin atravesar nada, y los puntos que
    quedan en contacto. Mismas líneas que sim_asiento.py (13/10)."""
    from scipy.optimize import linprog
    cx, cy = centro
    k = np.isfinite(g)
    A = np.column_stack([np.ones(k.sum()), XY[k, 0] - cx, XY[k, 1] - cy])
    r = linprog(-np.array([1, fx - cx, fy - cy]), A_ub=A, b_ub=g[k],
                bounds=[(-lim_z, lim_z), (-lim_giro, lim_giro), (-lim_giro, lim_giro)], method="highs")
    if not r.success:
        return None, None
    hol = g[k] - A @ r.x
    return r.x, np.where(k)[0][hol < 1e-6]


def adentro_del_poligono(puntos, poligono_xy):
    """Para cada punto, ¿cae adentro (o sobre el borde) de la envolvente convexa de `poligono_xy`?"""
    from scipy.spatial import Delaunay
    if len(poligono_xy) < 3:
        return np.zeros(len(puntos), bool)
    try:
        tri = Delaunay(np.asarray(poligono_xy, float))
    except Exception:                                   # noqa: BLE001  (puntos colineales)
        return np.zeros(len(puntos), bool)
    return tri.find_simplex(np.asarray(puntos, float)) >= 0


# =====================================================================================
# 1. inventario de apoyos (pose de DISEÑO)
# =====================================================================================
def inventario(H, T, gr, delta=0.10, metido=-0.02, largo_frac=0.25):
    """Superficies de la pieza que tocan el panel en la pose de DISEÑO (como se modeló, sin moverla), y qué movimientos
    controla cada una.

    En la pose de reposo un programa lineal deja casi siempre tres contactos activos: ahí todo parece isostático y el
    control es ciego. Por eso se cuenta en la pose de diseño.
    - Es apoyo toda zona a `delta` o menos (0,10 = holgura de diseño 0,05 + 0,05) de la LUZ BASE: la más chica de las
      zonas que no están metidas (auditor del 17/10, I1: con una luz absoluta, una pieza diseñada 0,11 mm más lejos daba
      «0 apoyos» y VERDE). Una zona con luz NEGATIVA está metida en el blando y se cuenta siempre: la pieza no puede
      asentar como se diseñó (la firma de los pasadores de la v14).
    - Cada zona controla Z; si su huella es larga en x (al menos `largo_frac` del largo de la pieza) controla además el
      giro alrededor de y, y si es larga en y, el giro alrededor de x (auditor, I2: dos rieles o una placa entera
      contaban como uno o dos apoyos y daban VERDE). `restricciones` es la suma: Z y los dos giros necesitan tres.
      El 0,25 se fijó contra los casos el 17/10: deja la v14 en 7, la v15 en 4 y la v16 en 4, y da ROJO a dos rieles,
      a una placa entera y a cuatro apoyos unidos por un nervio.
    Devuelve (apoyos, luz, info)."""
    from scipy import ndimage
    gap = H - T
    ok = np.isfinite(gap)
    info = {"puntos_pieza": int(np.isfinite(T).sum()), "puntos_con_panel": int(ok.sum())}
    info["pct_pieza_con_panel"] = round(100.0 * info["puntos_con_panel"] / max(1, info["puntos_pieza"]), 1)
    no_met = ok & (gap >= metido)
    base = float(np.min(gap[no_met])) if no_met.any() else 0.0
    corte = max(base, 0.0) + delta
    info.update(luz_base_mm=round(base, 3), corte_mm=round(corte, 3))
    m = ok & ((gap <= corte) | (gap < metido))
    lab, n = ndimage.label(m.reshape(gr.shape), structure=np.ones((3, 3)))
    lab = lab.ravel()
    pie = gr.XY[np.isfinite(T)]
    Lx = float(np.ptp(pie[:, 0])) if len(pie) else 0.0
    Ly = float(np.ptp(pie[:, 1])) if len(pie) else 0.0
    info.update(largo_pieza_x=round(Lx, 1), largo_pieza_y=round(Ly, 1))
    apoyos = []
    for i in range(1, n + 1):
        idx = np.where(lab == i)[0]
        xy = gr.XY[idx]
        ex, ey = float(np.ptp(xy[:, 0])), float(np.ptp(xy[:, 1]))
        largo_x = Lx > 0 and ex >= largo_frac * Lx
        largo_y = Ly > 0 and ey >= largo_frac * Ly
        controla = ["Z"] + (["giro en y"] if largo_x else []) + (["giro en x"] if largo_y else [])
        apoyos.append({
            "celdas": int(len(idx)),
            "x": [round(float(xy[:, 0].min()), 1), round(float(xy[:, 0].max()), 1)],
            "y": [round(float(xy[:, 1].min()), 1), round(float(xy[:, 1].max()), 1)],
            "centro": [round(float(xy[:, 0].mean()), 2), round(float(xy[:, 1].mean()), 2)],
            "luz_min_mm": round(float(np.nanmin(gap[idx])), 3),
            "metido": bool(np.nanmin(gap[idx]) < metido),
            "controla": controla,
            "restricciones": len(controla),
            "_idx": idx})
    return apoyos, gap, info


def superficies(apoyos, H, gr, tol_mm=0.05):
    """¿Sobre cuántas superficies del panel apoyan? Un plano por apoyo (ajustado a las alturas del panel bajo su
    huella); dos apoyos están en la misma superficie si el plano de uno pasa a menos de `tol_mm` del otro. La
    dispersión es el residuo máximo del plano común a todos."""
    if not apoyos:
        return {"superficies": 0, "dispersion_mm": None}
    planos = []
    for a in apoyos:
        idx = [i for i in a["_idx"] if np.isfinite(H[i])]
        P = gr.XY[idx]
        A = np.column_stack([np.ones(len(idx)), P[:, 0], P[:, 1]])
        c = np.linalg.lstsq(A, H[idx], rcond=None)[0] if len(idx) >= 3 else np.array([np.nanmean(H[idx]), 0, 0])
        planos.append((c, P, H[idx]))
    grupos = []
    for j, (_, Pj, Hj) in enumerate(planos):
        for gidx in grupos:
            c = planos[gidx[0]][0]
            if np.max(np.abs(c[0] + c[1] * Pj[:, 0] + c[2] * Pj[:, 1] - Hj)) < tol_mm:
                gidx.append(j)
                break
        else:
            grupos.append([j])
    todo = np.vstack([p for _, p, _ in planos])
    hz = np.concatenate([h for _, _, h in planos])
    A = np.column_stack([np.ones(len(todo)), todo[:, 0], todo[:, 1]])
    c = np.linalg.lstsq(A, hz, rcond=None)[0]
    return {"superficies": len(grupos), "dispersion_mm": round(float(np.max(np.abs(A @ c - hz))), 3)}


def no_vistos_por_la_simulacion(apoyos_fino, grf, gap_grueso, gr, corte=0.10):
    """Apoyos de la grilla fina que NINGÚN punto de la grilla de la simulación toca (con el mismo corte del inventario):
    elementos más angostos que el paso, que la simulación no puede ver. Devuelve sus índices en `apoyos_fino`."""
    toca = np.isfinite(gap_grueso) & (gap_grueso <= corte)
    pts = gr.XY[toca]
    fuera = []
    for j, a in enumerate(apoyos_fino):
        x0, x1 = a["x"]
        y0, y1 = a["y"]
        m = (pts[:, 0] >= x0 - grf.paso) & (pts[:, 0] <= x1 + grf.paso) & (pts[:, 1] >= y0 - grf.paso) & (pts[:, 1] <= y1 + grf.paso)
        if not m.any():
            fuera.append(j)
    return fuera


# =====================================================================================
# 2. ventana de asiento (pose de DISEÑO)
# =====================================================================================
def rejilla_fina(rects, paso=0.1, desfase=0.037):
    pts = []
    for r in rects or []:
        xs = np.arange(r["cx"] - r["hx"], r["cx"] + r["hx"], paso) + desfase
        ys = np.arange(r["cy"] - r["hy"], r["cy"] + r["hy"], paso) + desfase
        X, Y = np.meshgrid(xs, ys)
        pts.append(np.column_stack([X.ravel(), Y.ravel()]))
    return np.vstack(pts) if pts else np.zeros((0, 2))


def luz_a_plastico(malla_s, malla_pieza, rects, escena, paso=0.1):
    """Luz mínima entre la pieza y el PLÁSTICO en las zonas donde manda el plástico, con una rejilla fina (0,1 mm).
    Es cuánto puede acercarse el panel (o ceder lo que apoya) antes de que plástico toque plástico."""
    XY = rejilla_fina(rects, paso)
    if not len(XY):
        return None, None
    ry = escena.get("rayos", {})
    Hs = primer_z(malla_s, XY, ry.get("panel_desde", -60), 1)
    T = primer_z(malla_pieza, XY, ry.get("pieza_desde", 20), -1)
    luz = Hs - T
    if not np.isfinite(luz).any():
        return None, None
    i = int(np.nanargmin(luz))
    return float(luz[i]), [round(float(XY[i, 0]), 2), round(float(XY[i, 1]), 2)]


def perfil_horizontal(malla, x, y_desde, sentido, zs):
    """y del primer impacto de rayos horizontales (dirección ±y) a la altura de cada z."""
    o = np.column_stack([np.full(len(zs), float(x)), np.full(len(zs), float(y_desde)), zs])
    d = np.tile([0.0, float(sentido), 0.0], (len(zs), 1))
    loc, ir, _ = malla.ray.intersects_location(o, d, multiple_hits=False)
    yh = np.full(len(zs), np.nan)
    yh[ir] = loc[:, 1]
    return yh


def tramo_recto(yh, zs, tol):
    """El tramo vertical de una pared vista con rayos horizontales: el valor de y que más se repite y el tramo SEGUIDO
    más largo a menos de `tol` de ese valor. Devuelve (z de abajo, z de arriba, y de la pared) o None."""
    ok = np.isfinite(yh)
    if ok.sum() < 5:
        return None
    vals, cnt = np.unique(np.round(yh[ok], 2), return_counts=True)
    yw = float(vals[np.argmax(cnt)])
    idx = np.where(ok & (np.abs(yh - yw) <= tol))[0]
    if not len(idx):
        return None
    tramos = np.split(idx, np.where(np.diff(idx) > 1)[0] + 1)
    t = max(tramos, key=len)
    return float(zs[t[0]]), float(zs[t[-1]]), yw


def tope_de_banda(malla_pieza, sonda, z_desde, z_hasta, paso=0.01, tol=0.02):
    """La banda recta de la pared que aprieta de costado: el z más alto hasta donde la pared de la PIEZA sigue
    vertical. Rayos horizontales desde afuera de la pieza hacia su pared (la sonda)."""
    zs = np.arange(z_desde, z_hasta, paso)
    t = tramo_recto(perfil_horizontal(malla_pieza, sonda["x"], sonda["y_desde"], sonda["dir"], zs), zs, tol)
    return (t[1], t[2]) if t else (None, None)


def ventana(escena, malla_s, malla_pieza, log=print):
    """(banda_mm, punta_mm, detalle), en la pose de DISEÑO.

    banda = cuánto puede alejarse el panel y la banda recta de la pieza sigue más allá del labio (sigue apretando). La
    banda se MIDE en la pieza; el labio es una cota declarada de la escena (en el Upper Trim la pared de la ranura
    tiene desmoldeo y no hay un borde que medir: medido el 17/10). punta = cuánto puede acercarse el panel antes de que
    la pieza toque plástico, MEDIDO con una rejilla de 0,1 mm en las zonas de plástico."""
    det = {}
    punta, donde = luz_a_plastico(malla_s, malla_pieza, escena.get("zonas_plastico"), escena)
    det["punta_donde"] = donde
    ap = escena.get("apriete")
    if not ap or ap.get("tipo") != "costado":
        det["banda_motivo"] = "la escena no declara como aprieta la pieza ('apriete'): no se puede medir si sigue apretando"
        return None, punta, det
    if ap.get("z_labio") is None:
        det["banda_motivo"] = "la escena no declara el z del labio ('apriete.z_labio')"
        return None, punta, det
    zt = float(np.asarray(malla_pieza.vertices)[:, 2].max())
    bandas = []
    for s in ap["sondas"]:
        tb, yb = tope_de_banda(malla_pieza, s, zt - 8.0, zt + 0.005)
        if tb is None:
            det.setdefault("sondas_sin_banda", []).append(s)
            continue
        bandas.append(tb)
        det.setdefault("sondas", []).append({"x": s["x"], "dir": s["dir"], "tope_banda_z": round(tb, 3),
                                             "pared_pieza_y": yb})
    if not bandas:
        det["banda_motivo"] = "ninguna sonda encontro la banda recta de la pieza"
        return None, punta, det
    det["tope_pieza_z"] = round(zt, 4)
    det["labio_z"] = ap["z_labio"]
    det["labio_es"] = "cota declarada de la escena (no medida)"
    banda = min(bandas) - ap["z_labio"]
    return float(banda), punta, det


# =====================================================================================
# 3. simulación apretando (las mismas cuentas que sim_asiento.py)
# =====================================================================================
def simular(Hs, Ht, T, gr, escena, zp, tap, abiertas, mano, n, semilla, gemelo=False):
    """Se hamaca en cuántos casos y cuánto. Reproduce sim_asiento.py (13/10) bit a bit con la escena del Upper Trim y
    gemelo=False (probado en gate_asiento.py calibrar contra lo publicado); gemelo=True es el renglón de
    sim_asiento_v16.py --error-local (17/10)."""
    s = escena["sorteo"]
    cx, cy = escena["centro"]
    lim_z, lim_g = escena["pose"]["z"], escena["pose"]["giro"]
    ESQ = np.array(escena["esquinas"], float)
    XY = gr.XY
    rng = np.random.default_rng(semilla)
    gm = escena.get("gemelo") or {}
    res = []
    for _ in range(n):
        cede = rng.uniform(s["cede"][0], s["cede"][1])
        e0, e1, e2 = rng.uniform(-s["espesor"], s["espesor"], 3)
        al = rng.uniform(-s["alabeo"], s["alabeo"])
        loc_err, xc = 0.0, cx
        if gemelo:
            xl = rng.uniform(gm["x"][0], gm["x"][1], gm["lomas"])
            yl = rng.uniform(gm["y"][0], gm["y"][1], gm["lomas"])
            amp = rng.uniform(-gm["amp"], gm["amp"], gm["lomas"])
            loc_err = sum(a_ * np.exp(-((XY[:, 0] - x_) ** 2 + (XY[:, 1] - y_) ** 2) / (2 * gm["sigma"] ** 2))
                          for x_, y_, a_ in zip(xl, yl, amp))
            xc = rng.uniform(gm["xc"][0], gm["xc"][1])
        H = np.where(zp, Hs, Ht)
        H = np.where(tap, Ht + cede + e0 + e1 * (XY[:, 0] - cx) / s["espesor_Lx"] + e2 * (XY[:, 1] - cy) / s["espesor_Ly"]
                     + loc_err, H)
        H = np.where(tap & np.isfinite(Hs), np.minimum(H, Hs), H)   # cede hasta el plástico, no más
        H = np.where(abiertas, np.nan, H)
        g = H - (T + al * ((XY[:, 0] - xc) / s["alabeo_L"]) ** 2)
        poses, plast = [], False
        for fx, fy in mano:
            p, act = reposo(g, XY, fx, fy, (cx, cy), lim_z, lim_g)
            if p is None:
                continue
            poses.append([p[0] + p[1] * (ex - cx) + p[2] * (ey - cy) for ex, ey in ESQ])
            plast |= bool(zp[act].any())
        poses = np.array(poses)
        centro = reposo(g, XY, cx, cy, (cx, cy), lim_z, lim_g)[0]
        lejos = max(0.0, -centro[0]) if centro is not None else np.nan
        res.append({"hamaca": float((poses.max(0) - poses.min(0)).max()), "plastico": plast, "lejos": float(lejos)})
    h = np.array([r["hamaca"] for r in res])
    um = s.get("hamaca_umbral_mm", 0.3)
    return {"casos": n, "semilla": semilla,
            "hamaca_mediana_mm": round(float(np.median(h)), 2),
            "hamaca_max_mm": round(float(h.max()), 2),
            "pct_hamaca": round(100 * float((h > um).mean())),
            "pct_toca_plastico": round(100 * float(np.mean([r["plastico"] for r in res]))),
            "lejos_max_mm": round(float(np.nanmax([r["lejos"] for r in res])), 2)}


def _firma_de_archivos():
    """El código que hace las cuentas y decide (este archivo, gate_asiento.py y eval_casos_3d.py) y los UMBRALES de
    data/casos_3d.json (auditor del 17/10, I5: cambiar un umbral o el veredicto de apoyos no invalidaba la calibración)."""
    h = hashlib.sha1()
    for p in (os.path.abspath(__file__), os.path.join(AQUI, "..", "gate_asiento.py"),
              os.path.join(AQUI, "..", "eval_casos_3d.py")):
        if os.path.isfile(p):
            with open(p, "rb") as f:
                h.update(f.read().replace(b"\r\n", b"\n"))
    c3 = os.path.join(AQUI, "..", "..", "data", "casos_3d.json")
    if os.path.isfile(c3):
        with open(c3, encoding="utf-8") as f:
            h.update(json.dumps(json.load(f).get("umbrales"), sort_keys=True).encode("utf-8"))
    return h.hexdigest()[:16]


def _sin_notas(x):
    if isinstance(x, dict):
        return {k: _sin_notas(v) for k, v in x.items() if not k.startswith("_")}
    if isinstance(x, list):
        return [_sin_notas(v) for v in x]
    return x


def firma_escena(escena):
    """Lo que entra a las cuentas de una escena (sin las notas que empiezan con «_»): grilla, zonas, mano, sorteos,
    piezas. Si cambia un número de la escena calibrada, la calibración deja de valer para ella."""
    return hashlib.sha1(json.dumps(_sin_notas(escena), sort_keys=True).encode("utf-8")).hexdigest()[:16]


_FIRMA_AL_CARGAR = _firma_de_archivos()


def firma_nucleo():
    """sha1 de este archivo y de gate_asiento.py TAL COMO SE CARGARON: la calibración vale para ESTA versión de las
    cuentas (las de acá y cómo las arma el gate). Si cambia cualquiera de los dos, hay que volver a calibrar
    (gate_asiento.py calibrar) antes de juzgar una pieza nueva. Se calcula al cargar, no al final: editar el archivo
    mientras corre una calibración no puede dejar un registro con la firma de un código que no corrió."""
    return _FIRMA_AL_CARGAR

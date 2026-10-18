# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr:
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe gate_asiento.py --help
"""GATE DE ASIENTO — cómo asienta un utillaje rígido sobre algo BLANDO (tapizado, espuma, goma, chapa fina).

Por qué existe. El virolador v14 del Upper Trim pasó todos los gates (choque, aristas, giro, zona, entregable) y en la
planta se hamaca sobre el panel tapizado (Fak, 13/10/2026: «se balancea de un lado al otro»). Es la tercera vez desde
agosto que una pieza aprobada por los controles falla en el uso: los gates miran la pieza fría y desnuda contra el
archivo del cliente (SKILL.md, «Lo que los gates NO cubren»); nada miraba cómo asienta sobre lo blando ni cuántas
superficies la apoyan. La regla de interferencia contra el sustrato RÍGIDO (cad-3d.md) sigue igual: este gate se le SUMA.
Plan: docs/PLAN_3D_GATE_ASIENTO_2026-10-16.md (sí de Fak, 17/10/2026).

Qué mira, por renglón:
  activación   corre solo si la pieza apoya sobre blando (etiqueta 'apoya-sobre-blando' del pliego de gate_proceso, o
               la de la escena, o --etiqueta). Sobre rígido NO corre y lo dice: lo juzga check_collision.
  apoyos       cuántas superficies de la pieza tocan el panel en la pose de DISEÑO. Z y los dos giros se controlan con
               tres; ROJO si hay más (apoyos redundantes, Carr Lane) o si alguno está METIDO en el blando (la pieza no
               puede asentar como se diseñó). Renglón aparte, informativo: cuatro sobre UNA superficie (4-2-1).
  ventana      cuánto puede alejarse el panel y la pieza sigue apretando (banda) y cuánto acercarse antes de tocar
               plástico (punta). Si es de décimas, ROJO aunque el choque dé cero.
  asiento      la simulación apretando en varios lugares con el blando variando: «se hamaca en N de 100» y «se mueve
               X mm apretando en la punta». Más el gemelo (espesor desparejo), informativo.

Disciplina de la casa (SKILL.md, GATE 3): en CADA corrida pasa primero un par BIEN/MAL sintético propio; si no separa,
sale con código 3 y no juzga nada. Y no juzga una pieza nueva si la simulación no está CALIBRADA: `calibrar` tiene que
haber reproducido lo publicado de la v14 y la v15 con esta misma versión de las cuentas (firma de cadlib/asiento.py).

Uso:
  gate_asiento.py autotest
  gate_asiento.py calibrar  --escena upper_trim_two --workdir W
  gate_asiento.py verificar --escena upper_trim_two --pieza v16 --workdir W [--stl otra.stl] [--etiqueta blando]
                            [--casos-sim 50] [--salida resultado.json]

Códigos de salida: 0 VERDE (o no corre) · 1 ROJO o un control sin dato · 2 uso o dos fuentes que no coinciden ·
3 el gate no está en condiciones de juzgar (autotest o calibración).
"""
import argparse
import json
import os
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from cadlib import envcheck  # noqa: E402

envcheck.require(("numpy", "scipy", "trimesh"))
import numpy as np  # noqa: E402

from cadlib import asiento as A  # noqa: E402
from cadlib import workdir as wd  # noqa: E402
import eval_casos_3d as ev  # noqa: E402

DATA = os.path.join(AQUI, "..", "data")
CASOS = os.path.join(DATA, "asiento_casos.json")
CASOS_3D = os.path.join(DATA, "casos_3d.json")
CALIB = os.path.join(DATA, "asiento_calibracion.json")
CANON = os.path.join(AQUI, "procesoCanon.data.json")

OK, ROJO_, USO, NO_JUZGA = 0, 1, 2, 3
ETIQ = {"apoya-sobre-blando": "blando", "apoya-sobre-rigido": "rigido", "blando": "blando", "rigido": "rigido"}


def _json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def umbrales():
    return _json(CASOS_3D)["umbrales"]


def modo_canon():
    try:
        return _json(CANON).get("gateAsiento", {})
    except Exception:                                   # noqa: BLE001
        return {}


# =====================================================================================
# autotest: par BIEN/MAL sintético propio, en cada corrida
# =====================================================================================
def _escena_sintetica(mano):
    return {"centro": [50, 20], "esquinas": [[0, 0], [100, 0], [0, 40], [100, 40]], "pose": {"z": 20, "giro": 0.2},
            "mano": mano,
            "sorteo": {"cede": [0, 0.6], "espesor": 0.2, "espesor_Lx": 50, "espesor_Ly": 20, "alabeo": 0.2,
                       "alabeo_L": 50, "hamaca_umbral_mm": 0.3}}


def _pieza_sintetica(gr, apoyos, r=3.0):
    T = np.full(len(gr.XY), -5.0)
    for x, y in apoyos:
        T[(gr.XY[:, 0] - x) ** 2 + (gr.XY[:, 1] - y) ** 2 <= r * r] = -0.05      # holgura de diseño 0,05
    return T


def autotest(n=20):
    """(separa, renglones). Tres pares: inventario (3 apoyos VERDE / 4 ROJO), simulación (3 apoyos con la mano
    adentro: no se hamaca / 4 apoyos con uno sobre una meseta 0,4 más lejos: se hamaca) y luz a plástico (1,0 / 0,3)."""
    import trimesh
    U = umbrales()
    gr = A.Grilla([0, 100], [0, 40], 1.0, 0.137)
    Hs = np.full(len(gr.XY), 0.5)
    Ht = np.zeros(len(gr.XY))
    zp = np.zeros(len(gr.XY), bool)
    nada = zp.copy()
    tres = [(15, 8), (15, 32), (85, 20)]
    cuatro = [(15, 8), (15, 32), (85, 8), (85, 32)]
    lin = []

    def a1(ap):
        return ev.a1_apoyos([{"nombre": str(i), "tipo": "apoyo_z", "rigido": True} for i in range(len(ap))], U)["veredicto"]

    b = a1(A.inventario(Ht, _pieza_sintetica(gr, tres), gr)[0])
    m = a1(A.inventario(Ht, _pieza_sintetica(gr, cuatro), gr)[0])
    ok1 = b == "VERDE" and m == "ROJO"
    lin.append("inventario: 3 apoyos %s / 4 apoyos %s" % (b, m))

    tap = ~zp & (Hs - Ht > 0.05)
    eb = _escena_sintetica([[25, 20], [40, 15], [40, 25], [60, 20]])
    sb = A.simular(Hs, Ht, _pieza_sintetica(gr, tres), gr, eb, zp, tap, nada, eb["mano"], n, 7)
    Htm = Ht.copy()
    Htm[(gr.XY[:, 0] - 85) ** 2 + (gr.XY[:, 1] - 32) ** 2 <= 36] = 0.4            # meseta 0,4 mas lejos bajo un apoyo
    tapm = ~zp & (Hs - Htm > 0.05)
    em = _escena_sintetica([[25, 20], [50, 20], [80, 30], [80, 10], [20, 30]])
    sm = A.simular(Hs, Htm, _pieza_sintetica(gr, cuatro), gr, em, zp, tapm, nada, em["mano"], n, 7)
    ok2 = sb["pct_hamaca"] <= U["hamaca_pct_max"] and sm["pct_hamaca"] > U["hamaca_pct_max"]
    lin.append("simulacion: 3 apoyos se hamaca en %d %% / 4 apoyos sobre dos mesetas en %d %%"
               % (sb["pct_hamaca"], sm["pct_hamaca"]))

    def luz(z_plastico):
        pl = trimesh.creation.box(extents=[10, 10, 2.0])
        pl.apply_translation([5, 5, z_plastico + 1.0])
        pz = trimesh.creation.box(extents=[10, 10, 3.0])
        pz.apply_translation([5, 5, -1.5])
        return A.luz_a_plastico(pl, pz, [{"cx": 5, "cy": 5, "hx": 4, "hy": 4}], {})[0]
    lb, lm = luz(1.0), luz(0.3)
    ok3 = lb is not None and lm is not None and lb >= U["ventana_punta_min_mm"] > lm
    lin.append("luz a plastico: %.2f mm / %.2f mm (minimo %.2f)" % (lb or -1, lm or -1, U["ventana_punta_min_mm"]))
    return ok1 and ok2 and ok3, lin


# =====================================================================================
# activación
# =====================================================================================
def etiqueta_de(escena, cli=None, workdir_path=None):
    """(etiqueta, de dónde salió, conflicto). Las fuentes son --etiqueta, el pliego de gate_proceso en el workdir y la
    escena. Si dos dicen cosas distintas NO se elige una (auditor del 17/10, I3: «rígido» en el pliego apagaba el gate
    sobre la v14): se devuelve el conflicto y el gate sale con código 2."""
    fuentes = []
    if cli:
        fuentes.append((ETIQ.get(cli), "--etiqueta"))
    if workdir_path and os.path.isfile(os.path.join(workdir_path, wd.MANIFEST)):
        e = wd.find_evidence(workdir_path, "proceso_declarado")
        tags = set((e or {}).get("tags") or [])
        if {"apoya-sobre-blando", "apoya-sobre-rigido"} <= tags:
            return None, None, "el pliego de gate_proceso trae las dos etiquetas (apoya-sobre-blando y apoya-sobre-rigido)"
        if "apoya-sobre-blando" in tags:
            fuentes.append(("blando", "pliego de gate_proceso (etiqueta apoya-sobre-blando)"))
        if "apoya-sobre-rigido" in tags:
            fuentes.append(("rigido", "pliego de gate_proceso (etiqueta apoya-sobre-rigido)"))
    if escena.get("apoya_sobre"):
        fuentes.append((ETIQ.get(escena["apoya_sobre"]), "escena '%s'" % escena.get("_nombre")))
    if not fuentes:
        return None, None, None
    if len({f[0] for f in fuentes}) > 1:
        return None, None, "las fuentes no coinciden: " + "; ".join("%s dice %s" % (d, v) for v, d in fuentes)
    return fuentes[0][0], " y ".join(d for _, d in fuentes), None


# =====================================================================================
# evaluar una pieza
# =====================================================================================
class Contexto(object):
    """El panel de una escena visto desde la pieza: mallas (plástico / plástico + blando) y alturas en las dos grillas."""

    def __init__(self, escena, cache_dir, log=print, mallas=None):
        self.e = escena
        self.esquinas = None                           # las de la pieza, si declara las suyas (ver correr_sim)
        self.mano_punta = None                         # idem para la mano «punta» (auditor del 17/10, I7)
        if mallas is not None:                         # tests: mallas sintéticas, sin STEP
            self.ms, self.mt = mallas
            self.firma_panel = "sintetico"
        else:
            self.ms, self.mt, self.firma_panel = A.mallas_panel(escena, cache_dir, log)
        self.gr = A.grilla_de(escena)
        self.Hs, self.Ht = A.alturas_panel(escena, self.ms, self.mt, self.gr)
        self.zp, self.tap = A.mascaras(escena, self.gr, self.Hs, self.Ht)
        self.grf = A.grilla_inventario(escena)
        self.Hsf, self.Htf = A.alturas_panel(escena, self.ms, self.mt, self.grf)
        self.zpf, _ = A.mascaras(escena, self.grf, self.Hsf, self.Htf)


def cargar_pieza(ruta):
    import trimesh
    if ruta.lower().endswith((".step", ".stp")):
        from cadlib import geom
        return geom.step_to_trimesh(ruta, lc=0.4, require_watertight=False)
    return trimesh.load(ruta, force="mesh")


def declarado(nombre):
    """Cuántos apoyos rígidos en Z declara data/casos_3d.json para esta pieza (la segunda fuente), o None."""
    v = _json(CASOS_3D).get("versiones", {}).get(nombre)
    if not v:
        return None
    return sum(1 for e in v.get("elementos", []) if e.get("rigido") and e.get("tipo") == "apoyo_z")


COBERTURA_MIN_PCT = 40      # cad-3d.md GATE 3: un barrido de rayos con menos de ~40 % de impactos no es un resultado
PUNTOS_MIN = 3              # Z y los dos giros: tres grados de libertad (Carr Lane 3-2-1). No es un umbral: es el minimo
#                             mecanico, y va separado del maximo de casos_3d.json (revisor por API del 18/10: el maximo
#                             hacia de minimo; con el maximo en 4 por el 4-2-1, tres apoyos habrian dado ROJO)
_RANGO = {"ROJO": 3, "SIN DATO": 2, "AVISO": 1, "VERDE": 0}


def fuera_de_la_grilla(malla, gr):
    """% de los vértices de la pieza que caen afuera del rectángulo de la grilla."""
    v = np.asarray(malla.vertices)
    m = h = gr.paso / 2.0
    adentro = ((v[:, 0] >= gr.xs[0] - m) & (v[:, 0] <= gr.xs[-1] + h) &
               (v[:, 1] >= gr.ys[0] - m) & (v[:, 1] <= gr.ys[-1] + h))
    return 100.0 * float((~adentro).mean()) if len(v) else 100.0


def fila_apoyos(cx, malla, U):
    """El inventario en cada variante del panel; se informa la PEOR por veredicto y, entre iguales, la de más apoyos
    (auditor del 17/10, I6: elegirla por cantidad escondía un ROJO de un apoyo metido)."""
    e = cx.e
    peor = None
    por_variante = {}
    T = A.alturas_pieza(malla, cx.gr, e)
    Tf = A.alturas_pieza(malla, cx.grf, e)
    for v in e.get("variantes") or [{"nombre": "nominal", "abiertas": []}]:
        H = A.panel_nominal(cx.Hs, cx.Ht, cx.zp, A.en_rects(cx.gr.XY, v["abiertas"]))
        Hf = A.panel_nominal(cx.Hsf, cx.Htf, cx.zpf, A.en_rects(cx.grf.XY, v["abiertas"]))
        ap, _, info = A.inventario(Hf, Tf, cx.grf)
        sup = A.superficies(ap, Hf, cx.grf)
        nv = A.no_vistos_por_la_simulacion(ap, cx.grf, H - T, cx.gr, corte=info["corte_mm"])
        elementos = [{"nombre": "apoyo en x %.1f y %.1f" % tuple(a["centro"]), "tipo": "apoyo_z", "rigido": True}
                     for a in ap]
        r1 = dict(ev.a1_apoyos(elementos, U))
        motivos = [r1["motivo"]]
        npt, sep, en_linea = A.puntos_de_apoyo(ap, info["largo_menor_pieza"], info["largo_frac"])
        r1.update(puntos_de_apoyo=npt, separacion_de_la_linea_mm=sep, en_linea=en_linea)
        rieles = [a for a in ap if a["tipo"] == "riel"]
        sup_g = [a for a in ap if a["tipo"] == "superficie"]
        metidos = [a for a in ap if a["metido"]]
        fuera = fuera_de_la_grilla(malla, cx.grf)
        info["pct_pieza_en_la_grilla"] = round(100.0 - fuera, 2)
        if fuera > 0:
            # la cobertura se mide con la PIEZA ENTERA, no solo con lo que cae adentro de la grilla (auditor, ronda 2,
            # R2-I2: un apoyo afuera de la grilla no se veia y la cobertura daba 100 %)
            r1["veredicto"] = "SIN DATO"
            motivos = ["%.1f %% de la pieza queda afuera de la grilla de la escena: lo que apoya ahi no se ve" % fuera]
        elif info["pct_pieza_con_panel"] < COBERTURA_MIN_PCT:
            r1["veredicto"] = "SIN DATO"
            motivos = ["solo %.0f %% de la pieza tiene panel enfrente (minimo %d %%): la pieza no esta en el frame de la "
                       "escena" % (info["pct_pieza_con_panel"], COBERTURA_MIN_PCT)]
        elif not ap:
            r1["veredicto"] = "SIN DATO"
            motivos = ["ninguna zona de la pieza toca el panel: no se pudo medir"]
        else:
            if sup_g:
                r1["veredicto"] = "ROJO"
                motivos.append("%d superficie(s) de apoyo grande(s): apoya en sus puntos mas altos, que cambian con la "
                               "tolerancia (ficha-utillajes B2: apoyos chicos)" % len(sup_g))
            if npt > U["apoyos_z_max"]:
                r1["veredicto"] = "ROJO"
                motivos.append("%d puntos de apoyo para Z y los dos giros (sobran %d)%s" % (
                    npt, npt - U["apoyos_z_max"], (", %d riel(es) cuentan por dos" % len(rieles)) if rieles else ""))
            if npt < PUNTOS_MIN:
                r1["veredicto"] = "ROJO"
                motivos.append("%d punto(s) de apoyo: no alcanzan para Z y los dos giros, la pieza vuelca" % npt)
            elif en_linea:
                r1["veredicto"] = "ROJO"
                motivos.append("los puntos de apoyo estan EN LINEA (se apartan %.1f mm de su recta): no controlan el giro "
                               "alrededor de esa linea, la pieza vuelca" % sep)
            if metidos:
                r1["veredicto"] = "ROJO"
                motivos.append("%d metido(s) en el blando hasta %.2f mm: la pieza no puede asentar como se diseno"
                               % (len(metidos), -min(a["luz_min_mm"] for a in metidos)))
        r1["motivo"] = "; ".join(motivos)
        r1["inventario"] = info
        r1b = ev.a1b_cuatro_coplanares(elementos, sup, U)
        # el poligono para decidir si la mano «punta» cae adentro: SOLO apoyos que la simulacion ve y que no estan
        # metidos (auditor, I7: los pasadores metidos de la v14 agrandaban el poligono y tapaban 5,9 mm)
        vis = [a for j, a in enumerate(ap) if j not in nv and not a["metido"]]
        poligono = np.vstack([cx.grf.XY[a["_idx"]] for a in vis]) if vis else np.zeros((0, 2))
        por_variante[v["nombre"]] = {
            "A1": r1, "A1b": r1b,
            "apoyos": [{k: x for k, x in a.items() if k != "_idx"} for a in ap],
            "no_vistos_por_la_simulacion": [ap[j]["centro"] for j in nv],
            "_poligono": poligono}
        clave = (_RANGO.get(r1["veredicto"], 0), r1["apoyos_z"])
        if peor is None or clave > (_RANGO.get(por_variante[peor]["A1"]["veredicto"], 0), por_variante[peor]["A1"]["apoyos_z"]):
            peor = v["nombre"]
    return peor, por_variante


def fila_ventana(cx, malla, U):
    banda, punta, det = A.ventana(cx.e, cx.ms, malla)
    if banda is None or punta is None:
        return {"veredicto": "SIN DATO", "banda_mm": banda, "punta_mm": punta,
                "motivo": det.get("banda_motivo") or "no hay zonas de plastico declaradas", "detalle": det}
    rojo = banda < U["ventana_banda_min_mm"] or punta < U["ventana_punta_min_mm"]
    return {"veredicto": "ROJO" if rojo else "VERDE", "banda_mm": round(banda, 3), "punta_mm": round(punta, 3),
            "umbral": "banda >= %s, punta >= %s" % (U["ventana_banda_min_mm"], U["ventana_punta_min_mm"]), "detalle": det}


def correr_sim(cx, malla, variante, mano, n, gemelo=False):
    # las esquinas que se miden son de la PIEZA (su placa): una pieza de la escena puede declarar las suyas (la v16 tiene
    # placa de 168 mm y la tanda 11 la midio en x -38,1 / 127,9; la v14 y la v15, en -35 / 125)
    e = dict(cx.e, esquinas=cx.esquinas) if getattr(cx, "esquinas", None) else cx.e
    T = A.alturas_pieza(malla, cx.gr, e)
    v = next(x for x in e["variantes"] if x["nombre"] == variante) if e.get("variantes") else {"abiertas": []}
    ab = A.en_rects(cx.gr.XY, v["abiertas"])
    return A.simular(cx.Hs, cx.Ht, T, cx.gr, e, cx.zp, cx.tap, ab, mano, n, e["sorteo"]["semilla"], gemelo=gemelo)


def veredicto_asiento(variantes, U, escena):
    """El juicio del asiento a partir de las simulaciones ya corridas: {variante: {"normal": s, "punta": sp o None}}.
    Lo usan IGUAL `verificar` (fila_asiento) y `calibrar` (revisor por API del 18/10: la calibracion juzgaba solo con el
    porcentaje y verificar ademas con la maxima, el plastico y la punta). Devuelve (veredicto, motivos)."""
    malos, sin_dato = [], []
    um = escena["sorteo"].get("hamaca_umbral_mm", 0.3)
    for nom, r in variantes.items():
        s = r.get("normal")
        if not s or s.get("sin_dato") or s.get("casos_sin_reposo"):
            sin_dato.append("%s: %s" % (nom, (s or {}).get("motivo") or "%d caso(s) sin reposo" % (s or {}).get("casos_sin_reposo", 0)))
            continue
        if s["pct_hamaca"] > U["hamaca_pct_max"]:
            malos.append("%s: se hamaca > %s mm en %d de 100 (maximo %s)" % (nom, um, s["pct_hamaca"], U["hamaca_pct_max"]))
        if s["hamaca_max_mm"] > U["hamaca_max_mm"]:
            malos.append("%s: hamaca maxima %.2f mm (maximo %s)" % (nom, s["hamaca_max_mm"], U["hamaca_max_mm"]))
        if s["pct_toca_plastico"] > 0:
            malos.append("%s: toca plastico en %d de 100" % (nom, s["pct_toca_plastico"]))
        p = r.get("punta")
        if isinstance(p, dict) and p.get("veredicto") != "NO APLICA" and "hamaca_mediana_mm" in p:
            if p["hamaca_mediana_mm"] > U["punta_mediana_max_mm"]:
                malos.append("%s: apretando en la punta se mueve %.2f mm (maximo %s)" % (nom, p["hamaca_mediana_mm"],
                                                                                        U["punta_mediana_max_mm"]))
        elif isinstance(p, dict) and (p.get("sin_dato") or p.get("casos_sin_reposo")):
            sin_dato.append("%s punta: %s" % (nom, p.get("motivo") or "casos sin reposo"))
    if malos:
        return "ROJO", malos
    if sin_dato:
        return "SIN DATO", sin_dato
    return "VERDE", []


def fila_asiento(cx, malla, U, n, poligonos, log=print):
    e = cx.e
    out = {"casos": n, "hipotesis": e["sorteo"].get("_", "")[:200], "variantes": {}}
    if n < e["sorteo"].get("casos_calibracion", n):
        # con menos casos que la calibracion el porcentaje tiene mas ruido: se dice cuanto (revisor por API, 18/10)
        out["ruido_pct"] = "con %d casos un porcentaje tiene +-%.0f puntos de ruido (un desvio, en el peor caso p = 50 %%); " \
                           "cerca del umbral, correr con --casos-sim %d" % (n, 100 * (0.25 / n) ** 0.5,
                                                                          e["sorteo"]["casos_calibracion"])
    notas = []
    for v in e.get("variantes") or [{"nombre": "nominal"}]:
        t0 = time.time()
        s = correr_sim(cx, malla, v["nombre"], e["mano"], n)
        log("  simulacion %s: %s (%.0f s)" % (v["nombre"], s.get("motivo") or "se hamaca en %d de 100, maxima %.2f mm"
                                              % (s["pct_hamaca"], s["hamaca_max_mm"]), time.time() - t0))
        r = {"normal": s}
        mano_punta = getattr(cx, "mano_punta", None) or e.get("mano_punta")
        if mano_punta:
            # «no aplica» se decide por la GEOMETRIA: todos los puntos de la mano «punta» caen adentro de los apoyos que
            # la simulacion ve (sin los metidos). No depende del resultado y no deja el renglon en AVISO (auditor, ronda
            # 2, R2-I3: el AVISO dependia del numero y frenaba para siempre a una pieza con los apoyos en las puntas).
            # Se simula igual y el numero queda escrito.
            sp = correr_sim(cx, malla, v["nombre"], mano_punta, n)
            pol = poligonos.get(v["nombre"])
            dentro = A.adentro_del_poligono(mano_punta, pol) if pol is not None and len(pol) else np.zeros(0, bool)
            if len(dentro) and dentro.all():
                r["punta"] = dict(sp, veredicto="NO APLICA", motivo=(
                    "los puntos de la mano 'punta' de la escena caen adentro de los apoyos: no es la punta de esta placa "
                    "(simulada igual: %s mm). Para medirla, declarar 'mano_punta' de la pieza en su borde; si no, la "
                    "decide la prueba fisica" % sp.get("hamaca_mediana_mm")))
                notas.append("%s: punta no aplica (la mano de la escena cae adentro de los apoyos)" % v["nombre"])
            else:
                r["punta"] = sp
        out["variantes"][v["nombre"]] = r
    out["veredicto"], motivos = veredicto_asiento(out["variantes"], U, e)
    out["motivo"] = "; ".join(motivos + notas) or "dentro de los umbrales"
    return out


def fila_gemelo(cx, malla, n):
    if not cx.e.get("gemelo"):
        return {"veredicto": "NO APLICA", "motivo": "la escena no declara gemelo"}
    v = cx.e["variantes"][0]["nombre"] if cx.e.get("variantes") else "nominal"
    s = correr_sim(cx, malla, v, cx.e["mano"], n, gemelo=True)
    return {"veredicto": "INFORMATIVO", "variante": v, **s}


def evaluar(cx, malla, nombre, n, gemelo=True, log=print):
    U = umbrales()
    peor, pv = fila_apoyos(cx, malla, U)
    filas = {"apoyos": pv[peor]["A1"], "apoyos_4_2_1": pv[peor]["A1b"]}
    filas["apoyos"]["variante"] = peor
    filas["apoyos"]["detalle"] = pv[peor]["apoyos"]
    nv = sorted({tuple(c) for x in pv.values() for c in x["no_vistos_por_la_simulacion"]})
    filas["no_vistos"] = {"veredicto": "AVISO" if nv else "VERDE", "elementos": [list(c) for c in nv],
                          "motivo": ("%d apoyo(s) mas angostos que la grilla de la simulacion (%.1f mm): la simulacion no "
                                     "los ve" % (len(nv), cx.gr.paso)) if nv else "la simulacion ve todos los apoyos"}
    filas["ventana"] = fila_ventana(cx, malla, U)
    filas["asiento"] = fila_asiento(cx, malla, U, n, {k: x["_poligono"] for k, x in pv.items()}, log)
    if gemelo:
        filas["gemelo"] = fila_gemelo(cx, malla, n)
    d = declarado(nombre) if nombre else None
    fuentes = None
    if d is not None and d != filas["apoyos"]["apoyos_z"]:
        fuentes = ("el inventario medido da %d apoyos y data/casos_3d.json declara %d para '%s'"
                   % (filas["apoyos"]["apoyos_z"], d, nombre))
    return filas, fuentes, pv


def veredicto_total(filas):
    """ROJO > SIN DATO > AVISO > VERDE. Solo VERDE sale con código 0: lo que no se pudo medir no da verde."""
    claves = ("apoyos", "ventana", "asiento")
    vs = [filas[k]["veredicto"] for k in claves if k in filas]
    for nivel in ("ROJO", "SIN DATO", "AVISO"):
        if nivel in vs:
            return nivel
    return "VERDE"


def imprimir(filas, nombre):
    print("")
    print("GATE DE ASIENTO — %s" % nombre)
    orden = ("apoyos", "apoyos_4_2_1", "no_vistos", "ventana", "asiento", "gemelo")
    for k in orden:
        if k not in filas:
            continue
        f = filas[k]
        txt = f.get("motivo") or ""
        if k == "ventana" and f.get("banda_mm") is not None:
            txt = "banda %.2f mm, punta %.2f mm (%s)" % (f["banda_mm"], f["punta_mm"], f.get("umbral"))
        if k == "asiento":
            partes = []
            for vn, r in f["variantes"].items():
                s = r["normal"]
                p = r.get("punta")
                pt = ("; punta %s" % p["veredicto"]) if isinstance(p, dict) and "veredicto" in p else (
                    "; apretando en la punta se mueve %.2f mm" % p["hamaca_mediana_mm"]
                    if isinstance(p, dict) and "hamaca_mediana_mm" in p else "")
                if s.get("sin_dato"):
                    partes.append("%s: sin dato" % vn)
                else:
                    partes.append("%s: se hamaca en %d de 100, maxima %.2f mm%s" % (vn, s["pct_hamaca"], s["hamaca_max_mm"], pt))
            txt = " | ".join(partes) + " — " + f["motivo"] + ((" (" + f["ruido_pct"] + ")") if f.get("ruido_pct") else "")
        if k == "gemelo" and "pct_hamaca" in f:
            txt = "espesor desparejo: se hamaca en %d de 100, maxima %.2f mm (informativo)" % (f["pct_hamaca"], f["hamaca_max_mm"])
        print("  %-13s %-11s %s" % (k, f["veredicto"], txt))
    print("  %-13s %-11s %s" % ("hipotesis", "", "los sorteos del blando son la hipotesis del 13/10 (cede 0 a 0,6 mm, "
                                "espesor +-0,2), no una medicion"))
    print("  %-13s %-11s %s" % ("limite", "", "rayos verticales: la ubicacion en el PLANO (X, Y, giro en Z) no la mide este gate"))


def _sin_privados(filas):
    return json.loads(json.dumps(filas, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o)))


# =====================================================================================
# calibrar
# =====================================================================================
def calibrar(casos, nombre_escena, workdir_path, n=None, log=print):
    sep, lin = autotest()
    for l_ in lin:
        log("  autotest  %s" % l_)
    if not sep:
        log("AUTOTEST NO SEPARA: el gate no juzga nada.")
        return NO_JUZGA
    e = casos["escenas"][nombre_escena]
    e["_nombre"] = nombre_escena
    U = umbrales()
    tol = casos.get("tolerancias", {})
    tol_v = tol.get("ventana_reproduccion_mm", 0.05)
    w = wd.ensure_workdir(workdir_path)
    cx = Contexto(e, os.path.join(w, "cache"), log)
    nc = n or e["sorteo"]["casos_calibracion"]
    dif, res = [], {}
    for nom, P in e["piezas"].items():
        if "publicado" not in P:
            continue
        log("== %s" % nom)
        malla = cargar_pieza(P["stl"])
        cx.esquinas = P.get("esquinas")
        cx.mano_punta = P.get("mano_punta")
        peor, pv = fila_apoyos(cx, malla, U)
        d = declarado(nom)
        r = {"apoyos": pv[peor]["A1"], "apoyos_declarados": d,
             "no_vistos": sorted({tuple(c) for x in pv.values() for c in x["no_vistos_por_la_simulacion"]})}
        if d is not None and d != pv[peor]["A1"]["apoyos_z"]:
            dif.append("%s: el inventario medido da %d apoyos y casos_3d.json declara %d" % (nom, pv[peor]["A1"]["apoyos_z"], d))
        r["ventana"] = fila_ventana(cx, malla, U)
        vp = P.get("ventana_publicada") or {}
        for k in ("banda", "punta"):
            got = r["ventana"].get("%s_mm" % k)
            if k in vp and (got is None or abs(got - vp[k]) > tol_v):
                dif.append("%s: ventana %s %s mm contra %s publicado (tolerancia %s)" % (nom, k, got, vp[k], tol_v))
        r["sim"] = {}
        for clave, pub in P["publicado"].items():
            if clave.startswith("gemelo_"):
                ng = int(clave.split("_")[1])
                s = correr_sim(cx, malla, e["variantes"][0]["nombre"], e["mano"], ng, gemelo=True)
                r["sim"][clave] = s
                log("  gemelo %d casos: %d %%, maxima %.2f" % (ng, s["pct_hamaca"], s["hamaca_max_mm"]))
                if abs(s["pct_hamaca"] - pub["pct_hamaca"]) > U["reproduccion_tol_pct"] or \
                        abs(s["hamaca_max_mm"] - pub["hamaca_max_mm"]) > U["reproduccion_tol_mm"]:
                    dif.append("%s gemelo: %d %% y %.2f mm contra %d %% y %.2f publicado" % (
                        nom, s["pct_hamaca"], s["hamaca_max_mm"], pub["pct_hamaca"], pub["hamaca_max_mm"]))
                continue
            t0 = time.time()
            s = correr_sim(cx, malla, clave, e["mano"], nc)
            r["sim"][clave] = s
            log("  %s, %d casos: se hamaca en %d de 100 (%.0f s)" % (clave, nc, s["pct_hamaca"], time.time() - t0))
            if abs(s["pct_hamaca"] - pub["pct_hamaca"]) > U["reproduccion_tol_pct"]:
                dif.append("%s %s: %d %% contra %d %% publicado" % (nom, clave, s["pct_hamaca"], pub["pct_hamaca"]))
            if "punta_mediana_mm" in pub:
                sp = correr_sim(cx, malla, clave, cx.mano_punta or e["mano_punta"], nc)
                r["sim"][clave + "_punta"] = sp
                log("  %s apretando en la punta: %.2f mm" % (clave, sp["hamaca_mediana_mm"]))
                if abs(sp["hamaca_mediana_mm"] - pub["punta_mediana_mm"]) > U["reproduccion_tol_mm"]:
                    dif.append("%s punta: %.2f mm contra %.2f publicado" % (nom, sp["hamaca_mediana_mm"], pub["punta_mediana_mm"]))
        # los veredictos esperados de los casos conocidos
        # el asiento se juzga con la MISMA funcion que en verificar (revisor por API del 18/10)
        vars_cal = {k: {"normal": s, "punta": r["sim"].get(k + "_punta")} for k, s in r["sim"].items()
                    if not k.startswith("gemelo") and not k.endswith("_punta")}
        ver = {"apoyos": r["apoyos"]["veredicto"], "ventana": r["ventana"]["veredicto"],
               "asiento": veredicto_asiento(vars_cal, U, e)[0]}
        for k, esp in (P.get("esperado") or {}).items():
            if k in ver and ver[k] != esp:
                dif.append("%s %s: dio %s, se esperaba %s" % (nom, k, ver[k], esp))
        r["veredictos"] = ver
        res[nom] = r
    rep = not dif
    reg = {"_que_es": "Registro de la calibracion del gate de asiento: con ESTA version de las cuentas (firma_nucleo: "
                      "cadlib/asiento.py, gate_asiento.py, eval_casos_3d.py y los umbrales de casos_3d.json), ESTA escena "
                      "(firma_escena) y ESTE panel (panel_firma) la simulacion reprodujo lo publicado de la v14 y la v15. Lo "
                      "escribe 'gate_asiento.py calibrar' con los casos de la escena; 'verificar' no juzga una pieza nueva si "
                      "alguna firma no coincide o si reproduce es false.",
           "fecha": time.strftime("%Y-%m-%d %H:%M"), "firma_nucleo": A.firma_nucleo(), "escena": nombre_escena,
           "firma_escena": A.firma_escena(e), "panel_firma": cx.firma_panel, "casos": nc,
           "semilla": e["sorteo"]["semilla"], "reproduce": rep, "diferencias": dif, "resultados": _sin_privados(res)}
    log("")
    for x in dif:
        log("NO REPRODUCE: %s" % x)
    if nc != e["sorteo"]["casos_calibracion"]:
        # una corrida corta de prueba no pisa el registro commiteado (auditor del 17/10, N3)
        log("CALIBRACION de prueba con %d casos (la escena pide %d): %s. El registro NO se escribe."
            % (nc, e["sorteo"]["casos_calibracion"], "reproduce" if rep else "%d diferencia(s)" % len(dif)))
        return OK if rep else ROJO_
    with open(CALIB, "w", encoding="utf-8") as f:
        json.dump(reg, f, indent=1, ensure_ascii=False)
    log("CALIBRACION: %s (registro en %s)" % ("REPRODUCE lo publicado" if rep else "%d diferencia(s)" % len(dif),
                                            os.path.relpath(CALIB, AQUI)))
    return OK if rep else ROJO_


def calibracion_vigente(nombre_escena=None, escena=None, panel_firma=None):
    """(vigente, mensaje). Compara la firma de las cuentas siempre; si la escena es la calibrada, también la de la escena
    y (si se pasa) la del panel. Otra escena no tiene casos conocidos: se juzga con las cuentas calibradas y se dice."""
    if not os.path.isfile(CALIB):
        return False, "no hay registro de calibracion (correr 'gate_asiento.py calibrar')"
    c = _json(CALIB)
    if not c.get("reproduce"):
        return False, "la ultima calibracion NO reprodujo lo publicado: %s" % c.get("diferencias")
    if c.get("firma_nucleo") != A.firma_nucleo():
        return False, ("las cuentas cambiaron desde la ultima calibracion (cadlib/asiento.py, gate_asiento.py, "
                       "eval_casos_3d.py o los umbrales de casos_3d.json; firma %s, calibrada %s): volver a correr "
                       "'gate_asiento.py calibrar'" % (A.firma_nucleo(), c.get("firma_nucleo")))
    extra = ""
    if nombre_escena and nombre_escena == c.get("escena") and escena is not None:
        if c.get("firma_escena") != A.firma_escena(escena):
            return False, ("la escena '%s' cambio desde la calibracion (firma %s, calibrada %s): volver a calibrar"
                           % (nombre_escena, A.firma_escena(escena), c.get("firma_escena")))
        if panel_firma and c.get("panel_firma") and panel_firma != c.get("panel_firma"):
            return False, "el panel de la escena cambio desde la calibracion (firma %s, calibrada %s)" % (
                panel_firma, c.get("panel_firma"))
    elif nombre_escena:
        extra = ("; la escena '%s' no tiene casos conocidos: se juzga con las cuentas calibradas en '%s'"
                 % (nombre_escena, c.get("escena")))
    return True, "calibrada el %s (firma %s): reprodujo v14 y v15%s" % (c.get("fecha"), c.get("firma_nucleo"), extra)


# =====================================================================================
# verificar
# =====================================================================================
def verificar(casos, nombre_escena, pieza, stl, etiqueta_cli, workdir_path, n, salida, sin_gemelo=False, log=print):
    if nombre_escena not in casos["escenas"]:
        log("[gate_asiento] escena desconocida: %s (hay: %s)" % (nombre_escena, ", ".join(casos["escenas"])))
        return USO
    e = casos["escenas"][nombre_escena]
    e["_nombre"] = nombre_escena
    et, de, conflicto = etiqueta_de(e, etiqueta_cli, workdir_path)
    modo = modo_canon()
    if conflicto:
        log("[gate_asiento] DOS FUENTES NO COINCIDEN (codigo 2) sobre donde apoya la pieza: %s. No se elige una." % conflicto)
        return USO
    if et is None:
        log("[gate_asiento] no se sabe si la pieza apoya sobre blando o sobre rigido: declarar la etiqueta "
            "(apoya-sobre-blando / apoya-sobre-rigido) en el pliego de gate_proceso, en la escena o con --etiqueta")
        return USO
    if et == "rigido":
        log("GATE DE ASIENTO — NO CORRE: la pieza apoya sobre RIGIDO (%s). Lo juzga la interferencia contra el sustrato "
            "rigido (check_collision.py, cad-3d.md)." % de)
        if workdir_path:
            wd.record_evidence(wd.ensure_workdir(workdir_path), "asiento", corre=False, etiqueta=et, origen=de,
                               escena=nombre_escena, pieza=pieza)
        return OK
    log("activacion: apoya sobre BLANDO (%s)" % de)
    sep, lin = autotest()
    for l_ in lin:
        log("  autotest  %s" % l_)
    if not sep:
        log("AUTOTEST NO SEPARA (codigo 3): el gate no juzga nada.")
        return NO_JUZGA
    ok_c, msg_c = calibracion_vigente(nombre_escena, e)
    log("  calibracion %s" % msg_c)
    if not ok_c:
        log("SIN CALIBRAR (codigo 3): no se juzga una pieza nueva con una simulacion que no reprodujo los casos conocidos.")
        return NO_JUZGA
    if not stl:
        P = e.get("piezas", {}).get(pieza)
        if not P or not P.get("stl"):
            log("[gate_asiento] la escena no tiene la pieza '%s' con su stl; pasar --stl" % pieza)
            return USO
        stl = P["stl"]
    if not os.path.isfile(stl):
        log("[gate_asiento] no existe el archivo de la pieza: %s" % stl)
        return USO
    if not workdir_path:
        log("[gate_asiento] falta --workdir (ahi va la cache del panel y la evidencia)")
        return USO
    w = wd.ensure_workdir(workdir_path)
    cx = Contexto(e, os.path.join(w, "cache"), log)
    ok_p, msg_p = calibracion_vigente(nombre_escena, e, cx.firma_panel)
    if not ok_p:
        log("SIN CALIBRAR (codigo 3): %s" % msg_p)
        return NO_JUZGA
    cx.esquinas = (e.get("piezas", {}).get(pieza) or {}).get("esquinas")
    cx.mano_punta = (e.get("piezas", {}).get(pieza) or {}).get("mano_punta")
    malla = cargar_pieza(stl)
    nc = n or e["sorteo"]["casos"]
    filas, fuentes, _ = evaluar(cx, malla, pieza, nc, gemelo=not sin_gemelo, log=log)
    imprimir(filas, "%s / %s (%d casos)" % (nombre_escena, pieza or os.path.basename(stl), nc))
    if fuentes:
        log("\nDOS FUENTES NO COINCIDEN (codigo 2): %s. No se elige una: se mira por que difieren." % fuentes)
        return USO
    vt = veredicto_total(filas)
    aviso = modo.get("modo") == "aviso"
    log("\n%s%s" % (vt, (" — modo AVISO hasta el %s: gate_entregable lo informa (G-E5, tambien cuando corre desde "
                         "export_deliverables --final) y no frena"
                         % modo.get("revisar")) if aviso else ""))
    wd.record_evidence(w, "asiento", corre=True, etiqueta=et, origen=de, escena=nombre_escena, pieza=pieza,
                       pieza_archivo=os.path.abspath(stl), pieza_firma=wd.file_signature(stl), casos=nc,
                       veredicto=vt, filas={k: f.get("veredicto") for k, f in filas.items()}, modo=modo.get("modo"))
    if salida:
        with open(salida, "w", encoding="utf-8") as f:
            json.dump({"pieza": pieza, "stl": stl, "veredicto": vt, "filas": _sin_privados(filas)}, f, indent=1,
                      ensure_ascii=False)
    return OK if vt == "VERDE" else ROJO_


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("autotest", help="el par BIEN/MAL sintetico (corre tambien en cada calibrar/verificar)")
    c = sub.add_parser("calibrar", help="reproducir lo publicado de los casos conocidos y dejar el registro")
    c.add_argument("--casos", default=CASOS)
    c.add_argument("--escena", default="upper_trim_two")
    c.add_argument("--workdir", required=True)
    c.add_argument("--casos-sim", type=int, default=None, help="por defecto los de la escena (150)")
    v = sub.add_parser("verificar", help="juzgar una pieza")
    v.add_argument("--casos", default=CASOS)
    v.add_argument("--escena", required=True)
    v.add_argument("--pieza", default=None, help="nombre de la pieza en la escena (o el que se le da a --stl)")
    v.add_argument("--stl", default=None, help="STL o STEP de la pieza, en el frame de la escena")
    v.add_argument("--etiqueta", choices=sorted(ETIQ), default=None)
    v.add_argument("--workdir", default=None)
    v.add_argument("--casos-sim", type=int, default=None, help="por defecto los de la escena (50)")
    v.add_argument("--salida", default=None)
    v.add_argument("--sin-gemelo", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "autotest":
        sep, lin = autotest()
        for l_ in lin:
            print("  %s" % l_)
        print("AUTOTEST:", "separa" if sep else "NO SEPARA")
        return OK if sep else NO_JUZGA
    casos = _json(a.casos)
    if a.cmd == "calibrar":
        return calibrar(casos, a.escena, a.workdir, a.casos_sim)
    return verificar(casos, a.escena, a.pieza, a.stl, a.etiqueta, a.workdir, a.casos_sim, a.salida, a.sin_gemelo)


if __name__ == "__main__":
    sys.exit(main())

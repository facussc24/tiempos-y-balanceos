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
    """(etiqueta, de dónde salió). Manda --etiqueta; después el pliego de gate_proceso en el workdir; después la escena."""
    if cli:
        return ETIQ.get(cli), "--etiqueta"
    if workdir_path and os.path.isfile(os.path.join(workdir_path, wd.MANIFEST)):
        e = wd.find_evidence(workdir_path, "proceso_declarado")
        tags = set((e or {}).get("tags") or [])
        if "apoya-sobre-blando" in tags:
            return "blando", "pliego de gate_proceso (etiqueta apoya-sobre-blando)"
        if "apoya-sobre-rigido" in tags:
            return "rigido", "pliego de gate_proceso (etiqueta apoya-sobre-rigido)"
    if escena.get("apoya_sobre"):
        return ETIQ.get(escena["apoya_sobre"]), "escena '%s'" % escena.get("_nombre")
    return None, None


# =====================================================================================
# evaluar una pieza
# =====================================================================================
class Contexto(object):
    """El panel de una escena visto desde la pieza: mallas (plástico / plástico + blando) y alturas en las dos grillas."""

    def __init__(self, escena, cache_dir, log=print, mallas=None):
        self.e = escena
        self.esquinas = None                           # las de la pieza, si declara las suyas (ver correr_sim)
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


def fila_apoyos(cx, malla, U):
    e = cx.e
    peor = None
    por_variante = {}
    T = A.alturas_pieza(malla, cx.gr, e)
    Tf = A.alturas_pieza(malla, cx.grf, e)
    for v in e.get("variantes") or [{"nombre": "nominal", "abiertas": []}]:
        H = A.panel_nominal(cx.Hs, cx.Ht, cx.zp, A.en_rects(cx.gr.XY, v["abiertas"]))
        Hf = A.panel_nominal(cx.Hsf, cx.Htf, cx.zpf, A.en_rects(cx.grf.XY, v["abiertas"]))
        ap, _ = A.inventario(Hf, Tf, cx.grf)
        sup = A.superficies(ap, Hf, cx.grf)
        nv = A.no_vistos_por_la_simulacion(ap, cx.grf, H - T, cx.gr)
        elementos = [{"nombre": "apoyo en x %.1f y %.1f" % tuple(a["centro"]), "tipo": "apoyo_z", "rigido": True}
                     for a in ap]
        r1 = ev.a1_apoyos(elementos, U)
        metidos = [a for a in ap if a["metido"]]
        if metidos:
            r1 = dict(r1, veredicto="ROJO", motivo=r1["motivo"] + "; %d metido(s) en el blando hasta %.2f mm: la pieza "
                      "no puede asentar como se diseno" % (len(metidos), -min(a["luz_min_mm"] for a in metidos)))
        r1b = ev.a1b_cuatro_coplanares(elementos, sup, U)
        poligono = np.vstack([cx.grf.XY[a["_idx"]] for a in ap]) if ap else np.zeros((0, 2))
        por_variante[v["nombre"]] = {
            "A1": r1, "A1b": r1b,
            "apoyos": [{k: x for k, x in a.items() if k != "_idx"} for a in ap],
            "no_vistos_por_la_simulacion": [ap[j]["centro"] for j in nv],
            "_poligono": poligono}
        if peor is None or r1["apoyos_z"] > por_variante[peor]["A1"]["apoyos_z"]:
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


def fila_asiento(cx, malla, U, n, poligonos, log=print):
    e = cx.e
    out = {"casos": n, "hipotesis": e["sorteo"].get("_", "")[:200], "variantes": {}}
    malos = []
    for v in e.get("variantes") or [{"nombre": "nominal"}]:
        t0 = time.time()
        s = correr_sim(cx, malla, v["nombre"], e["mano"], n)
        log("  simulacion %s: se hamaca en %d de 100, maxima %.2f mm (%.0f s)"
            % (v["nombre"], s["pct_hamaca"], s["hamaca_max_mm"], time.time() - t0))
        r = {"normal": s}
        if e.get("mano_punta"):
            pol = poligonos.get(v["nombre"])
            dentro = A.adentro_del_poligono(e["mano_punta"], pol) if pol is not None and len(pol) else np.zeros(0, bool)
            if len(dentro) and dentro.all():
                r["punta"] = {"veredicto": "NO APLICA", "motivo": "todos los puntos de la mano 'punta' caen ADENTRO del "
                              "poligono de apoyos: no es la punta (auditor del 17/10, I1). La punta la decide la prueba fisica."}
            else:
                sp = correr_sim(cx, malla, v["nombre"], e["mano_punta"], n)
                r["punta"] = sp
        out["variantes"][v["nombre"]] = r
        if s["pct_hamaca"] > U["hamaca_pct_max"]:
            malos.append("%s: se hamaca > %s mm en %d de 100 (maximo %s)" % (v["nombre"], e["sorteo"].get("hamaca_umbral_mm", 0.3),
                                                                              s["pct_hamaca"], U["hamaca_pct_max"]))
        if s["hamaca_max_mm"] > U["hamaca_max_mm"]:
            malos.append("%s: hamaca maxima %.2f mm (maximo %s)" % (v["nombre"], s["hamaca_max_mm"], U["hamaca_max_mm"]))
        if s["pct_toca_plastico"] > 0:
            malos.append("%s: toca plastico en %d de 100" % (v["nombre"], s["pct_toca_plastico"]))
        p = r.get("punta")
        if isinstance(p, dict) and "hamaca_mediana_mm" in p and p["hamaca_mediana_mm"] > U["punta_mediana_max_mm"]:
            malos.append("%s: apretando en la punta se mueve %.2f mm (maximo %s)" % (v["nombre"], p["hamaca_mediana_mm"],
                                                                                    U["punta_mediana_max_mm"]))
    out["veredicto"] = "ROJO" if malos else "VERDE"
    out["motivo"] = "; ".join(malos) or "dentro de los umbrales"
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
    claves = ("apoyos", "ventana", "asiento")
    vs = [filas[k]["veredicto"] for k in claves if k in filas]
    if "ROJO" in vs:
        return "ROJO"
    if "SIN DATO" in vs:
        return "SIN DATO"
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
                    "; apretando en la punta se mueve %.2f mm" % p["hamaca_mediana_mm"] if p else "")
                partes.append("%s: se hamaca en %d de 100, maxima %.2f mm%s" % (vn, s["pct_hamaca"], s["hamaca_max_mm"], pt))
            txt = " | ".join(partes) + " — " + f["motivo"]
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
                sp = correr_sim(cx, malla, clave, e["mano_punta"], nc)
                r["sim"][clave + "_punta"] = sp
                log("  %s apretando en la punta: %.2f mm" % (clave, sp["hamaca_mediana_mm"]))
                if abs(sp["hamaca_mediana_mm"] - pub["punta_mediana_mm"]) > U["reproduccion_tol_mm"]:
                    dif.append("%s punta: %.2f mm contra %.2f publicado" % (nom, sp["hamaca_mediana_mm"], pub["punta_mediana_mm"]))
        # los veredictos esperados de los casos conocidos
        ver = {"apoyos": r["apoyos"]["veredicto"], "ventana": r["ventana"]["veredicto"],
               "asiento": "ROJO" if any(s["pct_hamaca"] > U["hamaca_pct_max"] for k, s in r["sim"].items()
                                        if not k.startswith("gemelo") and not k.endswith("_punta")) else "VERDE"}
        for k, esp in (P.get("esperado") or {}).items():
            if k in ver and ver[k] != esp:
                dif.append("%s %s: dio %s, se esperaba %s" % (nom, k, ver[k], esp))
        r["veredictos"] = ver
        res[nom] = r
    rep = not dif
    reg = {"_que_es": "Registro de la calibracion del gate de asiento: con ESTA version de cadlib/asiento.py (firma_nucleo) la "
                      "simulacion reprodujo lo publicado de la v14 y la v15. Lo escribe 'gate_asiento.py calibrar'; 'verificar' "
                      "no juzga una pieza nueva si la firma no coincide o si reproduce es false.",
           "fecha": time.strftime("%Y-%m-%d %H:%M"), "firma_nucleo": A.firma_nucleo(), "escena": nombre_escena,
           "panel_firma": cx.firma_panel, "casos": nc, "semilla": e["sorteo"]["semilla"], "reproduce": rep,
           "diferencias": dif, "resultados": _sin_privados(res)}
    with open(CALIB, "w", encoding="utf-8") as f:
        json.dump(reg, f, indent=1, ensure_ascii=False)
    log("")
    for x in dif:
        log("NO REPRODUCE: %s" % x)
    log("CALIBRACION: %s (registro en %s)" % ("REPRODUCE lo publicado" if rep else "%d diferencia(s)" % len(dif),
                                            os.path.relpath(CALIB, AQUI)))
    return OK if rep else ROJO_


def calibracion_vigente():
    if not os.path.isfile(CALIB):
        return False, "no hay registro de calibracion (correr 'gate_asiento.py calibrar')"
    c = _json(CALIB)
    if not c.get("reproduce"):
        return False, "la ultima calibracion NO reprodujo lo publicado: %s" % c.get("diferencias")
    if c.get("firma_nucleo") != A.firma_nucleo():
        return False, ("cadlib/asiento.py o gate_asiento.py cambio desde la ultima calibracion (firma %s, calibrada %s): "
                       "volver a correr 'gate_asiento.py calibrar'" % (A.firma_nucleo(), c.get("firma_nucleo")))
    return True, "calibrada el %s (firma %s): reprodujo v14 y v15" % (c.get("fecha"), c.get("firma_nucleo"))


# =====================================================================================
# verificar
# =====================================================================================
def verificar(casos, nombre_escena, pieza, stl, etiqueta_cli, workdir_path, n, salida, sin_gemelo=False, log=print):
    if nombre_escena not in casos["escenas"]:
        log("[gate_asiento] escena desconocida: %s (hay: %s)" % (nombre_escena, ", ".join(casos["escenas"])))
        return USO
    e = casos["escenas"][nombre_escena]
    e["_nombre"] = nombre_escena
    et, de = etiqueta_de(e, etiqueta_cli, workdir_path)
    modo = modo_canon()
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
    ok_c, msg_c = calibracion_vigente()
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
    cx.esquinas = (e.get("piezas", {}).get(pieza) or {}).get("esquinas")
    malla = cargar_pieza(stl)
    nc = n or e["sorteo"]["casos"]
    filas, fuentes, _ = evaluar(cx, malla, pieza, nc, gemelo=not sin_gemelo, log=log)
    imprimir(filas, "%s / %s (%d casos)" % (nombre_escena, pieza or os.path.basename(stl), nc))
    if fuentes:
        log("\nDOS FUENTES NO COINCIDEN (codigo 2): %s. No se elige una: se mira por que difieren." % fuentes)
        return USO
    vt = veredicto_total(filas)
    aviso = modo.get("modo") == "aviso"
    log("\n%s%s" % (vt, (" — modo AVISO hasta el %s: export_deliverables y gate_entregable lo informan, no frenan"
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

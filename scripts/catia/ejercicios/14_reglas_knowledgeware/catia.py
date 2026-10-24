# -*- coding: utf-8 -*-
"""Ejercicio 14 del banco de CATIA (COLA_CATIA.md, 24/10/2026, CATA): las reglas del banco 3D como CONTROLES ADENTRO de
la pieza (Knowledgeware: parametro + formula + CreateCheck), en VERDE con la pieza buena y en ROJO con sus mutantes.

Dos piezas, una CATPart cada una, en las MISMAS coordenadas que build123d:
  mango (ejercicio 05 del banco, «canto vivo»): barra 100 x 30 x 20 con dos agujeros de 8 y redondeo en dos pasos como el
    05 del juez. El radio de los DOS redondeos sale de un parametro propio «Radio» (formula hacia cada Radius) y su
    encendido de un booleano propio «Redondeado» (formula hacia el Activity de cada redondeo); la regla de la casa es el
    control «Radio >= 1.5mm and Redondeado == true» (umbral de correctores/cantos_convexos.py, R1,5 de la casa).
    Variantes: bien R1,5 (verde); mal_2 R0,5 (rojo); mal_1 sin radio = Redondeado falso con Radio en 1,5 (rojo: un
    redondeo de 0 no existe en CATIA, y apagar los redondeos a mano dejaba el control verde con la pieza mal, revisor
    24/10). Si la instalacion no expone el Activity, se vuelve a apagarlos con Inactivate y Radio 0, y salida.json lo dice.
  nido (ejercicio 04 del banco, «nido con holgura»): bloque 100 x 80 x 25 (z -10 a 15) y bolsillo de 15 cuyo croquis es un
    rectangulo ACOTADO contra los ejes: cada lado a «30mm + Luz» o «20mm + Luz» del eje (parametro propio «Luz»). La
    regla es el control «Luz >= 0.1mm and Luz <= 0.4mm» (los --min/--max por defecto de correctores/holgura_nido.py).
    Variantes: bien luz 0,2 (verde); mal_1 luz 0 (rojo); mal_2 luz 1 (rojo).
Para cada variante se cambia SOLO el parametro, CATIA rehace la pieza y se mide: el volumen y el centro de gravedad
tienen que dar lo del script del banco para esa variante (bien.py, mal_1_*.py, mal_2_*.py, medidos con build123d) y el
control tiene que dar lo que dice el tarea.yaml (verde la buena, rojo cada mutante). Por la trampa de catia.md (un
CreateCheck sobre nombres internos de cotas dio «cumple» siempre), el control va sobre parametros PROPIOS que mueven la
geometria, y el cruce de volumen prueba que de verdad la mueven.

ok = todas las variantes con el volumen del banco (0,5 mm3, 0,01 mm de cdg) Y el control con el resultado esperado.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, un STEP y una captura BMP por pieza (la variante buena).
"""
import importlib.util
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun (scripts/catia o el paquete del obrero)
import juez_comun as jc  # noqa: E402

_spec = importlib.util.spec_from_file_location("ej05_catia", os.path.join(os.path.dirname(AQUI), "05_canto_vivo",
                                                                          "catia.py"))
e05 = importlib.util.module_from_spec(_spec)                      # medidas del mango: las del 05 del juez
_spec.loader.exec_module(e05)

EJ = "05_canto_vivo"                  # correr_ejercicio mide su bien.py (queda aparte); cada variante se mide aca
HORIZ, VERT, DIST = 10, 13, 1         # CatConstraintType (croquis.py de la practica del 19/10)

# variante: (ejercicio del banco, script, valor del parametro, el control tiene que dar)
MANGO = {"mango_bien": ("05_canto_vivo", "bien.py", 1.5, True),
         "mango_mal_2": ("05_canto_vivo", "mal_2_radio_0_5.py", 0.5, False),
         "mango_mal_1": ("05_canto_vivo", "mal_1_sin_radio.py", 0.0, False)}
NIDO = {"nido_bien": ("04_nido_holgura", "bien.py", 0.2, True),
        "nido_mal_1": ("04_nido_holgura", "mal_1_luz_cero.py", 0.0, False),
        "nido_mal_2": ("04_nido_holgura", "mal_2_luz_1mm.py", 1.0, False)}
REGLA_MANGO = "Radio >= 1.5mm and Redondeado == true"
REGLA_MANGO_SOLO_RADIO = "Radio >= 1.5mm"           # si la instalacion no expone el Activity de los redondeos
REGLA_NIDO = "Luz >= 0.1mm and Luz <= 0.4mm"
LP, AP = 60.0, 40.0                   # pieza del 04 (_conjunto.py)
LN, AN, PROF, FONDO = 100.0, 80.0, 15.0, 10.0


# ------------------------------------------------------------------ la cuenta, en Python puro (sin CATIA)
def volumen_nido(luz):
    return LN * AN * (FONDO + PROF) - (LP + 2 * luz) * (AP + 2 * luz) * PROF


def volumen_mango_sin_radio():
    return e05.BL * e05.BA * e05.BE - 2 * math.pi * e05.R_AG ** 2 * e05.BE


def regla_mango(radio, redondeado=True):
    return radio >= 1.5 and redondeado


def regla_nido(luz):
    return 0.1 <= luz <= 0.4


# ------------------------------------------------------------------ CATIA
def actividad(part, feats):
    """El parametro Activity (encendido / apagado) de cada operacion, buscado por su nombre completo
    (…\\<operacion>\\Activity) en part.Parameters. Devuelve los que encuentra, en el orden de feats."""
    ps = part.Parameters
    todos = [ps.Item(i) for i in range(1, ps.Count + 1)]
    out = []
    for f in feats:
        clave = "\\" + str(f.Name) + "\\"
        hallados = [p for p in todos if str(p.Name).endswith("\\Activity") and clave in str(p.Name)]
        if len(hallados) == 1:
            out.append(hallados[0])
    return out


def leer_control(chk):
    return {"diagnosis": bool(chk.Diagnosis), "valor": str(chk.Value)}


def variante(cb, doc, part, body, salida, nombre, param, valor, chk, esperado_ok, antes=None):
    """Cambia el parametro, rehace, mide y lee el control."""
    if antes:
        antes()
    param.Value = valor if isinstance(valor, bool) else float(valor)
    part.Update()
    m = cb.medir(doc, part, body)
    salida["volumen_catia"][nombre], salida["cdg_catia_mm"][nombre] = m.get("volume"), m.get("cdg_mm")
    ctl = leer_control(chk)
    salida["controles"][nombre] = {"parametro": valor, "control_cumple": ctl["diagnosis"], "esperado": esperado_ok,
                                   "regla": ctl["valor"]}
    return {"volumen": m.get("volume"), "control_cumple": ctl["diagnosis"], "esperado": esperado_ok}


def mango(cb, c, reg, salida):
    doc, part, body, sf = cb.nueva_pieza(c, "mango_reglas")
    est = {}
    BL, BA, BE, X_AG, R_AG, TOL = e05.BL, e05.BA, e05.BE, e05.X_AG, e05.R_AG, e05.TOL
    rad0 = MANGO["mango_bien"][2]

    def barra():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), rects=[(-BL / 2, -BA / 2, BL / 2, BA / 2)])
        est["pad"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, BE / 2, BL * BA * BE, simetrico=True)
        return info

    def agujeros():
        est["plano"] = jc.plano_a(part, body, BE / 2)
        sk = jc.croquis(cb, part, body, est["plano"], circulos=[(-X_AG, 0.0, R_AG), (X_AG, 0.0, R_AG)])
        est["pk"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, BE + 5, -2 * math.pi * R_AG ** 2 * BE,
                                               (0.0, 0.0, 0.0), antes=est["m"], vaciado=True)
        return info

    def redondeos():                      # los dos pasos del 05 del juez, con el radio del parametro
        ar = [d for d in cb.topologia(doc, est["pad"], "Edge") if "cdg" in d]
        vert = [d["ref"] for d in ar if abs(abs(d["cdg"][0]) - BL / 2) < TOL and abs(abs(d["cdg"][1]) - BA / 2) < TOL
                and abs(d["cdg"][2]) < TOL]
        if len(vert) != 4:
            raise RuntimeError(f"aristas verticales de las esquinas: {len(vert)} (de {len(ar)} aristas)")
        f1 = sf.AddNewSolidEdgeFilletWithConstantRadius(vert[0], 0, rad0)
        for r_ in vert[1:]:
            f1.AddObjectToFillet(r_)
        part.Update()

        def en_z(feat):
            return [d for d in cb.topologia(doc, feat, "Edge") if "cdg" in d and abs(abs(d["cdg"][2]) - BE / 2) < TOL]

        def al_agujero(d):
            return min(math.dist(d["cdg"][:2], (x, 0.0)) for x in (-X_AG, X_AG))
        contorno = [d["ref"] for d in en_z(f1) if al_agujero(d) > R_AG + rad0] or \
            [d["ref"] for d in en_z(est["pad"]) if al_agujero(d) > R_AG + rad0]
        bordes = [d["ref"] for d in en_z(est["pk"]) if abs(al_agujero(d) - R_AG) < TOL]
        if not contorno or not bordes:
            raise RuntimeError(f"aristas en z +-{BE / 2:g}: contorno {len(contorno)}, bordes de agujero {len(bordes)}")
        f2 = sf.AddNewSolidEdgeFilletWithConstantRadius(contorno[0], 1, rad0)
        for r_ in contorno[1:] + bordes:
            try:
                f2.AddObjectToFillet(r_)
            except Exception:  # noqa: BLE001  (ya tomada por la propagacion)
                pass
        part.Update()
        est["f1"], est["f2"] = f1, f2
        return {"verticales": len(vert), "contorno": len(contorno), "bordes": len(bordes)}

    def reglas():
        est["param"] = part.Parameters.CreateDimension("Radio", "LENGTH", rad0)
        rel = part.Relations
        rel.CreateFormula("radio_paso_1", "", est["f1"].Radius, "Radio")
        rel.CreateFormula("radio_paso_2", "", est["f2"].Radius, "Radio")
        # revisor 24/10: «sin radio» con los redondeos apagados y Radio en 1,5 dejaba el control VERDE con la pieza mal.
        # El encendido de cada redondeo (su parametro Activity) pasa a salir de un booleano propio, y el control lo mira.
        acts = actividad(part, (est["f1"], est["f2"]))
        regla = REGLA_MANGO_SOLO_RADIO
        if len(acts) == 2:
            est["redondeado"] = part.Parameters.CreateBoolean("Redondeado", True)
            for i, a in enumerate(acts, 1):
                rel.CreateFormula(f"activo_paso_{i}", "", a, "Redondeado")
            regla = REGLA_MANGO
        else:
            salida["limite_control_mango"] = (f"no se encontro el parametro Activity de los dos redondeos ({len(acts)}): el "
                                              "control mira solo Radio y el rojo de mango_mal_1 lo pone Radio 0")
        salida["reglas"]["mango"] = regla
        est["chk"] = rel.CreateCheck("redondeo_de_la_casa", "R >= 1,5 en todas las aristas (banco 05)", regla)
        part.Update()
        return {"relaciones": rel.Count, "actividad": [str(a.Name) for a in acts], "control": leer_control(est["chk"])}

    seguir = True
    for que, fn in ((f"mango: barra {BL:g} x {BA:g} x {BE:g} centrada", barra),
                    (f"mango: 2 agujeros de {2 * R_AG:g} pasantes", agujeros),
                    (f"mango: redondeo R{rad0:g} en dos pasos (como el 05)", redondeos),
                    (f"mango: parametro Radio, formula hacia los dos redondeos y control «{REGLA_MANGO}»", reglas)):
        if not reg.paso(que, fn):
            seguir = False
            break
    if not seguir:
        return
    p, ch = est["param"], est["chk"]
    reg.paso("mango_bien: Radio 1,5", lambda: variante(cb, doc, part, body, salida, "mango_bien", p, 1.5, ch, True))
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, "mango_reglas_bien", "mango_bien", ocultos=[est["plano"]])
    reg.paso("mango_mal_2: Radio 0,5", lambda: variante(cb, doc, part, body, salida, "mango_mal_2", p, 0.5, ch, False))

    if "redondeado" in est:                 # Radio vuelve a 1,5: el rojo lo tiene que poner Redondeado = falso
        def radio_bien():
            p.Value = MANGO["mango_bien"][2]
        reg.paso("mango_mal_1: sin radio (Redondeado falso apaga los dos redondeos; Radio queda en 1,5)",
                 lambda: variante(cb, doc, part, body, salida, "mango_mal_1", est["redondeado"], False, ch, False,
                                  antes=radio_bien))
    else:
        def inactivar():
            part.Inactivate(est["f2"])
            part.Inactivate(est["f1"])
        reg.paso("mango_mal_1: sin radio (los dos redondeos inactivos y Radio 0)",
                 lambda: variante(cb, doc, part, body, salida, "mango_mal_1", p, 0.0, ch, False, antes=inactivar))
    try:
        doc.Close()
    except Exception as e:  # noqa: BLE001
        salida.setdefault("documentos_sin_cerrar", {})["mango"] = repr(e)[:200]


def nido(cb, c, reg, salida):
    doc, part, body, sf = cb.nueva_pieza(c, "nido_reglas")
    est = {"planos": []}
    luz0 = NIDO["nido_bien"][2]

    def bloque():
        pl = jc.plano_a(part, body, (PROF - FONDO) / 2)          # z 2,5: el medio de -10 a 15
        est["planos"].append(pl)
        sk = jc.croquis(cb, part, body, pl, rects=[(-LN / 2, -AN / 2, LN / 2, AN / 2)])
        _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, (FONDO + PROF) / 2, LN * AN * (FONDO + PROF),
                                       simetrico=True)
        return info

    def bolsillo():
        est["param"] = part.Parameters.CreateDimension("Luz", "LENGTH", luz0)
        pl = jc.plano_a(part, body, PROF)                         # z 15: la cara de arriba
        est["planos"].append(pl)
        sk = body.Sketches.Add(cb.ref(part, pl))
        f = sk.OpenEdition()
        x, y = LP / 2 + luz0, AP / 2 + luz0
        ps, lineas = cb.poligono(f, [(-x, -y), (x, -y), (x, y), (-x, y)])    # abajo, derecha, arriba, izquierda
        ax = sk.AbsoluteAxis
        H, V = ax.HorizontalReference, ax.VerticalReference
        cs, rel = sk.Constraints, part.Relations
        formulas = []
        for i, (ln, tipo, eje, expr) in enumerate(((lineas[0], HORIZ, H, f"{AP / 2:g}mm + Luz"),
                                                   (lineas[1], VERT, V, f"{LP / 2:g}mm + Luz"),
                                                   (lineas[2], HORIZ, H, f"{AP / 2:g}mm + Luz"),
                                                   (lineas[3], VERT, V, f"{LP / 2:g}mm + Luz"))):
            cs.AddMonoEltCst(tipo, part.CreateReferenceFromObject(ln))
            d = cs.AddBiEltCst(DIST, part.CreateReferenceFromObject(ln), part.CreateReferenceFromObject(eje))
            rel.CreateFormula(f"luz_lado_{i + 1}", "", d.Dimension, expr)
            formulas.append(expr)
        sk.CloseEdition()
        part.Update()
        _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, PROF, -(LP + 2 * luz0) * (AP + 2 * luz0) * PROF,
                                       antes=est["m"], vaciado=True, simetrico=True)
        est["chk"] = rel.CreateCheck("luz_del_nido", "luz por lado entre 0,1 y 0,4 (banco 04)", REGLA_NIDO)
        part.Update()
        info.update({"formulas": formulas, "control": leer_control(est["chk"])})
        return info

    if not reg.paso(f"nido: bloque {LN:g} x {AN:g} x {FONDO + PROF:g} (z -{FONDO:g} a {PROF:g})", bloque):
        return
    if not reg.paso(f"nido: bolsillo de {PROF:g} con el croquis acotado a «{LP / 2:g}mm + Luz» y «{AP / 2:g}mm + Luz» "
                    f"y control «{REGLA_NIDO}»", bolsillo):
        return
    p, ch = est["param"], est["chk"]
    reg.paso("nido_bien: Luz 0,2", lambda: variante(cb, doc, part, body, salida, "nido_bien", p, 0.2, ch, True))
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, "nido_reglas_bien", "nido_bien", ocultos=est["planos"])
    reg.paso("nido_mal_1: Luz 0", lambda: variante(cb, doc, part, body, salida, "nido_mal_1", p, 0.0, ch, False))
    reg.paso("nido_mal_2: Luz 1", lambda: variante(cb, doc, part, body, salida, "nido_mal_2", p, 1.0, ch, False))
    try:
        doc.Close()
    except Exception as e:  # noqa: BLE001
        salida.setdefault("documentos_sin_cerrar", {})["nido"] = repr(e)[:200]


def build123d_de_las_variantes(salida):
    """Cada variante contra el script del banco que la arma: el mango es la unica parte de su STEP; del 04 se toma
    «nido» (su .json nombra las partes pieza y nido)."""
    salida["build123d_bien_05_aparte"] = {"volumen": salida.get("volumen_build123d"),
                                          "cdg_mm": salida.get("cdg_build123d_mm")}
    salida["volumen_build123d"], salida["cdg_build123d_mm"], salida["build123d_variantes"] = {}, {}, {}
    for nombre, (ej, script, _v, _ok) in list(MANGO.items()) + list(NIDO.items()):
        ruta = os.path.join(jc.REPO, "evals", "banco3d", "ejercicios", ej, script)
        b = jc.medir_b123d(["bien", ruta, os.path.join(salida["_carpeta"], "_b123d_" + nombre)])
        partes = b.get("partes") or {}
        clave = "nido" if nombre.startswith("nido") else (next(iter(partes)) if len(partes) == 1 else None)
        if "error" in b or clave not in partes:
            salida["build123d_variantes"][nombre] = {"error": b.get("error") or f"partes {sorted(partes)}"}
            continue
        salida["volumen_build123d"][nombre] = partes[clave].get("volumen")
        salida["cdg_build123d_mm"][nombre] = partes[clave].get("cdg_mm")
        salida["build123d_variantes"][nombre] = {"script": f"{ej}/{script}", "parte": clave, "seg": b.get("seg")}


def construir(cb, c, reg, salida):
    build123d_de_las_variantes(salida)
    salida.update({"reglas": {"mango": REGLA_MANGO, "nido": REGLA_NIDO}, "controles": {},
                   "volumen_cuenta_mm3": {**{k: round(volumen_nido(v[2]), 3) for k, v in NIDO.items()},
                                          "mango_mal_1": round(volumen_mango_sin_radio(), 3)}})
    for pieza in (mango, nido):
        try:                                 # una pieza que falla no frena a la otra
            pieza(cb, c, reg, salida)
        except Exception:  # noqa: BLE001
            reg.pasos.append({"paso": f"{pieza.__name__}: armar", "ok": False, "error": traceback.format_exc()[-600:]})
            print(f"  FALLA {pieza.__name__}: {traceback.format_exc()[-300:]}")


def cerrar_con_controles(carpeta):
    """Despues de correr_ejercicio (ok = cada variante con el volumen del banco): cada control con su resultado."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_cruce_build123d"] = bool(s.get("ok"))
    ctl = s.get("controles") or {}
    problemas = []
    vb, b_var = s.get("volumen_build123d") or {}, s.get("build123d_variantes") or {}
    for nombre, (_e, _s, _v, esperado) in list(MANGO.items()) + list(NIDO.items()):
        if vb.get(nombre) is None or (s.get("diferencia_mm3") or {}).get(nombre) is None:
            # revisor 24/10: comparar() mira solo lo que midio build123d; una variante sin medir pasaba sin cruce
            problemas.append(f"{nombre} sin cruce de build123d: {(b_var.get(nombre) or {}).get('error', 'no se midio')}")
        d = ctl.get(nombre)
        if not d:
            problemas.append(f"{nombre}: el control no se leyo")
        elif d["control_cumple"] is not esperado:
            problemas.append(f"{nombre}: el control dio {'verde' if d['control_cumple'] else 'rojo'} y tenia que dar "
                             f"{'verde' if esperado else 'rojo'}")
    s["controles_como_se_esperaba"] = not problemas
    s["ok"] = s["ok_cruce_build123d"] and not problemas
    if problemas:
        texto = "; ".join(problemas)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_CONTROLES", json.dumps({"ok": s["ok"], "ok_cruce_build123d": s["ok_cruce_build123d"],
                                       "controles": {k: v.get("control_cumple") for k, v in ctl.items()}}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_controles(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar los controles en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

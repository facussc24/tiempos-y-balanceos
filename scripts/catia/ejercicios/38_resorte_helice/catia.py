# -*- coding: utf-8 -*-
"""Ejercicio 38 del banco de CATIA (COLA_CATIA.md, fase 2 segunda tanda, pedido 27 de la principal, 24/10/2026, CATA):
resorte por GSD, circulo R2 barrido por una helice R20, paso 10, alto 50 (5 vueltas): AddNewHelix + plano normal +
AddNewRibFromRef; y el mismo con el perfil inclinado (plano ZX, a 4,55 grados del normal).

Papel: la formula de geometria del volumen de un tubo barrido con el perfil centrado en el camino (area x largo del
camino; el primer momento del perfil respecto del camino es 0): V = pi * 2^2 * 5 * sqrt((2 pi 20)^2 + 10^2) =
7 920,644 mm3; con el perfil plano a un angulo t del plano normal, la seccion normal es la proyeccion del circulo (area x
cos t): V x cos(atan(P / (2 pi R))) = 7 895,684 mm3. El gemelo del control: si el nervio pusiera el perfil normal por su
cuenta, el inclinado daria 7 920,6 (25 mm3 de diferencia, 50 veces la tolerancia).

La pieza la arma pieza_ej45.py (el ej45 de la practica con cambios minimos anotados; el CAMBIO 4 agrega el inclinado). El
juez (cerrar_con_formula): el largo de la helice que mide CATIA contra la cuenta (1e-3 mm), los dos volumenes contra la
formula a TOL_VOL (0,5 mm3, la de juez_comun) y los dos STEP contra CATIA. con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, los dos STEP y las capturas.
"""
import importlib.util
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "38_resorte_helice"
R, P, H, r = 20.0, 10.0, 50.0, 2.0
LARGO = (H / P) * math.sqrt((2 * math.pi * R) ** 2 + P ** 2)                    # 630,3048 mm
ANGULO = math.atan(P / (2 * math.pi * R))                                        # 4,5499 grados
ESPERADO = {"resorte": math.pi * r ** 2 * LARGO,                                 # 7 920,644 mm3
            "resorte_inclinado": math.pi * r ** 2 * LARGO * math.cos(ANGULO)}    # 7 895,684 mm3
TOL_LARGO = 1e-3


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    pieza = cargar("pieza_ej45", os.path.join(AQUI, "pieza_ej45.py"))
    salida["largo_helice_catia"] = {}
    for parte, inclinado in (("resorte", False), ("resorte_inclinado", True)):
        ctx = pieza.cuerpo(c, reg, inclinado)
        doc, part, body = ctx["doc"], ctx["part"], ctx["body"]
        salida["largo_helice_catia"][parte] = ctx.get("largo_helice")
        jc.cerrar_parte(cb, c, reg, salida, doc, part, body, parte, parte)
        try:
            doc.Close()
        except Exception as e:  # noqa: BLE001
            salida.setdefault("documentos_sin_cerrar", []).append(repr(e)[:200])


def cerrar_con_formula(carpeta):
    """Despues de correr_ejercicio (con_bien=False): largo de la helice, los dos volumenes contra la formula y el STEP."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas, juez = [], {"angulo_grados": round(math.degrees(ANGULO), 5), "largo_cuenta": round(LARGO, 4)}
    vs = s.get("volumen_step_catia_en_build123d")
    for parte, esperado in ESPERADO.items():
        vc = (s.get("volumen_catia") or {}).get(parte)
        L = (s.get("largo_helice_catia") or {}).get(parte)
        j = {"esperado": round(esperado, 3), "volumen_catia": vc, "largo_helice": L}
        if not isinstance(L, (int, float)) or not abs(L - LARGO) <= TOL_LARGO:
            problemas.append(f"{parte}: el largo de la helice ({L}) no es la cuenta ({LARGO:.4f})")
        if not isinstance(vc, (int, float)):
            problemas.append(f"{parte}: CATIA no midio la pieza")
        else:
            j["dif_mm3"] = round(vc - esperado, 3)
            if not abs(j["dif_mm3"]) <= jc.TOL_VOL:
                problemas.append(f"{parte}: CATIA {vc} contra la formula {esperado:.3f} mm3")
        v_step = vs.get(parte) if isinstance(vs, dict) else None
        j["volumen_step"] = v_step
        if not isinstance(v_step, (int, float)) or not isinstance(vc, (int, float)) or not abs(v_step - vc) <= jc.TOL_VOL:
            problemas.append(f"{parte}: el STEP ({v_step}) no da el volumen de CATIA ({vc})")
        juez[parte] = j
    # auditor de la tanda de CATA (24/10): una cara suelta en el STEP pasaba (salio de verdad en 54_r1 y 31_final3); el
    # control del 24 y del 49: un solido, una cascara, ninguna cara suelta
    sp = s.get("step_catia_en_build123d")
    for p in tuple(ESPERADO):
        t = sp.get(p) if isinstance(sp, dict) else None
        topo = (t.get("solidos"), t.get("cascaras"), t.get("caras_sueltas")) if isinstance(t, dict) else None
        if topo != (1, 1, 0):
            problemas.append(f"el STEP de {p} no es 1 solido cerrado (solidos, cascaras, caras sueltas: {topo})")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas and not s["error_juez"]   # una excepcion fuera de un paso: nunca verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + problemas)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_FORMULA", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_formula(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar la formula en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

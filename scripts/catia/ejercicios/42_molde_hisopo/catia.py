# -*- coding: utf-8 -*-
"""Ejercicio 42 del banco de CATIA (COLA_CATIA.md, fase 2 segunda tanda, pedido 27 de la principal, 24/10/2026, CATA):
molde de dos mitades de un hisopo de PP. Pieza por revolucion (cabeza D8,6 x 15,4 + cuerpo D3 x 33,3, eje X en el plano
de particion), bloque 68,7 x 30 x 30 centrado en el eje, menos la pieza (cavidad), partido por el plano XY.

Papel: MIT 2.008, examen practico 1 de 2022, problema 2, con solucion
(https://ocw.mit.edu/courses/2-008-design-and-manufacturing-ii-spring-2025/mit2_008_s25_quiz1_prac22_sol.pdf), abierto por
el revisor del 42 (pags. 3 a 5): 70 MPa, maquina de 80 kN, cabeza 15,4 x 8,6 y cuerpo 33,3 x 3 vistos desde la apertura;
A = (0,0154 x 0,0086) + (0,0333 x 0,003) = 0,00023234 m2 (232,34 mm2); F = 7e7 Pa x 0,00023234 m2, que el papel escribe
«16.2 kN» (el producto da 16 264 N); «16.2*5 is just above our 80kN»: caben 4. El juez compara el area MEDIDA con la del
papel (232,34 a 0,01 mm2, que es tambien la cuenta de la geometria), la fuerza que sale de esa area con el producto del
papel (16,264 kN a medio digito; el «16.2» impreso queda informado) y cuantas caben.

La pieza la arma pieza_ej71.py (el ej71 de la practica con cambios minimos anotados). El juez (cerrar_con_papel): el
volumen de la pieza, el bloque y el bloque con la cavidad contra la cuenta (TOL_VOL); las dos mitades iguales, con su suma
igual al bloque con la cavidad, simetricas en z y con UNA cara en z 0 cada una; el area proyectada que sale de MEDIR la
cara de particion de CADA mitad (bloque - cara) contra el papel; la fuerza por pieza y cuantas caben; el centro del
molde contra la cuenta (la cavidad corrida en x o en y no cambia ningun volumen: revisor del 42); y el STEP del bloque con
la cavidad: su volumen contra CATIA, 1 solido sin caras sueltas y el mismo centro. con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP del molde y la captura.
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

EJ = "42_molde_hisopo"
PARTE = "molde_hisopo"
RC, LC, RB, LB = 4.3, 15.4, 1.5, 33.3
BX0, BX1, BY, BZ = -10.0, 58.7, 15.0, 15.0
P_CAIDA, F_MAQ = 70.0, 80.0                          # MPa, kN (enunciado)
V_PIEZA = math.pi * (RC ** 2 * LC + RB ** 2 * LB)     # 1 129,94 mm3
V_BLOQUE = (BX1 - BX0) * 2 * BY * 2 * BZ              # 61 830 mm3
CARA_BLOQUE = 2 * BY * (BX1 - BX0)                    # 2 061 mm2
AREA_CUENTA = 2 * RC * LC + 2 * RB * LB               # 232,34 mm2
PAPEL = {"area_mm2": 232.34, "F_kN": 16.264, "F_impresa_kN": 16.2, "caben": 4}   # MIT 2.008 2022 (ver el docstring)
TOL_AREA = 0.01                                       # mm2
TOL_F = 0.0005                                        # kN, medio digito del 16,264
# centro del molde (bloque menos cabeza y cuerpo, cada uno con su centro sobre el eje X); y = z = 0 por simetria
_VC, _VU = math.pi * RC ** 2 * LC, math.pi * RB ** 2 * LB
CDG_CUENTA = ((V_BLOQUE * (BX0 + BX1) / 2 - _VC * LC / 2 - _VU * (LC + LB / 2)) / (V_BLOQUE - V_PIEZA), 0.0, 0.0)  # 24,5655


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    pieza = cargar("pieza_ej71", os.path.join(AQUI, "pieza_ej71.py"))
    ctx = pieza.cuerpo(c, reg)
    salida["hisopo"] = {k: reg.datos.get(k) for k in ("cuentas", "pieza", "molde", "mitades")}
    jc.cerrar_parte(cb, c, reg, salida, ctx["doc"], ctx["part"], ctx["body"], PARTE, PARTE)
    try:
        ctx["doc"].Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def _num(x):
    return isinstance(x, (int, float)) and x == x               # x == x: un NaN no pasa (revisor del 42)


def _cerca(a, b, tol):
    return _num(a) and _num(b) and abs(a - b) <= tol


def _centro_ok(c, cuenta):
    return isinstance(c, (list, tuple)) and len(c) == 3 and all(_cerca(a, b, jc.TOL_CDG) for a, b in zip(c, cuenta))


def cerrar_con_papel(carpeta, medir=None):
    """Despues de correr_ejercicio (con_bien=False): volumenes, mitades, area proyectada medida, fuerza, centro y STEP."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    problemas = []
    juez = {"papel": PAPEL, "area_cuenta_mm2": round(AREA_CUENTA, 3), "cdg_cuenta_mm": [round(x, 4) for x in CDG_CUENTA]}
    h = s.get("hisopo") or {}
    p, m, mi = h.get("pieza") or {}, h.get("molde") or {}, h.get("mitades") or {}
    for que, valor, cuenta in (("la pieza", p.get("vol"), V_PIEZA), ("el bloque", m.get("bloque"), V_BLOQUE),
                               ("el bloque con la cavidad", m.get("con_cavidad"), V_BLOQUE - V_PIEZA)):
        if not _cerca(valor, cuenta, jc.TOL_VOL):
            problemas.append(f"{que}: {valor} contra la cuenta {cuenta:.3f} mm3")
    m0, m1 = mi.get("0") or {}, mi.get("1") or {}
    if not all(_num(x.get(k)) for x in (m0, m1) for k in ("vol", "cdg_z", "area_particion")):
        problemas.append("las mitades no se midieron")
    else:
        juez.update({"mitades_mm3": [m0["vol"], m1["vol"]], "cdg_z": [m0["cdg_z"], m1["cdg_z"]],
                     "caras_en_z0": [m0.get("caras_en_z0"), m1.get("caras_en_z0")]})
        if not _cerca(m0["vol"], m1["vol"], jc.TOL_VOL):
            problemas.append(f"las mitades no son iguales ({m0['vol']} y {m1['vol']})")
        if not _cerca(m0["vol"] + m1["vol"], m.get("con_cavidad"), jc.TOL_VOL):
            problemas.append("las dos mitades no suman el bloque con la cavidad")
        if not abs(m0["cdg_z"] + m1["cdg_z"]) <= jc.TOL_CDG or m0["cdg_z"] * m1["cdg_z"] >= 0:
            problemas.append(f"las mitades no quedan una de cada lado del plano ({m0['cdg_z']}, {m1['cdg_z']})")
        if juez["caras_en_z0"] != [1, 1]:
            problemas.append(f"cada mitad tiene que tener UNA cara en z 0 ({juez['caras_en_z0']})")
        areas = [CARA_BLOQUE - x["area_particion"] for x in (m0, m1)]          # de las DOS mitades (revisor)
        F = P_CAIDA * areas[0] / 1000
        caben = int(F_MAQ // F) if F > 0 else None
        juez.update({"area_proyectada_medida_mm2": [round(a, 3) for a in areas], "F_por_pieza_kN": round(F, 3),
                     "caben_en_80kN": caben})
        for i, a in enumerate(areas):
            if not _cerca(a, PAPEL["area_mm2"], TOL_AREA):
                problemas.append(f"area proyectada medida en la mitad {i} {a:.3f} contra el papel {PAPEL['area_mm2']} mm2")
        if not _cerca(F, PAPEL["F_kN"], TOL_F):
            problemas.append(f"fuerza por pieza {F:.4f} contra la del papel {PAPEL['F_kN']} kN")
        if caben != PAPEL["caben"]:
            problemas.append(f"caben {caben} contra {PAPEL['caben']} del papel")
    vc = (s.get("volumen_catia") or {}).get(PARTE)
    cc = (s.get("cdg_catia_mm") or {}).get(PARTE)
    vs = s.get("volumen_step_catia_en_build123d")
    v_step = vs.get(PARTE) if isinstance(vs, dict) else None
    juez.update({"volumen_catia": vc, "cdg_catia_mm": cc, "volumen_step": v_step})
    if not _cerca(vc, V_BLOQUE - V_PIEZA, jc.TOL_VOL):
        problemas.append(f"el molde exportado ({vc}) no es el bloque con la cavidad")
    if not _centro_ok(cc, CDG_CUENTA):
        problemas.append(f"el centro del molde en CATIA {cc} no es la cuenta {juez['cdg_cuenta_mm']}: la cavidad se corrio")
    if not _cerca(v_step, vc, jc.TOL_VOL):
        problemas.append(f"el STEP ({v_step}) no da el volumen de CATIA ({vc})")
    b = (medir or jc.medir_b123d)(["step", os.path.join(carpeta, EJ, PARTE + ".stp")])
    bs = next(iter((b.get("partes") or {}).values()), {}) if isinstance(b, dict) and "error" not in b else {}
    juez.update({"step_solidos": bs.get("solidos"), "step_caras_sueltas": bs.get("caras_sueltas"),
                 "step_cascaras": bs.get("cascaras"), "step_cdg_mm": bs.get("cdg_mm")})
    if bs.get("solidos") != 1 or bs.get("caras_sueltas") != 0:
        problemas.append(f"el STEP no es 1 solido cerrado ({bs.get('solidos')} solidos, {bs.get('caras_sueltas')} caras "
                         f"sueltas{'; ' + b['error'] if isinstance(b, dict) and b.get('error') else ''})")
    if not _centro_ok(bs.get("cdg_mm"), CDG_CUENTA):
        problemas.append(f"el centro del STEP {bs.get('cdg_mm')} no es la cuenta {juez['cdg_cuenta_mm']}")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas
    if problemas:
        texto = "; ".join(problemas)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_PAPEL", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_papel(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar el papel en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

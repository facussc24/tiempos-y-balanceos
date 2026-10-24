# -*- coding: utf-8 -*-
r"""Ejercicio 46 del banco de CATIA (COLA_CATIA.md, fase 2 segunda tanda, pedido 27 de la principal, 24/10/2026, CATA):
molde macho de termoformado de una caja de 10 x 12 pulg de planta y 2 de profundidad (254 x 304,8 x 50,8 mm): las caras
formadas (techo + 4 lados) y la huella medidas en CATIA; despues el mismo molde con 4 grados de desmoldeo en los 4 lados.

Papel: RapidMade, 17/11/2025, https://rapidmade.com/draw-ratio-in-thermoforming-how-it-controls-wall-thickness-strength-
and-part-quality/ , segun la ficha E18 del banco de la principal (repo-privado\.sgc-cache\criterio-disenador-2026-10-19\
banco_ejercicios_diseno.md, «ORIGINAL; es un blog de proveedor»): area formada = 2(10x2) + 2(12x2) + 10x12 = 208 pulg2;
huella 120 pulg2; relacion de estirado de area 1,73 (recalculado por el banco: 1,733); chapa de partida = 1,73 x 0,100 =
0,173 pulg con distribucion ideal. La pagina no se abrio desde CATA. Con 4 grados no hay papel: la cuenta exacta del
tronco de piramide (el techo de (A - 2H tan) x (B - 2H tan) y cuatro trapecios de alto H / cos).

La pieza la arma pieza_ej69.py (el ej69 de la practica con cambios minimos anotados). El juez (cerrar_con_papel): sin
desmoldeo, huella y area formada contra el papel a 0,001 pulg2, la relacion contra el 1,73 publicado a medio digito y
contra 208 / 120 a 1e-4, y la chapa contra 0,173 a medio digito; con 4 grados, area y relacion contra la cuenta del
tronco, y la chapa mas fina que sin desmoldeo; en los dos, 4 lados, el volumen de CATIA contra la cuenta (prisma y
prismatoide) y el STEP contra CATIA. con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, los dos STEP y las capturas.
"""
import importlib.util
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
EJERCICIOS = os.path.dirname(AQUI)
sys.path.insert(0, os.path.dirname(EJERCICIOS))                  # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "46_molde_termoformado"
PULG = 25.4
A, B, H, T_FIN = 10 * PULG, 12 * PULG, 2 * PULG, 0.100
ANG = 4.0
PARTE = {0.0: "molde_0", ANG: "molde_4"}
PAPEL = {"formada_pulg2": 208.0, "huella_pulg2": 120.0, "relacion": 1.73, "chapa_pulg": 0.173}
TOL_AREA_PULG2 = 1e-3
TOL_REL = 1e-4                                                  # contra una cuenta exacta
TOL_RELACION_PAPEL, TOL_CHAPA_PAPEL = 0.005, 0.0005             # medio digito de lo publicado


def cuenta(ang):
    """Area formada (mm2), relacion y volumen (mm3) del molde con desmoldeo `ang`: techo + 4 trapecios; prismatoide."""
    t = math.tan(math.radians(ang))
    at, bt = A - 2 * H * t, B - 2 * H * t
    s = H / math.cos(math.radians(ang))
    formada = at * bt + 2 * (A + at) / 2 * s + 2 * (B + bt) / 2 * s
    volumen = H / 6 * (A * B + at * bt + 4 * (A - H * t) * (B - H * t))
    return formada, formada / (A * B), volumen


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    croquis = os.path.join(EJERCICIOS, "24_ttt_angle_bracket")          # croquis.py de la practica vive en el molde
    if croquis not in sys.path:
        sys.path.insert(0, croquis)
    pieza = cargar("pieza_ej69", os.path.join(AQUI, "pieza_ej69.py"))
    ctx = pieza.cuerpo(c, reg)
    salida["molde"] = {f"{k:g}": v for k, v in ctx["res"].items()}
    for ang, (doc, part, body) in ctx["docs"].items():
        jc.cerrar_parte(cb, c, reg, salida, doc, part, body, PARTE[ang], PARTE[ang])
        try:
            doc.Close()
        except Exception as e:  # noqa: BLE001
            salida.setdefault("documentos_sin_cerrar", []).append(repr(e)[:200])


def _num(x):
    return isinstance(x, (int, float)) and x == x               # x == x: un NaN no pasa


def _cerca(a, b, tol):
    return _num(a) and _num(b) and abs(a - b) <= tol


def cerrar_con_papel(carpeta):
    """Despues de correr_ejercicio (con_bien=False): areas, relacion, chapa, volumen y STEP de los dos moldes."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas, juez = [], {"papel": PAPEL}
    molde = s.get("molde") or {}
    vs = s.get("volumen_step_catia_en_build123d")
    for ang in (0.0, ANG):
        m, parte = molde.get(f"{ang:g}") or {}, PARTE[ang]
        fc, rc, vcu = cuenta(ang)
        j = {k: m.get(k) for k in ("huella_pulg2", "formada_pulg2", "relacion", "chapa_partida_pulg", "n_lados")}
        j.update({"cuenta_formada_pulg2": round(fc / PULG ** 2, 3), "cuenta_relacion": round(rc, 5)})
        if m.get("n_lados") != 4:
            problemas.append(f"{ang:g} grados: {m.get('n_lados')} lados medidos, no 4")
        if not _cerca(m.get("huella_pulg2"), PAPEL["huella_pulg2"], TOL_AREA_PULG2):
            problemas.append(f"{ang:g} grados: huella {m.get('huella_pulg2')} contra {PAPEL['huella_pulg2']} pulg2")
        if not _cerca(m.get("formada_pulg2"), fc / PULG ** 2, TOL_AREA_PULG2):
            problemas.append(f"{ang:g} grados: area formada {m.get('formada_pulg2')} contra la cuenta {fc / PULG ** 2:.3f}")
        if not _cerca(m.get("relacion"), rc, TOL_REL):
            problemas.append(f"{ang:g} grados: relacion {m.get('relacion')} contra la cuenta {rc:.4f}")
        if not _cerca(m.get("chapa_partida_pulg"), rc * T_FIN, TOL_REL):       # revisor del 46: la de 4 grados tambien
            problemas.append(f"{ang:g} grados: chapa {m.get('chapa_partida_pulg')} contra la cuenta {rc * T_FIN:.4f} pulg")
        if ang == 0.0:
            if not _cerca(m.get("formada_pulg2"), PAPEL["formada_pulg2"], TOL_AREA_PULG2):
                problemas.append(f"sin desmoldeo: area formada {m.get('formada_pulg2')} contra {PAPEL['formada_pulg2']} del papel")
            if not _cerca(m.get("relacion"), PAPEL["relacion"], TOL_RELACION_PAPEL):
                problemas.append(f"sin desmoldeo: relacion {m.get('relacion')} contra {PAPEL['relacion']} del papel")
            if not _cerca(m.get("chapa_partida_pulg"), PAPEL["chapa_pulg"], TOL_CHAPA_PAPEL):
                problemas.append(f"sin desmoldeo: chapa {m.get('chapa_partida_pulg')} contra {PAPEL['chapa_pulg']} del papel")
        vc = (s.get("volumen_catia") or {}).get(parte)
        v_step = vs.get(parte) if isinstance(vs, dict) else None
        j.update({"volumen_catia": vc, "volumen_cuenta": round(vcu, 3), "volumen_step": v_step})
        if not _cerca(vc, vcu, jc.TOL_VOL):
            problemas.append(f"{ang:g} grados: volumen de CATIA {vc} contra la cuenta {vcu:.3f} mm3")
        if not _cerca(v_step, vc, jc.TOL_VOL):
            problemas.append(f"{ang:g} grados: el STEP ({v_step}) no da el volumen de CATIA ({vc})")
        juez[f"{ang:g}"] = j
    c0, c4 = (molde.get("0") or {}).get("chapa_partida_pulg"), (molde.get("4") or {}).get("chapa_partida_pulg")
    if not (_num(c0) and _num(c4) and c4 < c0):
        problemas.append(f"con desmoldeo la chapa no queda mas fina ({c4} contra {c0})")
    # auditor de la tanda de CATA (24/10): una cara suelta en el STEP pasaba (salio de verdad en 54_r1 y 31_final3); el
    # control del 24 y del 49: un solido, una cascara, ninguna cara suelta
    sp = s.get("step_catia_en_build123d")
    for p in tuple(PARTE.values()):
        t = sp.get(p) if isinstance(sp, dict) else None
        topo = (t.get("solidos"), t.get("cascaras"), t.get("caras_sueltas")) if isinstance(t, dict) else None
        if topo != (1, 1, 0):
            problemas.append(f"el STEP de {p} no es 1 solido cerrado (solidos, cascaras, caras sueltas: {topo})"
                             + ("" if isinstance(sp, dict) else f" ({sp})"[:200]))
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas and not s["error_juez"]   # una excepcion fuera de un paso: nunca verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + problemas)
    if texto:
        s["error"] = texto
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

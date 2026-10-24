# -*- coding: utf-8 -*-
"""Ejercicio 50 del banco de CATIA (COLA_CATIA.md, fase 3 segunda tanda, pedido 29 de la principal, 24/10/2026, CATA):
el gancho de Leo (collar sobre el tope del caño + una cuna de cada lado) rehecho EN CATIA desde sus datos:
pieza_gancho_leo.py lee el params_leo.json de .claude/skills/cad-design/examples/gancho_mochila/.

Respuesta conocida: el STEP que genera `build_gancho_leo.py --out <carpeta>` con ese params (gancho_LEO.step, build123d;
97,34 cm3 segun la fila 50), generado en el post-proceso con .venv-cad (el propio script aborta si el hueco medido en el
solido no es espesor + juego, si sale en mas de un solido o si no apoya en la cama). El juez (cerrar_con_referencia):
compara.py del ejercicio 32 con su mismo criterio (revisar_comparacion: sobra y falta <= 1 mm3, distancia <= 0,01 mm,
volumen, booleana que cierra, un solido de cada lado) y el centro del STEP de CATIA contra el de la referencia a
TOL_CDG. Mismo armado que el 48 (comparar y _max_eje se toman de su catia.py). con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP de CATIA, la referencia y la comparacion.
"""
import importlib.util
import json
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
EJERCICIOS = os.path.dirname(AQUI)
sys.path.insert(0, os.path.dirname(EJERCICIOS))                  # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "50_gancho_leo"
PARTE = "gancho_LEO"
GANCHO = os.path.join(jc.REPO, ".claude", "skills", "cad-design", "examples", "gancho_mochila")
PARAMS, BUILD = os.path.join(GANCHO, "params_leo.json"), os.path.join(GANCHO, "build_gancho_leo.py")
REF_STEP, REF_CUENTAS = "gancho_LEO.step", "cuentas_leo.json"
VOL_FILA_CM3 = 97.34                                            # el de la fila 50 (dato, no decide)


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


E48 = cargar("ej48_catia_50", os.path.join(EJERCICIOS, "48_gancho_mochila", "catia.py"))     # comparar, _max_eje


def construir(cb, c, reg, salida):
    pieza = cargar("pieza_gancho_leo50", os.path.join(AQUI, "pieza_gancho_leo.py"))
    ctx = pieza.cuerpo(c, reg, params=PARAMS)
    salida["cotas"] = ctx.get("cotas")
    jc.cerrar_parte(cb, c, reg, salida, ctx["doc"], ctx["part"], ctx["body"], PARTE, PARTE,
                    ocultos=ctx.get("construccion", []))
    try:
        ctx["doc"].Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def generar_referencia(carpeta, correr=subprocess.run):
    """build_gancho_leo.py --out <carpeta>: la ruta del STEP y cuentas_leo.json, o {"error"}."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", BUILD, "--out", carpeta, "--params", PARAMS], capture_output=True, text=True,
                   timeout=E48.TOPE_S)
    except Exception as ex:  # noqa: BLE001
        return {"error": f"build_gancho_leo.py no corrio: {ex!r}"[:300]}
    step = os.path.join(carpeta, REF_STEP)
    if r.returncode != 0 or not os.path.isfile(step):
        return {"error": f"build_gancho_leo.py salio con {r.returncode}: {(r.stderr or r.stdout or '')[-300:]}"}
    try:
        with open(os.path.join(carpeta, REF_CUENTAS), encoding="utf-8") as f:
            cuentas = json.load(f)
    except (OSError, ValueError) as ex:
        return {"error": f"sin {REF_CUENTAS} de build_gancho_leo.py: {ex!r}"[:300]}
    return {"step": step, "cuentas": cuentas}


def cerrar_con_referencia(carpeta, referencia=None, comparar_con=None, medir=None):
    """Despues de correr_ejercicio (con_bien=False): el STEP de CATIA contra el que genera build_gancho_leo.py."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas, juez = [], {"volumen_fila_cm3": VOL_FILA_CM3}
    ref = (referencia or generar_referencia)(os.path.join(carpeta, "referencia"))
    paso = os.path.join(carpeta, EJ, PARTE + ".stp")
    if "error" in ref:
        problemas.append(ref["error"])
    elif not os.path.isfile(paso) and comparar_con is None:
        problemas.append("CATIA no dejo el STEP")
    else:
        e32 = cargar("ej32_catia_50", os.path.join(EJERCICIOS, "32_virolador_v16", "catia.py"))
        try:
            d = (comparar_con or E48.comparar)(paso, ref["step"])
        except Exception as e:  # noqa: BLE001
            d = None
            problemas.append(f"no se pudo comparar: {e!r}"[:400])
        if d is not None:
            s["contra_la_referencia"] = d
            problemas += e32.revisar_comparacion(d)
        juez["volumen_referencia_cm3"] = (ref.get("cuentas") or {}).get("volumen_cm3")
        b = (medir or jc.medir_b123d)(["step", ref["step"]])
        rb = next(iter((b.get("partes") or {}).values()), {}) if isinstance(b, dict) and "error" not in b else {}
        st = s.get("step_catia_en_build123d")
        st = st.get(PARTE) if isinstance(st, dict) else {}
        juez["dif_cdg_mm"] = E48._max_eje((st or {}).get("cdg_mm"), rb.get("cdg_mm"))
        if not juez["dif_cdg_mm"] <= jc.TOL_CDG:
            problemas.append(f"el centro del STEP de CATIA {(st or {}).get('cdg_mm')} no es el de la referencia "
                             f"{rb.get('cdg_mm')}")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas and not s["error_juez"]   # una excepcion fuera de un paso: nunca verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + problemas)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_REFERENCIA", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez,
                                        "contra_la_referencia": s.get("contra_la_referencia")}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_referencia(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar contra la referencia:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

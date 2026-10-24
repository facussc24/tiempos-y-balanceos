# -*- coding: utf-8 -*-
"""Ejercicio 48 del banco de CATIA (COLA_CATIA.md, fase 3 segunda tanda, pedido 29 de la principal, 24/10/2026, CATA):
el gancho para colgar la mochila de la pata del escritorio (mordaza auto-trabante, v2) rehecho EN CATIA desde sus datos:
pieza_gancho.py lee el params.json de .claude/skills/cad-design/examples/gancho_mochila/ y hace las mismas operaciones,
en el mismo orden, que build_gancho.py.

Respuesta conocida: el STEP que genera `build_gancho.py --out <carpeta>` con ese params.json (gancho_mochila_v2.step,
build123d; 40,51 cm3 el 24/10), generado en el post-proceso con .venv-cad. El juez (cerrar_con_referencia):
compara.py del ejercicio 32 (el STEP de CATIA contra el de build123d: lo que sobra y lo que falta con booleanas, la
distancia maxima en los dos sentidos) con su mismo criterio (revisar_comparacion del 32: sobra y falta <= 1 mm3,
distancia <= 0,01 mm, volumen, booleana que cierra, un solido de cada lado); el centro del STEP de CATIA contra el de la
referencia a TOL_CDG; y lo que build_gancho.py exige del diseno (cuentas.json: a/L >= 1/(2 mu)). con_bien=False.

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

EJ = "48_gancho_mochila"
PARTE = "gancho_mochila_v2"
# jc.REPO y no la carpeta de este archivo: el paquete del obrero no trae la skill (leccion del 35)
GANCHO = os.path.join(jc.REPO, ".claude", "skills", "cad-design", "examples", "gancho_mochila")
PARAMS, BUILD = os.path.join(GANCHO, "params.json"), os.path.join(GANCHO, "build_gancho.py")
REF_STEP = "gancho_mochila_v2.step"
TOPE_S = 900


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    pieza = cargar("pieza_gancho48", os.path.join(AQUI, "pieza_gancho.py"))
    ctx = pieza.cuerpo(c, reg, params=PARAMS)
    salida["cotas"] = ctx.get("cotas")
    jc.cerrar_parte(cb, c, reg, salida, ctx["doc"], ctx["part"], ctx["body"], PARTE, PARTE,
                    ocultos=ctx.get("construccion", []))
    try:
        ctx["doc"].Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def _correr(args, tope=TOPE_S, correr=subprocess.run):
    r = correr([jc.VENV_CAD, "-I"] + list(args), capture_output=True, text=True, timeout=tope)
    return r


def generar_referencia(carpeta, correr=subprocess.run):
    """build_gancho.py --out <carpeta>: devuelve la ruta del STEP y cuentas.json, o {"error"}."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = _correr([BUILD, "--out", carpeta, "--params", PARAMS], correr=correr)
    except Exception as ex:  # noqa: BLE001
        return {"error": f"build_gancho.py no corrio: {ex!r}"[:300]}
    step = os.path.join(carpeta, REF_STEP)
    if r.returncode != 0 or not os.path.isfile(step):
        return {"error": f"build_gancho.py salio con {r.returncode}: {(r.stderr or r.stdout or '')[-300:]}"}
    try:
        with open(os.path.join(carpeta, "cuentas.json"), encoding="utf-8") as f:
            cuentas = json.load(f)
    except (OSError, ValueError) as ex:
        return {"error": f"sin cuentas.json de build_gancho.py: {ex!r}"[:300]}
    return {"step": step, "cuentas": cuentas}


def comparar(a, b, correr=subprocess.run):
    """compara.py del 32 con .venv-cad: el dict que imprime, o una excepcion con el porque."""
    r = _correr([os.path.join(EJERCICIOS, "32_virolador_v16", "compara.py"), a, b], correr=correr)
    lineas = [x for x in (r.stdout or "").strip().splitlines() if x.startswith("{")]
    if not lineas:
        raise RuntimeError(f"compara.py salio con {r.returncode}: {(r.stderr or r.stdout or '')[-300:]}")
    return json.loads(lineas[-1])


def _max_eje(a, b):
    """El mayor de los tres ejes entre dos centros; infinito si falta uno o hay un NaN."""
    try:
        difs = [abs(float(x) - float(y)) for x, y in zip(a, b)] if len(a) == 3 and len(b) == 3 else []
    except (TypeError, ValueError):
        difs = []
    return float("inf") if len(difs) != 3 or any(d != d for d in difs) else round(max(difs), 4)


def cerrar_con_referencia(carpeta, referencia=None, comparar_con=None, medir=None):
    """Despues de correr_ejercicio (con_bien=False): el STEP de CATIA contra el que genera build_gancho.py."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas, juez = [], {}
    ref = (referencia or generar_referencia)(os.path.join(carpeta, "referencia"))
    paso = os.path.join(carpeta, EJ, PARTE + ".stp")
    if "error" in ref:
        problemas.append(ref["error"])
    elif not os.path.isfile(paso) and comparar_con is None:
        problemas.append("CATIA no dejo el STEP")
    else:
        e32 = cargar("ej32_catia_48", os.path.join(EJERCICIOS, "32_virolador_v16", "catia.py"))
        try:
            d = (comparar_con or comparar)(paso, ref["step"])
        except Exception as e:  # noqa: BLE001
            d = None
            problemas.append(f"no se pudo comparar: {e!r}"[:400])
        if d is not None:
            s["contra_la_referencia"] = d
            problemas += e32.revisar_comparacion(d)
        cu = ref.get("cuentas") or {}
        juez.update({"a_sobre_L": cu.get("a_sobre_L"), "exigido": cu.get("exigido_1_sobre_2mu"),
                     "volumen_referencia_cm3": cu.get("volumen_gancho_cm3")})
        if not (isinstance(cu.get("a_sobre_L"), (int, float)) and isinstance(cu.get("exigido_1_sobre_2mu"), (int, float))
                and cu["a_sobre_L"] >= cu["exigido_1_sobre_2mu"]):
            problemas.append(f"el diseno no cumple a/L >= 1/(2 mu) ({cu.get('a_sobre_L')}, {cu.get('exigido_1_sobre_2mu')})")
        b = (medir or jc.medir_b123d)(["step", ref["step"]])
        rb = next(iter((b.get("partes") or {}).values()), {}) if isinstance(b, dict) and "error" not in b else {}
        st = s.get("step_catia_en_build123d")
        st = st.get(PARTE) if isinstance(st, dict) else {}
        juez["dif_cdg_mm"] = _max_eje((st or {}).get("cdg_mm"), rb.get("cdg_mm"))
        if not juez["dif_cdg_mm"] <= jc.TOL_CDG:
            problemas.append(f"el centro del STEP de CATIA {(st or {}).get('cdg_mm')} no es el de la referencia "
                             f"{rb.get('cdg_mm')}")
    # auditor de la tanda de CATA (24/10): una cara suelta en el STEP pasaba (salio de verdad en 54_r1 y 31_final3); el
    # control del 24 y del 49: un solido, una cascara, ninguna cara suelta
    sp = s.get("step_catia_en_build123d")
    for p in (PARTE,):
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

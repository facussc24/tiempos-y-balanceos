# -*- coding: utf-8 -*-
"""Ejercicio 59 del banco de CATIA (fila 59 de COLA_CATIA.md, «PEDIDO PARA CATA 16» de la principal, 24/10/2026, CATA): caja 120 x 80 x 50 desde (0, 0, 0) vaciada con AddNewShell, pared 3 hacia adentro y la cara de arriba
sacada. La pieza la arma pieza_shell.py.

Respuesta conocida: la cuenta, 120 x 80 x 50 - 114 x 74 x 47 = 83 508 mm3 exacto, y el centro (60; 40; 17,8781): en z,
(480 000 x 25 - 396 492 x 26,5) / 83 508. La forma, contra la caja menos la caja interior puesta a mano (gemelo_caja.py,
SIN la cascara de build123d: la referencia se arma sin la operacion que se prueba, leccion del 56).

El juez (cerrar_con_referencia): volumen y centro de CATIA contra la cuenta (TOL_VOL, TOL_CDG por eje); el STEP de CATIA
con un solido y sin caras sueltas, y con las mismas caras que el gemelo (11: fondo, 4 lados de afuera, 4 de adentro, el
piso de adentro y el borde de arriba); contra el STEP del gemelo, compara.py del 32 (revisar_comparacion y las dos
distancias exactas <= 0,01); y lo que saco la cascara: lo de adentro de la caja (114 x 74 x 47) con su centro en z 26,5.
con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP de CATIA, el del gemelo y la comparacion.
"""
import importlib.util
import json
import math
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
EJERCICIOS = os.path.dirname(AQUI)
sys.path.insert(0, os.path.dirname(EJERCICIOS))                  # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "59_caja_vaciada"
PARTE = "caja_vaciada"
A, B, C, T = 120.0, 80.0, 50.0, 3.0
V_CAJA = A * B * C
V_ADENTRO = (A - 2 * T) * (B - 2 * T) * (C - T)                 # 114 x 74 x 47 = 396 492
V_CUENTA = V_CAJA - V_ADENTRO                                   # 83 508
CDG = [A / 2, B / 2, (V_CAJA * C / 2 - V_ADENTRO * (T + (C - T) / 2)) / V_CUENTA]     # z 17,8781
Z_ADENTRO = T + (C - T) / 2                                     # 26,5: el centro de lo que saca la cascara
CARAS = 11
TOL_Z_SACADO = 0.01


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    pieza = cargar("pieza_shell", os.path.join(AQUI, "pieza_shell.py"))
    ctx = pieza.cuerpo(c, reg)
    salida["cascara"] = ctx.get("cascara")
    jc.cerrar_parte(cb, c, reg, salida, ctx["doc"], ctx["part"], ctx["body"], PARTE, PARTE)
    try:
        ctx["doc"].Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def gemelo(carpeta, paso, correr=subprocess.run):
    """gemelo_caja.py con .venv-cad: el STEP de la caja menos la caja interior y las caras del STEP de CATIA."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", os.path.join(AQUI, "gemelo_caja.py"), carpeta, paso], capture_output=True,
                   text=True, timeout=600)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:  # noqa: BLE001
        return {"error": f"gemelo_caja.py no corrio: {ex!r}"[:300]}


def _num(x):
    return isinstance(x, (int, float)) and math.isfinite(x)


def _centro_cerca(c, e, tol):
    """Eje por eje (un max() deja pasar un NaN al final)."""
    return (isinstance(c, (list, tuple)) and len(c) == 3 and isinstance(e, (list, tuple)) and len(e) == 3
            and all(_num(a) and _num(b) and abs(a - b) <= tol for a, b in zip(c, e)))


def cerrar_con_referencia(carpeta, gemelo_con=None, comparar_con=None):
    """Despues de correr_ejercicio (con_bien=False): cuenta, lo sacado, caras y forma contra el gemelo."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas = []
    vc = (s.get("volumen_catia") or {}).get(PARTE)
    cc = (s.get("cdg_catia_mm") or {}).get(PARTE)
    st = s.get("step_catia_en_build123d")      # sin .venv-cad juez_comun deja un texto (revisor del 59): rojo con motivo
    st = st.get(PARTE) if isinstance(st, dict) else {"error": st}
    st = st if isinstance(st, dict) else {}
    cas = s.get("cascara") or {}
    juez = {"cuenta_mm3": V_CUENTA, "cuenta_cdg_mm": [round(x, 4) for x in CDG], "catia_mm3": vc, "catia_cdg_mm": cc,
            "saca": cas.get("saca"), "z_de_lo_sacado": cas.get("z_de_lo_sacado")}
    if not (_num(vc) and abs(vc - V_CUENTA) <= jc.TOL_VOL):
        problemas.append(f"volumen de CATIA {vc} contra la cuenta {V_CUENTA:g} mm3")
    if not _centro_cerca(cc, CDG, jc.TOL_CDG):
        problemas.append(f"centro de CATIA {cc} contra la cuenta {[round(x, 4) for x in CDG]}")
    if not (_num(cas.get("saca")) and abs(cas["saca"] - V_ADENTRO) <= jc.TOL_VOL):
        problemas.append(f"la cascara saco {cas.get('saca')} mm3 y lo de adentro son {V_ADENTRO:g}")
    if not (_num(cas.get("z_de_lo_sacado")) and abs(cas["z_de_lo_sacado"] - Z_ADENTRO) <= TOL_Z_SACADO):
        problemas.append(f"lo que saco la cascara tiene el centro en z {cas.get('z_de_lo_sacado')}, no {Z_ADENTRO}")
    if st.get("solidos") != 1 or st.get("caras_sueltas") != 0:
        problemas.append(f"el STEP de CATIA tiene {st.get('solidos')} solidos y {st.get('caras_sueltas')} caras sueltas"
                         + (f" ({st['error']})"[:200] if st.get("error") else ""))
    if not _centro_cerca(st.get("cdg_mm"), CDG, jc.TOL_CDG):
        problemas.append(f"el centro del STEP de CATIA {st.get('cdg_mm')} contra la cuenta")
    paso = os.path.join(carpeta, EJ, PARTE + ".stp")
    g = (gemelo_con or gemelo)(os.path.join(carpeta, "gemelo"), paso)
    s["gemelo"] = g
    if "error" in g:
        problemas.append(g["error"])
    else:
        ge, ca = g.get("gemelo") or {}, g.get("catia") or {}
        juez.update({"gemelo_mm3": ge.get("volumen"), "caras_gemelo": ge.get("caras"), "caras_catia": ca.get("caras")})
        if not (_num(ge.get("volumen")) and abs(ge["volumen"] - V_CUENTA) <= jc.TOL_VOL and ge.get("solidos") == 1):
            problemas.append(f"el gemelo da {ge.get('volumen')} mm3 y {ge.get('solidos')} solidos (la cuenta {V_CUENTA:g})")
        if not (ca.get("caras") == ge.get("caras") == CARAS):
            problemas.append(f"el STEP de CATIA tiene {ca.get('caras')} caras y el gemelo {ge.get('caras')} (son {CARAS})")
        e48 = cargar("ej48_catia_59", os.path.join(EJERCICIOS, "48_gancho_mochila", "catia.py"))
        e32 = cargar("ej32_catia_59", os.path.join(EJERCICIOS, "32_virolador_v16", "catia.py"))
        try:
            d = (comparar_con or e48.comparar)(paso, ge.get("step"))
        except Exception as e:  # noqa: BLE001
            d = None
            problemas.append(f"no se pudo comparar: {e!r}"[:400])
        if d is not None:
            s["contra_el_gemelo"] = d
            problemas += e32.revisar_comparacion(d)
            ex = [d.get(k) for k in ("dist_max_exacta_A_a_B", "dist_max_exacta_B_a_A")]
            if not all(_num(x) and x <= e32.TOL_DIST_MM for x in ex):
                problemas.append(f"distancia exacta {ex[0]} / {ex[1]} mm (tiene que ser <= {e32.TOL_DIST_MM})")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas and not s["error_juez"]   # una excepcion fuera de un paso: nunca verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + problemas)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_REFERENCIA", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez,
                                        "contra_el_gemelo": s.get("contra_el_gemelo")}))
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

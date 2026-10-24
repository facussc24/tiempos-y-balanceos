# -*- coding: utf-8 -*-
r"""Ejercicio 44 del banco de CATIA (COLA_CATIA.md, fase 2 segunda tanda, pedido 27 de la principal, 24/10/2026, CATA):
perno diamante. El perno es el circulo d cortado por la franja de ancho W (x entre -W/2 y W/2), en el mismo CATPart que
una placa 100 x 100 con el agujero D; choque exacto con el agujero corrido 0 / 0,15 / 0,20 y el gemelo redondo.

Papel: P. H. Joshi, «Jigs and Fixtures», ejemplo 2.1 (pag. 32; ecuacion 2.1, pags. 32-34 y 40), segun el informe de la
principal repo-privado\.sgc-cache\criterio-disenador-2026-10-19\frente1_dispositivos.md: la formula en la fila Ub10
(«ABIERTA ... recalculada: el ej. 2.1 da 55,538») y los datos en el parrafo «Reserva» del final de la seccion E6
(«Joshi p. 32, ejemplo 2.1»): agujero de 55,55 minimo, distancia entre centros 45 +/- 0,15 (V = 0,15), franja W = 2:
d = 2 raiz(D^2/4 - V W - V^2) = 55,538. El 55,538 es el RECALCULO de la principal, no una cifra leida del libro, que no
se abrio desde CATA.

La pieza la arma pieza_ej67.py (el ej67 de la practica con cambios minimos anotados) y el control es choque_perno.py (su
cadena CONTROL, sin cambios). El juez (cerrar_con_papel): d contra el 55,538 de la ficha a medio digito; el perno de CATIA
contra su cuenta a TOL_PERNO (0,05 mm3: un perno con las puntas planas en vez de los arcos pesa 0,48 menos y pasaba con
el 0,5 de TOL_VOL, revisor del 44) y la placa a TOL_VOL; el STEP con DOS solidos y sus volumenes contra CATIA; y el
choque, con el veredicto de la practica: con el agujero en su lugar el diamante da 0 exacto, corrido 0,15 (lo que permite
la tolerancia de la distancia) menos de 1e-3 mm3, corrido 0,20 SI choca, y el gemelo redondo del mismo d corrido 0,15 SI
choca (por eso existe el diamante). con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP (perno y placa) y la captura.
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

EJ = "44_perno_diamante"
PARTE = "perno_diamante"
D, V, W, ESP = 55.55, 0.15, 2.0, 10.0
d = 2 * math.sqrt(D ** 2 / 4 - V * W - V ** 2)                  # 55,5384
D_FICHA = 55.538                                                # recalculado por la principal (ver el docstring)
TOL_D = 5e-4                                                    # medio digito
TOL_PERNO = 0.05                                                # mm3 (CATIA da 0,0004 de la cuenta)
R = d / 2
YC = math.sqrt(R ** 2 - (W / 2) ** 2)
V_PERNO = 2 * (W / 2 * YC + R ** 2 * math.asin(W / 2 / R)) * ESP
V_PLACA = (100 * 100 - math.pi * D ** 2 / 4) * ESP
SIN_CHOQUE = 1e-3                                               # mm3, la cota de la practica


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def construir(cb, c, reg, salida):
    croquis = os.path.join(EJERCICIOS, "24_ttt_angle_bracket")          # croquis.py de la practica vive en el molde
    if croquis not in sys.path:
        sys.path.insert(0, croquis)
    pieza = cargar("pieza_ej67", os.path.join(AQUI, "pieza_ej67.py"))
    ctx = pieza.cuerpo(c, reg)
    salida["perno"] = {k: reg.datos.get(k) for k in ("cuenta", "perno", "placa")}
    jc.cerrar_parte(cb, c, reg, salida, ctx["doc"], ctx["part"], ctx["body"], PARTE, PARTE)
    try:
        ctx["doc"].Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def correr_choque(step, correr=subprocess.run):
    """choque_perno.py con .venv-cad: {vol_perno, vol_placa, diamante_corrido_*, redondo_corrido_0.15} o {"error"}."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", os.path.join(AQUI, "choque_perno.py"), step, repr(d)], capture_output=True,
                   text=True, timeout=600)
    except Exception as ex:  # noqa: BLE001
        return {"error": f"choque_perno.py no corrio: {ex!r}"[:300]}
    lineas = [x for x in (r.stdout or "").splitlines() if x.startswith("{")]
    if not lineas:                                  # se conserva el porque (revisor del 44: se perdia en un IndexError)
        return {"error": f"choque_perno.py no dio JSON: {(r.stderr or '')[-300:]}"}
    try:
        return json.loads(lineas[-1])
    except ValueError as ex:
        return {"error": f"choque_perno.py dio un JSON roto: {ex!r}"[:300]}


def _num(x):
    return isinstance(x, (int, float)) and x == x               # x == x: un NaN no pasa


def cerrar_con_papel(carpeta, choque=None, medir=None):
    """Despues de correr_ejercicio (con_bien=False): d, volumenes, STEP y el choque contra el papel."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas = []
    juez = {"d_mm": round(d, 4), "ficha_mm": D_FICHA, "perno_cuenta": round(V_PERNO, 3),
            "placa_cuenta": round(V_PLACA, 3)}
    if not abs(d - D_FICHA) <= TOL_D:
        problemas.append(f"d = {d:.4f} no es el {D_FICHA} de la ficha")
    p = s.get("perno") or {}
    vp, vq = (p.get("perno") or {}).get("vol"), (p.get("placa") or {}).get("vol")
    for que, v, cuenta, tol in (("el perno", vp, V_PERNO, TOL_PERNO), ("la placa", vq, V_PLACA, jc.TOL_VOL)):
        if not _num(v) or not abs(v - cuenta) <= tol:
            problemas.append(f"{que} de CATIA ({v}) contra la cuenta {cuenta:.3f} mm3")
    step = os.path.join(carpeta, EJ, PARTE + ".stp")
    b = (medir or jc.medir_b123d)(["step", step])
    bs = next(iter((b.get("partes") or {}).values()), {}) if isinstance(b, dict) and "error" not in b else {}
    juez["step_solidos"] = bs.get("solidos")
    if bs.get("solidos") != 2 or bs.get("caras_sueltas") != 0:          # el perno y la placa, nada mas (revisor)
        problemas.append(f"el STEP tiene que traer 2 solidos (el perno y la placa): {bs.get('solidos')} solidos, "
                         f"{bs.get('caras_sueltas')} caras sueltas")
    ch = (choque or correr_choque)(step)
    s["choque"] = ch
    if "error" in ch:
        problemas.append(ch["error"])
    else:
        for que, k, v in (("el perno", "vol_perno", vp), ("la placa", "vol_placa", vq)):
            if not _num(ch.get(k)) or not _num(v) or not abs(ch[k] - v) <= jc.TOL_VOL:
                problemas.append(f"el STEP no trae {que} de CATIA ({ch.get(k)} contra {v})")
        c0, c15, c20, red = (ch.get(k) for k in ("diamante_corrido_0", "diamante_corrido_0.15", "diamante_corrido_0.20",
                                                 "redondo_corrido_0.15"))
        juez.update({"choque_0": c0, "choque_0_15": c15, "choque_0_20": c20, "redondo_0_15": red})
        if not (_num(c0) and c0 == 0.0 and _num(c15) and c15 < SIN_CHOQUE):        # el veredicto de la practica
            problemas.append(f"el diamante choca con el agujero en su lugar o corrido 0,15 ({c0}, {c15} mm3)")
        if not (_num(c20) and c20 > SIN_CHOQUE):
            problemas.append(f"corrido 0,20 el diamante no choca ({c20} mm3): el control no ve el borde")
        if not (_num(red) and red > SIN_CHOQUE):
            problemas.append(f"el perno redondo corrido 0,15 no choca ({red} mm3): el gemelo no separa")
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

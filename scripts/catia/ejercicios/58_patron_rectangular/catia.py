# -*- coding: utf-8 -*-
"""Ejercicio 58 del banco de CATIA (24/10/2026, operaciones que el banco no tenia): PATRON RECTANGULAR. Placa 200 x 120 x 6
desde (0, 0, 0) con UN agujero D10 pasante en (25, 20) y AddNewRectPattern de 4 x 3 a paso 40 (X) y 35 (Y), como una
plantilla de perforado.

El metodo es el de la practica del 19/10 (dbg_rect.py, NOTAS «Patrones y espejo»): las direcciones son aristas de la placa
y el sentido de cada una NO se sabe de antemano; una copia que cae afuera de la pieza no da error, no saca material. Se
prueban las 4 combinaciones de FirstOrientation / SecondOrientation y queda la que saca los 12 agujeros con su centro.

Respuesta conocida (cuenta): 200 x 120 x 6 - 12 pi 5^2 6 = 138 345,133 mm3; centro (100,6131; 60,2044; 3).
ok = los pasos sin falla y sin error del juez Y el volumen y el centro de CATIA contra la cuenta (tol_volumen, 0,01 mm) Y
el STEP de CATIA 1/1/0 con lo mismo Y los ejes de las caras cilindricas de R5 del STEP en las 12 posiciones Y la FORMA: el STEP de CATIA contra la placa
menos 12 cilindros puestos uno por uno, SIN patron (gemelo_placa.py; la referencia se arma sin la operacion que se prueba,
leccion del 56), con compara.py del 32 (sobra y falta <= 1 mm3, distancias exactas <= 0,01 mm).
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, la CATPart, el STEP y la captura.
"""
import json
import math
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y practica_en_juez
import juez_comun as jc  # noqa: E402
import practica_en_juez as pj  # noqa: E402

EJ = "58_patron_rectangular"
PARTE = "placa"
TOL_CDG_MM = 0.01
A, B, ESP, R = 200.0, 120.0, 6.0, 5.0
X0, Y0, NX, NY, PX, PY = 25.0, 20.0, 4, 3, 40.0, 35.0


def agujeros():
    return [(X0 + PX * i, Y0 + PY * j) for i in range(NX) for j in range(NY)]


def cuenta():
    """(volumen, centro) exactos de la placa con los 12 agujeros."""
    vp, va = A * B * ESP, math.pi * R * R * ESP
    hs = agujeros()
    v = vp - len(hs) * va
    return v, [(vp * A / 2 - va * sum(x for x, _ in hs)) / v, (vp * B / 2 - va * sum(y for _, y in hs)) / v, ESP / 2]


def construir(cb, c, reg, salida):
    doc, part, body, sf = cb.nueva_pieza(c, PARTE)
    est = {}

    def placa():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), rects=[(0.0, 0.0, A, B)])
        est["pad"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, ESP, A * B * ESP, (A / 2, B / 2, ESP / 2))
        return info
    reg.paso("placa 200 x 120 x 6", placa)

    def agujero():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), circulos=[(X0, Y0, R)])
        est["agujero"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, ESP, -math.pi * R * R * ESP,
                                                    (X0, Y0, ESP / 2), antes=est["m"], vaciado=True)
        return info
    reg.paso("agujero D10 pasante en (25, 20)", agujero)

    def patron():
        ar = cb.topologia(doc, est["pad"], "Edge")
        ex = cb.elegir(ar, lambda x, y, z: abs(y) < .01 and abs(z - ESP) < .01)[0]["ref"]
        ey = cb.elegir(ar, lambda x, y, z: abs(x) < .01 and abs(z - ESP) < .01)[0]["ref"]
        pat = sf.AddNewRectPattern(est["agujero"], NX, NY, PX, PY, 1, 1, ex, ey, False, False, 0.0)
        part.Update()
        v_esperado = 11 * math.pi * R * R * ESP          # lo que sacan las 11 copias
        hs = agujeros()[1:]
        c_esperado = [sum(x for x, _ in hs) / 11, sum(y for _, y in hs) / 11, ESP / 2]
        probados, elegido = {}, None
        for r1, r2 in ((0, 0), (1, 0), (0, 1), (1, 1)):
            pat.FirstOrientation, pat.SecondOrientation = r1, r2
            part.Update()
            m = cb.medir(doc, part, body)
            dv, cen = jc._agregado(est["m"], m)
            probados[f"{r1}{r2}"] = {"saca": round(-dv, 3), "centro": cen and [round(x, 3) for x in cen]}
            if abs(-dv - v_esperado) <= 1.0 and cen and max(abs(a - b) for a, b in zip(cen, c_esperado)) <= 0.05:
                elegido = (r1, r2, m)
                break
        if elegido is None:
            raise RuntimeError(f"ninguna combinacion de sentidos saca los 11 agujeros del patron: {probados}")
        est["m"] = elegido[2]
        salida["patron"] = {"orientaciones": [elegido[0], elegido[1]], "probados": probados,
                            "saca_esperado": round(v_esperado, 3)}
        return salida["patron"]
    reg.paso("patron rectangular 4 x 3 a paso 40 x 35 (sentido elegido midiendo)", patron)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, PARTE, PARTE)


def cerca(a, b, tol):
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False


def distancia(c1, c2):
    try:
        x = sum((float(a) - float(b)) ** 2 for a, b in zip(c1, c2)) ** 0.5 if len(c1) == len(c2) == 3 else None
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def comparar(s):
    malos = []
    v, cdg = cuenta()
    s["cuenta"] = {"volumen_mm3": round(v, 3), "cdg_mm": [round(x, 4) for x in cdg]}
    sp = s.get("step_catia_en_build123d")
    sp = (sp.get(PARTE) if isinstance(sp, dict) else None) or {}
    sp = sp if isinstance(sp, dict) else {}          # un texto (la medicion fallo) es rojo, no una excepcion
    for que, vv, cc in (("CATIA", (s.get("volumen_catia") or {}).get(PARTE), (s.get("cdg_catia_mm") or {}).get(PARTE)),
                        ("el STEP de CATIA", sp.get("volumen"), sp.get("cdg_mm"))):
        if not cerca(vv, v, pj.tol_volumen(v)):
            malos.append(f"volumen de {que} {vv} y la cuenta da {v:.3f}")
        dc = distancia(cc, cdg)
        if dc is None or not dc <= TOL_CDG_MM:
            malos.append(f"centro de {que} {cc} y la cuenta da {[round(x, 4) for x in cdg]}")
    if tuple(sp.get(k) for k in ("solidos", "cascaras", "caras_sueltas")) != (1, 1, 0):
        malos.append(f"el STEP de CATIA trae {tuple(sp.get(k) for k in ('solidos', 'cascaras', 'caras_sueltas'))}: 1/1/0")
    return malos


def contra_el_gemelo(carpeta):
    """El STEP de CATIA contra la placa menos 12 cilindros sin patron (gemelo_placa.py, que ademas cuenta los cilindros de
    R5 del STEP de CATIA) con compara.py del 32."""
    paso = os.path.join(carpeta, EJ, PARTE + ".stp")
    ref = os.path.join(carpeta, "gemelo_placa.step")
    g = subprocess.run([jc.VENV_CAD, "-I", os.path.join(AQUI, "gemelo_placa.py"), ref, paso], capture_output=True,
                       text=True, timeout=600)
    lg = [x for x in (g.stdout or "").splitlines() if x.startswith("{")]
    if not lg:
        raise RuntimeError(f"gemelo_placa.py salio con {g.returncode}: {(g.stderr or g.stdout)[-300:]}")
    r = subprocess.run([jc.VENV_CAD, "-I", os.path.join(os.path.dirname(AQUI), "32_virolador_v16", "compara.py"), paso, ref],
                       capture_output=True, text=True, timeout=900)
    lineas = [x for x in (r.stdout or "").splitlines() if x.startswith("{")]
    if not lineas:
        raise RuntimeError(f"compara.py salio con {r.returncode}: {(r.stderr or r.stdout)[-300:]}")
    out = json.loads(lineas[-1])
    out["gemelo"] = json.loads(lg[-1])
    return out


def juzgar_forma(comp):
    if not isinstance(comp, dict):
        return [f"sin comparacion contra el gemelo: {comp}"]
    malos = [f"{k} {comp.get(k)} mm3 contra el gemelo" for k in ("sobra_A_menos_B", "falta_B_menos_A")
             if not cerca(comp.get(k), 0.0, 1.0)]
    malos += [f"{k} {comp.get(k)} mm" for k in ("dist_max_exacta_A_a_B", "dist_max_exacta_B_a_A")
              if not cerca(comp.get(k), 0.0, TOL_CDG_MM)]
    if comp.get("booleana_cierra") is not True or list(comp.get("solidos") or []) != [1, 1]:
        malos.append(f"booleana {comp.get('booleana_cierra')} y solidos {comp.get('solidos')}")
    ejes = (comp.get("gemelo") or {}).get("ejes_r5_catia")
    try:
        ejes = sorted({(round(float(x), 2), round(float(y), 2)) for x, y in ejes})   # dos caras de un agujero: un eje
    except (TypeError, ValueError):
        ejes = None
    if ejes != sorted((round(x, 2), round(y, 2)) for x, y in agujeros()):
        malos.append(f"los ejes de R5 del STEP de CATIA son {ejes} y los agujeros van en {agujeros()}")
    return malos


def cerrar_con_cuenta(carpeta, comparar_forma=None):
    """Idempotente: el error del juez queda aparte (error_juez) y el de este cierre se rearma cada vez.
    `comparar_forma` (la comparacion contra el gemelo) se cambia en la prueba sin CATIA."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    try:
        s["contra_el_gemelo"] = (comparar_forma or contra_el_gemelo)(carpeta)
    except Exception as e:  # noqa: BLE001
        s["contra_el_gemelo"] = f"no se pudo comparar: {e!r}"[:300]
    malos = comparar(s) + juzgar_forma(s["contra_el_gemelo"])
    s["ok_cuenta"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + malos)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_PLACA", json.dumps({"ok": s["ok"], "cuenta": s.get("cuenta"), "malos": malos}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_cuenta(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo comparar con la cuenta:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

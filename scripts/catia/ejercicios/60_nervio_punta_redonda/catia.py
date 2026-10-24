# -*- coding: utf-8 -*-
"""Ejercicio 60 del banco de CATIA (24/10/2026, operaciones que el banco no tenia): REDONDEO TRITANGENTE. Nervio 100 x 6 x 40
(X, Y, Z) desde (0, 0, 0) con la punta redonda: AddNewSolidTritangentFillet(cara y = 0, cara y = 6, cara de arriba), que deja
la punta como medio cilindro de R3 tangente a las dos caras laterales (un nervio de molde o de refuerzo).

Respuesta conocida (cuenta): el perfil es un rectangulo 6 x 37 mas un semicirculo de R3: 100 (6 37 + pi 3^2 / 2) =
23 613,717 mm3; centro (50; 3; 19,6838) (el semicirculo con su centro a 4 R / (3 pi) arriba de z 37).
ok = los pasos sin falla y sin error del juez Y el volumen y el centro de CATIA contra la cuenta (tol_volumen, 0,01 mm) Y
el STEP de CATIA 1/1/0 con lo mismo Y una cara cilindrica de R3 con el eje en X por (y 3, z 37) Y la FORMA: el STEP de CATIA
contra la caja 100 x 6 x 37 unida a un cilindro R3 a lo largo de X, SIN redondeo (gemelo_nervio.py; la referencia se arma sin
la operacion que se prueba, leccion del 56), con compara.py del 32 (sobra y falta <= 1 mm3, distancias exactas <= 0,01 mm).
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

EJ = "60_nervio_punta_redonda"
PARTE = "nervio"
TOL_CDG_MM = 0.01
L, T, H = 100.0, 6.0, 40.0
R = T / 2


def cuenta():
    """(volumen, centro) exactos del nervio con la punta redonda."""
    a_rect, a_semi = T * (H - R), math.pi * R * R / 2
    a = a_rect + a_semi
    z = (a_rect * (H - R) / 2 + a_semi * (H - R + 4 * R / (3 * math.pi))) / a
    return L * a, [L / 2, T / 2, z]


def construir(cb, c, reg, salida):
    doc, part, body, sf = cb.nueva_pieza(c, PARTE)
    est = {}

    def nervio():
        sk = jc.croquis(cb, part, body, jc.plano_origen(part, "xy"), rects=[(0.0, 0.0, L, T)])
        est["pad"], est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, H, L * T * H, (L / 2, T / 2, H / 2))
        return info
    reg.paso("nervio 100 x 6 x 40", nervio)

    def tritangente():
        caras = cb.topologia(doc, est["pad"], "Face")
        y0 = cb.elegir(caras, lambda x, y, z: abs(y) < .01)
        y6 = cb.elegir(caras, lambda x, y, z: abs(y - T) < .01)
        arriba = cb.elegir(caras, lambda x, y, z: abs(z - H) < .01)
        if not (len(y0) == len(y6) == len(arriba) == 1):
            raise RuntimeError(f"caras elegidas: y0 {len(y0)}, y6 {len(y6)}, arriba {len(arriba)}")
        sf.AddNewSolidTritangentFillet(y0[0]["ref"], y6[0]["ref"], arriba[0]["ref"])
        part.Update()
        m = cb.medir(doc, part, body)
        dv, cen = jc._agregado(est["m"], m)
        esperado = -L * (T * R - math.pi * R * R / 2)          # lo que saca: el rectangulo 6 x 3 menos el semicirculo
        info = {"saca": round(-dv, 3), "saca_esperado": round(-esperado, 3), "centro": cen and [round(x, 3) for x in cen]}
        if abs(dv - esperado) > 1.0:
            raise RuntimeError(f"el redondeo tritangente no saca lo de la cuenta: {info}")
        est["m"] = m
        salida["tritangente"] = info
        return info
    reg.paso("redondeo tritangente: caras y = 0 e y = 6, se va la de arriba", tritangente)
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
    """El STEP de CATIA contra la caja unida al cilindro (gemelo_nervio.py, que ademas lee los ejes de las caras
    cilindricas de R3 del STEP de CATIA) con compara.py del 32."""
    paso = os.path.join(carpeta, EJ, PARTE + ".stp")
    ref = os.path.join(carpeta, "gemelo_nervio.step")
    g = subprocess.run([jc.VENV_CAD, "-I", os.path.join(AQUI, "gemelo_nervio.py"), ref, paso], capture_output=True,
                       text=True, timeout=600)
    lg = [x for x in (g.stdout or "").splitlines() if x.startswith("{")]
    if not lg:
        raise RuntimeError(f"gemelo_nervio.py salio con {g.returncode}: {(g.stderr or g.stdout)[-300:]}")
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
    ejes = (comp.get("gemelo") or {}).get("ejes_r3_catia")
    try:
        ejes = sorted({(round(float(y), 2), round(float(z), 2), round(abs(float(dx)), 3)) for y, z, dx in ejes})
    except (TypeError, ValueError):
        ejes = None
    if ejes != [(T / 2, H - R, 1.0)]:
        malos.append(f"las caras cilindricas de R3 del STEP de CATIA tienen ejes {ejes}: tiene que ser uno, en X por "
                     f"(y {T / 2}, z {H - R})")
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
    print("FIN_NERVIO", json.dumps({"ok": s["ok"], "cuenta": s.get("cuenta"), "malos": malos}))
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

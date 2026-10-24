# -*- coding: utf-8 -*-
"""Ejercicio 55 del banco de CATIA (24/10/2026, piezas con respuesta exacta): tubo cuadrado 30 x 30 x 2 DOBLADO a 90 grados
(barandas y largueros curvos de los carros) por barrido (Rib) del perfil hueco a lo largo de recta 40 + arco R20 (cuarto)
+ recta 30, con el perfil centrado en el camino. ej85_tubo_doblado.py de la practica del 19/10 copiado SIN cambios.

Respuesta conocida (cuentas de geometria):
- VOLUMEN por Pappus: A L = (30^2 - 26^2) (40 + 10 pi + 30) = 224 x 101,416 = 22 717,168 mm3;
- CENTRO DE GRAVEDAD por tramos: recta 1 (x 50, y 0..40) en (50, 20, 0); recta 2 (y 60, x 70..100) en (85, 60, 0); el
  cuarto de curva (centro (70, 40), R 20, de (50, 40) a (70, 60)) con dV = r dr dz dtheta: su centro esta sobre la
  bisectriz a r_barra 2 sen(theta/2) / theta del centro del arco, con r_barra = integral r^2 dA / integral r dA = 26,5667
  (perfil cuadrado de 30 menos el de 26, centrado en R 20) -> 23,9184 -> (53,0874; 56,9126; 0). Total (61,3097; 43,2671; 0).
  Pappus solo mira el volumen: un tubo doblado para el OTRO lado tiene el mismo volumen y otro centro.
ok = los pasos sin falla y sin error del juez Y el volumen de CATIA a tol_volumen de Pappus Y el centro a 0,01 mm de la
cuenta Y la FORMA: el STEP de CATIA contra el barrido de build123d (gemelo_tubo.py) con compara.py, sobra y falta <= 1 mm3
y distancias exactas <= 0,01 mm (revisor del 55: un perfil girado en su plano tiene el mismo volumen y centro) Y la
cuenta Y el STEP de CATIA 1/1/0 con el mismo volumen (tol_volumen) y centro (0,01 mm).
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, la CATPart, el STEP y la captura.
"""
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y practica_en_juez
import juez_comun as jc  # noqa: E402
import practica_en_juez as pj  # noqa: E402

EJ = "55_tubo_doblado"
PARTE = "tubo"
TOL_CDG_MM = 0.01


def cuenta():
    """(volumen, centro) exactos del tubo doblado."""
    a, r, th = 30 ** 2 - 26 ** 2, 20.0, math.pi / 2

    def i2(m):                                   # integral r^2 dA de un cuadrado de medio lado m centrado en R
        return 4 * r * r * m * m + 4 * m ** 4 / 3
    rbar = (i2(15) - i2(13)) / (r * a)
    d = rbar * 2 * math.sin(th / 2) / th
    tramos = [(a * 40, (50.0, 20.0, 0.0)), (a * r * th, (70 - d * math.sqrt(0.5), 40 + d * math.sqrt(0.5), 0.0)),
              (a * 30, (85.0, 60.0, 0.0))]
    v = sum(x for x, _ in tramos)
    return v, [sum(x * p[i] for x, p in tramos) / v for i in range(3)]


def construir(cb, c, reg, salida):
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    import ej85_tubo_doblado as ej             # recien aca: catia_base ya tomo la carpeta de trabajo del juez
    if (ej.A_SEC, round(ej.L_CAM, 6)) != (224, round(40 + 10 * math.pi + 30, 6)):
        raise RuntimeError(f"el ej85 copiado no trae el tubo del ejercicio: {ej.A_SEC} {ej.L_CAM}")
    ej.cuerpo(c, reg)
    salida["tubo"] = reg.datos.get("tubo")
    d = c.ActiveDocument
    jc.cerrar_parte(cb, c, reg, salida, d, d.Part, d.Part.MainBody, PARTE, PARTE)


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
    vc = (s.get("volumen_catia") or {}).get(PARTE)
    cc = (s.get("cdg_catia_mm") or {}).get(PARTE)
    if not cerca(vc, v, pj.tol_volumen(v)):
        malos.append(f"volumen de CATIA {vc} y Pappus da {v:.3f}")
    dc = distancia(cc, cdg)
    if dc is None or not dc <= TOL_CDG_MM:
        malos.append(f"centro de CATIA {cc} y la cuenta da {[round(x, 4) for x in cdg]}")
    sp = s.get("step_catia_en_build123d")
    sp = (sp.get(PARTE) if isinstance(sp, dict) else None) or {}
    sp = sp if isinstance(sp, dict) else {}          # un texto (la medicion fallo) es rojo, no una excepcion
    if tuple(sp.get(k) for k in ("solidos", "cascaras", "caras_sueltas")) != (1, 1, 0):
        malos.append(f"el STEP de CATIA trae {tuple(sp.get(k) for k in ('solidos', 'cascaras', 'caras_sueltas'))}: 1/1/0")
    if not cerca(sp.get("volumen"), v, pj.tol_volumen(v)):
        malos.append(f"volumen del STEP de CATIA {sp.get('volumen')} y Pappus da {v:.3f}")
    ds = distancia(sp.get("cdg_mm"), cdg)
    if ds is None or not ds <= TOL_CDG_MM:
        malos.append(f"centro del STEP de CATIA {sp.get('cdg_mm')} y la cuenta da {[round(x, 4) for x in cdg]}")
    return malos


def contra_el_gemelo(carpeta):
    """El STEP de CATIA contra el barrido de build123d (gemelo_tubo.py) con compara.py del 32: la forma, que el volumen y
    el centro no ven (revisor del 55: el perfil girado 10 grados tiene el mismo volumen y el mismo centro)."""
    import subprocess
    paso = os.path.join(carpeta, EJ, PARTE + ".stp")
    ref = os.path.join(carpeta, "gemelo_tubo.step")
    subprocess.run([jc.VENV_CAD, "-I", os.path.join(AQUI, "gemelo_tubo.py"), ref], capture_output=True, text=True,
                   timeout=600)
    r = subprocess.run([jc.VENV_CAD, "-I", os.path.join(os.path.dirname(AQUI), "32_virolador_v16", "compara.py"), paso, ref],
                       capture_output=True, text=True, timeout=900)
    lineas = [x for x in (r.stdout or "").splitlines() if x.startswith("{")]
    if not lineas:
        raise RuntimeError(f"compara.py salio con {r.returncode}: {(r.stderr or r.stdout)[-300:]}")
    return json.loads(lineas[-1])


def juzgar_forma(comp):
    if not isinstance(comp, dict):
        return [f"sin comparacion contra el gemelo: {comp}"]
    malos = [f"{k} {comp.get(k)} mm3 contra el gemelo" for k in ("sobra_A_menos_B", "falta_B_menos_A")
             if not cerca(comp.get(k), 0.0, 1.0)]
    malos += [f"{k} {comp.get(k)} mm" for k in ("dist_max_exacta_A_a_B", "dist_max_exacta_B_a_A")
              if not cerca(comp.get(k), 0.0, TOL_CDG_MM)]
    if comp.get("booleana_cierra") is not True or list(comp.get("solidos") or []) != [1, 1]:
        malos.append(f"booleana {comp.get('booleana_cierra')} y solidos {comp.get('solidos')}")
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
    print("FIN_TUBO", json.dumps({"ok": s["ok"], "cuenta": s.get("cuenta"), "malos": malos}))
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

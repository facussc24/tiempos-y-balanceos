# -*- coding: utf-8 -*-
"""Ejercicio 57 del banco de CATIA (24/10/2026, piezas con respuesta exacta): MACHO de molde 250 x 80 x 60 con DESMOLDEO de 4
grados en los 4 costados (Draft de Part Design) y DESPUES R15 en las 4 aristas laterales (el orden de un molde: desmoldeo
primero, radios despues). ej82_macho_desmoldeo_radios.py de la practica del 19/10 copiado SIN cambios.

Respuesta conocida:
- el volumen con el desmoldeo, EXACTO por la formula del prismatoide: V = h/6 (A1 + 4 Am + A2), con la tapa achicada
  d = 60 tan 4 = 4,1956 por lado: 1 118 335,198 mm3;
- el macho con los radios: el gemelo de build123d haciendo lo mismo (gemelo_macho.py: extrude con taper + fillet de las
  aristas laterales): 1 106 821,554 mm3 y centro (0; 0; 29,2685).
ok = los pasos sin falla y sin error del juez Y el desmoldeo de CATIA a tol_volumen del prismatoide Y 4 aristas laterales Y el
macho final con el volumen (tol_volumen) y el centro (0,01 mm) del gemelo Y el STEP de CATIA 1/1/0 con lo mismo Y la
FORMA: el STEP de CATIA contra el STEP del gemelo con compara.py (sobra y falta <= 1 mm3, distancias exactas <= 0,01 mm).
Formula cerrada del macho final (revisor del 57): prismatoide - 4 R^2 (tan(phi/2) - phi/2) L, phi = acos(sen^2 4),
L = 60 raiz(2 sen^2 4 + cos^2 4) / cos 4 -> 1 106 821,5538 (= el gemelo).
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

EJ = "57_macho_desmoldeo"
PARTE = "macho"
TOL_CDG_MM = 0.01


def prismatoide():
    d = 60 * math.tan(math.radians(4))
    a1, a2, am = 250 * 80, (250 - 2 * d) * (80 - 2 * d), (250 - d) * (80 - d)
    return 60 / 6 * (a1 + 4 * am + a2)


def gemelo():
    r = subprocess.run([jc.VENV_CAD, "-I", os.path.join(AQUI, "gemelo_macho.py")], capture_output=True, text=True, timeout=600)
    lineas = [x for x in (r.stdout or "").splitlines() if x.startswith("{")]
    if not lineas:
        raise RuntimeError(f"gemelo_macho.py salio con {r.returncode}: {(r.stderr or r.stdout)[-300:]}")
    return json.loads(lineas[-1])


def construir(cb, c, reg, salida):
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    import ej82_macho_desmoldeo_radios as ej    # recien aca: catia_base ya tomo la carpeta de trabajo del juez
    if (ej.A, ej.B, ej.C, ej.R, ej.ANG) != (250.0, 80.0, 60.0, 15.0, 4.0):
        raise RuntimeError("el ej82 copiado no trae el macho del ejercicio")
    ej.cuerpo(c, reg)
    salida["macho"] = reg.datos.get("macho")
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
    m = s.get("macho") or {}
    g = (s.get("gemelo") or {}).get("con_radios") or {}
    vp = prismatoide()
    s["cuenta"] = {"prismatoide_mm3": round(vp, 3)}
    if not cerca(m.get("catia_desmoldeo"), vp, pj.tol_volumen(vp)):
        malos.append(f"desmoldeo de CATIA {m.get('catia_desmoldeo')} y el prismatoide da {vp:.3f}")
    if m.get("aristas_laterales") != 4:
        malos.append(f"{m.get('aristas_laterales')} aristas laterales redondeadas y no 4")
    vg, cg = g.get("vol"), g.get("cdg")
    sp = s.get("step_catia_en_build123d")
    sp = (sp.get(PARTE) if isinstance(sp, dict) else None) or {}
    sp = sp if isinstance(sp, dict) else {}          # un texto (la medicion fallo) es rojo, no una excepcion (CATA, 16:01)
    for que, v, c in (("CATIA", (s.get("volumen_catia") or {}).get(PARTE), (s.get("cdg_catia_mm") or {}).get(PARTE)),
                      ("el STEP de CATIA", sp.get("volumen"), sp.get("cdg_mm"))):
        if not cerca(v, vg, pj.tol_volumen(vg or 0)):
            malos.append(f"volumen de {que} {v} y el gemelo da {vg}")
        dc = distancia(c, cg)
        if dc is None or not dc <= TOL_CDG_MM:
            malos.append(f"centro de {que} {c} y el gemelo da {cg}")
    if tuple(sp.get(k) for k in ("solidos", "cascaras", "caras_sueltas")) != (1, 1, 0):
        malos.append(f"el STEP de CATIA trae {tuple(sp.get(k) for k in ('solidos', 'cascaras', 'caras_sueltas'))}: 1/1/0")
    return malos


def contra_el_gemelo(carpeta):
    """El STEP de CATIA contra el STEP del gemelo (gemelo_macho.py) con compara.py del 32 (revisor del 57: la fila lo
    prometia y no se hacia; un macho con 250 y 80 cambiados tiene el mismo volumen y centro)."""
    paso = os.path.join(carpeta, EJ, PARTE + ".stp")
    ref = os.path.join(carpeta, "gemelo_macho.step")
    subprocess.run([jc.VENV_CAD, "-I", os.path.join(AQUI, "gemelo_macho.py"), ref], capture_output=True, text=True,
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


def cerrar_con_cuenta(carpeta, gemelo_=None, comparar_forma=None):
    """Idempotente. `gemelo_` (lo que da gemelo_macho.py) se cambia en la prueba sin CATIA."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    try:
        s["gemelo"] = gemelo_ if gemelo_ is not None else gemelo()
    except Exception as e:  # noqa: BLE001
        s["gemelo"] = {"error": repr(e)[:200]}
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
    print("FIN_MACHO", json.dumps({"ok": s["ok"], "cuenta": s.get("cuenta"), "malos": malos}))
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

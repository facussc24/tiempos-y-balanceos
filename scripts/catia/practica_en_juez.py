# -*- coding: utf-8 -*-
"""Correr dentro del juez un ejercicio de la practica de CATIA del 19/10 copiado SIN cambios en la carpeta del ejercicio
del banco (24/10/2026; lo usan el 25, 27 y 29; el 19 y el 23 hacen lo mismo a mano).

El ejNN de la practica define cuerpo(c, reg) (o hacer() que devuelve cuerpo), deja en reg.datos["resultado"] el volumen
(«vol») y guarda <nombre>.CATPart + .stp con guardar_pieza; sus contornos JSON van en <carpeta>/<ejNN>/ (el ejNN los busca
junto a si mismo). Su captura (necesita un conversor a PNG que el paquete no trae) se cambia por la del juez (BMP).

    construir_desde_practica(cb, c, reg, salida, carpeta, modulo, nombre_step)   -> para correr_ejercicio(con_bien=False)
    cerrar_con_masa(carpeta, papel, tol, densidad_g_mm3, gemelo_mm3, factor=1.0, unidad="g", gemelo_cdg=None)

ok = los pasos sin falla y sin error del juez Y la masa (volumen x densidad / factor) a `tol` o menos del papel Y el
volumen a 0,5 mm3 del gemelo de build123d de la practica Y el STEP de CATIA, leido con build123d, con el volumen de CATIA
(las dos a 0,5 mm3 o 1e-5 del volumen, lo que sea mayor: tol_volumen) Y, con `gemelo_cdg`, el STEP de CATIA en 1 solido,
1 cascara y 0 caras sueltas y con el CENTRO DE GRAVEDAD del gemelo a 0,01 mm (24/10, revisor del 37 y CATA en el 36: la
masa y el volumen no ven un rasgo corrido que no se cruza con nada; el centro si). Toda comparacion es «bien si
|x - y| <= tol»: un NaN da rojo."""
import importlib
import json
import os
import sys

import juez_comun as jc

TOL_MM3 = 0.5
# y 1e-5 del volumen, lo que sea mayor. Medido el 24/10 10:58 en el 29 (Buffer Stand, en pulgadas, 228 695 mm3): el
# gemelo de build123d da 228 696,0 en memoria y 228 695,116 al releer su propio STEP (0,9 mm3: pasar por STEP); CATIA da
# 228 694,873 y su STEP 228 695,446 (0,57); CATIA contra el gemelo en memoria, 1,13 (dos nucleos, CGM y OCCT, sin
# STEP de por medio). 1e-5 son 2,3 mm3 = 0,018 g en esa pieza: la falta real mas chica (un chaflan) son ~80 mm3.
TOL_REL = 1e-5
CLAVE_STEP = "pieza"


def tol_volumen(v):
    return max(TOL_MM3, TOL_REL * abs(v))


def construir_desde_practica(cb, c, reg, salida, carpeta, modulo, nombre_step):
    if carpeta not in sys.path:
        sys.path.insert(0, carpeta)
    mod = importlib.import_module(modulo)      # recien aca: catia_base ya tomo la carpeta de trabajo del juez
    mod.captura = lambda c_, reg_, nombre, vistas=None: jc.captura_bmp(c_, reg_.carpeta, nombre)
    cuerpo = mod.cuerpo if hasattr(mod, "cuerpo") else mod.hacer()
    cuerpo(c, reg)
    salida["resultado"] = reg.datos.get("resultado")
    paso = os.path.join(reg.carpeta, nombre_step + ".stp")
    if os.path.isfile(paso):
        salida["_steps"][CLAVE_STEP] = paso
        salida["archivos"].append(os.path.relpath(paso, salida["_carpeta"]))


TOL_CDG_MM = 0.01                           # la del juez comun


def cerca(a, b, tol):
    """«bien si |a - b| <= tol»: un NaN, un None o un texto dan False."""
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False


def cerrar_con_masa(carpeta, papel, tol, densidad_g_mm3, gemelo_mm3, factor=1.0, unidad="g", gemelo_cdg=None):
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    # idempotente (revisor del 25-29: un segundo cierre dejaba el error del primero con «ok: true»): el error del juez
    # se guarda aparte la primera vez y el de este cierre se rearma desde ahi
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    if s["error_juez"]:
        s["error"] = s["error_juez"]
    malos = []
    v = (s.get("resultado") or {}).get("vol")
    try:
        v = float(v)
    except (TypeError, ValueError):
        v = None
    if v is None or v != v:
        malos.append(f"sin volumen de CATIA ({(s.get('resultado') or {}).get('vol')})")
    else:
        masa = v * densidad_g_mm3 / factor
        s["masa_catia"] = {"valor": round(masa, 4), "unidad": unidad, "papel": papel, "tolerancia": tol,
                           "dif": round(masa - papel, 4)}
        s["dif_gemelo_mm3"] = round(v - gemelo_mm3, 3)
        if not cerca(masa, papel, tol):
            malos.append(f"masa {masa:.4f} {unidad} contra {papel} del papel (tolerancia {tol})")
        if not cerca(v, gemelo_mm3, tol_volumen(v)):
            malos.append(f"volumen {v} contra el gemelo de la practica {gemelo_mm3}")
        vs = s.get("volumen_step_catia_en_build123d")      # sin .venv-cad viene el texto del error
        vstep = vs.get(CLAVE_STEP) if isinstance(vs, dict) else vs
        if not cerca(vstep, v, tol_volumen(v)):
            malos.append(f"el STEP de CATIA da {vstep} contra {v} de CATIA")
    if gemelo_cdg is not None:
        sp = s.get("step_catia_en_build123d")
        sp = (sp.get(CLAVE_STEP) if isinstance(sp, dict) else None) or {}
        c = sp.get("cdg_mm")
        try:
            dist = sum((float(a) - b) ** 2 for a, b in zip(c, gemelo_cdg)) ** 0.5 if len(c) == 3 else None
        except (TypeError, ValueError):
            dist = None
        s["dif_cdg_gemelo_mm"] = None if dist is None or dist != dist else round(dist, 4)
        if dist is None or not dist <= TOL_CDG_MM:
            malos.append(f"centro de gravedad del STEP de CATIA {c} contra {list(gemelo_cdg)} del gemelo")
        topo = tuple(sp.get(x) for x in ("solidos", "cascaras", "caras_sueltas"))
        if topo != (1, 1, 0):
            malos.append(f"el STEP de CATIA trae solidos/cascaras/caras sueltas {topo}: tiene que ser 1/1/0")
    s["ok_papel"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    if malos:
        texto = "; ".join(malos)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_PAPEL", json.dumps({"ok": s["ok"], "masa": s.get("masa_catia"), "malos": malos}))
    return s


def main(ej, modulo, nombre_step, papel, tol, densidad_g_mm3, gemelo_mm3, aqui, factor=1.0, unidad="g", gemelo_cdg=None):
    """El __main__ de cada catia.py: correr_ejercicio sin bien.py y despues la masa contra el papel."""
    import traceback
    codigo = jc.correr_ejercicio(ej, lambda cb, c, reg, salida: construir_desde_practica(cb, c, reg, salida, aqui, modulo,
                                                                                         nombre_step), con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_masa(os.path.abspath(sys.argv[1]), papel, tol, densidad_g_mm3, gemelo_mm3, factor, unidad,
                            gemelo_cdg)
        except Exception:  # noqa: BLE001
            print("no se pudo comparar con el papel:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    return codigo

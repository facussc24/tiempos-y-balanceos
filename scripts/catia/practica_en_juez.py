# -*- coding: utf-8 -*-
"""Correr dentro del juez un ejercicio de la practica de CATIA del 19/10 copiado SIN cambios en la carpeta del ejercicio
del banco (24/10/2026; lo usan el 25, 27 y 29; el 19 y el 23 hacen lo mismo a mano).

El ejNN de la practica define cuerpo(c, reg) (o hacer() que devuelve cuerpo), deja en reg.datos["resultado"] el volumen
(«vol») y guarda <nombre>.CATPart + .stp con guardar_pieza; sus contornos JSON van en <carpeta>/<ejNN>/ (el ejNN los busca
junto a si mismo). Su captura (necesita un conversor a PNG que el paquete no trae) se cambia por la del juez (BMP).

    construir_desde_practica(cb, c, reg, salida, carpeta, modulo, nombre_step)   -> para correr_ejercicio(con_bien=False)
    cerrar_con_masa(carpeta, papel, tol, densidad_g_mm3, gemelo_mm3, factor=1.0, unidad="g")

ok = los pasos sin falla Y la masa (volumen x densidad / factor) a `tol` o menos del papel Y el volumen a 0,5 mm3 del
gemelo de build123d de la practica Y el STEP de CATIA, leido con build123d, con el volumen de CATIA (las dos a 0,5 mm3 o
1e-5 del volumen, lo que sea mayor: tol_volumen)."""
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


def cerrar_con_masa(carpeta, papel, tol, densidad_g_mm3, gemelo_mm3, factor=1.0, unidad="g"):
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
    if v is None:
        malos.append("sin volumen de CATIA")
    else:
        masa = v * densidad_g_mm3 / factor
        s["masa_catia"] = {"valor": round(masa, 4), "unidad": unidad, "papel": papel, "tolerancia": tol,
                           "dif": round(masa - papel, 4)}
        s["dif_gemelo_mm3"] = round(v - gemelo_mm3, 3)
        if abs(masa - papel) > tol:
            malos.append(f"masa {masa:.4f} {unidad} contra {papel} del papel (tolerancia {tol})")
        if abs(v - gemelo_mm3) > tol_volumen(v):
            malos.append(f"volumen {v} contra el gemelo de la practica {gemelo_mm3}")
        vs = s.get("volumen_step_catia_en_build123d")      # sin .venv-cad viene el texto del error
        vstep = vs.get(CLAVE_STEP) if isinstance(vs, dict) else vs
        if not isinstance(vstep, (int, float)) or abs(vstep - v) > tol_volumen(v):
            malos.append(f"el STEP de CATIA da {vstep} contra {v} de CATIA")
    s["ok_papel"] = not malos
    s["ok"] = s["ok_pasos"] and not malos
    if malos:
        texto = "; ".join(malos)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_PAPEL", json.dumps({"ok": s["ok"], "masa": s.get("masa_catia"), "malos": malos}))
    return s


def main(ej, modulo, nombre_step, papel, tol, densidad_g_mm3, gemelo_mm3, aqui, factor=1.0, unidad="g"):
    """El __main__ de cada catia.py: correr_ejercicio sin bien.py y despues la masa contra el papel."""
    import traceback
    codigo = jc.correr_ejercicio(ej, lambda cb, c, reg, salida: construir_desde_practica(cb, c, reg, salida, aqui, modulo,
                                                                                         nombre_step), con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_masa(os.path.abspath(sys.argv[1]), papel, tol, densidad_g_mm3, gemelo_mm3, factor, unidad)
        except Exception:  # noqa: BLE001
            print("no se pudo comparar con el papel:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    return codigo

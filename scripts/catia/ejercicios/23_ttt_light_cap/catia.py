# -*- coding: utf-8 -*-
"""Ejercicio 23 del banco de CATIA (cola del 24/10/2026): Too Tall Toby 01-10 «Light Cap» en CATIA por la SECCION DE
PARED (el Shell de CATIA no abre la base cuando quedo partida en 3 caras: practica del 19/10, dbg_shell.py): pared =
afuera (arco R40 con centro en z 6 + lados tangentes desde +-42) menos adentro (lo mismo corrido 8, techo z 30 con R8),
extruida simetrica 100 y la media seccion revolucionada 180 grados en y +-50.

Papel: guia de build123d, Too Tall Toby (https://build123d.readthedocs.io/en/stable/tttt.html, plano 01-10, libre para
uso educativo): 211,30 g en ABS, 1 020 kg/m3, +-1 g.

Geometria: ej31b_light_cap.py de la practica del 19/10 copiado sin cambios (sha256 18bbc9cdacd63851...); su gemelo de
build123d, gemelo_b123d_ej31.py (copia del ej31_light_cap/gemelo.py, 0f3de90be9d0b5ed...), dio el mismo volumen ese dia
(207 159,364 mm3, registro.json de la practica). Este catia.py lo corre dentro del juez; la captura de la practica se
cambia por la del juez (BMP).

ok = los pasos sin falla Y la masa de CATIA (volumen x 1,02e-3) a 0,1 g o menos de la guia (la guia tolera 1 g) Y el volumen de CATIA a 0,5 mm3
del gemelo de la practica Y el STEP de CATIA, leido con build123d, con el volumen de CATIA a 0,5 mm3.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, CATPart, STEP y captura BMP.
"""
import json
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun
import juez_comun as jc  # noqa: E402

EJ = "23_ttt_light_cap"                    # sin bien.py en el banco 3D: con_bien=False
PAPEL_G, TOL_MASA_G = 211.30, 0.1         # la guia tolera 1 g; aca 0,1 para que un detalle de ~1 g no pase (como el 19)
DENSIDAD_G_MM3 = 1.02e-3
GEMELO_MM3 = 207159.364                    # gemelo de build123d de la practica (ej31_light_cap/gemelo.py, 19/10)
TOL_MM3 = 0.5
NOMBRE_STEP = "ej31b_light_cap"


def construir(cb, c, reg, salida):
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    import ej31b_light_cap as ej31b            # recien aca: catia_base ya tomo la carpeta de trabajo del juez
    ej31b.captura = lambda c_, reg_, nombre, vistas=None: jc.captura_bmp(c_, reg_.carpeta, nombre)
    if (ej31b.DENS, ) != (DENSIDAD_G_MM3, ):
        raise RuntimeError(f"el ej31b copiado no trae la densidad del rotulo: {ej31b.DENS}")
    ej31b.cuerpo(c, reg)
    salida["resultado"] = reg.datos.get("resultado")
    paso = os.path.join(reg.carpeta, NOMBRE_STEP + ".stp")
    if os.path.isfile(paso):
        salida["_steps"]["light_cap"] = paso
        salida["archivos"].append(os.path.relpath(paso, salida["_carpeta"]))


def cerrar_con_papel(carpeta):
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    malos = []
    v = (s.get("resultado") or {}).get("vol")
    if v is None:
        malos.append("sin volumen de CATIA")
    else:
        s["masa_catia_g"] = round(v * DENSIDAD_G_MM3, 3)
        s["dif_masa_g"] = round(s["masa_catia_g"] - PAPEL_G, 3)
        s["dif_gemelo_mm3"] = round(v - GEMELO_MM3, 3)
        if abs(s["dif_masa_g"]) > TOL_MASA_G:
            malos.append(f"masa {s['masa_catia_g']} g contra {PAPEL_G} de la guia")
        if abs(s["dif_gemelo_mm3"]) > TOL_MM3:
            malos.append(f"volumen {v} contra el gemelo de la practica {GEMELO_MM3}")
        vs = s.get("volumen_step_catia_en_build123d")  # sin .venv-cad viene el texto del error
        vstep = vs.get("light_cap") if isinstance(vs, dict) else vs
        if not isinstance(vstep, (int, float)) or abs(vstep - v) > TOL_MM3:
            malos.append(f"el STEP de CATIA da {vstep} contra {v} de CATIA")
    s["ok_papel"] = not malos
    s["ok"] = s["ok_pasos"] and not malos
    if malos:
        texto = "; ".join(malos)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_LIGHT_CAP", json.dumps({"ok": s["ok"], "masa_catia_g": s.get("masa_catia_g"),
                                       "dif_masa_g": s.get("dif_masa_g"), "malos": malos}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_papel(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo comparar con el papel:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

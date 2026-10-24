# -*- coding: utf-8 -*-
"""Ejercicio 19 del banco de CATIA (cola del 24/10/2026): CSWP Sample Exam 2 de SolidWorks, ETAPA 2 (preguntas 4 y 5),
pieza PARAMETRICA en CATIA: se modifica la pieza de la etapa 1 (sin el bloque ni el agujero F, bolsillos nuevos con R10,
garganta de 30 en el cilindro, chaflanes de 2 x 30 grados, Y = B/3 + 15) y se cambian SOLO los parametros A..E para
contestar las dos preguntas.

Papel: «CSWP Sample Exam 2» (SolidWorks), copia de la Universidad de Alberta,
https://sites.ualberta.ca/~dnobes/CSWA/CSWP_Material/CSWP_SampleExam_2.pdf: pag. 19 la densidad 0,0077 g/mm3 (y la
etapa 1), pag. 23 los cambios de la etapa 2, pag. 24 la pregunta 4 (A..E = 221 211 165 121 37), pag. 26 la 5 (229 217 163
119 34), pag. 27 las respuestas 13 206,40 g y 14 208,00 g (paginas confirmadas por el revisor del 19, 24/10).

Geometria: la de la practica del 19/10, sin cambios: ej28_etapa2.py y ej27_parametrico.py (de ahi sale la clase Croquis)
copiados tal cual de C:\\Dev\\_catia_practica (sha256 31cc51b39e3c75e8... y 8118ce603645ee8e...); la lectura del plano
la cerro un gemelo de build123d de la practica (ej26_cswp/gemelo_e2.py: 0,03 / 0,01 g). Este catia.py solo la corre
dentro del juez (CATIA propia, vigia, registro) y la juzga contra el papel; la captura de la practica (que necesita un
conversor a PNG que el paquete no trae) se cambia por la del juez (BMP).

ok = los pasos sin falla Y las dos masas de CATIA (volumen x 0,0077) a 0,1 g o menos del papel (no 1 g: un solo chaflan
de 2 x 30 pesa 0,98 a 1,06 g y con 1 g pasaba; medido -0,013 / +0,004) Y el STEP que exporta CATIA
(estado de la pregunta 5), leido con build123d, con el volumen de CATIA a 0,5 mm3.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, CATPart, STEP y captura BMP.
"""
import json
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun
import juez_comun as jc  # noqa: E402

EJ = "19_cswp_etapa2"                      # sin bien.py en el banco 3D: con_bien=False
PAPEL_G = {4: 13206.40, 5: 14208.00}       # CSWP Sample Exam 2, preguntas 4 y 5 (pag. 27)
PAPEL_AE = {4: (221, 211, 165, 121, 37), 5: (229, 217, 163, 119, 34)}   # pag. 24 y 26
DENSIDAD_G_MM3 = 0.0077
TOL_MASA_G = 0.1                           # revisor del 19: un chaflan faltante pesa ~1 g
TOL_STEP_MM3 = 0.5
NOMBRE_STEP = "ej28_cswp_etapa2"           # lo que guarda el ej28 (guardar_pieza)


def construir(cb, c, reg, salida):
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    import ej28_etapa2 as ej28                 # recien aca: catia_base ya tomo la carpeta de trabajo del juez
    ej28.captura = lambda c_, reg_, nombre, vistas=None: jc.captura_bmp(c_, reg_.carpeta, nombre)
    if (ej28.DENS, {k: v[-1] for k, v in ej28.PREG.items()}, {k: tuple(v[:5]) for k, v in ej28.PREG.items()}) != \
            (DENSIDAD_G_MM3, PAPEL_G, PAPEL_AE):
        raise RuntimeError(f"el ej28 copiado no trae los datos del papel: {ej28.DENS} {ej28.PREG}")
    ej28.hacer()(c, reg)
    salida["preguntas"] = reg.datos.get("preguntas")
    paso = os.path.join(reg.carpeta, NOMBRE_STEP + ".stp")
    if os.path.isfile(paso):
        salida["_steps"]["cswp_q5"] = paso
        salida["archivos"].append(os.path.relpath(paso, salida["_carpeta"]))
    bmp = os.path.join(reg.carpeta, "ej28_iso.bmp")
    if os.path.isfile(bmp):
        salida["archivos"].append(os.path.relpath(bmp, salida["_carpeta"]))


def cerrar_con_papel(carpeta):
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    malos = []
    pr = s.get("preguntas") or {}
    s["masa_catia_g"], s["dif_masa_g"] = {}, {}
    for n, papel in PAPEL_G.items():
        d = pr.get(str(n)) or pr.get(n)
        if not d or d.get("vol") is None:
            malos.append(f"pregunta {n}: sin volumen de CATIA")
            continue
        m = d["vol"] * DENSIDAD_G_MM3
        s["masa_catia_g"][str(n)] = round(m, 3)
        s["dif_masa_g"][str(n)] = round(m - papel, 3)
        if abs(m - papel) > TOL_MASA_G:
            malos.append(f"pregunta {n}: {m:.2f} g contra {papel} del papel")
    vs = s.get("volumen_step_catia_en_build123d")      # sin .venv-cad (CATA) viene el TEXTO del error, no un dict
    vstep = vs.get("cswp_q5") if isinstance(vs, dict) else vs
    v5 = (pr.get("5") or pr.get(5) or {}).get("vol")
    if not isinstance(vstep, (int, float)) or v5 is None or abs(vstep - v5) > TOL_STEP_MM3:
        malos.append(f"el STEP de CATIA (pregunta 5) da {vstep} contra {v5} de CATIA")
    s["ok_papel"] = not malos
    s["ok"] = s["ok_pasos"] and not malos
    if malos:
        texto = "; ".join(malos)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_CSWP", json.dumps({"ok": s["ok"], "masa_catia_g": s["masa_catia_g"], "dif_masa_g": s["dif_masa_g"],
                                  "malos": malos}))
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

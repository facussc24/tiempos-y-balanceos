# -*- coding: utf-8 -*-
"""Ejercicio 37 del banco de CATIA (fase 2, segunda tanda, 24/10/2026): CSWA Sample Exam 2013 oficial de SolidWorks,
«Tool Block» etapas 3 y 4 (preguntas 5 y 6) en CATIA Part Design, sobre la misma pieza: etapa 3 (A 86, B 58, C 44) con el
Ø11 pasante, el escalon z 0..19 y la ranura z 8..32 adentro de un R41; etapa 4, el bolsillo de un solo lado con paredes
de 1 mm que deja 1 mm de piel alrededor de la ranura.

Papel: «EDU_CSWA_Sample_Exam_2013_ENG.pdf» (SolidWorks; copia en la nube de Ingenieria, 4- MANUALES\\CATIA V5\\
EJERCICIOS CERTIFICACION): pag. 5 y 6 del PDF las preguntas 5 y 6 (acero AISI 1020, densidad 0,0079 g/mm3), pag. 9 del
PDF (313 del libro) las respuestas: 5) 628,18 g y 6) 432,58 g.

Geometria: ej41b_tool_block_e34.py de la practica del 19/10 copiado SIN cambios, con croquis.py y sus contornos en
ej41_tool_block/ (e3.json, e4_zona.json, e4_sin_ranura.json, pasados de build123d). Gemelo de build123d de la practica
(ej41_tool_block/gemelo34.py, con gemelo.py): etapa 3 79 516,884 mm3 y centro (45,7428; 32,1317; 26,1652), etapa 4
54 757,26 mm3 y (42,6006; 31,6783; 32,1674) (medidos el 24/10 con build123d). Ni la masa ni el VOLUMEN ven la altura de
la ranura ni el lado del bolsillo (no se cruzan con nada: la ranura corrida de -1 a +12 mm en z da 0,000 mm3, revisor del
37); el CENTRO DE GRAVEDAD si (ranura +0,1 mm -> 0,028 mm en la etapa 3; bolsillo espejado -> 8,24 mm). El 19/10 lo
cubria compara.py contra el gemelo; aca, el centro de cada etapa en CATIA y el del STEP contra el gemelo, a 0,01 mm.

ok = los pasos sin falla y sin error del juez Y las dos masas de CATIA (volumen x 0,0079) a 0,1 g o menos del papel Y el
volumen y el centro de gravedad de cada etapa en CATIA a tol_volumen y a 0,01 mm del gemelo Y el STEP de CATIA (etapa 4),
leido con build123d: 1 solido, 1 cascara, 0 caras sueltas, el volumen de CATIA a tol_volumen (max(0,5 mm3, 1e-5 v),
practica_en_juez) y el centro del gemelo a 0,01 mm.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, CATPart, STEP y dos capturas BMP.
"""
import json
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y practica_en_juez
import juez_comun as jc  # noqa: E402
import practica_en_juez as pj  # noqa: E402

EJ = "37_cswa_tool_block_e34"            # sin bien.py en el banco 3D: con_bien=False
PAPEL_G = {"etapa3": 628.18, "etapa4": 432.58}          # CSWA 2013, respuestas 5 y 6 (pag. 9 del PDF)
GEMELO_MM3 = {"etapa3": 79516.884, "etapa4": 54757.26}  # gemelo34.py de la practica (build123d)
GEMELO_CDG = {"etapa3": (45.7428, 32.1317, 26.1652), "etapa4": (42.6006, 31.6783, 32.1674)}   # idem, CenterOf.MASS
TOL_CDG_MM = 0.01                        # la del juez comun
DENSIDAD_G_MM3 = 0.0079                  # AISI 1020 del examen (pag. 5 y 6)
DIMS = (86.0, 58.0, 44.0)                # A, B, C de la pregunta 5
TOL_MASA_G = 0.1
NOMBRE_STEP = "ej41b_tool_block_e34"     # lo que guarda el ej41b (guardar_pieza)


def construir(cb, c, reg, salida):
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    import ej41b_tool_block_e34 as ej     # recien aca: catia_base ya tomo la carpeta de trabajo del juez
    ej.captura = lambda c_, reg_, nombre, vistas=None: jc.captura_bmp(c_, reg_.carpeta, nombre)
    if (ej.DENS, (ej.A, ej.B, ej.C)) != (DENSIDAD_G_MM3, DIMS):
        raise RuntimeError(f"el ej41b copiado no trae los datos del papel: {ej.DENS} {(ej.A, ej.B, ej.C)}")
    # el ej41b mide solo el volumen de cada etapa: despues de su paso «masa etapa N» se mide el centro de gravedad de la
    # misma pieza (sin tocar el ej41b; revisor del 37: el volumen no ve la altura de la ranura)
    paso_original, cdg = reg.paso, {}

    def paso_con_cdg(que, fn):
        r = paso_original(que, fn)
        if que in ("masa etapa 3", "masa etapa 4"):
            d = c.ActiveDocument
            try:
                cdg["etapa" + que[-1]] = cb.medir(d, d.Part, d.Part.MainBody).get("cdg_mm")
            except Exception as e:  # noqa: BLE001
                cdg["etapa" + que[-1]] = f"no se pudo medir: {e!r}"[:200]
        return r
    reg.paso = paso_con_cdg
    ej.cuerpo(c, reg)
    salida["etapas"] = {k: reg.datos.get(k) for k in PAPEL_G}
    salida["cdg_etapas_catia_mm"] = cdg
    paso = os.path.join(reg.carpeta, NOMBRE_STEP + ".stp")
    if os.path.isfile(paso):
        salida["_steps"]["etapa4"] = paso
        salida["archivos"].append(os.path.relpath(paso, salida["_carpeta"]))
    for b in ("ej41b_e3_iso.bmp", "ej41b_e4_iso.bmp"):
        if os.path.isfile(os.path.join(reg.carpeta, b)):
            salida["archivos"].append(os.path.relpath(os.path.join(reg.carpeta, b), salida["_carpeta"]))


def cerrar_con_papel(carpeta):
    """Idempotente: el error del juez queda aparte (error_juez) y el de este cierre se rearma cada vez."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    malos = []
    et = s.get("etapas") or {}
    s["masa_catia_g"], s["dif_masa_g"], s["dif_gemelo_mm3"] = {}, {}, {}
    for k, papel in PAPEL_G.items():
        v = (et.get(k) or {}).get("vol")
        if v is None:
            malos.append(f"{k}: sin volumen de CATIA")
            continue
        m = v * DENSIDAD_G_MM3
        s["masa_catia_g"][k] = round(m, 3)
        s["dif_masa_g"][k] = round(m - papel, 3)
        s["dif_gemelo_mm3"][k] = round(v - GEMELO_MM3[k], 3)
        if not abs(m - papel) <= TOL_MASA_G:                   # «not <=»: un NaN da rojo
            malos.append(f"{k}: {m:.2f} g contra {papel} del papel")
        if not abs(v - GEMELO_MM3[k]) <= pj.tol_volumen(GEMELO_MM3[k]):
            malos.append(f"{k}: {v} mm3 contra {GEMELO_MM3[k]} del gemelo")
    vs = s.get("volumen_step_catia_en_build123d")      # sin .venv-cad viene el TEXTO del error, no un dict
    vstep = vs.get("etapa4") if isinstance(vs, dict) else vs
    v4 = (et.get("etapa4") or {}).get("vol")
    if not isinstance(vstep, (int, float)) or v4 is None or not abs(vstep - v4) <= pj.tol_volumen(v4):
        malos.append(f"el STEP de CATIA (etapa 4) da {vstep} contra {v4} de CATIA")
    # la POSICION: el centro de gravedad de cada etapa en CATIA y el del STEP, contra el gemelo (revisor del 37)
    cdg = s.get("cdg_etapas_catia_mm") or {}
    sp = s.get("step_catia_en_build123d")
    sp = sp.get("etapa4") if isinstance(sp, dict) else None
    medidos = {k: cdg.get(k) for k in GEMELO_CDG}
    medidos["STEP"] = (sp or {}).get("cdg_mm")
    s["dif_cdg_gemelo_mm"] = {}
    for k, c in medidos.items():
        g = GEMELO_CDG["etapa4" if k == "STEP" else k]
        try:
            dist = sum((float(a) - b) ** 2 for a, b in zip(c, g)) ** 0.5 if len(c) == 3 else None
        except (TypeError, ValueError):
            dist = None
        s["dif_cdg_gemelo_mm"][k] = None if dist is None else round(dist, 4)
        if dist is None or not dist <= TOL_CDG_MM:
            malos.append(f"centro de gravedad de {k}: {c} contra {g} del gemelo")
    topo = tuple((sp or {}).get(x) for x in ("solidos", "cascaras", "caras_sueltas"))
    if topo != (1, 1, 0):
        malos.append(f"el STEP de CATIA trae solidos/cascaras/caras sueltas {topo}: tiene que ser 1/1/0")
    s["ok_papel"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + malos)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_CSWA", json.dumps({"ok": s["ok"], "masa_catia_g": s["masa_catia_g"], "dif_masa_g": s["dif_masa_g"],
                                  "dif_gemelo_mm3": s["dif_gemelo_mm3"], "malos": malos}))
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

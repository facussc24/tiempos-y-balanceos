# -*- coding: utf-8 -*-
"""Ejercicio 36 del banco de CATIA (COLA_CATIA.md, fase 2 segunda tanda, pedido 27 de la principal, 24/10/2026, CATA):
CSWA Sample Exam 2013 oficial de SolidWorks, «Tool Block», etapas 1 (A 81, B 57, C 43) y 2 (A 84, B 59, C 45), en CATIA,
con la masa contra las respuestas del examen: 939,54 g y 1 032,32 g en acero (AISI 1020) de 0,0079 g/mm3.

Papel: https://www.solidworks.com/sw/docs/EDU_CSWA_Sample_Exam_2013_ENG.pdf (desde CATA no carga: tiempo agotado); el
revisor lo leyo en la copia de web.archive.org del 21/05/2024 de esa misma URL («CAD Instructor Guide», apendice A):
pregunta 3 «Tool Block - Step 1» en la pag. 4 del PDF (impresa 308; dibujo en la 3), A 81, B 57, C 43, MMGS a 2
decimales, AISI 1020 de 0,0079 g/mm3, opciones 1028,33 / 118,93 / 577,64 / 939,54 y la pista «si no encontras una
opcion a menos del 1 %, revisa el modelo»; pregunta 4 «Step 2» (84, 59, 45); respuestas en la pag. 9 (impresa 313):
«3 d) 939.54 g» y «4 1032.32 g».

La pieza la arma pieza_ej41.py (el ej41 de la practica con cambios minimos anotados) con el perfil de ej41_tool_block/
(sin cambios: e1.json y e2.json salen de gemelo.py por de_build123d.py, y la prueba lo vuelve a generar). Este archivo, en
una sola CATIA, arma las DOS etapas (cada una en su CATPart) y a cada una le pone el material del catalogo (Steel) con
Density 7 900 (material_con_densidad del 22) para que la masa salga de CATIA. El juez (cerrar_con_respuesta), por etapa:
la masa contra la respuesta a 0,1 g (la del 19, el otro examen de SolidWorks: «un chaflan faltante pesa ~1 g»), su
coherencia con el volumen, el volumen contra el gemelo de build123d a 0,5 mm3 y el centro contra el del gemelo a TOL_CDG
por eje (un agujero corrido o el perfil espejado no cambian la masa), y el STEP contra el volumen de CATIA. con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, los dos STEP y las capturas.
"""
import importlib.util
import json
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
EJERCICIOS = os.path.dirname(AQUI)
sys.path.insert(0, os.path.dirname(EJERCICIOS))                  # juez_comun y catia_base
import juez_comun as jc  # noqa: E402


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


e22 = cargar("ej22_catia", os.path.join(EJERCICIOS, "22_ttt_post_cap", "catia.py"))   # material_con_densidad

EJ = "36_cswa_tool_block_e12"
DENSIDAD = 7900.0                   # 0,0079 g/mm3 del examen
RESPUESTA_G = {1: 939.54, 2: 1032.32}
PARTE = {1: "tool_block_e1", 2: "tool_block_e2"}
TOL_MASA_G = 0.1                    # la del 19 (CSWP de SolidWorks, revisor: un chaflan faltante pesa ~1 g)
TOL_VOL = jc.TOL_VOL                # 0,5 mm3
TOL_COHERENCIA = 1e-3


def construir(cb, c, reg, salida):
    croquis = os.path.join(EJERCICIOS, "24_ttt_angle_bracket")          # croquis.py de la practica vive en el molde
    if croquis not in sys.path:
        sys.path.insert(0, croquis)
    pieza = cargar("pieza_ej41", os.path.join(AQUI, "pieza_ej41.py"))
    salida["masa_catia_g"], salida["material_catia"] = {}, {}
    for n in (1, 2):
        ctx = pieza.cuerpo(c, reg, n)
        doc, part, body = ctx["doc"], ctx["part"], ctx["body"]
        m = e22.material_con_densidad(cb, c, doc, part, ("steel", "acero"), DENSIDAD)
        salida["material_catia"][PARTE[n]] = {k: v for k, v in m.items() if k != "traza"}
        if m["ok"]:
            salida["masa_catia_g"][PARTE[n]] = round(m["masa_inercia_kg"] * 1000.0, 3)
        jc.cerrar_parte(cb, c, reg, salida, doc, part, body, PARTE[n], PARTE[n])
        try:
            doc.Close()
        except Exception as e:  # noqa: BLE001
            salida.setdefault("documentos_sin_cerrar", []).append(repr(e)[:200])


def _max_eje(a, b):
    """El mayor de los tres ejes entre dos centros; un NaN da infinito (max() lo deja pasar si queda al final)."""
    difs = [abs(x - y) for x, y in zip(a, b)]
    return float("inf") if len(difs) != 3 or any(d != d for d in difs) else round(max(difs), 4)


def gemelo(correr=subprocess.run):
    """Volumen de las dos etapas con gemelo_b123d.py (.venv-cad): {"1": {"volumen"}, "2": {"volumen"}} o {"error"}."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", os.path.join(AQUI, "gemelo_b123d.py")], capture_output=True, text=True, timeout=600)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:  # noqa: BLE001
        return {"error": f"el gemelo no midio: {ex!r}"[:300]}


def cerrar_con_respuesta(carpeta, medir_gemelo=None):
    """Despues de correr_ejercicio (con_bien=False): por etapa, la masa contra el examen, el gemelo y el STEP."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas, juez = [], {}
    g = (medir_gemelo or gemelo)()
    if "error" in g:
        problemas.append(g["error"])
    vs = s.get("volumen_step_catia_en_build123d")
    for n in (1, 2):
        parte, j = PARTE[n], {"respuesta_g": RESPUESTA_G[n]}
        vc, masa = (s.get("volumen_catia") or {}).get(parte), (s.get("masa_catia_g") or {}).get(parte)
        if vc is None:
            problemas.append(f"etapa {n}: CATIA no midio la pieza")
        if masa is None:
            problemas.append(f"etapa {n}: sin masa de CATIA: {((s.get('material_catia') or {}).get(parte) or {}).get('error')}")
        elif vc is not None:
            j.update({"masa_catia_g": masa, "dif_respuesta_g": round(masa - RESPUESTA_G[n], 3),
                      "densidad_implicita_kg_m3": round(masa / vc * 1e6, 3)})
            if not abs(j["dif_respuesta_g"]) <= TOL_MASA_G:
                problemas.append(f"etapa {n}: {masa} g contra {RESPUESTA_G[n]} del examen")
            if not abs(j["densidad_implicita_kg_m3"] - DENSIDAD) <= TOL_COHERENCIA * DENSIDAD:
                problemas.append(f"etapa {n}: masa sin coherencia con el volumen ({j['densidad_implicita_kg_m3']})")
        gn = (g.get(str(n)) or {}) if "error" not in g else {}
        vg = gn.get("volumen")
        if "error" not in g and vg is None:
            problemas.append(f"etapa {n}: el gemelo no dio volumen")
        elif vg is not None and vc is not None:
            j.update({"volumen_catia": vc, "volumen_gemelo": vg, "dif_gemelo_mm3": round(vc - vg, 3)})
            if not abs(j["dif_gemelo_mm3"]) <= TOL_VOL:
                problemas.append(f"etapa {n}: CATIA {vc} contra el gemelo {vg} mm3")
        # el centro, por eje (revisor del 36: un agujero corrido o el perfil espejado dan el mismo volumen y masa)
        cc, cg = (s.get("cdg_catia_mm") or {}).get(parte), gn.get("cdg")
        if "error" not in g:
            if not cc or not cg or len(cc) != 3 or len(cg) != 3:
                problemas.append(f"etapa {n}: sin centro de CATIA ({cc}) o del gemelo ({cg})")
            else:
                j["dif_cdg_mm"] = _max_eje(cc, cg)
                if not j["dif_cdg_mm"] <= jc.TOL_CDG:
                    problemas.append(f"etapa {n}: el centro de CATIA {cc} no es el del gemelo {cg}")
        v_step = vs.get(parte) if isinstance(vs, dict) else None
        j["volumen_step"] = v_step
        if not isinstance(v_step, (int, float)) or vc is None or not abs(v_step - vc) <= TOL_VOL:
            problemas.append(f"etapa {n}: el STEP ({v_step}) no da el volumen de CATIA ({vc})")
        juez[str(n)] = j
    # auditor de la tanda de CATA (24/10): una cara suelta en el STEP pasaba (salio de verdad en 54_r1 y 31_final3); el
    # control del 24 y del 49: un solido, una cascara, ninguna cara suelta
    sp = s.get("step_catia_en_build123d")
    for p in tuple(PARTE.values()):
        t = sp.get(p) if isinstance(sp, dict) else None
        topo = (t.get("solidos"), t.get("cascaras"), t.get("caras_sueltas")) if isinstance(t, dict) else None
        if topo != (1, 1, 0):
            problemas.append(f"el STEP de {p} no es 1 solido cerrado (solidos, cascaras, caras sueltas: {topo})"
                             + ("" if isinstance(sp, dict) else f" ({sp})"[:200]))
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas and not s["error_juez"]   # una excepcion fuera de un paso: nunca verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + problemas)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_RESPUESTA", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_respuesta(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar la respuesta en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

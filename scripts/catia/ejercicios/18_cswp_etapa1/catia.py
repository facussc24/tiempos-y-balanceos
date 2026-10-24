# -*- coding: utf-8 -*-
"""Ejercicio 18 del banco de CATIA (COLA_CATIA.md, 24/10/2026, CATA): la pieza del CSWP Sample Exam 2 de SolidWorks,
etapa 1, PARAMETRICA en CATIA (lo que evalua el examen: cotas vinculadas y ecuaciones), y sus tres respuestas cambiando
SOLO los parametros.

Papel: CSWP Sample Exam 2 (U. de Alberta, https://sites.ualberta.ca/~dnobes/CSWA/CSWP_Material/CSWP_SampleExam_2.pdf),
pags. 19, 21 y 22 (parametros y densidad) y 27 (respuestas): etapa 1 (A 213, B 200, C 170, D 130, E 41) 14 207,34 g; etapa 2 (225, 210, 176, 137, 39) 16 490,45 g;
etapa 3 (209, 218, 169, 125, 41) 15 100,47 g; densidad 0,0077 g/mm3. No hay bien.py en el banco 3D: correr_ejercicio con
con_bien=False y el veredicto lo da cerrar_con_respuestas().

La pieza la arma pieza_ej27.py (el ej27 de la practica del 19/10, que dio las tres respuestas a 0,02 g o menos, copiado
con cambios minimos anotados en su encabezado): parametros A..E y formulas X = A/3, Y = B/3 + 10; cada croquis acotado
contra sus ejes con formulas; radios C - 80 / C - 65 / C - 56; largos y el plano corrido B + 10 tambien con formula.
Este catia.py le agrega: el material (Steel del catalogo con su parametro Density pasado a 7 700 kg/m3, la del examen)
para que la masa salga de CATIA, las tres etapas cambiando solo A..E, la masa de cada una contra el papel (1 g, la
tolerancia de masa del banco: control masa_esperada) y el volumen contra el gemelo de build123d de la practica sobre los
mismos A..E (gemelo_b123d.py, 0,5 mm3), y el STEP de la etapa 1 medido con build123d.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP y la captura de la etapa 1.
"""
import importlib.util
import json
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y catia_base
sys.path.insert(0, AQUI)                                          # pieza_ej27
import juez_comun as jc  # noqa: E402

_spec = importlib.util.spec_from_file_location("ej07_catia", os.path.join(os.path.dirname(AQUI),
                                                                          "07_tool_block_examen", "catia.py"))
e07 = importlib.util.module_from_spec(_spec)                      # catalogo y Steel: los del 07
_spec.loader.exec_module(e07)
_spec = importlib.util.spec_from_file_location("ej08_catia", os.path.join(os.path.dirname(AQUI), "08_c_clamp_base",
                                                                          "catia.py"))
e08 = importlib.util.module_from_spec(_spec)                      # cambiar la densidad de un material: la del 08
_spec.loader.exec_module(e08)

EJ = "18_cswp_etapa1"
PARTE = "cswp_etapa1"
DENSIDAD_EXAMEN = 7700.0            # kg/m3 = 0,0077 g/mm3 (pag. 19 del examen)
TOL_MASA_G = 1.0                    # la tolerancia de masa del banco (control masa_esperada)
TOL_VOL = 0.5                       # mm3, la de juez_comun
TOL_COHERENCIA = 1e-3
GEMELO = os.path.join(AQUI, "gemelo_b123d.py")


def etapas():
    import pieza_ej27
    return {n: {"A": a, "B": b, "C": c, "D": d, "E": e, "masa_examen_g": m}
            for n, (a, b, c, d, e, m) in pieza_ej27.ETAPAS.items()}


# ------------------------------------------------------------------ CATIA
def acero_del_examen(cb, c, doc, part):
    """Steel del catalogo con su Density pasada a 7 700 kg/m3 (la del examen). Devuelve el dict del material."""
    out = {"ok": False}
    try:
        mdoc = c.Documents.Read(e07.catalogo(cb, c))
        m, familia = e07.buscar_steel(mdoc)
        out["material"] = f"{familia}/{m.Name}"
        part.GetItem("CATMatManagerVBExt").ApplyMaterialOnPart(part, m, 0)
        part.Update()
        dens, _ = e08.inercia(doc)
        out["densidad_catalogo_kg_m3"] = round(dens, 3)
        if abs(dens - e08.DENSIDAD_SIN_MATERIAL) < 1e-6:
            raise RuntimeError("el material no quedo: la densidad sigue en 1000")
        out["parametro_densidad"] = e08.poner_densidad(part, m.Name, DENSIDAD_EXAMEN)
        dens, _ = e08.inercia(doc)
        out["densidad_kg_m3"] = round(dens, 3)
        if not abs(dens - DENSIDAD_EXAMEN) <= 1e-3:
            raise RuntimeError(f"la densidad quedo en {dens}, no en {DENSIDAD_EXAMEN}")
        out["ok"] = True
    except Exception as e:  # noqa: BLE001
        out["error"] = repr(e)[:300]
        out["traza"] = traceback.format_exc()[-400:]
    return out


def construir(cb, c, reg, salida):
    import pieza_ej27
    ets = etapas()
    salida.update({"etapas": {}, "papel": "CSWP Sample Exam 2 (U. de Alberta), pags. 19, 21, 22 y 27",
                   "densidad_examen_kg_m3": DENSIDAD_EXAMEN})
    ctx = pieza_ej27.hacer()(c, reg)              # arma la etapa 1 con sus pasos en reg (la pieza del ej27)
    doc, part, body = ctx["doc"], ctx["part"], ctx["body"]
    mat = acero_del_examen(cb, c, doc, part)
    salida["material_catia"] = {k: v for k, v in mat.items() if k != "traza"}
    pm = part.Parameters

    def poner(n):
        for k in "ABCDE":
            pm.Item(k).Value = float(ets[n][k])
        part.Update()

    def medir_etapa(n):
        def hacer():
            poner(n)
            m = cb.medir(doc, part, body)
            d = {"volumen_catia": m.get("volume"), "cdg_catia_mm": m.get("cdg_mm"),
                 "parametros": {k: pm.Item(k).Value for k in "ABCDEXY"}}
            if mat["ok"]:
                dens, masa = e08.inercia(doc)
                d.update({"densidad_kg_m3": round(dens, 3), "masa_catia_g": round(masa * 1000.0, 3)})
            salida["etapas"][str(n)] = d
            return {k: d.get(k) for k in ("volumen_catia", "masa_catia_g")}
        return hacer

    for n in sorted(ets):
        reg.paso(f"etapa {n}: cambiar SOLO A..E a {[ets[n][k] for k in 'ABCDE']} y medir", medir_etapa(n))
    reg.paso("volver a la etapa 1 (la del STEP)", lambda: poner(1))
    ocultos = [ctx[k] for k in ("pY", "pX", "p25", "p35") if k in ctx]
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, PARTE, PARTE, ocultos=ocultos)
    try:
        doc.Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def gemelo(a, b, c, d, e, correr=subprocess.run):
    """Volumen del gemelo de build123d de la practica sobre los mismos A..E (con .venv-cad)."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", GEMELO] + [str(float(x)) for x in (a, b, c, d, e)], capture_output=True,
                   text=True, timeout=600)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:  # noqa: BLE001
        return {"error": f"el gemelo no midio: {ex!r}"[:300]}


def cerrar_con_respuestas(carpeta, medir_gemelo=gemelo):
    """Despues de correr_ejercicio (con_bien=False: el ok es solo de los pasos): cada etapa contra el papel y contra el
    gemelo de build123d; el STEP de la etapa 1 contra su volumen de CATIA."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)                      # lo deja correr_ejercicio con con_bien=False (revisor del 18)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas, juez = [], {}
    for n, et in etapas().items():
        d = (s.get("etapas") or {}).get(str(n)) or {}
        j = {"masa_examen_g": et["masa_examen_g"]}
        vc, masa = d.get("volumen_catia"), d.get("masa_catia_g")
        if vc is None:
            problemas.append(f"etapa {n} sin medir en CATIA")
            juez[str(n)] = j
            continue
        if masa is None:
            problemas.append(f"etapa {n} sin masa de CATIA: {(s.get('material_catia') or {}).get('error')}")
        else:
            j["masa_catia_g"], j["dif_examen_g"] = masa, round(masa - et["masa_examen_g"], 3)
            implicita = masa / vc * 1e6
            j["densidad_implicita_kg_m3"] = round(implicita, 3)
            if not abs(j["dif_examen_g"]) <= TOL_MASA_G:
                problemas.append(f"etapa {n}: {masa} g contra {et['masa_examen_g']} del examen")
            if not abs(implicita - DENSIDAD_EXAMEN) <= TOL_COHERENCIA * DENSIDAD_EXAMEN:
                problemas.append(f"etapa {n}: masa sin coherencia con el volumen ({implicita})")
        g = medir_gemelo(et["A"], et["B"], et["C"], et["D"], et["E"])
        if "error" in g:
            problemas.append(f"etapa {n}: {g['error']}")
        else:
            j["volumen_gemelo"], j["dif_gemelo_mm3"] = g["volumen"], round(vc - g["volumen"], 3)
            if not abs(j["dif_gemelo_mm3"]) <= TOL_VOL:
                problemas.append(f"etapa {n}: CATIA {vc} contra el gemelo {g['volumen']} mm3")
        juez[str(n)] = j
    vs = s.get("volumen_step_catia_en_build123d")      # sin .venv-cad juez_comun deja un TEXTO: .get() reventaba (24/10)
    v_step = vs.get(PARTE) if isinstance(vs, dict) else None
    v1 = ((s.get("etapas") or {}).get("1") or {}).get("volumen_catia")
    if not isinstance(v_step, (int, float)) or v1 is None or not abs(v_step - v1) <= TOL_VOL:
        problemas.append(f"el STEP de la etapa 1 ({v_step}) no da su volumen de CATIA ({v1})")
    s["juez_por_etapa"] = juez
    s["ok"] = s["ok_pasos"] and not problemas and not s["error_juez"]   # una excepcion fuera de un paso: nunca verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + problemas)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_RESPUESTAS", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"],
                                        "masas": {k: v.get("masa_catia_g") for k, v in juez.items()},
                                        "dif_gemelo": {k: v.get("dif_gemelo_mm3") for k, v in juez.items()}}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_respuestas(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar las respuestas en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

# -*- coding: utf-8 -*-
"""Ejercicio 22 del banco de CATIA (COLA_CATIA.md, 24/10/2026, CATA): Too Tall Toby PPP01-02 «Post Cap» (guia de
build123d, https://build123d.readthedocs.io/en/stable/tttt.html, libre para uso educativo) en CATIA: tapa por Shaft con el
borde de arriba en cuarto de elipse, asa con Rib de una elipse por un arco R17, hueco por Groove con desmolde de 4 grados y
R3, y R1 donde el asa se junta con la tapa. Respuesta de la guia: 43,09 g en ABS de 1 020 kg/m3. No hay bien.py en el
banco 3D: correr_ejercicio con con_bien=False y el veredicto lo da cerrar_con_respuesta().

La pieza la arma pieza_ej30.py (el ej30 de la practica del 19/10, que dio 43,09 = 43,09, copiado con cambios minimos
anotados en su encabezado). Este catia.py le agrega: el material (ABS del catalogo si esta; si no, Steel; con su
parametro Density en 1 020 kg/m3) para que la masa salga de CATIA, la masa contra la guia (1 g, la tolerancia de masa del
banco: control masa_esperada), el volumen ANTES del R1 contra el gemelo de build123d de la practica (que no lleva los R1:
0,5 mm3) y el STEP medido con build123d.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP y la captura.
"""
import importlib.util
import json
import os
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y catia_base
sys.path.insert(0, AQUI)                                          # pieza_ej30
import juez_comun as jc  # noqa: E402

_spec = importlib.util.spec_from_file_location("ej08_catia", os.path.join(os.path.dirname(AQUI), "08_c_clamp_base",
                                                                          "catia.py"))
e08 = importlib.util.module_from_spec(_spec)                      # catalogo, inercia y cambiar la densidad: los del 08
_spec.loader.exec_module(e08)

EJ = "22_ttt_post_cap"
PARTE = "post_cap"
MASA_GUIA_G = 43.09                 # guia de build123d (tttt.html, PPP01-02)
DENSIDAD_GUIA = 1020.0              # kg/m3, ABS (rotulo del plano)
TOL_MASA_G = 1.0                    # la tolerancia de masa del banco (control masa_esperada)
TOL_VOL = 0.5                       # mm3, la de juez_comun
TOL_COHERENCIA = 1e-3
GEMELO = os.path.join(AQUI, "gemelo_b123d.py")
PREFERIDOS = ("abs",)               # nombre del material del catalogo que se busca primero


def material_con_densidad(cb, c, doc, part, preferidos, densidad):
    """Un material del catalogo (el primero cuyo nombre empiece con alguno de `preferidos`; si no hay, Steel) con su
    parametro Density en `densidad`. Por indice: Item("nombre") volvia vacio (catia.md)."""
    out = {"ok": False}
    try:
        fs = c.Documents.Read(e08.catalogo(cb, c)).Families
        todos = [(fs.Item(i).Name, fs.Item(i).Materials.Item(j)) for i in range(1, fs.Count + 1)
                 for j in range(1, fs.Item(i).Materials.Count + 1)]
        elegido = next(((f, m) for p in preferidos for f, m in todos if m.Name.strip().lower().startswith(p)), None)
        if elegido is None:
            elegido = next(((f, m) for f, m in todos if m.Name.strip().lower() in ("steel", "acero")), None)
            out["sin_preferido"] = f"el catalogo no trae {preferidos}: se usa Steel con la densidad de la guia"
        if elegido is None:
            raise KeyError("el catalogo no trae ni el material buscado ni Steel")
        familia, m = elegido
        out["material"] = f"{familia}/{m.Name}"
        part.GetItem("CATMatManagerVBExt").ApplyMaterialOnPart(part, m, 0)
        part.Update()
        dens, _ = e08.inercia(doc)
        out["densidad_catalogo_kg_m3"] = round(dens, 3)
        if abs(dens - e08.DENSIDAD_SIN_MATERIAL) < 1e-6:
            raise RuntimeError("el material no quedo: la densidad sigue en 1000")
        if not abs(dens - densidad) <= 1e-6:
            out["parametro_densidad"] = e08.poner_densidad(part, m.Name, densidad)
        dens, masa = e08.inercia(doc)
        out["densidad_kg_m3"] = round(dens, 3)
        if not abs(dens - densidad) <= 1e-3:
            raise RuntimeError(f"la densidad quedo en {dens}, no en {densidad}")
        out["masa_inercia_kg"] = masa
        out["ok"] = True
    except Exception as e:  # noqa: BLE001
        out["error"] = repr(e)[:300]
        out["traza"] = traceback.format_exc()[-400:]
    return out


def construir(cb, c, reg, salida):
    import pieza_ej30
    ctx = pieza_ej30.cuerpo(c, reg)               # arma la pieza con sus pasos en reg (la del ej30)
    doc, part, body = ctx["doc"], ctx["part"], ctx["body"]
    salida["volumen_sin_r1_catia"] = ctx.get("vol_sin_r1")
    salida["cdg_sin_r1_catia"] = ctx.get("cdg_sin_r1")           # pedido 10: el centro, contra el del gemelo
    m = material_con_densidad(cb, c, doc, part, PREFERIDOS, DENSIDAD_GUIA)
    salida["material_catia"] = {k: v for k, v in m.items() if k != "traza"}
    if m["ok"]:
        salida["masa_catia_g"] = round(m["masa_inercia_kg"] * 1000.0, 3)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, PARTE, PARTE, ocultos=ctx.get("planos", []))
    try:
        doc.Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def gemelo(correr=subprocess.run):
    """Volumen del gemelo de build123d de la practica (sin los R1 del asa), con .venv-cad."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", GEMELO], capture_output=True, text=True, timeout=600)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:  # noqa: BLE001
        return {"error": f"el gemelo no midio: {ex!r}"[:300]}


def _max_eje(a, b):
    """El mayor de los tres ejes entre dos centros; infinito si falta uno o hay un NaN (max() lo deja pasar al final)."""
    try:
        difs = [abs(float(x) - float(y)) for x, y in zip(a, b)] if len(a) == 3 and len(b) == 3 else []
    except (TypeError, ValueError):
        difs = []
    return float("inf") if len(difs) != 3 or any(d != d for d in difs) else round(max(difs), 4)


def cerrar_con_respuesta(carpeta, medir_gemelo=gemelo):
    """Despues de correr_ejercicio (con_bien=False): la masa contra la guia, el volumen sin R1 contra el gemelo y el STEP
    contra el volumen de CATIA."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)                      # lo deja correr_ejercicio con con_bien=False (revisor del 18)
    if "error_juez" not in s:          # idempotente: el error de correr_ejercicio queda aparte (pedido 10)
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    problemas, juez = [], {"masa_guia_g": MASA_GUIA_G}
    vc, masa = (s.get("volumen_catia") or {}).get(PARTE), s.get("masa_catia_g")
    if vc is None:
        problemas.append("la pieza no se midio en CATIA")
    if masa is None:
        problemas.append(f"sin masa de CATIA: {(s.get('material_catia') or {}).get('error')}")
    elif vc is not None:                          # revisor: con «elif vc» un 0,0 se salteaba en silencio
        juez.update({"masa_catia_g": masa, "dif_guia_g": round(masa - MASA_GUIA_G, 3),
                     "densidad_implicita_kg_m3": round(masa / vc * 1e6, 3)})
        if not abs(juez["dif_guia_g"]) <= TOL_MASA_G:
            problemas.append(f"{masa} g contra {MASA_GUIA_G} de la guia")
        if not abs(juez["densidad_implicita_kg_m3"] - DENSIDAD_GUIA) <= TOL_COHERENCIA * DENSIDAD_GUIA:
            problemas.append(f"masa sin coherencia con el volumen ({juez['densidad_implicita_kg_m3']})")
    v_sin = s.get("volumen_sin_r1_catia")
    g = medir_gemelo()
    if "error" in g:
        problemas.append(g["error"])
    elif v_sin is None:
        problemas.append("no se leyo el volumen de CATIA antes del R1")
    else:
        juez.update({"volumen_gemelo_sin_r1": g["volumen"], "dif_gemelo_mm3": round(v_sin - g["volumen"], 3)})
        if not abs(juez["dif_gemelo_mm3"]) <= TOL_VOL:
            problemas.append(f"CATIA sin R1 {v_sin} contra el gemelo {g['volumen']} mm3")
        # el centro (pedido 10 de la principal): el gemelo no tiene los R1 del asa, asi que va contra el de CATIA antes
        # del R1 (con los R1 el centro se corre 0,013 mm en x: mas que TOL_CDG)
        c_sin, cg = s.get("cdg_sin_r1_catia"), g.get("cdg")
        juez["dif_cdg_gemelo_mm"] = _max_eje(c_sin, cg)
        if not juez["dif_cdg_gemelo_mm"] <= jc.TOL_CDG:
            problemas.append(f"el centro de CATIA sin R1 {c_sin} no es el del gemelo {cg}")
    vs = s.get("volumen_step_catia_en_build123d")      # si build123d no midio, juez_comun deja un texto
    v_step = vs.get(PARTE) if isinstance(vs, dict) else None
    if not isinstance(v_step, (int, float)) or vc is None or not abs(v_step - vc) <= TOL_VOL:
        problemas.append(f"el STEP ({v_step}) no da el volumen de CATIA ({vc})")
    st = s.get("step_catia_en_build123d")              # centro y topologia del STEP (juez_comun, desde 72d5c027)
    st = st.get(PARTE) if isinstance(st, dict) else None
    if not isinstance(st, dict):
        problemas.append(f"sin el centro y la topologia del STEP ({s.get('step_catia_en_build123d')})")
    else:
        juez.update({"step_solidos": st.get("solidos"),
                     "dif_cdg_step_mm": _max_eje(st.get("cdg_mm"), (s.get("cdg_catia_mm") or {}).get(PARTE))})
        if st.get("solidos") != 1 or st.get("caras_sueltas") != 0:
            problemas.append(f"el STEP no es 1 solido cerrado ({st.get('solidos')} solidos, {st.get('caras_sueltas')} "
                             "caras sueltas)")
        if not juez["dif_cdg_step_mm"] <= jc.TOL_CDG:
            problemas.append(f"el centro del STEP {st.get('cdg_mm')} no es el de CATIA")
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

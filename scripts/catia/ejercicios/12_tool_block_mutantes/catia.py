# -*- coding: utf-8 -*-
"""Ejercicio 12 del banco de CATIA (COLA_CATIA.md, 24/10/2026, CATA): los tres MUTANTES del Tool Block del examen de
muestra CATIA V5 Associate (ejercicio 13 del banco 3D) hechos en CATIA, para ver que el juez los FRENA.

Un control sirve si deja pasar la BIEN y frena las MAL (banco 3D). El 07 hizo la BIEN de las cuatro preguntas en CATIA
y dio la lamina 12 a 0,004 g; este hace las tres MAL del banco, cada una en su CATPart, con el 07 entero (sus croquis de
perfil_2d.py, sus planos y su material) y la operacion que falta salteada:
  mal_1_q3: la q3 SIN el agujero de 14 (mal_1_q3_sin_agujero_14.py);
  mal_2_q5: la q5 SIN la ranura R41 (mal_2_q5_sin_corte_r41.py): el agujero de 11 corta la altura entera;
  mal_3_q6: la q6 con el vaciado de 1 derecho hasta la pared de atras, SIN la pared alrededor de la ranura
            (mal_3_q6_vaciado_sin_paredes.py): UN vaciado del hueco entero de z 12 a C en vez de las dos zonas.
Cada parte va corrida i x 150 en x como en el STEP de su mutante (q3 en 0, q5 en 300, q6 en 450). Cada operacion se
mide contra su cuenta en Python puro (perfil_2d; el vaciado unico = hueco x (C - 12) menos lo que ya saco la ranura
dentro del hueco y el agujero de 11 arriba de la ranura).

El juez (ok) pide las tres cosas, en cada mutante:
  1. el cruce con build123d sobre el MISMO mutante del banco (0,5 mm3 y 0,01 mm de centro de gravedad): CATIA
     reproduce el modelo malo;
  2. la masa de CATIA (Steel del catalogo, 7 860 kg/m3) a MAS de 1 g de la lamina 12 (934,78 / 625,00 / 430,39 g):
     el control de la masa da ROJO;
  3. esa masa a 1 g o menos de la del mutante que dice tarea.yaml del 13 (986,81 a mano; 798,54 y 416,20 del modelo).
Si CATIA hiciera la pieza BIEN en vez del mutante, el punto 2 lo frena: el juez no puede dar verde con la pieza buena.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, un STEP y una captura BMP por mutante.
"""
import importlib.util
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun (scripts/catia o el paquete del obrero)
import juez_comun as jc  # noqa: E402

_spec = importlib.util.spec_from_file_location("ej07_catia", os.path.join(os.path.dirname(AQUI),
                                                                          "07_tool_block_examen", "catia.py"))
e07 = importlib.util.module_from_spec(_spec)                      # croquis, planos y material: los del 07
_spec.loader.exec_module(e07)
p2 = e07.p2

EJ = "13_examen_catia_associate"
# parte: (pregunta, paso, A, B, C, lugar en x (i x 150), lo que se saltea, mutante del banco)
MUTANTES = {
    "mal_1_q3": ("q3", 3, 81.0, 57.0, 43.0, 0, "agujero_14", "mal_1_q3_sin_agujero_14.py"),
    "mal_2_q5": ("q5", 5, 86.0, 58.0, 44.0, 2, "corte_r41", "mal_2_q5_sin_corte_r41.py"),
    "mal_3_q6": ("q6", 6, 86.0, 58.0, 44.0, 3, "paredes_ranura", "mal_3_q6_vaciado_sin_paredes.py"),
}
MASA_LAMINA_G = dict(e07.MASA_EXAMEN_G)                           # lamina 12 del examen (tarea.yaml del 13)
MASA_MUTANTE_G = {"mal_1_q3": 986.81, "mal_2_q5": 798.54, "mal_3_q6": 416.20}   # tarea.yaml del 13 (piezas mal_*)
TOL_MASA_G = 1.0                                                  # la del control masa_esperada del 13
DENSIDAD_STEEL = 7860.0                                           # kg/m3, el Steel del catalogo de CATIA (catia.md)
TOL_COHERENCIA = 1e-3


# ------------------------------------------------------------------ la cuenta, en Python puro (sin CATIA)
def cuenta(parte):
    """Lo que suma o saca cada operacion del mutante en CATIA, en orden: [(operacion, mm3)]."""
    q, paso, A, B, C, _i, sin, _s = MUTANTES[parte]
    g = p2.geometria(paso, A, B, C)
    ops = dict(g["ops"])
    r11 = p2.D_AGUJERO_11 / 2
    if sin == "agujero_14":
        return [("base_sin_agujero_14", g["area_perfil"] * C)]
    if sin == "corte_r41":                       # sin la ranura, el agujero de 11 corta la altura entera
        return [("base", ops["base"]), ("rebaje", ops["rebaje"]), ("agujero_11", -math.pi * r11 ** 2 * C)]
    hueco = g["hueco"]
    a_h = p2.area(hueco)
    a_h_y_r41 = a_h - p2.area(p2.region_menos_disco(hueco, g["c41"], p2.R41))
    techo_ranura = p2.OREJA_ATRAS + p2.RANURA
    vaciado = -(a_h * (C - p2.PARED_ATRAS) - a_h_y_r41 * p2.RANURA - math.pi * r11 ** 2 * (C - techo_ranura))
    return [("base", ops["base"]), ("rebaje", ops["rebaje"]), ("ranura", ops["ranura"]),
            ("agujero_11", ops["agujero_11"]), ("vaciado_sin_paredes", vaciado)]


# ------------------------------------------------------------------ CATIA
def armar_mutante(cb, c, reg, salida, parte, mat):
    q, paso, A, B, C, i, sin, _s = MUTANTES[parte]
    dx = i * e07.SEPARACION
    g = p2.geometria(paso, A, B, C)
    ops = cuenta(parte)
    salida["volumen_cuenta_mm3"][parte] = round(sum(v for _, v in ops), 3)
    salida["x_corrido_mm"][parte] = dx
    doc, part, body, sf = cb.nueva_pieza(c, f"tool_block_{parte}")
    est = {"planos": [], "m": None, "ops": list(ops)}

    def siguiente(nombre):
        op, v = est["ops"].pop(0)
        if op != nombre:
            raise RuntimeError(f"la operacion {nombre} no es la que sigue en la cuenta ({op})")
        return v

    def plano(z):
        p = jc.plano_a(part, body, z)
        est["planos"].append(p)
        return p

    def base():
        est["p_medio"] = plano(C / 2)
        circ = []
        nombre = "base_sin_agujero_14"
        if sin != "agujero_14":
            h, v, r = g["agujero_14"]
            circ, nombre = [(h + dx, v, r)], "base"
        sk = e07.croquis_tramos(cb, part, body, est["p_medio"], [p2.mover(g["perfil"], dx)], circ)
        _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, C / 2, siguiente(nombre), simetrico=True)
        return info

    def vaciar(op, pl, mitad, contornos=(), circulos=()):
        def hacer():
            sk = e07.croquis_tramos(cb, part, body, pl, [p2.mover(k, dx) for k in contornos],
                                    [(h + dx, v, r) for h, v, r in circulos])
            _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, mitad, siguiente(op), antes=est["m"],
                                           vaciado=True, simetrico=True)
            return info
        return hacer

    texto_base = "sin el agujero de 14" if sin == "agujero_14" else "con el agujero de 14"
    seguir = reg.paso(f"{parte}: perfil (A {A:g}, B {B:g}) {texto_base}, pad de {C / 2:g} por lado desde z {C / 2:g}",
                      base) is not None
    if paso >= 5 and seguir:
        est["p_frente"] = plano(C)
        seguir = reg.paso(f"{parte}: rebaje de {p2.REBAJE:g} (pocket de {p2.REBAJE:g} por lado desde z {C:g})",
                          vaciar("rebaje", est["p_frente"], p2.REBAJE, [g["rebaje"]])) is not None
        if seguir and sin != "corte_r41":
            z_r = p2.OREJA_ATRAS + p2.RANURA / 2
            est["p_ranura"] = plano(z_r)
            c41 = g["c41"]
            seguir = reg.paso(f"{parte}: ranura R{p2.R41:g} de z {p2.OREJA_ATRAS:g} a {p2.OREJA_ATRAS + p2.RANURA:g}",
                              vaciar("ranura", est["p_ranura"], p2.RANURA / 2,
                                     circulos=[(c41[0], c41[1], p2.R41)])) is not None
        if seguir:
            h, v, r = g["agujero_11"]
            seguir = reg.paso(f"{parte}: agujero de {2 * r:g} pasante en ({h + dx:g}, {v:g})",
                              vaciar("agujero_11", est["p_medio"], C / 2 + 1, circulos=[(h, v, r)])) is not None
    if paso >= 6 and seguir:
        reg.paso(f"{parte}: vaciado de {p2.PARED:g} del hueco ENTERO de z {p2.PARED_ATRAS:g} a {C:g}, sin la pared "
                 f"alrededor de la ranura (pocket de {C - p2.PARED_ATRAS:g} por lado desde z {C:g})",
                 vaciar("vaciado_sin_paredes", est["p_frente"], C - p2.PARED_ATRAS, [g["hueco"]]))
    if est["ops"]:
        salida.setdefault("operaciones_sin_hacer", {})[parte] = [op for op, _ in est["ops"]]
    if est["m"] is None:                    # cuerpo vacio: medirlo (tambien la inercia) rompe la sesion (catia.md)
        salida["material_catia"][parte] = {"ok": False, "error": "no se aplico: la base no se pudo hacer"}
    else:
        m = e07.material_y_masa(cb, c, doc, part, mat)
        salida["material_catia"][parte] = {k: v for k, v in m.items() if k != "traza"}
        if m.get("traza"):
            reg.datos.setdefault("material_trazas", {})[parte] = m["traza"]
        if m["ok"]:
            salida["masa_catia_g"][parte] = round(m["masa_inercia_kg"] * 1000.0, 3)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, f"tool_block_{parte}", parte, ocultos=est["planos"])
    try:                                    # cada mutante en su CATPart, cerrado al terminar (poca RAM en CATA)
        doc.Close()
    except Exception as e:  # noqa: BLE001
        salida.setdefault("documentos_sin_cerrar", {})[parte] = repr(e)[:200]


def build123d_de_los_mutantes(salida):
    """correr_ejercicio midio el bien.py del 13 (las cuatro preguntas BIEN): eso queda aparte, informativo. El cruce de
    este ejercicio es contra cada mal_*.py del banco: se mide cada uno (escribe un STEP por pregunta, <nombre>__q3.step
    ...) y de cada uno se toma la pregunta que cambia."""
    salida["build123d_bien_aparte"] = {"volumen": salida.get("volumen_build123d"), "cdg_mm": salida.get("cdg_build123d_mm")}
    salida["volumen_build123d"], salida["cdg_build123d_mm"], salida["build123d_mutantes"] = {}, {}, {}
    banco = os.path.join(jc.REPO, "evals", "banco3d", "ejercicios", EJ)
    for parte, (q, *_r, script) in MUTANTES.items():
        b = jc.medir_b123d(["bien", os.path.join(banco, script), os.path.join(salida["_carpeta"], "_b123d_" + parte)])
        if "error" in b:
            salida["build123d_mutantes"][parte] = {"error": b["error"]}
            continue
        claves = [k for k in (b.get("partes") or {}) if k.endswith("__" + q)]
        if len(claves) != 1:
            salida["build123d_mutantes"][parte] = {"error": f"partes con __{q}: {claves}"}
            continue
        d = b["partes"][claves[0]]
        salida["volumen_build123d"][parte], salida["cdg_build123d_mm"][parte] = d.get("volumen"), d.get("cdg_mm")
        salida["build123d_mutantes"][parte] = {"script": script, "parte_del_step": claves[0], "seg": b.get("seg")}


def construir(cb, c, reg, salida):
    build123d_de_los_mutantes(salida)
    salida.update({"mutantes": {p: {"pregunta": m[0], "saltea": m[6], "banco": m[7]} for p, m in MUTANTES.items()},
                   "masa_lamina_g": MASA_LAMINA_G, "masa_mutante_g": MASA_MUTANTE_G, "masa_catia_g": {},
                   "material_catia": {}, "volumen_cuenta_mm3": {}, "x_corrido_mm": {}})
    mat = {}
    for parte in MUTANTES:
        try:                                 # un mutante que falla no frena a los otros
            armar_mutante(cb, c, reg, salida, parte, mat)
        except Exception:  # noqa: BLE001
            reg.pasos.append({"paso": f"{parte}: armar el mutante", "ok": False, "error": traceback.format_exc()[-600:]})
            print(f"  FALLA {parte}: {traceback.format_exc()[-300:]}")


def cerrar_con_juez(carpeta):
    """Despues de correr_ejercicio (ok = CATIA reproduce cada mutante): la masa de cada mutante contra la lamina 12 (tiene
    que dar ROJO) y contra la del mutante (tiene que coincidir)."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_cruce_build123d"] = bool(s.get("ok"))
    masas = s.get("masa_catia_g") or {}
    vc = s.get("volumen_catia") or {}
    juez, problemas = {}, []
    vb, b_mut = s.get("volumen_build123d") or {}, s.get("build123d_mutantes") or {}
    for parte, (q, *_r) in MUTANTES.items():
        if vb.get(parte) is None or (s.get("diferencia_mm3") or {}).get(parte) is None:
            # revisor 24/10: comparar() mira solo las partes que midio build123d; un mutante sin medir pasaba sin cruce
            problemas.append(f"{parte} sin cruce de build123d: {(b_mut.get(parte) or {}).get('error', 'no se midio')}")
        m = masas.get(parte)
        if m is None:
            juez[parte] = {"masa_catia_g": None}
            problemas.append(f"{parte} sin masa de CATIA: {((s.get('material_catia') or {}).get(parte) or {}).get('error')}")
            continue
        d_lam, d_mut = round(m - MASA_LAMINA_G[q], 3), round(m - MASA_MUTANTE_G[parte], 3)
        implicita = m / vc[parte] * 1e6 if vc.get(parte) else None
        coherente = implicita is not None and abs(implicita - DENSIDAD_STEEL) <= TOL_COHERENCIA * DENSIDAD_STEEL
        juez[parte] = {"masa_catia_g": m, "lamina_g": MASA_LAMINA_G[q], "dif_lamina_g": d_lam,
                       "rojo_contra_lamina": abs(d_lam) > TOL_MASA_G, "mutante_g": MASA_MUTANTE_G[parte],
                       "dif_mutante_g": d_mut, "masa_del_mutante": abs(d_mut) <= TOL_MASA_G,
                       "densidad_implicita_kg_m3": implicita and round(implicita, 3), "coherente": coherente}
        if not juez[parte]["rojo_contra_lamina"]:
            problemas.append(f"{parte}: el control de la masa NO da rojo ({m} g contra {MASA_LAMINA_G[q]} de la lamina)")
        if not juez[parte]["masa_del_mutante"]:
            problemas.append(f"{parte}: {m} g, a {d_mut} g de la masa del mutante ({MASA_MUTANTE_G[parte]})")
        if not coherente:
            problemas.append(f"{parte}: masa sin coherencia con el volumen (densidad {implicita})")
    s["juez_por_mutante"] = juez
    s["juez_da_rojo_en_los_tres"] = all(j.get("rojo_contra_lamina") for j in juez.values())
    s["ok"] = s["ok_cruce_build123d"] and not problemas
    if problemas:
        texto = "; ".join(problemas)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_JUEZ", json.dumps({"ok": s["ok"], "ok_cruce_build123d": s["ok_cruce_build123d"],
                                  "juez_da_rojo_en_los_tres": s["juez_da_rojo_en_los_tres"],
                                  "masas": {p: j.get("masa_catia_g") for p, j in juez.items()}}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_juez(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar el juez en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

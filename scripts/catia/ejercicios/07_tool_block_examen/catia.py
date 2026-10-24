# -*- coding: utf-8 -*-
"""Ejercicio 07 del obrero: el Tool Block del examen de muestra «CATIA V5 Associate - Part Design (PDG) Sample Exam»
(Dassault Systemes) en sus cuatro estados (preguntas 3 a 6), hecho en CATIA Part Design por COM, con el material Steel del
catalogo de CATIA y la masa leida de CATIA (24/10/2026).

Geometria: la del ejercicio 13 del banco 3D (evals/banco3d/ejercicios/13_examen_catia_associate/_tool_block.py y
tarea.yaml: cotas de las laminas 04 a 11 y los supuestos de lectura del plano), con las MISMAS cotas y en las MISMAS
coordenadas que el STEP de bien.py: la pregunta i va corrida i x 150 en x (q3 en 0, q4 en 150, q5 en 300, q6 en 450).
Los croquis salen de perfil_2d.py (la misma cuenta que _tool_block, en Python puro: en la notebook el Python de CATIA no
tiene build123d). Cada operacion se controla midiendo lo que saco o sumo contra la cuenta de perfil_2d (1 mm3).

A, B, C parametricos (laminas 05, 06 y 09): se RECONSTRUYE cada pregunta en su CATPart con las coordenadas calculadas
afuera, no se cambian parametros ni formulas de un croquis restringido. Es lo mas robusto por COM en R21: todo lo que
usa (rectas y arcos atados a sus puntos, pad y pocket simetricos, plano desplazado) esta probado en los ejercicios 04 a
06 del juez; un croquis con tangencias restringidas y formulas no se probo con este perfil (el ej41 de la practica del
19/10 tambien dibujo el perfil por coordenadas).

Operaciones (todas las extrusiones simetricas desde un plano: el sentido no se adivina; la mitad que cae al aire no saca
nada): base = perfil con el agujero de 14, pad de C/2 por lado desde z = C/2; q5 y q6: rebaje de 19 (pocket de 19 por
lado desde z = C), ranura R41 de z 12 a 36 (pocket de 12 por lado desde z = 24), agujero de 11 pasante; q6: vaciado en dos
zonas desde z = C (el hueco del bloque corrido 1 hacia adentro menos el disco R42, 32 por lado: z 12 a C; y el hueco
entero, 7 por lado: z 37 a C, que deja 1 delante de la ranura).

Material: catalogo de la instalacion (Catalog.CATMaterial), familia Metal, «Steel», con CATMatManagerVBExt +
ApplyMaterialOnPart (catia.md, fem.poner_acero de la practica del 19/10); el control es la densidad releida (7 860; sin
material da 1 000). Masa: SPAWorkbench.Inertias sobre el producto de la pieza, en kg (y Product.Analyze.Mass para cruzar).
Si el material no queda, salida.json lo dice, no lleva masa de esa pregunta y el ok sale solo del cruce de volumen.

ok = cruce con build123d dentro de la tolerancia del juez (0,5 mm3 y 0,01 mm de centro de gravedad por pregunta) Y masa
de CATIA a 1 g o menos de la lamina 12 del examen (934,78 / 1027,09 / 625,00 / 430,39 g).

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, un STEP y una captura BMP por pregunta.
"""
import json
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun (scripts/catia o el paquete del obrero)
sys.path.insert(0, AQUI)                                          # perfil_2d
import juez_comun as jc  # noqa: E402
import perfil_2d as p2  # noqa: E402

EJ = "13_examen_catia_associate"          # id del ejercicio del BANCO: correr_ejercicio arma con el la ruta de bien.py
# pregunta: (paso, A, B, C) de las laminas 05, 06, 09 y 11 (tarea.yaml del 13)
PREGUNTAS = {"q3": (3, 81.0, 57.0, 43.0), "q4": (4, 84.0, 59.0, 45.0), "q5": (5, 86.0, 58.0, 44.0),
             "q6": (6, 86.0, 58.0, 44.0)}
MASA_EXAMEN_G = {"q3": 934.78, "q4": 1027.09, "q5": 625.00, "q6": 430.39}      # lamina 12 del examen (tarea.yaml)
TOL_MASA_G = 1.0                           # la del pedido del 5d (tarea.yaml, control masa_esperada)
SEPARACION = 150.0                         # _tool_block.SEPARACION: la pregunta i va corrida i x 150 en x
DENSIDAD_SIN_MATERIAL = 1000.0             # kg/m3: lo que da CATIA sin material (catia.md)
TOL_COHERENCIA = 1e-3                      # masa / volumen contra la densidad que dice CATIA (0,1 %)
DECISION = ("A, B, C: cada pregunta se reconstruye en su CATPart con las coordenadas calculadas afuera (perfil_2d.py); "
            "no se cambian parametros de un croquis restringido (lo mas robusto por COM en R21)")


def dibujar(f, contorno):
    """Contorno de rectas y arcos atados a sus puntos (como croquis.dibujar de la practica del 19/10): un punto que se
    repite se crea una vez y lo comparten los dos tramos; si no, CATIA no lo toma como cerrado. Los arcos van con sus
    angulos explicitos (CATIA dibuja antihorario de inicio a fin)."""
    puntos = {}

    def pt(q):
        k = (round(q[0], 9), round(q[1], 9))
        if k not in puntos:
            puntos[k] = f.CreatePoint(float(q[0]), float(q[1]))
        return puntos[k]
    for t in contorno:
        if t[0] == "L":
            _, a, b = t
            ln = f.CreateLine(float(a[0]), float(a[1]), float(b[0]), float(b[1]))
            ln.StartPoint, ln.EndPoint = pt(a), pt(b)
        else:
            _, cc, r, a, b, anti = t
            if not anti:
                a, b = b, a
            ini, fin = p2.angulo(cc, a), p2.angulo(cc, b)
            while fin <= ini:
                fin += p2.TAU
            ar = f.CreateCircle(float(cc[0]), float(cc[1]), float(r), ini, fin)
            ar.CenterPoint = f.CreatePoint(float(cc[0]), float(cc[1]))
            ar.StartPoint, ar.EndPoint = pt(a), pt(b)
    return len(puntos)


def croquis_tramos(cb, part, body, plano, contornos=(), circulos=()):
    """Croquis en `plano` (paralelo a XY: H -> X, V -> Y) con contornos de perfil_2d y circulos (h, v, r)."""
    sk = body.Sketches.Add(cb.ref(part, plano))
    f = sk.OpenEdition()
    for c_ in contornos:
        dibujar(f, c_)
    for h, v, r in circulos:
        f.CreateClosedCircle(float(h), float(v), float(r))
    sk.CloseEdition()
    part.Update()
    return sk


def renombrar_build123d(salida):
    """medir_b123d mide cada STEP de la carpeta de bien.py: el conjunto (los cuatro solidos) y uno por pregunta
    (<nombre>__q3.step ...). El juez compara por nombre de parte: cada pregunta pasa a llamarse q3..q6 y el conjunto queda
    aparte, informativo (CATIA no lo arma)."""
    vb, cdg = salida.get("volumen_build123d", {}), salida.get("cdg_build123d_mm", {})
    for k in list(vb):
        q = k.rsplit("__", 1)[-1] if "__" in k else None
        if q in PREGUNTAS:
            vb[q], cdg[q] = vb.pop(k), cdg.pop(k, None)
        elif k not in PREGUNTAS:
            salida.setdefault("build123d_aparte", {})[k] = {"volumen": vb.pop(k), "cdg_mm": cdg.pop(k, None)}


def catalogo(cb, c):
    cand = []
    if os.environ.get("CATIA_CATALOGO_MATERIALES"):
        cand.append(os.environ["CATIA_CATALOGO_MATERIALES"])
    cand.append(os.path.join(cb.CATIA_INSTALADA, "intel_a", "startup", "materials", "Catalog.CATMaterial"))
    for r in cand:
        if os.path.isfile(r):
            return r
    try:                                    # otra instalacion: la carpeta de arranque que dice la propia CATIA
        for p in str(c.SystemService.Environ("CATStartupPath")).split(";"):
            r = os.path.join(p.strip(), "materials", "Catalog.CATMaterial")
            cand.append(r)
            if p.strip() and os.path.isfile(r):
                return r
    except Exception:  # noqa: BLE001
        pass
    raise FileNotFoundError(f"no esta el catalogo de materiales de CATIA (probado: {cand})")


def buscar_steel(mdoc):
    """«Steel» de la familia Metal; si no esta ahi, «Steel» o «Acero» en cualquier familia (por indice: en VBScript
    Materials.Item("Steel") volvia vacio sin error, material_catia.py del 19/10)."""
    fs = mdoc.Families
    hallados = []
    for i in range(1, fs.Count + 1):
        fam = fs.Item(i)
        ms = fam.Materials
        for j in range(1, ms.Count + 1):
            m = ms.Item(j)
            if m.Name.strip().lower() in ("steel", "acero"):
                hallados.append((0 if fam.Name == "Metal" and m.Name == "Steel" else 1, fam.Name, m))
    if not hallados:
        raise KeyError("el catalogo no trae Steel ni Acero")
    hallados.sort(key=lambda x: x[0])
    return hallados[0][2], hallados[0][1]


def material_y_masa(cb, c, doc, part, mat):
    """Aplica Steel y lee la masa. Va FUERA del registro de pasos: si el material no se puede poner, el ok sale del cruce
    de volumen (pedido del 24/10), no de una falla de paso. No inventa una masa: sin densidad de acero, no hay masa."""
    out = {"ok": False}
    try:
        if "doc" not in mat:
            mat["ruta"] = catalogo(cb, c)
            mat["doc"] = c.Documents.Read(mat["ruta"])
        m, familia = buscar_steel(mat["doc"])
        out["material"], out["catalogo"] = f"{familia}/{m.Name}", mat["ruta"]
        part.GetItem("CATMatManagerVBExt").ApplyMaterialOnPart(part, m, 0)
        part.Update()
        try:
            doc.Activate()
        except Exception:  # noqa: BLE001
            pass
        ine = doc.GetWorkbench("SPAWorkbench").Inertias.Add(doc.Product)
        dens = float(ine.Density)
        out["densidad_kg_m3"] = round(dens, 3)
        if abs(dens - DENSIDAD_SIN_MATERIAL) < 1e-6:
            raise RuntimeError("el material no quedo: la densidad sigue en 1000 (la de una pieza sin material)")
        out["masa_inercia_kg"] = float(ine.Mass)
        try:
            out["masa_analyze_kg"] = float(doc.Product.Analyze.Mass)
        except Exception as e:  # noqa: BLE001
            out["masa_analyze_error"] = repr(e)[:200]
        out["ok"] = True
    except Exception as e:  # noqa: BLE001
        out["error"] = repr(e)[:300]
        out["traza"] = traceback.format_exc()[-500:]
    return out


def armar(cb, c, reg, salida, q, paso, A, B, C, dx, mat):
    nombre = f"tool_block_{q}"
    g = p2.geometria(paso, A, B, C)
    ops = dict(g["ops"])
    salida["volumen_cuenta_2d_mm3"][q] = round(g["volumen"], 3)
    salida["x_corrido_mm"][q] = dx
    doc, part, body, sf = cb.nueva_pieza(c, nombre)
    est = {"planos": [], "m": None}

    def plano(z):
        p = jc.plano_a(part, body, z)
        est["planos"].append(p)
        return p

    def base():
        est["p_medio"] = plano(C / 2)
        h, v, r = g["agujero_14"]
        sk = croquis_tramos(cb, part, body, est["p_medio"], [p2.mover(g["perfil"], dx)], [(h + dx, v, r)])
        _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, C / 2, ops["base"], simetrico=True)
        return info

    def vaciar(op, pl, mitad, contornos=(), circulos=()):
        def hacer():
            sk = croquis_tramos(cb, part, body, pl, [p2.mover(k, dx) for k in contornos],
                                [(h + dx, v, r) for h, v, r in circulos])
            _, est["m"], info = jc.extruir(cb, doc, part, body, sf, sk, mitad, ops[op], antes=est["m"], vaciado=True,
                                           simetrico=True)
            return info
        return hacer

    seguir = reg.paso(f"{q}: perfil de la lamina 04 (A {A:g}, B {B:g}) con el agujero de 14, pad de {C / 2:g} por lado "
                      f"desde z {C / 2:g}", base) is not None
    if paso >= 5 and seguir:
        est["p_frente"] = plano(C)
        seguir = reg.paso(f"{q}: rebaje de {p2.REBAJE:g} en la orejeta (x < {A - p2.ANCHO_DER:g}) y en el diente "
                          f"(y < {p2.ORE_Y_BAJO:g}): pocket de {p2.REBAJE:g} por lado desde z {C:g}",
                          vaciar("rebaje", est["p_frente"], p2.REBAJE, [g["rebaje"]])) is not None
        if seguir:
            z_r = p2.OREJA_ATRAS + p2.RANURA / 2
            est["p_ranura"] = plano(z_r)
            c41 = g["c41"]
            seguir = reg.paso(f"{q}: ranura R{p2.R41:g} de z {p2.OREJA_ATRAS:g} a {p2.OREJA_ATRAS + p2.RANURA:g} (centro "
                              f"x {c41[0] + dx:g}, y {c41[1]:.4f}): pocket de {p2.RANURA / 2:g} por lado desde z {z_r:g}",
                              vaciar("ranura", est["p_ranura"], p2.RANURA / 2, circulos=[(c41[0], c41[1], p2.R41)])) \
                is not None
        if seguir:
            h, v, r = g["agujero_11"]
            seguir = reg.paso(f"{q}: agujero de {2 * r:g} pasante en ({h + dx:g}, {v:g})",
                              vaciar("agujero_11", est["p_medio"], C / 2 + 1, circulos=[(h, v, r)])) is not None
    if paso >= 6 and seguir:
        seguir = reg.paso(f"{q}: vaciado con paredes de {p2.PARED:g}, zona sin el R{p2.R41 + p2.PARED:g}: z "
                          f"{p2.PARED_ATRAS:g} a {C:g} (pocket de {C - p2.PARED_ATRAS:g} por lado desde z {C:g})",
                          vaciar("vaciado_sin_ranura", est["p_frente"], C - p2.PARED_ATRAS, [g["hueco_sin_ranura"]])) \
            is not None
        if seguir:
            zt = g["z_tapa_ranura"]
            reg.paso(f"{q}: vaciado delante de la ranura: z {zt:g} a {C:g} (pocket de {C - zt:g} por lado desde z {C:g})",
                     vaciar("vaciado_delante", est["p_frente"], C - zt, [g["hueco"]]))
    if est["m"] is None:                    # cuerpo vacio: medirlo (tambien la inercia) rompe la sesion (catia.md)
        salida["material_catia"][q] = {"ok": False, "error": "no se aplico: la base no se pudo hacer"}
    else:
        m = material_y_masa(cb, c, doc, part, mat)
        salida["material_catia"][q] = {k: v for k, v in m.items() if k != "traza"}
        if m.get("traza"):
            reg.datos.setdefault("material_trazas", {})[q] = m["traza"]
        if m["ok"]:
            salida["masa_catia_g"][q] = round(m["masa_inercia_kg"] * 1000.0, 3)
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, nombre, q, ocultos=est["planos"])
    try:                                    # cada pregunta en su CATPart, cerrado al terminar (poca RAM en CATA)
        doc.Close()
    except Exception as e:  # noqa: BLE001
        salida.setdefault("documentos_sin_cerrar", {})[q] = repr(e)[:200]


def construir(cb, c, reg, salida):
    renombrar_build123d(salida)
    salida.update({"preguntas": {q: {"A": A, "B": B, "C": C} for q, (_p, A, B, C) in PREGUNTAS.items()},
                   "decision_parametrica": DECISION, "masa_examen_g": dict(MASA_EXAMEN_G), "masa_catia_g": {},
                   "material_catia": {}, "volumen_cuenta_2d_mm3": {}, "x_corrido_mm": {}})
    mat = {}
    for i, (q, (paso, A, B, C)) in enumerate(PREGUNTAS.items()):
        try:                                 # una pregunta que falla no frena a las otras
            armar(cb, c, reg, salida, q, paso, A, B, C, i * SEPARACION, mat)
        except Exception:  # noqa: BLE001
            reg.pasos.append({"paso": f"{q}: armar la pregunta", "ok": False, "error": traceback.format_exc()[-600:]})
            print(f"  FALLA {q}: {traceback.format_exc()[-300:]}")


def cerrar_con_masa(carpeta):
    """Despues de correr_ejercicio (que decide el ok con el cruce de volumen): agrega la masa contra el examen y
    recalcula el ok. Se reescribe salida.json en el mismo proceso (el obrero lo lee cuando el proceso termina)."""
    ruta = os.path.join(carpeta, "salida.json")
    s = json.load(open(ruta, encoding="utf-8"))
    s["ok_cruce_build123d"] = bool(s.get("ok"))
    masas = {q: v for q, v in (s.get("masa_catia_g") or {}).items() if v is not None}
    mats = s.get("material_catia") or {}
    s["masa_examen_g"] = dict(MASA_EXAMEN_G)
    s["dif_masa_g"] = {q: (round(masas[q] - MASA_EXAMEN_G[q], 3) if q in masas else None) for q in PREGUNTAS}
    s["tolerancia_masa_g"] = TOL_MASA_G
    vc = s.get("volumen_catia") or {}
    coh = {}
    for q in masas:
        dens = (mats.get(q) or {}).get("densidad_kg_m3")
        if vc.get(q) and dens:
            implicita = masas[q] / vc[q] * 1e6            # g/mm3 -> kg/m3
            coh[q] = {"densidad_implicita_kg_m3": round(implicita, 3), "densidad_catia_kg_m3": dens,
                      "coherente": abs(implicita - dens) <= TOL_COHERENCIA * dens}
    s["masa_sobre_volumen"] = coh
    faltan = [q for q in PREGUNTAS if q not in masas]
    malas = [q for q in masas if abs(s["dif_masa_g"][q]) > TOL_MASA_G or not coh.get(q, {}).get("coherente", False)]
    if faltan:
        s["masa_no_leida"] = {q: (mats.get(q) or {}).get("error", "no se llego a aplicar el material") for q in faltan}
    s["ok_masa"] = (not malas) if not faltan else (None if not masas else not malas)
    s["ok"] = s["ok_cruce_build123d"] and not malas
    if malas:
        texto = (f"masa de CATIA a mas de {TOL_MASA_G:g} g del examen (o sin coherencia con el volumen) en {malas}: "
                 f"dif_masa_g {s['dif_masa_g']}")
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_MASA", json.dumps({"ok": s["ok"], "ok_cruce_build123d": s["ok_cruce_build123d"], "ok_masa": s["ok_masa"],
                                  "masa_catia_g": masas, "dif_masa_g": s["dif_masa_g"]}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_masa(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo agregar la masa a salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)

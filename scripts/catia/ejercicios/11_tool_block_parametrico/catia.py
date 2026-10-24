# -*- coding: utf-8 -*-
"""Ejercicio 11 del banco de CATIA (cola del 24/10/2026): el Tool Block del examen de muestra «CATIA V5 Associate - Part
Design (PDG) Sample Exam» (Dassault Systemes) como UNA pieza PARAMETRICA (Knowledgeware): parametros A, B, C, croquis
restringido como lo haria quien rinde el examen (tangencias, puntos sobre rectas, cotas) con FORMULAS sobre A y B, y la
extrusion con largo C. Se construye con las cotas de la pregunta 3 (lamina 05: A 81, B 57, C 43) y despues se cambian
SOLO los tres parametros a los de la pregunta 4 (lamina 06: A 84, B 59, C 45): CATIA regenera la pieza sola.

Respuesta conocida: lamina 12 del examen, 934,78 g (q3) y 1 027,09 g (q4), material Steel del catalogo de CATIA, 1 g.
Cruce: bien.py del ejercicio 13 del banco 3D (build123d), partes q3 y q4. bien.py pone la q4 corrida 150 en x
(_tool_block.SEPARACION); aca las dos estan en el origen: el centro de gravedad de la q4 se corre 150 antes de comparar y
salida.json guarda tambien el crudo.

Geometria: la de perfil_2d.py del ejercicio 07 (la cuenta de _tool_block del 13 en Python puro; los supuestos de lectura
del plano estan en el tarea.yaml del 13). El 07 dibujaba cada pregunta por coordenadas; aca el croquis se dibuja con
las coordenadas de la q3 y queda TOTALMENTE RESTRINGIDO: CROQUIS (abajo) declara puntos, rectas, arcos y restricciones, y
gdl() cuenta los grados de libertad (tiene que dar cero). Las restricciones que no dependen de A y B se crean con el
valor que mide CATIA sobre lo dibujado y se RELEEN contra el plano; las que dependen de A y B llevan formula.

ok = cruce con build123d (0,5 mm3 y 0,01 mm por pregunta) Y masa de CATIA a 1 g o menos de la lamina 12 en las dos
preguntas Y todas las restricciones del croquis resueltas despues del cambio de parametros.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, un STEP y una captura BMP por pregunta.
"""
import importlib.util
import json
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
EJERCICIOS = os.path.dirname(AQUI)
sys.path.insert(0, os.path.dirname(EJERCICIOS))                    # juez_comun (scripts/catia o el paquete del obrero)
sys.path.insert(0, os.path.join(EJERCICIOS, "07_tool_block_examen"))  # perfil_2d
import juez_comun as jc  # noqa: E402
import perfil_2d as p2  # noqa: E402


def _cargar_07():
    """El catia.py del 07: catalogo de materiales, Steel, material_y_masa y renombrar_build123d (se reusan, no se copian)."""
    spec = importlib.util.spec_from_file_location("ej07_catia", os.path.join(EJERCICIOS, "07_tool_block_examen",
                                                                              "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


EJ = "13_examen_catia_associate"           # id del ejercicio del BANCO 3D (bien.py de las cuatro preguntas)
NOMBRE = "tool_block_parametrico"
ESTADOS = (("q3", 81.0, 57.0, 43.0), ("q4", 84.0, 59.0, 45.0))    # laminas 05 y 06
MASA_EXAMEN_G = {"q3": 934.78, "q4": 1027.09}                     # lamina 12
TOL_MASA_G = 1.0
SEPARACION_B123D = 150.0                   # _tool_block.SEPARACION: bien.py pone la pregunta i en x = i x 150 (q3 = 0)
TOL_RELEER = 1e-6                          # mm o grados: lo que mide CATIA sobre lo dibujado contra el plano
DIST, SOBRE, ANGULO, TANGENTE, HORIZ, RADIO = 1, 2, 6, 4, 10, 14   # CatConstraintType (NOTAS 19/10, enums.py)


# ---------------------------------------------------------------- el croquis, declarado (Python puro)
def croquis(A, B):
    """Puntos, rectas, arcos y restricciones del perfil de la lamina 04 con el agujero de 14, para A y B dados.
    Restricciones: ("x"|"y", punto, valor_mm, formula o None) distancia al eje V (coordenada x) o al eje H (y);
    ("en_V"|"en_H", punto); ("H", recta); ("angulo_H", recta, grados); ("radio", arco_o_circulo, mm);
    ("tangente", a, b); ("sobre", punto, recta)."""
    k = p2.puntos(A, B)
    ch, y0, y1 = p2.ORE_CHAFLAN, p2.ORE_Y_BAJO, p2.ORE_Y_BAJO + p2.ORE_ALTO
    pts = {"P1": (0.0, y0 + ch), "P2": (0.0, y1 - ch), "P3": (ch, y1), "P4": (p2.ORE_X_AGUJERO, y1), "T1": k["t1"],
           "P6": k["p_r19"], "P7": (A - p2.CHAFLAN_DER, B), "P8": (A, B - p2.CHAFLAN_DER), "P9": (A, B - p2.COTA_24),
           "P10": (A - p2.COTA_29, 0.0), "P11": k["p_abajo"], "T3": k["t3"], "T2": k["t2"], "P14": (ch, y0),
           "C19": k["c19"], "C29": k["c29"], "C5": k["f5"], "C14": (p2.ORE_X_AGUJERO, p2.ORE_Y_AGUJERO)}
    rectas = [("L1", "P1", "P2"), ("L2", "P2", "P3"), ("L3", "P3", "P4"), ("L4", "P4", "T1"), ("L5", "P6", "P7"),
              ("L6", "P7", "P8"), ("L7", "P8", "P9"), ("L8", "P9", "P10"), ("L9", "P10", "P11"), ("L10", "T2", "P14"),
              ("L11", "P14", "P1")]
    # (nombre, centro, radio, desde, hasta, antihorario): el mismo recorrido que p2.perfil
    arcos = [("A19", "C19", p2.R19, "T1", "P6", True), ("A29", "C29", p2.R29, "P11", "T3", False),
             ("A5", "C5", p2.R5, "T3", "T2", True)]
    circulos = [("O14", "C14", p2.D_AGUJERO_14 / 2)]
    R = [("en_V", "P1"), ("y", "P1", y0 + ch, None), ("en_V", "P2"), ("y", "P2", y1 - ch, None),
         ("x", "P3", ch, None), ("y", "P3", y1, None), ("x", "P4", p2.ORE_X_AGUJERO, None), ("y", "P4", y1, None),
         ("x", "P14", ch, None), ("y", "P14", y0, None),
         ("angulo_H", "L4", p2.ANGULO_10), ("radio", "A19", p2.R19), ("tangente", "L4", "A19"),
         ("x", "P6", A - p2.COTA_29, "A - 29mm"), ("y", "P6", B, "B"), ("H", "L5"),
         ("x", "P7", A - p2.CHAFLAN_DER, "A - 5mm"),
         ("x", "P8", A, "A"), ("y", "P8", B - p2.CHAFLAN_DER, "B - 5mm"),
         ("x", "P9", A, "A"), ("y", "P9", B - p2.COTA_24, "B - 24mm"),
         ("x", "P10", A - p2.COTA_29, "A - 29mm"), ("en_H", "P10"), ("H", "L9"),
         ("radio", "A29", p2.R29), ("sobre", "C29", "L8"), ("y", "C29", p2.Y_CENTRO_R29, None),
         ("radio", "A5", p2.R5), ("tangente", "A5", "A29"), ("tangente", "A5", "L10"), ("H", "L10"),
         ("x", "C14", p2.ORE_X_AGUJERO, None), ("y", "C14", p2.ORE_Y_AGUJERO, None), ("radio", "O14", 7.0)]
    return {"puntos": pts, "rectas": rectas, "arcos": arcos, "circulos": circulos, "restricciones": R}


def gdl(cr):
    """Grados de libertad que quedan: 2 por punto (los centros tambien), 1 por radio, menos 2 por arco (sus dos puntas
    estan sobre la circunferencia), menos 1 por restriccion. Un croquis totalmente restringido da 0."""
    libres = 2 * len(cr["puntos"]) + len(cr["arcos"]) + len(cr["circulos"]) - 2 * len(cr["arcos"])
    return libres - len(cr["restricciones"])


# ---------------------------------------------------------------- CATIA
def dibujar_y_restringir(cb, part, sk, cr):
    """Dibuja el croquis con las coordenadas de la q3 y le pone las restricciones. Devuelve (objetos, restricciones
    creadas, relectura de los valores que no llevan formula)."""
    f = sk.OpenEdition()
    ax = sk.AbsoluteAxis
    eje = {"H": ax.HorizontalReference, "V": ax.VerticalReference}
    obj = {n: f.CreatePoint(float(x), float(y)) for n, (x, y) in cr["puntos"].items()}
    for n, a, b in cr["rectas"]:
        (x1, y1), (x2, y2) = cr["puntos"][a], cr["puntos"][b]
        ln = f.CreateLine(float(x1), float(y1), float(x2), float(y2))
        ln.StartPoint, ln.EndPoint = obj[a], obj[b]
        obj[n] = ln
    for n, c, r, a, b, anti in cr["arcos"]:
        if not anti:
            a, b = b, a                        # CATIA dibuja antihorario de inicio a fin
        cc = cr["puntos"][c]
        ini, fin = p2.angulo(cc, cr["puntos"][a]), p2.angulo(cc, cr["puntos"][b])
        while fin <= ini:
            fin += p2.TAU
        ar = f.CreateCircle(float(cc[0]), float(cc[1]), float(r), ini, fin)
        ar.CenterPoint = obj[c]
        ar.StartPoint, ar.EndPoint = obj[a], obj[b]
        obj[n] = ar
    for n, c, r in cr["circulos"]:
        cc = cr["puntos"][c]
        ci = f.CreateClosedCircle(float(cc[0]), float(cc[1]), float(r))
        ci.CenterPoint = obj[c]
        obj[n] = ci
    cs = sk.Constraints

    def ref(o):
        return part.CreateReferenceFromObject(o)
    creadas, relectura = [], []
    for r_ in cr["restricciones"]:
        t = r_[0]
        if t in ("x", "y"):
            c_ = cs.AddBiEltCst(DIST, ref(obj[r_[1]]), ref(eje["V" if t == "x" else "H"]))
        elif t in ("en_V", "en_H"):
            c_ = cs.AddBiEltCst(SOBRE, ref(obj[r_[1]]), ref(eje["V" if t == "en_V" else "H"]))
        elif t == "H":
            c_ = cs.AddMonoEltCst(HORIZ, ref(obj[r_[1]]))
        elif t == "angulo_H":
            c_ = cs.AddBiEltCst(ANGULO, ref(obj[r_[1]]), ref(eje["H"]))
        elif t == "radio":
            c_ = cs.AddMonoEltCst(RADIO, ref(obj[r_[1]]))
        elif t == "tangente":
            c_ = cs.AddBiEltCst(TANGENTE, ref(obj[r_[1]]), ref(obj[r_[2]]))
        elif t == "sobre":
            c_ = cs.AddBiEltCst(SOBRE, ref(obj[r_[1]]), ref(obj[r_[2]]))
        else:
            raise ValueError(f"restriccion desconocida {r_}")
        creadas.append((r_, c_))
        if t in ("x", "y", "radio", "angulo_H"):
            val = float(c_.Dimension.Value)
            esperado = r_[2]
            ok = abs(val - esperado) <= TOL_RELEER or (t == "angulo_H" and min(abs(abs(val) - esperado),
                                                                                abs(abs(val) - (180.0 - esperado)))
                                                       <= TOL_RELEER)      # 10, -10 o 170 segun como mida la version
            relectura.append({"restriccion": list(r_[:2]), "catia": round(val, 6), "plano": round(esperado, 6),
                              "ok": ok})
    sk.CloseEdition()
    return obj, creadas, relectura


def estados_restricciones(creadas):
    """Status de cada restriccion (0 = resuelta). Si la propiedad no se puede leer, lo dice (no se toma como 0)."""
    out = []
    for r_, c_ in creadas:
        try:
            out.append(int(c_.Status))
        except Exception as e:  # noqa: BLE001
            out.append(f"sin leer: {repr(e)[:60]}")
    return out


def construir(cb, c, reg, salida, ej07=None):
    ej07 = ej07 or _cargar_07()
    ej07.renombrar_build123d(salida)
    for q in ("q5", "q6"):                    # bien.py arma las cuatro preguntas; este ejercicio usa q3 y q4
        if q in salida["volumen_build123d"]:
            salida.setdefault("build123d_aparte", {})[q] = {"volumen": salida["volumen_build123d"].pop(q),
                                                             "cdg_mm": salida["cdg_build123d_mm"].pop(q, None)}
    salida.update({"masa_examen_g": dict(MASA_EXAMEN_G), "masa_catia_g": {}, "material_catia": {},
                   "volumen_cuenta_2d_mm3": {}, "restricciones": {}, "cdg_catia_crudo_mm": {},
                   # bien.py pone la q4 a 150 en x; aca esta en el origen (el STEP tambien): el cdg se corre para comparar
                   "desplazamiento_por_parte_mm": {q: [(int(q[1:]) - 3) * SEPARACION_B123D, 0.0, 0.0]
                                                   for q, *_ in ESTADOS}})
    q0, A0, B0, C0 = ESTADOS[0]
    cr = croquis(A0, B0)
    salida["gdl_croquis"] = gdl(cr)
    doc, part, body, sf = cb.nueva_pieza(c, NOMBRE)
    est = {"m": None, "mat": {}}

    def parametros():
        pm = part.Parameters
        for k, v in zip("ABC", (A0, B0, C0)):
            pm.CreateDimension(k, "LENGTH", float(v))
        part.Update()
        return {k: pm.Item(k).Value for k in "ABC"}
    if reg.paso(f"parametros A {A0:g}, B {B0:g}, C {C0:g} (lamina 05)", parametros) is None:
        return

    def perfil():
        if gdl(cr) != 0:
            raise RuntimeError(f"el croquis declarado no queda totalmente restringido: {gdl(cr)} grados de libertad")
        sk = body.Sketches.Add(cb.ref(part, part.OriginElements.PlaneXY))
        est["sk"] = sk
        obj, creadas, relectura = dibujar_y_restringir(cb, part, sk, cr)
        est["creadas"] = creadas
        malas = [r_ for r_ in relectura if not r_["ok"]]
        if malas:
            raise RuntimeError(f"cotas que CATIA mide distinto del plano (tomo otro elemento): {malas}")
        formulas = []
        for i, (r_, c_) in enumerate(creadas):
            if r_[0] in ("x", "y") and r_[3]:
                part.Relations.CreateFormula(f"perfil_{i}", "", c_.Dimension, r_[3])
                formulas.append(f"{r_[1]}.{r_[0]} = {r_[3]}")
        part.Update()
        st = estados_restricciones(creadas)
        salida["restricciones"][q0] = st
        if any(s != 0 for s in st):
            raise RuntimeError(f"restricciones sin resolver: {[(r_[:2], s) for (r_, _), s in zip(creadas, st) if s != 0]}")
        return {"restricciones": len(creadas), "formulas": formulas, "gdl": gdl(cr)}
    if reg.paso("croquis de la lamina 04 totalmente restringido: tangencias, puntos sobre rectas, cotas y formulas "
                "sobre A y B", perfil) is None:
        return

    def pad():
        g = p2.geometria(3, A0, B0, C0)
        pd = sf.AddNewPad(est["sk"], float(C0))
        part.Relations.CreateFormula("largo_C", "", pd.FirstLimit.Dimension, "C")
        part.Update()
        m = cb.medir(doc, part, body)
        if m["cdg_mm"][2] < 0:                 # crecio hacia -Z: se da vuelta (el sentido se mide, no se adivina)
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
            m = cb.medir(doc, part, body)
        est["m"], est["pad"] = m, pd
        if abs(m["volume"] - g["volumen"]) > 1.0 or abs(m["cdg_mm"][2] - C0 / 2) > 0.01:
            raise RuntimeError(f"el pad da {m['volume']} mm3 con cdg z {m['cdg_mm'][2]}; la cuenta {g['volumen']:.3f} "
                               f"y z {C0 / 2:g}")
        return {"vol": m["volume"], "cuenta": round(g["volumen"], 3), "cdg_z": m["cdg_mm"][2]}
    if reg.paso("pad de largo C (formula) desde XY, sentido +Z medido", pad) is None:
        return

    for i, (q, A, B, C) in enumerate(ESTADOS):
        if i > 0:
            def cambiar(A=A, B=B, C=C, q=q):
                pm = part.Parameters
                for k, v in zip("ABC", (A, B, C)):
                    pm.Item(k).Value = float(v)
                part.Update()
                st = estados_restricciones(est["creadas"])
                salida["restricciones"][q] = st
                if any(s != 0 for s in st):
                    raise RuntimeError(f"despues del cambio quedan restricciones sin resolver: {st}")
                est["m"] = cb.medir(doc, part, body)
                return {"A": pm.Item("A").Value, "B": pm.Item("B").Value, "C": pm.Item("C").Value,
                        "vol": est["m"]["volume"]}
            if reg.paso(f"cambiar SOLO los parametros a A {A:g}, B {B:g}, C {C:g} (lamina 06) y regenerar",
                        cambiar) is None:
                return
        g = p2.geometria(3, A, B, C)
        salida["volumen_cuenta_2d_mm3"][q] = round(g["volumen"], 3)
        mm = ej07.material_y_masa(cb, c, doc, part, est["mat"])
        salida["material_catia"][q] = {k: v for k, v in mm.items() if k != "traza"}
        if mm.get("ok"):
            salida["masa_catia_g"][q] = round(mm["masa_inercia_kg"] * 1000.0, 3)
        jc.cerrar_parte(cb, c, reg, salida, doc, part, body, f"{NOMBRE}_{q}", q)
        cdg = salida["cdg_catia_mm"].get(q)
        if cdg is not None:
            salida["cdg_catia_crudo_mm"][q] = cdg
            dx = (int(q[1:]) - 3) * SEPARACION_B123D
            salida["cdg_catia_mm"][q] = [cdg[0] + dx, cdg[1], cdg[2]]


def cerrar_con_masa(carpeta):
    """Despues de correr_ejercicio: masa contra la lamina 12 en q3 y q4, y el ok final."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_cruce_build123d"] = bool(s.get("ok"))
    masas = s.get("masa_catia_g") or {}
    s["dif_masa_g"] = {q: (round(masas[q] - MASA_EXAMEN_G[q], 3) if q in masas else None) for q in MASA_EXAMEN_G}
    s["tolerancia_masa_g"] = TOL_MASA_G
    malos = [f"{q}: sin masa ({((s.get('material_catia') or {}).get(q) or {}).get('error', 'no se leyo')})"
             for q in MASA_EXAMEN_G if q not in masas]
    malos += [f"{q}: masa {masas[q]} g a {s['dif_masa_g'][q]} g de la lamina 12" for q in masas
              if abs(s["dif_masa_g"][q]) > TOL_MASA_G]
    # coherencia masa / volumen contra la densidad que dice CATIA (como el 07: una masa leida de otra cosa no pasa)
    vc, mats = s.get("volumen_catia") or {}, s.get("material_catia") or {}
    for q in masas:
        dens = (mats.get(q) or {}).get("densidad_kg_m3")
        if not vc.get(q) or not dens or abs(masas[q] / vc[q] * 1e6 - dens) > 1e-3 * dens:
            malos.append(f"{q}: masa {masas[q]} g sin coherencia con el volumen {vc.get(q)} y la densidad {dens}")
    if s.get("gdl_croquis") != 0:
        malos.append(f"croquis con {s.get('gdl_croquis')} grados de libertad")
    s["ok_masa"] = not malos
    s["ok"] = s["ok_cruce_build123d"] and not malos
    if malos:
        texto = "; ".join(malos)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_MASA", json.dumps({"ok": s["ok"], "masa_catia_g": masas, "dif_masa_g": s["dif_masa_g"], "malos": malos}))
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

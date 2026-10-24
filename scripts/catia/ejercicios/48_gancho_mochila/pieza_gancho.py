# -*- coding: utf-8 -*-
"""Ejercicio 48 del banco de CATIA (24/10/2026, CATA): el gancho de mochila v2 rehecho EN CATIA desde sus datos, con las
MISMAS operaciones y en el MISMO orden que build_gancho.py::construir_gancho() (.claude/skills/cad-design/examples/
gancho_mochila/), leyendo su params.json. No hay ej de la practica: esto se escribe aca, y la respuesta es el STEP que
genera build_gancho.py con ese params.json.

  1. clip en U (lomo + dos alas) de un solo croquis en XY, pad h_clip en +Z (= la union de las tres cajas);
  2. los dos rebajes con rampa: croquis en el plano YZ (x 0) y vaciado p_ala hacia +X;
  3. brazo + nariz: el perfil del brazo en un plano YZ en x0 = -e_lomo, pad ancho_X hacia +X;
  4. R r_fondo_gancho en la arista del fondo (y_fondo, z_fondo) y R r_brazo_clip en la union (y_raiz, z_raiz);
  5. los dos alivios (circulo R r_ala_lomo centrado en la arista ala-lomo, (0, +-yi)) vaciados en todo el alto;
  6. R r_canto_externo en las dos aristas de arriba de la nariz (y_punta_ext y y_fondo, z_punta), en una sola operacion;
  7. el chaflan de entrada: triangulo en XY en x = p_ala, vaciado en todo el alto, en los lados que build_gancho.py
     corta de verdad (LADOS_CHAFLAN: hoy solo -Y, ver abajo).
Las cotas derivadas se calculan como derivadas() de build_gancho.py (la prueba lo compara con build123d)."""
import json
import math
import os

from catia_base import medir, nueva_pieza, ref, poligono, topologia

# Lo que build_gancho.py corta HOY (24/10/2026, medido): el triangulo del chaflan del lado +Y queda en sentido horario,
# build123d lo extruye hacia -Z (de z -28 a 0, debajo de la pieza) y no corta nada: el STEP del gancho v2 tiene solo el
# chaflan de entrada del lado -Y (33 mm3). Si se arregla build_gancho.py, esto pasa a (1, -1) (LECCIONES.md, punto 1).
LADOS_CHAFLAN = (-1,)

PARAMS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(
    __file__)))))), ".claude", "skills", "cad-design", "examples", "gancho_mochila", "params.json")


def cotas(p):
    """Las de construir_gancho() y derivadas() de build_gancho.py, con los mismos nombres."""
    c, b, n, r = p["clip"], p["brazo"], p["nariz"], p["radios"]
    yi = c["boca"] / 2.0
    return {"yi": yi, "ye": yi + c["e_ala"], "h": c["h_clip"], "p_ala": c["p_ala"], "e_lomo": c["e_lomo"],
            "ha": c["h_almohadilla"], "reb": c["rebaje_fuera_de_almohadilla"], "rampa": c["rampa_rebaje"],
            "ent": c["chaflan_entrada"], "y_raiz": yi + c["e_ala"], "x0": -c["e_lomo"],
            "ancho_X": c["e_lomo"] + c["p_ala"], "z_raiz": b["z_raiz"], "y_fondo": b["y_fondo"], "z_fondo": b["z_fondo"],
            "y_punta": n["y_punta_ext"], "z_punta": n["z_punta"], "r_fondo": n["r_fondo_gancho"],
            "r_canto": n["r_canto_externo"], "r_union": r["r_brazo_clip"], "r_alivio": r["r_ala_lomo"]}


def cuerpo(c, reg, params=PARAMS):
    with open(params, encoding="utf-8") as f:
        k = cotas(json.load(f))
    doc, part, body, sf = nueva_pieza(c, "gancho_mochila_v2")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    ctx = {"construccion": [], "cotas": k}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol():
        return medir(doc, part, body)["volume"]

    def croq(plano, pts_lista):
        sk = body.Sketches.Add(ref(part, plano))
        f = sk.OpenEdition()
        for pts in pts_lista:
            poligono(f, pts)
        sk.CloseEdition()
        part.Update()
        return sk

    def plano_yz(x):
        pl = hsf.AddNewPlaneOffset(ref(part, o.PlaneYZ), float(x), False)
        body.InsertHybridShape(pl)
        ctx["construccion"].append(pl)
        part.Update()
        return pl

    def sacado(m0, m1):
        """Centro de lo que saco un vaciado: (V0 c0 - V1 c1) / (V0 - V1)."""
        dv = m0["volume"] - m1["volume"]
        if dv <= 1e-6:
            return None
        return [(m0["volume"] * a - m1["volume"] * b) / dv for a, b in zip(m0["cdg_mm"], m1["cdg_mm"])]

    def vaciar(sk, prof, eje=None):
        """Vaciado que tiene que SACAR material, y del lado que dice `eje` (0 = hacia +X, 2 = hacia +Z): no alcanza con
        que saque algo (48_r1: el rebaje fue hacia -X y comio 120 mm3 del lomo en vez de 390 del ala)."""
        m0 = medir(doc, part, body)
        pk = sf.AddNewPocket(sk, float(prof))
        part.Update()
        c = sacado(m0, medir(doc, part, body))
        if c is None or (eje is not None and c[eje] < 0):
            pk.DirectionOrientation = 1 - pk.DirectionOrientation
            part.Update()
            c = sacado(m0, medir(doc, part, body))
        if c is None or (eje is not None and c[eje] < 0):
            raise RuntimeError(f"el vaciado no saca del lado +{'XYZ'[eje]} ({c})")
        return round(m0["volume"] - vol(), 3)

    yi, ye, h, pa, el = k["yi"], k["ye"], k["h"], k["p_ala"], k["e_lomo"]

    def clip():
        u = [(-el, -ye), (pa, -ye), (pa, -yi), (0.0, -yi), (0.0, yi), (pa, yi), (pa, ye), (-el, ye)]
        pad = sf.AddNewPad(croq(o.PlaneXY, [u]), h)
        part.Update()
        if medir(doc, part, body)["cdg_mm"][2] < 0:
            pad.DirectionOrientation = 1 - pad.DirectionOrientation
            part.Update()
        return {"vol": vol(), "cuenta": round((el * 2 * ye + 2 * pa * (ye - yi)) * h, 3)}
    reg.paso("clip en U (lomo + alas) pad en +Z", clip)

    def rebajes():
        # plano YZ: H -> Y, V -> Z (sonda del ej03); los dos con el mismo vaciado de p_ala hacia +X
        mas = [(yi, k["ha"]), (yi + k["reb"], k["ha"] + k["rampa"]), (yi + k["reb"], h + 1), (yi, h + 1)]
        men = [(-yi, h - k["ha"]), (-yi - k["reb"], h - k["ha"] - k["rampa"]), (-yi - k["reb"], -1.0), (-yi, -1.0)]
        return {"saca_mas": vaciar(croq(o.PlaneYZ, [mas]), pa, eje=0), "saca_menos": vaciar(croq(o.PlaneYZ, [men]), pa, eje=0),
                "cuenta_cada_uno": round((k["reb"] * k["rampa"] / 2 + k["reb"] * (h - k["ha"] - k["rampa"])) * pa, 3)}
    reg.paso("rebajes con rampa en las alas (almohadillas)", rebajes)

    def brazo():
        perfil = [(k["y_raiz"], 0.0), (k["y_punta"], 0.0), (k["y_punta"], k["z_punta"]), (k["y_fondo"], k["z_punta"]),
                  (k["y_fondo"], k["z_fondo"]), (k["y_raiz"], k["z_raiz"])]
        v0 = medir(doc, part, body)
        pad = sf.AddNewPad(croq(plano_yz(k["x0"]), [perfil]), k["ancho_X"])
        part.Update()
        v1 = medir(doc, part, body)
        if v1["cdg_mm"][0] < v0["cdg_mm"][0] - 1.0:       # tiene que crecer hacia +X (de x0 a x0 + ancho_X)
            pad.DirectionOrientation = 1 - pad.DirectionOrientation
            part.Update()
        return {"suma": round(vol() - v0["volume"], 3)}
    reg.paso("brazo + nariz (perfil YZ en x0, pad ancho_X)", brazo)

    def aristas_x(y, z, tol=0.6):
        return [d for d in topologia(doc, body, "Edge") if "cdg" in d and abs(d["cdg"][1] - y) < tol
                and abs(d["cdg"][2] - z) < tol and abs(d.get("medida", 0) - k["ancho_X"]) < 0.5]

    def redondeo(aristas, r, nombre):
        """Prueba cada arista candidata (o el grupo) hasta que CATIA lo hace: el orden de la topologia cambia entre
        corridas (catia.md, CAMBIO 4 del 24)."""
        if not aristas:
            raise RuntimeError(f"no hay aristas para el {nombre}")
        v0 = vol()
        intentos = []
        for i, d in enumerate(aristas):
            try:
                sf.AddNewSolidEdgeFilletWithConstantRadius(d["ref"], 0, float(r))
                part.Update()
                intentos.append(f"candidata {i}: ok")
                break
            except Exception as e:  # noqa: BLE001
                intentos.append(f"candidata {i}: {repr(e)[:80]}")
        else:
            raise RuntimeError(f"el {nombre} no salio: {intentos}")
        return {"aristas": len(aristas), "intentos": intentos, "cambio": round(vol() - v0, 3)}

    reg.paso("R del fondo del gancho", lambda: redondeo(aristas_x(k["y_fondo"], k["z_fondo"]), k["r_fondo"], "R del fondo"))
    reg.paso("R de la union brazo-clip", lambda: redondeo(aristas_x(k["y_raiz"], k["z_raiz"]), k["r_union"],
                                                          "R de la union"))

    def alivios():
        f_pts = []
        sk = body.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        for s in (1, -1):
            ci = f.CreateClosedCircle(0.0, s * yi, k["r_alivio"])
            ci.CenterPoint = f.CreatePoint(0.0, s * yi)
            f_pts.append(s)
        sk.CloseEdition()
        part.Update()
        return {"saca": vaciar(sk, h, eje=2), "circulos": len(f_pts)}
    reg.paso("alivios en la union ala-lomo (circulos R en (0, +-yi))", alivios)

    def nariz():
        ar = aristas_x(k["y_punta"], k["z_punta"]) + aristas_x(k["y_fondo"], k["z_punta"])
        if len(ar) != 2:
            raise RuntimeError(f"la nariz tiene que tener 2 aristas arriba, hay {len(ar)}")
        v0 = vol()
        fi = sf.AddNewSolidEdgeFilletWithConstantRadius(ar[0]["ref"], 0, float(k["r_canto"]))
        fi.AddObjectToFillet(ar[1]["ref"])
        part.Update()
        return {"aristas": 2, "cambio": round(vol() - v0, 3)}
    reg.paso("R de los dos cantos de arriba de la nariz", nariz)

    def chaflanes():
        tri = [[(pa, s * yi), (pa - k["ent"], s * yi), (pa, s * (yi + k["ent"]))] for s in LADOS_CHAFLAN]
        return {"saca": vaciar(croq(o.PlaneXY, tri), h, eje=2), "lados": list(LADOS_CHAFLAN)}
    reg.paso("chaflanes de entrada en la boca", chaflanes)

    ctx.update(doc=doc, part=part, body=body, sf=sf)
    return ctx

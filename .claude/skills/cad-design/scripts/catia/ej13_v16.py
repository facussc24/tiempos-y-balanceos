# -*- coding: utf-8 -*-
"""Nivel 6 — el virolador v16 (dos ranuras) rehecho EN CATIA desde sus datos (v16_ref/poligonos.json, que sale de los
mismos JSON y del mismo metodo de build_v10.py). Uso: ej13_v16.py <etapa 1..5>
1 placa · 2 + cuatro apoyos con tope redondeado R1,5 · 3 + los dos machos (anillo: extrusion + seccion vertice a vertice
+ hueco interior) · 4 + agarraderas · 5 + redondeo R3 de los cantos verticales del borde.
Exporta out_etapaN.stp para comparar con compara.py contra v16_ref/virolador_v10_two.step."""
import json
import math
import os
import sys

from catia_base import (correr, nueva_pieza, ref, poligono, medir, captura, topologia, elegir, aristas_con_extremos,
                        PRACTICA)

ETAPA = int(sys.argv[1]) if len(sys.argv) > 1 else 5
D = json.load(open(os.path.join(PRACTICA, "v16_ref", "poligonos.json"), encoding="utf-8"))
ZB, ZP, ZT, ZC = D["Z_BASE"], D["Z_PLACA"], D["Z_TOPE"], D["Z_CH"]
CX, HX, HY = D["CX"], D["HX"], D["HY"]


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "virolador_v16_catia")
    hsf = part.HybridShapeFactory
    xy = ref(part, part.OriginElements.PlaneXY)

    def plano(body, z):
        p = hsf.AddNewPlaneOffset(xy, float(z), False)
        body.InsertHybridShape(p)
        part.Update()
        return p

    def croquis(body, z, dibujar):
        sk = body.Sketches.Add(ref(part, plano(body, z)))
        f = sk.OpenEdition()
        dibujar(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def cdg_z(obj):
        return medir(doc, part, obj).get("cdg_mm", [0, 0, 0])[2]

    def pad_hacia_arriba(body, sk, alto, z0, suma_esperada=None):
        """Con suma_esperada (area x alto, sin solaparse con nada) el sentido se decide por lo que SUMA: el centro de
        gravedad no sirve en un cuerpo que ya tiene la placa abajo (19/10: lo dio vuelta y el macho se metio en la placa)."""
        # medir un cuerpo VACIO falla y deja rotas todas las mediciones (y el motor de macros) del resto de la corrida
        # (19/10): solo se mide antes cuando hace falta, y ahi el cuerpo ya tiene la placa
        v0 = medir(doc, part, body).get("volume", 0.0) if suma_esperada is not None else 0.0
        pd = sf.AddNewPad(sk, float(alto))
        part.Update()
        if suma_esperada is not None:
            if abs((medir(doc, part, body)["volume"] - v0) - suma_esperada) > 1.0:
                pd.DirectionOrientation = 1
                part.Update()
        elif cdg_z(body) < z0:                            # cuerpo propio: salio para abajo
            pd.DirectionOrientation = 1
            part.Update()
        return pd

    est_ops = {}

    # ---- 1. placa
    def placa():
        part.InWorkObject = main
        sk = croquis(main, ZB, lambda f: poligono(f, [(CX - HX / 2, -HY / 2), (CX + HX / 2, -HY / 2),
                                                     (CX + HX / 2, HY / 2), (CX - HX / 2, HY / 2)]))
        est_ops["placa"] = pad_hacia_arriba(main, sk, ZP - ZB, ZB)
        return medir(doc, part, main)

    reg.paso("1 placa 168 x 58 x 8,5", placa)

    # ---- 2. apoyos
    if ETAPA >= 2:
        for i, a in enumerate(D["apoyos"]):
            def apoyo(a=a):
                b = part.Bodies.Add()
                part.InWorkObject = b
                lx, ly = a["lado_x"], a["lado_y"]
                sk = croquis(b, ZP, lambda f: poligono(f, [(a["x"] - lx / 2, a["y"] - ly / 2), (a["x"] + lx / 2, a["y"] - ly / 2),
                                                          (a["x"] + lx / 2, a["y"] + ly / 2), (a["x"] - lx / 2, a["y"] + ly / 2)]))
                pd = pad_hacia_arriba(b, sk, a["z_tope"] - ZP, ZP)
                arriba = [e for e in aristas_con_extremos(doc, pd)
                          if abs(e["p0"][2] - a["z_tope"]) < .01 and abs(e["p1"][2] - a["z_tope"]) < .01]
                r = min(D["R_PED"], (a["z_tope"] - ZP) / 2 - 0.05, lx / 2 - 0.05, ly / 2 - 0.05)
                fi = sf.AddNewSolidEdgeFilletWithConstantRadius(arriba[0]["ref"], 0, r)
                for e in arriba[1:]:
                    fi.AddObjectToFillet(e["ref"])
                part.Update()
                vb = medir(doc, part, b)["volume"]
                part.InWorkObject = main
                sf.AddNewAdd(b)
                part.Update()
                return {"aristas_de_arriba": len(arriba), "volumen_apoyo": vb}
            reg.paso(f"2 apoyo {i + 1}", apoyo)

    # ---- 3. machos
    if ETAPA >= 3:
        for i, m in enumerate(D["machos"]):
            def macho(m=m):
                # 19/10: armado en un cuerpo aparte y sumado con AddNewAdd, la suma tiraba «el servidor lanzo una
                # excepcion» (intermitente) y dejaba la CATIA danada: el macho se arma ADENTRO del cuerpo principal.
                b = main
                part.InWorkObject = b
                v0 = medir(doc, part, b)["volume"]
                sk1 = croquis(b, ZP, lambda f: poligono(f, m["ext1"]))
                pad_hacia_arriba(b, sk1, ZC - ZP, ZP, suma_esperada=m["area_ext1"] * (ZC - ZP))
                v_recto = medir(doc, part, b)["volume"] - v0
                # la ENTRADA inclinada: la multi-seccion SOLIDA de Part Design falla siempre (hasta con dos hexagonos,
                # dbg_loft.py, 19/10); el camino que anda es el de superficies (dbg_loft2.py): transicion de superficie
                # vertice a vertice (= reglada: 857,13 exacto contra el prismatoide), tapas con relleno, unir con
                # tolerancia 0,01 (con la de fabrica, 0,001, no une los 240 lados) y cerrar a solido adentro del cuerpo
                gs = part.HybridBodies.Add()
                secc = []
                for pts, z in ((m["ext1"], ZC), (m["ext2"], ZT)):
                    pz = hsf.AddNewPlaneOffset(xy, float(z), False)
                    gs.AppendHybridShape(pz)
                    part.Update()
                    sk = gs.HybridSketches.Add(ref(part, pz))
                    f = sk.OpenEdition()
                    poligono(f, pts)
                    sk.CloseEdition()
                    part.Update()
                    secc.append(sk)
                lo = hsf.AddNewLoft()
                lo.SectionCoupling = 4
                for sk in secc:
                    lo.AddSectionToLoft(ref(part, sk), 1, None)
                gs.AppendHybridShape(lo)
                part.Update()                  # de a un elemento: todo junto en un Update tiro «el servidor lanzo una
                tapas = []                     # excepcion» (intermitente, 19/10); asi anduvo siempre en dbg_loft2.py
                for sk in secc:
                    fi = hsf.AddNewFill()
                    fi.AddBound(ref(part, sk))
                    gs.AppendHybridShape(fi)
                    part.Update()
                    tapas.append(fi)
                jn = hsf.AddNewJoin(ref(part, lo), ref(part, tapas[0]))
                jn.AddElement(ref(part, tapas[1]))
                jn.SetDeviation(0.01)
                # sin esto el solido cerrado sale con las caras hacia ADENTRO: el volumen B-Rep da bien pero el STL resta
                # la entrada (el STL de CATIA dio 85 849,6 = 89 278 - 2 x 2 x 857,13; 19/10, dbg_loft2.py)
                jn.Invert = True
                gs.AppendHybridShape(jn)
                part.Update()
                part.InWorkObject = b
                sf.AddNewCloseSurface(ref(part, jn))
                part.Update()
                v_con_entrada = medir(doc, part, b)["volume"] - v0
                # el hueco interior arranca EN la cara de la placa y sube: no la perfora (en el original el hueco solo
                # se resta del anillo, no de la placa)
                ski = croquis(b, ZP, lambda f: poligono(f, m["int"]))
                pk = sf.AddNewPocket(ski, ZT - ZP + 1.0)
                part.Update()
                v_anillo = medir(doc, part, b)["volume"] - v0
                saca_esperado = m["area_int"] * (ZT - ZP)  # hacia arriba saca area x alto del anillo
                if abs((v_con_entrada - v_anillo) - saca_esperado) > 1.0:   # corto para abajo: se invierte
                    pk.DirectionOrientation = 1 - pk.DirectionOrientation
                    part.Update()
                    v_anillo = medir(doc, part, b)["volume"] - v0
                return {"recto": v_recto, "con_entrada": v_con_entrada, "anillo": v_anillo,
                        "esperado_recto": round(m["area_ext1"] * (ZC - ZP), 3)}
            reg.paso(f"3 macho {i + 1}", macho)

    # ---- 4. agarraderas
    if ETAPA >= 4:
        def agarraderas():
            part.InWorkObject = main
            antes = medir(doc, part, main)["volume"]
            dx = HX / 2 + D["AGARRE_R"] - D["AGARRE_E"]

            def dib(f):
                for s in (-1, 1):
                    f.CreateClosedCircle(CX + s * dx, 0.0, D["AGARRE_R"])
            sk = croquis(main, ZB - 1, dib)
            pk = sf.AddNewPocket(sk, ZP - ZB + 2)
            est_ops["agarraderas"] = pk
            part.Update()
            despues = medir(doc, part, main)["volume"]
            if despues >= antes - 1:
                pk.DirectionOrientation = 1 - pk.DirectionOrientation
                part.Update()
                despues = medir(doc, part, main)["volume"]
            # cada agarradera saca el segmento circular de cuerda en x = borde, flecha 4 (r 16): area x espesor
            seg = D["AGARRE_R"] ** 2 * math.acos((D["AGARRE_R"] - D["AGARRE_E"]) / D["AGARRE_R"]) - \
                (D["AGARRE_R"] - D["AGARRE_E"]) * math.sqrt(2 * D["AGARRE_R"] * D["AGARRE_E"] - D["AGARRE_E"] ** 2)
            return {"saca": round(antes - despues, 3), "esperado": round(2 * seg * (ZP - ZB), 3)}
        reg.paso("4 agarraderas", agarraderas)

    # ---- 5. cantos verticales del borde
    if ETAPA >= 5:
        def cantos():
            part.InWorkObject = main
            # las aristas del CUERPO entero: las de la ultima operacion (el corte de las agarraderas) no traen las 4
            # esquinas (19/10: con la ultima operacion se redondearon 4 de 8 y quedaron 65,668 mm3 = 4 esquinas de mas)
            # ...pero NO todas las del cuerpo: con los machos de 240 lados son mas de mil y medir cada una tardo mas de
            # 18 minutos (19/10). Las candidatas son las de la placa (esquinas) y las del corte de las agarraderas.
            ar = aristas_con_extremos(doc, est_ops["placa"]) + aristas_con_extremos(doc, est_ops["agarraderas"])
            vert = [e for e in ar if abs(e["p0"][0] - e["p1"][0]) < .01 and abs(e["p0"][1] - e["p1"][1]) < .01
                    and abs(e["p0"][2] - e["p1"][2]) > 3.0
                    and (abs(abs(e["p0"][0] - CX) - HX / 2) < .05 or abs(abs(e["p0"][1]) - HY / 2) < .05)]
            antes = medir(doc, part, main)["volume"]
            fi = sf.AddNewSolidEdgeFilletWithConstantRadius(vert[0]["ref"], 0, D["R_CANTO"])
            for e in vert[1:]:
                fi.AddObjectToFillet(e["ref"])
            part.Update()
            return {"cantos": len(vert), "saca": round(antes - medir(doc, part, main)["volume"], 3)}
        reg.paso("5 redondeo R3 de los cantos verticales", cantos)

    def ocultar_auxiliares():
        """CATIA EXPORTA lo visible: con los sets de superficies a la vista el STEP salio con 8 cascaras sueltas y 968
        caras de construccion ademas del solido, y el STL con tapas sobre los huecos (19/10). Se ocultan antes de exportar."""
        sel = doc.Selection
        sel.Clear()
        for i in range(1, part.HybridBodies.Count + 1):
            sel.Add(part.HybridBodies.Item(i))
        n = sel.Count
        if n:
            sel.VisProperties.SetShow(1)          # 1 = ocultar
        sel.Clear()
        return {"sets_ocultos": n}

    reg.paso("ocultar las superficies de construccion antes de exportar", ocultar_auxiliares)
    final = reg.paso("volumen final", lambda: medir(doc, part, main))
    reg.datos["referencia_mm3"] = D["volumen_ref_mm3"]
    reg.paso("captura", lambda: captura(c, reg, f"etapa{ETAPA}", ("iso", "arriba")))
    ruta = os.path.join(reg.carpeta, f"out_etapa{ETAPA}.stp")
    if os.path.exists(ruta):
        os.remove(ruta)
    reg.paso("STEP", lambda: (doc.ExportData(ruta, "stp"), ruta)[1])
    cp = os.path.join(reg.carpeta, f"virolador_v16_catia_etapa{ETAPA}.CATPart")
    if os.path.exists(cp):
        os.remove(cp)
    reg.paso("CATPart", lambda: (doc.SaveAs(cp), cp)[1])
    print("FINAL", final, "referencia", round(D["volumen_ref_mm3"], 3))


if __name__ == "__main__":
    correr("ej13_v16", cuerpo, fresca=True)

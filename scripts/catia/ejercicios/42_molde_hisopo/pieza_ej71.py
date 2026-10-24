# -*- coding: utf-8 -*-
# Origen: ej71_molde_hisopo.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA por
# el PEDIDO 27 a «para CATA - practica 19-10»; sha256 5ddc74d8...a0ae). Cambios para el ejercicio 42 del banco de CATIA
# (24/10/2026), nada mas: 1) no importa correr, captura ni os; 2) sin la captura de la primera mitad (la captura y el STEP los
# hace el catia.py con cerrar_parte, sobre el bloque con la cavidad); 3) cuerpo(c, reg) devuelve ctx (doc, part, el
# cuerpo principal) en vez de terminar sin nada; 4) sin el bloque __main__.
"""ej71 — MOLDE DE DOS MITADES de un hisopo de PP (banco E13, MIT 2.008 examen practico 1 de 2022, problema 2).
Geometria simplificada de la solucion: cuerpo 33,3 x 3 y cabeza 15,4 x 8,6 vistos desde la apertura -> la pieza es un
solido de revolucion (cabeza O8,6 x 15,4 + cuerpo O3 x 33,3) con el eje EN el plano de particion.
Publicado: area proyectada 2,32e-4 m2 (232,34 mm2); F = 70 MPa x A = 16,26 kN por pieza; en 80 kN caben 4 (5 = 81,3).
En CATIA: pieza por revolucion, bloque 68,7 x 30 x 30 centrado en el eje, se le RESTA la pieza (cavidad) y se PARTE por
el plano de particion (XY). Controles: volumen de la pieza = cuenta; las dos mitades iguales y su suma = bloque - pieza;
el area de la cara de particion de una mitad = bloque - 232,34 (o sea el area proyectada sale de MEDIR la cara)."""
import math

from catia_base import nueva_pieza, ref, medir, topologia, poligono

RC, LC, RB, LB = 4.3, 15.4, 1.5, 33.3
BX0, BX1, BY, BZ = -10.0, 58.7, 15.0, 15.0
P_CAIDA, F_MAQ = 70.0, 80.0          # MPa, kN


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej71_molde_hisopo")
    o = part.OriginElements
    est = {}
    v_pieza = math.pi * (RC ** 2 * LC + RB ** 2 * LB)
    a_proy = 2 * RC * LC + 2 * RB * LB
    v_bloque = (BX1 - BX0) * 2 * BY * 2 * BZ
    reg.datos["cuentas"] = {"v_pieza": round(v_pieza, 3), "area_proyectada_mm2": round(a_proy, 2),
                            "F_por_pieza_kN": round(P_CAIDA * a_proy / 1000, 2),
                            "caben_en_80kN": int(F_MAQ // (P_CAIDA * a_proy / 1000))}

    def pieza():
        b = part.Bodies.Add()
        b.Name = "hisopo"
        part.InWorkObject = b
        sk = b.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        sk.CenterLine = f.CreateLine(-5.0, 0.0, 60.0, 0.0)
        poligono(f, [(0, 0), (LC + LB, 0), (LC + LB, RB), (LC, RB), (LC, RC), (0, RC)])
        sk.CloseEdition()
        part.Update()
        s = sf.AddNewShaft(sk)
        s.FirstAngle.Value = 360.0
        part.Update()
        est["pieza"] = b
        m = medir(doc, part, b)
        return {"vol": round(m["volume"], 3), "cuenta": round(v_pieza, 3)}
    reg.datos["pieza"] = reg.paso("hisopo por revolucion (eje X en el plano de particion)", pieza)

    def bloque_y_cavidad():
        part.InWorkObject = main
        sk = main.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        poligono(f, [(BX0, -BY), (BX1, -BY), (BX1, BY), (BX0, BY)])
        sk.CloseEdition()
        part.Update()
        pad = sf.AddNewPad(sk, BZ)
        pad.SecondLimit.Dimension.Value = BZ
        part.Update()
        v_b = medir(doc, part, main)["volume"]
        sf.AddNewRemove(est["pieza"])
        part.Update()
        v_c = medir(doc, part, main)["volume"]
        return {"bloque": round(v_b, 3), "cuenta_bloque": round(v_bloque, 3), "con_cavidad": round(v_c, 3),
                "cuenta": round(v_bloque - v_pieza, 3)}
    reg.datos["molde"] = reg.paso("bloque 68,7 x 30 x 30 menos la pieza (cavidad)", bloque_y_cavidad)

    def mitades():
        res = {}
        for lado in (0, 1):
            part.InWorkObject = main
            sp = sf.AddNewSplit(ref(part, o.PlaneXY), lado)
            part.Update()
            m = medir(doc, part, main)
            caras = [d for d in topologia(doc, main, "Face") if "cdg" in d and abs(d["cdg"][2]) < 1e-3]
            res[lado] = {"vol": round(m["volume"], 3), "cdg_z": round(m["cdg_mm"][2], 3),
                         "caras_en_z0": len(caras), "area_particion": round(sum(d["medida"] for d in caras), 3)}
            s = doc.Selection
            s.Clear()
            s.Add(sp)
            s.Delete()
            part.Update()
        a_med = (2 * BY * (BX1 - BX0)) - res[0]["area_particion"]
        res["area_proyectada_medida_mm2"] = round(a_med, 3)
        res["F_por_pieza_kN"] = round(P_CAIDA * a_med / 1000, 3)
        res["caben_en_80kN"] = int(F_MAQ // (P_CAIDA * a_med / 1000))
        res["publicado"] = {"area_mm2": 232.0, "F_kN": 16.2, "caben": 4}
        return res
    reg.datos["mitades"] = reg.paso("partir por el plano XY: dos mitades y cara de particion", mitades)
    return {"doc": doc, "part": part, "body": main}

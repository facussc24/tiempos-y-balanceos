# -*- coding: utf-8 -*-
"""ej28 — CSWP Sample Exam 2, ETAPA 2 (preguntas 4 y 5) PARAMETRICA en CATIA.
Cambios contra la etapa 1 (lectura cerrada con el gemelo ej26_cswp/gemelo_e2.py, 0,03 / 0,01 g):
AA sin bloque ni agujero F, bolsillo de abajo con 5 x R10; CC bolsillo arriba a la izquierda (9 de todo, fondo RECTO en
y = 89 tangente al arco R(C - 89) centrado en (B - C, C), lado derecho x = B - 89 tangente, 3 x R10); BB garganta de 30 a
30 de la punta, 10 de hondo, hecha como Shaft del perfil escalonado (un Groove despues del muro cortaria el muro);
chaflanes 2 x 30 grados; Y = B/3 + 15. Respuestas: 13 206,40 g (221 211 165 121 37) y 14 208,00 g (229 217 163 119 34)."""
import math
import os

from catia_base import captura, correr, guardar_pieza, medir, nueva_pieza, ref, topologia
from ej27_parametrico import Croquis, DIST

PI = math.pi
DENS = 0.0077
PREG = {4: (221, 211, 165, 121, 37, 13206.40), 5: (229, 217, 163, 119, 34, 14208.00)}


def hacer():
    A, B, C, D, E, _ = PREG[4]
    X, Y, W = A / 3, B / 3 + 15, 15.0
    xa, ya, ri = B - C, C, C - 80.0
    ro = ri + W

    def cuerpo(c, reg):
        doc, part, body, sf = nueva_pieza(c, "ej28_cswp_etapa2")
        hsf = part.HybridShapeFactory
        o = part.OriginElements
        ctx = {"part": part, "body": body}
        try:
            c.ActiveWindow.Layout = 2   # 2 = arbol + pieza (0 = SOLO el arbol: pantalla en blanco, 19/10)
        except Exception:  # noqa: BLE001
            pass

        def vol():
            return medir(doc, part, body)["volume"]

        def centro_agregado(m0, m1):
            v0, v1 = m0["volume"], m1["volume"]
            return [(m1["cdg_mm"][i] * v1 - m0["cdg_mm"][i] * v0) / (v1 - v0) for i in range(3)]

        def plano(base, d, expr=None):
            p = hsf.AddNewPlaneOffset(ref(part, base), float(d), False)
            body.InsertHybridShape(p)
            part.Update()
            if expr:
                part.Relations.CreateFormula(f"plano_{expr.replace(' ', '')}", "", p.Offset, expr)
                part.Update()
            return p

        def vaciado(sk, prof, expr=None):
            v0 = vol()
            pk = sf.AddNewPocket(sk, float(prof))
            part.Update()
            if expr:
                part.Relations.CreateFormula(f"prof_{sk.Name}", "", pk.FirstLimit.Dimension, expr)
                part.Update()
            if vol() >= v0 - 1:
                pk.DirectionOrientation = 1 - pk.DirectionOrientation
                part.Update()
            return pk

        def parametros():
            pm = part.Parameters
            for k, v in zip("ABCDE", (A, B, C, D, E)):
                pm.CreateDimension(k, "LENGTH", float(v))
            for k, expr in (("X", "A / 3"), ("Y", "B / 3 + 15mm")):
                p = pm.CreateDimension(k, "LENGTH", 0.0)
                part.Relations.CreateFormula(f"f_{k}", "", p, expr)
            part.Update()
            return {k: round(pm.Item(k).Value, 4) for k in "ABCDEXY"}
        reg.paso("parametros (Y = B/3 + 15 en la etapa 2)", parametros)

        def placa():
            s = Croquis(ctx, o.PlaneXY, "placa").perfil([(0, 0), (B, 0), (B, A), (0, A)], {})
            s.hv()
            s.cst(2, s.ps[0], s.sk.AbsoluteAxis.Origin)
            s.formula(s.cst(5, s.tramos[0]), "B")
            s.formula(s.cst(5, s.tramos[1]), "A")
            sf.AddNewPad(s.cerrar(), 25.0)
            part.Update()
            ar = topologia(doc, body, "Edge")
            r10 = [d for d in ar if "cdg" in d and any(abs(d["cdg"][0] - x) < 1.5 and abs(d["cdg"][1] - y) < 1.5
                                                      for x, y in [(0, 0), (0, A), (B, A), (B, 0)])]
            fi = sf.AddNewSolidEdgeFilletWithConstantRadius(r10[0]["ref"], 0, 10.0)
            for d in r10[1:]:
                fi.AddObjectToFillet(d["ref"])
            part.Update()
            return {"r10": len(r10), "vol": vol()}
        reg.paso("placa B x A x 25 con 4 x R10 (sin bloque: zona AA)", placa)

        def muro():
            yi = ya - math.sqrt(ro ** 2 - W ** 2)
            xi = xa + math.sqrt(ro ** 2 - W ** 2)
            pts = [(xa, 0), (xa + W, 0), (xa + W, yi), (xi, ya - W), (B, ya - W), (B, ya), (xa + ri, ya), (xa, ya - ri)]
            s = Croquis(ctx, o.PlaneXY, "muro").perfil(pts, {2: (xa, ya, ro), 6: (xa, ya, ri)})
            s.hv()
            t = s.tramos
            s.sobre_H(s.ps[0])
            s.a_eje_V(t[7], "B - C")
            s.a_eje_V(t[1], "B - C + 15mm")
            s.a_eje_H(t[3], "C - 15mm")
            s.a_eje_H(t[5], "C")
            s.a_eje_V(t[4], "B")
            cen = list(s.centros.values())[0]
            s.a_eje_V(cen, "B - C")
            s.a_eje_H(cen, "C")
            s.radio(t[2], "C - 65mm")
            s.radio(t[6], "C - 80mm")
            sf.AddNewPad(s.cerrar(), 95.0)
            part.Update()
            return vol()
        reg.paso("muro con el arco", muro)

        def cilindro_con_garganta():
            # perfil escalonado en el plano x = B - C + 7,5 (YZ corrido: H -> Y, V -> Z), revolucion alrededor de z = 95
            pl = plano(o.PlaneYZ, xa + W / 2, "B - C + 7.5mm")
            R, Rn = X / 2, X / 2 - 10
            pts = [(-10, 95), (-10, 95 + R), (20, 95 + R), (20, 95 + Rn), (50, 95 + Rn), (50, 95 + R), (D - 10, 95 + R),
                   (D - 10, 95)]
            s = Croquis(ctx, pl, "cilY").perfil(pts, {})
            s.hv()
            t = s.tramos
            s.a_eje_H(t[7], "95mm")
            s.a_eje_V(t[0], "10mm")
            s.a_eje_V(t[2], "20mm")
            s.a_eje_V(t[4], "50mm")
            s.a_eje_V(t[6], "D - 10mm")
            s.a_eje_H(t[1], "95mm + X / 2")
            s.a_eje_H(t[3], "95mm + X / 2 - 10mm")
            s.a_eje_H(t[5], "95mm + X / 2")
            s.sk.CenterLine = t[7]
            sk = s.cerrar()
            v0 = vol()
            sh = sf.AddNewShaft(sk)
            sh.FirstAngle.Value = 360.0
            part.Update()
            v1 = vol()
            esperado = PI * R ** 2 * (D - 30) + PI * Rn ** 2 * 30
            return {"suma": round(v1 - v0, 1), "cilindro_solo": round(esperado, 1)}
        reg.paso("cilindro en Y con la garganta BB (Shaft del perfil escalonado)", cilindro_con_garganta)

        def cilindro_x():
            pX = plano(o.PlaneYZ, B + 10.0, "B + 10mm")
            ctx["pX"] = pX
            m0 = medir(doc, part, body)
            s = Croquis(ctx, pX, "cilX").circulo(ya - W / 2, 95.0, Y / 2)
            s.a_eje_V(s.cp, "C - 7.5mm")
            s.a_eje_H(s.cp, "95mm")
            s.radio(s.circ, "Y / 2")
            pd = sf.AddNewPad(s.cerrar(), D)
            part.Update()
            part.Relations.CreateFormula("largoX", "", pd.FirstLimit.Dimension, "D")
            part.Update()
            if centro_agregado(m0, medir(doc, part, body))[0] > B + 10:
                pd.DirectionOrientation = 1 - pd.DirectionOrientation
                part.Update()
            return {"orient": pd.DirectionOrientation, "vol": vol()}
        reg.paso("cilindro en X (OD Y = B/3 + 15)", cilindro_x)

        def bolsillos():
            p25 = plano(o.PlaneXY, 25.0)
            ctx["p25"] = p25
            # AA
            rr = ro + 9
            x0 = xa + W + 9
            ya2 = ya - math.sqrt(rr ** 2 - (x0 - xa) ** 2)
            xb = xa + math.sqrt(rr ** 2 - (W + 9) ** 2)
            s = Croquis(ctx, p25, "AA").perfil([(x0, 9), (B - 9, 9), (B - 9, ya - W - 9), (xb, ya - W - 9), (x0, ya2)],
                                               {3: (xa, ya, rr)})
            s.hv()
            t = s.tramos
            s.a_eje_H(t[0], "9mm")
            s.a_eje_V(t[1], "B - 9mm")
            s.a_eje_H(t[2], "C - 24mm")
            s.a_eje_V(t[4], "B - C + 24mm")
            cen = list(s.centros.values())[0]
            s.a_eje_V(cen, "B - C")
            s.a_eje_H(cen, "C")
            s.radio(t[3], "C - 56mm")
            pa = vaciado(s.cerrar(), 20.0)
            # CC
            r2 = ri - 9
            s2 = Croquis(ctx, p25, "CC").perfil([(xa, ya - r2), (9, ya - r2), (9, A - 9), (B - 89, A - 9), (B - 89, ya)],
                                                {4: (xa, ya, r2)})
            s2.hv()
            t2 = s2.tramos
            s2.a_eje_H(t2[0], "89mm")
            s2.a_eje_V(t2[1], "9mm")
            s2.a_eje_H(t2[2], "A - 9mm")
            s2.a_eje_V(t2[3], "B - 89mm")
            cen2 = list(s2.centros.values())[0]
            s2.a_eje_V(cen2, "B - C")
            s2.a_eje_H(cen2, "C")
            s2.radio(t2[4], "C - 89mm")
            pc = vaciado(s2.cerrar(), 20.0)

            def vert(pk, pts):
                return [d for d in topologia(doc, pk, "Edge") if "cdg" in d and 10 <= d["cdg"][2] <= 20 and
                        any(abs(d["cdg"][0] - x) < 1.5 and abs(d["cdg"][1] - y) < 1.5 for x, y in pts)]
            e5 = vert(pa, [(x0, 9), (B - 9, 9), (B - 9, ya - W - 9), (xb, ya - W - 9), (x0, ya2)])
            e3 = vert(pc, [(9, ya - r2), (9, A - 9), (B - 89, A - 9)])
            todos = e5 + e3
            fi = sf.AddNewSolidEdgeFilletWithConstantRadius(todos[0]["ref"], 0, 10.0)
            for d in todos[1:]:
                fi.AddObjectToFillet(d["ref"])
            part.Update()
            return {"r10_AA": len(e5), "r10_CC": len(e3), "vol": vol()}
        reg.paso("bolsillos AA (5 x R10) y CC (fondo recto en 89, 3 x R10)", bolsillos)

        def agujeros():
            pY = plano(o.PlaneZX, -10.0)
            s = Croquis(ctx, pY, "aguY").circulo(95.0, xa + W / 2, E / 2)
            s.a_eje_V(s.cp, "95mm")
            s.a_eje_H(s.cp, "B - C + 7.5mm")
            s.radio(s.circ, "E / 2")
            pk = vaciado(s.cerrar(), D, "D")
            s2 = Croquis(ctx, ctx["pX"], "aguX").circulo(ya - W / 2, 95.0, E / 2)
            s2.a_eje_V(s2.cp, "C - 7.5mm")
            s2.a_eje_H(s2.cp, "95mm")
            s2.radio(s2.circ, "E / 2")
            pk2 = vaciado(s2.cerrar(), D, "D")
            bocas = []
            for p in (pk, pk2):
                bocas += [d for d in topologia(doc, p, "Edge") if abs(d.get("medida", 0) - PI * E) < 0.5]
            v0 = vol()
            ch = sf.AddNewChamfer(bocas[0]["ref"], 0, 1, 0, 2.0, 30.0)       # modo 1 = largo + angulo
            for d in bocas[1:]:
                ch.AddElementToChamfer(d["ref"])
            part.Update()
            return {"bocas": len(bocas), "saca_chaflanes": round(v0 - vol(), 2), "vol": vol()}
        reg.paso("agujeros E y 4 chaflanes 2 x 30 grados", agujeros)

        def preguntas():
            out = {}
            pm = part.Parameters
            for n in (4, 5):
                a, b, cc, d, e, oficial = PREG[n]
                for k, v in zip("ABCDE", (a, b, cc, d, e)):
                    pm.Item(k).Value = float(v)
                part.Update()
                v = vol()
                out[n] = {"vol": v, "masa": round(v * DENS, 2), "oficial": oficial, "dif_g": round(v * DENS - oficial, 2)}
                print(f"     pregunta {n}: {out[n]}")
            return out
        reg.datos["preguntas"] = reg.paso("preguntas 4 y 5 cambiando SOLO los parametros", preguntas)
        reg.paso("captura", lambda: captura(c, reg, "ej28", vistas=("iso", "iso2")))
        try:
            c.ActiveWindow.Layout = 2   # 2 = arbol + pieza (0 = SOLO el arbol: pantalla en blanco, 19/10)
        except Exception:  # noqa: BLE001
            pass
        reg.paso("CATPart + STEP", lambda: guardar_pieza(doc, reg, "ej28_cswp_etapa2"))

    return cuerpo


if __name__ == "__main__":
    correr("ej28_etapa2", hacer(), visible=os.environ.get("CATIA_MIRAR") == "1")

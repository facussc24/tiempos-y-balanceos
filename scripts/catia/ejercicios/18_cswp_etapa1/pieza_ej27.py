# -*- coding: utf-8 -*-
# Origen: ej27_parametrico.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a
# CATA por el PEDIDO PARA CATA 6). Cambios para el ejercicio 18 del banco de CATIA (24/10/2026), nada mas:
# 1) importa solo medir, nueva_pieza, ref y topologia de catia_base (el del repo); 2) cuerpo(c, reg) arma la pieza
# con la etapa 1 y devuelve ctx (doc, part, body y los planos de construccion para ocultarlos); las etapas, la
# masa, la captura y el STEP los hace el catia.py; 3) sin el bloque __main__ (no se corre suelto).
"""ej27 — la pieza del CSWP Sample Exam 2 PARAMETRICA en CATIA (lo que evalua el examen: cotas vinculadas y ecuaciones).
Parametros de usuario A, B, C, D, E y formulas X = A/3, Y = B/3 + 10; cada croquis acotado contra sus ejes con formulas.
Se construye con la etapa 1 y despues SOLO se cambian los parametros: etapas 2 y 3 tienen que dar la respuesta oficial.
Respuestas (pag. 27): 14 207,34 / 16 490,45 / 15 100,47 g con 0,0077 g/mm3. CATIA_MIRAR=1 para que Fak lo vea."""
import math
import os

from catia_base import medir, nueva_pieza, ref, topologia

PI = math.pi
DENS = 0.0077
ETAPAS = {1: (213, 200, 170, 130, 41, 14207.34), 2: (225, 210, 176, 137, 39, 16490.45), 3: (209, 218, 169, 125, 41, 15100.47)}
HORIZ, VERT, DIST, RADIO, SOBRE = 10, 13, 1, 14, 2      # CatConstraintType (enums.py)


class Croquis:
    """Croquis con puntos y tramos atados, y acotado contra sus ejes con formulas sobre los parametros."""

    def __init__(self, ctx, plano, nombre):
        self.c, self.nombre, self.n = ctx, nombre, 0
        part, body = ctx["part"], ctx["body"]
        self.sk = body.Sketches.Add(ref(part, plano))
        self.f = self.sk.OpenEdition()
        ax = self.sk.AbsoluteAxis
        self.H, self.V = ax.HorizontalReference, ax.VerticalReference

    def r(self, o):
        return self.c["part"].CreateReferenceFromObject(o)

    def perfil(self, pts, arcos):
        f = self.f
        self.ps = [f.CreatePoint(x, y) for x, y in pts]
        self.tramos, self.centros, self.tipos = [], {}, []
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            (x1, y1), (x2, y2) = pts[i], pts[j]
            if i in arcos:
                cx, cy, rr = arcos[i]
                a1, a2 = math.atan2(y1 - cy, x1 - cx), math.atan2(y2 - cy, x2 - cx)
                if (a2 - a1) % (2 * PI) < PI:
                    ini, fin, pa, pb = a1, a2, self.ps[i], self.ps[j]
                else:
                    ini, fin, pa, pb = a2, a1, self.ps[j], self.ps[i]
                if fin < ini:
                    fin += 2 * PI
                t = f.CreateCircle(cx, cy, rr, ini, fin)
                key = (round(cx, 6), round(cy, 6))
                if key not in self.centros:
                    self.centros[key] = f.CreatePoint(cx, cy)
                t.CenterPoint = self.centros[key]
                t.StartPoint, t.EndPoint = pa, pb
                self.tipos.append('arco')
            else:
                t = f.CreateLine(x1, y1, x2, y2)
                t.StartPoint, t.EndPoint = self.ps[i], self.ps[j]
                self.tipos.append('H' if abs(y1 - y2) < 1e-9 else 'V' if abs(x1 - x2) < 1e-9 else 'L')
            self.tramos.append(t)
        return self

    def circulo(self, cx, cy, rr):
        self.circ = self.f.CreateClosedCircle(cx, cy, rr)
        self.cp = self.f.CreatePoint(cx, cy)
        self.circ.CenterPoint = self.cp
        return self

    def cst(self, tipo, *objs):
        cs = self.sk.Constraints
        return cs.AddMonoEltCst(tipo, self.r(objs[0])) if len(objs) == 1 else cs.AddBiEltCst(tipo, self.r(objs[0]), self.r(objs[1]))

    def formula(self, cst, expr):
        self.n += 1
        self.c["part"].Relations.CreateFormula(f"{self.nombre}_{self.n}", "", cst.Dimension, expr)

    def hv(self):
        for t, tipo in zip(self.tramos, self.tipos):
            if tipo == "H":
                self.cst(HORIZ, t)
            elif tipo == "V":
                self.cst(VERT, t)

    def a_eje_V(self, obj, expr):        # distancia horizontal al eje vertical del croquis = coordenada H
        self.formula(self.cst(DIST, obj, self.V), expr)

    def a_eje_H(self, obj, expr):        # distancia vertical al eje horizontal = coordenada V
        self.formula(self.cst(DIST, obj, self.H), expr)

    def sobre_H(self, punto):
        self.cst(SOBRE, punto, self.H)

    def radio(self, obj, expr):
        self.formula(self.cst(RADIO, obj), expr)

    def cerrar(self):
        self.sk.CloseEdition()
        self.c["part"].Update()
        return self.sk


def hacer():
    A, B, C, D, E, _ = ETAPAS[1]
    X, Y, W = A / 3, B / 3 + 10, 15.0
    xa, ya, ri = B - C, C, C - 80.0
    ro = ri + W

    def cuerpo(c, reg):
        doc, part, body, sf = nueva_pieza(c, "ej27_cswp_parametrico")
        hsf = part.HybridShapeFactory
        o = part.OriginElements
        ctx = {"part": part, "body": body}
        try:
            c.ActiveWindow.Layout = 2   # 2 = arbol + pieza (0 = SOLO el arbol: pantalla en blanco, 19/10)
        except Exception:  # noqa: BLE001
            pass

        def vol():
            return medir(doc, part, body)["volume"]

        def parametros():
            pm = part.Parameters
            for k, v in zip("ABCDE", (A, B, C, D, E)):
                pm.CreateDimension(k, "LENGTH", float(v))
            for k, expr in (("X", "A / 3"), ("Y", "B / 3 + 10mm")):
                p = pm.CreateDimension(k, "LENGTH", 0.0)
                part.Relations.CreateFormula(f"f_{k}", "", p, expr)
            part.Update()
            return {k: pm.Item(k).Value for k in "ABCDEXY"}
        reg.paso("parametros A-E y formulas X = A/3, Y = B/3 + 10", parametros)

        def placa_y_bloque():
            s = Croquis(ctx, o.PlaneXY, "placa").perfil([(0, 0), (B, 0), (B, A), (0, A)], {})
            s.hv()
            s.cst(SOBRE, s.ps[0], s.sk.AbsoluteAxis.Origin)
            s.formula(s.cst(5, s.tramos[0]), "B")
            s.formula(s.cst(5, s.tramos[1]), "A")
            sf.AddNewPad(s.cerrar(), 25.0)
            part.Update()
            s2 = Croquis(ctx, o.PlaneXY, "bloque").perfil([(B - 60, 0), (B, 0), (B, 60), (B - 60, 60)], {})
            s2.hv()
            s2.sobre_H(s2.ps[0])
            s2.a_eje_V(s2.tramos[1], "B")
            s2.formula(s2.cst(5, s2.tramos[0]), "60mm")
            s2.formula(s2.cst(5, s2.tramos[1]), "60mm")
            sf.AddNewPad(s2.cerrar(), 35.0)
            part.Update()
            return vol()
        reg.paso("placa B x A x 25 + bloque 60 x 60 x 35 (acotados)", placa_y_bloque)

        def esquinas():
            def vert(lista, pts, zmin=-1e9):
                return [d for d in lista if "cdg" in d and d["cdg"][2] >= zmin and
                        any(abs(d["cdg"][0] - x) < 1.5 and abs(d["cdg"][1] - y) < 1.5 for x, y in pts)]
            ar = topologia(doc, body, "Edge")
            r10 = vert(ar, [(0, 0), (0, A), (B, A), (B, 0)])
            fi = sf.AddNewSolidEdgeFilletWithConstantRadius(r10[0]["ref"], 0, 10.0)
            for d in r10[1:]:
                fi.AddObjectToFillet(d["ref"])
            part.Update()
            ar = topologia(doc, body, "Edge")
            r15 = vert(ar, [(B - 60, 60)], zmin=25)
            sf.AddNewSolidEdgeFilletWithConstantRadius(r15[0]["ref"], 0, 15.0)
            part.Update()
            return {"r10": len(r10), "r15": len(r15), "vol": vol()}
        reg.paso("4 x R10 y R15", esquinas)

        def muro():
            yi = ya - math.sqrt(ro ** 2 - W ** 2)
            xi = xa + math.sqrt(ro ** 2 - W ** 2)
            pts = [(xa, 0), (xa + W, 0), (xa + W, yi), (xi, ya - W), (B, ya - W), (B, ya), (xa + ri, ya), (xa, ya - ri)]
            s = Croquis(ctx, o.PlaneXY, "muro").perfil(pts, {2: (xa, ya, ro), 6: (xa, ya, ri)})
            s.hv()
            t = s.tramos
            s.sobre_H(s.ps[0])
            s.a_eje_V(t[7], "B - C")                 # cara de afuera del muro vertical
            s.a_eje_V(t[1], "B - C + 15mm")          # cara de adentro
            s.a_eje_H(t[3], "C - 15mm")              # cara de adentro del muro horizontal
            s.a_eje_H(t[5], "C")
            s.a_eje_V(t[4], "B")
            cen = list(s.centros.values())[0]
            s.a_eje_V(cen, "B - C")
            s.a_eje_H(cen, "C")
            s.radio(t[2], "C - 65mm")
            s.radio(t[6], "C - 80mm")
            sf.AddNewPad(s.cerrar(), 95.0)
            part.Update()
            return {"vol": vol(), "restricciones": s.sk.Constraints.Count}
        reg.paso("muro con el arco (radios = C - 80 y C - 65, centro en (B - C, C))", muro)

        def centro_agregado(m0, m1):
            v0, v1 = m0["volume"], m1["volume"]
            return [(m1["cdg_mm"][i] * v1 - m0["cdg_mm"][i] * v0) / (v1 - v0) for i in range(3)]

        def plano_x():                        # YZ corrido B + 10 (formula)
            p = hsf.AddNewPlaneOffset(ref(part, o.PlaneYZ), B + 10.0, False)
            body.InsertHybridShape(p)
            part.Update()
            part.Relations.CreateFormula("plano_x", "", p.Offset, "B + 10mm")
            part.Update()
            return p

        def plano_y():
            p = hsf.AddNewPlaneOffset(ref(part, o.PlaneZX), -10.0, False)
            body.InsertHybridShape(p)
            part.Update()
            return p

        def cilindros():
            ctx["pY"], ctx["pX"] = plano_y(), plano_x()
            m0 = medir(doc, part, body)
            s = Croquis(ctx, ctx["pY"], "cilY").circulo(95.0, xa + W / 2, X / 2)    # ZX: H -> Z, V -> X
            s.a_eje_V(s.cp, "95mm")
            s.a_eje_H(s.cp, "B - C + 7.5mm")
            s.radio(s.circ, "X / 2")
            pd = sf.AddNewPad(s.cerrar(), D)
            part.Update()
            part.Relations.CreateFormula("largoY", "", pd.FirstLimit.Dimension, "D")
            part.Update()
            if centro_agregado(m0, medir(doc, part, body))[1] < -10:
                pd.DirectionOrientation = 1 - pd.DirectionOrientation
                part.Update()
            m1 = medir(doc, part, body)
            s2 = Croquis(ctx, ctx["pX"], "cilX").circulo(ya - W / 2, 95.0, Y / 2)     # YZ: H -> Y, V -> Z
            s2.a_eje_V(s2.cp, "C - 7.5mm")
            s2.a_eje_H(s2.cp, "95mm")
            s2.radio(s2.circ, "Y / 2")
            pd2 = sf.AddNewPad(s2.cerrar(), D)
            part.Update()
            part.Relations.CreateFormula("largoX", "", pd2.FirstLimit.Dimension, "D")
            part.Update()
            if centro_agregado(m1, medir(doc, part, body))[0] > B + 10:
                pd2.DirectionOrientation = 1 - pd2.DirectionOrientation
                part.Update()
            return {"vol": vol(), "orient": [pd.DirectionOrientation, pd2.DirectionOrientation]}
        reg.paso("cilindros (radio X/2 e Y/2, largo D, plano en B + 10)", cilindros)

        def bolsillo():
            rr = ro + 9
            x0 = xa + W + 9
            ya2 = ya - math.sqrt(rr ** 2 - (x0 - xa) ** 2)
            xb = xa + math.sqrt(rr ** 2 - (W + 9) ** 2)
            pts = [(x0, 9), (B - 69, 9), (B - 69, 69), (B - 9, 69), (B - 9, ya - W - 9), (xb, ya - W - 9), (x0, ya2)]
            p25 = hsf.AddNewPlaneOffset(ref(part, o.PlaneXY), 25.0, False)
            body.InsertHybridShape(p25)
            ctx["p25"] = p25
            part.Update()
            s = Croquis(ctx, p25, "bolsillo").perfil(pts, {5: (xa, ya, rr)})
            s.hv()
            t = s.tramos
            s.a_eje_H(t[0], "9mm")
            s.a_eje_V(t[1], "B - 69mm")
            s.a_eje_H(t[2], "69mm")
            s.a_eje_V(t[3], "B - 9mm")
            s.a_eje_H(t[4], "C - 24mm")
            s.a_eje_V(t[6], "B - C + 24mm")
            cen = list(s.centros.values())[0]
            s.a_eje_V(cen, "B - C")
            s.a_eje_H(cen, "C")
            s.radio(t[5], "C - 56mm")
            v0 = vol()
            pk = sf.AddNewPocket(s.cerrar(), 20.0)
            part.Update()
            if vol() >= v0 - 1:
                pk.DirectionOrientation = 1 - pk.DirectionOrientation
                part.Update()

            def vert(pts):
                return [d for d in topologia(doc, pk, "Edge") if "cdg" in d and 10 <= d["cdg"][2] <= 20 and
                        any(abs(d["cdg"][0] - x) < 1.5 and abs(d["cdg"][1] - y) < 1.5 for x, y in pts)]
            e10 = vert([(x0, 9), (B - 69, 9), (B - 9, 69), (B - 9, ya - W - 9), (xb, ya - W - 9), (x0, ya2)])
            fi = sf.AddNewSolidEdgeFilletWithConstantRadius(e10[0]["ref"], 0, 10.0)
            for d in e10[1:]:
                fi.AddObjectToFillet(d["ref"])
            part.Update()
            e24 = vert([(B - 69, 69)])
            sf.AddNewSolidEdgeFilletWithConstantRadius(e24[0]["ref"], 0, 24.0)
            part.Update()
            return {"r10": len(e10), "r24": len(e24), "vol": vol()}
        reg.paso("bolsillo acotado (9 de todo, arco C - 56) + redondeos", bolsillo)

        def agujeros():
            v0 = vol()
            s = Croquis(ctx, ctx["pY"], "aguY").circulo(95.0, xa + W / 2, E / 2)
            s.a_eje_V(s.cp, "95mm")
            s.a_eje_H(s.cp, "B - C + 7.5mm")
            s.radio(s.circ, "E / 2")
            pk = sf.AddNewPocket(s.cerrar(), D)
            part.Update()
            part.Relations.CreateFormula("aguY_largo", "", pk.FirstLimit.Dimension, "D")
            part.Update()
            if vol() >= v0 - 1:
                pk.DirectionOrientation = 1 - pk.DirectionOrientation
                part.Update()
            v1 = vol()
            s2 = Croquis(ctx, ctx["pX"], "aguX").circulo(ya - W / 2, 95.0, E / 2)
            s2.a_eje_V(s2.cp, "C - 7.5mm")
            s2.a_eje_H(s2.cp, "95mm")
            s2.radio(s2.circ, "E / 2")
            pk2 = sf.AddNewPocket(s2.cerrar(), D)
            part.Update()
            part.Relations.CreateFormula("aguX_largo", "", pk2.FirstLimit.Dimension, "D")
            part.Update()
            if vol() >= v1 - 1:
                pk2.DirectionOrientation = 1 - pk2.DirectionOrientation
                part.Update()
            bocas = []
            for p in (pk, pk2):
                bocas += [d for d in topologia(doc, p, "Edge") if abs(d.get("medida", 0) - PI * E) < 0.5]
            ch = sf.AddNewChamfer(bocas[0]["ref"], 0, 0, 0, 2.0, 2.0)
            for d in bocas[1:]:
                ch.AddElementToChamfer(d["ref"])
            part.Update()
            # agujero F como dos vaciados acotados (el Hole queda clavado en la coordenada; asi sigue a B)
            p35 = hsf.AddNewPlaneOffset(ref(part, o.PlaneXY), 35.0, False)
            body.InsertHybridShape(p35)
            ctx["p35"] = p35
            part.Update()
            for nombre, rad, prof in (("caja", 15.0, 10.0), ("pasante", 7.5, 40.0)):
                v2 = vol()
                s3 = Croquis(ctx, p35, nombre).circulo(B - 30, 30.0, rad)
                s3.a_eje_V(s3.cp, "B - 30mm")
                s3.a_eje_H(s3.cp, "30mm")
                s3.radio(s3.circ, f"{rad}mm")
                pkf = sf.AddNewPocket(s3.cerrar(), prof)
                part.Update()
                if vol() >= v2 - 1:
                    pkf.DirectionOrientation = 1 - pkf.DirectionOrientation
                    part.Update()
            return {"bocas": len(bocas), "vol": vol()}
        reg.paso("agujeros E, chaflanes y F (acotados)", agujeros)

        ctx.update(doc=doc, sf=sf, vol=vol)
        return ctx

    return cuerpo

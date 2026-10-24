# -*- coding: utf-8 -*-
"""ej49 — MECANISMO (DMU Kinematics) con respuesta exacta: biela-manivela. Manivela r = 30 (gira en el origen sobre Z),
biela l = 80, corredera que desliza sobre X. Articulaciones: base-manivela, manivela-biela, biela-corredera (revolucion)
y base-corredera (prismatica); comando de angulo en la primera. Para theta = 0, 30, 60, 90, 120, 180 la corredera tiene
que estar en x = r cos(t) + sqrt(l^2 - r^2 sen^2(t))."""
import math
import os

from catia_base import correr, nueva_pieza, ref, poligono

R, L = 30.0, 80.0
MACRO_POS = """Function CATMain(p)
    Dim a(11)
    p.Position.GetComponents a
    CATMain = a(9) & ";" & a(10) & ";" & a(11)
End Function"""
MACRO_MOVER = """Function CATMain(p, x, y, z)
    Dim a(11)
    a(0) = 1: a(1) = 0: a(2) = 0: a(3) = 0: a(4) = 1: a(5) = 0: a(6) = 0: a(7) = 0: a(8) = 1
    a(9) = x: a(10) = y: a(11) = z
    p.Position.SetComponents a
    CATMain = "ok"
End Function"""
MACRO_MEC = """Function CATMain(mec, base, bEjeA, bPlano, bGuia, mEjeO, mEjeR, mPlano, bEjeP, bEjeQ, bPlanoB, sEje, sGuia, sPlano)
    Dim a(3)
    Set a(0) = bEjeA: Set a(1) = mEjeO: Set a(2) = bPlano: Set a(3) = mPlano
    Set j1 = mec.AddJoint("CATKinRevoluteJoint", a)
    Dim b(3)
    Set b(0) = mEjeR: Set b(1) = bEjeP: Set b(2) = mPlano: Set b(3) = bPlanoB
    mec.AddJoint "CATKinRevoluteJoint", b
    Dim c(3)
    Set c(0) = bEjeQ: Set c(1) = sEje: Set c(2) = bPlanoB: Set c(3) = sPlano
    mec.AddJoint "CATKinRevoluteJoint", c
    Dim d(3)
    Set d(0) = bGuia: Set d(1) = sGuia: Set d(2) = bPlano: Set d(3) = sPlano
    mec.AddJoint "CATKinPrismaticJoint", d
    mec.FixedPart = base
    mec.AddCommand "CATKinAngleCmd", j1
    CATMain = mec.NbDof & ";" & mec.NbJoints & ";" & mec.NbCommands
End Function"""
MACRO_ANG = """Function CATMain(mec, ang)
    Dim v(0)
    v(0) = ang
    mec.PutCommandValues v
    mec.Update
    CATMain = "ok"
End Function"""


def num(t):
    return [round(float(x.replace(",", ".")), 4) for x in t.split(";")]


def x_teorico(t):
    t = math.radians(t)
    return R * math.cos(t) + math.sqrt(L ** 2 - (R * math.sin(t)) ** 2)


def cuerpo(c, reg):
    rutas = {}

    def pieza(nombre, pts, ejes, guia=False):
        doc, part, body, sf = nueva_pieza(c, nombre)
        hsf = part.HybridShapeFactory
        sk = body.Sketches.Add(ref(part, part.OriginElements.PlaneXY))
        f = sk.OpenEdition()
        poligono(f, pts)
        sk.CloseEdition()
        part.Update()
        sf.AddNewPad(sk, 4.0)
        part.Update()
        gs = part.HybridBodies.Add()
        for nom, (x, y) in ejes.items():
            a, b = hsf.AddNewPointCoord(x, y, 0.0), hsf.AddNewPointCoord(x, y, 20.0)
            gs.AppendHybridShape(a)
            gs.AppendHybridShape(b)
            ln = hsf.AddNewLinePtPt(ref(part, a), ref(part, b))
            gs.AppendHybridShape(ln)
            ln.Name = nom
        if guia:
            a, b = hsf.AddNewPointCoord(0.0, 0.0, 0.0), hsf.AddNewPointCoord(100.0, 0.0, 0.0)
            gs.AppendHybridShape(a)
            gs.AppendHybridShape(b)
            g = hsf.AddNewLinePtPt(ref(part, a), ref(part, b))
            gs.AppendHybridShape(g)
            g.Name = guia
        pl = hsf.AddNewPlaneOffset(ref(part, part.OriginElements.PlaneXY), 0.0, False)
        gs.AppendHybridShape(pl)
        pl.Name = "Plano"
        part.Update()
        r = os.path.join(reg.carpeta, nombre + ".CATPart")
        if os.path.exists(r):
            os.remove(r)
        doc.SaveAs(r)
        doc.Close()
        return r

    rutas["base"] = reg.paso("base (eje A + guia X)", lambda: pieza("base", [(-20, -40), (150, -40), (150, -30), (-20, -30)],
                                                                   {"EjeA": (0, 0)}, guia="Guia"))
    rutas["manivela"] = reg.paso("manivela r 30", lambda: pieza("manivela", [(-5, -5), (35, -5), (35, 5), (-5, 5)],
                                                                {"EjeO": (0, 0), "EjeR": (R, 0)}))
    rutas["biela"] = reg.paso("biela l 80", lambda: pieza("biela", [(-4, -4), (84, -4), (84, 4), (-4, 4)],
                                                          {"EjeP": (0, 0), "EjeQ": (L, 0)}))
    rutas["corredera"] = reg.paso("corredera", lambda: pieza("corredera", [(-8, -6), (8, -6), (8, 6), (-8, 6)],
                                                             {"EjeS": (0, 0)}, guia="GuiaS"))

    def mecanismo():
        doc = c.Documents.Add("Product")
        prod = doc.Product
        prod.PartNumber = "BielaManivela"
        prod.Products.AddComponentsFromFiles([rutas[k] for k in ("base", "manivela", "biela", "corredera")], "All")
        base, man, bie, cor = (prod.Products.Item(i) for i in range(1, 5))
        ev = c.SystemService.Evaluate
        ev(MACRO_MOVER, 0, "CATMain", [bie, R, 0.0, 0.0])           # posicion compatible con theta = 0
        ev(MACRO_MOVER, 0, "CATMain", [cor, R + L, 0.0, 0.0])
        raiz = prod.PartNumber
        Rf = lambda inst, nom: prod.CreateReferenceFromName(f"{raiz}/{inst.Name}/!{nom}")
        mec = prod.GetTechnologicalObject("Mechanisms").Add()
        r = ev(MACRO_MEC, 0, "CATMain", [mec, base, Rf(base, "EjeA"), Rf(base, "Plano"), Rf(base, "Guia"),
                                         Rf(man, "EjeO"), Rf(man, "EjeR"), Rf(man, "Plano"),
                                         Rf(bie, "EjeP"), Rf(bie, "EjeQ"), Rf(bie, "Plano"),
                                         Rf(cor, "EjeS"), Rf(cor, "GuiaS"), Rf(cor, "Plano")])
        out = {"dof_articulaciones_comandos": r, "angulos": {}}
        peor = 0.0
        for t in (0, 30, 60, 90, 120, 180):
            ev(MACRO_ANG, 0, "CATMain", [mec, float(t)])
            prod.Update()
            x = num(ev(MACRO_POS, 0, "CATMain", [cor]))[0]
            xt = x_teorico(t)
            out["angulos"][t] = {"x_catia": x, "x_cuenta": round(xt, 4), "dif": round(x - xt, 4)}
            peor = max(peor, abs(x - xt))
        out["peor_dif_mm"] = round(peor, 4)
        return out
    reg.datos["resultado"] = reg.paso("mecanismo biela-manivela y barrido de angulos", mecanismo)


if __name__ == "__main__":
    correr("ej49_biela", cuerpo, visible=os.environ.get("CATIA_MIRAR") == "1")

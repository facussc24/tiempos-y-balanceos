# -*- coding: utf-8 -*-
# Origen: ej37_bearing_bracket.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA
# por el PEDIDO PARA CATA 6). Cambios para el ejercicio 28 del banco de CATIA (24/10/2026), nada mas: 1) no importa
# captura, correr ni guardar_pieza; 2) cuerpo(c, reg) devuelve ctx (doc, part, el cuerpo principal, sf y lo de construccion: 1
# llamadas a InsertHybridShape, cada objeto se anota para ocultarlo) en vez de capturar y guardar: la masa, la captura y el
# STEP los hace el catia.py; 3) sin el bloque __main__ (armado por script, sin tocar nada mas).
"""ej37 — Too Tall Toby Party Pack 01-01 «Bearing Bracket» en CATIA (plano libre para uso educativo, @tootalltoby).
Base 115 x 50 x 15 con ranura 90 x 12; oreja de 12 en el plano ZX corrido a y 13 (punta R26 en dos arcos de 90) hacia +Y;
espejo ZX; R9 del encuentro; D24 pasante simetrico; caja D34 x 4 desde cada cara de afuera (sentido por el centro de lo
sacado); esquinas R6 por interseccion con un 2.o cuerpo (rectangulo 115 x 50 R6 x 80); cola de milano a 60 grados
abajo, simetrica 57,5. Acero 7800. Respuesta 797,15 g; gemelo 102 198,250 mm3. ZX: H -> Z, V -> X; YZ: H -> Y, V -> Z."""
import math
import os

from catia_base import medir, nueva_pieza, ref, topologia
from croquis import centro_agregado, dibujar

DENS = 7.8e-3


def ranura_h(f, hc, vc, largo, ancho):
    r, hf = ancho / 2, largo / 2 - ancho / 2
    P = [f.CreatePoint(hc - hf, vc - r), f.CreatePoint(hc + hf, vc - r), f.CreatePoint(hc + hf, vc + r),
         f.CreatePoint(hc - hf, vc + r)]
    l1 = f.CreateLine(hc - hf, vc - r, hc + hf, vc - r)
    l1.StartPoint, l1.EndPoint = P[0], P[1]
    a1 = f.CreateCircle(hc + hf, vc, r, -math.pi / 2, math.pi / 2)
    a1.CenterPoint = f.CreatePoint(hc + hf, vc)
    a1.StartPoint, a1.EndPoint = P[1], P[2]
    l2 = f.CreateLine(hc + hf, vc + r, hc - hf, vc + r)
    l2.StartPoint, l2.EndPoint = P[2], P[3]
    a2 = f.CreateCircle(hc - hf, vc, r, math.pi / 2, 3 * math.pi / 2)
    a2.CenterPoint = f.CreatePoint(hc - hf, vc)
    a2.StartPoint, a2.EndPoint = P[3], P[0]


def rect(f, x0, y0, x1, y1):
    dibujar(f, [("L", (x0, y0), (x1, y0)), ("L", (x1, y0), (x1, y1)), ("L", (x1, y1), (x0, y1)), ("L", (x0, y1), (x0, y0))])


def circ(f, h, v, r):
    k = f.CreateClosedCircle(h, v, r)
    k.CenterPoint = f.CreatePoint(h, v)


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej37_bearing_bracket")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    ctx = {"construccion": []}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol(b=None):
        return medir(doc, part, b or main)["volume"]

    def plano(base, d, b=None):
        p = hsf.AddNewPlaneOffset(ref(part, base), float(d), False)
        (b or main).InsertHybridShape(p)
        ctx["construccion"].append(p)
        part.Update()
        return p

    def croq(pl, dib, b=None):
        sk = (b or main).Sketches.Add(ref(part, pl))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def base():
        sf.AddNewPad(croq(o.PlaneXY, lambda f: (rect(f, -57.5, -25, 57.5, 25), ranura_h(f, 2.5, 0.0, 90.0, 12.0))), 15.0)
        part.Update()
        return vol()
    reg.paso("base 115 x 50 x 15 con la ranura 90 x 12", base)

    def oreja_y_espejo():
        m0 = medir(doc, part, main)
        tr = [("L", (0, -57.5), (0, -5.5)), ("L", (0, -5.5), (42, -5.5)),
              ("A", (42, -31.5), 26.0, (42, -5.5), (68, -31.5)), ("A", (42, -31.5), 26.0, (68, -31.5), (42, -57.5)),
              ("L", (42, -57.5), (0, -57.5))]
        pd = sf.AddNewPad(croq(plano(o.PlaneZX, 13.0), lambda f: dibujar(f, tr)), 12.0)
        part.Update()
        ca = centro_agregado(m0, medir(doc, part, main))
        if ca is None or ca[1] < 13:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        v1 = vol()
        sf.AddNewMirror(ref(part, o.PlaneZX))
        part.Update()
        return {"con_una": v1, "con_dos": vol()}
    reg.paso("oreja de 12 con punta R26 hacia +Y y su espejo", oreja_y_espejo)

    def r9():
        ar = [d for d in topologia(doc, main, "Edge") if "cdg" in d and abs(d["cdg"][0] + 5.5) < 0.01
              and abs(d["cdg"][2] - 15) < 0.01 and abs(d.get("medida", 0) - 12) < 0.1]
        v0 = vol()
        fi = sf.AddNewSolidEdgeFilletWithConstantRadius(ar[0]["ref"], 0, 9.0)
        for d in ar[1:]:
            fi.AddObjectToFillet(d["ref"])
        part.Update()
        return {"aristas": len(ar), "suma": round(vol() - v0, 3)}
    reg.paso("R9 donde las orejas tocan la base", r9)

    def agujeros():
        v0 = vol()
        pk = sf.AddNewPocket(croq(o.PlaneZX, lambda f: circ(f, 42.0, -31.5, 12.0)), 30.0)
        pk.IsSymmetric = True
        part.Update()
        out = {"d24": round(v0 - vol(), 3)}
        for y in (25.0, -25.0):
            m0 = medir(doc, part, main)
            pk2 = sf.AddNewPocket(croq(plano(o.PlaneZX, y), lambda f: circ(f, 42.0, -31.5, 17.0)), 4.0)
            part.Update()
            ca = centro_agregado(m0, medir(doc, part, main))
            if ca is None or abs(ca[1]) > 25:                    # el centro de lo sacado tiene que quedar adentro
                pk2.DirectionOrientation = 1 - pk2.DirectionOrientation
                part.Update()
            out[f"caja_y{y:+.0f}"] = round(m0["volume"] - vol(), 3)
        return out
    reg.paso("D24 pasante y cajas D34 x 4 desde afuera", agujeros)

    def esquinas_r6():
        b2 = part.Bodies.Add()
        b2.Name = "Contorno R6"
        part.InWorkObject = b2

        def dib(f):
            dibujar(f, [("L", (-51.5, -25), (51.5, -25)), ("A", (51.5, -19), 6.0, (51.5, -25), (57.5, -19)),
                        ("L", (57.5, -19), (57.5, 19)), ("A", (51.5, 19), 6.0, (57.5, 19), (51.5, 25)),
                        ("L", (51.5, 25), (-51.5, 25)), ("A", (-51.5, 19), 6.0, (-51.5, 25), (-57.5, 19)),
                        ("L", (-57.5, 19), (-57.5, -19)), ("A", (-51.5, -19), 6.0, (-57.5, -19), (-51.5, -25))])
        pd = sf.AddNewPad(croq(o.PlaneXY, dib, b2), 80.0)
        part.Update()
        if medir(doc, part, b2)["cdg_mm"][2] < 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        part.InWorkObject = main
        v0 = vol()
        sf.AddNewIntersect(b2)
        part.Update()
        return {"saca": round(v0 - vol(), 3)}
    reg.paso("esquinas R6 (interseccion con el contorno redondeado)", esquinas_r6)

    def cola():
        yb = 9 + 8 / math.tan(math.radians(60))
        tr = [("L", (-9, 0), (9, 0)), ("L", (9, 0), (yb, 8)), ("L", (yb, 8), (-yb, 8)), ("L", (-yb, 8), (-9, 0))]
        v0 = vol()
        pk = sf.AddNewPocket(croq(o.PlaneYZ, lambda f: dibujar(f, tr)), 57.5)
        pk.IsSymmetric = True
        part.Update()
        return {"saca": round(v0 - vol(), 3)}
    reg.paso("cola de milano a 60 grados abajo", cola)

    ctx.update(doc=doc, part=part, body=main, sf=sf)
    return ctx

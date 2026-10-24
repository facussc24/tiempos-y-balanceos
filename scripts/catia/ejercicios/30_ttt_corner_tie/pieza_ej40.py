# -*- coding: utf-8 -*-
# Origen: ej40_corner_tie.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA
# por el PEDIDO PARA CATA 6). Cambios para el ejercicio 30 del banco de CATIA (24/10/2026), nada mas: 1) no importa
# captura, correr ni guardar_pieza; 2) cuerpo(c, reg) devuelve ctx (doc, part, el cuerpo principal, sf y lo de construccion: 2
# llamadas a InsertHybridShape, cada objeto se anota para ocultarlo) en vez de capturar y guardar: la masa, la captura y el
# STEP los hace el catia.py; 3) sin el bloque __main__ (armado por script, sin tocar nada mas).
"""ej40 — Too Tall Toby Party Pack 01-09 «Corner Tie» en CATIA (plano libre para uso educativo, @tootalltoby).
Placa 69 x 75 x 13 con R17 y dos agujeros con caja; alma en YZ (lados tangentes al R15 con 75 grados entre ellos, D12)
hacia -X 13; pestana de 6 armada PLANA en otro cuerpo (rectangulo 26,14 x 75 + disco R37,5 con D33), girada 45 grados
sobre Y (sentido por el centro de gravedad), recortada en x = 0 y sumada; relleno triangular entre la pestana y el alma;
R16 en el encuentro. Aluminio 2700. Respuesta 307,23 g; gemelo 113 789,264 mm3. YZ: H -> Y, V -> Z; ZX: H -> Z, V -> X."""
import math
import os

from catia_base import medir, nueva_pieza, ref, topologia
from croquis import centro_agregado, dibujar

DENS = 2.7e-3
S2 = math.sqrt(2)


def circ(f, h, v, r):
    k = f.CreateClosedCircle(h, v, r)
    k.CenterPoint = f.CreatePoint(h, v)


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej40_corner_tie")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    ctx = {"construccion": []}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol(b=None):
        return medir(doc, part, b or main)["volume"]

    def croq(b, pl, dib):
        sk = b.Sketches.Add(ref(part, pl))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def plano(base, d, b):
        p = hsf.AddNewPlaneOffset(ref(part, base), float(d), False)
        b.InsertHybridShape(p)
        ctx["construccion"].append(p)
        part.Update()
        return p

    def placa():
        tr = [("L", (0, -37.5), (0, 37.5)), ("L", (0, 37.5), (-52, 37.5)), ("A", (-52, 20.5), 17.0, (-52, 37.5), (-69, 20.5)),
              ("L", (-69, 20.5), (-69, -20.5)), ("A", (-52, -20.5), 17.0, (-69, -20.5), (-52, -37.5)), ("L", (-52, -37.5), (0, -37.5))]
        pd = sf.AddNewPad(croq(main, o.PlaneXY, lambda f: dibujar(f, tr)), 13.0)
        part.Update()
        if medir(doc, part, main)["cdg_mm"][2] < 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        out = {"placa": vol()}
        for nombre, z0, r, prof in (("pasantes", 0.0, 4.0, 13.0), ("cajas", 13.0, 7.5, 4.0)):
            m0 = medir(doc, part, main)
            pl = o.PlaneXY if z0 == 0 else plano(o.PlaneXY, z0, main)
            pk = sf.AddNewPocket(croq(main, pl, lambda f: (circ(f, -52, 20.5, r), circ(f, -52, -20.5, r))), prof)
            part.Update()
            ca = centro_agregado(m0, medir(doc, part, main))
            if ca is None or not (0 < ca[2] < 13):
                pk.DirectionOrientation = 1 - pk.DirectionOrientation
                part.Update()
            out[nombre] = round(m0["volume"] - vol(), 3)
        return out
    reg.paso("placa 69 x 75 x 13 con R17, D8 y cajas D15 x 4", placa)

    def alma():
        a = math.radians(37.5)
        t1 = (15 * math.cos(a), 45 + 15 * math.sin(a))
        k = (37.5 - t1[0]) / math.sin(a)
        z1 = t1[1] - k * math.cos(a)
        t2 = (-t1[0], t1[1])
        tr = [("L", t2, (-37.5, z1)), ("L", (-37.5, z1), (-37.5, 0)), ("L", (-37.5, 0), (37.5, 0)),
              ("L", (37.5, 0), (37.5, z1)), ("L", (37.5, z1), t1), ("A", (0, 45), 15.0, t1, t2)]
        m0 = medir(doc, part, main)
        pd = sf.AddNewPad(croq(main, o.PlaneYZ, lambda f: (dibujar(f, tr), circ(f, 0.0, 45.0, 6.0))), 13.0)
        part.Update()
        ca = centro_agregado(m0, medir(doc, part, main))
        if ca is None or ca[0] > 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        return {"suma": round(vol() - m0["volume"], 3), "z_lado": round(z1, 3)}
    reg.paso("alma: lados tangentes al R15 con 75 grados, D12, hacia -X 13", alma)

    def pestana():
        b2 = part.Bodies.Add()
        b2.Name = "Pestana"
        part.InWorkObject = b2
        L = 45 * 2 / S2 - 37.5

        def dib(f):
            dibujar(f, [("L", (0, -37.5), (L, -37.5)), ("A", (L, 0), 37.5, (L, -37.5), (L + 37.5, 0)),
                        ("A", (L, 0), 37.5, (L + 37.5, 0), (L, 37.5)), ("L", (L, 37.5), (0, 37.5)), ("L", (0, 37.5), (0, -37.5))])
            circ(f, L, 0.0, 16.5)
        pd = sf.AddNewPad(croq(b2, o.PlaneXY, dib), 6.0)
        part.Update()
        if medir(doc, part, b2)["cdg_mm"][2] < 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        plana = vol(b2)
        # girar 45 sobre Y: el eje +X plano tiene que ir a (1, 0, -1)/V2 (el centro de gravedad queda con x > 0 y z < 0)
        eje_y = hsf.AddNewLinePtDir(hsf.AddNewPointCoord(0, 0, 0), hsf.AddNewDirectionByCoord(0, 1, 0), -50, 50, False)
        b2.InsertHybridShape(eje_y)
        ctx["construccion"].append(eje_y)
        part.Update()
        rot = sf.AddNewRotate2(ref(part, eje_y), 45.0)
        part.Update()
        cg = medir(doc, part, b2)["cdg_mm"]
        if not (cg[0] > 0 and cg[2] < 0):
            rot.Angle.Value = -45.0
            part.Update()
            cg = medir(doc, part, b2)["cdg_mm"]
        # recortar lo que paso a x < 0 (el disco detras del origen)
        v0 = vol(b2)
        sp = sf.AddNewSplit(ref(part, o.PlaneYZ), 0)
        part.Update()
        if medir(doc, part, b2)["cdg_mm"][0] < 0:
            sp.SplitSide = 1 - sp.SplitSide
            part.Update()
        recorte = round(v0 - vol(b2), 3)
        part.InWorkObject = main
        v1 = vol()
        sf.AddNewAdd(b2)
        part.Update()
        return {"plana": plana, "cdg_girada": [round(v, 1) for v in cg], "recorte_x_neg": recorte, "suma": round(vol() - v1, 3)}
    reg.paso("pestana: plana, girada 45 sobre Y, recortada en x = 0 y sumada", pestana)

    def relleno_y_r16():
        part.InWorkObject = main
        tr = [("L", (0, 0), (6 / S2, 6 / S2)), ("L", (6 / S2, 6 / S2), (6 * S2, 0)), ("L", (6 * S2, 0), (0, 0))]   # ZX: (z, x)
        v0 = vol()
        pd = sf.AddNewPad(croq(main, o.PlaneZX, lambda f: dibujar(f, tr)), 37.5)
        pd.IsSymmetric = True
        part.Update()
        relleno = round(vol() - v0, 3)
        ar = [d for d in topologia(doc, main, "Edge") if "cdg" in d and abs(d["cdg"][0]) < 0.05
              and abs(d["cdg"][2] - 6 * S2) < 0.05 and abs(d.get("medida", 0) - 75) < 0.1]
        v1 = vol()
        fi = sf.AddNewSolidEdgeFilletWithConstantRadius(ar[0]["ref"], 0, 16.0)
        part.Update()
        return {"relleno": relleno, "aristas_r16": len(ar), "r16": round(vol() - v1, 3)}
    reg.paso("relleno entre la pestana y el alma + R16", relleno_y_r16)

    ctx.update(doc=doc, part=part, body=main, sf=sf)
    return ctx

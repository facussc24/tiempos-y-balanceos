# -*- coding: utf-8 -*-
"""ej36 — Too Tall Toby Party Pack 01-06 «Bearing Jig» en CATIA (plano libre para uso educativo, @tootalltoby).
Como la referencia: placa grande 200 x 200 x 22 + cubo D30 z -25..-11 + R6 en el encuentro; segundo cuerpo = el PERFIL
(contorno de build123d pasado a croquis con de_build123d.py: R12 tangentes ya calculados) con los agujeros D13 y D12,
extruido z -25..11; `AddNewIntersect` del principal con ese cuerpo; chavetero 4 x 9; ranura 10 de ancho y 42 de
profundidad desde arriba (el plano: fondo en y 27; la guia decia 12 y da 301 g). Acero 7800. Respuesta 328,02 g;
gemelo 42 053,828 mm3."""
import json
import os

from catia_base import captura, correr, guardar_pieza, medir, nueva_pieza, ref
from croquis import centro_agregado, dibujar

DENS = 7.8e-3
AQUI = os.path.dirname(os.path.abspath(__file__))


def rect(f, x0, y0, x1, y1):
    dibujar(f, [("L", (x0, y0), (x1, y0)), ("L", (x1, y0), (x1, y1)), ("L", (x1, y1), (x0, y1)), ("L", (x0, y1), (x0, y0))])


def circ(f, h, v, r):
    k = f.CreateClosedCircle(h, v, r)
    k.CenterPoint = f.CreatePoint(h, v)


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej36_bearing_jig")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass
    contorno = [tuple(t[:1]) + tuple(tuple(x) if isinstance(x, list) else x for x in t[1:])
                for t in json.load(open(os.path.join(AQUI, "ej36_bearing_jig", "contorno.json")))]

    def vol(b=None):
        return medir(doc, part, b or main)["volume"]

    def plano_z(b, z):
        p = hsf.AddNewPlaneOffset(ref(part, o.PlaneXY), float(z), False)
        b.InsertHybridShape(p)
        part.Update()
        return p

    def croq(b, plano, dib):
        sk = b.Sketches.Add(ref(part, plano))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def placa_y_cubo():
        part.InWorkObject = main
        pd = sf.AddNewPad(croq(main, o.PlaneXY, lambda f: rect(f, -100, -100, 100, 100)), 11.0)
        pd.IsSymmetric = True
        part.Update()
        m0 = medir(doc, part, main)
        cubo = sf.AddNewPad(croq(main, plano_z(main, -11), lambda f: circ(f, 0.0, 15.0, 15.0)), 14.0)
        part.Update()
        ca = centro_agregado(m0, medir(doc, part, main))
        if ca is None or ca[2] > -11:          # None = no sumo nada: crecio adentro de la placa (lado malo)
            cubo.DirectionOrientation = 1 - cubo.DirectionOrientation
            part.Update()
        from catia_base import topologia
        ar = [d for d in topologia(doc, main, "Edge") if "cdg" in d and abs(d["cdg"][2] + 11) < 0.01
              and abs(d.get("medida", 0) - 2 * 3.14159265 * 15) < 0.5]
        reg.datos["aristas_r6"] = [(d["cdg"], d.get("medida")) for d in ar]
        print("   aristas R6:", reg.datos["aristas_r6"], "orient cubo", cubo.DirectionOrientation)
        v0 = vol()
        # hay DOS circunferencias iguales en z -11 (la arista del encuentro y la del croquis del cubo): se prueba cada una y
        # el intento que falla se BORRA (un redondeo roto en el arbol contamina lo que sigue)
        sel = doc.Selection
        for d in ar:
            fi = None
            try:
                fi = sf.AddNewSolidEdgeFilletWithConstantRadius(d["ref"], 0, 6.0)
                part.Update()
                reg.datos["r6_con"] = d["cdg"]
                break
            except Exception:  # noqa: BLE001
                if fi is not None:
                    sel.Clear()
                    sel.Add(fi)
                    sel.Delete()
                    part.Update()
        return {"cubo_ok": True, "aristas_r6": len(ar), "r6_suma": round(vol() - v0, 3)}
    reg.paso("placa 200 x 200 x 22 + cubo D30 hacia abajo + R6", placa_y_cubo)

    def perfil():
        b2 = part.Bodies.Add()
        b2.Name = "Perfil"
        part.InWorkObject = b2

        def dib(f):
            dibujar(f, contorno)
            for x in (22.0, -22.0):
                circ(f, x, 59.0, 6.5)
            circ(f, 0.0, 15.0, 6.0)
        p11 = plano_z(b2, 11)
        pd = sf.AddNewPad(croq(b2, p11, dib), 36.0)
        part.Update()
        if medir(doc, part, b2)["cdg_mm"][2] > 11:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        vp = vol(b2)
        part.InWorkObject = main
        sf.AddNewIntersect(b2)
        part.Update()
        return {"perfil": vp, "vol": vol()}
    reg.paso("perfil (con agujeros) en otro cuerpo e intersectar", perfil)

    def chavetero_y_ranura():
        part.InWorkObject = main
        out = {}
        # el sentido por el CENTRO de lo sacado contra el plano (el «saco algo» dejo pasar la ranura hacia abajo: los dos
        # lados tienen material; 19/10, la trampa que marco el auditor)
        for nombre, z0, haciaZ, dib, prof in (
                ("chavetero", 11.0, -1, lambda f: rect(f, -2, 15, 2, 24), 36.0),
                ("ranura", -5.0, +1, lambda f: rect(f, -34.5, 27, 34.5, 96), 10.0)):
            m0 = medir(doc, part, main)
            pk = sf.AddNewPocket(croq(main, plano_z(main, z0), dib), prof)
            part.Update()
            ca = centro_agregado(m0, medir(doc, part, main))
            if ca is None or (ca[2] - z0) * haciaZ < 0:
                pk.DirectionOrientation = 1 - pk.DirectionOrientation
                part.Update()
                ca = centro_agregado(m0, medir(doc, part, main))
            out[nombre] = {"saca": round(m0["volume"] - vol(), 3), "z_centro_sacado": round(ca[2], 2)}
        return out
    reg.paso("chavetero 4 x 9 y ranura de 10 (fondo y 27)", chavetero_y_ranura)

    def final():
        v = vol()
        return {"vol": v, "masa_g": round(v * DENS, 2), "oficial": 328.02, "gemelo": 42053.828}
    reg.datos["resultado"] = reg.paso("volumen y masa", final)
    reg.paso("captura", lambda: captura(c, reg, "ej36", vistas=("iso", "iso2")))
    reg.paso("CATPart + STEP", lambda: guardar_pieza(doc, reg, "ej36_bearing_jig"))


if __name__ == "__main__":
    correr("ej36_bearing_jig", cuerpo, visible=os.environ.get("CATIA_MIRAR") == "1", fresca=True)

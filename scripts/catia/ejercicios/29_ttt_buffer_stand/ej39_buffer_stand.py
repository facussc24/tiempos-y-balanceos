# -*- coding: utf-8 -*-
"""ej39 — Too Tall Toby 24-SPO-06 «Buffer Stand» en CATIA, en MILIMETROS (plano en pulgadas; libre para uso educativo,
@tootalltoby). Planta (recta de 5,00 + puntas en arco hasta 5,50) x 4 de alto; interseccion con la punta trapecial
redonda (2.o cuerpo, YZ simetrico); hueco interior con R0,5 menos los dos resaltes (3.er cuerpo, Remove); agujero D0,625
pasante sobre X y cajas D1,25 x 0,5 desde las caras de afuera; nervio trapecial con punta redonda. Acero 7800 kg/m3.
Respuesta 3,923 lb +-0,02; gemelo 228 696,0 mm3 = 3,9327 lb."""
import json
import os

from catia_base import captura, correr, guardar_pieza, medir, nueva_pieza, ref
from croquis import centro_agregado, dibujar

IN = 25.4
DENS = 7.8e-3
AQUI = os.path.dirname(os.path.abspath(__file__))
ZC, RP = 78.19782868541051, 23.402171314589484          # centro y radio de la punta redonda (mm)


def tramos(nombre):
    return [tuple(t[:1]) + tuple(tuple(x) if isinstance(x, list) else x for x in t[1:])
            for t in json.load(open(os.path.join(AQUI, "ej39_buffer_stand", f"{nombre}.json")))]


def circ(f, h, v, r):
    k = f.CreateClosedCircle(h, v, r)
    k.CenterPoint = f.CreatePoint(h, v)


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej39_buffer_stand")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol(b=None):
        return medir(doc, part, b or main)["volume"]

    def plano(base, d, b):
        p = hsf.AddNewPlaneOffset(ref(part, base), float(d), False)
        b.InsertHybridShape(p)
        part.Update()
        return p

    def croq(b, pl, dib):
        sk = b.Sketches.Add(ref(part, pl))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def montantes():
        part.InWorkObject = main
        pd = sf.AddNewPad(croq(main, o.PlaneXY, lambda f: dibujar(f, tramos("planta"))), 4 * IN)
        part.Update()
        if medir(doc, part, main)["cdg_mm"][2] < 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        v0 = vol()
        b2 = part.Bodies.Add()
        b2.Name = "Punta trapecial"
        part.InWorkObject = b2
        p2 = sf.AddNewPad(croq(b2, o.PlaneYZ, lambda f: dibujar(f, tramos("punta"))), 3 * IN)
        p2.IsSymmetric = True
        part.Update()
        part.InWorkObject = main
        sf.AddNewIntersect(b2)
        part.Update()
        return {"bloque": v0, "con_punta": vol()}
    reg.paso("planta x 4 in, intersectada con la punta trapecial redonda", montantes)

    def hueco():
        b3 = part.Bodies.Add()
        b3.Name = "Hueco"
        part.InWorkObject = b3
        ph = sf.AddNewPad(croq(b3, o.PlaneZX, lambda f: dibujar(f, tramos("hueco"))), 3 * IN)
        ph.IsSymmetric = True
        part.Update()
        vh = vol(b3)
        for x, haciaX in ((1.75 * IN, +1), (-1.75 * IN, -1)):           # resaltes: se sacan del hueco
            m0 = medir(doc, part, b3)
            pk = sf.AddNewPocket(croq(b3, plano(o.PlaneYZ, x, b3), lambda f: circ(f, 0.0, ZC, RP)), 0.375 * IN)
            part.Update()
            ca = centro_agregado(m0, medir(doc, part, b3))
            if ca is None or (ca[0] - x) * haciaX < 0:
                pk.DirectionOrientation = 1 - pk.DirectionOrientation
                part.Update()
            ca2 = centro_agregado(m0, medir(doc, part, b3))
            print(f"   resalte x={x:+.2f}: saca {m0['volume'] - vol(b3):.1f}, centro {[round(v, 1) for v in ca2] if ca2 else None}")
        part.InWorkObject = main
        v0 = vol()
        sf.AddNewRemove(b3)
        part.Update()
        return {"hueco": vh, "hueco_sin_resaltes": vol(b3) if False else None, "saca": round(v0 - vol(), 3)}
    reg.paso("hueco interior R0,5 menos los resaltes (Remove)", hueco)

    def agujero_y_cajas():
        part.InWorkObject = main
        v0 = vol()
        pk = sf.AddNewPocket(croq(main, o.PlaneYZ, lambda f: circ(f, 0.0, ZC, 0.3125 * IN)), 3 * IN)
        pk.IsSymmetric = True
        part.Update()
        out = {"pasante": round(v0 - vol(), 3)}
        for x in (2.75 * IN, -2.75 * IN):
            m0 = medir(doc, part, main)
            p = sf.AddNewPocket(croq(main, plano(o.PlaneYZ, x, main), lambda f: circ(f, 0.0, ZC, 0.625 * IN)), 0.5 * IN)
            part.Update()
            ca = centro_agregado(m0, medir(doc, part, main))
            if ca is None or abs(ca[0]) > abs(x):                         # lo sacado tiene que quedar ADENTRO
                p.DirectionOrientation = 1 - p.DirectionOrientation
                part.Update()
            out[f"caja_x{x:+.1f}"] = round(m0["volume"] - vol(), 3)
        return out
    reg.paso("agujero D0,625 pasante y cajas D1,25 x 0,5 desde afuera", agujero_y_cajas)

    def nervio():
        v0 = vol()
        pd = sf.AddNewPad(croq(main, o.PlaneYZ, lambda f: dibujar(f, tramos("nervio"))), 2.125 * IN)
        pd.IsSymmetric = True
        part.Update()
        return {"suma": round(vol() - v0, 3)}
    reg.paso("nervio trapecial con punta redonda", nervio)

    def final():
        v = vol()
        return {"vol": v, "libras": round(v * DENS / 453.592, 4), "oficial_lb": 3.923, "tolerancia": 0.02, "gemelo": 228696.0}
    reg.datos["resultado"] = reg.paso("volumen y masa", final)
    reg.paso("captura", lambda: captura(c, reg, "ej39", vistas=("iso", "iso2")))
    reg.paso("CATPart + STEP", lambda: guardar_pieza(doc, reg, "ej39_buffer_stand"))


if __name__ == "__main__":
    correr("ej39_buffer_stand", cuerpo, visible=os.environ.get("CATIA_MIRAR") == "1")

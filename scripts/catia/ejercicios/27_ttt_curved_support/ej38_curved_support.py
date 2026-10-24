# -*- coding: utf-8 -*-
"""ej38 — Too Tall Toby 23-T-24 «Curved Support» en CATIA (plano libre para uso educativo, @tootalltoby).
Cubos D55 x 60 y D30 x 32; placa envolvente de 10 (contorno de build123d); puente de 11 con el perfil R30 / R66 / 8 grados
(tangencias resueltas en el gemelo, contorno pasado con de_build123d.py) en el plano YZ, simetrico 5,5; agujeros D35 y
D20. Acero 7800. Respuesta 1 294 g +-3; gemelo 166 112,182 mm3 = 1 295,68 g. YZ: H -> Y, V -> Z."""
import json
import os

from catia_base import captura, correr, guardar_pieza, medir, nueva_pieza, ref
from croquis import dibujar

DENS = 7.8e-3
AQUI = os.path.dirname(os.path.abspath(__file__))


def tramos(nombre):
    return [tuple(t[:1]) + tuple(tuple(x) if isinstance(x, list) else x for x in t[1:])
            for t in json.load(open(os.path.join(AQUI, "ej38_curved_support", f"{nombre}.json")))]


def circ(f, h, v, r):
    k = f.CreateClosedCircle(h, v, r)
    k.CenterPoint = f.CreatePoint(h, v)


def cuerpo(c, reg):
    doc, part, body, sf = nueva_pieza(c, "ej38_curved_support")
    o = part.OriginElements
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol():
        return medir(doc, part, body)["volume"]

    def croq(pl, dib):
        sk = body.Sketches.Add(ref(part, pl))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def pad_arriba(sk, alto):
        # NUNCA medir el cuerpo vacio (rompe todas las mediciones de la sesion: ej13, y otra vez aca el 19/10)
        pd = sf.AddNewPad(sk, float(alto))
        part.Update()
        m1 = medir(doc, part, body)
        if m1["cdg_mm"][2] < 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        return pd

    def cubos_y_placa():
        pad_arriba(croq(o.PlaneXY, lambda f: circ(f, 0.0, 0.0, 27.5)), 60.0)
        pad_arriba(croq(o.PlaneXY, lambda f: circ(f, 0.0, 125.0, 15.0)), 32.0)
        pad_arriba(croq(o.PlaneXY, lambda f: dibujar(f, tramos("placa"))), 10.0)
        return vol()
    reg.paso("cubos D55 x 60 y D30 x 32, placa envolvente de 10", cubos_y_placa)

    def puente():
        v0 = vol()
        pd = sf.AddNewPad(croq(o.PlaneYZ, lambda f: dibujar(f, tramos("puente"))), 5.5)
        pd.IsSymmetric = True
        part.Update()
        return {"suma": round(vol() - v0, 3)}
    reg.paso("puente de 11 con el perfil R30 / R66 / 8 grados", puente)

    def agujeros():
        v0 = vol()
        pk = sf.AddNewPocket(croq(o.PlaneXY, lambda f: (circ(f, 0.0, 0.0, 17.5), circ(f, 0.0, 125.0, 10.0))), 100.0)
        part.Update()
        if vol() >= v0 - 1:
            pk.DirectionOrientation = 1 - pk.DirectionOrientation
            part.Update()
        return {"saca": round(v0 - vol(), 3)}
    reg.paso("agujeros D35 y D20 pasantes", agujeros)

    def final():
        v = vol()
        return {"vol": v, "masa_g": round(v * DENS, 2), "oficial": 1294, "tolerancia": 3, "gemelo": 166112.182}
    reg.datos["resultado"] = reg.paso("volumen y masa", final)
    reg.paso("captura", lambda: captura(c, reg, "ej38", vistas=("iso", "iso2")))
    reg.paso("CATPart + STEP", lambda: guardar_pieza(doc, reg, "ej38_curved_support"))


if __name__ == "__main__":
    correr("ej38_curved_support", cuerpo, visible=os.environ.get("CATIA_MIRAR") == "1", fresca=True)

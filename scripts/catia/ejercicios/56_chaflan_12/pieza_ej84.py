# -*- coding: utf-8 -*-
"""Ejercicio 56 del banco de CATIA (24/10/2026, CATA): el ej84 de la practica (19/10, «para CATA - practica 19-10» en la
nube) con tres cambios anotados:

  CAMBIO 1: build123d no corre adentro de la pieza (el ej84 lo llamaba desde el paso de CATIA): la referencia la arma
            gemelo_chaflan.py en el cierre.
  CAMBIO 2: la caja va de z 0 a 60 (el pad se da vuelta si su centro queda abajo) y se exigen 12 aristas antes del chaflan.
  CAMBIO 3: se anotan las caras de la operacion chaflan (las del solido, 6 + 12 = 18 si las esquinas cierran en un punto
            y 26 si llevan un triangulo cada una como chamfer() de build123d, las cuenta gemelo_chaflan.py en el STEP).

Caja 250 x 80 x 60 (x e y centrados), chaflan 5 x 5 (AddNewChamfer modo 0 = largo + largo) en las 12 aristas de una vez."""
from catia_base import medir, nueva_pieza, poligono, ref, topologia

A, B, C, K = 250.0, 80.0, 60.0, 5.0


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "chaflan_12")
    ctx = {"doc": doc, "part": part, "body": main}

    def caja():
        sk = main.Sketches.Add(ref(part, part.OriginElements.PlaneXY))
        f = sk.OpenEdition()
        poligono(f, [(-A / 2, -B / 2), (A / 2, -B / 2), (A / 2, B / 2), (-A / 2, B / 2)])
        sk.CloseEdition()
        part.Update()
        pad = sf.AddNewPad(sk, C)
        part.Update()
        if medir(doc, part, main)["cdg_mm"][2] < 0:
            pad.DirectionOrientation = 1 - pad.DirectionOrientation
            part.Update()
        ctx["pad"] = pad
        m = medir(doc, part, main)
        return {"vol": m["volume"], "cdg_mm": m["cdg_mm"], "cuenta": A * B * C}
    reg.paso("caja 250 x 80 x 60 de z 0 a 60", caja)

    def chaflan():
        ar = [d for d in topologia(doc, ctx["pad"], "Edge") if "cdg" in d]
        if len(ar) != 12:
            raise RuntimeError(f"la caja tiene {len(ar)} aristas, no 12")
        v0 = medir(doc, part, main)["volume"]
        ch = sf.AddNewChamfer(ar[0]["ref"], 0, 0, 0, K, K)
        for d in ar[1:]:
            ch.AddElementToChamfer(d["ref"])
        part.Update()
        m = medir(doc, part, main)
        # las caras que son DEL chaflan (topologia sobre la operacion; las del solido las cuenta el gemelo en el STEP)
        caras = topologia(doc, ch, "Face")
        return {"aristas": len(ar), "saca": round(v0 - m["volume"], 4), "vol": m["volume"], "cdg_mm": m["cdg_mm"],
                "caras_del_chaflan": len(caras)}
    ctx["chaflan"] = reg.paso("chaflan 5 x 5 en las 12 aristas de una vez", chaflan)
    return ctx

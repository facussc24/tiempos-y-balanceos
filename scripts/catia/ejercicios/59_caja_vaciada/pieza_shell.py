# -*- coding: utf-8 -*-
"""Ejercicio 59 del banco de CATIA (24/10/2026, CATA): caja 120 x 80 x 50 desde (0, 0, 0) vaciada con AddNewShell, pared 3
hacia adentro y la cara de arriba sacada (una carcasa abierta).

AddNewShell(cara a sacar, espesor interno, espesor externo): la llamada de la practica (NOTAS del 19/10, ej04 sobre una caja
sin redondear: «AddNewShell(cara, 2, 0)», exacta). La cara se elige por POSICION (topologia: la de centro en z = 50 y area
120 x 80), no por nombre. Aca solo se exige que la cascara saque material: con la pared hacia afuera tambien bajaria (a
126 x 86 x 53 - 120 x 80 x 50 = 94 308, por cuenta; revisor del 59). Que fue hacia ADENTRO y por la cara de arriba lo juzga
catia.py: volumen y centro contra la cuenta, lo que saco y su centro, y la forma contra el gemelo."""
from catia_base import medir, nueva_pieza, poligono, ref, topologia

A, B, C, T = 120.0, 80.0, 50.0, 3.0


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "caja_vaciada")
    ctx = {"doc": doc, "part": part, "body": main}

    def caja():
        sk = main.Sketches.Add(ref(part, part.OriginElements.PlaneXY))
        f = sk.OpenEdition()
        poligono(f, [(0.0, 0.0), (A, 0.0), (A, B), (0.0, B)])
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
    reg.paso("caja 120 x 80 x 50 desde (0, 0, 0)", caja)

    def cascara():
        caras = [d for d in topologia(doc, ctx["pad"], "Face") if "cdg" in d]
        arriba = [d for d in caras if abs(d["cdg"][2] - C) < 1e-3]
        if len(arriba) != 1 or abs(arriba[0].get("medida", 0) - A * B) > 0.5:
            raise RuntimeError(f"la cara de arriba no es una de {A * B:g} mm2: {[(d['cdg'], d.get('medida')) for d in arriba]}")
        m0 = medir(doc, part, main)
        sf.AddNewShell(arriba[0]["ref"], T, 0.0)
        part.Update()
        m1 = medir(doc, part, main)
        if not m1["volume"] < m0["volume"]:
            raise RuntimeError(f"la cascara no saco material ({m0['volume']} -> {m1['volume']})")
        dv = m0["volume"] - m1["volume"]
        z_sacado = (m0["volume"] * m0["cdg_mm"][2] - m1["volume"] * m1["cdg_mm"][2]) / dv
        return {"caras_caja": len(caras), "cara_sacada_mm2": arriba[0].get("medida"), "saca": round(dv, 4),
                "z_de_lo_sacado": round(z_sacado, 3), "vol": m1["volume"], "cdg_mm": m1["cdg_mm"]}
    ctx["cascara"] = reg.paso("cascara: pared 3 hacia adentro, la cara de arriba sacada", cascara)
    return ctx

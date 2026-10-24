# -*- coding: utf-8 -*-
"""ej41b — CSWA Sample Exam 2013 oficial, «Tool Block» etapas 3 y 4, en CATIA (A 86, B 58, C 44).
Etapa 3: perfil de la etapa 1 con D14; Ø11 pasante en (A-14, B-14); escalon z 0..19 en x < A-52 y en y < 19; ranura
z 8..32 (12 desde arriba, 24 de ancho) adentro de un R41 con centro en (A, 61,702) (corta la diagonal 36 por debajo de
arriba). Respuesta oficial 628,18 g.
Etapa 4 (sobre la misma pieza): bolsillo de un solo lado desde z 0 hasta C-12 = 32 en la zona x > 34, y > 19 con paredes
de 1 mm, que deja 1 mm de piel alrededor de la ranura: z 0..7 la zona entera y z 7..32 la zona menos el R42. 432,58 g.
Contornos de build123d pasados con de_build123d.py (ej41_tool_block/e3.json, e4_zona.json, e4_sin_ranura.json)."""
import json
import os

from catia_base import captura, correr, guardar_pieza, medir, nueva_pieza, ref
from croquis import centro_agregado, dibujar

DENS = 0.0079
AQUI = os.path.dirname(os.path.abspath(__file__))
A, B, C = 86.0, 58.0, 44.0
CEN41 = (86.0, 61.702)


def tramos(nombre):
    return [tuple(t[:1]) + tuple(tuple(x) if isinstance(x, list) else x for x in t[1:])
            for t in json.load(open(os.path.join(AQUI, "ej41_tool_block", f"{nombre}.json")))]


def poli(f, pts):
    dibujar(f, [("L", pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))])


def circ(f, h, v, r):
    k = f.CreateClosedCircle(h, v, r)
    k.CenterPoint = f.CreatePoint(h, v)


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej41b_tool_block_e34")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol():
        return medir(doc, part, main)["volume"]

    def plano_z(z):
        if z == 0:
            return o.PlaneXY
        p = hsf.AddNewPlaneOffset(ref(part, o.PlaneXY), float(z), False)
        main.InsertHybridShape(p)
        part.Update()
        return p

    def croq(plano, dib):
        sk = main.Sketches.Add(ref(part, plano))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def vaciar(nombre, z0, dib, prof):
        """Pocket desde el plano z0 hacia +Z; el sentido por el CENTRO de lo sacado (tiene que quedar arriba de z0)."""
        m0 = medir(doc, part, main)
        pk = sf.AddNewPocket(croq(plano_z(z0), dib), prof)
        part.Update()
        ca = centro_agregado(m0, medir(doc, part, main))
        if ca is None or ca[2] < z0:
            pk.DirectionOrientation = 1 - pk.DirectionOrientation
            part.Update()
            ca = centro_agregado(m0, medir(doc, part, main))
        pk.Name = nombre
        return {"saca": round(m0["volume"] - vol(), 3), "z_centro_sacado": round(ca[2], 2) if ca else None}

    def base():
        def dib(f):
            dibujar(f, tramos("e3"))
            circ(f, 14.0, 33.0, 7.0)
        pd = sf.AddNewPad(croq(o.PlaneXY, dib), C)
        part.Update()
        if medir(doc, part, main)["cdg_mm"][2] < 0:
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        return {"vol": vol()}
    reg.paso("perfil A 86 B 58 con D14, pad 44", base)

    reg.datos["d11"] = reg.paso("Ø11 pasante en (72, 44)", lambda: vaciar("D11", 0, lambda f: circ(f, A - 14, B - 14, 5.5), C))
    reg.datos["escalon"] = reg.paso("escalon z 0..19 (x < 34 y y < 19)", lambda: vaciar(
        "Escalon", 0, lambda f: poli(f, [(-10, -10), (A + 10, -10), (A + 10, 19), (A - 52, 19), (A - 52, B + 10), (-10, B + 10)]), 19.0))
    reg.datos["ranura"] = reg.paso("ranura R41 z 8..32", lambda: vaciar("Ranura_R41", 8, lambda f: circ(f, CEN41[0], CEN41[1], 41.0), 24.0))

    def masa(oficial, gemelo):
        v = vol()
        return {"vol": round(v, 3), "masa_g": round(v * DENS, 2), "oficial": oficial, "gemelo_vol": gemelo}
    reg.datos["etapa3"] = reg.paso("masa etapa 3", lambda: masa(628.18, 79516.884))
    reg.paso("captura etapa 3", lambda: captura(c, reg, "ej41b_e3", vistas=("iso", "iso2")))

    reg.datos["bolsillo_abajo"] = reg.paso("bolsillo z 0..7 (zona con 1 mm de pared)",
                                           lambda: vaciar("Bolsillo_z0_7", 0, lambda f: dibujar(f, tramos("e4_zona")), 7.0))
    reg.datos["bolsillo_arriba"] = reg.paso("bolsillo z 7..32 (zona menos el R42: 1 mm de piel en la ranura)",
                                            lambda: vaciar("Bolsillo_z7_32", 7, lambda f: dibujar(f, tramos("e4_sin_ranura")), 25.0))
    reg.datos["etapa4"] = reg.paso("masa etapa 4", lambda: masa(432.58, None))
    reg.paso("captura etapa 4", lambda: captura(c, reg, "ej41b_e4", vistas=("iso2", "abajo")))
    reg.paso("CATPart + STEP", lambda: guardar_pieza(doc, reg, "ej41b_tool_block_e34"))


if __name__ == "__main__":
    correr("ej41b_tool_block_e34", cuerpo, visible=os.environ.get("CATIA_MIRAR") in ("1", "lento"))

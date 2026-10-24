# -*- coding: utf-8 -*-
"""ej82 — MACHO de molde con DESMOLDEO 4 grados en los 4 costados y DESPUES las 4 aristas verticales R15 (el orden de
un molde: desmoldeo primero, radios despues). Base 250 x 80, alto 60. Se compara el volumen de CATIA contra build123d
haciendo lo mismo (extrude con taper + fillet de las aristas laterales). Busca trampas como la del redondeo de un paso."""
import os
import subprocess

from catia_base import correr, nueva_pieza, ref, medir, topologia, poligono, guardar_pieza, VENV_CAD

A, B, C, R, ANG = 250.0, 80.0, 60.0, 15.0, 4.0
B123 = r"""
from build123d import *
p = extrude(Rectangle(250, 80), amount=60, taper=4)
lat = p.edges().filter_by(lambda e: abs(e.center().Z - 30) < 1)
q = fillet(lat, 15)
print(round(p.volume, 2), round(q.volume, 2), len(lat))
"""


def cuerpo(c, reg):
    doc, part, main, sf = nueva_pieza(c, "ej82_macho")
    o = part.OriginElements

    def pieza():
        sk = main.Sketches.Add(ref(part, o.PlaneXY))
        f = sk.OpenEdition()
        poligono(f, [(-A / 2, -B / 2), (A / 2, -B / 2), (A / 2, B / 2), (-A / 2, B / 2)])
        sk.CloseEdition()
        part.Update()
        pad = sf.AddNewPad(sk, C)
        part.Update()
        caras = [d for d in topologia(doc, pad, "Face") if "cdg" in d]
        abajo = [d for d in caras if abs(d["cdg"][2]) < 1e-3]
        arriba = [d for d in caras if abs(d["cdg"][2] - C) < 1e-3]
        lados = [d for d in caras if 1e-3 < d["cdg"][2] < C - 1e-3]
        dr = sf.AddNewDraft(lados[0]["ref"], abajo[0]["ref"], 0, abajo[0]["ref"], 0.0, 0.0, 1.0, 0, ANG, 0)
        for d in lados[1:]:
            dr.DraftDomains.Item(1).AddFaceToDraft(d["ref"])
        part.Update()
        top = [d for d in topologia(doc, main, "Face") if "cdg" in d and abs(d["cdg"][2] - C) < 1e-3]
        if top and top[0]["medida"] > A * B:                        # el techo tiene que quedar mas chico que la base
            dr.DraftDomains.Item(1).SetPullingDirection(0.0, 0.0, -1.0)
            part.Update()
        v_dr = medir(doc, part, main)["volume"]
        lat = [d["ref"] for d in topologia(doc, dr, "Edge") if "cdg" in d and abs(d["cdg"][2] - C / 2) < 1]
        fl = sf.AddNewSolidEdgeFilletWithConstantRadius(lat[0], 0, R)
        for r_ in lat[1:]:
            fl.AddObjectToFillet(r_)
        part.Update()
        v = medir(doc, part, main)["volume"]
        out = subprocess.run([VENV_CAD, "-I", "-c", B123], capture_output=True, text=True).stdout.split()
        return {"catia_desmoldeo": round(v_dr, 2), "catia_con_radios": round(v, 2), "aristas_laterales": len(lat),
                "b123d_desmoldeo": float(out[0]), "b123d_con_radios": float(out[1]),
                "dif_%_radios": round(100 * (v - float(out[1])) / float(out[1]), 4)}
    reg.datos["macho"] = reg.paso("macho con desmoldeo 4 y radios R15 laterales, contra build123d", pieza)


if __name__ == "__main__":
    correr("ej82_macho_desmoldeo_radios", cuerpo, visible=os.environ.get("CATIA_MIRAR") in ("1", "lento"))

# -*- coding: utf-8 -*-
"""ej85 — TUBO CUADRADO 30 x 30 x 2 DOBLADO a 90 grados (barandas y largueros curvos de los carros): barrido (Rib) del
perfil hueco a lo largo de recta 40 + arco R20 (cuarto) + recta 30, con el perfil centrado en el camino. Pappus:
V = A x L = 224 x (40 + 10 pi + 30) = 22 717,2 mm3. Radio interior de la curva = 20 - 15 = 5 (> 0: no se pisa)."""
import math
import os

from catia_base import correr, nueva_pieza, ref, medir, poligono

A_SEC = 30 ** 2 - 26 ** 2
L_CAM = 40 + 10 * math.pi + 30


def cuerpo(c, reg):
    doc, part, body, sf = nueva_pieza(c, "ej85_tubo_doblado")
    o = part.OriginElements

    def tubo():
        skc = body.Sketches.Add(ref(part, o.PlaneXY))
        f = skc.OpenEdition()
        p1, p2 = f.CreatePoint(50, 0), f.CreatePoint(50, 40)
        l1 = f.CreateLine(50, 0, 50, 40)
        l1.StartPoint, l1.EndPoint = p1, p2
        cen, p3 = f.CreatePoint(70, 40), f.CreatePoint(70, 60)
        arco = f.CreateCircle(70.0, 40.0, 20.0, math.pi / 2, math.pi)
        arco.CenterPoint, arco.StartPoint, arco.EndPoint = cen, p3, p2
        p4 = f.CreatePoint(100, 60)
        l2 = f.CreateLine(70, 60, 100, 60)
        l2.StartPoint, l2.EndPoint = p3, p4
        skc.CloseEdition()
        part.Update()
        skp = body.Sketches.Add(ref(part, o.PlaneZX))          # H = Z, V = X: el centro del perfil en z 0, x 50
        f2 = skp.OpenEdition()
        poligono(f2, [(-15, 35), (15, 35), (15, 65), (-15, 65)])
        poligono(f2, [(-13, 37), (13, 37), (13, 63), (-13, 63)])
        skp.CloseEdition()
        part.Update()
        sf.AddNewRib(skp, skc)
        part.Update()
        v = medir(doc, part, body)["volume"]
        return {"vol": round(v, 2), "pappus": round(A_SEC * L_CAM, 2), "dif_%": round(100 * (v - A_SEC * L_CAM) / (A_SEC * L_CAM), 4)}
    reg.datos["tubo"] = reg.paso("tubo 30x30x2 barrido por recta + curva R20 + recta", tubo)


if __name__ == "__main__":
    correr("ej85_tubo_doblado", cuerpo, visible=os.environ.get("CATIA_MIRAR") in ("1", "lento"))

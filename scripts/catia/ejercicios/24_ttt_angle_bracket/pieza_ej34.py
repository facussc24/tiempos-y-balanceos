# -*- coding: utf-8 -*-
# Origen: ej34_angle_bracket.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA
# por el PEDIDO PARA CATA 6). Cambios para el ejercicio 24 del banco de CATIA (24/10/2026), nada mas: 1) no importa
# captura, correr ni guardar_pieza; 2) cuerpo(c, reg) devuelve ctx (doc, part, el cuerpo principal, sf y lo de construccion: 2
# llamadas a InsertHybridShape, cada objeto se anota para ocultarlo) en vez de capturar y guardar: la masa, la captura y el
# STEP los hace el catia.py; 3) sin el bloque __main__ (armado por script); 4) el doblez prueba cada arista candidata
# y controla el volumen (a mano: redondeo_con_candidatas, CAMBIO 4): en la R21 de CATA una candidata del R5 fallaba.
"""ej34 — Too Tall Toby Party Pack 01-04 «Angle Bracket» en CATIA (plano libre para uso educativo, @tootalltoby).
Pads de base D38 x 20, resalto D26 x 8 y brazo 53 x 61 x 7; R4 brazo/base; recorte a 38 de ancho; agujero D16; pata
10 x 38 x 23 hacia abajo (sentido por el centro de lo agregado); R10 / R5 del doblez; ranuras verticales (18 x 34 de 5
de profundo, 12 x 28 pasante) en la cara x = 61. Acero 7800 kg/m3. Respuesta 310 g; gemelo 39 743,211 mm3."""
import math
import os

from catia_base import medir, nueva_pieza, ref, topologia
from croquis import centro_agregado, dibujar

DENS = 7.8e-3


def ranura_vertical(f, hc, vc, largo, ancho):
    """Ranura con el largo sobre V del croquis, centrada en (hc, vc); arcos de 180 con angulos explicitos."""
    r = ancho / 2
    hf = largo / 2 - r
    P = [f.CreatePoint(hc - r, vc - hf), f.CreatePoint(hc + r, vc - hf), f.CreatePoint(hc + r, vc + hf),
         f.CreatePoint(hc - r, vc + hf)]
    l1 = f.CreateLine(hc + r, vc - hf, hc + r, vc + hf)
    l1.StartPoint, l1.EndPoint = P[1], P[2]
    a1 = f.CreateCircle(hc, vc + hf, r, 0.0, math.pi)
    a1.CenterPoint = f.CreatePoint(hc, vc + hf)
    a1.StartPoint, a1.EndPoint = P[2], P[3]
    l2 = f.CreateLine(hc - r, vc + hf, hc - r, vc - hf)
    l2.StartPoint, l2.EndPoint = P[3], P[0]
    a2 = f.CreateCircle(hc, vc - hf, r, math.pi, 2 * math.pi)
    a2.CenterPoint = f.CreatePoint(hc, vc - hf)
    a2.StartPoint, a2.EndPoint = P[0], P[1]


def redondeo_90(r, largo):
    """CAMBIO 4: volumen que saca (convexo) o suma (concavo) un redondeo de radio r en una arista recta de 90 grados."""
    return (1 - math.pi / 4) * r * r * largo


def redondeo_con_candidatas(sf, part, vol, candidatas, r, esperado, nombre):
    """CAMBIO 4 (24/10/2026, ejercicio 24): el orden de las aristas que da la topologia cambia entre corridas (24_r2: la
    candidata 0 de 2 fallo; 24_r3: la misma anduvo). Prueba cada candidata hasta que el redondeo se crea y la pieza se
    actualiza, y controla el cambio de volumen contra `esperado` (1 mm3): si no da, frena."""
    v0 = vol()
    intentos = []
    for i, d in enumerate(candidatas):
        try:
            sf.AddNewSolidEdgeFilletWithConstantRadius(d["ref"], 0, r)
            part.Update()
            intentos.append(f"candidata {i}: ok")
            break
        except Exception as e:  # noqa: BLE001
            intentos.append(f"candidata {i}: {repr(e)[:80]}")
    cambio = vol() - v0
    out = {"aristas": len(candidatas), "intentos": intentos, "cambio": round(cambio, 3), "esperado": round(esperado, 3)}
    if abs(cambio - esperado) > 1.0:
        raise RuntimeError(f"el {nombre} no da la cuenta: {out}")
    return out


def cuerpo(c, reg):
    doc, part, body, sf = nueva_pieza(c, "ej34_angle_bracket")
    hsf = part.HybridShapeFactory
    o = part.OriginElements
    ctx = {"construccion": []}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol():
        return medir(doc, part, body)["volume"]

    def plano_z(z):
        p = hsf.AddNewPlaneOffset(ref(part, o.PlaneXY), float(z), False)
        body.InsertHybridShape(p)
        ctx["construccion"].append(p)
        part.Update()
        return p

    def croq(plano, dib):
        sk = body.Sketches.Add(ref(part, plano))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def circ(f, h, v, r):
        k = f.CreateClosedCircle(h, v, r)
        k.CenterPoint = f.CreatePoint(h, v)

    def rect(f, x0, y0, x1, y1):
        dibujar(f, [("L", (x0, y0), (x1, y0)), ("L", (x1, y0), (x1, y1)), ("L", (x1, y1), (x0, y1)), ("L", (x0, y1), (x0, y0))])

    def base():
        sf.AddNewPad(croq(o.PlaneXY, lambda f: circ(f, 0, 0, 19.0)), 20.0)
        part.Update()
        sf.AddNewPad(croq(plano_z(20), lambda f: circ(f, 0, 0, 13.0)), 8.0)
        part.Update()
        sf.AddNewPad(croq(o.PlaneXY, lambda f: rect(f, 0, -26.5, 61, 26.5)), 7.0)
        part.Update()
        return vol()
    reg.paso("base D38 x 20, resalto D26 x 8, brazo 53 x 61 x 7", base)

    def r4():
        ar = [d for d in topologia(doc, body, "Edge") if "cdg" in d and abs(d["cdg"][2] - 7) < 0.01
              and abs(math.hypot(d["cdg"][0], d["cdg"][1]) - 19) < 0.5 and d["cdg"][0] > 0]
        v0 = vol()
        fi = sf.AddNewSolidEdgeFilletWithConstantRadius(ar[0]["ref"], 0, 4.0)
        for d in ar[1:]:
            fi.AddObjectToFillet(d["ref"])
        part.Update()
        return {"aristas": len(ar), "suma": round(vol() - v0, 3)}
    reg.paso("R4 donde el brazo toca la base", r4)

    def recorte():
        sk = croq(o.PlaneXY, lambda f: (rect(f, 0, 19, 61, 29), rect(f, 0, -29, 61, -19)))
        v0 = vol()
        pk = sf.AddNewPocket(sk, 15.0)
        part.Update()
        if vol() >= v0 - 1:
            pk.DirectionOrientation = 1 - pk.DirectionOrientation
            part.Update()
        v1 = vol()
        h = croq(o.PlaneXY, lambda f: circ(f, 0, 0, 8.0))
        pk2 = sf.AddNewPocket(h, 28.0)
        part.Update()
        if vol() >= v1 - 1:
            pk2.DirectionOrientation = 1 - pk2.DirectionOrientation
            part.Update()
        return {"recorte": round(v0 - v1, 3), "agujero": round(v1 - vol(), 3), "cuenta_agujero": round(math.pi * 64 * 28, 3)}
    reg.paso("recorte del brazo a 38 y agujero D16", recorte)

    def pata():
        m0 = medir(doc, part, body)
        pd = sf.AddNewPad(croq(o.PlaneXY, lambda f: rect(f, 51, -19, 61, 19)), 23.0)
        part.Update()
        if centro_agregado(m0, medir(doc, part, body))[2] > 0:       # tiene que crecer hacia -Z
            pd.DirectionOrientation = 1 - pd.DirectionOrientation
            part.Update()
        return {"suma": round(vol() - m0["volume"], 3), "cuenta": 10 * 38 * 23}
    reg.paso("pata 10 x 38 x 23 hacia abajo", pata)

    def doblez():
        # CAMBIO 4 (24/10/2026, ejercicio 24): en la R21 de CATA la primera arista candidata del R5 no era la del rincon
        # (AddNewSolidEdgeFilletWithConstantRadius failed y faltaron 203,874 mm3 = (1 - pi/4) x 5^2 x 38): ver
        # redondeo_con_candidatas() arriba (convexo saca, concavo suma)
        out = {}
        for nombre, x, z, r, signo in (("R10", 61, 7, 10.0, -1.0), ("R5", 51, 0, 5.0, 1.0)):
            ar = [d for d in topologia(doc, body, "Edge") if "cdg" in d and abs(d["cdg"][0] - x) < 0.01
                  and abs(d["cdg"][2] - z) < 0.01 and abs(d.get("medida", 0) - 38) < 0.5]
            out[nombre] = redondeo_con_candidatas(sf, part, vol, ar, r, signo * redondeo_90(r, 38.0), nombre)
        return out
    reg.paso("R10 afuera y R5 adentro del doblez", doblez)

    def ranuras():
        out = {}
        for nombre, largo, ancho, prof in (("18 x 34", 34.0, 18.0, 5.0), ("12 x 28", 28.0, 12.0, 10.0)):
            pl = hsf.AddNewPlaneOffset(ref(part, o.PlaneYZ), 61.0, False)
            body.InsertHybridShape(pl)
            ctx["construccion"].append(pl)
            part.Update()
            sk = croq(pl, lambda f: ranura_vertical(f, 0.0, -23.0, largo, ancho))     # YZ: H -> Y, V -> Z
            v0 = vol()
            pk = sf.AddNewPocket(sk, prof)
            part.Update()
            if vol() >= v0 - 1:
                pk.DirectionOrientation = 1 - pk.DirectionOrientation
                part.Update()
            out[nombre] = round(v0 - vol(), 3)
        return out
    reg.paso("ranuras de la pata (18 de 5 de profundo, 12 pasante)", ranuras)

    ctx.update(doc=doc, part=part, body=body, sf=sf)
    return ctx

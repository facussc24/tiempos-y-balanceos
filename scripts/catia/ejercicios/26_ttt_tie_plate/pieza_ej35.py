# -*- coding: utf-8 -*-
# Origen: ej35_tie_plate.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA
# por el PEDIDO PARA CATA 6). Cambios para el ejercicio 26 del banco de CATIA (24/10/2026), nada mas: 1) no importa
# captura, correr ni guardar_pieza; 2) cuerpo(c, reg) devuelve ctx (doc, part, el cuerpo principal, sf y lo de construccion: 0
# llamadas a InsertHybridShape, cada objeto se anota para ocultarlo) en vez de capturar y guardar: la masa, la captura y el
# STEP los hace el catia.py; 3) sin el bloque __main__ (armado por script, sin tocar nada mas).
"""ej35 — Too Tall Toby Party Pack 01-08 «Tie Plate» en CATIA (plano libre para uso educativo, @tootalltoby).
Orden pensado: PRIMERO la oreja (perfil en ZX, simetrica 20, agujero D11, recortada a la tira de 8 + bloque de 20) y su
espejo (Mirror refleja el cuerpo hasta ahi), DESPUES la placa encima (rectangulo + dos ranuras 66 x 190, D29 x4 y D84),
asi los recortes de la oreja no le comen la placa. Acero 7800 kg/m3. Respuesta 3 387,06 g; gemelo 434 238,267 mm3."""
import math
import os

from catia_base import medir, nueva_pieza, ref
from croquis import dibujar

DENS = 7.8e-3


def ranura_v(f, hc, vc, largo, ancho):
    r, hf = ancho / 2, largo / 2 - ancho / 2
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


def rect(f, x0, y0, x1, y1):
    dibujar(f, [("L", (x0, y0), (x1, y0)), ("L", (x1, y0), (x1, y1)), ("L", (x1, y1), (x0, y1)), ("L", (x0, y1), (x0, y0))])


def circ(f, h, v, r):
    k = f.CreateClosedCircle(h, v, r)
    k.CenterPoint = f.CreatePoint(h, v)


def cuerpo(c, reg):
    doc, part, body, sf = nueva_pieza(c, "ej35_tie_plate")
    o = part.OriginElements
    ctx = {"construccion": []}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def vol():
        return medir(doc, part, body)["volume"]

    def croq(plano, dib):
        sk = body.Sketches.Add(ref(part, plano))
        f = sk.OpenEdition()
        dib(f)
        sk.CloseEdition()
        part.Update()
        return sk

    def vaciar(sk, prof, simetrico=False):
        v0 = vol()
        pk = sf.AddNewPocket(sk, float(prof))
        if simetrico:
            pk.IsSymmetric = True
        part.Update()
        if vol() >= v0 - 1:
            pk.DirectionOrientation = 1 - pk.DirectionOrientation
            part.Update()
        return round(v0 - vol(), 3)

    def oreja():
        # ZX: H -> Z, V -> X
        pts = [(0, 45), (-19, 85), (-19, 125), (11, 125), (11, 45)]
        sk = croq(o.PlaneZX, lambda f: dibujar(f, [("L", pts[i], pts[(i + 1) % 5]) for i in range(5)]))
        pd = sf.AddNewPad(sk, 10.0)
        pd.IsSymmetric = True
        part.Update()
        v1 = vol()
        agujero = vaciar(croq(o.PlaneZX, lambda f: circ(f, -5.0, 111.0, 5.5)), 15.0, simetrico=True)
        # recorte: en XY saco x 45..85 con |y| entre 4 y 10, de arriba a abajo (todavia no hay placa)
        recorte = vaciar(croq(o.PlaneXY, lambda f: (rect(f, 45, 4, 85, 11), rect(f, 45, -11, 85, -4))), 30.0, simetrico=True)
        return {"oreja": v1, "agujero": agujero, "recorte": recorte, "vol": vol()}
    reg.paso("oreja: perfil en ZX simetrico 20, agujero D11, recorte a la tira de 8", oreja)

    def espejo():
        v0 = vol()
        sf.AddNewMirror(ref(part, o.PlaneYZ))
        part.Update()
        return {"antes": v0, "despues": vol()}
    reg.paso("espejo de la oreja (plano YZ)", espejo)

    def placa():
        sf.AddNewPad(croq(o.PlaneXY, lambda f: rect(f, -61, -81, 61, 81)), 16.0)
        part.Update()
        sf.AddNewPad(croq(o.PlaneXY, lambda f: (ranura_v(f, 61.0, 0.0, 190.0, 66.0), ranura_v(f, -61.0, 0.0, 190.0, 66.0))), 16.0)
        part.Update()
        v1 = vol()

        def agujeros(f):
            for x in (61.0, -61.0):
                for y in (62.0, -62.0):
                    circ(f, x, y, 14.5)
            circ(f, 0.0, 0.0, 42.0)
        saca = vaciar(croq(o.PlaneXY, agujeros), 16.0)
        return {"placa_mas_orejas": v1, "agujeros": saca, "cuenta_agujeros": round(16 * math.pi * (4 * 14.5 ** 2 + 42 ** 2), 3)}
    reg.paso("placa: rectangulo + dos ranuras 66 x 190, D29 x4 y D84", placa)

    ctx.update(doc=doc, part=part, body=body, sf=sf)
    return ctx

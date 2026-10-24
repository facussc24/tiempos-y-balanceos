# -*- coding: utf-8 -*-
# Origen: ej45_resorte.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA por el
# PEDIDO 27 a «para CATA - practica 19-10»; sha256 29c54a11...533c). Cambios para el ejercicio 38 del banco de CATIA
# (24/10/2026), nada mas: 1) no importa captura, correr, guardar_pieza ni os; 2) cuerpo(c, reg, inclinado) devuelve ctx
# (doc, part, body y el largo de la helice) en vez de capturar, guardar y anotar reg.datos["resultado"]: captura y STEP los
# hace el catia.py; 3) sin el bloque __main__; 4) CAMBIO 4: con inclinado=True el circulo va en el plano ZX del origen
# (pasa por el punto de arranque y queda a atan(P / (2 pi R)) = 4,55 grados del plano normal a la helice) en vez del plano
# normal: es el control que el docstring de la practica nombra y su codigo no tenia (la fila 38 de la COLA lo pide); el
# documento del inclinado se llama ej45_resorte_inclinado y el nombre del paso dice cual de los dos es.
"""ej45 — SUPERFICIES / barrido con respuesta EXACTA: resorte = circulo R2 barrido por una helice R20, paso 10, alto 50
(5 vueltas). Volumen exacto de un tubo barrido con el perfil normal al camino = area x largo del camino:
pi * 2^2 * 5 * sqrt((2 pi 20)^2 + 10^2). Helice (AddNewHelix) en un set geometrico, plano normal a la helice en su punto de
arranque (AddNewPlaneNormal), circulo 3D en ese plano (AddNewCircleCtrRad) y nervio desde referencias
(AddNewRibFromRef). Control extra: un perfil inclinado (en el plano XZ, a 4,55 grados de la normal) tiene que dar
area x largo x cos(4,55)."""
import math

from catia_base import medir, nueva_pieza, ref

R, P, H, r = 20.0, 10.0, 50.0, 2.0
LARGO = (H / P) * math.sqrt((2 * math.pi * R) ** 2 + P ** 2)
ESPERADO = math.pi * r ** 2 * LARGO


def cuerpo(c, reg, inclinado=False):
    doc, part, body, sf = nueva_pieza(c, "ej45_resorte_inclinado" if inclinado else "ej45_resorte")
    hsf = part.HybridShapeFactory
    ctx = {}
    try:
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass

    def resorte():
        gs = part.HybridBodies.Add()
        gs.Name = "Construccion"
        o = hsf.AddNewPointCoord(0, 0, 0)
        arriba = hsf.AddNewPointCoord(0, 0, 10)
        arranque = hsf.AddNewPointCoord(R, 0, 0)
        for p in (o, arriba, arranque):
            gs.AppendHybridShape(p)
        eje = hsf.AddNewLinePtPt(ref(part, o), ref(part, arriba))
        gs.AppendHybridShape(eje)
        part.Update()
        hel = hsf.AddNewHelix(ref(part, eje), False, ref(part, arranque), P, H, False, 0.0, 0.0, False)
        gs.AppendHybridShape(hel)
        part.Update()
        spa = doc.GetWorkbench("SPAWorkbench")
        L = spa.GetMeasurable(ref(part, hel)).Length
        ctx["largo_helice"] = L
        if inclinado:                                   # CAMBIO 4: el plano ZX del origen, no el normal
            pl = part.OriginElements.PlaneZX
        else:
            pl = hsf.AddNewPlaneNormal(ref(part, hel), ref(part, arranque))
            gs.AppendHybridShape(pl)
            part.Update()
        circ = hsf.AddNewCircleCtrRad(ref(part, arranque), ref(part, pl), False, r)
        gs.AppendHybridShape(circ)
        part.Update()
        part.InWorkObject = body
        sf.AddNewRibFromRef(ref(part, circ), ref(part, hel))
        part.Update()
        sel = doc.Selection
        sel.Clear()
        sel.Add(gs)
        sel.VisProperties.SetShow(1)
        sel.Clear()
        v = medir(doc, part, body)["volume"]
        return {"largo_helice": round(L, 4), "largo_cuenta": round(LARGO, 4), "vol": v, "esperado": round(ESPERADO, 3),
                "dif_%": round(100 * (v - ESPERADO) / ESPERADO, 4)}
    reg.paso("helice + circulo " + ("en el plano ZX (inclinado)" if inclinado else "normal") + " + nervio", resorte)
    ctx.update(doc=doc, part=part, body=body)
    return ctx

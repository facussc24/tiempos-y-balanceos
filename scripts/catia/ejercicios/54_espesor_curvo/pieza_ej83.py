# -*- coding: utf-8 -*-
"""Ejercicio 54 del banco de CATIA (24/10/2026, CATA): el ej83 de la practica (19/10, «para CATA - practica 19-10» en la
nube) con dos cambios anotados:

  CAMBIO 1: los DOS lados, cada uno en su pieza: el espesor de 3 hacia adentro (R 597-600) y hacia afuera (R 600-603).
            El ej83 hacia uno solo, el que daba AddNewThickSurface(superficie, 0, 3, 0).
  CAMBIO 2: el lado no se supone: se prueba una forma de pedirlo y se mira el centro de lo que quedo (adentro el centro
            cae mas cerca del centro del arco que el del arco mismo, R sen(t/2) / (t/2)); si cayo del otro lado, se borra
            y se prueba la siguiente. Antes del espesor se mide el largo del arco (310, no el circulo entero: con
            SetLimitation(1) la practica midio 3 769,9).

Arco de R600 centrado en el origen, en el plano XY, simetrico alrededor de +Y (de -t/2 a +t/2, t = 310 / 600), extruido
95 en +Z."""
import math

from catia_base import medir, nueva_pieza, ref

R, LARGO, ANCHO, ESP = 600.0, 310.0, 95.0, 3.0
TH = LARGO / R
R_ARCO = R * math.sin(TH / 2) / (TH / 2)            # el centro del arco (la superficie sin espesor), sobre +Y
FORMAS = ((0, ESP, 0.0), (0, 0.0, ESP), (1, ESP, 0.0), (1, 0.0, ESP))   # (lado, arriba, abajo) de AddNewThickSurface


def lado_de(cdg):
    """'adentro' si el centro de lo que quedo cae mas cerca del centro del arco que el arco mismo; si no, 'afuera'."""
    return "adentro" if math.hypot(cdg[0], cdg[1]) < R_ARCO else "afuera"


def elegir_forma(lado, crear, centro, borrar):
    """Prueba las FORMAS de pedir el espesor hasta que el centro de lo que queda cae del `lado` pedido; la que cae del otro
    lado o falla se borra antes de la siguiente. Devuelve (forma, intentos)."""
    intentos = []
    for forma in FORMAS:
        obj = None
        try:
            obj = crear(forma)
            quedo = lado_de(centro())
            intentos.append(f"{forma}: {quedo}")
            if quedo == lado:
                return forma, intentos
            raise RuntimeError(f"quedo {quedo}")
        except Exception as e:  # noqa: BLE001
            if not intentos or not intentos[-1].startswith(str(forma)):
                intentos.append(f"{forma}: {repr(e)[:80]}")
            if obj is not None:
                borrar(obj)
    raise RuntimeError(f"ninguna forma dio el espesor {lado}: {intentos}")


def una(c, reg, lado):
    doc, part, main, sf = nueva_pieza(c, f"espesor_{lado}")
    hsf = part.HybridShapeFactory
    gs = part.HybridBodies.Add()
    ctx = {"doc": doc, "part": part, "body": main, "construccion": [gs]}

    def pon(s):
        # se ocultan el set y cada elemento. 54_r2 ya ocultaba cada uno y la pieza de adentro salio igual con la superficie
        # suelta: lo que lo arreglo fue cerrar cada pieza mientras es el documento activo (construir de catia.py)
        gs.AppendHybridShape(s)
        part.Update()
        ctx["construccion"].append(s)
        return s

    def superficie():
        a = TH / 2
        p1 = pon(hsf.AddNewPointCoord(-R * math.sin(a), R * math.cos(a), 0.0))
        p2 = pon(hsf.AddNewPointCoord(0.0, R, 0.0))
        p3 = pon(hsf.AddNewPointCoord(R * math.sin(a), R * math.cos(a), 0.0))
        arc = hsf.AddNewCircle3Points(ref(part, p1), ref(part, p2), ref(part, p3))
        arc.SetLimitation(0)                              # medido 19/10: 1 = circulo ENTERO (3 769,9 mm)
        pon(arc)
        largo = doc.GetWorkbench("SPAWorkbench").GetMeasurable(ref(part, arc)).Length
        if abs(largo - LARGO) > 1e-3:
            raise RuntimeError(f"el arco mide {largo:.4f}, no {LARGO}")
        ctx["ext"] = pon(hsf.AddNewExtrude(ref(part, arc), ANCHO, 0.0, hsf.AddNewDirectionByCoord(0, 0, 1)))
        area = doc.GetWorkbench("SPAWorkbench").GetMeasurable(ref(part, ctx["ext"])).Area * 1e6
        return {"largo_arco": round(largo, 4), "area_superficie": round(area, 3)}
    ctx["superficie"] = reg.paso(f"{lado}: arco R600 x 310 (largo medido) extruido 95", superficie)

    def crear(forma):
        n0 = main.Shapes.Count
        try:
            ts = sf.AddNewThickSurface(ref(part, ctx["ext"]), forma[0], forma[1], forma[2])
            part.Update()
            return ts
        except Exception:
            # NOTAS de la practica: un AddNewThickSurface que falla puede dejar la operacion hecha; si quedo, se borra
            if main.Shapes.Count > n0:
                borrar(main.Shapes.Item(main.Shapes.Count))
            raise

    def borrar(obj):
        s = doc.Selection
        s.Clear()
        s.Add(obj)
        s.Delete()
        part.Update()

    def espesor():
        part.InWorkObject = main
        forma, intentos = elegir_forma(lado, crear, lambda: medir(doc, part, main)["cdg_mm"], borrar)
        m = medir(doc, part, main)
        return {"forma": list(forma), "intentos": intentos, "vol": m["volume"], "cdg_mm": m["cdg_mm"]}
    ctx["espesor"] = reg.paso(f"{lado}: espesor 3", espesor)
    return ctx


def cuerpo(c, reg):
    return {lado: una(c, reg, lado) for lado in ("adentro", "afuera")}

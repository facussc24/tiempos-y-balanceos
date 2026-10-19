# -*- coding: utf-8 -*-
"""plano_de_step.py <archivo.step> <salida.pdf> [--titulo "texto"]: plano A3 apaisado de cualquier STEP con CATIA.
Cuatro vistas (superior, frente, lateral, isometrica), escala normalizada elegida para que entre, marco, cajetin con la
caja medida (build123d sobre el mismo STEP, no se inventa ninguna cota) y PDF. Corre con C:\\Dev\\_catia_env.
Usa SU propia CATIA (catia_base): se niega si hay otra abierta."""
import os
import sys
import time

import pythoncom

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catia_base import Vigia, apagar, conectar, medir_step  # noqa: E402

A3, APAISADO, ABAJO, DERECHA = 5, 1, 3, 0
ESCALAS = [1.0, 0.5, 0.4, 0.25, 0.2, 0.1, 0.05]          # 1:1, 1:2, 1:2,5, 1:4, 1:5, 1:10, 1:20


def escala_para(caja):
    """La mayor escala normalizada con la que dos vistas de la pieza entran a lo ancho (2 x largo <= 300 mm) y a lo alto."""
    largo, ancho, alto = caja
    for e in ESCALAS:
        if (largo + max(ancho, alto)) * e <= 300 and (ancho + alto) * e <= 200:
            return e
    return ESCALAS[-1]


def plano(c, step, pdf, titulo):
    m = medir_step(step)
    if "caja" not in m:
        raise SystemExit(f"no pude medir el STEP: {m}")
    caja = m["caja"]
    e = escala_para(caja)
    c.Documents.Open(step)
    dp = c.ActiveDocument
    try:
        prod = dp.Product
    except Exception:  # noqa: BLE001
        raise SystemExit("el STEP no abrio como pieza ni producto")
    drw = c.Documents.Add("Drawing")
    hoja = drw.Sheets.ActiveSheet
    hoja.PaperSize, hoja.Orientation, hoja.Scale = A3, APAISADO, 1.0
    vs = hoja.Views
    dx, dy = caja[0] * e, caja[1] * e
    x_sup, y_sup = 20 + dx / 2 + 10, 280 - dy / 2 - 20
    sup = vs.Add("Superior")
    sup.X, sup.Y, sup.Scale = x_sup, y_sup, e
    gb = sup.GenerativeBehavior
    gb.Document = prod
    gb.DefineFrontView(1.0, 0.0, 0.0, 0.0, 1.0, 0.0)
    gb.Update()
    for nombre, tipo, x, y in (("Frente", ABAJO, x_sup, y_sup - dy / 2 - caja[2] * e / 2 - 40),   # 40: deja lugar al rotulo
                               ("Lateral", DERECHA, x_sup + dx / 2 + caja[2] * e / 2 + 25, y_sup)):
        v = vs.Add(nombre)
        v.X, v.Y, v.Scale = x, y, e
        v.GenerativeBehavior.Document = prod
        v.GenerativeBehavior.DefineProjectionView(gb, tipo)
        v.GenerativeBehavior.Update()
    iso = vs.Add("Isometrica")
    iso.X, iso.Y, iso.Scale = 330.0, 110.0, e * 0.6
    iso.GenerativeBehavior.Document = prod
    iso.GenerativeBehavior.DefineIsometricView(-0.707, 0.707, 0.0, -0.408, -0.408, 0.816)
    iso.GenerativeBehavior.Update()
    fondo = vs.Item(2)
    fondo.Activate()
    f2 = fondo.Factory2D
    for x1, y1, x2, y2 in ((10, 10, 410, 10), (410, 10, 410, 287), (410, 287, 10, 287), (10, 287, 10, 10),
                           (250, 10, 250, 52), (250, 52, 410, 52), (250, 31, 410, 31)):
        f2.CreateLine(float(x1), float(y1), float(x2), float(y2))
    esc = "1:%g" % (1 / e) if e <= 1 else "%g:1" % e
    for t, y in (("BARACK MERCOSUL - Ingenieria", 47.0), (titulo[:42], 40.0),
                 (("Caja %.1f x %.1f x %.1f mm" % tuple(caja)).replace(".", ","), 26.0),
                 ("Escala %s - A3 - F.Santoro - %s" % (esc.replace(".", ","), time.strftime("%d/%m/%Y")), 19.0)):
        fondo.Texts.Add(t, 254.0, y)
    vs.Item(1).Activate()
    if os.path.exists(pdf):
        os.remove(pdf)
    drw.ExportData(pdf, "pdf")
    drw.Close()
    dp.Close()
    return {"escala": esc, "caja": caja, "pdf": pdf}


if __name__ == "__main__":
    step, pdf = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    titulo = sys.argv[sys.argv.index("--titulo") + 1] if "--titulo" in sys.argv else os.path.splitext(os.path.basename(step))[0]
    pythoncom.CoInitialize()
    c, pid = conectar()
    vig = Vigia(pid) if pid else None
    if vig:
        vig.start()
    try:
        print(plano(c, step, pdf, titulo))
    finally:
        if vig:
            vig.parar()

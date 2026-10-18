#!/usr/bin/env python
# -*- coding: utf-8 -*-
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe test_fijaciones.py
"""El piso de la tuerca impresa (regla de Leo, 13/10/2026; ficha-fdm.md R2) en las dos direcciones.

BIEN: el tornillo de 7 mm validado el 14/10 (rosca 4,70, tuerca 5 mm = 1,06 D) pasa. MAL: una tuerca de 4 mm para el
mismo tornillo (0,85 D, el alto de una ISO 4032 de acero) no pasa, y make_screw_nut.py se niega ANTES de modelar,
nombrando la regla. Justo en el piso (1,00 D) pasa.
"""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import make_screw_nut as m  # noqa: E402

fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


ok, msg = m.piso_tuerca(4.70, 5.0)
chequear(ok, "tornillo de 7 mm del 14/10 (4,70 / tuerca 5,0): pasa — %s" % msg)
ok, msg = m.piso_tuerca(4.70, 4.0)
chequear(not ok and "Leo" in msg, "tuerca de 4,0 para 4,70 (0,85 D): no pasa y nombra la regla")
chequear(m.piso_tuerca(4.70, 4.70)[0], "justo en el piso (1,00 D): pasa")
try:
    m.main(["--major", "4.70", "--pitch", "1.0", "--total-length", "20", "--head-dia", "12", "--head-th", "4",
            "--nut-af", "9", "--nut-h", "4.0", "--out", os.path.join(AQUI, "_no_se_crea"), "--name", "x"])
    chequear(False, "make_screw_nut.py con una tuerca baja tenia que negarse")
except SystemExit as e:
    chequear("piso" in str(e) and not os.path.isdir(os.path.join(AQUI, "_no_se_crea")),
             "make_screw_nut.py se niega antes de modelar (no crea la carpeta de salida)")

print("")
print("RESULTADO:", "OK" if not fallos else "%d falla(s)" % len(fallos))
sys.exit(1 if fallos else 0)

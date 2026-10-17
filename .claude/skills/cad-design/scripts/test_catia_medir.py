#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Interprete: cualquiera con Python 3.10+ (no necesita CATIA ni pywin32: prueba las partes puras).
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe test_catia_medir.py
"""Prueba de catia_medir.py sin abrir CATIA: la cabecera STEP, la matriz del marco y el freno de CATIA ajena.

Casos BIEN / MAL: una cabecera al revés (la de OpenCASCADE) se reordena y una ya en orden queda igual; una cabecera
incompleta frena; la matriz del marco identidad no mueve nada y la de un marco girado devuelve el origen a cero.
Sale 0 si todo se comporta como corresponde (incluidos los fallos esperados).
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import catia_medir as cm  # noqa: E402

fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


OCC = """ISO-10303-21;
HEADER;
FILE_NAME('Open CASCADE Shape Model','2026-10-13T08:52:31',('Author'),(
    'Open CASCADE'),'Open CASCADE STEP processor 7.8','Open CASCADE 7.8'
  ,'Unknown');
FILE_DESCRIPTION(('Open CASCADE Model'),'2;1');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
#1 = CARTESIAN_POINT('',(0.,0.,0.));
ENDSEC;
END-ISO-10303-21;
"""

print("1. cabecera STEP (ISO 10303-21: FILE_DESCRIPTION, FILE_NAME, FILE_SCHEMA)")
nuevo, orden = cm.cabecera_en_orden(OCC)
chequear(orden == ["FILE_NAME", "FILE_DESCRIPTION", "FILE_SCHEMA"], "detecta el orden de OpenCASCADE: %s" % orden)
cab = nuevo[nuevo.index("HEADER;"):nuevo.index("ENDSEC;")]
chequear(cab.index("FILE_DESCRIPTION") < cab.index("FILE_NAME") < cab.index("FILE_SCHEMA"), "queda en el orden de la norma")
chequear(nuevo[nuevo.index("DATA;"):] == OCC[OCC.index("DATA;"):], "la sección DATA no se toca")
otra, orden2 = cm.cabecera_en_orden(nuevo)
chequear(orden2 == ["FILE_DESCRIPTION", "FILE_NAME", "FILE_SCHEMA"] and otra.count("FILE_NAME") == 1,
         "una cabecera ya en orden sale igual (idempotente)")
try:
    cm.cabecera_en_orden(OCC.replace("FILE_SCHEMA", "FILE_XXX"))
    chequear(False, "una cabecera sin FILE_SCHEMA tiene que frenar")
except ValueError:
    chequear(True, "una cabecera sin FILE_SCHEMA frena (MAL)")

print("2. matriz del marco (Move.Apply de CATIA)")
ident = {"ex": [1, 0, 0], "ey": [0, 1, 0], "ez": [0, 0, 1], "origen": [0, 0, 0]}
chequear(cm.matriz_desde_frame(ident) == [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], "marco identidad: no mueve")
gir = {"ex": [0, 1, 0], "ey": [-1, 0, 0], "ez": [0, 0, 1], "origen": [10, 20, 30]}
v = cm.matriz_desde_frame(gir)
# punto origen del marco en coordenadas del cliente -> tiene que quedar en (0,0,0) del marco local
x, y, z = gir["origen"]
loc = [v[0] * x + v[3] * y + v[6] * z + v[9], v[1] * x + v[4] * y + v[7] * z + v[10], v[2] * x + v[5] * y + v[8] * z + v[11]]
chequear(all(abs(c) < 1e-9 for c in loc), "marco girado: el origen del marco cae en cero (%s)" % loc)
chequear(not all(abs(c) < 1e-9 for c in [v[9], v[10], v[11]]), "gemelo: la traslación no es nula (si lo fuera, el control sería ciego)")

print("3. freno de CATIA ajena (falla cerrado: auditor del 17/10, I4)")
chequear(isinstance(cm.cnext_abiertos(), list), "cnext_abiertos devuelve una lista (vacía si no hay CATIA)")


class _R:
    def __init__(self, out, rc=0):
        self.stdout, self.returncode = out, rc


def _cae(*a, **k):
    raise cm.subprocess.TimeoutExpired("tasklist", 20)


chequear(cm.cnext_abiertos(_cae) is None, "tasklist que tarda: None (no se pudo mirar), no []")
chequear(cm.cnext_abiertos(lambda *a, **k: _R("", 1)) is None, "tasklist con error: None")
chequear(cm.cnext_abiertos(lambda *a, **k: _R('"CNEXT.exe","4321","Console","1","500.000 KB"\n')) == [4321],
         "tasklist con una CATIA: [4321]")
try:
    cm.main(["medir", "--step", "x.step", "--choque", "p.step", "x.step", "--frame", "f.json", "--salida", "s.json"])
    chequear(False, "--frame sin --frame-inseguro tiene que frenar")
except SystemExit as e:
    chequear(e.code == 2, "--frame sin --frame-inseguro frena (el choque falso del 13/10)")
print("4. macro de mover")
chequear("prod.Move.Apply a" in cm.macro_mover([0] * 12) and len(re.findall(r"a\(\d+\) = ", cm.macro_mover([0] * 12))) == 12,
         "la macro arma los 12 valores")

print("\nRESULTADO:", "OK" if not fallos else "FALLAS: %d" % len(fallos))
sys.exit(1 if fallos else 0)

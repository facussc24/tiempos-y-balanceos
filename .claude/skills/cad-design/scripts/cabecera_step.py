# -*- coding: utf-8 -*-
# Interprete: cualquier Python 3.10+ (solo lee y escribe texto).
#   python cabecera_step.py revisar <archivos o carpetas...>     # solo lee; saltea lo que esta solo en la nube
#   python cabecera_step.py arreglar <archivo.step...>           # reordena en el lugar (conserva la fecha)
"""Cabecera de los STEP: ISO 10303-21 fija FILE_DESCRIPTION, FILE_NAME, FILE_SCHEMA (tanda 2, 17/10/2026).

OpenCASCADE 7.8 (build123d, cadquery) la escribe al revés y CATIA V5 R21 lee ese STEP VACÍO sin avisar.
`export_deliverables.py` ya la arregla en la copia que entrega; esto es para mirar lo que ya se entregó por otro camino.

`revisar` no escribe nada y NO abre un archivo que OneDrive tiene solo en la nube (abrirlo lo descarga): lo cuenta
aparte. `arreglar` reescribe solo la cabecera; un STEP ya entregado en la nube de Ingeniería es un entregable y se
reemplaza con el OK de Fak (plan del sistema, tanda 2, punto 5).

Códigos de salida: revisar 0 si todos los leídos están en orden, 1 si alguno no; arreglar 0 si quedaron en orden.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import step_cabecera as sc  # noqa: E402


def _steps(rutas):
    for r in rutas:
        if os.path.isdir(r):
            for dp, _, fs in os.walk(r):
                for f in fs:
                    if f.lower().endswith((".step", ".stp")):
                        yield os.path.join(dp, f)
        else:
            yield r


def revisar(rutas):
    n = {"en orden": 0, "al reves": 0, "solo en la nube": 0, "sin cabecera": 0}
    for p in _steps(rutas):
        if sc.solo_en_la_nube(p):
            n["solo en la nube"] += 1
            print("  NUBE     %s (no se abrio: leerlo lo descarga)" % p)
            continue
        try:
            o = sc.orden_de_archivo(p)
        except OSError as e:
            n["sin cabecera"] += 1
            print("  ERROR    %s: %s" % (p, e))
            continue
        if o is None:
            n["sin cabecera"] += 1
            print("  ?        %s: no tiene una cabecera STEP completa" % p)
        elif o == sc.CLAVES:
            n["en orden"] += 1
        else:
            n["al reves"] += 1
            print("  AL REVES %s (%s)" % (p, ", ".join(k.replace("FILE_", "") for k in o)))
    print("RESUMEN: " + " · ".join("%s %d" % (k, v) for k, v in n.items()))
    return 1 if n["al reves"] else 0


def arreglar(rutas):
    mal = 0
    for p in rutas:
        cambio, orden = sc.arreglar_archivo(p)
        print("  %s %s%s" % ("ARREGLADO" if cambio else "ya estaba", p,
                             (" (tenia %s)" % ", ".join(orden)) if cambio else ""))
        if sc.orden_de_archivo(p) != sc.CLAVES:
            mal += 1
    return 1 if mal else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("revisar")
    r.add_argument("rutas", nargs="+")
    a_ = sub.add_parser("arreglar")
    a_.add_argument("rutas", nargs="+")
    a = ap.parse_args(argv)
    return revisar(a.rutas) if a.cmd == "revisar" else arreglar(a.rutas)


if __name__ == "__main__":
    sys.exit(main())

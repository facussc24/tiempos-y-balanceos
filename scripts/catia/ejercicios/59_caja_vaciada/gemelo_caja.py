# -*- coding: utf-8 -*-
"""Gemelo del ejercicio 59 en build123d (se corre con .venv-cad): la caja 120 x 80 x 50 desde (0, 0, 0) MENOS la caja
interior puesta a mano (de (3, 3, 3) a (117, 77, 50) y un poco mas arriba, para que la boca quede abierta), sin la
operacion de cascara (offset/shell de build123d): la referencia se arma sin la operacion que se prueba (leccion del 56).

Escribe <carpeta>/caja_vaciada_gemelo.step y, con el STEP de CATIA como segundo argumento, cuenta sus caras y solidos.
Imprime un JSON en la ultima linea.

Uso: python gemelo_caja.py <carpeta> [<step de CATIA>]"""
import json
import os
import sys

from build123d import Align, Box, export_step, import_step

A, B, C, T = 120.0, 80.0, 50.0, 3.0
MIN = (Align.MIN, Align.MIN, Align.MIN)


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    caja = Box(A, B, C, align=MIN)
    adentro = Box(A - 2 * T, B - 2 * T, C, align=MIN).translate((T, T, T))      # llega a z = C + T: pasa la tapa
    g = caja - adentro
    ruta = os.path.join(out, "caja_vaciada_gemelo.step")
    export_step(g, ruta)
    r = {"gemelo": {"volumen": round(g.volume, 4), "cdg_mm": [round(v, 4) for v in g.center()], "caras": len(g.faces()),
                    "solidos": len(g.solids()), "step": ruta}}
    if len(sys.argv) > 2:
        cat = import_step(sys.argv[2])
        r["catia"] = {"caras": len(cat.faces()), "solidos": len(cat.solids())}
    print(json.dumps(r))


if __name__ == "__main__":
    main()

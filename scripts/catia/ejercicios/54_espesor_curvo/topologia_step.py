# -*- coding: utf-8 -*-
"""Topologia de un STEP con build123d (se corre con .venv-cad): solidos, cascaras, caras, aristas y vertices, y cuantos
quedan sueltos (fuera de todo solido). Revisor del 54: el STEP de 54_r1 traia ademas la curva del arco (17 aristas contra
12) y el volumen, el centro y las caras sueltas no la veian. Imprime un JSON en la ultima linea.

Uso: python topologia_step.py <archivo.step>"""
import json
import sys

from build123d import import_step


def main():
    forma = import_step(sys.argv[1])
    sol = forma.solids()

    def de_solidos(tipo):
        return {x.wrapped.__hash__() for s in sol for x in getattr(s, tipo)()}
    r = {"solidos": len(sol), "cascaras": len(forma.shells())}
    for tipo in ("faces", "edges", "vertices"):
        todas = getattr(forma, tipo)()
        dentro = de_solidos(tipo)
        r[tipo] = len(todas)
        r[f"{tipo}_sueltas"] = sum(1 for x in todas if x.wrapped.__hash__() not in dentro)
    print(json.dumps(r))


if __name__ == "__main__":
    main()

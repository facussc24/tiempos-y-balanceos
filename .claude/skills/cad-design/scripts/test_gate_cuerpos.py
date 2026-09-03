# -*- coding: utf-8 -*-
"""Par BIEN/MAL del GATE DE CUERPOS de export_deliverables.

Correr:  .venv-cad\\Scripts\\python.exe test_gate_cuerpos.py

Por que existe. El 2026-09-03 el gate se cambio: el techo de cuerpos dejo de ser 1 fijo y
paso a ser EL NUMERO DE SOLIDOS QUE DECLARA EL STEP. "Un solo cuerpo" es criterio de pieza
IMPRESA; en un ensamble las piezas van separadas a proposito y el gate rechazaba entregas
correctas (leccion 20 del skill, que estaba escrita y no estaba implementada aca).

Aflojar un gate es justo donde se cuelan los falsos verdes, asi que el cambio va con su
par y el par tiene que dar ROJO en tres direcciones distintas:

  1. pieza impresa (1 solido) con 1 cuerpo ............ VERDE  (comportamiento anterior)
  2. ensamble de 3 solidos con 3 cuerpos ............... VERDE  (lo que el gate rechazaba)
  3. 3 cuerpos declarando 1 solido ..................... ROJO   (el diseño se partio)
  4. cavidad SELLADA (volumen negativo) dentro de un
     ensamble legitimo ................................. ROJO   (la cavidad es roja SIEMPRE,
                                                                 por mas solidos que haya)

El caso 4 es el que importa: es el que prueba que la relajacion no se llevo puesto el
control de cavidades, que es el que existe porque el laminador las tapa a ciegas.
"""
import os
import sys
import tempfile

SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCR)

import numpy as np
import trimesh

import export_deliverables as ED


def guardar(mallas, nombre, invertir_ultima=False):
    """Concatena mallas en un STL. `invertir_ultima` da vuelta las normales de la ultima,
    que es como se ve una CAVIDAD SELLADA: un cuerpo de volumen negativo."""
    ms = []
    for i, m in enumerate(mallas):
        m = m.copy()
        if invertir_ultima and i == len(mallas) - 1:
            m.invert()
        ms.append(m)
    f = os.path.join(tempfile.gettempdir(), nombre)
    trimesh.util.concatenate(ms).export(f)
    return f


def caso(nombre, archivo, n_solidos, espera_verde):
    try:
        ED.gate_validez_cuerpos(archivo, nombre, n_solidos)
        dio = "VERDE"
    except SystemExit as e:
        dio = "ROJO"
        motivo = str(e).splitlines()[0]
    ok = (dio == "VERDE") == espera_verde
    print("   %-46s declara %d solidos -> %-5s  %s"
          % (nombre, n_solidos, dio, "OK" if ok else "*** MAL ***"))
    if dio == "ROJO":
        print("        %s" % motivo[:110])
    return ok


def main():
    print("PAR BIEN/MAL DEL GATE DE CUERPOS")
    print("=" * 78)
    caja = trimesh.creation.box(extents=(20, 20, 20))
    tres = [trimesh.creation.box(extents=(20, 20, 20)).apply_translation((40 * i, 0, 0))
            for i in range(3)]
    # cavidad sellada: una caja chica ADENTRO de otra, con las normales invertidas
    hueca = [trimesh.creation.box(extents=(40, 40, 40)),
             trimesh.creation.box(extents=(10, 10, 10))]

    f1 = guardar([caja], "gate_cuerpos_1.stl")
    f3 = guardar(tres, "gate_cuerpos_3.stl")
    fc = guardar(hueca, "gate_cuerpos_cav.stl", invertir_ultima=True)

    r = [
        caso("1 pieza impresa", f1, 1, True),
        caso("ensamble de 3 piezas, 3 declaradas", f3, 3, True),
        caso("3 cuerpos declarando 1 solido (se partio)", f3, 1, False),
        caso("ensamble con CAVIDAD SELLADA adentro", fc, 2, False),
    ]
    print()
    print("=" * 78)
    print("RESULTADO: %s  (%d de %d casos)"
          % ("VERDE" if all(r) else "ROJO", sum(r), len(r)))
    return 0 if all(r) else 1


if __name__ == "__main__":
    sys.exit(main())

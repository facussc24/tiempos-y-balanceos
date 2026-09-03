# -*- coding: utf-8 -*-
"""Par BIEN/MAL del GATE DE CUERPOS de export_deliverables.

Correr:  .venv-cad\\Scripts\\python.exe test_gate_cuerpos.py

Por que existe, y por que la PRIMERA version de este test no alcanzaba.

El 2026-09-03 el gate se cambio dos veces en el mismo dia:

  (1) el techo dejo de ser 1 fijo y paso a ser `_contar_solidos(step)`. "Un solo cuerpo"
      es criterio de pieza IMPRESA; en un ensamble las piezas van separadas a proposito y
      el gate rechazaba entregas correctas (leccion 20 del skill).
  (2) ESO ESTABA MAL, y lo demostro en corrida una auditoria independiente el mismo dia:
      el techo y lo que se mide salian DEL MISMO ARCHIVO. Un boolean fuse que falla y deja
      2 solidos sueltos da un STEP que declara 2 y un STL con 2 cuerpos -- coinciden
      SIEMPRE, el gate no dispara nunca, y encima imprimia "es un ENSAMBLE, no una pieza
      partida". Para el bug que este control existe para cazar quedaba TAUTOLOGICO.
      Ahora el techo lo DECLARA una persona, con --ensamble NOMBRE:N.

Y el test tampoco alcanzaba: su unico caso rojo de "diseño partido" alimentaba n_solidos=1
a mano junto a un STL de 3 cuerpos, una combinacion que el pipeline real NUNCA produce.
Daba 4/4 verde sin probar lo que decia probar. El caso 5 es el que faltaba.

  1. pieza impresa (1 solido) con 1 cuerpo ............ VERDE  (comportamiento anterior)
  2. ensamble de 3 piezas DECLARADO como tal .......... VERDE  (lo que el gate rechazaba)
  3. 3 cuerpos y nadie declaro nada ................... ROJO   (el techo por default es 1)
  4. cavidad SELLADA dentro de un ensamble declarado .. ROJO   (la cavidad es roja SIEMPRE)
  5. FUSE ROTO: 2 cuerpos y el STEP declararia 2 ...... ROJO   (el caso que se colaba)

El 4 prueba que la relajacion no se llevo puesto el control de cavidades. El 5 prueba que
el gate volvio a cazar el diseño partido, que es lo que la version del mediodia perdio.
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

    # Caso 5: EL FUSE ROTO. Dos cajas separadas por 0,05 mm, que es la tolerancia tipica
    # de un boolean que no cerro. En el pipeline real ese STEP declara 2 solidos y su STL
    # tiene 2 cuerpos: los dos numeros COINCIDEN, y por eso el techo no puede salir del
    # archivo. Con el techo por default (1 = nadie declaro que esto fuera un ensamble),
    # da rojo, que es lo que corresponde.
    dos = [trimesh.creation.box(extents=(20, 20, 20)),
           trimesh.creation.box(extents=(20, 20, 20)).apply_translation((20.05, 0, 0))]
    ff = guardar(dos, "gate_cuerpos_fuse_roto.stl")

    r = [
        caso("1 pieza impresa", f1, 1, True),
        caso("ensamble de 3 piezas, DECLARADO --ensamble x:3", f3, 3, True),
        caso("3 cuerpos y nadie declaro nada (techo 1)", f3, 1, False),
        caso("ensamble declarado con CAVIDAD SELLADA adentro", fc, 2, False),
        caso("FUSE ROTO: 2 cuerpos, el STEP declararia 2", ff, 1, False),
    ]
    print()
    print("   El caso 5 es el que se colaba: con el techo leido del propio STEP daba")
    print("   VERDE (2 cuerpos <= 2 solidos declarados). Con el techo por default en 1,")
    print("   da ROJO -- porque nadie declaro que esa pieza fuera un ensamble.")
    print()
    print("=" * 78)
    print("RESULTADO: %s  (%d de %d casos)"
          % ("VERDE" if all(r) else "ROJO", sum(r), len(r)))
    return 0 if all(r) else 1


if __name__ == "__main__":
    sys.exit(main())

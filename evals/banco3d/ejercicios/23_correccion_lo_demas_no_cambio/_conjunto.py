"""Comun del ejercicio 23: un conjunto chico del virolador del 20/10 armado con la biblioteca de la casa: la brida
(placa 64 x 24 x 4 con chaflan de cama 0,6, la del ejercicio 21) y encima el pedestal (caja 52 x 30, la del 20).
El pedido de correccion es «subir el pedestal 5 mm» (53,11 -> 58,11): lo unico que puede cambiar es el pedestal.
  armar(nombre, alto_pedestal, chaflan_brida, con_brida=True): exporta <nombre>.step (DESPUES) y <nombre>__antes.step
  (el conjunto de ANTES: pedestal 53,11, brida con chaflan 0,6), cada solido con su nombre (pedestal, brida)."""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
sys.path.insert(0, os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts')))
from _comun import carpeta_salida, salir_error  # noqa: E402

ALTO_ANTES = 53.11


def _conjunto(alto_pedestal, chaflan_brida, con_brida=True):
    from build123d import Compound
    from cadlib import constructores as k
    partes = []
    if con_brida:
        brida = k.placa(64, 24, 4, chaflan_cama=chaflan_brida)
        brida.label = 'brida'
        partes.append(brida)
    ped = k.caja(52, 30, alto_pedestal, centro=(0, 0, 4))
    ped.label = 'pedestal'
    partes.append(ped)
    return Compound(children=partes)


def armar(nombre, alto_pedestal, chaflan_brida, con_brida=True):
    from build123d import export_step
    out = carpeta_salida()
    antes = _conjunto(ALTO_ANTES, 0.6)
    despues = _conjunto(alto_pedestal, chaflan_brida, con_brida)
    for f in (antes, despues):
        if not all(s.is_valid for s in f.solids()):
            salir_error(f'{nombre}: un solido no es valido')
    export_step(antes, os.path.join(out, nombre + '__antes.step'))
    export_step(despues, os.path.join(out, nombre + '.step'))
    print('ok', len(despues.solids()), round(sum(s.volume for s in despues.solids()), 3))

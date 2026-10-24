# -*- coding: utf-8 -*-
"""12 gate de fases - MAL 2: seguir optimizando despues del OK: el mecanismo se cierra con barrido verde y el OK de Fak,
y despues se corre el soporte del eje 0,5 mm en Y (caja, volumen y cantidad de solidos iguales; el render no lo
muestra). Pasar a la fase 3 con ese conjunto tiene que dar rojo y reabrir la fase 2. Piezas de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _escenario import escenario  # noqa: E402

escenario([["iniciar", None],
           ["cerrar", 0, {"ok-fak": "banco: contrato y zona confirmados por Fak"}],
           ["cerrar", 1, {"nota": "palanca con eje fijo; descartada la corredera"}],
           ["cerrar", 2, {"step": "$STEP", "movimiento": "$MOV", "ok-fak": "banco: la palanca gira sin tocar nada"}],
           ["retocar"],
           ["pasar", 3, {}]], retoque_dy=0.5)
